/**
 * DeathEffects - Advanced enemy death effects
 *
 * Provides:
 * - Dissolve/disintegrate particle effects
 * - Explosion effects for larger enemies
 * - Ichor spray for alien deaths
 * - Debris scatter for mechanical enemies (using GLB models)
 *
 * All effects are performance-aware and scale with entity size.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../core/AssetManager';
import { getAdjustedParticleCount, getPerformanceManager } from '../core/PerformanceManager';
import { particleManager } from './ParticleManager';

/**
 * Types of death effects
 */
export type DeathEffectType =
  | 'dissolve' // Standard dissolve into particles
  | 'disintegrate' // Fast disintegration
  | 'explode' // Large explosion
  | 'ichor_burst' // Alien death with green goo
  | 'mechanical' // Robot/mechanical debris
  | 'boss'; // Epic boss death

/**
 * Configuration for death effects
 */
export interface DeathEffectConfig {
  /** World position */
  position: Vector3;
  /** Effect type */
  type: DeathEffectType;
  /** Scale based on entity size */
  scale: number;
  /** Optional mesh to animate during death */
  mesh?: Mesh | TransformNode;
  /** Whether entity is an alien (affects colors) */
  isAlien: boolean;
  /** Optional callback when effect completes */
  onComplete?: () => void;
}

/**
 * Dissolve particle configuration
 */
interface DissolveConfig {
  particleCount: number;
  duration: number;
  colors: { start: Color4; end: Color4 };
  particleSize: { min: number; max: number };
  riseSpeed: number;
  spreadRadius: number;
}

/**
 * Dissolve presets
 */
const DISSOLVE_CONFIGS: Record<DeathEffectType, DissolveConfig> = {
  dissolve: {
    particleCount: 80,
    duration: 800,
    colors: {
      start: new Color4(0.3, 0.3, 0.3, 1),
      end: new Color4(0.1, 0.1, 0.1, 0),
    },
    particleSize: { min: 0.03, max: 0.1 },
    riseSpeed: 2,
    spreadRadius: 0.5,
  },

  disintegrate: {
    particleCount: 120,
    duration: 500,
    colors: {
      start: new Color4(1, 0.8, 0.4, 1),
      end: new Color4(1, 0.3, 0.1, 0),
    },
    particleSize: { min: 0.02, max: 0.08 },
    riseSpeed: 4,
    spreadRadius: 1.0,
  },

  explode: {
    particleCount: 150,
    duration: 600,
    colors: {
      start: new Color4(1, 0.7, 0.2, 1),
      end: new Color4(0.5, 0.1, 0.05, 0),
    },
    particleSize: { min: 0.1, max: 0.4 },
    riseSpeed: 8,
    spreadRadius: 2.0,
  },

  ichor_burst: {
    particleCount: 100,
    duration: 700,
    colors: {
      start: new Color4(0.3, 1.0, 0.4, 1),
      end: new Color4(0.1, 0.5, 0.15, 0),
    },
    particleSize: { min: 0.05, max: 0.2 },
    riseSpeed: -3, // Negative = falls down
    spreadRadius: 1.5,
  },

  mechanical: {
    particleCount: 60,
    duration: 1000,
    colors: {
      start: new Color4(0.6, 0.55, 0.5, 1),
      end: new Color4(0.3, 0.28, 0.25, 0),
    },
    particleSize: { min: 0.04, max: 0.15 },
    riseSpeed: -6,
    spreadRadius: 1.0,
  },

  boss: {
    particleCount: 300,
    duration: 2000,
    colors: {
      start: new Color4(1, 0.9, 0.3, 1),
      end: new Color4(1, 0.2, 0.1, 0),
    },
    particleSize: { min: 0.1, max: 0.5 },
    riseSpeed: 5,
    spreadRadius: 3.0,
  },
};

// ---------------------------------------------------------------------------
// GLB DEBRIS ASSETS
// ---------------------------------------------------------------------------

/** Debris GLB models for mechanical death effects. */
const DEBRIS_GLB_PATHS = [
  '/models/props/debris/brick_mx_1_0.glb',
  '/models/props/debris/brick_mx_1_1.glb',
  '/models/props/debris/brick_mx_1_2.glb',
  '/models/props/debris/brick_mx_2_0.glb',
  '/models/props/debris/brick_mx_2_1.glb',
  '/models/props/debris/brick_mx_3_0.glb',
];

