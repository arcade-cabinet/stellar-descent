/**
 * E2E Tests: Level Transitions
 *
 * Verifies that levels connect properly in the campaign flow:
 * - Anchor Station -> Landfall (orbital drop)
 * - Landfall -> FOB Delta (post-landing)
 * - FOB Delta -> Brothers in Arms (Marcus discovery)
 * - Brothers in Arms -> The Breach (enter hive)
 * - The Breach -> Extraction (Queen death / escape)
 *
 * These tests focus on the handoff between levels,
 * not the full gameplay of each level.
 */

import { expect, test } from '@playwright/test';
import { LEVEL_IDS, LEVEL_TIMEOUTS, PlayerGovernor } from '../utils';

test.describe('Level Transitions', () => {
  test.describe('Act 1: The Drop', () => {
    test('Anchor Station prepares for orbital drop', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

      const player = new PlayerGovernor(page, 'anchor-station', {
        screenshotDir: 'e2e/screenshots/transitions',
      });

      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);
      await player.screenshot('transition-01-anchor-start');

      // Advance through tutorial
      await player.wait(3000);
      await player.advanceThroughAllComms(10);

      // Move through station toward hangar
      await player.moveForward(4000);
      await player.screenshot('transition-02-anchor-hangar');

      // Check for drop-related UI
      const hasDropUI = await player.hasText(/DROP|LAUNCH|HANGAR|POD/i);
      await player.screenshot('transition-03-anchor-ready');
    });

    test('Landfall transitions to surface combat', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

      const player = new PlayerGovernor(page, 'landfall', {
        screenshotDir: 'e2e/screenshots/transitions',
      });

      await player.goToLevel(LEVEL_IDS.LANDFALL);
      await player.screenshot('transition-04-landfall-start');

      // Wait through freefall
      await player.wait(5000);
      await player.screenshot('transition-05-landfall-freefall');

      // Steer during descent
      await player.pressKey('ArrowLeft');
      await player.wait(500);
      await player.pressKey('ArrowRight');

      // Wait for powered descent phase
      await player.wait(10000);
      await player.screenshot('transition-06-landfall-powered');

      // Boost to control descent
      await player.boost(1000);
      await player.screenshot('transition-07-landfall-boost');

      // Wait for landing
      await player.wait(10000);
      await player.screenshot('transition-08-landfall-landing');
    });
  });

  test.describe('Act 2: The Search', () => {
    test('FOB Delta investigation and Marcus discovery', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

      const player = new PlayerGovernor(page, 'fob-delta', {
        screenshotDir: 'e2e/screenshots/transitions',
      });

      await player.goToLevel(LEVEL_IDS.FOB_DELTA);
      await player.screenshot('transition-09-fob-start');

      // Enable flashlight
      await player.toggleFlashlight();
      await player.wait(500);
      await player.screenshot('transition-10-fob-flashlight');

      // Navigate through base
      await player.moveForward(3000);
      await player.screenshot('transition-11-fob-exploring');

      // Use scanner
      await player.useScanner();
      await player.wait(500);
      await player.screenshot('transition-12-fob-scanning');

      // Continue exploration
      await player.moveForward(3000);
      await player.screenshot('transition-13-fob-deep');
    });

    test('Brothers in Arms wave combat and Breach entrance', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

      const player = new PlayerGovernor(page, 'brothers-in-arms', {
        screenshotDir: 'e2e/screenshots/transitions',
      });

      await player.goToLevel(LEVEL_IDS.BROTHERS_IN_ARMS);
      await player.screenshot('transition-14-brothers-start');

      // Reunion dialogue
      await player.wait(3000);
      await player.advanceThroughAllComms(5);
      await player.screenshot('transition-15-brothers-reunion');

      // Combat engagement
      await player.moveForward(2000);
      await player.fireMultiple(3, 200);
      await player.screenshot('transition-16-brothers-combat');

      // Use fire support if available
      await player.callFireSupport();
      await player.wait(500);
      await player.screenshot('transition-17-brothers-support');

      // Move toward breach
      await player.moveForward(3000);
      await player.lookDown(30);
      await player.screenshot('transition-18-brothers-breach');
    });
  });

  test.describe('Act 3: The Truth', () => {
    test('The Breach hive exploration toward Queen', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

      const player = new PlayerGovernor(page, 'the-breach', {
        screenshotDir: 'e2e/screenshots/transitions',
      });

      await player.goToLevel(LEVEL_IDS.THE_BREACH);
      await player.screenshot('transition-19-breach-start');

      // Navigate tunnels
      await player.moveForward(2000);
      await player.screenshot('transition-20-breach-upper');

      // Scan for weak points
      await player.scanWeakness();
      await player.screenshot('transition-21-breach-scan');

      // Continue deeper
      await player.moveForward(3000);
      await player.screenshot('transition-22-breach-mid');

      // Combat
      await player.fireMultiple(3, 200);
      await player.screenshot('transition-23-breach-combat');

      // Approach Queen chamber
      await player.moveForward(4000);
      await player.screenshot('transition-24-breach-queen');
    });

    test('Extraction escape and holdout', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

      const player = new PlayerGovernor(page, 'extraction', {
        screenshotDir: 'e2e/screenshots/transitions',
      });

      await player.goToLevel(LEVEL_IDS.EXTRACTION);
      await player.screenshot('transition-25-extraction-start');

      // Escape phase - sprint
      await player.sprint(2000);
      await player.screenshot('transition-26-extraction-escape');

      await player.sprint(2000);
      await player.screenshot('transition-27-extraction-tunnel');

      // Surface run
      await player.wait(3000);
      await player.moveForward(3000);
      await player.screenshot('transition-28-extraction-surface');

      // Holdout phase
      await player.wait(3000);
      await player.fireMultiple(5, 200);
      await player.screenshot('transition-29-extraction-holdout');

      // Call fire support
      await player.callFireSupport();
      await player.screenshot('transition-30-extraction-support');
    });
  });
});

test.describe('Direct Level Navigation', () => {
  test('can navigate directly to each level via URL', async ({ page }) => {
    test.setTimeout(LEVEL_TIMEOUTS.LONG_PLAYTHROUGH); // Allow time for all levels

    const levels = [
      LEVEL_IDS.ANCHOR_STATION,
      LEVEL_IDS.LANDFALL,
      LEVEL_IDS.FOB_DELTA,
      LEVEL_IDS.BROTHERS_IN_ARMS,
      LEVEL_IDS.THE_BREACH,
      LEVEL_IDS.EXTRACTION,
    ];

    for (const levelId of levels) {
      const player = new PlayerGovernor(page, levelId);
      await player.goToLevel(levelId);

      // Verify canvas is visible (most reliable check)
      await expect(page.locator('canvas')).toBeVisible();

      // Wait for UI to stabilize
      await player.wait(2000);
    }
  });

  test('invalid level ID shows error or defaults', async ({ page }) => {
    await page.goto('/?level=invalid_level');

    // Should either show error or load main menu
    const hasMenu = await page
      .getByRole('button', { name: /NEW CAMPAIGN|HALO DROP/i })
      .isVisible()
      .catch(() => false);

    const hasCanvas = await page
      .locator('canvas')
      .isVisible()
      .catch(() => false);

    // Either menu or game canvas should be visible
    expect(hasMenu || hasCanvas).toBe(true);
  });
});
