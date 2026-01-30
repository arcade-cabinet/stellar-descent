import { Animation } from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Animations/animatable';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

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
// Helper Functions
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

function addCeilingLight(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  color: Color3,
  intensity: number,
  lights: PointLight[],
  emissiveMat: StandardMaterial,
  allMeshes: Mesh[]
): PointLight {
  const fixture = MeshBuilder.CreateCylinder(
    'lightFixture',
    { height: 0.15, diameter: 0.6, tessellation: 12 },
    scene
  );
  fixture.position = position.clone();
  fixture.material = emissiveMat;
  fixture.parent = parent;
  allMeshes.push(fixture);

  const light = new PointLight(`ceilingLight_${lights.length}`, position.clone(), scene);
  light.diffuse = color;
  light.intensity = intensity;
  light.range = 15;
  lights.push(light);

  return light;
}

// ============================================================================
// Create Scenic Materials (extended from station materials)
// ============================================================================

function createScenicMaterials(scene: Scene): Map<string, StandardMaterial> {
  const materials = new Map<string, StandardMaterial>();

  // Hull - dark gunmetal
  const hullMat = new StandardMaterial('scenicHullMat', scene);
  hullMat.diffuseColor = Color3.FromHexString('#1A1D21');
  hullMat.specularColor = new Color3(0.3, 0.3, 0.35);
  hullMat.specularPower = 32;
  materials.set('hull', hullMat);

  // Floor - industrial grating
  const floorMat = new StandardMaterial('scenicFloorMat', scene);
  floorMat.diffuseColor = Color3.FromHexString('#2A2D31');
  floorMat.specularColor = new Color3(0.2, 0.2, 0.2);
  materials.set('floor', floorMat);

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

  // Active systems - soft green glow (for plants, indicators)
  const activeMat = new StandardMaterial('scenicActiveMat', scene);
  activeMat.emissiveColor = new Color3(0, 0.5, 0.2);
  activeMat.diffuseColor = Color3.FromHexString('#002010');
  materials.set('active', activeMat);

  // Plant container - ceramic/plastic
  const plantContainerMat = new StandardMaterial('plantContainerMat', scene);
  plantContainerMat.diffuseColor = Color3.FromHexString('#4A4A4A');
  plantContainerMat.specularColor = new Color3(0.15, 0.15, 0.15);
  materials.set('plantContainer', plantContainerMat);

  // Plant foliage - natural green
  const foliageMat = new StandardMaterial('foliageMat', scene);
  foliageMat.diffuseColor = Color3.FromHexString('#2D5A3D');
  foliageMat.specularColor = new Color3(0.1, 0.2, 0.1);
  materials.set('foliage', foliageMat);

  // Furniture - soft fabric/cushion
  const fabricMat = new StandardMaterial('fabricMat', scene);
  fabricMat.diffuseColor = Color3.FromHexString('#3A3D45');
  fabricMat.specularColor = new Color3(0.05, 0.05, 0.05);
  materials.set('fabric', fabricMat);

  // Table surface - worn metal/laminate
  const tableMat = new StandardMaterial('tableMat', scene);
  tableMat.diffuseColor = Color3.FromHexString('#353840');
  tableMat.specularColor = new Color3(0.3, 0.3, 0.3);
  materials.set('table', tableMat);

  // Food tray - brushed metal
  const trayMat = new StandardMaterial('trayMat', scene);
  trayMat.diffuseColor = Color3.FromHexString('#505560');
  trayMat.specularColor = new Color3(0.5, 0.5, 0.5);
  trayMat.specularPower = 64;
  materials.set('tray', trayMat);

  // Screen/display - blue glow
  const screenMat = new StandardMaterial('scenicScreenMat', scene);
  screenMat.emissiveColor = Color3.FromHexString('#003366');
  screenMat.diffuseColor = Color3.FromHexString('#001122');
  materials.set('screen', screenMat);

  // Exercise equipment - rubberized black
  const rubberMat = new StandardMaterial('rubberMat', scene);
  rubberMat.diffuseColor = Color3.FromHexString('#1A1A1A');
  rubberMat.specularColor = new Color3(0.1, 0.1, 0.1);
  materials.set('rubber', rubberMat);

  // Locker/storage - painted metal
  const lockerMat = new StandardMaterial('lockerMat', scene);
  lockerMat.diffuseColor = Color3.FromHexString('#384048');
  lockerMat.specularColor = new Color3(0.2, 0.2, 0.2);
  materials.set('locker', lockerMat);

  // Photo/memento frame - warm wood tone
  const woodMat = new StandardMaterial('woodMat', scene);
  woodMat.diffuseColor = Color3.FromHexString('#5A4030');
  woodMat.specularColor = new Color3(0.15, 0.12, 0.1);
  materials.set('wood', woodMat);

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

  return materials;
}

