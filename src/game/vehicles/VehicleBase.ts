/**
 * VehicleBase - Abstract base class for all drivable/rideable vehicles
 *
 * Provides shared functionality for:
 * - Health / damage model with visual damage states
 * - Enter/exit transitions with animation hooks
 * - Physics integration via BabylonJS TransformNode hierarchy
 * - Camera management (switches between FPS and vehicle camera)
 * - HUD mode flag for React overlay swap
 * - Passenger slots for NPC marines
 *
 * Concrete implementations (PhantomDropship, WraithTank) override
 * abstract methods for vehicle-specific behaviour.
 */

import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import { createEntity, type Entity, removeEntity } from '../core/ecs';
import { getLogger } from '../core/Logger';
import type { Player } from '../entities/player';

const log = getLogger('VehicleBase');

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type DamageState = 'pristine' | 'scratched' | 'damaged' | 'critical';

export interface VehicleWeapon {
  id: string;
  name: string;
  damage: number;
  fireRate: number; // rounds per second
  cooldownMax: number; // max heat before overheat (0-1)
  heatPerShot: number;
  coolRate: number; // heat dissipated per second (0-1 units)
  projectileSpeed: number;
  isAOE: boolean;
  aoeRadius?: number;
  lastFireTime: number;
  currentHeat: number;
  isOverheated: boolean;
}

export interface VehiclePassenger {
  name: string;
  entity: Entity | null;
}

export interface VehicleStats {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  shieldRegenRate: number; // per second
  shieldRegenDelay: number; // ms before regen starts after damage
  speed: number;
  maxSpeed: number;
  acceleration: number;
  turnRate: number; // radians per second
  mass: number;
}

// --------------------------------------------------------------------------
// Abstract base
// --------------------------------------------------------------------------

export abstract class VehicleBase {
  // Identity
  public readonly vehicleId: string;
  public readonly displayName: string;

  // Scene references
  protected scene: Scene;
  protected rootNode: TransformNode;
  protected hullMeshes: Mesh[] = [];

  // ECS entity for collision / combat system
  public entity: Entity;

  // Stats
  public stats: VehicleStats;

  // Damage visuals
  public damageState: DamageState = 'pristine';
  private damageMaterials: Map<DamageState, StandardMaterial> = new Map();

  // Weapons
  public weapons: VehicleWeapon[] = [];
  public activeWeaponIndex = 0;

  // Passengers
  public passengers: VehiclePassenger[] = [];
  public maxPassengers: number;

  // Occupancy
  private _isOccupied = false;
  private _pilot: Player | null = null;
  private _savedPlayerCamera: UniversalCamera | null = null;

  // Vehicle camera
  protected vehicleCamera: FreeCamera;

  // Physics velocity
  protected linearVelocity = Vector3.Zero();
  protected angularVelocity = Vector3.Zero();

  // Shield regen timer
  private lastDamageTime = 0;

  // HUD flag consumed by React context
  public isPlayerInVehicle = false;

  // Disposal helpers
  protected _listeners: (() => void)[] = [];
  private _disposed = false;

