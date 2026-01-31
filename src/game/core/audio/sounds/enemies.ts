/**
 * Enemy Sound Generators
 * Procedural audio for alien enemies (screams, footsteps, attacks)
 */

import { FREQUENCIES, LFO_RATES } from '../constants';

/**
 * Enemy Sound Generator class
 * Generates procedural sounds for alien/enemy-related effects
 */
export class EnemySoundGenerator {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Generate enemy death screech
   */
  generateEnemyDeath(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Descending pitch screech
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);

    // Second oscillator for texture
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(400 + Math.random() * 100, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.25);

    // Noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 1;

    // Gains
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    // Connect
    osc.connect(mainGain);
    osc2.connect(mainGain);
    mainGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    // Play
    osc.start(now);
    osc.stop(now + 0.4);
    osc2.start(now);
    osc2.stop(now + 0.35);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  /**
   * Generate alien screech (hostile alert)
   */
  generateAlienScreech(volume = 0.3): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Ascending then descending pitch
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(FREQUENCIES.alienScreechLow, now);
    osc.frequency.exponentialRampToValueAtTime(FREQUENCIES.alienScreechHigh, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.4);

    // Modulation for organic feel
    const lfo = ctx.createOscillator();
    lfo.frequency.value = LFO_RATES.alienVibrato + Math.random() * 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.setValueAtTime(volume, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
    lfo.start(now);
    lfo.stop(now + 0.55);
  }

