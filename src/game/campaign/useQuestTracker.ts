/**
 * useQuestTracker - React hook for quest tracking in HUD
 *
 * Provides real-time quest state for the QuestTracker component,
 * updating on objective progress, timer ticks, and quest transitions.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { QuestTrackerData } from '../../components/ui/QuestTracker';
import type { LevelId } from '../levels/types';
import {
  getActiveMainQuest,
  getActiveQuests,
  getCurrentObjective,
  getObjectiveProgress,
  getObjectiveTimeRemaining,
  getQuestTrackerData,
  updateTimedObjectives,
} from './QuestManager';
import type { QuestState } from './QuestManager';
import { QUEST_REGISTRY, getMainQuestForLevel, getBranchQuestsForLevel } from './QuestChain';

// ============================================================================
// QUEST STATE STORE (for useSyncExternalStore)
// ============================================================================

type QuestStateListener = () => void;
const listeners = new Set<QuestStateListener>();
let currentTrackerData: QuestTrackerData | null = null;
let currentLevelId: LevelId | null = null;

function subscribe(listener: QuestStateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): QuestTrackerData | null {
  return currentTrackerData;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Update the tracker data from current quest state.
 * Call this when quest state changes.
 */
export function updateQuestTrackerState(levelId: LevelId): void {
  currentLevelId = levelId;
  const newData = getQuestTrackerData(levelId);

  // Check if data actually changed to avoid unnecessary re-renders
  if (JSON.stringify(newData) !== JSON.stringify(currentTrackerData)) {
    currentTrackerData = newData;
    notify();
  }
}

/**
 * Mark the current objective as just completed (for animation).
 * The flag auto-clears after a short delay.
 */
export function markObjectiveCompleted(): void {
  if (currentTrackerData) {
    currentTrackerData = { ...currentTrackerData, justCompleted: true };
    notify();

    // Clear the flag after animation duration
    setTimeout(() => {
      if (currentTrackerData?.justCompleted) {
        currentTrackerData = { ...currentTrackerData, justCompleted: false };
        notify();
      }
    }, 1500);
  }
}

/**
 * Update objective distance (from compass/3D system).
 */
export function updateObjectiveDistance(distance: number): void {
  if (currentTrackerData && currentTrackerData.distance !== distance) {
    currentTrackerData = { ...currentTrackerData, distance };
    notify();
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

export interface UseQuestTrackerResult {
  /** Current quest tracker data for display */
  data: QuestTrackerData | null;
  /** Refresh the tracker data from quest state */
  refresh: () => void;
  /** Whether there's an active timed objective */
  hasTimedObjective: boolean;
  /** Time remaining on current timed objective (seconds) */
  timeRemaining: number | null;
}

/**
 * Hook for quest tracking in components.
 *
 * Usage:
 * ```tsx
 * const { data, hasTimedObjective, timeRemaining } = useQuestTracker(currentLevelId);
 * return <QuestTracker data={data} visible={!!data} />;
 * ```
 */
export function useQuestTracker(levelId: LevelId | null): UseQuestTrackerResult {
  const data = useSyncExternalStore(subscribe, getSnapshot);

  // Update state when level changes
  useEffect(() => {
    if (levelId) {
      updateQuestTrackerState(levelId);
    }
  }, [levelId]);

  const refresh = useCallback(() => {
    if (levelId) {
      updateQuestTrackerState(levelId);
    }
  }, [levelId]);

  const hasTimedObjective = data?.timeRemaining !== undefined;
  const timeRemaining = data?.timeRemaining ?? null;

  return {
    data,
    refresh,
    hasTimedObjective,
    timeRemaining,
  };
}

// ============================================================================
// TIMER TICK INTEGRATION
// ============================================================================

let timerTickInterval: ReturnType<typeof setInterval> | null = null;
let lastTickTime = 0;

/**
 * Start the quest timer tick system.
 * Should be called when gameplay starts.
 */
export function startQuestTimerTick(): void {
  if (timerTickInterval) return;

  lastTickTime = performance.now();

  timerTickInterval = setInterval(() => {
    const now = performance.now();
    const deltaMs = now - lastTickTime;
    lastTickTime = now;

    const deltaSeconds = deltaMs / 1000;

    // Update timed objectives
    const timerExpired = updateTimedObjectives(deltaSeconds);

    // Refresh tracker if timers are active or expired
    if (currentLevelId) {
      const newData = getQuestTrackerData(currentLevelId);
      if (newData?.timeRemaining !== currentTrackerData?.timeRemaining || timerExpired) {
        currentTrackerData = newData;
        notify();
      }
    }
  }, 100); // 10 Hz update for timers
}

/**
 * Stop the quest timer tick system.
 * Should be called when gameplay ends or pauses.
 */
export function stopQuestTimerTick(): void {
  if (timerTickInterval) {
    clearInterval(timerTickInterval);
    timerTickInterval = null;
  }
}

/**
 * Pause/resume the timer tick (for pause menu).
 */
export function pauseQuestTimerTick(): void {
  stopQuestTimerTick();
}

export function resumeQuestTimerTick(): void {
  startQuestTimerTick();
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to get just the current objective progress.
 */
export function useObjectiveProgress(questId: string): { current: number; required: number } | null {
  const [progress, setProgress] = useState<{ current: number; required: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const newProgress = getObjectiveProgress(questId);
      setProgress(newProgress);
    };

    update();
    // Subscribe to quest state changes
    const unsubscribe = subscribe(update);
    return unsubscribe;
  }, [questId]);

  return progress;
}

/**
 * Hook to check if a specific quest is active.
 */
export function useIsQuestActive(questId: string): boolean {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const update = () => {
      const quests = getActiveQuests();
      setIsActive(quests.has(questId));
    };

    update();
    const unsubscribe = subscribe(update);
    return unsubscribe;
  }, [questId]);

  return isActive;
}

export default useQuestTracker;
