import { Animation } from '@babylonjs/core/Animations/animation';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { createStationMaterials, disposeMaterials } from './materials';

export interface ShootingRangeCallbacks {
  onTargetHit: (targetIndex: number) => void;
  onAllTargetsHit: () => void;
}

export interface StationEnvironment {
  root: TransformNode;
  dropPod: Mesh;
  viewport: Mesh;
  equipmentRack: Mesh;
  shootingRange: TransformNode;
  innerDoor: Mesh;
  bayDoorLeft: Mesh;
  bayDoorRight: Mesh;
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
  dispose: () => void;
}

// Create the space base environment - corridors, pipes, perspex windows
export function createStationEnvironment(scene: Scene): StationEnvironment {
  const root = new TransformNode('anchorStation', scene);
  const materials = createStationMaterials(scene);
  const lights: PointLight[] = [];
  const allMeshes: Mesh[] = [];

  // Corridor dimensions - longer to accommodate hangar bay
  const prepBayLength = 25;
  const hangarLength = 30;
  const totalLength = prepBayLength + hangarLength;
  const corridorWidth = 10;
  const corridorHeight = 6;

  // === FLOOR ===
  const floor = MeshBuilder.CreateBox(
    'floor',
    {
      width: corridorWidth,
      height: 0.3,
      depth: totalLength,
    },
    scene
  );
  floor.position.y = -0.15;
  floor.position.z = -totalLength / 2;
  floor.material = materials.get('floor')!;
  floor.parent = root;
  allMeshes.push(floor);

  // Floor grating pattern
  for (let z = 2; z < totalLength - 5; z += 2.5) {
    for (let x = -corridorWidth / 2 + 1.5; x < corridorWidth / 2 - 1; x += 2.5) {
      const grate = MeshBuilder.CreateBox(
        'grate',
        {
          width: 2,
          height: 0.08,
          depth: 2,
        },
        scene
      );
      grate.position.set(x, 0.02, -z);
      grate.material = materials.get('hull')!;
      grate.parent = root;
      allMeshes.push(grate);
    }
  }

  // Guide line on floor
  const guideLine = MeshBuilder.CreateBox(
    'guideLine',
    {
      width: 0.25,
      height: 0.04,
      depth: totalLength - 12,
    },
    scene
  );
  guideLine.position.set(0, 0.025, -totalLength / 2 + 4);
  guideLine.material = materials.get('guide')!;
  guideLine.parent = root;
  allMeshes.push(guideLine);

  // === WALLS - PREP BAY SECTION ===
  for (let side = -1; side <= 1; side += 2) {
    // Lower wall section
    const lowerWall = MeshBuilder.CreateBox(
      'lowerWall',
      {
        width: 0.4,
        height: 2,
        depth: prepBayLength,
      },
      scene
    );
    lowerWall.position.set(side * (corridorWidth / 2 + 0.2), 1, -prepBayLength / 2);
    lowerWall.material = materials.get('hull')!;
    lowerWall.parent = root;
    allMeshes.push(lowerWall);

    // Upper wall section
    const upperWall = MeshBuilder.CreateBox(
      'upperWall',
      {
        width: 0.4,
        height: 1.5,
        depth: prepBayLength,
      },
      scene
    );
    upperWall.position.set(
      side * (corridorWidth / 2 + 0.2),
      corridorHeight - 0.75,
      -prepBayLength / 2
    );
    upperWall.material = materials.get('hull')!;
    upperWall.parent = root;
    allMeshes.push(upperWall);

    // Windows in prep bay
    for (let z = 8; z < prepBayLength - 5; z += 8) {
      const frame = MeshBuilder.CreateBox(
        'windowFrame',
        {
          width: 0.5,
          height: 2.5,
          depth: 6,
        },
        scene
      );
      frame.position.set(side * (corridorWidth / 2 + 0.1), 3.25, -z);
      frame.material = materials.get('windowFrame')!;
      frame.parent = root;
      allMeshes.push(frame);

      const glass = MeshBuilder.CreateBox(
        'window',
        {
          width: 0.1,
          height: 2.2,
          depth: 5.5,
        },
        scene
      );
      glass.position.set(side * (corridorWidth / 2 - 0.05), 3.25, -z);
      glass.material = materials.get('window')!;
      glass.parent = root;
      allMeshes.push(glass);
    }
  }

  // === EQUIPMENT RACK ===
  const equipmentRackContainer = new TransformNode('equipmentRackContainer', scene);
  equipmentRackContainer.position.set(-3.5, 0, -18);
  equipmentRackContainer.parent = root;

  // Rack frame
  const rackFrame = MeshBuilder.CreateBox(
    'rackFrame',
    {
      width: 2,
      height: 2.5,
      depth: 0.5,
    },
    scene
  );
  rackFrame.position.y = 1.25;
  rackFrame.material = materials.get('hull')!;
  rackFrame.parent = equipmentRackContainer;
  allMeshes.push(rackFrame);

  // Suit silhouette on rack
  const suitBody = MeshBuilder.CreateCapsule(
    'suitBody',
    {
      height: 1.6,
      radius: 0.3,
    },
    scene
  );
  suitBody.position.set(0, 1.3, 0.1);
  suitBody.material = materials.get('pod')!;
  suitBody.parent = equipmentRackContainer;
  allMeshes.push(suitBody);

  // Suit helmet
  const suitHelmet = MeshBuilder.CreateSphere(
    'suitHelmet',
    {
      diameter: 0.5,
      segments: 12,
    },
    scene
  );
  suitHelmet.position.set(0, 2.2, 0.1);
  suitHelmet.material = materials.get('pod')!;
  suitHelmet.parent = equipmentRackContainer;
  allMeshes.push(suitHelmet);

  // Interaction indicator light
  const rackLight = MeshBuilder.CreateSphere(
    'rackLight',
    {
      diameter: 0.15,
    },
    scene
  );
  rackLight.position.set(0, 2.6, 0.3);
  rackLight.material = materials.get('active')!;
  rackLight.parent = equipmentRackContainer;
  allMeshes.push(rackLight);

  // Pulsing animation for rack light
  const rackPulse = new Animation(
    'rackPulse',
    'material.emissiveColor',
    30,
    Animation.ANIMATIONTYPE_COLOR3,
    Animation.ANIMATIONLOOPMODE_CYCLE
  );
  rackPulse.setKeys([
    { frame: 0, value: new Color3(0, 1, 0.25) },
    { frame: 15, value: new Color3(0, 0.3, 0.1) },
    { frame: 30, value: new Color3(0, 1, 0.25) },
  ]);
  rackLight.animations.push(rackPulse);
  scene.beginAnimation(rackLight, 0, 30, true);

  const equipmentRack = rackFrame; // Reference for interaction

  // === SHOOTING RANGE (opposite side from equipment rack) ===
  const shootingRangeContainer = new TransformNode('shootingRangeContainer', scene);
  shootingRangeContainer.position.set(3.5, 0, -18);
  shootingRangeContainer.parent = root;

  // Range booth/terminal
  const rangeBooth = MeshBuilder.CreateBox(
    'rangeBooth',
    {
      width: 1.5,
      height: 1.2,
      depth: 0.8,
    },
    scene
  );
  rangeBooth.position.set(0, 0.6, 0);
  rangeBooth.material = materials.get('hull')!;
  rangeBooth.parent = shootingRangeContainer;
  allMeshes.push(rangeBooth);

  // Range screen (holographic display area)
  const rangeScreen = MeshBuilder.CreatePlane(
    'rangeScreen',
    {
      width: 1.2,
      height: 0.8,
    },
    scene
  );
  rangeScreen.position.set(0, 1.5, -0.1);
  rangeScreen.material = materials.get('window')!;
  rangeScreen.parent = shootingRangeContainer;
  allMeshes.push(rangeScreen);

  // Range indicator light
  const rangeLight = MeshBuilder.CreateSphere(
    'rangeLight',
    {
      diameter: 0.12,
    },
    scene
  );
  rangeLight.position.set(0.6, 1.3, 0.3);
  rangeLight.material = materials.get('active')!;
  rangeLight.parent = shootingRangeContainer;
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

  // Target area (back wall behind player when at range)
  const targetBackdrop = MeshBuilder.CreateBox(
    'targetBackdrop',
    {
      width: 3,
      height: 2.5,
      depth: 0.2,
    },
    scene
  );
  targetBackdrop.position.set(0, 1.5, 3);
  targetBackdrop.material = materials.get('hull')!;
  targetBackdrop.parent = shootingRangeContainer;
  allMeshes.push(targetBackdrop);

  // Create holographic targets (initially invisible)
  const targets: Mesh[] = [];
  const targetPositions = [
    new Vector3(-0.8, 1.8, 2.8),
    new Vector3(0.8, 1.2, 2.8),
    new Vector3(0, 2.0, 2.8),
    new Vector3(-0.5, 1.0, 2.8),
    new Vector3(0.6, 1.6, 2.8),
  ];

  for (let i = 0; i < 5; i++) {
    // Outer ring
    const targetRing = MeshBuilder.CreateTorus(
      `targetRing_${i}`,
      {
        diameter: 0.4,
        thickness: 0.03,
        tessellation: 24,
      },
      scene
    );
    targetRing.position = targetPositions[i].clone();
    targetRing.position.x += shootingRangeContainer.position.x;
    targetRing.position.z += shootingRangeContainer.position.z;
    targetRing.rotation.x = Math.PI / 2;

    // Create new material for target ring (don't clone - can cause issues)
    const targetMat = new StandardMaterial(`targetMat_${i}`, scene);
    targetMat.emissiveColor = new Color3(1, 0.3, 0);
    targetMat.diffuseColor = new Color3(0.3, 0.1, 0);
    targetRing.material = targetMat;
    targetRing.isVisible = false;
    targetRing.parent = root;
    allMeshes.push(targetRing);

    // Center point (hit detection)
    const targetCenter = MeshBuilder.CreateDisc(
      `targetCenter_${i}`,
      {
        radius: 0.12,
        tessellation: 16,
      },
      scene
    );
    targetCenter.position = targetPositions[i].clone();
    targetCenter.position.x += shootingRangeContainer.position.x;
    targetCenter.position.z += shootingRangeContainer.position.z - 0.01;

    // Create new material for center
    const centerMat = new StandardMaterial(`centerMat_${i}`, scene);
    centerMat.emissiveColor = new Color3(1, 0, 0);
    centerMat.diffuseColor = new Color3(0.3, 0, 0);
    targetCenter.material = centerMat;
    targetCenter.isVisible = false;
    targetCenter.parent = root;
    allMeshes.push(targetCenter);

    targets.push(targetCenter);
    targets.push(targetRing);
  }

  // Shooting range state
  let calibrationActive = false;
  let targetsHit: boolean[] = [false, false, false, false, false];
  let rangeCallbacks: ShootingRangeCallbacks | null = null;

  // === CEILING ===
  const ceiling = MeshBuilder.CreateBox(
    'ceiling',
    {
      width: corridorWidth,
      height: 0.4,
      depth: totalLength,
    },
    scene
  );
  ceiling.position.y = corridorHeight + 0.2;
  ceiling.position.z = -totalLength / 2;
  ceiling.material = materials.get('hull')!;
  ceiling.parent = root;
  allMeshes.push(ceiling);

  // === OVERHEAD PIPES ===
  for (let i = 0; i < 4; i++) {
    const pipeX = -3 + i * 2;
    const pipe = MeshBuilder.CreateCylinder(
      `pipe_${i}`,
      {
        height: totalLength,
        diameter: 0.25 + (i % 2) * 0.1,
        tessellation: 8,
      },
      scene
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(pipeX, corridorHeight - 0.3, -totalLength / 2);
    pipe.material = materials.get('pipe')!;
    pipe.parent = root;
    allMeshes.push(pipe);
  }

  // === INNER AIRLOCK DOOR (between prep bay and hangar) ===
  const innerDoorFrame = MeshBuilder.CreateBox(
    'innerDoorFrame',
    {
      width: corridorWidth + 1,
      height: corridorHeight + 0.5,
      depth: 1,
    },
    scene
  );
  innerDoorFrame.position.set(0, corridorHeight / 2, -prepBayLength);
  innerDoorFrame.material = materials.get('hull')!;
  innerDoorFrame.parent = root;
  allMeshes.push(innerDoorFrame);

  // Door opening (hole in frame)
  const innerDoor = MeshBuilder.CreateBox(
    'innerDoor',
    {
      width: 4,
      height: corridorHeight - 0.5,
      depth: 0.3,
    },
    scene
  );
  innerDoor.position.set(0, corridorHeight / 2, -prepBayLength);
  innerDoor.material = materials.get('windowFrame')!;
  innerDoor.parent = root;
  allMeshes.push(innerDoor);

  // Door status lights
  const doorLightLeft = MeshBuilder.CreateSphere('doorLightL', { diameter: 0.2 }, scene);
  doorLightLeft.position.set(-2.5, corridorHeight - 0.5, -prepBayLength + 0.6);
  doorLightLeft.material = materials.get('active')!;
  doorLightLeft.parent = root;
  allMeshes.push(doorLightLeft);

  const doorLightRight = MeshBuilder.CreateSphere('doorLightR', { diameter: 0.2 }, scene);
  doorLightRight.position.set(2.5, corridorHeight - 0.5, -prepBayLength + 0.6);
  doorLightRight.material = materials.get('active')!;
  doorLightRight.parent = root;
  allMeshes.push(doorLightRight);

  // === HANGAR BAY SECTION ===
  const hangarStart = -prepBayLength;

  // Hangar walls - taller, industrial
  for (let side = -1; side <= 1; side += 2) {
    const hangarWall = MeshBuilder.CreateBox(
      'hangarWall',
      {
        width: 0.5,
        height: corridorHeight + 2,
        depth: hangarLength - 5,
      },
      scene
    );
    hangarWall.position.set(
      side * (corridorWidth / 2 + 0.25),
      (corridorHeight + 2) / 2,
      hangarStart - hangarLength / 2 + 2.5
    );
    hangarWall.material = materials.get('hull')!;
    hangarWall.parent = root;
    allMeshes.push(hangarWall);
  }

  // === BAY DOORS (at the end, open to space) ===
  const bayDoorHeight = corridorHeight + 2;
  const bayDoorWidth = corridorWidth / 2 + 0.5;

  // Left bay door
  const bayDoorLeft = MeshBuilder.CreateBox(
    'bayDoorLeft',
    {
      width: bayDoorWidth,
      height: bayDoorHeight,
      depth: 0.5,
    },
    scene
  );
  bayDoorLeft.position.set(-bayDoorWidth / 2 + 0.25, bayDoorHeight / 2, -totalLength + 2);
  bayDoorLeft.material = materials.get('hull')!;
  bayDoorLeft.parent = root;
  allMeshes.push(bayDoorLeft);

  // Right bay door
  const bayDoorRight = MeshBuilder.CreateBox(
    'bayDoorRight',
    {
      width: bayDoorWidth,
      height: bayDoorHeight,
      depth: 0.5,
    },
    scene
  );
  bayDoorRight.position.set(bayDoorWidth / 2 - 0.25, bayDoorHeight / 2, -totalLength + 2);
  bayDoorRight.material = materials.get('hull')!;
  bayDoorRight.parent = root;
  allMeshes.push(bayDoorRight);

  // Caution stripes on bay doors
  for (let y = 1; y < bayDoorHeight - 1; y += 1.5) {
    for (const door of [bayDoorLeft, bayDoorRight]) {
      const stripe = MeshBuilder.CreateBox(
        'stripe',
        {
          width: bayDoorWidth - 0.2,
          height: 0.3,
          depth: 0.52,
        },
        scene
      );
      stripe.position.set(0, y - bayDoorHeight / 2 + 0.5, 0);
      stripe.material = y % 2 === 0 ? materials.get('caution')! : materials.get('emergency')!;
      stripe.parent = door;
      allMeshes.push(stripe);
    }
  }

  // === DROP POD PLATFORM ===
  const podPlatformZ = -totalLength + 8;

  const platform = MeshBuilder.CreateCylinder(
    'platform',
    {
      height: 0.2,
      diameter: 5,
      tessellation: 16,
    },
    scene
  );
  platform.position.set(0, 0.1, podPlatformZ);
  platform.material = materials.get('hull')!;
  platform.parent = root;
  allMeshes.push(platform);

  // === DROP POD HELL-7 ===
  const dropPod = MeshBuilder.CreateCylinder(
    'podBody',
    {
      height: 2.5,
      diameter: 2,
      tessellation: 12,
    },
    scene
  );
  dropPod.position.set(0, 1.5, podPlatformZ);
  dropPod.material = materials.get('pod')!;
  dropPod.parent = root;
  allMeshes.push(dropPod);

  const podCone = MeshBuilder.CreateCylinder(
    'podCone',
    {
      height: 1.2,
      diameterTop: 0,
      diameterBottom: 2,
      tessellation: 12,
    },
    scene
  );
  podCone.position.set(0, 3.3, podPlatformZ);
  podCone.material = materials.get('pod')!;
  podCone.parent = root;
  allMeshes.push(podCone);

  // Pod status lights
  for (let i = 0; i < 3; i++) {
    const statusLight = MeshBuilder.CreateSphere(`podStatus_${i}`, { diameter: 0.1 }, scene);
    statusLight.position.set(-0.4 + i * 0.4, 2.6, podPlatformZ + 1.03);
    statusLight.material = materials.get('active')!;
    statusLight.parent = root;
    allMeshes.push(statusLight);
  }

  // === VIEWPORT (placeholder, will be replaced by open bay doors) ===
  const viewport = MeshBuilder.CreateBox(
    'viewport',
    {
      width: 0.1,
      height: 0.1,
      depth: 0.1,
    },
    scene
  );
  viewport.position.set(0, 0, -totalLength);
  viewport.isVisible = false;
  viewport.parent = root;
  allMeshes.push(viewport);

  // === LIGHTING ===
  // Prep bay lights
  for (let z = 5; z < prepBayLength - 3; z += 8) {
    const light = new PointLight(`prepLight_${z}`, new Vector3(0, corridorHeight - 0.5, -z), scene);
    light.diffuse = new Color3(0.8, 0.9, 1.0);
    light.intensity = 0.6;
    light.range = 15;
    lights.push(light);
  }

  // Hangar bay lights - more industrial orange
  for (let z = prepBayLength + 5; z < totalLength - 5; z += 10) {
    const light = new PointLight(`hangarLight_${z}`, new Vector3(0, corridorHeight + 1, -z), scene);
    light.diffuse = new Color3(1.0, 0.8, 0.6);
    light.intensity = 0.5;
    light.range = 20;
    lights.push(light);
  }

  // Emergency lights
  for (let z = 0; z < totalLength; z += 15) {
    const emergencyLight = MeshBuilder.CreateSphere('emergencyLight', { diameter: 0.2 }, scene);
    emergencyLight.position.set(0, corridorHeight - 0.2, -z);
    emergencyLight.material = materials.get('emergency')!;
    emergencyLight.parent = root;
    allMeshes.push(emergencyLight);

    const pulseAnim = new Animation(
      'pulse',
      'material.emissiveColor',
      30,
      Animation.ANIMATIONTYPE_COLOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    pulseAnim.setKeys([
      { frame: 0, value: new Color3(1, 0, 0) },
      { frame: 15, value: new Color3(0.3, 0, 0) },
      { frame: 30, value: new Color3(1, 0, 0) },
    ]);
    emergencyLight.animations.push(pulseAnim);
    scene.beginAnimation(emergencyLight, 0, 30, true);
  }

  // === ANIMATION FUNCTIONS ===

  // Equip suit animation - suit disappears, HUD flash
  const playEquipSuit = (callback: () => void) => {
    // Fade out suit
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
      // Stop rack light pulsing, turn solid
      scene.stopAnimation(rackLight);
      (rackLight.material as StandardMaterial).emissiveColor = new Color3(0.2, 0.2, 0.2);
      callback();
    });
  };

  // Depressurize - change door lights to red, play alarm effect
  const playDepressurize = (callback: () => void) => {
    // Change door lights to red (cycling)
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

  // Open bay doors - dramatic sliding animation
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
      { frame: 90, value: bayDoorLeft.position.x - bayDoorWidth - 1 },
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
      { frame: 90, value: bayDoorRight.position.x + bayDoorWidth + 1 },
    ]);

    bayDoorLeft.animations = [doorOpenLeft];
    bayDoorRight.animations = [doorOpenRight];

    scene.beginAnimation(bayDoorLeft, 0, 90, false);
    scene.beginAnimation(bayDoorRight, 0, 90, false, 1, callback);
  };

  // Enter pod - pod door close effect
  const playEnterPod = (callback: () => void) => {
    // Flash pod lights
    setTimeout(callback, 1500);
  };

  // Launch - pod drops away
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
      { frame: 60, value: dropPod.position.y - 50 },
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
      { frame: 60, value: podCone.position.y - 50 },
    ]);

    dropPod.animations = [podDrop];
    podCone.animations = [coneDrop];

    scene.beginAnimation(dropPod, 0, 60, false);
    scene.beginAnimation(podCone, 0, 60, false, 1, callback);
  };

  // Start calibration mini-game
  const startCalibration = (callbacks: ShootingRangeCallbacks) => {
    calibrationActive = true;
    rangeCallbacks = callbacks;
    targetsHit = [false, false, false, false, false];

    // Stop range light pulsing, make it amber (active range)
    scene.stopAnimation(rangeLight);
    (rangeLight.material as StandardMaterial).emissiveColor = new Color3(1, 0.6, 0);

    // Show all targets with staggered animation
    for (let i = 0; i < 5; i++) {
      const ringIndex = i * 2 + 1;
      const centerIndex = i * 2;

      setTimeout(() => {
        if (targets[ringIndex]) targets[ringIndex].isVisible = true;
        if (targets[centerIndex]) targets[centerIndex].isVisible = true;

        // Pulse animation on appearance
        const targetMat = targets[ringIndex].material as StandardMaterial;
        const originalColor = targetMat.emissiveColor.clone();
        targetMat.emissiveColor = new Color3(1, 1, 1);
        setTimeout(() => {
          targetMat.emissiveColor = originalColor;
        }, 100);
      }, i * 200);
    }
  };

  // Check if ray hits a target
  const checkTargetHit = (rayOrigin: Vector3, rayDirection: Vector3): boolean => {
    if (!calibrationActive) return false;

    // Simple ray-sphere intersection for each unhit target
    for (let i = 0; i < 5; i++) {
      if (targetsHit[i]) continue;

      const centerIndex = i * 2;
      const ringIndex = i * 2 + 1;
      const targetCenter = targets[centerIndex];
      if (!targetCenter) continue;

      // Get target world position
      const targetPos = targetCenter.getAbsolutePosition();

      // Ray-sphere intersection (generous hit radius)
      const hitRadius = 0.25;
      const toTarget = targetPos.subtract(rayOrigin);
      const projection = Vector3.Dot(toTarget, rayDirection);

      if (projection < 0) continue; // Target behind ray

      const closestPoint = rayOrigin.add(rayDirection.scale(projection));
      const distance = Vector3.Distance(closestPoint, targetPos);

      if (distance <= hitRadius) {
        // Hit!
        targetsHit[i] = true;

        // Visual feedback - flash green then hide
        const ringMat = targets[ringIndex].material as StandardMaterial;
        const centerMat = targetCenter.material as StandardMaterial;

        ringMat.emissiveColor = new Color3(0, 1, 0.3);
        centerMat.emissiveColor = new Color3(0, 1, 0.3);

        setTimeout(() => {
          targets[ringIndex].isVisible = false;
          targetCenter.isVisible = false;
        }, 150);

        rangeCallbacks?.onTargetHit(i);

        // Check if all targets hit
        if (targetsHit.every((hit) => hit)) {
          calibrationActive = false;
          // Range light back to green
          (rangeLight.material as StandardMaterial).emissiveColor = new Color3(0, 1, 0.25);
          rangeCallbacks?.onAllTargetsHit();
        }

        return true;
      }
    }

    return false;
  };

  const isCalibrationActive = () => calibrationActive;

  // Dispose function
  const dispose = () => {
    for (const mesh of allMeshes) {
      mesh.dispose();
    }
    for (const light of lights) {
      light.dispose();
    }
    disposeMaterials(materials);
    root.dispose();
  };

  return {
    root,
    dropPod,
    viewport,
    equipmentRack,
    shootingRange: shootingRangeContainer,
    innerDoor,
    bayDoorLeft,
    bayDoorRight,
    lights,
    playEquipSuit,
    playDepressurize,
    playOpenBayDoors,
    playEnterPod,
    playLaunch,
    startCalibration,
    checkTargetHit,
    isCalibrationActive,
    dispose,
  };
}
