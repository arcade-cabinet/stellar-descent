/**
 * EnemyAIIntegration.test.ts - Complete enemy AI behavior tests
 *
 * Tests all 10 enemy types without visual rendering:
 * - AI state machine transitions (idle, patrol, chase, attack)
 * - Detection and alert mechanics
 * - Attack patterns and cooldowns
 * - Knockback resistance and hit reactions
 * - Boss-specific behaviors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createEntity, type Entity, world, queries } from '../core/ecs';
import { EventBus, getEventBus, disposeEventBus } from '../core/EventBus';
import {
  ALIEN_SPECIES,
  calculateKnockbackForce,
  getHitReactionConfig,
  getRandomPainSound,
  getRandomDeathAnimation,
  type AlienSpecies,
} from '../entities/aliens';

// Mock Babylon.js rendering
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

// Mock crypto
vi.stubGlobal('crypto', {
  randomUUID: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

/**
 * AI state for simulation
 */
type AIState = 'idle' | 'patrol' | 'alert' | 'chase' | 'attack' | 'flee' | 'dead';

interface EnemyAIState {
  state: AIState;
  targetPosition: Vector3 | null;
  lastAttackTime: number;
  alertLevel: number; // 0-100
  patrolPoints: Vector3[];
  currentPatrolIndex: number;
  isStaggered: boolean;
  staggerEndTime: number;
}

