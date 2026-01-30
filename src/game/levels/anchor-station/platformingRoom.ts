import type { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

// ============================================================================
// PLATFORMING ROOM GEOMETRY AND STATE
// Military training facility with platforms, gaps, and low passages
// ============================================================================

export interface PlatformingCallbacks {
  onJumpComplete: () => void;
  onCrouchComplete: () => void;
  onPlatformingComplete: () => void;
}

export interface PlatformingRoomState {
  platformColliders: Mesh[];
  jumpPromptSign: Mesh;
  crouchPromptSign: Mesh;
  jumpCheckmark: Mesh;
  crouchCheckmark: Mesh;
  jumpCheckMat: StandardMaterial;
  crouchCheckMat: StandardMaterial;
  jumpPromptMat: StandardMaterial;
  crouchPromptMat: StandardMaterial;
  jumpZoneMin: Vector3;
  jumpZoneMax: Vector3;
  crouchZoneMin: Vector3;
  crouchZoneMax: Vector3;
  // State tracking
  isActive: () => boolean;
  startPlatformingTutorial: (callbacks: PlatformingCallbacks) => void;
  checkJumpZone: (playerPosition: Vector3, isJumping: boolean) => boolean;
  checkCrouchZone: (playerPosition: Vector3, isCrouching: boolean) => boolean;
  getPlatformColliders: () => Mesh[];
}

export interface CreatePlatformingRoomParams {
  scene: Scene;
  parent: TransformNode;
  roomCenter: Vector3;
  roomWidth: number;
  roomDepth: number;
  roomHeight: number;
  materials: Map<string, StandardMaterial>;
  allMeshes: Mesh[];
  lights: PointLight[];
  addCeilingLight: (
    scene: Scene,
    parent: TransformNode,
    position: Vector3,
    color: Color3,
    intensity: number,
    lights: PointLight[],
    materials: Map<string, StandardMaterial>,
    allMeshes: Mesh[]
  ) => PointLight;
}

export function createPlatformingRoom(params: CreatePlatformingRoomParams): PlatformingRoomState {
  const {
    scene,
    parent,
    roomCenter,
    roomWidth,
    roomDepth,
    roomHeight,
    materials,
    allMeshes,
    lights,
    addCeilingLight,
  } = params;

  // === PLATFORM COLLIDERS (for physics) ===
  const platformColliders: Mesh[] = [];

  // === PLATFORM 1 - Starting platform ===
  const platform1 = MeshBuilder.CreateBox('platform1', { width: 3, height: 0.3, depth: 3 }, scene);
  platform1.position = new Vector3(roomCenter.x + 3, 0.15, roomCenter.z + 5);
  platform1.material = materials.get('hull')!;
  platform1.parent = parent;
  allMeshes.push(platform1);
  platformColliders.push(platform1);

  const rail1a = MeshBuilder.CreateBox('rail1a', { width: 3, height: 0.8, depth: 0.1 }, scene);
  rail1a.position = new Vector3(0, 0.55, -1.45);
  rail1a.material = materials.get('caution')!;
  rail1a.parent = platform1;
  allMeshes.push(rail1a);

  // === PLATFORM 2 - Mid-height (requires jump) ===
  const platform2 = MeshBuilder.CreateBox('platform2', { width: 3, height: 0.3, depth: 3 }, scene);
  platform2.position = new Vector3(roomCenter.x, 0.95, roomCenter.z + 2);
  platform2.material = materials.get('hull')!;
  platform2.parent = parent;
  allMeshes.push(platform2);
  platformColliders.push(platform2);

  const stripe2a = MeshBuilder.CreateBox('stripe2a', { width: 3, height: 0.05, depth: 0.3 }, scene);
  stripe2a.position = new Vector3(0, 0.18, 1.35);
  stripe2a.material = materials.get('caution')!;
  stripe2a.parent = platform2;
  allMeshes.push(stripe2a);

  const stripe2b = MeshBuilder.CreateBox('stripe2b', { width: 3, height: 0.05, depth: 0.3 }, scene);
  stripe2b.position = new Vector3(0, 0.18, -1.35);
  stripe2b.material = materials.get('caution')!;
  stripe2b.parent = platform2;
  allMeshes.push(stripe2b);

  // === PLATFORM 3 - Higher platform ===
  const platform3 = MeshBuilder.CreateBox('platform3', { width: 3, height: 0.3, depth: 3 }, scene);
  platform3.position = new Vector3(roomCenter.x - 3, 1.45, roomCenter.z - 1);
  platform3.material = materials.get('hull')!;
  platform3.parent = parent;
  allMeshes.push(platform3);
  platformColliders.push(platform3);

  const rail3a = MeshBuilder.CreateBox('rail3a', { width: 0.1, height: 0.8, depth: 3 }, scene);
  rail3a.position = new Vector3(-1.45, 0.55, 0);
  rail3a.material = materials.get('caution')!;
  rail3a.parent = platform3;
  allMeshes.push(rail3a);

  // === LOW PASSAGE STRUCTURE - Requires crouch ===
  const crouchPassageFrame = new TransformNode('crouchPassageFrame', scene);
  crouchPassageFrame.position = new Vector3(roomCenter.x - 4, 0, roomCenter.z - 4.5);
  crouchPassageFrame.parent = parent;

  const passageWallLeft = MeshBuilder.CreateBox(
    'passageWallLeft',
    { width: 0.3, height: roomHeight, depth: 4 },
    scene
  );
  passageWallLeft.position = new Vector3(-1.5, roomHeight / 2, 0);
  passageWallLeft.material = materials.get('hull')!;
  passageWallLeft.parent = crouchPassageFrame;
  allMeshes.push(passageWallLeft);

  const passageWallRight = MeshBuilder.CreateBox(
    'passageWallRight',
    { width: 0.3, height: roomHeight, depth: 4 },
    scene
  );
  passageWallRight.position = new Vector3(1.5, roomHeight / 2, 0);
  passageWallRight.material = materials.get('hull')!;
  passageWallRight.parent = crouchPassageFrame;
  allMeshes.push(passageWallRight);

  // Low ceiling - crouch height ~1.0m
  const passageCeiling = MeshBuilder.CreateBox(
    'passageCeiling',
    { width: 3, height: 0.5, depth: 4 },
    scene
  );
  passageCeiling.position = new Vector3(0, 1.25, 0);
  passageCeiling.material = materials.get('hull')!;
  passageCeiling.parent = crouchPassageFrame;
  allMeshes.push(passageCeiling);
  platformColliders.push(passageCeiling);

  // Warning stripes
  const passageStripe1 = MeshBuilder.CreateBox(
    'passageStripe1',
    { width: 2.7, height: 0.15, depth: 0.05 },
    scene
  );
  passageStripe1.position = new Vector3(0, 1.0, 2);
  passageStripe1.material = materials.get('caution')!;
  passageStripe1.parent = crouchPassageFrame;
  allMeshes.push(passageStripe1);

  const passageStripe2 = MeshBuilder.CreateBox(
    'passageStripe2',
    { width: 2.7, height: 0.15, depth: 0.05 },
    scene
  );
  passageStripe2.position = new Vector3(0, 1.0, -2);
  passageStripe2.material = materials.get('caution')!;
  passageStripe2.parent = crouchPassageFrame;
  allMeshes.push(passageStripe2);

  const passageLight1 = MeshBuilder.CreateSphere('passageLight1', { diameter: 0.1 }, scene);
  passageLight1.position = new Vector3(0, 0.9, 0);
  passageLight1.material = materials.get('emergency')!;
  passageLight1.parent = crouchPassageFrame;
  allMeshes.push(passageLight1);

  // === FINAL PLATFORM - End of course ===
  const platform4 = MeshBuilder.CreateBox('platform4', { width: 4, height: 0.3, depth: 4 }, scene);
  platform4.position = new Vector3(roomCenter.x - 4, 0.15, roomCenter.z - 6.5);
  platform4.material = materials.get('hull')!;
  platform4.parent = parent;
  allMeshes.push(platform4);
  platformColliders.push(platform4);

  const completionMarker = MeshBuilder.CreateCylinder(
    'completionMarker',
    { height: 0.05, diameter: 2, tessellation: 16 },
    scene
  );
  completionMarker.position = new Vector3(0, 0.18, 0);
  completionMarker.material = materials.get('active')!;
  completionMarker.parent = platform4;
  allMeshes.push(completionMarker);

  // === PLATFORMING ROOM LIGHTS ===
  addCeilingLight(
    scene,
    parent,
    new Vector3(roomCenter.x + 3, roomHeight - 0.2, roomCenter.z + 4),
    new Color3(0.9, 0.95, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );
  addCeilingLight(
    scene,
    parent,
    new Vector3(roomCenter.x - 2, roomHeight - 0.2, roomCenter.z),
    new Color3(0.9, 0.95, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );
  addCeilingLight(
    scene,
    parent,
    new Vector3(roomCenter.x - 4, roomHeight - 0.2, roomCenter.z - 6),
    new Color3(0.9, 0.95, 1),
    0.6,
    lights,
    materials,
    allMeshes
  );

  // === VISUAL PROMPTS ===
  const jumpPromptSign = MeshBuilder.CreatePlane(
    'jumpPromptSign',
    { width: 2, height: 0.5 },
    scene
  );
  jumpPromptSign.position = new Vector3(roomCenter.x + 1.5, 2.5, roomCenter.z + 3.5);
  jumpPromptSign.rotation.y = Math.PI / 4;
  const jumpPromptMat = new StandardMaterial('jumpPromptMat', scene);
  jumpPromptMat.emissiveColor = new Color3(0, 0.8, 0.3);
  jumpPromptMat.diffuseColor = Color3.Black();
  jumpPromptSign.material = jumpPromptMat;
  jumpPromptSign.isVisible = false;
  jumpPromptSign.parent = parent;
  allMeshes.push(jumpPromptSign);

  const crouchPromptSign = MeshBuilder.CreatePlane(
    'crouchPromptSign',
    { width: 2, height: 0.5 },
    scene
  );
  crouchPromptSign.position = new Vector3(roomCenter.x - 2.5, 2.5, roomCenter.z - 2.5);
  crouchPromptSign.rotation.y = Math.PI / 4;
  const crouchPromptMat = new StandardMaterial('crouchPromptMat', scene);
  crouchPromptMat.emissiveColor = new Color3(0, 0.8, 0.3);
  crouchPromptMat.diffuseColor = Color3.Black();
  crouchPromptSign.material = crouchPromptMat;
  crouchPromptSign.isVisible = false;
  crouchPromptSign.parent = parent;
  allMeshes.push(crouchPromptSign);

  // Checkmark indicators
  const jumpCheckmark = MeshBuilder.CreateSphere('jumpCheckmark', { diameter: 0.2 }, scene);
  jumpCheckmark.position = new Vector3(roomCenter.x, 2, roomCenter.z + 2);
  const jumpCheckMat = new StandardMaterial('jumpCheckMat', scene);
  jumpCheckMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  jumpCheckMat.diffuseColor = Color3.Black();
  jumpCheckmark.material = jumpCheckMat;
  jumpCheckmark.parent = parent;
  allMeshes.push(jumpCheckmark);

  const crouchCheckmark = MeshBuilder.CreateSphere('crouchCheckmark', { diameter: 0.2 }, scene);
  crouchCheckmark.position = new Vector3(roomCenter.x - 4, 2, roomCenter.z - 6.5);
  const crouchCheckMat = new StandardMaterial('crouchCheckMat', scene);
  crouchCheckMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  crouchCheckMat.diffuseColor = Color3.Black();
  crouchCheckmark.material = crouchCheckMat;
  crouchCheckmark.parent = parent;
  allMeshes.push(crouchCheckmark);

  // === PLATFORMING STATE ===
  let platformingActive = false;
  let jumpCompleted = false;
  let crouchCompleted = false;
  let platformingCallbacksRef: PlatformingCallbacks | null = null;

  const jumpZoneMin = new Vector3(roomCenter.x - 1, 0, roomCenter.z + 1);
  const jumpZoneMax = new Vector3(roomCenter.x + 2, 3, roomCenter.z + 4);
  const crouchZoneMin = new Vector3(roomCenter.x - 5.5, 0, roomCenter.z - 6.5);
  const crouchZoneMax = new Vector3(roomCenter.x - 2.5, 1.5, roomCenter.z - 2.5);

  const startPlatformingTutorial = (callbacks: PlatformingCallbacks) => {
    platformingActive = true;
    jumpCompleted = false;
    crouchCompleted = false;
    platformingCallbacksRef = callbacks;

    // Show prompts
    jumpPromptSign.isVisible = true;
    crouchPromptSign.isVisible = true;

    // Reset checkmarks to gray
    jumpCheckMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
    crouchCheckMat.emissiveColor = new Color3(0.3, 0.3, 0.3);
  };

  const checkJumpZone = (playerPosition: Vector3, isJumping: boolean): boolean => {
    if (!platformingActive || jumpCompleted) return false;

    // Check if player is in jump zone
    const inZone =
      playerPosition.x >= jumpZoneMin.x &&
      playerPosition.x <= jumpZoneMax.x &&
      playerPosition.z >= jumpZoneMin.z &&
      playerPosition.z <= jumpZoneMax.z;

    if (inZone && isJumping) {
      jumpCompleted = true;
      jumpCheckMat.emissiveColor = new Color3(0, 1, 0.3);
      jumpPromptSign.isVisible = false;
      platformingCallbacksRef?.onJumpComplete();

      // Check if both completed
      if (jumpCompleted && crouchCompleted) {
        platformingActive = false;
        platformingCallbacksRef?.onPlatformingComplete();
      }
      return true;
    }
    return false;
  };

  const checkCrouchZone = (playerPosition: Vector3, isCrouching: boolean): boolean => {
    if (!platformingActive || crouchCompleted) return false;

    // Check if player is in crouch zone
    const inZone =
      playerPosition.x >= crouchZoneMin.x &&
      playerPosition.x <= crouchZoneMax.x &&
      playerPosition.z >= crouchZoneMin.z &&
      playerPosition.z <= crouchZoneMax.z;

    if (inZone && isCrouching) {
      crouchCompleted = true;
      crouchCheckMat.emissiveColor = new Color3(0, 1, 0.3);
      crouchPromptSign.isVisible = false;
      platformingCallbacksRef?.onCrouchComplete();

      // Check if both completed
      if (jumpCompleted && crouchCompleted) {
        platformingActive = false;
        platformingCallbacksRef?.onPlatformingComplete();
      }
      return true;
    }
    return false;
  };

  return {
    platformColliders,
    jumpPromptSign,
    crouchPromptSign,
    jumpCheckmark,
    crouchCheckmark,
    jumpCheckMat,
    crouchCheckMat,
    jumpPromptMat,
    crouchPromptMat,
    jumpZoneMin,
    jumpZoneMax,
    crouchZoneMin,
    crouchZoneMax,
    isActive: () => platformingActive,
    startPlatformingTutorial,
    checkJumpZone,
    checkCrouchZone,
    getPlatformColliders: () => platformColliders,
  };
}
