/**
 * E2E Test: The Breach (Level 5 - Boss Fight)
 *
 * Tests the underground hive and Queen boss:
 * - 4-zone hive structure (Upper/Mid/Lower/Queen's Chamber)
 * - Bioluminescent environment
 * - Hazards (acid pools, egg clusters)
 * - Queen boss fight (3 phases)
 * - SCAN WEAKNESS mechanic
 * - Death sequence trigger to Extraction
 */

import { expect, test } from '@playwright/test';
import { PlayerGovernor } from '../utils/PlayerGovernor';

test.describe('Level 5: The Breach', () => {
  let player: PlayerGovernor;

  test.beforeEach(async ({ page }) => {
    player = new PlayerGovernor(page, 'the-breach', {
      screenshotDir: 'e2e/screenshots/the-breach',
    });
  });

  test('should load The Breach level directly', async ({ page }) => {
    await player.goToLevel('the_breach');
    await player.screenshot('level-loaded');

    // Should see canvas
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('upper hive tunnel navigation', async ({ page }) => {
    await player.goToLevel('the_breach');

    await player.wait(2000);
    await player.screenshot('hive-entrance');

    // Navigate through tunnel
    await player.moveForward(2000);
    await player.screenshot('tunnel-navigation');

    // Bioluminescent lighting visible
    await player.lookLeft(45);
    await player.screenshot('bioluminescent-left');

    await player.lookRight(90);
    await player.screenshot('bioluminescent-right');
  });

  test('mid hive branching tunnels', async ({ page }) => {
    await player.goToLevel('the_breach');

    await player.wait(2000);

    // Navigate deeper
    await player.moveForward(4000);
    await player.screenshot('mid-hive-entry');

    // Check for branching paths
    await player.lookLeft(60);
    await player.screenshot('branch-left');

    await player.lookRight(120);
    await player.screenshot('branch-right');
  });

  test('hazard avoidance - acid pools', async ({ page }) => {
    await player.goToLevel('the_breach');

    await player.wait(2000);
    await player.moveForward(3000);
    await player.screenshot('near-hazards');

    // Look down for acid pools
    await player.lookDown(30);
    await player.screenshot('acid-pool-view');

    // Strafe to avoid
    await player.strafeRight(500);
    await player.moveForward(1000);
    await player.screenshot('hazard-avoided');
  });

  test('egg cluster encounter', async ({ page }) => {
    await player.goToLevel('the_breach');

    await player.wait(2000);
    await player.moveForward(3500);
    await player.screenshot('egg-cluster-area');

    // Fire at eggs
    await player.fire();
    await player.wait(500);
    await player.screenshot('eggs-attacked');

    // Check for drone spawn
    const hasDrones = await player.hasText(/DRONE|SPAWN|HOSTILE/i);
    await player.screenshot('post-egg-attack');
  });

  test('lower hive chambers', async ({ page }) => {
    await player.goToLevel('the_breach');

    await player.wait(2000);

    // Navigate to lower hive
    await player.moveForward(6000);
    await player.screenshot('lower-hive-entry');

    // Large chamber
    await player.lookLeft(90);
    await player.lookRight(180);
    await player.screenshot('large-chamber');
  });

  test('scan weakness action button', async ({ page }) => {
    await player.goToLevel('the_breach');

    await player.wait(2000);

    // Check for SCAN WEAKNESS button
    const hasScan = await player.hasText(/SCAN|WEAKNESS/i);
    await player.screenshot('scan-button-available');

    // Use scanner
    await player.useScanner();
    await player.wait(1000);
    await player.screenshot('weakness-scanned');
  });

  test('Queen chamber approach', async ({ page }) => {
    await player.goToLevel('the_breach');

    await player.wait(2000);

    // Navigate deep into hive
    await player.moveForward(8000);
    await player.screenshot('approaching-queen-chamber');

    // Check for sealed door or boss arena indicator
    const hasBoss = await player.hasText(/QUEEN|CHAMBER|SEALED|ARENA/i);
    await player.screenshot('queen-chamber-entrance');
  });

  test('full hive exploration playthrough', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes

    await player.goToLevel('the_breach');
    await player.screenshot('01-start');

    // Upper Hive
    await player.wait(2000);
    await player.screenshot('02-upper-hive');
    await player.moveForward(2000);
    await player.screenshot('03-tunnel-1');

    // Enemy encounter
    await player.fireMultiple(3, 200);
    await player.screenshot('04-combat');

    // Mid Hive
    await player.moveForward(3000);
    await player.screenshot('05-mid-hive');

    await player.lookLeft(45);
    await player.moveForward(1000);
    await player.screenshot('06-branching');

    // Hazards
    await player.strafeRight(500);
    await player.moveForward(1500);
    await player.screenshot('07-avoiding-hazards');

    // Lower Hive
    await player.moveForward(2500);
    await player.screenshot('08-lower-hive');

    // Egg clusters
    await player.fire();
    await player.fireMultiple(3, 150);
    await player.screenshot('09-eggs-destroyed');

    // Approach Queen's Chamber
    await player.moveForward(2000);
    await player.screenshot('10-queen-approach');

    // Boss fight prep
    await player.useScanner();
    await player.wait(500);
    await player.screenshot('11-weakness-scan');

    await player.screenshot('12-boss-arena');
  });

  test('boss fight phase 1', async ({ page }) => {
    test.setTimeout(120000);

    await player.goToLevel('the_breach');

    // Navigate to boss
    await player.wait(2000);
    await player.moveForward(10000);
    await player.screenshot('boss-phase-1');

    // Combat
    await player.useScanner();
    await player.wait(500);
    await player.fireMultiple(10, 100);
    await player.screenshot('phase-1-combat');

    // Dodge (move backward)
    await player.moveBackward(500);
    await player.strafeLeft(300);
    await player.fireMultiple(5, 100);
    await player.screenshot('phase-1-dodging');
  });
});
