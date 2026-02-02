/**
 * Game State Utilities for E2E Testing
 *
 * Provides utilities for:
 * - Reading game state via debug interface
 * - Tracking metrics across levels
 * - Generating test reports
 */

import type { Page } from '@playwright/test';
import type { CampaignPhase, LevelStats } from '../../../game/campaign/types';
import type { LevelId } from '../../../game/levels/types';

// All campaign levels in order
export const CAMPAIGN_LEVEL_ORDER: LevelId[] = [
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
];

// Level display names for reporting
export const LEVEL_DISPLAY_NAMES: Record<LevelId, string> = {
  anchor_station: 'Anchor Station Prometheus',
  landfall: 'Landfall',
  canyon_run: 'Canyon Run',
  fob_delta: 'FOB Delta',
  brothers_in_arms: 'Brothers in Arms',
  southern_ice: 'Southern Ice',
  the_breach: 'The Breach',
  hive_assault: 'Hive Assault',
  extraction: 'Extraction',
  final_escape: 'Final Escape',
};

// Campaign playthrough metrics
export interface CampaignMetrics {
  startTime: number;
  endTime: number;
  totalTimeMs: number;
  totalKills: number;
  totalDeaths: number;
  totalSecrets: number;
  totalAudioLogs: number;
  achievementsUnlocked: string[];
  levelMetrics: LevelMetrics[];
  difficulty: string;
  success: boolean;
  creditsRolled: boolean;
}

export interface LevelMetrics {
  levelId: LevelId;
  levelName: string;
  startTime: number;
  endTime: number;
  timeMs: number;
  kills: number;
  deaths: number;
  secretsFound: number;
  totalSecrets: number;
  audioLogsFound: number;
  totalAudioLogs: number;
  completed: boolean;
  parTime?: number;
  beatParTime?: boolean;
}

// Game state reader
export interface GameStateReader {
  // Campaign state
  getCampaignPhase(): Promise<CampaignPhase>;
  getCurrentLevelId(): Promise<LevelId>;
  getDifficulty(): Promise<string>;
  getTotalKills(): Promise<number>;
  getTotalDeaths(): Promise<number>;

  // Player state
  getPlayerHealth(): Promise<number>;
  getPlayerMaxHealth(): Promise<number>;
  getPlayerArmor(): Promise<number>;
  getPlayerAmmo(): Promise<number>;
  getPlayerPosition(): Promise<{ x: number; y: number; z: number }>;

  // Level state
  getLevelTimeElapsed(): Promise<number>;
  getLevelKills(): Promise<number>;
  getLevelSecretsFound(): Promise<number>;
  getLevelTotalSecrets(): Promise<number>;
  getLevelAudioLogsFound(): Promise<number>;
  getLevelTotalAudioLogs(): Promise<number>;
  getLevelStats(): Promise<Partial<LevelStats>>;

  // Achievements
  getUnlockedAchievements(): Promise<string[]>;
  getAchievementProgress(): Promise<Record<string, number>>;

  // Performance
  getFPS(): Promise<number>;
  getFrameTime(): Promise<number>;

  // Save system
  hasSaveData(): Promise<boolean>;
  getLastSaveLevel(): Promise<LevelId | null>;
}

/**
 * Create a game state reader for a page
 */
