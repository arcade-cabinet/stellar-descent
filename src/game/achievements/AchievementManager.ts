/**
 * AchievementManager - Tracks and unlocks player achievements
 *
 * Handles:
 * - Achievement definitions and state
 * - Unlock condition tracking
 * - LocalStorage persistence
 * - Event emission for UI notifications
 *
 * Integration Points:
 * - GameContext: Kill tracking, level completion
 * - TutorialManager: Tutorial completion
 * - Levels: Specific level-based achievements
 */

import type { LevelId } from '../levels/types';

// ============================================================================
// TYPES
// ============================================================================

export type AchievementId =
  // Story achievements (13)
  | 'first_steps' // Complete tutorial
  | 'odst' // Complete HALO jump
  | 'baptism_by_fire' // Win first surface combat encounter
  | 'road_warrior' // Complete Canyon Run
  | 'survivor' // Complete FOB Delta without dying
  | 'reunited' // Find Marcus
  | 'brothers_keeper' // Complete Brothers in Arms without Marcus going down
  | 'ice_breaker' // Complete Southern Ice
  | 'queen_slayer' // Defeat the Brood Queen
  | 'total_war' // Complete Hive Assault
  | 'extracted' // Complete Extraction
  | 'great_escape' // Complete Final Escape
  | 'campaign_veteran' // Complete the entire campaign
  // Combat achievements (7)
  | 'first_blood' // Kill first enemy
  | 'exterminator' // Kill 100 aliens total
  | 'mass_extinction' // Kill 500 aliens total
  | 'headhunter' // Kill 50 aliens in a single level
  | 'multi_kill' // Kill 5 enemies within 3 seconds
  | 'grenadier' // Kill 3 enemies with a single explosion
  | 'last_stand' // Kill an enemy while below 10% health
  // Exploration achievements (6)
  | 'explorer' // Discover all areas in a level
  | 'log_collector' // Find all audio logs
  | 'secret_hunter' // Find 10 secret areas
  | 'curious' // Find your first secret area
  | 'thorough' // Complete a level finding all collectibles
  | 'cartographer' // Visit every room in FOB Delta
  // Challenge achievements (12)
  | 'speedrunner' // Complete game in under 60 minutes
  | 'untouchable' // Complete a level without taking damage
  | 'sharpshooter' // 80%+ accuracy in a level
  | 'speed_demon_landfall' // Complete Landfall under par time
  | 'speed_demon_canyon' // Complete Canyon Run under par time
  | 'speed_demon_fob' // Complete FOB Delta under par time
  | 'speed_demon_brothers' // Complete Brothers in Arms under par time
  | 'speed_demon_ice' // Complete Southern Ice under par time
  | 'speed_demon_escape' // Complete Final Escape under par time
  | 'iron_marine' // Complete any level on Insane difficulty
  | 'perfect_drop' // Complete Landfall with 100% accuracy, no damage
  | 'flawless_run'; // Complete Final Escape without crashing

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  secret?: boolean; // Hidden until unlocked
  category: 'story' | 'combat' | 'challenge' | 'exploration';
  // For progressive achievements, define the target
  progressTarget?: number;
  // For progress achievements, which progress key to use
  progressKey?: keyof AchievementProgress;
}

export interface AchievementState {
  unlockedAt: number | null; // Timestamp when unlocked, null if locked
}

export interface AchievementProgress {
  // Kill tracking
  totalKills?: number;
  levelKills?: number; // Kills in current level
  // Timing
  gameStartTime?: number;
  levelStartTime?: number;
  // Damage tracking
  levelDamageTaken?: Partial<Record<LevelId, number>>;
  // Accuracy tracking
  shotsFired?: number;
  shotsHit?: number;
  levelShotsFired?: number;
  levelShotsHit?: number;
  // Exploration tracking
  secretsFound?: number;
  audioLogsFound?: number;
  areasDiscovered?: number;
  // Multi-kill tracking
  recentKillTimestamps?: number[];
  // Marcus tracking for Brothers in Arms
  marcusDownCount?: number;
}

export type AchievementUnlockCallback = (achievement: Achievement) => void;

