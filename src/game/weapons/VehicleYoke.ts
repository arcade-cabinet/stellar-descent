/**
 * VehicleYoke - First-person vehicle steering yoke/wheel for vehicle sections
 *
 * When the player enters a vehicle, this replaces their weapon with a
 * butterfly/military-style steering yoke that provides visual feedback
 * during driving. The yoke rotates based on steering input and displays
 * vehicle telemetry (throttle, health, boost).
 *
 * Features:
 * - Procedural 3D butterfly yoke model (two triangular grips)
 * - Steering rotation animation (+-45 degrees)
 * - Throttle indicator LED bar
 * - Vehicle health display on center console
 * - Boost meter visualization
 * - Desktop: Mouse X for steering, wheel for throttle
 * - Mobile: Gyroscope support with fallback to touch joystick
 *
 * @module
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { getLogger } from '../core/Logger';

const log = getLogger('VehicleYoke');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum yoke rotation in radians (45 degrees each direction). */
const MAX_YOKE_ROTATION = Math.PI / 4;

/** Yoke rotation lerp speed for smooth animation. */
const YOKE_ROTATION_LERP = 8.0;

/** Throttle indicator update rate. */
const THROTTLE_LERP = 10.0;

/** Size constants for the yoke model. */
const YOKE_SCALE = 0.15;
const GRIP_SIZE = 0.08;
const CENTER_HUB_RADIUS = 0.04;
const ARM_LENGTH = 0.12;
const ARM_THICKNESS = 0.015;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * State data fed to the yoke each frame.
 */
export interface VehicleYokeInput {
  /** Steering input from -1 (left) to 1 (right). */
  steerInput: number;
  /** Throttle input from 0 to 1. */
  throttleInput: number;
  /** Brake input from 0 to 1. */
  brakeInput: number;
  /** Vehicle health (0-1). */
  healthNormalized: number;
  /** Boost fuel (0-1). */
  boostNormalized: number;
  /** Whether boost is currently active. */
  isBoosting: boolean;
  /** Vehicle speed (0-1 normalized). */
  speedNormalized: number;
  /** Delta time for smooth animations. */
  deltaTime: number;
}

/**
 * Gyroscope input state for mobile controls.
 */
export interface GyroscopeState {
  /** Is gyroscope available on this device. */
  available: boolean;
  /** Is gyroscope currently enabled by user. */
  enabled: boolean;
  /** Gamma (tilt left/right) in degrees, -90 to 90. */
  gamma: number;
  /** Beta (tilt forward/back) in degrees, -180 to 180. */
  beta: number;
  /** Sensitivity multiplier (user setting). */
  sensitivity: number;
}

// ---------------------------------------------------------------------------
// Gyroscope Manager
// ---------------------------------------------------------------------------

/**
 * Manages device orientation (gyroscope) input for mobile vehicles.
 */
export class GyroscopeManager {
  private static instance: GyroscopeManager | null = null;

  private state: GyroscopeState = {
    available: false,
    enabled: false,
    gamma: 0,
    beta: 0,
    sensitivity: 1.0,
  };

  private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;

  private constructor() {
    // Check for gyroscope availability
    this.checkAvailability();
  }

  static getInstance(): GyroscopeManager {
    if (!GyroscopeManager.instance) {
      GyroscopeManager.instance = new GyroscopeManager();
    }
    return GyroscopeManager.instance;
  }

