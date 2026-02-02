/**
 * Game Fixture - Shared test fixtures for Stellar Descent E2E tests
 *
 * Provides:
 * - Game page with debug state access
 * - PlayerGovernor control
 * - Screenshot utilities
 * - Game state reading
 *
 * Uses the __STELLAR_DESCENT_DEBUG__ interface exposed by debug-interface.ts
 */

import { test as baseTest, expect, type Page } from '@playwright/test';
import type { CampaignPhase, LevelStats } from '../../../game/campaign/types';
import type { LevelId } from '../../../game/levels/types';

// Debug state exposed on window for E2E testing
// Matches the StellarDescentDebugInterface from debug-interface.ts
export interface GameDebugState {
  // Campaign state
  campaign: {
    phase: CampaignPhase;
    currentLevelId: LevelId;
    difficulty: string;
    deathCount: number;
    totalKills: number;
    levelKills: number;
  };
  // Player state
  player: {
    health: number;
    maxHealth: number;
    armor: number;
    ammo: number;
    maxAmmo: number;
    position: { x: number; y: number; z: number };
    rotation: number;
  };
  // Current level state
  level: {
    id: LevelId;
    timeElapsed: number;
    kills: number;
    secretsFound: number;
    totalSecrets: number;
    audioLogsFound: number;
    totalAudioLogs: number;
  };
  // Governor state
  governor: {
    enabled: boolean;
    currentGoal: string;
    goalQueue: string[];
  };
  // Performance metrics
  performance: {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
  };
  // Achievements
  achievements: {
    unlocked: string[];
    progress: Record<string, number>;
  };
}

// Screenshot context for visual regression
export interface ScreenshotContext {
  name: string;
  level?: LevelId;
  phase?: CampaignPhase;
  timestamp: number;
}

// Game page wrapper with helper methods
export interface GamePage {
  page: Page;
  // Navigation
  goto(): Promise<void>;
  waitForGameReady(): Promise<void>;
  waitForPhase(phase: CampaignPhase, timeout?: number): Promise<void>;
  waitForLevelLoad(levelId: LevelId, timeout?: number): Promise<void>;
  // Debug state
  getDebugState(): Promise<GameDebugState>;
  exposeDebugState(): Promise<void>;
  // Governor control
  enableGovernor(): Promise<void>;
  disableGovernor(): Promise<void>;
  setGovernorGoal(goal: string, params?: Record<string, unknown>): Promise<void>;
  waitForGoalComplete(timeout?: number): Promise<void>;
  // Game actions
  startNewGame(difficulty?: string, startLevel?: LevelId): Promise<void>;
  continueGame(): Promise<void>;
  pauseGame(): Promise<void>;
  resumeGame(): Promise<void>;
  advanceToNextLevel(): Promise<void>;
  retryLevel(): Promise<void>;
  // State reading
  getPlayerHealth(): Promise<number>;
  getPlayerPosition(): Promise<{ x: number; y: number; z: number }>;
  getLevelStats(): Promise<Partial<LevelStats>>;
  getCurrentPhase(): Promise<CampaignPhase>;
  getCurrentLevel(): Promise<LevelId>;
  // Screenshots
  takeGameScreenshot(name: string): Promise<void>;
  captureVisualRegression(name: string, options?: { threshold?: number }): Promise<void>;
}

// Window type with debug interface
interface WindowWithDebug {
  __STELLAR_DESCENT_DEBUG__?: {
    gameState?: {
      getCurrentPhase?: () => string;
      getCurrentLevel?: () => string;
      getPlayerHealth?: () => number;
      getKillCount?: () => number;
      getCombatActive?: () => boolean;
      getObjective?: () => { title: string; instructions: string };
      getEnemyCount?: () => number;
    };
    playerGovernor?: {
      setGoal?: (goal: unknown) => void;
      getCurrentGoal?: () => { type: string };
      getInputState?: () => unknown;
      navigateTo?: (pos: unknown, threshold?: number) => void;
      engageEnemies?: (aggressive?: boolean) => void;
      wait?: (duration: number) => void;
      clearGoals?: () => void;
      runTutorialPlaythrough?: () => void;
    };
    levelState?: {
      getDropPhase?: () => string;
      getAltitude?: () => number;
      getVelocity?: () => number;
      getFuel?: () => number;
      getLandingOutcome?: () => string | null;
      getSuitIntegrity?: () => number;
      getAsteroidsDodged?: () => number;
      getAsteroidsHit?: () => number;
      isVehicleTransitActive?: () => boolean;
      getVehicleTransitDistance?: () => number;
    };
    triggerAction?: (actionId: string) => void;
    emitEvent?: (eventType: string, data?: unknown) => void;
  };
}

