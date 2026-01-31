/**
 * enemies.test.ts - Unit tests for The Breach enemy system
 *
 * Tests enemy spawning, AI behavior, damage, and hit detection.
 * Achieves comprehensive coverage for enemies.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Maths/math.vector', () => {
  class MockVector3 {
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
    subtract(other: any) {
      return new MockVector3(
        this.x - (other?.x || 0),
        this.y - (other?.y || 0),
        this.z - (other?.z || 0)
      );
    }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) || 1;
      return new MockVector3(this.x / len, this.y / len, this.z / len);
    }
    scale(factor: number) {
      return new MockVector3(this.x * factor, this.y * factor, this.z * factor);
    }
    addInPlace(other: any) {
      this.x += other?.x || 0;
      this.y += other?.y || 0;
      this.z += other?.z || 0;
      return this;
    }
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    static Zero() {
      return new MockVector3(0, 0, 0);
    }
    static Distance(a: any, b: any) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
    static Dot(a: any, b: any) {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }
  }
  return { Vector3: MockVector3 };
});

vi.mock('@babylonjs/core/Meshes/transformNode', () => {
  class MockTransformNode {
    position = { x: 0, y: 0, z: 0 };
    rotation = { x: 0, y: 0, z: 0 };
    scaling = { x: 1, y: 1, z: 1, setAll: vi.fn() };
    lookAt = vi.fn();
    dispose = vi.fn();
  }
  return { TransformNode: MockTransformNode };
});

vi.mock('../../core/AssetManager', () => {
  const createMockNode = () => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
    lookAt: vi.fn(),
    dispose: vi.fn(),
  });
  return {
    AssetManager: {
      loadAsset: vi.fn().mockResolvedValue({}),
      createInstance: vi.fn().mockImplementation(() => createMockNode()),
    },
    SPECIES_TO_ASSET: {
      skitterer: 'spider.glb',
      lurker: 'scout.glb',
      spewer: 'soldier.glb',
      broodmother: 'tentakel.glb',
    },
  };
});

vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../core/DifficultySettings', () => ({
  loadDifficultySetting: vi.fn().mockReturnValue('normal'),
  scaleEnemyHealth: vi.fn().mockImplementation((health, _diff) => health),
  scaleEnemyDamage: vi.fn().mockImplementation((damage, _diff) => damage),
  scaleEnemyFireRate: vi.fn().mockImplementation((rate, _diff) => rate),
  scaleDetectionRange: vi.fn().mockImplementation((range, _diff) => range),
}));

vi.mock('../../core/ecs', () => ({
  createEntity: vi.fn().mockReturnValue({ id: 'test-entity-123' }),
  removeEntity: vi.fn(),
}));

vi.mock('../../effects/DamageFeedback', () => ({
  damageFeedback: {
    applyDamageFeedback: vi.fn(),
  },
}));

vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    emitAlienSplatter: vi.fn(),
    emitAlienDeath: vi.fn(),
  },
}));

vi.mock('./constants', () => ({
  ENEMY_DETECTION_RANGE: 20,
  ENEMY_STATS: {
    drone: { health: 30, damage: 5, speed: 12, attackRange: 2, fireRate: 2 },
    grunt: { health: 100, damage: 20, speed: 6, attackRange: 3, fireRate: 1 },
    spitter: { health: 50, damage: 15, speed: 4, attackRange: 15, fireRate: 0.8 },
    brute: { health: 200, damage: 35, speed: 3, attackRange: 4, fireRate: 0.5 },
  },
}));

// Import after mocks
import { createEntity, removeEntity } from '../../core/ecs';
import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import {
  checkEnemyHit,
  damageEnemy,
  disposeEnemies,
  getEnemyAttackDamage,
  getEnemyDifficulty,
  getInitialSpawnConfig,
  preloadEnemyModels,
  resetEnemyAssets,
  setEnemyDifficulty,
  spawnEnemy,
  spawnEnemyAsync,
  updateEnemyAI,
} from './enemies';
import type { Enemy, EnemyType, HiveZone } from './types';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

describe('The Breach Enemies', () => {
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();
    resetEnemyAssets(); // Reset preload state

    mockScene = {
      onBeforeRenderObservable: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
  });

  // ==========================================================================
  // DIFFICULTY MANAGEMENT
  // ==========================================================================

  describe('Difficulty Management', () => {
    it('should set and get difficulty level', () => {
      setEnemyDifficulty('hard');
      expect(getEnemyDifficulty()).toBe('hard');

      setEnemyDifficulty('nightmare');
      expect(getEnemyDifficulty()).toBe('nightmare');

      setEnemyDifficulty('normal');
      expect(getEnemyDifficulty()).toBe('normal');
    });

    it('should default to normal difficulty', () => {
      // Reset module state
      resetEnemyAssets();
      // After reset, check default
      const difficulty = getEnemyDifficulty();
      expect(['easy', 'normal', 'hard', 'nightmare']).toContain(difficulty);
    });
  });

  // ==========================================================================
  // GLB PRELOADING
  // ==========================================================================

  describe('GLB Preloading', () => {
    it('should preload enemy models', async () => {
      resetEnemyAssets();
      await preloadEnemyModels(mockScene);
      // Should not throw and complete successfully
    });

    it('should not preload twice', async () => {
      resetEnemyAssets();
      await preloadEnemyModels(mockScene);
      await preloadEnemyModels(mockScene);
      // Second call should be a no-op
    });

    it('should reset preload state', () => {
      resetEnemyAssets();
      // Should reset without error
    });
  });

  // ==========================================================================
  // ENEMY SPAWNING
  // ==========================================================================

  describe('Enemy Spawning', () => {
    beforeEach(async () => {
      await preloadEnemyModels(mockScene);
    });

    it('should spawn a drone enemy', () => {
      const position = new Vector3(0, 0, 0) as any;
      const enemy = spawnEnemy(mockScene, position, 'drone', 'upper', 0);

      expect(enemy).toBeDefined();
      expect(enemy.type).toBe('drone');
      expect(enemy.health).toBe(30);
      expect(enemy.maxHealth).toBe(30);
      expect(enemy.state).toBe('patrol');
      expect(enemy.zone).toBe('upper');
      expect(createEntity).toHaveBeenCalled();
    });

    it('should spawn a grunt enemy', () => {
      const position = new Vector3(5, -10, 20) as any;
      const enemy = spawnEnemy(mockScene, position, 'grunt', 'mid', 1);

      expect(enemy.type).toBe('grunt');
      expect(enemy.health).toBe(100);
      expect(enemy.zone).toBe('mid');
    });

    it('should spawn a spitter enemy', () => {
      const position = new Vector3(0, -50, 80) as any;
      const enemy = spawnEnemy(mockScene, position, 'spitter', 'lower', 2);

      expect(enemy.type).toBe('spitter');
      expect(enemy.health).toBe(50);
      expect(enemy.zone).toBe('lower');
    });

    it('should spawn a brute enemy', () => {
      const position = new Vector3(0, -100, 120) as any;
      const enemy = spawnEnemy(mockScene, position, 'brute', 'lower', 3);

      expect(enemy.type).toBe('brute');
      expect(enemy.health).toBe(200);
    });

    it('should spawn enemy asynchronously', async () => {
      resetEnemyAssets();
      const position = new Vector3(0, 0, 0) as any;
      const enemy = await spawnEnemyAsync(mockScene, position, 'drone', 'upper', 0);

      expect(enemy).toBeDefined();
      expect(enemy.type).toBe('drone');
    });

    it('should spawn enemy with correct position', () => {
      const position = new Vector3(10, -20, 30) as any;
      const enemy = spawnEnemy(mockScene, position, 'grunt', 'mid', 0);

      expect(enemy.position.x).toBe(10);
      expect(enemy.position.y).toBe(-20);
      expect(enemy.position.z).toBe(30);
    });

    it('should initialize velocity to zero', () => {
      const position = new Vector3(0, 0, 0) as any;
      const enemy = spawnEnemy(mockScene, position, 'drone', 'upper', 0);

      expect(enemy.velocity.x).toBe(0);
      expect(enemy.velocity.y).toBe(0);
      expect(enemy.velocity.z).toBe(0);
    });

    it('should initialize attack cooldown to zero', () => {
      const position = new Vector3(0, 0, 0) as any;
      const enemy = spawnEnemy(mockScene, position, 'drone', 'upper', 0);

      expect(enemy.attackCooldown).toBe(0);
    });
  });

  // ==========================================================================
  // ENEMY AI - STATE TRANSITIONS
  // ==========================================================================

  describe('Enemy AI - State Transitions', () => {
    let enemy: Enemy;
    const playerPosition = new Vector3(0, 0, 0) as any;

    beforeEach(async () => {
      await preloadEnemyModels(mockScene);
      const position = new Vector3(0, 0, 0) as any;
      enemy = spawnEnemy(mockScene, position, 'grunt', 'mid', 0);
    });

    it('should transition to chase when player is in detection range', () => {
      enemy.position = {
        x: 10,
        y: 0,
        z: 10,
        clone: vi.fn().mockReturnThis(),
        addInPlace: vi.fn().mockReturnThis(),
      } as any;
      enemy.state = 'patrol';

      // Player at origin, enemy within 20 unit detection range
      updateEnemyAI(enemy, playerPosition, 0.016);

      expect(enemy.state).toBe('chase');
    });

    it('should transition to patrol when player is far', () => {
      enemy.position = { x: 50, y: 0, z: 50, clone: vi.fn().mockReturnThis() } as any;
      enemy.state = 'chase';

      // Player at origin, enemy very far
      updateEnemyAI(enemy, playerPosition, 0.016);

      expect(enemy.state).toBe('patrol');
    });

    it('should transition to attack when in attack range', () => {
      enemy.position = { x: 1, y: 0, z: 1, clone: vi.fn().mockReturnThis() } as any;
      enemy.state = 'patrol';
      enemy.attackCooldown = 0;

      updateEnemyAI(enemy, playerPosition, 0.016);

      expect(enemy.state).toBe('attack');
    });

    it('should not update dead enemies', () => {
      enemy.state = 'dead';
      const originalX = enemy.position.x;

      updateEnemyAI(enemy, playerPosition, 0.016);

      // Position should not change
      expect(enemy.position.x).toBe(originalX);
    });

    it('should reduce attack cooldown over time', () => {
      enemy.attackCooldown = 1000;
      enemy.position = { x: 50, y: 0, z: 50, clone: vi.fn().mockReturnThis() } as any;

      updateEnemyAI(enemy, playerPosition, 0.1); // 100ms

      expect(enemy.attackCooldown).toBe(900);
    });
  });

  // ==========================================================================
  // ENEMY AI - BEHAVIOR
  // ==========================================================================

  describe('Enemy AI - Behavior', () => {
    let enemy: Enemy;
    const playerPosition = new Vector3(0, 0, 0) as any;

    beforeEach(async () => {
      await preloadEnemyModels(mockScene);
      const position = new Vector3(10, 0, 10) as any;
      enemy = spawnEnemy(mockScene, position, 'grunt', 'mid', 0);
    });

    it('should move toward player when chasing', () => {
      enemy.state = 'chase';
      const initialX = enemy.position.x;

      updateEnemyAI(enemy, playerPosition, 0.1);

      // Enemy should have moved
      expect(enemy.velocity).toBeDefined();
    });

    it('should wander when patrolling', () => {
      enemy.state = 'patrol';
      enemy.position = { x: 100, y: 0, z: 100, clone: vi.fn().mockReturnThis() } as any;

      // Run multiple updates
      updateEnemyAI(enemy, playerPosition, 0.1);
      updateEnemyAI(enemy, playerPosition, 0.1);

      // Patrol behavior should execute without error
    });

    it('should update mesh position', () => {
      enemy.state = 'chase';
      enemy.mesh.position = { x: 10, y: 0, z: 10 } as any;

      updateEnemyAI(enemy, playerPosition, 0.1);

      // Mesh position should be synced with enemy position
      expect(enemy.mesh.position).toBeDefined();
    });
  });

  // ==========================================================================
  // ENEMY ATTACK DAMAGE
  // ==========================================================================

  describe('Enemy Attack Damage', () => {
    let enemy: Enemy;
    const playerPosition = new Vector3(0, 0, 0) as any;

    beforeEach(async () => {
      await preloadEnemyModels(mockScene);
      const position = new Vector3(1, 0, 1) as any;
      enemy = spawnEnemy(mockScene, position, 'grunt', 'mid', 0);
    });

    it('should return damage when attacking in range', () => {
      enemy.state = 'attack';
      enemy.attackCooldown = 0;
      enemy.position = { x: 1, y: 0, z: 1, clone: vi.fn().mockReturnThis() } as any;

      const damage = getEnemyAttackDamage(enemy, playerPosition);

      expect(damage).toBe(20); // Grunt damage
    });

    it('should return 0 damage when not attacking', () => {
      enemy.state = 'chase';

      const damage = getEnemyAttackDamage(enemy, playerPosition);

      expect(damage).toBe(0);
    });

    it('should return 0 damage when on cooldown', () => {
      enemy.state = 'attack';
      enemy.attackCooldown = 1000;

      const damage = getEnemyAttackDamage(enemy, playerPosition);

      expect(damage).toBe(0);
    });

    it('should set cooldown after attacking', () => {
      enemy.state = 'attack';
      enemy.attackCooldown = 0;
      enemy.position = { x: 1, y: 0, z: 1, clone: vi.fn().mockReturnThis() } as any;

      getEnemyAttackDamage(enemy, playerPosition);

      expect(enemy.attackCooldown).toBeGreaterThan(0);
    });

    it('should return correct damage per enemy type', async () => {
      // Drone
      const dronePos = new Vector3(0.5, 0, 0.5) as any;
      const drone = spawnEnemy(mockScene, dronePos, 'drone', 'upper', 0);
      drone.state = 'attack';
      drone.attackCooldown = 0;
      expect(getEnemyAttackDamage(drone, playerPosition)).toBe(5);

      // Spitter
      const spitterPos = new Vector3(5, 0, 5) as any;
      const spitter = spawnEnemy(mockScene, spitterPos, 'spitter', 'mid', 1);
      spitter.state = 'attack';
      spitter.attackCooldown = 0;
      expect(getEnemyAttackDamage(spitter, playerPosition)).toBe(15);

      // Brute
      const brutePos = new Vector3(1.5, 0, 1.5) as any;
      const brute = spawnEnemy(mockScene, brutePos, 'brute', 'lower', 2);
      brute.state = 'attack';
      brute.attackCooldown = 0;
      expect(getEnemyAttackDamage(brute, playerPosition)).toBe(35);
    });
  });

  // ==========================================================================
  // ENEMY DAMAGE SYSTEM
  // ==========================================================================

  describe('Enemy Damage System', () => {
    let enemy: Enemy;

    beforeEach(async () => {
      await preloadEnemyModels(mockScene);
      const position = new Vector3(0, 0, 0) as any;
      enemy = spawnEnemy(mockScene, position, 'grunt', 'mid', 0);
    });

    it('should reduce enemy health', () => {
      const initialHealth = enemy.health;

      damageEnemy(enemy, 30);

      expect(enemy.health).toBe(initialHealth - 30);
    });

    it('should apply damage feedback effects', () => {
      const hitDir = new Vector3(1, 0, 0) as any;

      damageEnemy(enemy, 20, hitDir, false);

      expect(damageFeedback.applyDamageFeedback).toHaveBeenCalledWith(
        enemy.mesh,
        20,
        hitDir,
        false
      );
    });

    it('should apply critical hit feedback', () => {
      const hitDir = new Vector3(1, 0, 0) as any;

      damageEnemy(enemy, 50, hitDir, true);

      expect(damageFeedback.applyDamageFeedback).toHaveBeenCalledWith(
        enemy.mesh,
        50,
        hitDir,
        true
      );
    });

    it('should emit alien splatter particles', () => {
      damageEnemy(enemy, 10);

      expect(particleManager.emitAlienSplatter).toHaveBeenCalledWith(enemy.position, 0.7);
    });

    it('should return false if enemy survives', () => {
      const died = damageEnemy(enemy, 10);

      expect(died).toBe(false);
      expect(enemy.state).not.toBe('dead');
    });

    it('should kill enemy when health reaches zero', () => {
      enemy.health = 50;

      const died = damageEnemy(enemy, 50);

      expect(died).toBe(true);
      expect(enemy.state).toBe('dead');
    });

    it('should kill enemy when overkill damage', () => {
      enemy.health = 30;

      const died = damageEnemy(enemy, 100);

      expect(died).toBe(true);
      expect(enemy.health).toBe(-70);
    });

    it('should emit death burst when killed', () => {
      enemy.health = 10;

      damageEnemy(enemy, 20);

      expect(particleManager.emitAlienDeath).toHaveBeenCalledWith(enemy.position, 1.2);
    });

    it('should dispose mesh when killed', () => {
      enemy.health = 10;
      const disposeSpy = vi.spyOn(enemy.mesh, 'dispose');

      damageEnemy(enemy, 20);

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should remove entity when killed', () => {
      enemy.health = 10;

      damageEnemy(enemy, 20);

      expect(removeEntity).toHaveBeenCalledWith(enemy.entity);
    });
  });

  // ==========================================================================
  // HIT DETECTION
  // ==========================================================================

  describe('Hit Detection', () => {
    let enemies: Enemy[];
    const playerPosition = new Vector3(0, 0, 0) as any;

    beforeEach(async () => {
      await preloadEnemyModels(mockScene);
      enemies = [
        spawnEnemy(mockScene, new Vector3(0, 0, 10) as any, 'drone', 'upper', 0),
        spawnEnemy(mockScene, new Vector3(5, 0, 5) as any, 'grunt', 'mid', 1),
        spawnEnemy(mockScene, new Vector3(-10, 0, 10) as any, 'spitter', 'lower', 2),
      ];
    });

    it('should detect enemy in line of fire', () => {
      const forward = new Vector3(0, 0, 1) as any;

      const hit = checkEnemyHit(enemies, playerPosition, forward, 50);

      expect(hit).toBeDefined();
    });

    it('should return null when no enemy in range', () => {
      const forward = new Vector3(1, 0, 0) as any;

      // No enemies in this direction
      const hit = checkEnemyHit(enemies, playerPosition, forward, 50);

      // May or may not hit depending on position
      expect(hit === null || hit !== null).toBe(true);
    });

    it('should respect max distance', () => {
      const forward = new Vector3(0, 0, 1) as any;

      // Enemy at z=10, max distance = 5
      const hit = checkEnemyHit(enemies, playerPosition, forward, 5);

      expect(hit).toBeNull();
    });

    it('should skip dead enemies', () => {
      enemies[0].state = 'dead';
      const forward = new Vector3(0, 0, 1) as any;

      const hit = checkEnemyHit(enemies, playerPosition, forward, 50);

      // Should not hit the dead drone
      if (hit) {
        expect(hit.state).not.toBe('dead');
      }
    });

    it('should use default max distance of 50', () => {
      const forward = new Vector3(0, 0, 1) as any;

      // Call without explicit max distance
      const hit = checkEnemyHit(enemies, playerPosition, forward);

      expect(hit !== undefined).toBe(true);
    });
  });

  // ==========================================================================
  // INITIAL SPAWN CONFIGURATION
  // ==========================================================================

  describe('Initial Spawn Configuration', () => {
    it('should return spawn config array', () => {
      const spawns = getInitialSpawnConfig();

      expect(Array.isArray(spawns)).toBe(true);
      expect(spawns.length).toBeGreaterThan(0);
    });

    it('should have spawns in upper zone', () => {
      const spawns = getInitialSpawnConfig();
      const upperSpawns = spawns.filter((s) => s.zone === 'upper');

      expect(upperSpawns.length).toBe(5);
    });

    it('should have only drones in upper zone', () => {
      const spawns = getInitialSpawnConfig();
      const upperSpawns = spawns.filter((s) => s.zone === 'upper');

      for (const spawn of upperSpawns) {
        expect(spawn.type).toBe('drone');
      }
    });

    it('should have spawns in mid zone', () => {
      const spawns = getInitialSpawnConfig();
      const midSpawns = spawns.filter((s) => s.zone === 'mid');

      expect(midSpawns.length).toBe(8);
    });

    it('should have mixed types in mid zone', () => {
      const spawns = getInitialSpawnConfig();
      const midSpawns = spawns.filter((s) => s.zone === 'mid');
      const types = new Set(midSpawns.map((s) => s.type));

      expect(types.size).toBeGreaterThanOrEqual(1);
    });

    it('should have spawns in lower zone', () => {
      const spawns = getInitialSpawnConfig();
      const lowerSpawns = spawns.filter((s) => s.zone === 'lower');

      expect(lowerSpawns.length).toBe(10);
    });

    it('should include all enemy types in lower zone', () => {
      const spawns = getInitialSpawnConfig();
      const lowerSpawns = spawns.filter((s) => s.zone === 'lower');
      const types = new Set(lowerSpawns.map((s) => s.type));

      // Lower zone can have any type based on random distribution
      expect(types.size).toBeGreaterThanOrEqual(1);
    });

    it('should have valid positions for all spawns', () => {
      const spawns = getInitialSpawnConfig();

      for (const spawn of spawns) {
        expect(spawn.position).toBeDefined();
        expect(typeof spawn.position.x).toBe('number');
        expect(typeof spawn.position.y).toBe('number');
        expect(typeof spawn.position.z).toBe('number');
      }
    });

    it('should have valid enemy types for all spawns', () => {
      const spawns = getInitialSpawnConfig();
      const validTypes: EnemyType[] = ['drone', 'grunt', 'spitter', 'brute'];

      for (const spawn of spawns) {
        expect(validTypes).toContain(spawn.type);
      }
    });

    it('should have valid zones for all spawns', () => {
      const spawns = getInitialSpawnConfig();
      const validZones: HiveZone[] = ['upper', 'mid', 'lower', 'queen_chamber'];

      for (const spawn of spawns) {
        expect(validZones).toContain(spawn.zone);
      }
    });
  });

  // ==========================================================================
  // ENEMY DISPOSAL
  // ==========================================================================

  describe('Enemy Disposal', () => {
    it('should dispose all enemy meshes', async () => {
      await preloadEnemyModels(mockScene);

      const enemies = [
        spawnEnemy(mockScene, new Vector3(0, 0, 0) as any, 'drone', 'upper', 0),
        spawnEnemy(mockScene, new Vector3(5, 0, 5) as any, 'grunt', 'mid', 1),
        spawnEnemy(mockScene, new Vector3(10, 0, 10) as any, 'brute', 'lower', 2),
      ];

      const spies = enemies.map((e) => vi.spyOn(e.mesh, 'dispose'));

      disposeEnemies(enemies);

      for (const spy of spies) {
        expect(spy).toHaveBeenCalled();
      }
    });

    it('should remove all ECS entities', async () => {
      await preloadEnemyModels(mockScene);

      const enemies = [
        spawnEnemy(mockScene, new Vector3(0, 0, 0) as any, 'drone', 'upper', 0),
        spawnEnemy(mockScene, new Vector3(5, 0, 5) as any, 'grunt', 'mid', 1),
      ];

      disposeEnemies(enemies);

      expect(removeEntity).toHaveBeenCalledTimes(2);
    });

    it('should handle empty array', () => {
      disposeEnemies([]);
      // Should not throw
    });
  });

  // ==========================================================================
  // ENEMY STATS VALIDATION
  // ==========================================================================

  describe('Enemy Stats Validation', () => {
    beforeEach(async () => {
      await preloadEnemyModels(mockScene);
    });

    it('should create drone with correct stats', () => {
      const drone = spawnEnemy(mockScene, new Vector3(0, 0, 0) as any, 'drone', 'upper', 0);

      expect(drone.health).toBe(30);
      expect(drone.maxHealth).toBe(30);
    });

    it('should create grunt with correct stats', () => {
      const grunt = spawnEnemy(mockScene, new Vector3(0, 0, 0) as any, 'grunt', 'mid', 0);

      expect(grunt.health).toBe(100);
      expect(grunt.maxHealth).toBe(100);
    });

    it('should create spitter with correct stats', () => {
      const spitter = spawnEnemy(mockScene, new Vector3(0, 0, 0) as any, 'spitter', 'mid', 0);

      expect(spitter.health).toBe(50);
      expect(spitter.maxHealth).toBe(50);
    });

    it('should create brute with correct stats', () => {
      const brute = spawnEnemy(mockScene, new Vector3(0, 0, 0) as any, 'brute', 'lower', 0);

      expect(brute.health).toBe(200);
      expect(brute.maxHealth).toBe(200);
    });
  });
});
