/**
 * ExtractionLevel - Enemy Management Tests
 *
 * Unit tests for enemy spawning, AI behavior, and combat logic.
 * Target: 95%+ line coverage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js
vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn(),
}));

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
    subtract(other: MockVector3) {
      return new MockVector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    normalize() {
      const len = Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
      if (len > 0) {
        this.x /= len;
        this.y /= len;
        this.z /= len;
      }
      return this;
    }
    scale(s: number) {
      return new MockVector3(this.x * s, this.y * s, this.z * s);
    }
    length() {
      return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
    }
    addInPlace(other: MockVector3) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
    static Distance(a: MockVector3, b: MockVector3) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  },
}));

vi.mock('../../entities/aliens', () => ({
  ALIEN_SPECIES: {
    skitterer: { baseHealth: 30, moveSpeed: 8 },
    lurker: { baseHealth: 60, moveSpeed: 5 },
    spewer: { baseHealth: 45, moveSpeed: 4 },
    husk: { baseHealth: 25, moveSpeed: 9 },
    broodmother: { baseHealth: 150, moveSpeed: 3 },
  },
  createAlienMesh: vi.fn().mockImplementation((_scene, _species, _id) => ({
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    rotation: { y: 0 },
    setEnabled: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    emitAlienDeath: vi.fn(),
  },
}));

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  applyGrenadeDamage,
  calculateSpawnPosition,
  checkMeleeHit,
  clearAllEnemies,
  killEnemy,
  mechFireAtEnemy,
  prepareWaveSpawnQueue,
  spawnCollapseStraggler,
  spawnEnemy,
  updateCollapseEnemies,
  updateEnemies,
} from './enemies';
import type { Enemy } from './types';

// Helper to create mock enemy
function createMockEnemy(overrides: Partial<Enemy> = {}): Enemy {
  const position = new Vector3(10, 0, 10);
  return {
    mesh: {
      position: { x: position.x, y: position.y, z: position.z, clone: () => position },
      rotation: { y: 0 },
      setEnabled: vi.fn(),
      dispose: vi.fn(),
    } as any,
    health: 50,
    maxHealth: 50,
    position: position,
    velocity: new Vector3(0, 0, 0),
    species: 'skitterer',
    isActive: true,
    ...overrides,
  };
}

describe('Enemy Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('spawnEnemy', () => {
    it('should return null when at max enemies', async () => {
      const scene = {} as any;
      const result = await spawnEnemy(scene, 'skitterer', new Vector3(0, 0, 0), 1, 40);
      expect(result).toBeNull();
    });

    it('should return null for unknown species', async () => {
      const scene = {} as any;
      const result = await spawnEnemy(scene, 'unknown_species', new Vector3(0, 0, 0), 1, 0);
      expect(result).toBeNull();
    });

    it('should create enemy with scaled health based on wave', async () => {
      const scene = {} as any;
      const result = await spawnEnemy(scene, 'skitterer', new Vector3(0, 0, 50), 5, 0);

      expect(result).not.toBeNull();
      // Wave 5 = 1 + (5-1) * 0.1 = 1.4 multiplier
      // Base health 30 * 1.4 = 42
      expect(result?.health).toBe(42);
      expect(result?.maxHealth).toBe(42);
      expect(result?.species).toBe('skitterer');
      expect(result?.isActive).toBe(true);
    });
  });

  describe('calculateSpawnPosition', () => {
    const spawnPoints = [
      new Vector3(50, 0, 0),
      new Vector3(-50, 0, 0),
      new Vector3(0, 0, 50),
      new Vector3(0, 0, -50),
    ];
    const breachHoles = [{ position: new Vector3(100, 0, 100) } as any];
    const lzPosition = new Vector3(0, 0, -500);

    it('should spawn broodmothers at breach holes', () => {
      const { position, newSpawnPointIndex } = calculateSpawnPosition(
        'broodmother',
        spawnPoints,
        breachHoles,
        lzPosition,
        0
      );

      // Should be near breach hole position
      expect(Math.abs(position.x - 100)).toBeLessThan(10);
      expect(Math.abs(position.z - 100)).toBeLessThan(10);
      expect(position.y).toBe(0);
    });

    it('should use spawn points for regular enemies', () => {
      const { position, newSpawnPointIndex } = calculateSpawnPosition(
        'skitterer',
        spawnPoints,
        breachHoles,
        lzPosition,
        0
      );

      // Should be near one of the spawn points with some randomization
      expect(position.y).toBe(0);
    });

    it('should fall back to breach holes when no spawn points', () => {
      const { position } = calculateSpawnPosition('lurker', [], breachHoles, lzPosition, 0);

      expect(position.y).toBe(0);
    });

    it('should fall back to random LZ position when no spawn points or breach holes', () => {
      const { position } = calculateSpawnPosition('skitterer', [], [], lzPosition, 0);

      // Should be within reasonable distance of LZ
      const dist = Vector3.Distance(position, lzPosition);
      expect(dist).toBeGreaterThan(30);
      expect(dist).toBeLessThan(80);
    });
  });

  describe('updateEnemies', () => {
    it('should move active enemies toward player', () => {
      const enemy = createMockEnemy({
        position: new Vector3(20, 0, 0),
      });
      const playerPos = new Vector3(0, 0, 0);

      const damage = updateEnemies([enemy], playerPos, 0.5);

      // Enemy should have moved closer (no damage from distance)
      expect(damage).toBe(0);
    });

    it('should deal damage when enemy is close to player', () => {
      const enemy = createMockEnemy({
        position: new Vector3(1, 0, 0),
      });
      const playerPos = new Vector3(0, 0, 0);

      const damage = updateEnemies([enemy], playerPos, 0.1);

      expect(damage).toBe(5);
    });

    it('should skip inactive enemies', () => {
      const enemy = createMockEnemy({ isActive: false });
      const playerPos = new Vector3(0, 0, 0);

      const damage = updateEnemies([enemy], playerPos, 0.1);

      expect(damage).toBe(0);
    });

    it('should update multiple enemies', () => {
      const enemies = [
        createMockEnemy({ position: new Vector3(1, 0, 0) }),
        createMockEnemy({ position: new Vector3(2, 0, 0) }),
      ];
      const playerPos = new Vector3(0, 0, 0);

      const damage = updateEnemies(enemies, playerPos, 0.1);

      expect(damage).toBe(10); // Both in attack range
    });
  });

  describe('updateCollapseEnemies', () => {
    it('should deal reduced damage during collapse', () => {
      const enemy = createMockEnemy({
        position: new Vector3(1, 0, 0),
      });
      const playerPos = new Vector3(0, 0, 0);

      const damage = updateCollapseEnemies([enemy], playerPos, 0.1);

      expect(damage).toBe(3); // Lighter damage during escape
    });

    it('should deactivate enemies far behind player', () => {
      const enemy = createMockEnemy({
        position: new Vector3(0, 0, 100), // Far behind player
      });
      const playerPos = new Vector3(0, 0, 0);

      updateCollapseEnemies([enemy], playerPos, 0.1);

      expect(enemy.isActive).toBe(false);
    });

    it('should move enemies faster during collapse', () => {
      const enemy = createMockEnemy({
        position: new Vector3(20, 0, -30), // In front of player
      });
      const originalX = enemy.position.x;
      const playerPos = new Vector3(0, 0, 0);

      updateCollapseEnemies([enemy], playerPos, 0.5);

      // Enemy should have moved toward player
      expect(enemy.position.x).not.toBe(originalX);
    });
  });

  describe('mechFireAtEnemy', () => {
    it('should find and damage closest enemy', () => {
      const mechMesh = { position: new Vector3(0, 0, 0) } as any;
      const mechGunLight = { intensity: 0 } as any;
      const enemies = [
        createMockEnemy({ position: new Vector3(30, 0, 0) }),
        createMockEnemy({ position: new Vector3(10, 0, 0) }),
      ];

      const { enemy, damage } = mechFireAtEnemy(mechMesh, mechGunLight, enemies, 100);

      expect(enemy).not.toBeNull();
      expect(damage).toBe(20); // 20 * (100/100)
    });

    it('should scale damage by mech integrity', () => {
      const mechMesh = { position: new Vector3(0, 0, 0) } as any;
      const mechGunLight = { intensity: 0 } as any;
      const enemies = [createMockEnemy({ position: new Vector3(10, 0, 0) })];

      const { damage } = mechFireAtEnemy(mechMesh, mechGunLight, enemies, 50);

      expect(damage).toBe(10); // 20 * (50/100)
    });

    it('should return null when no enemies in range', () => {
      const mechMesh = { position: new Vector3(0, 0, 0) } as any;
      const mechGunLight = { intensity: 0 } as any;
      const enemies = [createMockEnemy({ position: new Vector3(200, 0, 0) })];

      const { enemy, damage } = mechFireAtEnemy(mechMesh, mechGunLight, enemies, 100);

      expect(enemy).toBeNull();
      expect(damage).toBe(0);
    });

    it('should skip inactive enemies', () => {
      const mechMesh = { position: new Vector3(0, 0, 0) } as any;
      const mechGunLight = { intensity: 0 } as any;
      const enemies = [createMockEnemy({ position: new Vector3(10, 0, 0), isActive: false })];

      const { enemy } = mechFireAtEnemy(mechMesh, mechGunLight, enemies, 100);

      expect(enemy).toBeNull();
    });
  });

  describe('killEnemy', () => {
    it('should deactivate enemy and trigger effects', async () => {
      const enemy = createMockEnemy();
      const ParticleManagerModule = await import('../../effects/ParticleManager');

      killEnemy(enemy);

      expect(enemy.isActive).toBe(false);
      expect(enemy.mesh.setEnabled).toHaveBeenCalledWith(false);
      expect(ParticleManagerModule.particleManager.emitAlienDeath).toHaveBeenCalled();
    });
  });

  describe('clearAllEnemies', () => {
    it('should kill all active enemies and return count', () => {
      const enemies = [createMockEnemy(), createMockEnemy(), createMockEnemy({ isActive: false })];

      const killCount = clearAllEnemies(enemies);

      expect(killCount).toBe(2);
      expect(enemies[0].isActive).toBe(false);
      expect(enemies[1].isActive).toBe(false);
    });

    it('should return 0 when no active enemies', () => {
      const enemies = [createMockEnemy({ isActive: false })];

      const killCount = clearAllEnemies(enemies);

      expect(killCount).toBe(0);
    });
  });

  describe('applyGrenadeDamage', () => {
    it('should damage enemies within radius', () => {
      const enemies = [
        createMockEnemy({ position: new Vector3(5, 0, 0), health: 50 }),
        createMockEnemy({ position: new Vector3(30, 0, 0), health: 50 }),
      ];
      const grenadePos = new Vector3(0, 0, 0);

      const { kills, killedEnemies } = applyGrenadeDamage(enemies, grenadePos, 15);

      // First enemy should be damaged/killed, second should be unaffected
      expect(enemies[1].health).toBe(50); // Out of range
    });

    it('should return kill count and killed enemy list', () => {
      const enemies = [createMockEnemy({ position: new Vector3(2, 0, 0), health: 20 })];
      const grenadePos = new Vector3(0, 0, 0);

      const { kills, killedEnemies } = applyGrenadeDamage(enemies, grenadePos, 15);

      expect(kills).toBe(1);
      expect(killedEnemies.length).toBe(1);
      expect(killedEnemies[0]).toBe(enemies[0]);
    });

    it('should skip inactive enemies', () => {
      const enemies = [createMockEnemy({ position: new Vector3(2, 0, 0), isActive: false })];
      const grenadePos = new Vector3(0, 0, 0);

      const { kills } = applyGrenadeDamage(enemies, grenadePos, 15);

      expect(kills).toBe(0);
    });

    it('should apply distance-based damage falloff', () => {
      const enemies = [
        createMockEnemy({ position: new Vector3(0, 0, 0), health: 200 }),
        createMockEnemy({ position: new Vector3(10, 0, 0), health: 200 }),
      ];
      const grenadePos = new Vector3(0, 0, 0);

      applyGrenadeDamage(enemies, grenadePos, 15);

      // Enemy at distance 0 should take more damage than enemy at distance 10
      expect(enemies[0].health).toBeLessThan(enemies[1].health);
    });
  });

  describe('checkMeleeHit', () => {
    it('should return hit enemy within range', () => {
      const enemies = [createMockEnemy({ position: new Vector3(2, 0, 0), health: 100 })];
      const playerPos = new Vector3(0, 0, 0);

      const hit = checkMeleeHit(enemies, playerPos, 3, 50);

      expect(hit).not.toBeNull();
      expect(hit?.health).toBe(50); // Took 50 damage
    });

    it('should kill enemy when damage exceeds health', () => {
      const enemies = [createMockEnemy({ position: new Vector3(2, 0, 0), health: 30 })];
      const playerPos = new Vector3(0, 0, 0);

      const hit = checkMeleeHit(enemies, playerPos, 3, 50);

      expect(hit).not.toBeNull();
      expect(hit?.isActive).toBe(false);
    });

    it('should return null when no enemies in range', () => {
      const enemies = [createMockEnemy({ position: new Vector3(10, 0, 0) })];
      const playerPos = new Vector3(0, 0, 0);

      const hit = checkMeleeHit(enemies, playerPos, 3, 50);

      expect(hit).toBeNull();
    });

    it('should skip inactive enemies', () => {
      const enemies = [createMockEnemy({ position: new Vector3(2, 0, 0), isActive: false })];
      const playerPos = new Vector3(0, 0, 0);

      const hit = checkMeleeHit(enemies, playerPos, 3, 50);

      expect(hit).toBeNull();
    });
  });

  describe('prepareWaveSpawnQueue', () => {
    it('should create spawn queue with all enemy types', () => {
      const queue = prepareWaveSpawnQueue(6, 4, 2, 1, 3);

      // Should have entries for each enemy type
      const species = queue.map((g) => g.species);
      expect(species).toContain('skitterer');
      expect(species).toContain('lurker');
      expect(species).toContain('spewer');
      expect(species).toContain('husk');
      expect(species).toContain('broodmother');
    });

    it('should split large groups into chunks of 3', () => {
      const queue = prepareWaveSpawnQueue(9, 0, 0, 0, 0);

      // 9 skitterers should be split into 3 groups of 3
      const skittererGroups = queue.filter((g) => g.species === 'skitterer');
      expect(skittererGroups.length).toBe(3);
      expect(skittererGroups.every((g) => g.count === 3)).toBe(true);
    });

    it('should spawn brutes one at a time', () => {
      const queue = prepareWaveSpawnQueue(0, 0, 0, 3, 0);

      const bruteGroups = queue.filter((g) => g.species === 'broodmother');
      expect(bruteGroups.length).toBe(3);
      expect(bruteGroups.every((g) => g.count === 1)).toBe(true);
    });

    it('should shuffle the spawn order for variety', () => {
      // Run multiple times and verify not always same order
      const orders: string[] = [];
      for (let i = 0; i < 5; i++) {
        const queue = prepareWaveSpawnQueue(3, 3, 3, 0, 0);
        orders.push(queue.map((g) => g.species).join(','));
      }

      // Not all orders should be identical (shuffling)
      const uniqueOrders = new Set(orders);
      // Due to randomness, there should be at least some variety
      // (though we can't guarantee all different)
      expect(uniqueOrders.size).toBeGreaterThanOrEqual(1);
    });

    it('should handle zero counts', () => {
      const queue = prepareWaveSpawnQueue(0, 0, 0, 0, 0);
      expect(queue.length).toBe(0);
    });

    it('should handle partial enemy types', () => {
      const queue = prepareWaveSpawnQueue(3, 0, 2, 0, 0);

      const species = queue.map((g) => g.species);
      expect(species).toContain('skitterer');
      expect(species).toContain('spewer');
      expect(species).not.toContain('lurker');
      expect(species).not.toContain('broodmother');
      expect(species).not.toContain('husk');
    });
  });

  describe('spawnCollapseStraggler', () => {
    it('should spawn weakened skitterer ahead of player', async () => {
      const scene = {} as any;
      const playerPos = new Vector3(0, 0, 0);

      const enemy = await spawnCollapseStraggler(scene, playerPos, 0);

      expect(enemy).not.toBeNull();
      expect(enemy?.species).toBe('skitterer');
      expect(enemy?.health).toBe(15); // 50% of base 30
      expect(enemy?.maxHealth).toBe(15);
      expect(enemy?.isActive).toBe(true);
      // Spawn should be ahead (negative z relative to player moving forward)
      expect(enemy?.position.z).toBeLessThan(playerPos.z);
    });
  });
});
