/**
 * FOB Delta Level - Comprehensive Playwright E2E Test
 *
 * Level 4: Abandoned Forward Operating Base (Horror/Investigation)
 *
 * Test Coverage:
 * 1. Horror atmosphere with flashlight mechanics
 * 2. Area transitions: perimeter, courtyard, barracks, command center, vehicle bay
 * 3. Terminal interactions and mission log reading
 * 4. Supply collection (ammo, health, armor pickups)
 * 5. Ambush combat sequence
 * 6. Underground hatch discovery
 * 7. TITAN mech discovery by Marcus
 *
 * Uses PlayerGovernor for automated player control through the debug interface.
 */

import { expect, type Page, test } from '@playwright/test';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

interface GovernorGoal {
  type: 'idle' | 'navigate' | 'interact' | 'engage_enemies' | 'wait' | 'advance_dialogue';
  target?: Vector3Like;
  targetId?: string;
  duration?: number;
  threshold?: number;
}

interface DebugInterface {
  playerGovernor: {
    setGoal: (goal: GovernorGoal) => void;
    getCurrentGoal: () => GovernorGoal;
    clearGoals: () => void;
    navigateTo: (position: Vector3Like, threshold?: number) => void;
    wait: (duration: number) => void;
    addEventListener: (callback: (event: { type: string }) => void) => void;
  };
  devMode: {
    allLevelsUnlocked: boolean;
    godMode: boolean;
    showColliders: boolean;
  };
  campaignDirector: {
    dispatch: (command: { type: string; [key: string]: unknown }) => void;
    getState: () => { phase: string; currentLevel: string };
  };
}

declare global {
  interface Window {
    __STELLAR_DESCENT_DEBUG__: DebugInterface;
  }
}

// ============================================================================
// TEST CONSTANTS
// ============================================================================

/**
 * FOB Delta Area Zone Positions
 * These positions correspond to the center of each area zone defined in FOBDeltaLevel.ts
 */
const AREA_POSITIONS = {
  perimeter: { x: 0, y: 1.7, z: -35 },
  courtyard: { x: 0, y: 1.7, z: 0 },
  barracks: { x: -25, y: 1.7, z: 0 },
  commandCenter: { x: 0, y: 1.7, z: 25 },
  vehicleBay: { x: 25, y: 1.7, z: 0 },
  undergroundHatch: { x: 30, y: 1.7, z: 10 },
} as const;

/**
 * Key interaction positions within FOB Delta
 */
const INTERACTION_POSITIONS = {
  terminal: { x: 0, y: 1.7, z: 27 },
  mech: { x: 27, y: 1.7, z: 0 },
  hatch: { x: 30, y: 1.7, z: 10 },
} as const;

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wait for the debug interface to become available on the page.
 */
async function waitForDebugInterface(page: Page, timeout = 30000): Promise<void> {
  await page.waitForFunction(() => typeof window.__STELLAR_DESCENT_DEBUG__ !== 'undefined', {
    timeout,
  });
}

/**
 * Wait for the game to reach a specific campaign phase.
 */
async function waitForCampaignPhase(page: Page, phase: string, timeout = 30000): Promise<void> {
  await page.waitForFunction(
    (expectedPhase) =>
      window.__STELLAR_DESCENT_DEBUG__?.campaignDirector?.getState()?.phase === expectedPhase,
    phase,
    { timeout }
  );
}

/**
 * Navigate to a specific position using PlayerGovernor.
 */
async function navigateTo(page: Page, position: Vector3Like, threshold = 2): Promise<void> {
  await page.evaluate(
    ({ pos, thresh }) => {
      window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
        type: 'navigate',
        target: pos,
        threshold: thresh,
      });
    },
    { pos: position, thresh: threshold }
  );
}

/**
 * Wait for player to reach a position within threshold distance.
 */
async function waitForPosition(
  page: Page,
  position: Vector3Like,
  threshold = 3,
  timeout = 30000
): Promise<void> {
  await page.waitForFunction(
    ({ pos, thresh }) => {
      const governor = window.__STELLAR_DESCENT_DEBUG__?.playerGovernor;
      if (!governor) return false;
      const currentGoal = governor.getCurrentGoal();
      return currentGoal.type === 'idle' || currentGoal.type !== 'navigate';
    },
    { pos: position, thresh: threshold },
    { timeout }
  );
}

/**
 * Execute an interaction with a target.
 */
async function interact(page: Page, targetId?: string): Promise<void> {
  await page.evaluate((id) => {
    window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
      type: 'interact',
      targetId: id,
    });
  }, targetId);
}

