/**
 * DifficultySettings - Manages game difficulty configuration
 *
 * Provides difficulty levels and modifiers for:
 * - Enemy health scaling
 * - Enemy damage scaling
 * - Player damage taken scaling
 * - Spawn rates
 * - Resource drops
 * - XP rewards
 */

/**
 * Available difficulty levels
 */
export type DifficultyLevel = 'normal' | 'veteran' | 'legendary';

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
  /** Enemy attack speed modifier (1.0 = normal, higher = faster attacks) */
  enemyFireRateMultiplier: number;
  /** Enemy detection range multiplier */
  enemyDetectionMultiplier: number;
  /** XP reward multiplier for kills */
  xpMultiplier: number;
  /** Enemy spawn rate multiplier (1.0 = normal, higher = more enemies) */
  spawnRateMultiplier: number;
  /** Resource drop rate multiplier (1.0 = normal, lower = fewer resources) */
  resourceDropMultiplier: number;
}

/**
 * Display information for a difficulty level
 */
export interface DifficultyInfo {
  id: DifficultyLevel;
  name: string;
  description: string;
  modifiers: DifficultyModifiers;
}

/**
 * Difficulty presets with their modifiers
 */
export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyInfo> = {
  normal: {
    id: 'normal',
    name: 'NORMAL',
    description:
      'Standard combat experience. Balanced for challenge and progression. The way the game was designed to be played.',
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
    },
  },
  veteran: {
    id: 'veteran',
    name: 'VETERAN',
    description:
      'For experienced drop troopers. Enemies are stronger, faster, and more numerous. +25% XP bonus.',
    modifiers: {
      enemyHealthMultiplier: 1.4,
      enemyDamageMultiplier: 1.5,
      playerDamageReceivedMultiplier: 1.5,
      playerHealthRegenMultiplier: 0.7,
      enemyFireRateMultiplier: 1.3,
      enemyDetectionMultiplier: 1.2,
      xpMultiplier: 1.25,
      spawnRateMultiplier: 1.2,
      resourceDropMultiplier: 0.8,
    },
  },
  legendary: {
    id: 'legendary',
    name: 'LEGENDARY',
    description:
      'Only the most elite survive. Enemies are lethal and relentless. +50% XP bonus. Glory awaits.',
    modifiers: {
      enemyHealthMultiplier: 2.0,
      enemyDamageMultiplier: 2.0,
      playerDamageReceivedMultiplier: 2.0,
      playerHealthRegenMultiplier: 0.3,
      enemyFireRateMultiplier: 1.5,
      enemyDetectionMultiplier: 1.5,
      xpMultiplier: 1.5,
      spawnRateMultiplier: 1.5,
      resourceDropMultiplier: 0.6,
    },
  },
};

/**
 * Default difficulty level
 */
export const DEFAULT_DIFFICULTY: DifficultyLevel = 'normal';

/**
 * Order of difficulty levels for UI display
 */
export const DIFFICULTY_ORDER: DifficultyLevel[] = ['normal', 'veteran', 'legendary'];

/**
 * LocalStorage key for persisting difficulty setting
 */
const DIFFICULTY_STORAGE_KEY = 'stellar_descent_difficulty';

/**
 * Get the modifiers for a given difficulty level
 */
export function getDifficultyModifiers(difficulty: DifficultyLevel): DifficultyModifiers {
  return DIFFICULTY_PRESETS[difficulty].modifiers;
}

/**
 * Get the display info for a difficulty level
 */
export function getDifficultyInfo(difficulty: DifficultyLevel): DifficultyInfo {
  return DIFFICULTY_PRESETS[difficulty];
}

/**
 * Load difficulty setting from localStorage
 * Handles migration from old difficulty values (easy, hard, nightmare)
 */
export function loadDifficultySetting(): DifficultyLevel {
  const stored = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
  if (stored) {
    // Check if it's a valid current difficulty
    if (isValidDifficulty(stored)) {
      return stored;
    }
    // Try to migrate from old values
    const migrated = migrateDifficulty(stored);
    // Save the migrated value
    saveDifficultySetting(migrated);
    return migrated;
  }
  return DEFAULT_DIFFICULTY;
}

/**
 * Save difficulty setting to localStorage
 */
export function saveDifficultySetting(difficulty: DifficultyLevel): void {
  localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty);
}

/**
 * Apply difficulty scaling to enemy health
 */
export function scaleEnemyHealth(baseHealth: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return Math.round(baseHealth * modifiers.enemyHealthMultiplier);
}

/**
 * Apply difficulty scaling to enemy damage
 */
export function scaleEnemyDamage(baseDamage: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return Math.round(baseDamage * modifiers.enemyDamageMultiplier);
}

/**
 * Apply difficulty scaling to damage received by player
 */
export function scalePlayerDamageReceived(baseDamage: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return Math.round(baseDamage * modifiers.playerDamageReceivedMultiplier);
}

/**
 * Apply difficulty scaling to enemy fire rate
 */
export function scaleEnemyFireRate(baseFireRate: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return baseFireRate * modifiers.enemyFireRateMultiplier;
}

/**
 * Apply difficulty scaling to detection range
 */
export function scaleDetectionRange(baseRange: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return baseRange * modifiers.enemyDetectionMultiplier;
}

/**
 * Apply difficulty scaling to XP reward
 */
export function scaleXPReward(baseXP: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return Math.round(baseXP * modifiers.xpMultiplier);
}

/**
 * Apply difficulty scaling to spawn count
 */
export function scaleSpawnCount(baseCount: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return Math.round(baseCount * modifiers.spawnRateMultiplier);
}

/**
 * Apply difficulty scaling to resource drop chance
 */
export function scaleResourceDropChance(baseChance: number, difficulty: DifficultyLevel): number {
  const modifiers = getDifficultyModifiers(difficulty);
  return Math.min(1, baseChance * modifiers.resourceDropMultiplier);
}

/**
 * Get the display name for a difficulty level
 */
export function getDifficultyDisplayName(difficulty: DifficultyLevel): string {
  return DIFFICULTY_PRESETS[difficulty].name;
}

/**
 * Check if difficulty level is valid (for migration from old values)
 */
export function isValidDifficulty(value: string): value is DifficultyLevel {
  return DIFFICULTY_ORDER.includes(value as DifficultyLevel);
}

/**
 * Migrate old difficulty values to new ones
 * Maps: easy -> normal, hard -> veteran, nightmare -> legendary
 */
export function migrateDifficulty(oldValue: string): DifficultyLevel {
  const migrations: Record<string, DifficultyLevel> = {
    easy: 'normal',
    hard: 'veteran',
    nightmare: 'legendary',
  };
  return migrations[oldValue] ?? (isValidDifficulty(oldValue) ? oldValue : DEFAULT_DIFFICULTY);
}
