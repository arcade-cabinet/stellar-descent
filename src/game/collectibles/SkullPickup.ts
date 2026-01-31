/**
 * Skull Pickup
 *
 * Creates BabylonJS meshes for skull collectibles in the 3D game world.
 * Each level has one skull hidden in a secret area. The pickup consists
 * of a glowing, rotating skull-like mesh with particle effects and a
 * proximity trigger that fires when the player gets close enough.
 *
 * Integration points:
 * - SecretAreaSystem: skulls are placed in the same secret locations
 * - SkullSystem: discovery callback persists the find
 * - AchievementManager: skull pickups can trigger achievements
 * - AudioManager: plays a unique sound on collection
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';

import { getAchievementManager } from '../achievements';
import { AssetManager } from '../core/AssetManager';
import { getAudioManager } from '../core/AudioManager';
import { getLogger } from '../core/Logger';

const log = getLogger('SkullPickup');
import type { LevelId } from '../levels/types';
import { getSkullSystem, SKULLS, type SkullDefinition, type SkullId } from './SkullSystem';

// ============================================================================
// Constants
// ============================================================================

/** Path to the skull collectible GLB model */
const SKULL_MODEL_PATH = '/assets/models/props/collectibles/alien_artifact.glb';

// ============================================================================
// TYPES
// ============================================================================

/** Position in 3D space */
export interface SkullPosition {
  x: number;
  y: number;
  z: number;
}

/** Callbacks fired by the skull pickup */
export interface SkullPickupCallbacks {
  /** Called when the skull is collected */
  onSkullCollected: (skull: SkullDefinition) => void;
  /** Called for notification display */
  onNotification: (text: string, duration?: number) => void;
}

/** Internal state of a placed skull pickup */
interface SkullPickupState {
  skull: SkullDefinition;
  rootMesh: Mesh;
  modelNode: TransformNode | null;
  light: PointLight;
  particles: ParticleSystem;
  glowLayer: GlowLayer;
  isCollected: boolean;
}

// ============================================================================
// SKULL PICKUP MANAGER
// ============================================================================

/**
 * Manages skull pickup placement and interaction for a single level.
 * Create one instance per level; call update() each frame.
 */
export class SkullPickupManager {
  private scene: Scene;
  private levelId: LevelId;
  private callbacks: SkullPickupCallbacks;
  private pickup: SkullPickupState | null = null;

  /** Proximity distance to trigger collection */
  private readonly COLLECT_DISTANCE = 2.5;
  /** Distance at which the skull becomes brighter as a hint */
  private readonly HINT_DISTANCE = 10.0;

  constructor(scene: Scene, levelId: LevelId, callbacks: SkullPickupCallbacks) {
    this.scene = scene;
    this.levelId = levelId;
    this.callbacks = callbacks;
  }

  /**
   * Place the skull for this level at the specified position.
   * Checks persistence -- if already found, does nothing.
   */
  async placeSkull(position: SkullPosition): Promise<void> {
    // Find which skull belongs in this level
    const skull = this.getSkullForLevel();
    if (!skull) {
      log.info(`No skull assigned to level ${this.levelId}`);
      return;
    }

    // Skip if already found
    const system = getSkullSystem();
    if (system.isFound(skull.id)) {
      log.info(`Skull "${skull.name}" already found, skipping placement`);
      return;
    }

    this.pickup = await this.createPickup(skull, position);
    log.info(
      `Placed "${skull.name}" skull at (${position.x}, ${position.y}, ${position.z})`
    );
  }

