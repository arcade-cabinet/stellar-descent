/**
 * GameSave - Save data interface for game state persistence
 *
 * This module defines the structure of a game save, which captures
 * the player's campaign progress including:
 * - Current level and completed levels
 * - Player health, armor, and weapon state
 * - Inventory items and collectibles
 * - Objective progress
 * - Difficulty and game settings
 * - New Game Plus (NG+) state
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import type { LevelId } from '../levels/types';
import type { WeaponId } from '../entities/weapons';
import type { SkullId } from '../collectibles/SkullSystem';

// ============================================================================
// WEAPON STATE
// ============================================================================

/**
 * State of a single weapon for save/restore
 */
export interface WeaponSaveState {
  /** Weapon ID (e.g., 'rifle', 'shotgun', 'pistol') */
  weaponId: string;
  /** Current magazine ammo */
  currentAmmo: number;
  /** Reserve ammo */
  reserveAmmo: number;
  /** Whether this weapon has been unlocked/acquired */
  unlocked: boolean;
}

// ============================================================================
// PLAYER STATE
// ============================================================================

/**
 * Complete player state for save/restore
 */
export interface PlayerSaveState {
  /** Current health (0-100) */
  health: number;
  /** Maximum health */
  maxHealth: number;
  /** Current armor (0-100) */
  armor: number;
  /** Maximum armor */
  maxArmor: number;
  /** All weapon states */
  weapons: WeaponSaveState[];
  /** Currently equipped weapon slot (0, 1, 2) */
  currentWeaponSlot: number;
  /** Grenade inventory by type */
  grenades: {
    frag: number;
    plasma: number;
    emp: number;
  };
  /** Grenade usage stats (picked up vs used) */
  grenadeStats?: {
    pickedUp: { frag: number; plasma: number; emp: number };
    used: { frag: number; plasma: number; emp: number };
  };
  /** Checkpoint position (null if no checkpoint) */
  checkpointPosition: { x: number; y: number; z: number } | null;
  /** Checkpoint rotation (null if no checkpoint) */
  checkpointRotation: number | null;
}

// ============================================================================
// COLLECTIBLES STATE
// ============================================================================

/**
 * Collectibles state for save/restore
 */
export interface CollectiblesSaveState {
  /** IDs of collected skulls */
  skulls: string[];
  /** IDs of discovered audio logs */
  audioLogs: string[];
  /** IDs of discovered secret areas */
  secretAreas: string[];
}

// ============================================================================
// GAME SETTINGS
// ============================================================================

/**
 * Game settings to persist with save
 * These override the global settings when this save is loaded
 */
export interface SavedGameSettings {
  /** Master volume (0-1) */
  masterVolume: number;
  /** Music volume (0-1) */
  musicVolume: number;
  /** SFX volume (0-1) */
  sfxVolume: number;
  /** Mouse sensitivity multiplier */
  mouseSensitivity: number;
  /** Invert Y axis */
  invertMouseY: boolean;
  /** Field of view in degrees */
  fieldOfView: number;
  /** Show hitmarkers */
  showHitmarkers: boolean;
}

// ============================================================================
// SAVE STATE (Full structure per requirements)
// ============================================================================

/**
 * Complete save state structure matching requirements
 */
export interface SaveState {
  /** Save format version for migrations */
  version: number;
  /** Unix timestamp of last save */
  timestamp: number;
  /** Campaign progress */
  campaign: {
    currentLevel: LevelId;
    completedLevels: LevelId[];
    difficulty: DifficultyLevel;
    playTime: number;
  };
  /** Player state */
  player: PlayerSaveState;
  /** Collectibles state */
  collectibles: CollectiblesSaveState;
  /** Unlocked achievement IDs */
  achievements: string[];
  /** Game settings snapshot */
  settings: SavedGameSettings;
}

// ============================================================================
// GAME SAVE (Extended for multiple slots)
// ============================================================================

