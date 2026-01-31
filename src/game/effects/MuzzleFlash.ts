/**
 * MuzzleFlash - Enhanced muzzle flash effect with multi-layered particles and light
 *
 * Provides:
 * - Flash sprite at barrel position with variation (2-3 different intensities)
 * - Brief point light pulse (50-100ms)
 * - Color matches weapon type (orange for ballistic, blue for energy)
 * - Intensity varies by weapon (pistol weak, shotgun strong)
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
import { getLogger } from '../core/Logger';
import { getAdjustedParticleCount } from '../core/PerformanceManager';
import { particleManager } from './ParticleManager';

const log = getLogger('MuzzleFlash');

// Import particle system components
import '@babylonjs/core/Particles/particleSystemComponent';

/**
 * Flash variation type - provides visual variety per shot
 */
export type FlashVariation = 'normal' | 'bright' | 'dim';

/**
 * Flash variation presets - intensity and scale multipliers
 */
const FLASH_VARIATIONS: Record<FlashVariation, { intensityMult: number; scaleMult: number }> = {
  normal: { intensityMult: 1.0, scaleMult: 1.0 },
  bright: { intensityMult: 1.35, scaleMult: 1.15 },
  dim: { intensityMult: 0.7, scaleMult: 0.85 },
};

/**
 * Get a random flash variation for visual variety
 */
function getRandomFlashVariation(): FlashVariation {
  const rand = Math.random();
  if (rand < 0.2) return 'bright'; // 20% chance for bright flash
  if (rand < 0.4) return 'dim'; // 20% chance for dim flash
  return 'normal'; // 60% chance for normal flash
}

/**
 * Configuration for muzzle flash effects
 */
export interface MuzzleFlashConfig {
  /** Scale of the flash effect */
  scale: number;
  /** Light intensity multiplier (base value before variation) */
  lightIntensity: number;
  /** Light range - affects how far the flash illuminates surfaces */
  lightRange: number;
  /** Light color - orange for ballistic, blue for energy weapons */
  lightColor: Color3;
  /** Flash duration in milliseconds (50-100ms recommended) */
  flashDuration: number;
  /** Whether to emit smoke wisps */
  emitSmoke: boolean;
  /** Whether to emit sparks */
  emitSparks: boolean;
  /** Minimum flash duration for variation (defaults to flashDuration - 20) */
  minFlashDuration?: number;
  /** Maximum flash duration for variation (defaults to flashDuration + 20) */
  maxFlashDuration?: number;
}

/**
 * Default configuration for standard rifle muzzle flash
 */
const DEFAULT_CONFIG: MuzzleFlashConfig = {
  scale: 1.0,
  lightIntensity: 2.5,
  lightRange: 8,
  lightColor: new Color3(1, 0.8, 0.4), // Warm orange for ballistic
  flashDuration: 60,
  emitSmoke: true,
  emitSparks: true,
  minFlashDuration: 50,
  maxFlashDuration: 80,
};

/**
 * Weapon-specific flash configurations
 * - Ballistic weapons: orange/yellow colors
 * - Energy weapons: blue/cyan colors
 * - Duration: 50-100ms range for realistic flash
 * - Intensity: pistol (weak) < rifle < shotgun/heavy (strong)
 */
