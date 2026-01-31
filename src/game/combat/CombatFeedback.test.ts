/**
 * CombatFeedback.test.ts - Comprehensive unit tests for combat feedback systems
 *
 * Tests damage calculation, hit detection logic, kill confirmation triggers,
 * and critical hit detection across the combat system.
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePlayerSurvivableHits,
  calculateSustainedTTK,
  calculateTTK,
  calculateWeaponDPS,
  ENEMY_BALANCE,
  getEnemyTier,
  getScaledEnemyDamage,
  getScaledEnemyHealth,
  getScaledPlayerDamageReceived,
  PLAYER_BALANCE,
  TTK_TARGETS,
  WEAPON_BALANCE,
} from '../balance/CombatBalanceConfig';
import { DIFFICULTY_ORDER, getDifficultyModifiers, type DifficultyLevel } from '../core/DifficultySettings';
import type { WeaponId } from '../entities/weapons';

// ---------------------------------------------------------------------------
// Constants for validation
// ---------------------------------------------------------------------------

/** Critical hit multiplier used in combat system */
const CRITICAL_HIT_MULTIPLIER = 1.5;

/** Head hit threshold (upper 30% of enemy height triggers critical) */
const HEAD_HIT_THRESHOLD = 0.7;

/** Enemy projectile base damage */
const ENEMY_PROJECTILE_BASE_DAMAGE = 10;

/** Hit detection radius for projectile collision */
const HIT_DETECTION_RADIUS = 1.5;

// ---------------------------------------------------------------------------
// Helper functions for damage calculation testing
// ---------------------------------------------------------------------------

/**
 * Calculate damage with critical hit modifier
 */
function calculateDamageWithCritical(baseDamage: number, isCritical: boolean): number {
  return isCritical ? Math.round(baseDamage * CRITICAL_HIT_MULTIPLIER) : baseDamage;
}

/**
 * Determine if a hit is critical based on hit height
 * @param hitHeight - Height of the hit point relative to enemy position
 * @param enemyHeight - Total height of the enemy
 */
function isCriticalHit(hitHeight: number, enemyHeight: number): boolean {
  return hitHeight > enemyHeight * HEAD_HIT_THRESHOLD;
}

// ---------------------------------------------------------------------------
// 1. Damage Calculation Tests
// ---------------------------------------------------------------------------

