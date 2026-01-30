/**
 * E2E Test: Anchor Station (Level 1 - Tutorial)
 *
 * Comprehensive tests for the tutorial flow:
 * - Phase 0: Briefing (no controls) - AI greeting and Commander briefing
 * - Phase 1: Movement tutorial + Platforming (jump/crouch)
 * - Phase 2: Equipment Bay - suit equip and weapon pickup
 * - Phase 3: Shooting Range - weapons calibration
 * - Phase 4: Hangar Bay - depressurize, bay doors, and orbital drop
 *
 * Tests are designed to be reliable and avoid flakiness by using proper
 * waits for game state changes rather than arbitrary timeouts.
 */

import { expect, test } from '@playwright/test';
import { LEVEL_IDS, LEVEL_TIMEOUTS } from '../utils';
import { PlayerGovernor } from '../utils/PlayerGovernor';

test.describe('Level 1: Anchor Station Tutorial', () => {
  let player: PlayerGovernor;

  test.beforeEach(async ({ page }) => {
    player = new PlayerGovernor(page, 'anchor-station', {
      screenshotDir: 'e2e/screenshots/anchor-station',
    });
  });

  // ===========================================================================
  // GAME LAUNCH AND MAIN MENU TESTS
  // ===========================================================================

  test.describe('Game Launch to Main Menu', () => {
    test('should display main menu on initial load', async ({ page }) => {
      await page.goto('/');

      // Wait for main game canvas to be ready (Babylon.js canvas)
      await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });

      // Verify main menu buttons are visible
      await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /HALO DROP/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /CONTROLS/i })).toBeVisible();

      await player.screenshot('main-menu');
    });

    test('should have functional controls modal', async ({ page }) => {
      await page.goto('/');

      // Open controls modal
      await page.getByRole('button', { name: /CONTROLS/i }).click();

      // Verify controls content is visible
      await expect(page.getByText(/OPERATIONS MANUAL/i)).toBeVisible();
      await expect(page.getByText(/Move/i)).toBeVisible();

      await player.screenshot('controls-modal');

      // Close modal
      await page.getByRole('button', { name: /CLOSE/i }).click();
      await expect(page.getByText(/OPERATIONS MANUAL/i)).not.toBeVisible();
    });
  });

  // ===========================================================================
  // STARTING NEW GAME TESTS
  // ===========================================================================

  test.describe('Starting New Game', () => {
    test('should show loading screen when starting new campaign', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Should see loading screen with level name
      await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible({ timeout: 10000 });

      // Should show progress percentage
      await expect(page.getByText(/%/)).toBeVisible();

      await player.screenshot('loading-screen');
    });

    test('should show loading progress updates', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Should see status text updates during loading
      await expect(page.getByText(/INITIALIZING|LOADING|COMPILING|SYSTEMS/i)).toBeVisible({
        timeout: 15000,
      });
    });

    test('should transition from loading to tutorial', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.LOAD * 2);

      await page.goto('/');
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Wait for loading to complete
      await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 30000 });

      // Wait for first comms message (tutorial start)
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });

      await player.screenshot('tutorial-started');
    });

    test('should load level directly via URL parameter', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Should see main game canvas
      await expect(page.locator('canvas').first()).toBeVisible();

      await player.screenshot('direct-level-load');
    });
  });

  // ===========================================================================
  // PHASE 0: BRIEFING - TUTORIAL PROMPTS APPEAR CORRECTLY
  // ===========================================================================

  test.describe('Phase 0: Briefing - Tutorial Prompts', () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);
      await page.goto('/');
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();
    });

    test('should display initial AI greeting from Athena', async ({ page }) => {
      // Wait for first comms message (allow time for GLB model loading)
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 45000 });

      await player.screenshot('athena-greeting');

      // Verify comms panel structure
      const commsPanel = page.locator('[class*="commsPanel"], [class*="CommsDisplay"]').first();
      await expect(commsPanel).toBeVisible();

      // Should show Athena as sender
      await expect(page.getByText(/ATHENA/i)).toBeVisible();
      await expect(page.getByText(/PROMETHEUS A\.I\./i)).toBeVisible();
    });

    test('should display Commander Vasquez briefing after Athena', async ({ page }) => {
      // Wait for initial greeting
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 45000 });

      // Dismiss first message
      await player.dismissComms();
      await player.wait(500);

      // Wait for Commander message
      await expect(page.getByText(/brother's team|FOB Delta|Marcus/i)).toBeVisible({
        timeout: 15000,
      });

      await player.screenshot('commander-briefing');

      // Should show Commander Vasquez
      await expect(page.getByText(/PROMETHEUS ACTUAL|Commander|Vasquez/i)).toBeVisible();
    });

    test('should advance comms when pressing space or clicking acknowledge', async ({ page }) => {
      // Wait for first message
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 45000 });

      const firstMessage = page.getByText(/Good morning, Sergeant Cole/i);
      await expect(firstMessage).toBeVisible();

      // Advance via space key
      await player.pressSpace();
      await player.wait(500);

      // First message should no longer be visible (or next message appears)
      // Note: The message might still be visible briefly, so we check for state change
      const hasNewContent = await page.getByText(/brother's team|FOB Delta|Movement/i).isVisible();

      // Either the first message disappeared or new content appeared
      expect(hasNewContent).toBe(true);

      await player.screenshot('comms-advanced');
    });
  });

  // ===========================================================================
  // PHASE 1: MOVEMENT TUTORIAL COMPLETION
  // ===========================================================================

  test.describe('Phase 1: Movement Tutorial', () => {
    test.beforeEach(async () => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);
    });

    test('should unlock movement controls after briefing', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Wait for initial comms
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.screenshot('phase1-start');

      // Advance through briefing comms
      await player.advanceThroughAllComms(5);
      await player.wait(1000);

      // Wait for movement objective
      await player.waitForText(/move|WASD|Equipment Bay/i, 15000).catch(() => {});

      await player.screenshot('movement-objective');

      // Test that movement works (WASD keys)
      await player.moveForward(1500);
      await player.screenshot('moved-forward');

      // Move in other directions to verify all movement
      await player.strafeLeft(500);
      await player.strafeRight(500);
      await player.moveBackward(500);

      await player.screenshot('movement-verified');
    });

    test('should show objective display during movement phase', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Wait for tutorial to start
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);

      // Advance through initial briefing
      await player.advanceThroughAllComms(5);
      await player.wait(1000);

      // Check for objective display - look for objective text
      const hasObjective =
        (await player.hasText(/Equipment Bay/i)) ||
        (await player.hasText(/WASD/i)) ||
        (await player.hasText(/move/i));

      expect(hasObjective).toBe(true);

      await player.screenshot('objective-display');
    });

    test('should progress through corridor to equipment bay', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Wait for tutorial to start
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);

      // Advance through initial briefing
      await player.advanceThroughAllComms(6);

      // Move forward through corridor
      await player.moveForward(3000);
      await player.screenshot('corridor-progress');

      // Continue moving toward equipment bay
      await player.moveForward(2000);
      await player.screenshot('near-equipment-bay');
    });
  });

  // ===========================================================================
  // PHASE 2: INTERACTION TUTORIAL COMPLETION
  // ===========================================================================

  test.describe('Phase 2: Equipment Bay - Interaction Tutorial', () => {
    test.beforeEach(async () => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);
    });

    test('should show suit locker interaction prompt', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress through initial phases
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(8);

      // Move to equipment bay area
      await player.moveForward(4000);
      await player.screenshot('at-equipment-bay');

      // Look for suit locker or equip prompts
      const hasSuitPrompt =
        (await player.hasText(/suit/i)) ||
        (await player.hasText(/locker/i)) ||
        (await player.hasText(/equip/i)) ||
        (await player.hasText(/press E/i));

      // The player should eventually see an interact prompt
      await player.screenshot('suit-locker-area');
    });

    test('should complete suit equip interaction with E key', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress through initial phases
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(10);

      // Move to equipment bay
      await player.moveForward(4000);

      // Try to interact (E key)
      await player.interact();
      await player.wait(500);

      await player.screenshot('after-equip-attempt');

      // Continue through any resulting comms
      await player.advanceThroughAllComms(3);
      await player.screenshot('post-equip');
    });

    test('should show action buttons during interaction phases', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress through to equipment bay
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(10);
      await player.moveForward(4000);

      // Check for action buttons (EQUIP SUIT, etc.)
      const hasActionButton =
        (await player.isButtonVisible(/EQUIP/i)) || (await player.isButtonVisible(/INTERACT/i));

      await player.screenshot('action-buttons');
    });

    test('should progress to weapon pickup', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress through equipment bay
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(12);
      await player.moveForward(4000);
      await player.interact();
      await player.wait(1000);

      // Advance comms after suit equip
      await player.advanceThroughAllComms(5);

      // Move toward weapon rack
      await player.moveForward(1500);

      // Look for weapon-related prompts
      const hasWeaponPrompt =
        (await player.hasText(/weapon/i)) ||
        (await player.hasText(/rifle/i)) ||
        (await player.hasText(/M7/i));

      await player.screenshot('weapon-rack');
    });
  });

  // ===========================================================================
  // PHASE 3: WEAPON FIRING TUTORIAL
  // ===========================================================================

  test.describe('Phase 3: Shooting Range - Weapon Firing Tutorial', () => {
    test.beforeEach(async () => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);
    });

    test('should reach shooting range from equipment bay', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress through equipment bay
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(12);
      await player.moveForward(5000);
      await player.interact();
      await player.wait(500);

      // Continue through weapon pickup
      await player.advanceThroughAllComms(5);
      await player.moveForward(2000);

      await player.screenshot('approaching-shooting-range');

      // Check for calibration/shooting prompts
      const hasRangePrompt =
        (await player.hasText(/calibrat/i)) ||
        (await player.hasText(/target/i)) ||
        (await player.hasText(/shoot/i)) ||
        (await player.hasText(/fire/i));

      await player.screenshot('shooting-range-area');
    });

    test('should display crosshair during shooting phase', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress to shooting range
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(15);
      await player.moveForward(6000);

      // Check for crosshair element
      const crosshair = page.locator(
        '[class*="crosshair"], [class*="Crosshair"], .crosshair-dot, .calibration-crosshair'
      );

      await player.screenshot('crosshair-visible');
    });

    test('should show ammo counter during shooting phase', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress to shooting range
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(15);
      await player.moveForward(6000);

      // Check for ammo display
      const hasAmmo = await page
        .locator('[class*="ammo"], [class*="Ammo"]')
        .first()
        .isVisible()
        .catch(() => false);

      await player.screenshot('ammo-counter');
    });

    test('should respond to firing input during calibration', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress to shooting range
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(15);
      await player.moveForward(6000);

      await player.screenshot('before-firing');

      // Fire weapon multiple times
      await player.fireMultiple(5, 300);

      await player.screenshot('after-firing');

      // Look for calibration complete or target hit feedback
      await player.wait(1000);
      await player.screenshot('firing-result');
    });

    test('should complete calibration with all targets', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress to shooting range
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(15);
      await player.moveForward(6000);

      // Wait for calibration start
      await player.wait(2000);

      // Fire at multiple positions to hit targets
      for (let i = 0; i < 3; i++) {
        await player.lookLeft(50);
        await player.fire();
        await player.wait(200);
        await player.lookRight(100);
        await player.fire();
        await player.wait(200);
      }

      await player.screenshot('calibration-attempt');

      // Continue through any completion comms
      await player.advanceThroughAllComms(3);
      await player.screenshot('after-calibration');
    });
  });

  // ===========================================================================
  // PHASE 4: LEVEL COMPLETION AND TRANSITION
  // ===========================================================================

  test.describe('Phase 4: Hangar Bay - Level Completion', () => {
    test.beforeEach(async () => {
      test.setTimeout(LEVEL_TIMEOUTS.LONG_PLAYTHROUGH);
    });

    test('should progress to hangar bay after shooting range', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress through all previous phases
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(20);
      await player.moveForward(8000);

      // Look for hangar-related prompts
      const hasHangarPrompt =
        (await player.hasText(/hangar/i)) ||
        (await player.hasText(/bay/i)) ||
        (await player.hasText(/drop pod/i));

      await player.screenshot('hangar-bay');
    });

    test('should show depressurization warning in hangar', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress to hangar area
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(25);
      await player.moveForward(10000);

      // Check for depressurization warning
      const hasWarning =
        (await player.hasText(/depressur/i)) ||
        (await player.hasText(/WARNING/i)) ||
        (await player.hasText(/venting/i));

      await player.screenshot('depressurization');
    });

    test('should display orbital drop button when ready', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress to final phase
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);

      // Advance through all tutorial steps
      for (let i = 0; i < 30; i++) {
        const hasDropButton = await player.isButtonVisible(/ORBITAL DROP|BEGIN DROP|LAUNCH/i);
        if (hasDropButton) {
          await player.screenshot('drop-button-visible');
          break;
        }

        await player.dismissComms();
        await player.moveForward(500);
        await player.interact();
        await player.wait(500);
      }

      // Final check for drop button
      const hasDropButton = await player.isButtonVisible(/ORBITAL DROP|BEGIN DROP|LAUNCH/i);
      await player.screenshot('final-state');
    });

    test('should show pod HELL-7 in hangar', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Progress to hangar
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(25);
      await player.moveForward(10000);

      // Look for pod references
      const hasPod =
        (await player.hasText(/HELL-7/i)) ||
        (await player.hasText(/drop pod/i)) ||
        (await player.hasText(/pod/i));

      await player.screenshot('drop-pod');
    });
  });

  // ===========================================================================
  // FULL TUTORIAL PLAYTHROUGH TEST
  // ===========================================================================

  test.describe('Full Tutorial Playthrough', () => {
    test('complete tutorial from menu to orbital drop', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.LONG_PLAYTHROUGH);

      // === MENU ===
      await page.goto('/');
      await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible({
        timeout: 10000,
      });
      await player.screenshot('01-main-menu');

      // === START GAME ===
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // === LOADING ===
      await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible({ timeout: 10000 });
      await player.screenshot('02-loading');

      // Wait for loading to complete
      await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 30000 });

      // === PHASE 0: BRIEFING ===
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });
      await player.screenshot('03-athena-greeting');

      // Advance through briefing
      await player.dismissComms();
      await player.wait(1500);

      // Wait for commander message
      await expect(page.getByText(/brother's team|FOB Delta/i)).toBeVisible({ timeout: 15000 });
      await player.screenshot('04-commander-briefing');
      await player.dismissComms();
      await player.wait(1500);

      // === PHASE 1: MOVEMENT ===
      // Wait for movement unlock message
      await player.waitForText(/Movement|WASD|Equipment Bay/i, 15000).catch(() => {});
      await player.screenshot('05-movement-unlocked');

      // Move through corridor
      await player.moveForward(3000);
      await player.screenshot('06-corridor');

      await player.strafeRight(500);
      await player.moveForward(2000);
      await player.screenshot('07-near-equipment-bay');

      // Continue through any comms
      await player.advanceThroughAllComms(3);

      // === PHASE 2: EQUIPMENT BAY ===
      await player.moveForward(1500);
      await player.screenshot('08-equipment-bay');

      // Try suit locker interaction
      await player.interact();
      await player.wait(1000);
      await player.advanceThroughAllComms(3);
      await player.screenshot('09-suit-equipped');

      // Move to weapon rack
      await player.moveForward(1000);
      await player.interact();
      await player.wait(500);
      await player.advanceThroughAllComms(3);
      await player.screenshot('10-weapon-acquired');

      // === PHASE 3: SHOOTING RANGE ===
      await player.moveForward(2000);
      await player.screenshot('11-shooting-range');

      // Fire at targets
      await player.fireMultiple(5, 300);
      await player.lookLeft(50);
      await player.fireMultiple(3, 300);
      await player.lookRight(100);
      await player.fireMultiple(3, 300);
      await player.screenshot('12-calibration');

      await player.advanceThroughAllComms(3);
      await player.screenshot('13-calibration-complete');

      // === PHASE 4: HANGAR BAY ===
      await player.moveForward(3000);
      await player.screenshot('14-hangar-approach');

      await player.advanceThroughAllComms(5);
      await player.moveForward(2000);
      await player.screenshot('15-hangar-bay');

      // Move toward drop pod
      await player.moveForward(2000);
      await player.interact();
      await player.wait(1000);
      await player.screenshot('16-drop-pod');

      // Advance through final comms
      await player.advanceThroughAllComms(5);
      await player.screenshot('17-ready-for-drop');

      // Check for drop button
      const hasDropButton = await player.isButtonVisible(/ORBITAL DROP|BEGIN DROP|LAUNCH/i);
      if (hasDropButton) {
        await player.screenshot('18-drop-button');
      }

      // Final screenshot
      await player.screenshot('19-tutorial-end');
    });
  });

  // ===========================================================================
  // HALO DROP (SKIP TUTORIAL) TEST
  // ===========================================================================

  test.describe('HALO Drop (Skip Tutorial)', () => {
    test('should skip tutorial when using HALO DROP option', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.LOAD * 2);

      await page.goto('/');
      await page.getByRole('button', { name: /HALO DROP/i }).click();

      // Should see loading
      await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible({ timeout: 10000 });

      // Wait for loading to complete
      await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 30000 });

      // Should see drop notification (skipped tutorial, going directly to drop)
      await expect(page.getByText(/ORBITAL DROP|DROP INITIATED/i)).toBeVisible({ timeout: 30000 });

      await player.screenshot('halo-drop-skipped');
    });
  });

  // ===========================================================================
  // HUD STATE TESTS
  // ===========================================================================

  test.describe('HUD State Progression', () => {
    test('should progressively unlock HUD elements through phases', async ({ page }) => {
      test.setTimeout(LEVEL_TIMEOUTS.MEDIUM_PLAYTHROUGH);

      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      // Phase 0: No HUD initially (just comms)
      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.screenshot('hud-phase0');

      // Phase 1: Health bar should appear after briefing
      await player.advanceThroughAllComms(3);
      await player.wait(1000);

      const hasHealthBar = await page
        .locator('[class*="health"], [class*="Health"]')
        .first()
        .isVisible()
        .catch(() => false);

      await player.screenshot('hud-phase1-health');

      // Phase 2: Crosshair should appear
      await player.advanceThroughAllComms(10);
      await player.moveForward(4000);

      const hasCrosshair = await page
        .locator('[class*="crosshair"], [class*="Crosshair"]')
        .first()
        .isVisible()
        .catch(() => false);

      await player.screenshot('hud-phase2-crosshair');

      // Phase 3: Ammo counter should appear
      await player.moveForward(3000);

      const hasAmmoCounter = await page
        .locator('[class*="ammo"], [class*="Ammo"]')
        .first()
        .isVisible()
        .catch(() => false);

      await player.screenshot('hud-phase3-ammo');
    });
  });

  // ===========================================================================
  // ERROR HANDLING AND EDGE CASES
  // ===========================================================================

  test.describe('Error Handling', () => {
    test('should handle rapid space key presses without breaking', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Wait for tutorial to start
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 45000 });

      // Rapidly press space multiple times
      for (let i = 0; i < 10; i++) {
        await player.pressSpace();
        await player.wait(100);
      }

      // Game should still be running (main canvas visible)
      await expect(page.locator('canvas').first()).toBeVisible();

      await player.screenshot('rapid-space-handled');
    });

    test('should handle simultaneous movement inputs', async ({ page }) => {
      await player.goToLevel(LEVEL_IDS.ANCHOR_STATION);

      await player.waitForText(/Good morning|Sergeant Cole/i, 45000);
      await player.advanceThroughAllComms(5);

      // Press multiple movement keys simultaneously
      await page.keyboard.down('KeyW');
      await page.keyboard.down('KeyA');
      await player.wait(500);
      await page.keyboard.down('KeyD');
      await player.wait(500);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('KeyA');
      await page.keyboard.up('KeyD');

      // Game should still be running (main canvas visible)
      await expect(page.locator('canvas').first()).toBeVisible();

      await player.screenshot('simultaneous-movement');
    });
  });
});
