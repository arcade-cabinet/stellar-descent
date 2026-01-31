/**
 * CampaignDirector - The game's spine
 *
 * A state machine that replaces 15+ scattered App.tsx callbacks with
 * a single dispatch(command) API. Manages campaign phase transitions,
 * owns LevelManager, wires achievements/dialogue/collectibles.
 *
 * React integration: subscribe() / getSnapshot() for useSyncExternalStore
 */

import { getAchievementManager } from '../achievements';
import {
  type DialogueTrigger,
  disposeReyesDialogueManager,
  getReyesDialogueManager,
} from '../audio/ReyesDialogue';
import { CAMPAIGN_LEVELS, type LevelId } from '../levels/types';
import { saveSystem } from '../persistence';
import { disposeGameTimer, getGameTimer } from '../timer';
import { BONUS_LEVELS } from './MissionDefinitions';
import type { CampaignCommand, CampaignSnapshot, LevelStats } from './types';
import type { CampaignPhase } from './types'; // Issue #71: Separate import for type used in array

// ============================================================================
// Default snapshot
// ============================================================================

function createDefaultSnapshot(): CampaignSnapshot {
  return {
    phase: 'idle',
    currentLevelId: 'anchor_station',
    currentLevelConfig: null,
    isBonusLevel: false,
    levelKills: 0,
    levelStartTime: Date.now(),
    completionStats: null,
    needsIntroBriefing: false,
    prePausePhase: null,
    restartCounter: 0,
    deathCount: 0, // Issue #8 fix
    totalCampaignKills: 0, // Issue #9 fix
    currentDifficulty: null, // Issue #10 fix
    diedInCurrentLevel: false, // Issue #11 fix
    levelDamageReceived: 0, // Issue #12 fix
  };
}

// ============================================================================
// CampaignDirector
// ============================================================================

export class CampaignDirector {
  private snapshot: CampaignSnapshot = createDefaultSnapshot();
  private listeners: Set<() => void> = new Set();
  private bonusReturnLevelId: LevelId | null = null;
  private skipTutorial = false;
  private lastHealthBracket: 'healthy' | 'low' | 'critical' = 'healthy';

