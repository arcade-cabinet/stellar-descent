/**
 * VehicleController - Player vehicle physics and controls for Canyon Run
 *
 * Provides a Warthog-inspired vehicle controller using BabylonJS:
 * - Acceleration, braking, and steering
 * - Boost ability with limited fuel
 * - Damage model with health bar
 * - Third-person chase camera with cinematic lag
 * - Keyboard (WASD/arrows) and touch controls (left stick=steer, right=accel)
 * - Mouse-controlled turret with auto-aim assist
 * - Speed-dependent turn radius
 * - Smooth steering with lerp interpolation
 *
 * The vehicle is not a rigid body simulation; it uses a simplified arcade
 * physics model that feels responsive and fun in a chase scenario.
 */

import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import type { VehicleYokeInput } from '../../weapons/VehicleYoke';

// ---------------------------------------------------------------------------
// GLB paths for vehicle parts
// ---------------------------------------------------------------------------

const VEHICLE_BODY_GLB = '/assets/models/spaceships/Bob.glb';
const VEHICLE_TURRET_GLB = '/assets/models/props/weapons/fps_plasma_cannon.glb';
const VEHICLE_WHEEL_GLB = '/assets/models/props/containers/tire_1.glb';
const VEHICLE_BARREL_GLB = '/assets/models/props/weapons/pipe_melee_mx_1.glb';

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
  /** [FIX #5] Vertical launch impulse when hitting ramps */
  rampLaunchImpulse?: number;
  /** [FIX #4] Speed-based FOV increase factor */
  speedFOVFactor?: number;
  /** Boost cooldown time in seconds after boost ends */
  boostCooldown?: number;
  /** Turret rotation speed (rad/s) */
  turretRotationSpeed?: number;
  /** Turret damage per shot */
  turretDamage?: number;
  /** Turret fire rate (shots per second) */
  turretFireRate?: number;
  /** Turret ammo capacity */
  turretAmmoMax?: number;
  /** Turret heat per shot (0-1) */
  turretHeatPerShot?: number;
  /** Turret cool rate (per second) */
  turretCoolRate?: number;
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
  /** [FIX #6] True when vehicle health is critical (< 25%) */
  isCritical: boolean;
  /** [FIX #42] True if vehicle just landed from a jump */
  justLanded: boolean;
  /** [FIX #4] Current speed as normalized 0-1 value */
  speedNormalized: number;
  /** Turret yaw angle relative to vehicle */
  turretYaw: number;
  /** Turret pitch angle */
  turretPitch: number;
  /** Turret heat (0-1) */
  turretHeat: number;
  /** Is turret overheated */
  turretOverheated: boolean;
  /** Is turret currently firing */
  turretFiring: boolean;
  /** Boost cooldown remaining */
  boostCooldown: number;
  /** Is vehicle handbraking */
  isHandbraking: boolean;
}

export interface VehicleInput {
  steer: number; // -1 (left) to 1 (right)
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  boost: boolean;
  /** Handbrake input */
  handbrake: boolean;
  /** Turret aim delta X (mouse movement or right stick) */
  turretAimX: number;
  /** Turret aim delta Y (mouse movement or right stick) */
  turretAimY: number;
  /** Fire turret weapon */
  fire: boolean;
  /** Exit vehicle request */
  exitRequest: boolean;
}

/**
 * Touch input state for vehicle controls
 */
export interface VehicleTouchInput {
  /** Left joystick for steering + throttle */
  movement: { x: number; y: number };
  /** Right side tap/drag for turret aim */
  turretAim: { x: number; y: number };
  /** Fire button pressed */
  isFiring: boolean;
  /** Boost button pressed */
  isBoosting: boolean;
}