// Par times for Speed Demon achievements (in milliseconds)
export const LEVEL_PAR_TIMES: Partial<Record<LevelId, number>> = {
  landfall: 5 * 60 * 1000, // 5 minutes
  canyon_run: 4 * 60 * 1000, // 4 minutes
  fob_delta: 8 * 60 * 1000, // 8 minutes
  brothers_in_arms: 10 * 60 * 1000, // 10 minutes
  southern_ice: 9 * 60 * 1000, // 9 minutes
  the_breach: 12 * 60 * 1000, // 12 minutes
  hive_assault: 15 * 60 * 1000, // 15 minutes
  extraction: 6 * 60 * 1000, // 6 minutes
  final_escape: 3 * 60 * 1000, // 3 minutes
};

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================================

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  // === STORY ACHIEVEMENTS (13) ===
  first_steps: {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete the tutorial on Anchor Station Prometheus',
    icon: '\u2605', // Star
    category: 'story',
  },
  odst: {
    id: 'odst',
    name: 'ODST',
    description: 'Complete the HALO drop onto the planet surface',
    icon: '\u2193', // Down arrow
    category: 'story',
  },
  baptism_by_fire: {
    id: 'baptism_by_fire',
    name: 'Baptism by Fire',
    description: 'Survive your first surface combat encounter',
    icon: '\u2694', // Crossed swords
    category: 'story',
  },
  road_warrior: {
    id: 'road_warrior',
    name: 'Road Warrior',
    description: 'Survive the canyon vehicle chase and reach FOB Delta',
    icon: '\u2699', // Gear
    category: 'story',
  },
  survivor: {
    id: 'survivor',
    name: 'Survivor',
    description: 'Complete FOB Delta without dying',
    icon: '\u2661', // Heart
    category: 'story',
  },
  reunited: {
    id: 'reunited',
    name: 'Reunited',
    description: 'Find Corporal Marcus Cole',
    icon: '\u2726', // Star
    category: 'story',
  },
  brothers_keeper: {
    id: 'brothers_keeper',
    name: "Brother's Keeper",
    description: 'Complete Brothers in Arms without Marcus going down',
    icon: '\u2764', // Heart
    category: 'story',
  },
  ice_breaker: {
    id: 'ice_breaker',
    name: 'Ice Breaker',
    description: 'Traverse the frozen wasteland and reach the secondary hive entrance',
    icon: '\u2744', // Snowflake
    category: 'story',
  },
  queen_slayer: {
    id: 'queen_slayer',
    name: 'Queen Slayer',
    description: 'Defeat the Brood Queen in the underground hive',
    icon: '\u2620', // Skull
    category: 'story',
  },
  total_war: {
    id: 'total_war',
    name: 'Total War',
    description: 'Lead the combined arms assault and plant charges on the hive nexus',
    icon: '\u2622', // Radioactive
    category: 'story',
  },
  extracted: {
    id: 'extracted',
    name: 'Extracted',
    description: 'Hold LZ Omega and signal the dropship for extraction',
    icon: '\u2708', // Airplane
    category: 'story',
  },
  great_escape: {
    id: 'great_escape',
    name: 'Great Escape',
    description: 'Outrun the planetary collapse and reach the dropship',
    icon: '\u26A1', // Lightning
    category: 'story',
  },
  campaign_veteran: {
    id: 'campaign_veteran',
    name: 'Campaign Veteran',
    description: 'Complete the entire 10-mission campaign on any difficulty',
    icon: '\u2606', // White star
    category: 'story',
  },

  // === COMBAT ACHIEVEMENTS (7) ===
  first_blood: {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill your first enemy',
    icon: '\u2022', // Bullet
    category: 'combat',
  },
  exterminator: {
    id: 'exterminator',
    name: 'Exterminator',
    description: 'Kill 100 aliens across all playthroughs',
    icon: '\u2694', // Crossed swords
    category: 'combat',
    progressTarget: 100,
    progressKey: 'totalKills',
  },
  mass_extinction: {
    id: 'mass_extinction',
    name: 'Mass Extinction',
    description: 'Kill 500 aliens across all playthroughs',
    icon: '\u2620', // Skull
    category: 'combat',
    progressTarget: 500,
    progressKey: 'totalKills',
    secret: true,
  },
  headhunter: {
    id: 'headhunter',
    name: 'Headhunter',
    description: 'Kill 50 aliens in a single level',
    icon: '\u2316', // Target
    category: 'combat',
  },
  multi_kill: {
    id: 'multi_kill',
    name: 'Multi Kill',
    description: 'Kill 5 enemies within 3 seconds',
    icon: '\u2735', // Eight spoked asterisk
    category: 'combat',
  },
  grenadier: {
    id: 'grenadier',
    name: 'Grenadier',
    description: 'Kill 3 enemies with a single explosion',
    icon: '\u25CF', // Black circle
    category: 'combat',
  },
  last_stand: {
    id: 'last_stand',
    name: 'Last Stand',
    description: 'Kill an enemy while below 10% health',
    icon: '\u2665', // Black heart
    category: 'combat',
  },

  // === EXPLORATION ACHIEVEMENTS (6) ===
  curious: {
    id: 'curious',
    name: 'Curious',
    description: 'Discover your first secret area',
    icon: '\u2753', // Question mark
    category: 'exploration',
  },
  secret_hunter: {
    id: 'secret_hunter',
    name: 'Secret Hunter',
    description: 'Discover 10 secret areas across all playthroughs',
    icon: '\u2736', // Six pointed star
    category: 'exploration',
    progressTarget: 10,
    progressKey: 'secretsFound',
  },
  log_collector: {
    id: 'log_collector',
    name: 'Log Collector',
    description: 'Find all 18 audio logs scattered across the campaign',
    icon: '\u266A', // Music note
    category: 'exploration',
    progressTarget: 18,
    progressKey: 'audioLogsFound',
  },
  explorer: {
    id: 'explorer',
    name: 'Explorer',
    description: 'Discover all areas in any level',
    icon: '\u2690', // Flag
    category: 'exploration',
  },
  thorough: {
    id: 'thorough',
    name: 'Thorough',
    description: 'Complete a level finding all collectibles',
    icon: '\u2714', // Checkmark
    category: 'exploration',
  },
  cartographer: {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'Visit every room in FOB Delta',
    icon: '\u25A6', // Square with diagonal
    category: 'exploration',
  },

  // === CHALLENGE ACHIEVEMENTS (12) ===
  speedrunner: {
    id: 'speedrunner',
    name: 'Speedrunner',
    description: 'Complete the entire 10-mission campaign in under 60 minutes',
    icon: '\u23F1', // Stopwatch
    category: 'challenge',
    secret: true,
  },
  untouchable: {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Complete any level without taking damage',
    icon: '\u2727', // Diamond
    category: 'challenge',
  },
  sharpshooter: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Achieve 80% or better accuracy in a level (min 20 shots)',
    icon: '\u25CE', // Bullseye
    category: 'challenge',
  },
  speed_demon_landfall: {
    id: 'speed_demon_landfall',
    name: 'Speed Demon: Landfall',
    description: 'Complete Landfall in under 5 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_canyon: {
    id: 'speed_demon_canyon',
    name: 'Speed Demon: Canyon Run',
    description: 'Complete Canyon Run in under 4 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_fob: {
    id: 'speed_demon_fob',
    name: 'Speed Demon: FOB Delta',
    description: 'Complete FOB Delta in under 8 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_brothers: {
    id: 'speed_demon_brothers',
    name: 'Speed Demon: Brothers',
    description: 'Complete Brothers in Arms in under 10 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_ice: {
    id: 'speed_demon_ice',
    name: 'Speed Demon: Southern Ice',
    description: 'Complete Southern Ice in under 9 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  speed_demon_escape: {
    id: 'speed_demon_escape',
    name: 'Speed Demon: Final Escape',
    description: 'Complete Final Escape in under 3 minutes',
    icon: '\u26A1', // Lightning
    category: 'challenge',
  },
  iron_marine: {
    id: 'iron_marine',
    name: 'Iron Marine',
    description: 'Complete any level on Insane difficulty',
    icon: '\u2666', // Diamond
    category: 'challenge',
    secret: true,
  },
  perfect_drop: {
    id: 'perfect_drop',
    name: 'Perfect Drop',
    description: 'Complete Landfall with 100% accuracy and no damage taken',
    icon: '\u2605', // Star
    category: 'challenge',
    secret: true,
  },
  flawless_run: {
    id: 'flawless_run',
    name: 'Flawless Run',
    description: 'Complete Final Escape without crashing the vehicle',
    icon: '\u2605', // Star
    category: 'challenge',
    secret: true,
  },
};

