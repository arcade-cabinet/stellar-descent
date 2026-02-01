/**
 * StationLevel - Base class for interior space station levels
 *
 * CRITICAL: This is an INDOOR level. No fog, no ground mesh, no skybox illumination.
 *
 * Features:
 * - INDOOR environment: NO fog, NO ground mesh, NO outdoor lighting
 * - Space view through windows (optional - skybox only for visual effect)
 * - Interior lighting setup with point lights (primary illumination)
 * - Proper FOV for indoor FPS gameplay (65-70 degrees)
 * - Station floor pieces ARE the floor (no ground mesh needed)
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Scene } from '@babylonjs/core/scene';
import { SkyboxManager, type SkyboxResult } from '../core/SkyboxManager';
import { BaseLevel } from './BaseLevel';
import type { LevelConfig } from './types';

export abstract class StationLevel extends BaseLevel {
  // Space view elements (optional - visible through windows only)
  protected skyboxManager: SkyboxManager | null = null;
  protected skyboxResult: SkyboxResult | null = null;
  protected distantPlanet: Mesh | null = null;

  // Station lighting (primary light sources)
  protected stationLights: PointLight[] = [];

  constructor(engine: Engine, canvas: HTMLCanvasElement, config: LevelConfig) {
    super(engine, canvas, config);

    // CRITICAL: Disable ALL fog for indoor station level
    this.disableFog();
  }

  /**
   * Disable fog completely for indoor stations.
   * Called in constructor and can be called again if something re-enables fog.
   */
  protected disableFog(): void {
    this.scene.fogMode = Scene.FOGMODE_NONE;
    this.scene.fogDensity = 0;
    this.scene.fogStart = 0;
    this.scene.fogEnd = 0;
  }

  protected getBackgroundColor(): Color4 {
    // Very dark background (visible if no skybox or through small gaps)
    return new Color4(0.005, 0.005, 0.01, 1);
  }

  protected override setupBasicLighting(): void {
    // Override default outdoor lighting with interior station lighting
    // This is a UEMC military installation - well-lit, professional, operational
    //
    // CRITICAL FOR PBR: GLB models use PBR materials which behave VERY differently
    // from StandardMaterial. They need:
    // 1. Strong directional/point lights for direct illumination
    // 2. High ambient color for shadow fill
    // 3. Environment texture (IBL) for proper reflections
    //
    // Without these, PBR materials appear almost BLACK.

    // PRIMARY LIGHT: Strong directional "ceiling fluorescent" light
    // This is the main illumination source - bright overhead lighting
    this.sunLight = new DirectionalLight(
      'ceilingLight',
      new Vector3(0.1, -1, 0.1).normalize(), // Pointing down with slight angle
      this.scene
    );
    this.sunLight.intensity = 5.0; // VERY bright for PBR
    this.sunLight.diffuse = new Color3(0.95, 0.95, 1.0); // Clean white fluorescent
    this.sunLight.specular = new Color3(0.8, 0.8, 0.85);

    // SECONDARY: Hemispheric ambient fill - fills shadows
    this.ambientLight = new HemisphericLight('stationAmbient', new Vector3(0, 1, 0), this.scene);
    this.ambientLight.intensity = 2.5; // Strong ambient for PBR shadow fill
    this.ambientLight.diffuse = new Color3(0.9, 0.9, 0.95); // Clean white
    this.ambientLight.groundColor = new Color3(0.6, 0.6, 0.65); // Strong floor bounce
    this.ambientLight.specular = new Color3(0.4, 0.4, 0.4);

    // Scene ambient color - this affects PBR materials in shadow areas
    this.scene.ambientColor = new Color3(0.4, 0.4, 0.45);

    // CRITICAL: Ensure fog stays completely disabled for indoor level
    this.disableFog();
  }

  /**
   * Create the space view visible through windows.
   * The skybox shows space visually, and indoor HDRI is loaded for PBR ambient lighting.
   * Primary illumination still comes from point lights.
   */
  protected createSpaceView(): void {
    // Create space skybox - VISUAL ONLY for what's seen through windows
    // Don't use the space HDRI for environment lighting (it would look wrong indoors)
    this.skyboxManager = new SkyboxManager(this.scene);
    this.skyboxResult = this.skyboxManager.createFallbackSkybox({
      type: 'space',
      size: 10000,
      useEnvironmentLighting: false, // Don't use space HDRI for indoor lighting
      environmentIntensity: 0,
    });

    // Load indoor HDRI for proper PBR ambient lighting (async, fire-and-forget)
    // This provides neutral, soft reflections appropriate for indoor metal/plastic surfaces
    // HIGH intensity (1.5) because PBR materials NEED strong environment lighting
    void this.skyboxManager.loadIndoorEnvironment(1.5);

    // Distant planet visible through windows (far away so it looks small)
    this.distantPlanet = MeshBuilder.CreateSphere(
      'distantPlanet',
      { diameter: 2000, segments: 32 },
      this.scene
    );
    this.distantPlanet.position.set(1500, -500, 3000); // Far away, visible through windows

    const planetMat = new StandardMaterial('planetMat', this.scene);
    planetMat.diffuseColor = Color3.FromHexString('#8B6B4A'); // Reddish-brown (alien world)
    planetMat.specularColor = new Color3(0.1, 0.08, 0.06);
    planetMat.emissiveColor = new Color3(0.05, 0.03, 0.02); // Slight self-illumination
    this.distantPlanet.material = planetMat;

    // Ensure fog stays disabled after skybox creation
    this.disableFog();
  }

  /**
   * Add an interior light fixture
   */
  protected addStationLight(
    name: string,
    position: Vector3,
    color: Color3 = new Color3(0.9, 0.95, 1.0),
    intensity: number = 0.5,
    range: number = 12
  ): PointLight {
    const light = new PointLight(name, position, this.scene);
    light.diffuse = color;
    light.specular = color;
    light.intensity = intensity;
    light.range = range;
    this.stationLights.push(light);
    return light;
  }

  /**
   * Add emergency red lighting
   */
  protected addEmergencyLight(
    name: string,
    position: Vector3,
    intensity: number = 0.3
  ): PointLight {
    return this.addStationLight(
      name,
      position,
      new Color3(1.0, 0.2, 0.1), // Red
      intensity,
      8
    );
  }

  protected override getMoveSpeed(): number {
    // Slower movement inside stations for more careful navigation
    return 4;
  }

  protected override getDefaultFOV(): number {
    // Narrower FOV for indoor station levels - creates claustrophobic atmosphere
    // 70 degrees in radians = 1.22 radians
    return (70 * Math.PI) / 180;
  }

  protected disposeLevel(): void {
    // Dispose station lights
    for (const light of this.stationLights) {
      light.dispose();
    }
    this.stationLights = [];

    // Dispose skybox using manager
    if (this.skyboxManager) {
      this.skyboxManager.dispose();
      this.skyboxManager = null;
    }
    this.skyboxResult = null;
    this.distantPlanet = null;
  }
}
