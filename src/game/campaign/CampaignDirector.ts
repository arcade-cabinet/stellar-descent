/**
 * CampaignDirector - The game's spine
 *
 * A state machine that replaces 15+ scattered App.tsx callbacks with
 * a single dispatch(command) API. Manages campaign phase transitions,
 * owns LevelManager, wires achievements/dialogue/collectibles.
 *
 * State is now backed by useCampaignStore (Zustand) for persistence
 * and React integration. This class remains the facade for complex
 * state transitions and external system integration.
 *
 * React integration: subscribe() / getSnapshot() for useSyncExternalStore
 */

import { getAchievementManager } from '../achievements';
import {
  type DialogueTrigger,
  disposeReyesDialogueManager,
  getReyesDialogueManager,
} from '../audio/ReyesDialogue';
import { getLogger } from '../core/Logger';
import { CAMPAIGN_LEVELS, type LevelId } from '../levels/types';
import { saveSystem } from '../persistence';
import { useCampaignStore } from '../stores/useCampaignStore';
import { disposeGameTimer, getGameTimer } from '../timer';
import { hasLevelCinematic } from '../utils/cinematics';
import { BONUS_LEVELS } from './MissionDefinitions';
import {
  getQuestStateForSave,
  initializeQuestManager,
  loadQuestState,
  onEnemyKilled,
  onLevelEnter,
  onLevelExit,
  onPlayerDeath,
  type QuestState,
  resetQuestManager,
} from './QuestManager';
import type { CampaignCommand, CampaignPhase, CampaignSnapshot, LevelStats } from './types';

const log = getLogger('CampaignDirector');

// ============================================================================
// Snapshot builder (reads from store + local state)
// ============================================================================

// Type for level config from registry
type LevelConfigType = (typeof CAMPAIGN_LEVELS)[LevelId] | null;

function buildSnapshot(
  store: ReturnType<typeof useCampaignStore.getState>,
  localState: {
    currentLevelConfig: LevelConfigType;
    prePausePhase: CampaignPhase | null;
    restartCounter: number;
    isBonusLevel: boolean;
  }
): CampaignSnapshot {
  return {
    phase: store.phase,
    currentLevelId: store.currentLevel ?? 'anchor_station',
    currentLevelConfig: localState.currentLevelConfig,
    isBonusLevel: localState.isBonusLevel,
    levelKills: store.levelKills,
    levelStartTime: store.levelStartTime,
    completionStats: store.completionStats,
    needsIntroBriefing: store.needsIntroBriefing,
    prePausePhase: localState.prePausePhase,
    restartCounter: localState.restartCounter,
    deathCount: store.totalDeaths,
    totalCampaignKills: store.totalCampaignKills,
    currentDifficulty: store.difficulty,
    diedInCurrentLevel: store.diedInCurrentLevel,
    levelDamageReceived: store.levelDamageReceived,
  };
}

// ============================================================================
// CampaignDirector
// ============================================================================

export class CampaignDirector {
  // Local state not in store (runtime-only)
  private currentLevelConfig: LevelConfigType = null;
  private prePausePhase: CampaignPhase | null = null;
  private restartCounter = 0;
  private isBonusLevel = false;

  private listeners: Set<() => void> = new Set();
  private bonusReturnLevelId: LevelId | null = null;
  private skipTutorial = false;
  private lastHealthBracket: 'healthy' | 'low' | 'critical' = 'healthy';
  private questManagerInitialized = false;
  private storeUnsubscribe: (() => void) | null = null;

  // Cached snapshot for useSyncExternalStore (must return same reference when unchanged)
  private cachedSnapshot: CampaignSnapshot | null = null;
  private lastStoreState: ReturnType<typeof useCampaignStore.getState> | null = null;

  // Callbacks for external systems (MissionContext, HUD, etc.)
  private objectiveUpdateCallback?: (title: string, instructions: string) => void;
  private objectiveMarkerCallback?: (
    position: { x: number; y: number; z: number } | null,
    label?: string
  ) => void;
  private notificationCallback?: (text: string, duration?: number) => void;