// Storage keys
const STORAGE_KEY_STATE = 'stellar_descent_achievements';
const STORAGE_KEY_PROGRESS = 'stellar_descent_achievement_progress';

// ============================================================================
// ACHIEVEMENT MANAGER CLASS
// ============================================================================

class AchievementManagerImpl {
  private state: Record<AchievementId, AchievementState>;
  private progress: AchievementProgress;
  private unlockCallbacks: Set<AchievementUnlockCallback>;
  private initialized: boolean = false;

  constructor() {
    this.state = this.createDefaultState();
    this.progress = this.createDefaultProgress();
    this.unlockCallbacks = new Set();
  }

  /**
   * Initialize the achievement system, loading from localStorage
   */
  init(): void {
    if (this.initialized) return;

    this.loadFromStorage();
    this.initialized = true;
    console.log(
      '[AchievementManager] Initialized with',
      this.getUnlockedCount(),
      'achievements unlocked'
    );
  }

  /**
   * Create default state (all achievements locked)
   */
  private createDefaultState(): Record<AchievementId, AchievementState> {
    const state: Partial<Record<AchievementId, AchievementState>> = {};
    for (const id of Object.keys(ACHIEVEMENTS) as AchievementId[]) {
      state[id] = { unlockedAt: null };
    }
    return state as Record<AchievementId, AchievementState>;
  }

