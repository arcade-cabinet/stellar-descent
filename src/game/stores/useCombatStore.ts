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
};

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
  const _store = useCombatStore.getState();

  // Listen for player damage to reset streak
  const unsubDamage = eventBus.on('PLAYER_DAMAGED', (event) => {
    useCombatStore.getState().recordDamageTaken(event.amount);
  });

  log.info('Combat store event handlers initialized');

  // Return cleanup function
  return () => {
    unsubDamage();
    log.info('Combat store event handlers cleaned up');
  };
}
