/**
 * ChunkManager - Handles procedural loading/unloading of world chunks
 *
 * Key features:
 * 1. Loads chunks in a radius around the player
 * 2. Unloads chunks beyond the render radius to save memory
 * 3. Persists chunk state to SQLite so visited locations don't change
 * 4. Uses deterministic seeding for reproducible generation
 */

import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { worldDb } from '../db/worldDatabase';
import {
  type AssemblageDefinition,
  type ChunkState,
  type EnvironmentType,
  type PlacedAssemblage,
  CHUNK_SIZE,
  RENDER_RADIUS,
  UNLOAD_RADIUS,
  getAssemblagesByEnvironment,
  ALL_ASSEMBLAGES,
} from './assemblages';
import { world, createEntity, removeEntity, type Entity } from '../core/ecs';

// Seeded random number generator for reproducible chunk generation
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
  // Simple but effective hash combining coordinates with world seed
  let hash = worldSeed;
  hash = ((hash << 5) - hash + x) | 0;
  hash = ((hash << 5) - hash + z) | 0;
  hash = ((hash << 5) - hash + x * z) | 0;
  return Math.abs(hash);
}

interface LoadedChunk {
  x: number;
  z: number;
  state: ChunkState;
  root: TransformNode;
  entities: Entity[];
  lastAccessed: number;
}

export class ChunkManager {
  private scene: Scene;
  private worldSeed: number;
  private environment: EnvironmentType;
  private loadedChunks: Map<string, LoadedChunk> = new Map();
  private loadingChunks: Set<string> = new Set();
  private playerChunkX = 0;
  private playerChunkZ = 0;
  private root: TransformNode;

  constructor(scene: Scene, worldSeed: number, environment: EnvironmentType) {
    this.scene = scene;
    this.worldSeed = worldSeed;
    this.environment = environment;
    this.root = new TransformNode('chunkManager', scene);
  }

  private getChunkKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  private worldToChunk(worldPos: Vector3): { x: number; z: number } {
    return {
      x: Math.floor(worldPos.x / CHUNK_SIZE),
      z: Math.floor(worldPos.z / CHUNK_SIZE),
    };
  }

  /**
   * Update chunk loading based on player position
   */
  async update(playerPosition: Vector3): Promise<void> {
    const playerChunk = this.worldToChunk(playerPosition);

    // Check if player has moved to a new chunk
    if (playerChunk.x !== this.playerChunkX || playerChunk.z !== this.playerChunkZ) {
      this.playerChunkX = playerChunk.x;
      this.playerChunkZ = playerChunk.z;

      // Trigger chunk loading/unloading
      await this.updateLoadedChunks();
    }

    // Update last accessed time for chunks player is near
    const nearbyKey = this.getChunkKey(playerChunk.x, playerChunk.z);
    const nearbyChunk = this.loadedChunks.get(nearbyKey);
    if (nearbyChunk) {
      nearbyChunk.lastAccessed = Date.now();
    }
  }

  /**
   * Load chunks in render radius, unload those outside
   */
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

    // Unload distant chunks first (frees memory)
    for (const key of chunksToUnload) {
      await this.unloadChunk(key);
    }

    // Load new chunks (prioritize closer ones)
    chunksToLoad.sort((a, b) => {
      const distA = Math.abs(a.x - this.playerChunkX) + Math.abs(a.z - this.playerChunkZ);
      const distB = Math.abs(b.x - this.playerChunkX) + Math.abs(b.z - this.playerChunkZ);
      return distA - distB;
    });

