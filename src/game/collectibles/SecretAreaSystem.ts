/**
 * Secret Area System
 *
 * Manages secret area collectibles in the game world:
 * - Creates trigger zones at secret locations
 * - Visual hints (subtle glow, particles) based on difficulty
 * - Handles player proximity detection
 * - Integrates with persistence layer
 * - Provides rewards when discovered
 * - Audio/visual feedback on discovery
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

import { getAchievementManager } from '../achievements';
import { getAudioManager } from '../core/AudioManager';
import type { LevelId } from '../levels/types';
import { addDiscoveredSecret, getDiscoveredSecretIds } from './secretPersistence';
import type { SecretArea, SecretReward } from './secrets';
import { getSecretsByLevel } from './secrets';

/**
 * Secret area pickup state in the game world
 */
interface SecretAreaPickup {
  secret: SecretArea;
  triggerZone: Mesh;
  hintMesh: Mesh | null;
  hintLight: PointLight | null;
  particles: ParticleSystem | null;
  isDiscovered: boolean;
}

/**
 * Callbacks for secret area events
 */
export interface SecretAreaSystemCallbacks {
  /** Called when a secret area is discovered */
  onSecretDiscovered: (secret: SecretArea) => void;
  /** Called when player is near a secret (for hint display) */
  onNearSecret: (secret: SecretArea | null, distance: number) => void;
  /** Called for notifications */
  onNotification: (text: string, duration?: number) => void;
  /** Called to apply rewards (health, ammo, etc.) */
  onApplyReward: (reward: SecretReward) => void;
}

/**
 * Secret Area System - manages hidden secrets in a level
 */
export class SecretAreaSystem {
  private scene: Scene;
  private levelId: LevelId;
  private callbacks: SecretAreaSystemCallbacks;
  private pickups: Map<string, SecretAreaPickup> = new Map();
  private glowLayer: GlowLayer | null = null;
  private nearestSecret: SecretAreaPickup | null = null;

  // Interaction settings
  private readonly HINT_DISTANCE = 12.0; // Distance to show subtle hint
  private readonly DISCOVER_DISTANCE = 2.5; // Distance to trigger discovery

  // Visual settings by difficulty (1=easy to see, 3=hard to find)
  private readonly HINT_SETTINGS = {
    1: { glowIntensity: 0.8, particleCount: 20, lightIntensity: 0.6 },
    2: { glowIntensity: 0.4, particleCount: 10, lightIntensity: 0.3 },
    3: { glowIntensity: 0.15, particleCount: 4, lightIntensity: 0.1 },
  };

  constructor(scene: Scene, levelId: LevelId, callbacks: SecretAreaSystemCallbacks) {
    this.scene = scene;
    this.levelId = levelId;
    this.callbacks = callbacks;

    this.initialize();
  }

  private initialize(): void {
    // Create glow layer for hints
    this.glowLayer = new GlowLayer('secretGlow', this.scene, {
      blurKernelSize: 48,
    });
    this.glowLayer.intensity = 0.3;

    // Get secrets for this level
    const secrets = getSecretsByLevel(this.levelId);
    const discoveredIds = getDiscoveredSecretIds();

    // Create pickups for undiscovered secrets
    for (const secret of secrets) {
      if (!discoveredIds.includes(secret.id)) {
        this.createSecretPickup(secret);
      }
    }

    console.log(
      `[SecretAreaSystem] Initialized ${this.pickups.size} secret areas for level ${this.levelId}`
    );
  }

  private createSecretPickup(secret: SecretArea): void {
    const position = new Vector3(secret.position.x, secret.position.y, secret.position.z);
    const settings = this.HINT_SETTINGS[secret.difficulty];

    // Create invisible trigger zone
    const triggerZone = MeshBuilder.CreateSphere(
      `secret_trigger_${secret.id}`,
      { diameter: secret.triggerRadius * 2 },
      this.scene
    );
    triggerZone.position = position.clone();
    triggerZone.visibility = 0; // Invisible
    triggerZone.isPickable = false;

    // Create hint mesh based on hint type
    const hintMesh = this.createHintMesh(secret, position, settings);

    // Create hint light (subtle ambient glow)
    const hintLight = new PointLight(`secret_light_${secret.id}`, position.clone(), this.scene);
    hintLight.diffuse = new Color3(1.0, 0.8, 0.3); // Golden hint
    hintLight.intensity = settings.lightIntensity;
    hintLight.range = secret.triggerRadius * 3;

    // Create particle system for subtle hint
    const particles = this.createHintParticles(secret, position, settings);

    // Store pickup data
    this.pickups.set(secret.id, {
      secret,
      triggerZone,
      hintMesh,
      hintLight,
      particles,
      isDiscovered: false,
    });
  }

