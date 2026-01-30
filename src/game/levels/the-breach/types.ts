/**
 * TheBreachLevel - Type Definitions
 *
 * Contains all type definitions and interfaces for the underground hive level.
 */

import type { PointLight } from '@babylonjs/core/Lights/pointLight';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Entity } from '../../core/ecs';

// ============================================================================
// ZONE & PHASE TYPES
// ============================================================================

/**
 * Hive zones representing depth progression:
 * - upper: 0-50m depth, linear tunnels, drones only
 * - mid: 50-100m depth, branching tunnels, grunts/spitters
 * - lower: 100-150m depth, large chambers, all enemy types
 * - queen_chamber: 200m depth, boss arena
 */
export type HiveZone = 'upper' | 'mid' | 'lower' | 'queen_chamber';

/**
 * Level progression phases
 */
export type LevelPhase =
  | 'exploration' // Navigate tunnels, fight enemies
  | 'boss_intro' // Queen awakens, door seals
  | 'boss_fight' // Active combat with queen
  | 'boss_death' // Queen defeated, death sequence
  | 'escape_trigger'; // Hive collapsing, escape sequence

/**
 * Queen boss fight phases (health-based transitions)
 */
export type QueenPhase = 1 | 2 | 3;

// ============================================================================
// ENVIRONMENT STRUCTURES
// ============================================================================

/**
 * Organic tunnel segment in the hive
 */
export interface TunnelSegment {
  mesh: Mesh;
  position: Vector3;
  rotation: number;
  zone: HiveZone;
}

/**
 * Bioluminescent light source (fungal growth)
 */
export interface BioluminescentLight {
  mesh: Mesh;
  light: PointLight;
  baseIntensity: number;
  flickerSpeed: number;
  flickerPhase: number;
}

/**
 * Hive structure instance (GLB asset placement)
 */
export interface HiveStructure {
  node: TransformNode;
  position: Vector3;
  type: 'birther' | 'brain' | 'claw' | 'crystals' | 'stomach' | 'terraformer' | 'undercrystal';
  zone: HiveZone;
  scale: number;
}

/**
 * Captured/crashed military vehicle being absorbed by the hive
 */
export interface CapturedVehicle {
  node: TransformNode;
  position: Vector3;
  type: 'wraith' | 'phantom';
  zone: HiveZone;
  scale: number;
  organicGrowth: Mesh[]; // Organic matter growing over the vehicle
}

// ============================================================================
// HAZARDS
// ============================================================================

/**
 * Alien egg cluster that spawns drones when triggered
 */
export interface EggCluster {
  mesh: Mesh;
  position: Vector3;
  triggered: boolean;
  droneCount: number;
}

/**
 * Corrosive acid pool hazard
 */
export interface AcidPool {
  mesh: Mesh;
  position: Vector3;
  radius: number;
  damage: number;
}

/**
 * Pheromone cloud that obscures vision
 */
export interface PheromoneCloud {
  mesh: Mesh;
  position: Vector3;
  radius: number;
  lifetime: number;
  maxLifetime: number;
}

// ============================================================================
// ENEMIES
// ============================================================================

/**
 * Enemy type classification
 */
export type EnemyType = 'drone' | 'grunt' | 'spitter' | 'brute';

/**
 * Enemy AI state machine states
 */
export type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

/**
 * Enemy instance data
 */
export interface Enemy {
  entity: Entity;
  mesh: Mesh | TransformNode;
  type: EnemyType;
  health: number;
  maxHealth: number;
  position: Vector3;
  velocity: Vector3;
  attackCooldown: number;
  state: EnemyState;
  zone: HiveZone;
}

/**
 * Enemy stat configuration
 */
export interface EnemyStats {
  health: number;
  damage: number;
  speed: number;
  attackRange: number;
  fireRate: number;
}

// ============================================================================
// QUEEN BOSS
// ============================================================================

/**
 * Queen attack types
 */
export type QueenAttackType = 'acid_spit' | 'claw_swipe' | 'tail_slam' | 'ground_pound' | 'none';

/**
 * Queen body part meshes for animation
 */
export interface QueenBodyParts {
  head: Mesh;
  thorax: Mesh;
  abdomen: Mesh;
  claws: Mesh[];
  tail: Mesh;
}

/**
 * Queen boss instance data
 */
export interface Queen {
  mesh: Mesh;
  health: number;
  maxHealth: number;
  phase: QueenPhase;
  attackCooldown: number;
  spawnCooldown: number;
  weakPointMesh: Mesh | null;
  weakPointVisible: boolean;
  weakPointTimer: number;
  isVulnerable: boolean;
  attackType: QueenAttackType;
  attackTimer: number;
  screaming: boolean;
  bodyParts: QueenBodyParts;
}
