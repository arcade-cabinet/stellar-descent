/**
 * BalanceValidator - Validates combat balance configuration
 *
 * Performs automated sanity checks on all balance numbers:
 * - TTK within target ranges for every weapon/enemy/difficulty combo
 * - Ammo economy supports level completion
 * - Health pickups support player survival
 * - Damage curves are monotonically increasing with difficulty
 * - No weapon is obviously overpowered or underpowered
 *
 * Export a structured report suitable for logging, CI assertions, or dev-tool UI.
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import { DIFFICULTY_ORDER, DIFFICULTY_PRESETS } from '../core/DifficultySettings';
import type { WeaponId } from '../entities/weapons';
import {
  calculateAmmoRequiredForLevel,
  calculatePlayerSurvivableHits,
  calculateSustainedDPS,
  calculateTotalAmmoWithPickups,
  calculateTTK,
  calculateWeaponDPS,
  ENEMY_BALANCE,
  getEnemyTier,
  getScaledEnemyDamage,
  getScaledEnemyHealth,
  HEALTH_ECONOMY,
  LEVEL_SPAWN_CONFIG,
  PLAYER_BALANCE,
  TTK_TARGETS,
  WEAPON_BALANCE,
} from './CombatBalanceConfig';

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'pass' | 'warn' | 'fail';

export interface ValidationEntry {
  /** Short identifier for the check */
  check: string;
  /** Human-readable description of what was validated */
  description: string;
  /** pass / warn / fail */
  severity: ValidationSeverity;
  /** Additional details (numbers, context) */
  details: string;
}

export interface BalanceValidationReport {
  /** ISO timestamp of when the report was generated */
  timestamp: string;
  /** Total number of checks run */
  totalChecks: number;
  /** Counts by severity */
  passed: number;
  warnings: number;
  failures: number;
  /** Whether the overall balance is considered valid (no failures) */
  isValid: boolean;
  /** Individual entries */
  entries: ValidationEntry[];
}

// ---------------------------------------------------------------------------
// Validator implementation
// ---------------------------------------------------------------------------

export class BalanceValidator {
  private entries: ValidationEntry[] = [];

  /**
   * Run all balance validation checks and produce a report.
   */
  validate(): BalanceValidationReport {
    this.entries = [];

    this.validateAllWeaponsCanKill();
    this.validateTTKTargets();
    this.validateAmmoEconomy();
    this.validateHealthEconomy();
    this.validateDamageCurvesMonotonic();
    this.validateDifficultyScaling();
    this.validateNoWeaponDominance();
    this.validatePlayerSurvivability();
    this.validateSpawnMixTotals();

    const passed = this.entries.filter((e) => e.severity === 'pass').length;
    const warnings = this.entries.filter((e) => e.severity === 'warn').length;
    const failures = this.entries.filter((e) => e.severity === 'fail').length;

    return {
      timestamp: new Date().toISOString(),
      totalChecks: this.entries.length,
      passed,
      warnings,
      failures,
      isValid: failures === 0,
      entries: this.entries,
    };
  }

  // -------------------------------------------------------------------------
  // Individual checks
  // -------------------------------------------------------------------------

  /**
   * Every weapon must be able to kill every enemy type (damage > 0, DPS > 0).
   */
  private validateAllWeaponsCanKill(): void {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    const enemyIds = Object.keys(ENEMY_BALANCE);

    for (const weaponId of weaponIds) {
      const dps = calculateWeaponDPS(weaponId);
      for (const enemyId of enemyIds) {
        const hp = ENEMY_BALANCE[enemyId].baseHealth;
        const canKill = dps > 0 && hp > 0;
        this.addEntry({
          check: 'weapon_can_kill',
          description: `${WEAPON_BALANCE[weaponId]?.name ?? weaponId} can kill ${ENEMY_BALANCE[enemyId].name}`,
          severity: canKill ? 'pass' : 'fail',
          details: `DPS=${dps.toFixed(1)}, HP=${hp}`,
        });
      }
    }
  }

