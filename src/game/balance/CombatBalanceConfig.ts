/**
 * CombatBalanceConfig - Central source of truth for all combat numbers
 *
 * Every weapon damage value, enemy HP/damage value, spawn rate, ammo economy
 * parameter, health economy parameter, shield value, and time-to-kill target
 * lives here. Other systems should import from this file instead of hard-coding
 * combat numbers.
 *
 * Balance targets per difficulty:
 *   Normal:    TTK basic enemy = 0.8-1.2s, player survives 5-8 hits
 *   Veteran:   TTK basic enemy = 1.5-2.0s, player survives 3-5 hits
 *   Legendary: TTK basic enemy = 2.5-3.5s, player survives 2-3 hits
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import { DIFFICULTY_PRESETS } from '../core/DifficultySettings';
import type { WeaponId } from '../entities/weapons';

// ---------------------------------------------------------------------------
// Weapon balance
// ---------------------------------------------------------------------------

export interface WeaponBalanceEntry {
  /** Unique weapon identifier */
  id: WeaponId;
  /** Display name */
  name: string;
  /** Damage per projectile (base, before difficulty modifiers) */
  damage: number;
  /** Shots per second */
  fireRate: number;
  /** Projectile travel speed (units/s) */
  projectileSpeed: number;
  /** Maximum effective range (units) */
  range: number;
  /** Critical hit damage multiplier */
  critMultiplier: number;
  /** Magazine capacity */
  magazineSize: number;
  /** Maximum reserve ammo */
  maxReserveAmmo: number;
  /** Default reserve ammo on spawn/switch */
  defaultReserveAmmo: number;
  /** Reload time in milliseconds */
  reloadTimeMs: number;
}

export const WEAPON_BALANCE: Partial<Record<WeaponId, WeaponBalanceEntry>> = {
  assault_rifle: {
    id: 'assault_rifle',
    name: 'MA5K Assault Rifle',
    damage: 25,
    fireRate: 8,
    projectileSpeed: 80,
    range: 100,
    critMultiplier: 1.5,
    magazineSize: 32,
    maxReserveAmmo: 640,
    defaultReserveAmmo: 640,
    reloadTimeMs: 2000,
  },
  plasma_cannon: {
    id: 'plasma_cannon',
    name: 'M99 Plasma Cannon',
    damage: 75,
    fireRate: 2,
    projectileSpeed: 50,
    range: 80,
    critMultiplier: 1.5,
    magazineSize: 8,
    maxReserveAmmo: 360,
    defaultReserveAmmo: 360,
    reloadTimeMs: 3500,
  },
  pulse_smg: {
    id: 'pulse_smg',
    name: 'P2025 Pulse SMG',
    damage: 15,
    fireRate: 15,
    projectileSpeed: 100,
    range: 60,
    critMultiplier: 1.5,
    magazineSize: 48,
    maxReserveAmmo: 1200,
    defaultReserveAmmo: 1200,
    reloadTimeMs: 1500,
  },
};

// ---------------------------------------------------------------------------
// Enemy balance
// ---------------------------------------------------------------------------

export interface EnemyBalanceEntry {
  /** Species identifier matching ALIEN_SPECIES keys */
  id: string;
  /** Display name */
  name: string;
  /** Base HP before difficulty scaling */
  baseHealth: number;
  /** Base damage per projectile */
  baseDamage: number;
  /** Movement speed (units/s) */
  moveSpeed: number;
  /** Attack range (units) */
  attackRange: number;
  /** Passive detection radius (units) */
  alertRadius: number;
  /** Attacks per second */
  fireRate: number;
  /** Projectile travel speed */
  projectileSpeed: number;
  /** XP reward on kill */
  xpValue: number;
  /** Whether this enemy counts as a boss */
  isBoss: boolean;
}

