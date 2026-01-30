/**
 * PlayerGovernor - Simulates player actions for E2E testing
 *
 * Provides high-level commands that mirror player behavior:
 * - Movement (WASD/arrows)
 * - Looking (mouse movement)
 * - Shooting (click)
 * - Interaction (E key)
 * - Action buttons (number keys)
 *
 * Each level test uses an isolated PlayerGovernor instance.
 */

import type { Page } from '@playwright/test';

export interface PlayerGovernorOptions {
  /** Movement speed multiplier */
  moveSpeed?: number;
  /** Look sensitivity */
  lookSensitivity?: number;
  /** Screenshot output directory */
  screenshotDir?: string;
}

export interface MoveDirection {
  forward?: boolean;
  backward?: boolean;
  left?: boolean;
  right?: boolean;
}

export class PlayerGovernor {
  private page: Page;
  private options: Required<PlayerGovernorOptions>;
  private screenshotIndex = 0;
  private levelName: string;

  constructor(page: Page, levelName: string, options: PlayerGovernorOptions = {}) {
    this.page = page;
    this.levelName = levelName;
    this.options = {
      moveSpeed: options.moveSpeed ?? 1,
      lookSensitivity: options.lookSensitivity ?? 1,
      screenshotDir: options.screenshotDir ?? 'e2e/screenshots',
    };
  }

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  /**
   * Navigate to a specific level using URL parameter
   */
  async goToLevel(levelId: string): Promise<void> {
    await this.page.goto(`/?level=${levelId}`);
    await this.waitForLevelLoad();
  }

