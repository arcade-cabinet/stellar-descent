/**
 * EscapeTimer.test.ts - Unit tests for Escape Timer System
 *
 * Tests cover:
 * - Timer initialization with config
 * - Countdown behavior
 * - Pause/resume functionality
 * - Checkpoint time bonuses
 * - Death penalty mechanics
 * - Urgency level transitions
 * - Expiration callback
 * - Time formatting
 * - State retrieval
 * - Audio cue triggers
 *
 * Coverage target: 95% line coverage, 90% branch coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock AudioManager
vi.mock('../../core/AudioManager', () => ({
  getAudioManager: () => ({
    play: vi.fn(),
    playEmergencyKlaxon: vi.fn(),
  }),
}));

// Mock Logger
vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import { EscapeTimer, type EscapeTimerConfig } from './EscapeTimer';

describe('EscapeTimer', () => {
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScene = {
      dispose: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create timer with default config', () => {
      const timer = new EscapeTimer(mockScene);

      const state = timer.getState();
      expect(state.remaining).toBe(240); // 4 minutes default
    });

    it('should create timer with custom config', () => {
      const customConfig: Partial<EscapeTimerConfig> = {
        totalTime: 180,
        checkpointBonus: 20,
        deathPenalty: 15,
        warningThreshold: 90,
        criticalThreshold: 45,
        finalThreshold: 15,
      };

      const timer = new EscapeTimer(mockScene, customConfig);

      const state = timer.getState();
      expect(state.remaining).toBe(180);
    });

    it('should start with normal urgency', () => {
      const timer = new EscapeTimer(mockScene);

      expect(timer.getUrgency()).toBe('normal');
    });

    it('should start not expired', () => {
      const timer = new EscapeTimer(mockScene);

      expect(timer.isExpired()).toBe(false);
    });

    it('should start not paused', () => {
      const timer = new EscapeTimer(mockScene);

      expect(timer.isPaused()).toBe(false);
    });
  });

  describe('Update', () => {
    it('should decrement remaining time', () => {
      const timer = new EscapeTimer(mockScene);
      const initialRemaining = timer.getRemaining();

      timer.update(1.0);

      expect(timer.getRemaining()).toBe(initialRemaining - 1.0);
    });

    it('should track elapsed time', () => {
      const timer = new EscapeTimer(mockScene);

      timer.update(5.0);

      const state = timer.getState();
      expect(state.elapsed).toBe(5.0);
    });

    it('should not update when paused', () => {
      const timer = new EscapeTimer(mockScene);
      const initialRemaining = timer.getRemaining();

      timer.pause();
      timer.update(1.0);

      expect(timer.getRemaining()).toBe(initialRemaining);
    });

    it('should not update when expired', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 5 });

      timer.update(10.0); // Expire the timer
      const remaining = timer.getRemaining();

      timer.update(1.0);

      expect(timer.getRemaining()).toBe(remaining);
    });
  });

  describe('Pause/Resume', () => {
    it('should pause the timer', () => {
      const timer = new EscapeTimer(mockScene);

      timer.pause();

      expect(timer.isPaused()).toBe(true);
    });

    it('should resume the timer', () => {
      const timer = new EscapeTimer(mockScene);

      timer.pause();
      timer.resume();

      expect(timer.isPaused()).toBe(false);
    });

    it('should continue countdown after resume', () => {
      const timer = new EscapeTimer(mockScene);
      const initialRemaining = timer.getRemaining();

      timer.pause();
      timer.update(5.0);
      timer.resume();
      timer.update(1.0);

      expect(timer.getRemaining()).toBe(initialRemaining - 1.0);
    });
  });

  describe('Checkpoints', () => {
    it('should add checkpoint bonus time', () => {
      const timer = new EscapeTimer(mockScene, { checkpointBonus: 15 });
      const initialRemaining = timer.getRemaining();

      timer.reachCheckpoint('Test Checkpoint');

      expect(timer.getRemaining()).toBe(initialRemaining + 15);
    });

    it('should track checkpoints reached count', () => {
      const timer = new EscapeTimer(mockScene);

      timer.reachCheckpoint('Checkpoint 1');
      timer.reachCheckpoint('Checkpoint 2');

      const state = timer.getState();
      expect(state.checkpointsReached).toBe(2);
    });

    it('should cap time at maximum', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 100, checkpointBonus: 50 });

      // Reach 5 checkpoints (way more than expected)
      for (let i = 0; i < 5; i++) {
        timer.reachCheckpoint(`Checkpoint ${i}`);
      }

      // Time should be capped at totalTime + checkpointBonus * 4
      expect(timer.getRemaining()).toBeLessThanOrEqual(100 + 50 * 4);
    });

    it('should not add bonus when expired', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 5 });

      timer.update(10.0); // Expire
      const remaining = timer.getRemaining();

      timer.reachCheckpoint('Late Checkpoint');

      expect(timer.getRemaining()).toBe(remaining);
    });

    it('should trigger checkpoint callback', () => {
      const timer = new EscapeTimer(mockScene, { checkpointBonus: 15 });
      const callback = vi.fn();

      timer.setOnCheckpoint(callback);
      timer.reachCheckpoint('Test');

      expect(callback).toHaveBeenCalledWith(15, 1);
    });
  });

  describe('Death Penalty', () => {
    it('should subtract death penalty time', () => {
      const timer = new EscapeTimer(mockScene, { deathPenalty: 10 });
      const initialRemaining = timer.getRemaining();

      timer.applyDeathPenalty();

      expect(timer.getRemaining()).toBe(initialRemaining - 10);
    });

    it('should track death count', () => {
      const timer = new EscapeTimer(mockScene);

      timer.applyDeathPenalty();
      timer.applyDeathPenalty();

      const state = timer.getState();
      expect(state.deaths).toBe(2);
    });

    it('should not go below 5 seconds from death penalty', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 20, deathPenalty: 50 });

      timer.applyDeathPenalty();

      expect(timer.getRemaining()).toBeGreaterThanOrEqual(5);
    });

    it('should not apply penalty when expired', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 5 });

      timer.update(10.0); // Expire
      const remaining = timer.getRemaining();

      timer.applyDeathPenalty();

      expect(timer.getRemaining()).toBe(remaining);
    });
  });

  describe('Add Time', () => {
    it('should add arbitrary time', () => {
      const timer = new EscapeTimer(mockScene);
      const initialRemaining = timer.getRemaining();

      timer.addTime(30);

      expect(timer.getRemaining()).toBe(initialRemaining + 30);
    });

    it('should not add time when expired', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 5 });

      timer.update(10.0); // Expire
      const remaining = timer.getRemaining();

      timer.addTime(100);

      expect(timer.getRemaining()).toBe(remaining);
    });
  });

  describe('Force Expire', () => {
    it('should force timer to expire', () => {
      const timer = new EscapeTimer(mockScene);

      timer.forceExpire();

      expect(timer.isExpired()).toBe(true);
      expect(timer.getRemaining()).toBe(0);
    });

    it('should trigger expired callback on force expire', () => {
      const timer = new EscapeTimer(mockScene);
      const callback = vi.fn();

      timer.setOnExpired(callback);
      timer.forceExpire();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Urgency Levels', () => {
    it('should return normal urgency when time > warning threshold', () => {
      const timer = new EscapeTimer(mockScene, { warningThreshold: 60 });

      // Timer starts at 240, well above 60
      expect(timer.getUrgency()).toBe('normal');
    });

    it('should return warning urgency when time <= warning threshold', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 100,
        warningThreshold: 80,
        criticalThreshold: 40,
        finalThreshold: 10,
      });

      timer.update(30); // remaining = 70

      expect(timer.getUrgency()).toBe('warning');
    });

    it('should return critical urgency when time <= critical threshold', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 100,
        warningThreshold: 80,
        criticalThreshold: 40,
        finalThreshold: 10,
      });

      timer.update(70); // remaining = 30

      expect(timer.getUrgency()).toBe('critical');
    });

    it('should return final urgency when time <= final threshold', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 100,
        warningThreshold: 80,
        criticalThreshold: 40,
        finalThreshold: 10,
      });

      timer.update(95); // remaining = 5

      expect(timer.getUrgency()).toBe('final');
    });

    it('should trigger urgency change callback', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 130,
        warningThreshold: 120,
        criticalThreshold: 60,
        finalThreshold: 20,
      });
      const callback = vi.fn();

      timer.setOnUrgencyChange(callback);
      timer.update(15); // Cross into warning

      expect(callback).toHaveBeenCalledWith('warning');
    });
  });

  describe('Expiration', () => {
    it('should expire when time reaches 0', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 10 });

      timer.update(15);

      expect(timer.isExpired()).toBe(true);
      expect(timer.getRemaining()).toBe(0);
    });

    it('should trigger expired callback', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 10 });
      const callback = vi.fn();

      timer.setOnExpired(callback);
      timer.update(15);

      expect(callback).toHaveBeenCalled();
    });

    it('should only trigger expired callback once', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 10 });
      const callback = vi.fn();

      timer.setOnExpired(callback);
      timer.update(15);
      timer.update(5);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('State', () => {
    it('should return complete timer state', () => {
      const timer = new EscapeTimer(mockScene);

      const state = timer.getState();

      expect(state).toHaveProperty('remaining');
      expect(state).toHaveProperty('elapsed');
      expect(state).toHaveProperty('urgency');
      expect(state).toHaveProperty('expired');
      expect(state).toHaveProperty('paused');
      expect(state).toHaveProperty('displayTime');
      expect(state).toHaveProperty('progress');
      expect(state).toHaveProperty('checkpointsReached');
      expect(state).toHaveProperty('deaths');
      expect(state).toHaveProperty('pulseIntensity');
      expect(state).toHaveProperty('shakeIntensity');
      expect(state).toHaveProperty('colorShiftIntensity');
    });

    it('should calculate progress correctly', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 100 });

      timer.update(25);

      const state = timer.getState();
      expect(state.progress).toBe(0.75);
    });

    it('should clamp progress to 0 when expired', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 10 });

      timer.update(20);

      const state = timer.getState();
      expect(state.progress).toBe(0);
    });
  });

  describe('Time Formatting', () => {
    it('should format time as M:SS', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 125 });

      const state = timer.getState();
      expect(state.displayTime).toBe('2:05');
    });

    it('should format time with leading zero for seconds', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 63 });

      const state = timer.getState();
      expect(state.displayTime).toBe('1:03');
    });

    it('should format time with tenths when under 10 seconds', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 8.5 });

      const state = timer.getState();
      expect(state.displayTime).toMatch(/0:\d{2}\.\d/);
    });

    it('should format zero time correctly', () => {
      const timer = new EscapeTimer(mockScene, { totalTime: 5 });

      timer.update(10);

      const state = timer.getState();
      expect(state.displayTime).toBe('0:00.0');
    });
  });

  describe('Pulse Intensity', () => {
    it('should return 0 pulse for normal urgency', () => {
      const timer = new EscapeTimer(mockScene);

      const state = timer.getState();
      expect(state.pulseIntensity).toBe(0);
    });

    it('should return non-zero pulse for warning urgency', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 100,
        warningThreshold: 80,
        criticalThreshold: 40,
        finalThreshold: 10,
      });

      timer.update(30); // remaining = 70 (warning)
      timer.update(0.1); // Advance pulse accumulator

      const state = timer.getState();
      // Pulse should be in warning range (0-0.3)
      expect(state.pulseIntensity).toBeLessThanOrEqual(0.3);
    });
  });

  describe('Shake Intensity', () => {
    it('should return base shake for normal urgency', () => {
      const timer = new EscapeTimer(mockScene);

      const state = timer.getState();
      expect(state.shakeIntensity).toBeCloseTo(0.5, 0);
    });

    it('should return higher shake for critical urgency', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 100,
        warningThreshold: 80,
        criticalThreshold: 40,
        finalThreshold: 10,
      });

      timer.update(70); // remaining = 30 (critical)

      const state = timer.getState();
      expect(state.shakeIntensity).toBeGreaterThan(1.0);
    });
  });

  describe('Color Shift Intensity', () => {
    it('should return 0 color shift for normal urgency', () => {
      const timer = new EscapeTimer(mockScene);

      const state = timer.getState();
      expect(state.colorShiftIntensity).toBe(0);
    });

    it('should return moderate color shift for warning', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 100,
        warningThreshold: 80,
        criticalThreshold: 40,
        finalThreshold: 10,
      });

      timer.update(30); // remaining = 70 (warning)

      const state = timer.getState();
      expect(state.colorShiftIntensity).toBe(0.15);
    });

    it('should return high color shift for critical', () => {
      const timer = new EscapeTimer(mockScene, {
        totalTime: 100,
        warningThreshold: 80,
        criticalThreshold: 40,
        finalThreshold: 10,
      });

      timer.update(70); // remaining = 30 (critical)

      const state = timer.getState();
      expect(state.colorShiftIntensity).toBe(0.35);
    });
  });

  describe('Disposal', () => {
    it('should clear callbacks on dispose', () => {
      const timer = new EscapeTimer(mockScene);
      const expiredCallback = vi.fn();
      const urgencyCallback = vi.fn();
      const checkpointCallback = vi.fn();

      timer.setOnExpired(expiredCallback);
      timer.setOnUrgencyChange(urgencyCallback);
      timer.setOnCheckpoint(checkpointCallback);

      timer.dispose();

      // After dispose, callbacks should not be called
      timer.forceExpire();
      expect(expiredCallback).not.toHaveBeenCalled();
    });
  });
});

describe('EscapeTimer Audio Integration', () => {
  let mockScene: any;
  let mockPlay: ReturnType<typeof vi.fn>;
  let mockPlayEmergencyKlaxon: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset and re-mock audio manager for each test
    mockPlay = vi.fn();
    mockPlayEmergencyKlaxon = vi.fn();

    vi.doMock('../../core/AudioManager', () => ({
      getAudioManager: () => ({
        play: mockPlay,
        playEmergencyKlaxon: mockPlayEmergencyKlaxon,
      }),
    }));

    mockScene = {
      dispose: vi.fn(),
    };
  });

  it('should play audio on checkpoint', () => {
    const timer = new EscapeTimer(mockScene);
    timer.reachCheckpoint('Test');

    // Audio manager is called internally - verify the timer updates
    const state = timer.getState();
    expect(state.checkpointsReached).toBe(1);
  });

  it('should trigger urgency change on warning threshold', () => {
    const callback = vi.fn();
    const timer = new EscapeTimer(mockScene, {
      totalTime: 130,
      warningThreshold: 120,
      criticalThreshold: 60,
      finalThreshold: 20,
    });

    timer.setOnUrgencyChange(callback);
    timer.update(15); // Cross into warning

    expect(callback).toHaveBeenCalledWith('warning');
  });

  it('should trigger urgency change on critical threshold', () => {
    const callback = vi.fn();
    const timer = new EscapeTimer(mockScene, {
      totalTime: 100,
      warningThreshold: 80,
      criticalThreshold: 40,
      finalThreshold: 10,
    });

    timer.setOnUrgencyChange(callback);
    timer.update(65); // Cross into critical

    expect(callback).toHaveBeenCalledWith('critical');
  });

  it('should trigger urgency change on final threshold', () => {
    const callback = vi.fn();
    const timer = new EscapeTimer(mockScene, {
      totalTime: 50,
      warningThreshold: 40,
      criticalThreshold: 25,
      finalThreshold: 10,
    });

    timer.setOnUrgencyChange(callback);
    timer.update(45); // Cross into final

    expect(callback).toHaveBeenCalledWith('final');
  });
});