/**
 * Represents a single saved game slot
 */
export interface GameSave {
  /** Unique identifier for this save (UUID or slot number) */
  id: string;

  /** Save slot number (1, 2, 3 for manual saves, 0 for autosave) */
  slotNumber: number;

  /** Timestamp when save was created (Unix ms) */
  timestamp: number;

  /** Human-readable save name (auto-generated or user-provided) */
  name: string;

  /** Type of save for filtering/display */
  saveType: 'manual' | 'auto' | 'checkpoint' | 'quicksave';

  /** Current level the player is on */
  currentLevel: LevelId;

  /** Player's current health (0-100) */
  playerHealth: number;

  /** Maximum player health */
  maxPlayerHealth: number;

  /** Player's current armor (0-100) */
  playerArmor: number;

  /** Maximum player armor */
  maxPlayerArmor: number;

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

  /** Current chapter (1-10) */
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

  // ========== NEW FIELDS FOR FULL STATE RESTORATION ==========

  /** Weapon states for all weapons */
  weaponStates: WeaponSaveState[];

  /** Currently equipped weapon slot */
  currentWeaponSlot: number;

  /** Grenade inventory */
  grenades: {
    frag: number;
    plasma: number;
    emp: number;
  };

  /** Grenade usage stats (picked up vs used) */
  grenadeStats: {
    pickedUp: { frag: number; plasma: number; emp: number };
    used: { frag: number; plasma: number; emp: number };
  };

  /** Collected skulls */
  collectedSkulls: string[];

  /** Discovered audio logs */
  discoveredAudioLogs: string[];

  /** Discovered secret areas */
  discoveredSecretAreas: string[];

  /** Unlocked achievements */
  unlockedAchievements: string[];

  /** Game settings at time of save */
  savedSettings: SavedGameSettings | null;

  /** Checkpoint data for mid-level saves */
  checkpoint: {
    position: { x: number; y: number; z: number };
    rotation: number;
    timestamp: number;
  } | null;

  // ========== NEW GAME PLUS FIELDS ==========

  /** Whether this save is a New Game Plus run */
  isNewGamePlus: boolean;

  /** Current NG+ tier (0 = normal, 1 = NG+, 2 = NG++, etc.) */
  ngPlusTier: number;

  /** Total campaign completions across all saves */
  campaignCompletions: number;

  /** Weapons unlocked through NG+ progression */
  ngPlusUnlockedWeapons: WeaponId[];

  /** Skulls unlocked through NG+ progression */
  ngPlusUnlockedSkulls: SkullId[];

  /** NG+ exclusive skulls discovered */
  ngPlusExclusiveSkulls: string[];

  /** Highest NG+ tier completed */
  highestNgPlusTierCompleted: number;
}

/**
 * Metadata for save slot display (list view)
 */
export interface GameSaveMetadata {
  id: string;
  slotNumber: number;
  timestamp: number;
  name: string;
  saveType: 'manual' | 'auto' | 'checkpoint' | 'quicksave';
  currentLevel: LevelId;
  currentChapter: number;
  playTime: number;
  levelsCompleted: number;
  difficulty: DifficultyLevel;
  playerHealth: number;
  playerArmor: number;
  /** Whether this is a New Game Plus save */
  isNewGamePlus: boolean;
  /** NG+ tier (0 = normal) */
  ngPlusTier: number;
}

/**
 * Number of manual save slots available
 */
export const MAX_SAVE_SLOTS = 3;

/**
 * Special slot numbers
 */
export const SAVE_SLOT_AUTOSAVE = 0;
export const SAVE_SLOT_QUICKSAVE = -1;

/**
 * Current save format version
 * Increment when breaking changes are made to GameSave interface
 * v2: Added difficulty field
 * v3: Added seenIntroBriefing field
 * v4: Added levelBestTimes field
 * v5: Added quest chain state (completedQuests, activeQuests, failedQuests)
 * v6: Added full player state (weapons, armor, grenades), collectibles, achievements, settings
 * v7: Added New Game Plus state
 */