export function createGameStateReader(page: Page): GameStateReader {
  const getDebug = async () => {
    return page.evaluate(() => {
      const debug = (window as any).__STELLAR_DESCENT_DEBUG__;
      const unified = (window as any).__STELLAR_DESCENT__;
      if (!debug && !unified) return null;
      return {
        phase: debug?.campaignDirector?.getPhase() ?? unified?.campaign?.phase ?? 'idle',
        currentLevelId:
          debug?.campaignDirector?.getState()?.currentLevelId ??
          unified?.campaign?.currentLevelId ??
          'anchor_station',
        difficulty:
          debug?.campaignDirector?.getState()?.difficulty ??
          unified?.campaign?.difficulty ??
          'normal',
        playerHealth: debug?.player?.health ?? unified?.player?.health ?? 100,
        playerMaxHealth: debug?.player?.maxHealth ?? unified?.player?.maxHealth ?? 100,
        playerPosition: debug?.player?.position ??
          unified?.player?.position ?? { x: 0, y: 0, z: 0 },
        playerIsAlive: debug?.player?.isAlive ?? unified?.player?.isAlive ?? true,
        levelKills: debug?.level?.kills ?? unified?.level?.kills ?? 0,
        deathCount: unified?.campaign?.deathCount ?? 0,
        fps: unified?.performance?.fps ?? 60,
        frameTime: unified?.performance?.frameTime ?? 16.67,
        secretsFound: unified?.level?.secretsFound ?? 0,
        totalSecrets: unified?.level?.totalSecrets ?? 0,
        audioLogsFound: unified?.level?.audioLogsFound ?? 0,
        totalAudioLogs: unified?.level?.totalAudioLogs ?? 0,
        timeElapsed: unified?.level?.timeElapsed ?? 0,
        achievementsUnlocked: unified?.achievements?.unlocked ?? [],
        achievementProgress: unified?.achievements?.progress ?? {},
      };
    });
  };

  return {
    async getCampaignPhase(): Promise<CampaignPhase> {
      const debug = await getDebug();
      return (debug?.phase as CampaignPhase) ?? 'idle';
    },

    async getCurrentLevelId(): Promise<LevelId> {
      const debug = await getDebug();
      return (debug?.currentLevelId as LevelId) ?? 'anchor_station';
    },

    async getDifficulty(): Promise<string> {
      const debug = await getDebug();
      return debug?.difficulty ?? 'normal';
    },

    async getTotalKills(): Promise<number> {
      const debug = await getDebug();
      return debug?.levelKills ?? 0;
    },

    async getTotalDeaths(): Promise<number> {
      const debug = await getDebug();
      // Note: deathCount is tracked in unified interface but still returns 0 by default
      return debug?.deathCount ?? 0;
    },

    async getPlayerHealth(): Promise<number> {
      const debug = await getDebug();
      return debug?.playerHealth ?? 100;
    },

    async getPlayerMaxHealth(): Promise<number> {
      const debug = await getDebug();
      return debug?.playerMaxHealth ?? 100;
    },

    async getPlayerArmor(): Promise<number> {
      // Note: Armor not exposed in debug interface yet
      return 0;
    },

    async getPlayerAmmo(): Promise<number> {
      // Note: Ammo not exposed in debug interface yet
      return 30;
    },

    async getPlayerPosition(): Promise<{ x: number; y: number; z: number }> {
      const debug = await getDebug();
      return debug?.playerPosition ?? { x: 0, y: 0, z: 0 };
    },

    async getLevelTimeElapsed(): Promise<number> {
      const debug = await getDebug();
      return debug?.timeElapsed ?? 0;
    },

    async getLevelKills(): Promise<number> {
      const debug = await getDebug();
      return debug?.levelKills ?? 0;
    },

    async getLevelSecretsFound(): Promise<number> {
      const debug = await getDebug();
      return debug?.secretsFound ?? 0;
    },

    async getLevelTotalSecrets(): Promise<number> {
      const debug = await getDebug();
      return debug?.totalSecrets ?? 0;
    },

    async getLevelAudioLogsFound(): Promise<number> {
      const debug = await getDebug();
      return debug?.audioLogsFound ?? 0;
    },

    async getLevelTotalAudioLogs(): Promise<number> {
      const debug = await getDebug();
      return debug?.totalAudioLogs ?? 0;
    },

    async getLevelStats(): Promise<Partial<LevelStats>> {
      const debug = await getDebug();
      return {
        kills: debug?.levelKills ?? 0,
        timeElapsed: debug?.timeElapsed ?? 0,
        secretsFound: debug?.secretsFound ?? 0,
        totalSecrets: debug?.totalSecrets ?? 0,
        audioLogsFound: debug?.audioLogsFound ?? 0,
        totalAudioLogs: debug?.totalAudioLogs ?? 0,
      };
    },

    async getUnlockedAchievements(): Promise<string[]> {
      const debug = await getDebug();
      return debug?.achievementsUnlocked ?? [];
    },

    async getAchievementProgress(): Promise<Record<string, number>> {
      const debug = await getDebug();
      return debug?.achievementProgress ?? {};
    },

    async getFPS(): Promise<number> {
      const debug = await getDebug();
      // Note: FPS tracked in unified interface performance metrics
      return debug?.fps ?? 60;
    },

    async getFrameTime(): Promise<number> {
      const debug = await getDebug();
      // Note: Frame time tracked in unified interface performance metrics
      return debug?.frameTime ?? 16.67;
    },

    async hasSaveData(): Promise<boolean> {
      // Note: Save system querying requires enhancement to DebugInterface.ts
      return false;
    },

    async getLastSaveLevel(): Promise<LevelId | null> {
      // Note: Save system querying requires enhancement to DebugInterface.ts
      return null;
    },
  };
}

