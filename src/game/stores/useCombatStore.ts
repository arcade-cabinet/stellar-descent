/**
 * useCombatStore - Zustand store for combat runtime statistics
 *
 * This is a NON-PERSISTED store that tracks the current session's combat stats.
 * It provides real-time combat metrics for the HUD and level completion screens.
 *
 * Key features:
 * - Kill tracking with enemy type and XP
 * - Damage dealt/taken tracking
 * - Shot accuracy tracking
 * - EventBus integration for combat events
 *
 * Usage:
 * ```ts
 * import { useCombatStore } from '../stores/useCombatStore';
 *
 * // In a component:
 * const kills = useCombatStore((state) => state.kills);
 * const accuracy = useCombatStore((state) => state.accuracy);
 *
 * // Direct access for game systems:
 * import { getCombatStore } from '../stores/useCombatStore';
 * getCombatStore().recordKill('soldier', 100);
 * ```
 */

import { getAchievementManager } from '../achievements';
import { getAudioManager, type MusicTrack } from '../core/AudioManager';
import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import { createStore } from './createPersistedStore';

const log = getLogger('CombatStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Kill record for tracking enemy types killed
 */
export interface KillRecord {
  enemyType: string;
  count: number;
  totalXp: number;
}

/**
 * Combat state (excluding actions)
 */
export interface CombatState {
  /** Total kills this session */
  kills: number;
  /** Total damage dealt to enemies */
  damageDealt: number;
  /** Total damage taken by player */
  damageTaken: number;
  /** Total shots fired */
  shotsFired: number;
  /** Total shots that hit */
  shotsHit: number;
  /** Total headshots */
  headshots: number;
  /** Total critical hits */
  criticalHits: number;
  /** Total XP earned from kills */
  xpEarned: number;
  /** Kills by enemy type */
  killsByType: Record<string, KillRecord>;
  /** Current kill streak (resets on player damage) */
  killStreak: number;
  /** Best kill streak this session */
  bestKillStreak: number;
  /** Time of last kill (for combo tracking) */
  lastKillTime: number;

  // --- UI state (migrated from CombatContext) ---

  /** Whether player is in calibration mode (shooting range) */
  isCalibrating: boolean;
  /** Whether player is actively in combat (auto-decays after 8s) */
  inCombat: boolean;
}

/**
 * Combat store actions
 */
export interface CombatActions {
  /** Record a kill */
  recordKill: (enemyType: string, xp: number, isHeadshot?: boolean, isCritical?: boolean) => void;
  /** Record damage dealt to enemy */
  recordDamageDealt: (amount: number) => void;
  /** Record damage taken by player */
  recordDamageTaken: (amount: number) => void;
  /** Record a shot fired */
  recordShot: (hit: boolean, isHeadshot?: boolean, isCritical?: boolean) => void;
  /** Record a headshot specifically */
  recordHeadshot: () => void;
  /** Record a critical hit */
  recordCriticalHit: () => void;
  /** Get current accuracy percentage (0-100) */
  getAccuracy: () => number;
  /** Get kills for a specific enemy type */
  getKillsForType: (enemyType: string) => number;
  /** Check if currently on a kill streak (3+ kills) */
  isOnStreak: () => boolean;
  /** Reset combat stats (for new level/session) */
  reset: () => void;
  /** Reset kill streak (called when player takes damage) */
  resetStreak: () => void;

  // --- UI actions (migrated from CombatContext) ---

  /** Set calibration mode (shooting range) */
  setIsCalibrating: (value: boolean) => void;
  /** Set combat state (auto-decays after 8s of no activity) */
  setInCombat: (value: boolean) => void;
  /** Simple kill increment + achievement tracking (legacy callback support) */
  addKill: () => void;
}

/**
 * Combined combat store state
 */
export type CombatStoreState = CombatState & CombatActions;

// ============================================================================
// CONSTANTS
// ============================================================================

const COMBO_WINDOW_MS = 3000; // 3 seconds for combo
const STREAK_THRESHOLD = 3; // Kills needed for streak
const COMBAT_DECAY_MS = 8000; // 8 seconds before combat state auto-decays

const initialState: CombatState = {
  kills: 0,
  damageDealt: 0,
  damageTaken: 0,
  shotsFired: 0,
  shotsHit: 0,
  headshots: 0,
  criticalHits: 0,
  xpEarned: 0,
  killsByType: {},
  killStreak: 0,
  bestKillStreak: 0,
  lastKillTime: 0,
  isCalibrating: false,
  inCombat: false,
};

// Timer handle for combat auto-decay (module-scoped, not in store state)
let combatDecayTimeout: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// STORE CREATION
// ============================================================================

export const useCombatStore = createStore<CombatStoreState>((set, get) => ({
  // State
  ...initialState,

  // Actions
  recordKill: (enemyType: string, xp: number, isHeadshot = false, isCritical = false) => {
    const state = get();
    const now = performance.now();

    // Check if this is a combo kill (within window)
    const isCombo = now - state.lastKillTime < COMBO_WINDOW_MS;
    const newStreak = isCombo ? state.killStreak + 1 : 1;
    const newBestStreak = Math.max(state.bestKillStreak, newStreak);

    // Update kills by type
    const killsByType = { ...state.killsByType };
    if (!killsByType[enemyType]) {
      killsByType[enemyType] = { enemyType, count: 0, totalXp: 0 };
    }
    killsByType[enemyType] = {
      ...killsByType[enemyType],
      count: killsByType[enemyType].count + 1,
      totalXp: killsByType[enemyType].totalXp + xp,
    };

    set({
      kills: state.kills + 1,
      xpEarned: state.xpEarned + xp,
      killsByType,
      killStreak: newStreak,
      bestKillStreak: newBestStreak,
      lastKillTime: now,
      headshots: isHeadshot ? state.headshots + 1 : state.headshots,
      criticalHits: isCritical ? state.criticalHits + 1 : state.criticalHits,
    });

    log.debug(`Kill recorded: ${enemyType} (+${xp} XP, streak: ${newStreak})`);
  },

  recordDamageDealt: (amount: number) => {
    set((state) => ({
      damageDealt: state.damageDealt + amount,
    }));
  },

  recordDamageTaken: (amount: number) => {
    const state = get();
    set({
      damageTaken: state.damageTaken + amount,
      // Reset kill streak when taking damage
      killStreak: 0,
    });
  },

  recordShot: (hit: boolean, isHeadshot = false, isCritical = false) => {
    set((state) => ({
      shotsFired: state.shotsFired + 1,
      shotsHit: hit ? state.shotsHit + 1 : state.shotsHit,
      headshots: hit && isHeadshot ? state.headshots + 1 : state.headshots,
      criticalHits: hit && isCritical ? state.criticalHits + 1 : state.criticalHits,
    }));
  },

  recordHeadshot: () => {
    set((state) => ({
      headshots: state.headshots + 1,
    }));
  },

  recordCriticalHit: () => {
    set((state) => ({
      criticalHits: state.criticalHits + 1,
    }));
  },

  getAccuracy: () => {
    const { shotsFired, shotsHit } = get();
    return shotsFired > 0 ? (shotsHit / shotsFired) * 100 : 0;
  },

  getKillsForType: (enemyType: string) => {
    const { killsByType } = get();
    return killsByType[enemyType]?.count ?? 0;
  },

  isOnStreak: () => {
    const { killStreak } = get();
    return killStreak >= STREAK_THRESHOLD;
  },

  reset: () => {
    set({ ...initialState });
    log.info('Combat stats reset');
  },

  resetStreak: () => {
    set({ killStreak: 0 });
  },

  // --- UI actions ---

  setIsCalibrating: (value: boolean) => {
    set({ isCalibrating: value });
  },

  setInCombat: (value: boolean) => {
    set({ inCombat: value });

    if (value) {
      // Start combat music
      getAudioManager().playMusic('combat', 2);

      // Clear any existing decay timeout
      if (combatDecayTimeout) clearTimeout(combatDecayTimeout);

      // Auto-decay combat after 8 seconds of no activity
      combatDecayTimeout = setTimeout(() => {
        useCombatStore.getState().setInCombat(false);
      }, COMBAT_DECAY_MS);
    } else {
      // Clear decay timeout when explicitly leaving combat
      if (combatDecayTimeout) {
        clearTimeout(combatDecayTimeout);
        combatDecayTimeout = null;
      }
      // Return to exploration music
      getAudioManager().playMusic('exploration', 2);
    }
  },

  addKill: () => {
    // Simple kill increment (for legacy callback compatibility)
    set((state) => ({ kills: state.kills + 1 }));
    getAchievementManager().onKill();
  },
}));

// ============================================================================
// COMPUTED SELECTORS
// ============================================================================

/**
 * Selector to get accuracy percentage
 */
export function selectAccuracy(state: CombatStoreState): number {
  return state.shotsFired > 0 ? (state.shotsHit / state.shotsFired) * 100 : 0;
}

/**
 * Selector to check if on kill streak
 */
export function selectIsOnStreak(state: CombatStoreState): boolean {
  return state.killStreak >= STREAK_THRESHOLD;
}

// ============================================================================
// DIRECT ACCESS FOR GAME SYSTEMS
// ============================================================================

/**
 * Get the combat store for direct access from game systems.
 * Prefer using the hook in React components.
 */
export function getCombatStore(): CombatStoreState {
  return useCombatStore.getState();
}

/**
 * Subscribe to combat state changes from outside React.
 * Returns an unsubscribe function.
 */
export function subscribeToCombatState<T>(
  selector: (state: CombatStoreState) => T,
  listener: (state: T) => void
): () => void {
  return useCombatStore.subscribe((state) => selector(state), listener);
}

// ============================================================================
// EVENTBUS INTEGRATION
// ============================================================================

/**
 * Wire up the combat store to the EventBus.
 * Call this during app initialization to enable automatic stat tracking.
 */
export function initializeCombatStoreEventHandlers(): () => void {
  const eventBus = getEventBus();

  // Listen for player damage to reset streak
  const unsubDamage = eventBus.on('PLAYER_DAMAGED', (event) => {
    useCombatStore.getState().recordDamageTaken(event.amount);
  });

  // Listen for combat state changes from the game engine
  const unsubCombat = eventBus.on('COMBAT_STATE_CHANGED', (event) => {
    useCombatStore.getState().setInCombat(event.inCombat);
  });

  // Listen for simple kill registration (legacy callback support)
  const unsubKill = eventBus.on('KILL_REGISTERED', () => {
    useCombatStore.getState().addKill();
  });

  // Listen for detailed kill events from levels
  const unsubEnemyKilled = eventBus.on('ENEMY_KILLED', (event) => {
    useCombatStore.getState().recordKill(event.enemyType, 0);
    getAchievementManager().onKill();
  });

  log.info('Combat store event handlers initialized');

  // Return cleanup function
  return () => {
    unsubDamage();
    unsubCombat();
    unsubKill();
    unsubEnemyKilled();
    if (combatDecayTimeout) {
      clearTimeout(combatDecayTimeout);
      combatDecayTimeout = null;
    }
    log.info('Combat store event handlers cleaned up');
  };
}

/**
 * Play music based on current chapter (replaces CombatContext chapter-based music).
 * Call from a React effect that watches currentChapter.
 */
export function playChapterMusic(currentChapter: number): void {
  const { inCombat } = useCombatStore.getState();
  if (inCombat) return; // Don't override combat music

  const trackMap: Record<number, MusicTrack> = {
    1: 'ambient',       // Tutorial/Anchor Station
    2: 'exploration',   // Surface
    7: 'boss',          // The Breach - Queen boss fight
    9: 'exploration',   // Extraction holdout
    10: 'victory',      // Final Escape / Victory
  };

  const track = trackMap[currentChapter] ?? 'exploration';
  getAudioManager().playMusic(track, 2);
}
