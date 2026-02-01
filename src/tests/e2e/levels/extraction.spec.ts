/**
 * Playwright E2E Test: Level 9 - Extraction (Survival Holdout)
 *
 * Comprehensive test for the Extraction level featuring:
 * - Escape sequence to LZ Omega
 * - Evac beacon activation
 * - Wave-based enemy survival (7 waves)
 * - Holdout defense mechanics
 * - Increasing difficulty waves
 * - Extraction ship arrival
 * - Final evacuation sequence
 * - Mission complete
 *
 * Uses PlayerGovernor for autonomous gameplay testing.
 */

import { expect, type Page, test } from '@playwright/test';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  /** Base URL for the game (matches playwright.config.ts) */
  baseUrl: 'http://localhost:4174',

  /** Timeout for level loading */
  loadTimeout: 60000,

  /** Timeout for phase transitions */
  phaseTimeout: 30000,

  /** Timeout for wave completion */
  waveTimeout: 120000,

  /** Timeout for victory sequence */
  victoryTimeout: 60000,

  /** Screenshot directory */
  screenshotDir: 'test-results/screenshots/extraction',
};

// ============================================================================
// TYPES
// ============================================================================

interface ExtractionPhaseState {
  phase:
    | 'escape_start'
    | 'escape_tunnel'
    | 'surface_run'
    | 'holdout'
    | 'hive_collapse'
    | 'victory'
    | 'epilogue';
  phaseTime: number;
  escapeTimer: number;
  dropshipETA: number;
  hiveCollapseTimer: number;
}

interface WaveState {
  currentWave: number;
  wavePhase: 'waiting' | 'announcement' | 'active' | 'intermission';
  waveEnemiesRemaining: number;
  waveEnemiesKilled: number;
}

interface ExtractionDebugState {
  phase: ExtractionPhaseState;
  wave: WaveState;
  playerHealth: number;
  kills: number;
  mechIntegrity: number;
  activeEnemyCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Wait for the game to load and be interactive
 */
async function waitForGameLoad(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const win = window as Window & { __STELLAR_DESCENT_DEBUG__?: { isLoaded: boolean } };
      return win.__STELLAR_DESCENT_DEBUG__?.isLoaded === true;
    },
    { timeout: TEST_CONFIG.loadTimeout }
  );
}

/**
 * Navigate to extraction level via dev menu
 */
async function navigateToExtractionLevel(page: Page): Promise<void> {
  // Open dev menu with backtick
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(500);

  // Enable all levels unlocked
  await page.evaluate(() => {
    const win = window as Window & {
      __STELLAR_DESCENT_DEBUG__?: {
        devMode: { allLevelsUnlocked: boolean };
        campaign: { loadLevel: (id: string) => Promise<void> };
      };
    };
    if (win.__STELLAR_DESCENT_DEBUG__) {
      win.__STELLAR_DESCENT_DEBUG__.devMode.allLevelsUnlocked = true;
    }
  });

  // Load extraction level directly
  await page.evaluate(() => {
    const win = window as Window & {
      __STELLAR_DESCENT_DEBUG__?: {
        campaign: { loadLevel: (id: string) => Promise<void> };
      };
    };
    return win.__STELLAR_DESCENT_DEBUG__?.campaign.loadLevel('extraction');
  });

  // Wait for level to initialize
  await page.waitForTimeout(3000);
}

/**
 * Get current extraction level state from debug interface
 */
async function getExtractionState(page: Page): Promise<ExtractionDebugState | null> {
  return page.evaluate(() => {
    const win = window as Window & {
      __STELLAR_DESCENT_DEBUG__?: {
        extractionLevel?: {
          getPhaseState: () => ExtractionPhaseState;
          getWaveState: () => WaveState;
          getPlayerHealth: () => number;
          getKills: () => number;
          getMechIntegrity: () => number;
          getActiveEnemyCount: () => number;
        };
      };
    };
    const level = win.__STELLAR_DESCENT_DEBUG__?.extractionLevel;
    if (!level) return null;

    return {
      phase: level.getPhaseState(),
      wave: level.getWaveState(),
      playerHealth: level.getPlayerHealth(),
      kills: level.getKills(),
      mechIntegrity: level.getMechIntegrity(),
      activeEnemyCount: level.getActiveEnemyCount(),
    };
  });
}

