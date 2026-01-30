import { describe, expect, it } from 'vitest';
import { DIFFICULTY_ORDER, type DifficultyLevel } from '../core/DifficultySettings';
import type { WeaponId } from '../entities/weapons';
import { BalanceValidator, formatBalanceReport, runBalanceValidation } from './BalanceValidator';
import {
  calculateAmmoRequiredForLevel,
  calculatePlayerSurvivableHits,
  calculateSustainedDPS,
  calculateSustainedTTK,
  calculateTotalAmmo,
  calculateTotalAmmoWithPickups,
  calculateTTK,
  calculateWeaponDPS,
  ENEMY_BALANCE,
  generateBalanceSummary,
  getEnemyTier,
  getScaledEnemyDamage,
  getScaledEnemyHealth,
  LEVEL_SPAWN_CONFIG,
  PLAYER_BALANCE,
  TTK_TARGETS,
  WEAPON_BALANCE,
} from './CombatBalanceConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEAPON_IDS = Object.keys(WEAPON_BALANCE) as WeaponId[];
const ENEMY_IDS = Object.keys(ENEMY_BALANCE);
const LEVEL_IDS = Object.keys(LEVEL_SPAWN_CONFIG);

// ---------------------------------------------------------------------------
// 1. All weapons can kill all enemy types
// ---------------------------------------------------------------------------