  private checkAvailability(): void {
    // Check if DeviceOrientationEvent is available
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      this.state.available = true;
      log.info('Gyroscope available on this device');
    } else {
      this.state.available = false;
      log.info('Gyroscope not available on this device');
    }
  }

  /**
   * Request permission and enable gyroscope (required on iOS 13+).
   */
  async enable(): Promise<boolean> {
    if (!this.state.available) {
      return false;
    }

    // iOS 13+ requires permission request
    const DeviceOrientationEventTyped = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    if (typeof DeviceOrientationEventTyped.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEventTyped.requestPermission();
        if (permission !== 'granted') {
          log.warn('Gyroscope permission denied');
          return false;
        }
        this.permissionGranted = true;
      } catch (error) {
        log.error('Error requesting gyroscope permission:', error);
        return false;
      }
    } else {
      // Non-iOS or older iOS - no permission needed
      this.permissionGranted = true;
    }

    // Attach orientation listener
    this.orientationHandler = (e: DeviceOrientationEvent) => {
      this.state.gamma = e.gamma ?? 0;
      this.state.beta = e.beta ?? 0;
    };

    window.addEventListener('deviceorientation', this.orientationHandler);
    this.state.enabled = true;
    log.info('Gyroscope enabled');
    return true;
  }

  /**
   * Disable gyroscope input.
   */
  disable(): void {
    if (this.orientationHandler) {
      window.removeEventListener('deviceorientation', this.orientationHandler);
      this.orientationHandler = null;
    }
    this.state.enabled = false;
    this.state.gamma = 0;
    this.state.beta = 0;
    log.info('Gyroscope disabled');
  }

  /**
   * Get current gyroscope state.
   */
  getState(): Readonly<GyroscopeState> {
    return this.state;
  }

  /**
   * Get steering input from gyroscope (-1 to 1).
   * Uses gamma (left/right tilt).
   */
  getSteeringInput(): number {
    if (!this.state.enabled) return 0;

    // Map gamma (-90 to 90) to steering (-1 to 1)
    // Use a narrower range (e.g., -30 to 30 degrees) for more responsive control
    const maxTilt = 30;
    const gamma = Math.max(-maxTilt, Math.min(maxTilt, this.state.gamma));
    return (gamma / maxTilt) * this.state.sensitivity;
  }

  /**
   * Get throttle input from gyroscope (0 to 1).
   * Uses beta (forward/back tilt).
   */
  getThrottleInput(): { throttle: number; brake: number } {
    if (!this.state.enabled) return { throttle: 0, brake: 0 };

    // Beta: 0 = flat, negative = tilted forward, positive = tilted back
    // Forward tilt = accelerate, back tilt = brake
    const maxTilt = 30;

    // Offset for neutral position (device held at ~45 degrees)
    const neutralBeta = 45;
    const adjustedBeta = this.state.beta - neutralBeta;

    let throttle = 0;
    let brake = 0;

    if (adjustedBeta < -5) {
      // Tilted forward - accelerate
      throttle = Math.min(1, (-adjustedBeta - 5) / maxTilt) * this.state.sensitivity;
    } else if (adjustedBeta > 5) {
      // Tilted back - brake
      brake = Math.min(1, (adjustedBeta - 5) / maxTilt) * this.state.sensitivity;
    }

    return { throttle, brake };
  }

  /**
   * Set gyroscope sensitivity (0.5 to 2.0).
   */
  setSensitivity(sensitivity: number): void {
    this.state.sensitivity = Math.max(0.5, Math.min(2.0, sensitivity));
  }

  /**
   * Check if gyroscope is available.
   */
  isAvailable(): boolean {
    return this.state.available;
  }

  /**
   * Check if gyroscope is enabled.
   */
  isEnabled(): boolean {
    return this.state.enabled;
  }

  dispose(): void {
    this.disable();
    GyroscopeManager.instance = null;
  }
}

// ---------------------------------------------------------------------------
// Vehicle Yoke Mesh Builder
// ---------------------------------------------------------------------------

/**
 * Build the procedural butterfly yoke mesh.
 * Two triangular grips connected at a center hub.
 */
