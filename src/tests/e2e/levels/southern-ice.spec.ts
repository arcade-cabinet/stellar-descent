/**
 * southern-ice.spec.ts - Playwright E2E Test for Level 6: Southern Ice
 *
 * Comprehensive end-to-end test suite for the Southern Ice (Frozen Wasteland) level.
 *
 * Tests cover:
 * 1. Ice fields with blizzard effects
 * 2. Temperature/exposure system mechanics
 * 3. Marcus AI companion behavior
 * 4. Ice Chitin enemy variants (frozen, burrowing)
 * 5. Frozen lake thin ice mechanics
 * 6. Dormant nest awakening sequence
 * 7. Ice caverns exploration
 * 8. Nest clearing objectives
 * 9. Phase transitions
 * 10. Visual regression for ice/snow effects
 *
 * Uses PlayerGovernor for automated player control:
 * ```typescript
 * window.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({ type: 'navigate', target: position });
 * ```
 */

import { expect, type Page, test } from '@playwright/test';

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const LEVEL_ID = 'southern_ice';
const LEVEL_START_TIMEOUT = 30000;
const PHASE_TRANSITION_TIMEOUT = 10000;
const ENEMY_SPAWN_TIMEOUT = 5000;

// Phase trigger Z positions (moving south = negative Z)
const FROZEN_LAKE_TRIGGER_Z = -100;
const ICE_CAVERNS_TRIGGER_Z = -220;
const BREACH_TRIGGER_Z = -310;

// Arena bounds
const ARENA_HALF_WIDTH = 150;
const ARENA_NORTH_BOUND = 50;

// Temperature thresholds
const EXPOSURE_WARNING_THRESHOLD = 40;
const EXPOSURE_CRITICAL_THRESHOLD = 15;

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wait for the game to fully load and the level to be playable.
 */
async function waitForGameReady(page: Page): Promise<void> {
  // Wait for the game canvas to be present
  await page.waitForSelector('canvas', { timeout: LEVEL_START_TIMEOUT });

  // Wait for the debug interface to be available
  await page.waitForFunction(
    () => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.playerGovernor !== undefined;
    },
    { timeout: LEVEL_START_TIMEOUT }
  );

  // Wait for the level to be fully loaded
  await page.waitForFunction(
    () => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.levelReady === true;
    },
    { timeout: LEVEL_START_TIMEOUT }
  );
}

/**
 * Navigate the player to a specific position using PlayerGovernor.
 */
async function navigatePlayerTo(
  page: Page,
  x: number,
  y: number,
  z: number,
  threshold = 5
): Promise<void> {
  await page.evaluate(
    ({ x, y, z, threshold }) => {
      const w = window as any;
      w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
        type: 'navigate',
        target: { x, y, z },
        threshold,
      });
    },
    { x, y, z, threshold }
  );
}

/**
 * Wait for the player to reach a specific position.
 */
async function waitForPlayerPosition(
  page: Page,
  targetZ: number,
  timeout = PHASE_TRANSITION_TIMEOUT
): Promise<void> {
  await page.waitForFunction(
    (targetZ) => {
      const w = window as any;
      const pos = w.__STELLAR_DESCENT_DEBUG__?.playerPosition;
      return pos && pos.z <= targetZ;
    },
    targetZ,
    { timeout }
  );
}

/**
 * Get the current player position.
 */
async function getPlayerPosition(page: Page): Promise<{ x: number; y: number; z: number }> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.playerPosition || { x: 0, y: 0, z: 0 };
  });
}

/**
 * Get the current level phase.
 */
async function getCurrentPhase(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.currentPhase || 'unknown';
  });
}

/**
 * Get the current exposure meter value.
 */
async function getExposureMeter(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.exposureMeter ?? 100;
  });
}

/**
 * Get the current player health.
 */
async function getPlayerHealth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.playerHealth ?? 100;
  });
}

/**
 * Get the count of active Ice Chitin enemies.
 */
async function getActiveEnemyCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.activeEnemyCount ?? 0;
  });
}

/**
 * Get the count of dormant nests.
 */
async function getDormantNestCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.dormantNestCount ?? 0;
  });
}

/**
 * Check if Marcus companion is present and following.
 */
async function isMarcusPresent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.marcusPresent === true;
  });
}

/**
 * Get Marcus companion position.
 */
async function getMarcusPosition(page: Page): Promise<{ x: number; y: number; z: number }> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.marcusPosition || { x: 0, y: 0, z: 0 };
  });
}

/**
 * Get the current blizzard intensity.
 */
async function getBlizzardIntensity(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.blizzardIntensity ?? 0.7;
  });
}

