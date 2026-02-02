/**
 * Smoke Test - App loads and main menu renders
 *
 * Port of .maestro/flows/01-smoke.yaml
 * Verifies the app boots past the splash screen and all main menu buttons appear.
 */

import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test.describe('Smoke', () => {
  test('app loads and shows all main menu buttons', async ({ page }) => {
    await page.goto('/');

    // Wait for splash to auto-dismiss and main menu to be interactive (up to 30s)
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 30_000 });

    // Assert all 8 main menu buttons are visible
    // NOTE: CONTINUE is always rendered but disabled when no save exists.
    // NG+ button is conditionally rendered (ngPlusUnlocked) and not counted here.
    const buttons = [
      'NEW GAME',
      'CONTINUE',
      'LOAD GAME',
      'CHALLENGES',
      'SETTINGS',
      'ACHIEVEMENTS',
      'LEADERBOARDS',
      'HELP',
    ];

    for (const label of buttons) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    // CONTINUE should be disabled in fresh context (no save data)
    await expect(page.getByRole('button', { name: 'CONTINUE' })).toBeDisabled();
  });
});
