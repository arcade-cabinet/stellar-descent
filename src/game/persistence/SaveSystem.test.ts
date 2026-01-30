/**
 * SaveSystem Tests
 *
 * Tests for the game save/load functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { worldDb } from '../db/worldDatabase';
import {
  createNewSave,
  extractSaveMetadata,
  formatPlayTime,
  type GameSave,
  generateSaveId,
  getLevelDisplayName,
  SAVE_FORMAT_VERSION,
} from './GameSave';
import { saveSystem } from './SaveSystem';

// Mock worldDb
vi.mock('../db/worldDatabase', () => ({
  worldDb: {
    init: vi.fn().mockResolvedValue(undefined),
    getChunkData: vi.fn(),
    setChunkData: vi.fn(),
    deleteChunkData: vi.fn(),
    resetDatabase: vi.fn().mockResolvedValue(undefined),
    persistToIndexedDB: vi.fn(),
    flushPersistence: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('GameSave', () => {
  describe('createNewSave', () => {
    it('creates a save with default values', () => {
      const save = createNewSave('test-id');

      expect(save.id).toBe('test-id');
      expect(save.currentLevel).toBe('anchor_station');
      expect(save.playerHealth).toBe(100);
      expect(save.maxPlayerHealth).toBe(100);
      expect(save.levelsCompleted).toEqual([]);
      expect(save.levelsVisited).toEqual([]);
      expect(save.totalKills).toBe(0);
      expect(save.tutorialCompleted).toBe(false);
      expect(save.version).toBe(SAVE_FORMAT_VERSION);
    });

    it('includes a timestamp', () => {
      const before = Date.now();
      const save = createNewSave('test-id');
      const after = Date.now();

      expect(save.timestamp).toBeGreaterThanOrEqual(before);
      expect(save.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('generateSaveId', () => {
    it('generates a UUID-like string', () => {
      const id = generateSaveId();

      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSaveId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('extractSaveMetadata', () => {
    it('extracts correct metadata from save', () => {
      const save = createNewSave('test-id');
      save.currentChapter = 3;
      save.playTime = 3600000; // 1 hour
      save.levelsCompleted = ['anchor_station', 'landfall'];

      const metadata = extractSaveMetadata(save);

      expect(metadata.id).toBe('test-id');
      expect(metadata.currentChapter).toBe(3);
      expect(metadata.playTime).toBe(3600000);
      expect(metadata.levelsCompleted).toBe(2);
    });
  });

  describe('formatPlayTime', () => {
    it('formats minutes only', () => {
      expect(formatPlayTime(0)).toBe('0m');
      expect(formatPlayTime(60000)).toBe('1m');
      expect(formatPlayTime(300000)).toBe('5m');
      expect(formatPlayTime(3540000)).toBe('59m');
    });

    it('formats hours and minutes', () => {
      expect(formatPlayTime(3600000)).toBe('1h 0m');
      expect(formatPlayTime(3660000)).toBe('1h 1m');
      expect(formatPlayTime(7200000)).toBe('2h 0m');
      expect(formatPlayTime(8100000)).toBe('2h 15m');
    });
  });

  describe('getLevelDisplayName', () => {
    it('returns display names for all levels', () => {
      expect(getLevelDisplayName('anchor_station')).toBe('Anchor Station');
      expect(getLevelDisplayName('landfall')).toBe('Landfall');
      expect(getLevelDisplayName('fob_delta')).toBe('FOB Delta');
      expect(getLevelDisplayName('brothers_in_arms')).toBe('Brothers in Arms');
      expect(getLevelDisplayName('the_breach')).toBe('The Breach');
      expect(getLevelDisplayName('extraction')).toBe('Extraction');
    });
  });
});

describe('SaveSystem', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Initialize the save system
    await saveSystem.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('calls worldDb.init', async () => {
      await saveSystem.initialize();
      expect(worldDb.init).toHaveBeenCalled();
    });
  });

  describe('hasSave', () => {
    it('returns false when no save exists', () => {
      vi.mocked(worldDb.getChunkData).mockReturnValue(null);

      expect(saveSystem.hasSave()).toBe(false);
    });

    it('returns true when save exists', () => {
      const save = createNewSave('primary');
      vi.mocked(worldDb.getChunkData).mockReturnValue(JSON.stringify(save));

      expect(saveSystem.hasSave()).toBe(true);
    });
  });

  describe('newGame', () => {
    it('creates a new save and persists it', async () => {
      const save = await saveSystem.newGame();

      expect(save).toBeDefined();
      expect(save.id).toBe('primary');
      expect(save.currentLevel).toBe('anchor_station');
      expect(worldDb.resetDatabase).toHaveBeenCalled();
      expect(worldDb.setChunkData).toHaveBeenCalledWith('save_primary', expect.any(String));
    });
  });

  describe('loadGame', () => {
    it('returns null when no save exists', async () => {
      vi.mocked(worldDb.getChunkData).mockReturnValue(null);

      const result = await saveSystem.loadGame();

      expect(result).toBeNull();
    });

    it('loads and returns saved game', async () => {
      const mockSave = createNewSave('primary');
      mockSave.currentLevel = 'landfall';
      mockSave.playerHealth = 75;
      vi.mocked(worldDb.getChunkData).mockReturnValue(JSON.stringify(mockSave));

      const result = await saveSystem.loadGame();

      expect(result).toBeDefined();
      expect(result?.currentLevel).toBe('landfall');
      expect(result?.playerHealth).toBe(75);
    });
  });

  describe('save state updates', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('updates health', () => {
      saveSystem.updateHealth(50, 100);
      const save = saveSystem.getCurrentSave();

      expect(save?.playerHealth).toBe(50);
      expect(save?.maxPlayerHealth).toBe(100);
    });

    it('updates position', () => {
      saveSystem.updatePosition(10, 5, 20, 1.5);
      const save = saveSystem.getCurrentSave();

      expect(save?.playerPosition).toEqual({ x: 10, y: 5, z: 20 });
      expect(save?.playerRotation).toBe(1.5);
    });

    it('sets current level and adds to visited', () => {
      saveSystem.setCurrentLevel('landfall');
      const save = saveSystem.getCurrentSave();

      expect(save?.currentLevel).toBe('landfall');
      expect(save?.levelsVisited).toContain('landfall');
    });

    it('completes level and adds to completed', () => {
      saveSystem.completeLevel('anchor_station');
      const save = saveSystem.getCurrentSave();

      expect(save?.levelsCompleted).toContain('anchor_station');
    });

    it('adds kills', () => {
      saveSystem.addKill();
      saveSystem.addKill();
      saveSystem.addKill();
      const save = saveSystem.getCurrentSave();

      expect(save?.totalKills).toBe(3);
    });

    it('updates inventory', () => {
      saveSystem.setInventoryItem('medkit', 3);
      saveSystem.setInventoryItem('ammo', 50);
      const save = saveSystem.getCurrentSave();

      expect(save?.inventory.medkit).toBe(3);
      expect(save?.inventory.ammo).toBe(50);
    });

    it('removes inventory items when quantity is 0', () => {
      saveSystem.setInventoryItem('medkit', 3);
      saveSystem.setInventoryItem('medkit', 0);
      const save = saveSystem.getCurrentSave();

      expect(save?.inventory.medkit).toBeUndefined();
    });

    it('updates objectives', () => {
      saveSystem.setObjective('find_survivors', true);
      const save = saveSystem.getCurrentSave();

      expect(save?.objectives.find_survivors).toBe(true);
    });

    it('updates tutorial progress', () => {
      saveSystem.setTutorialProgress(5);
      const save = saveSystem.getCurrentSave();

      expect(save?.tutorialStep).toBe(5);
    });

    it('completes tutorial', () => {
      saveSystem.completeTutorial();
      const save = saveSystem.getCurrentSave();

      expect(save?.tutorialCompleted).toBe(true);
    });

    it('sets level flags', () => {
      saveSystem.setLevelFlag('anchor_station', 'elevator_activated', true);
      const save = saveSystem.getCurrentSave();

      expect(save?.levelFlags.anchor_station.elevator_activated).toBe(true);
    });

    it('gets level flags', () => {
      saveSystem.setLevelFlag('landfall', 'first_enemy_killed', true);

      expect(saveSystem.getLevelFlag('landfall', 'first_enemy_killed')).toBe(true);
      expect(saveSystem.getLevelFlag('landfall', 'nonexistent')).toBe(false);
    });
  });

  describe('deleteSave', () => {
    it('deletes the save and clears current save', async () => {
      await saveSystem.newGame();
      saveSystem.deleteSave();

      expect(worldDb.deleteChunkData).toHaveBeenCalledWith('save_primary');
      expect(saveSystem.getCurrentSave()).toBeNull();
    });
  });

  describe('event listeners', () => {
    it('emits events to listeners', async () => {
      const listener = vi.fn();
      const unsubscribe = saveSystem.addListener(listener);

      await saveSystem.newGame();

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'save_created' }));

      unsubscribe();
    });

    it('removes listeners when unsubscribed', async () => {
      const listener = vi.fn();
      const unsubscribe = saveSystem.addListener(listener);

      unsubscribe();
      await saveSystem.newGame();

      // Only the call from before unsubscribe should be recorded
      // After clearing mocks and unsubscribing, new events should not trigger
      listener.mockClear();
      await saveSystem.newGame();

      // After re-adding, listener should be called again
      // But since we unsubscribed, it should have been called 0 times after clearing
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('export/import JSON', () => {
    it('exports save as JSON', async () => {
      await saveSystem.newGame();
      const json = saveSystem.exportSaveJSON();

      expect(json).toBeDefined();
      const parsed = JSON.parse(json!);
      expect(parsed.id).toBe('primary');
    });

    it('imports save from JSON', async () => {
      const save = createNewSave('test');
      save.currentLevel = 'fob_delta';
      save.playerHealth = 50;

      const result = await saveSystem.importSaveJSON(JSON.stringify(save));

      expect(result).toBe(true);
      const loaded = saveSystem.getCurrentSave();
      expect(loaded?.currentLevel).toBe('fob_delta');
      expect(loaded?.playerHealth).toBe(50);
      expect(loaded?.id).toBe('primary'); // ID should be forced to primary
    });

    it('rejects invalid JSON', async () => {
      const result = await saveSystem.importSaveJSON('not valid json');

      expect(result).toBe(false);
    });

    it('rejects save missing required fields', async () => {
      const result = await saveSystem.importSaveJSON('{"invalid": true}');

      expect(result).toBe(false);
    });
  });
});
