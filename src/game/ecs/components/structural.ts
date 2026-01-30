import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/**
 * Structural components for building modular environments
 * Using PSX Mega Pack II modular system (4-unit grid)
 */

// Grid alignment - everything snaps to 4-unit grid
export const GRID_SIZE = 4;
export const WALL_HEIGHT = 6;
export const DOOR_HEIGHT = 3;

// ============================================================================
// CORE STRUCTURAL COMPONENTS
// ============================================================================

/** Base structural piece - floors, walls, ceilings */
export interface StructuralPiece {
  pieceType: 'floor' | 'wall' | 'ceiling' | 'beam' | 'pipe' | 'doorframe';
  modelPath: string;
  gridX: number;
  gridZ: number;
  gridY: number; // 0 = ground level, 1 = ceiling level
  orientation: 0 | 90 | 180 | 270; // degrees
  variant?: string; // e.g., 'damaged', 'worn', 'tech'
}

/** Door component - can open/close */
export interface Door {
  doorType: 'sliding' | 'hinged' | 'airlock' | 'bulkhead';
  state: 'open' | 'closed' | 'opening' | 'closing' | 'locked' | 'jammed';
  openProgress: number; // 0 = closed, 1 = open
  openSpeed: number; // units per second
  autoClose: boolean;
  autoCloseDelay: number; // ms
  requiresKeycard?: string;
  triggerRadius: number;
  connectedPanels: TransformNode[]; // The actual door meshes to animate
}

/** Window/viewport component */
export interface Viewport {
  viewportType: 'window' | 'porthole' | 'viewport' | 'display';
  tintColor?: { r: number; g: number; b: number };
  opacity: number;
  breakable: boolean;
  broken: boolean;
  content?: 'space' | 'planet' | 'interior' | 'screen';
}

/** Lighting fixture component */
export interface LightFixture {
  fixtureType: 'overhead' | 'wall' | 'floor' | 'emergency' | 'spot';
  lightColor: { r: number; g: number; b: number };
  intensity: number;
  range: number;
  on: boolean;
  flickering: boolean;
  flickerPattern?: number[]; // timing pattern in ms
  emergency: boolean;
}

/** Pipe/conduit component */
export interface Conduit {
  conduitType: 'pipe' | 'cable' | 'vent' | 'duct';
  contents: 'water' | 'fuel' | 'air' | 'power' | 'data' | 'coolant';
  damaged: boolean;
  leaking: boolean;
  active: boolean;
}

// ============================================================================
// ENVIRONMENT COMPONENTS
// ============================================================================

