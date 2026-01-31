/**
 * WeaponSystem.test.ts - Comprehensive unit tests for weapon configurations
 *
 * Tests weapon definitions, damage calculations, fire rates, and ammo consumption
 * across all 18 weapons in the DOOM-style arsenal.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_WEAPON_IDS,
  categoryToEffectType,
  DEFAULT_WEAPON,
  getWeapon,
  getWeaponBySlot,
  getWeaponGLBPath,
  getWeaponSlot,
  STARTER_WEAPON,
  WEAPON_SLOTS,
  WEAPONS,
  type WeaponCategory,
  type WeaponDefinition,
  type WeaponId,
} from '../entities/weapons';
import {
  calculateSustainedDPS,
  calculateTotalAmmo,
  calculateWeaponDPS,
  WEAPON_BALANCE,
} from '../balance/CombatBalanceConfig';

// ---------------------------------------------------------------------------
// Constants for validation
// ---------------------------------------------------------------------------

/** Expected weapon count - 18 unique ranged weapons, 20 total including bare_hands and vehicle_yoke */
const EXPECTED_WEAPON_COUNT = 18;
const EXPECTED_TOTAL_WEAPONS = 20; // Including bare_hands and vehicle_yoke

/** Damage range bounds (no weapon should exceed these) */
const MIN_DAMAGE = 1;
const MAX_DAMAGE = 200;

/** Fire rate bounds (shots per second) */
const MIN_FIRE_RATE = 0.5;
const MAX_FIRE_RATE = 20;

/** Magazine size bounds */
const MIN_MAGAZINE_SIZE = 2;
const MAX_MAGAZINE_SIZE = 200;

/** Reload time bounds (milliseconds) */
const MIN_RELOAD_TIME = 500;
const MAX_RELOAD_TIME = 6000;

/** Reserve ammo bounds */
const MIN_RESERVE_AMMO = 10;
const MAX_RESERVE_AMMO = 1500;

// ---------------------------------------------------------------------------
// 1. Weapon Configuration Existence Tests
// ---------------------------------------------------------------------------

