/**
 * Modular Station Environment
 *
 * Hybrid implementation that uses GLB corridor segments for visual geometry
 * while providing the interactive elements needed for the tutorial:
 * - Suit locker and equipment
 * - Shooting range with calibration targets
 * - Bay doors and drop pod sequences
 * - HOLODECK platforming tutorial
 *
 * This replaces the legacy procedural environment while maintaining
 * the same interface for tutorial/level integration.
 */

import { Animation } from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Animations/animatable';
import type { PointLight } from '@babylonjs/core/Lights/pointLight';
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
import { AssetManager } from '../../core/AssetManager';
import {
  buildModularStation,
  MODULAR_ROOM_POSITIONS,
  type ModularStationResult,
} from './ModularStationBuilder';

// ============================================================================
// GLB ASSET PATHS for interactive elements
// ============================================================================

const INTERACTIVE_ASSETS = {
  // Suit locker uses a tall shelf model
  suitLocker: '/models/props/furniture/shelf_mx_1.glb',
  // Door panels
  doorPanel: '/models/props/doors/door_hr_6.glb',
  garageDoor: '/models/environment/station/garage_door_frame_hr_1.glb',
  // Platform for holodeck
  holodeckPlatform: '/models/environment/station/platform_small_mx_1.glb',
  holodeckPlatformLarge: '/models/environment/station/platform_large_mx_1.glb',
  // Beam for crouch obstacle
  beam: '/models/environment/station/beam_hc_horizontal_1.glb',
} as const;

// ============================================================================
// CALLBACK INTERFACES
// ============================================================================

export interface ShootingRangeCallbacks {
  onTargetHit: (targetIndex: number) => void;
  onAllTargetsHit: () => void;
}

export interface HolodeckCallbacks {
  onPhaseComplete: (phase: 'movement' | 'jump' | 'crouch' | 'combined') => void;
  onAllPhasesComplete: () => void;
  onPlatformReached: (platformId: number) => void;
  onCrouchSuccess: () => void;
}

// ============================================================================
// MODULAR STATION ENVIRONMENT INTERFACE
// ============================================================================

export interface ModularStationEnv {
  // Core references
  root: TransformNode;
  stationMeshes: ModularStationResult;

  // Interactive elements
  dropPod: Mesh;
  suitLocker: Mesh;
  suitBody: Mesh | null;
  suitHelmet: Mesh | null;
  bayDoorLeft: Mesh;
  bayDoorRight: Mesh;

  // Shooting range
  rangeLight: Mesh;
  targets: Mesh[];

  // Holodeck
  holodeckPlatforms: Mesh[];
  holodeckObstacles: Mesh[];

  // Industrial props (GLB models placed throughout the station)
  industrialProps: AbstractMesh[];

  // Lights
  lights: PointLight[];

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

  // Holodeck methods
  startHolodeckTutorial: (callbacks: HolodeckCallbacks) => void;
  isHolodeckActive: () => boolean;
  checkPlatformReached: (position: Vector3) => boolean;
  checkCrouchZone: (position: Vector3, isCrouching: boolean) => boolean;

  // Cleanup
  dispose: () => void;
}

// ============================================================================
// MATERIALS
// ============================================================================

function createInteractiveMaterials(scene: Scene) {
  // Metal material for interactive elements
  const metalMat = new StandardMaterial('interactiveMetal', scene);
  metalMat.diffuseColor = new Color3(0.5, 0.5, 0.55);
  metalMat.specularColor = new Color3(0.6, 0.6, 0.6);

  // Emissive material for targets
  const targetMat = new StandardMaterial('targetMat', scene);
  targetMat.diffuseColor = new Color3(0.8, 0.2, 0.1);
  targetMat.emissiveColor = new Color3(0.4, 0.1, 0.05);

  // Suit material
  const suitMat = new StandardMaterial('suitMat', scene);
  suitMat.diffuseColor = new Color3(0.2, 0.25, 0.2);
  suitMat.specularColor = new Color3(0.3, 0.3, 0.3);

  // Door material
  const doorMat = new StandardMaterial('doorMat', scene);
  doorMat.diffuseColor = new Color3(0.3, 0.35, 0.4);
  doorMat.specularColor = new Color3(0.5, 0.5, 0.5);

  // Holodeck platform material (glowing blue)
  const holoMat = new StandardMaterial('holoMat', scene);
  holoMat.diffuseColor = new Color3(0.1, 0.2, 0.5);
  holoMat.emissiveColor = new Color3(0.05, 0.15, 0.4);
  holoMat.alpha = 0.85;

  return { metalMat, targetMat, suitMat, doorMat, holoMat };
}