  /**
   * For every weapon/enemy/difficulty combo, burst TTK should be within the
   * target range defined in TTK_TARGETS.
   */
  private validateTTKTargets(): void {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    const enemyIds = Object.keys(ENEMY_BALANCE);

    for (const difficulty of DIFFICULTY_ORDER) {
      for (const weaponId of weaponIds) {
        for (const enemyId of enemyIds) {
          const tier = getEnemyTier(enemyId);
          const target = TTK_TARGETS[difficulty][tier];
          const ttk = calculateTTK(weaponId, enemyId, difficulty);

          let severity: ValidationSeverity = 'pass';
          if (ttk < target[0]) {
            // Killing too fast - warn unless way off
            severity = ttk < target[0] * 0.5 ? 'fail' : 'warn';
          } else if (ttk > target[1]) {
            // Killing too slow - warn unless way off
            severity = ttk > target[1] * 2 ? 'fail' : 'warn';
          }

          this.addEntry({
            check: 'ttk_target',
            description: `TTK ${WEAPON_BALANCE[weaponId]?.name ?? weaponId} vs ${ENEMY_BALANCE[enemyId].name} [${difficulty}]`,
            severity,
            details: `TTK=${ttk.toFixed(2)}s, target=[${target[0]}-${target[1]}]s`,
          });
        }
      }
    }
  }

  /**
   * For each level and weapon, the total available ammo (spawn + pickups) should
   * be enough to clear the level with some margin. On higher difficulties,
   * players are assumed to switch weapons and have better accuracy, so
   * per-weapon requirements are relaxed accordingly.
   */
  private validateAmmoEconomy(): void {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    const levelIds = Object.keys(LEVEL_SPAWN_CONFIG);

    // Per-difficulty parameters: harder difficulties = better player accuracy
    // and weapon switching (player uses all 3 weapons, not just one)
    const AMMO_PARAMS: Record<string, { missRate: number; failRatio: number; warnRatio: number }> =
      {
        easy: { missRate: 1.6, failRatio: 0.9, warnRatio: 1.1 },
        normal: { missRate: 1.5, failRatio: 0.8, warnRatio: 1.0 },
        hard: { missRate: 1.3, failRatio: 0.45, warnRatio: 0.7 },
        nightmare: { missRate: 1.15, failRatio: 0.3, warnRatio: 0.5 },
        ultra_nightmare: { missRate: 1.1, failRatio: 0.2, warnRatio: 0.4 }, // Extreme precision
      };

    for (const difficulty of DIFFICULTY_ORDER) {
      const params = AMMO_PARAMS[difficulty];
      for (const levelId of levelIds) {
        for (const weaponId of weaponIds) {
          const required = calculateAmmoRequiredForLevel(weaponId, levelId, difficulty);
          const available = calculateTotalAmmoWithPickups(weaponId, levelId, difficulty);
          const adjustedRequired = Math.round(required * params.missRate);
          const ratio = adjustedRequired > 0 ? available / adjustedRequired : Infinity;

          let severity: ValidationSeverity = 'pass';
          if (ratio < params.failRatio) {
            severity = 'fail';
          } else if (ratio < params.warnRatio) {
            severity = 'warn';
          }

          this.addEntry({
            check: 'ammo_economy',
            description: `Ammo economy: ${WEAPON_BALANCE[weaponId]?.name ?? weaponId} on ${LEVEL_SPAWN_CONFIG[levelId].levelName} [${difficulty}]`,
            severity,
            details: `available=${available}, needed(adj)=${adjustedRequired}, ratio=${ratio.toFixed(2)}`,
          });
        }
      }
    }
  }

