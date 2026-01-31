/**
 * useGameTimer - React hook for accessing game timer state
 *
 * Uses useSyncExternalStore for efficient React 18+ integration
 */

import { useSyncExternalStore } from 'react';
import { getGameTimer, type TimerSnapshot } from './GameTimer';

/**
 * React hook to subscribe to game timer state changes
 * Returns the current timer snapshot
 */
export function useGameTimer(): TimerSnapshot {
  const timer = getGameTimer();

  return useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
}

/**
 * React hook to get just the mission time in seconds
 * More targeted for HUD display
 */
export function useMissionTime(): number {
  const { missionTimeSeconds } = useGameTimer();
  return missionTimeSeconds;
}

/**
 * React hook to check if timer is running
 */
export function useTimerRunning(): boolean {
  const { isRunning } = useGameTimer();
  return isRunning;
}
