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

export {
  getGameChronometer,
  disposeGameChronometer,
  GameChronometer,
  type ChronometerSnapshot,
  type LoreDate,
} from './GameChronometer';

export { useGameTimer, useMissionTime, useTimerRunning } from './useGameTimer';
