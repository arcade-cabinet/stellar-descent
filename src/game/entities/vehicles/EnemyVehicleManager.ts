/**
 * EnemyVehicleManager - Spawns and manages enemy vehicles in levels.
 *
 * Responsibilities:
 *   - Vehicle lifecycle: spawn, update, destroy, dispose.
 *   - Health/damage routing (including weak-point detection).
 *   - Destruction effects (explosion, debris particles).
 *   - Factory methods for each vehicle type.
 *   - Extensible: future vehicle types (Ghost, Banshee) plug in here.
 *
 * Usage in a level:
 *   const manager = new EnemyVehicleManager(scene);
 *   manager.spawnWraith(position, waypoints);
 *   // In level update:
 *   manager.update(dt, playerPos, playerVelocity);
 *   // On level dispose:
 *   manager.dispose();
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import type { DifficultyLevel } from '../../core/DifficultySettings';
import { getAudioManager } from '../../core/AudioManager';
import { removeEntity } from '../../core/ecs';
import { particleManager } from '../../effects/ParticleManager';
import { deathEffects } from '../../effects/DeathEffects';
import {
  WraithAI,
  type WraithConfig,
  type WraithWaypoint,
} from './WraithAI';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

/** Supported vehicle types (extensible) */
export type VehicleType = 'wraith';

/** Common interface for any managed vehicle */
export interface ManagedVehicle {
  id: string;
  type: VehicleType;
  ai: WraithAI; // Union with future vehicle AIs
  isActive: boolean;
}

/** Options for spawning a Wraith */
export interface SpawnWraithOptions {
  position: Vector3;
  waypoints?: WraithWaypoint[];
  config?: Partial<WraithConfig>;
  difficulty?: DifficultyLevel;
}

// ----------------------------------------------------------------------------
// Manager
// ----------------------------------------------------------------------------

export class EnemyVehicleManager {
  private scene: Scene;
  private vehicles: Map<string, ManagedVehicle> = new Map();

  // Callbacks
  private onVehicleDestroyed: ((vehicle: ManagedVehicle) => void) | null = null;
  private onScreenShake: ((intensity: number) => void) | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /**
   * Set callback invoked when a managed vehicle is destroyed.
   * Useful for awarding XP, updating objectives, etc.
   */
  setOnVehicleDestroyed(callback: (vehicle: ManagedVehicle) => void): void {
    this.onVehicleDestroyed = callback;
  }

  /**
   * Set callback for screen shake (forwarded to vehicle AIs).
   */
  setOnScreenShake(callback: (intensity: number) => void): void {
    this.onScreenShake = callback;
    // Propagate to existing vehicles
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.type === 'wraith') {
        vehicle.ai.onScreenShake = callback;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Factory Methods
  // --------------------------------------------------------------------------

  /**
   * Spawn a Wraith hover tank at the given position.
   *
   * @returns The WraithAI instance for advanced control (optional).
   */
  spawnWraith(options: SpawnWraithOptions): WraithAI {
    const { position, waypoints, config, difficulty } = options;

    const wraith = new WraithAI(
      this.scene,
      position,
      waypoints ?? [],
      config ?? {},
      difficulty
    );

    // Wire callbacks
    wraith.onScreenShake = this.onScreenShake;
    wraith.onDestroyed = (w) => this.handleVehicleDestroyed(w.id);

    const managed: ManagedVehicle = {
      id: wraith.id,
      type: 'wraith',
      ai: wraith,
      isActive: true,
    };

    this.vehicles.set(wraith.id, managed);

    console.log(
      `[EnemyVehicleManager] Spawned wraith ${wraith.id} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`
    );

    return wraith;
  }

  // --------------------------------------------------------------------------
  // Update
  // --------------------------------------------------------------------------

  /**
   * Update all managed vehicles.
   * Call once per frame from the level's updateLevel method.
   *
   * @param deltaTime       - Frame delta in seconds.
   * @param playerPos       - Current player world position.
   * @param playerVelocity  - Current player velocity (for prediction).
   */
  update(
    deltaTime: number,
    playerPos: Vector3 | null,
    playerVelocity: Vector3 = Vector3.Zero()
  ): void {
    for (const vehicle of this.vehicles.values()) {
      if (!vehicle.isActive) continue;

      switch (vehicle.type) {
        case 'wraith':
          vehicle.ai.update(deltaTime, playerPos, playerVelocity);
          break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Damage Routing
  // --------------------------------------------------------------------------

  /**
   * Apply damage to a specific vehicle by entity ID.
   *
   * @param entityId - The ECS entity id of the vehicle.
   * @param amount   - Base damage amount.
   * @param hitPos   - World position of the hit (for weak-point detection).
   * @returns Actual damage dealt, or 0 if vehicle not found.
   */
  applyDamageToVehicle(entityId: string, amount: number, hitPos?: Vector3): number {
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.ai.entity.id === entityId) {
        return vehicle.ai.applyDamage(amount, hitPos);
      }
    }
    return 0;
  }

  /**
   * Check if a given entity ID belongs to a managed vehicle.
   */
  isVehicleEntity(entityId: string): boolean {
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.ai.entity.id === entityId) return true;
    }
    return false;
  }

