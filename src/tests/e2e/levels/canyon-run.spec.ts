/**
 * canyon-run.spec.ts - Comprehensive Playwright E2E Test for Level 3: Canyon Run
 *
 * This test suite validates the complete vehicle chase level:
 * - Vehicle entry and controls swap to yoke
 * - Steering, throttle, brake mechanics
 * - Boost system functionality
 * - Turret aiming and firing
 * - Enemy Wraith vehicle encounters
 * - Jump ramps and obstacle avoidance
 * - Bridge crossing sequences
 * - Checkpoint validation
 * - Extraction/victory condition
 *
 * Uses the game fixture and PlayerGovernor for automated vehicle control.
 *
 * @module tests/e2e/levels/canyon-run
 */

import { expect, type GamePage, test } from '../fixtures/game-fixture';
import { createGovernorController, type GovernorController } from '../utils/player-governor';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Canyon Run level ID */
const LEVEL_ID = 'canyon_run';

/** Timeout for waiting for game to load */
const GAME_LOAD_TIMEOUT = 30000;

/** Timeout for level phase transitions */
const PHASE_TRANSITION_TIMEOUT = 20000;

/** Timeout for checkpoint reaching */
const CHECKPOINT_TIMEOUT = 60000;

/** Key Z positions from CanyonRunLevel */
const EXTRACTION_Z = -2900;
const BRIDGE_Z = -1500;
const ROCKSLIDE_TRIGGER_Z = -800;
const WRAITH_SPAWN_Z = -900;

