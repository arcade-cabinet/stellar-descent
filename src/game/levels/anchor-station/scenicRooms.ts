import { Animation } from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Animations/animatable';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';

// ============================================================================
// Scenic Rooms for Anchor Station
// ============================================================================
// These rooms add atmosphere and world-building without gameplay mechanics.
// They branch off from Corridor A via a curved side corridor.
//
// Layout (side path from main corridor):
// CORRIDOR A -> SCENIC CORRIDOR -> OBSERVATION DECK
//                      |
//               MESS HALL / CANTEEN
//                      |
//               RECREATION ROOM
// ============================================================================

// Room dimensions (all in meters)
const SCENIC_CORRIDOR = { width: 3, depth: 18, height: 3 };
const OBSERVATION_DECK = { width: 16, depth: 10, height: 4 };
const MESS_HALL = { width: 14, depth: 12, height: 3.5 };
const RECREATION_ROOM = { width: 10, depth: 8, height: 3 };

// Connection point from main Corridor A (left side, near start)
const CORRIDOR_A_CENTER_Z = -22.5; // From environment.ts CORRIDOR_A_CENTER
const SCENIC_BRANCH_Z = CORRIDOR_A_CENTER_Z + 8;

// Scenic corridor starts from left wall of Corridor A
const SCENIC_CORRIDOR_CENTER = new Vector3(-5, 0, SCENIC_BRANCH_Z);
const OBSERVATION_CENTER = new Vector3(-5, 0, SCENIC_BRANCH_Z + SCENIC_CORRIDOR.depth / 2 + 3);
const MESS_CENTER = new Vector3(-12, 0, SCENIC_BRANCH_Z + 6);
const RECREATION_CENTER = new Vector3(-12, 0, SCENIC_BRANCH_Z - 2);

// Export positions for potential player exploration
export const SCENIC_ROOM_POSITIONS = {
  scenicCorridor: SCENIC_CORRIDOR_CENTER.clone(),
  observationDeck: OBSERVATION_CENTER.clone(),
  messHall: MESS_CENTER.clone(),
  recreationRoom: RECREATION_CENTER.clone(),
};

export interface ScenicRoomsResult {
  root: TransformNode;
  rooms: {
    scenicCorridor: TransformNode;
    observationDeck: TransformNode;
    messHall: TransformNode;
    recreationRoom: TransformNode;
  };
  lights: PointLight[];
  dispose: () => void;
}

// ============================================================================
// GLB Asset Paths for Scenic Rooms
// ============================================================================

const SCENIC_MODELS = {
  // Floor/ceiling
  floorCeiling1: '/assets/models/environment/station/floor_ceiling_hr_1.glb',
  floorCeilingRtx1: '/assets/models/environment/station/floor_ceiling_rtx_1.glb',

  // Walls
  wallSingle: '/assets/models/environment/station/wall_hr_1.glb',
  wallDouble: '/assets/models/environment/station/wall_hr_1_double.glb',
  wallHole: '/assets/models/environment/station/wall_hr_1_hole_1.glb',

  // Doorways
  doorway: '/assets/models/environment/station/doorway_hr_1.glb',
  doorway2: '/assets/models/environment/station/doorway_hr_2_regular.glb',

  // Windows
  window1: '/assets/models/environment/station/window_hr_1.glb',
  window2: '/assets/models/environment/station/window_hr_2.glb',

  // Pillars / columns
  pillar2: '/assets/models/environment/station/pillar_hr_2.glb',
  modColumn1: '/assets/models/environment/modular/Column_1.glb',
  modColumnSlim: '/assets/models/environment/modular/Column_Slim.glb',

  // Roof
  modRoofPlate: '/assets/models/environment/modular/RoofTile_Plate.glb',
  modRoofVents: '/assets/models/environment/modular/RoofTile_SmallVents.glb',

  // Modular floor
  modFloorBasic: '/assets/models/environment/modular/FloorTile_Basic.glb',
  modFloorBasic2: '/assets/models/environment/modular/FloorTile_Basic2.glb',

  // Beams / pipes
  beamHorizontal1: '/assets/models/environment/station/beam_hc_horizontal_1.glb',
  pipe1: '/assets/models/environment/station/pipe_cx_1.glb',

  // Modular props
  modComputer: '/assets/models/environment/modular/Props_Computer.glb',
  modComputerSmall: '/assets/models/environment/modular/Props_ComputerSmall.glb',
  modShelf: '/assets/models/environment/modular/Props_Shelf.glb',
  modShelfTall: '/assets/models/environment/modular/Props_Shelf_Tall.glb',
  modCrate: '/assets/models/environment/modular/Props_Crate.glb',
  modCrateLong: '/assets/models/environment/modular/Props_CrateLong.glb',
  modChest: '/assets/models/environment/modular/Props_Chest.glb',
  modBase: '/assets/models/environment/modular/Props_Base.glb',
  modVessel: '/assets/models/environment/modular/Props_Vessel.glb',
  modVesselShort: '/assets/models/environment/modular/Props_Vessel_Short.glb',
  modPod: '/assets/models/environment/modular/Props_Pod.glb',
  modStatue: '/assets/models/environment/modular/Props_Statue.glb',

  // Details
  modVent1: '/assets/models/environment/modular/Details_Vent_1.glb',
  modVent2: '/assets/models/environment/modular/Details_Vent_2.glb',
  modPlateLarge: '/assets/models/environment/modular/Details_Plate_Large.glb',
  modPlateSmall: '/assets/models/environment/modular/Details_Plate_Small.glb',

  // Industrial props
  barrel1: '/assets/models/props/industrial/metal_barrel_hr_1.glb',
  barrel2: '/assets/models/props/industrial/metal_barrel_hr_2.glb',
  bench: '/assets/models/props/furniture/bench_mx_1.glb',
  lamp1: '/assets/models/props/industrial/lamp_mx_1_a_on.glb',
  lamp2: '/assets/models/props/industrial/lamp_mx_2_on.glb',

  // Station door
  stationDoor: '/assets/models/environment/station/station_door.glb',

  // NPC models (marines standing around)
  npcMarine: '/assets/models/npcs/marine/marine_soldier.glb',
  npcMarineSergeant: '/assets/models/npcs/marine/marine_sergeant.glb',
};

