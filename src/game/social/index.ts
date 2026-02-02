/**
 * Social module - Leaderboards, player stats, and sharing
 *
 * Exports:
 * - LeaderboardSystem for managing local leaderboards
 * - LeaderboardTypes for type definitions
 * - ShareSystem for social sharing functionality
 * - ScreenshotCapture for capturing game screenshots
 */

export {
  getPlayerId,
  getPlayerName,
  leaderboardSystem,
  setPlayerName,
} from './LeaderboardSystem';

export {
  LEADERBOARD_INFO,
  type LeaderboardEntry,
  type LeaderboardEvent,
  type LeaderboardFilter,
  type LeaderboardInfo,
  type LeaderboardListener,
  type LeaderboardQueryResult,
  type LeaderboardRow,
  type LeaderboardScope,
  type LeaderboardSubmission,
  type LeaderboardType,
  type PersonalBest,
  type PersonalBestRow,
} from './LeaderboardTypes';
export {
  getScreenshotCapture,
  type ScreenshotCapture,
  type ScreenshotData,
  type ScreenshotOptions,
  type ScreenshotStats,
} from './ScreenshotCapture';
// Share system exports
export {
  getShareSystem,
  initShareSystem,
  type ShareableStats,
  type ShareStats,
  type ShareSystem,
  type ShareTrigger,
} from './ShareSystem';
