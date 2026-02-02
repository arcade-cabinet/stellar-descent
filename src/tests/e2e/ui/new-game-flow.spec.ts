/**
 * New Game Flow - Campaign start through mission briefing and gameplay entry
 *
 * Port of .maestro/flows/03-game-loading.yaml + new-game-start.yaml
 * Tests the full NEW GAME flow: mission select -> difficulty -> briefing -> gameplay.
 */

import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test.describe('New Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'NEW GAME' })).toBeVisible({ timeout: 30_000 });
  });

  /**
   * Navigate through NEW GAME -> mission select -> difficulty -> START CAMPAIGN.
   * Handles save-overwrite confirmation if it appears.
   */
  async function navigateToMissionBriefing(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'NEW GAME' }).click();

    // Handle save overwrite confirmation if it appears
    // Button has aria-label="Confirm start new campaign", so use getByText for text content match
    try {
      const startNewBtn = page.getByText('START NEW', { exact: true });
      await startNewBtn.click({ timeout: 2_000 });
    } catch {
      // No save overwrite prompt - continue
    }

    // Mission select screen
    await expect(page.getByText('SELECT MISSION')).toBeVisible({ timeout: 10_000 });

    // Verify campaign levels listed
    await expect(page.getByText('ANCHOR STATION PROMETHEUS')).toBeVisible();
    await expect(page.getByText('LANDFALL')).toBeVisible();
    await expect(page.getByText('CANYON RUN')).toBeVisible();

    // Select Anchor Station
    await page.getByText('ANCHOR STATION PROMETHEUS').click();

    // Difficulty selection (use heading role to avoid matching the aria-labelledby span)
    await expect(page.getByRole('heading', { name: 'SELECT DIFFICULTY' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('EASY')).toBeVisible();
    await expect(page.getByText('NORMAL')).toBeVisible();
    await expect(page.getByText('HARD')).toBeVisible();
    await expect(page.getByText('NIGHTMARE', { exact: true })).toBeVisible();
    await expect(page.getByText('ULTRA-NIGHTMARE')).toBeVisible();

    // Start campaign (button text includes arrow → ; wait for enabled in case difficulty store init is slow)
    const startCampaignBtn = page.getByRole('button', { name: /START CAMPAIGN/ });
    await expect(startCampaignBtn).toBeEnabled({ timeout: 5_000 });
    await startCampaignBtn.click();

    // Mission briefing (allow extra time for level asset loading under server contention)
    await expect(page.getByText('MISSION BRIEFING')).toBeVisible({ timeout: 30_000 });
  }

  test('full flow through mission briefing', async ({ page }) => {
    await navigateToMissionBriefing(page);

    // Verify briefing content
    await expect(page.getByRole('button', { name: 'BEGIN MISSION' })).toBeVisible();

    // Verify objectives are shown
    await expect(page.getByText('Complete weapons familiarization')).toBeVisible();
    await expect(page.getByText('Navigate to drop pod')).toBeVisible();
  });

  test('enter gameplay from mission briefing', async ({ page }) => {
    await navigateToMissionBriefing(page);

    // Wait for typewriter animation to finish (button is disabled={isTyping})
    const beginBtn = page.getByRole('button', { name: 'BEGIN MISSION' });
    await expect(beginBtn).toBeEnabled({ timeout: 10_000 });
    await beginBtn.click();

    // Main menu should disappear (game has transitioned to gameplay)
    await expect(page.getByRole('button', { name: 'NEW GAME' })).not.toBeVisible({
      timeout: 10_000,
    });
  });
});