  private createHintMesh(
    secret: SecretArea,
    position: Vector3,
    settings: { glowIntensity: number }
  ): Mesh | null {
    let mesh: Mesh | null = null;

    // Create different hint meshes based on type
    switch (secret.hintType) {
      case 'crack':
        // Subtle crack marking
        mesh = MeshBuilder.CreatePlane(
          `secret_hint_${secret.id}`,
          { width: 0.5, height: 1.0 },
          this.scene
        );
        mesh.position = position.clone();
        mesh.position.y -= 0.3;
        break;

      case 'vent':
        // Small grate/vent indicator
        mesh = MeshBuilder.CreateBox(
          `secret_hint_${secret.id}`,
          { width: 0.8, height: 0.1, depth: 0.8 },
          this.scene
        );
        mesh.position = position.clone();
        mesh.position.y -= 0.8;
        break;

      case 'hidden_door':
        // Subtle seam line
        mesh = MeshBuilder.CreateBox(
          `secret_hint_${secret.id}`,
          { width: 0.05, height: 2.0, depth: 0.05 },
          this.scene
        );
        mesh.position = position.clone();
        break;

      case 'platform':
      case 'tunnel':
      case 'alcove':
        // Generic small orb hint
        mesh = MeshBuilder.CreateSphere(
          `secret_hint_${secret.id}`,
          { diameter: 0.15 },
          this.scene
        );
        mesh.position = position.clone();
        break;

      case 'environmental':
        // Small marker on ground
        mesh = MeshBuilder.CreateDisc(
          `secret_hint_${secret.id}`,
          { radius: 0.3, tessellation: 12 },
          this.scene
        );
        mesh.position = position.clone();
        mesh.position.y = 0.01; // Just above ground
        mesh.rotation.x = Math.PI / 2;
        break;
    }

    if (mesh) {
      // Create subtle emissive material
      const material = new StandardMaterial(`secret_hint_mat_${secret.id}`, this.scene);
      material.diffuseColor = new Color3(0.1, 0.1, 0.1);
      material.emissiveColor = new Color3(0.6, 0.4, 0.1); // Golden glow
      material.alpha = Math.min(0.8, settings.glowIntensity + 0.2);
      mesh.material = material;

      // Add to glow layer
      if (this.glowLayer) {
        this.glowLayer.addIncludedOnlyMesh(mesh);
        this.glowLayer.customEmissiveColorSelector = (
          _mesh,
          _subMesh,
          _material,
          result
        ) => {
          result.set(0.8, 0.6, 0.2, settings.glowIntensity);
        };
      }
    }

    return mesh;
  }

  private createHintParticles(
    secret: SecretArea,
    position: Vector3,
    settings: { particleCount: number }
  ): ParticleSystem | null {
    if (settings.particleCount <= 0) return null;

    const particleSystem = new ParticleSystem(
      `secret_particles_${secret.id}`,
      settings.particleCount,
      this.scene
    );

    // Use a simple texture (default particle)
    particleSystem.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADJJREFUeNpi/P//PwMDAwMjSICJARdgAhJMeAXQFTAxMOABjCABRiYUBiMjNoUAAQYA3moBBvf5MQgAAAAASUVORK5CYII=',
      this.scene
    );

    particleSystem.emitter = position.clone();
    particleSystem.minEmitBox = new Vector3(-0.5, 0, -0.5);
    particleSystem.maxEmitBox = new Vector3(0.5, 0.3, 0.5);

    particleSystem.color1 = new Color3(1.0, 0.8, 0.3).toColor4(0.6);
    particleSystem.color2 = new Color3(1.0, 0.6, 0.1).toColor4(0.3);
    particleSystem.colorDead = new Color3(0.5, 0.3, 0.1).toColor4(0);

    particleSystem.minSize = 0.02;
    particleSystem.maxSize = 0.08;

    particleSystem.minLifeTime = 1.5;
    particleSystem.maxLifeTime = 3.0;

    particleSystem.emitRate = settings.particleCount / 2;

    particleSystem.gravity = new Vector3(0, 0.5, 0); // Float upward
    particleSystem.direction1 = new Vector3(-0.1, 1, -0.1);
    particleSystem.direction2 = new Vector3(0.1, 1, 0.1);

    particleSystem.minEmitPower = 0.1;
    particleSystem.maxEmitPower = 0.3;

