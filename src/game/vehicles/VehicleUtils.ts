/**
 * VehicleUtils - Shared vehicle utility functions
 *
 * Provides common functionality for vehicle gameplay across levels:
 * - Vehicle spawning from GLB models
 * - Transition handling (vehicle <-> foot combat)
 * - Vehicle health and destruction effects
 * - Input mapping helpers
 *
 * Used by CanyonRunLevel, FinalEscapeLevel, and LandfallLevel
 * to standardize vehicle behavior across the campaign.
 */

import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { AssetManager } from '../core/AssetManager';
import { getAudioManager } from '../core/AudioManager';
import { getLogger } from '../core/Logger';
import { particleManager } from '../effects/ParticleManager';

const log = getLogger('VehicleUtils');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Vehicle type determines the GLB model and handling characteristics.
 */
export type VehicleType = 'buggy' | 'tank' | 'transport' | 'escape_shuttle';

/**
 * Configuration for spawning a vehicle.
 */
export interface VehicleSpawnConfig {
  /** Vehicle type determines model and handling */
  type: VehicleType;
  /** World position to spawn the vehicle */
  position: Vector3;
  /** Initial rotation in radians (Y-axis) */
  rotation?: number;
  /** Optional scale multiplier */
  scale?: number;
  /** Initial health (defaults to 100) */
  health?: number;
  /** Maximum health (defaults to 100) */
  maxHealth?: number;
}

/**
 * Result of spawning a vehicle.
 */
export interface SpawnedVehicle {
  /** Root transform node containing all vehicle meshes */
  rootNode: TransformNode;
  /** The main body mesh/node for collision detection */
  bodyNode: TransformNode | null;
  /** Headlight point lights */
  headlights: PointLight[];
  /** Exhaust/engine glow light */
  exhaustLight: PointLight | null;
  /** Current health */
  health: number;
  /** Maximum health */
  maxHealth: number;
  /** Vehicle type */
  type: VehicleType;
  /** Is the vehicle destroyed? */
  isDestroyed: boolean;
}

/**
 * Vehicle damage result.
 */
export interface VehicleDamageResult {
  /** New health value */
  health: number;
  /** Whether the vehicle was just destroyed */
  wasDestroyed: boolean;
  /** Whether the vehicle is now in critical state (<25%) */
  isCritical: boolean;
  /** Whether the vehicle is damaged (<50%) */
  isDamaged: boolean;
}

/**
 * Transition state for vehicle <-> foot combat.
 */
export type TransitionState = 'idle' | 'entering' | 'in_vehicle' | 'exiting';

/**
 * Transition configuration.
 */
export interface TransitionConfig {
  /** Duration of enter/exit animation in seconds */
  duration: number;
  /** Camera offset when in vehicle */
  cameraOffset: Vector3;
  /** Player height when on foot */
  playerHeight: number;
}

// ============================================================================
// GLB PATHS
// ============================================================================

const VEHICLE_GLB_PATHS: Record<VehicleType, string> = {
  buggy: '/models/spaceships/Bob.glb',
  tank: '/models/vehicles/chitin/wraith.glb',
  transport: '/models/vehicles/phantom_dropship.glb',
  escape_shuttle: '/models/spaceships/Challenger.glb',
};

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_TRANSITION_CONFIG: TransitionConfig = {
  duration: 0.5,
  cameraOffset: new Vector3(0, 2.5, 0),
  playerHeight: 1.7,
};

const VEHICLE_STATS: Record<VehicleType, { health: number; speed: number }> = {
  buggy: { health: 80, speed: 45 },
  tank: { health: 200, speed: 25 },
  transport: { health: 150, speed: 35 },
  escape_shuttle: { health: 120, speed: 40 },
};

// ============================================================================
// VEHICLE SPAWN FUNCTIONS
// ============================================================================

/**
 * Preload vehicle GLB assets for the specified types.
 * Call this before spawning vehicles to ensure smooth loading.
 */
export async function preloadVehicleAssets(
  scene: Scene,
  types: VehicleType[]
): Promise<void> {
  const paths = types.map((t) => VEHICLE_GLB_PATHS[t]).filter(Boolean);
  const unique = [...new Set(paths)];

  await Promise.all(
    unique.map((path) => AssetManager.loadAssetByPath(path, scene))
  );

  log.info(`Preloaded ${unique.length} vehicle GLBs`);
}

