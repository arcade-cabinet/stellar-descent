/**
 * usePlayerStore - Zustand store for player runtime state
 *
 * This is a NON-PERSISTED store that tracks the current session's player state.
 * Replaces PlayerContext with a Zustand store for all player-related state:
 * health, armor, death, touch input, tutorial, HUD visibility.
 *
 * Usage:
 * ```ts
 * import { usePlayerStore } from '../stores/usePlayerStore';
 *
 * // In a component:
 * const health = usePlayerStore((state) => state.health);
 * const hudVisibility = usePlayerStore((state) => state.hudVisibility);
 *
 * // Direct access for game systems:
 * import { getPlayerStore } from '../stores/usePlayerStore';
 * getPlayerStore().damage(25);
 * ```
 */

import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import { getLowHealthFeedback } from '../effects/LowHealthFeedback';
import type { TutorialPhase } from '../levels/anchor-station/tutorialSteps';
import type { TouchInput } from '../types';
import { createStore } from './createPersistedStore';

const log = getLogger('PlayerStore');

// ============================================================================
// HUD VISIBILITY TYPES (migrated from PlayerContext)
// ============================================================================

/**
 * HUD visibility state for progressive unlocking.
 * Tutorial levels can enable elements one at a time.
 */
export interface HUDVisibility {
  healthBar: boolean;
  crosshair: boolean;
  killCounter: boolean;
  missionText: boolean;
  actionButtons: boolean;
  commsDisplay: boolean;
  notifications: boolean;
  compass: boolean;
}

/** Default HUD visibility - all elements visible (post-tutorial state) */
export const DEFAULT_HUD_VISIBILITY: HUDVisibility = {
  healthBar: true,
  crosshair: true,
  killCounter: true,
  missionText: true,
  actionButtons: true,
  commsDisplay: true,
  notifications: true,
  compass: true,
};

