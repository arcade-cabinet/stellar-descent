/**
 * ParticleManager - Singleton manager for Babylon.js particle systems
 *
 * Provides pooled, reusable particle emitters for combat feedback:
 * - Muzzle flash: Bright orange burst on weapon fire (multi-layered)
 * - Bullet impact: Sparks on hit surface (material-aware)
 * - Blood/alien splatter: On enemy damage (directional spray)
 * - Explosion: For grenades or environmental
 * - Smoke: From damaged vehicles
 * - Debris: On destruction
 * - Projectile trails: Energy trails following projectiles
 * - Shell casings: Ejected brass with physics
 *
 * Uses GPU particle system when available for performance.
 *
 * @see WeaponEffects for higher-level weapon particle effects API
 */

import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';
import {
  getAdjustedParticleCount,
  getParticleMultiplier,
  getPerformanceManager,
} from '../core/PerformanceManager';

const log = getLogger('ParticleManager');

// Import particle system components
import '@babylonjs/core/Particles/particleSystemComponent';

/**
 * Configuration for different particle effect types
 */
export interface ParticleEffectConfig {
  /** Number of particles to emit per burst */
  emitCount: number;
  /** Particle lifetime in seconds */
  lifetime: { min: number; max: number };
  /** Emission rate (particles per second, 0 for burst) */
  emitRate: number;
  /** Size range */
  size: { min: number; max: number };
  /** Color gradient (start and end) */
  colors: { start: Color4; end: Color4 };
  /** Velocity/power */
  power: { min: number; max: number };
  /** Gravity influence */
  gravity: Vector3;
  /** Duration of the effect in milliseconds (0 = infinite) */
  duration: number;
  /** Direction cone (degrees) */
  directionAngle?: number;
  /** Whether particles should emit in a sphere */
  sphereEmission?: boolean;
}

/**
 * Predefined particle effect configurations
 */
