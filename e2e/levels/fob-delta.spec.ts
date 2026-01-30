/**
 * E2E Test: FOB Delta (Level 3 - Horror/Investigation)
 *
 * Tests the abandoned base exploration:
 * - Dark atmosphere with flickering lights
 * - 6 areas: Perimeter, Courtyard, Barracks, Command Center, Vehicle Bay, Underground
 * - Terminal interaction for mission logs
 * - Ambush trigger
 * - Discovery of Marcus's damaged mech
 */

import { expect, test } from '@playwright/test';
import { PlayerGovernor } from '../utils/PlayerGovernor';

test.describe('Level 3: FOB Delta', () => {
  let player: PlayerGovernor;

  test.beforeEach(async ({ page }) => {
    player = new PlayerGovernor(page, 'fob-delta', {
      screenshotDir: 'e2e/screenshots/fob-delta',
    });
  });

  test('should load FOB Delta level directly', async ({ page }) => {
    await player.goToLevel('fob_delta');
    await player.screenshot('level-loaded');

    // Should see canvas
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('perimeter area entry', async ({ page }) => {
    await player.goToLevel('fob_delta');

    // Wait for level to initialize
    await player.wait(2000);
    await player.screenshot('perimeter-entry');

    // Check for objective
    const hasObjective = await player.hasText(/PERIMETER|INVESTIGATE|FOB/i);
    await player.screenshot('perimeter-objective');

    // Move through breached barriers
    await player.moveForward(2000);
    await player.screenshot('moving-through-perimeter');
  });

  test('flashlight toggle in dark areas', async ({ page }) => {
    await player.goToLevel('fob_delta');

    await player.wait(2000);
    await player.screenshot('dark-environment');

    // Toggle flashlight
    await player.toggleFlashlight();
    await player.wait(500);
    await player.screenshot('flashlight-on');

    await player.toggleFlashlight();
    await player.wait(500);
    await player.screenshot('flashlight-off');
  });

  test('scanner detection system', async ({ page }) => {
    await player.goToLevel('fob_delta');

    await player.wait(2000);

    // Use scanner
    await player.useScanner();
    await player.wait(1000);
    await player.screenshot('scanner-active');

    // Move and scan again
    await player.moveForward(1500);
    await player.useScanner();
    await player.wait(1000);
    await player.screenshot('scanner-detecting');
  });

  test('courtyard exploration', async ({ page }) => {
    await player.goToLevel('fob_delta');

    await player.wait(2000);

    // Move to courtyard
    await player.moveForward(3000);
    await player.screenshot('courtyard-entry');

    // Look around at debris
    await player.lookLeft(100);
    await player.screenshot('courtyard-debris-left');

    await player.lookRight(200);
    await player.screenshot('courtyard-debris-right');
  });

  test('command center terminal interaction', async ({ page }) => {
    await player.goToLevel('fob_delta');

    await player.wait(2000);

    // Navigate to command center
    await player.moveForward(4000);
    await player.lookLeft(50);
    await player.moveForward(2000);
    await player.screenshot('command-center-approach');

    // Look for terminal
    const hasTerminal = await player.hasText(/TERMINAL|INTERACT|LOG/i);
    await player.screenshot('near-terminal');

    // Interact with terminal
    await player.interact();
    await player.wait(1000);
    await player.screenshot('terminal-accessed');

    // Advance through logs
    await player.dismissComms();
    await player.wait(500);
    await player.screenshot('log-entry');
  });

  test('vehicle bay and mech discovery', async ({ page }) => {
    await player.goToLevel('fob_delta');

    await player.wait(2000);

    // Navigate through base to vehicle bay
    await player.moveForward(5000);
    await player.screenshot('approaching-vehicle-bay');

    // Enter vehicle bay
    await player.lookRight(30);
    await player.moveForward(2000);
    await player.screenshot('vehicle-bay-entry');

    // Look for Marcus's mech
    const hasMech = await player.hasText(/MECH|TITAN|MARCUS/i);
    await player.screenshot('mech-discovery');
  });

  test('ambush trigger and combat', async ({ page }) => {
    await player.goToLevel('fob_delta');

    await player.wait(2000);

    // Move to trigger ambush (after terminal)
    await player.moveForward(6000);
    await player.screenshot('pre-ambush');

    // Check for combat state
    const hasCombat = await player.hasText(/HOSTILE|CONTACT|AMBUSH/i);
    await player.screenshot('ambush-triggered');

    if (hasCombat) {
      // Combat response
      await player.fire();
      await player.moveBackward(500);
      await player.fire();
      await player.screenshot('combat-response');
    }
  });

  test('full level playthrough', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    await player.goToLevel('fob_delta');
    await player.screenshot('01-start');

    // Perimeter
    await player.wait(2000);
    await player.toggleFlashlight();
    await player.screenshot('02-flashlight-on');

    await player.moveForward(2000);
    await player.screenshot('03-perimeter');

    // Courtyard
    await player.moveForward(2000);
    await player.useScanner();
    await player.wait(500);
    await player.screenshot('04-courtyard');

    // Explore buildings
    await player.lookLeft(90);
    await player.moveForward(1500);
    await player.screenshot('05-barracks');

    await player.lookRight(180);
    await player.moveForward(2000);
    await player.screenshot('06-command-center');

    // Terminal
    await player.interact();
    await player.wait(1000);
    await player.screenshot('07-terminal');
    await player.advanceThroughAllComms(3);

    // Vehicle bay
    await player.moveForward(2500);
    await player.screenshot('08-vehicle-bay');

    // Underground access
    await player.moveForward(1500);
    await player.interact();
    await player.wait(500);
    await player.screenshot('09-underground-access');

    await player.screenshot('10-level-complete');
  });
});
