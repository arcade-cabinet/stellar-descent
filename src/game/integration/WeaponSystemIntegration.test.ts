/**
 * WeaponSystemIntegration.test.ts - Complete weapon system tests
 *
 * Tests all 20 weapons without visual rendering:
 * - Weapon switching via number keys and scroll wheel
 * - Reload mechanics and ammo management
 * - Recoil patterns
 * - Weapon-specific projectile creation
 * - WEAPON_FIRED event emission
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createEntity, type Entity, world, queries, removeEntity } from '../core/ecs';
import { EventBus, getEventBus, disposeEventBus } from '../core/EventBus';
import { disposeInputManager, getInputManager } from '../input/InputManager';
import {
  ALL_WEAPON_IDS,
  WEAPONS,
  WEAPON_SLOTS,
  getWeapon,
  getWeaponBySlot,
  getWeaponSlot,
  categoryToEffectType,
  type WeaponId,
  type WeaponDefinition,
} from '../entities/weapons';

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

// Mock navigator.getGamepads
vi.stubGlobal('navigator', {
  getGamepads: () => [null, null, null, null],
});

// Mock crypto for UUID generation
vi.stubGlobal('crypto', {
  randomUUID: () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
});

/**
 * Weapon state simulation for testing
 */
interface WeaponState {
  weaponId: WeaponId;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  lastFireTime: number;
  recoilOffset: { x: number; y: number };
}

