/**
 * BuildConfig - Build-time feature flags set via Vite define
 *
 * These flags are set at build time via environment variables and cannot be
 * changed at runtime. Use these for enabling/disabling features in dev vs prod.
 *
 * Environment variables are configured in:
 * - .env.development (flags enabled for local dev)
 * - .env.production (flags disabled for release builds)
 *
 * @example
 * ```typescript
 * import { BUILD_FLAGS } from '@/game/core/BuildConfig';
 *
 * if (BUILD_FLAGS.UNLOCK_ALL_CAMPAIGNS) {
 *   // All levels are accessible
 * }
 * ```
 */
export const BUILD_FLAGS = {
  /**
   * Unlock all campaign levels by default (for testing).
   * When enabled, players can access any level from the level select screen
   * without completing previous missions.
   */
  UNLOCK_ALL_CAMPAIGNS: import.meta.env.VITE_UNLOCK_ALL_CAMPAIGNS === 'true',

  /**
   * Enable AI Player option in Settings.
   * When enabled, an "AI Player" toggle appears in the gameplay settings tab.
   * This is intended for automated playtesting and demos.
   */
  ENABLE_AI_PLAYER: import.meta.env.VITE_ENABLE_AI_PLAYER === 'true',

  /**
   * Show debug info in HUD.
   * When enabled, displays performance metrics, entity counts,
   * and other debug information during gameplay.
   */
  DEBUG_HUD: import.meta.env.VITE_DEBUG_HUD === 'true',

  /**
   * Enable dev menu (backtick key).
   * When enabled, pressing backtick (`) shows an overlay with
   * level jumping, god mode, noclip, and other dev tools.
   */
  DEV_MENU: import.meta.env.VITE_DEV_MENU === 'true',
} as const;

/**
 * Type for build flags - useful for typed access
 */
export type BuildFlags = typeof BUILD_FLAGS;
