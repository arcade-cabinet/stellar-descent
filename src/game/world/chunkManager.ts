/**
 * ChunkManager (World) - Static Level Layout Manager
 *
 * Manages pre-placed GLB environment assets for exterior levels.
 * All procedural generation has been removed in favor of hand-crafted layouts.
 *
 * Key features:
 * - GLB model loading for buildings, pillars, debris, rocks via AssetManager
 * - Pre-defined layout positions (no random generation)
 * - Proper dispose() to clean up all BabylonJS resources
 * - LODManager integration for all created meshes and GLB instances
 * - Adaptive load/unload radius based on device performance
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getEnemySoundManager } from '../core/EnemySoundManager';
import { type Entity, removeEntity } from '../core/ecs';
import { LODManager } from '../core/LODManager';
import { getLogger } from '../core/Logger';
import { getPerformanceManager } from '../core/PerformanceManager';
import { AssetManager } from '../core/AssetManager';
import { ALIEN_SPECIES, createAlienEntity } from '../entities/aliens';

const log = getLogger('WorldChunkManager');

export const CHUNK_SIZE = 100;

// ---------------------------------------------------------------------------
// Adaptive load radius based on device capability
// ---------------------------------------------------------------------------

function getLoadRadius(): number {
  const perfManager = getPerformanceManager();
  const settings = perfManager.getSettings();
  return Math.max(2, Math.round(3 * settings.lodDistanceMultiplier));
}

function getUnloadRadius(): number {
  return getLoadRadius() + 2;
}

// Legacy constants for backward compatibility
export const LOAD_RADIUS = 3;
export const UNLOAD_RADIUS = 5;

// ---------------------------------------------------------------------------
// GLB asset path mappings
// ---------------------------------------------------------------------------

const BUILDING_GLB_PATHS: Record<string, string[]> = {
  tower: [
    '/assets/models/environment/industrial/chimney_a_1.glb',
    '/assets/models/environment/industrial/chimney_a_2.glb',
    '/assets/models/environment/industrial/chimney_a_3.glb',
  ],
  bunker: [
    '/assets/models/environment/industrial/shipping_container_mx_1.glb',
    '/assets/models/environment/industrial/shipping_container_mx_1_1.glb',
    '/assets/models/environment/industrial/shipping_container_mx_2.glb',
  ],
  depot: [
    '/assets/models/environment/industrial/warehouse_hl_1.glb',
    '/assets/models/environment/industrial/storage_tank_mx_1.glb',
  ],
  ruin: [
    '/assets/models/environment/industrial/shipping_container_mx_1_hollow_1.glb',
    '/assets/models/environment/industrial/shipping_container_mx_1_hollow_1_1.glb',
    '/assets/models/environment/industrial/shipping_container_mx_1_hollow_1_2.glb',
  ],
};

const OBSTACLE_GLB_PATHS: Record<string, string[]> = {
  pillar: [
    '/assets/models/environment/modular/Column_1.glb',
    '/assets/models/environment/modular/Column_2.glb',
    '/assets/models/environment/modular/Column_3.glb',
    '/assets/models/environment/modular/Column_Slim.glb',
  ],
  debris: [
    '/assets/models/environment/modular/Props_Crate.glb',
    '/assets/models/environment/modular/Props_CrateLong.glb',
    '/assets/models/environment/modular/Props_Chest.glb',
    '/assets/models/environment/modular/Props_ContainerFull.glb',
  ],
  rock: [
    '/assets/models/environment/alien-flora/alien_rock_medium_1.glb',
    '/assets/models/environment/alien-flora/alien_rock_medium_2.glb',
    '/assets/models/environment/alien-flora/alien_rock_medium_3.glb',
    '/assets/models/environment/alien-flora/alien_boulder_polyhaven.glb',
  ],
  tallRock: [
    '/assets/models/environment/alien-flora/alien_tall_rock_1_01.glb',
    '/assets/models/environment/alien-flora/alien_tall_rock_2_01.glb',
    '/assets/models/environment/alien-flora/alien_tall_rock_3_01.glb',
  ],
};

/** Collect all unique GLB paths used by the chunk system for preloading. */
function getAllChunkGLBPaths(): string[] {
  const paths = new Set<string>();
  for (const variants of Object.values(BUILDING_GLB_PATHS)) {
    for (const p of variants) paths.add(p);
  }
  for (const variants of Object.values(OBSTACLE_GLB_PATHS)) {
    for (const p of variants) paths.add(p);
  }
  return [...paths];
}

// ---------------------------------------------------------------------------
// Pre-defined layout types
// ---------------------------------------------------------------------------

