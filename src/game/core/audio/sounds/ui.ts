/**
 * UI Sound Generators
 * Procedural audio for UI interactions (clicks, menus, notifications)
 */

import { FREQUENCIES } from '../constants';

/**
 * UI Sound Generator class
 * Generates procedural sounds for UI interactions
 */
export class UISoundGenerator {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Generate UI click sound - quick, satisfying click
   */
  generateUIClick(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(FREQUENCIES.clickBase, now);
    osc.frequency.setValueAtTime(FREQUENCIES.clickHigh, now + 0.02);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Generate UI hover sound - subtle tonal highlight
   */
  generateUIHover(volume = 0.1): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Soft, high-pitched tone for hover feedback
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.03);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Generate comms close sound - descending tone signaling end of transmission
   */
  generateCommsClose(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Descending two-tone beep (opposite of comms open)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(FREQUENCIES.notificationHigh, now);
    osc.frequency.setValueAtTime(FREQUENCIES.notificationLow, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + 0.07);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.08);
    gain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    // Add a subtle static crackle
    const noise = ctx.createBufferSource();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.1;
    }
    noise.buffer = noiseBuffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.15, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    osc.connect(gain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    gain.connect(ctx.destination);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  /**
   * Generate notification/comms beep - two-tone alert
   */
  generateNotificationBeep(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Two-tone beep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(FREQUENCIES.notificationLow, now);
    osc.frequency.setValueAtTime(FREQUENCIES.notificationHigh, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.setValueAtTime(volume, now + 0.07);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.08);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.15);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Generate achievement unlock fanfare - triumphant ascending arpeggio
   */
  generateAchievementUnlock(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const notes = FREQUENCIES.achievementNotes;
    const noteLength = 0.12;
    const totalLength = notes.length * noteLength + 0.3;

    // Shimmer/sparkle effect with high harmonics
    const shimmerOsc = ctx.createOscillator();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.value = 2093; // C7 high shimmer

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.15, now + 0.1);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + totalLength);

    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(now);
    shimmerOsc.stop(now + totalLength);

    // Play the ascending arpeggio
    for (let i = 0; i < notes.length; i++) {
      const noteStart = now + i * noteLength;

      // Main tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      // Second oscillator for richness (detuned slightly)
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = notes[i] * 1.002; // Slight detune for chorus effect

      // Envelope for each note
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, noteStart);
      noteGain.gain.linearRampToValueAtTime(volume * 0.6, noteStart + 0.02);
      noteGain.gain.setValueAtTime(volume * 0.5, noteStart + noteLength * 0.7);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteLength + 0.15);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.3;

      osc.connect(noteGain);
      osc2.connect(osc2Gain);
      osc2Gain.connect(noteGain);
      noteGain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + noteLength + 0.2);
      osc2.start(noteStart);
      osc2.stop(noteStart + noteLength + 0.2);
    }

    // Final chord sustain for the last note
    const finalChordStart = now + notes.length * noteLength - 0.05;
    const chordOsc1 = ctx.createOscillator();
    const chordOsc2 = ctx.createOscillator();
    const chordOsc3 = ctx.createOscillator();

    chordOsc1.type = 'sine';
    chordOsc2.type = 'sine';
    chordOsc3.type = 'sine';

    // C major chord (C, E, G)
    chordOsc1.frequency.value = 1046.5; // C6
    chordOsc2.frequency.value = 1318.51; // E6
    chordOsc3.frequency.value = 1567.98; // G6

    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0, finalChordStart);
    chordGain.gain.linearRampToValueAtTime(volume * 0.4, finalChordStart + 0.05);
    chordGain.gain.exponentialRampToValueAtTime(0.001, finalChordStart + 0.5);

    chordOsc1.connect(chordGain);
    chordOsc2.connect(chordGain);
    chordOsc3.connect(chordGain);
    chordGain.connect(ctx.destination);

    chordOsc1.start(finalChordStart);
    chordOsc2.start(finalChordStart);
    chordOsc3.start(finalChordStart);
    chordOsc1.stop(finalChordStart + 0.6);
    chordOsc2.stop(finalChordStart + 0.6);
    chordOsc3.stop(finalChordStart + 0.6);
  }

  /**
   * Generate audio log pickup - ethereal data collection sound
   */
  generateAudioLogPickup(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const tones = FREQUENCIES.audioLogNotes;

    for (let i = 0; i < tones.length; i++) {
      const startTime = now + i * 0.08;

      // Main sine tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = tones[i];

      // Envelope
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * (0.5 + i * 0.15), startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    }

    // Add a shimmering overtone
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 1760; // A6

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.15);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    shimmer.start(now);
    shimmer.stop(now + 0.55);
  }

  /**
   * Generate secret area discovery sound - mysterious chord
   */
  generateSecretFound(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const notes = FREQUENCIES.secretNotes;

    for (let i = 0; i < notes.length; i++) {
      const startTime = now + i * 0.1;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = notes[i] * 2; // Octave above for shimmer

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.5, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.2;

      osc.connect(gain);
      osc2.connect(osc2Gain);
      osc2Gain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.7);
      osc2.start(startTime);
      osc2.stop(startTime + 0.7);
    }
  }

  /**
   * Dispose of audio context
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