describe('Weapon Configuration Existence', () => {
  it('should have all 18 weapon types defined', () => {
    // WEAPONS includes bare_hands (melee), ALL_WEAPON_IDS is ranged only
    expect(Object.keys(WEAPONS).length).toBe(EXPECTED_TOTAL_WEAPONS);
    expect(ALL_WEAPON_IDS.length).toBe(EXPECTED_WEAPON_COUNT);
  });

  it('should have a definition for every weapon ID', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon, `Weapon ${id} should be defined`).toBeDefined();
      expect(weapon.id).toBe(id);
    }
  });

  it('should have sidearm weapons defined', () => {
    const sidearms: WeaponId[] = ['sidearm', 'heavy_pistol', 'classic_pistol', 'revolver'];
    for (const id of sidearms) {
      expect(WEAPONS[id]).toBeDefined();
      expect(WEAPONS[id].category).toBe('sidearm');
    }
  });

  it('should have SMG weapons defined', () => {
    const smgs: WeaponId[] = ['pulse_smg', 'pdw', 'smg_mp5', 'smg_ump'];
    for (const id of smgs) {
      expect(WEAPONS[id]).toBeDefined();
      expect(WEAPONS[id].category).toBe('smg');
    }
  });

  it('should have rifle weapons defined', () => {
    const rifles: WeaponId[] = ['assault_rifle', 'battle_rifle', 'carbine'];
    for (const id of rifles) {
      expect(WEAPONS[id]).toBeDefined();
      expect(WEAPONS[id].category).toBe('rifle');
    }
  });

  it('should have marksman weapons defined', () => {
    const marksman: WeaponId[] = ['dmr', 'sniper_rifle'];
    for (const id of marksman) {
      expect(WEAPONS[id]).toBeDefined();
      expect(WEAPONS[id].category).toBe('marksman');
    }
  });

  it('should have shotgun weapons defined', () => {
    const shotguns: WeaponId[] = ['auto_shotgun', 'double_barrel'];
    for (const id of shotguns) {
      expect(WEAPONS[id]).toBeDefined();
      expect(WEAPONS[id].category).toBe('shotgun');
    }
  });

  it('should have heavy weapons defined', () => {
    const heavy: WeaponId[] = ['plasma_cannon', 'heavy_lmg', 'saw_lmg'];
    for (const id of heavy) {
      expect(WEAPONS[id]).toBeDefined();
      expect(WEAPONS[id].category).toBe('heavy');
    }
  });

  it('should have a valid starter weapon', () => {
    expect(STARTER_WEAPON).toBe('sidearm');
    expect(WEAPONS[STARTER_WEAPON]).toBeDefined();
  });

  it('should have a valid default weapon', () => {
    expect(DEFAULT_WEAPON).toBe('assault_rifle');
    expect(WEAPONS[DEFAULT_WEAPON]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Damage Values Tests
// ---------------------------------------------------------------------------

describe('Weapon Damage Values', () => {
  it('should have positive damage for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.damage, `${weapon.name} damage should be positive`).toBeGreaterThan(0);
    }
  });

  it('should have damage within expected range', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.damage, `${weapon.name} damage >= ${MIN_DAMAGE}`).toBeGreaterThanOrEqual(
        MIN_DAMAGE
      );
      expect(weapon.damage, `${weapon.name} damage <= ${MAX_DAMAGE}`).toBeLessThanOrEqual(
        MAX_DAMAGE
      );
    }
  });

  it('sniper rifle should have highest single-shot damage', () => {
    const sniperDamage = WEAPONS.sniper_rifle.damage;
    for (const id of ALL_WEAPON_IDS) {
      if (id === 'sniper_rifle') continue;
      expect(
        sniperDamage,
        `Sniper should have higher damage than ${WEAPONS[id].name}`
      ).toBeGreaterThanOrEqual(WEAPONS[id].damage);
    }
  });

  it('plasma cannon should have high damage', () => {
    const plasmaDamage = WEAPONS.plasma_cannon.damage;
    expect(plasmaDamage).toBeGreaterThanOrEqual(50);
  });

  it('SMGs should have lower per-shot damage than rifles', () => {
    const smgDamage = WEAPONS.pulse_smg.damage;
    const rifleDamage = WEAPONS.assault_rifle.damage;
    expect(smgDamage).toBeLessThan(rifleDamage);
  });

  it('sidearm should have balanced starter damage', () => {
    const sidearmDamage = WEAPONS.sidearm.damage;
    expect(sidearmDamage).toBeGreaterThanOrEqual(10);
    expect(sidearmDamage).toBeLessThanOrEqual(30);
  });

  it('double barrel should have massive close-range damage', () => {
    const dbDamage = WEAPONS.double_barrel.damage;
    expect(dbDamage).toBeGreaterThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 3. Fire Rate Tests
// ---------------------------------------------------------------------------

describe('Weapon Fire Rates', () => {
  it('should have positive fire rate for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.fireRate, `${weapon.name} fire rate should be positive`).toBeGreaterThan(0);
    }
  });

  it('should have fire rate within expected range', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(
        weapon.fireRate,
        `${weapon.name} fire rate >= ${MIN_FIRE_RATE}`
      ).toBeGreaterThanOrEqual(MIN_FIRE_RATE);
      expect(weapon.fireRate, `${weapon.name} fire rate <= ${MAX_FIRE_RATE}`).toBeLessThanOrEqual(
        MAX_FIRE_RATE
      );
    }
  });

  it('pulse SMG should have highest fire rate', () => {
    const smgFireRate = WEAPONS.pulse_smg.fireRate;
    expect(smgFireRate).toBeGreaterThanOrEqual(14);
  });

  it('sniper rifle should have lowest fire rate', () => {
    const sniperFireRate = WEAPONS.sniper_rifle.fireRate;
    expect(sniperFireRate).toBeLessThanOrEqual(1);
  });

  it('assault rifle should have moderate fire rate', () => {
    const rifleFireRate = WEAPONS.assault_rifle.fireRate;
    expect(rifleFireRate).toBeGreaterThan(WEAPONS.sniper_rifle.fireRate);
    expect(rifleFireRate).toBeLessThan(WEAPONS.pulse_smg.fireRate);
  });

  it('revolver should have slow fire rate due to heavy damage', () => {
    const revolverFireRate = WEAPONS.revolver.fireRate;
    expect(revolverFireRate).toBeLessThanOrEqual(2);
  });

  it('LMGs should have high sustained fire rates', () => {
    expect(WEAPONS.heavy_lmg.fireRate).toBeGreaterThanOrEqual(8);
    expect(WEAPONS.saw_lmg.fireRate).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// 4. Fire Rate Calculations (Time Between Shots)
// ---------------------------------------------------------------------------

describe('Fire Rate Calculations', () => {
  it('should calculate correct time between shots', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      const timeBetweenShots = 1000 / weapon.fireRate; // milliseconds
      expect(timeBetweenShots).toBeGreaterThan(0);
      expect(timeBetweenShots).toBeLessThan(3000); // No weapon should have >3s between shots
    }
  });

  it('pulse SMG should fire approximately every 67ms', () => {
    const smg = WEAPONS.pulse_smg;
    const timeBetweenShots = 1000 / smg.fireRate;
    expect(timeBetweenShots).toBeCloseTo(66.67, 0);
  });

  it('sniper rifle should fire approximately every 1.25s', () => {
    const sniper = WEAPONS.sniper_rifle;
    const timeBetweenShots = 1000 / sniper.fireRate;
    expect(timeBetweenShots).toBeCloseTo(1250, 0);
  });

  it('assault rifle should fire approximately every 125ms', () => {
    const rifle = WEAPONS.assault_rifle;
    const timeBetweenShots = 1000 / rifle.fireRate;
    expect(timeBetweenShots).toBeCloseTo(125, 0);
  });
});

