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
import type { CampaignCommand, CampaignPhase, CampaignSnapshot, LevelStats } from './types';

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

      // Skip text walls - go straight to loading. Story unfolds in-level.
      this.setPhase('loading');
    });
  }

  private handleContinue(): void {
    saveSystem.loadGame().then((save) => {
      if (!save) return;
      this.setLevelId(save.currentLevel);
      this.skipTutorial = save.tutorialCompleted;
      this.snapshot.completionStats = null;
      this.snapshot.isBonusLevel = false;
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

    // Start the mission timer
    getGameTimer().startMission(levelId);

    // Play Reyes briefing for this level
    const reyes = getReyesDialogueManager();
    reyes.playBriefing(levelId);

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

    // Update stats with the accurate timer value
    this.snapshot.completionStats = {
      ...stats,
      timeElapsed: finalTime,
    };

    saveSystem.completeLevel(levelId);

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
      // Skip briefing - go straight to loading
      this.setPhase('loading');
    } else {
      // Final level complete - show credits
      this.setPhase('credits');
    }
  }

  private handleRetry(): void {
    this.snapshot.completionStats = null;
    this.snapshot.levelStartTime = Date.now();
    this.snapshot.restartCounter++;
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
    this.bonusReturnLevelId = bonus.returnLevelId;
    this.snapshot.isBonusLevel = true;
    // Note: bonus levels don't go through the standard LevelId type
    // The level system handles them separately
    this.setPhase('loading');
  }

  private handleBonusComplete(): void {
    this.snapshot.isBonusLevel = false;
    if (this.bonusReturnLevelId) {
      this.setLevelId(this.bonusReturnLevelId);
      this.bonusReturnLevelId = null;
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
      case 'brothers_in_arms':
        am.onMarcusFound();
        am.onBrothersInArmsComplete(false);
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
        am.onFinalEscapeComplete(false);
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
   */
  triggerDialogue(trigger: DialogueTrigger): void {
    if (this.snapshot.phase !== 'playing') return;
    getReyesDialogueManager().triggerDialogue(trigger);
  }

  /**
   * Called by LevelCallbacks.onKill to track kill count and trigger kill achievements.
   */
  onKill(): void {
    this.snapshot.levelKills++;
    getAchievementManager().onKill();
  }

  /**
   * Called by LevelCallbacks.onDamage to track damage for achievements.
   */
  onDamage(): void {
    const am = getAchievementManager();
    am.onDamageTaken(this.snapshot.currentLevelId, 1);
  }

  // -----------------------------------------------------------------------
  // Collectible wiring
  // -----------------------------------------------------------------------

  /**
   * Called when a level reports an audio log was found.
   */
  onAudioLogFound(logId: string): void {
    getAchievementManager().onAudioLogFound();
    saveSystem.setLevelFlag(this.snapshot.currentLevelId, `audiolog_${logId}`, true);
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
   */
  onSkullFound(skullId: string): void {
    saveSystem.setLevelFlag(this.snapshot.currentLevelId, `skull_${skullId}`, true);
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