  constructor(
    scene: Scene,
    id: string,
    name: string,
    position: Vector3,
    stats: VehicleStats,
    maxPassengers: number
  ) {
    this.scene = scene;
    this.vehicleId = id;
    this.displayName = name;
    this.stats = { ...stats };
    this.maxPassengers = maxPassengers;

    // Create root transform
    this.rootNode = new TransformNode(`vehicle_${id}`, scene);
    this.rootNode.position = position.clone();
    this.rootNode.rotationQuaternion = Quaternion.Identity();

    // Build meshes (implemented by subclass)
    this.buildHull();

    // Prepare damage state materials
    this.initDamageMaterials();

    // Create third-person vehicle camera
    this.vehicleCamera = new FreeCamera(`vehicleCam_${id}`, Vector3.Zero(), scene);
    this.vehicleCamera.minZ = 0.5;
    this.vehicleCamera.maxZ = 2000;
    // 85 degrees FOV for vehicle third-person view (slightly narrower than FPS)
    this.vehicleCamera.fov = (85 * Math.PI) / 180;
    this.vehicleCamera.inputs.clear();
    this.vehicleCamera.parent = this.rootNode;
    // Positioned by subclass via setVehicleCameraOffset

    // ECS entity
    this.entity = createEntity({
      transform: {
        position: position.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      health: {
        current: stats.health,
        max: stats.maxHealth,
        regenRate: 0,
      },
      velocity: {
        linear: Vector3.Zero(),
        angular: Vector3.Zero(),
        maxSpeed: stats.maxSpeed,
      },
      renderable: {
        mesh: this.rootNode,
        visible: true,
      },
      tags: {},
    });
  }

  // ------------------------------------------------------------------
  // Abstract hooks for subclasses
  // ------------------------------------------------------------------

  /** Build the visual hull out of BabylonJS primitives. Push meshes into this.hullMeshes. */
  protected abstract buildHull(): void;

  /** Per-frame update when vehicle is active. deltaTime in seconds. */
  protected abstract updateVehicle(deltaTime: number): void;

  /** Handle vehicle-specific input. Called every frame while occupied. */
  protected abstract processInput(deltaTime: number): void;

  /** Create weapon definitions. Called once after construction. */
  protected abstract initWeapons(): VehicleWeapon[];

  /** Fire the currently active weapon. */
  public abstract fireWeapon(): void;

  /** Fire secondary weapon (if any). */
  public abstract fireSecondaryWeapon(): void;

  // ------------------------------------------------------------------
  // Camera helpers
  // ------------------------------------------------------------------

  protected setVehicleCameraOffset(offset: Vector3): void {
    this.vehicleCamera.position = offset.clone();
  }

  // ------------------------------------------------------------------
  // Damage materials
  // ------------------------------------------------------------------

  private initDamageMaterials(): void {
    const makemat = (suffix: string, emissive: Color3, alpha: number) => {
      const mat = new StandardMaterial(`veh_dmg_${this.vehicleId}_${suffix}`, this.scene);
      mat.emissiveColor = emissive;
      mat.alpha = alpha;
      return mat;
    };

    this.damageMaterials.set('pristine', makemat('pristine', Color3.Black(), 1));
    this.damageMaterials.set('scratched', makemat('scratched', new Color3(0.15, 0.08, 0), 1));
    this.damageMaterials.set('damaged', makemat('damaged', new Color3(0.3, 0.1, 0), 0.95));
    this.damageMaterials.set('critical', makemat('critical', new Color3(0.5, 0.1, 0.05), 0.9));
  }

  private refreshDamageState(): void {
    const ratio = this.stats.health / this.stats.maxHealth;
    if (ratio > 0.75) this.damageState = 'pristine';
    else if (ratio > 0.5) this.damageState = 'scratched';
    else if (ratio > 0.25) this.damageState = 'damaged';
    else this.damageState = 'critical';
  }

  // ------------------------------------------------------------------
  // Enter / Exit
  // ------------------------------------------------------------------

  public canEnter(player: Player): boolean {
    if (this._isOccupied) return false;
    if (this.stats.health <= 0) return false;
    // Check proximity - increased from 6 to 10 for easier vehicle entry
    const dist = Vector3.Distance(player.getPosition(), this.rootNode.position);
    return dist < 10;
  }

  public enter(player: Player): void {
    if (!this.canEnter(player)) return;

    this._isOccupied = true;
    this._pilot = player;
    this.isPlayerInVehicle = true;

    // Save current player camera reference
    this._savedPlayerCamera = player.camera;

    // Hide the player weapon / mesh
    player.mesh.isVisible = false;

    // Switch scene active camera to vehicle camera
    this.scene.activeCamera = this.vehicleCamera;

    // Setup vehicle input listeners
    this.setupVehicleInput();

    getAudioManager().play('door_open', { volume: 0.5 });

    log.info(`Player entered ${this.displayName}`);
  }

  public exit(): void {
    if (!this._isOccupied || !this._pilot) return;

    this._isOccupied = false;
    this.isPlayerInVehicle = false;

    // Restore player camera
    if (this._savedPlayerCamera) {
      this.scene.activeCamera = this._savedPlayerCamera;

      // Position player next to the vehicle
      const exitOffset = this.rootNode.right.scale(4);
      this._savedPlayerCamera.position = this.rootNode.position.add(exitOffset);
      this._savedPlayerCamera.position.y = 1.8;
    }

    // Restore player mesh visibility
    if (this._pilot) {
      this._pilot.mesh.isVisible = false; // player body stays hidden in FPS
    }

    this.teardownVehicleInput();
    getAudioManager().play('door_open', { volume: 0.4 });

    this._pilot = null;
    this._savedPlayerCamera = null;

    log.info(`Player exited ${this.displayName}`);
  }

  // ------------------------------------------------------------------
  // Input management
  // ------------------------------------------------------------------

  private vehicleKeysPressed = new Set<string>();
  private vehicleMouseDown = false;
  private vehicleRightMouseDown = false;

  private setupVehicleInput(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      this.vehicleKeysPressed.add(e.code);
      if (e.code === 'KeyE') {
        this.exit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    this._listeners.push(() => window.removeEventListener('keydown', onKeyDown));

    const onKeyUp = (e: KeyboardEvent) => {
      this.vehicleKeysPressed.delete(e.code);
    };
    window.addEventListener('keyup', onKeyUp);
    this._listeners.push(() => window.removeEventListener('keyup', onKeyUp));

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) this.vehicleMouseDown = true;
      if (e.button === 2) this.vehicleRightMouseDown = true;
    };
    window.addEventListener('mousedown', onMouseDown);
    this._listeners.push(() => window.removeEventListener('mousedown', onMouseDown));

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.vehicleMouseDown = false;
      if (e.button === 2) this.vehicleRightMouseDown = false;
    };
    window.addEventListener('mouseup', onMouseUp);
    this._listeners.push(() => window.removeEventListener('mouseup', onMouseUp));