  /**
   * Create default progress tracking
   */
  private createDefaultProgress(): AchievementProgress {
    return {
      totalKills: 0,
      levelKills: 0,
      gameStartTime: undefined,
      levelStartTime: undefined,
      levelDamageTaken: {} as Record<LevelId, number>,
      shotsFired: 0,
      shotsHit: 0,
      levelShotsFired: 0,
      levelShotsHit: 0,
      secretsFound: 0,
      audioLogsFound: 0,
      areasDiscovered: 0,
      recentKillTimestamps: [],
      marcusDownCount: 0,
    };
  }

  /**
   * Load state and progress from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stateJson = localStorage.getItem(STORAGE_KEY_STATE);
      if (stateJson) {
        const loadedState = JSON.parse(stateJson);
        // Merge with defaults to handle new achievements
        this.state = { ...this.createDefaultState(), ...loadedState };
      }

      const progressJson = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (progressJson) {
        const loadedProgress = JSON.parse(progressJson);
        this.progress = { ...this.createDefaultProgress(), ...loadedProgress };
      }
    } catch (error) {
      console.error('[AchievementManager] Failed to load from storage:', error);
      this.state = this.createDefaultState();
      this.progress = this.createDefaultProgress();
    }
  }

  /**
   * Save state and progress to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(this.state));
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(this.progress));
    } catch (error) {
      console.error('[AchievementManager] Failed to save to storage:', error);
    }
  }

  /**
   * Subscribe to achievement unlock events
   */
  onUnlock(callback: AchievementUnlockCallback): () => void {
    this.unlockCallbacks.add(callback);
    return () => {
      this.unlockCallbacks.delete(callback);
    };
  }

  /**
   * Emit unlock event to all subscribers
   */
  private emitUnlock(achievement: Achievement): void {
    for (const callback of this.unlockCallbacks) {
      try {
        callback(achievement);
      } catch (error) {
        console.error('[AchievementManager] Error in unlock callback:', error);
      }
    }
  }

  /**
   * Check if an achievement is unlocked
   */
  isUnlocked(id: AchievementId): boolean {
    return this.state[id]?.unlockedAt !== null;
  }

  /**
   * Get achievement state
   */
  getState(id: AchievementId): AchievementState {
    return this.state[id] ?? { unlockedAt: null };
  }

  /**
   * Get achievement definition
   */
  getAchievement(id: AchievementId): Achievement {
    return ACHIEVEMENTS[id];
  }

  /**
   * Get all achievements with their states
   */
  getAllAchievements(): Array<{ achievement: Achievement; state: AchievementState }> {
    return (Object.keys(ACHIEVEMENTS) as AchievementId[]).map((id) => ({
      achievement: ACHIEVEMENTS[id],
      state: this.state[id],
    }));
  }

  /**
   * Get count of unlocked achievements
   */
  getUnlockedCount(): number {
    return Object.values(this.state).filter((s) => s.unlockedAt !== null).length;
  }

  /**
   * Get total achievement count
   */
  getTotalCount(): number {
    return Object.keys(ACHIEVEMENTS).length;
  }

  /**
   * Get current progress data
   */
  getProgress(): AchievementProgress {
    return { ...this.progress };
  }

  // ============================================================================
  // UNLOCK METHODS
  // ============================================================================

