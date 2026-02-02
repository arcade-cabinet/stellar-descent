/**
 * Audio System - Modular Audio Management
 *
 * This module provides a complete audio system with:
 * - Procedural sound effects (UI, weapons, enemies, environment)
 * - Music playback with crossfading
 * - Ambient sound generation
 * - Level-specific audio configurations
 */

export type { EnvironmentType } from './AmbientSoundscapes';
// Ambient soundscape system
export {
  AmbientSoundscapes,
  disposeAmbientSoundscapes,
  getAmbientSoundscapes,
} from './AmbientSoundscapes';
// Audio event handler
export {
  AudioEventHandler,
  disposeAudioEventHandler,
  getAudioEventHandler,
  initializeAudioEventHandler,
} from './AudioEventHandler';
// Constants
export {
  COMBAT_EXIT_DELAY_MS,
  DEFAULT_VOLUMES,
  FADE_DURATIONS,
  FILTER_Q,
  FREQUENCIES,
  LEVEL_AUDIO_CONFIGS,
  LFO_RATES,
  MUSIC_PATHS,
  TRACK_INFO,
} from './constants';
// Tone.js-based music composer (menu, combat, boss music)
export {
  disposeMusicComposer,
  getMusicComposer,
  MusicComposer,
} from './MusicComposer';
export type {
  BossMusicConfig,
  CombatState,
  LayerState,
  LayerSynthSet,
  LevelMusicTheme,
} from './MusicLayers';
// Adaptive music layer system
export {
  BASS_NOTES,
  CHORD_PROGRESSIONS,
  calculateCombatIntensity,
  createDesolateSynths,
  createFrozenSynths,
  createHorrorSynths,
  createIndustrialSynths,
  createOrganicSynths,
  createUrgentSynths,
  generateAmbientPattern,
  generateBassPattern,
  generateLeadPattern,
  generatePercussionPattern,
  generateStabPattern,
  getActiveLayersForIntensity,
  getNextBarTime,
  getSynthFactoryForStyle,
  LAYER_VOLUMES,
  LEVEL_MUSIC_THEMES,
  MusicLayer,
  MusicLayerType,
  SCALES,
  scheduleAtNextBar,
  TRANSITION_TIMING,
} from './MusicLayers';
// Music player
export { MusicPlayer } from './music';
// Tone.js-based procedural sound effects
export {
  disposeProceduralSFX,
  getProceduralSFX,
  ProceduralSFX,
} from './ProceduralSFX';
export type { AudioPosition, SpatialEnvironment } from './SoundDispatcher';
// Sound dispatcher
export { ProceduralAmbientGenerator, SoundDispatcher } from './SoundDispatcher';
export type { AudioUnlockState, OrientationPreference } from './SplashAudioManager';
// Splash audio manager
export {
  disposeSplashAudioManager,
  getSplashAudioManager,
  SplashAudioManager,
} from './SplashAudioManager';
export { EnemySoundGenerator } from './sounds/enemies';
export { EnvironmentSoundGenerator } from './sounds/environment';
// Sound generators
export { UISoundGenerator } from './sounds/ui';
export { WeaponSoundGenerator } from './sounds/weapons';
// Types
export type {
  AudioLoopHandle,
  AudioState,
  LevelAudioConfig,
  LoopableSoundEffect,
  MusicEnvironment,
  MusicTrack,
  ProceduralAmbientType,
  SoundConfig,
  SoundEffect,
  TrackInfo,
  VolumeSettings,
} from './types';