const DEFAULT_CONFIG: VehicleConfig = {
  maxSpeed: 65, // [FIX #10] Slightly faster for chase excitement
  acceleration: 40, // [FIX #10] Improved responsiveness
  brakeDeceleration: 55, // [FIX #10] Better braking feel
  dragDeceleration: 6, // [FIX #10] Less drag for momentum
  turnRate: 2.0, // [FIX #1] Improved steering response
  lowSpeedTurnMultiplier: 2.8, // [FIX #1] Better low-speed maneuverability
  boostMultiplier: 1.8, // [FIX #10] More impactful boost
  boostFuelMax: 6.0, // [FIX #10] Longer boost duration
  boostBurnRate: 1.0,
  boostRegenRate: 0.4, // [FIX #10] Faster regen for repeated use
  maxHealth: 120, // [FIX #10] Slightly more health for balance
  gravity: 28, // [FIX #26] Slightly lower for better jump feel
  groundOffset: 1.2, // [FIX #24] Better chassis clearance
  rampLaunchImpulse: 12, // [FIX #5] Default ramp jump impulse
  speedFOVFactor: 0.08, // [FIX #4] FOV increases with speed
  boostCooldown: 2.0, // 2 second cooldown after boost ends
  turretRotationSpeed: 3.0, // rad/s for turret tracking
  turretDamage: 15, // Damage per turret shot
  turretFireRate: 8, // Shots per second
  turretAmmoMax: 200, // Total turret ammo
  turretHeatPerShot: 0.02, // Heat generated per shot
  turretCoolRate: 0.15, // Heat dissipated per second
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
  followDistance: 16, // [FIX #23] Increased for better vehicle visibility
  followHeight: 6, // [FIX #23] Raised for better overview
  lookAheadDistance: 20, // [FIX #23] Increased for speed anticipation
  positionSmoothing: 3.5, // [FIX #4] Slightly faster for responsive feel
  rotationSmoothing: 5.0, // [FIX #4] Slightly faster rotation tracking
  boostFOVIncrease: 0.3, // [FIX #18] Increased boost FOV effect
  baseFOV: (Math.PI * 95) / 180, // [FIX #18] 95 degrees - wider for vehicle gameplay
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
  private chassis: TransformNode;
  private turret: TransformNode;
  private turretBarrel: TransformNode | null = null;
  private turretMuzzle: TransformNode | null = null;
  private wheels: TransformNode[] = [];
  private boostFlame: Mesh | null = null;
  private headlights: Mesh[] = [];
  private muzzleFlash: Mesh | null = null;
  private turretLight: PointLight | null = null;

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
    handbrake: false,
    turretAimX: 0,
    turretAimY: 0,
    fire: false,
    exitRequest: false,
  };

  // Wheel animation
  private wheelRotation = 0;
  // [FIX #27] Wheel steering angle
  private wheelSteerAngle = 0;
  // [FIX #13] Dust trail particles (stored for disposal)
  private dustTrails: Mesh[] = [];

  // Turret state
  private turretYaw = 0;
  private turretPitch = 0;
  private lastFireTime = 0;
  private turretHeat = 0;
  private turretOverheated = false;
  private turretAmmo: number;

  // Boost cooldown
  private boostCooldownRemaining = 0;

  // Smooth steering interpolation
  private smoothSteer = 0;
  private readonly steerLerpSpeed = 8; // Higher = snappier steering

  // Turret projectiles (tracked for cleanup)
  private activeProjectiles: Mesh[] = [];

  // Crosshair target position (world space)
  private crosshairTarget = Vector3.Zero();

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
      AssetManager.loadAssetByPath(VEHICLE_BARREL_GLB, scene),
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

    // Initialize turret ammo
    this.turretAmmo = this.config.turretAmmoMax ?? 200;

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
      isCritical: false, // [FIX #6]
      justLanded: false, // [FIX #42]
      speedNormalized: 0, // [FIX #4]
      turretYaw: 0,
      turretPitch: 0,
      turretHeat: 0,
      turretOverheated: false,
      turretFiring: false,
      boostCooldown: 0,
      isHandbraking: false,
    };

    // Build vehicle mesh hierarchy
    this.rootNode = new TransformNode('vehicle_root', scene);
    this.rootNode.position = spawnPosition.clone();

    this.chassis = this.createChassis();
    this.turret = this.createTurret();
    this.createWheels();
    this.createBoostFlame();
    this.createHeadlights();
    this.createTurretVisuals();

    // Initialize camera position
    this.updateCameraTarget();
    this.currentCameraPos = this.cameraTargetPos.clone();
    this.camera.position = this.currentCameraPos.clone();
  }

  // ==========================================================================
  // MESH CREATION
  // ==========================================================================

  private createChassis(): TransformNode {
    // Load GLB body model (pre-loaded via VehicleController.create)
    const bodyNode = AssetManager.createInstanceByPath(
      VEHICLE_BODY_GLB,
      'vehicle_chassis_glb',
      this.scene,
      false
    );

    // Create a TransformNode as the chassis reference (for tilt animation)
    const chassis = new TransformNode('vehicle_chassis_ref', this.scene);
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

  private createTurret(): TransformNode {
    // Create a TransformNode as the turret base for rotation tracking
    const turret = new TransformNode('vehicle_turret_ref', this.scene);
    turret.parent = this.rootNode;
    turret.position.set(0, 1.5, -1.5);

    // Load GLB turret / weapon model (pre-loaded via VehicleController.create)
    const turretNode = AssetManager.createInstanceByPath(
      VEHICLE_TURRET_GLB,
      'vehicle_turret_glb',
      this.scene,
      false
    );

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

  /**
   * Create turret visual elements (barrel, muzzle flash, light).
   */
  private createTurretVisuals(): void {
    // Turret barrel - load GLB pipe model (pre-loaded via VehicleController.create)
    const barrelNode = AssetManager.createInstanceByPath(
      VEHICLE_BARREL_GLB,
      'vehicle_turret_barrel_glb',
      this.scene,
      false
    );

    // Create a TransformNode as the barrel base for rotation
    this.turretBarrel = new TransformNode('vehicle_turret_barrel', this.scene);
    this.turretBarrel.parent = this.turret;
    this.turretBarrel.rotation.x = -Math.PI / 2; // Point forward
    this.turretBarrel.position.set(0, 0.2, -0.75);

    if (barrelNode) {
      barrelNode.parent = this.turretBarrel;
      barrelNode.scaling.set(0.15, 1.5, 0.15); // Scale to barrel dimensions
      barrelNode.rotation.x = Math.PI / 2; // Align pipe along barrel axis
    }

    // Muzzle position (for projectile spawning)
    this.turretMuzzle = new TransformNode('turret_muzzle', this.scene);
    this.turretMuzzle.parent = this.turretBarrel;
    this.turretMuzzle.position.set(0, 0.75, 0); // End of barrel

    // Muzzle flash (VFX - keep as MeshBuilder for dynamic effect)
    this.muzzleFlash = MeshBuilder.CreateSphere(
      'vehicle_muzzle_flash',
      { diameter: 0.4, segments: 6 },
      this.scene
    );
    const flashMat = new StandardMaterial('muzzle_flash_mat', this.scene);
    flashMat.emissiveColor = new Color3(1.0, 0.7, 0.3);
    flashMat.disableLighting = true;
    flashMat.alpha = 0;
    this.muzzleFlash.material = flashMat;
    this.muzzleFlash.parent = this.turretMuzzle;
    this.muzzleFlash.position.set(0, 0.2, 0);

    // Turret light for muzzle flash illumination
    this.turretLight = new PointLight('turret_light', Vector3.Zero(), this.scene);
    this.turretLight.parent = this.turretMuzzle;
    this.turretLight.diffuse = new Color3(1.0, 0.7, 0.3);
    this.turretLight.intensity = 0;
    this.turretLight.range = 8;
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
   * Build input from keyboard key set, mouse state, and touch input.
   */
  static buildInput(
    keys: Set<string>,
    touchInput: {
      movement: { x: number; y: number };
      look?: { x: number; y: number };
      isSprinting?: boolean;
      isFiring?: boolean;
    } | null,
    mouseState?: {
      movementX: number;
      movementY: number;
      leftButton: boolean;
      rightButton: boolean;
    } | null
  ): VehicleInput {
    let steer = 0;
    let throttle = 0;
    let brake = 0;
    let boost = false;
    let handbrake = false;
    let turretAimX = 0;
    let turretAimY = 0;
    let fire = false;
    let exitRequest = false;

    // Keyboard controls
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) throttle = 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) brake = 1;

    // Boost: Shift
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) {
      boost = true;
    }

    // Handbrake: Space
    if (keys.has('Space')) {
      handbrake = true;
    }

    // Exit: E (when stopped)
    if (keys.has('KeyE')) {
      exitRequest = true;
    }

    // Mouse controls for turret
    if (mouseState) {
      turretAimX = mouseState.movementX * 0.003; // Sensitivity factor
      turretAimY = mouseState.movementY * 0.003;
      fire = mouseState.leftButton;
    }

    // Touch controls override keyboard
    if (touchInput) {
      const { movement } = touchInput;

      // Left joystick: steering + throttle
      if (Math.abs(movement.x) > 0.1) {
        steer = Math.max(-1, Math.min(1, movement.x));
      }
      if (movement.y > 0.1) {
        throttle = Math.min(1, movement.y);
      }
      if (movement.y < -0.1) {
        brake = Math.min(1, -movement.y);
      }

      // Boost from touch sprint button
      if (touchInput.isSprinting) {
        boost = true;
      }

      // Turret aim from right side of screen (look input)
      if (touchInput.look) {
        turretAimX = touchInput.look.x * 0.5;
        turretAimY = touchInput.look.y * 0.5;
      }

      // Fire from touch fire button
      if (touchInput.isFiring) {
        fire = true;
      }
    }

    return {
      steer,
      throttle,
      brake,
      boost,
      handbrake,
      turretAimX,
      turretAimY,
      fire,
      exitRequest,
    };
  }

  /**
   * Build input from VehicleTouchInput (mobile-specific).
   */
  static buildInputFromTouch(touch: VehicleTouchInput): VehicleInput {
    const { movement, turretAim, isFiring, isBoosting } = touch;

    let steer = 0;
    let throttle = 0;
    let brake = 0;

    // Left joystick: steering + throttle
    if (Math.abs(movement.x) > 0.15) {
      steer = Math.max(-1, Math.min(1, movement.x));
    }
    if (movement.y > 0.15) {
      throttle = Math.min(1, movement.y);
    }
    if (movement.y < -0.15) {
      brake = Math.min(1, -movement.y);
    }

    return {
      steer,
      throttle,
      brake,
      boost: isBoosting,
      handbrake: false,
      turretAimX: turretAim.x * 0.5,
      turretAimY: turretAim.y * 0.5,
      fire: isFiring,
      exitRequest: false,
    };
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

    // -- Boost cooldown management --
    if (this.boostCooldownRemaining > 0) {
      this.boostCooldownRemaining -= dt;
    }
    this.state.boostCooldown = Math.max(0, this.boostCooldownRemaining);

    // -- Boost fuel management --
    const canBoost =
      this.boostCooldownRemaining <= 0 && this.state.boostFuel > 0 && input.throttle > 0;
    if (input.boost && canBoost) {
      this.state.isBoosting = true;
      this.state.boostFuel = Math.max(0, this.state.boostFuel - this.config.boostBurnRate * dt);

      // Start cooldown when boost fuel depletes
      if (this.state.boostFuel <= 0) {
        this.boostCooldownRemaining = this.config.boostCooldown ?? 2.0;
      }
    } else {
      // If boost was active and now stopped, start cooldown
      if (this.state.isBoosting && !input.boost) {
        this.boostCooldownRemaining = this.config.boostCooldown ?? 2.0;
      }
      this.state.isBoosting = false;

      // Regenerate boost fuel only when not on cooldown
      if (this.boostCooldownRemaining <= 0) {
        this.state.boostFuel = Math.min(
          this.config.boostFuelMax,
          this.state.boostFuel + this.config.boostRegenRate * dt
        );
      }
    }

    // -- Handbrake --
    this.state.isHandbraking = input.handbrake;

    // -- Speed calculation --
    const effectiveMaxSpeed = this.state.isBoosting
      ? this.config.maxSpeed * this.config.boostMultiplier
      : this.config.maxSpeed;

    // Throttle
    if (input.throttle > 0 && !input.handbrake) {
      this.state.speed += this.config.acceleration * input.throttle * dt;
    }

    // Braking
    if (input.brake > 0) {
      this.state.speed -= this.config.brakeDeceleration * input.brake * dt;
    }

    // Handbrake: rapid deceleration + allow drifting
    if (input.handbrake && this.state.speed > 0) {
      this.state.speed -= this.config.brakeDeceleration * 0.8 * dt;
    }

    // Drag (passive deceleration)
    if (input.throttle === 0 && input.brake === 0 && !input.handbrake) {
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

    // -- Smooth steering with lerp --
    this.smoothSteer += (input.steer - this.smoothSteer) * Math.min(1, this.steerLerpSpeed * dt);

    // -- Speed-dependent turn radius --
    const speedFactor = Math.abs(this.state.speed) / this.config.maxSpeed;

    // At low speed: can turn sharply. At high speed: reduced turn rate.
    // Handbrake allows sharper turns at high speed (drifting)
    let turnMultiplier: number;
    if (speedFactor < 0.2) {
      turnMultiplier = this.config.lowSpeedTurnMultiplier * speedFactor * 5;
    } else if (input.handbrake) {
      // Handbrake drift: maintain good turn rate at high speed
      turnMultiplier = 1.2;
    } else {
      // Normal high speed: reduced turn rate
      turnMultiplier = 1.0 - speedFactor * 0.4;
    }

    const turnAmount = this.smoothSteer * this.config.turnRate * turnMultiplier * dt;

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

    // [FIX #42] Track if we were airborne before this frame
    const wasAirborne = !this.state.isGrounded;
    this.state.justLanded = false;

    if (this.state.position.y > terrainY + 0.1) {
      // In air
      this.verticalVelocity -= this.config.gravity * dt;
      // [FIX #26] Clamp vertical velocity to prevent tunneling
      this.verticalVelocity = Math.max(-50, Math.min(30, this.verticalVelocity));
      this.state.position.y += this.verticalVelocity * dt;
      this.state.isGrounded = false;

      if (this.state.position.y <= terrainY) {
        this.state.position.y = terrainY;
        // [FIX #42] Detect landing
        if (wasAirborne && Math.abs(this.verticalVelocity) > 5) {
          this.state.justLanded = true;
        }
        this.verticalVelocity = 0;
        this.state.isGrounded = true;
      }
    } else {
      // On ground - snap to terrain
      this.state.position.y = terrainY;
      this.verticalVelocity = 0;
      this.state.isGrounded = true;
    }

    // [FIX #4] Update speed normalized for FOV calculation
    this.state.speedNormalized = Math.abs(this.state.speed) / this.config.maxSpeed;

    // [FIX #6] Update critical state
    this.state.isCritical = this.state.health / this.config.maxHealth < 0.25;

    // -- Apply state to mesh --
    this.rootNode.position.copyFrom(this.state.position);
    this.rootNode.rotation.y = this.state.rotation;

    // Chassis tilt during turning
    const tiltAngle = -turnAmount * 3.0;
    this.chassis.rotation.z = tiltAngle;

    // Wheel animation
    this.wheelRotation += this.state.speed * dt * 2.0;
    // [FIX #27] Smooth steering animation for front wheels
    const targetSteerAngle = this.smoothSteer * 0.4; // Max 22 degrees
    this.wheelSteerAngle += (targetSteerAngle - this.wheelSteerAngle) * 8 * dt;

    for (let i = 0; i < this.wheels.length; i++) {
      const wheel = this.wheels[i];
      wheel.rotation.x = this.wheelRotation;
      // Front wheels (0, 1) steer
      if (i < 2) {
        wheel.rotation.y = this.wheelSteerAngle;
      }
    }

    // Boost flame visibility
    if (this.boostFlame) {
      this.boostFlame.isVisible = this.state.isBoosting;
      if (this.state.isBoosting) {
        const scale = 0.8 + Math.random() * 0.4;
        this.boostFlame.scaling.set(scale, scale, scale);
      }
    }

    // -- Update turret --
    this.updateTurret(dt, input);

    // Store input in state for HUD display
    this.state.steerInput = input.steer;
    this.state.throttleInput = input.throttle;
    this.state.brakeInput = input.brake;

    // -- Update camera --
    this.updateCamera(dt);
  }

  /**
   * Update turret aiming, heat, and firing.
   */
  private updateTurret(dt: number, input: VehicleInput): void {
    // Update turret rotation from mouse/touch input
    const turretSpeed = this.config.turretRotationSpeed ?? 3.0;
    this.turretYaw += input.turretAimX * turretSpeed;
    this.turretPitch += input.turretAimY * turretSpeed;

    // Clamp turret angles
    this.turretYaw = Math.max(-Math.PI * 0.6, Math.min(Math.PI * 0.6, this.turretYaw)); // 108 degrees each way
    this.turretPitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 4, this.turretPitch)); // -30 to +45 degrees

    // Apply turret rotation
    if (this.turret) {
      this.turret.rotation.y = this.turretYaw;
    }
    if (this.turretBarrel) {
      this.turretBarrel.rotation.x = -Math.PI / 2 - this.turretPitch;
    }

    // Update turret heat (cooling)
    if (!this.turretOverheated) {
      this.turretHeat = Math.max(0, this.turretHeat - (this.config.turretCoolRate ?? 0.15) * dt);
    } else {
      // Faster cooling when overheated
      this.turretHeat = Math.max(
        0,
        this.turretHeat - (this.config.turretCoolRate ?? 0.15) * 2 * dt
      );
      if (this.turretHeat <= 0) {
        this.turretOverheated = false;
      }
    }

    // Handle firing
    this.state.turretFiring = false;
    if (input.fire && !this.turretOverheated && this.turretAmmo > 0) {
      const now = performance.now();
      const fireInterval = 1000 / (this.config.turretFireRate ?? 8);
      if (now - this.lastFireTime >= fireInterval) {
        this.fireTurret();
        this.lastFireTime = now;
        this.state.turretFiring = true;
      }
    }

    // Update muzzle flash
    this.updateMuzzleFlash(dt);

    // Sync turret state
    this.state.turretYaw = this.turretYaw;
    this.state.turretPitch = this.turretPitch;
    this.state.turretHeat = this.turretHeat;
    this.state.turretOverheated = this.turretOverheated;

    // Calculate crosshair target (world position the turret is aiming at)
    this.updateCrosshairTarget();
  }

  /**
   * Fire the turret weapon.
   */
  private fireTurret(): void {
    if (!this.turretMuzzle) return;

    // Get muzzle world position
    const muzzleWorldPos = this.turretMuzzle.getAbsolutePosition();

    // Get turret forward direction in world space
    const turretForward = this.getTurretWorldForward();

    // Create projectile
    this.createTurretProjectile(muzzleWorldPos, turretForward);

    // Apply heat
    this.turretHeat += this.config.turretHeatPerShot ?? 0.02;
    if (this.turretHeat >= 1) {
      this.turretOverheated = true;
      this.turretHeat = 1;
    }

    // Use ammo
    this.turretAmmo = Math.max(0, this.turretAmmo - 1);

    // Show muzzle flash
    if (this.muzzleFlash?.material instanceof StandardMaterial) {
      this.muzzleFlash.material.alpha = 1;
    }
    if (this.turretLight) {
      this.turretLight.intensity = 8;
    }

    // Play sound
    try {
      getAudioManager().play('rifle_fire', { volume: 0.3 });
    } catch {
      // Audio not available
    }
  }

  /**
   * Create a turret projectile.
   */
  private createTurretProjectile(position: Vector3, direction: Vector3): void {
    const projectile = MeshBuilder.CreateCylinder(
      `turret_proj_${Date.now()}`,
      { height: 0.6, diameterTop: 0.05, diameterBottom: 0.08, tessellation: 8 },
      this.scene
    );
    projectile.position = position.clone();

    // Orient along direction
    const up = Vector3.Up();
    const axis = Vector3.Cross(up, direction).normalize();
    if (axis.length() > 0.001) {
      const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(up, direction))));
      projectile.rotationQuaternion = Quaternion.RotationAxis(axis, angle);
    }

    const mat = new StandardMaterial('turret_proj_mat', this.scene);
    mat.emissiveColor = new Color3(1.0, 0.7, 0.2);
    mat.disableLighting = true;
    projectile.material = mat;

    this.activeProjectiles.push(projectile);

    // Animate projectile
    const velocity = direction.scale(120); // Fast projectile
    const startTime = performance.now();
    const maxLifetime = 2000; // 2 seconds

    const animate = () => {
      if (projectile.isDisposed()) return;

      const elapsed = performance.now() - startTime;
      if (elapsed > maxLifetime) {
        mat.dispose();
        projectile.dispose();
        const idx = this.activeProjectiles.indexOf(projectile);
        if (idx >= 0) this.activeProjectiles.splice(idx, 1);
        return;
      }

      // Move projectile
      const dt = 1 / 60;
      projectile.position.addInPlace(velocity.scale(dt));

      // Check ground collision
      if (projectile.position.y < 0) {
        mat.dispose();
        projectile.dispose();
        const idx = this.activeProjectiles.indexOf(projectile);
        if (idx >= 0) this.activeProjectiles.splice(idx, 1);
        return;
      }

      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /**
   * Update muzzle flash visibility (fade out).
   */
  private updateMuzzleFlash(dt: number): void {
    if (this.muzzleFlash?.material instanceof StandardMaterial) {
      this.muzzleFlash.material.alpha = Math.max(0, this.muzzleFlash.material.alpha - dt * 15);
    }
    if (this.turretLight) {
      this.turretLight.intensity = Math.max(0, this.turretLight.intensity - dt * 40);
    }
  }

  /**
   * Get the turret's forward direction in world space.
   */
  private getTurretWorldForward(): Vector3 {
    if (!this.turretBarrel) {
      return this.getForwardDirection();
    }

    // Get barrel's world matrix and extract forward
    const worldMatrix = this.turretBarrel.getWorldMatrix();
    const forward = Vector3.TransformNormal(new Vector3(0, 1, 0), worldMatrix).normalize();
    return forward;
  }

  /**
   * Update crosshair target position (for HUD).
   */
  private updateCrosshairTarget(): void {
    const turretForward = this.getTurretWorldForward();
    const muzzlePos = this.turretMuzzle?.getAbsolutePosition() ?? this.state.position;
    // Project crosshair 100 units ahead
    this.crosshairTarget = muzzlePos.add(turretForward.scale(100));
  }

  /**
   * Get crosshair world position for HUD overlay.
   */
  getCrosshairWorldPosition(): Vector3 {
    return this.crosshairTarget.clone();
  }

  /**
   * Get turret ammo count.
   */
  getTurretAmmo(): number {
    return this.turretAmmo;
  }

  /**
   * Get turret ammo as normalized value.
   */
  getTurretAmmoNormalized(): number {
    return this.turretAmmo / (this.config.turretAmmoMax ?? 200);
  }

  /**
   * Get turret heat as normalized value.
   */
  getTurretHeatNormalized(): number {
    return this.turretHeat;
  }

  /**
   * Check if turret is overheated.
   */
  isTurretOverheated(): boolean {
    return this.turretOverheated;
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

    // [FIX #4] FOV scales with speed, plus extra when boosting
    const speedFOVBonus = this.state.speedNormalized * (this.config.speedFOVFactor ?? 0.08);
    const boostFOVBonus = this.state.isBoosting ? this.cameraConfig.boostFOVIncrease : 0;
    const targetFOV = this.cameraConfig.baseFOV + speedFOVBonus + boostFOVBonus;
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

  /**
   * [FIX #5] Check if vehicle is on a ramp and apply launch if moving fast enough.
   * Call this from the level update with ramp collision data.
   * @param rampNormal - The surface normal of the ramp
   * @param minSpeedForLaunch - Minimum speed to trigger launch (default: 30)
   */
  checkRampLaunch(rampNormal: Vector3, minSpeedForLaunch: number = 30): boolean {
    if (!this.state.isGrounded) return false;
    if (Math.abs(this.state.speed) < minSpeedForLaunch) return false;

    // Check if ramp is angled upward in the direction of travel
    const forward = this.getForwardDirection();
    const dot = Vector3.Dot(forward, rampNormal);

    // Ramp facing somewhat toward vehicle direction
    if (dot < -0.2 && dot > -0.8) {
      const launchImpulse = this.config.rampLaunchImpulse ?? 12;
      // Scale launch by speed
      const speedFactor = Math.abs(this.state.speed) / this.config.maxSpeed;
      this.launchVertical(launchImpulse * speedFactor);
      return true;
    }
    return false;
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

  /**
   * Get the yoke input state for visual feedback on the first-person yoke model.
   * This should be passed to FirstPersonWeaponSystem.updateVehicleYoke().
   */
  getYokeInput(deltaTime: number): VehicleYokeInput {
    return {
      steerInput: this.state.steerInput,
      throttleInput: this.state.throttleInput,
      brakeInput: this.state.brakeInput,
      healthNormalized: this.state.health / this.config.maxHealth,
      boostNormalized: this.state.boostFuel / this.config.boostFuelMax,
      isBoosting: this.state.isBoosting,
      speedNormalized: this.state.speedNormalized,
      deltaTime,
    };
  }

  // ==========================================================================
  // DISPOSE
  // ==========================================================================

  dispose(): void {
    // Dispose active projectiles
    for (const proj of this.activeProjectiles) {
      proj.material?.dispose();
      proj.dispose();
    }
    this.activeProjectiles = [];

    // Dispose dust trails
    for (const dust of this.dustTrails) {
      dust.material?.dispose();
      dust.dispose();
    }
    this.dustTrails = [];

    // Dispose turret light
    this.turretLight?.dispose();
    this.turretLight = null;

    this.rootNode.dispose(false, true);
  }

  /**
   * Check if player can exit the vehicle (must be nearly stopped).
   */
  canExit(): boolean {
    return Math.abs(this.state.speed) < 3;
  }

  /**
   * Get the exit position for the player (side of vehicle).
   */
  getExitPosition(): Vector3 {
    const right = new Vector3(Math.cos(this.state.rotation), 0, -Math.sin(this.state.rotation));
    return this.state.position.add(right.scale(3)).add(new Vector3(0, 0.5, 0));
  }
}