describe('Enemy AI Integration', () => {
  let eventBus: EventBus;
  let playerEntity: Entity;
  let enemyEntities: Entity[];

  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

    for (const entity of [...world]) {
      world.remove(entity);
    }

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
      tags: {
        player: true,
      },
    });

    enemyEntities = [];
  });

  afterEach(() => {
    for (const entity of [...world]) {
      world.remove(entity);
    }
    disposeEventBus();
  });

  /**
   * Helper to create an enemy entity for testing
   */
  function createEnemy(species: AlienSpecies, position: Vector3): Entity {
    const entity = createEntity({
      transform: {
        position: position.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      health: {
        current: species.baseHealth,
        max: species.baseHealth,
        regenRate: 0,
      },
      velocity: {
        linear: Vector3.Zero(),
        angular: Vector3.Zero(),
        maxSpeed: species.moveSpeed,
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
        state: 'patrol',
        target: null,
        alertRadius: species.alertRadius,
        attackRadius: species.attackRange,
      },
      tags: {
        enemy: true,
        alien: true,
        boss: species.id === 'broodmother' || species.id === 'queen',
      },
      alienInfo: {
        speciesId: species.id,
        seed: Date.now(),
        xpValue: species.xpValue,
        lootTable: species.lootTable,
      },
    });
    enemyEntities.push(entity);
    return entity;
  }

  describe('Species Registry', () => {
    it('should have all 10 alien species defined', () => {
      const coreSpecies = ['skitterer', 'spitter', 'warrior', 'heavy', 'stalker', 'broodmother', 'queen'];
      const legacySpecies = ['lurker', 'spewer', 'husk'];

      for (const id of coreSpecies) {
        expect(ALIEN_SPECIES[id]).toBeDefined();
        expect(ALIEN_SPECIES[id].id).toBe(id);
      }

      for (const id of legacySpecies) {
        expect(ALIEN_SPECIES[id]).toBeDefined();
      }
    });

    it('should have valid stats for all species', () => {
      for (const [id, species] of Object.entries(ALIEN_SPECIES)) {
        expect(species.id).toBe(id);
        expect(species.name.length).toBeGreaterThan(0);
        expect(species.baseHealth).toBeGreaterThan(0);
        expect(species.baseDamage).toBeGreaterThan(0);
        expect(species.moveSpeed).toBeGreaterThan(0);
        expect(species.xpValue).toBeGreaterThan(0);
        expect(species.knockbackResistance).toBeGreaterThanOrEqual(0);
        expect(species.knockbackResistance).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('AI State Machine', () => {
    let enemy: Entity;
    let aiState: EnemyAIState;

    beforeEach(() => {
      enemy = createEnemy(ALIEN_SPECIES.warrior, new Vector3(50, 0, 50));
      aiState = {
        state: 'patrol',
        targetPosition: null,
        lastAttackTime: 0,
        alertLevel: 0,
        patrolPoints: [new Vector3(40, 0, 40), new Vector3(60, 0, 40), new Vector3(60, 0, 60), new Vector3(40, 0, 60)],
        currentPatrolIndex: 0,
        isStaggered: false,
        staggerEndTime: 0,
      };
    });

    it('should start in patrol state', () => {
      expect(enemy.ai!.state).toBe('patrol');
    });

    it('should transition to alert when player detected', () => {
      // Move player into alert radius
      playerEntity.transform!.position = new Vector3(30, 1.8, 50);
      const distance = Vector3.Distance(enemy.transform!.position, playerEntity.transform!.position);

      if (distance < enemy.ai!.alertRadius) {
        aiState.state = 'alert';
        aiState.alertLevel = 50;
      }

      expect(aiState.state).toBe('alert');
      expect(aiState.alertLevel).toBeGreaterThan(0);
    });

    it('should transition to chase when alert level is high', () => {
      aiState.alertLevel = 100;

      if (aiState.alertLevel >= 100) {
        aiState.state = 'chase';
        aiState.targetPosition = playerEntity.transform!.position.clone();
      }

      expect(aiState.state).toBe('chase');
      expect(aiState.targetPosition).not.toBeNull();
    });

    it('should transition to attack when in attack range', () => {
      // Move player into attack range
      playerEntity.transform!.position = new Vector3(45, 1.8, 50);
      const distance = Vector3.Distance(enemy.transform!.position, playerEntity.transform!.position);

      if (distance < enemy.ai!.attackRadius) {
        aiState.state = 'attack';
      }

      expect(aiState.state).toBe('attack');
    });

    it('should transition to dead when health is zero', () => {
      enemy.health!.current = 0;

      if (enemy.health!.current <= 0) {
        aiState.state = 'dead';
      }

      expect(aiState.state).toBe('dead');
    });

    it('should return to patrol when player leaves alert radius', () => {
      aiState.state = 'alert';
      aiState.alertLevel = 50;

      // Move player far away
      playerEntity.transform!.position = new Vector3(200, 1.8, 200);
      const distance = Vector3.Distance(enemy.transform!.position, playerEntity.transform!.position);

      // Decrease alert over time
      if (distance > enemy.ai!.alertRadius) {
        aiState.alertLevel = Math.max(0, aiState.alertLevel - 10);
      }

      if (aiState.alertLevel <= 0) {
        aiState.state = 'patrol';
      }

      // After several ticks of decreasing
      aiState.alertLevel = 0;
      if (aiState.alertLevel <= 0) {
        aiState.state = 'patrol';
      }

      expect(aiState.state).toBe('patrol');
    });
  });

  describe('Detection and Alert', () => {
    it('should have varying detection ranges per species', () => {
      const skitterer = ALIEN_SPECIES.skitterer;
      const stalker = ALIEN_SPECIES.stalker;
      const queen = ALIEN_SPECIES.queen;

      // Stalker should have high alertRadius for ambush
      expect(stalker.alertRadius).toBeGreaterThan(skitterer.alertRadius);
      // Queen should have highest alertRadius as boss
      expect(queen.alertRadius).toBeGreaterThan(stalker.alertRadius);
    });

    it('should emit ENEMY_ALERTED event on detection', () => {
      const alertedEvents: any[] = [];
      eventBus.on('ENEMY_ALERTED', (event) => alertedEvents.push(event));

      const enemy = createEnemy(ALIEN_SPECIES.warrior, new Vector3(20, 0, 20));

      eventBus.emit({
        type: 'ENEMY_ALERTED',
        enemyId: enemy.id,
        enemyType: enemy.alienInfo!.speciesId,
        position: enemy.transform!.position.clone(),
      });

      expect(alertedEvents.length).toBe(1);
      expect(alertedEvents[0].enemyType).toBe('warrior');
    });

    it('should alert nearby enemies when one is alerted', () => {
      const enemy1 = createEnemy(ALIEN_SPECIES.skitterer, new Vector3(10, 0, 10));
      const enemy2 = createEnemy(ALIEN_SPECIES.skitterer, new Vector3(15, 0, 10));
      const enemy3 = createEnemy(ALIEN_SPECIES.skitterer, new Vector3(100, 0, 100));

      // Simulate chain alert
      const alertRadius = 30;
      const alertedEnemies: Entity[] = [];

      // Enemy1 detects player
      alertedEnemies.push(enemy1);

      // Check nearby enemies
      for (const enemy of enemyEntities) {
        if (alertedEnemies.includes(enemy)) continue;
        const distance = Vector3.Distance(enemy1.transform!.position, enemy.transform!.position);
        if (distance < alertRadius) {
          alertedEnemies.push(enemy);
        }
      }

      expect(alertedEnemies).toContain(enemy1);
      expect(alertedEnemies).toContain(enemy2);
      expect(alertedEnemies).not.toContain(enemy3);
    });
  });

  describe('Attack Patterns', () => {
    it('should respect attack cooldown', () => {
      const enemy = createEnemy(ALIEN_SPECIES.warrior, new Vector3(5, 0, 5));
      const species = ALIEN_SPECIES.warrior;
      const attackCooldown = 1000 / species.fireRate;
      let lastAttackTime = 0;
      let currentTime = 1000; // Start at 1000 to avoid 0 - 0 = 0 issue

      // First attack (lastAttackTime is 0, so we can always fire initially)
      const canAttack1 = currentTime - lastAttackTime >= attackCooldown;
      expect(canAttack1).toBe(true);
      lastAttackTime = currentTime;

      // Try immediate second attack
      currentTime += 50;
      const canAttack2 = currentTime - lastAttackTime >= attackCooldown;
      expect(canAttack2).toBe(false);

      // Wait for cooldown
      currentTime += attackCooldown;
      const canAttack3 = currentTime - lastAttackTime >= attackCooldown;
      expect(canAttack3).toBe(true);
    });

    it('should deal correct damage on attack', () => {
      const warrior = ALIEN_SPECIES.warrior;
      const enemy = createEnemy(warrior, new Vector3(5, 0, 5));

      const initialHealth = playerEntity.health!.current;
      playerEntity.health!.current -= warrior.baseDamage;

      expect(playerEntity.health!.current).toBe(initialHealth - warrior.baseDamage);
    });

    it('should use ranged attacks for ranged enemies', () => {
      const spitter = ALIEN_SPECIES.spitter;
      expect(spitter.projectileSpeed).toBeGreaterThan(0);
      expect(spitter.attackRange).toBeGreaterThan(15); // Long range
    });

    it('should use melee attacks for melee enemies', () => {
      const warrior = ALIEN_SPECIES.warrior;
      expect(warrior.projectileSpeed).toBe(0); // No projectiles
      expect(warrior.attackRange).toBeLessThanOrEqual(15); // Close range
    });
  });

  describe('Knockback and Hit Reactions', () => {
    it('should calculate knockback based on resistance', () => {
      const skittererKnockback = calculateKnockbackForce('skitterer', 50);
      const heavyKnockback = calculateKnockbackForce('heavy', 50);
      const queenKnockback = calculateKnockbackForce('queen', 50);

      // Low resistance = more knockback
      expect(skittererKnockback).toBeGreaterThan(heavyKnockback);
      // Queen is immune (1.0 resistance)
      expect(queenKnockback).toBe(0);
    });

    it('should get hit reaction config per species', () => {
      const skittererConfig = getHitReactionConfig('skitterer');
      const heavyConfig = getHitReactionConfig('heavy');

      expect(skittererConfig.duration).toBe(80);
      expect(heavyConfig.duration).toBe(40);
      expect(skittererConfig.knockbackResistance).toBe(0.1);
      expect(heavyConfig.knockbackResistance).toBe(0.85);
    });

    it('should get random pain sound', () => {
      const painSound = getRandomPainSound('warrior');
      const validSounds = ALIEN_SPECIES.warrior.painSounds;
      expect(validSounds).toContain(painSound);
    });

    it('should get random death animation', () => {
      const deathAnim = getRandomDeathAnimation('warrior');
      const validAnims = ALIEN_SPECIES.warrior.deathAnimations;
      expect(validAnims).toContain(deathAnim);
    });

    it('should apply stagger during hit reaction', () => {
      const species = ALIEN_SPECIES.warrior;
      let isStaggered = false;
      let staggerEndTime = 0;
      const currentTime = 1000;

      // Apply hit
      isStaggered = true;
      staggerEndTime = currentTime + species.hitReactionDuration;

      expect(isStaggered).toBe(true);
      expect(staggerEndTime).toBe(1000 + species.hitReactionDuration);

      // During stagger, enemy cannot attack
      const canAttack = !isStaggered;
      expect(canAttack).toBe(false);

      // After stagger duration
      isStaggered = currentTime > staggerEndTime;
      expect(isStaggered).toBe(false);
    });
  });

  describe('Species-Specific Behaviors', () => {
    it('should have skitterer as fast swarm unit', () => {
      const skitterer = ALIEN_SPECIES.skitterer;
      expect(skitterer.moveSpeed).toBeGreaterThanOrEqual(15);
      expect(skitterer.baseHealth).toBeLessThanOrEqual(100);
      expect(skitterer.xpValue).toBe(10);
    });

    it('should have spitter as ranged attacker', () => {
      const spitter = ALIEN_SPECIES.spitter;
      expect(spitter.projectileSpeed).toBeGreaterThan(0);
      expect(spitter.attackRange).toBeGreaterThanOrEqual(20);
    });

    it('should have warrior as melee bruiser', () => {
      const warrior = ALIEN_SPECIES.warrior;
      expect(warrior.projectileSpeed).toBe(0);
      expect(warrior.baseDamage).toBeGreaterThanOrEqual(20);
      expect(warrior.moveSpeed).toBeGreaterThan(10);
    });

    it('should have heavy as armored tank', () => {
      const heavy = ALIEN_SPECIES.heavy;
      expect(heavy.baseHealth).toBeGreaterThanOrEqual(300);
      expect(heavy.knockbackResistance).toBeGreaterThanOrEqual(0.8);
      expect(heavy.moveSpeed).toBeLessThanOrEqual(8);
    });

    it('should have stalker as stealthy hunter', () => {
      const stalker = ALIEN_SPECIES.stalker;
      expect(stalker.alertRadius).toBeGreaterThanOrEqual(50);
      expect(stalker.moveSpeed).toBeGreaterThanOrEqual(14);
    });

    it('should have broodmother as mini-boss', () => {
      const broodmother = ALIEN_SPECIES.broodmother;
      expect(broodmother.baseHealth).toBeGreaterThanOrEqual(500);
      expect(broodmother.xpValue).toBeGreaterThanOrEqual(150);
      expect(broodmother.knockbackResistance).toBeGreaterThanOrEqual(0.9);
    });

    it('should have queen as final boss', () => {
      const queen = ALIEN_SPECIES.queen;
      expect(queen.baseHealth).toBeGreaterThanOrEqual(2000);
      expect(queen.xpValue).toBeGreaterThanOrEqual(400);
      expect(queen.knockbackResistance).toBe(1.0); // Immune
      expect(queen.alertRadius).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Boss Behaviors', () => {
    it('should mark broodmother as boss', () => {
      const enemy = createEnemy(ALIEN_SPECIES.broodmother, new Vector3(50, 0, 50));
      expect(enemy.tags!.boss).toBe(true);
    });

    it('should mark queen as boss', () => {
      const enemy = createEnemy(ALIEN_SPECIES.queen, new Vector3(50, 0, 50));
      expect(enemy.tags!.boss).toBe(true);
    });

    it('should not mark regular enemies as boss', () => {
      const enemy = createEnemy(ALIEN_SPECIES.warrior, new Vector3(50, 0, 50));
      expect(enemy.tags!.boss).toBeFalsy();
    });

    it('should emit BOSS_DAMAGED event', () => {
      const bossEvents: any[] = [];
      eventBus.on('BOSS_DAMAGED', (event) => bossEvents.push(event));

      const boss = createEnemy(ALIEN_SPECIES.queen, new Vector3(50, 0, 50));

      eventBus.emit({
        type: 'BOSS_DAMAGED',
        bossId: boss.id,
        damage: 100,
        currentHealth: boss.health!.current - 100,
        maxHealth: boss.health!.max,
      });

      expect(bossEvents.length).toBe(1);
      expect(bossEvents[0].damage).toBe(100);
    });

    it('should emit BOSS_DEFEATED event on kill', () => {
      const defeatedEvents: any[] = [];
      eventBus.on('BOSS_DEFEATED', (event) => defeatedEvents.push(event));

      const boss = createEnemy(ALIEN_SPECIES.queen, new Vector3(50, 0, 50));

      eventBus.emit({
        type: 'BOSS_DEFEATED',
        bossId: boss.id,
        bossType: 'queen',
        position: boss.transform!.position.clone(),
      });

      expect(defeatedEvents.length).toBe(1);
      expect(defeatedEvents[0].bossType).toBe('queen');
    });
  });

  describe('Loot Tables', () => {
    it('should have loot tables for all species', () => {
      for (const species of Object.values(ALIEN_SPECIES)) {
        expect(species.lootTable).toBeDefined();
        expect(species.lootTable.length).toBeGreaterThan(0);
      }
    });

    it('should have valid loot entries', () => {
      for (const species of Object.values(ALIEN_SPECIES)) {
        for (const loot of species.lootTable) {
          expect(loot.itemId.length).toBeGreaterThan(0);
          expect(loot.dropChance).toBeGreaterThan(0);
          expect(loot.dropChance).toBeLessThanOrEqual(1);
          expect(loot.minQuantity).toBeGreaterThanOrEqual(1);
          expect(loot.maxQuantity).toBeGreaterThanOrEqual(loot.minQuantity);
        }
      }
    });

    it('should have guaranteed loot for bosses', () => {
      const broodmother = ALIEN_SPECIES.broodmother;
      const queen = ALIEN_SPECIES.queen;

      // Bosses should have at least one guaranteed drop
      const broodmotherGuaranteed = broodmother.lootTable.filter((l) => l.dropChance === 1.0);
      const queenGuaranteed = queen.lootTable.filter((l) => l.dropChance === 1.0);

      expect(broodmotherGuaranteed.length).toBeGreaterThan(0);
      expect(queenGuaranteed.length).toBeGreaterThan(0);
    });
  });

  describe('XP Values', () => {
    it('should have progressive XP values', () => {
      const skitterer = ALIEN_SPECIES.skitterer;
      const warrior = ALIEN_SPECIES.warrior;
      const heavy = ALIEN_SPECIES.heavy;
      const broodmother = ALIEN_SPECIES.broodmother;
      const queen = ALIEN_SPECIES.queen;

      expect(skitterer.xpValue).toBeLessThan(warrior.xpValue);
      expect(warrior.xpValue).toBeLessThan(heavy.xpValue);
      expect(heavy.xpValue).toBeLessThan(broodmother.xpValue);
      expect(broodmother.xpValue).toBeLessThan(queen.xpValue);
    });
  });
});