export function buildVehicleYokeMesh(scene: Scene): {
  root: TransformNode;
  meshes: AbstractMesh[];
  throttleLEDs: Mesh[];
  healthDisplay: Mesh;
  boostMeter: Mesh;
  materials: StandardMaterial[];
} {
  const root = new TransformNode('vehicle_yoke_root', scene);
  const meshes: AbstractMesh[] = [];
  const materials: StandardMaterial[] = [];

  // Materials
  const frameMat = new StandardMaterial('yoke_frame_mat', scene);
  frameMat.diffuseColor = Color3.FromHexString('#1A1A1A'); // Matte black
  frameMat.specularColor = new Color3(0.2, 0.2, 0.2);
  materials.push(frameMat);

  const gripMat = new StandardMaterial('yoke_grip_mat', scene);
  gripMat.diffuseColor = Color3.FromHexString('#CC7700'); // Orange/yellow grip
  gripMat.specularColor = new Color3(0.3, 0.3, 0.3);
  materials.push(gripMat);

  const hubMat = new StandardMaterial('yoke_hub_mat', scene);
  hubMat.diffuseColor = Color3.FromHexString('#2A2A2A');
  hubMat.specularColor = new Color3(0.4, 0.4, 0.4);
  materials.push(hubMat);

  const ledOffMat = new StandardMaterial('yoke_led_off_mat', scene);
  ledOffMat.diffuseColor = Color3.FromHexString('#333333');
  ledOffMat.emissiveColor = Color3.FromHexString('#111111');
  materials.push(ledOffMat);

  const ledGreenMat = new StandardMaterial('yoke_led_green_mat', scene);
  ledGreenMat.diffuseColor = Color3.FromHexString('#00FF00');
  ledGreenMat.emissiveColor = new Color3(0, 0.5, 0);
  ledGreenMat.disableLighting = true;
  materials.push(ledGreenMat);

  const displayMat = new StandardMaterial('yoke_display_mat', scene);
  displayMat.diffuseColor = Color3.FromHexString('#003300');
  displayMat.emissiveColor = new Color3(0, 0.3, 0);
  materials.push(displayMat);

  const boostMat = new StandardMaterial('yoke_boost_mat', scene);
  boostMat.diffuseColor = Color3.FromHexString('#0066CC');
  boostMat.emissiveColor = new Color3(0, 0.2, 0.6);
  boostMat.disableLighting = true;
  materials.push(boostMat);

  // Center hub
  const hub = MeshBuilder.CreateCylinder(
    'yoke_hub',
    {
      diameter: CENTER_HUB_RADIUS * 2,
      height: 0.02,
      tessellation: 16,
    },
    scene
  );
  hub.material = hubMat;
  hub.parent = root;
  hub.rotation.x = Math.PI / 2;
  meshes.push(hub);

  // Build butterfly arms (two triangular sections)
  for (let side = -1; side <= 1; side += 2) {
    // Horizontal arm from center
    const arm = MeshBuilder.CreateBox(
      `yoke_arm_${side}`,
      { width: ARM_LENGTH, height: ARM_THICKNESS, depth: ARM_THICKNESS },
      scene
    );
    arm.material = frameMat;
    arm.parent = root;
    arm.position.set(side * (ARM_LENGTH / 2), 0, 0);
    meshes.push(arm);

    // Angled bar (top of triangle)
    const angleBar = MeshBuilder.CreateBox(
      `yoke_angle_${side}`,
      { width: ARM_LENGTH * 0.7, height: ARM_THICKNESS, depth: ARM_THICKNESS },
      scene
    );
    angleBar.material = frameMat;
    angleBar.parent = root;
    angleBar.position.set(side * ARM_LENGTH * 0.65, ARM_LENGTH * 0.4, 0);
    angleBar.rotation.z = side * 0.6; // Angled inward
    meshes.push(angleBar);

    // Vertical connector
    const vertBar = MeshBuilder.CreateBox(
      `yoke_vert_${side}`,
      { width: ARM_THICKNESS, height: ARM_LENGTH * 0.5, depth: ARM_THICKNESS },
      scene
    );
    vertBar.material = frameMat;
    vertBar.parent = root;
    vertBar.position.set(side * ARM_LENGTH, ARM_LENGTH * 0.2, 0);
    meshes.push(vertBar);

    // Grip handle at the end
    const grip = MeshBuilder.CreateCylinder(
      `yoke_grip_${side}`,
      { diameter: GRIP_SIZE, height: GRIP_SIZE * 2, tessellation: 12 },
      scene
    );
    grip.material = gripMat;
    grip.parent = root;
    grip.position.set(side * ARM_LENGTH, -GRIP_SIZE * 0.5, 0);
    grip.rotation.x = Math.PI / 2;
    meshes.push(grip);

    // Button on grip (fire button visual)
    const button = MeshBuilder.CreateCylinder(
      `yoke_button_${side}`,
      { diameter: GRIP_SIZE * 0.4, height: 0.01, tessellation: 8 },
      scene
    );
    button.material = hubMat;
    button.parent = root;
    button.position.set(side * ARM_LENGTH, -GRIP_SIZE * 0.2, GRIP_SIZE * 0.35);
    meshes.push(button);
  }

  // Center console / display area
  const console = MeshBuilder.CreateBox(
    'yoke_console',
    { width: 0.06, height: 0.04, depth: 0.02 },
    scene
  );
  console.material = hubMat;
  console.parent = root;
  console.position.set(0, -0.02, 0.02);
  meshes.push(console);

  // Throttle LED bar (5 segments)
  const throttleLEDs: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const led = MeshBuilder.CreateBox(
      `yoke_throttle_led_${i}`,
      { width: 0.008, height: 0.004, depth: 0.002 },
      scene
    );
    led.material = ledOffMat;
    led.parent = root;
    led.position.set(-0.022 + i * 0.011, -0.01, 0.03);
    meshes.push(led);
    throttleLEDs.push(led);
  }

  // Health display (horizontal bar)
  const healthDisplay = MeshBuilder.CreateBox(
    'yoke_health_display',
    { width: 0.05, height: 0.006, depth: 0.002 },
    scene
  );
  healthDisplay.material = displayMat;
  healthDisplay.parent = root;
  healthDisplay.position.set(0, -0.025, 0.03);
  meshes.push(healthDisplay);

  // Boost meter (vertical bar on the side)
  const boostMeter = MeshBuilder.CreateBox(
    'yoke_boost_meter',
    { width: 0.006, height: 0.03, depth: 0.002 },
    scene
  );
  boostMeter.material = boostMat;
  boostMeter.parent = root;
  boostMeter.position.set(0.04, -0.015, 0.02);
  meshes.push(boostMeter);

  // Scale the entire yoke
  root.scaling.setAll(YOKE_SCALE);

  return {
    root,
    meshes,
    throttleLEDs,
    healthDisplay,
    boostMeter,
    materials,
  };
}