export const ENEMY_BALANCE: Record<string, EnemyBalanceEntry> = {
  skitterer: {
    id: 'skitterer',
    name: 'Skitterer',
    baseHealth: 170,
    baseDamage: 8,
    moveSpeed: 18,
    attackRange: 8,
    alertRadius: 30,
    fireRate: 4,
    projectileSpeed: 25,
    xpValue: 10,
    isBoss: false,
  },
  lurker: {
    id: 'lurker',
    name: 'Lurker',
    baseHealth: 380,
    baseDamage: 15,
    moveSpeed: 10,
    attackRange: 15,
    alertRadius: 50,
    fireRate: 1.5,
    projectileSpeed: 35,
    xpValue: 35,
    isBoss: false,
  },
  spewer: {
    id: 'spewer',
    name: 'Spewer',
    baseHealth: 680,
    baseDamage: 12,
    moveSpeed: 6,
    attackRange: 25,
    alertRadius: 35,
    fireRate: 0.8,
    projectileSpeed: 20,
    xpValue: 50,
    isBoss: false,
  },
  husk: {
    id: 'husk',
    name: 'Husk',
    baseHealth: 340,
    baseDamage: 18,
    moveSpeed: 14,
    attackRange: 10,
    alertRadius: 60,
    fireRate: 2,
    projectileSpeed: 30,
    xpValue: 40,
    isBoss: false,
  },
  broodmother: {
    id: 'broodmother',
    name: 'Broodmother',
    baseHealth: 2500,
    baseDamage: 25,
    moveSpeed: 4,
    attackRange: 20,
    alertRadius: 45,
    fireRate: 0.5,
    projectileSpeed: 15,
    xpValue: 150,
    isBoss: true,
  },
};

// ---------------------------------------------------------------------------
// Player balance
// ---------------------------------------------------------------------------

export interface PlayerBalanceConfig {
  /** Base maximum health */
  maxHealth: number;
  /** Health regen per second (base, before difficulty) */
  healthRegenRate: number;
  /** Base maximum shields */
  maxShield: number;
  /** Shield regen per second (after shield recharge delay) */
  shieldRegenRate: number;
  /** Seconds after last hit before shield starts recharging */
  shieldRechargeDelay: number;
  /** Base movement speed (units/s) */
  moveSpeed: number;
  /** Sprint speed multiplier */
  sprintMultiplier: number;
  /** Incoming projectile damage (base, before difficulty scaling) */
  incomingProjectileDamage: number;
}

export const PLAYER_BALANCE: PlayerBalanceConfig = {
  maxHealth: 100,
  healthRegenRate: 2,
  maxShield: 0, // Shields not yet implemented; placeholder for future
  shieldRegenRate: 25,
  shieldRechargeDelay: 4,
  moveSpeed: 20,
  sprintMultiplier: 2,
  incomingProjectileDamage: 10,
};

// ---------------------------------------------------------------------------
// Health economy
// ---------------------------------------------------------------------------

export interface HealthPickupConfig {
  /** Small health pack restoration amount */
  smallPackAmount: number;
  /** Medium health pack restoration amount */
  mediumPackAmount: number;
  /** Large health pack restoration amount */
  largePackAmount: number;
  /** Base drop chance from enemy kills (0-1) */
  baseDropChance: number;
  /** Average pickups available per level section (for economy validation) */
  averagePickupsPerSection: number;
}

export const HEALTH_ECONOMY: HealthPickupConfig = {
  smallPackAmount: 15,
  mediumPackAmount: 35,
  largePackAmount: 75,
  baseDropChance: 0.25,
  averagePickupsPerSection: 4,
};

// ---------------------------------------------------------------------------
// Ammo economy
// ---------------------------------------------------------------------------

export interface AmmoPickupConfig {
  /** Ammo restored per small pickup (fraction of magazine) */
  smallPickupFraction: number;
  /** Ammo restored per large pickup (fraction of magazine) */
  largePickupFraction: number;
  /** Base drop chance from enemy kills (0-1) */
  baseDropChance: number;
  /** Average pickups available per level section (for economy validation) */
  averagePickupsPerSection: number;
}

export const AMMO_ECONOMY: AmmoPickupConfig = {
  smallPickupFraction: 0.75,
  largePickupFraction: 1.5,
  baseDropChance: 0.6,
  averagePickupsPerSection: 5,
};

// ---------------------------------------------------------------------------
// Spawn configuration per level per difficulty
// ---------------------------------------------------------------------------

export interface LevelSpawnConfig {
  /** Level identifier */
  levelId: string;
  /** Display-friendly level name */
  levelName: string;
  /** Base enemy count (scaled by difficulty spawnRateMultiplier) */
  baseEnemyCount: number;
  /** Species mix: fraction of total enemies for each species (must sum to 1) */
  speciesMix: Record<string, number>;
  /** Whether this level features a boss encounter */
  hasBoss: boolean;
  /** Number of distinct combat sections / encounter waves */
  combatSections: number;
}

