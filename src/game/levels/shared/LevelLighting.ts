/**
 * LevelLighting - Composable lighting system for levels
 *
 * Extracted from BaseLevel for composition over inheritance.
 * Handles PBR-compatible lighting setup for different level environments.
 *
 * CRITICAL: GLB models use PBR materials which require MUCH higher light
 * intensity values than StandardMaterial. What looks "blinding" for
 * StandardMaterial is merely "adequate" for PBR.
 *
 * Usage:
 *   const lighting = new LevelLighting(scene, 'station');
 *   lighting.setup();
 *   lighting.addPointLight('corridor_1', position, Color3.White(), 8.0);
 */

import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../../core/Logger';

const log = getLogger('LevelLighting');

export type LevelLightingType = 'station' | 'surface' | 'underground' | 'hive' | 'space';

/**
 * Lighting presets for different level types
 * All values calibrated for PBR materials
 */
const LIGHTING_PRESETS: Record<
  LevelLightingType,
  {
    sunIntensity: number;
    sunColor: Color3;
    sunDirection: Vector3;
    ambientIntensity: number;
    ambientDiffuse: Color3;
    ambientGround: Color3;
    sceneAmbient: Color3;
    environmentIntensity: number;
  }
> = {
  // STATION: Bright fluorescent indoor lighting
  station: {
    sunIntensity: 5.0,
    sunColor: new Color3(0.95, 0.95, 1.0),
    sunDirection: new Vector3(0.1, -1, 0.1).normalize(),
    ambientIntensity: 2.5,
    ambientDiffuse: new Color3(0.9, 0.9, 0.95),
    ambientGround: new Color3(0.6, 0.6, 0.65),
    sceneAmbient: new Color3(0.4, 0.4, 0.45),
    environmentIntensity: 1.5,
  },

  // SURFACE: Harsh alien sun (Proxima Centauri b)
  surface: {
    sunIntensity: 5.0,
    sunColor: new Color3(1.0, 0.95, 0.85),
    sunDirection: new Vector3(0.3, -0.8, 0.3).normalize(),
    ambientIntensity: 1.5,
    ambientDiffuse: new Color3(0.7, 0.6, 0.5),
    ambientGround: new Color3(0.5, 0.4, 0.35),
    sceneAmbient: new Color3(0.3, 0.25, 0.2),
    environmentIntensity: 1.0,
  },

  // UNDERGROUND: Dim with artificial lights
  underground: {
    sunIntensity: 0.5,
    sunColor: new Color3(0.4, 0.4, 0.5),
    sunDirection: new Vector3(0, -1, 0),
    ambientIntensity: 1.0,
    ambientDiffuse: new Color3(0.5, 0.5, 0.6),
    ambientGround: new Color3(0.3, 0.3, 0.35),
    sceneAmbient: new Color3(0.2, 0.2, 0.25),
    environmentIntensity: 0.8,
  },

  // HIVE: Bioluminescent alien lighting
  hive: {
    sunIntensity: 0.3,
    sunColor: new Color3(0.3, 0.5, 0.4),
    sunDirection: new Vector3(0, -1, 0),
    ambientIntensity: 1.2,
    ambientDiffuse: new Color3(0.4, 0.6, 0.5),
    ambientGround: new Color3(0.2, 0.4, 0.3),
    sceneAmbient: new Color3(0.15, 0.25, 0.2),
    environmentIntensity: 0.6,
  },

  // SPACE: Dark with point lights
  space: {
    sunIntensity: 2.0,
    sunColor: new Color3(1.0, 1.0, 1.0),
    sunDirection: new Vector3(0.5, -0.5, 0.5).normalize(),
    ambientIntensity: 0.5,
    ambientDiffuse: new Color3(0.3, 0.3, 0.4),
    ambientGround: new Color3(0.1, 0.1, 0.15),
    sceneAmbient: new Color3(0.1, 0.1, 0.15),
    environmentIntensity: 0.5,
  },
};

