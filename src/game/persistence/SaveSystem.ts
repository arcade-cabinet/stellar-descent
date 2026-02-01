/**
 * SaveSystem - Manages game save/load operations
 *
 * Provides a centralized save system that:
 * - Saves and loads game progress to/from IndexedDB via worldDb
 * - Supports multiple save slots (3 manual + autosave + quicksave)
 * - Supports auto-save on level completion and checkpoints
 * - Supports manual save/load from pause menu
 * - Supports quick save (F5) and quick load (F9)
 * - Full player state restoration (health, armor, weapons, grenades)
 * - Collectibles persistence (skulls, audio logs, secrets)
 * - Cloud save preparation (JSON export/import)
 */

import { getAchievementManager } from '../achievements';
import {
  type DifficultyLevel,
  loadDifficultySetting,
  migrateDifficulty,
  saveDifficultySetting,
} from '../core/DifficultySettings';
import { type GameEventListener, getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import { worldDb } from '../db/worldDatabase';
import type { LevelId } from '../levels/types';

// ============================================================================
// TABLE ABSTRACTION FOR ZUSTAND STORES
// ============================================================================

/**
 * Configuration for a store table
 */
export interface TableConfig<T> {
  /** Table name (used as key prefix) */
  name: string;
  /** Schema version for migrations */
  schemaVersion: number;
  /** Custom serializer (default: JSON.stringify) */
  serialize?: (data: T) => string;
  /** Custom deserializer (default: JSON.parse) */
  deserialize?: (data: string) => T;
  /** Migration function for older schema versions */
  migrate?: (data: unknown, fromVersion: number) => T;
}

/**
 * Stored table data wrapper with version info
 */
interface StoredTableData<T> {
  version: number;
  data: T;
  timestamp: number;
}

/**
 * Registry of table configurations
 */
const tableRegistry = new Map<string, TableConfig<unknown>>();

/**
 * Storage key prefix for store tables
 */
const STORE_TABLE_PREFIX = 'store_';

import {
  createNewSave,
  extractSaveMetadata,
  fromSaveState,
  type GameSave,
  type GameSaveMetadata,
  MAX_SAVE_SLOTS,
  SAVE_FORMAT_VERSION,
  SAVE_SLOT_AUTOSAVE,
  SAVE_SLOT_QUICKSAVE,
  type SavedGameSettings,
  type SaveState,
  toSaveState,
  type WeaponSaveState,
} from './GameSave';

const log = getLogger('SaveSystem');

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Events emitted by the SaveSystem
 */
export type SaveSystemEvent =
  | { type: 'save_created'; save: GameSaveMetadata; slotNumber: number }
  | { type: 'save_loaded'; save: GameSave; slotNumber: number }
  | { type: 'save_deleted'; saveId: string; slotNumber: number }
  | { type: 'auto_saved'; save: GameSaveMetadata }
  | { type: 'checkpoint_saved'; save: GameSaveMetadata }
  | { type: 'quick_saved'; save: GameSaveMetadata }
  | { type: 'quick_loaded'; save: GameSave }
  | { type: 'error'; message: string };

type SaveSystemListener = (event: SaveSystemEvent) => void;

// ============================================================================
// STORAGE KEYS
// ============================================================================

/**
 * Storage key prefixes for different save types
 */
const STORAGE_KEY_PREFIX = 'save';
const AUTOSAVE_KEY = `${STORAGE_KEY_PREFIX}_autosave`;
const QUICKSAVE_KEY = `${STORAGE_KEY_PREFIX}_quicksave`;

/**
 * Get storage key for a specific slot
 */
function getSlotKey(slotNumber: number): string {
  if (slotNumber === SAVE_SLOT_AUTOSAVE) return AUTOSAVE_KEY;
  if (slotNumber === SAVE_SLOT_QUICKSAVE) return QUICKSAVE_KEY;
  return `${STORAGE_KEY_PREFIX}_slot_${slotNumber}`;
}

// ============================================================================
// SAVE SYSTEM CLASS
// ============================================================================

class SaveSystem {
  private currentSave: GameSave | null = null;
  private sessionStartTime: number = Date.now();
  private listeners: Set<SaveSystemListener> = new Set();
  private autoSaveEnabled = true;
  private initialized = false;
  private eventBusUnsubscribers: (() => void)[] = [];

  // Quick save/load key bindings
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

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
    this.setupKeyBindings();
    this.subscribeToEventBus();
    this.initialized = true;
    log.info('Initialized successfully');
  }

  /**
   * Subscribe to EventBus events for cross-system communication.
   * Listens to:
   * - LEVEL_COMPLETE: triggers auto-save
   * - CHECKPOINT_REACHED: triggers checkpoint save
   */
  private subscribeToEventBus(): void {
    const eventBus = getEventBus();

    // Subscribe to LEVEL_COMPLETE for auto-save
    const levelCompleteHandler: GameEventListener<'LEVEL_COMPLETE'> = (event) => {
      if (event.levelId) {
        log.debug(`EventBus: LEVEL_COMPLETE received for ${event.levelId}, triggering auto-save`);
        this.autoSave();
      }
    };

    // Subscribe to CHECKPOINT_REACHED for checkpoint saves
    const checkpointHandler: GameEventListener<'CHECKPOINT_REACHED'> = (event) => {
      if (this.currentSave) {
        log.debug(
          `EventBus: CHECKPOINT_REACHED received (${event.checkpointId}), saving checkpoint`
        );
        // Get current position from the event or use defaults
        const position = this.currentSave.playerPosition ?? { x: 0, y: 1.7, z: 0 };
        const rotation = this.currentSave.playerRotation ?? 0;
        this.saveCheckpoint(position, rotation);
      }
    };

    this.eventBusUnsubscribers.push(eventBus.on('LEVEL_COMPLETE', levelCompleteHandler));
    this.eventBusUnsubscribers.push(eventBus.on('CHECKPOINT_REACHED', checkpointHandler));

    log.debug('Subscribed to EventBus events (LEVEL_COMPLETE, CHECKPOINT_REACHED)');
  }

  /**
   * Setup F5/F9 key bindings for quick save/load
   */
  private setupKeyBindings(): void {
    if (this.keyHandler) return;

    this.keyHandler = (e: KeyboardEvent) => {
      // F5 = Quick Save
      if (e.key === 'F5') {
        e.preventDefault();
        this.quickSave();
      }
      // F9 = Quick Load
      if (e.key === 'F9') {
        e.preventDefault();
        this.quickLoad();
      }
    };

    window.addEventListener('keydown', this.keyHandler);
  }

  /**
   * Cleanup key bindings
   */
  private cleanupKeyBindings(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
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
        log.error('Listener error:', e);
      }
    }
  }

  // ============================================================================
  // SAVE SLOT MANAGEMENT
  // ============================================================================

  /**
   * Get all save slot metadata for display
   */
  async getAllSaveMetadata(): Promise<(GameSaveMetadata | null)[]> {
    const slots: (GameSaveMetadata | null)[] = [];

    // Get autosave (slot 0)
    const autosave = await this.getSaveMetadataForSlot(SAVE_SLOT_AUTOSAVE);
    slots.push(autosave);

    // Get manual saves (slots 1-3)
    for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
      const save = await this.getSaveMetadataForSlot(i);
      slots.push(save);
    }

    return slots;
  }

  /**
   * Get save metadata for a specific slot
   */
  async getSaveMetadataForSlot(slotNumber: number): Promise<GameSaveMetadata | null> {
    const key = getSlotKey(slotNumber);
    const saveData = await worldDb.getChunkData(key);
    if (!saveData) return null;

    try {
      const save = JSON.parse(saveData) as GameSave;
      return extractSaveMetadata(save);
    } catch {
      log.warn(`Failed to parse save in slot ${slotNumber}`);
      return null;
    }
  }

  /**
   * Check if a specific slot has a save
   */
  async hasSlotSave(slotNumber: number): Promise<boolean> {
    const key = getSlotKey(slotNumber);
    const saveData = await worldDb.getChunkData(key);
    return saveData !== null;
  }

  /**
   * Check if any save exists (for continue game)
   */
  async hasSave(): Promise<boolean> {
    // Check autosave first
    if (await this.hasSlotSave(SAVE_SLOT_AUTOSAVE)) return true;

    // Check manual slots
    for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
      if (await this.hasSlotSave(i)) return true;
    }

    return false;
  }

  /**
   * Get the most recent save (for continue game)
   */
  async getMostRecentSave(): Promise<GameSaveMetadata | null> {
    let mostRecent: GameSaveMetadata | null = null;

    // Check autosave
    const autosave = await this.getSaveMetadataForSlot(SAVE_SLOT_AUTOSAVE);
    if (autosave) mostRecent = autosave;

    // Check quicksave
    const quicksave = await this.getSaveMetadataForSlot(SAVE_SLOT_QUICKSAVE);
    if (quicksave && (!mostRecent || quicksave.timestamp > mostRecent.timestamp)) {
      mostRecent = quicksave;
    }

    // Check manual slots
    for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
      const save = await this.getSaveMetadataForSlot(i);
      if (save && (!mostRecent || save.timestamp > mostRecent.timestamp)) {
        mostRecent = save;
      }
    }

    return mostRecent;
  }

  // ============================================================================
  // SAVE OPERATIONS
  // ============================================================================

  /**
   * Get the current active save (in-memory)
   */
  getCurrentSave(): GameSave | null {
    return this.currentSave;
  }

  /**
   * Create a new game (clears any existing save)
   * @param difficulty - The difficulty level for the new game (defaults to current setting)
   * @param startLevel - The starting level (defaults to 'anchor_station')
   */
  async newGame(difficulty?: DifficultyLevel, startLevel?: LevelId): Promise<GameSave> {
    // Reset the world database
    await worldDb.resetDatabase();

    // Use provided difficulty or load from settings
    const gameDifficulty = difficulty ?? loadDifficultySetting();
    const startingLevel = startLevel ?? 'anchor_station';

    // Create a new save as autosave
    const save = createNewSave(
      `save_${Date.now()}`,
      gameDifficulty,
      startingLevel,
      SAVE_SLOT_AUTOSAVE,
      'auto'
    );
    this.currentSave = save;
    this.sessionStartTime = Date.now();

    // Also update the global difficulty setting to match the save
    saveDifficultySetting(gameDifficulty);

    // Track campaign start for speedrunner achievement
    getAchievementManager().onCampaignStart();

    // Persist the new save to autosave slot
    await this.persistSave(save, SAVE_SLOT_AUTOSAVE);

    this.emit({
      type: 'save_created',
      save: extractSaveMetadata(save),
      slotNumber: SAVE_SLOT_AUTOSAVE,
    });
    log.info(`New game created with difficulty: ${gameDifficulty}`);

    return save;
  }

  /**
   * Save to a specific slot (manual save)
   * @param slotNumber - Slot number (1-3 for manual saves)
   * @param name - Optional custom name for the save
   */
  async saveToSlot(slotNumber: number, name?: string): Promise<GameSave | null> {
    if (!this.currentSave) {
      log.warn('No active save to save');
      this.emit({ type: 'error', message: 'No active game to save' });
      return null;
    }

    if (slotNumber < 1 || slotNumber > MAX_SAVE_SLOTS) {
      log.warn(`Invalid slot number: ${slotNumber}`);
      this.emit({ type: 'error', message: 'Invalid save slot' });
      return null;
    }

    // Update play time
    this.updatePlayTime();

    // Create save copy for the slot
    const slotSave: GameSave = {
      ...this.currentSave,
      id: `save_slot_${slotNumber}_${Date.now()}`,
      slotNumber,
      saveType: 'manual',
      name: name ?? `Slot ${slotNumber} - ${this.currentSave.currentLevel}`,
      timestamp: Date.now(),
    };

    await this.persistSave(slotSave, slotNumber);

    this.emit({ type: 'save_created', save: extractSaveMetadata(slotSave), slotNumber });
    log.info(`Saved to slot ${slotNumber}`);

    return slotSave;
  }

  /**
   * Load from a specific slot
   * @param slotNumber - Slot number to load from
   */
  async loadFromSlot(slotNumber: number): Promise<GameSave | null> {
    const key = getSlotKey(slotNumber);
    const saveData = await worldDb.getChunkData(key);

    if (!saveData) {
      log.warn(`No save in slot ${slotNumber}`);
      this.emit({ type: 'error', message: 'No save in this slot' });
      return null;
    }

    try {
      const save = JSON.parse(saveData) as GameSave;

      // Version migration if needed
      if (save.version !== SAVE_FORMAT_VERSION) {
        log.info(`Migrating save from v${save.version} to v${SAVE_FORMAT_VERSION}`);
        this.migrateSave(save);
      }

      this.currentSave = save;
      this.sessionStartTime = Date.now();

      // Sync the global difficulty setting with the loaded save
      if (save.difficulty) {
        saveDifficultySetting(save.difficulty);
      }

      this.emit({ type: 'save_loaded', save, slotNumber });
      log.info(`Loaded from slot ${slotNumber}: ${save.name}`);

      return save;
    } catch (error) {
      log.error(`Failed to load slot ${slotNumber}:`, error);
      this.emit({ type: 'error', message: 'Failed to load save - data may be corrupted' });
      return null;
    }
  }

  /**
   * Delete a save from a specific slot
   */
  async deleteSlot(slotNumber: number): Promise<void> {
    const key = getSlotKey(slotNumber);
    await worldDb.deleteChunkData(key);

    this.emit({ type: 'save_deleted', saveId: key, slotNumber });
    log.info(`Deleted save in slot ${slotNumber}`);
  }

  /**
   * Load the saved game (legacy method - loads autosave)
   */
  async loadGame(): Promise<GameSave | null> {
    return this.loadFromSlot(SAVE_SLOT_AUTOSAVE);
  }

  /**
   * Continue game - loads the most recent save
   */
  async continueGame(): Promise<GameSave | null> {
    const mostRecent = await this.getMostRecentSave();
    if (!mostRecent) {
      log.info('No save found to continue');
      return null;
    }

    return this.loadFromSlot(mostRecent.slotNumber);
  }

  // ============================================================================
  // QUICK SAVE / QUICK LOAD
  // ============================================================================

  /**
   * Quick save (F5)
   */
  async quickSave(): Promise<void> {
    if (!this.currentSave) {
      log.warn('No active save for quick save');
      this.emit({ type: 'error', message: 'No active game to quick save' });
      return;
    }

    // Update play time
    this.updatePlayTime();

    // Create quicksave
    const quicksave: GameSave = {
      ...this.currentSave,
      id: `quicksave_${Date.now()}`,
      slotNumber: SAVE_SLOT_QUICKSAVE,
      saveType: 'quicksave',
      name: `Quicksave - ${this.currentSave.currentLevel}`,
      timestamp: Date.now(),
    };

    await this.persistSave(quicksave, SAVE_SLOT_QUICKSAVE);

    this.emit({ type: 'quick_saved', save: extractSaveMetadata(quicksave) });
    log.info('Quick saved');
  }

  /**
   * Quick load (F9)
   */
  async quickLoad(): Promise<GameSave | null> {
    const save = await this.loadFromSlot(SAVE_SLOT_QUICKSAVE);
    if (save) {
      this.emit({ type: 'quick_loaded', save });
    }
    return save;
  }

  // ============================================================================
  // AUTO SAVE / CHECKPOINT
  // ============================================================================

  /**
   * Auto-save (called on level completion)
   */
  autoSave(): void {
    if (!this.autoSaveEnabled || !this.currentSave) {
      return;
    }

    this.updatePlayTime();

    // Update the autosave slot
    const autosave: GameSave = {
      ...this.currentSave,
      id: `autosave_${Date.now()}`,
      slotNumber: SAVE_SLOT_AUTOSAVE,
      saveType: 'auto',
      timestamp: Date.now(),
    };

    this.persistSave(autosave, SAVE_SLOT_AUTOSAVE);
    this.emit({ type: 'auto_saved', save: extractSaveMetadata(autosave) });
    log.info('Auto-saved');
  }

  /**
   * Save at checkpoint (mid-level save point)
   */
  async saveCheckpoint(
    position: { x: number; y: number; z: number },
    rotation: number
  ): Promise<void> {
    if (!this.currentSave) {
      log.warn('No active save for checkpoint');
      return;
    }

    this.updatePlayTime();

    // Update checkpoint data
    this.currentSave.checkpoint = {
      position: { ...position },
      rotation,
      timestamp: Date.now(),
    };
    this.currentSave.playerPosition = { ...position };
    this.currentSave.playerRotation = rotation;

    // Save as checkpoint type
    const checkpointSave: GameSave = {
      ...this.currentSave,
      id: `checkpoint_${Date.now()}`,
      slotNumber: SAVE_SLOT_AUTOSAVE,
      saveType: 'checkpoint',
      timestamp: Date.now(),
    };

    await this.persistSave(checkpointSave, SAVE_SLOT_AUTOSAVE);

    this.emit({ type: 'checkpoint_saved', save: extractSaveMetadata(checkpointSave) });
    log.info('Checkpoint saved');
  }

  /**
   * Save current game state (legacy method - updates autosave)
   */
  save(): void {
    this.autoSave();
  }

  // ============================================================================
  // STATE UPDATES
  // ============================================================================

  private updatePlayTime(): void {
    if (!this.currentSave) return;
    const sessionTime = Date.now() - this.sessionStartTime;
    this.currentSave.playTime += sessionTime;
    this.sessionStartTime = Date.now();
    this.currentSave.timestamp = Date.now();
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
   * Update player armor in current save
   */
  updateArmor(armor: number, maxArmor?: number): void {
    if (!this.currentSave) return;
    this.currentSave.playerArmor = armor;
    if (maxArmor !== undefined) {
      this.currentSave.maxPlayerArmor = maxArmor;
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
   * Update weapon states
   */
  updateWeaponStates(weapons: WeaponSaveState[]): void {
    if (!this.currentSave) return;
    this.currentSave.weaponStates = [...weapons];
  }

  /**
   * Update current weapon slot
   */
  updateCurrentWeapon(slot: number): void {
    if (!this.currentSave) return;
    this.currentSave.currentWeaponSlot = slot;
  }

  /**
   * Update grenade inventory
   */
  updateGrenades(grenades: { frag: number; plasma: number; emp: number }): void {
    if (!this.currentSave) return;
    this.currentSave.grenades = { ...grenades };
  }

  /**
   * Update grenade usage stats
   */
  updateGrenadeStats(stats: {
    pickedUp: { frag: number; plasma: number; emp: number };
    used: { frag: number; plasma: number; emp: number };
  }): void {
    if (!this.currentSave) return;
    this.currentSave.grenadeStats = {
      pickedUp: { ...stats.pickedUp },
      used: { ...stats.used },
    };
  }

  /**
   * Get grenade stats from current save
   */
  getGrenadeStats(): {
    pickedUp: { frag: number; plasma: number; emp: number };
    used: { frag: number; plasma: number; emp: number };
  } | null {
    if (!this.currentSave) return null;
    return (
      this.currentSave.grenadeStats ?? {
        pickedUp: { frag: 0, plasma: 0, emp: 0 },
        used: { frag: 0, plasma: 0, emp: 0 },
      }
    );
  }

  /**
   * Get grenade inventory from current save
   */
  getGrenades(): { frag: number; plasma: number; emp: number } | null {
    if (!this.currentSave) return null;
    return this.currentSave.grenades ?? { frag: 2, plasma: 1, emp: 1 };
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

    // Clear checkpoint on level completion
    this.currentSave.checkpoint = null;

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

  // ============================================================================
  // COLLECTIBLES
  // ============================================================================

  /**
   * Add a collected skull
   */
  addCollectedSkull(skullId: string): void {
    if (!this.currentSave) return;
    if (!this.currentSave.collectedSkulls.includes(skullId)) {
      this.currentSave.collectedSkulls.push(skullId);
    }
  }

  /**
   * Add a discovered audio log
   */
  addDiscoveredAudioLog(logId: string): void {
    if (!this.currentSave) return;
    if (!this.currentSave.discoveredAudioLogs.includes(logId)) {
      this.currentSave.discoveredAudioLogs.push(logId);
    }
  }

  /**
   * Add a discovered secret area
   */
  addDiscoveredSecretArea(secretId: string): void {
    if (!this.currentSave) return;
    if (!this.currentSave.discoveredSecretAreas.includes(secretId)) {
      this.currentSave.discoveredSecretAreas.push(secretId);
    }
  }

  /**
   * Add an unlocked achievement
   */
  addUnlockedAchievement(achievementId: string): void {
    if (!this.currentSave) return;
    if (!this.currentSave.unlockedAchievements.includes(achievementId)) {
      this.currentSave.unlockedAchievements.push(achievementId);
    }
  }

  // ============================================================================
  // QUEST CHAIN METHODS
  // ============================================================================

  /**
   * Get completed quests
   */
  getCompletedQuests(): string[] {
    return this.currentSave?.completedQuests ?? [];
  }

  /**
   * Get active quest states
   */
  getActiveQuests(): Record<string, any> {
    return this.currentSave?.activeQuests ?? {};
  }

  /**
   * Get failed quests
   */
  getFailedQuests(): string[] {
    return this.currentSave?.failedQuests ?? [];
  }

  /**
   * Complete a quest
   */
  completeQuest(questId: string): void {
    if (!this.currentSave) return;
    if (!this.currentSave.completedQuests.includes(questId)) {
      this.currentSave.completedQuests.push(questId);
    }
    // Remove from active if present
    delete this.currentSave.activeQuests[questId];
  }

  /**
   * Set active quest state
   */
  setActiveQuestState(questId: string, state: any): void {
    if (!this.currentSave) return;
    this.currentSave.activeQuests[questId] = state;
  }

  /**
   * Remove active quest state
   */
  removeActiveQuest(questId: string): void {
    if (!this.currentSave) return;
    delete this.currentSave.activeQuests[questId];
  }

  /**
   * Fail a quest
   */
  failQuest(questId: string): void {
    if (!this.currentSave) return;
    if (!this.currentSave.failedQuests.includes(questId)) {
      this.currentSave.failedQuests.push(questId);
    }
    // Remove from active if present
    delete this.currentSave.activeQuests[questId];
  }

  /**
   * Check if a quest is completed
   */
  isQuestCompleted(questId: string): boolean {
    return this.currentSave?.completedQuests?.includes(questId) ?? false;
  }

  // ============================================================================
  // TUTORIAL & INTRO
  // ============================================================================

  /**
   * @deprecated Use quest chain system instead
   * Update tutorial progress - kept for backwards compatibility
   */
  setTutorialProgress(_step: number, completed?: boolean): void {
    if (!this.currentSave) return;
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

  // ============================================================================
  // DIFFICULTY & SETTINGS
  // ============================================================================

  /**
   * Update difficulty setting
   * Also syncs to localStorage for global access
   */
  setDifficulty(difficulty: DifficultyLevel): void {
    if (!this.currentSave) return;
    this.currentSave.difficulty = difficulty;
    saveDifficultySetting(difficulty);
    log.info(`Difficulty changed to: ${difficulty}`);
  }

  /**
   * Get current difficulty from save
   */
  getDifficulty(): DifficultyLevel {
    return this.currentSave?.difficulty ?? loadDifficultySetting();
  }

  /**
   * Update saved game settings
   */
  updateSavedSettings(settings: Partial<SavedGameSettings>): void {
    if (!this.currentSave) return;
    if (!this.currentSave.savedSettings) {
      this.currentSave.savedSettings = {
        masterVolume: 1.0,
        musicVolume: 0.5,
        sfxVolume: 0.7,
        mouseSensitivity: 1.0,
        invertMouseY: false,
        fieldOfView: 90,
        showHitmarkers: true,
      };
    }
    this.currentSave.savedSettings = { ...this.currentSave.savedSettings, ...settings };
  }

  // ============================================================================
  // NEW GAME PLUS
  // ============================================================================

  /**
   * Check if this save is a New Game Plus run
   */
  isNewGamePlus(): boolean {
    return this.currentSave?.isNewGamePlus ?? false;
  }

  /**
   * Get current NG+ tier (0 = normal game)
   */
  getNgPlusTier(): number {
    return this.currentSave?.ngPlusTier ?? 0;
  }

  /**
   * Get total campaign completions
   */
  getCampaignCompletions(): number {
    return this.currentSave?.campaignCompletions ?? 0;
  }

  /**
   * Get highest NG+ tier completed
   */
  getHighestNgPlusTierCompleted(): number {
    return this.currentSave?.highestNgPlusTierCompleted ?? 0;
  }

  /**
   * Get NG+ unlocked weapons
   */
  getNgPlusUnlockedWeapons(): string[] {
    return this.currentSave?.ngPlusUnlockedWeapons ?? [];
  }

  /**
   * Get NG+ unlocked skulls
   */
  getNgPlusUnlockedSkulls(): string[] {
    return this.currentSave?.ngPlusUnlockedSkulls ?? [];
  }

  /**
   * Start a New Game Plus run
   * @param tier The NG+ tier to start (1 = NG+, 2 = NG++, etc.)
   * @param difficulty The difficulty level
   * @param startLevel The starting level
   */
  async startNewGamePlus(
    tier: number,
    difficulty?: DifficultyLevel,
    startLevel?: LevelId
  ): Promise<GameSave> {
    // Preserve NG+ state from current save before reset
    const previousSave = this.currentSave;
    const unlockedWeapons = previousSave?.ngPlusUnlockedWeapons ?? [];
    const unlockedSkulls = previousSave?.ngPlusUnlockedSkulls ?? [];
    const exclusiveSkulls = previousSave?.ngPlusExclusiveSkulls ?? [];
    const completions = previousSave?.campaignCompletions ?? 0;
    const highestTier = previousSave?.highestNgPlusTierCompleted ?? 0;

    // Reset the world database for fresh run
    await worldDb.resetDatabase();

    // Use provided difficulty or load from settings
    const gameDifficulty = difficulty ?? loadDifficultySetting();
    const startingLevel = startLevel ?? 'anchor_station';

    // Create new save with NG+ state
    const save = createNewSave(
      `ngplus_${Date.now()}`,
      gameDifficulty,
      startingLevel,
      SAVE_SLOT_AUTOSAVE,
      'auto'
    );

    // Apply NG+ state
    save.isNewGamePlus = true;
    save.ngPlusTier = tier;
    save.campaignCompletions = completions;
    save.ngPlusUnlockedWeapons = [...unlockedWeapons];
    save.ngPlusUnlockedSkulls = [...unlockedSkulls];
    save.ngPlusExclusiveSkulls = [...exclusiveSkulls];
    save.highestNgPlusTierCompleted = highestTier;

    // Apply NG+ starting bonuses
    const healthBonus = Math.min(50 * tier, 150);
    const armorBonus = Math.min(25 * tier, 75);
    save.maxPlayerHealth = 100 + healthBonus;
    save.playerHealth = save.maxPlayerHealth;
    save.playerArmor = armorBonus;

    this.currentSave = save;
    this.sessionStartTime = Date.now();

    // Save difficulty setting
    saveDifficultySetting(gameDifficulty);

    // Persist the new save
    await this.persistSave(save, SAVE_SLOT_AUTOSAVE);

    this.emit({
      type: 'save_created',
      save: extractSaveMetadata(save),
      slotNumber: SAVE_SLOT_AUTOSAVE,
    });
    log.info(`New Game Plus Tier ${tier} started with difficulty: ${gameDifficulty}`);

    return save;
  }

  /**
   * Called when the campaign is completed
   * Updates NG+ state and unlocks next tier
   * @param weapons Weapons collected during the run
   * @param skulls Skulls collected during the run
   */
  onCampaignComplete(weapons: string[], skulls: string[]): void {
    if (!this.currentSave) return;

    // Increment completions
    this.currentSave.campaignCompletions++;

    // Update highest tier if applicable
    if (this.currentSave.ngPlusTier > this.currentSave.highestNgPlusTierCompleted) {
      this.currentSave.highestNgPlusTierCompleted = this.currentSave.ngPlusTier;
    }

    // Add unlocked weapons
    for (const weapon of weapons) {
      if (!this.currentSave.ngPlusUnlockedWeapons.includes(weapon as any)) {
        this.currentSave.ngPlusUnlockedWeapons.push(weapon as any);
      }
    }

    // Add unlocked skulls
    for (const skull of skulls) {
      if (!this.currentSave.ngPlusUnlockedSkulls.includes(skull as any)) {
        this.currentSave.ngPlusUnlockedSkulls.push(skull as any);
      }
    }

    // Auto-save
    this.autoSave();

    log.info(
      `Campaign completed! Completions: ${this.currentSave.campaignCompletions}, ` +
        `Tier: ${this.currentSave.ngPlusTier}`
    );
  }

  /**
   * Get the NG+ tier display name
   */
  getNgPlusTierDisplay(): string {
    const tier = this.getNgPlusTier();
    if (tier === 0) return 'Normal';
    if (tier === 1) return 'NG+';
    return `NG${'+'.repeat(tier)}`;
  }

  // ============================================================================
  // LEVEL FLAGS & TIMES
  // ============================================================================

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
      log.info(`New best time for ${levelId}: ${timeSeconds.toFixed(2)}s`);
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

  // ============================================================================
  // DELETE & RESET
  // ============================================================================

  /**
   * Delete the saved game (legacy - deletes autosave)
   */
  async deleteSave(): Promise<void> {
    await this.deleteSlot(SAVE_SLOT_AUTOSAVE);
    this.currentSave = null;
  }

  /**
   * Delete all saves
   */
  async deleteAllSaves(): Promise<void> {
    await this.deleteSlot(SAVE_SLOT_AUTOSAVE);
    await this.deleteSlot(SAVE_SLOT_QUICKSAVE);
    for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
      await this.deleteSlot(i);
    }
    this.currentSave = null;
    log.info('All saves deleted');
  }

  /**
   * Enable/disable auto-save
   */
  setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled = enabled;
  }

  // ============================================================================
  // EXPORT / IMPORT (Cloud Save Preparation)
  // ============================================================================

  /**
   * Export save as JSON string (for backup/sharing/cloud sync)
   */
  async exportSaveJSON(slotNumber?: number): Promise<string | null> {
    let save: GameSave | null = null;

    if (slotNumber !== undefined) {
      const key = getSlotKey(slotNumber);
      const saveData = await worldDb.getChunkData(key);
      if (saveData) {
        save = JSON.parse(saveData) as GameSave;
      }
    } else if (this.currentSave) {
      save = this.currentSave;
    }

    if (!save) return null;

    // Convert to SaveState format for cloud sync
    const saveState = toSaveState(save);
    return JSON.stringify(saveState, null, 2);
  }

  /**
   * Import save from JSON string
   */
  async importSaveJSON(json: string, slotNumber: number = SAVE_SLOT_AUTOSAVE): Promise<boolean> {
    try {
      const state = JSON.parse(json) as SaveState;

      // Validate basic structure
      if (!state.campaign?.currentLevel || state.version === undefined) {
        throw new Error('Invalid save format');
      }

      // Convert from SaveState to GameSave
      const save = fromSaveState(
        state,
        `imported_${Date.now()}`,
        slotNumber,
        slotNumber === SAVE_SLOT_AUTOSAVE ? 'auto' : 'manual'
      );

      // Migrate if needed
      if (save.version !== SAVE_FORMAT_VERSION) {
        this.migrateSave(save);
      }

      // Persist to slot
      await this.persistSave(save, slotNumber);

      // If importing to current slot, update current save
      if (slotNumber === SAVE_SLOT_AUTOSAVE || slotNumber === this.currentSave?.slotNumber) {
        this.currentSave = save;
        this.sessionStartTime = Date.now();
      }

      this.emit({ type: 'save_loaded', save, slotNumber });
      log.info('Save imported successfully');

      return true;
    } catch (error) {
      log.error('Failed to import save:', error);
      this.emit({ type: 'error', message: 'Failed to import save' });
      return false;
    }
  }

  /**
   * Get save metadata (legacy method)
   */
  async getSaveMetadata(): Promise<GameSaveMetadata | null> {
    if (!this.currentSave) {
      return this.getSaveMetadataForSlot(SAVE_SLOT_AUTOSAVE);
    }
    return extractSaveMetadata(this.currentSave);
  }

  /**
   * Export database as a downloadable file (for web platform backup)
   */
  async exportDatabaseFile(): Promise<void> {
    try {
      // Save current state first
      this.save();
      await worldDb.persistNow();

      const data = await worldDb.exportDatabaseAsync();
      if (!data) {
        log.error('No database data to export');
        this.emit({ type: 'error', message: 'No save data to export' });
        return;
      }

      // Create a copy in a standard ArrayBuffer for Blob compatibility
      const arrayBuffer = new ArrayBuffer(data.byteLength);
      new Uint8Array(arrayBuffer).set(data);
      const blob = new Blob([arrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stellar_descent_save_${new Date().toISOString().slice(0, 10)}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      log.info('Database exported successfully');
    } catch (error) {
      log.error('Failed to export database:', error);
      this.emit({ type: 'error', message: 'Failed to export save' });
    }
  }

  /**
   * Import database from an uploaded file (for web platform restore)
   */
  async importDatabaseFile(file: File): Promise<boolean> {
    try {
      // Validate file size (50MB limit)
      const MAX_FILE_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        log.error('Save file too large. Maximum size is 50MB.');
        this.emit({ type: 'error', message: 'Save file too large (max 50MB)' });
        return false;
      }

      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      await worldDb.importDatabase(data);

      // Reload the save after import
      const save = await this.loadGame();
      if (save) {
        log.info('Database imported successfully');
        return true;
      }

      log.info('Database imported but no save found');
      return true;
    } catch (error) {
      log.error('Failed to import database:', error);
      this.emit({
        type: 'error',
        message: `Failed to import save: ${error instanceof Error ? error.message : String(error)}`,
      });
      return false;
    }
  }

  // ============================================================================
  // MIGRATION
  // ============================================================================

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
      log.info(`Migrated save to v2, difficulty: ${save.difficulty}`);
    }

    // v2 -> v3: Add seenIntroBriefing field
    if (save.version < 3) {
      save.seenIntroBriefing = save.seenIntroBriefing ?? false;
      log.info('Migrated save to v3, added seenIntroBriefing');
    }

    // v3 -> v4: Add levelBestTimes field
    if (save.version < 4) {
      save.levelBestTimes = save.levelBestTimes ?? {};
      log.info('Migrated save to v4, added levelBestTimes');
    }

    // v4 -> v5: Add quest chain state
    if (save.version < 5) {
      save.completedQuests = save.completedQuests ?? [];
      save.activeQuests = save.activeQuests ?? {};
      save.failedQuests = save.failedQuests ?? [];

      // Migrate old objectives to completedQuests
      if (save.objectives) {
        for (const [questId, completed] of Object.entries(save.objectives)) {
          if (completed && !save.completedQuests.includes(questId)) {
            save.completedQuests.push(questId);
          }
        }
      }
      log.info('Migrated save to v5, added quest chain state');
    }

    // v5 -> v6: Add full player state, collectibles, achievements
    if (save.version < 6) {
      save.slotNumber = save.slotNumber ?? SAVE_SLOT_AUTOSAVE;
      save.saveType = save.saveType ?? 'auto';
      save.playerArmor = save.playerArmor ?? 0;
      save.maxPlayerArmor = save.maxPlayerArmor ?? 100;
      save.weaponStates = save.weaponStates ?? [
        { weaponId: 'rifle', currentAmmo: 30, reserveAmmo: 90, unlocked: true },
        { weaponId: 'shotgun', currentAmmo: 0, reserveAmmo: 0, unlocked: false },
        { weaponId: 'pistol', currentAmmo: 12, reserveAmmo: 36, unlocked: true },
      ];
      save.currentWeaponSlot = save.currentWeaponSlot ?? 0;
      save.grenades = save.grenades ?? { frag: 2, plasma: 1, emp: 1 };
      save.collectedSkulls = save.collectedSkulls ?? [];
      save.discoveredAudioLogs = save.discoveredAudioLogs ?? [];
      save.discoveredSecretAreas = save.discoveredSecretAreas ?? [];
      save.unlockedAchievements = save.unlockedAchievements ?? [];
      save.savedSettings = save.savedSettings ?? null;
      save.checkpoint = save.checkpoint ?? null;
      log.info('Migrated save to v6, added full player state and collectibles');
    }

    // v6 -> v7: Add New Game Plus state
    if (save.version < 7) {
      save.isNewGamePlus = save.isNewGamePlus ?? false;
      save.ngPlusTier = save.ngPlusTier ?? 0;
      save.campaignCompletions = save.campaignCompletions ?? 0;
      save.ngPlusUnlockedWeapons = save.ngPlusUnlockedWeapons ?? [];
      save.ngPlusUnlockedSkulls = save.ngPlusUnlockedSkulls ?? [];
      save.ngPlusExclusiveSkulls = save.ngPlusExclusiveSkulls ?? [];
      save.highestNgPlusTierCompleted = save.highestNgPlusTierCompleted ?? 0;
      log.info('Migrated save to v7, added New Game Plus state');
    }

    // Update version
    save.version = SAVE_FORMAT_VERSION;
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private async persistSave(save: GameSave, slotNumber: number): Promise<void> {
    try {
      const key = getSlotKey(slotNumber);
      await worldDb.setChunkData(key, JSON.stringify(save));
      // Trigger persistence to IndexedDB for PWA offline support
      worldDb.persistToIndexedDB();
    } catch (error) {
      log.error('Failed to persist save:', error);
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

  /**
   * Dispose the save system (cleanup)
   */
  dispose(): void {
    this.cleanupKeyBindings();

    // Unsubscribe from all EventBus events
    for (const unsubscribe of this.eventBusUnsubscribers) {
      unsubscribe();
    }
    this.eventBusUnsubscribers = [];

    this.listeners.clear();
    this.initialized = false;
    SaveSystem.initPromise = null;
    log.info('Disposed');
  }

  // ============================================================================
  // TABLE ABSTRACTION FOR ZUSTAND STORES
  // ============================================================================

  /**
   * Register a table configuration for a Zustand store
   *
   * @param config - Table configuration
   */
  registerTable<T>(config: TableConfig<T>): void {
    if (tableRegistry.has(config.name)) {
      log.warn(`Table "${config.name}" is already registered, overwriting`);
    }
    tableRegistry.set(config.name, config as TableConfig<unknown>);
    log.debug(`Registered table "${config.name}" (v${config.schemaVersion})`);
  }

  /**
   * Unregister a table configuration
   *
   * @param tableName - Name of the table to unregister
   */
  unregisterTable(tableName: string): void {
    tableRegistry.delete(tableName);
    log.debug(`Unregistered table "${tableName}"`);
  }

  /**
   * Check if a table is registered
   *
   * @param tableName - Name of the table to check
   */
  isTableRegistered(tableName: string): boolean {
    return tableRegistry.has(tableName);
  }

  /**
   * Load data from a store table
   *
   * @param tableName - Name of the table to load from
   * @returns The stored data, or null if not found
   */
  async loadTable<T>(tableName: string): Promise<T | null> {
    const key = `${STORE_TABLE_PREFIX}${tableName}`;

    try {
      const rawData = await worldDb.getChunkData(key);

      if (!rawData) {
        log.debug(`No data found for table "${tableName}"`);
        return null;
      }

      // Parse the wrapper
      const wrapper = JSON.parse(rawData) as StoredTableData<T>;
      const config = tableRegistry.get(tableName);

      // Check if migration is needed
      if (config && wrapper.version < config.schemaVersion && config.migrate) {
        log.info(
          `Migrating table "${tableName}" from v${wrapper.version} to v${config.schemaVersion}`
        );
        const migratedData = config.migrate(wrapper.data, wrapper.version);
        // Re-save with new version
        await this.saveTable(tableName, migratedData as T);
        return migratedData as T;
      }

      // Use custom deserializer if provided
      if (config?.deserialize && typeof wrapper.data === 'string') {
        return config.deserialize(wrapper.data as string) as T;
      }

      return wrapper.data;
    } catch (error) {
      log.error(`Failed to load table "${tableName}":`, error);
      return null;
    }
  }

  /**
   * Save data to a store table
   *
   * @param tableName - Name of the table to save to
   * @param data - The data to save
   */
  async saveTable<T>(tableName: string, data: T): Promise<void> {
    const key = `${STORE_TABLE_PREFIX}${tableName}`;
    const config = tableRegistry.get(tableName);

    try {
      // Serialize the data
      let serializedData: T | string = data;
      if (config?.serialize) {
        serializedData = config.serialize(data);
      }

      // Wrap with version info
      const wrapper: StoredTableData<T | string> = {
        version: config?.schemaVersion ?? 1,
        data: serializedData,
        timestamp: Date.now(),
      };

      await worldDb.setChunkData(key, JSON.stringify(wrapper));
      // Trigger persistence to IndexedDB for PWA offline support
      worldDb.persistToIndexedDB();

      log.debug(`Saved table "${tableName}"`);
    } catch (error) {
      log.error(`Failed to save table "${tableName}":`, error);
      throw error;
    }
  }

  /**
   * Delete a store table's data
   *
   * @param tableName - Name of the table to delete
   */
  async deleteTable(tableName: string): Promise<void> {
    const key = `${STORE_TABLE_PREFIX}${tableName}`;

    try {
      await worldDb.deleteChunkData(key);
      log.debug(`Deleted table "${tableName}"`);
    } catch (error) {
      log.error(`Failed to delete table "${tableName}":`, error);
      throw error;
    }
  }

  /**
   * Get all registered table names
   */
  getRegisteredTables(): string[] {
    return Array.from(tableRegistry.keys());
  }

  /**
   * Clear all store tables (useful for testing or full reset)
   */
  async clearAllTables(): Promise<void> {
    const tables = this.getRegisteredTables();

    for (const tableName of tables) {
      await this.deleteTable(tableName);
    }

    log.info(`Cleared all ${tables.length} store tables`);
  }
}

// Singleton instance
export const saveSystem = new SaveSystem();