// ============================================================================
// ASSET PRELOADING
// ============================================================================

/**
 * Preload all GLB assets needed for the modular station interactive elements.
 * Should be called before createModularStationEnvironment.
 */
export async function preloadModularStationAssets(scene: Scene): Promise<void> {
  const loadPromises = Object.values(INTERACTIVE_ASSETS).map((path) =>
    AssetManager.loadAssetByPath(path, scene)
  );
  await Promise.allSettled(loadPromises);
  console.log('[ModularStationEnv] Interactive assets preloaded');
}

/**
 * Helper to place a GLB visual model.
 */
function placeVisualModel(
  scene: Scene,
  parent: TransformNode,
  assetPath: string,
  name: string,
  position: Vector3,
  rotation: Vector3,
  scale: Vector3
): TransformNode | null {
  const node = AssetManager.createInstanceByPath(assetPath, name, scene, true, 'environment');
  if (node) {
    node.position = position;
    node.rotation = rotation;
    node.scaling = scale;
    node.parent = parent;
  }
  return node;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export async function createModularStationEnvironment(scene: Scene): Promise<ModularStationEnv> {
  console.log('[ModularStationEnv] Creating modular station environment');
  const root = new TransformNode('modularAnchorStation', scene);
  const materials = createInteractiveMaterials(scene);
  const lights: PointLight[] = [];

  // Preload interactive GLB assets
  await preloadModularStationAssets(scene);

  // Load modular GLB station geometry
  console.log('[ModularStationEnv] Building modular station...');
  const stationMeshes = await buildModularStation(scene);
  console.log('[ModularStationEnv] Station built successfully');
  stationMeshes.root.parent = root;

  // ============================================================================
  // SUIT LOCKER (Equipment Bay)
  // ============================================================================

  const lockerPos = MODULAR_ROOM_POSITIONS.suitLocker;

  // Try GLB visual for locker, fallback to MeshBuilder
  const lockerVisual = placeVisualModel(
    scene,
    root,
    INTERACTIVE_ASSETS.suitLocker,
    'suitLocker_visual',
    lockerPos.clone(),
    new Vector3(0, Math.PI, 0),
    new Vector3(1.2, 1, 1)
  );

  // Collision box for interaction (always MeshBuilder)
  const suitLocker = MeshBuilder.CreateBox(
    'suitLocker',
    { width: 1.5, height: 2.2, depth: 0.8 },
    scene
  );
  suitLocker.position = lockerPos.clone();
  suitLocker.position.y = 1.1;
  suitLocker.isVisible = !lockerVisual; // Hide if GLB visual exists
  suitLocker.material = materials.metalMat;
  suitLocker.checkCollisions = true;
  suitLocker.parent = root;

  // Suit body and helmet (visible until equipped)
  const suitBody = MeshBuilder.CreateCylinder('suitBody', { height: 1.4, diameter: 0.6 }, scene);
  suitBody.position = lockerPos.clone();
  suitBody.position.y = 0.9;
  suitBody.position.z += 0.5;
  suitBody.material = materials.suitMat;
  suitBody.parent = root;

  const suitHelmet = MeshBuilder.CreateSphere('suitHelmet', { diameter: 0.4, segments: 16 }, scene);
  suitHelmet.position = suitBody.position.clone();
  suitHelmet.position.y += 0.9;
  suitHelmet.material = materials.suitMat;
  suitHelmet.parent = root;

  // ============================================================================
  // BAY DOORS (Hangar)
  // ============================================================================

  const hangarCenter = MODULAR_ROOM_POSITIONS.hangarBay;
  const doorWidth = 6;
  const doorHeight = 8;

  const bayDoorLeft = MeshBuilder.CreateBox(
    'bayDoorLeft',
    { width: doorWidth, height: doorHeight, depth: 0.3 },
    scene
  );
  bayDoorLeft.position = new Vector3(
    hangarCenter.x - doorWidth / 2 - 0.5,
    doorHeight / 2,
    hangarCenter.z - 10
  );
  bayDoorLeft.material = materials.doorMat;
  bayDoorLeft.parent = root;

  const bayDoorRight = MeshBuilder.CreateBox(
    'bayDoorRight',
    { width: doorWidth, height: doorHeight, depth: 0.3 },
    scene
  );
  bayDoorRight.position = new Vector3(
    hangarCenter.x + doorWidth / 2 + 0.5,
    doorHeight / 2,
    hangarCenter.z - 10
  );
  bayDoorRight.material = materials.doorMat;
  bayDoorRight.parent = root;

  // Door lights for depressurization effect
  const doorLightLeft = MeshBuilder.CreateBox('doorLightL', { size: 0.3 }, scene);
  doorLightLeft.position = bayDoorLeft.position.clone();
  doorLightLeft.position.y += doorHeight / 2 + 0.5;
  const doorLightMatL = new StandardMaterial('doorLightMatL', scene);
  doorLightMatL.emissiveColor = new Color3(0.2, 0.8, 0.2); // Green = safe
  doorLightLeft.material = doorLightMatL;
  doorLightLeft.parent = root;

  const doorLightRight = doorLightLeft.clone('doorLightR');
  doorLightRight.position.x = bayDoorRight.position.x;
  doorLightRight.parent = root;

  // ============================================================================
  // DROP POD (Hangar)
  // ============================================================================

  const podPos = MODULAR_ROOM_POSITIONS.dropPod;

  const dropPod = MeshBuilder.CreateCylinder(
    'dropPod',
    { height: 3, diameter: 2, tessellation: 8 },
    scene
  );
  dropPod.position = podPos.clone();
  dropPod.position.y = 1.5;
  dropPod.material = materials.metalMat;
  dropPod.parent = root;

  // Pod cone
  const podCone = MeshBuilder.CreateCylinder(
    'podCone',
    { height: 1, diameterTop: 0, diameterBottom: 2, tessellation: 8 },
    scene
  );
  podCone.position = dropPod.position.clone();
  podCone.position.y -= 2;
  podCone.material = materials.metalMat;
  podCone.parent = root;

  // ============================================================================
  // SHOOTING RANGE TARGETS
  // ============================================================================

  const rangeCenter = MODULAR_ROOM_POSITIONS.shootingRange;
  const targets: Mesh[] = [];

  // Range status light
  const rangeLight = MeshBuilder.CreateSphere('rangeLight', { diameter: 0.4 }, scene);
  rangeLight.position = new Vector3(rangeCenter.x - 3, 2.5, rangeCenter.z);
  const rangeLightMat = new StandardMaterial('rangeLightMat', scene);
  rangeLightMat.emissiveColor = new Color3(0.2, 0.8, 0.2); // Green = ready
  rangeLight.material = rangeLightMat;
  rangeLight.parent = root;

  // Create 5 targets in a row
  for (let i = 0; i < 5; i++) {
    const xOffset = (i - 2) * 2;

    // Target ring
    const ring = MeshBuilder.CreateTorus(
      `targetRing${i}`,
      { diameter: 0.8, thickness: 0.08, tessellation: 24 },
      scene
    );
    ring.position = new Vector3(
      rangeCenter.x + xOffset,
      1.5,
      rangeCenter.z - 8 // Far end of range
    );
    ring.rotation.x = Math.PI / 2;
    ring.material = materials.targetMat;
    ring.isVisible = false;
    ring.parent = root;
    targets.push(ring);

    // Target center
    const center = MeshBuilder.CreateSphere(
      `targetCenter${i}`,
      { diameter: 0.25, segments: 8 },
      scene
    );
    center.position = ring.position.clone();
    center.material = materials.targetMat;
    center.isVisible = false;
    center.parent = root;
    targets.push(center);
  }

  // ============================================================================
  // HOLODECK PLATFORMS
  // ============================================================================

  const holoCenter = MODULAR_ROOM_POSITIONS.holodeckCenter;
  const holodeckPlatforms: Mesh[] = [];
  const holodeckObstacles: Mesh[] = [];

  // Create jump training platforms
  const platformPositions = [
    new Vector3(holoCenter.x - 3, 0.5, holoCenter.z + 2),
    new Vector3(holoCenter.x, 1.0, holoCenter.z),
    new Vector3(holoCenter.x + 3, 1.5, holoCenter.z - 2),
    new Vector3(holoCenter.x + 1, 2.0, holoCenter.z - 4),
    new Vector3(holoCenter.x - 2, 0.3, holoCenter.z - 6),
  ];

  for (let i = 0; i < platformPositions.length; i++) {
    const platform = MeshBuilder.CreateBox(
      `holoPlatform${i}`,
      { width: 2, height: 0.3, depth: 2 },
      scene
    );
    platform.position = platformPositions[i];
    platform.material = materials.holoMat;
    platform.isVisible = false; // Hidden until holodeck activates
    platform.parent = root;
    holodeckPlatforms.push(platform);
  }

  // Create crouch obstacle
  const crouchBar = MeshBuilder.CreateBox(
    'crouchObstacle',
    { width: 4, height: 0.3, depth: 0.3 },
    scene
  );
  crouchBar.position = new Vector3(holoCenter.x - 2, 1.0, holoCenter.z - 5);
  crouchBar.material = materials.holoMat;
  crouchBar.isVisible = false;
  crouchBar.parent = root;
  holodeckObstacles.push(crouchBar);

  // ============================================================================
  // INDUSTRIAL PROPS (GLB models for environmental detail)
  // ============================================================================
  // Loads shelf, barrel, machinery, electrical, pipes, boxes, and lamp models
  // and places them in contextually appropriate station rooms.
  // ============================================================================

  const INDUSTRIAL_PROP_MODELS = {
    shelf: '/models/props/industrial/shelf_mx_1.glb',
    barrel1: '/models/props/industrial/metal_barrel_hr_1.glb',
    barrel2: '/models/props/industrial/metal_barrel_hr_2.glb',
    cardboardBox: '/models/props/industrial/cardboard_box_1.glb',
    electricalEquipment: '/models/props/industrial/electrical_equipment_1.glb',
    machinery: '/models/props/industrial/machinery_mx_1.glb',
    pipes: '/models/props/industrial/pipes_hr_1.glb',
    lamp1: '/models/props/industrial/lamp_mx_1_a_on.glb',
    lamp2: '/models/props/industrial/lamp_mx_2_on.glb',
    lamp3: '/models/props/industrial/lamp_mx_3_on.glb',
  };

  interface PropPlacement {
    model: string;
    position: Vector3;
    rotation: number;
    scale: number;
    name: string;
  }

  // Define prop placements relative to room positions from the layout
  const equipBay = MODULAR_ROOM_POSITIONS.equipmentBay;
  const engineRoom = MODULAR_ROOM_POSITIONS.engineRoom;
  const hangar = MODULAR_ROOM_POSITIONS.hangarBay;
  const corridorA = MODULAR_ROOM_POSITIONS.corridorA;

  const propPlacements: PropPlacement[] = [
    // --- Equipment Bay: shelves along walls, barrels near gear ---
    {
      model: INDUSTRIAL_PROP_MODELS.shelf,
      position: new Vector3(equipBay.x - 3, 0, equipBay.z + 2),
      rotation: Math.PI / 2,
      scale: 1.0,
      name: 'prop_shelf_equip_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.shelf,
      position: new Vector3(equipBay.x - 3, 0, equipBay.z - 2),
      rotation: Math.PI / 2,
      scale: 1.0,
      name: 'prop_shelf_equip_2',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.shelf,
      position: new Vector3(equipBay.x + 3, 0, equipBay.z),
      rotation: -Math.PI / 2,
      scale: 1.0,
      name: 'prop_shelf_equip_3',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.barrel1,
      position: new Vector3(equipBay.x + 2, 0, equipBay.z + 2.5),
      rotation: 0,
      scale: 1.0,
      name: 'prop_barrel_equip_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.barrel2,
      position: new Vector3(equipBay.x + 2.6, 0, equipBay.z + 2.0),
      rotation: 0.3,
      scale: 1.0,
      name: 'prop_barrel_equip_2',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.barrel1,
      position: new Vector3(equipBay.x + 1.5, 0, equipBay.z + 3.0),
      rotation: -0.2,
      scale: 1.0,
      name: 'prop_barrel_equip_3',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.cardboardBox,
      position: new Vector3(equipBay.x - 1, 0, equipBay.z + 3),
      rotation: 0.5,
      scale: 1.0,
      name: 'prop_box_equip_1',
    },

    // --- Engine Room: machinery, pipes, electrical equipment ---
    {
      model: INDUSTRIAL_PROP_MODELS.machinery,
      position: new Vector3(engineRoom.x - 2, 0, engineRoom.z + 1),
      rotation: 0,
      scale: 1.0,
      name: 'prop_machinery_engine_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.machinery,
      position: new Vector3(engineRoom.x + 2, 0, engineRoom.z - 1),
      rotation: Math.PI,
      scale: 1.0,
      name: 'prop_machinery_engine_2',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.pipes,
      position: new Vector3(engineRoom.x, 0, engineRoom.z + 3),
      rotation: Math.PI / 2,
      scale: 1.0,
      name: 'prop_pipes_engine_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.electricalEquipment,
      position: new Vector3(engineRoom.x - 3, 0, engineRoom.z - 2),
      rotation: Math.PI / 2,
      scale: 1.0,
      name: 'prop_electrical_engine_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.barrel2,
      position: new Vector3(engineRoom.x + 3, 0, engineRoom.z + 2),
      rotation: 0,
      scale: 1.0,
      name: 'prop_barrel_engine_1',
    },

    // --- Corridor junctions: scattered boxes and barrels for lived-in feel ---
    {
      model: INDUSTRIAL_PROP_MODELS.cardboardBox,
      position: new Vector3(corridorA.x + 1.5, 0, corridorA.z + 4),
      rotation: 0.7,
      scale: 1.0,
      name: 'prop_box_corridor_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.barrel1,
      position: new Vector3(corridorA.x - 1.5, 0, corridorA.z - 2),
      rotation: 0,
      scale: 1.0,
      name: 'prop_barrel_corridor_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.lamp3,
      position: new Vector3(corridorA.x + 1.8, 2.5, corridorA.z),
      rotation: 0,
      scale: 1.0,
      name: 'prop_lamp_corridor_1',
    },

    // --- Hangar Bay: barrels, boxes, equipment near launch area ---
    {
      model: INDUSTRIAL_PROP_MODELS.barrel1,
      position: new Vector3(hangar.x - 4, 0, hangar.z + 2),
      rotation: 0,
      scale: 1.0,
      name: 'prop_barrel_hangar_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.barrel2,
      position: new Vector3(hangar.x - 4.5, 0, hangar.z + 1.2),
      rotation: 0.4,
      scale: 1.0,
      name: 'prop_barrel_hangar_2',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.cardboardBox,
      position: new Vector3(hangar.x + 4, 0, hangar.z + 3),
      rotation: -0.3,
      scale: 1.0,
      name: 'prop_box_hangar_1',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.cardboardBox,
      position: new Vector3(hangar.x + 3.5, 0, hangar.z + 2.5),
      rotation: 0.8,
      scale: 1.0,
      name: 'prop_box_hangar_2',
    },
    {
      model: INDUSTRIAL_PROP_MODELS.electricalEquipment,
      position: new Vector3(hangar.x + 5, 0, hangar.z - 1),
      rotation: -Math.PI / 2,
      scale: 1.0,
      name: 'prop_electrical_hangar_1',
    },
  ];

  // Load all industrial props in parallel (non-blocking; failures are logged but tolerated)
  const industrialProps: AbstractMesh[] = [];

  const propLoadPromises = propPlacements.map(async (placement) => {
    try {
      const result = await SceneLoader.ImportMeshAsync('', placement.model, '', scene);
      const propRoot = new TransformNode(placement.name, scene);
      propRoot.position = placement.position;
      propRoot.rotation.y = placement.rotation;
      propRoot.scaling.setAll(placement.scale);
      propRoot.parent = root;

      for (const mesh of result.meshes) {
        if (mesh.parent === null || mesh.parent?.name === '__root__') {
          mesh.parent = propRoot;
        }
        mesh.receiveShadows = true;
        mesh.checkCollisions = false; // Decorative only, no collision
        industrialProps.push(mesh);
      }
    } catch (error) {
      console.warn(`[ModularStationEnv] Failed to load prop ${placement.name}:`, error);
    }
  });

  // Wait for all props to finish loading (non-critical; station functions without them)
  await Promise.all(propLoadPromises);
  console.log(
    `[ModularStationEnv] Industrial props loaded: ${industrialProps.length} meshes from ${propPlacements.length} placements`
  );

  // ============================================================================
  // STATE
  // ============================================================================

  let calibrationActive = false;
  let targetsHit = [false, false, false, false, false];
  let rangeCallbacks: ShootingRangeCallbacks | null = null;

  let holodeckActive = false;
  let platformsReached = [false, false, false, false, false];
  let crouchCompleted = false;
  let holoCallbacks: HolodeckCallbacks | null = null;

  // ============================================================================
  // ANIMATION METHODS
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
      suitBody.isVisible = false;
      suitHelmet.isVisible = false;
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
      { frame: 90, value: bayDoorLeft.position.x - doorWidth - 2 },
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
      { frame: 90, value: bayDoorRight.position.x + doorWidth + 2 },
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

  // ============================================================================
  // SHOOTING RANGE METHODS
  // ============================================================================

  const startCalibration = (callbacks: ShootingRangeCallbacks) => {
    calibrationActive = true;
    rangeCallbacks = callbacks;
    targetsHit = [false, false, false, false, false];

    // Change range light to amber (calibrating)
    scene.stopAnimation(rangeLight);
    (rangeLight.material as StandardMaterial).emissiveColor = new Color3(1, 0.6, 0);

    // Show targets progressively
    for (let i = 0; i < 5; i++) {
      const ringIndex = i * 2;
      const centerIndex = i * 2 + 1;

      setTimeout(() => {
        if (targets[ringIndex]) targets[ringIndex].isVisible = true;
        if (targets[centerIndex]) targets[centerIndex].isVisible = true;
      }, i * 500);
    }
  };

  const checkTargetHit = (rayOrigin: Vector3, rayDirection: Vector3): boolean => {
    if (!calibrationActive) return false;

    for (let i = 0; i < 5; i++) {
      if (targetsHit[i]) continue;

      const centerIndex = i * 2 + 1;
      const ringIndex = i * 2;
      const targetCenter = targets[centerIndex];
      if (!targetCenter) continue;

      const targetPos = targetCenter.getAbsolutePosition();
      const hitRadius = 0.4;
      const toTarget = targetPos.subtract(rayOrigin);
      const projection = Vector3.Dot(toTarget, rayDirection);

      if (projection < 0) continue;

      const closestPoint = rayOrigin.add(rayDirection.scale(projection));
      const distance = Vector3.Distance(closestPoint, targetPos);

      if (distance < hitRadius) {
        targetsHit[i] = true;
        targets[centerIndex].isVisible = false;
        targets[ringIndex].isVisible = false;

        rangeCallbacks?.onTargetHit(i);

        if (targetsHit.every((hit) => hit)) {
          calibrationActive = false;
          (rangeLight.material as StandardMaterial).emissiveColor = new Color3(0.2, 0.8, 0.2);
          rangeCallbacks?.onAllTargetsHit();
        }

        return true;
      }
    }

    return false;
  };

  const isCalibrationActive = () => calibrationActive;

  // ============================================================================
  // HOLODECK METHODS
  // ============================================================================

  const startHolodeckTutorial = (callbacks: HolodeckCallbacks) => {
    holodeckActive = true;
    holoCallbacks = callbacks;
    platformsReached = [false, false, false, false, false];
    crouchCompleted = false;

    // Show platforms with wave animation
    for (let i = 0; i < holodeckPlatforms.length; i++) {
      setTimeout(() => {
        holodeckPlatforms[i].isVisible = true;
        // Add slight bob animation
        const bob = new Animation(
          'platformBob',
          'position.y',
          30,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CYCLE
        );
        const baseY = holodeckPlatforms[i].position.y;
        bob.setKeys([
          { frame: 0, value: baseY },
          { frame: 30, value: baseY + 0.1 },
          { frame: 60, value: baseY },
        ]);
        holodeckPlatforms[i].animations = [bob];
        scene.beginAnimation(holodeckPlatforms[i], 0, 60, true);
      }, i * 300);
    }

    // Show crouch obstacle
    setTimeout(
      () => {
        for (const obstacle of holodeckObstacles) {
          obstacle.isVisible = true;
        }
      },
      holodeckPlatforms.length * 300 + 500
    );
  };

  const isHolodeckActive = () => holodeckActive;

  const checkPlatformReached = (position: Vector3): boolean => {
    if (!holodeckActive) return false;

    for (let i = 0; i < holodeckPlatforms.length; i++) {
      if (platformsReached[i]) continue;

      const platform = holodeckPlatforms[i];
      const platPos = platform.position;

      // Check if player is on or near the platform
      const dx = Math.abs(position.x - platPos.x);
      const dz = Math.abs(position.z - platPos.z);
      const dy = position.y - platPos.y;

      if (dx < 1.5 && dz < 1.5 && dy >= 0 && dy < 2) {
        platformsReached[i] = true;
        holoCallbacks?.onPlatformReached(i);

        // Check if all platforms reached
        if (platformsReached.every((r) => r) && crouchCompleted) {
          holodeckActive = false;
          holoCallbacks?.onAllPhasesComplete();
        }

        return true;
      }
    }

    return false;
  };

  const checkCrouchZone = (position: Vector3, isCrouching: boolean): boolean => {
    if (!holodeckActive || crouchCompleted) return false;

    const obstacle = holodeckObstacles[0];
    if (!obstacle) return false;

    const obstaclePos = obstacle.position;
    const dx = Math.abs(position.x - obstaclePos.x);
    const dz = Math.abs(position.z - obstaclePos.z);

    // Player is in crouch zone
    if (dx < 2.5 && dz < 1) {
      if (isCrouching) {
        crouchCompleted = true;
        holoCallbacks?.onCrouchSuccess();

        // Check if all objectives complete
        if (platformsReached.every((r) => r) && crouchCompleted) {
          holodeckActive = false;
          holoCallbacks?.onAllPhasesComplete();
        }

        return true;
      }
    }

    return false;
  };

  // ============================================================================
  // CLEANUP
  // ============================================================================

  const dispose = () => {
    // Dispose station meshes
    stationMeshes.dispose();

    // Dispose interactive elements
    dropPod.dispose();
    podCone.dispose();
    suitLocker.dispose();
    suitBody.dispose();
    suitHelmet.dispose();
    bayDoorLeft.dispose();
    bayDoorRight.dispose();
    doorLightLeft.dispose();
    doorLightRight.dispose();
    rangeLight.dispose();

    for (const target of targets) {
      target.dispose();
    }

    for (const platform of holodeckPlatforms) {
      platform.dispose();
    }

    for (const obstacle of holodeckObstacles) {
      obstacle.dispose();
    }

    // Dispose industrial props
    for (const prop of industrialProps) {
      prop.dispose();
    }

    // Dispose lights
    for (const light of lights) {
      light.dispose();
    }

    // Dispose materials
    for (const mat of Object.values(materials)) {
      mat.dispose();
    }

    root.dispose();
  };

  // ============================================================================
  // RETURN ENVIRONMENT OBJECT
  // ============================================================================

  return {
    root,
    stationMeshes,
    dropPod,
    suitLocker,
    suitBody,
    suitHelmet,
    bayDoorLeft,
    bayDoorRight,
    rangeLight,
    targets,
    holodeckPlatforms,
    holodeckObstacles,
    industrialProps,
    lights,
    playEquipSuit,
    playDepressurize,
    playOpenBayDoors,
    playEnterPod,
    playLaunch,
    startCalibration,
    checkTargetHit,
    isCalibrationActive,
    startHolodeckTutorial,
    isHolodeckActive,
    checkPlatformReached,
    checkCrouchZone,
    dispose,
  };
}
