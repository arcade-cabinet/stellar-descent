/**
 * TheBreachLevel - Constants
 *
 * Contains all constant values for the underground hive level.
 */

import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { EnemyStats, EnemyType } from './types';

// ============================================================================
// COLORS
// ============================================================================

/**
 * Color palette for the hive environment
 */
export const COLORS = {
  /** Scene background - deep purple-black */
  background: new Color4(0.04, 0.03, 0.06, 1), // #0A0810
  /** Dark chitin surface */
  chitinDark: '#3A2A3A',
  /** Purple chitin highlights */
  chitinPurple: '#5A3A5A',
  /** Bioluminescent glow */
  bioGlow: '#4AC8C8',
  /** Dimmer bioluminescent glow */
  bioGlowDim: '#2A8888',
  /** Acid pool green */
  acidGreen: '#80FF40',
  /** Egg cluster yellow */
  eggYellow: '#A0A050',
  /** Queen purple tint */
  queenPurple: '#8040C0',
  /** Weak point indicator red */
  weakPoint: '#FF4040',
} as const;

// ============================================================================
// TUNNEL DIMENSIONS
// ============================================================================

/** Diameter of standard tunnel segments in meters */
export const TUNNEL_DIAMETER = 4;

/** Length of tunnel segments in meters */
export const TUNNEL_SEGMENT_LENGTH = 8;

// ============================================================================
// QUEEN BOSS CONFIGURATION
// ============================================================================

/** Queen's total health pool */
export const QUEEN_MAX_HEALTH = 5000;

/** Health percentage threshold for phase 2 transition (66%) */
export const QUEEN_PHASE_2_THRESHOLD = 0.66;

/** Health percentage threshold for phase 3 transition (33%) */
export const QUEEN_PHASE_3_THRESHOLD = 0.33;

/** Duration weak point is visible after scan (ms) */
export const WEAK_POINT_DURATION = 8000;

/** Cooldown between weak point scans (ms) */
export const WEAK_POINT_COOLDOWN = 15000;

/** Damage multiplier when hitting the weak point */
export const WEAK_POINT_DAMAGE_MULTIPLIER = 3;

/** Duration weak point is visible on Easy (ms) - scaled by difficulty */
export const WEAK_POINT_DURATION_BASE = 10000;

/** Cooldown between scans on Easy (ms) - scaled by difficulty */
export const WEAK_POINT_COOLDOWN_BASE = 12000;

// ============================================================================
// QUEEN DIFFICULTY SCALING
// ============================================================================

/** Queen health multiplier per difficulty level */
export const QUEEN_HEALTH_SCALING: Record<string, number> = {
  normal: 1.0,
  veteran: 1.5,
  legendary: 2.0,
};

/** Queen attack damage multiplier per difficulty level */
export const QUEEN_DAMAGE_SCALING: Record<string, number> = {
  normal: 1.0,
  veteran: 1.3,
  legendary: 1.6,
};

/** Queen attack cooldown multiplier per difficulty (lower = faster attacks) */
export const QUEEN_COOLDOWN_SCALING: Record<string, number> = {
  normal: 1.0,
  veteran: 0.85,
  legendary: 0.7,
};

/** Weak point duration multiplier per difficulty (lower = less time) */
export const WEAK_POINT_DURATION_SCALING: Record<string, number> = {
  normal: 1.0,
  veteran: 0.8,
  legendary: 0.6,
};

/** Scan cooldown multiplier per difficulty (higher = longer wait) */
export const SCAN_COOLDOWN_SCALING: Record<string, number> = {
  normal: 1.0,
  veteran: 1.2,
  legendary: 1.5,
};

/** Player invincibility frames scaling per difficulty (lower = less protection) */
export const INVINCIBILITY_SCALING: Record<string, number> = {
  normal: 1.0,
  veteran: 0.8,
  legendary: 0.5,
};

// ============================================================================
// ENEMY CONFIGURATION
// ============================================================================

/**
 * Base stats for each enemy type
 * - health: Hit points
 * - damage: Damage dealt per attack
 * - speed: Movement speed (units/second)
 * - attackRange: Distance at which enemy can attack
 * - fireRate: Attacks per second
 */
export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  drone: { health: 30, damage: 5, speed: 12, attackRange: 2, fireRate: 2 },
  grunt: { health: 100, damage: 20, speed: 6, attackRange: 3, fireRate: 1 },
  spitter: { health: 50, damage: 15, speed: 4, attackRange: 15, fireRate: 0.8 },
  brute: { health: 200, damage: 35, speed: 3, attackRange: 4, fireRate: 0.5 },
} as const;

// ============================================================================
// COMBAT CONFIGURATION
// ============================================================================

/** Player starting health */
export const PLAYER_MAX_HEALTH = 100;

/** Invincibility frame duration after taking damage (ms) */
export const DAMAGE_INVINCIBILITY_MS = 500;

/** Starting grenade count */
export const STARTING_GRENADES = 3;

/** Grenade cooldown (ms) */
export const GRENADE_COOLDOWN = 5000;

/** Grenade explosion radius */
export const GRENADE_RADIUS = 8;

/** Grenade maximum damage at center */
export const GRENADE_MAX_DAMAGE = 80;

/** Melee attack cooldown (ms) */
export const MELEE_COOLDOWN = 800;

/** Melee attack range */
export const MELEE_RANGE = 3;

/** Melee attack damage */
export const MELEE_DAMAGE = 50;

/** Detection range for enemy AI */
export const ENEMY_DETECTION_RANGE = 20;

// ============================================================================
// ARENA CONFIGURATION
// ============================================================================

/** Number of cover pillars in boss arena */
export const ARENA_PILLAR_COUNT = 6;

/** Radius of arena pillar placement ring */
export const ARENA_PILLAR_RADIUS = 18;

/** Height of arena pillars */
export const ARENA_PILLAR_HEIGHT = 4;

// ============================================================================
// QUEEN ATTACK TIMING
// ============================================================================

/** Base damage for each queen attack type */
export const QUEEN_ATTACK_DAMAGE: Record<string, number> = {
  acid_spit: 20,
  claw_swipe: 35,
  tail_slam: 40,
  ground_pound: 25,
};

/** Telegraph duration before attack lands (ms) */
export const QUEEN_ATTACK_TELEGRAPH: Record<string, number> = {
  acid_spit: 800,
  claw_swipe: 400,
  tail_slam: 600,
  ground_pound: 1200,
};

/** Attack range for each queen attack type */
export const QUEEN_ATTACK_RANGE: Record<string, number> = {
  acid_spit: 30,
  claw_swipe: 6,
  tail_slam: 8,
  ground_pound: 15,
};

// ============================================================================
// VISUAL EFFECT CONSTANTS
// ============================================================================

/** Queen weak point pulse frequency */
export const WEAK_POINT_PULSE_SPEED = 3;

/** Queen weak point minimum alpha during pulse */
export const WEAK_POINT_MIN_ALPHA = 0.5;

/** Queen weak point maximum alpha during pulse */
export const WEAK_POINT_MAX_ALPHA = 1.0;

/** Ground pound indicator expansion duration (ms) */
export const GROUND_POUND_INDICATOR_DURATION = 1000;

/** Acid spit projectile speed */
export const ACID_SPIT_PROJECTILE_SPEED = 15;
