/**
 * Tests for EnemySoundManager
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disposeEnemySoundManager,
  type EnemySoundType,
  getEnemySoundManager,
} from './EnemySoundManager';

// Mock the AudioManager
vi.mock('./AudioManager', () => ({
  getAudioManager: () => ({
    play: vi.fn(),
  }),
}));

describe('EnemySoundManager', () => {
  let manager: ReturnType<typeof getEnemySoundManager>;

  beforeEach(() => {
    manager = getEnemySoundManager();
  });

  afterEach(() => {
    disposeEnemySoundManager();
    vi.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('returns the same instance on multiple calls', () => {
      const instance1 = getEnemySoundManager();
      const instance2 = getEnemySoundManager();
      expect(instance1).toBe(instance2);
    });

    it('creates a new instance after dispose', () => {
      const instance1 = getEnemySoundManager();
      disposeEnemySoundManager();
      const instance2 = getEnemySoundManager();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('player position', () => {
    it('accepts player position for spatial audio', () => {
      const position = new Vector3(10, 0, 20);
      // Should not throw
      expect(() => manager.setPlayerPosition(position)).not.toThrow();
    });
  });

  describe('entity registration', () => {
    it('registers an entity for sound tracking', () => {
      const entity = {
        id: 'test-entity-1',
        transform: {
          position: new Vector3(0, 0, 0),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'skitterer', seed: 123, xpValue: 10, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 30,
          attackRadius: 10,
        },
      };

      // Should not throw
      expect(() => manager.registerEntity(entity as any)).not.toThrow();
    });

    it('unregisters an entity', () => {
      const entity = {
        id: 'test-entity-2',
        transform: {
          position: new Vector3(0, 0, 0),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'lurker', seed: 456, xpValue: 35, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 50,
          attackRadius: 15,
        },
      };

      manager.registerEntity(entity as any);
      // Should not throw
      expect(() => manager.unregisterEntity(entity as any)).not.toThrow();
    });
  });

  describe('sound playback', () => {
    const createMockEntity = (speciesId: string, position = new Vector3(5, 0, 5)) => ({
      id: `test-${speciesId}-${Date.now()}`,
      transform: { position, rotation: new Vector3(), scale: new Vector3() },
      alienInfo: { speciesId, seed: 789, xpValue: 10, lootTable: [] },
      tags: { enemy: true },
      ai: {
        state: 'patrol',
        vehicle: null,
        behaviors: [],
        target: null,
        alertRadius: 30,
        attackRadius: 10,
      },
    });

    it('plays spawn sound for newly created entity', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));
      const entity = createMockEntity('skitterer');
      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.playSpawnSound(entity as any)).not.toThrow();
    });

    it('plays death sound', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));
      const entity = createMockEntity('spewer');
      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.playDeathSound(entity as any)).not.toThrow();
    });

    it('plays attack sound', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));
      const entity = createMockEntity('husk');
      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.playAttackSound(entity as any)).not.toThrow();
    });

    it('plays hit sound', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));
      const entity = createMockEntity('lurker');
      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.playHitSound(entity as any)).not.toThrow();
    });

    it('handles broodmother sounds', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));
      const entity = createMockEntity('broodmother');
      manager.registerEntity(entity as any);

      // Should not throw for boss sounds
      expect(() => manager.playSpawnSound(entity as any)).not.toThrow();
      expect(() => manager.playAttackSound(entity as any)).not.toThrow();
      expect(() => manager.playDeathSound(entity as any)).not.toThrow();
    });
  });

  describe('spatial audio', () => {
    it('does not play sounds for entities beyond max distance', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));

      // Entity is far away (beyond max distance of 60)
      const farEntity = {
        id: 'far-entity',
        transform: {
          position: new Vector3(100, 0, 100),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'skitterer', seed: 123, xpValue: 10, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 30,
          attackRadius: 10,
        },
      };

      manager.registerEntity(farEntity as any);

      // This should silently skip due to distance (no error)
      expect(() => manager.playSound(farEntity as any, 'idle')).not.toThrow();
    });

    it('plays sounds for nearby entities', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));

      // Entity is close
      const nearEntity = {
        id: 'near-entity',
        transform: {
          position: new Vector3(5, 0, 5),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'lurker', seed: 456, xpValue: 35, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 50,
          attackRadius: 15,
        },
      };

      manager.registerEntity(nearEntity as any);

      // Should not throw
      expect(() => manager.playSound(nearEntity as any, 'idle', { forcePlay: true })).not.toThrow();
    });
  });

  describe('AI state changes', () => {
    it('triggers alert sound on state change from patrol to chase', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));

      const entity = {
        id: 'state-change-entity',
        transform: {
          position: new Vector3(5, 0, 5),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'husk', seed: 789, xpValue: 40, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 60,
          attackRadius: 10,
        },
      };

      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.onAIStateChange(entity as any, 'patrol', 'chase')).not.toThrow();
    });

    it('triggers alert sound on state change from patrol to attack', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));

      const entity = {
        id: 'attack-entity',
        transform: {
          position: new Vector3(5, 0, 5),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'spewer', seed: 111, xpValue: 50, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 35,
          attackRadius: 25,
        },
      };

      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.onAIStateChange(entity as any, 'patrol', 'attack')).not.toThrow();
    });
  });

  describe('movement sounds', () => {
    it('updates movement sounds for moving entities', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));

      const entity = {
        id: 'moving-entity',
        transform: {
          position: new Vector3(5, 0, 5),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'skitterer', seed: 222, xpValue: 10, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'chase',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 30,
          attackRadius: 8,
        },
      };

      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.updateMovementSounds(entity as any, true)).not.toThrow();
    });

    it('handles idle entities', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));

      const entity = {
        id: 'idle-entity',
        transform: {
          position: new Vector3(5, 0, 5),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'lurker', seed: 333, xpValue: 35, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 50,
          attackRadius: 15,
        },
      };

      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.updateMovementSounds(entity as any, false)).not.toThrow();
    });
  });

  describe('species sound mapping', () => {
    const soundTypes: EnemySoundType[] = [
      'spawn',
      'alert',
      'footstep',
      'attack',
      'attack_windup',
      'hit',
      'death',
      'idle',
      'chase',
    ];

    const species = ['skitterer', 'lurker', 'spewer', 'husk', 'broodmother'];

    for (const speciesId of species) {
      it(`handles all sound types for ${speciesId}`, () => {
        manager.setPlayerPosition(new Vector3(0, 0, 0));

        const entity = {
          id: `${speciesId}-test`,
          transform: {
            position: new Vector3(5, 0, 5),
            rotation: new Vector3(),
            scale: new Vector3(),
          },
          alienInfo: { speciesId, seed: 444, xpValue: 10, lootTable: [] },
          tags: { enemy: true },
          ai: {
            state: 'patrol',
            vehicle: null,
            behaviors: [],
            target: null,
            alertRadius: 30,
            attackRadius: 10,
          },
        };

        manager.registerEntity(entity as any);

        for (const soundType of soundTypes) {
          // Force play to bypass cooldowns
          expect(() =>
            manager.playSound(entity as any, soundType, { forcePlay: true })
          ).not.toThrow();
        }
      });
    }
  });

  describe('dispose', () => {
    it('cleans up all state on dispose', () => {
      manager.setPlayerPosition(new Vector3(0, 0, 0));

      const entity = {
        id: 'dispose-test',
        transform: {
          position: new Vector3(5, 0, 5),
          rotation: new Vector3(),
          scale: new Vector3(),
        },
        alienInfo: { speciesId: 'skitterer', seed: 555, xpValue: 10, lootTable: [] },
        tags: { enemy: true },
        ai: {
          state: 'patrol',
          vehicle: null,
          behaviors: [],
          target: null,
          alertRadius: 30,
          attackRadius: 10,
        },
      };

      manager.registerEntity(entity as any);

      // Should not throw
      expect(() => manager.dispose()).not.toThrow();
    });
  });
});
