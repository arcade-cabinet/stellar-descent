/**
 * SaveSystem - Manages game save/load operations
 *
 * Provides a centralized save system that:
 * - Saves and loads game progress to/from IndexedDB via worldDb
 * - Supports auto-save on level completion
 * - Supports manual save/load
 * - Manages the current active save slot
 */

import { getAchievementManager } from '../achievements';
import {
  type DifficultyLevel,
  loadDifficultySetting,
  migrateDifficulty,
  saveDifficultySetting,
} from '../core/DifficultySettings';
import { worldDb } from '../db/worldDatabase';
import type { LevelId } from '../levels/types';
import {
  createNewSave,
  extractSaveMetadata,
  type GameSave,
  type GameSaveMetadata,
  SAVE_FORMAT_VERSION,
} from './GameSave';

/**
 * Events emitted by the SaveSystem
 */
export type SaveSystemEvent =
  | { type: 'save_created'; save: GameSaveMetadata }
  | { type: 'save_loaded'; save: GameSave }
  | { type: 'save_deleted'; saveId: string }
  | { type: 'auto_saved'; save: GameSaveMetadata }
  | { type: 'error'; message: string };

type SaveSystemListener = (event: SaveSystemEvent) => void;

/**
 * Primary save slot ID (single-slot save system)
 */
const PRIMARY_SAVE_ID = 'primary';

class SaveSystem {
  private currentSave: GameSave | null = null;
  private sessionStartTime: number = Date.now();
  private listeners: Set<SaveSystemListener> = new Set();
  private autoSaveEnabled = true;
  private initialized = false;

  /**
   * Singleton initialization promise to prevent race conditions.
   * Multiple React components may call initialize() simultaneously on mount.
   */
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize the save system.
   * Safe to call multiple times concurrently - only the first call
   * performs initialization, subsequent calls wait for completion.
   *
   * Should be called on app startup before any save/load operations.
   */
  async initialize(): Promise<void> {
    // Fast path: already initialized
    if (this.initialized) return;

    // If initialization is already in progress, wait for it
    if (SaveSystem.initPromise) {
      return SaveSystem.initPromise;
    }

    // Start initialization and store the promise
    SaveSystem.initPromise = this.doInitialize();

    try {
      await SaveSystem.initPromise;
    } catch (error) {
      // Reset the promise so initialization can be retried
      SaveSystem.initPromise = null;
      throw error;
    }
  }

  /**
   * Perform actual initialization (internal method)
   */
  private async doInitialize(): Promise<void> {
    await worldDb.init();
    this.initialized = true;
    console.log('[SaveSystem] Initialized successfully');
  }

