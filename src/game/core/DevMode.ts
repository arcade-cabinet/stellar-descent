/**
 * DevMode - Mutable development mode state
 *
 * Shared across the game engine and React UI. The DevMenu component
 * toggles these flags; gameplay systems read them each frame.
 *
 * Only meaningful when BUILD_FLAGS.DEV_MENU is true (see BuildConfig.ts).
 *
 * @deprecated This module provides runtime-mutable flags for the DevMenu.
 * For build-time feature flags, use BUILD_FLAGS from BuildConfig.ts instead.
 * This module may be removed in a future version when DevMenu is fully replaced.
 */

/**
 * Check for AI controller querystring parameter
 * Usage: ?ai=true to enable autonomous player control
 */
function checkAIControllerQuerystring(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('ai') === 'true';
}

export const devMode = {
  /** Player takes no damage */
  godMode: false,
  /** Player ignores collision / flies freely */
  noclip: false,
  /** Render physics collider wireframes */
  showColliders: false,
  /** Show live entity count overlay */
  showEntityCount: false,
  /** Show framerate counter */
  showFPS: false,
  /** Player Governor: Unlock all levels for testing (runtime toggle) */
  allLevelsUnlocked: false,
  /**
   * AI Controller: Enable Yuka-based autonomous player control
   * Set via ?ai=true querystring or toggle in DevMenu
   * When enabled, PlayerGovernor controls player movement and actions
   */
  aiController: checkAIControllerQuerystring(),
};
