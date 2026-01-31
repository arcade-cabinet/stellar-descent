/**
 * TheBreachLevel - Type Definitions
 *
 * Contains all type definitions and interfaces for the underground hive level.
 */

import type { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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
  node: TransformNode;
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
  mesh: Mesh | TransformNode;
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
 * Queen attack types - expanded for 3-phase boss fight
 *
 * Phase 1 (100-66% health):
 * - acid_spray: Cone of acid projectiles (5 projectiles, 30 degree spread)
 * - tail_swipe: Melee damage in frontal arc when player close
 * - screech: Stuns player briefly, summons 2 skitterers
 *
 * Phase 2 (66-33% health):
 * - All Phase 1 attacks with faster cooldown
 * - egg_burst: Spawns 4 spitters from egg sacs on arena walls
 * - charge: Rushes toward player, deals heavy damage on contact
 * - poison_cloud: Area denial, damages player over time
 *
 * Phase 3 (33-0% health):
 * - All attacks with 1.5s cooldown
 * - frenzy: Rapid consecutive attacks (3 in a row)
 * - death_throes: At 10% health, continuous spawns + faster attacks
 */
export type QueenAttackType =
  | 'acid_spray'
  | 'tail_swipe'
  | 'screech'
  | 'egg_burst'
  | 'charge'
  | 'poison_cloud'
  | 'frenzy'
  | 'none';

/**
 * Legacy attack type aliases for backwards compatibility
 */
export type LegacyQueenAttackType = 'acid_spit' | 'claw_swipe' | 'tail_slam' | 'ground_pound';

/**
 * Queen weak point identifiers
 */
export type QueenWeakPointId = 'head' | 'thorax' | 'egg_sac';

/**
 * Weak point state
 */
export interface QueenWeakPoint {
  id: QueenWeakPointId;
  mesh: Mesh;
  isDestroyed: boolean;
  health: number;
  maxHealth: number;
  damageMultiplier: number;
  glowIntensity: number;
}

/**
 * Queen body part meshes/nodes for animation.
 * GLB-loaded parts use TransformNode; VFX parts remain Mesh.
 */
export interface QueenBodyParts {
  head: TransformNode;
  thorax: TransformNode;
  abdomen: TransformNode;
  claws: TransformNode[];
  tail: TransformNode | Mesh;
}

/**
 * Queen AI state for attack pattern management
 */
export interface QueenAIState {
  /** Current attack being executed */
  currentAttack: QueenAttackType;
  /** Time remaining in current attack animation */
  attackAnimationTimer: number;
  /** Number of consecutive attacks in frenzy mode */
  frenzyAttacksRemaining: number;
  /** Whether queen is in frenzy mode */
  isFrenzied: boolean;
  /** Whether queen is charging */
  isCharging: boolean;
  /** Charge target position */
  chargeTarget: Vector3 | null;
  /** Charge velocity */
  chargeVelocity: Vector3 | null;
  /** Whether queen is staggered from weak point destruction */
  isStaggered: boolean;
  /** Time remaining in stagger */
  staggerTimer: number;
  /** Whether death throes mode is active (10% health) */
  deathThroesActive: boolean;
  /** Time since last attack in death throes */
  deathThroesTimer: number;
  /** Total damage dealt to player (for stats) */
  totalDamageDealt: number;
}

/**
 * Queen boss instance data
 */
export interface Queen {
  mesh: TransformNode;
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
  /** Multiple weak points: head, thorax, egg sac */
  weakPoints: QueenWeakPoint[];
  /** AI state for attack patterns */
  aiState: QueenAIState;
  /** Original position for charge return */
  homePosition: Vector3;
}
