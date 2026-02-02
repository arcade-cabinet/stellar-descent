/**
 * Playwright E2E Configuration for Stellar Descent
 *
 * Projects:
 * - gameplay-desktop: Deep gameplay tests (campaign, levels, performance, saves)
 * - ui-desktop: UI smoke tests on desktop Chrome 1920x1080
 * - ui-iphone17pro: UI tests on iPhone 17 Pro landscape (874x402)
 * - ui-ipad-portrait: UI tests on iPad Pro 11" portrait (834x1194)
 * - ui-ipad-landscape: UI tests on iPad Pro 11" landscape (1194x834)
 * - ui-oneplus-folded: UI tests on OnePlus Open folded landscape (915x412)
 * - ui-oneplus-unfolded: UI tests on OnePlus Open unfolded (1080x900)
 */

import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/** Deterministic project root: 3 levels up from this config file (src/tests/e2e/ -> root) */
const PROJECT_ROOT =
  process.env.PROJECT_ROOT || path.resolve(import.meta.dirname, '..', '..', '..');

/** WebGL launch args shared by all Chromium projects */
const WEBGL_ARGS = [
  '--enable-webgl',
  '--use-gl=desktop',
  '--enable-accelerated-2d-canvas',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--autoplay-policy=no-user-gesture-required',
];

/** Custom device profile definitions (not in Playwright's built-in registry) */
const customDevices = {
  'iPhone 17 Pro Landscape': {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 874, height: 402 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iPad Pro 11 Portrait': {
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'iPad Pro 11 Landscape': {
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 1194, height: 834 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'OnePlus Open Folded': {
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; CPH2551 Build/AP2A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    viewport: { width: 915, height: 412 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
  'OnePlus Open Unfolded': {
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; CPH2551 Build/AP2A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1080, height: 900 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
} as const;

export default defineConfig({
  testDir: '.',

  // 30-minute global timeout for full campaign tests; UI tests self-limit
  timeout: 30 * 60 * 1000,

  expect: {
    timeout: 30_000,
  },

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  outputDir: 'test-results',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    ignoreHTTPSErrors: true,
    headless: !!process.env.CI,
    contextOptions: {
      permissions: ['accelerometer', 'gyroscope'],
      locale: 'en-US',
    },
  },

  projects: [
    // ── Gameplay (desktop only, uses debug interface + PlayerGovernor) ──
    {
      name: 'gameplay-desktop',
      testMatch: '**/*.spec.ts',
      testIgnore: '**/ui/**',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: { args: WEBGL_ARGS },
      },
    },

    // ── UI tests across device profiles ──
    {
      name: 'ui-desktop',
      testMatch: 'ui/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: { args: WEBGL_ARGS },
      },
    },
    {
      name: 'ui-iphone17pro',
      testMatch: 'ui/**/*.spec.ts',
      use: {
        ...customDevices['iPhone 17 Pro Landscape'],
        launchOptions: { args: WEBGL_ARGS },
      },
    },
    {
      name: 'ui-ipad-portrait',
      testMatch: 'ui/**/*.spec.ts',
      use: {
        ...customDevices['iPad Pro 11 Portrait'],
        launchOptions: { args: WEBGL_ARGS },
      },
    },
    {
      name: 'ui-ipad-landscape',
      testMatch: 'ui/**/*.spec.ts',
      use: {
        ...customDevices['iPad Pro 11 Landscape'],
        launchOptions: { args: WEBGL_ARGS },
      },
    },
    {
      name: 'ui-oneplus-folded',
      testMatch: 'ui/**/*.spec.ts',
      use: {
        ...customDevices['OnePlus Open Folded'],
        launchOptions: { args: WEBGL_ARGS },
      },
    },
    {
      name: 'ui-oneplus-unfolded',
      testMatch: 'ui/**/*.spec.ts',
      use: {
        ...customDevices['OnePlus Open Unfolded'],
        launchOptions: { args: WEBGL_ARGS },
      },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: PROJECT_ROOT,
  },
});