// ============================================================================
// GLB Loading Utility (via AssetManager)
// ============================================================================

/**
 * Preload all unique model paths via AssetManager so instances can
 * be created synchronously during room construction.
 */
async function preloadModels(scene: Scene, paths: string[]): Promise<void> {
  const unique = [...new Set(paths)];
  await Promise.allSettled(unique.map((p) => AssetManager.loadAssetByPath(p, scene)));
}

/**
 * Place a GLB model at the given position/rotation/scale using
 * AssetManager instancing (no local cache needed).
 */
function placeGLBInstance(
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
): TransformNode {
  const instance = AssetManager.createInstanceByPath(modelPath, name, scene, true, 'environment');

  if (instance) {
    instance.position = position;
    instance.rotation = rotation;
    instance.scaling = scale;
    instance.parent = parent;

    // Configure mesh properties on all child meshes
    const children = instance.getChildMeshes();
    for (const mesh of children) {
      mesh.receiveShadows = receiveShadows;
      mesh.checkCollisions = checkCollisions;
      allMeshes.push(mesh);
    }

    return instance;
  }

  throw new Error(`[ScenicRooms] Failed to create instance for ${modelPath} (${name})`);
}

/** Place model shorthand (collisions enabled). */
function placeModel(
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
): TransformNode {
  return placeGLBInstance(
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

/** Place prop shorthand (no collisions). */
function placeProp(
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
): TransformNode {
  return placeGLBInstance(
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Add a ceiling-mounted point light for indoor illumination.
 * @param scene - The Babylon scene
 * @param parent - The parent transform node (unused but kept for API consistency)
 * @param position - World position of the light
 * @param color - Light color
 * @param intensity - Light intensity (0-1)
 * @param lights - Array to track all lights for disposal
 * @param range - Light range in meters (default: 15)
 */
function addCeilingLight(
  scene: Scene,
  _parent: TransformNode, // Kept for potential future parenting
  position: Vector3,
  color: Color3,
  intensity: number,
  lights: PointLight[],
  range: number = 15
): PointLight {
  const light = new PointLight(`ceilingLight_${lights.length}`, position.clone(), scene);
  light.diffuse = color;
  light.specular = color.scale(0.5); // Half intensity specular
  light.intensity = intensity;
  light.range = range;
  lights.push(light);

  return light;
}

// ============================================================================
// Create Scenic Materials (extended from station materials)
// ============================================================================

function createScenicMaterials(scene: Scene): Map<string, StandardMaterial> {
  const materials = new Map<string, StandardMaterial>();

  // Observation window - deep blue, semi-transparent
  const windowMat = new StandardMaterial('obsWindowMat', scene);
  windowMat.diffuseColor = Color3.FromHexString('#0A1520');
  windowMat.alpha = 0.15;
  windowMat.specularColor = new Color3(0.9, 0.95, 1.0);
  windowMat.specularPower = 128;
  windowMat.backFaceCulling = false;
  materials.set('window', windowMat);

  // Window frame - darker metal
  const frameMat = new StandardMaterial('scenicFrameMat', scene);
  frameMat.diffuseColor = Color3.FromHexString('#0D0F11');
  frameMat.specularColor = new Color3(0.4, 0.4, 0.4);
  materials.set('frame', frameMat);

  // Planet view (for observation window backdrop)
  const planetMat = new StandardMaterial('planetMat', scene);
  planetMat.emissiveColor = Color3.FromHexString('#1A3050');
  planetMat.diffuseColor = Color3.FromHexString('#0A1525');
  materials.set('planet', planetMat);

  // Stars backdrop
  const starsMat = new StandardMaterial('starsMat', scene);
  starsMat.emissiveColor = new Color3(0.02, 0.02, 0.04);
  starsMat.diffuseColor = Color3.Black();
  materials.set('stars', starsMat);

  // NPC uniform - olive drab
  const uniformMat = new StandardMaterial('uniformMat', scene);
  uniformMat.diffuseColor = Color3.FromHexString('#4A5040');
  uniformMat.specularColor = new Color3(0.1, 0.1, 0.08);
  materials.set('uniform', uniformMat);

  // NPC skin tone
  const skinMat = new StandardMaterial('skinMat', scene);
  skinMat.diffuseColor = Color3.FromHexString('#8B7355');
  skinMat.specularColor = new Color3(0.15, 0.12, 0.1);
  materials.set('skin', skinMat);

  // Screen/display - blue glow
  const screenMat = new StandardMaterial('scenicScreenMat', scene);
  screenMat.emissiveColor = Color3.FromHexString('#003366');
  screenMat.diffuseColor = Color3.FromHexString('#001122');
  materials.set('screen', screenMat);

  return materials;
}

// ============================================================================
// Observation Deck
// ============================================================================
// Large curved window wall showing planet view
// Comfortable seating, plants, soft ambient lighting
// Static NPCs looking out window

async function createObservationDeck(
  scene: Scene,
  parent: TransformNode,
  materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: AbstractMesh[]
): Promise<TransformNode> {
  const room = new TransformNode('observationDeck', scene);
  room.parent = parent;

  const P = SCENIC_MODELS;
  const OC = OBSERVATION_CENTER;

  // Preload all GLB models used in this room (including NPC models)
  await preloadModels(scene, [
    P.floorCeiling1,
    P.modRoofVents,
    P.modRoofPlate,
    P.wallSingle,
    P.wallDouble,
    P.doorway2,
    P.window1,
    P.modColumn1,
    P.beamHorizontal1,
    P.pipe1,
    P.bench,
    P.modVesselShort,
    P.modVessel,
    P.lamp1,
    P.lamp2,
    P.modVent1,
    P.modVent2,
    P.modPlateLarge,
    P.npcMarine,
    P.npcMarineSergeant,
  ]);

  // --- Floor tiles (4m grid coverage for 16x10 room) ---
  for (let fx = -6; fx <= 6; fx += 4) {
    for (let fz = -4; fz <= 4; fz += 4) {
      placeModel(
        scene,
        P.floorCeiling1,
        `od_floor_${fx}_${fz}`,
        room,
        OC.x + fx,
        -0.05,
        OC.z + fz,
        0,
        1,
        allMeshes
      );
    }
  }

  // --- Ceiling roof plates ---
  for (let cx = -6; cx <= 6; cx += 4) {
    for (let cz = -4; cz <= 4; cz += 4) {
      const isVent = cx === 0 && cz === 0;
      placeModel(
        scene,
        isVent ? P.modRoofVents : P.modRoofPlate,
        `od_ceil_${cx}_${cz}`,
        room,
        OC.x + cx,
        OBSERVATION_DECK.height,
        OC.z + cz,
        0,
        1,
        allMeshes
      );
    }
  }

  // --- Walls (station wall panels) ---
  // Side walls (left and right)
  for (let wz = -4; wz <= 4; wz += 4) {
    placeModel(
      scene,
      P.wallSingle,
      `od_wall_l_${wz}`,
      room,
      OC.x - OBSERVATION_DECK.width / 2,
      0,
      OC.z + wz,
      Math.PI / 2,
      1,
      allMeshes
    );
    placeModel(
      scene,
      P.wallSingle,
      `od_wall_r_${wz}`,
      room,
      OC.x + OBSERVATION_DECK.width / 2,
      0,
      OC.z + wz,
      -Math.PI / 2,
      1,
      allMeshes
    );
  }

  // Back wall (with entrance from scenic corridor)
  placeModel(
    scene,
    P.wallDouble,
    'od_wall_back_l',
    room,
    OC.x - 5,
    0,
    OC.z - OBSERVATION_DECK.depth / 2,
    Math.PI,
    1,
    allMeshes
  );
  placeModel(
    scene,
    P.wallDouble,
    'od_wall_back_r',
    room,
    OC.x + 5,
    0,
    OC.z - OBSERVATION_DECK.depth / 2,
    Math.PI,
    1,
    allMeshes
  );
  // Doorway frame at back entrance
  placeModel(
    scene,
    P.doorway2,
    'od_door_back',
    room,
    OC.x,
    0,
    OC.z - OBSERVATION_DECK.depth / 2,
    Math.PI,
    1,
    allMeshes
  );

  // --- Windows along front wall (observation windows) ---
  for (let wx = -4; wx <= 4; wx += 4) {
    placeModel(
      scene,
      P.window1,
      `od_win_front_${wx}`,
      room,
      OC.x + wx,
      0.5,
      OC.z + OBSERVATION_DECK.depth / 2 - 0.2,
      0,
      1,
      allMeshes
    );
  }

  // --- Window frame wall sections alongside the windows ---
  placeModel(
    scene,
    P.wallSingle,
    'od_wall_front_l',
    room,
    OC.x - 6,
    0,
    OC.z + OBSERVATION_DECK.depth / 2,
    0,
    1,
    allMeshes
  );
  placeModel(
    scene,
    P.wallSingle,
    'od_wall_front_r',
    room,
    OC.x + 6,
    0,
    OC.z + OBSERVATION_DECK.depth / 2,
    0,
    1,
    allMeshes
  );

  // --- Pillars at room corners ---
  placeProp(scene, P.modColumn1, 'od_col_nw', room, OC.x - 7, 0, OC.z + 4, 0, 1, allMeshes);
  placeProp(scene, P.modColumn1, 'od_col_ne', room, OC.x + 7, 0, OC.z + 4, 0, 1, allMeshes);
  placeProp(scene, P.modColumn1, 'od_col_sw', room, OC.x - 7, 0, OC.z - 4, 0, 1, allMeshes);
  placeProp(scene, P.modColumn1, 'od_col_se', room, OC.x + 7, 0, OC.z - 4, 0, 1, allMeshes);

  // --- Ceiling beams ---
  placeProp(
    scene,
    P.beamHorizontal1,
    'od_beam_1',
    room,
    OC.x,
    OBSERVATION_DECK.height - 0.3,
    OC.z,
    0,
    1,
    allMeshes
  );

  // --- Ceiling pipes ---
  placeProp(
    scene,
    P.pipe1,
    'od_pipe_1',
    room,
    OC.x - 3,
    OBSERVATION_DECK.height - 0.15,
    OC.z,
    0,
    1,
    allMeshes
  );

  // --- Seating: benches for couches ---
  placeProp(scene, P.bench, 'od_bench_1', room, OC.x - 4, 0, OC.z + 1.5, 0, 1, allMeshes);
  placeProp(scene, P.bench, 'od_bench_2', room, OC.x, 0, OC.z + 1.5, 0, 1, allMeshes);
  placeProp(scene, P.bench, 'od_bench_3', room, OC.x + 4, 0, OC.z + 1.5, 0, 1, allMeshes);
  // Side chairs
  placeProp(scene, P.bench, 'od_chair_l', room, OC.x - 5, 0, OC.z - 1, 0.3, 0.7, allMeshes);
  placeProp(scene, P.bench, 'od_chair_r', room, OC.x + 5, 0, OC.z - 1, -0.3, 0.7, allMeshes);

  // --- Plants: vessels as planters ---
  placeProp(scene, P.modVesselShort, 'od_plant_1', room, OC.x - 6, 0, OC.z + 3, 0, 1.2, allMeshes);
  placeProp(scene, P.modVesselShort, 'od_plant_2', room, OC.x + 6, 0, OC.z + 3, 0, 1, allMeshes);
  placeProp(scene, P.modVessel, 'od_plant_3', room, OC.x - 3, 0, OC.z - 3, 0, 0.8, allMeshes);
  placeProp(scene, P.modVessel, 'od_plant_4', room, OC.x + 3, 0, OC.z - 3, 0, 0.9, allMeshes);

  // --- Lamps on ceiling ---
  placeProp(
    scene,
    P.lamp1,
    'od_lamp_1',
    room,
    OC.x - 4,
    OBSERVATION_DECK.height - 0.3,
    OC.z,
    0,
    1,
    allMeshes
  );
  placeProp(
    scene,
    P.lamp2,
    'od_lamp_2',
    room,
    OC.x + 4,
    OBSERVATION_DECK.height - 0.3,
    OC.z,
    0,
    1,
    allMeshes
  );

  // --- Wall vents ---
  placeProp(scene, P.modVent1, 'od_vent_1', room, OC.x - 7.5, 3.2, OC.z, Math.PI / 2, 1, allMeshes);
  placeProp(
    scene,
    P.modVent2,
    'od_vent_2',
    room,
    OC.x + 7.5,
    3.2,
    OC.z,
    -Math.PI / 2,
    1,
    allMeshes
  );

  // --- Wall detail plates ---
  placeProp(
    scene,
    P.modPlateLarge,
    'od_plate_1',
    room,
    OC.x - 3,
    OBSERVATION_DECK.height - 0.1,
    OC.z + 2,
    0,
    1,
    allMeshes
  );

  // === PLANET VIEW (outside window) - keep as MeshBuilder (no GLB for cosmic sphere) ===
  const planetSphere = MeshBuilder.CreateSphere(
    'keplerPlanet',
    { diameter: 30, segments: 24 },
    scene
  );
  planetSphere.position = new Vector3(OC.x + 5, -8, OC.z + OBSERVATION_DECK.depth / 2 + 40);
  planetSphere.material = materials.get('planet')!;
  planetSphere.parent = room;

  // Stars backdrop - keep as MeshBuilder (backdrop plane)
  const starsBackdrop = MeshBuilder.CreateBox(
    'starsBackdrop',
    { width: 100, height: 50, depth: 0.1 },
    scene
  );
  starsBackdrop.position = new Vector3(OC.x, 10, OC.z + OBSERVATION_DECK.depth / 2 + 80);
  starsBackdrop.material = materials.get('stars')!;
  starsBackdrop.parent = room;

  // === STATIC NPCs (crew members looking out window) - using GLB marine models ===
  const npcPositions = [
    { x: -3, z: 2.5, rot: 0, model: P.npcMarine },
    { x: 1, z: 2.8, rot: 0.1, model: P.npcMarineSergeant },
  ];
  for (let i = 0; i < npcPositions.length; i++) {
    const np = npcPositions[i];
    // Try GLB model first, fallback to MeshBuilder capsule
    const npcVisual = placeGLBInstance(
      scene,
      np.model,
      `npc_${i}_visual`,
      room,
      new Vector3(OC.x + np.x, 0, OC.z + np.z),
      new Vector3(0, np.rot, 0),
      new Vector3(0.01, 0.01, 0.01), // Scale down marine models
      allMeshes,
      true,
      false
    );
    if (!npcVisual || npcVisual.getChildMeshes().length === 0) {
      throw new Error(`[ScenicRooms] Failed to create NPC instance for ${np.model}`);
    }
  }

  // === AMBIENT LIGHTING (soft, warm) ===
  addCeilingLight(
    scene,
    room,
    new Vector3(OC.x - 4, OBSERVATION_DECK.height - 0.2, OC.z),
    new Color3(1.0, 0.95, 0.85),
    0.4,
    lights
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(OC.x + 4, OBSERVATION_DECK.height - 0.2, OC.z),
    new Color3(1.0, 0.95, 0.85),
    0.4,
    lights
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(OC.x, OBSERVATION_DECK.height - 0.2, OC.z - 2),
    new Color3(0.9, 0.92, 1.0),
    0.35,
    lights
  );

  return room;
}

// ============================================================================
// Mess Hall / Canteen
// ============================================================================
// Long tables with benches, food dispensers, abandoned trays
// Kitchen area visible, screens showing news/propaganda
// Shows normal station life interrupted

async function createMessHall(
  scene: Scene,
  parent: TransformNode,
  materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: AbstractMesh[]
): Promise<TransformNode> {
  const room = new TransformNode('messHall', scene);
  room.parent = parent;

  const placedNodes: TransformNode[] = [];
  const P = SCENIC_MODELS;
  const MC = MESS_CENTER;

  // --- Floor tiles ---
  for (let fx = -6; fx <= 6; fx += 4) {
    for (let fz = -4; fz <= 4; fz += 4) {
      placedNodes.push(
        placeModel(
          scene,
          P.floorCeiling1,
          `mh_floor_${fx}_${fz}`,
          room,
          MC.x + fx,
          -0.05,
          MC.z + fz,
          0,
          1,
          allMeshes
        )
      );
    }
  }

  // --- Ceiling roof plates ---
  for (let cx = -6; cx <= 6; cx += 4) {
    for (let cz = -4; cz <= 4; cz += 4) {
      placedNodes.push(
        placeModel(
          scene,
          P.modRoofPlate,
          `mh_ceil_${cx}_${cz}`,
          room,
          MC.x + cx,
          MESS_HALL.height,
          MC.z + cz,
          0,
          1,
          allMeshes
        )
      );
    }
  }

  // --- Walls ---
  // Back wall
  for (let wx = -6; wx <= 6; wx += 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.wallDouble,
        `mh_wall_back_${wx}`,
        room,
        MC.x + wx,
        0,
        MC.z + MESS_HALL.depth / 2,
        0,
        1,
        allMeshes
      )
    );
  }
  // Front wall (with door opening to corridor)
  placedNodes.push(
    placeModel(
      scene,
      P.wallDouble,
      'mh_wall_front_l',
      room,
      MC.x - 4,
      0,
      MC.z - MESS_HALL.depth / 2,
      Math.PI,
      1,
      allMeshes
    )
  );
  placedNodes.push(
    placeModel(
      scene,
      P.wallDouble,
      'mh_wall_front_r',
      room,
      MC.x + 4,
      0,
      MC.z - MESS_HALL.depth / 2,
      Math.PI,
      1,
      allMeshes
    )
  );
  placedNodes.push(
    placeModel(
      scene,
      P.doorway,
      'mh_door_front',
      room,
      MC.x,
      0,
      MC.z - MESS_HALL.depth / 2,
      Math.PI,
      1,
      allMeshes
    )
  );

  // Left wall (with kitchen window opening)
  for (let wz = -4; wz <= 4; wz += 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.wallSingle,
        `mh_wall_l_${wz}`,
        room,
        MC.x - MESS_HALL.width / 2,
        0,
        MC.z + wz,
        Math.PI / 2,
        1,
        allMeshes
      )
    );
  }
  // Window on left wall
  placedNodes.push(
    placeModel(
      scene,
      P.window1,
      'mh_win_kitchen',
      room,
      MC.x - MESS_HALL.width / 2 + 0.2,
      0.5,
      MC.z + 1,
      Math.PI / 2,
      1,
      allMeshes
    )
  );
  // Right wall
  for (let wz = -4; wz <= 4; wz += 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.wallSingle,
        `mh_wall_r_${wz}`,
        room,
        MC.x + MESS_HALL.width / 2,
        0,
        MC.z + wz,
        -Math.PI / 2,
        1,
        allMeshes
      )
    );
  }

  // --- Kitchen counter (visible through window) - use crate long as counter ---
  placedNodes.push(
    placeProp(
      scene,
      P.modCrateLong,
      'mh_counter',
      room,
      MC.x - MESS_HALL.width / 2 - 0.6,
      0,
      MC.z + 1,
      Math.PI / 2,
      1,
      allMeshes
    )
  );

  // --- Long tables: use shelves laid horizontal or crate-long as tables ---
  for (let row = 0; row < 2; row++) {
    const rowZ = MC.z - 2 + row * 5;
    placedNodes.push(
      placeProp(
        scene,
        P.modCrateLong,
        `mh_table_${row}`,
        room,
        MC.x + 1,
        0.5,
        rowZ,
        0,
        1.2,
        allMeshes
      )
    );
    // Benches on both sides
    placedNodes.push(
      placeProp(scene, P.bench, `mh_bench_${row}_a`, room, MC.x + 1, 0, rowZ - 1, 0, 1, allMeshes)
    );
    placedNodes.push(
      placeProp(
        scene,
        P.bench,
        `mh_bench_${row}_b`,
        room,
        MC.x + 1,
        0,
        rowZ + 1,
        Math.PI,
        1,
        allMeshes
      )
    );
  }

  // --- Food dispensers on wall: use tall shelves ---
  for (let i = 0; i < 3; i++) {
    placedNodes.push(
      placeProp(
        scene,
        P.modShelfTall,
        `mh_dispenser_${i}`,
        room,
        MC.x + 3 + i * 1.8,
        0,
        MC.z + MESS_HALL.depth / 2 - 0.4,
        0,
        1,
        allMeshes
      )
    );
  }

  // --- Computers as dispenser screens ---
  placedNodes.push(
    placeProp(
      scene,
      P.modComputerSmall,
      'mh_screen_1',
      room,
      MC.x + 3,
      0.8,
      MC.z + MESS_HALL.depth / 2 - 0.6,
      0,
      0.6,
      allMeshes
    )
  );
  placedNodes.push(
    placeProp(
      scene,
      P.modComputerSmall,
      'mh_screen_2',
      room,
      MC.x + 4.8,
      0.8,
      MC.z + MESS_HALL.depth / 2 - 0.6,
      0,
      0.6,
      allMeshes
    )
  );

  // --- Barrels for decoration ---
  placedNodes.push(
    placeProp(scene, P.barrel1, 'mh_barrel_1', room, MC.x - 5, 0, MC.z - 5, 0, 1, allMeshes)
  );

  // --- Wall vents ---
  placedNodes.push(
    placeProp(
      scene,
      P.modVent1,
      'mh_vent_1',
      room,
      MC.x - 6.5,
      2.8,
      MC.z,
      Math.PI / 2,
      1,
      allMeshes
    )
  );
  placedNodes.push(
    placeProp(
      scene,
      P.modVent2,
      'mh_vent_2',
      room,
      MC.x + 6.5,
      2.8,
      MC.z,
      -Math.PI / 2,
      1,
      allMeshes
    )
  );

  // --- Ceiling beams ---
  placedNodes.push(
    placeProp(
      scene,
      P.beamHorizontal1,
      'mh_beam_1',
      room,
      MC.x,
      MESS_HALL.height - 0.3,
      MC.z,
      0,
      1,
      allMeshes
    )
  );

  // --- Lamps ---
  placedNodes.push(
    placeProp(
      scene,
      P.lamp1,
      'mh_lamp_1',
      room,
      MC.x - 3,
      MESS_HALL.height - 0.3,
      MC.z,
      0,
      1,
      allMeshes
    )
  );
  placedNodes.push(
    placeProp(
      scene,
      P.lamp2,
      'mh_lamp_2',
      room,
      MC.x + 3,
      MESS_HALL.height - 0.3,
      MC.z,
      0,
      1,
      allMeshes
    )
  );

  // Wait for all GLB loads
  // All models placed synchronously via createInstanceByPath

  // === NEWS SCREEN (animated plane - keep as MeshBuilder) ===
  const newsScreen = MeshBuilder.CreatePlane('newsScreen', { width: 3, height: 2 }, scene);
  newsScreen.position = new Vector3(MC.x + MESS_HALL.width / 2 - 0.2, 2.0, MC.z);
  newsScreen.rotation.y = -Math.PI / 2;
  newsScreen.material = materials.get('screen')!;
  newsScreen.parent = room;

  // Animate screen with subtle flicker
  const screenFlicker = new Animation(
    'screenFlicker',
    'material.emissiveColor',
    10,
    Animation.ANIMATIONTYPE_COLOR3,
    Animation.ANIMATIONLOOPMODE_CYCLE
  );
  screenFlicker.setKeys([
    { frame: 0, value: Color3.FromHexString('#003366') },
    { frame: 5, value: Color3.FromHexString('#004488') },
    { frame: 8, value: Color3.FromHexString('#002244') },
    { frame: 10, value: Color3.FromHexString('#003366') },
  ]);
  newsScreen.animations.push(screenFlicker);
  scene.beginAnimation(newsScreen, 0, 10, true);

  // === LIGHTING ===
  addCeilingLight(
    scene,
    room,
    new Vector3(MC.x - 2, MESS_HALL.height - 0.2, MC.z - 2),
    new Color3(1.0, 0.98, 0.95),
    0.5,
    lights
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(MC.x + 3, MESS_HALL.height - 0.2, MC.z - 2),
    new Color3(1.0, 0.98, 0.95),
    0.5,
    lights
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(MC.x, MESS_HALL.height - 0.2, MC.z + 3),
    new Color3(1.0, 0.98, 0.95),
    0.5,
    lights
  );

  return room;
}

