/**
 * Audio Log Persistence
 *
 * Handles saving and loading collected audio logs to localStorage.
 * Supports per-save collection progress.
 */

import type { LevelId } from '../levels/types';
import type { AudioLogDiscovery } from './audioLogs';
import { AUDIO_LOGS, getTotalAudioLogCount } from './audioLogs';

const STORAGE_KEY_PREFIX = 'stellar_descent_audio_logs';
const CURRENT_SAVE_KEY = 'stellar_descent_current_save';
const DEFAULT_SAVE_ID = 'default';

/**
 * Collection state stored in localStorage
 */
export interface AudioLogCollectionState {
  saveId: string;
  discoveries: AudioLogDiscovery[];
  lastUpdated: number;
}

/**
 * Get the current save ID
 */
export function getCurrentSaveId(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_SAVE_ID;
  return localStorage.getItem(CURRENT_SAVE_KEY) || DEFAULT_SAVE_ID;
}

/**
 * Set the current save ID
 */
export function setCurrentSaveId(saveId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CURRENT_SAVE_KEY, saveId);
}

/**
 * Get the storage key for a specific save
 */
function getStorageKey(saveId: string): string {
  return `${STORAGE_KEY_PREFIX}_${saveId}`;
}

/**
 * Load collection state from localStorage
 */
export function loadAudioLogCollection(saveId?: string): AudioLogCollectionState {
  const resolvedSaveId = saveId || getCurrentSaveId();

  if (typeof localStorage === 'undefined') {
    throw new Error('[AudioLogPersistence] localStorage is not available');
  }

  const stored = localStorage.getItem(getStorageKey(resolvedSaveId));
  if (stored) {
    const parsed = JSON.parse(stored) as AudioLogCollectionState;
    return {
      ...parsed,
      saveId: resolvedSaveId,
    };
  }

  return {
    saveId: resolvedSaveId,
    discoveries: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Save collection state to localStorage
 */
export function saveAudioLogCollection(state: AudioLogCollectionState): void {
  if (typeof localStorage === 'undefined') {
    throw new Error('[AudioLogPersistence] localStorage is not available');
  }

  const toStore: AudioLogCollectionState = {
    ...state,
    lastUpdated: Date.now(),
  };
  localStorage.setItem(getStorageKey(state.saveId), JSON.stringify(toStore));
}

/**
 * Add a discovered audio log to the collection
 */
export function addDiscoveredAudioLog(
  logId: string,
  levelId: LevelId,
  saveId?: string
): AudioLogCollectionState {
  const state = loadAudioLogCollection(saveId);

  // Check if already discovered
  if (state.discoveries.some((d) => d.logId === logId)) {
    return state;
  }

  const discovery: AudioLogDiscovery = {
    logId,
    discoveredAt: Date.now(),
    levelId,
    hasBeenPlayed: false,
  };

  state.discoveries.push(discovery);
  state.lastUpdated = Date.now();

  saveAudioLogCollection(state);
  return state;
}

/**
 * Mark an audio log as played
 */
export function markAudioLogPlayed(logId: string, saveId?: string): void {
  const state = loadAudioLogCollection(saveId);

  const discovery = state.discoveries.find((d) => d.logId === logId);
  if (discovery) {
    discovery.hasBeenPlayed = true;
    saveAudioLogCollection(state);
  }
}

/**
 * Check if an audio log has been discovered
 */
export function isAudioLogDiscovered(logId: string, saveId?: string): boolean {
  const state = loadAudioLogCollection(saveId);
  return state.discoveries.some((d) => d.logId === logId);
}

/**
 * Get all discovered audio log IDs
 */
export function getDiscoveredAudioLogIds(saveId?: string): string[] {
  const state = loadAudioLogCollection(saveId);
  return state.discoveries.map((d) => d.logId);
}

/**
 * Get discovered audio logs for a specific level
 */
export function getDiscoveredLogsByLevel(levelId: LevelId, saveId?: string): AudioLogDiscovery[] {
  const state = loadAudioLogCollection(saveId);
  return state.discoveries.filter((d) => d.levelId === levelId);
}

/**
 * Get collection progress statistics
 */
export function getCollectionProgress(saveId?: string): {
  total: number;
  discovered: number;
  played: number;
  percentage: number;
  byLevel: Record<LevelId, { total: number; discovered: number }>;
} {
  const state = loadAudioLogCollection(saveId);
  const total = getTotalAudioLogCount();
  const discovered = state.discoveries.length;
  const played = state.discoveries.filter((d) => d.hasBeenPlayed).length;

  // Calculate per-level stats
  const byLevel: Record<string, { total: number; discovered: number }> = {};
  for (const log of AUDIO_LOGS) {
    if (!byLevel[log.levelId]) {
      byLevel[log.levelId] = { total: 0, discovered: 0 };
    }
    byLevel[log.levelId].total++;
  }
  for (const discovery of state.discoveries) {
    if (byLevel[discovery.levelId]) {
      byLevel[discovery.levelId].discovered++;
    }
  }

  return {
    total,
    discovered,
    played,
    percentage: total > 0 ? Math.round((discovered / total) * 100) : 0,
    byLevel: byLevel as Record<LevelId, { total: number; discovered: number }>,
  };
}

/**
 * Get unplayed (new) audio logs
 */
export function getUnplayedAudioLogs(saveId?: string): AudioLogDiscovery[] {
  const state = loadAudioLogCollection(saveId);
  return state.discoveries.filter((d) => !d.hasBeenPlayed);
}

/**
 * Reset collection for a save (for new game)
 */
export function resetAudioLogCollection(saveId?: string): void {
  const resolvedSaveId = saveId || getCurrentSaveId();
  if (typeof localStorage === 'undefined') return;

  localStorage.removeItem(getStorageKey(resolvedSaveId));
}

/**
 * Delete all saves (factory reset)
 */
export function deleteAllAudioLogSaves(): void {
  if (typeof localStorage === 'undefined') return;

  const keysToDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    localStorage.removeItem(key);
  }
}
