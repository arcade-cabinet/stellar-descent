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
      return (
        window as unknown as {
          __STELLAR_DESCENT_DEBUG__?: {
            gameState?: {
              getCurrentPhase?: () => string;
              getCurrentLevel?: () => string;
              getPlayerHealth?: () => number;
              getKillCount?: () => number;
            };
            levelState?: {
              getSuitIntegrity?: () => number;
            };
          };
        }
      ).__STELLAR_DESCENT_DEBUG__;
    });
  };

  return {
    async getCampaignPhase(): Promise<CampaignPhase> {
      const debug = await getDebug();
      return (debug?.gameState?.getCurrentPhase?.() as CampaignPhase) ?? 'idle';
    },

    async getCurrentLevelId(): Promise<LevelId> {
      const debug = await getDebug();
      return (debug?.gameState?.getCurrentLevel?.() as LevelId) ?? 'anchor_station';
    },

    async getDifficulty(): Promise<string> {
      return 'normal'; // TODO: Expose via debug interface
    },

    async getTotalKills(): Promise<number> {
      const debug = await getDebug();
      return debug?.gameState?.getKillCount?.() ?? 0;
    },

    async getTotalDeaths(): Promise<number> {
      return 0; // TODO: Expose via debug interface
    },

    async getPlayerHealth(): Promise<number> {
      const debug = await getDebug();
      return debug?.gameState?.getPlayerHealth?.() ?? 100;
    },

    async getPlayerMaxHealth(): Promise<number> {
      return 100; // TODO: Expose via debug interface
    },

    async getPlayerArmor(): Promise<number> {
      return 0; // TODO: Expose via debug interface
    },

    async getPlayerAmmo(): Promise<number> {
      return 30; // TODO: Expose via debug interface
    },

    async getPlayerPosition(): Promise<{ x: number; y: number; z: number }> {
      return { x: 0, y: 0, z: 0 }; // TODO: Expose via debug interface
    },

    async getLevelTimeElapsed(): Promise<number> {
      return 0; // TODO: Expose via debug interface
    },

    async getLevelKills(): Promise<number> {
      const debug = await getDebug();
      return debug?.gameState?.getKillCount?.() ?? 0;
    },

    async getLevelSecretsFound(): Promise<number> {
      return 0; // TODO: Expose via debug interface
    },

    async getLevelTotalSecrets(): Promise<number> {
      return 0; // TODO: Expose via debug interface
    },

    async getLevelAudioLogsFound(): Promise<number> {
      return 0; // TODO: Expose via debug interface
    },

    async getLevelTotalAudioLogs(): Promise<number> {
      return 0; // TODO: Expose via debug interface
    },

    async getLevelStats(): Promise<Partial<LevelStats>> {
      const debug = await getDebug();
      return {
        kills: debug?.gameState?.getKillCount?.() ?? 0,
        timeElapsed: 0,
        secretsFound: 0,
        totalSecrets: 0,
        audioLogsFound: 0,
        totalAudioLogs: 0,
      };
    },

    async getUnlockedAchievements(): Promise<string[]> {
      return []; // TODO: Expose via debug interface
    },

    async getAchievementProgress(): Promise<Record<string, number>> {
      return {}; // TODO: Expose via debug interface
    },

    async getFPS(): Promise<number> {
      return 60; // TODO: Expose via debug interface
    },

    async getFrameTime(): Promise<number> {
      return 16.67; // TODO: Expose via debug interface
    },

    async hasSaveData(): Promise<boolean> {
      return false; // TODO: Expose via debug interface
    },

    async getLastSaveLevel(): Promise<LevelId | null> {
      return null; // TODO: Expose via debug interface
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
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: { gameState?: { getCurrentPhase?: () => string } };
      };
      return w.__STELLAR_DESCENT_DEBUG__?.gameState?.getCurrentPhase?.() === expected;
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
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: {
          gameState?: { getCurrentPhase?: () => string; getCurrentLevel?: () => string };
        };
      };
      const gs = w.__STELLAR_DESCENT_DEBUG__?.gameState;
      const currentLevel = gs?.getCurrentLevel?.();
      const currentPhase = gs?.getCurrentPhase?.();
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
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: { gameState?: { getCurrentPhase?: () => string } };
      };
      return w.__STELLAR_DESCENT_DEBUG__?.gameState?.getCurrentPhase?.() === 'levelComplete';
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
      const w = window as unknown as {
        __STELLAR_DESCENT_DEBUG__?: { gameState?: { getCurrentPhase?: () => string } };
      };
      return w.__STELLAR_DESCENT_DEBUG__?.gameState?.getCurrentPhase?.() === 'credits';
    },
    { timeout }
  );
}