/**
 * Campaign metrics tracker
 */
export class CampaignMetricsTracker {
  private metrics: CampaignMetrics;
  private currentLevelMetrics: LevelMetrics | null = null;

  constructor(difficulty: string) {
    this.metrics = {
      startTime: Date.now(),
      endTime: 0,
      totalTimeMs: 0,
      totalKills: 0,
      totalDeaths: 0,
      totalSecrets: 0,
      totalAudioLogs: 0,
      achievementsUnlocked: [],
      levelMetrics: [],
      difficulty,
      success: false,
      creditsRolled: false,
    };
  }

  /**
   * Start tracking a level
   */
  startLevel(levelId: LevelId): void {
    this.currentLevelMetrics = {
      levelId,
      levelName: LEVEL_DISPLAY_NAMES[levelId],
      startTime: Date.now(),
      endTime: 0,
      timeMs: 0,
      kills: 0,
      deaths: 0,
      secretsFound: 0,
      totalSecrets: 0,
      audioLogsFound: 0,
      totalAudioLogs: 0,
      completed: false,
    };
  }

  /**
   * End tracking the current level
   */
  endLevel(stats: Partial<LevelStats>, completed: boolean): void {
    if (!this.currentLevelMetrics) return;

    this.currentLevelMetrics.endTime = Date.now();
    this.currentLevelMetrics.timeMs =
      this.currentLevelMetrics.endTime - this.currentLevelMetrics.startTime;
    this.currentLevelMetrics.kills = stats.kills ?? 0;
    this.currentLevelMetrics.secretsFound = stats.secretsFound ?? 0;
    this.currentLevelMetrics.totalSecrets = stats.totalSecrets ?? 0;
    this.currentLevelMetrics.audioLogsFound = stats.audioLogsFound ?? 0;
    this.currentLevelMetrics.totalAudioLogs = stats.totalAudioLogs ?? 0;
    this.currentLevelMetrics.completed = completed;

    // Update totals
    this.metrics.totalKills += this.currentLevelMetrics.kills;
    this.metrics.totalSecrets += this.currentLevelMetrics.secretsFound;
    this.metrics.totalAudioLogs += this.currentLevelMetrics.audioLogsFound;

    this.metrics.levelMetrics.push(this.currentLevelMetrics);
    this.currentLevelMetrics = null;
  }

  /**
   * Record a death
   */
  recordDeath(): void {
    if (this.currentLevelMetrics) {
      this.currentLevelMetrics.deaths++;
    }
    this.metrics.totalDeaths++;
  }

  /**
   * Record an achievement unlock
   */
  recordAchievement(achievementId: string): void {
    if (!this.metrics.achievementsUnlocked.includes(achievementId)) {
      this.metrics.achievementsUnlocked.push(achievementId);
    }
  }

  /**
   * Mark credits as rolled
   */
  markCreditsRolled(): void {
    this.metrics.creditsRolled = true;
  }