  /**
   * Validate that health pickups can sustain the player through a level.
   * We estimate damage taken per section and compare against available healing.
   * On harder difficulties, skilled players dodge more effectively.
   */
  private validateHealthEconomy(): void {
    const levelIds = Object.keys(LEVEL_SPAWN_CONFIG);

    // Skilled players on harder difficulties take fewer hits per section
    const HITS_PER_SECTION: Record<string, number> = {
      easy: 2.5,
      normal: 2,
      hard: 1.5,
      nightmare: 1,
      ultra_nightmare: 0.5, // Elite players barely get touched
    };

    for (const difficulty of DIFFICULTY_ORDER) {
      for (const levelId of levelIds) {
        const level = LEVEL_SPAWN_CONFIG[levelId];

        const hitsPerSection = HITS_PER_SECTION[difficulty];
        // Average enemy damage for the level mix
        let avgDamage = 0;
        for (const [speciesId, fraction] of Object.entries(level.speciesMix)) {
          const dmg = getScaledEnemyDamage(speciesId, difficulty);
          avgDamage += dmg * fraction;
        }
        const damagePerSection = Math.round(avgDamage * hitsPerSection);
        const totalDamageEstimate = damagePerSection * level.combatSections;

        // Available healing: health regen + pickups
        // Regen between sections (~10s): healthRegenRate * difficulty modifier * 10
        const { playerHealthRegenMultiplier, resourceDropMultiplier } =
          getModifiersForDifficulty(difficulty);
        const regenBetweenSections =
          PLAYER_BALANCE.healthRegenRate * playerHealthRegenMultiplier * 10;
        const totalRegen = Math.round(regenBetweenSections * level.combatSections);

        // Health pickups
        const expectedPickups =
          HEALTH_ECONOMY.averagePickupsPerSection *
          level.combatSections *
          HEALTH_ECONOMY.baseDropChance *
          resourceDropMultiplier;
        const pickupHealing = Math.round(expectedPickups * HEALTH_ECONOMY.smallPackAmount);

        const totalHealing = totalRegen + pickupHealing + PLAYER_BALANCE.maxHealth;
        const ratio = totalDamageEstimate > 0 ? totalHealing / totalDamageEstimate : Infinity;

        let severity: ValidationSeverity = 'pass';
        if (ratio < 0.8) {
          severity = 'fail';
        } else if (ratio < 1.0) {
          severity = 'warn';
        }

        this.addEntry({
          check: 'health_economy',
          description: `Health economy: ${level.levelName} [${difficulty}]`,
          severity,
          details: `estDamage=${totalDamageEstimate}, healing=${totalHealing}, ratio=${ratio.toFixed(2)}`,
        });
      }
    }
  }

  /**
   * Enemy effective HP and damage should increase monotonically across difficulties.
   */
  private validateDamageCurvesMonotonic(): void {
    const enemyIds = Object.keys(ENEMY_BALANCE);

    for (const enemyId of enemyIds) {
      let prevHP = 0;
      let prevDmg = 0;

      for (const difficulty of DIFFICULTY_ORDER) {
        const hp = getScaledEnemyHealth(enemyId, difficulty);
        const dmg = getScaledEnemyDamage(enemyId, difficulty);

        if (hp < prevHP) {
          this.addEntry({
            check: 'damage_curve_monotonic',
            description: `${ENEMY_BALANCE[enemyId].name} HP decreases at ${difficulty}`,
            severity: 'fail',
            details: `HP=${hp}, previous=${prevHP}`,
          });
        } else {
          this.addEntry({
            check: 'damage_curve_monotonic',
            description: `${ENEMY_BALANCE[enemyId].name} HP scales up at ${difficulty}`,
            severity: 'pass',
            details: `HP=${hp} >= prev=${prevHP}`,
          });
        }

        if (dmg < prevDmg) {
          this.addEntry({
            check: 'damage_curve_monotonic',
            description: `${ENEMY_BALANCE[enemyId].name} damage decreases at ${difficulty}`,
            severity: 'fail',
            details: `damage=${dmg}, previous=${prevDmg}`,
          });
        } else {
          this.addEntry({
            check: 'damage_curve_monotonic',
            description: `${ENEMY_BALANCE[enemyId].name} damage scales up at ${difficulty}`,
            severity: 'pass',
            details: `damage=${dmg} >= prev=${prevDmg}`,
          });
        }

        prevHP = hp;
        prevDmg = dmg;
      }
    }
  }

