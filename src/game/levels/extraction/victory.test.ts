/**
 * ExtractionLevel - Victory Sequence Tests
 *
 * Unit tests for dropship arrival, boarding, and epilogue logic.
 * Target: 95%+ line coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn(),
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn(),
}));

vi.mock('@babylonjs/core/Maths/math.color', () => {
  class MockColor3 {
    r: number;
    g: number;
    b: number;
    constructor(r = 0, g = 0, b = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
  }
  class MockColor4 {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r = 0, g = 0, b = 0, a = 1) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
    }
    clone() {
      return new MockColor4(this.r, this.g, this.b, this.a);
    }
  }
  return { Color3: MockColor3, Color4: MockColor4 };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => ({
  Vector3: class MockVector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    clone() {
      return new MockVector3(this.x, this.y, this.z);
    }
  },
}));

vi.mock('@babylonjs/core/Animations/animation', () => ({
  Animation: class MockAnimation {
    setKeys = vi.fn();
    setEasingFunction = vi.fn();
    static ANIMATIONTYPE_FLOAT = 0;
    static ANIMATIONTYPE_VECTOR3 = 1;
    static ANIMATIONLOOPMODE_CONSTANT = 0;
  },
}));

vi.mock('@babylonjs/core/Animations/easing', () => ({
  CubicEase: class MockCubicEase {
    setEasingMode = vi.fn();
  },
  EasingFunction: {
    EASINGMODE_EASEOUT: 1,
  },
}));

vi.mock('../../achievements', () => ({
  getAchievementManager: vi.fn().mockReturnValue({
    onGameComplete: vi.fn(),
  }),
}));

vi.mock('../../core/AudioManager', () => ({
  getAudioManager: vi.fn().mockReturnValue({
    play: vi.fn(),
    playVictory: vi.fn(),
    playMusic: vi.fn(),
  }),
}));

vi.mock('../../core/Logger', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    emit: vi.fn(),
    emitDustImpact: vi.fn(),
  },
}));

vi.mock('../../persistence/SaveSystem', () => ({
  saveSystem: {
    completeLevel: vi.fn(),
    setObjective: vi.fn(),
  },
}));

vi.mock('./effects', () => ({
  emitLandingDust: vi.fn(),
  animateFadeToBlack: vi.fn().mockReturnValue(123),
}));

vi.mock('./enemies', () => ({
  clearAllEnemies: vi.fn().mockReturnValue(5),
}));

// Mock EventBus for testing event emissions
const mockEventBusEmit = vi.fn();
vi.mock('../../core/EventBus', () => ({
  getEventBus: () => ({
    emit: mockEventBusEmit,
    subscribe: vi.fn(() => vi.fn()),
  }),
  disposeEventBus: vi.fn(),
}));

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  animateDropshipApproach,
  animateDropshipLanding,
  animateRampOpening,
  createVictoryState,
  disposeVictoryState,
  showEpilogue,
  startDropshipArrival,
  startDropshipEngineSounds,
  startEngineThrustEffects,
  stopDropshipEngineSounds,
  stopEngineThrustEffects,
  type VictoryContext,
  type VictoryState,
} from './victory';

// Helper to create mock victory context
function createMockContext(): VictoryContext {
  return {
    scene: {
      beginAnimation: vi.fn(),
      clearColor: { r: 0, g: 0, b: 0, a: 1 },
    } as any,
    state: createVictoryState(),
    dropship: {
      setEnabled: vi.fn(),
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { y: 0 },
      animations: [],
    } as any,
    dropshipRamp: {
      rotation: { x: 0 },
      animations: [],
    } as any,
    dropshipRampLight: {
      intensity: 0,
    } as any,
    dropshipThrustEmitters: [
      { getAbsolutePosition: vi.fn().mockReturnValue({ clone: () => new Vector3() }) } as any,
    ],
    mechMesh: {
      setEnabled: vi.fn(),
    } as any,
    enemies: [],
    kills: 42,
    noDeathBonus: true,
    setBaseShake: vi.fn(),
    triggerShake: vi.fn(),
    setSurfaceVisible: vi.fn(),
    disposeCollapseResources: vi.fn(),
    onTransitionToEpilogue: vi.fn(),
    completeLevel: vi.fn(),
    setMechIntegrity: vi.fn(),
  };
}

describe('Victory Sequence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createVictoryState', () => {
    it('should create initial victory state', () => {
      const state = createVictoryState();

      expect(state.cinematic_active).toBe(false);
      expect(state.cinematic_beat).toBe(0);
      expect(state.timeouts).toEqual([]);
      expect(state.dropshipEngineSound).toBeNull();
      expect(state.engineThrustInterval).toBeNull();
    });
  });

  describe('Engine Sounds', () => {
    describe('startDropshipEngineSounds', () => {
      it('should start engine sound if procedural audio available', async () => {
        const AudioManagerModule = await import('../../core/AudioManager');
        const mockProceduralAudio = {
          generateDropshipEngine: vi.fn().mockReturnValue({ stop: vi.fn() }),
        };
        vi.mocked(AudioManagerModule.getAudioManager).mockReturnValueOnce({
          proceduralAudio: mockProceduralAudio,
          play: vi.fn(),
          playVictory: vi.fn(),
          playMusic: vi.fn(),
        } as any);

        const state = createVictoryState();
        startDropshipEngineSounds(state);

        expect(mockProceduralAudio.generateDropshipEngine).toHaveBeenCalledWith(0.4);
        expect(state.dropshipEngineSound).not.toBeNull();
      });

      it('should handle missing procedural audio gracefully', async () => {
        const AudioManagerModule = await import('../../core/AudioManager');
        vi.mocked(AudioManagerModule.getAudioManager).mockReturnValueOnce({
          play: vi.fn(),
          playVictory: vi.fn(),
          playMusic: vi.fn(),
        } as any);

        const state = createVictoryState();
        startDropshipEngineSounds(state);

        expect(state.dropshipEngineSound).toBeNull();
      });
    });

    describe('stopDropshipEngineSounds', () => {
      it('should stop engine sound if playing', () => {
        const mockStop = vi.fn();
        const state: VictoryState = {
          ...createVictoryState(),
          dropshipEngineSound: { stop: mockStop },
        };

        stopDropshipEngineSounds(state);

        expect(mockStop).toHaveBeenCalled();
        expect(state.dropshipEngineSound).toBeNull();
      });

      it('should handle null engine sound', () => {
        const state = createVictoryState();

        expect(() => stopDropshipEngineSounds(state)).not.toThrow();
      });
    });
  });

  describe('Engine Thrust Effects', () => {
    describe('startEngineThrustEffects', () => {
      it('should start interval for thrust particles', async () => {
        const state: VictoryState = {
          ...createVictoryState(),
          cinematic_active: true,
        };
        const dropship = {
          getAbsolutePosition: vi.fn().mockReturnValue({ clone: () => new Vector3() }),
        } as any;
        const thrustEmitters = [
          { getAbsolutePosition: vi.fn().mockReturnValue({ clone: () => new Vector3() }) } as any,
        ];

        startEngineThrustEffects(state, dropship, thrustEmitters);

        expect(state.engineThrustInterval).not.toBeNull();

        // Advance time to trigger interval
        vi.advanceTimersByTime(300);

        const ParticleManagerModule = await import('../../effects/ParticleManager');
        expect(ParticleManagerModule.particleManager.emit).toHaveBeenCalled();
      });

      it('should stop effects when cinematic inactive', () => {
        const state: VictoryState = {
          ...createVictoryState(),
          cinematic_active: false,
        };
        const thrustEmitters = [
          { getAbsolutePosition: vi.fn().mockReturnValue({ clone: () => new Vector3() }) } as any,
        ];

        startEngineThrustEffects(state, null, thrustEmitters);
        vi.advanceTimersByTime(300);

        expect(state.engineThrustInterval).toBeNull();
      });
    });

    describe('stopEngineThrustEffects', () => {
      it('should clear thrust interval', () => {
        const state: VictoryState = {
          ...createVictoryState(),
          engineThrustInterval: setInterval(() => {}, 1000),
        };

        stopEngineThrustEffects(state);

        expect(state.engineThrustInterval).toBeNull();
      });
    });
  });

  describe('Dropship Animations', () => {
    describe('animateDropshipApproach', () => {
      it('should animate dropship from start to end position', () => {
        const scene = { beginAnimation: vi.fn() } as any;
        const dropship = { animations: [] } as any;
        const setBaseShake = vi.fn();
        const onComplete = vi.fn();

        animateDropshipApproach(
          scene,
          dropship,
          new Vector3(100, 300, -400),
          new Vector3(0, 60, -550),
          8000,
          setBaseShake,
          onComplete
        );

        expect(dropship.animations.length).toBe(1);
        expect(scene.beginAnimation).toHaveBeenCalled();
        expect(setBaseShake).toHaveBeenCalledWith(1.5);
      });
    });

    describe('animateDropshipLanding', () => {
      it('should animate landing with dust effects', async () => {
        const scene = { beginAnimation: vi.fn() } as any;
        const dropship = { animations: [] } as any;
        const state: VictoryState = {
          ...createVictoryState(),
          cinematic_active: true,
        };
        const triggerShake = vi.fn();
        const onComplete = vi.fn();
        mockEventBusEmit.mockClear();

        animateDropshipLanding(
          scene,
          dropship,
          new Vector3(0, 60, -550),
          new Vector3(0, 6, -500),
          6000,
          state,
          triggerShake,
          onComplete
        );

        expect(state.cinematic_beat).toBe(2);
        expect(mockEventBusEmit).toHaveBeenCalledWith({
          type: 'NOTIFICATION',
          text: 'TOUCHDOWN IMMINENT',
          duration: 2000,
        });
        expect(scene.beginAnimation).toHaveBeenCalled();

        // Advance to trigger dust effects
        vi.advanceTimersByTime(2000);
        const effectsModule = await import('./effects');
        expect(effectsModule.emitLandingDust).toHaveBeenCalled();
      });
    });

    describe('animateRampOpening', () => {
      it('should animate ramp rotation', () => {
        const scene = { beginAnimation: vi.fn() } as any;
        const ramp = { animations: [] } as any;

        animateRampOpening(scene, ramp);

        expect(ramp.animations.length).toBe(1);
        expect(scene.beginAnimation).toHaveBeenCalled();
      });
    });
  });

  describe('startDropshipArrival', () => {
    it('should not start if dropship is null', () => {
      const ctx = createMockContext();
      ctx.dropship = null;

      startDropshipArrival(ctx);

      expect(ctx.state.cinematic_active).toBe(false);
    });

    it('should activate cinematic and show notifications', () => {
      const ctx = createMockContext();
      mockEventBusEmit.mockClear();

      startDropshipArrival(ctx);

      expect(ctx.state.cinematic_active).toBe(true);
      expect(mockEventBusEmit).toHaveBeenCalledWith({ type: 'CINEMATIC_START' });
      expect(ctx.disposeCollapseResources).toHaveBeenCalled();
      expect(mockEventBusEmit).toHaveBeenCalledWith({
        type: 'NOTIFICATION',
        text: 'CONTACT - INCOMING FRIENDLY',
        duration: 2000,
      });
    });

    it('should schedule comms messages', () => {
      const ctx = createMockContext();
      mockEventBusEmit.mockClear();

      startDropshipArrival(ctx);

      vi.advanceTimersByTime(300);
      expect(mockEventBusEmit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'COMMS_MESSAGE' })
      );

      vi.advanceTimersByTime(1500);
      // Check that COMMS_MESSAGE events were emitted multiple times
      const commsEvents = mockEventBusEmit.mock.calls.filter(
        (call) => call[0]?.type === 'COMMS_MESSAGE'
      );
      expect(commsEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should enable dropship and start approach after delay', () => {
      const ctx = createMockContext();

      startDropshipArrival(ctx);

      vi.advanceTimersByTime(2100);

      expect(ctx.dropship!.setEnabled).toHaveBeenCalledWith(true);
      expect(ctx.triggerShake).toHaveBeenCalled();
    });

    it('should clear enemies during cinematic', async () => {
      const enemiesModule = await import('./enemies');
      const ctx = createMockContext();

      startDropshipArrival(ctx);
      vi.advanceTimersByTime(2100);

      expect(enemiesModule.clearAllEnemies).toHaveBeenCalledWith(ctx.enemies);
    });
  });

  describe('showEpilogue', () => {
    it('should transition to epilogue state', () => {
      const ctx = createMockContext();
      ctx.state.cinematic_active = true;
      mockEventBusEmit.mockClear();

      showEpilogue(ctx, 'extraction');

      expect(ctx.state.cinematic_beat).toBe(5);
      expect(mockEventBusEmit).toHaveBeenCalledWith({
        type: 'COMBAT_STATE_CHANGED',
        inCombat: false,
      });
      expect(mockEventBusEmit).toHaveBeenCalledWith({ type: 'CINEMATIC_END' });
    });

    it('should play victory music and trigger achievements', async () => {
      const AudioManagerModule = await import('../../core/AudioManager');
      const AchievementModule = await import('../../achievements');
      const SaveSystemModule = await import('../../persistence/SaveSystem');

      const ctx = createMockContext();
      ctx.state.cinematic_active = true;

      showEpilogue(ctx, 'extraction');

      expect(AudioManagerModule.getAudioManager().playMusic).toHaveBeenCalledWith('victory', 2);
      expect(AchievementModule.getAchievementManager().onGameComplete).toHaveBeenCalled();
      expect(SaveSystemModule.saveSystem.completeLevel).toHaveBeenCalledWith('extraction');
      expect(SaveSystemModule.saveSystem.setObjective).toHaveBeenCalledWith(
        'campaign_complete',
        true
      );
    });

    it('should show mission complete notification', () => {
      const ctx = createMockContext();
      ctx.state.cinematic_active = true;
      mockEventBusEmit.mockClear();

      showEpilogue(ctx, 'extraction');

      expect(mockEventBusEmit).toHaveBeenCalledWith({
        type: 'NOTIFICATION',
        text: 'MISSION COMPLETE',
        duration: 5000,
      });
      expect(mockEventBusEmit).toHaveBeenCalledWith({
        type: 'OBJECTIVE_UPDATED',
        title: 'STELLAR DESCENT',
        instructions: 'Mission Complete',
      });
    });

    it('should schedule debrief comms', () => {
      const ctx = createMockContext();
      ctx.state.cinematic_active = true;
      mockEventBusEmit.mockClear();

      showEpilogue(ctx, 'extraction');

      // Airborne comms at 2s
      vi.advanceTimersByTime(2100);
      expect(mockEventBusEmit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'COMMS_MESSAGE' })
      );

      // Commander debrief at 4s
      vi.advanceTimersByTime(2000);
      const commsEvents = mockEventBusEmit.mock.calls.filter(
        (call) => call[0]?.type === 'COMMS_MESSAGE'
      );
      expect(commsEvents.length).toBeGreaterThanOrEqual(2);
    });

    it('should complete level after final dialogue', () => {
      const ctx = createMockContext();
      ctx.state.cinematic_active = true;
      mockEventBusEmit.mockClear();

      showEpilogue(ctx, 'extraction');

      vi.advanceTimersByTime(20100);

      expect(mockEventBusEmit).toHaveBeenCalledWith({
        type: 'OBJECTIVE_UPDATED',
        title: 'STELLAR DESCENT',
        instructions: 'CAMPAIGN COMPLETE',
      });
      expect(ctx.completeLevel).toHaveBeenCalled();
    });

    it('should hide environment during fade', () => {
      const ctx = createMockContext();
      ctx.state.cinematic_active = true;

      showEpilogue(ctx, 'extraction');

      vi.advanceTimersByTime(1600);

      expect(ctx.setSurfaceVisible).toHaveBeenCalledWith(false);
      expect(ctx.dropship!.setEnabled).toHaveBeenCalledWith(false);
      expect(ctx.mechMesh!.setEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('disposeVictoryState', () => {
    it('should clear all timeouts and stop sounds', () => {
      const mockStop = vi.fn();
      const state: VictoryState = {
        cinematic_active: true,
        cinematic_beat: 3,
        timeouts: [setTimeout(() => {}, 10000)],
        dropshipEngineSound: { stop: mockStop },
        engineThrustInterval: setInterval(() => {}, 1000),
      };

      disposeVictoryState(state);

      expect(mockStop).toHaveBeenCalled();
      expect(state.timeouts).toEqual([]);
      expect(state.dropshipEngineSound).toBeNull();
      expect(state.engineThrustInterval).toBeNull();
    });

    it('should handle empty state gracefully', () => {
      const state = createVictoryState();

      expect(() => disposeVictoryState(state)).not.toThrow();
    });
  });
});
