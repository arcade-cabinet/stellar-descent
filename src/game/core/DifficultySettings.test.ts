/**
 * DifficultySettings Tests
 *
 * Tests the difficulty system which now uses:
 * - DifficultyRegistry for static definitions
 * - useDifficultyStore (Zustand) for runtime state
 * - SQLite for persistence (mocked in tests)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
  getDifficultyInfo,
  getDifficultyManager,
  getDifficultyModifiers,
  DifficultyManager,
  isValidDifficulty,
  migrateDifficulty,
  scaleDetectionRange,
  scaleEnemyDamage,
  scaleEnemyFireRate,
  scaleEnemyHealth,
  scalePlayerDamageReceived,
  scaleResourceDropChance,
  scaleSpawnCount,
  scaleXPReward,
  useDifficultyStore,
} from './DifficultySettings';

describe('DifficultySettings', () => {
  beforeEach(() => {
    // Reset the Zustand store to default state before each test
    useDifficultyStore.setState({
      difficulty: 'normal',
      permadeathEnabled: false,
      initialized: true,
    });
    // Reset DifficultyManager singleton
    DifficultyManager.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    DifficultyManager.reset();
  });

  describe('DIFFICULTY_PRESETS', () => {
    it('should have all five difficulty levels', () => {
      expect(DIFFICULTY_PRESETS).toHaveProperty('easy');
      expect(DIFFICULTY_PRESETS).toHaveProperty('normal');
      expect(DIFFICULTY_PRESETS).toHaveProperty('hard');
      expect(DIFFICULTY_PRESETS).toHaveProperty('nightmare');
      expect(DIFFICULTY_PRESETS).toHaveProperty('ultra_nightmare');
    });

    it('should have easy difficulty with reduced multipliers', () => {
      const easy = DIFFICULTY_PRESETS.easy;
      expect(easy.modifiers.enemyHealthMultiplier).toBeLessThan(1.0);
      expect(easy.modifiers.enemyDamageMultiplier).toBeLessThan(1.0);
      expect(easy.modifiers.playerDamageReceivedMultiplier).toBeLessThan(1.0);
      expect(easy.modifiers.resourceDropMultiplier).toBeGreaterThan(1.0); // More resources
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

    it('should have hard difficulty with increased multipliers', () => {
      const hard = DIFFICULTY_PRESETS.hard;
      expect(hard.modifiers.enemyHealthMultiplier).toBeGreaterThan(1.0);
      expect(hard.modifiers.enemyDamageMultiplier).toBeGreaterThan(1.0);
      expect(hard.modifiers.playerDamageReceivedMultiplier).toBeGreaterThan(1.0);
      expect(hard.modifiers.xpMultiplier).toBeGreaterThan(1.0); // XP bonus
      expect(hard.modifiers.spawnRateMultiplier).toBeGreaterThan(1.0); // More enemies
      expect(hard.modifiers.resourceDropMultiplier).toBeLessThan(1.0); // Fewer resources
    });

    it('should have nightmare difficulty with higher multipliers than hard', () => {
      const nightmare = DIFFICULTY_PRESETS.nightmare;
      expect(nightmare.modifiers.enemyHealthMultiplier).toBeGreaterThan(
        DIFFICULTY_PRESETS.hard.modifiers.enemyHealthMultiplier
      );
      expect(nightmare.modifiers.enemyDamageMultiplier).toBeGreaterThan(
        DIFFICULTY_PRESETS.hard.modifiers.enemyDamageMultiplier
      );
      expect(nightmare.modifiers.xpMultiplier).toBeGreaterThan(
        DIFFICULTY_PRESETS.hard.modifiers.xpMultiplier
      );
    });

    it('should have ultra_nightmare with forced permadeath', () => {
      const ultraNightmare = DIFFICULTY_PRESETS.ultra_nightmare;
      expect(ultraNightmare.modifiers.forcesPermadeath).toBe(true);
      expect(ultraNightmare.modifiers.enemyHealthMultiplier).toBeGreaterThan(
        DIFFICULTY_PRESETS.nightmare.modifiers.enemyHealthMultiplier
      );
    });
  });

  describe('DIFFICULTY_ORDER', () => {
    it('should list difficulties in order of increasing challenge', () => {
      expect(DIFFICULTY_ORDER).toEqual(['easy', 'normal', 'hard', 'nightmare', 'ultra_nightmare']);
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
      expect(isValidDifficulty('easy')).toBe(true);
      expect(isValidDifficulty('normal')).toBe(true);
      expect(isValidDifficulty('hard')).toBe(true);
      expect(isValidDifficulty('nightmare')).toBe(true);
      expect(isValidDifficulty('ultra_nightmare')).toBe(true);
    });

    it('should return false for old/invalid difficulty levels', () => {
      expect(isValidDifficulty('veteran')).toBe(false);
      expect(isValidDifficulty('legendary')).toBe(false);
      expect(isValidDifficulty('invalid')).toBe(false);
    });
  });

  describe('migrateDifficulty', () => {
    it('should migrate old difficulty values', () => {
      expect(migrateDifficulty('veteran')).toBe('hard');
      expect(migrateDifficulty('legendary')).toBe('nightmare');
    });

    it('should keep valid new values unchanged', () => {
      expect(migrateDifficulty('easy')).toBe('easy');
      expect(migrateDifficulty('normal')).toBe('normal');
      expect(migrateDifficulty('hard')).toBe('hard');
      expect(migrateDifficulty('nightmare')).toBe('nightmare');
      expect(migrateDifficulty('ultra_nightmare')).toBe('ultra_nightmare');
    });

    it('should return default for invalid values', () => {
      expect(migrateDifficulty('invalid')).toBe('normal');
    });
  });

  describe('scaling functions', () => {
    describe('scaleEnemyHealth', () => {
      it('should scale health based on difficulty', () => {
        const baseHealth = 100;

        const easyHealth = scaleEnemyHealth(baseHealth, 'easy');
        const normalHealth = scaleEnemyHealth(baseHealth, 'normal');
        const hardHealth = scaleEnemyHealth(baseHealth, 'hard');
        const nightmareHealth = scaleEnemyHealth(baseHealth, 'nightmare');

        expect(easyHealth).toBeLessThan(normalHealth);
        expect(hardHealth).toBeGreaterThan(normalHealth);
        expect(nightmareHealth).toBeGreaterThan(hardHealth);
        expect(normalHealth).toBe(100); // Normal should be unchanged
      });
    });

    describe('scaleEnemyDamage', () => {
      it('should scale damage based on difficulty', () => {
        const baseDamage = 20;

        const normalDamage = scaleEnemyDamage(baseDamage, 'normal');
        const hardDamage = scaleEnemyDamage(baseDamage, 'hard');

        expect(hardDamage).toBeGreaterThan(normalDamage);
        expect(normalDamage).toBe(20);
      });
    });

    describe('scalePlayerDamageReceived', () => {
      it('should scale player damage taken based on difficulty', () => {
        const baseDamage = 15;

        const normalDamage = scalePlayerDamageReceived(baseDamage, 'normal');
        const hardDamage = scalePlayerDamageReceived(baseDamage, 'hard');

        expect(hardDamage).toBeGreaterThan(normalDamage);
        expect(normalDamage).toBe(15);
      });
    });

    describe('scaleEnemyFireRate', () => {
      it('should scale fire rate based on difficulty', () => {
        const baseRate = 2.0;

        const normalRate = scaleEnemyFireRate(baseRate, 'normal');
        const hardRate = scaleEnemyFireRate(baseRate, 'hard');

        expect(hardRate).toBeGreaterThan(normalRate);
        expect(normalRate).toBe(2.0);
      });
    });

    describe('scaleDetectionRange', () => {
      it('should scale detection range based on difficulty', () => {
        const baseRange = 20;

        const normalRange = scaleDetectionRange(baseRange, 'normal');
        const hardRange = scaleDetectionRange(baseRange, 'hard');

        expect(hardRange).toBeGreaterThan(normalRange);
        expect(normalRange).toBe(20);
      });
    });

    describe('scaleXPReward', () => {
      it('should scale XP reward based on difficulty', () => {
        const baseXP = 50;

        const normalXP = scaleXPReward(baseXP, 'normal');
        const hardXP = scaleXPReward(baseXP, 'hard');
        const nightmareXP = scaleXPReward(baseXP, 'nightmare');

        expect(hardXP).toBeGreaterThan(normalXP);
        expect(nightmareXP).toBeGreaterThan(hardXP);
        expect(normalXP).toBe(50);
      });
    });

    describe('scaleSpawnCount', () => {
      it('should scale spawn count based on difficulty', () => {
        const baseCount = 10;

        const normalCount = scaleSpawnCount(baseCount, 'normal');
        const hardCount = scaleSpawnCount(baseCount, 'hard');
        const nightmareCount = scaleSpawnCount(baseCount, 'nightmare');

        expect(hardCount).toBeGreaterThan(normalCount);
        expect(nightmareCount).toBeGreaterThan(hardCount);
        expect(normalCount).toBe(10);
      });
    });

    describe('scaleResourceDropChance', () => {
      it('should scale resource drop chance based on difficulty', () => {
        const baseChance = 0.5;

        const normalChance = scaleResourceDropChance(baseChance, 'normal');
        const hardChance = scaleResourceDropChance(baseChance, 'hard');
        const nightmareChance = scaleResourceDropChance(baseChance, 'nightmare');

        expect(hardChance).toBeLessThan(normalChance);
        expect(nightmareChance).toBeLessThan(hardChance);
        expect(normalChance).toBe(0.5);
      });

      it('should cap resource drop chance at 1.0', () => {
        const highChance = 0.9;
        const normalChance = scaleResourceDropChance(highChance, 'normal');
        expect(normalChance).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('useDifficultyStore', () => {
    it('should have default difficulty of normal', () => {
      const { difficulty } = useDifficultyStore.getState();
      expect(difficulty).toBe('normal');
    });

    it('should update difficulty via setDifficulty', () => {
      useDifficultyStore.getState().setDifficulty('hard');
      expect(useDifficultyStore.getState().difficulty).toBe('hard');
    });

    it('should track permadeath toggle', () => {
      expect(useDifficultyStore.getState().permadeathEnabled).toBe(false);
      useDifficultyStore.getState().setPermadeath(true);
      expect(useDifficultyStore.getState().permadeathEnabled).toBe(true);
    });

    it('should provide scaling methods', () => {
      useDifficultyStore.getState().setDifficulty('hard');
      const store = useDifficultyStore.getState();
      expect(store.scaleEnemyHealth(100)).toBeGreaterThan(100);
      expect(store.scaleEnemyDamage(20)).toBeGreaterThan(20);
    });
  });

  describe('DifficultyManager (legacy)', () => {
    it('should return singleton instance', () => {
      const manager1 = getDifficultyManager();
      const manager2 = getDifficultyManager();
      expect(manager1).toBe(manager2);
    });

    it('should get current difficulty from store', () => {
      useDifficultyStore.setState({ difficulty: 'normal' });
      const manager = getDifficultyManager();
      expect(manager.getDifficulty()).toBe('normal');
    });

    it('should set difficulty via store', () => {
      const manager = getDifficultyManager();
      manager.setDifficulty('hard');
      expect(useDifficultyStore.getState().difficulty).toBe('hard');
      expect(manager.getDifficulty()).toBe('hard');
    });

    it('should notify listeners on difficulty change', () => {
      useDifficultyStore.setState({ difficulty: 'normal' });
      const manager = getDifficultyManager();
      const listener = vi.fn();
      manager.addListener(listener);

      manager.setDifficulty('nightmare');

      expect(listener).toHaveBeenCalledWith('nightmare', 'normal');
    });

    it('should remove listeners correctly', () => {
      const manager = getDifficultyManager();
      const listener = vi.fn();
      const cleanup = manager.addListener(listener);

      cleanup();
      manager.setDifficulty('easy');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should provide convenience scaling methods', () => {
      const manager = getDifficultyManager();
      manager.setDifficulty('hard');

      expect(manager.scaleHealth(100)).toBeGreaterThan(100);
      expect(manager.scaleDamage(20)).toBeGreaterThan(20);
      expect(manager.scaleFireRate(2)).toBeGreaterThan(2);
    });
  });
});
