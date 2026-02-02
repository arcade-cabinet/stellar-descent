/**
 * useDifficultyStore - Zustand store for difficulty state
 *
 * Manages runtime difficulty state with SQLite persistence.
 * The DifficultyRegistry provides static definitions, this store manages:
 * - Current difficulty selection
 * - Permadeath toggle state
 * - Persistence to/from SQLite
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getLogger } from '../core/Logger';
import { capacitorDb } from '../db/database';
import {
  DEFAULT_DIFFICULTY,
  DIFFICULTY_REGISTRY,
  type DifficultyLevel,
  type DifficultyModifiers,
  isPermadeathActive,
  PERMADEATH_XP_BONUS,
} from './DifficultyRegistry';

const log = getLogger('DifficultyStore');

// ============================================================================
// Types
// ============================================================================

interface DifficultyState {
  /** Current difficulty level */
  difficulty: DifficultyLevel;
  /** Permadeath toggle (ignored if difficulty forces it) */
  permadeathEnabled: boolean;
  /** Whether store has been initialized from persistence */
  initialized: boolean;
}

interface DifficultyActions {
  /** Initialize store from SQLite persistence */
  initialize: () => Promise<void>;
  /** Set difficulty level */
  setDifficulty: (difficulty: DifficultyLevel) => void;
  /** Toggle permadeath on/off */
  setPermadeath: (enabled: boolean) => void;
  /** Get current modifiers */
  getModifiers: () => DifficultyModifiers;
  /** Check if permadeath is currently active */
  isPermadeathActive: () => boolean;
  /** Get effective XP multiplier including permadeath bonus */
  getEffectiveXPMultiplier: () => number;
  /** Scale a value by enemy health multiplier */
  scaleEnemyHealth: (base: number) => number;
  /** Scale a value by enemy damage multiplier */
  scaleEnemyDamage: (base: number) => number;
  /** Scale a value by player damage received multiplier */
  scalePlayerDamage: (base: number) => number;
  /** Scale XP reward */
  scaleXP: (base: number) => number;
}

type DifficultyStore = DifficultyState & DifficultyActions;

// ============================================================================
// SQLite Persistence
// ============================================================================

const SETTINGS_TABLE = 'difficulty_settings';