const EFFECT_CONFIGS: Record<string, ParticleEffectConfig> = {
  // Muzzle flash - bright orange/yellow burst
  muzzle_flash: {
    emitCount: 30,
    lifetime: { min: 0.02, max: 0.08 },
    emitRate: 0, // Burst only
    size: { min: 0.1, max: 0.3 },
    colors: {
      start: new Color4(1, 0.9, 0.3, 1),
      end: new Color4(1, 0.4, 0.1, 0),
    },
    power: { min: 5, max: 15 },
    gravity: new Vector3(0, 0, 0),
    duration: 100,
    directionAngle: 20,
  },

  // Bullet impact - sparks
  bullet_impact: {
    emitCount: 20,
    lifetime: { min: 0.1, max: 0.3 },
    emitRate: 0,
    size: { min: 0.02, max: 0.08 },
    colors: {
      start: new Color4(1, 0.8, 0.4, 1),
      end: new Color4(1, 0.3, 0.1, 0),
    },
    power: { min: 3, max: 8 },
    gravity: new Vector3(0, -9.8, 0),
    duration: 300,
    sphereEmission: true,
  },

  // Blood splatter (human)
  blood_splatter: {
    emitCount: 25,
    lifetime: { min: 0.2, max: 0.5 },
    emitRate: 0,
    size: { min: 0.05, max: 0.15 },
    colors: {
      start: new Color4(0.6, 0.05, 0.05, 1),
      end: new Color4(0.3, 0.02, 0.02, 0.3),
    },
    power: { min: 2, max: 6 },
    gravity: new Vector3(0, -12, 0),
    duration: 500,
    sphereEmission: true,
  },

  // Alien splatter (green goo)
  alien_splatter: {
    emitCount: 35,
    lifetime: { min: 0.3, max: 0.6 },
    emitRate: 0,
    size: { min: 0.08, max: 0.2 },
    colors: {
      start: new Color4(0.2, 0.9, 0.3, 1),
      end: new Color4(0.1, 0.5, 0.15, 0.2),
    },
    power: { min: 3, max: 7 },
    gravity: new Vector3(0, -8, 0),
    duration: 600,
    sphereEmission: true,
  },

  // Explosion - large fiery burst
  explosion: {
    emitCount: 100,
    lifetime: { min: 0.3, max: 0.8 },
    emitRate: 0,
    size: { min: 0.3, max: 1.2 },
    colors: {
      start: new Color4(1, 0.8, 0.2, 1),
      end: new Color4(0.5, 0.1, 0.05, 0),
    },
    power: { min: 8, max: 20 },
    gravity: new Vector3(0, 2, 0), // Rise slightly
    duration: 800,
    sphereEmission: true,
  },

  // Smoke - rising dark particles
  smoke: {
    emitCount: 50,
    lifetime: { min: 1.5, max: 3.0 },
    emitRate: 20, // Continuous
    size: { min: 0.5, max: 1.5 },
    colors: {
      start: new Color4(0.3, 0.3, 0.3, 0.6),
      end: new Color4(0.1, 0.1, 0.1, 0),
    },
    power: { min: 1, max: 3 },
    gravity: new Vector3(0, 2, 0), // Rise
    duration: 0, // Continuous until stopped
    directionAngle: 30,
  },

  // Debris - chunks flying outward
  debris: {
    emitCount: 40,
    lifetime: { min: 0.5, max: 1.5 },
    emitRate: 0,
    size: { min: 0.1, max: 0.4 },
    colors: {
      start: new Color4(0.5, 0.4, 0.3, 1),
      end: new Color4(0.3, 0.25, 0.2, 0.5),
    },
    power: { min: 5, max: 15 },
    gravity: new Vector3(0, -15, 0),
    duration: 1500,
    sphereEmission: true,
  },

  // Small explosion (grenade)
  small_explosion: {
    emitCount: 60,
    lifetime: { min: 0.2, max: 0.5 },
    emitRate: 0,
    size: { min: 0.2, max: 0.6 },
    colors: {
      start: new Color4(1, 0.7, 0.2, 1),
      end: new Color4(0.6, 0.2, 0.05, 0),
    },
    power: { min: 6, max: 12 },
    gravity: new Vector3(0, 1, 0),
    duration: 500,
    sphereEmission: true,
  },

  // Alien death burst (larger green explosion)
  alien_death: {
    emitCount: 80,
    lifetime: { min: 0.4, max: 0.9 },
    emitRate: 0,
    size: { min: 0.15, max: 0.5 },
    colors: {
      start: new Color4(0.3, 1.0, 0.4, 1),
      end: new Color4(0.1, 0.4, 0.15, 0),
    },
    power: { min: 5, max: 12 },
    gravity: new Vector3(0, -5, 0),
    duration: 900,
    sphereEmission: true,
  },

  // Burrow emergence - dirt/debris shooting up from ground
  burrow_emergence: {
    emitCount: 60,
    lifetime: { min: 0.5, max: 1.2 },
    emitRate: 0,
    size: { min: 0.1, max: 0.35 },
    colors: {
      start: new Color4(0.55, 0.4, 0.25, 1),
      end: new Color4(0.3, 0.22, 0.15, 0),
    },
    power: { min: 6, max: 15 },
    gravity: new Vector3(0, -12, 0),
    duration: 1200,
    sphereEmission: false,
    directionAngle: 35,
  },

  // Burrow dust cloud - lingering dust after emergence
  burrow_dust: {
    emitCount: 40,
    lifetime: { min: 1.0, max: 2.0 },
    emitRate: 0,
    size: { min: 0.4, max: 1.0 },
    colors: {
      start: new Color4(0.5, 0.4, 0.3, 0.6),
      end: new Color4(0.35, 0.28, 0.2, 0),
    },
    power: { min: 1, max: 3 },
    gravity: new Vector3(0, 0.5, 0),
    duration: 2000,
    sphereEmission: true,
  },

  // Shell casing ejection
  shell_casing: {
    emitCount: 1,
    lifetime: { min: 0.5, max: 1.0 },
    emitRate: 0,
    size: { min: 0.03, max: 0.05 },
    colors: {
      start: new Color4(0.8, 0.7, 0.3, 1),
      end: new Color4(0.6, 0.5, 0.2, 1),
    },
    power: { min: 2, max: 4 },
    gravity: new Vector3(0, -15, 0),
    duration: 1000,
    directionAngle: 45,
  },

  // Dust impact
  dust_impact: {
    emitCount: 15,
    lifetime: { min: 0.3, max: 0.8 },
    emitRate: 0,
    size: { min: 0.2, max: 0.6 },
    colors: {
      start: new Color4(0.6, 0.5, 0.4, 0.5),
      end: new Color4(0.4, 0.35, 0.3, 0),
    },
    power: { min: 1, max: 3 },
    gravity: new Vector3(0, 0.5, 0),
    duration: 800,
    sphereEmission: true,
  },

  // Enhanced muzzle flash core - bright white/yellow center
  muzzle_flash_core: {
    emitCount: 15,
    lifetime: { min: 0.01, max: 0.05 },
    emitRate: 0,
    size: { min: 0.15, max: 0.4 },
    colors: {
      start: new Color4(1, 1, 0.9, 1),
      end: new Color4(1, 0.9, 0.5, 0),
    },
    power: { min: 8, max: 20 },
    gravity: new Vector3(0, 0, 0),
    duration: 80,
    directionAngle: 15,
  },

  // Muzzle sparks - hot metal particles
  muzzle_sparks: {
    emitCount: 25,
    lifetime: { min: 0.08, max: 0.2 },
    emitRate: 0,
    size: { min: 0.02, max: 0.06 },
    colors: {
      start: new Color4(1, 0.9, 0.5, 1),
      end: new Color4(1, 0.4, 0.1, 0),
    },
    power: { min: 10, max: 25 },
    gravity: new Vector3(0, -8, 0),
    duration: 250,
    directionAngle: 25,
  },

  // Muzzle smoke - lingering wisps
  muzzle_smoke: {
    emitCount: 10,
    lifetime: { min: 0.2, max: 0.5 },
    emitRate: 0,
    size: { min: 0.1, max: 0.25 },
    colors: {
      start: new Color4(0.5, 0.5, 0.5, 0.4),
      end: new Color4(0.3, 0.3, 0.3, 0),
    },
    power: { min: 0.5, max: 2 },
    gravity: new Vector3(0, 1, 0),
    duration: 500,
    directionAngle: 40,
  },

  // Plasma projectile trail particles
  plasma_trail: {
    emitCount: 50,
    lifetime: { min: 0.1, max: 0.25 },
    emitRate: 100,
    size: { min: 0.04, max: 0.1 },
    colors: {
      start: new Color4(1, 0.85, 0.3, 0.8),
      end: new Color4(1, 0.5, 0.1, 0),
    },
    power: { min: 0.1, max: 0.3 },
    gravity: new Vector3(0, 0, 0),
    duration: 0, // Continuous
    sphereEmission: true,
  },

  // Energy weapon trail (blue/white)
  energy_trail: {
    emitCount: 40,
    lifetime: { min: 0.08, max: 0.2 },
    emitRate: 80,
    size: { min: 0.03, max: 0.08 },
    colors: {
      start: new Color4(0.7, 0.9, 1, 0.9),
      end: new Color4(0.3, 0.6, 1, 0),
    },
    power: { min: 0.1, max: 0.2 },
    gravity: new Vector3(0, 0, 0),
    duration: 0,
    sphereEmission: true,
  },

  // Metal impact sparks - bright ricochets
  metal_sparks: {
    emitCount: 30,
    lifetime: { min: 0.1, max: 0.4 },
    emitRate: 0,
    size: { min: 0.015, max: 0.05 },
    colors: {
      start: new Color4(1, 1, 0.9, 1),
      end: new Color4(1, 0.5, 0.2, 0),
    },
    power: { min: 5, max: 15 },
    gravity: new Vector3(0, -12, 0),
    duration: 400,
    sphereEmission: true,
  },

  // Concrete dust/debris
  concrete_dust: {
    emitCount: 20,
    lifetime: { min: 0.4, max: 1.0 },
    emitRate: 0,
    size: { min: 0.15, max: 0.4 },
    colors: {
      start: new Color4(0.6, 0.55, 0.5, 0.6),
      end: new Color4(0.4, 0.38, 0.35, 0),
    },
    power: { min: 2, max: 5 },
    gravity: new Vector3(0, 0.5, 0),
    duration: 1000,
    sphereEmission: true,
  },

  // Energy shield impact ripple
  energy_shield: {
    emitCount: 40,
    lifetime: { min: 0.15, max: 0.4 },
    emitRate: 0,
    size: { min: 0.1, max: 0.3 },
    colors: {
      start: new Color4(0.4, 0.7, 1, 0.8),
      end: new Color4(0.2, 0.4, 1, 0),
    },
    power: { min: 3, max: 8 },
    gravity: new Vector3(0, 0, 0),
    duration: 400,
    sphereEmission: true,
  },

  // Critical hit burst - extra flashy
  critical_hit: {
    emitCount: 60,
    lifetime: { min: 0.2, max: 0.5 },
    emitRate: 0,
    size: { min: 0.1, max: 0.35 },
    colors: {
      start: new Color4(1, 0.9, 0.2, 1),
      end: new Color4(1, 0.3, 0.1, 0),
    },
    power: { min: 8, max: 18 },
    gravity: new Vector3(0, 2, 0),
    duration: 500,
    sphereEmission: true,
  },
};

