/**
 * FirstPersonWeapons - First-person weapon view model system
 *
 * Creates procedural BabylonJS meshes for each weapon, attaches them to the
 * active camera, and drives per-frame animation (bob, sway, recoil, ADS,
 * reload, switch) via WeaponAnimationController.
 *
 * Weapon meshes are screen-space positioned (right side, slight angle) and
 * rendered on a dedicated render layer so they never clip into world geometry.
 *
 * Three procedural weapon models (all from BabylonJS primitives):
 *   1. Assault Rifle  - box body + cylinder barrel + box stock + box magazine
 *   2. Pulse SMG      - smaller box body + shorter cylinder barrel (no stock)
 *   3. Plasma Cannon  - sphere body + flared cylinder barrel + emissive glow
 *
 * Materials: metallic PBR for ballistic weapons, emissive blue PBR for plasma.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getWeaponActions } from '../context/useWeaponActions';
import { MuzzleFlashManager } from '../effects/MuzzleFlash';
import { WeaponEffects, type WeaponType } from '../effects/WeaponEffects';
import type { WeaponId } from '../entities/weapons';
import { WeaponAnimationController, type WeaponMovementInput } from './WeaponAnimations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Render mask that separates FP weapon meshes from the world. */
const WEAPON_LAYER_MASK = 0x20000000;

/** Hip-fire resting position relative to camera (right side, slightly down). */
const HIP_POSITION = new Vector3(0.28, -0.22, 0.45);

/** ADS position: centered, slightly closer. */
const ADS_POSITION = new Vector3(0.0, -0.14, 0.35);

/** Base rotation (slight tilt for aesthetic). */
const HIP_ROTATION = new Vector3(0, 0, 0);

/** ADS rotation: straighten out the tilt. */
const ADS_ROTATION = new Vector3(0, 0, 0);

/** Reusable math temporaries to avoid per-frame allocations. */
const _tmpPos = Vector3.Zero();
const _tmpRot = Vector3.Zero();

// ---------------------------------------------------------------------------
// Weapon mesh definitions
// ---------------------------------------------------------------------------

interface WeaponMeshDef {
  weaponId: WeaponId;
  /** Build the procedural mesh hierarchy and return the root + muzzle point. */
  build: (scene: Scene) => { root: TransformNode; muzzlePoint: TransformNode };
  /** Weapon type tag for muzzle flash / effect system. */
  effectType: WeaponType;
}

// ---------------------------------------------------------------------------
// Material helpers
// ---------------------------------------------------------------------------

function createBallisticMaterial(scene: Scene, name: string): PBRMaterial {
  const mat = new PBRMaterial(`fpWeapon_${name}_mat`, scene);
  mat.albedoColor = new Color3(0.15, 0.15, 0.17);
  mat.metallic = 0.85;
  mat.roughness = 0.35;
  mat.environmentIntensity = 0.5;
  return mat;
}

function createBallisticAccentMaterial(scene: Scene, name: string): PBRMaterial {
  const mat = new PBRMaterial(`fpWeapon_${name}_accent_mat`, scene);
  mat.albedoColor = new Color3(0.25, 0.25, 0.27);
  mat.metallic = 0.7;
  mat.roughness = 0.5;
  mat.environmentIntensity = 0.4;
  return mat;
}

function createPlasmaMaterial(scene: Scene, name: string): PBRMaterial {
  const mat = new PBRMaterial(`fpWeapon_${name}_plasma_mat`, scene);
  mat.albedoColor = new Color3(0.08, 0.12, 0.2);
  mat.metallic = 0.9;
  mat.roughness = 0.2;
  mat.emissiveColor = new Color3(0.15, 0.4, 0.8);
  mat.emissiveIntensity = 0.6;
  mat.environmentIntensity = 0.5;
  return mat;
}

function createPlasmaGlowMaterial(scene: Scene, name: string): PBRMaterial {
  const mat = new PBRMaterial(`fpWeapon_${name}_glow_mat`, scene);
  mat.albedoColor = new Color3(0.2, 0.5, 1.0);
  mat.metallic = 0.3;
  mat.roughness = 0.1;
  mat.emissiveColor = new Color3(0.3, 0.6, 1.0);
  mat.emissiveIntensity = 1.5;
  return mat;
}

