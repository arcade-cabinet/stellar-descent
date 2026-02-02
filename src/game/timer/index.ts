/**
 * Timer module exports
 */

export {
  type ChronometerSnapshot,
  disposeGameChronometer,
  GameChronometer,
  getGameChronometer,
  type LoreDate,
} from './GameChronometer';
export {
  disposeGameTimer,
  formatPlayTimeDuration,
  formatTimeHHMMSS,
  formatTimeMMSS,
  getGameTimer,
  type LevelBestTime,
  type TimerSnapshot,
} from './GameTimer';

export { useGameTimer, useMissionTime, useTimerRunning } from './useGameTimer';