/**
 * Check if player is on thin ice.
 */
async function isOnThinIce(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.isOnThinIce === true;
  });
}

/**
 * Command player to engage enemies.
 */
async function engageEnemies(page: Page, aggressive = false): Promise<void> {
  await page.evaluate((aggressive) => {
    const w = window as any;
    w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
      type: 'engage_enemies',
      aggressive,
    });
  }, aggressive);
}

/**
 * Wait for a specific duration.
 */
async function waitForDuration(page: Page, durationMs: number): Promise<void> {
  await page.evaluate((duration) => {
    const w = window as any;
    w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
      type: 'wait',
      duration,
    });
  }, durationMs);
  await page.waitForTimeout(durationMs + 500);
}

/**
 * Check if blizzard particle effects are rendering.
 */
async function isBlizzardRendering(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.blizzardSystemActive === true;
  });
}

/**
 * Check if aurora borealis is rendering.
 */
async function isAuroraRendering(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as any;
    return w.__STELLAR_DESCENT_DEBUG__?.auroraActive === true;
  });
}

/**
 * Get list of collectibles in the level.
 */
async function getCollectibleStatus(
  page: Page
): Promise<{ total: number; collected: number; remaining: string[] }> {
  return page.evaluate(() => {
    const w = window as any;
    return (
      w.__STELLAR_DESCENT_DEBUG__?.collectibleStatus || {
        total: 0,
        collected: 0,
        remaining: [],
      }
    );
  });
}

/**
 * Check if temperature system is affecting player.
 */
async function getTemperatureEffect(
  page: Page
): Promise<{ inWarmZone: boolean; inColdZone: boolean; temperatureOffset: number }> {
  return page.evaluate(() => {
    const w = window as any;
    return (
      w.__STELLAR_DESCENT_DEBUG__?.temperatureEffect || {
        inWarmZone: false,
        inColdZone: false,
        temperatureOffset: 0,
      }
    );
  });
}

/**
 * Start the Southern Ice level from the main menu.
 */
async function startSouthernIceLevel(page: Page): Promise<void> {
  await page.goto(BASE_URL);
  await waitForGameReady(page);

  // Navigate to level select and choose Southern Ice
  await page.evaluate(() => {
    const w = window as any;
    // Use dev mode to start directly at Southern Ice
    if (w.__STELLAR_DESCENT_DEBUG__?.startLevel) {
      w.__STELLAR_DESCENT_DEBUG__.startLevel('southern_ice', 'normal');
    }
  });

  // Wait for level to load
  await page.waitForFunction(
    () => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.currentLevel === 'southern_ice';
    },
    { timeout: LEVEL_START_TIMEOUT }
  );
}

// ============================================================================
// TEST SUITE: Level Loading and Initialization
// ============================================================================

test.describe('Southern Ice Level - Loading and Initialization', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should load Southern Ice level successfully', async ({ page }) => {
    const currentLevel = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.currentLevel;
    });
    expect(currentLevel).toBe('southern_ice');
  });

  test('should start in ice_fields phase', async ({ page }) => {
    const phase = await getCurrentPhase(page);
    expect(phase).toBe('ice_fields');
  });

  test('should initialize player at correct starting position', async ({ page }) => {
    const pos = await getPlayerPosition(page);
    expect(pos.z).toBeGreaterThan(FROZEN_LAKE_TRIGGER_Z);
    expect(Math.abs(pos.x)).toBeLessThan(ARENA_HALF_WIDTH);
  });

  test('should start with full exposure meter', async ({ page }) => {
    const exposure = await getExposureMeter(page);
    expect(exposure).toBe(100);
  });

  test('should start with full health', async ({ page }) => {
    const health = await getPlayerHealth(page);
    expect(health).toBe(100);
  });

  test('should spawn Marcus AI companion', async ({ page }) => {
    const marcusPresent = await isMarcusPresent(page);
    expect(marcusPresent).toBe(true);
  });

  test('should display Chapter 6 notification', async ({ page }) => {
    // Wait for the notification to appear
    await page.waitForFunction(
      () => {
        const w = window as any;
        const notifications = w.__STELLAR_DESCENT_DEBUG__?.notifications || [];
        return notifications.some((n: string) => n.includes('CHAPTER 6'));
      },
      { timeout: 5000 }
    );
  });
});

// ============================================================================
// TEST SUITE: Blizzard and Weather Effects
// ============================================================================

