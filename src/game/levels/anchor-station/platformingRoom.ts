import type { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('PlatformingRoom');

// ============================================================================
// PLATFORMING ROOM GEOMETRY AND STATE
// Military training facility with platforms, gaps, and low passages
// ============================================================================

// GLB asset paths for platforming room visuals
const PLATFORM_ASSETS = {
  platformSmall: '/assets/models/environment/station/platform_small_mx_1.glb',
  platformLarge: '/assets/models/environment/station/platform_large_mx_1.glb',
  platformBx1: '/assets/models/environment/station/platform_bx_1.glb',
  platformBx2: '/assets/models/environment/station/platform_bx_2.glb',
  handrail: '/assets/models/environment/station/platform_b_handrail_1.glb',
  beam: '/assets/models/environment/station/beam_hc_horizontal_1.glb',
  pillar: '/assets/models/environment/station/pillar_hr_2.glb',
  wallPanel: '/assets/models/environment/station/wall_hr_1.glb',
  floorTile: '/assets/models/environment/station/floor_ceiling_hr_1.glb',
  roofPanel: '/assets/models/environment/station/roof_bx_1.glb',
} as const;

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

/**
 * Preload all GLB assets needed for the platforming room.
 * Must be called before createPlatformingRoom().
 */
export async function preloadPlatformingRoomAssets(scene: Scene): Promise<void> {
  const loadPromises = Object.values(PLATFORM_ASSETS).map((path) =>
    AssetManager.loadAssetByPath(path, scene)
  );
  await Promise.allSettled(loadPromises);
  log.info('Assets preloaded');
}

/**
 * Place a GLB visual model at the specified position.
 * Returns the TransformNode root of the placed model.
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
  // Collision box (invisible)
  const platform1Collider = MeshBuilder.CreateBox(
    'platform1_collider',
    { width: 3, height: 0.3, depth: 3 },
    scene
  );
  platform1Collider.position = new Vector3(roomCenter.x + 3, 0.15, roomCenter.z + 5);
  platform1Collider.isVisible = false;
  platform1Collider.checkCollisions = true;
  platform1Collider.parent = parent;
  platformColliders.push(platform1Collider);

  // Visual model
  const platform1Visual = placeVisualModel(
    scene,
    parent,
    PLATFORM_ASSETS.platformSmall,
    'platform1_visual',
    new Vector3(roomCenter.x + 3, 0, roomCenter.z + 5),
    Vector3.Zero(),
    new Vector3(1.5, 1, 1.5)
  );
  if (!platform1Visual) {
    throw new Error(`[PlatformingRoom] Failed to load platform GLB: ${PLATFORM_ASSETS.platformSmall}`);
  }

  // Handrail visual
  placeVisualModel(
    scene,
    parent,
    PLATFORM_ASSETS.handrail,
    'rail1a_visual',
    new Vector3(roomCenter.x + 3, 0, roomCenter.z + 5 - 1.45),
    new Vector3(0, Math.PI / 2, 0),
    new Vector3(1, 1, 1)
  );

  // === PLATFORM 2 - Mid-height (requires jump) ===
  const platform2Collider = MeshBuilder.CreateBox(
    'platform2_collider',
    { width: 3, height: 0.3, depth: 3 },
    scene
  );
  platform2Collider.position = new Vector3(roomCenter.x, 0.95, roomCenter.z + 2);
  platform2Collider.isVisible = false;
  platform2Collider.checkCollisions = true;
  platform2Collider.parent = parent;
  platformColliders.push(platform2Collider);

  // Visual model
  const platform2Visual = placeVisualModel(
    scene,
    parent,
    PLATFORM_ASSETS.platformBx1,
    'platform2_visual',
    new Vector3(roomCenter.x, 0.8, roomCenter.z + 2),
    Vector3.Zero(),
    new Vector3(1.5, 1, 1.5)
  );
  if (!platform2Visual) {
    throw new Error(`[PlatformingRoom] Failed to load platform GLB: ${PLATFORM_ASSETS.platformBx1}`);
  }

  // Caution stripes (keep as simple boxes for visual clarity)
  const stripe2a = MeshBuilder.CreateBox('stripe2a', { width: 3, height: 0.05, depth: 0.3 }, scene);
  stripe2a.position = new Vector3(roomCenter.x, 1.13, roomCenter.z + 2 + 1.35);
  stripe2a.material = materials.get('caution')!;
  stripe2a.parent = parent;
  allMeshes.push(stripe2a);

  const stripe2b = MeshBuilder.CreateBox('stripe2b', { width: 3, height: 0.05, depth: 0.3 }, scene);
  stripe2b.position = new Vector3(roomCenter.x, 1.13, roomCenter.z + 2 - 1.35);
  stripe2b.material = materials.get('caution')!;
  stripe2b.parent = parent;
  allMeshes.push(stripe2b);

  // === PLATFORM 3 - Higher platform ===
  const platform3Collider = MeshBuilder.CreateBox(
    'platform3_collider',
    { width: 3, height: 0.3, depth: 3 },
    scene
  );
  platform3Collider.position = new Vector3(roomCenter.x - 3, 1.45, roomCenter.z - 1);
  platform3Collider.isVisible = false;
  platform3Collider.checkCollisions = true;
  platform3Collider.parent = parent;
  platformColliders.push(platform3Collider);

  // Visual model
  const platform3Visual = placeVisualModel(
    scene,
    parent,
    PLATFORM_ASSETS.platformBx2,
    'platform3_visual',
    new Vector3(roomCenter.x - 3, 1.3, roomCenter.z - 1),
    Vector3.Zero(),
    new Vector3(1.5, 1, 1.5)
  );
  if (!platform3Visual) {
    throw new Error(`[PlatformingRoom] Failed to load platform GLB: ${PLATFORM_ASSETS.platformBx2}`);
  }

  // Handrail on platform 3
  placeVisualModel(
    scene,
    parent,
    PLATFORM_ASSETS.handrail,
    'rail3a_visual',
    new Vector3(roomCenter.x - 3 - 1.45, 1.3, roomCenter.z - 1),
    new Vector3(0, 0, 0),
    new Vector3(1, 1, 1)
  );

  // === LOW PASSAGE STRUCTURE - Requires crouch ===
  const crouchPassageFrame = new TransformNode('crouchPassageFrame', scene);
  crouchPassageFrame.position = new Vector3(roomCenter.x - 4, 0, roomCenter.z - 4.5);
  crouchPassageFrame.parent = parent;

  // Wall panels for passage (using GLB)
  placeVisualModel(
    scene,
    crouchPassageFrame,
    PLATFORM_ASSETS.wallPanel,
    'passageWallLeft_visual',
    new Vector3(-1.5, 0, 0),
    new Vector3(0, Math.PI / 2, 0),
    new Vector3(0.5, 1, 1)
  );

  placeVisualModel(
    scene,
    crouchPassageFrame,
    PLATFORM_ASSETS.wallPanel,
    'passageWallRight_visual',
    new Vector3(1.5, 0, 0),
    new Vector3(0, -Math.PI / 2, 0),
    new Vector3(0.5, 1, 1)
  );

  // Low ceiling collision (critical for crouch mechanic)
  // Invisible collision box for physics
  const passageCeilingCollider = MeshBuilder.CreateBox(
    'passageCeiling_collider',
    { width: 3, height: 0.5, depth: 4 },
    scene
  );
  passageCeilingCollider.position = new Vector3(0, 1.25, 0);
  passageCeilingCollider.isVisible = false;
  passageCeilingCollider.checkCollisions = true;
  passageCeilingCollider.parent = crouchPassageFrame;
  platformColliders.push(passageCeilingCollider);

  // Visual GLB model for ceiling
  const passageCeilingVisual = placeVisualModel(
    scene,
    crouchPassageFrame,
    PLATFORM_ASSETS.roofPanel,
    'passageCeiling_visual',
    new Vector3(0, 1.0, 0),
    new Vector3(0, 0, Math.PI), // Flip upside down
    new Vector3(0.75, 1, 1)
  );
  if (!passageCeilingVisual) {
    throw new Error(`[PlatformingRoom] Failed to load ceiling GLB: ${PLATFORM_ASSETS.roofPanel}`);
  }

  // Warning stripes at passage entrance/exit
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

  // Passage emergency light
  const passageLight1 = MeshBuilder.CreateSphere('passageLight1', { diameter: 0.1 }, scene);
  passageLight1.position = new Vector3(0, 0.9, 0);
  passageLight1.material = materials.get('emergency')!;
  passageLight1.parent = crouchPassageFrame;
  allMeshes.push(passageLight1);

  // === FINAL PLATFORM - End of course ===
  const platform4Collider = MeshBuilder.CreateBox(
    'platform4_collider',
    { width: 4, height: 0.3, depth: 4 },
    scene
  );
  platform4Collider.position = new Vector3(roomCenter.x - 4, 0.15, roomCenter.z - 6.5);
  platform4Collider.isVisible = false;
  platform4Collider.checkCollisions = true;
  platform4Collider.parent = parent;
  platformColliders.push(platform4Collider);

  // Visual model for final platform
  const platform4Visual = placeVisualModel(
    scene,
    parent,
    PLATFORM_ASSETS.platformLarge,
    'platform4_visual',
    new Vector3(roomCenter.x - 4, 0, roomCenter.z - 6.5),
    Vector3.Zero(),
    new Vector3(1, 1, 1)
  );
  if (!platform4Visual) {
    throw new Error(`[PlatformingRoom] Failed to load platform GLB: ${PLATFORM_ASSETS.platformLarge}`);
  }

  // Completion marker (keep as MeshBuilder for animation)
  const completionMarker = MeshBuilder.CreateCylinder(
    'completionMarker',
    { height: 0.05, diameter: 2, tessellation: 16 },
    scene
  );
  completionMarker.position = new Vector3(roomCenter.x - 4, 0.33, roomCenter.z - 6.5);
  completionMarker.material = materials.get('active')!;
  completionMarker.parent = parent;
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

  // === VISUAL PROMPTS (keep as MeshBuilder for text overlay) ===
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
