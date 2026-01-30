import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { Vehicle } from 'yuka';
import { createEntity, type Entity, queries, removeEntity } from '../core/ecs';
import { type ChunkData, worldDb } from '../db/worldDatabase';
import { ALIEN_SPECIES, createAlienEntity } from '../entities/aliens';
import { tokens } from '../utils/designTokens';

export const CHUNK_SIZE = 100;
export const LOAD_RADIUS = 3; // chunks
export const UNLOAD_RADIUS = 5; // chunks

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

export class ChunkManager {
  private scene: Scene;
  private loadedChunks: Map<string, { entities: Entity[]; meshes: Mesh[] }> = new Map();
  private materials: Map<string, StandardMaterial> = new Map();
  private baseSeed: number;

  constructor(scene: Scene) {
    this.scene = scene;
    this.baseSeed = Date.now();
    this.createMaterials();
  }

  private createMaterials(): void {
    // Rock material - harsh sunlit appearance
    const rockMat = new StandardMaterial('rockMat', this.scene);
    rockMat.diffuseColor = Color3.FromHexString(tokens.colors.environment.rock);
    rockMat.specularColor = new Color3(0.3, 0.25, 0.2);
    rockMat.roughness = 0.8;
    this.materials.set('rock', rockMat);

    // Building material - military concrete
    const buildingMat = new StandardMaterial('buildingMat', this.scene);
    buildingMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.khakiDark);
    buildingMat.specularColor = new Color3(0.1, 0.1, 0.1);
    const concreteTex = new Texture('https://assets.babylonjs.com/textures/floor.png', this.scene);
    concreteTex.uScale = 4;
    concreteTex.vScale = 4;
    buildingMat.diffuseTexture = concreteTex;
    this.materials.set('building', buildingMat);

    // Metal material for towers
    const metalMat = new StandardMaterial('metalMat', this.scene);
    metalMat.diffuseColor = Color3.FromHexString(tokens.colors.accent.gunmetal);
    metalMat.specularColor = new Color3(0.5, 0.5, 0.5);
    metalMat.specularPower = 64;
    this.materials.set('metal', metalMat);

