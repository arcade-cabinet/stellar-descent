/**
 * EnvironmentalParticles - Ambient particle effects for atmosphere and immersion
 *
 * Provides:
 * - Dust motes floating in light beams
 * - Sparks from damaged machinery
 * - Dripping liquids (water, alien goo)
 * - Steam/smoke from vents
 * - Debris falling from damaged structures
 *
 * All effects are LOD-aware and respect performance budgets.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { GPUParticleSystem } from '@babylonjs/core/Particles/gpuParticleSystem';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import {
  getAdjustedParticleCount,
  getParticleMultiplier,
  getPerformanceManager,
} from '../core/PerformanceManager';
import { particleManager } from './ParticleManager';

// Import particle system components
import '@babylonjs/core/Particles/particleSystemComponent';

/**
 * Types of environmental particle effects
 */
export type EnvironmentalEffectType =
  | 'dust_motes'
  | 'light_beam_dust'
  | 'machinery_sparks'
  | 'water_drip'
  | 'alien_drip'
  | 'steam_vent'
  | 'debris_fall'
  | 'ember_float'
  | 'spore_drift';

/**
 * Configuration for environmental effect emitters
 */
export interface EnvironmentalEmitterConfig {
  /** Position in world space */
  position: Vector3;
  /** Effect type */
  type: EnvironmentalEffectType;
  /** Emission area size (for volume effects) */
  area?: Vector3;
  /** Custom scale multiplier */
  scale?: number;
  /** Direction (for directional effects like drips) */
  direction?: Vector3;
  /** Intensity (affects emission rate) */
  intensity?: number;
  /** Maximum LOD distance (effect hidden beyond this) */
  lodDistance?: number;
  /** Optional emitter mesh to attach to */
  emitter?: AbstractMesh;
}

/**
 * Internal emitter configuration
 */
interface EffectConfig {
  emitRate: number;
  lifetime: { min: number; max: number };
  size: { min: number; max: number };
  colors: { start: Color4; end: Color4 };
  power: { min: number; max: number };
  gravity: Vector3;
  direction1: Vector3;
  direction2: Vector3;
  blendMode: number;
}

/**
 * Predefined effect configurations
 */