// ---------------------------------------------------------------------------
// Vehicle Yoke Controller
// ---------------------------------------------------------------------------

/**
 * VehicleYokeController manages the yoke mesh and animations.
 * Attach to the first-person weapon anchor when in a vehicle.
 */
export class VehicleYokeController {
  private scene: Scene;
  private root: TransformNode;
  private meshes: AbstractMesh[];
  private throttleLEDs: Mesh[];
  private healthDisplay: Mesh;
  private boostMeter: Mesh;
  private materials: StandardMaterial[];

  // Animation state
  private currentSteerAngle = 0;
  private currentThrottle = 0;
  private currentHealth = 1;
  private currentBoost = 1;

  // LED materials (cached for switching)
  private ledOffMat: StandardMaterial | null = null;
  private ledGreenMat: StandardMaterial | null = null;
  private ledYellowMat: StandardMaterial | null = null;
  private ledRedMat: StandardMaterial | null = null;

  // Boost active effect
  private boostPulseTime = 0;

  constructor(scene: Scene) {
    this.scene = scene;

    // Build the yoke mesh
    const yoke = buildVehicleYokeMesh(scene);
    this.root = yoke.root;
    this.meshes = yoke.meshes;
    this.throttleLEDs = yoke.throttleLEDs;
    this.healthDisplay = yoke.healthDisplay;
    this.boostMeter = yoke.boostMeter;
    this.materials = yoke.materials;

    // Cache LED materials
    this.createLEDMaterials();

    log.info('VehicleYokeController initialized');
  }

  private createLEDMaterials(): void {
    this.ledOffMat = new StandardMaterial('led_off', this.scene);
    this.ledOffMat.diffuseColor = Color3.FromHexString('#333333');
    this.ledOffMat.emissiveColor = Color3.FromHexString('#111111');

    this.ledGreenMat = new StandardMaterial('led_green', this.scene);
    this.ledGreenMat.diffuseColor = Color3.FromHexString('#00FF00');
    this.ledGreenMat.emissiveColor = new Color3(0, 0.6, 0);
    this.ledGreenMat.disableLighting = true;

    this.ledYellowMat = new StandardMaterial('led_yellow', this.scene);
    this.ledYellowMat.diffuseColor = Color3.FromHexString('#FFCC00');
    this.ledYellowMat.emissiveColor = new Color3(0.6, 0.5, 0);
    this.ledYellowMat.disableLighting = true;

    this.ledRedMat = new StandardMaterial('led_red', this.scene);
    this.ledRedMat.diffuseColor = Color3.FromHexString('#FF0000');
    this.ledRedMat.emissiveColor = new Color3(0.6, 0, 0);
    this.ledRedMat.disableLighting = true;

    this.materials.push(this.ledOffMat, this.ledGreenMat, this.ledYellowMat, this.ledRedMat);
  }