    // Load chunks in batches to avoid frame drops
    const BATCH_SIZE = 2;
    for (let i = 0; i < Math.min(chunksToLoad.length, BATCH_SIZE); i++) {
      const { x, z } = chunksToLoad[i];
      await this.loadChunk(x, z);
    }
  }

  /**
   * Load a chunk - either from database or generate new
   */
  private async loadChunk(x: number, z: number): Promise<void> {
    const key = this.getChunkKey(x, z);
    if (this.loadedChunks.has(key) || this.loadingChunks.has(key)) {
      return;
    }

    this.loadingChunks.add(key);

    try {
      // Check if chunk exists in database
      let state = await this.loadChunkState(x, z);

      if (!state) {
        // Generate new chunk
        state = await this.generateChunk(x, z);
        // Save to database
        await this.saveChunkState(state);
      }

      // Spawn the chunk in the scene
      const loaded = await this.spawnChunk(state);
      this.loadedChunks.set(key, loaded);

    } catch (error) {
      console.error(`Failed to load chunk ${key}:`, error);
    } finally {
      this.loadingChunks.delete(key);
    }
  }

  /**
   * Unload a chunk - save state and remove from scene
   */
  private async unloadChunk(key: string): Promise<void> {
    const chunk = this.loadedChunks.get(key);
    if (!chunk) return;

    // Update state with current entity states
    await this.updateChunkState(chunk);

    // Save to database
    await this.saveChunkState(chunk.state);

    // Remove entities from ECS
    for (const entity of chunk.entities) {
      removeEntity(entity);
    }

    // Dispose scene objects
    chunk.root.dispose();

    this.loadedChunks.delete(key);
  }

  /**
   * Generate a new chunk using seeded random and assemblages
   */
  private async generateChunk(x: number, z: number): Promise<ChunkState> {
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

    // Get available assemblages for this environment
    const available = getAssemblagesByEnvironment(this.environment);

    if (available.length === 0) {
      console.warn(`No assemblages for environment: ${this.environment}`);
      return state;
    }

    // Simple generation: place assemblages based on environment type
    if (this.environment === 'station_interior') {
      // Interior: corridor-based layout
      this.generateInteriorLayout(state, rng, available);
    } else if (this.environment === 'surface_rocky') {
      // Exterior: terrain with scattered features
      this.generateExteriorLayout(state, rng, available);
    } else if (this.environment === 'hive_organic') {
      // Hive: tunnel network
      this.generateHiveLayout(state, rng, available);
    }

    return state;
  }

  private generateInteriorLayout(
    state: ChunkState,
    rng: SeededRandom,
    available: AssemblageDefinition[]
  ): void {
    // For interior, create a corridor network
    const corridors = available.filter(a =>
      a.type.startsWith('corridor') || a.type === 'airlock'
    );

    if (corridors.length === 0) return;

    // Place 2-4 assemblages per chunk
    const count = rng.nextInt(2, 4);
    const gridSize = CHUNK_SIZE / 4; // 8 grid cells per chunk

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
        entityIds: [], // Will be filled when spawned
      });
    }
  }

  private generateExteriorLayout(
    state: ChunkState,
    rng: SeededRandom,
    available: AssemblageDefinition[]
  ): void {
    // Always have base terrain
    const terrains = available.filter(a => a.type.startsWith('terrain'));
    if (terrains.length > 0) {
      state.assemblages.push({
        type: 'terrain_flat',
        gridX: 0,
        gridZ: 0,
        rotation: 0,
        entityIds: [],
      });
    }

    // Add rock clusters randomly
    const rocks = available.filter(a => a.type === 'rock_cluster');
    if (rocks.length > 0) {
      const rockCount = rng.nextInt(0, 5);
      for (let i = 0; i < rockCount; i++) {
        const gridX = rng.nextInt(0, 6);
        const gridZ = rng.nextInt(0, 6);

        state.assemblages.push({
          type: 'rock_cluster',
          gridX,
          gridZ,
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
    const tunnels = available.filter(a =>
      a.type.startsWith('tunnel') || a.type === 'egg_chamber'
    );

    if (tunnels.length === 0) return;

    // Hives are more connected - create a branching network
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

  /**
   * Spawn chunk entities in the scene
   */
  private async spawnChunk(state: ChunkState): Promise<LoadedChunk> {
    const chunkRoot = new TransformNode(
      `chunk_${state.chunkX}_${state.chunkZ}`,
      this.scene
    );
    chunkRoot.parent = this.root;

    // Position chunk in world space
    chunkRoot.position.x = state.chunkX * CHUNK_SIZE;
    chunkRoot.position.z = state.chunkZ * CHUNK_SIZE;

    const entities: Entity[] = [];

    // Spawn each assemblage
    for (const placed of state.assemblages) {
      const def = ALL_ASSEMBLAGES[placed.type];
      if (!def) {
        console.warn(`Unknown assemblage type: ${placed.type}`);
        continue;
      }

      // Create assemblage root
      const assembRoot = new TransformNode(
        `assem_${placed.type}_${placed.gridX}_${placed.gridZ}`,
        this.scene
      );
      assembRoot.parent = chunkRoot;
      assembRoot.position.x = placed.gridX * 4;
      assembRoot.position.z = placed.gridZ * 4;
      assembRoot.rotation.y = (placed.rotation * Math.PI) / 180;

      // Spawn entities from assemblage definition
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

        // TODO: Load actual mesh from modelPath
        // For now, just create placeholder
      }
    }

    return {
      x: state.chunkX,
      z: state.chunkZ,
      state,
      root: chunkRoot,
      entities,
      lastAccessed: Date.now(),
    };
  }

  /**
   * Update chunk state from current entity states (for persistence)
   */
  private async updateChunkState(chunk: LoadedChunk): Promise<void> {
    chunk.state.lastVisited = Date.now();

    // Update door states
    chunk.state.doors = [];
    for (const entity of chunk.entities) {
      if (entity.door) {
        chunk.state.doors.push({
          entityId: entity.id,
          state: entity.door.state,
        });
      }
    }

    // Update enemy states
    chunk.state.enemies = [];
    for (const entity of chunk.entities) {
      if (entity.tags?.enemy && entity.health) {
        chunk.state.enemies.push({
          entityId: entity.id,
          dead: entity.health.current <= 0,
          position: entity.transform ? {
            x: entity.transform.position.x,
            y: entity.transform.position.y,
            z: entity.transform.position.z,
          } : undefined,
        });
      }
    }

    // Update loot states
    chunk.state.loot = [];
    for (const entity of chunk.entities) {
      if (entity.prop?.contents) {
        chunk.state.loot.push({
          entityId: entity.id,
          collected: entity.prop.used,
        });
      }
    }

    // Update trigger states
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

  /**
   * Load chunk state from SQLite
   */
  private async loadChunkState(x: number, z: number): Promise<ChunkState | null> {
    try {
      const key = `chunk_${this.environment}_${x}_${z}`;
      const data = worldDb.getChunkData(key);
      if (data) {
        return JSON.parse(data) as ChunkState;
      }
    } catch (error) {
      console.warn(`Failed to load chunk state: ${error}`);
    }
    return null;
  }

  /**
   * Save chunk state to SQLite
   */
  private async saveChunkState(state: ChunkState): Promise<void> {
    try {
      const key = `chunk_${this.environment}_${state.chunkX}_${state.chunkZ}`;
      const data = JSON.stringify(state);
      worldDb.setChunkData(key, data);
    } catch (error) {
      console.warn(`Failed to save chunk state: ${error}`);
    }
  }

  /**
   * Force reload all chunks (e.g., after environment change)
   */
  async reloadAll(): Promise<void> {
    // Unload all current chunks
    for (const key of [...this.loadedChunks.keys()]) {
      await this.unloadChunk(key);
    }

    // Reload around player
    await this.updateLoadedChunks();
  }

  /**
   * Change environment type (e.g., entering hive from surface)
   */
  async setEnvironment(env: EnvironmentType): Promise<void> {
    if (env === this.environment) return;

    this.environment = env;
    await this.reloadAll();
  }

  /**
   * Get currently loaded chunk count
   */
  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    for (const chunk of this.loadedChunks.values()) {
      for (const entity of chunk.entities) {
        removeEntity(entity);
      }
      chunk.root.dispose();
    }
    this.loadedChunks.clear();
    this.root.dispose();
  }
}
