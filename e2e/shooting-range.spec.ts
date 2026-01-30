import { expect, test } from '@playwright/test';

test.describe('Shooting Range / Weapons Calibration', () => {
  test('should load level and show comms display', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /NEW CAMPAIGN/i }).click();

    // Wait for tutorial to start
    await expect(page.getByText(/Good morning, Sergeant Cole/i)).toBeVisible({ timeout: 30000 });

    // Verify comms panel is visible
    await expect(
      page.locator('[class*="commsPanel"], [class*="CommsDisplay"]').first()
    ).toBeVisible();

    // Game is running and comms system works
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('calibration crosshair should be styled correctly', async ({ page }) => {
    await page.goto('/');

    // Check that calibration crosshair styles exist
    const crosshairStyles = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (
              rule instanceof CSSStyleRule &&
              rule.selectorText?.includes('calibration-crosshair')
            ) {
              return true;
            }
          }
        } catch (e) {
          // CORS issues
        }
      }
      return false;
    });

    expect(crosshairStyles).toBe(true);
  });
});

test.describe('Shooting Range UI Elements', () => {
  test('should have crosshair dot element defined in styles', async ({ page }) => {
    await page.goto('/');

    const hasCrosshairDot = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes('crosshair-dot')) {
              return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });

    expect(hasCrosshairDot).toBe(true);
  });

  test('should have crosshair line elements defined in styles', async ({ page }) => {
    await page.goto('/');

    const hasCrosshairLines = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      let foundTop = false;
      let foundBottom = false;
      let foundLeft = false;
      let foundRight = false;

      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText?.includes('.crosshair-line.top')) foundTop = true;
              if (rule.selectorText?.includes('.crosshair-line.bottom')) foundBottom = true;
              if (rule.selectorText?.includes('.crosshair-line.left')) foundLeft = true;
              if (rule.selectorText?.includes('.crosshair-line.right')) foundRight = true;
            }
          }
        } catch (e) {}
      }

      return foundTop && foundBottom && foundLeft && foundRight;
    });

    expect(hasCrosshairLines).toBe(true);
  });
});
