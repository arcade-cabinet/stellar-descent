/**
 * MuzzleFlash - Enhanced muzzle flash effect with multi-layered particles and light
 *
 * Provides:
 * - Flash sprite at barrel position
 * - Brief point light pulse
 * - Smoke wisps
 * - Pooled for performance
 *
 * Uses BabylonJS ParticleSystem and PointLight for realistic weapon fire feedback.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { getAdjustedParticleCount, getParticleMultiplier } from '../core/PerformanceManager';
import { particleManager } from './ParticleManager';

// Import particle system components
import '@babylonjs/core/Particles/particleSystemComponent';

/**
 * Configuration for muzzle flash effects
 */
export interface MuzzleFlashConfig {
  /** Scale of the flash effect */
  scale: number;
  /** Light intensity multiplier */
  lightIntensity: number;
  /** Light range */
  lightRange: number;
  /** Light color */
  lightColor: Color3;
  /** Flash duration in milliseconds */
  flashDuration: number;
  /** Whether to emit smoke wisps */
  emitSmoke: boolean;
  /** Whether to emit sparks */
  emitSparks: boolean;
}

/**
 * Default configuration for standard rifle muzzle flash
 */
const DEFAULT_CONFIG: MuzzleFlashConfig = {
  scale: 1.0,
  lightIntensity: 2.5,
  lightRange: 8,
  lightColor: new Color3(1, 0.8, 0.4),
  flashDuration: 60,
  emitSmoke: true,
  emitSparks: true,
};

/**
 * Weapon-specific flash configurations
 */
export const WEAPON_FLASH_CONFIGS: Record<string, Partial<MuzzleFlashConfig>> = {
  rifle: {
    scale: 1.0,
    lightIntensity: 2.5,
    flashDuration: 50,
  },
  pistol: {
    scale: 0.7,
    lightIntensity: 1.5,
    lightRange: 5,
    flashDuration: 40,
  },
  shotgun: {
    scale: 1.8,
    lightIntensity: 4.0,
    lightRange: 12,
    flashDuration: 80,
    emitSparks: true,
  },
  plasma: {
    scale: 1.2,
    lightIntensity: 3.0,
    lightColor: new Color3(0.3, 0.8, 1),
    flashDuration: 70,
    emitSmoke: false,
    emitSparks: false,
  },
  heavy: {
    scale: 2.0,
    lightIntensity: 5.0,
    lightRange: 15,
    flashDuration: 100,
  },
};

/**
 * Pooled flash entry
 */
interface PooledFlash {
  /** Flash sprite mesh */
  mesh: Mesh;
  /** Flash material */
  material: StandardMaterial;
  /** Dynamic point light */
  light: PointLight;
  /** Whether currently in use */
  inUse: boolean;
  /** Animation start time */
  startTime: number;
  /** Current configuration */
  config: MuzzleFlashConfig;
}

/**
 * Smoke particle system pool entry
 */
interface PooledSmoke {
  system: ParticleSystem;
  inUse: boolean;
}

/**
 * MuzzleFlashManager - Singleton manager for muzzle flash effects
 */
export class MuzzleFlashManager {
  private static instance: MuzzleFlashManager | null = null;

  private scene: Scene | null = null;
  private flashPool: PooledFlash[] = [];
  private smokePool: PooledSmoke[] = [];
  private readonly maxFlashPool = 10;
  private readonly maxSmokePool = 15;