  /**
   * Finalize the campaign metrics
   */
  finalize(success: boolean): CampaignMetrics {
    this.metrics.endTime = Date.now();
    this.metrics.totalTimeMs = this.metrics.endTime - this.metrics.startTime;
    this.metrics.success = success;
    return this.metrics;
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): CampaignMetrics {
    return { ...this.metrics };
  }
}

/**
 * Generate a test report from campaign metrics
 */
export function generateTestReport(metrics: CampaignMetrics): string {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push('                    STELLAR DESCENT - E2E CAMPAIGN REPORT');
  lines.push('================================================================================');
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('--------');
  lines.push(`Status: ${metrics.success ? 'SUCCESS' : 'FAILED'}`);
  lines.push(`Difficulty: ${metrics.difficulty.toUpperCase()}`);
  lines.push(`Total Time: ${formatTime(metrics.totalTimeMs)}`);
  lines.push(`Total Kills: ${metrics.totalKills}`);
  lines.push(`Total Deaths: ${metrics.totalDeaths}`);
  lines.push(`Secrets Found: ${metrics.totalSecrets}`);
  lines.push(`Audio Logs Found: ${metrics.totalAudioLogs}`);
  lines.push(`Credits Rolled: ${metrics.creditsRolled ? 'Yes' : 'No'}`);
  lines.push('');

  // Level breakdown
  lines.push('LEVEL BREAKDOWN');
  lines.push('----------------');
  for (const level of metrics.levelMetrics) {
    const status = level.completed ? '[COMPLETE]' : '[INCOMPLETE]';
    lines.push(`${status} ${level.levelName}`);
    lines.push(`  Time: ${formatTime(level.timeMs)}`);
    lines.push(`  Kills: ${level.kills}`);
    lines.push(`  Deaths: ${level.deaths}`);
    lines.push(`  Secrets: ${level.secretsFound}/${level.totalSecrets}`);
    lines.push(`  Audio Logs: ${level.audioLogsFound}/${level.totalAudioLogs}`);
    if (level.parTime && level.beatParTime !== undefined) {
      lines.push(
        `  Par Time: ${level.beatParTime ? 'BEAT' : 'MISSED'} (${formatTime(level.parTime * 1000)})`
      );
    }
    lines.push('');
  }

  // Achievements
  if (metrics.achievementsUnlocked.length > 0) {
    lines.push('ACHIEVEMENTS UNLOCKED');
    lines.push('----------------------');
    for (const achievement of metrics.achievementsUnlocked) {
      lines.push(`  - ${achievement}`);
    }
    lines.push('');
  }

  lines.push('================================================================================');
  lines.push(`Report generated at: ${new Date().toISOString()}`);
  lines.push('================================================================================');

  return lines.join('\n');
}

/**
 * Format milliseconds as MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Wait for a specific campaign phase
 */
export async function waitForPhase(
  page: Page,
  phase: CampaignPhase,
  timeout = 60000
): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.campaignDirector?.getPhase() === expected;
    },
    phase,
    { timeout }
  );
}

/**
 * Wait for a level to complete loading and become playable
 */
export async function waitForLevelPlayable(
  page: Page,
  levelId: LevelId,
  timeout = 120000
): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const w = window as any;
      const gs = w.__STELLAR_DESCENT_DEBUG__?.campaignDirector;
      const currentLevel = gs?.getState()?.currentLevelId;
      const currentPhase = gs?.getPhase();
      const playablePhases = ['playing', 'tutorial', 'dropping'];
      return currentLevel === expected && playablePhases.includes(currentPhase ?? '');
    },
    levelId,
    { timeout }
  );
}

/**
 * Wait for level completion
 */
export async function waitForLevelComplete(page: Page, timeout = 600000): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.campaignDirector?.getPhase() === 'levelComplete';
    },
    { timeout }
  );
}

/**
 * Wait for credits to roll
 */
export async function waitForCredits(page: Page, timeout = 60000): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.campaignDirector?.getPhase() === 'credits';
    },
    { timeout }
  );
}