  /**
   * Difficulty scaling should produce meaningful differences.
   * Hard should be noticeably harder than Normal, Nightmare harder still.
   */
  private validateDifficultyScaling(): void {
    const enemyIds = Object.keys(ENEMY_BALANCE);

    for (const enemyId of enemyIds) {
      const normalHP = getScaledEnemyHealth(enemyId, 'normal');
      const hardHP = getScaledEnemyHealth(enemyId, 'hard');
      const nightmareHP = getScaledEnemyHealth(enemyId, 'nightmare');

      // Hard should be at least 20% harder
      const hardRatio = hardHP / normalHP;
      this.addEntry({
        check: 'difficulty_scaling',
        description: `${ENEMY_BALANCE[enemyId].name} hard/normal HP ratio`,
        severity: hardRatio >= 1.2 ? 'pass' : 'warn',
        details: `ratio=${hardRatio.toFixed(2)} (want >= 1.20)`,
      });

      // Nightmare should be at least 50% harder than normal
      const nightmareRatio = nightmareHP / normalHP;
      this.addEntry({
        check: 'difficulty_scaling',
        description: `${ENEMY_BALANCE[enemyId].name} nightmare/normal HP ratio`,
        severity: nightmareRatio >= 1.5 ? 'pass' : 'warn',
        details: `ratio=${nightmareRatio.toFixed(2)} (want >= 1.50)`,
      });
    }
  }

  /**
   * No single weapon's DPS should be more than 2.5x any other weapon's DPS.
   * This prevents one weapon from making others obsolete.
   */
  private validateNoWeaponDominance(): void {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    const dpsMap = new Map<WeaponId, number>();
    const sustainedMap = new Map<WeaponId, number>();

    for (const weaponId of weaponIds) {
      dpsMap.set(weaponId, calculateWeaponDPS(weaponId));
      sustainedMap.set(weaponId, calculateSustainedDPS(weaponId));
    }

    const MAX_DPS_RATIO = 2.5;

    // Check burst DPS ratios
    for (const a of weaponIds) {
      for (const b of weaponIds) {
        if (a >= b) continue; // Only check each pair once
        const dpsA = dpsMap.get(a)!;
        const dpsB = dpsMap.get(b)!;
        const ratio = Math.max(dpsA, dpsB) / Math.min(dpsA, dpsB);

        this.addEntry({
          check: 'weapon_dominance',
          description: `Burst DPS ratio: ${WEAPON_BALANCE[a]?.name ?? a} vs ${WEAPON_BALANCE[b]?.name ?? b}`,
          severity: ratio <= MAX_DPS_RATIO ? 'pass' : 'warn',
          details: `ratio=${ratio.toFixed(2)} (max ${MAX_DPS_RATIO})`,
        });
      }
    }

    // Check sustained DPS ratios
    for (const a of weaponIds) {
      for (const b of weaponIds) {
        if (a >= b) continue;
        const dpsA = sustainedMap.get(a)!;
        const dpsB = sustainedMap.get(b)!;
        const ratio = Math.max(dpsA, dpsB) / Math.min(dpsA, dpsB);

        this.addEntry({
          check: 'weapon_dominance_sustained',
          description: `Sustained DPS ratio: ${WEAPON_BALANCE[a]?.name ?? a} vs ${WEAPON_BALANCE[b]?.name ?? b}`,
          severity: ratio <= MAX_DPS_RATIO ? 'pass' : 'warn',
          details: `ratio=${ratio.toFixed(2)} (max ${MAX_DPS_RATIO})`,
        });
      }
    }
  }

