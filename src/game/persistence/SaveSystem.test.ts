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
  toSaveState,
} from './GameSave';
import { saveSystem } from './SaveSystem';

// Mock worldDb - all methods are now async
vi.mock('../db/worldDatabase', () => ({
  worldDb: {
    init: vi.fn().mockResolvedValue(undefined),
    getChunkData: vi.fn().mockResolvedValue(null),
    setChunkData: vi.fn().mockResolvedValue(undefined),
    deleteChunkData: vi.fn().mockResolvedValue(undefined),
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
    it('returns false when no save exists', async () => {
      vi.mocked(worldDb.getChunkData).mockResolvedValue(null);

      expect(await saveSystem.hasSave()).toBe(false);
    });

    it('returns true when save exists', async () => {
      const save = createNewSave('primary');
      vi.mocked(worldDb.getChunkData).mockResolvedValue(JSON.stringify(save));

      expect(await saveSystem.hasSave()).toBe(true);
    });
  });

  describe('newGame', () => {
    it('creates a new save and persists it', async () => {
      const save = await saveSystem.newGame();

      expect(save).toBeDefined();
      // ID is now dynamically generated with timestamp
      expect(save.id).toMatch(/^save_\d+$/);
      expect(save.currentLevel).toBe('anchor_station');
      expect(worldDb.resetDatabase).toHaveBeenCalled();
      // Autosave is stored with 'save_autosave' key
      expect(worldDb.setChunkData).toHaveBeenCalledWith('save_autosave', expect.any(String));
    });
  });

  describe('loadGame', () => {
    it('returns null when no save exists', async () => {
      vi.mocked(worldDb.getChunkData).mockResolvedValue(null);

      const result = await saveSystem.loadGame();

      expect(result).toBeNull();
    });

    it('loads and returns saved game', async () => {
      const mockSave = createNewSave('primary');
      mockSave.currentLevel = 'landfall';
      mockSave.playerHealth = 75;
      vi.mocked(worldDb.getChunkData).mockResolvedValue(JSON.stringify(mockSave));

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
      // tutorialStep removed in v5 - now using quest chain system
      saveSystem.setTutorialProgress(5, true);
      const save = saveSystem.getCurrentSave();

      expect(save?.tutorialCompleted).toBe(true);
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
      await saveSystem.deleteSave();

      // Autosave slot uses 'save_autosave' key
      expect(worldDb.deleteChunkData).toHaveBeenCalledWith('save_autosave');
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
      const json = await saveSystem.exportSaveJSON();

      expect(json).toBeDefined();
      const parsed = JSON.parse(json!);
      // Export is SaveState format, not GameSave - no id field
      expect(parsed.campaign).toBeDefined();
      expect(parsed.campaign.currentLevel).toBe('anchor_station');
      expect(parsed.version).toBe(SAVE_FORMAT_VERSION);
    });

    it('imports save from JSON', async () => {
      const save = createNewSave('test');
      save.currentLevel = 'fob_delta';
      save.playerHealth = 50;

      // importSaveJSON expects SaveState format, not GameSave
      const saveState = toSaveState(save);
      const result = await saveSystem.importSaveJSON(JSON.stringify(saveState));

      expect(result).toBe(true);
      const loaded = saveSystem.getCurrentSave();
      expect(loaded?.currentLevel).toBe('fob_delta');
      // Note: SaveState doesn't preserve playerHealth directly - it's in player.health
      // The import generates a new ID
      expect(loaded?.id).toMatch(/^imported_\d+$/);
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

  describe('grenade inventory', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('updates grenade counts', () => {
      saveSystem.updateGrenades({ frag: 5, plasma: 3, emp: 2 });
      const grenades = saveSystem.getGrenades();

      expect(grenades?.frag).toBe(5);
      expect(grenades?.plasma).toBe(3);
      expect(grenades?.emp).toBe(2);
    });

    it('returns default grenades when not set', async () => {
      // Fresh save should have default grenades
      const grenades = saveSystem.getGrenades();

      expect(grenades).toBeDefined();
      expect(grenades?.frag).toBe(2);
      expect(grenades?.plasma).toBe(1);
      expect(grenades?.emp).toBe(1);
    });

    it('returns null when no save exists', async () => {
      await saveSystem.deleteSave();
      const grenades = saveSystem.getGrenades();

      expect(grenades).toBeNull();
    });

    it('updates grenade usage stats', () => {
      saveSystem.updateGrenadeStats({
        pickedUp: { frag: 10, plasma: 5, emp: 3 },
        used: { frag: 7, plasma: 4, emp: 2 },
      });
      const stats = saveSystem.getGrenadeStats();

      expect(stats?.pickedUp.frag).toBe(10);
      expect(stats?.used.frag).toBe(7);
    });

    it('returns default grenade stats when not set', () => {
      const stats = saveSystem.getGrenadeStats();

      expect(stats?.pickedUp.frag).toBe(0);
      expect(stats?.used.plasma).toBe(0);
    });
  });

  describe('weapon states', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('updates weapon states', () => {
      saveSystem.updateWeaponStates([
        { weaponId: 'rifle', currentAmmo: 25, reserveAmmo: 60, unlocked: true },
        { weaponId: 'shotgun', currentAmmo: 6, reserveAmmo: 12, unlocked: true },
      ]);
      const save = saveSystem.getCurrentSave();

      expect(save?.weaponStates).toHaveLength(2);
      expect(save?.weaponStates[0].currentAmmo).toBe(25);
      expect(save?.weaponStates[1].unlocked).toBe(true);
    });

    it('updates current weapon slot', () => {
      saveSystem.updateCurrentWeapon(2);
      const save = saveSystem.getCurrentSave();

      expect(save?.currentWeaponSlot).toBe(2);
    });
  });

  describe('armor updates', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('updates armor and max armor', () => {
      saveSystem.updateArmor(75, 150);
      const save = saveSystem.getCurrentSave();

      expect(save?.playerArmor).toBe(75);
      expect(save?.maxPlayerArmor).toBe(150);
    });

    it('updates armor only', () => {
      saveSystem.updateArmor(50);
      const save = saveSystem.getCurrentSave();

      expect(save?.playerArmor).toBe(50);
    });
  });

  describe('collectibles', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('adds collected skulls without duplicates', () => {
      saveSystem.addCollectedSkull('skull_1');
      saveSystem.addCollectedSkull('skull_2');
      saveSystem.addCollectedSkull('skull_1'); // Duplicate
      const save = saveSystem.getCurrentSave();

      expect(save?.collectedSkulls).toHaveLength(2);
      expect(save?.collectedSkulls).toContain('skull_1');
      expect(save?.collectedSkulls).toContain('skull_2');
    });

    it('adds discovered audio logs without duplicates', () => {
      saveSystem.addDiscoveredAudioLog('log_a');
      saveSystem.addDiscoveredAudioLog('log_b');
      saveSystem.addDiscoveredAudioLog('log_a'); // Duplicate
      const save = saveSystem.getCurrentSave();

      expect(save?.discoveredAudioLogs).toHaveLength(2);
    });

    it('adds discovered secret areas without duplicates', () => {
      saveSystem.addDiscoveredSecretArea('secret_1');
      saveSystem.addDiscoveredSecretArea('secret_2');
      saveSystem.addDiscoveredSecretArea('secret_1'); // Duplicate
      const save = saveSystem.getCurrentSave();

      expect(save?.discoveredSecretAreas).toHaveLength(2);
    });

    it('adds unlocked achievements without duplicates', () => {
      saveSystem.addUnlockedAchievement('ach_first_blood');
      saveSystem.addUnlockedAchievement('ach_survivor');
      saveSystem.addUnlockedAchievement('ach_first_blood'); // Duplicate
      const save = saveSystem.getCurrentSave();

      expect(save?.unlockedAchievements).toHaveLength(2);
    });
  });

  describe('quest system', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('completes quests without duplicates', () => {
      saveSystem.completeQuest('quest_tutorial');
      saveSystem.completeQuest('quest_rescue');
      saveSystem.completeQuest('quest_tutorial'); // Duplicate
      const completed = saveSystem.getCompletedQuests();

      expect(completed).toHaveLength(2);
      expect(saveSystem.isQuestCompleted('quest_tutorial')).toBe(true);
    });

    it('sets and gets active quest state', () => {
      saveSystem.setActiveQuestState('quest_escort', { stage: 2, npcsAlive: 3 });
      const active = saveSystem.getActiveQuests();

      expect(active['quest_escort']).toEqual({ stage: 2, npcsAlive: 3 });
    });

    it('removes active quest on completion', () => {
      saveSystem.setActiveQuestState('quest_escort', { stage: 1 });
      saveSystem.completeQuest('quest_escort');
      const active = saveSystem.getActiveQuests();

      expect(active['quest_escort']).toBeUndefined();
    });

    it('removes active quest explicitly', () => {
      saveSystem.setActiveQuestState('quest_patrol', { checkpoints: 0 });
      saveSystem.removeActiveQuest('quest_patrol');
      const active = saveSystem.getActiveQuests();

      expect(active['quest_patrol']).toBeUndefined();
    });

    it('fails quests and removes from active', () => {
      saveSystem.setActiveQuestState('quest_timed', { timeLeft: 30 });
      saveSystem.failQuest('quest_timed');
      const failed = saveSystem.getFailedQuests();
      const active = saveSystem.getActiveQuests();

      expect(failed).toContain('quest_timed');
      expect(active['quest_timed']).toBeUndefined();
    });

    it('fails quests without duplicates', () => {
      saveSystem.failQuest('quest_failed');
      saveSystem.failQuest('quest_failed');
      const failed = saveSystem.getFailedQuests();

      expect(failed.filter((q) => q === 'quest_failed')).toHaveLength(1);
    });
  });

  describe('level best times', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('records level time and returns true for new record', () => {
      const isNew = saveSystem.recordLevelTime('anchor_station', 120.5);

      expect(isNew).toBe(true);
      expect(saveSystem.getLevelBestTime('anchor_station')).toBe(120.5);
    });

    it('updates best time when faster', () => {
      saveSystem.recordLevelTime('landfall', 300);
      const isNew = saveSystem.recordLevelTime('landfall', 250);

      expect(isNew).toBe(true);
      expect(saveSystem.getLevelBestTime('landfall')).toBe(250);
    });

    it('does not update best time when slower', () => {
      saveSystem.recordLevelTime('fob_delta', 200);
      const isNew = saveSystem.recordLevelTime('fob_delta', 220);

      expect(isNew).toBe(false);
      expect(saveSystem.getLevelBestTime('fob_delta')).toBe(200);
    });

    it('returns null for level without time', () => {
      expect(saveSystem.getLevelBestTime('the_breach')).toBeNull();
    });

    it('gets all level best times', () => {
      saveSystem.recordLevelTime('anchor_station', 100);
      saveSystem.recordLevelTime('landfall', 150);
      const times = saveSystem.getAllLevelBestTimes();

      expect(times['anchor_station']).toBe(100);
      expect(times['landfall']).toBe(150);
    });
  });

  describe('difficulty settings', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('sets and gets difficulty', () => {
      saveSystem.setDifficulty('nightmare');
      const diff = saveSystem.getDifficulty();

      expect(diff).toBe('nightmare');
    });

    it('gets default difficulty when not set', async () => {
      // newGame uses default difficulty
      const diff = saveSystem.getDifficulty();
      expect(['easy', 'normal', 'hard', 'nightmare']).toContain(diff);
    });
  });

  describe('saved settings', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('updates saved settings', () => {
      saveSystem.updateSavedSettings({
        masterVolume: 0.8,
        musicVolume: 0.3,
        invertMouseY: true,
      });
      const save = saveSystem.getCurrentSave();

      expect(save?.savedSettings?.masterVolume).toBe(0.8);
      expect(save?.savedSettings?.musicVolume).toBe(0.3);
      expect(save?.savedSettings?.invertMouseY).toBe(true);
    });

    it('creates settings object if not present', () => {
      const save = saveSystem.getCurrentSave();
      if (save) save.savedSettings = undefined as any;

      saveSystem.updateSavedSettings({ fieldOfView: 110 });
      const updatedSave = saveSystem.getCurrentSave();

      expect(updatedSave?.savedSettings).toBeDefined();
      expect(updatedSave?.savedSettings?.fieldOfView).toBe(110);
    });
  });

  describe('chapter and distance tracking', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('sets chapter', () => {
      saveSystem.setChapter(5);
      const save = saveSystem.getCurrentSave();

      expect(save?.currentChapter).toBe(5);
    });

    it('adds distance', () => {
      saveSystem.addDistance(100);
      saveSystem.addDistance(50);
      const save = saveSystem.getCurrentSave();

      expect(save?.totalDistance).toBe(150);
    });
  });

  describe('intro briefing', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('has not seen intro by default', () => {
      expect(saveSystem.hasSeenIntroBriefing()).toBe(false);
    });

    it('marks intro as seen', () => {
      saveSystem.setSeenIntroBriefing();
      expect(saveSystem.hasSeenIntroBriefing()).toBe(true);
    });
  });

  describe('checkpoints', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('saves checkpoint with position and rotation', async () => {
      await saveSystem.saveCheckpoint({ x: 10, y: 5, z: 20 }, 1.57);
      const save = saveSystem.getCurrentSave();

      expect(save?.checkpoint).toBeDefined();
      expect(save?.checkpoint?.position).toEqual({ x: 10, y: 5, z: 20 });
      expect(save?.checkpoint?.rotation).toBe(1.57);
      expect(save?.checkpoint?.timestamp).toBeGreaterThan(0);
    });

    it('updates player position on checkpoint', async () => {
      await saveSystem.saveCheckpoint({ x: 100, y: 10, z: 200 }, 3.14);
      const save = saveSystem.getCurrentSave();

      expect(save?.playerPosition).toEqual({ x: 100, y: 10, z: 200 });
      expect(save?.playerRotation).toBe(3.14);
    });

    it('clears checkpoint on level completion', () => {
      // Set a checkpoint first
      saveSystem.saveCheckpoint({ x: 50, y: 5, z: 50 }, 0);

      saveSystem.completeLevel('anchor_station');
      const save = saveSystem.getCurrentSave();

      expect(save?.checkpoint).toBeNull();
    });
  });

  describe('auto-save control', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('disables auto-save', () => {
      saveSystem.setAutoSaveEnabled(false);
      saveSystem.completeLevel('anchor_station');

      // Auto-save is disabled, so save should only be called from completeLevel's internal call
      // The test verifies no error is thrown
    });

    it('enables auto-save', () => {
      saveSystem.setAutoSaveEnabled(true);
      saveSystem.completeLevel('landfall');

      // Auto-save is enabled - completeLevel triggers autoSave internally
    });
  });

  describe('play time tracking', () => {
    beforeEach(async () => {
      await saveSystem.newGame();
    });

    it('tracks play time including session', async () => {
      // Wait a small amount of time
      await new Promise((resolve) => setTimeout(resolve, 50));
      const playTime = saveSystem.getTotalPlayTime();

      expect(playTime).toBeGreaterThan(0);
    });

    it('returns 0 when no save', async () => {
      await saveSystem.deleteSave();
      expect(saveSystem.getTotalPlayTime()).toBe(0);
    });
  });

  describe('error handling for no save', () => {
    beforeEach(async () => {
      await saveSystem.deleteSave();
    });

    it('handles updateHealth with no save', () => {
      expect(() => saveSystem.updateHealth(50)).not.toThrow();
    });

    it('handles updateArmor with no save', () => {
      expect(() => saveSystem.updateArmor(50)).not.toThrow();
    });

    it('handles updatePosition with no save', () => {
      expect(() => saveSystem.updatePosition(0, 0, 0)).not.toThrow();
    });

    it('handles updateWeaponStates with no save', () => {
      expect(() => saveSystem.updateWeaponStates([])).not.toThrow();
    });

    it('handles updateGrenades with no save', () => {
      expect(() => saveSystem.updateGrenades({ frag: 0, plasma: 0, emp: 0 })).not.toThrow();
    });

    it('handles setCurrentLevel with no save', () => {
      expect(() => saveSystem.setCurrentLevel('landfall')).not.toThrow();
    });

    it('handles completeLevel with no save', () => {
      expect(() => saveSystem.completeLevel('anchor_station')).not.toThrow();
    });

    it('handles addKill with no save', () => {
      expect(() => saveSystem.addKill()).not.toThrow();
    });

    it('handles collectibles with no save', () => {
      expect(() => saveSystem.addCollectedSkull('skull_1')).not.toThrow();
      expect(() => saveSystem.addDiscoveredAudioLog('log_1')).not.toThrow();
      expect(() => saveSystem.addDiscoveredSecretArea('secret_1')).not.toThrow();
      expect(() => saveSystem.addUnlockedAchievement('ach_1')).not.toThrow();
    });

    it('handles quests with no save', () => {
      expect(() => saveSystem.completeQuest('quest_1')).not.toThrow();
      expect(() => saveSystem.failQuest('quest_1')).not.toThrow();
      expect(() => saveSystem.setActiveQuestState('quest_1', {})).not.toThrow();
      expect(saveSystem.isQuestCompleted('quest_1')).toBe(false);
    });

    it('handles settings with no save', () => {
      expect(() => saveSystem.setDifficulty('hard')).not.toThrow();
      expect(() => saveSystem.updateSavedSettings({ masterVolume: 0.5 })).not.toThrow();
    });
  });
});