/**
 * Pooled particle system entry
 * Uses ParticleSystem type which is the common base for both CPU and GPU particle systems
 */
interface PooledSystem {
  system: ParticleSystem | GPUParticleSystem;
  inUse: boolean;
  effectType: string;
  disposeTimer: number | null;
}

/**
 * Singleton particle manager for efficient particle effect management
 */
export class ParticleManager {
  private static instance: ParticleManager | null = null;

  private scene: Scene | null = null;
  private systemPool: PooledSystem[] = [];
  private readonly maxPoolSize = 50;
  private readonly gpuSupported: boolean;
  private defaultTexture: Texture | null = null;

  private constructor() {
    // Check GPU particle support
    this.gpuSupported = GPUParticleSystem.IsSupported;
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ParticleManager {
    if (!ParticleManager.instance) {
      ParticleManager.instance = new ParticleManager();
    }
    return ParticleManager.instance;
  }

  /**
   * Initialize the particle manager with a scene
   */
  init(scene: Scene): void {
    this.scene = scene;

    // Create default particle texture (a simple white circle)
    this.defaultTexture = this.createDefaultTexture(scene);

    log.info(`Initialized (GPU particles: ${this.gpuSupported})`);
  }

  /**
   * Create a procedural default particle texture
   */
  private createDefaultTexture(scene: Scene): Texture {
    // Create a dynamic texture for particles
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Draw a radial gradient circle
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }

    const texture = new Texture(
      canvas.toDataURL(),
      scene,
      false,
      true,
      Texture.BILINEAR_SAMPLINGMODE
    );
    texture.name = 'particleDefaultTexture';
    return texture;
  }

