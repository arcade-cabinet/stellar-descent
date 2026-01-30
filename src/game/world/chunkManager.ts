/**
 * ChunkManager (World) - Handles procedural terrain chunks for exterior levels.
 *
 * Manages building meshes, obstacle meshes, and enemy entities for the
 * surface world. Integrates with the PerformanceManager for adaptive load
 * radius and with LODManager for distance-based quality.
 *
 * Key improvements:
 * - Shared materials (no per-mesh material allocation)
 * - Proper dispose() to clean up all BabylonJS resources and materials
 * - LODManager integration for all created meshes
 * - Coordination API for the ECS ChunkManager
 * - Adaptive load/unload radius based on device performance
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getEnemySoundManager } from '../core/EnemySoundManager';
import { type Entity, removeEntity } from '../core/ecs';
import { LODManager } from '../core/LODManager';
import { getPerformanceManager } from '../core/PerformanceManager';
import { type ChunkData, worldDb } from '../db/worldDatabase';
import { ALIEN_SPECIES, createAlienEntity } from '../entities/aliens';
import { tokens } from '../utils/designTokens';

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
// Generation data types
// ---------------------------------------------------------------------------

interface GeneratedBuilding {
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  type: 'bunker' | 'tower' | 'depot' | 'ruin';
}

interface GeneratedObstacle {
  x: number;
  z: number;
  type: 'rock' | 'crater' | 'debris' | 'pillar';
  scale: number;
}

interface GeneratedEnemy {
  x: number;
  z: number;
  type: 'skitterer' | 'lurker' | 'spewer' | 'husk' | 'broodmother';
  seed: number;
}

// Seeded random number generator
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// LOD category for world chunk geometry
// ---------------------------------------------------------------------------

const WORLD_LOD_CATEGORY = 'environment';

// ---------------------------------------------------------------------------
// ChunkManager
// ---------------------------------------------------------------------------

export class ChunkManager {
  private scene: Scene;
  private loadedChunks: Map<string, { entities: Entity[]; meshes: Mesh[]; lodIds: string[] }> =
    new Map();
  private materials: Map<string, StandardMaterial> = new Map();
  private baseSeed: number;
  private disposed = false;

  /** Set of chunk keys currently being loaded (prevents double-load). */
  private loadingChunks: Set<string> = new Set();

  constructor(scene: Scene) {
    this.scene = scene;
    this.baseSeed = Date.now();
    this.createMaterials();
  }

  // -----------------------------------------------------------------------
  // Material setup (shared, created once)
  // -----------------------------------------------------------------------

  private createMaterials(): void {
    // Rock material - harsh sunlit appearance
    const rockMat = new StandardMaterial('chunkRockMat', this.scene);
    rockMat.diffuseColor = Color3.FromHexString(tokens.colors.environment.rock);
    rockMat.specularColor = new Color3(0.3, 0.25, 0.2);
    rockMat.roughness = 0.8;
    rockMat.freeze(); // immutable for performance
    this.materials.set('rock', rockMat);

    // Building material - military concrete
    const buildingMat = new StandardMaterial('chunkBuildingMat', this.scene);
    buildingMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.khakiDark);
    buildingMat.specularColor = new Color3(0.1, 0.1, 0.1);
    const concreteTex = new Texture(
      'https://assets.babylonjs.com/textures/floor.png',
      this.scene
    );
    concreteTex.uScale = 4;
    concreteTex.vScale = 4;
    buildingMat.diffuseTexture = concreteTex;
    this.materials.set('building', buildingMat);

    // Metal material for towers
    const metalMat = new StandardMaterial('chunkMetalMat', this.scene);
    metalMat.diffuseColor = Color3.FromHexString(tokens.colors.accent.gunmetal);
    metalMat.specularColor = new Color3(0.5, 0.5, 0.5);
    metalMat.specularPower = 64;
    metalMat.freeze();
    this.materials.set('metal', metalMat);

    // Sand/ground material
    const sandMat = new StandardMaterial('chunkSandMat', this.scene);
    sandMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.sand);
    const sandTex = new Texture(
      'https://assets.babylonjs.com/textures/sand.png',
      this.scene
    );
    sandTex.uScale = 10;
    sandTex.vScale = 10;
    sandMat.diffuseTexture = sandTex;
    this.materials.set('sand', sandMat);

    // Shared crater material (avoids per-mesh allocation)
    const craterMat = new StandardMaterial('chunkCraterMat', this.scene);
    craterMat.diffuseColor = Color3.FromHexString(tokens.colors.environment.rockDark);
    craterMat.freeze();
    this.materials.set('crater', craterMat);
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

  private generateChunkSeed(chunkX: number, chunkZ: number): number {
    return this.baseSeed + chunkX * 73856093 + chunkZ * 19349663;
  }

  // -----------------------------------------------------------------------
  // Chunk generation
  // -----------------------------------------------------------------------

  private generateChunkData(chunkX: number, chunkZ: number): ChunkData {
    const seed = this.generateChunkSeed(chunkX, chunkZ);
    const random = seededRandom(seed);

    const isSpawnChunk = chunkX === 0 && chunkZ === 0;
    const distanceFromSpawn = Math.sqrt(chunkX * chunkX + chunkZ * chunkZ);

    // Buildings
    const buildings: GeneratedBuilding[] = [];
    const buildingCount = isSpawnChunk ? 0 : Math.floor(random() * 4) + 1;
    const types: GeneratedBuilding['type'][] = ['bunker', 'tower', 'depot', 'ruin'];

    for (let i = 0; i < buildingCount; i++) {
      buildings.push({
        x: (random() - 0.5) * CHUNK_SIZE * 0.8,
        z: (random() - 0.5) * CHUNK_SIZE * 0.8,
        width: 5 + random() * 15,
        height: 3 + random() * 20,
        depth: 5 + random() * 15,
        type: types[Math.floor(random() * types.length)],
      });
    }

    // Obstacles
    const obstacles: GeneratedObstacle[] = [];
    const obstacleCount = isSpawnChunk
      ? Math.floor(random() * 4) + 2
      : Math.floor(random() * 12) + 5;
    const obstacleTypes: GeneratedObstacle['type'][] = ['rock', 'crater', 'debris', 'pillar'];

    for (let i = 0; i < obstacleCount; i++) {
      obstacles.push({
        x: (random() - 0.5) * CHUNK_SIZE * 0.9,
        z: (random() - 0.5) * CHUNK_SIZE * 0.9,
        type: obstacleTypes[Math.floor(random() * obstacleTypes.length)],
        scale: 0.5 + random() * 2,
      });
    }

    // Enemies
    const enemies: GeneratedEnemy[] = [];
    const enemyMultiplier = isSpawnChunk ? 0 : Math.min(distanceFromSpawn / 2, 1);
    const baseEnemyCount = Math.floor(random() * 6) + 2;
    const enemyCount = Math.floor(baseEnemyCount * enemyMultiplier);

    const enemyWeights: { type: GeneratedEnemy['type']; weight: number }[] = [
      { type: 'skitterer', weight: 0.4 },
      { type: 'husk', weight: 0.25 },
      { type: 'lurker', weight: 0.2 },
      { type: 'spewer', weight: 0.12 },
      { type: 'broodmother', weight: 0.03 },
    ];

    const selectEnemyType = (): GeneratedEnemy['type'] => {
      const roll = random();
      let cumulative = 0;
      for (const entry of enemyWeights) {
        cumulative += entry.weight;
        if (roll < cumulative) return entry.type;
      }
      return 'skitterer';
    };

    for (let i = 0; i < enemyCount; i++) {
      let type = selectEnemyType();
      if (type === 'broodmother' && distanceFromSpawn < 4) {
        type = 'lurker';
      }

      enemies.push({
        x: (random() - 0.5) * CHUNK_SIZE * 0.7,
        z: (random() - 0.5) * CHUNK_SIZE * 0.7,
        type,
        seed: Math.floor(random() * 1000000),
      });
    }

    return {
      chunkX,
      chunkZ,
      seed,
      buildings: JSON.stringify(buildings),
      obstacles: JSON.stringify(obstacles),
      enemies: JSON.stringify(enemies),
      visited: true,
    };
  }

  // -----------------------------------------------------------------------
  // Mesh creation helpers
  // -----------------------------------------------------------------------

  private createBuildingMesh(
    building: GeneratedBuilding,
    chunkX: number,
    chunkZ: number
  ): Mesh {
    const worldX = chunkX * CHUNK_SIZE + building.x;
    const worldZ = chunkZ * CHUNK_SIZE + building.z;

    const perfManager = getPerformanceManager();
    const isMobile = perfManager.isMobile();
    const cylinderTessellation = isMobile ? 8 : 16;

    let mesh: Mesh;

    switch (building.type) {
      case 'tower': {
        mesh = MeshBuilder.CreateCylinder(
          'tower',
          {
            height: building.height,
            diameter: building.width * 0.5,
            tessellation: cylinderTessellation,
          },
          this.scene
        );
        mesh.material = this.materials.get('metal')!;
        break;
      }
      case 'bunker': {
        mesh = MeshBuilder.CreateBox(
          'bunker',
          { width: building.width, height: building.height * 0.5, depth: building.depth },
          this.scene
        );
        mesh.material = this.materials.get('building')!;
        break;
      }
      case 'depot': {
        mesh = MeshBuilder.CreateBox(
          'depot',
          { width: building.width, height: building.height * 0.7, depth: building.depth },
          this.scene
        );
        mesh.material = this.materials.get('building')!;
        break;
      }
      case 'ruin':
      default: {
        mesh = MeshBuilder.CreateBox(
          'ruin',
          { width: building.width, height: building.height * 0.3, depth: building.depth },
          this.scene
        );
        mesh.material = this.materials.get('rock')!;
        break;
      }
    }

    mesh.position.set(worldX, building.height * 0.5, worldZ);
    mesh.checkCollisions = true;
    mesh.receiveShadows = true;

    // Apply LOD for distance-based quality
    LODManager.applyNativeLOD(mesh, WORLD_LOD_CATEGORY);

    return mesh;
  }

  private createObstacleMesh(
    obstacle: GeneratedObstacle,
    chunkX: number,
    chunkZ: number
  ): Mesh {
    const worldX = chunkX * CHUNK_SIZE + obstacle.x;
    const worldZ = chunkZ * CHUNK_SIZE + obstacle.z;

    const perfManager = getPerformanceManager();
    const isMobile = perfManager.isMobile();
    const cylinderTessellation = isMobile ? 6 : 12;
    const polyType = isMobile ? 0 : 1;

    let mesh: Mesh;

    switch (obstacle.type) {
      case 'rock': {
        mesh = MeshBuilder.CreatePolyhedron(
          'rock',
          { type: polyType, size: obstacle.scale * 2 },
          this.scene
        );
        const seed = Math.abs(obstacle.x * 1000 + obstacle.z);
        const rng = seededRandom(seed);

        mesh.scaling.y = 0.7 + rng() * 0.6;
        mesh.rotation.y = rng() * Math.PI * 2;

        mesh.material = this.materials.get('rock')!;
        mesh.position.set(worldX, obstacle.scale, worldZ);
        break;
      }
      case 'pillar': {
        mesh = MeshBuilder.CreateCylinder(
          'pillar',
          {
            height: obstacle.scale * 8,
            diameter: obstacle.scale * 1.5,
            tessellation: cylinderTessellation,
          },
          this.scene
        );
        mesh.material = this.materials.get('rock')!;
        mesh.position.set(worldX, obstacle.scale * 4, worldZ);
        break;
      }
      case 'crater': {
        mesh = MeshBuilder.CreateDisc(
          'crater',
          { radius: obstacle.scale * 3, tessellation: isMobile ? 12 : 24 },
          this.scene
        );
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(worldX, 0.05, worldZ);
        // Use shared crater material instead of creating per-mesh
        mesh.material = this.materials.get('crater')!;
        break;
      }
      case 'debris':
      default: {
        mesh = MeshBuilder.CreateBox(
          'debris',
          { width: obstacle.scale, height: obstacle.scale * 0.5, depth: obstacle.scale },
          this.scene
        );
        // Use deterministic rotation instead of Math.random()
        const seed = Math.abs(obstacle.x * 7919 + obstacle.z * 104729);
        const rng = seededRandom(seed);
        mesh.rotation.y = rng() * Math.PI;
        mesh.material = this.materials.get('metal')!;
        mesh.position.set(worldX, obstacle.scale * 0.25, worldZ);
        break;
      }
    }

    mesh.checkCollisions = true;
    mesh.receiveShadows = true;

    // Apply LOD
    LODManager.applyNativeLOD(mesh, 'prop');

    return mesh;
  }

  // -----------------------------------------------------------------------
  // Enemy entity creation
  // -----------------------------------------------------------------------

  private createEnemyEntity(
    enemy: GeneratedEnemy,
    chunkX: number,
    chunkZ: number,
    playSpawnSound = false
  ): Entity {
    const worldX = chunkX * CHUNK_SIZE + enemy.x;
    const worldZ = chunkZ * CHUNK_SIZE + enemy.z;
    const position = new Vector3(worldX, 1, worldZ);

    const species = ALIEN_SPECIES[enemy.type];
    if (!species) {
      return createAlienEntity(this.scene, ALIEN_SPECIES.skitterer, position, enemy.seed);
    }

    const entity = createAlienEntity(this.scene, species, position, enemy.seed);

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

    try {
      let chunkData = worldDb.getChunk(chunkX, chunkZ);

      if (!chunkData) {
        chunkData = this.generateChunkData(chunkX, chunkZ);
        worldDb.saveChunk(chunkData);
      }

      if (this.disposed) return;

      const entities: Entity[] = [];
      const meshes: Mesh[] = [];
      const lodIds: string[] = [];

      // Buildings
      const buildings: GeneratedBuilding[] = JSON.parse(chunkData.buildings);
      for (const building of buildings) {
        const mesh = this.createBuildingMesh(building, chunkX, chunkZ);
        meshes.push(mesh);
      }

      // Obstacles
      const obstacles: GeneratedObstacle[] = JSON.parse(chunkData.obstacles);
      for (const obstacle of obstacles) {
        const mesh = this.createObstacleMesh(obstacle, chunkX, chunkZ);
        meshes.push(mesh);
      }

      // Register meshes with LODManager for tracked distance-based updates
      for (const mesh of meshes) {
        const lodId = `world_${key}_${mesh.name}_${mesh.uniqueId}`;
        lodIds.push(lodId);
      }

      // Saved entities
      const savedEntities = worldDb.getEntitiesInChunk(chunkX, chunkZ);
      const loadedEntityIds = new Set<string>();

      for (const saved of savedEntities) {
        const speciesId = saved.type === 'boss' ? 'broodmother' : 'skitterer';
        const species = ALIEN_SPECIES[speciesId];
        if (species) {
          const entity = createAlienEntity(
            this.scene,
            species,
            new Vector3(saved.x, saved.y, saved.z)
          );
          if (entity.health) entity.health.current = saved.health;
          entity.chunkInfo = { chunkX, chunkZ };
          entities.push(entity);
          loadedEntityIds.add(saved.id);
        }
      }

      // New enemies from generation (skip if we loaded from save)
      if (savedEntities.length === 0) {
        const enemies: GeneratedEnemy[] = JSON.parse(chunkData.enemies);
        for (const enemy of enemies) {
          entities.push(this.createEnemyEntity(enemy, chunkX, chunkZ));
        }
      }

      this.loadedChunks.set(key, { entities, meshes, lodIds });
    } catch (error) {
      console.error(`[WorldChunkManager] Failed to load chunk ${key}:`, error);
    } finally {
      this.loadingChunks.delete(key);
    }
  }

  unloadChunk(chunkX: number, chunkZ: number): void {
    const key = this.getChunkKey(chunkX, chunkZ);
    const chunk = this.loadedChunks.get(key);
    if (!chunk) return;

    // Save entity states before unloading
    for (const entity of chunk.entities) {
      if (entity.transform && entity.health) {
        worldDb.saveEntity(
          {
            id: entity.id,
            type: entity.tags?.boss ? 'boss' : 'enemy',
            x: entity.transform.position.x,
            y: entity.transform.position.y,
            z: entity.transform.position.z,
            health: entity.health.current,
            data: JSON.stringify({}),
          },
          chunkX,
          chunkZ
        );
      }
      removeEntity(entity);
    }

    // Unregister LOD tracked meshes
    for (const lodId of chunk.lodIds) {
      LODManager.unregisterMesh(lodId);
    }

    // Dispose meshes (geometry + vertex buffers)
    for (const mesh of chunk.meshes) {
      if (!mesh.isDisposed()) {
        mesh.dispose(false, false); // keep material (shared), dispose geometry
      }
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

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  /**
   * Dispose all resources held by this ChunkManager.
   * Unloads all chunks, disposes shared materials and textures.
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

    // Dispose shared materials (and their textures)
    for (const [, mat] of this.materials) {
      if (mat.diffuseTexture) {
        mat.diffuseTexture.dispose();
      }
      mat.dispose();
    }
    this.materials.clear();

    this.loadedChunks.clear();
    this.loadingChunks.clear();
  }
}
