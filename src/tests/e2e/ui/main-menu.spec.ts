/**
 * Main Menu Navigation - Open and close each modal
 *
 * Port of .maestro/flows/02-main-menu.yaml
 * Tests that Help, Settings, Achievements, and Leaderboards modals
 * can be opened and closed, returning to the main menu each time.
 */

import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test.describe('Main Menu Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for main menu to fully load
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 30_000 });
  });

  test('Help modal opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'HELP' }).click();

    // Help modal shows "OPERATIONS MANUAL" header
    await expect(page.getByText('OPERATIONS MANUAL')).toBeVisible({ timeout: 5_000 });

    // Close via footer CLOSE button (exact: true avoids matching header ✕ whose aria-label contains "close")
    await page.getByRole('button', { name: 'CLOSE', exact: true }).click();

    // Back at main menu
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 5_000 });
  });

  test('Settings modal opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'SETTINGS' }).click();

    // Assert 4 universal tabs visible (Controls tab hidden on touch devices)
    await expect(page.getByRole('tab', { name: 'Gameplay' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: 'Audio' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Graphics' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Accessibility' })).toBeVisible();

    // Controls tab visibility depends on pointer type: visible when pointer:fine (desktop), hidden otherwise
    const controlsTab = page.getByRole('tab', { name: 'Controls' });
    const hasFinePointer = await page.evaluate(() => window.matchMedia('(pointer: fine)').matches);
    if (hasFinePointer) {
      await expect(controlsTab).toBeVisible();
    } else {
      await expect(controlsTab).not.toBeVisible();
    }

    // Close via header X button (has aria-label="Close settings")
    await page.getByRole('button', { name: 'Close settings' }).click();

    // Back at main menu
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 5_000 });
  });

  test('Achievements modal opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'ACHIEVEMENTS' }).click();

    // Achievements panel visible (heading is title-case "Achievements"; getByRole avoids matching the menu button)
    await expect(page.getByRole('heading', { name: 'Achievements' })).toBeVisible({
      timeout: 5_000,
    });

    // Close
    await page.getByRole('button', { name: /close/i }).click();

    // Back at main menu
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 5_000 });
  });

  test('Leaderboards modal opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'LEADERBOARDS' }).click();

    // Leaderboards panel visible (getByRole heading avoids matching the menu button behind the modal)
    await expect(page.getByRole('heading', { name: 'LEADERBOARDS' })).toBeVisible({
      timeout: 5_000,
    });

    // Close (header ✕ button has aria-label="Close leaderboard")
    await page.getByRole('button', { name: 'Close leaderboard' }).click();

    // Back at main menu
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 5_000 });
  });
});
