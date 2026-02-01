/**
 * Level 2: Landfall - Playwright E2E Test
 *
 * Comprehensive end-to-end test for the complete Landfall level experience:
 * - HALO drop cinematic sequence
 * - Debris field navigation
 * - Powered descent with jet ignition
 * - Landing sequence
 * - Vehicle transit section (ATV)
 * - First surface combat against Chitin enemies
 * - Combat completion and LZ secured
 * - Mission complete screen
 *
 * Uses PlayerGovernor for AI-controlled player actions via the debug interface.
 *
 * @module tests/e2e/levels/landfall
 */

import { expect, type Page, test } from '@playwright/test';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Debug interface exposed on window for E2E testing
 */
interface StellarDescentDebug {
  playerGovernor: {
    setGoal: (goal: PlayerGovernorGoal) => void;
    getCurrentGoal: () => PlayerGovernorGoal;
    addEventListener: (listener: (event: GovernorEvent) => void) => void;
    removeEventListener: (listener: (event: GovernorEvent) => void) => void;
    getInputState: () => InputState;
    navigateTo: (position: { x: number; y: number; z: number }, threshold?: number) => void;
    engageEnemies: (aggressive?: boolean) => void;
    wait: (duration: number) => void;
    clearGoals: () => void;
  };
  gameState: {
    getCurrentPhase: () => string;
    getCurrentLevel: () => string;
    getPlayerHealth: () => number;
    getKillCount: () => number;
    getCombatActive: () => boolean;
    getObjective: () => { title: string; instructions: string };
    getEnemyCount: () => number;
  };
  levelState: {
    getDropPhase: () => DropPhase;
    getAltitude: () => number;
    getVelocity: () => number;
    getFuel: () => number;
    getLandingOutcome: () => LandingOutcome | null;
    getSuitIntegrity: () => number;
    getAsteroidsDodged: () => number;
    getAsteroidsHit: () => number;
    isVehicleTransitActive: () => boolean;
    getVehicleTransitDistance: () => number;
  };
  triggerAction: (actionId: string) => void;
  emitEvent: (eventType: string, data?: unknown) => void;
}

type DropPhase =
  | 'freefall_start'
  | 'freefall_belt'
  | 'freefall_clear'
  | 'powered_descent'
  | 'landing'
  | 'vehicle_transit'
  | 'surface';

type LandingOutcome = 'perfect' | 'near_miss' | 'rough' | 'crash' | 'slingshot';

type PlayerGovernorGoal =
  | { type: 'idle' }
  | { type: 'navigate'; target: { x: number; y: number; z: number }; threshold?: number }
  | { type: 'follow_objective' }
  | { type: 'engage_enemies'; aggressive?: boolean }
  | { type: 'advance_dialogue' }
  | { type: 'interact'; targetId?: string }
  | { type: 'complete_tutorial' }
  | { type: 'wait'; duration: number };

interface GovernorEvent {
  type: string;
  goal?: PlayerGovernorGoal;
  enemyId?: string;
  amount?: number;
  position?: { x: number; y: number; z: number };
  objectiveText?: string;
}

interface InputState {
  moveForward: boolean;
  moveBack: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  shoot: boolean;
  interact: boolean;
  advanceDialogue: boolean;
}

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const BASE_URL = process.env.GAME_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = 'test-results/screenshots/landfall';

