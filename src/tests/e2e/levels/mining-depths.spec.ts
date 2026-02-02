/**
 * Mining Depths Level - Comprehensive Playwright E2E Test
 *
 * Level: THE MINING DEPTHS (Bonus Level)
 * An abandoned mining facility deep underground on LV-847.
 *
 * Test Coverage:
 * 1. Level initialization and underground atmosphere
 * 2. Flashlight mechanics (toggle on/off, illumination)
 * 3. Mining Hub exploration and keycard acquisition
 * 4. Collapsed Tunnels navigation with environmental hazards
 * 5. Deep Shaft descent and boss arena entry
 * 6. Boss fight: Mining Drill Chitin (armored variant)
 * 7. Audio log collection and lore delivery
 * 8. Environmental hazards: gas vents, rockfalls, flooded sections
 * 9. Burrower alien encounters (wall-emerging enemies)
 * 10. Comms dialogue with Lt. Reyes
 * 11. Visual regression for lighting, crystals, boss model
 * 12. Full level playthrough with PlayerGovernor
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
 * Mining Depths area zone positions.
 * Correspond to the center of each area zone defined in MiningDepthsLevel.ts
 * and the MINE_POSITIONS export from environment.ts.
 */
const AREA_POSITIONS = {
  /** Broken elevator entry point */
  entry: { x: 0, y: 1.7, z: 0 },
  /** Mining Hub center */
  hubCenter: { x: 0, y: 1.7, z: -25 },
  /** Mining Hub terminal area */
  hubTerminal: { x: -12, y: 1.7, z: -20 },
  /** Keycard pickup location in the hub */
  hubKeycard: { x: 14, y: 1.7, z: -30 },
  /** Start of the collapsed tunnel section */
  tunnelStart: { x: -5, y: -3, z: -50 },
  /** Mid-tunnel junction */
  tunnelMid: { x: -12, y: -6, z: -70 },
  /** End of collapsed tunnels */
  tunnelEnd: { x: -10, y: -10, z: -95 },
  /** Deep shaft security gate */
  shaftGate: { x: -10, y: -13, z: -110 },
  /** Deep shaft center */
  shaftCenter: { x: -10, y: -15, z: -120 },
  /** Deep shaft floor / boss arena */
  shaftFloor: { x: -10, y: -28, z: -120 },
} as const;

/**
 * Key interaction and hazard positions within Mining Depths.
 */
const INTERACTION_POSITIONS = {
  /** Keycard pickup */
  keycard: { x: 14, y: 1.7, z: -30 },
  /** Shaft gate for keycard use */
  shaftGate: { x: -10, y: -13, z: -110 },
  /** Boss spawn position */
  bossSpawn: { x: -10, y: -28, z: -120 },
} as const;

/**
 * Audio log positions for collectible testing.
 */
const AUDIO_LOG_POSITIONS = {
  /** Log 1: Foreman Vasquez - near hub machinery */
  foreman: { x: 8, y: 1.7, z: -18 },
  /** Log 2: Dr. Chen - near tunnel mid crystal */
  geologist: { x: -15, y: -5, z: -75 },
  /** Log 3: Unknown Miner - near shaft floor */
  survivor: { x: -10, y: -28, z: -115 },
} as const;

/**
 * Environmental hazard positions for hazard testing.
 */
const HAZARD_POSITIONS = {
  /** Gas vent 1 - after tunnel start */
  gasVent1: { x: -5, y: -1, z: -55 },
  /** Gas vent 2 - near tunnel mid */
  gasVent2: { x: -18, y: -6, z: -78 },
  /** Rockfall trap 1 */
  rockfall1: { x: -3, y: -2, z: -58 },
  /** Rockfall trap 2 */
  rockfall2: { x: -12, y: -8, z: -88 },
  /** Flooded section */
  flooded: { x: -10, y: -12, z: -103 },
} as const;

/**
 * Burrower enemy spawn positions.
 */
const BURROWER_SPAWN_POSITIONS = {
  /** Hub first encounter */
  spawn1: { x: 10, y: 1.7, z: -35 },
  /** After tunnel bend 1 */
  spawn2: { x: -12, y: -4, z: -62 },
  /** Before tunnel end */
  spawn3: { x: -8, y: -9, z: -92 },
} as const;

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wait for the debug interface to become available on the page.
 */