/** Whether debris GLB assets have been preloaded. */
let debrisAssetsReady = false;

/**
 * Preload debris GLB assets for death effects.
 * Call once during level setup before any mechanical deaths.
 */
export async function preloadDeathEffectAssets(scene?: Scene): Promise<void> {
  if (debrisAssetsReady) return;
  await Promise.all(DEBRIS_GLB_PATHS.map((p) => AssetManager.loadAssetByPath(p, scene)));
  debrisAssetsReady = true;
}

/**
 * Active death effect tracking
 */
interface ActiveDeathEffect {
  id: string;
  systems: ParticleSystem[];
  lights: PointLight[];
  meshes: AbstractMesh[];
  startTime: number;
  duration: number;
  onComplete?: () => void;
}

/**
 * DeathEffects - Singleton manager for enemy death effects
 */
export class DeathEffects {
  private static instance: DeathEffects | null = null;

  private scene: Scene | null = null;
  private activeEffects: Map<string, ActiveDeathEffect> = new Map();
  private effectIdCounter = 0;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): DeathEffects {
    if (!DeathEffects.instance) {
      DeathEffects.instance = new DeathEffects();
    }
    return DeathEffects.instance;
  }

  /**
   * Initialize with scene reference
   */
  init(scene: Scene): void {
    this.scene = scene;
    console.log('[DeathEffects] Initialized');
  }

  /**
   * Play a death effect at the specified position
   *
   * @param config - Death effect configuration
   * @returns Effect ID for tracking
   */
  playDeathEffect(config: DeathEffectConfig): string {
    if (!this.scene) return '';

    const id = `death_${config.type}_${this.effectIdCounter++}`;
    const dissolveConfig = DISSOLVE_CONFIGS[config.type];

    // Adjust for alien types
    let colors = dissolveConfig.colors;
    if (config.isAlien && config.type !== 'ichor_burst') {
      colors = {
        start: new Color4(0.2, 0.9, 0.3, 1),
        end: new Color4(0.1, 0.4, 0.15, 0),
      };
    }

    const systems: ParticleSystem[] = [];
    const lights: PointLight[] = [];
    const meshes: AbstractMesh[] = [];

    // Create main dissolve particle system
    const mainSystem = this.createDissolveSystem(
      config.position,
      {
        ...dissolveConfig,
        colors,
        particleCount: getAdjustedParticleCount(dissolveConfig.particleCount * config.scale),
      },
      config.scale
    );

    if (mainSystem) {
      systems.push(mainSystem);
      mainSystem.start();
    }

    // Add type-specific effects
    switch (config.type) {
      case 'explode':
      case 'boss':
        this.addExplosionEffects(config, systems, lights, meshes);
        break;
      case 'ichor_burst':
        this.addIchorEffects(config, systems, meshes);
        break;
      case 'mechanical':
        this.addMechanicalEffects(config, systems, meshes);
        break;
      case 'disintegrate':
        this.addDisintegrateEffects(config, systems, lights);
        break;
    }

    // Animate mesh dissolve if provided
    if (config.mesh) {
      this.animateMeshDissolve(config.mesh, dissolveConfig.duration, config.type);
    }

    // Store active effect
    const activeEffect: ActiveDeathEffect = {
      id,
      systems,
      lights,
      meshes,
      startTime: performance.now(),
      duration: dissolveConfig.duration + 500, // Extra buffer for particle fade
      onComplete: config.onComplete,
    };

    this.activeEffects.set(id, activeEffect);

    // Schedule cleanup
    window.setTimeout(() => {
      this.cleanupEffect(id);
    }, activeEffect.duration);

    // Use existing particle manager effects as well
    if (config.type === 'explode' || config.type === 'boss') {
      particleManager.emitExplosion(config.position, config.scale * 1.5);
    }
    if (config.isAlien) {
      particleManager.emitAlienDeath(config.position, config.scale);
    }

    return id;
  }

  /**
   * Create the main dissolve particle system
   */
  private createDissolveSystem(
    position: Vector3,
    config: DissolveConfig,
    scale: number
  ): ParticleSystem | null {
    if (!this.scene) return null;

    const system = new ParticleSystem(
      `dissolve_${this.effectIdCounter}`,
      config.particleCount,
      this.scene
    );

    system.particleTexture = particleManager.getDefaultTexture();

    // Emit from a sphere around the position
    system.emitter = position;
    system.minEmitBox = new Vector3(
      -config.spreadRadius * scale,
      -0.5 * scale,
      -config.spreadRadius * scale
    );
    system.maxEmitBox = new Vector3(
      config.spreadRadius * scale,
      0.5 * scale,
      config.spreadRadius * scale
    );

    // Particle properties
    system.minLifeTime = (config.duration / 1000) * 0.5;
    system.maxLifeTime = config.duration / 1000;
    system.minSize = config.particleSize.min * scale;
    system.maxSize = config.particleSize.max * scale;

    // Colors
    system.color1 = config.colors.start;
    system.color2 = config.colors.start;
    system.colorDead = config.colors.end;

    // Movement
    system.minEmitPower = 1;
    system.maxEmitPower = 3;
    system.direction1 = new Vector3(-1, config.riseSpeed > 0 ? 0.5 : -0.5, -1);
    system.direction2 = new Vector3(1, config.riseSpeed > 0 ? 1 : -1, 1);

    // Gravity (positive = rise, negative = fall)
    system.gravity = new Vector3(0, config.riseSpeed, 0);

    // Blend mode
    system.blendMode = ParticleSystem.BLENDMODE_ADD;
    system.updateSpeed = 0.01;

    // Burst emission
    system.emitRate = 0;
    system.manualEmitCount = config.particleCount;

    return system;
  }

  /**
   * Add explosion-specific effects
   */
  private addExplosionEffects(
    config: DeathEffectConfig,
    systems: ParticleSystem[],
    lights: PointLight[],
    meshes: AbstractMesh[]
  ): void {
    if (!this.scene) return;

    // Create explosion light
    const light = new PointLight(
      `explosionLight_${this.effectIdCounter}`,
      config.position,
      this.scene
    );
    light.intensity = 5 * config.scale;
    light.range = 15 * config.scale;
    light.diffuse = new Color3(1, 0.7, 0.3);
    lights.push(light);

    // Animate light fade
    const startTime = performance.now();
    const duration = config.type === 'boss' ? 1500 : 500;

    const animateLight = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1 || light.isDisposed()) {
        if (!light.isDisposed()) {
          light.intensity = 0;
        }
        return;
      }

      // Flicker for boss
      const flicker = config.type === 'boss' ? 0.7 + Math.random() * 0.3 : 1;
      light.intensity = 5 * config.scale * (1 - progress) * flicker;

      requestAnimationFrame(animateLight);
    };

    requestAnimationFrame(animateLight);

    // Create shockwave ring for boss deaths
    if (config.type === 'boss') {
      this.createShockwave(config.position, config.scale * 2, meshes);
    }

    // Emit debris
    particleManager.emitDebris(config.position, config.scale * 1.2);
  }

  /**
   * Add ichor burst effects (alien death)
   */
  private addIchorEffects(
    config: DeathEffectConfig,
    systems: ParticleSystem[],
    meshes: AbstractMesh[]
  ): void {
    if (!this.scene) return;

    // Create goo splatter particle system
    const gooSystem = new ParticleSystem(
      `ichor_${this.effectIdCounter}`,
      getAdjustedParticleCount(60),
      this.scene
    );

    gooSystem.particleTexture = particleManager.getDefaultTexture();
    gooSystem.emitter = config.position;
    gooSystem.minEmitBox = new Vector3(-0.3 * config.scale, 0, -0.3 * config.scale);
    gooSystem.maxEmitBox = new Vector3(0.3 * config.scale, 0.5 * config.scale, 0.3 * config.scale);

    gooSystem.minLifeTime = 0.5;
    gooSystem.maxLifeTime = 1.2;
    gooSystem.minSize = 0.08 * config.scale;
    gooSystem.maxSize = 0.2 * config.scale;

    // Green goo colors
    gooSystem.color1 = new Color4(0.3, 1.0, 0.4, 0.9);
    gooSystem.color2 = new Color4(0.2, 0.8, 0.3, 0.8);
    gooSystem.colorDead = new Color4(0.1, 0.4, 0.15, 0);

    // Splatter outward then fall
    gooSystem.minEmitPower = 4;
    gooSystem.maxEmitPower = 8;
    gooSystem.direction1 = new Vector3(-1, 0.5, -1);
    gooSystem.direction2 = new Vector3(1, 1.5, 1);
    gooSystem.gravity = new Vector3(0, -12, 0);

    gooSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    gooSystem.emitRate = 0;
    gooSystem.manualEmitCount = getAdjustedParticleCount(60);

    systems.push(gooSystem);
    gooSystem.start();

    // Create ground splatter decals (simplified)
    this.createGroundSplatter(config.position, config.scale, true, meshes);
  }

  /**
   * Add mechanical death effects using GLB debris models
   */
  private addMechanicalEffects(
    config: DeathEffectConfig,
    systems: ParticleSystem[],
    meshes: AbstractMesh[]
  ): void {
    if (!this.scene) return;

    // Spark burst
    particleManager.emitBulletImpact(config.position, undefined, config.scale * 2);

    // Create debris chunks using GLB models
    const debrisCount = Math.min(8, Math.floor(4 * config.scale));

    if (!debrisAssetsReady) {
      throw new Error('[DeathEffects] Debris assets not preloaded - call preloadDeathEffectAssets() first');
    }

    for (let i = 0; i < debrisCount; i++) {
      const glbPath = DEBRIS_GLB_PATHS[i % DEBRIS_GLB_PATHS.length];

      if (!AssetManager.isPathCached(glbPath)) {
        throw new Error(`[DeathEffects] Debris GLB not cached: ${glbPath}`);
      }

      const debrisNode = AssetManager.createInstanceByPath(
        glbPath,
        `debris_glb_${this.effectIdCounter}_${i}`,
        this.scene,
        false // No LOD for short-lived debris
      );

      if (!debrisNode) {
        throw new Error(`[DeathEffects] Failed to create debris instance from: ${glbPath}`);
      }

      // Scale debris based on config
      const scale = (0.05 + Math.random() * 0.08) * config.scale;
      debrisNode.scaling.setAll(scale);

      debrisNode.position = config.position.add(
        new Vector3(
          (Math.random() - 0.5) * 0.5,
          Math.random() * 0.5,
          (Math.random() - 0.5) * 0.5
        )
      );

      // Get child meshes for tracking
      const childMeshes = debrisNode.getChildMeshes();
      for (const mesh of childMeshes) {
        meshes.push(mesh);
      }

      // Animate debris flying outward
      const velocity = new Vector3(
        (Math.random() - 0.5) * 8,
        2 + Math.random() * 4,
        (Math.random() - 0.5) * 8
      );
      const angularVelocity = new Vector3(
        Math.random() * 10,
        Math.random() * 10,
        Math.random() * 10
      );

      this.animateDebrisNode(debrisNode, velocity, angularVelocity);
    }
  }

  /**
   * Animate a TransformNode (GLB debris) with physics-like motion
   */
  private animateDebrisNode(
    node: TransformNode,
    velocity: Vector3,
    angularVelocity: Vector3
  ): void {
    const startTime = performance.now();
    const gravity = -15;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;

      if (elapsed > 3 || node.isDisposed()) {
        if (!node.isDisposed()) {
          node.dispose();
        }
        return;
      }

      // Update velocity with gravity
      velocity.y += gravity * (1 / 60);

      // Update position
      node.position.addInPlace(velocity.scale(1 / 60));

      // Update rotation
      node.rotation.addInPlace(angularVelocity.scale(1 / 60));

      // Ground collision
      if (node.position.y < 0.05) {
        node.position.y = 0.05;
        velocity.y *= -0.3;
        velocity.x *= 0.7;
        velocity.z *= 0.7;
        angularVelocity.scaleInPlace(0.8);
      }

      // Fade out child meshes at end
      if (elapsed > 2.5) {
        const fadeProgress = (elapsed - 2.5) / 0.5;
        for (const mesh of node.getChildMeshes()) {
          if (mesh.material instanceof StandardMaterial) {
            (mesh.material as StandardMaterial).alpha = 1 - fadeProgress;
          }
        }
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Add disintegrate-specific effects
   */
  private addDisintegrateEffects(
    config: DeathEffectConfig,
    systems: ParticleSystem[],
    lights: PointLight[]
  ): void {
    if (!this.scene) return;

    // Create brief bright flash
    const light = new PointLight(
      `disintLight_${this.effectIdCounter}`,
      config.position,
      this.scene
    );
    light.intensity = 3 * config.scale;
    light.range = 8 * config.scale;
    light.diffuse = new Color3(1, 0.9, 0.6);
    lights.push(light);

    // Quick flash animation
    const startTime = performance.now();
    const duration = 150;

    const animateLight = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1 || light.isDisposed()) {
        if (!light.isDisposed()) {
          light.intensity = 0;
        }
        return;
      }

      light.intensity = 3 * config.scale * (1 - progress * progress);
      requestAnimationFrame(animateLight);
    };

    requestAnimationFrame(animateLight);

    // Add secondary particle burst
    const burstSystem = new ParticleSystem(
      `disintBurst_${this.effectIdCounter}`,
      getAdjustedParticleCount(40),
      this.scene
    );

    burstSystem.particleTexture = particleManager.getDefaultTexture();
    burstSystem.emitter = config.position;

    burstSystem.minLifeTime = 0.1;
    burstSystem.maxLifeTime = 0.3;
    burstSystem.minSize = 0.05 * config.scale;
    burstSystem.maxSize = 0.15 * config.scale;

    burstSystem.color1 = new Color4(1, 1, 0.9, 1);
    burstSystem.color2 = new Color4(1, 0.9, 0.7, 1);
    burstSystem.colorDead = new Color4(1, 0.5, 0.2, 0);

    burstSystem.minEmitPower = 8;
    burstSystem.maxEmitPower = 15;
    burstSystem.direction1 = new Vector3(-1, -1, -1);
    burstSystem.direction2 = new Vector3(1, 1, 1);

    burstSystem.blendMode = ParticleSystem.BLENDMODE_ADD;
    burstSystem.emitRate = 0;
    burstSystem.manualEmitCount = getAdjustedParticleCount(40);

    systems.push(burstSystem);
    burstSystem.start();
  }

  /**
   * Create a shockwave ring effect
   */
  private createShockwave(position: Vector3, scale: number, meshes: AbstractMesh[]): void {
    if (!this.scene) return;

    const shockwave = MeshBuilder.CreateTorus(
      `shockwave_${this.effectIdCounter}`,
      { diameter: 0.5, thickness: 0.1, tessellation: 32 },
      this.scene
    );

    shockwave.position = position.clone();
    shockwave.position.y = 0.1;
    shockwave.rotation.x = Math.PI / 2;

    const material = new StandardMaterial(`shockwaveMat_${this.effectIdCounter}`, this.scene);
    material.emissiveColor = new Color3(1, 0.7, 0.3);
    material.disableLighting = true;
    material.alpha = 0.8;
    material.backFaceCulling = false;
    shockwave.material = material;

    meshes.push(shockwave);

    // Animate expansion
    const startTime = performance.now();
    const duration = 800;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1 || shockwave.isDisposed()) {
        return;
      }

      // Expand rapidly at first, then slow
      const easeProgress = 1 - (1 - progress) ** 3;
      const currentScale = 0.5 + easeProgress * scale * 8;
      shockwave.scaling.setAll(currentScale);

      // Fade out
      material.alpha = 0.8 * (1 - progress);

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Create ground splatter effect
   */
  private createGroundSplatter(
    position: Vector3,
    scale: number,
    isAlien: boolean,
    meshes: AbstractMesh[]
  ): void {
    if (!this.scene) return;

    const splatter = MeshBuilder.CreateDisc(
      `splatter_${this.effectIdCounter}`,
      { radius: 0.3 * scale, tessellation: 16 },
      this.scene
    );

    splatter.position = new Vector3(position.x, 0.02, position.z);
    splatter.rotation.x = Math.PI / 2;

    const material = new StandardMaterial(`splatterMat_${this.effectIdCounter}`, this.scene);
    material.emissiveColor = isAlien
      ? Color3.FromHexString('#33FF66')
      : Color3.FromHexString('#993333');
    material.disableLighting = true;
    material.alpha = 0.6;
    splatter.material = material;

    meshes.push(splatter);

    // Fade out over time
    const startTime = performance.now();
    const duration = 3000;

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1 || splatter.isDisposed()) {
        return;
      }

      material.alpha = 0.6 * (1 - progress);

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Animate debris chunk physics
   */
  private animateDebris(mesh: Mesh, velocity: Vector3, angularVelocity: Vector3): void {
    const startTime = performance.now();
    const gravity = -15;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;

      if (elapsed > 3 || mesh.isDisposed()) {
        return;
      }

      // Update velocity with gravity
      velocity.y += gravity * (1 / 60);

      // Update position
      mesh.position.addInPlace(velocity.scale(1 / 60));

      // Update rotation
      mesh.rotation.addInPlace(angularVelocity.scale(1 / 60));

      // Ground collision
      if (mesh.position.y < 0.05) {
        mesh.position.y = 0.05;
        velocity.y *= -0.3;
        velocity.x *= 0.7;
        velocity.z *= 0.7;
        angularVelocity.scaleInPlace(0.8);
      }

      // Fade out at end
      if (elapsed > 2.5) {
        const fadeProgress = (elapsed - 2.5) / 0.5;
        if (mesh.material instanceof StandardMaterial) {
          (mesh.material as StandardMaterial).alpha = 1 - fadeProgress;
        }
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Animate mesh dissolve effect
   */
  private animateMeshDissolve(
    mesh: Mesh | TransformNode,
    duration: number,
    type: DeathEffectType
  ): void {
    const startTime = performance.now();

    // Get all child meshes
    const meshes = mesh.getChildMeshes();
    if ('material' in mesh) {
      meshes.unshift(mesh as AbstractMesh);
    }

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        // Final state - hide meshes
        for (const m of meshes) {
          m.isVisible = false;
        }
        return;
      }

      // Apply dissolve animation based on type
      switch (type) {
        case 'dissolve': {
          // Shrink and rise
          const dissolveScale = 1 - progress;
          mesh.scaling.setAll(dissolveScale);
          mesh.position.y += 0.02;
          break;
        }

        case 'disintegrate': {
          // Quick shrink with random offset
          const disintScale = Math.max(0, 1 - progress * 2);
          mesh.scaling.setAll(disintScale);
          mesh.position.x += (Math.random() - 0.5) * 0.05;
          mesh.position.z += (Math.random() - 0.5) * 0.05;
          break;
        }

        case 'explode':
        case 'boss': {
          // Rapid shrink then gone
          const explodeScale = Math.max(0, 1 - progress * 3);
          mesh.scaling.setAll(explodeScale);
          break;
        }

        case 'ichor_burst': {
          // Sink and shrink
          const ichorScale = 1 - progress;
          mesh.scaling.x = 1 + progress * 0.5;
          mesh.scaling.y = ichorScale;
          mesh.scaling.z = 1 + progress * 0.5;
          mesh.position.y -= 0.03;
          break;
        }

        case 'mechanical':
          // No mesh animation - debris handles it
          break;
      }

      // Apply alpha fade to materials
      for (const m of meshes) {
        if (m.material instanceof StandardMaterial) {
          (m.material as StandardMaterial).alpha = 1 - progress;
        }
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  /**
   * Clean up a completed effect
   */
  private cleanupEffect(id: string): void {
    const effect = this.activeEffects.get(id);
    if (!effect) return;

    // Dispose particle systems
    for (const system of effect.systems) {
      system.stop();
      system.dispose();
    }

    // Dispose lights
    for (const light of effect.lights) {
      light.dispose();
    }

    // Dispose meshes
    for (const mesh of effect.meshes) {
      mesh.material?.dispose();
      mesh.dispose();
    }

    // Call completion callback
    if (effect.onComplete) {
      effect.onComplete();
    }

    this.activeEffects.delete(id);
  }

  /**
   * Convenience method for standard enemy death
   */
  playEnemyDeath(
    position: Vector3,
    isAlien: boolean,
    scale = 1,
    mesh?: Mesh | TransformNode
  ): string {
    return this.playDeathEffect({
      position,
      type: isAlien ? 'ichor_burst' : 'dissolve',
      scale,
      mesh,
      isAlien,
    });
  }

  /**
   * Convenience method for boss death
   */
  playBossDeath(
    position: Vector3,
    isAlien: boolean,
    scale = 2,
    mesh?: Mesh | TransformNode
  ): string {
    return this.playDeathEffect({
      position,
      type: 'boss',
      scale,
      mesh,
      isAlien,
    });
  }

  /**
   * Convenience method for mechanical enemy death
   */
  playMechanicalDeath(position: Vector3, scale = 1, mesh?: Mesh | TransformNode): string {
    return this.playDeathEffect({
      position,
      type: 'mechanical',
      scale,
      mesh,
      isAlien: false,
    });
  }

  /**
   * Get count of active effects
   */
  getActiveEffectCount(): number {
    return this.activeEffects.size;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    for (const [id] of this.activeEffects) {
      this.cleanupEffect(id);
    }
    this.activeEffects.clear();

    this.scene = null;
    DeathEffects.instance = null;
    console.log('[DeathEffects] Disposed');
  }
}

// Export singleton accessor
export const deathEffects = DeathEffects.getInstance();
