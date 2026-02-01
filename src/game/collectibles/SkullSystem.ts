/**
 * Skull Modifier System
 *
 * Implements Halo-style "skull" easter eggs -- hidden gameplay modifiers
 * that players discover in secret areas across levels. Each skull changes
 * one aspect of gameplay (enemy behaviour, HUD, physics, etc.).
 *
 * Skulls are:
 * - One per level, hidden in hard-to-reach spots
 * - Persisted via IndexedDB through skullPersistence
 * - Toggleable from the SkullMenu UI before starting a mission
 * - Combinable for stacking difficulty / fun modifiers
 *
 * Integration points:
 * - SecretAreaSystem / SkullPickup: discovery in the 3D world
 * - AchievementManager: tracks skull-related achievements
 * - DifficultySettings: getActiveModifiers() produces a multiplier overlay
 * - GameContext: reads active modifiers each frame
 */

import type { DifficultyModifiers } from '../core/DifficultySettings';
import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import {
  getActiveSkullIds as getActiveSkullIdsFromStore,
  getFoundSkullIds as getFoundSkullIdsFromStore,
  useCollectiblesStore,
} from '../stores/useCollectiblesStore';

const log = getLogger('SkullSystem');

/** Internal state representation for the SkullSystem class */
interface SkullCollectionState {
  saveId: string;
  foundSkulls: SkullId[];
  activeSkulls: SkullId[];
  lastUpdated: number;
}

// ============================================================================
// TYPES
// ============================================================================

/** Categories that group skulls in the menu UI */
export type SkullCategory = 'difficulty' | 'fun' | 'mythic';

/** The kind of gameplay change a skull applies */
export type SkullEffectType =
  | 'no_respawns'
  | 'enemy_upgrade'
  | 'reduced_ammo'
  | 'no_hud'
  | 'double_enemy_hp'
  | 'crazy_physics'
  | 'rare_dialogue'
  | 'confetti_headshot'
  | 'enemy_dodge'
  | 'enemy_grenades';

/** Unique identifier for each skull */
export type SkullId =
  | 'iron'
  | 'thunderstorm'
  | 'famine'
  | 'blind'
  | 'mythic'
  | 'cowbell'
  | 'iwhbyd'
  | 'grunt_birthday_party'
  | 'tough_luck'
  | 'catch';

/** Static definition of a skull collectible */
export interface SkullDefinition {
  /** Unique identifier */
  id: SkullId;
  /** Display name shown in menus */
  name: string;
  /** Descriptive text explaining the effect */
  description: string;
  /** Emoji icon used as a visual identifier */
  icon: string;
  /** The gameplay effect this skull applies */
  effectType: SkullEffectType;
  /** Menu grouping */
  category: SkullCategory;
  /** Which campaign level hides this skull */
  levelFound: LevelId;
  /** Score multiplier when active (1.0 = no change) */
  scoreMultiplier: number;
}

/** Runtime state for a skull -- combines definition with player progress */
export interface SkullState {
  definition: SkullDefinition;
  /** Whether the player has physically found this skull */
  found: boolean;
  /** Whether the player has toggled it on for gameplay */
  active: boolean;
}

/**
 * Combined modifier overlay produced by all active skulls.
 * Fields mirror DifficultyModifiers but are purely additive / multiplicative
 * on top of the base difficulty.
 */
export interface SkullModifiers {
  /** Multiplier applied to enemy health */
  enemyHealthMultiplier: number;
  /** Multiplier applied to enemy damage */
  enemyDamageMultiplier: number;
  /** Multiplier applied to resource / ammo drops */
  resourceDropMultiplier: number;
  /** Multiplier applied to enemy detection range */
  enemyDetectionMultiplier: number;
  /** Multiplier for enemy fire rate */
  enemyFireRateMultiplier: number;
  /** Whether respawns should be disabled */
  disableRespawns: boolean;
  /** Whether the HUD should be hidden */
  hideHUD: boolean;
  /** Physics force multiplier (affects explosions, knockback) */
  physicsForceMultiplier: number;
  /** Rare dialogue probability override (0-1, or null for default) */
  rareDialogueProbability: number | null;
  /** Whether headshot kills produce confetti particles */
  confettiOnHeadshot: boolean;
  /** Multiplier for enemy dodge probability */
  enemyDodgeMultiplier: number;
  /** Multiplier for enemy grenade throw frequency */
  enemyGrenadeMultiplier: number;
  /** Whether enemies should be upgraded to higher tiers */
  upgradeEnemies: boolean;
  /** Composite score multiplier from all active skulls */
  scoreMultiplier: number;
}

// ============================================================================
// SKULL DEFINITIONS DATABASE
// ============================================================================