  /**
   * Emit a particle effect at the specified position
   */
  emit(
    effectType: string,
    position: Vector3,
    options?: {
      direction?: Vector3;
      scale?: number;
      emitter?: AbstractMesh;
    }
  ): ParticleSystem | GPUParticleSystem | null {
    if (!this.scene) {
      log.warn('Not initialized');
      return null;
    }

    const config = EFFECT_CONFIGS[effectType];
    if (!config) {
      log.warn(`Unknown effect type: ${effectType}`);
      return null;
    }

    // Check if we can create more particle systems (performance budget)
    const perfManager = getPerformanceManager();
    if (!perfManager.canCreateParticleSystem()) {
      // Skip non-essential particle effects when over budget
      // Always allow muzzle flash and critical effects
      const essential = ['muzzle_flash', 'muzzle_flash_core', 'critical_hit', 'explosion'];
      if (!essential.includes(effectType)) {
        return null;
      }
    }

    // Get or create a particle system
    const pooled = this.getOrCreateSystem(effectType, config);
    if (!pooled) return null;

    const system = pooled.system;
    const scale = options?.scale ?? 1;

    // Configure the system
    system.emitter = options?.emitter ?? position.clone();

    // Set direction if provided
    if (options?.direction) {
      const dir = options.direction.normalize();
      if (config.directionAngle !== undefined) {
        const angle = (config.directionAngle * Math.PI) / 180;
        system.direction1 = new Vector3(dir.x - angle, dir.y - angle, dir.z - angle);
        system.direction2 = new Vector3(dir.x + angle, dir.y + angle, dir.z + angle);
      } else {
        system.direction1 = dir.scale(config.power.min);
        system.direction2 = dir.scale(config.power.max);
      }
    }

    // Apply scale
    system.minSize = config.size.min * scale;
    system.maxSize = config.size.max * scale;

    // Start the system
    system.start();

    // For burst effects, manually emit then stop (with adjusted count)
    if (config.emitRate === 0) {
      system.manualEmitCount = getAdjustedParticleCount(config.emitCount);
    }

    // Schedule cleanup
    if (config.duration > 0) {
      pooled.disposeTimer = window.setTimeout(() => {
        this.releaseSystem(pooled);
      }, config.duration + 500); // Extra buffer for particles to finish
    }

    return system;
  }

  /**
   * Emit muzzle flash effect
   */
  emitMuzzleFlash(position: Vector3, direction: Vector3, scale = 1): void {
    this.emit('muzzle_flash', position, { direction, scale });
  }

  /**
   * Emit bullet impact sparks
   */
  emitBulletImpact(position: Vector3, normal?: Vector3, scale = 1): void {
    this.emit('bullet_impact', position, { direction: normal, scale });
  }