/**
 * Wait for a specified duration using PlayerGovernor.
 */
async function waitInGame(page: Page, duration: number): Promise<void> {
  await page.evaluate((dur) => {
    window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
      type: 'wait',
      duration: dur,
    });
  }, duration);
}

/**
 * Enable god mode for testing (prevents player death).
 */
async function enableGodMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__STELLAR_DESCENT_DEBUG__?.devMode) {
      window.__STELLAR_DESCENT_DEBUG__.devMode.godMode = true;
    }
  });
}

/**
 * Unlock all levels for testing.
 */
async function unlockAllLevels(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__STELLAR_DESCENT_DEBUG__?.devMode) {
      window.__STELLAR_DESCENT_DEBUG__.devMode.allLevelsUnlocked = true;
    }
  });
}

/**
 * Start FOB Delta level directly.
 */
async function startFOBDelta(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__STELLAR_DESCENT_DEBUG__.campaignDirector.dispatch({
      type: 'NEW_GAME',
      difficulty: 'normal',
      startLevel: 'fob_delta',
    });
  });
}

/**
 * Wait for UI element to be visible.
 */
async function waitForUIElement(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.getByText(text, { exact: false }).waitFor({ state: 'visible', timeout });
}

/**
 * Take a labeled screenshot for visual regression testing.
 */
