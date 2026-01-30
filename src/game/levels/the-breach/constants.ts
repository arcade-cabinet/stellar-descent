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
export const WEAK_POINT_DAMAGE_MULTIPLIER = 2;

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
