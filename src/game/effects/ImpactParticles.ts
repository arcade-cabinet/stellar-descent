/**
 * ImpactParticles - Surface-specific impact particle effects
 *
 * Provides per-surface particle configurations for bullet impacts:
 * - Metal: Orange sparks, short lifetime, gravity-affected
 * - Concrete: Gray dust cloud, debris chunks
 * - Organic: Green/red splatter, dripping effect
 * - Ice: Blue/white shards, crystalline particles
 * - Energy: Plasma glow, electrical arcs
 *
 * Uses pooled BabylonJS ParticleSystem emitters for performance.
 * Designed to complement the impact decal system.
 *
 * @see WeaponEffects for higher-level weapon effects API
 * @see ParticleManager for base particle system management
 */

import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';
import {
  getAdjustedParticleCount,
  getParticleMultiplier,
  getPerformanceManager,
} from '../core/PerformanceManager';
import { particleManager } from './ParticleManager';

// Import particle system components
import '@babylonjs/core/Particles/particleSystemComponent';

const log = getLogger('ImpactParticles');

/**
 * Surface types for impact effects
 */
export type ImpactSurfaceType = 'metal' | 'concrete' | 'organic' | 'ice' | 'energy' | 'dirt' | 'default';

/**
 * Configuration for a single impact particle layer
 */
export interface ImpactParticleLayerConfig {
  /** Number of particles to emit in burst */
  particleCount: number;
  /** Particle lifetime range in seconds */
  lifetime: { min: number; max: number };
  /** Particle size range */
  size: { min: number; max: number };
  /** Emission power (velocity) range */
  power: { min: number; max: number };
  /** Color at start of particle life */
  startColor: Color4;
  /** Color at end of particle life (faded) */
  endColor: Color4;
  /** Gravity influence */
  gravity: Vector3;
  /** Whether to use additive blending */
  additive: boolean;
  /** Direction spread angle in degrees (0 = tight, 180 = hemisphere) */
  spreadAngle: number;
}

/**
 * Full configuration for a surface impact effect
 */
export interface ImpactSurfaceConfig {
  /** Primary particle layer (sparks, dust, etc.) */
  primary: ImpactParticleLayerConfig;
  /** Optional secondary layer (debris, mist, etc.) */
  secondary?: ImpactParticleLayerConfig;
  /** Optional tertiary layer (glow, flash, etc.) */
  tertiary?: ImpactParticleLayerConfig;
  /** Burst emission duration in milliseconds */
  burstDuration: number;
  /** Total effect duration before cleanup */
  totalDuration: number;
}

/**
 * Surface-specific impact particle configurations
 */
