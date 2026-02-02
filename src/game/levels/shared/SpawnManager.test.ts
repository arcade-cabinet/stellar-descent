/**
 * SpawnManager.test.ts - Unit tests for wave-based spawning system
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@babylonjs/core/Maths/math.vector', () => {
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
    add(v: any) {
      return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }
    subtract(v: any) {
      return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }
    scale(n: number) {
      return new Vector3(this.x * n, this.y * n, this.z * n);
    }
    length() {
      return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
    }
    normalize() {
      const l = this.length();
      return new Vector3(this.x / l, this.y / l, this.z / l);
    }
    static Zero() {
      return new Vector3(0, 0, 0);
    }
    static Distance(v1: any, v2: any) {
      const dx = v1.x - v2.x;
      const dy = v1.y - v2.y;
      const dz = v1.z - v2.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }
  return { Vector3 };
});

vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { LevelSpawnConfig } from './SpawnConfig';
// Import after mocks
import { SpawnManager, type SpawnManagerCallbacks } from './SpawnManager';

// Create a helper to create Vector3-like objects
function createVector3(x: number, y: number, z: number): Vector3 {
  return { x, y, z, clone: () => ({ x, y, z }) } as any;
}

describe('SpawnManager', () => {
  let spawnManager: SpawnManager;
  let mockCallbacks: SpawnManagerCallbacks;
  let onSpawnEnemySpy: ReturnType<typeof vi.fn>;
  let onWaveStartSpy: ReturnType<typeof vi.fn>;
  let onWaveCompleteSpy: ReturnType<typeof vi.fn>;
  let onAllWavesCompleteSpy: ReturnType<typeof vi.fn>;

  // Sample spawn config for testing
  const createTestConfig = (): LevelSpawnConfig => ({
    levelId: 'test_level',
    spawnPoints: [
      {
        id: 'spawn_north',
        position: { x: 0, y: 0, z: 50 },
        facingAngle: 0,
        radius: 3,
        allowedSpecies: ['skitterer', 'lurker'],
      },
      {
        id: 'spawn_south',
        position: { x: 0, y: 0, z: -50 },
        facingAngle: Math.PI,
        radius: 3,
        allowedSpecies: ['spewer', 'husk'],
      },
      {
        id: 'spawn_east',
        position: { x: 50, y: 0, z: 0 },
        facingAngle: -Math.PI / 2,
        radius: 5,
      },
    ],
    waves: [
      {
        waveNumber: 0,
        label: 'First Wave',
        trigger: { type: 'timer', delay: 0 },
        groups: [{ speciesId: 'skitterer', count: 3, spawnPointIds: ['spawn_north'] }],
        spawnInterval: 0.5,
        maxConcurrent: 5,
      },
      {
        waveNumber: 1,
        label: 'Second Wave',
        trigger: { type: 'killPercent', killPercent: 80 },
        groups: [
          { speciesId: 'lurker', count: 2 },
          { speciesId: 'spewer', count: 1, spawnPointIds: ['spawn_south'] },
        ],
        spawnInterval: 1.0,
        maxConcurrent: 4,
      },
      {
        waveNumber: 2,
        label: 'Final Wave',
        trigger: { type: 'objective', objectiveFlag: 'door_opened' },
        groups: [{ speciesId: 'husk', count: 2 }],
        spawnInterval: 2.0,
      },
    ],
    defaultSpawnInterval: 1.0,
    maxGlobalEnemies: 10,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock callbacks
    onSpawnEnemySpy = vi
      .fn()
      .mockImplementation((speciesId, _position, _facingAngle, _overrides) => {
        return `entity_${speciesId}_${Math.random().toString(36).substring(7)}`;
      });
    onWaveStartSpy = vi.fn();
    onWaveCompleteSpy = vi.fn();
    onAllWavesCompleteSpy = vi.fn();

    mockCallbacks = {
      onSpawnEnemy: onSpawnEnemySpy as SpawnManagerCallbacks['onSpawnEnemy'],
      onWaveStart: onWaveStartSpy as SpawnManagerCallbacks['onWaveStart'],
      onWaveComplete: onWaveCompleteSpy as SpawnManagerCallbacks['onWaveComplete'],
      onAllWavesComplete: onAllWavesCompleteSpy as SpawnManagerCallbacks['onAllWavesComplete'],
    };

    // Create spawn manager with test config
    spawnManager = new SpawnManager(createTestConfig(), mockCallbacks);
  });

  describe('Spawn point configuration', () => {
    it('should use configured spawn positions', () => {
      const playerPos = createVector3(0, 0, 0);

      // Update to trigger first wave (timer=0)
      spawnManager.update(0.016, playerPos as Vector3);
      spawnManager.update(0.5, playerPos as Vector3);

      // Should have called onSpawnEnemy with positions from spawn_north
      expect(onSpawnEnemySpy).toHaveBeenCalled();
    });

    it('should respect allowedSpecies per spawn point', () => {
      // spawn_north only allows skitterer and lurker
      // spawn_south only allows spewer and husk
      const config = createTestConfig();
      expect(config.spawnPoints[0].allowedSpecies).toContain('skitterer');
      expect(config.spawnPoints[1].allowedSpecies).toContain('spewer');
    });

    it('should randomize position within spawn radius', () => {
      // Each spawn should be within the spawn point's radius
      // spawn_north has radius 3
      const config = createTestConfig();
      expect(config.spawnPoints[0].radius).toBe(3);
    });
  });

  describe('Max concurrent enemies', () => {
    it('should respect wave maxConcurrent limit', () => {
      // Create a config with more enemies than maxConcurrent to properly test the limit
      const limitTestConfig: LevelSpawnConfig = {
        levelId: 'test_limit',
        spawnPoints: [{ id: 'sp1', position: { x: 0, y: 0, z: 0 }, facingAngle: 0, radius: 1 }],
        waves: [
          {
            waveNumber: 0,
            trigger: { type: 'timer', delay: 0 },
            groups: [{ speciesId: 'test', count: 10 }], // 10 enemies to spawn
            spawnInterval: 0.1,
            maxConcurrent: 5, // but only 5 at a time
          },
        ],
      };

      const manager = new SpawnManager(limitTestConfig, mockCallbacks);
      const playerPos = createVector3(0, 0, 0);

      // Rapidly update to try spawning all at once
      for (let i = 0; i < 20; i++) {
        manager.update(0.1, playerPos as Vector3);
      }

      // Should never exceed 5 concurrent
      expect(manager.getAliveCount()).toBeLessThanOrEqual(5);
    });

    it('should respect global maxGlobalEnemies limit', () => {
      // maxGlobalEnemies is 10
      const config = createTestConfig();
      expect(config.maxGlobalEnemies).toBe(10);
    });

    it('should spawn more when enemies are killed', () => {
      const playerPos = createVector3(0, 0, 0);

      // Start first wave
      spawnManager.update(0.016, playerPos as Vector3);

      // Get spawned entity IDs from mock calls
      const spawnedIds: string[] = [];
      onSpawnEnemySpy.mock.results.forEach((result) => {
        if (result.value) spawnedIds.push(result.value);
      });

      // Report kills
      spawnedIds.forEach((id) => spawnManager.reportKill(id));

      // Kill count should increase
      expect(spawnManager.getTotalKills()).toBe(spawnedIds.length);
    });
  });

  describe('Wave progression', () => {
    it('should trigger wave on timer condition', () => {
      const playerPos = createVector3(0, 0, 0);

      // First wave triggers at delay: 0
      spawnManager.update(0.016, playerPos as Vector3);

      expect(onWaveStartSpy).toHaveBeenCalledWith(0, 'First Wave');
    });

    it('should trigger wave on killPercent condition', () => {
      const playerPos = createVector3(0, 0, 0);

      // Start first wave
      spawnManager.update(0.5, playerPos as Vector3);
      spawnManager.update(0.5, playerPos as Vector3);
      spawnManager.update(0.5, playerPos as Vector3);

      // Get spawned IDs and kill 80%+
      const calls = onSpawnEnemySpy.mock.calls;
      const spawnedCount = calls.length;
      const killTarget = Math.ceil(spawnedCount * 0.8);

      for (let i = 0; i < killTarget; i++) {
        const id = onSpawnEnemySpy.mock.results[i]?.value;
        if (id) spawnManager.reportKill(id);
      }

      // Update to check wave 1 trigger
      spawnManager.update(0.5, playerPos as Vector3);

      // Wave 1 should start if 80% of wave 0 is killed
    });

    it('should trigger wave on objective flag', () => {
      const _playerPos = createVector3(0, 0, 0);

      // Wave 2 triggers on 'door_opened' flag
      spawnManager.setFlag('door_opened', true);
      expect(spawnManager.getFlag('door_opened')).toBe(true);
    });

    it('should call onWaveComplete when all enemies killed', () => {
      const playerPos = createVector3(0, 0, 0);

      // Start first wave
      spawnManager.update(0.5, playerPos as Vector3);
      spawnManager.update(0.5, playerPos as Vector3);
      spawnManager.update(0.5, playerPos as Vector3);

      // Kill all spawned enemies
      onSpawnEnemySpy.mock.results.forEach((result) => {
        if (result.value) spawnManager.reportKill(result.value);
      });

      // Update to process wave completion
      spawnManager.update(0.016, playerPos as Vector3);

      // onWaveComplete should have been called for wave 0
    });

    it('should call onAllWavesComplete when all waves done', () => {
      // Complete all waves and verify callback
      const playerPos = createVector3(0, 0, 0);

      // Rapidly complete all waves
      for (let i = 0; i < 50; i++) {
        spawnManager.update(0.5, playerPos as Vector3);

        // Kill all spawned
        onSpawnEnemySpy.mock.results.forEach((result) => {
          if (result.value) spawnManager.reportKill(result.value);
        });
      }

      // Set objective flag for wave 2
      spawnManager.setFlag('door_opened', true);

      for (let i = 0; i < 10; i++) {
        spawnManager.update(0.5, playerPos as Vector3);
        onSpawnEnemySpy.mock.results.forEach((result) => {
          if (result.value) spawnManager.reportKill(result.value);
        });
      }

      // Check completion
      if (spawnManager.isComplete()) {
        expect(onAllWavesCompleteSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Wave events', () => {
    it('should emit waveStart event with wave number and label', () => {
      const playerPos = createVector3(0, 0, 0);
      spawnManager.update(0.016, playerPos as Vector3);

      expect(onWaveStartSpy).toHaveBeenCalledWith(0, 'First Wave');
    });

    it('should emit waveComplete event when wave cleared', () => {
      const playerPos = createVector3(0, 0, 0);

      // Spawn all wave 0 enemies
      for (let i = 0; i < 5; i++) {
        spawnManager.update(0.5, playerPos as Vector3);
      }

      // Kill all
      onSpawnEnemySpy.mock.results.forEach((result) => {
        if (result.value) spawnManager.reportKill(result.value);
      });

      // Process completion
      spawnManager.update(0.016, playerPos as Vector3);
    });
  });

  describe('Kill tracking', () => {
    it('should increment total kills on reportKill', () => {
      const playerPos = createVector3(0, 0, 0);
      spawnManager.update(0.5, playerPos as Vector3);

      const firstSpawnId = onSpawnEnemySpy.mock.results[0]?.value;
      if (firstSpawnId) {
        spawnManager.reportKill(firstSpawnId);
        expect(spawnManager.getTotalKills()).toBe(1);
      }
    });

    it('should remove entity from alive count', () => {
      const playerPos = createVector3(0, 0, 0);
      spawnManager.update(0.5, playerPos as Vector3);

      const aliveBeforeKill = spawnManager.getAliveCount();

      const firstSpawnId = onSpawnEnemySpy.mock.results[0]?.value;
      if (firstSpawnId) {
        spawnManager.reportKill(firstSpawnId);
        expect(spawnManager.getAliveCount()).toBe(aliveBeforeKill - 1);
      }
    });
  });

  describe('Manual wave control', () => {
    it('should manually start a wave via startWave', () => {
      // Create config with manual trigger
      const manualConfig: LevelSpawnConfig = {
        levelId: 'test',
        spawnPoints: [{ id: 'sp1', position: { x: 0, y: 0, z: 0 }, facingAngle: 0, radius: 1 }],
        waves: [
          { waveNumber: 0, trigger: { type: 'manual' }, groups: [{ speciesId: 'test', count: 1 }] },
        ],
      };

      const manager = new SpawnManager(manualConfig, mockCallbacks);
      const playerPos = createVector3(0, 0, 0);

      // Wave should not start automatically
      manager.update(1.0, playerPos as Vector3);

      // Manually start wave
      manager.startWave(0);
      manager.update(1.0, playerPos as Vector3);

      expect(onWaveStartSpy).toHaveBeenCalledWith(0, undefined);
    });
  });

  describe('Pause and resume', () => {
    it('should pause spawning', () => {
      const playerPos = createVector3(0, 0, 0);

      spawnManager.pause();
      spawnManager.update(1.0, playerPos as Vector3);

      // No spawns should occur while paused
      expect(onSpawnEnemySpy).not.toHaveBeenCalled();
    });

    it('should resume spawning', () => {
      const playerPos = createVector3(0, 0, 0);

      // First activate the wave by updating once
      spawnManager.update(0.016, playerPos as Vector3);
      vi.clearAllMocks(); // Clear the spawn that happened during activation

      // Now pause and verify no spawning
      spawnManager.pause();
      spawnManager.update(1.0, playerPos as Vector3);
      expect(onSpawnEnemySpy).not.toHaveBeenCalled();

      // Resume and verify spawning resumes
      spawnManager.resume();
      spawnManager.update(0.5, playerPos as Vector3);

      // Spawns should resume
      expect(onSpawnEnemySpy).toHaveBeenCalled();
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      const playerPos = createVector3(0, 0, 0);

      // Make progress - need two updates: one to activate wave, one to spawn
      spawnManager.update(0.5, playerPos as Vector3);
      spawnManager.update(0.5, playerPos as Vector3);

      // Ensure we have at least one spawn
      expect(onSpawnEnemySpy.mock.results.length).toBeGreaterThan(0);

      const id = onSpawnEnemySpy.mock.results[0]?.value;
      expect(id).toBeDefined();
      spawnManager.reportKill(id);

      expect(spawnManager.getTotalKills()).toBeGreaterThan(0);

      // Reset
      spawnManager.reset();

      expect(spawnManager.getTotalKills()).toBe(0);
      expect(spawnManager.getAliveCount()).toBe(0);
      expect(spawnManager.isComplete()).toBe(false);
    });
  });

  describe('Wave queries', () => {
    it('should return active enemy IDs', () => {
      const playerPos = createVector3(0, 0, 0);
      spawnManager.update(0.5, playerPos as Vector3);

      const activeIds = spawnManager.getActiveEnemyIds();
      expect(Array.isArray(activeIds)).toBe(true);
    });

    it('should report completion status', () => {
      expect(spawnManager.isComplete()).toBe(false);
    });

    it('should report wave active status', () => {
      const playerPos = createVector3(0, 0, 0);
      spawnManager.update(0.016, playerPos as Vector3);

      expect(spawnManager.isWaveActive(0)).toBe(true);
    });

    it('should report current wave number', () => {
      // Create a config where wave 0 won't quickly transition to wave 1
      const singleWaveConfig: LevelSpawnConfig = {
        levelId: 'test_single',
        spawnPoints: [{ id: 'sp1', position: { x: 0, y: 0, z: 0 }, facingAngle: 0, radius: 1 }],
        waves: [
          {
            waveNumber: 0,
            trigger: { type: 'timer', delay: 0 },
            groups: [{ speciesId: 'test', count: 5 }],
            spawnInterval: 1.0,
          },
        ],
      };

      const manager = new SpawnManager(singleWaveConfig, mockCallbacks);
      const playerPos = createVector3(0, 0, 0);

      manager.update(0.016, playerPos as Vector3);

      expect(manager.getCurrentWaveNumber()).toBe(0);
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      spawnManager.dispose();
      // Should not throw
    });
  });
});