  /**
   * Generate alien growl (ambient threat)
   */
  generateAlienGrowl(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low rumbling growl
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(FREQUENCIES.alienGrowlBase + Math.random() * 40, now);
    osc.frequency.linearRampToValueAtTime(60 + Math.random() * 20, now + 0.8);

    // Formant filter for throat-like sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200;
    filter.Q.value = 3;

    // LFO for tremolo
    const lfo = ctx.createOscillator();
    lfo.frequency.value = LFO_RATES.growlTremolo + Math.random() * 4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.1);
    gain.gain.setValueAtTime(volume, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1);

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.1);
    lfo.start(now);
    lfo.stop(now + 1.1);
  }

  /**
   * Generate hive pulse (organic ambient)
   */
  generateHivePulse(volume = 0.15): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Slow pulsing bass
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 40;

    // Sub bass
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 25;

    // Pulse LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = LFO_RATES.hivePulse;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = volume;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    lfo.start(now);

    const duration = 2 + Math.random();
    setTimeout(() => {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      setTimeout(() => {
        osc.stop();
        subOsc.stop();
        lfo.stop();
      }, 600);
    }, duration * 1000);
  }

  /**
   * Generate organic squish sound
   */
  generateOrganicSquish(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Filtered noise burst
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.25);
  }

  /**
   * Generate alien footstep - light skittering sound
   */
  generateAlienFootstep(volume = 0.2): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Quick click/tap sound
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400 + Math.random() * 200, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

    // Noise for texture
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
    noise.start(now);
    noise.stop(now + 0.04);
  }

  /**
   * Generate alien attack sound - aggressive hiss/screech
   */
  generateAlienAttack(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Sharp attack screech
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300 + Math.random() * 100, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);

    // Modulation for organic texture
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 40 + Math.random() * 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Noise burst for "spit" effect
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    noiseFilter.Q.value = 2;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.02);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
    lfo.start(now);
    lfo.stop(now + 0.3);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  /**
   * Generate alien spawn sound - wet emergence
   */
  generateAlienSpawn(volume = 0.4): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low rumble for emergence
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);

    // Wet squelch noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(300, now + 0.4);
    noiseFilter.Q.value = 3;

    // Rising "emergence" tone
    const riseOsc = ctx.createOscillator();
    riseOsc.type = 'sawtooth';
    riseOsc.frequency.setValueAtTime(80, now + 0.1);
    riseOsc.frequency.exponentialRampToValueAtTime(200, now + 0.4);

    const riseFilter = ctx.createBiquadFilter();
    riseFilter.type = 'bandpass';
    riseFilter.frequency.value = 150;
    riseFilter.Q.value = 2;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(volume * 0.6, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const riseGain = ctx.createGain();
    riseGain.gain.setValueAtTime(0, now);
    riseGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.2);
    riseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    riseOsc.connect(riseFilter);
    riseFilter.connect(riseGain);
    riseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
    noise.start(now);
    noise.stop(now + 0.45);
    riseOsc.start(now + 0.1);
    riseOsc.stop(now + 0.5);
  }

  /**
   * Generate alien alert sound - sharp warning screech
   */
  generateAlienAlert(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Two-part alert: quick rise then sustained
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);
    osc.frequency.setValueAtTime(500, now + 0.15);
    osc.frequency.linearRampToValueAtTime(400, now + 0.4);

    // Harmonic layer
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(200, now);
    osc2.frequency.exponentialRampToValueAtTime(900, now + 0.1);
    osc2.frequency.setValueAtTime(700, now + 0.15);

    // LFO for tremolo effect
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 25 + Math.random() * 15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.05);
    mainGain.gain.setValueAtTime(volume * 0.8, now + 0.15);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(volume * 0.3, now);
    osc2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(mainGain);
    mainGain.connect(ctx.destination);

    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
    osc2.start(now);
    osc2.stop(now + 0.3);
    lfo.start(now);
    lfo.stop(now + 0.5);
  }

  /**
   * Generate alien chittering - rapid clicking sounds (for skitterer type)
   */
  generateAlienChittering(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Rapid series of clicks
    const clickCount = 4 + Math.floor(Math.random() * 4);
    const clickDuration = 0.02;

    for (let i = 0; i < clickCount; i++) {
      const clickStart = now + i * clickDuration * 1.5 + Math.random() * 0.01;

      const click = ctx.createOscillator();
      click.type = 'square';
      click.frequency.setValueAtTime(800 + Math.random() * 600, clickStart);
      click.frequency.exponentialRampToValueAtTime(300, clickStart + clickDuration);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(volume * (0.7 + Math.random() * 0.3), clickStart);
      clickGain.gain.exponentialRampToValueAtTime(0.01, clickStart + clickDuration);

      click.connect(clickGain);
      clickGain.connect(ctx.destination);

      click.start(clickStart);
      click.stop(clickStart + clickDuration + 0.01);
    }
  }

  /**
   * Generate heavy alien step - for broodmother/large enemies
   */
  generateAlienHeavyStep(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep impact thud
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(40, now);
    thud.frequency.exponentialRampToValueAtTime(20, now + 0.3);

    // Secondary rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(60, now);
    rumble.frequency.exponentialRampToValueAtTime(25, now + 0.25);

    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 100;

    // Ground shake noise
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 200;
    noiseFilter.Q.value = 1;

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(volume, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(volume * 0.5, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    thud.connect(thudGain);
    thudGain.connect(ctx.destination);

    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    thud.start(now);
    thud.stop(now + 0.45);
    rumble.start(now);
    rumble.stop(now + 0.35);
    noise.start(now);
    noise.stop(now + 0.3);
  }

  /**
   * Generate acid spit sound - for spewer type
   */
  generateAlienAcidSpit(volume = 0.35): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Wet spray sound
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    noiseFilter.Q.value = 4;

    // Hissing undertone
    const hiss = ctx.createOscillator();
    hiss.type = 'sawtooth';
    hiss.frequency.setValueAtTime(150, now);
    hiss.frequency.exponentialRampToValueAtTime(80, now + 0.25);

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 200;
    hissFilter.Q.value = 2;

    // "Splat" at end
    const splat = ctx.createOscillator();
    splat.type = 'sine';
    splat.frequency.setValueAtTime(300, now + 0.15);
    splat.frequency.exponentialRampToValueAtTime(100, now + 0.25);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const hissGain = ctx.createGain();
    hissGain.gain.setValueAtTime(volume * 0.4, now);
    hissGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    const splatGain = ctx.createGain();
    splatGain.gain.setValueAtTime(0, now + 0.15);
    splatGain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.18);
    splatGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(ctx.destination);

    splat.connect(splatGain);
    splatGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.3);
    hiss.start(now);
    hiss.stop(now + 0.35);
    splat.start(now + 0.15);
    splat.stop(now + 0.3);
  }

  /**
   * Generate alien roar - for large enemies like broodmother
   */
  generateAlienRoar(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Deep rumbling roar
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(FREQUENCIES.alienRoarBase, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.2);
    osc.frequency.linearRampToValueAtTime(70, now + 0.6);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1);

    // Higher harmonic for presence
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(120, now);
    osc2.frequency.linearRampToValueAtTime(180, now + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.8);

    // Formant filter for throat-like quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.linearRampToValueAtTime(350, now + 0.3);
    filter.frequency.linearRampToValueAtTime(180, now + 0.8);
    filter.Q.value = 4;

    // LFO for tremolo/vibrato
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5 + Math.random() * 3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    // Noise for breath
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.1);
    mainGain.gain.setValueAtTime(volume, now + 0.7);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.setValueAtTime(volume * 0.25, now);
    osc2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

    osc.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(ctx.destination);

    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
    osc2.start(now);
    osc2.stop(now + 1);
    lfo.start(now);
    lfo.stop(now + 1.2);
    noise.start(now);
    noise.stop(now + 1);
  }

  /**
   * Generate alien hiss - short threatening sound
   */
  generateAlienHiss(volume = 0.25): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // White noise filtered to sound like hissing
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.2);
    noiseFilter.Q.value = 3;

    // Low undertone
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 200;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(volume, now + 0.02);
    noiseGain.gain.setValueAtTime(volume, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.35);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Generate alien death scream - agonized screech as hive dies
   */
  generateAlienDeathScream(volume = 0.5): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Main screech - descending pitch
    const screech = ctx.createOscillator();
    screech.type = 'sawtooth';
    screech.frequency.setValueAtTime(800 + Math.random() * 400, now);
    screech.frequency.exponentialRampToValueAtTime(300, now + 0.3);
    screech.frequency.exponentialRampToValueAtTime(100, now + 0.8);

    // Harmonic for alien quality
    const harmonic = ctx.createOscillator();
    harmonic.type = 'square';
    harmonic.frequency.setValueAtTime(1200 + Math.random() * 300, now);
    harmonic.frequency.exponentialRampToValueAtTime(400, now + 0.4);
    harmonic.frequency.exponentialRampToValueAtTime(150, now + 0.9);

    // Modulation for organic warble
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 20 + Math.random() * 15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 100;
    lfo.connect(lfoGain);
    lfoGain.connect(screech.frequency);
    lfoGain.connect(harmonic.frequency);

    // Formant filter for throat-like quality
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 3;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.05);
    mainGain.gain.setValueAtTime(volume * 0.7, now + 0.5);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 1);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.3;

    screech.connect(filter);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(ctx.destination);

    screech.start(now);
    screech.stop(now + 1.1);
    harmonic.start(now);
    harmonic.stop(now + 1);
    lfo.start(now);
    lfo.stop(now + 1.1);
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
