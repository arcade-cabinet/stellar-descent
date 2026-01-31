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
 * 'ultra_nightmare' is the ultimate challenge - extreme difficulty + forced permadeath (inspired by DOOM)
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
  /** Forces permadeath - ultra_nightmare always true, others respect toggle */
  forcesPermadeath: boolean;
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
  easy: {
    id: 'easy',
    name: 'EASY',
    description:
      'Reduced challenge for players who want to enjoy the story. Enemies deal less damage and have less health.',
    modifiers: {
      enemyHealthMultiplier: 0.625, // Scales base stats to Easy column values
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
      forcesPermadeath: false,
    },
  },
  hard: {
    id: 'hard',
    name: 'HARD',
    description:
      'For experienced drop troopers. Enemies are stronger, faster, and more numerous. +25% XP bonus.',
    modifiers: {
      enemyHealthMultiplier: 1.25, // Scales base stats to Hard column values
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
    description:
      'Only the most elite survive. Enemies are lethal and relentless. +50% XP bonus. Glory awaits.',
    modifiers: {
      enemyHealthMultiplier: 1.625, // Scales base stats to Nightmare column values
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
    description:
      'The ultimate test. One death ends your entire campaign. No checkpoints. No mercy. +100% XP bonus.',
    modifiers: {
      enemyHealthMultiplier: 2.0, // Even beyond Nightmare
      enemyDamageMultiplier: 2.5,
      playerDamageReceivedMultiplier: 2.5,
      playerHealthRegenMultiplier: 0.0, // No regen
      enemyFireRateMultiplier: 1.75,
      enemyDetectionMultiplier: 2.0,
      xpMultiplier: 2.0, // Double XP
      spawnRateMultiplier: 1.75,
      resourceDropMultiplier: 0.4,
      forcesPermadeath: true, // Always permadeath
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
export const DIFFICULTY_ORDER: DifficultyLevel[] = ['easy', 'normal', 'hard', 'nightmare', 'ultra_nightmare'];

/**
 * XP bonus multiplier when permadeath is enabled (stacks with difficulty bonus)
 */
export const PERMADEATH_XP_BONUS = 0.5; // +50% XP when permadeath is on

/**
 * LocalStorage key for permadeath toggle
 */
const PERMADEATH_STORAGE_KEY = 'stellar_descent_permadeath';

/**
 * Load permadeath setting from localStorage
 */
export function loadPermadeathSetting(): boolean {
  const stored = localStorage.getItem(PERMADEATH_STORAGE_KEY);
  return stored === 'true';
}

/**
 * Save permadeath setting to localStorage
 */
export function savePermadeathSetting(enabled: boolean): void {
  localStorage.setItem(PERMADEATH_STORAGE_KEY, String(enabled));
}

/**
 * Check if permadeath is active for given difficulty and toggle state
 */
export function isPermadeathActive(difficulty: DifficultyLevel, toggleEnabled: boolean): boolean {
  const preset = DIFFICULTY_PRESETS[difficulty];
  return preset.modifiers.forcesPermadeath || toggleEnabled;
}

/**
 * Get the effective XP multiplier including permadeath bonus
 */
export function getEffectiveXPMultiplier(difficulty: DifficultyLevel, permadeathEnabled: boolean): number {
  const baseMultiplier = DIFFICULTY_PRESETS[difficulty].modifiers.xpMultiplier;
  const permadeathActive = isPermadeathActive(difficulty, permadeathEnabled);
  // Add permadeath bonus if active and not already forced (to avoid double-dipping for ultra_nightmare)
  if (permadeathActive && !DIFFICULTY_PRESETS[difficulty].modifiers.forcesPermadeath) {
    return baseMultiplier * (1 + PERMADEATH_XP_BONUS);
  }
  return baseMultiplier;
}

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
 * Maps: veteran -> hard, legendary -> nightmare
 */
export function migrateDifficulty(oldValue: string): DifficultyLevel {
  const migrations: Record<string, DifficultyLevel> = {
    veteran: 'hard',
    legendary: 'nightmare',
  };
  return migrations[oldValue] ?? (isValidDifficulty(oldValue) ? oldValue : DEFAULT_DIFFICULTY);
}

// ---------------------------------------------------------------------------
// DifficultyManager - Singleton for centralized difficulty management
// ---------------------------------------------------------------------------

export type DifficultyChangeListener = (newDifficulty: DifficultyLevel, oldDifficulty: DifficultyLevel) => void;

/**
 * DifficultyManager - Singleton that manages game difficulty
 *
 * Provides centralized difficulty management:
 * - All enemy spawns query DifficultyManager for current difficulty
 * - Difficulty changes can apply immediately (not just on spawn)
 * - Listeners can react to difficulty changes
 */
export class DifficultyManager {
  private static instance: DifficultyManager | null = null;
  private currentDifficulty: DifficultyLevel;
  private listeners: Set<DifficultyChangeListener> = new Set();

  private constructor() {
    this.currentDifficulty = loadDifficultySetting();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): DifficultyManager {
    if (!DifficultyManager.instance) {
      DifficultyManager.instance = new DifficultyManager();
    }
    return DifficultyManager.instance;
  }

  /**
   * Get current difficulty level
   */
  getDifficulty(): DifficultyLevel {
    return this.currentDifficulty;
  }

  /**
   * Get current difficulty modifiers
   */
  getModifiers(): DifficultyModifiers {
    return getDifficultyModifiers(this.currentDifficulty);
  }

  /**
   * Get current difficulty info
   */
  getInfo(): DifficultyInfo {
    return getDifficultyInfo(this.currentDifficulty);
  }

  /**
   * Set difficulty level
   * @param difficulty - New difficulty level
   * @param persist - Whether to save to localStorage (default: true)
   */
  setDifficulty(difficulty: DifficultyLevel, persist: boolean = true): void {
    if (difficulty === this.currentDifficulty) return;

    const oldDifficulty = this.currentDifficulty;
    this.currentDifficulty = difficulty;

    if (persist) {
      saveDifficultySetting(difficulty);
    }

    // Notify all listeners of the change
    this.notifyListeners(difficulty, oldDifficulty);
  }

  /**
   * Add a listener for difficulty changes
   * @returns Cleanup function to remove the listener
   */
  addListener(listener: DifficultyChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove a listener for difficulty changes
   */
  removeListener(listener: DifficultyChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a difficulty change
   */
  private notifyListeners(newDifficulty: DifficultyLevel, oldDifficulty: DifficultyLevel): void {
    for (const listener of this.listeners) {
      try {
        listener(newDifficulty, oldDifficulty);
      } catch (error) {
        console.error('[DifficultyManager] Listener error:', error);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Convenience methods for scaling values
  // ---------------------------------------------------------------------------

  /**
   * Scale enemy health based on current difficulty
   */
  scaleHealth(baseHealth: number): number {
    return scaleEnemyHealth(baseHealth, this.currentDifficulty);
  }

  /**
   * Scale enemy damage based on current difficulty
   */
  scaleDamage(baseDamage: number): number {
    return scaleEnemyDamage(baseDamage, this.currentDifficulty);
  }

  /**
   * Scale player damage received based on current difficulty
   */
  scalePlayerDamage(baseDamage: number): number {
    return scalePlayerDamageReceived(baseDamage, this.currentDifficulty);
  }

  /**
   * Scale enemy fire rate based on current difficulty
   */
  scaleFireRate(baseFireRate: number): number {
    return scaleEnemyFireRate(baseFireRate, this.currentDifficulty);
  }

  /**
   * Scale detection range based on current difficulty
   */
  scaleDetection(baseRange: number): number {
    return scaleDetectionRange(baseRange, this.currentDifficulty);
  }

  /**
   * Scale XP reward based on current difficulty
   */
  scaleXP(baseXP: number): number {
    return scaleXPReward(baseXP, this.currentDifficulty);
  }

  /**
   * Scale spawn count based on current difficulty
   */
  scaleSpawn(baseCount: number): number {
    return scaleSpawnCount(baseCount, this.currentDifficulty);
  }

  /**
   * Scale resource drop chance based on current difficulty
   */
  scaleDropChance(baseChance: number): number {
    return scaleResourceDropChance(baseChance, this.currentDifficulty);
  }

  /**
   * Reset for testing
   */
  static reset(): void {
    DifficultyManager.instance = null;
  }
}

/**
 * Get the DifficultyManager singleton instance
 */
export function getDifficultyManager(): DifficultyManager {
  return DifficultyManager.getInstance();
}