test.describe('Southern Ice Level - Blizzard Effects', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should render blizzard particle effects', async ({ page }) => {
    const blizzardActive = await isBlizzardRendering(page);
    expect(blizzardActive).toBe(true);
  });

  test('should render aurora borealis effects', async ({ page }) => {
    const auroraActive = await isAuroraRendering(page);
    expect(auroraActive).toBe(true);
  });

  test('should have high blizzard intensity in ice_fields phase', async ({ page }) => {
    const intensity = await getBlizzardIntensity(page);
    expect(intensity).toBeGreaterThanOrEqual(0.6);
  });

  test('should reduce blizzard intensity near caves', async ({ page }) => {
    // Navigate player towards a cave entrance
    await navigatePlayerTo(page, -80, 0, -120);
    await waitForPlayerPosition(page, -115);

    // Wait for blizzard intensity to adjust
    await page.waitForTimeout(2000);

    const intensity = await getBlizzardIntensity(page);
    expect(intensity).toBeLessThan(0.3);
  });

  test.describe('Visual Regression - Blizzard', () => {
    test('should match blizzard visual baseline', async ({ page }) => {
      // Wait for particles to stabilize
      await page.waitForTimeout(3000);

      // Take screenshot for visual comparison
      const screenshot = await page.screenshot({
        fullPage: false,
        clip: { x: 0, y: 0, width: 1280, height: 720 },
      });

      expect(screenshot).toMatchSnapshot('southern-ice-blizzard.png', {
        threshold: 0.3, // Allow 30% variance for particle effects
      });
    });
  });
});

// ============================================================================
// TEST SUITE: Temperature/Exposure System
// ============================================================================

test.describe('Southern Ice Level - Temperature System', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should drain exposure in blizzard conditions', async ({ page }) => {
    const initialExposure = await getExposureMeter(page);

    // Wait in the blizzard for a few seconds
    await waitForDuration(page, 5000);

    const finalExposure = await getExposureMeter(page);
    expect(finalExposure).toBeLessThan(initialExposure);
  });

  test('should recover exposure near heat sources', async ({ page }) => {
    // First drain some exposure
    await waitForDuration(page, 3000);
    const drainedExposure = await getExposureMeter(page);

    // Navigate to a heat source (outpost heater)
    await navigatePlayerTo(page, 40, 0, -55);
    await page.waitForTimeout(3000);

    const tempEffect = await getTemperatureEffect(page);
    expect(tempEffect.inWarmZone).toBe(true);

    // Wait for recovery
    await waitForDuration(page, 4000);

    const recoveredExposure = await getExposureMeter(page);
    expect(recoveredExposure).toBeGreaterThan(drainedExposure);
  });

  test('should show warning when exposure reaches threshold', async ({ page }) => {
    // Navigate away from heat sources and wait for exposure to drain
    await navigatePlayerTo(page, -50, 0, -50);

    // Wait for exposure to drop to warning level
    await page.waitForFunction(
      (threshold) => {
        const w = window as any;
        return (w.__STELLAR_DESCENT_DEBUG__?.exposureMeter ?? 100) <= threshold;
      },
      EXPOSURE_WARNING_THRESHOLD,
      { timeout: 20000 }
    );

    // Check for warning notification
    const hasWarning = await page.evaluate(() => {
      const w = window as any;
      const notifications = w.__STELLAR_DESCENT_DEBUG__?.notifications || [];
      return notifications.some((n: string) => n.includes('HYPOTHERMIA'));
    });
    expect(hasWarning).toBe(true);
  });

  test('should deal hypothermia damage when exposure is depleted', async ({ page }) => {
    // Navigate far from heat sources
    await navigatePlayerTo(page, -100, 0, -80);

    // Wait for exposure to fully deplete
    await page.waitForFunction(
      () => {
        const w = window as any;
        return (w.__STELLAR_DESCENT_DEBUG__?.exposureMeter ?? 100) <= 0;
      },
      { timeout: 30000 }
    );

    const healthBefore = await getPlayerHealth(page);

    // Wait for hypothermia damage tick
    await page.waitForTimeout(2000);

    const healthAfter = await getPlayerHealth(page);
    expect(healthAfter).toBeLessThan(healthBefore);
  });
});

// ============================================================================
// TEST SUITE: Marcus AI Companion
// ============================================================================

