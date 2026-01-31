/**
 * New Game Plus System
 *
 * Implements a full NG+ mode for Stellar Descent that provides replay value
 * after completing the campaign. Features include:
 *
 * - Up to 7 completion tiers (NG+ through NG+++++++)
 * - Scaling enemy difficulty per tier
 * - Carryover of weapons and skulls from previous runs
 * - Bonus starting health and credits per tier
 * - NG+ exclusive skulls and achievements
 * - New enemy placements and variants
 *
 * Integration points:
 * - SaveSystem: Persists NG+ state alongside regular save data
 * - GameModeManager: Activates NG+ modifiers during gameplay
 * - MainMenu: Shows NG+ button when unlocked
 * - DifficultySettings: Applies NG+ modifiers on top of base difficulty
 * - AchievementManager: Tracks NG+ specific achievements
 */

import type { DifficultyModifiers } from '../core/DifficultySettings';
import { getLogger } from '../core/Logger';
import type { WeaponId } from '../entities/weapons';
import type { SkullId } from '../collectibles/SkullSystem';
import type { LevelId } from '../levels/types';

const log = getLogger('NewGamePlus');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of NG+ completions tracked */
export const MAX_NG_PLUS_TIER = 7;

/** Storage key for persisting NG+ state */
const STORAGE_KEY = 'stellar_descent_ngplus';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Modifier definition that scales with NG+ tier
 */
export interface NewGamePlusModifier {
  /** Unique identifier for this modifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the effect */
  description: string;
  /** Whether this modifier is a buff (true) or a challenge (false) */
  isBuff: boolean;
  /** Function that returns the modifier value for a given tier */
  getValue: (tier: number) => number;
}

/**
 * Complete NG+ state for a player
 */
export interface NewGamePlusState {
  /** Whether NG+ has been unlocked (campaign completed at least once) */
  unlocked: boolean;
  /** Number of times the campaign has been completed (0 = never, 1 = NG, 2 = NG+, etc.) */
  completions: number;
  /** Current NG+ tier being played (0 = normal, 1 = NG+, 2 = NG++, etc.) */
  currentTier: number;
  /** Weapons carried over from previous runs */
  unlockedWeapons: WeaponId[];
  /** Skulls unlocked across all runs */
  unlockedSkulls: SkullId[];
  /** NG+ exclusive skulls discovered */
  ngPlusSkulls: string[];
  /** Best tier completed */
  highestTierCompleted: number;
  /** Timestamp of first campaign completion */
  firstCompletionTime: number | null;
  /** Timestamp of most recent completion */
  lastCompletionTime: number | null;
  /** Total play time across all NG+ runs (ms) */
  totalNgPlusPlayTime: number;
  /** Total kills across all NG+ runs */
  totalNgPlusKills: number;
  /** Levels completed in current NG+ run */
  currentRunLevelsCompleted: LevelId[];
}

/**
 * Computed modifiers based on NG+ tier
 */
export interface NewGamePlusModifiers {
  /** Enemy health multiplier */
  enemyHealthMultiplier: number;
  /** Enemy damage multiplier */
  enemyDamageMultiplier: number;
  /** Enemy fire rate multiplier */
  enemyFireRateMultiplier: number;
  /** Enemy detection range multiplier */
  enemyDetectionMultiplier: number;
  /** Player starting health bonus */
  playerStartHealthBonus: number;
  /** Player starting armor bonus */
  playerStartArmorBonus: number;
  /** Bonus credits at start */
  bonusCredits: number;
  /** Score multiplier for achievements/leaderboards */
  scoreMultiplier: number;
  /** Whether elite enemies spawn */
  eliteEnemiesEnabled: boolean;
  /** Spawn rate multiplier for enemies */
  spawnRateMultiplier: number;
  /** Resource drop rate multiplier */
  resourceDropMultiplier: number;
}

/**
 * Configuration for NG+ tier rewards
 */
export interface NewGamePlusTierReward {
  tier: number;
  /** Weapons automatically unlocked at this tier */
  weapons: WeaponId[];
  /** Skulls automatically unlocked at this tier */
  skulls: SkullId[];
  /** Achievement ID unlocked at this tier */
  achievement: string | null;
  /** Special title/badge earned */
  title: string;
}

// ============================================================================
// NG+ MODIFIER DEFINITIONS
// ============================================================================

/**
 * Base modifiers that scale per NG+ tier
 */