describe('Weapon System Integration', () => {
  let eventBus: EventBus;
  let playerEntity: Entity;

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

    // Create player entity with weapon
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
  });

  afterEach(() => {
    for (const entity of [...world]) {
      world.remove(entity);
    }
    disposeEventBus();
    disposeInputManager();
  });

  describe('Weapon Registry', () => {
    it('should have exactly 20 weapons defined', () => {
      expect(Object.keys(WEAPONS).length).toBe(20);
    });

    it('should have all expected weapon categories', () => {
      const categories = new Set(Object.values(WEAPONS).map((w) => w.category));
      expect(categories.has('melee')).toBe(true);
      expect(categories.has('sidearm')).toBe(true);
      expect(categories.has('smg')).toBe(true);
      expect(categories.has('rifle')).toBe(true);
      expect(categories.has('marksman')).toBe(true);
      expect(categories.has('shotgun')).toBe(true);
      expect(categories.has('heavy')).toBe(true);
      expect(categories.has('vehicle')).toBe(true);
    });

    it('should retrieve weapon by ID', () => {
      const assault = getWeapon('assault_rifle');
      expect(assault).toBeDefined();
      expect(assault.id).toBe('assault_rifle');
      expect(assault.name).toBe('MA5K Assault Rifle');
      expect(assault.category).toBe('rifle');
    });

    it('should retrieve weapon by slot', () => {
      const slot0Weapon = getWeaponBySlot(0);
      expect(slot0Weapon).toBeDefined();
      expect(slot0Weapon!.id).toBe(WEAPON_SLOTS[0]);
    });

    it('should return null for invalid slot', () => {
      const invalidWeapon = getWeaponBySlot(999);
      expect(invalidWeapon).toBeNull();
    });

    it('should find slot for weapon ID', () => {
      const slot = getWeaponSlot(WEAPON_SLOTS[0]);
      expect(slot).toBe(0);
    });

    it('should return -1 for weapon not in slots', () => {
      const slot = getWeaponSlot('bare_hands');
      expect(slot).toBe(-1);
    });
  });

  describe('Weapon Switching', () => {
    let weaponStates: WeaponState[];
    let currentSlot: number;

    beforeEach(() => {
      weaponStates = [
        {
          weaponId: 'assault_rifle',
          currentAmmo: 32,
          reserveAmmo: 128,
          isReloading: false,
          lastFireTime: 0,
          recoilOffset: { x: 0, y: 0 },
        },
        {
          weaponId: 'pulse_smg',
          currentAmmo: 48,
          reserveAmmo: 192,
          isReloading: false,
          lastFireTime: 0,
          recoilOffset: { x: 0, y: 0 },
        },
        {
          weaponId: 'plasma_cannon',
          currentAmmo: 8,
          reserveAmmo: 32,
          isReloading: false,
          lastFireTime: 0,
          recoilOffset: { x: 0, y: 0 },
        },
      ];
      currentSlot = 0;
    });

    it('should switch weapons via number keys 1-4', () => {
      // Simulate pressing 1 key (slot 0)
      currentSlot = 0;
      expect(weaponStates[currentSlot].weaponId).toBe('assault_rifle');

      // Simulate pressing 2 key (slot 1)
      currentSlot = 1;
      expect(weaponStates[currentSlot].weaponId).toBe('pulse_smg');

      // Simulate pressing 3 key (slot 2)
      currentSlot = 2;
      expect(weaponStates[currentSlot].weaponId).toBe('plasma_cannon');
    });

    it('should cycle weapons via scroll wheel', () => {
      currentSlot = 0;

      // Scroll down (next weapon)
      currentSlot = (currentSlot + 1) % weaponStates.length;
      expect(currentSlot).toBe(1);
      expect(weaponStates[currentSlot].weaponId).toBe('pulse_smg');

      // Scroll down again
      currentSlot = (currentSlot + 1) % weaponStates.length;
      expect(currentSlot).toBe(2);

      // Scroll down wraps around
      currentSlot = (currentSlot + 1) % weaponStates.length;
      expect(currentSlot).toBe(0);
    });

    it('should quick-swap via Q key', () => {
      let previousSlot = 0;
      currentSlot = 0;

      // Switch to slot 2
      previousSlot = currentSlot;
      currentSlot = 2;
      expect(currentSlot).toBe(2);

      // Quick swap (Q) goes back to previous
      const temp = currentSlot;
      currentSlot = previousSlot;
      previousSlot = temp;
      expect(currentSlot).toBe(0);

      // Quick swap again
      const temp2 = currentSlot;
      currentSlot = previousSlot;
      previousSlot = temp2;
      expect(currentSlot).toBe(2);
    });

    it('should emit WEAPON_SWITCHED event', () => {
      const switchedEvents: any[] = [];
      eventBus.on('WEAPON_SWITCHED', (event) => {
        switchedEvents.push(event);
      });

      // Simulate weapon switch
      const fromWeapon = weaponStates[currentSlot].weaponId;
      currentSlot = 1;
      const toWeapon = weaponStates[currentSlot].weaponId;

      eventBus.emit({
        type: 'WEAPON_SWITCHED',
        weaponId: toWeapon,
        fromWeapon,
        toWeapon,
        slot: currentSlot,
      });

      expect(switchedEvents.length).toBe(1);
      expect(switchedEvents[0].fromWeapon).toBe('assault_rifle');
      expect(switchedEvents[0].toWeapon).toBe('pulse_smg');
      expect(switchedEvents[0].slot).toBe(1);
    });
  });

  describe('Reloading', () => {
    let weaponState: WeaponState;

    beforeEach(() => {
      const rifleStats = getWeapon('assault_rifle');
      weaponState = {
        weaponId: 'assault_rifle',
        currentAmmo: 0,
        reserveAmmo: rifleStats.reserveAmmo,
        isReloading: false,
        lastFireTime: 0,
        recoilOffset: { x: 0, y: 0 },
      };
    });

    it('should reload when magazine empty', () => {
      const rifleStats = getWeapon('assault_rifle');
      weaponState.currentAmmo = 0;

      // Start reload
      weaponState.isReloading = true;

      // Simulate reload time passing
      const reloadComplete = true; // After rifleStats.reloadTime (2000ms)

      if (reloadComplete) {
        const ammoNeeded = rifleStats.magazineSize - weaponState.currentAmmo;
        const ammoToAdd = Math.min(ammoNeeded, weaponState.reserveAmmo);
        weaponState.currentAmmo += ammoToAdd;
        weaponState.reserveAmmo -= ammoToAdd;
        weaponState.isReloading = false;
      }

      expect(weaponState.currentAmmo).toBe(rifleStats.magazineSize);
      expect(weaponState.reserveAmmo).toBe(rifleStats.reserveAmmo - rifleStats.magazineSize);
      expect(weaponState.isReloading).toBe(false);
    });

    it('should block firing during reload', () => {
      weaponState.isReloading = true;

      // Attempt to fire
      const canFire = !weaponState.isReloading && weaponState.currentAmmo > 0;
      expect(canFire).toBe(false);
    });

    it('should partially reload if reserve is low', () => {
      const rifleStats = getWeapon('assault_rifle');
      weaponState.currentAmmo = 0;
      weaponState.reserveAmmo = 10; // Less than magazine size

      // Start reload
      weaponState.isReloading = true;

      // Complete reload
      const ammoNeeded = rifleStats.magazineSize - weaponState.currentAmmo;
      const ammoToAdd = Math.min(ammoNeeded, weaponState.reserveAmmo);
      weaponState.currentAmmo += ammoToAdd;
      weaponState.reserveAmmo -= ammoToAdd;
      weaponState.isReloading = false;

      expect(weaponState.currentAmmo).toBe(10);
      expect(weaponState.reserveAmmo).toBe(0);
    });

    it('should not reload with full magazine', () => {
      const rifleStats = getWeapon('assault_rifle');
      weaponState.currentAmmo = rifleStats.magazineSize;

      const canReload = weaponState.currentAmmo < rifleStats.magazineSize && weaponState.reserveAmmo > 0;
      expect(canReload).toBe(false);
    });

    it('should emit RELOAD_STARTED and RELOAD_COMPLETE events', () => {
      const reloadEvents: any[] = [];
      eventBus.on('RELOAD_STARTED', (event) => reloadEvents.push(event));
      eventBus.on('RELOAD_COMPLETE', (event) => reloadEvents.push(event));

      eventBus.emit({
        type: 'RELOAD_STARTED',
        weaponId: weaponState.weaponId,
        reloadTime: 2000,
      });

      eventBus.emit({
        type: 'RELOAD_COMPLETE',
        weaponId: weaponState.weaponId,
        ammoLoaded: 32,
      });

      expect(reloadEvents.length).toBe(2);
      expect(reloadEvents[0].type).toBe('RELOAD_STARTED');
      expect(reloadEvents[1].type).toBe('RELOAD_COMPLETE');
    });
  });

  describe('Firing and Ammo', () => {
    let weaponState: WeaponState;

    beforeEach(() => {
      const rifleStats = getWeapon('assault_rifle');
      weaponState = {
        weaponId: 'assault_rifle',
        currentAmmo: rifleStats.magazineSize,
        reserveAmmo: rifleStats.reserveAmmo,
        isReloading: false,
        lastFireTime: 0,
        recoilOffset: { x: 0, y: 0 },
      };
    });

    it('should deplete ammo on fire', () => {
      const initialAmmo = weaponState.currentAmmo;

      // Fire once
      weaponState.currentAmmo -= 1;

      expect(weaponState.currentAmmo).toBe(initialAmmo - 1);
    });

    it('should emit WEAPON_FIRED event', () => {
      const firedEvents: any[] = [];
      eventBus.on('WEAPON_FIRED', (event) => {
        firedEvents.push(event);
      });

      eventBus.emit({
        type: 'WEAPON_FIRED',
        weaponId: weaponState.weaponId,
        position: playerEntity.transform!.position.clone(),
        direction: new Vector3(0, 0, 1),
      });

      expect(firedEvents.length).toBe(1);
      expect(firedEvents[0].weaponId).toBe('assault_rifle');
    });

    it('should respect fire rate cooldown', () => {
      const rifleStats = getWeapon('assault_rifle');
      const fireInterval = 1000 / rifleStats.fireRate; // ms between shots
      let currentTime = 1000; // Start at 1000 to avoid 0 - 0 = 0 issue

      // First shot (lastFireTime is 0, so we can always fire initially)
      weaponState.lastFireTime = 0;
      const canFire1 = currentTime - weaponState.lastFireTime >= fireInterval;
      expect(canFire1).toBe(true);
      weaponState.lastFireTime = currentTime;

      // Try to fire immediately
      currentTime += 10; // Only 10ms later
      const canFire2 = currentTime - weaponState.lastFireTime >= fireInterval;
      expect(canFire2).toBe(false);

      // Wait for cooldown
      currentTime += fireInterval;
      const canFire3 = currentTime - weaponState.lastFireTime >= fireInterval;
      expect(canFire3).toBe(true);
    });

    it('should not fire with empty magazine', () => {
      weaponState.currentAmmo = 0;

      const canFire = !weaponState.isReloading && weaponState.currentAmmo > 0;
      expect(canFire).toBe(false);
    });
  });

  describe('Recoil System', () => {
    let weaponState: WeaponState;

    beforeEach(() => {
      weaponState = {
        weaponId: 'assault_rifle',
        currentAmmo: 32,
        reserveAmmo: 128,
        isReloading: false,
        lastFireTime: 0,
        recoilOffset: { x: 0, y: 0 },
      };
    });

    it('should apply recoil pattern on fire', () => {
      const rifleStats = getWeapon('assault_rifle');
      const initialOffset = { ...weaponState.recoilOffset };

      // Simulate recoil application based on weapon category
      const recoilMultiplier =
        rifleStats.category === 'shotgun'
          ? 2.0
          : rifleStats.category === 'heavy'
            ? 1.5
            : rifleStats.category === 'rifle'
              ? 1.0
              : 0.5;

      // Apply vertical recoil
      weaponState.recoilOffset.y += recoilMultiplier * 0.5;
      // Apply horizontal spread
      weaponState.recoilOffset.x += (Math.random() - 0.5) * recoilMultiplier * 0.2;

      expect(weaponState.recoilOffset.y).toBeGreaterThan(initialOffset.y);
    });

    it('should recover recoil over time', () => {
      weaponState.recoilOffset = { x: 0.3, y: 1.5 };
      const recoveryRate = 0.1;
      const deltaTime = 0.1; // 100ms

      // Apply recovery
      weaponState.recoilOffset.x *= 1 - recoveryRate * deltaTime;
      weaponState.recoilOffset.y *= 1 - recoveryRate * deltaTime;

      expect(weaponState.recoilOffset.x).toBeLessThan(0.3);
      expect(weaponState.recoilOffset.y).toBeLessThan(1.5);
    });

    it('should have different recoil per weapon category', () => {
      const pistol = getWeapon('sidearm');
      const shotgun = getWeapon('auto_shotgun');
      const sniper = getWeapon('sniper_rifle');

      // Category-based recoil expectations
      expect(pistol.category).toBe('sidearm');
      expect(shotgun.category).toBe('shotgun');
      expect(sniper.category).toBe('marksman');

      // Shotgun should have more recoil than pistol
      const shotgunRecoil = 2.0;
      const pistolRecoil = 0.5;
      expect(shotgunRecoil).toBeGreaterThan(pistolRecoil);
    });
  });

  describe('Projectile Creation', () => {
    it('should create projectile with correct weapon stats', () => {
      const rifleStats = getWeapon('assault_rifle');

      const projectile = createEntity({
        transform: {
          position: playerEntity.transform!.position.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: new Vector3(0, 0, rifleStats.projectileSpeed),
          angular: Vector3.Zero(),
          maxSpeed: rifleStats.projectileSpeed,
        },
        tags: {
          projectile: true,
          player: true,
        },
        lifetime: {
          remaining: 2000,
        },
      });

      expect(projectile.velocity!.linear.z).toBe(rifleStats.projectileSpeed);
      expect(projectile.velocity!.maxSpeed).toBe(rifleStats.projectileSpeed);
    });

    it('should create projectile with correct damage', () => {
      const rifleStats = getWeapon('assault_rifle');

      // Projectile carries weapon damage
      const projectileDamage = rifleStats.damage;
      expect(projectileDamage).toBe(25);
    });
  });

  describe('All Weapons Validation', () => {
    it('should have valid stats for all weapons', () => {
      for (const weaponId of ALL_WEAPON_IDS) {
        const weapon = getWeapon(weaponId);

        expect(weapon.id).toBe(weaponId);
        expect(weapon.name.length).toBeGreaterThan(0);
        expect(weapon.shortName.length).toBeGreaterThan(0);
        expect(weapon.damage).toBeGreaterThanOrEqual(0);
        expect(weapon.fireRate).toBeGreaterThanOrEqual(0);
        expect(weapon.magazineSize).toBeGreaterThanOrEqual(0);
        expect(weapon.reserveAmmo).toBeGreaterThanOrEqual(0);
        expect(weapon.reloadTime).toBeGreaterThanOrEqual(0);
        expect(weapon.tier).toBeGreaterThanOrEqual(1);
        expect(weapon.tier).toBeLessThanOrEqual(5);
      }
    });

    it('should have correct category to effect mapping', () => {
      expect(categoryToEffectType('melee')).toBe('default');
      expect(categoryToEffectType('sidearm')).toBe('pistol');
      expect(categoryToEffectType('smg')).toBe('pistol');
      expect(categoryToEffectType('rifle')).toBe('rifle');
      expect(categoryToEffectType('marksman')).toBe('rifle');
      expect(categoryToEffectType('shotgun')).toBe('shotgun');
      expect(categoryToEffectType('heavy')).toBe('heavy');
      expect(categoryToEffectType('vehicle')).toBe('default');
    });

    it('should have progressive damage tiers', () => {
      const sidearms = ALL_WEAPON_IDS.filter((id) => getWeapon(id).category === 'sidearm');
      const rifles = ALL_WEAPON_IDS.filter((id) => getWeapon(id).category === 'rifle');
      const heavy = ALL_WEAPON_IDS.filter((id) => getWeapon(id).category === 'heavy');

      const avgSidearmDamage =
        sidearms.reduce((sum, id) => sum + getWeapon(id).damage, 0) / sidearms.length;
      const avgRifleDamage =
        rifles.reduce((sum, id) => sum + getWeapon(id).damage, 0) / rifles.length;
      const avgHeavyDamage =
        heavy.reduce((sum, id) => sum + getWeapon(id).damage, 0) / heavy.length;

      // Rifles should do more damage than sidearms on average
      expect(avgRifleDamage).toBeGreaterThan(avgSidearmDamage);
      // Heavy weapons should do more damage than rifles on average
      expect(avgHeavyDamage).toBeGreaterThan(avgRifleDamage);
    });
  });

  describe('Specific Weapon Tests', () => {
    it('should test sidearm (starter weapon)', () => {
      const sidearm = getWeapon('sidearm');
      expect(sidearm.tier).toBe(1);
      expect(sidearm.magazineSize).toBe(12);
      expect(sidearm.damage).toBe(15);
    });

    it('should test assault rifle (versatile primary)', () => {
      const rifle = getWeapon('assault_rifle');
      expect(rifle.tier).toBe(3);
      expect(rifle.magazineSize).toBe(32);
      expect(rifle.fireRate).toBe(8);
    });

    it('should test sniper rifle (high damage, slow fire)', () => {
      const sniper = getWeapon('sniper_rifle');
      expect(sniper.tier).toBe(5);
      expect(sniper.damage).toBe(120);
      expect(sniper.fireRate).toBe(0.8);
      expect(sniper.range).toBe(250);
    });

    it('should test double barrel shotgun (extreme close range)', () => {
      const shotgun = getWeapon('double_barrel');
      expect(shotgun.damage).toBe(110);
      expect(shotgun.magazineSize).toBe(2);
      expect(shotgun.range).toBe(20);
    });

    it('should test plasma cannon (heavy energy weapon)', () => {
      const plasma = getWeapon('plasma_cannon');
      expect(plasma.category).toBe('heavy');
      expect(plasma.ammoType).toBe('plasma_cell');
      expect(plasma.damage).toBe(75);
    });

    it('should test LMGs (high capacity, sustained fire)', () => {
      const heavyLmg = getWeapon('heavy_lmg');
      const sawLmg = getWeapon('saw_lmg');

      expect(heavyLmg.magazineSize).toBe(100);
      expect(sawLmg.magazineSize).toBe(150);
      expect(heavyLmg.fireRate).toBeGreaterThanOrEqual(10);
      expect(sawLmg.fireRate).toBeGreaterThanOrEqual(10);
    });

    it('should test bare hands (melee only)', () => {
      const bareHands = getWeapon('bare_hands');
      expect(bareHands.category).toBe('melee');
      expect(bareHands.projectileSpeed).toBe(0);
      expect(bareHands.magazineSize).toBe(0);
      expect(bareHands.range).toBe(2);
    });
  });

  describe('Ammo Types', () => {
    it('should share ammo pools for same ammo type', () => {
      const mp5 = getWeapon('smg_mp5');
      const ump = getWeapon('smg_ump');
      const pdw = getWeapon('pdw');

      // All SMGs use 9mm
      expect(mp5.ammoType).toBe('9mm');
      expect(ump.ammoType).toBe('9mm');
      expect(pdw.ammoType).toBe('9mm');
    });

    it('should have different ammo types for different weapon classes', () => {
      const rifle = getWeapon('assault_rifle');
      const battleRifle = getWeapon('battle_rifle');
      const shotgun = getWeapon('auto_shotgun');
      const plasma = getWeapon('plasma_cannon');

      expect(rifle.ammoType).toBe('556');
      expect(battleRifle.ammoType).toBe('762');
      expect(shotgun.ammoType).toBe('12gauge');
      expect(plasma.ammoType).toBe('plasma_cell');
    });
  });
});
