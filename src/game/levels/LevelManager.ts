/**
 * LevelManager - Orchestrates level transitions and lifecycle
 *
 * The level system is a linked list where each level knows what comes next.
 * LevelManager handles:
 * - Creating and disposing levels
 * - Transitioning between levels with proper cleanup
 * - Persisting level state to database
 * - Engine render loop management
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { worldDb } from '../db/worldDatabase';
import type {
  CAMPAIGN_LEVELS,
  ILevel,
  LevelCallbacks,
  LevelConfig,
  LevelFactory,
  LevelFactoryRegistry,
  LevelId,
  LevelState,
} from './types';

export interface LevelManagerConfig {
  engine: Engine;
  canvas: HTMLCanvasElement;
  callbacks: LevelCallbacks;
  levelFactories: Partial<LevelFactoryRegistry>;
}

export class LevelManager {
  private engine: Engine;
  private canvas: HTMLCanvasElement;
  private callbacks: LevelCallbacks;
  private factories: Partial<LevelFactoryRegistry>;

  private currentLevel: ILevel | null = null;
  private levelStates: Map<LevelId, LevelState> = new Map();
  private isTransitioning = false;

  // Render loop handle
  private renderLoopHandle: number | null = null;

  constructor(config: LevelManagerConfig) {
    this.engine = config.engine;
    this.canvas = config.canvas;
    this.callbacks = config.callbacks;
    this.factories = config.levelFactories;
  }

  /**
   * Start a level - creates or resumes it
   */
  async startLevel(levelId: LevelId): Promise<void> {
    if (this.isTransitioning) {
      console.warn('Cannot start level while transitioning');
      return;
    }

    this.isTransitioning = true;

    try {
      // Dispose current level if any
      if (this.currentLevel) {
        await this.disposeCurrentLevel();
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
      const level = factory(this.engine, this.canvas, config, this.callbacks);

      // Restore state if we have it
      const savedState = this.levelStates.get(levelId);
      if (savedState) {
        level.setState(savedState);
      }

      // Initialize the level
      await level.initialize();

      // Start render loop for this level's scene
      this.startRenderLoop(level);

      // Update chapter
      this.callbacks.onChapterChange(config.chapter);

      this.currentLevel = level;
      console.log(`Level started: ${levelId}`);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Transition to the next level in the sequence
   */
  async transitionToNext(): Promise<void> {
    if (!this.currentLevel) {
      console.warn('No current level to transition from');
      return;
    }

    const nextLevelId = this.currentLevel.config.nextLevelId;
    if (!nextLevelId) {
      console.log('No next level - campaign complete!');
      this.callbacks.onLevelComplete(null);
      return;
    }

    await this.transitionTo(nextLevelId);
  }

  /**
   * Transition to a specific level
   */
  async transitionTo(levelId: LevelId): Promise<void> {
    if (this.isTransitioning) {
      console.warn('Already transitioning');
      return;
    }

    // Check if transition is allowed
    if (this.currentLevel && !this.currentLevel.canTransitionTo(levelId)) {
      console.warn(`Cannot transition from ${this.currentLevel.id} to ${levelId}`);
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
   */
  async loadSavedStates(): Promise<void> {
    // Load level states from database
    // This would be called on game resume
    // For now, states are in-memory only
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getLevelConfig(levelId: LevelId): LevelConfig | null {
    // Import at runtime to avoid circular deps
    const { CAMPAIGN_LEVELS } = require('./types');
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

  private persistLevelState(state: LevelState): void {
    try {
      const key = `level_${state.id}`;
      worldDb.setChunkData(key, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist level state:', error);
    }
  }

  private async loadLevelState(levelId: LevelId): Promise<LevelState | null> {
    try {
      const key = `level_${levelId}`;
      const data = worldDb.getChunkData(key);
      if (data) {
        return JSON.parse(data) as LevelState;
      }
    } catch (error) {
      console.warn('Failed to load level state:', error);
    }
    return null;
  }
}