export const NG_PLUS_BASE_MODIFIERS = {
  /** Enemy health increases 50% per tier */
  enemyHealthMultiplier: 1.5,
  /** Enemy damage increases 25% per tier */
  enemyDamageMultiplier: 1.25,
  /** Enemy fire rate increases 10% per tier */
  enemyFireRateMultiplier: 1.1,
  /** Enemy detection range increases 15% per tier */
  enemyDetectionMultiplier: 1.15,
  /** Player starts with +50 health per tier (capped at +150) */
  playerStartHealthBonus: 50,
  /** Player starts with +25 armor per tier (capped at +75) */
  playerStartArmorBonus: 25,
  /** Bonus credits per tier */
  bonusCredits: 1000,
  /** Score multiplier per tier (additive +0.5) */
  scoreMultiplierBonus: 0.5,
  /** Spawn rate increases 20% per tier */
  spawnRateMultiplier: 1.2,
  /** Resource drops decrease 10% per tier */
  resourceDropMultiplier: 0.9,
};

/**
 * Starting weapons for NG+ (carried from a standard completion)
 */
export const NG_PLUS_START_WEAPONS: WeaponId[] = [
  'assault_rifle',
  'auto_shotgun',
];

/**
 * Additional weapons unlocked per NG+ tier
 */
export const NG_PLUS_TIER_WEAPONS: Record<number, WeaponId[]> = {
  1: ['assault_rifle', 'auto_shotgun'], // NG+
  2: ['battle_rifle', 'pulse_smg'], // NG++
  3: ['dmr', 'double_barrel'], // NG+++
  4: ['heavy_lmg', 'plasma_cannon'], // NG++++
  5: ['sniper_rifle'], // NG+++++
  6: [], // NG++++++
  7: [], // NG+++++++
};

/**
 * Tier rewards configuration
 */
export const NG_PLUS_TIER_REWARDS: NewGamePlusTierReward[] = [
  {
    tier: 1,
    weapons: ['assault_rifle', 'auto_shotgun'],
    skulls: [],
    achievement: 'ngplus_initiate',
    title: 'NG+ Initiate',
  },
  {
    tier: 2,
    weapons: ['battle_rifle', 'pulse_smg'],
    skulls: [],
    achievement: 'ngplus_veteran',
    title: 'NG++ Veteran',
  },
  {
    tier: 3,
    weapons: ['dmr', 'double_barrel'],
    skulls: [],
    achievement: 'ngplus_elite',
    title: 'NG+++ Elite',
  },
  {
    tier: 4,
    weapons: ['heavy_lmg', 'plasma_cannon'],
    skulls: [],
    achievement: 'ngplus_legend',
    title: 'NG++++ Legend',
  },
  {
    tier: 5,
    weapons: ['sniper_rifle'],
    skulls: [],
    achievement: 'ngplus_mythic',
    title: 'NG+++++ Mythic',
  },
  {
    tier: 6,
    weapons: [],
    skulls: [],
    achievement: 'ngplus_transcendent',
    title: 'NG++++++ Transcendent',
  },
  {
    tier: 7,
    weapons: [],
    skulls: [],
    achievement: 'ngplus_ultimate',
    title: 'NG+++++++ Ultimate',
  },
];

/**
 * NG+ exclusive skull definitions
 */
export const NG_PLUS_EXCLUSIVE_SKULLS = {
  terminus: {
    id: 'terminus',
    name: 'Terminus',
    description: 'Enemies explode on death, dealing damage to nearby foes.',
    icon: '\u{1F4A5}', // explosion
    tier: 2, // Unlocked after NG++
  },
  overcharge: {
    id: 'overcharge',
    name: 'Overcharge',
    description: 'Weapons deal 25% more damage but consume 50% more ammo.',
    icon: '\u26A1', // lightning
    tier: 3,
  },
  predator: {
    id: 'predator',
    name: 'Predator',
    description: 'Elite enemies have a chance to cloak and ambush.',
    icon: '\u{1F47B}', // ghost
    tier: 4,
  },
  ascension: {
    id: 'ascension',
    name: 'Ascension',
    description: 'All enemies are at maximum rank. You are the true hunter.',
    icon: '\u{1F451}', // crown
    tier: 5,
  },
};

// ============================================================================
// NEW GAME PLUS SYSTEM CLASS
// ============================================================================

class NewGamePlusSystemImpl {
  private state: NewGamePlusState;
  private initialized = false;
  private changeCallbacks: Set<() => void> = new Set();

