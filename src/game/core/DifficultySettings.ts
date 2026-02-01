/**
 * DifficultySettings - DEPRECATED
 *
 * This file re-exports from the new difficulty system for backward compatibility.
 * All new code should import from '../difficulty' instead.
 *
 * Migration guide:
 * - DIFFICULTY_PRESETS -> DIFFICULTY_REGISTRY
 * - DifficultyInfo -> DifficultyEntry
 * - getDifficultyModifiers -> getModifiers
 * - getDifficultyInfo -> getDifficulty
 * - DifficultyManager singleton -> useDifficultyStore (Zustand)
 * - localStorage functions -> Zustand store with SQLite persistence
 */

// Import from the new difficulty system
import {
  // Types
  type DifficultyLevel,
  type DifficultyModifiers,
  type DifficultyEntry,
  type DifficultyInfo,
  // Constants
  DIFFICULTY_REGISTRY,
  DIFFICULTY_PRESETS,
  DIFFICULTY_ORDER,
  DEFAULT_DIFFICULTY,
  PERMADEATH_XP_BONUS,
  // Accessors
  getDifficulty,
  getModifiers,
  getDifficultyModifiers,
  getDifficultyInfo,
  getDifficultyDisplayName,
  isValidDifficulty,
  isPermadeathActive,
  getEffectiveXPMultiplier,
  migrateDifficulty,
  iterateDifficulties,
  // Zustand store
  useDifficultyStore,
  selectDifficulty,
  selectPermadeath,
  selectInitialized,
  // Non-React access
  getDifficultyLevel,
  getCurrentModifiers,
  // Backward compatibility functions
  loadDifficultySetting,
  saveDifficultySetting,
  loadPermadeathSetting,
  savePermadeathSetting,
  // Static scaling with difficulty parameter
  scaleEnemyHealthByDifficulty,
  scaleEnemyDamageByDifficulty,
  scalePlayerDamageReceivedByDifficulty,
  scaleEnemyFireRateByDifficulty,
  scaleDetectionRangeByDifficulty,
  scaleXPRewardByDifficulty,
  scaleSpawnCountByDifficulty,
  scaleResourceDropChanceByDifficulty,
  // Non-reactive scaling (uses current store state)
  scaleEnemyHealth as scaleEnemyHealthFromStore,
  scaleEnemyDamage as scaleEnemyDamageFromStore,
  scalePlayerDamage as scalePlayerDamageFromStore,
  scaleXP as scaleXPFromStore,
  scaleEnemyFireRate as scaleEnemyFireRateFromStore,
  scaleDetectionRange as scaleDetectionRangeFromStore,
  scaleSpawnCount as scaleSpawnCountFromStore,
  scaleResourceDropChance as scaleResourceDropChanceFromStore,
} from '../difficulty';

// Re-export types
export type { DifficultyLevel, DifficultyModifiers, DifficultyEntry, DifficultyInfo };

// Re-export constants
export {
  DIFFICULTY_REGISTRY,
  DIFFICULTY_PRESETS,
  DIFFICULTY_ORDER,
  DEFAULT_DIFFICULTY,
  PERMADEATH_XP_BONUS,
};

// Re-export accessors
export {
  getDifficulty,
  getModifiers,
  getDifficultyModifiers,
  getDifficultyInfo,
  getDifficultyDisplayName,
  isValidDifficulty,
  isPermadeathActive,
  getEffectiveXPMultiplier,
  migrateDifficulty,
  iterateDifficulties,
};

// Re-export store
export {
  useDifficultyStore,
  selectDifficulty,
  selectPermadeath,
  selectInitialized,
  getDifficultyLevel,
  getCurrentModifiers,
};

// Re-export backward compatibility functions
export {
  loadDifficultySetting,
  saveDifficultySetting,
  loadPermadeathSetting,
  savePermadeathSetting,
};

// ============================================================================
// Legacy Scaling Functions (with difficulty parameter)
// These maintain backward compatibility with the old API signature
// ============================================================================

/**
 * Scale enemy health based on difficulty.
 * This version takes an explicit difficulty parameter.
 */
export function scaleEnemyHealth(baseHealth: number, difficulty: DifficultyLevel): number {
  return scaleEnemyHealthByDifficulty(baseHealth, difficulty);
}

/**
 * Scale enemy damage based on difficulty.
 * This version takes an explicit difficulty parameter.
 */
export function scaleEnemyDamage(baseDamage: number, difficulty: DifficultyLevel): number {
  return scaleEnemyDamageByDifficulty(baseDamage, difficulty);
}

/**
 * Scale player damage received based on difficulty.
 */
