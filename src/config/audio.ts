import { resolveAsset } from './paths';

/** Music track file paths */
export const MUSIC_PATHS = {
  menu: resolveAsset('assets/audio/music/menu.ogg'),
  ambient: resolveAsset('assets/audio/music/ambient.ogg'),
  combat: resolveAsset('assets/audio/music/combat.ogg'),
  exploration: resolveAsset('assets/audio/music/exploration.ogg'),
  boss: resolveAsset('assets/audio/music/boss.ogg'),
  victory: resolveAsset('assets/audio/music/victory.ogg'),
} as const;

/** Splash screen audio paths (orientation-specific) */
export const SPLASH_AUDIO_PATHS = {
  portrait: resolveAsset('assets/audio/splash/splash-portrait.ogg'),
  landscape: resolveAsset('assets/audio/splash/splash-landscape.ogg'),
} as const;