const EFFECT_CONFIGS: Record<EnvironmentalEffectType, EffectConfig> = {
  // Dust motes floating in ambient air
  dust_motes: {
    emitRate: 5,
    lifetime: { min: 3, max: 6 },
    size: { min: 0.01, max: 0.03 },
    colors: {
      start: new Color4(0.8, 0.75, 0.7, 0.3),
      end: new Color4(0.6, 0.55, 0.5, 0),
    },
    power: { min: 0.05, max: 0.15 },
    gravity: new Vector3(0, 0.02, 0),
    direction1: new Vector3(-1, -0.5, -1),
    direction2: new Vector3(1, 0.5, 1),
    blendMode: ParticleSystem.BLENDMODE_ADD,
  },

  // Dust particles visible in light beams
  light_beam_dust: {
    emitRate: 15,
    lifetime: { min: 2, max: 4 },
    size: { min: 0.015, max: 0.04 },
    colors: {
      start: new Color4(1, 0.95, 0.8, 0.5),
      end: new Color4(0.9, 0.85, 0.7, 0),
    },
    power: { min: 0.1, max: 0.3 },
    gravity: new Vector3(0, -0.02, 0),
    direction1: new Vector3(-0.3, -0.5, -0.3),
    direction2: new Vector3(0.3, 0.5, 0.3),
    blendMode: ParticleSystem.BLENDMODE_ADD,
  },

  // Sparks from damaged electrical equipment
  machinery_sparks: {
    emitRate: 0, // Burst-based
    lifetime: { min: 0.3, max: 0.8 },
    size: { min: 0.02, max: 0.05 },
    colors: {
      start: new Color4(1, 0.9, 0.5, 1),
      end: new Color4(1, 0.4, 0.1, 0),
    },
    power: { min: 2, max: 6 },
    gravity: new Vector3(0, -8, 0),
    direction1: new Vector3(-1, 0.5, -1),
    direction2: new Vector3(1, 2, 1),
    blendMode: ParticleSystem.BLENDMODE_ADD,
  },

  // Water dripping from pipes/ceilings
  water_drip: {
    emitRate: 0.5,
    lifetime: { min: 0.5, max: 1.5 },
    size: { min: 0.02, max: 0.04 },
    colors: {
      start: new Color4(0.6, 0.7, 0.8, 0.7),
      end: new Color4(0.4, 0.5, 0.6, 0),
    },
    power: { min: 0.1, max: 0.3 },
    gravity: new Vector3(0, -12, 0),
    direction1: new Vector3(-0.1, -1, -0.1),
    direction2: new Vector3(0.1, -0.8, 0.1),
    blendMode: ParticleSystem.BLENDMODE_STANDARD,
  },

  // Alien goo dripping
  alien_drip: {
    emitRate: 0.3,
    lifetime: { min: 0.8, max: 2 },
    size: { min: 0.03, max: 0.07 },
    colors: {
      start: new Color4(0.2, 0.9, 0.3, 0.8),
      end: new Color4(0.1, 0.5, 0.15, 0),
    },
    power: { min: 0.05, max: 0.2 },
    gravity: new Vector3(0, -6, 0), // Slower, goopier
    direction1: new Vector3(-0.05, -1, -0.05),
    direction2: new Vector3(0.05, -0.9, 0.05),
    blendMode: ParticleSystem.BLENDMODE_ADD,
  },

  // Steam from vents
  steam_vent: {
    emitRate: 20,
    lifetime: { min: 0.5, max: 1.5 },
    size: { min: 0.15, max: 0.4 },
    colors: {
      start: new Color4(0.9, 0.9, 0.9, 0.4),
      end: new Color4(0.7, 0.7, 0.7, 0),
    },
    power: { min: 3, max: 6 },
    gravity: new Vector3(0, 2, 0),
    direction1: new Vector3(-0.2, 0.8, -0.2),
    direction2: new Vector3(0.2, 1, 0.2),
    blendMode: ParticleSystem.BLENDMODE_STANDARD,
  },

  // Small debris falling from damaged structures
  debris_fall: {
    emitRate: 1,
    lifetime: { min: 1, max: 3 },
    size: { min: 0.02, max: 0.08 },
    colors: {
      start: new Color4(0.5, 0.45, 0.4, 1),
      end: new Color4(0.4, 0.35, 0.3, 0.5),
    },
    power: { min: 0.2, max: 0.5 },
    gravity: new Vector3(0, -10, 0),
    direction1: new Vector3(-0.5, -0.5, -0.5),
    direction2: new Vector3(0.5, 0.2, 0.5),
    blendMode: ParticleSystem.BLENDMODE_STANDARD,
  },

  // Floating embers from fires
  ember_float: {
    emitRate: 3,
    lifetime: { min: 2, max: 4 },
    size: { min: 0.01, max: 0.025 },
    colors: {
      start: new Color4(1, 0.6, 0.2, 1),
      end: new Color4(1, 0.3, 0.1, 0),
    },
    power: { min: 0.5, max: 1.5 },
    gravity: new Vector3(0, 1.5, 0),
    direction1: new Vector3(-0.5, 0.5, -0.5),
    direction2: new Vector3(0.5, 1, 0.5),
    blendMode: ParticleSystem.BLENDMODE_ADD,
  },

  // Alien spores drifting in the air
  spore_drift: {
    emitRate: 2,
    lifetime: { min: 4, max: 8 },
    size: { min: 0.02, max: 0.05 },
    colors: {
      start: new Color4(0.3, 0.8, 0.4, 0.5),
      end: new Color4(0.2, 0.5, 0.25, 0),
    },
    power: { min: 0.1, max: 0.3 },
    gravity: new Vector3(0, 0.1, 0),
    direction1: new Vector3(-1, -0.3, -1),
    direction2: new Vector3(1, 0.5, 1),
    blendMode: ParticleSystem.BLENDMODE_ADD,
  },
};

/**
 * Active environmental emitter
 */
interface ActiveEmitter {
  id: string;
  system: ParticleSystem | GPUParticleSystem;
  config: EnvironmentalEmitterConfig;
  /** For burst-based effects like sparks */
  burstTimer?: number;
  /** Optional spark light */
  sparkLight?: PointLight;
  /** Optional splash mesh */
  splashMesh?: Mesh;
}

