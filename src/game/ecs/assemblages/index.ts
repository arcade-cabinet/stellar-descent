/**
 * Assemblages - Pre-configured entity groups for procedural scene generation
 *
 * Design principles:
 * 1. Each assemblage is a self-contained chunk that can be spawned/despawned
 * 2. Assemblages snap to a 4-unit grid (matching PSX Mega Pack modular system)
 * 3. Assemblages are serializable to SQLite for persistence
 * 4. Visited locations are persisted so they don't change on revisit
 */

import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { StructuralEntity } from '../components/structural';

export const CHUNK_SIZE = 32; // 32 units = 8 grid tiles (4 units each)
export const RENDER_RADIUS = 3; // Chunks around player to render
export const UNLOAD_RADIUS = 5; // Chunks to keep in memory before unloading

// ============================================================================
// ASSEMBLAGE TYPES
// ============================================================================

export type EnvironmentType =
  | 'station_interior'   // Anchor Station
  | 'surface_rocky'      // Proxima surface
  | 'fob_military'       // FOB Delta
  | 'hive_organic'       // Chitin hive tunnels
  | 'canyon'             // Canyon terrain
  | 'extraction_zone';   // LZ Omega

export type AssemblageType =
  // Station Interior
  | 'corridor_straight' | 'corridor_corner' | 'corridor_t' | 'corridor_cross'
  | 'room_small' | 'room_medium' | 'room_large'
  | 'hangar_bay' | 'airlock'
  | 'quarters' | 'command_deck' | 'engineering'
  // Surface Rocky
  | 'terrain_flat' | 'terrain_rocky' | 'terrain_crater'
  | 'rock_cluster' | 'boulder_field'
  | 'alien_vegetation'
  // FOB Military
  | 'prefab_barracks' | 'prefab_command' | 'prefab_vehicle_bay'
  | 'perimeter_wall' | 'perimeter_gate'
  | 'comms_tower' | 'power_generator'
  // Hive Organic
  | 'tunnel_straight' | 'tunnel_branch' | 'tunnel_chamber'
  | 'egg_chamber' | 'queen_chamber'
  | 'hive_entrance'
  // Common
  | 'spawn_point' | 'objective_marker' | 'loot_cache';

// ============================================================================
// ASSEMBLAGE DEFINITION
// ============================================================================

export interface AssemblageConnection {
  direction: 'north' | 'south' | 'east' | 'west' | 'up' | 'down';
  type: 'door' | 'open' | 'wall' | 'sealed';
  offset: { x: number; z: number }; // offset from chunk center in grid units
}

export interface AssemblageDefinition {
  type: AssemblageType;
  environment: EnvironmentType;

  // Size in grid units (4-unit grid)
  gridWidth: number;
  gridDepth: number;
  gridHeight: number;

  // Connection points for procedural linking
  connections: AssemblageConnection[];

  // Entities that make up this assemblage
  entities: AssemblageEntityDef[];

  // Spawn configuration
  enemySpawns?: { maxCount: number; types: string[]; waveDelay?: number }[];
  lootSpawns?: { position: { x: number; y: number; z: number }; lootTable: string }[];

  // Navigation
  navmeshIncluded: boolean;
  coverPoints: { x: number; y: number; z: number; direction: { x: number; z: number } }[];

  // Tags for filtering
  tags: string[];
}

export interface AssemblageEntityDef {
  type: 'structural' | 'prop' | 'light' | 'door' | 'trigger' | 'spawn';
  modelPath?: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: number;
  components: Partial<StructuralEntity>;
}

// ============================================================================
// CHUNK STATE FOR PERSISTENCE
// ============================================================================

export interface ChunkState {
  chunkX: number;
  chunkZ: number;
  environment: EnvironmentType;

  // Generation seed for reproducibility
  seed: number;

  // Which assemblages were placed
  assemblages: PlacedAssemblage[];

  // Dynamic state that persists
  doors: { entityId: string; state: string }[];
  loot: { entityId: string; collected: boolean }[];
  enemies: { entityId: string; dead: boolean; position?: { x: number; y: number; z: number } }[];
  triggers: { entityId: string; triggered: boolean }[];

  // Meta
  firstVisited: number; // timestamp
  lastVisited: number;
  fullyExplored: boolean;
}

export interface PlacedAssemblage {
  type: AssemblageType;
  gridX: number; // Position within chunk
  gridZ: number;
  rotation: 0 | 90 | 180 | 270;
  entityIds: string[]; // IDs of spawned entities
}

// ============================================================================
// STATION INTERIOR ASSEMBLAGES
// ============================================================================

