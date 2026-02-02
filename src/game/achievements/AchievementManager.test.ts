/**
 * AchievementManager Tests
 *
 * Tests the Zustand-based achievements store (replacement for old AchievementManager singleton).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the database to prevent sql.js script loading
vi.mock('../db/database', () => ({
  capacitorDb: {
    init: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue({ changes: 0, lastId: 0 }),
    query: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the SaveSystem for persistence
vi.mock('../persistence/SaveSystem', () => ({
  saveSystem: {
    init: vi.fn().mockResolvedValue(undefined),
    loadTable: vi.fn().mockResolvedValue(null),
    saveTable: vi.fn().mockResolvedValue(undefined),
    deleteTable: vi.fn().mockResolvedValue(undefined),
  },
}));

import { ACHIEVEMENTS, type AchievementId, getAchievementManager, initAchievements } from './index';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('AchievementManager', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset singleton
    const manager = getAchievementManager();
    manager.resetAll();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with all achievements locked', () => {
      initAchievements();
      const manager = getAchievementManager();

      for (const id of Object.keys(ACHIEVEMENTS) as AchievementId[]) {
        expect(manager.isUnlocked(id)).toBe(false);
      }
    });

    it('should report correct counts', () => {
      const manager = getAchievementManager();
      expect(manager.getTotalCount()).toBe(Object.keys(ACHIEVEMENTS).length);
      expect(manager.getUnlockedCount()).toBe(0);
    });
  });

  describe('unlocking achievements', () => {
    it('should unlock an achievement', () => {
      const manager = getAchievementManager();

      const result = manager.unlock('first_steps');
      expect(result).toBe(true);
      expect(manager.isUnlocked('first_steps')).toBe(true);
      expect(manager.getUnlockedCount()).toBe(1);
    });

    it('should not re-unlock an already unlocked achievement', () => {
      const manager = getAchievementManager();

      manager.unlock('first_steps');
      const result = manager.unlock('first_steps');

      expect(result).toBe(false);
      expect(manager.getUnlockedCount()).toBe(1);
    });

    it('should emit unlock event', () => {
      const manager = getAchievementManager();
      const callback = vi.fn();

      manager.onUnlock(callback);
      manager.unlock('first_steps');

      expect(callback).toHaveBeenCalledWith(ACHIEVEMENTS.first_steps);
    });

    it('should allow unsubscribing from unlock events', () => {
      const manager = getAchievementManager();
      const callback = vi.fn();

      const unsubscribe = manager.onUnlock(callback);
      unsubscribe();
      manager.unlock('first_steps');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('trigger methods', () => {
    it('should unlock first_steps on tutorial complete', () => {
      const manager = getAchievementManager();

      manager.onTutorialComplete();

      expect(manager.isUnlocked('first_steps')).toBe(true);
    });

    it('should unlock odst on HALO drop complete', () => {
      const manager = getAchievementManager();

      manager.onHaloDropComplete();

      expect(manager.isUnlocked('odst')).toBe(true);
    });

    it('should unlock queen_slayer on Queen defeated', () => {
      const manager = getAchievementManager();

      manager.onQueenDefeated();

      expect(manager.isUnlocked('queen_slayer')).toBe(true);
    });

    it('should unlock reunited when Marcus is found', () => {
      const manager = getAchievementManager();

      manager.onMarcusFound();

      expect(manager.isUnlocked('reunited')).toBe(true);
    });

    it('should unlock great_escape on game complete', () => {
      const manager = getAchievementManager();

      manager.onGameComplete();

      expect(manager.isUnlocked('great_escape')).toBe(true);
    });
  });

  describe('kill tracking', () => {
    it('should unlock first_blood on first kill', () => {
      const manager = getAchievementManager();

      expect(manager.isUnlocked('first_blood')).toBe(false);
      manager.onKill();
      expect(manager.isUnlocked('first_blood')).toBe(true);
    });

    it('should track kills and unlock exterminator at 100', () => {
      const manager = getAchievementManager();

      // Simulate 99 kills
      for (let i = 0; i < 99; i++) {
        manager.onKill();
      }
      expect(manager.isUnlocked('exterminator')).toBe(false);

      // 100th kill should unlock
      manager.onKill();
      expect(manager.isUnlocked('exterminator')).toBe(true);
    });

    it('should track kills and unlock mass_extinction at 500', () => {
      const manager = getAchievementManager();

      // Simulate 499 kills
      for (let i = 0; i < 499; i++) {
        manager.onKill();
      }
      expect(manager.isUnlocked('mass_extinction')).toBe(false);

      // 500th kill should unlock
      manager.onKill();
      expect(manager.isUnlocked('mass_extinction')).toBe(true);
    });

    it('should persist kill count', () => {
      const manager = getAchievementManager();

      for (let i = 0; i < 50; i++) {
        manager.onKill();
      }

      const progress = manager.getProgress();
      expect(progress.totalKills).toBe(50);
    });

    it('should track level kills separately', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      for (let i = 0; i < 10; i++) {
        manager.onKill();
      }

      const progress = manager.getProgress();
      expect(progress.levelKills).toBe(10);
      expect(progress.totalKills).toBe(10);

      // Starting new level resets level kills
      manager.onLevelStart('fob_delta');
      expect(manager.getProgress().levelKills).toBe(0);
      expect(manager.getProgress().totalKills).toBe(10); // Total persists
    });

    it('should unlock headhunter for 50 kills in one level', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      for (let i = 0; i < 50; i++) {
        manager.onKill();
      }
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('headhunter')).toBe(true);
    });
  });

  describe('level completion', () => {
    it('should unlock survivor for FOB Delta without dying', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('fob_delta');
      manager.onLevelComplete('fob_delta', false);

      expect(manager.isUnlocked('survivor')).toBe(true);
    });

    it('should not unlock survivor if player died', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('fob_delta');
      manager.onLevelComplete('fob_delta', true);

      expect(manager.isUnlocked('survivor')).toBe(false);
    });

    it('should unlock untouchable for completing a level without damage', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      // Complete without taking any damage
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('untouchable')).toBe(true);
    });

    it('should not unlock untouchable if damage was taken', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      manager.onDamageTaken('landfall', 10);
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('untouchable')).toBe(false);
    });
  });

  describe('speedrunner achievement', () => {
    it('should unlock speedrunner if game completed in under 30 minutes', () => {
      const manager = getAchievementManager();

      // Start campaign
      manager.onCampaignStart();

      // Mock 25 minutes passing
      const originalNow = Date.now;
      Date.now = () => originalNow() + 25 * 60 * 1000;

      manager.onGameComplete();

      expect(manager.isUnlocked('speedrunner')).toBe(true);

      Date.now = originalNow;
    });

    it('should not unlock speedrunner if game took over 60 minutes', () => {
      const manager = getAchievementManager();

      // Start campaign
      manager.onCampaignStart();

      // Mock 65 minutes passing (over the 60-minute threshold for 10 levels)
      const originalNow = Date.now;
      Date.now = () => originalNow() + 65 * 60 * 1000;

      manager.onGameComplete();

      expect(manager.isUnlocked('speedrunner')).toBe(false);

      Date.now = originalNow;
    });
  });

  describe('persistence', () => {
    it('should save unlocked achievements to SQLite', async () => {
      const manager = getAchievementManager();

      manager.unlock('first_steps');

      // Give async persistence a moment to run
      await new Promise((resolve) => setTimeout(resolve, 600));

      // The store saves via SaveSystem
      const { saveSystem } = await import('../persistence/SaveSystem');
      expect(saveSystem.saveTable).toHaveBeenCalled();
    });

    it('should get all achievements with states', () => {
      const manager = getAchievementManager();

      manager.unlock('first_steps');
      manager.unlock('odst');

      const all = manager.getAllAchievements();
      expect(all.length).toBe(Object.keys(ACHIEVEMENTS).length);

      const firstSteps = all.find((a) => a.achievement.id === 'first_steps');
      expect(firstSteps?.state.unlockedAt).not.toBeNull();

      const queenSlayer = all.find((a) => a.achievement.id === 'queen_slayer');
      expect(queenSlayer?.state.unlockedAt).toBeNull();
    });
  });

  describe('resetAll', () => {
    it('should reset all achievements to locked', () => {
      const manager = getAchievementManager();

      manager.unlock('first_steps');
      manager.unlock('odst');
      expect(manager.getUnlockedCount()).toBe(2);

      manager.resetAll();

      expect(manager.getUnlockedCount()).toBe(0);
      expect(manager.isUnlocked('first_steps')).toBe(false);
      expect(manager.isUnlocked('odst')).toBe(false);
    });
  });

  describe('shot tracking and accuracy', () => {
    it('should track shots fired and hits', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      manager.onShotFired();
      manager.onShotFired();
      manager.onShotHit();

      const progress = manager.getProgress();
      expect(progress.levelShotsFired).toBe(2);
      expect(progress.levelShotsHit).toBe(1);
      expect(progress.shotsFired).toBe(2);
      expect(progress.shotsHit).toBe(1);
    });

    it('should calculate level accuracy correctly', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      for (let i = 0; i < 10; i++) {
        manager.onShotFired();
      }
      for (let i = 0; i < 8; i++) {
        manager.onShotHit();
      }

      expect(manager.getLevelAccuracy()).toBe(80);
    });

    it('should unlock sharpshooter for 80%+ accuracy with min 20 shots', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      // Fire 20 shots, hit 16 (80%)
      for (let i = 0; i < 20; i++) {
        manager.onShotFired();
      }
      for (let i = 0; i < 16; i++) {
        manager.onShotHit();
      }
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('sharpshooter')).toBe(true);
    });

    it('should not unlock sharpshooter with less than 20 shots', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      // Fire 10 shots, all hits (100% but not enough shots)
      for (let i = 0; i < 10; i++) {
        manager.onShotFired();
        manager.onShotHit();
      }
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('sharpshooter')).toBe(false);
    });

    it('should not unlock sharpshooter with less than 80% accuracy', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      // Fire 20 shots, hit 15 (75%)
      for (let i = 0; i < 20; i++) {
        manager.onShotFired();
      }
      for (let i = 0; i < 15; i++) {
        manager.onShotHit();
      }
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('sharpshooter')).toBe(false);
    });
  });

  describe('speed demon achievements', () => {
    it('should unlock speed_demon_landfall when completed under par time', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');

      // Mock 4 minutes passing (under 5 minute par)
      const originalNow = Date.now;
      const startTime = originalNow();
      Date.now = () => startTime + 4 * 60 * 1000;

      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('speed_demon_landfall')).toBe(true);

      Date.now = originalNow;
    });

    it('should not unlock speed_demon_landfall when over par time', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');

      // Mock 6 minutes passing (over 5 minute par)
      const originalNow = Date.now;
      const startTime = originalNow();
      Date.now = () => startTime + 6 * 60 * 1000;

      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('speed_demon_landfall')).toBe(false);

      Date.now = originalNow;
    });
  });

  describe('perfect_drop achievement', () => {
    it('should unlock perfect_drop with 100% accuracy and no damage on Landfall', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      // Fire 10 shots, all hits
      for (let i = 0; i < 10; i++) {
        manager.onShotFired();
        manager.onShotHit();
      }
      // No damage taken
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('perfect_drop')).toBe(true);
    });

    it('should not unlock perfect_drop if damage was taken', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      // Fire 10 shots, all hits
      for (let i = 0; i < 10; i++) {
        manager.onShotFired();
        manager.onShotHit();
      }
      // Take damage
      manager.onDamageTaken('landfall', 10);
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('perfect_drop')).toBe(false);
    });

    it('should not unlock perfect_drop if accuracy is not 100%', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      // Fire 10 shots, 9 hits
      for (let i = 0; i < 10; i++) {
        manager.onShotFired();
      }
      for (let i = 0; i < 9; i++) {
        manager.onShotHit();
      }
      manager.onLevelComplete('landfall', false);

      expect(manager.isUnlocked('perfect_drop')).toBe(false);
    });
  });

  describe('iron_marine achievement', () => {
    it('should unlock iron_marine when completing level on insane difficulty', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      manager.onLevelComplete('landfall', false, 'insane');

      expect(manager.isUnlocked('iron_marine')).toBe(true);
    });

    it('should not unlock iron_marine on lower difficulties', () => {
      const manager = getAchievementManager();

      manager.onLevelStart('landfall');
      manager.onLevelComplete('landfall', false, 'normal');

      expect(manager.isUnlocked('iron_marine')).toBe(false);
    });
  });

  describe('brothers_keeper achievement', () => {
    it('should unlock brothers_keeper when completing Brothers in Arms without Marcus going down', () => {
      const manager = getAchievementManager();

      manager.resetMarcusTracking();
      manager.onBrothersInArmsComplete(false);

      expect(manager.isUnlocked('brothers_keeper')).toBe(true);
    });

    it('should not unlock brothers_keeper if Marcus went down', () => {
      const manager = getAchievementManager();

      manager.resetMarcusTracking();
      manager.onMarcusDown();
      manager.onBrothersInArmsComplete(true);

      expect(manager.isUnlocked('brothers_keeper')).toBe(false);
    });
  });

  describe('exploration achievements', () => {
    it('should unlock curious on first secret found', () => {
      const manager = getAchievementManager();

      expect(manager.isUnlocked('curious')).toBe(false);
      manager.onSecretFound();
      expect(manager.isUnlocked('curious')).toBe(true);
    });

    it('should unlock secret_hunter at 10 secrets', () => {
      const manager = getAchievementManager();

      for (let i = 0; i < 9; i++) {
        manager.onSecretFound();
      }
      expect(manager.isUnlocked('secret_hunter')).toBe(false);

      manager.onSecretFound();
      expect(manager.isUnlocked('secret_hunter')).toBe(true);
    });

    it('should unlock log_collector at 18 audio logs', () => {
      const manager = getAchievementManager();

      for (let i = 0; i < 17; i++) {
        manager.onAudioLogFound();
      }
      expect(manager.isUnlocked('log_collector')).toBe(false);

      manager.onAudioLogFound();
      expect(manager.isUnlocked('log_collector')).toBe(true);
    });

    it('should unlock explorer when all areas discovered', () => {
      const manager = getAchievementManager();

      manager.onAllAreasDiscovered();

      expect(manager.isUnlocked('explorer')).toBe(true);
    });

    it('should unlock cartographer when FOB Delta is fully explored', () => {
      const manager = getAchievementManager();

      manager.onFobDeltaFullyExplored();

      expect(manager.isUnlocked('cartographer')).toBe(true);
    });
  });

  describe('combat achievements (new)', () => {
    it('should unlock grenadier when killing 3 enemies with explosion', () => {
      const manager = getAchievementManager();

      manager.onExplosionKill(2);
      expect(manager.isUnlocked('grenadier')).toBe(false);

      manager.onExplosionKill(3);
      expect(manager.isUnlocked('grenadier')).toBe(true);
    });

    it('should unlock last_stand when killing enemy at low health', () => {
      const manager = getAchievementManager();

      manager.onKill(15); // Not low enough
      expect(manager.isUnlocked('last_stand')).toBe(false);

      manager.onKill(5); // Below 10%
      expect(manager.isUnlocked('last_stand')).toBe(true);
    });

    it('should track progress for secrets', () => {
      const manager = getAchievementManager();

      manager.onSecretFound();
      manager.onSecretFound();
      manager.onSecretFound();

      const progress = manager.getProgress();
      expect(progress.secretsFound).toBe(3);
    });

    it('should track progress for audio logs', () => {
      const manager = getAchievementManager();

      manager.onAudioLogFound();
      manager.onAudioLogFound();

      const progress = manager.getProgress();
      expect(progress.audioLogsFound).toBe(2);
    });
  });

  describe('campaign_veteran achievement', () => {
    it('should unlock campaign_veteran on game complete', () => {
      const manager = getAchievementManager();

      manager.onGameComplete();

      expect(manager.isUnlocked('campaign_veteran')).toBe(true);
      expect(manager.isUnlocked('great_escape')).toBe(true);
    });
  });
});
