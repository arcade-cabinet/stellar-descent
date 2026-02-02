/**
 * SplashAudioManager - Handles audio during splash screen with device-aware playback
 *
 * Features:
 * - Orientation-aware audio selection (portrait vs landscape)
 * - Capacitor device detection for native platform support
 * - Web Audio API for precise timing
 * - Audio unlock handling for browser autoplay restrictions
 * - Seamless crossfade transition to main menu music
 */

import { Capacitor } from '@capacitor/core';
import * as Tone from 'tone';
import { getLogger } from '../Logger';

const log = getLogger('SplashAudioManager');

// Audio file paths
const SPLASH_AUDIO_PATHS = {
  portrait: '/assets/audio/splash/splash-portrait.ogg',
  landscape: '/assets/audio/splash/splash-landscape.ogg',
} as const;

// Storage keys for volume persistence
const STORAGE_KEYS = {
  masterVolume: 'stellar_descent_master_volume',
  musicVolume: 'stellar_descent_music_volume',
  lastPlayPosition: 'stellar_descent_splash_position',
} as const;

// Default volumes
const DEFAULT_MASTER_VOLUME = 1.0;
const DEFAULT_MUSIC_VOLUME = 0.5;

/**
 * Audio unlock state
 */
export type AudioUnlockState = 'locked' | 'unlocking' | 'unlocked';

/**
 * Device orientation preference
 */
export type OrientationPreference = 'portrait' | 'landscape';

/**
 * Callback for audio state changes
 */
export type AudioStateCallback = (state: AudioUnlockState) => void;

/**
 * SplashAudioManager class
 */
export class SplashAudioManager {
  private player: Tone.Player | null = null;
  private masterGain: Tone.Gain;
  private lowpassFilter: Tone.Filter;

  private unlockState: AudioUnlockState = 'locked';
  private stateCallbacks: Set<AudioStateCallback> = new Set();
  private orientation: OrientationPreference;
  private isPlaying = false;
  private isFadingOut = false;
  private currentVolume: number;
  private savedMasterVolume: number;
  private pendingPlayOnUnlock = false;

