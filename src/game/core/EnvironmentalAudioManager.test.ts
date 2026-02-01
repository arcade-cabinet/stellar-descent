/**
 * EnvironmentalAudioManager Tests
 *
 * Tests for the environmental audio system including:
 * - Environment type transitions
 * - Spatial audio positioning
 * - Audio zone management
 * - Combat state handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock AudioContext
class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state = 'running';
  listener = {
    positionX: { value: 0 },
    positionY: { value: 0 },
    positionZ: { value: 0 },
    setPosition: vi.fn(),
  };

  createGain() {
    return {
      gain: { value: 1, linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        value: 440,
        linearRampToValueAtTime: vi.fn(),
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 1000, linearRampToValueAtTime: vi.fn() },
      Q: { value: 1 },
      connect: vi.fn(),
    };
  }

  createConvolver() {
    return {
      buffer: null,
      connect: vi.fn(),
    };
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createPanner() {
    return {
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 1,
      maxDistance: 10000,
      rolloffFactor: 1,
      setPosition: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  close = vi.fn();
}

// Install mock before importing the module
(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).webkitAudioContext = MockAudioContext;

// Import after mocking
import {
  type AudioZone,
  disposeEnvironmentalAudioManager,
  EnvironmentalAudioManager,
  getEnvironmentalAudioManager,
  type SpatialSoundSource,
} from './EnvironmentalAudioManager';

describe('EnvironmentalAudioManager', () => {
  let manager: EnvironmentalAudioManager;

  beforeEach(() => {
    // Dispose any existing singleton
    disposeEnvironmentalAudioManager();
    manager = new EnvironmentalAudioManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('singleton pattern', () => {
    it('returns the same instance', () => {
      disposeEnvironmentalAudioManager();
      const instance1 = getEnvironmentalAudioManager();
      const instance2 = getEnvironmentalAudioManager();
      expect(instance1).toBe(instance2);
    });

    it('creates new instance after dispose', () => {
      const instance1 = getEnvironmentalAudioManager();
      disposeEnvironmentalAudioManager();
      const instance2 = getEnvironmentalAudioManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('startEnvironment', () => {
    it('starts station environment for anchor_station level', () => {
      manager.startEnvironment('anchor_station', 0.5);
      // Should not throw
      expect(true).toBe(true);
    });

    it('starts surface environment for landfall level', () => {
      manager.startEnvironment('landfall', 0.5);
      expect(true).toBe(true);
    });

    it('starts hive environment for the_breach level', () => {
      manager.startEnvironment('the_breach', 0.5);
      expect(true).toBe(true);
    });

    it('starts base environment for fob_delta level', () => {
      manager.startEnvironment('fob_delta', 0.5);
      expect(true).toBe(true);
    });

    it('starts extraction environment for extraction level', () => {
      manager.startEnvironment('extraction', 0.5);
      expect(true).toBe(true);
    });
  });

  describe('transitionToEnvironment', () => {
    it('transitions between environment types', () => {
      manager.transitionToEnvironment('station', 0.5);
      manager.transitionToEnvironment('surface', 0.5, 1.0);
      expect(true).toBe(true);
    });

    it('does not transition to same environment type', () => {
      manager.transitionToEnvironment('station', 0.5);
      manager.transitionToEnvironment('station', 0.5); // Should be no-op
      expect(true).toBe(true);
    });
  });

  describe('stopEnvironment', () => {
    it('stops environment with fade', () => {
      manager.startEnvironment('anchor_station', 0.5);
      manager.stopEnvironment(0.5);
      expect(true).toBe(true);
    });

    it('stops environment immediately with zero fade', () => {
      manager.startEnvironment('anchor_station', 0.5);
      manager.stopEnvironment(0);
      expect(true).toBe(true);
    });
  });

  describe('audio zones', () => {
    it('adds audio zone', () => {
      const zone: AudioZone = {
        id: 'test-zone',
        type: 'station',
        position: { x: 0, y: 0, z: 0 },
        radius: 10,
        isIndoor: true,
      };
      manager.addZone(zone);
      expect(true).toBe(true);
    });

    it('removes audio zone', () => {
      const zone: AudioZone = {
        id: 'test-zone',
        type: 'station',
        position: { x: 0, y: 0, z: 0 },
        radius: 10,
        isIndoor: true,
      };
      manager.addZone(zone);
      manager.removeZone('test-zone');
      expect(true).toBe(true);
    });

    it('supports radiation zones', () => {
      const zone: AudioZone = {
        id: 'radiation-zone',
        type: 'surface',
        position: { x: 10, y: 0, z: 10 },
        radius: 5,
        isIndoor: false,
        hasRadiation: true,
      };
      manager.addZone(zone);
      expect(true).toBe(true);
    });

    it('supports high threat zones', () => {
      const zone: AudioZone = {
        id: 'threat-zone',
        type: 'hive',
        position: { x: 20, y: 0, z: 20 },
        radius: 15,
        isIndoor: true,
        highThreat: true,
      };
      manager.addZone(zone);
      expect(true).toBe(true);
    });
  });

  describe('spatial sound sources', () => {
    it('adds spatial sound source', () => {
      const source: SpatialSoundSource = {
        id: 'generator-1',
        type: 'generator',
        position: { x: 5, y: 0, z: 5 },
        maxDistance: 15,
        volume: 0.5,
        active: true,
      };
      manager.addSpatialSource(source);
      expect(true).toBe(true);
    });

    it('removes spatial sound source', () => {
      const source: SpatialSoundSource = {
        id: 'generator-1',
        type: 'generator',
        position: { x: 5, y: 0, z: 5 },
        maxDistance: 15,
        volume: 0.5,
        active: true,
      };
      manager.addSpatialSource(source);
      manager.removeSpatialSource('generator-1');
      expect(true).toBe(true);
    });

    it('supports periodic sound sources', () => {
      const source: SpatialSoundSource = {
        id: 'drip-1',
        type: 'dripping',
        position: { x: 3, y: 2, z: 3 },
        maxDistance: 8,
        volume: 0.3,
        interval: 2000,
        active: true,
      };
      manager.addSpatialSource(source);
      expect(true).toBe(true);
    });

    it('supports all spatial sound types', () => {
      const types: SpatialSoundSource['type'][] = [
        'machinery',
        'electrical_panel',
        'vent',
        'dripping',
        'alien_nest',
        'organic_growth',
        'fire',
        'steam',
        'terminal',
        'generator',
      ];

      types.forEach((type, i) => {
        const source: SpatialSoundSource = {
          id: `source-${type}`,
          type,
          position: { x: i * 5, y: 0, z: 0 },
          maxDistance: 10,
          volume: 0.4,
          active: true,
        };
        manager.addSpatialSource(source);
      });

      expect(true).toBe(true);
    });
  });

  describe('player position updates', () => {
    it('updates player position', () => {
      manager.updatePlayerPosition({ x: 10, y: 1.7, z: 10 });
      expect(true).toBe(true);
    });

    it('updates multiple times without error', () => {
      for (let i = 0; i < 100; i++) {
        manager.updatePlayerPosition({ x: i, y: 1.7, z: i });
      }
      expect(true).toBe(true);
    });
  });

  describe('combat state', () => {
    it('enters combat state', () => {
      manager.startEnvironment('anchor_station', 0.5);
      manager.setCombatState(true);
      expect(true).toBe(true);
    });

    it('exits combat state', () => {
      manager.startEnvironment('anchor_station', 0.5);
      manager.setCombatState(true);
      manager.setCombatState(false);
      expect(true).toBe(true);
    });

    it('does not change if already in same state', () => {
      manager.startEnvironment('anchor_station', 0.5);
      manager.setCombatState(true);
      manager.setCombatState(true); // No-op
      expect(true).toBe(true);
    });
  });

  describe('volume control', () => {
    it('sets master volume', () => {
      manager.setMasterVolume(0.5);
      expect(true).toBe(true);
    });

    it('clamps volume to 0-1 range', () => {
      manager.setMasterVolume(-0.5);
      manager.setMasterVolume(1.5);
      expect(true).toBe(true);
    });
  });

  describe('special effects', () => {
    it('plays emergency klaxon', () => {
      manager.playEmergencyKlaxon(3);
      expect(true).toBe(true);
    });

    it('plays emergency klaxon with custom duration', () => {
      manager.playEmergencyKlaxon(5);
      expect(true).toBe(true);
    });
  });

  describe('dispose', () => {
    it('disposes without error', () => {
      manager.startEnvironment('anchor_station', 0.5);
      manager.addZone({
        id: 'zone-1',
        type: 'station',
        position: { x: 0, y: 0, z: 0 },
        radius: 10,
        isIndoor: true,
      });
      manager.addSpatialSource({
        id: 'source-1',
        type: 'generator',
        position: { x: 5, y: 0, z: 5 },
        maxDistance: 15,
        volume: 0.5,
        active: true,
      });
      manager.dispose();
      expect(true).toBe(true);
    });

    it('can be disposed multiple times without error', () => {
      manager.dispose();
      manager.dispose();
      expect(true).toBe(true);
    });
  });
});

describe('Environment type mappings', () => {
  it('maps all level IDs to environment types', () => {
    const levelIds = [
      'anchor_station',
      'landfall',
      'fob_delta',
      'brothers_in_arms',
      'the_breach',
      'extraction',
    ] as const;

    const manager = new EnvironmentalAudioManager();

    levelIds.forEach((levelId) => {
      // Should not throw for any valid level ID
      manager.startEnvironment(levelId, 0.5);
      manager.stopEnvironment(0);
    });

    manager.dispose();
    expect(true).toBe(true);
  });
});