export const SKULLS: Record<SkullId, SkullDefinition> = {
  // --- Difficulty skulls (increase challenge) ---
  iron: {
    id: 'iron',
    name: 'Iron',
    description:
      'Death is permanent. If you die, the mission restarts from the beginning. No checkpoints, no second chances.',
    icon: '\u{1F480}', // skull
    effectType: 'no_respawns',
    category: 'difficulty',
    levelFound: 'anchor_station',
    scoreMultiplier: 1.5,
  },
  thunderstorm: {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    description:
      'All enemies are promoted to their highest rank. Expect tougher, smarter, and deadlier foes at every turn.',
    icon: '\u26A1', // lightning
    effectType: 'enemy_upgrade',
    category: 'difficulty',
    levelFound: 'landfall',
    scoreMultiplier: 1.5,
  },
  famine: {
    id: 'famine',
    name: 'Famine',
    description:
      'Weapons dropped by enemies carry very little ammunition. Conserve every round -- you will need it.',
    icon: '\u{1F356}', // meat on bone
    effectType: 'reduced_ammo',
    category: 'difficulty',
    levelFound: 'fob_delta',
    scoreMultiplier: 1.25,
  },
  blind: {
    id: 'blind',
    name: 'Blind',
    description:
      'The HUD is completely removed. No crosshair, no health bar, no ammo counter. Trust your instincts.',
    icon: '\u{1F441}', // eye
    effectType: 'no_hud',
    category: 'difficulty',
    levelFound: 'the_breach',
    scoreMultiplier: 1.25,
  },
  mythic: {
    id: 'mythic',
    name: 'Mythic',
    description:
      'All enemies have double their normal hit points. Sustained firepower and precision are essential.',
    icon: '\u{1F6E1}', // shield
    effectType: 'double_enemy_hp',
    category: 'mythic',
    levelFound: 'extraction',
    scoreMultiplier: 2.0,
  },
  tough_luck: {
    id: 'tough_luck',
    name: 'Tough Luck',
    description:
      'Enemies are much more likely to dodge grenades and evade gunfire. They dive, roll, and take cover aggressively.',
    icon: '\u{1F340}', // four-leaf clover
    effectType: 'enemy_dodge',
    category: 'difficulty',
    levelFound: 'brothers_in_arms',
    scoreMultiplier: 1.25,
  },
  catch: {
    id: 'catch',
    name: 'Catch',
    description:
      'Enemies throw grenades much more frequently and with better accuracy. Watch your feet.',
    icon: '\u{1F4A3}', // bomb
    effectType: 'enemy_grenades',
    category: 'difficulty',
    levelFound: 'fob_delta',
    scoreMultiplier: 1.25,
  },

  // --- Fun skulls (change gameplay feel, not necessarily harder) ---
  cowbell: {
    id: 'cowbell',
    name: 'Cowbell',
    description:
      'Physics forces are amplified dramatically. Explosions send bodies flying and objects go haywire.',
    icon: '\u{1F514}', // bell
    effectType: 'crazy_physics',
    category: 'fun',
    levelFound: 'brothers_in_arms',
    scoreMultiplier: 1.0,
  },
  iwhbyd: {
    id: 'iwhbyd',
    name: 'IWHBYD',
    description:
      'Rare and hidden dialogue lines become common. Characters say things you were never meant to hear.',
    icon: '\u{1F4AC}', // speech bubble
    effectType: 'rare_dialogue',
    category: 'fun',
    levelFound: 'the_breach',
    scoreMultiplier: 1.0,
  },
  grunt_birthday_party: {
    id: 'grunt_birthday_party',
    name: 'Grunt Birthday Party',
    description:
      'Headshot kills trigger a confetti explosion and a celebratory cheer. Happy birthday, grunt!',
    icon: '\u{1F389}', // party popper
    effectType: 'confetti_headshot',
    category: 'fun',
    levelFound: 'landfall',
    scoreMultiplier: 1.0,
  },
};

/** Ordered list of skull IDs for consistent iteration in the UI */
export const SKULL_ORDER: SkullId[] = [
  'iron',
  'thunderstorm',
  'mythic',
  'tough_luck',
  'catch',
  'famine',
  'blind',
  'cowbell',
  'iwhbyd',
  'grunt_birthday_party',
];

// ============================================================================
// SKULL SYSTEM CLASS
// ============================================================================

class SkullSystemImpl {
  private initialized = false;
  private changeCallbacks: Set<() => void> = new Set();