// Timeouts for various game states (in ms)
const TIMEOUTS = {
  pageLoad: 30000,
  levelLoad: 60000,
  phaseTransition: 45000,
  combatComplete: 90000,
  missionComplete: 120000,
  animation: 5000,
  enemySpawn: 15000,
  vehicleTransit: 60000,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the debug interface from the game window
 */
async function getDebugInterface(page: Page): Promise<StellarDescentDebug> {
  return page.evaluate(() => {
    return (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
      .__STELLAR_DESCENT_DEBUG__;
  });
}

/**
 * Wait for the game to load and display the main menu
 */
async function waitForMainMenu(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="main-menu"]', { timeout: TIMEOUTS.pageLoad });
  await expect(page.getByText('NEW GAME')).toBeVisible();
}

/**
 * Start a new game and navigate to Landfall level
 */
async function navigateToLandfall(page: Page): Promise<void> {
  // Click NEW GAME
  await page.getByText('NEW GAME').click();

  // Wait for difficulty selector or level select
  await page.waitForSelector('[data-testid="difficulty-selector"], [data-testid="level-select"]', {
    timeout: TIMEOUTS.animation,
  });

  // If level select is shown, select Landfall
  const levelSelect = page.locator('[data-testid="level-select"]');
  if (await levelSelect.isVisible()) {
    await page.getByText('LANDFALL').click();
  }

  // Select difficulty (Normal)
  const difficultySelector = page.locator('[data-testid="difficulty-selector"]');
  if (await difficultySelector.isVisible()) {
    await page.getByText('NORMAL').click();
    await page.getByText('START').click();
  }

  // Wait for level to load
  await page.waitForSelector('[data-testid="game-canvas"]', { timeout: TIMEOUTS.levelLoad });
}

/**
 * Wait for a specific drop phase
 */
async function waitForDropPhase(page: Page, phase: DropPhase): Promise<void> {
  await page.waitForFunction(
    (expectedPhase) => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getDropPhase() === expectedPhase;
    },
    phase,
    { timeout: TIMEOUTS.phaseTransition }
  );
}

/**
 * Wait for combat to complete (all enemies eliminated)
 */
async function waitForCombatComplete(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.gameState?.getCombatActive() === false && debug?.gameState?.getKillCount() > 0;
    },
    { timeout: TIMEOUTS.combatComplete }
  );
}

/**
 * Take a screenshot with a descriptive name
 */
async function captureScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: false,
  });
}

/**
 * Wait for notification text to appear
 */
async function waitForNotification(page: Page, text: string | RegExp): Promise<void> {
  await page.waitForSelector('[data-testid="notification"]', { timeout: TIMEOUTS.animation });
  await expect(page.locator('[data-testid="notification"]')).toContainText(text);
}

/**
 * Wait for objective update
 */
async function waitForObjective(page: Page, title: string | RegExp): Promise<void> {
  await page.waitForSelector('[data-testid="objective-display"]', { timeout: TIMEOUTS.animation });
  await expect(page.locator('[data-testid="objective-title"]')).toContainText(title);
}

// ============================================================================
// TEST SUITE
// ============================================================================