  /**
   * Get a managed vehicle by its wraith ID.
   */
  getVehicle(wraithId: string): ManagedVehicle | undefined {
    return this.vehicles.get(wraithId);
  }

  /**
   * Get a managed vehicle by its ECS entity ID.
   */
  getVehicleByEntityId(entityId: string): ManagedVehicle | undefined {
    for (const vehicle of this.vehicles.values()) {
      if (vehicle.ai.entity.id === entityId) return vehicle;
    }
    return undefined;
  }

  /**
   * Get all active vehicles.
   */
  getActiveVehicles(): ManagedVehicle[] {
    return Array.from(this.vehicles.values()).filter((v) => v.isActive);
  }

  /**
   * Get count of active vehicles.
   */
  get activeCount(): number {
    let count = 0;
    for (const v of this.vehicles.values()) {
      if (v.isActive) count++;
    }
    return count;
  }

  // --------------------------------------------------------------------------
  // Destruction
  // --------------------------------------------------------------------------

  private handleVehicleDestroyed(wraithId: string): void {
    const vehicle = this.vehicles.get(wraithId);
    if (!vehicle || !vehicle.isActive) return;

    vehicle.isActive = false;

    console.log(`[EnemyVehicleManager] Vehicle ${wraithId} destroyed`);

    // Play destruction effects
    const position = vehicle.ai.position;
    this.playVehicleDestructionEffects(position);

    // Notify external listeners
    if (this.onVehicleDestroyed) {
      this.onVehicleDestroyed(vehicle);
    }

    // Screen shake for destruction
    if (this.onScreenShake) {
      this.onScreenShake(8);
    }

    // Delay full disposal to let effects play
    window.setTimeout(() => {
      vehicle.ai.dispose();
    }, 2500);
  }

  /**
   * Play explosion and debris effects for a destroyed vehicle.
   */
  private playVehicleDestructionEffects(position: Vector3): void {
    // Large explosion sound
    try {
      getAudioManager().play('explosion', { volume: 0.9 });
    } catch {
      // Audio not available
    }

    // Use death effects system for mechanical destruction
    try {
      deathEffects.playMechanicalDeath(position, 3.0);
    } catch {
      // Death effects may not be initialised
    }

    // Additional particle burst
    try {
      particleManager.emitExplosion(position, 3.0);
    } catch {
      // Particle manager may not be initialised
    }

    // Large multi-stage explosion mesh effect
    this.createVehicleExplosion(position);
  }

  /**
   * Multi-stage explosion for vehicle destruction.
   * Stage 1: Primary fireball.
   * Stage 2: Secondary explosion (delayed 200ms).
   * Stage 3: Smoke column (delayed 400ms).
   */
  private createVehicleExplosion(position: Vector3): void {
    // --- Stage 1: Primary fireball ---
    const primary = MeshBuilder.CreateSphere('vex_primary', { diameter: 5 }, this.scene);
    primary.position = position.clone();
    primary.position.y += 1;

    const primaryMat = new StandardMaterial('vex_primaryMat', this.scene);
    primaryMat.emissiveColor = Color3.FromHexString('#FFAA33');
    primaryMat.disableLighting = true;
    primary.material = primaryMat;

    const primaryStart = performance.now();
    const animatePrimary = () => {
      const elapsed = performance.now() - primaryStart;
      const progress = Math.min(elapsed / 600, 1);
      primary.scaling.setAll(1 + progress * 4);
      primaryMat.alpha = 1 - progress;
      if (progress < 1) {
        requestAnimationFrame(animatePrimary);
      } else {
        primary.dispose();
        primaryMat.dispose();
      }
    };
    requestAnimationFrame(animatePrimary);

    // --- Stage 2: Secondary explosion ---
    window.setTimeout(() => {
      const secondary = MeshBuilder.CreateSphere('vex_secondary', { diameter: 3 }, this.scene);
      secondary.position = position.clone();
      secondary.position.y += 3;
      secondary.position.x += (Math.random() - 0.5) * 3;

      const secondaryMat = new StandardMaterial('vex_secondaryMat', this.scene);
      secondaryMat.emissiveColor = Color3.FromHexString('#FF6622');
      secondaryMat.disableLighting = true;
      secondary.material = secondaryMat;

      const secStart = performance.now();
      const animateSecondary = () => {
        const elapsed = performance.now() - secStart;
        const progress = Math.min(elapsed / 500, 1);
        secondary.scaling.setAll(1 + progress * 3);
        secondaryMat.alpha = 0.8 * (1 - progress);
        if (progress < 1) {
          requestAnimationFrame(animateSecondary);
        } else {
          secondary.dispose();
          secondaryMat.dispose();
        }
      };
      requestAnimationFrame(animateSecondary);

      try {
        getAudioManager().play('explosion', { volume: 0.5 });
      } catch {
        // Audio not available
      }
    }, 200);

    // --- Stage 3: Smoke column ---
    window.setTimeout(() => {
      const smoke = MeshBuilder.CreateCylinder(
        'vex_smoke',
        { height: 8, diameterTop: 6, diameterBottom: 3, tessellation: 12 },
        this.scene
      );
      smoke.position = position.clone();
      smoke.position.y += 4;

      const smokeMat = new StandardMaterial('vex_smokeMat', this.scene);
      smokeMat.diffuseColor = Color3.FromHexString('#333333');
      smokeMat.emissiveColor = Color3.FromHexString('#1A1A1A');
      smokeMat.alpha = 0.5;
      smokeMat.disableLighting = true;
      smoke.material = smokeMat;

      const smokeStart = performance.now();
      const animateSmoke = () => {
        const elapsed = performance.now() - smokeStart;
        const progress = Math.min(elapsed / 3000, 1);
        smoke.scaling.y = 1 + progress * 2;
        smoke.position.y = position.y + 4 + progress * 6;
        smokeMat.alpha = 0.5 * (1 - progress);
        if (progress < 1) {
          requestAnimationFrame(animateSmoke);
        } else {
          smoke.dispose();
          smokeMat.dispose();
        }
      };
      requestAnimationFrame(animateSmoke);
    }, 400);

    // --- Debris pieces ---
    this.spawnDebris(position);
  }

