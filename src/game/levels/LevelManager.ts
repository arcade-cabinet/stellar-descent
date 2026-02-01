/**
 * LevelManager - Orchestrates level transitions and lifecycle
 *
 * The level system is a linked list where each level knows what comes next.
 * LevelManager handles:
 * - Creating and disposing levels
 * - Transitioning between levels with proper cleanup
 * - Persisting level state to database
 * - Engine render loop management
 * - Restoring saved state on level load (player position, collectibles, etc.)
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { getMissionDefinition } from '../campaign/MissionDefinitions';
import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import { worldDb } from '../db/worldDatabase';
import { type GameSave, saveSystem } from '../persistence';
import {
  CAMPAIGN_LEVELS,
  type ILevel,
  type LevelConfig,
  type LevelFactoryRegistry,
  type LevelId,
  type LevelState,
} from './types';

const log = getLogger('LevelManager');

export interface LevelManagerConfig {
  engine: Engine;
  canvas: HTMLCanvasElement;
  levelFactories: Partial<LevelFactoryRegistry>;
}

export class LevelManager {
  private engine: Engine;
  private canvas: HTMLCanvasElement;
  private factories: Partial<LevelFactoryRegistry>;

  private currentLevel: ILevel | null = null;
  private levelStates: Map<LevelId, LevelState> = new Map();
  private isTransitioning = false;
  private savedStatesLoaded = false;

  // Callbacks for state restoration
  private onStateRestored: ((save: GameSave) => void) | null = null;

  constructor(config: LevelManagerConfig) {
    this.engine = config.engine;
    this.canvas = config.canvas;
    this.factories = config.levelFactories;
  }

  /**
   * Register a callback to be called when saved state is restored
   * This allows external systems (WeaponContext, GrenadeSystem, etc.) to restore their state
   */
  onSaveStateRestored(callback: (save: GameSave) => void): () => void {
    this.onStateRestored = callback;
    return () => {
      this.onStateRestored = null;
    };
  }

  /**
   * Start a level - creates or resumes it
   */
  async startLevel(levelId: LevelId): Promise<void> {
    if (this.isTransitioning) {
      log.warn('Cannot start level while transitioning');
      return;
    }

    this.isTransitioning = true;

    try {
      // Dispose current level if any
      if (this.currentLevel) {
        await this.disposeCurrentLevel();
      }

      // Ensure saved states are loaded before starting level
      if (!this.savedStatesLoaded) {
        await this.loadSavedStates();
      }

      // Get level config
      const config = this.getLevelConfig(levelId);
      if (!config) {
        throw new Error(`No config for level: ${levelId}`);
      }

      // Get factory for this level type
      const factory = this.factories[config.type];
      if (!factory) {
        throw new Error(`No factory for level type: ${config.type}`);
      }

      // Create the level
      const level = factory(this.engine, this.canvas, config);

      // Restore state if we have it (from level states map)
      const savedLevelState = this.levelStates.get(levelId);
      if (savedLevelState) {
        level.setState(savedLevelState);
      }

      // Additionally, check for checkpoint/save system state and apply
      const gameSave = saveSystem.getCurrentSave();
      if (gameSave && gameSave.currentLevel === levelId) {
        // Apply checkpoint position if available
        if (gameSave.checkpoint) {
          level.setState({
            id: levelId,
            visited: true,
            completed: gameSave.levelsCompleted.includes(levelId),
            playerPosition: gameSave.checkpoint.position,
            playerRotation: gameSave.checkpoint.rotation,
          });
        } else if (gameSave.playerPosition) {
          // Use saved player position
          level.setState({
            id: levelId,
            visited: true,
            completed: gameSave.levelsCompleted.includes(levelId),
            playerPosition: gameSave.playerPosition,
            playerRotation: gameSave.playerRotation,
          });
        }

        // Notify external systems to restore their state
        if (this.onStateRestored) {
          this.onStateRestored(gameSave);
        }
      }

      // Initialize the level
      await level.initialize();

      // Start render loop for this level's scene
      this.startRenderLoop(level);

      // Emit chapter changed event
      getEventBus().emit({
        type: 'CHAPTER_CHANGED',
        chapter: config.chapter,
      });

      this.currentLevel = level;
      log.info(`Level started: ${levelId}`);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Transition to the next level in the sequence
   */
  async transitionToNext(): Promise<void> {
    if (!this.currentLevel) {
      log.warn('No current level to transition from');
      return;
    }

    const nextLevelId = this.currentLevel.config.nextLevelId;
    if (!nextLevelId) {
      log.info('No next level - campaign complete!');
      // Issue #65: Emit level complete event with null for credits sequence
      getEventBus().emit({
        type: 'LEVEL_COMPLETE',
        levelId: this.currentLevel.id,
        nextLevelId: null,
        stats: this.currentLevel.getState().stats ?? {
          kills: 0,
          timeSpent: 0,
          secretsFound: 0,
          deaths: 0,
        },
      });
      return;
    }

    // Issue #66: Update save system with next level before transition
    saveSystem.setCurrentLevel(nextLevelId);
    saveSystem.setChapter(CAMPAIGN_LEVELS[nextLevelId].chapter);

    await this.transitionTo(nextLevelId);
  }

  /**
   * Transition to a specific level
   */
  async transitionTo(levelId: LevelId): Promise<void> {
    if (this.isTransitioning) {
      log.warn('Already transitioning');
      return;
    }

    // Check if transition is allowed
    if (this.currentLevel && !this.currentLevel.canTransitionTo(levelId)) {
      log.warn(`Cannot transition from ${this.currentLevel.id} to ${levelId}`);
      return;
    }

    // Prepare transition (fade out, etc.)
    if (this.currentLevel) {
      await this.currentLevel.prepareTransition(levelId);
    }

    // Save current level state
    if (this.currentLevel) {
      const state = this.currentLevel.getState();
      this.levelStates.set(this.currentLevel.id, state);
      this.persistLevelState(state);
    }

    // Start new level
    await this.startLevel(levelId);
  }

  /**
   * Get the current level
   */
  getCurrentLevel(): ILevel | null {
    return this.currentLevel;
  }

  /**
   * Update the current level (called each frame)
   */
  update(deltaTime: number): void {
    if (this.currentLevel && !this.isTransitioning) {
      this.currentLevel.update(deltaTime);
    }
  }

  /**
   * Dispose everything
   */
  dispose(): void {
    this.stopRenderLoop();
    if (this.currentLevel) {
      // Save state before disposing
      const state = this.currentLevel.getState();
      this.levelStates.set(this.currentLevel.id, state);
      this.persistLevelState(state);

      this.currentLevel.dispose();
      this.currentLevel = null;
    }
  }

  /**
   * Load saved states from database
   * Implements full state restoration from IndexedDB
   */
  async loadSavedStates(): Promise<void> {
    try {
      // Load level states from database for all campaign levels
      const levelIds = Object.keys(CAMPAIGN_LEVELS) as LevelId[];
      let loadedCount = 0;
      let errorCount = 0;

      for (const levelId of levelIds) {
        try {
          const state = await this.loadLevelState(levelId);
          if (state) {
            this.levelStates.set(levelId, state);
            loadedCount++;
          }
        } catch (error) {
          log.warn(`Failed to load state for level ${levelId}:`, error);
          errorCount++;
        }
      }

      // Also sync with the current game save if available
      const gameSave = saveSystem.getCurrentSave();
      if (gameSave) {
        // Merge save system data with level states
        for (const levelId of gameSave.levelsVisited) {
          if (!this.levelStates.has(levelId)) {
            // Create a basic state from the save
            const levelState: LevelState = {
              id: levelId,
              visited: true,
              completed: gameSave.levelsCompleted.includes(levelId),
            };

            // If this is the current level, include position
            if (levelId === gameSave.currentLevel) {
              levelState.playerPosition = gameSave.playerPosition;
              levelState.playerRotation = gameSave.playerRotation;
            }

            this.levelStates.set(levelId, levelState);
          }
        }

        // Mark completed levels as completed in their states
        for (const levelId of gameSave.levelsCompleted) {
          const state = this.levelStates.get(levelId);
          if (state) {
            state.completed = true;
          }
        }
      }

      this.savedStatesLoaded = true;

      if (errorCount > 0) {
        log.warn(`Loaded ${loadedCount} level states with ${errorCount} errors`);
      } else {
        log.info(`Loaded ${loadedCount} level states from database`);
      }
    } catch (error) {
      log.error('Failed to load saved states:', error);
      // Mark as loaded anyway to prevent repeated failures
      this.savedStatesLoaded = true;
    }
  }

  /**
   * Force reload of saved states (useful after loading a save)
   */
  async reloadSavedStates(): Promise<void> {
    this.savedStatesLoaded = false;
    this.levelStates.clear();
    await this.loadSavedStates();
  }

  /**
   * Get restored state for a specific level
   */
  getSavedLevelState(levelId: LevelId): LevelState | null {
    return this.levelStates.get(levelId) ?? null;
  }

  /**
   * Get all saved level states
   */
  getAllSavedStates(): Map<LevelId, LevelState> {
    return new Map(this.levelStates);
  }

  /**
   * Manually set a level state (useful for loading from external sources)
   */
  setLevelState(levelId: LevelId, state: LevelState): void {
    this.levelStates.set(levelId, state);
    this.persistLevelState(state);
  }

  /**
   * Clear all saved states (for new game)
   */
  async clearAllSavedStates(): Promise<void> {
    const levelIds = Object.keys(CAMPAIGN_LEVELS) as LevelId[];

    for (const levelId of levelIds) {
      const key = `level_${levelId}`;
      await worldDb.deleteChunkData(key);
    }

    this.levelStates.clear();
    this.savedStatesLoaded = false;
    log.info('Cleared all saved level states');
  }

  /**
   * Issue #62: Get mission definition for current level
   */
  getMissionDefinition() {
    if (!this.currentLevel) return null;
    return getMissionDefinition(this.currentLevel.id);
  }

  /**
   * Issue #63: Check if level is completed in save system
   */
  isLevelCompleted(levelId: LevelId): boolean {
    const save = saveSystem.getCurrentSave();
    if (!save) return false;
    return save.levelsCompleted.includes(levelId);
  }

  /**
   * Issue #64: Get all completed levels
   */
  getCompletedLevels(): LevelId[] {
    const save = saveSystem.getCurrentSave();
    if (!save) return [];
    return [...save.levelsCompleted];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getLevelConfig(levelId: LevelId): LevelConfig | null {
    return CAMPAIGN_LEVELS[levelId] || null;
  }

  private async disposeCurrentLevel(): Promise<void> {
    if (!this.currentLevel) return;

    // Stop render loop first
    this.stopRenderLoop();

    // Save state
    const state = this.currentLevel.getState();
    this.levelStates.set(this.currentLevel.id, state);

    // Dispose level
    this.currentLevel.dispose();
    this.currentLevel = null;
  }

  private startRenderLoop(level: ILevel): void {
    // Stop any existing loop
    this.stopRenderLoop();

    const scene = level.getScene();

    // Start new render loop
    this.engine.runRenderLoop(() => {
      if (scene && !scene.isDisposed) {
        scene.render();
      }
    });
  }

  private stopRenderLoop(): void {
    this.engine.stopRenderLoop();
  }

  private async persistLevelState(state: LevelState): Promise<void> {
    const key = `level_${state.id}`;
    await worldDb.setChunkData(key, JSON.stringify(state));
  }

  private async loadLevelState(levelId: LevelId): Promise<LevelState | null> {
    const key = `level_${levelId}`;
    const data = await worldDb.getChunkData(key);
    if (data) {
      return JSON.parse(data) as LevelState;
    }
    return null;
  }
}
