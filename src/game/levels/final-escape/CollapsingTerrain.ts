/**
 * CollapsingTerrain - Dynamic Terrain Destruction System
 *
 * Creates a BabylonJS terrain that progressively breaks apart during
 * the Final Escape level. The destruction intensifies as the escape
 * timer counts down.
 *
 * Features:
 * - Terrain that fractures into chunks over time
 * - Chasms opening ahead of / near the player (must steer around)
 * - Falling rock obstacles from canyon walls
 * - Lava/magma emerging from cracks (damage zones)
 * - Procedural destruction tied to timer progress
 * - Particle effects: fire, smoke, debris, sparks
 *
 * Destruction phases (tied to timer progress 0-1 where 1 = time expired):
 * - Phase 0.0-0.25: Minor tremors, small cracks, distant explosions
 * - Phase 0.25-0.5: Chasms begin opening, falling debris intensifies
 * - Phase 0.5-0.75: Large terrain chunks break away, lava emerges
 * - Phase 0.75-1.0: Catastrophic collapse, maximum destruction
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';
import { particleManager } from '../../effects/ParticleManager';

const log = getLogger('CollapsingTerrain');

// ============================================================================
// TYPES
// ============================================================================

export interface CollapsingTerrainConfig {
  /** Length of the terrain along Z axis */
  terrainLength: number;
  /** Width of the terrain along X axis */
  terrainWidth: number;
  /** Number of segments along the path */
  segmentCount: number;
  /** Maximum number of active chasms */
  maxChasms: number;
  /** Maximum number of falling rocks */
  maxFallingRocks: number;
  /** Maximum number of lava pools */
  maxLavaPools: number;
  /** How fast destruction progresses (multiplier) */
  destructionRate: number;
}

interface TerrainSegment {
  mesh: Mesh;
  originalY: number;
  collapsed: boolean;
  collapseProgress: number;
  /** Z position of this segment along the path */
  zPosition: number;
}

interface Chasm {
  mesh: Mesh;
  position: Vector3;
  width: number;
  depth: number;
  openProgress: number;
  /** Rate at which chasm opens (0-1 per second) */
  openRate: number;
  /** Is this chasm fully formed */
  fullyOpen: boolean;
  /** Lava glow light */
  glowLight: PointLight;
}

interface FallingRock {
  mesh: TransformNode;
  velocity: Vector3;
  rotationSpeed: Vector3;
  lifetime: number;
  maxLifetime: number;
  hasLanded: boolean;
  /** Shadow/warning marker on ground */
  shadowMarker: Mesh | null;
}

interface LavaPool {
  mesh: Mesh;
  light: PointLight;
  position: Vector3;
  radius: number;
  growthRate: number;
  currentRadius: number;
  maxRadius: number;
  /** Pulsing animation accumulator */
  pulseAccumulator: number;
}

interface Explosion {
  light: PointLight;
  position: Vector3;
  lifetime: number;
  maxLifetime: number;
  maxIntensity: number;
}

interface GroundCrack {
  mesh: Mesh;
  position: Vector3;
  length: number;
  glowIntensity: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: CollapsingTerrainConfig = {
  terrainLength: 1200,
  terrainWidth: 60,
  segmentCount: 60,
  maxChasms: 8,
  maxFallingRocks: 15,
  maxLavaPools: 10,
  destructionRate: 1.0,
};

// Material color palettes
const TERRAIN_COLOR = Color3.FromHexString('#5A4A3A'); // Rocky brown
const TERRAIN_SPECULAR = new Color3(0.1, 0.08, 0.06);
const LAVA_COLOR = Color3.FromHexString('#FF4400');
const LAVA_EMISSIVE = Color3.FromHexString('#FF6600');
const CRACK_EMISSIVE = Color3.FromHexString('#FF3300');
const ROCK_COLOR = Color3.FromHexString('#6A5A4A');

// GLB paths for debris (falling rocks)
const DEBRIS_GLB_PATHS = [
  '/assets/models/props/debris/brick_mx_1.glb',
  '/assets/models/props/debris/brick_mx_2.glb',
  '/assets/models/props/debris/brick_mx_3.glb',
  '/assets/models/props/debris/brick_mx_4.glb',
  '/assets/models/props/debris/debris_bricks_mx_1.glb',
  '/assets/models/props/debris/debris_bricks_mx_2.glb',
  '/assets/models/props/debris/gravel_pile_hr_1.glb',
  '/assets/models/props/debris/gravel_pile_hr_2.glb',
] as const;

// GLB paths for terrain floor tiles (modular sci-fi floor tiles)
const FLOOR_TILE_GLB_PATHS = [
  '/assets/models/environment/modular/FloorTile_Basic.glb',
  '/assets/models/environment/modular/FloorTile_Basic2.glb',
  '/assets/models/environment/modular/FloorTile_Empty.glb',
] as const;

// GLB paths for canyon wall segments
const WALL_GLB_PATHS = [
  '/assets/models/environment/station/wall_rg_1.glb',
  '/assets/models/environment/station/wall_rg_1_double.glb',
  '/assets/models/environment/station/wall_hr_1.glb',
] as const;

// ============================================================================
// COLLAPSING TERRAIN
// ============================================================================

export class CollapsingTerrain {
  private scene: Scene;
  private config: CollapsingTerrainConfig;

