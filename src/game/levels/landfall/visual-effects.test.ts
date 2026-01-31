/**
 * Visual Effects Unit Tests
 *
 * Tests for descent particle effects, atmosphere visuals, and wind streaks.
 *
 * Target coverage: 95% line, 90% branch
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  updateVisualEffects,
  stopAllDescentEffects,
  disposeDescentEffects,
  type DescentEffects,
  type DescentState,
  type EffectUpdateContext,
} from './visual-effects';
import type { DropPhase } from './types';

// ---------------------------------------------------------------------------
// Mock Setup
// ---------------------------------------------------------------------------

// Mock the halo-drop module using vi.hoisted
const { mockUpdateWindStreaks } = vi.hoisted(() => {
  const mockUpdateWindStreaks = vi.fn();
  return { mockUpdateWindStreaks };
});

vi.mock('./halo-drop', () => ({
  updateWindStreaks: mockUpdateWindStreaks,
}));

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

const createMockParticleSystem = () => ({
  emitRate: 0,
  isStarted: vi.fn(() => false),
  start: vi.fn(),
  stop: vi.fn(),
  dispose: vi.fn(),
});

const createMockMesh = () => ({
  isVisible: true,
  scaling: {
    setAll: vi.fn(),
  },
  material: {
    alpha: 0,
    emissiveColor: new Color3(0, 0, 0),
  },
  dispose: vi.fn(),
});

const createMockEffects = (): DescentEffects => ({
  reentryParticles: createMockParticleSystem() as any,
  playerSmokeTrail: createMockParticleSystem() as any,
  atmosphereStreaks: createMockParticleSystem() as any,
  thrusterExhaustParticles: createMockParticleSystem() as any,
  plasmaGlow: createMockMesh() as any,
  heatDistortion: createMockMesh() as any,
  windStreaks: [createMockMesh() as any, createMockMesh() as any],
});

const createMockState = (overrides?: Partial<DescentState>): DescentState => ({
  altitude: 500,
  velocity: 50,
  fuel: 100,
  lateralVelocityX: 0,
  lateralVelocityZ: 0,
  windIntensity: 0,
  ...overrides,
});

const createMockContext = (
  phase: DropPhase,
  effects: DescentEffects,
  state: DescentState
): EffectUpdateContext => ({
  phase,
  effects,
  state,
  inputTracker: {
    isActionActive: vi.fn(() => false),
  },
  setBaseShake: vi.fn(),
});

// ---------------------------------------------------------------------------
// updateVisualEffects Tests
// ---------------------------------------------------------------------------

describe('updateVisualEffects', () => {
  describe('Freefall Phases', () => {
    it('should update smoke trail intensity based on velocity', () => {
      const effects = createMockEffects();
      const state = createMockState({ velocity: 60 });
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.playerSmokeTrail!.emitRate).toBeGreaterThan(0);
    });

    it('should update atmosphere streaks based on altitude', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 400 });
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.atmosphereStreaks!.emitRate).toBeGreaterThan(30);
    });

    it('should start reentry particles during atmosphere entry', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 500 }); // Below 700, atmosphere entry
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.reentryParticles!.start).toHaveBeenCalled();
    });

    it('should update plasma glow alpha during atmosphere entry', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 500 });
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      const material = effects.plasmaGlow!.material as any;
      expect(material.alpha).toBeGreaterThan(0);
    });

    it('should trigger shake during atmosphere entry', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 400 }); // Deep in atmosphere
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(ctx.setBaseShake).toHaveBeenCalled();
    });

    it('should update wind streaks', () => {
      mockUpdateWindStreaks.mockClear();
      const effects = createMockEffects();
      const state = createMockState();
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(mockUpdateWindStreaks).toHaveBeenCalled();
    });

    it('should decay wind intensity over time', () => {
      const effects = createMockEffects();
      const state = createMockState({ windIntensity: 1.0 });
      const ctx = createMockContext('freefall_belt', effects, state);

      const result = updateVisualEffects(ctx, 0.016);

      expect(result.newWindIntensity).toBeLessThan(1.0);
    });

    it('should handle freefall_start phase', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 900 });
      const ctx = createMockContext('freefall_start', effects, state);

      const result = updateVisualEffects(ctx, 0.016);

      expect(result.newWindIntensity).toBeDefined();
    });

    it('should handle freefall_clear phase', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 600 });
      const ctx = createMockContext('freefall_clear', effects, state);

      const result = updateVisualEffects(ctx, 0.016);

      expect(result.newWindIntensity).toBeDefined();
    });
  });

  describe('Powered Descent Phase', () => {
    it('should reduce smoke trail emission', () => {
      const effects = createMockEffects();
      const state = createMockState();
      const ctx = createMockContext('powered_descent', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.playerSmokeTrail!.emitRate).toBe(10);
    });

    it('should stop reentry particles', () => {
      const effects = createMockEffects();
      (effects.reentryParticles!.isStarted as any).mockReturnValue(true);
      const state = createMockState();
      const ctx = createMockContext('powered_descent', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.reentryParticles!.stop).toHaveBeenCalled();
    });

    it('should increase thruster exhaust when boosting', () => {
      const effects = createMockEffects();
      const state = createMockState({ fuel: 100 });
      const ctx = createMockContext('powered_descent', effects, state);
      (ctx.inputTracker.isActionActive as any).mockReturnValue(true);

      updateVisualEffects(ctx, 0.016);

      expect(effects.thrusterExhaustParticles!.emitRate).toBe(200);
    });

    it('should reduce thruster exhaust when not boosting', () => {
      const effects = createMockEffects();
      const state = createMockState();
      const ctx = createMockContext('powered_descent', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.thrusterExhaustParticles!.emitRate).toBe(30);
    });

    it('should hide wind streaks', () => {
      const effects = createMockEffects();
      const state = createMockState();
      const ctx = createMockContext('powered_descent', effects, state);

      updateVisualEffects(ctx, 0.016);

      for (const streak of effects.windStreaks) {
        expect(streak.isVisible).toBe(false);
      }
    });
  });

  describe('Landing Phase', () => {
    it('should handle landing phase same as powered descent', () => {
      const effects = createMockEffects();
      const state = createMockState();
      const ctx = createMockContext('landing', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.playerSmokeTrail!.emitRate).toBe(10);
    });
  });

  describe('Surface Phase', () => {
    it('should stop all descent effects', () => {
      const effects = createMockEffects();
      const state = createMockState();
      const ctx = createMockContext('surface', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.playerSmokeTrail!.stop).toHaveBeenCalled();
      expect(effects.atmosphereStreaks!.stop).toHaveBeenCalled();
    });
  });

  describe('Heat Distortion Effect', () => {
    it('should update heat distortion during freefall_belt', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 600 });
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      const material = effects.heatDistortion!.material as any;
      expect(material.alpha).toBeGreaterThan(0);
    });

    it('should update heat distortion during freefall_clear', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 500 });
      const ctx = createMockContext('freefall_clear', effects, state);

      updateVisualEffects(ctx, 0.016);

      const material = effects.heatDistortion!.material as any;
      expect(material.alpha).toBeGreaterThan(0);
    });

    it('should scale heat distortion based on intensity', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 400 });
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      expect(effects.heatDistortion!.scaling.setAll).toHaveBeenCalled();
    });

    it('should pulse heat emissive color', () => {
      const effects = createMockEffects();
      const state = createMockState({ altitude: 500 });
      const ctx = createMockContext('freefall_belt', effects, state);

      updateVisualEffects(ctx, 0.016);

      const material = effects.heatDistortion!.material as any;
      expect(material.emissiveColor).toBeDefined();
    });
  });

  describe('Null Safety', () => {
    it('should handle null particle systems', () => {
      const effects: DescentEffects = {
        reentryParticles: null,
        playerSmokeTrail: null,
        atmosphereStreaks: null,
        thrusterExhaustParticles: null,
        plasmaGlow: null,
        heatDistortion: null,
        windStreaks: [],
      };
      const state = createMockState();
      const ctx = createMockContext('freefall_belt', effects, state);

      // Should not throw
      const result = updateVisualEffects(ctx, 0.016);
      expect(result.newWindIntensity).toBeDefined();
    });

    it('should handle null meshes', () => {
      const effects: DescentEffects = {
        reentryParticles: createMockParticleSystem() as any,
        playerSmokeTrail: createMockParticleSystem() as any,
        atmosphereStreaks: createMockParticleSystem() as any,
        thrusterExhaustParticles: createMockParticleSystem() as any,
        plasmaGlow: null,
        heatDistortion: null,
        windStreaks: [],
      };
      const state = createMockState({ altitude: 500 });
      const ctx = createMockContext('freefall_belt', effects, state);

      // Should not throw
      const result = updateVisualEffects(ctx, 0.016);
      expect(result.newWindIntensity).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// stopAllDescentEffects Tests
// ---------------------------------------------------------------------------

describe('stopAllDescentEffects', () => {
  it('should stop all particle systems', () => {
    const effects = createMockEffects();

    stopAllDescentEffects(effects);

    expect(effects.playerSmokeTrail!.stop).toHaveBeenCalled();
    expect(effects.atmosphereStreaks!.stop).toHaveBeenCalled();
    expect(effects.reentryParticles!.stop).toHaveBeenCalled();
    expect(effects.thrusterExhaustParticles!.stop).toHaveBeenCalled();
  });

  it('should hide plasma glow', () => {
    const effects = createMockEffects();

    stopAllDescentEffects(effects);

    expect(effects.plasmaGlow!.isVisible).toBe(false);
  });

  it('should hide heat distortion', () => {
    const effects = createMockEffects();

    stopAllDescentEffects(effects);

    expect(effects.heatDistortion!.isVisible).toBe(false);
  });

  it('should hide all wind streaks', () => {
    const effects = createMockEffects();

    stopAllDescentEffects(effects);

    for (const streak of effects.windStreaks) {
      expect(streak.isVisible).toBe(false);
    }
  });

  it('should handle null particle systems', () => {
    const effects: DescentEffects = {
      reentryParticles: null,
      playerSmokeTrail: null,
      atmosphereStreaks: null,
      thrusterExhaustParticles: null,
      plasmaGlow: createMockMesh() as any,
      heatDistortion: createMockMesh() as any,
      windStreaks: [],
    };

    // Should not throw
    stopAllDescentEffects(effects);
  });

  it('should handle null meshes', () => {
    const effects: DescentEffects = {
      reentryParticles: createMockParticleSystem() as any,
      playerSmokeTrail: createMockParticleSystem() as any,
      atmosphereStreaks: createMockParticleSystem() as any,
      thrusterExhaustParticles: createMockParticleSystem() as any,
      plasmaGlow: null,
      heatDistortion: null,
      windStreaks: [],
    };

    // Should not throw
    stopAllDescentEffects(effects);
  });

  it('should handle empty wind streaks array', () => {
    const effects = createMockEffects();
    effects.windStreaks = [];

    // Should not throw
    stopAllDescentEffects(effects);
  });
});

// ---------------------------------------------------------------------------
// disposeDescentEffects Tests
// ---------------------------------------------------------------------------

describe('disposeDescentEffects', () => {
  it('should dispose all particle systems', () => {
    const effects = createMockEffects();

    disposeDescentEffects(effects);

    expect(effects.reentryParticles!.dispose).toHaveBeenCalled();
    expect(effects.playerSmokeTrail!.dispose).toHaveBeenCalled();
    expect(effects.atmosphereStreaks!.dispose).toHaveBeenCalled();
    expect(effects.thrusterExhaustParticles!.dispose).toHaveBeenCalled();
  });

  it('should dispose all wind streaks', () => {
    const effects = createMockEffects();

    disposeDescentEffects(effects);

    for (const streak of effects.windStreaks) {
      expect(streak.dispose).toHaveBeenCalled();
    }
  });

  it('should handle null particle systems', () => {
    const effects: DescentEffects = {
      reentryParticles: null,
      playerSmokeTrail: null,
      atmosphereStreaks: null,
      thrusterExhaustParticles: null,
      plasmaGlow: null,
      heatDistortion: null,
      windStreaks: [],
    };

    // Should not throw
    disposeDescentEffects(effects);
  });

  it('should handle empty wind streaks array', () => {
    const effects = createMockEffects();
    effects.windStreaks = [];

    // Should not throw
    disposeDescentEffects(effects);
  });
});

// ---------------------------------------------------------------------------
// Effect Intensity Tests
// ---------------------------------------------------------------------------

describe('Effect Intensity Calculations', () => {
  it('should scale effects based on altitude', () => {
    const highAltitudeEffects = createMockEffects();
    const lowAltitudeEffects = createMockEffects();

    const highAltitudeCtx = createMockContext(
      'freefall_belt',
      highAltitudeEffects,
      createMockState({ altitude: 800 })
    );

    const lowAltitudeCtx = createMockContext(
      'freefall_belt',
      lowAltitudeEffects,
      createMockState({ altitude: 300 })
    );

    updateVisualEffects(highAltitudeCtx, 0.016);
    updateVisualEffects(lowAltitudeCtx, 0.016);

    // Lower altitude should have more intense effects
    expect(lowAltitudeEffects.atmosphereStreaks!.emitRate).toBeGreaterThan(
      highAltitudeEffects.atmosphereStreaks!.emitRate
    );
  });

  it('should scale smoke based on velocity', () => {
    const slowEffects = createMockEffects();
    const fastEffects = createMockEffects();

    const slowCtx = createMockContext(
      'freefall_belt',
      slowEffects,
      createMockState({ velocity: 20 })
    );

    const fastCtx = createMockContext(
      'freefall_belt',
      fastEffects,
      createMockState({ velocity: 80 })
    );

    updateVisualEffects(slowCtx, 0.016);
    updateVisualEffects(fastCtx, 0.016);

    // Faster velocity should have more smoke
    expect(fastEffects.playerSmokeTrail!.emitRate).toBeGreaterThan(
      slowEffects.playerSmokeTrail!.emitRate
    );
  });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Visual Effects Integration', () => {
  it('should transition effects between phases', () => {
    const effects = createMockEffects();
    const state = createMockState({ altitude: 500 });

    // Freefall
    const freefallCtx = createMockContext('freefall_belt', effects, state);
    updateVisualEffects(freefallCtx, 0.016);
    expect(effects.atmosphereStreaks!.emitRate).toBeGreaterThan(0);

    // Powered descent
    const poweredCtx = createMockContext('powered_descent', effects, state);
    updateVisualEffects(poweredCtx, 0.016);
    expect(effects.playerSmokeTrail!.emitRate).toBe(10);

    // Surface
    const surfaceCtx = createMockContext('surface', effects, state);
    updateVisualEffects(surfaceCtx, 0.016);
    expect(effects.playerSmokeTrail!.stop).toHaveBeenCalled();
  });

  it('should handle full descent sequence', () => {
    const effects = createMockEffects();

    // Simulate full descent with decreasing altitude
    const altitudes = [1000, 800, 600, 400, 200, 50, 0];
    const phases: DropPhase[] = [
      'freefall_start',
      'freefall_belt',
      'freefall_belt',
      'freefall_clear',
      'powered_descent',
      'landing',
      'surface',
    ];

    for (let i = 0; i < altitudes.length; i++) {
      const state = createMockState({ altitude: altitudes[i] });
      const ctx = createMockContext(phases[i], effects, state);

      // Should not throw
      updateVisualEffects(ctx, 0.016);
    }
  });
});