  constructor() {
    // Determine initial orientation
    this.orientation = this.detectOrientation();

    // Load saved volume settings
    this.savedMasterVolume = this.loadVolumeFromStorage(
      STORAGE_KEYS.masterVolume,
      DEFAULT_MASTER_VOLUME
    );
    const savedMusicVolume = this.loadVolumeFromStorage(
      STORAGE_KEYS.musicVolume,
      DEFAULT_MUSIC_VOLUME
    );
    this.currentVolume = savedMusicVolume * this.savedMasterVolume;

    // Create audio chain
    this.lowpassFilter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
    });

    this.masterGain = new Tone.Gain(this.currentVolume);

    // Connect: filter -> master -> destination
    this.lowpassFilter.connect(this.masterGain);
    this.masterGain.toDestination();

    // Check if audio context is already unlocked
    this.checkAudioUnlockState();

    // Listen for orientation changes
    this.setupOrientationListener();

    log.info('SplashAudioManager initialized', {
      orientation: this.orientation,
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
    });
  }

  /**
   * Detect current orientation preference
   */
  private detectOrientation(): OrientationPreference {
    // Check window dimensions
    const isPortrait = window.innerHeight > window.innerWidth;
    return isPortrait ? 'portrait' : 'landscape';
  }

  /**
   * Setup orientation change listener
   */
  private setupOrientationListener(): void {
    const handleOrientationChange = () => {
      const newOrientation = this.detectOrientation();
      if (newOrientation !== this.orientation) {
        log.info('Orientation changed', { from: this.orientation, to: newOrientation });
        this.orientation = newOrientation;
        // If playing, we could switch audio here, but for now we keep the original
        // to avoid jarring transitions during splash
      }
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
  }

  /**
   * Load volume from localStorage
   */
  private loadVolumeFromStorage(key: string, defaultValue: number): number {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const parsed = parseFloat(stored);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed;
        }
      }
    } catch (e) {
      log.warn('Failed to load volume from storage', e);
    }
    return defaultValue;
  }

  /**
   * Save volume to localStorage
   */
  saveVolumeToStorage(key: string, value: number): void {
    try {
      localStorage.setItem(key, value.toString());
    } catch (e) {
      log.warn('Failed to save volume to storage', e);
    }
  }

  /**
   * Check if Web Audio API is already unlocked
   */
  private checkAudioUnlockState(): void {
    const context = Tone.getContext();
    if (context.state === 'running') {
      this.setUnlockState('unlocked');
    } else {
      this.setUnlockState('locked');
    }
  }

  /**
   * Set audio unlock state and notify listeners
   */
  private setUnlockState(state: AudioUnlockState): void {
    if (this.unlockState !== state) {
      this.unlockState = state;
      log.info('Audio unlock state changed', { state });
      this.stateCallbacks.forEach((cb) => cb(state));

      // If we just unlocked and have pending play, start now
      if (state === 'unlocked' && this.pendingPlayOnUnlock) {
        this.pendingPlayOnUnlock = false;
        this.startPlayback();
      }
    }
  }

  /**
   * Subscribe to audio state changes
   */
  onStateChange(callback: AudioStateCallback): () => void {
    this.stateCallbacks.add(callback);
    // Immediately notify of current state
    callback(this.unlockState);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Get current unlock state
   */
  getUnlockState(): AudioUnlockState {
    return this.unlockState;
  }

  /**
   * Get current orientation
   */
  getOrientation(): OrientationPreference {
    return this.orientation;
  }

  /**
   * Attempt to unlock audio via user interaction
   */
  async unlockAudio(): Promise<boolean> {
    if (this.unlockState === 'unlocked') {
      return true;
    }

    this.setUnlockState('unlocking');

    try {
      await Tone.start();
      log.info('Tone.js started successfully');
      this.setUnlockState('unlocked');
      return true;
    } catch (err) {
      log.error('Failed to start Tone.js', err);
      this.setUnlockState('locked');
      return false;
    }
  }

  /**
   * Start playing splash audio
   * If audio is locked, will queue playback for when unlocked
   */
  async play(): Promise<void> {
    if (this.isPlaying || this.isFadingOut) {
      return;
    }

    // If audio is locked, queue for later
    if (this.unlockState !== 'unlocked') {
      log.info('Audio locked, queueing playback for unlock');
      this.pendingPlayOnUnlock = true;
      return;
    }

    await this.startPlayback();
  }

  /**
   * Internal playback start
   */
  private async startPlayback(): Promise<void> {
    const audioPath = SPLASH_AUDIO_PATHS[this.orientation];
    log.info('Starting splash audio', { path: audioPath, orientation: this.orientation });

    try {
      // Pre-validate the audio file exists and is actually audio
      // Without this check, Vite's SPA fallback serves index.html for missing files,
      // and Tone.js fails globally when trying to decode HTML as audio
      const headResp = await fetch(audioPath, { method: 'HEAD' });
      if (!headResp.ok) {
        log.warn('Splash audio file not reachable', { path: audioPath, status: headResp.status });
        return;
      }
      const contentType = headResp.headers.get('content-type') || '';
      if (!contentType.startsWith('audio/')) {
        log.warn('Splash audio file not available', { path: audioPath, contentType });
        return;
      }

      // Create player for splash audio
      this.player = new Tone.Player({
        url: audioPath,
        loop: false,
        fadeIn: 0.5,
        fadeOut: 0.5,
        onload: () => {
          log.info('Splash audio loaded');
        },
        onerror: (err) => {
          log.error('Splash audio load error', err);
        },
      });

      // Wait for audio to load
      await Tone.loaded();

      // Connect to effects chain
      this.player.connect(this.lowpassFilter);

      // Start playback
      this.player.start();
      this.isPlaying = true;
      log.info('Splash audio playback started');
    } catch (err) {
      log.error('Failed to start splash audio', err);
      this.isPlaying = false;
    }
  }

  /**
   * Stop splash audio immediately
   */
  stop(): void {
    if (this.player) {
      this.player.stop();
      this.player.dispose();
      this.player = null;
    }
    this.isPlaying = false;
    this.isFadingOut = false;
    this.pendingPlayOnUnlock = false;
  }

  /**
   * Begin crossfade out - prepares for transition to menu music
   * Returns the current playback position so menu can sync
   */
  beginCrossfade(fadeDuration = 2): number {
    if (!this.isPlaying || this.isFadingOut) {
      return 0;
    }

    this.isFadingOut = true;
    const currentPosition = this.player?.now() || 0;

    log.info('Beginning crossfade out', { fadeDuration, position: currentPosition });

    // Fade out the splash audio
    this.masterGain.gain.rampTo(0, fadeDuration);

    // Dispose after fade completes
    setTimeout(
      () => {
        this.stop();
      },
      fadeDuration * 1000 + 100
    );

    return currentPosition;
  }

  /**
   * Get the audio path for preloading by other systems
   */
  getAudioPath(): string {
    return SPLASH_AUDIO_PATHS[this.orientation];
  }

  /**
   * Get saved master volume
   */
  getSavedMasterVolume(): number {
    return this.savedMasterVolume;
  }

  /**
   * Get saved music volume
   */
  getSavedMusicVolume(): number {
    return this.loadVolumeFromStorage(STORAGE_KEYS.musicVolume, DEFAULT_MUSIC_VOLUME);
  }

  /**
   * Check if currently playing
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying && !this.isFadingOut;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.stop();
    this.masterGain.dispose();
    this.lowpassFilter.dispose();
    this.stateCallbacks.clear();
    log.info('SplashAudioManager disposed');
  }
}

// Singleton instance
let splashAudioManagerInstance: SplashAudioManager | null = null;

/**
 * Get the splash audio manager singleton
 */
export function getSplashAudioManager(): SplashAudioManager {
  if (!splashAudioManagerInstance) {
    splashAudioManagerInstance = new SplashAudioManager();
  }
  return splashAudioManagerInstance;
}

/**
 * Dispose of the splash audio manager singleton
 */
export function disposeSplashAudioManager(): void {
  if (splashAudioManagerInstance) {
    splashAudioManagerInstance.dispose();
    splashAudioManagerInstance = null;
  }
}
