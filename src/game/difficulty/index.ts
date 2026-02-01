/**
 * Difficulty System
 *
 * Registry-based difficulty management with Zustand state and SQLite persistence.
 *
 * Usage:
 * - DifficultyRegistry: Static definitions (DIFFICULTY_REGISTRY, getDifficulty, etc.)
 * - useDifficultyStore: React hook for state (difficulty, permadeath, scaling)
 * - Non-React: getDifficultyLevel(), scaleEnemyHealth(), etc.
 */

// Registry (static definitions and types)
export {
  type DifficultyLevel,
  type DifficultyModifiers,
  type DifficultyEntry,
  DIFFICULTY_REGISTRY,
  DIFFICULTY_ORDER,
  DEFAULT_DIFFICULTY,
  PERMADEATH_XP_BONUS,
  getDifficulty,
  getModifiers,
  isValidDifficulty,
  isPermadeathActive,
  getEffectiveXPMultiplier,
  iterateDifficulties,
  // Backward compatibility aliases
  DIFFICULTY_PRESETS,
  type DifficultyInfo,
  getDifficultyModifiers,
  getDifficultyInfo,
  getDifficultyDisplayName,
  migrateDifficulty,
  // Static scaling functions (take difficulty as parameter)
  scaleEnemyHealthByDifficulty,
  scaleEnemyDamageByDifficulty,
  scalePlayerDamageReceivedByDifficulty,
  scaleEnemyFireRateByDifficulty,
  scaleDetectionRangeByDifficulty,
  scaleXPRewardByDifficulty,
  scaleSpawnCountByDifficulty,
  scaleResourceDropChanceByDifficulty,
} from './DifficultyRegistry';

// Zustand store (runtime state)
export {
  useDifficultyStore,
  selectDifficulty,
  selectPermadeath,
  selectInitialized,
  // Non-React access (uses current store state)
  getDifficultyLevel,
  getCurrentModifiers,
  scaleEnemyHealth,
  scaleEnemyDamage,
  scalePlayerDamage,
  scaleXP,
  scaleEnemyFireRate,
  scaleDetectionRange,
  scaleSpawnCount,
  scaleResourceDropChance,
  // Backward compatibility (replaces localStorage functions)
  loadDifficultySetting,
  saveDifficultySetting,
  loadPermadeathSetting,
  savePermadeathSetting,
} from './useDifficultyStore';