  /**
   * Get the root transform node for parenting to weapon anchor.
   */
  getRoot(): TransformNode {
    return this.root;
  }

  /**
   * Get all meshes for layer mask application.
   */
  getMeshes(): AbstractMesh[] {
    return this.meshes;
  }

  /**
   * Update yoke animations based on vehicle input.
   */
  update(input: VehicleYokeInput): void {
    const dt = input.deltaTime;

    // Smooth steering animation
    const targetAngle = -input.steerInput * MAX_YOKE_ROTATION;
    this.currentSteerAngle +=
      (targetAngle - this.currentSteerAngle) * Math.min(1, YOKE_ROTATION_LERP * dt);
    this.root.rotation.z = this.currentSteerAngle;

    // Smooth throttle indicator
    const targetThrottle = input.brakeInput > 0.1 ? -input.brakeInput : input.throttleInput;
    this.currentThrottle +=
      (targetThrottle - this.currentThrottle) * Math.min(1, THROTTLE_LERP * dt);
    this.updateThrottleLEDs();

    // Update health display
    this.currentHealth += (input.healthNormalized - this.currentHealth) * Math.min(1, 5 * dt);
    this.updateHealthDisplay();

    // Update boost meter
    this.currentBoost += (input.boostNormalized - this.currentBoost) * Math.min(1, 8 * dt);
    this.updateBoostMeter(input.isBoosting, dt);

    // Subtle vibration when boosting
    if (input.isBoosting) {
      const shake = Math.sin(this.boostPulseTime * 40) * 0.002;
      this.root.position.x = shake;
      this.root.position.y = Math.sin(this.boostPulseTime * 30) * 0.001;
      this.boostPulseTime += dt;
    } else {
      this.root.position.x = 0;
      this.root.position.y = 0;
      this.boostPulseTime = 0;
    }
  }

  private updateThrottleLEDs(): void {
    // Map throttle (0-1) to lit LEDs (0-5)
    // Negative throttle (braking) shows in red
    const isBraking = this.currentThrottle < -0.1;
    const value = isBraking ? Math.abs(this.currentThrottle) : this.currentThrottle;
    const litCount = Math.round(value * 5);

    for (let i = 0; i < this.throttleLEDs.length; i++) {
      const led = this.throttleLEDs[i];
      if (i < litCount) {
        if (isBraking) {
          led.material = this.ledRedMat;
        } else if (i >= 4) {
          led.material = this.ledYellowMat; // High throttle
        } else {
          led.material = this.ledGreenMat;
        }
      } else {
        led.material = this.ledOffMat;
      }
    }
  }

  private updateHealthDisplay(): void {
    // Scale the health bar based on health value
    const healthMat = this.healthDisplay.material as StandardMaterial;
    if (healthMat) {
      // Color shifts from green to yellow to red
      if (this.currentHealth > 0.6) {
        healthMat.emissiveColor = new Color3(0, 0.4, 0);
      } else if (this.currentHealth > 0.3) {
        healthMat.emissiveColor = new Color3(0.4, 0.3, 0);
      } else {
        // Flashing red at low health
        const flash = Math.sin(Date.now() * 0.01) > 0 ? 0.6 : 0.2;
        healthMat.emissiveColor = new Color3(flash, 0, 0);
      }
    }

    // Scale width based on health
    this.healthDisplay.scaling.x = Math.max(0.1, this.currentHealth);
    // Shift position to keep left edge fixed
    this.healthDisplay.position.x = -0.025 * (1 - this.currentHealth);
  }

  private updateBoostMeter(isBoosting: boolean, _dt: number): void {
    const boostMat = this.boostMeter.material as StandardMaterial;

    // Scale height based on boost fuel
    this.boostMeter.scaling.y = Math.max(0.1, this.currentBoost);
    // Shift position to keep bottom edge fixed
    this.boostMeter.position.y = -0.015 + (1 - this.currentBoost) * -0.015;

    if (boostMat) {
      if (isBoosting) {
        // Pulsing bright blue when active
        const pulse = Math.sin(this.boostPulseTime * 15) * 0.3 + 0.7;
        boostMat.emissiveColor = new Color3(0, pulse * 0.4, pulse);
      } else if (this.currentBoost < 0.2) {
        // Dim when low
        boostMat.emissiveColor = new Color3(0.1, 0.1, 0.2);
      } else {
        // Normal state
        boostMat.emissiveColor = new Color3(0, 0.2, 0.5);
      }
    }
  }