// ============================================================================
// Recreation Room
// ============================================================================
// Exercise equipment, game table, personal lockers
// Photos/mementos on walls - adds human element

async function createRecreationRoom(
  scene: Scene,
  parent: TransformNode,
  _materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: AbstractMesh[]
): Promise<TransformNode> {
  const room = new TransformNode('recreationRoom', scene);
  room.parent = parent;

  const placedNodes: TransformNode[] = [];
  const P = SCENIC_MODELS;
  const RC = RECREATION_CENTER;

  // --- Floor tiles ---
  for (let fx = -4; fx <= 4; fx += 4) {
    for (let fz = -2; fz <= 2; fz += 4) {
      placedNodes.push(
        placeModel(
          scene,
          P.floorCeiling1,
          `rr_floor_${fx}_${fz}`,
          room,
          RC.x + fx,
          -0.05,
          RC.z + fz,
          0,
          1,
          allMeshes
        )
      );
    }
  }

  // --- Ceiling roof plates ---
  for (let cx = -4; cx <= 4; cx += 4) {
    for (let cz = -2; cz <= 2; cz += 4) {
      placedNodes.push(
        placeModel(
          scene,
          P.modRoofPlate,
          `rr_ceil_${cx}_${cz}`,
          room,
          RC.x + cx,
          RECREATION_ROOM.height,
          RC.z + cz,
          0,
          1,
          allMeshes
        )
      );
    }
  }

  // --- Walls ---
  // Back wall
  for (let wx = -4; wx <= 4; wx += 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.wallSingle,
        `rr_wall_back_${wx}`,
        room,
        RC.x + wx,
        0,
        RC.z + RECREATION_ROOM.depth / 2,
        0,
        1,
        allMeshes
      )
    );
  }
  // Front wall
  for (let wx = -4; wx <= 4; wx += 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.wallSingle,
        `rr_wall_front_${wx}`,
        room,
        RC.x + wx,
        0,
        RC.z - RECREATION_ROOM.depth / 2,
        Math.PI,
        1,
        allMeshes
      )
    );
  }
  // Left wall
  placedNodes.push(
    placeModel(
      scene,
      P.wallSingle,
      'rr_wall_left',
      room,
      RC.x - RECREATION_ROOM.width / 2,
      0,
      RC.z,
      Math.PI / 2,
      1,
      allMeshes
    )
  );
  // Right wall with door opening
  placedNodes.push(
    placeModel(
      scene,
      P.wallSingle,
      'rr_wall_right_top',
      room,
      RC.x + RECREATION_ROOM.width / 2,
      0,
      RC.z - 2,
      Math.PI / 2,
      1,
      allMeshes
    )
  );
  placedNodes.push(
    placeModel(
      scene,
      P.wallSingle,
      'rr_wall_right_bot',
      room,
      RC.x + RECREATION_ROOM.width / 2,
      0,
      RC.z + 2,
      Math.PI / 2,
      1,
      allMeshes
    )
  );
  // Doorway frame on right wall
  placedNodes.push(
    placeModel(
      scene,
      P.doorway,
      'rr_door_right',
      room,
      RC.x + RECREATION_ROOM.width / 2,
      0,
      RC.z,
      -Math.PI / 2,
      1,
      allMeshes
    )
  );

  // --- Exercise equipment: use crates/bases as treadmill and weight bench ---
  placedNodes.push(
    placeProp(scene, P.modCrate, 'rr_treadmill', room, RC.x - 3, 0, RC.z + 2, 0, 1, allMeshes)
  );
  placedNodes.push(
    placeProp(
      scene,
      P.modBase,
      'rr_treadmill_base',
      room,
      RC.x - 3,
      0,
      RC.z + 1.1,
      0,
      0.6,
      allMeshes
    )
  );

  // Weight bench: crate
  placedNodes.push(
    placeProp(
      scene,
      P.modCrateLong,
      'rr_weight_bench',
      room,
      RC.x - 3,
      0,
      RC.z - 2,
      0,
      0.8,
      allMeshes
    )
  );

  // Weight rack: shelf
  placedNodes.push(
    placeProp(scene, P.modShelf, 'rr_weight_rack', room, RC.x - 3.5, 0, RC.z - 3.5, 0, 1, allMeshes)
  );

  // --- Barrels (weights stand-in) ---
  placedNodes.push(
    placeProp(scene, P.barrel1, 'rr_barrel_1', room, RC.x - 4, 0, RC.z - 3.5, 0, 0.5, allMeshes)
  );
  placedNodes.push(
    placeProp(scene, P.barrel2, 'rr_barrel_2', room, RC.x - 3.5, 0, RC.z - 3.5, 0.3, 0.5, allMeshes)
  );

  // --- Game table: use chest as table ---
  placedNodes.push(
    placeProp(scene, P.modChest, 'rr_game_table', room, RC.x + 2, 0, RC.z, 0, 1, allMeshes)
  );

  // --- Chairs around game table: small crates ---
  for (let chair = 0; chair < 3; chair++) {
    const angle = (chair / 3) * Math.PI * 2 + Math.PI / 6;
    placedNodes.push(
      placeProp(
        scene,
        P.modCrate,
        `rr_chair_${chair}`,
        room,
        RC.x + 2 + Math.cos(angle) * 1.1,
        0,
        RC.z + Math.sin(angle) * 1.1,
        angle + Math.PI,
        0.4,
        allMeshes
      )
    );
  }

  // --- Personal lockers: tall shelves ---
  for (let l = 0; l < 4; l++) {
    placedNodes.push(
      placeProp(
        scene,
        P.modShelfTall,
        `rr_locker_${l}`,
        room,
        RC.x + 0.5 + l * 0.9,
        0,
        RC.z + RECREATION_ROOM.depth / 2 - 0.4,
        0,
        0.8,
        allMeshes
      )
    );
  }

  // --- Computers as display screens ---
  placedNodes.push(
    placeProp(
      scene,
      P.modComputerSmall,
      'rr_computer',
      room,
      RC.x - 4,
      0.8,
      RC.z + 3.5,
      0,
      0.6,
      allMeshes
    )
  );

  // --- Wall vents ---
  placedNodes.push(
    placeProp(
      scene,
      P.modVent1,
      'rr_vent_1',
      room,
      RC.x - 4.5,
      2.5,
      RC.z,
      Math.PI / 2,
      1,
      allMeshes
    )
  );

  // --- Detail plates on walls ---
  placedNodes.push(
    placeProp(
      scene,
      P.modPlateSmall,
      'rr_plate_1',
      room,
      RC.x - 4.5,
      1.6,
      RC.z + 3.5,
      Math.PI / 2,
      0.8,
      allMeshes
    )
  );
  placedNodes.push(
    placeProp(
      scene,
      P.modPlateSmall,
      'rr_plate_2',
      room,
      RC.x - 4.5,
      1.8,
      RC.z + 3.2,
      Math.PI / 2,
      0.6,
      allMeshes
    )
  );

  // --- Lamp ---
  placedNodes.push(
    placeProp(
      scene,
      P.lamp1,
      'rr_lamp_1',
      room,
      RC.x,
      RECREATION_ROOM.height - 0.3,
      RC.z,
      0,
      1,
      allMeshes
    )
  );

  // Wait for all GLB loads
  // All models placed synchronously via createInstanceByPath

  // === LIGHTING ===
  addCeilingLight(
    scene,
    room,
    new Vector3(RC.x - 2, RECREATION_ROOM.height - 0.2, RC.z),
    new Color3(1.0, 0.95, 0.9),
    0.45,
    lights
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(RC.x + 2, RECREATION_ROOM.height - 0.2, RC.z),
    new Color3(1.0, 0.95, 0.9),
    0.45,
    lights
  );

  return room;
}

