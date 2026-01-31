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
export type { AudioPosition, SpatialEnvironment } from './SoundDispatcher';

// Splash audio manager
export {
  SplashAudioManager,
  getSplashAudioManager,
  disposeSplashAudioManager,
} from './SplashAudioManager';
export type { AudioUnlockState, OrientationPreference } from './SplashAudioManager';

// Audio event handler
export {
  AudioEventHandler,
  getAudioEventHandler,
  initializeAudioEventHandler,
  disposeAudioEventHandler,
} from './AudioEventHandler';

// Adaptive music layer system
export {
  MusicLayerType,
  MusicLayer,
  TRANSITION_TIMING,
  LAYER_VOLUMES,
  LEVEL_MUSIC_THEMES,
  SCALES,
  BASS_NOTES,
  CHORD_PROGRESSIONS,
  calculateCombatIntensity,
  getActiveLayersForIntensity,
  getNextBarTime,
  scheduleAtNextBar,
  getSynthFactoryForStyle,
  createIndustrialSynths,
  createDesolateSynths,
  createOrganicSynths,
  createUrgentSynths,
  createHorrorSynths,
  createFrozenSynths,
  generateAmbientPattern,
  generatePercussionPattern,
  generateBassPattern,
  generateStabPattern,
  generateLeadPattern,
} from './MusicLayers';
export type {
  CombatState,
  LayerState,
  LevelMusicTheme,
  BossMusicConfig,
  LayerSynthSet,
} from './MusicLayers';

// Tone.js-based music composer (menu, combat, boss music)
export {
  MusicComposer,
  getMusicComposer,
  disposeMusicComposer,
} from './MusicComposer';

// Tone.js-based procedural sound effects
export {
  ProceduralSFX,
  getProceduralSFX,
  disposeProceduralSFX,
} from './ProceduralSFX';

// Ambient soundscape system
export {
  AmbientSoundscapes,
  getAmbientSoundscapes,
  disposeAmbientSoundscapes,
} from './AmbientSoundscapes';
export type { EnvironmentType } from './AmbientSoundscapes';