export const SAVE_FORMAT_VERSION = 7;

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

/**
 * Default weapon states for a new game
 */
const DEFAULT_WEAPON_STATES: WeaponSaveState[] = [
  { weaponId: 'rifle', currentAmmo: 30, reserveAmmo: 90, unlocked: true },
  { weaponId: 'shotgun', currentAmmo: 0, reserveAmmo: 0, unlocked: false },
  { weaponId: 'pistol', currentAmmo: 12, reserveAmmo: 36, unlocked: true },
];

/**
 * Default grenade inventory (normal difficulty)
 */
const DEFAULT_GRENADES = {
  frag: 2,
  plasma: 1,
  emp: 1,
};

/**
 * Default grenade counts per difficulty
 */
const GRENADES_BY_DIFFICULTY: Record<DifficultyLevel, { frag: number; plasma: number; emp: number }> = {
  easy: { frag: 3, plasma: 2, emp: 2 },
  normal: { frag: 2, plasma: 1, emp: 1 },
  hard: { frag: 1, plasma: 1, emp: 0 },
  nightmare: { frag: 1, plasma: 0, emp: 0 },
};

/**
 * Default grenade stats
 */
const DEFAULT_GRENADE_STATS = {
  pickedUp: { frag: 0, plasma: 0, emp: 0 },
  used: { frag: 0, plasma: 0, emp: 0 },
};

/**
 * Create a new empty save with default values
 * @param id - Save slot ID
 * @param difficulty - Difficulty level
 * @param startLevel - Starting level (defaults to 'anchor_station')
 * @param slotNumber - Save slot number (0 = autosave, 1-3 = manual, -1 = quicksave)
 * @param saveType - Type of save
 */
export function createNewSave(
  id: string,
  difficulty: DifficultyLevel = 'normal',
  startLevel: LevelId = 'anchor_station',
  slotNumber: number = SAVE_SLOT_AUTOSAVE,
  saveType: 'manual' | 'auto' | 'checkpoint' | 'quicksave' = 'auto'
): GameSave {
  // Get chapter from level mapping
  const chapter = LEVEL_CHAPTERS[startLevel] ?? 1;

  return {
    id,
    slotNumber,
    timestamp: Date.now(),
    name: generateSaveName(saveType),
    saveType,
    currentLevel: startLevel,
    playerHealth: 100,
    maxPlayerHealth: 100,
    playerArmor: 0,
    maxPlayerArmor: 100,
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
    // New v6 fields
    weaponStates: [...DEFAULT_WEAPON_STATES],
    currentWeaponSlot: 0,
    grenades: { ...GRENADES_BY_DIFFICULTY[difficulty] },
    grenadeStats: { ...DEFAULT_GRENADE_STATS, pickedUp: { frag: 0, plasma: 0, emp: 0 }, used: { frag: 0, plasma: 0, emp: 0 } },
    collectedSkulls: [],
    discoveredAudioLogs: [],
    discoveredSecretAreas: [],
    unlockedAchievements: [],
    savedSettings: null,
    checkpoint: null,
    // New v7 fields - New Game Plus
    isNewGamePlus: false,
    ngPlusTier: 0,
    campaignCompletions: 0,
    ngPlusUnlockedWeapons: [],
    ngPlusUnlockedSkulls: [],
    ngPlusExclusiveSkulls: [],
    highestNgPlusTierCompleted: 0,
  };
}

/**
 * Generate a default save name based on current date/time and save type
 */
