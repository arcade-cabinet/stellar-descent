/**
 * LandfallLevel Types
 * TypeScript interfaces and type definitions for the Landfall level.
 */

import type { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

// ---------------------------------------------------------------------------
// Drop Phase Types
// ---------------------------------------------------------------------------

/**
 * The current phase of the HALO drop sequence.
 */
export type DropPhase =
  | 'freefall_start'    // Initial orientation
  | 'freefall_belt'     // Asteroid dodging
  | 'freefall_clear'    // Past asteroids, waiting for jets
  | 'powered_descent'   // Jets active, targeting LZ
  | 'landing'           // Final approach
  | 'surface';          // On ground

/**
 * The outcome of the landing based on velocity and position.
 */
export type LandingOutcome =
  | 'perfect'     // On pad with low velocity
  | 'near_miss'   // Close to pad
  | 'rough'       // High velocity landing
  | 'crash'       // Very high velocity
  | 'slingshot';  // Too far off course

// ---------------------------------------------------------------------------
// Asteroid Types
// ---------------------------------------------------------------------------

/**
 * Visual type of asteroid for rendering variety.
 */
export type AsteroidType = 'rock' | 'ice' | 'metal';

/**
 * An asteroid in the debris field during freefall.
 */
export interface Asteroid {
  mesh: Mesh | TransformNode;
  velocity: Vector3;
  rotationSpeed: Vector3;
  passed: boolean;
  size: number;
  trail?: ParticleSystem;
  type: AsteroidType;
}

// ---------------------------------------------------------------------------
// Distant Threat Types
// ---------------------------------------------------------------------------

/**
 * Type of distant alien vehicle visible during descent.
 */
export type DistantThreatType = 'wraith' | 'phantom';

/**
 * A distant alien vehicle threat visible during the HALO drop.
 */
export interface DistantThreat {
  node: TransformNode;
  position: Vector3;
  velocity: Vector3;
  rotationSpeed: number;
  type: DistantThreatType;
  spawnAltitude: number;
}

// ---------------------------------------------------------------------------
// Surface Combat Types
// ---------------------------------------------------------------------------

/**
 * Enemy AI state for surface combat.
 */
export type EnemyState = 'idle' | 'chase' | 'attack';

/**
 * Species of surface enemy.
 */
export type SurfaceEnemySpecies = 'skitterer' | 'lurker';

/**
 * A surface combat enemy.
 */
export interface SurfaceEnemy {
  mesh: Mesh | TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  state: EnemyState;
  attackCooldown: number;
  species: SurfaceEnemySpecies;
}

// ---------------------------------------------------------------------------
// Distant Threat Definition Types
// ---------------------------------------------------------------------------

/**
 * Definition for spawning a distant threat.
 */
export interface DistantThreatDefinition {
  type: DistantThreatType;
  position: Vector3;
  velocity: Vector3;
  rotationSpeed: number;
  scale: number;
}

// ---------------------------------------------------------------------------
// Landing Types
// ---------------------------------------------------------------------------

/**
 * Detailed landing statistics for scoring/achievements.
 */
export interface LandingStats {
  /** Final velocity at touchdown (m/s) */
  velocity: number;
  /** Distance from LZ center (m) */
  distanceFromLZ: number;
  /** Fuel remaining (%) */
  fuelRemaining: number;
  /** Asteroids dodged during descent */
  asteroidsDodged: number;
  /** Asteroids hit during descent */
  asteroidsHit: number;
  /** Suit integrity at landing (%) */
  suitIntegrity: number;
  /** Landing outcome category */
  outcome: LandingOutcome;
}

// ---------------------------------------------------------------------------
// Combat Types
// ---------------------------------------------------------------------------

/**
 * Combat encounter configuration.
 */
export interface CombatEncounterConfig {
  /** Number of enemies to spawn */
  enemyCount: number;
  /** Spawn delay between enemies (ms) */
  spawnDelay: number;
  /** Enemy species to spawn */
  species: SurfaceEnemySpecies;
  /** Whether to show tutorial hints */
  showTutorial: boolean;
  /** Difficulty multiplier (1.0 = normal) */
  difficultyMultiplier: number;
}

/**
 * Cover position for tactical gameplay.
 */
export interface CoverPosition {
  /** World position */
  position: Vector3;
  /** Cover type (rock, debris, container) */
  type: 'rock' | 'debris' | 'container' | 'barrier';
  /** Cover height (crouching vs standing) */
  height: 'low' | 'high';
  /** Whether currently occupied by enemy */
  occupied: boolean;
}

// ---------------------------------------------------------------------------
// Environment Hazard Types
// ---------------------------------------------------------------------------

/**
 * Acid pool hazard configuration.
 */
export interface AcidPoolConfig {
  x: number;
  z: number;
  radius: number;
  damage: number;
  damageInterval: number;
}

/**
 * Unstable terrain configuration.
 */
export interface UnstableTerrainConfig {
  x: number;
  z: number;
  size: number;
  shakeIntensity: number;
  shakeInterval: number;
}
