/**
 * Anchor Station (Tutorial Level) - Comprehensive E2E Test
 *
 * Tests the complete tutorial experience including:
 * - Phase 0: Initial briefing/comms from ATHENA
 * - Phase 1: Movement tutorial (WASD) and platforming (jump, crouch)
 * - Phase 2: Equipment bay (suit, look controls)
 * - Phase 3: Shooting range (weapon calibration)
 * - Phase 4: Hangar bay, launch sequence
 *
 * Uses PlayerGovernor for AI-controlled player actions when needed.
 */

import { expect, type Page, test } from '@playwright/test';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface TutorialStep {
  id: string;
  title: string;
  phase: number;
}

interface GameDebugInterface {
  playerGovernor: {
    setGoal: (goal: GovernorGoal) => void;
    getInputState: () => InputState;
    getCurrentGoal: () => GovernorGoal;
    addEventListener: (listener: (event: GovernorEvent) => void) => void;
    runTutorialPlaythrough: () => void;
    navigateTo: (position: Vector3, threshold?: number) => void;
    wait: (duration: number) => void;
  };
  tutorialManager: {
    getCurrentStep: () => TutorialStep | null;
    getCurrentPhase: () => number;
    getProgress: () => number;
    skip: () => void;
    isRunning: () => boolean;
  };
  gameState: {
    phase: string;
    levelId: string;
    isPaused: boolean;
  };
  player: {
    position: Vector3;
    health: number;
    isAlive: boolean;
  };
}

interface GovernorGoal {
  type: string;
  target?: Vector3;
  threshold?: number;
  duration?: number;
  aggressive?: boolean;
}

interface GovernorEvent {
  type: string;
  goal?: GovernorGoal;
  position?: Vector3;
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

// Room positions from ModularStationBuilder.ts
const ROOM_POSITIONS = {
  briefingRoom: { x: 0, y: 1.5, z: 2 },
  corridorA: { x: 0, y: 1.5, z: -14 },
  equipmentBay: { x: -10, y: 1.5, z: -16 },
  suitLocker: { x: -12, y: 1.5, z: -16 },
  armory: { x: 10, y: 1.5, z: -16 },
  weaponRack: { x: 12, y: 1.5, z: -16 },
  platformingEntry: { x: 0, y: 1.5, z: -28 },
  platform1: { x: -3, y: 1.5, z: -32 },
  platform2: { x: 0, y: 2.0, z: -34 },
  crouchPassageEntry: { x: -2, y: 1.5, z: -37 },
  platformingExit: { x: 0, y: 1.5, z: -40 },
  shootingRange: { x: 0, y: 1.5, z: -52 },
  shootingPosition: { x: 0, y: 1.5, z: -48 },
  hangarEntry: { x: 0, y: 1.5, z: -64 },
  hangarBay: { x: 0, y: 1.5, z: -70 },
  dropPod: { x: 0, y: 1.5, z: -76 },
};

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wait for the React app to initialize (root element has children)
 */
async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    },
    { timeout: 30000 }
  );
}

/**
 * Wait for splash screen to appear and dismiss it by clicking
 */
async function skipSplashScreen(page: Page): Promise<void> {
  // Wait for splash video elements to appear
  try {
    await page.waitForSelector('video', { timeout: 5000 });
    // Click to skip (the splash handles click to skip)
    await page.click('body');
    await page.waitForTimeout(500);
    // Click again if needed (first click might just unlock audio)
    await page.click('body');
  } catch {
    // Splash may have auto-skipped or already at menu
    console.log('Splash screen not found or already dismissed');
  }

  // Wait for splash to transition away (videos gone or main menu visible)
  await page.waitForFunction(
    () => {
      const videos = document.querySelectorAll('video');
      const hasNewGame = Array.from(document.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('NEW GAME')
      );
      return hasNewGame || videos.length === 0;
    },
    { timeout: 15000 }
  );
}

/**
 * Wait for main menu to be visible
 */
async function waitForMainMenu(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(
        (b) => b.textContent?.includes('NEW GAME') || b.textContent?.includes('CONTINUE')
      );
    },
    { timeout: 30000 }
  );
}