export interface StaticBuilding {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  type: 'bunker' | 'tower' | 'depot' | 'ruin';
  rotationY?: number;
}

export interface StaticObstacle {
  x: number;
  z: number;
  type: 'rock' | 'tallRock' | 'debris' | 'pillar';
  scale: number;
  rotationY?: number;
  variant?: number;
}

export interface StaticEnemy {
  x: number;
  z: number;
  type: 'skitterer' | 'lurker' | 'spewer' | 'husk' | 'broodmother';
}

export interface ChunkLayout {
  chunkX: number;
  chunkZ: number;
  buildings: StaticBuilding[];
  obstacles: StaticObstacle[];
  enemies: StaticEnemy[];
}

// ---------------------------------------------------------------------------
// Pre-defined level layouts (hand-crafted positions)
// ---------------------------------------------------------------------------

/**
 * Define level layouts here. Each chunk key is "x,z" format.
 * This replaces all procedural generation with hand-crafted positions.
 */
const LEVEL_LAYOUTS: Map<string, ChunkLayout> = new Map([
  // Spawn area - clear zone with minimal obstacles
  ['0,0', {
    chunkX: 0,
    chunkZ: 0,
    buildings: [],
    obstacles: [
      { x: 30, z: 40, type: 'rock', scale: 1.5, variant: 0 },
      { x: -35, z: 30, type: 'rock', scale: 1.2, variant: 1 },
      { x: 40, z: -35, type: 'tallRock', scale: 2.0, variant: 0 },
    ],
    enemies: [],
  }],

  // North chunk
  ['0,1', {
    chunkX: 0,
    chunkZ: 1,
    buildings: [
      { x: 20, z: 30, width: 8, height: 6, depth: 8, type: 'bunker', rotationY: 0.3 },
    ],
    obstacles: [
      { x: -30, z: 20, type: 'pillar', scale: 1.8, rotationY: 0 },
      { x: -25, z: 40, type: 'debris', scale: 1.2, variant: 0 },
      { x: 35, z: -10, type: 'rock', scale: 1.5, variant: 2 },
      { x: 10, z: 45, type: 'tallRock', scale: 1.8, variant: 1 },
    ],
    enemies: [
      { x: 15, z: 25, type: 'skitterer' },
      { x: -20, z: 35, type: 'skitterer' },
    ],
  }],

  // South chunk
  ['0,-1', {
    chunkX: 0,
    chunkZ: -1,
    buildings: [
      { x: -15, z: -25, width: 10, height: 8, depth: 6, type: 'tower', rotationY: -0.2 },
    ],
    obstacles: [
      { x: 25, z: -30, type: 'rock', scale: 2.0, variant: 0 },
      { x: 30, z: -20, type: 'debris', scale: 1.0, variant: 1 },
      { x: -35, z: -40, type: 'pillar', scale: 1.5 },
      { x: 40, z: -45, type: 'tallRock', scale: 2.2, variant: 2 },
    ],
    enemies: [
      { x: 10, z: -30, type: 'lurker' },
      { x: -25, z: -15, type: 'skitterer' },
    ],
  }],

  // East chunk
  ['1,0', {
    chunkX: 1,
    chunkZ: 0,
    buildings: [
      { x: 25, z: 10, width: 12, height: 5, depth: 10, type: 'depot', rotationY: 0.5 },
      { x: -10, z: -30, width: 6, height: 4, depth: 6, type: 'ruin', rotationY: -0.3 },
    ],
    obstacles: [
      { x: 40, z: 35, type: 'rock', scale: 1.8, variant: 1 },
      { x: -25, z: 20, type: 'debris', scale: 1.3, variant: 2 },
      { x: 15, z: -40, type: 'pillar', scale: 2.0 },
    ],
    enemies: [
      { x: 30, z: 15, type: 'husk' },
      { x: 20, z: -25, type: 'skitterer' },
      { x: -15, z: 10, type: 'skitterer' },
    ],
  }],

  // West chunk
  ['-1,0', {
    chunkX: -1,
    chunkZ: 0,
    buildings: [
      { x: -30, z: 20, width: 8, height: 10, depth: 8, type: 'tower', rotationY: 0.8 },
    ],
    obstacles: [
      { x: -40, z: -25, type: 'tallRock', scale: 2.5, variant: 0 },
      { x: -10, z: 35, type: 'rock', scale: 1.4, variant: 2 },
      { x: 30, z: 15, type: 'debris', scale: 1.1, variant: 0 },
      { x: 20, z: -30, type: 'pillar', scale: 1.6 },
    ],
    enemies: [
      { x: -25, z: 25, type: 'spewer' },
      { x: 15, z: -20, type: 'lurker' },
    ],
  }],

  // Northeast chunk - boss area approach
  ['1,1', {
    chunkX: 1,
    chunkZ: 1,
    buildings: [
      { x: 0, z: 0, width: 15, height: 12, depth: 15, type: 'depot', rotationY: 0 },
      { x: -35, z: 35, width: 8, height: 6, depth: 8, type: 'bunker', rotationY: 0.4 },
    ],
    obstacles: [
      { x: 35, z: 40, type: 'tallRock', scale: 3.0, variant: 1 },
      { x: -40, z: -10, type: 'rock', scale: 2.2, variant: 0 },
      { x: 25, z: -35, type: 'debris', scale: 1.5, variant: 1 },
      { x: -20, z: 20, type: 'pillar', scale: 2.0 },
    ],
    enemies: [
      { x: 20, z: 30, type: 'husk' },
      { x: -30, z: 15, type: 'lurker' },
      { x: 10, z: -20, type: 'skitterer' },
      { x: -15, z: -35, type: 'skitterer' },
    ],
  }],

  // Far north - broodmother territory
  ['0,2', {
    chunkX: 0,
    chunkZ: 2,
    buildings: [
      { x: -20, z: 15, width: 10, height: 8, depth: 12, type: 'ruin', rotationY: 0.2 },
      { x: 25, z: -20, width: 8, height: 15, depth: 8, type: 'tower', rotationY: -0.5 },
    ],
    obstacles: [
      { x: 40, z: 40, type: 'tallRock', scale: 3.5, variant: 2 },
      { x: -40, z: 35, type: 'tallRock', scale: 2.8, variant: 0 },
      { x: 0, z: -40, type: 'rock', scale: 2.5, variant: 1 },
      { x: -30, z: -25, type: 'debris', scale: 1.8, variant: 2 },
    ],
    enemies: [
      { x: 0, z: 20, type: 'broodmother' },
      { x: -25, z: 0, type: 'husk' },
      { x: 25, z: 5, type: 'husk' },
      { x: 15, z: -30, type: 'spewer' },
    ],
  }],
]);

