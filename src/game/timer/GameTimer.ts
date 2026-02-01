/**
 * GameTimer - Tracks mission elapsed time, campaign play time, and best times
 *
 * Features:
 * - Mission timer: starts when gameplay begins, pauses when game is paused
 * - Campaign total time: accumulates across all sessions
 * - Best times per level: stored persistently
 * - React-compatible with subscribe/getSnapshot for useSyncExternalStore
 */

import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import { useGameStatsStore } from '../stores/useGameStatsStore';

const log = getLogger('GameTimer');

// ============================================================================
// Types
// ============================================================================

export interface TimerSnapshot {
  /** Current mission elapsed time in seconds */
  missionTimeSeconds: number;
  /** Total campaign play time in milliseconds (for save persistence) */
  totalPlayTimeMs: number;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Current level ID being timed */
  currentLevelId: LevelId | null;
}

export interface LevelBestTime {
  levelId: LevelId;
  /** Best time in seconds */
  bestTimeSeconds: number;
  /** Date achieved */
  achievedAt: number;
}

// ============================================================================
// GameTimer class
// ============================================================================

class GameTimer {
  private snapshot: TimerSnapshot = {
    missionTimeSeconds: 0,
    totalPlayTimeMs: 0,
    isRunning: false,
    currentLevelId: null,
  };