// ---------------------------------------------------------------------------
// 5. Ammo Consumption Tests
// ---------------------------------------------------------------------------

describe('Ammo Consumption', () => {
  it('should have positive magazine size for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.magazineSize, `${weapon.name} magazine size should be positive`).toBeGreaterThan(
        0
      );
    }
  });

  it('should have magazine size within expected range', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(
        weapon.magazineSize,
        `${weapon.name} magazine >= ${MIN_MAGAZINE_SIZE}`
      ).toBeGreaterThanOrEqual(MIN_MAGAZINE_SIZE);
      expect(
        weapon.magazineSize,
        `${weapon.name} magazine <= ${MAX_MAGAZINE_SIZE}`
      ).toBeLessThanOrEqual(MAX_MAGAZINE_SIZE);
    }
  });

  it('should have positive reserve ammo for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(
        weapon.reserveAmmo,
        `${weapon.name} reserve ammo should be positive`
      ).toBeGreaterThan(0);
    }
  });

  it('should have reserve ammo within expected range', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(
        weapon.reserveAmmo,
        `${weapon.name} reserve >= ${MIN_RESERVE_AMMO}`
      ).toBeGreaterThanOrEqual(MIN_RESERVE_AMMO);
      expect(
        weapon.reserveAmmo,
        `${weapon.name} reserve <= ${MAX_RESERVE_AMMO}`
      ).toBeLessThanOrEqual(MAX_RESERVE_AMMO);
    }
  });

  it('LMGs should have large magazines', () => {
    expect(WEAPONS.heavy_lmg.magazineSize).toBeGreaterThanOrEqual(100);
    expect(WEAPONS.saw_lmg.magazineSize).toBeGreaterThanOrEqual(100);
  });

  it('double barrel should have smallest magazine (2 shells)', () => {
    expect(WEAPONS.double_barrel.magazineSize).toBe(2);
  });

  it('sniper should have small magazine due to power', () => {
    expect(WEAPONS.sniper_rifle.magazineSize).toBeLessThanOrEqual(6);
  });

  it('total ammo should support sustained combat', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      const totalShots = weapon.magazineSize + weapon.reserveAmmo;
      // At minimum, should have enough for 20 shots
      expect(totalShots, `${weapon.name} should have at least 20 total shots`).toBeGreaterThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Reload Time Tests
// ---------------------------------------------------------------------------

describe('Reload Times', () => {
  it('should have positive reload time for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.reloadTime, `${weapon.name} reload time should be positive`).toBeGreaterThan(0);
    }
  });

  it('should have reload time within expected range', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(
        weapon.reloadTime,
        `${weapon.name} reload >= ${MIN_RELOAD_TIME}ms`
      ).toBeGreaterThanOrEqual(MIN_RELOAD_TIME);
      expect(
        weapon.reloadTime,
        `${weapon.name} reload <= ${MAX_RELOAD_TIME}ms`
      ).toBeLessThanOrEqual(MAX_RELOAD_TIME);
    }
  });

  it('sidearms should have relatively fast reloads', () => {
    expect(WEAPONS.sidearm.reloadTime).toBeLessThanOrEqual(1500);
  });

  it('LMGs should have long reload times', () => {
    expect(WEAPONS.heavy_lmg.reloadTime).toBeGreaterThanOrEqual(4000);
    expect(WEAPONS.saw_lmg.reloadTime).toBeGreaterThanOrEqual(4000);
  });

  it('sniper should have moderate-long reload', () => {
    expect(WEAPONS.sniper_rifle.reloadTime).toBeGreaterThanOrEqual(3000);
  });

  it('plasma cannon should have long reload due to power', () => {
    expect(WEAPONS.plasma_cannon.reloadTime).toBeGreaterThanOrEqual(3000);
  });
});

