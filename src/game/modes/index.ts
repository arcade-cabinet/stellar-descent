/**
 * Game Modes Module
 *
 * Exports the game mode management systems including:
 * - New Game Plus (NG+) system
 * - Game Mode Manager
 * - Challenge Mode (daily/weekly/permanent challenges)
 */

// Challenge Mode - Core types and generation
export {
  type Challenge,
  type ChallengeObjective,
  type ChallengeProgress,
  type ChallengeReward,
  type ChallengeState,
  type ChallengeType,
  type DifficultyModifier,
  formatTimeRemaining,
  generateDailyChallenges,
  generateWeeklyChallenges,
  getDateSeed,
  getPermanentChallenges,
  getTimeUntilDailyReset,
  getTimeUntilWeeklyReset,
  getWeekSeed,
  isChallengeActive,
  isChallengeExpired,
  LEVEL_DISPLAY_NAMES,
  loadChallengeState,
  type ObjectiveType,
  type RewardType,
  saveChallengeState,
} from './ChallengeMode';
// Daily Challenge Manager
export {
  type ChallengeEvent,
  type ChallengeEventCallback,
  type ChallengeEventType,
  type ChallengeManager,
  getChallengeManager,
  initChallenges,
} from './DailyChallenge';
// Game Mode Manager
export {
  type CombinedGameModifiers,
  type GameMode,
  type GameModeManager,
  type GameSessionState,
  getGameModeManager,
  initGameModeManager,
  type PlayerStartConfig,
} from './GameModeManager';
// New Game Plus System
export {
  getNewGamePlusSystem,
  initNewGamePlus,
  MAX_NG_PLUS_TIER,
  type NewGamePlusModifier,
  type NewGamePlusModifiers,
  type NewGamePlusState,
  type NewGamePlusSystem,
  type NewGamePlusTierReward,
  NG_PLUS_BASE_MODIFIERS,
  NG_PLUS_EXCLUSIVE_SKULLS,
  NG_PLUS_START_WEAPONS,
  NG_PLUS_TIER_REWARDS,
  NG_PLUS_TIER_WEAPONS,
} from './NewGamePlus';