  // Materials (shared across meshes for performance)
  private terrainMaterial: StandardMaterial | null = null;
  private lavaMaterial: StandardMaterial | null = null;
  private rockMaterial: StandardMaterial | null = null;
  private crackMaterial: StandardMaterial | null = null;
  private chasmMaterial: StandardMaterial | null = null;

  // Terrain segments
  private segments: TerrainSegment[] = [];

  // Dynamic destruction elements
  private chasms: Chasm[] = [];
  private fallingRocks: FallingRock[] = [];
  private lavaPools: LavaPool[] = [];
  private explosions: Explosion[] = [];
  private groundCracks: GroundCrack[] = [];

  // Canyon walls (left and right boundaries)
  private leftWallSegments: Mesh[] = [];
  private rightWallSegments: Mesh[] = [];

  // State
  private destructionProgress = 0; // 0 = pristine, 1 = fully destroyed
  private timeSinceLastChasm = 0;
  private timeSinceLastRock = 0;
  private timeSinceLastExplosion = 0;
  private timeSinceLastCrack = 0;
  private totalElapsed = 0;

  // Seeded random for deterministic destruction
  private seed: number;

  // Counter for unique falling rock instance names
  private rockInstanceCounter = 0;

  // Track if debris GLBs have been preloaded
  private debrisPreloaded = false;

  // Track if structural GLBs have been preloaded
  private structuralGLBsPreloaded = false;

  // Counters for unique instance naming
  private terrainSegmentCounter = 0;
  private wallSegmentCounter = 0;