export function scalePlayerDamageReceived(baseDamage: number, difficulty: DifficultyLevel): number {
  return scalePlayerDamageReceivedByDifficulty(baseDamage, difficulty);
}

/**
 * Scale enemy fire rate based on difficulty.
 */
export function scaleEnemyFireRate(baseFireRate: number, difficulty: DifficultyLevel): number {
  return scaleEnemyFireRateByDifficulty(baseFireRate, difficulty);
}

/**
 * Scale detection range based on difficulty.
 */
export function scaleDetectionRange(baseRange: number, difficulty: DifficultyLevel): number {
  return scaleDetectionRangeByDifficulty(baseRange, difficulty);
}

/**
 * Scale XP reward based on difficulty.
 */
export function scaleXPReward(baseXP: number, difficulty: DifficultyLevel): number {
  return scaleXPRewardByDifficulty(baseXP, difficulty);
}

/**
 * Scale spawn count based on difficulty.
 */
export function scaleSpawnCount(baseCount: number, difficulty: DifficultyLevel): number {
  return scaleSpawnCountByDifficulty(baseCount, difficulty);
}

/**
 * Scale resource drop chance based on difficulty.
 */
export function scaleResourceDropChance(baseChance: number, difficulty: DifficultyLevel): number {
  return scaleResourceDropChanceByDifficulty(baseChance, difficulty);
}

// ============================================================================
// Legacy DifficultyManager (deprecated, use useDifficultyStore instead)
// ============================================================================

/**
 * @deprecated Use useDifficultyStore() hook or non-reactive functions instead
 */
export type DifficultyChangeListener = (newDifficulty: DifficultyLevel, oldDifficulty: DifficultyLevel) => void;

/**
 * @deprecated Use useDifficultyStore() hook instead
 *
 * DifficultyManager is now a thin wrapper around the Zustand store.
 * For new code, use:
 * - useDifficultyStore() in React components
 * - getDifficultyLevel(), scaleEnemyHealth(), etc. in non-React code
 */
export class DifficultyManager {
  private static instance: DifficultyManager | null = null;
  private listeners: Set<DifficultyChangeListener> = new Set();
  private unsubscribe: (() => void) | null = null;

  private constructor() {
    // Subscribe to store changes to notify legacy listeners
    this.unsubscribe = useDifficultyStore.subscribe(
      (state) => state.difficulty,
      (newDifficulty, prevDifficulty) => {
        if (newDifficulty !== prevDifficulty) {
          for (const listener of this.listeners) {
            try {
              listener(newDifficulty, prevDifficulty);
            } catch (error) {
              console.error('[DifficultyManager] Listener error:', error);
            }
          }
        }
      }
    );
  }

  static getInstance(): DifficultyManager {
    if (!DifficultyManager.instance) {
      DifficultyManager.instance = new DifficultyManager();
    }
    return DifficultyManager.instance;
  }

  getDifficulty(): DifficultyLevel {
    return getDifficultyLevel();
  }

  getModifiers(): DifficultyModifiers {
    return getCurrentModifiers();
  }

  getInfo(): DifficultyEntry {
    return getDifficulty(getDifficultyLevel());
  }

  setDifficulty(difficulty: DifficultyLevel, _persist: boolean = true): void {
    useDifficultyStore.getState().setDifficulty(difficulty);
  }

  addListener(listener: DifficultyChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  removeListener(listener: DifficultyChangeListener): void {
    this.listeners.delete(listener);
  }

  // Convenience scaling methods (use current store difficulty)
  scaleHealth(baseHealth: number): number {
    return scaleEnemyHealthFromStore(baseHealth);
  }

  scaleDamage(baseDamage: number): number {
    return scaleEnemyDamageFromStore(baseDamage);
  }

  scalePlayerDamage(baseDamage: number): number {
    return scalePlayerDamageFromStore(baseDamage);
  }

  scaleFireRate(baseFireRate: number): number {
    return scaleEnemyFireRateFromStore(baseFireRate);
  }

  scaleDetection(baseRange: number): number {
    return scaleDetectionRangeFromStore(baseRange);
  }

  scaleXP(baseXP: number): number {
    return scaleXPFromStore(baseXP);
  }

  scaleSpawn(baseCount: number): number {
    return scaleSpawnCountFromStore(baseCount);
  }

  scaleDropChance(baseChance: number): number {
    return scaleResourceDropChanceFromStore(baseChance);
  }

  static reset(): void {
    if (DifficultyManager.instance?.unsubscribe) {
      DifficultyManager.instance.unsubscribe();
    }
    DifficultyManager.instance = null;
  }
}

/**
 * @deprecated Use useDifficultyStore() or getDifficultyLevel() instead
 */
export function getDifficultyManager(): DifficultyManager {
  return DifficultyManager.getInstance();
}