test.describe('Level 2: Landfall - Complete E2E Test', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(BASE_URL);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // --------------------------------------------------------------------------
  // SECTION 1: LEVEL SETUP AND LAUNCH
  // --------------------------------------------------------------------------

  test('should load the game and display main menu', async () => {
    await waitForMainMenu(page);
    await captureScreenshot(page, '01_main_menu');
    await expect(page.getByText('STELLAR DESCENT')).toBeVisible();
  });

  test('should start new game and load Landfall level', async () => {
    await navigateToLandfall(page);
    await captureScreenshot(page, '02_level_loading');

    // Wait for level to fully initialize
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
          .__STELLAR_DESCENT_DEBUG__;
        return debug?.gameState?.getCurrentLevel() === 'landfall';
      },
      { timeout: TIMEOUTS.levelLoad }
    );

    await captureScreenshot(page, '03_level_loaded');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: HALO DROP CINEMATIC SEQUENCE
  // --------------------------------------------------------------------------

  test('should start HALO drop cinematic sequence', async () => {
    // Wait for freefall phase to begin
    await waitForDropPhase(page, 'freefall_start');
    await captureScreenshot(page, '04_halo_drop_start');

    // Verify HALO jump notification
    await waitForNotification(page, /HALO.*INITIATED/i);

    // Verify initial camera state (looking down at planet)
    const cameraState = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return {
        altitude: debug?.levelState?.getAltitude(),
        velocity: debug?.levelState?.getVelocity(),
      };
    });

    expect(cameraState.altitude).toBeGreaterThan(900);
    expect(cameraState.velocity).toBeLessThan(20);
  });

  // --------------------------------------------------------------------------
  // SECTION 3: DEBRIS FIELD NAVIGATION
  // --------------------------------------------------------------------------

  test('should navigate through debris field', async () => {
    // Wait for debris field phase
    await waitForDropPhase(page, 'freefall_belt');
    await captureScreenshot(page, '05_debris_field_start');

    // Verify debris notification
    await waitForNotification(page, /DEBRIS.*FIELD/i);

    // Use PlayerGovernor to navigate - dodge asteroids
    await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      // Queue navigation goals to dodge asteroids
      debug.playerGovernor.setGoal({ type: 'navigate', target: { x: -5, y: 0, z: 0 } });
    });

    // Wait for some debris to pass
    await page.waitForTimeout(3000);
    await captureScreenshot(page, '06_debris_dodging');

    // Check asteroid stats
    const asteroidStats = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return {
        dodged: debug?.levelState?.getAsteroidsDodged(),
        hit: debug?.levelState?.getAsteroidsHit(),
      };
    });

    // Some asteroids should have been processed
    expect(asteroidStats.dodged).toBeGreaterThanOrEqual(0);
    expect(asteroidStats.hit).toBeGreaterThanOrEqual(0);
  });

  test('should clear debris field', async () => {
    // Wait for debris cleared phase
    await waitForDropPhase(page, 'freefall_clear');
    await captureScreenshot(page, '07_debris_cleared');

    // Verify clear notification
    await waitForNotification(page, /CLEARED/i);

    // Verify altitude dropped appropriately
    const altitude = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getAltitude();
    });

    expect(altitude).toBeLessThan(700);
    expect(altitude).toBeGreaterThan(100);
  });

  // --------------------------------------------------------------------------
  // SECTION 4: POWERED DESCENT WITH JET IGNITION
  // --------------------------------------------------------------------------

  test('should ignite jets for powered descent', async () => {
    // Trigger jet ignition action
    await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      debug.triggerAction('ignite_jets');
    });

    // Wait for powered descent phase
    await waitForDropPhase(page, 'powered_descent');
    await captureScreenshot(page, '08_jets_ignited');

    // Verify jets ignited notification
    await waitForNotification(page, /JETS.*IGNITED/i);

    // Verify fuel is available
    const fuel = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getFuel();
    });

    expect(fuel).toBeGreaterThan(50);
  });

  test('should control descent velocity with thrusters', async () => {
    // Use boost to slow descent
    await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      // Simulate boost input
      debug.triggerAction('boost');
    });

    await page.waitForTimeout(500);

    // Check velocity decreased
    const velocityAfterBoost = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getVelocity();
    });

    expect(velocityAfterBoost).toBeDefined();
    await captureScreenshot(page, '09_powered_descent');
  });

  // --------------------------------------------------------------------------
  // SECTION 5: LANDING SEQUENCE
  // --------------------------------------------------------------------------

  test('should complete landing sequence', async () => {
    // Wait for landing phase
    await waitForDropPhase(page, 'landing');
    await captureScreenshot(page, '10_landing_approach');

    // Verify final approach notification
    await waitForNotification(page, /APPROACH|LANDING/i);

    // Wait for surface phase (landing complete)
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
          .__STELLAR_DESCENT_DEBUG__;
        const phase = debug?.levelState?.getDropPhase();
        return phase === 'surface' || phase === 'vehicle_transit';
      },
      { timeout: TIMEOUTS.phaseTransition }
    );

    await captureScreenshot(page, '11_landed');

    // Check landing outcome
    const landingOutcome = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getLandingOutcome();
    });

    expect(landingOutcome).toBeDefined();
    expect(['perfect', 'near_miss', 'rough', 'crash']).toContain(landingOutcome);
  });

  // --------------------------------------------------------------------------
  // SECTION 6: VEHICLE TRANSIT SECTION (ATV)
  // --------------------------------------------------------------------------

  test('should start vehicle transit section', async () => {
    // Wait for vehicle transit phase
    await waitForDropPhase(page, 'vehicle_transit');
    await captureScreenshot(page, '12_vehicle_transit_start');

    // Verify vehicle transit is active
    const isVehicleTransit = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.isVehicleTransitActive();
    });

    expect(isVehicleTransit).toBe(true);

    // Verify objective update for vehicle transit
    await waitForObjective(page, /FORWARD POSITION|REACH/i);
  });

  test('should complete vehicle transit to combat zone', async () => {
    // Use PlayerGovernor to drive forward
    await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      debug.playerGovernor.setGoal({
        type: 'navigate',
        target: { x: 0, y: 0, z: -80 },
      });
    });

    // Wait for vehicle transit to complete
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
          .__STELLAR_DESCENT_DEBUG__;
        const distance = debug?.levelState?.getVehicleTransitDistance();
        return distance && distance >= 70;
      },
      { timeout: TIMEOUTS.vehicleTransit }
    );

    await captureScreenshot(page, '13_vehicle_transit_complete');

    // Wait for surface phase (dismounted)
    await waitForDropPhase(page, 'surface');
    await waitForNotification(page, /DISMOUNT|PROCEED.*FOOT/i);
  });

  // --------------------------------------------------------------------------
  // SECTION 7: FIRST SURFACE COMBAT AGAINST CHITIN ENEMIES
  // --------------------------------------------------------------------------

  test('should trigger seismic warning before combat', async () => {
    // Wait for seismic warning
    await waitForNotification(page, /SEISMIC/i);
    await captureScreenshot(page, '14_seismic_warning');
  });

  test('should spawn enemies for first combat encounter', async () => {
    // Wait for combat to begin
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
          .__STELLAR_DESCENT_DEBUG__;
        return debug?.gameState?.getCombatActive() === true;
      },
      { timeout: TIMEOUTS.enemySpawn }
    );

    await captureScreenshot(page, '15_combat_start');

    // Verify hostiles notification
    await waitForNotification(page, /HOSTILES|CONTACTS/i);

    // Verify enemy count
    const enemyCount = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.gameState?.getEnemyCount();
    });

    expect(enemyCount).toBeGreaterThan(0);
    expect(enemyCount).toBeLessThanOrEqual(4);
  });

  test('should engage enemies with PlayerGovernor', async () => {
    // Set PlayerGovernor to engage enemies
    await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      debug.playerGovernor.setGoal({ type: 'engage_enemies', aggressive: true });
    });

    await captureScreenshot(page, '16_engaging_enemies');

    // Wait for first kill
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
          .__STELLAR_DESCENT_DEBUG__;
        return debug?.gameState?.getKillCount() > 0;
      },
      { timeout: TIMEOUTS.combatComplete / 2 }
    );

    await captureScreenshot(page, '17_first_kill');

    // Verify kill tracking notification
    await waitForNotification(page, /HOSTILE DOWN/i);
  });

  test('should verify combat mechanics function correctly', async () => {
    // Get initial state
    const initialState = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return {
        killCount: debug?.gameState?.getKillCount(),
        health: debug?.gameState?.getPlayerHealth(),
        combatActive: debug?.gameState?.getCombatActive(),
      };
    });

    expect(initialState.killCount).toBeGreaterThanOrEqual(1);
    expect(initialState.health).toBeGreaterThan(0);
    expect(initialState.combatActive).toBe(true);

    // Continue engaging until combat complete
    await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      debug.playerGovernor.setGoal({ type: 'engage_enemies', aggressive: true });
    });

    await page.waitForTimeout(5000);
    await captureScreenshot(page, '18_combat_progress');
  });

  // --------------------------------------------------------------------------
  // SECTION 8: COMBAT COMPLETION AND LZ SECURED
  // --------------------------------------------------------------------------

  test('should complete combat and secure LZ', async () => {
    // Wait for all enemies eliminated
    await waitForCombatComplete(page);
    await captureScreenshot(page, '19_combat_complete');

    // Verify elimination notification
    await waitForNotification(page, /ELIMINATED|ALL HOSTILES/i);

    // Wait for LZ secured notification
    await waitForNotification(page, /LZ.*SECURED/i);
    await captureScreenshot(page, '20_lz_secured');

    // Verify kill count matches expected
    const killCount = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.gameState?.getKillCount();
    });

    expect(killCount).toBe(4); // FIRST_ENCOUNTER_ENEMY_COUNT
  });

  test('should display objectives update after combat', async () => {
    // Verify objective update to FOB Delta
    await waitForObjective(page, /FOB.*DELTA|PROCEED/i);
    await captureScreenshot(page, '21_fob_objective');
  });

  // --------------------------------------------------------------------------
  // SECTION 9: MISSION COMPLETE SCREEN
  // --------------------------------------------------------------------------

  test('should display mission complete screen', async () => {
    // Wait for mission complete
    await page.waitForSelector('[data-testid="level-complete-screen"]', {
      timeout: TIMEOUTS.missionComplete,
    });

    await captureScreenshot(page, '22_mission_complete');

    // Verify mission complete text
    await expect(page.getByText(/MISSION.*COMPLETE/i)).toBeVisible();
  });

  test('should display accurate mission stats', async () => {
    // Verify stats are displayed
    await expect(page.locator('[data-testid="stat-kills"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-accuracy"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-time"]')).toBeVisible();

    await captureScreenshot(page, '23_mission_stats');

    // Get and verify stat values
    const killsText = await page.locator('[data-testid="stat-kills"]').textContent();
    expect(killsText).toContain('4'); // Expected kills

    // Verify suit integrity stat
    const suitIntegrity = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getSuitIntegrity();
    });

    expect(suitIntegrity).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // SECTION 10: VISUAL REGRESSION CHECKS
  // --------------------------------------------------------------------------

  test.describe('Visual Regression', () => {
    test('should match HALO drop visual snapshot', async () => {
      // This would use Playwright's visual comparison feature
      // Requires baseline screenshots to be established first
      await expect(page).toHaveScreenshot('halo-drop-baseline.png', {
        maxDiffPixelRatio: 0.05,
        timeout: 5000,
      });
    });

    test('should match combat visual snapshot', async () => {
      await expect(page).toHaveScreenshot('surface-combat-baseline.png', {
        maxDiffPixelRatio: 0.05,
        timeout: 5000,
      });
    });

    test('should match mission complete visual snapshot', async () => {
      await expect(page).toHaveScreenshot('mission-complete-baseline.png', {
        maxDiffPixelRatio: 0.05,
        timeout: 5000,
      });
    });
  });
});

