/**
 * useAchievementsStore - Zustand store for achievements with SQLite persistence
 *
 * Replaces the legacy AchievementManager singleton with a modern Zustand store that:
 * - Persists achievement state to SQLite via SaveSystem
 * - Emits ACHIEVEMENT_UNLOCKED events via EventBus
 * - Tracks all achievement progress and stats
 * - Provides type-safe access to all achievement data
 *
 * Usage:
 * ```ts
 * import { useAchievementsStore } from '../stores/useAchievementsStore';
 *
 * // In a component:
 * const unlocked = useAchievementsStore((state) => state.unlocked);
 * const onKill = useAchievementsStore((state) => state.onKill);
 *
 * // Outside React:
 * const store = useAchievementsStore.getState();
 * store.onKill(85); // Track kill with player health at 85%
 * ```
 */

import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementId,
  LEVEL_PAR_TIMES,
} from '../achievements/types';
import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import { createPersistedStore } from './createPersistedStore';

const log = getLogger('AchievementsStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Progress stats returned by getProgress()
 */
export interface ProgressStats {
  totalKills: number;
  levelKills: number;
  secretsFound: number;
  levelSecretsFound: number;
  audioLogsFound: number;
  shotsFired: number;
  shotsHit: number;
  levelShotsFired: number;
  levelShotsHit: number;
  campaignStartTime: number | null;
  levelStartTime: number | null;
  currentLevel: LevelId | null;
  levelDamageTaken: number;
  marcusWentDown: boolean;
}

/**
 * Level stats for completion screen
 */
export interface LevelStatsResult {
  shotsFired: number;
  shotsHit: number;
  secretsFound: number;
  kills: number;
}

/**
 * Achievement with its unlock state
 * Note: 'state' property is provided for backward compatibility with old AchievementManager API
 */
export interface AchievementWithState {
  achievement: Achievement;
  unlockedAt: number | null;
  /** @deprecated Use unlockedAt directly - kept for backward compatibility */
  state: { unlockedAt: number | null };
  progress?: number;
  progressCurrent?: number;
  progressTarget?: number;
}

/**
 * Achievements store state (excluding actions)
 */
export interface AchievementsState {
  /** Set of unlocked achievement IDs */
  unlocked: Set<AchievementId>;

  // Stats tracking
  totalKills: number;
  levelKills: number;
  secretsFound: number;
  levelSecretsFound: number;
  audioLogsFound: number;
  shotsFired: number;
  shotsHit: number;
  levelShotsFired: number;
  levelShotsHit: number;
  campaignStartTime: number | null;
  levelStartTime: number | null;
  currentLevel: LevelId | null;
  levelDamageTaken: number;
  marcusWentDown: boolean;
  recentKillTimestamps: number[];
  unlockedTimestamps: Record<AchievementId, number>;
}

/**
 * Achievements store actions
 */
export interface AchievementsActions {
  // Core actions
  unlock: (id: AchievementId) => boolean;
  isUnlocked: (id: AchievementId) => boolean;
  getProgress: () => ProgressStats;
  getUnlockedCount: () => number;
  getTotalCount: () => number;
  getAllAchievements: () => AchievementWithState[];
  getLevelStats: () => LevelStatsResult;
  getLevelAccuracy: () => number;
  getOverallAccuracy: () => number;
  getLevelSecretsFound: () => number;
  getLevelShotsFired: () => number;
  getLevelShotsHit: () => number;

  // Trigger methods (called by game systems)
  onTutorialComplete: () => void;
  onHaloDropComplete: () => void;
  onLevelStart: (levelId: LevelId) => void;
  onDamageTaken: (levelId: LevelId, damage: number) => void;
  onLevelComplete: (levelId: LevelId, playerDied: boolean, difficulty?: string) => void;
  onMarcusFound: () => void;
  onQueenDefeated: () => void;
  onGameComplete: () => void;
  onCampaignStart: () => void;
  onKill: (healthPercent?: number) => void;
  onFirstCombatWin: () => void;
  onBrothersInArmsComplete: (marcusWentDown: boolean) => void;
  onCanyonRunComplete: () => void;
  onSouthernIceComplete: () => void;
  onHiveAssaultComplete: () => void;
  onExtractionComplete: () => void;
  onFinalEscapeComplete: (crashed: boolean) => void;
  onMarcusDown: () => void;
  resetMarcusTracking: () => void;
  onSecretFound: () => void;
  onAudioLogFound: () => void;
  onAllAreasDiscovered: () => void;
  onAllCollectiblesFound: () => void;
  onFobDeltaFullyExplored: () => void;
  onMultiKill: (killCount: number) => void;
  onExplosionKill: (killCount: number) => void;
  onKillAtLowHealth: (healthPercent: number) => void;
  onShotFired: () => void;
  onShotHit: () => void;

  // Debug/Admin
  resetAll: () => void;
  unlockAll: () => void;

  // Legacy callback API (for backward compatibility)
  /** @deprecated Use EventBus.on('ACHIEVEMENT_UNLOCKED') instead */
  onUnlock: (callback: (achievement: Achievement) => void) => () => void;
}

// Combined type for the full store
export type AchievementsStoreState = AchievementsState & AchievementsActions;

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

/**
 * Serialize Set to array for JSON storage
 */
function serializeState(state: Partial<AchievementsState>): string {
  const serializable = {
    ...state,
    unlocked: state.unlocked ? Array.from(state.unlocked) : [],
  };
  return JSON.stringify(serializable);
}

/**
 * Deserialize array back to Set
 */
function deserializeState(data: string): Partial<AchievementsState> {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    unlocked: new Set(parsed.unlocked || []),
  };
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AchievementsState = {
  unlocked: new Set<AchievementId>(),
  totalKills: 0,
  levelKills: 0,
  secretsFound: 0,
  levelSecretsFound: 0,
  audioLogsFound: 0,
  shotsFired: 0,
  shotsHit: 0,
  levelShotsFired: 0,
  levelShotsHit: 0,
  campaignStartTime: null,
  levelStartTime: null,
  currentLevel: null,
  levelDamageTaken: 0,
  marcusWentDown: false,
  recentKillTimestamps: [],
  unlockedTimestamps: {} as Record<AchievementId, number>,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useAchievementsStore = createPersistedStore<AchievementsStoreState>(
  'achievements',
  initialState as Omit<AchievementsStoreState, '_hydrate' | '_persist' | '_reset'>,
  (set, get) => ({
    // Initial state values
    ...initialState,

    // ========================================================================
    // CORE ACTIONS
    // ========================================================================

    unlock: (id: AchievementId): boolean => {
      const state = get();
      if (state.unlocked.has(id)) {
        return false; // Already unlocked
      }

      const achievement = ACHIEVEMENTS[id];
      if (!achievement) {
        log.warn(`Unknown achievement: ${id}`);
        return false;
      }

      const now = Date.now();
      set((s) => ({
        unlocked: new Set([...s.unlocked, id]),
        unlockedTimestamps: { ...s.unlockedTimestamps, [id]: now },
      }));

      log.info(`Achievement unlocked: ${achievement.name}`);

      // Emit event via EventBus
      getEventBus().emit({
        type: 'ACHIEVEMENT_UNLOCKED',
        achievementId: id,
        achievement,
      });

      return true;
    },

    isUnlocked: (id: AchievementId): boolean => {
      return get().unlocked.has(id);
    },

    getProgress: (): ProgressStats => {
      const state = get();
      return {
        totalKills: state.totalKills,
        levelKills: state.levelKills,
        secretsFound: state.secretsFound,
        levelSecretsFound: state.levelSecretsFound,
        audioLogsFound: state.audioLogsFound,
        shotsFired: state.shotsFired,
        shotsHit: state.shotsHit,
        levelShotsFired: state.levelShotsFired,
        levelShotsHit: state.levelShotsHit,
        campaignStartTime: state.campaignStartTime,
        levelStartTime: state.levelStartTime,
        currentLevel: state.currentLevel,
        levelDamageTaken: state.levelDamageTaken,
        marcusWentDown: state.marcusWentDown,
      };
    },

    getUnlockedCount: (): number => {
      return get().unlocked.size;
    },

    getTotalCount: (): number => {
      return Object.keys(ACHIEVEMENTS).length;
    },

    getAllAchievements: (): AchievementWithState[] => {
      const state = get();
      return (Object.keys(ACHIEVEMENTS) as AchievementId[]).map((id) => {
        const achievement = ACHIEVEMENTS[id];
        const unlockedAt = state.unlockedTimestamps[id] ?? null;
        const result: AchievementWithState = {
          achievement,
          unlockedAt,
          state: { unlockedAt }, // Backward compatibility
        };

        // Calculate progress for progressive achievements
        if (achievement.progressTarget && achievement.progressKey) {
          let currentValue = 0;
          switch (achievement.progressKey) {
            case 'totalKills':
              currentValue = state.totalKills;
              break;
            case 'secretsFound':
              currentValue = state.secretsFound;
              break;
            case 'audioLogsFound':
              currentValue = state.audioLogsFound;
              break;
          }
          result.progressCurrent = currentValue;
          result.progressTarget = achievement.progressTarget;
          result.progress = Math.min(
            100,
            Math.round((currentValue / achievement.progressTarget) * 100)
          );
        }

        return result;
      });
    },

    getLevelStats: (): LevelStatsResult => {
      const state = get();
      return {
        shotsFired: state.levelShotsFired,
        shotsHit: state.levelShotsHit,
        secretsFound: state.levelSecretsFound,
        kills: state.levelKills,
      };
    },

    getLevelAccuracy: (): number => {
      const state = get();
      if (state.levelShotsFired === 0) return 0;
      return Math.round((state.levelShotsHit / state.levelShotsFired) * 100);
    },

    getOverallAccuracy: (): number => {
      const state = get();
      if (state.shotsFired === 0) return 0;
      return Math.round((state.shotsHit / state.shotsFired) * 100);
    },

    getLevelSecretsFound: (): number => {
      return get().levelSecretsFound;
    },

    getLevelShotsFired: (): number => {
      return get().levelShotsFired;
    },

    getLevelShotsHit: (): number => {
      return get().levelShotsHit;
    },

    // ========================================================================
    // TRIGGER METHODS
    // ========================================================================

    onTutorialComplete: () => {
      get().unlock('first_steps');
    },

    onHaloDropComplete: () => {
      get().unlock('odst');
    },

    onLevelStart: (levelId: LevelId) => {
      set({
        currentLevel: levelId,
        levelKills: 0,
        levelShotsFired: 0,
        levelShotsHit: 0,
        levelSecretsFound: 0,
        levelDamageTaken: 0,
        levelStartTime: Date.now(),
        marcusWentDown: false,
      });
    },

    onDamageTaken: (levelId: LevelId, damage: number) => {
      const state = get();
      if (state.currentLevel === levelId) {
        set({ levelDamageTaken: state.levelDamageTaken + damage });
      }
    },

    onLevelComplete: (levelId: LevelId, playerDied: boolean, difficulty?: string) => {
      const state = get();
      const levelTime = state.levelStartTime ? Date.now() - state.levelStartTime : Infinity;
      const parTime = LEVEL_PAR_TIMES[levelId];

      // Check for survivor achievement (FOB Delta without dying)
      if (levelId === 'fob_delta' && !playerDied) {
        state.unlock('survivor');
      }

      // Check for untouchable achievement (any level without damage)
      if (state.levelDamageTaken === 0) {
        state.unlock('untouchable');
      }

      // Check for headhunter achievement (50 kills in a level)
      if (state.levelKills >= 50) {
        state.unlock('headhunter');
      }

      // Check for sharpshooter achievement (80%+ accuracy with min 20 shots)
      if (state.levelShotsFired >= 20) {
        const accuracy = state.levelShotsHit / state.levelShotsFired;
        if (accuracy >= 0.8) {
          state.unlock('sharpshooter');
        }
      }

      // Check for Speed Demon achievements
      if (parTime && levelTime < parTime) {
        switch (levelId) {
          case 'landfall':
            state.unlock('speed_demon_landfall');
            break;
          case 'canyon_run':
            state.unlock('speed_demon_canyon');
            break;
          case 'fob_delta':
            state.unlock('speed_demon_fob');
            break;
          case 'brothers_in_arms':
            state.unlock('speed_demon_brothers');
            break;
          case 'southern_ice':
            state.unlock('speed_demon_ice');
            break;
          case 'final_escape':
            state.unlock('speed_demon_escape');
            break;
        }
      }

      // Check for iron marine (complete on Insane difficulty)
      if (difficulty === 'insane') {
        state.unlock('iron_marine');
      }

      // Check for perfect drop (Landfall with 100% accuracy and no damage)
      if (
        levelId === 'landfall' &&
        state.levelDamageTaken === 0 &&
        state.levelShotsFired > 0 &&
        state.levelShotsHit === state.levelShotsFired
      ) {
        state.unlock('perfect_drop');
      }
    },

    onMarcusFound: () => {
      get().unlock('reunited');
    },

    onQueenDefeated: () => {
      get().unlock('queen_slayer');
    },

    onGameComplete: () => {
      const state = get();
      state.unlock('great_escape');
      state.unlock('campaign_veteran');

      // Check for speedrunner (under 60 minutes for 10 levels)
      if (state.campaignStartTime) {
        const elapsedMs = Date.now() - state.campaignStartTime;
        const sixtyMinutesMs = 60 * 60 * 1000;
        if (elapsedMs < sixtyMinutesMs) {
          state.unlock('speedrunner');
        }
      }
    },

    onCampaignStart: () => {
      set({
        campaignStartTime: Date.now(),
        levelDamageTaken: 0,
      });
    },

    onKill: (healthPercent?: number) => {
      const state = get();
      const wasFirstKill = state.totalKills === 0;
      const now = Date.now();
      const threeSecondsAgo = now - 3000;

      // Filter recent kill timestamps and add current
      const recentKills = [...state.recentKillTimestamps.filter((t) => t > threeSecondsAgo), now];

      set({
        totalKills: state.totalKills + 1,
        levelKills: state.levelKills + 1,
        recentKillTimestamps: recentKills,
      });

      // Check for first blood achievement
      if (wasFirstKill) {
        get().unlock('first_blood');
      }

      // Check for exterminator achievement (100 kills)
      if (state.totalKills + 1 >= 100) {
        get().unlock('exterminator');
      }

      // Check for mass extinction achievement (500 kills)
      if (state.totalKills + 1 >= 500) {
        get().unlock('mass_extinction');
      }

      // Check for last stand achievement (kill while below 10% health)
      if (healthPercent !== undefined && healthPercent < 10) {
        get().unlock('last_stand');
      }

      // Check for multi-kill (5 kills in 3 seconds)
      if (recentKills.length >= 5) {
        get().unlock('multi_kill');
      }
    },

    onFirstCombatWin: () => {
      get().unlock('baptism_by_fire');
    },

    onBrothersInArmsComplete: (marcusWentDown: boolean) => {
      if (!marcusWentDown) {
        get().unlock('brothers_keeper');
      }
    },

    onCanyonRunComplete: () => {
      get().unlock('road_warrior');
    },

    onSouthernIceComplete: () => {
      get().unlock('ice_breaker');
    },

    onHiveAssaultComplete: () => {
      get().unlock('total_war');
    },

    onExtractionComplete: () => {
      get().unlock('extracted');
    },

    onFinalEscapeComplete: (crashed: boolean) => {
      if (!crashed) {
        get().unlock('flawless_run');
      }
    },

    onMarcusDown: () => {
      set({ marcusWentDown: true });
    },

    resetMarcusTracking: () => {
      set({ marcusWentDown: false });
    },

    onSecretFound: () => {
      const state = get();
      const newSecretsFound = state.secretsFound + 1;
      const newLevelSecretsFound = state.levelSecretsFound + 1;

      set({
        secretsFound: newSecretsFound,
        levelSecretsFound: newLevelSecretsFound,
      });

      // Check for curious achievement (first secret)
      if (newSecretsFound === 1) {
        get().unlock('curious');
      }

      // Check for secret hunter achievement (10 secrets)
      if (newSecretsFound >= 10) {
        get().unlock('secret_hunter');
      }
    },

    onAudioLogFound: () => {
      const state = get();
      const newAudioLogsFound = state.audioLogsFound + 1;

      set({ audioLogsFound: newAudioLogsFound });

      // Check for log collector achievement (all 18 logs)
      if (newAudioLogsFound >= 18) {
        get().unlock('log_collector');
      }
    },

    onAllAreasDiscovered: () => {
      get().unlock('explorer');
    },

    onAllCollectiblesFound: () => {
      get().unlock('thorough');
    },

    onFobDeltaFullyExplored: () => {
      get().unlock('cartographer');
    },

    onMultiKill: (killCount: number) => {
      if (killCount >= 5) {
        get().unlock('multi_kill');
      }
    },

    onExplosionKill: (killCount: number) => {
      if (killCount >= 3) {
        get().unlock('grenadier');
      }
    },

    onKillAtLowHealth: (healthPercent: number) => {
      if (healthPercent < 10) {
        get().unlock('last_stand');
      }
    },

    onShotFired: () => {
      const state = get();
      set({
        shotsFired: state.shotsFired + 1,
        levelShotsFired: state.levelShotsFired + 1,
      });
    },

    onShotHit: () => {
      const state = get();
      set({
        shotsHit: state.shotsHit + 1,
        levelShotsHit: state.levelShotsHit + 1,
      });
    },

    // ========================================================================
    // DEBUG/ADMIN
    // ========================================================================

    resetAll: () => {
      set({
        ...initialState,
        unlocked: new Set<AchievementId>(),
        unlockedTimestamps: {} as Record<AchievementId, number>,
      });
      log.info('All achievements reset');
    },

    unlockAll: () => {
      const now = Date.now();
      const allIds = Object.keys(ACHIEVEMENTS) as AchievementId[];
      const timestamps: Record<AchievementId, number> = {} as Record<AchievementId, number>;
      for (const id of allIds) {
        timestamps[id] = now;
      }
      set({
        unlocked: new Set(allIds),
        unlockedTimestamps: timestamps,
      });
      log.info('All achievements unlocked');
    },

    // ========================================================================
    // LEGACY CALLBACK API (for backward compatibility)
    // ========================================================================

    onUnlock: (callback: (achievement: Achievement) => void): (() => void) => {
      // Subscribe to EventBus and wrap the callback
      const bus = getEventBus();
      return bus.on('ACHIEVEMENT_UNLOCKED', (event) => {
        callback(event.achievement);
      });
    },
  }),
  {
    serialize: serializeState,
    deserialize: deserializeState,
    onHydrate: () => {
      log.info('Achievements store hydrated');
    },
  }
);

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the achievements store state (for use outside React)
 */
export function getAchievementsStore(): AchievementsStoreState {
  return useAchievementsStore.getState();
}

/**
 * Initialize the achievements store (hydrate from persistence)
 * Call this during app startup before rendering
 */
export async function initializeAchievementsStore(): Promise<void> {
  await useAchievementsStore.getState()._hydrate();
}

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Legacy compatibility function - returns the store state
 * Matches the old getAchievementManager() API pattern
 * @deprecated Use useAchievementsStore directly
 */
export function getAchievementManager(): AchievementsStoreState {
  return useAchievementsStore.getState();
}

/**
 * Legacy compatibility function for initialization
 * @deprecated Use initializeAchievementsStore directly
 */
export async function initAchievements(): Promise<void> {
  await initializeAchievementsStore();
}
