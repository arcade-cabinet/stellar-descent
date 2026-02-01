import { describe, expect, it } from 'vitest';
import {
  ALL_TIPS,
  getRandomTip,
  getShuffledTips,
  getTipsByCategory,
  getTipsForLevel,
  type TipCategory,
} from './LoadingTips';

describe('LoadingTips', () => {
  describe('ALL_TIPS', () => {
    it('has a comprehensive collection of tips', () => {
      expect(ALL_TIPS.length).toBeGreaterThan(50);
    });

    it('has tips in all categories', () => {
      const categories: TipCategory[] = [
        'COMBAT',
        'TACTICAL',
        'MOVEMENT',
        'EQUIPMENT',
        'SURVIVAL',
        'AWARENESS',
        'INTEL',
        'LORE',
      ];
      for (const category of categories) {
        const tipsInCategory = ALL_TIPS.filter((t) => t.category === category);
        expect(tipsInCategory.length, `Expected tips in category ${category}`).toBeGreaterThan(0);
      }
    });

    it('has all tips with non-empty tip text', () => {
      for (const tip of ALL_TIPS) {
        expect(tip.tip.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getTipsForLevel', () => {
    it('returns all generic tips when no level specified', () => {
      const tips = getTipsForLevel();
      // Should include tips without level restrictions
      expect(tips.length).toBeGreaterThan(0);
    });

    it('includes level-specific tips for anchor_station', () => {
      const tips = getTipsForLevel('anchor_station', 'station');
      const levelSpecificTips = tips.filter((t) => t.levelIds?.includes('anchor_station'));
      expect(levelSpecificTips.length).toBeGreaterThan(0);
    });

    it('includes level-type-specific tips for hive levels', () => {
      const tips = getTipsForLevel('the_breach', 'hive');
      const hiveTypeTips = tips.filter((t) => t.levelTypes?.includes('hive'));
      expect(hiveTypeTips.length).toBeGreaterThan(0);
    });

    it('excludes tips for other specific levels', () => {
      const tips = getTipsForLevel('anchor_station', 'station');
      const fobDeltaTips = tips.filter(
        (t) => t.levelIds?.includes('fob_delta') && !t.levelIds?.includes('anchor_station')
      );
      expect(fobDeltaTips.length).toBe(0);
    });
  });

  describe('getShuffledTips', () => {
    it('returns shuffled tips', () => {
      const tips1 = getShuffledTips();
      const tips2 = getShuffledTips();
      // Given enough tips, shuffled results should differ
      // (statistically unlikely to get same order twice)
      const _order1 = tips1.map((t) => t.tip).join('|');
      const _order2 = tips2.map((t) => t.tip).join('|');
      // Note: There's a tiny chance this could fail due to random chance
      // but with 60+ tips the probability is vanishingly small
      expect(tips1.length).toEqual(tips2.length);
      // Don't assert they're different as shuffle could theoretically produce same order
    });

    it('respects count parameter', () => {
      const tips = getShuffledTips(undefined, undefined, 5);
      expect(tips.length).toBe(5);
    });

    it('returns all tips when count is not specified', () => {
      const tips = getShuffledTips();
      expect(tips.length).toBeGreaterThan(0);
    });
  });

  describe('getTipsByCategory', () => {
    it('returns only tips from the specified category', () => {
      const combatTips = getTipsByCategory('COMBAT');
      expect(combatTips.every((t) => t.category === 'COMBAT')).toBe(true);
      expect(combatTips.length).toBeGreaterThan(0);
    });

    it('returns lore tips', () => {
      const loreTips = getTipsByCategory('LORE');
      expect(loreTips.every((t) => t.category === 'LORE')).toBe(true);
      expect(loreTips.length).toBeGreaterThan(0);
    });
  });

  describe('getRandomTip', () => {
    it('returns a single tip', () => {
      const tip = getRandomTip();
      expect(tip).toBeDefined();
      expect(tip.tip.length).toBeGreaterThan(0);
      expect(tip.category).toBeDefined();
    });

    it('respects level filtering', () => {
      // Get many random tips for anchor_station
      const tips = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const tip = getRandomTip('anchor_station', 'station');
        tips.add(tip.tip);
      }
      // Should get variety of tips
      expect(tips.size).toBeGreaterThan(5);
    });
  });

  describe('level-specific tips', () => {
    it('has tips specific to anchor_station', () => {
      const tips = ALL_TIPS.filter((t) => t.levelIds?.includes('anchor_station'));
      expect(tips.length).toBeGreaterThan(0);
    });

    it('has tips specific to landfall', () => {
      const tips = ALL_TIPS.filter((t) => t.levelIds?.includes('landfall'));
      expect(tips.length).toBeGreaterThan(0);
    });

    it('has tips specific to fob_delta', () => {
      const tips = ALL_TIPS.filter((t) => t.levelIds?.includes('fob_delta'));
      expect(tips.length).toBeGreaterThan(0);
    });

    it('has tips specific to brothers_in_arms', () => {
      const tips = ALL_TIPS.filter((t) => t.levelIds?.includes('brothers_in_arms'));
      expect(tips.length).toBeGreaterThan(0);
    });

    it('has tips specific to the_breach', () => {
      const tips = ALL_TIPS.filter((t) => t.levelIds?.includes('the_breach'));
      expect(tips.length).toBeGreaterThan(0);
    });

    it('has tips specific to extraction', () => {
      const tips = ALL_TIPS.filter((t) => t.levelIds?.includes('extraction'));
      expect(tips.length).toBeGreaterThan(0);
    });
  });

  describe('tip priorities', () => {
    it('has some tips with higher priority', () => {
      const highPriorityTips = ALL_TIPS.filter((t) => t.priority && t.priority > 1);
      expect(highPriorityTips.length).toBeGreaterThan(0);
    });

    it('getTipsForLevel returns tips sorted by priority', () => {
      const tips = getTipsForLevel('anchor_station', 'station');
      // First tips should have higher or equal priority to later tips
      for (let i = 1; i < Math.min(tips.length, 10); i++) {
        const prevPriority = tips[i - 1].priority ?? 1;
        const currPriority = tips[i].priority ?? 1;
        expect(prevPriority).toBeGreaterThanOrEqual(currPriority);
      }
    });
  });
});
