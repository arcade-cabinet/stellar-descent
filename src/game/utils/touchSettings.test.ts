/**
 * Tests for touch control settings utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyAccelerationCurve,
  applyDeadZone,
  DEFAULT_TOUCH_SETTINGS,
  GestureDetector,
  LookSmoother,
  loadTouchSettings,
  resetTouchSettings,
  saveTouchSettings,
} from './touchSettings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Touch Settings', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('loadTouchSettings', () => {
    it('returns defaults when no saved settings', () => {
      const settings = loadTouchSettings();
      expect(settings).toEqual(DEFAULT_TOUCH_SETTINGS);
    });

    it('loads saved settings from localStorage', () => {
      const customSettings = { ...DEFAULT_TOUCH_SETTINGS, lookSensitivity: 2.0 };
      localStorageMock.setItem('stellar-descent-touch-settings', JSON.stringify(customSettings));

      const settings = loadTouchSettings();
      expect(settings.lookSensitivity).toBe(2.0);
    });

    it('merges new defaults with saved settings', () => {
      const partialSettings = { lookSensitivity: 1.5 };
      localStorageMock.setItem('stellar-descent-touch-settings', JSON.stringify(partialSettings));

      const settings = loadTouchSettings();
      expect(settings.lookSensitivity).toBe(1.5);
      expect(settings.hapticFeedback).toBe(DEFAULT_TOUCH_SETTINGS.hapticFeedback);
    });
  });

  describe('saveTouchSettings', () => {
    it('saves settings to localStorage', () => {
      const settings = { ...DEFAULT_TOUCH_SETTINGS, invertedY: true };
      saveTouchSettings(settings);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'stellar-descent-touch-settings',
        JSON.stringify(settings)
      );
    });
  });

  describe('resetTouchSettings', () => {
    it('resets to defaults and saves', () => {
      const settings = resetTouchSettings();
      expect(settings).toEqual(DEFAULT_TOUCH_SETTINGS);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
});

describe('applyAccelerationCurve', () => {
  it('returns 0 for 0 input', () => {
    expect(applyAccelerationCurve(0)).toBe(0);
  });

  it('returns 1 for 1 input with any exponent', () => {
    expect(applyAccelerationCurve(1, 1.5)).toBe(1);
    expect(applyAccelerationCurve(1, 2.0)).toBe(1);
  });

  it('applies curve correctly for positive values', () => {
    // With exponent 2, 0.5 should become 0.25
    expect(applyAccelerationCurve(0.5, 2)).toBeCloseTo(0.25);
  });

  it('preserves sign for negative values', () => {
    expect(applyAccelerationCurve(-0.5, 2)).toBeCloseTo(-0.25);
  });
});

describe('applyDeadZone', () => {
  it('returns 0 for values within dead zone', () => {
    expect(applyDeadZone(0.1, 0.15)).toBe(0);
    expect(applyDeadZone(-0.1, 0.15)).toBe(0);
  });

  it('scales values above dead zone', () => {
    // With dead zone 0.2, value 0.6 should map to (0.6-0.2)/(1-0.2) = 0.5
    expect(applyDeadZone(0.6, 0.2)).toBeCloseTo(0.5);
  });

  it('returns 1 for max value', () => {
    expect(applyDeadZone(1, 0.2)).toBeCloseTo(1);
  });

  it('preserves sign for negative values', () => {
    expect(applyDeadZone(-0.6, 0.2)).toBeCloseTo(-0.5);
  });
});

describe('LookSmoother', () => {
  it('smooths rapid changes', () => {
    const smoother = new LookSmoother(0.5);

    // First value
    const result1 = smoother.smooth(1, 0);
    expect(result1.x).toBe(0.5); // 0 * 0.5 + 1 * 0.5

    // Second value continues smoothing
    const result2 = smoother.smooth(1, 0);
    expect(result2.x).toBe(0.75); // 0.5 * 0.5 + 1 * 0.5
  });

  it('reset clears history', () => {
    const smoother = new LookSmoother(0.5);

    smoother.smooth(1, 1);
    smoother.reset();

    // After reset, should start fresh
    const result = smoother.smooth(1, 0);
    expect(result.x).toBe(0.5);
    expect(result.y).toBe(0);
  });
});

describe('GestureDetector', () => {
  it('detects double tap', () => {
    const detector = new GestureDetector();

    // First tap
    const result1 = detector.onTouchStart(100, 100);
    expect(result1.doubleTapDetected).toBe(false);

    // Second tap within threshold
    const result2 = detector.onTouchStart(105, 105);
    expect(result2.doubleTapDetected).toBe(true);
  });

  it('does not detect double tap if too far apart', () => {
    const detector = new GestureDetector();

    detector.onTouchStart(100, 100);

    // Too far away
    const result = detector.onTouchStart(200, 200);
    expect(result.doubleTapDetected).toBe(false);
  });

  it('detects horizontal swipe', () => {
    const detector = new GestureDetector();

    detector.onTouchStart(100, 100);

    // Swipe right
    const result = detector.onTouchEnd(200, 100);
    expect(result.swipeDirection).toBe('right');
  });

  it('detects vertical swipe', () => {
    const detector = new GestureDetector();

    detector.onTouchStart(100, 100);

    // Swipe down
    const result = detector.onTouchEnd(100, 200);
    expect(result.swipeDirection).toBe('down');
  });

  it('does not detect swipe for small movements', () => {
    const detector = new GestureDetector();

    detector.onTouchStart(100, 100);

    // Small movement
    const result = detector.onTouchEnd(110, 110);
    expect(result.swipeDirection).toBeNull();
  });
});
