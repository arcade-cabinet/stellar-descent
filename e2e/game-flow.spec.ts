import { expect, test } from '@playwright/test';

test.describe('Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Main Menu', () => {
    test('should display main menu on load', async ({ page }) => {
      // Check for main menu elements
      await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /HALO DROP/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /CONTROLS/i })).toBeVisible();
    });

    test('should show controls modal when clicking CONTROLS', async ({ page }) => {
      await page.getByRole('button', { name: /CONTROLS/i }).click();

      // Check for controls content
      await expect(page.getByText(/OPERATIONS MANUAL/i)).toBeVisible();
      await expect(page.getByText(/Move/i)).toBeVisible();
    });

    test('should close controls modal when clicking CLOSE', async ({ page }) => {
      await page.getByRole('button', { name: /CONTROLS/i }).click();
      await page.getByRole('button', { name: /CLOSE/i }).click();

      await expect(page.getByText(/OPERATIONS MANUAL/i)).not.toBeVisible();
    });
  });

  test.describe('Loading Screen', () => {
    test('should show loading screen when starting new campaign', async ({ page }) => {
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Should see loading screen
      await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible();
      await expect(page.getByText(/%/)).toBeVisible();
    });

    test('should show progress updates during loading', async ({ page }) => {
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Should see status updates
      await expect(page.getByText(/INITIALIZING|LOADING|COMPILING|SYSTEMS/i)).toBeVisible();
    });

    test('should transition to tutorial after loading completes', async ({ page }) => {
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Wait for loading to complete and tutorial to start
      await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 10000 });

      // Wait for tutorial comms to appear
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Tutorial', () => {
    test.beforeEach(async ({ page }) => {
      // Start the game
      await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

      // Wait for tutorial to start
      await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 15000 });
    });

    test('should show comms display with AI message', async ({ page }) => {
      // Check for comms UI elements
      await expect(page.getByText(/ATHENA/i)).toBeVisible();
      await expect(page.getByText(/PROMETHEUS A.I./i)).toBeVisible();
    });

    test('should advance comms when clicking acknowledge', async ({ page }) => {
      const firstMessage = page.getByText(/Good morning, Sergeant Cole/i);
      await expect(firstMessage).toBeVisible();

      // Click to advance
      await page.getByRole('button', { name: /ACKNOWLEDGE|SKIP/i }).click();

      // Wait for the next message or the button to disappear
      await expect(firstMessage).not.toBeVisible();
    });

    test('should show objective display during tutorial', async ({ page }) => {
      // Advance past initial comms
      await page.keyboard.press('Space');
      
      // Should see objective display eventually
      // The exact text depends on which step we're on
      const objectiveDisplay = page.locator('.objective-display, .objective-title');
      await expect(objectiveDisplay.first()).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('HALO Drop (Skip Tutorial)', () => {
    test('should skip to HALO drop when clicking HALO DROP', async ({ page }) => {
      await page.getByRole('button', { name: /HALO DROP/i }).click();

      // Should see loading
      await expect(page.getByText(/ANCHOR STATION PROMETHEUS/i)).toBeVisible();

      // Wait for loading to complete
      await expect(page.getByText(/SYSTEMS ONLINE/i)).toBeVisible({ timeout: 10000 });

      // Should see notification about drop
      await expect(page.getByText(/ORBITAL DROP INITIATED/i)).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Canvas Rendering', () => {
  test('should have a canvas element', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('canvas should have correct dimensions', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Menu should still be visible
    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: /NEW CAMPAIGN/i })).toBeVisible();
  });
});