  /**
   * Unlock an achievement by ID
   */
  unlock(id: AchievementId): boolean {
    if (this.isUnlocked(id)) {
      return false; // Already unlocked
    }

    const achievement = ACHIEVEMENTS[id];
    if (!achievement) {
      console.warn(`[AchievementManager] Unknown achievement: ${id}`);
      return false;
    }

    this.state[id] = { unlockedAt: Date.now() };
    this.saveToStorage();

    console.log(`[AchievementManager] Achievement unlocked: ${achievement.name}`);
    this.emitUnlock(achievement);

    return true;
  }

  // ============================================================================
  // TRIGGER METHODS (called by game systems)
  // ============================================================================

  /**
   * Called when tutorial is completed
   */
  onTutorialComplete(): void {
    this.unlock('first_steps');
  }

  /**
   * Called when HALO drop is completed (landing on surface)
   */
  onHaloDropComplete(): void {
    this.unlock('odst');
  }

  /**
   * Called when a level is started
   */
  onLevelStart(levelId: LevelId): void {
    // Reset damage tracking for this level
    this.progress.levelDamageTaken = this.progress.levelDamageTaken ?? {};
    this.progress.levelDamageTaken[levelId] = 0;
    // Reset level-specific tracking
    this.progress.levelKills = 0;
    this.progress.levelShotsFired = 0;
    this.progress.levelShotsHit = 0;
    this.progress.levelStartTime = Date.now();
    this.saveToStorage();
  }

  /**
   * Called when player takes damage
   */
  onDamageTaken(levelId: LevelId, damage: number): void {
    this.progress.levelDamageTaken = this.progress.levelDamageTaken ?? {};
    this.progress.levelDamageTaken[levelId] =
      (this.progress.levelDamageTaken[levelId] ?? 0) + damage;
    this.saveToStorage();
  }

  /**
   * Called when a level is completed
   */
  onLevelComplete(levelId: LevelId, playerDied: boolean, difficulty?: string): void {
    const damageTaken = this.progress.levelDamageTaken?.[levelId] ?? 0;
    const levelTime = this.progress.levelStartTime
      ? Date.now() - this.progress.levelStartTime
      : Infinity;
    const parTime = LEVEL_PAR_TIMES[levelId];

    // Check for survivor achievement (FOB Delta without dying)
    if (levelId === 'fob_delta' && !playerDied) {
      this.unlock('survivor');
    }

    // Check for untouchable achievement (any level without damage)
    if (damageTaken === 0) {
      this.unlock('untouchable');
    }

    // Check for headhunter achievement (50 kills in a level)
    if ((this.progress.levelKills ?? 0) >= 50) {
      this.unlock('headhunter');
    }

    // Check for sharpshooter achievement (80%+ accuracy with min 20 shots)
    const levelShots = this.progress.levelShotsFired ?? 0;
    const levelHits = this.progress.levelShotsHit ?? 0;
    if (levelShots >= 20) {
      const accuracy = levelHits / levelShots;
      if (accuracy >= 0.8) {
        this.unlock('sharpshooter');
      }
    }

    // Check for Speed Demon achievements
    if (parTime && levelTime < parTime) {
      switch (levelId) {
        case 'landfall':
          this.unlock('speed_demon_landfall');
          break;
        case 'canyon_run':
          this.unlock('speed_demon_canyon');
          break;
        case 'fob_delta':
          this.unlock('speed_demon_fob');
          break;
        case 'brothers_in_arms':
          this.unlock('speed_demon_brothers');
          break;
        case 'southern_ice':
          this.unlock('speed_demon_ice');
          break;
        case 'final_escape':
          this.unlock('speed_demon_escape');
          break;
      }
    }

    // Check for iron marine (complete on Insane difficulty)
    if (difficulty === 'insane') {
      this.unlock('iron_marine');
    }

    // Check for perfect drop (Landfall with 100% accuracy and no damage)
    if (levelId === 'landfall' && damageTaken === 0 && levelShots > 0 && levelHits === levelShots) {
      this.unlock('perfect_drop');
    }
  }

  /**
   * Called when Marcus is found (Brothers in Arms level)
   */
  onMarcusFound(): void {
    this.unlock('reunited');
  }

  /**
   * Called when the Queen is defeated
   */
  onQueenDefeated(): void {
    this.unlock('queen_slayer');
  }

