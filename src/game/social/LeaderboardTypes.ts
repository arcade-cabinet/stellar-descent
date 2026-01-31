/**
 * LeaderboardTypes - Type definitions for the leaderboard system
 *
 * Defines the data structures for:
 * - Leaderboard entries
 * - Leaderboard categories
 * - Personal best tracking
 * - Database schema
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import type { LevelId } from '../levels/types';

/**
 * Types of leaderboards available
 */
export type LeaderboardType = 'speedrun' | 'score' | 'accuracy' | 'kills';

/**
 * Scope of leaderboard (per-level or global campaign)
 */
export type LeaderboardScope = 'level' | 'campaign';

/**
 * A single entry in a leaderboard
 */
export interface LeaderboardEntry {
  /** Unique identifier for this entry */
  id: string;
  /** Rank in the leaderboard (1-based) */
  rank: number;
  /** Player identifier (local player ID) */
  playerId: string;
  /** Display name for the player */
  playerName: string;
  /** Primary score value (interpretation depends on leaderboard type) */
  score: number;
  /** Level ID for level-specific leaderboards */
  levelId: LevelId | 'campaign';
  /** Time to complete in seconds (for speedrun) */
  completionTime: number;
  /** Difficulty level the run was completed on */
  difficulty: DifficultyLevel;
  /** Accuracy percentage (0-100) */
  accuracy: number;
  /** Total enemies killed */
  enemiesKilled: number;
  /** Total damage dealt */
  damageDealt: number;
  /** Total damage taken */
  damageTaken: number;
  /** Number of deaths during the run */
  deaths: number;
  /** Headshot count */
  headshots: number;
  /** Secrets found */
  secretsFound: number;
  /** Total secrets in level/campaign */
  totalSecrets: number;
  /** When this entry was created */
  timestamp: number;
  /** Performance rating (S, A, B, C, D) */
  rating: string;
}

/**
 * Data needed to submit a new leaderboard entry
 */
export interface LeaderboardSubmission {
  /** Level ID or 'campaign' for global leaderboard */
  levelId: LevelId | 'campaign';
  /** Player display name */
  playerName: string;
  /** Time to complete in seconds */
  completionTime: number;
  /** Difficulty level */
  difficulty: DifficultyLevel;
  /** Accuracy percentage (0-100) */
  accuracy: number;
  /** Total enemies killed */
  enemiesKilled: number;
  /** Total damage dealt */
  damageDealt: number;
  /** Total damage taken */
  damageTaken: number;
  /** Number of deaths */
  deaths: number;
  /** Headshot count */
  headshots: number;
  /** Secrets found */
  secretsFound: number;
  /** Total secrets available */
  totalSecrets: number;
  /** Performance rating */
  rating: string;
  /** Calculated total score */
  totalScore: number;
}

/**
 * Personal best record for a specific category
 */
export interface PersonalBest {
  /** Level ID or 'campaign' */
  levelId: LevelId | 'campaign';
  /** Leaderboard type */
  type: LeaderboardType;
  /** Difficulty level */
  difficulty: DifficultyLevel;
  /** Best value for this category */
  value: number;
  /** Full entry data for this personal best */
  entry: LeaderboardEntry;
  /** When this personal best was set */
  timestamp: number;
}

/**
 * Leaderboard filter options
 */
export interface LeaderboardFilter {
  /** Filter by leaderboard type */
  type?: LeaderboardType;
  /** Filter by level ID */
  levelId?: LevelId | 'campaign';
  /** Filter by difficulty */
  difficulty?: DifficultyLevel | 'all';
  /** Maximum number of entries to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Result of a leaderboard query
 */
export interface LeaderboardQueryResult {
  /** Leaderboard entries */
  entries: LeaderboardEntry[];
  /** Total number of entries (for pagination) */
  totalCount: number;
  /** Player's rank in this leaderboard (if applicable) */
  playerRank?: number;
  /** Player's entry in this leaderboard (if applicable) */
  playerEntry?: LeaderboardEntry;
}

/**
 * Metadata about a leaderboard
 */
export interface LeaderboardInfo {
  /** Leaderboard type */
  type: LeaderboardType;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Unit for the score value */
  unit: string;
  /** Whether higher is better (true) or lower is better (false) */
  higherIsBetter: boolean;
  /** Icon for this leaderboard type */
  icon: string;
}

/**
 * Leaderboard metadata for each type
 */
export const LEADERBOARD_INFO: Record<LeaderboardType, LeaderboardInfo> = {
  speedrun: {
    type: 'speedrun',
    name: 'SPEEDRUN',
    description: 'Fastest completion times',
    unit: 'time',
    higherIsBetter: false,
    icon: '\u23F1', // Stopwatch
  },
  score: {
    type: 'score',
    name: 'HIGH SCORE',
    description: 'Highest total scores',
    unit: 'points',
    higherIsBetter: true,
    icon: '\u2605', // Star
  },
  accuracy: {
    type: 'accuracy',
    name: 'ACCURACY',
    description: 'Best accuracy percentages',
    unit: '%',
    higherIsBetter: true,
    icon: '\u25CE', // Target
  },
  kills: {
    type: 'kills',
    name: 'KILLS',
    description: 'Most enemies eliminated',
    unit: 'kills',
    higherIsBetter: true,
    icon: '\u2694', // Crossed swords
  },
};

/**
 * Database row type for leaderboard entries
 */
export interface LeaderboardRow {
  id: string;
  player_id: string;
  player_name: string;
  level_id: string;
  score: number;
  completion_time: number;
  difficulty: string;
  accuracy: number;
  enemies_killed: number;
  damage_dealt: number;
  damage_taken: number;
  deaths: number;
  headshots: number;
  secrets_found: number;
  total_secrets: number;
  rating: string;
  timestamp: number;
}

/**
 * Database row type for personal bests
 */
export interface PersonalBestRow {
  level_id: string;
  leaderboard_type: string;
  difficulty: string;
  best_value: number;
  entry_id: string;
  timestamp: number;
}

/**
 * Event types emitted by the leaderboard system
 */
export type LeaderboardEvent =
  | { type: 'entry_added'; entry: LeaderboardEntry }
  | { type: 'personal_best'; levelId: LevelId | 'campaign'; leaderboardType: LeaderboardType; entry: LeaderboardEntry; previousBest?: number }
  | { type: 'rank_changed'; entry: LeaderboardEntry; oldRank: number; newRank: number }
  | { type: 'error'; message: string };

/**
 * Listener type for leaderboard events
 */
export type LeaderboardListener = (event: LeaderboardEvent) => void;