/**
 * Spawn a vehicle at the specified position.
 * Assumes GLB assets have been preloaded via preloadVehicleAssets.
 */
export function spawnVehicle(scene: Scene, config: VehicleSpawnConfig): SpawnedVehicle {
  const {
    type,
    position,
    rotation = 0,
    scale = 1,
    health = VEHICLE_STATS[type].health,
    maxHealth = VEHICLE_STATS[type].health,
  } = config;

  const glbPath = VEHICLE_GLB_PATHS[type];

  // Create root transform
  const rootNode = new TransformNode(`vehicle_${type}_${Date.now()}`, scene);
  rootNode.position = position.clone();
  rootNode.rotation.y = rotation;

  // Load GLB body
  const bodyNode = AssetManager.createInstanceByPath(
    glbPath,
    `vehicle_body_${type}`,
    scene,
    true,
    'vehicle'
  );

  if (bodyNode) {
    bodyNode.parent = rootNode;
    bodyNode.position.set(0, 0, 0);
    bodyNode.scaling.setAll(scale);
    // Face forward (-Z)
    bodyNode.rotation.y = Math.PI;
  } else {
    log.warn(`Failed to load vehicle GLB: ${glbPath}`);
  }

  // Create headlights
  const headlights: PointLight[] = [];
  for (let side = -1; side <= 1; side += 2) {
    const headlight = new PointLight(
      `headlight_${side}_${Date.now()}`,
      new Vector3(side * 1, 1.2, -2.5),
      scene
    );
    headlight.parent = rootNode;
    headlight.diffuse = new Color3(1, 0.95, 0.8);
    headlight.intensity = 5;
    headlight.range = 40;
    headlights.push(headlight);
  }

  // Create exhaust light
  const exhaustLight = new PointLight(
    `vehicle_exhaust_${Date.now()}`,
    new Vector3(0, 0.5, 2),
    scene
  );
  exhaustLight.parent = rootNode;
  exhaustLight.diffuse = new Color3(1, 0.5, 0.2);
  exhaustLight.intensity = 3;
  exhaustLight.range = 15;

  return {
    rootNode,
    bodyNode,
    headlights,
    exhaustLight,
    health,
    maxHealth,
    type,
    isDestroyed: false,
  };
}

/**
 * Dispose a spawned vehicle and all its resources.
 */
export function disposeVehicle(vehicle: SpawnedVehicle): void {
  for (const light of vehicle.headlights) {
    light.dispose();
  }
  vehicle.headlights.length = 0;

  vehicle.exhaustLight?.dispose();
  vehicle.rootNode.dispose(false, true);
}

// ============================================================================
// VEHICLE HEALTH & DAMAGE
// ============================================================================

/**
 * Apply damage to a vehicle.
 * Returns the damage result with updated health and state flags.
 */
export function applyVehicleDamage(
  vehicle: SpawnedVehicle,
  amount: number
): VehicleDamageResult {
  const previousHealth = vehicle.health;
  vehicle.health = Math.max(0, vehicle.health - amount);

  const wasDestroyed = previousHealth > 0 && vehicle.health <= 0;
  if (wasDestroyed) {
    vehicle.isDestroyed = true;
  }

  const healthPercent = vehicle.health / vehicle.maxHealth;

  return {
    health: vehicle.health,
    wasDestroyed,
    isCritical: healthPercent < 0.25 && healthPercent > 0,
    isDamaged: healthPercent < 0.5 && healthPercent >= 0.25,
  };
}

/**
 * Heal a vehicle by the specified amount.
 */
export function healVehicle(vehicle: SpawnedVehicle, amount: number): number {
  vehicle.health = Math.min(vehicle.maxHealth, vehicle.health + amount);
  return vehicle.health;
}

/**
 * Create a vehicle destruction effect (explosion, debris).
 */