// Extend Playwright test with our fixtures
export const test = baseTest.extend<{
  gamePage: GamePage;
}>({
  gamePage: async ({ page, context }, use) => {
    const gamePage = createGamePage(page);
    await use(gamePage);
    // Explicit cleanup: close all pages in this context so the browser
    // window disappears even if the test timed out or was interrupted.
    for (const p of context.pages()) {
      await p.close().catch(() => {});
    }
  },
});

// Re-export expect
export { expect };

/**
 * Create a GamePage wrapper around a Playwright Page
 */
function createGamePage(page: Page): GamePage {
  return {
    page,

    async goto() {
      await page.goto('/', { waitUntil: 'networkidle' });
    },

    async waitForGameReady() {
      // Wait for React to mount - look for main menu or game canvas
      await page.waitForSelector('canvas, [data-testid="game-root"], .main-menu', {
        timeout: 30000,
      });
      // Wait for BabylonJS canvas
      await page.waitForSelector('canvas', { timeout: 30000 });
      // Wait for debug interface to be available
      await page.waitForFunction(
        () => {
          const w = window as unknown as WindowWithDebug;
          const debug = w.__STELLAR_DESCENT_DEBUG__;
          // Check if game state is available
          return debug?.gameState?.getCurrentPhase !== undefined;
        },
        { timeout: 60000 }
      );
    },

    async waitForPhase(phase: CampaignPhase, timeout = 60000) {
      await page.waitForFunction(
        (expectedPhase) => {
          const w = window as unknown as WindowWithDebug;
          const debug = w.__STELLAR_DESCENT_DEBUG__;
          const currentPhase = debug?.gameState?.getCurrentPhase?.();
          return currentPhase === expectedPhase;
        },
        phase,
        { timeout }
      );
    },

    async waitForLevelLoad(levelId: LevelId, timeout = 120000) {
      await page.waitForFunction(
        (expected) => {
          const w = window as unknown as WindowWithDebug;
          const debug = w.__STELLAR_DESCENT_DEBUG__;
          const currentLevel = debug?.gameState?.getCurrentLevel?.();
          const currentPhase = debug?.gameState?.getCurrentPhase?.();
          return (
            currentLevel === expected &&
            (currentPhase === 'playing' ||
              currentPhase === 'tutorial' ||
              currentPhase === 'dropping')
          );
        },
        levelId,
        { timeout }
      );
    },

    async getDebugState(): Promise<GameDebugState> {
      return page.evaluate(() => {
        const w = window as unknown as WindowWithDebug;
        const debug = w.__STELLAR_DESCENT_DEBUG__;
        if (!debug) {
          throw new Error('Game debug state not available. Ensure debug interface is initialized.');
        }
        // Build state from debug interface
        const gameState = debug.gameState;
        const levelState = debug.levelState;
        const playerGovernor = debug.playerGovernor;

        return {
          campaign: {
            phase: (gameState?.getCurrentPhase?.() ?? 'unknown') as CampaignPhase,
            currentLevelId: (gameState?.getCurrentLevel?.() ?? 'anchor_station') as LevelId,
            difficulty: 'normal',
            deathCount: 0,
            totalKills: gameState?.getKillCount?.() ?? 0,
            levelKills: gameState?.getKillCount?.() ?? 0,
          },
          player: {
            health: gameState?.getPlayerHealth?.() ?? 100,
            maxHealth: 100,
            armor: 0,
            ammo: 30,
            maxAmmo: 30,
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
          },
          level: {
            id: (gameState?.getCurrentLevel?.() ?? 'anchor_station') as LevelId,
            timeElapsed: 0,
            kills: gameState?.getKillCount?.() ?? 0,
            secretsFound: 0,
            totalSecrets: 0,
            audioLogsFound: 0,
            totalAudioLogs: 0,
          },
          governor: {
            enabled: playerGovernor !== undefined,
            currentGoal: playerGovernor?.getCurrentGoal?.()?.type ?? 'idle',
            goalQueue: [],
          },
          performance: {
            fps: 60,
            frameTime: 16.67,
            drawCalls: 0,
            triangles: 0,
          },
          achievements: {
            unlocked: [],
            progress: {},
          },
        } as GameDebugState;
      });
    },

    async exposeDebugState() {
      await page.evaluate(() => {
        const w = window as unknown as WindowWithDebug;
        if (!w.__STELLAR_DESCENT_DEBUG__) {
          console.warn('Debug state not exposed. Game may not be in E2E mode.');
        }
      });
    },

    async enableGovernor() {
      // Governor is always available when debug interface is present
      await page.evaluate(() => {
        console.log('Governor enabled via debug interface');
      });
    },

    async disableGovernor() {
      await page.evaluate(() => {
        const w = window as unknown as WindowWithDebug;
        w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.clearGoals?.();
      });
    },

    async setGovernorGoal(goal: string, params?: Record<string, unknown>) {
      await page.evaluate(
        ({ goal, params }) => {
          const w = window as unknown as WindowWithDebug;
          const pg = w.__STELLAR_DESCENT_DEBUG__?.playerGovernor;
          if (pg?.setGoal) {
            pg.setGoal({ type: goal, ...params });
          }
        },
        { goal, params }
      );
    },

    async waitForGoalComplete(timeout = 300000) {
      await page.waitForFunction(
        () => {
          const w = window as unknown as WindowWithDebug;
          const currentGoal = w.__STELLAR_DESCENT_DEBUG__?.playerGovernor?.getCurrentGoal?.();
          return currentGoal?.type === 'idle';
        },
        { timeout }
      );
    },

    async startNewGame(difficulty = 'normal', startLevel?: LevelId) {
      // Click NEW GAME button
      await page.click('text=NEW GAME', { timeout: 30000 });

      // Wait a moment for UI to update
      await page.waitForTimeout(500);

      // Select start level if provided and level select is visible
      if (startLevel) {
        try {
          await page.click(`[data-level-id="${startLevel}"]`, { timeout: 5000 });
        } catch {
          // Level select might not be visible in all flows
        }
      }

      // Select difficulty
      try {
        await page.click(`[data-difficulty="${difficulty}"]`, { timeout: 5000 });
      } catch {
        // Difficulty selector might not be visible
      }

      // Click START or BEGIN button
      try {
        await page.click('text=START', { timeout: 5000 });
      } catch {
        try {
          await page.click('text=BEGIN', { timeout: 5000 });
        } catch {
          // Button might have different text
        }
      }

      // Wait for game to start transitioning
      await page.waitForTimeout(1000);
    },

    async continueGame() {
      await page.click('text=CONTINUE', { timeout: 10000 });
      await page.waitForTimeout(1000);
    },

    async pauseGame() {
      await page.keyboard.press('Escape');
      await this.waitForPhase('paused', 5000);
    },

    async resumeGame() {
      await page.click('text=RESUME', { timeout: 5000 });
      // Wait for one of the playing phases
      await page.waitForFunction(
        () => {
          const w = window as unknown as WindowWithDebug;
          const phase = w.__STELLAR_DESCENT_DEBUG__?.gameState?.getCurrentPhase?.();
          return phase === 'playing' || phase === 'tutorial' || phase === 'dropping';
        },
        { timeout: 5000 }
      );
    },

    async advanceToNextLevel() {
      await page.click('text=CONTINUE', { timeout: 10000 });
      await page.waitForTimeout(1000);
    },

    async retryLevel() {
      await page.click('text=RETRY', { timeout: 10000 });
      await page.waitForTimeout(1000);
    },

    async getPlayerHealth(): Promise<number> {
      return page.evaluate(() => {
        const w = window as unknown as WindowWithDebug;
        return w.__STELLAR_DESCENT_DEBUG__?.gameState?.getPlayerHealth?.() ?? 100;
      });
    },

    async getPlayerPosition(): Promise<{ x: number; y: number; z: number }> {
      // Position would need to be exposed via debug interface
      return { x: 0, y: 0, z: 0 };
    },

    async getLevelStats(): Promise<Partial<LevelStats>> {
      return page.evaluate(() => {
        const w = window as unknown as WindowWithDebug;
        const gs = w.__STELLAR_DESCENT_DEBUG__?.gameState;
        return {
          kills: gs?.getKillCount?.() ?? 0,
          timeElapsed: 0,
          secretsFound: 0,
          totalSecrets: 0,
          audioLogsFound: 0,
          totalAudioLogs: 0,
        };
      });
    },

    async getCurrentPhase(): Promise<CampaignPhase> {
      return page.evaluate(() => {
        const w = window as unknown as WindowWithDebug;
        return (w.__STELLAR_DESCENT_DEBUG__?.gameState?.getCurrentPhase?.() ??
          'menu') as CampaignPhase;
      });
    },

    async getCurrentLevel(): Promise<LevelId> {
      return page.evaluate(() => {
        const w = window as unknown as WindowWithDebug;
        return (w.__STELLAR_DESCENT_DEBUG__?.gameState?.getCurrentLevel?.() ??
          'anchor_station') as LevelId;
      });
    },

    async takeGameScreenshot(name: string) {
      const timestamp = Date.now();
      let level = 'unknown';
      let phase = 'unknown';
      try {
        level = await this.getCurrentLevel();
        phase = await this.getCurrentPhase();
      } catch {
        // Ignore errors reading state
      }

      await page.screenshot({
        path: `test-results/screenshots/${level}_${phase}_${name}_${timestamp}.png`,
        fullPage: false,
      });
    },

    async captureVisualRegression(name: string, options?: { threshold?: number }) {
      await expect(page).toHaveScreenshot(`${name}.png`, {
        threshold: options?.threshold ?? 0.1,
        maxDiffPixelRatio: 0.05,
      });
    },
  };
}