function generateSaveName(saveType: 'manual' | 'auto' | 'checkpoint' | 'quicksave' = 'manual'): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${month}/${day} ${hours}:${minutes}`;

  switch (saveType) {
    case 'auto':
      return `Autosave - ${timestamp}`;
    case 'checkpoint':
      return `Checkpoint - ${timestamp}`;
    case 'quicksave':
      return `Quicksave - ${timestamp}`;
    default:
      return `Save ${timestamp}`;
  }
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
    slotNumber: save.slotNumber ?? SAVE_SLOT_AUTOSAVE,
    timestamp: save.timestamp,
    name: save.name,
    saveType: save.saveType ?? 'auto',
    currentLevel: save.currentLevel,
    currentChapter: save.currentChapter,
    playTime: save.playTime,
    levelsCompleted: save.levelsCompleted.length,
    difficulty: save.difficulty ?? 'normal',
    playerHealth: save.playerHealth,
    playerArmor: save.playerArmor ?? 0,
    isNewGamePlus: save.isNewGamePlus ?? false,
    ngPlusTier: save.ngPlusTier ?? 0,
  };
}

/**
 * Convert a GameSave to the SaveState format for export/cloud sync
 */
export function toSaveState(save: GameSave): SaveState {
  return {
    version: save.version,
    timestamp: save.timestamp,
    campaign: {
      currentLevel: save.currentLevel,
      completedLevels: [...save.levelsCompleted],
      difficulty: save.difficulty,
      playTime: save.playTime,
    },
    player: {
      health: save.playerHealth,
      maxHealth: save.maxPlayerHealth,
      armor: save.playerArmor ?? 0,
      maxArmor: save.maxPlayerArmor ?? 100,
      weapons: save.weaponStates ?? [],
      currentWeaponSlot: save.currentWeaponSlot ?? 0,
      grenades: save.grenades ?? { frag: 2, plasma: 1, emp: 1 },
      checkpointPosition: save.checkpoint?.position ?? null,
      checkpointRotation: save.checkpoint?.rotation ?? null,
    },
    collectibles: {
      skulls: save.collectedSkulls ?? [],
      audioLogs: save.discoveredAudioLogs ?? [],
      secretAreas: save.discoveredSecretAreas ?? [],
    },
    achievements: save.unlockedAchievements ?? [],
    settings: save.savedSettings ?? {
      masterVolume: 1.0,
      musicVolume: 0.5,
      sfxVolume: 0.7,
      mouseSensitivity: 1.0,
      invertMouseY: false,
      fieldOfView: 90,
      showHitmarkers: true,
    },
  };
}

/**
 * Convert a SaveState back to GameSave format (for import/cloud sync)
 */
export function fromSaveState(
  state: SaveState,
  id: string,
  slotNumber: number = SAVE_SLOT_AUTOSAVE,
  saveType: 'manual' | 'auto' | 'checkpoint' | 'quicksave' = 'auto'
): GameSave {
  const baseSave = createNewSave(
    id,
    state.campaign.difficulty,
    state.campaign.currentLevel,
    slotNumber,
    saveType
  );

  return {
    ...baseSave,
    version: state.version,
    timestamp: state.timestamp,
    playTime: state.campaign.playTime,
    levelsCompleted: [...state.campaign.completedLevels],
    levelsVisited: [...state.campaign.completedLevels], // Visited at least what's completed
    playerHealth: state.player.health,
    maxPlayerHealth: state.player.maxHealth,
    playerArmor: state.player.armor,
    maxPlayerArmor: state.player.maxArmor,
    weaponStates: [...state.player.weapons],
    currentWeaponSlot: state.player.currentWeaponSlot,
    grenades: { ...state.player.grenades },
    checkpoint: state.player.checkpointPosition
      ? {
          position: state.player.checkpointPosition,
          rotation: state.player.checkpointRotation ?? 0,
          timestamp: state.timestamp,
        }
      : null,
    collectedSkulls: [...state.collectibles.skulls],
    discoveredAudioLogs: [...state.collectibles.audioLogs],
    discoveredSecretAreas: [...state.collectibles.secretAreas],
    unlockedAchievements: [...state.achievements],
    savedSettings: { ...state.settings },
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