// ---------------------------------------------------------------------------
// LOD category for world chunk geometry
// ---------------------------------------------------------------------------

const WORLD_LOD_CATEGORY = 'environment';

// ---------------------------------------------------------------------------
// Loaded chunk data -- tracks GLB TransformNodes
// ---------------------------------------------------------------------------

interface LoadedChunkData {
  entities: Entity[];
  glbNodes: TransformNode[];
  lodIds: string[];
}

// ---------------------------------------------------------------------------
// ChunkManager
// ---------------------------------------------------------------------------

export class ChunkManager {
  private scene: Scene;
  private loadedChunks: Map<string, LoadedChunkData> = new Map();
  private disposed = false;

  /** Set of chunk keys currently being loaded (prevents double-load). */
  private loadingChunks: Set<string> = new Set();

  /** Whether GLB assets have been preloaded into the AssetManager cache. */
  private glbAssetsPreloaded = false;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // -----------------------------------------------------------------------
  // GLB preloading -- call once before first chunk load
  // -----------------------------------------------------------------------

  /**
   * Preload all GLB models used by the chunk system into the AssetManager
   * cache. This ensures that createInstanceByPath calls during chunk loading
   * are synchronous and fast.
   *
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  async preloadGLBAssets(): Promise<void> {
    if (this.glbAssetsPreloaded) return;

    const paths = getAllChunkGLBPaths();
    const loadPromises = paths.map((path) =>
      AssetManager.loadAssetByPath(path, this.scene).catch((err) => {
        log.warn(`Failed to preload GLB ${path}:`, err);
        return null;
      })
    );

    await Promise.all(loadPromises);
    this.glbAssetsPreloaded = true;
    log.info(`Preloaded ${paths.length} chunk GLB assets`);
  }

  // -----------------------------------------------------------------------
  // Key / coordinate helpers
  // -----------------------------------------------------------------------

  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  private getChunkCoords(worldX: number, worldZ: number): { x: number; z: number } {
    return {
      x: Math.floor(worldX / CHUNK_SIZE),
      z: Math.floor(worldZ / CHUNK_SIZE),
    };
  }

  // -----------------------------------------------------------------------
  // Get layout for a chunk (returns predefined layout or empty)
  // -----------------------------------------------------------------------

  private getChunkLayout(chunkX: number, chunkZ: number): ChunkLayout {
    const key = this.getChunkKey(chunkX, chunkZ);
    const layout = LEVEL_LAYOUTS.get(key);

    if (layout) {
      return layout;
    }

    // Return empty layout for undefined chunks
    return {
      chunkX,
      chunkZ,
      buildings: [],
      obstacles: [],
      enemies: [],
    };
  }

  // -----------------------------------------------------------------------
  // GLB instance creation helpers
  // -----------------------------------------------------------------------

  /**
   * Pick a GLB variant from a list based on an index.
   */
  private pickVariant(variants: string[], index: number): string {
    return variants[Math.abs(index) % variants.length];
  }