  // Reusable materials
  private flashMaterial: StandardMaterial | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): MuzzleFlashManager {
    if (!MuzzleFlashManager.instance) {
      MuzzleFlashManager.instance = new MuzzleFlashManager();
    }
    return MuzzleFlashManager.instance;
  }

  /**
   * Initialize with scene reference
   */
  init(scene: Scene): void {
    this.scene = scene;

    // Pre-create flash material
    this.flashMaterial = new StandardMaterial('muzzleFlashMat', scene);
    this.flashMaterial.emissiveColor = Color3.White();
    this.flashMaterial.disableLighting = true;
    this.flashMaterial.backFaceCulling = false;

    // Pre-warm the pool
    this.preWarmPools();

    console.log('[MuzzleFlash] Initialized');
  }

  /**
   * Pre-create pooled objects for better runtime performance
   */
  private preWarmPools(): void {
    if (!this.scene) return;

    // Pre-create flash meshes and lights
    for (let i = 0; i < Math.min(5, this.maxFlashPool); i++) {
      this.createPooledFlash();
    }

    // Pre-create smoke particle systems
    for (let i = 0; i < Math.min(3, this.maxSmokePool); i++) {
      this.createPooledSmoke();
    }
  }

  /**
   * Create a new pooled flash entry
   */
  private createPooledFlash(): PooledFlash | null {
    if (!this.scene || !this.flashMaterial) return null;
    if (this.flashPool.length >= this.maxFlashPool) return null;

    // Create flash sprite (billboard quad)
    const mesh = MeshBuilder.CreatePlane(
      `muzzleFlash_${this.flashPool.length}`,
      { size: 0.5 },
      this.scene
    );
    mesh.billboardMode = 7; // BILLBOARDMODE_ALL
    mesh.isVisible = false;
    mesh.isPickable = false;

    // Clone material for independent alpha control
    const material = this.flashMaterial.clone(`muzzleFlashMat_${this.flashPool.length}`);
    mesh.material = material;

    // Create point light
    const light = new PointLight(
      `muzzleLight_${this.flashPool.length}`,
      Vector3.Zero(),
      this.scene
    );
    light.intensity = 0;
    light.range = 8;
    light.diffuse = new Color3(1, 0.8, 0.4);

    const entry: PooledFlash = {
      mesh,
      material,
      light,
      inUse: false,
      startTime: 0,
      config: { ...DEFAULT_CONFIG },
    };

    this.flashPool.push(entry);
    return entry;
  }

  /**
   * Create a new pooled smoke particle system
   */
  private createPooledSmoke(): PooledSmoke | null {
    if (!this.scene) return null;
    if (this.smokePool.length >= this.maxSmokePool) return null;

    const system = new ParticleSystem(
      `muzzleSmoke_${this.smokePool.length}`,
      getAdjustedParticleCount(30),
      this.scene
    );

    // Use shared texture from particle manager
    system.particleTexture = particleManager.getDefaultTexture();

    // Smoke configuration
    system.minLifeTime = 0.2;
    system.maxLifeTime = 0.5;
    system.minSize = 0.08;
    system.maxSize = 0.2;
    system.emitRate = 0;
    system.manualEmitCount = 0;

    // Gray smoke colors
    system.color1 = new Color4(0.5, 0.5, 0.5, 0.4);
    system.color2 = new Color4(0.4, 0.4, 0.4, 0.3);
    system.colorDead = new Color4(0.2, 0.2, 0.2, 0);

    // Rise slowly
    system.gravity = new Vector3(0, 1.5, 0);
    system.minEmitPower = 0.5;
    system.maxEmitPower = 1.5;
    system.direction1 = new Vector3(-0.3, 0.5, -0.3);
    system.direction2 = new Vector3(0.3, 1, 0.3);

    system.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    system.updateSpeed = 0.01;
    system.preventAutoStart = true;

    const entry: PooledSmoke = {
      system,
      inUse: false,
    };

    this.smokePool.push(entry);
    return entry;
  }

  /**
   * Emit a muzzle flash at the specified position
   *
   * @param position - World position of the muzzle
   * @param direction - Direction the weapon is firing
   * @param weaponType - Type of weapon (affects flash appearance)
   * @param customConfig - Optional custom configuration overrides
   */
  emit(
    position: Vector3,
    direction: Vector3,
    weaponType: string = 'rifle',
    customConfig?: Partial<MuzzleFlashConfig>
  ): void {
    if (!this.scene) return;

    // Build final configuration
    const baseConfig = WEAPON_FLASH_CONFIGS[weaponType] ?? {};
    const config: MuzzleFlashConfig = {
      ...DEFAULT_CONFIG,
      ...baseConfig,
      ...customConfig,
    };

    // Get or create a flash from the pool
    let flash: PooledFlash | undefined = this.flashPool.find((f) => !f.inUse);
    if (!flash) {
      flash = this.createPooledFlash() ?? undefined;
    }

    if (flash) {
      this.activateFlash(flash, position, direction, config);
    }

    // Emit particle effects
    if (config.emitSparks) {
      this.emitSparks(position, direction, config.scale);
    }

    if (config.emitSmoke) {
      this.emitSmoke(position, direction, config.scale);
    }

    // Also use the existing enhanced muzzle flash for additional particles
    particleManager.emitEnhancedMuzzleFlash(position, direction, config.scale);
  }

  /**
   * Activate a pooled flash
   */
  private activateFlash(
    flash: PooledFlash,
    position: Vector3,
    direction: Vector3,
    config: MuzzleFlashConfig
  ): void {
    flash.inUse = true;
    flash.startTime = performance.now();
    flash.config = config;

    // Position flash slightly in front of muzzle
    const flashPos = position.add(direction.scale(0.1));
    flash.mesh.position = flashPos;
    flash.mesh.scaling.setAll(config.scale * 0.5);
    flash.mesh.isVisible = true;

    // Configure and show light
    flash.light.position = flashPos;
    flash.light.intensity = config.lightIntensity;
    flash.light.range = config.lightRange;
    flash.light.diffuse = config.lightColor;

    // Start animation
    this.animateFlash(flash);
  }

  /**
   * Animate a flash (fade out)
   */
  private animateFlash(flash: PooledFlash): void {
    const animate = () => {
      if (!flash.inUse) return;

      const elapsed = performance.now() - flash.startTime;
      const progress = elapsed / flash.config.flashDuration;

      if (progress >= 1) {
        // Release back to pool
        flash.inUse = false;
        flash.mesh.isVisible = false;
        flash.light.intensity = 0;
        flash.material.alpha = 1;
        return;
      }

      // Fade out flash sprite
      const alpha = 1 - progress;
      flash.material.alpha = alpha;

      // Quick scale pop then shrink
      const scaleProgress = progress < 0.2 ? 1 + progress * 2 : 1.4 - (progress - 0.2) * 1.5;
      flash.mesh.scaling.setAll(flash.config.scale * 0.5 * Math.max(0.1, scaleProgress));

      // Fade light
      flash.light.intensity = flash.config.lightIntensity * (1 - progress * progress);

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Emit spark particles from muzzle
   */
  private emitSparks(position: Vector3, direction: Vector3, scale: number): void {
    // Use particle manager for sparks
    const system = particleManager.emit('muzzle_sparks', position, {
      direction,
      scale: scale * 0.8,
    });

    if (system) {
      // Adjust emission count based on scale
      system.manualEmitCount = getAdjustedParticleCount(Math.floor(15 * scale));
    }
  }

  /**
   * Emit smoke wisps from muzzle
   */
  private emitSmoke(position: Vector3, direction: Vector3, scale: number): void {
    // Get pooled smoke system
    let smoke: PooledSmoke | undefined = this.smokePool.find((s) => !s.inUse);
    if (!smoke) {
      smoke = this.createPooledSmoke() ?? undefined;
    }

    if (!smoke) return;

    smoke.inUse = true;
    const system = smoke.system;

    // Position at muzzle
    system.emitter = position.add(direction.scale(0.05));

    // Scale particle size
    system.minSize = 0.08 * scale;
    system.maxSize = 0.2 * scale;

    // Emit burst
    system.manualEmitCount = getAdjustedParticleCount(Math.floor(8 * scale));
    system.start();

    // Return to pool after particles fade
    window.setTimeout(() => {
      system.stop();
      smoke!.inUse = false;
    }, 600);
  }

  /**
   * Create a sustained muzzle flash effect for automatic fire
   * Returns a handle to stop the effect
   */
  startSustainedFlash(
    position: Vector3,
    direction: Vector3,
    weaponType: string = 'rifle'
  ): { stop: () => void } {
    let isActive = true;
    let intervalId: number;

    // Emit flashes at fire rate interval
    const emitFlash = () => {
      if (!isActive) return;
      this.emit(position, direction, weaponType);
    };

    // Initial flash
    emitFlash();

    // Continue at ~10hz for sustained fire
    intervalId = window.setInterval(emitFlash, 100);

    return {
      stop: () => {
        isActive = false;
        window.clearInterval(intervalId);
      },
    };
  }

  /**
   * Get statistics about the flash pool
   */
  getStats(): {
    flashPoolSize: number;
    flashesInUse: number;
    smokePoolSize: number;
    smokeInUse: number;
  } {
    return {
      flashPoolSize: this.flashPool.length,
      flashesInUse: this.flashPool.filter((f) => f.inUse).length,
      smokePoolSize: this.smokePool.length,
      smokeInUse: this.smokePool.filter((s) => s.inUse).length,
    };
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Dispose flash pool
    for (const flash of this.flashPool) {
      flash.mesh.dispose();
      flash.material.dispose();
      flash.light.dispose();
    }
    this.flashPool = [];

    // Dispose smoke pool
    for (const smoke of this.smokePool) {
      smoke.system.dispose();
    }
    this.smokePool = [];

    this.flashMaterial?.dispose();
    this.flashMaterial = null;

    this.scene = null;
    MuzzleFlashManager.instance = null;

    console.log('[MuzzleFlash] Disposed');
  }
}

// Export singleton accessor
export const muzzleFlash = MuzzleFlashManager.getInstance();