const SURFACE_CONFIGS: Record<ImpactSurfaceType, ImpactSurfaceConfig> = {
  // Metal impacts: Orange sparks, short lifetime, gravity-affected
  metal: {
    primary: {
      particleCount: 35,
      lifetime: { min: 0.1, max: 0.4 },
      size: { min: 0.015, max: 0.05 },
      power: { min: 6, max: 14 },
      startColor: new Color4(1, 0.9, 0.5, 1),
      endColor: new Color4(1, 0.4, 0.1, 0),
      gravity: new Vector3(0, -12, 0),
      additive: true,
      spreadAngle: 60,
    },
    secondary: {
      // Ricochet sparks - brighter, faster
      particleCount: 15,
      lifetime: { min: 0.05, max: 0.15 },
      size: { min: 0.01, max: 0.03 },
      power: { min: 10, max: 20 },
      startColor: new Color4(1, 1, 0.9, 1),
      endColor: new Color4(1, 0.6, 0.2, 0),
      gravity: new Vector3(0, -8, 0),
      additive: true,
      spreadAngle: 45,
    },
    burstDuration: 50,
    totalDuration: 400,
  },

  // Concrete impacts: Gray dust cloud, debris chunks
  concrete: {
    primary: {
      // Dust cloud
      particleCount: 25,
      lifetime: { min: 0.4, max: 1.0 },
      size: { min: 0.15, max: 0.4 },
      power: { min: 1, max: 4 },
      startColor: new Color4(0.6, 0.55, 0.5, 0.7),
      endColor: new Color4(0.4, 0.38, 0.35, 0),
      gravity: new Vector3(0, 0.5, 0), // Slight rise
      additive: false,
      spreadAngle: 90,
    },
    secondary: {
      // Debris chunks
      particleCount: 20,
      lifetime: { min: 0.3, max: 0.8 },
      size: { min: 0.03, max: 0.1 },
      power: { min: 3, max: 8 },
      startColor: new Color4(0.5, 0.45, 0.4, 1),
      endColor: new Color4(0.35, 0.32, 0.28, 0.3),
      gravity: new Vector3(0, -15, 0),
      additive: false,
      spreadAngle: 70,
    },
    tertiary: {
      // Faint sparks from stone
      particleCount: 8,
      lifetime: { min: 0.08, max: 0.2 },
      size: { min: 0.02, max: 0.04 },
      power: { min: 5, max: 10 },
      startColor: new Color4(1, 0.8, 0.5, 0.8),
      endColor: new Color4(0.8, 0.4, 0.2, 0),
      gravity: new Vector3(0, -10, 0),
      additive: true,
      spreadAngle: 50,
    },
    burstDuration: 80,
    totalDuration: 1000,
  },

  // Organic impacts: Green/red splatter, dripping effect
  organic: {
    primary: {
      // Main splatter - green for alien
      particleCount: 30,
      lifetime: { min: 0.3, max: 0.7 },
      size: { min: 0.05, max: 0.15 },
      power: { min: 3, max: 8 },
      startColor: new Color4(0.3, 0.95, 0.4, 1),
      endColor: new Color4(0.1, 0.5, 0.15, 0.2),
      gravity: new Vector3(0, -10, 0),
      additive: false,
      spreadAngle: 80,
    },
    secondary: {
      // Dripping particles - slower, larger
      particleCount: 12,
      lifetime: { min: 0.5, max: 1.2 },
      size: { min: 0.08, max: 0.2 },
      power: { min: 1, max: 3 },
      startColor: new Color4(0.25, 0.8, 0.35, 0.9),
      endColor: new Color4(0.1, 0.4, 0.15, 0),
      gravity: new Vector3(0, -6, 0),
      additive: false,
      spreadAngle: 30,
    },
    tertiary: {
      // Mist/spray
      particleCount: 15,
      lifetime: { min: 0.2, max: 0.5 },
      size: { min: 0.1, max: 0.25 },
      power: { min: 2, max: 5 },
      startColor: new Color4(0.2, 0.7, 0.3, 0.4),
      endColor: new Color4(0.1, 0.4, 0.15, 0),
      gravity: new Vector3(0, 0, 0),
      additive: true,
      spreadAngle: 100,
    },
    burstDuration: 100,
    totalDuration: 1200,
  },

  // Ice impacts: Blue/white shards, crystalline particles
  ice: {
    primary: {
      // Ice shards
      particleCount: 25,
      lifetime: { min: 0.2, max: 0.6 },
      size: { min: 0.02, max: 0.08 },
      power: { min: 5, max: 12 },
      startColor: new Color4(0.7, 0.9, 1, 1),
      endColor: new Color4(0.4, 0.7, 1, 0),
      gravity: new Vector3(0, -14, 0),
      additive: false,
      spreadAngle: 65,
    },
    secondary: {
      // Crystalline sparkles
      particleCount: 20,
      lifetime: { min: 0.15, max: 0.4 },
      size: { min: 0.01, max: 0.04 },
      power: { min: 4, max: 10 },
      startColor: new Color4(1, 1, 1, 1),
      endColor: new Color4(0.6, 0.85, 1, 0),
      gravity: new Vector3(0, -8, 0),
      additive: true,
      spreadAngle: 50,
    },
    tertiary: {
      // Cold mist
      particleCount: 10,
      lifetime: { min: 0.4, max: 0.9 },
      size: { min: 0.15, max: 0.35 },
      power: { min: 0.5, max: 2 },
      startColor: new Color4(0.8, 0.95, 1, 0.5),
      endColor: new Color4(0.6, 0.8, 1, 0),
      gravity: new Vector3(0, 0.3, 0),
      additive: true,
      spreadAngle: 120,
    },
    burstDuration: 60,
    totalDuration: 900,
  },

  // Energy impacts: Plasma glow, electrical arcs
  energy: {
    primary: {
      // Core plasma burst
      particleCount: 30,
      lifetime: { min: 0.1, max: 0.3 },
      size: { min: 0.08, max: 0.2 },
      power: { min: 3, max: 8 },
      startColor: new Color4(0.5, 0.8, 1, 1),
      endColor: new Color4(0.2, 0.5, 1, 0),
      gravity: new Vector3(0, 0, 0),
      additive: true,
      spreadAngle: 90,
    },
    secondary: {
      // Electrical arcs/sparks
      particleCount: 25,
      lifetime: { min: 0.05, max: 0.15 },
      size: { min: 0.015, max: 0.04 },
      power: { min: 8, max: 18 },
      startColor: new Color4(1, 1, 1, 1),
      endColor: new Color4(0.4, 0.7, 1, 0),
      gravity: new Vector3(0, 0, 0),
      additive: true,
      spreadAngle: 180, // All directions for electrical effect
    },
    tertiary: {
      // Lingering glow
      particleCount: 8,
      lifetime: { min: 0.2, max: 0.5 },
      size: { min: 0.2, max: 0.5 },
      power: { min: 0.5, max: 1.5 },
      startColor: new Color4(0.3, 0.6, 1, 0.6),
      endColor: new Color4(0.1, 0.3, 0.8, 0),
      gravity: new Vector3(0, 0, 0),
      additive: true,
      spreadAngle: 60,
    },
    burstDuration: 50,
    totalDuration: 500,
  },

  // Dirt impacts: Similar to concrete but earthier
  dirt: {
    primary: {
      // Dirt cloud
      particleCount: 20,
      lifetime: { min: 0.5, max: 1.2 },
      size: { min: 0.2, max: 0.5 },
      power: { min: 1, max: 3 },
      startColor: new Color4(0.55, 0.4, 0.25, 0.7),
      endColor: new Color4(0.35, 0.25, 0.15, 0),
      gravity: new Vector3(0, 0.3, 0),
      additive: false,
      spreadAngle: 100,
    },
    secondary: {
      // Dirt chunks
      particleCount: 15,
      lifetime: { min: 0.4, max: 1.0 },
      size: { min: 0.04, max: 0.12 },
      power: { min: 4, max: 10 },
      startColor: new Color4(0.5, 0.35, 0.2, 1),
      endColor: new Color4(0.3, 0.2, 0.1, 0.2),
      gravity: new Vector3(0, -12, 0),
      additive: false,
      spreadAngle: 75,
    },
    burstDuration: 100,
    totalDuration: 1200,
  },

  // Default fallback
  default: {
    primary: {
      particleCount: 20,
      lifetime: { min: 0.1, max: 0.3 },
      size: { min: 0.02, max: 0.08 },
      power: { min: 3, max: 8 },
      startColor: new Color4(1, 0.8, 0.4, 1),
      endColor: new Color4(1, 0.3, 0.1, 0),
      gravity: new Vector3(0, -9.8, 0),
      additive: true,
      spreadAngle: 60,
    },
    burstDuration: 50,
    totalDuration: 300,
  },
};

