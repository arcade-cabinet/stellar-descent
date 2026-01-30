import { Animation } from '@babylonjs/core/Animations/animation';
// Import Animatable to register scene.beginAnimation
import '@babylonjs/core/Animations/animatable';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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
// The station ring has curved corridors connecting tutorial rooms.
// These follow circular arcs, simulating a rotating ring station design.
// Ring radius = 50m, corridors are 4m wide and 3m tall.
// ============================================================================

const RING_RADIUS = 50; // Distance from station center to corridor centerline
const CURVED_CORRIDOR_WIDTH = 4;
const CURVED_CORRIDOR_HEIGHT = 3;

/**
 * Curved corridor configurations connecting the tutorial rooms.
 * Exported for collision detection in AnchorStationLevel.
 */
export const CURVED_CORRIDOR_CONFIGS = {
  // Briefing Room exit -> Movement Tutorial Area (replaces part of Corridor A)
  briefingToMovement: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 - 0.12, // Start just past briefing exit
    arcAngle: Math.PI / 10, // ~18 degrees
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

  // Movement Area -> Platforming Room entrance
  movementToPlatforming: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 + Math.PI / 10 - 0.12,
    arcAngle: Math.PI / 12, // ~15 degrees
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

  // Platforming Room exit -> Equipment Bay entrance
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

  // Equipment Bay exit -> Shooting Range entrance
  equipmentToRange: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 + Math.PI / 4,
    arcAngle: Math.PI / 8, // ~22.5 degrees
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

  // Shooting Range exit -> Hangar Bay entrance
  rangeToHangar: {
    ringRadius: RING_RADIUS,
    startAngle: -Math.PI / 2 + Math.PI / 4 + Math.PI / 8,
    arcAngle: Math.PI / 6, // 30 degrees - longer approach to hangar
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
  // Room references
  rooms: {
    briefing: TransformNode;
    corridorA: TransformNode;
    platformingRoom: TransformNode;
    equipmentBay: TransformNode;
    shootingRange: TransformNode;
    hangarBay: TransformNode;
    // Scenic rooms (optional exploration areas)
    scenicCorridor: TransformNode;
    observationDeck: TransformNode;
    messHall: TransformNode;
    recreationRoom: TransformNode;
  };
  // Curved corridors connecting tutorial rooms (ring station design)
  curvedCorridors: {
    briefingToMovement: CurvedCorridorResult;
    movementToPlatforming: CurvedCorridorResult;
    platformingToEquipment: CurvedCorridorResult;
    equipmentToRange: CurvedCorridorResult;
    rangeToHangar: CurvedCorridorResult;
  };
  // Scenic rooms container
  scenicRooms: ScenicRoomsResult;
  // Animation methods
  playEquipSuit: (callback: () => void) => void;
  playDepressurize: (callback: () => void) => void;
  playOpenBayDoors: (callback: () => void) => void;
  playEnterPod: (callback: () => void) => void;
  playLaunch: (callback: () => void) => void;
  // Shooting range methods
  startCalibration: (callbacks: ShootingRangeCallbacks) => void;
  checkTargetHit: (rayOrigin: Vector3, rayDirection: Vector3) => boolean;
  isCalibrationActive: () => boolean;
  // Platforming room methods
  startPlatformingTutorial: (callbacks: PlatformingCallbacks) => void;
  checkJumpZone: (playerPosition: Vector3, isJumping: boolean) => boolean;
  checkCrouchZone: (playerPosition: Vector3, isCrouching: boolean) => boolean;
  isPlatformingActive: () => boolean;
  getPlatformColliders: () => Mesh[];
  // Curved corridor door control
  openCorridorDoor: (
    corridor: keyof StationEnvironment['curvedCorridors'],
    which: 'start' | 'end'
  ) => void;
  // Door control
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
// Helper functions for modular geometry
// ============================================================================

function createFloorModule(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  width: number,
  depth: number,
  material: StandardMaterial,
  allMeshes: Mesh[]
): Mesh {
  const floor = MeshBuilder.CreateBox('floor', { width, height: 0.2, depth }, scene);
  floor.position = position.clone();
  floor.position.y = -0.1;
  floor.material = material;
  floor.parent = parent;
  allMeshes.push(floor);
  return floor;
}

function createWallModule(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  width: number,
  height: number,
  rotationY: number,
  material: StandardMaterial,
  allMeshes: Mesh[]
): Mesh {
  const wall = MeshBuilder.CreateBox('wall', { width, height, depth: 0.3 }, scene);
  wall.position = position.clone();
  wall.position.y = height / 2;
  wall.rotation.y = rotationY;
  wall.material = material;
  wall.parent = parent;
  allMeshes.push(wall);
  return wall;
}

function createCeilingModule(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  width: number,
  depth: number,
  height: number,
  material: StandardMaterial,
  allMeshes: Mesh[]
): Mesh {
  const ceiling = MeshBuilder.CreateBox('ceiling', { width, height: 0.2, depth }, scene);
  ceiling.position = position.clone();
  ceiling.position.y = height + 0.1;
  ceiling.material = material;
  ceiling.parent = parent;
  allMeshes.push(ceiling);
  return ceiling;
}

function createDoorFrame(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  rotationY: number,
  height: number,
  material: StandardMaterial,
  doorMaterial: StandardMaterial,
  allMeshes: Mesh[]
): { frame: Mesh; door: Mesh } {
  // Door frame
  const frameWidth = 2.4;
  const frameHeight = height;

  // Left frame piece
  const leftFrame = MeshBuilder.CreateBox(
    'frameLeft',
    { width: 0.3, height: frameHeight, depth: 0.5 },
    scene
  );
  leftFrame.position = position.clone();
  leftFrame.position.x -= frameWidth / 2 + 0.15;
  leftFrame.position.y = frameHeight / 2;
  leftFrame.rotation.y = rotationY;
  leftFrame.material = material;
  leftFrame.parent = parent;
  allMeshes.push(leftFrame);

  // Right frame piece
  const rightFrame = MeshBuilder.CreateBox(
    'frameRight',
    { width: 0.3, height: frameHeight, depth: 0.5 },
    scene
  );
  rightFrame.position = position.clone();
  rightFrame.position.x += frameWidth / 2 + 0.15;
  rightFrame.position.y = frameHeight / 2;
  rightFrame.rotation.y = rotationY;
  rightFrame.material = material;
  rightFrame.parent = parent;
  allMeshes.push(rightFrame);

  // Top frame piece
  const topFrame = MeshBuilder.CreateBox(
    'frameTop',
    { width: frameWidth + 0.6, height: 0.3, depth: 0.5 },
    scene
  );
  topFrame.position = position.clone();
  topFrame.position.y = frameHeight + 0.15;
  topFrame.rotation.y = rotationY;
  topFrame.material = material;
  topFrame.parent = parent;
  allMeshes.push(topFrame);

  // Door (sliding)
  const door = MeshBuilder.CreateBox(
    'door',
    { width: frameWidth, height: frameHeight - 0.3, depth: 0.1 },
    scene
  );
  door.position = position.clone();
  door.position.y = (frameHeight - 0.3) / 2;
  door.rotation.y = rotationY;
  door.material = doorMaterial;
  door.parent = parent;
  allMeshes.push(door);

  return { frame: leftFrame, door };
}

/**
 * Create a window showing the space view (planet Alpha-7 and stars).
 * Windows are sealed - they show a view but cannot be passed through.
 */
function createSpaceWindow(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  width: number,
  height: number,
  rotationY: number,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): Mesh {
  // Window frame (darker metal border)
  const frameThickness = 0.15;
  const frameDepth = 0.2;

  // Top frame
  const topFrame = MeshBuilder.CreateBox(
    'windowFrameTop',
    { width: width + frameThickness * 2, height: frameThickness, depth: frameDepth },
    scene
  );
  topFrame.position = position.clone();
  topFrame.position.y += height / 2 + frameThickness / 2;
  topFrame.rotation.y = rotationY;
  topFrame.material = materials.get('windowFrame')!;
  topFrame.parent = parent;
  allMeshes.push(topFrame);

  // Bottom frame
  const bottomFrame = MeshBuilder.CreateBox(
    'windowFrameBottom',
    { width: width + frameThickness * 2, height: frameThickness, depth: frameDepth },
    scene
  );
  bottomFrame.position = position.clone();
  bottomFrame.position.y -= height / 2 + frameThickness / 2;
  bottomFrame.rotation.y = rotationY;
  bottomFrame.material = materials.get('windowFrame')!;
  bottomFrame.parent = parent;
  allMeshes.push(bottomFrame);

  // Left frame
  const leftFrame = MeshBuilder.CreateBox(
    'windowFrameLeft',
    { width: frameThickness, height: height, depth: frameDepth },
    scene
  );
  leftFrame.position = position.clone();
  // Offset along local X based on rotation
  leftFrame.position.x -= Math.cos(rotationY) * (width / 2 + frameThickness / 2);
  leftFrame.position.z += Math.sin(rotationY) * (width / 2 + frameThickness / 2);
  leftFrame.rotation.y = rotationY;
  leftFrame.material = materials.get('windowFrame')!;
  leftFrame.parent = parent;
  allMeshes.push(leftFrame);

  // Right frame
  const rightFrame = MeshBuilder.CreateBox(
    'windowFrameRight',
    { width: frameThickness, height: height, depth: frameDepth },
    scene
  );
  rightFrame.position = position.clone();
  rightFrame.position.x += Math.cos(rotationY) * (width / 2 + frameThickness / 2);
  rightFrame.position.z -= Math.sin(rotationY) * (width / 2 + frameThickness / 2);
  rightFrame.rotation.y = rotationY;
  rightFrame.material = materials.get('windowFrame')!;
  rightFrame.parent = parent;
  allMeshes.push(rightFrame);

  // Window glass/view - the actual space view
  const windowPane = MeshBuilder.CreatePlane('spaceWindow', { width, height }, scene);
  windowPane.position = position.clone();
  windowPane.rotation.y = rotationY + Math.PI; // Face inward
  windowPane.material = materials.get('spaceWindow')!;
  windowPane.parent = parent;
  allMeshes.push(windowPane);

  return windowPane;
}

function addCeilingLight(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  color: Color3,
  intensity: number,
  lights: PointLight[],
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): PointLight {
  // Light fixture mesh
  const fixture = MeshBuilder.CreateCylinder(
    'lightFixture',
    { height: 0.15, diameter: 0.6, tessellation: 12 },
    scene
  );
  fixture.position = position.clone();
  fixture.material = materials.get('active')!;
  fixture.parent = parent;
  allMeshes.push(fixture);

  // Point light
  const light = new PointLight(`ceilingLight_${lights.length}`, position.clone(), scene);
  light.diffuse = color;
  light.intensity = intensity;
  light.range = 15;
  lights.push(light);

  return light;
}

// ============================================================================
// Main environment creation
// ============================================================================

export function createStationEnvironment(scene: Scene): StationEnvironment {
  const root = new TransformNode('anchorStation', scene);
  const materials = createStationMaterials(scene);
  const lights: PointLight[] = [];
  const allMeshes: Mesh[] = [];

  // Create room containers
  const briefingRoom = new TransformNode('briefingRoom', scene);
  briefingRoom.parent = root;

  const corridorA = new TransformNode('corridorA', scene);
  corridorA.parent = root;

  const platformingRoom = new TransformNode('platformingRoom', scene);
  platformingRoom.parent = root;

  // Create platforming room geometry and state
  const platformingRoomState = createPlatformingRoom({
    scene,
    parent: platformingRoom,
    roomCenter: PLATFORMING_ROOM_CENTER,
    roomWidth: PLATFORMING_ROOM.width,
    roomDepth: PLATFORMING_ROOM.depth,
    roomHeight: PLATFORMING_ROOM.height,
    materials,
    allMeshes,
    lights,
    addCeilingLight,
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
  // Create curved corridors connecting tutorial rooms.
  // These follow circular arcs simulating a rotating ring station.
  // ============================================================================

  const curvedCorridorsContainer = new TransformNode('curvedCorridors', scene);
  curvedCorridorsContainer.parent = root;

  // Create all curved corridors
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

  // Parent all corridor roots to the container
  Object.values(curvedCorridors).forEach((corridor) => {
    corridor.root.parent = curvedCorridorsContainer;
    // Add corridor meshes and lights to tracking arrays
    allMeshes.push(...corridor.meshes);
    lights.push(...corridor.lights);
  });

  // ============================================================================
  // BRIEFING ROOM (20m x 15m x 4m)
  // ============================================================================

  // Floor
  createFloorModule(
    scene,
    briefingRoom,
    BRIEFING_CENTER,
    BRIEFING_ROOM.width,
    BRIEFING_ROOM.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Walls
  // Back wall (north)
  createWallModule(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x, 0, BRIEFING_CENTER.z + BRIEFING_ROOM.depth / 2),
    BRIEFING_ROOM.width,
    BRIEFING_ROOM.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  // Left wall (west)
  createWallModule(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x - BRIEFING_ROOM.width / 2, 0, BRIEFING_CENTER.z),
    BRIEFING_ROOM.depth,
    BRIEFING_ROOM.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Right wall (east)
  createWallModule(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x + BRIEFING_ROOM.width / 2, 0, BRIEFING_CENTER.z),
    BRIEFING_ROOM.depth,
    BRIEFING_ROOM.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Front wall with door opening (south) - two sections
  createWallModule(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x - 6, 0, BRIEFING_CENTER.z - BRIEFING_ROOM.depth / 2),
    8,
    BRIEFING_ROOM.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x + 6, 0, BRIEFING_CENTER.z - BRIEFING_ROOM.depth / 2),
    8,
    BRIEFING_ROOM.height,
    0,
    materials.get('hull')!,
    allMeshes
  );

  // Ceiling
  createCeilingModule(
    scene,
    briefingRoom,
    BRIEFING_CENTER,
    BRIEFING_ROOM.width,
    BRIEFING_ROOM.depth,
    BRIEFING_ROOM.height,
    materials.get('hull')!,
    allMeshes
  );

  // Hologram table in center
  const holoTable = MeshBuilder.CreateCylinder(
    'holoTable',
    { height: 0.8, diameter: 3, tessellation: 16 },
    scene
  );
  holoTable.position = new Vector3(BRIEFING_CENTER.x, 0.4, BRIEFING_CENTER.z);
  holoTable.material = materials.get('hull')!;
  holoTable.parent = briefingRoom;
  allMeshes.push(holoTable);

  // Hologram projection (planet)
  const holoPlanet = MeshBuilder.CreateSphere('holoPlanet', { diameter: 1.5, segments: 16 }, scene);
  holoPlanet.position = new Vector3(BRIEFING_CENTER.x, 2, BRIEFING_CENTER.z);
  const holoMat = new StandardMaterial('holoMat', scene);
  holoMat.emissiveColor = new Color3(0.1, 0.3, 0.5);
  holoMat.alpha = 0.6;
  holoPlanet.material = holoMat;
  holoPlanet.parent = briefingRoom;
  allMeshes.push(holoPlanet);

  // Briefing room lights
  addCeilingLight(
    scene,
    briefingRoom,
    new Vector3(-5, BRIEFING_ROOM.height - 0.2, 3),
    new Color3(0.8, 0.9, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );
  addCeilingLight(
    scene,
    briefingRoom,
    new Vector3(5, BRIEFING_ROOM.height - 0.2, 3),
    new Color3(0.8, 0.9, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );
  addCeilingLight(
    scene,
    briefingRoom,
    new Vector3(0, BRIEFING_ROOM.height - 0.2, -3),
    new Color3(0.8, 0.9, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );

  // === BRIEFING ROOM WINDOWS ===
  // Windows on the back wall (north) showing planet Alpha-7 below
  // Three large observation windows
  const windowHeight = 2.5;
  const windowWidth = 4;
  const windowY = windowHeight / 2 + 0.5; // Slightly above floor level

  // Left window
  createSpaceWindow(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x - 6, windowY, BRIEFING_CENTER.z + BRIEFING_ROOM.depth / 2 - 0.1),
    windowWidth,
    windowHeight,
    0,
    materials,
    allMeshes
  );

  // Center window (larger)
  createSpaceWindow(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x, windowY, BRIEFING_CENTER.z + BRIEFING_ROOM.depth / 2 - 0.1),
    windowWidth + 1,
    windowHeight,
    0,
    materials,
    allMeshes
  );

  // Right window
  createSpaceWindow(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x + 6, windowY, BRIEFING_CENTER.z + BRIEFING_ROOM.depth / 2 - 0.1),
    windowWidth,
    windowHeight,
    0,
    materials,
    allMeshes
  );

  // Side windows (left wall - west)
  createSpaceWindow(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x - BRIEFING_ROOM.width / 2 + 0.1, windowY, BRIEFING_CENTER.z + 3),
    windowWidth - 1,
    windowHeight - 0.5,
    Math.PI / 2,
    materials,
    allMeshes
  );

  createSpaceWindow(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x - BRIEFING_ROOM.width / 2 + 0.1, windowY, BRIEFING_CENTER.z - 3),
    windowWidth - 1,
    windowHeight - 0.5,
    Math.PI / 2,
    materials,
    allMeshes
  );

  // Side windows (right wall - east)
  createSpaceWindow(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x + BRIEFING_ROOM.width / 2 - 0.1, windowY, BRIEFING_CENTER.z + 3),
    windowWidth - 1,
    windowHeight - 0.5,
    -Math.PI / 2,
    materials,
    allMeshes
  );

  createSpaceWindow(
    scene,
    briefingRoom,
    new Vector3(BRIEFING_CENTER.x + BRIEFING_ROOM.width / 2 - 0.1, windowY, BRIEFING_CENTER.z - 3),
    windowWidth - 1,
    windowHeight - 0.5,
    -Math.PI / 2,
    materials,
    allMeshes
  );

  // ============================================================================
  // CORRIDOR A (4m wide x 30m long x 3m tall)
  // ============================================================================

  // Floor with guide line
  createFloorModule(
    scene,
    corridorA,
    CORRIDOR_A_CENTER,
    CORRIDOR_A.width,
    CORRIDOR_A.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Guide line
  const guideLine = MeshBuilder.CreateBox(
    'guideLine',
    { width: 0.2, height: 0.02, depth: CORRIDOR_A.depth - 2 },
    scene
  );
  guideLine.position = CORRIDOR_A_CENTER.clone();
  guideLine.position.y = 0.02;
  guideLine.material = materials.get('guide')!;
  guideLine.parent = corridorA;
  allMeshes.push(guideLine);

  // Corridor walls (with openings for doors)
  // Left wall - sections with door opening to platforming room
  // Section before platforming room door
  createWallModule(
    scene,
    corridorA,
    new Vector3(CORRIDOR_A_CENTER.x - CORRIDOR_A.width / 2, 0, CORRIDOR_A_CENTER.z + 8),
    12,
    CORRIDOR_A.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Section after platforming room door
  createWallModule(
    scene,
    corridorA,
    new Vector3(CORRIDOR_A_CENTER.x - CORRIDOR_A.width / 2, 0, CORRIDOR_A_CENTER.z - 8),
    12,
    CORRIDOR_A.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // Right wall - sections with door openings
  // Section before equipment bay door
  createWallModule(
    scene,
    corridorA,
    new Vector3(CORRIDOR_A_CENTER.x + CORRIDOR_A.width / 2, 0, CORRIDOR_A_CENTER.z + 8),
    12,
    CORRIDOR_A.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Section after equipment bay door
  createWallModule(
    scene,
    corridorA,
    new Vector3(CORRIDOR_A_CENTER.x + CORRIDOR_A.width / 2, 0, CORRIDOR_A_CENTER.z - 8),
    12,
    CORRIDOR_A.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // Ceiling with pipes
  createCeilingModule(
    scene,
    corridorA,
    CORRIDOR_A_CENTER,
    CORRIDOR_A.width,
    CORRIDOR_A.depth,
    CORRIDOR_A.height,
    materials.get('hull')!,
    allMeshes
  );

  // Pipes along corridor ceiling
  for (let i = 0; i < 3; i++) {
    const pipe = MeshBuilder.CreateCylinder(
      `pipe_${i}`,
      { height: CORRIDOR_A.depth, diameter: 0.15 + (i % 2) * 0.05, tessellation: 8 },
      scene
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position = new Vector3(
      CORRIDOR_A_CENTER.x - 1 + i * 1,
      CORRIDOR_A.height - 0.15,
      CORRIDOR_A_CENTER.z
    );
    pipe.material = materials.get('pipe')!;
    pipe.parent = corridorA;
    allMeshes.push(pipe);
  }

  // Corridor lights
  for (let z = CORRIDOR_A_CENTER.z + 10; z >= CORRIDOR_A_CENTER.z - 10; z -= 10) {
    addCeilingLight(
      scene,
      corridorA,
      new Vector3(CORRIDOR_A_CENTER.x, CORRIDOR_A.height - 0.2, z),
      new Color3(0.9, 0.95, 1),
      0.5,
      lights,
      materials,
      allMeshes
    );
  }

  // Door to equipment bay
  const corridorToEquipmentDoor = createDoorFrame(
    scene,
    corridorA,
    new Vector3(CORRIDOR_A_CENTER.x + CORRIDOR_A.width / 2, 0, CORRIDOR_A_CENTER.z - 5),
    Math.PI / 2,
    CORRIDOR_A.height,
    materials.get('windowFrame')!,
    materials.get('hull')!,
    allMeshes
  );

  // ============================================================================
  // EQUIPMENT BAY (15m x 12m x 4m) - off to the right of corridor
  // ============================================================================

  // Floor
  createFloorModule(
    scene,
    equipmentBayRoom,
    EQUIPMENT_BAY_CENTER,
    EQUIPMENT_BAY.width,
    EQUIPMENT_BAY.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Walls
  // Back wall
  createWallModule(
    scene,
    equipmentBayRoom,
    new Vector3(EQUIPMENT_BAY_CENTER.x, 0, EQUIPMENT_BAY_CENTER.z + EQUIPMENT_BAY.depth / 2),
    EQUIPMENT_BAY.width,
    EQUIPMENT_BAY.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  // Right wall
  createWallModule(
    scene,
    equipmentBayRoom,
    new Vector3(EQUIPMENT_BAY_CENTER.x + EQUIPMENT_BAY.width / 2, 0, EQUIPMENT_BAY_CENTER.z),
    EQUIPMENT_BAY.depth,
    EQUIPMENT_BAY.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Front wall
  createWallModule(
    scene,
    equipmentBayRoom,
    new Vector3(EQUIPMENT_BAY_CENTER.x, 0, EQUIPMENT_BAY_CENTER.z - EQUIPMENT_BAY.depth / 2),
    EQUIPMENT_BAY.width,
    EQUIPMENT_BAY.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  // Left wall - partial (door opening to corridor)
  createWallModule(
    scene,
    equipmentBayRoom,
    new Vector3(EQUIPMENT_BAY_CENTER.x - EQUIPMENT_BAY.width / 2, 0, EQUIPMENT_BAY_CENTER.z + 3),
    5,
    EQUIPMENT_BAY.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    equipmentBayRoom,
    new Vector3(EQUIPMENT_BAY_CENTER.x - EQUIPMENT_BAY.width / 2, 0, EQUIPMENT_BAY_CENTER.z - 3),
    5,
    EQUIPMENT_BAY.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // Ceiling
  createCeilingModule(
    scene,
    equipmentBayRoom,
    EQUIPMENT_BAY_CENTER,
    EQUIPMENT_BAY.width,
    EQUIPMENT_BAY.depth,
    EQUIPMENT_BAY.height,
    materials.get('hull')!,
    allMeshes
  );

  // === SUIT LOCKER ===
  const suitLockerContainer = new TransformNode('suitLockerContainer', scene);
  suitLockerContainer.position = ROOM_POSITIONS.suitLocker.clone();
  suitLockerContainer.parent = equipmentBayRoom;

  // Locker frame
  const lockerFrame = MeshBuilder.CreateBox(
    'lockerFrame',
    { width: 2, height: 2.5, depth: 0.6 },
    scene
  );
  lockerFrame.position.y = 1.25;
  lockerFrame.material = materials.get('hull')!;
  lockerFrame.parent = suitLockerContainer;
  allMeshes.push(lockerFrame);

  // Suit silhouette
  const suitBody = MeshBuilder.CreateCapsule('suitBody', { height: 1.6, radius: 0.3 }, scene);
  suitBody.position.set(0, 1.3, 0.15);
  suitBody.material = materials.get('pod')!;
  suitBody.parent = suitLockerContainer;
  allMeshes.push(suitBody);

  // Suit helmet
  const suitHelmet = MeshBuilder.CreateSphere('suitHelmet', { diameter: 0.5, segments: 12 }, scene);
  suitHelmet.position.set(0, 2.2, 0.15);
  suitHelmet.material = materials.get('pod')!;
  suitHelmet.parent = suitLockerContainer;
  allMeshes.push(suitHelmet);

  // Locker indicator light
  const lockerLight = MeshBuilder.CreateSphere('lockerLight', { diameter: 0.15 }, scene);
  lockerLight.position.set(0, 2.6, 0.35);
  lockerLight.material = materials.get('active')!;
  lockerLight.parent = suitLockerContainer;
  allMeshes.push(lockerLight);

  // Pulsing animation for locker light
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

  // Rack frame
  const rackFrame = MeshBuilder.CreateBox('rackFrame', { width: 3, height: 2, depth: 0.5 }, scene);
  rackFrame.position.y = 1;
  rackFrame.material = materials.get('hull')!;
  rackFrame.parent = weaponRackContainer;
  allMeshes.push(rackFrame);

  // Weapon silhouettes (3 rifles)
  for (let i = 0; i < 3; i++) {
    const rifle = MeshBuilder.CreateBox(
      `rifle_${i}`,
      { width: 0.8, height: 0.15, depth: 0.1 },
      scene
    );
    rifle.position.set(-0.8 + i * 0.8, 1.2, 0.15);
    rifle.material = materials.get('windowFrame')!;
    rifle.parent = weaponRackContainer;
    allMeshes.push(rifle);
  }

  const equipmentRack = rackFrame;

  // Equipment bay lights
  addCeilingLight(
    scene,
    equipmentBayRoom,
    new Vector3(EQUIPMENT_BAY_CENTER.x - 3, EQUIPMENT_BAY.height - 0.2, EQUIPMENT_BAY_CENTER.z),
    new Color3(0.9, 0.95, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );
  addCeilingLight(
    scene,
    equipmentBayRoom,
    new Vector3(EQUIPMENT_BAY_CENTER.x + 3, EQUIPMENT_BAY.height - 0.2, EQUIPMENT_BAY_CENTER.z),
    new Color3(0.9, 0.95, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );

  // ============================================================================
  // SHOOTING RANGE (25m x 10m x 4m) - at end of corridor
  // ============================================================================

  // Floor
  createFloorModule(
    scene,
    shootingRangeRoom,
    SHOOTING_RANGE_CENTER,
    SHOOTING_RANGE.width,
    SHOOTING_RANGE.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Walls
  // Back wall (target wall)
  createWallModule(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x, 0, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2),
    SHOOTING_RANGE.width,
    SHOOTING_RANGE.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  // Left wall
  createWallModule(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x - SHOOTING_RANGE.width / 2, 0, SHOOTING_RANGE_CENTER.z),
    SHOOTING_RANGE.depth,
    SHOOTING_RANGE.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Right wall
  createWallModule(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x + SHOOTING_RANGE.width / 2, 0, SHOOTING_RANGE_CENTER.z),
    SHOOTING_RANGE.depth,
    SHOOTING_RANGE.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Front wall - with door openings
  createWallModule(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x - 8, 0, SHOOTING_RANGE_CENTER.z + SHOOTING_RANGE.depth / 2),
    8,
    SHOOTING_RANGE.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x + 8, 0, SHOOTING_RANGE_CENTER.z + SHOOTING_RANGE.depth / 2),
    8,
    SHOOTING_RANGE.height,
    0,
    materials.get('hull')!,
    allMeshes
  );

  // Ceiling
  createCeilingModule(
    scene,
    shootingRangeRoom,
    SHOOTING_RANGE_CENTER,
    SHOOTING_RANGE.width,
    SHOOTING_RANGE.depth,
    SHOOTING_RANGE.height,
    materials.get('hull')!,
    allMeshes
  );

  // Shooting booth
  const shootingBooth = MeshBuilder.CreateBox(
    'shootingBooth',
    { width: 3, height: 1.2, depth: 1 },
    scene
  );
  shootingBooth.position = new Vector3(SHOOTING_RANGE_CENTER.x, 0.6, SHOOTING_RANGE_CENTER.z + 3);
  shootingBooth.material = materials.get('hull')!;
  shootingBooth.parent = shootingRangeRoom;
  allMeshes.push(shootingBooth);

  // Range indicator light
  const rangeLight = MeshBuilder.CreateSphere('rangeLight', { diameter: 0.12 }, scene);
  rangeLight.position = new Vector3(
    SHOOTING_RANGE_CENTER.x + 1.2,
    1.5,
    SHOOTING_RANGE_CENTER.z + 3.3
  );
  rangeLight.material = materials.get('active')!;
  rangeLight.parent = shootingRangeRoom;
  allMeshes.push(rangeLight);

  // Pulsing animation for range light
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

  // Target backdrop
  const targetBackdrop = MeshBuilder.CreateBox(
    'targetBackdrop',
    { width: 15, height: 3, depth: 0.3 },
    scene
  );
  targetBackdrop.position = new Vector3(
    SHOOTING_RANGE_CENTER.x,
    1.5,
    SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 + 0.5
  );
  targetBackdrop.material = materials.get('windowFrame')!;
  targetBackdrop.parent = shootingRangeRoom;
  allMeshes.push(targetBackdrop);

  // Create holographic targets (initially invisible)
  const targets: Mesh[] = [];
  const targetMaterials: StandardMaterial[] = [];
  const targetPositions = [
    new Vector3(-5, 1.8, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(-2.5, 1.2, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(0, 2.0, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(2.5, 1.0, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 + 1),
    new Vector3(5, 1.6, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 + 1),
  ];

  for (let i = 0; i < 5; i++) {
    // Outer ring
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
    allMeshes.push(targetRing);
    targetMaterials.push(targetMat);

    // Center point
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
    allMeshes.push(targetCenter);
    targetMaterials.push(centerMat);

    targets.push(targetCenter);
    targets.push(targetRing);
  }

  // Shooting range state
  let calibrationActive = false;
  let targetsHit: boolean[] = [false, false, false, false, false];
  let rangeCallbacks: ShootingRangeCallbacks | null = null;

  // Shooting range lights
  addCeilingLight(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x - 6, SHOOTING_RANGE.height - 0.2, SHOOTING_RANGE_CENTER.z),
    new Color3(0.9, 0.95, 1),
    0.5,
    lights,
    materials,
    allMeshes
  );
  addCeilingLight(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x, SHOOTING_RANGE.height - 0.2, SHOOTING_RANGE_CENTER.z),
    new Color3(0.9, 0.95, 1),
    0.5,
    lights,
    materials,
    allMeshes
  );
  addCeilingLight(
    scene,
    shootingRangeRoom,
    new Vector3(SHOOTING_RANGE_CENTER.x + 6, SHOOTING_RANGE.height - 0.2, SHOOTING_RANGE_CENTER.z),
    new Color3(0.9, 0.95, 1),
    0.5,
    lights,
    materials,
    allMeshes
  );

  // Door from shooting range to hangar
  const rangeToHangarDoor = createDoorFrame(
    scene,
    shootingRangeRoom,
    new Vector3(0, 0, SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 - 1),
    0,
    SHOOTING_RANGE.height,
    materials.get('windowFrame')!,
    materials.get('hull')!,
    allMeshes
  );

  // ============================================================================
  // HANGAR BAY (40m x 30m x 12m)
  // ============================================================================

  // Floor
  createFloorModule(
    scene,
    hangarBayRoom,
    HANGAR_BAY_CENTER,
    HANGAR_BAY.width,
    HANGAR_BAY.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Walls
  // Left wall
  createWallModule(
    scene,
    hangarBayRoom,
    new Vector3(HANGAR_BAY_CENTER.x - HANGAR_BAY.width / 2, 0, HANGAR_BAY_CENTER.z),
    HANGAR_BAY.depth,
    HANGAR_BAY.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Right wall
  createWallModule(
    scene,
    hangarBayRoom,
    new Vector3(HANGAR_BAY_CENTER.x + HANGAR_BAY.width / 2, 0, HANGAR_BAY_CENTER.z),
    HANGAR_BAY.depth,
    HANGAR_BAY.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Front wall with entrance (from shooting range)
  createWallModule(
    scene,
    hangarBayRoom,
    new Vector3(HANGAR_BAY_CENTER.x - 12, 0, HANGAR_BAY_CENTER.z + HANGAR_BAY.depth / 2),
    15,
    HANGAR_BAY.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    hangarBayRoom,
    new Vector3(HANGAR_BAY_CENTER.x + 12, 0, HANGAR_BAY_CENTER.z + HANGAR_BAY.depth / 2),
    15,
    HANGAR_BAY.height,
    0,
    materials.get('hull')!,
    allMeshes
  );

  // Ceiling (higher)
  createCeilingModule(
    scene,
    hangarBayRoom,
    HANGAR_BAY_CENTER,
    HANGAR_BAY.width,
    HANGAR_BAY.depth,
    HANGAR_BAY.height,
    materials.get('hull')!,
    allMeshes
  );

  // === HANGAR BAY WINDOWS ===
  // Large observation windows on the side walls showing the planet below
  const hangarWindowHeight = 6;
  const hangarWindowWidth = 8;
  const hangarWindowY = hangarWindowHeight / 2 + 1.5; // Higher up for better view

  // Left wall windows (west)
  createSpaceWindow(
    scene,
    hangarBayRoom,
    new Vector3(
      HANGAR_BAY_CENTER.x - HANGAR_BAY.width / 2 + 0.1,
      hangarWindowY,
      HANGAR_BAY_CENTER.z + 6
    ),
    hangarWindowWidth,
    hangarWindowHeight,
    Math.PI / 2,
    materials,
    allMeshes
  );

  createSpaceWindow(
    scene,
    hangarBayRoom,
    new Vector3(
      HANGAR_BAY_CENTER.x - HANGAR_BAY.width / 2 + 0.1,
      hangarWindowY,
      HANGAR_BAY_CENTER.z - 6
    ),
    hangarWindowWidth,
    hangarWindowHeight,
    Math.PI / 2,
    materials,
    allMeshes
  );

  // Right wall windows (east)
  createSpaceWindow(
    scene,
    hangarBayRoom,
    new Vector3(
      HANGAR_BAY_CENTER.x + HANGAR_BAY.width / 2 - 0.1,
      hangarWindowY,
      HANGAR_BAY_CENTER.z + 6
    ),
    hangarWindowWidth,
    hangarWindowHeight,
    -Math.PI / 2,
    materials,
    allMeshes
  );

  createSpaceWindow(
    scene,
    hangarBayRoom,
    new Vector3(
      HANGAR_BAY_CENTER.x + HANGAR_BAY.width / 2 - 0.1,
      hangarWindowY,
      HANGAR_BAY_CENTER.z - 6
    ),
    hangarWindowWidth,
    hangarWindowHeight,
    -Math.PI / 2,
    materials,
    allMeshes
  );

  // === BAY DOORS ===
  const bayDoorHeight = HANGAR_BAY.height;
  const bayDoorWidth = HANGAR_BAY.width / 2;

  // Left bay door
  const bayDoorLeft = MeshBuilder.CreateBox(
    'bayDoorLeft',
    { width: bayDoorWidth, height: bayDoorHeight, depth: 0.5 },
    scene
  );
  bayDoorLeft.position = new Vector3(
    HANGAR_BAY_CENTER.x - bayDoorWidth / 2,
    bayDoorHeight / 2,
    HANGAR_BAY_CENTER.z - HANGAR_BAY.depth / 2
  );
  bayDoorLeft.material = materials.get('hull')!;
  bayDoorLeft.parent = hangarBayRoom;
  allMeshes.push(bayDoorLeft);

  // Right bay door
  const bayDoorRight = MeshBuilder.CreateBox(
    'bayDoorRight',
    { width: bayDoorWidth, height: bayDoorHeight, depth: 0.5 },
    scene
  );
  bayDoorRight.position = new Vector3(
    HANGAR_BAY_CENTER.x + bayDoorWidth / 2,
    bayDoorHeight / 2,
    HANGAR_BAY_CENTER.z - HANGAR_BAY.depth / 2
  );
  bayDoorRight.material = materials.get('hull')!;
  bayDoorRight.parent = hangarBayRoom;
  allMeshes.push(bayDoorRight);

  // Caution stripes on bay doors
  for (let y = 2; y < bayDoorHeight - 1; y += 2) {
    for (const door of [bayDoorLeft, bayDoorRight]) {
      const stripe = MeshBuilder.CreateBox(
        'stripe',
        { width: bayDoorWidth - 0.5, height: 0.4, depth: 0.52 },
        scene
      );
      stripe.position.set(0, y - bayDoorHeight / 2, 0);
      stripe.material = y % 4 < 2 ? materials.get('caution')! : materials.get('emergency')!;
      stripe.parent = door;
      allMeshes.push(stripe);
    }
  }

  // === DROP POD ===
  const podPosition = ROOM_POSITIONS.dropPod.clone();

  // Platform
  const platform = MeshBuilder.CreateCylinder(
    'platform',
    { height: 0.3, diameter: 6, tessellation: 16 },
    scene
  );
  platform.position = new Vector3(podPosition.x, 0.15, podPosition.z);
  platform.material = materials.get('hull')!;
  platform.parent = hangarBayRoom;
  allMeshes.push(platform);

  // Drop pod body
  const dropPod = MeshBuilder.CreateCylinder(
    'podBody',
    { height: 3, diameter: 2.5, tessellation: 12 },
    scene
  );
  dropPod.position = new Vector3(podPosition.x, 1.8, podPosition.z);
  dropPod.material = materials.get('pod')!;
  dropPod.parent = hangarBayRoom;
  allMeshes.push(dropPod);

  // Pod cone (top)
  const podCone = MeshBuilder.CreateCylinder(
    'podCone',
    { height: 1.5, diameterTop: 0, diameterBottom: 2.5, tessellation: 12 },
    scene
  );
  podCone.position = new Vector3(podPosition.x, 4.05, podPosition.z);
  podCone.material = materials.get('pod')!;
  podCone.parent = hangarBayRoom;
  allMeshes.push(podCone);

  // Pod status lights
  for (let i = 0; i < 3; i++) {
    const statusLight = MeshBuilder.CreateSphere(`podStatus_${i}`, { diameter: 0.12 }, scene);
    statusLight.position = new Vector3(podPosition.x - 0.5 + i * 0.5, 3.2, podPosition.z + 1.28);
    statusLight.material = materials.get('active')!;
    statusLight.parent = hangarBayRoom;
    allMeshes.push(statusLight);
  }

  // "HELL-7" text on pod (simple box approximation)
  const podLabel = MeshBuilder.CreatePlane('podLabel', { width: 1.5, height: 0.4 }, scene);
  podLabel.position = new Vector3(podPosition.x, 2.5, podPosition.z + 1.26);
  const labelMat = new StandardMaterial('labelMat', scene);
  labelMat.emissiveColor = new Color3(0.8, 0.7, 0.2);
  labelMat.diffuseColor = Color3.Black();
  podLabel.material = labelMat;
  podLabel.parent = hangarBayRoom;
  allMeshes.push(podLabel);

  // Inner door (airlock between shooting range and hangar)
  const innerDoor = rangeToHangarDoor.door;

  // Hangar bay lights (industrial orange)
  for (let x = -12; x <= 12; x += 12) {
    for (let z = HANGAR_BAY_CENTER.z + 8; z >= HANGAR_BAY_CENTER.z - 8; z -= 8) {
      addCeilingLight(
        scene,
        hangarBayRoom,
        new Vector3(x, HANGAR_BAY.height - 0.3, z),
        new Color3(1, 0.8, 0.6),
        0.7,
        lights,
        materials,
        allMeshes
      );
    }
  }

  // Viewport placeholder
  const viewport = MeshBuilder.CreateBox(
    'viewport',
    { width: 0.1, height: 0.1, depth: 0.1 },
    scene
  );
  viewport.position = new Vector3(
    HANGAR_BAY_CENTER.x,
    0,
    HANGAR_BAY_CENTER.z - HANGAR_BAY.depth / 2
  );
  viewport.isVisible = false;
  viewport.parent = hangarBayRoom;
  allMeshes.push(viewport);

  // Door status lights
  const doorLightLeft = MeshBuilder.CreateSphere('doorLightL', { diameter: 0.2 }, scene);
  doorLightLeft.position = new Vector3(
    -3,
    SHOOTING_RANGE.height - 0.5,
    SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 - 0.5
  );
  doorLightLeft.material = materials.get('active')!;
  doorLightLeft.parent = shootingRangeRoom;
  allMeshes.push(doorLightLeft);

  const doorLightRight = MeshBuilder.CreateSphere('doorLightR', { diameter: 0.2 }, scene);
  doorLightRight.position = new Vector3(
    3,
    SHOOTING_RANGE.height - 0.5,
    SHOOTING_RANGE_CENTER.z - SHOOTING_RANGE.depth / 2 - 0.5
  );
  doorLightRight.material = materials.get('active')!;
  doorLightRight.parent = shootingRangeRoom;
  allMeshes.push(doorLightRight);

  // ============================================================================
  // ANIMATION FUNCTIONS
  // ============================================================================

  const playEquipSuit = (callback: () => void) => {
    const fadeAnim = new Animation(
      'fadeOut',
      'visibility',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
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
    const redPulse = new Animation(
      'redPulse',
      'material.emissiveColor',
      30,
      Animation.ANIMATIONTYPE_COLOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
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
    const doorOpenLeft = new Animation(
      'doorOpenL',
      'position.x',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    doorOpenLeft.setKeys([
      { frame: 0, value: bayDoorLeft.position.x },
      { frame: 90, value: bayDoorLeft.position.x - bayDoorWidth - 2 },
    ]);

    const doorOpenRight = new Animation(
      'doorOpenR',
      'position.x',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
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
    const podDrop = new Animation(
      'podDrop',
      'position.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    podDrop.setKeys([
      { frame: 0, value: dropPod.position.y },
      { frame: 10, value: dropPod.position.y - 0.5 },
      { frame: 60, value: dropPod.position.y - 100 },
    ]);

    const coneDrop = new Animation(
      'coneDrop',
      'position.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
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
        // Platforming room door - placeholder for when door is implemented
        // For now, this is a no-op as the platforming room may use open doorways
        break;
    }

    if (!door) return;

    const slideAnim = new Animation(
      'doorSlide',
      'position.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    slideAnim.setKeys([
      { frame: 0, value: door.position.y },
      { frame: 30, value: door.position.y + 3 },
    ]);
    door.animations = [slideAnim];
    scene.beginAnimation(door, 0, 30, false);
  };

  // ============================================================================
  // SCENIC ROOMS (Observation Deck, Mess Hall, Recreation Room)
  // ============================================================================
  // These rooms add atmosphere and world-building without gameplay mechanics.
  // They branch off from Corridor A via a scenic side corridor.
  // Players can optionally explore these areas between tutorial objectives.
  // ============================================================================
  const scenicRooms = createScenicRooms(scene);
  scenicRooms.root.parent = root;

  // Add scenic room lights to the main lights array
  lights.push(...scenicRooms.lights);

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
    // Dispose curved corridors
    Object.values(curvedCorridors).forEach((corridor) => {
      corridor.dispose();
    });
    // Dispose scenic rooms
    scenicRooms.dispose();
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
      // Scenic rooms (optional exploration areas)
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
    // Platforming room methods (wired from platformingRoom.ts)
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