  constructor() {
    // Subscribe to store changes to emit change callbacks
    this.unsubscribeStore = useCollectiblesStore.subscribe(
      (state) => ({ skulls: state.skulls, activations: state.skullActivations }),
      () => this.emitChange(),
      { equalityFn: (a, b) => a.skulls === b.skulls && a.activations === b.activations }
    );
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Load persisted skull data. Call once at app startup. */
  async init(): Promise<void> {
    if (this.initialized) return;
    await useCollectiblesStore.getState().initialize();
    this.initialized = true;
    const foundCount = useCollectiblesStore.getState().skulls.size;
    const activeCount = useCollectiblesStore.getState().getActiveSkullIds().length;
    log.info(`Initialized with ${foundCount} found, ${activeCount} active`);
  }

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  /** Subscribe to any state change. Returns an unsubscribe function. */
  onChange(callback: () => void): () => void {
    this.changeCallbacks.add(callback);
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  private emitChange(): void {
    for (const cb of this.changeCallbacks) {
      try {
        cb();
      } catch (err) {
        log.error('Error in change callback:', err);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Discovery
  // --------------------------------------------------------------------------

  /** Mark a skull as found by the player. Returns true if newly discovered. */
  discoverSkull(skullId: SkullId): boolean {
    const result = useCollectiblesStore.getState().addSkull(skullId);
    if (result) {
      log.info(`Skull discovered: ${SKULLS[skullId].name}`);
    }
    return result;
  }

  /** Check if a skull has been found */
  isFound(skullId: SkullId): boolean {
    return useCollectiblesStore.getState().hasSkull(skullId);
  }

  /** Get all found skull IDs */
  getFoundSkullIds(): SkullId[] {
    return getFoundSkullIdsFromStore() as SkullId[];
  }

  /** Get count of found skulls */
  getFoundCount(): number {
    return useCollectiblesStore.getState().skulls.size;
  }

  /** Get total skull count */
  getTotalCount(): number {
    return SKULL_ORDER.length;
  }

  // --------------------------------------------------------------------------
  // Activation / Deactivation
  // --------------------------------------------------------------------------

  /** Activate a skull (must be found first). Returns true on success. */
  activateSkull(skullId: SkullId): boolean {
    const result = useCollectiblesStore.getState().activateSkull(skullId);
    if (result) {
      log.info(`Skull activated: ${SKULLS[skullId].name}`);
    }
    return result;
  }

  /** Deactivate a skull. Returns true if it was active. */
  deactivateSkull(skullId: SkullId): boolean {
    const result = useCollectiblesStore.getState().deactivateSkull(skullId);
    if (result) {
      log.info(`Skull deactivated: ${SKULLS[skullId].name}`);
    }
    return result;
  }

  /** Toggle a skull between active/inactive. Returns the new active state. */
  toggleSkull(skullId: SkullId): boolean {
    return useCollectiblesStore.getState().toggleSkull(skullId);
  }

  /** Check if a skull is currently active */
  isActive(skullId: SkullId): boolean {
    return useCollectiblesStore.getState().isSkullActive(skullId);
  }

  /** Get all currently active skull IDs */
  getActiveSkullIds(): SkullId[] {
    return getActiveSkullIdsFromStore() as SkullId[];
  }

  /** Get count of active skulls */
  getActiveCount(): number {
    return useCollectiblesStore.getState().getActiveSkullIds().length;
  }

  /** Deactivate all skulls */
  deactivateAll(): void {
    const store = useCollectiblesStore.getState();
    const activeIds = store.getActiveSkullIds();
    if (activeIds.length === 0) return;
    for (const id of activeIds) {
      store.deactivateSkull(id);
    }
    log.info('All skulls deactivated');
  }

  // --------------------------------------------------------------------------
  // Query helpers
  // --------------------------------------------------------------------------

  /** Get full skull state list (for UI rendering) */
  getAllSkullStates(): SkullState[] {
    const store = useCollectiblesStore.getState();
    return SKULL_ORDER.map((id) => ({
      definition: SKULLS[id],
      found: store.hasSkull(id),
      active: store.isSkullActive(id),
    }));
  }

  /** Get a single skull definition by ID */
  getSkull(id: SkullId): SkullDefinition {
    return SKULLS[id];
  }

  /** Get the skull hidden in a specific level (if any) */
  getSkullForLevel(levelId: LevelId): SkullDefinition | null {
    for (const skull of Object.values(SKULLS)) {
      if (skull.levelFound === levelId) {
        return skull;
      }
    }
    return null;
  }

  /** Get skulls grouped by category */
  getSkullsByCategory(): Record<SkullCategory, SkullState[]> {
    const all = this.getAllSkullStates();
    return {
      difficulty: all.filter((s) => s.definition.category === 'difficulty'),
      mythic: all.filter((s) => s.definition.category === 'mythic'),
      fun: all.filter((s) => s.definition.category === 'fun'),
    };
  }

  // --------------------------------------------------------------------------
  // Modifier computation
  // --------------------------------------------------------------------------

  /**
   * Compute the combined gameplay modifiers from all active skulls.
   * These are intended to be composed with the base DifficultyModifiers.
   */
  getActiveModifiers(): SkullModifiers {
    const mods: SkullModifiers = {
      enemyHealthMultiplier: 1.0,
      enemyDamageMultiplier: 1.0,
      resourceDropMultiplier: 1.0,
      enemyDetectionMultiplier: 1.0,
      enemyFireRateMultiplier: 1.0,
      disableRespawns: false,
      hideHUD: false,
      physicsForceMultiplier: 1.0,
      rareDialogueProbability: null,
      confettiOnHeadshot: false,
      enemyDodgeMultiplier: 1.0,
      enemyGrenadeMultiplier: 1.0,
      upgradeEnemies: false,
      scoreMultiplier: 1.0,
    };

    const activeSkullIds = this.getActiveSkullIds();
    for (const skullId of activeSkullIds) {
      const skull = SKULLS[skullId];
      if (!skull) continue;

      mods.scoreMultiplier *= skull.scoreMultiplier;

      switch (skull.effectType) {
        case 'no_respawns':
          mods.disableRespawns = true;
          break;

        case 'enemy_upgrade':
          mods.upgradeEnemies = true;
          mods.enemyDamageMultiplier *= 1.3;
          mods.enemyDetectionMultiplier *= 1.2;
          break;

        case 'reduced_ammo':
          mods.resourceDropMultiplier *= 0.25;
          break;

        case 'no_hud':
          mods.hideHUD = true;
          break;

        case 'double_enemy_hp':
          mods.enemyHealthMultiplier *= 2.0;
          break;

        case 'crazy_physics':
          mods.physicsForceMultiplier *= 3.0;
          break;

        case 'rare_dialogue':
          mods.rareDialogueProbability = 0.8;
          break;

        case 'confetti_headshot':
          mods.confettiOnHeadshot = true;
          break;

        case 'enemy_dodge':
          mods.enemyDodgeMultiplier *= 2.5;
          break;

        case 'enemy_grenades':
          mods.enemyGrenadeMultiplier *= 3.0;
          mods.enemyFireRateMultiplier *= 1.15;
          break;
      }
    }

    return mods;
  }

  /**
   * Merge skull modifiers into an existing DifficultyModifiers object.
   * Returns a new object without mutating the input.
   */
  applyToDifficulty(base: DifficultyModifiers): DifficultyModifiers {
    const skull = this.getActiveModifiers();
    return {
      ...base,
      enemyHealthMultiplier: base.enemyHealthMultiplier * skull.enemyHealthMultiplier,
      enemyDamageMultiplier: base.enemyDamageMultiplier * skull.enemyDamageMultiplier,
      enemyFireRateMultiplier: base.enemyFireRateMultiplier * skull.enemyFireRateMultiplier,
      enemyDetectionMultiplier: base.enemyDetectionMultiplier * skull.enemyDetectionMultiplier,
      resourceDropMultiplier: base.resourceDropMultiplier * skull.resourceDropMultiplier,
      // XP multiplier uses the skull score multiplier
      xpMultiplier: base.xpMultiplier * skull.scoreMultiplier,
      // These pass through unchanged -- skulls don't touch them directly
      playerDamageReceivedMultiplier: base.playerDamageReceivedMultiplier,
      playerHealthRegenMultiplier: base.playerHealthRegenMultiplier,
      spawnRateMultiplier: base.spawnRateMultiplier,
    };
  }

  /** True when at least one active skull increases difficulty */
  hasActiveDifficultySkulls(): boolean {
    const activeIds = this.getActiveSkullIds();
    return activeIds.some((id) => {
      const skull = SKULLS[id as SkullId];
      return skull && skull.category !== 'fun';
    });
  }

  // --------------------------------------------------------------------------
  // Admin / Debug
  // --------------------------------------------------------------------------

  /** Reset all progress (found + active). */
  resetAll(): void {
    useCollectiblesStore.getState().resetSkulls();
    log.info('All skull progress reset');
  }

  /** Discover all skulls at once (debug/testing). */
  discoverAll(): void {
    const store = useCollectiblesStore.getState();
    for (const id of SKULL_ORDER) {
      store.addSkull(id);
    }
    log.info('All skulls discovered');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let skullSystemInstance: SkullSystemImpl | null = null;

/** Get the singleton SkullSystem instance */
export function getSkullSystem(): SkullSystemImpl {
  if (!skullSystemInstance) {
    skullSystemInstance = new SkullSystemImpl();
  }
  return skullSystemInstance;
}

/** Initialize the skull system. Call once at app startup. */
export function initSkulls(): void {
  getSkullSystem().init();
}

// Re-export class type for external typing
export type SkullSystem = SkullSystemImpl;

// Re-export from store for backward compatibility
export {
  getActiveSkullIds,
  getFoundSkullIds,
} from '../stores/useCollectiblesStore';