// ---------------------------------------------------------------------------
// Tag every mesh so the weapon layer mask is applied
// ---------------------------------------------------------------------------

function tagWeaponMeshes(root: TransformNode): void {
  const meshes = root.getChildMeshes(false);
  for (const mesh of meshes) {
    mesh.layerMask = WEAPON_LAYER_MASK;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    // Render after the scene so weapon is always on top
    mesh.renderingGroupId = 1;
  }
}

// ---------------------------------------------------------------------------
// Mesh builders for each weapon
// ---------------------------------------------------------------------------

function buildAssaultRifle(scene: Scene): { root: TransformNode; muzzlePoint: TransformNode } {
  const root = new TransformNode('fp_assault_rifle', scene);

  const bodyMat = createBallisticMaterial(scene, 'rifle');
  const accentMat = createBallisticAccentMaterial(scene, 'rifle');

  // Body (main receiver)
  const body = MeshBuilder.CreateBox(
    'rifle_body',
    { width: 0.06, height: 0.065, depth: 0.28 },
    scene
  );
  body.material = bodyMat;
  body.parent = root;
  body.position.set(0, 0, 0);

  // Barrel
  const barrel = MeshBuilder.CreateCylinder(
    'rifle_barrel',
    {
      diameter: 0.025,
      height: 0.32,
      tessellation: 12,
    },
    scene
  );
  barrel.material = accentMat;
  barrel.parent = root;
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.005, 0.3);

  // Barrel shroud / handguard
  const handguard = MeshBuilder.CreateBox(
    'rifle_handguard',
    {
      width: 0.05,
      height: 0.045,
      depth: 0.14,
    },
    scene
  );
  handguard.material = accentMat;
  handguard.parent = root;
  handguard.position.set(0, -0.005, 0.15);

  // Stock
  const stock = MeshBuilder.CreateBox(
    'rifle_stock',
    { width: 0.04, height: 0.055, depth: 0.15 },
    scene
  );
  stock.material = bodyMat;
  stock.parent = root;
  stock.position.set(0, 0, -0.2);

  // Stock butt (angled)
  const stockButt = MeshBuilder.CreateBox(
    'rifle_stockbutt',
    { width: 0.035, height: 0.06, depth: 0.04 },
    scene
  );
  stockButt.material = bodyMat;
  stockButt.parent = root;
  stockButt.position.set(0, -0.01, -0.27);

  // Magazine
  const magazine = MeshBuilder.CreateBox(
    'rifle_mag',
    { width: 0.035, height: 0.1, depth: 0.06 },
    scene
  );
  magazine.material = accentMat;
  magazine.parent = root;
  magazine.position.set(0, -0.07, 0.02);
  magazine.rotation.x = -0.12; // Slight forward angle

  // Top rail
  const rail = MeshBuilder.CreateBox(
    'rifle_rail',
    { width: 0.03, height: 0.012, depth: 0.18 },
    scene
  );
  rail.material = accentMat;
  rail.parent = root;
  rail.position.set(0, 0.038, 0.04);

  // Muzzle point (where flash spawns)
  const muzzlePoint = new TransformNode('rifle_muzzle', scene);
  muzzlePoint.parent = root;
  muzzlePoint.position.set(0, 0.005, 0.46);

  tagWeaponMeshes(root);

  return { root, muzzlePoint };
}

