/**
 * Campaign System Types
 *
 * CampaignDirector is the game's spine - a state machine that replaces
 * the scattered callbacks in App.tsx with a single dispatch(command) API.
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import type { LevelConfig, LevelId } from '../levels/types';

// ============================================================================
// Campaign Phases
// ============================================================================

export type CampaignPhase =
  | 'idle'
  | 'splash'
  | 'title'
  | 'menu'
  | 'introBriefing'
  | 'cinematic' // Video cinematic before briefing
  | 'briefing'
  | 'intro'
  | 'loading'
  | 'tutorial'
  | 'dropping'
  | 'playing'
  | 'paused'
  | 'levelComplete'
  | 'gameover'
  | 'credits'
  | 'bonusLevel'; // Issue #1: Missing phase for bonus levels

// ============================================================================
// Campaign Commands (the ONLY way to mutate state)
// ============================================================================

export type CampaignCommand =
  | { type: 'NEW_GAME'; difficulty?: DifficultyLevel; startLevel?: LevelId }
  | { type: 'CONTINUE' }
  | { type: 'SELECT_LEVEL'; levelId: LevelId }
  | { type: 'BEGIN_MISSION' }
  | { type: 'SPLASH_COMPLETE' }
  | { type: 'CINEMATIC_COMPLETE' } // Video cinematic finished or skipped
  | { type: 'INTRO_COMPLETE' }
  | { type: 'INTRO_BRIEFING_COMPLETE' }
  | { type: 'LOADING_COMPLETE' }
  | { type: 'TUTORIAL_COMPLETE' }
  | { type: 'DROP_COMPLETE' }
  | { type: 'LEVEL_COMPLETE'; stats: LevelStats }
  | { type: 'ADVANCE' }
  | { type: 'RETRY' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'PLAYER_DIED' }
  | { type: 'MAIN_MENU' }
  | { type: 'CREDITS_DONE' }
  | { type: 'TITLE_COMPLETE' }
  | { type: 'ENTER_BONUS_LEVEL'; levelId: string }
  | { type: 'BONUS_COMPLETE' }
  | { type: 'DEV_JUMP_TO_LEVEL'; levelId: LevelId };

// ============================================================================
// Campaign Snapshot (read-only view for React)
// ============================================================================

export interface CampaignSnapshot {
  phase: CampaignPhase;
  currentLevelId: LevelId;
  currentLevelConfig: LevelConfig | null;
  isBonusLevel: boolean;
  levelKills: number;
  levelStartTime: number;
  completionStats: LevelStats | null;
  /** Whether the intro briefing needs to be shown for this new game */
  needsIntroBriefing: boolean;
  /** The pre-pause phase so we can resume correctly */
  prePausePhase: CampaignPhase | null;
  /** Increments on RETRY, DEV_JUMP_TO_LEVEL, MAIN_MENU — used as React key to force remount */
  restartCounter: number;
  /** Issue #8: Track deaths for retry count display */
  deathCount: number;
  /** Issue #9: Track total campaign kills across levels */
  totalCampaignKills: number;
  /** Issue #10: Track current difficulty for UI display */
  currentDifficulty: DifficultyLevel | null;
  /** Issue #11: Track whether player has died in current level (for achievements) */
  diedInCurrentLevel: boolean;
  /** Issue #12: Track damage taken in current level */
  levelDamageReceived: number;
}

// ============================================================================
// Level Stats
// ============================================================================

export interface LevelStats {
  timeElapsed: number;
  kills: number;
  shotsFired: number;
  shotsHit: number;
  secretsFound: number;
  totalSecrets: number;
  audioLogsFound: number; // Issue #2: Missing audio log tracking in stats
  totalAudioLogs: number; // Issue #3: Missing total audio logs
  damageReceived: number; // Issue #4: Missing damage tracking for achievements
  accuracy: number; // Issue #5: Pre-computed accuracy for display
}

// ============================================================================
// Mission Definitions
// ============================================================================

export interface MissionObjective {
  id: string;
  description: string;
  type: 'primary' | 'optional';
}

export interface MissionDefinition {
  levelId: LevelId;
  objectives: MissionObjective[];
  vehicleIds?: string[];
  dialogueTriggers?: string[];
  audioLogCount: number;
  secretCount: number;
  skullId?: string;
  hasBonusAccess?: string;
  parTimeSeconds?: number; // Issue #6: Par time should be in definition, not just achievements
  bossId?: string; // Issue #7: Boss tracking for levels with boss fights
}
