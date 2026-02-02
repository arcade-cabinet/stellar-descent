/**
 * Music System
 * Tone.js-based music player with crossfading support
 */

import * as Tone from 'tone';
import { MUSIC_PATHS, TRACK_INFO } from './constants';
import type { MusicTrack } from './types';

/**
 * Music Player class
 * Handles music playback with smooth crossfading between tracks
 */
export class MusicPlayer {
  private playerA: Tone.Player | null = null;
  private playerB: Tone.Player | null = null;
  private crossFade: Tone.CrossFade;
  private masterGain: Tone.Gain;
  private reverb: Tone.Reverb;
  private lowpassFilter: Tone.Filter;

  private currentPlayer: 'A' | 'B' = 'A';
  private currentTrack: MusicTrack | null = null;
  private isLoading = false;
  private volume = 0.5;

  constructor() {
    // Create effects chain for atmospheric sound
    this.reverb = new Tone.Reverb({
      decay: 4,
      wet: 0.3,
    });

    this.lowpassFilter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
    });

    // Crossfade between two players for smooth transitions
    this.crossFade = new Tone.CrossFade(0);

    // Master output
    this.masterGain = new Tone.Gain(this.volume);

    // Connect: crossfade -> filter -> reverb -> master -> destination
    this.crossFade.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.reverb);
    this.reverb.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  /**
   * Play a music track with optional crossfade
   */
  async play(track: MusicTrack, crossfadeDuration = 2): Promise<void> {
    if (this.currentTrack === track || this.isLoading) return;

    this.isLoading = true;
    const path = MUSIC_PATHS[track];

    try {
      // Start Tone.js context if not started (requires user interaction)
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
      }

      // Create new player for the incoming track
      // Use a per-player load promise instead of global Tone.loaded(),
      // which can be poisoned by other failed buffers (e.g. missing splash audio)
      const newPlayer = await new Promise<Tone.Player>((resolve, reject) => {
        const player = new Tone.Player({
          url: path,
          loop: true,
          fadeIn: 0.1,
          fadeOut: 0.1,
          onload: () => resolve(player),
          onerror: (err) => reject(err),
        });
      });

      // Determine which player slot to use
      const targetPlayer = this.currentPlayer === 'A' ? 'B' : 'A';

      if (targetPlayer === 'A') {
        // Dispose old player if exists
        if (this.playerA) {
          this.playerA.stop();
          this.playerA.dispose();
        }
        this.playerA = newPlayer;
        this.playerA.connect(this.crossFade.a);
        this.playerA.start();
      } else {
        if (this.playerB) {
          this.playerB.stop();
          this.playerB.dispose();
        }
        this.playerB = newPlayer;
        this.playerB.connect(this.crossFade.b);
        this.playerB.start();
      }

      // Perform crossfade
      const targetFade = targetPlayer === 'A' ? 0 : 1;
      this.crossFade.fade.rampTo(targetFade, crossfadeDuration);

      // Adjust effects based on track intensity
      const info = TRACK_INFO[track];
      const reverbWet = 0.2 + (1 - info.intensity) * 0.3; // More reverb for calmer tracks
      this.reverb.wet.rampTo(reverbWet, crossfadeDuration);

      // Update state
      this.currentPlayer = targetPlayer;
      this.currentTrack = track;

      // Clean up the old player after crossfade
      setTimeout(
        () => {
          const oldPlayer = targetPlayer === 'A' ? this.playerB : this.playerA;
          if (oldPlayer) {
            oldPlayer.stop();
          }
        },
        crossfadeDuration * 1000 + 100
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Stop music playback with fade
   */
  stop(fadeDuration = 1): void {
    this.masterGain.gain.rampTo(0, fadeDuration);
    setTimeout(
      () => {
        this.playerA?.stop();
        this.playerB?.stop();
        this.currentTrack = null;
        this.masterGain.gain.value = this.volume;
      },
      fadeDuration * 1000 + 100
    );
  }

  /**
   * Set the music volume
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.masterGain.gain.rampTo(this.volume, 0.1);
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Get currently playing track
   */
  getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  /**
   * Apply a lowpass filter effect (useful for underwater, muffled, etc.)
   */
  setFilterCutoff(frequency: number, rampTime = 0.5): void {
    this.lowpassFilter.frequency.rampTo(frequency, rampTime);
  }

  /**
   * Reset filter to normal
   */
  resetFilter(): void {
    this.lowpassFilter.frequency.rampTo(20000, 0.5);
  }

  /**
   * Check if currently loading a track
   */
  isLoadingTrack(): boolean {
    return this.isLoading;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.playerA?.dispose();
    this.playerB?.dispose();
    this.crossFade.dispose();
    this.masterGain.dispose();
    this.reverb.dispose();
    this.lowpassFilter.dispose();
  }
}
