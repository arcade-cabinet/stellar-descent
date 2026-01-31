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
};
