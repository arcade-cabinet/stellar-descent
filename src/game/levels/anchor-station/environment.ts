/**
 * Anchor Station Environment - GLB-Based Construction
 *
 * Replaces ALL MeshBuilder primitives with loaded GLB models from the asset
 * manifest. Every floor tile, wall panel, ceiling plate, doorway, prop, and
 * detail piece is a real 3D model placed at hand-crafted coordinates.
 *
 * The station has 6 rooms connected by corridors:
 * 1. Briefing Room - holographic table, space windows, seats
 * 2. Corridor A - main passage connecting rooms
 * 3. Platforming Room - drop pod area with vertical elements
 * 4. Equipment Bay - suit locker, weapon rack, supplies
 * 5. Shooting Range - 5 targets, weapon tutorial
 * 6. Hangar Bay - final room, leads to the drop pod
 */

import { Animation } from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Animations/animatable';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import {
  type CurvedCorridorConfig,
  type CurvedCorridorResult,
  createCurvedCorridor,
} from './curvedCorridor';
import { createStationMaterials, disposeMaterials } from './materials';
import {
  createPlatformingRoom,
  preloadPlatformingRoomAssets,
  type PlatformingCallbacks as PlatformingRoomCallbacks,
  type PlatformingRoomState,
} from './platformingRoom';
import { createScenicRooms, SCENIC_ROOM_POSITIONS, type ScenicRoomsResult } from './scenicRooms';

// ============================================================================
// Room Layout Constants (all in meters)
// ============================================================================
// BRIEFING ROOM (20m x 15m) -> CORRIDOR A (30m x 4m) -> EQUIPMENT BAY (15m x 12m)
//                                    |
//                             SHOOTING RANGE (25m x 10m)
//                                    |
//                             HANGAR BAY (40m x 30m) -> [EXIT TO LANDFALL]
// ============================================================================

// Room dimensions
const BRIEFING_ROOM = { width: 20, depth: 15, height: 4 };
const CORRIDOR_A = { width: 4, depth: 30, height: 3 };
const PLATFORMING_ROOM = { width: 12, depth: 16, height: 5 }; // Taller for jumping
const EQUIPMENT_BAY = { width: 15, depth: 12, height: 4 };
const SHOOTING_RANGE = { width: 25, depth: 10, height: 4 };
const HANGAR_BAY = { width: 40, depth: 30, height: 12 };

// Room positions (center points) - laid out along Z axis
const BRIEFING_CENTER = new Vector3(0, 0, 0);
const CORRIDOR_A_START_Z = BRIEFING_CENTER.z - BRIEFING_ROOM.depth / 2;
const CORRIDOR_A_CENTER = new Vector3(0, 0, CORRIDOR_A_START_Z - CORRIDOR_A.depth / 2);
// Platforming room - off to the left of corridor (opposite of equipment bay)
const PLATFORMING_ROOM_CENTER = new Vector3(
  -(CORRIDOR_A.width / 2 + PLATFORMING_ROOM.width / 2 + 2), // Offset to left
  0,
  CORRIDOR_A_CENTER.z - 2 // Near middle of corridor
);
const EQUIPMENT_BAY_CENTER = new Vector3(
  CORRIDOR_A.width / 2 + EQUIPMENT_BAY.width / 2 + 2, // Offset to right
  0,
  CORRIDOR_A_CENTER.z - 5 // Near middle of corridor
);
const SHOOTING_RANGE_CENTER = new Vector3(
  0,
  0,
  CORRIDOR_A_CENTER.z - CORRIDOR_A.depth / 2 - SHOOTING_RANGE.depth / 2 - 2
);
const HANGAR_BAY_CENTER = new Vector3(
  0,
  0,
  SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 - HANGAR_BAY.depth / 2 - 5
);

// Key positions for objectives (exported for tutorial steps)
export const ROOM_POSITIONS = {
  briefingRoom: BRIEFING_CENTER.clone(),
  corridorA: CORRIDOR_A_CENTER.clone(),
  // Platforming room positions
  platformingRoom: PLATFORMING_ROOM_CENTER.clone(),
  platformingEntry: new Vector3(
    CORRIDOR_A_CENTER.x - CORRIDOR_A.width / 2,
    0,
    PLATFORMING_ROOM_CENTER.z
  ),
  platform1: new Vector3(PLATFORMING_ROOM_CENTER.x + 4, 0, PLATFORMING_ROOM_CENTER.z + 5),
  platform2: new Vector3(PLATFORMING_ROOM_CENTER.x + 1, 0.8, PLATFORMING_ROOM_CENTER.z + 2),
  platform3: new Vector3(PLATFORMING_ROOM_CENTER.x - 2, 1.2, PLATFORMING_ROOM_CENTER.z - 1),
  crouchPassageEntry: new Vector3(PLATFORMING_ROOM_CENTER.x - 4, 0, PLATFORMING_ROOM_CENTER.z - 3),
  crouchPassageExit: new Vector3(PLATFORMING_ROOM_CENTER.x - 4, 0, PLATFORMING_ROOM_CENTER.z - 6),
  platformingExit: new Vector3(
    CORRIDOR_A_CENTER.x - CORRIDOR_A.width / 2,
    0,
    PLATFORMING_ROOM_CENTER.z - 6
  ),
  // Equipment bay positions
  equipmentBay: EQUIPMENT_BAY_CENTER.clone(),
  suitLocker: new Vector3(EQUIPMENT_BAY_CENTER.x - 5, 0, EQUIPMENT_BAY_CENTER.z),
  weaponRack: new Vector3(EQUIPMENT_BAY_CENTER.x + 3, 0, EQUIPMENT_BAY_CENTER.z - 2),
  shootingRange: SHOOTING_RANGE_CENTER.clone(),
  shootingPosition: new Vector3(SHOOTING_RANGE_CENTER.x, 0, SHOOTING_RANGE_CENTER.z + 3),
  hangarEntry: new Vector3(0, 0, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 - 2),
  hangarBay: HANGAR_BAY_CENTER.clone(),
  dropPod: new Vector3(0, 0, HANGAR_BAY_CENTER.z - 8),
  // Scenic room positions (optional exploration areas)
  ...SCENIC_ROOM_POSITIONS,
};

// ============================================================================
// Curved Corridor Configurations
// ============================================================================
const RING_RADIUS = 50;
const CURVED_CORRIDOR_WIDTH = 4;
const CURVED_CORRIDOR_HEIGHT = 3;

export const CURVED_CORRIDOR_CONFIGS = {
  briefingToMovement: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 - 0.12,
    arcAngle: Math.PI / 10,
    width: CURVED_CORRIDOR_WIDTH,
    height: CURVED_CORRIDOR_HEIGHT,
    segments: 8,
    hasWindows: true,
    windowCount: 2,
    hasOverheadLights: true,
    lightCount: 2,
    hasFloorGrating: true,
    hasPipes: true,
    hasRivets: true,
    hasDoorStart: true,
    hasDoorEnd: false,
  } satisfies CurvedCorridorConfig,

  movementToPlatforming: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 + Math.PI / 10 - 0.12,
    arcAngle: Math.PI / 12,
    width: CURVED_CORRIDOR_WIDTH,
    height: CURVED_CORRIDOR_HEIGHT,
    segments: 6,
    hasWindows: true,
    windowCount: 1,
    hasOverheadLights: true,
    lightCount: 2,
    hasFloorGrating: true,
    hasPipes: true,
    hasRivets: true,
    hasDoorStart: false,
    hasDoorEnd: true,
  } satisfies CurvedCorridorConfig,

  platformingToEquipment: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 + Math.PI / 10 + Math.PI / 12 - 0.08,
    arcAngle: Math.PI / 10,
    width: CURVED_CORRIDOR_WIDTH,
    height: CURVED_CORRIDOR_HEIGHT,
    segments: 8,
    hasWindows: true,
    windowCount: 2,
    hasOverheadLights: true,
    lightCount: 2,
    hasFloorGrating: true,
    hasPipes: true,
    hasRivets: true,
    hasDoorStart: true,
    hasDoorEnd: true,
  } satisfies CurvedCorridorConfig,

  equipmentToRange: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 + Math.PI / 4,
    arcAngle: Math.PI / 8,
    width: CURVED_CORRIDOR_WIDTH,
    height: CURVED_CORRIDOR_HEIGHT,
    segments: 10,
    hasWindows: true,
    windowCount: 3,
    hasOverheadLights: true,
    lightCount: 3,
    hasFloorGrating: true,
    hasPipes: true,
    hasRivets: true,
    hasDoorStart: true,
    hasDoorEnd: true,
  } satisfies CurvedCorridorConfig,

  rangeToHangar: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 + Math.PI / 4 + Math.PI / 8,
    arcAngle: Math.PI / 6,
    width: CURVED_CORRIDOR_WIDTH,
    height: CURVED_CORRIDOR_HEIGHT,
    segments: 12,
    hasWindows: true,
    windowCount: 4,
    hasOverheadLights: true,
    lightCount: 4,
    hasFloorGrating: true,
    hasPipes: true,
    hasRivets: true,
    hasDoorStart: true,
    hasDoorEnd: true,
  } satisfies CurvedCorridorConfig,
};

export interface ShootingRangeCallbacks {
  onTargetHit: (targetIndex: number) => void;
  onAllTargetsHit: () => void;
}

export interface PlatformingCallbacks {
  onJumpComplete: () => void;
  onCrouchComplete: () => void;
  onPlatformingComplete: () => void;
}

export interface StationEnvironment {
  root: TransformNode;
  dropPod: Mesh;
  viewport: Mesh;
  equipmentRack: Mesh;
  suitLocker: Mesh;
  shootingRange: TransformNode;
  innerDoor: Mesh;
  bayDoorLeft: Mesh;
  bayDoorRight: Mesh;
  lights: PointLight[];
  rooms: {
    briefing: TransformNode;
    corridorA: TransformNode;
    platformingRoom: TransformNode;
    equipmentBay: TransformNode;
    shootingRange: TransformNode;
    hangarBay: TransformNode;
    scenicCorridor: TransformNode;
    observationDeck: TransformNode;
    messHall: TransformNode;
    recreationRoom: TransformNode;
  };
  curvedCorridors: {
    briefingToMovement: CurvedCorridorResult;
    movementToPlatforming: CurvedCorridorResult;
    platformingToEquipment: CurvedCorridorResult;
    equipmentToRange: CurvedCorridorResult;
    rangeToHangar: CurvedCorridorResult;
  };
  scenicRooms: ScenicRoomsResult;
  playEquipSuit: (callback: () => void) => void;
  playDepressurize: (callback: () => void) => void;
  playOpenBayDoors: (callback: () => void) => void;
  playEnterPod: (callback: () => void) => void;
  playLaunch: (callback: () => void) => void;
  startCalibration: (callbacks: ShootingRangeCallbacks) => void;
  checkTargetHit: (rayOrigin: Vector3, rayDirection: Vector3) => boolean;
  isCalibrationActive: () => boolean;
  startPlatformingTutorial: (callbacks: PlatformingCallbacks) => void;
  checkJumpZone: (playerPosition: Vector3, isJumping: boolean) => boolean;
  checkCrouchZone: (playerPosition: Vector3, isCrouching: boolean) => boolean;
  isPlatformingActive: () => boolean;
  getPlatformColliders: () => Mesh[];
  openCorridorDoor: (
    corridor: keyof StationEnvironment['curvedCorridors'],
    which: 'start' | 'end'
  ) => void;
  openDoor: (
    doorName:
      | 'corridor_to_equipment'
      | 'corridor_to_range'
      | 'range_to_hangar'
      | 'corridor_to_platforming'
  ) => void;
  dispose: () => void;
}