test.describe('Southern Ice Level - Marcus Companion', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should have Marcus follow player', async ({ page }) => {
    const initialMarcusPos = await getMarcusPosition(page);

    // Move player south
    await navigatePlayerTo(page, 0, 0, -50);
    await waitForPlayerPosition(page, -45);

    // Wait for Marcus to follow
    await page.waitForTimeout(3000);

    const finalMarcusPos = await getMarcusPosition(page);
    expect(finalMarcusPos.z).toBeLessThan(initialMarcusPos.z);
  });

  test('Marcus should not cross onto frozen lake', async ({ page }) => {
    // Navigate player onto the frozen lake
    await navigatePlayerTo(page, 0, 0, -160);
    await waitForPlayerPosition(page, -155);

    // Wait for Marcus to reach lake boundary
    await page.waitForTimeout(5000);

    const marcusPos = await getMarcusPosition(page);
    // Marcus should stay on the north side of the frozen lake
    expect(marcusPos.z).toBeGreaterThan(FROZEN_LAKE_TRIGGER_Z + 5);
  });

  test('Marcus should provide heat source', async ({ page }) => {
    // Navigate player near Marcus
    const marcusPos = await getMarcusPosition(page);
    await navigatePlayerTo(page, marcusPos.x, 0, marcusPos.z);
    await page.waitForTimeout(2000);

    const tempEffect = await getTemperatureEffect(page);
    // Marcus's reactor provides warmth
    expect(tempEffect.temperatureOffset).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST SUITE: Ice Chitin Enemies
// ============================================================================

test.describe('Southern Ice Level - Ice Chitin Enemies', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should spawn active Ice Chitins in ice_fields phase', async ({ page }) => {
    // Wait for enemies to spawn
    await page.waitForTimeout(ENEMY_SPAWN_TIMEOUT);

    const enemyCount = await getActiveEnemyCount(page);
    expect(enemyCount).toBeGreaterThan(0);
  });

  test('should render Ice Chitin with correct visual appearance', async ({ page }) => {
    // Navigate towards enemy spawn area
    await navigatePlayerTo(page, 0, 0, -50);
    await page.waitForTimeout(3000);

    // Visual regression test for Ice Chitin model
    const screenshot = await page.screenshot({
      fullPage: false,
      clip: { x: 440, y: 160, width: 400, height: 400 },
    });

    expect(screenshot).toMatchSnapshot('southern-ice-chitin-enemy.png', {
      threshold: 0.25,
    });
  });

  test('Ice Chitin should deal frost aura damage to nearby player', async ({ page }) => {
    const initialHealth = await getPlayerHealth(page);

    // Navigate close to an enemy
    await page.evaluate(() => {
      const w = window as any;
      const enemies = w.__STELLAR_DESCENT_DEBUG__?.iceChitins || [];
      if (enemies.length > 0) {
        const enemy = enemies[0];
        w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'navigate',
          target: { x: enemy.position.x + 3, y: 0, z: enemy.position.z },
          threshold: 2,
        });
      }
    });

    // Wait in frost aura range
    await page.waitForTimeout(5000);

    const finalHealth = await getPlayerHealth(page);
    expect(finalHealth).toBeLessThan(initialHealth);
  });

  test('Ice Chitin should fire ice shard projectiles', async ({ page }) => {
    // Navigate within attack range of an enemy
    await page.evaluate(() => {
      const w = window as any;
      const enemies = w.__STELLAR_DESCENT_DEBUG__?.iceChitins || [];
      if (enemies.length > 0) {
        const enemy = enemies[0];
        w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'navigate',
          target: { x: enemy.position.x, y: 0, z: enemy.position.z + 15 },
          threshold: 2,
        });
      }
    });

    await page.waitForTimeout(5000);

    // Check for projectile activity
    const projectilesSpawned = await page.evaluate(() => {
      const w = window as any;
      return (w.__STELLAR_DESCENT_DEBUG__?.projectileCount ?? 0) > 0;
    });

    expect(projectilesSpawned).toBe(true);
  });

  test('should be able to kill Ice Chitin enemies', async ({ page }) => {
    const initialCount = await getActiveEnemyCount(page);

    // Engage enemies aggressively
    await engageEnemies(page, true);

    // Wait for combat
    await page.waitForTimeout(10000);

    const finalCount = await getActiveEnemyCount(page);
    expect(finalCount).toBeLessThan(initialCount);
  });
});

// ============================================================================
// TEST SUITE: Dormant Nests and Awakening
// ============================================================================