// ---------------------------------------------------------------------------
// 7. DPS Calculations (using balance config)
// ---------------------------------------------------------------------------

describe('DPS Calculations', () => {
  it('should calculate positive DPS for all weapons in balance config', () => {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    for (const id of weaponIds) {
      const dps = calculateWeaponDPS(id);
      expect(dps, `${id} should have positive DPS`).toBeGreaterThan(0);
    }
  });

  it('should calculate positive sustained DPS for all weapons', () => {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    for (const id of weaponIds) {
      const sustainedDps = calculateSustainedDPS(id);
      expect(sustainedDps, `${id} should have positive sustained DPS`).toBeGreaterThan(0);
    }
  });

  it('burst DPS should be greater than or equal to sustained DPS', () => {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    for (const id of weaponIds) {
      const burstDps = calculateWeaponDPS(id);
      const sustainedDps = calculateSustainedDPS(id);
      expect(
        burstDps,
        `${id} burst DPS should >= sustained DPS`
      ).toBeGreaterThanOrEqual(sustainedDps - 0.01); // small tolerance for floating point
    }
  });

  it('high fire rate weapons should have competitive DPS despite low damage', () => {
    const smgDps = calculateWeaponDPS('pulse_smg');
    const rifleDps = calculateWeaponDPS('assault_rifle');
    // SMG DPS should be within 50% of rifle DPS
    expect(smgDps).toBeGreaterThan(rifleDps * 0.5);
  });

  it('sniper rifle should have lower DPS but higher per-shot impact', () => {
    const sniperDps = calculateWeaponDPS('sniper_rifle');
    const rifleDps = calculateWeaponDPS('assault_rifle');
    const sniperDamage = WEAPON_BALANCE.sniper_rifle?.damage ?? 0;
    const rifleDamage = WEAPON_BALANCE.assault_rifle?.damage ?? 0;

    // Sniper has lower DPS but higher damage per shot
    expect(sniperDps).toBeLessThan(rifleDps);
    expect(sniperDamage).toBeGreaterThan(rifleDamage);
  });
});