export function createVehicleDestructionEffect(
  scene: Scene,
  position: Vector3
): void {
  // Explosion flash
  const explosion = MeshBuilder.CreateSphere(
    'vehicle_explosion',
    { diameter: 8, segments: 8 },
    scene
  );
  explosion.position = position.clone();

  const explosionMat = new StandardMaterial('vehicle_explosion_mat', scene);
  explosionMat.emissiveColor = new Color3(1.0, 0.6, 0.2);
  explosionMat.alpha = 0.9;
  explosionMat.disableLighting = true;
  explosion.material = explosionMat;

  // Animate explosion
  let scale = 1;
  let alpha = 0.9;
  const animate = () => {
    if (!explosion.isDisposed()) {
      scale += 0.5;
      alpha -= 0.06;
      explosion.scaling.setAll(scale);
      explosionMat.alpha = Math.max(0, alpha);
      explosionMat.emissiveColor = new Color3(
        1.0 - scale * 0.08,
        0.6 - scale * 0.05,
        0.2 - scale * 0.02
      );

      if (alpha > 0) {
        requestAnimationFrame(animate);
      } else {
        explosionMat.dispose();
        explosion.dispose();
      }
    }
  };
  requestAnimationFrame(animate);

  // Spawn debris chunks
  for (let i = 0; i < 6; i++) {
    const debris = MeshBuilder.CreatePolyhedron(
      `debris_${i}`,
      { type: Math.floor(Math.random() * 3), size: 0.4 + Math.random() * 0.4 },
      scene
    );
    debris.position = position.clone();
    debris.position.x += (Math.random() - 0.5) * 2;
    debris.position.y += Math.random() * 2;
    debris.position.z += (Math.random() - 0.5) * 2;

    const debrisMat = new StandardMaterial(`debris_mat_${i}`, scene);
    debrisMat.diffuseColor = Color3.FromHexString('#3A3A3A');
    debrisMat.emissiveColor = new Color3(0.2, 0.1, 0);
    debris.material = debrisMat;

    const velocity = new Vector3(
      (Math.random() - 0.5) * 15,
      8 + Math.random() * 10,
      (Math.random() - 0.5) * 15
    );
    const rotSpeed = new Vector3(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
    let lifetime = 0;

    const animateDebris = () => {
      if (!debris.isDisposed()) {
        lifetime += 0.016;
        velocity.y -= 15 * 0.016; // Gravity

        debris.position.addInPlace(velocity.scale(0.016));
        debris.rotation.x += rotSpeed.x * 0.016;
        debris.rotation.y += rotSpeed.y * 0.016;
        debris.rotation.z += rotSpeed.z * 0.016;

        if (debris.position.y < 0.5) {
          velocity.y = Math.abs(velocity.y) * 0.4;
          velocity.scaleInPlace(0.6);
        }

        if (lifetime < 3) {
          requestAnimationFrame(animateDebris);
        } else {
          debrisMat.dispose();
          debris.dispose();
        }
      }
    };
    requestAnimationFrame(animateDebris);
  }

  // Play explosion sound
  try {
    getAudioManager().play('explosion', { volume: 0.8 });
  } catch {
    // Audio not available
  }

  // Spawn particle effect
  particleManager.emitExplosion(position);
}

/**
 * Update vehicle visual damage state (smoke, sparks, etc.).
 */
export function updateVehicleDamageVisuals(
  vehicle: SpawnedVehicle,
  deltaTime: number,
  time: number
): void {
  if (vehicle.isDestroyed) return;

  const healthPercent = vehicle.health / vehicle.maxHealth;

  // Flicker headlights when damaged
  if (healthPercent < 0.5) {
    const flicker = healthPercent < 0.25
      ? Math.random() > 0.3 ? 5 : 0
      : 5 - Math.sin(time * 10) * 2;

    for (const light of vehicle.headlights) {
      light.intensity = flicker;
    }
  }

  // Dim exhaust when critical
  if (vehicle.exhaustLight) {
    if (healthPercent < 0.25) {
      vehicle.exhaustLight.intensity = 1 + Math.random() * 2;
      vehicle.exhaustLight.diffuse = new Color3(0.6, 0.2, 0.1);
    } else {
      vehicle.exhaustLight.intensity = 3;
      vehicle.exhaustLight.diffuse = new Color3(1, 0.5, 0.2);
    }
  }
}

// ============================================================================
// TRANSITION HANDLING
// ============================================================================

/**
 * Create a transition handler for vehicle entry/exit.
 */
export function createTransitionHandler(
  scene: Scene,
  camera: UniversalCamera,
  config: Partial<TransitionConfig> = {}
): {
  state: TransitionState;
  progress: number;
  startEnter: (vehicle: SpawnedVehicle) => void;
  startExit: (vehicle: SpawnedVehicle, exitPosition: Vector3) => void;
  update: (deltaTime: number) => boolean;
  getVehicleHeight: () => number;
} {
  const fullConfig = { ...DEFAULT_TRANSITION_CONFIG, ...config };

  let state: TransitionState = 'idle';
  let progress = 0;
  let activeVehicle: SpawnedVehicle | null = null;
  let startPos = Vector3.Zero();
  let endPos = Vector3.Zero();
  let startHeight = 0;
  let endHeight = 0;

  return {
    get state() {
      return state;
    },
    get progress() {
      return progress;
    },

    startEnter(vehicle: SpawnedVehicle) {
      if (state !== 'idle') return;
      state = 'entering';
      progress = 0;
      activeVehicle = vehicle;

      startPos = camera.position.clone();
      endPos = vehicle.rootNode.position.add(fullConfig.cameraOffset);
      startHeight = fullConfig.playerHeight;
      endHeight = fullConfig.cameraOffset.y;

      try {
        getAudioManager().play('door_open', { volume: 0.5 });
      } catch {
        // Audio not available
      }
    },

    startExit(vehicle: SpawnedVehicle, exitPosition: Vector3) {
      if (state !== 'in_vehicle') return;
      state = 'exiting';
      progress = 0;
      activeVehicle = vehicle;

      startPos = camera.position.clone();
      endPos = exitPosition.clone();
      endPos.y = fullConfig.playerHeight;
      startHeight = fullConfig.cameraOffset.y;
      endHeight = fullConfig.playerHeight;

      try {
        getAudioManager().play('door_open', { volume: 0.4 });
      } catch {
        // Audio not available
      }
    },

    update(deltaTime: number): boolean {
      if (state === 'idle' || state === 'in_vehicle') {
        return false;
      }

      progress += deltaTime / fullConfig.duration;
      const t = Math.min(1, progress);

      // Smooth interpolation
      const smoothT = t * t * (3 - 2 * t); // Smoothstep

      camera.position = Vector3.Lerp(startPos, endPos, smoothT);
      camera.position.y = startHeight + (endHeight - startHeight) * smoothT;

      if (t >= 1) {
        if (state === 'entering') {
          state = 'in_vehicle';
          log.info('Player entered vehicle');
        } else if (state === 'exiting') {
          state = 'idle';
          activeVehicle = null;
          log.info('Player exited vehicle');
        }
        return true; // Transition complete
      }

      return false; // Transition in progress
    },

    getVehicleHeight() {
      return fullConfig.cameraOffset.y;
    },
  };
}

// ============================================================================
// INPUT HELPERS
// ============================================================================

/**
 * Build vehicle input from keyboard/touch state.
 * Matches the VehicleController.buildInput signature for consistency.
 */
export function buildVehicleInput(
  keys: Set<string>,
  touchInput: { movement: { x: number; y: number }; isSprinting?: boolean } | null
): {
  steer: number;
  throttle: number;
  brake: number;
  boost: boolean;
} {
  let steer = 0;
  let throttle = 0;
  let brake = 0;
  let boost = false;

  // Keyboard
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) throttle = 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) brake = 1;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Space')) {
    boost = true;
  }

  // Touch overrides
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

/**
 * Check if the player is near a vehicle (for enter prompt).
 */
export function isNearVehicle(
  playerPosition: Vector3,
  vehicle: SpawnedVehicle,
  maxDistance = 8
): boolean {
  if (vehicle.isDestroyed) return false;
  const dist = Vector3.Distance(playerPosition, vehicle.rootNode.position);
  return dist < maxDistance;
}

/**
 * Get the exit position when leaving a vehicle.
 */
export function getVehicleExitPosition(vehicle: SpawnedVehicle): Vector3 {
  const exitOffset = new Vector3(4, 0, 0); // Exit to the right
  return vehicle.rootNode.position.add(
    exitOffset.rotateByQuaternionToRef(
      vehicle.rootNode.rotationQuaternion ??
      vehicle.rootNode.rotation.toQuaternion(),
      new Vector3()
    )
  );
}