  constructor() {
    // Subscribe to store changes to notify our listeners
    this.storeUnsubscribe = useCampaignStore.subscribe(() => {
      this.notify();
    });
  }

  // -----------------------------------------------------------------------
  // React integration (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CampaignSnapshot => {
    const store = useCampaignStore.getState();

    // useSyncExternalStore requires getSnapshot to return the same reference
    // when the data hasn't changed. Cache and only rebuild when necessary.
    if (this.cachedSnapshot !== null && this.lastStoreState === store) {
      return this.cachedSnapshot;
    }

    this.lastStoreState = store;
    this.cachedSnapshot = buildSnapshot(store, {
      currentLevelConfig: this.currentLevelConfig,
      prePausePhase: this.prePausePhase,
      restartCounter: this.restartCounter,
      isBonusLevel: this.isBonusLevel,
    });

    return this.cachedSnapshot;
  };

  private notify(): void {
    // Invalidate cached snapshot when state changes
    this.cachedSnapshot = null;
    this.lastStoreState = null;

    for (const listener of this.listeners) {
      listener();
    }
  }

  // -----------------------------------------------------------------------
  // Store accessors
  // -----------------------------------------------------------------------

  private get store() {
    return useCampaignStore.getState();
  }

  // -----------------------------------------------------------------------
  // The ONLY public mutation API
  // -----------------------------------------------------------------------

  dispatch(command: CampaignCommand): void {
    const prev = this.store.phase;

    switch (command.type) {
      case 'NEW_GAME':
        this.handleNewGame(command.difficulty, command.startLevel);
        break;

      case 'CONTINUE':
        this.handleContinue();
        break;

      case 'SELECT_LEVEL':
        this.handleSelectLevel(command.levelId);
        break;

      case 'SPLASH_COMPLETE':
        // Skip title sequence - go straight to menu
        this.setPhase('menu');
        break;

      case 'TITLE_COMPLETE':
        // Legacy - title sequence no longer used
        this.setPhase('menu');
        break;

      case 'BEGIN_MISSION':
        this.setPhase('intro');
        break;

      case 'CINEMATIC_COMPLETE':
        // Cinematic finished or skipped - proceed to briefing
        this.setPhase('briefing');
        break;

      case 'INTRO_COMPLETE':
        this.setPhase('loading');
        break;

      case 'INTRO_BRIEFING_COMPLETE':
        this.store.setNeedsIntroBriefing(false);
        saveSystem.setSeenIntroBriefing();
        this.setPhase('briefing');
        break;

      case 'LOADING_COMPLETE':
        this.handleLoadingComplete();
        break;

      case 'TUTORIAL_COMPLETE':
        // Tutorial (anchor_station) done → transition to dropping (HALO drop)
        this.setPhase('dropping');
        break;

      case 'DROP_COMPLETE':
        // HALO drop finished → surface gameplay
        this.store.startLevelSession();
        this.setPhase('playing');
        break;

      case 'LEVEL_COMPLETE':
        this.handleLevelComplete(command.stats);
        break;

      case 'ADVANCE':
        this.handleAdvance();
        break;

      case 'RETRY':
        this.handleRetry();
        break;

      case 'PAUSE':
        if (prev === 'playing' || prev === 'tutorial' || prev === 'dropping') {
          this.prePausePhase = prev;
          getGameTimer().pause();
          this.setPhase('paused');
        }
        break;

      case 'RESUME':
        if (prev === 'paused' && this.prePausePhase) {
          const resume = this.prePausePhase;
          this.prePausePhase = null;
          getGameTimer().resume();
          this.setPhase(resume);
        }
        break;

      case 'PLAYER_DIED':
        getReyesDialogueManager().triggerDialogue('mission_failed');
        getGameTimer().pause();
        // Track death in store
        this.store.recordDeath();
        // Notify quest system of player death (may fail some quests)
        onPlayerDeath();
        this.setPhase('gameover');
        break;

      case 'MAIN_MENU':
        this.handleMainMenu();
        break;

      case 'CREDITS_DONE':
        this.handleMainMenu();
        break;

      case 'ENTER_BONUS_LEVEL':
        this.handleEnterBonusLevel(command.levelId);
        break;

      case 'BONUS_COMPLETE':
        this.handleBonusComplete();
        break;

      case 'DEV_JUMP_TO_LEVEL':
        this.handleDevJumpToLevel(command.levelId);
        break;

      default:
        log.warn(`Unknown command: ${(command as CampaignCommand).type}`);
    }
  }

  // -----------------------------------------------------------------------
  // Convenience accessors
  // -----------------------------------------------------------------------

  get phase(): CampaignPhase {
    return this.store.phase;
  }

  get currentLevelId(): LevelId {
    return this.store.currentLevel ?? 'anchor_station';
  }

  get shouldSkipTutorial(): boolean {
    return this.skipTutorial;
  }

  /**
   * Get current difficulty for game systems
   */
  get difficulty(): string {
    return this.store.difficulty;
  }

  /**
   * Get total deaths in campaign
   */
  get deathCount(): number {
    return this.store.totalDeaths;
  }

  /**
   * Get total campaign kills
   */
  get totalKills(): number {
    return this.store.totalCampaignKills;
  }

  // -----------------------------------------------------------------------
  // Quest Manager Integration
  // -----------------------------------------------------------------------

  /**
   * Initialize QuestManager with callbacks for UI integration.
   * Should be called once when the game starts, after MissionContext is available.
   */
  initializeQuestSystem(callbacks: {
    onObjectiveUpdate?: (title: string, instructions: string) => void;
    onObjectiveMarker?: (
      position: { x: number; y: number; z: number } | null,
      label?: string
    ) => void;
    onNotification?: (text: string, duration?: number) => void;
  }): void {
    if (this.questManagerInitialized) {
      log.debug('Quest manager already initialized');
      return;
    }

    this.objectiveUpdateCallback = callbacks.onObjectiveUpdate;
    this.objectiveMarkerCallback = callbacks.onObjectiveMarker;
    this.notificationCallback = callbacks.onNotification;

    initializeQuestManager({
      onObjectiveUpdate: (title, instructions) => {
        this.objectiveUpdateCallback?.(title, instructions);
      },
      onObjectiveMarker: (position, label) => {
        this.objectiveMarkerCallback?.(position, label);
      },
      onDialogueTrigger: (trigger) => {
        // Wire to ReyesDialogue system
        this.triggerDialogue(trigger as DialogueTrigger);
      },
      onNotification: (text, duration) => {
        this.notificationCallback?.(text, duration);
      },
      onQuestStateChange: (questId, state) => {
        // Persist quest state to save system
        this.persistQuestState(questId, state);
      },
    });

    this.questManagerInitialized = true;
    log.info('Quest system initialized');
  }

  /**
   * Load quest state from save system.
   * Called when loading a saved game.
   */
  private loadQuestStateFromSave(): void {
    const completedQuests = saveSystem.getCompletedQuests();
    const activeQuests = saveSystem.getActiveQuests();
    const failedQuests = saveSystem.getFailedQuests();

    loadQuestState(completedQuests, activeQuests, failedQuests);
    log.debug(
      `Loaded quest state: ${completedQuests.length} completed, ${Object.keys(activeQuests).length} active`
    );
  }

  /**
   * Persist quest state changes to save system.
   */
  private persistQuestState(questId: string, state: QuestState): void {
    if (state.status === 'completed') {
      saveSystem.completeQuest(questId);
    } else if (state.status === 'failed') {
      saveSystem.failQuest(questId);
    } else if (state.status === 'active') {
      saveSystem.setActiveQuestState(questId, state);
    }
  }

  /**
   * Save all quest state to save system.
   * Called before auto-save or manual save.
   */
  saveQuestState(): void {
    const questState = getQuestStateForSave();

    // Update save system with current quest state
    for (const questId of questState.completedQuests) {
      if (!saveSystem.isQuestCompleted(questId)) {
        saveSystem.completeQuest(questId);
      }
    }

    for (const [questId, state] of Object.entries(questState.activeQuestStates)) {
      saveSystem.setActiveQuestState(questId, state);
    }

    for (const questId of questState.failedQuests) {
      saveSystem.failQuest(questId);
    }
  }

  /**
   * Trigger quest level enter.
   * Called when a level finishes loading.
   */
  private triggerQuestLevelEnter(levelId: LevelId): void {
    const save = saveSystem.getCurrentSave();
    const completedLevels = save?.levelsCompleted ?? [];
    const inventory = save?.inventory ?? {};

    onLevelEnter(levelId, completedLevels, inventory);
    log.debug(`Quest level enter: ${levelId}`);
  }

  /**
   * Trigger quest level exit.
   * Called when leaving a level.
   */
  private triggerQuestLevelExit(levelId: LevelId): void {
    onLevelExit(levelId);
    log.debug(`Quest level exit: ${levelId}`);
  }

  // -----------------------------------------------------------------------
  // Command handlers
  // -----------------------------------------------------------------------

  private setPhase(phase: CampaignPhase): void {
    this.store.setPhase(phase);
  }

  private setLevelId(levelId: LevelId): void {
    this.store.setCurrentLevel(levelId);
    this.currentLevelConfig = CAMPAIGN_LEVELS[levelId] ?? null;
  }

  private handleNewGame(difficulty?: string, startLevel?: LevelId): void {
    const diff = (difficulty as any) ?? 'normal';
    const levelId = startLevel ?? 'anchor_station';
    saveSystem.newGame(diff, levelId).then(() => {
      this.skipTutorial = levelId !== 'anchor_station';
      this.setLevelId(levelId);
      this.store.setCompletionStats(null);
      this.isBonusLevel = false;

      // Initialize store for new game
      this.store.newGame(diff, levelId);

      // Reset quest manager for new game
      resetQuestManager();

      // Play cinematic if available, otherwise go straight to briefing
      if (hasLevelCinematic(levelId)) {
        this.setPhase('cinematic');
      } else {
        this.setPhase('briefing');
      }
    });
  }

  private handleContinue(): void {
    saveSystem.loadGame().then((save) => {
      if (!save) {
        log.warn('No save found, starting new game');
        this.handleNewGame();
        return;
      }
      this.setLevelId(save.currentLevel);
      // Check if anchor_station is completed - no separate flag needed
      this.skipTutorial = save.levelsCompleted?.includes('anchor_station') ?? false;
      this.store.setCompletionStats(null);
      this.isBonusLevel = false;
      // Restore difficulty from save
      this.store.setDifficulty(save.difficulty ?? 'normal');

      // Load quest state from save
      this.loadQuestStateFromSave();

      // Play cinematic if available, otherwise go straight to briefing
      if (hasLevelCinematic(save.currentLevel)) {
        this.setPhase('cinematic');
      } else {
        this.setPhase('briefing');
      }
    });
  }

  private handleSelectLevel(levelId: LevelId): void {
    this.setLevelId(levelId);
    this.skipTutorial = levelId !== 'anchor_station';
    this.store.setCompletionStats(null);
    this.isBonusLevel = false;
    // Play cinematic if available, otherwise go to briefing
    if (hasLevelCinematic(levelId)) {
      this.setPhase('cinematic');
    } else {
      this.setPhase('briefing');
    }
  }

  private handleLoadingComplete(): void {
    const levelId = this.store.currentLevel ?? 'anchor_station';
    this.lastHealthBracket = 'healthy';

    // Start level session in store
    this.store.startLevelSession();

    // Initialize achievement level tracking
    getAchievementManager().onLevelStart(levelId);

    // Start the mission timer
    getGameTimer().startMission(levelId);

    // Play Reyes briefing for this level
    const reyes = getReyesDialogueManager();
    reyes.playBriefing(levelId);

    // Update save system with current level
    saveSystem.setCurrentLevel(levelId);

    // Trigger quest system level enter
    this.triggerQuestLevelEnter(levelId);

    // Route to the correct phase based on level type
    if (levelId === 'anchor_station') {
      this.setPhase('tutorial');
    } else if (levelId === 'landfall') {
      this.setPhase('dropping');
    } else {
      this.setPhase('playing');
    }
  }

  private handleLevelComplete(stats: LevelStats): void {
    // Stop the mission timer and record the time
    const timer = getGameTimer();
    const finalTime = timer.stopMission();

    // Check and save best time (both in timer system and save system)
    const levelId = this.store.currentLevel ?? 'anchor_station';
    const isNewBest = timer.checkAndSaveBestTime(levelId, finalTime);
    saveSystem.recordLevelTime(levelId, finalTime);

    // Trigger quest level exit before saving
    this.triggerQuestLevelExit(levelId);

    // Save quest state before level completion
    this.saveQuestState();

    // Get achievement stats to include in completion stats
    const _achievementStats = getAchievementManager().getLevelStats();

    // Calculate accuracy properly
    const accuracy = stats.shotsFired > 0 ? (stats.shotsHit / stats.shotsFired) * 100 : 0;

    // Update stats with the accurate timer value and additional tracking
    const completionStats: LevelStats = {
      ...stats,
      timeElapsed: finalTime,
      audioLogsFound: stats.audioLogsFound ?? 0,
      totalAudioLogs: stats.totalAudioLogs ?? 0,
      damageReceived: this.store.levelDamageReceived,
      accuracy: Math.round(accuracy),
    };

    // Complete level in store (updates progress, stats, etc.)
    this.store.completeLevel(levelId, completionStats);

    // Add kills to save system
    for (let i = 0; i < this.store.levelKills; i++) {
      saveSystem.addKill();
    }

    saveSystem.completeLevel(levelId);

    // Pass death flag and difficulty to achievement system
    const difficulty = this.store.difficulty;
    getAchievementManager().onLevelComplete(levelId, this.store.diedInCurrentLevel, difficulty);

    // Trigger per-level achievements
    this.triggerLevelAchievements(levelId);

    // Log if new best time
    if (isNewBest) {
      log.info(`New best time for ${levelId}: ${finalTime.toFixed(2)}s`);
    }

    this.setPhase('levelComplete');
  }

  private handleAdvance(): void {
    const levelId = this.store.currentLevel ?? 'anchor_station';
    const levelConfig = CAMPAIGN_LEVELS[levelId];
    const nextId = levelConfig?.nextLevelId;

    if (nextId) {
      this.setLevelId(nextId);
      this.store.setCompletionStats(null);
      this.store.startLevelSession();
      // Update chapter in save system
      const nextConfig = CAMPAIGN_LEVELS[nextId];
      if (nextConfig) {
        saveSystem.setChapter(nextConfig.chapter);
      }
      // Play cinematic if available, otherwise go to briefing
      if (hasLevelCinematic(nextId)) {
        this.setPhase('cinematic');
      } else {
        this.setPhase('briefing');
      }
    } else {
      // Final level complete - show credits
      // Save final stats before credits
      saveSystem.autoSave();
      this.setPhase('credits');
    }
  }

  private handleRetry(): void {
    this.store.setCompletionStats(null);
    this.store.startLevelSession();
    this.restartCounter++;
    getGameTimer().resetMission();
    this.setPhase('loading');
  }

  private handleMainMenu(): void {
    // Trigger level exit before going to menu
    const levelId = this.store.currentLevel ?? 'anchor_station';
    this.triggerQuestLevelExit(levelId);
    // Save quest state
    this.saveQuestState();

    this.store.setCompletionStats(null);
    this.prePausePhase = null;
    this.restartCounter++;
    this.setLevelId('anchor_station');
    this.skipTutorial = false;
    getGameTimer().resetMission();
    disposeReyesDialogueManager();
    this.setPhase('menu');
  }

  private handleDevJumpToLevel(levelId: LevelId): void {
    this.setLevelId(levelId);
    this.skipTutorial = true;
    this.store.setCompletionStats(null);
    this.isBonusLevel = false;
    this.restartCounter++;
    // Skip briefing/intro entirely — go straight to loading
    this.setPhase('loading');
  }

  private handleEnterBonusLevel(levelId: string): void {
    const bonus = BONUS_LEVELS[levelId];
    if (!bonus) {
      log.warn(`Unknown bonus level: ${levelId}`);
      return;
    }
    // Store current level as return point before entering bonus
    this.bonusReturnLevelId = this.store.currentLevel ?? 'anchor_station';
    this.isBonusLevel = true;
    this.store.enterBonusLevel();
    // Reset level tracking for bonus level
    this.store.startLevelSession();
    // Transition directly to loading for the bonus level
    this.setPhase('loading');
  }

  private handleBonusComplete(): void {
    this.isBonusLevel = false;
    this.store.exitBonusLevel();

    if (this.bonusReturnLevelId) {
      // Save bonus level completion in save system
      saveSystem.setLevelFlag(this.bonusReturnLevelId, 'bonus_completed', true);
      this.setLevelId(this.bonusReturnLevelId);
      this.bonusReturnLevelId = null;
      // Reset level state for return
      this.store.startLevelSession();
      this.setPhase('loading');
    } else {
      this.setPhase('menu');
    }
  }

  // -----------------------------------------------------------------------
  // Achievement wiring
  // -----------------------------------------------------------------------

  private triggerLevelAchievements(levelId: LevelId): void {
    const am = getAchievementManager();
    switch (levelId) {
      case 'anchor_station':
        am.onTutorialComplete();
        break;
      case 'landfall':
        am.onHaloDropComplete();
        am.onFirstCombatWin();
        break;
      case 'canyon_run':
        am.onCanyonRunComplete();
        break;
      case 'fob_delta':
        // FOB Delta achievements handled by onLevelComplete with diedInCurrentLevel flag
        break;
      case 'brothers_in_arms': {
        am.onMarcusFound();
        const marcusWentDown = am.getProgress().marcusWentDown;
        am.onBrothersInArmsComplete(marcusWentDown);
        am.resetMarcusTracking();
        break;
      }
      case 'southern_ice':
        am.onSouthernIceComplete();
        break;
      case 'the_breach':
        am.onQueenDefeated();
        break;
      case 'hive_assault':
        am.onHiveAssaultComplete();
        break;
      case 'extraction':
        am.onExtractionComplete();
        break;
      case 'final_escape':
        am.onFinalEscapeComplete(false); // TODO: Get actual crash state from level
        am.onGameComplete();
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Dialogue integration (wires LevelCallbacks → ReyesDialogue)
  // -----------------------------------------------------------------------

  /**
   * Called by LevelCallbacks.onHealthChange to trigger health warnings.
   * Tracks health bracket to avoid spamming dialogue triggers.
   */
  onHealthChange(health: number): void {
    const phase = this.store.phase;
    if (phase !== 'playing' && phase !== 'tutorial' && phase !== 'dropping') return;

    const reyes = getReyesDialogueManager();
    if (health <= 15 && this.lastHealthBracket !== 'critical') {
      this.lastHealthBracket = 'critical';
      reyes.triggerDialogue('player_critical_warning');
    } else if (health <= 35 && health > 15 && this.lastHealthBracket === 'healthy') {
      this.lastHealthBracket = 'low';
      reyes.triggerDialogue('player_low_health_warning');
    } else if (health > 50) {
      this.lastHealthBracket = 'healthy';
    }
  }

  /**
   * Called by LevelCallbacks.onCombatStateChange to trigger hostiles dialogue.
   */
  onCombatStateChange(inCombat: boolean): void {
    const phase = this.store.phase;
    if (phase !== 'playing' && phase !== 'tutorial' && phase !== 'dropping') return;

    const reyes = getReyesDialogueManager();
    if (inCombat) {
      reyes.triggerDialogue('hostiles_detected');
    } else {
      reyes.triggerDialogue('hostiles_cleared');
    }
  }

  /**
   * Called by levels for specific dialogue triggers (e.g. queen_detected).
   */
  triggerDialogue(trigger: DialogueTrigger): void {
    const phase = this.store.phase;
    const validPhases: CampaignPhase[] = ['playing', 'tutorial', 'dropping'];
    if (!validPhases.includes(phase)) return;
    getReyesDialogueManager().triggerDialogue(trigger);
  }

  /**
   * Called by LevelCallbacks.onKill to track kill count and trigger kill achievements.
   */
  onKill(playerHealthPercent?: number, enemyType?: string): void {
    this.store.recordKill();
    getAchievementManager().onKill(playerHealthPercent);

    // Notify quest system of enemy killed
    onEnemyKilled(enemyType);
  }

  /**
   * Called by LevelCallbacks.onDamage to track damage for achievements.
   */
  onDamage(amount: number = 1): void {
    const am = getAchievementManager();
    const levelId = this.store.currentLevel ?? 'anchor_station';
    am.onDamageTaken(levelId, amount);
    // Track damage in store for level stats
    this.store.recordDamage(amount);
  }

  // -----------------------------------------------------------------------
  // Collectible wiring
  // -----------------------------------------------------------------------

  /**
   * Called when a level reports an audio log was found.
   */
  onAudioLogFound(logId: string): void {
    getAchievementManager().onAudioLogFound();
    const levelId = this.store.currentLevel ?? 'anchor_station';
    saveSystem.setLevelFlag(levelId, `audiolog_${logId}`, true);
    this.store.recordAudioLog();
  }

  /**
   * Get audio logs found in current level
   */
  getAudioLogsFoundInLevel(): number {
    return this.store.audioLogsFoundInLevel;
  }

  /**
   * Called when a level reports a secret area was discovered.
   */
  onSecretFound(secretId: string): void {
    getAchievementManager().onSecretFound();
    const levelId = this.store.currentLevel ?? 'anchor_station';
    saveSystem.setLevelFlag(levelId, `secret_${secretId}`, true);
  }

  /**
   * Called when a level reports a skull was found.
   */
  onSkullFound(skullId: string): void {
    const levelId = this.store.currentLevel ?? 'anchor_station';
    saveSystem.setLevelFlag(levelId, `skull_${skullId}`, true);
    // Track skull in inventory for display
    saveSystem.setInventoryItem(`skull_${skullId}`, 1);
  }

  /**
   * Get current level's collectible counts for UI
   */
  getCurrentLevelCollectibles(): { secrets: number; audioLogs: number; hasSkull: boolean } {
    const config = this.currentLevelConfig;
    const { getMissionDefinition } = require('./MissionDefinitions');
    const levelId = this.store.currentLevel ?? 'anchor_station';
    const mission = getMissionDefinition(levelId);

    return {
      secrets: config?.totalSecrets ?? mission?.secretCount ?? 0,
      audioLogs: config?.totalAudioLogs ?? mission?.audioLogCount ?? 0,
      hasSkull: !!mission?.skullId,
    };
  }

  /**
   * Check if a collectible has been found in current level
   */
  isCollectibleFound(type: 'secret' | 'audiolog' | 'skull', id: string): boolean {
    const prefix = type === 'audiolog' ? 'audiolog' : type;
    const levelId = this.store.currentLevel ?? 'anchor_station';
    return saveSystem.getLevelFlag(levelId, `${prefix}_${id}`);
  }

  /**
   * Called by LevelCallbacks.onObjectiveUpdate to track objectives in save data.
   */
  onObjectiveComplete(objectiveId: string): void {
    saveSystem.setObjective(objectiveId, true);
  }

  // -----------------------------------------------------------------------
  // Level unlock queries (delegated to store)
  // -----------------------------------------------------------------------

  /**
   * Check if a level is unlocked
   */
  isLevelUnlocked(levelId: LevelId): boolean {
    return this.store.isLevelUnlocked(levelId);
  }

  /**
   * Get progress for a level
   */
  getLevelProgress(levelId: LevelId) {
    return this.store.getLevelProgress(levelId);
  }

  /**
   * Get the next level in the campaign
   */
  getNextLevel(): LevelId | null {
    return this.store.getNextLevel();
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose(): void {
    this.listeners.clear();
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    disposeReyesDialogueManager();
    disposeGameTimer();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let directorInstance: CampaignDirector | null = null;

export function getCampaignDirector(): CampaignDirector {
  if (!directorInstance) {
    directorInstance = new CampaignDirector();
  }
  return directorInstance;
}

export function disposeCampaignDirector(): void {
  if (directorInstance) {
    directorInstance.dispose();
    directorInstance = null;
  }
}
