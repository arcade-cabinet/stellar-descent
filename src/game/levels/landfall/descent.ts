/**
 * Landfall Descent Logic
 * Handles freefall, powered descent, asteroid avoidance, and landing
 */

import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { LZ_RADIUS, MAX_DRIFT, NEAR_MISS_COOLDOWN, NEAR_MISS_RADIUS } from './constants';
import type { Asteroid, LandingOutcome } from './types';

// ============================================================================
// ASTEROID MANAGEMENT
// ============================================================================

export interface AsteroidUpdateResult {
  asteroidsHit: number;
  asteroidsDodged: number;
  suitDamage: number;
  nearMissTriggered: boolean;
  nearMissAsteroid: Asteroid | null;
}

/**
 * Update all asteroids and check for collisions
 */
export function updateAsteroids(
  asteroids: Asteroid[],
  nearMissTimer: number,
  deltaTime: number
): {
  updatedAsteroids: Asteroid[];
  removedAsteroids: Asteroid[];
  result: AsteroidUpdateResult;
  newNearMissTimer: number;
} {
  const result: AsteroidUpdateResult = {
    asteroidsHit: 0,
    asteroidsDodged: 0,
    suitDamage: 0,
    nearMissTriggered: false,
    nearMissAsteroid: null,
  };

  let timer = nearMissTimer > 0 ? nearMissTimer - deltaTime : 0;
  const removedAsteroids: Asteroid[] = [];
  const updatedAsteroids: Asteroid[] = [];

  for (const ast of asteroids) {
    // Update position and rotation
    ast.mesh.position.addInPlace(ast.velocity.scale(deltaTime));
    ast.mesh.rotation.addInPlace(ast.rotationSpeed.scale(deltaTime));
    if (ast.trail && ast.trail.emitter instanceof Vector3) {
      ast.trail.emitter.copyFrom(ast.mesh.position);
    }

    const hitRadius = 2.0 + ast.size * 0.5;
    const dist = Math.sqrt(ast.mesh.position.x ** 2 + ast.mesh.position.z ** 2);
    const inZone = ast.mesh.position.y > -6 && ast.mesh.position.y < 6;

    // Check for hit
    if (inZone && dist < hitRadius && !ast.passed) {
      result.asteroidsHit++;
      result.suitDamage += 8 + ast.size * 3;
      ast.passed = true;
      if (ast.trail) ast.trail.stop();
      ast.mesh.scaling.setAll(0.1);
    }

    // Check for near miss
    if (inZone && dist >= hitRadius && dist < hitRadius + 3 && !ast.passed && timer <= 0) {
      result.nearMissTriggered = true;
      result.nearMissAsteroid = ast;
      timer = NEAR_MISS_COOLDOWN;
    }

    // Check if dodged
    if (ast.mesh.position.y > 15 && !ast.passed) {
      ast.passed = true;
      result.asteroidsDodged++;
    }

    // Remove if out of range
    if (ast.mesh.position.y > 60) {
      removedAsteroids.push(ast);
    } else {
      updatedAsteroids.push(ast);
    }
  }

  return {
    updatedAsteroids,
    removedAsteroids,
    result,
    newNearMissTimer: timer,
  };
}

/**
 * Clean up removed asteroids
 */
export function disposeAsteroids(asteroids: Asteroid[]): void {
  for (const ast of asteroids) {
    if (ast.trail) {
      ast.trail.stop();
      ast.trail.dispose();
    }
    ast.mesh.dispose();
  }
}

// ============================================================================
// LANDING ZONE TRACKING
// ============================================================================

/**
 * Update LZ beacon color based on player position
 */
export function updateLZBeaconColor(
  lzBeacon: Mesh | null,
  positionX: number,
  positionZ: number
): void {
  if (!lzBeacon?.material) return;

  const distToLZ = Math.sqrt(positionX ** 2 + positionZ ** 2);
  const mat = lzBeacon.material as StandardMaterial;

  if (distToLZ < LZ_RADIUS) {
    mat.emissiveColor = new Color3(0.2, 1, 0.3);
  } else if (distToLZ < NEAR_MISS_RADIUS) {
    mat.emissiveColor = new Color3(1, 1, 0.2);
  } else {
    mat.emissiveColor = new Color3(1, 0.3, 0.2);
  }
}

/**
 * Check if trajectory is lost
 */
export function checkTrajectoryLost(positionX: number, positionZ: number): boolean {
  const distToLZ = Math.sqrt(positionX ** 2 + positionZ ** 2);
  return distToLZ > MAX_DRIFT;
}

// ============================================================================
// LANDING OUTCOME
// ============================================================================

/**
 * Determine landing outcome based on position and velocity.
 * Uses multiple factors for nuanced landing quality assessment.
 */