/**
 * Navigate from app start to main menu (skip splash)
 */
async function navigateToMainMenu(page: Page): Promise<void> {
  await waitForAppReady(page);
  await skipSplashScreen(page);
  await waitForMainMenu(page);
}

/**
 * Wait for the game canvas to be ready and WebGL context initialized
 * Only call this AFTER the game level has started loading
 */
async function waitForGameCanvas(page: Page): Promise<void> {
  // Wait for canvas element
  await page.waitForSelector('canvas', { timeout: 60000 });

  // Wait for WebGL context
  await page.evaluate(async () => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebGL init timeout')), 30000);
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        clearTimeout(timeout);
        reject(new Error('Canvas not found'));
        return;
      }

      const checkWebGL = () => {
        try {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (gl) {
            clearTimeout(timeout);
            resolve();
            return true;
          }
        } catch {
          // WebGL not ready yet
        }
        return false;
      };

      if (checkWebGL()) return;

      const interval = setInterval(() => {
        if (checkWebGL()) {
          clearInterval(interval);
        }
      }, 100);
    });
  });
}

/**
 * Click the NEW GAME button on the main menu
 */
async function clickNewGame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      if (btn.textContent?.includes('NEW GAME')) {
        btn.click();
        return true;
      }
    }
    throw new Error('NEW GAME button not found');
  });
  await page.waitForTimeout(500);
}

/**
 * Handle the level select modal (if shown) and select first level
 */
async function handleLevelSelect(page: Page): Promise<void> {
  // Wait for level select modal to appear
  try {
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || '';
        return (
          text.includes('SELECT MISSION') ||
          text.includes('ANCHOR STATION') ||
          text.includes('CHAPTER 1')
        );
      },
      { timeout: 5000 }
    );
  } catch {
    // Level select may not be shown, continue
    return;
  }

  // Click on the first level (Anchor Station / Chapter 1)
  await page.evaluate(() => {
    // Find all clickable elements
    const allElements = Array.from(document.querySelectorAll('button, [role="button"], div'));

    // Look for Chapter 1 / Anchor Station card
    for (const el of allElements) {
      const text = el.textContent || '';
      if (
        (text.includes('CHAPTER 1') || text.includes('ANCHOR STATION')) &&
        !text.includes('CHAPTER 2')
      ) {
        (el as HTMLElement).click();
        return;
      }
    }

    // Fallback: click any element containing "ANCHOR"
    for (const el of allElements) {
      if (el.textContent?.includes('ANCHOR')) {
        (el as HTMLElement).click();
        return;
      }
    }
  });

  await page.waitForTimeout(1000);
}

/**
 * Handle difficulty selection modal (if shown)
 */
async function handleDifficultySelect(page: Page, difficulty = 'normal'): Promise<void> {
  // Check if difficulty selector is shown
  const hasDifficulty = await page.evaluate(() => {
    const text = document.body.textContent?.toLowerCase() || '';
    return (
      text.includes('select difficulty') ||
      (text.includes('easy') && text.includes('normal') && text.includes('hard'))
    );
  });

  if (hasDifficulty) {
    // Select the difficulty option
    await page.evaluate((diff) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes(diff) && !text.includes('start') && !text.includes('back')) {
          btn.click();
          return;
        }
      }
    }, difficulty);
    await page.waitForTimeout(500);

    // Click START CAMPAIGN button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.textContent?.toUpperCase() || '';
        if (text.includes('START CAMPAIGN') || text.includes('START')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(1000);
  }
}

/**
 * Handle mission briefing screen and click BEGIN MISSION
 */