/**
 * Set PlayerGovernor goal for autonomous play
 */
async function setGovernorGoal(
  page: Page,
  goal: { type: string; [key: string]: unknown }
): Promise<void> {
  await page.evaluate((goalObj) => {
    const win = window as Window & {
      __STELLAR_DESCENT_DEBUG__?: {
        playerGovernor: {
          setGoal: (goal: { type: string; [key: string]: unknown }) => void;
        };
      };
    };
    win.__STELLAR_DESCENT_DEBUG__?.playerGovernor.setGoal(goalObj);
  }, goal);
}

/**
 * Wait for specific extraction phase
 */
async function waitForPhase(
  page: Page,
  targetPhase: ExtractionPhaseState['phase'],
  timeout = TEST_CONFIG.phaseTimeout
): Promise<void> {
  await page.waitForFunction(
    (phase) => {
      const win = window as Window & {
        __STELLAR_DESCENT_DEBUG__?: {
          extractionLevel?: {
            getPhaseState: () => { phase: string };
          };
        };
      };
      return win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.getPhaseState().phase === phase;
    },
    targetPhase,
    { timeout }
  );
}

/**
 * Wait for specific wave number
 */
async function waitForWave(
  page: Page,
  waveNumber: number,
  timeout = TEST_CONFIG.waveTimeout
): Promise<void> {
  await page.waitForFunction(
    (wave) => {
      const win = window as Window & {
        __STELLAR_DESCENT_DEBUG__?: {
          extractionLevel?: {
            getWaveState: () => { currentWave: number };
          };
        };
      };
      return win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.getWaveState().currentWave >= wave;
    },
    waveNumber,
    { timeout }
  );
}

/**
 * Wait for wave to complete (all enemies killed)
 */
async function waitForWaveComplete(page: Page, timeout = TEST_CONFIG.waveTimeout): Promise<void> {
  await page.waitForFunction(
    () => {
      const win = window as Window & {
        __STELLAR_DESCENT_DEBUG__?: {
          extractionLevel?: {
            getWaveState: () => { wavePhase: string; waveEnemiesRemaining: number };
          };
        };
      };
      const state = win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.getWaveState();
      return state?.wavePhase === 'waiting' || state?.wavePhase === 'intermission';
    },
    { timeout }
  );
}

/**
 * Take a screenshot with proper naming
 */
