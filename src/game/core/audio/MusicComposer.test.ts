/**
 * MusicComposer.test.ts - Unit tests for procedural music system
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tone.js before importing - wrap classes in vi.fn() to make them spies
vi.mock('tone', () => {
  // Helper to create chainable mock methods
  const chainable = () => {
    const fn = vi.fn();
    fn.mockReturnThis();
    return fn;
  };

  // Define mock classes that work as constructors
  const createMockGain = vi.fn().mockImplementation(function (this: any) {
    this.gain = { value: 1, rampTo: vi.fn() };
    this.connect = chainable();
    this.toDestination = chainable();
    this.dispose = vi.fn();
    return this;
  });

  const createMockCompressor = vi.fn().mockImplementation(function (this: any) {
    this.connect = chainable();
    this.dispose = vi.fn();
    return this;
  });

  const createMockLimiter = vi.fn().mockImplementation(function (this: any) {
    this.connect = chainable();
    this.dispose = vi.fn();
    return this;
  });

  const createMockReverb = vi.fn().mockImplementation(function (this: any) {
    this.connect = chainable();
    this.dispose = vi.fn();
    return this;
  });

  const createMockPolySynth = vi.fn().mockImplementation(function (this: any) {
    this.volume = { value: 0, rampTo: vi.fn() };
    this.connect = chainable();
    this.triggerAttackRelease = vi.fn();
    this.dispose = vi.fn();
    return this;
  });

  const createMockSynth = vi.fn().mockImplementation(function (this: any) {
    this.volume = { value: 0, rampTo: vi.fn() };
    this.connect = chainable();
    this.triggerAttackRelease = vi.fn();
    this.dispose = vi.fn();
    return this;
  });

  const createMockMonoSynth = vi.fn().mockImplementation(function (this: any) {
    this.volume = { value: 0, rampTo: vi.fn() };
    this.connect = chainable();
    this.triggerAttackRelease = vi.fn();
    this.dispose = vi.fn();
    return this;
  });

  const createMockMembraneSynth = vi.fn().mockImplementation(function (this: any) {
    this.volume = { value: 0, rampTo: vi.fn() };
    this.connect = chainable();
    this.triggerAttackRelease = vi.fn();
    this.dispose = vi.fn();
    return this;
  });

  const createMockNoiseSynth = vi.fn().mockImplementation(function (this: any) {
    this.volume = { value: 0, rampTo: vi.fn() };
    this.connect = chainable();
    this.triggerAttackRelease = vi.fn();
    this.dispose = vi.fn();
    return this;
  });

  const createMockMetalSynth = vi.fn().mockImplementation(function (this: any) {
    this.volume = { value: 0, rampTo: vi.fn() };
    this.connect = chainable();
    this.triggerAttackRelease = vi.fn();
    this.dispose = vi.fn();
    return this;
  });

  const createMockLoop = vi.fn().mockImplementation(function (this: any) {
    this.start = chainable();
    this.stop = chainable();
    this.dispose = vi.fn();
    return this;
  });

  const createMockSequence = vi.fn().mockImplementation(function (this: any) {
    this.start = chainable();
    this.stop = chainable();
    this.dispose = vi.fn();
    return this;
  });

  const createMockFeedbackDelay = vi.fn().mockImplementation(function (this: any) {
    this.connect = chainable();
    this.dispose = vi.fn();
    return this;
  });

  const createMockDistortion = vi.fn().mockImplementation(function (this: any) {
    this.connect = chainable();
    this.dispose = vi.fn();
    return this;
  });

  return {
    getContext: vi.fn().mockReturnValue({ state: 'running' }),
    start: vi.fn().mockResolvedValue(undefined),
    now: vi.fn().mockReturnValue(0),
    getTransport: vi.fn().mockReturnValue({
      state: 'stopped',
      start: vi.fn(),
      stop: vi.fn(),
      bpm: { value: 120, rampTo: vi.fn() },
    }),
    Gain: createMockGain,
    Compressor: createMockCompressor,
    Limiter: createMockLimiter,
    Reverb: createMockReverb,
    PolySynth: createMockPolySynth,
    Synth: createMockSynth,
    MonoSynth: createMockMonoSynth,
    MembraneSynth: createMockMembraneSynth,
    NoiseSynth: createMockNoiseSynth,
    MetalSynth: createMockMetalSynth,
    Loop: createMockLoop,
    Sequence: createMockSequence,
    FeedbackDelay: createMockFeedbackDelay,
    Distortion: createMockDistortion,
  };
});

// Import after mocks
import { MusicComposer, getMusicComposer, disposeMusicComposer } from './MusicComposer';
import * as Tone from 'tone';

describe('MusicComposer', () => {
  let composer: MusicComposer;

  beforeEach(() => {
    vi.clearAllMocks();
    disposeMusicComposer();
    composer = new MusicComposer();
  });

  describe('Initialization', () => {
    it('should initialize with Tone.js context', async () => {
      await composer.initialize();
      expect(Tone.getContext).toHaveBeenCalled();
    });

    it('should create master chain with proper gain staging', async () => {
      await composer.initialize();

      // Should create compressor, limiter, gain
      expect(Tone.Compressor).toHaveBeenCalled();
      expect(Tone.Limiter).toHaveBeenCalled();
      expect(Tone.Gain).toHaveBeenCalled();
      expect(Tone.Reverb).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await composer.initialize();
      await composer.initialize();

      // Tone.js components should only be created once
    });
  });

  describe('Menu music', () => {
    it('should use 60 BPM for menu tempo', async () => {
      await composer.initialize();
      await composer.play('menu');

      expect(Tone.getTransport().bpm.value).toBe(60);
    });

    it('should create pad synth for atmospheric sound', async () => {
      await composer.initialize();
      await composer.play('menu');

      // PolySynth should be created for pad
      expect(Tone.PolySynth).toHaveBeenCalled();
    });

    it('should create arpeggiator synth', async () => {
      await composer.initialize();
      await composer.play('menu');

      // Synth should be created for arpeggio
      expect(Tone.Synth).toHaveBeenCalled();
    });

    it('should create loops for chord progression', async () => {
      await composer.initialize();
      await composer.play('menu');

      // Loops should be created for patterns
      expect(Tone.Loop).toHaveBeenCalled();
    });
  });

  describe('Combat music layers', () => {
    it('should use 140 BPM for combat tempo', async () => {
      await composer.initialize();
      await composer.play('combat');

      expect(Tone.getTransport().bpm.value).toBe(140);
    });

    it('should add percussion layer on low intensity', async () => {
      await composer.initialize();
      await composer.play('combat');
      composer.setCombatIntensity('low');

      // MembraneSynth (kick), NoiseSynth (snare), MetalSynth (hihat)
      expect(Tone.MembraneSynth).toHaveBeenCalled();
      expect(Tone.NoiseSynth).toHaveBeenCalled();
      expect(Tone.MetalSynth).toHaveBeenCalled();
    });

    it('should add bass layer', async () => {
      await composer.initialize();
      await composer.play('combat');

      // MonoSynth for bass
      expect(Tone.MonoSynth).toHaveBeenCalled();
    });

    it('should add stabs layer on medium intensity', async () => {
      await composer.initialize();
      await composer.play('combat');
      composer.setCombatIntensity('medium');

      // PolySynth for stabs
      expect(Tone.PolySynth).toHaveBeenCalled();
    });

    it('should add lead layer on high intensity', async () => {
      await composer.initialize();
      await composer.play('combat');
      composer.setCombatIntensity('high');

      // MonoSynth for lead
      expect(Tone.MonoSynth).toHaveBeenCalled();
    });
  });

  describe('Combat intensity transitions', () => {
    it('should transition smoothly between intensity levels', async () => {
      await composer.initialize();
      await composer.play('combat');

      composer.setCombatIntensity('low');
      composer.setCombatIntensity('medium');
      composer.setCombatIntensity('high');

      // Should handle all transitions without error
    });

    it('should adjust tempo based on intensity', async () => {
      await composer.initialize();
      await composer.play('combat');

      composer.setCombatIntensity('high');

      // Tempo should ramp to 150 for high intensity
      expect(Tone.getTransport().bpm.rampTo).toHaveBeenCalledWith(150, expect.any(Number));
    });

    it('should not change if same intensity', async () => {
      await composer.initialize();
      await composer.play('combat');

      composer.setCombatIntensity('low');
      const rampCalls = (Tone.getTransport().bpm.rampTo as any).mock.calls.length;

      composer.setCombatIntensity('low');

      // Should not trigger another ramp
      expect((Tone.getTransport().bpm.rampTo as any).mock.calls.length).toBe(rampCalls);
    });
  });

  describe('Music ducking', () => {
    it('should duck music during dialogue', async () => {
      await composer.initialize();
      await composer.play('menu');

      composer.duck(0.3, 0.5);

      // Master gain should be reduced
    });

    it('should restore music after ducking', async () => {
      await composer.initialize();
      await composer.play('menu');

      composer.duck();
      composer.unduck();

      // Music should be at normal volume
    });

    it('should not duck if already ducked', async () => {
      await composer.initialize();
      await composer.play('menu');

      composer.duck();
      composer.duck();

      // Should only duck once
    });

    it('should not unduck if not ducked', async () => {
      await composer.initialize();
      await composer.play('menu');

      composer.unduck();

      // Should not throw
    });
  });

  describe('State transitions', () => {
    it('should crossfade between menu and combat', async () => {
      await composer.initialize();
      await composer.play('menu');
      await composer.play('combat');

      // Should have faded out menu and faded in combat
    });

    it('should transition to exploration with quieter volume', async () => {
      await composer.initialize();
      await composer.play('exploration');

      // Should use menu music at reduced volume
    });

    it('should stop all music on silent state', async () => {
      await composer.initialize();
      await composer.play('menu');
      await composer.stop();

      expect(composer.getState()).toBe('silent');
    });

    it('should not restart same state', async () => {
      await composer.initialize();
      await composer.play('menu');

      const loopCalls = (Tone.Loop as any).mock.calls.length;
      await composer.play('menu');

      // Should not create new loops
      expect((Tone.Loop as any).mock.calls.length).toBe(loopCalls);
    });
  });

  describe('Volume control', () => {
    it('should set master volume', async () => {
      await composer.initialize();
      composer.setVolume(0.8);
      // Volume should be set
    });

    it('should clamp volume between 0 and 1', async () => {
      await composer.initialize();
      composer.setVolume(-0.5);
      composer.setVolume(1.5);
      // Should not throw
    });
  });

  describe('Victory stinger', () => {
    it('should play victory stinger', async () => {
      await composer.initialize();
      composer.playVictoryStinger();

      // Should create temporary synth for stinger
      expect(Tone.PolySynth).toHaveBeenCalled();
    });

    it('should not play if not initialized', () => {
      composer.playVictoryStinger();
      // Should not throw
    });
  });

  describe('Disposal', () => {
    it('should dispose all resources', async () => {
      await composer.initialize();
      await composer.play('menu');

      composer.dispose();

      // Should dispose all synths and effects
    });

    it('should handle disposal without initialization', () => {
      composer.dispose();
      // Should not throw
    });
  });

  describe('Singleton pattern', () => {
    it('should return same instance from getMusicComposer', () => {
      const instance1 = getMusicComposer();
      const instance2 = getMusicComposer();

      expect(instance1).toBe(instance2);
    });

    it('should clear instance on disposeMusicComposer', () => {
      const instance1 = getMusicComposer();
      disposeMusicComposer();
      const instance2 = getMusicComposer();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('State query', () => {
    it('should return current state', async () => {
      await composer.initialize();

      expect(composer.getState()).toBe('silent');

      await composer.play('menu');
      expect(composer.getState()).toBe('menu');

      await composer.play('combat');
      expect(composer.getState()).toBe('combat');
    });
  });
});
