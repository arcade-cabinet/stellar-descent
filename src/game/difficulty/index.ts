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

// Registry (static definitions)
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
} from './DifficultyRegistry';

// Zustand store (runtime state)
export {
  useDifficultyStore,
  selectDifficulty,
  selectPermadeath,
  selectInitialized,
  // Non-React access
  getDifficultyLevel,
  getCurrentModifiers,
  scaleEnemyHealth,
  scaleEnemyDamage,
  scalePlayerDamage,
  scaleXP,
} from './useDifficultyStore';
