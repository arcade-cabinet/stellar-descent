/**
 * WeaponEffects - Enhanced particle effects for weapons and combat
 *
 * Provides high-quality visual feedback for:
 * - Muzzle flash with multi-layered particles (core, sparks, smoke)
 * - Impact effects (sparks, dust, material-specific reactions)
 * - Projectile trails (plasma/energy trails following projectiles)
 * - Enemy hit effects (blood/alien splatter with directional spray)
 *
 * Uses GPU particles when available for performance.
 */

import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TrailMesh } from '@babylonjs/core/Meshes/trailMesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { particleManager } from './ParticleManager';

// Import TrailMesh
import '@babylonjs/core/Meshes/trailMesh';

/**
 * Material types for surface-specific impact effects
 */
export type SurfaceMaterial = 'metal' | 'concrete' | 'organic' | 'energy' | 'dirt' | 'default';

/**
 * Weapon types for muzzle flash variations
 */
export type WeaponType = 'rifle' | 'pistol' | 'plasma' | 'shotgun' | 'heavy' | 'default';

/**
 * Projectile trail configuration
 */
interface TrailConfig {
  /** Trail color at start */
  startColor: Color4;
  /** Trail color at end (faded) */
  endColor: Color4;
  /** Trail width */
  width: number;
  /** Trail length in segments */
  length: number;
  /** Auto-dispose delay after projectile expires */
  disposeDelay: number;
}

/**
 * Active projectile trail entry
 */
interface ActiveTrail {
  trail: TrailMesh;
  projectileMesh: AbstractMesh;
  particles: ParticleSystem | null;
  disposeTimer: number | null;
}

/**
 * Trail configurations for different projectile types
 */
const TRAIL_CONFIGS: Record<string, TrailConfig> = {
  // Player plasma bolt - golden/amber trail
  player_plasma: {
    startColor: new Color4(1, 0.85, 0.3, 0.8),
    endColor: new Color4(1, 0.5, 0.1, 0),
    width: 0.08,
    length: 30,
    disposeDelay: 200,
  },

  // Enemy plasma bolt - red/orange trail
  enemy_plasma: {
    startColor: new Color4(1, 0.3, 0.1, 0.7),
    endColor: new Color4(0.8, 0.1, 0.05, 0),
    width: 0.06,
    length: 25,
    disposeDelay: 200,
  },

  // Alien acid bolt - green toxic trail
  alien_acid: {
    startColor: new Color4(0.3, 1, 0.4, 0.8),
    endColor: new Color4(0.1, 0.6, 0.2, 0),
    width: 0.07,
    length: 20,
    disposeDelay: 150,
  },

  // Heavy weapon - bright intense trail
  heavy: {
    startColor: new Color4(1, 0.95, 0.8, 0.9),
    endColor: new Color4(1, 0.6, 0.2, 0),
    width: 0.12,
    length: 40,
    disposeDelay: 300,
  },

  // Default bullet trail
  default: {
    startColor: new Color4(1, 0.9, 0.7, 0.6),
    endColor: new Color4(0.8, 0.6, 0.3, 0),
    width: 0.04,
    length: 15,
    disposeDelay: 100,
  },
};

/**
 * WeaponEffects - Singleton manager for weapon-related particle effects
 */
export class WeaponEffects {
  private static instance: WeaponEffects | null = null;

