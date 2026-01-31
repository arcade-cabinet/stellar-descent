/**
 * Game Mode Manager
 *
 * Central manager for different game modes and their modifiers.
 * Coordinates between:
 * - Normal gameplay
 * - New Game Plus (NG+)
 * - Skull modifiers
 * - Difficulty settings
 *
 * Provides a unified interface for querying the combined effect of all
 * active modifiers on gameplay systems.
 *
 * Integration points:
 * - NewGamePlus: NG+ tier modifiers
 * - SkullSystem: Active skull modifiers
 * - DifficultySettings: Base difficulty modifiers
 * - Combat systems: Apply combined modifiers to enemies/player
 */

import {
  type DifficultyLevel,
  type DifficultyModifiers,
  getDifficultyModifiers,
  loadDifficultySetting,
} from '../core/DifficultySettings';
import { getLogger } from '../core/Logger';
import { getSkullSystem, type SkullModifiers } from '../collectibles/SkullSystem';
import {
  getNewGamePlusSystem,
  type NewGamePlusModifiers,
} from './NewGamePlus';
import type { WeaponId } from '../entities/weapons';
import type { LevelId } from '../levels/types';

const log = getLogger('GameModeManager');

// ============================================================================
// TYPES
// ============================================================================

/**
 * The active game mode
 */
export type GameMode = 'normal' | 'new_game_plus' | 'arcade' | 'survival';

/**
 * Combined modifiers from all sources
 */
export interface CombinedGameModifiers {
  // Enemy modifiers
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  enemyFireRateMultiplier: number;
  enemyDetectionMultiplier: number;
  spawnRateMultiplier: number;

  // Player modifiers
  playerDamageReceivedMultiplier: number;
  playerHealthRegenMultiplier: number;
  playerStartHealthBonus: number;
  playerStartArmorBonus: number;

  // Resource modifiers
  resourceDropMultiplier: number;
  xpMultiplier: number;
  scoreMultiplier: number;
  bonusCredits: number;

  // Gameplay flags
  disableRespawns: boolean;
  hideHUD: boolean;
  eliteEnemiesEnabled: boolean;
  upgradeEnemies: boolean;
  confettiOnHeadshot: boolean;

  // Physics
  physicsForceMultiplier: number;

  // Source info
  difficulty: DifficultyLevel;
  ngPlusTier: number;
  activeSkullCount: number;
}

/**
 * Player starting configuration for a new game
 */
export interface PlayerStartConfig {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  weapons: WeaponId[];
  credits: number;
  startingLevel: LevelId;
}

/**
 * Game session state
 */
export interface GameSessionState {
  mode: GameMode;
  difficulty: DifficultyLevel;
  ngPlusTier: number;
  startTime: number;
  levelsCompleted: LevelId[];
  totalKills: number;
  totalDeaths: number;
  playTime: number;
}

// ============================================================================
// GAME MODE MANAGER CLASS
// ============================================================================

class GameModeManagerImpl {
  private currentMode: GameMode = 'normal';
  private currentDifficulty: DifficultyLevel = 'normal';
  private sessionState: GameSessionState | null = null;
  private changeCallbacks: Set<() => void> = new Set();
  private initialized = false;

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Initialize the game mode manager
   */
  init(): void {
    if (this.initialized) return;

    this.currentDifficulty = loadDifficultySetting();
    this.initialized = true;
    log.info(`Initialized with difficulty: ${this.currentDifficulty}`);
  }

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to mode/state changes
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
  // Mode Management
  // --------------------------------------------------------------------------

  /**
   * Get the current game mode
   */
  getCurrentMode(): GameMode {
    return this.currentMode;
  }

  /**
   * Get the current difficulty level
   */
  getCurrentDifficulty(): DifficultyLevel {
    return this.currentDifficulty;
  }

