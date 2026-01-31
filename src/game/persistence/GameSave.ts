/**
 * GameSave - Save data interface for game state persistence
 *
 * This module defines the structure of a game save, which captures
 * the player's campaign progress including:
 * - Current level and completed levels
 * - Player health and stats
 * - Inventory items
 * - Objective progress
 * - Difficulty settings
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import type { LevelId } from '../levels/types';

/**
 * Represents a single saved game slot
 */
export interface GameSave {
  /** Unique identifier for this save (UUID) */
  id: string;

  /** Timestamp when save was created (Unix ms) */
  timestamp: number;

  /** Human-readable save name (auto-generated or user-provided) */
  name: string;

  /** Current level the player is on */
  currentLevel: LevelId;

  /** Player's current health (0-100) */
  playerHealth: number;

  /** Maximum player health */
  maxPlayerHealth: number;

  /** Levels that have been completed (in order) */
  levelsCompleted: LevelId[];

  /** Levels that have been visited (started but not necessarily completed) */
  levelsVisited: LevelId[];

  /** Total kills across the campaign */
  totalKills: number;

  /** Total distance traveled (for stats) */
  totalDistance: number;

  /** Total time played in milliseconds */
  playTime: number;

  /** Current chapter (1-6) */
  currentChapter: number;

  /** Player position within current level */
  playerPosition: {
    x: number;
    y: number;
    z: number;
  };

  /** Player rotation (Y-axis) within current level */
  playerRotation: number;

  /** Inventory items (item ID to quantity) */
  inventory: Record<string, number>;

  /**
   * @deprecated Use questState instead.
   * Quest/objective flags (quest ID to completion status)
   * Kept for backwards compatibility with older saves.
   */
  objectives: Record<string, boolean>;

  /** Completed quest IDs */
  completedQuests: string[];

  /** Active quest states (quest ID to state) */
  activeQuests: Record<string, {
    questId: string;
    status: 'available' | 'active' | 'completed' | 'failed';
    currentObjectiveIndex: number;
    objectiveProgress: Record<string, number>;
    objectiveStatus: Record<string, 'pending' | 'active' | 'completed' | 'failed'>;
    startedAt?: number;
    completedAt?: number;
  }>;

  /** Failed quest IDs */
  failedQuests: string[];

  /**
   * @deprecated Use levelsCompleted.includes('anchor_station') instead.
   * Kept for backwards compatibility with older saves.
   */
  tutorialCompleted: boolean;

  /** Additional level-specific flags */
  levelFlags: Record<LevelId, Record<string, boolean>>;

  /** Best completion times per level in seconds */
  levelBestTimes: Partial<Record<LevelId, number>>;

  /** Difficulty level for this save */
  difficulty: DifficultyLevel;

  /** Whether the intro briefing has been shown */
  seenIntroBriefing: boolean;

  /** Version of the save format (for migration) */
  version: number;
}

/**
 * Metadata for save slot display (list view)
 */
export interface GameSaveMetadata {
  id: string;
  timestamp: number;
  name: string;
  currentLevel: LevelId;
  currentChapter: number;
  playTime: number;
  levelsCompleted: number;
  difficulty: DifficultyLevel;
}

/**
 * Current save format version
 * Increment when breaking changes are made to GameSave interface
 * v2: Added difficulty field
 * v3: Added seenIntroBriefing field
 * v4: Added levelBestTimes field
 * v5: Added quest chain state (completedQuests, activeQuests, failedQuests)
 */
export const SAVE_FORMAT_VERSION = 5;

/**
 * Create a new empty save with default values
 * @param id - Save slot ID
 * @param difficulty - Difficulty level
 * @param startLevel - Starting level (defaults to 'anchor_station')
 */
/**
 * Level ID to chapter mapping (avoids circular dependency with levels/types)
 */
const LEVEL_CHAPTERS: Record<LevelId, number> = {
  anchor_station: 1,
  landfall: 2,
  canyon_run: 3,
  fob_delta: 4,
  brothers_in_arms: 5,
  southern_ice: 6,
  the_breach: 7,
  hive_assault: 8,
  extraction: 9,
  final_escape: 10,
};

export function createNewSave(
  id: string,
  difficulty: DifficultyLevel = 'normal',
  startLevel: LevelId = 'anchor_station'
): GameSave {
  // Get chapter from level mapping
  const chapter = LEVEL_CHAPTERS[startLevel] ?? 1;

  return {
    id,
    timestamp: Date.now(),
    name: generateSaveName(),
    currentLevel: startLevel,
    playerHealth: 100,
    maxPlayerHealth: 100,
    levelsCompleted: [],
    levelsVisited: [],
    totalKills: 0,
    totalDistance: 0,
    playTime: 0,
    currentChapter: chapter,
    playerPosition: { x: 0, y: 1.7, z: 0 },
    playerRotation: Math.PI,
    inventory: {},
    objectives: {},
    completedQuests: [],
    activeQuests: {},
    failedQuests: [],
    tutorialCompleted: startLevel !== 'anchor_station',
    levelFlags: {
      anchor_station: {},
      landfall: {},
      canyon_run: {},
      fob_delta: {},
      brothers_in_arms: {},
      southern_ice: {},
      the_breach: {},
      hive_assault: {},
      extraction: {},
      final_escape: {},
    },
    levelBestTimes: {},
    difficulty,
    seenIntroBriefing: false,
    version: SAVE_FORMAT_VERSION,
  };
}

/**
 * Generate a default save name based on current date/time
 */
function generateSaveName(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `Save ${month}/${day} ${hours}:${minutes}`;
}

/**
 * Generate a unique save ID
 */
export function generateSaveId(): string {
  // Simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Extract metadata from a full save for list display
 */
export function extractSaveMetadata(save: GameSave): GameSaveMetadata {
  return {
    id: save.id,
    timestamp: save.timestamp,
    name: save.name,
    currentLevel: save.currentLevel,
    currentChapter: save.currentChapter,
    playTime: save.playTime,
    levelsCompleted: save.levelsCompleted.length,
    difficulty: save.difficulty ?? 'normal',
  };
}

/**
 * Format play time as human-readable string (e.g., "2h 15m")
 */
export function formatPlayTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get display name for a level ID
 */
export function getLevelDisplayName(levelId: LevelId): string {
  const names: Record<LevelId, string> = {
    anchor_station: 'Anchor Station',
    landfall: 'Landfall',
    canyon_run: 'Canyon Run',
    fob_delta: 'FOB Delta',
    brothers_in_arms: 'Brothers in Arms',
    southern_ice: 'Southern Ice',
    the_breach: 'The Breach',
    hive_assault: 'Hive Assault',
    extraction: 'Extraction',
    final_escape: 'Final Escape',
  };
  return names[levelId] || levelId;
}
