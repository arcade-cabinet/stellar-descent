/**
 * ChunkManager (ECS) - Handles procedural loading/unloading of world chunks
 *
 * Key features:
 * 1. Loads chunks in a radius around the player
 * 2. Unloads chunks beyond the render radius to save memory
 * 3. Persists chunk state to SQLite so visited locations don't change
 * 4. Uses deterministic seeding for reproducible generation
 * 5. Loads actual BabylonJS meshes via AssetManager with instancing and LOD
 * 6. Async mesh loading without blocking the main thread
 * 7. Proper dispose() to clean up all BabylonJS resources
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../core/AssetManager';
import { createEntity, type Entity, removeEntity } from '../core/ecs';
import { LODManager } from '../core/LODManager';
import { worldDb } from '../db/worldDatabase';
import {
  ALL_ASSEMBLAGES,
  type AssemblageDefinition,
  type AssemblageEntityDef,
  CHUNK_SIZE,
  type ChunkState,
  type EnvironmentType,
  getAssemblagesByEnvironment,
  RENDER_RADIUS,
  UNLOAD_RADIUS,
} from './assemblages';

// ---------------------------------------------------------------------------
// Seeded PRNG for reproducible chunk generation
// ---------------------------------------------------------------------------

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Mulberry32 PRNG
  next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// Hash function for generating chunk seeds
function hashChunkCoords(x: number, z: number, worldSeed: number): number {
  let hash = worldSeed;
  hash = ((hash << 5) - hash + x) | 0;
  hash = ((hash << 5) - hash + z) | 0;
  hash = ((hash << 5) - hash + x * z) | 0;
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Mesh load tracking per entity
// ---------------------------------------------------------------------------

interface EntityMeshBinding {
  entity: Entity;
  meshNode: TransformNode | null;
  modelPath: string;
  loadState: 'pending' | 'loading' | 'loaded' | 'failed';
}

// ---------------------------------------------------------------------------
// Loaded chunk
// ---------------------------------------------------------------------------

interface LoadedChunk {
  x: number;
  z: number;
  state: ChunkState;
  root: TransformNode;
  entities: Entity[];
  /** All mesh nodes owned by this chunk (disposed on unload). */
  meshNodes: TransformNode[];
  /** Per-entity mesh binding for lifecycle tracking. */
  meshBindings: EntityMeshBinding[];
  lastAccessed: number;
  /** LOD registration ids for cleanup. */
  lodIds: string[];
}

// ---------------------------------------------------------------------------
// ChunkManager
// ---------------------------------------------------------------------------

export class ChunkManager {
  private scene: Scene;
  private worldSeed: number;
  private environment: EnvironmentType;
  private loadedChunks: Map<string, LoadedChunk> = new Map();
  private loadingChunks: Set<string> = new Set();
  private playerChunkX = 0;
  private playerChunkZ = 0;
  private root: TransformNode;
  private disposed = false;

  /**
   * Set of unique model paths referenced by the current environment's assemblages.
   * Pre-computed in `preloadAssemblageMeshes()` for efficient cache warming.
   */
  private preloadedPaths: Set<string> = new Set();

