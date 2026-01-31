/**
 * TerrainGenerator - PBR Ground Mesh with GLB Rock Formations
 *
 * Creates high-quality terrain using Babylon.js GroundMesh with PBR materials
 * and AmbientCG textures for realistic ground surfaces. GLB models are used
 * for rock formations and decorative elements.
 *
 * Key features:
 * - PBRMaterial with albedo, normal, roughness textures
 * - Configurable biome textures (rock, ice, sand, etc.)
 * - GLB rock formations from alien-flora pack
 * - Physics-enabled ground collisions via PhysicsAggregate
 * - Hand-crafted rock placement positions (no procedural generation)
 */

import { PhysicsShapeType } from '@babylonjs/core/Physics/';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { AssetManager } from '../core/AssetManager';
import { getLogger } from '../core/Logger';
import { tokens } from '../utils/designTokens';

const log = getLogger('TerrainGenerator');
import {
  type TerrainBiomeConfig,
  LANDFALL_TERRAIN_CONFIG,
  CANYON_TERRAIN_CONFIG,
  ICE_TERRAIN_CONFIG,
  createPBRTerrainMaterial,
} from '../levels/shared/PBRTerrainMaterials';

// ---------------------------------------------------------------------------
// GLB Asset Paths
// ---------------------------------------------------------------------------

/** Ground tile GLB paths */
const GROUND_GLB_PATHS = [
  '/assets/models/environment/station/asphalt_hr_1_large.glb',
  '/assets/models/environment/station/asphalt_hr_1.glb',
  '/assets/models/environment/station/asphalt_hr_2.glb',
  '/assets/models/environment/station/asphalt_hr_3.glb',
  '/assets/models/environment/station/floor_ceiling_hr_4.glb',
  '/assets/models/environment/station/floor_ceiling_hr_5.glb',
  '/assets/models/environment/station/floor_ceiling_hr_6.glb',
];

/** Tall, pillar-like rock formations -- good for vertical obstacles */
const TALL_ROCK_GLBS = [
  '/assets/models/environment/alien-flora/alien_tall_rock_1_01.glb',
  '/assets/models/environment/alien-flora/alien_tall_rock_2_01.glb',
  '/assets/models/environment/alien-flora/alien_tall_rock_3_01.glb',
];

/** Medium rocks for variety */
const MEDIUM_ROCK_GLBS = [
  '/assets/models/environment/alien-flora/alien_rock_medium_1.glb',
  '/assets/models/environment/alien-flora/alien_rock_medium_2.glb',
  '/assets/models/environment/alien-flora/alien_rock_medium_3.glb',
];

/** Large boulder accent */
const BOULDER_GLBS = ['/assets/models/environment/alien-flora/alien_boulder_polyhaven.glb'];

/** All rock GLBs combined for preloading */
const ALL_ROCK_GLBS = [...TALL_ROCK_GLBS, ...MEDIUM_ROCK_GLBS, ...BOULDER_GLBS];

/** All GLB assets for preloading */
const ALL_TERRAIN_GLBS = [...GROUND_GLB_PATHS, ...ALL_ROCK_GLBS];

// ---------------------------------------------------------------------------
// Pre-defined rock formation positions (hand-crafted layout)
// ---------------------------------------------------------------------------

export interface RockPlacement {
  position: Vector3;
  type: 'tall' | 'medium' | 'boulder';
  scale: number;
  rotationY: number;
  variant: number;
}

