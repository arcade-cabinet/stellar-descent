/**
 * E2E Test: Brothers in Arms (Level 4 - Mech Ally Combat)
 *
 * Tests the reunion with Marcus and wave combat:
 * - Emotional reunion cutscene
 * - Marcus's TITAN mech as AI ally
 * - 4-wave combat system
 * - FIRE SUPPORT ability
 * - Canyon arena environment
 * - The Breach discovery
 */

import { expect, test } from '@playwright/test';
import { PlayerGovernor } from '../utils/PlayerGovernor';

test.describe('Level 4: Brothers in Arms', () => {
  let player: PlayerGovernor;

  test.beforeEach(async ({ page }) => {
    player = new PlayerGovernor(page, 'brothers-in-arms', {
      screenshotDir: 'e2e/screenshots/brothers-in-arms',
    });
  });

  test('should load Brothers in Arms level directly', async ({ page }) => {
    await player.goToLevel('brothers_in_arms');
    await player.screenshot('level-loaded');

    // Should see canvas
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('reunion with Marcus', async ({ page }) => {
    await player.goToLevel('brothers_in_arms');

    // Wait for level to initialize
    await player.wait(3000);
    await player.screenshot('level-start');

    // Wait for Marcus dialogue
    await player.waitForText(/James|Marcus|came|brother/i, 10000).catch(() => {});
    await player.screenshot('marcus-greeting');

    // Advance through reunion dialogue
    await player.advanceThroughAllComms(5);
    await player.screenshot('after-reunion');
  });

  test('Marcus mech visibility', async ({ page }) => {
    await player.goToLevel('brothers_in_arms');

    await player.wait(3000);
    await player.screenshot('mech-in-view');

    // Look around to find mech
    await player.lookLeft(90);
    await player.screenshot('look-left');

    await player.lookRight(180);
    await player.screenshot('look-right');
  });

  test('fire support command', async ({ page }) => {
    await player.goToLevel('brothers_in_arms');

    await player.wait(3000);

    // Check for FIRE SUPPORT button
    const hasFireSupport = await player.hasText(/FIRE SUPPORT/i);
    await player.screenshot('fire-support-available');

    if (hasFireSupport) {
      // Call fire support
      await player.callFireSupport();
      await player.wait(1000);
      await player.screenshot('fire-support-active');
    }
  });

  test('wave 1 combat - drones', async ({ page }) => {
    await player.goToLevel('brothers_in_arms');

    // Skip through intro
    await player.wait(3000);
    await player.advanceThroughAllComms(5);

    // Wait for wave 1
    await player.waitForText(/WAVE|INCOMING|DRONES/i, 10000).catch(() => {});
    await player.screenshot('wave-1-start');

    // Combat engagement
    await player.fire();
    await player.moveForward(500);
    await player.fire();
    await player.screenshot('wave-1-combat');

    // Use grenade
    await player.throwGrenade();
    await player.wait(500);
    await player.screenshot('grenade-thrown');
  });

  test('canyon arena navigation', async ({ page }) => {
    await player.goToLevel('brothers_in_arms');

    await player.wait(3000);
    await player.screenshot('canyon-overview');

    // Navigate around rock pillars
    await player.moveForward(2000);
    await player.screenshot('near-pillar-1');

    await player.strafeRight(1000);
    await player.screenshot('strafing');

    await player.moveForward(1500);
    await player.screenshot('deep-in-canyon');
  });

  test('full wave combat playthrough', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    await player.goToLevel('brothers_in_arms');
    await player.screenshot('01-start');

    // Reunion
    await player.wait(3000);
    await player.screenshot('02-reunion');
    await player.advanceThroughAllComms(5);

    // Wave 1
    await player.wait(5000);
    await player.screenshot('03-wave-1');
    await player.fireMultiple(5, 200);
    await player.moveForward(1000);
    await player.fireMultiple(5, 200);
    await player.screenshot('04-wave-1-combat');

    // Wave 2
    await player.wait(10000);
    await player.screenshot('05-wave-2');
    await player.throwGrenade();
    await player.fireMultiple(8, 150);
    await player.callFireSupport();
    await player.screenshot('06-wave-2-combat');

    // Wave 3
    await player.wait(15000);
    await player.screenshot('07-wave-3');
    await player.moveBackward(500);
    await player.fireMultiple(10, 100);
    await player.screenshot('08-wave-3-combat');

    // Wave 4 (final)
    await player.wait(15000);
    await player.screenshot('09-wave-4');
    await player.callFireSupport();
    await player.fireMultiple(15, 100);
    await player.throwGrenade();
    await player.screenshot('10-wave-4-combat');

    // Breach discovery
    await player.wait(5000);
    await player.moveForward(3000);
    await player.screenshot('11-breach-discovery');

    await player.screenshot('12-level-complete');
  });

  test('The Breach entrance', async ({ page }) => {
    await player.goToLevel('brothers_in_arms');

    await player.wait(3000);

    // Navigate toward The Breach
    await player.moveForward(5000);
    await player.screenshot('approaching-breach');

    // Look for breach entrance
    await player.lookDown(30);
    await player.screenshot('breach-view');

    // Check for transition prompt
    const hasTransition = await player.hasText(/ENTER|BREACH|DESCEND|TUNNEL/i);
    await player.screenshot('breach-entrance');
  });
});