  /**
   * Called when the game is completed (after Final Escape)
   */
  onGameComplete(): void {
    this.unlock('great_escape');
    this.unlock('campaign_veteran');

    // Check for speedrunner (under 60 minutes for 10 levels)
    if (this.progress.gameStartTime) {
      const elapsedMs = Date.now() - this.progress.gameStartTime;
      const sixtyMinutesMs = 60 * 60 * 1000;
      if (elapsedMs < sixtyMinutesMs) {
        this.unlock('speedrunner');
      }
    }
  }

  /**
   * Called when a new game/campaign is started
   */
  onCampaignStart(): void {
    this.progress.gameStartTime = Date.now();
    this.progress.levelDamageTaken = {};
    this.saveToStorage();
  }

  /**
   * Called when an enemy is killed
   * @param healthPercent Optional player health percentage for last stand achievement
   */
  onKill(healthPercent?: number): void {
    const wasFirstKill = (this.progress.totalKills ?? 0) === 0;

    this.progress.totalKills = (this.progress.totalKills ?? 0) + 1;
    this.progress.levelKills = (this.progress.levelKills ?? 0) + 1;

    // Track kill timestamp for multi-kill detection
    this.trackKillTimestamp();

    this.saveToStorage();

    // Check for first blood achievement
    if (wasFirstKill) {
      this.unlock('first_blood');
    }

    // Check for exterminator achievement (100 kills)
    if (this.progress.totalKills >= 100) {
      this.unlock('exterminator');
    }

    // Check for mass extinction achievement (500 kills)
    if (this.progress.totalKills >= 500) {
      this.unlock('mass_extinction');
    }

    // Check for last stand achievement (kill while below 10% health)
    if (healthPercent !== undefined && healthPercent < 10) {
      this.unlock('last_stand');
    }
  }

  /**
   * Called when the first surface combat encounter is won (Landfall level)
   */
  onFirstCombatWin(): void {
    this.unlock('baptism_by_fire');
  }

  /**
   * Called when Brothers in Arms level is completed
   * @param marcusWentDown Whether Marcus went down during the level
   */
  onBrothersInArmsComplete(marcusWentDown: boolean): void {
    if (!marcusWentDown) {
      this.unlock('brothers_keeper');
    }
  }

  /**
   * Called when Canyon Run is completed
   */
  onCanyonRunComplete(): void {
    this.unlock('road_warrior');
  }

  /**
   * Called when Southern Ice is completed
   */
  onSouthernIceComplete(): void {
    this.unlock('ice_breaker');
  }

  /**
   * Called when Hive Assault is completed
   */
  onHiveAssaultComplete(): void {
    this.unlock('total_war');
  }

  /**
   * Called when Extraction is completed
   */
  onExtractionComplete(): void {
    this.unlock('extracted');
  }

  /**
   * Called when Final Escape is completed without crashing
   * @param crashed Whether the vehicle crashed during the escape
   */
  onFinalEscapeComplete(crashed: boolean): void {
    if (!crashed) {
      this.unlock('flawless_run');
    }
  }

  /**
   * Called when Marcus goes down in Brothers in Arms
   */
  onMarcusDown(): void {
    this.progress.marcusDownCount = (this.progress.marcusDownCount ?? 0) + 1;
    this.saveToStorage();
  }

  /**
   * Reset Marcus down tracking (called at level start)
   */
  resetMarcusTracking(): void {
    this.progress.marcusDownCount = 0;
    this.saveToStorage();
  }

  /**
   * Called when a secret area is discovered
   */
  onSecretFound(): void {
    this.progress.secretsFound = (this.progress.secretsFound ?? 0) + 1;
    this.saveToStorage();

    // Check for curious achievement (first secret)
    if (this.progress.secretsFound === 1) {
      this.unlock('curious');
    }

    // Check for secret hunter achievement (10 secrets)
    if (this.progress.secretsFound >= 10) {
      this.unlock('secret_hunter');
    }
  }

  /**
   * Called when an audio log is found
   */
  onAudioLogFound(): void {
    this.progress.audioLogsFound = (this.progress.audioLogsFound ?? 0) + 1;
    this.saveToStorage();

    // Check for log collector achievement (all 18 logs)
    if (this.progress.audioLogsFound >= 18) {
      this.unlock('log_collector');
    }
  }

  /**
   * Called when all areas in a level are discovered
   */
  onAllAreasDiscovered(): void {
    this.unlock('explorer');
  }