function buildPulseSMG(scene: Scene): { root: TransformNode; muzzlePoint: TransformNode } {
  const root = new TransformNode('fp_pulse_smg', scene);

  const bodyMat = createBallisticMaterial(scene, 'smg');
  const accentMat = createBallisticAccentMaterial(scene, 'smg');

  // Body (compact receiver)
  const body = MeshBuilder.CreateBox(
    'smg_body',
    { width: 0.05, height: 0.055, depth: 0.18 },
    scene
  );
  body.material = bodyMat;
  body.parent = root;
  body.position.set(0, 0, 0);

  // Barrel (shorter)
  const barrel = MeshBuilder.CreateCylinder(
    'smg_barrel',
    {
      diameter: 0.02,
      height: 0.2,
      tessellation: 12,
    },
    scene
  );
  barrel.material = accentMat;
  barrel.parent = root;
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.003, 0.19);

  // Barrel shroud
  const shroud = MeshBuilder.CreateCylinder(
    'smg_shroud',
    {
      diameter: 0.035,
      height: 0.08,
      tessellation: 8,
    },
    scene
  );
  shroud.material = accentMat;
  shroud.parent = root;
  shroud.rotation.x = Math.PI / 2;
  shroud.position.set(0, 0.003, 0.12);

  // Pistol grip
  const grip = MeshBuilder.CreateBox(
    'smg_grip',
    { width: 0.03, height: 0.065, depth: 0.035 },
    scene
  );
  grip.material = bodyMat;
  grip.parent = root;
  grip.position.set(0, -0.05, -0.04);
  grip.rotation.x = -0.2;

  // Magazine (in front of grip)
  const magazine = MeshBuilder.CreateBox(
    'smg_mag',
    { width: 0.028, height: 0.08, depth: 0.04 },
    scene
  );
  magazine.material = accentMat;
  magazine.parent = root;
  magazine.position.set(0, -0.06, 0.02);

  // Top sight
  const sight = MeshBuilder.CreateBox(
    'smg_sight',
    { width: 0.015, height: 0.015, depth: 0.04 },
    scene
  );
  sight.material = accentMat;
  sight.parent = root;
  sight.position.set(0, 0.035, 0.02);

  // Muzzle point
  const muzzlePoint = new TransformNode('smg_muzzle', scene);
  muzzlePoint.parent = root;
  muzzlePoint.position.set(0, 0.003, 0.29);

  tagWeaponMeshes(root);

  return { root, muzzlePoint };
}

function buildPlasmaCannon(scene: Scene): { root: TransformNode; muzzlePoint: TransformNode } {
  const root = new TransformNode('fp_plasma_cannon', scene);

  const bodyMat = createPlasmaMaterial(scene, 'plasma');
  const glowMat = createPlasmaGlowMaterial(scene, 'plasma');
  const metalMat = createBallisticMaterial(scene, 'plasma_frame');

  // Main body (sphere - plasma chamber)
  const chamber = MeshBuilder.CreateSphere(
    'plasma_chamber',
    {
      diameter: 0.14,
      segments: 16,
    },
    scene
  );
  chamber.material = bodyMat;
  chamber.parent = root;
  chamber.position.set(0, 0, -0.02);

  // Frame rails around chamber
  const frameTop = MeshBuilder.CreateBox(
    'plasma_frame_top',
    { width: 0.02, height: 0.015, depth: 0.2 },
    scene
  );
  frameTop.material = metalMat;
  frameTop.parent = root;
  frameTop.position.set(0, 0.065, 0.0);

  const frameBottom = MeshBuilder.CreateBox(
    'plasma_frame_bottom',
    { width: 0.05, height: 0.015, depth: 0.2 },
    scene
  );
  frameBottom.material = metalMat;
  frameBottom.parent = root;
  frameBottom.position.set(0, -0.065, 0.0);

  // Barrel (flared cylinder - widens toward muzzle)
  const barrel = MeshBuilder.CreateCylinder(
    'plasma_barrel',
    {
      diameterTop: 0.055,
      diameterBottom: 0.035,
      height: 0.22,
      tessellation: 16,
    },
    scene
  );
  barrel.material = bodyMat;
  barrel.parent = root;
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.18);

  // Inner barrel glow ring (emissive accent)
  const glowRing = MeshBuilder.CreateTorus(
    'plasma_glow_ring',
    {
      diameter: 0.05,
      thickness: 0.008,
      tessellation: 16,
    },
    scene
  );
  glowRing.material = glowMat;
  glowRing.parent = root;
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.set(0, 0, 0.28);

  // Rear glow ring
  const rearGlow = MeshBuilder.CreateTorus(
    'plasma_rear_ring',
    {
      diameter: 0.06,
      thickness: 0.006,
      tessellation: 16,
    },
    scene
  );
  rearGlow.material = glowMat;
  rearGlow.parent = root;
  rearGlow.rotation.x = Math.PI / 2;
  rearGlow.position.set(0, 0, -0.08);

  // Grip
  const grip = MeshBuilder.CreateBox(
    'plasma_grip',
    { width: 0.035, height: 0.075, depth: 0.04 },
    scene
  );
  grip.material = metalMat;
  grip.parent = root;
  grip.position.set(0, -0.09, -0.04);
  grip.rotation.x = -0.15;

  // Energy cell (rear)
  const cell = MeshBuilder.CreateBox(
    'plasma_cell',
    { width: 0.04, height: 0.04, depth: 0.06 },
    scene
  );
  cell.material = glowMat;
  cell.parent = root;
  cell.position.set(0, -0.04, -0.11);

  // Muzzle point
  const muzzlePoint = new TransformNode('plasma_muzzle', scene);
  muzzlePoint.parent = root;
  muzzlePoint.position.set(0, 0, 0.3);

  tagWeaponMeshes(root);

  return { root, muzzlePoint };
}

