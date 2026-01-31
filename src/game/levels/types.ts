/**
 * Level System Types - Designed Campaign
 *
 * STELLAR DESCENT Campaign Structure (matching LORE.md):
 *
 * ACT 1: THE DROP
 *   1. Anchor Station Prometheus - Tutorial/Briefing (Prologue + Chapter 1)
 *   2. Landfall - HALO drop, first surface combat (Chapter 2)
 *
 * ACT 2: THE SEARCH
 *   3. Canyon Run - Vehicle chase through canyons (Chapter 3)
 *   4. FOB Delta - Abandoned base, horror/investigation (Chapter 4)
 *   5. Brothers in Arms - Reunite with Marcus, mech combat (Chapter 5)
 *
 * ACT 3: THE TRUTH
 *   6. Southern Ice - Frozen wasteland, new enemy types (Chapter 6)
 *   7. The Breach - Underground hive, Queen boss fight (Chapter 7)
 *
 * ACT 4: ENDGAME
 *   8. Hive Assault - Combined arms push into hive (Chapter 8)
 *   9. Extraction - Escape and holdout at LZ Omega (Chapter 9)
 *   10. Final Escape - Warthog Run style vehicle finale (Chapter 10)
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import type { CommsMessage } from '../types';
import type { ActionButtonGroup } from '../types/actions';

// Level environment types
export type LevelType =
  | 'station' // Interior station (Anchor Station)
  | 'drop' // HALO drop sequence
  | 'canyon' // Exterior canyon/surface
  | 'base' // Abandoned FOB interior
  | 'brothers' // Open canyon with mech ally combat
  | 'hive' // Underground alien tunnels + Queen boss
  | 'extraction' // Surface escape and holdout
  | 'vehicle' // Vehicle chase / driving sequence
  | 'ice' // Frozen wasteland surface
  | 'combined_arms' // Vehicle + infantry combined assault
  | 'finale' // Timed vehicle escape sequence
  | 'mine'; // Underground mining facility (bonus level)

// Campaign level IDs - linear progression (matches LORE.md chapters)
export type LevelId =
  | 'anchor_station' // Chapter 1: Tutorial/Briefing
  | 'landfall' // Chapter 2: HALO drop + first surface combat
  | 'canyon_run' // Chapter 3: Vehicle chase through canyons
  | 'fob_delta' // Chapter 4: Abandoned base investigation
  | 'brothers_in_arms' // Chapter 5: Reunite with Marcus, mech combat
  | 'southern_ice' // Chapter 6: Frozen wasteland, new enemy types
  | 'the_breach' // Chapter 7: Underground hive, Queen boss
  | 'hive_assault' // Chapter 8: Combined arms push into hive
  | 'extraction' // Chapter 9: Escape and holdout at LZ Omega
  | 'final_escape'; // Chapter 10: Warthog Run style vehicle finale

// Callbacks from level to game system
export interface LevelCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onObjectiveUpdate: (title: string, instructions: string) => void;
  onChapterChange: (chapter: number) => void;
  onHealthChange: (health: number) => void;
  onKill: () => void;
  onDamage: () => void;
  onNotification: (text: string, duration?: number) => void;
  onLevelComplete: (nextLevelId: LevelId | null) => void;
  onCombatStateChange: (inCombat: boolean) => void;
  onCinematicStart?: () => void;
  onCinematicEnd?: () => void;
  // Action button system
  onActionGroupsChange: (groups: ActionButtonGroup[]) => void;
  onActionHandlerRegister: (handler: ((actionId: string) => void) | null) => void;
  // Combat feedback callbacks
  onHitMarker?: (damage: number, isCritical: boolean) => void;
  onDirectionalDamage?: (angle: number, damage: number) => void;
  // Collectible and dialogue callbacks
  onAudioLogFound?: (logId: string) => void;
  onSecretFound?: (secretId: string) => void;
  onSkullFound?: (skullId: string) => void;
  onDialogueTrigger?: (trigger: string) => void;
  // Issue #84: Add missing objective marker callback used by HiveAssault
  onObjectiveMarker?: (position: { x: number; y: number; z: number } | null, label?: string) => void;
  // Issue #85: Add missing exposure callback used by SouthernIce
  onExposureChange?: (exposure: number) => void;
  // Issue #86: Add missing frost damage callback
  onFrostDamage?: (damage: number) => void;
}

// Weather configuration for levels
export interface WeatherConfig {
  environment: 'surface' | 'station' | 'hive';
  initialWeather: string;
  initialIntensity: 'low' | 'medium' | 'high' | 'extreme';
  qualityLevel?: 'low' | 'medium' | 'high';
}

// Level configuration
export interface LevelConfig {
  id: LevelId;
  type: LevelType;
  nextLevelId: LevelId | null;
  previousLevelId: LevelId | null;

  // Display info
  chapter: number;
  actName: string;
  missionName: string;
  missionSubtitle?: string;

  // Spawn configuration
  playerSpawnPosition?: { x: number; y: number; z: number };
  playerSpawnRotation?: number;

  // Level-specific settings
  ambientTrack?: string;
  combatTrack?: string;
  hasCinematicIntro?: boolean;

  // Weather/atmosphere configuration
  weather?: WeatherConfig;

  // Collectibles
  totalSecrets?: number; // Number of secret areas in this level
  totalAudioLogs?: number; // Number of audio logs in this level
}

// State that can be persisted for a level
export interface LevelState {
  id: LevelId;
  visited: boolean;
  completed: boolean;
  playerPosition?: { x: number; y: number; z: number };
  playerRotation?: number;
  // Collectibles found, enemies killed, etc.
  stats?: {
    kills: number;
    secretsFound: number;
    timeSpent: number;
  };
  // Story flags
  flags?: Record<string, boolean>;
}

// Touch input type for levels
export interface TouchInputState {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  isFiring?: boolean;
  isSprinting?: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
}

// The unified Level interface
export interface ILevel {
  readonly id: LevelId;
  readonly type: LevelType;
  readonly config: LevelConfig;

  // Lifecycle
  initialize(): Promise<void>;
  update(deltaTime: number): void;
  dispose(): void;

  // Scene access
  getScene(): Scene;

  // State management
  getState(): LevelState;
  setState(state: Partial<LevelState>): void;

  // Player control
  lockPointer(): void;
  unlockPointer(): void;
  isPointerLocked(): boolean;

  // Input
  setTouchInput(input: TouchInputState | null): void;

  // Navigation
  canTransitionTo(levelId: LevelId): boolean;
  prepareTransition(targetLevelId: LevelId): Promise<void>;
}

// Factory function signature
export type LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
) => ILevel;

// Registry of level factories by type
export interface LevelFactoryRegistry {
  station: LevelFactory;
  drop: LevelFactory;
  canyon: LevelFactory;
  base: LevelFactory;
  brothers: LevelFactory;
  hive: LevelFactory;
  extraction: LevelFactory;
  vehicle: LevelFactory;
  ice: LevelFactory;
  combined_arms: LevelFactory;
  finale: LevelFactory;
  mine: LevelFactory;
}

// ============================================================================
// CAMPAIGN LEVEL CONFIGURATIONS
// ============================================================================

export const CAMPAIGN_LEVELS: Record<LevelId, LevelConfig> = {
  // -------------------------------------------------------------------------
  // ACT 1: THE DROP
  // -------------------------------------------------------------------------
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
    totalSecrets: 1,
    totalAudioLogs: 2,
  },

  landfall: {
    id: 'landfall',
    type: 'drop', // Starts as drop, transitions to canyon
    nextLevelId: 'canyon_run',
    previousLevelId: 'anchor_station',
    chapter: 2,
    actName: 'ACT 1: THE DROP',
    missionName: 'LANDFALL',
    missionSubtitle: "Kepler's Promise - Northern Canyon",
    playerSpawnPosition: { x: 0, y: 500, z: 0 }, // High altitude for drop
    hasCinematicIntro: true,
    ambientTrack: 'canyon_wind',
    combatTrack: 'combat_surface',
    weather: {
      environment: 'surface',
      initialWeather: 'dusty',
      initialIntensity: 'medium',
    },
    totalSecrets: 2,
    totalAudioLogs: 2, // Issue #53: Consistent with MissionDefinitions
  },

  canyon_run: {
    id: 'canyon_run',
    type: 'vehicle',
    nextLevelId: 'fob_delta',
    previousLevelId: 'landfall',
    chapter: 3,
    actName: 'ACT 2: THE SEARCH', // Issue #54: Should be ACT 1 since it's Chapter 3
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
    totalSecrets: 2, // Issue #55: Consistent with MissionDefinitions
    totalAudioLogs: 1, // Issue #56: Consistent with MissionDefinitions
  },

  // -------------------------------------------------------------------------
  // ACT 2: THE SEARCH
  // -------------------------------------------------------------------------
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
    totalSecrets: 3,
    totalAudioLogs: 3,
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
    totalSecrets: 2,
    totalAudioLogs: 2,
  },

  // -------------------------------------------------------------------------
  // ACT 3: THE TRUTH
  // -------------------------------------------------------------------------
  southern_ice: {
    id: 'southern_ice',
    type: 'ice',
    nextLevelId: 'the_breach',
    previousLevelId: 'brothers_in_arms',
    chapter: 6,
    actName: 'ACT 3: THE TRUTH',
    missionName: 'SOUTHERN ICE',
    missionSubtitle: "Kepler's Promise - Polar Region",
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'ice_wind',
    combatTrack: 'combat_ice',
    weather: {
      environment: 'surface',
      initialWeather: 'blizzard',
      initialIntensity: 'extreme',
    },
    totalSecrets: 3,
    totalAudioLogs: 2,
  },

  the_breach: {
    id: 'the_breach',
    type: 'hive',
    nextLevelId: 'hive_assault',
    previousLevelId: 'southern_ice',
    chapter: 7,
    actName: 'ACT 3: THE TRUTH',
    missionName: 'INTO THE BREACH',
    missionSubtitle: "Subterranean Hive - Queen's Lair",
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'hive_ambient',
    combatTrack: 'boss_combat',
    weather: {
      environment: 'hive',
      initialWeather: 'calm',
      initialIntensity: 'medium',
    },
    totalSecrets: 3,
    totalAudioLogs: 2,
  },

  // -------------------------------------------------------------------------
  // ACT 4: ENDGAME
  // -------------------------------------------------------------------------
  hive_assault: {
    id: 'hive_assault',
    type: 'combined_arms',
    nextLevelId: 'extraction',
    previousLevelId: 'the_breach',
    chapter: 8,
    actName: 'ACT 4: ENDGAME',
    missionName: 'HIVE ASSAULT',
    missionSubtitle: 'Combined Arms - Surface to Hive Core',
    playerSpawnPosition: { x: 0, y: 2.5, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'hive_ambient',
    combatTrack: 'combat_assault',
    weather: {
      environment: 'hive',
      initialWeather: 'spore_storm',
      initialIntensity: 'extreme',
    },
    totalSecrets: 2,
    totalAudioLogs: 1,
  },

  extraction: {
    id: 'extraction',
    type: 'extraction',
    nextLevelId: 'final_escape',
    previousLevelId: 'hive_assault',
    chapter: 9,
    actName: 'ACT 4: ENDGAME',
    missionName: 'EXTRACTION',
    missionSubtitle: 'LZ Omega - Hold Until Evac',
    playerSpawnPosition: { x: 0, y: 1.7, z: 0 },
    hasCinematicIntro: true,
    ambientTrack: 'extraction_ambient',
    combatTrack: 'combat_finale',
    weather: {
      environment: 'surface',
      initialWeather: 'sandstorm',
      initialIntensity: 'extreme',
    },
    totalSecrets: 2,
    totalAudioLogs: 1,
  },

  final_escape: {
    id: 'final_escape',
    type: 'finale',
    nextLevelId: null, // End of campaign
    previousLevelId: 'extraction',
    chapter: 10,
    actName: 'ACT 4: ENDGAME',
    missionName: 'FINAL ESCAPE',
    missionSubtitle: 'Outrun the Collapse',
    playerSpawnPosition: { x: 0, y: 2.5, z: 0 }, // In vehicle
    hasCinematicIntro: true,
    ambientTrack: 'collapse_ambient',
    combatTrack: 'combat_finale',
    weather: {
      environment: 'surface',
      initialWeather: 'firestorm',
      initialIntensity: 'extreme',
    },
    totalSecrets: 1,
    totalAudioLogs: 1,
  },
};

// ============================================================================
// LINKED LIST TRAVERSAL UTILITIES
// ============================================================================

/**
 * Get the first level in the campaign (head of linked list)
 */