export class LevelLighting {
  private scene: Scene;
  private type: LevelLightingType;
  private sunLight: DirectionalLight | null = null;
  private ambientLight: HemisphericLight | null = null;
  private pointLights: Map<string, PointLight> = new Map();

  constructor(scene: Scene, type: LevelLightingType) {
    this.scene = scene;
    this.type = type;
  }

  /**
   * Set up lighting based on level type
   */
  setup(): void {
    const preset = LIGHTING_PRESETS[this.type];
    log.info(`Setting up ${this.type} lighting (PBR-calibrated)`);

    // Primary directional light
    this.sunLight = new DirectionalLight('sunLight', preset.sunDirection, this.scene);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunLight.diffuse = preset.sunColor;
    this.sunLight.specular = preset.sunColor.scale(0.8);

    // Hemispheric ambient fill
    this.ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this.scene);
    this.ambientLight.intensity = preset.ambientIntensity;
    this.ambientLight.diffuse = preset.ambientDiffuse;
    this.ambientLight.groundColor = preset.ambientGround;
    this.ambientLight.specular = preset.ambientDiffuse.scale(0.5);

    // Scene ambient color for PBR shadow fill
    this.scene.ambientColor = preset.sceneAmbient;

    log.debug(
      `Lighting configured: sun=${preset.sunIntensity}, ambient=${preset.ambientIntensity}`
    );
  }

  /**
   * Get recommended environment intensity for skybox/IBL
   */
  getEnvironmentIntensity(): number {
    return LIGHTING_PRESETS[this.type].environmentIntensity;
  }

  /**
   * Add a point light (for interior areas, fixtures, etc.)
   */
  addPointLight(
    id: string,
    position: Vector3,
    color: Color3 = Color3.White(),
    intensity = 5.0,
    range = 20
  ): PointLight {
    const light = new PointLight(id, position, this.scene);
    light.diffuse = color;
    light.specular = color;
    light.intensity = intensity;
    light.range = range;
    this.pointLights.set(id, light);
    return light;
  }

  /**
   * Add emergency/red lighting
   */
  addEmergencyLight(id: string, position: Vector3, intensity = 3.0): PointLight {
    return this.addPointLight(id, position, new Color3(1.0, 0.2, 0.1), intensity, 15);
  }

  /**
   * Add bioluminescent lighting (for hive levels)
   */
  addBioluminescentLight(id: string, position: Vector3, intensity = 4.0): PointLight {
    return this.addPointLight(id, position, new Color3(0.3, 0.8, 0.5), intensity, 12);
  }

  /**
   * Remove a point light
   */
  removePointLight(id: string): void {
    const light = this.pointLights.get(id);
    if (light) {
      light.dispose();
      this.pointLights.delete(id);
    }
  }

  /**
   * Set sun intensity (for time-of-day changes)
   */
  setSunIntensity(intensity: number): void {
    if (this.sunLight) {
      this.sunLight.intensity = intensity;
    }
  }

  /**
   * Set sun color (for time-of-day changes)
   */
  setSunColor(color: Color3): void {
    if (this.sunLight) {
      this.sunLight.diffuse = color;
      this.sunLight.specular = color.scale(0.8);
    }
  }

  /**
   * Set sun direction (for time-of-day changes)
   */
  setSunDirection(direction: Vector3): void {
    if (this.sunLight) {
      this.sunLight.direction = direction.normalize();
    }
  }

  /**
   * Get sun light reference
   */
  getSunLight(): DirectionalLight | null {
    return this.sunLight;
  }

  /**
   * Get ambient light reference
   */
  getAmbientLight(): HemisphericLight | null {
    return this.ambientLight;
  }

  dispose(): void {
    if (this.sunLight) {
      this.sunLight.dispose();
      this.sunLight = null;
    }
    if (this.ambientLight) {
      this.ambientLight.dispose();
      this.ambientLight = null;
    }
    for (const light of this.pointLights.values()) {
      light.dispose();
    }
    this.pointLights.clear();
  }
}