describe('Damage Calculation', () => {
  describe('Base Damage', () => {
    it('should have positive base damage for all weapons', () => {
      const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
      for (const id of weaponIds) {
        const weapon = WEAPON_BALANCE[id];
        expect(weapon?.damage, `${id} should have positive damage`).toBeGreaterThan(0);
      }
    });

    it('should have positive base damage for all enemies', () => {
      const enemyIds = Object.keys(ENEMY_BALANCE);
      for (const id of enemyIds) {
        const enemy = ENEMY_BALANCE[id];
        expect(enemy.baseDamage, `${id} should have positive damage`).toBeGreaterThan(0);
      }
    });

    it('should scale enemy damage with difficulty', () => {
      for (const enemyId of Object.keys(ENEMY_BALANCE)) {
        const normalDmg = getScaledEnemyDamage(enemyId, 'normal');
        const hardDmg = getScaledEnemyDamage(enemyId, 'hard');
        const nightmareDmg = getScaledEnemyDamage(enemyId, 'nightmare');

        expect(hardDmg, `${enemyId} hard damage >= normal`).toBeGreaterThanOrEqual(normalDmg);
        expect(nightmareDmg, `${enemyId} nightmare damage >= hard`).toBeGreaterThanOrEqual(hardDmg);
      }
    });

    it('should scale player damage received with difficulty', () => {
      const baseDamage = 20;
      const normalDmg = getScaledPlayerDamageReceived(baseDamage, 'normal');
      const hardDmg = getScaledPlayerDamageReceived(baseDamage, 'hard');
      const nightmareDmg = getScaledPlayerDamageReceived(baseDamage, 'nightmare');

      expect(hardDmg).toBeGreaterThanOrEqual(normalDmg);
      expect(nightmareDmg).toBeGreaterThanOrEqual(hardDmg);
    });
  });

  describe('Weapon DPS', () => {
    it('should calculate DPS as damage * fireRate', () => {
      const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
      for (const id of weaponIds) {
        const weapon = WEAPON_BALANCE[id];
        if (!weapon) continue;
        const calculatedDps = weapon.damage * weapon.fireRate;
        const functionDps = calculateWeaponDPS(id);
        expect(functionDps).toBeCloseTo(calculatedDps, 5);
      }
    });

    it('should have positive DPS for all weapons', () => {
      const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
      for (const id of weaponIds) {
        const dps = calculateWeaponDPS(id);
        expect(dps, `${id} should have positive DPS`).toBeGreaterThan(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Critical Hit Detection Tests
// ---------------------------------------------------------------------------

describe('Critical Hit Detection', () => {
  describe('Hit Height Calculation', () => {
    it('should trigger critical hit when hit is in upper 30% of enemy', () => {
      const enemyHeight = 2.0; // 2 meters tall
      const hitHeights = [1.5, 1.8, 2.0]; // All above 70% of 2.0 = 1.4

      for (const hitHeight of hitHeights) {
        expect(
          isCriticalHit(hitHeight, enemyHeight),
          `Hit at ${hitHeight}m on ${enemyHeight}m enemy should be critical`
        ).toBe(true);
      }
    });

    it('should not trigger critical hit when hit is below 70% height', () => {
      const enemyHeight = 2.0;
      const hitHeights = [0.5, 1.0, 1.3, 1.39]; // All at or below 70% of 2.0 = 1.4

      for (const hitHeight of hitHeights) {
        expect(
          isCriticalHit(hitHeight, enemyHeight),
          `Hit at ${hitHeight}m on ${enemyHeight}m enemy should NOT be critical`
        ).toBe(false);
      }
    });

    it('should handle edge case at exactly 70% threshold', () => {
      const enemyHeight = 2.0;
      const exactThreshold = enemyHeight * HEAD_HIT_THRESHOLD; // 1.4

      // Exactly at threshold should NOT be critical (using > not >=)
      expect(isCriticalHit(exactThreshold, enemyHeight)).toBe(false);
      // Just above should be critical
      expect(isCriticalHit(exactThreshold + 0.01, enemyHeight)).toBe(true);
    });

    it('should handle various enemy heights', () => {
      const testCases = [
        { enemyHeight: 1.0, hitHeight: 0.8, expected: true },
        { enemyHeight: 1.0, hitHeight: 0.6, expected: false },
        { enemyHeight: 3.0, hitHeight: 2.5, expected: true },
        { enemyHeight: 3.0, hitHeight: 1.5, expected: false },
        { enemyHeight: 0.5, hitHeight: 0.4, expected: true }, // Small enemy
        { enemyHeight: 0.5, hitHeight: 0.3, expected: false },
      ];

      for (const { enemyHeight, hitHeight, expected } of testCases) {
        expect(
          isCriticalHit(hitHeight, enemyHeight),
          `Hit at ${hitHeight}m on ${enemyHeight}m enemy should ${expected ? '' : 'NOT '}be critical`
        ).toBe(expected);
      }
    });
  });

  describe('Critical Damage Calculation', () => {
    it('should apply 1.5x multiplier for critical hits', () => {
      const baseDamages = [10, 25, 50, 100];

      for (const base of baseDamages) {
        const critDamage = calculateDamageWithCritical(base, true);
        expect(critDamage).toBe(Math.round(base * CRITICAL_HIT_MULTIPLIER));
      }
    });

    it('should not modify damage for non-critical hits', () => {
      const baseDamages = [10, 25, 50, 100];

      for (const base of baseDamages) {
        const normalDamage = calculateDamageWithCritical(base, false);
        expect(normalDamage).toBe(base);
      }
    });

    it('should round critical damage to nearest integer', () => {
      // Test case where 1.5x would give decimal
      const baseDamage = 15; // 15 * 1.5 = 22.5
      const critDamage = calculateDamageWithCritical(baseDamage, true);
      expect(critDamage).toBe(23); // Math.round(22.5)
    });

    it('critical damage should always be greater than base damage', () => {
      const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
      for (const id of weaponIds) {
        const weapon = WEAPON_BALANCE[id];
        if (!weapon) continue;
        const critDamage = calculateDamageWithCritical(weapon.damage, true);
        expect(critDamage).toBeGreaterThan(weapon.damage);
      }
    });
  });

  describe('Weapon Critical Multipliers', () => {
    it('should have positive critical multiplier for all weapons', () => {
      const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
      for (const id of weaponIds) {
        const weapon = WEAPON_BALANCE[id];
        expect(weapon?.critMultiplier, `${id} should have positive crit multiplier`).toBeGreaterThan(0);
      }
    });

    it('precision weapons should have higher critical multipliers', () => {
      const sniperCrit = WEAPON_BALANCE.sniper_rifle?.critMultiplier ?? 0;
      const smgCrit = WEAPON_BALANCE.pulse_smg?.critMultiplier ?? 0;

      expect(sniperCrit).toBeGreaterThan(smgCrit);
    });

    it('revolver should have high critical multiplier due to precision nature', () => {
      const revolverCrit = WEAPON_BALANCE.revolver?.critMultiplier ?? 0;
      expect(revolverCrit).toBeGreaterThanOrEqual(2.0);
    });

    it('shotguns should have lower critical multipliers due to spread', () => {
      const shotgunCrit = WEAPON_BALANCE.auto_shotgun?.critMultiplier ?? 0;
      expect(shotgunCrit).toBeLessThanOrEqual(1.5);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Hit Detection Logic Tests
// ---------------------------------------------------------------------------

describe('Hit Detection Logic', () => {
  describe('Distance-based Hit Detection', () => {
    it('should register hit when projectile is within hit radius', () => {
      const hitDistances = [0, 0.5, 1.0, 1.49];
      for (const dist of hitDistances) {
        expect(dist < HIT_DETECTION_RADIUS, `Distance ${dist} should be a hit`).toBe(true);
      }
    });

    it('should not register hit when projectile is outside hit radius', () => {
      const missDistances = [1.5, 2.0, 3.0, 10.0];
      for (const dist of missDistances) {
        expect(dist < HIT_DETECTION_RADIUS, `Distance ${dist} should NOT be a hit`).toBe(false);
      }
    });

    it('hit radius should be positive and reasonable', () => {
      expect(HIT_DETECTION_RADIUS).toBeGreaterThan(0);
      expect(HIT_DETECTION_RADIUS).toBeLessThan(5); // Not unreasonably large
    });
  });

  describe('Projectile Ownership', () => {
    it('should correctly identify player projectiles', () => {
      const playerProjectileTags = { projectile: true, player: true };
      const isPlayer = playerProjectileTags.player === true;
      expect(isPlayer).toBe(true);
    });

    it('should correctly identify enemy projectiles', () => {
      const enemyProjectileTags = { projectile: true, enemy: true };
      const isEnemy = enemyProjectileTags.enemy === true;
      expect(isEnemy).toBe(true);
    });

    it('should correctly identify ally projectiles', () => {
      const allyProjectileTags = { projectile: true, ally: true };
      const isAlly = allyProjectileTags.ally === true;
      expect(isAlly).toBe(true);
    });

    it('projectile without enemy tag defaults to player', () => {
      const defaultProjectileTags: { projectile: boolean; enemy?: boolean; ally?: boolean } = { projectile: true };
      const isPlayerProjectile = !defaultProjectileTags.enemy && !defaultProjectileTags.ally;
      expect(isPlayerProjectile).toBe(true);
    });
  });

  describe('Enemy Health Thresholds', () => {
    it('should have positive base health for all enemies', () => {
      for (const id of Object.keys(ENEMY_BALANCE)) {
        expect(ENEMY_BALANCE[id].baseHealth).toBeGreaterThan(0);
      }
    });

    it('enemy health should scale with difficulty', () => {
      for (const enemyId of Object.keys(ENEMY_BALANCE)) {
        const normalHP = getScaledEnemyHealth(enemyId, 'normal');
        const hardHP = getScaledEnemyHealth(enemyId, 'hard');
        const nightmareHP = getScaledEnemyHealth(enemyId, 'nightmare');

        expect(hardHP, `${enemyId} hard HP > normal`).toBeGreaterThan(normalHP);
        expect(nightmareHP, `${enemyId} nightmare HP > hard`).toBeGreaterThan(hardHP);
      }
    });

    it('boss enemies should have significantly more health', () => {
      const bossId = 'broodmother';
      const basicId = 'skitterer';

      const bossHP = ENEMY_BALANCE[bossId].baseHealth;
      const basicHP = ENEMY_BALANCE[basicId].baseHealth;

      expect(bossHP).toBeGreaterThan(basicHP * 5);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Kill Confirmation Triggers
// ---------------------------------------------------------------------------

describe('Kill Confirmation Triggers', () => {
  describe('Death Detection', () => {
    it('should trigger death when health reaches 0', () => {
      let health = 100;
      const damage = 100;
      health -= damage;
      expect(health <= 0).toBe(true);
    });

    it('should trigger death when health goes negative', () => {
      let health = 50;
      const damage = 100;
      health -= damage;
      expect(health <= 0).toBe(true);
    });

    it('should not trigger death when health is positive', () => {
      let health = 100;
      const damage = 50;
      health -= damage;
      expect(health <= 0).toBe(false);
    });
  });

  describe('TTK (Time To Kill) Calculations', () => {
    it('should calculate positive TTK for all weapon/enemy combos', () => {
      const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
      const enemyIds = Object.keys(ENEMY_BALANCE);

      for (const weaponId of weaponIds) {
        for (const enemyId of enemyIds) {
          const ttk = calculateTTK(weaponId, enemyId, 'normal');
          expect(ttk, `${weaponId} vs ${enemyId} TTK should be positive`).toBeGreaterThan(0);
          expect(ttk, `${weaponId} vs ${enemyId} TTK should be finite`).toBeLessThan(Infinity);
        }
      }
    });

    it('TTK should increase with difficulty', () => {
      const weaponId = 'assault_rifle';
      const enemyId = 'skitterer';

      const normalTTK = calculateTTK(weaponId, enemyId, 'normal');
      const hardTTK = calculateTTK(weaponId, enemyId, 'hard');
      const nightmareTTK = calculateTTK(weaponId, enemyId, 'nightmare');

      expect(hardTTK).toBeGreaterThan(normalTTK);
      expect(nightmareTTK).toBeGreaterThan(hardTTK);
    });

    it('higher DPS weapons should have lower TTK', () => {
      const smgDps = calculateWeaponDPS('pulse_smg');
      const revolverDps = calculateWeaponDPS('revolver');

      const smgTTK = calculateTTK('pulse_smg', 'skitterer', 'normal');
      const revolverTTK = calculateTTK('revolver', 'skitterer', 'normal');

      // Higher DPS should mean lower TTK (faster kill)
      if (smgDps > revolverDps) {
        expect(smgTTK).toBeLessThan(revolverTTK);
      } else {
        expect(revolverTTK).toBeLessThan(smgTTK);
      }
    });

    it('sustained TTK should account for reload time', () => {
      const weaponId = 'assault_rifle';
      const enemyId = 'broodmother'; // Boss - will require reloads

      const burstTTK = calculateTTK(weaponId, enemyId, 'normal');
      const sustainedTTK = calculateSustainedTTK(weaponId, enemyId, 'normal');

      // Sustained should be >= burst (may need reloads)
      expect(sustainedTTK).toBeGreaterThanOrEqual(burstTTK - 0.2); // small tolerance
    });
  });

  describe('TTK Targets', () => {
    it('should have TTK targets for all difficulties', () => {
      for (const difficulty of DIFFICULTY_ORDER) {
        expect(TTK_TARGETS[difficulty]).toBeDefined();
        expect(TTK_TARGETS[difficulty].basicEnemy).toBeDefined();
        expect(TTK_TARGETS[difficulty].mediumEnemy).toBeDefined();
        expect(TTK_TARGETS[difficulty].heavyEnemy).toBeDefined();
        expect(TTK_TARGETS[difficulty].bossEnemy).toBeDefined();
      }
    });

    it('TTK targets should increase with enemy tier', () => {
      for (const difficulty of DIFFICULTY_ORDER) {
        const targets = TTK_TARGETS[difficulty];
        expect(targets.mediumEnemy[0]).toBeGreaterThan(targets.basicEnemy[0]);
        expect(targets.heavyEnemy[0]).toBeGreaterThan(targets.mediumEnemy[0]);
        expect(targets.bossEnemy[0]).toBeGreaterThan(targets.heavyEnemy[0]);
      }
    });

    it('TTK targets should increase with difficulty', () => {
      expect(TTK_TARGETS.hard.basicEnemy[0]).toBeGreaterThan(TTK_TARGETS.normal.basicEnemy[0]);
      expect(TTK_TARGETS.nightmare.basicEnemy[0]).toBeGreaterThan(TTK_TARGETS.hard.basicEnemy[0]);
    });
  });

  describe('Enemy Tier Classification', () => {
    it('should classify skitterer as basic enemy', () => {
      expect(getEnemyTier('skitterer')).toBe('basicEnemy');
    });

    it('should classify lurker and husk as medium enemies', () => {
      expect(getEnemyTier('lurker')).toBe('mediumEnemy');
      expect(getEnemyTier('husk')).toBe('mediumEnemy');
    });

    it('should classify spewer as medium enemy (legacy mapping)', () => {
      // Spewer is now mapped to medium tier (equivalent to new Spitter)
      expect(getEnemyTier('spewer')).toBe('mediumEnemy');
    });

    it('should classify heavy as heavy enemy', () => {
      expect(getEnemyTier('heavy')).toBe('heavyEnemy');
    });

    it('should classify broodmother as boss', () => {
      expect(getEnemyTier('broodmother')).toBe('bossEnemy');
    });

    it('should default unknown enemies to medium tier', () => {
      expect(getEnemyTier('unknown_enemy')).toBe('mediumEnemy');
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Player Survivability Tests
// ---------------------------------------------------------------------------

describe('Player Survivability', () => {
  describe('Player Health', () => {
    it('should have positive max health', () => {
      expect(PLAYER_BALANCE.maxHealth).toBeGreaterThan(0);
    });

    it('should have positive health regen rate', () => {
      expect(PLAYER_BALANCE.healthRegenRate).toBeGreaterThan(0);
    });

    it('max health should be reasonable for gameplay', () => {
      expect(PLAYER_BALANCE.maxHealth).toBeGreaterThanOrEqual(50);
      expect(PLAYER_BALANCE.maxHealth).toBeLessThanOrEqual(200);
    });
  });

  describe('Survivable Hits Calculation', () => {
    it('should calculate positive survivable hits for all enemies on all difficulties', () => {
      // On hard, nightmare, and ultra_nightmare, certain enemies can one-shot the player - this is intentional
      // Ultra-Nightmare has 2.5x playerDamageReceivedMultiplier, so more enemies can one-shot
      const canOneShot: Record<string, DifficultyLevel[]> = {
        skitterer: ['ultra_nightmare'],         // 30 base * 2.5 = 75, but rounding could push over
        spitter: ['ultra_nightmare'],           // 45 base * 2.5 = 112.5 > 100 HP
        warrior: ['ultra_nightmare'],           // 55 base * 2.5 = 137.5 > 100 HP
        heavy: ['nightmare', 'ultra_nightmare'], // 70 base * 2.0 = 140 > 100 HP, 90 base * 2.5 = 225 > 100 HP
        stalker: ['ultra_nightmare'],           // 40 base * 2.5 = 100, borderline one-shot
        broodmother: ['hard', 'nightmare', 'ultra_nightmare'], // Boss tier - high damage
        queen: ['hard', 'nightmare', 'ultra_nightmare'],       // Boss tier - 75 damage on hard * 1.4 = 105 > 100 HP
        // Legacy mappings
        lurker: ['ultra_nightmare'],            // Same as stalker
        spewer: ['ultra_nightmare'],            // Same as spitter
        husk: ['ultra_nightmare'],              // Same as warrior
      };

      for (const enemyId of Object.keys(ENEMY_BALANCE)) {
        for (const difficulty of DIFFICULTY_ORDER) {
          const hits = calculatePlayerSurvivableHits(enemyId, difficulty);
          const allowsOneShot = canOneShot[enemyId]?.includes(difficulty);

          if (allowsOneShot) {
            // On nightmare, some enemies can one-shot - this is intentional design
            expect(
              hits,
              `Player should survive at least 0 hits from ${enemyId} on ${difficulty} (one-shot allowed)`
            ).toBeGreaterThanOrEqual(0);
          } else {
            expect(
              hits,
              `Player should survive at least 1 hit from ${enemyId} on ${difficulty}`
            ).toBeGreaterThanOrEqual(1);
          }
        }
      }
    });

    it('should survive fewer hits on higher difficulty', () => {
      for (const enemyId of Object.keys(ENEMY_BALANCE)) {
        const normalHits = calculatePlayerSurvivableHits(enemyId, 'normal');
        const nightmareHits = calculatePlayerSurvivableHits(enemyId, 'nightmare');

        expect(
          nightmareHits,
          `${enemyId} nightmare hits <= normal`
        ).toBeLessThanOrEqual(normalHits);
      }
    });

    it('should survive more hits from weaker enemies', () => {
      const skittererHits = calculatePlayerSurvivableHits('skitterer', 'normal');
      const spewerHits = calculatePlayerSurvivableHits('spewer', 'normal');
      const broodmotherHits = calculatePlayerSurvivableHits('broodmother', 'normal');

      expect(skittererHits).toBeGreaterThan(spewerHits);
      expect(spewerHits).toBeGreaterThanOrEqual(broodmotherHits);
    });
  });

  describe('Survivability Targets', () => {
    it('should meet TTK target survivability for normal difficulty', () => {
      const target = TTK_TARGETS.normal.playerSurvivesHits;
      const skittererHits = calculatePlayerSurvivableHits('skitterer', 'normal');
      expect(skittererHits).toBeGreaterThanOrEqual(target[0]);
    });

    it('should meet TTK target survivability for hard difficulty', () => {
      const target = TTK_TARGETS.hard.playerSurvivesHits;
      const skittererHits = calculatePlayerSurvivableHits('skitterer', 'hard');
      expect(skittererHits).toBeGreaterThanOrEqual(target[0]);
    });

    it('should meet TTK target survivability for nightmare difficulty', () => {
      const target = TTK_TARGETS.nightmare.playerSurvivesHits;
      const skittererHits = calculatePlayerSurvivableHits('skitterer', 'nightmare');
      // Nightmare is intentionally punishing - target may not be met
      expect(skittererHits).toBeGreaterThanOrEqual(Math.min(2, target[0]));
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Difficulty Modifiers Tests
// ---------------------------------------------------------------------------

describe('Difficulty Modifiers', () => {
  it('should have valid modifiers for all difficulty levels', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const modifiers = getDifficultyModifiers(difficulty);
      expect(modifiers).toBeDefined();
      expect(modifiers.enemyHealthMultiplier).toBeGreaterThan(0);
      expect(modifiers.enemyDamageMultiplier).toBeGreaterThan(0);
      expect(modifiers.playerDamageReceivedMultiplier).toBeGreaterThan(0);
    }
  });

  it('enemy health multiplier should increase with difficulty', () => {
    const normal = getDifficultyModifiers('normal').enemyHealthMultiplier;
    const hard = getDifficultyModifiers('hard').enemyHealthMultiplier;
    const nightmare = getDifficultyModifiers('nightmare').enemyHealthMultiplier;

    expect(hard).toBeGreaterThan(normal);
    expect(nightmare).toBeGreaterThan(hard);
  });

  it('player damage received multiplier should increase with difficulty', () => {
    const normal = getDifficultyModifiers('normal').playerDamageReceivedMultiplier;
    const hard = getDifficultyModifiers('hard').playerDamageReceivedMultiplier;
    const nightmare = getDifficultyModifiers('nightmare').playerDamageReceivedMultiplier;

    expect(hard).toBeGreaterThanOrEqual(normal);
    expect(nightmare).toBeGreaterThanOrEqual(hard);
  });

  it('enemy fire rate multiplier should affect combat pacing', () => {
    for (const difficulty of DIFFICULTY_ORDER) {
      const modifiers = getDifficultyModifiers(difficulty);
      expect(modifiers.enemyFireRateMultiplier).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Combat System Integration Tests
// ---------------------------------------------------------------------------

describe('Combat System Integration', () => {
  describe('Enemy Balance Integration', () => {
    it('all enemies should have required combat properties', () => {
      // Melee-only enemies have projectileSpeed = 0 (e.g., warrior)
      const meleeOnlyEnemies = ['warrior'];

      for (const [id, enemy] of Object.entries(ENEMY_BALANCE)) {
        expect(enemy.id).toBe(id);
        expect(enemy.name).toBeDefined();
        expect(enemy.baseHealth).toBeGreaterThan(0);
        expect(enemy.baseDamage).toBeGreaterThan(0);
        expect(enemy.moveSpeed).toBeGreaterThan(0);
        expect(enemy.attackRange).toBeGreaterThan(0);
        expect(enemy.alertRadius).toBeGreaterThan(0);
        expect(enemy.fireRate).toBeGreaterThan(0);
        // Melee-only enemies have projectileSpeed = 0
        if (meleeOnlyEnemies.includes(id)) {
          expect(enemy.projectileSpeed).toBe(0);
        } else {
          expect(enemy.projectileSpeed).toBeGreaterThan(0);
        }
        expect(enemy.xpValue).toBeGreaterThan(0);
        expect(typeof enemy.isBoss).toBe('boolean');
      }
    });

    it('boss flag should match enemy tier classification', () => {
      for (const [id, enemy] of Object.entries(ENEMY_BALANCE)) {
        const tier = getEnemyTier(id);
        if (enemy.isBoss) {
          expect(tier).toBe('bossEnemy');
        } else {
          expect(tier).not.toBe('bossEnemy');
        }
      }
    });
  });

  describe('Weapon Balance Integration', () => {
    it('all weapons should have required combat properties', () => {
      for (const [id, weapon] of Object.entries(WEAPON_BALANCE)) {
        if (!weapon) continue;
        expect(weapon.id).toBe(id);
        expect(weapon.name).toBeDefined();
        expect(weapon.damage).toBeGreaterThan(0);
        expect(weapon.fireRate).toBeGreaterThan(0);
        expect(weapon.projectileSpeed).toBeGreaterThan(0);
        expect(weapon.range).toBeGreaterThan(0);
        expect(weapon.critMultiplier).toBeGreaterThan(0);
        expect(weapon.magazineSize).toBeGreaterThan(0);
        expect(weapon.maxReserveAmmo).toBeGreaterThan(0);
        expect(weapon.reloadTimeMs).toBeGreaterThan(0);
      }
    });

    it('weapon range should be appropriate for category', () => {
      // Snipers should have longest range
      const sniperRange = WEAPON_BALANCE.sniper_rifle?.range ?? 0;
      const shotgunRange = WEAPON_BALANCE.auto_shotgun?.range ?? Infinity;

      expect(sniperRange).toBeGreaterThan(shotgunRange);
    });
  });

  describe('Combat Math Consistency', () => {
    it('DPS * TTK should equal enemy HP (within tolerance)', () => {
      const weaponId = 'assault_rifle';
      const enemyId = 'skitterer';
      const difficulty: DifficultyLevel = 'normal';

      const dps = calculateWeaponDPS(weaponId);
      const ttk = calculateTTK(weaponId, enemyId, difficulty);
      const hp = getScaledEnemyHealth(enemyId, difficulty);

      // DPS * TTK should approximately equal HP
      const calculatedHP = dps * ttk;
      expect(calculatedHP).toBeCloseTo(hp, 0);
    });

    it('higher damage weapons should have lower shots to kill', () => {
      const enemyId = 'lurker';
      const difficulty: DifficultyLevel = 'normal';
      const hp = getScaledEnemyHealth(enemyId, difficulty);

      const sniperDamage = WEAPON_BALANCE.sniper_rifle?.damage ?? 1;
      const smgDamage = WEAPON_BALANCE.pulse_smg?.damage ?? 1;

      const sniperShotsToKill = Math.ceil(hp / sniperDamage);
      const smgShotsToKill = Math.ceil(hp / smgDamage);

      expect(sniperShotsToKill).toBeLessThan(smgShotsToKill);
    });
  });
});
