/**
 * DevMode - Mutable development mode state
 *
 * Shared across the game engine and React UI. The DevMenu component
 * toggles these flags; gameplay systems read them each frame.
 *
 * Only meaningful when VITE_DEV_MENU=true (see .env.development).
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
