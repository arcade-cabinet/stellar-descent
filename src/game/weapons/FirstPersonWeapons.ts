/**
 * FirstPersonWeapons - First-person weapon view model system (GLB-backed)
 *
 * Loads weapon models from GLB files in public/models/props/weapons/ and
 * attaches them to the active camera. Drives per-frame animation (bob, sway,
 * recoil, ADS, reload, switch) via WeaponAnimationController.
 *
 * Supports a DOOM-style weapon inventory:
 *   - Player starts with a sidearm
 *   - Weapon caches in levels grant access to better weapons
 *   - Up to 18 unique weapons, each with its own GLB model
 *   - Quick-switch between any owned weapons
 *
 * Weapon meshes are rendered on a dedicated render layer (renderingGroupId 1)
 * so they never clip into world geometry.
 *
 * Muzzle flash and tracer VFX remain as MeshBuilder planes (transient effects).
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF';

import { getLogger } from '../core/Logger';
import { getWeaponActions } from '../context/useWeaponActions';
import { MuzzleFlashManager } from '../effects/MuzzleFlash';
import { WeaponEffects, type WeaponType } from '../effects/WeaponEffects';
import {
  categoryToEffectType,
  getWeaponGLBPath,
  WEAPONS,
  type WeaponId,
} from '../entities/weapons';
import { WeaponAnimationController, type WeaponMovementInput } from './WeaponAnimations';

const log = getLogger('FirstPersonWeapons');

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
// Per-weapon transform tuning for GLB models
// ---------------------------------------------------------------------------

/**
 * Per-weapon local transform adjustments so each GLB sits correctly in
 * first-person view. Values are applied on top of the anchor position.
 */
interface WeaponViewTransform {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  /** Muzzle point offset from the weapon root (local space). */
  muzzleOffset: Vector3;
}

/** Default view transform for weapons without specific tuning. */
const DEFAULT_VIEW_TRANSFORM: WeaponViewTransform = {
  position: new Vector3(0, 0, 0),
  rotation: new Vector3(0, Math.PI, 0),
  scale: new Vector3(1, 1, 1),
  muzzleOffset: new Vector3(0, 0.005, 0.4),
};

/**
 * Per-weapon view transforms. Weapons not listed here use DEFAULT_VIEW_TRANSFORM.
 * Adjust these after seeing the GLBs in-engine for pixel-perfect placement.
 */
const VIEW_TRANSFORMS: Partial<Record<WeaponId, Partial<WeaponViewTransform>>> = {
  sidearm: {
    position: new Vector3(0, -0.02, 0.05),
    scale: new Vector3(0.9, 0.9, 0.9),
    muzzleOffset: new Vector3(0, 0.005, 0.22),
  },
  heavy_pistol: {
    position: new Vector3(0, -0.02, 0.05),
    scale: new Vector3(0.95, 0.95, 0.95),
    muzzleOffset: new Vector3(0, 0.005, 0.24),
  },
  classic_pistol: {
    position: new Vector3(0, -0.02, 0.05),
    scale: new Vector3(0.9, 0.9, 0.9),
    muzzleOffset: new Vector3(0, 0.005, 0.22),
  },
  revolver: {
    position: new Vector3(0, -0.02, 0.05),
    scale: new Vector3(0.95, 0.95, 0.95),
    muzzleOffset: new Vector3(0, 0.008, 0.26),
  },
  pulse_smg: {
    muzzleOffset: new Vector3(0, 0.003, 0.29),
  },
  pdw: {
    muzzleOffset: new Vector3(0, 0.003, 0.28),
  },
  smg_mp5: {
    muzzleOffset: new Vector3(0, 0.003, 0.30),
  },
  smg_ump: {
    muzzleOffset: new Vector3(0, 0.003, 0.30),
  },
  assault_rifle: {
    muzzleOffset: new Vector3(0, 0.005, 0.46),
  },
  battle_rifle: {
    muzzleOffset: new Vector3(0, 0.005, 0.48),
  },
  carbine: {
    muzzleOffset: new Vector3(0, 0.005, 0.42),
  },
  dmr: {
    muzzleOffset: new Vector3(0, 0.005, 0.50),
  },
  sniper_rifle: {
    muzzleOffset: new Vector3(0, 0.005, 0.55),
  },
  auto_shotgun: {
    muzzleOffset: new Vector3(0, 0.005, 0.44),
  },
  double_barrel: {
    muzzleOffset: new Vector3(0, 0.005, 0.42),
  },
  plasma_cannon: {
    muzzleOffset: new Vector3(0, 0, 0.3),
  },
  heavy_lmg: {
    position: new Vector3(0, -0.02, 0),
    muzzleOffset: new Vector3(0, 0.005, 0.50),
  },
  saw_lmg: {
    position: new Vector3(0, -0.02, 0),
    muzzleOffset: new Vector3(0, 0.005, 0.50),
  },
};

