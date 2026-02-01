/**
 * StationLightTubes - Emissive ceiling light fixtures for station corridors
 *
 * Creates visible, emissive light tube meshes that also emit light.
 * Provides proper "fluorescent tube" lighting for indoor station levels.
 *
 * Usage:
 *   const tubes = new StationLightTubes(scene);
 *   tubes.addLightTube('corridor_1', position, 4, 'horizontal');
 *   tubes.addLightTubeRun(startPos, endPos, 8); // 8 tubes along a corridor
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../../core/Logger';

const log = getLogger('StationLightTubes');

export interface LightTubeConfig {
  /** Length of the tube in meters */
  length?: number;
  /** Radius of the tube */
  radius?: number;
  /** Color of the light (default: white fluorescent) */
  color?: Color3;
  /** Emissive intensity of the tube mesh */
  emissiveIntensity?: number;
  /** Point light intensity */
  lightIntensity?: number;
  /** Point light range */
  lightRange?: number;
  /** Whether tube is horizontal or vertical */
  orientation?: 'horizontal' | 'vertical';
}

const DEFAULT_CONFIG: Required<LightTubeConfig> = {
  length: 2.0,
  radius: 0.05,
  color: new Color3(0.95, 0.95, 1.0), // Clean white fluorescent
  emissiveIntensity: 2.0,
  lightIntensity: 8.0,
  lightRange: 15,
  orientation: 'horizontal',
};

export class StationLightTubes {
  private scene: Scene;
  private tubes: Map<string, { mesh: Mesh; light: PointLight }> = new Map();
  private tubeMaterial: StandardMaterial;

  constructor(scene: Scene, color: Color3 = new Color3(0.95, 0.95, 1.0)) {
    this.scene = scene;

    // Create shared emissive material for all tubes
    this.tubeMaterial = new StandardMaterial('lightTubeMat', scene);
    this.tubeMaterial.diffuseColor = color;
    this.tubeMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
    this.tubeMaterial.emissiveColor = color.scale(2.0); // Strong glow
    this.tubeMaterial.backFaceCulling = false;
  }

  /**
   * Add a single light tube at a position
   */
  addLightTube(
    id: string,
    position: Vector3,
    config: LightTubeConfig = {}
  ): { mesh: Mesh; light: PointLight } {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Create the tube mesh
    const tube = MeshBuilder.CreateCylinder(
      `lightTube_${id}`,
      {
        height: cfg.length,
        diameter: cfg.radius * 2,
        tessellation: 8,
      },
      this.scene
    );

    // Position and orient
    tube.position = position.clone();
    if (cfg.orientation === 'horizontal') {
      tube.rotation.z = Math.PI / 2; // Rotate to horizontal
    }

    // Apply material
    tube.material = this.tubeMaterial;

    // Create point light at the tube center
    const light = new PointLight(`lightTubeLight_${id}`, position, this.scene);
    light.diffuse = cfg.color;
    light.specular = cfg.color.scale(0.5);
    light.intensity = cfg.lightIntensity;
    light.range = cfg.lightRange;

    this.tubes.set(id, { mesh: tube, light });
    return { mesh: tube, light };
  }

  /**
   * Add a run of light tubes along a corridor
   * @param start Start position
   * @param end End position
   * @param count Number of tubes
   * @param config Tube configuration
   */
  addLightTubeRun(
    id: string,
    start: Vector3,
    end: Vector3,
    count: number,
    config: LightTubeConfig = {}
  ): void {
    const direction = end.subtract(start);
    const step = direction.scale(1 / (count + 1));

    for (let i = 1; i <= count; i++) {
      const pos = start.add(step.scale(i));
      this.addLightTube(`${id}_${i}`, pos, config);
    }

    log.debug(`Added ${count} light tubes for ${id}`);
  }

  /**
   * Add ceiling lights for a room/corridor segment
   * @param id Segment identifier
   * @param center Center of the room/corridor
   * @param width Width of the room (X axis)
   * @param depth Depth of the room (Z axis)
   * @param height Ceiling height
   * @param tubesPerRow Number of tubes per row
   * @param rows Number of rows
   */
  addCeilingLights(
    id: string,
    center: Vector3,
    width: number,
    depth: number,
    height: number,
    tubesPerRow: number = 2,
    rows: number = 1,
    config: LightTubeConfig = {}
  ): void {
    const ceilingY = center.y + height - 0.3; // Slightly below ceiling

    for (let row = 0; row < rows; row++) {
      const rowZ = center.z - depth / 2 + (depth / (rows + 1)) * (row + 1);

      for (let col = 0; col < tubesPerRow; col++) {
        const colX = center.x - width / 2 + (width / (tubesPerRow + 1)) * (col + 1);
        const pos = new Vector3(colX, ceilingY, rowZ);
        this.addLightTube(`${id}_r${row}_c${col}`, pos, {
          ...config,
          orientation: 'horizontal',
        });
      }
    }

    log.debug(`Added ceiling lights for ${id}: ${tubesPerRow}x${rows}`);
  }

  /**
   * Add lights along a corridor (single row of tubes along the length)
   */
  addCorridorLights(
    id: string,
    start: Vector3,
    end: Vector3,
    ceilingHeight: number,
    spacing: number = 4,
    config: LightTubeConfig = {}
  ): void {
    const length = Vector3.Distance(start, end);
    const count = Math.max(1, Math.floor(length / spacing));

    const ceilingStart = new Vector3(start.x, ceilingHeight - 0.3, start.z);
    const ceilingEnd = new Vector3(end.x, ceilingHeight - 0.3, end.z);

    this.addLightTubeRun(id, ceilingStart, ceilingEnd, count, {
      ...config,
      length: 1.5, // Shorter tubes for corridors
      lightIntensity: 6.0,
      lightRange: 12,
    });
  }

  /**
   * Set all tubes to emergency mode (red, dimmer)
   */
  setEmergencyMode(enabled: boolean): void {
    if (enabled) {
      this.tubeMaterial.emissiveColor = new Color3(1.0, 0.2, 0.1).scale(1.5);
      this.tubeMaterial.diffuseColor = new Color3(1.0, 0.3, 0.2);
      for (const { light } of this.tubes.values()) {
        light.diffuse = new Color3(1.0, 0.2, 0.1);
        light.intensity *= 0.5;
      }
    } else {
      this.tubeMaterial.emissiveColor = new Color3(0.95, 0.95, 1.0).scale(2.0);
      this.tubeMaterial.diffuseColor = new Color3(0.95, 0.95, 1.0);
      for (const { light } of this.tubes.values()) {
        light.diffuse = new Color3(0.95, 0.95, 1.0);
        light.intensity *= 2.0;
      }
    }
  }

  /**
   * Flicker a specific tube (for damage effects)
   */
  flickerTube(id: string, duration: number = 500): void {
    const tube = this.tubes.get(id);
    if (!tube) return;

    const originalIntensity = tube.light.intensity;
    let flickering = true;

    const flicker = () => {
      if (!flickering) return;
      tube.light.intensity = Math.random() * originalIntensity;
      setTimeout(flicker, 50 + Math.random() * 50);
    };

    flicker();
    setTimeout(() => {
      flickering = false;
      tube.light.intensity = originalIntensity;
    }, duration);
  }

  dispose(): void {
    for (const { mesh, light } of this.tubes.values()) {
      mesh.dispose();
      light.dispose();
    }
    this.tubes.clear();
    this.tubeMaterial.dispose();
  }
}
