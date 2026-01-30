/**
 * StationLevel - Base class for interior space station levels
 *
 * Features:
 * - Space view through windows (skybox + distant planet)
 * - Interior lighting setup
 * - Station-specific atmosphere
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { BaseLevel } from './BaseLevel';
import type { LevelCallbacks, LevelConfig } from './types';

export abstract class StationLevel extends BaseLevel {
  // Space view elements
  protected skybox: Mesh | null = null;
  protected distantPlanet: Mesh | null = null;

  // Station lighting
  protected stationLights: PointLight[] = [];

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    // Dark space background
    return new Color4(0.02, 0.02, 0.04, 1);
  }

  protected override setupBasicLighting(): void {
    // Override default outdoor lighting with interior station lighting

    // Ambient fill - lower intensity for stations
    this.ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    this.ambientLight.intensity = 0.2;
    this.ambientLight.diffuse = new Color3(0.4, 0.4, 0.5);
    this.ambientLight.groundColor = new Color3(0.1, 0.1, 0.15);
  }

  /**
   * Create the space view visible through windows
   */
  protected createSpaceView(): void {
    // Starfield skybox
    this.skybox = MeshBuilder.CreateBox('spaceSkybox', { size: 5000 }, this.scene);
    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.diffuseColor = Color3.Black();
    skyMat.emissiveColor = new Color3(0.02, 0.02, 0.04);
    skyMat.specularColor = Color3.Black();
    skyMat.backFaceCulling = false;
    this.skybox.material = skyMat;
    this.skybox.infiniteDistance = true;

    // Distant planet visible through windows
    this.distantPlanet = MeshBuilder.CreateSphere(
      'distantPlanet',
      { diameter: 2000, segments: 32 },
      this.scene
    );
    this.distantPlanet.position.set(1500, -500, 3000); // Visible through side windows

    const planetMat = new StandardMaterial('planetMat', this.scene);
    planetMat.diffuseColor = Color3.FromHexString('#8B6B4A'); // Reddish-brown
    planetMat.specularColor = new Color3(0.1, 0.08, 0.06);
    planetMat.emissiveColor = new Color3(0.05, 0.03, 0.02); // Slight glow
    this.distantPlanet.material = planetMat;
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

  protected disposeLevel(): void {
    // Dispose station lights
    for (const light of this.stationLights) {
      light.dispose();
    }
    this.stationLights = [];

    // Skybox and planet are disposed with scene
    this.skybox = null;
    this.distantPlanet = null;
  }
}
