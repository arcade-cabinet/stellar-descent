/**
 * VehicleController - Player vehicle physics and controls for Canyon Run
 *
 * Provides a Warthog-inspired vehicle controller using BabylonJS:
 * - Acceleration, braking, and steering
 * - Boost ability with limited fuel
 * - Damage model with health bar
 * - Third-person chase camera with cinematic lag
 * - Keyboard (WASD/arrows) and touch controls (left stick=steer, right=accel)
 *
 * The vehicle is not a rigid body simulation; it uses a simplified arcade
 * physics model that feels responsive and fun in a chase scenario.
 */

import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';

// ---------------------------------------------------------------------------
// GLB paths for vehicle parts
// ---------------------------------------------------------------------------

const VEHICLE_BODY_GLB = '/models/spaceships/Bob.glb';
const VEHICLE_TURRET_GLB = '/models/props/weapons/fps_plasma_cannon.glb';
const VEHICLE_WHEEL_GLB = '/models/props/containers/tire_1.glb';

// ============================================================================
// TYPES
// ============================================================================

export interface VehicleConfig {
  /** Maximum forward speed (units/sec) */
  maxSpeed: number;
  /** Acceleration rate (units/sec^2) */
  acceleration: number;
  /** Braking deceleration (units/sec^2) */
  brakeDeceleration: number;
  /** Passive drag deceleration (units/sec^2) */
  dragDeceleration: number;
  /** Turning rate (radians/sec at full speed) */
  turnRate: number;
  /** Turning rate multiplier at low speed */
  lowSpeedTurnMultiplier: number;
  /** Boost speed multiplier */
  boostMultiplier: number;
  /** Boost fuel capacity (seconds of boost) */
  boostFuelMax: number;
  /** Boost fuel burn rate (per second while boosting) */
  boostBurnRate: number;
  /** Boost fuel regen rate (per second when not boosting) */
  boostRegenRate: number;
  /** Vehicle max health */
  maxHealth: number;
  /** Gravity applied per second */
  gravity: number;
  /** Ground height offset (chassis above terrain) */
  groundOffset: number;
}

export interface VehicleState {
  position: Vector3;
  rotation: number; // Y-axis heading in radians
  speed: number; // Current forward speed
  health: number;
  maxHealth: number;
  boostFuel: number;
  boostFuelMax: number;
  isBoosting: boolean;
  isGrounded: boolean;
  isDead: boolean;
  steerInput: number; // -1 to 1
  throttleInput: number; // 0 to 1
  brakeInput: number; // 0 to 1
}

export interface VehicleInput {
  steer: number; // -1 (left) to 1 (right)
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  boost: boolean;
}

const DEFAULT_CONFIG: VehicleConfig = {
  maxSpeed: 60,
  acceleration: 35,
  brakeDeceleration: 50,
  dragDeceleration: 8,
  turnRate: 1.8,
  lowSpeedTurnMultiplier: 2.5,
  boostMultiplier: 1.6,
  boostFuelMax: 5.0,
  boostBurnRate: 1.0,
  boostRegenRate: 0.3,
  maxHealth: 100,
  gravity: 30,
  groundOffset: 1.0,
};

// ============================================================================
// CAMERA CONFIGURATION
// ============================================================================

interface ChaseCameraConfig {
  /** Distance behind vehicle */
  followDistance: number;
  /** Height above vehicle */
  followHeight: number;
  /** Camera look-ahead distance (focuses point ahead of vehicle) */
  lookAheadDistance: number;
  /** Position smoothing factor (lower = smoother / more lag) */
  positionSmoothing: number;
  /** Rotation smoothing factor */
  rotationSmoothing: number;
  /** FOV boost when boosting (radians) */
  boostFOVIncrease: number;
  /** Base FOV (radians) */
  baseFOV: number;
}

const DEFAULT_CAMERA_CONFIG: ChaseCameraConfig = {
  followDistance: 12,
  followHeight: 5,
  lookAheadDistance: 15,
  positionSmoothing: 4.0,
  rotationSmoothing: 6.0,
  boostFOVIncrease: 0.25,
  baseFOV: 1.2,
};

// ============================================================================
// VEHICLE CONTROLLER
// ============================================================================