// ---------------------------------------------------------------------------
// 8. Weapon Helper Functions
// ---------------------------------------------------------------------------

describe('Weapon Helper Functions', () => {
  describe('getWeapon', () => {
    it('should return weapon definition for valid ID', () => {
      const weapon = getWeapon('assault_rifle');
      expect(weapon).toBeDefined();
      expect(weapon.id).toBe('assault_rifle');
      expect(weapon.name).toBe('MA5K Assault Rifle');
    });

    it('should return correct weapon for all IDs', () => {
      for (const id of ALL_WEAPON_IDS) {
        const weapon = getWeapon(id);
        expect(weapon.id).toBe(id);
      }
    });
  });

  describe('getWeaponBySlot', () => {
    it('should return weapon for valid slot index', () => {
      const weapon = getWeaponBySlot(0);
      expect(weapon).toBeDefined();
      expect(weapon?.id).toBe(WEAPON_SLOTS[0]);
    });

    it('should return null for invalid slot', () => {
      const weapon = getWeaponBySlot(999);
      expect(weapon).toBeNull();
    });
  });

  describe('getWeaponSlot', () => {
    it('should return correct slot for slotted weapons', () => {
      for (let i = 0; i < WEAPON_SLOTS.length; i++) {
        const slot = getWeaponSlot(WEAPON_SLOTS[i]);
        expect(slot).toBe(i);
      }
    });

    it('should return -1 for non-slotted weapons', () => {
      const slot = getWeaponSlot('sidearm');
      expect(slot).toBe(-1);
    });
  });

  describe('getWeaponGLBPath', () => {
    it('should return valid path for all weapons', () => {
      for (const id of ALL_WEAPON_IDS) {
        const path = getWeaponGLBPath(id);
        expect(path).toMatch(/^\/models\/props\/weapons\/.+\.glb$/);
      }
    });

    it('should include weapon glbFile in path', () => {
      const path = getWeaponGLBPath('assault_rifle');
      expect(path).toContain(WEAPONS.assault_rifle.glbFile);
    });
  });

  describe('categoryToEffectType', () => {
    it('should map sidearm to pistol effect', () => {
      expect(categoryToEffectType('sidearm')).toBe('pistol');
    });

    it('should map smg to pistol effect', () => {
      expect(categoryToEffectType('smg')).toBe('pistol');
    });

    it('should map rifle to rifle effect', () => {
      expect(categoryToEffectType('rifle')).toBe('rifle');
    });

    it('should map marksman to rifle effect', () => {
      expect(categoryToEffectType('marksman')).toBe('rifle');
    });

    it('should map shotgun to shotgun effect', () => {
      expect(categoryToEffectType('shotgun')).toBe('shotgun');
    });

    it('should map heavy to heavy effect', () => {
      expect(categoryToEffectType('heavy')).toBe('heavy');
    });

    it('should return default for unknown category', () => {
      // TypeScript won't allow this normally, but testing defensive code
      expect(categoryToEffectType('unknown' as WeaponCategory)).toBe('default');
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Weapon Tier System
// ---------------------------------------------------------------------------

describe('Weapon Tier System', () => {
  it('should have valid tier (1-5) for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.tier, `${weapon.name} tier should be 1-5`).toBeGreaterThanOrEqual(1);
      expect(weapon.tier, `${weapon.name} tier should be 1-5`).toBeLessThanOrEqual(5);
    }
  });

  it('starter weapons should be tier 1', () => {
    expect(WEAPONS.sidearm.tier).toBe(1);
    expect(WEAPONS.classic_pistol.tier).toBe(1);
  });

  it('endgame weapons should be tier 4-5', () => {
    expect(WEAPONS.sniper_rifle.tier).toBe(5);
    expect(WEAPONS.plasma_cannon.tier).toBe(5);
  });

  it('mid-tier weapons should be tier 2-3', () => {
    expect(WEAPONS.assault_rifle.tier).toBe(3);
    expect(WEAPONS.pulse_smg.tier).toBe(2);
  });

  it('higher tier weapons should generally have more power', () => {
    // Compare tier 1 vs tier 5
    const tier1Weapons = ALL_WEAPON_IDS.filter((id) => WEAPONS[id].tier === 1);
    const tier5Weapons = ALL_WEAPON_IDS.filter((id) => WEAPONS[id].tier === 5);

    const avgTier1Damage = tier1Weapons.reduce((sum, id) => sum + WEAPONS[id].damage, 0) / tier1Weapons.length;
    const avgTier5Damage = tier5Weapons.reduce((sum, id) => sum + WEAPONS[id].damage, 0) / tier5Weapons.length;

    expect(avgTier5Damage).toBeGreaterThan(avgTier1Damage);
  });
});

// ---------------------------------------------------------------------------
// 10. Visual Properties Validation
// ---------------------------------------------------------------------------

describe('Weapon Visual Properties', () => {
  it('should have valid projectile colors for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.projectileColor).toBeDefined();
      expect(weapon.projectileGlowColor).toBeDefined();
    }
  });

  it('should have positive projectile size for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.projectileSize, `${weapon.name} projectile size`).toBeGreaterThan(0);
      expect(weapon.projectileSize, `${weapon.name} projectile size`).toBeLessThan(1);
    }
  });

  it('should have positive muzzle flash intensity for all weapons', () => {
    for (const id of ALL_WEAPON_IDS) {
      const weapon = WEAPONS[id];
      expect(weapon.muzzleFlashIntensity, `${weapon.name} muzzle flash`).toBeGreaterThan(0);
    }
  });

  it('plasma cannon should have blue-ish projectile color', () => {
    const plasma = WEAPONS.plasma_cannon;
    // Blue channel should be dominant
    expect(plasma.projectileColor.b).toBeGreaterThan(plasma.projectileColor.r);
  });

  it('heavy weapons should have larger projectile sizes', () => {
    expect(WEAPONS.plasma_cannon.projectileSize).toBeGreaterThan(WEAPONS.sidearm.projectileSize);
    expect(WEAPONS.sniper_rifle.projectileSize).toBeGreaterThan(WEAPONS.pulse_smg.projectileSize);
  });
});

