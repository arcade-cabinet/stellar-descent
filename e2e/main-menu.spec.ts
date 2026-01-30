import { expect, test } from '@playwright/test';

test.describe('Main Menu Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display new buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /LOAD CAMPAIGN/i })).toBeVisible();

    const continueBtn = page.getByRole('button', { name: /CONTINUE/i });
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeDisabled();
  });
});