  /**
   * Emit blood splatter effect
   */
  emitBloodSplatter(position: Vector3, scale = 1): void {
    this.emit('blood_splatter', position, { scale });
  }

  /**
   * Emit alien death effect (green goo)
   */
  emitAlienSplatter(position: Vector3, scale = 1): void {
    this.emit('alien_splatter', position, { scale });
  }

  /**
   * Emit alien death burst (larger effect)
   */
  emitAlienDeath(position: Vector3, scale = 1): void {
    this.emit('alien_death', position, { scale });
  }

  /**
   * Emit explosion effect
   */
  emitExplosion(position: Vector3, scale = 1): void {
    this.emit('explosion', position, { scale });
    // Also emit debris
    this.emit('debris', position, { scale: scale * 0.8 });
  }

  /**
   * Emit small explosion (grenade)
   */
  emitSmallExplosion(position: Vector3, scale = 1): void {
    this.emit('small_explosion', position, { scale });
  }

  /**
   * Start continuous smoke effect
   */
  startSmoke(position: Vector3, scale = 1): ParticleSystem | GPUParticleSystem | null {
    return this.emit('smoke', position, { scale });
  }

  /**
   * Emit debris effect
   */
  emitDebris(position: Vector3, scale = 1): void {
    this.emit('debris', position, { scale });
  }

  /**
   * Emit dust impact effect
   */
  emitDustImpact(position: Vector3, scale = 1): void {
    this.emit('dust_impact', position, { scale });
  }

  /**
   * Emit shell casing
   */
  emitShellCasing(position: Vector3, direction: Vector3): void {
    this.emit('shell_casing', position, { direction });
  }

  /**
   * Emit enhanced muzzle flash with core, sparks, and smoke layers
   */
  emitEnhancedMuzzleFlash(position: Vector3, direction: Vector3, scale = 1): void {
    // Core bright flash
    this.emit('muzzle_flash_core', position, { direction, scale });
    // Hot sparks
    this.emit('muzzle_sparks', position, { direction, scale: scale * 0.8 });
    // Lingering smoke
    this.emit('muzzle_smoke', position, { direction, scale: scale * 0.6 });
  }

  /**
   * Emit metal surface impact sparks
   */
  emitMetalSparks(position: Vector3, normal?: Vector3, scale = 1): void {
    this.emit('metal_sparks', position, { direction: normal, scale });
  }

  /**
   * Emit concrete dust impact
   */
  emitConcreteDust(position: Vector3, scale = 1): void {
    this.emit('concrete_dust', position, { scale });
  }

  /**
   * Emit energy shield impact effect
   */
  emitEnergyShield(position: Vector3, normal?: Vector3, scale = 1): void {
    this.emit('energy_shield', position, { direction: normal, scale });
  }

  /**
   * Emit critical hit burst effect
   */
  emitCriticalHit(position: Vector3, scale = 1): void {
    this.emit('critical_hit', position, { scale });
  }

  /**
   * Emit burrow emergence effect - dirt/debris shooting up from alien spawn holes
   */
  emitBurrowEmergence(position: Vector3, scale = 1): void {
    // Dirt/debris shooting upward
    this.emit('burrow_emergence', position, { direction: new Vector3(0, 1, 0), scale });
    // Lingering dust cloud
    this.emit('burrow_dust', position, { scale: scale * 1.2 });
  }

  /**
   * Create a continuous plasma trail attached to a mesh
   * Returns the particle system for external management
   */
  createPlasmaTrail(
    emitterMesh: AbstractMesh,
    scale = 1
  ): ParticleSystem | GPUParticleSystem | null {
    return this.emit('plasma_trail', Vector3.Zero(), { emitter: emitterMesh, scale });
  }

  /**
   * Create a continuous energy trail attached to a mesh
   */
  createEnergyTrail(
    emitterMesh: AbstractMesh,
    scale = 1
  ): ParticleSystem | GPUParticleSystem | null {
    return this.emit('energy_trail', Vector3.Zero(), { emitter: emitterMesh, scale });
  }

  /**
   * Get the default particle texture (for use by other systems)
   */
  getDefaultTexture(): Texture | null {
    return this.defaultTexture;
  }

