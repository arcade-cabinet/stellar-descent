import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { World } from 'miniplex';
import type { SteeringBehavior, Vehicle } from 'yuka';

// Import structural components for modular building system
import type {
  StructuralPiece,
  Door,
  Viewport,
  LightFixture,
  Conduit,
  Room,
  Atmosphere,
  TriggerZone,
  SpawnPoint,
  Prop,
  CoverPoint,
  Interactable,
  TerrainChunk,
  PlanetaryFeature,
  Weather,
} from '../ecs/components/structural';

// Component types
export interface Transform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
}

export interface Health {
  current: number;
  max: number;
  regenRate: number;
}

export interface Velocity {
  linear: Vector3;
  angular: Vector3;
  maxSpeed: number;
}

export interface Combat {
  damage: number;
  range: number;
  fireRate: number;
  lastFire: number;
  projectileSpeed: number;
}

export interface AIComponent {
  vehicle: Vehicle;
  behaviors: SteeringBehavior[];
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'support';
  target: Entity | null;
  alertRadius: number;
  attackRadius: number;
}

export interface Renderable {
  mesh: Mesh | TransformNode;
  visible: boolean;
}

export interface Tags {
  player?: boolean;
  enemy?: boolean;
  ally?: boolean;
  boss?: boolean;
  mech?: boolean;
  projectile?: boolean;
  building?: boolean;
  obstacle?: boolean;
  pickup?: boolean;
  // Structural tags
  structural?: boolean;
  interior?: boolean;
  exterior?: boolean;
  hazard?: boolean;
  navigation?: boolean;
  objective?: boolean;
}

// Alien-specific component for tracking species
export interface AlienInfo {
  speciesId: string;
  seed: number;
  xpValue: number;
  lootTable: { itemId: string; dropChance: number; minQuantity: number; maxQuantity: number }[];
}

export interface ChunkInfo {
  chunkX: number;
  chunkZ: number;
}

export interface LifeTime {
  remaining: number;
  onExpire?: () => void;
}

export interface Spawner {
  entityType: 'alien' | 'mech' | 'boss';
  spawnRate: number;
  lastSpawn: number;
  maxEntities: number;
  currentEntities: number;
}

// Entity type combining all possible components
export interface Entity {
  id: string;
  transform?: Transform;
  health?: Health;
  velocity?: Velocity;
  combat?: Combat;
  ai?: AIComponent;
  renderable?: Renderable;
  tags?: Tags;
  chunkInfo?: ChunkInfo;
  lifetime?: LifeTime;
  spawner?: Spawner;
  alienInfo?: AlienInfo;

  // Structural components (for modular building system)
  structuralPiece?: StructuralPiece;
  door?: Door;
  viewport?: Viewport;
  lightFixture?: LightFixture;
  conduit?: Conduit;
  room?: Room;
  atmosphere?: Atmosphere;
  triggerZone?: TriggerZone;
  spawnPoint?: SpawnPoint;
  prop?: Prop;
  coverPoint?: CoverPoint;
  interactable?: Interactable;
  terrainChunk?: TerrainChunk;
  planetaryFeature?: PlanetaryFeature;
  weather?: Weather;
}

// Create the ECS world
export const world = new World<Entity>();

// Query helpers
export const queries = {
  players: world.with('tags', 'transform', 'health', 'velocity', 'combat'),
  enemies: world.with('tags', 'transform', 'health', 'ai', 'renderable'),
  allies: world.with('tags', 'transform', 'health', 'ai', 'renderable'),
  projectiles: world.with('tags', 'transform', 'velocity', 'lifetime'),
  renderables: world.with('transform', 'renderable'),
  withHealth: world.with('health'),
  withAI: world.with('ai', 'transform'),
  inChunk: world.with('chunkInfo'),
};

// Entity factory functions
export function createEntity(components: Partial<Entity>): Entity {
  const entity: Entity = {
    id: crypto.randomUUID(),
    ...components,
  };
  world.add(entity);
  return entity;
}

export function removeEntity(entity: Entity): void {
  // Clean up mesh if exists
  if (entity.renderable?.mesh) {
    entity.renderable.mesh.dispose();
  }
  world.remove(entity);
}

/**
 * Gets entities within a certain radius of a point.
 * Note: This uses a 2D distance check (X/Z plane) ignoring the Y axis, ideal for gameplay logic on terrain.
 */
export function getEntitiesInRadius(
  center: Vector3,
  radius: number,
  filter?: (entity: Entity) => boolean
): Entity[] {
  const results: Entity[] = [];
  const radiusSq = radius * radius;

  for (const entity of queries.renderables) {
    if (!entity.transform) continue;

    const dx = entity.transform.position.x - center.x;
    const dz = entity.transform.position.z - center.z;
    const distSq = dx * dx + dz * dz;

    if (distSq <= radiusSq) {
      if (!filter || filter(entity)) {
        results.push(entity);
      }
    }
  }

  return results;
}