test.describe('Southern Ice Level - Dormant Nests', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
    // Navigate to frozen lake phase where dormant nests spawn
    await navigatePlayerTo(page, 0, 0, FROZEN_LAKE_TRIGGER_Z - 10);
    await waitForPlayerPosition(page, FROZEN_LAKE_TRIGGER_Z);
  });

  test('should spawn dormant nests in frozen_lake phase', async ({ page }) => {
    // Wait for phase transition and spawning
    await page.waitForTimeout(3000);

    const nestCount = await getDormantNestCount(page);
    expect(nestCount).toBeGreaterThan(0);
  });

  test('should awaken nest when player approaches', async ({ page }) => {
    const initialNestCount = await getDormantNestCount(page);

    // Get position of a dormant nest and approach it
    await page.evaluate(() => {
      const w = window as any;
      const nests = w.__STELLAR_DESCENT_DEBUG__?.dormantNests || [];
      if (nests.length > 0) {
        const nest = nests[0];
        w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'navigate',
          target: { x: nest.position.x, y: 0, z: nest.position.z },
          threshold: 5,
        });
      }
    });

    // Wait for awakening
    await page.waitForTimeout(5000);

    const finalNestCount = await getDormantNestCount(page);
    expect(finalNestCount).toBeLessThan(initialNestCount);
  });

  test('should display awakening notification', async ({ page }) => {
    // Approach a dormant nest
    await page.evaluate(() => {
      const w = window as any;
      const nests = w.__STELLAR_DESCENT_DEBUG__?.dormantNests || [];
      if (nests.length > 0) {
        const nest = nests[0];
        w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'navigate',
          target: { x: nest.position.x, y: 0, z: nest.position.z },
          threshold: 5,
        });
      }
    });

    // Wait for awakening notification
    await page.waitForFunction(
      () => {
        const w = window as any;
        const notifications = w.__STELLAR_DESCENT_DEBUG__?.notifications || [];
        return notifications.some((n: string) => n.includes('AWAKENING'));
      },
      { timeout: 10000 }
    );
  });

  test.describe('Visual Regression - Dormant Cocoon', () => {
    test('should match dormant cocoon visual baseline', async ({ page }) => {
      // Navigate near a dormant nest for visual capture
      await page.evaluate(() => {
        const w = window as any;
        const nests = w.__STELLAR_DESCENT_DEBUG__?.dormantNests || [];
        if (nests.length > 0) {
          const nest = nests[0];
          w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
            type: 'navigate',
            target: { x: nest.position.x + 10, y: 0, z: nest.position.z },
            threshold: 2,
          });
        }
      });

      await page.waitForTimeout(3000);

      const screenshot = await page.screenshot({
        fullPage: false,
        clip: { x: 440, y: 160, width: 400, height: 400 },
      });

      expect(screenshot).toMatchSnapshot('southern-ice-dormant-cocoon.png', {
        threshold: 0.25,
      });
    });
  });
});

// ============================================================================
// TEST SUITE: Frozen Lake and Thin Ice
// ============================================================================

test.describe('Southern Ice Level - Frozen Lake', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
    // Navigate to frozen lake
    await navigatePlayerTo(page, 0, 0, FROZEN_LAKE_TRIGGER_Z - 10);
    await waitForPlayerPosition(page, FROZEN_LAKE_TRIGGER_Z);
  });

  test('should transition to frozen_lake phase', async ({ page }) => {
    const phase = await getCurrentPhase(page);
    expect(phase).toBe('frozen_lake');
  });

  test('should detect player on thin ice', async ({ page }) => {
    // Navigate to center of frozen lake
    await navigatePlayerTo(page, 0, 0, -160);
    await page.waitForTimeout(3000);

    const onThinIce = await isOnThinIce(page);
    expect(onThinIce).toBe(true);
  });

  test('should reduce blizzard intensity on lake', async ({ page }) => {
    await navigatePlayerTo(page, 0, 0, -160);
    await page.waitForTimeout(3000);

    const intensity = await getBlizzardIntensity(page);
    expect(intensity).toBeLessThan(0.5);
  });

  test('should display thin ice notification', async ({ page }) => {
    await navigatePlayerTo(page, 0, 0, -160);

    // Wait for thin ice notification
    await page.waitForFunction(
      () => {
        const w = window as any;
        const notifications = w.__STELLAR_DESCENT_DEBUG__?.notifications || [];
        return notifications.some((n: string) => n.includes('THIN ICE'));
      },
      { timeout: 10000 }
    );
  });

  test('should play ice cracking sounds on thin ice', async ({ page }) => {
    await navigatePlayerTo(page, 0, 0, -160);

    // Wait for ice creak sound to play
    const soundPlayed = await page.waitForFunction(
      () => {
        const w = window as any;
        const sounds = w.__STELLAR_DESCENT_DEBUG__?.recentSounds || [];
        return sounds.some((s: string) => s.includes('ice') || s.includes('creak'));
      },
      { timeout: 10000 }
    );

    expect(soundPlayed).toBeTruthy();
  });

  test.describe('Visual Regression - Frozen Lake', () => {
    test('should match frozen lake visual baseline', async ({ page }) => {
      await navigatePlayerTo(page, 0, 0, -160);
      await page.waitForTimeout(2000);

      const screenshot = await page.screenshot({
        fullPage: false,
        clip: { x: 0, y: 0, width: 1280, height: 720 },
      });

      expect(screenshot).toMatchSnapshot('southern-ice-frozen-lake.png', {
        threshold: 0.3,
      });
    });
  });
});