  /**
   * Create a GLB instance for a building.
   */
  private createBuildingInstance(
    building: StaticBuilding,
    chunkX: number,
    chunkZ: number,
    instanceIndex: number
  ): TransformNode | null {
    const worldX = chunkX * CHUNK_SIZE + building.x;
    const worldZ = chunkZ * CHUNK_SIZE + building.z;

    const variants = BUILDING_GLB_PATHS[building.type];
    if (!variants || variants.length === 0) return null;

    const glbPath = this.pickVariant(variants, instanceIndex);

    const instanceName = `chunk_${chunkX}_${chunkZ}_${building.type}_${instanceIndex}`;
    const node = AssetManager.createInstanceByPath(
      glbPath,
      instanceName,
      this.scene,
      true,
      WORLD_LOD_CATEGORY
    );

    if (!node) {
      return null;
    }

    node.position = new Vector3(worldX, 0, worldZ);

    // Scale the GLB instance based on building dimensions
    const scaleX = building.width / 10;
    const scaleY = building.height / 10;
    const scaleZ = building.depth / 10;
    node.scaling = new Vector3(scaleX, scaleY, scaleZ);

    // Apply rotation
    node.rotation = new Vector3(0, building.rotationY ?? 0, 0);

    return node;
  }

  /**
   * Create a GLB instance for an obstacle (all obstacle types now use GLB).
   */
  private createObstacleInstance(
    obstacle: StaticObstacle,
    chunkX: number,
    chunkZ: number,
    instanceIndex: number
  ): TransformNode | null {
    const worldX = chunkX * CHUNK_SIZE + obstacle.x;
    const worldZ = chunkZ * CHUNK_SIZE + obstacle.z;

    const variants = OBSTACLE_GLB_PATHS[obstacle.type];
    if (!variants || variants.length === 0) return null;

    const variantIndex = obstacle.variant ?? instanceIndex;
    const glbPath = this.pickVariant(variants, variantIndex);

    const instanceName = `chunk_${chunkX}_${chunkZ}_${obstacle.type}_${instanceIndex}`;
    const node = AssetManager.createInstanceByPath(
      glbPath,
      instanceName,
      this.scene,
      true,
      'prop'
    );

    if (!node) return null;

    node.position = new Vector3(worldX, 0, worldZ);

    // Scale based on the obstacle's scale factor and type
    const uniformScale = obstacle.scale;
    if (obstacle.type === 'pillar') {
      node.scaling = new Vector3(uniformScale * 0.8, uniformScale * 2, uniformScale * 0.8);
    } else if (obstacle.type === 'tallRock') {
      node.scaling = new Vector3(uniformScale * 1.2, uniformScale * 2.0, uniformScale * 1.2);
    } else {
      node.scaling = new Vector3(uniformScale, uniformScale, uniformScale);
    }

    // Apply rotation
    node.rotation = new Vector3(0, obstacle.rotationY ?? 0, 0);

    return node;
  }

  // -----------------------------------------------------------------------
  // Enemy entity creation
  // -----------------------------------------------------------------------

  private async createEnemyEntity(
    enemy: StaticEnemy,
    chunkX: number,
    chunkZ: number,
    playSpawnSound = false
  ): Promise<Entity> {
    const worldX = chunkX * CHUNK_SIZE + enemy.x;
    const worldZ = chunkZ * CHUNK_SIZE + enemy.z;
    const position = new Vector3(worldX, 1, worldZ);

    const species = ALIEN_SPECIES[enemy.type];
    if (!species) {
      return await createAlienEntity(this.scene, ALIEN_SPECIES.skitterer, position, 0);
    }

    const entity = await createAlienEntity(this.scene, species, position, 0);

    entity.chunkInfo = {
      chunkX,
      chunkZ,
    };

    if (playSpawnSound) {
      getEnemySoundManager().playSpawnSound(entity);
    }

    return entity;
  }

  // -----------------------------------------------------------------------
  // Chunk load / unload
  // -----------------------------------------------------------------------

