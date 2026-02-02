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

  // ============================================================================
  // ENHANCED UI SOUNDS
  // ============================================================================

  /**
   * Generate objective complete jingle - major chord arpeggio
   */
  generateObjectiveComplete(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // C major arpeggio: C4, E4, G4, C5
    const notes = [261.63, 329.63, 392.0, 523.25];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const startTime = now + i * 0.1;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.6, startTime + 0.02);
      gain.gain.setValueAtTime(volume * 0.5, startTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });

    // Final chord
    const chordStart = now + 0.5;
    const chordFreqs = [261.63, 329.63, 392.0, 523.25];
    chordFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, chordStart);
      gain.gain.linearRampToValueAtTime(volume * 0.4, chordStart + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, chordStart + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(chordStart);
      osc.stop(chordStart + 0.7);
    });
  }

  /**
   * Generate pickup sound - sparkle + bass
   */
  generatePickupSound(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Sparkle high tones
    const sparkleFreqs = [1500, 2000, 2500];
    sparkleFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const startTime = now + i * 0.05;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });

    // Bass thump
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(200, now);
    bass.frequency.exponentialRampToValueAtTime(100, now + 0.1);

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(volume * 0.5, now);
    bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    bass.connect(bassGain);
    bassGain.connect(ctx.destination);

    bass.start(now);
    bass.stop(now + 0.15);
  }

  /**
   * Generate low health heartbeat - LFO-modulated bass
   */
  generateHeartbeat(volume = 0.3): { stop: () => void } {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Main heartbeat oscillator
    const heart = ctx.createOscillator();
    heart.type = 'sine';
    heart.frequency.value = 60;

    // LFO for pulsing
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.2; // ~72 BPM heartbeat

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = volume;

    lfo.connect(lfoGain);

    const heartGain = ctx.createGain();
    heartGain.gain.value = 0;
    lfoGain.connect(heartGain.gain);

    // Sub bass for weight
    const subBass = ctx.createOscillator();
    subBass.type = 'sine';
    subBass.frequency.value = 30;

    const subGain = ctx.createGain();
    subGain.gain.value = 0;
    lfoGain.connect(subGain.gain);

    // Connect to destination
    heart.connect(heartGain);
    heartGain.connect(ctx.destination);

    subBass.connect(subGain);
    subGain.connect(ctx.destination);

    // Start
    lfo.start(now);
    heart.start(now);
    subBass.start(now);

    // Return stop function
    return {
      stop: () => {
        heartGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        setTimeout(() => {
          lfo.stop();
          heart.stop();
          subBass.stop();
        }, 400);
      },
    };
  }

  /**
   * Generate shield break - glass shatter with resonance
   */
  generateShieldBreak(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Glass shatter noise burst
    const shatterBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const shatterData = shatterBuffer.getChannelData(0);
    for (let i = 0; i < shatterData.length; i++) {
      shatterData[i] = Math.random() * 2 - 1;
    }
    const shatter = ctx.createBufferSource();
    shatter.buffer = shatterBuffer;

    const shatterFilter = ctx.createBiquadFilter();
    shatterFilter.type = 'highpass';
    shatterFilter.frequency.setValueAtTime(4000, now);
    shatterFilter.frequency.exponentialRampToValueAtTime(1000, now + 0.2);

    const shatterGain = ctx.createGain();
    shatterGain.gain.setValueAtTime(volume, now);
    shatterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Resonant ring (like glass)
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3000, now);
    ring.frequency.exponentialRampToValueAtTime(1500, now + 0.3);

    const ring2 = ctx.createOscillator();
    ring2.type = 'sine';
    ring2.frequency.setValueAtTime(4500, now);
    ring2.frequency.exponentialRampToValueAtTime(2000, now + 0.25);

    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(volume * 0.3, now);
    ringGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    // Low impact
    const impact = ctx.createOscillator();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(150, now);
    impact.frequency.exponentialRampToValueAtTime(50, now + 0.15);

    const impactGain = ctx.createGain();
    impactGain.gain.setValueAtTime(volume * 0.5, now);
    impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Connect
    shatter.connect(shatterFilter);
    shatterFilter.connect(shatterGain);
    shatterGain.connect(ctx.destination);

    ring.connect(ringGain);
    ring2.connect(ringGain);
    ringGain.connect(ctx.destination);

    impact.connect(impactGain);
    impactGain.connect(ctx.destination);

    // Play
    shatter.start(now);
    shatter.stop(now + 0.3);
    ring.start(now);
    ring.stop(now + 0.4);
    ring2.start(now);
    ring2.stop(now + 0.35);
    impact.start(now);
    impact.stop(now + 0.25);
  }

  /**
   * Generate shield recharge sound
   */
  generateShieldRecharge(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Rising shimmer
    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(800, now);
    shimmer.frequency.exponentialRampToValueAtTime(2000, now + 0.4);

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, now);
    shimmerGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.1);
    shimmerGain.gain.setValueAtTime(volume * 0.35, now + 0.35);
    shimmerGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    // Energy hum
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 200;

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.setValueAtTime(300, now);
    humFilter.frequency.exponentialRampToValueAtTime(800, now + 0.4);

    const humGain = ctx.createGain();
    humGain.gain.setValueAtTime(0, now);
    humGain.gain.linearRampToValueAtTime(volume * 0.2, now + 0.15);
    humGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    // Connect
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    hum.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(ctx.destination);

    // Play
    shimmer.start(now);
    shimmer.stop(now + 0.55);
    hum.start(now);
    hum.stop(now + 0.55);
  }

  /**
   * Generate alert/warning sound
   */
  generateAlert(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Two-tone alert
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const startTime = now + i * 0.3;
      osc.frequency.setValueAtTime(800, startTime);
      osc.frequency.setValueAtTime(1200, startTime + 0.1);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
      gain.gain.setValueAtTime(volume, startTime + 0.09);
      gain.gain.linearRampToValueAtTime(volume * 0.6, startTime + 0.1);
      gain.gain.setValueAtTime(volume * 0.6, startTime + 0.19);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    }
  }

  /**
   * Generate countdown tick sound
   */
  generateCountdownTick(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const tick = ctx.createOscillator();
    tick.type = 'sine';
    tick.frequency.value = 1000;

    const tickGain = ctx.createGain();
    tickGain.gain.setValueAtTime(volume, now);
    tickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    tick.connect(tickGain);
    tickGain.connect(ctx.destination);

    tick.start(now);
    tick.stop(now + 0.08);
  }

  /**
   * Generate level complete fanfare
   */
  generateLevelComplete(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Victory arpeggio (D major: D, F#, A, D)
    const notes = [293.66, 369.99, 440.0, 587.33];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2; // Octave above

      const gain = ctx.createGain();
      const startTime = now + i * 0.12;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.6, startTime + 0.02);
      gain.gain.setValueAtTime(volume * 0.5, startTime + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

      const gain2 = ctx.createGain();
      gain2.gain.value = 0.3;

      osc.connect(gain);
      osc2.connect(gain2);
      gain2.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
      osc2.start(startTime);
      osc2.stop(startTime + 0.4);
    });

    // Final triumphant chord
    const chordStart = now + 0.6;
    const chordFreqs = [293.66, 369.99, 440.0, 587.33, 880.0];

    chordFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, chordStart);
      gain.gain.linearRampToValueAtTime(volume * 0.4, chordStart + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, chordStart + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(chordStart);
      osc.stop(chordStart + 1.3);
    });
  }

  /**
   * Generate death sound
   */
  generateDeathSound(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low drone
    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(100, now);
    drone.frequency.exponentialRampToValueAtTime(40, now + 1);

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 200;

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0, now);
    droneGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.1);
    droneGain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    // Heartbeat fade
    const heart = ctx.createOscillator();
    heart.type = 'sine';
    heart.frequency.value = 50;

    const heartLfo = ctx.createOscillator();
    heartLfo.type = 'sine';
    heartLfo.frequency.setValueAtTime(1.2, now);
    heartLfo.frequency.exponentialRampToValueAtTime(0.5, now + 1);

    const heartLfoGain = ctx.createGain();
    heartLfoGain.gain.value = volume * 0.3;

    heartLfo.connect(heartLfoGain);

    const heartGain = ctx.createGain();
    heartGain.gain.value = 0;
    heartLfoGain.connect(heartGain.gain);

    const heartFade = ctx.createGain();
    heartFade.gain.setValueAtTime(1, now);
    heartFade.gain.exponentialRampToValueAtTime(0.01, now + 1);

    // Connect
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ctx.destination);

    heart.connect(heartGain);
    heartGain.connect(heartFade);
    heartFade.connect(ctx.destination);

    // Play
    drone.start(now);
    drone.stop(now + 1.3);
    heartLfo.start(now);
    heartLfo.stop(now + 1.1);
    heart.start(now);
    heart.stop(now + 1.1);
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