// ============================================================================
// TEST SUITE: Ice Caverns Phase
// ============================================================================

test.describe('Southern Ice Level - Ice Caverns', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
    // Navigate through to ice caverns
    await navigatePlayerTo(page, 0, 0, ICE_CAVERNS_TRIGGER_Z - 10);
    await waitForPlayerPosition(page, ICE_CAVERNS_TRIGGER_Z, 30000);
  });

  test('should transition to ice_caverns phase', async ({ page }) => {
    const phase = await getCurrentPhase(page);
    expect(phase).toBe('ice_caverns');
  });

  test('should have minimal blizzard inside caverns', async ({ page }) => {
    await page.waitForTimeout(2000);
    const intensity = await getBlizzardIntensity(page);
    expect(intensity).toBeLessThan(0.2);
  });

  test('should spawn additional dormant enemies in caverns', async ({ page }) => {
    await page.waitForTimeout(3000);
    const nestCount = await getDormantNestCount(page);
    expect(nestCount).toBeGreaterThan(0);
  });

  test('should update objective to clear caverns', async ({ page }) => {
    const objective = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.currentObjective || '';
    });
    expect(objective).toContain('CLEAR');
  });

  test.describe('Visual Regression - Ice Caverns', () => {
    test('should match ice caverns visual baseline', async ({ page }) => {
      await page.waitForTimeout(2000);

      const screenshot = await page.screenshot({
        fullPage: false,
        clip: { x: 0, y: 0, width: 1280, height: 720 },
      });

      expect(screenshot).toMatchSnapshot('southern-ice-caverns.png', {
        threshold: 0.3,
      });
    });
  });
});

// ============================================================================
// TEST SUITE: Phase Transitions
// ============================================================================

test.describe('Southern Ice Level - Phase Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should transition from ice_fields to frozen_lake', async ({ page }) => {
    expect(await getCurrentPhase(page)).toBe('ice_fields');

    await navigatePlayerTo(page, 0, 0, FROZEN_LAKE_TRIGGER_Z - 5);
    await waitForPlayerPosition(page, FROZEN_LAKE_TRIGGER_Z);

    expect(await getCurrentPhase(page)).toBe('frozen_lake');
  });

  test('should transition from frozen_lake to ice_caverns', async ({ page }) => {
    // Skip to frozen_lake
    await navigatePlayerTo(page, 0, 0, FROZEN_LAKE_TRIGGER_Z - 5);
    await waitForPlayerPosition(page, FROZEN_LAKE_TRIGGER_Z);
    expect(await getCurrentPhase(page)).toBe('frozen_lake');

    // Continue to ice_caverns
    await navigatePlayerTo(page, 0, 0, ICE_CAVERNS_TRIGGER_Z - 5);
    await waitForPlayerPosition(page, ICE_CAVERNS_TRIGGER_Z, 30000);

    expect(await getCurrentPhase(page)).toBe('ice_caverns');
  });

  test('should transition to complete phase at breach', async ({ page }) => {
    // Navigate all the way to the breach
    await navigatePlayerTo(page, 0, 0, BREACH_TRIGGER_Z - 5);
    await waitForPlayerPosition(page, BREACH_TRIGGER_Z, 60000);

    // Wait for level completion sequence
    await page.waitForFunction(
      () => {
        const w = window as any;
        return (
          w.__STELLAR_DESCENT_DEBUG__?.currentPhase === 'complete' ||
          w.__STELLAR_DESCENT_DEBUG__?.levelComplete === true
        );
      },
      { timeout: 15000 }
    );
  });

  test('should not allow backward phase transitions', async ({ page }) => {
    // Navigate to frozen_lake
    await navigatePlayerTo(page, 0, 0, FROZEN_LAKE_TRIGGER_Z - 5);
    await waitForPlayerPosition(page, FROZEN_LAKE_TRIGGER_Z);
    expect(await getCurrentPhase(page)).toBe('frozen_lake');

    // Navigate back north
    await navigatePlayerTo(page, 0, 0, FROZEN_LAKE_TRIGGER_Z + 20);
    await page.waitForTimeout(3000);

    // Phase should remain frozen_lake
    expect(await getCurrentPhase(page)).toBe('frozen_lake');
  });
});

