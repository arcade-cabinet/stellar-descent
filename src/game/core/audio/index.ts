/**
 * Audio System - Modular Audio Management
 *
 * This module provides a complete audio system with:
 * - Procedural sound effects (UI, weapons, enemies, environment)
 * - Music playback with crossfading
 * - Ambient sound generation
 * - Level-specific audio configurations
 */

// Types
export type {
  SoundEffect,
  MusicTrack,
  SoundConfig,
  LevelAudioConfig,
  ProceduralAmbientType,
  MusicEnvironment,
  TrackInfo,
  LoopableSoundEffect,
  AudioLoopHandle,
  VolumeSettings,
  AudioState,
} from './types';

// Constants
export {
  MUSIC_PATHS,
  TRACK_INFO,
  LEVEL_AUDIO_CONFIGS,
  DEFAULT_VOLUMES,
  FADE_DURATIONS,
  COMBAT_EXIT_DELAY_MS,
  FREQUENCIES,
  LFO_RATES,
  FILTER_Q,
} from './constants';

// Sound generators
export { UISoundGenerator } from './sounds/ui';
export { WeaponSoundGenerator } from './sounds/weapons';
export { EnemySoundGenerator } from './sounds/enemies';
export { EnvironmentSoundGenerator } from './sounds/environment';

// Music player
export { MusicPlayer } from './music';

// Sound dispatcher
export { SoundDispatcher, ProceduralAmbientGenerator } from './SoundDispatcher';
