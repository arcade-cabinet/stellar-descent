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
  // Legacy attacks (for backwards compatibility)
  acid_spit: 20,
  claw_swipe: 35,
  tail_slam: 40,
  ground_pound: 25,
  // Phase 1 attacks
  acid_spray: 15, // Per projectile (5 projectiles = 75 max)
  tail_swipe: 30,
  screech: 5, // Minor damage, main effect is stun
  // Phase 2 attacks
  egg_burst: 0, // No direct damage, spawns enemies
  charge: 50,
  poison_cloud: 8, // Per second while in cloud
  // Phase 3 attacks
  frenzy: 25, // Per hit in rapid combo
};

/** Telegraph duration before attack lands (ms) */
export const QUEEN_ATTACK_TELEGRAPH: Record<string, number> = {
  // Legacy
  acid_spit: 800,
  claw_swipe: 400,
  tail_slam: 600,
  ground_pound: 1200,
  // Phase 1
  acid_spray: 600,
  tail_swipe: 500,
  screech: 800,
  // Phase 2
  egg_burst: 1000,
  charge: 1200,
  poison_cloud: 700,
  // Phase 3
  frenzy: 300,
};

/** Attack range for each queen attack type */
export const QUEEN_ATTACK_RANGE: Record<string, number> = {
  // Legacy
  acid_spit: 30,
  claw_swipe: 6,
  tail_slam: 8,
  ground_pound: 15,
  // Phase 1
  acid_spray: 25,
  tail_swipe: 8, // Frontal arc melee
  screech: 40, // Entire arena
  // Phase 2
  egg_burst: 50, // Entire arena (spawns from walls)
  charge: 30, // Rush distance
  poison_cloud: 20,
  // Phase 3
  frenzy: 6, // Close range combo
};

// ============================================================================
// QUEEN PHASE ATTACK COOLDOWNS
// ============================================================================

/** Base attack cooldown per phase (ms) */
export const QUEEN_PHASE_COOLDOWNS: Record<number, number> = {
  1: 3000, // Phase 1: 3 second cooldown
  2: 2500, // Phase 2: 2.5 second cooldown
  3: 1500, // Phase 3: 1.5 second cooldown
};

/** Stagger duration when weak point is destroyed (ms) */
export const QUEEN_STAGGER_DURATION = 2000;

/** Phase transition stagger duration (ms) */
export const QUEEN_PHASE_TRANSITION_DURATION = 3000;

/** Death throes health threshold (percentage) */
export const QUEEN_DEATH_THROES_THRESHOLD = 0.1;

/** Death throes spawn interval (ms) */
export const QUEEN_DEATH_THROES_SPAWN_INTERVAL = 4000;

// ============================================================================
// QUEEN WEAK POINT CONFIGURATION
// ============================================================================

/** Weak point health values */
export const QUEEN_WEAK_POINT_HEALTH: Record<string, number> = {
  head: 500,
  thorax: 400,
  egg_sac: 300,
};

/** Weak point damage multiplier when exposed */
export const QUEEN_WEAK_POINT_MULTIPLIERS: Record<string, number> = {
  head: 2.5,
  thorax: 2.0,
  egg_sac: 2.0,
};

/** Weak point glow intensity per phase */
export const QUEEN_WEAK_POINT_GLOW: Record<number, number> = {
  1: 0.3,
  2: 0.5,
  3: 0.8, // Brighter in phase 3 for easier targeting
};

// ============================================================================
// QUEEN ACID SPRAY CONFIGURATION
// ============================================================================

/** Number of acid projectiles in spray attack */
export const ACID_SPRAY_PROJECTILE_COUNT = 5;

/** Spread angle for acid spray (degrees) */
export const ACID_SPRAY_SPREAD_ANGLE = 30;

/** Acid projectile speed */
export const ACID_SPRAY_SPEED = 18;

// ============================================================================
// QUEEN CHARGE CONFIGURATION
// ============================================================================

/** Charge movement speed */
export const QUEEN_CHARGE_SPEED = 25;

/** Charge collision radius */
export const QUEEN_CHARGE_RADIUS = 3;

/** Time to return to home position after charge (ms) */
export const QUEEN_CHARGE_RETURN_TIME = 2000;

// ============================================================================
// QUEEN SCREECH CONFIGURATION
// ============================================================================

/** Screech stun duration (ms) */
export const QUEEN_SCREECH_STUN_DURATION = 1500;

/** Number of skitterers summoned by screech */
export const QUEEN_SCREECH_SPAWN_COUNT = 2;

// ============================================================================
// QUEEN POISON CLOUD CONFIGURATION
// ============================================================================

/** Poison cloud radius */
export const QUEEN_POISON_CLOUD_RADIUS = 6;

/** Poison cloud duration (ms) */
export const QUEEN_POISON_CLOUD_DURATION = 8000;

// ============================================================================
// QUEEN FRENZY CONFIGURATION
// ============================================================================

/** Number of attacks in frenzy combo */
export const QUEEN_FRENZY_ATTACK_COUNT = 3;

/** Delay between frenzy attacks (ms) */
export const QUEEN_FRENZY_ATTACK_DELAY = 400;

// ============================================================================
// QUEEN EGG BURST CONFIGURATION
// ============================================================================

/** Number of spitters spawned by egg burst */
export const QUEEN_EGG_BURST_SPAWN_COUNT = 4;

// ============================================================================
// QUEEN SLOW-MO DEATH CONFIGURATION
// ============================================================================

/** Duration of slow-motion effect on queen death (ms) */
export const QUEEN_DEATH_SLOWMO_DURATION = 2000;

/** Time scale during slow-mo (0.1 = 10% speed) */
export const QUEEN_DEATH_SLOWMO_SCALE = 0.2;

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