/**
 * EnvironmentalParticles - Singleton manager for ambient particle effects
 */
export class EnvironmentalParticles {
  private static instance: EnvironmentalParticles | null = null;

  private scene: Scene | null = null;
  private activeEmitters: Map<string, ActiveEmitter> = new Map();
  private emitterIdCounter = 0;

  // Camera position for LOD calculations
  private cameraPosition: Vector3 = Vector3.Zero();

  // Update interval for LOD checking
  private lodCheckInterval = 0;
  private readonly LOD_CHECK_FRAMES = 30;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): EnvironmentalParticles {
    if (!EnvironmentalParticles.instance) {
      EnvironmentalParticles.instance = new EnvironmentalParticles();
    }
    return EnvironmentalParticles.instance;
  }

  /**
   * Initialize with scene reference
   */
  init(scene: Scene): void {
    this.scene = scene;
    console.log('[EnvironmentalParticles] Initialized');
  }

  /**
   * Update camera position for LOD calculations
   */
  setCameraPosition(position: Vector3): void {
    this.cameraPosition = position;
  }

  /**
   * Create an environmental particle emitter
   *
   * @param config - Emitter configuration
   * @returns Emitter ID for later management
   */
  createEmitter(config: EnvironmentalEmitterConfig): string {
    if (!this.scene) return '';

    // Check performance budget
    const perfManager = getPerformanceManager();
    if (!perfManager.canCreateParticleSystem()) {
      console.warn('[EnvironmentalParticles] Particle budget exceeded, skipping emitter');
      return '';
    }

    const id = `env_${config.type}_${this.emitterIdCounter++}`;
    const effectConfig = EFFECT_CONFIGS[config.type];

    // Create particle system
    const baseEmitCount = Math.ceil(effectConfig.emitRate * effectConfig.lifetime.max * 2);
    const capacity = getAdjustedParticleCount(Math.max(50, baseEmitCount));

    const system = new ParticleSystem(id, capacity, this.scene);

    // Use shared texture
    system.particleTexture = particleManager.getDefaultTexture();

    // Apply configuration
    const scale = config.scale ?? 1;
    const intensity = config.intensity ?? 1;

    system.minLifeTime = effectConfig.lifetime.min;
    system.maxLifeTime = effectConfig.lifetime.max;
    system.minSize = effectConfig.size.min * scale;
    system.maxSize = effectConfig.size.max * scale;
    system.emitRate = effectConfig.emitRate * intensity * getParticleMultiplier();

    system.color1 = effectConfig.colors.start;
    system.color2 = effectConfig.colors.start;
    system.colorDead = effectConfig.colors.end;

    system.minEmitPower = effectConfig.power.min;
    system.maxEmitPower = effectConfig.power.max;
    system.gravity = effectConfig.gravity;

    system.direction1 = effectConfig.direction1.scale(1);
    system.direction2 = effectConfig.direction2.scale(1);

    // Apply custom direction if provided
    if (config.direction) {
      const dir = config.direction.normalize();
      system.direction1 = dir.add(new Vector3(-0.2, -0.2, -0.2));
      system.direction2 = dir.add(new Vector3(0.2, 0.2, 0.2));
    }

    system.blendMode = effectConfig.blendMode;
    system.updateSpeed = 0.01;

    // Set emitter position/area
    if (config.emitter) {
      system.emitter = config.emitter;
    } else {
      system.emitter = config.position;

      // Set emission box if area is specified
      if (config.area) {
        system.minEmitBox = config.area.scale(-0.5);
        system.maxEmitBox = config.area.scale(0.5);
      } else {
        system.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
        system.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
      }
    }

    // Start the system
    system.start();

    // Create active emitter entry
    const emitter: ActiveEmitter = {
      id,
      system,
      config,
    };

    // Special handling for burst-based effects
    if (config.type === 'machinery_sparks') {
      this.setupSparkBursts(emitter);
    }

    // Special handling for drip effects (splash on impact)
    if (config.type === 'water_drip' || config.type === 'alien_drip') {
      this.setupDripSplash(emitter);
    }

    this.activeEmitters.set(id, emitter);

    return id;
  }

  /**
   * Setup periodic spark bursts with light flicker
   */
  private setupSparkBursts(emitter: ActiveEmitter): void {
    if (!this.scene) return;

    // Create flickering light
    const light = new PointLight(`sparkLight_${emitter.id}`, emitter.config.position, this.scene);
    light.intensity = 0;
    light.range = 4;
    light.diffuse = new Color3(1, 0.8, 0.4);
    emitter.sparkLight = light;

    // Random burst interval
    const scheduleBurst = () => {
      const delay = 500 + Math.random() * 3000; // 0.5-3.5 seconds between bursts
      emitter.burstTimer = window.setTimeout(() => {
        if (!this.activeEmitters.has(emitter.id)) return;

        // Emit spark burst
        emitter.system.manualEmitCount = getAdjustedParticleCount(
          15 + Math.floor(Math.random() * 20)
        );

        // Flash light
        this.flashSparkLight(light);

        // Schedule next burst
        scheduleBurst();
      }, delay);
    };

    scheduleBurst();
  }

  /**
   * Animate spark light flash
   */
  private flashSparkLight(light: PointLight): void {
    const startTime = performance.now();
    const duration = 100 + Math.random() * 100;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1 || light.isDisposed()) {
        if (!light.isDisposed()) {
          light.intensity = 0;
        }
        return;
      }

      // Flicker pattern
      const flicker = Math.random() > 0.3 ? 1 : 0.3;
      light.intensity = 2 * (1 - progress) * flicker;

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Setup splash effect for drips
   */
  private setupDripSplash(emitter: ActiveEmitter): void {
    if (!this.scene) return;

    // Create small splash ring mesh
    const isAlien = emitter.config.type === 'alien_drip';

    const splash = MeshBuilder.CreateTorus(
      `splash_${emitter.id}`,
      { diameter: 0.1, thickness: 0.02, tessellation: 12 },
      this.scene
    );
    splash.position = emitter.config.position.clone();
    splash.position.y = 0; // Ground level
    splash.rotation.x = Math.PI / 2;
    splash.isVisible = false;

    const material = new StandardMaterial(`splashMat_${emitter.id}`, this.scene);
    material.emissiveColor = isAlien
      ? Color3.FromHexString('#33FF66')
      : Color3.FromHexString('#6699CC');
    material.disableLighting = true;
    material.alpha = 0;
    splash.material = material;

    emitter.splashMesh = splash;

    // Animate splashes periodically
    const animateSplash = () => {
      if (!this.activeEmitters.has(emitter.id) || !emitter.splashMesh) return;

      // Animate splash ring
      splash.isVisible = true;
      const startTime = performance.now();
      const duration = 400;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = elapsed / duration;

        if (progress >= 1 || splash.isDisposed()) {
          if (!splash.isDisposed()) {
            splash.isVisible = false;
            material.alpha = 0;
            splash.scaling.setAll(1);
          }
          return;
        }

        // Expand and fade
        const scale = 1 + progress * 3;
        splash.scaling.setAll(scale);
        material.alpha = 0.5 * (1 - progress);

        requestAnimationFrame(animate);
      };

      animate();

      // Schedule next splash based on drip rate
      const delay = 1000 / (emitter.config.intensity ?? 0.5);
      window.setTimeout(animateSplash, delay + Math.random() * delay);
    };

    // Start splash animation after a delay
    window.setTimeout(animateSplash, 1000);
  }

  /**
   * Remove an environmental emitter
   */
  removeEmitter(id: string): void {
    const emitter = this.activeEmitters.get(id);
    if (!emitter) return;

    // Clean up burst timer
    if (emitter.burstTimer) {
      window.clearTimeout(emitter.burstTimer);
    }

    // Clean up spark light
    if (emitter.sparkLight) {
      emitter.sparkLight.dispose();
    }

    // Clean up splash mesh
    if (emitter.splashMesh) {
      emitter.splashMesh.material?.dispose();
      emitter.splashMesh.dispose();
    }

    // Stop and dispose particle system
    emitter.system.stop();
    emitter.system.dispose();

    this.activeEmitters.delete(id);
  }

  /**
   * Update LOD for all emitters based on camera distance
   * Call this periodically (not every frame)
   */
  update(deltaTime: number): void {
    this.lodCheckInterval++;

    if (this.lodCheckInterval < this.LOD_CHECK_FRAMES) return;
    this.lodCheckInterval = 0;

    for (const [id, emitter] of this.activeEmitters) {
      const lodDistance = emitter.config.lodDistance ?? 50;
      const distance = Vector3.Distance(this.cameraPosition, emitter.config.position);

      if (distance > lodDistance) {
        // Too far - pause
        if (emitter.system.isStarted()) {
          emitter.system.stop();
        }
      } else {
        // In range - resume
        if (!emitter.system.isStarted()) {
          emitter.system.start();
        }

        // Adjust emit rate based on distance (fade out at edge)
        const distanceFactor = 1 - (distance / lodDistance) * 0.5;
        const baseConfig = EFFECT_CONFIGS[emitter.config.type];
        const intensity = emitter.config.intensity ?? 1;
        emitter.system.emitRate =
          baseConfig.emitRate * intensity * distanceFactor * getParticleMultiplier();
      }
    }
  }

  /**
   * Create a dust motes effect in a volume
   */
  createDustMotes(position: Vector3, area: Vector3, intensity = 1): string {
    return this.createEmitter({
      position,
      type: 'dust_motes',
      area,
      intensity,
      lodDistance: 30,
    });
  }

  /**
   * Create light beam dust effect
   */
  createLightBeamDust(position: Vector3, direction: Vector3, scale = 1): string {
    return this.createEmitter({
      position,
      type: 'light_beam_dust',
      direction,
      scale,
      lodDistance: 40,
    });
  }

  /**
   * Create damaged machinery sparks
   */
  createMachinerySparks(position: Vector3, intensity = 1): string {
    return this.createEmitter({
      position,
      type: 'machinery_sparks',
      intensity,
      lodDistance: 25,
    });
  }

  /**
   * Create water drip effect
   */
  createWaterDrip(position: Vector3, intensity = 0.5): string {
    return this.createEmitter({
      position,
      type: 'water_drip',
      intensity,
      lodDistance: 20,
    });
  }

  /**
   * Create alien goo drip effect
   */
  createAlienDrip(position: Vector3, intensity = 0.3): string {
    return this.createEmitter({
      position,
      type: 'alien_drip',
      intensity,
      lodDistance: 25,
    });
  }

  /**
   * Create steam vent effect
   */
  createSteamVent(position: Vector3, direction: Vector3, intensity = 1): string {
    return this.createEmitter({
      position,
      type: 'steam_vent',
      direction,
      intensity,
      lodDistance: 35,
    });
  }

  /**
   * Create debris falling effect
   */
  createDebrisFall(position: Vector3, area: Vector3, intensity = 1): string {
    return this.createEmitter({
      position,
      type: 'debris_fall',
      area,
      intensity,
      lodDistance: 30,
    });
  }

  /**
   * Create floating embers effect
   */
  createEmberFloat(position: Vector3, area: Vector3, intensity = 1): string {
    return this.createEmitter({
      position,
      type: 'ember_float',
      area,
      intensity,
      lodDistance: 35,
    });
  }

  /**
   * Create alien spore drift effect
   */
  createSporeDrift(position: Vector3, area: Vector3, intensity = 1): string {
    return this.createEmitter({
      position,
      type: 'spore_drift',
      area,
      intensity,
      lodDistance: 40,
    });
  }

  /**
   * Get count of active emitters
   */
  getActiveEmitterCount(): number {
    return this.activeEmitters.size;
  }

  /**
   * Remove all environmental emitters
   */
  removeAllEmitters(): void {
    for (const id of this.activeEmitters.keys()) {
      this.removeEmitter(id);
    }
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.removeAllEmitters();
    this.scene = null;
    EnvironmentalParticles.instance = null;
    console.log('[EnvironmentalParticles] Disposed');
  }
}

// Export singleton accessor
export const environmentalParticles = EnvironmentalParticles.getInstance();
