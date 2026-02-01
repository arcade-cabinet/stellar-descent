/**
 * DifficultyRegistry - Single source of truth for difficulty presets
 *
 * Similar to LevelRegistry, this provides static difficulty definitions.
 * Runtime state (current difficulty, permadeath toggle) is managed by useDifficultyStore.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Available difficulty levels
 */
export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'nightmare' | 'ultra_nightmare';

/**
 * Difficulty modifiers that affect gameplay
 */
export interface DifficultyModifiers {
  /** Multiplier for enemy health (1.0 = 100%) */
  enemyHealthMultiplier: number;
  /** Multiplier for enemy damage output (1.0 = 100%) */
  enemyDamageMultiplier: number;
  /** Multiplier for damage received by player (1.0 = 100%) */
  playerDamageReceivedMultiplier: number;
  /** Multiplier for player health regen rate (1.0 = 100%) */
  playerHealthRegenMultiplier: number;
  /** Enemy attack speed modifier (1.0 = normal, higher = faster) */
  enemyFireRateMultiplier: number;
  /** Enemy detection range multiplier */
  enemyDetectionMultiplier: number;
  /** XP reward multiplier for kills */
  xpMultiplier: number;
  /** Enemy spawn rate multiplier */
  spawnRateMultiplier: number;
  /** Resource drop rate multiplier */
  resourceDropMultiplier: number;
  /** Forces permadeath - ultra_nightmare always true */
  forcesPermadeath: boolean;
}

/**
 * Difficulty entry in the registry
 */
export interface DifficultyEntry {
  id: DifficultyLevel;
  name: string;
  description: string;
  modifiers: DifficultyModifiers;
}

// ============================================================================
// Registry
// ============================================================================

export const DIFFICULTY_REGISTRY: Record<DifficultyLevel, DifficultyEntry> = {
  easy: {
    id: 'easy',
    name: 'EASY',
    description: 'Reduced challenge for players who want to enjoy the story.',
    modifiers: {
      enemyHealthMultiplier: 0.625,
      enemyDamageMultiplier: 0.625,
      playerDamageReceivedMultiplier: 0.75,
      playerHealthRegenMultiplier: 1.5,
      enemyFireRateMultiplier: 0.8,
      enemyDetectionMultiplier: 0.8,
      xpMultiplier: 0.75,
      spawnRateMultiplier: 0.8,
      resourceDropMultiplier: 1.3,
      forcesPermadeath: false,
    },
  },
  normal: {
    id: 'normal',
    name: 'NORMAL',
    description: 'Standard combat experience. The way the game was designed.',
    modifiers: {
      enemyHealthMultiplier: 1.0,
      enemyDamageMultiplier: 1.0,
      playerDamageReceivedMultiplier: 1.0,
      playerHealthRegenMultiplier: 1.0,
      enemyFireRateMultiplier: 1.0,
      enemyDetectionMultiplier: 1.0,
      xpMultiplier: 1.0,
      spawnRateMultiplier: 1.0,
      resourceDropMultiplier: 1.0,
      forcesPermadeath: false,
    },
  },
  hard: {
    id: 'hard',
    name: 'HARD',
    description: 'For experienced drop troopers. +25% XP bonus.',
    modifiers: {
      enemyHealthMultiplier: 1.25,
      enemyDamageMultiplier: 1.39,
      playerDamageReceivedMultiplier: 1.4,
      playerHealthRegenMultiplier: 0.7,
      enemyFireRateMultiplier: 1.2,
      enemyDetectionMultiplier: 1.2,
      xpMultiplier: 1.25,
      spawnRateMultiplier: 1.2,
      resourceDropMultiplier: 0.8,
      forcesPermadeath: false,
    },
  },
  nightmare: {
    id: 'nightmare',
    name: 'NIGHTMARE',
    description: 'Only the most elite survive. +50% XP bonus.',
    modifiers: {
      enemyHealthMultiplier: 1.625,
      enemyDamageMultiplier: 1.95,
      playerDamageReceivedMultiplier: 2.0,
      playerHealthRegenMultiplier: 0.3,
      enemyFireRateMultiplier: 1.5,
      enemyDetectionMultiplier: 1.5,
      xpMultiplier: 1.5,
      spawnRateMultiplier: 1.5,
      resourceDropMultiplier: 0.6,
      forcesPermadeath: false,
    },
  },
  ultra_nightmare: {
    id: 'ultra_nightmare',
    name: 'ULTRA-NIGHTMARE',
    description: 'One death ends your campaign. No mercy. +100% XP bonus.',
    modifiers: {
      enemyHealthMultiplier: 2.0,
      enemyDamageMultiplier: 2.5,
      playerDamageReceivedMultiplier: 2.5,
      playerHealthRegenMultiplier: 0.0,
      enemyFireRateMultiplier: 1.75,
      enemyDetectionMultiplier: 2.0,
      xpMultiplier: 2.0,
      spawnRateMultiplier: 1.75,
      resourceDropMultiplier: 0.4,
      forcesPermadeath: true,
    },
  },
};

// ============================================================================
// Accessor Functions
// ============================================================================

/** Order of difficulty levels for UI display */
export const DIFFICULTY_ORDER: DifficultyLevel[] = [
  'easy',
  'normal',
  'hard',
  'nightmare',
  'ultra_nightmare',
];

/** Default difficulty level */
export const DEFAULT_DIFFICULTY: DifficultyLevel = 'normal';

/** XP bonus multiplier when permadeath is enabled */
export const PERMADEATH_XP_BONUS = 0.5;

/** Get difficulty entry by ID */
export function getDifficulty(id: DifficultyLevel): DifficultyEntry {
  return DIFFICULTY_REGISTRY[id];
}

/** Get modifiers for a difficulty level */
export function getModifiers(id: DifficultyLevel): DifficultyModifiers {
  return DIFFICULTY_REGISTRY[id].modifiers;
}

/** Check if a difficulty level is valid */
export function isValidDifficulty(value: string): value is DifficultyLevel {
  return DIFFICULTY_ORDER.includes(value as DifficultyLevel);
}

/** Check if permadeath is active for given state */
export function isPermadeathActive(difficulty: DifficultyLevel, toggleEnabled: boolean): boolean {
  return DIFFICULTY_REGISTRY[difficulty].modifiers.forcesPermadeath || toggleEnabled;
}

/** Get effective XP multiplier including permadeath bonus */
export function getEffectiveXPMultiplier(difficulty: DifficultyLevel, permadeathEnabled: boolean): number {
  const base = DIFFICULTY_REGISTRY[difficulty].modifiers.xpMultiplier;
  const active = isPermadeathActive(difficulty, permadeathEnabled);
  const forced = DIFFICULTY_REGISTRY[difficulty].modifiers.forcesPermadeath;
  // Add permadeath bonus if active and not already forced (avoid double-dipping)
  return active && !forced ? base * (1 + PERMADEATH_XP_BONUS) : base;
}

/** Iterate through all difficulties in order */
export function* iterateDifficulties(): Generator<DifficultyEntry> {
  for (const id of DIFFICULTY_ORDER) {
    yield DIFFICULTY_REGISTRY[id];
  }
}
