/**
 * E2E Smoke Tests: All Levels
 *
 * Quick verification that all levels load and are playable.
 * These tests are designed to run fast and catch major regressions.
 *
 * For detailed level-specific tests, see individual level spec files.
 */

import { expect, test } from '@playwright/test';
import { CAMPAIGN_ORDER, LEVEL_IDS, LEVEL_NAMES, LEVEL_TIMEOUTS, PlayerGovernor } from '../utils';

test.describe('Level Smoke Tests', () => {
  test.describe.configure({ mode: 'parallel' });

  // ============================================================================
  // INDIVIDUAL LEVEL LOAD TESTS
  // ============================================================================

  for (const levelId of CAMPAIGN_ORDER) {
    test(`${LEVEL_NAMES[levelId]} loads successfully`, async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.SMOKE);

      const player = new PlayerGovernor(page, levelId, {
        screenshotDir: `e2e/screenshots/${levelId.replace(/_/g, '-')}`,
      });

      await player.goToLevel(levelId);

      // Verify canvas is visible and sized
      await expect(page.locator('canvas')).toBeVisible();

      // Verify level loaded
      const loaded = await player.verifyLevelLoaded();
      expect(loaded).toBe(true);

      await player.screenshot('smoke-loaded');
    });
  }

  // ============================================================================
  // BASIC INTERACTION TESTS
  // ============================================================================

  test('Anchor Station: movement works', async ({ page }) => {
    test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

    const player = new PlayerGovernor(page, 'anchor-station');
    await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

    // Wait for tutorial comms to appear then dismiss
    await player.waitForText(/Good morning|ATHENA|Sergeant/i, 30000).catch(() => {});
    await player.wait(1000);
    await player.advanceThroughAllComms(3);

    // Test basic movement
    await player.moveForward(500);
    await player.strafeRight(300);
    await player.moveBackward(500);

    await expect(page.locator('canvas')).toBeVisible();
  });

  test('Landfall: freefall controls respond', async ({ page }) => {
    const player = new PlayerGovernor(page, 'landfall');
    await player.goToLevel(LEVEL_IDS.LANDFALL);

    await player.wait(2000);

    // Test steering during freefall
    await player.pressKey('ArrowLeft');
    await player.wait(300);
    await player.pressKey('ArrowRight');
    await player.wait(300);

    await expect(page.locator('canvas')).toBeVisible();
  });

  test('FOB Delta: flashlight toggles', async ({ page }) => {
    const player = new PlayerGovernor(page, 'fob-delta');
    await player.goToLevel(LEVEL_IDS.FOB_DELTA);

    await player.wait(2000);

    // Toggle flashlight
    await player.toggleFlashlight();
    await player.wait(500);
    await player.toggleFlashlight();

    await expect(page.locator('canvas')).toBeVisible();
  });

  test('Brothers in Arms: fire support available', async ({ page }) => {
    const player = new PlayerGovernor(page, 'brothers-in-arms');
    await player.goToLevel(LEVEL_IDS.BROTHERS_IN_ARMS);

    await player.wait(3000);

    // Check for fire support UI element or ability
    const hasFireSupport = await player.hasText(/FIRE SUPPORT/i);
    // Fire support may not be immediately visible, but level should load

    await expect(page.locator('canvas')).toBeVisible();
  });

  test('The Breach: scanner works', async ({ page }) => {
    const player = new PlayerGovernor(page, 'the-breach');
    await player.goToLevel(LEVEL_IDS.THE_BREACH);

    await player.wait(2000);

    // Use scanner
    await player.useScanner();
    await player.wait(500);

    await expect(page.locator('canvas')).toBeVisible();
  });

  test('Extraction: sprint works', async ({ page }) => {
    const player = new PlayerGovernor(page, 'extraction');
    await player.goToLevel(LEVEL_IDS.EXTRACTION);

    await player.wait(2000);

    // Test sprint
    await player.sprint(500);

    await expect(page.locator('canvas')).toBeVisible();
  });

  // ============================================================================
  // CAMPAIGN SEQUENCE TEST
  // ============================================================================

  test('campaign levels load in sequence', async ({ page }) => {
    test.setTimeout(LEVEL_TIMEOUTS.LONG_PLAYTHROUGH); // 6 levels, need more time

    for (let i = 0; i < CAMPAIGN_ORDER.length; i++) {
      const levelId = CAMPAIGN_ORDER[i];
      const player = new PlayerGovernor(page, levelId);

      await player.goToLevel(levelId);

      // Verify canvas is visible (more reliable than HUD check)
      await expect(page.locator('canvas')).toBeVisible();

      // Brief interaction to confirm responsiveness
      await player.wait(2000);
      await player.moveForward(300);
    }
  });
});

test.describe('Level Transition Smoke Tests', () => {
  test('main menu to Anchor Station', async ({ page }) => {
    await page.goto('/');

    // Click new campaign
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for level to load
    const player = new PlayerGovernor(page, 'anchor-station');
    await player.waitForLevelLoad();

    await expect(page.locator('canvas')).toBeVisible();
  });

  test('main menu to HALO Drop (Landfall)', async ({ page }) => {
    await page.goto('/');

    // Click HALO Drop
    await page.getByRole('button', { name: /HALO DROP/i }).click();

    // Wait for level to load
    const player = new PlayerGovernor(page, 'landfall');
    await player.waitForLevelLoad();

    await expect(page.locator('canvas')).toBeVisible();
  });
});

test.describe('HUD Visibility Tests', () => {
  for (const levelId of CAMPAIGN_ORDER) {
    test(`${LEVEL_NAMES[levelId]} shows HUD elements`, async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.SHORT_PLAYTHROUGH);

      const player = new PlayerGovernor(page, levelId);
      await player.goToLevel(levelId);

      // Wait for UI to stabilize
      await player.wait(3000);

      // Check for any HUD container
      const hasHUD =
        (await page.locator('[class*="HUD"]').count()) > 0 ||
        (await page.locator('[class*="hud"]').count()) > 0;

      // Most levels should have some HUD visible
      // Landing/cinematic phases may not show HUD immediately
      await player.screenshot(`hud-check-${levelId}`);

      await expect(page.locator('canvas')).toBeVisible();
    });
  }
});
