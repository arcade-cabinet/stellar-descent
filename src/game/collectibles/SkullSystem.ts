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
  getActiveSkullIds,
  getFoundSkullIds,
  loadSkullCollection,
  type SkullCollectionState,
  saveSkullCollection,
} from './skullPersistence';

const log = getLogger('SkullSystem');

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
  private state: SkullCollectionState;
  private initialized = false;
  private changeCallbacks: Set<() => void> = new Set();

  constructor() {
    this.state = {
      saveId: 'default',
      foundSkulls: [],
      activeSkulls: [],
      lastUpdated: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Load persisted skull data. Call once at app startup. */
  init(): void {
    if (this.initialized) return;
    this.state = loadSkullCollection();
    this.initialized = true;
    log.info(
      `Initialized with ${this.state.foundSkulls.length} found, ` +
        `${this.state.activeSkulls.length} active`
    );
  }

  /** Persist current state to storage */
  private persist(): void {
    this.state.lastUpdated = Date.now();
    saveSkullCollection(this.state);
    this.emitChange();
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
    if (this.state.foundSkulls.includes(skullId)) {
      return false; // already found
    }
    this.state.foundSkulls.push(skullId);
    this.persist();
    log.info(`Skull discovered: ${SKULLS[skullId].name}`);
    return true;
  }

  /** Check if a skull has been found */
  isFound(skullId: SkullId): boolean {
    return this.state.foundSkulls.includes(skullId);
  }

  /** Get all found skull IDs */
  getFoundSkullIds(): SkullId[] {
    return [...this.state.foundSkulls];
  }

  /** Get count of found skulls */
  getFoundCount(): number {
    return this.state.foundSkulls.length;
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
    if (!this.state.foundSkulls.includes(skullId)) {
      log.warn(`Cannot activate unfound skull: ${skullId}`);
      return false;
    }
    if (this.state.activeSkulls.includes(skullId)) {
      return false; // already active
    }
    this.state.activeSkulls.push(skullId);
    this.persist();
    log.info(`Skull activated: ${SKULLS[skullId].name}`);
    return true;
  }

  /** Deactivate a skull. Returns true if it was active. */
  deactivateSkull(skullId: SkullId): boolean {
    const idx = this.state.activeSkulls.indexOf(skullId);
    if (idx === -1) return false;
    this.state.activeSkulls.splice(idx, 1);
    this.persist();
    log.info(`Skull deactivated: ${SKULLS[skullId].name}`);
    return true;
  }

  /** Toggle a skull between active/inactive. Returns the new active state. */
  toggleSkull(skullId: SkullId): boolean {
    if (this.isActive(skullId)) {
      this.deactivateSkull(skullId);
      return false;
    }
    return this.activateSkull(skullId);
  }

  /** Check if a skull is currently active */
  isActive(skullId: SkullId): boolean {
    return this.state.activeSkulls.includes(skullId);
  }

  /** Get all currently active skull IDs */
  getActiveSkullIds(): SkullId[] {
    return [...this.state.activeSkulls];
  }

  /** Get count of active skulls */
  getActiveCount(): number {
    return this.state.activeSkulls.length;
  }

  /** Deactivate all skulls */
  deactivateAll(): void {
    if (this.state.activeSkulls.length === 0) return;
    this.state.activeSkulls = [];
    this.persist();
    log.info('All skulls deactivated');
  }

  // --------------------------------------------------------------------------
  // Query helpers
  // --------------------------------------------------------------------------

  /** Get full skull state list (for UI rendering) */
  getAllSkullStates(): SkullState[] {
    return SKULL_ORDER.map((id) => ({
      definition: SKULLS[id],
      found: this.state.foundSkulls.includes(id),
      active: this.state.activeSkulls.includes(id),
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

    for (const skullId of this.state.activeSkulls) {
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
    return this.state.activeSkulls.some((id) => {
      const skull = SKULLS[id];
      return skull && skull.category !== 'fun';
    });
  }

  // --------------------------------------------------------------------------
  // Admin / Debug
  // --------------------------------------------------------------------------

  /** Reset all progress (found + active). */
  resetAll(): void {
    this.state.foundSkulls = [];
    this.state.activeSkulls = [];
    this.persist();
    log.info('All skull progress reset');
  }

  /** Discover all skulls at once (debug/testing). */
  discoverAll(): void {
    this.state.foundSkulls = [...SKULL_ORDER];
    this.persist();
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

// Re-export persistence helpers that consumers might need
export { getActiveSkullIds, getFoundSkullIds } from './skullPersistence';