  /**
   * Get or create a particle system from the pool
   */
  private getOrCreateSystem(effectType: string, config: ParticleEffectConfig): PooledSystem | null {
    if (!this.scene || !this.defaultTexture) return null;

    // Try to reuse an existing system
    for (const pooled of this.systemPool) {
      if (!pooled.inUse && pooled.effectType === effectType) {
        pooled.inUse = true;
        return pooled;
      }
    }

    // Create a new system if pool isn't full
    if (this.systemPool.length >= this.maxPoolSize) {
      // Pool is full, find oldest unused and repurpose
      const unused = this.systemPool.find((p) => !p.inUse);
      if (unused) {
        unused.system.dispose();
        this.systemPool = this.systemPool.filter((p) => p !== unused);
      } else {
        log.warn('Pool exhausted');
        return null;
      }
    }

    // Create new system
    const system = this.createParticleSystem(effectType, config);
    if (!system) return null;

    const pooled: PooledSystem = {
      system,
      inUse: true,
      effectType,
      disposeTimer: null,
    };

    this.systemPool.push(pooled);
    return pooled;
  }

  /**
   * Create a new particle system with the given config
   */
  private createParticleSystem(
    name: string,
    config: ParticleEffectConfig
  ): ParticleSystem | GPUParticleSystem | null {
    if (!this.scene || !this.defaultTexture) return null;

    // Apply performance-based particle count reduction
    const adjustedEmitCount = getAdjustedParticleCount(config.emitCount);

    let system: ParticleSystem | GPUParticleSystem;

    // Use GPU particles if supported and effect is large enough after adjustment
    if (this.gpuSupported && adjustedEmitCount > 50) {
      system = new GPUParticleSystem(
        `particles_${name}_${Date.now()}`,
        { capacity: adjustedEmitCount * 2 },
        this.scene
      );
    } else {
      system = new ParticleSystem(
        `particles_${name}_${Date.now()}`,
        adjustedEmitCount * 2,
        this.scene
      );
    }

    // Configure system
    system.particleTexture = this.defaultTexture;

    // Lifetime
    system.minLifeTime = config.lifetime.min;
    system.maxLifeTime = config.lifetime.max;

    // Size
    system.minSize = config.size.min;
    system.maxSize = config.size.max;

    // Emission rate (0 for burst effects) - apply performance multiplier
    system.emitRate =
      config.emitRate > 0 ? Math.max(1, Math.floor(config.emitRate * getParticleMultiplier())) : 0;

    // Colors
    system.color1 = config.colors.start;
    system.color2 = config.colors.start;
    system.colorDead = config.colors.end;

    // Power/velocity
    system.minEmitPower = config.power.min;
    system.maxEmitPower = config.power.max;

    // Gravity
    system.gravity = config.gravity;

    // Update speed for snappier effects
    system.updateSpeed = 0.01;

    // Blend mode for additive effects
    system.blendMode = ParticleSystem.BLENDMODE_ADD;

    // Direction
    if (config.sphereEmission) {
      // Emit in all directions
      system.direction1 = new Vector3(-1, -1, -1);
      system.direction2 = new Vector3(1, 1, 1);
    } else if (config.directionAngle !== undefined) {
      const angle = (config.directionAngle * Math.PI) / 180;
      system.direction1 = new Vector3(-angle, 0.5, -angle);
      system.direction2 = new Vector3(angle, 1, angle);
    }

    // Don't auto-start
    system.preventAutoStart = true;

    return system;
  }

  /**
   * Release a system back to the pool
   */
  private releaseSystem(pooled: PooledSystem): void {
    if (pooled.disposeTimer) {
      clearTimeout(pooled.disposeTimer);
      pooled.disposeTimer = null;
    }

    pooled.system.stop();
    pooled.system.reset();
    pooled.inUse = false;
  }

  /**
   * Stop all active particle systems
   */
  stopAll(): void {
    for (const pooled of this.systemPool) {
      if (pooled.inUse) {
        this.releaseSystem(pooled);
      }
    }
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stopAll();

    for (const pooled of this.systemPool) {
      if (pooled.disposeTimer) {
        clearTimeout(pooled.disposeTimer);
      }
      pooled.system.dispose();
    }
    this.systemPool = [];

    this.defaultTexture?.dispose();
    this.defaultTexture = null;

    this.scene = null;
    ParticleManager.instance = null;

    log.info('Disposed');
  }

  /**
   * Get statistics about the particle pool
   */
  getStats(): { poolSize: number; inUse: number; gpuSupported: boolean } {
    return {
      poolSize: this.systemPool.length,
      inUse: this.systemPool.filter((p) => p.inUse).length,
      gpuSupported: this.gpuSupported,
    };
  }
}

// Export singleton accessor
export const particleManager = ParticleManager.getInstance();
