/**
 * Audio Log System
 *
 * Manages audio log collectibles in the game world:
 * - Creates glowing pickup meshes at log locations
 * - Handles player interaction and pickup
 * - Integrates with persistence layer
 * - Provides callbacks for UI notifications
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { getAchievementManager } from '../achievements';
import { AssetManager } from '../core/AssetManager';
import { getAudioManager } from '../core/AudioManager';
import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import { getDiscoveredAudioLogIds, useCollectiblesStore } from '../stores/useCollectiblesStore';
import type { AudioLog } from './audioLogs';
import { getAudioLogsByLevel } from './audioLogs';

const logger = getLogger('AudioLogSystem');

// ============================================================================
// Constants
// ============================================================================

/** Path to the audio log GLB model */
const AUDIO_LOG_MODEL_PATH = '/assets/models/props/collectibles/audio_log.glb';

/** Path to the data pad GLB model (used for the glow ring base) */
const GLOW_RING_MODEL_PATH = '/assets/models/props/collectibles/data_pad.glb';

/**
 * Audio log pickup in the game world
 */
interface AudioLogPickup {
  log: AudioLog;
  meshNode: TransformNode;
  glowNode: TransformNode;
  light: PointLight;
  isCollected: boolean;
}

/**
 * Callbacks for audio log events
 */
export interface AudioLogSystemCallbacks {
  /** Called when an audio log is collected */
  onLogCollected: (log: AudioLog) => void;
  /** Called when player is near a log (for interaction prompt) */
  onNearLog: (log: AudioLog | null, distance: number) => void;
  /** Called for notifications */
  onNotification: (text: string, duration?: number) => void;
}

/**
 * Audio Log System - manages collectible audio logs in a level
 */
export class AudioLogSystem {
  private scene: Scene;
  private levelId: LevelId;
  private callbacks: AudioLogSystemCallbacks;
  private pickups: Map<string, AudioLogPickup> = new Map();
  private glowLayer: GlowLayer | null = null;
  private nearestLog: AudioLogPickup | null = null;

  // Interaction settings
  private readonly PICKUP_DISTANCE = 3.0; // Distance to show interaction prompt
  private readonly COLLECT_DISTANCE = 2.0; // Distance to allow collection

  constructor(scene: Scene, levelId: LevelId, callbacks: AudioLogSystemCallbacks) {
    this.scene = scene;
    this.levelId = levelId;
    this.callbacks = callbacks;

    this.initializeAsync();
  }

  private async initializeAsync(): Promise<void> {
    // Create glow layer for pickups
    this.glowLayer = new GlowLayer('audioLogGlow', this.scene, {
      blurKernelSize: 32,
    });
    this.glowLayer.intensity = 0.5;

    // Pre-load both GLB models
    await Promise.all([
      AssetManager.loadAssetByPath(AUDIO_LOG_MODEL_PATH, this.scene),
      AssetManager.loadAssetByPath(GLOW_RING_MODEL_PATH, this.scene),
    ]);

    // Get audio logs for this level
    const logs = getAudioLogsByLevel(this.levelId);
    const discoveredIds = await getDiscoveredAudioLogIds();

    // Create pickups for undiscovered logs
    for (const log of logs) {
      if (!discoveredIds.includes(log.id)) {
        this.createPickup(log);
      }
    }

    logger.info(`Initialized ${this.pickups.size} audio log pickups for level ${this.levelId}`);
  }

  private createPickup(log: AudioLog): void {
    // Determine position from hint or use default
    const position = log.positionHint
      ? new Vector3(log.positionHint.x, log.positionHint.y, log.positionHint.z)
      : new Vector3(0, 1, 0);

    // Create the main pickup mesh (audio log device) from GLB
    const meshNode = AssetManager.createInstanceByPath(
      AUDIO_LOG_MODEL_PATH,
      `audioLog_${log.id}`,
      this.scene,
      false,
      'prop'
    );

    if (!meshNode) {
      logger.warn(`Failed to create audio log model for "${log.id}"`);
      return;
    }

    meshNode.position = position.clone();
    meshNode.rotation = new Vector3(Math.PI * 0.1, 0, 0); // Slight tilt
    meshNode.scaling = new Vector3(0.3, 0.3, 0.3);

    // Create outer glow ring from data pad GLB
    const glowNode = AssetManager.createInstanceByPath(
      GLOW_RING_MODEL_PATH,
      `audioLogGlow_${log.id}`,
      this.scene,
      false,
      'prop'
    );

    if (!glowNode) {
      logger.warn(`Failed to create glow ring model for "${log.id}"`);
      // Clean up the mesh node since we cannot create the full pickup
      meshNode.dispose();
      return;
    }

    glowNode.position = position.clone();
    glowNode.position.y -= 0.3;
    glowNode.scaling = new Vector3(0.4, 0.05, 0.4);
    glowNode.rotation = new Vector3(Math.PI / 2, 0, 0);

    // Create point light for visibility
    const light = new PointLight(`audioLogLight_${log.id}`, position.clone(), this.scene);
    light.diffuse = new Color3(0.3, 0.6, 1.0);
    light.intensity = 0.5;
    light.range = 5;

    // Store pickup data
    this.pickups.set(log.id, {
      log,
      meshNode,
      glowNode,
      light,
      isCollected: false,
    });
  }