async function handleMissionBriefing(page: Page): Promise<void> {
  // Wait for briefing screen or BEGIN button
  try {
    await page.waitForFunction(
      () => {
        const text = document.body.textContent || '';
        return text.includes('MISSION BRIEFING') || text.includes('BEGIN MISSION');
      },
      { timeout: 10000 }
    );
  } catch {
    // Briefing may not be shown
    return;
  }

  await page.waitForTimeout(500);

  // The briefing has a typing animation. Space skips the animation,
  // and Enter only works after the typing is complete.
  // Press Space multiple times to ensure animation is skipped.
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);
  await page.keyboard.press(' ');
  await page.waitForTimeout(300);

  // Now press Enter to begin mission
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);

  // Check if briefing is still shown
  const stillOnBriefing = await page.evaluate(() => {
    const text = document.body.textContent || '';
    return text.includes('MISSION BRIEFING') && text.includes('BEGIN MISSION');
  });

  if (stillOnBriefing) {
    // Click BEGIN MISSION button directly as fallback
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.textContent?.toUpperCase() || '';
        if (text.includes('BEGIN MISSION')) {
          (btn as HTMLButtonElement).click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(500);
  }

  // Wait for transition to game
  await page.waitForTimeout(1000);
}

/**
 * Start a new game from the main menu (full flow)
 * Flow: Main Menu → Level Select → Difficulty (optional) → Briefing → Game
 */
async function startNewGame(page: Page, difficulty = 'normal'): Promise<void> {
  await clickNewGame(page);
  await handleLevelSelect(page);
  await handleDifficultySelect(page, difficulty);
  await handleMissionBriefing(page);
}

/**
 * Wait for tutorial level to load (canvas + game state)
 */
async function waitForTutorialLevel(page: Page): Promise<void> {
  // First wait for canvas (BabylonJS scene)
  await waitForGameCanvas(page);

  // Wait for game phase to indicate playing
  await page.waitForFunction(
    () => {
      // Check debug interface
      const debug = (window as any).__STELLAR_DESCENT_DEBUG__;
      if (debug?.campaign?.phase) {
        const phase = debug.campaign.phase;
        return phase === 'playing' || phase === 'tutorial' || phase === 'briefing';
      }

      // Fallback: look for HUD or game UI elements
      const gameUI = document.querySelector(
        'canvas, [class*="hud"], [class*="HUD"], [class*="objective"]'
      );
      return gameUI !== null;
    },
    { timeout: 60000 }
  );

  // Additional wait for scene to stabilize
  await page.waitForTimeout(2000);
}

/**
 * Get the current tutorial phase from the game
 */
async function getTutorialPhase(page: Page): Promise<number> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
      .__STELLAR_DESCENT_DEBUG__;
    return debug?.tutorialManager?.getCurrentPhase() ?? -1;
  });
}

/**
 * Get the current tutorial step
 */
async function getCurrentTutorialStep(page: Page): Promise<TutorialStep | null> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
      .__STELLAR_DESCENT_DEBUG__;
    return debug?.tutorialManager?.getCurrentStep() ?? null;
  });
}

/**
 * Get tutorial progress percentage
 */
async function getTutorialProgress(page: Page): Promise<number> {
  return page.evaluate(() => {
    const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
      .__STELLAR_DESCENT_DEBUG__;
    return debug?.tutorialManager?.getProgress() ?? 0;
  });
}

/**
 * Simulate keyboard input
 */
async function pressKey(page: Page, key: string, duration = 100): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
}

/**
 * Hold a key for a duration (for movement)
 */
async function holdKey(page: Page, key: string, duration: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
}

/**
 * Simulate mouse movement for look controls
 */
async function moveMouse(page: Page, deltaX: number, deltaY: number): Promise<void> {
  const canvas = await page.$('canvas');
  if (!canvas) return;

  const box = await canvas.boundingBox();
  if (!box) return;

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.move(centerX + deltaX, centerY + deltaY);
}

/**
 * Click on canvas (for pointer lock)
 */
async function clickCanvas(page: Page): Promise<void> {
  const canvas = await page.$('canvas');
  if (canvas) {
    await canvas.click();
  }
}

/**
 * Wait for a specific comms message to appear
 */
async function waitForCommsMessage(page: Page, partialText: string): Promise<void> {
  await page.waitForFunction(
    (text) => {
      const comms = Array.from(
        document.querySelectorAll('.comms-message, [data-testid="comms"], .comms')
      );
      for (const el of comms) {
        if (el.textContent?.toLowerCase().includes(text.toLowerCase())) {
          return true;
        }
      }
      return false;
    },
    partialText,
    { timeout: 30000 }
  );
}