export const WEAPON_FLASH_CONFIGS: Record<string, Partial<MuzzleFlashConfig>> = {
  rifle: {
    scale: 1.0,
    lightIntensity: 2.5,
    lightRange: 8,
    lightColor: new Color3(1, 0.85, 0.4), // Warm orange
    flashDuration: 60,
    minFlashDuration: 50,
    maxFlashDuration: 70,
  },
  pistol: {
    scale: 0.7,
    lightIntensity: 1.5, // Weak flash for small caliber
    lightRange: 5,
    lightColor: new Color3(1, 0.9, 0.5), // Lighter orange
    flashDuration: 50,
    minFlashDuration: 40,
    maxFlashDuration: 60,
  },
  shotgun: {
    scale: 1.8,
    lightIntensity: 4.0, // Strong flash for large bore
    lightRange: 12,
    lightColor: new Color3(1, 0.75, 0.3), // Deep orange
    flashDuration: 90,
    minFlashDuration: 80,
    maxFlashDuration: 100,
    emitSparks: true,
  },
  plasma: {
    scale: 1.2,
    lightIntensity: 3.0,
    lightRange: 10,
    lightColor: new Color3(0.3, 0.8, 1), // Cyan/blue for energy
    flashDuration: 70,
    minFlashDuration: 60,
    maxFlashDuration: 80,
    emitSmoke: false,
    emitSparks: false,
  },
  energy: {
    scale: 1.0,
    lightIntensity: 2.5,
    lightRange: 8,
    lightColor: new Color3(0.4, 0.9, 1), // Light blue for energy
    flashDuration: 60,
    minFlashDuration: 50,
    maxFlashDuration: 70,
    emitSmoke: false,
    emitSparks: false,
  },
  heavy: {
    scale: 2.0,
    lightIntensity: 5.0, // Very strong flash for heavy weapons
    lightRange: 15,
    lightColor: new Color3(1, 0.8, 0.35), // Bright orange
    flashDuration: 100,
    minFlashDuration: 90,
    maxFlashDuration: 110,
    emitSparks: true,
  },
  smg: {
    scale: 0.85,
    lightIntensity: 1.8,
    lightRange: 6,
    lightColor: new Color3(1, 0.9, 0.5), // Light orange
    flashDuration: 45,
    minFlashDuration: 35,
    maxFlashDuration: 55,
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
  /** Current flash variation for this emission */
  variation: FlashVariation;
  /** Actual duration for this flash (randomized within min/max) */
  actualDuration: number;
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

    log.info('Initialized');
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
      variation: 'normal',
      actualDuration: DEFAULT_CONFIG.flashDuration,
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
   * Activate a pooled flash with variation for visual variety
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

    // Get random flash variation for visual variety
    flash.variation = getRandomFlashVariation();
    const variation = FLASH_VARIATIONS[flash.variation];

    // Calculate actual duration with randomization (50-100ms range)
    const minDur = config.minFlashDuration ?? config.flashDuration - 20;
    const maxDur = config.maxFlashDuration ?? config.flashDuration + 20;
    flash.actualDuration = minDur + Math.random() * (maxDur - minDur);

    // Apply variation multipliers
    const effectiveIntensity = config.lightIntensity * variation.intensityMult;
    const effectiveScale = config.scale * variation.scaleMult;

    // Position flash slightly in front of muzzle
    const flashPos = position.add(direction.scale(0.1));
    flash.mesh.position = flashPos;
    flash.mesh.scaling.setAll(effectiveScale * 0.5);
    flash.mesh.isVisible = true;

    // Configure and show light with varied intensity
    flash.light.position = flashPos;
    flash.light.intensity = effectiveIntensity;
    flash.light.range = config.lightRange;
    flash.light.diffuse = config.lightColor;

    // Start animation
    this.animateFlash(flash);
  }

  /**
   * Animate a flash (fade out) with variation-aware timing
   * Light fades over 50-100ms for realistic muzzle flash feel
   */
  private animateFlash(flash: PooledFlash): void {
    const variation = FLASH_VARIATIONS[flash.variation];
    const baseIntensity = flash.config.lightIntensity * variation.intensityMult;
    const baseScale = flash.config.scale * variation.scaleMult;

    const animate = () => {
      if (!flash.inUse) return;

      const elapsed = performance.now() - flash.startTime;
      const progress = elapsed / flash.actualDuration;

      if (progress >= 1) {
        // Release back to pool - ensure light is fully off
        flash.inUse = false;
        flash.mesh.isVisible = false;
        flash.light.intensity = 0;
        flash.material.alpha = 1;
        return;
      }

      // Fade out flash sprite with slight flicker for realism
      const flicker = 1 + (Math.random() - 0.5) * 0.1; // +/- 5% flicker
      const alpha = (1 - progress) * flicker;
      flash.material.alpha = Math.max(0, Math.min(1, alpha));

      // Quick scale pop (first 20%) then shrink
      const scaleProgress = progress < 0.2 ? 1 + progress * 2 : 1.4 - (progress - 0.2) * 1.5;
      flash.mesh.scaling.setAll(baseScale * 0.5 * Math.max(0.1, scaleProgress));

      // Fade light with quadratic falloff for natural decay
      // Light fades faster than the sprite for realism
      const lightFade = 1 - progress * progress;
      flash.light.intensity = baseIntensity * lightFade * flicker;

      // Ensure light is off at the end of animation
      if (progress > 0.9) {
        flash.light.intensity *= (1 - progress) * 10; // Rapid final fade
      }

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

    log.info('Disposed');
  }
}

// Export singleton accessor
export const muzzleFlash = MuzzleFlashManager.getInstance();

/**
 * Helper to create MuzzleFlashConfig from weapon definition properties
 * This bridges the gap between weapon definitions and the muzzle flash system
 */
export function createMuzzleFlashConfigFromWeapon(
  weaponType: string,
  muzzleFlashColor: Color3,
  muzzleFlashIntensity: number,
  muzzleFlashRange: number
): Partial<MuzzleFlashConfig> {
  // Calculate flash duration based on weapon type (50-100ms range)
  const baseDuration = WEAPON_FLASH_CONFIGS[weaponType]?.flashDuration ?? 60;

  return {
    lightColor: muzzleFlashColor,
    lightIntensity: muzzleFlashIntensity,
    lightRange: muzzleFlashRange,
    flashDuration: baseDuration,
    minFlashDuration: Math.max(50, baseDuration - 15),
    maxFlashDuration: Math.min(100, baseDuration + 15),
  };
}