/** Default rock formation layout for exterior levels */
const DEFAULT_ROCK_FORMATIONS: RockPlacement[] = [
  // Ring of tall rocks at distance 150-200
  { position: new Vector3(150, 0, 0), type: 'tall', scale: 4, rotationY: 0, variant: 0 },
  { position: new Vector3(106, 0, 106), type: 'tall', scale: 5, rotationY: 0.5, variant: 1 },
  { position: new Vector3(0, 0, 150), type: 'tall', scale: 4.5, rotationY: 1.0, variant: 2 },
  { position: new Vector3(-106, 0, 106), type: 'tall', scale: 5.5, rotationY: 1.5, variant: 0 },
  { position: new Vector3(-150, 0, 0), type: 'tall', scale: 4, rotationY: 2.0, variant: 1 },
  { position: new Vector3(-106, 0, -106), type: 'tall', scale: 5, rotationY: 2.5, variant: 2 },
  { position: new Vector3(0, 0, -150), type: 'tall', scale: 4.5, rotationY: 3.0, variant: 0 },
  { position: new Vector3(106, 0, -106), type: 'tall', scale: 5.5, rotationY: 3.5, variant: 1 },

  // Medium rocks at distance 250-350
  { position: new Vector3(280, 0, 50), type: 'medium', scale: 3, rotationY: 0.3, variant: 0 },
  { position: new Vector3(200, 0, 200), type: 'medium', scale: 3.5, rotationY: 0.8, variant: 1 },
  { position: new Vector3(50, 0, 280), type: 'medium', scale: 2.8, rotationY: 1.3, variant: 2 },
  { position: new Vector3(-150, 0, 250), type: 'medium', scale: 3.2, rotationY: 1.8, variant: 0 },
  { position: new Vector3(-280, 0, 50), type: 'medium', scale: 3, rotationY: 2.3, variant: 1 },
  { position: new Vector3(-250, 0, -150), type: 'medium', scale: 3.5, rotationY: 2.8, variant: 2 },
  { position: new Vector3(-50, 0, -280), type: 'medium', scale: 2.8, rotationY: 3.3, variant: 0 },
  { position: new Vector3(200, 0, -200), type: 'medium', scale: 3.2, rotationY: 3.8, variant: 1 },

  // Scattered boulders at various distances
  { position: new Vector3(400, 0, 100), type: 'boulder', scale: 5, rotationY: 0.5, variant: 0 },
  { position: new Vector3(100, 0, 400), type: 'boulder', scale: 6, rotationY: 1.2, variant: 0 },
  { position: new Vector3(-300, 0, 300), type: 'boulder', scale: 5.5, rotationY: 2.0, variant: 0 },
  { position: new Vector3(-400, 0, -100), type: 'boulder', scale: 5, rotationY: 2.8, variant: 0 },
  { position: new Vector3(-100, 0, -400), type: 'boulder', scale: 6, rotationY: 3.5, variant: 0 },
  { position: new Vector3(300, 0, -300), type: 'boulder', scale: 5.5, rotationY: 4.2, variant: 0 },

  // Inner scattered rocks at distance 80-120
  { position: new Vector3(90, 0, 40), type: 'medium', scale: 2, rotationY: 0.7, variant: 2 },
  { position: new Vector3(40, 0, 90), type: 'medium', scale: 2.2, rotationY: 1.4, variant: 0 },
  { position: new Vector3(-80, 0, 60), type: 'medium', scale: 2.5, rotationY: 2.1, variant: 1 },
  { position: new Vector3(-60, 0, -80), type: 'medium', scale: 2, rotationY: 2.8, variant: 2 },
  { position: new Vector3(70, 0, -70), type: 'medium', scale: 2.3, rotationY: 3.5, variant: 0 },

  // Far distant tall rocks for skyline (distance 500-700)
  { position: new Vector3(600, 0, 0), type: 'tall', scale: 8, rotationY: 0.2, variant: 0 },
  { position: new Vector3(424, 0, 424), type: 'tall', scale: 7, rotationY: 0.9, variant: 1 },
  { position: new Vector3(0, 0, 600), type: 'tall', scale: 8.5, rotationY: 1.6, variant: 2 },
  { position: new Vector3(-424, 0, 424), type: 'tall', scale: 7.5, rotationY: 2.3, variant: 0 },
  { position: new Vector3(-600, 0, 0), type: 'tall', scale: 8, rotationY: 3.0, variant: 1 },
  { position: new Vector3(-424, 0, -424), type: 'tall', scale: 7, rotationY: 3.7, variant: 2 },
  { position: new Vector3(0, 0, -600), type: 'tall', scale: 8.5, rotationY: 4.4, variant: 0 },
  { position: new Vector3(424, 0, -424), type: 'tall', scale: 7.5, rotationY: 5.1, variant: 1 },
];

// ---------------------------------------------------------------------------
// Ground tile configuration
// ---------------------------------------------------------------------------

export interface GroundTilePlacement {
  position: Vector3;
  scale: Vector3;
  rotationY: number;
  variant: number;
}