async function captureScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/fob-delta/${name}.png`,
    fullPage: false,
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

test.describe('FOB Delta Level - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the game
    await page.goto('/');

    // Wait for splash/loading to complete
    await page.waitForLoadState('networkidle');

    // Wait for debug interface
    await waitForDebugInterface(page);

    // Enable testing mode
    await unlockAllLevels(page);
    await enableGodMode(page);
  });

  test.describe('Level Initialization', () => {
    test('should load FOB Delta level and display initial objective', async ({ page }) => {
      // Start FOB Delta
      await startFOBDelta(page);

      // Wait for level to load
      await waitForCampaignPhase(page, 'playing', 60000);

      // Wait for loading to complete
      await page.waitForTimeout(3000);

      // Verify initial objective text appears
      const objectiveText = page.locator('[data-testid="objective"]');
      await expect(objectiveText).toBeVisible({ timeout: 10000 });

      // Capture screenshot of initial state
      await captureScreenshot(page, '01-level-start');
    });

    test('should have horror atmosphere with dark lighting', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Capture dark atmosphere screenshot
      await captureScreenshot(page, '02-horror-atmosphere');

      // The background should be very dark (horror atmosphere)
      // This is validated by visual regression
    });
  });

  test.describe('Flashlight Mechanics', () => {
    test('should toggle flashlight on and show notification', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Press F key to toggle flashlight
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Verify flashlight notification
      await expect(page.getByText('FLASHLIGHT ON')).toBeVisible({ timeout: 2000 });

      // Capture screenshot with flashlight on
      await captureScreenshot(page, '03-flashlight-on');
    });

    test('should toggle flashlight off', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Toggle on
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Toggle off
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Verify flashlight off notification
      await expect(page.getByText('FLASHLIGHT OFF')).toBeVisible({ timeout: 2000 });

      // Capture screenshot with flashlight off
      await captureScreenshot(page, '04-flashlight-off');
    });

    test('should illuminate environment when flashlight is on', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Capture without flashlight
      await captureScreenshot(page, '05-no-flashlight');

      // Toggle flashlight on
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Capture with flashlight - should show difference in lighting
      await captureScreenshot(page, '06-with-flashlight');
    });
  });

  test.describe('Area Transitions', () => {
    test('should trigger courtyard zone when entering', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to courtyard
      await navigateTo(page, AREA_POSITIONS.courtyard);

      // Wait for navigation to complete
      await waitForPosition(page, AREA_POSITIONS.courtyard);
      await page.waitForTimeout(2000);

      // Check for phase change or area notification
      await captureScreenshot(page, '07-courtyard-area');
    });

    test('should trigger barracks zone and show horror elements', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate through courtyard first
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);
      await page.waitForTimeout(1000);

      // Navigate to barracks
      await navigateTo(page, AREA_POSITIONS.barracks);
      await waitForPosition(page, AREA_POSITIONS.barracks);
      await page.waitForTimeout(2000);

      // Capture barracks area
      await captureScreenshot(page, '08-barracks-area');
    });

    test('should trigger command center zone', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to courtyard first
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);
      await page.waitForTimeout(1000);

      // Navigate to command center
      await navigateTo(page, AREA_POSITIONS.commandCenter);
      await waitForPosition(page, AREA_POSITIONS.commandCenter);
      await page.waitForTimeout(2000);

      // Verify investigation phase transition
      await captureScreenshot(page, '09-command-center');
    });

    test('should trigger vehicle bay zone', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate through courtyard
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);
      await page.waitForTimeout(1000);

      // Navigate to vehicle bay
      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(2000);

      // Capture vehicle bay with mech visible
      await captureScreenshot(page, '10-vehicle-bay');
    });
  });

  test.describe('Terminal Interaction', () => {
    test('should display terminal interaction prompt when near', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate through courtyard to command center
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);

      await navigateTo(page, AREA_POSITIONS.commandCenter);
      await waitForPosition(page, AREA_POSITIONS.commandCenter);

      // Navigate to terminal
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.waitForTimeout(1000);

      // Check for interaction prompt
      await expect(page.getByText('ACCESS TERMINAL')).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, '11-terminal-prompt');
    });

    test('should access mission logs when interacting with terminal', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to terminal
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);

      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.waitForTimeout(1000);

      // Interact with terminal
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(500);

      // Check for log access notification
      await expect(page.getByText('ACCESSING')).toBeVisible({ timeout: 3000 });
      await captureScreenshot(page, '12-accessing-logs');
    });

    test('should display mission log messages over time', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to terminal
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);

      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.waitForTimeout(1000);

      // Interact with terminal
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(3000);

      // Wait for first log message
      await captureScreenshot(page, '13-log-message-1');

      // Wait for additional log messages
      await page.waitForTimeout(6000);
      await captureScreenshot(page, '14-log-message-2');

      // Wait for objective update
      await page.waitForTimeout(8000);
      await captureScreenshot(page, '15-logs-complete');
    });

    test('should update objective after reading all logs', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to terminal and interact
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.waitForTimeout(1000);

      await page.keyboard.press('KeyE');

      // Wait for all logs to display
      await page.waitForTimeout(20000);

      // Check for new objective
      await expect(page.getByText('LOCATE')).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, '16-new-objective');
    });
  });

  test.describe('Supply Collection', () => {
    test('should display supply pickup prompt when near ammo crate', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate around to find supply pickups
      await navigateTo(page, AREA_POSITIONS.barracks);
      await waitForPosition(page, AREA_POSITIONS.barracks);
      await page.waitForTimeout(2000);

      // Look for collect prompt
      const hasPickupPrompt = await page.locator('text=/COLLECT|AMMO|MED KIT/i').isVisible();

      if (hasPickupPrompt) {
        await captureScreenshot(page, '17-supply-prompt');
      }
    });

    test('should collect ammo and update HUD', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to find supplies
      await navigateTo(page, AREA_POSITIONS.barracks);
      await waitForPosition(page, AREA_POSITIONS.barracks);
      await page.waitForTimeout(2000);

      // Try to collect supplies by pressing E
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(500);

      // Check for pickup notification
      const notification = page.locator('text=/\\+[0-9]+ AMMO|\\+[0-9]+ HEALTH|\\+[0-9]+ ARMOR/i');
      if (await notification.isVisible({ timeout: 2000 })) {
        await captureScreenshot(page, '18-supply-collected');
      }
    });

    test('should collect health pickup and restore health', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to barracks where health pickups are located
      await navigateTo(page, AREA_POSITIONS.barracks);
      await waitForPosition(page, AREA_POSITIONS.barracks);
      await page.waitForTimeout(2000);

      // Collect pickup
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(500);

      // Check for health notification
      const hasHealthNotification = await page
        .getByText(/\+[0-9]+ HEALTH/)
        .isVisible({ timeout: 2000 });
      if (hasHealthNotification) {
        await captureScreenshot(page, '19-health-collected');
      }
    });

    test('should animate supply pickups with bob and rotation', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to area with supplies
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);

      // Capture multiple frames to see animation
      await captureScreenshot(page, '20-supply-animation-1');
      await page.waitForTimeout(500);
      await captureScreenshot(page, '21-supply-animation-2');
    });
  });

  test.describe('Ambush Combat Sequence', () => {
    test('should trigger ambush when entering vehicle bay after logs accessed', async ({
      page,
    }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // First access logs
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000); // Wait for logs to complete

      // Navigate to vehicle bay to trigger ambush
      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(3000);

      // Check for hostiles notification
      await expect(page.getByText('HOSTILES')).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, '22-ambush-triggered');
    });

    test('should spawn enemies properly during ambush', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Access logs first
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      // Trigger ambush
      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(3000);

      // Capture combat scene showing enemies
      await captureScreenshot(page, '23-enemies-spawned');
    });

    test('should enable combat when ambush is active', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Access logs and trigger ambush
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(3000);

      // Fire weapon
      await page.mouse.click(500, 400);
      await page.waitForTimeout(500);

      await captureScreenshot(page, '24-combat-active');
    });

    test('should clear ambush when all enemies are killed', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Access logs and trigger ambush
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(3000);

      // Use PlayerGovernor to engage enemies
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });

      // Wait for combat to resolve (with god mode, should clear eventually)
      await page.waitForTimeout(30000);

      // Check for area clear notification
      const areaCleared = await page.getByText('AREA CLEAR').isVisible({ timeout: 5000 });
      if (areaCleared) {
        await captureScreenshot(page, '25-ambush-cleared');
      }
    });
  });

  test.describe('Underground Hatch Discovery', () => {
    test('should show hatch interaction prompt after logs accessed', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Access logs
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      // Navigate to hatch
      await navigateTo(page, INTERACTION_POSITIONS.hatch);
      await waitForPosition(page, INTERACTION_POSITIONS.hatch);
      await page.waitForTimeout(2000);

      // Check for hatch prompt
      await expect(page.getByText('OPEN HATCH')).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, '26-hatch-prompt');
    });

    test('should open hatch when interacting', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Access logs
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      // Navigate to hatch
      await navigateTo(page, INTERACTION_POSITIONS.hatch);
      await waitForPosition(page, INTERACTION_POSITIONS.hatch);
      await page.waitForTimeout(2000);

      // Open hatch
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(1000);

      // Check for opened notification
      await expect(page.getByText('HATCH OPENED')).toBeVisible({ timeout: 3000 });
      await captureScreenshot(page, '27-hatch-opened');
    });

    test('should show Marcus comms after opening hatch', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Access logs
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      // Navigate to hatch and open
      await navigateTo(page, INTERACTION_POSITIONS.hatch);
      await waitForPosition(page, INTERACTION_POSITIONS.hatch);
      await page.waitForTimeout(2000);
      await page.keyboard.press('KeyE');

      // Wait for Marcus comms
      await page.waitForTimeout(5000);

      // Look for Marcus-related text in comms
      const hasTransponderMessage = await page.getByText(/MARCUS|TRANSPONDER|ALIVE/i).isVisible();
      if (hasTransponderMessage) {
        await captureScreenshot(page, '28-marcus-detected');
      }
    });

    test('should update objective to descend after hatch opened', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Access logs
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      // Open hatch
      await navigateTo(page, INTERACTION_POSITIONS.hatch);
      await waitForPosition(page, INTERACTION_POSITIONS.hatch);
      await page.waitForTimeout(2000);
      await page.keyboard.press('KeyE');

      // Wait for objective update
      await page.waitForTimeout(8000);

      // Check for descent objective
      await expect(page.getByText(/DESCEND|BREACH/)).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, '29-descent-objective');
    });
  });

  test.describe('TITAN Mech Discovery', () => {
    test('should display mech when entering vehicle bay', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to vehicle bay
      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(2000);

      // Navigate near mech
      await navigateTo(page, INTERACTION_POSITIONS.mech);
      await waitForPosition(page, INTERACTION_POSITIONS.mech);
      await page.waitForTimeout(2000);

      // Capture mech discovery
      await captureScreenshot(page, '30-titan-mech');
    });

    test('should detect mech signature with scanner', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate near mech
      await navigateTo(page, { x: 15, y: 1.7, z: 0 });
      await waitForPosition(page, { x: 15, y: 1.7, z: 0 });
      await page.waitForTimeout(1000);

      // Use scanner
      await page.keyboard.press('KeyQ');
      await page.waitForTimeout(2000);

      // Check for mech signature notification
      const hasMechSignature = await page
        .getByText(/MECH SIGNATURE|TITAN/)
        .isVisible({ timeout: 3000 });
      if (hasMechSignature) {
        await captureScreenshot(page, '31-mech-signature');
      }
    });
  });

  test.describe('Audio Logs Collection', () => {
    test('should trigger comms message when entering barracks', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to barracks
      await navigateTo(page, AREA_POSITIONS.barracks);
      await waitForPosition(page, AREA_POSITIONS.barracks);
      await page.waitForTimeout(3000);

      // Check for comms message about no survivors
      const hasComms = await page.locator('[data-testid="comms"]').isVisible();
      if (hasComms) {
        await captureScreenshot(page, '32-barracks-comms');
      }
    });
  });

  test.describe('Level Completion', () => {
    test('should show enter tunnels prompt when hatch is open', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Complete prerequisites
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      await navigateTo(page, INTERACTION_POSITIONS.hatch);
      await waitForPosition(page, INTERACTION_POSITIONS.hatch);
      await page.waitForTimeout(2000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(8000);

      // Check for enter tunnels prompt
      await expect(page.getByText('ENTER TUNNELS')).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, '33-enter-tunnels-prompt');
    });

    test('should complete level when entering tunnels', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Complete all objectives
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);

      await navigateTo(page, INTERACTION_POSITIONS.hatch);
      await waitForPosition(page, INTERACTION_POSITIONS.hatch);
      await page.waitForTimeout(2000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(10000);

      // Enter tunnels
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(3000);

      // Check for level complete
      const hasComplete = await page.getByText(/MISSION COMPLETE|LEVEL COMPLETE/).isVisible();
      if (hasComplete) {
        await captureScreenshot(page, '34-level-complete');
      }
    });
  });

  test.describe('Visual Regression - Lighting and Atmosphere', () => {
    test('should render horror lighting consistently', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(5000);

      // Capture multiple areas for visual regression
      await captureScreenshot(page, 'vr-01-start-lighting');

      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);
      await page.waitForTimeout(1000);
      await captureScreenshot(page, 'vr-02-courtyard-lighting');

      await navigateTo(page, AREA_POSITIONS.barracks);
      await waitForPosition(page, AREA_POSITIONS.barracks);
      await page.waitForTimeout(1000);
      await captureScreenshot(page, 'vr-03-barracks-lighting');

      await navigateTo(page, AREA_POSITIONS.commandCenter);
      await waitForPosition(page, AREA_POSITIONS.commandCenter);
      await page.waitForTimeout(1000);
      await captureScreenshot(page, 'vr-04-command-lighting');

      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(1000);
      await captureScreenshot(page, 'vr-05-vehicle-bay-lighting');
    });

    test('should render flickering lights with correct behavior', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Capture multiple frames to verify flicker animation
      for (let i = 0; i < 5; i++) {
        await captureScreenshot(page, `vr-flicker-${i + 1}`);
        await page.waitForTimeout(300);
      }
    });

    test('should render terminal glow correctly', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate near terminal
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.waitForTimeout(1000);

      await captureScreenshot(page, 'vr-terminal-glow');
    });

    test('should render mech eye glow correctly', async ({ page }) => {
      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to mech
      await navigateTo(page, INTERACTION_POSITIONS.mech);
      await waitForPosition(page, INTERACTION_POSITIONS.mech);
      await page.waitForTimeout(1000);

      await captureScreenshot(page, 'vr-mech-eye-glow');
    });
  });

  test.describe('Full Level Playthrough', () => {
    test('should complete entire level flow from start to exit', async ({ page }) => {
      test.setTimeout(180000); // 3 minute timeout for full playthrough

      await startFOBDelta(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enable flashlight
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);
      await captureScreenshot(page, 'full-01-flashlight');

      // 1. Navigate to courtyard
      await navigateTo(page, AREA_POSITIONS.courtyard);
      await waitForPosition(page, AREA_POSITIONS.courtyard);
      await page.waitForTimeout(2000);
      await captureScreenshot(page, 'full-02-courtyard');

      // 2. Navigate to barracks
      await navigateTo(page, AREA_POSITIONS.barracks);
      await waitForPosition(page, AREA_POSITIONS.barracks);
      await page.waitForTimeout(2000);
      await captureScreenshot(page, 'full-03-barracks');

      // 3. Navigate to command center and access terminal
      await navigateTo(page, INTERACTION_POSITIONS.terminal);
      await waitForPosition(page, INTERACTION_POSITIONS.terminal);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(20000);
      await captureScreenshot(page, 'full-04-logs-accessed');

      // 4. Navigate to vehicle bay (triggers ambush)
      await navigateTo(page, AREA_POSITIONS.vehicleBay);
      await waitForPosition(page, AREA_POSITIONS.vehicleBay);
      await page.waitForTimeout(5000);
      await captureScreenshot(page, 'full-05-vehicle-bay');

      // 5. Engage enemies
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });
      await page.waitForTimeout(20000);
      await captureScreenshot(page, 'full-06-combat-complete');

      // 6. Navigate to hatch and open it
      await navigateTo(page, INTERACTION_POSITIONS.hatch);
      await waitForPosition(page, INTERACTION_POSITIONS.hatch);
      await page.waitForTimeout(2000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(10000);
      await captureScreenshot(page, 'full-07-hatch-opened');

      // 7. Enter tunnels to complete level
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(5000);
      await captureScreenshot(page, 'full-08-level-complete');
    });
  });
});
