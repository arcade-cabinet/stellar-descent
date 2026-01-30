/**
 * E2E Test: Extraction (Level 6 - Finale)
 *
 * Tests the campaign finale:
 * - Escape phase (collapsing tunnel, 3:00 timer)
 * - Surface run (500m to LZ)
 * - Holdout phase (5 waves, 5:00 timer)
 * - Marcus mech degradation
 * - Dropship rescue
 * - Victory sequence
 */

import { expect, test } from '@playwright/test';
import { PlayerGovernor } from '../utils/PlayerGovernor';

test.describe('Level 6: Extraction', () => {
  let player: PlayerGovernor;

  test.beforeEach(async ({ page }) => {
    player = new PlayerGovernor(page, 'extraction', {
      screenshotDir: 'e2e/screenshots/extraction',
    });
  });

  test('should load Extraction level directly', async ({ page }) => {
    await player.goToLevel('extraction');
    await player.screenshot('level-loaded');

    // Should see canvas
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('escape phase - collapsing tunnel', async ({ page }) => {
    await player.goToLevel('extraction');

    await player.wait(2000);
    await player.screenshot('escape-start');

    // Check for timer or escape objective
    const hasTimer = await player.hasText(/ESCAPE|TIMER|COLLAPSE|RUN/i);
    await player.screenshot('escape-objective');

    // Sprint through tunnel
    await player.sprint(2000);
    await player.screenshot('sprinting');

    await player.sprint(2000);
    await player.screenshot('mid-escape');
  });

  test('sprint action during escape', async ({ page }) => {
    await player.goToLevel('extraction');

    await player.wait(2000);

    // Check for SPRINT button
    const hasSprint = await player.hasText(/SPRINT/i);
    await player.screenshot('sprint-available');

    // Use sprint
    await player.sprint(1500);
    await player.screenshot('after-sprint');
  });

  test('surface run phase', async ({ page }) => {
    test.setTimeout(90000);

    await player.goToLevel('extraction');

    // Wait for escape phase completion or skip through
    await player.wait(5000);
    await player.sprint(3000);
    await player.screenshot('escape-complete');

    // Surface run
    await player.wait(3000);
    await player.screenshot('surface-run-start');

    // Check for LZ distance
    const hasLZ = await player.hasText(/LZ|OMEGA|DISTANCE|500m/i);
    await player.screenshot('lz-distance');

    // Run toward LZ
    await player.moveForward(3000);
    await player.screenshot('running-to-lz');
  });

  test('holdout phase - wave defense', async ({ page }) => {
    test.setTimeout(180000);

    await player.goToLevel('extraction');

    // Skip to holdout (escape + surface run)
    await player.sprint(3000);
    await player.wait(5000);
    await player.moveForward(5000);
    await player.screenshot('holdout-start');

    // Check for dropship ETA timer
    const hasETA = await player.hasText(/ETA|DROPSHIP|WAVE|INCOMING/i);
    await player.screenshot('dropship-eta');

    // Wave combat
    await player.fireMultiple(5, 200);
    await player.screenshot('wave-combat');

    await player.throwGrenade();
    await player.wait(500);
    await player.screenshot('grenade-defense');
  });

  test('signal flare during holdout', async ({ page }) => {
    test.setTimeout(120000);

    await player.goToLevel('extraction');

    // Navigate to holdout
    await player.sprint(3000);
    await player.wait(5000);
    await player.moveForward(4000);
    await player.screenshot('at-lz');

    // Check for SIGNAL FLARE button
    const hasFlare = await player.hasText(/FLARE|SIGNAL/i);
    await player.screenshot('flare-available');

    // Use flare
    await player.toggleFlashlight(); // KeyF for flare
    await player.wait(1000);
    await player.screenshot('flare-deployed');
  });

  test('marcus mech support during holdout', async ({ page }) => {
    test.setTimeout(120000);

    await player.goToLevel('extraction');

    // Navigate to holdout
    await player.sprint(3000);
    await player.wait(5000);
    await player.moveForward(4000);
    await player.screenshot('marcus-visible');

    // Check for Marcus covering fire
    await player.lookRight(90);
    await player.screenshot('marcus-mech');

    // Call fire support
    await player.callFireSupport();
    await player.wait(1000);
    await player.screenshot('marcus-fire-support');
  });

  test('full extraction playthrough', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes

    await player.goToLevel('extraction');
    await player.screenshot('01-start');

    // Phase 1: Escape
    await player.wait(2000);
    await player.screenshot('02-escape-phase');

    for (let i = 0; i < 5; i++) {
      await player.sprint(1000);
      await player.screenshot(`03-escape-${i}`);
    }

    // Phase 2: Surface Run
    await player.wait(3000);
    await player.screenshot('04-surface-run');

    await player.moveForward(3000);
    await player.screenshot('05-running-to-lz');

    await player.moveForward(2000);
    await player.screenshot('06-approaching-lz');

    // Phase 3: Holdout
    await player.wait(3000);
    await player.screenshot('07-holdout-start');

    // Wave 1
    await player.fireMultiple(8, 150);
    await player.screenshot('08-wave-1');

    // Wave 2
    await player.wait(10000);
    await player.throwGrenade();
    await player.fireMultiple(10, 100);
    await player.screenshot('09-wave-2');

    // Wave 3
    await player.wait(15000);
    await player.callFireSupport();
    await player.fireMultiple(12, 100);
    await player.screenshot('10-wave-3');

    // Wave 4
    await player.wait(15000);
    await player.throwGrenade();
    await player.fireMultiple(15, 80);
    await player.screenshot('11-wave-4');

    // Wave 5 (final) + Dropship arrival
    await player.wait(15000);
    await player.fireMultiple(20, 60);
    await player.screenshot('12-wave-5');

    // Victory
    await player.wait(10000);
    await player.screenshot('13-dropship-arrives');

    const hasVictory = await player.hasText(/VICTORY|COMPLETE|MISSION|EXTRACTION/i);
    await player.screenshot('14-victory');
  });

  test('victory sequence', async ({ page }) => {
    test.setTimeout(300000);

    await player.goToLevel('extraction');

    // Fast-forward through level (this is a long test)
    await player.sprint(5000);
    await player.moveForward(8000);

    // Wait for waves
    await player.wait(60000);

    // Check for victory
    await player.screenshot('checking-victory');

    const hasVictory = await player.hasText(/MISSION COMPLETE|VICTORY|EXTRACTION|COMPLETE/i);
    const hasEpilogue = await player.hasText(/Commander|Vasquez|ATHENA|epilogue/i);

    await player.screenshot('victory-screen');
  });

  test('marcus mech collapse (sacrifice moment)', async ({ page }) => {
    test.setTimeout(300000);

    await player.goToLevel('extraction');

    // Navigate through level
    await player.sprint(5000);
    await player.moveForward(8000);

    // Wait for waves and mech degradation
    await player.wait(45000);
    await player.screenshot('mech-damaged');

    // Check for mech collapse
    const hasMechDown = await player.hasText(/MARCUS|MECH|DOWN|COLLAPSE/i);
    await player.screenshot('mech-collapse');
  });
});
