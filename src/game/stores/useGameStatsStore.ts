/**
 * useGameStatsStore - Zustand store for campaign statistics with SQLite persistence
 *
 * Consolidates previously-scattered localStorage game state into a single
 * persisted Zustand store. Replaces:
 * - stellar_descent_death_count (DeathScreen)
 * - stellar_descent_best_${levelId} (LevelCompletionScreen)
 * - stellar_descent_best_times (GameTimer)
 * - stellar_descent_weapon_usage (never written, removed)
 *
 * Usage:
 * ```ts
 * import { useGameStatsStore } from '../stores/useGameStatsStore';
 *
 * // In a component:
 * const deathCount = useGameStatsStore((s) => s.deathCount);
 *
 * // Outside React:
 * useGameStatsStore.getState().incrementDeathCount();
 * ```
 */

import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import { createPersistedStore } from './createPersistedStore';

const log = getLogger('GameStatsStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Best stats stored per level (from LevelCompletionScreen)
 */
export interface LevelBestStatsData {
  bestTime: number;
  bestKills: number;
  bestAccuracy: number;
  bestHeadshots: number;
  lowestDamageTaken: number;
  lowestDeaths: number;
  bestRating: string;
}

/**
 * Best time entry per level (from GameTimer)
 */
export interface BestTimeEntry {
  levelId: LevelId;
  bestTimeSeconds: number;
  achievedAt: number;
}

/**
 * Store state (persisted fields)
 */
export interface GameStatsState {
  /** Total death count across all sessions */
  deathCount: number;
  /** Best stats per level (from level completion screen) */
  levelBestStats: Partial<Record<LevelId, LevelBestStatsData>>;
  /** Best times per level (from GameTimer speedrun tracking) */
  bestTimes: Partial<Record<LevelId, BestTimeEntry>>;
}

/**
 * Store actions
 */
export interface GameStatsActions {
  /** Increment death counter by 1 */
  incrementDeathCount: () => void;
  /** Get current death count */
  getDeathCount: () => number;
  /** Save or update best stats for a level */
  saveLevelBestStats: (levelId: LevelId, stats: LevelBestStatsData) => void;
  /** Get best stats for a level */
  getLevelBestStats: (levelId: LevelId) => LevelBestStatsData | null;
  /** Check and save best time, returns true if new best */
  checkAndSaveBestTime: (levelId: LevelId, timeSeconds: number) => boolean;
  /** Get best time for a level */
  getBestTime: (levelId: LevelId) => number | null;
  /** Get all best times */
  getAllBestTimes: () => Partial<Record<LevelId, BestTimeEntry>>;
  /** Clear best time for a level (dev/testing) */
  clearBestTime: (levelId: LevelId) => void;
  /** Clear all best times (dev/testing) */
  clearAllBestTimes: () => void;
  /** Initialize the store (hydrate from SQLite) */
  initialize: () => Promise<void>;
}

export type GameStatsStoreState = GameStatsState & GameStatsActions;

// ============================================================================
// INITIAL STATE
// ============================================================================

const INITIAL_STATE: GameStatsState = {
  deathCount: 0,
  levelBestStats: {},
  bestTimes: {},
};

// ============================================================================
// STORE
// ============================================================================

export const useGameStatsStore = createPersistedStore<GameStatsStoreState>(
  'game_stats',
  INITIAL_STATE as Omit<GameStatsStoreState, '_hydrate' | '_persist' | '_reset'>,
  (set, get) => ({
    ...INITIAL_STATE,

    incrementDeathCount: () => {
      set((state) => ({
        ...state,
        deathCount: state.deathCount + 1,
      }));
    },

    getDeathCount: () => get().deathCount,

    saveLevelBestStats: (levelId: LevelId, stats: LevelBestStatsData) => {
      set((state) => ({
        ...state,
        levelBestStats: {
          ...state.levelBestStats,
          [levelId]: stats,
        },
      }));
    },

    getLevelBestStats: (levelId: LevelId) => {
      return get().levelBestStats[levelId] ?? null;
    },

    checkAndSaveBestTime: (levelId: LevelId, timeSeconds: number) => {
      const existing = get().bestTimes[levelId];

      if (!existing || timeSeconds < existing.bestTimeSeconds) {
        set((state) => ({
          ...state,
          bestTimes: {
            ...state.bestTimes,
            [levelId]: {
              levelId,
              bestTimeSeconds: timeSeconds,
              achievedAt: Date.now(),
            },
          },
        }));
        log.info(`New best time for ${levelId}: ${timeSeconds.toFixed(2)}s`);
        return true;
      }

      return false;
    },

    getBestTime: (levelId: LevelId) => {
      return get().bestTimes[levelId]?.bestTimeSeconds ?? null;
    },

    getAllBestTimes: () => get().bestTimes,

    clearBestTime: (levelId: LevelId) => {
      set((state) => {
        const newBestTimes = { ...state.bestTimes };
        delete newBestTimes[levelId];
        return { ...state, bestTimes: newBestTimes };
      });
    },

    clearAllBestTimes: () => {
      set((state) => ({ ...state, bestTimes: {} }));
    },

    initialize: async () => {
      await get()._hydrate();
    },
  })
);

// ============================================================================
// NON-REACT ACCESSORS
// ============================================================================

/**
 * Get store instance for use outside React components
 */
export function getGameStatsStore() {
  return useGameStatsStore.getState();
}

/**
 * Initialize the game stats store (call during app startup)
 */
export async function initializeGameStatsStore(): Promise<void> {
  await useGameStatsStore.getState().initialize();
}
