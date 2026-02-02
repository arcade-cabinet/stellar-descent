/**
 * Achievement System Exports
 *
 * This module re-exports achievement types, definitions, and the store.
 * The singleton AchievementManager has been replaced with useAchievementsStore.
 */

// Store and initialization
export {
  type AchievementsActions,
  type AchievementsState,
  type AchievementsStoreState,
  type AchievementWithState,
  getAchievementManager,
  getAchievementsStore,
  initAchievements,
  initializeAchievementsStore,
  type LevelStatsResult,
  type ProgressStats,
  useAchievementsStore,
} from '../stores/useAchievementsStore';
// Types and definitions
export {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementId,
  type AchievementProgress,
  type AchievementState,
  type AchievementUnlockCallback,
  LEVEL_PAR_TIMES,
} from './types';
