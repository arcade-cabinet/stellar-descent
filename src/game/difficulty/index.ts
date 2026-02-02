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
  DEFAULT_DIFFICULTY,
  DIFFICULTY_ORDER,
  // Backward compatibility aliases
  DIFFICULTY_PRESETS,
  DIFFICULTY_REGISTRY,
  type DifficultyEntry,
  type DifficultyInfo,
  type DifficultyLevel,
  type DifficultyModifiers,
  getDifficulty,
  getDifficultyDisplayName,
  getDifficultyInfo,
  getDifficultyModifiers,
  getEffectiveXPMultiplier,
  getModifiers,
  isPermadeathActive,
  isValidDifficulty,
  iterateDifficulties,
  migrateDifficulty,
  PERMADEATH_XP_BONUS,
  scaleDetectionRangeByDifficulty,
  scaleEnemyDamageByDifficulty,
  scaleEnemyFireRateByDifficulty,
  // Static scaling functions (take difficulty as parameter)
  scaleEnemyHealthByDifficulty,
  scalePlayerDamageReceivedByDifficulty,
  scaleResourceDropChanceByDifficulty,
  scaleSpawnCountByDifficulty,
  scaleXPRewardByDifficulty,
} from './DifficultyRegistry';

// Zustand store (runtime state)
export {
  getCurrentModifiers,
  // Non-React access (uses current store state)
  getDifficultyLevel,
  // Backward compatibility (replaces localStorage functions)
  loadDifficultySetting,
  loadPermadeathSetting,
  saveDifficultySetting,
  savePermadeathSetting,
  scaleDetectionRange,
  scaleEnemyDamage,
  scaleEnemyFireRate,
  scaleEnemyHealth,
  scalePlayerDamage,
  scaleResourceDropChance,
  scaleSpawnCount,
  scaleXP,
  selectDifficulty,
  selectInitialized,
  selectPermadeath,
  useDifficultyStore,
} from './useDifficultyStore';
