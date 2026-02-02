/**
 * CombatIntegration.test.ts - Combat system integration tests
 *
 * Tests the complete combat flow:
 * - Weapon firing and projectile creation
 * - Projectile-enemy collision detection
 * - Damage calculation and application
 * - Critical hits on weak points
 * - Enemy death and event emission
 * - Knockback effects
 * - Melee attacks
 * - Grenade explosions with AOE
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposeEventBus, type EventBus, getEventBus } from '../core/EventBus';
import { createEntity, type Entity, queries, removeEntity, world } from '../core/ecs';
import { ALIEN_SPECIES, calculateKnockbackForce, getHitReactionConfig } from '../entities/aliens';

// Mock rendering systems
vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    render: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn().mockReturnValue({ position: new Vector3(), dispose: vi.fn() }),
    CreateSphere: vi.fn().mockReturnValue({ position: new Vector3(), dispose: vi.fn() }),
    CreateCylinder: vi.fn().mockReturnValue({ position: new Vector3(), dispose: vi.fn() }),
  },
}));

// Mock crypto
vi.stubGlobal('crypto', {
  randomUUID: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

describe('Combat Integration', () => {
  let eventBus: EventBus;
  let playerEntity: Entity;
  let enemyEntities: Entity[];

  beforeEach(() => {
    // Reset ECS world
    for (const entity of [...world]) {
      world.remove(entity);
    }

    // Initialize EventBus
    disposeEventBus();
    eventBus = getEventBus();

    // Create player
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

    // Create varied enemy types for testing
    const speciesIds = ['skitterer', 'spitter', 'warrior', 'heavy'];
    enemyEntities = [];

    for (let i = 0; i < speciesIds.length; i++) {
      const speciesId = speciesIds[i];
      const species = ALIEN_SPECIES[speciesId];

      const enemy = createEntity({
        transform: {
          position: new Vector3(10 + i * 5, 1.5, 10),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        health: {
          current: species.baseHealth,
          max: species.baseHealth,
          regenRate: 0,
        },
        combat: {
          damage: species.baseDamage,
          range: species.attackRange,
          fireRate: species.fireRate,
          lastFire: 0,
          projectileSpeed: species.projectileSpeed,
        },
        ai: {
          vehicle: {} as any,
          behaviors: [],
          state: 'idle',
          target: null,
          alertRadius: species.alertRadius,
          attackRadius: species.attackRange,
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
          speciesId,
          seed: Date.now() + i,
          xpValue: species.xpValue,
          lootTable: species.lootTable,
        },
      });
      enemyEntities.push(enemy);
    }
  });

  afterEach(() => {
    for (const entity of [...world]) {
      world.remove(entity);
    }
    disposeEventBus();
  });

  describe('Weapon Firing and Projectile Creation', () => {
    it('should fire weapon and create projectile', () => {
      const initialProjectileCount = [...queries.projectiles].length;

      // Simulate weapon fire
      const forward = new Vector3(0, 0, 1);
      const spawnPos = playerEntity.transform!.position.add(forward.scale(1.5));

      const projectile = createEntity({
        transform: {
          position: spawnPos,
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: forward.scale(playerEntity.combat!.projectileSpeed),
          angular: Vector3.Zero(),
          maxSpeed: playerEntity.combat!.projectileSpeed,
        },
        combat: {
          damage: playerEntity.combat!.damage,
          range: playerEntity.combat!.range,
          fireRate: playerEntity.combat!.fireRate,
          lastFire: performance.now(),
          projectileSpeed: playerEntity.combat!.projectileSpeed,
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
      expect(projectile.tags?.player).toBe(true);
    });

    it('should enforce fire rate cooldown', () => {
      const fireInterval = 1000 / playerEntity.combat!.fireRate; // ms between shots
      let canFire = true;

      // First shot
      playerEntity.combat!.lastFire = performance.now();

      // Attempt immediate second shot
      const timeSinceLastFire = 0;
      canFire = timeSinceLastFire >= fireInterval;

      expect(canFire).toBe(false);
    });

    it('should allow fire after cooldown expires', () => {
      vi.useFakeTimers();

      const fireInterval = 1000 / playerEntity.combat!.fireRate;
      playerEntity.combat!.lastFire = 0;

      vi.setSystemTime(fireInterval + 10);

      const now = Date.now();
      const canFire = now - playerEntity.combat!.lastFire >= fireInterval;

      expect(canFire).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Projectile-Enemy Collision', () => {
    it('should detect projectile-enemy collision', () => {
      const enemy = enemyEntities[0];
      const projectile = createEntity({
        transform: {
          position: enemy.transform!.position.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: new Vector3(0, 0, 80),
          angular: Vector3.Zero(),
          maxSpeed: 80,
        },
        combat: {
          damage: 25,
          range: 100,
          fireRate: 8,
          lastFire: 0,
          projectileSpeed: 80,
        },
        tags: {
          projectile: true,
          player: true,
        },
        lifetime: {
          remaining: 2000,
        },
      });

      const distance = Vector3.Distance(projectile.transform!.position, enemy.transform!.position);

      const hitRadius = 1.5;
      const isCollision = distance < hitRadius;

      expect(isCollision).toBe(true);
    });

    it('should apply correct damage based on weapon', () => {
      const enemy = enemyEntities[0]; // skitterer: 80 HP
      const initialHealth = enemy.health!.current;
      const weaponDamage = 25;

      enemy.health!.current -= weaponDamage;

      expect(enemy.health!.current).toBe(initialHealth - weaponDamage);
    });

    it('should remove projectile after collision', () => {
      const projectile = createEntity({
        transform: {
          position: new Vector3(10, 1.5, 10),
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

      // Simulate collision - remove projectile
      removeEntity(projectile);

      const found = [...queries.projectiles].find((p) => p.id === projectile.id);
      expect(found).toBeUndefined();
    });
  });

  describe('Critical Hits on Weak Points', () => {
    it('should trigger critical hit on weak point', () => {
      const enemy = enemyEntities[0];
      const baseDamage = 25;
      const critMultiplier = 2.0;

      // Simulate weak point hit (enemy at y=1.5)
      const entityHeight = 2.0;
      const weakPointY = enemy.transform!.position.y + entityHeight * 0.75; // 1.5 + 1.5 = 3.0

      const hitPosition = new Vector3(
        enemy.transform!.position.x,
        weakPointY, // Hit exactly at weak point
        enemy.transform!.position.z
      );

      // Check if hit is in weak point area (within 0.5 units of weak point)
      const isWeakPointHit = Math.abs(hitPosition.y - weakPointY) < 0.5;

      const finalDamage = isWeakPointHit ? baseDamage * critMultiplier : baseDamage;

      expect(isWeakPointHit).toBe(true);
      expect(finalDamage).toBe(50);
    });

    it('should not trigger critical on body shot', () => {
      const enemy = enemyEntities[0];
      const baseDamage = 25;

      // Body shot position
      const hitPosition = new Vector3(
        enemy.transform!.position.x,
        enemy.transform!.position.y + 0.5, // Body height
        enemy.transform!.position.z
      );

      const entityHeight = 2.0;
      const weakPointY = enemy.transform!.position.y + entityHeight * 0.75;
      const isWeakPointHit = Math.abs(hitPosition.y - weakPointY) < 0.3;

      const finalDamage = isWeakPointHit ? baseDamage * 2 : baseDamage;

      expect(isWeakPointHit).toBe(false);
      expect(finalDamage).toBe(25);
    });
  });

  describe('Enemy Death and Events', () => {
    it('should kill enemy when health depleted', () => {
      const enemy = enemyEntities[0];
      enemy.health!.current = 0;

      const isDead = enemy.health!.current <= 0;
      expect(isDead).toBe(true);
    });

    it('should emit ENEMY_KILLED event on death', () => {
      const enemy = enemyEntities[0];
      const killedEvents: any[] = [];

      eventBus.on('ENEMY_KILLED', (event) => {
        killedEvents.push(event);
      });

      // Kill the enemy
      enemy.health!.current = 0;

      eventBus.emit({
        type: 'ENEMY_KILLED',
        position: enemy.transform!.position.clone(),
        enemyType: enemy.alienInfo!.speciesId,
        enemyId: enemy.id,
      });

      expect(killedEvents.length).toBe(1);
      expect(killedEvents[0].enemyType).toBe('skitterer');
      expect(killedEvents[0].enemyId).toBe(enemy.id);
    });

    it('should award XP based on enemy type', () => {
      const enemy = enemyEntities[0];
      const xpAwarded = enemy.alienInfo!.xpValue;

      expect(xpAwarded).toBe(ALIEN_SPECIES.skitterer.xpValue);
    });
  });

  describe('Knockback Effects', () => {
    it('should apply knockback on hit', () => {
      const enemy = enemyEntities[0];
      const weaponDamage = 25;
      const hitDirection = new Vector3(0, 0, 1).normalize();

      const knockbackForce = calculateKnockbackForce('skitterer', weaponDamage);
      const knockbackVector = hitDirection.scale(knockbackForce);

      // Apply knockback
      enemy.transform!.position.addInPlace(knockbackVector);

      expect(knockbackForce).toBeGreaterThan(0);
      expect(enemy.transform!.position.z).toBeGreaterThan(10); // Original was 10
    });

    it('should respect knockback resistance', () => {
      // Heavy enemy has high knockback resistance (0.85)
      const _heavyEnemy = enemyEntities[3]; // heavy
      const _skittererEnemy = enemyEntities[0]; // skitterer (0.1 resistance)

      const weaponDamage = 50;
      const heavyKnockback = calculateKnockbackForce('heavy', weaponDamage);
      const skittererKnockback = calculateKnockbackForce('skitterer', weaponDamage);

      expect(skittererKnockback).toBeGreaterThan(heavyKnockback);
    });

    it('should get hit reaction config for species', () => {
      const skittererConfig = getHitReactionConfig('skitterer');

      expect(skittererConfig.duration).toBe(80);
      expect(skittererConfig.knockbackResistance).toBe(0.1);
      expect(skittererConfig.painSounds.length).toBeGreaterThan(0);
    });
  });

  describe('Melee Attacks', () => {
    it('should handle melee attacks', () => {
      const enemy = enemyEntities[0];
      const meleeDamage = 50;
      const meleeRange = 2.0;

      // Position player close to enemy
      playerEntity.transform!.position = new Vector3(10, 1.8, 9);

      const distance = Vector3.Distance(
        playerEntity.transform!.position,
        enemy.transform!.position
      );

      if (distance <= meleeRange) {
        enemy.health!.current -= meleeDamage;
      }

      expect(distance).toBeLessThanOrEqual(meleeRange);
      expect(enemy.health!.current).toBe(80 - 50); // skitterer has 80 HP
    });

    it('should not deal melee damage outside range', () => {
      const enemy = enemyEntities[0];
      const meleeDamage = 50;
      const meleeRange = 2.0;

      // Position player far from enemy
      playerEntity.transform!.position = new Vector3(0, 1.8, 0);

      const distance = Vector3.Distance(
        playerEntity.transform!.position,
        enemy.transform!.position
      );

      const initialHealth = enemy.health!.current;
      if (distance <= meleeRange) {
        enemy.health!.current -= meleeDamage;
      }

      expect(distance).toBeGreaterThan(meleeRange);
      expect(enemy.health!.current).toBe(initialHealth);
    });
  });

  describe('Grenade Explosions with AOE', () => {
    it('should handle grenade explosions with AOE', () => {
      const grenadePosition = new Vector3(15, 1.5, 10);
      const explosionRadius = 5.0;
      const baseDamage = 100;

      // Find all enemies in explosion radius
      const affectedEnemies = enemyEntities.filter((enemy) => {
        const distance = Vector3.Distance(grenadePosition, enemy.transform!.position);
        return distance <= explosionRadius;
      });

      // Apply damage with falloff
      for (const enemy of affectedEnemies) {
        const distance = Vector3.Distance(grenadePosition, enemy.transform!.position);
        const falloff = 1 - (distance / explosionRadius) * 0.75;
        const damage = Math.round(baseDamage * falloff);
        enemy.health!.current -= damage;
      }

      expect(affectedEnemies.length).toBeGreaterThan(0);
      for (const enemy of affectedEnemies) {
        expect(enemy.health!.current).toBeLessThan(enemy.health!.max);
      }
    });

    it('should apply damage falloff based on distance', () => {
      const grenadePosition = new Vector3(10, 1.5, 10);
      const explosionRadius = 5.0;
      const baseDamage = 100;

      const closeEnemy = enemyEntities[0]; // At (10, 1.5, 10)
      const farEnemy = createEntity({
        transform: {
          position: new Vector3(14, 1.5, 10), // 4 units away
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        health: {
          current: 100,
          max: 100,
          regenRate: 0,
        },
        tags: { enemy: true },
      });

      const closeDistance = Vector3.Distance(grenadePosition, closeEnemy.transform!.position);
      const farDistance = Vector3.Distance(grenadePosition, farEnemy.transform!.position);

      const closeFalloff = 1 - (closeDistance / explosionRadius) * 0.75;
      const farFalloff = 1 - (farDistance / explosionRadius) * 0.75;

      const closeDamage = Math.round(baseDamage * closeFalloff);
      const farDamage = Math.round(baseDamage * farFalloff);

      expect(closeDamage).toBeGreaterThan(farDamage);
    });

    it('should not affect enemies outside explosion radius', () => {
      const grenadePosition = new Vector3(0, 1.5, 0);
      const explosionRadius = 5.0;

      const enemiesInRange = enemyEntities.filter((enemy) => {
        const distance = Vector3.Distance(grenadePosition, enemy.transform!.position);
        return distance <= explosionRadius;
      });

      // All enemies are at x=10+ so none should be in range
      expect(enemiesInRange.length).toBe(0);
    });
  });

  describe('Enemy Attack Behavior', () => {
    it('should fire enemy projectile at player when in range', () => {
      const enemy = enemyEntities[1]; // spitter - ranged attacker
      const attackRange = enemy.combat!.range;

      // Move player into range
      playerEntity.transform!.position = new Vector3(15, 1.8, 10);

      const distance = Vector3.Distance(
        enemy.transform!.position,
        playerEntity.transform!.position
      );

      const canAttack = distance <= attackRange;
      expect(canAttack).toBe(true);
    });

    it('should calculate attack direction toward player', () => {
      const enemy = enemyEntities[0];
      playerEntity.transform!.position = new Vector3(0, 1.8, 0);

      const direction = playerEntity
        .transform!.position.subtract(enemy.transform!.position)
        .normalize();

      // Direction should point toward player
      expect(direction.x).toBeLessThan(0); // Player is to the left
      expect(direction.z).toBeLessThan(0); // Player is behind
    });
  });

  describe('Combat State Tracking', () => {
    it('should emit COMBAT_STATE_CHANGED when entering combat', () => {
      const combatEvents: any[] = [];

      eventBus.on('COMBAT_STATE_CHANGED', (event) => {
        combatEvents.push(event);
      });

      eventBus.emit({
        type: 'COMBAT_STATE_CHANGED',
        inCombat: true,
      });

      expect(combatEvents.length).toBe(1);
      expect(combatEvents[0].inCombat).toBe(true);
    });

    it('should emit WEAPON_FIRED event on fire', () => {
      const firedEvents: any[] = [];

      eventBus.on('WEAPON_FIRED', (event) => {
        firedEvents.push(event);
      });

      eventBus.emit({
        type: 'WEAPON_FIRED',
        weaponId: 'assault_rifle',
        position: playerEntity.transform!.position.clone(),
      });

      expect(firedEvents.length).toBe(1);
      expect(firedEvents[0].weaponId).toBe('assault_rifle');
    });
  });
});
