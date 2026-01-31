/**
 * Game Modes Module
 *
 * Exports the game mode management systems including:
 * - New Game Plus (NG+) system
 * - Game Mode Manager
 * - Challenge Mode (daily/weekly/permanent challenges)
 */

// New Game Plus System
export {
  getNewGamePlusSystem,
  initNewGamePlus,
  MAX_NG_PLUS_TIER,
  NG_PLUS_BASE_MODIFIERS,
  NG_PLUS_EXCLUSIVE_SKULLS,
  NG_PLUS_START_WEAPONS,
  NG_PLUS_TIER_REWARDS,
  NG_PLUS_TIER_WEAPONS,
  type NewGamePlusModifier,
  type NewGamePlusModifiers,
  type NewGamePlusState,
  type NewGamePlusSystem,
  type NewGamePlusTierReward,
} from './NewGamePlus';

// Game Mode Manager
export {
  type CombinedGameModifiers,
  type GameMode,
  getGameModeManager,
  type GameModeManager,
  type GameSessionState,
  initGameModeManager,
  type PlayerStartConfig,
} from './GameModeManager';

// Challenge Mode - Core types and generation
export {
  type Challenge,
  type ChallengeObjective,
  type ChallengeProgress,
  type ChallengeReward,
  type ChallengeState,
  type ChallengeType,
  type DifficultyModifier,
  type ObjectiveType,
  type RewardType,
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