// ---------------------------------------------------------------------------
// Mesh definition registry
// ---------------------------------------------------------------------------

const WEAPON_MESH_DEFS: WeaponMeshDef[] = [
  {
    weaponId: 'assault_rifle',
    build: buildAssaultRifle,
    effectType: 'rifle',
  },
  {
    weaponId: 'pulse_smg',
    build: buildPulseSMG,
    effectType: 'pistol',
  },
  {
    weaponId: 'plasma_cannon',
    build: buildPlasmaCannon,
    effectType: 'plasma',
  },
];

// ---------------------------------------------------------------------------
// Built weapon instance
// ---------------------------------------------------------------------------

interface BuiltWeapon {
  def: WeaponMeshDef;
  root: TransformNode;
  muzzlePoint: TransformNode;
}

// ---------------------------------------------------------------------------
// Main system class
// ---------------------------------------------------------------------------

/**
 * FirstPersonWeaponSystem - singleton that owns the FP weapon meshes, drives
 * animations, and integrates with the muzzle flash / effects pipeline.
 */
export class FirstPersonWeaponSystem {
  private static instance: FirstPersonWeaponSystem | null = null;

  private scene: Scene | null = null;
  private camera: Camera | null = null;

  /** Parent node attached to camera; weapon roots are children. */
  private weaponAnchor: TransformNode | null = null;

  /** Pre-built weapon meshes keyed by WeaponId. */
  private weapons: Map<WeaponId, BuiltWeapon> = new Map();

  /** Currently visible weapon. */
  private activeWeaponId: WeaponId | null = null;

  /** Animation controller. */
  private animController: WeaponAnimationController | null = null;

  /** Optional glow layer for plasma weapon. */
  private glowLayer: GlowLayer | null = null;

  /** Frame observer dispose handle. */
  private frameObserverDispose: (() => void) | null = null;

  private constructor() {}

  static getInstance(): FirstPersonWeaponSystem {
    if (!FirstPersonWeaponSystem.instance) {
      FirstPersonWeaponSystem.instance = new FirstPersonWeaponSystem();
    }
    return FirstPersonWeaponSystem.instance;
  }

  // -- Lifecycle --------------------------------------------------------------