/** Room/zone definition */
export interface Room {
  roomType:
    | 'corridor'
    | 'hallway'
    | 'hangar'
    | 'bay'
    | 'quarters'
    | 'barracks'
    | 'bridge'
    | 'command'
    | 'engineering'
    | 'reactor'
    | 'medbay'
    | 'infirmary'
    | 'storage'
    | 'cargo'
    | 'airlock'
    | 'armory'
    | 'mess'
    | 'cafeteria'
    | 'lab'
    | 'research';
  name: string;
  ambientLight: { r: number; g: number; b: number; intensity: number };
  fogDensity: number;
  musicTrack?: string;
  hazardLevel: 0 | 1 | 2 | 3; // 0 = safe, 3 = critical
  pressurized: boolean;
  gravity: number; // 1.0 = normal
  explored: boolean;
  boundingBox: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** Atmosphere/environment zone */
export interface Atmosphere {
  hasAtmosphere: boolean;
  oxygen: number; // 0-1
  temperature: number; // Kelvin
  pressure: number; // 0 = vacuum, 1 = normal
  toxic: boolean;
  radiation: number; // 0 = none, 1 = lethal
  particleEffect?: 'dust' | 'steam' | 'smoke' | 'sparks' | 'rain';
  particleDensity: number;
}

/** Trigger zone for events */
export interface TriggerZone {
  triggerType: 'enter' | 'exit' | 'stay' | 'interact';
  shape: 'box' | 'sphere' | 'cylinder';
  size: Vector3;
  enabled: boolean;
  oneShot: boolean;
  triggered: boolean;
  eventId: string;
  cooldown: number; // ms
  lastTriggered: number;
}

/** Spawn point definition */
export interface SpawnPoint {
  spawnType: 'player' | 'enemy' | 'ally' | 'item' | 'vehicle';
  waveId?: number;
  maxEntities: number;
  spawnedCount: number;
  spawnInterval: number; // ms
  active: boolean;
  conditions?: {
    requiresChapter?: number;
    requiresTrigger?: string;
    requiresNoEnemies?: boolean;
  };
}

// ============================================================================
// PROP COMPONENTS
// ============================================================================

/** Interactive prop */
export interface Prop {
  propType:
    | 'crate'
    | 'barrel'
    | 'container'
    | 'terminal'
    | 'console'
    | 'panel'
    | 'chair'
    | 'table'
    | 'bed'
    | 'locker'
    | 'cabinet'
    | 'shelf'
    | 'machinery'
    | 'equipment'
    | 'debris'
    | 'rubble';
  modelPath: string;
  interactive: boolean;
  destructible: boolean;
  physics: boolean;
  mass: number;
  contents?: { itemId: string; quantity: number }[];
  used: boolean;
}

/** Cover point for AI */
export interface CoverPoint {
  coverType: 'full' | 'half' | 'partial';
  direction: Vector3; // Direction of cover
  occupied: boolean;
  occupant?: string; // entity ID
  quality: number; // 0-1, how good the cover is
}

/** Interactable object */
export interface Interactable {
  interactionType: 'use' | 'pickup' | 'examine' | 'hack' | 'repair';
  promptText: string;
  interactionTime: number; // ms to complete
  requires?: {
    item?: string;
    skill?: string;
    minLevel?: number;
  };
  onInteract: string; // event ID
  enabled: boolean;
  used: boolean;
  repeatable: boolean;
}

// ============================================================================
// EXTERIOR/OUTDOOR COMPONENTS
// ============================================================================

/** Terrain chunk info */
export interface TerrainChunk {
  chunkX: number;
  chunkZ: number;
  biome: 'rocky' | 'sandy' | 'volcanic' | 'ice' | 'canyon';
  heightmap: Float32Array;
  loaded: boolean;
  lod: number; // 0 = highest detail
}

/** Planetary feature */
export interface PlanetaryFeature {
  featureType: 'crater' | 'canyon' | 'ridge' | 'boulder' | 'outcrop' | 'geyser';
  size: 'small' | 'medium' | 'large';
  hazard: boolean;
  navmeshObstacle: boolean;
}

/** Weather/environmental effect */
export interface Weather {
  weatherType: 'clear' | 'dust' | 'storm' | 'radiation' | 'meteor';
  intensity: number; // 0-1
  direction: Vector3;
  visibility: number; // 0-1
  damagePerSecond: number;
  duration: number; // ms, -1 = permanent
  started: number; // timestamp
}

// ============================================================================
// COMPOSITE TYPE FOR ECS ENTITY
// ============================================================================

export interface StructuralEntity {
  // Identity
  id: string;
  name?: string;

  // Core transform (from main ecs.ts)
  transform?: {
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
  };

  // Rendering
  renderable?: {
    mesh: AbstractMesh | TransformNode;
    visible: boolean;
  };

  // Structural components
  structuralPiece?: StructuralPiece;
  door?: Door;
  viewport?: Viewport;
  lightFixture?: LightFixture;
  conduit?: Conduit;

  // Environment components
  room?: Room;
  atmosphere?: Atmosphere;
  triggerZone?: TriggerZone;
  spawnPoint?: SpawnPoint;

  // Props
  prop?: Prop;
  coverPoint?: CoverPoint;
  interactable?: Interactable;

  // Exterior
  terrainChunk?: TerrainChunk;
  planetaryFeature?: PlanetaryFeature;
  weather?: Weather;

  // Tags for filtering
  tags?: {
    structural?: boolean;
    interior?: boolean;
    exterior?: boolean;
    hazard?: boolean;
    navigation?: boolean;
    objective?: boolean;
  };
}