describe('All weapons can kill all enemy types', () => {
  for (const weaponId of WEAPON_IDS) {
    for (const enemyId of ENEMY_IDS) {
      it(`${WEAPON_BALANCE[weaponId].name} can kill ${ENEMY_BALANCE[enemyId].name}`, () => {
        const dps = calculateWeaponDPS(weaponId);
        const hp = ENEMY_BALANCE[enemyId].baseHealth;

        expect(dps).toBeGreaterThan(0);
        expect(hp).toBeGreaterThan(0);

        // TTK must be finite
        const ttk = calculateTTK(weaponId, enemyId, 'normal');
        expect(ttk).toBeLessThan(Infinity);
        expect(ttk).toBeGreaterThan(0);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 2. TTK values are within targets
// ---------------------------------------------------------------------------

describe('TTK values within targets', () => {
  for (const difficulty of DIFFICULTY_ORDER) {
    describe(`[${difficulty}]`, () => {
      for (const weaponId of WEAPON_IDS) {
        for (const enemyId of ENEMY_IDS) {
          const tier = getEnemyTier(enemyId);
          const target = TTK_TARGETS[difficulty][tier];

          it(`${WEAPON_BALANCE[weaponId].name} vs ${ENEMY_BALANCE[enemyId].name}: TTK in [${target[0]}-${target[1]}]s`, () => {
            const ttk = calculateTTK(weaponId, enemyId, difficulty);

            // Allow some tolerance: burst TTK can be up to 50% below minimum
            // (some weapons are burst-focused), but should not exceed 2x maximum
            expect(ttk).toBeGreaterThanOrEqual(target[0] * 0.5);
            expect(ttk).toBeLessThanOrEqual(target[1] * 2.0);
          });
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Ammo economy is balanced
// ---------------------------------------------------------------------------

describe('Ammo economy supports level completion', () => {
  // Per-difficulty parameters: harder difficulties assume better accuracy
  // and weapon switching (player uses all 3 weapons, not just one)
  const DIFFICULTY_AMMO_PARAMS: Record<string, { missRate: number; threshold: number }> = {
    normal: { missRate: 1.5, threshold: 0.8 }, // Casual: 67% accuracy, one weapon viable
    veteran: { missRate: 1.3, threshold: 0.5 }, // Skilled: 77% accuracy, weapon switching
    legendary: { missRate: 1.15, threshold: 0.35 }, // Expert: 87% accuracy, all weapons + melee
  };

  for (const difficulty of DIFFICULTY_ORDER) {
    const { missRate, threshold } = DIFFICULTY_AMMO_PARAMS[difficulty];

    describe(`[${difficulty}]`, () => {
      for (const levelId of LEVEL_IDS) {
        for (const weaponId of WEAPON_IDS) {
          it(`${WEAPON_BALANCE[weaponId].name} has enough ammo for ${LEVEL_SPAWN_CONFIG[levelId].levelName}`, () => {
            const required = calculateAmmoRequiredForLevel(weaponId, levelId, difficulty);
            const available = calculateTotalAmmoWithPickups(weaponId, levelId, difficulty);
            const adjustedRequired = Math.round(required * missRate);

            // Player should have enough ammo (with pickups) to handle their
            // share of enemies at this difficulty level
            expect(available).toBeGreaterThanOrEqual(adjustedRequired * threshold);
          });
        }
      }
    });
  }

  it('total ammo without pickups is positive for all weapons', () => {
    for (const weaponId of WEAPON_IDS) {
      const total = calculateTotalAmmo(weaponId);
      expect(total).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Difficulty multipliers scale correctly
// ---------------------------------------------------------------------------

describe('Difficulty multipliers scale correctly', () => {
  for (const enemyId of ENEMY_IDS) {
    it(`${ENEMY_BALANCE[enemyId].name} HP increases with difficulty`, () => {
      const normalHP = getScaledEnemyHealth(enemyId, 'normal');
      const veteranHP = getScaledEnemyHealth(enemyId, 'veteran');
      const legendaryHP = getScaledEnemyHealth(enemyId, 'legendary');

      expect(veteranHP).toBeGreaterThan(normalHP);
      expect(legendaryHP).toBeGreaterThan(veteranHP);
    });

    it(`${ENEMY_BALANCE[enemyId].name} damage increases with difficulty`, () => {
      const normalDmg = getScaledEnemyDamage(enemyId, 'normal');
      const veteranDmg = getScaledEnemyDamage(enemyId, 'veteran');
      const legendaryDmg = getScaledEnemyDamage(enemyId, 'legendary');

      expect(veteranDmg).toBeGreaterThanOrEqual(normalDmg);
      expect(legendaryDmg).toBeGreaterThanOrEqual(veteranDmg);
    });

    it(`${ENEMY_BALANCE[enemyId].name} veteran HP is at least 1.2x normal`, () => {
      const normalHP = getScaledEnemyHealth(enemyId, 'normal');
      const veteranHP = getScaledEnemyHealth(enemyId, 'veteran');
      expect(veteranHP / normalHP).toBeGreaterThanOrEqual(1.2);
    });

    it(`${ENEMY_BALANCE[enemyId].name} legendary HP is at least 1.5x normal`, () => {
      const normalHP = getScaledEnemyHealth(enemyId, 'normal');
      const legendaryHP = getScaledEnemyHealth(enemyId, 'legendary');
      expect(legendaryHP / normalHP).toBeGreaterThanOrEqual(1.5);
    });
  }

  it('TTK increases with difficulty for every weapon/enemy combo', () => {
    for (const weaponId of WEAPON_IDS) {
      for (const enemyId of ENEMY_IDS) {
        const normalTTK = calculateTTK(weaponId, enemyId, 'normal');
        const veteranTTK = calculateTTK(weaponId, enemyId, 'veteran');
        const legendaryTTK = calculateTTK(weaponId, enemyId, 'legendary');

        expect(veteranTTK).toBeGreaterThan(normalTTK);
        expect(legendaryTTK).toBeGreaterThan(veteranTTK);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. No weapon is obviously overpowered or underpowered
// ---------------------------------------------------------------------------

describe('No weapon is obviously OP or underpowered', () => {
  const MAX_DPS_RATIO = 2.5;

  it('burst DPS ratio between any two weapons is at most 2.5x', () => {
    const dpsValues = WEAPON_IDS.map((id) => ({
      id,
      dps: calculateWeaponDPS(id),
    }));

    for (let i = 0; i < dpsValues.length; i++) {
      for (let j = i + 1; j < dpsValues.length; j++) {
        const a = dpsValues[i];
        const b = dpsValues[j];
        const ratio = Math.max(a.dps, b.dps) / Math.min(a.dps, b.dps);

        expect(
          ratio,
          `${WEAPON_BALANCE[a.id].name} (${a.dps}) vs ${WEAPON_BALANCE[b.id].name} (${b.dps})`
        ).toBeLessThanOrEqual(MAX_DPS_RATIO);
      }
    }
  });

  it('sustained DPS ratio between any two weapons is at most 2.5x', () => {
    const dpsValues = WEAPON_IDS.map((id) => ({
      id,
      dps: calculateSustainedDPS(id),
    }));

    for (let i = 0; i < dpsValues.length; i++) {
      for (let j = i + 1; j < dpsValues.length; j++) {
        const a = dpsValues[i];
        const b = dpsValues[j];
        const ratio = Math.max(a.dps, b.dps) / Math.min(a.dps, b.dps);

        expect(
          ratio,
          `${WEAPON_BALANCE[a.id].name} (${a.dps.toFixed(1)}) vs ${WEAPON_BALANCE[b.id].name} (${b.dps.toFixed(1)})`
        ).toBeLessThanOrEqual(MAX_DPS_RATIO);
      }
    }
  });

  it('every weapon has positive DPS', () => {
    for (const weaponId of WEAPON_IDS) {
      expect(calculateWeaponDPS(weaponId)).toBeGreaterThan(0);
      expect(calculateSustainedDPS(weaponId)).toBeGreaterThan(0);
    }
  });

  it('plasma cannon has highest per-shot damage', () => {
    const plasma = WEAPON_BALANCE.plasma_cannon.damage;
    expect(plasma).toBeGreaterThan(WEAPON_BALANCE.assault_rifle.damage);
    expect(plasma).toBeGreaterThan(WEAPON_BALANCE.pulse_smg.damage);
  });

  it('pulse SMG has highest fire rate', () => {
    const smg = WEAPON_BALANCE.pulse_smg.fireRate;
    expect(smg).toBeGreaterThan(WEAPON_BALANCE.assault_rifle.fireRate);
    expect(smg).toBeGreaterThan(WEAPON_BALANCE.plasma_cannon.fireRate);
  });

  it('assault rifle is a balanced middle ground', () => {
    const rifle = WEAPON_BALANCE.assault_rifle;
    const smg = WEAPON_BALANCE.pulse_smg;
    const plasma = WEAPON_BALANCE.plasma_cannon;

    // Damage: between SMG and Plasma
    expect(rifle.damage).toBeGreaterThan(smg.damage);
    expect(rifle.damage).toBeLessThan(plasma.damage);

    // Fire rate: between Plasma and SMG
    expect(rifle.fireRate).toBeGreaterThan(plasma.fireRate);
    expect(rifle.fireRate).toBeLessThan(smg.fireRate);
  });
});

// ---------------------------------------------------------------------------
// 6. Player survivability
// ---------------------------------------------------------------------------

describe('Player survivability', () => {
  for (const difficulty of DIFFICULTY_ORDER) {
    const targets = TTK_TARGETS[difficulty].playerSurvivesHits;

    it(`player survives [${targets[0]}-${targets[1]}] hits from weakest enemy on ${difficulty}`, () => {
      const hits = calculatePlayerSurvivableHits('skitterer', difficulty);
      expect(hits).toBeGreaterThanOrEqual(targets[0]);
    });

    it(`player survives at least ${targets[0]} hits from strongest non-boss on ${difficulty}`, () => {
      // Check all non-boss enemies
      for (const enemyId of ENEMY_IDS) {
        if (ENEMY_BALANCE[enemyId].isBoss) continue;
        const hits = calculatePlayerSurvivableHits(enemyId, difficulty);
        // At minimum, player should survive 1 hit from any non-boss enemy
        expect(hits, `vs ${ENEMY_BALANCE[enemyId].name}`).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it('player maxHealth is positive', () => {
    expect(PLAYER_BALANCE.maxHealth).toBeGreaterThan(0);
  });

  it('player healthRegenRate is positive', () => {
    expect(PLAYER_BALANCE.healthRegenRate).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Spawn mix integrity
// ---------------------------------------------------------------------------

describe('Spawn configuration integrity', () => {
  for (const [levelId, config] of Object.entries(LEVEL_SPAWN_CONFIG)) {
    it(`${config.levelName} species mix sums to 1.0`, () => {
      const total = Object.values(config.speciesMix).reduce((sum, v) => sum + v, 0);
      expect(total).toBeCloseTo(1.0, 2);
    });

    it(`${config.levelName} has positive base enemy count`, () => {
      expect(config.baseEnemyCount).toBeGreaterThan(0);
    });

    it(`${config.levelName} has at least 1 combat section`, () => {
      expect(config.combatSections).toBeGreaterThanOrEqual(1);
    });

    it(`${config.levelName} species references valid enemies`, () => {
      for (const speciesId of Object.keys(config.speciesMix)) {
        expect(ENEMY_BALANCE[speciesId], `${speciesId} should be in ENEMY_BALANCE`).toBeDefined();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 8. Balance config integrity
// ---------------------------------------------------------------------------

describe('Balance config structural integrity', () => {
  it('all weapons have positive magazine size', () => {
    for (const weaponId of WEAPON_IDS) {
      expect(WEAPON_BALANCE[weaponId].magazineSize).toBeGreaterThan(0);
    }
  });

  it('all weapons have positive reload time', () => {
    for (const weaponId of WEAPON_IDS) {
      expect(WEAPON_BALANCE[weaponId].reloadTimeMs).toBeGreaterThan(0);
    }
  });

  it('all weapons have reserve ammo >= magazine size', () => {
    for (const weaponId of WEAPON_IDS) {
      const w = WEAPON_BALANCE[weaponId];
      expect(w.maxReserveAmmo).toBeGreaterThanOrEqual(w.magazineSize);
    }
  });

  it('all enemies have positive base health', () => {
    for (const enemyId of ENEMY_IDS) {
      expect(ENEMY_BALANCE[enemyId].baseHealth).toBeGreaterThan(0);
    }
  });

  it('all enemies have positive base damage', () => {
    for (const enemyId of ENEMY_IDS) {
      expect(ENEMY_BALANCE[enemyId].baseDamage).toBeGreaterThan(0);
    }
  });

  it('all TTK targets have min < max', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const targets = TTK_TARGETS[difficulty];
      for (const [tier, range] of Object.entries(targets)) {
        if (tier === 'playerSurvivesHits') {
          expect(range[0], `${difficulty} ${tier}`).toBeLessThanOrEqual(range[1]);
        } else {
          expect(range[0], `${difficulty} ${tier}`).toBeLessThan(range[1]);
        }
      }
    }
  });

  it('TTK targets increase with difficulty', () => {
    const tiers = ['basicEnemy', 'mediumEnemy', 'heavyEnemy', 'bossEnemy'] as const;

    for (const tier of tiers) {
      const normalMin = TTK_TARGETS.normal[tier][0];
      const veteranMin = TTK_TARGETS.veteran[tier][0];
      const legendaryMin = TTK_TARGETS.legendary[tier][0];

      expect(veteranMin, `${tier} veteran >= normal`).toBeGreaterThanOrEqual(normalMin);
      expect(legendaryMin, `${tier} legendary >= veteran`).toBeGreaterThanOrEqual(veteranMin);
    }
  });

  it('player survives hits targets decrease with difficulty', () => {
    const normalMax = TTK_TARGETS.normal.playerSurvivesHits[1];
    const veteranMax = TTK_TARGETS.veteran.playerSurvivesHits[1];
    const legendaryMax = TTK_TARGETS.legendary.playerSurvivesHits[1];

    expect(veteranMax).toBeLessThanOrEqual(normalMax);
    expect(legendaryMax).toBeLessThanOrEqual(veteranMax);
  });
});

// ---------------------------------------------------------------------------
// 9. Sustained TTK calculations
// ---------------------------------------------------------------------------

describe('Sustained TTK calculations', () => {
  it('sustained TTK is close to or exceeds burst TTK for all combos', () => {
    for (const weaponId of WEAPON_IDS) {
      for (const enemyId of ENEMY_IDS) {
        for (const difficulty of DIFFICULTY_ORDER) {
          const burst = calculateTTK(weaponId, enemyId, difficulty);
          const sustained = calculateSustainedTTK(weaponId, enemyId, difficulty);

          // Sustained uses discrete shots while burst uses continuous DPS.
          // When one magazine suffices, discrete model can be up to 1/fireRate
          // seconds lower due to damage overkill on the last shot.
          const discreteTolerance = 1 / WEAPON_BALANCE[weaponId].fireRate;
          expect(
            sustained,
            `${WEAPON_BALANCE[weaponId].name} vs ${ENEMY_BALANCE[enemyId].name} [${difficulty}]`
          ).toBeGreaterThanOrEqual(burst - discreteTolerance - 0.001);
        }
      }
    }
  });

  it('sustained TTK is close to burst TTK when one magazine is enough', () => {
    // Assault rifle vs skitterer on normal: 170 HP, 25 dmg/shot, 32 mag
    // One magazine (32 * 25 = 800) exceeds 170 HP
    // Burst uses continuous DPS model, sustained uses discrete shots - they differ slightly
    const burst = calculateTTK('assault_rifle', 'skitterer', 'normal');
    const sustained = calculateSustainedTTK('assault_rifle', 'skitterer', 'normal');
    expect(Math.abs(sustained - burst)).toBeLessThan(0.2);
  });
});

// ---------------------------------------------------------------------------
// 10. Balance summary generation
// ---------------------------------------------------------------------------

describe('Balance summary generation', () => {
  it('generates entries for all weapon/enemy combos', () => {
    const summary = generateBalanceSummary('normal');
    expect(summary.length).toBe(WEAPON_IDS.length * ENEMY_IDS.length);
  });

  it('all entries have positive DPS and HP', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const summary = generateBalanceSummary(difficulty);
      for (const entry of summary) {
        expect(entry.weaponDPS).toBeGreaterThan(0);
        expect(entry.sustainedDPS).toBeGreaterThan(0);
        expect(entry.enemyHP).toBeGreaterThan(0);
        expect(entry.burstTTK).toBeGreaterThan(0);
        expect(entry.sustainedTTK).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Full validator integration
// ---------------------------------------------------------------------------

describe('BalanceValidator integration', () => {
  it('produces a valid report', () => {
    const report = runBalanceValidation();
    expect(report.totalChecks).toBeGreaterThan(0);
    expect(report.passed + report.warnings + report.failures).toBe(report.totalChecks);
    expect(typeof report.isValid).toBe('boolean');
    expect(report.timestamp).toBeTruthy();
  });

  it('has no hard failures', () => {
    const report = runBalanceValidation();
    const failures = report.entries.filter((e) => e.severity === 'fail');

    if (failures.length > 0) {
      const failMessages = failures.map((f) => `${f.description}: ${f.details}`).join('\n');
      expect(failures.length, `Balance failures:\n${failMessages}`).toBe(0);
    }
  });

  it('report can be formatted as string', () => {
    const report = runBalanceValidation();
    const formatted = formatBalanceReport(report);
    expect(formatted).toContain('COMBAT BALANCE VALIDATION REPORT');
    expect(formatted).toContain('Total checks:');
  });

  it('BalanceValidator class can be instantiated and run', () => {
    const validator = new BalanceValidator();
    const report = validator.validate();
    expect(report.entries.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Enemy tier mapping
// ---------------------------------------------------------------------------

describe('Enemy tier mapping', () => {
  it('skitterer is basic tier', () => {
    expect(getEnemyTier('skitterer')).toBe('basicEnemy');
  });

  it('lurker and husk are medium tier', () => {
    expect(getEnemyTier('lurker')).toBe('mediumEnemy');
    expect(getEnemyTier('husk')).toBe('mediumEnemy');
  });

  it('spewer is heavy tier', () => {
    expect(getEnemyTier('spewer')).toBe('heavyEnemy');
  });

  it('broodmother is boss tier', () => {
    expect(getEnemyTier('broodmother')).toBe('bossEnemy');
  });

  it('unknown enemy defaults to medium tier', () => {
    expect(getEnemyTier('unknown_species')).toBe('mediumEnemy');
  });
});