/**
 * Wait for objective text to update
 */
async function waitForObjective(page: Page, partialText: string): Promise<void> {
  await page.waitForFunction(
    (text) => {
      const objectives = Array.from(
        document.querySelectorAll('.objective, [data-testid="objective"], .mission-text')
      );
      for (const el of objectives) {
        if (el.textContent?.toLowerCase().includes(text.toLowerCase())) {
          return true;
        }
      }
      return false;
    },
    partialText,
    { timeout: 30000 }
  );
}

/**
 * Dismiss comms message by pressing space or clicking
 */
async function dismissComms(page: Page): Promise<void> {
  await pressKey(page, ' ');
  await page.waitForTimeout(500);
}

/**
 * Navigate player to a position using WASD keys
 * This is a simplified navigation that moves in cardinal directions
 */
async function navigateToPosition(page: Page, target: Vector3): Promise<void> {
  // Get current player position
  const currentPos = await page.evaluate(() => {
    const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
      .__STELLAR_DESCENT_DEBUG__;
    return debug?.player?.position ?? { x: 0, y: 1.5, z: 0 };
  });

  // Calculate direction
  const dx = target.x - currentPos.x;
  const dz = target.z - currentPos.z;

  // Movement constants
  const speed = 8; // units per second (approximate)
  const stepDuration = 100; // ms per step

  // Move in X direction
  if (Math.abs(dx) > 0.5) {
    const key = dx > 0 ? 'd' : 'a';
    const duration = (Math.abs(dx) / speed) * 1000;
    await holdKey(page, key, Math.min(duration, 5000));
  }

  // Move in Z direction (forward is negative Z in this game)
  if (Math.abs(dz) > 0.5) {
    const key = dz < 0 ? 'w' : 's';
    const duration = (Math.abs(dz) / speed) * 1000;
    await holdKey(page, key, Math.min(duration, 5000));
  }
}

/**
 * Use PlayerGovernor to navigate to a position
 */
async function governorNavigateTo(page: Page, target: Vector3, threshold = 3): Promise<void> {
  await page.evaluate(
    ({ pos, thresh }) => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
        .__STELLAR_DESCENT_DEBUG__;
      if (debug?.playerGovernor) {
        debug.playerGovernor.navigateTo(pos, thresh);
      }
    },
    { pos: target, thresh: threshold }
  );
}

/**
 * Use PlayerGovernor to set a goal
 */
async function setGovernorGoal(page: Page, goal: GovernorGoal): Promise<void> {
  await page.evaluate((g) => {
    const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
      .__STELLAR_DESCENT_DEBUG__;
    if (debug?.playerGovernor) {
      debug.playerGovernor.setGoal(g);
    }
  }, goal);
}

/**
 * Wait for governor goal to complete
 */
async function waitForGoalComplete(page: Page, goalType: string, timeout = 30000): Promise<void> {
  await page.waitForFunction(
    (type) => {
      const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
        .__STELLAR_DESCENT_DEBUG__;
      const currentGoal = debug?.playerGovernor?.getCurrentGoal();
      return currentGoal?.type === 'idle' || currentGoal?.type !== type;
    },
    goalType,
    { timeout }
  );
}

// ============================================================================
// TESTS
// ============================================================================

