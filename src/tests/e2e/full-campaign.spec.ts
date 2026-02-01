/**
 * Full Campaign Playthrough E2E Test
 *
 * This test runs through all 10 levels of the Stellar Descent campaign
 * using the PlayerGovernor for autonomous gameplay.
 *
 * Test coverage:
 * - All 10 campaign levels complete successfully
 * - Save system persists progress between levels
 * - Achievements unlock at appropriate milestones
 * - Credits roll after final level
 * - Comprehensive metrics tracking
 *
 * Runtime: Approximately 30-60 minutes depending on hardware
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LevelId } from '../../game/levels/types';
import { expect, test } from './fixtures/game-fixture';
import {
  CAMPAIGN_LEVEL_ORDER,
  CampaignMetricsTracker,
  createGameStateReader,
  generateTestReport,
  LEVEL_DISPLAY_NAMES,
  waitForCredits,
  waitForLevelComplete,
  waitForLevelPlayable,
  waitForPhase,
} from './utils/game-state';
import { createGovernorController } from './utils/player-governor';

// Extend timeout for full campaign (30 minutes)
test.setTimeout(30 * 60 * 1000);

// Test configuration
const TEST_CONFIG = {
  // Difficulty for the campaign run
  difficulty: 'normal' as const,
  // Maximum time per level (10 minutes)
  levelTimeout: 10 * 60 * 1000,
  // Whether to capture screenshots at milestones
  captureScreenshots: true,
  // Screenshot directory
  screenshotDir: 'test-results/screenshots/campaign',
  // Report directory
  reportDir: 'test-results/reports',
};

test.describe('Full Campaign Playthrough', () => {
  test.describe.configure({ mode: 'serial' });

  // Shared metrics tracker across tests
  let metricsTracker: CampaignMetricsTracker;

  test.beforeAll(async () => {
    // Ensure output directories exist
    fs.mkdirSync(TEST_CONFIG.screenshotDir, { recursive: true });
    fs.mkdirSync(TEST_CONFIG.reportDir, { recursive: true });

    // Initialize metrics tracker
    metricsTracker = new CampaignMetricsTracker(TEST_CONFIG.difficulty);
  });

  test.afterAll(async () => {
    // Generate and save final report
    const metrics = metricsTracker.finalize(true);
    const report = generateTestReport(metrics);

    const reportPath = path.join(TEST_CONFIG.reportDir, `campaign-report-${Date.now()}.txt`);
    fs.writeFileSync(reportPath, report);
    console.log('\n' + report);

    // Save metrics as JSON for programmatic analysis
    const metricsPath = path.join(TEST_CONFIG.reportDir, `campaign-metrics-${Date.now()}.json`);
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
  });

  test('should start new game on NORMAL difficulty', async ({ gamePage }) => {
    const { page } = gamePage;

    // Navigate to game
    await gamePage.goto();
    await gamePage.waitForGameReady();

    // Take initial screenshot
    if (TEST_CONFIG.captureScreenshots) {
      await page.screenshot({
        path: path.join(TEST_CONFIG.screenshotDir, '00-main-menu.png'),
      });
    }

    // Verify main menu is visible
    await expect(page.getByText('NEW GAME')).toBeVisible({ timeout: 30000 });

    // Start new game
    await gamePage.startNewGame(TEST_CONFIG.difficulty);

    // Verify we're in briefing phase
    const stateReader = createGameStateReader(page);
    const phase = await stateReader.getCampaignPhase();
    expect(['briefing', 'cinematic', 'loading']).toContain(phase);

    // Take screenshot of briefing
    if (TEST_CONFIG.captureScreenshots) {
      await page.screenshot({
        path: path.join(TEST_CONFIG.screenshotDir, '01-mission-briefing.png'),
      });
    }
  });

  // Generate individual test for each level
  for (let i = 0; i < CAMPAIGN_LEVEL_ORDER.length; i++) {
    const levelId = CAMPAIGN_LEVEL_ORDER[i];
    const levelNum = i + 1;
    const levelName = LEVEL_DISPLAY_NAMES[levelId];

    test(`Level ${levelNum}: ${levelName}`, async ({ gamePage }) => {
      const { page } = gamePage;
      const governor = createGovernorController(page);
      const stateReader = createGameStateReader(page);

      // Start level tracking
      metricsTracker.startLevel(levelId);

      // For first level, we need to start the game
      // For subsequent levels, we should already be at the briefing
      if (i === 0) {
        // Skip briefing to start level
        await page.click('text=PROCEED', { timeout: 10000 }).catch(() => {
          // Briefing might auto-advance
        });
      } else {
        // Wait for briefing screen of this level
        await waitForPhase(page, 'briefing', 30000).catch(() => {
          // Might already be loading
        });
        await page.click('text=PROCEED', { timeout: 10000 }).catch(() => {
          // Briefing might auto-advance
        });
      }

      // Wait for level to become playable
      await waitForLevelPlayable(page, levelId, 120000);

      // Take screenshot at level start
      if (TEST_CONFIG.captureScreenshots) {
        await page.screenshot({
          path: path.join(
            TEST_CONFIG.screenshotDir,
            `${String(levelNum).padStart(2, '0')}-${levelId}-start.png`
          ),
        });
      }

      // Enable governor and start autonomous playthrough
      await governor.enable();
      await governor.configure({
        autoShoot: true,
        autoAdvanceDialogue: true,
        engagementRange: 50,
        logActions: true,
      });

      // Run level completion sequence
      await governor.completeLevelPlaythrough(levelId, TEST_CONFIG.levelTimeout);

      // Wait for level complete screen
      await waitForLevelComplete(page, 60000);

      // Get level stats
      const stats = await stateReader.getLevelStats();

      // Take screenshot of completion screen
      if (TEST_CONFIG.captureScreenshots) {
        await page.screenshot({
          path: path.join(
            TEST_CONFIG.screenshotDir,
            `${String(levelNum).padStart(2, '0')}-${levelId}-complete.png`
          ),
        });
      }

      // Record metrics
      metricsTracker.endLevel(stats, true);

      // Log level completion
      console.log(`[Level ${levelNum}] ${levelName} completed:`);
      console.log(`  Kills: ${stats.kills}`);
      console.log(`  Secrets: ${stats.secretsFound}/${stats.totalSecrets}`);
      console.log(`  Audio Logs: ${stats.audioLogsFound}/${stats.totalAudioLogs}`);

      // Verify level completion
      const phase = await stateReader.getCampaignPhase();
      expect(phase).toBe('levelComplete');

      // If not the final level, advance to next level
      if (i < CAMPAIGN_LEVEL_ORDER.length - 1) {
        await gamePage.advanceToNextLevel();
      }
    });
  }

  test('should roll credits after final level', async ({ gamePage }) => {
    const { page } = gamePage;
    const stateReader = createGameStateReader(page);

    // Advance from final level complete screen
    await page.click('text=CONTINUE', { timeout: 10000 });

    // Wait for credits to start
    await waitForCredits(page, 30000);

    // Take screenshot of credits
    if (TEST_CONFIG.captureScreenshots) {
      await page.screenshot({
        path: path.join(TEST_CONFIG.screenshotDir, '11-credits.png'),
      });
    }

    // Mark credits as rolled
    metricsTracker.markCreditsRolled();

    // Verify credits phase
    const phase = await stateReader.getCampaignPhase();
    expect(phase).toBe('credits');

    console.log('Credits rolled successfully');
  });

  test('should verify save system preserved progress', async ({ gamePage }) => {
    const { page } = gamePage;
    const stateReader = createGameStateReader(page);

    // Wait for credits to finish (or skip)
    await page.click('text=SKIP', { timeout: 10000 }).catch(() => {
      // Skip button might not exist
    });

    // Wait for menu
    await waitForPhase(page, 'menu', 30000);

    // Check save data exists
    const hasSave = await stateReader.hasSaveData();
    expect(hasSave).toBe(true);

    // Verify last save level is final_escape
    const lastLevel = await stateReader.getLastSaveLevel();
    expect(lastLevel).toBe('final_escape');

    console.log('Save system verification passed');
  });

  test('should verify achievements unlocked', async ({ gamePage }) => {
    const { page } = gamePage;
    const stateReader = createGameStateReader(page);

    // Get unlocked achievements
    const achievements = await stateReader.getUnlockedAchievements();

    // Record achievements
    for (const achievement of achievements) {
      metricsTracker.recordAchievement(achievement);
    }

    // Verify expected achievements
    // Tutorial completion achievement
    expect(achievements).toContain('tutorial_complete');

    // Campaign completion achievement
    expect(achievements).toContain('campaign_complete');

    console.log(`Achievements unlocked: ${achievements.length}`);
    console.log(achievements.join(', '));
  });
});

// Standalone test for individual level testing
test.describe('Individual Level Tests', () => {
  for (const levelId of CAMPAIGN_LEVEL_ORDER) {
    test.skip(`[SKIP] ${LEVEL_DISPLAY_NAMES[levelId]} - standalone`, async ({ gamePage }) => {
      const { page } = gamePage;
      const governor = createGovernorController(page);

      // This test is skipped by default but can be run individually
      // for debugging specific levels

      await gamePage.goto();
      await gamePage.waitForGameReady();

      // Use dev jump to go directly to level
      await page.evaluate((lvl) => {
        const w = window as unknown as {
          __STELLAR_DESCENT__?: {
            dispatch?: (cmd: { type: string; levelId: string }) => void;
          };
        };
        w.__STELLAR_DESCENT__?.dispatch?.({
          type: 'DEV_JUMP_TO_LEVEL',
          levelId: lvl,
        });
      }, levelId);

      // Wait for level to load
      await waitForLevelPlayable(page, levelId, 120000);

      // Run governor
      await governor.enable();
      await governor.completeLevelPlaythrough(levelId);

      // Verify completion
      await waitForLevelComplete(page, TEST_CONFIG.levelTimeout);
    });
  }
});

// Visual regression tests
test.describe('Visual Regression Tests', () => {
  test('main menu visual regression', async ({ gamePage }) => {
    await gamePage.goto();
    await gamePage.waitForGameReady();

    // Wait for menu to fully render
    await gamePage.waitForPhase('menu', 30000);

    await gamePage.captureVisualRegression('main-menu', { threshold: 0.1 });
  });

  test('HUD visual regression', async ({ gamePage }) => {
    const { page } = gamePage;

    await gamePage.goto();
    await gamePage.waitForGameReady();

    // Start game and get to gameplay
    await gamePage.startNewGame('normal');

    // Skip to gameplay
    await page.click('text=PROCEED', { timeout: 10000 }).catch(() => {});
    await waitForLevelPlayable(page, 'anchor_station', 120000);

    // Wait a moment for HUD to stabilize
    await page.waitForTimeout(2000);

    await gamePage.captureVisualRegression('hud-anchor-station', {
      threshold: 0.15,
    });
  });

  test('pause menu visual regression', async ({ gamePage }) => {
    const { page } = gamePage;

    await gamePage.goto();
    await gamePage.waitForGameReady();
    await gamePage.startNewGame('normal');

    await page.click('text=PROCEED', { timeout: 10000 }).catch(() => {});
    await waitForLevelPlayable(page, 'anchor_station', 120000);

    // Pause the game
    await gamePage.pauseGame();

    await gamePage.captureVisualRegression('pause-menu', { threshold: 0.1 });
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  test('should maintain 30+ FPS during gameplay', async ({ gamePage }) => {
    const { page } = gamePage;
    const stateReader = createGameStateReader(page);
    const governor = createGovernorController(page);

    await gamePage.goto();
    await gamePage.waitForGameReady();
    await gamePage.startNewGame('normal');

    await page.click('text=PROCEED', { timeout: 10000 }).catch(() => {});
    await waitForLevelPlayable(page, 'anchor_station', 120000);

    // Enable governor for gameplay
    await governor.enable();
    await governor.setGoal({ type: 'engage_enemies', params: { aggressive: true } });

    // Sample FPS over 30 seconds
    const fpsReadings: number[] = [];
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const fps = await stateReader.getFPS();
      fpsReadings.push(fps);
    }

    // Calculate average FPS
    const avgFPS = fpsReadings.reduce((a, b) => a + b, 0) / fpsReadings.length;
    const minFPS = Math.min(...fpsReadings);

    console.log(`FPS: avg=${avgFPS.toFixed(1)}, min=${minFPS.toFixed(1)}`);

    // Assert minimum FPS threshold
    expect(avgFPS).toBeGreaterThan(30);
    expect(minFPS).toBeGreaterThan(20);
  });
});

// Save system tests
test.describe('Save System Tests', () => {
  test('should auto-save after level completion', async ({ gamePage }) => {
    const { page } = gamePage;
    const governor = createGovernorController(page);
    const stateReader = createGameStateReader(page);

    await gamePage.goto();
    await gamePage.waitForGameReady();
    await gamePage.startNewGame('normal');

    await page.click('text=PROCEED', { timeout: 10000 }).catch(() => {});
    await waitForLevelPlayable(page, 'anchor_station', 120000);

    // Complete tutorial level
    await governor.enable();
    await governor.completeLevelPlaythrough('anchor_station', 600000);
    await waitForLevelComplete(page, 60000);

    // Verify save data exists
    const hasSave = await stateReader.hasSaveData();
    expect(hasSave).toBe(true);

    const lastLevel = await stateReader.getLastSaveLevel();
    expect(lastLevel).toBe('anchor_station');
  });

  test('should load saved game correctly', async ({ gamePage }) => {
    const { page } = gamePage;
    const stateReader = createGameStateReader(page);

    await gamePage.goto();
    await gamePage.waitForGameReady();

    // Should have CONTINUE button if save exists
    const continueBtn = page.getByText('CONTINUE');
    const isVisible = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await gamePage.continueGame();

      // Verify we loaded at the right level
      const currentLevel = await stateReader.getCurrentLevelId();
      expect(CAMPAIGN_LEVEL_ORDER).toContain(currentLevel);

      console.log(`Loaded save at level: ${currentLevel}`);
    } else {
      console.log('No save data found - skipping load test');
    }
  });
});