  constructor(scene: Scene, config: Partial<CollapsingTerrainConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.seed = Math.random() * 10000;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Create the initial terrain geometry, materials, and canyon walls.
   */
  async initialize(): Promise<void> {
    this.createMaterials();

    // Initialize particle manager if needed
    particleManager.init(this.scene);

    // Preload all GLBs before creating geometry
    await this.preloadStructuralGLBs();
    this.preloadDebrisGLBs();

    // Create terrain and walls after GLBs are loaded
    this.createTerrainSegments();
    this.createCanyonWalls();

    log.info(
      `Initialized: ${this.config.segmentCount} segments, ` +
        `${this.config.terrainLength}m long, ${this.config.terrainWidth}m wide`
    );
  }

  /**
   * Preload structural GLBs for terrain and walls.
   * This must complete before terrain/wall creation.
   */
  private async preloadStructuralGLBs(): Promise<void> {
    const allPaths = [...FLOOR_TILE_GLB_PATHS, ...WALL_GLB_PATHS];
    const loadPromises = allPaths.map((path) =>
      AssetManager.loadAssetByPath(path, this.scene).catch((err) => {
        log.warn(`Failed to preload structural GLB ${path}:`, err);
        return null;
      })
    );
    await Promise.all(loadPromises);
    this.structuralGLBsPreloaded = true;
    log.info(`Preloaded ${allPaths.length} structural GLBs`);
  }

  /**
   * Preload debris GLBs for falling rocks (fire-and-forget).
   */
  private preloadDebrisGLBs(): void {
    const loadPromises = DEBRIS_GLB_PATHS.map((path) =>
      AssetManager.loadAssetByPath(path, this.scene).catch((err) => {
        log.warn(`Failed to preload debris GLB ${path}:`, err);
        return null;
      })
    );
    Promise.all(loadPromises).then(() => {
      this.debrisPreloaded = true;
      log.info(`Preloaded ${DEBRIS_GLB_PATHS.length} debris GLBs`);
    });
  }

  /**
   * Create shared materials for all terrain elements.
   */
  private createMaterials(): void {
    // Base terrain material
    this.terrainMaterial = new StandardMaterial('terrain_mat', this.scene);
    this.terrainMaterial.diffuseColor = TERRAIN_COLOR;
    this.terrainMaterial.specularColor = TERRAIN_SPECULAR;

    // Lava material (emissive glow)
    this.lavaMaterial = new StandardMaterial('lava_mat', this.scene);
    this.lavaMaterial.diffuseColor = LAVA_COLOR;
    this.lavaMaterial.emissiveColor = LAVA_EMISSIVE;
    this.lavaMaterial.specularColor = new Color3(0.5, 0.3, 0.1);

    // Falling rock material
    this.rockMaterial = new StandardMaterial('rock_mat', this.scene);
    this.rockMaterial.diffuseColor = ROCK_COLOR;
    this.rockMaterial.specularColor = new Color3(0.05, 0.05, 0.05);

    // Crack material (glowing fissure)
    this.crackMaterial = new StandardMaterial('crack_mat', this.scene);
    this.crackMaterial.diffuseColor = new Color3(0.2, 0.05, 0.0);
    this.crackMaterial.emissiveColor = CRACK_EMISSIVE;

    // Chasm interior material (dark void with slight lava glow)
    this.chasmMaterial = new StandardMaterial('chasm_mat', this.scene);
    this.chasmMaterial.diffuseColor = new Color3(0.05, 0.02, 0.01);
    this.chasmMaterial.emissiveColor = new Color3(0.15, 0.05, 0.0);
  }

  /**
   * Create the ground terrain as discrete segments that can individually collapse.
   * Uses GLB floor tile models for visual quality.
   */
  private createTerrainSegments(): void {
    const segLen = this.config.terrainLength / this.config.segmentCount;
    const startZ = 0;

    // Desired scale: each GLB floor tile is scaled to match segment dimensions
    // Floor tiles are typically 4x4m, so we scale to match terrainWidth x segLen
    const tileBaseSize = 4; // Approximate GLB tile size in meters
    const scaleX = this.config.terrainWidth / tileBaseSize;
    const scaleZ = segLen / tileBaseSize;

    for (let i = 0; i < this.config.segmentCount; i++) {
      const zPos = startZ - i * segLen;

      // Pick a floor tile GLB (cycle through variants for visual variety)
      const tileIndex = i % FLOOR_TILE_GLB_PATHS.length;
      const tilePath = FLOOR_TILE_GLB_PATHS[tileIndex];
      const instanceName = `terrain_seg_${this.terrainSegmentCounter++}`;

      // Create GLB instance
      const node = AssetManager.createInstanceByPath(
        tilePath,
        instanceName,
        this.scene,
        true, // apply LOD
        'environment'
      );

      let mesh: Mesh;
      if (node) {
        // Create a wrapper mesh for the segment interface
        // The TransformNode from GLB becomes the visual, but we need a Mesh for the interface
        mesh = MeshBuilder.CreateBox(
          `${instanceName}_collider`,
          {
            width: this.config.terrainWidth,
            height: 0.1, // Thin collision box
            depth: segLen,
          },
          this.scene
        );
        mesh.isVisible = false; // Invisible collision box
        mesh.position.set(0, -0.05, zPos);

        // Parent the GLB visual to the collision mesh
        node.parent = mesh;
        node.position.set(0, 0, 0);
        node.scaling.set(scaleX, 1, scaleZ);
      } else {
        // Fallback if GLB not loaded - keep MeshBuilder box as visible geometry
        log.warn(`GLB not loaded for terrain segment, using fallback: ${tilePath}`);
        mesh = MeshBuilder.CreateBox(
          instanceName,
          {
            width: this.config.terrainWidth,
            height: 2,
            depth: segLen,
          },
          this.scene
        );
        mesh.material = this.terrainMaterial;
      }

      mesh.position.set(0, -1, zPos);

      // Add slight height variation for visual interest
      const heightVariation = this.seededNoise(i * 0.3) * 0.5;
      mesh.position.y += heightVariation;

      this.segments.push({
        mesh,
        originalY: mesh.position.y,
        collapsed: false,
        collapseProgress: 0,
        zPosition: zPos,
      });
    }
  }

  /**
   * Create canyon wall segments on both sides of the terrain.
   * Uses GLB wall models for visual quality.
   */
  private createCanyonWalls(): void {
    const segLen = this.config.terrainLength / this.config.segmentCount;
    const halfWidth = this.config.terrainWidth / 2;
    const wallHeight = 30;
    const wallThickness = 8;

    // Fallback material in case GLB loading fails
    const wallMat = new StandardMaterial('canyon_wall_mat', this.scene);
    wallMat.diffuseColor = Color3.FromHexString('#7A6A5A');
    wallMat.specularColor = new Color3(0.05, 0.05, 0.05);

    // GLB wall base dimensions (approximate, will be scaled)
    const wallBaseWidth = 4;
    const wallBaseHeight = 4;
    const wallBaseDepth = 4;

    for (let i = 0; i < this.config.segmentCount; i++) {
      const zPos = -i * segLen;

      // Vary wall height for visual interest
      const heightVar = this.seededNoise(i * 0.5 + 100) * 10;
      const thisHeight = wallHeight + heightVar;

      // Pick a wall GLB (cycle through variants)
      const wallIndex = i % WALL_GLB_PATHS.length;
      const wallPath = WALL_GLB_PATHS[wallIndex];

      // Scale factors for wall GLBs
      const scaleX = wallThickness / wallBaseWidth;
      const scaleY = thisHeight / wallBaseHeight;
      const scaleZ = (segLen + 0.5) / wallBaseDepth;

      // Left wall
      const leftInstanceName = `left_wall_${this.wallSegmentCounter++}`;
      const leftNode = AssetManager.createInstanceByPath(
        wallPath,
        leftInstanceName,
        this.scene,
        true,
        'environment'
      );

      let leftWall: Mesh;
      if (leftNode) {
        // Create invisible collision box
        leftWall = MeshBuilder.CreateBox(
          `${leftInstanceName}_collider`,
          {
            width: wallThickness,
            height: thisHeight,
            depth: segLen + 0.5,
          },
          this.scene
        );
        leftWall.isVisible = false;
        leftWall.position.set(-halfWidth - wallThickness / 2, thisHeight / 2 - 2, zPos);

        // Parent GLB visual to collision mesh
        leftNode.parent = leftWall;
        leftNode.position.set(0, 0, 0);
        leftNode.scaling.set(scaleX, scaleY, scaleZ);
      } else {
        // Fallback to MeshBuilder box
        leftWall = MeshBuilder.CreateBox(
          leftInstanceName,
          {
            width: wallThickness,
            height: thisHeight,
            depth: segLen + 0.5,
          },
          this.scene
        );
        leftWall.position.set(-halfWidth - wallThickness / 2, thisHeight / 2 - 2, zPos);
        leftWall.material = wallMat;
      }
      this.leftWallSegments.push(leftWall);

      // Right wall
      const rightInstanceName = `right_wall_${this.wallSegmentCounter++}`;
      const rightNode = AssetManager.createInstanceByPath(
        wallPath,
        rightInstanceName,
        this.scene,
        true,
        'environment'
      );

      let rightWall: Mesh;
      if (rightNode) {
        // Create invisible collision box
        rightWall = MeshBuilder.CreateBox(
          `${rightInstanceName}_collider`,
          {
            width: wallThickness,
            height: thisHeight,
            depth: segLen + 0.5,
          },
          this.scene
        );
        rightWall.isVisible = false;
        rightWall.position.set(halfWidth + wallThickness / 2, thisHeight / 2 - 2, zPos);

        // Parent GLB visual to collision mesh
        rightNode.parent = rightWall;
        rightNode.position.set(0, 0, 0);
        rightNode.scaling.set(scaleX, scaleY, scaleZ);
      } else {
        // Fallback to MeshBuilder box
        rightWall = MeshBuilder.CreateBox(
          rightInstanceName,
          {
            width: wallThickness,
            height: thisHeight,
            depth: segLen + 0.5,
          },
          this.scene
        );
        rightWall.position.set(halfWidth + wallThickness / 2, thisHeight / 2 - 2, zPos);
        rightWall.material = wallMat;
      }
      this.rightWallSegments.push(rightWall);
    }
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * Update terrain destruction based on timer progress and player position.
   *
   * @param deltaTime - Frame delta in seconds
   * @param destructionProgress - 0 (start) to 1 (fully destroyed / timer expired)
   * @param playerPosition - Current player camera position
   */
  update(deltaTime: number, destructionProgress: number, playerPosition: Vector3): void {
    this.destructionProgress = Math.min(1, destructionProgress * this.config.destructionRate);
    this.totalElapsed += deltaTime;

    // Spawn dynamic destruction elements based on progress
    this.updateChasmSpawning(deltaTime, playerPosition);
    this.updateRockSpawning(deltaTime, playerPosition);
    this.updateExplosionSpawning(deltaTime, playerPosition);
    this.updateCrackSpawning(deltaTime, playerPosition);
    this.updateLavaPoolGrowth(deltaTime);

    // Animate existing elements
    this.updateChasms(deltaTime);
    this.updateFallingRocks(deltaTime);
    this.updateExplosions(deltaTime);
    this.updateSegmentCollapse(deltaTime, playerPosition);

    // Update lava material pulsing
    this.updateLavaAnimation(deltaTime);
  }

  // ============================================================================
  // CHASM SYSTEM
  // ============================================================================

  /**
   * Spawn new chasms ahead of the player based on destruction progress.
   */
  private updateChasmSpawning(deltaTime: number, playerPosition: Vector3): void {
    this.timeSinceLastChasm += deltaTime;

    // Spawn rate increases with destruction progress
    const spawnInterval = Math.max(2.0, 8.0 - this.destructionProgress * 6.0);

    if (this.timeSinceLastChasm >= spawnInterval && this.chasms.length < this.config.maxChasms) {
      this.timeSinceLastChasm = 0;

      // Spawn ahead of player, offset to one side
      const aheadDistance = 40 + this.seededNoise(this.totalElapsed) * 30;
      const lateralOffset =
        (this.seededNoise(this.totalElapsed + 50) - 0.5) * this.config.terrainWidth * 0.6;

      const chasmPos = new Vector3(lateralOffset, -0.5, playerPosition.z - aheadDistance);

      this.spawnChasm(chasmPos);
    }
  }

  /**
   * Create a new chasm at the given position.
   */
  private spawnChasm(position: Vector3): void {
    const width = 6 + this.seededNoise(this.totalElapsed * 1.1) * 8;
    const depth = 3 + this.seededNoise(this.totalElapsed * 1.3) * 4;

    // Chasm is a dark box that scales up as it opens
    const mesh = MeshBuilder.CreateBox(
      `chasm_${this.chasms.length}`,
      {
        width,
        height: 20, // Deep
        depth,
      },
      this.scene
    );
    mesh.position.copyFrom(position);
    mesh.position.y = -12; // Below ground level
    mesh.material = this.chasmMaterial;
    mesh.scaling.y = 0.01; // Start hidden

    // Lava glow from the chasm
    const glowLight = new PointLight(
      `chasm_glow_${this.chasms.length}`,
      new Vector3(position.x, -2, position.z),
      this.scene
    );
    glowLight.diffuse = new Color3(1, 0.4, 0.1);
    glowLight.intensity = 0;
    glowLight.range = width * 2;

    this.chasms.push({
      mesh,
      position,
      width,
      depth,
      openProgress: 0,
      openRate: 0.15 + this.destructionProgress * 0.2,
      fullyOpen: false,
      glowLight,
    });
  }

  /**
   * Animate existing chasms opening.
   */
  private updateChasms(deltaTime: number): void {
    for (const chasm of this.chasms) {
      if (chasm.fullyOpen) continue;

      chasm.openProgress += chasm.openRate * deltaTime;
      if (chasm.openProgress >= 1) {
        chasm.openProgress = 1;
        chasm.fullyOpen = true;
      }

      // Scale the chasm mesh to reveal
      chasm.mesh.scaling.y = chasm.openProgress;

      // Glow intensifies as chasm opens
      chasm.glowLight.intensity = chasm.openProgress * 3;

      // Pulse the glow light
      const pulse = Math.sin(this.totalElapsed * 3 + chasm.position.x) * 0.3;
      chasm.glowLight.intensity *= 1 + pulse;
    }
  }

  // ============================================================================
  // FALLING ROCKS
  // ============================================================================

  /**
   * Spawn falling rocks from canyon walls.
   */
  private updateRockSpawning(deltaTime: number, playerPosition: Vector3): void {
    this.timeSinceLastRock += deltaTime;

    // Rocks fall more frequently at higher destruction progress
    const spawnInterval = Math.max(0.3, 2.0 - this.destructionProgress * 1.5);

    if (
      this.timeSinceLastRock >= spawnInterval &&
      this.fallingRocks.length < this.config.maxFallingRocks
    ) {
      this.timeSinceLastRock = 0;

      // Spawn from canyon wall tops, near the player
      const side = this.seededNoise(this.totalElapsed * 2.1) > 0.5 ? 1 : -1;
      const halfWidth = this.config.terrainWidth / 2;
      const xPos = side * (halfWidth + 2);
      const zOffset = (this.seededNoise(this.totalElapsed * 3.7) - 0.5) * 60;

      const spawnPos = new Vector3(
        xPos,
        25 + this.seededNoise(this.totalElapsed) * 10,
        playerPosition.z - 20 + zOffset
      );

      this.spawnFallingRock(spawnPos, side);
    }
  }

  /**
   * Create a falling rock at the given position using GLB debris models.
   */
  private spawnFallingRock(position: Vector3, sideDirection: number): void {
    const size = 0.8 + this.seededNoise(this.totalElapsed * 4.1) * 1.5;

    // Pick a random debris GLB path
    const debrisIndex = Math.floor(this.seededNoise(this.totalElapsed * 5.3) * DEBRIS_GLB_PATHS.length);
    const debrisPath = DEBRIS_GLB_PATHS[debrisIndex];
    const instanceName = `rock_${this.rockInstanceCounter++}`;

    // Create GLB instance
    const mesh = AssetManager.createInstanceByPath(
      debrisPath,
      instanceName,
      this.scene,
      false, // not animated
      'debris'
    );

    if (!mesh) {
      // Fallback: if GLB not loaded yet, skip this rock
      log.warn(`Failed to create debris instance from ${debrisPath}`);
      return;
    }

    mesh.position.copyFrom(position);
    // Scale the GLB to desired size (normalize to ~1m and then scale)
    const scale = size * 0.5;
    mesh.scaling.set(scale, scale, scale);

    // Shadow marker on ground (warning indicator) - keep as procedural VFX
    const shadowMarker = MeshBuilder.CreateDisc(
      `rock_shadow_${instanceName}`,
      { radius: size * 1.5, tessellation: 16 },
      this.scene
    );
    shadowMarker.position.set(position.x - sideDirection * 5, 0.05, position.z);
    shadowMarker.rotation.x = Math.PI / 2;

    const shadowMat = new StandardMaterial(`shadow_mat_${instanceName}`, this.scene);
    shadowMat.diffuseColor = new Color3(0.8, 0.2, 0.1);
    shadowMat.emissiveColor = new Color3(0.4, 0.1, 0.0);
    shadowMat.alpha = 0.4;
    shadowMarker.material = shadowMat;

    // Velocity: falls down with slight lateral drift toward road
    const velocity = new Vector3(
      -sideDirection * (2 + this.seededNoise(this.totalElapsed * 6) * 3),
      -0.5,
      (this.seededNoise(this.totalElapsed * 7) - 0.5) * 2
    );

    const rotationSpeed = new Vector3(
      (this.seededNoise(this.totalElapsed * 8) - 0.5) * 4,
      (this.seededNoise(this.totalElapsed * 9) - 0.5) * 4,
      (this.seededNoise(this.totalElapsed * 10) - 0.5) * 4
    );

    this.fallingRocks.push({
      mesh,
      velocity,
      rotationSpeed,
      lifetime: 0,
      maxLifetime: 6,
      hasLanded: false,
      shadowMarker,
    });
  }

  /**
   * Update falling rock physics and cleanup.
   */
  private updateFallingRocks(deltaTime: number): void {
    const gravity = 25;
    const toRemove: number[] = [];

    for (let i = 0; i < this.fallingRocks.length; i++) {
      const rock = this.fallingRocks[i];
      rock.lifetime += deltaTime;

      if (rock.lifetime >= rock.maxLifetime) {
        toRemove.push(i);
        continue;
      }

      if (!rock.hasLanded) {
        // Apply gravity
        rock.velocity.y -= gravity * deltaTime;

        // Update position
        rock.mesh.position.addInPlace(rock.velocity.scale(deltaTime));

        // Apply rotation
        rock.mesh.rotation.x += rock.rotationSpeed.x * deltaTime;
        rock.mesh.rotation.y += rock.rotationSpeed.y * deltaTime;
        rock.mesh.rotation.z += rock.rotationSpeed.z * deltaTime;

        // Check for ground collision
        if (rock.mesh.position.y <= 0.5) {
          rock.hasLanded = true;
          rock.mesh.position.y = 0.5;
          rock.velocity.set(0, 0, 0);
          rock.rotationSpeed.scaleInPlace(0.1);

          // Remove shadow marker on impact
          rock.shadowMarker?.dispose();
          rock.shadowMarker = null;
        }
      }

      // Fade shadow marker as rock approaches ground
      if (rock.shadowMarker && !rock.hasLanded) {
        const height = rock.mesh.position.y;
        const alpha = Math.min(0.6, height / 20);
        (rock.shadowMarker.material as StandardMaterial).alpha = alpha;
      }
    }

    // Remove expired rocks (iterate backwards to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const rock = this.fallingRocks[idx];
      rock.mesh.dispose();
      rock.shadowMarker?.dispose();
      this.fallingRocks.splice(idx, 1);
    }
  }

  // ============================================================================
  // EXPLOSIONS
  // ============================================================================

  /**
   * Spawn environmental explosions for visual drama.
   */
  private updateExplosionSpawning(deltaTime: number, playerPosition: Vector3): void {
    this.timeSinceLastExplosion += deltaTime;

    // Explosion frequency increases with destruction
    const spawnInterval = Math.max(0.5, 4.0 - this.destructionProgress * 3.0);

    if (this.timeSinceLastExplosion >= spawnInterval) {
      this.timeSinceLastExplosion = 0;

      const offsetX =
        (this.seededNoise(this.totalElapsed * 11.3) - 0.5) * this.config.terrainWidth * 1.5;
      const offsetZ = (this.seededNoise(this.totalElapsed * 12.7) - 0.5) * 100;

      const explosionPos = new Vector3(
        offsetX,
        2 + this.seededNoise(this.totalElapsed * 13.1) * 8,
        playerPosition.z - 30 + offsetZ
      );

      this.spawnExplosion(explosionPos);
    }
  }

  /**
   * Create an explosion effect (light flash + particles).
   */
  private spawnExplosion(position: Vector3): void {
    const maxIntensity = 10 + this.destructionProgress * 20;

    const light = new PointLight(
      `explosion_${this.explosions.length}_${this.totalElapsed | 0}`,
      position,
      this.scene
    );
    light.diffuse = new Color3(1, 0.6, 0.2);
    light.intensity = maxIntensity;
    light.range = 30 + this.destructionProgress * 20;

    this.explosions.push({
      light,
      position,
      lifetime: 0,
      maxLifetime: 0.8,
      maxIntensity,
    });
  }

  /**
   * Update explosion light decay.
   */
  private updateExplosions(deltaTime: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.explosions.length; i++) {
      const exp = this.explosions[i];
      exp.lifetime += deltaTime;

      if (exp.lifetime >= exp.maxLifetime) {
        toRemove.push(i);
        continue;
      }

      // Rapid intensity falloff
      const t = exp.lifetime / exp.maxLifetime;
      exp.light.intensity = exp.maxIntensity * (1 - t) ** 3;
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      this.explosions[idx].light.dispose();
      this.explosions.splice(idx, 1);
    }
  }

