/**
 * PlayerStats - Comprehensive player statistics interface
 *
 * Defines all trackable statistics for player performance analysis
 * including combat, accuracy, survival, time, campaign, and collectibles.
 */

import type { WeaponId } from '../entities/weapons';
import type { LevelId } from '../levels/types';

// ============================================================================
// ENEMY TYPE (for kill tracking)
// ============================================================================

/**
 * All enemy types that can be tracked for kill statistics
 */
export type EnemyType =
  | 'skitterer'
  | 'spitter'
  | 'warrior'
  | 'heavy'
  | 'stalker'
  | 'broodmother'
  | 'queen'
  | 'lurker'
  | 'spewer'
  | 'husk'
  | 'drone'
  | 'grunt'
  | 'brute'
  | 'ice_chitin'
  | 'unknown';

// ============================================================================
// PLAYER STATS INTERFACE
// ============================================================================

/**
 * Complete player statistics structure
 */
export interface PlayerStats {
  // ========== COMBAT ==========
  /** Total enemies killed across all sessions */
  totalKills: number;
  /** Kills broken down by weapon */
  killsByWeapon: Partial<Record<WeaponId, number>>;
  /** Kills broken down by enemy type */
  killsByEnemy: Partial<Record<EnemyType, number>>;
  /** Number of headshot kills */
  headshots: number;
  /** Number of melee kills (bare hands) */
  meleeKills: number;
  /** Number of grenade kills */
  grenadeKills: number;
  /** Bosses defeated */
  bossesDefeated: number;

  // ========== ACCURACY ==========
  /** Total shots fired */
  shotsFired: number;
  /** Total shots that hit a target */
  shotsHit: number;
  /** Accuracy percentage (calculated: shotsHit / shotsFired * 100) */
  accuracy: number;
  /** Shots fired per weapon */
  shotsFiredByWeapon: Partial<Record<WeaponId, number>>;
  /** Shots hit per weapon */
  shotsHitByWeapon: Partial<Record<WeaponId, number>>;

  // ========== SURVIVAL ==========
  /** Total player deaths */
  deaths: number;
  /** Deaths per level */
  deathsByLevel: Partial<Record<LevelId, number>>;
  /** Total damage dealt to enemies */
  damageDealt: number;
  /** Total damage taken from enemies */
  damageTaken: number;
  /** Total health recovered (pickups + regen) */
  healthHealed: number;
  /** Total armor absorbed damage */
  armorAbsorbed: number;
  /** Grenades thrown */
  grenadesThrown: number;

  // ========== TIME ==========
  /** Total play time in milliseconds */
  totalPlayTime: number;
  /** Longest single session in milliseconds */
  longestSession: number;
  /** Current session start timestamp */
  currentSessionStart: number;
  /** Time spent per level in milliseconds */
  timeByLevel: Partial<Record<LevelId, number>>;

  // ========== CAMPAIGN ==========
  /** Number of levels completed */
  levelsCompleted: number;
  /** Number of full campaign completions */
  campaignCompletions: number;
  /** Fastest campaign completion time in milliseconds */
  fastestCampaign: number | null;
  /** Best time per level in milliseconds */
  levelBestTimes: Partial<Record<LevelId, number>>;
  /** Number of times each level has been completed */
  levelCompletionCounts: Partial<Record<LevelId, number>>;

  // ========== COLLECTIBLES ==========
  /** Total skulls found */
  skullsFound: number;
  /** Total audio logs found */
  audioLogsFound: number;
  /** Total secret areas discovered */
  secretsFound: number;
  /** Skulls by level */
  skullsByLevel: Partial<Record<LevelId, string[]>>;
  /** Audio logs by level */
  audioLogsByLevel: Partial<Record<LevelId, string[]>>;
  /** Secrets by level */
  secretsByLevel: Partial<Record<LevelId, string[]>>;

  // ========== ACHIEVEMENTS ==========
  /** Number of achievements unlocked */
  achievementsUnlocked: number;
  /** List of unlocked achievement IDs */
  unlockedAchievementIds: string[];

  // ========== MILESTONES ==========
  /** First kill timestamp */
  firstKillAt: number | null;
  /** First death timestamp */
  firstDeathAt: number | null;
  /** First campaign completion timestamp */
  firstCampaignCompleteAt: number | null;
  /** Most kills in a single level */
  highestKillStreak: number;
  /** Most kills without dying */
  longestKillStreak: number;

  // ========== META ==========
  /** Stats version for migration */
  version: number;
  /** Last updated timestamp */
  lastUpdated: number;
  /** Date stats were first created */
  createdAt: number;
}

// ============================================================================
// DERIVED STATS (calculated on-demand)
// ============================================================================

/**
 * Derived statistics calculated from base stats
 */
export interface DerivedStats {
  /** Kill/Death ratio */
  kdRatio: number;
  /** Average kills per session */
  averageKillsPerSession: number;
  /** Average accuracy percentage */
  averageAccuracy: number;
  /** Most used weapon */
  favoriteWeapon: WeaponId | null;
  /** Most killed enemy type */
  mostKilledEnemy: EnemyType | null;
  /** Average session length in milliseconds */
  averageSessionLength: number;
  /** Total grenades used */
  totalGrenadesUsed: number;
  /** Damage efficiency (dealt / taken) */
  damageEfficiency: number;
  /** Collectible completion percentage */
  collectibleCompletion: number;
  /** Campaign completion percentage */
  campaignProgress: number;
}

