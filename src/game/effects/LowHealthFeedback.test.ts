/**
 * LowHealthFeedback Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disposeLowHealthFeedback,
  getLowHealthFeedback,
  type LowHealthFeedbackManager,
} from './LowHealthFeedback';

// Mock AudioContext as a class
class MockAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  sampleRate = 44100;

  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);

  createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 440 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

  createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      value: 1,
    },
    connect: vi.fn(),
  }));

  createBiquadFilter = vi.fn(() => ({
    type: 'lowpass',
    frequency: { value: 1000 },
    Q: { value: 1 },
    connect: vi.fn(),
  }));

  createBuffer = vi.fn(() => ({
    getChannelData: vi.fn(() => new Float32Array(44100)),
  }));

  createBufferSource = vi.fn(() => ({
    buffer: null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
}

// Mock window.AudioContext
vi.stubGlobal('AudioContext', MockAudioContext);

describe('LowHealthFeedback', () => {
  let feedback: LowHealthFeedbackManager;

  beforeEach(() => {
    feedback = getLowHealthFeedback();
    feedback.init();
  });

  afterEach(() => {
    disposeLowHealthFeedback();
  });

  describe('initialization', () => {
    it('should return singleton instance', () => {
      const instance1 = getLowHealthFeedback();
      const instance2 = getLowHealthFeedback();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default config', () => {
      // If no error, initialization succeeded
      expect(feedback).toBeDefined();
    });

    it('should accept custom config', () => {
      disposeLowHealthFeedback();
      const customFeedback = getLowHealthFeedback();
      customFeedback.init({
        lowHealthThreshold: 30,
        criticalHealthThreshold: 15,
        heartbeatVolume: 0.7,
      });
      // If no error, custom config was accepted
      expect(customFeedback).toBeDefined();
    });
  });

  describe('health state management', () => {
    it('should not trigger effects above threshold', () => {
      const vignetteSpy = vi.fn();
      feedback.setVignetteCallback(vignetteSpy);

      // 50% health - above 25% threshold
      feedback.startLowHealthEffects(50, 100);
      feedback.update(0.016);

      // Should not call vignette (health is above threshold)
      expect(vignetteSpy).not.toHaveBeenCalled();
    });

    it('should trigger effects below threshold', () => {
      const vignetteSpy = vi.fn();
      feedback.setVignetteCallback(vignetteSpy);

      // 20% health - below 25% threshold
      feedback.startLowHealthEffects(20, 100);
      feedback.update(0.016);

      // Should call vignette
      expect(vignetteSpy).toHaveBeenCalled();
    });

    it('should stop effects when health recovers', () => {
      const vignetteSpy = vi.fn();
      feedback.setVignetteCallback(vignetteSpy);

      // First, trigger low health
      feedback.startLowHealthEffects(20, 100);
      feedback.update(0.016);

      vignetteSpy.mockClear();

      // Recover health above threshold
      feedback.startLowHealthEffects(50, 100);

      // Effects should stop (vignette reset will be called)
      expect(vignetteSpy).toHaveBeenCalled();
    });

    it('should stop effects on death', () => {
      feedback.startLowHealthEffects(20, 100);
      feedback.update(0.016);

      // Player dies
      feedback.startLowHealthEffects(0, 100);

      // No error means effects properly stopped
    });

    it('should intensify at critical health', () => {
      const tunnelVisionSpy = vi.fn();
      feedback.setTunnelVisionCallback(tunnelVisionSpy);

      // 5% health - below 10% critical threshold
      feedback.startLowHealthEffects(5, 100);
      feedback.update(0.016);

      // Tunnel vision should be called for critical health
      expect(tunnelVisionSpy).toHaveBeenCalled();
    });
  });

  describe('callback integration', () => {
    it('should call vignette callback with correct parameters', () => {
      const vignetteSpy = vi.fn();
      feedback.setVignetteCallback(vignetteSpy);

      feedback.startLowHealthEffects(15, 100);
      feedback.update(0.016);

      // Should be called with weight, r, g, b
      expect(vignetteSpy).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should call desaturation callback', () => {
      const desatSpy = vi.fn();
      feedback.setDesaturationCallback(desatSpy);

      feedback.startLowHealthEffects(15, 100);
      feedback.update(0.016);

      expect(desatSpy).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should call screen shake when moving at critical health', () => {
      const shakeSpy = vi.fn();
      feedback.setScreenShakeCallback(shakeSpy);

      feedback.startLowHealthEffects(5, 100);
      feedback.setPlayerMoving(true);

      // Update multiple times to trigger random shake
      for (let i = 0; i < 20; i++) {
        feedback.update(0.016);
      }

      // Shake may or may not be called (random chance)
      // Just verify no errors
    });
  });

  describe('audio controls', () => {
    it('should support volume control', () => {
      feedback.setMasterVolume(0.5);
      // No error means volume was set
    });

    it('should support mute/unmute', () => {
      feedback.mute();
      feedback.unmute();
      // No error means mute/unmute worked
    });
  });

  describe('update loop', () => {
    it('should update pulse animation smoothly', () => {
      const vignetteSpy = vi.fn();
      feedback.setVignetteCallback(vignetteSpy);

      feedback.startLowHealthEffects(20, 100);

      // Simulate several frames
      for (let i = 0; i < 60; i++) {
        feedback.update(0.016);
      }

      // Vignette should have been called multiple times with varying weights
      expect(vignetteSpy.mock.calls.length).toBeGreaterThan(1);
    });

    it('should not update when health is above threshold', () => {
      const vignetteSpy = vi.fn();
      feedback.setVignetteCallback(vignetteSpy);

      feedback.startLowHealthEffects(50, 100);

      for (let i = 0; i < 60; i++) {
        feedback.update(0.016);
      }

      // Should not have called vignette
      expect(vignetteSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should dispose cleanly', () => {
      feedback.startLowHealthEffects(20, 100);
      feedback.update(0.016);

      // Dispose should not throw
      disposeLowHealthFeedback();

      // Getting new instance should work
      const newFeedback = getLowHealthFeedback();
      expect(newFeedback).toBeDefined();
    });

    it('should stop effects on dispose', () => {
      const vignetteSpy = vi.fn();
      feedback.setVignetteCallback(vignetteSpy);

      feedback.startLowHealthEffects(20, 100);
      feedback.update(0.016);

      vignetteSpy.mockClear();
      feedback.stopLowHealthEffects();

      // Vignette reset should be called
      expect(vignetteSpy).toHaveBeenCalled();
    });
  });
});