/** Large ground area coverage using asphalt tiles */
const DEFAULT_GROUND_TILES: GroundTilePlacement[] = [
  // Central large tile
  { position: new Vector3(0, 0, 0), scale: new Vector3(20, 1, 20), rotationY: 0, variant: 0 },
  // Surrounding tiles for coverage
  { position: new Vector3(200, 0, 0), scale: new Vector3(18, 1, 18), rotationY: 0.1, variant: 1 },
  { position: new Vector3(-200, 0, 0), scale: new Vector3(18, 1, 18), rotationY: -0.1, variant: 2 },
  { position: new Vector3(0, 0, 200), scale: new Vector3(18, 1, 18), rotationY: 0.2, variant: 3 },
  { position: new Vector3(0, 0, -200), scale: new Vector3(18, 1, 18), rotationY: -0.2, variant: 4 },
  { position: new Vector3(141, 0, 141), scale: new Vector3(16, 1, 16), rotationY: 0.3, variant: 5 },
  { position: new Vector3(-141, 0, 141), scale: new Vector3(16, 1, 16), rotationY: -0.3, variant: 6 },
  { position: new Vector3(-141, 0, -141), scale: new Vector3(16, 1, 16), rotationY: 0.4, variant: 0 },
  { position: new Vector3(141, 0, -141), scale: new Vector3(16, 1, 16), rotationY: -0.4, variant: 1 },
];

// ---------------------------------------------------------------------------
// TerrainGenerator Class
// ---------------------------------------------------------------------------

export class TerrainGenerator {
  private scene: Scene;
  private groundMesh: Mesh | null = null;
  private glbNodes: TransformNode[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Preload all terrain GLB assets into the AssetManager cache.
   * Call this once before creating terrain elements.
   */
  async preloadTerrainAssets(): Promise<void> {
    await Promise.all(
      ALL_TERRAIN_GLBS.map((path) => AssetManager.loadAssetByPath(path, this.scene))
    );
    log.info(`Preloaded ${ALL_TERRAIN_GLBS.length} terrain GLB assets`);
  }

  /**
   * Preload all rock/boulder GLBs into the AssetManager cache.
   * Call this once before createRockFormations to avoid per-instance loads.
   */
  async preloadRockAssets(): Promise<void> {
    await Promise.all(ALL_ROCK_GLBS.map((path) => AssetManager.loadAssetByPath(path, this.scene)));
  }

  /**
   * Create the main ground plane with collision physics and PBR materials.
   * Uses GroundMesh with high subdivision for visual quality and physics.
   *
   * @param biomeConfig - Optional biome configuration for PBR textures.
   *                      Defaults to LANDFALL_TERRAIN_CONFIG.
   * @param size - Ground plane size (default 2000)
   * @param subdivisions - Mesh subdivisions for detail (default 64)
   */
  createMainGround(
    biomeConfig: TerrainBiomeConfig = LANDFALL_TERRAIN_CONFIG,
    size: number = 2000,
    subdivisions: number = 64
  ): Mesh {
    // Create a large ground plane with subdivisions for visual quality
    const ground = MeshBuilder.CreateGround(
      'mainGround',
      { width: size, height: size, subdivisions },
      this.scene
    );

    // Create PBR material with AmbientCG textures
    const groundMat = createPBRTerrainMaterial(this.scene, biomeConfig, 'mainGroundMat');

    // Adjust UV scale for large terrain
    const uvScale = 0.015 * size;
    if (groundMat.albedoTexture instanceof Texture) {
      groundMat.albedoTexture.uScale = uvScale;
      groundMat.albedoTexture.vScale = uvScale;
    }
    if (groundMat.bumpTexture instanceof Texture) {
      groundMat.bumpTexture.uScale = uvScale;
      groundMat.bumpTexture.vScale = uvScale;
    }
    if (groundMat.metallicTexture instanceof Texture) {
      groundMat.metallicTexture.uScale = uvScale;
      groundMat.metallicTexture.vScale = uvScale;
    }

    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    // Add physics
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    this.groundMesh = ground;
    return ground;
  }

  /**
   * Create the main ground plane with simple StandardMaterial.
   * Fallback for when PBR is not needed or textures are unavailable.
   */
  createMainGroundSimple(): Mesh {
    const ground = MeshBuilder.CreateGround(
      'mainGround',
      { width: 2000, height: 2000, subdivisions: 1 },
      this.scene
    );

    const groundMat = new StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.tan);
    groundMat.specularColor = new Color3(0.15, 0.12, 0.1);
    groundMat.specularPower = 8;

    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    this.groundMesh = ground;
    return ground;
  }