    // Sand/ground material
    const sandMat = new StandardMaterial('sandMat', this.scene);
    sandMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.sand);
    const sandTex = new Texture('https://assets.babylonjs.com/textures/sand.png', this.scene);
    sandTex.uScale = 10;
    sandTex.vScale = 10;
    sandMat.diffuseTexture = sandTex;
    this.materials.set('sand', sandMat);
  }

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

  private generateChunkData(chunkX: number, chunkZ: number): ChunkData {
    const seed = this.generateChunkSeed(chunkX, chunkZ);
    const random = seededRandom(seed);

    // Check if this is the spawn chunk (0,0) - keep it safer
    const isSpawnChunk = chunkX === 0 && chunkZ === 0;
    const distanceFromSpawn = Math.sqrt(chunkX * chunkX + chunkZ * chunkZ);

    // Generate buildings
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

    // Generate obstacles (rocks, craters, debris)
    const obstacles: GeneratedObstacle[] = [];
    const obstacleCount = isSpawnChunk
      ? Math.floor(random() * 4) + 2 // Fewer obstacles at spawn
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

    // Generate enemies - scale with distance from spawn
    const enemies: GeneratedEnemy[] = [];
    // No enemies in spawn chunk, fewer in adjacent chunks
    const enemyMultiplier = isSpawnChunk ? 0 : Math.min(distanceFromSpawn / 2, 1);
    const baseEnemyCount = Math.floor(random() * 6) + 2;
    const enemyCount = Math.floor(baseEnemyCount * enemyMultiplier);

    // Weight distribution: skitterers most common, broodmothers rare
    const enemyWeights: { type: GeneratedEnemy['type']; weight: number }[] = [
      { type: 'skitterer', weight: 0.4 }, // 40% - common swarm
      { type: 'husk', weight: 0.25 }, // 25% - medium threat
      { type: 'lurker', weight: 0.2 }, // 20% - sneaky
      { type: 'spewer', weight: 0.12 }, // 12% - ranged threat
      { type: 'broodmother', weight: 0.03 }, // 3% - mini-boss, rare
    ];

    const selectEnemyType = (): GeneratedEnemy['type'] => {
      const roll = random();
      let cumulative = 0;
      for (const entry of enemyWeights) {
        cumulative += entry.weight;
        if (roll < cumulative) return entry.type;
      }
      return 'skitterer'; // fallback
    };

    for (let i = 0; i < enemyCount; i++) {
      // Broodmothers only appear far from spawn
      let type = selectEnemyType();
      if (type === 'broodmother' && distanceFromSpawn < 4) {
        type = 'lurker'; // downgrade if too close to spawn
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

  private createBuildingMesh(building: GeneratedBuilding, chunkX: number, chunkZ: number): Mesh {
    const worldX = chunkX * CHUNK_SIZE + building.x;
    const worldZ = chunkZ * CHUNK_SIZE + building.z;

    let mesh: Mesh;

    switch (building.type) {
      case 'tower': {
        mesh = MeshBuilder.CreateCylinder(
          'tower',
          { height: building.height, diameter: building.width * 0.5 },
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

    return mesh;
  }

  private createObstacleMesh(obstacle: GeneratedObstacle, chunkX: number, chunkZ: number): Mesh {
    const worldX = chunkX * CHUNK_SIZE + obstacle.x;
    const worldZ = chunkZ * CHUNK_SIZE + obstacle.z;

    let mesh: Mesh;

    switch (obstacle.type) {
      case 'rock': {
        mesh = MeshBuilder.CreatePolyhedron(
          'rock',
          { type: 1, size: obstacle.scale * 2 },
          this.scene
        );
        // Use deterministic random based on position
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
          { height: obstacle.scale * 8, diameter: obstacle.scale * 1.5 },
          this.scene
        );
        mesh.material = this.materials.get('rock')!;
        mesh.position.set(worldX, obstacle.scale * 4, worldZ);
        break;
      }
      case 'crater': {
        mesh = MeshBuilder.CreateDisc('crater', { radius: obstacle.scale * 3 }, this.scene);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(worldX, 0.05, worldZ);
        const craterMat = new StandardMaterial('craterMat', this.scene);
        craterMat.diffuseColor = Color3.FromHexString(tokens.colors.environment.rockDark);
        mesh.material = craterMat;
        break;
      }
      case 'debris':
      default: {
        mesh = MeshBuilder.CreateBox(
          'debris',
          { width: obstacle.scale, height: obstacle.scale * 0.5, depth: obstacle.scale },
          this.scene
        );
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.material = this.materials.get('metal')!;
        mesh.position.set(worldX, obstacle.scale * 0.25, worldZ);
        break;
      }
    }

    mesh.checkCollisions = true;
    mesh.receiveShadows = true;

    return mesh;
  }

  private createEnemyEntity(enemy: GeneratedEnemy, chunkX: number, chunkZ: number): Entity {
    const worldX = chunkX * CHUNK_SIZE + enemy.x;
    const worldZ = chunkZ * CHUNK_SIZE + enemy.z;
    const position = new Vector3(worldX, 1, worldZ);

    // Get species data
    const species = ALIEN_SPECIES[enemy.type];
    if (!species) {
      // Fallback to skitterer if type not found
      return createAlienEntity(this.scene, ALIEN_SPECIES.skitterer, position, enemy.seed);
    }

    // Create the alien entity using the new procedural system
    const entity = createAlienEntity(this.scene, species, position, enemy.seed);

    // Add chunk info
    entity.chunkInfo = {
      chunkX,
      chunkZ,
    };

    return entity;
  }

  async loadChunk(chunkX: number, chunkZ: number): Promise<void> {
    const key = this.getChunkKey(chunkX, chunkZ);
    if (this.loadedChunks.has(key)) return;

    // Try to load from database first
    let chunkData = worldDb.getChunk(chunkX, chunkZ);

    // If not found, generate new chunk
    if (!chunkData) {
      chunkData = this.generateChunkData(chunkX, chunkZ);
      worldDb.saveChunk(chunkData);
    }

    const entities: Entity[] = [];
    const meshes: Mesh[] = [];

    // Create buildings
    const buildings: GeneratedBuilding[] = JSON.parse(chunkData.buildings);
    for (const building of buildings) {
      meshes.push(this.createBuildingMesh(building, chunkX, chunkZ));
    }

    // Create obstacles
    const obstacles: GeneratedObstacle[] = JSON.parse(chunkData.obstacles);
    for (const obstacle of obstacles) {
      meshes.push(this.createObstacleMesh(obstacle, chunkX, chunkZ));
    }

    // Load saved entities first
    const savedEntities = worldDb.getEntitiesInChunk(chunkX, chunkZ);
    const loadedEntityIds = new Set<string>();

    for (const saved of savedEntities) {
      // Recreate entity from saved state
      const speciesId = saved.type === 'boss' ? 'broodmother' : 'skitterer'; // Simplified fallback
      const species = ALIEN_SPECIES[speciesId];
      if (species) {
        const entity = createAlienEntity(this.scene, species, new Vector3(saved.x, saved.y, saved.z));
        if (entity.health) entity.health.current = saved.health;
        entity.chunkInfo = { chunkX, chunkZ };
        // Restore ID to match DB
        // Note: createEntity generates a new ID, we might need a way to force ID or just map it
        // For now, we accept new runtime ID but should update DB mapping on save
        entities.push(entity);
        loadedEntityIds.add(saved.id);
      }
    }

    // Create new enemies from generation if not loaded
    const enemies: GeneratedEnemy[] = JSON.parse(chunkData.enemies);
    // In a real implementation, we would map generated enemies to saved IDs to avoid duplication
    // For this demo, we'll just skip generation if we loaded saved entities to prevent double spawning
    if (savedEntities.length === 0) {
      for (const enemy of enemies) {
        entities.push(this.createEnemyEntity(enemy, chunkX, chunkZ));
      }
    }

    this.loadedChunks.set(key, { entities, meshes });
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

    // Dispose meshes
    for (const mesh of chunk.meshes) {
      mesh.dispose();
    }

    this.loadedChunks.delete(key);
  }

  update(playerPosition: Vector3): void {
    const playerChunk = this.getChunkCoords(playerPosition.x, playerPosition.z);

    // Load chunks in radius
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= LOAD_RADIUS) {
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

      if (dist > UNLOAD_RADIUS) {
        chunksToUnload.push(key);
      }
    }

    for (const key of chunksToUnload) {
      const [cx, cz] = key.split(',').map(Number);
      this.unloadChunk(cx, cz);
    }
  }

  getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }
}