/**
 * Pooled particle emitter entry
 */
interface PooledEmitter {
  /** Particle system instance */
  system: ParticleSystem;
  /** Whether currently in use */
  inUse: boolean;
  /** Surface type this emitter is configured for */
  configuredFor: ImpactSurfaceType | null;
  /** Layer index (0=primary, 1=secondary, 2=tertiary) */
  layerIndex: number;
  /** Dispose timer handle */
  disposeTimer: number | null;
}

/**
 * Active impact effect tracking
 */
interface ActiveImpact {
  id: string;
  emitters: PooledEmitter[];
  startTime: number;
  duration: number;
}

/**
 * ImpactParticles - Singleton manager for impact particle effects
 */
export class ImpactParticles {
  private static instance: ImpactParticles | null = null;

  private scene: Scene | null = null;
  private emitterPool: PooledEmitter[] = [];
  private activeImpacts: Map<string, ActiveImpact> = new Map();
  private readonly maxPoolSize = 20;
  private impactIdCounter = 0;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): ImpactParticles {
    if (!ImpactParticles.instance) {
      ImpactParticles.instance = new ImpactParticles();
    }
    return ImpactParticles.instance;
  }

  /**
   * Initialize with scene reference
   */
  init(scene: Scene): void {
    this.scene = scene;

    // Pre-warm the pool
    this.preWarmPool();

    log.info('Initialized with pool size', this.maxPoolSize);
  }

  /**
   * Pre-create pooled emitters for better runtime performance
   */
  private preWarmPool(): void {
    if (!this.scene) return;

    // Create initial pool (half of max)
    const preWarmCount = Math.floor(this.maxPoolSize / 2);
    for (let i = 0; i < preWarmCount; i++) {
      this.createPooledEmitter();
    }
  }

  /**
   * Create a new pooled particle emitter
   */
  private createPooledEmitter(): PooledEmitter | null {
    if (!this.scene) return null;
    if (this.emitterPool.length >= this.maxPoolSize) return null;

    const system = new ParticleSystem(
      `impactEmitter_${this.emitterPool.length}`,
      100, // Will be adjusted per-use
      this.scene
    );

    // Use shared texture from particle manager
    system.particleTexture = particleManager.getDefaultTexture();

    // Configure defaults
    system.emitRate = 0; // Burst mode
    system.manualEmitCount = 0;
    system.preventAutoStart = true;
    system.updateSpeed = 0.01;

    const entry: PooledEmitter = {
      system,
      inUse: false,
      configuredFor: null,
      layerIndex: 0,
      disposeTimer: null,
    };

    this.emitterPool.push(entry);
    return entry;
  }

  /**
   * Configure a pooled emitter for a specific surface and layer
   */
  private configureEmitter(
    emitter: PooledEmitter,
    layerConfig: ImpactParticleLayerConfig,
    surfaceType: ImpactSurfaceType,
    layerIndex: number,
    scale: number
  ): void {
    const system = emitter.system;
    const particleMultiplier = getParticleMultiplier();

    // Update tracking
    emitter.configuredFor = surfaceType;
    emitter.layerIndex = layerIndex;

    // Configure particle properties
    system.minLifeTime = layerConfig.lifetime.min;
    system.maxLifeTime = layerConfig.lifetime.max;

    system.minSize = layerConfig.size.min * scale;
    system.maxSize = layerConfig.size.max * scale;

    system.minEmitPower = layerConfig.power.min * scale;
    system.maxEmitPower = layerConfig.power.max * scale;

    // Colors
    system.color1 = layerConfig.startColor;
    system.color2 = layerConfig.startColor;
    system.colorDead = layerConfig.endColor;

    // Gravity
    system.gravity = layerConfig.gravity.scale(scale);

    // Blend mode
    system.blendMode = layerConfig.additive
      ? ParticleSystem.BLENDMODE_ADD
      : ParticleSystem.BLENDMODE_STANDARD;

    // Direction spread
    const angleRad = (layerConfig.spreadAngle * Math.PI) / 180;
    system.direction1 = new Vector3(-Math.sin(angleRad), 0, -Math.sin(angleRad));
    system.direction2 = new Vector3(Math.sin(angleRad), 1, Math.sin(angleRad));

    // Particle count with performance scaling
    const adjustedCount = getAdjustedParticleCount(
      Math.floor(layerConfig.particleCount * scale * particleMultiplier)
    );
    system.manualEmitCount = adjustedCount;
  }

  /**
   * Get or create an emitter from the pool
   */
  private getOrCreateEmitter(): PooledEmitter | null {
    // Find an unused emitter
    let emitter = this.emitterPool.find((e) => !e.inUse);

    if (!emitter) {
      // Try to create a new one
      emitter = this.createPooledEmitter() ?? undefined;
    }

    if (emitter) {
      emitter.inUse = true;
    }

    return emitter ?? null;
  }

  /**
   * Release an emitter back to the pool
   */
  private releaseEmitter(emitter: PooledEmitter): void {
    if (emitter.disposeTimer) {
      clearTimeout(emitter.disposeTimer);
      emitter.disposeTimer = null;
    }

    emitter.system.stop();
    emitter.system.reset();
    emitter.inUse = false;
  }

  /**
   * Emit impact particles at the specified position
   *
   * @param position - World position of the impact
   * @param normal - Surface normal at impact point (optional, affects direction)
   * @param surfaceType - Type of surface hit
   * @param options - Additional options
   * @returns Impact effect ID for tracking
   */
  emit(
    position: Vector3,
    normal?: Vector3,
    surfaceType: ImpactSurfaceType = 'default',
    options?: {
      /** Effect scale multiplier */
      scale?: number;
      /** Damage amount (affects intensity) */
      damage?: number;
    }
  ): string | null {
    if (!this.scene) return null;

    // Check performance budget
    const perfManager = getPerformanceManager();
    if (!perfManager.canCreateParticleSystem()) {
      // Still emit basic effect through particle manager
      particleManager.emitBulletImpact(position, normal, options?.scale ?? 1);
      return null;
    }

    const config = SURFACE_CONFIGS[surfaceType] ?? SURFACE_CONFIGS.default;
    const scale = options?.scale ?? 1;
    const damage = options?.damage ?? 25;

    // Scale based on damage (higher damage = bigger effect)
    const damageScale = Math.min(2, 0.7 + damage / 50);
    const finalScale = scale * damageScale;

    const id = `impact_${surfaceType}_${this.impactIdCounter++}`;
    const emitters: PooledEmitter[] = [];

    // Create primary layer
    const primaryEmitter = this.getOrCreateEmitter();
    if (primaryEmitter) {
      this.configureEmitter(primaryEmitter, config.primary, surfaceType, 0, finalScale);
      this.activateEmitter(primaryEmitter, position, normal);
      emitters.push(primaryEmitter);
    }

    // Create secondary layer if defined
    if (config.secondary) {
      const secondaryEmitter = this.getOrCreateEmitter();
      if (secondaryEmitter) {
        this.configureEmitter(secondaryEmitter, config.secondary, surfaceType, 1, finalScale);
        this.activateEmitter(secondaryEmitter, position, normal);
        emitters.push(secondaryEmitter);
      }
    }

    // Create tertiary layer if defined
    if (config.tertiary) {
      const tertiaryEmitter = this.getOrCreateEmitter();
      if (tertiaryEmitter) {
        this.configureEmitter(tertiaryEmitter, config.tertiary, surfaceType, 2, finalScale);
        this.activateEmitter(tertiaryEmitter, position, normal);
        emitters.push(tertiaryEmitter);
      }
    }

    // Track active impact
    const activeImpact: ActiveImpact = {
      id,
      emitters,
      startTime: performance.now(),
      duration: config.totalDuration,
    };

    this.activeImpacts.set(id, activeImpact);

    // Schedule cleanup
    window.setTimeout(() => {
      this.cleanupImpact(id);
    }, config.totalDuration + 200); // Extra buffer for particles to fade

    return id;
  }

  /**
   * Activate an emitter at the specified position
   */
  private activateEmitter(emitter: PooledEmitter, position: Vector3, normal?: Vector3): void {
    const system = emitter.system;

    // Position the emitter
    system.emitter = position.clone();

    // Adjust direction based on surface normal
    if (normal) {
      const dir = normal.normalize();
      const spreadAngle =
        SURFACE_CONFIGS[emitter.configuredFor ?? 'default']?.primary?.spreadAngle ?? 60;
      const angleRad = (spreadAngle * Math.PI) / 180;

      // Create direction cone around normal
      const perpX = Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : Vector3.Cross(dir, Vector3.Up());
      const perpZ = Vector3.Cross(dir, perpX).normalize();

      system.direction1 = dir
        .add(perpX.scale(-Math.sin(angleRad)))
        .add(perpZ.scale(-Math.sin(angleRad)))
        .normalize();
      system.direction2 = dir
        .add(perpX.scale(Math.sin(angleRad)))
        .add(perpZ.scale(Math.sin(angleRad)))
        .normalize();
    }

    // Start emission
    system.start();
  }

  /**
   * Clean up a completed impact effect
   */
  private cleanupImpact(id: string): void {
    const impact = this.activeImpacts.get(id);
    if (!impact) return;

    // Release all emitters back to pool
    for (const emitter of impact.emitters) {
      this.releaseEmitter(emitter);
    }

    this.activeImpacts.delete(id);
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Emit metal impact sparks
   */
  emitMetalImpact(position: Vector3, normal?: Vector3, scale = 1): string | null {
    return this.emit(position, normal, 'metal', { scale });
  }

  /**
   * Emit concrete dust and debris
   */
  emitConcreteImpact(position: Vector3, normal?: Vector3, scale = 1): string | null {
    return this.emit(position, normal, 'concrete', { scale });
  }

  /**
   * Emit organic splatter (green alien or red blood)
   *
   * @param isAlien - If true, uses green colors; if false, uses red
   */
  emitOrganicImpact(
    position: Vector3,
    normal?: Vector3,
    scale = 1,
    isAlien = true
  ): string | null {
    // For non-alien (human) targets, use red colors
    if (!isAlien) {
      // Emit blood splatter through particle manager
      particleManager.emitBloodSplatter(position, scale);
      return null;
    }

    return this.emit(position, normal, 'organic', { scale });
  }

  /**
   * Emit ice shard impact
   */
  emitIceImpact(position: Vector3, normal?: Vector3, scale = 1): string | null {
    return this.emit(position, normal, 'ice', { scale });
  }

  /**
   * Emit energy/plasma impact
   */
  emitEnergyImpact(position: Vector3, normal?: Vector3, scale = 1): string | null {
    return this.emit(position, normal, 'energy', { scale });
  }

  /**
   * Emit dirt impact
   */
  emitDirtImpact(position: Vector3, normal?: Vector3, scale = 1): string | null {
    return this.emit(position, normal, 'dirt', { scale });
  }

  /**
   * Emit impact effect based on detected surface material
   * Bridges between surface detection and appropriate particle effect
   */
  emitSurfaceImpact(
    position: Vector3,
    normal: Vector3 | undefined,
    surfaceMaterial: string,
    scale = 1,
    damage = 25
  ): string | null {
    // Map surface material strings to impact types
    const surfaceMap: Record<string, ImpactSurfaceType> = {
      metal: 'metal',
      concrete: 'concrete',
      stone: 'concrete',
      rock: 'concrete',
      organic: 'organic',
      flesh: 'organic',
      alien: 'organic',
      ice: 'ice',
      snow: 'ice',
      energy: 'energy',
      shield: 'energy',
      plasma: 'energy',
      dirt: 'dirt',
      ground: 'dirt',
      earth: 'dirt',
      sand: 'dirt',
    };

    const surfaceType = surfaceMap[surfaceMaterial.toLowerCase()] ?? 'default';
    return this.emit(position, normal, surfaceType, { scale, damage });
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  /**
   * Get statistics about the particle pool
   */
  getStats(): {
    poolSize: number;
    inUse: number;
    activeImpacts: number;
  } {
    return {
      poolSize: this.emitterPool.length,
      inUse: this.emitterPool.filter((e) => e.inUse).length,
      activeImpacts: this.activeImpacts.size,
    };
  }

  /**
   * Stop all active impact effects
   */
  stopAll(): void {
    for (const [id] of this.activeImpacts) {
      this.cleanupImpact(id);
    }
    this.activeImpacts.clear();
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.stopAll();

    // Dispose all pooled emitters
    for (const emitter of this.emitterPool) {
      if (emitter.disposeTimer) {
        clearTimeout(emitter.disposeTimer);
      }
      emitter.system.dispose();
    }
    this.emitterPool = [];

    this.scene = null;
    ImpactParticles.instance = null;

    log.info('Disposed');
  }
}

// Export singleton accessor
export const impactParticles = ImpactParticles.getInstance();