  /**
   * Add an event listener
   */
  addListener(listener: SaveSystemListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SaveSystemEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('SaveSystem listener error:', e);
      }
    }
  }

  /**
   * Check if a save exists
   */
  async hasSave(): Promise<boolean> {
    const saveData = await worldDb.getChunkData(`save_${PRIMARY_SAVE_ID}`);
    return saveData !== null;
  }

  /**
   * Get the current active save (in-memory)
   */
  getCurrentSave(): GameSave | null {
    return this.currentSave;
  }

  /**
   * Create a new game (clears any existing save)
   * @param difficulty - The difficulty level for the new game (defaults to current setting)
   */
  async newGame(difficulty?: DifficultyLevel): Promise<GameSave> {
    // Reset the world database
    await worldDb.resetDatabase();

    // Use provided difficulty or load from settings
    const gameDifficulty = difficulty ?? loadDifficultySetting();

    // Create a new save with the specified difficulty
    const save = createNewSave(PRIMARY_SAVE_ID, gameDifficulty);
    this.currentSave = save;
    this.sessionStartTime = Date.now();

    // Also update the global difficulty setting to match the save
    saveDifficultySetting(gameDifficulty);

    // Track campaign start for speedrunner achievement
    getAchievementManager().onCampaignStart();

    // Persist the new save
    await this.persistSave(save);

    this.emit({ type: 'save_created', save: extractSaveMetadata(save) });
    console.log(`[SaveSystem] New game created with difficulty: ${gameDifficulty}`);

    return save;
  }

  /**
   * Load the saved game
   */
  async loadGame(): Promise<GameSave | null> {
    const saveData = await worldDb.getChunkData(`save_${PRIMARY_SAVE_ID}`);
    if (!saveData) {
      console.log('[SaveSystem] No save found');
      return null;
    }

    const save = JSON.parse(saveData) as GameSave;

    // Version migration if needed
    if (save.version !== SAVE_FORMAT_VERSION) {
      console.log(`[SaveSystem] Migrating save from v${save.version} to v${SAVE_FORMAT_VERSION}`);
      this.migrateSave(save);
    }

    this.currentSave = save;
    this.sessionStartTime = Date.now();

    // Sync the global difficulty setting with the loaded save
    if (save.difficulty) {
      saveDifficultySetting(save.difficulty);
    }

    this.emit({ type: 'save_loaded', save });
    console.log(`[SaveSystem] Game loaded: ${save.name} (difficulty: ${save.difficulty})`);

    return save;
  }

  /**
   * Migrate save data from older versions
   */
  private migrateSave(save: GameSave): void {
    // v1 -> v2: Add difficulty field
    if (save.version < 2) {
      // Check if difficulty exists but with old values
      if ((save as any).difficulty) {
        save.difficulty = migrateDifficulty((save as any).difficulty);
      } else {
        // Default to normal for old saves
        save.difficulty = 'normal';
      }
      console.log(`[SaveSystem] Migrated save to v2, difficulty: ${save.difficulty}`);
    }

    // v2 -> v3: Add seenIntroBriefing field
    if (save.version < 3) {
      save.seenIntroBriefing = save.seenIntroBriefing ?? false;
      console.log('[SaveSystem] Migrated save to v3, added seenIntroBriefing');
    }

    // v3 -> v4: Add levelBestTimes field
    if (save.version < 4) {
      save.levelBestTimes = save.levelBestTimes ?? {};
      console.log('[SaveSystem] Migrated save to v4, added levelBestTimes');
    }

    // Update version
    save.version = SAVE_FORMAT_VERSION;
  }

  /**
   * Save the current game state
   */
  save(): void {
    if (!this.currentSave) {
      console.warn('[SaveSystem] No active save to save');
      return;
    }

    // Update play time
    const sessionTime = Date.now() - this.sessionStartTime;
    this.currentSave.playTime += sessionTime;
    this.sessionStartTime = Date.now();

    // Update timestamp
    this.currentSave.timestamp = Date.now();

    this.persistSave(this.currentSave);
    console.log('[SaveSystem] Game saved');
  }

  /**
   * Auto-save (called on level completion, etc.)
   */
  autoSave(): void {
    if (!this.autoSaveEnabled || !this.currentSave) {
      return;
    }

    this.save();
    this.emit({ type: 'auto_saved', save: extractSaveMetadata(this.currentSave) });
    console.log('[SaveSystem] Auto-saved');
  }

  /**
   * Update player health in current save
   */
  updateHealth(health: number, maxHealth?: number): void {
    if (!this.currentSave) return;
    this.currentSave.playerHealth = health;
    if (maxHealth !== undefined) {
      this.currentSave.maxPlayerHealth = maxHealth;
    }
  }

  /**
   * Update player position in current save
   */
  updatePosition(x: number, y: number, z: number, rotation?: number): void {
    if (!this.currentSave) return;
    this.currentSave.playerPosition = { x, y, z };
    if (rotation !== undefined) {
      this.currentSave.playerRotation = rotation;
    }
  }

  /**
   * Update current level
   */
  setCurrentLevel(levelId: LevelId): void {
    if (!this.currentSave) return;
    this.currentSave.currentLevel = levelId;

    // Add to visited if not already
    if (!this.currentSave.levelsVisited.includes(levelId)) {
      this.currentSave.levelsVisited.push(levelId);
    }
  }

  /**
   * Mark a level as completed and auto-save
   */
  completeLevel(levelId: LevelId): void {
    if (!this.currentSave) return;

    if (!this.currentSave.levelsCompleted.includes(levelId)) {
      this.currentSave.levelsCompleted.push(levelId);
    }

    // Auto-save on level completion
    this.autoSave();
  }

  /**
   * Update chapter
   */
  setChapter(chapter: number): void {
    if (!this.currentSave) return;
    this.currentSave.currentChapter = chapter;
  }

  /**
   * Add a kill to the stats
   */
  addKill(): void {
    if (!this.currentSave) return;
    this.currentSave.totalKills++;
  }

  /**
   * Add distance traveled
   */
  addDistance(distance: number): void {
    if (!this.currentSave) return;
    this.currentSave.totalDistance += distance;
  }

  /**
   * Update inventory
   */
  setInventoryItem(itemId: string, quantity: number): void {
    if (!this.currentSave) return;
    if (quantity <= 0) {
      delete this.currentSave.inventory[itemId];
    } else {
      this.currentSave.inventory[itemId] = quantity;
    }
  }

  /**
   * Update objective status
   */
  setObjective(objectiveId: string, completed: boolean): void {
    if (!this.currentSave) return;
    this.currentSave.objectives[objectiveId] = completed;
  }

  /**
   * Update tutorial progress
   */
  setTutorialProgress(step: number, completed?: boolean): void {
    if (!this.currentSave) return;
    this.currentSave.tutorialStep = step;
    if (completed !== undefined) {
      this.currentSave.tutorialCompleted = completed;
    }
  }

  /**
   * Mark the intro briefing as seen
   */
  setSeenIntroBriefing(): void {
    if (!this.currentSave) return;
    this.currentSave.seenIntroBriefing = true;
  }

  /**
   * Check if the intro briefing has been seen
   */
  hasSeenIntroBriefing(): boolean {
    return this.currentSave?.seenIntroBriefing ?? false;
  }

  /**
   * Complete the tutorial
   */
  completeTutorial(): void {
    if (!this.currentSave) return;
    this.currentSave.tutorialCompleted = true;
    this.autoSave();
  }

  /**
   * Update difficulty setting
   * Also syncs to localStorage for global access
   */
  setDifficulty(difficulty: DifficultyLevel): void {
    if (!this.currentSave) return;
    this.currentSave.difficulty = difficulty;
    saveDifficultySetting(difficulty);
    console.log(`[SaveSystem] Difficulty changed to: ${difficulty}`);
  }

  /**
   * Get current difficulty from save
   */
  getDifficulty(): DifficultyLevel {
    return this.currentSave?.difficulty ?? loadDifficultySetting();
  }

  /**
   * Set a level-specific flag
   */
  setLevelFlag(levelId: LevelId, flag: string, value: boolean): void {
    if (!this.currentSave) return;
    if (!this.currentSave.levelFlags[levelId]) {
      this.currentSave.levelFlags[levelId] = {};
    }
    this.currentSave.levelFlags[levelId][flag] = value;
  }

  /**
   * Get a level-specific flag
   */
  getLevelFlag(levelId: LevelId, flag: string): boolean {
    if (!this.currentSave) return false;
    return this.currentSave.levelFlags[levelId]?.[flag] ?? false;
  }

  /**
   * Record a level completion time and update best time if applicable
   * Returns true if this is a new best time
   */
  recordLevelTime(levelId: LevelId, timeSeconds: number): boolean {
    if (!this.currentSave) return false;

    if (!this.currentSave.levelBestTimes) {
      this.currentSave.levelBestTimes = {};
    }

    const currentBest = this.currentSave.levelBestTimes[levelId];
    if (currentBest === undefined || timeSeconds < currentBest) {
      this.currentSave.levelBestTimes[levelId] = timeSeconds;
      console.log(`[SaveSystem] New best time for ${levelId}: ${timeSeconds.toFixed(2)}s`);
      return true;
    }
    return false;
  }

  /**
   * Get the best time for a specific level
   */
  getLevelBestTime(levelId: LevelId): number | null {
    if (!this.currentSave) return null;
    return this.currentSave.levelBestTimes?.[levelId] ?? null;
  }

  /**
   * Get all level best times
   */
  getAllLevelBestTimes(): Partial<Record<LevelId, number>> {
    if (!this.currentSave) return {};
    return this.currentSave.levelBestTimes ?? {};
  }

  /**
   * Get total play time in milliseconds (including current session)
   */
  getTotalPlayTime(): number {
    if (!this.currentSave) return 0;
    const sessionTime = Date.now() - this.sessionStartTime;
    return this.currentSave.playTime + sessionTime;
  }

  /**
   * Delete the saved game
   */
  async deleteSave(): Promise<void> {
    try {
      await worldDb.deleteChunkData(`save_${PRIMARY_SAVE_ID}`);
      this.currentSave = null;
      this.emit({ type: 'save_deleted', saveId: PRIMARY_SAVE_ID });
      console.log('[SaveSystem] Save deleted');
    } catch (error) {
      console.error('[SaveSystem] Failed to delete save:', error);
      this.emit({ type: 'error', message: 'Failed to delete save' });
    }
  }

  /**
   * Enable/disable auto-save
   */
  setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled = enabled;
  }

  /**
   * Get save metadata for display
   */
  async getSaveMetadata(): Promise<GameSaveMetadata | null> {
    if (!this.currentSave) {
      // Try to load from storage
      const saveData = await worldDb.getChunkData(`save_${PRIMARY_SAVE_ID}`);
      if (saveData) {
        const save = JSON.parse(saveData) as GameSave;
        return extractSaveMetadata(save);
      }
      return null;
    }
    return extractSaveMetadata(this.currentSave);
  }

  /**
   * Export save as JSON string (for backup/sharing)
   */
  async exportSaveJSON(): Promise<string | null> {
    if (!this.currentSave) {
      const saveData = await worldDb.getChunkData(`save_${PRIMARY_SAVE_ID}`);
      return saveData;
    }
    return JSON.stringify(this.currentSave, null, 2);
  }

  /**
   * Import save from JSON string
   */
  async importSaveJSON(json: string): Promise<boolean> {
    try {
      const save = JSON.parse(json) as GameSave;

      // Validate basic structure
      if (!save.id || !save.currentLevel || save.version === undefined) {
        throw new Error('Invalid save format');
      }

      // Migrate if needed
      if (save.version !== SAVE_FORMAT_VERSION) {
        save.version = SAVE_FORMAT_VERSION;
      }

      // Force the primary ID
      save.id = PRIMARY_SAVE_ID;

      this.currentSave = save;
      this.sessionStartTime = Date.now();
      this.persistSave(save);

      this.emit({ type: 'save_loaded', save });
      console.log('[SaveSystem] Save imported');

      return true;
    } catch (error) {
      console.error('[SaveSystem] Failed to import save:', error);
      this.emit({ type: 'error', message: 'Failed to import save' });
      return false;
    }
  }

  private async persistSave(save: GameSave): Promise<void> {
    try {
      await worldDb.setChunkData(`save_${save.id}`, JSON.stringify(save));
      // Trigger persistence to IndexedDB for PWA offline support
      worldDb.persistToIndexedDB();
    } catch (error) {
      console.error('[SaveSystem] Failed to persist save:', error);
      this.emit({ type: 'error', message: 'Failed to save game' });
    }
  }

  /**
   * Ensure all pending saves are flushed to IndexedDB
   * Call before app unload
   */
  async flush(): Promise<void> {
    await worldDb.flushPersistence();
  }
}

// Singleton instance
export const saveSystem = new SaveSystem();