  /**
   * Initialize the system. Call once after the scene and camera are ready.
   *
   * @param scene   Active BabylonJS scene.
   * @param camera  The player's first-person camera.
   */
  init(scene: Scene, camera: Camera): void {
    this.scene = scene;
    this.camera = camera;

    // Create the anchor node parented to the camera
    this.weaponAnchor = new TransformNode('fpWeaponAnchor', scene);
    this.weaponAnchor.parent = camera;

    // Build all weapon meshes up front
    for (const def of WEAPON_MESH_DEFS) {
      const { root, muzzlePoint } = def.build(scene);
      root.parent = this.weaponAnchor;
      root.setEnabled(false); // hidden until equipped
      this.weapons.set(def.weaponId, { def, root, muzzlePoint });
    }

    // Glow layer for plasma effects
    this.glowLayer = new GlowLayer('fpWeaponGlow', scene, {
      blurKernelSize: 32,
      mainTextureFixedSize: 256,
    });
    this.glowLayer.intensity = 0.6;
    // Only affect weapon meshes by checking the name prefix
    this.glowLayer.customEmissiveColorSelector = (mesh, _subMesh, _material, result) => {
      if (
        mesh.name.startsWith('plasma_glow') ||
        mesh.name.startsWith('plasma_cell') ||
        mesh.name.startsWith('plasma_rear')
      ) {
        result.set(0.3, 0.6, 1.0, 1.0);
      } else {
        result.set(0, 0, 0, 0);
      }
    };

    // Determine initial weapon
    const weaponActions = getWeaponActions();
    const startId: WeaponId = weaponActions
      ? weaponActions.getState().currentWeaponId
      : 'assault_rifle';

    this.animController = new WeaponAnimationController(startId);
    this.equipWeapon(startId, false);

    // Register per-frame update
    const observer = scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
    this.frameObserverDispose = () => {
      scene.onBeforeRenderObservable.remove(observer);
    };

    console.log('[FirstPersonWeapons] Initialized with weapon:', startId);
  }

  // -- Public API -------------------------------------------------------------

  /** Show a weapon immediately (no switch animation). */
  equipWeapon(weaponId: WeaponId, animate: boolean = true): void {
    if (!this.scene) return;

    if (animate && this.activeWeaponId && this.activeWeaponId !== weaponId) {
      // Trigger animated switch
      this.animController?.triggerSwitch(() => {
        this.swapVisibleWeapon(weaponId);
        this.animController?.setWeapon(weaponId);
      });
      return;
    }

    this.swapVisibleWeapon(weaponId);
    this.animController?.setWeapon(weaponId);
  }

  /** Fire the active weapon (triggers recoil + muzzle flash). */
  fireWeapon(): void {
    this.animController?.triggerFire();
    this.emitMuzzleFlash();
  }

  /** Start reload animation (visual only; ammo logic is in WeaponContext). */
  triggerReload(onComplete?: () => void): void {
    this.animController?.triggerReload(onComplete);
  }

  /** Cancel reload animation. */
  cancelReload(): void {
    this.animController?.cancelReload();
  }

  /** Enter or leave ADS. */
  setADS(aiming: boolean): void {
    this.animController?.setADS(aiming);
  }

  /** True if a switch animation is in progress. */
  get isSwitching(): boolean {
    return this.animController?.isSwitching ?? false;
  }

  /** Currently displayed weapon id. */
  get currentWeaponId(): WeaponId | null {
    return this.activeWeaponId;
  }

  // -- Frame update -----------------------------------------------------------

  private update(): void {
    if (!this.scene || !this.weaponAnchor || !this.animController) return;

    const engine = this.scene.getEngine();
    const dt = engine.getDeltaTime() / 1000;
    if (dt <= 0 || dt > 0.25) return; // Skip degenerate frames

    // Build movement input from camera velocity heuristic
    const input = this.buildMovementInput(dt);

    // Advance animations
    this.animController.update(input);
    const output = this.animController.output;

    // Compute blended base position between hip and ADS
    const adsBlend = output.adsBlend;
    Vector3.LerpToRef(HIP_POSITION, ADS_POSITION, adsBlend, _tmpPos);
    Vector3.LerpToRef(HIP_ROTATION, ADS_ROTATION, adsBlend, _tmpRot);

    // Apply animation offsets (reduced during ADS for stability)
    const animScale = 1.0 - adsBlend * 0.75;
    _tmpPos.x += output.positionOffset.x * animScale;
    _tmpPos.y += output.positionOffset.y * animScale;
    _tmpPos.z += output.positionOffset.z * animScale;

    _tmpRot.x += output.rotationOffset.x * animScale;
    _tmpRot.y += output.rotationOffset.y * animScale;
    _tmpRot.z += output.rotationOffset.z * animScale;

    this.weaponAnchor.position.copyFrom(_tmpPos);
    this.weaponAnchor.rotation.copyFrom(_tmpRot);

    // Detect weapon changes from React context
    this.syncWeaponFromContext();
  }

