/**
 * Skull Persistence
 *
 * Handles saving and loading skull discovery / activation state to localStorage.
 * Follows the same pattern as secretPersistence.ts for consistency.
 *
 * Stored data:
 * - Which skulls the player has physically found in the game world
 * - Which found skulls are currently toggled active for gameplay
 */

import type { SkullId } from './SkullSystem';

const STORAGE_KEY_PREFIX = 'stellar_descent_skulls';
const CURRENT_SAVE_KEY = 'stellar_descent_current_save';
const DEFAULT_SAVE_ID = 'default';

// ============================================================================
// TYPES
// ============================================================================

/** Serialisable skull collection state */
export interface SkullCollectionState {
  saveId: string;
  /** IDs of skulls the player has discovered */
  foundSkulls: SkullId[];
  /** IDs of skulls the player has toggled on */
  activeSkulls: SkullId[];
  lastUpdated: number;
}

// ============================================================================
// SAVE ID HELPERS
// ============================================================================

/** Get the current save ID from localStorage */
export function getCurrentSaveId(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_SAVE_ID;
  return localStorage.getItem(CURRENT_SAVE_KEY) || DEFAULT_SAVE_ID;
}

/** Set the current save ID */
export function setCurrentSaveId(saveId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CURRENT_SAVE_KEY, saveId);
}

/** Build the storage key for a specific save */
function getStorageKey(saveId: string): string {
  return `${STORAGE_KEY_PREFIX}_${saveId}`;
}

// ============================================================================
// LOAD / SAVE
// ============================================================================

/** Load skull collection state from localStorage */
export function loadSkullCollection(saveId?: string): SkullCollectionState {
  const resolvedSaveId = saveId || getCurrentSaveId();

  if (typeof localStorage === 'undefined') {
    return {
      saveId: resolvedSaveId,
      foundSkulls: [],
      activeSkulls: [],
      lastUpdated: Date.now(),
    };
  }

  try {
    const stored = localStorage.getItem(getStorageKey(resolvedSaveId));
    if (stored) {
      const parsed = JSON.parse(stored) as SkullCollectionState;
      return {
        ...parsed,
        saveId: resolvedSaveId,
      };
    }
  } catch (e) {
    console.warn('[SkullPersistence] Failed to load skull collection:', e);
  }

  return {
    saveId: resolvedSaveId,
    foundSkulls: [],
    activeSkulls: [],
    lastUpdated: Date.now(),
  };
}

/** Save skull collection state to localStorage */
export function saveSkullCollection(state: SkullCollectionState): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const toStore: SkullCollectionState = {
      ...state,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(getStorageKey(state.saveId), JSON.stringify(toStore));
  } catch (e) {
    console.warn('[SkullPersistence] Failed to save skull collection:', e);
  }
}

// ============================================================================
// DISCOVERY HELPERS
// ============================================================================

/**
 * Add a discovered skull to the collection.
 * Returns the updated state.
 */
export function addFoundSkull(
  skullId: SkullId,
  saveId?: string
): SkullCollectionState {
  const state = loadSkullCollection(saveId);

  if (state.foundSkulls.includes(skullId)) {
    return state;
  }

  state.foundSkulls.push(skullId);
  state.lastUpdated = Date.now();

  saveSkullCollection(state);
  return state;
}

/** Check whether a skull has been found */
export function isSkullFound(skullId: SkullId, saveId?: string): boolean {
  const state = loadSkullCollection(saveId);
  return state.foundSkulls.includes(skullId);
}

/** Get all found skull IDs */
export function getFoundSkullIds(saveId?: string): SkullId[] {
  const state = loadSkullCollection(saveId);
  return state.foundSkulls;
}

// ============================================================================
// ACTIVATION HELPERS
// ============================================================================

/**
 * Set a skull as active. It must already be found.
 * Returns the updated state.
 */
export function activateSkull(
  skullId: SkullId,
  saveId?: string
): SkullCollectionState {
  const state = loadSkullCollection(saveId);

  if (!state.foundSkulls.includes(skullId)) {
    console.warn(`[SkullPersistence] Cannot activate unfound skull: ${skullId}`);
    return state;
  }

  if (!state.activeSkulls.includes(skullId)) {
    state.activeSkulls.push(skullId);
    state.lastUpdated = Date.now();
    saveSkullCollection(state);
  }

  return state;
}

/**
 * Set a skull as inactive.
 * Returns the updated state.
 */
export function deactivateSkull(
  skullId: SkullId,
  saveId?: string
): SkullCollectionState {
  const state = loadSkullCollection(saveId);

  const idx = state.activeSkulls.indexOf(skullId);
  if (idx !== -1) {
    state.activeSkulls.splice(idx, 1);
    state.lastUpdated = Date.now();
    saveSkullCollection(state);
  }

  return state;
}

/** Get all currently active skull IDs */
export function getActiveSkullIds(saveId?: string): SkullId[] {
  const state = loadSkullCollection(saveId);
  return state.activeSkulls;
}

// ============================================================================
// PROGRESS HELPERS
// ============================================================================

/** Get skull collection progress */
export function getSkullCollectionProgress(saveId?: string): {
  total: number;
  found: number;
  active: number;
  percentage: number;
} {
  const state = loadSkullCollection(saveId);
  // Import SKULL_ORDER length at module level would create circular dep;
  // use the state arrays and a hard-coded total instead.
  const total = 10;
  const found = state.foundSkulls.length;
  const active = state.activeSkulls.length;

  return {
    total,
    found,
    active,
    percentage: total > 0 ? Math.round((found / total) * 100) : 0,
  };
}

// ============================================================================
// RESET / CLEANUP
// ============================================================================

/** Reset skull collection for a save (new game) */
export function resetSkullCollection(saveId?: string): void {
  const resolvedSaveId = saveId || getCurrentSaveId();
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(getStorageKey(resolvedSaveId));
}

/** Delete all skull save data across all saves */
export function deleteAllSkullSaves(): void {
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