// ============================================================================
// Observation Deck
// ============================================================================
// Large curved window wall showing planet view
// Comfortable seating, plants, soft ambient lighting
// Static NPCs looking out window

function createObservationDeck(
  scene: Scene,
  parent: TransformNode,
  materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: Mesh[]
): TransformNode {
  const room = new TransformNode('observationDeck', scene);
  room.parent = parent;

  // Floor
  createFloorModule(
    scene,
    room,
    OBSERVATION_CENTER,
    OBSERVATION_DECK.width,
    OBSERVATION_DECK.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Ceiling
  createCeilingModule(
    scene,
    room,
    OBSERVATION_CENTER,
    OBSERVATION_DECK.width,
    OBSERVATION_DECK.depth,
    OBSERVATION_DECK.height,
    materials.get('hull')!,
    allMeshes
  );

  // Side walls (left and right)
  createWallModule(
    scene,
    room,
    new Vector3(OBSERVATION_CENTER.x - OBSERVATION_DECK.width / 2, 0, OBSERVATION_CENTER.z),
    OBSERVATION_DECK.depth,
    OBSERVATION_DECK.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    room,
    new Vector3(OBSERVATION_CENTER.x + OBSERVATION_DECK.width / 2, 0, OBSERVATION_CENTER.z),
    OBSERVATION_DECK.depth,
    OBSERVATION_DECK.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // Back wall (with entrance from scenic corridor)
  createWallModule(
    scene,
    room,
    new Vector3(OBSERVATION_CENTER.x - 5, 0, OBSERVATION_CENTER.z - OBSERVATION_DECK.depth / 2),
    6,
    OBSERVATION_DECK.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    room,
    new Vector3(OBSERVATION_CENTER.x + 5, 0, OBSERVATION_CENTER.z - OBSERVATION_DECK.depth / 2),
    6,
    OBSERVATION_DECK.height,
    0,
    materials.get('hull')!,
    allMeshes
  );

  // === CURVED OBSERVATION WINDOW ===
  // Window frame (curved, spans front of room)
  const windowFrameWidth = OBSERVATION_DECK.width - 2;
  const windowHeight = OBSERVATION_DECK.height - 1;

  // Window frame - thick border
  const frameBottom = MeshBuilder.CreateBox(
    'obsFrameBottom',
    { width: windowFrameWidth, height: 0.3, depth: 0.4 },
    scene
  );
  frameBottom.position = new Vector3(
    OBSERVATION_CENTER.x,
    0.5,
    OBSERVATION_CENTER.z + OBSERVATION_DECK.depth / 2
  );
  frameBottom.material = materials.get('frame')!;
  frameBottom.parent = room;
  allMeshes.push(frameBottom);

  const frameTop = MeshBuilder.CreateBox(
    'obsFrameTop',
    { width: windowFrameWidth, height: 0.3, depth: 0.4 },
    scene
  );
  frameTop.position = new Vector3(
    OBSERVATION_CENTER.x,
    windowHeight + 0.5,
    OBSERVATION_CENTER.z + OBSERVATION_DECK.depth / 2
  );
  frameTop.material = materials.get('frame')!;
  frameTop.parent = room;
  allMeshes.push(frameTop);

  // Vertical frame dividers
  for (let i = -2; i <= 2; i++) {
    const divider = MeshBuilder.CreateBox(
      `obsFrameDivider_${i}`,
      { width: 0.15, height: windowHeight, depth: 0.3 },
      scene
    );
    divider.position = new Vector3(
      OBSERVATION_CENTER.x + i * (windowFrameWidth / 5),
      windowHeight / 2 + 0.5,
      OBSERVATION_CENTER.z + OBSERVATION_DECK.depth / 2
    );
    divider.material = materials.get('frame')!;
    divider.parent = room;
    allMeshes.push(divider);
  }

  // Window glass (semi-transparent)
  const windowGlass = MeshBuilder.CreateBox(
    'obsWindowGlass',
    { width: windowFrameWidth - 0.5, height: windowHeight - 0.3, depth: 0.05 },
    scene
  );
  windowGlass.position = new Vector3(
    OBSERVATION_CENTER.x,
    windowHeight / 2 + 0.5,
    OBSERVATION_CENTER.z + OBSERVATION_DECK.depth / 2 - 0.2
  );
  windowGlass.material = materials.get('window')!;
  windowGlass.parent = room;
  allMeshes.push(windowGlass);

  // === PLANET VIEW (outside window) ===
  const planetSphere = MeshBuilder.CreateSphere(
    'keplerPlanet',
    { diameter: 30, segments: 24 },
    scene
  );
  planetSphere.position = new Vector3(
    OBSERVATION_CENTER.x + 5,
    -8,
    OBSERVATION_CENTER.z + OBSERVATION_DECK.depth / 2 + 40
  );
  planetSphere.material = materials.get('planet')!;
  planetSphere.parent = room;
  allMeshes.push(planetSphere);

  // Stars backdrop
  const starsBackdrop = MeshBuilder.CreateBox(
    'starsBackdrop',
    { width: 100, height: 50, depth: 0.1 },
    scene
  );
  starsBackdrop.position = new Vector3(
    OBSERVATION_CENTER.x,
    10,
    OBSERVATION_CENTER.z + OBSERVATION_DECK.depth / 2 + 80
  );
  starsBackdrop.material = materials.get('stars')!;
  starsBackdrop.parent = room;
  allMeshes.push(starsBackdrop);

  // === SEATING AREA ===
  // Curved couch facing window
  for (let i = -2; i <= 2; i++) {
    // Seat cushion
    const seat = MeshBuilder.CreateBox(
      `couchSeat_${i}`,
      { width: 2.2, height: 0.35, depth: 0.9 },
      scene
    );
    seat.position = new Vector3(OBSERVATION_CENTER.x + i * 2.5, 0.45, OBSERVATION_CENTER.z + 1.5);
    seat.material = materials.get('fabric')!;
    seat.parent = room;
    allMeshes.push(seat);

    // Seat back
    const back = MeshBuilder.CreateBox(
      `couchBack_${i}`,
      { width: 2.2, height: 0.7, depth: 0.25 },
      scene
    );
    back.position = new Vector3(OBSERVATION_CENTER.x + i * 2.5, 0.8, OBSERVATION_CENTER.z + 1.0);
    back.material = materials.get('fabric')!;
    back.parent = room;
    allMeshes.push(back);
  }

  // Individual chairs (angled toward window)
  const chairPositions = [
    { x: -5, z: -1, rot: 0.3 },
    { x: 5, z: -1, rot: -0.3 },
  ];
  for (let i = 0; i < chairPositions.length; i++) {
    const cp = chairPositions[i];
    const chairSeat = MeshBuilder.CreateBox(
      `chair_${i}`,
      { width: 0.7, height: 0.35, depth: 0.7 },
      scene
    );
    chairSeat.position = new Vector3(
      OBSERVATION_CENTER.x + cp.x,
      0.45,
      OBSERVATION_CENTER.z + cp.z
    );
    chairSeat.rotation.y = cp.rot;
    chairSeat.material = materials.get('fabric')!;
    chairSeat.parent = room;
    allMeshes.push(chairSeat);

    const chairBack = MeshBuilder.CreateBox(
      `chairBack_${i}`,
      { width: 0.7, height: 0.6, depth: 0.15 },
      scene
    );
    chairBack.position = new Vector3(
      OBSERVATION_CENTER.x + cp.x,
      0.75,
      OBSERVATION_CENTER.z + cp.z - 0.35
    );
    chairBack.rotation.y = cp.rot;
    chairBack.material = materials.get('fabric')!;
    chairBack.parent = room;
    allMeshes.push(chairBack);
  }

  // === PLANTS IN CONTAINERS ===
  const plantPositions = [
    { x: -6, z: 3, scale: 1.2 },
    { x: 6, z: 3, scale: 1.0 },
    { x: -3, z: -3, scale: 0.8 },
    { x: 3, z: -3, scale: 0.9 },
  ];
  for (let i = 0; i < plantPositions.length; i++) {
    const pp = plantPositions[i];
    // Container pot
    const pot = MeshBuilder.CreateCylinder(
      `plantPot_${i}`,
      { height: 0.5 * pp.scale, diameter: 0.6 * pp.scale, tessellation: 12 },
      scene
    );
    pot.position = new Vector3(
      OBSERVATION_CENTER.x + pp.x,
      0.25 * pp.scale,
      OBSERVATION_CENTER.z + pp.z
    );
    pot.material = materials.get('plantContainer')!;
    pot.parent = room;
    allMeshes.push(pot);

    // Plant foliage (simple sphere approximation)
    const foliage = MeshBuilder.CreateSphere(
      `plantFoliage_${i}`,
      { diameter: 0.8 * pp.scale, segments: 8 },
      scene
    );
    foliage.position = new Vector3(
      OBSERVATION_CENTER.x + pp.x,
      0.7 * pp.scale,
      OBSERVATION_CENTER.z + pp.z
    );
    foliage.material = materials.get('foliage')!;
    foliage.parent = room;
    allMeshes.push(foliage);
  }

  // === STATIC NPCs (crew members looking out window) ===
  const npcPositions = [
    { x: -3, z: 2.5, rot: 0 },
    { x: 1, z: 2.8, rot: 0.1 },
  ];
  for (let i = 0; i < npcPositions.length; i++) {
    const np = npcPositions[i];
    // Body (simple capsule)
    const body = MeshBuilder.CreateCapsule(`npcBody_${i}`, { height: 1.4, radius: 0.25 }, scene);
    body.position = new Vector3(OBSERVATION_CENTER.x + np.x, 1.0, OBSERVATION_CENTER.z + np.z);
    body.rotation.y = np.rot;
    body.material = materials.get('uniform')!;
    body.parent = room;
    allMeshes.push(body);

    // Head
    const head = MeshBuilder.CreateSphere(`npcHead_${i}`, { diameter: 0.3, segments: 12 }, scene);
    head.position = new Vector3(OBSERVATION_CENTER.x + np.x, 1.85, OBSERVATION_CENTER.z + np.z);
    head.material = materials.get('skin')!;
    head.parent = room;
    allMeshes.push(head);
  }

  // === AMBIENT LIGHTING (soft, warm) ===
  // Recessed ceiling lights
  addCeilingLight(
    scene,
    room,
    new Vector3(OBSERVATION_CENTER.x - 4, OBSERVATION_DECK.height - 0.2, OBSERVATION_CENTER.z),
    new Color3(1.0, 0.95, 0.85),
    0.4,
    lights,
    materials.get('active')!,
    allMeshes
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(OBSERVATION_CENTER.x + 4, OBSERVATION_DECK.height - 0.2, OBSERVATION_CENTER.z),
    new Color3(1.0, 0.95, 0.85),
    0.4,
    lights,
    materials.get('active')!,
    allMeshes
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(OBSERVATION_CENTER.x, OBSERVATION_DECK.height - 0.2, OBSERVATION_CENTER.z - 2),
    new Color3(0.9, 0.92, 1.0),
    0.35,
    lights,
    materials.get('active')!,
    allMeshes
  );

  return room;
}

// ============================================================================
// Mess Hall / Canteen
// ============================================================================
// Long tables with benches, food dispensers, abandoned trays
// Kitchen area visible, screens showing news/propaganda
// Shows normal station life interrupted

function createMessHall(
  scene: Scene,
  parent: TransformNode,
  materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: Mesh[]
): TransformNode {
  const room = new TransformNode('messHall', scene);
  room.parent = parent;

  // Floor
  createFloorModule(
    scene,
    room,
    MESS_CENTER,
    MESS_HALL.width,
    MESS_HALL.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Ceiling
  createCeilingModule(
    scene,
    room,
    MESS_CENTER,
    MESS_HALL.width,
    MESS_HALL.depth,
    MESS_HALL.height,
    materials.get('hull')!,
    allMeshes
  );

  // Walls
  // Back wall
  createWallModule(
    scene,
    room,
    new Vector3(MESS_CENTER.x, 0, MESS_CENTER.z + MESS_HALL.depth / 2),
    MESS_HALL.width,
    MESS_HALL.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  // Front wall (with door opening to corridor)
  createWallModule(
    scene,
    room,
    new Vector3(MESS_CENTER.x - 4, 0, MESS_CENTER.z - MESS_HALL.depth / 2),
    5,
    MESS_HALL.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    room,
    new Vector3(MESS_CENTER.x + 4, 0, MESS_CENTER.z - MESS_HALL.depth / 2),
    5,
    MESS_HALL.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  // Left wall (with kitchen window)
  createWallModule(
    scene,
    room,
    new Vector3(MESS_CENTER.x - MESS_HALL.width / 2, 0, MESS_CENTER.z - 2),
    7,
    MESS_HALL.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    room,
    new Vector3(MESS_CENTER.x - MESS_HALL.width / 2, 0, MESS_CENTER.z + 4),
    3,
    MESS_HALL.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Right wall
  createWallModule(
    scene,
    room,
    new Vector3(MESS_CENTER.x + MESS_HALL.width / 2, 0, MESS_CENTER.z),
    MESS_HALL.depth,
    MESS_HALL.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // === KITCHEN WINDOW ===
  const kitchenWindow = MeshBuilder.CreateBox(
    'kitchenWindow',
    { width: 0.1, height: 1.5, depth: 3 },
    scene
  );
  kitchenWindow.position = new Vector3(MESS_CENTER.x - MESS_HALL.width / 2, 1.5, MESS_CENTER.z + 1);
  kitchenWindow.material = materials.get('window')!;
  kitchenWindow.parent = room;
  allMeshes.push(kitchenWindow);

  // Kitchen counter (visible through window)
  const kitchenCounter = MeshBuilder.CreateBox(
    'kitchenCounter',
    { width: 0.8, height: 0.9, depth: 4 },
    scene
  );
  kitchenCounter.position = new Vector3(
    MESS_CENTER.x - MESS_HALL.width / 2 - 0.6,
    0.45,
    MESS_CENTER.z + 1
  );
  kitchenCounter.material = materials.get('table')!;
  kitchenCounter.parent = room;
  allMeshes.push(kitchenCounter);

  // === LONG TABLES WITH BENCHES ===
  for (let row = 0; row < 2; row++) {
    const rowZ = MESS_CENTER.z - 2 + row * 5;

    // Table
    const table = MeshBuilder.CreateBox(
      `messTable_${row}`,
      { width: 8, height: 0.1, depth: 1.2 },
      scene
    );
    table.position = new Vector3(MESS_CENTER.x + 1, 0.75, rowZ);
    table.material = materials.get('table')!;
    table.parent = room;
    allMeshes.push(table);

    // Table legs
    for (let leg = 0; leg < 2; leg++) {
      const tableLeg = MeshBuilder.CreateBox(
        `tableLeg_${row}_${leg}`,
        { width: 0.1, height: 0.7, depth: 1.0 },
        scene
      );
      tableLeg.position = new Vector3(MESS_CENTER.x + 1 + (leg === 0 ? -3.5 : 3.5), 0.35, rowZ);
      tableLeg.material = materials.get('hull')!;
      tableLeg.parent = room;
      allMeshes.push(tableLeg);
    }

    // Benches (both sides of table)
    for (let side = 0; side < 2; side++) {
      const bench = MeshBuilder.CreateBox(
        `bench_${row}_${side}`,
        { width: 7.5, height: 0.08, depth: 0.4 },
        scene
      );
      bench.position = new Vector3(MESS_CENTER.x + 1, 0.45, rowZ + (side === 0 ? -0.9 : 0.9));
      bench.material = materials.get('fabric')!;
      bench.parent = room;
      allMeshes.push(bench);
    }

    // === ABANDONED TRAYS (environmental storytelling) ===
    const trayPositions = [
      { x: -2, z: 0.2 },
      { x: 1, z: -0.3 },
      { x: 3, z: 0.1 },
    ];
    for (let t = 0; t < trayPositions.length; t++) {
      if (row === 0 || t % 2 === 0) {
        const tray = MeshBuilder.CreateBox(
          `tray_${row}_${t}`,
          { width: 0.35, height: 0.03, depth: 0.25 },
          scene
        );
        tray.position = new Vector3(
          MESS_CENTER.x + 1 + trayPositions[t].x,
          0.82,
          rowZ + trayPositions[t].z
        );
        // Slight random rotation for abandoned feel
        tray.rotation.y = (t - 1) * 0.15;
        tray.material = materials.get('tray')!;
        tray.parent = room;
        allMeshes.push(tray);
      }
    }
  }

  // === FOOD DISPENSERS ON WALL ===
  for (let i = 0; i < 3; i++) {
    const dispenser = MeshBuilder.CreateBox(
      `foodDispenser_${i}`,
      { width: 1.2, height: 1.8, depth: 0.5 },
      scene
    );
    dispenser.position = new Vector3(
      MESS_CENTER.x + 3 + i * 1.8,
      1.0,
      MESS_CENTER.z + MESS_HALL.depth / 2 - 0.3
    );
    dispenser.material = materials.get('locker')!;
    dispenser.parent = room;
    allMeshes.push(dispenser);

    // Dispenser screen
    const dispenserScreen = MeshBuilder.CreatePlane(
      `dispenserScreen_${i}`,
      { width: 0.6, height: 0.4 },
      scene
    );
    dispenserScreen.position = new Vector3(
      MESS_CENTER.x + 3 + i * 1.8,
      1.4,
      MESS_CENTER.z + MESS_HALL.depth / 2 - 0.55
    );
    dispenserScreen.material = materials.get('screen')!;
    dispenserScreen.parent = room;
    allMeshes.push(dispenserScreen);
  }

  // === NEWS SCREENS (showing propaganda/alerts) ===
  const newsScreen = MeshBuilder.CreatePlane('newsScreen', { width: 3, height: 2 }, scene);
  newsScreen.position = new Vector3(MESS_CENTER.x + MESS_HALL.width / 2 - 0.2, 2.0, MESS_CENTER.z);
  newsScreen.rotation.y = -Math.PI / 2;
  newsScreen.material = materials.get('screen')!;
  newsScreen.parent = room;
  allMeshes.push(newsScreen);

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
    new Vector3(MESS_CENTER.x - 2, MESS_HALL.height - 0.2, MESS_CENTER.z - 2),
    new Color3(1.0, 0.98, 0.95),
    0.5,
    lights,
    materials.get('active')!,
    allMeshes
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(MESS_CENTER.x + 3, MESS_HALL.height - 0.2, MESS_CENTER.z - 2),
    new Color3(1.0, 0.98, 0.95),
    0.5,
    lights,
    materials.get('active')!,
    allMeshes
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(MESS_CENTER.x, MESS_HALL.height - 0.2, MESS_CENTER.z + 3),
    new Color3(1.0, 0.98, 0.95),
    0.5,
    lights,
    materials.get('active')!,
    allMeshes
  );

  return room;
}

// ============================================================================
// Recreation Room
// ============================================================================
// Exercise equipment, game table, personal lockers
// Photos/mementos on walls - adds human element

function createRecreationRoom(
  scene: Scene,
  parent: TransformNode,
  materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: Mesh[]
): TransformNode {
  const room = new TransformNode('recreationRoom', scene);
  room.parent = parent;

  // Floor
  createFloorModule(
    scene,
    room,
    RECREATION_CENTER,
    RECREATION_ROOM.width,
    RECREATION_ROOM.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Ceiling
  createCeilingModule(
    scene,
    room,
    RECREATION_CENTER,
    RECREATION_ROOM.width,
    RECREATION_ROOM.depth,
    RECREATION_ROOM.height,
    materials.get('hull')!,
    allMeshes
  );

  // Walls
  createWallModule(
    scene,
    room,
    new Vector3(RECREATION_CENTER.x, 0, RECREATION_CENTER.z + RECREATION_ROOM.depth / 2),
    RECREATION_ROOM.width,
    RECREATION_ROOM.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    room,
    new Vector3(RECREATION_CENTER.x, 0, RECREATION_CENTER.z - RECREATION_ROOM.depth / 2),
    RECREATION_ROOM.width,
    RECREATION_ROOM.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    room,
    new Vector3(RECREATION_CENTER.x - RECREATION_ROOM.width / 2, 0, RECREATION_CENTER.z),
    RECREATION_ROOM.depth,
    RECREATION_ROOM.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  // Right wall with door opening
  createWallModule(
    scene,
    room,
    new Vector3(RECREATION_CENTER.x + RECREATION_ROOM.width / 2, 0, RECREATION_CENTER.z - 2),
    3,
    RECREATION_ROOM.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    room,
    new Vector3(RECREATION_CENTER.x + RECREATION_ROOM.width / 2, 0, RECREATION_CENTER.z + 2),
    3,
    RECREATION_ROOM.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // === EXERCISE EQUIPMENT ===
  // Treadmill
  const treadmill = MeshBuilder.CreateBox(
    'treadmill',
    { width: 0.8, height: 1.2, depth: 2.0 },
    scene
  );
  treadmill.position = new Vector3(RECREATION_CENTER.x - 3, 0.6, RECREATION_CENTER.z + 2);
  treadmill.material = materials.get('rubber')!;
  treadmill.parent = room;
  allMeshes.push(treadmill);

  // Treadmill handles
  const treadmillHandles = MeshBuilder.CreateBox(
    'treadmillHandles',
    { width: 0.6, height: 0.8, depth: 0.1 },
    scene
  );
  treadmillHandles.position = new Vector3(RECREATION_CENTER.x - 3, 1.3, RECREATION_CENTER.z + 1.1);
  treadmillHandles.material = materials.get('hull')!;
  treadmillHandles.parent = room;
  allMeshes.push(treadmillHandles);

  // Weight bench
  const weightBench = MeshBuilder.CreateBox(
    'weightBench',
    { width: 0.5, height: 0.45, depth: 1.4 },
    scene
  );
  weightBench.position = new Vector3(RECREATION_CENTER.x - 3, 0.225, RECREATION_CENTER.z - 2);
  weightBench.material = materials.get('fabric')!;
  weightBench.parent = room;
  allMeshes.push(weightBench);

  // Weight rack
  const weightRack = MeshBuilder.CreateBox(
    'weightRack',
    { width: 1.5, height: 1.0, depth: 0.4 },
    scene
  );
  weightRack.position = new Vector3(RECREATION_CENTER.x - 3.5, 0.5, RECREATION_CENTER.z - 3.5);
  weightRack.material = materials.get('hull')!;
  weightRack.parent = room;
  allMeshes.push(weightRack);

  // Individual weights on rack
  for (let w = 0; w < 4; w++) {
    const weight = MeshBuilder.CreateCylinder(
      `weight_${w}`,
      { height: 0.08, diameter: 0.25 + w * 0.05, tessellation: 12 },
      scene
    );
    weight.position = new Vector3(
      RECREATION_CENTER.x - 4 + w * 0.35,
      0.8,
      RECREATION_CENTER.z - 3.5
    );
    weight.rotation.x = Math.PI / 2;
    weight.material = materials.get('rubber')!;
    weight.parent = room;
    allMeshes.push(weight);
  }

  // === GAME TABLE ===
  const gameTable = MeshBuilder.CreateBox(
    'gameTable',
    { width: 1.2, height: 0.75, depth: 1.2 },
    scene
  );
  gameTable.position = new Vector3(RECREATION_CENTER.x + 2, 0.375, RECREATION_CENTER.z);
  gameTable.material = materials.get('table')!;
  gameTable.parent = room;
  allMeshes.push(gameTable);

  // Scattered cards on table (environmental detail)
  for (let c = 0; c < 6; c++) {
    const card = MeshBuilder.CreateBox(
      `card_${c}`,
      { width: 0.06, height: 0.002, depth: 0.09 },
      scene
    );
    card.position = new Vector3(
      RECREATION_CENTER.x + 2 + (Math.random() - 0.5) * 0.6,
      0.76,
      RECREATION_CENTER.z + (Math.random() - 0.5) * 0.6
    );
    card.rotation.y = Math.random() * Math.PI;
    card.material = materials.get('tray')!; // Off-white color
    card.parent = room;
    allMeshes.push(card);
  }

  // Chairs around game table
  for (let chair = 0; chair < 3; chair++) {
    const angle = (chair / 3) * Math.PI * 2 + Math.PI / 6;
    const chairSeat = MeshBuilder.CreateBox(
      `gameChair_${chair}`,
      { width: 0.5, height: 0.35, depth: 0.5 },
      scene
    );
    chairSeat.position = new Vector3(
      RECREATION_CENTER.x + 2 + Math.cos(angle) * 1.1,
      0.175,
      RECREATION_CENTER.z + Math.sin(angle) * 1.1
    );
    chairSeat.rotation.y = angle + Math.PI;
    chairSeat.material = materials.get('fabric')!;
    chairSeat.parent = room;
    allMeshes.push(chairSeat);
  }

  // === PERSONAL LOCKERS ===
  for (let l = 0; l < 4; l++) {
    const locker = MeshBuilder.CreateBox(
      `personalLocker_${l}`,
      { width: 0.6, height: 1.8, depth: 0.5 },
      scene
    );
    locker.position = new Vector3(
      RECREATION_CENTER.x + 0.5 + l * 0.7,
      0.9,
      RECREATION_CENTER.z + RECREATION_ROOM.depth / 2 - 0.3
    );
    locker.material = materials.get('locker')!;
    locker.parent = room;
    allMeshes.push(locker);
  }

  // === PHOTOS/MEMENTOS ON WALL ===
  // Photo frames (adds human element)
  const photoPositions = [
    { x: -4, y: 1.6, z: RECREATION_ROOM.depth / 2 - 0.2 },
    { x: -3.2, y: 1.8, z: RECREATION_ROOM.depth / 2 - 0.2 },
    { x: -3.6, y: 1.2, z: RECREATION_ROOM.depth / 2 - 0.2 },
  ];
  for (let p = 0; p < photoPositions.length; p++) {
    const pp = photoPositions[p];
    // Frame
    const frame = MeshBuilder.CreateBox(
      `photoFrame_${p}`,
      { width: 0.25 + p * 0.05, height: 0.2 + p * 0.03, depth: 0.03 },
      scene
    );
    frame.position = new Vector3(RECREATION_CENTER.x + pp.x, pp.y, RECREATION_CENTER.z + pp.z);
    frame.material = materials.get('wood')!;
    frame.parent = room;
    allMeshes.push(frame);

    // Photo (inner, slightly recessed)
    const photo = MeshBuilder.CreatePlane(
      `photo_${p}`,
      { width: 0.18 + p * 0.04, height: 0.13 + p * 0.02 },
      scene
    );
    photo.position = new Vector3(
      RECREATION_CENTER.x + pp.x,
      pp.y,
      RECREATION_CENTER.z + pp.z - 0.02
    );
    // Sepia-toned for nostalgic feel
    const photoMat = new StandardMaterial(`photoMat_${p}`, scene);
    photoMat.diffuseColor = Color3.FromHexString('#8B7355');
    photoMat.specularColor = new Color3(0.1, 0.1, 0.1);
    photo.material = photoMat;
    photo.parent = room;
    allMeshes.push(photo);
  }

  // === LIGHTING ===
  addCeilingLight(
    scene,
    room,
    new Vector3(RECREATION_CENTER.x - 2, RECREATION_ROOM.height - 0.2, RECREATION_CENTER.z),
    new Color3(1.0, 0.95, 0.9),
    0.45,
    lights,
    materials.get('active')!,
    allMeshes
  );
  addCeilingLight(
    scene,
    room,
    new Vector3(RECREATION_CENTER.x + 2, RECREATION_ROOM.height - 0.2, RECREATION_CENTER.z),
    new Color3(1.0, 0.95, 0.9),
    0.45,
    lights,
    materials.get('active')!,
    allMeshes
  );

  return room;
}

// ============================================================================
// Scenic Corridor (connects main corridor to scenic rooms)
// ============================================================================

function createScenicCorridor(
  scene: Scene,
  parent: TransformNode,
  materials: Map<string, StandardMaterial>,
  lights: PointLight[],
  allMeshes: Mesh[]
): TransformNode {
  const corridor = new TransformNode('scenicCorridor', scene);
  corridor.parent = parent;

  // Floor
  createFloorModule(
    scene,
    corridor,
    SCENIC_CORRIDOR_CENTER,
    SCENIC_CORRIDOR.width,
    SCENIC_CORRIDOR.depth,
    materials.get('floor')!,
    allMeshes
  );

  // Ceiling
  createCeilingModule(
    scene,
    corridor,
    SCENIC_CORRIDOR_CENTER,
    SCENIC_CORRIDOR.width,
    SCENIC_CORRIDOR.depth,
    SCENIC_CORRIDOR.height,
    materials.get('hull')!,
    allMeshes
  );

  // Left wall (solid)
  createWallModule(
    scene,
    corridor,
    new Vector3(SCENIC_CORRIDOR_CENTER.x - SCENIC_CORRIDOR.width / 2, 0, SCENIC_CORRIDOR_CENTER.z),
    SCENIC_CORRIDOR.depth,
    SCENIC_CORRIDOR.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // Right wall (openings for mess hall and recreation room)
  createWallModule(
    scene,
    corridor,
    new Vector3(
      SCENIC_CORRIDOR_CENTER.x + SCENIC_CORRIDOR.width / 2,
      0,
      SCENIC_CORRIDOR_CENTER.z + 6
    ),
    5,
    SCENIC_CORRIDOR.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    corridor,
    new Vector3(
      SCENIC_CORRIDOR_CENTER.x + SCENIC_CORRIDOR.width / 2,
      0,
      SCENIC_CORRIDOR_CENTER.z - 6
    ),
    5,
    SCENIC_CORRIDOR.height,
    Math.PI / 2,
    materials.get('hull')!,
    allMeshes
  );

  // Back wall (entrance from main Corridor A)
  createWallModule(
    scene,
    corridor,
    new Vector3(SCENIC_CORRIDOR_CENTER.x, 0, SCENIC_CORRIDOR_CENTER.z - SCENIC_CORRIDOR.depth / 2),
    SCENIC_CORRIDOR.width,
    SCENIC_CORRIDOR.height,
    0,
    materials.get('hull')!,
    allMeshes
  );

  // Front wall (opening to observation deck)
  createWallModule(
    scene,
    corridor,
    new Vector3(
      SCENIC_CORRIDOR_CENTER.x - 0.8,
      0,
      SCENIC_CORRIDOR_CENTER.z + SCENIC_CORRIDOR.depth / 2
    ),
    1,
    SCENIC_CORRIDOR.height,
    0,
    materials.get('hull')!,
    allMeshes
  );
  createWallModule(
    scene,
    corridor,
    new Vector3(
      SCENIC_CORRIDOR_CENTER.x + 0.8,
      0,
      SCENIC_CORRIDOR_CENTER.z + SCENIC_CORRIDOR.depth / 2
    ),
    1,
    SCENIC_CORRIDOR.height,
    0,
    materials.get('hull')!,
    allMeshes
  );

  // Corridor lights
  addCeilingLight(
    scene,
    corridor,
    new Vector3(
      SCENIC_CORRIDOR_CENTER.x,
      SCENIC_CORRIDOR.height - 0.2,
      SCENIC_CORRIDOR_CENTER.z - 4
    ),
    new Color3(0.9, 0.95, 1.0),
    0.4,
    lights,
    materials.get('active')!,
    allMeshes
  );
  addCeilingLight(
    scene,
    corridor,
    new Vector3(
      SCENIC_CORRIDOR_CENTER.x,
      SCENIC_CORRIDOR.height - 0.2,
      SCENIC_CORRIDOR_CENTER.z + 4
    ),
    new Color3(0.9, 0.95, 1.0),
    0.4,
    lights,
    materials.get('active')!,
    allMeshes
  );

  return corridor;
}

// ============================================================================
// Main Export: Create All Scenic Rooms
// ============================================================================

export function createScenicRooms(scene: Scene): ScenicRoomsResult {
  const root = new TransformNode('scenicRooms', scene);
  const materials = createScenicMaterials(scene);
  const lights: PointLight[] = [];
  const allMeshes: Mesh[] = [];

  // Create the scenic corridor connecting to main Corridor A
  const scenicCorridor = createScenicCorridor(scene, root, materials, lights, allMeshes);

  // Create the three scenic rooms
  const observationDeck = createObservationDeck(scene, root, materials, lights, allMeshes);
  const messHall = createMessHall(scene, root, materials, lights, allMeshes);
  const recreationRoom = createRecreationRoom(scene, root, materials, lights, allMeshes);

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
