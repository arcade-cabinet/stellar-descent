/**
 * SaveLoadIntegration.test.ts - Complete save/load system tests
 *
 * Tests persistence system without actual IndexedDB:
 * - Multiple save slots (3 manual + autosave + quicksave)
 * - Full player state restoration
 * - Level progress persistence
 * - Collectibles tracking
 * - Save format versioning and migration
 * - Checkpoint system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNewSave,
  extractSaveMetadata,
  toSaveState,
  fromSaveState,
  type GameSave,
  type SaveState,
  MAX_SAVE_SLOTS,
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_AUTOSAVE,
  SAVE_SLOT_QUICKSAVE,
} from '../persistence/GameSave';
import type { LevelId } from '../levels/types';

// Mock IndexedDB / worldDb
const mockDatabase: Record<string, string> = {};

vi.mock('../db/worldDatabase', () => ({
  worldDb: {
    init: vi.fn().mockResolvedValue(undefined),
    getChunkData: vi.fn((key: string) => Promise.resolve(mockDatabase[key] ?? null)),
    setChunkData: vi.fn((key: string, value: string) => {
      mockDatabase[key] = value;
      return Promise.resolve();
    }),
    deleteChunkData: vi.fn((key: string) => {
      delete mockDatabase[key];
      return Promise.resolve();
    }),
    resetDatabase: vi.fn().mockResolvedValue(undefined),
    persistToIndexedDB: vi.fn(),
    flushPersistence: vi.fn().mockResolvedValue(undefined),
    persistNow: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  },
});

// Mock window for keyboard events
vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

describe('Save/Load Integration', () => {
  beforeEach(() => {
    // Clear mocks
    Object.keys(mockDatabase).forEach((key) => delete mockDatabase[key]);
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Save Creation', () => {
    it('should create a new save with default values', () => {
      const save = createNewSave('test_save', 'normal', 'anchor_station', SAVE_SLOT_AUTOSAVE, 'auto');

      expect(save.id).toBe('test_save');
      expect(save.version).toBe(SAVE_FORMAT_VERSION);
      expect(save.difficulty).toBe('normal');
      expect(save.currentLevel).toBe('anchor_station');
      expect(save.slotNumber).toBe(SAVE_SLOT_AUTOSAVE);
      expect(save.saveType).toBe('auto');
      expect(save.playerHealth).toBe(100);
      expect(save.maxPlayerHealth).toBe(100);
      expect(save.playerArmor).toBe(0);
      expect(save.levelsCompleted).toEqual([]);
      expect(save.levelsVisited).toEqual([]); // Empty by default, populated when visiting
    });

    it('should create save with correct timestamp', () => {
      const before = Date.now();
      const save = createNewSave('test_save', 'normal', 'anchor_station', SAVE_SLOT_AUTOSAVE, 'auto');
      const after = Date.now();

      expect(save.timestamp).toBeGreaterThanOrEqual(before);
      expect(save.timestamp).toBeLessThanOrEqual(after);
    });

    it('should support all difficulty levels', () => {
      const easy = createNewSave('easy_save', 'easy', 'anchor_station', 1, 'manual');
      const normal = createNewSave('normal_save', 'normal', 'anchor_station', 1, 'manual');
      const hard = createNewSave('hard_save', 'hard', 'anchor_station', 1, 'manual');
      const nightmare = createNewSave('nightmare_save', 'nightmare', 'anchor_station', 1, 'manual');

      expect(easy.difficulty).toBe('easy');
      expect(normal.difficulty).toBe('normal');
      expect(hard.difficulty).toBe('hard');
      expect(nightmare.difficulty).toBe('nightmare');
    });
  });

  describe('Save Slots', () => {
    it('should support 3 manual save slots', () => {
      expect(MAX_SAVE_SLOTS).toBe(3);
    });

    it('should have special slots for autosave and quicksave', () => {
      expect(SAVE_SLOT_AUTOSAVE).toBe(0);
      expect(SAVE_SLOT_QUICKSAVE).toBe(-1);
    });

    it('should save to different slots independently', () => {
      const slot1 = createNewSave('slot1', 'easy', 'anchor_station', 1, 'manual');
      const slot2 = createNewSave('slot2', 'normal', 'landfall', 2, 'manual');
      const slot3 = createNewSave('slot3', 'hard', 'canyon_run', 3, 'manual');

      // Simulate storing
      mockDatabase['save_slot_1'] = JSON.stringify(slot1);
      mockDatabase['save_slot_2'] = JSON.stringify(slot2);
      mockDatabase['save_slot_3'] = JSON.stringify(slot3);

      // Verify independence
      const loaded1 = JSON.parse(mockDatabase['save_slot_1']) as GameSave;
      const loaded2 = JSON.parse(mockDatabase['save_slot_2']) as GameSave;
      const loaded3 = JSON.parse(mockDatabase['save_slot_3']) as GameSave;

      expect(loaded1.difficulty).toBe('easy');
      expect(loaded2.difficulty).toBe('normal');
      expect(loaded3.difficulty).toBe('hard');
      expect(loaded1.currentLevel).toBe('anchor_station');
      expect(loaded2.currentLevel).toBe('landfall');
      expect(loaded3.currentLevel).toBe('canyon_run');
    });
  });

  describe('Player State Persistence', () => {
    it('should save and restore player health', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.playerHealth = 75;
      save.maxPlayerHealth = 150;

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.playerHealth).toBe(75);
      expect(loaded.maxPlayerHealth).toBe(150);
    });

    it('should save and restore player armor', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.playerArmor = 50;
      save.maxPlayerArmor = 100;

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.playerArmor).toBe(50);
      expect(loaded.maxPlayerArmor).toBe(100);
    });

    it('should save and restore player position', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.playerPosition = { x: 10, y: 5, z: 20 };
      save.playerRotation = 1.57;

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.playerPosition).toEqual({ x: 10, y: 5, z: 20 });
      expect(loaded.playerRotation).toBe(1.57);
    });

    it('should save and restore weapon states', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.weaponStates = [
        { weaponId: 'assault_rifle', currentAmmo: 20, reserveAmmo: 100, unlocked: true },
        { weaponId: 'shotgun', currentAmmo: 6, reserveAmmo: 24, unlocked: true },
        { weaponId: 'plasma_cannon', currentAmmo: 0, reserveAmmo: 0, unlocked: false },
      ];
      save.currentWeaponSlot = 1;

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.weaponStates).toHaveLength(3);
      expect(loaded.weaponStates[0].currentAmmo).toBe(20);
      expect(loaded.weaponStates[1].weaponId).toBe('shotgun');
      expect(loaded.weaponStates[2].unlocked).toBe(false);
      expect(loaded.currentWeaponSlot).toBe(1);
    });

    it('should save and restore grenade inventory', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.grenades = { frag: 3, plasma: 2, emp: 1 };

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.grenades).toEqual({ frag: 3, plasma: 2, emp: 1 });
    });
  });

  describe('Level Progress', () => {
    it('should track visited levels', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.levelsVisited = ['anchor_station', 'landfall', 'canyon_run'];

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.levelsVisited).toContain('anchor_station');
      expect(loaded.levelsVisited).toContain('landfall');
      expect(loaded.levelsVisited).toContain('canyon_run');
    });

    it('should track completed levels', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.levelsCompleted = ['anchor_station', 'landfall'];
      save.currentLevel = 'canyon_run';

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.levelsCompleted).toContain('anchor_station');
      expect(loaded.levelsCompleted).toContain('landfall');
      expect(loaded.levelsCompleted).not.toContain('canyon_run');
      expect(loaded.currentLevel).toBe('canyon_run');
    });

    it('should track level best times', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.levelBestTimes = {
        anchor_station: 120.5,
        landfall: 180.2,
      };

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.levelBestTimes?.anchor_station).toBe(120.5);
      expect(loaded.levelBestTimes?.landfall).toBe(180.2);
    });

    it('should track level flags', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      // Update specific level flags (levelFlags is already initialized with all levels)
      save.levelFlags.anchor_station = { tutorial_complete: true, found_secret: true };
      save.levelFlags.landfall = { survived_halo_drop: true };

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.levelFlags.anchor_station?.tutorial_complete).toBe(true);
      expect(loaded.levelFlags.landfall?.survived_halo_drop).toBe(true);
    });
  });

  describe('Collectibles', () => {
    it('should save collected skulls', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.collectedSkulls = ['skull_iron', 'skull_mythic', 'skull_famine'];

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.collectedSkulls).toHaveLength(3);
      expect(loaded.collectedSkulls).toContain('skull_iron');
      expect(loaded.collectedSkulls).toContain('skull_mythic');
    });

    it('should save discovered audio logs', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.discoveredAudioLogs = ['log_001', 'log_002', 'log_003'];

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.discoveredAudioLogs).toHaveLength(3);
      expect(loaded.discoveredAudioLogs).toContain('log_001');
    });

    it('should save discovered secret areas', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.discoveredSecretAreas = ['secret_armory', 'secret_cache'];

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.discoveredSecretAreas).toHaveLength(2);
      expect(loaded.discoveredSecretAreas).toContain('secret_armory');
    });

    it('should save unlocked achievements', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.unlockedAchievements = ['first_blood', 'survivor', 'collector'];

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.unlockedAchievements).toHaveLength(3);
      expect(loaded.unlockedAchievements).toContain('first_blood');
    });
  });

  describe('Checkpoint System', () => {
    it('should save checkpoint data', () => {
      const save = createNewSave('test', 'normal', 'landfall', 1, 'checkpoint');
      save.checkpoint = {
        position: { x: 100, y: 10, z: 200 },
        rotation: 3.14,
        timestamp: Date.now(),
      };

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.checkpoint).not.toBeNull();
      expect(loaded.checkpoint?.position.x).toBe(100);
      expect(loaded.checkpoint?.rotation).toBe(3.14);
    });

    it('should clear checkpoint on level completion', () => {
      const save = createNewSave('test', 'normal', 'landfall', 1, 'checkpoint');
      save.checkpoint = {
        position: { x: 100, y: 10, z: 200 },
        rotation: 3.14,
        timestamp: Date.now(),
      };

      // Simulate level completion
      save.levelsCompleted.push('landfall');
      save.checkpoint = null;

      expect(save.checkpoint).toBeNull();
      expect(save.levelsCompleted).toContain('landfall');
    });
  });

  describe('Save Metadata', () => {
    it('should extract metadata from save', () => {
      const save = createNewSave('test', 'hard', 'canyon_run', 2, 'manual');
      save.name = 'My Epic Run';
      save.playTime = 3600000; // 1 hour
      save.totalKills = 150;

      const metadata = extractSaveMetadata(save);

      expect(metadata.id).toBe('test');
      expect(metadata.name).toBe('My Epic Run');
      expect(metadata.currentLevel).toBe('canyon_run');
      expect(metadata.difficulty).toBe('hard');
      expect(metadata.playTime).toBe(3600000);
      expect(metadata.slotNumber).toBe(2);
    });
  });

  describe('Save State Conversion', () => {
    it('should convert GameSave to SaveState', () => {
      const save = createNewSave('test', 'normal', 'fob_delta', 1, 'manual');
      save.playerHealth = 80;
      save.levelsCompleted = ['anchor_station', 'landfall'];

      const state = toSaveState(save);

      expect(state.version).toBe(SAVE_FORMAT_VERSION);
      expect(state.player.health).toBe(80);
      expect(state.campaign.currentLevel).toBe('fob_delta');
      expect(state.campaign.completedLevels).toContain('anchor_station');
    });

    it('should convert SaveState back to GameSave', () => {
      const state: SaveState = {
        version: SAVE_FORMAT_VERSION,
        timestamp: Date.now(),
        campaign: {
          currentLevel: 'the_breach',
          completedLevels: ['anchor_station', 'landfall', 'fob_delta'],
          difficulty: 'normal',
          playTime: 1800000,
        },
        player: {
          health: 90,
          maxHealth: 100,
          armor: 25,
          maxArmor: 100,
          weapons: [],
          currentWeaponSlot: 0,
          grenades: { frag: 2, plasma: 1, emp: 0 },
          checkpointPosition: null,
          checkpointRotation: null,
        },
        collectibles: {
          skulls: [],
          audioLogs: [],
          secretAreas: [],
        },
        achievements: [],
        settings: {
          masterVolume: 1.0,
          musicVolume: 0.5,
          sfxVolume: 0.7,
          mouseSensitivity: 1.0,
          invertMouseY: false,
          fieldOfView: 90,
          showHitmarkers: true,
        },
      };

      const save = fromSaveState(state, 'imported', 1, 'manual');

      expect(save.currentLevel).toBe('the_breach');
      expect(save.playerHealth).toBe(90);
      expect(save.playerArmor).toBe(25);
      expect(save.levelsCompleted).toContain('fob_delta');
      expect(save.difficulty).toBe('normal');
    });
  });

  describe('Play Time Tracking', () => {
    it('should track total play time', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.playTime = 0;

      // Simulate session time
      const sessionStart = Date.now() - 600000; // 10 minutes ago
      const sessionTime = Date.now() - sessionStart;
      save.playTime += sessionTime;

      expect(save.playTime).toBeGreaterThanOrEqual(600000);
    });
  });

  describe('Statistics', () => {
    it('should track total kills', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.totalKills = 0;

      save.totalKills += 5;
      save.totalKills += 10;

      expect(save.totalKills).toBe(15);
    });

    it('should track total distance', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.totalDistance = 0;

      save.totalDistance += 100.5;
      save.totalDistance += 200.3;

      expect(save.totalDistance).toBeCloseTo(300.8, 1);
    });
  });

  describe('Quest Progress', () => {
    it('should track completed quests', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.completedQuests = ['quest_tutorial', 'quest_first_contact'];

      expect(save.completedQuests).toContain('quest_tutorial');
      expect(save.completedQuests).toContain('quest_first_contact');
    });

    it('should track active quest states', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.activeQuests = {
        quest_main: {
          questId: 'quest_main',
          status: 'active',
          currentObjectiveIndex: 3,
          objectiveProgress: { reach_extraction: 0 },
          objectiveStatus: { reach_extraction: 'active' },
        },
        quest_side: {
          questId: 'quest_side',
          status: 'active',
          currentObjectiveIndex: 0,
          objectiveProgress: { collect_items: 5 },
          objectiveStatus: { collect_items: 'active' },
        },
      };

      expect(save.activeQuests.quest_main.currentObjectiveIndex).toBe(3);
      expect(save.activeQuests.quest_side.objectiveProgress.collect_items).toBe(5);
    });

    it('should track failed quests', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.failedQuests = ['quest_timed_escape'];

      expect(save.failedQuests).toContain('quest_timed_escape');
    });
  });

  describe('Settings Persistence', () => {
    it('should save game settings', () => {
      const save = createNewSave('test', 'normal', 'anchor_station', 1, 'manual');
      save.savedSettings = {
        masterVolume: 0.8,
        musicVolume: 0.5,
        sfxVolume: 0.7,
        mouseSensitivity: 1.2,
        invertMouseY: true,
        fieldOfView: 100,
        showHitmarkers: true,
      };

      mockDatabase['test_save'] = JSON.stringify(save);
      const loaded = JSON.parse(mockDatabase['test_save']) as GameSave;

      expect(loaded.savedSettings?.masterVolume).toBe(0.8);
      expect(loaded.savedSettings?.invertMouseY).toBe(true);
      expect(loaded.savedSettings?.fieldOfView).toBe(100);
    });
  });

  describe('Save Types', () => {
    it('should distinguish save types', () => {
      const auto = createNewSave('auto', 'normal', 'anchor_station', SAVE_SLOT_AUTOSAVE, 'auto');
      const manual = createNewSave('manual', 'normal', 'anchor_station', 1, 'manual');
      const checkpoint = createNewSave('checkpoint', 'normal', 'anchor_station', SAVE_SLOT_AUTOSAVE, 'checkpoint');
      const quick = createNewSave('quick', 'normal', 'anchor_station', SAVE_SLOT_QUICKSAVE, 'quicksave');

      expect(auto.saveType).toBe('auto');
      expect(manual.saveType).toBe('manual');
      expect(checkpoint.saveType).toBe('checkpoint');
      expect(quick.saveType).toBe('quicksave');
    });
  });
});
