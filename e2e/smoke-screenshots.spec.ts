import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as fs from 'node:fs';

const screenshotsDir = path.join(__dirname, 'screenshots');

// Helper to take screenshot with consistent naming
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(screenshotsDir, `${name}.png`),
    fullPage: true,
  });
}

test.describe('Smoke Tests with Screenshots', () => {
  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('01 - Main Menu renders correctly', async ({ page }) => {
    await page.goto('/');

    // Wait for canvas and menu to load
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible({
      timeout: 10000,
    });

    await page.waitForTimeout(500); // Let WebGL render
    await takeScreenshot(page, 'smoke-01-main-menu');

    // Verify all menu buttons exist
    await expect(page.getByRole('button', { name: /HALO DROP/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /CONTROLS/i })).toBeVisible();
  });

  test('02 - Controls modal opens and closes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /CONTROLS/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /CONTROLS/i }).click();

    await expect(page.getByText(/OPERATIONS MANUAL/i)).toBeVisible();
    await takeScreenshot(page, 'smoke-02-controls-modal');

    await page.getByRole('button', { name: /CLOSE/i }).click();
    await expect(page.getByText(/OPERATIONS MANUAL/i)).not.toBeVisible();
  });

  test('03 - Loading screen appears on New Campaign', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Should see loading screen
    await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible({ timeout: 5000 });
    await takeScreenshot(page, 'smoke-03-loading-screen');
  });

  test('04 - Tutorial comms appear after loading', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for tutorial to start (first comms message)
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });
    await takeScreenshot(page, 'smoke-04-tutorial-comms');

    // Verify comms UI structure
    await expect(page.getByText(/ATHENA/i)).toBeVisible();
  });

  test('05 - Can advance through comms', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for first comms
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });

    // Advance comms
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);

    // Should have advanced
    await takeScreenshot(page, 'smoke-05-comms-advanced');
  });

  test('06 - HALO Drop skips tutorial', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /HALO DROP/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /HALO DROP/i }).click();

    // Should see loading, then drop notification
    await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1000);

    await takeScreenshot(page, 'smoke-06-halo-drop');

    // Should see drop notification or HUD
    await expect(page.getByText(/ORBITAL DROP INITIATED|DROP ZONE/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('07 - Canvas has proper dimensions', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    await takeScreenshot(page, 'smoke-07-canvas');
  });
});

test.describe('Responsive Screenshots', () => {
  test('mobile viewport (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible({
      timeout: 10000,
    });

    await takeScreenshot(page, 'responsive-mobile-375x667');
  });

  test('tablet viewport (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible({
      timeout: 10000,
    });

    await takeScreenshot(page, 'responsive-tablet-768x1024');
  });

  test('desktop viewport (1920x1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible({
      timeout: 10000,
    });

    await takeScreenshot(page, 'responsive-desktop-1920x1080');
  });
});
