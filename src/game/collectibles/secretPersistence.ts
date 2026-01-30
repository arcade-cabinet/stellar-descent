/**
 * Secret Area Persistence
 *
 * Handles saving and loading discovered secrets to localStorage.
 * Supports per-save collection progress.
 */

import type { LevelId } from '../levels/types';
import type { SecretDiscovery } from './secrets';
import { getTotalSecretCount, SECRET_AREAS } from './secrets';

const STORAGE_KEY_PREFIX = 'stellar_descent_secrets';
const CURRENT_SAVE_KEY = 'stellar_descent_current_save';
const DEFAULT_SAVE_ID = 'default';

/**
 * Collection state stored in localStorage
 */
export interface SecretCollectionState {
  saveId: string;
  discoveries: SecretDiscovery[];
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
export function loadSecretCollection(saveId?: string): SecretCollectionState {
  const resolvedSaveId = saveId || getCurrentSaveId();

  if (typeof localStorage === 'undefined') {
    return {
      saveId: resolvedSaveId,
      discoveries: [],
      lastUpdated: Date.now(),
    };
  }

  try {
    const stored = localStorage.getItem(getStorageKey(resolvedSaveId));
    if (stored) {
      const parsed = JSON.parse(stored) as SecretCollectionState;
      return {
        ...parsed,
        saveId: resolvedSaveId,
      };
    }
  } catch (e) {
    console.warn('[SecretPersistence] Failed to load collection state:', e);
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
export function saveSecretCollection(state: SecretCollectionState): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const toStore: SecretCollectionState = {
      ...state,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(getStorageKey(state.saveId), JSON.stringify(toStore));
  } catch (e) {
    console.warn('[SecretPersistence] Failed to save collection state:', e);
  }
}

/**
 * Add a discovered secret to the collection
 */
export function addDiscoveredSecret(
  secretId: string,
  levelId: LevelId,
  saveId?: string
): SecretCollectionState {
  const state = loadSecretCollection(saveId);

  // Check if already discovered
  if (state.discoveries.some((d) => d.secretId === secretId)) {
    return state;
  }

  const discovery: SecretDiscovery = {
    secretId,
    discoveredAt: Date.now(),
    levelId,
  };

  state.discoveries.push(discovery);
  state.lastUpdated = Date.now();

  saveSecretCollection(state);
  return state;
}

/**
 * Check if a secret has been discovered
 */
export function isSecretDiscovered(secretId: string, saveId?: string): boolean {
  const state = loadSecretCollection(saveId);
  return state.discoveries.some((d) => d.secretId === secretId);
}

/**
 * Get all discovered secret IDs
 */
export function getDiscoveredSecretIds(saveId?: string): string[] {
  const state = loadSecretCollection(saveId);
  return state.discoveries.map((d) => d.secretId);
}

/**
 * Get discovered secrets for a specific level
 */
export function getDiscoveredSecretsByLevel(levelId: LevelId, saveId?: string): SecretDiscovery[] {
  const state = loadSecretCollection(saveId);
  return state.discoveries.filter((d) => d.levelId === levelId);
}

/**
 * Get collection progress statistics
 */
export function getSecretCollectionProgress(saveId?: string): {
  total: number;
  discovered: number;
  percentage: number;
  byLevel: Record<LevelId, { total: number; discovered: number }>;
} {
  const state = loadSecretCollection(saveId);
  const total = getTotalSecretCount();
  const discovered = state.discoveries.length;

  // Calculate per-level stats
  const byLevel: Record<string, { total: number; discovered: number }> = {};
  for (const secret of SECRET_AREAS) {
    if (!byLevel[secret.levelId]) {
      byLevel[secret.levelId] = { total: 0, discovered: 0 };
    }
    byLevel[secret.levelId].total++;
  }
  for (const discovery of state.discoveries) {
    if (byLevel[discovery.levelId]) {
      byLevel[discovery.levelId].discovered++;
    }
  }

  return {
    total,
    discovered,
    percentage: total > 0 ? Math.round((discovered / total) * 100) : 0,
    byLevel: byLevel as Record<LevelId, { total: number; discovered: number }>,
  };
}

/**
 * Get level completion status (all secrets found)
 */
export function isLevelSecretsComplete(levelId: LevelId, saveId?: string): boolean {
  const progress = getSecretCollectionProgress(saveId);
  const levelStats = progress.byLevel[levelId];
  return levelStats ? levelStats.discovered >= levelStats.total : false;
}

/**
 * Reset collection for a save (for new game)
 */
export function resetSecretCollection(saveId?: string): void {
  const resolvedSaveId = saveId || getCurrentSaveId();
  if (typeof localStorage === 'undefined') return;

  localStorage.removeItem(getStorageKey(resolvedSaveId));
}

/**
 * Delete all saves (factory reset)
 */
export function deleteAllSecretSaves(): void {
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
