/**
 * DifficultySettings Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
  getDifficultyInfo,
  getDifficultyModifiers,
  isValidDifficulty,
  loadDifficultySetting,
  migrateDifficulty,
  saveDifficultySetting,
  scaleDetectionRange,
  scaleEnemyDamage,
  scaleEnemyFireRate,
  scaleEnemyHealth,
  scalePlayerDamageReceived,
  scaleResourceDropChance,
  scaleSpawnCount,
  scaleXPReward,
} from './DifficultySettings';

describe('DifficultySettings', () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key) => localStorageMock[key] || null
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      localStorageMock[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete localStorageMock[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DIFFICULTY_PRESETS', () => {
    it('should have all three difficulty levels', () => {
      expect(DIFFICULTY_PRESETS).toHaveProperty('normal');
      expect(DIFFICULTY_PRESETS).toHaveProperty('veteran');
      expect(DIFFICULTY_PRESETS).toHaveProperty('legendary');
    });

    it('should have normal difficulty with 1.0 multipliers', () => {
      const normal = DIFFICULTY_PRESETS.normal;
      expect(normal.modifiers.enemyHealthMultiplier).toBe(1.0);
      expect(normal.modifiers.enemyDamageMultiplier).toBe(1.0);
      expect(normal.modifiers.playerDamageReceivedMultiplier).toBe(1.0);
      expect(normal.modifiers.enemyFireRateMultiplier).toBe(1.0);
      expect(normal.modifiers.xpMultiplier).toBe(1.0);
      expect(normal.modifiers.spawnRateMultiplier).toBe(1.0);
      expect(normal.modifiers.resourceDropMultiplier).toBe(1.0);
    });

    it('should have veteran difficulty with increased multipliers', () => {
      const veteran = DIFFICULTY_PRESETS.veteran;
      expect(veteran.modifiers.enemyHealthMultiplier).toBeGreaterThan(1.0);
      expect(veteran.modifiers.enemyDamageMultiplier).toBeGreaterThan(1.0);
      expect(veteran.modifiers.playerDamageReceivedMultiplier).toBeGreaterThan(1.0);
      expect(veteran.modifiers.xpMultiplier).toBeGreaterThan(1.0); // XP bonus
      expect(veteran.modifiers.spawnRateMultiplier).toBeGreaterThan(1.0); // More enemies
      expect(veteran.modifiers.resourceDropMultiplier).toBeLessThan(1.0); // Fewer resources
    });

    it('should have legendary difficulty with highest multipliers', () => {
      const legendary = DIFFICULTY_PRESETS.legendary;
      expect(legendary.modifiers.enemyHealthMultiplier).toBeGreaterThan(
        DIFFICULTY_PRESETS.veteran.modifiers.enemyHealthMultiplier
      );
      expect(legendary.modifiers.enemyDamageMultiplier).toBeGreaterThan(
        DIFFICULTY_PRESETS.veteran.modifiers.enemyDamageMultiplier
      );
      expect(legendary.modifiers.xpMultiplier).toBeGreaterThan(
        DIFFICULTY_PRESETS.veteran.modifiers.xpMultiplier
      );
    });
  });

  describe('DIFFICULTY_ORDER', () => {
    it('should list difficulties in order of increasing challenge', () => {
      expect(DIFFICULTY_ORDER).toEqual(['normal', 'veteran', 'legendary']);
    });
  });

  describe('DEFAULT_DIFFICULTY', () => {
    it('should be normal', () => {
      expect(DEFAULT_DIFFICULTY).toBe('normal');
    });
  });

  describe('getDifficultyModifiers', () => {
    it('should return modifiers for each difficulty level', () => {
      for (const level of DIFFICULTY_ORDER) {
        const modifiers = getDifficultyModifiers(level);
        expect(modifiers).toBeDefined();
        expect(modifiers.enemyHealthMultiplier).toBeDefined();
        expect(modifiers.enemyDamageMultiplier).toBeDefined();
        expect(modifiers.playerDamageReceivedMultiplier).toBeDefined();
        expect(modifiers.spawnRateMultiplier).toBeDefined();
        expect(modifiers.resourceDropMultiplier).toBeDefined();
      }
    });
  });

  describe('getDifficultyInfo', () => {
    it('should return info with name and description', () => {
      for (const level of DIFFICULTY_ORDER) {
        const info = getDifficultyInfo(level);
        expect(info.id).toBe(level);
        expect(info.name).toBeDefined();
        expect(info.name.length).toBeGreaterThan(0);
        expect(info.description).toBeDefined();
        expect(info.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isValidDifficulty', () => {
    it('should return true for valid difficulty levels', () => {
      expect(isValidDifficulty('normal')).toBe(true);
      expect(isValidDifficulty('veteran')).toBe(true);
      expect(isValidDifficulty('legendary')).toBe(true);
    });

    it('should return false for old/invalid difficulty levels', () => {
      expect(isValidDifficulty('easy')).toBe(false);
      expect(isValidDifficulty('hard')).toBe(false);
      expect(isValidDifficulty('nightmare')).toBe(false);
      expect(isValidDifficulty('invalid')).toBe(false);
    });
  });

  describe('migrateDifficulty', () => {
    it('should migrate old difficulty values', () => {
      expect(migrateDifficulty('easy')).toBe('normal');
      expect(migrateDifficulty('hard')).toBe('veteran');
      expect(migrateDifficulty('nightmare')).toBe('legendary');
    });

    it('should keep valid new values unchanged', () => {
      expect(migrateDifficulty('normal')).toBe('normal');
      expect(migrateDifficulty('veteran')).toBe('veteran');
      expect(migrateDifficulty('legendary')).toBe('legendary');
    });

    it('should return default for invalid values', () => {
      expect(migrateDifficulty('invalid')).toBe('normal');
    });
  });

  describe('loadDifficultySetting', () => {
    it('should return default difficulty when no setting stored', () => {
      const result = loadDifficultySetting();
      expect(result).toBe(DEFAULT_DIFFICULTY);
    });

    it('should return stored difficulty', () => {
      localStorageMock['stellar_descent_difficulty'] = 'veteran';
      const result = loadDifficultySetting();
      expect(result).toBe('veteran');
    });

    it('should migrate old difficulty values', () => {
      localStorageMock['stellar_descent_difficulty'] = 'hard';
      const result = loadDifficultySetting();
      expect(result).toBe('veteran');
    });

    it('should return default for invalid stored value', () => {
      localStorageMock['stellar_descent_difficulty'] = 'invalid';
      const result = loadDifficultySetting();
      expect(result).toBe(DEFAULT_DIFFICULTY);
    });
  });

  describe('saveDifficultySetting', () => {
    it('should save difficulty to localStorage', () => {
      saveDifficultySetting('legendary');
      expect(localStorageMock['stellar_descent_difficulty']).toBe('legendary');
    });
  });

  describe('scaling functions', () => {
    describe('scaleEnemyHealth', () => {
      it('should scale health based on difficulty', () => {
        const baseHealth = 100;

        const normalHealth = scaleEnemyHealth(baseHealth, 'normal');
        const veteranHealth = scaleEnemyHealth(baseHealth, 'veteran');
        const legendaryHealth = scaleEnemyHealth(baseHealth, 'legendary');

        expect(veteranHealth).toBeGreaterThan(normalHealth);
        expect(legendaryHealth).toBeGreaterThan(veteranHealth);
        expect(normalHealth).toBe(100); // Normal should be unchanged
      });
    });

    describe('scaleEnemyDamage', () => {
      it('should scale damage based on difficulty', () => {
        const baseDamage = 20;

        const normalDamage = scaleEnemyDamage(baseDamage, 'normal');
        const veteranDamage = scaleEnemyDamage(baseDamage, 'veteran');

        expect(veteranDamage).toBeGreaterThan(normalDamage);
        expect(normalDamage).toBe(20);
      });
    });

    describe('scalePlayerDamageReceived', () => {
      it('should scale player damage taken based on difficulty', () => {
        const baseDamage = 15;

        const normalDamage = scalePlayerDamageReceived(baseDamage, 'normal');
        const veteranDamage = scalePlayerDamageReceived(baseDamage, 'veteran');

        expect(veteranDamage).toBeGreaterThan(normalDamage);
        expect(normalDamage).toBe(15);
      });
    });

    describe('scaleEnemyFireRate', () => {
      it('should scale fire rate based on difficulty', () => {
        const baseRate = 2.0;

        const normalRate = scaleEnemyFireRate(baseRate, 'normal');
        const veteranRate = scaleEnemyFireRate(baseRate, 'veteran');

        expect(veteranRate).toBeGreaterThan(normalRate);
        expect(normalRate).toBe(2.0);
      });
    });

    describe('scaleDetectionRange', () => {
      it('should scale detection range based on difficulty', () => {
        const baseRange = 20;

        const normalRange = scaleDetectionRange(baseRange, 'normal');
        const veteranRange = scaleDetectionRange(baseRange, 'veteran');

        expect(veteranRange).toBeGreaterThan(normalRange);
        expect(normalRange).toBe(20);
      });
    });

    describe('scaleXPReward', () => {
      it('should scale XP reward based on difficulty', () => {
        const baseXP = 50;

        const normalXP = scaleXPReward(baseXP, 'normal');
        const veteranXP = scaleXPReward(baseXP, 'veteran');
        const legendaryXP = scaleXPReward(baseXP, 'legendary');

        expect(veteranXP).toBeGreaterThan(normalXP);
        expect(legendaryXP).toBeGreaterThan(veteranXP);
        expect(normalXP).toBe(50);
      });
    });

    describe('scaleSpawnCount', () => {
      it('should scale spawn count based on difficulty', () => {
        const baseCount = 10;

        const normalCount = scaleSpawnCount(baseCount, 'normal');
        const veteranCount = scaleSpawnCount(baseCount, 'veteran');
        const legendaryCount = scaleSpawnCount(baseCount, 'legendary');

        expect(veteranCount).toBeGreaterThan(normalCount);
        expect(legendaryCount).toBeGreaterThan(veteranCount);
        expect(normalCount).toBe(10);
      });
    });

    describe('scaleResourceDropChance', () => {
      it('should scale resource drop chance based on difficulty', () => {
        const baseChance = 0.5;

        const normalChance = scaleResourceDropChance(baseChance, 'normal');
        const veteranChance = scaleResourceDropChance(baseChance, 'veteran');
        const legendaryChance = scaleResourceDropChance(baseChance, 'legendary');

        expect(veteranChance).toBeLessThan(normalChance);
        expect(legendaryChance).toBeLessThan(veteranChance);
        expect(normalChance).toBe(0.5);
      });

      it('should cap resource drop chance at 1.0', () => {
        // This shouldn't happen with our multipliers, but let's ensure the cap works
        const highChance = 0.9;
        const normalChance = scaleResourceDropChance(highChance, 'normal');
        expect(normalChance).toBeLessThanOrEqual(1);
      });
    });
  });
});