  // ============================================================================
  // GROUND CRACKS
  // ============================================================================

  /**
   * Spawn glowing ground cracks.
   */
  private updateCrackSpawning(deltaTime: number, playerPosition: Vector3): void {
    this.timeSinceLastCrack += deltaTime;

    const spawnInterval = Math.max(1.0, 5.0 - this.destructionProgress * 4.0);

    if (this.timeSinceLastCrack >= spawnInterval && this.groundCracks.length < 20) {
      this.timeSinceLastCrack = 0;

      const offsetX =
        (this.seededNoise(this.totalElapsed * 14.3) - 0.5) * this.config.terrainWidth * 0.8;
      const offsetZ = (this.seededNoise(this.totalElapsed * 15.7) - 0.5) * 80;

      const crackPos = new Vector3(offsetX, 0.05, playerPosition.z - 20 + offsetZ);

      this.spawnGroundCrack(crackPos);
    }
  }

  /**
   * Create a glowing ground crack.
   */
  private spawnGroundCrack(position: Vector3): void {
    const length = 4 + this.seededNoise(this.totalElapsed * 16.1) * 12;
    const width = 0.3 + this.seededNoise(this.totalElapsed * 17.3) * 0.5;

    const mesh = MeshBuilder.CreateBox(
      `crack_${this.groundCracks.length}`,
      {
        width: width,
        height: 0.1,
        depth: length,
      },
      this.scene
    );
    mesh.position.copyFrom(position);
    mesh.rotation.y = this.seededNoise(this.totalElapsed * 18.7) * Math.PI;
    mesh.material = this.crackMaterial;

    this.groundCracks.push({
      mesh,
      position,
      length,
      glowIntensity: 0.5 + this.destructionProgress * 0.5,
    });

    // Spawn a lava pool at some cracks (probability increases with destruction)
    if (
      this.seededNoise(this.totalElapsed * 19.1) < this.destructionProgress * 0.4 &&
      this.lavaPools.length < this.config.maxLavaPools
    ) {
      this.spawnLavaPool(position);
    }
  }