  /**
   * Called when all collectibles in a level are found
   */
  onAllCollectiblesFound(): void {
    this.unlock('thorough');
  }

  /**
   * Called when all rooms in FOB Delta are visited
   */
  onFobDeltaFullyExplored(): void {
    this.unlock('cartographer');
  }

  /**
   * Called when a multi-kill occurs (multiple enemies killed rapidly)
   * @param killCount Number of enemies killed in the burst
   */
  onMultiKill(killCount: number): void {
    if (killCount >= 5) {
      this.unlock('multi_kill');
    }
  }

  /**
   * Called when enemies are killed by an explosion
   * @param killCount Number of enemies killed by the explosion
   */
  onExplosionKill(killCount: number): void {
    if (killCount >= 3) {
      this.unlock('grenadier');
    }
  }

  /**
   * Called when player kills an enemy while at low health
   * @param healthPercent Player's health percentage (0-100)
   */
  onKillAtLowHealth(healthPercent: number): void {
    if (healthPercent < 10) {
      this.unlock('last_stand');
    }
  }

  /**
   * Track kill timestamp for multi-kill detection
   */
  private trackKillTimestamp(): void {
    const now = Date.now();
    const threeSecondsAgo = now - 3000;

    // Initialize if needed
    if (!this.progress.recentKillTimestamps) {
      this.progress.recentKillTimestamps = [];
    }

    // Add current kill
    this.progress.recentKillTimestamps.push(now);

    // Remove old kills (older than 3 seconds)
    this.progress.recentKillTimestamps = this.progress.recentKillTimestamps.filter(
      (t) => t > threeSecondsAgo
    );

    // Check for multi-kill (5 kills in 3 seconds)
    if (this.progress.recentKillTimestamps.length >= 5) {
      this.unlock('multi_kill');
    }

    this.saveToStorage();
  }

  /**
   * Called when a shot is fired
   */
  onShotFired(): void {
    this.progress.shotsFired = (this.progress.shotsFired ?? 0) + 1;
    this.progress.levelShotsFired = (this.progress.levelShotsFired ?? 0) + 1;
    this.saveToStorage();
  }

  /**
   * Called when a shot hits an enemy
   */
  onShotHit(): void {
    this.progress.shotsHit = (this.progress.shotsHit ?? 0) + 1;
    this.progress.levelShotsHit = (this.progress.levelShotsHit ?? 0) + 1;
    this.saveToStorage();
  }

  /**
   * Get current accuracy for the level (as a percentage)
   */
  getLevelAccuracy(): number {
    const shots = this.progress.levelShotsFired ?? 0;
    const hits = this.progress.levelShotsHit ?? 0;
    if (shots === 0) return 0;
    return Math.round((hits / shots) * 100);
  }

  /**
   * Get overall accuracy (as a percentage)
   */
  getOverallAccuracy(): number {
    const shots = this.progress.shotsFired ?? 0;
    const hits = this.progress.shotsHit ?? 0;
    if (shots === 0) return 0;
    return Math.round((hits / shots) * 100);
  }

  // ============================================================================
  // DEBUG/ADMIN
  // ============================================================================

  /**
   * Reset all achievements (for testing)
   */
  resetAll(): void {
    this.state = this.createDefaultState();
    this.progress = this.createDefaultProgress();
    this.saveToStorage();
    console.log('[AchievementManager] All achievements reset');
  }

  /**
   * Unlock all achievements (for testing)
   */
  unlockAll(): void {
    for (const id of Object.keys(ACHIEVEMENTS) as AchievementId[]) {
      if (!this.isUnlocked(id)) {
        this.state[id] = { unlockedAt: Date.now() };
        console.log(`[AchievementManager] Unlocked: ${ACHIEVEMENTS[id].name}`);
      }
    }
    this.saveToStorage();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let achievementManagerInstance: AchievementManagerImpl | null = null;

/**
 * Get the singleton AchievementManager instance
 */
export function getAchievementManager(): AchievementManagerImpl {
  if (!achievementManagerInstance) {
    achievementManagerInstance = new AchievementManagerImpl();
  }
  return achievementManagerInstance;
}

/**
 * Initialize the achievement system
 * Should be called once at app startup
 */
export function initAchievements(): void {
  getAchievementManager().init();
}

// Re-export the class type for testing
export type AchievementManager = AchievementManagerImpl;