export const LEVEL_SPAWN_CONFIG: Record<string, LevelSpawnConfig> = {
  landfall: {
    levelId: 'landfall',
    levelName: 'Landfall',
    baseEnemyCount: 20,
    speciesMix: { skitterer: 0.6, lurker: 0.25, husk: 0.15 },
    hasBoss: false,
    combatSections: 3,
  },
  canyon_run: {
    levelId: 'canyon_run',
    levelName: 'Canyon Run',
    baseEnemyCount: 15,
    speciesMix: { skitterer: 0.5, spewer: 0.3, lurker: 0.2 },
    hasBoss: false,
    combatSections: 2,
  },
  fob_delta: {
    levelId: 'fob_delta',
    levelName: 'FOB Delta',
    baseEnemyCount: 25,
    speciesMix: { lurker: 0.35, husk: 0.35, skitterer: 0.2, spewer: 0.1 },
    hasBoss: false,
    combatSections: 4,
  },
  brothers_in_arms: {
    levelId: 'brothers_in_arms',
    levelName: 'Brothers in Arms',
    baseEnemyCount: 30,
    speciesMix: { skitterer: 0.4, spewer: 0.2, lurker: 0.2, husk: 0.2 },
    hasBoss: false,
    combatSections: 5,
  },
  southern_ice: {
    levelId: 'southern_ice',
    levelName: 'Southern Ice',
    baseEnemyCount: 25,
    speciesMix: { husk: 0.3, lurker: 0.3, spewer: 0.25, skitterer: 0.15 },
    hasBoss: false,
    combatSections: 4,
  },
  the_breach: {
    levelId: 'the_breach',
    levelName: 'The Breach',
    baseEnemyCount: 35,
    speciesMix: { skitterer: 0.3, lurker: 0.2, spewer: 0.2, husk: 0.2, broodmother: 0.1 },
    hasBoss: true,
    combatSections: 6,
  },
  hive_assault: {
    levelId: 'hive_assault',
    levelName: 'Hive Assault',
    baseEnemyCount: 40,
    speciesMix: { skitterer: 0.35, spewer: 0.2, husk: 0.25, lurker: 0.15, broodmother: 0.05 },
    hasBoss: true,
    combatSections: 7,
  },
  extraction: {
    levelId: 'extraction',
    levelName: 'Extraction',
    baseEnemyCount: 30,
    speciesMix: { skitterer: 0.4, husk: 0.25, spewer: 0.2, lurker: 0.15 },
    hasBoss: false,
    combatSections: 5,
  },
};

// ---------------------------------------------------------------------------
// TTK (Time-To-Kill) targets per difficulty
// ---------------------------------------------------------------------------

/** TTK range in seconds [min, max] */
export type TTKRange = [number, number];

export interface TTKTargets {
  /** TTK for basic enemies (skitterer) */
  basicEnemy: TTKRange;
  /** TTK for medium enemies (lurker, husk) */
  mediumEnemy: TTKRange;
  /** TTK for heavy enemies (spewer) */
  heavyEnemy: TTKRange;
  /** TTK for boss enemies (broodmother) */
  bossEnemy: TTKRange;
  /** How many enemy hits the player should survive */
  playerSurvivesHits: [number, number];
}

export const TTK_TARGETS: Record<DifficultyLevel, TTKTargets> = {
  normal: {
    basicEnemy: [0.8, 1.2],
    mediumEnemy: [1.5, 3.0],
    heavyEnemy: [3.0, 5.0],
    bossEnemy: [10.0, 20.0],
    playerSurvivesHits: [5, 8],
  },
  veteran: {
    basicEnemy: [1.5, 2.0],
    mediumEnemy: [2.5, 5.0],
    heavyEnemy: [5.0, 8.0],
    bossEnemy: [15.0, 30.0],
    playerSurvivesHits: [3, 5],
  },
  legendary: {
    basicEnemy: [2.5, 3.5],
    mediumEnemy: [4.0, 8.0],
    heavyEnemy: [8.0, 14.0],
    bossEnemy: [25.0, 50.0],
    playerSurvivesHits: [2, 3],
  },
};

/**
 * Map an enemy id to its TTK tier.
 */
export function getEnemyTier(
  enemyId: string
): 'basicEnemy' | 'mediumEnemy' | 'heavyEnemy' | 'bossEnemy' {
  switch (enemyId) {
    case 'skitterer':
      return 'basicEnemy';
    case 'lurker':
    case 'husk':
      return 'mediumEnemy';
    case 'spewer':
      return 'heavyEnemy';
    case 'broodmother':
      return 'bossEnemy';
    default:
      return 'mediumEnemy';
  }
}