export function determineLandingOutcome(
  positionX: number,
  positionZ: number,
  velocity: number
): LandingOutcome {
  const distToLZ = Math.sqrt(positionX ** 2 + positionZ ** 2);

  // Catastrophic outcomes first
  if (velocity > 70) {
    return 'crash'; // Too fast - unsurvivable
  }
  if (distToLZ > MAX_DRIFT) {
    return 'slingshot'; // Missed the drop zone entirely
  }

  // Calculate a landing score based on multiple factors
  const velocityScore = Math.max(0, 1 - velocity / 40); // 0-1, higher is better
  const distanceScore = Math.max(0, 1 - distToLZ / NEAR_MISS_RADIUS); // 0-1, higher is better
  const combinedScore = velocityScore * 0.6 + distanceScore * 0.4;

  // Perfect landing: on pad, low velocity
  if (distToLZ <= LZ_RADIUS && velocity < 20) {
    return 'perfect';
  }

  // Near miss: close to pad, acceptable velocity
  if (distToLZ <= NEAR_MISS_RADIUS && velocity < 35) {
    return 'near_miss';
  }

  // Rough landing: higher velocity or further from pad
  if (velocity > 50 || distToLZ > NEAR_MISS_RADIUS * 1.5) {
    return 'rough';
  }

  // Default based on combined score
  if (combinedScore > 0.5) {
    return 'near_miss';
  }

  return 'rough';
}

/**
 * Calculate damage taken from landing based on outcome and velocity.
 */
export function calculateLandingDamage(outcome: LandingOutcome, velocity: number): number {
  switch (outcome) {
    case 'perfect':
      return 0;
    case 'near_miss':
      return Math.max(0, (velocity - 20) * 0.5);
    case 'rough':
      return 15 + Math.max(0, (velocity - 30) * 0.8);
    case 'crash':
      return 40 + Math.max(0, (velocity - 50) * 1.2);
    case 'slingshot':
      return 100; // Fatal
    default:
      return 0;
  }
}

// ============================================================================
// MOVEMENT PROCESSING
// ============================================================================

export interface MovementInput {
  moveLeft: boolean;
  moveRight: boolean;
  moveForward: boolean;
  moveBackward: boolean;
  fire: boolean;
  reload: boolean;
}

export interface FreefallMovementResult {
  lateralVelocityX: number;
  lateralVelocityZ: number;
}

/**
 * Process freefall movement input
 */
export function processFreefallMovement(
  input: MovementInput,
  currentVelocityX: number,
  currentVelocityZ: number,
  deltaTime: number
): FreefallMovementResult {
  let lateralVelocityX = currentVelocityX;
  let lateralVelocityZ = currentVelocityZ;

  if (input.moveLeft) lateralVelocityX -= 40 * deltaTime;
  if (input.moveRight) lateralVelocityX += 40 * deltaTime;
  if (input.moveForward) lateralVelocityZ += 40 * deltaTime;
  if (input.moveBackward) lateralVelocityZ -= 40 * deltaTime;

  lateralVelocityX *= 0.95;
  lateralVelocityZ *= 0.95;

  return { lateralVelocityX, lateralVelocityZ };
}

export interface PoweredDescentResult {
  lateralVelocityX: number;
  lateralVelocityZ: number;
  velocity: number;
  fuel: number;
  thrusterGlowIntensity: number;
}

/**
 * Process powered descent movement and thrusters
 */
export function processPoweredDescentMovement(
  input: MovementInput,
  currentVelocityX: number,
  currentVelocityZ: number,
  velocity: number,
  fuel: number,
  fuelBurnRate: number,
  deltaTime: number
): PoweredDescentResult {
  let lateralVelocityX = currentVelocityX;
  let lateralVelocityZ = currentVelocityZ;
  let newVelocity = velocity;
  let newFuel = fuel;
  let thrusterGlowIntensity = 0.2;

  // Lateral movement
  if (input.moveLeft) lateralVelocityX -= 20 * deltaTime;
  if (input.moveRight) lateralVelocityX += 20 * deltaTime;
  if (input.moveForward) lateralVelocityZ += 20 * deltaTime;
  if (input.moveBackward) lateralVelocityZ -= 20 * deltaTime;

  // Main thrust (fire button)
  if (input.fire && fuel > 0) {
    newVelocity = Math.max(5, velocity - 60 * deltaTime);
    newFuel = Math.max(0, fuel - fuelBurnRate * deltaTime);
    thrusterGlowIntensity = 0.8;
  }

  // Stabilization (reload button)
  if (input.reload && fuel > 0) {
    lateralVelocityX *= 0.9;
    lateralVelocityZ *= 0.9;
    newFuel = Math.max(0, newFuel - 2 * deltaTime);
  }

  lateralVelocityX *= 0.98;
  lateralVelocityZ *= 0.98;

  return {
    lateralVelocityX,
    lateralVelocityZ,
    velocity: newVelocity,
    fuel: newFuel,
    thrusterGlowIntensity,
  };
}
