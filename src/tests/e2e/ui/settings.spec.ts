/**
 * Settings Menu - Tab visibility and close
 *
 * Port of .maestro/flows/settings-menu.yaml
 * Tests that settings tabs are visible and the modal closes correctly.
 */

import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test.describe('Settings Menu', () => {
  test('shows tabs and closes via X button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'SETTINGS' })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'SETTINGS' }).click();

    // Assert 4 universal tabs (Controls tab hidden on touch/mobile)
    await expect(page.getByRole('tab', { name: 'Gameplay' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: 'Audio' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Graphics' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Accessibility' })).toBeVisible();

    // Controls tab visibility depends on pointer type (matches SettingsMenu's matchMedia check)
    const controlsTab = page.getByRole('tab', { name: 'Controls' });
    const hasFinePointer = await page.evaluate(() => window.matchMedia('(pointer: fine)').matches);
    if (hasFinePointer) {
      await expect(controlsTab).toBeVisible();
    } else {
      await expect(controlsTab).not.toBeVisible();
    }

    // Close via X button (has aria-label="Close settings")
    await page.getByRole('button', { name: 'Close settings' }).click();

    // Back at main menu
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 5_000 });
  });
});