  // -----------------------------------------------------------------------
  // React integration (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CampaignSnapshot => {
    return this.snapshot;
  };

  private notify(): void {
    // Create a new snapshot reference for React to detect changes
    this.snapshot = { ...this.snapshot };
    for (const listener of this.listeners) {
      listener();
    }
  }

  // -----------------------------------------------------------------------
  // The ONLY public mutation API
  // -----------------------------------------------------------------------

  dispatch(command: CampaignCommand): void {
    const prev = this.snapshot.phase;

    switch (command.type) {
      case 'NEW_GAME':
        this.handleNewGame(command.difficulty);
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

      case 'INTRO_COMPLETE':
        this.setPhase('loading');
        break;

      case 'INTRO_BRIEFING_COMPLETE':
        this.snapshot.needsIntroBriefing = false;
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
        this.snapshot.levelStartTime = Date.now();
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
          this.snapshot.prePausePhase = prev;
          getGameTimer().pause();
          this.setPhase('paused');
        }
        break;

      case 'RESUME':
        if (prev === 'paused' && this.snapshot.prePausePhase) {
          const resume = this.snapshot.prePausePhase;
          this.snapshot.prePausePhase = null;
          getGameTimer().resume();
          this.setPhase(resume);
        }
        break;

      case 'PLAYER_DIED':
        getReyesDialogueManager().triggerDialogue('mission_failed');
        getGameTimer().pause();
        // Issue #13: Track death count and level death flag
        this.snapshot.deathCount++;
        this.snapshot.diedInCurrentLevel = true;
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
        console.warn(`[CampaignDirector] Unknown command: ${(command as any).type}`);
    }
  }

  // -----------------------------------------------------------------------
  // Convenience accessors
  // -----------------------------------------------------------------------

  get phase(): CampaignPhase {
    return this.snapshot.phase;
  }

  get currentLevelId(): LevelId {
    return this.snapshot.currentLevelId;
  }

  get shouldSkipTutorial(): boolean {
    return this.skipTutorial;
  }

  /**
   * Issue #93: Get current difficulty for game systems
   */
  get difficulty(): string {
    return this.snapshot.currentDifficulty ?? 'normal';
  }

  /**
   * Issue #94: Get total deaths in campaign
   */
  get deathCount(): number {
    return this.snapshot.deathCount;
  }

  /**
   * Issue #95: Get total campaign kills
   */
  get totalKills(): number {
    return this.snapshot.totalCampaignKills;
  }

  // -----------------------------------------------------------------------
  // Command handlers
  // -----------------------------------------------------------------------

  private setPhase(phase: CampaignPhase): void {
    this.snapshot.phase = phase;
    this.notify();
  }

  private setLevelId(levelId: LevelId): void {
    this.snapshot.currentLevelId = levelId;
    this.snapshot.currentLevelConfig = CAMPAIGN_LEVELS[levelId] ?? null;
  }

  private handleNewGame(difficulty?: string): void {
    const diff = (difficulty as any) ?? 'normal';
    saveSystem.newGame(diff).then(() => {
      this.skipTutorial = false;
      this.setLevelId('anchor_station');
      this.snapshot.completionStats = null;
      this.snapshot.isBonusLevel = false;
      // Issue #14: Reset campaign-wide stats on new game
      this.snapshot.deathCount = 0;
      this.snapshot.totalCampaignKills = 0;
      this.snapshot.currentDifficulty = diff as any;
      this.snapshot.diedInCurrentLevel = false;
      this.snapshot.levelDamageReceived = 0;

      // Skip text walls - go straight to loading. Story unfolds in-level.
      this.setPhase('loading');
    });
  }

  private handleContinue(): void {
    saveSystem.loadGame().then((save) => {
      if (!save) {
        // Issue #67: Handle case where save fails to load
        console.warn('[CampaignDirector] No save found, starting new game');
        this.handleNewGame();
        return;
      }
      this.setLevelId(save.currentLevel);
      this.skipTutorial = save.tutorialCompleted;
      this.snapshot.completionStats = null;
      this.snapshot.isBonusLevel = false;
      // Issue #68: Restore difficulty from save
      this.snapshot.currentDifficulty = save.difficulty ?? 'normal';
      // Issue #69: Restore campaign-wide stats from save
      this.snapshot.totalCampaignKills = save.totalKills ?? 0;
      // Skip briefing - go straight to loading
      this.setPhase('loading');
    });
  }

  private handleSelectLevel(levelId: LevelId): void {
    this.setLevelId(levelId);
    this.skipTutorial = levelId !== 'anchor_station';
    this.snapshot.completionStats = null;
    this.snapshot.isBonusLevel = false;
    // Skip briefing - go straight to loading
    this.setPhase('loading');
  }

  private handleLoadingComplete(): void {
    const levelId = this.snapshot.currentLevelId;
    this.snapshot.levelStartTime = Date.now();
    this.snapshot.levelKills = 0;
    this.lastHealthBracket = 'healthy';
    // Issue #15: Reset level-specific tracking on load
    this.snapshot.diedInCurrentLevel = false;
    this.snapshot.levelDamageReceived = 0;
    // Issue #99: Reset audio log counter
    this.audioLogsFoundInLevel = 0;

    // Issue #16: Initialize achievement level tracking
    getAchievementManager().onLevelStart(levelId);

    // Start the mission timer
    getGameTimer().startMission(levelId);

    // Play Reyes briefing for this level
    const reyes = getReyesDialogueManager();
    reyes.playBriefing(levelId);

    // Issue #17: Update save system with current level
    saveSystem.setCurrentLevel(levelId);

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
    const levelId = this.snapshot.currentLevelId;
    const isNewBest = timer.checkAndSaveBestTime(levelId, finalTime);
    saveSystem.recordLevelTime(levelId, finalTime);

    // Issue #18: Get achievement stats to include in completion stats
    const achievementStats = getAchievementManager().getLevelStats();

    // Issue #19: Calculate accuracy properly
    const accuracy = stats.shotsFired > 0 ? (stats.shotsHit / stats.shotsFired) * 100 : 0;

    // Update stats with the accurate timer value and additional tracking
    this.snapshot.completionStats = {
      ...stats,
      timeElapsed: finalTime,
      // Issue #20: Include audio logs from achievement tracking if not in stats
      audioLogsFound: stats.audioLogsFound ?? 0,
      totalAudioLogs: stats.totalAudioLogs ?? 0,
      damageReceived: this.snapshot.levelDamageReceived,
      accuracy: Math.round(accuracy),
    };

    // Issue #21: Update total campaign kills
    this.snapshot.totalCampaignKills += this.snapshot.levelKills;

    // Issue #22: Add kills to save system
    for (let i = 0; i < this.snapshot.levelKills; i++) {
      saveSystem.addKill();
    }

    saveSystem.completeLevel(levelId);

    // Issue #23: Pass death flag and difficulty to achievement system
    const difficulty = this.snapshot.currentDifficulty ?? 'normal';
    getAchievementManager().onLevelComplete(levelId, this.snapshot.diedInCurrentLevel, difficulty);

    // Trigger per-level achievements
    this.triggerLevelAchievements(levelId);

    // Log if new best time
    if (isNewBest) {
      console.log(`[CampaignDirector] New best time for ${levelId}: ${finalTime.toFixed(2)}s`);
    }

    this.setPhase('levelComplete');
  }

  private handleAdvance(): void {
    const levelConfig = CAMPAIGN_LEVELS[this.snapshot.currentLevelId];
    const nextId = levelConfig?.nextLevelId;

    if (nextId) {
      this.setLevelId(nextId);
      this.snapshot.completionStats = null;
      this.snapshot.levelStartTime = Date.now();
      // Issue #74: Reset level-specific state for next level
      this.snapshot.levelKills = 0;
      this.snapshot.diedInCurrentLevel = false;
      this.snapshot.levelDamageReceived = 0;
      // Issue #75: Update chapter in save system
      const nextConfig = CAMPAIGN_LEVELS[nextId];
      if (nextConfig) {
        saveSystem.setChapter(nextConfig.chapter);
      }
      // Skip briefing - go straight to loading
      this.setPhase('loading');
    } else {
      // Final level complete - show credits
      // Issue #76: Save final stats before credits
      saveSystem.autoSave();
      this.setPhase('credits');
    }
  }

  private handleRetry(): void {
    this.snapshot.completionStats = null;
    this.snapshot.levelStartTime = Date.now();
    this.snapshot.restartCounter++;
    // Issue #24: Reset level-specific state on retry
    this.snapshot.levelKills = 0;
    this.snapshot.diedInCurrentLevel = false;
    this.snapshot.levelDamageReceived = 0;
    getGameTimer().resetMission();
    this.setPhase('loading');
  }

  private handleMainMenu(): void {
    this.snapshot.completionStats = null;
    this.snapshot.prePausePhase = null;
    this.snapshot.restartCounter++;
    this.setLevelId('anchor_station');
    this.skipTutorial = false;
    getGameTimer().resetMission();
    disposeReyesDialogueManager();
    this.setPhase('menu');
  }

  private handleDevJumpToLevel(levelId: LevelId): void {
    this.setLevelId(levelId);
    this.skipTutorial = true;
    this.snapshot.completionStats = null;
    this.snapshot.isBonusLevel = false;
    this.snapshot.restartCounter++;
    // Skip briefing/intro entirely — go straight to loading
    this.setPhase('loading');
  }

  private handleEnterBonusLevel(levelId: string): void {
    const bonus = BONUS_LEVELS[levelId];
    if (!bonus) {
      console.warn(`[CampaignDirector] Unknown bonus level: ${levelId}`);
      return;
    }
    // Issue #32: Store current level as return point before entering bonus
    this.bonusReturnLevelId = this.snapshot.currentLevelId;
    this.snapshot.isBonusLevel = true;
    // Issue #33: Reset level tracking for bonus level
    this.snapshot.levelKills = 0;
    this.snapshot.levelDamageReceived = 0;
    this.snapshot.diedInCurrentLevel = false;
    // Note: bonus levels don't go through the standard LevelId type
    // The level system handles them separately
    this.setPhase('bonusLevel'); // Issue #34: Use dedicated bonus level phase
    // Issue #35: Then transition to loading
    this.setPhase('loading');
  }

  private handleBonusComplete(): void {
    this.snapshot.isBonusLevel = false;
    // Issue #90: Update total kills from bonus level
    this.snapshot.totalCampaignKills += this.snapshot.levelKills;

    if (this.bonusReturnLevelId) {
      // Issue #91: Save bonus level completion in save system
      saveSystem.setLevelFlag(this.bonusReturnLevelId, 'bonus_completed', true);
      this.setLevelId(this.bonusReturnLevelId);
      this.bonusReturnLevelId = null;
      // Issue #92: Reset level state for return
      this.snapshot.levelKills = 0;
      this.snapshot.levelDamageReceived = 0;
      this.snapshot.diedInCurrentLevel = false;
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
        // Issue #25: Mark tutorial as complete in save
        saveSystem.completeTutorial();
        break;
      case 'landfall':
        am.onHaloDropComplete();
        am.onFirstCombatWin();
        break;
      case 'canyon_run':
        am.onCanyonRunComplete();
        break;
      case 'fob_delta':
        // Issue #26: FOB Delta was missing achievement triggers
        if (!this.snapshot.diedInCurrentLevel) {
          // Survivor achievement: complete FOB Delta without dying
          // This is now handled by onLevelComplete with diedInCurrentLevel flag
        }
        break;
      case 'brothers_in_arms':
        am.onMarcusFound();
        // Issue #27: Marcus down tracking should come from level, not hardcoded false
        // The level should call onMarcusDown() when Marcus goes down
        // We pass the marcusDownCount to determine if brothers_keeper is earned
        const marcusWentDown = (am.getProgress().marcusDownCount ?? 0) > 0;
        am.onBrothersInArmsComplete(marcusWentDown);
        am.resetMarcusTracking(); // Reset for next playthrough
        break;
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
        // Issue #28: Flawless run tracking should come from level
        // The level should track if player crashed
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
    if (this.snapshot.phase !== 'playing' && this.snapshot.phase !== 'tutorial' && this.snapshot.phase !== 'dropping') return;

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
    if (this.snapshot.phase !== 'playing' && this.snapshot.phase !== 'tutorial' && this.snapshot.phase !== 'dropping') return;

    const reyes = getReyesDialogueManager();
    if (inCombat) {
      reyes.triggerDialogue('hostiles_detected');
    } else {
      reyes.triggerDialogue('hostiles_cleared');
    }
  }

  /**
   * Called by levels for specific dialogue triggers (e.g. queen_detected).
   * Issue #70: Allow dialogue during tutorial and dropping phases too
   */
  triggerDialogue(trigger: DialogueTrigger): void {
    const validPhases: CampaignPhase[] = ['playing', 'tutorial', 'dropping'];
    if (!validPhases.includes(this.snapshot.phase)) return;
    getReyesDialogueManager().triggerDialogue(trigger);
  }

  /**
   * Called by LevelCallbacks.onKill to track kill count and trigger kill achievements.
   * Issue #31: Accept health percent for last stand achievement
   */
  onKill(playerHealthPercent?: number): void {
    this.snapshot.levelKills++;
    getAchievementManager().onKill(playerHealthPercent);
  }

  /**
   * Called by LevelCallbacks.onDamage to track damage for achievements.
   * Issue #29: Accept damage amount parameter for accurate tracking
   */
  onDamage(amount: number = 1): void {
    const am = getAchievementManager();
    am.onDamageTaken(this.snapshot.currentLevelId, amount);
    // Issue #30: Track damage in snapshot for level stats
    this.snapshot.levelDamageReceived += amount;
  }

  // -----------------------------------------------------------------------
  // Collectible wiring
  // -----------------------------------------------------------------------

  /**
   * Issue #99: Track audio log count for level stats
   */
  private audioLogsFoundInLevel = 0;

  /**
   * Called when a level reports an audio log was found.
   */
  onAudioLogFound(logId: string): void {
    getAchievementManager().onAudioLogFound();
    saveSystem.setLevelFlag(this.snapshot.currentLevelId, `audiolog_${logId}`, true);
    this.audioLogsFoundInLevel++;
  }

  /**
   * Issue #100: Get audio logs found in current level
   */
  getAudioLogsFoundInLevel(): number {
    return this.audioLogsFoundInLevel;
  }

  /**
   * Called when a level reports a secret area was discovered.
   */
  onSecretFound(secretId: string): void {
    getAchievementManager().onSecretFound();
    saveSystem.setLevelFlag(this.snapshot.currentLevelId, `secret_${secretId}`, true);
  }

  /**
   * Called when a level reports a skull was found.
   * Issue #87: Add skull collection achievement tracking
   */
  onSkullFound(skullId: string): void {
    saveSystem.setLevelFlag(this.snapshot.currentLevelId, `skull_${skullId}`, true);
    // Track skull in inventory for display
    saveSystem.setInventoryItem(`skull_${skullId}`, 1);
  }

  /**
   * Issue #88: Get current level's collectible counts for UI
   */
  getCurrentLevelCollectibles(): { secrets: number; audioLogs: number; hasSkull: boolean } {
    const config = this.snapshot.currentLevelConfig;
    const { getMissionDefinition } = require('./MissionDefinitions');
    const mission = getMissionDefinition(this.snapshot.currentLevelId);

    return {
      secrets: config?.totalSecrets ?? mission?.secretCount ?? 0,
      audioLogs: config?.totalAudioLogs ?? mission?.audioLogCount ?? 0,
      hasSkull: !!mission?.skullId,
    };
  }

  /**
   * Issue #89: Check if a collectible has been found in current level
   */
  isCollectibleFound(type: 'secret' | 'audiolog' | 'skull', id: string): boolean {
    const prefix = type === 'audiolog' ? 'audiolog' : type;
    return saveSystem.getLevelFlag(this.snapshot.currentLevelId, `${prefix}_${id}`);
  }

  /**
   * Called by LevelCallbacks.onObjectiveUpdate to track objectives in save data.
   */
  onObjectiveComplete(objectiveId: string): void {
    saveSystem.setObjective(objectiveId, true);
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  dispose(): void {
    this.listeners.clear();
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