  // ============================================================================
  // LAVA POOLS
  // ============================================================================

  /**
   * Spawn a lava pool at a crack position.
   */
  private spawnLavaPool(position: Vector3): void {
    const maxRadius = 2 + this.seededNoise(this.totalElapsed * 20.3) * 4;

    const mesh = MeshBuilder.CreateDisc(
      `lava_${this.lavaPools.length}`,
      { radius: 0.1, tessellation: 16 },
      this.scene
    );
    mesh.position.set(position.x, 0.06, position.z);
    mesh.rotation.x = Math.PI / 2;
    mesh.material = this.lavaMaterial;

    const light = new PointLight(
      `lava_light_${this.lavaPools.length}`,
      new Vector3(position.x, 1, position.z),
      this.scene
    );
    light.diffuse = new Color3(1, 0.4, 0.1);
    light.intensity = 0;
    light.range = maxRadius * 3;

    this.lavaPools.push({
      mesh,
      light,
      position,
      radius: 0.1,
      growthRate: 0.5 + this.destructionProgress * 1.0,
      currentRadius: 0.1,
      maxRadius,
      pulseAccumulator: 0,
    });
  }

  /**
   * Update lava pool growth and pulsing animation.
   */
  private updateLavaPoolGrowth(deltaTime: number): void {
    for (const pool of this.lavaPools) {
      if (pool.currentRadius < pool.maxRadius) {
        pool.currentRadius += pool.growthRate * deltaTime;
        pool.currentRadius = Math.min(pool.currentRadius, pool.maxRadius);

        // Scale the disc mesh
        const scale = pool.currentRadius / 0.1;
        pool.mesh.scaling.set(scale, scale, 1);
      }

      // Pulse animation
      pool.pulseAccumulator += deltaTime * 2;
      const pulse = Math.sin(pool.pulseAccumulator) * 0.2 + 0.8;
      pool.light.intensity = pool.currentRadius * pulse * 2;
    }
  }

