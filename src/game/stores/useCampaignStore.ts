/**
 * useCampaignStore - Zustand store for campaign state management
 *
 * This store manages all campaign-related state including:
 * - Current campaign phase (menu, playing, paused, etc.)
 * - Level progression and unlocks
 * - Per-level progress (completion, best times, kills, etc.)
 * - New Game Plus state
 *
 * The store integrates with CampaignDirector, which remains the facade
 * for dispatching commands and managing complex state transitions.
 */

import type { CampaignPhase, LevelStats } from '../campaign/types';
import type { DifficultyLevel } from '../core/DifficultySettings';
import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import { CAMPAIGN_LEVELS, getNextLevel } from '../levels/types';
import { createPersistedStore } from './createPersistedStore';

const log = getLogger('CampaignStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Progress tracking for a single level
 */
export interface LevelProgress {
  completed: boolean;
  bestTime: number | null;
  deaths: number;
  kills: number;
  secretsFound: number;
  audioLogsFound: number;
  /** Number of times this level has been played */
  playCount: number;
  /** First completion timestamp */
  firstCompletedAt: number | null;
  /** Best completion timestamp */
  bestTimeSetAt: number | null;
}

/**
 * Campaign state managed by the store
 */
export interface CampaignState {
  // ---- Core Phase State ----
  /** Current campaign phase */
  phase: CampaignPhase;
  /** Currently active level */
  currentLevel: LevelId | null;
  /** Current difficulty setting */
  difficulty: DifficultyLevel;

  // ---- Level Progress ----
  /** Progress data for each level */
  levelProgress: Partial<Record<LevelId, LevelProgress>>;

  // ---- Current Level Tracking ----
  /** Kills in current level session */
  levelKills: number;
  /** Damage received in current level session */
  levelDamageReceived: number;
  /** Whether player died in current level */
  diedInCurrentLevel: boolean;
  /** Audio logs found in current level */
  audioLogsFoundInLevel: number;
  /** Start time of current level */
  levelStartTime: number;

  // ---- Campaign-Wide Stats ----
  /** Total deaths across campaign */
  totalDeaths: number;
  /** Total kills across campaign */
  totalCampaignKills: number;
  /** Completion stats from last completed level */
  completionStats: LevelStats | null;

  // ---- NG+ State ----
  /** New Game Plus level (0 = first playthrough) */
  newGamePlusLevel: number;

  // ---- UI State ----
  /** Phase before pause (for resume) */
  prePausePhase: CampaignPhase | null;
  /** Whether intro briefing needs to be shown */
  needsIntroBriefing: boolean;
  /** Counter for React key forcing remounts */
  restartCounter: number;
  /** Whether currently in bonus level */
  isBonusLevel: boolean;
}

/**
 * Campaign store actions
 */
export interface CampaignActions {
  // ---- Initialization ----
  /** Initialize the store (hydrate from persistence) */
  initialize: () => Promise<void>;

  // ---- Phase Management ----
  /** Set the current campaign phase */
  setPhase: (phase: CampaignPhase) => void;
  /** Set phase with pre-pause tracking */
  setPausePhase: (prePausePhase: CampaignPhase) => void;
  /** Clear pre-pause phase on resume */
  clearPausePhase: () => CampaignPhase | null;

  // ---- Level Management ----
  /** Set the current level */
  setCurrentLevel: (levelId: LevelId) => void;
  /** Set difficulty */
  setDifficulty: (difficulty: DifficultyLevel) => void;

  // ---- Level Session ----
  /** Start a new level session */
  startLevelSession: () => void;
  /** Record a kill in the current level */
  recordKill: () => void;
  /** Record damage taken */
  recordDamage: (amount: number) => void;
  /** Record player death */
  recordDeath: () => void;
  /** Record audio log found */
  recordAudioLog: () => void;
  /** Increment restart counter */
  incrementRestartCounter: () => void;

  // ---- Level Completion ----
  /** Mark level as complete and update progress */
  completeLevel: (levelId: LevelId, stats: LevelStats) => void;
  /** Set completion stats for display */
  setCompletionStats: (stats: LevelStats | null) => void;

  // ---- New Game ----
  /** Start a new game */
  newGame: (difficulty: DifficultyLevel, startLevel?: LevelId) => void;
  /** Start New Game Plus */
  newGamePlus: () => void;

  // ---- Bonus Levels ----
  /** Enter bonus level mode */
  enterBonusLevel: () => void;
  /** Exit bonus level mode */
  exitBonusLevel: () => void;

  // ---- Queries ----
  /** Check if a level is unlocked */
  isLevelUnlocked: (levelId: LevelId) => boolean;
  /** Get progress for a level */
  getLevelProgress: (levelId: LevelId) => LevelProgress | null;
  /** Get the next level in the campaign */
  getNextLevel: () => LevelId | null;
  /** Get total completed levels */
  getCompletedLevelCount: () => number;

  // ---- Internal ----
  /** Set needs intro briefing flag */
  setNeedsIntroBriefing: (needs: boolean) => void;
}

/**
 * Complete campaign store type
 */
export type CampaignStoreState = CampaignState & CampaignActions;

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: CampaignState = {
  // Core phase state
  phase: 'idle',
  currentLevel: null,
  difficulty: 'normal',

  // Level progress
  levelProgress: {},

  // Current level tracking
  levelKills: 0,
  levelDamageReceived: 0,
  diedInCurrentLevel: false,
  audioLogsFoundInLevel: 0,
  levelStartTime: 0,

  // Campaign-wide stats
  totalDeaths: 0,
  totalCampaignKills: 0,
  completionStats: null,

  // NG+ state
  newGamePlusLevel: 0,

  // UI state
  prePausePhase: null,
  needsIntroBriefing: false,
  restartCounter: 0,
  isBonusLevel: false,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create default progress for a level
 */
function createDefaultProgress(): LevelProgress {
  return {
    completed: false,
    bestTime: null,
    deaths: 0,
    kills: 0,
    secretsFound: 0,
    audioLogsFound: 0,
    playCount: 0,
    firstCompletedAt: null,
    bestTimeSetAt: null,
  };
}

/**
 * Check if a level is unlocked based on progress
 * First level is always unlocked, others require previous level completion
 */
function checkLevelUnlocked(
  levelId: LevelId,
  levelProgress: Partial<Record<LevelId, LevelProgress>>
): boolean {
  // First level is always unlocked
  if (levelId === 'anchor_station') return true;

  // Check if previous level is completed
  const levelConfig = CAMPAIGN_LEVELS[levelId];
  if (!levelConfig?.previousLevelId) return true;

  const prevProgress = levelProgress[levelConfig.previousLevelId];
  return prevProgress?.completed ?? false;
}

// ============================================================================
// STORE
// ============================================================================

/**
 * Campaign store with SQLite persistence
 *
 * Note: The initialState cast is needed because createPersistedStore's type signature
 * expects Omit<T, keyof PersistedActions> which includes action method types, but
 * initial state only contains data properties. The stateCreator provides the actions.
 */
export const useCampaignStore = createPersistedStore<CampaignStoreState>(
  'campaign',
  initialState as Omit<CampaignStoreState, '_hydrate' | '_persist' | '_reset'>,
  (set, get) => ({
    ...initialState,

    // ---- Initialization ----
    initialize: async () => {
      // Access _initialized and _hydrate from PersistedStore wrapper
      type PersistedWrapper = CampaignStoreState & {
        _initialized: boolean;
        _hydrate: () => Promise<void>;
      };
      const state = get() as unknown as PersistedWrapper;
      if (state._initialized) return;

      await state._hydrate();
      log.info('Campaign store initialized');
    },

    // ---- Phase Management ----
    setPhase: (phase) => {
      set({ phase });
    },

    setPausePhase: (prePausePhase) => {
      set({ prePausePhase, phase: 'paused' });
    },

    clearPausePhase: () => {
      const { prePausePhase } = get();
      set({ prePausePhase: null });
      return prePausePhase;
    },

    // ---- Level Management ----
    setCurrentLevel: (levelId) => {
      set({ currentLevel: levelId });
    },

    setDifficulty: (difficulty) => {
      set({ difficulty });
    },

    // ---- Level Session ----
    startLevelSession: () => {
      const { currentLevel, levelProgress } = get();

      // Increment play count for current level
      if (currentLevel) {
        const existing = levelProgress[currentLevel] ?? createDefaultProgress();
        set({
          levelKills: 0,
          levelDamageReceived: 0,
          diedInCurrentLevel: false,
          audioLogsFoundInLevel: 0,
          levelStartTime: Date.now(),
          levelProgress: {
            ...levelProgress,
            [currentLevel]: {
              ...existing,
              playCount: existing.playCount + 1,
            },
          },
        });
      } else {
        set({
          levelKills: 0,
          levelDamageReceived: 0,
          diedInCurrentLevel: false,
          audioLogsFoundInLevel: 0,
          levelStartTime: Date.now(),
        });
      }
    },

    recordKill: () => {
      set((state) => ({ levelKills: state.levelKills + 1 }));
    },

    recordDamage: (amount) => {
      set((state) => ({ levelDamageReceived: state.levelDamageReceived + amount }));
    },

    recordDeath: () => {
      const { currentLevel, levelProgress } = get();
      const newTotalDeaths = get().totalDeaths + 1;

      // Update level-specific death count
      if (currentLevel) {
        const existing = levelProgress[currentLevel] ?? createDefaultProgress();
        set({
          totalDeaths: newTotalDeaths,
          diedInCurrentLevel: true,
          levelProgress: {
            ...levelProgress,
            [currentLevel]: {
              ...existing,
              deaths: existing.deaths + 1,
            },
          },
        });
      } else {
        set({
          totalDeaths: newTotalDeaths,
          diedInCurrentLevel: true,
        });
      }
    },

    recordAudioLog: () => {
      set((state) => ({ audioLogsFoundInLevel: state.audioLogsFoundInLevel + 1 }));
    },

    incrementRestartCounter: () => {
      set((state) => ({ restartCounter: state.restartCounter + 1 }));
    },

    // ---- Level Completion ----
    completeLevel: (levelId, stats) => {
      const { levelProgress, levelKills, audioLogsFoundInLevel, totalCampaignKills } = get();
      const existing = levelProgress[levelId] ?? createDefaultProgress();
      const now = Date.now();

      // Check if new best time
      const isNewBestTime = existing.bestTime === null || stats.timeElapsed < existing.bestTime;

      // Update progress
      const updatedProgress: LevelProgress = {
        ...existing,
        completed: true,
        bestTime: isNewBestTime ? stats.timeElapsed : existing.bestTime,
        kills: existing.kills + levelKills,
        secretsFound: Math.max(existing.secretsFound, stats.secretsFound),
        audioLogsFound: Math.max(existing.audioLogsFound, audioLogsFoundInLevel),
        firstCompletedAt: existing.firstCompletedAt ?? now,
        bestTimeSetAt: isNewBestTime ? now : existing.bestTimeSetAt,
      };

      set({
        levelProgress: {
          ...levelProgress,
          [levelId]: updatedProgress,
        },
        totalCampaignKills: totalCampaignKills + levelKills,
        completionStats: stats,
      });

      if (isNewBestTime) {
        log.info(`New best time for ${levelId}: ${stats.timeElapsed.toFixed(2)}s`);
      }
    },

    setCompletionStats: (stats) => {
      set({ completionStats: stats });
    },

    // ---- New Game ----
    newGame: (difficulty, startLevel = 'anchor_station') => {
      set({
        ...initialState,
        phase: 'idle', // Will be updated by CampaignDirector
        currentLevel: startLevel,
        difficulty,
        // Preserve NG+ level
        newGamePlusLevel: get().newGamePlusLevel,
      });
      log.info(`New game started: difficulty=${difficulty}, startLevel=${startLevel}`);
    },

    newGamePlus: () => {
      const { newGamePlusLevel, difficulty } = get();
      set({
        ...initialState,
        phase: 'idle',
        currentLevel: 'anchor_station',
        difficulty,
        newGamePlusLevel: newGamePlusLevel + 1,
      });
      log.info(`New Game Plus started: level=${newGamePlusLevel + 1}`);
    },

    // ---- Bonus Levels ----
    enterBonusLevel: () => {
      set({ isBonusLevel: true });
    },

    exitBonusLevel: () => {
      set({ isBonusLevel: false });
    },

    // ---- Queries ----
    isLevelUnlocked: (levelId) => {
      return checkLevelUnlocked(levelId, get().levelProgress);
    },

    getLevelProgress: (levelId) => {
      return get().levelProgress[levelId] ?? null;
    },

    getNextLevel: () => {
      const { currentLevel } = get();
      if (!currentLevel) return 'anchor_station';
      const nextEntry = getNextLevel(currentLevel);
      return nextEntry?.id ?? null;
    },

    getCompletedLevelCount: () => {
      const { levelProgress } = get();
      return Object.values(levelProgress).filter((p) => p?.completed).length;
    },

    // ---- Internal ----
    setNeedsIntroBriefing: (needs) => {
      set({ needsIntroBriefing: needs });
    },
  }),
  {
    // Exclude runtime-only state from persistence
    excludeKeys: [
      'levelKills',
      'levelDamageReceived',
      'diedInCurrentLevel',
      'audioLogsFoundInLevel',
      'levelStartTime',
      'completionStats',
      'prePausePhase',
      'restartCounter',
      'isBonusLevel',
    ] as (keyof CampaignState)[],
    onHydrate: (state) => {
      log.debug(`Hydrated campaign: phase=${state.phase}, level=${state.currentLevel}`);
    },
  }
);

// ============================================================================
// SELECTORS (for use with subscribeWithSelector)
// ============================================================================

export const selectPhase = (state: CampaignStoreState) => state.phase;
export const selectCurrentLevel = (state: CampaignStoreState) => state.currentLevel;
export const selectDifficulty = (state: CampaignStoreState) => state.difficulty;
export const selectLevelProgress = (state: CampaignStoreState) => state.levelProgress;
export const selectTotalDeaths = (state: CampaignStoreState) => state.totalDeaths;
export const selectTotalKills = (state: CampaignStoreState) => state.totalCampaignKills;
export const selectNewGamePlusLevel = (state: CampaignStoreState) => state.newGamePlusLevel;
export const selectCompletionStats = (state: CampaignStoreState) => state.completionStats;
export const selectInitialized = (state: CampaignStoreState) =>
  (state as CampaignStoreState & { _initialized: boolean })._initialized;

// ============================================================================
// NON-REACT ACCESSORS
// ============================================================================

/**
 * Get current phase (non-reactive)
 */
export function getCampaignPhase(): CampaignPhase {
  return useCampaignStore.getState().phase;
}

/**
 * Get current level (non-reactive)
 */
export function getCurrentLevel(): LevelId | null {
  return useCampaignStore.getState().currentLevel;
}

/**
 * Get campaign difficulty (non-reactive)
 */
export function getCampaignDifficulty(): DifficultyLevel {
  return useCampaignStore.getState().difficulty;
}

/**
 * Check if level is unlocked (non-reactive)
 */
export function isLevelUnlocked(levelId: LevelId): boolean {
  return useCampaignStore.getState().isLevelUnlocked(levelId);
}

/**
 * Subscribe to specific state changes
 */
export function subscribeToCampaign<T>(
  selector: (state: CampaignStoreState) => T,
  listener: (value: T, prevValue: T) => void
): () => void {
  return useCampaignStore.subscribe(selector, listener);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the campaign store
 * Should be called early in app startup
 */
export async function initializeCampaignStore(): Promise<void> {
  await useCampaignStore.getState().initialize();
}