// ---------------------------------------------------------------------------
// Derived calculations
// ---------------------------------------------------------------------------

/**
 * Calculate raw DPS for a weapon (no crits, no reloads).
 */
export function calculateWeaponDPS(weaponId: WeaponId): number {
  const w = WEAPON_BALANCE[weaponId];
  if (!w) return 0;
  return w.damage * w.fireRate;
}

/**
 * Calculate sustained DPS accounting for reload downtime.
 * DPS = (magazineDamage) / (magazineDuration + reloadDuration)
 */
export function calculateSustainedDPS(weaponId: WeaponId): number {
  const w = WEAPON_BALANCE[weaponId];
  if (!w) return 0;
  const magazineDamage = w.damage * w.magazineSize;
  const magazineDurationSec = w.magazineSize / w.fireRate;
  const reloadDurationSec = w.reloadTimeMs / 1000;
  return magazineDamage / (magazineDurationSec + reloadDurationSec);
}

/**
 * Calculate effective enemy HP after difficulty scaling.
 */
export function getScaledEnemyHealth(enemyId: string, difficulty: DifficultyLevel): number {
  const enemy = ENEMY_BALANCE[enemyId];
  if (!enemy) return 0;
  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  return Math.round(enemy.baseHealth * modifiers.enemyHealthMultiplier);
}

/**
 * Calculate effective enemy damage after difficulty scaling.
 */
export function getScaledEnemyDamage(enemyId: string, difficulty: DifficultyLevel): number {
  const enemy = ENEMY_BALANCE[enemyId];
  if (!enemy) return 0;
  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  return Math.round(enemy.baseDamage * modifiers.enemyDamageMultiplier);
}

/**
 * Calculate effective player damage received after difficulty scaling.
 */
export function getScaledPlayerDamageReceived(
  baseDamage: number,
  difficulty: DifficultyLevel
): number {
  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  return Math.round(baseDamage * modifiers.playerDamageReceivedMultiplier);
}

/**
 * Calculate time-to-kill (seconds) for a weapon vs an enemy at a given difficulty.
 * Uses raw DPS (no reload interruptions) for burst TTK.
 */
export function calculateTTK(
  weaponId: WeaponId,
  enemyId: string,
  difficulty: DifficultyLevel
): number {
  const dps = calculateWeaponDPS(weaponId);
  const hp = getScaledEnemyHealth(enemyId, difficulty);
  if (dps <= 0) return Infinity;
  return hp / dps;
}

/**
 * Calculate sustained TTK including reloads.
 */
export function calculateSustainedTTK(
  weaponId: WeaponId,
  enemyId: string,
  difficulty: DifficultyLevel
): number {
  const hp = getScaledEnemyHealth(enemyId, difficulty);
  const w = WEAPON_BALANCE[weaponId];
  if (!w) return Infinity;
  const magazineDamage = w.damage * w.magazineSize;

  // If one magazine is enough, TTK = shotsNeeded / fireRate
  if (magazineDamage >= hp) {
    const shotsNeeded = Math.ceil(hp / w.damage);
    return (shotsNeeded - 1) / w.fireRate; // First shot is instant
  }

  // Multiple magazines needed
  const fullMagazines = Math.floor(hp / magazineDamage);
  const remainingHP = hp - fullMagazines * magazineDamage;
  const remainingShots = Math.ceil(remainingHP / w.damage);

  const timeForFullMagazines =
    fullMagazines * (w.magazineSize / w.fireRate + w.reloadTimeMs / 1000);
  const timeForRemainder = (remainingShots - 1) / w.fireRate;

  return timeForFullMagazines + timeForRemainder;
}

/**
 * Calculate how many hits a player can survive from a given enemy at a given difficulty.
 * Takes into account both enemy damage scaling and player damage received scaling.
 */
export function calculatePlayerSurvivableHits(
  enemyId: string,
  difficulty: DifficultyLevel
): number {
  const scaledDamage = getScaledEnemyDamage(enemyId, difficulty);
  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  const effectiveDamage = Math.round(scaledDamage * modifiers.playerDamageReceivedMultiplier);
  if (effectiveDamage <= 0) return Infinity;
  return Math.floor(PLAYER_BALANCE.maxHealth / effectiveDamage);
}