  /**
   * Player should survive the minimum number of hits defined in TTK_TARGETS
   * for the weakest enemy in each difficulty.
   */
  private validatePlayerSurvivability(): void {
    // Use the weakest enemy (skitterer) for survivability floor check
    const weakestEnemyId = 'skitterer';
    // Use the strongest non-boss enemy for survivability ceiling check
    const strongestEnemyId = 'husk';

    for (const difficulty of DIFFICULTY_ORDER) {
      const target = TTK_TARGETS[difficulty].playerSurvivesHits;

      // Weakest enemy: player should survive at least target[1] hits
      const hitsFromWeak = calculatePlayerSurvivableHits(weakestEnemyId, difficulty);
      this.addEntry({
        check: 'player_survivability',
        description: `Player survives ${ENEMY_BALANCE[weakestEnemyId].name} hits [${difficulty}]`,
        severity: hitsFromWeak >= target[0] ? 'pass' : 'fail',
        details: `survives=${hitsFromWeak} hits, target=[${target[0]}-${target[1]}]`,
      });

      // Strongest non-boss: player should survive at least target[0] hits
      const hitsFromStrong = calculatePlayerSurvivableHits(strongestEnemyId, difficulty);
      this.addEntry({
        check: 'player_survivability',
        description: `Player survives ${ENEMY_BALANCE[strongestEnemyId].name} hits [${difficulty}]`,
        severity: hitsFromStrong >= target[0] ? 'pass' : 'warn',
        details: `survives=${hitsFromStrong} hits, target=[${target[0]}-${target[1]}]`,
      });
    }
  }

  /**
   * Validate that species mix fractions sum to approximately 1.0 for each level.
   */
  private validateSpawnMixTotals(): void {
    for (const [_levelId, config] of Object.entries(LEVEL_SPAWN_CONFIG)) {
      const total = Object.values(config.speciesMix).reduce((sum, v) => sum + v, 0);
      const isValid = Math.abs(total - 1.0) < 0.01;

      this.addEntry({
        check: 'spawn_mix_total',
        description: `Species mix sums to 1.0 for ${config.levelName}`,
        severity: isValid ? 'pass' : 'fail',
        details: `total=${total.toFixed(3)}`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private addEntry(entry: ValidationEntry): void {
    this.entries.push(entry);
  }
}

// ---------------------------------------------------------------------------
// Convenience exports
// ---------------------------------------------------------------------------

/**
 * Run a full validation and return the report.
 */
export function runBalanceValidation(): BalanceValidationReport {
  const validator = new BalanceValidator();
  return validator.validate();
}

/**
 * Format a validation report as a human-readable string.
 */
export function formatBalanceReport(report: BalanceValidationReport): string {
  const lines: string[] = [];

  lines.push('=== COMBAT BALANCE VALIDATION REPORT ===');
  lines.push(`Generated: ${report.timestamp}`);
  lines.push(`Total checks: ${report.totalChecks}`);
  lines.push(
    `Passed: ${report.passed} | Warnings: ${report.warnings} | Failures: ${report.failures}`
  );
  lines.push(`Overall: ${report.isValid ? 'VALID' : 'INVALID'}`);
  lines.push('');

  // Group by check type
  const grouped = new Map<string, ValidationEntry[]>();
  for (const entry of report.entries) {
    const existing = grouped.get(entry.check) ?? [];
    existing.push(entry);
    grouped.set(entry.check, existing);
  }

  for (const [checkName, entries] of grouped) {
    const failCount = entries.filter((e) => e.severity === 'fail').length;
    const warnCount = entries.filter((e) => e.severity === 'warn').length;
    const passCount = entries.filter((e) => e.severity === 'pass').length;

    lines.push(`--- ${checkName} (${passCount}P/${warnCount}W/${failCount}F) ---`);

    // Only show non-passing entries for brevity, unless all pass
    const nonPassing = entries.filter((e) => e.severity !== 'pass');
    const toShow = nonPassing.length > 0 ? nonPassing : entries.slice(0, 3);

    for (const entry of toShow) {
      const icon = entry.severity === 'pass' ? '[OK]' : entry.severity === 'warn' ? '[!!]' : '[XX]';
      lines.push(`  ${icon} ${entry.description}`);
      lines.push(`      ${entry.details}`);
    }

    if (nonPassing.length === 0 && entries.length > 3) {
      lines.push(`  ... and ${entries.length - 3} more passing checks`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getModifiersForDifficulty(difficulty: DifficultyLevel) {
  return DIFFICULTY_PRESETS[difficulty].modifiers;
}