  /**
   * Update lava material emissive pulsing.
   */
  private updateLavaAnimation(deltaTime: number): void {
    if (!this.lavaMaterial) return;

    const pulse = Math.sin(this.totalElapsed * 2) * 0.15 + 0.85;
    this.lavaMaterial.emissiveColor = new Color3(
      LAVA_EMISSIVE.r * pulse,
      LAVA_EMISSIVE.g * pulse,
      LAVA_EMISSIVE.b * pulse * 0.8
    );
  }

  // ============================================================================
  // SEGMENT COLLAPSE
  // ============================================================================

  /**
   * Collapse terrain segments behind the player as destruction progresses.
   */
  private updateSegmentCollapse(deltaTime: number, playerPosition: Vector3): void {
    // Segments well behind the player start collapsing
    const collapseThresholdBehind = 30 + (1 - this.destructionProgress) * 40;

    for (const seg of this.segments) {
      // Skip already fully collapsed segments
      if (seg.collapseProgress >= 1) continue;

      // Check if segment is behind the player enough to collapse
      const distanceBehind = seg.zPosition - playerPosition.z;
      if (distanceBehind > collapseThresholdBehind) {
        seg.collapsed = true;
      }

      // Animate collapse
      if (seg.collapsed) {
        seg.collapseProgress += deltaTime * 0.8;
        seg.collapseProgress = Math.min(1, seg.collapseProgress);

        // Segment drops and tilts
        const drop = seg.collapseProgress * 50;
        const tilt = seg.collapseProgress * 0.3;
        seg.mesh.position.y = seg.originalY - drop;
        seg.mesh.rotation.x = tilt;
        seg.mesh.rotation.z = (this.seededNoise(seg.zPosition * 0.1) - 0.5) * tilt;

        // Fade out when fully collapsed
        if (seg.collapseProgress >= 0.9) {
          seg.mesh.isVisible = false;
        }
      }
    }
  }