  /**
   * Update the pickup -- call each frame.
   * Handles rotation animation and proximity detection.
   */
  update(playerPosition: Vector3, deltaTime: number): void {
    if (!this.pickup || this.pickup.isCollected) return;

    const time = performance.now() * 0.001;

    // --- Rotation animation ---
    this.pickup.rootMesh.rotation.y += deltaTime * 0.8;
    // Gentle vertical bob
    this.pickup.rootMesh.position.y += Math.sin(time * 2) * 0.001;

    // --- Distance-based intensity ---
    const distance = Vector3.Distance(playerPosition, this.pickup.rootMesh.position);
    const proximityFactor = Math.max(
      0,
      Math.min(1, (this.HINT_DISTANCE - distance) / this.HINT_DISTANCE)
    );

    this.pickup.light.intensity = 0.3 + proximityFactor * 0.7;
    this.pickup.particles.emitRate = 5 + proximityFactor * 20;

    // --- Collection check ---
    if (distance <= this.COLLECT_DISTANCE) {
      this.collectSkull();
    }
  }

  /** Dispose of all BabylonJS resources */
  dispose(): void {
    if (!this.pickup) return;

    this.pickup.particles.dispose();
    this.pickup.light.dispose();
    this.pickup.glowLayer.dispose();
    if (this.pickup.modelNode) {
      this.pickup.modelNode.dispose();
    }
    this.pickup.rootMesh.dispose();
    this.pickup = null;
  }

  /** Whether the skull for this level has already been collected */
  isCollected(): boolean {
    return this.pickup?.isCollected ?? true;
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private getSkullForLevel(): SkullDefinition | null {
    for (const skull of Object.values(SKULLS)) {
      if (skull.levelFound === this.levelId) {
        return skull;
      }
    }
    return null;
  }

  private async createPickup(
    skull: SkullDefinition,
    position: SkullPosition
  ): Promise<SkullPickupState> {
    const pos = new Vector3(position.x, position.y, position.z);

    // --- Root transform node (invisible collision mesh -- kept as MeshBuilder for trigger volume) ---
    const rootMesh = MeshBuilder.CreateBox(`skull_root_${skull.id}`, { size: 0.01 }, this.scene);
    rootMesh.position = pos.clone();
    rootMesh.visibility = 0;
    rootMesh.isPickable = false;

    // --- Load and instance the skull GLB model ---
    await AssetManager.loadAssetByPath(SKULL_MODEL_PATH, this.scene);
    const modelNode = AssetManager.createInstanceByPath(
      SKULL_MODEL_PATH,
      `skull_model_${skull.id}`,
      this.scene,
      false,
      'prop'
    );

    if (modelNode) {
      modelNode.parent = rootMesh;
      modelNode.position = Vector3.Zero();
      // Scale the model to fit the pickup size (roughly 0.7 diameter)
      modelNode.scaling = new Vector3(0.35, 0.35, 0.35);
    } else {
      log.warn(`Failed to create model instance for skull "${skull.id}"`);
    }

    // --- Point light ---
    const light = new PointLight(`skull_light_${skull.id}`, pos.clone(), this.scene);
    light.diffuse = new Color3(0.2, 1.0, 0.4);
    light.intensity = 0.5;
    light.range = 8;

    // --- Glow layer ---
    const glowLayer = new GlowLayer(`skull_glow_${skull.id}`, this.scene, {
      blurKernelSize: 32,
    });
    glowLayer.intensity = 0.6;

    // --- Particle system ---
    const particles = this.createParticles(skull.id, pos);

    return {
      skull,
      rootMesh,
      modelNode,
      light,
      particles,
      glowLayer,
      isCollected: false,
    };
  }

  private createParticles(skullId: string, position: Vector3): ParticleSystem {
    const ps = new ParticleSystem(`skull_particles_${skullId}`, 30, this.scene);

    ps.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADJJREFUeNpi/P//PwMDAwMjSICJARdgAhJMeAXQFTAxMOABjCABRiYUBiMjNoUAAQYA3moBBvf5MQgAAAAASUVORK5CYII=',
      this.scene
    );

    ps.emitter = position.clone();
    ps.minEmitBox = new Vector3(-0.3, -0.1, -0.3);
    ps.maxEmitBox = new Vector3(0.3, 0.2, 0.3);

    ps.color1 = new Color4(0.2, 1.0, 0.4, 0.7);
    ps.color2 = new Color4(0.1, 0.8, 0.3, 0.4);
    ps.colorDead = new Color4(0.0, 0.4, 0.1, 0);

    ps.minSize = 0.02;
    ps.maxSize = 0.08;

    ps.minLifeTime = 1.0;
    ps.maxLifeTime = 2.5;

    ps.emitRate = 10;

    ps.gravity = new Vector3(0, 0.8, 0); // Float upward
    ps.direction1 = new Vector3(-0.2, 1, -0.2);
    ps.direction2 = new Vector3(0.2, 1, 0.2);

    ps.minEmitPower = 0.1;
    ps.maxEmitPower = 0.4;

    ps.start();

    return ps;
  }

