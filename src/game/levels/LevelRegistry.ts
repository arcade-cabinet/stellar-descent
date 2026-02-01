/**
 * LevelRegistry - Single source of truth for all level data
 *
 * This module consolidates what was previously split between:
 * - CAMPAIGN_LEVELS (levels/types.ts) - level config, spawn, audio, weather
 * - MISSION_DEFINITIONS (campaign/MissionDefinitions.ts) - objectives, collectibles
 *
 * All level data is now defined in one place to prevent drift and duplication.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Level type determines which factory creates the level
 */
export type LevelType =
  | 'station' // Orbital station (tutorial)
  | 'drop' // HALO drop sequence
  | 'canyon' // Surface canyon exploration
  | 'vehicle' // Vehicle-focused level
  | 'base' // Military base investigation
  | 'brothers' // Marcus reunion level
  | 'ice' // Frozen wasteland
  | 'hive' // Underground hive
  | 'boss' // Boss fight level
  | 'assault' // Combined arms assault
  | 'extraction' // Holdout/extraction
  | 'escape' // Timed escape sequence
  | 'combined_arms' // Vehicle + infantry (maps to assault factory)
  | 'finale' // Timed escape (maps to escape factory)
  | 'mine'; // Mining facility (bonus level)

/**
 * All valid level IDs in the campaign
 */
export type LevelId =
  | 'anchor_station'
  | 'landfall'
  | 'canyon_run'
  | 'fob_delta'
  | 'brothers_in_arms'
  | 'southern_ice'
  | 'the_breach'
  | 'hive_assault'
  | 'extraction'
  | 'final_escape';

/**
 * Weather/atmosphere configuration
 */
export interface WeatherConfig {
  environment: 'station' | 'surface' | 'underground' | 'ice';
  initialWeather: 'normal' | 'dusty' | 'damaged' | 'dust_storm' | 'blizzard' | 'spore';
  initialIntensity: 'low' | 'medium' | 'high';
}

/**
 * Mission objective definition
 */
export interface MissionObjective {
  id: string;
  description: string;
  type: 'primary' | 'optional';
}

/**
 * Unified level entry containing ALL level data
 */
export interface LevelEntry {
  // ---- Identity ----
  id: LevelId;
  type: LevelType;

  // ---- Linked List (campaign progression) ----
  nextLevelId: LevelId | null;
  previousLevelId: LevelId | null;

  // ---- Display Info ----
  chapter: number;
  actName: string;
  missionName: string;
  missionSubtitle?: string;

  // ---- Spawn Configuration ----
  playerSpawnPosition: { x: number; y: number; z: number };
  playerSpawnRotation?: number;

  // ---- Audio/Visual ----
  ambientTrack?: string;
  combatTrack?: string;
  hasCinematicIntro: boolean;

  // ---- Weather/Atmosphere ----
  weather: WeatherConfig;

  // ---- Mission Objectives ----
  objectives: MissionObjective[];

  // ---- Vehicles Available ----
  vehicleIds?: string[];

  // ---- Dialogue System ----
  dialogueTriggers?: string[];

  // ---- Collectibles (SINGLE SOURCE OF TRUTH) ----
  totalSecrets: number;
  totalAudioLogs: number;

  // ---- Special Features ----
  skullId?: string;
  hasBonusAccess?: string; // e.g., 'mining_depths'
  parTimeSeconds?: number;
  bossId?: string;
}

// ============================================================================
// LEVEL REGISTRY - Single source of truth for all 10 campaign levels
// ============================================================================