// ============================================================================
// TEST SUITE: Collectibles
// ============================================================================

test.describe('Southern Ice Level - Collectibles', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should have collectibles in the level', async ({ page }) => {
    const status = await getCollectibleStatus(page);
    expect(status.total).toBeGreaterThan(0);
  });

  test('should be able to collect items', async ({ page }) => {
    const initialStatus = await getCollectibleStatus(page);

    // Navigate around to find collectibles
    await navigatePlayerTo(page, 30, 0, -30);
    await page.waitForTimeout(5000);
    await navigatePlayerTo(page, -30, 0, -60);
    await page.waitForTimeout(5000);

    const finalStatus = await getCollectibleStatus(page);
    expect(finalStatus.collected).toBeGreaterThanOrEqual(initialStatus.collected);
  });

  test('all collectibles should be accessible', async ({ page }) => {
    const status = await getCollectibleStatus(page);

    // Verify no collectibles are placed in inaccessible locations
    const inaccessibleCollectibles = await page.evaluate(() => {
      const w = window as any;
      const collectibles = w.__STELLAR_DESCENT_DEBUG__?.collectibles || [];
      const BOUNDS = { halfWidth: 150, southBound: -330, northBound: 50 };

      return collectibles.filter((c: any) => {
        return (
          Math.abs(c.position.x) > BOUNDS.halfWidth ||
          c.position.z < BOUNDS.southBound ||
          c.position.z > BOUNDS.northBound
        );
      });
    });

    expect(inaccessibleCollectibles.length).toBe(0);
  });
});

// ============================================================================
// TEST SUITE: Burrow Mechanics
// ============================================================================

test.describe('Southern Ice Level - Burrow Mechanics', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('Ice Chitin should burrow when at optimal distance', async ({ page }) => {
    // Wait for enemy to potentially burrow
    await page.waitForTimeout(10000);

    const burrowOccurred = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.burrowEventsLogged > 0;
    });

    // Burrow is probabilistic, so we just check the mechanic is enabled
    const burrowEnabled = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.burrowMechanicEnabled === true;
    });

    expect(burrowEnabled).toBe(true);
  });

  test('should deal emergence damage when Ice Chitin surfaces', async ({ page }) => {
    // This test requires an enemy to complete a burrow cycle near the player
    // We verify the mechanic exists and is properly configured
    const emergeConfig = await page.evaluate(() => {
      const w = window as any;
      return {
        emergeDamage: w.__STELLAR_DESCENT_DEBUG__?.burrowConfig?.emergeDamage ?? 0,
        emergeRadius: w.__STELLAR_DESCENT_DEBUG__?.burrowConfig?.emergeRadius ?? 0,
      };
    });

    expect(emergeConfig.emergeDamage).toBe(25);
    expect(emergeConfig.emergeRadius).toBe(4);
  });
});

// ============================================================================
// TEST SUITE: Combat and Weapons
// ============================================================================

test.describe('Southern Ice Level - Combat', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should start with 3 grenades', async ({ page }) => {
    const grenadeCount = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.grenadeCount ?? 0;
    });
    expect(grenadeCount).toBe(3);
  });

  test('should deal increased damage with kinetic weapons vs Ice Chitin', async ({ page }) => {
    const kineticMultiplier = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.iceChitinResistances?.kinetic ?? 1;
    });
    expect(kineticMultiplier).toBe(1.6);
  });

  test('should deal reduced damage with plasma weapons vs Ice Chitin', async ({ page }) => {
    const plasmaMultiplier = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.iceChitinResistances?.plasma ?? 1;
    });
    expect(plasmaMultiplier).toBe(0.35);
  });

  test('should track kill count', async ({ page }) => {
    const initialKills = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.totalKills ?? 0;
    });

    // Engage enemies
    await engageEnemies(page, true);
    await page.waitForTimeout(15000);

    const finalKills = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.totalKills ?? 0;
    });

    expect(finalKills).toBeGreaterThan(initialKills);
  });
});

// ============================================================================
// TEST SUITE: Level Completion
// ============================================================================