// ============================================================================
// Scenic Corridor (connects main corridor to scenic rooms)
// ============================================================================

async function createScenicCorridor(
  scene: Scene,
  parent: TransformNode,
  _materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: AbstractMesh[]
): Promise<TransformNode> {
  const corridor = new TransformNode('scenicCorridor', scene);
  corridor.parent = parent;

  const placedNodes: TransformNode[] = [];
  const P = SCENIC_MODELS;
  const SC = SCENIC_CORRIDOR_CENTER;

  // --- Floor: corridor segments ---
  for (let cz = SC.z + 6; cz >= SC.z - 6; cz -= 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.floorCeiling1,
        `sc_floor_${cz}`,
        corridor,
        SC.x,
        -0.05,
        cz,
        0,
        1,
        allMeshes
      )
    );
  }

  // --- Ceiling ---
  for (let cz = SC.z + 6; cz >= SC.z - 6; cz -= 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.modRoofPlate,
        `sc_ceil_${cz}`,
        corridor,
        SC.x,
        SCENIC_CORRIDOR.height,
        cz,
        0,
        1,
        allMeshes
      )
    );
  }

  // --- Left wall (solid) ---
  for (let wz = SC.z + 6; wz >= SC.z - 6; wz -= 4) {
    placedNodes.push(
      placeModel(
        scene,
        P.wallSingle,
        `sc_wall_l_${wz}`,
        corridor,
        SC.x - SCENIC_CORRIDOR.width / 2,
        0,
        wz,
        Math.PI / 2,
        1,
        allMeshes
      )
    );
  }

  // --- Right wall (openings for mess hall and recreation room) ---
  placedNodes.push(
    placeModel(
      scene,
      P.wallSingle,
      'sc_wall_r_top',
      corridor,
      SC.x + SCENIC_CORRIDOR.width / 2,
      0,
      SC.z + 6,
      -Math.PI / 2,
      1,
      allMeshes
    )
  );
  placedNodes.push(
    placeModel(
      scene,
      P.wallSingle,
      'sc_wall_r_bot',
      corridor,
      SC.x + SCENIC_CORRIDOR.width / 2,
      0,
      SC.z - 6,
      -Math.PI / 2,
      1,
      allMeshes
    )
  );

  // --- Back wall (entrance from main Corridor A) with doorway ---
  placedNodes.push(
    placeModel(
      scene,
      P.doorway,
      'sc_door_back',
      corridor,
      SC.x,
      0,
      SC.z - SCENIC_CORRIDOR.depth / 2,
      0,
      1,
      allMeshes
    )
  );

  // --- Front wall (opening to observation deck) ---
  placedNodes.push(
    placeModel(
      scene,
      P.doorway2,
      'sc_door_front',
      corridor,
      SC.x,
      0,
      SC.z + SCENIC_CORRIDOR.depth / 2,
      0,
      1,
      allMeshes
    )
  );

  // --- Pipes along ceiling ---
  placedNodes.push(
    placeProp(
      scene,
      P.pipe1,
      'sc_pipe_1',
      corridor,
      SC.x,
      SCENIC_CORRIDOR.height - 0.15,
      SC.z,
      0,
      1,
      allMeshes
    )
  );

  // --- Lamps ---
  placedNodes.push(
    placeProp(
      scene,
      P.lamp1,
      'sc_lamp_1',
      corridor,
      SC.x,
      SCENIC_CORRIDOR.height - 0.3,
      SC.z - 4,
      0,
      1,
      allMeshes
    )
  );
  placedNodes.push(
    placeProp(
      scene,
      P.lamp2,
      'sc_lamp_2',
      corridor,
      SC.x,
      SCENIC_CORRIDOR.height - 0.3,
      SC.z + 4,
      0,
      1,
      allMeshes
    )
  );

  // --- Wall vents ---
  placedNodes.push(
    placeProp(
      scene,
      P.modVent1,
      'sc_vent_1',
      corridor,
      SC.x - SCENIC_CORRIDOR.width / 2 + 0.2,
      2.5,
      SC.z,
      Math.PI / 2,
      0.8,
      allMeshes
    )
  );

  // Wait for all GLB loads
  // All models placed synchronously via createInstanceByPath

  // Corridor lights
  addCeilingLight(
    scene,
    corridor,
    new Vector3(SC.x, SCENIC_CORRIDOR.height - 0.2, SC.z - 4),
    new Color3(0.9, 0.95, 1.0),
    0.4,
    lights
  );
  addCeilingLight(
    scene,
    corridor,
    new Vector3(SC.x, SCENIC_CORRIDOR.height - 0.2, SC.z + 4),
    new Color3(0.9, 0.95, 1.0),
    0.4,
    lights
  );

  return corridor;
}

// ============================================================================
// Main Export: Create All Scenic Rooms (now async for GLB loading)
// ============================================================================

export async function createScenicRooms(scene: Scene): Promise<ScenicRoomsResult> {
  const root = new TransformNode('scenicRooms', scene);
  const materials = createScenicMaterials(scene);
  const lights: PointLight[] = [];
  const allMeshes: AbstractMesh[] = [];

  // Create the scenic corridor connecting to main Corridor A
  const scenicCorridor = await createScenicCorridor(scene, root, materials, lights, allMeshes);

  // Create the three scenic rooms
  const observationDeck = await createObservationDeck(scene, root, materials, lights, allMeshes);
  const messHall = await createMessHall(scene, root, materials, lights, allMeshes);
  const recreationRoom = await createRecreationRoom(scene, root, materials, lights, allMeshes);

  const dispose = () => {
    for (const mesh of allMeshes) {
      mesh.dispose();
    }
    for (const light of lights) {
      light.dispose();
    }
    materials.forEach((mat) => {
      mat.dispose();
    });
    root.dispose();
  };

  return {
    root,
    rooms: {
      scenicCorridor,
      observationDeck,
      messHall,
      recreationRoom,
    },
    lights,
    dispose,
  };
}
