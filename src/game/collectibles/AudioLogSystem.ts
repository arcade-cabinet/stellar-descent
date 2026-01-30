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
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import { getAchievementManager } from '../achievements';
import { getAudioManager } from '../core/AudioManager';
import type { LevelId } from '../levels/types';
import { addDiscoveredAudioLog, getDiscoveredAudioLogIds } from './audioLogPersistence';
import type { AudioLog } from './audioLogs';
import { getAudioLogsByLevel } from './audioLogs';

/**
 * Audio log pickup in the game world
 */
interface AudioLogPickup {
  log: AudioLog;
  mesh: Mesh;
  glowMesh: Mesh;
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

    this.initialize();
  }

  private initialize(): void {
    // Create glow layer for pickups
    this.glowLayer = new GlowLayer('audioLogGlow', this.scene, {
      blurKernelSize: 32,
    });
    this.glowLayer.intensity = 0.5;

    // Get audio logs for this level
    const logs = getAudioLogsByLevel(this.levelId);
    const discoveredIds = getDiscoveredAudioLogIds();

    // Create pickups for undiscovered logs
    for (const log of logs) {
      if (!discoveredIds.includes(log.id)) {
        this.createPickup(log);
      }
    }

    console.log(
      `[AudioLogSystem] Initialized ${this.pickups.size} audio log pickups for level ${this.levelId}`
    );
  }

  private createPickup(log: AudioLog): void {
    // Determine position from hint or use default
    const position = log.positionHint
      ? new Vector3(log.positionHint.x, log.positionHint.y, log.positionHint.z)
      : new Vector3(0, 1, 0);

    // Create the main pickup mesh (data pad / audio device)
    const mesh = MeshBuilder.CreateBox(
      `audioLog_${log.id}`,
      {
        width: 0.3,
        height: 0.05,
        depth: 0.2,
      },
      this.scene
    );
    mesh.position = position.clone();
    mesh.rotation.x = Math.PI * 0.1; // Slight tilt

    // Create material with emissive glow
    const material = new StandardMaterial(`audioLogMat_${log.id}`, this.scene);
    material.diffuseColor = new Color3(0.1, 0.1, 0.15);
    material.emissiveColor = new Color3(0.2, 0.6, 1.0); // Blue glow
    material.specularColor = new Color3(0.5, 0.5, 0.5);
    mesh.material = material;

    // Create outer glow ring
    const glowMesh = MeshBuilder.CreateTorus(
      `audioLogGlow_${log.id}`,
      {
        diameter: 0.8,
        thickness: 0.05,
        tessellation: 24,
      },
      this.scene
    );
    glowMesh.position = position.clone();
    glowMesh.position.y -= 0.3;
    glowMesh.rotation.x = Math.PI / 2;

    const glowMaterial = new StandardMaterial(`audioLogGlowMat_${log.id}`, this.scene);
    glowMaterial.emissiveColor = new Color3(0.3, 0.7, 1.0);
    glowMaterial.alpha = 0.6;
    glowMesh.material = glowMaterial;

    // Add to glow layer
    if (this.glowLayer) {
      this.glowLayer.addIncludedOnlyMesh(mesh);
      this.glowLayer.addIncludedOnlyMesh(glowMesh);
    }

    // Create point light for visibility
    const light = new PointLight(`audioLogLight_${log.id}`, position.clone(), this.scene);
    light.diffuse = new Color3(0.3, 0.6, 1.0);
    light.intensity = 0.5;
    light.range = 5;

    // Store pickup data
    this.pickups.set(log.id, {
      log,
      mesh,
      glowMesh,
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

      const distance = Vector3.Distance(playerPosition, pickup.mesh.position);

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
    pickup.glowMesh.rotation.z = time * 2;

    // Bob the main mesh up and down
    const bob = Math.sin(time * 3) * 0.05;
    pickup.mesh.position.y = (pickup.log.positionHint?.y ?? 1) + bob + 0.3; // Base height + bob + offset

    // Pulse the light intensity
    pickup.light.intensity = 0.4 + Math.sin(time * 4) * 0.2;

    // Pulse the material emission
    const material = pickup.mesh.material as StandardMaterial;
    const pulse = 0.5 + Math.sin(time * 4) * 0.3;
    material.emissiveColor = new Color3(0.2 * pulse, 0.6 * pulse, 1.0 * pulse);
  }

  /**
   * Try to collect the nearest audio log
   * @param playerPosition The player's current position
   * @returns The collected log, or null if none in range
   */
  tryCollect(playerPosition: Vector3): AudioLog | null {
    if (!this.nearestLog) return null;

    const distance = Vector3.Distance(playerPosition, this.nearestLog.mesh.position);
    if (distance > this.COLLECT_DISTANCE) return null;

    const pickup = this.nearestLog;
    pickup.isCollected = true;

    // Hide the pickup
    pickup.mesh.setEnabled(false);
    pickup.glowMesh.setEnabled(false);
    pickup.light.setEnabled(false);

    // Save to persistence
    addDiscoveredAudioLog(pickup.log.id, this.levelId);

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
      pickup.mesh.setEnabled(false);
      pickup.glowMesh.setEnabled(false);
      pickup.light.setEnabled(false);
    }
  }

  /**
   * Reset all pickups (for level restart)
   */
  reset(): void {
    const discoveredIds = getDiscoveredAudioLogIds();

    for (const pickup of this.pickups.values()) {
      // Only reset if not already discovered in save
      if (!discoveredIds.includes(pickup.log.id)) {
        pickup.isCollected = false;
        pickup.mesh.setEnabled(true);
        pickup.glowMesh.setEnabled(true);
        pickup.light.setEnabled(true);
      }
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    for (const pickup of this.pickups.values()) {
      pickup.mesh.dispose();
      pickup.glowMesh.dispose();
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
