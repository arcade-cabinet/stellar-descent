/**
 * Playwright E2E Configuration for Stellar Descent
 *
 * Optimized for BabylonJS 3D game testing with:
 * - Extended timeouts for asset loading
 * - WebGL context preservation
 * - Screenshot and video capture
 * - PlayerGovernor integration for autonomous testing
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Stellar Descent E2E tests
 */
export default defineConfig({
  // Test directory relative to this config
  testDir: '.',
  testMatch: '**/*.spec.ts',

  // Maximum time one test can run (30 minutes for full campaign)
  timeout: 30 * 60 * 1000,

  // Expect timeout for assertions
  expect: {
    timeout: 30 * 1000,
  },

  // Fail the build on CI if test.only is left in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Run tests in parallel on CI, but sequentially for campaign tests
  workers: process.env.CI ? 1 : 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Shared settings for all projects
  use: {
    // Base URL for the dev server
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',

    // Collect trace on failure for debugging
    trace: 'on-first-retry',

    // Take screenshots on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'on-first-retry',

    // Extended action timeout for game interactions
    actionTimeout: 15 * 1000,

    // Extended navigation timeout for level loading
    navigationTimeout: 60 * 1000,

    // Viewport size matching game requirements
    viewport: { width: 1920, height: 1080 },

    // Ignore HTTPS errors for local dev
    ignoreHTTPSErrors: true,

    // Run with visible browser by default (use --headed on CLI to override)
    headless: process.env.CI ? true : false,

    // Preserve WebGL context
    launchOptions: {
      args: [
        '--enable-webgl',
        '--use-gl=desktop',
        '--enable-accelerated-2d-canvas',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        // Required for audio testing
        '--autoplay-policy=no-user-gesture-required',
      ],
    },

    // Context options
    contextOptions: {
      // Permissions for game features
      permissions: ['accelerometer', 'gyroscope'],
      // Geolocation not needed but prevent errors
      geolocation: undefined,
      // Locale for i18n testing
      locale: 'en-US',
    },
  },

  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Explicitly set headless mode based on environment
        headless: process.env.CI ? true : false,
        // Force hardware acceleration
        launchOptions: {
          args: [
            '--enable-webgl',
            '--use-gl=desktop',
            '--enable-accelerated-2d-canvas',
            '--ignore-gpu-blocklist',
            '--disable-gpu-sandbox',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.force-enabled': true,
            'layers.acceleration.force-enabled': true,
            'media.autoplay.default': 0,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
    // Mobile viewport tests
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--use-gl=desktop',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
    },
  ],

  // Web server configuration - Playwright manages the dev server
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    cwd: process.env.PROJECT_ROOT || '../../../',
  },
});
