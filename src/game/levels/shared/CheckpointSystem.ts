/**
 * CheckpointSystem - Composable checkpoint/save system for levels
 *
 * Extracted from BaseLevel for composition over inheritance.
 * Manages checkpoints, respawn points, and level state saving.
 *
 * Usage:
 *   const checkpoints = new CheckpointSystem(levelId);
 *   checkpoints.registerCheckpoint('after_bridge', position);
 *   checkpoints.activateCheckpoint('after_bridge');
 *   const respawn = checkpoints.getRespawnPoint();
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { getLogger } from '../../core/Logger';
import { getEventBus } from '../../core/EventBus';
import type { LevelId } from '../types';

const log = getLogger('CheckpointSystem');

export interface Checkpoint {
  id: string;
  position: Vector3;
  rotation: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface CheckpointState {
  activeCheckpointId: string | null;
  health: number;
  armor: number;
  ammo: Record<string, number>;
  objectives: string[];
}

export class CheckpointSystem {
  private levelId: LevelId;
  private checkpoints: Map<string, Checkpoint> = new Map();
  private activeCheckpointId: string | null = null;
  private spawnPoint: Vector3;
  private spawnRotation: number;
  private savedState: CheckpointState | null = null;

  constructor(levelId: LevelId, spawnPoint: Vector3, spawnRotation = 0) {
    this.levelId = levelId;
    this.spawnPoint = spawnPoint.clone();
    this.spawnRotation = spawnRotation;
  }

  /**
   * Register a checkpoint location
   */
  registerCheckpoint(
    id: string,
    position: Vector3,
    rotation = 0,
    metadata?: Record<string, unknown>
  ): void {
    this.checkpoints.set(id, {
      id,
      position: position.clone(),
      rotation,
      isActive: false,
      metadata,
    });
    log.debug(`Checkpoint registered: ${id} at ${position.toString()}`);
  }

  /**
   * Activate a checkpoint (player reached it)
   */
  activateCheckpoint(id: string): boolean {
    const checkpoint = this.checkpoints.get(id);
    if (!checkpoint) {
      log.warn(`Unknown checkpoint: ${id}`);
      return false;
    }

    // Deactivate previous checkpoint
    if (this.activeCheckpointId) {
      const prev = this.checkpoints.get(this.activeCheckpointId);
      if (prev) prev.isActive = false;
    }

    checkpoint.isActive = true;
    this.activeCheckpointId = id;
    log.info(`Checkpoint activated: ${id}`);

    getEventBus().emit({
      type: 'CHECKPOINT_REACHED',
      checkpointId: id,
    });

    return true;
  }

  /**
   * Get the current respawn point (active checkpoint or spawn)
   */
  getRespawnPoint(): { position: Vector3; rotation: number } {
    if (this.activeCheckpointId) {
      const checkpoint = this.checkpoints.get(this.activeCheckpointId);
      if (checkpoint) {
        return {
          position: checkpoint.position.clone(),
          rotation: checkpoint.rotation,
        };
      }
    }

    return {
      position: this.spawnPoint.clone(),
      rotation: this.spawnRotation,
    };
  }

  /**
   * Save current game state at checkpoint
   */
  saveState(state: Omit<CheckpointState, 'activeCheckpointId'>): void {
    this.savedState = {
      ...state,
      activeCheckpointId: this.activeCheckpointId,
    };
    log.debug('Checkpoint state saved');
  }

  /**
   * Load saved state (for respawn)
   */
  loadState(): CheckpointState | null {
    return this.savedState ? { ...this.savedState } : null;
  }

  /**
   * Check if player is near a checkpoint
   */
  checkProximity(playerPosition: Vector3, activationRadius = 2.0): string | null {
    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.isActive) continue; // Skip already active

      const distance = Vector3.Distance(playerPosition, checkpoint.position);
      if (distance <= activationRadius) {
        return id;
      }
    }
    return null;
  }

  /**
   * Get all checkpoint IDs
   */
  getCheckpointIds(): string[] {
    return Array.from(this.checkpoints.keys());
  }

  /**
   * Get active checkpoint ID
   */
  getActiveCheckpointId(): string | null {
    return this.activeCheckpointId;
  }

  /**
   * Reset to initial state (for level restart)
   */
  reset(): void {
    for (const checkpoint of this.checkpoints.values()) {
      checkpoint.isActive = false;
    }
    this.activeCheckpointId = null;
    this.savedState = null;
  }

  dispose(): void {
    this.checkpoints.clear();
    this.savedState = null;
  }
}