// ============================================================================
// SESSION STATS (for current play session)
// ============================================================================

/**
 * Statistics for the current play session
 */
export interface SessionStats {
  sessionId: string;
  startTime: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  shotsFired: number;
  shotsHit: number;
  levelsCompleted: string[];
  collectiblesFound: number;
}

// ============================================================================
// STATS VERSION FOR MIGRATION
// ============================================================================

export const STATS_VERSION = 1;

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Create empty player stats with default values
 */
export function createDefaultStats(): PlayerStats {
  const now = Date.now();
  return {
    // Combat
    totalKills: 0,
    killsByWeapon: {},
    killsByEnemy: {},
    headshots: 0,
    meleeKills: 0,
    grenadeKills: 0,
    bossesDefeated: 0,

    // Accuracy
    shotsFired: 0,
    shotsHit: 0,
    accuracy: 0,
    shotsFiredByWeapon: {},
    shotsHitByWeapon: {},

    // Survival
    deaths: 0,
    deathsByLevel: {},
    damageDealt: 0,
    damageTaken: 0,
    healthHealed: 0,
    armorAbsorbed: 0,
    grenadesThrown: 0,

    // Time
    totalPlayTime: 0,
    longestSession: 0,
    currentSessionStart: now,
    timeByLevel: {},

    // Campaign
    levelsCompleted: 0,
    campaignCompletions: 0,
    fastestCampaign: null,
    levelBestTimes: {},
    levelCompletionCounts: {},

    // Collectibles
    skullsFound: 0,
    audioLogsFound: 0,
    secretsFound: 0,
    skullsByLevel: {},
    audioLogsByLevel: {},
    secretsByLevel: {},

    // Achievements
    achievementsUnlocked: 0,
    unlockedAchievementIds: [],

    // Milestones
    firstKillAt: null,
    firstDeathAt: null,
    firstCampaignCompleteAt: null,
    highestKillStreak: 0,
    longestKillStreak: 0,

    // Meta
    version: STATS_VERSION,
    lastUpdated: now,
    createdAt: now,
  };
}

/**
 * Calculate derived statistics from base stats
 */
export function calculateDerivedStats(stats: PlayerStats): DerivedStats {
  // K/D ratio
  const kdRatio = stats.deaths > 0 ? stats.totalKills / stats.deaths : stats.totalKills;

  // Average accuracy
  const averageAccuracy = stats.shotsFired > 0
    ? (stats.shotsHit / stats.shotsFired) * 100
    : 0;

  // Favorite weapon (most kills)
  let favoriteWeapon: WeaponId | null = null;
  let maxWeaponKills = 0;
  for (const [weapon, kills] of Object.entries(stats.killsByWeapon)) {
    if (kills && kills > maxWeaponKills) {
      maxWeaponKills = kills;
      favoriteWeapon = weapon as WeaponId;
    }
  }

  // Most killed enemy
  let mostKilledEnemy: EnemyType | null = null;
  let maxEnemyKills = 0;
  for (const [enemy, kills] of Object.entries(stats.killsByEnemy)) {
    if (kills && kills > maxEnemyKills) {
      maxEnemyKills = kills;
      mostKilledEnemy = enemy as EnemyType;
    }
  }

  // Average session length (estimate based on total time / sessions)
  // Assume 1 session per 30 min average
  const estimatedSessions = Math.max(1, Math.ceil(stats.totalPlayTime / (30 * 60 * 1000)));
  const averageSessionLength = stats.totalPlayTime / estimatedSessions;

  // Average kills per session
  const averageKillsPerSession = stats.totalKills / estimatedSessions;

  // Damage efficiency
  const damageEfficiency = stats.damageTaken > 0
    ? stats.damageDealt / stats.damageTaken
    : stats.damageDealt;

  // Collectible completion (assuming 30 total collectibles across campaign)
  const totalCollectibles = 30;
  const foundCollectibles = stats.skullsFound + stats.audioLogsFound + stats.secretsFound;
  const collectibleCompletion = (foundCollectibles / totalCollectibles) * 100;

  // Campaign progress (10 levels)
  const totalLevels = 10;
  const campaignProgress = (stats.levelsCompleted / totalLevels) * 100;

  return {
    kdRatio: Math.round(kdRatio * 100) / 100,
    averageKillsPerSession: Math.round(averageKillsPerSession * 10) / 10,
    averageAccuracy: Math.round(averageAccuracy * 10) / 10,
    favoriteWeapon,
    mostKilledEnemy,
    averageSessionLength,
    totalGrenadesUsed: stats.grenadesThrown,
    damageEfficiency: Math.round(damageEfficiency * 100) / 100,
    collectibleCompletion: Math.round(collectibleCompletion * 10) / 10,
    campaignProgress: Math.round(campaignProgress * 10) / 10,
  };
}

/**
 * Get display name for an enemy type
 */
export function getEnemyDisplayName(enemyType: EnemyType): string {
  const names: Record<EnemyType, string> = {
    skitterer: 'Skitterer',
    spitter: 'Spitter',
    warrior: 'Warrior',
    heavy: 'Heavy',
    stalker: 'Stalker',
    broodmother: 'Broodmother',
    queen: 'Hive Queen',
    lurker: 'Lurker',
    spewer: 'Spewer',
    husk: 'Husk',
    drone: 'Drone',
    grunt: 'Grunt',
    brute: 'Brute',
    ice_chitin: 'Ice Chitin',
    unknown: 'Unknown',
  };
  return names[enemyType] || 'Unknown';
}