  /**
   * Create GLB-based ground tiles for visual detail.
   * These are placed on top of the collision ground plane.
   */
  async createGroundTiles(
    tiles: GroundTilePlacement[] = DEFAULT_GROUND_TILES
  ): Promise<TransformNode[]> {
    // Ensure assets are preloaded
    await this.preloadTerrainAssets();

    const nodes: TransformNode[] = [];

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const glbPath = GROUND_GLB_PATHS[tile.variant % GROUND_GLB_PATHS.length];

      const node = AssetManager.createInstanceByPath(
        glbPath,
        `groundTile_${i}`,
        this.scene,
        true,
        'environment'
      );

      if (!node) {
        log.warn(`Failed to instance ground tile: ${glbPath}`);
        continue;
      }

      node.position.copyFrom(tile.position);
      node.position.y = 0.01; // Slightly above collision ground
      node.scaling.copyFrom(tile.scale);
      node.rotation.y = tile.rotationY;

      nodes.push(node);
      this.glbNodes.push(node);
    }

    return nodes;
  }

  /**
   * Create rock formations by instancing GLB models at predefined positions.
   *
   * Uses the DEFAULT_ROCK_FORMATIONS layout for hand-crafted placement.
   * GLBs must have been preloaded via preloadRockAssets before calling.
   */
  async createRockFormations(
    formations: RockPlacement[] = DEFAULT_ROCK_FORMATIONS
  ): Promise<TransformNode[]> {
    // Ensure assets are loaded
    await this.preloadRockAssets();

    const rocks: TransformNode[] = [];

    for (let i = 0; i < formations.length; i++) {
      const placement = formations[i];

      // Select GLB path based on type and variant
      let glbPath: string;
      switch (placement.type) {
        case 'tall':
          glbPath = TALL_ROCK_GLBS[placement.variant % TALL_ROCK_GLBS.length];
          break;
        case 'medium':
          glbPath = MEDIUM_ROCK_GLBS[placement.variant % MEDIUM_ROCK_GLBS.length];
          break;
        case 'boulder':
        default:
          glbPath = BOULDER_GLBS[placement.variant % BOULDER_GLBS.length];
          break;
      }

      const instanceName = `rockFormation_${placement.type}_${i}`;
      const node = AssetManager.createInstanceByPath(
        glbPath,
        instanceName,
        this.scene,
        true,
        'environment'
      );

      if (!node) {
        log.warn(`Failed to instance rock GLB: ${glbPath}`);
        continue;
      }

      node.position.copyFrom(placement.position);
      node.scaling.setAll(placement.scale);
      node.rotation.y = placement.rotationY;

      // Add slight tilt for natural look on tall rocks
      if (placement.type === 'tall') {
        node.rotation.x = (placement.variant * 0.1) - 0.15;
        node.rotation.z = (placement.variant * 0.08) - 0.12;
      }

      rocks.push(node);
      this.glbNodes.push(node);
    }

    return rocks;
  }

  /**
   * Create distant mountain ring using tall rock GLBs at large scale.
   * Provides a dramatic skyline without procedural geometry.
   */
  async createDistantMountains(): Promise<TransformNode[]> {
    await this.preloadRockAssets();

    const mountains: TransformNode[] = [];
    const mountainCount = 16;
    const radius = 1400;

    for (let i = 0; i < mountainCount; i++) {
      const angle = (i / mountainCount) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const glbPath = TALL_ROCK_GLBS[i % TALL_ROCK_GLBS.length];
      const instanceName = `distantMountain_${i}`;

      const node = AssetManager.createInstanceByPath(
        glbPath,
        instanceName,
        this.scene,
        true,
        'environment'
      );

      if (!node) {
        continue;
      }

      node.position.set(x, 0, z);

      // Very large scale for distant mountains
      const scale = 15 + (i % 3) * 5;
      node.scaling.setAll(scale);
      node.rotation.y = angle + 0.5;

      mountains.push(node);
      this.glbNodes.push(node);
    }

    return mountains;
  }

  /**
   * Dispose all GLB instances created by this generator.
   */
  dispose(): void {
    for (const node of this.glbNodes) {
      node.dispose(false, true);
    }
    this.glbNodes = [];

    if (this.groundMesh) {
      this.groundMesh.dispose();
      this.groundMesh = null;
    }
  }
}