    particleSystem.start();

    return particleSystem;
  }

  /**
   * Update the system - call each frame
   * @param playerPosition The player's current position
   */
  update(playerPosition: Vector3): void {
    let nearest: SecretAreaPickup | null = null;
    let nearestDistance = Infinity;

    // Check distance to each pickup
    for (const pickup of this.pickups.values()) {
      if (pickup.isDiscovered) continue;

      const distance = Vector3.Distance(playerPosition, pickup.triggerZone.position);

      // Animate hint based on distance
      this.animateHint(pickup, distance);

      // Track nearest
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = pickup;
      }
    }

    // Check for discovery
    if (nearest && nearestDistance <= this.DISCOVER_DISTANCE) {
      this.discoverSecret(nearest);
    }

    // Update nearest secret state (for hint text)
    if (nearest && nearestDistance < this.HINT_DISTANCE) {
      if (this.nearestSecret !== nearest) {
        this.nearestSecret = nearest;
      }
      this.callbacks.onNearSecret(nearest.secret, nearestDistance);
    } else if (this.nearestSecret) {
      this.nearestSecret = null;
      this.callbacks.onNearSecret(null, Infinity);
    }
  }

  private animateHint(pickup: SecretAreaPickup, distance: number): void {
    const time = performance.now() * 0.001;
    const settings = this.HINT_SETTINGS[pickup.secret.difficulty];

    // Calculate visibility factor based on distance (fades in as player approaches)
    const visibilityFactor = Math.max(
      0,
      Math.min(1, (this.HINT_DISTANCE - distance) / this.HINT_DISTANCE)
    );

    // Animate hint mesh
    if (pickup.hintMesh) {
      // Pulse the emission
      const pulse = 0.5 + Math.sin(time * 2) * 0.3;
      const material = pickup.hintMesh.material as StandardMaterial;
      if (material) {
        const baseIntensity = settings.glowIntensity * visibilityFactor;
        material.emissiveColor = new Color3(
          0.6 * pulse * baseIntensity,
          0.4 * pulse * baseIntensity,
          0.1 * pulse * baseIntensity
        );
        material.alpha = Math.min(0.8, baseIntensity + 0.1);
      }
    }

    // Animate light
    if (pickup.hintLight) {
      const basePulse = 0.8 + Math.sin(time * 3) * 0.2;
      pickup.hintLight.intensity = settings.lightIntensity * basePulse * visibilityFactor;
    }

    // Adjust particle rate based on distance
    if (pickup.particles) {
      pickup.particles.emitRate = (settings.particleCount / 2) * visibilityFactor;
    }
  }

  private discoverSecret(pickup: SecretAreaPickup): void {
    if (pickup.isDiscovered) return;

    pickup.isDiscovered = true;

    // Save to persistence
    addDiscoveredSecret(pickup.secret.id, this.levelId);

    // Track achievement progress
    getAchievementManager().onSecretFound();

    // Play discovery sound
    getAudioManager().play('secret_found', { volume: 0.7 });

    // Create discovery effect
    this.playDiscoveryEffect(pickup);

    // Apply rewards
    for (const reward of pickup.secret.rewards) {
      this.callbacks.onApplyReward(reward);

      // Show reward notification
      this.callbacks.onNotification(reward.description, 2000);
    }

    // Main notification
    this.callbacks.onNotification(`SECRET FOUND: ${pickup.secret.name}`, 4000);

    // Show lore if available
    if (pickup.secret.loreText) {
      setTimeout(() => {
        this.callbacks.onNotification(pickup.secret.loreText!, 5000);
      }, 2000);
    }

    // Notify callback
    this.callbacks.onSecretDiscovered(pickup.secret);

    // Hide the pickup visuals after effect
    setTimeout(() => {
      this.hidePickup(pickup);
    }, 1500);
  }

  private playDiscoveryEffect(pickup: SecretAreaPickup): void {
    const position = pickup.triggerZone.position.clone();

    // Create burst particle effect
    const burstParticles = new ParticleSystem('secret_burst', 100, this.scene);
    burstParticles.particleTexture = new Texture(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADJJREFUeNpi/P//PwMDAwMjSICJARdgAhJMeAXQFTAxMOABjCABRiYUBiMjNoUAAQYA3moBBvf5MQgAAAAASUVORK5CYII=',
      this.scene
    );

    burstParticles.emitter = position;
    burstParticles.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    burstParticles.maxEmitBox = new Vector3(0.1, 0.1, 0.1);

    burstParticles.color1 = new Color3(1.0, 0.9, 0.4).toColor4(1.0);
    burstParticles.color2 = new Color3(1.0, 0.7, 0.2).toColor4(0.8);
    burstParticles.colorDead = new Color3(1.0, 0.5, 0.1).toColor4(0);

    burstParticles.minSize = 0.1;
    burstParticles.maxSize = 0.25;

    burstParticles.minLifeTime = 0.5;
    burstParticles.maxLifeTime = 1.5;

    burstParticles.emitRate = 0; // Manual emit
    burstParticles.manualEmitCount = 80;

    burstParticles.gravity = new Vector3(0, 2, 0);
    burstParticles.direction1 = new Vector3(-1, 1, -1);
    burstParticles.direction2 = new Vector3(1, 2, 1);

    burstParticles.minEmitPower = 2;
    burstParticles.maxEmitPower = 5;

    burstParticles.start();

    // Dispose after animation
    setTimeout(() => {
      burstParticles.dispose();
    }, 2000);

    // Flash the hint light brightly
    if (pickup.hintLight) {
      const originalIntensity = pickup.hintLight.intensity;
      pickup.hintLight.intensity = 3.0;
      pickup.hintLight.diffuse = new Color3(1.0, 1.0, 0.8);

      // Fade out
      const fadeInterval = setInterval(() => {
        if (pickup.hintLight) {
          pickup.hintLight.intensity *= 0.85;
          if (pickup.hintLight.intensity < 0.05) {
            clearInterval(fadeInterval);
          }
        }
      }, 50);
    }
  }

  private hidePickup(pickup: SecretAreaPickup): void {
    if (pickup.hintMesh) {
      pickup.hintMesh.setEnabled(false);
    }
    if (pickup.hintLight) {
      pickup.hintLight.setEnabled(false);
    }
    if (pickup.particles) {
      pickup.particles.stop();
    }
    pickup.triggerZone.setEnabled(false);
  }

  /**
   * Check if there's an undiscovered secret nearby
   */
  isNearSecret(): boolean {
    return this.nearestSecret !== null && !this.nearestSecret.isDiscovered;
  }

  /**
   * Get the nearest secret info (for hint display)
   */
  getNearestSecret(): SecretArea | null {
    return this.nearestSecret?.secret ?? null;
  }

  /**
   * Get count of remaining (undiscovered) secrets in this level
   */
  getRemainingCount(): number {
    let count = 0;
    for (const pickup of this.pickups.values()) {
      if (!pickup.isDiscovered) count++;
    }
    return count;
  }

  /**
   * Get total secrets for this level
   */
  getTotalCount(): number {
    return getSecretsByLevel(this.levelId).length;
  }

  /**
   * Get discovered count for this level
   */
  getDiscoveredCount(): number {
    return this.getTotalCount() - this.getRemainingCount();
  }

  /**
   * Manually mark a secret as discovered (for loading saved state)
   */
  markDiscovered(secretId: string): void {
    const pickup = this.pickups.get(secretId);
    if (pickup && !pickup.isDiscovered) {
      pickup.isDiscovered = true;
      this.hidePickup(pickup);
    }
  }

  /**
   * Reset all pickups (for level restart)
   */
  reset(): void {
    const discoveredIds = getDiscoveredSecretIds();

    for (const pickup of this.pickups.values()) {
      // Only reset if not already discovered in save
      if (!discoveredIds.includes(pickup.secret.id)) {
        pickup.isDiscovered = false;
        if (pickup.hintMesh) pickup.hintMesh.setEnabled(true);
        if (pickup.hintLight) pickup.hintLight.setEnabled(true);
        if (pickup.particles) pickup.particles.start();
        pickup.triggerZone.setEnabled(true);
      }
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    for (const pickup of this.pickups.values()) {
      pickup.triggerZone.dispose();
      if (pickup.hintMesh) pickup.hintMesh.dispose();
      if (pickup.hintLight) pickup.hintLight.dispose();
      if (pickup.particles) pickup.particles.dispose();
    }
    this.pickups.clear();

    if (this.glowLayer) {
      this.glowLayer.dispose();
      this.glowLayer = null;
    }

    this.nearestSecret = null;
  }
}

/**
 * Factory function to create a SecretAreaSystem for a level
 */
export function createSecretAreaSystem(
  scene: Scene,
  levelId: LevelId,
  callbacks: SecretAreaSystemCallbacks
): SecretAreaSystem {
  return new SecretAreaSystem(scene, levelId, callbacks);
}
