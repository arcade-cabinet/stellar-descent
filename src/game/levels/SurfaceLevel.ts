/**
 * SurfaceLevel - Base class for exterior planetary surface levels
 *
 * Features:
 * - Procedural terrain generation
 * - Day/night cycle support
 * - Weather system integration
 * - Combat encounters
 * - Outdoor lighting with atmosphere
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { BaseLevel } from './BaseLevel';
import type { LevelCallbacks, LevelConfig } from './types';

// Surface-specific configuration
export interface SurfaceConfig {
  // Terrain settings
  terrainSize?: number;
  heightScale?: number;

  // Time of day (0-1, where 0.5 is noon)
  timeOfDay?: number;

  // Weather
  fogDensity?: number;
  dustIntensity?: number;

  // Combat
  enemyDensity?: number;
  maxEnemies?: number;
}

export abstract class SurfaceLevel extends BaseLevel {
  // Terrain
  protected terrain: Mesh | null = null;
  protected terrainMaterial: StandardMaterial | null = null;

  // Sky elements
  protected skyDome: Mesh | null = null;
  protected sun: Mesh | null = null;

  // Lighting
  protected sunLight: DirectionalLight | null = null;
  protected skyLight: HemisphericLight | null = null;

  // Time of day (0-1 cycle)
  protected timeOfDay = 0.5; // Default noon
  protected timeSpeed = 0; // 0 = static, otherwise cycles

  // Surface configuration
  protected surfaceConfig: SurfaceConfig;

  // Combat state
  protected inCombat = false;
  protected activeEnemies: Map<string, { mesh: Mesh; health: number }> = new Map();

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks,
    surfaceConfig: SurfaceConfig = {}
  ) {
    super(engine, canvas, config, callbacks);
    this.surfaceConfig = {
      terrainSize: 500,
      heightScale: 50,
      timeOfDay: 0.5,
      fogDensity: 0.002,
      dustIntensity: 0.1,
      enemyDensity: 0.5,
      maxEnemies: 20,
      ...surfaceConfig,
    };
    this.timeOfDay = this.surfaceConfig.timeOfDay ?? 0.5;
  }

  protected getBackgroundColor(): Color4 {
    // Mars-like dusty atmosphere
    const t = this.timeOfDay;
    // Interpolate between night, dawn/dusk, and day colors
    if (t < 0.25 || t > 0.75) {
      // Night
      return new Color4(0.02, 0.02, 0.05, 1);
    } else if (t < 0.35 || t > 0.65) {
      // Dawn/dusk
      return new Color4(0.4, 0.2, 0.1, 1);
    } else {
      // Day - dusty orange-red
      return new Color4(0.6, 0.35, 0.2, 1);
    }
  }

  protected override setupBasicLighting(): void {
    // Sun directional light
    const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(sunAngle);
    const sunZ = Math.cos(sunAngle);

    this.sunLight = new DirectionalLight(
      'sun',
      new Vector3(0.2, -sunY, sunZ).normalize(),
      this.scene
    );
    this.sunLight.intensity = this.getSunIntensity();
    this.sunLight.diffuse = this.getSunColor();

    // Ambient sky light
    this.skyLight = new HemisphericLight('sky', new Vector3(0, 1, 0), this.scene);
    this.skyLight.intensity = 0.3;
    this.skyLight.diffuse = new Color3(0.5, 0.4, 0.35);
    this.skyLight.groundColor = new Color3(0.3, 0.2, 0.15);
  }

  /**
   * Get sun intensity based on time of day
   */
  protected getSunIntensity(): number {
    const t = this.timeOfDay;
    if (t < 0.2 || t > 0.8) return 0.1; // Night
    if (t < 0.3 || t > 0.7) return 0.5; // Dawn/dusk
    return 1.5; // Day
  }

  /**
   * Get sun color based on time of day
   */
  protected getSunColor(): Color3 {
    const t = this.timeOfDay;
    if (t < 0.25 || t > 0.75) {
      // Night - dim blue-white
      return new Color3(0.3, 0.3, 0.4);
    } else if (t < 0.35 || t > 0.65) {
      // Dawn/dusk - orange
      return new Color3(1.0, 0.6, 0.3);
    } else {
      // Day - warm white
      return new Color3(1.0, 0.95, 0.85);
    }
  }

  /**
   * Create a basic sky dome
   */
  protected createSkyDome(): void {
    this.skyDome = MeshBuilder.CreateSphere(
      'skyDome',
      { diameter: 4000, segments: 32, sideOrientation: 1 }, // Inside-out
      this.scene
    );

    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.emissiveColor = this.getSkyGradientColor();
    this.skyDome.material = skyMat;
    this.skyDome.infiniteDistance = true;
    this.skyDome.renderingGroupId = 0;
  }

  /**
   * Get sky gradient color based on time
   */
  protected getSkyGradientColor(): Color3 {
    const t = this.timeOfDay;
    if (t < 0.2 || t > 0.8) {
      // Night sky
      return new Color3(0.02, 0.02, 0.05);
    } else if (t < 0.3 || t > 0.7) {
      // Dawn/dusk
      return new Color3(0.5, 0.25, 0.15);
    } else {
      // Day - dusty orange
      return new Color3(0.7, 0.45, 0.3);
    }
  }

  /**
   * Create a visual sun in the sky
   */
  protected createSun(): void {
    this.sun = MeshBuilder.CreateSphere('sun', { diameter: 100, segments: 16 }, this.scene);
    const sunMat = new StandardMaterial('sunMat', this.scene);
    sunMat.emissiveColor = new Color3(1, 0.9, 0.7);
    sunMat.disableLighting = true;
    this.sun.material = sunMat;
    this.sun.renderingGroupId = 0;

    // Position based on time of day
    this.updateSunPosition();
  }

  /**
   * Update sun position based on time of day
   */
  protected updateSunPosition(): void {
    if (!this.sun) return;

    const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const distance = 1500;
    const height = Math.sin(angle) * distance;
    const depth = Math.cos(angle) * distance;

    this.sun.position.set(0, height, depth);
    this.sun.isVisible = height > -50; // Hide when below horizon
  }

  /**
   * Update time-based lighting
   */
  protected updateTimeOfDay(deltaTime: number): void {
    if (this.timeSpeed === 0) return;

    this.timeOfDay = (this.timeOfDay + deltaTime * this.timeSpeed) % 1;

    // Update sun
    this.updateSunPosition();
    if (this.sunLight) {
      const sunAngle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
      const sunY = Math.sin(sunAngle);
      const sunZ = Math.cos(sunAngle);
      this.sunLight.direction = new Vector3(0.2, -sunY, sunZ).normalize();
      this.sunLight.intensity = this.getSunIntensity();
      this.sunLight.diffuse = this.getSunColor();
    }

    // Update sky
    if (this.skyDome) {
      const skyMat = this.skyDome.material as StandardMaterial;
      skyMat.emissiveColor = this.getSkyGradientColor();
    }

    // Update scene background
    this.scene.clearColor = this.getBackgroundColor();
  }

  /**
   * Set combat state and notify callbacks
   */
  protected setCombatState(inCombat: boolean): void {
    if (this.inCombat !== inCombat) {
      this.inCombat = inCombat;
      this.callbacks.onCombatStateChange(inCombat);
    }
  }

  protected override getMoveSpeed(): number {
    // Faster outdoor movement
    return 8;
  }

  protected disposeLevel(): void {
    // Dispose terrain
    this.terrain?.dispose();
    this.terrain = null;
    this.terrainMaterial?.dispose();
    this.terrainMaterial = null;

    // Dispose sky elements
    this.skyDome?.dispose();
    this.skyDome = null;
    this.sun?.dispose();
    this.sun = null;

    // Dispose enemies
    for (const enemy of this.activeEnemies.values()) {
      enemy.mesh.dispose();
    }
    this.activeEnemies.clear();
  }
}