  private scene: Scene | null = null;
  private activeTrails: Map<string, ActiveTrail> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): WeaponEffects {
    if (!WeaponEffects.instance) {
      WeaponEffects.instance = new WeaponEffects();
    }
    return WeaponEffects.instance;
  }

  /**
   * Initialize with scene reference
   */
  init(scene: Scene): void {
    this.scene = scene;
    console.log('[WeaponEffects] Initialized');
  }

  // ============================================================================
  // MUZZLE FLASH EFFECTS
  // ============================================================================

  /**
   * Emit an enhanced muzzle flash effect with multiple particle layers
   *
   * @param position - Muzzle position in world space
   * @param direction - Direction the weapon is firing
   * @param weaponType - Type of weapon for effect variation
   * @param scale - Effect scale multiplier (default 1)
   */
  emitMuzzleFlash(
    position: Vector3,
    direction: Vector3,
    weaponType: WeaponType = 'default',
    scale: number = 1
  ): void {
    if (!this.scene) return;

    // Base muzzle flash from ParticleManager
    particleManager.emitMuzzleFlash(position, direction, scale);

    // Add secondary smoke puff for extra visual depth
    this.emitMuzzleSmoke(position, direction, scale * 0.6);

    // Add sparks based on weapon type
    if (weaponType === 'shotgun' || weaponType === 'heavy') {
      this.emitMuzzleSparks(position, direction, scale * 1.5);
    } else if (weaponType !== 'plasma') {
      this.emitMuzzleSparks(position, direction, scale * 0.8);
    }

    // Plasma weapons get an additional energy burst
    if (weaponType === 'plasma') {
      this.emitPlasmaCharge(position, direction, scale);
    }
  }

  /**
   * Emit muzzle smoke particles
   */
  private emitMuzzleSmoke(position: Vector3, direction: Vector3, scale: number): void {
    const smokeConfig = {
      emitCount: 8,
      lifetime: { min: 0.15, max: 0.35 },
      size: { min: 0.1 * scale, max: 0.3 * scale },
      power: { min: 0.5, max: 1.5 },
      colors: {
        start: new Color4(0.5, 0.5, 0.5, 0.4),
        end: new Color4(0.3, 0.3, 0.3, 0),
      },
    };

    const system = particleManager.emit('muzzle_flash', position, {
      direction,
      scale: scale * 0.5,
    });

    if (system) {
      // Override with smoke-specific settings
      system.color1 = smokeConfig.colors.start;
      system.color2 = smokeConfig.colors.start;
      system.colorDead = smokeConfig.colors.end;
      system.minEmitPower = smokeConfig.power.min;
      system.maxEmitPower = smokeConfig.power.max;
      system.minLifeTime = smokeConfig.lifetime.min;
      system.maxLifeTime = smokeConfig.lifetime.max;
    }
  }

  /**
   * Emit muzzle spark particles
   */
  private emitMuzzleSparks(position: Vector3, direction: Vector3, scale: number): void {
    // Use bullet_impact as base but with different parameters
    const system = particleManager.emit('bullet_impact', position, {
      direction,
      scale: scale * 0.4,
    });

    if (system) {
      // Make sparks more orange/yellow
      system.color1 = new Color4(1, 0.9, 0.5, 1);
      system.color2 = new Color4(1, 0.7, 0.3, 1);
      system.colorDead = new Color4(1, 0.3, 0.1, 0);
      system.minEmitPower = 8;
      system.maxEmitPower = 15;
      system.minLifeTime = 0.05;
      system.maxLifeTime = 0.15;
    }
  }

  /**
   * Emit plasma weapon charge effect
   */
  private emitPlasmaCharge(position: Vector3, direction: Vector3, scale: number): void {
    const system = particleManager.emit('muzzle_flash', position, {
      direction,
      scale: scale * 1.2,
    });

    if (system) {
      // Blue-white plasma colors
      system.color1 = new Color4(0.8, 0.9, 1, 1);
      system.color2 = new Color4(0.6, 0.8, 1, 1);
      system.colorDead = new Color4(0.3, 0.5, 1, 0);
      system.minEmitPower = 3;
      system.maxEmitPower = 8;
    }
  }

  // ============================================================================
  // IMPACT EFFECTS
  // ============================================================================

  /**
   * Emit impact effect based on surface material
   *
   * @param position - Impact position
   * @param normal - Surface normal at impact point
   * @param surfaceMaterial - Type of surface hit
   * @param scale - Effect scale multiplier
   */
  emitImpact(
    position: Vector3,
    normal?: Vector3,
    surfaceMaterial: SurfaceMaterial = 'default',
    scale: number = 1
  ): void {
    if (!this.scene) return;

    switch (surfaceMaterial) {
      case 'metal':
        this.emitMetalImpact(position, normal, scale);
        break;
      case 'concrete':
        this.emitConcreteImpact(position, normal, scale);
        break;
      case 'organic':
        this.emitOrganicImpact(position, normal, scale);
        break;
      case 'energy':
        this.emitEnergyImpact(position, normal, scale);
        break;
      case 'dirt':
        this.emitDirtImpact(position, normal, scale);
        break;
      default:
        particleManager.emitBulletImpact(position, normal, scale);
    }
  }

  /**
   * Metal surface impact - bright sparks
   */
  private emitMetalImpact(position: Vector3, normal?: Vector3, scale: number = 1): void {
    // Bright orange/white sparks
    particleManager.emitBulletImpact(position, normal, scale * 1.2);

    // Add some ricochet sparks
    const system = particleManager.emit('bullet_impact', position, {
      direction: normal,
      scale: scale * 0.6,
    });

    if (system) {
      system.color1 = new Color4(1, 1, 0.9, 1);
      system.color2 = new Color4(1, 0.8, 0.5, 1);
      system.minEmitPower = 5;
      system.maxEmitPower = 12;
      system.gravity = new Vector3(0, -5, 0);
    }
  }

  /**
   * Concrete/stone impact - dust and debris
   */
  private emitConcreteImpact(position: Vector3, normal?: Vector3, scale: number = 1): void {
    // Dust puff
    particleManager.emitDustImpact(position, scale * 1.2);

    // Some sparks
    const system = particleManager.emit('bullet_impact', position, {
      direction: normal,
      scale: scale * 0.5,
    });

    if (system) {
      // Gray/brown dust-like sparks
      system.color1 = new Color4(0.6, 0.55, 0.5, 0.8);
      system.color2 = new Color4(0.5, 0.45, 0.4, 0.8);
      system.colorDead = new Color4(0.4, 0.35, 0.3, 0);
    }
  }

  /**
   * Organic impact - blood/splatter
   */
  private emitOrganicImpact(position: Vector3, normal?: Vector3, scale: number = 1): void {
    // Blood splatter
    particleManager.emitBloodSplatter(position, scale);

    // Add some mist
    const system = particleManager.emit('blood_splatter', position, {
      direction: normal?.negate(),
      scale: scale * 0.5,
    });

    if (system) {
      system.minSize = 0.02;
      system.maxSize = 0.05;
      system.minEmitPower = 1;
      system.maxEmitPower = 3;
    }
  }

  /**
   * Energy shield/barrier impact
   */
  private emitEnergyImpact(position: Vector3, normal?: Vector3, scale: number = 1): void {
    const system = particleManager.emit('muzzle_flash', position, {
      direction: normal,
      scale: scale * 1.5,
    });

    if (system) {
      // Blue energy ripple
      system.color1 = new Color4(0.4, 0.6, 1, 0.9);
      system.color2 = new Color4(0.6, 0.8, 1, 0.8);
      system.colorDead = new Color4(0.2, 0.4, 1, 0);
      system.minEmitPower = 2;
      system.maxEmitPower = 5;
      system.minLifeTime = 0.1;
      system.maxLifeTime = 0.3;
    }

    // Secondary glow
    const glow = particleManager.emit('muzzle_flash', position, {
      scale: scale * 2,
    });

    if (glow) {
      glow.color1 = new Color4(0.3, 0.5, 1, 0.3);
      glow.color2 = new Color4(0.3, 0.5, 1, 0.3);
      glow.colorDead = new Color4(0.2, 0.3, 0.8, 0);
      glow.minEmitPower = 0.5;
      glow.maxEmitPower = 1;
    }
  }

  /**
   * Dirt/ground impact - dust and debris
   */
  private emitDirtImpact(position: Vector3, normal?: Vector3, scale: number = 1): void {
    // Large dust cloud
    particleManager.emitDustImpact(position, scale * 1.5);

    // Debris chunks
    particleManager.emitDebris(position, scale * 0.4);
  }

  // ============================================================================
  // PROJECTILE TRAILS
  // ============================================================================

  /**
   * Create a particle-based projectile trail attached to a mesh
   *
   * @param projectileMesh - The projectile mesh to attach the trail to
   * @param trailType - Type of trail effect
   * @param projectileId - Unique ID for tracking this trail
   */
  createProjectileTrail(
    projectileMesh: AbstractMesh,
    trailType: string = 'default',
    projectileId: string
  ): void {
    if (!this.scene) return;

    const config = TRAIL_CONFIGS[trailType] || TRAIL_CONFIGS.default;

    // Create a particle system that follows the projectile
    const trailParticles = new ParticleSystem(`trail_${projectileId}`, 200, this.scene);

    // Use default particle texture from particle manager
    trailParticles.particleTexture =
      particleManager.emit('muzzle_flash', Vector3.Zero())?.particleTexture ?? null;

    // Configure trail particles
    trailParticles.emitter = projectileMesh;
    trailParticles.minEmitBox = new Vector3(-0.02, -0.02, -0.1);
    trailParticles.maxEmitBox = new Vector3(0.02, 0.02, 0);

    // Colors
    trailParticles.color1 = config.startColor;
    trailParticles.color2 = config.startColor;
    trailParticles.colorDead = config.endColor;

    // Size
    trailParticles.minSize = config.width * 0.8;
    trailParticles.maxSize = config.width * 1.2;

    // Lifetime
    trailParticles.minLifeTime = 0.1;
    trailParticles.maxLifeTime = 0.25;

    // Emission
    trailParticles.emitRate = 80;

    // Power (particles move backward relative to projectile motion)
    trailParticles.minEmitPower = 0.1;
    trailParticles.maxEmitPower = 0.3;
    trailParticles.direction1 = new Vector3(0, 0, -1);
    trailParticles.direction2 = new Vector3(0, 0, -1);

    // No gravity
    trailParticles.gravity = Vector3.Zero();

    // Blend mode for glow
    trailParticles.blendMode = ParticleSystem.BLENDMODE_ADD;

    // Start the trail
    trailParticles.start();

    // Store for cleanup
    this.activeTrails.set(projectileId, {
      trail: null as unknown as TrailMesh, // We're using particles instead
      projectileMesh,
      particles: trailParticles,
      disposeTimer: null,
    });

    // Setup auto-cleanup when projectile is disposed
    projectileMesh.onDisposeObservable.addOnce(() => {
      this.disposeTrail(projectileId, config.disposeDelay);
    });
  }

  /**
   * Create a geometric trail mesh (alternative to particles)
   * Uses a simple stretched quad that follows the projectile
   */
  createGeometricTrail(
    projectileMesh: AbstractMesh,
    trailType: string = 'default',
    projectileId: string
  ): void {
    if (!this.scene) return;

    const config = TRAIL_CONFIGS[trailType] || TRAIL_CONFIGS.default;

    // Create a ribbon mesh for the trail
    const trailPath: Vector3[] = [];
    const numPoints = config.length;

    for (let i = 0; i < numPoints; i++) {
      trailPath.push(projectileMesh.position.clone());
    }

    // We'll update this trail in the update loop
    // For now, store the config for later updates
    this.activeTrails.set(projectileId, {
      trail: null as unknown as TrailMesh,
      projectileMesh,
      particles: null,
      disposeTimer: null,
    });
  }

  /**
   * Dispose a projectile trail after optional delay
   */
  private disposeTrail(projectileId: string, delay: number = 0): void {
    const trail = this.activeTrails.get(projectileId);
    if (!trail) return;

    const cleanup = () => {
      if (trail.particles) {
        trail.particles.stop();
        // Wait for particles to fade before disposing
        window.setTimeout(() => {
          trail.particles?.dispose();
        }, 300);
      }

      if (trail.trail) {
        trail.trail.dispose();
      }

      this.activeTrails.delete(projectileId);
    };

    if (delay > 0) {
      trail.disposeTimer = window.setTimeout(cleanup, delay);
    } else {
      cleanup();
    }
  }

  // ============================================================================
  // ENEMY HIT EFFECTS
  // ============================================================================

  /**
   * Emit hit effect when an enemy is damaged
   *
   * @param position - Hit position
   * @param hitDirection - Direction of incoming damage
   * @param isAlien - Whether the target is an alien (green) or human (red)
   * @param damage - Damage amount (affects effect intensity)
   * @param isCritical - Whether this was a critical hit
   */
  emitEnemyHit(
    position: Vector3,
    hitDirection?: Vector3,
    isAlien: boolean = true,
    damage: number = 25,
    isCritical: boolean = false
  ): void {
    if (!this.scene) return;

    // Scale based on damage
    const scale = Math.min(2, 0.5 + damage / 50);

    if (isAlien) {
      // Alien hit - green splatter
      particleManager.emitAlienSplatter(position, scale);

      // Critical hit gets extra burst
      if (isCritical) {
        particleManager.emitAlienDeath(position, scale * 0.5);
      }
    } else {
      // Human hit - blood splatter
      particleManager.emitBloodSplatter(position, scale);
    }

    // Directional spray if we have hit direction
    if (hitDirection) {
      const sprayDir = hitDirection.negate().normalize();
      const sprayPos = position.add(sprayDir.scale(0.2));

      const effectType = isAlien ? 'alien_splatter' : 'blood_splatter';
      const system = particleManager.emit(effectType, sprayPos, {
        direction: sprayDir,
        scale: scale * 0.8,
      });

      if (system) {
        // Increase power for directional spray
        system.minEmitPower = 4;
        system.maxEmitPower = 10;
      }
    }

    // Add bullet impact sparks at hit point
    particleManager.emitBulletImpact(position, hitDirection?.negate(), scale * 0.5);
  }

  /**
   * Emit death effect when an enemy dies
   *
   * @param position - Death position
   * @param isAlien - Whether the target is an alien
   * @param scale - Effect scale
   */
  emitEnemyDeath(position: Vector3, isAlien: boolean = true, scale: number = 1): void {
    if (isAlien) {
      particleManager.emitAlienDeath(position, scale * 1.5);
    } else {
      particleManager.emitExplosion(position, scale);
    }
  }

  // ============================================================================
  // SHELL CASINGS
  // ============================================================================

  /**
   * Emit shell casing ejection effect
   *
   * @param position - Ejection position (side of weapon)
   * @param ejectionDirection - Direction to eject (usually right)
   * @param weaponType - Type of weapon for casing size
   */
  emitShellCasing(
    position: Vector3,
    ejectionDirection: Vector3,
    weaponType: WeaponType = 'default'
  ): void {
    if (!this.scene) return;

    // Create physical shell casing mesh
    const casingSize = weaponType === 'shotgun' ? 0.06 : weaponType === 'heavy' ? 0.08 : 0.04;

    const casing = MeshBuilder.CreateCylinder(
      'shellCasing',
      {
        height: casingSize * 2,
        diameter: casingSize,
        tessellation: 6,
      },
      this.scene
    );

    casing.position = position.clone();
    casing.rotation.x = Math.PI / 2;

    // Brass material would be applied here - for now just dispose after animation
    const startTime = performance.now();
    const velocity = ejectionDirection.normalize().scale(3);
    const spinSpeed = 15 + Math.random() * 10;

    const animateCasing = () => {
      const elapsed = (performance.now() - startTime) / 1000;

      if (elapsed > 2 || casing.isDisposed()) {
        if (!casing.isDisposed()) {
          casing.dispose();
        }
        return;
      }

      // Physics-like motion
      casing.position.addInPlace(velocity.scale(1 / 60));
      velocity.y -= 15 / 60; // Gravity

      // Spinning
      casing.rotation.z += spinSpeed / 60;

      // Bounce on ground
      if (casing.position.y < 0.05 && velocity.y < 0) {
        casing.position.y = 0.05;
        velocity.y *= -0.3;
        velocity.x *= 0.7;
        velocity.z *= 0.7;
      }

      requestAnimationFrame(animateCasing);
    };

    requestAnimationFrame(animateCasing);

    // Also emit the particle effect
    particleManager.emitShellCasing(position, ejectionDirection);
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  /**
   * Clean up all active trails
   */
  disposeAllTrails(): void {
    for (const [id] of this.activeTrails) {
      this.disposeTrail(id, 0);
    }
    this.activeTrails.clear();
  }

  /**
   * Dispose the effects manager
   */
  dispose(): void {
    this.disposeAllTrails();
    this.scene = null;
    WeaponEffects.instance = null;
    console.log('[WeaponEffects] Disposed');
  }

  /**
   * Get active trail count (for debugging)
   */
  getActiveTrailCount(): number {
    return this.activeTrails.size;
  }
}

// Export singleton accessor
export const weaponEffects = WeaponEffects.getInstance();