// ============================================================================
// GLB Asset Paths
// ============================================================================

const MODEL_PATHS = {
  // Station corridor segments
  corridorMain: '/models/environment/station/corridor_main.glb',
  corridorWide: '/models/environment/station/corridor_wide.glb',
  corridorJunction: '/models/environment/station/corridor_junction.glb',
  corridorCorner: '/models/environment/station/corridor_corner.glb',

  // Floor/ceiling tiles
  floorCeiling1: '/models/environment/station/floor_ceiling_hr_1.glb',
  floorCeiling3: '/models/environment/station/floor_ceiling_hr_3.glb',
  floorCeilingRtx1: '/models/environment/station/floor_ceiling_rtx_1.glb',
  floorCeilingRtx2: '/models/environment/station/floor_ceiling_rtx_2.glb',
  floorCeilingRtxCorner: '/models/environment/station/floor_ceiling_rtx_1_corner.glb',

  // Walls
  wallDouble: '/models/environment/station/wall_hr_1_double.glb',
  wallSingle: '/models/environment/station/wall_hr_1.glb',
  wallM2: '/models/environment/station/wall_hr_1_m_2.glb',
  wallHole: '/models/environment/station/wall_hr_1_hole_1.glb',
  wallRtx1: '/models/environment/station/wall_rtx_1.glb',

  // Doorways
  doorway: '/models/environment/station/doorway_hr_1.glb',
  doorwayWide: '/models/environment/station/doorway_hr_1_wide.glb',
  doorway2: '/models/environment/station/doorway_hr_2_regular.glb',
  doorway3: '/models/environment/station/doorway_hr_3_regular.glb',
  stationDoor: '/models/environment/station/station_door.glb',

  // Garage doors (hangar bay)
  garageDoor1: '/models/environment/station/garage_door_frame_hr_1.glb',
  garageDoor2: '/models/environment/station/garage_door_frame_hr_2.glb',

  // Beams
  beamHorizontal1: '/models/environment/station/beam_hc_horizontal_1.glb',
  beamHorizontal2: '/models/environment/station/beam_hc_horizontal_2.glb',
  beamVertical: '/models/environment/station/beam_hc_vertical_1.glb',
  beamRtx1: '/models/environment/station/beam_rtx_1.glb',

  // Pipes
  pipe1: '/models/environment/station/pipe_cx_1.glb',
  pipe2: '/models/environment/station/pipe_cx_2.glb',

  // Pillars
  pillar2: '/models/environment/station/pillar_hr_2.glb',
  pillar4: '/models/environment/station/pillar_hr_4.glb',

  // Windows
  window1: '/models/environment/station/window_hr_1.glb',
  window2: '/models/environment/station/window_hr_2.glb',

  // Platforms
  platformA1: '/models/environment/station/platform_ax_1.glb',
  platformB1: '/models/environment/station/platform_bx_1.glb',
  platformLarge: '/models/environment/station/platform_large_mx_1.glb',
  rampSlim: '/models/environment/station/ramp_platform_slim_mx_1.glb',
  rampWide: '/models/environment/station/ramp_platform_wide_mx_1.glb',

  // Station misc
  stationBarrel: '/models/environment/station/station_barrel.glb',

  // Atmospheric
  hallway1: '/models/props/atmospheric/hallway 1.glb',

  // Modular sci-fi pieces
  modFloorBasic: '/models/environment/modular/FloorTile_Basic.glb',
  modFloorBasic2: '/models/environment/modular/FloorTile_Basic2.glb',
  modFloorCorner: '/models/environment/modular/FloorTile_Corner.glb',
  modFloorSide: '/models/environment/modular/FloorTile_Side.glb',
  modFloorInner: '/models/environment/modular/FloorTile_InnerCorner.glb',
  modWall1: '/models/environment/modular/Wall_1.glb',
  modWall2: '/models/environment/modular/Wall_2.glb',
  modDoorSingle: '/models/environment/modular/Door_Single.glb',
  modColumn1: '/models/environment/modular/Column_1.glb',
  modColumn2: '/models/environment/modular/Column_2.glb',
  modRoofPlate: '/models/environment/modular/RoofTile_Plate.glb',
  modRoofVents: '/models/environment/modular/RoofTile_SmallVents.glb',
  modStaircase: '/models/environment/modular/Staircase.glb',
  modComputer: '/models/environment/modular/Props_Computer.glb',
  modShelf: '/models/environment/modular/Props_Shelf.glb',
  modShelfTall: '/models/environment/modular/Props_Shelf_Tall.glb',
  modVent1: '/models/environment/modular/Details_Vent_1.glb',
  modVent2: '/models/environment/modular/Details_Vent_2.glb',
  modPlateLarge: '/models/environment/modular/Details_Plate_Large.glb',

  // Station external
  stationExternal: '/models/environment/station-external/station01.glb',

  // Industrial props
  barrel1: '/models/props/industrial/metal_barrel_hr_1.glb',
  barrel2: '/models/props/industrial/metal_barrel_hr_2.glb',
  shelf: '/models/props/industrial/shelf_mx_1.glb',
  cardboardBox: '/models/props/industrial/cardboard_box_1.glb',
  electrical: '/models/props/industrial/electrical_equipment_1.glb',
  machinery: '/models/props/industrial/machinery_mx_1.glb',
  pipes: '/models/props/industrial/pipes_hr_1.glb',
  door6: '/models/props/industrial/door_hr_6.glb',
  door12: '/models/props/industrial/door_hr_12.glb',
  door13: '/models/props/industrial/door_hr_13.glb',
  lamp1: '/models/props/industrial/lamp_mx_1_a_on.glb',
  lamp2: '/models/props/industrial/lamp_mx_2_on.glb',
  lamp3: '/models/props/industrial/lamp_mx_3_on.glb',

  // Furniture
  firstAidKit: '/models/props/electrical/first_aid_kit_hr_1.glb',
  bench: '/models/props/furniture/bench_mx_1.glb',

  // Decals
  poster11: '/models/props/decals/poster_cx_11.glb',
  poster12: '/models/props/decals/poster_cx_12.glb',
  poster13: '/models/props/decals/poster_cx_13.glb',
};

// ============================================================================
// GLB Loading Utilities
// ============================================================================

/** In-memory cache of loaded template meshes keyed by model path. */
const modelCache = new Map<string, AbstractMesh[]>();

/** Load timeout for each model (10 seconds). */
const MODEL_LOAD_TIMEOUT = 10_000;

/**
 * Clear the model cache to free memory.
 * Should be called when disposing the environment or reloading the level.
 */
export function clearModelCache(): void {
  // Dispose all cached meshes before clearing
  for (const [, meshes] of modelCache) {
    for (const mesh of meshes) {
      if (!mesh.isDisposed()) {
        mesh.dispose();
      }
    }
  }
  modelCache.clear();
  console.log('[Environment] Model cache cleared');
}

/**
 * Load a GLB model, place it at the given position/rotation/scale,
 * and parent it to the given node. Returns the root transform.
 * Uses cloning after the first load for performance.
 */