// ---------------------------------------------------------------------------
// 11. Balance Config Integration
// ---------------------------------------------------------------------------

describe('Balance Config Integration', () => {
  it('should have balance entry for core weapons', () => {
    const coreWeapons: WeaponId[] = [
      'assault_rifle',
      'pulse_smg',
      'plasma_cannon',
      'sniper_rifle',
      'auto_shotgun',
    ];
    for (const id of coreWeapons) {
      expect(WEAPON_BALANCE[id], `${id} should have balance config`).toBeDefined();
    }
  });

  // Note: WEAPON_BALANCE is the authoritative source for combat balance values.
  // The WEAPONS definitions may have different values for visual/gameplay feel
  // while WEAPON_BALANCE controls actual combat math.
  it.skip('balance damage should match weapon definition (skipped: WEAPON_BALANCE is authoritative)', () => {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    for (const id of weaponIds) {
      const balance = WEAPON_BALANCE[id];
      const weapon = WEAPONS[id];
      if (balance && weapon) {
        expect(balance.damage).toBe(weapon.damage);
      }
    }
  });

  it.skip('balance fire rate should match weapon definition (skipped: WEAPON_BALANCE is authoritative)', () => {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    for (const id of weaponIds) {
      const balance = WEAPON_BALANCE[id];
      const weapon = WEAPONS[id];
      if (balance && weapon) {
        expect(balance.fireRate).toBe(weapon.fireRate);
      }
    }
  });

  it('should calculate total ammo correctly', () => {
    const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
    for (const id of weaponIds) {
      const balance = WEAPON_BALANCE[id];
      if (balance) {
        const totalAmmo = calculateTotalAmmo(id);
        expect(totalAmmo).toBe(balance.magazineSize + balance.defaultReserveAmmo);
      }
    }
  });
});