/** Resolve the full view transform for a weapon. */
function resolveViewTransform(weaponId: WeaponId): WeaponViewTransform {
  const overrides = VIEW_TRANSFORMS[weaponId];
  if (!overrides) return { ...DEFAULT_VIEW_TRANSFORM };
  return {
    position: overrides.position ?? DEFAULT_VIEW_TRANSFORM.position,
    rotation: overrides.rotation ?? DEFAULT_VIEW_TRANSFORM.rotation,
    scale: overrides.scale ?? DEFAULT_VIEW_TRANSFORM.scale,
    muzzleOffset: overrides.muzzleOffset ?? DEFAULT_VIEW_TRANSFORM.muzzleOffset,
  };
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
// Loaded weapon instance
// ---------------------------------------------------------------------------

interface LoadedWeapon {
  weaponId: WeaponId;
  root: TransformNode;
  muzzlePoint: TransformNode;
  meshes: AbstractMesh[];
  effectType: WeaponType;
}

// ---------------------------------------------------------------------------
// Weapon inventory state
// ---------------------------------------------------------------------------

/** Tracks which weapons the player currently owns. */
interface WeaponInventory {
  /** Set of owned weapon IDs. */
  owned: Set<WeaponId>;
  /** Ordered list for quick-switch cycling. */
  order: WeaponId[];
}

// ---------------------------------------------------------------------------
// Main system class
// ---------------------------------------------------------------------------

/**
 * FirstPersonWeaponSystem - singleton that owns the FP weapon meshes, drives
 * animations, and integrates with the muzzle flash / effects pipeline.
 *
 * Weapon GLBs are loaded asynchronously on demand. The system pre-loads
 * weapons in the player's inventory and lazily loads new ones when picked up.
 */
export class FirstPersonWeaponSystem {
  private static instance: FirstPersonWeaponSystem | null = null;

  private scene: Scene | null = null;
  private camera: Camera | null = null;

  /** Parent node attached to camera; weapon roots are children. */
  private weaponAnchor: TransformNode | null = null;

  /** Loaded weapon meshes keyed by WeaponId. */
  private weapons: Map<WeaponId, LoadedWeapon> = new Map();

  /** In-flight load promises to deduplicate concurrent loads. */
  private loadingWeapons: Map<WeaponId, Promise<LoadedWeapon | null>> = new Map();

  /** Currently visible weapon. */
  private activeWeaponId: WeaponId | null = null;

  /** Animation controller. */
  private animController: WeaponAnimationController | null = null;

  /** Optional glow layer for plasma / energy weapons. */
  private glowLayer: GlowLayer | null = null;

  /** Frame observer dispose handle. */
  private frameObserverDispose: (() => void) | null = null;

  /** DOOM-style weapon inventory. */
  private inventory: WeaponInventory = {
    owned: new Set(),
    order: [],
  };

  /** Whether init has completed (including initial weapon load). */
  private initialized = false;

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
   * This is now async because GLB loading is asynchronous.
   *
   * @param scene   Active BabylonJS scene.
   * @param camera  The player's first-person camera.
   * @param startingWeapons  Optional list of weapons to start with.
   *                         Defaults to ['assault_rifle'].
   */
  async init(
    scene: Scene,
    camera: Camera,
    startingWeapons?: WeaponId[]
  ): Promise<void> {
    this.scene = scene;
    this.camera = camera;

    // Create the anchor node parented to the camera
    this.weaponAnchor = new TransformNode('fpWeaponAnchor', scene);
    this.weaponAnchor.parent = camera;

    // Glow layer for plasma / energy effects
    this.glowLayer = new GlowLayer('fpWeaponGlow', scene, {
      blurKernelSize: 32,
      mainTextureFixedSize: 256,
    });
    this.glowLayer.intensity = 0.6;
    this.glowLayer.customEmissiveColorSelector = (_mesh, _subMesh, _material, result) => {
      // Let the GLB materials handle their own emissive; we just need the
      // glow layer active for any emissive materials in weapon GLBs.
      // Default: no custom override, use material emissive as-is.
      result.set(0, 0, 0, 0);
    };

    // Determine initial weapons
    const weaponsToLoad = startingWeapons ?? ['assault_rifle'];
    for (const id of weaponsToLoad) {
      this.inventory.owned.add(id);
      this.inventory.order.push(id);
    }

    // Load all starting weapons in parallel
    const loadPromises = weaponsToLoad.map((id) => this.loadWeaponGLB(id));
    await Promise.all(loadPromises);

    // Determine initial active weapon
    const weaponActions = getWeaponActions();
    const startId: WeaponId = weaponActions
      ? weaponActions.getState().currentWeaponId
      : weaponsToLoad[0];

    this.animController = new WeaponAnimationController(startId);
    this.equipWeapon(startId, false);

    // Register per-frame update
    const observer = scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
    this.frameObserverDispose = () => {
      scene.onBeforeRenderObservable.remove(observer);
    };

    this.initialized = true;
    log.info('Initialized with weapons:', [...this.inventory.owned].join(', '));
  }

  // -- GLB Loading ------------------------------------------------------------

  /**
   * Load a weapon GLB and register it in the weapons map.
   * Returns the loaded weapon, or null if loading fails.
   * Deduplicates concurrent loads of the same weapon.
   */
  private async loadWeaponGLB(weaponId: WeaponId): Promise<LoadedWeapon | null> {
    // Already loaded
    if (this.weapons.has(weaponId)) {
      return this.weapons.get(weaponId)!;
    }

    // Already loading -- return the in-flight promise
    if (this.loadingWeapons.has(weaponId)) {
      return this.loadingWeapons.get(weaponId)!;
    }

    const promise = this.doLoadWeaponGLB(weaponId);
    this.loadingWeapons.set(weaponId, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.loadingWeapons.delete(weaponId);
    }
  }

  private async doLoadWeaponGLB(weaponId: WeaponId): Promise<LoadedWeapon | null> {
    if (!this.scene || !this.weaponAnchor) return null;

    const glbPath = getWeaponGLBPath(weaponId);
    const weaponDef = WEAPONS[weaponId];
    const viewTransform = resolveViewTransform(weaponId);

    log.info(`Loading GLB: ${glbPath}`);
    const startTime = performance.now();

    try {
      const result = await SceneLoader.ImportMeshAsync('', glbPath, '', this.scene);

      const elapsed = (performance.now() - startTime).toFixed(1);
      log.info(`Loaded ${weaponId} (${result.meshes.length} meshes) in ${elapsed}ms`);

      // Create a root transform for this weapon
      const root = new TransformNode(`fp_${weaponId}`, this.scene);
      root.parent = this.weaponAnchor;

      // Apply view transform
      root.position.copyFrom(viewTransform.position);
      root.rotation.copyFrom(viewTransform.rotation);
      root.scaling.copyFrom(viewTransform.scale);

      // Parent all top-level imported nodes under our root.
      // SceneLoader.ImportMeshAsync creates a __root__ TransformNode;
      // we reparent any mesh without a parent (or whose top-level ancestor
      // has no parent) under our weapon root.
      const reparented = new Set<TransformNode>();
      for (const mesh of result.meshes) {
        // Walk to the topmost ancestor
        let topLevel: TransformNode = mesh;
        while (topLevel.parent) {
          topLevel = topLevel.parent as TransformNode;
        }
        if (!reparented.has(topLevel) && topLevel !== root) {
          topLevel.parent = root;
          reparented.add(topLevel);
        }
      }

      // Tag for weapon render layer
      tagWeaponMeshes(root);

      // Create muzzle point
      const muzzlePoint = new TransformNode(`${weaponId}_muzzle`, this.scene);
      muzzlePoint.parent = root;
      muzzlePoint.position.copyFrom(viewTransform.muzzleOffset);

      // Start hidden
      root.setEnabled(false);

      const effectType = categoryToEffectType(weaponDef.category);

      const loaded: LoadedWeapon = {
        weaponId,
        root,
        muzzlePoint,
        meshes: result.meshes,
        effectType,
      };

      this.weapons.set(weaponId, loaded);
      return loaded;
    } catch (error) {
      log.error(`Failed to load ${weaponId} from ${glbPath}:`, error);
      return null;
    }
  }

  // -- Inventory Management (DOOM-style) --------------------------------------

  /** Check if the player owns a weapon. */
  hasWeapon(weaponId: WeaponId): boolean {
    return this.inventory.owned.has(weaponId);
  }

  /** Get the list of owned weapons in order. */
  getOwnedWeapons(): WeaponId[] {
    return [...this.inventory.order];
  }

  /**
   * Grant a weapon to the player (e.g., from a weapon cache pickup).
   * Loads the GLB asynchronously if not already loaded.
   * Returns true if the weapon was newly added, false if already owned.
   */
  async grantWeapon(weaponId: WeaponId): Promise<boolean> {
    if (this.inventory.owned.has(weaponId)) {
      log.info(`Already own ${weaponId}`);
      return false;
    }

    this.inventory.owned.add(weaponId);

    // Insert into order based on tier (ascending)
    const weaponDef = WEAPONS[weaponId];
    let insertIdx = this.inventory.order.length;
    for (let i = 0; i < this.inventory.order.length; i++) {
      const existingDef = WEAPONS[this.inventory.order[i]];
      if (weaponDef.tier < existingDef.tier) {
        insertIdx = i;
        break;
      }
    }
    this.inventory.order.splice(insertIdx, 0, weaponId);

    // Load the GLB in the background
    await this.loadWeaponGLB(weaponId);

    log.info(`Granted weapon: ${weaponDef.name} (tier ${weaponDef.tier})`);
    return true;
  }

  /**
   * Remove a weapon from the player's inventory.
   * If the removed weapon is currently active, switches to next available.
   */
  revokeWeapon(weaponId: WeaponId): void {
    if (!this.inventory.owned.has(weaponId)) return;

    this.inventory.owned.delete(weaponId);
    const idx = this.inventory.order.indexOf(weaponId);
    if (idx >= 0) this.inventory.order.splice(idx, 1);

    // Unload the mesh
    const weapon = this.weapons.get(weaponId);
    if (weapon) {
      weapon.root.dispose();
      this.weapons.delete(weaponId);
    }

    // If this was the active weapon, switch to the first available
    if (this.activeWeaponId === weaponId && this.inventory.order.length > 0) {
      this.equipWeapon(this.inventory.order[0], true);
    }
  }

  /**
   * Cycle to next/previous weapon in inventory.
   * @param direction  1 for next, -1 for previous.
   */
  cycleWeapon(direction: 1 | -1): void {
    if (this.inventory.order.length <= 1) return;
    if (!this.activeWeaponId) return;

    const currentIdx = this.inventory.order.indexOf(this.activeWeaponId);
    const nextIdx =
      (currentIdx + direction + this.inventory.order.length) % this.inventory.order.length;
    this.equipWeapon(this.inventory.order[nextIdx], true);
  }

  // -- Public API -------------------------------------------------------------

  /** Show a weapon immediately (no switch animation) or with animation. */
  equipWeapon(weaponId: WeaponId, animate: boolean = true): void {
    if (!this.scene) return;

    // Only equip weapons we own (or that are loaded)
    if (!this.inventory.owned.has(weaponId) && !this.weapons.has(weaponId)) {
      log.warn(`Cannot equip ${weaponId} -- not owned or loaded`);
      return;
    }

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

  /** Whether the system has completed initialization. */
  get isInitialized(): boolean {
    return this.initialized;
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
    effects.emitMuzzleFlash(muzzleWorldPos, forward, active.effectType, 0.7);

    // Also use MuzzleFlash manager for light + sprite
    const flash = MuzzleFlashManager.getInstance();
    flash.emit(muzzleWorldPos, forward, active.effectType);
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
    this.loadingWeapons.clear();

    this.glowLayer?.dispose();
    this.glowLayer = null;

    this.weaponAnchor?.dispose();
    this.weaponAnchor = null;

    this.scene = null;
    this.camera = null;
    this.activeWeaponId = null;
    this.lastCameraPos = null;
    this.lastContextWeaponId = null;

    this.inventory.owned.clear();
    this.inventory.order = [];
    this.initialized = false;

    FirstPersonWeaponSystem.instance = null;
    log.info('Disposed');
  }
}

// Export singleton accessor
export const firstPersonWeapons = FirstPersonWeaponSystem.getInstance();