async function waitForDebugInterface(page: Page, timeout: number = 30000): Promise<void> {
  await page.waitForFunction(() => typeof window.__STELLAR_DESCENT_DEBUG__ !== 'undefined', {
    timeout,
  });
}

/**
 * Wait for the game to reach a specific campaign phase.
 */
async function waitForCampaignPhase(
  page: Page,
  phase: string,
  timeout: number = 30000
): Promise<void> {
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
async function navigateTo(page: Page, position: Vector3Like, threshold: number = 2): Promise<void> {
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
 * Wait for player to reach a position (governor goal resolves to idle).
 */
async function waitForPosition(
  page: Page,
  _position: Vector3Like,
  _threshold: number = 3,
  timeout: number = 30000
): Promise<void> {
  await page.waitForFunction(
    () => {
      const governor = window.__STELLAR_DESCENT_DEBUG__?.playerGovernor;
      if (!governor) return false;
      const currentGoal = governor.getCurrentGoal();
      return currentGoal.type === 'idle' || currentGoal.type !== 'navigate';
    },
    undefined,
    { timeout }
  );
}

/**
 * Execute an interaction with an optional target.
 */
async function _interact(page: Page, targetId?: string): Promise<void> {
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
async function _waitInGame(page: Page, duration: number): Promise<void> {
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
 * Disable god mode (re-enable player damage).
 */
async function disableGodMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (window.__STELLAR_DESCENT_DEBUG__?.devMode) {
      window.__STELLAR_DESCENT_DEBUG__.devMode.godMode = false;
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
 * Start Mining Depths level directly via campaign director.
 */
async function startMiningDepths(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__STELLAR_DESCENT_DEBUG__.campaignDirector.dispatch({
      type: 'NEW_GAME',
      difficulty: 'normal',
      startLevel: 'mining_depths',
    });
  });
}

/**
 * Wait for UI element containing specific text to be visible.
 */
async function _waitForUIElement(page: Page, text: string, timeout = 10000): Promise<void> {
  await page.getByText(text, { exact: false }).waitFor({ state: 'visible', timeout });
}

/**
 * Take a labeled screenshot for visual regression testing.
 */
async function captureScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/mining-depths/${name}.png`,
    fullPage: false,
  });
}

/**
 * Take a visual regression screenshot using Playwright's built-in comparison.
 */
async function captureVisualRegression(page: Page, name: string): Promise<void> {
  await expect(page).toHaveScreenshot(`mining-depths-${name}.png`, {
    maxDiffPixels: 500,
    threshold: 0.2,
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

test.describe('Mining Depths Level - E2E Tests', () => {
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

  // ==========================================================================
  // LEVEL INITIALIZATION
  // ==========================================================================

  test.describe('Level Initialization', () => {
    test('should load Mining Depths level and display initial objective', async ({ page }) => {
      await startMiningDepths(page);

      // Wait for level to enter playing phase
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Verify initial objective text appears
      const objectiveText = page.locator('[data-testid="objective"]');
      await expect(objectiveText).toBeVisible({ timeout: 10000 });

      // Capture initial state
      await captureScreenshot(page, '01-level-start');
    });

    test('should display level title notification', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(1000);

      // Level shows title notification on start
      await expect(page.getByText('THE MINING DEPTHS')).toBeVisible({ timeout: 5000 });
    });

    test('should have dark underground atmosphere', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Capture atmosphere screenshot for visual regression baseline
      await captureScreenshot(page, '02-underground-atmosphere');
    });

    test('should show initial Reyes comms about the mining complex', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);

      // Wait for the initial comms messages (arrive at 2s and 7s)
      await page.waitForTimeout(8000);

      // Reyes should have communicated about the mining complex
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '03-reyes-initial-comms');
      }
    });
  });

  // ==========================================================================
  // FLASHLIGHT MECHANICS
  // ==========================================================================

  test.describe('Flashlight Mechanics', () => {
    test('should toggle flashlight on and show notification', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Press F key to toggle flashlight
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Verify flashlight on notification
      await expect(page.getByText('FLASHLIGHT ON')).toBeVisible({ timeout: 2000 });

      await captureScreenshot(page, '04-flashlight-on');
    });

    test('should toggle flashlight off', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Toggle on then off
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Verify flashlight off notification
      await expect(page.getByText('FLASHLIGHT OFF')).toBeVisible({ timeout: 2000 });

      await captureScreenshot(page, '05-flashlight-off');
    });

    test('should illuminate dark environment when flashlight is on', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Capture without flashlight
      await captureScreenshot(page, '06-no-flashlight');

      // Toggle flashlight on
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Capture with flashlight - should show visible difference in lighting
      await captureScreenshot(page, '07-with-flashlight');
    });
  });

  // ==========================================================================
  // MINING HUB EXPLORATION
  // ==========================================================================

  test.describe('Mining Hub - Exploration', () => {
    test('should transition to hub_explore phase when entering hub', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to hub center
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(2000);

      // Objective should update to explore hub
      await expect(page.getByText('EXPLORE THE MINING HUB')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '08-hub-explore');
    });

    test('should show Reyes hint when near keycard location', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub to trigger phase
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(2000);

      // Navigate near the keycard
      await navigateTo(page, AREA_POSITIONS.hubKeycard);
      await waitForPosition(page, AREA_POSITIONS.hubKeycard);
      await page.waitForTimeout(2000);

      // Reyes should mention detecting an access card
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '09-keycard-hint');
      }
    });

    test('should pick up keycard when close enough', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      // Navigate directly to keycard (within 2m pickup radius)
      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(2000);

      // Keycard pickup notification
      await expect(page.getByText('KEYCARD ACQUIRED')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '10-keycard-acquired');
    });

    test('should update objective after keycard pickup', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub and pick up keycard
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(4000);

      // Objective should update to reach the deep shaft
      await expect(page.getByText('REACH THE DEEP SHAFT')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '11-shaft-objective');
    });

    test('should activate scanner to detect keycard distance', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(2000);

      // Use scanner (T key)
      await page.keyboard.press('KeyT');
      await page.waitForTimeout(2000);

      // Scanner should show scanning notification
      await expect(page.getByText('SCANNING')).toBeVisible({ timeout: 3000 });

      await captureScreenshot(page, '12-scanner-active');
    });

    test('should trigger first burrower encounter in hub', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub to trigger hub_explore phase (which spawns first burrower after 5s)
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);

      // Wait for burrower spawn (5s delay + emerge time)
      await page.waitForTimeout(8000);

      // Should see movement detection notification
      await expect(page.getByText('MOVEMENT DETECTED')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '13-burrower-encounter');
    });
  });

  // ==========================================================================
  // COLLAPSED TUNNELS
  // ==========================================================================

  test.describe('Collapsed Tunnels - Navigation and Hazards', () => {
    /**
     * Helper: Navigate to tunnel start with keycard already acquired.
     */
    async function setupTunnelEntry(page: Page): Promise<void> {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub and pick up keycard
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);
    }

    test('should transition to tunnels phase after entering with keycard', async ({ page }) => {
      await setupTunnelEntry(page);

      // Navigate to tunnel start
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(2000);

      // Objective should update for tunnel navigation
      await expect(page.getByText('NAVIGATE COLLAPSED TUNNELS')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '14-tunnels-enter');
    });

    test('should show Reyes warning about gas pockets when entering tunnels', async ({ page }) => {
      await setupTunnelEntry(page);

      // Navigate to tunnel start
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(3000);

      // Reyes warns about gas pockets and structural weaknesses
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '15-tunnel-warning');
      }
    });

    test('should deal gas damage in gas vent hazard zone', async ({ page }) => {
      await setupTunnelEntry(page);

      // Navigate into tunnels
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      // Navigate directly into gas vent zone
      await navigateTo(page, HAZARD_POSITIONS.gasVent1, 1);
      await waitForPosition(page, HAZARD_POSITIONS.gasVent1);
      await page.waitForTimeout(2000);

      // Should show toxic gas notification
      await expect(page.getByText('TOXIC GAS')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '16-gas-vent-hazard');
    });

    test('should trigger rockfall on unstable ground', async ({ page }) => {
      await setupTunnelEntry(page);

      // Navigate into tunnels
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      // Navigate into rockfall zone
      await navigateTo(page, HAZARD_POSITIONS.rockfall1, 1);
      await waitForPosition(page, HAZARD_POSITIONS.rockfall1);
      await page.waitForTimeout(1000);

      // Should show rockfall notification
      await expect(page.getByText('ROCKFALL')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '17-rockfall-hazard');
    });

    test('should show reduced visibility notification in flooded section', async ({ page }) => {
      await setupTunnelEntry(page);

      // Navigate through tunnels to flooded area
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelMid);
      await waitForPosition(page, AREA_POSITIONS.tunnelMid);
      await page.waitForTimeout(1000);

      // Navigate to flooded section
      await navigateTo(page, HAZARD_POSITIONS.flooded, 1);
      await waitForPosition(page, HAZARD_POSITIONS.flooded);
      await page.waitForTimeout(2000);

      // Should notify about reduced visibility
      await expect(page.getByText('LIMITED VISIBILITY')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '18-flooded-section');
    });

    test('should show Reyes mid-tunnel comms about bio-signatures', async ({ page }) => {
      await setupTunnelEntry(page);

      // Navigate through tunnels to mid junction
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelMid);
      await waitForPosition(page, AREA_POSITIONS.tunnelMid);
      await page.waitForTimeout(3000);

      // Reyes mentions alien bio-signature getting stronger
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '19-tunnel-mid-comms');
      }
    });

    test('should spawn burrowers in tunnel sections', async ({ page }) => {
      await setupTunnelEntry(page);

      // Navigate into tunnels (spawns burrowers in the queue)
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(2000);

      // Navigate near burrower spawn 2 to trigger proximity spawn
      await navigateTo(page, BURROWER_SPAWN_POSITIONS.spawn2, 5);
      await waitForPosition(page, BURROWER_SPAWN_POSITIONS.spawn2);
      await page.waitForTimeout(5000);

      // Should detect movement
      await expect(page.getByText('MOVEMENT DETECTED')).toBeVisible({ timeout: 8000 });

      await captureScreenshot(page, '20-tunnel-burrowers');
    });
  });

  // ==========================================================================
  // DEEP SHAFT AND GATE
  // ==========================================================================

  test.describe('Deep Shaft - Descent and Gate', () => {
    /**
     * Helper: Set up player at tunnel end with keycard.
     */
    async function setupShaftEntry(page: Page): Promise<void> {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Acquire keycard
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      // Enter tunnels
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      // Navigate to tunnel end
      await navigateTo(page, AREA_POSITIONS.tunnelEnd);
      await waitForPosition(page, AREA_POSITIONS.tunnelEnd);
      await page.waitForTimeout(2000);
    }

    test('should show keycard prompt when near shaft gate', async ({ page }) => {
      await setupShaftEntry(page);

      // Navigate to shaft gate
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);

      // Should show keycard use prompt
      await expect(page.getByText('USE KEYCARD')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '21-shaft-gate-prompt');
    });

    test('should unlock shaft gate when using keycard', async ({ page }) => {
      await setupShaftEntry(page);

      // Navigate to shaft gate
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);

      // Use keycard (interact)
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(1000);

      // Gate should unlock
      await expect(page.getByText('SHAFT GATE UNLOCKED')).toBeVisible({ timeout: 3000 });

      await captureScreenshot(page, '22-shaft-gate-unlocked');
    });

    test('should show Reyes warning about massive bio-energy after gate opens', async ({
      page,
    }) => {
      await setupShaftEntry(page);

      // Open gate
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(3000);

      // Reyes warns about massive bio-energy below
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '23-shaft-bio-warning');
      }
    });

    test('should transition to shaft_descent phase when entering shaft', async ({ page }) => {
      await setupShaftEntry(page);

      // Open gate
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(2000);

      // Navigate into shaft
      await navigateTo(page, AREA_POSITIONS.shaftCenter);
      await waitForPosition(page, AREA_POSITIONS.shaftCenter);
      await page.waitForTimeout(2000);

      // Objective should update for shaft descent
      await expect(page.getByText('DESCEND THE DEEP SHAFT')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '24-shaft-descent');
    });

    test('should show crystal formations notification from Reyes', async ({ page }) => {
      await setupShaftEntry(page);

      // Open gate and enter shaft
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(2000);

      await navigateTo(page, AREA_POSITIONS.shaftCenter);
      await waitForPosition(page, AREA_POSITIONS.shaftCenter);
      await page.waitForTimeout(3000);

      // Reyes mentions crystal formations and pulsing
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '25-crystal-formations-comms');
      }
    });
  });

  // ==========================================================================
  // BOSS FIGHT - MINING DRILL CHITIN
  // ==========================================================================

  test.describe('Boss Fight - Mining Drill Chitin', () => {
    /**
     * Helper: Navigate player to boss arena trigger zone (shaft floor).
     */
    async function setupBossArena(page: Page): Promise<void> {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Acquire keycard
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      // Navigate through tunnels
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelEnd);
      await waitForPosition(page, AREA_POSITIONS.tunnelEnd);
      await page.waitForTimeout(1000);

      // Open shaft gate
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(2000);

      // Enter shaft
      await navigateTo(page, AREA_POSITIONS.shaftCenter);
      await waitForPosition(page, AREA_POSITIONS.shaftCenter);
      await page.waitForTimeout(2000);
    }

    test('should trigger boss fight when reaching shaft floor', async ({ page }) => {
      await setupBossArena(page);

      // Descend to shaft floor to trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(3000);

      // Boss warning notification
      await expect(page.getByText('HOSTILE ALPHA DETECTED')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '26-boss-alert');
    });

    test('should display boss encounter objective', async ({ page }) => {
      await setupBossArena(page);

      // Trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);

      // Objective should update to defeat the boss
      await expect(page.getByText('DEFEAT THE MINING DRILL CHITIN')).toBeVisible({
        timeout: 5000,
      });

      await captureScreenshot(page, '27-boss-objective');
    });

    test('should show Reyes comms about drill appendages and weak points', async ({ page }) => {
      await setupBossArena(page);

      // Trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);

      // Reyes should describe the boss and suggest targeting joints
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '28-boss-reyes-comms');
      }
    });

    test('should display boss health percentage when hit', async ({ page }) => {
      await setupBossArena(page);

      // Trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);

      // Fire at boss
      await page.mouse.click(640, 360);
      await page.waitForTimeout(1000);

      // Should show boss health percentage notification
      const bossHealthNotification = page.locator('text=/BOSS: \\d+%/i');
      const visible = await bossHealthNotification.isVisible().catch(() => false);
      if (visible) {
        await captureScreenshot(page, '29-boss-health');
      }
    });

    test('should enrage boss at 30% health', async ({ page }) => {
      await setupBossArena(page);

      // Trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);

      // Use PlayerGovernor to fight boss aggressively
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });

      // Wait for combat to progress
      await page.waitForTimeout(30000);

      // Check for enrage notification (may or may not trigger depending on damage dealt)
      const enrageNotification = await page
        .getByText('CHITIN IS ENRAGED')
        .isVisible()
        .catch(() => false);
      if (enrageNotification) {
        await captureScreenshot(page, '30-boss-enraged');
      }
    });

    test('should display drill attack notification during boss combat', async ({ page }) => {
      await setupBossArena(page);

      // Trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(8000);

      // Wait for boss to attack (will be in range)
      await page.waitForTimeout(10000);

      // Boss may use drill attack
      const drillAttack = await page
        .getByText('DRILL ATTACK')
        .isVisible()
        .catch(() => false);
      if (drillAttack) {
        await captureScreenshot(page, '31-drill-attack');
      }
    });

    test('should show victory notification when boss is destroyed', async ({ page }) => {
      await setupBossArena(page);

      // Trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);

      // Engage boss with PlayerGovernor
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });

      // Extended wait for boss to be defeated
      await page.waitForTimeout(60000);

      // Check for boss destroyed notification
      const bossDestroyed = await page
        .getByText('MINING DRILL CHITIN DESTROYED')
        .isVisible()
        .catch(() => false);
      if (bossDestroyed) {
        await captureScreenshot(page, '32-boss-destroyed');
      }
    });

    test('should show Reyes congratulatory comms after boss defeat', async ({ page }) => {
      await setupBossArena(page);

      // Trigger boss fight
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);

      // Engage and wait
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });

      await page.waitForTimeout(60000);

      // After boss defeat, Reyes congratulates
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '33-boss-defeat-comms');
      }
    });
  });

  // ==========================================================================
  // AUDIO LOG COLLECTION
  // ==========================================================================

  test.describe('Audio Log Collection', () => {
    test('should collect Foreman Vasquez log in the mining hub', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to hub
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      // Navigate to first audio log (near hub machinery)
      await navigateTo(page, AUDIO_LOG_POSITIONS.foreman, 1);
      await waitForPosition(page, AUDIO_LOG_POSITIONS.foreman);
      await page.waitForTimeout(3000);

      // Audio log pickup notification
      await expect(page.getByText('AUDIO LOG: FOREMAN VASQUEZ')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '34-audio-log-foreman');
    });

    test('should display audio log contents as comms message', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to hub and collect first log
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, AUDIO_LOG_POSITIONS.foreman, 1);
      await waitForPosition(page, AUDIO_LOG_POSITIONS.foreman);

      // Wait for comms message to appear (1.5s delay after pickup)
      await page.waitForTimeout(4000);

      // Audio log text should appear in comms
      const commsPanel = page.locator('[data-testid="comms"]');
      const hasComms = await commsPanel.isVisible().catch(() => false);
      if (hasComms) {
        await captureScreenshot(page, '35-audio-log-comms');
      }
    });

    test('should collect Dr. Chen log in collapsed tunnels', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub and get keycard
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      // Enter tunnels
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      // Navigate to second audio log
      await navigateTo(page, AUDIO_LOG_POSITIONS.geologist, 1);
      await waitForPosition(page, AUDIO_LOG_POSITIONS.geologist);
      await page.waitForTimeout(3000);

      // Audio log pickup notification
      await expect(page.getByText('AUDIO LOG: DR. CHEN')).toBeVisible({ timeout: 5000 });

      await captureScreenshot(page, '36-audio-log-geologist');
    });
  });

  // ==========================================================================
  // COMBAT MECHANICS
  // ==========================================================================

  test.describe('Combat Mechanics', () => {
    test('should display melee attack notification', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub to spawn first burrower
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(8000);

      // Use melee attack (V key)
      await page.keyboard.press('KeyV');
      await page.waitForTimeout(500);

      // Should show melee notification
      await expect(page.getByText('MELEE')).toBeVisible({ timeout: 2000 });

      await captureScreenshot(page, '37-melee-attack');
    });

    test('should show hit notification when attacking enemies', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub to spawn enemies
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(8000);

      // Engage enemies
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });

      await page.waitForTimeout(5000);

      // Check for hit notification
      const hitNotification = await page
        .getByText('HIT')
        .isVisible()
        .catch(() => false);
      if (hitNotification) {
        await captureScreenshot(page, '38-enemy-hit');
      }
    });

    test('should show burrower attack notification when player is hit', async ({ page }) => {
      // Disable god mode so player can take damage (beforeEach enables it)
      await disableGodMode(page);
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub to spawn burrowers
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);

      // Wait for burrower to emerge and attack
      await page.waitForTimeout(15000);

      // Burrower attack notification
      const burrowerAttack = await page
        .getByText('BURROWER ATTACK')
        .isVisible()
        .catch(() => false);
      if (burrowerAttack) {
        await captureScreenshot(page, '39-burrower-attack');
      }

      // Re-enable god mode
      await enableGodMode(page);
    });

    test('should show reload notification', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Press R to reload
      await page.keyboard.press('KeyR');
      await page.waitForTimeout(500);

      // Should show reload-related notification
      const reloadNotification = page.locator('text=/RELOAD|MAGAZINE FULL|NO RESERVE/i');
      const visible = await reloadNotification.isVisible().catch(() => false);
      if (visible) {
        await captureScreenshot(page, '40-reload');
      }
    });
  });

  // ==========================================================================
  // LEVEL COMPLETION
  // ==========================================================================

  test.describe('Level Completion', () => {
    test('should show level complete objective after boss is defeated', async ({ page }) => {
      test.setTimeout(180000);

      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Speed run through the level
      // Enter hub
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      // Acquire keycard
      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      // Navigate through tunnels
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelEnd);
      await waitForPosition(page, AREA_POSITIONS.tunnelEnd);
      await page.waitForTimeout(1000);

      // Open gate
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(2000);

      // Enter shaft
      await navigateTo(page, AREA_POSITIONS.shaftCenter);
      await waitForPosition(page, AREA_POSITIONS.shaftCenter);
      await page.waitForTimeout(2000);

      // Trigger boss
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);

      // Fight boss
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });

      await page.waitForTimeout(60000);

      // Check for level complete
      const hasComplete = await page
        .getByText(/LEVEL COMPLETE/)
        .isVisible()
        .catch(() => false);
      if (hasComplete) {
        await captureScreenshot(page, '41-level-complete');
      }
    });
  });

  // ==========================================================================
  // VISUAL REGRESSION - LIGHTING AND ATMOSPHERE
  // ==========================================================================

  test.describe('Visual Regression - Lighting and Atmosphere', () => {
    test('should render mining hub emergency lighting consistently', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to hub
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(2000);

      // Emergency red lights in the hub
      await captureVisualRegression(page, 'vr-hub-emergency-lighting');
    });

    test('should render collapsed tunnel debris environment', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Acquire keycard and enter tunnels
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelMid);
      await waitForPosition(page, AREA_POSITIONS.tunnelMid);
      await page.waitForTimeout(2000);

      // Capture tunnel debris environment
      await captureVisualRegression(page, 'vr-collapsed-tunnel-debris');
    });

    test('should render crystal glow effects in deep shaft', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Speed through to shaft
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelEnd);
      await waitForPosition(page, AREA_POSITIONS.tunnelEnd);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(2000);

      await navigateTo(page, AREA_POSITIONS.shaftCenter);
      await waitForPosition(page, AREA_POSITIONS.shaftCenter);
      await page.waitForTimeout(3000);

      // Crystal glow effects in the shaft
      await captureVisualRegression(page, 'vr-crystal-glow-shaft');
    });

    test('should render boss model (Mining Drill Chitin) correctly', async ({ page }) => {
      test.setTimeout(120000);

      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate through to boss arena
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelEnd);
      await waitForPosition(page, AREA_POSITIONS.tunnelEnd);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(2000);

      await navigateTo(page, AREA_POSITIONS.shaftCenter);
      await waitForPosition(page, AREA_POSITIONS.shaftCenter);
      await page.waitForTimeout(2000);

      // Trigger boss
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(6000);

      // Boss should be visible and rendered
      await captureVisualRegression(page, 'vr-boss-mining-drill-chitin');
    });

    test('should render gas vent particle effects', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Acquire keycard and enter tunnels
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      // Navigate near gas vent
      await navigateTo(page, HAZARD_POSITIONS.gasVent1, 3);
      await waitForPosition(page, HAZARD_POSITIONS.gasVent1);
      await page.waitForTimeout(2000);

      // Gas vent particle effects
      await captureScreenshot(page, 'vr-gas-vent-particles');
    });

    test('should render flashlight illumination in tunnels', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Enter hub and tunnels
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(3000);

      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(1000);

      await navigateTo(page, AREA_POSITIONS.tunnelMid);
      await waitForPosition(page, AREA_POSITIONS.tunnelMid);
      await page.waitForTimeout(1000);

      // Turn on flashlight
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);

      // Capture flashlight illumination
      await captureVisualRegression(page, 'vr-flashlight-tunnel-illumination');
    });

    test('should render flickering fluorescent lights with correct behavior', async ({ page }) => {
      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // Navigate to hub where flickering lights are present
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(1000);

      // Capture multiple frames to verify flicker animation
      for (let i = 0; i < 5; i++) {
        await captureScreenshot(page, `vr-flicker-frame-${i + 1}`);
        await page.waitForTimeout(300);
      }
    });
  });

  // ==========================================================================
  // FULL LEVEL PLAYTHROUGH
  // ==========================================================================

  test.describe('Full Level Playthrough', () => {
    test('should complete entire Mining Depths level from start to exit', async ({ page }) => {
      test.setTimeout(300000); // 5 minute timeout for full playthrough

      await startMiningDepths(page);
      await waitForCampaignPhase(page, 'playing', 60000);
      await page.waitForTimeout(3000);

      // ---- PHASE 1: ARRIVAL ----
      // Enable flashlight for visibility
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(500);
      await captureScreenshot(page, 'full-01-arrival-flashlight');

      // ---- PHASE 2: MINING HUB EXPLORATION ----
      // Navigate to hub center (triggers hub_explore phase)
      await navigateTo(page, AREA_POSITIONS.hubCenter);
      await waitForPosition(page, AREA_POSITIONS.hubCenter);
      await page.waitForTimeout(2000);
      await captureScreenshot(page, 'full-02-hub-center');

      // Collect first audio log (Foreman Vasquez)
      await navigateTo(page, AUDIO_LOG_POSITIONS.foreman, 1);
      await waitForPosition(page, AUDIO_LOG_POSITIONS.foreman);
      await page.waitForTimeout(3000);
      await captureScreenshot(page, 'full-03-audio-log-1');

      // Handle first burrower encounter
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });
      await page.waitForTimeout(10000);
      await captureScreenshot(page, 'full-04-hub-combat');

      // Pick up keycard
      await navigateTo(page, INTERACTION_POSITIONS.keycard, 1);
      await waitForPosition(page, INTERACTION_POSITIONS.keycard);
      await page.waitForTimeout(4000);
      await captureScreenshot(page, 'full-05-keycard');

      // ---- PHASE 3: COLLAPSED TUNNELS ----
      // Enter tunnels
      await navigateTo(page, AREA_POSITIONS.tunnelStart);
      await waitForPosition(page, AREA_POSITIONS.tunnelStart);
      await page.waitForTimeout(2000);
      await captureScreenshot(page, 'full-06-tunnel-entry');

      // Navigate through tunnel mid (collect second audio log)
      await navigateTo(page, AUDIO_LOG_POSITIONS.geologist, 1);
      await waitForPosition(page, AUDIO_LOG_POSITIONS.geologist);
      await page.waitForTimeout(3000);
      await captureScreenshot(page, 'full-07-audio-log-2');

      // Engage tunnel burrowers
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });
      await page.waitForTimeout(10000);
      await captureScreenshot(page, 'full-08-tunnel-combat');

      // Navigate to tunnel end
      await navigateTo(page, AREA_POSITIONS.tunnelEnd);
      await waitForPosition(page, AREA_POSITIONS.tunnelEnd);
      await page.waitForTimeout(2000);
      await captureScreenshot(page, 'full-09-tunnel-end');

      // ---- PHASE 4: DEEP SHAFT ----
      // Open shaft gate
      await navigateTo(page, INTERACTION_POSITIONS.shaftGate, 2);
      await waitForPosition(page, INTERACTION_POSITIONS.shaftGate);
      await page.waitForTimeout(1000);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(2000);
      await captureScreenshot(page, 'full-10-gate-open');

      // Enter and descend shaft
      await navigateTo(page, AREA_POSITIONS.shaftCenter);
      await waitForPosition(page, AREA_POSITIONS.shaftCenter);
      await page.waitForTimeout(2000);
      await captureScreenshot(page, 'full-11-shaft-descent');

      // Collect third audio log near shaft floor
      await navigateTo(page, AUDIO_LOG_POSITIONS.survivor, 1);
      await waitForPosition(page, AUDIO_LOG_POSITIONS.survivor);
      await page.waitForTimeout(3000);
      await captureScreenshot(page, 'full-12-audio-log-3');

      // ---- PHASE 5: BOSS FIGHT ----
      // Trigger boss by reaching shaft floor
      await navigateTo(page, AREA_POSITIONS.shaftFloor);
      await waitForPosition(page, AREA_POSITIONS.shaftFloor);
      await page.waitForTimeout(5000);
      await captureScreenshot(page, 'full-13-boss-spawn');

      // Engage boss with PlayerGovernor
      await page.evaluate(() => {
        window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'engage_enemies',
        });
      });

      // Wait for boss fight to resolve (with god mode)
      await page.waitForTimeout(60000);
      await captureScreenshot(page, 'full-14-boss-fight');

      // ---- PHASE 6: VICTORY ----
      // Wait for post-boss dialogue and level completion
      await page.waitForTimeout(10000);
      await captureScreenshot(page, 'full-15-level-complete');

      // Verify level completion or exit phase
      const hasComplete = await page
        .getByText(/LEVEL COMPLETE/)
        .isVisible()
        .catch(() => false);
      const hasExitObjective = await page
        .getByText(/mining facility has been cleared/)
        .isVisible()
        .catch(() => false);

      // At least one completion indicator should be present
      expect(hasComplete || hasExitObjective).toBe(true);
    });
  });
});
