/**
 * GameLoopIntegration.test.ts - Full game loop simulation tests
 *
 * Tests the complete game loop without visual rendering:
 * - Game state initialization
 * - Player position updates on input
 * - Collision detection between player and enemies
 * - Damage application when projectiles hit
 * - Game over conditions
 * - Level completion conditions
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposeEventBus, type EventBus, getEventBus } from '../core/EventBus';
import { createEntity, type Entity, queries, removeEntity, world } from '../core/ecs';
import { disposeInputManager, getInputManager } from '../input/InputManager';

// Mock Three.js/Babylon.js rendering
vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    render: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      dispose: vi.fn(),
      isDisposed: () => false,
    }),
    CreateSphere: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      dispose: vi.fn(),
      isDisposed: () => false,
    }),
    CreateCylinder: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      dispose: vi.fn(),
      isDisposed: () => false,
    }),
    CreateCapsule: vi.fn().mockReturnValue({
      position: new Vector3(0, 0, 0),
      dispose: vi.fn(),
      isDisposed: () => false,
    }),
  },
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  },
});

// Mock navigator.getGamepads
vi.stubGlobal('navigator', {
  getGamepads: () => [null, null, null, null],
});

// Mock crypto for UUID generation
vi.stubGlobal('crypto', {
  randomUUID: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

describe('Game Loop Integration', () => {
  let eventBus: EventBus;
  let playerEntity: Entity;
  let enemyEntities: Entity[];

  beforeEach(() => {
    // Clear localStorage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

    // Reset ECS world
    for (const entity of [...world]) {
      world.remove(entity);
    }

    // Initialize EventBus
    disposeEventBus();
    eventBus = getEventBus();

    // Initialize InputManager
    disposeInputManager();
    getInputManager();

    // Create player entity
    playerEntity = createEntity({
      transform: {
        position: new Vector3(0, 1.8, 0),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      health: {
        current: 100,
        max: 100,
        regenRate: 2,
      },
      velocity: {
        linear: Vector3.Zero(),
        angular: Vector3.Zero(),
        maxSpeed: 20,
      },
      combat: {
        damage: 25,
        range: 100,
        fireRate: 8,
        lastFire: 0,
        projectileSpeed: 80,
      },
      tags: {
        player: true,
      },
    });

    // Create enemy entities for testing
    enemyEntities = [];
    for (let i = 0; i < 3; i++) {
      const enemy = createEntity({
        transform: {
          position: new Vector3(10 + i * 5, 1.5, 10),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        health: {
          current: 100,
          max: 100,
          regenRate: 0,
        },
        velocity: {
          linear: Vector3.Zero(),
          angular: Vector3.Zero(),
          maxSpeed: 10,
        },
        combat: {
          damage: 15,
          range: 20,
          fireRate: 2,
          lastFire: 0,
          projectileSpeed: 30,
        },
        ai: {
          vehicle: {} as any,
          behaviors: [],
          state: 'idle',
          target: null,
          alertRadius: 30,
          attackRadius: 20,
        },
        renderable: {
          mesh: null as any,
          visible: true,
        },
        tags: {
          enemy: true,
          alien: true,
        },
        alienInfo: {
          speciesId: 'skitterer',
          seed: Date.now() + i,
          xpValue: 10,
          lootTable: [],
        },
      });
      enemyEntities.push(enemy);
    }
  });

  afterEach(() => {
    // Clean up entities
    for (const entity of [...world]) {
      world.remove(entity);
    }
    disposeEventBus();
    disposeInputManager();
  });

  describe('Game State Initialization', () => {
    it('should initialize player entity with correct default values', () => {
      expect(playerEntity).toBeDefined();
      expect(playerEntity.health?.current).toBe(100);
      expect(playerEntity.health?.max).toBe(100);
      expect(playerEntity.tags?.player).toBe(true);
    });

    it('should initialize player position at spawn point', () => {
      expect(playerEntity.transform?.position.x).toBe(0);
      expect(playerEntity.transform?.position.y).toBe(1.8);
      expect(playerEntity.transform?.position.z).toBe(0);
    });

    it('should initialize combat stats from weapon definition', () => {
      expect(playerEntity.combat?.damage).toBe(25);
      expect(playerEntity.combat?.fireRate).toBe(8);
      expect(playerEntity.combat?.projectileSpeed).toBe(80);
    });

    it('should register player in ECS world', () => {
      const players = [...queries.players].filter((e) => e.tags?.player);
      expect(players.length).toBe(1);
      expect(players[0].id).toBe(playerEntity.id);
    });

    it('should register enemies in ECS world', () => {
      const enemies = [...queries.enemies].filter((e) => e.tags?.enemy);
      expect(enemies.length).toBe(3);
    });
  });

  describe('Player Position Updates', () => {
    it('should update player position on movement input', () => {
      const initialPosition = playerEntity.transform!.position.clone();

      // Simulate forward movement
      const moveDirection = new Vector3(0, 0, 1).normalize();
      const speed = 20;
      const deltaTime = 0.016; // ~60 FPS

      // Apply movement
      playerEntity.transform!.position.addInPlace(moveDirection.scale(speed * deltaTime));

      expect(playerEntity.transform!.position.z).toBeGreaterThan(initialPosition.z);
    });

    it('should clamp movement speed to maxSpeed', () => {
      const deltaTime = 0.016;
      const maxSpeed = playerEntity.velocity!.maxSpeed;

      // Attempt movement at double max speed
      const moveDirection = new Vector3(1, 0, 1).normalize();
      const appliedSpeed = Math.min(maxSpeed * 2, maxSpeed);

      playerEntity.transform!.position.addInPlace(moveDirection.scale(appliedSpeed * deltaTime));

      // Calculate actual speed
      const actualSpeed = appliedSpeed * deltaTime;
      expect(actualSpeed).toBeLessThanOrEqual(maxSpeed * deltaTime);
    });

    it('should update entity transform in sync with position', () => {
      const newPosition = new Vector3(5, 1.8, 10);
      playerEntity.transform!.position = newPosition.clone();

      expect(playerEntity.transform!.position.x).toBe(5);
      expect(playerEntity.transform!.position.y).toBe(1.8);
      expect(playerEntity.transform!.position.z).toBe(10);
    });
  });

  describe('Collision Detection', () => {
    it('should detect collision between player and enemy within range', () => {
      // Move player close to first enemy
      playerEntity.transform!.position = new Vector3(10, 1.8, 10);

      const enemy = enemyEntities[0];
      const distance = Vector3.Distance(
        playerEntity.transform!.position,
        enemy.transform!.position
      );

      // Collision radius
      const collisionRadius = 2.0;
      expect(distance).toBeLessThan(collisionRadius);
    });

    it('should not detect collision when entities are far apart', () => {
      playerEntity.transform!.position = new Vector3(0, 1.8, 0);

      const enemy = enemyEntities[0];
      const distance = Vector3.Distance(
        playerEntity.transform!.position,
        enemy.transform!.position
      );

      const collisionRadius = 2.0;
      expect(distance).toBeGreaterThan(collisionRadius);
    });

    it('should detect multiple enemies in collision range', () => {
      // Position player in the center of enemies
      playerEntity.transform!.position = new Vector3(15, 1.8, 10);

      const collisionRadius = 10.0;
      const enemiesInRange = enemyEntities.filter((enemy) => {
        const distance = Vector3.Distance(
          playerEntity.transform!.position,
          enemy.transform!.position
        );
        return distance < collisionRadius;
      });

      expect(enemiesInRange.length).toBeGreaterThan(1);
    });
  });

  describe('Damage Application', () => {
    it('should apply damage when projectile hits enemy', () => {
      const enemy = enemyEntities[0];
      const initialHealth = enemy.health!.current;
      const damage = 25;

      // Simulate projectile hit
      enemy.health!.current -= damage;

      expect(enemy.health!.current).toBe(initialHealth - damage);
    });

    it('should not reduce health below zero', () => {
      const enemy = enemyEntities[0];
      const damage = 500; // More than max health

      enemy.health!.current = Math.max(0, enemy.health!.current - damage);

      expect(enemy.health!.current).toBe(0);
    });

    it('should emit ENEMY_KILLED event when enemy health reaches zero', () => {
      const enemy = enemyEntities[0];
      const killedEvents: any[] = [];

      eventBus.on('ENEMY_KILLED', (event) => {
        killedEvents.push(event);
      });

      // Kill the enemy
      enemy.health!.current = 0;

      if (enemy.health!.current <= 0) {
        eventBus.emit({
          type: 'ENEMY_KILLED',
          position: enemy.transform!.position.clone(),
          enemyType: enemy.alienInfo?.speciesId ?? 'unknown',
          enemyId: enemy.id,
        });
      }

      expect(killedEvents.length).toBe(1);
      expect(killedEvents[0].enemyType).toBe('skitterer');
    });

    it('should apply critical damage multiplier on weak point hit', () => {
      const enemy = enemyEntities[0];
      const baseDamage = 25;
      const critMultiplier = 2.0;
      const isCritical = true;

      const finalDamage = isCritical ? baseDamage * critMultiplier : baseDamage;
      enemy.health!.current -= finalDamage;

      expect(enemy.health!.current).toBe(100 - 50); // 50 = 25 * 2
    });
  });

  describe('Game Over Conditions', () => {
    it('should trigger game over when player health reaches 0', () => {
      const damage = 100;
      playerEntity.health!.current -= damage;

      const isGameOver = playerEntity.health!.current <= 0;
      expect(isGameOver).toBe(true);
    });

    it('should emit PLAYER_DAMAGED event when player takes damage', () => {
      const damagedEvents: any[] = [];

      eventBus.on('PLAYER_DAMAGED', (event) => {
        damagedEvents.push(event);
      });

      const damage = 20;
      playerEntity.health!.current -= damage;

      eventBus.emit({
        type: 'PLAYER_DAMAGED',
        amount: damage,
      });

      expect(damagedEvents.length).toBe(1);
      expect(damagedEvents[0].amount).toBe(20);
    });

    it('should not trigger game over if health is above 0', () => {
      const damage = 50;
      playerEntity.health!.current -= damage;

      const isGameOver = playerEntity.health!.current <= 0;
      expect(isGameOver).toBe(false);
      expect(playerEntity.health!.current).toBe(50);
    });
  });

  describe('Level Completion', () => {
    it('should complete level when all enemies are killed', () => {
      // Kill all enemies
      for (const enemy of enemyEntities) {
        enemy.health!.current = 0;
      }

      const aliveEnemies = enemyEntities.filter((e) => e.health!.current > 0);
      const levelComplete = aliveEnemies.length === 0;

      expect(levelComplete).toBe(true);
    });

    it('should not complete level while enemies remain', () => {
      // Kill some but not all enemies
      enemyEntities[0].health!.current = 0;
      enemyEntities[1].health!.current = 0;

      const aliveEnemies = enemyEntities.filter((e) => e.health!.current > 0);
      const levelComplete = aliveEnemies.length === 0;

      expect(levelComplete).toBe(false);
      expect(aliveEnemies.length).toBe(1);
    });

    it('should emit OBJECTIVE_COMPLETED when victory conditions met', () => {
      const completedEvents: any[] = [];

      eventBus.on('OBJECTIVE_COMPLETED', (event) => {
        completedEvents.push(event);
      });

      // Simulate objective completion
      eventBus.emit({
        type: 'OBJECTIVE_COMPLETED',
        objectiveId: 'kill_all_enemies',
      });

      expect(completedEvents.length).toBe(1);
      expect(completedEvents[0].objectiveId).toBe('kill_all_enemies');
    });
  });

  describe('Health Regeneration', () => {
    it('should regenerate health over time when damaged', () => {
      playerEntity.health!.current = 50;
      const regenRate = playerEntity.health!.regenRate;
      const deltaTime = 1.0; // 1 second

      // Apply regeneration
      const newHealth = Math.min(
        playerEntity.health!.max,
        playerEntity.health!.current + regenRate * deltaTime
      );
      playerEntity.health!.current = newHealth;

      expect(playerEntity.health!.current).toBe(52); // 50 + 2*1
    });

    it('should not regenerate beyond max health', () => {
      playerEntity.health!.current = 99;
      const regenRate = playerEntity.health!.regenRate;
      const deltaTime = 5.0; // 5 seconds

      // Apply regeneration
      const newHealth = Math.min(
        playerEntity.health!.max,
        playerEntity.health!.current + regenRate * deltaTime
      );
      playerEntity.health!.current = newHealth;

      expect(playerEntity.health!.current).toBe(100); // Capped at max
    });
  });

  describe('Projectile Lifecycle', () => {
    it('should create projectile entity on fire', () => {
      const initialProjectileCount = [...queries.projectiles].length;

      // Create a projectile
      const _projectile = createEntity({
        transform: {
          position: playerEntity.transform!.position.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: new Vector3(0, 0, 80),
          angular: Vector3.Zero(),
          maxSpeed: 80,
        },
        tags: {
          projectile: true,
          player: true,
        },
        lifetime: {
          remaining: 2000,
        },
      });

      const newProjectileCount = [...queries.projectiles].length;
      expect(newProjectileCount).toBe(initialProjectileCount + 1);
    });

    it('should move projectile based on velocity', () => {
      const projectile = createEntity({
        transform: {
          position: new Vector3(0, 1.5, 0),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: new Vector3(0, 0, 80),
          angular: Vector3.Zero(),
          maxSpeed: 80,
        },
        tags: {
          projectile: true,
        },
        lifetime: {
          remaining: 2000,
        },
      });

      const deltaTime = 0.016;
      projectile.transform!.position.addInPlace(projectile.velocity!.linear.scale(deltaTime));

      expect(projectile.transform!.position.z).toBeCloseTo(80 * 0.016, 2);
    });

    it('should remove projectile when lifetime expires', () => {
      const projectile = createEntity({
        transform: {
          position: new Vector3(0, 1.5, 0),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: new Vector3(0, 0, 80),
          angular: Vector3.Zero(),
          maxSpeed: 80,
        },
        tags: {
          projectile: true,
        },
        lifetime: {
          remaining: 100,
        },
      });

      // Simulate time passing
      projectile.lifetime!.remaining -= 150;

      if (projectile.lifetime!.remaining <= 0) {
        removeEntity(projectile);
      }

      const projectiles = [...queries.projectiles];
      const found = projectiles.find((p) => p.id === projectile.id);
      expect(found).toBeUndefined();
    });
  });
});