  constructor() {
    this.state = this.createDefaultState();
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Initialize the NG+ system, loading persisted state
   */
  init(): void {
    if (this.initialized) return;
    this.loadFromStorage();
    this.initialized = true;
    log.info(
      `Initialized: unlocked=${this.state.unlocked}, ` +
        `completions=${this.state.completions}, ` +
        `currentTier=${this.state.currentTier}`
    );
  }

  /**
   * Create default state for new players
   */
  private createDefaultState(): NewGamePlusState {
    return {
      unlocked: false,
      completions: 0,
      currentTier: 0,
      unlockedWeapons: [],
      unlockedSkulls: [],
      ngPlusSkulls: [],
      highestTierCompleted: 0,
      firstCompletionTime: null,
      lastCompletionTime: null,
      totalNgPlusPlayTime: 0,
      totalNgPlusKills: 0,
      currentRunLevelsCompleted: [],
    };
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (json) {
        const loaded = JSON.parse(json) as Partial<NewGamePlusState>;
        this.state = { ...this.createDefaultState(), ...loaded };
      }
    } catch (error) {
      log.error('Failed to load NG+ state:', error);
      this.state = this.createDefaultState();
    }
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      log.error('Failed to save NG+ state:', error);
    }
  }

  /**
   * Persist current state and notify listeners
   */
  private persist(): void {
    this.saveToStorage();
    this.emitChange();
  }

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to state changes
   */
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
  // State Queries
  // --------------------------------------------------------------------------

  /**
   * Check if NG+ is unlocked
   */
  isUnlocked(): boolean {
    return this.state.unlocked;
  }

  /**
   * Get current NG+ tier (0 = normal game)
   */
  getCurrentTier(): number {
    return this.state.currentTier;
  }

  /**
   * Get total campaign completions
   */
  getCompletions(): number {
    return this.state.completions;
  }

  /**
   * Get the display name for current tier
   */
  getTierDisplayName(tier?: number): string {
    const t = tier ?? this.state.currentTier;
    if (t === 0) return 'Normal';
    if (t === 1) return 'NG+';
    return `NG${'+'.repeat(t)}`;
  }

  /**
   * Get the full state object (for UI display)
   */
  getState(): NewGamePlusState {
    return { ...this.state };
  }

  /**
   * Check if currently in an NG+ run
   */
  isInNgPlusRun(): boolean {
    return this.state.currentTier > 0;
  }

  /**
   * Get weapons unlocked for current or specified tier
   */
  getUnlockedWeapons(tier?: number): WeaponId[] {
    const t = tier ?? this.state.currentTier;
    const weapons = new Set<WeaponId>(this.state.unlockedWeapons);

    // Add tier-specific weapons
    for (let i = 1; i <= t; i++) {
      const tierWeapons = NG_PLUS_TIER_WEAPONS[i] ?? [];
      for (const w of tierWeapons) {
        weapons.add(w);
      }
    }

    return Array.from(weapons);
  }

  /**
   * Get the tier rewards for a specific tier
   */
  getTierReward(tier: number): NewGamePlusTierReward | null {
    return NG_PLUS_TIER_REWARDS.find((r) => r.tier === tier) ?? null;
  }

  /**
   * Get highest tier completed
   */
  getHighestTierCompleted(): number {
    return this.state.highestTierCompleted;
  }

  // --------------------------------------------------------------------------
  // Campaign Completion
  // --------------------------------------------------------------------------

  /**
   * Called when the campaign is completed
   * This unlocks NG+ if not already unlocked and increments the tier
   */
  onCampaignComplete(
    weapons: WeaponId[],
    skulls: SkullId[],
    playTime: number,
    kills: number
  ): NewGamePlusTierReward | null {
    const now = Date.now();

    // First completion ever
    if (!this.state.unlocked) {
      this.state.unlocked = true;
      this.state.firstCompletionTime = now;
      log.info('NG+ unlocked!');
    }

    // Increment completions
    this.state.completions++;
    this.state.lastCompletionTime = now;

    // Track stats for NG+ runs
    if (this.state.currentTier > 0) {
      this.state.totalNgPlusPlayTime += playTime;
      this.state.totalNgPlusKills += kills;
    }

    // Update highest tier if applicable
    if (this.state.currentTier > this.state.highestTierCompleted) {
      this.state.highestTierCompleted = this.state.currentTier;
    }

    // Carry over weapons and skulls
    for (const weapon of weapons) {
      if (!this.state.unlockedWeapons.includes(weapon)) {
        this.state.unlockedWeapons.push(weapon);
      }
    }
    for (const skull of skulls) {
      if (!this.state.unlockedSkulls.includes(skull)) {
        this.state.unlockedSkulls.push(skull);
      }
    }

    // Check for NG+ exclusive skull unlocks
    const completedTier = this.state.currentTier;
    for (const [skullId, skull] of Object.entries(NG_PLUS_EXCLUSIVE_SKULLS)) {
      if (
        completedTier >= skull.tier &&
        !this.state.ngPlusSkulls.includes(skullId)
      ) {
        this.state.ngPlusSkulls.push(skullId);
        log.info(`NG+ exclusive skull unlocked: ${skull.name}`);
      }
    }

    // Reset current run tracking
    this.state.currentRunLevelsCompleted = [];

    // Get tier reward
    const reward = this.getTierReward(completedTier > 0 ? completedTier : 1);

    this.persist();
    log.info(
      `Campaign completed! Completions: ${this.state.completions}, ` +
        `Tier: ${completedTier}`
    );

    return reward;
  }

  // --------------------------------------------------------------------------
  // Starting a New Game Plus Run
  // --------------------------------------------------------------------------

  /**
   * Start a new NG+ run at the next tier
   * Returns the tier being started
   */
  startNewGamePlus(): number {
    if (!this.state.unlocked) {
      log.warn('Cannot start NG+ - not unlocked');
      return 0;
    }

    // Calculate next tier (capped at MAX)
    const nextTier = Math.min(
      this.state.completions,
      MAX_NG_PLUS_TIER
    );

    this.state.currentTier = nextTier;
    this.state.currentRunLevelsCompleted = [];

    this.persist();
    log.info(`Starting NG+ tier ${nextTier}`);

    return nextTier;
  }

  /**
   * Start a fresh new game (tier 0)
   */
  startNormalGame(): void {
    this.state.currentTier = 0;
    this.state.currentRunLevelsCompleted = [];
    this.persist();
    log.info('Starting normal game');
  }

  // --------------------------------------------------------------------------
  // Progress Tracking
  // --------------------------------------------------------------------------

  /**
   * Mark a level as completed in current run
   */
  onLevelComplete(levelId: LevelId): void {
    if (!this.state.currentRunLevelsCompleted.includes(levelId)) {
      this.state.currentRunLevelsCompleted.push(levelId);
      this.persist();
    }
  }

  // --------------------------------------------------------------------------
  // Modifier Computation
  // --------------------------------------------------------------------------

  /**
   * Get the computed modifiers for the current or specified NG+ tier
   */
  getModifiers(tier?: number): NewGamePlusModifiers {
    const t = tier ?? this.state.currentTier;

    if (t === 0) {
      // Normal game - no modifiers
      return {
        enemyHealthMultiplier: 1.0,
        enemyDamageMultiplier: 1.0,
        enemyFireRateMultiplier: 1.0,
        enemyDetectionMultiplier: 1.0,
        playerStartHealthBonus: 0,
        playerStartArmorBonus: 0,
        bonusCredits: 0,
        scoreMultiplier: 1.0,
        eliteEnemiesEnabled: false,
        spawnRateMultiplier: 1.0,
        resourceDropMultiplier: 1.0,
      };
    }

    // Calculate multiplicative modifiers
    const enemyHealthMult = Math.pow(
      NG_PLUS_BASE_MODIFIERS.enemyHealthMultiplier,
      t
    );
    const enemyDamageMult = Math.pow(
      NG_PLUS_BASE_MODIFIERS.enemyDamageMultiplier,
      t
    );
    const enemyFireRateMult = Math.pow(
      NG_PLUS_BASE_MODIFIERS.enemyFireRateMultiplier,
      t
    );
    const enemyDetectionMult = Math.pow(
      NG_PLUS_BASE_MODIFIERS.enemyDetectionMultiplier,
      t
    );
    const spawnRateMult = Math.pow(
      NG_PLUS_BASE_MODIFIERS.spawnRateMultiplier,
      t
    );
    const resourceDropMult = Math.pow(
      NG_PLUS_BASE_MODIFIERS.resourceDropMultiplier,
      t
    );

    // Calculate additive bonuses (capped)
    const healthBonus = Math.min(
      NG_PLUS_BASE_MODIFIERS.playerStartHealthBonus * t,
      150
    );
    const armorBonus = Math.min(
      NG_PLUS_BASE_MODIFIERS.playerStartArmorBonus * t,
      75
    );
    const credits = NG_PLUS_BASE_MODIFIERS.bonusCredits * t;
    const scoreMult = 1.0 + NG_PLUS_BASE_MODIFIERS.scoreMultiplierBonus * t;

    return {
      enemyHealthMultiplier: enemyHealthMult,
      enemyDamageMultiplier: enemyDamageMult,
      enemyFireRateMultiplier: enemyFireRateMult,
      enemyDetectionMultiplier: enemyDetectionMult,
      playerStartHealthBonus: healthBonus,
      playerStartArmorBonus: armorBonus,
      bonusCredits: credits,
      scoreMultiplier: scoreMult,
      eliteEnemiesEnabled: t >= 2, // Elite enemies from NG++ onwards
      spawnRateMultiplier: spawnRateMult,
      resourceDropMultiplier: resourceDropMult,
    };
  }

  /**
   * Apply NG+ modifiers to base difficulty modifiers
   */
  applyToDifficulty(base: DifficultyModifiers): DifficultyModifiers {
    const ngMods = this.getModifiers();

    return {
      ...base,
      enemyHealthMultiplier: base.enemyHealthMultiplier * ngMods.enemyHealthMultiplier,
      enemyDamageMultiplier: base.enemyDamageMultiplier * ngMods.enemyDamageMultiplier,
      enemyFireRateMultiplier: base.enemyFireRateMultiplier * ngMods.enemyFireRateMultiplier,
      enemyDetectionMultiplier: base.enemyDetectionMultiplier * ngMods.enemyDetectionMultiplier,
      spawnRateMultiplier: base.spawnRateMultiplier * ngMods.spawnRateMultiplier,
      resourceDropMultiplier: base.resourceDropMultiplier * ngMods.resourceDropMultiplier,
      xpMultiplier: base.xpMultiplier * ngMods.scoreMultiplier,
    };
  }

  // --------------------------------------------------------------------------
  // Player Starting State
  // --------------------------------------------------------------------------

  /**
   * Get the player's starting state for an NG+ run
   */
  getStartingPlayerState(): {
    health: number;
    maxHealth: number;
    armor: number;
    maxArmor: number;
    weapons: WeaponId[];
    credits: number;
  } {
    const mods = this.getModifiers();
    const baseHealth = 100;
    const baseArmor = 0;
    const baseMaxArmor = 100;

    return {
      health: baseHealth + mods.playerStartHealthBonus,
      maxHealth: baseHealth + mods.playerStartHealthBonus,
      armor: mods.playerStartArmorBonus,
      maxArmor: baseMaxArmor,
      weapons: this.getUnlockedWeapons(),
      credits: mods.bonusCredits,
    };
  }

  // --------------------------------------------------------------------------
  // Admin / Debug
  // --------------------------------------------------------------------------

  /**
   * Reset all NG+ progress
   */
  reset(): void {
    this.state = this.createDefaultState();
    this.persist();
    log.info('NG+ progress reset');
  }

  /**
   * Unlock NG+ for testing
   */
  debugUnlock(): void {
    this.state.unlocked = true;
    this.state.completions = 1;
    this.persist();
    log.info('NG+ debug unlocked');
  }

  /**
   * Set specific tier for testing
   */
  debugSetTier(tier: number): void {
    if (tier < 0 || tier > MAX_NG_PLUS_TIER) {
      log.warn(`Invalid tier: ${tier}`);
      return;
    }
    this.state.unlocked = tier > 0;
    this.state.completions = Math.max(this.state.completions, tier);
    this.state.currentTier = tier;
    this.persist();
    log.info(`NG+ tier set to ${tier}`);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let ngPlusInstance: NewGamePlusSystemImpl | null = null;

/**
 * Get the singleton NewGamePlus system instance
 */
export function getNewGamePlusSystem(): NewGamePlusSystemImpl {
  if (!ngPlusInstance) {
    ngPlusInstance = new NewGamePlusSystemImpl();
  }
  return ngPlusInstance;
}

/**
 * Initialize the NG+ system. Call once at app startup.
 */
export function initNewGamePlus(): void {
  getNewGamePlusSystem().init();
}

/**
 * Dispose the NG+ system singleton
 */
export function disposeNewGamePlusSystem(): void {
  if (ngPlusInstance) {
    ngPlusInstance = null;
  }
}

// Export class type for external typing
export type NewGamePlusSystem = NewGamePlusSystemImpl;
