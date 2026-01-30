import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

    // Wait for canvas to be ready
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    });

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
    await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, '02-loading-screen.png'),
      fullPage: true,
    });

    // Wait for loading to progress
    await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible();
  });

  test('capture tutorial start - AI greeting', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for tutorial to start
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });

    await page.screenshot({
      path: path.join(screenshotsDir, '03-tutorial-ai-greeting.png'),
      fullPage: true,
    });
  });

  test('capture tutorial - station info', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for tutorial to start
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });

    // Advance comms
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Wait for next message (Marcus's team went dark or movement controls)
    await expect(page.getByText(/brother's team|FOB Delta|Movement controls/i)).toBeVisible({
      timeout: 15000,
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
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });

    // Advance through initial comms
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(1500);
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
    await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 30000 });

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
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotsDir, 'playthrough-01-menu.png'),
      fullPage: true,
    });

    // Start game
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Screenshot 2: Loading
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(screenshotsDir, 'playthrough-02-loading.png'),
      fullPage: true,
    });

    // Wait for tutorial
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });

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
      await page.waitForTimeout(1000);

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
        // May have completed or transitioned
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('Responsive Screenshots', () => {
  test('capture mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotsDir, 'responsive-mobile.png'),
      fullPage: true,
    });

    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
  });

  test('capture tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotsDir, 'responsive-tablet.png'),
      fullPage: true,
    });
  });

  test('capture desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotsDir, 'responsive-desktop.png'),
      fullPage: true,
    });
  });
});