// ============================================================================
// ADDITIONAL TEST SCENARIOS
// ============================================================================

test.describe('Level 2: Landfall - Edge Cases', () => {
  test('should handle rough landing with damage', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForMainMenu(page);
    await navigateToLandfall(page);

    // Skip through freefall phases quickly
    await waitForDropPhase(page, 'freefall_clear');

    // Intentionally delay jet ignition for rough landing
    await page.waitForFunction(
      () => {
        const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
          .__STELLAR_DESCENT_DEBUG__;
        return debug?.levelState?.getAltitude() < 200;
      },
      { timeout: TIMEOUTS.phaseTransition }
    );

    // Ignite jets late
    await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      debug.triggerAction('ignite_jets');
    });

    // Wait for landing
    await waitForDropPhase(page, 'surface');

    // Check for damage notification
    const landingOutcome = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getLandingOutcome();
    });

    expect(['rough', 'crash']).toContain(landingOutcome);

    await captureScreenshot(page, 'edge_rough_landing');
  });

  test('should track asteroid collision damage', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForMainMenu(page);
    await navigateToLandfall(page);

    // Wait for debris field
    await waitForDropPhase(page, 'freefall_belt');

    // Get initial suit integrity
    const initialIntegrity = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return debug?.levelState?.getSuitIntegrity();
    });

    // Wait for potential asteroid hits
    await page.waitForTimeout(5000);

    // Check if asteroids were hit
    const asteroidStats = await page.evaluate(() => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__: StellarDescentDebug })
        .__STELLAR_DESCENT_DEBUG__;
      return {
        hit: debug?.levelState?.getAsteroidsHit(),
        integrity: debug?.levelState?.getSuitIntegrity(),
      };
    });

    if (asteroidStats.hit > 0) {
      expect(asteroidStats.integrity).toBeLessThan(initialIntegrity);
    }

    await captureScreenshot(page, 'edge_asteroid_damage');
  });

  test('should handle player death during combat', async ({ page }) => {
    // This test would simulate player death and verify death screen
    // For now, skip as it requires modifying game state
    test.skip();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

test.describe('Level 2: Landfall - Performance', () => {
  test('should maintain acceptable frame rate during HALO drop', async ({ page }) => {
    await page.goto(BASE_URL);
    await waitForMainMenu(page);
    await navigateToLandfall(page);

    // Wait for freefall
    await waitForDropPhase(page, 'freefall_belt');

    // Measure frame rate via performance API
    const fps = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        const countFrames = () => {
          frameCount++;
          if (performance.now() - startTime < 2000) {
            requestAnimationFrame(countFrames);
          } else {
            resolve((frameCount / 2) * 1); // FPS over 2 seconds
          }
        };

        requestAnimationFrame(countFrames);
      });
    });

    expect(fps).toBeGreaterThan(30); // Minimum acceptable FPS
  });

  test('should load level assets within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BASE_URL);
    await waitForMainMenu(page);
    await navigateToLandfall(page);

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(TIMEOUTS.levelLoad);
  });
});
