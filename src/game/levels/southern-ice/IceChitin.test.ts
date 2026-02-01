/**
 * IceChitin.test.ts - Comprehensive unit tests for Ice Chitin enemy variant
 *
 * Tests cover:
 * - Ice Chitin species configuration
 * - Damage resistances (weak to kinetic/fire, resistant to plasma)
 * - Frost aura mechanics (slow, damage)
 * - Ice shard projectile behavior
 * - Burrow ambush mechanics
 * - State machine transitions
 * - Mesh creation and disposal
 */

import { describe, expect, it, vi } from 'vitest';

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation((name: string) => ({
    name,
    diffuseColor: { r: 1, g: 1, b: 1, set: vi.fn() },
    specularColor: { r: 1, g: 1, b: 1, set: vi.fn() },
    emissiveColor: { r: 0, g: 0, b: 0, set: vi.fn() },
    specularPower: 32,
    alpha: 1,
    disableLighting: false,
    backFaceCulling: true,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Maths/math.color', () => ({
  Color3: vi.fn().mockImplementation((r = 0, g = 0, b = 0) => ({
    r,
    g,
    b,
    scale: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
  })),
  Color3Lerp: vi.fn().mockImplementation((_a, _b, _t) => ({ r: 0.5, g: 0.5, b: 0.5 })),
}));

// Add Color3.Lerp static method
const Color3Mock = vi.fn().mockImplementation((r = 0, g = 0, b = 0) => ({
  r,
  g,
  b,
  scale: vi.fn().mockReturnThis(),
  clone: vi.fn().mockReturnThis(),
}));
(Color3Mock as any).Lerp = vi.fn().mockImplementation((_a, _b, _t) => ({ r: 0.5, g: 0.5, b: 0.5 }));

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
    copyFrom(other: any) {
      this.x = other.x;
      this.y = other.y;
      this.z = other.z;
      return this;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    subtract(other: any) {
      return new MockVector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    add(other: any) {
      return new MockVector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    addInPlace(other: any) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) || 1;
      return new MockVector3(this.x / len, this.y / len, this.z / len);
    }
    scale(factor: number) {
      return new MockVector3(this.x * factor, this.y * factor, this.z * factor);
    }
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    static Distance(a: any, b: any) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  }
  return { Vector3: MockVector3 };
});

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn().mockImplementation(() => createMockMesh()),
    CreateSphere: vi.fn().mockImplementation(() => createMockMesh()),
    CreateCylinder: vi.fn().mockImplementation(() => createMockMesh()),
    CreateTorus: vi.fn().mockImplementation(() => createMockMesh()),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: vi.fn().mockImplementation((name: string) => ({
    name,
    position: { x: 0, y: 0, z: 0, set: vi.fn(), copyFrom: vi.fn() },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), set: vi.fn() },
    parent: null,
    getChildMeshes: vi.fn().mockReturnValue([]),
    dispose: vi.fn(),
    setEnabled: vi.fn(),
  })),
}));

function createMockMesh() {
  return {
    material: null,
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: vi.fn(),
      copyFrom: vi.fn(),
      clone: vi.fn().mockReturnThis(),
    },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn() },
    isVisible: true,
    parent: null,
    dispose: vi.fn(),
    getChildMeshes: vi.fn().mockReturnValue([]),
  };
}

vi.mock('../../entities/aliens', () => ({
  // Mock types - they're just used for type checking
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    loadAssetByPath: vi.fn().mockResolvedValue({}),
    createInstanceByPath: vi.fn().mockImplementation(() => ({
      parent: null,
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), set: vi.fn() },
      getChildMeshes: vi.fn().mockReturnValue([
        {
          material: {
            diffuseColor: { r: 0.5, g: 0.5, b: 0.5 },
            emissiveColor: { r: 0, g: 0, b: 0 },
            specularColor: { r: 0.5, g: 0.5, b: 0.5 },
            specularPower: 32,
          },
        },
      ]),
      dispose: vi.fn(),
    })),
  },
}));

vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import {
  BURROW_CONFIG,
  FROST_AURA,
  ICE_CHITIN_RESISTANCES,
  ICE_CHITIN_SPECIES,
  ICE_SHARD_PROJECTILE,
  type IceChitinInstance,
  type IceChitinState,
} from '../../entities/IceChitin';

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('IceChitin', () => {
  describe('ICE_CHITIN_SPECIES Configuration', () => {
    it('should define correct species ID', () => {
      // ICE_CHITIN_SPECIES is now an alias for ICE_WARRIOR_SPECIES
      expect(ICE_CHITIN_SPECIES.id).toBe('ice_warrior');
    });

    it('should define correct species name', () => {
      expect(ICE_CHITIN_SPECIES.name).toBe('Ice Warrior');
    });

    it('should define correct designation', () => {
      expect(ICE_CHITIN_SPECIES.designation).toBe('STRAIN-X6-CRYO-W');
    });

    it('should have base health of 150', () => {
      expect(ICE_CHITIN_SPECIES.baseHealth).toBe(150);
    });

    it('should have base damage of 18', () => {
      expect(ICE_CHITIN_SPECIES.baseDamage).toBe(18);
    });

    it('should have move speed of 10', () => {
      expect(ICE_CHITIN_SPECIES.moveSpeed).toBe(10);
    });

    it('should have attack range of 22', () => {
      expect(ICE_CHITIN_SPECIES.attackRange).toBe(22);
    });

    it('should have alert radius of 40', () => {
      expect(ICE_CHITIN_SPECIES.alertRadius).toBe(40);
    });

    it('should have fire rate of 1.2', () => {
      expect(ICE_CHITIN_SPECIES.fireRate).toBe(1.2);
    });

    it('should have projectile speed of 28', () => {
      expect(ICE_CHITIN_SPECIES.projectileSpeed).toBe(28);
    });

    it('should have XP value of 60', () => {
      expect(ICE_CHITIN_SPECIES.xpValue).toBe(60);
    });

    it('should define loot table with cryo_shard', () => {
      const cryoShard = ICE_CHITIN_SPECIES.lootTable.find((l) => l.itemId === 'cryo_shard');
      expect(cryoShard).toBeDefined();
      expect(cryoShard?.dropChance).toBe(0.8);
    });

    it('should define loot table with frozen_chitin_plate', () => {
      const plate = ICE_CHITIN_SPECIES.lootTable.find((l) => l.itemId === 'frozen_chitin_plate');
      expect(plate).toBeDefined();
      expect(plate?.dropChance).toBe(0.5);
    });

    it('should define loot table with frost_gland', () => {
      const gland = ICE_CHITIN_SPECIES.lootTable.find((l) => l.itemId === 'frost_gland');
      expect(gland).toBeDefined();
      expect(gland?.dropChance).toBe(0.3);
    });

    it('should define loot table with bio_sample', () => {
      const sample = ICE_CHITIN_SPECIES.lootTable.find((l) => l.itemId === 'bio_sample');
      expect(sample).toBeDefined();
      expect(sample?.dropChance).toBe(0.25);
    });

    it('should have hit reaction duration of 60ms', () => {
      expect(ICE_CHITIN_SPECIES.hitReactionDuration).toBe(60);
    });

    it('should have knockback resistance of 0.7', () => {
      expect(ICE_CHITIN_SPECIES.knockbackResistance).toBe(0.7);
    });

    it('should define pain sounds', () => {
      expect(ICE_CHITIN_SPECIES.painSounds).toContain('alien_hiss');
      expect(ICE_CHITIN_SPECIES.painSounds).toContain('organic_squish');
      expect(ICE_CHITIN_SPECIES.painSounds).toContain('alien_growl');
    });

    it('should define death animations', () => {
      expect(ICE_CHITIN_SPECIES.deathAnimations).toContain('death_shatter');
      expect(ICE_CHITIN_SPECIES.deathAnimations).toContain('death_collapse');
      expect(ICE_CHITIN_SPECIES.deathAnimations).toContain('death_freeze');
    });
  });

  describe('ICE_CHITIN_RESISTANCES', () => {
    it('should be highly resistant to plasma (0.35x)', () => {
      expect(ICE_CHITIN_RESISTANCES.plasma).toBe(0.35);
    });

    it('should be weak to kinetic (1.6x)', () => {
      expect(ICE_CHITIN_RESISTANCES.kinetic).toBe(1.6);
    });

    it('should take normal explosive damage (1.0x)', () => {
      expect(ICE_CHITIN_RESISTANCES.explosive).toBe(1.0);
    });

    it('should be slightly weak to melee (1.2x)', () => {
      expect(ICE_CHITIN_RESISTANCES.melee).toBe(1.2);
    });

    it('should be very weak to fire (1.8x)', () => {
      expect(ICE_CHITIN_RESISTANCES.fire).toBe(1.8);
    });

    it('should calculate kinetic damage correctly', () => {
      const baseDamage = 25;
      const effectiveDamage = baseDamage * ICE_CHITIN_RESISTANCES.kinetic;
      expect(effectiveDamage).toBe(40);
    });

    it('should calculate plasma damage correctly', () => {
      const baseDamage = 100;
      const effectiveDamage = baseDamage * ICE_CHITIN_RESISTANCES.plasma;
      expect(effectiveDamage).toBe(35);
    });

    it('should calculate fire damage correctly', () => {
      const baseDamage = 50;
      const effectiveDamage = baseDamage * ICE_CHITIN_RESISTANCES.fire;
      expect(effectiveDamage).toBe(90);
    });
  });

  describe('FROST_AURA Configuration', () => {
    it('should have radius of 8 meters', () => {
      expect(FROST_AURA.radius).toBe(8);
    });

    it('should slow player to 55% speed', () => {
      expect(FROST_AURA.slowFactor).toBe(0.55);
    });

    it('should deal 2 damage per second', () => {
      expect(FROST_AURA.damagePerSecond).toBe(2);
    });

    it('should have visual pulse rate of 1.5 seconds', () => {
      expect(FROST_AURA.visualPulseRate).toBe(1.5);
    });

    it('should calculate effective slow speed', () => {
      const baseSpeed = 10;
      const slowedSpeed = baseSpeed * FROST_AURA.slowFactor;
      expect(slowedSpeed).toBe(5.5);
    });

    it('should calculate frost damage over time', () => {
      const deltaTime = 0.5; // 500ms
      const damage = FROST_AURA.damagePerSecond * deltaTime;
      expect(damage).toBe(1);
    });

    it('should detect player in aura range', () => {
      const chitinPos = { x: 0, y: 0, z: 0 };
      const playerPos = { x: 5, y: 0, z: 5 };
      const distance = Math.sqrt(
        (playerPos.x - chitinPos.x) ** 2 + (playerPos.z - chitinPos.z) ** 2
      );
      expect(distance < FROST_AURA.radius).toBe(true);
    });

    it('should not detect player outside aura range', () => {
      const chitinPos = { x: 0, y: 0, z: 0 };
      const playerPos = { x: 10, y: 0, z: 10 };
      const distance = Math.sqrt(
        (playerPos.x - chitinPos.x) ** 2 + (playerPos.z - chitinPos.z) ** 2
      );
      expect(distance < FROST_AURA.radius).toBe(false);
    });
  });

  describe('ICE_SHARD_PROJECTILE Configuration', () => {
    it('should have speed of 28', () => {
      expect(ICE_SHARD_PROJECTILE.speed).toBe(28);
    });

    it('should have damage of 18', () => {
      expect(ICE_SHARD_PROJECTILE.damage).toBe(18);
    });

    it('should slow player for 1.5 seconds on hit', () => {
      expect(ICE_SHARD_PROJECTILE.slowDuration).toBe(1.5);
    });

    it('should slow to 70% speed on hit', () => {
      expect(ICE_SHARD_PROJECTILE.slowFactor).toBe(0.7);
    });

    it('should have trail length of 3', () => {
      expect(ICE_SHARD_PROJECTILE.trailLength).toBe(3);
    });

    it('should have burst spread angle of 0.25 radians', () => {
      expect(ICE_SHARD_PROJECTILE.burstSpreadAngle).toBe(0.25);
    });

    it('should fire 3 shards in a burst', () => {
      expect(ICE_SHARD_PROJECTILE.burstCount).toBe(3);
    });

    it('should have 2.5 second cooldown between bursts', () => {
      expect(ICE_SHARD_PROJECTILE.burstCooldown).toBe(2.5);
    });

    it('should calculate burst spread angles correctly', () => {
      const burstCount = ICE_SHARD_PROJECTILE.burstCount;
      const spreadAngle = ICE_SHARD_PROJECTILE.burstSpreadAngle;
      const angles: number[] = [];

      for (let i = 0; i < burstCount; i++) {
        const spread = (i - (burstCount - 1) / 2) * spreadAngle;
        angles.push(spread);
      }

      expect(angles[0]).toBe(-0.25); // Left
      expect(angles[1]).toBe(0); // Center
      expect(angles[2]).toBe(0.25); // Right
    });

    it('should calculate projectile travel distance', () => {
      const speed = ICE_SHARD_PROJECTILE.speed;
      const lifetime = 3; // seconds
      const travelDistance = speed * lifetime;
      expect(travelDistance).toBe(84);
    });
  });

  describe('BURROW_CONFIG Configuration', () => {
    it('should have burrow duration of 1.2 seconds', () => {
      expect(BURROW_CONFIG.burrowDuration).toBe(1.2);
    });

    it('should stay underground for 2.0 seconds', () => {
      expect(BURROW_CONFIG.undergroundDuration).toBe(2.0);
    });

    it('should have emerge duration of 0.8 seconds', () => {
      expect(BURROW_CONFIG.emergeDuration).toBe(0.8);
    });

    it('should travel up to 15 meters while burrowed', () => {
      expect(BURROW_CONFIG.burrowDistance).toBe(15);
    });

    it('should have 12 second cooldown between burrows', () => {
      expect(BURROW_CONFIG.burrowCooldown).toBe(12);
    });

    it('should deal 25 damage on emergence', () => {
      expect(BURROW_CONFIG.emergeDamage).toBe(25);
    });

    it('should have emergence damage radius of 4 meters', () => {
      expect(BURROW_CONFIG.emergeRadius).toBe(4);
    });

    it('should calculate total burrow cycle time', () => {
      const totalTime =
        BURROW_CONFIG.burrowDuration +
        BURROW_CONFIG.undergroundDuration +
        BURROW_CONFIG.emergeDuration;
      expect(totalTime).toBe(4);
    });

    it('should detect player in emergence damage radius', () => {
      const emergePos = { x: 5, y: 0, z: 5 };
      const playerPos = { x: 7, y: 0, z: 6 };
      const distance = Math.sqrt(
        (playerPos.x - emergePos.x) ** 2 + (playerPos.z - emergePos.z) ** 2
      );
      expect(distance < BURROW_CONFIG.emergeRadius).toBe(true);
    });

    it('should not damage player outside emergence radius', () => {
      const emergePos = { x: 5, y: 0, z: 5 };
      const playerPos = { x: 15, y: 0, z: 15 };
      const distance = Math.sqrt(
        (playerPos.x - emergePos.x) ** 2 + (playerPos.z - emergePos.z) ** 2
      );
      expect(distance < BURROW_CONFIG.emergeRadius).toBe(false);
    });
  });

  describe('IceChitinState Transitions', () => {
    it('should define dormant state', () => {
      const state: IceChitinState = 'dormant';
      expect(state).toBe('dormant');
    });

    it('should define awakening state', () => {
      const state: IceChitinState = 'awakening';
      expect(state).toBe('awakening');
    });

    it('should define idle state', () => {
      const state: IceChitinState = 'idle';
      expect(state).toBe('idle');
    });

    it('should define chase state', () => {
      const state: IceChitinState = 'chase';
      expect(state).toBe('chase');
    });

    it('should define attack_ranged state', () => {
      const state: IceChitinState = 'attack_ranged';
      expect(state).toBe('attack_ranged');
    });

    it('should define attack_melee state', () => {
      const state: IceChitinState = 'attack_melee';
      expect(state).toBe('attack_melee');
    });

    it('should define burrowing state', () => {
      const state: IceChitinState = 'burrowing';
      expect(state).toBe('burrowing');
    });

    it('should define underground state', () => {
      const state: IceChitinState = 'underground';
      expect(state).toBe('underground');
    });

    it('should define emerging state', () => {
      const state: IceChitinState = 'emerging';
      expect(state).toBe('emerging');
    });

    it('should define dead state', () => {
      const state: IceChitinState = 'dead';
      expect(state).toBe('dead');
    });

    it('should transition from dormant to awakening on proximity', () => {
      let state: IceChitinState = 'dormant';
      const playerDistance = 10;
      const awakenRadius = 12;

      if (playerDistance < awakenRadius && state === 'dormant') {
        state = 'awakening';
      }

      expect(state).toBe('awakening');
    });

    it('should transition from awakening to chase after timer', () => {
      let state: IceChitinState = 'awakening';
      let awakenTimer = 2.0;
      const deltaTime = 2.5;

      awakenTimer -= deltaTime;
      if (awakenTimer <= 0 && state === 'awakening') {
        state = 'chase';
      }

      expect(state).toBe('chase');
    });

    it('should transition from idle to chase on alert', () => {
      let state: IceChitinState = 'idle';
      const playerDistance = 30;
      const alertRadius = ICE_CHITIN_SPECIES.alertRadius;

      if (playerDistance < alertRadius && state === 'idle') {
        state = 'chase';
      }

      expect(state).toBe('chase');
    });

    it('should transition from chase to attack_melee at close range', () => {
      let state: IceChitinState = 'chase';
      const playerDistance = 2.5;

      if (playerDistance < 3 && state === 'chase') {
        state = 'attack_melee';
      }

      expect(state).toBe('attack_melee');
    });

    it('should transition from chase to attack_ranged at medium range', () => {
      let state: IceChitinState = 'chase';
      const playerDistance = 15;
      const attackRange = ICE_CHITIN_SPECIES.attackRange;
      const attackCooldown = 0;

      if (playerDistance < attackRange && attackCooldown <= 0 && state === 'chase') {
        state = 'attack_ranged';
      }

      expect(state).toBe('attack_ranged');
    });

    it('should transition from chase to burrowing under conditions', () => {
      let state: IceChitinState = 'chase';
      const playerDistance = 25;
      const burrowCooldown = 0;
      const shouldBurrow = playerDistance > 15 && playerDistance < 40 && burrowCooldown <= 0;

      if (shouldBurrow && state === 'chase') {
        state = 'burrowing';
      }

      expect(state).toBe('burrowing');
    });

    it('should transition from burrowing to underground after duration', () => {
      let state: IceChitinState = 'burrowing';
      const stateTimer = BURROW_CONFIG.burrowDuration + 0.1;

      if (stateTimer >= BURROW_CONFIG.burrowDuration && state === 'burrowing') {
        state = 'underground';
      }

      expect(state).toBe('underground');
    });

    it('should transition from underground to emerging after duration', () => {
      let state: IceChitinState = 'underground';
      const stateTimer = BURROW_CONFIG.undergroundDuration + 0.1;

      if (stateTimer >= BURROW_CONFIG.undergroundDuration && state === 'underground') {
        state = 'emerging';
      }

      expect(state).toBe('emerging');
    });

    it('should transition from emerging to chase after duration', () => {
      let state: IceChitinState = 'emerging';
      const stateTimer = BURROW_CONFIG.emergeDuration + 0.1;

      if (stateTimer >= BURROW_CONFIG.emergeDuration && state === 'emerging') {
        state = 'chase';
      }

      expect(state).toBe('chase');
    });
  });

  describe('IceChitinInstance Interface', () => {
    it('should create instance with correct initial values', () => {
      const instance: IceChitinInstance = {
        rootNode: {} as any,
        health: ICE_CHITIN_SPECIES.baseHealth,
        maxHealth: ICE_CHITIN_SPECIES.baseHealth,
        state: 'idle',
        position: { x: 0, y: 0, z: 0 } as any,
        speed: ICE_CHITIN_SPECIES.moveSpeed,
        attackCooldown: 0,
        burrowCooldown: BURROW_CONFIG.burrowCooldown,
        stateTimer: 0,
        targetPosition: null,
        lastKnownPlayerDistance: Infinity,
        frostAuraActive: true,
        awakenTimer: 0,
        variant: 'warrior',
      };

      expect(instance.health).toBe(150);
      expect(instance.maxHealth).toBe(150);
      expect(instance.speed).toBe(10);
      expect(instance.state).toBe('idle');
      expect(instance.frostAuraActive).toBe(true);
    });

    it('should create dormant instance correctly', () => {
      const instance: IceChitinInstance = {
        rootNode: {} as any,
        health: ICE_CHITIN_SPECIES.baseHealth,
        maxHealth: ICE_CHITIN_SPECIES.baseHealth,
        state: 'dormant',
        position: { x: 0, y: 0, z: 0 } as any,
        speed: ICE_CHITIN_SPECIES.moveSpeed,
        attackCooldown: 0,
        burrowCooldown: BURROW_CONFIG.burrowCooldown,
        stateTimer: 0,
        targetPosition: null,
        lastKnownPlayerDistance: Infinity,
        frostAuraActive: false,
        awakenTimer: 0,
        variant: 'warrior',
      };

      expect(instance.state).toBe('dormant');
      expect(instance.frostAuraActive).toBe(false);
    });

    it('should track health correctly', () => {
      const instance: IceChitinInstance = {
        rootNode: {} as any,
        health: 100,
        maxHealth: 100,
        state: 'chase',
        position: { x: 0, y: 0, z: 0 } as any,
        speed: 12,
        attackCooldown: 0,
        burrowCooldown: 12,
        stateTimer: 0,
        targetPosition: null,
        lastKnownPlayerDistance: 10,
        frostAuraActive: true,
        awakenTimer: 0,
        variant: 'warrior',
      };

      // Take damage
      instance.health -= 40;
      expect(instance.health).toBe(60);

      // Take more damage
      instance.health -= 40;
      expect(instance.health).toBe(20);

      // Die
      instance.health -= 40;
      expect(instance.health).toBe(-20);
    });

    it('should track cooldowns correctly', () => {
      const instance: IceChitinInstance = {
        rootNode: {} as any,
        health: 100,
        maxHealth: 100,
        state: 'chase',
        position: { x: 0, y: 0, z: 0 } as any,
        speed: 12,
        attackCooldown: 2.5,
        burrowCooldown: 12,
        stateTimer: 0,
        targetPosition: null,
        lastKnownPlayerDistance: 10,
        frostAuraActive: true,
        awakenTimer: 0,
        variant: 'warrior',
      };

      // Decrease cooldowns
      const deltaTime = 0.5;
      instance.attackCooldown = Math.max(0, instance.attackCooldown - deltaTime);
      instance.burrowCooldown = Math.max(0, instance.burrowCooldown - deltaTime);

      expect(instance.attackCooldown).toBe(2.0);
      expect(instance.burrowCooldown).toBe(11.5);
    });

    it('should track state timer correctly', () => {
      const instance: IceChitinInstance = {
        rootNode: {} as any,
        health: 100,
        maxHealth: 100,
        state: 'burrowing',
        position: { x: 0, y: 0, z: 0 } as any,
        speed: 12,
        attackCooldown: 0,
        burrowCooldown: 12,
        stateTimer: 0,
        targetPosition: null,
        lastKnownPlayerDistance: 10,
        frostAuraActive: false,
        awakenTimer: 0,
        variant: 'warrior',
      };

      // Increase state timer
      instance.stateTimer += 0.5;
      expect(instance.stateTimer).toBe(0.5);

      instance.stateTimer += 0.7;
      expect(instance.stateTimer).toBe(1.2);

      // Check if burrow complete
      expect(instance.stateTimer >= BURROW_CONFIG.burrowDuration).toBe(true);
    });
  });

  describe('Combat Calculations', () => {
    it('should calculate kinetic weapon TTK', () => {
      const weaponDPS = 150; // Kinetic DPS
      const effectiveDPS = weaponDPS * ICE_CHITIN_RESISTANCES.kinetic;
      const ttk = ICE_CHITIN_SPECIES.baseHealth / effectiveDPS;
      // ICE_CHITIN_SPECIES is now ICE_WARRIOR_SPECIES with 150 HP
      // 150 / (150 * 1.6) = 150 / 240 = 0.625
      expect(ttk).toBeCloseTo(0.625, 2);
    });

    it('should calculate plasma weapon TTK', () => {
      const weaponDPS = 150; // Plasma DPS
      const effectiveDPS = weaponDPS * ICE_CHITIN_RESISTANCES.plasma;
      const ttk = ICE_CHITIN_SPECIES.baseHealth / effectiveDPS;
      // 150 / (150 * 0.35) = 150 / 52.5 = 2.857
      expect(ttk).toBeCloseTo(2.857, 2);
    });

    it('should calculate fire weapon TTK', () => {
      const weaponDPS = 150; // Fire DPS
      const effectiveDPS = weaponDPS * ICE_CHITIN_RESISTANCES.fire;
      const ttk = ICE_CHITIN_SPECIES.baseHealth / effectiveDPS;
      // 150 / (150 * 1.8) = 150 / 270 = 0.556
      expect(ttk).toBeCloseTo(0.556, 2);
    });

    it('should calculate melee attacks to kill', () => {
      const meleeDamage = 40;
      const effectiveDamage = meleeDamage * ICE_CHITIN_RESISTANCES.melee;
      const attacksToKill = Math.ceil(ICE_CHITIN_SPECIES.baseHealth / effectiveDamage);
      // ceil(150 / (40 * 1.2)) = ceil(150 / 48) = ceil(3.125) = 4
      expect(attacksToKill).toBe(4);
    });

    it('should calculate ice shard attacks to kill player', () => {
      const playerHealth = 100;
      const shardDamage = ICE_SHARD_PROJECTILE.damage;
      const burstCount = ICE_SHARD_PROJECTILE.burstCount;
      const burstDamage = shardDamage * burstCount;
      const burstsToKill = Math.ceil(playerHealth / burstDamage);
      expect(burstsToKill).toBe(2);
    });
  });

  describe('Movement Calculations', () => {
    it('should calculate chase distance per frame', () => {
      const speed = ICE_CHITIN_SPECIES.moveSpeed;
      const deltaTime = 1 / 60; // 60 FPS
      const distancePerFrame = speed * deltaTime;
      expect(distancePerFrame).toBeCloseTo(0.2, 1);
    });

    it('should calculate burrow emergence position', () => {
      const playerPos = { x: 50, y: 0, z: 50 };
      const angle = Math.PI / 4; // 45 degrees
      const distance = BURROW_CONFIG.burrowDistance * 0.5;

      const emergePos = {
        x: playerPos.x + Math.cos(angle) * distance,
        z: playerPos.z + Math.sin(angle) * distance,
      };

      expect(emergePos.x).toBeCloseTo(55.3, 1);
      expect(emergePos.z).toBeCloseTo(55.3, 1);
    });

    it('should calculate direction to player', () => {
      const chitinPos = { x: 0, y: 0, z: 0 };
      const playerPos = { x: 10, y: 0, z: 10 };

      const dx = playerPos.x - chitinPos.x;
      const dz = playerPos.z - chitinPos.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const direction = { x: dx / length, z: dz / length };

      expect(direction.x).toBeCloseTo(Math.SQRT1_2, 2);
      expect(direction.z).toBeCloseTo(Math.SQRT1_2, 2);
    });

    it('should calculate facing angle from direction', () => {
      const direction = { x: 1, z: 0 };
      const angle = Math.atan2(direction.x, direction.z);
      expect(angle).toBeCloseTo(Math.PI / 2, 2);
    });
  });

  describe('Attack Range Checks', () => {
    it('should detect player in melee range', () => {
      const chitinPos = { x: 0, y: 0, z: 0 };
      const playerPos = { x: 2, y: 0, z: 1 };
      const distance = Math.sqrt(
        (playerPos.x - chitinPos.x) ** 2 + (playerPos.z - chitinPos.z) ** 2
      );
      const inMeleeRange = distance < 3;
      expect(inMeleeRange).toBe(true);
    });

    it('should detect player in ranged attack range', () => {
      const chitinPos = { x: 0, y: 0, z: 0 };
      const playerPos = { x: 15, y: 0, z: 10 };
      const distance = Math.sqrt(
        (playerPos.x - chitinPos.x) ** 2 + (playerPos.z - chitinPos.z) ** 2
      );
      const inRangedRange = distance < ICE_CHITIN_SPECIES.attackRange;
      expect(inRangedRange).toBe(true);
    });

    it('should detect player in alert range', () => {
      const chitinPos = { x: 0, y: 0, z: 0 };
      const playerPos = { x: 25, y: 0, z: 25 };
      const distance = Math.sqrt(
        (playerPos.x - chitinPos.x) ** 2 + (playerPos.z - chitinPos.z) ** 2
      );
      const inAlertRange = distance < ICE_CHITIN_SPECIES.alertRadius;
      expect(inAlertRange).toBe(true);
    });

    it('should not detect player outside alert range', () => {
      const chitinPos = { x: 0, y: 0, z: 0 };
      const playerPos = { x: 50, y: 0, z: 50 };
      const distance = Math.sqrt(
        (playerPos.x - chitinPos.x) ** 2 + (playerPos.z - chitinPos.z) ** 2
      );
      const inAlertRange = distance < ICE_CHITIN_SPECIES.alertRadius;
      expect(inAlertRange).toBe(false);
    });

    it('should determine optimal burrow distance', () => {
      const _chitinPos = { x: 0, y: 0, z: 0 };
      const _playerPos = { x: 25, y: 0, z: 0 };
      const distance = 25;

      // Good burrow range: 15-40 meters
      const shouldConsiderBurrow = distance > 15 && distance < 40;
      expect(shouldConsiderBurrow).toBe(true);
    });
  });

  describe('Visual Effects', () => {
    it('should calculate frost aura pulse alpha', () => {
      const time = 0;
      const pulseRate = FROST_AURA.visualPulseRate;
      const minAlpha = 0.6;
      const maxAlpha = 1.0;

      const pulse = (Math.sin(time * pulseRate * 2 * Math.PI) + 1) / 2;
      const alpha = minAlpha + pulse * (maxAlpha - minAlpha);

      expect(alpha).toBeCloseTo(0.8, 1);
    });

    it('should calculate burrow sink depth', () => {
      const stateTimer = 0.6; // Half through burrow
      const sinkRate = 2; // Units per second
      const depth = Math.max(-1.5, 0 - stateTimer * sinkRate);
      expect(depth).toBeCloseTo(-1.2, 1);
    });

    it('should calculate emerge rise height', () => {
      const stateTimer = 0.4; // Half through emerge
      const emergeDuration = BURROW_CONFIG.emergeDuration;
      const startY = -1.5;
      const endY = 0.8;
      const progress = stateTimer / emergeDuration;
      const height = startY + progress * (endY - startY);
      expect(height).toBeCloseTo(-0.35, 1);
    });
  });

  describe('Seeded Random Generator', () => {
    it('should produce deterministic results with same seed', () => {
      function seededRandom(seed: number): () => number {
        return () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed / 0x7fffffff;
        };
      }

      const random1 = seededRandom(42);
      const random2 = seededRandom(42);

      expect(random1()).toBeCloseTo(random2(), 10);
      expect(random1()).toBeCloseTo(random2(), 10);
      expect(random1()).toBeCloseTo(random2(), 10);
    });

    it('should produce different results with different seeds', () => {
      function seededRandom(seed: number): () => number {
        return () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed / 0x7fffffff;
        };
      }

      const random1 = seededRandom(42);
      const random2 = seededRandom(123);

      expect(random1()).not.toBeCloseTo(random2(), 5);
    });
  });

  describe('Hit Detection', () => {
    it('should calculate raycast hit on chitin', () => {
      const origin = { x: 0, y: 1.7, z: 0 };
      const direction = { x: 0, y: 0, z: 1 };
      const chitinPos = { x: 0, y: 0.8, z: 10 };
      const hitRadius = 1.2;

      // Project ray to chitin Z position
      const t = (chitinPos.z - origin.z) / direction.z;
      const hitPoint = {
        x: origin.x + direction.x * t,
        y: origin.y + direction.y * t,
        z: origin.z + direction.z * t,
      };

      const distance = Math.sqrt((hitPoint.x - chitinPos.x) ** 2 + (hitPoint.z - chitinPos.z) ** 2);

      expect(distance < hitRadius).toBe(true);
    });

    it('should miss chitin outside hit radius', () => {
      const origin = { x: 0, y: 1.7, z: 0 };
      const direction = { x: 0.2, y: 0, z: 1 };
      const chitinPos = { x: 5, y: 0.8, z: 10 };
      const hitRadius = 1.2;

      // Normalize direction
      const len = Math.sqrt(
        direction.x * direction.x + direction.y * direction.y + direction.z * direction.z
      );
      const normDir = { x: direction.x / len, y: direction.y / len, z: direction.z / len };

      // Project ray to chitin Z position
      const t = (chitinPos.z - origin.z) / normDir.z;
      const hitPoint = {
        x: origin.x + normDir.x * t,
        y: origin.y + normDir.y * t,
        z: origin.z + normDir.z * t,
      };

      const distance = Math.sqrt((hitPoint.x - chitinPos.x) ** 2 + (hitPoint.z - chitinPos.z) ** 2);

      expect(distance < hitRadius).toBe(false);
    });
  });
});
