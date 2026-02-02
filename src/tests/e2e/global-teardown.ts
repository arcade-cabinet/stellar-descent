/**
 * Global Teardown - Clean up browser processes after test run
 *
 * Playwright normally closes browsers when tests finish, but orphaned
 * Chromium processes can survive after Ctrl+C, crashes, or test timeouts —
 * especially in headed (non-headless) mode where browser.close() can hang.
 *
 * This teardown finds and kills Playwright-spawned Chromium by matching the
 * Playwright browser cache path in the process command line, which safely
 * distinguishes it from the user's normal Chrome.
 *
 * Cache paths by platform:
 *   macOS:  ~/Library/Caches/ms-playwright/chromium-*/
 *   Linux:  ~/.cache/ms-playwright/chromium-*/
 *   Win32:  %LOCALAPPDATA%\ms-playwright\chromium-*\
 */

import { execSync } from 'node:child_process';

export default async function globalTeardown() {
  try {
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS: Playwright stores browsers under ~/Library/Caches/ms-playwright/
      // The binary is "Google Chrome for Testing" inside a .app bundle.
      // Match the cache path in the full command line to avoid killing user Chrome.
      execSync(
        "pkill -f 'Library/Caches/ms-playwright/chromium' 2>/dev/null || true",
        { stdio: 'ignore' },
      );
    } else if (platform === 'linux') {
      // Linux: Playwright stores browsers under ~/.cache/ms-playwright/
      execSync(
        "pkill -f '.cache/ms-playwright/chromium' 2>/dev/null || true",
        { stdio: 'ignore' },
      );
    } else if (platform === 'win32') {
      // Windows: Playwright stores browsers under %LOCALAPPDATA%\ms-playwright\
      execSync(
        'taskkill /F /FI "IMAGENAME eq chrome.exe" /FI "MODULES eq playwright" 2>nul || exit /b 0',
        { stdio: 'ignore', shell: 'cmd.exe' },
      );
    }
  } catch {
    // Best-effort cleanup — don't fail the test run if this errors
  }
}