  /**
   * Set the game mode
   */
  setMode(mode: GameMode): void {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.emitChange();
      log.info(`Game mode changed to: ${mode}`);
    }
  }

  /**
   * Set the difficulty level
   */
  setDifficulty(difficulty: DifficultyLevel): void {
    if (this.currentDifficulty !== difficulty) {
      this.currentDifficulty = difficulty;
      this.emitChange();
      log.info(`Difficulty changed to: ${difficulty}`);
    }
  }

  /**
   * Check if NG+ mode is active
   */
  isNewGamePlus(): boolean {
    return this.currentMode === 'new_game_plus';
  }

  /**
   * Get the current NG+ tier (0 if not in NG+)
   */
  getNgPlusTier(): number {
    if (this.currentMode !== 'new_game_plus') return 0;
    return getNewGamePlusSystem().getCurrentTier();
  }

  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------

  /**
   * Start a new game session
   */
  startSession(
    mode: GameMode,
    difficulty: DifficultyLevel,
    startLevel: LevelId = 'anchor_station'
  ): GameSessionState {
    this.currentMode = mode;
    this.currentDifficulty = difficulty;

    const ngPlusTier =
      mode === 'new_game_plus'
        ? getNewGamePlusSystem().getCurrentTier()
        : 0;

    this.sessionState = {
      mode,
      difficulty,
      ngPlusTier,
      startTime: Date.now(),
      levelsCompleted: [],
      totalKills: 0,
      totalDeaths: 0,
      playTime: 0,
    };

    this.emitChange();
    log.info(
      `Session started: mode=${mode}, difficulty=${difficulty}, ` +
        `ngPlusTier=${ngPlusTier}, startLevel=${startLevel}`
    );

    return this.sessionState;
  }

  /**
   * Start a New Game Plus session
   */
  startNewGamePlusSession(difficulty: DifficultyLevel): GameSessionState {
    const ngPlus = getNewGamePlusSystem();

    if (!ngPlus.isUnlocked()) {
      log.warn('NG+ not unlocked, starting normal game instead');
      return this.startSession('normal', difficulty);
    }

    // Start the NG+ run
    ngPlus.startNewGamePlus();

    return this.startSession('new_game_plus', difficulty);
  }

  /**
   * Get current session state
   */
  getSessionState(): GameSessionState | null {
    return this.sessionState;
  }

  /**
   * Update session on level complete
   */
  onLevelComplete(levelId: LevelId): void {
    if (this.sessionState) {
      if (!this.sessionState.levelsCompleted.includes(levelId)) {
        this.sessionState.levelsCompleted.push(levelId);
      }
    }

    // Also notify NG+ system
    if (this.currentMode === 'new_game_plus') {
      getNewGamePlusSystem().onLevelComplete(levelId);
    }
  }

  /**
   * Update session kill count
   */
  onKill(): void {
    if (this.sessionState) {
      this.sessionState.totalKills++;
    }
  }

  /**
   * Update session death count
   */
  onDeath(): void {
    if (this.sessionState) {
      this.sessionState.totalDeaths++;
    }
  }

  /**
   * End the current session
   */
  endSession(): GameSessionState | null {
    const session = this.sessionState;
    if (session) {
      session.playTime = Date.now() - session.startTime;
    }
    this.sessionState = null;
    this.currentMode = 'normal';
    this.emitChange();
    return session;
  }

  // --------------------------------------------------------------------------
  // Modifier Computation
  // --------------------------------------------------------------------------

  /**
   * Get combined modifiers from all sources
   */
  getCombinedModifiers(): CombinedGameModifiers {
    // Get base difficulty modifiers
    const baseMods = getDifficultyModifiers(this.currentDifficulty);

    // Get NG+ modifiers
    const ngPlusMods = getNewGamePlusSystem().getModifiers();

    // Get skull modifiers
    const skullMods = getSkullSystem().getActiveModifiers();

    // Combine all modifiers
    const combined: CombinedGameModifiers = {
      // Enemy modifiers (multiplicative)
      enemyHealthMultiplier:
        baseMods.enemyHealthMultiplier *
        ngPlusMods.enemyHealthMultiplier *
        skullMods.enemyHealthMultiplier,
      enemyDamageMultiplier:
        baseMods.enemyDamageMultiplier *
        ngPlusMods.enemyDamageMultiplier *
        skullMods.enemyDamageMultiplier,
      enemyFireRateMultiplier:
        baseMods.enemyFireRateMultiplier *
        ngPlusMods.enemyFireRateMultiplier *
        skullMods.enemyFireRateMultiplier,
      enemyDetectionMultiplier:
        baseMods.enemyDetectionMultiplier *
        ngPlusMods.enemyDetectionMultiplier *
        skullMods.enemyDetectionMultiplier,
      spawnRateMultiplier:
        baseMods.spawnRateMultiplier * ngPlusMods.spawnRateMultiplier,

      // Player modifiers
      playerDamageReceivedMultiplier: baseMods.playerDamageReceivedMultiplier,
      playerHealthRegenMultiplier: baseMods.playerHealthRegenMultiplier,
      playerStartHealthBonus: ngPlusMods.playerStartHealthBonus,
      playerStartArmorBonus: ngPlusMods.playerStartArmorBonus,

      // Resource modifiers
      resourceDropMultiplier:
        baseMods.resourceDropMultiplier *
        ngPlusMods.resourceDropMultiplier *
        skullMods.resourceDropMultiplier,
      xpMultiplier:
        baseMods.xpMultiplier *
        ngPlusMods.scoreMultiplier *
        skullMods.scoreMultiplier,
      scoreMultiplier: ngPlusMods.scoreMultiplier * skullMods.scoreMultiplier,
      bonusCredits: ngPlusMods.bonusCredits,

      // Gameplay flags
      disableRespawns: skullMods.disableRespawns,
      hideHUD: skullMods.hideHUD,
      eliteEnemiesEnabled: ngPlusMods.eliteEnemiesEnabled || skullMods.upgradeEnemies,
      upgradeEnemies: skullMods.upgradeEnemies,
      confettiOnHeadshot: skullMods.confettiOnHeadshot,

      // Physics
      physicsForceMultiplier: skullMods.physicsForceMultiplier,

      // Source info
      difficulty: this.currentDifficulty,
      ngPlusTier: this.getNgPlusTier(),
      activeSkullCount: getSkullSystem().getActiveCount(),
    };

    return combined;
  }

  /**
   * Get the player starting configuration for a new game
   */
  getPlayerStartConfig(startLevel: LevelId = 'anchor_station'): PlayerStartConfig {
    const ngPlus = getNewGamePlusSystem();
    const isNgPlus = this.currentMode === 'new_game_plus';

    if (isNgPlus) {
      const ngState = ngPlus.getStartingPlayerState();
      return {
        health: ngState.health,
        maxHealth: ngState.maxHealth,
        armor: ngState.armor,
        maxArmor: ngState.maxArmor,
        weapons: ngState.weapons,
        credits: ngState.credits,
        startingLevel: startLevel,
      };
    }

    // Normal game starting config
    return {
      health: 100,
      maxHealth: 100,
      armor: 0,
      maxArmor: 100,
      weapons: ['sidearm'],
      credits: 0,
      startingLevel: startLevel,
    };
  }

  // --------------------------------------------------------------------------
  // Display Helpers
  // --------------------------------------------------------------------------

  /**
   * Get a display string for the current mode
   */
  getModeDisplayName(): string {
    switch (this.currentMode) {
      case 'normal':
        return 'Campaign';
      case 'new_game_plus':
        return getNewGamePlusSystem().getTierDisplayName();
      case 'arcade':
        return 'Arcade';
      case 'survival':
        return 'Survival';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get the NG+ tier display string
   */
  getNgPlusTierDisplay(): string {
    return getNewGamePlusSystem().getTierDisplayName();
  }

  /**
   * Check if a feature is enabled based on current modifiers
   */
  isFeatureEnabled(feature: 'elite_enemies' | 'confetti' | 'no_hud'): boolean {
    const mods = this.getCombinedModifiers();
    switch (feature) {
      case 'elite_enemies':
        return mods.eliteEnemiesEnabled;
      case 'confetti':
        return mods.confettiOnHeadshot;
      case 'no_hud':
        return mods.hideHUD;
      default:
        return false;
    }
  }

  // --------------------------------------------------------------------------
  // Statistics
  // --------------------------------------------------------------------------

  /**
   * Get comprehensive stats for the current session/mode
   */
  getStats(): {
    mode: GameMode;
    difficulty: DifficultyLevel;
    ngPlusTier: number;
    modifierSummary: string;
    challengeRating: number;
  } {
    const mods = this.getCombinedModifiers();
    const tier = this.getNgPlusTier();

    // Calculate a "challenge rating" based on combined modifiers
    const challengeRating = Math.round(
      (mods.enemyHealthMultiplier *
        mods.enemyDamageMultiplier *
        mods.spawnRateMultiplier *
        (mods.eliteEnemiesEnabled ? 1.5 : 1.0)) *
        100
    );

    // Build modifier summary
    const parts: string[] = [];
    if (tier > 0) parts.push(`NG+${tier > 1 ? '+'.repeat(tier - 1) : ''}`);
    if (mods.activeSkullCount > 0) parts.push(`${mods.activeSkullCount} Skulls`);
    if (this.currentDifficulty !== 'normal') {
      parts.push(this.currentDifficulty.charAt(0).toUpperCase() + this.currentDifficulty.slice(1));
    }

    return {
      mode: this.currentMode,
      difficulty: this.currentDifficulty,
      ngPlusTier: tier,
      modifierSummary: parts.length > 0 ? parts.join(' + ') : 'Standard',
      challengeRating,
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let gameModeManagerInstance: GameModeManagerImpl | null = null;

/**
 * Get the singleton GameModeManager instance
 */
export function getGameModeManager(): GameModeManagerImpl {
  if (!gameModeManagerInstance) {
    gameModeManagerInstance = new GameModeManagerImpl();
  }
  return gameModeManagerInstance;
}

/**
 * Initialize the game mode manager. Call once at app startup.
 */
export function initGameModeManager(): void {
  getGameModeManager().init();
}

// Export class type for external typing
export type GameModeManager = GameModeManagerImpl;