export const LEVEL_REGISTRY: Record<LevelId, LevelEntry> = {
  // =========================================================================
  // ACT 1: THE DROP (Chapters 1-3)
  // =========================================================================

  anchor_station: {
    id: 'anchor_station',
    type: 'station',
    nextLevelId: 'landfall',
    previousLevelId: null,
    chapter: 1,
    actName: 'ACT 1: THE DROP',
    missionName: 'ANCHOR STATION PROMETHEUS',
    missionSubtitle: 'Prep Bay 7',
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    playerSpawnRotation: Math.PI,
    ambientTrack: 'station_ambient',
    hasCinematicIntro: false,
    weather: {
      environment: 'station',
      initialWeather: 'normal',
      initialIntensity: 'low',
    },
    objectives: [
      { id: 'tutorial_movement', description: 'Complete movement training', type: 'primary' },
      { id: 'tutorial_combat', description: 'Complete combat training', type: 'primary' },
      { id: 'tutorial_interact', description: 'Board the drop pod', type: 'primary' },
      { id: 'explore_barracks', description: 'Explore the barracks', type: 'optional' },
    ],
    dialogueTriggers: [
      'tutorial_start',
      'tutorial_movement',
      'tutorial_combat',
      'tutorial_complete',
    ],
    totalSecrets: 1,
    totalAudioLogs: 2,
    skullId: 'skull_iron',
  },

  landfall: {
    id: 'landfall',
    type: 'drop',
    nextLevelId: 'canyon_run',
    previousLevelId: 'anchor_station',
    chapter: 2,
    actName: 'ACT 1: THE DROP',
    missionName: 'LANDFALL',
    missionSubtitle: "Kepler's Promise - Northern Canyon",
    playerSpawnPosition: { x: 0, y: 500, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'canyon_wind',
    combatTrack: 'combat_surface',
    weather: {
      environment: 'surface',
      initialWeather: 'dusty',
      initialIntensity: 'medium',
    },
    objectives: [
      { id: 'survive_drop', description: 'Survive orbital drop', type: 'primary' },
      { id: 'reach_surface', description: 'Reach the surface', type: 'primary' },
      { id: 'clear_lz', description: 'Clear the landing zone', type: 'primary' },
      { id: 'find_beacon', description: 'Locate FOB Delta beacon', type: 'optional' },
    ],
    dialogueTriggers: ['drop_start', 'hostiles_detected', 'lz_clear'],
    totalSecrets: 2,
    totalAudioLogs: 2,
    parTimeSeconds: 300,
  },

  canyon_run: {
    id: 'canyon_run',
    type: 'vehicle',
    nextLevelId: 'fob_delta',
    previousLevelId: 'landfall',
    chapter: 3,
    actName: 'ACT 1: THE DROP',
    missionName: 'CANYON RUN',
    missionSubtitle: "Kepler's Promise - Southern Rift Valley",
    playerSpawnPosition: { x: 0, y: 2, z: 0 },
    playerSpawnRotation: 0,
    hasCinematicIntro: true,
    ambientTrack: 'canyon_wind',
    combatTrack: 'combat_vehicle',
    weather: {
      environment: 'surface',
      initialWeather: 'dusty',
      initialIntensity: 'high',
    },
    objectives: [
      { id: 'reach_fob', description: 'Reach FOB Delta through the canyon', type: 'primary' },
      { id: 'survive_pursuit', description: 'Survive the Wraith pursuit', type: 'primary' },
      { id: 'destroy_roadblocks', description: 'Destroy alien roadblocks (0/3)', type: 'optional' },
    ],
    vehicleIds: ['wraith_tank'],
    dialogueTriggers: ['canyon_entry', 'wraith_spotted', 'canyon_exit'],
    totalSecrets: 2,
    totalAudioLogs: 1,
    skullId: 'skull_famine',
    parTimeSeconds: 240,
  },

  // =========================================================================
  // ACT 2: THE SEARCH (Chapters 4-6)
  // =========================================================================

  fob_delta: {
    id: 'fob_delta',
    type: 'base',
    nextLevelId: 'brothers_in_arms',
    previousLevelId: 'canyon_run',
    chapter: 4,
    actName: 'ACT 2: THE SEARCH',
    missionName: 'FOB DELTA',
    missionSubtitle: 'Forward Operating Base - Abandoned',
    playerSpawnPosition: { x: 0, y: 1.7, z: -5 },
    hasCinematicIntro: true,
    ambientTrack: 'horror_ambient',
    combatTrack: 'combat_interior',
    weather: {
      environment: 'station',
      initialWeather: 'damaged',
      initialIntensity: 'medium',
    },
    objectives: [
      { id: 'investigate_fob', description: 'Investigate FOB Delta', type: 'primary' },
      { id: 'restore_power', description: 'Restore power to the base', type: 'primary' },
      { id: 'find_intel', description: 'Find VANGUARD team intel', type: 'primary' },
      { id: 'mining_outpost', description: 'Access Mining Outpost Gamma-7', type: 'optional' },
    ],
    dialogueTriggers: [
      'fob_entry',
      'fob_delta_lights_out',
      'power_restored',
      'intel_found',
      'hive_entrance_found',
    ],
    totalSecrets: 3,
    totalAudioLogs: 3,
    skullId: 'skull_mythic',
    hasBonusAccess: 'mining_depths',
    parTimeSeconds: 480,
  },

  brothers_in_arms: {
    id: 'brothers_in_arms',
    type: 'brothers',
    nextLevelId: 'southern_ice',
    previousLevelId: 'fob_delta',
    chapter: 5,
    actName: 'ACT 2: THE SEARCH',
    missionName: 'BROTHERS IN ARMS',
    missionSubtitle: 'Reunion with Corporal Marcus Cole',
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'canyon_wind',
    combatTrack: 'combat_mech',
    weather: {
      environment: 'surface',
      initialWeather: 'dust_storm',
      initialIntensity: 'high',
    },
    objectives: [
      { id: 'find_marcus', description: 'Locate Corporal Marcus Cole', type: 'primary' },
      { id: 'defend_position', description: 'Defend position with Marcus', type: 'primary' },
      { id: 'reach_extraction', description: 'Reach extraction point', type: 'primary' },
      { id: 'investigate_sinkhole', description: 'Investigate the sinkhole', type: 'optional' },
    ],
    dialogueTriggers: ['marcus_found', 'combat_start', 'sinkhole_discovered'],
    totalSecrets: 2,
    totalAudioLogs: 2,
    skullId: 'skull_thunderstorm',
    parTimeSeconds: 600,
  },

  southern_ice: {
    id: 'southern_ice',
    type: 'ice',
    nextLevelId: 'the_breach',
    previousLevelId: 'brothers_in_arms',
    chapter: 6,
    actName: 'ACT 2: THE SEARCH',
    missionName: 'SOUTHERN ICE',
    missionSubtitle: 'Frozen Wasteland',
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'ice_wind',
    combatTrack: 'combat_ice',
    weather: {
      environment: 'ice',
      initialWeather: 'blizzard',
      initialIntensity: 'medium',
    },
    objectives: [
      { id: 'traverse_ice', description: 'Traverse the frozen wasteland', type: 'primary' },
      { id: 'find_outpost', description: 'Find the abandoned outpost', type: 'primary' },
      { id: 'survive_blizzard', description: 'Survive the blizzard', type: 'primary' },
      { id: 'ice_cave_exploration', description: 'Explore the ice caves', type: 'optional' },
    ],
    dialogueTriggers: ['ice_entry', 'outpost_found', 'blizzard_start', 'cave_entrance'],
    totalSecrets: 3,
    totalAudioLogs: 2,
    skullId: 'skull_blind',
    parTimeSeconds: 540,
  },

  // =========================================================================
  // ACT 3: THE BREACH (Chapters 7-10)
  // =========================================================================

  the_breach: {
    id: 'the_breach',
    type: 'boss',
    nextLevelId: 'hive_assault',
    previousLevelId: 'southern_ice',
    chapter: 7,
    actName: 'ACT 3: THE BREACH',
    missionName: 'THE BREACH',
    missionSubtitle: "Queen's Lair",
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'hive_ambient',
    combatTrack: 'combat_boss',
    weather: {
      environment: 'underground',
      initialWeather: 'spore',
      initialIntensity: 'high',
    },
    objectives: [
      { id: 'enter_hive', description: 'Enter the hive', type: 'primary' },
      { id: 'reach_queen', description: "Reach the Queen's chamber", type: 'primary' },
      { id: 'defeat_queen', description: 'Defeat the Chitin Queen', type: 'primary' },
      { id: 'find_hive_core', description: 'Find the hive core sample', type: 'optional' },
    ],
    dialogueTriggers: ['hive_entry', 'queen_chamber', 'queen_defeated'],
    totalSecrets: 3,
    totalAudioLogs: 2,
    skullId: 'skull_anger',
    bossId: 'chitin_queen',
    parTimeSeconds: 720,
  },

  hive_assault: {
    id: 'hive_assault',
    type: 'assault',
    nextLevelId: 'extraction',
    previousLevelId: 'the_breach',
    chapter: 8,
    actName: 'ACT 3: THE BREACH',
    missionName: 'HIVE ASSAULT',
    missionSubtitle: 'Combined Arms Operation',
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'assault_ambient',
    combatTrack: 'combat_assault',
    weather: {
      environment: 'surface',
      initialWeather: 'dusty',
      initialIntensity: 'high',
    },
    objectives: [
      { id: 'assault_surface', description: 'Lead the surface assault', type: 'primary' },
      { id: 'breach_hive', description: 'Breach the hive entrance', type: 'primary' },
      { id: 'destroy_nexus', description: 'Destroy nexus nodes (0/3)', type: 'primary' },
      { id: 'rescue_marines', description: 'Rescue trapped marines', type: 'optional' },
    ],
    vehicleIds: ['wraith_tank', 'phantom_dropship'],
    dialogueTriggers: ['assault_begin', 'hive_breach', 'nexus_destroyed', 'marines_found'],
    totalSecrets: 2,
    totalAudioLogs: 1,
    skullId: 'skull_catch',
    parTimeSeconds: 900,
  },

  extraction: {
    id: 'extraction',
    type: 'extraction',
    nextLevelId: 'final_escape',
    previousLevelId: 'hive_assault',
    chapter: 9,
    actName: 'ACT 3: THE BREACH',
    missionName: 'EXTRACTION',
    missionSubtitle: 'LZ Omega',
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'extraction_ambient',
    combatTrack: 'combat_extraction',
    weather: {
      environment: 'underground',
      initialWeather: 'spore',
      initialIntensity: 'medium',
    },
    objectives: [
      { id: 'escape_hive', description: 'Escape the collapsing hive', type: 'primary' },
      { id: 'reach_lz', description: 'Reach LZ Omega', type: 'primary' },
      { id: 'hold_lz', description: 'Hold LZ Omega until extraction', type: 'primary' },
      { id: 'save_all_squad', description: 'Keep all squad members alive', type: 'optional' },
    ],
    vehicleIds: ['phantom_dropship'],
    dialogueTriggers: [
      'extraction_start',
      'extraction_countdown',
      'lz_reached',
      'mission_complete',
    ],
    totalSecrets: 2,
    totalAudioLogs: 1,
    skullId: 'skull_grunt',
    parTimeSeconds: 360,
  },

  final_escape: {
    id: 'final_escape',
    type: 'escape',
    nextLevelId: null,
    previousLevelId: 'extraction',
    chapter: 10,
    actName: 'ACT 3: THE BREACH',
    missionName: 'FINAL ESCAPE',
    missionSubtitle: 'Outrun the Collapse',
    playerSpawnPosition: { x: 0, y: 2, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'escape_ambient',
    combatTrack: 'combat_escape',
    weather: {
      environment: 'surface',
      initialWeather: 'dust_storm',
      initialIntensity: 'high',
    },
    objectives: [
      { id: 'outrun_collapse', description: 'Outrun the terrain collapse', type: 'primary' },
      { id: 'reach_dropship', description: 'Reach the Phantom dropship', type: 'primary' },
      { id: 'no_casualties', description: 'Complete with no casualties', type: 'optional' },
    ],
    vehicleIds: ['phantom_dropship'],
    dialogueTriggers: ['escape_start', 'terrain_collapsing', 'dropship_inbound', 'escape_complete'],
    totalSecrets: 1,
    totalAudioLogs: 1,
    parTimeSeconds: 180,
  },
};

// ============================================================================
// BONUS LEVELS (not in main campaign linked list)
// ============================================================================

export interface BonusLevelEntry {
  id: string;
  displayName: string;
  type: LevelType;
  returnLevelId: LevelId;
  totalSecrets: number;
  totalAudioLogs: number;
  skullId?: string;
}

export const BONUS_LEVELS: Record<string, BonusLevelEntry> = {
  mining_depths: {
    id: 'mining_depths',
    displayName: 'Mining Depths',
    type: 'base',
    returnLevelId: 'fob_delta',
    totalSecrets: 3,
    totalAudioLogs: 2,
    skullId: 'skull_cowbell',
  },
};

// ============================================================================
// ACCESSOR FUNCTIONS
// ============================================================================

/**
 * Get level entry by ID (type-safe)
 */
export function getLevel(levelId: LevelId): LevelEntry {
  return LEVEL_REGISTRY[levelId];
}

/**
 * Get all level IDs in campaign order
 */
export function getLevelIds(): LevelId[] {
  return Object.keys(LEVEL_REGISTRY) as LevelId[];
}

/**
 * Get the first level of the campaign
 */
export function getFirstLevel(): LevelEntry {
  return LEVEL_REGISTRY.anchor_station;
}

/**
 * Get the next level from a given level (linked list traversal)
 */
export function getNextLevel(levelId: LevelId): LevelEntry | null {
  const current = LEVEL_REGISTRY[levelId];
  if (!current.nextLevelId) return null;
  return LEVEL_REGISTRY[current.nextLevelId];
}

/**
 * Get the previous level from a given level (linked list traversal)
 */
export function getPreviousLevel(levelId: LevelId): LevelEntry | null {
  const current = LEVEL_REGISTRY[levelId];
  if (!current.previousLevelId) return null;
  return LEVEL_REGISTRY[current.previousLevelId];
}

/**
 * Count total levels in the campaign
 */
export function getLevelCount(): number {
  return Object.keys(LEVEL_REGISTRY).length;
}

/**
 * Get the index of a level in the campaign (0-based)
 */
export function getLevelIndex(levelId: LevelId): number {
  let current: LevelEntry | null = getFirstLevel();
  let index = 0;
  while (current) {
    if (current.id === levelId) return index;
    current = current.nextLevelId ? LEVEL_REGISTRY[current.nextLevelId] : null;
    index++;
  }
  return -1;
}

/**
 * Get total audio log count across all campaign levels
 */
export function getTotalAudioLogCount(): number {
  return Object.values(LEVEL_REGISTRY).reduce((total, level) => total + level.totalAudioLogs, 0);
}

/**
 * Get total secret count across all campaign levels
 */
export function getTotalSecretCount(): number {
  return Object.values(LEVEL_REGISTRY).reduce((total, level) => total + level.totalSecrets, 0);
}

/**
 * Get total skull count across all campaign levels
 */
export function getTotalSkullCount(): number {
  return Object.values(LEVEL_REGISTRY).filter((level) => level.skullId !== undefined).length;
}

/**
 * Iterate through all levels in campaign order
 */
export function* iterateLevels(): Generator<LevelEntry> {
  let current: LevelEntry | null = getFirstLevel();
  while (current) {
    yield current;
    current = current.nextLevelId ? LEVEL_REGISTRY[current.nextLevelId] : null;
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY
// Re-export types and constants for gradual migration
// ============================================================================

// For backward compat with code that imports from levels/types.ts
export { LEVEL_REGISTRY as CAMPAIGN_LEVELS };

// For backward compat with code that imports MissionDefinition
export type MissionDefinition = Pick<
  LevelEntry,
  | 'objectives'
  | 'vehicleIds'
  | 'dialogueTriggers'
  | 'totalAudioLogs'
  | 'totalSecrets'
  | 'skullId'
  | 'hasBonusAccess'
  | 'parTimeSeconds'
  | 'bossId'
> & { levelId: LevelId; audioLogCount: number; secretCount: number };

/**
 * Get mission definition (backward compat)
 * @deprecated Use getLevel() instead
 */
export function getMissionDefinition(levelId: LevelId): MissionDefinition {
  const level = LEVEL_REGISTRY[levelId];
  return {
    levelId: level.id,
    objectives: level.objectives,
    vehicleIds: level.vehicleIds,
    dialogueTriggers: level.dialogueTriggers,
    audioLogCount: level.totalAudioLogs, // Backward compat field
    secretCount: level.totalSecrets, // Backward compat field
    totalAudioLogs: level.totalAudioLogs,
    totalSecrets: level.totalSecrets,
    skullId: level.skullId,
    hasBonusAccess: level.hasBonusAccess,
    parTimeSeconds: level.parTimeSeconds,
    bossId: level.bossId,
  };
}

// For backward compat - create MISSION_DEFINITIONS view from registry
export const MISSION_DEFINITIONS: Record<LevelId, MissionDefinition> = Object.fromEntries(
  getLevelIds().map((id) => [id, getMissionDefinition(id)])
) as Record<LevelId, MissionDefinition>;

// Type alias for backward compat
export type { LevelEntry as LevelConfig };