  // -- Helpers ----------------------------------------------------------------

  /** Heuristic movement input derived from camera state. */
  private lastCameraPos: Vector3 | null = null;
  private movementSpeed = 0;

  private buildMovementInput(dt: number): WeaponMovementInput {
    let speed = 0;
    let isMoving = false;
    let isSprinting = false;
    let verticalVelocity = 0;

    if (this.camera) {
      const camPos = this.camera.position;
      if (this.lastCameraPos) {
        const dx = camPos.x - this.lastCameraPos.x;
        const dz = camPos.z - this.lastCameraPos.z;
        const dy = camPos.y - this.lastCameraPos.y;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);
        speed = horizontalDist / dt;
        verticalVelocity = dy / dt;

        // Smooth the speed value
        this.movementSpeed += (speed - this.movementSpeed) * Math.min(1, dt * 10);
        speed = this.movementSpeed;

        isMoving = speed > 0.5;
        isSprinting = speed > 8.0;
      }
      if (!this.lastCameraPos) {
        this.lastCameraPos = camPos.clone();
      } else {
        this.lastCameraPos.copyFrom(camPos);
      }
    }

    return { isMoving, isSprinting, speed, verticalVelocity, deltaTime: dt };
  }

  /** Swap which weapon root is visible. */
  private swapVisibleWeapon(weaponId: WeaponId): void {
    // Hide all
    for (const [, w] of this.weapons) {
      w.root.setEnabled(false);
    }
    // Show target
    const target = this.weapons.get(weaponId);
    if (target) {
      target.root.setEnabled(true);
    }
    this.activeWeaponId = weaponId;
  }

  /** Emit muzzle flash at the active weapon's muzzle point. */
  private emitMuzzleFlash(): void {
    if (!this.activeWeaponId || !this.scene) return;

    const active = this.weapons.get(this.activeWeaponId);
    if (!active) return;

    // Compute world position of muzzle
    const worldMatrix = active.muzzlePoint.getWorldMatrix();
    const muzzleWorldPos = Vector3.TransformCoordinates(Vector3.Zero(), worldMatrix);

    // Direction: forward from camera
    const cam = this.camera;
    if (!cam) return;

    const forward = cam.getForwardRay(1).direction.normalize();

    // Use enhanced weapon effects
    const effects = WeaponEffects.getInstance();
    effects.emitMuzzleFlash(muzzleWorldPos, forward, active.def.effectType, 0.7);

    // Also use MuzzleFlash manager for light + sprite
    const flash = MuzzleFlashManager.getInstance();
    flash.emit(muzzleWorldPos, forward, active.def.effectType);
  }

  /** Check if React weapon context changed and trigger visual switch. */
  private lastContextWeaponId: WeaponId | null = null;

  private syncWeaponFromContext(): void {
    const actions = getWeaponActions();
    if (!actions) return;

    const state = actions.getState();
    const contextId = state.currentWeaponId;

    if (this.lastContextWeaponId === null) {
      this.lastContextWeaponId = contextId;
      return;
    }

    if (contextId !== this.lastContextWeaponId) {
      this.lastContextWeaponId = contextId;
      this.equipWeapon(contextId, true);
    }
  }

  // -- Cleanup ----------------------------------------------------------------

  dispose(): void {
    this.frameObserverDispose?.();
    this.frameObserverDispose = null;

    this.animController?.dispose();
    this.animController = null;

    for (const [, w] of this.weapons) {
      w.root.dispose();
    }
    this.weapons.clear();

    this.glowLayer?.dispose();
    this.glowLayer = null;

    this.weaponAnchor?.dispose();
    this.weaponAnchor = null;

    this.scene = null;
    this.camera = null;
    this.activeWeaponId = null;
    this.lastCameraPos = null;
    this.lastContextWeaponId = null;

    FirstPersonWeaponSystem.instance = null;
    console.log('[FirstPersonWeapons] Disposed');
  }
}

// Export singleton accessor
export const firstPersonWeapons = FirstPersonWeaponSystem.getInstance();