/**
 * Calculate total ammo required to clear a level at a given difficulty,
 * assuming every shot hits (best case).
 */
export function calculateAmmoRequiredForLevel(
  weaponId: WeaponId,
  levelId: string,
  difficulty: DifficultyLevel
): number {
  const level = LEVEL_SPAWN_CONFIG[levelId];
  if (!level) return 0;

  const w = WEAPON_BALANCE[weaponId];
  if (!w) return 0;
  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  const scaledEnemyCount = Math.round(level.baseEnemyCount * modifiers.spawnRateMultiplier);

  let totalShotsNeeded = 0;
  for (const [speciesId, fraction] of Object.entries(level.speciesMix)) {
    const enemy = ENEMY_BALANCE[speciesId];
    if (!enemy) continue;
    const count = Math.round(scaledEnemyCount * fraction);
    const scaledHP = Math.round(enemy.baseHealth * modifiers.enemyHealthMultiplier);
    const shotsPerEnemy = Math.ceil(scaledHP / w.damage);
    totalShotsNeeded += count * shotsPerEnemy;
  }

  return totalShotsNeeded;
}

/**
 * Calculate total ammo available (magazine + reserve) for a weapon.
 */
export function calculateTotalAmmo(weaponId: WeaponId): number {
  const w = WEAPON_BALANCE[weaponId];
  if (!w) return 0;
  return w.magazineSize + w.defaultReserveAmmo;
}

/**
 * Calculate total ammo with pickups factored in.
 * pickups = sections * averagePickupsPerSection * dropChance * resourceDropMultiplier
 * each pickup gives smallPickupFraction * magazineSize rounds
 */
export function calculateTotalAmmoWithPickups(
  weaponId: WeaponId,
  levelId: string,
  difficulty: DifficultyLevel
): number {
  const w = WEAPON_BALANCE[weaponId];
  if (!w) return 0;
  const level = LEVEL_SPAWN_CONFIG[levelId];
  if (!level) return calculateTotalAmmo(weaponId);

  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  const scaledEnemyCount = Math.round(level.baseEnemyCount * modifiers.spawnRateMultiplier);

  const expectedPickups =
    scaledEnemyCount * AMMO_ECONOMY.baseDropChance * modifiers.resourceDropMultiplier;
  const ammoPerPickup = Math.round(w.magazineSize * AMMO_ECONOMY.smallPickupFraction);
  const pickupAmmo = Math.round(expectedPickups * ammoPerPickup);

  return calculateTotalAmmo(weaponId) + pickupAmmo;
}

/**
 * Generate a full balance summary for a given difficulty. Useful for reports
 * and debugging in dev tools.
 */
export interface BalanceSummaryEntry {
  weaponId: WeaponId;
  weaponName: string;
  enemyId: string;
  enemyName: string;
  difficulty: DifficultyLevel;
  enemyHP: number;
  weaponDPS: number;
  sustainedDPS: number;
  burstTTK: number;
  sustainedTTK: number;
  ttkTarget: TTKRange;
  withinTarget: boolean;
}

export function generateBalanceSummary(difficulty: DifficultyLevel): BalanceSummaryEntry[] {
  const results: BalanceSummaryEntry[] = [];
  const weaponIds = Object.keys(WEAPON_BALANCE) as WeaponId[];
  const enemyIds = Object.keys(ENEMY_BALANCE);

  for (const weaponId of weaponIds) {
    for (const enemyId of enemyIds) {
      const tier = getEnemyTier(enemyId);
      const target = TTK_TARGETS[difficulty][tier];
      const burstTTK = calculateTTK(weaponId, enemyId, difficulty);
      const sustainedTTK = calculateSustainedTTK(weaponId, enemyId, difficulty);

      results.push({
        weaponId,
        weaponName: WEAPON_BALANCE[weaponId]?.name ?? weaponId,
        enemyId,
        enemyName: ENEMY_BALANCE[enemyId].name,
        difficulty,
        enemyHP: getScaledEnemyHealth(enemyId, difficulty),
        weaponDPS: calculateWeaponDPS(weaponId),
        sustainedDPS: calculateSustainedDPS(weaponId),
        burstTTK,
        sustainedTTK,
        ttkTarget: target,
        withinTarget: burstTTK >= target[0] && burstTTK <= target[1],
      });
    }
  }

  return results;
}
