/**
 * Achievement System Types and Definitions
 *
 * Contains all achievement-related types and the ACHIEVEMENTS constant.
 * Separated from the store to avoid circular dependencies.
 */

import type { LevelId } from '../levels/types';

// ============================================================================
// TYPES
// ============================================================================

export type AchievementId =
  // Story achievements (13)
  | 'first_steps' // Complete tutorial
  | 'odst' // Complete HALO jump
  | 'baptism_by_fire' // Win first surface combat encounter
  | 'road_warrior' // Complete Canyon Run
  | 'survivor' // Complete FOB Delta without dying
  | 'reunited' // Find Marcus
  | 'brothers_keeper' // Complete Brothers in Arms without Marcus going down
  | 'ice_breaker' // Complete Southern Ice
  | 'queen_slayer' // Defeat the Brood Queen
  | 'total_war' // Complete Hive Assault
  | 'extracted' // Complete Extraction
  | 'great_escape' // Complete Final Escape
  | 'campaign_veteran' // Complete the entire campaign
  // Combat achievements (7)
  | 'first_blood' // Kill first enemy
  | 'exterminator' // Kill 100 aliens total
  | 'mass_extinction' // Kill 500 aliens total
  | 'headhunter' // Kill 50 aliens in a single level
  | 'multi_kill' // Kill 5 enemies within 3 seconds
  | 'grenadier' // Kill 3 enemies with a single explosion
  | 'last_stand' // Kill an enemy while below 10% health
  // Exploration achievements (6)
  | 'explorer' // Discover all areas in a level
  | 'log_collector' // Find all audio logs
  | 'secret_hunter' // Find 10 secret areas
  | 'curious' // Find your first secret area
  | 'thorough' // Complete a level finding all collectibles
  | 'cartographer' // Visit every room in FOB Delta
  // Challenge achievements (12)
  | 'speedrunner' // Complete game in under 60 minutes
  | 'untouchable' // Complete a level without taking damage
  | 'sharpshooter' // 80%+ accuracy in a level
  | 'speed_demon_landfall' // Complete Landfall under par time
  | 'speed_demon_canyon' // Complete Canyon Run under par time
  | 'speed_demon_fob' // Complete FOB Delta under par time
  | 'speed_demon_brothers' // Complete Brothers in Arms under par time
  | 'speed_demon_ice' // Complete Southern Ice under par time
  | 'speed_demon_escape' // Complete Final Escape under par time
  | 'iron_marine' // Complete any level on Insane difficulty
  | 'perfect_drop' // Complete Landfall with 100% accuracy, no damage
  | 'flawless_run'; // Complete Final Escape without crashing

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  secret?: boolean; // Hidden until unlocked
  category: 'story' | 'combat' | 'challenge' | 'exploration';
  // For progressive achievements, define the target
  progressTarget?: number;
  // For progress achievements, which progress key to use
  progressKey?: 'totalKills' | 'secretsFound' | 'audioLogsFound';
}

export interface AchievementState {
  unlockedAt: number | null; // Timestamp when unlocked, null if locked
}

export interface AchievementProgress {
  // Kill tracking
  totalKills?: number;
  levelKills?: number; // Kills in current level
  // Timing
  gameStartTime?: number;
  levelStartTime?: number;
  // Damage tracking
  levelDamageTaken?: Partial<Record<LevelId, number>>;
  // Accuracy tracking
  shotsFired?: number;
  shotsHit?: number;
  levelShotsFired?: number;
  levelShotsHit?: number;
  // Exploration tracking
  secretsFound?: number;
  levelSecretsFound?: number; // Secrets found in current level
  audioLogsFound?: number;
  areasDiscovered?: number;
  // Multi-kill tracking
  recentKillTimestamps?: number[];
  // Marcus tracking for Brothers in Arms
  marcusDownCount?: number;
}

export type AchievementUnlockCallback = (achievement: Achievement) => void;