async function ensureTable(): Promise<void> {
  await capacitorDb.run(`
    CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

async function loadFromDb(): Promise<Partial<DifficultyState>> {
  try {
    await ensureTable();
    const rows = await capacitorDb.query<{ key: string; value: string }>(
      `SELECT key, value FROM ${SETTINGS_TABLE}`
    );
    const state: Partial<DifficultyState> = {};
    for (const row of rows) {
      if (row.key === 'difficulty') {
        state.difficulty = row.value as DifficultyLevel;
      } else if (row.key === 'permadeathEnabled') {
        state.permadeathEnabled = row.value === 'true';
      }
    }
    return state;
  } catch {
    return {};
  }
}

async function saveToDb(key: string, value: string): Promise<void> {
  try {
    await ensureTable();
    await capacitorDb.run(`INSERT OR REPLACE INTO ${SETTINGS_TABLE} (key, value) VALUES (?, ?)`, [
      key,
      value,
    ]);
  } catch (err) {
    log.error('Failed to save:', err);
  }
}

// ============================================================================
// Store
// ============================================================================

export const useDifficultyStore = create<DifficultyStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    difficulty: DEFAULT_DIFFICULTY,
    permadeathEnabled: false,
    initialized: false,

    // Initialize from SQLite
    initialize: async () => {
      if (get().initialized) return;
      await capacitorDb.init();
      const saved = await loadFromDb();
      set({
        difficulty: saved.difficulty ?? DEFAULT_DIFFICULTY,
        permadeathEnabled: saved.permadeathEnabled ?? false,
        initialized: true,
      });
    },

    // Set difficulty
    setDifficulty: (difficulty) => {
      set({ difficulty });
      saveToDb('difficulty', difficulty);
    },

    // Set permadeath toggle
    setPermadeath: (enabled) => {
      set({ permadeathEnabled: enabled });
      saveToDb('permadeathEnabled', String(enabled));
    },

    // Get current modifiers
    getModifiers: () => {
      return DIFFICULTY_REGISTRY[get().difficulty].modifiers;
    },

    // Check if permadeath is active
    isPermadeathActive: () => {
      const { difficulty, permadeathEnabled } = get();
      return isPermadeathActive(difficulty, permadeathEnabled);
    },

    // Get effective XP multiplier
    getEffectiveXPMultiplier: () => {
      const { difficulty, permadeathEnabled } = get();
      const base = DIFFICULTY_REGISTRY[difficulty].modifiers.xpMultiplier;
      const active = isPermadeathActive(difficulty, permadeathEnabled);
      const forced = DIFFICULTY_REGISTRY[difficulty].modifiers.forcesPermadeath;
      return active && !forced ? base * (1 + PERMADEATH_XP_BONUS) : base;
    },

    // Scaling functions
    scaleEnemyHealth: (base) => {
      return Math.round(base * get().getModifiers().enemyHealthMultiplier);
    },

    scaleEnemyDamage: (base) => {
      return Math.round(base * get().getModifiers().enemyDamageMultiplier);
    },

    scalePlayerDamage: (base) => {
      return Math.round(base * get().getModifiers().playerDamageReceivedMultiplier);
    },

    scaleXP: (base) => {
      return Math.round(base * get().getEffectiveXPMultiplier());
    },
  }))
);

// ============================================================================
// Selectors (for granular subscriptions)
// ============================================================================

export const selectDifficulty = (state: DifficultyStore) => state.difficulty;
export const selectPermadeath = (state: DifficultyStore) => state.permadeathEnabled;
export const selectInitialized = (state: DifficultyStore) => state.initialized;

// ============================================================================
// Non-React Access (for game systems outside React)
// ============================================================================

/** Get current difficulty (non-reactive) */
export function getDifficultyLevel(): DifficultyLevel {
  return useDifficultyStore.getState().difficulty;
}

/** Get current modifiers (non-reactive) */
export function getCurrentModifiers(): DifficultyModifiers {
  return useDifficultyStore.getState().getModifiers();
}

/** Scale enemy health (non-reactive) */
export function scaleEnemyHealth(base: number): number {
  return useDifficultyStore.getState().scaleEnemyHealth(base);
}

/** Scale enemy damage (non-reactive) */
export function scaleEnemyDamage(base: number): number {
  return useDifficultyStore.getState().scaleEnemyDamage(base);
}

/** Scale player damage received (non-reactive) */
export function scalePlayerDamage(base: number): number {
  return useDifficultyStore.getState().scalePlayerDamage(base);
}

/** Scale XP reward (non-reactive) */
export function scaleXP(base: number): number {
  return useDifficultyStore.getState().scaleXP(base);
}

// ============================================================================
// Backward Compatibility (replaces localStorage functions)
// ============================================================================

/**
 * Load difficulty setting from store.
 * @deprecated Use useDifficultyStore() or getDifficultyLevel() instead
 */
export function loadDifficultySetting(): DifficultyLevel {
  return useDifficultyStore.getState().difficulty;
}

/**
 * Save difficulty setting to store.
 * @deprecated Use useDifficultyStore().setDifficulty() instead
 */
export function saveDifficultySetting(difficulty: DifficultyLevel): void {
  useDifficultyStore.getState().setDifficulty(difficulty);
}

/**
 * Load permadeath setting from store.
 * @deprecated Use useDifficultyStore().permadeathEnabled instead
 */
export function loadPermadeathSetting(): boolean {
  return useDifficultyStore.getState().permadeathEnabled;
}

/**
 * Save permadeath setting to store.
 * @deprecated Use useDifficultyStore().setPermadeath() instead
 */
export function savePermadeathSetting(enabled: boolean): void {
  useDifficultyStore.getState().setPermadeath(enabled);
}

// ============================================================================
// Additional Scaling Functions (backward compatibility)
// ============================================================================

/** Scale enemy fire rate (non-reactive) */
export function scaleEnemyFireRate(base: number): number {
  return base * useDifficultyStore.getState().getModifiers().enemyFireRateMultiplier;
}

/** Scale detection range (non-reactive) */
export function scaleDetectionRange(base: number): number {
  return base * useDifficultyStore.getState().getModifiers().enemyDetectionMultiplier;
}

/** Scale spawn count (non-reactive) */
export function scaleSpawnCount(base: number): number {
  return Math.round(base * useDifficultyStore.getState().getModifiers().spawnRateMultiplier);
}

/** Scale resource drop chance (non-reactive) */
export function scaleResourceDropChance(base: number): number {
  const mod = useDifficultyStore.getState().getModifiers().resourceDropMultiplier;
  return Math.min(1, base * mod);
}