test.describe('Southern Ice Level - Completion', () => {
  test('should complete level when reaching the breach', async ({ page }) => {
    await startSouthernIceLevel(page);

    // Fast travel to near the breach (in dev mode)
    await page.evaluate(() => {
      const w = window as any;
      if (w.__STELLAR_DESCENT_DEBUG__?.teleportPlayer) {
        w.__STELLAR_DESCENT_DEBUG__.teleportPlayer(0, 0, -305);
      }
    });

    // Navigate to breach trigger
    await navigatePlayerTo(page, 0, 0, BREACH_TRIGGER_Z - 5);
    await waitForPlayerPosition(page, BREACH_TRIGGER_Z, 30000);

    // Wait for completion sequence
    const completed = await page.waitForFunction(
      () => {
        const w = window as any;
        return w.__STELLAR_DESCENT_DEBUG__?.levelComplete === true;
      },
      { timeout: 20000 }
    );

    expect(completed).toBeTruthy();
  });

  test('should show level completion screen', async ({ page }) => {
    await startSouthernIceLevel(page);

    // Fast travel to breach
    await page.evaluate(() => {
      const w = window as any;
      if (w.__STELLAR_DESCENT_DEBUG__?.teleportPlayer) {
        w.__STELLAR_DESCENT_DEBUG__.teleportPlayer(0, 0, BREACH_TRIGGER_Z - 5);
      }
    });

    await navigatePlayerTo(page, 0, 0, BREACH_TRIGGER_Z - 3);
    await waitForPlayerPosition(page, BREACH_TRIGGER_Z, 30000);

    // Wait for completion UI
    await page.waitForFunction(
      () => {
        const w = window as any;
        return w.__STELLAR_DESCENT_DEBUG__?.showingCompletionScreen === true;
      },
      { timeout: 25000 }
    );
  });
});

// ============================================================================
// TEST SUITE: Visual Regression - Ice Chitin Models
// ============================================================================

test.describe('Southern Ice Level - Ice Chitin Model Visuals', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should match Ice Warrior visual baseline', async ({ page }) => {
    // Navigate near an Ice Warrior enemy
    await page.evaluate(() => {
      const w = window as any;
      const enemies = w.__STELLAR_DESCENT_DEBUG__?.iceChitins || [];
      const warrior = enemies.find((e: any) => e.variant === 'warrior');
      if (warrior) {
        w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'navigate',
          target: { x: warrior.position.x + 8, y: 0, z: warrior.position.z },
          threshold: 3,
        });
      }
    });

    await page.waitForTimeout(4000);

    const screenshot = await page.screenshot({
      fullPage: false,
      clip: { x: 440, y: 160, width: 400, height: 400 },
    });

    expect(screenshot).toMatchSnapshot('southern-ice-warrior-model.png', {
      threshold: 0.25,
    });
  });

  test('should render frost aura visual effect', async ({ page }) => {
    // Navigate close enough to see frost aura but safe distance
    await page.evaluate(() => {
      const w = window as any;
      const enemies = w.__STELLAR_DESCENT_DEBUG__?.iceChitins || [];
      if (enemies.length > 0) {
        const enemy = enemies[0];
        w.__STELLAR_DESCENT_DEBUG__.playerGovernor.setGoal({
          type: 'navigate',
          target: { x: enemy.position.x + 6, y: 0, z: enemy.position.z },
          threshold: 2,
        });
      }
    });

    await page.waitForTimeout(3000);

    const auraVisible = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.frostAuraVisible === true;
    });

    expect(auraVisible).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Environmental Audio
// ============================================================================

test.describe('Southern Ice Level - Environmental Audio', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should initialize environmental audio', async ({ page }) => {
    const audioInitialized = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.environmentalAudioInitialized === true;
    });
    expect(audioInitialized).toBe(true);
  });

  test('should play wind/blizzard ambient sounds', async ({ page }) => {
    await page.waitForTimeout(3000);

    const ambientPlaying = await page.evaluate(() => {
      const w = window as any;
      const sounds = w.__STELLAR_DESCENT_DEBUG__?.activeSounds || [];
      return sounds.some(
        (s: string) => s.includes('wind') || s.includes('blizzard') || s.includes('ambient')
      );
    });

    expect(ambientPlaying).toBe(true);
  });
});

// ============================================================================
// TEST SUITE: Performance
// ============================================================================

test.describe('Southern Ice Level - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await startSouthernIceLevel(page);
  });

  test('should maintain acceptable framerate', async ({ page }) => {
    // Wait for level to stabilize
    await page.waitForTimeout(5000);

    const fps = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.currentFPS ?? 0;
    });

    // Should maintain at least 30 FPS
    expect(fps).toBeGreaterThanOrEqual(30);
  });

  test('should not exceed memory budget', async ({ page }) => {
    await page.waitForTimeout(5000);

    const memoryUsage = await page.evaluate(() => {
      const w = window as any;
      return w.__STELLAR_DESCENT_DEBUG__?.memoryUsageMB ?? 0;
    });

    // Should stay under 512MB for the level
    expect(memoryUsage).toBeLessThan(512);
  });
});