export const STATION_ASSEMBLAGES: Record<string, AssemblageDefinition> = {
  corridor_straight: {
    type: 'corridor_straight',
    environment: 'station_interior',
    gridWidth: 3,
    gridDepth: 4,
    gridHeight: 2,
    connections: [
      { direction: 'north', type: 'open', offset: { x: 0, z: 2 } },
      { direction: 'south', type: 'open', offset: { x: 0, z: -2 } },
    ],
    entities: [
      // Floor tiles (3 wide x 4 deep = 12 tiles)
      ...Array.from({ length: 12 }, (_, i) => ({
        type: 'structural' as const,
        modelPath: '/models/psx/structures/floor_ceiling_hr_1.glb',
        position: { x: (i % 3 - 1) * 4, y: 0, z: Math.floor(i / 3) * 4 - 6 },
        components: {
          structuralPiece: {
            pieceType: 'floor' as const,
            modelPath: '/models/psx/structures/floor_ceiling_hr_1.glb',
            gridX: i % 3,
            gridZ: Math.floor(i / 3),
            gridY: 0,
            orientation: 0 as const,
          },
        },
      })),
      // Ceiling tiles
      ...Array.from({ length: 12 }, (_, i) => ({
        type: 'structural' as const,
        modelPath: '/models/psx/structures/floor_ceiling_hr_1.glb',
        position: { x: (i % 3 - 1) * 4, y: 6, z: Math.floor(i / 3) * 4 - 6 },
        rotation: { x: Math.PI, y: 0, z: 0 },
        components: {
          structuralPiece: {
            pieceType: 'ceiling' as const,
            modelPath: '/models/psx/structures/floor_ceiling_hr_1.glb',
            gridX: i % 3,
            gridZ: Math.floor(i / 3),
            gridY: 1,
            orientation: 0 as const,
          },
        },
      })),
      // Left wall panels (4 deep)
      ...Array.from({ length: 4 }, (_, i) => ({
        type: 'structural' as const,
        modelPath: '/models/psx/structures/wall_hr_1_double.glb',
        position: { x: -6, y: 3, z: i * 4 - 6 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        components: {
          structuralPiece: {
            pieceType: 'wall' as const,
            modelPath: '/models/psx/structures/wall_hr_1_double.glb',
            gridX: -1,
            gridZ: i,
            gridY: 0,
            orientation: 90 as const,
          },
        },
      })),
      // Right wall panels
      ...Array.from({ length: 4 }, (_, i) => ({
        type: 'structural' as const,
        modelPath: '/models/psx/structures/wall_hr_1_double.glb',
        position: { x: 6, y: 3, z: i * 4 - 6 },
        rotation: { x: 0, y: -Math.PI / 2, z: 0 },
        components: {
          structuralPiece: {
            pieceType: 'wall' as const,
            modelPath: '/models/psx/structures/wall_hr_1_double.glb',
            gridX: 3,
            gridZ: i,
            gridY: 0,
            orientation: 270 as const,
          },
        },
      })),
      // Overhead pipes
      {
        type: 'structural' as const,
        modelPath: '/models/psx/structures/pipe_cx_1.glb',
        position: { x: -2, y: 5.5, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        components: {
          conduit: {
            conduitType: 'pipe' as const,
            contents: 'coolant' as const,
            damaged: false,
            leaking: false,
            active: true,
          },
        },
      },
      // Lights
      {
        type: 'light' as const,
        modelPath: '/models/psx/lights/lamp_mx_2_on.glb',
        position: { x: 0, y: 5.8, z: -4 },
        components: {
          lightFixture: {
            fixtureType: 'overhead' as const,
            lightColor: { r: 0.9, g: 0.95, b: 1.0 },
            intensity: 0.7,
            range: 12,
            on: true,
            flickering: false,
            emergency: false,
          },
        },
      },
      {
        type: 'light' as const,
        modelPath: '/models/psx/lights/lamp_mx_2_on.glb',
        position: { x: 0, y: 5.8, z: 4 },
        components: {
          lightFixture: {
            fixtureType: 'overhead' as const,
            lightColor: { r: 0.9, g: 0.95, b: 1.0 },
            intensity: 0.7,
            range: 12,
            on: true,
            flickering: false,
            emergency: false,
          },
        },
      },
    ],
    navmeshIncluded: true,
    coverPoints: [],
    tags: ['traversable', 'interior', 'pressurized'],
  },

  airlock: {
    type: 'airlock',
    environment: 'station_interior',
    gridWidth: 3,
    gridDepth: 3,
    gridHeight: 2,
    connections: [
      { direction: 'north', type: 'door', offset: { x: 0, z: 1 } },
      { direction: 'south', type: 'door', offset: { x: 0, z: -1 } },
    ],
    entities: [
      // Floor - use industrial grated version
      ...Array.from({ length: 9 }, (_, i) => ({
        type: 'structural' as const,
        modelPath: '/models/psx/structures/floor_ceiling_hr_3.glb',
        position: { x: (i % 3 - 1) * 4, y: 0, z: Math.floor(i / 3) * 4 - 4 },
        components: {
          structuralPiece: {
            pieceType: 'floor' as const,
            modelPath: '/models/psx/structures/floor_ceiling_hr_3.glb',
            gridX: i % 3,
            gridZ: Math.floor(i / 3),
            gridY: 0,
            orientation: 0 as const,
          },
        },
      })),
      // Inner door (north)
      {
        type: 'door' as const,
        modelPath: '/models/psx/doors/door_hr_6.glb',
        position: { x: 0, y: 0, z: 4 },
        components: {
          door: {
            doorType: 'airlock' as const,
            state: 'closed' as const,
            openProgress: 0,
            openSpeed: 2,
            autoClose: true,
            autoCloseDelay: 3000,
            triggerRadius: 2,
            connectedPanels: [],
          },
        },
      },
      // Outer door (south)
      {
        type: 'door' as const,
        modelPath: '/models/psx/doors/door_hr_6.glb',
        position: { x: 0, y: 0, z: -4 },
        components: {
          door: {
            doorType: 'airlock' as const,
            state: 'closed' as const,
            openProgress: 0,
            openSpeed: 2,
            autoClose: true,
            autoCloseDelay: 3000,
            triggerRadius: 2,
            connectedPanels: [],
          },
        },
      },
      // Emergency lights
      {
        type: 'light' as const,
        position: { x: -4, y: 5.5, z: 0 },
        components: {
          lightFixture: {
            fixtureType: 'emergency' as const,
            lightColor: { r: 1.0, g: 0.2, b: 0.1 },
            intensity: 0.4,
            range: 6,
            on: true,
            flickering: true,
            flickerPattern: [500, 500],
            emergency: true,
          },
        },
      },
      {
        type: 'light' as const,
        position: { x: 4, y: 5.5, z: 0 },
        components: {
          lightFixture: {
            fixtureType: 'emergency' as const,
            lightColor: { r: 1.0, g: 0.2, b: 0.1 },
            intensity: 0.4,
            range: 6,
            on: true,
            flickering: true,
            flickerPattern: [500, 500],
            emergency: true,
          },
        },
      },
    ],
    navmeshIncluded: true,
    coverPoints: [],
    tags: ['airlock', 'transition', 'interior'],
  },
};

// ============================================================================
// SURFACE ASSEMBLAGES
// ============================================================================

export const SURFACE_ASSEMBLAGES: Record<string, AssemblageDefinition> = {
  terrain_flat: {
    type: 'terrain_flat',
    environment: 'surface_rocky',
    gridWidth: 8, // Full chunk
    gridDepth: 8,
    gridHeight: 1,
    connections: [
      { direction: 'north', type: 'open', offset: { x: 0, z: 4 } },
      { direction: 'south', type: 'open', offset: { x: 0, z: -4 } },
      { direction: 'east', type: 'open', offset: { x: 4, z: 0 } },
      { direction: 'west', type: 'open', offset: { x: -4, z: 0 } },
    ],
    entities: [
      // Procedural terrain mesh will be generated
      {
        type: 'trigger' as const,
        position: { x: 0, y: 0, z: 0 },
        components: {
          terrainChunk: {
            chunkX: 0, // Will be set at spawn time
            chunkZ: 0,
            biome: 'rocky' as const,
            heightmap: new Float32Array(0), // Generated
            loaded: false,
            lod: 0,
          },
          atmosphere: {
            hasAtmosphere: true,
            oxygen: 0.1,
            temperature: 250,
            pressure: 0.3,
            toxic: false,
            radiation: 0.2,
            particleEffect: 'dust' as const,
            particleDensity: 0.3,
          },
        },
      },
    ],
    navmeshIncluded: true,
    coverPoints: [],
    tags: ['exterior', 'traversable', 'hostile'],
  },

  rock_cluster: {
    type: 'rock_cluster',
    environment: 'surface_rocky',
    gridWidth: 2,
    gridDepth: 2,
    gridHeight: 1,
    connections: [],
    entities: [
      // Multiple rock props at semi-random positions
      {
        type: 'prop' as const,
        position: { x: -2, y: 0, z: -1 },
        rotation: { x: 0, y: 0.7, z: 0 },
        scale: 1.2,
        components: {
          prop: {
            propType: 'debris' as const,
            modelPath: '', // Will use terrain rock meshes
            interactive: false,
            destructible: false,
            physics: false,
            mass: 1000,
            used: false,
          },
          tags: { navigation: true },
        },
      },
      {
        type: 'prop' as const,
        position: { x: 1, y: 0, z: 2 },
        rotation: { x: 0, y: 2.1, z: 0 },
        scale: 0.8,
        components: {
          prop: {
            propType: 'debris' as const,
            modelPath: '',
            interactive: false,
            destructible: false,
            physics: false,
            mass: 500,
            used: false,
          },
          tags: { navigation: true },
        },
      },
    ],
    navmeshIncluded: false,
    coverPoints: [
      { x: -2, y: 0, z: -1, direction: { x: 1, z: 0 } },
      { x: 1, y: 0, z: 2, direction: { x: -1, z: 0 } },
    ],
    tags: ['exterior', 'cover', 'obstacle'],
  },
};

// ============================================================================
// HIVE ASSEMBLAGES
// ============================================================================

export const HIVE_ASSEMBLAGES: Record<string, AssemblageDefinition> = {
  tunnel_straight: {
    type: 'tunnel_straight',
    environment: 'hive_organic',
    gridWidth: 2,
    gridDepth: 4,
    gridHeight: 2,
    connections: [
      { direction: 'north', type: 'open', offset: { x: 0, z: 2 } },
      { direction: 'south', type: 'open', offset: { x: 0, z: -2 } },
    ],
    entities: [
      // Organic tunnel geometry - procedurally warped
      {
        type: 'structural' as const,
        position: { x: 0, y: 0, z: 0 },
        components: {
          room: {
            roomType: 'corridor' as const,
            name: 'Hive Tunnel',
            ambientLight: { r: 0.2, g: 0.05, b: 0.3, intensity: 0.3 },
            fogDensity: 0.02,
            hazardLevel: 2,
            pressurized: true,
            gravity: 1.0,
            explored: false,
            boundingBox: { minX: -4, maxX: 4, minZ: -8, maxZ: 8 },
          },
          atmosphere: {
            hasAtmosphere: true,
            oxygen: 0.6,
            temperature: 310, // Warm
            pressure: 1.1,
            toxic: true,
            radiation: 0,
            particleEffect: 'dust' as const,
            particleDensity: 0.1,
          },
        },
      },
    ],
    enemySpawns: [
      { maxCount: 3, types: ['chitin_drone', 'chitin_grunt'] },
    ],
    navmeshIncluded: true,
    coverPoints: [],
    tags: ['hive', 'hostile', 'underground'],
  },

  egg_chamber: {
    type: 'egg_chamber',
    environment: 'hive_organic',
    gridWidth: 4,
    gridDepth: 4,
    gridHeight: 3,
    connections: [
      { direction: 'south', type: 'open', offset: { x: 0, z: -2 } },
    ],
    entities: [
      {
        type: 'structural' as const,
        position: { x: 0, y: 0, z: 0 },
        components: {
          room: {
            roomType: 'storage' as const, // Repurposed
            name: 'Egg Chamber',
            ambientLight: { r: 0.4, g: 0.1, b: 0.5, intensity: 0.4 },
            fogDensity: 0.03,
            hazardLevel: 3,
            pressurized: true,
            gravity: 1.0,
            explored: false,
            boundingBox: { minX: -8, maxX: 8, minZ: -8, maxZ: 8 },
          },
        },
      },
    ],
    enemySpawns: [
      { maxCount: 6, types: ['chitin_drone'], waveDelay: 5000 },
    ],
    lootSpawns: [
      { position: { x: 3, y: 0, z: 3 }, lootTable: 'hive_rare' },
    ],
    navmeshIncluded: true,
    coverPoints: [],
    tags: ['hive', 'hostile', 'objective'],
  },
};

// ============================================================================
// ASSEMBLAGE REGISTRY
// ============================================================================

export const ALL_ASSEMBLAGES: Record<string, AssemblageDefinition> = {
  ...STATION_ASSEMBLAGES,
  ...SURFACE_ASSEMBLAGES,
  ...HIVE_ASSEMBLAGES,
};

export function getAssemblagesByEnvironment(env: EnvironmentType): AssemblageDefinition[] {
  return Object.values(ALL_ASSEMBLAGES).filter(a => a.environment === env);
}

export function getAssemblagesByTag(tag: string): AssemblageDefinition[] {
  return Object.values(ALL_ASSEMBLAGES).filter(a => a.tags.includes(tag));
}