  private collectSkull(): void {
    if (!this.pickup || this.pickup.isCollected) return;

    this.pickup.isCollected = true;
    const skull = this.pickup.skull;

    // Persist discovery
    const system = getSkullSystem();
    const isNew = system.discoverSkull(skull.id as SkullId);

    if (isNew) {
      // Audio feedback
      getAudioManager().play('secret_found', { volume: 0.8 });

      // Achievement tracking
      getAchievementManager().onSecretFound();

      // Notification
      this.callbacks.onNotification(`SKULL FOUND: ${skull.name}`, 5000);

      // Delayed description
      setTimeout(() => {
        this.callbacks.onNotification(skull.description, 6000);
      }, 2500);

      // Callback
      this.callbacks.onSkullCollected(skull);
    }

    // Collection burst effect
    this.playCollectionEffect();

    // Hide the pickup after effect
    setTimeout(() => {
      this.hidePickup();
    }, 1500);
  }

  private playCollectionEffect(): void {
    if (!this.pickup) return;

    const position = this.pickup.rootMesh.position.clone();

    // Burst particles
    const burst = new ParticleSystem('skull_burst', 120, this.scene);
    burst.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADJJREFUeNpi/P//PwMDAwMjSICJARdgAhJMeAXQFTAxMOABjCABRiYUBiMjNoUAAQYA3moBBvf5MQgAAAAASUVORK5CYII=',
      this.scene
    );

    burst.emitter = position;
    burst.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    burst.maxEmitBox = new Vector3(0.1, 0.1, 0.1);

    burst.color1 = new Color4(0.3, 1.0, 0.5, 1.0);
    burst.color2 = new Color4(0.1, 0.8, 0.3, 0.8);
    burst.colorDead = new Color4(0.0, 0.5, 0.2, 0);

    burst.minSize = 0.08;
    burst.maxSize = 0.2;

    burst.minLifeTime = 0.5;
    burst.maxLifeTime = 1.5;

    burst.emitRate = 0;
    burst.manualEmitCount = 100;

    burst.gravity = new Vector3(0, 2, 0);
    burst.direction1 = new Vector3(-1, 1, -1);
    burst.direction2 = new Vector3(1, 2, 1);

    burst.minEmitPower = 2;
    burst.maxEmitPower = 6;

    burst.start();

    // Flash the light
    if (this.pickup.light) {
      this.pickup.light.intensity = 4.0;
      this.pickup.light.diffuse = new Color3(0.4, 1.0, 0.6);

      const fadeInterval = setInterval(() => {
        if (this.pickup?.light) {
          this.pickup.light.intensity *= 0.85;
          if (this.pickup.light.intensity < 0.05) {
            clearInterval(fadeInterval);
          }
        } else {
          clearInterval(fadeInterval);
        }
      }, 50);
    }

    // Dispose burst after animation
    setTimeout(() => {
      burst.dispose();
    }, 2000);
  }

  private hidePickup(): void {
    if (!this.pickup) return;

    this.pickup.rootMesh.setEnabled(false);
    this.pickup.particles.stop();
    this.pickup.light.setEnabled(false);
  }
}

/**
 * Factory function to create a skull pickup manager for a level
 */
export function createSkullPickupManager(
  scene: Scene,
  levelId: LevelId,
  callbacks: SkullPickupCallbacks
): SkullPickupManager {
  return new SkullPickupManager(scene, levelId, callbacks);
}