    const onContextMenu = (e: Event) => e.preventDefault();
    window.addEventListener('contextmenu', onContextMenu);
    this._listeners.push(() => window.removeEventListener('contextmenu', onContextMenu));
  }

  private teardownVehicleInput(): void {
    this._listeners.forEach((cleanup) => cleanup());
    this._listeners = [];
    this.vehicleKeysPressed.clear();
    this.vehicleMouseDown = false;
    this.vehicleRightMouseDown = false;
  }

  protected isKeyDown(code: string): boolean {
    return this.vehicleKeysPressed.has(code);
  }

  protected get isFiring(): boolean {
    return this.vehicleMouseDown;
  }

  protected get isFiringSecondary(): boolean {
    return this.vehicleRightMouseDown;
  }

  // ------------------------------------------------------------------
  // Passengers
  // ------------------------------------------------------------------

  public addPassenger(name: string, entity: Entity | null): boolean {
    if (this.passengers.length >= this.maxPassengers) return false;
    this.passengers.push({ name, entity });
    return true;
  }

  public removePassenger(name: string): VehiclePassenger | null {
    const idx = this.passengers.findIndex((p) => p.name === name);
    if (idx === -1) return null;
    return this.passengers.splice(idx, 1)[0];
  }

  // ------------------------------------------------------------------
  // Damage
  // ------------------------------------------------------------------

  public takeDamage(amount: number, source?: Vector3): void {
    // Shield absorbs first
    if (this.stats.shield > 0) {
      const absorbed = Math.min(this.stats.shield, amount);
      this.stats.shield -= absorbed;
      amount -= absorbed;
    }

    this.stats.health = Math.max(0, this.stats.health - amount);
    this.lastDamageTime = performance.now();
    this.refreshDamageState();

    getAudioManager().play('player_damage', { volume: 0.4 });

    if (this.stats.health <= 0) {
      this.onDestroyed();
    }
  }

  protected onDestroyed(): void {
    log.info(`${this.displayName} destroyed`);
    // Force eject player
    if (this._isOccupied) {
      this.exit();
    }
    getAudioManager().play('explosion', { volume: 0.8 });
  }

  // ------------------------------------------------------------------
  // Weapon heat / cooldown
  // ------------------------------------------------------------------

  protected updateWeaponHeat(deltaTime: number): void {
    for (const weapon of this.weapons) {
      if (weapon.isOverheated) {
        weapon.currentHeat = Math.max(0, weapon.currentHeat - weapon.coolRate * deltaTime * 1.5);
        if (weapon.currentHeat <= 0) {
          weapon.isOverheated = false;
        }
      } else {
        weapon.currentHeat = Math.max(0, weapon.currentHeat - weapon.coolRate * deltaTime);
      }
    }
  }

  protected canFireWeapon(weapon: VehicleWeapon): boolean {
    if (weapon.isOverheated) return false;
    const now = performance.now();
    const interval = 1000 / weapon.fireRate;
    return now - weapon.lastFireTime >= interval;
  }

  protected onWeaponFired(weapon: VehicleWeapon): void {
    weapon.lastFireTime = performance.now();
    weapon.currentHeat = Math.min(1, weapon.currentHeat + weapon.heatPerShot);
    if (weapon.currentHeat >= weapon.cooldownMax) {
      weapon.isOverheated = true;
    }
  }

  // ------------------------------------------------------------------
  // Main update
  // ------------------------------------------------------------------

  public update(deltaTime: number): void {
    if (this._disposed) return;

    // Shield regen
    const now = performance.now();
    if (
      this.stats.shield < this.stats.maxShield &&
      now - this.lastDamageTime > this.stats.shieldRegenDelay
    ) {
      this.stats.shield = Math.min(
        this.stats.maxShield,
        this.stats.shield + this.stats.shieldRegenRate * deltaTime
      );
    }

    // Weapon cooldown
    this.updateWeaponHeat(deltaTime);

    // Input + vehicle-specific logic
    if (this._isOccupied) {
      this.processInput(deltaTime);
    }
    this.updateVehicle(deltaTime);

    // Sync ECS entity
    if (this.entity.transform) {
      this.entity.transform.position.copyFrom(this.rootNode.position);
    }
    if (this.entity.health) {
      this.entity.health.current = this.stats.health;
    }
  }

  // ------------------------------------------------------------------
  // Accessors
  // ------------------------------------------------------------------

  public get position(): Vector3 {
    return this.rootNode.position;
  }

  public get isOccupied(): boolean {
    return this._isOccupied;
  }

  public get pilot(): Player | null {
    return this._pilot;
  }

  public getForward(): Vector3 {
    return this.rootNode.forward;
  }

  public getRight(): Vector3 {
    return this.rootNode.right;
  }

  public getUp(): Vector3 {
    return this.rootNode.up;
  }

  public getActiveWeapon(): VehicleWeapon | null {
    return this.weapons[this.activeWeaponIndex] ?? null;
  }

  // ------------------------------------------------------------------
  // Disposal
  // ------------------------------------------------------------------

  public dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    this.teardownVehicleInput();

    // Force exit
    if (this._isOccupied) {
      this.exit();
    }

    // Dispose meshes
    for (const mesh of this.hullMeshes) {
      mesh.material?.dispose();
      mesh.dispose();
    }
    this.hullMeshes = [];

    // Dispose damage materials
    for (const mat of this.damageMaterials.values()) {
      mat.dispose();
    }
    this.damageMaterials.clear();

    // Dispose camera
    this.vehicleCamera.dispose();

    // Dispose root
    this.rootNode.dispose();

    // Remove ECS entity
    removeEntity(this.entity);

    log.info(`Disposed ${this.displayName}`);
  }
}
