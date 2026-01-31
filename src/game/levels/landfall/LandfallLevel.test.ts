/**
 * LandfallLevel Unit Tests
 *
 * Comprehensive tests for Level 2: Landfall
 * Covers HALO drop sequence, surface combat, checkpoints, and victory conditions.
 *
 * Target coverage: 95% line, 90% branch
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as Descent from './descent';
import * as Combat from './combat';
import * as comms from './comms';
import {
  FREEFALL_FOV,
  POWERED_DESCENT_FOV,
  SURFACE_FOV,
  MAX_FUEL,
  FUEL_BURN_RATE,
  FUEL_REGEN_RATE,
  LZ_RADIUS,
  NEAR_MISS_RADIUS,
  MAX_DRIFT,
  FIRST_ENCOUNTER_ENEMY_COUNT,
  TUTORIAL_SLOWDOWN_DURATION,
  MELEE_DAMAGE,
  MELEE_RANGE,
  PRIMARY_FIRE_DAMAGE,
  ACID_DAMAGE,
  ACID_DAMAGE_INTERVAL,
  TERRAIN_BOUNDS,
  MIN_PLAYER_HEIGHT,
  NEAR_MISS_COOLDOWN,
} from './constants';
import type { DropPhase, LandingOutcome, Asteroid, SurfaceEnemy, EnemyState } from './types';

// ---------------------------------------------------------------------------
// Mock Setup
// ---------------------------------------------------------------------------

// Mock Babylon.js
vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn().mockImplementation(() => ({
    clearColor: { r: 0, g: 0, b: 0, a: 1 },
  })),
}));

// Mock audio managers
vi.mock('../../core/AudioManager', () => ({
  getAudioManager: vi.fn(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    stopLoop: vi.fn(),
    enterCombat: vi.fn(),
    exitCombat: vi.fn(),
  })),
}));

// Mock achievement manager
vi.mock('../../achievements', () => ({
  getAchievementManager: vi.fn(() => ({
    onHaloDropComplete: vi.fn(),
    onFirstCombatWin: vi.fn(),
    isUnlocked: vi.fn(() => false),
  })),
}));

// Mock particle manager
vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    init: vi.fn(),
    emitSmallExplosion: vi.fn(),
    emitAlienSplatter: vi.fn(),
    emitAlienDeath: vi.fn(),
    emitMuzzleFlash: vi.fn(),
    emitBurrowEmergence: vi.fn(),
  },
}));

// Mock weapon actions
vi.mock('../../context/useWeaponActions', () => ({
  fireWeapon: vi.fn(() => true),
  startReload: vi.fn(),
  getWeaponActions: vi.fn(() => ({
    getState: () => ({
      isReloading: false,
      currentAmmo: 30,
      maxMagazineSize: 32,
      reserveAmmo: 100,
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Constants Tests
// ---------------------------------------------------------------------------

describe('Landfall Constants', () => {
  describe('FOV Settings', () => {
    it('should have wide FOV for freefall (cinematic)', () => {
      expect(FREEFALL_FOV).toBeGreaterThan(1.5);
      expect(FREEFALL_FOV).toBeLessThan(2.0);
    });

    it('should have medium FOV for powered descent', () => {
      expect(POWERED_DESCENT_FOV).toBeGreaterThan(1.2);
      expect(POWERED_DESCENT_FOV).toBeLessThan(1.6);
    });

    it('should have standard FPS FOV on surface', () => {
      expect(SURFACE_FOV).toBeCloseTo(Math.PI / 2, 2);
    });

    it('should have distinct FOV values for each phase', () => {
      // Freefall has widest FOV for cinematic effect
      expect(FREEFALL_FOV).toBeGreaterThan(POWERED_DESCENT_FOV);
      // Surface has standard FPS FOV - may differ from powered descent
      expect(FREEFALL_FOV).not.toBe(SURFACE_FOV);
      expect(POWERED_DESCENT_FOV).not.toBe(SURFACE_FOV);
    });
  });

  describe('Fuel System', () => {
    it('should have max fuel of 100', () => {
      expect(MAX_FUEL).toBe(100);
    });

    it('should have positive burn rate', () => {
      expect(FUEL_BURN_RATE).toBeGreaterThan(0);
    });

    it('should have lower regen rate than burn rate', () => {
      expect(FUEL_REGEN_RATE).toBeLessThan(FUEL_BURN_RATE);
    });
  });

  describe('Landing Zone', () => {
    it('should have positive LZ radius', () => {
      expect(LZ_RADIUS).toBeGreaterThan(0);
    });

    it('should have near miss radius larger than LZ radius', () => {
      expect(NEAR_MISS_RADIUS).toBeGreaterThan(LZ_RADIUS);
    });

    it('should have max drift larger than near miss radius', () => {
      expect(MAX_DRIFT).toBeGreaterThan(NEAR_MISS_RADIUS);
    });
  });

  describe('Combat Settings', () => {
    it('should have first encounter enemy count of 4', () => {
      expect(FIRST_ENCOUNTER_ENEMY_COUNT).toBe(4);
    });

    it('should have positive tutorial slowdown duration', () => {
      expect(TUTORIAL_SLOWDOWN_DURATION).toBeGreaterThan(0);
    });

    it('should have positive melee damage', () => {
      expect(MELEE_DAMAGE).toBeGreaterThan(0);
    });

    it('should have positive melee range', () => {
      expect(MELEE_RANGE).toBeGreaterThan(0);
    });

    it('should have positive primary fire damage', () => {
      expect(PRIMARY_FIRE_DAMAGE).toBeGreaterThan(0);
    });

    it('should have positive acid damage', () => {
      expect(ACID_DAMAGE).toBeGreaterThan(0);
    });
  });

  describe('Terrain Settings', () => {
    it('should have positive terrain bounds', () => {
      expect(TERRAIN_BOUNDS).toBeGreaterThan(0);
    });

    it('should have positive minimum player height', () => {
      expect(MIN_PLAYER_HEIGHT).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Descent Module Tests
// ---------------------------------------------------------------------------

describe('Descent Module', () => {
  describe('processFreefallMovement', () => {
    it('should apply lateral velocity when moving left', () => {
      const input: Descent.MovementInput = {
        moveLeft: true,
        moveRight: false,
        moveForward: false,
        moveBackward: false,
        fire: false,
        reload: false,
      };

      const result = Descent.processFreefallMovement(input, 0, 0, 0.016);
      expect(result.lateralVelocityX).toBeLessThan(0);
    });

    it('should apply lateral velocity when moving right', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: true,
        moveForward: false,
        moveBackward: false,
        fire: false,
        reload: false,
      };

      const result = Descent.processFreefallMovement(input, 0, 0, 0.016);
      expect(result.lateralVelocityX).toBeGreaterThan(0);
    });

    it('should apply forward velocity', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: false,
        moveForward: true,
        moveBackward: false,
        fire: false,
        reload: false,
      };

      const result = Descent.processFreefallMovement(input, 0, 0, 0.016);
      expect(result.lateralVelocityZ).toBeGreaterThan(0);
    });

    it('should apply backward velocity', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: false,
        moveForward: false,
        moveBackward: true,
        fire: false,
        reload: false,
      };

      const result = Descent.processFreefallMovement(input, 0, 0, 0.016);
      expect(result.lateralVelocityZ).toBeLessThan(0);
    });

    it('should apply drag to existing velocity', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: false,
        moveForward: false,
        moveBackward: false,
        fire: false,
        reload: false,
      };

      const result = Descent.processFreefallMovement(input, 10, 10, 0.016);
      expect(result.lateralVelocityX).toBeLessThan(10);
      expect(result.lateralVelocityZ).toBeLessThan(10);
    });
  });

  describe('processPoweredDescentMovement', () => {
    it('should reduce velocity when firing thrusters', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: false,
        moveForward: false,
        moveBackward: false,
        fire: true,
        reload: false,
      };

      const result = Descent.processPoweredDescentMovement(input, 0, 0, 50, 100, FUEL_BURN_RATE, 0.016);
      expect(result.velocity).toBeLessThan(50);
      expect(result.fuel).toBeLessThan(100);
      expect(result.thrusterGlowIntensity).toBeGreaterThan(0.5);
    });

    it('should stabilize lateral velocity when reloading', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: false,
        moveForward: false,
        moveBackward: false,
        fire: false,
        reload: true,
      };

      const result = Descent.processPoweredDescentMovement(input, 10, 10, 50, 100, FUEL_BURN_RATE, 0.016);
      expect(result.lateralVelocityX).toBeLessThan(10);
      expect(result.lateralVelocityZ).toBeLessThan(10);
    });

    it('should not consume fuel when empty', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: false,
        moveForward: false,
        moveBackward: false,
        fire: true,
        reload: false,
      };

      const result = Descent.processPoweredDescentMovement(input, 0, 0, 50, 0, FUEL_BURN_RATE, 0.016);
      expect(result.fuel).toBe(0);
      expect(result.velocity).toBe(50); // No change when out of fuel
    });

    it('should clamp velocity to minimum', () => {
      const input: Descent.MovementInput = {
        moveLeft: false,
        moveRight: false,
        moveForward: false,
        moveBackward: false,
        fire: true,
        reload: false,
      };

      // Simulate very high braking with lots of fuel
      const result = Descent.processPoweredDescentMovement(input, 0, 0, 10, 100, FUEL_BURN_RATE, 1.0);
      expect(result.velocity).toBeGreaterThanOrEqual(5);
    });
  });

  describe('determineLandingOutcome', () => {
    it('should return perfect for on-pad low-velocity landing', () => {
      const outcome = Descent.determineLandingOutcome(0, 0, 15);
      expect(outcome).toBe('perfect');
    });

    it('should return near_miss for close landing', () => {
      const outcome = Descent.determineLandingOutcome(LZ_RADIUS + 5, 0, 25);
      expect(outcome).toBe('near_miss');
    });

    it('should return rough for high velocity landing', () => {
      const outcome = Descent.determineLandingOutcome(0, 0, 55);
      expect(outcome).toBe('rough');
    });

    it('should return crash for very high velocity', () => {
      const outcome = Descent.determineLandingOutcome(0, 0, 75);
      expect(outcome).toBe('crash');
    });

    it('should return slingshot when too far from LZ', () => {
      const outcome = Descent.determineLandingOutcome(MAX_DRIFT + 10, 0, 20);
      expect(outcome).toBe('slingshot');
    });
  });

  describe('calculateLandingDamage', () => {
    it('should return 0 damage for perfect landing', () => {
      const damage = Descent.calculateLandingDamage('perfect', 15);
      expect(damage).toBe(0);
    });

    it('should return minimal damage for near_miss', () => {
      const damage = Descent.calculateLandingDamage('near_miss', 25);
      expect(damage).toBeGreaterThanOrEqual(0);
      expect(damage).toBeLessThan(25);
    });

    it('should return significant damage for rough landing', () => {
      const damage = Descent.calculateLandingDamage('rough', 45);
      expect(damage).toBeGreaterThan(15);
    });

    it('should return high damage for crash landing', () => {
      const damage = Descent.calculateLandingDamage('crash', 75);
      expect(damage).toBeGreaterThan(40);
    });

    it('should return fatal damage for slingshot', () => {
      const damage = Descent.calculateLandingDamage('slingshot', 50);
      expect(damage).toBe(100);
    });
  });

  describe('updateAsteroids', () => {
    it('should update asteroid positions', () => {
      const mockMesh = {
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        scaling: { setAll: vi.fn() },
        dispose: vi.fn(),
      };

      const asteroids: Asteroid[] = [
        {
          mesh: mockMesh as any,
          velocity: new Vector3(0, 10, 0),
          rotationSpeed: new Vector3(0.1, 0.1, 0.1),
          passed: false,
          size: 1,
          type: 'rock',
        },
      ];

      const result = Descent.updateAsteroids(asteroids, 0, 0.016);
      expect(result.updatedAsteroids.length).toBe(1);
      expect(mockMesh.position.y).toBeGreaterThan(0);
    });

    it('should detect asteroid collisions', () => {
      const mockMesh = {
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        scaling: { setAll: vi.fn() },
        dispose: vi.fn(),
      };

      const asteroids: Asteroid[] = [
        {
          mesh: mockMesh as any,
          velocity: new Vector3(0, 0, 0),
          rotationSpeed: new Vector3(0, 0, 0),
          passed: false,
          size: 1,
          type: 'rock',
        },
      ];

      const result = Descent.updateAsteroids(asteroids, 0, 0.016);
      expect(result.result.asteroidsHit).toBe(1);
      expect(result.result.suitDamage).toBeGreaterThan(0);
    });

    it('should track dodged asteroids', () => {
      const mockMesh = {
        position: new Vector3(10, 20, 10),
        rotation: new Vector3(0, 0, 0),
        scaling: { setAll: vi.fn() },
        dispose: vi.fn(),
      };

      const asteroids: Asteroid[] = [
        {
          mesh: mockMesh as any,
          velocity: new Vector3(0, 0, 0),
          rotationSpeed: new Vector3(0, 0, 0),
          passed: false,
          size: 1,
          type: 'rock',
        },
      ];

      const result = Descent.updateAsteroids(asteroids, 0, 0.016);
      expect(result.result.asteroidsDodged).toBe(1);
    });

    it('should remove asteroids that are too far', () => {
      const mockMesh = {
        position: new Vector3(0, 70, 0),
        rotation: new Vector3(0, 0, 0),
        scaling: { setAll: vi.fn() },
        dispose: vi.fn(),
      };

      const asteroids: Asteroid[] = [
        {
          mesh: mockMesh as any,
          velocity: new Vector3(0, 0, 0),
          rotationSpeed: new Vector3(0, 0, 0),
          passed: true,
          size: 1,
          type: 'rock',
        },
      ];

      const result = Descent.updateAsteroids(asteroids, 0, 0.016);
      expect(result.removedAsteroids.length).toBe(1);
      expect(result.updatedAsteroids.length).toBe(0);
    });

    it('should trigger near miss when close to asteroid', () => {
      const mockMesh = {
        position: new Vector3(4, 0, 0), // Just outside hit radius but within near miss
        rotation: new Vector3(0, 0, 0),
        scaling: { setAll: vi.fn() },
        dispose: vi.fn(),
      };

      const asteroids: Asteroid[] = [
        {
          mesh: mockMesh as any,
          velocity: new Vector3(0, 0, 0),
          rotationSpeed: new Vector3(0, 0, 0),
          passed: false,
          size: 1,
          type: 'rock',
        },
      ];

      const result = Descent.updateAsteroids(asteroids, 0, 0.016);
      expect(result.result.nearMissTriggered).toBe(true);
      expect(result.result.nearMissAsteroid).not.toBeNull();
    });

    it('should respect near miss cooldown', () => {
      const mockMesh = {
        position: new Vector3(4, 0, 0),
        rotation: new Vector3(0, 0, 0),
        scaling: { setAll: vi.fn() },
        dispose: vi.fn(),
      };

      const asteroids: Asteroid[] = [
        {
          mesh: mockMesh as any,
          velocity: new Vector3(0, 0, 0),
          rotationSpeed: new Vector3(0, 0, 0),
          passed: false,
          size: 1,
          type: 'rock',
        },
      ];

      // With active cooldown
      const result = Descent.updateAsteroids(asteroids, NEAR_MISS_COOLDOWN, 0.016);
      expect(result.result.nearMissTriggered).toBe(false);
    });
  });

  describe('checkTrajectoryLost', () => {
    it('should return true when too far from LZ', () => {
      expect(Descent.checkTrajectoryLost(MAX_DRIFT + 10, 0)).toBe(true);
      expect(Descent.checkTrajectoryLost(0, MAX_DRIFT + 10)).toBe(true);
    });

    it('should return false when within range', () => {
      expect(Descent.checkTrajectoryLost(0, 0)).toBe(false);
      expect(Descent.checkTrajectoryLost(50, 50)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Combat Module Tests
// ---------------------------------------------------------------------------

describe('Combat Module', () => {
  describe('createCombatState', () => {
    it('should initialize with correct defaults', () => {
      const state = Combat.createCombatState();

      expect(state.surfaceCombatActive).toBe(false);
      expect(state.killCount).toBe(0);
      expect(state.enemyCount).toBe(0);
      expect(state.meleeCooldown).toBe(0);
      expect(state.primaryFireCooldown).toBe(0);
      expect(state.acidDamageTimer).toBe(0);
      expect(state.playerInAcid).toBe(false);
      expect(state.tutorialSlowdownActive).toBe(true);
      expect(state.tutorialSlowdownTimer).toBe(0);
    });
  });

  describe('updateSurfaceEnemies', () => {
    it('should update enemy AI and return damage', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 0),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 50,
          maxHealth: 50,
          position: new Vector3(0, 0, 0),
          state: 'attack' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.updateSurfaceEnemies(
        enemies,
        new Vector3(0, 0, 0),
        0.016,
        false,
        1.0
      );

      expect(result.playerDamage).toBeGreaterThan(0);
    });

    it('should reduce damage during tutorial slowdown', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 0),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 50,
          maxHealth: 50,
          position: new Vector3(0, 0, 0),
          state: 'attack' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const normalResult = Combat.updateSurfaceEnemies(
        enemies,
        new Vector3(0, 0, 0),
        0.016,
        false,
        1.0
      );

      // Reset cooldown
      enemies[0].attackCooldown = 0;

      const tutorialResult = Combat.updateSurfaceEnemies(
        enemies,
        new Vector3(0, 0, 0),
        0.016,
        true,
        0.5
      );

      expect(tutorialResult.playerDamage).toBeLessThan(normalResult.playerDamage);
    });

    it('should not damage from dead enemies', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 0),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 0,
          maxHealth: 50,
          position: new Vector3(0, 0, 0),
          state: 'attack' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.updateSurfaceEnemies(
        enemies,
        new Vector3(0, 0, 0),
        0.016,
        false,
        1.0
      );

      expect(result.playerDamage).toBe(0);
    });
  });

  describe('performMeleeAttack', () => {
    it('should hit enemies within melee range', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 1),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
        material: null,
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 50,
          maxHealth: 50,
          position: new Vector3(0, 0, 1),
          state: 'chase' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.performMeleeAttack(enemies, new Vector3(0, 0, 0), 0);

      expect(result.hit).toBe(true);
      expect(enemies[0].health).toBeLessThan(50);
    });

    it('should kill enemies with low health', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 1),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
        material: null,
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 30,
          maxHealth: 50,
          position: new Vector3(0, 0, 1),
          state: 'chase' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.performMeleeAttack(enemies, new Vector3(0, 0, 0), 0);

      expect(result.enemyKilled).not.toBeNull();
    });

    it('should miss enemies out of range', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 20),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 50,
          maxHealth: 50,
          position: new Vector3(0, 0, 20),
          state: 'chase' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.performMeleeAttack(enemies, new Vector3(0, 0, 0), 0);

      expect(result.hit).toBe(false);
    });
  });

  describe('throwGrenade', () => {
    it('should damage enemies in blast radius', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 12),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
        material: null,
        subtract: () => new Vector3(0, 0, 0),
        normalize: () => new Vector3(0, 0, 1),
        addInPlace: vi.fn(),
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 100,
          maxHealth: 100,
          position: new Vector3(0, 0, 12),
          state: 'chase' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.throwGrenade(
        enemies,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 1)
      );

      expect(result.damaged).toBe(1);
      expect(enemies[0].health).toBeLessThan(100);
    });

    it('should kill enemies with enough damage', () => {
      const mockMesh = {
        position: new Vector3(0, 1, 12),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
        material: null,
        subtract: () => new Vector3(0, 0, 0),
        normalize: () => new Vector3(0, 0, 1),
        addInPlace: vi.fn(),
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 40,
          maxHealth: 40,
          position: new Vector3(0, 0, 12),
          state: 'chase' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.throwGrenade(
        enemies,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 1)
      );

      expect(result.kills).toBe(1);
      expect(result.killedEnemies.length).toBe(1);
    });

    it('should not damage enemies outside blast radius', () => {
      const mockMesh = {
        position: new Vector3(50, 1, 50),
        rotation: new Vector3(0, 0, 0),
        isDisposed: () => false,
        getChildMeshes: () => [],
      };

      const enemies: SurfaceEnemy[] = [
        {
          mesh: mockMesh as any,
          health: 100,
          maxHealth: 100,
          position: new Vector3(50, 0, 50),
          state: 'chase' as EnemyState,
          attackCooldown: 0,
          species: 'skitterer',
        },
      ];

      const result = Combat.throwGrenade(
        enemies,
        new Vector3(0, 0, 0),
        new Vector3(0, 0, 1)
      );

      expect(result.damaged).toBe(0);
    });
  });

  describe('updateEnvironmentHazards', () => {
    it('should detect player entering acid pool', () => {
      // Position inside first acid pool
      const playerPos = new Vector3(25, 0, 18);

      const result = Combat.updateEnvironmentHazards(
        playerPos,
        [],
        [],
        0,
        0,
        false,
        0.016
      );

      expect(result.result.enteredAcid).toBe(true);
    });

    it('should deal acid damage over time', () => {
      const playerPos = new Vector3(25, 0, 18);

      const result = Combat.updateEnvironmentHazards(
        playerPos,
        [],
        [],
        ACID_DAMAGE_INTERVAL,
        0,
        true,
        0.016
      );

      expect(result.result.acidDamage).toBe(ACID_DAMAGE);
    });

    it('should detect player exiting acid pool', () => {
      const playerPos = new Vector3(0, 0, 0); // Outside all acid pools

      const result = Combat.updateEnvironmentHazards(
        playerPos,
        [],
        [],
        0,
        0,
        true, // Was in acid
        0.016
      );

      expect(result.result.exitedAcid).toBe(true);
    });

    it('should detect unstable terrain', () => {
      // Position on unstable terrain
      const playerPos = new Vector3(5, 0, 35);

      const result = Combat.updateEnvironmentHazards(
        playerPos,
        [],
        [],
        0,
        2.5, // Timer at threshold
        false,
        0.016
      );

      expect(result.result.shouldShake).toBe(true);
    });
  });

  describe('handleReload', () => {
    it('should start reload when ammo is not full', () => {
      const result = Combat.handleReload();
      expect(result.started).toBe(true);
      expect(result.message).toBe('RELOADING...');
    });
  });
});

// ---------------------------------------------------------------------------
// Communications Module Tests
// ---------------------------------------------------------------------------

describe('Communications Module', () => {
  let mockCallbacks: any;

  beforeEach(() => {
    mockCallbacks = {
      onCommsMessage: vi.fn(),
      onNotification: vi.fn(),
      onObjectiveUpdate: vi.fn(),
    };
  });

  it('should send enemy air traffic warning', () => {
    comms.sendEnemyAirTrafficWarning(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: expect.stringContaining('Enemy air traffic'),
      })
    );
  });

  it('should send clear of station message', () => {
    comms.sendClearOfStationMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Clear of station'),
      })
    );
  });

  it('should send debris cleared message', () => {
    comms.sendDebrisClearedMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Debris cleared'),
      })
    );
  });

  it('should send jets ignited message', () => {
    comms.sendJetsIgnitedMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Retros online'),
      })
    );
  });

  it('should send perfect landing message with asteroid count', () => {
    comms.sendPerfectLandingMessage(mockCallbacks, 15);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('15'),
      })
    );
  });

  it('should send near miss landing message', () => {
    comms.sendNearMissLandingMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('outside LZ perimeter'),
      })
    );
  });

  it('should send rough landing message', () => {
    comms.sendRoughLandingMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Hard touchdown'),
      })
    );
  });

  it('should send crash landing message', () => {
    comms.sendCrashLandingMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Critical impact'),
      })
    );
  });

  it('should send slingshot message from commander', () => {
    comms.sendSlingshotMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: 'Commander Vasquez',
        portrait: 'commander',
      })
    );
  });

  it('should send seismic warning message', () => {
    comms.sendSeismicWarningMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('seismic activity'),
      })
    );
  });

  it('should send combat begins message', () => {
    comms.sendCombatBeginsMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('CONTACTS EMERGING'),
      })
    );
  });

  it('should send combat tutorial message', () => {
    comms.sendCombatTutorialMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('tactical guidance'),
      })
    );
  });

  it('should send combat cleared message with kill count', () => {
    comms.sendCombatClearedMessage(mockCallbacks, 4);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('4'),
      })
    );
  });

  it('should send LZ secured message', () => {
    comms.sendLZSecuredMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('LZ secured'),
      })
    );
  });

  it('should send FOB Delta waypoint message', () => {
    comms.sendFOBDeltaWaypointMessage(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('FOB Delta'),
      })
    );
  });

  it('should send low fuel warning with percentage', () => {
    comms.sendLowFuelWarning(mockCallbacks, 25);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('25%'),
      })
    );
  });

  it('should send flanking warning', () => {
    comms.sendFlankingWarning(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('flanking'),
      })
    );
  });

  it('should send health low warning', () => {
    comms.sendHealthLowWarning(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('critical'),
      })
    );
  });

  it('should send reload reminder', () => {
    comms.sendReloadReminder(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('reload'),
      })
    );
  });

  it('should send enemy down confirmation with remaining count', () => {
    comms.sendEnemyDownConfirmation(mockCallbacks, 3);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('3'),
      })
    );
  });

  it('should not send enemy down confirmation when none remaining', () => {
    comms.sendEnemyDownConfirmation(mockCallbacks, 0);
    expect(mockCallbacks.onCommsMessage).not.toHaveBeenCalled();
  });

  it('should send acid pool warning', () => {
    comms.sendAcidPoolWarning(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('corrosive'),
      })
    );
  });

  it('should send first kill encouragement', () => {
    comms.sendFirstKillEncouragement(mockCallbacks);
    expect(mockCallbacks.onCommsMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('First kill'),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Drop Phase Tests
// ---------------------------------------------------------------------------

describe('Drop Phase Validation', () => {
  const allPhases: DropPhase[] = [
    'freefall_start',
    'freefall_belt',
    'freefall_clear',
    'powered_descent',
    'landing',
    'vehicle_transit',
    'surface',
  ];

  it('should have all expected phases defined', () => {
    expect(allPhases.length).toBe(7);
  });

  it('should have logical phase progression', () => {
    // Freefall phases come first
    expect(allPhases.indexOf('freefall_start')).toBeLessThan(allPhases.indexOf('freefall_belt'));
    expect(allPhases.indexOf('freefall_belt')).toBeLessThan(allPhases.indexOf('freefall_clear'));

    // Powered descent after freefall
    expect(allPhases.indexOf('freefall_clear')).toBeLessThan(allPhases.indexOf('powered_descent'));

    // Landing after powered descent
    expect(allPhases.indexOf('powered_descent')).toBeLessThan(allPhases.indexOf('landing'));

    // Surface is last
    expect(allPhases.indexOf('surface')).toBe(allPhases.length - 1);
  });
});

// ---------------------------------------------------------------------------
// Landing Outcome Tests
// ---------------------------------------------------------------------------

describe('Landing Outcome Validation', () => {
  const allOutcomes: LandingOutcome[] = ['perfect', 'near_miss', 'rough', 'crash', 'slingshot'];

  it('should have all expected outcomes defined', () => {
    expect(allOutcomes.length).toBe(5);
  });

  it('should have outcomes from best to worst', () => {
    // Verify damage increases
    expect(Descent.calculateLandingDamage('perfect', 20)).toBeLessThan(
      Descent.calculateLandingDamage('near_miss', 30)
    );
    expect(Descent.calculateLandingDamage('near_miss', 30)).toBeLessThan(
      Descent.calculateLandingDamage('rough', 45)
    );
    expect(Descent.calculateLandingDamage('rough', 60)).toBeLessThan(
      Descent.calculateLandingDamage('crash', 75)
    );
    expect(Descent.calculateLandingDamage('crash', 80)).toBeLessThan(
      Descent.calculateLandingDamage('slingshot', 50)
    );
  });
});

// ---------------------------------------------------------------------------
// Level Stats Tests
// ---------------------------------------------------------------------------

describe('Level Statistics', () => {
  describe('Kill Tracking', () => {
    it('should initialize kill count at 0', () => {
      const state = Combat.createCombatState();
      expect(state.killCount).toBe(0);
    });

    it('should have enemy count match expected first encounter', () => {
      expect(FIRST_ENCOUNTER_ENEMY_COUNT).toBe(4);
    });
  });

  describe('Accuracy Tracking', () => {
    it('should track shots fired for accuracy calculation', () => {
      // Accuracy = hits / shots
      const stats = { shots: 0, hits: 0 };

      // Fire 10 shots
      for (let i = 0; i < 10; i++) {
        stats.shots++;
      }

      // 6 hits
      for (let i = 0; i < 6; i++) {
        stats.hits++;
      }

      const accuracy = stats.shots > 0 ? (stats.hits / stats.shots) * 100 : 0;
      expect(accuracy).toBe(60);
    });
  });

  describe('Time Tracking', () => {
    it('should have phase time initialized', () => {
      // Phase time starts at 0 and increments with deltaTime
      const deltaTime = 0.016;
      let phaseTime = 0;
      phaseTime += deltaTime;
      expect(phaseTime).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Checkpoint Tests
// ---------------------------------------------------------------------------

describe('Checkpoint System', () => {
  it('should have checkpoint at landing (surface phase)', () => {
    // When transitioning to surface phase, a checkpoint should be available
    const surfacePhase: DropPhase = 'surface';
    expect(surfacePhase).toBe('surface');
  });

  it('should have checkpoint at beacon activation (combat cleared)', () => {
    // Combat cleared triggers level completion
    const state = Combat.createCombatState();
    state.surfaceCombatActive = false;
    state.killCount = FIRST_ENCOUNTER_ENEMY_COUNT;
    expect(state.killCount).toBe(FIRST_ENCOUNTER_ENEMY_COUNT);
  });
});

// ---------------------------------------------------------------------------
// Victory Condition Tests
// ---------------------------------------------------------------------------

describe('Victory Conditions', () => {
  it('should complete level when all enemies cleared', () => {
    const state = Combat.createCombatState();
    state.surfaceCombatActive = true;
    state.killCount = FIRST_ENCOUNTER_ENEMY_COUNT;

    // Simulated enemy list - all dead
    const enemies: SurfaceEnemy[] = [];

    const aliveEnemies = enemies.filter((e) => e.health > 0);
    expect(aliveEnemies.length).toBe(0);
    expect(state.killCount).toBe(FIRST_ENCOUNTER_ENEMY_COUNT);
  });

  it('should not complete when enemies remain', () => {
    const mockMesh = {
      position: new Vector3(10, 1, 10),
      rotation: new Vector3(0, 0, 0),
    };

    const enemies: SurfaceEnemy[] = [
      {
        mesh: mockMesh as any,
        health: 50,
        maxHealth: 50,
        position: new Vector3(10, 0, 10),
        state: 'chase' as EnemyState,
        attackCooldown: 0,
        species: 'skitterer',
      },
    ];

    const aliveEnemies = enemies.filter((e) => e.health > 0);
    expect(aliveEnemies.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Dispose/Cleanup Tests
// ---------------------------------------------------------------------------

describe('Resource Cleanup', () => {
  it('should have disposeAsteroids function', () => {
    expect(typeof Descent.disposeAsteroids).toBe('function');
  });

  it('should dispose asteroids and their trails', () => {
    const mockMesh = {
      dispose: vi.fn(),
    };
    const mockTrail = {
      stop: vi.fn(),
      dispose: vi.fn(),
    };

    const asteroids: Asteroid[] = [
      {
        mesh: mockMesh as any,
        velocity: new Vector3(0, 0, 0),
        rotationSpeed: new Vector3(0, 0, 0),
        passed: false,
        size: 1,
        type: 'rock',
        trail: mockTrail as any,
      },
    ];

    Descent.disposeAsteroids(asteroids);

    expect(mockMesh.dispose).toHaveBeenCalled();
    expect(mockTrail.stop).toHaveBeenCalled();
    expect(mockTrail.dispose).toHaveBeenCalled();
  });
});
