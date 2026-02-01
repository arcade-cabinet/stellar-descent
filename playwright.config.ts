/**
 * Playwright E2E Test Configuration for Stellar Descent
 *
 * Configures Playwright for testing the game in a real browser environment.
 * Uses the dev server during local development and can target production builds.
 *
 * WebGL/BabylonJS considerations:
 * - Extended timeouts for 3D asset loading
 * - GPU-specific browser flags for WebGL support
 * - 1920x1080 viewport for consistent canvas rendering
 *
 * Level-specific tests:
 * - Level tests use PlayerGovernor for AI-controlled player actions
 * - Debug interface exposed via window.__STELLAR_DESCENT_DEBUG__
 * - Visual regression snapshots stored in test-results/screenshots
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: false, // Game tests should run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for game state consistency
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
  ],
  timeout: 180000, // 3 minutes per test (level tests take time)
  expect: {
    timeout: 30000, // 30 seconds for assertions (WebGL renders can be slow)
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      threshold: 0.2,
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-results/playwright-artifacts',

  // Snapshot directory for visual regression
  snapshotDir: 'test-results/snapshots',

  use: {
    baseURL: 'http://localhost:4174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 60000,

    // WebGL requires proper GPU handling
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=gl',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        '--disable-software-rasterizer',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  webServer: {
    command: 'pnpm dev --port 4174',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