/** Tutorial start HUD visibility - minimal UI */
export const TUTORIAL_START_HUD_VISIBILITY: HUDVisibility = {
  healthBar: false,
  crosshair: false,
  killCounter: false,
  missionText: false,
  actionButtons: false,
  commsDisplay: true, // Always available for narrative
  notifications: true, // Always available for feedback
  compass: false, // Unlocked later in tutorial
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Player state (excluding actions)
 */
export interface PlayerState {
  /** Current health (0 to maxHealth) */
  health: number;
  /** Maximum health */
  maxHealth: number;
  /** Current armor (0 to maxArmor) */
  armor: number;
  /** Maximum armor */
  maxArmor: number;
  /** Whether the player is dead (health <= 0) */
  isDead: boolean;
  /** Touch input state from mobile controls */
  touchInput: TouchInput | null;
  /** Tutorial phase for control hints */
  tutorialPhase: TutorialPhase;
  /** Whether the tutorial is currently active */
  isTutorialActive: boolean;
  /** HUD visibility for progressive unlocking */
  hudVisibility: HUDVisibility;
}

/**
 * Player store actions
 */
export interface PlayerActions {
  /** Set health directly (clamped to 0-maxHealth) */
  setHealth: (health: number) => void;
  /** Set health with death-blocking (backward compat with PlayerContext) */
  setPlayerHealth: (health: number) => void;
  /** Apply damage to player (reduces armor first, then health) */
  damage: (amount: number, source?: string, direction?: number) => void;
  /** Heal the player */
  heal: (amount: number) => void;
  /** Set maximum health */
  setMaxHealth: (max: number) => void;
  /** Set armor directly */
  setArmor: (armor: number) => void;
  /** Add armor */
  addArmor: (amount: number) => void;
  /** Set maximum armor */
  setMaxArmor: (max: number) => void;
  /** Check if player is at low health (<= 25%) */
  isLowHealth: () => boolean;
  /** Get health percentage (0-100) */
  getHealthPercent: () => number;
  /** Get armor percentage (0-100) */
  getArmorPercent: () => number;
  /** Reset player state to full health/armor and all UI state */
  reset: () => void;
  /** Reset health and death state (backward compat) */
  resetPlayerHealth: () => void;
  /** Revive player (reset isDead and restore health) */
  revive: (healthAmount?: number) => void;
  /** Register a callback to invoke on player death */
  setOnPlayerDeath: (callback: (() => void) | null) => void;
  /** Set touch input from mobile controls */
  setTouchInput: (input: TouchInput | null) => void;
  /** Set the tutorial phase */
  setTutorialPhase: (phase: TutorialPhase) => void;
  /** Set whether the tutorial is active */
  setIsTutorialActive: (active: boolean) => void;
  /** Partially update HUD visibility */
  setHUDVisibility: (visibility: Partial<HUDVisibility>) => void;
  /** Reset HUD visibility to all-visible default */
  resetHUDVisibility: () => void;
}

/**
 * Combined player store state
 */
export type PlayerStoreState = PlayerState & PlayerActions;

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_HEALTH = 100;
const DEFAULT_MAX_ARMOR = 100;
const LOW_HEALTH_THRESHOLD = 0.25; // 25%

// Module-scoped death callback (replaces React ref from PlayerContext)
let playerDeathCallback: (() => void) | null = null;

const initialState: PlayerState = {
  health: DEFAULT_MAX_HEALTH,
  maxHealth: DEFAULT_MAX_HEALTH,
  armor: 0,
  maxArmor: DEFAULT_MAX_ARMOR,
  isDead: false,
  touchInput: null,
  tutorialPhase: 0 as TutorialPhase,
  isTutorialActive: false,
  hudVisibility: DEFAULT_HUD_VISIBILITY,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const usePlayerStore = createStore<PlayerStoreState>((set, get) => ({
  // State
  ...initialState,

  // Actions
  setHealth: (health: number) => {
    const { maxHealth } = get();
    const clampedHealth = Math.max(0, Math.min(maxHealth, health));
    const isDead = clampedHealth <= 0;

    set({ health: clampedHealth, isDead });

    if (isDead) {
      log.info('Player died');
    }
  },

  damage: (amount: number, source?: string, direction?: number) => {
    const state = get();

    // Don't process damage if already dead
    if (state.isDead) return;

    let remainingDamage = amount;
    let newArmor = state.armor;
    let newHealth = state.health;

    // Armor absorbs damage first (50% of damage to armor, 50% to health when armor exists)
    if (newArmor > 0) {
      const armorDamage = Math.min(newArmor, remainingDamage * 0.5);
      newArmor = Math.max(0, newArmor - armorDamage);
      remainingDamage = remainingDamage * 0.5;
    }

    // Apply remaining damage to health
    newHealth = Math.max(0, newHealth - remainingDamage);
    const isDead = newHealth <= 0;

    set({
      health: newHealth,
      armor: newArmor,
      isDead,
    });

    // Emit damage event
    getEventBus().emit({
      type: 'PLAYER_DAMAGED',
      amount,
      source,
      direction,
    });

    // Emit low health warning if applicable
    if (!isDead && newHealth <= state.maxHealth * LOW_HEALTH_THRESHOLD) {
      getEventBus().emit({
        type: 'LOW_HEALTH_WARNING',
        currentHealth: newHealth,
        maxHealth: state.maxHealth,
      });
    }

    log.debug(
      `Player took ${amount} damage (source: ${source ?? 'unknown'}), health: ${newHealth}`
    );
  },

  heal: (amount: number) => {
    const { health, maxHealth, isDead } = get();

    // Cannot heal if dead
    if (isDead) return;

    const newHealth = Math.min(maxHealth, health + amount);
    set({ health: newHealth });

    // Emit heal event
    getEventBus().emit({
      type: 'PLAYER_HEALED',
      amount: newHealth - health,
    });

    log.debug(`Player healed ${amount}, health: ${newHealth}`);
  },

  setMaxHealth: (max: number) => {
    const { health } = get();
    // Clamp current health to new max if needed
    const newHealth = Math.min(health, max);
    set({ maxHealth: max, health: newHealth });
  },

  setArmor: (armor: number) => {
    const { maxArmor } = get();
    set({ armor: Math.max(0, Math.min(maxArmor, armor)) });
  },

  addArmor: (amount: number) => {
    const { armor, maxArmor } = get();
    set({ armor: Math.min(maxArmor, armor + amount) });
  },

  setMaxArmor: (max: number) => {
    const { armor } = get();
    // Clamp current armor to new max if needed
    const newArmor = Math.min(armor, max);
    set({ maxArmor: max, armor: newArmor });
  },

  isLowHealth: () => {
    const { health, maxHealth } = get();
    return health <= maxHealth * LOW_HEALTH_THRESHOLD;
  },

  getHealthPercent: () => {
    const { health, maxHealth } = get();
    return maxHealth > 0 ? (health / maxHealth) * 100 : 0;
  },

  getArmorPercent: () => {
    const { armor, maxArmor } = get();
    return maxArmor > 0 ? (armor / maxArmor) * 100 : 0;
  },

  setPlayerHealth: (health: number) => {
    const state = get();
    // Don't process health changes if player is already dead
    if (state.isDead) return;

    const clampedHealth = Math.max(0, Math.min(state.maxHealth, health));
    const isDead = clampedHealth <= 0;
    set({ health: clampedHealth, isDead });

    if (isDead && playerDeathCallback) {
      playerDeathCallback();
    }
  },

  resetPlayerHealth: () => {
    const { maxHealth } = get();
    set({ health: maxHealth, isDead: false });
  },

  setOnPlayerDeath: (callback: (() => void) | null) => {
    playerDeathCallback = callback;
  },

  setTouchInput: (input: TouchInput | null) => {
    set({ touchInput: input });
  },

  setTutorialPhase: (phase: TutorialPhase) => {
    set({ tutorialPhase: phase });
  },

  setIsTutorialActive: (active: boolean) => {
    set({ isTutorialActive: active });
  },

  setHUDVisibility: (visibility: Partial<HUDVisibility>) => {
    set((state) => ({
      hudVisibility: { ...state.hudVisibility, ...visibility },
    }));
  },

  resetHUDVisibility: () => {
    set({ hudVisibility: DEFAULT_HUD_VISIBILITY });
  },

  reset: () => {
    playerDeathCallback = null;
    set({ ...initialState });
    log.info('Player state reset');
  },

  revive: (healthAmount?: number) => {
    const { maxHealth } = get();
    const newHealth = healthAmount ?? maxHealth;
    set({
      health: Math.min(newHealth, maxHealth),
      isDead: false,
    });
    log.info(`Player revived with ${newHealth} health`);
  },
}));

// ============================================================================
// LOW HEALTH FEEDBACK SUBSCRIPTION
// ============================================================================

// Subscribe to health/death changes and drive LowHealthFeedback effects.
// This replaces the useEffect in PlayerProvider.
usePlayerStore.subscribe(
  (state) => ({ health: state.health, isDead: state.isDead, maxHealth: state.maxHealth }),
  ({ health, isDead, maxHealth }) => {
    const lowHealthFeedback = getLowHealthFeedback();
    if (health <= 0 || isDead) {
      lowHealthFeedback.stopLowHealthEffects();
    } else {
      lowHealthFeedback.startLowHealthEffects(health, maxHealth);
    }
  },
  {
    equalityFn: (a, b) =>
      a.health === b.health && a.isDead === b.isDead && a.maxHealth === b.maxHealth,
  }
);

// ============================================================================
// DIRECT ACCESS FOR GAME SYSTEMS
// ============================================================================

/**
 * Get the player store for direct access from game systems.
 * Prefer using the hook in React components.
 */
export function getPlayerStore(): PlayerStoreState {
  return usePlayerStore.getState();
}

/**
 * Subscribe to player state changes from outside React.
 * Returns an unsubscribe function.
 */
export function subscribeToPlayerState<T>(
  selector: (state: PlayerStoreState) => T,
  listener: (state: T) => void
): () => void {
  return usePlayerStore.subscribe((state) => selector(state), listener);
}