  /**
   * Wait for the level to fully load
   */
  async waitForLevelLoad(timeout = 30000): Promise<void> {
    // Wait for canvas to be ready
    await this.page.waitForSelector('canvas', { timeout });
    await this.page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        return canvas && canvas.width > 0 && canvas.height > 0;
      },
      { timeout }
    );

    // Wait for loading to complete (loading modal disappears)
    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector('[class*="LoadingModal"]');
        return !loading || getComputedStyle(loading).display === 'none';
      },
      { timeout }
    );

    // Small buffer for scene initialization
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for a specific text to appear (useful for objective/comms)
   */
  async waitForText(text: string | RegExp, timeout = 10000): Promise<void> {
    await this.page.getByText(text).waitFor({ state: 'visible', timeout });
  }

  // ==========================================================================
  // MOVEMENT
  // ==========================================================================

  /**
   * Move in a direction for a duration
   */
  async move(direction: MoveDirection, durationMs: number): Promise<void> {
    const keys: string[] = [];

    if (direction.forward) keys.push('KeyW');
    if (direction.backward) keys.push('KeyS');
    if (direction.left) keys.push('KeyA');
    if (direction.right) keys.push('KeyD');

    // Press all keys
    for (const key of keys) {
      await this.page.keyboard.down(key);
    }

    await this.page.waitForTimeout(durationMs);

    // Release all keys
    for (const key of keys) {
      await this.page.keyboard.up(key);
    }
  }

  /**
   * Move forward for a duration
   */
  async moveForward(durationMs: number): Promise<void> {
    await this.move({ forward: true }, durationMs);
  }

  /**
   * Move backward for a duration
   */
  async moveBackward(durationMs: number): Promise<void> {
    await this.move({ backward: true }, durationMs);
  }

  /**
   * Strafe left for a duration
   */
  async strafeLeft(durationMs: number): Promise<void> {
    await this.move({ left: true }, durationMs);
  }

  /**
   * Strafe right for a duration
   */
  async strafeRight(durationMs: number): Promise<void> {
    await this.move({ right: true }, durationMs);
  }

  /**
   * Sprint forward (hold shift + W)
   */
  async sprint(durationMs: number): Promise<void> {
    await this.page.keyboard.down('ShiftLeft');
    await this.moveForward(durationMs);
    await this.page.keyboard.up('ShiftLeft');
  }

  // ==========================================================================
  // LOOKING / AIMING
  // ==========================================================================

  /**
   * Look in a direction by simulating mouse movement
   */
  async look(deltaX: number, deltaY: number): Promise<void> {
    const canvas = this.page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Move to center then drag
    await this.page.mouse.move(centerX, centerY);
    await this.page.mouse.down();
    await this.page.mouse.move(
      centerX + deltaX * this.options.lookSensitivity,
      centerY + deltaY * this.options.lookSensitivity
    );
    await this.page.mouse.up();
  }

  /**
   * Look left
   */
  async lookLeft(amount = 100): Promise<void> {
    await this.look(-amount, 0);
  }

  /**
   * Look right
   */
  async lookRight(amount = 100): Promise<void> {
    await this.look(amount, 0);
  }

  /**
   * Look up
   */
  async lookUp(amount = 50): Promise<void> {
    await this.look(0, -amount);
  }

  /**
   * Look down
   */
  async lookDown(amount = 50): Promise<void> {
    await this.look(0, amount);
  }

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  /**
   * Fire weapon (left click)
   */
  async fire(): Promise<void> {
    await this.page.mouse.click((await this.getCanvasCenter()).x, (await this.getCanvasCenter()).y);
  }

  /**
   * Fire weapon multiple times
   */
  async fireMultiple(count: number, intervalMs = 200): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.fire();
      if (i < count - 1) {
        await this.page.waitForTimeout(intervalMs);
      }
    }
  }

  /**
   * Interact (E key)
   */
  async interact(): Promise<void> {
    await this.page.keyboard.press('KeyE');
  }

  /**
   * Throw grenade (G key)
   */
  async throwGrenade(): Promise<void> {
    await this.page.keyboard.press('KeyG');
  }

  /**
   * Melee attack (V key)
   */
  async melee(): Promise<void> {
    await this.page.keyboard.press('KeyV');
  }

  /**
   * Toggle flashlight (F key)
   */
  async toggleFlashlight(): Promise<void> {
    await this.page.keyboard.press('KeyF');
  }

  /**
   * Use scanner (T key)
   */
  async useScanner(): Promise<void> {
    await this.page.keyboard.press('KeyT');
  }

  /**
   * Call fire support (C key - for Marcus)
   */
  async callFireSupport(): Promise<void> {
    await this.page.keyboard.press('KeyC');
  }

  /**
   * Press a specific key
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * Press space (dismiss comms, jump, etc.)
   */
  async pressSpace(): Promise<void> {
    await this.page.keyboard.press('Space');
  }

  // ==========================================================================
  // COMMS / UI INTERACTION
  // ==========================================================================

  /**
   * Dismiss current comms message
   */
  async dismissComms(): Promise<void> {
    await this.pressSpace();
    await this.page.waitForTimeout(300);
  }

  /**
   * Advance through all comms until none visible
   */
  async advanceThroughAllComms(maxMessages = 20): Promise<void> {
    for (let i = 0; i < maxMessages; i++) {
      const hasComms = await this.page
        .locator('[class*="CommsDisplay"], [class*="commsPanel"]')
        .isVisible()
        .catch(() => false);

      if (!hasComms) break;

      await this.dismissComms();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Click a button by text
   */
  async clickButton(text: string | RegExp): Promise<void> {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Check if a button is visible
   */
  async isButtonVisible(text: string | RegExp): Promise<boolean> {
    return await this.page
      .getByRole('button', { name: text })
      .isVisible()
      .catch(() => false);
  }

  // ==========================================================================
  // SCREENSHOTS
  // ==========================================================================

  /**
   * Take a screenshot with auto-incrementing name
   */
  async screenshot(label?: string): Promise<void> {
    this.screenshotIndex++;
    const name = label
      ? `${this.levelName}-${String(this.screenshotIndex).padStart(2, '0')}-${label}`
      : `${this.levelName}-${String(this.screenshotIndex).padStart(2, '0')}`;

    await this.page.screenshot({
      path: `${this.options.screenshotDir}/${name}.png`,
      fullPage: true,
    });
  }

  // ==========================================================================
  // ASSERTIONS
  // ==========================================================================

  /**
   * Check if text is visible on screen
   */
  async hasText(text: string | RegExp): Promise<boolean> {
    return await this.page
      .getByText(text)
      .isVisible()
      .catch(() => false);
  }

  /**
   * Get current objective text
   */
  async getObjectiveText(): Promise<string | null> {
    const objective = this.page.locator('.objective-title, .objectiveTitle');
    if (await objective.isVisible()) {
      return await objective.textContent();
    }
    return null;
  }

  /**
   * Get player health (if visible in HUD)
   */
  async getHealthText(): Promise<string | null> {
    const health = this.page.locator('[class*="health"], [class*="Health"]');
    if (await health.first().isVisible()) {
      return await health.first().textContent();
    }
    return null;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async getCanvasCenter(): Promise<{ x: number; y: number }> {
    const canvas = this.page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) {
      return { x: 400, y: 300 };
    }
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  }

  /**
   * Wait for specified duration
   */
  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Lock pointer (click on canvas to request pointer lock)
   */
  async lockPointer(): Promise<void> {
    const canvas = this.page.locator('canvas');
    await canvas.click();
    await this.page.waitForTimeout(100);
  }

  /**
   * Get the underlying page for custom assertions
   */
  getPage(): Page {
    return this.page;
  }

  // ==========================================================================
  // LEVEL TRANSITION UTILITIES
  // ==========================================================================

  /**
   * Verify level has loaded with basic HUD elements visible
   */
  async verifyLevelLoaded(): Promise<boolean> {
    const canvas = await this.page.locator('canvas').isVisible();
    const hasCanvas = canvas === true;

    // Check for any HUD element
    const hasHUD = await this.page
      .locator('[class*="HUD"], [class*="hud"], [class*="objective"]')
      .first()
      .isVisible()
      .catch(() => false);

    return hasCanvas && hasHUD;
  }

  /**
   * Wait for level transition to complete (loading screen disappears, new level loads)
   */
  async waitForLevelTransition(timeout = 45000): Promise<void> {
    // Wait for loading indicator to appear then disappear
    await this.page
      .waitForFunction(
        () => {
          const loading = document.querySelector('[class*="LoadingModal"], [class*="loading"]');
          return loading && getComputedStyle(loading).display !== 'none';
        },
        { timeout: 10000 }
      )
      .catch(() => {
        // Loading may be too fast to catch
      });

    await this.page.waitForFunction(
      () => {
        const loading = document.querySelector('[class*="LoadingModal"], [class*="loading"]');
        return !loading || getComputedStyle(loading).display === 'none';
      },
      { timeout }
    );

    // Wait for new scene to stabilize
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if current URL indicates a specific level
   */
  async isAtLevel(levelId: string): Promise<boolean> {
    const url = this.page.url();
    return url.includes(`level=${levelId}`);
  }

  /**
   * Wait for an objective update (text appears in objective display)
   */
  async waitForObjective(text: string | RegExp, timeout = 15000): Promise<void> {
    await this.page
      .locator('[class*="objective"], [class*="Objective"]')
      .filter({ hasText: text })
      .waitFor({ state: 'visible', timeout });
  }

  /**
   * Check if level is in a specific phase (for multi-phase levels)
   */
  async hasPhaseIndicator(phaseText: string | RegExp): Promise<boolean> {
    return await this.page
      .getByText(phaseText)
      .isVisible()
      .catch(() => false);
  }

  // ==========================================================================
  // LEVEL-SPECIFIC ACTIONS
  // ==========================================================================

  /**
   * Ignite jets during HALO drop (Landfall level)
   */
  async igniteJets(): Promise<void> {
    // Try clicking the button first, fall back to key press
    const hasButton = await this.isButtonVisible(/IGNITE/i);
    if (hasButton) {
      await this.clickButton(/IGNITE/i);
    } else {
      await this.pressSpace();
    }
    await this.wait(500);
  }

  /**
   * Use boost during powered descent (Landfall level)
   */
  async boost(durationMs: number): Promise<void> {
    await this.page.keyboard.down('Space');
    await this.page.waitForTimeout(durationMs);
    await this.page.keyboard.up('Space');
  }

  /**
   * Enter The Breach (transition from Brothers in Arms)
   */
  async enterBreach(): Promise<void> {
    const hasButton = await this.isButtonVisible(/ENTER|DESCEND|BREACH/i);
    if (hasButton) {
      await this.clickButton(/ENTER|DESCEND|BREACH/i);
    } else {
      await this.interact();
    }
    await this.wait(500);
  }

  /**
   * Deploy signal flare (Extraction level)
   */
  async deployFlare(): Promise<void> {
    const hasButton = await this.isButtonVisible(/FLARE|SIGNAL/i);
    if (hasButton) {
      await this.clickButton(/FLARE|SIGNAL/i);
    } else {
      await this.pressKey('KeyF');
    }
    await this.wait(500);
  }

  /**
   * Scan for weakness (The Breach level - Queen fight)
   */
  async scanWeakness(): Promise<void> {
    const hasButton = await this.isButtonVisible(/SCAN/i);
    if (hasButton) {
      await this.clickButton(/SCAN/i);
    } else {
      await this.useScanner();
    }
    await this.wait(500);
  }
}