  /**
   * Update the system - call each frame
   * @param playerPosition The player's current position
   */
  update(playerPosition: Vector3): void {
    let nearest: AudioLogPickup | null = null;
    let nearestDistance = Infinity;

    // Check distance to each pickup
    for (const pickup of this.pickups.values()) {
      if (pickup.isCollected) continue;

      const distance = Vector3.Distance(playerPosition, pickup.meshNode.position);

      // Animate the pickup
      this.animatePickup(pickup);

      // Track nearest
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = pickup;
      }
    }

    // Update nearest log state
    if (nearest && nearestDistance < this.PICKUP_DISTANCE) {
      if (this.nearestLog !== nearest) {
        this.nearestLog = nearest;
      }
      this.callbacks.onNearLog(nearest.log, nearestDistance);
    } else if (this.nearestLog) {
      this.nearestLog = null;
      this.callbacks.onNearLog(null, Infinity);
    }
  }

  private animatePickup(pickup: AudioLogPickup): void {
    const time = performance.now() * 0.001;

    // Rotate the glow ring
    pickup.glowNode.rotation = new Vector3(Math.PI / 2, 0, time * 2);

    // Bob the main mesh up and down
    const bob = Math.sin(time * 3) * 0.05;
    pickup.meshNode.position.y = (pickup.log.positionHint?.y ?? 1) + bob + 0.3; // Base height + bob + offset

    // Pulse the light intensity
    pickup.light.intensity = 0.4 + Math.sin(time * 4) * 0.2;
  }

  /**
   * Try to collect the nearest audio log
   * @param playerPosition The player's current position
   * @returns The collected log, or null if none in range
   */
  tryCollect(playerPosition: Vector3): AudioLog | null {
    if (!this.nearestLog) return null;

    const distance = Vector3.Distance(playerPosition, this.nearestLog.meshNode.position);
    if (distance > this.COLLECT_DISTANCE) return null;

    const pickup = this.nearestLog;
    pickup.isCollected = true;

    // Hide the pickup
    pickup.meshNode.setEnabled(false);
    pickup.glowNode.setEnabled(false);
    pickup.light.setEnabled(false);

    // Save to persistence via store
    useCollectiblesStore.getState().addAudioLog(pickup.log.id, this.levelId);

    // Track achievement progress
    getAchievementManager().onAudioLogFound();

    // Play pickup sound
    getAudioManager().play('audio_log_pickup', { volume: 0.5 });

    // Notify
    this.callbacks.onLogCollected(pickup.log);
    this.callbacks.onNotification(`AUDIO LOG FOUND: ${pickup.log.title}`, 3000);

    // Clear nearest
    this.nearestLog = null;
    this.callbacks.onNearLog(null, Infinity);

    return pickup.log;
  }

  /**
   * Check if there's a collectible log near the player
   */
  isNearLog(): boolean {
    return this.nearestLog !== null;
  }

  /**
   * Get the nearest log info (for interaction prompt)
   */
  getNearestLog(): AudioLog | null {
    return this.nearestLog?.log ?? null;
  }

  /**
   * Get count of remaining (uncollected) logs in this level
   */
  getRemainingCount(): number {
    let count = 0;
    for (const pickup of this.pickups.values()) {
      if (!pickup.isCollected) count++;
    }
    return count;
  }

  /**
   * Get total logs for this level
   */
  getTotalCount(): number {
    return getAudioLogsByLevel(this.levelId).length;
  }

  /**
   * Manually mark a log as collected (for loading saved state)
   */
  markCollected(logId: string): void {
    const pickup = this.pickups.get(logId);
    if (pickup && !pickup.isCollected) {
      pickup.isCollected = true;
      pickup.meshNode.setEnabled(false);
      pickup.glowNode.setEnabled(false);
      pickup.light.setEnabled(false);
    }
  }

  /**
   * Reset all pickups (for level restart)
   */
  async reset(): Promise<void> {
    const discoveredIds = await getDiscoveredAudioLogIds();

    for (const pickup of this.pickups.values()) {
      // Only reset if not already discovered in save
      if (!discoveredIds.includes(pickup.log.id)) {
        pickup.isCollected = false;
        pickup.meshNode.setEnabled(true);
        pickup.glowNode.setEnabled(true);
        pickup.light.setEnabled(true);
      }
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    for (const pickup of this.pickups.values()) {
      pickup.meshNode.dispose();
      pickup.glowNode.dispose();
      pickup.light.dispose();
    }
    this.pickups.clear();

    if (this.glowLayer) {
      this.glowLayer.dispose();
      this.glowLayer = null;
    }

    this.nearestLog = null;
  }
}

/**
 * Factory function to create an AudioLogSystem for a level
 */
export function createAudioLogSystem(
  scene: Scene,
  levelId: LevelId,
  callbacks: AudioLogSystemCallbacks
): AudioLogSystem {
  return new AudioLogSystem(scene, levelId, callbacks);
}
