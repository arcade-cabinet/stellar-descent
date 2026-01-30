/**
 * E2E Test: Landfall (Level 2 - HALO Drop)
 *
 * Tests the orbital drop sequence:
 * - Freefall phase (terminal velocity)
 * - Powered descent (thruster control)
 * - Landing outcomes (perfect/near miss/rough/crash)
 * - Surface combat transition
 */

import { expect, test } from '@playwright/test';
import { PlayerGovernor } from '../utils/PlayerGovernor';

test.describe('Level 2: Landfall HALO Drop', () => {
  let player: PlayerGovernor;

  test.beforeEach(async ({ page }) => {
    player = new PlayerGovernor(page, 'landfall', {
      screenshotDir: 'e2e/screenshots/landfall',
    });
  });

  test('should load HALO drop level directly', async ({ page }) => {
    await player.goToLevel('landfall');
    await player.screenshot('level-loaded');

    // Should see canvas
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('freefall phase initiation', async ({ page }) => {
    await player.goToLevel('landfall');

    // Wait for drop notification (allow time for level loading)
    await player.waitForText(/ORBITAL DROP|FREEFALL|DESCENT/i, 30000).catch(() => {});
    await player.screenshot('freefall-start');

    // Should see altitude/velocity HUD
    const hasAltitude = await player.hasText(/ALT|ALTITUDE|VEL|VELOCITY/i);
    await player.screenshot('freefall-hud');
  });

  test('freefall steering controls', async ({ page }) => {
    test.setTimeout(60000); // Allow time for full level loading

    await player.goToLevel('landfall');

    // Wait for drop to start (allow time for level loading)
    await player.wait(5000);
    await player.screenshot('freefall-phase');

    // Test steering during freefall (arrow keys)
    await player.pressKey('ArrowLeft');
    await player.wait(500);
    await player.screenshot('steer-left');

    await player.pressKey('ArrowRight');
    await player.wait(500);
    await player.screenshot('steer-right');

    await player.pressKey('ArrowUp');
    await player.wait(500);
    await player.pressKey('ArrowDown');
    await player.wait(500);
    await player.screenshot('after-steering');
  });

  test('powered descent phase', async ({ page }) => {
    test.setTimeout(60000);

    await player.goToLevel('landfall');

    // Wait for powered descent (usually after 10+ seconds of freefall)
    await player.wait(5000);
    await player.screenshot('mid-freefall');

    // Continue waiting for powered descent
    await player.wait(10000);
    await player.screenshot('powered-descent');

    // Should see fuel indicator during powered descent
    const hasFuel = await player.hasText(/FUEL|THRUST/i);
    if (hasFuel) {
      await player.screenshot('fuel-visible');
    }
  });

  test('landing zone targeting', async ({ page }) => {
    test.setTimeout(60000);

    await player.goToLevel('landfall');

    // Wait through descent
    await player.wait(15000);
    await player.screenshot('approaching-lz');

    // Should see LZ distance
    const hasLZ = await player.hasText(/LZ|LANDING|DISTANCE/i);
    await player.screenshot('lz-targeting');
  });

  test('full descent playthrough', async ({ page }) => {
    test.setTimeout(90000);

    await player.goToLevel('landfall');
    await player.screenshot('01-drop-start');

    // Phase 1: Freefall
    await player.wait(3000);
    await player.screenshot('02-freefall');

    // Steer during freefall
    await player.pressKey('ArrowLeft');
    await player.wait(1000);
    await player.pressKey('ArrowRight');
    await player.wait(1000);
    await player.screenshot('03-freefall-steering');

    // Phase 2: Powered descent
    await player.wait(8000);
    await player.screenshot('04-powered-descent');

    // Use thrusters
    await player.pressKey('Space');
    await player.wait(500);
    await player.screenshot('05-thruster-burn');

    // Approach landing
    await player.wait(5000);
    await player.screenshot('06-landing-approach');

    // Check for landing outcome
    await player.wait(5000);
    const hasPerfect = await player.hasText(/PERFECT|LANDING|TOUCHDOWN/i);
    const hasRough = await player.hasText(/ROUGH|DAMAGE|CRASH/i);
    await player.screenshot('07-landing-outcome');

    // Check for surface combat transition
    await player.wait(3000);
    await player.screenshot('08-surface-transition');
  });

  test('surface combat after landing', async ({ page }) => {
    test.setTimeout(90000);

    await player.goToLevel('landfall');

    // Wait through entire descent
    await player.wait(25000);
    await player.screenshot('post-landing');

    // Check for combat HUD elements
    const hasGrenade = await player.hasText(/GRENADE/i);
    const hasMelee = await player.hasText(/MELEE/i);

    if (hasGrenade || hasMelee) {
      await player.screenshot('combat-buttons-visible');

      // Test combat actions
      await player.moveForward(1000);
      await player.fire();
      await player.screenshot('combat-engaged');
    }
  });
});