  // ============================================================================
  // COLLISION / DAMAGE QUERIES
  // ============================================================================

  /**
   * Check if a world position is inside a damage zone (chasm or lava).
   * Returns damage per second at that position (0 if safe).
   *
   * @param position - World position to check
   * @returns Damage per second (0 if safe)
   */
  getDamageAtPosition(position: Vector3): number {
    let damage = 0;

    // Check chasms (instant death if fallen in)
    for (const chasm of this.chasms) {
      if (!chasm.fullyOpen && chasm.openProgress < 0.3) continue;

      const dx = Math.abs(position.x - chasm.position.x);
      const dz = Math.abs(position.z - chasm.position.z);
      if (dx < chasm.width / 2 && dz < chasm.depth / 2) {
        // In the chasm - high damage
        damage += 200;
      }
    }

    // Check lava pools (burn damage)
    for (const pool of this.lavaPools) {
      const dist = Vector3.Distance(
        new Vector3(position.x, 0, position.z),
        new Vector3(pool.position.x, 0, pool.position.z)
      );
      if (dist < pool.currentRadius) {
        damage += 30; // 30 DPS in lava
      }
    }

    // Check if standing on collapsed segment (falling)
    for (const seg of this.segments) {
      if (!seg.collapsed) continue;
      const segLen = this.config.terrainLength / this.config.segmentCount;
      const halfWidth = this.config.terrainWidth / 2;
      const dz = Math.abs(position.z - seg.zPosition);
      const dx = Math.abs(position.x);
      if (dz < segLen / 2 && dx < halfWidth && seg.collapseProgress > 0.5) {
        damage += 100; // Falling with the terrain
      }
    }

    return damage;
  }