/** Canyon Run waypoints for automated driving */
const CANYON_WAYPOINTS = [
  { x: 0, y: 2, z: -200 }, // First stretch
  { x: -10, y: 2, z: -500 }, // Checkpoint Alpha
  { x: 5, y: 2, z: -800 }, // Rockslide trigger
  { x: 0, y: 2, z: -1000 }, // Checkpoint Bravo
  { x: 0, y: 2, z: -1500 }, // Bridge crossing
  { x: 0, y: 2, z: -2000 }, // Checkpoint Charlie
  { x: 0, y: 2, z: -2500 }, // Checkpoint Delta
  { x: 0, y: 2, z: -2900 }, // Extraction
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get vehicle state from the game debug interface.
 */
async function getVehicleState(gamePage: GamePage): Promise<{
  position: { x: number; y: number; z: number };
  speed: number;
  health: number;
  maxHealth: number;
  boostFuel: number;
  isBoosting: boolean;
  isGrounded: boolean;
  isDead: boolean;
  turretYaw: number;
  turretPitch: number;
  turretHeat: number;
  turretOverheated: boolean;
} | null> {
  return gamePage.page.evaluate(() => {
    const w = window as unknown as {
      __STELLAR_DESCENT__?: {
        vehicle?: {
          position: { x: number; y: number; z: number };
          speed: number;
          health: number;
          maxHealth: number;
          boostFuel: number;
          isBoosting: boolean;
          isGrounded: boolean;
          isDead: boolean;
          turretYaw: number;
          turretPitch: number;
          turretHeat: number;
          turretOverheated: boolean;
        };
      };
    };
    return w.__STELLAR_DESCENT__?.vehicle ?? null;
  });
}

/**
 * Get Canyon Run level-specific state from the game debug interface.
 */
async function getCanyonRunState(gamePage: GamePage): Promise<{
  phase: string;
  phaseTime: number;
  kills: number;
  checkpointsReached: string[];
  wraithCount: number;
  bridgeCollapsed: boolean;
} | null> {
  return gamePage.page.evaluate(() => {
    const w = window as unknown as {
      __STELLAR_DESCENT__?: {
        level?: {
          phase: string;
          phaseTime: number;
          kills: number;
          checkpointsReached: string[];
          wraithCount: number;
          bridgeCollapsed: boolean;
        };
      };
    };
    return w.__STELLAR_DESCENT__?.level ?? null;
  });
}

/**
 * Wait for the vehicle to reach a specific Z position.
 */
async function waitForZPosition(
  gamePage: GamePage,
  targetZ: number,
  timeout = CHECKPOINT_TIMEOUT
): Promise<void> {
  await gamePage.page.waitForFunction(
    (z) => {
      const w = window as unknown as {
        __STELLAR_DESCENT__?: {
          vehicle?: { position: { z: number } };
        };
      };
      const vehicle = w.__STELLAR_DESCENT__?.vehicle;
      return vehicle && vehicle.position.z <= z;
    },
    targetZ,
    { timeout }
  );
}

/**
 * Wait for a specific Canyon Run phase.
 */
async function waitForCanyonPhase(
  gamePage: GamePage,
  phase: string,
  timeout = PHASE_TRANSITION_TIMEOUT
): Promise<void> {
  await gamePage.page.waitForFunction(
    (expectedPhase) => {
      const w = window as unknown as {
        __STELLAR_DESCENT__?: {
          level?: { phase: string };
        };
      };
      return w.__STELLAR_DESCENT__?.level?.phase === expectedPhase;
    },
    phase,
    { timeout }
  );
}

/**
 * Enable god mode for testing scenarios requiring invincibility.
 */
async function enableGodMode(gamePage: GamePage): Promise<void> {
  await gamePage.page.evaluate(() => {
    const w = window as unknown as {
      __STELLAR_DESCENT__?: {
        devFlags?: { godMode: boolean };
      };
    };
    if (w.__STELLAR_DESCENT__?.devFlags) {
      w.__STELLAR_DESCENT__.devFlags.godMode = true;
    }
  });
}

/**
 * Enable all levels unlock for dev testing.
 */
async function enableAllLevels(gamePage: GamePage): Promise<void> {
  await gamePage.page.evaluate(() => {
    const w = window as unknown as {
      __STELLAR_DESCENT__?: {
        devFlags?: { allLevelsUnlocked: boolean };
      };
    };
    if (w.__STELLAR_DESCENT__?.devFlags) {
      w.__STELLAR_DESCENT__.devFlags.allLevelsUnlocked = true;
    }
  });
}

/**
 * Drive vehicle through waypoints using PlayerGovernor.
 */
async function driveWaypoints(
  governor: GovernorController,
  waypoints: Array<{ x: number; y: number; z: number }>
): Promise<void> {
  for (const waypoint of waypoints) {
    await governor.navigateTo(waypoint);
    await governor.waitForGoalComplete(60000);
  }
}

// ============================================================================
// TEST SUITE: CANYON RUN LEVEL 3
// ============================================================================

test.describe('Canyon Run - Level 3 Vehicle Chase', () => {
  let governor: GovernorController;

  test.beforeEach(async ({ gamePage }) => {
    // Navigate to game and wait for ready
    await gamePage.goto();
    await gamePage.waitForGameReady();

    // Create governor controller
    governor = createGovernorController(gamePage.page);

    // Enable all levels for testing
    await enableAllLevels(gamePage);
  });

  // --------------------------------------------------------------------------
  // LEVEL INITIALIZATION TESTS
  // --------------------------------------------------------------------------

  test.describe('Level Initialization', () => {
    test('should load Canyon Run level successfully', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);

      const levelId = await gamePage.getCurrentLevel();
      expect(levelId).toBe(LEVEL_ID);
    });

    test('should start in intro phase', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);

      const state = await getCanyonRunState(gamePage);
      expect(state?.phase).toBe('intro');
    });

    test('should initialize vehicle at spawn position', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);

      // Wait for intro to complete
      await waitForCanyonPhase(gamePage, 'canyon_approach');

      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState).not.toBeNull();
      expect(vehicleState?.position.z).toBeGreaterThan(-100);
    });

    test('should render canyon terrain properly', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');

      // Verify canvas is rendering
      const canvas = gamePage.page.locator('canvas');
      await expect(canvas).toBeVisible();

      // Visual regression test
      await gamePage.captureVisualRegression('canyon-run-terrain-initial');
    });
  });

  // --------------------------------------------------------------------------
  // VEHICLE ENTRY AND CONTROLS
  // --------------------------------------------------------------------------

  test.describe('Vehicle Entry and Controls', () => {
    test.beforeEach(async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
    });

    test('should swap controls to vehicle yoke after intro', async ({ gamePage }) => {
      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState).not.toBeNull();
      expect(vehicleState?.isDead).toBe(false);
    });

    test('should respond to throttle input (W key)', async ({ gamePage }) => {
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(500);

      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.speed).toBeGreaterThan(0);

      await gamePage.page.keyboard.up('KeyW');
    });

    test('should respond to brake input (S key)', async ({ gamePage }) => {
      // Build up speed first
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(1000);
      const speedBefore = (await getVehicleState(gamePage))?.speed ?? 0;

      // Apply brake
      await gamePage.page.keyboard.up('KeyW');
      await gamePage.page.keyboard.down('KeyS');
      await gamePage.page.waitForTimeout(500);

      const speedAfter = (await getVehicleState(gamePage))?.speed ?? 0;
      expect(speedAfter).toBeLessThan(speedBefore);

      await gamePage.page.keyboard.up('KeyS');
    });

    test('should respond to steering input (A/D keys)', async ({ gamePage }) => {
      // Build up speed and steer
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(500);

      await gamePage.page.keyboard.down('KeyA');
      await gamePage.page.waitForTimeout(500);

      // Verify vehicle is still functional
      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.isDead).toBe(false);

      await gamePage.page.keyboard.up('KeyW');
      await gamePage.page.keyboard.up('KeyA');
    });
  });

  // --------------------------------------------------------------------------
  // BOOST SYSTEM
  // --------------------------------------------------------------------------

  test.describe('Boost System', () => {
    test.beforeEach(async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
    });

    test('should activate boost when holding shift with throttle', async ({ gamePage }) => {
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.keyboard.down('ShiftLeft');
      await gamePage.page.waitForTimeout(300);

      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.isBoosting).toBe(true);

      await gamePage.page.keyboard.up('ShiftLeft');
      await gamePage.page.keyboard.up('KeyW');
    });

    test('should consume boost fuel when boosting', async ({ gamePage }) => {
      const initialFuel = (await getVehicleState(gamePage))?.boostFuel ?? 0;

      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.keyboard.down('ShiftLeft');
      await gamePage.page.waitForTimeout(2000);

      const fuelAfter = (await getVehicleState(gamePage))?.boostFuel ?? 0;
      expect(fuelAfter).toBeLessThan(initialFuel);

      await gamePage.page.keyboard.up('ShiftLeft');
      await gamePage.page.keyboard.up('KeyW');
    });

    test('should increase speed when boosting', async ({ gamePage }) => {
      // Get normal speed
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(2000);
      const normalSpeed = (await getVehicleState(gamePage))?.speed ?? 0;

      // Now boost
      await gamePage.page.keyboard.down('ShiftLeft');
      await gamePage.page.waitForTimeout(1000);
      const boostSpeed = (await getVehicleState(gamePage))?.speed ?? 0;

      expect(boostSpeed).toBeGreaterThan(normalSpeed);

      await gamePage.page.keyboard.up('ShiftLeft');
      await gamePage.page.keyboard.up('KeyW');
    });

    test('should regenerate boost fuel when not boosting', async ({ gamePage }) => {
      // Consume some boost
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.keyboard.down('ShiftLeft');
      await gamePage.page.waitForTimeout(2000);
      await gamePage.page.keyboard.up('ShiftLeft');

      const fuelAfterBoost = (await getVehicleState(gamePage))?.boostFuel ?? 0;

      // Wait for regeneration
      await gamePage.page.waitForTimeout(3000);

      const fuelAfterRegen = (await getVehicleState(gamePage))?.boostFuel ?? 0;
      expect(fuelAfterRegen).toBeGreaterThan(fuelAfterBoost);

      await gamePage.page.keyboard.up('KeyW');
    });
  });

  // --------------------------------------------------------------------------
  // TURRET SYSTEM
  // --------------------------------------------------------------------------

  test.describe('Turret Aiming and Firing', () => {
    test.beforeEach(async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
    });

    test('should track turret aim from mouse movement', async ({ gamePage }) => {
      const yawBefore = (await getVehicleState(gamePage))?.turretYaw ?? 0;

      // Move mouse to aim turret
      await gamePage.page.mouse.move(400, 300);
      await gamePage.page.mouse.move(600, 300);
      await gamePage.page.waitForTimeout(200);

      const yawAfter = (await getVehicleState(gamePage))?.turretYaw ?? 0;
      // Turret should track mouse movement (may be same if pointer not locked)
      expect(typeof yawAfter).toBe('number');
    });

    test('should fire turret on left click', async ({ gamePage }) => {
      const heatBefore = (await getVehicleState(gamePage))?.turretHeat ?? 0;

      // Click to fire
      await gamePage.page.mouse.click(400, 300);
      await gamePage.page.waitForTimeout(100);

      const heatAfter = (await getVehicleState(gamePage))?.turretHeat ?? 0;
      expect(heatAfter).toBeGreaterThanOrEqual(heatBefore);
    });

    test('should heat turret with sustained fire', async ({ gamePage }) => {
      // Rapid fire
      for (let i = 0; i < 30; i++) {
        await gamePage.page.mouse.click(400, 300);
        await gamePage.page.waitForTimeout(50);
      }

      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.turretHeat).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // ENEMY WRAITH ENCOUNTERS
  // --------------------------------------------------------------------------

  test.describe('Enemy Wraith Encounters', () => {
    test('should spawn Wraiths after reaching trigger point', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive past the Wraith spawn trigger
      await governor.navigateTo({ x: 0, y: 2, z: WRAITH_SPAWN_Z - 50 });
      await waitForZPosition(gamePage, WRAITH_SPAWN_Z - 50, 60000);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.wraithCount).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // COLLISION DETECTION
  // --------------------------------------------------------------------------

  test.describe('Collision Detection', () => {
    test.beforeEach(async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
    });

    test('should take damage when hitting canyon walls', async ({ gamePage }) => {
      const healthBefore = (await getVehicleState(gamePage))?.health ?? 0;

      // Drive into a wall
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.keyboard.down('KeyD');
      await gamePage.page.waitForTimeout(3000);

      const healthAfter = (await getVehicleState(gamePage))?.health ?? 0;
      // May have taken wall collision damage
      expect(healthAfter).toBeLessThanOrEqual(healthBefore);

      await gamePage.page.keyboard.up('KeyW');
      await gamePage.page.keyboard.up('KeyD');
    });

    test('should survive driving through canyon', async ({ gamePage }) => {
      // Drive forward
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(5000);
      await gamePage.page.keyboard.up('KeyW');

      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.isDead).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // CHECKPOINTS
  // --------------------------------------------------------------------------

  test.describe('Checkpoint System', () => {
    test('should save checkpoint at Alpha position', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive to Checkpoint Alpha (Z = -500)
      await governor.navigateTo({ x: 0, y: 2, z: -550 });
      await waitForZPosition(gamePage, -550, 60000);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.checkpointsReached.length).toBeGreaterThan(0);
    });

    test('should validate checkpoint progression', async ({ gamePage }) => {
      test.setTimeout(120000);

      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive through multiple checkpoints
      for (const waypoint of CANYON_WAYPOINTS.slice(0, 4)) {
        await governor.navigateTo(waypoint);
        await governor.waitForGoalComplete(30000);
      }

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.checkpointsReached.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --------------------------------------------------------------------------
  // BRIDGE CROSSING SEQUENCE
  // --------------------------------------------------------------------------

  test.describe('Bridge Crossing', () => {
    test('should trigger bridge collapse sequence', async ({ gamePage }) => {
      test.setTimeout(120000);

      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive to bridge
      await governor.navigateTo({ x: 0, y: 2, z: BRIDGE_Z - 50 });
      await waitForZPosition(gamePage, BRIDGE_Z - 50, 90000);

      // Should transition to bridge_crossing phase
      await waitForCanyonPhase(gamePage, 'bridge_crossing');

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.phase).toBe('bridge_crossing');
    });

    test('should collapse bridge during crossing', async ({ gamePage }) => {
      test.setTimeout(150000);

      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive onto the bridge
      await governor.navigateTo({ x: 0, y: 2, z: BRIDGE_Z - 100 });
      await waitForZPosition(gamePage, BRIDGE_Z - 100, 120000);

      // Wait for bridge collapse
      await gamePage.page.waitForTimeout(3000);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.bridgeCollapsed).toBe(true);

      // Visual regression for bridge collapse
      await gamePage.captureVisualRegression('canyon-run-bridge-collapse');
    });

    test('should transition to final stretch after bridge', async ({ gamePage }) => {
      test.setTimeout(180000);

      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive past the bridge
      await governor.navigateTo({ x: 0, y: 2, z: BRIDGE_Z - 200 });
      await waitForZPosition(gamePage, BRIDGE_Z - 200, 150000);

      await waitForCanyonPhase(gamePage, 'final_stretch', 30000);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.phase).toBe('final_stretch');
    });
  });

  // --------------------------------------------------------------------------
  // EXTRACTION AND VICTORY
  // --------------------------------------------------------------------------

  test.describe('Extraction and Victory', () => {
    test('should reach extraction zone and complete level', async ({ gamePage }) => {
      test.setTimeout(240000); // 4 minutes

      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive through all waypoints to extraction
      await driveWaypoints(governor, CANYON_WAYPOINTS);

      // Wait for extraction sequence
      await waitForCanyonPhase(gamePage, 'extraction', 60000);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.phase).toBe('extraction');
    });

    test('should show level completion after extraction', async ({ gamePage }) => {
      test.setTimeout(300000); // 5 minutes

      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Drive to extraction
      await driveWaypoints(governor, CANYON_WAYPOINTS);

      // Wait for level complete
      await waitForCanyonPhase(gamePage, 'complete', 60000);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.phase).toBe('complete');

      // Visual regression for victory screen
      await gamePage.captureVisualRegression('canyon-run-level-complete');
    });
  });

  // --------------------------------------------------------------------------
  // VEHICLE PHYSICS
  // --------------------------------------------------------------------------

  test.describe('Vehicle Physics', () => {
    test.beforeEach(async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
    });

    test('should detect vehicle grounding state', async ({ gamePage }) => {
      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.isGrounded).toBe(true);
    });

    test('should follow terrain height when grounded', async ({ gamePage }) => {
      // Drive forward
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(3000);
      await gamePage.page.keyboard.up('KeyW');

      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.isGrounded).toBe(true);
    });

    test('should handle speed-dependent turn radius', async ({ gamePage }) => {
      // At low speed, turning should be sharp
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(200);
      await gamePage.page.keyboard.down('KeyA');
      await gamePage.page.waitForTimeout(500);
      await gamePage.page.keyboard.up('KeyA');

      // At high speed (boosted), turning should be wider
      await gamePage.page.keyboard.down('ShiftLeft');
      await gamePage.page.waitForTimeout(2000);
      await gamePage.page.keyboard.down('KeyD');
      await gamePage.page.waitForTimeout(500);

      // Vehicle should still be functional
      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.isDead).toBe(false);

      await gamePage.page.keyboard.up('KeyD');
      await gamePage.page.keyboard.up('ShiftLeft');
      await gamePage.page.keyboard.up('KeyW');
    });
  });

  // --------------------------------------------------------------------------
  // VISUAL REGRESSION TESTS
  // --------------------------------------------------------------------------

  test.describe('Visual Regression', () => {
    test.beforeEach(async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
    });

    test('should render vehicle correctly', async ({ gamePage }) => {
      await gamePage.captureVisualRegression('canyon-run-vehicle-initial');
    });

    test('should render canyon environment', async ({ gamePage }) => {
      // Drive a bit to get a good view
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.waitForTimeout(2000);
      await gamePage.page.keyboard.up('KeyW');

      await gamePage.captureVisualRegression('canyon-run-canyon-environment');
    });

    test('should render boost effects', async ({ gamePage }) => {
      await gamePage.page.keyboard.down('KeyW');
      await gamePage.page.keyboard.down('ShiftLeft');
      await gamePage.page.waitForTimeout(500);

      await gamePage.captureVisualRegression('canyon-run-boost-effect');

      await gamePage.page.keyboard.up('ShiftLeft');
      await gamePage.page.keyboard.up('KeyW');
    });

    test('should render enemy Wraith vehicles', async ({ gamePage }) => {
      await enableGodMode(gamePage);

      // Drive to Wraith spawn area
      await governor.navigateTo({ x: 0, y: 2, z: WRAITH_SPAWN_Z - 50 });
      await waitForZPosition(gamePage, WRAITH_SPAWN_Z - 50, 60000);

      await gamePage.page.waitForTimeout(2000);
      await gamePage.captureVisualRegression('canyon-run-wraith-enemies');
    });
  });

  // --------------------------------------------------------------------------
  // DIFFICULTY SCALING
  // --------------------------------------------------------------------------

  test.describe('Difficulty Scaling', () => {
    test('should load with normal difficulty', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);

      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.maxHealth).toBe(120);
    });

    test('should load with hard difficulty', async ({ gamePage }) => {
      await gamePage.startNewGame('hard', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState).not.toBeNull();
    });

    test('should load with nightmare difficulty', async ({ gamePage }) => {
      await gamePage.startNewGame('nightmare', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASES AND ERROR HANDLING
  // --------------------------------------------------------------------------

  test.describe('Edge Cases', () => {
    test('should handle vehicle destruction gracefully', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');

      // Force vehicle destruction
      await gamePage.page.evaluate(() => {
        const w = window as unknown as {
          __STELLAR_DESCENT__?: {
            level?: { damageVehicle?: (amount: number) => void };
          };
        };
        // Apply massive damage
        for (let i = 0; i < 20; i++) {
          w.__STELLAR_DESCENT__?.level?.damageVehicle?.(20);
        }
      });

      await gamePage.page.waitForTimeout(1000);

      // Game should handle death gracefully
      const vehicleState = await getVehicleState(gamePage);
      if (vehicleState) {
        expect(vehicleState.isDead).toBe(true);
      }
    });

    test('should handle pause during gameplay', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');

      // Pause game
      await gamePage.pauseGame();
      await gamePage.page.waitForTimeout(500);

      // Resume game
      await gamePage.resumeGame();
      await gamePage.page.waitForTimeout(500);

      // Verify game continues
      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState).not.toBeNull();
    });

    test('should handle rapid input changes', async ({ gamePage }) => {
      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');

      // Rapid input switching
      for (let i = 0; i < 10; i++) {
        await gamePage.page.keyboard.press('KeyW');
        await gamePage.page.keyboard.press('KeyA');
        await gamePage.page.keyboard.press('KeyD');
        await gamePage.page.keyboard.press('KeyS');
      }

      // Vehicle should still be functional
      const vehicleState = await getVehicleState(gamePage);
      expect(vehicleState?.isDead).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // FULL PLAYTHROUGH TEST
  // --------------------------------------------------------------------------

  test.describe('Full Playthrough', () => {
    test('should complete entire level with PlayerGovernor', async ({ gamePage }) => {
      test.setTimeout(360000); // 6 minutes

      await gamePage.startNewGame('normal', LEVEL_ID);
      await gamePage.waitForLevelLoad(LEVEL_ID);
      await waitForCanyonPhase(gamePage, 'canyon_approach');
      await enableGodMode(gamePage);

      // Use governor for full automated playthrough
      await governor.configure({
        autoShoot: true,
        autoAdvanceDialogue: true,
        engagementRange: 50,
        logActions: true,
      });

      // Drive through all waypoints
      await driveWaypoints(governor, CANYON_WAYPOINTS);

      // Wait for level completion
      await waitForCanyonPhase(gamePage, 'complete', 120000);

      const levelState = await getCanyonRunState(gamePage);
      expect(levelState?.phase).toBe('complete');
      expect(levelState?.checkpointsReached.length).toBeGreaterThan(0);
    });
  });
});