  async loadChunk(chunkX: number, chunkZ: number): Promise<void> {
    const key = this.getChunkKey(chunkX, chunkZ);
    if (this.loadedChunks.has(key) || this.loadingChunks.has(key)) return;

    this.loadingChunks.add(key);

    // Ensure GLB assets are preloaded before first chunk load
    if (!this.glbAssetsPreloaded) {
      await this.preloadGLBAssets();
    }

    try {
      const layout = this.getChunkLayout(chunkX, chunkZ);

      if (this.disposed) return;

      const entities: Entity[] = [];
      const glbNodes: TransformNode[] = [];
      const lodIds: string[] = [];

      // Buildings -- load as GLB instances
      for (let i = 0; i < layout.buildings.length; i++) {
        const node = this.createBuildingInstance(layout.buildings[i], chunkX, chunkZ, i);
        if (node) {
          glbNodes.push(node);
        }
      }

      // Obstacles -- all types now use GLB models
      for (let i = 0; i < layout.obstacles.length; i++) {
        const obstacle = layout.obstacles[i];
        const node = this.createObstacleInstance(obstacle, chunkX, chunkZ, i);
        if (node) {
          glbNodes.push(node);
        }
      }

      // Enemies from layout
      for (const enemy of layout.enemies) {
        entities.push(await this.createEnemyEntity(enemy, chunkX, chunkZ));
      }

      this.loadedChunks.set(key, { entities, glbNodes, lodIds });
    } catch (error) {
      log.error(`Failed to load chunk ${key}:`, error);
    } finally {
      this.loadingChunks.delete(key);
    }
  }

  unloadChunk(chunkX: number, chunkZ: number): void {
    const key = this.getChunkKey(chunkX, chunkZ);
    const chunk = this.loadedChunks.get(key);
    if (!chunk) return;

    // Remove entity references
    for (const entity of chunk.entities) {
      removeEntity(entity);
    }

    // Unregister LOD tracked meshes
    for (const lodId of chunk.lodIds) {
      LODManager.unregisterMesh(lodId);
    }

    // Dispose GLB instance nodes (instances only, source meshes stay cached)
    for (const node of chunk.glbNodes) {
      node.dispose(false, true);
    }

    this.loadedChunks.delete(key);
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  update(playerPosition: Vector3): void {
    if (this.disposed) return;

    const playerChunk = this.getChunkCoords(playerPosition.x, playerPosition.z);

    const loadRadius = getLoadRadius();
    const unloadRadius = getUnloadRadius();

    // Load chunks within radius
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      for (let dz = -loadRadius; dz <= loadRadius; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= loadRadius) {
          this.loadChunk(playerChunk.x + dx, playerChunk.z + dz);
        }
      }
    }

    // Unload distant chunks
    const chunksToUnload: string[] = [];
    for (const [key] of this.loadedChunks) {
      const [cx, cz] = key.split(',').map(Number);
      const dx = cx - playerChunk.x;
      const dz = cz - playerChunk.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > unloadRadius) {
        chunksToUnload.push(key);
      }
    }

    for (const key of chunksToUnload) {
      const [cx, cz] = key.split(',').map(Number);
      this.unloadChunk(cx, cz);
    }
  }

  // -----------------------------------------------------------------------
  // Query helpers
  // -----------------------------------------------------------------------

  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  /**
   * Check whether a specific chunk is loaded.
   */
  isChunkLoaded(chunkX: number, chunkZ: number): boolean {
    return this.loadedChunks.has(this.getChunkKey(chunkX, chunkZ));
  }

  /**
   * Get all loaded chunk keys.
   */
  getLoadedChunkKeys(): string[] {
    return Array.from(this.loadedChunks.keys());
  }

  /**
   * Register a custom layout for a chunk.
   * Useful for level-specific configurations.
   */
  static registerLayout(layout: ChunkLayout): void {
    const key = `${layout.chunkX},${layout.chunkZ}`;
    LEVEL_LAYOUTS.set(key, layout);
  }

  /**
   * Clear all registered layouts.
   */
  static clearLayouts(): void {
    LEVEL_LAYOUTS.clear();
  }

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  /**
   * Dispose all resources held by this ChunkManager.
   * Unloads all chunks.
   * Safe to call multiple times.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Unload all chunks
    for (const key of [...this.loadedChunks.keys()]) {
      const [cx, cz] = key.split(',').map(Number);
      this.unloadChunk(cx, cz);
    }

    this.loadedChunks.clear();
    this.loadingChunks.clear();
  }
}