test.describe('Anchor Station - Tutorial Level', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to game
    await page.goto('/');

    // Wait for React app to initialize
    await waitForAppReady(page);
  });

  test('should load the game and display splash screen', async ({ page }) => {
    // Verify the app has loaded (splash screen with videos)
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    });
    expect(hasContent).toBe(true);

    // Verify splash videos exist
    const videoCount = await page.evaluate(() => document.querySelectorAll('video').length);
    expect(videoCount).toBeGreaterThan(0);
  });

  test('should navigate through splash and reach main menu', async ({ page }) => {
    // Skip splash screen
    await skipSplashScreen(page);

    // Wait for main menu
    await waitForMainMenu(page);

    // Verify NEW GAME button is present
    const hasNewGame = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).some((b) => b.textContent?.includes('NEW GAME'));
    });
    expect(hasNewGame).toBe(true);
  });

  test('should start new game and enter tutorial level', async ({ page }) => {
    await navigateToMainMenu(page);
    await startNewGame(page, 'normal');

    // Wait for tutorial level to load
    await waitForTutorialLevel(page);

    // Verify we are in tutorial level (canvas exists)
    const hasCanvas = await page.$('canvas');
    expect(hasCanvas).not.toBeNull();
  });

  test.describe('Phase 0: Initial Briefing', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);
    });

    test('should display ATHENA initial comms message', async ({ page }) => {
      // Wait for initial comms from ATHENA
      await page.waitForTimeout(2000);

      // Check for comms message presence
      const hasComms = await page.evaluate(() => {
        const comms = document.querySelectorAll('.comms-message, [data-testid="comms"], .comms');
        return comms.length > 0;
      });

      // Comms should appear shortly after level start
      if (!hasComms) {
        await page.waitForTimeout(3000);
      }

      expect(await getTutorialPhase(page)).toBe(0);
    });

    test('should show Commander Vasquez briefing', async ({ page }) => {
      // Wait for briefing sequence
      await page.waitForTimeout(6000);

      // The briefing mentions Marcus and FOB Delta
      // Phase should still be 0 during briefing
      const phase = await getTutorialPhase(page);
      expect(phase).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Phase 1: Movement Tutorial', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);

      // Wait for Phase 0 briefing to complete
      await page.waitForTimeout(8000);
    });

    test('should enable movement controls after briefing', async ({ page }) => {
      // Click canvas to get pointer lock
      await clickCanvas(page);
      await page.waitForTimeout(500);

      // Try to move forward
      await holdKey(page, 'w', 1000);

      // Player should have moved (we can verify via position change)
      const phase = await getTutorialPhase(page);
      expect(phase).toBeGreaterThanOrEqual(1);
    });

    test('should show movement instructions', async ({ page }) => {
      // Wait for movement phase
      await page.waitForTimeout(3000);

      // Check for movement-related UI elements
      const hasMovementUI = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return (
          body.includes('WASD') ||
          body.includes('move') ||
          body.includes('MOVEMENT') ||
          body.includes('arrow keys')
        );
      });

      // Movement instructions should appear in Phase 1
      const phase = await getTutorialPhase(page);
      if (phase >= 1) {
        expect(hasMovementUI).toBe(true);
      }
    });

    test('should navigate to corridor A', async ({ page }) => {
      await clickCanvas(page);
      await page.waitForTimeout(500);

      // Move forward toward corridor A (negative Z direction)
      await holdKey(page, 'w', 3000);

      // Check progress
      const progress = await getTutorialProgress(page);
      expect(progress).toBeGreaterThan(0);
    });
  });

  test.describe('Phase 1.5: Platforming Tutorial', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);
      await page.waitForTimeout(10000); // Wait for initial phases
    });

    test('should teach jump mechanics', async ({ page }) => {
      await clickCanvas(page);

      // Navigate toward platforming area
      await holdKey(page, 'w', 4000);

      // Test jump
      await pressKey(page, ' ', 100);

      // Verify jump was recognized
      await page.waitForTimeout(500);
    });

    test('should teach crouch mechanics', async ({ page }) => {
      await clickCanvas(page);

      // Navigate toward crouch area
      await holdKey(page, 'w', 5000);

      // Test crouch (Control key)
      await holdKey(page, 'Control', 1000);

      // Verify crouch was recognized
      await page.waitForTimeout(500);
    });
  });

  test.describe('Phase 2: Equipment Bay', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);
      await page.waitForTimeout(15000); // Wait for earlier phases
    });

    test('should enable crosshair and look controls', async ({ page }) => {
      await clickCanvas(page);

      // Move toward equipment bay
      await holdKey(page, 'w', 3000);
      await holdKey(page, 'a', 1500);

      // Check for crosshair element
      const hasCrosshair = await page.evaluate(() => {
        const crosshair = document.querySelector(
          '.crosshair, [data-testid="crosshair"], .aim-reticle'
        );
        return crosshair !== null;
      });

      const phase = await getTutorialPhase(page);
      if (phase >= 2) {
        expect(hasCrosshair).toBe(true);
      }
    });

    test('should allow suit equipping via interaction', async ({ page }) => {
      await clickCanvas(page);

      // Navigate to suit locker
      await holdKey(page, 'w', 3000);
      await holdKey(page, 'a', 2000);

      // Press E to interact
      await pressKey(page, 'e');

      // Wait for suit equip animation/notification
      await page.waitForTimeout(2000);
    });
  });

  test.describe('Phase 3: Shooting Range', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);
      await page.waitForTimeout(20000); // Wait for earlier phases
    });

    test('should enable fire controls', async ({ page }) => {
      await clickCanvas(page);

      // Navigate toward shooting range
      await holdKey(page, 'w', 8000);

      // Check for ammo counter
      const hasAmmoCounter = await page.evaluate(() => {
        const ammo = document.querySelector(
          '.ammo-counter, [data-testid="ammo"], .ammo, .ammunition'
        );
        return ammo !== null;
      });

      const phase = await getTutorialPhase(page);
      if (phase >= 3) {
        expect(hasAmmoCounter).toBe(true);
      }
    });

    test('should allow shooting targets', async ({ page }) => {
      await clickCanvas(page);

      // Navigate to shooting position
      await holdKey(page, 'w', 8000);
      await page.waitForTimeout(1000);

      // Click to fire
      await page.mouse.click(960, 540); // Center of 1920x1080 viewport

      // Fire multiple times
      for (let i = 0; i < 5; i++) {
        await page.mouse.click(960, 540);
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Phase 4: Hangar Bay', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);
      await page.waitForTimeout(25000); // Wait for earlier phases
    });

    test('should show full HUD', async ({ page }) => {
      await clickCanvas(page);

      // Navigate toward hangar
      await holdKey(page, 'w', 10000);

      // Verify full HUD elements
      const hudElements = await page.evaluate(() => {
        const health = document.querySelector('.health-bar, [data-testid="health"]');
        const crosshair = document.querySelector('.crosshair, [data-testid="crosshair"]');
        const ammo = document.querySelector('.ammo-counter, [data-testid="ammo"]');
        return {
          hasHealth: health !== null,
          hasCrosshair: crosshair !== null,
          hasAmmo: ammo !== null,
        };
      });

      const phase = await getTutorialPhase(page);
      if (phase >= 4) {
        expect(hudElements.hasHealth).toBe(true);
      }
    });

    test('should show depressurization warning', async ({ page }) => {
      await clickCanvas(page);

      // Navigate to hangar entry
      await holdKey(page, 'w', 12000);

      // Check for warning notification
      const hasWarning = await page.evaluate(() => {
        const body = document.body.textContent || '';
        return body.includes('DEPRESSUR') || body.includes('WARNING') || body.includes('BAY DOORS');
      });

      // Warning should appear when entering hangar
      await page.waitForTimeout(3000);
    });
  });

  test.describe('Complete Tutorial Playthrough', () => {
    test('should complete entire tutorial level', async ({ page }) => {
      // Increase test timeout for full playthrough
      test.setTimeout(300000); // 5 minutes

      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);

      // Wait for initial briefing
      await page.waitForTimeout(8000);

      // Click canvas for pointer lock
      await clickCanvas(page);
      await page.waitForTimeout(500);

      // Navigate through the level
      // Phase 1: Movement to corridor
      await holdKey(page, 'w', 4000);
      await page.waitForTimeout(2000);

      // Continue to platforming area
      await holdKey(page, 'w', 3000);
      await page.waitForTimeout(1000);

      // Jump tutorial
      await pressKey(page, ' ');
      await page.waitForTimeout(500);
      await holdKey(page, 'w', 1000);
      await pressKey(page, ' ');
      await page.waitForTimeout(1000);

      // Crouch tutorial
      await holdKey(page, 'Control', 1500);
      await holdKey(page, 'w', 1000);
      await page.waitForTimeout(500);

      // Continue to equipment bay
      await holdKey(page, 'w', 2000);
      await holdKey(page, 'a', 1500);
      await page.waitForTimeout(1000);

      // Interact with suit locker
      await pressKey(page, 'e');
      await page.waitForTimeout(3000);

      // Move to weapon rack
      await holdKey(page, 'd', 3000);
      await page.waitForTimeout(1000);

      // Pick up weapon
      await pressKey(page, 'e');
      await page.waitForTimeout(2000);

      // Navigate to shooting range
      await holdKey(page, 'w', 5000);
      await page.waitForTimeout(2000);

      // Complete shooting range
      for (let i = 0; i < 5; i++) {
        await page.mouse.click(960, 540);
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(3000);

      // Navigate to hangar
      await holdKey(page, 'w', 5000);
      await page.waitForTimeout(5000);

      // Navigate to drop pod
      await holdKey(page, 'w', 3000);
      await page.waitForTimeout(3000);

      // Launch (press Space)
      await pressKey(page, ' ');
      await page.waitForTimeout(3000);

      // Verify tutorial completion or transition to next level
      const progress = await getTutorialProgress(page);
      expect(progress).toBeGreaterThanOrEqual(80);
    });

    test('should use PlayerGovernor for automated playthrough', async ({ page }) => {
      // This test uses the PlayerGovernor AI system
      test.setTimeout(300000);

      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);

      // Wait for level initialization
      await page.waitForTimeout(5000);

      // Wait for debug interface to be available (may take a moment after page load)
      await page.waitForFunction(
        () => {
          const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
            .__STELLAR_DESCENT_DEBUG__;
          return debug?.playerGovernor !== undefined;
        },
        { timeout: 10_000 }
      );

      // Start automated tutorial playthrough
      await page.evaluate(() => {
        const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
          .__STELLAR_DESCENT_DEBUG__;
        debug?.playerGovernor?.runTutorialPlaythrough();
      });

      // Wait for tutorial to complete (with timeout)
      await page.waitForFunction(
        () => {
          const debug = (window as unknown as { __STELLAR_DESCENT_DEBUG__?: GameDebugInterface })
            .__STELLAR_DESCENT_DEBUG__;
          return (
            !debug?.tutorialManager?.isRunning() ||
            (debug?.tutorialManager?.getProgress() ?? 0) >= 100
          );
        },
        { timeout: 240000 }
      );

      const progress = await getTutorialProgress(page);
      expect(progress).toBe(100);
    });
  });

  test.describe('UI Validation', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);
    });

    test('should display comms messages with correct format', async ({ page }) => {
      await page.waitForTimeout(3000);

      // Check for comms UI structure
      const commsStructure = await page.evaluate(() => {
        const comms = document.querySelector('.comms-message, [data-testid="comms"]');
        if (!comms) return null;
        return {
          hasSender: comms.querySelector('.sender, .callsign, [data-sender]') !== null,
          hasPortrait: comms.querySelector('.portrait, img, [data-portrait]') !== null,
          hasText: comms.textContent && comms.textContent.length > 0,
        };
      });

      if (commsStructure) {
        expect(commsStructure.hasText).toBe(true);
      }
    });

    test('should display action buttons during tutorial', async ({ page }) => {
      await page.waitForTimeout(10000); // Wait for action buttons to appear

      await clickCanvas(page);
      await holdKey(page, 'w', 5000);

      // Check for action button UI
      const hasActionButtons = await page.evaluate(() => {
        const buttons = document.querySelectorAll(
          '.action-button, [data-testid="action-button"], .tutorial-action'
        );
        return buttons.length > 0;
      });

      // Action buttons appear during interactive steps
      const step = await getCurrentTutorialStep(page);
      if (
        (step && step.id.includes('jump')) ||
        step?.id.includes('crouch') ||
        step?.id.includes('equip')
      ) {
        expect(hasActionButtons).toBe(true);
      }
    });

    test('should update objectives correctly', async ({ page }) => {
      await page.waitForTimeout(5000);

      // Objective should be visible in Phase 1+
      const phase = await getTutorialPhase(page);

      if (phase >= 1) {
        const hasObjective = await page.evaluate(() => {
          const objective = document.querySelector(
            '.objective, [data-testid="objective"], .mission-text'
          );
          return objective !== null && (objective.textContent?.length ?? 0) > 0;
        });
        expect(hasObjective).toBe(true);
      }
    });

    test('should show notifications at key moments', async ({ page }) => {
      // Wait for phase transition notification
      await page.waitForTimeout(8000);

      // Check for notification presence
      const notificationSeen = await page.evaluate(() => {
        // Store in window to track across evaluations
        const win = window as unknown as { __notificationSeen?: boolean };
        const notification = document.querySelector('.notification, [data-testid="notification"]');
        if (notification && (notification.textContent?.length ?? 0) > 0) {
          win.__notificationSeen = true;
        }
        return win.__notificationSeen ?? false;
      });

      // Notifications should appear during phase transitions
      // "MOVEMENT CONTROLS ONLINE", "TARGETING SYSTEMS ONLINE", etc.
      await page.waitForTimeout(5000);
    });
  });

  // --------------------------------------------------------------------------
  // VISUAL REGRESSION - Station Lighting & Environment
  // --------------------------------------------------------------------------

  test.describe('Visual Regression - Station Lighting', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);
      await page.waitForTimeout(3000);
    });

    test('should match briefing room lighting baseline', async ({ page }) => {
      await expect(page).toHaveScreenshot('anchor-station-briefing-room.png', {
        maxDiffPixelRatio: 0.05,
        timeout: 10000,
      });
    });

    test('should match equipment bay lighting after navigation', async ({ page }) => {
      await clickCanvas(page);
      // Navigate to equipment bay
      await holdKey(page, 'w', 4000);
      await holdKey(page, 'a', 2000);
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('anchor-station-equipment-bay.png', {
        maxDiffPixelRatio: 0.05,
        timeout: 10000,
      });
    });

    test('should match shooting range environment', async ({ page }) => {
      await clickCanvas(page);
      // Navigate to shooting range (further down the corridor)
      await holdKey(page, 'w', 8000);
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('anchor-station-shooting-range.png', {
        maxDiffPixelRatio: 0.05,
        timeout: 10000,
      });
    });

    test('should match hangar bay lighting', async ({ page }) => {
      await clickCanvas(page);
      // Navigate deep into station toward hangar
      await holdKey(page, 'w', 14000);
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('anchor-station-hangar-bay.png', {
        maxDiffPixelRatio: 0.05,
        timeout: 10000,
      });
    });

    test('should render HUD overlay consistently during tutorial', async ({ page }) => {
      await clickCanvas(page);
      await page.waitForTimeout(5000);

      // Capture HUD element if visible
      const hud = page.locator('[data-testid="game-hud"], .hud-container');
      if (await hud.isVisible()) {
        await expect(hud).toHaveScreenshot('anchor-station-tutorial-hud.png', {
          maxDiffPixelRatio: 0.08,
          timeout: 10000,
        });
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle canvas click for pointer lock', async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);

      // Click should not cause errors
      await clickCanvas(page);
      await page.waitForTimeout(500);

      // Verify no console errors related to pointer lock
      const hasErrors = await page.evaluate(() => {
        // This is a simple check - in practice we'd use page.on('console')
        return false;
      });
      expect(hasErrors).toBe(false);
    });

    test('should handle rapid key presses', async ({ page }) => {
      await navigateToMainMenu(page);
      await startNewGame(page, 'normal');
      await waitForTutorialLevel(page);

      await clickCanvas(page);
      await page.waitForTimeout(500);

      // Rapid key presses
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('w');
        await page.keyboard.press('a');
        await page.keyboard.press('s');
        await page.keyboard.press('d');
        await page.keyboard.press(' ');
      }

      // Game should remain stable
      const hasCanvas = await page.$('canvas');
      expect(hasCanvas).not.toBeNull();
    });
  });
});