  /**
   * Show the yoke (when entering vehicle).
   */
  show(): void {
    this.root.setEnabled(true);
  }

  /**
   * Hide the yoke (when exiting vehicle).
   */
  hide(): void {
    this.root.setEnabled(false);
  }

  /**
   * Check if the yoke is visible.
   */
  isVisible(): boolean {
    return this.root.isEnabled();
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    for (const mat of this.materials) {
      mat.dispose();
    }
    this.root.dispose();

    this.ledOffMat?.dispose();
    this.ledGreenMat?.dispose();
    this.ledYellowMat?.dispose();
    this.ledRedMat?.dispose();

    log.info('VehicleYokeController disposed');
  }
}

// ---------------------------------------------------------------------------
// Vehicle Yoke System
// ---------------------------------------------------------------------------

/**
 * VehicleYokeSystem manages the lifecycle of vehicle yokes.
 * Singleton that integrates with FirstPersonWeaponSystem.
 */
export class VehicleYokeSystem {
  private static instance: VehicleYokeSystem | null = null;
  private yoke: VehicleYokeController | null = null;
  private gyroscope: GyroscopeManager;

  // Weapon swap state
  private previousWeaponId: string | null = null;
  private isVehicleActive = false;

  private constructor() {
    this.gyroscope = GyroscopeManager.getInstance();
  }

  static getInstance(): VehicleYokeSystem {
    if (!VehicleYokeSystem.instance) {
      VehicleYokeSystem.instance = new VehicleYokeSystem();
    }
    return VehicleYokeSystem.instance;
  }

  /**
   * Initialize the system with the scene.
   */
  init(scene: Scene): void {
    this.scene = scene;
    this.yoke = new VehicleYokeController(scene);
    this.yoke.hide(); // Hidden by default
    log.info('VehicleYokeSystem initialized');
  }

  /**
   * Get the yoke controller for attachment to weapon anchor.
   */
  getYoke(): VehicleYokeController | null {
    return this.yoke;
  }

  /**
   * Get the gyroscope manager.
   */
  getGyroscope(): GyroscopeManager {
    return this.gyroscope;
  }

  /**
   * Enter vehicle mode - show yoke and store current weapon.
   */
  enterVehicle(currentWeaponId: string): void {
    this.previousWeaponId = currentWeaponId;
    this.isVehicleActive = true;
    this.yoke?.show();

    // Attempt to enable gyroscope on mobile
    if (this.gyroscope.isAvailable()) {
      this.gyroscope.enable().catch(() => {
        log.warn('Failed to enable gyroscope');
      });
    }

    log.info('Entered vehicle mode');
  }

  /**
   * Exit vehicle mode - hide yoke and return previous weapon.
   * Returns the weapon ID to switch back to.
   */
  exitVehicle(): string | null {
    const weaponToRestore = this.previousWeaponId;
    this.previousWeaponId = null;
    this.isVehicleActive = false;
    this.yoke?.hide();

    // Disable gyroscope
    this.gyroscope.disable();

    log.info('Exited vehicle mode');
    return weaponToRestore;
  }

  /**
   * Check if vehicle mode is active.
   */
  isInVehicle(): boolean {
    return this.isVehicleActive;
  }

  /**
   * Update the yoke with vehicle state.
   */
  update(input: VehicleYokeInput): void {
    if (!this.isVehicleActive || !this.yoke) return;
    this.yoke.update(input);
  }

  /**
   * Get steering input from gyroscope or fallback.
   * Returns a value from -1 (left) to 1 (right).
   */
  getGyroscopeSteeringInput(): number {
    return this.gyroscope.getSteeringInput();
  }

  /**
   * Get throttle/brake input from gyroscope.
   */
  getGyroscopeThrottleInput(): { throttle: number; brake: number } {
    return this.gyroscope.getThrottleInput();
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    this.yoke?.dispose();
    this.yoke = null;
    this.gyroscope.dispose();
    this.scene = null;
    this.previousWeaponId = null;
    this.isVehicleActive = false;
    VehicleYokeSystem.instance = null;
    log.info('VehicleYokeSystem disposed');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const vehicleYokeSystem = VehicleYokeSystem.getInstance();