  /**
   * Check if a position is near a falling rock (for collision avoidance HUD).
   * Returns the nearest rock distance, or -1 if none nearby.
   */
  getNearestRockDistance(position: Vector3): number {
    let nearest = -1;

    for (const rock of this.fallingRocks) {
      if (rock.hasLanded) continue;
      const dist = Vector3.Distance(position, rock.mesh.position);
      if (dist < 15 && (nearest === -1 || dist < nearest)) {
        nearest = dist;
      }
    }

    return nearest;
  }

  /**
   * Check if a position is near a chasm edge (for warning HUD).
   * Returns distance to nearest chasm, or -1 if none nearby.
   */
  getNearestChasmDistance(position: Vector3): number {
    let nearest = -1;

    for (const chasm of this.chasms) {
      if (chasm.openProgress < 0.2) continue;
      const dist = Vector3.Distance(
        new Vector3(position.x, 0, position.z),
        new Vector3(chasm.position.x, 0, chasm.position.z)
      );
      if (dist < 20 && (nearest === -1 || dist < nearest)) {
        nearest = dist;
      }
    }

    return nearest;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Simple seeded noise function for deterministic randomness.
   * Returns a value between 0 and 1.
   */
  private seededNoise(x: number): number {
    const n = Math.sin(x * 12.9898 + this.seed * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  /**
   * Get the total terrain length.
   */
  getTerrainLength(): number {
    return this.config.terrainLength;
  }

  /**
   * Get the terrain width.
   */
  getTerrainWidth(): number {
    return this.config.terrainWidth;
  }

  /**
   * Get terrain bounds for clamping player position.
   */
  getTerrainBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    const halfWidth = this.config.terrainWidth / 2 - 2; // 2m margin
    return {
      minX: -halfWidth,
      maxX: halfWidth,
      minZ: -this.config.terrainLength,
      maxZ: 10,
    };
  }

  // ============================================================================
  // DISPOSAL
  // ============================================================================

  /**
   * Dispose all terrain resources.
   */
  dispose(): void {
    // Dispose materials
    this.terrainMaterial?.dispose();
    this.lavaMaterial?.dispose();
    this.rockMaterial?.dispose();
    this.crackMaterial?.dispose();
    this.chasmMaterial?.dispose();

    // Dispose terrain segments
    for (const seg of this.segments) {
      seg.mesh.dispose();
    }
    this.segments = [];

    // Dispose canyon walls
    for (const wall of this.leftWallSegments) {
      wall.dispose();
    }
    this.leftWallSegments = [];
    for (const wall of this.rightWallSegments) {
      wall.dispose();
    }
    this.rightWallSegments = [];

    // Dispose chasms
    for (const chasm of this.chasms) {
      chasm.mesh.dispose();
      chasm.glowLight.dispose();
    }
    this.chasms = [];

    // Dispose falling rocks
    for (const rock of this.fallingRocks) {
      rock.mesh.dispose();
      rock.shadowMarker?.dispose();
    }
    this.fallingRocks = [];

    // Dispose lava pools
    for (const pool of this.lavaPools) {
      pool.mesh.dispose();
      pool.light.dispose();
    }
    this.lavaPools = [];

    // Dispose explosions
    for (const exp of this.explosions) {
      exp.light.dispose();
    }
    this.explosions = [];

    // Dispose ground cracks
    for (const crack of this.groundCracks) {
      crack.mesh.dispose();
    }
    this.groundCracks = [];

    log.info('Disposed all resources');
  }
}