  constructor(scene: Scene, worldSeed: number, environment: EnvironmentType) {
    this.scene = scene;
    this.worldSeed = worldSeed;
    this.environment = environment;
    this.root = new TransformNode('ecsChunkManager', scene);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Pre-load all unique model assets used by the current environment's
   * assemblage definitions. Call once after construction or after
   * setEnvironment() to warm the AssetManager cache so that individual
   * chunk spawns can create instances synchronously.
   */
  async preloadAssemblageMeshes(): Promise<void> {
    const assemblages = getAssemblagesByEnvironment(this.environment);
    const paths = new Set<string>();

    for (const def of assemblages) {
      for (const entDef of def.entities) {
        const path = entDef.modelPath ?? entDef.components.structuralPiece?.modelPath;
        if (path) {
          paths.add(path);
        }
      }
    }

    // Load all unique paths in parallel via AssetManager
    const loadPromises: Promise<unknown>[] = [];
    for (const path of paths) {
      if (!AssetManager.isPathCached(path)) {
        loadPromises.push(AssetManager.loadAssetByPath(path, this.scene));
      }
    }

    if (loadPromises.length > 0) {
      console.log(
        `[ECSChunkManager] Preloading ${loadPromises.length} model(s) for environment: ${this.environment}`
      );
      await Promise.all(loadPromises);
    }

    this.preloadedPaths = paths;
  }

  /**
   * Update chunk loading based on player position.
   * Call every frame or on a throttled interval.
   */
  async update(playerPosition: Vector3): Promise<void> {
    if (this.disposed) return;

    const playerChunk = this.worldToChunk(playerPosition);

    // Only trigger load/unload when player crosses a chunk boundary
    if (playerChunk.x !== this.playerChunkX || playerChunk.z !== this.playerChunkZ) {
      this.playerChunkX = playerChunk.x;
      this.playerChunkZ = playerChunk.z;
      await this.updateLoadedChunks();
    }

    // Update last-accessed timestamp for the player's current chunk
    const nearbyKey = this.getChunkKey(playerChunk.x, playerChunk.z);
    const nearbyChunk = this.loadedChunks.get(nearbyKey);
    if (nearbyChunk) {
      nearbyChunk.lastAccessed = Date.now();
    }
  }

  /**
   * Force reload all chunks (e.g., after environment change).
   */
  async reloadAll(): Promise<void> {
    for (const key of [...this.loadedChunks.keys()]) {
      await this.unloadChunk(key);
    }
    await this.updateLoadedChunks();
  }

  /**
   * Change environment type (e.g., entering hive from surface).
   */
  async setEnvironment(env: EnvironmentType): Promise<void> {
    if (env === this.environment) return;

    this.environment = env;
    this.preloadedPaths.clear();
    await this.preloadAssemblageMeshes();
    await this.reloadAll();
  }

  /**
   * Get currently loaded chunk count.
   */
  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  /**
   * Check whether a specific chunk is loaded.
   */
  isChunkLoaded(x: number, z: number): boolean {
    return this.loadedChunks.has(this.getChunkKey(x, z));
  }

  /**
   * Dispose all resources. Safe to call multiple times.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const chunk of this.loadedChunks.values()) {
      this.disposeChunkResources(chunk);
    }
    this.loadedChunks.clear();
    this.loadingChunks.clear();
    this.preloadedPaths.clear();

    this.root.dispose();
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  private worldToChunk(worldPos: Vector3): { x: number; z: number } {
    return {
      x: Math.floor(worldPos.x / CHUNK_SIZE),
      z: Math.floor(worldPos.z / CHUNK_SIZE),
    };
  }

  // -----------------------------------------------------------------------
  // Chunk load / unload orchestration
  // -----------------------------------------------------------------------

  private async updateLoadedChunks(): Promise<void> {
    const chunksToLoad: { x: number; z: number }[] = [];
    const chunksToUnload: string[] = [];

    // Determine which chunks should be loaded
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
        const x = this.playerChunkX + dx;
        const z = this.playerChunkZ + dz;
        const key = this.getChunkKey(x, z);

        if (!this.loadedChunks.has(key) && !this.loadingChunks.has(key)) {
          chunksToLoad.push({ x, z });
        }
      }
    }

    // Determine which chunks should be unloaded
    for (const [key, chunk] of this.loadedChunks) {
      const dx = Math.abs(chunk.x - this.playerChunkX);
      const dz = Math.abs(chunk.z - this.playerChunkZ);

      if (dx > UNLOAD_RADIUS || dz > UNLOAD_RADIUS) {
        chunksToUnload.push(key);
      }
    }

    // Unload distant chunks first (frees memory for new loads)
    for (const key of chunksToUnload) {
      await this.unloadChunk(key);
    }

    // Load new chunks, prioritized by distance (closest first)
    chunksToLoad.sort((a, b) => {
      const distA = Math.abs(a.x - this.playerChunkX) + Math.abs(a.z - this.playerChunkZ);
      const distB = Math.abs(b.x - this.playerChunkX) + Math.abs(b.z - this.playerChunkZ);
      return distA - distB;
    });

    // Load in batches to avoid frame drops
    const BATCH_SIZE = 2;
    for (let i = 0; i < Math.min(chunksToLoad.length, BATCH_SIZE); i++) {
      const { x, z } = chunksToLoad[i];
      await this.loadChunk(x, z);
    }
  }

  private async loadChunk(x: number, z: number): Promise<void> {
    const key = this.getChunkKey(x, z);
    if (this.loadedChunks.has(key) || this.loadingChunks.has(key)) {
      return;
    }

    this.loadingChunks.add(key);

    try {
      // Try database first
      let state = await this.loadChunkState(x, z);

      if (!state) {
        // Generate new chunk
        state = this.generateChunk(x, z);
        await this.saveChunkState(state);
      }

      // Bail out if manager was disposed during async work
      if (this.disposed) return;

      // Spawn the chunk in the scene (creates ECS entities + meshes)
      const loaded = await this.spawnChunk(state);
      this.loadedChunks.set(key, loaded);
    } catch (error) {
      console.error(`[ECSChunkManager] Failed to load chunk ${key}:`, error);
    } finally {
      this.loadingChunks.delete(key);
    }
  }

  private async unloadChunk(key: string): Promise<void> {
    const chunk = this.loadedChunks.get(key);
    if (!chunk) return;

    // Persist current runtime state before removing
    this.updateChunkState(chunk);
    await this.saveChunkState(chunk.state);

    // Dispose all BabylonJS + ECS resources
    this.disposeChunkResources(chunk);

    this.loadedChunks.delete(key);
  }

  // -----------------------------------------------------------------------
  // Chunk generation
  // -----------------------------------------------------------------------

  private generateChunk(x: number, z: number): ChunkState {
    const seed = hashChunkCoords(x, z, this.worldSeed);
    const rng = new SeededRandom(seed);

    const state: ChunkState = {
      chunkX: x,
      chunkZ: z,
      environment: this.environment,
      seed,
      assemblages: [],
      doors: [],
      loot: [],
      enemies: [],
      triggers: [],
      firstVisited: Date.now(),
      lastVisited: Date.now(),
      fullyExplored: false,
    };

    const available = getAssemblagesByEnvironment(this.environment);
    if (available.length === 0) {
      console.warn(`[ECSChunkManager] No assemblages for environment: ${this.environment}`);
      return state;
    }

    if (this.environment === 'station_interior') {
      this.generateInteriorLayout(state, rng, available);
    } else if (this.environment === 'surface_rocky') {
      this.generateExteriorLayout(state, rng, available);
    } else if (this.environment === 'hive_organic') {
      this.generateHiveLayout(state, rng, available);
    }

    return state;
  }

  private generateInteriorLayout(
    state: ChunkState,
    rng: SeededRandom,
    available: AssemblageDefinition[]
  ): void {
    const corridors = available.filter(
      (a) => a.type.startsWith('corridor') || a.type === 'airlock'
    );
    if (corridors.length === 0) return;

    const count = rng.nextInt(2, 4);
    const gridSize = CHUNK_SIZE / 4;

    for (let i = 0; i < count; i++) {
      const assemblage = rng.pick(corridors);
      const gridX = rng.nextInt(0, gridSize - assemblage.gridWidth);
      const gridZ = rng.nextInt(0, gridSize - assemblage.gridDepth);
      const rotation = rng.pick([0, 90, 180, 270]) as 0 | 90 | 180 | 270;

      state.assemblages.push({
        type: assemblage.type,
        gridX,
        gridZ,
        rotation,
        entityIds: [],
      });
    }
  }

  private generateExteriorLayout(
    state: ChunkState,
    rng: SeededRandom,
    available: AssemblageDefinition[]
  ): void {
    const terrains = available.filter((a) => a.type.startsWith('terrain'));
    if (terrains.length > 0) {
      state.assemblages.push({
        type: 'terrain_flat',
        gridX: 0,
        gridZ: 0,
        rotation: 0,
        entityIds: [],
      });
    }

    const rocks = available.filter((a) => a.type === 'rock_cluster');
    if (rocks.length > 0) {
      const rockCount = rng.nextInt(0, 5);
      for (let i = 0; i < rockCount; i++) {
        state.assemblages.push({
          type: 'rock_cluster',
          gridX: rng.nextInt(0, 6),
          gridZ: rng.nextInt(0, 6),
          rotation: rng.pick([0, 90, 180, 270]) as 0 | 90 | 180 | 270,
          entityIds: [],
        });
      }
    }
  }

  private generateHiveLayout(
    state: ChunkState,
    rng: SeededRandom,
    available: AssemblageDefinition[]
  ): void {
    const tunnels = available.filter(
      (a) => a.type.startsWith('tunnel') || a.type === 'egg_chamber'
    );
    if (tunnels.length === 0) return;

    const count = rng.nextInt(1, 3);
    const gridSize = CHUNK_SIZE / 4;

    for (let i = 0; i < count; i++) {
      const assemblage = rng.pick(tunnels);
      const gridX = rng.nextInt(0, gridSize - assemblage.gridWidth);
      const gridZ = rng.nextInt(0, gridSize - assemblage.gridDepth);

      state.assemblages.push({
        type: assemblage.type,
        gridX,
        gridZ,
        rotation: rng.pick([0, 90, 180, 270]) as 0 | 90 | 180 | 270,
        entityIds: [],
      });
    }
  }

  // -----------------------------------------------------------------------
  // Chunk spawning - creates ECS entities AND BabylonJS meshes
  // -----------------------------------------------------------------------

  private async spawnChunk(state: ChunkState): Promise<LoadedChunk> {
    const chunkRoot = new TransformNode(`chunk_${state.chunkX}_${state.chunkZ}`, this.scene);
    chunkRoot.parent = this.root;
    chunkRoot.position.x = state.chunkX * CHUNK_SIZE;
    chunkRoot.position.z = state.chunkZ * CHUNK_SIZE;

    const entities: Entity[] = [];
    const meshNodes: TransformNode[] = [];
    const meshBindings: EntityMeshBinding[] = [];
    const lodIds: string[] = [];

    // Collect all mesh-load promises so we can await them together
    const meshLoadPromises: Promise<void>[] = [];

    for (const placed of state.assemblages) {
      const def = ALL_ASSEMBLAGES[placed.type];
      if (!def) {
        console.warn(`[ECSChunkManager] Unknown assemblage type: ${placed.type}`);
        continue;
      }

      // Create assemblage root node
      const assembRoot = new TransformNode(
        `assem_${placed.type}_${placed.gridX}_${placed.gridZ}`,
        this.scene
      );
      assembRoot.parent = chunkRoot;
      assembRoot.position.x = placed.gridX * 4;
      assembRoot.position.z = placed.gridZ * 4;
      assembRoot.rotation.y = (placed.rotation * Math.PI) / 180;
      meshNodes.push(assembRoot);

      // Spawn entities from the assemblage definition
      for (const entDef of def.entities) {
        const entity = createEntity({
          ...entDef.components,
          tags: {
            ...entDef.components.tags,
            structural: entDef.type === 'structural',
          },
        });

        placed.entityIds.push(entity.id);
        entities.push(entity);

        // Determine the model path
        const modelPath = entDef.modelPath ?? entDef.components.structuralPiece?.modelPath ?? '';

        const binding: EntityMeshBinding = {
          entity,
          meshNode: null,
          modelPath,
          loadState: modelPath ? 'pending' : 'failed',
        };
        meshBindings.push(binding);

        if (modelPath) {
          // Schedule async mesh load
          meshLoadPromises.push(
            this.loadEntityMesh(binding, entDef, assembRoot, meshNodes, lodIds, state)
          );
        }
      }
    }

    // Await all mesh loads in parallel (non-blocking batched)
    if (meshLoadPromises.length > 0) {
      await Promise.all(meshLoadPromises);
    }

    return {
      x: state.chunkX,
      z: state.chunkZ,
      state,
      root: chunkRoot,
      entities,
      meshNodes,
      meshBindings,
      lastAccessed: Date.now(),
      lodIds,
    };
  }

  /**
   * Load and create a mesh instance for a single entity.
   *
   * Uses AssetManager.createInstanceByPath (synchronous if pre-loaded) or
   * falls back to loadAssetByPath + createInstanceByPath if the asset was
   * not pre-loaded yet.
   */
  private async loadEntityMesh(
    binding: EntityMeshBinding,
    entDef: AssemblageEntityDef,
    parentNode: TransformNode,
    meshNodes: TransformNode[],
    lodIds: string[],
    chunkState: ChunkState
  ): Promise<void> {
    const { entity, modelPath } = binding;
    if (!modelPath) return;

    binding.loadState = 'loading';

    try {
      // Ensure the asset is cached
      if (!AssetManager.isPathCached(modelPath)) {
        await AssetManager.loadAssetByPath(modelPath, this.scene);
      }

      // Bail if disposed during async load
      if (this.disposed) return;

      // Determine appropriate LOD category based on entity type
      const lodCategory = this.getLODCategoryForEntity(entDef);

      // Create an instance from the cached source
      const instanceName = `mesh_${entity.id}`;
      const meshNode = AssetManager.createInstanceByPath(
        modelPath,
        instanceName,
        this.scene,
        true, // apply LOD
        lodCategory
      );

      if (!meshNode) {
        binding.loadState = 'failed';
        return;
      }

      // Apply the entity definition's local transform
      meshNode.parent = parentNode;

      if (entDef.position) {
        meshNode.position = new Vector3(entDef.position.x, entDef.position.y, entDef.position.z);
      }

      if (entDef.rotation) {
        meshNode.rotation = new Vector3(entDef.rotation.x, entDef.rotation.y, entDef.rotation.z);
      }

      if (entDef.scale !== undefined) {
        const s = entDef.scale;
        meshNode.scaling = new Vector3(s, s, s);
      }

      // Enable collisions and shadows on instanced meshes
      this.configureMeshPhysics(meshNode, entDef);

      // Register with LODManager for distance-based quality management
      const lodId = `chunk_${chunkState.chunkX}_${chunkState.chunkZ}_${entity.id}`;
      LODManager.registerMesh(lodId, meshNode, lodCategory, false).catch(() => {
        // Non-critical -- LODManager registration can fail if node has no geometry
      });
      lodIds.push(lodId);

      // Bind mesh to entity renderable component
      entity.renderable = {
        mesh: meshNode,
        visible: true,
      };

      // Apply transform component from definition if not already set
      if (!entity.transform && entDef.position) {
        const absPos = meshNode.getAbsolutePosition();
        entity.transform = {
          position: absPos,
          rotation: meshNode.rotation.clone(),
          scale: meshNode.scaling.clone(),
        };
      }

      binding.meshNode = meshNode;
      binding.loadState = 'loaded';
      meshNodes.push(meshNode);
    } catch (error) {
      console.warn(
        `[ECSChunkManager] Failed to load mesh for entity ${entity.id} (${modelPath}):`,
        error
      );
      binding.loadState = 'failed';
    }
  }

  /**
   * Determine the LOD category from the entity type in the assemblage definition.
   */
  private getLODCategoryForEntity(entDef: AssemblageEntityDef): string {
    switch (entDef.type) {
      case 'structural':
        return 'environment';
      case 'prop':
        return 'prop';
      case 'light':
        return 'decoration';
      case 'door':
        return 'environment';
      case 'trigger':
      case 'spawn':
        return 'decoration';
      default:
        return 'prop';
    }
  }

  /**
   * Configure collision and shadow reception on instanced meshes.
   */
  private configureMeshPhysics(meshNode: TransformNode, entDef: AssemblageEntityDef): void {
    const isStructural = entDef.type === 'structural' || entDef.type === 'door';
    const childMeshes = meshNode.getChildMeshes(false);

    for (const child of childMeshes) {
      if (isStructural) {
        child.checkCollisions = true;
      }
      child.receiveShadows = true;
    }
  }

  // -----------------------------------------------------------------------
  // Chunk state persistence
  // -----------------------------------------------------------------------

  private updateChunkState(chunk: LoadedChunk): void {
    chunk.state.lastVisited = Date.now();

    // Doors
    chunk.state.doors = [];
    for (const entity of chunk.entities) {
      if (entity.door) {
        chunk.state.doors.push({
          entityId: entity.id,
          state: entity.door.state,
        });
      }
    }

    // Enemies
    chunk.state.enemies = [];
    for (const entity of chunk.entities) {
      if (entity.tags?.enemy && entity.health) {
        chunk.state.enemies.push({
          entityId: entity.id,
          dead: entity.health.current <= 0,
          position: entity.transform
            ? {
                x: entity.transform.position.x,
                y: entity.transform.position.y,
                z: entity.transform.position.z,
              }
            : undefined,
        });
      }
    }

    // Loot
    chunk.state.loot = [];
    for (const entity of chunk.entities) {
      if (entity.prop?.contents) {
        chunk.state.loot.push({
          entityId: entity.id,
          collected: entity.prop.used,
        });
      }
    }

    // Triggers
    chunk.state.triggers = [];
    for (const entity of chunk.entities) {
      if (entity.triggerZone) {
        chunk.state.triggers.push({
          entityId: entity.id,
          triggered: entity.triggerZone.triggered,
        });
      }
    }
  }

  private async loadChunkState(x: number, z: number): Promise<ChunkState | null> {
    try {
      const key = `chunk_${this.environment}_${x}_${z}`;
      const data = worldDb.getChunkData(key);
      if (data) {
        return JSON.parse(data) as ChunkState;
      }
    } catch (error) {
      console.warn(`[ECSChunkManager] Failed to load chunk state: ${error}`);
    }
    return null;
  }

  private async saveChunkState(state: ChunkState): Promise<void> {
    try {
      const key = `chunk_${this.environment}_${state.chunkX}_${state.chunkZ}`;
      worldDb.setChunkData(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`[ECSChunkManager] Failed to save chunk state: ${error}`);
    }
  }

  // -----------------------------------------------------------------------
  // Resource cleanup
  // -----------------------------------------------------------------------

  /**
   * Dispose all BabylonJS and ECS resources owned by a chunk.
   */
  private disposeChunkResources(chunk: LoadedChunk): void {
    // Unregister all LOD tracked meshes
    for (const lodId of chunk.lodIds) {
      LODManager.unregisterMesh(lodId);
    }

    // Remove ECS entities (this also disposes their renderable.mesh via removeEntity)
    for (const entity of chunk.entities) {
      removeEntity(entity);
    }

    // Dispose all mesh nodes that might not have been disposed by removeEntity
    // (e.g., assemblage root nodes, parent TransformNodes).
    // We iterate in reverse to dispose children before parents.
    for (let i = chunk.meshNodes.length - 1; i >= 0; i--) {
      const node = chunk.meshNodes[i];
      if (!node.isDisposed()) {
        node.dispose(false, true);
      }
    }

    // Dispose chunk root
    if (!chunk.root.isDisposed()) {
      chunk.root.dispose(false, true);
    }

    // Clear references
    chunk.entities.length = 0;
    chunk.meshNodes.length = 0;
    chunk.meshBindings.length = 0;
    chunk.lodIds.length = 0;
  }
}