  /**
   * Spawn small debris pieces that fly outward and fall.
   */
  private spawnDebris(origin: Vector3): void {
    const debrisCount = 8;
    const debrisMat = new StandardMaterial('debris_mat', this.scene);
    debrisMat.diffuseColor = Color3.FromHexString('#2A1845');
    debrisMat.specularColor = Color3.FromHexString('#333333');

    for (let i = 0; i < debrisCount; i++) {
      const size = 0.3 + Math.random() * 0.7;
      const debris = MeshBuilder.CreateBox(
        `debris_${i}`,
        { width: size, height: size * 0.5, depth: size * 0.8 },
        this.scene
      );
      debris.material = debrisMat;
      debris.position = origin.clone();
      debris.position.y += 1 + Math.random();

      // Random outward velocity
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 10;
      const vx = Math.cos(angle) * speed;
      const vz = Math.sin(angle) * speed;
      let vy = 5 + Math.random() * 8;

      // Random spin
      const spinX = (Math.random() - 0.5) * 10;
      const spinY = (Math.random() - 0.5) * 10;
      const spinZ = (Math.random() - 0.5) * 10;

      const startTime = performance.now();
      const gravity = -20;

      const animateDebris = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        if (elapsed > 3 || debris.isDisposed()) {
          debris.dispose();
          return;
        }

        debris.position.x = origin.x + vx * elapsed;
        debris.position.z = origin.z + vz * elapsed;
        debris.position.y = origin.y + 1 + vy * elapsed + 0.5 * gravity * elapsed * elapsed;

        debris.rotation.x += spinX * (1 / 60); // Approximate dt
        debris.rotation.y += spinY * (1 / 60);
        debris.rotation.z += spinZ * (1 / 60);

        // Stop at ground level
        if (debris.position.y < 0.1) {
          debris.position.y = 0.1;
          // Slow spin
          debris.rotation.x *= 0.95;
          debris.rotation.y *= 0.95;
          debris.rotation.z *= 0.95;
        }

        requestAnimationFrame(animateDebris);
      };

      requestAnimationFrame(animateDebris);
    }

    // Dispose shared material after debris lifetime
    window.setTimeout(() => {
      debrisMat.dispose();
    }, 4000);
  }

  // --------------------------------------------------------------------------
  // Hijack Support
  // --------------------------------------------------------------------------

  /**
   * Check if any vehicle near the given position is hijackable.
   *
   * @param playerPos - Player's world position.
   * @param maxDist   - Maximum distance from vehicle rear to attempt hijack.
   * @returns The hijackable vehicle, or null.
   */
  findHijackableVehicle(playerPos: Vector3, maxDist: number = 4): ManagedVehicle | null {
    for (const vehicle of this.vehicles.values()) {
      if (!vehicle.isActive) continue;
      if (!vehicle.ai.isHijackable) continue;

      const rearPos = vehicle.ai.rearPosition;
      const dist = Vector3.Distance(playerPos, rearPos);
      if (dist <= maxDist) {
        return vehicle;
      }
    }
    return null;
  }

  /**
   * Attempt to hijack a vehicle.
   *
   * @returns true if hijack succeeded.
   */
  tryHijack(vehicle: ManagedVehicle): boolean {
    if (vehicle.type === 'wraith') {
      return vehicle.ai.tryHijack();
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Dispose all vehicles and clean up resources.
   * Call on level dispose.
   */
  dispose(): void {
    for (const vehicle of this.vehicles.values()) {
      vehicle.ai.dispose();
    }
    this.vehicles.clear();
    this.onVehicleDestroyed = null;
    this.onScreenShake = null;
    console.log('[EnemyVehicleManager] Disposed');
  }
}
