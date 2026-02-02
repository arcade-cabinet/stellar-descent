import { resolveAsset } from './paths';

/** Splash screen video paths (orientation-specific) */
export const SPLASH_VIDEO_PATHS = {
  landscape: resolveAsset('assets/videos/splash/main_16x9.mp4'),
  portrait: resolveAsset('assets/videos/splash/main_9x16.mp4'),
} as const;