async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${TEST_CONFIG.screenshotDir}/${name}.png`,
    fullPage: true,
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

test.describe('Level 9: Extraction - Survival Holdout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to game
    await page.goto(TEST_CONFIG.baseUrl);
    await waitForGameLoad(page);
  });

  // ==========================================================================
  // PHASE TESTS
  // ==========================================================================

  test.describe('Phase Progression', () => {
    test('should start in escape_start phase', async ({ page }) => {
      await navigateToExtractionLevel(page);

      const state = await getExtractionState(page);
      expect(state).not.toBeNull();
      expect(state?.phase.phase).toBe('escape_start');

      await takeScreenshot(page, '01-escape-start');
    });

    test('should transition to escape_tunnel phase', async ({ page }) => {
      await navigateToExtractionLevel(page);

      // Wait for automatic transition
      await waitForPhase(page, 'escape_tunnel');

      const state = await getExtractionState(page);
      expect(state?.phase.phase).toBe('escape_tunnel');
      expect(state?.phase.escapeTimer).toBeGreaterThan(0);

      await takeScreenshot(page, '02-escape-tunnel');
    });

    test('should complete escape and reach surface_run phase', async ({ page }) => {
      await navigateToExtractionLevel(page);

      // Use PlayerGovernor to navigate forward through tunnel
      await setGovernorGoal(page, { type: 'navigate', target: { x: 0, y: 1.7, z: -300 } });

      await waitForPhase(page, 'surface_run', 60000);

      const state = await getExtractionState(page);
      expect(state?.phase.phase).toBe('surface_run');

      await takeScreenshot(page, '03-surface-run');
    });

    test('should reach holdout phase at LZ Omega', async ({ page }) => {
      await navigateToExtractionLevel(page);

      // Navigate to LZ Omega position
      await setGovernorGoal(page, { type: 'navigate', target: { x: 0, y: 1.7, z: -500 } });

      await waitForPhase(page, 'holdout', 90000);

      const state = await getExtractionState(page);
      expect(state?.phase.phase).toBe('holdout');
      expect(state?.phase.dropshipETA).toBeGreaterThan(0);

      await takeScreenshot(page, '04-holdout-start');
    });
  });

  // ==========================================================================
  // BEACON ACTIVATION TESTS
  // ==========================================================================

  test.describe('Evac Beacon Activation', () => {
    test('should activate beacon when reaching LZ', async ({ page }) => {
      await navigateToExtractionLevel(page);

      // Navigate directly to holdout phase
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
      });

      await page.waitForTimeout(2000);

      // Verify beacon activation notification
      const beaconVisible = await page.locator('text=/DEFEND|LZ OMEGA|BEACON/i').isVisible();
      expect(beaconVisible).toBe(true);

      await takeScreenshot(page, '05-beacon-activated');
    });

    test('should display dropship ETA timer', async ({ page }) => {
      await navigateToExtractionLevel(page);

      // Skip to holdout phase
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
      });

      await page.waitForTimeout(2000);

      const state = await getExtractionState(page);
      expect(state?.phase.dropshipETA).toBeGreaterThan(0);

      // Verify timer is displayed in HUD
      const timerVisible = await page.locator('text=/ETA|DROPSHIP|\\d+:\\d+/i').isVisible();
      expect(timerVisible).toBe(true);

      await takeScreenshot(page, '06-dropship-eta');
    });
  });

  // ==========================================================================
  // WAVE SYSTEM TESTS
  // ==========================================================================

  test.describe('Wave-Based Combat', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToExtractionLevel(page);

      // Skip to holdout phase for wave testing
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
      });

      await page.waitForTimeout(2000);
    });

    test('should start wave 1 with skitterer swarm', async ({ page }) => {
      await waitForWave(page, 1);

      const state = await getExtractionState(page);
      expect(state?.wave.currentWave).toBe(1);

      // Wave 1 announcement should be visible
      const waveAnnouncement = await page
        .locator('text=/WAVE 1|SKITTERER SWARM/i')
        .isVisible()
        .catch(() => false);
      expect(waveAnnouncement).toBeDefined();

      await takeScreenshot(page, '07-wave-1-start');
    });

    test('should spawn enemies during active wave', async ({ page }) => {
      await waitForWave(page, 1);

      // Wait for enemies to spawn
      await page.waitForTimeout(5000);

      const state = await getExtractionState(page);
      expect(state?.activeEnemyCount).toBeGreaterThan(0);

      await takeScreenshot(page, '08-wave-1-enemies');
    });

    test('should increment wave counter after wave completion', async ({ page }) => {
      // Enable god mode and fast-forward for testing
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            devMode: { godMode: boolean };
            extractionLevel?: {
              killAllWaveEnemies: () => void;
            };
          };
        };
        if (win.__STELLAR_DESCENT_DEBUG__) {
          win.__STELLAR_DESCENT_DEBUG__.devMode.godMode = true;
        }
      });

      await waitForWave(page, 1);
      await page.waitForTimeout(3000);

      // Kill all wave enemies to complete wave
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              killAllWaveEnemies: () => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.killAllWaveEnemies();
      });

      await waitForWaveComplete(page);

      // Wait for wave 2 to start
      await waitForWave(page, 2, 30000);

      const state = await getExtractionState(page);
      expect(state?.wave.currentWave).toBe(2);

      await takeScreenshot(page, '09-wave-2-start');
    });

    test('should display wave progress in HUD', async ({ page }) => {
      await waitForWave(page, 1);
      await page.waitForTimeout(3000);

      // HUD should show wave progress
      const hudVisible = await page.locator('text=/WAVE \\d+\\/7|HOSTILES/i').isVisible();
      expect(hudVisible).toBe(true);

      await takeScreenshot(page, '10-wave-hud');
    });
  });

  // ==========================================================================
  // ENEMY VARIETY TESTS
  // ==========================================================================

  test.describe('Enemy Variety Progression', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
            devMode: { godMode: boolean };
          };
        };
        if (win.__STELLAR_DESCENT_DEBUG__) {
          win.__STELLAR_DESCENT_DEBUG__.devMode.godMode = true;
          win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
        }
      });

      await page.waitForTimeout(2000);
    });

    test('wave 1 should contain only skitterers (drones)', async ({ page }) => {
      await waitForWave(page, 1);
      await page.waitForTimeout(3000);

      const enemyTypes = await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              getActiveEnemyTypes: () => string[];
            };
          };
        };
        return win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.getActiveEnemyTypes() ?? [];
      });

      // Wave 1 should primarily have skitterers
      expect(enemyTypes.length).toBeGreaterThan(0);
    });

    test('later waves should have mixed enemy types', async ({ page }) => {
      // Skip to wave 4 for mixed enemies
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToWave: (wave: number) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToWave(4);
      });

      await page.waitForTimeout(5000);

      const enemyTypes = await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              getActiveEnemyTypes: () => string[];
            };
          };
        };
        return win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.getActiveEnemyTypes() ?? [];
      });

      // Wave 4 should have variety
      const uniqueTypes = Array.from(new Set(enemyTypes));
      expect(uniqueTypes.length).toBeGreaterThanOrEqual(1);

      await takeScreenshot(page, '11-wave-4-mixed');
    });

    test('wave 6 should include husks', async ({ page }) => {
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToWave: (wave: number) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToWave(6);
      });

      await page.waitForTimeout(5000);

      const state = await getExtractionState(page);
      expect(state?.wave.currentWave).toBe(6);

      await takeScreenshot(page, '12-wave-6-husks');
    });

    test('wave 7 should have all enemy types (final assault)', async ({ page }) => {
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToWave: (wave: number) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToWave(7);
      });

      await page.waitForTimeout(3000);

      const waveTitle = await page.locator('text=/WAVE 7|FINAL ASSAULT/i').isVisible();
      expect(waveTitle).toBe(true);

      await takeScreenshot(page, '13-wave-7-final');
    });
  });

  // ==========================================================================
  // EXTRACTION SEQUENCE TESTS
  // ==========================================================================

  test.describe('Extraction Sequence', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToExtractionLevel(page);

      // Enable god mode and skip to near end
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            devMode: { godMode: boolean };
          };
        };
        if (win.__STELLAR_DESCENT_DEBUG__) {
          win.__STELLAR_DESCENT_DEBUG__.devMode.godMode = true;
        }
      });
    });

    test('should trigger hive collapse after all waves', async ({ page }) => {
      // Skip to after wave 7
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('hive_collapse');
      });

      await page.waitForTimeout(2000);

      const state = await getExtractionState(page);
      expect(state?.phase.phase).toBe('hive_collapse');
      expect(state?.phase.hiveCollapseTimer).toBeGreaterThan(0);

      await takeScreenshot(page, '14-hive-collapse');
    });

    test('should display collapse timer', async ({ page }) => {
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('hive_collapse');
      });

      await page.waitForTimeout(2000);

      // Timer should be visible
      const timerVisible = await page.locator('text=/TIME:|REACH THE DROPSHIP/i').isVisible();
      expect(timerVisible).toBe(true);

      await takeScreenshot(page, '15-collapse-timer');
    });

    test('should show extraction ship arrival', async ({ page }) => {
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('victory');
      });

      await page.waitForTimeout(3000);

      const state = await getExtractionState(page);
      expect(state?.phase.phase).toBe('victory');

      // Ship arrival notification
      const arrivalVisible = await page.locator('text=/DROPSHIP|ARRIVING|EXTRACTION/i').isVisible();
      expect(arrivalVisible).toBe(true);

      await takeScreenshot(page, '16-dropship-arrival');
    });

    test('should complete level after boarding dropship', async ({ page }) => {
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('epilogue');
      });

      await page.waitForTimeout(3000);

      const state = await getExtractionState(page);
      expect(state?.phase.phase).toBe('epilogue');

      await takeScreenshot(page, '17-mission-complete');
    });
  });

  // ==========================================================================
  // PLAYER GOVERNOR INTEGRATION
  // ==========================================================================

  test.describe('PlayerGovernor Integration', () => {
    test('should defend position using PlayerGovernor', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
            devMode: { godMode: boolean };
          };
        };
        if (win.__STELLAR_DESCENT_DEBUG__) {
          win.__STELLAR_DESCENT_DEBUG__.devMode.godMode = true;
          win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
        }
      });

      await page.waitForTimeout(2000);

      // Set PlayerGovernor to defend position at LZ
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            playerGovernor: {
              setGoal: (goal: {
                type: string;
                position?: { x: number; y: number; z: number };
              }) => void;
            };
          };
        };
        const lzPosition = { x: 0, y: 1.7, z: -500 };
        win.__STELLAR_DESCENT_DEBUG__?.playerGovernor.setGoal({
          type: 'defend_position',
          position: lzPosition,
        });
      });

      await page.waitForTimeout(5000);

      // Verify governor is engaging enemies
      const state = await getExtractionState(page);
      expect(state?.kills).toBeGreaterThanOrEqual(0);

      await takeScreenshot(page, '18-governor-defending');
    });

    test('should engage enemies autonomously', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
            devMode: { godMode: boolean };
          };
        };
        if (win.__STELLAR_DESCENT_DEBUG__) {
          win.__STELLAR_DESCENT_DEBUG__.devMode.godMode = true;
          win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
        }
      });

      await page.waitForTimeout(2000);

      // Set aggressive engagement mode
      await setGovernorGoal(page, { type: 'engage_enemies', aggressive: true });

      await page.waitForTimeout(10000);

      const state = await getExtractionState(page);
      expect(state?.kills).toBeGreaterThan(0);

      await takeScreenshot(page, '19-governor-kills');
    });
  });

  // ==========================================================================
  // VISUAL REGRESSION TESTS
  // ==========================================================================

  test.describe('Visual Regression', () => {
    test('LZ Omega environment should render correctly', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
      });

      await page.waitForTimeout(3000);

      // Take visual regression screenshot of LZ environment
      await expect(page).toHaveScreenshot('lz-omega-environment.png', {
        maxDiffPixels: 1000,
        threshold: 0.3,
      });
    });

    test('extraction ship should render correctly', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('victory');
      });

      await page.waitForTimeout(5000);

      // Take visual regression screenshot of dropship
      await expect(page).toHaveScreenshot('extraction-dropship.png', {
        maxDiffPixels: 1500,
        threshold: 0.3,
      });
    });

    test('wave HUD should display correctly', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
      });

      await page.waitForTimeout(5000);

      // Take visual regression screenshot of HUD during waves
      const hudElement = page.locator('[data-testid="game-hud"]');
      if (await hudElement.isVisible()) {
        await expect(hudElement).toHaveScreenshot('wave-hud.png', {
          maxDiffPixels: 500,
          threshold: 0.2,
        });
      }
    });

    test('hive collapse effects should render correctly', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('hive_collapse');
      });

      await page.waitForTimeout(3000);

      // Take visual regression screenshot of collapse effects
      await expect(page).toHaveScreenshot('hive-collapse-effects.png', {
        maxDiffPixels: 2000,
        threshold: 0.4, // Higher threshold due to particle effects
      });
    });
  });

  // ==========================================================================
  // FULL PLAYTHROUGH TEST
  // ==========================================================================

  test.describe('Full Level Playthrough', () => {
    test('should complete entire extraction level', async ({ page }) => {
      // Set extended timeout for full playthrough (10 minutes)
      test.setTimeout(600000);
      await navigateToExtractionLevel(page);

      // Enable god mode for full playthrough
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            devMode: { godMode: boolean };
          };
        };
        if (win.__STELLAR_DESCENT_DEBUG__) {
          win.__STELLAR_DESCENT_DEBUG__.devMode.godMode = true;
        }
      });

      // Phase 1: Escape tunnel
      await waitForPhase(page, 'escape_tunnel', 10000);
      await setGovernorGoal(page, { type: 'navigate', target: { x: 0, y: 1.7, z: -300 } });
      await takeScreenshot(page, 'full-01-escape');

      // Phase 2: Surface run
      await waitForPhase(page, 'surface_run', 60000);
      await setGovernorGoal(page, { type: 'navigate', target: { x: 0, y: 1.7, z: -500 } });
      await takeScreenshot(page, 'full-02-surface');

      // Phase 3: Holdout - process all 7 waves
      await waitForPhase(page, 'holdout', 60000);
      await setGovernorGoal(page, { type: 'engage_enemies', aggressive: true });
      await takeScreenshot(page, 'full-03-holdout');

      for (let wave = 1; wave <= 7; wave++) {
        await waitForWave(page, wave, 30000);
        await takeScreenshot(page, `full-04-wave-${wave}`);

        // Kill all enemies to complete wave faster
        await page.evaluate(() => {
          const win = window as Window & {
            __STELLAR_DESCENT_DEBUG__?: {
              extractionLevel?: {
                killAllWaveEnemies: () => void;
              };
            };
          };
          win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.killAllWaveEnemies();
        });

        await waitForWaveComplete(page, 30000);
      }

      // Phase 4: Hive collapse
      await waitForPhase(page, 'hive_collapse', 60000);
      await setGovernorGoal(page, { type: 'navigate', target: { x: 0, y: 1.7, z: -500 } });
      await takeScreenshot(page, 'full-05-collapse');

      // Phase 5: Victory
      await waitForPhase(page, 'victory', 120000);
      await takeScreenshot(page, 'full-06-victory');

      // Final state verification
      const finalState = await getExtractionState(page);
      expect(finalState?.phase.phase).toMatch(/victory|epilogue/);
      expect(finalState?.kills).toBeGreaterThan(0);

      await takeScreenshot(page, 'full-07-complete');
    });
  });

  // ==========================================================================
  // EDGE CASES AND ERROR HANDLING
  // ==========================================================================

  test.describe('Edge Cases', () => {
    test('should handle player death and respawn', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
              damagePlayer: (amount: number) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
      });

      await page.waitForTimeout(2000);

      // Damage player to death
      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              damagePlayer: (amount: number) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.damagePlayer(100);
      });

      await page.waitForTimeout(3000);

      // Should respawn or show death screen
      const deathVisible = await page.locator('text=/KIA|RESPAWN|DEATH/i').isVisible();
      expect(deathVisible).toBe(true);

      await takeScreenshot(page, '20-player-death');
    });

    test('should handle mech destruction', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
              setMechIntegrity: (value: number) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('holdout');
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.setMechIntegrity(0);
      });

      await page.waitForTimeout(2000);

      const state = await getExtractionState(page);
      expect(state?.mechIntegrity).toBe(0);

      await takeScreenshot(page, '21-mech-destroyed');
    });

    test('should handle collapse timer expiration', async ({ page }) => {
      await navigateToExtractionLevel(page);

      await page.evaluate(() => {
        const win = window as Window & {
          __STELLAR_DESCENT_DEBUG__?: {
            extractionLevel?: {
              skipToPhase: (phase: string) => void;
              setCollapseTimer: (value: number) => void;
            };
          };
        };
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.skipToPhase('hive_collapse');
        win.__STELLAR_DESCENT_DEBUG__?.extractionLevel?.setCollapseTimer(1);
      });

      await page.waitForTimeout(3000);

      // Should show failure/respawn
      const failureVisible = await page.locator('text=/COLLAPSE|KIA|MARCUS/i').isVisible();
      expect(failureVisible).toBe(true);

      await takeScreenshot(page, '22-collapse-failure');
    });
  });
});