async function placeGLB(
  scene: Scene,
  modelPath: string,
  name: string,
  parent: TransformNode,
  position: Vector3,
  rotation: Vector3,
  scale: Vector3,
  allMeshes: AbstractMesh[],
  receiveShadows = true,
  checkCollisions = true
): Promise<TransformNode> {
  const node = new TransformNode(name, scene);
  node.position = position;
  node.rotation = rotation;
  node.scaling = scale;
  node.parent = parent;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    let templateMeshes = modelCache.get(modelPath);

    if (!templateMeshes) {
      // First load - import from disk with timeout
      const loadPromise = SceneLoader.ImportMeshAsync('', modelPath, '', scene);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Timeout loading ${modelPath}`)),
          MODEL_LOAD_TIMEOUT
        );
      });

      try {
        const result = await Promise.race([loadPromise, timeoutPromise]);
        // Clear timeout on success
        if (timeoutId) clearTimeout(timeoutId);
        templateMeshes = result.meshes;
        modelCache.set(modelPath, templateMeshes);
      } catch (loadErr) {
        // Clear timeout on error
        if (timeoutId) clearTimeout(timeoutId);
        throw loadErr;
      }

      // Parent the original meshes
      for (const mesh of templateMeshes) {
        if (!mesh.parent || mesh.parent.name === '__root__') {
          mesh.parent = node;
        }
        mesh.receiveShadows = receiveShadows;
        mesh.checkCollisions = checkCollisions;
        allMeshes.push(mesh);
      }
    } else {
      // Clone from the cached template
      for (const mesh of templateMeshes) {
        const cloned = mesh.clone(`${name}_${mesh.name}`, null);
        if (cloned) {
          if (!cloned.parent || cloned.parent.name === '__root__') {
            cloned.parent = node;
          }
          cloned.receiveShadows = receiveShadows;
          cloned.checkCollisions = checkCollisions;
          allMeshes.push(cloned);
        }
      }
    }
  } catch (err) {
    // Ensure timeout is cleared on any error
    if (timeoutId) clearTimeout(timeoutId);
    console.warn(`[Environment] Failed to load ${modelPath} for ${name}:`, err);
  }

  return node;
}

/**
 * Place a GLB model at a position with a Y-rotation shorthand.
 */
async function placeModel(
  scene: Scene,
  modelPath: string,
  name: string,
  parent: TransformNode,
  x: number,
  y: number,
  z: number,
  rotY: number,
  scaleUniform: number,
  allMeshes: AbstractMesh[]
): Promise<TransformNode> {
  return placeGLB(
    scene,
    modelPath,
    name,
    parent,
    new Vector3(x, y, z),
    new Vector3(0, rotY, 0),
    new Vector3(scaleUniform, scaleUniform, scaleUniform),
    allMeshes
  );
}

/**
 * Place a GLB model as a decorative prop (no collisions).
 */
async function placeProp(
  scene: Scene,
  modelPath: string,
  name: string,
  parent: TransformNode,
  x: number,
  y: number,
  z: number,
  rotY: number,
  scaleUniform: number,
  allMeshes: AbstractMesh[]
): Promise<TransformNode> {
  return placeGLB(
    scene,
    modelPath,
    name,
    parent,
    new Vector3(x, y, z),
    new Vector3(0, rotY, 0),
    new Vector3(scaleUniform, scaleUniform, scaleUniform),
    allMeshes,
    true,
    false
  );
}

function addCeilingLight(
  scene: Scene,
  position: Vector3,
  color: Color3,
  intensity: number,
  lights: PointLight[]
): PointLight {
  const light = new PointLight(`ceilingLight_${lights.length}`, position.clone(), scene);
  light.diffuse = color;
  light.intensity = intensity;
  light.range = 15;
  lights.push(light);
  return light;
}

// ============================================================================
// Main environment creation (now async - loads GLB models)
// ============================================================================

export async function createStationEnvironment(scene: Scene): Promise<StationEnvironment> {
  // Preload platforming room GLB assets first
  await preloadPlatformingRoomAssets(scene);

  const root = new TransformNode('anchorStation', scene);
  const materials = createStationMaterials(scene);
  const lights: PointLight[] = [];
  const allMeshes: AbstractMesh[] = [];

  // Create room containers
  const briefingRoom = new TransformNode('briefingRoom', scene);
  briefingRoom.parent = root;

  const corridorA = new TransformNode('corridorA', scene);
  corridorA.parent = root;

  const platformingRoom = new TransformNode('platformingRoom', scene);
  platformingRoom.parent = root;

  // Platforming room geometry (still uses MeshBuilder for precise collision shapes)
  const platformingRoomState = createPlatformingRoom({
    scene,
    parent: platformingRoom,
    roomCenter: PLATFORMING_ROOM_CENTER,
    roomWidth: PLATFORMING_ROOM.width,
    roomDepth: PLATFORMING_ROOM.depth,
    roomHeight: PLATFORMING_ROOM.height,
    materials,
    allMeshes: allMeshes as Mesh[],
    lights,
    addCeilingLight: (
      sc: Scene,
      par: TransformNode,
      pos: Vector3,
      col: Color3,
      int: number,
      lts: PointLight[],
      _mats: Map<string, StandardMaterial>,
      _meshes: Mesh[]
    ) => {
      const l = new PointLight(`ceilingLight_${lts.length}`, pos.clone(), sc);
      l.diffuse = col;
      l.intensity = int;
      l.range = 15;
      lts.push(l);
      return l;
    },
  });

  const equipmentBayRoom = new TransformNode('equipmentBay', scene);
  equipmentBayRoom.parent = root;

  const shootingRangeRoom = new TransformNode('shootingRange', scene);
  shootingRangeRoom.parent = root;

  const hangarBayRoom = new TransformNode('hangarBay', scene);
  hangarBayRoom.parent = root;

  // ============================================================================
  // CURVED CORRIDORS (Ring Station Design)
  // ============================================================================

  const curvedCorridorsContainer = new TransformNode('curvedCorridors', scene);
  curvedCorridorsContainer.parent = root;

  const curvedCorridors = {
    briefingToMovement: createCurvedCorridor(
      scene,
      materials,
      CURVED_CORRIDOR_CONFIGS.briefingToMovement
    ),
    movementToPlatforming: createCurvedCorridor(
      scene,
      materials,
      CURVED_CORRIDOR_CONFIGS.movementToPlatforming
    ),
    platformingToEquipment: createCurvedCorridor(
      scene,
      materials,
      CURVED_CORRIDOR_CONFIGS.platformingToEquipment
    ),
    equipmentToRange: createCurvedCorridor(
      scene,
      materials,
      CURVED_CORRIDOR_CONFIGS.equipmentToRange
    ),
    rangeToHangar: createCurvedCorridor(scene, materials, CURVED_CORRIDOR_CONFIGS.rangeToHangar),
  };

  Object.values(curvedCorridors).forEach((corridor) => {
    corridor.root.parent = curvedCorridorsContainer;
    allMeshes.push(...corridor.meshes);
    lights.push(...corridor.lights);
  });

  // ============================================================================
  // LOAD GLB MODELS - All rooms built from actual 3D assets
  // ============================================================================
  // All placements are fired concurrently for fast loading.
  // Each room collects its own promises; we await everything at the end.
  // ============================================================================

  const loadPromises: Promise<TransformNode>[] = [];

  // Helper to push a placement promise
  const pm = (
    path: string,
    name: string,
    parent: TransformNode,
    x: number,
    y: number,
    z: number,
    rotY: number,
    scale: number
  ) => {
    loadPromises.push(placeModel(scene, path, name, parent, x, y, z, rotY, scale, allMeshes));
  };

  const pp = (
    path: string,
    name: string,
    parent: TransformNode,
    x: number,
    y: number,
    z: number,
    rotY: number,
    scale: number
  ) => {
    loadPromises.push(placeProp(scene, path, name, parent, x, y, z, rotY, scale, allMeshes));
  };

  // Shorthand references
  const P = MODEL_PATHS;
  const BC = BRIEFING_CENTER;
  const CC = CORRIDOR_A_CENTER;
  const EC = EQUIPMENT_BAY_CENTER;
  const SC = SHOOTING_RANGE_CENTER;
  const HC = HANGAR_BAY_CENTER;

  // ============================================================================
  // BRIEFING ROOM (20m x 15m x 4m)
  // ============================================================================
  // Floor: tiled with modular floor pieces and PSX station floor segments
  // Walls: station wall panels lining the perimeter
  // Ceiling: roof plates with vents
  // Props: holographic table area, computers, shelves, benches, posters

  // --- Floor tiles (2m grid, 10x8 grid for 20x15 room) ---
  for (let gx = -4; gx <= 4; gx += 2) {
    for (let gz = -3; gz <= 3; gz += 2) {
      const isEdge = Math.abs(gx) === 4 || Math.abs(gz) === 3;
      const tilePath = isEdge ? P.modFloorSide : (gx + gz) % 4 === 0 ? P.modFloorBasic2 : P.modFloorBasic;
      pm(tilePath, `br_floor_${gx}_${gz}`, briefingRoom, BC.x + gx, 0, BC.z + gz, 0, 1);
    }
  }

  // Floor corners
  pm(P.modFloorCorner, 'br_floor_corner_nw', briefingRoom, BC.x - 9, 0, BC.z + 7, 0, 1);
  pm(P.modFloorCorner, 'br_floor_corner_ne', briefingRoom, BC.x + 9, 0, BC.z + 7, Math.PI / 2, 1);
  pm(P.modFloorCorner, 'br_floor_corner_sw', briefingRoom, BC.x - 9, 0, BC.z - 7, -Math.PI / 2, 1);
  pm(P.modFloorCorner, 'br_floor_corner_se', briefingRoom, BC.x + 9, 0, BC.z - 7, Math.PI, 1);

  // PSX Floor/ceiling panels for bulk coverage
  for (let fx = -8; fx <= 8; fx += 4) {
    for (let fz = -6; fz <= 6; fz += 4) {
      pm(P.floorCeiling1, `br_psx_floor_${fx}_${fz}`, briefingRoom, BC.x + fx, -0.05, BC.z + fz, 0, 1);
    }
  }

  // --- Walls (station wall panels) ---
  // Back wall (north)
  for (let wx = -8; wx <= 8; wx += 4) {
    pm(P.wallDouble, `br_wall_n_${wx}`, briefingRoom, BC.x + wx, 0, BC.z + BRIEFING_ROOM.depth / 2, 0, 1);
  }
  // Left wall (west)
  for (let wz = -6; wz <= 6; wz += 4) {
    pm(P.wallSingle, `br_wall_w_${wz}`, briefingRoom, BC.x - BRIEFING_ROOM.width / 2, 0, BC.z + wz, Math.PI / 2, 1);
  }
  // Right wall (east)
  for (let wz = -6; wz <= 6; wz += 4) {
    pm(P.wallSingle, `br_wall_e_${wz}`, briefingRoom, BC.x + BRIEFING_ROOM.width / 2, 0, BC.z + wz, -Math.PI / 2, 1);
  }
  // Front wall (south, with door gap in the center)
  pm(P.wallDouble, 'br_wall_s_left', briefingRoom, BC.x - 6, 0, BC.z - BRIEFING_ROOM.depth / 2, Math.PI, 1);
  pm(P.wallDouble, 'br_wall_s_right', briefingRoom, BC.x + 6, 0, BC.z - BRIEFING_ROOM.depth / 2, Math.PI, 1);
  // Doorway frame at south exit
  pm(P.doorway2, 'br_door_south', briefingRoom, BC.x, 0, BC.z - BRIEFING_ROOM.depth / 2, Math.PI, 1);

  // --- Ceiling (roof plates with vents) ---
  for (let cx = -8; cx <= 8; cx += 4) {
    for (let cz = -6; cz <= 6; cz += 4) {
      const isVentTile = (cx === 0 && cz === 0) || (cx === -4 && cz === 4) || (cx === 4 && cz === -4);
      pm(
        isVentTile ? P.modRoofVents : P.modRoofPlate,
        `br_ceil_${cx}_${cz}`,
        briefingRoom,
        BC.x + cx,
        BRIEFING_ROOM.height,
        BC.z + cz,
        0,
        1
      );
    }
  }

  // --- Windows (station window models on north and side walls) ---
  pm(P.window1, 'br_win_n_left', briefingRoom, BC.x - 6, 0.5, BC.z + BRIEFING_ROOM.depth / 2 - 0.2, 0, 1);
  pm(P.window2, 'br_win_n_center', briefingRoom, BC.x, 0.5, BC.z + BRIEFING_ROOM.depth / 2 - 0.2, 0, 1);
  pm(P.window1, 'br_win_n_right', briefingRoom, BC.x + 6, 0.5, BC.z + BRIEFING_ROOM.depth / 2 - 0.2, 0, 1);
  pm(P.window1, 'br_win_w_1', briefingRoom, BC.x - BRIEFING_ROOM.width / 2 + 0.2, 0.5, BC.z + 3, Math.PI / 2, 1);
  pm(P.window1, 'br_win_w_2', briefingRoom, BC.x - BRIEFING_ROOM.width / 2 + 0.2, 0.5, BC.z - 3, Math.PI / 2, 1);
  pm(P.window1, 'br_win_e_1', briefingRoom, BC.x + BRIEFING_ROOM.width / 2 - 0.2, 0.5, BC.z + 3, -Math.PI / 2, 1);
  pm(P.window1, 'br_win_e_2', briefingRoom, BC.x + BRIEFING_ROOM.width / 2 - 0.2, 0.5, BC.z - 3, -Math.PI / 2, 1);

  // --- Station external hull visible through windows ---
  pp(P.stationExternal, 'br_station_ext', briefingRoom, BC.x, -20, BC.z + 80, 0, 3);

  // --- Pillars at room corners ---
  pp(P.pillar2, 'br_pillar_nw', briefingRoom, BC.x - 8, 0, BC.z + 6, 0, 1);
  pp(P.pillar2, 'br_pillar_ne', briefingRoom, BC.x + 8, 0, BC.z + 6, 0, 1);
  pp(P.pillar4, 'br_pillar_sw', briefingRoom, BC.x - 8, 0, BC.z - 6, 0, 1);
  pp(P.pillar4, 'br_pillar_se', briefingRoom, BC.x + 8, 0, BC.z - 6, 0, 1);

  // --- Columns flanking exit ---
  pp(P.modColumn2, 'br_col_exit_l', briefingRoom, BC.x - 2, 0, BC.z - BRIEFING_ROOM.depth / 2 + 0.5, 0, 1);
  pp(P.modColumn2, 'br_col_exit_r', briefingRoom, BC.x + 2, 0, BC.z - BRIEFING_ROOM.depth / 2 + 0.5, 0, 1);

  // --- Computers around the briefing table area ---
  pp(P.modComputer, 'br_computer_1', briefingRoom, BC.x - 3, 0.8, BC.z + 2, 0, 0.8);
  pp(P.modComputer, 'br_computer_2', briefingRoom, BC.x + 3, 0.8, BC.z + 2, Math.PI, 0.8);
  pp(P.modComputer, 'br_computer_3', briefingRoom, BC.x - 3, 0.8, BC.z - 2, 0, 0.8);
  pp(P.modComputer, 'br_computer_4', briefingRoom, BC.x + 3, 0.8, BC.z - 2, Math.PI, 0.8);

  // --- Benches for seated briefing ---
  pp(P.bench, 'br_bench_1', briefingRoom, BC.x - 5, 0, BC.z + 3, Math.PI / 2, 1);
  pp(P.bench, 'br_bench_2', briefingRoom, BC.x + 5, 0, BC.z + 3, -Math.PI / 2, 1);
  pp(P.bench, 'br_bench_3', briefingRoom, BC.x - 5, 0, BC.z - 3, Math.PI / 2, 1);
  pp(P.bench, 'br_bench_4', briefingRoom, BC.x + 5, 0, BC.z - 3, -Math.PI / 2, 1);

  // --- Shelves along west wall ---
  pp(P.modShelfTall, 'br_shelf_w1', briefingRoom, BC.x - 9, 0, BC.z + 1, Math.PI / 2, 1);
  pp(P.modShelf, 'br_shelf_w2', briefingRoom, BC.x - 9, 0, BC.z - 1, Math.PI / 2, 1);

  // --- Wall vents ---
  pp(P.modVent1, 'br_vent_1', briefingRoom, BC.x - 4, 3.2, BC.z + 7, 0, 1);
  pp(P.modVent2, 'br_vent_2', briefingRoom, BC.x + 4, 3.2, BC.z + 7, 0, 1);
  pp(P.modVent1, 'br_vent_3', briefingRoom, BC.x - 9.5, 3.2, BC.z, Math.PI / 2, 1);
  pp(P.modVent2, 'br_vent_4', briefingRoom, BC.x + 9.5, 3.2, BC.z, -Math.PI / 2, 1);

  // --- Posters on walls ---
  pp(P.poster11, 'br_poster_1', briefingRoom, BC.x + 9.4, 1.5, BC.z + 1, -Math.PI / 2, 0.8);
  pp(P.poster12, 'br_poster_2', briefingRoom, BC.x - 9.4, 1.5, BC.z - 4, Math.PI / 2, 0.8);

  // --- Detail plates on ceiling ---
  pp(P.modPlateLarge, 'br_plate_1', briefingRoom, BC.x - 2, BRIEFING_ROOM.height - 0.1, BC.z + 4, 0, 1);
  pp(P.modPlateLarge, 'br_plate_2', briefingRoom, BC.x + 2, BRIEFING_ROOM.height - 0.1, BC.z - 4, Math.PI, 1);

  // --- Beams across ceiling ---
  pp(P.beamHorizontal1, 'br_beam_1', briefingRoom, BC.x, BRIEFING_ROOM.height - 0.3, BC.z + 3, 0, 1);
  pp(P.beamHorizontal1, 'br_beam_2', briefingRoom, BC.x, BRIEFING_ROOM.height - 0.3, BC.z - 3, 0, 1);

  // Briefing room lights
  addCeilingLight(scene, new Vector3(-5, BRIEFING_ROOM.height - 0.2, 3), new Color3(0.8, 0.9, 1), 0.6, lights);
  addCeilingLight(scene, new Vector3(5, BRIEFING_ROOM.height - 0.2, 3), new Color3(0.8, 0.9, 1), 0.6, lights);
  addCeilingLight(scene, new Vector3(0, BRIEFING_ROOM.height - 0.2, -3), new Color3(0.8, 0.9, 1), 0.6, lights);

  // ============================================================================
  // CORRIDOR A (4m wide x 30m long x 3m tall)
  // ============================================================================

  // Floor segments along corridor length
  for (let cz = CC.z + 12; cz >= CC.z - 12; cz -= 4) {
    pm(P.corridorMain, `corr_seg_${cz}`, corridorA, CC.x, 0, cz, 0, 1);
  }

  // Corridor junction at the midpoint
  pm(P.corridorJunction, 'corr_junction_mid', corridorA, CC.x, 0, CC.z, 0, 1);

  // Walls along left side
  for (let wz = CC.z + 10; wz >= CC.z - 10; wz -= 4) {
    pm(P.wallSingle, `corr_wall_l_${wz}`, corridorA, CC.x - CORRIDOR_A.width / 2, 0, wz, Math.PI / 2, 1);
  }
  // Walls along right side
  for (let wz = CC.z + 10; wz >= CC.z - 10; wz -= 4) {
    pm(P.wallSingle, `corr_wall_r_${wz}`, corridorA, CC.x + CORRIDOR_A.width / 2, 0, wz, -Math.PI / 2, 1);
  }

  // Doorway to platforming room (left)
  pm(P.doorway, 'corr_door_platform', corridorA, CC.x - CORRIDOR_A.width / 2, 0, CC.z - 2, Math.PI / 2, 1);

  // Doorway to equipment bay (right)
  pm(P.doorway, 'corr_door_equip', corridorA, CC.x + CORRIDOR_A.width / 2, 0, CC.z - 5, -Math.PI / 2, 1);

  // Ceiling segments
  for (let cz = CC.z + 12; cz >= CC.z - 12; cz -= 4) {
    pm(P.modRoofPlate, `corr_ceil_${cz}`, corridorA, CC.x, CORRIDOR_A.height, cz, 0, 1);
  }

  // Pipes along ceiling
  pp(P.pipe1, 'corr_pipe_1', corridorA, CC.x - 1, CORRIDOR_A.height - 0.2, CC.z, 0, 1);
  pp(P.pipe2, 'corr_pipe_2', corridorA, CC.x + 1, CORRIDOR_A.height - 0.2, CC.z, 0, 1);
  pp(P.pipe1, 'corr_pipe_3', corridorA, CC.x, CORRIDOR_A.height - 0.15, CC.z - 8, 0, 1);

  // Beams across corridor
  pp(P.beamHorizontal1, 'corr_beam_1', corridorA, CC.x, CORRIDOR_A.height - 0.2, CC.z + 8, Math.PI / 2, 1);
  pp(P.beamHorizontal1, 'corr_beam_2', corridorA, CC.x, CORRIDOR_A.height - 0.2, CC.z - 4, Math.PI / 2, 1);
  pp(P.beamHorizontal1, 'corr_beam_3', corridorA, CC.x, CORRIDOR_A.height - 0.2, CC.z - 12, Math.PI / 2, 1);

  // Lamps along corridor
  pp(P.lamp1, 'corr_lamp_1', corridorA, CC.x - 1.5, CORRIDOR_A.height - 0.3, CC.z + 6, 0, 1);
  pp(P.lamp2, 'corr_lamp_2', corridorA, CC.x + 1.5, CORRIDOR_A.height - 0.3, CC.z - 2, 0, 1);
  pp(P.lamp3, 'corr_lamp_3', corridorA, CC.x - 1.5, CORRIDOR_A.height - 0.3, CC.z - 10, 0, 1);

  // Wall detail plates
  pp(P.modPlateLarge, 'corr_plate_1', corridorA, CC.x - 1.8, 1.5, CC.z + 4, Math.PI / 2, 0.7);
  pp(P.modPlateLarge, 'corr_plate_2', corridorA, CC.x + 1.8, 1.5, CC.z - 6, -Math.PI / 2, 0.7);

  // Posters along corridor
  pp(P.poster13, 'corr_poster_1', corridorA, CC.x + 1.8, 1.5, CC.z + 2, -Math.PI / 2, 0.6);
  pp(P.poster11, 'corr_poster_2', corridorA, CC.x - 1.8, 1.5, CC.z - 8, Math.PI / 2, 0.6);

  // Vents on corridor walls
  pp(P.modVent1, 'corr_vent_1', corridorA, CC.x - 1.8, 2.5, CC.z + 10, Math.PI / 2, 1);
  pp(P.modVent2, 'corr_vent_2', corridorA, CC.x + 1.8, 2.5, CC.z - 10, -Math.PI / 2, 1);

  // Barrel and box at corridor entrance
  pp(P.barrel1, 'corr_barrel_1', corridorA, CC.x + 1.5, 0, CC.z + 12, 0, 1);
  pp(P.cardboardBox, 'corr_box_1', corridorA, CC.x - 1.3, 0, CC.z + 11, 0.3, 1);

  // Corridor lights
  for (let z = CC.z + 10; z >= CC.z - 10; z -= 10) {
    addCeilingLight(scene, new Vector3(CC.x, CORRIDOR_A.height - 0.2, z), new Color3(0.9, 0.95, 1), 0.5, lights);
  }

  // ============================================================================
  // EQUIPMENT BAY (15m x 12m x 4m) - off to the right of corridor
  // ============================================================================

  // Floor
  for (let fx = -6; fx <= 6; fx += 4) {
    for (let fz = -4; fz <= 4; fz += 4) {
      pm(P.floorCeiling1, `eq_floor_${fx}_${fz}`, equipmentBayRoom, EC.x + fx, -0.05, EC.z + fz, 0, 1);
    }
  }

  // Walls
  for (let wx = -6; wx <= 6; wx += 4) {
    pm(P.wallDouble, `eq_wall_n_${wx}`, equipmentBayRoom, EC.x + wx, 0, EC.z + EQUIPMENT_BAY.depth / 2, 0, 1);
    pm(P.wallDouble, `eq_wall_s_${wx}`, equipmentBayRoom, EC.x + wx, 0, EC.z - EQUIPMENT_BAY.depth / 2, Math.PI, 1);
  }
  for (let wz = -4; wz <= 4; wz += 4) {
    pm(P.wallSingle, `eq_wall_e_${wz}`, equipmentBayRoom, EC.x + EQUIPMENT_BAY.width / 2, 0, EC.z + wz, -Math.PI / 2, 1);
  }
  // Left wall with door gap
  pm(P.wallSingle, 'eq_wall_w_top', equipmentBayRoom, EC.x - EQUIPMENT_BAY.width / 2, 0, EC.z + 3, Math.PI / 2, 1);
  pm(P.wallSingle, 'eq_wall_w_bot', equipmentBayRoom, EC.x - EQUIPMENT_BAY.width / 2, 0, EC.z - 3, Math.PI / 2, 1);

  // Ceiling
  for (let cx = -6; cx <= 6; cx += 4) {
    for (let cz = -4; cz <= 4; cz += 4) {
      pm(P.modRoofPlate, `eq_ceil_${cx}_${cz}`, equipmentBayRoom, EC.x + cx, EQUIPMENT_BAY.height, EC.z + cz, 0, 1);
    }
  }

  // Shelves along the back wall (suit/equipment storage)
  pp(P.modShelfTall, 'eq_shelf_tall_1', equipmentBayRoom, EC.x - 5, 0, EC.z + 5, 0, 1);
  pp(P.modShelfTall, 'eq_shelf_tall_2', equipmentBayRoom, EC.x - 3, 0, EC.z + 5, 0, 1);
  pp(P.modShelf, 'eq_shelf_1', equipmentBayRoom, EC.x + 5, 0, EC.z + 5, 0, 1);
  pp(P.modShelf, 'eq_shelf_2', equipmentBayRoom, EC.x + 5, 0, EC.z - 3, -Math.PI / 2, 1);
  pp(P.shelf, 'eq_shelf_ind_1', equipmentBayRoom, EC.x + 6, 0, EC.z + 2, -Math.PI / 2, 1);

  // Barrels near the entrance
  pp(P.barrel1, 'eq_barrel_1', equipmentBayRoom, EC.x - 6, 0, EC.z - 4, 0, 1);
  pp(P.barrel2, 'eq_barrel_2', equipmentBayRoom, EC.x - 5.5, 0, EC.z - 4.5, 0.3, 1);

  // Cardboard boxes stacked
  pp(P.cardboardBox, 'eq_box_1', equipmentBayRoom, EC.x + 4, 0, EC.z - 4, 0.5, 1);
  pp(P.cardboardBox, 'eq_box_2', equipmentBayRoom, EC.x + 3.5, 0.4, EC.z - 4, -0.2, 0.9);

  // Electrical equipment along east wall
  pp(P.electrical, 'eq_electrical_1', equipmentBayRoom, EC.x + 6.5, 0, EC.z, -Math.PI / 2, 1);

  // First aid kit on wall
  pp(P.firstAidKit, 'eq_firstaid', equipmentBayRoom, EC.x + 7, 1.5, EC.z - 2, -Math.PI / 2, 1);

  // Machinery unit
  pp(P.machinery, 'eq_machinery_1', equipmentBayRoom, EC.x + 6, 0, EC.z + 4, -Math.PI / 2, 0.8);

  // Computers
  pp(P.modComputer, 'eq_computer_1', equipmentBayRoom, EC.x - 2, 0.8, EC.z - 4, 0, 0.8);
  pp(P.modComputer, 'eq_computer_2', equipmentBayRoom, EC.x + 2, 0.8, EC.z + 3, Math.PI, 0.8);

  // Wall vents
  pp(P.modVent1, 'eq_vent_1', equipmentBayRoom, EC.x - 7, 3.2, EC.z + 2, Math.PI / 2, 1);
  pp(P.modVent2, 'eq_vent_2', equipmentBayRoom, EC.x + 7, 3.2, EC.z - 1, -Math.PI / 2, 1);

  // Posters
  pp(P.poster12, 'eq_poster_1', equipmentBayRoom, EC.x + 7, 1.6, EC.z + 3, -Math.PI / 2, 0.7);
  pp(P.poster13, 'eq_poster_2', equipmentBayRoom, EC.x - 7, 1.6, EC.z - 2, Math.PI / 2, 0.7);

  // Beams
  pp(P.beamHorizontal2, 'eq_beam_1', equipmentBayRoom, EC.x, EQUIPMENT_BAY.height - 0.3, EC.z, 0, 1);

  // Lamps
  pp(P.lamp1, 'eq_lamp_1', equipmentBayRoom, EC.x - 3, EQUIPMENT_BAY.height - 0.3, EC.z, 0, 1);
  pp(P.lamp2, 'eq_lamp_2', equipmentBayRoom, EC.x + 3, EQUIPMENT_BAY.height - 0.3, EC.z, 0, 1);

  // Pillars at corners
  pp(P.modColumn1, 'eq_col_1', equipmentBayRoom, EC.x - 6.5, 0, EC.z + 5, 0, 1);
  pp(P.modColumn1, 'eq_col_2', equipmentBayRoom, EC.x + 6.5, 0, EC.z + 5, 0, 1);
  pp(P.modColumn2, 'eq_col_3', equipmentBayRoom, EC.x - 6.5, 0, EC.z - 5, 0, 1);
  pp(P.modColumn2, 'eq_col_4', equipmentBayRoom, EC.x + 6.5, 0, EC.z - 5, 0, 1);

  // Pipes on ceiling
  pp(P.pipe1, 'eq_pipe_1', equipmentBayRoom, EC.x - 4, EQUIPMENT_BAY.height - 0.1, EC.z, Math.PI / 2, 1);
  pp(P.pipe2, 'eq_pipe_2', equipmentBayRoom, EC.x + 4, EQUIPMENT_BAY.height - 0.1, EC.z, Math.PI / 2, 1);

  // Equipment bay lights
  addCeilingLight(scene, new Vector3(EC.x - 3, EQUIPMENT_BAY.height - 0.2, EC.z), new Color3(0.9, 0.95, 1), 0.6, lights);
  addCeilingLight(scene, new Vector3(EC.x + 3, EQUIPMENT_BAY.height - 0.2, EC.z), new Color3(0.9, 0.95, 1), 0.6, lights);

  // ============================================================================
  // SHOOTING RANGE (25m x 10m x 4m) - at end of corridor
  // ============================================================================

  // Floor
  for (let fx = -10; fx <= 10; fx += 4) {
    for (let fz = -4; fz <= 4; fz += 4) {
      pm(P.floorCeiling1, `sr_floor_${fx}_${fz}`, shootingRangeRoom, SC.x + fx, -0.05, SC.z + fz, 0, 1);
    }
  }

  // Walls - back (target wall)
  for (let wx = -10; wx <= 10; wx += 4) {
    pm(P.wallDouble, `sr_wall_back_${wx}`, shootingRangeRoom, SC.x + wx, 0, SC.z - SHOOTING_RANGE.depth / 2, Math.PI, 1);
  }
  // Left wall
  for (let wz = -4; wz <= 4; wz += 4) {
    pm(P.wallSingle, `sr_wall_l_${wz}`, shootingRangeRoom, SC.x - SHOOTING_RANGE.width / 2, 0, SC.z + wz, Math.PI / 2, 1);
  }
  // Right wall
  for (let wz = -4; wz <= 4; wz += 4) {
    pm(P.wallSingle, `sr_wall_r_${wz}`, shootingRangeRoom, SC.x + SHOOTING_RANGE.width / 2, 0, SC.z + wz, -Math.PI / 2, 1);
  }
  // Front wall with door gap
  pm(P.wallDouble, 'sr_wall_front_l', shootingRangeRoom, SC.x - 8, 0, SC.z + SHOOTING_RANGE.depth / 2, 0, 1);
  pm(P.wallDouble, 'sr_wall_front_r', shootingRangeRoom, SC.x + 8, 0, SC.z + SHOOTING_RANGE.depth / 2, 0, 1);
  pm(P.doorwayWide, 'sr_door_front', shootingRangeRoom, SC.x, 0, SC.z + SHOOTING_RANGE.depth / 2, 0, 1);

  // Ceiling
  for (let cx = -10; cx <= 10; cx += 4) {
    pm(P.modRoofPlate, `sr_ceil_${cx}`, shootingRangeRoom, SC.x + cx, SHOOTING_RANGE.height, SC.z, 0, 1);
  }

  // Shooting booth platform
  pp(P.platformB1, 'sr_booth', shootingRangeRoom, SC.x, 0, SC.z + 3, 0, 1);

  // Target backdrop wall detail
  pp(P.wallRtx1, 'sr_target_backdrop', shootingRangeRoom, SC.x, 0, SC.z - SHOOTING_RANGE.depth / 2 + 0.5, 0, 1.5);

  // Beams across range ceiling
  pp(P.beamHorizontal2, 'sr_beam_1', shootingRangeRoom, SC.x - 6, SHOOTING_RANGE.height - 0.3, SC.z, 0, 1);
  pp(P.beamHorizontal2, 'sr_beam_2', shootingRangeRoom, SC.x + 6, SHOOTING_RANGE.height - 0.3, SC.z, 0, 1);

  // Lamps
  pp(P.lamp1, 'sr_lamp_1', shootingRangeRoom, SC.x - 8, SHOOTING_RANGE.height - 0.3, SC.z, 0, 1);
  pp(P.lamp2, 'sr_lamp_2', shootingRangeRoom, SC.x, SHOOTING_RANGE.height - 0.3, SC.z, 0, 1);
  pp(P.lamp3, 'sr_lamp_3', shootingRangeRoom, SC.x + 8, SHOOTING_RANGE.height - 0.3, SC.z, 0, 1);

  // Barrels behind booth
  pp(P.barrel1, 'sr_barrel_1', shootingRangeRoom, SC.x - 10, 0, SC.z + 4, 0, 1);
  pp(P.barrel2, 'sr_barrel_2', shootingRangeRoom, SC.x + 10, 0, SC.z + 4, 0.5, 1);

  // Shelf with ammo
  pp(P.modShelf, 'sr_shelf_ammo', shootingRangeRoom, SC.x - 11, 0, SC.z + 2, Math.PI / 2, 1);

  // First aid kit on wall
  pp(P.firstAidKit, 'sr_firstaid', shootingRangeRoom, SC.x + 12, 1.5, SC.z - 2, -Math.PI / 2, 1);

  // Pipes
  pp(P.pipe1, 'sr_pipe_1', shootingRangeRoom, SC.x - 6, SHOOTING_RANGE.height - 0.1, SC.z, Math.PI / 2, 1);
  pp(P.pipe2, 'sr_pipe_2', shootingRangeRoom, SC.x + 6, SHOOTING_RANGE.height - 0.1, SC.z, Math.PI / 2, 1);

  // Vents
  pp(P.modVent1, 'sr_vent_1', shootingRangeRoom, SC.x - 12, 3.2, SC.z, Math.PI / 2, 1);
  pp(P.modVent2, 'sr_vent_2', shootingRangeRoom, SC.x + 12, 3.2, SC.z, -Math.PI / 2, 1);

  // Poster
  pp(P.poster11, 'sr_poster_safety', shootingRangeRoom, SC.x + 12, 1.6, SC.z + 3, -Math.PI / 2, 0.8);

  // Door from range to hangar
  pm(P.doorway3, 'sr_door_hangar', shootingRangeRoom, SC.x, 0, SC.z - SHOOTING_RANGE.depth / 2 - 1, 0, 1);

  // Shooting range lights
  addCeilingLight(scene, new Vector3(SC.x - 6, SHOOTING_RANGE.height - 0.2, SC.z), new Color3(0.9, 0.95, 1), 0.5, lights);
  addCeilingLight(scene, new Vector3(SC.x, SHOOTING_RANGE.height - 0.2, SC.z), new Color3(0.9, 0.95, 1), 0.5, lights);
  addCeilingLight(scene, new Vector3(SC.x + 6, SHOOTING_RANGE.height - 0.2, SC.z), new Color3(0.9, 0.95, 1), 0.5, lights);

  // ============================================================================
  // HANGAR BAY (40m x 30m x 12m)
  // ============================================================================

  // Floor - large open area
  for (let fx = -16; fx <= 16; fx += 4) {
    for (let fz = -12; fz <= 12; fz += 4) {
      pm(P.floorCeilingRtx2, `hb_floor_${fx}_${fz}`, hangarBayRoom, HC.x + fx, -0.05, HC.z + fz, 0, 1);
    }
  }

  // Walls - left
  for (let wz = -12; wz <= 12; wz += 4) {
    pm(P.wallM2, `hb_wall_l_${wz}`, hangarBayRoom, HC.x - HANGAR_BAY.width / 2, 0, HC.z + wz, Math.PI / 2, 1);
  }
  // Walls - right
  for (let wz = -12; wz <= 12; wz += 4) {
    pm(P.wallM2, `hb_wall_r_${wz}`, hangarBayRoom, HC.x + HANGAR_BAY.width / 2, 0, HC.z + wz, -Math.PI / 2, 1);
  }
  // Front wall with entrance
  pm(P.wallM2, 'hb_wall_front_l', hangarBayRoom, HC.x - 12, 0, HC.z + HANGAR_BAY.depth / 2, 0, 1);
  pm(P.wallM2, 'hb_wall_front_r', hangarBayRoom, HC.x + 12, 0, HC.z + HANGAR_BAY.depth / 2, 0, 1);

  // Ceiling
  for (let cx = -16; cx <= 16; cx += 8) {
    for (let cz = -12; cz <= 12; cz += 8) {
      pm(P.floorCeilingRtx2, `hb_ceil_${cx}_${cz}`, hangarBayRoom, HC.x + cx, HANGAR_BAY.height, HC.z + cz, Math.PI, 1);
    }
  }

  // Garage door frames at the back (bay doors)
  pm(P.garageDoor1, 'hb_garage_door_l', hangarBayRoom, HC.x - 10, 0, HC.z - HANGAR_BAY.depth / 2, Math.PI, 1);
  pm(P.garageDoor2, 'hb_garage_door_r', hangarBayRoom, HC.x + 10, 0, HC.z - HANGAR_BAY.depth / 2, Math.PI, 1);

  // Windows on side walls
  pm(P.window1, 'hb_win_l_1', hangarBayRoom, HC.x - HANGAR_BAY.width / 2 + 0.2, 2, HC.z + 6, Math.PI / 2, 1.5);
  pm(P.window2, 'hb_win_l_2', hangarBayRoom, HC.x - HANGAR_BAY.width / 2 + 0.2, 2, HC.z - 6, Math.PI / 2, 1.5);
  pm(P.window1, 'hb_win_r_1', hangarBayRoom, HC.x + HANGAR_BAY.width / 2 - 0.2, 2, HC.z + 6, -Math.PI / 2, 1.5);
  pm(P.window2, 'hb_win_r_2', hangarBayRoom, HC.x + HANGAR_BAY.width / 2 - 0.2, 2, HC.z - 6, -Math.PI / 2, 1.5);

  // Platform for the drop pod
  pm(P.platformLarge, 'hb_pod_platform', hangarBayRoom, ROOM_POSITIONS.dropPod.x, 0, ROOM_POSITIONS.dropPod.z, 0, 1);

  // Ramp leading to pod area
  pp(P.rampWide, 'hb_ramp_1', hangarBayRoom, HC.x, 0, HC.z - 2, 0, 1);

  // Pillars supporting high ceiling
  pp(P.pillar2, 'hb_pillar_1', hangarBayRoom, HC.x - 15, 0, HC.z + 8, 0, 2);
  pp(P.pillar4, 'hb_pillar_2', hangarBayRoom, HC.x + 15, 0, HC.z + 8, 0, 2);
  pp(P.pillar2, 'hb_pillar_3', hangarBayRoom, HC.x - 15, 0, HC.z - 8, 0, 2);
  pp(P.pillar4, 'hb_pillar_4', hangarBayRoom, HC.x + 15, 0, HC.z - 8, 0, 2);

  // Beams spanning the ceiling
  pp(P.beamRtx1, 'hb_beam_1', hangarBayRoom, HC.x, HANGAR_BAY.height - 0.5, HC.z + 6, 0, 2);
  pp(P.beamRtx1, 'hb_beam_2', hangarBayRoom, HC.x, HANGAR_BAY.height - 0.5, HC.z - 6, 0, 2);
  pp(P.beamHorizontal2, 'hb_beam_3', hangarBayRoom, HC.x - 8, HANGAR_BAY.height - 0.5, HC.z, Math.PI / 2, 1.5);
  pp(P.beamHorizontal2, 'hb_beam_4', hangarBayRoom, HC.x + 8, HANGAR_BAY.height - 0.5, HC.z, Math.PI / 2, 1.5);

  // Industrial props around hangar
  pp(P.barrel1, 'hb_barrel_1', hangarBayRoom, HC.x - 14, 0, HC.z + 10, 0, 1);
  pp(P.barrel2, 'hb_barrel_2', hangarBayRoom, HC.x - 13, 0, HC.z + 9, 0.4, 1);
  pp(P.barrel1, 'hb_barrel_3', hangarBayRoom, HC.x + 14, 0, HC.z + 10, 0, 1);
  pp(P.cardboardBox, 'hb_box_1', hangarBayRoom, HC.x + 12, 0, HC.z + 11, -0.3, 1.2);
  pp(P.cardboardBox, 'hb_box_2', hangarBayRoom, HC.x + 11, 0, HC.z + 10, 0.8, 1);
  pp(P.cardboardBox, 'hb_box_3', hangarBayRoom, HC.x - 12, 0, HC.z - 10, 0.2, 1.1);

  // Electrical panels
  pp(P.electrical, 'hb_electrical_1', hangarBayRoom, HC.x + 18, 0, HC.z + 4, -Math.PI / 2, 1);
  pp(P.electrical, 'hb_electrical_2', hangarBayRoom, HC.x - 18, 0, HC.z - 4, Math.PI / 2, 1);

  // Machinery near the walls
  pp(P.machinery, 'hb_machinery_1', hangarBayRoom, HC.x + 16, 0, HC.z - 8, -Math.PI / 2, 1);
  pp(P.machinery, 'hb_machinery_2', hangarBayRoom, HC.x - 16, 0, HC.z + 4, Math.PI / 2, 1);

  // Shelves
  pp(P.shelf, 'hb_shelf_1', hangarBayRoom, HC.x + 18, 0, HC.z, -Math.PI / 2, 1);
  pp(P.modShelfTall, 'hb_shelf_tall_1', hangarBayRoom, HC.x - 18, 0, HC.z + 8, Math.PI / 2, 1);

  // Station barrels (different model)
  pp(P.stationBarrel, 'hb_station_barrel_1', hangarBayRoom, HC.x + 6, 0, HC.z + 12, 0, 1);
  pp(P.stationBarrel, 'hb_station_barrel_2', hangarBayRoom, HC.x - 6, 0, HC.z + 12, 0.5, 1);

  // Pipes on ceiling
  pp(P.pipe1, 'hb_pipe_1', hangarBayRoom, HC.x - 10, HANGAR_BAY.height - 0.5, HC.z, 0, 2);
  pp(P.pipe2, 'hb_pipe_2', hangarBayRoom, HC.x + 10, HANGAR_BAY.height - 0.5, HC.z, 0, 2);

  // Vents
  pp(P.modVent1, 'hb_vent_1', hangarBayRoom, HC.x - 19, 8, HC.z, Math.PI / 2, 1.5);
  pp(P.modVent2, 'hb_vent_2', hangarBayRoom, HC.x + 19, 8, HC.z, -Math.PI / 2, 1.5);
  pp(P.modVent1, 'hb_vent_3', hangarBayRoom, HC.x, HANGAR_BAY.height - 1, HC.z + 10, 0, 1.5);
  pp(P.modVent2, 'hb_vent_4', hangarBayRoom, HC.x, HANGAR_BAY.height - 1, HC.z - 10, Math.PI, 1.5);

  // Poster / decals
  pp(P.poster11, 'hb_poster_1', hangarBayRoom, HC.x + 19, 2, HC.z + 2, -Math.PI / 2, 1);
  pp(P.poster12, 'hb_poster_2', hangarBayRoom, HC.x - 19, 2, HC.z - 2, Math.PI / 2, 1);
  pp(P.poster13, 'hb_poster_3', hangarBayRoom, HC.x - 6, 2, HC.z + HANGAR_BAY.depth / 2 - 0.2, 0, 1);

  // First aid kit
  pp(P.firstAidKit, 'hb_firstaid', hangarBayRoom, HC.x + 18, 1.5, HC.z + 8, -Math.PI / 2, 1);

  // Bench near entrance
  pp(P.bench, 'hb_bench_1', hangarBayRoom, HC.x - 8, 0, HC.z + 13, 0, 1);

  // Hangar bay lights (industrial orange)
  for (let x = -12; x <= 12; x += 12) {
    for (let z = HC.z + 8; z >= HC.z - 8; z -= 8) {
      addCeilingLight(scene, new Vector3(x, HANGAR_BAY.height - 0.3, z), new Color3(1, 0.8, 0.6), 0.7, lights);
    }
  }

  // ============================================================================
  // WAIT FOR ALL GLB MODELS TO LOAD
  // ============================================================================

  console.log(`[Environment] Loading ${loadPromises.length} GLB models...`);
  await Promise.allSettled(loadPromises);
  console.log(`[Environment] All GLB models loaded. Total meshes: ${allMeshes.length}`);

  // ============================================================================
  // INTERACTIVE ELEMENTS (MeshBuilder for precise collision/animation shapes)
  // ============================================================================
  // These remain as MeshBuilder primitives because they need:
  // - Precise collision shapes for ray-casting (targets)
  // - Animation on specific mesh properties (doors, drop pod)
  // - Simple geometry that doesn't warrant a GLB asset
  // ============================================================================

  // Hologram table in briefing room (placeholder - no GLB holotable asset)
  const holoTable = MeshBuilder.CreateCylinder(
    'holoTable',
    { height: 0.8, diameter: 3, tessellation: 16 },
    scene
  );
  holoTable.position = new Vector3(BC.x, 0.4, BC.z);
  holoTable.material = materials.get('hull')!;
  holoTable.parent = briefingRoom;

  // Hologram projection (planet)
  const holoPlanet = MeshBuilder.CreateSphere('holoPlanet', { diameter: 1.5, segments: 16 }, scene);
  holoPlanet.position = new Vector3(BC.x, 2, BC.z);
  const holoMat = new StandardMaterial('holoMat', scene);
  holoMat.emissiveColor = new Color3(0.1, 0.3, 0.5);
  holoMat.alpha = 0.6;
  holoPlanet.material = holoMat;
  holoPlanet.parent = briefingRoom;

  // === SUIT LOCKER ===
  const suitLockerContainer = new TransformNode('suitLockerContainer', scene);
  suitLockerContainer.position = ROOM_POSITIONS.suitLocker.clone();
  suitLockerContainer.parent = equipmentBayRoom;

  const lockerFrame = MeshBuilder.CreateBox('lockerFrame', { width: 2, height: 2.5, depth: 0.6 }, scene);
  lockerFrame.position.y = 1.25;
  lockerFrame.material = materials.get('hull')!;
  lockerFrame.parent = suitLockerContainer;

  const suitBody = MeshBuilder.CreateCapsule('suitBody', { height: 1.6, radius: 0.3 }, scene);
  suitBody.position.set(0, 1.3, 0.15);
  suitBody.material = materials.get('pod')!;
  suitBody.parent = suitLockerContainer;

  const suitHelmet = MeshBuilder.CreateSphere('suitHelmet', { diameter: 0.5, segments: 12 }, scene);
  suitHelmet.position.set(0, 2.2, 0.15);
  suitHelmet.material = materials.get('pod')!;
  suitHelmet.parent = suitLockerContainer;

  const lockerLight = MeshBuilder.CreateSphere('lockerLight', { diameter: 0.15 }, scene);
  lockerLight.position.set(0, 2.6, 0.35);
  lockerLight.material = materials.get('active')!;
  lockerLight.parent = suitLockerContainer;

  const lockerPulse = new Animation(
    'lockerPulse',
    'material.emissiveColor',
    30,
    Animation.ANIMATIONTYPE_COLOR3,
    Animation.ANIMATIONLOOPMODE_CYCLE
  );
  lockerPulse.setKeys([
    { frame: 0, value: new Color3(0, 1, 0.25) },
    { frame: 15, value: new Color3(0, 0.3, 0.1) },
    { frame: 30, value: new Color3(0, 1, 0.25) },
  ]);
  lockerLight.animations.push(lockerPulse);
  scene.beginAnimation(lockerLight, 0, 30, true);

  const suitLocker = lockerFrame;

  // === WEAPON RACK ===
  const weaponRackContainer = new TransformNode('weaponRackContainer', scene);
  weaponRackContainer.position = ROOM_POSITIONS.weaponRack.clone();
  weaponRackContainer.parent = equipmentBayRoom;

  const rackFrame = MeshBuilder.CreateBox('rackFrame', { width: 3, height: 2, depth: 0.5 }, scene);
  rackFrame.position.y = 1;
  rackFrame.material = materials.get('hull')!;
  rackFrame.parent = weaponRackContainer;

  for (let i = 0; i < 3; i++) {
    const rifle = MeshBuilder.CreateBox(`rifle_${i}`, { width: 0.8, height: 0.15, depth: 0.1 }, scene);
    rifle.position.set(-0.8 + i * 0.8, 1.2, 0.15);
    rifle.material = materials.get('windowFrame')!;
    rifle.parent = weaponRackContainer;
  }

  const equipmentRack = rackFrame;

  // === CORRIDOR DOOR (equipment) ===
  const corridorToEquipmentDoor = createInteractiveDoor(
    scene,
    corridorA,
    new Vector3(CC.x + CORRIDOR_A.width / 2, 0, CC.z - 5),
    Math.PI / 2,
    CORRIDOR_A.height,
    materials
  );

  // === SHOOTING RANGE TARGETS ===
  const targets: Mesh[] = [];
  const targetMaterials: StandardMaterial[] = [];
  const targetPositions = [
    new Vector3(-5, 1.8, SC.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(-2.5, 1.2, SC.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(0, 2.0, SC.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(2.5, 1.0, SC.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(5, 1.6, SC.z - SHOOTING_RANGE.depth / 2 + 1),
  ];

  for (let i = 0; i < 5; i++) {
    const targetRing = MeshBuilder.CreateTorus(
      `targetRing_${i}`,
      { diameter: 0.5, thickness: 0.04, tessellation: 24 },
      scene
    );
    targetRing.position = targetPositions[i].clone();
    targetRing.rotation.x = Math.PI / 2;
    const targetMat = new StandardMaterial(`targetMat_${i}`, scene);
    targetMat.emissiveColor = new Color3(1, 0.3, 0);
    targetMat.diffuseColor = new Color3(0.3, 0.1, 0);
    targetRing.material = targetMat;
    targetRing.isVisible = false;
    targetRing.parent = shootingRangeRoom;
    targetMaterials.push(targetMat);

    const targetCenter = MeshBuilder.CreateDisc(
      `targetCenter_${i}`,
      { radius: 0.15, tessellation: 16 },
      scene
    );
    targetCenter.position = targetPositions[i].clone();
    targetCenter.position.z -= 0.02;
    const centerMat = new StandardMaterial(`centerMat_${i}`, scene);
    centerMat.emissiveColor = new Color3(1, 0, 0);
    centerMat.diffuseColor = new Color3(0.3, 0, 0);
    targetCenter.material = centerMat;
    targetCenter.isVisible = false;
    targetCenter.parent = shootingRangeRoom;
    targetMaterials.push(centerMat);

    targets.push(targetCenter);
    targets.push(targetRing);
  }

  // Range indicator light
  const rangeLight = MeshBuilder.CreateSphere('rangeLight', { diameter: 0.12 }, scene);
  rangeLight.position = new Vector3(SC.x + 1.2, 1.5, SC.z + 3.3);
  rangeLight.material = materials.get('active')!;
  rangeLight.parent = shootingRangeRoom;

  const rangePulse = new Animation(
    'rangePulse',
    'material.emissiveColor',
    30,
    Animation.ANIMATIONTYPE_COLOR3,
    Animation.ANIMATIONLOOPMODE_CYCLE
  );
  rangePulse.setKeys([
    { frame: 0, value: new Color3(0, 1, 0.25) },
    { frame: 15, value: new Color3(0, 0.3, 0.1) },
    { frame: 30, value: new Color3(0, 1, 0.25) },
  ]);
  rangeLight.animations.push(rangePulse);
  scene.beginAnimation(rangeLight, 0, 30, true);

  // === RANGE TO HANGAR DOOR ===
  const rangeToHangarDoor = createInteractiveDoor(
    scene,
    shootingRangeRoom,
    new Vector3(0, 0, SC.z - SHOOTING_RANGE.depth / 2 - 1),
    0,
    SHOOTING_RANGE.height,
    materials
  );

  // === BAY DOORS ===
  const bayDoorHeight = HANGAR_BAY.height;
  const bayDoorWidth = HANGAR_BAY.width / 2;

  const bayDoorLeft = MeshBuilder.CreateBox(
    'bayDoorLeft',
    { width: bayDoorWidth, height: bayDoorHeight, depth: 0.5 },
    scene
  );
  bayDoorLeft.position = new Vector3(
    HC.x - bayDoorWidth / 2,
    bayDoorHeight / 2,
    HC.z - HANGAR_BAY.depth / 2
  );
  bayDoorLeft.material = materials.get('hull')!;
  bayDoorLeft.parent = hangarBayRoom;

  const bayDoorRight = MeshBuilder.CreateBox(
    'bayDoorRight',
    { width: bayDoorWidth, height: bayDoorHeight, depth: 0.5 },
    scene
  );
  bayDoorRight.position = new Vector3(
    HC.x + bayDoorWidth / 2,
    bayDoorHeight / 2,
    HC.z - HANGAR_BAY.depth / 2
  );
  bayDoorRight.material = materials.get('hull')!;
  bayDoorRight.parent = hangarBayRoom;

  // Caution stripes on bay doors
  for (let y = 2; y < bayDoorHeight - 1; y += 2) {
    for (const door of [bayDoorLeft, bayDoorRight]) {
      const stripe = MeshBuilder.CreateBox('stripe', { width: bayDoorWidth - 0.5, height: 0.4, depth: 0.52 }, scene);
      stripe.position.set(0, y - bayDoorHeight / 2, 0);
      stripe.material = y % 4 < 2 ? materials.get('caution')! : materials.get('emergency')!;
      stripe.parent = door;
    }
  }

  // === DROP POD ===
  const podPosition = ROOM_POSITIONS.dropPod.clone();

  const platform = MeshBuilder.CreateCylinder('platform', { height: 0.3, diameter: 6, tessellation: 16 }, scene);
  platform.position = new Vector3(podPosition.x, 0.15, podPosition.z);
  platform.material = materials.get('hull')!;
  platform.parent = hangarBayRoom;

  const dropPod = MeshBuilder.CreateCylinder('podBody', { height: 3, diameter: 2.5, tessellation: 12 }, scene);
  dropPod.position = new Vector3(podPosition.x, 1.8, podPosition.z);
  dropPod.material = materials.get('pod')!;
  dropPod.parent = hangarBayRoom;

  const podCone = MeshBuilder.CreateCylinder(
    'podCone',
    { height: 1.5, diameterTop: 0, diameterBottom: 2.5, tessellation: 12 },
    scene
  );
  podCone.position = new Vector3(podPosition.x, 4.05, podPosition.z);
  podCone.material = materials.get('pod')!;
  podCone.parent = hangarBayRoom;

  // Pod status lights
  for (let i = 0; i < 3; i++) {
    const statusLight = MeshBuilder.CreateSphere(`podStatus_${i}`, { diameter: 0.12 }, scene);
    statusLight.position = new Vector3(podPosition.x - 0.5 + i * 0.5, 3.2, podPosition.z + 1.28);
    statusLight.material = materials.get('active')!;
    statusLight.parent = hangarBayRoom;
  }

  const podLabel = MeshBuilder.CreatePlane('podLabel', { width: 1.5, height: 0.4 }, scene);
  podLabel.position = new Vector3(podPosition.x, 2.5, podPosition.z + 1.26);
  const labelMat = new StandardMaterial('labelMat', scene);
  labelMat.emissiveColor = new Color3(0.8, 0.7, 0.2);
  labelMat.diffuseColor = Color3.Black();
  podLabel.material = labelMat;
  podLabel.parent = hangarBayRoom;

  const innerDoor = rangeToHangarDoor.door;

  // Door status lights
  const doorLightLeft = MeshBuilder.CreateSphere('doorLightL', { diameter: 0.2 }, scene);
  doorLightLeft.position = new Vector3(-3, SHOOTING_RANGE.height - 0.5, SC.z - SHOOTING_RANGE.depth / 2 - 0.5);
  doorLightLeft.material = materials.get('active')!;
  doorLightLeft.parent = shootingRangeRoom;

  const doorLightRight = MeshBuilder.CreateSphere('doorLightR', { diameter: 0.2 }, scene);
  doorLightRight.position = new Vector3(3, SHOOTING_RANGE.height - 0.5, SC.z - SHOOTING_RANGE.depth / 2 - 0.5);
  doorLightRight.material = materials.get('active')!;
  doorLightRight.parent = shootingRangeRoom;

  // Viewport placeholder
  const viewport = MeshBuilder.CreateBox('viewport', { width: 0.1, height: 0.1, depth: 0.1 }, scene);
  viewport.position = new Vector3(HC.x, 0, HC.z - HANGAR_BAY.depth / 2);
  viewport.isVisible = false;
  viewport.parent = hangarBayRoom;

  // ============================================================================
  // SHOOTING RANGE STATE
  // ============================================================================

  let calibrationActive = false;
  let targetsHit: boolean[] = [false, false, false, false, false];
  let rangeCallbacks: ShootingRangeCallbacks | null = null;

  // ============================================================================
  // ANIMATION FUNCTIONS
  // ============================================================================

  const playEquipSuit = (callback: () => void) => {
    const fadeAnim = new Animation('fadeOut', 'visibility', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    fadeAnim.setKeys([
      { frame: 0, value: 1 },
      { frame: 30, value: 0 },
    ]);
    suitBody.animations = [fadeAnim];
    suitHelmet.animations = [fadeAnim];

    scene.beginAnimation(suitBody, 0, 30, false);
    scene.beginAnimation(suitHelmet, 0, 30, false, 1, () => {
      scene.stopAnimation(lockerLight);
      (lockerLight.material as StandardMaterial).emissiveColor = new Color3(0.2, 0.2, 0.2);
      callback();
    });
  };

  const playDepressurize = (callback: () => void) => {
    const redPulse = new Animation('redPulse', 'material.emissiveColor', 30, Animation.ANIMATIONTYPE_COLOR3, Animation.ANIMATIONLOOPMODE_CYCLE);
    redPulse.setKeys([
      { frame: 0, value: new Color3(1, 0, 0) },
      { frame: 15, value: new Color3(0.3, 0, 0) },
      { frame: 30, value: new Color3(1, 0, 0) },
    ]);
    doorLightLeft.animations = [redPulse];
    doorLightRight.animations = [redPulse];
    scene.beginAnimation(doorLightLeft, 0, 30, true);
    scene.beginAnimation(doorLightRight, 0, 30, true);
    setTimeout(callback, 3000);
  };

  const playOpenBayDoors = (callback: () => void) => {
    const doorOpenLeft = new Animation('doorOpenL', 'position.x', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    doorOpenLeft.setKeys([
      { frame: 0, value: bayDoorLeft.position.x },
      { frame: 90, value: bayDoorLeft.position.x - bayDoorWidth - 2 },
    ]);
    const doorOpenRight = new Animation('doorOpenR', 'position.x', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    doorOpenRight.setKeys([
      { frame: 0, value: bayDoorRight.position.x },
      { frame: 90, value: bayDoorRight.position.x + bayDoorWidth + 2 },
    ]);

    bayDoorLeft.animations = [doorOpenLeft];
    bayDoorRight.animations = [doorOpenRight];

    scene.beginAnimation(bayDoorLeft, 0, 90, false);
    scene.beginAnimation(bayDoorRight, 0, 90, false, 1, callback);
  };

  const playEnterPod = (callback: () => void) => {
    setTimeout(callback, 1500);
  };

  const playLaunch = (callback: () => void) => {
    const podDrop = new Animation('podDrop', 'position.y', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    podDrop.setKeys([
      { frame: 0, value: dropPod.position.y },
      { frame: 10, value: dropPod.position.y - 0.5 },
      { frame: 60, value: dropPod.position.y - 100 },
    ]);
    const coneDrop = new Animation('coneDrop', 'position.y', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    coneDrop.setKeys([
      { frame: 0, value: podCone.position.y },
      { frame: 10, value: podCone.position.y - 0.5 },
      { frame: 60, value: podCone.position.y - 100 },
    ]);

    dropPod.animations = [podDrop];
    podCone.animations = [coneDrop];

    scene.beginAnimation(dropPod, 0, 60, false);
    scene.beginAnimation(podCone, 0, 60, false, 1, callback);
  };

  const startCalibration = (callbacks: ShootingRangeCallbacks) => {
    calibrationActive = true;
    rangeCallbacks = callbacks;
    targetsHit = [false, false, false, false, false];

    scene.stopAnimation(rangeLight);
    (rangeLight.material as StandardMaterial).emissiveColor = new Color3(1, 0.6, 0);

    for (let i = 0; i < 5; i++) {
      const ringIndex = i * 2 + 1;
      const centerIndex = i * 2;

      setTimeout(() => {
        if (targets[ringIndex]) targets[ringIndex].isVisible = true;
        if (targets[centerIndex]) targets[centerIndex].isVisible = true;

        const targetMat = targets[ringIndex].material as StandardMaterial;
        const originalColor = targetMat.emissiveColor.clone();
        targetMat.emissiveColor = new Color3(1, 1, 1);
        setTimeout(() => {
          targetMat.emissiveColor = originalColor;
        }, 100);
      }, i * 200);
    }
  };

  const checkTargetHit = (rayOrigin: Vector3, rayDirection: Vector3): boolean => {
    if (!calibrationActive) return false;

    for (let i = 0; i < 5; i++) {
      if (targetsHit[i]) continue;

      const centerIndex = i * 2;
      const ringIndex = i * 2 + 1;
      const targetCenter = targets[centerIndex];
      if (!targetCenter) continue;

      const targetPos = targetCenter.getAbsolutePosition();
      const hitRadius = 0.3;
      const toTarget = targetPos.subtract(rayOrigin);
      const projection = Vector3.Dot(toTarget, rayDirection);

      if (projection < 0) continue;

      const closestPoint = rayOrigin.add(rayDirection.scale(projection));
      const distance = Vector3.Distance(closestPoint, targetPos);

      if (distance <= hitRadius) {
        targetsHit[i] = true;

        const ringMat = targets[ringIndex].material as StandardMaterial;
        const centerMat = targetCenter.material as StandardMaterial;

        ringMat.emissiveColor = new Color3(0, 1, 0.3);
        centerMat.emissiveColor = new Color3(0, 1, 0.3);

        setTimeout(() => {
          targets[ringIndex].isVisible = false;
          targetCenter.isVisible = false;
        }, 150);

        rangeCallbacks?.onTargetHit(i);

        if (targetsHit.every((hit) => hit)) {
          calibrationActive = false;
          (rangeLight.material as StandardMaterial).emissiveColor = new Color3(0, 1, 0.25);
          rangeCallbacks?.onAllTargetsHit();
        }

        return true;
      }
    }

    return false;
  };

  const isCalibrationActive = () => calibrationActive;

  const openDoor = (
    doorName:
      | 'corridor_to_equipment'
      | 'corridor_to_range'
      | 'range_to_hangar'
      | 'corridor_to_platforming'
  ) => {
    let door: Mesh | null = null;

    switch (doorName) {
      case 'corridor_to_equipment':
        door = corridorToEquipmentDoor.door;
        break;
      case 'range_to_hangar':
        door = rangeToHangarDoor.door;
        break;
      case 'corridor_to_platforming':
        break;
    }

    if (!door) return;

    const slideAnim = new Animation('doorSlide', 'position.y', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
    slideAnim.setKeys([
      { frame: 0, value: door.position.y },
      { frame: 30, value: door.position.y + 3 },
    ]);
    door.animations = [slideAnim];
    scene.beginAnimation(door, 0, 30, false);
  };

  // ============================================================================
  // SCENIC ROOMS
  // ============================================================================

  const scenicRooms = await createScenicRooms(scene);
  scenicRooms.root.parent = root;
  lights.push(...scenicRooms.lights);

  // ============================================================================
  // DISPOSE
  // ============================================================================

  const dispose = () => {
    for (const mesh of allMeshes) {
      mesh.dispose();
    }
    for (const light of lights) {
      light.dispose();
    }
    for (const mat of targetMaterials) {
      mat.dispose();
    }
    holoMat.dispose();
    labelMat.dispose();
    disposeMaterials(materials);
    Object.values(curvedCorridors).forEach((corridor) => {
      corridor.dispose();
    });
    scenicRooms.dispose();
    modelCache.clear();
    root.dispose();
  };

  return {
    root,
    dropPod,
    viewport,
    equipmentRack,
    suitLocker,
    shootingRange: shootingRangeRoom,
    innerDoor,
    bayDoorLeft,
    bayDoorRight,
    lights,
    rooms: {
      briefing: briefingRoom,
      corridorA,
      platformingRoom,
      equipmentBay: equipmentBayRoom,
      shootingRange: shootingRangeRoom,
      hangarBay: hangarBayRoom,
      scenicCorridor: scenicRooms.rooms.scenicCorridor,
      observationDeck: scenicRooms.rooms.observationDeck,
      messHall: scenicRooms.rooms.messHall,
      recreationRoom: scenicRooms.rooms.recreationRoom,
    },
    curvedCorridors,
    scenicRooms,
    playEquipSuit,
    playDepressurize,
    playOpenBayDoors,
    playEnterPod,
    playLaunch,
    startCalibration,
    checkTargetHit,
    isCalibrationActive,
    startPlatformingTutorial: (callbacks: PlatformingRoomCallbacks) => {
      platformingRoomState.startPlatformingTutorial(callbacks);
    },
    checkJumpZone: (playerPosition: Vector3, isJumping: boolean) =>
      platformingRoomState.checkJumpZone(playerPosition, isJumping),
    checkCrouchZone: (playerPosition: Vector3, isCrouching: boolean) =>
      platformingRoomState.checkCrouchZone(playerPosition, isCrouching),
    isPlatformingActive: () => platformingRoomState.isActive(),
    getPlatformColliders: () => platformingRoomState.getPlatformColliders(),
    openCorridorDoor: (corridor: keyof typeof curvedCorridors, which: 'start' | 'end') => {
      const corridorObj = curvedCorridors[corridor];
      if (corridorObj) {
        corridorObj.openDoor(which);
      }
    },
    openDoor,
    dispose,
  };
}

// ============================================================================
// Helper: Create interactive sliding door (MeshBuilder for animation)
// ============================================================================

function createInteractiveDoor(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  rotationY: number,
  height: number,
  materials: Map<string, StandardMaterial>
): { frame: Mesh; door: Mesh } {
  const frameWidth = 2.4;
  const frameHeight = height;

  const leftFrame = MeshBuilder.CreateBox('frameLeft', { width: 0.3, height: frameHeight, depth: 0.5 }, scene);
  leftFrame.position = position.clone();
  leftFrame.position.x -= frameWidth / 2 + 0.15;
  leftFrame.position.y = frameHeight / 2;
  leftFrame.rotation.y = rotationY;
  leftFrame.material = materials.get('windowFrame')!;
  leftFrame.parent = parent;

  const rightFrame = MeshBuilder.CreateBox('frameRight', { width: 0.3, height: frameHeight, depth: 0.5 }, scene);
  rightFrame.position = position.clone();
  rightFrame.position.x += frameWidth / 2 + 0.15;
  rightFrame.position.y = frameHeight / 2;
  rightFrame.rotation.y = rotationY;
  rightFrame.material = materials.get('windowFrame')!;
  rightFrame.parent = parent;

  const topFrame = MeshBuilder.CreateBox('frameTop', { width: frameWidth + 0.6, height: 0.3, depth: 0.5 }, scene);
  topFrame.position = position.clone();
  topFrame.position.y = frameHeight + 0.15;
  topFrame.rotation.y = rotationY;
  topFrame.material = materials.get('windowFrame')!;
  topFrame.parent = parent;

  const door = MeshBuilder.CreateBox('door', { width: frameWidth, height: frameHeight - 0.3, depth: 0.1 }, scene);
  door.position = position.clone();
  door.position.y = (frameHeight - 0.3) / 2;
  door.rotation.y = rotationY;
  door.material = materials.get('hull')!;
  door.parent = parent;

  return { frame: leftFrame, door };
}