export class VehicleController {
  private scene: Scene;
  private config: VehicleConfig;
  private cameraConfig: ChaseCameraConfig;

  // Mesh hierarchy
  private rootNode: TransformNode;
  private chassis: Mesh;
  private turret: Mesh;
  private wheels: TransformNode[] = [];
  private boostFlame: Mesh | null = null;
  private headlights: Mesh[] = [];

  // State
  private state: VehicleState;
  private verticalVelocity = 0;

  // Camera
  private camera: UniversalCamera;
  private cameraTargetPos = Vector3.Zero();
  private cameraTargetLookAt = Vector3.Zero();
  private currentCameraPos = Vector3.Zero();

  // Input
  private currentInput: VehicleInput = {
    steer: 0,
    throttle: 0,
    brake: 0,
    boost: false,
  };

  // Wheel animation
  private wheelRotation = 0;

  /**
   * Create and initialize a VehicleController, preloading GLB assets.
   * Prefer this over the constructor for async GLB loading.
   */
  static async create(
    scene: Scene,
    camera: UniversalCamera,
    spawnPosition: Vector3,
    config: Partial<VehicleConfig> = {},
    cameraConfig: Partial<ChaseCameraConfig> = {}
  ): Promise<VehicleController> {
    // Pre-load GLBs so createInstanceByPath succeeds synchronously in the constructor
    await Promise.all([
      AssetManager.loadAssetByPath(VEHICLE_BODY_GLB, scene),
      AssetManager.loadAssetByPath(VEHICLE_TURRET_GLB, scene),
      AssetManager.loadAssetByPath(VEHICLE_WHEEL_GLB, scene),
    ]);
    return new VehicleController(scene, camera, spawnPosition, config, cameraConfig);
  }

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    spawnPosition: Vector3,
    config: Partial<VehicleConfig> = {},
    cameraConfig: Partial<ChaseCameraConfig> = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...cameraConfig };

    // Initialize state
    this.state = {
      position: spawnPosition.clone(),
      rotation: 0,
      speed: 0,
      health: this.config.maxHealth,
      maxHealth: this.config.maxHealth,
      boostFuel: this.config.boostFuelMax,
      boostFuelMax: this.config.boostFuelMax,
      isBoosting: false,
      isGrounded: true,
      isDead: false,
      steerInput: 0,
      throttleInput: 0,
      brakeInput: 0,
    };

    // Build vehicle mesh hierarchy
    this.rootNode = new TransformNode('vehicle_root', scene);
    this.rootNode.position = spawnPosition.clone();

    this.chassis = this.createChassis();
    this.turret = this.createTurret();
    this.createWheels();
    this.createBoostFlame();
    this.createHeadlights();

    // Initialize camera position
    this.updateCameraTarget();
    this.currentCameraPos = this.cameraTargetPos.clone();
    this.camera.position = this.currentCameraPos.clone();
  }

  // ==========================================================================
  // MESH CREATION
  // ==========================================================================

  private createChassis(): Mesh {
    // Load GLB body model (pre-loaded via VehicleController.create)
    const bodyNode = AssetManager.createInstanceByPath(
      VEHICLE_BODY_GLB,
      'vehicle_chassis_glb',
      this.scene,
      false
    );

    // Create a thin invisible box as the chassis reference mesh (needed for tilt animation)
    const chassis = MeshBuilder.CreateBox(
      'vehicle_chassis_ref',
      { width: 2.8, height: 0.05, depth: 5.5 },
      this.scene
    );
    chassis.isVisible = false;
    chassis.parent = this.rootNode;
    chassis.position.y = 0.5;

    if (bodyNode) {
      bodyNode.parent = this.rootNode;
      bodyNode.position.set(0, 0.3, 0);
      bodyNode.scaling.setAll(1.2);
      bodyNode.rotation.y = Math.PI; // face forward
    }

    return chassis;
  }

  private createTurret(): Mesh {
    // Load GLB turret / weapon model (pre-loaded via VehicleController.create)
    const turretNode = AssetManager.createInstanceByPath(
      VEHICLE_TURRET_GLB,
      'vehicle_turret_glb',
      this.scene,
      false
    );

    // Invisible reference mesh for turret position tracking
    const turret = MeshBuilder.CreateBox(
      'vehicle_turret_ref',
      { width: 0.05, height: 0.05, depth: 0.05 },
      this.scene
    );
    turret.isVisible = false;
    turret.parent = this.rootNode;
    turret.position.set(0, 1.5, -1.5);

    if (turretNode) {
      turretNode.parent = turret;
      turretNode.position.set(0, 0, 0);
      turretNode.scaling.setAll(2.0);
      turretNode.rotation.y = Math.PI; // weapon faces forward
    }

    return turret;
  }

  private createWheels(): void {
    const wheelPositions = [
      new Vector3(-1.5, -0.2, 1.8), // Front left
      new Vector3(1.5, -0.2, 1.8), // Front right
      new Vector3(-1.5, -0.2, -1.8), // Rear left
      new Vector3(1.5, -0.2, -1.8), // Rear right
    ];

    for (let i = 0; i < wheelPositions.length; i++) {
      // Create a wrapper TransformNode for rotation animation
      const wheelWrapper = new TransformNode(`vehicle_wheel_${i}`, this.scene);
      wheelWrapper.parent = this.rootNode;
      wheelWrapper.position = wheelPositions[i];

      // Load GLB tire model (pre-loaded via VehicleController.create)
      const wheelNode = AssetManager.createInstanceByPath(
        VEHICLE_WHEEL_GLB,
        `vehicle_wheel_glb_${i}`,
        this.scene,
        false
      );

      if (wheelNode) {
        wheelNode.parent = wheelWrapper;
        wheelNode.rotation.z = Math.PI / 2; // Orient tire sideways
        wheelNode.scaling.setAll(0.5); // Scale to appropriate wheel size
      }

      this.wheels.push(wheelWrapper);
    }
  }

  private createBoostFlame(): void {
    this.boostFlame = MeshBuilder.CreateCylinder(
      'vehicle_boost_flame',
      { diameterTop: 0, diameterBottom: 1.5, height: 3.0 },
      this.scene
    );
    const mat = new StandardMaterial('vehicle_flame_mat', this.scene);
    mat.emissiveColor = new Color3(1.0, 0.5, 0.1);
    mat.alpha = 0.7;
    mat.disableLighting = true;
    this.boostFlame.material = mat;
    this.boostFlame.parent = this.rootNode;
    this.boostFlame.rotation.x = Math.PI / 2;
    this.boostFlame.position.set(0, 0.5, -4.5);
    this.boostFlame.isVisible = false;
  }

  private createHeadlights(): void {
    const lightMat = new StandardMaterial('vehicle_headlight_mat', this.scene);
    lightMat.emissiveColor = new Color3(1.0, 0.95, 0.8);
    lightMat.disableLighting = true;

    const positions = [new Vector3(-0.8, 0.6, 2.8), new Vector3(0.8, 0.6, 2.8)];

    for (let i = 0; i < positions.length; i++) {
      const light = MeshBuilder.CreateSphere(
        `vehicle_headlight_${i}`,
        { diameter: 0.25 },
        this.scene
      );
      light.material = lightMat;
      light.parent = this.rootNode;
      light.position = positions[i];
      this.headlights.push(light);
    }
  }

  // ==========================================================================
  // INPUT
  // ==========================================================================

  /**
   * Set vehicle input from keyboard or touch controls.
   */
  setInput(input: VehicleInput): void {
    this.currentInput = { ...input };
  }

  /**
   * Build input from keyboard key set and touch input.
   */
  static buildInput(
    keys: Set<string>,
    touchInput: {
      movement: { x: number; y: number };
      isSprinting?: boolean;
    } | null
  ): VehicleInput {
    let steer = 0;
    let throttle = 0;
    let brake = 0;
    let boost = false;

    // Keyboard controls
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) throttle = 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) brake = 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Space')) {
      boost = true;
    }

    // Touch controls override keyboard
    if (touchInput) {
      const { movement } = touchInput;
      if (Math.abs(movement.x) > 0.1) {
        steer = Math.max(-1, Math.min(1, movement.x));
      }
      if (movement.y > 0.1) {
        throttle = Math.min(1, movement.y);
      }
      if (movement.y < -0.1) {
        brake = Math.min(1, -movement.y);
      }
      if (touchInput.isSprinting) {
        boost = true;
      }
    }

    return { steer, throttle, brake, boost };
  }

  // ==========================================================================
  // PHYSICS UPDATE
  // ==========================================================================

  /**
   * Update vehicle physics and camera.
   * @param deltaTime - Time since last frame (seconds)
   * @param getTerrainHeight - Function that returns terrain height at (x, z)
   */
  update(deltaTime: number, getTerrainHeight: (x: number, z: number) => number): void {
    if (this.state.isDead) return;

    const dt = Math.min(deltaTime, 0.05); // Cap delta to prevent tunneling
    const input = this.currentInput;

    // -- Boost fuel management --
    if (input.boost && this.state.boostFuel > 0 && input.throttle > 0) {
      this.state.isBoosting = true;
      this.state.boostFuel = Math.max(0, this.state.boostFuel - this.config.boostBurnRate * dt);
    } else {
      this.state.isBoosting = false;
      this.state.boostFuel = Math.min(
        this.config.boostFuelMax,
        this.state.boostFuel + this.config.boostRegenRate * dt
      );
    }

    // -- Speed calculation --
    const effectiveMaxSpeed = this.state.isBoosting
      ? this.config.maxSpeed * this.config.boostMultiplier
      : this.config.maxSpeed;

    // Throttle
    if (input.throttle > 0) {
      this.state.speed += this.config.acceleration * input.throttle * dt;
    }

    // Braking
    if (input.brake > 0) {
      this.state.speed -= this.config.brakeDeceleration * input.brake * dt;
    }

    // Drag (passive deceleration)
    if (input.throttle === 0 && input.brake === 0) {
      const drag = this.config.dragDeceleration * dt;
      if (this.state.speed > 0) {
        this.state.speed = Math.max(0, this.state.speed - drag);
      } else if (this.state.speed < 0) {
        this.state.speed = Math.min(0, this.state.speed + drag);
      }
    }

    // Clamp speed
    this.state.speed = Math.max(
      -this.config.maxSpeed * 0.3, // Reverse is slower
      Math.min(effectiveMaxSpeed, this.state.speed)
    );

    // -- Steering --
    const speedFactor = Math.abs(this.state.speed) / this.config.maxSpeed;
    const turnMultiplier =
      speedFactor < 0.2 ? this.config.lowSpeedTurnMultiplier * speedFactor * 5 : 1.0;
    const turnAmount = input.steer * this.config.turnRate * turnMultiplier * dt;

    // Only steer when moving
    if (Math.abs(this.state.speed) > 1.0) {
      this.state.rotation += turnAmount * Math.sign(this.state.speed);
    }

    // -- Position update --
    const forward = new Vector3(Math.sin(this.state.rotation), 0, Math.cos(this.state.rotation));
    const displacement = forward.scale(this.state.speed * dt);
    this.state.position.addInPlace(displacement);

    // -- Gravity and terrain following --
    const terrainY =
      getTerrainHeight(this.state.position.x, this.state.position.z) + this.config.groundOffset;

    if (this.state.position.y > terrainY + 0.1) {
      // In air
      this.verticalVelocity -= this.config.gravity * dt;
      this.state.position.y += this.verticalVelocity * dt;
      this.state.isGrounded = false;

      if (this.state.position.y <= terrainY) {
        this.state.position.y = terrainY;
        this.verticalVelocity = 0;
        this.state.isGrounded = true;
      }
    } else {
      // On ground - snap to terrain
      this.state.position.y = terrainY;
      this.verticalVelocity = 0;
      this.state.isGrounded = true;
    }

    // -- Apply state to mesh --
    this.rootNode.position.copyFrom(this.state.position);
    this.rootNode.rotation.y = this.state.rotation;

    // Chassis tilt during turning
    const tiltAngle = -turnAmount * 3.0;
    this.chassis.rotation.z = tiltAngle;

    // Wheel animation
    this.wheelRotation += this.state.speed * dt * 2.0;
    for (const wheel of this.wheels) {
      wheel.rotation.x = this.wheelRotation;
    }

    // Boost flame visibility
    if (this.boostFlame) {
      this.boostFlame.isVisible = this.state.isBoosting;
      if (this.state.isBoosting) {
        const scale = 0.8 + Math.random() * 0.4;
        this.boostFlame.scaling.set(scale, scale, scale);
      }
    }

    // Store input in state for HUD display
    this.state.steerInput = input.steer;
    this.state.throttleInput = input.throttle;
    this.state.brakeInput = input.brake;

    // -- Update camera --
    this.updateCamera(dt);
  }

  // ==========================================================================
  // CAMERA
  // ==========================================================================

  private updateCameraTarget(): void {
    const behindDir = new Vector3(
      -Math.sin(this.state.rotation),
      0,
      -Math.cos(this.state.rotation)
    );

    this.cameraTargetPos = this.state.position
      .add(behindDir.scale(this.cameraConfig.followDistance))
      .add(new Vector3(0, this.cameraConfig.followHeight, 0));

    const lookAheadDir = new Vector3(
      Math.sin(this.state.rotation),
      0,
      Math.cos(this.state.rotation)
    );
    this.cameraTargetLookAt = this.state.position.add(
      lookAheadDir.scale(this.cameraConfig.lookAheadDistance)
    );
  }

  private updateCamera(dt: number): void {
    this.updateCameraTarget();

    // Smooth camera follow
    const posLerp = Math.min(1, this.cameraConfig.positionSmoothing * dt);
    this.currentCameraPos = Vector3.Lerp(this.currentCameraPos, this.cameraTargetPos, posLerp);

    this.camera.position.copyFrom(this.currentCameraPos);

    // Look at the target
    const lookDir = this.cameraTargetLookAt.subtract(this.currentCameraPos).normalize();
    const targetRotY = Math.atan2(lookDir.x, lookDir.z);
    const targetRotX = -Math.asin(lookDir.y);

    const rotLerp = Math.min(1, this.cameraConfig.rotationSmoothing * dt);
    this.camera.rotation.y += (targetRotY - this.camera.rotation.y) * rotLerp;
    this.camera.rotation.x += (targetRotX - this.camera.rotation.x) * rotLerp;

    // FOV boost when boosting
    const targetFOV = this.state.isBoosting
      ? this.cameraConfig.baseFOV + this.cameraConfig.boostFOVIncrease
      : this.cameraConfig.baseFOV;
    this.camera.fov += (targetFOV - this.camera.fov) * posLerp;
  }

  // ==========================================================================
  // DAMAGE
  // ==========================================================================

  /**
   * Apply damage to the vehicle.
   * @returns true if the vehicle was destroyed
   */
  applyDamage(amount: number): boolean {
    if (this.state.isDead) return true;

    this.state.health = Math.max(0, this.state.health - amount);

    if (this.state.health <= 0) {
      this.state.isDead = true;
      this.state.speed = 0;
      return true;
    }

    return false;
  }

  /**
   * Heal the vehicle.
   */
  heal(amount: number): void {
    this.state.health = Math.min(this.config.maxHealth, this.state.health + amount);
  }

  /**
   * Apply impulse to vertical velocity (for ramps/jumps).
   */
  launchVertical(impulse: number): void {
    this.verticalVelocity = impulse;
    this.state.isGrounded = false;
  }

  // ==========================================================================
  // ACCESSORS
  // ==========================================================================

  getState(): VehicleState {
    return { ...this.state };
  }

  getPosition(): Vector3 {
    return this.state.position.clone();
  }

  getRotation(): number {
    return this.state.rotation;
  }

  getSpeed(): number {
    return this.state.speed;
  }

  getSpeedNormalized(): number {
    return Math.abs(this.state.speed) / this.config.maxSpeed;
  }

  getHealth(): number {
    return this.state.health;
  }

  getHealthNormalized(): number {
    return this.state.health / this.config.maxHealth;
  }

  getBoostFuelNormalized(): number {
    return this.state.boostFuel / this.config.boostFuelMax;
  }

  isBoosting(): boolean {
    return this.state.isBoosting;
  }

  isDead(): boolean {
    return this.state.isDead;
  }

  getRootNode(): TransformNode {
    return this.rootNode;
  }

  getForwardDirection(): Vector3 {
    return new Vector3(Math.sin(this.state.rotation), 0, Math.cos(this.state.rotation));
  }

  // ==========================================================================
  // DISPOSE
  // ==========================================================================

  dispose(): void {
    this.rootNode.dispose(false, true);
  }
}