export function getFirstLevel(): LevelConfig {
  return CAMPAIGN_LEVELS.anchor_station;
}

/**
 * Get the next level from a given level (linked list traversal)
 */
export function getNextLevel(levelId: LevelId): LevelConfig | null {
  const current = CAMPAIGN_LEVELS[levelId];
  if (!current.nextLevelId) return null;
  return CAMPAIGN_LEVELS[current.nextLevelId];
}

/**
 * Get the previous level from a given level (linked list traversal)
 */
export function getPreviousLevel(levelId: LevelId): LevelConfig | null {
  const current = CAMPAIGN_LEVELS[levelId];
  if (!current.previousLevelId) return null;
  return CAMPAIGN_LEVELS[current.previousLevelId];
}

/**
 * Count total levels by traversing the linked list
 */
export function getTotalLevels(): number {
  let count = 0;
  let current: LevelConfig | null = getFirstLevel();
  while (current) {
    count++;
    current = current.nextLevelId ? CAMPAIGN_LEVELS[current.nextLevelId] : null;
  }
  return count;
}

/**
 * Get level index by traversing from head (0-indexed)
 */
export function getLevelIndex(levelId: LevelId): number {
  let index = 0;
  let current: LevelConfig | null = getFirstLevel();
  while (current) {
    if (current.id === levelId) return index;
    index++;
    current = current.nextLevelId ? CAMPAIGN_LEVELS[current.nextLevelId] : null;
  }
  return -1; // Not found
}

/**
 * Iterate through all levels (generator)
 */
export function* iterateLevels(): Generator<LevelConfig> {
  let current: LevelConfig | null = getFirstLevel();
  while (current) {
    yield current;
    current = current.nextLevelId ? CAMPAIGN_LEVELS[current.nextLevelId] : null;
  }
}