// Par times for Speed Demon achievements (in milliseconds)
export const LEVEL_PAR_TIMES: Partial<Record<LevelId, number>> = {
  landfall: 5 * 60 * 1000, // 5 minutes
  canyon_run: 4 * 60 * 1000, // 4 minutes
  fob_delta: 8 * 60 * 1000, // 8 minutes
  brothers_in_arms: 10 * 60 * 1000, // 10 minutes
  southern_ice: 9 * 60 * 1000, // 9 minutes
  the_breach: 12 * 60 * 1000, // 12 minutes
  hive_assault: 15 * 60 * 1000, // 15 minutes
  extraction: 6 * 60 * 1000, // 6 minutes
  final_escape: 3 * 60 * 1000, // 3 minutes
};

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================================

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  // === STORY ACHIEVEMENTS (13) ===
  first_steps: {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete the tutorial on Anchor Station Prometheus',
    icon: '\u2605', // Star
    category: 'story',
  },
  odst: {
    id: 'odst',
    name: 'ODST',
    description: 'Complete the HALO drop onto the planet surface',
    icon: '\u2193', // Down arrow
    category: 'story',
  },
  baptism_by_fire: {
    id: 'baptism_by_fire',
    name: 'Baptism by Fire',
    description: 'Survive your first surface combat encounter',
    icon: '\u2694', // Crossed swords
    category: 'story',
  },
  road_warrior: {
    id: 'road_warrior',
    name: 'Road Warrior',
    description: 'Survive the canyon vehicle chase and reach FOB Delta',
    icon: '\u2699', // Gear
    category: 'story',
  },
  survivor: {
    id: 'survivor',
    name: 'Survivor',
    description: 'Complete FOB Delta without dying',
    icon: '\u2661', // Heart
    category: 'story',
  },
  reunited: {
    id: 'reunited',
    name: 'Reunited',
    description: 'Find Corporal Marcus Cole',
    icon: '\u2726', // Star
    category: 'story',
  },
  brothers_keeper: {
    id: 'brothers_keeper',
    name: "Brother's Keeper",
    description: 'Complete Brothers in Arms without Marcus going down',
    icon: '\u2764', // Heart
    category: 'story',
  },
  ice_breaker: {
    id: 'ice_breaker',
    name: 'Ice Breaker',
    description: 'Traverse the frozen wasteland and reach the secondary hive entrance',
    icon: '\u2744', // Snowflake
    category: 'story',
  },
  queen_slayer: {
    id: 'queen_slayer',
    name: 'Queen Slayer',
    description: 'Defeat the Brood Queen in the underground hive',
    icon: '\u2620', // Skull
    category: 'story',
  },
  total_war: {
    id: 'total_war',
    name: 'Total War',
    description: 'Lead the combined arms assault and plant charges on the hive nexus',
    icon: '\u2622', // Radioactive
    category: 'story',
  },
  extracted: {
    id: 'extracted',
    name: 'Extracted',
    description: 'Hold LZ Omega and signal the dropship for extraction',
    icon: '\u2708', // Airplane
    category: 'story',
  },
  great_escape: {
    id: 'great_escape',
    name: 'Great Escape',
    description: 'Outrun the planetary collapse and reach the dropship',
    icon: '\u26A1', // Lightning
    category: 'story',
  },
  campaign_veteran: {
    id: 'campaign_veteran',
    name: 'Campaign Veteran',
    description: 'Complete the entire 10-mission campaign on any difficulty',
    icon: '\u2606', // White star
    category: 'story',
  },

  // === COMBAT ACHIEVEMENTS (7) ===
  first_blood: {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill your first enemy',
    icon: '\u2022', // Bullet
    category: 'combat',
  },
  exterminator: {
    id: 'exterminator',
    name: 'Exterminator',
    description: 'Kill 100 aliens across all playthroughs',
    icon: '\u2694', // Crossed swords
    category: 'combat',
    progressTarget: 100,
    progressKey: 'totalKills',
  },
  mass_extinction: {
    id: 'mass_extinction',
    name: 'Mass Extinction',
    description: 'Kill 500 aliens across all playthroughs',
    icon: '\u2620', // Skull
    category: 'combat',
    progressTarget: 500,
    progressKey: 'totalKills',
    secret: true,
  },
  headhunter: {
    id: 'headhunter',
    name: 'Headhunter',
    description: 'Kill 50 aliens in a single level',
    icon: '\u2316', // Target
    category: 'combat',
  },
  multi_kill: {
    id: 'multi_kill',
    name: 'Multi Kill',
    description: 'Kill 5 enemies within 3 seconds',
    icon: '\u2735', // Eight spoked asterisk
    category: 'combat',
  },
  grenadier: {
    id: 'grenadier',
    name: 'Grenadier',
    description: 'Kill 3 enemies with a single explosion',
    icon: '\u25CF', // Black circle
    category: 'combat',
  },
  last_stand: {
    id: 'last_stand',
    name: 'Last Stand',
    description: 'Kill an enemy while below 10% health',
    icon: '\u2665', // Black heart
    category: 'combat',
  },

  // === EXPLORATION ACHIEVEMENTS (6) ===
  curious: {
    id: 'curious',
    name: 'Curious',
    description: 'Discover your first secret area',
    icon: '\u2753', // Question mark
    category: 'exploration',
  },
  secret_hunter: {
    id: 'secret_hunter',
    name: 'Secret Hunter',
    description: 'Discover 10 secret areas across all playthroughs',
    icon: '\u2736', // Six pointed star
    category: 'exploration',
    progressTarget: 10,
    progressKey: 'secretsFound',
  },
  log_collector: {
    id: 'log_collector',
    name: 'Log Collector',
    description: 'Find all 18 audio logs scattered across the campaign',
    icon: '\u266A', // Music note
    category: 'exploration',
    progressTarget: 18,
    progressKey: 'audioLogsFound',
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Discover all areas in any level',
    icon: '\u2690', // Flag
    category: 'exploration',
  },
  thorough: {
    id: 'thorough',
    name: 'Thorough',
    description: 'Complete a level finding all collectibles',
    icon: '\u2714', // Checkmark
    category: 'exploration',
  },
  cartographer: {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'Visit every room in FOB Delta',
    icon: '\u25A6', // Square with diagonal
    category: 'exploration',
  },

  // === CHALLENGE ACHIEVEMENTS (12) ===
  speedrunner: {
    id: 'speedrunner',
    name: 'Speedrunner',
    description: 'Complete the entire 10-mission campaign in under 60 minutes',
    icon: '\u23F1', // Stopwatch
    category: 'challenge',
    secret: true,
  },
  untouchable: {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Complete any level without taking damage',
    icon: '\u2727', // Diamond
    category: 'challenge',
  },
  sharpshooter: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Achieve 80% or better accuracy in a level (min 20 shots)',
    icon: '\u25CE', // Bullseye
    category: 'challenge',
  },
  speed_demon_landfall: {
    id: 'speed_demon_landfall',
    name: 'Speed Demon: Landfall',
    description: 'Complete Landfall in under 5 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_canyon: {
    id: 'speed_demon_canyon',
    name: 'Speed Demon: Canyon Run',
    description: 'Complete Canyon Run in under 4 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_fob: {
    id: 'speed_demon_fob',
    name: 'Speed Demon: FOB Delta',
    description: 'Complete FOB Delta in under 8 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_brothers: {
    id: 'speed_demon_brothers',
    name: 'Speed Demon: Brothers',
    description: 'Complete Brothers in Arms in under 10 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_ice: {
    id: 'speed_demon_ice',
    name: 'Speed Demon: Southern Ice',
    description: 'Complete Southern Ice in under 9 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_escape: {
    id: 'speed_demon_escape',
    name: 'Speed Demon: Final Escape',
    description: 'Complete Final Escape in under 3 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  iron_marine: {
    id: 'iron_marine',
    name: 'Iron Marine',
    description: 'Complete any level on Insane difficulty',
    icon: '\u2666', // Diamond
    category: 'challenge',
    secret: true,
  },
  perfect_drop: {
    id: 'perfect_drop',
    name: 'Perfect Drop',
    description: 'Complete Landfall with 100% accuracy and no damage taken',
    icon: '\u2605', // Star
    category: 'challenge',
    secret: true,
  },
  flawless_run: {
    id: 'flawless_run',
    name: 'Flawless Run',
    description: 'Complete Final Escape without crashing the vehicle',
    icon: '\u2605', // Star
    category: 'challenge',
    secret: true,
  },
};