  private listeners: Set<() => void> = new Set();
  private missionStartTime: number | null = null;
  private accumulatedMissionTime: number = 0;
  private sessionStartTime: number = Date.now();
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  // ---- React integration (useSyncExternalStore compatible) ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): TimerSnapshot => {
    return this.snapshot;
  };

  private notify(): void {
    // Create new snapshot reference for React to detect changes
    this.snapshot = { ...this.snapshot };
    for (const listener of this.listeners) {
      listener();
    }
  }

  // ---- Mission timer controls ----

  /**
   * Start the mission timer for a specific level
   */
  startMission(levelId: LevelId): void {
    this.snapshot.currentLevelId = levelId;
    this.accumulatedMissionTime = 0;
    this.missionStartTime = Date.now();
    this.snapshot.isRunning = true;
    this.snapshot.missionTimeSeconds = 0;
    this.startUpdateLoop();
    this.notify();
    log.info(`Mission started: ${levelId}`);
  }

  /**
   * Pause the mission timer (e.g., when game is paused)
   */
  pause(): void {
    if (!this.snapshot.isRunning || this.missionStartTime === null) return;

    // Accumulate elapsed time
    this.accumulatedMissionTime += Date.now() - this.missionStartTime;
    this.missionStartTime = null;
    this.snapshot.isRunning = false;
    this.stopUpdateLoop();
    this.notify();
    log.info('Mission paused');
  }

  /**
   * Resume the mission timer
   */
  resume(): void {
    if (this.snapshot.isRunning) return;
    if (this.snapshot.currentLevelId === null) return;

    this.missionStartTime = Date.now();
    this.snapshot.isRunning = true;
    this.startUpdateLoop();
    this.notify();
    log.info('Mission resumed');
  }

  /**
   * Stop and finalize the mission timer
   * Returns the final elapsed time in seconds
   */
  stopMission(): number {
    if (this.missionStartTime !== null) {
      this.accumulatedMissionTime += Date.now() - this.missionStartTime;
    }

    const finalTimeSeconds = this.accumulatedMissionTime / 1000;
    this.snapshot.missionTimeSeconds = finalTimeSeconds;
    this.snapshot.isRunning = false;
    this.missionStartTime = null;
    this.stopUpdateLoop();
    this.notify();

    log.info(`Mission stopped: ${finalTimeSeconds.toFixed(2)}s`);
    return finalTimeSeconds;
  }

  /**
   * Reset mission timer without saving
   */
  resetMission(): void {
    this.accumulatedMissionTime = 0;
    this.missionStartTime = null;
    this.snapshot.missionTimeSeconds = 0;
    this.snapshot.isRunning = false;
    this.snapshot.currentLevelId = null;
    this.stopUpdateLoop();
    this.notify();
  }

  /**
   * Get the current mission elapsed time in seconds (without modifying state)
   */
  getMissionTimeSeconds(): number {
    if (this.missionStartTime !== null) {
      return (this.accumulatedMissionTime + (Date.now() - this.missionStartTime)) / 1000;
    }
    return this.accumulatedMissionTime / 1000;
  }

  // ---- Campaign time tracking ----

  /**
   * Set the total play time from a loaded save
   */
  setTotalPlayTime(ms: number): void {
    this.snapshot.totalPlayTimeMs = ms;
    this.sessionStartTime = Date.now();
    this.notify();
  }

  /**
   * Get total campaign play time including current session
   */
  getTotalPlayTimeMs(): number {
    return this.snapshot.totalPlayTimeMs + (Date.now() - this.sessionStartTime);
  }

  /**
   * Flush session time to total (call before saving)
   */
  flushSessionTime(): number {
    const sessionTime = Date.now() - this.sessionStartTime;
    this.snapshot.totalPlayTimeMs += sessionTime;
    this.sessionStartTime = Date.now();
    return this.snapshot.totalPlayTimeMs;
  }

  // ---- Best times ----

  /**
   * Check and save best time for a level
   * Returns true if this is a new best time
   */
  checkAndSaveBestTime(levelId: LevelId, timeSeconds: number): boolean {
    return useGameStatsStore.getState().checkAndSaveBestTime(levelId, timeSeconds);
  }

  /**
   * Get best time for a specific level
   */
  getBestTime(levelId: LevelId): number | null {
    return useGameStatsStore.getState().getBestTime(levelId);
  }

  /**
   * Get all best times
   */
  getAllBestTimes(): Record<LevelId, LevelBestTime> {
    const storeTimes = useGameStatsStore.getState().getAllBestTimes();
    // Convert to GameTimer's LevelBestTime format
    const result = {} as Record<LevelId, LevelBestTime>;
    for (const [id, entry] of Object.entries(storeTimes)) {
      if (entry) {
        result[id as LevelId] = {
          levelId: id as LevelId,
          bestTimeSeconds: entry.bestTimeSeconds,
          achievedAt: entry.achievedAt,
        };
      }
    }
    return result;
  }

  /**
   * Clear best time for a level (for dev/testing)
   */
  clearBestTime(levelId: LevelId): void {
    useGameStatsStore.getState().clearBestTime(levelId);
  }

  /**
   * Clear all best times (for dev/testing)
   */
  clearAllBestTimes(): void {
    useGameStatsStore.getState().clearAllBestTimes();
  }

  // ---- Private helpers ----

  private startUpdateLoop(): void {
    if (this.updateInterval) return;

    // Update every 100ms for smooth display
    this.updateInterval = setInterval(() => {
      if (this.snapshot.isRunning && this.missionStartTime !== null) {
        const elapsed = this.accumulatedMissionTime + (Date.now() - this.missionStartTime);
        this.snapshot.missionTimeSeconds = elapsed / 1000;
        this.notify();
      }
    }, 100);
  }

  private stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // ---- Cleanup ----

  dispose(): void {
    this.stopUpdateLoop();
    this.listeners.clear();
  }
}

// ============================================================================
// Singleton instance
// ============================================================================

let timerInstance: GameTimer | null = null;

export function getGameTimer(): GameTimer {
  if (!timerInstance) {
    timerInstance = new GameTimer();
  }
  return timerInstance;
}

export function disposeGameTimer(): void {
  if (timerInstance) {
    timerInstance.dispose();
    timerInstance = null;
  }
}

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Format seconds as MM:SS
 */
export function formatTimeMMSS(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds as HH:MM:SS (for long durations)
 */
export function formatTimeHHMMSS(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds as human-readable duration (e.g., "2h 15m")
 */
export function formatPlayTimeDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
