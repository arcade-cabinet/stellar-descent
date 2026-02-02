/**
 * Global Teardown - Clean up browser processes after test run
 *
 * Playwright normally closes browsers when tests finish, but orphaned
 * Chromium processes can survive after Ctrl+C, crashes, or test timeouts.
 * This teardown ensures all Playwright-spawned browsers are terminated.
 */

import { execSync } from 'node:child_process';

export default async function globalTeardown() {
  // Kill any Chromium processes spawned by Playwright that survived the test run.
  // The --playwright flag in the process args distinguishes Playwright browsers
  // from the user's normal Chrome instance.
  try {
    const platform = process.platform;

    if (platform === 'darwin' || platform === 'linux') {
      // Find Chromium processes whose command line contains the Playwright
      // browser cache path. This avoids killing the user's Chrome.
      execSync(
        "pkill -f '.cache/ms-playwright/chromium.*--type=' 2>/dev/null || true",
        { stdio: 'ignore' },
      );
    } else if (platform === 'win32') {
      // On Windows, Playwright chromium lives under AppData
      execSync(
        'taskkill /F /FI "IMAGENAME eq chrome.exe" /FI "MODULES eq playwright" 2>nul || exit /b 0',
        { stdio: 'ignore', shell: 'cmd.exe' },
      );
    }
  } catch {
    // Best-effort cleanup — don't fail the test run if this errors
  }
}
