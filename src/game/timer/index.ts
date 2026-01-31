/**
 * Timer module exports
 */

export {
  getGameTimer,
  disposeGameTimer,
  formatTimeMMSS,
  formatTimeHHMMSS,
  formatPlayTimeDuration,
  type TimerSnapshot,
  type LevelBestTime,
} from './GameTimer';

export { useGameTimer, useMissionTime, useTimerRunning } from './useGameTimer';
