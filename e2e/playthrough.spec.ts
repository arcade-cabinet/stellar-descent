import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'screenshots');

test.describe('Game Playthrough Screenshots', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('capture main menu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible(); // Wait for canvas

    await page.screenshot({
      path: path.join(screenshotsDir, '01-main-menu.png'),
      fullPage: true,
    });

    // Verify menu is visible
    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
  });

  test('capture loading screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Capture loading screen
    await expect(page.getByText(/INITIALIZING/i)).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, '02-loading-screen.png'),
      fullPage: true,
    });

    // Wait for loading to progress
    await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible();
  });

  test('capture tutorial start - AI greeting', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for tutorial to start
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 20000 });

    await page.screenshot({
      path: path.join(screenshotsDir, '03-tutorial-ai-greeting.png'),
      fullPage: true,
    });
  });

  test('capture tutorial - station info', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for tutorial to start
    const firstMessage = page.getByText(/Good morning, Sergeant Cole/i);
    await expect(firstMessage).toBeVisible({ timeout: 20000 });

    // Advance comms
    await page.keyboard.press('Space');
    await expect(firstMessage).not.toBeVisible();

    // Wait for next message
    await expect(page.getByText(/ANCHOR STATION PROMETHEUS|equipment station/i)).toBeVisible({
      timeout: 5000,
    });

    await page.screenshot({
      path: path.join(screenshotsDir, '04-tutorial-station-info.png'),
      fullPage: true,
    });
  });

  test('capture tutorial - movement objective', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for tutorial to start
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 20000 });

    // Advance through initial comms
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Space');
      // Wait for comms to update (simple wait here as we don't know exact text sequence)
      await page.waitForFunction(
        () => (document.querySelector('[class*="messageText"]')?.textContent?.length || 0) > 0
      );
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '05-tutorial-movement.png'),
      fullPage: true,
    });
  });

  test('capture HALO drop mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /HALO DROP/i }).click();

    // Wait for loading
    await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 20000 });

    // Wait for drop notification
    await expect(page.getByText(/ORBITAL DROP INITIATED/i)).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: path.join(screenshotsDir, '06-halo-drop.png'),
      fullPage: true,
    });
  });

  test('capture controls modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /CONTROLS/i }).click();

    await expect(page.getByText(/OPERATIONS MANUAL/i)).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, '07-controls-modal.png'),
      fullPage: true,
    });
  });
});

test.describe('Game Playthrough - Full Tutorial', () => {
  test('play through tutorial with screenshots', async ({ page }) => {
    await page.goto('/');

    // Screenshot 1: Main menu
    await expect(page.locator('canvas')).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, 'playthrough-01-menu.png'),
      fullPage: true,
    });

    // Start game
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Screenshot 2: Loading
    await expect(page.getByText(/INITIALIZING/i)).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, 'playthrough-02-loading.png'),
      fullPage: true,
    });

    // Wait for tutorial
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 20000 });

    // Screenshot 3: First comms
    await page.screenshot({
      path: path.join(screenshotsDir, 'playthrough-03-comms-greeting.png'),
      fullPage: true,
    });

    // Progress through comms by pressing space
    let screenshotIndex = 4;
    const maxScreenshots = 15;

    while (screenshotIndex <= maxScreenshots) {
      await page.keyboard.press('Space');

      // Wait for text to change or type out
      try {
        await page.waitForFunction(
          () => {
            const el = document.querySelector('[class*="messageText"]');
            return (el?.textContent?.length || 0) > 5;
          },
          { timeout: 2000 }
        );
      } catch {
        // Ignore timeout if text didn't change (might be end of sequence)
      }

      await page.screenshot({
        path: path.join(
          screenshotsDir,
          `playthrough-${String(screenshotIndex).padStart(2, '0')}-step.png`
        ),
        fullPage: true,
      });

      screenshotIndex++;

      // Check if we've exited comms/tutorial
      const hasComms = await page
        .locator('[class*="commsPanel"], [class*="CommsDisplay"]')
        .isVisible()
        .catch(() => false);
      const hasObjective = await page
        .locator('.objective-display')
        .isVisible()
        .catch(() => false);

      if (!hasComms && !hasObjective) {
        // Wait for canvas/gameplay to stabilize
        await page.locator('canvas').evaluate((_canvas) => {
          return new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
        });
      }
    }
  });
});

test.describe('Responsive Screenshots', () => {
  test('capture mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, 'responsive-mobile.png'),
      fullPage: true,
    });

    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
  });

  test('capture tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, 'responsive-tablet.png'),
      fullPage: true,
    });
  });

  test('capture desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible();

    await page.screenshot({
      path: path.join(screenshotsDir, 'responsive-desktop.png'),
      fullPage: true,
    });
  });
});
