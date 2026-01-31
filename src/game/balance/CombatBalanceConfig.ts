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
  // Sidearms - Pistol: 25 damage, 2.0x headshot
  sidearm: {
    id: 'sidearm',
    name: 'M6C Sidearm',
    damage: 25,
    fireRate: 5,
    projectileSpeed: 70,
    range: 40,
    critMultiplier: 2.0, // Headshot multiplier
    magazineSize: 12,
    maxReserveAmmo: 96,
    defaultReserveAmmo: 48,
    reloadTimeMs: 1200,
  },
  heavy_pistol: {
    id: 'heavy_pistol',
    name: 'M7 Heavy Pistol',
    damage: 35,
    fireRate: 3,
    projectileSpeed: 75,
    range: 50,
    critMultiplier: 2.0,
    magazineSize: 8,
    maxReserveAmmo: 64,
    defaultReserveAmmo: 32,
    reloadTimeMs: 1600,
  },
  revolver: {
    id: 'revolver',
    name: 'S&W Executor',
    damage: 55,
    fireRate: 1.5,
    projectileSpeed: 80,
    range: 55,
    critMultiplier: 2.5,
    magazineSize: 6,
    maxReserveAmmo: 48,
    defaultReserveAmmo: 24,
    reloadTimeMs: 2800,
  },
  // SMGs
  pulse_smg: {
    id: 'pulse_smg',
    name: 'P2025 Pulse SMG',
    damage: 14,
    fireRate: 15,
    projectileSpeed: 100,
    range: 60,
    critMultiplier: 1.8,
    magazineSize: 48,
    maxReserveAmmo: 1200,
    defaultReserveAmmo: 192,
    reloadTimeMs: 1500,
  },
  pdw: {
    id: 'pdw',
    name: 'P90 PDW',
    damage: 16,
    fireRate: 13,
    projectileSpeed: 95,
    range: 55,
    critMultiplier: 1.8,
    magazineSize: 50,
    maxReserveAmmo: 300,
    defaultReserveAmmo: 150,
    reloadTimeMs: 1800,
  },
  // Rifles - Assault Rifle: 18 damage, 1.8x headshot
  assault_rifle: {
    id: 'assault_rifle',
    name: 'MA5K Assault Rifle',
    damage: 18,
    fireRate: 10,
    projectileSpeed: 80,
    range: 100,
    critMultiplier: 1.8, // Headshot multiplier
    magazineSize: 32,
    maxReserveAmmo: 640,
    defaultReserveAmmo: 128,
    reloadTimeMs: 2000,
  },
  battle_rifle: {
    id: 'battle_rifle',
    name: 'BR55 Battle Rifle',
    damage: 28,
    fireRate: 6,
    projectileSpeed: 90,
    range: 120,
    critMultiplier: 2.0,
    magazineSize: 20,
    maxReserveAmmo: 160,
    defaultReserveAmmo: 80,
    reloadTimeMs: 2200,
  },
  carbine: {
    id: 'carbine',
    name: 'M4 Carbine',
    damage: 20,
    fireRate: 10,
    projectileSpeed: 85,
    range: 90,
    critMultiplier: 1.8,
    magazineSize: 30,
    maxReserveAmmo: 240,
    defaultReserveAmmo: 120,
    reloadTimeMs: 1800,
  },
  // Marksman
  dmr: {
    id: 'dmr',
    name: 'M14 DMR',
    damage: 65,
    fireRate: 3,
    projectileSpeed: 120,
    range: 150,
    critMultiplier: 2.5,
    magazineSize: 10,
    maxReserveAmmo: 80,
    defaultReserveAmmo: 40,
    reloadTimeMs: 2500,
  },
  // Sniper: 150 damage, 3.0x headshot
  sniper_rifle: {
    id: 'sniper_rifle',
    name: 'SRS99 Sniper',
    damage: 150,
    fireRate: 0.8,
    projectileSpeed: 200,
    range: 250,
    critMultiplier: 3.0, // Headshot multiplier
    magazineSize: 4,
    maxReserveAmmo: 32,
    defaultReserveAmmo: 16,
    reloadTimeMs: 3500,
  },
  // Shotguns - Shotgun: 12 x 8 pellets = 96 total, 1.5x headshot
  auto_shotgun: {
    id: 'auto_shotgun',
    name: 'M90 Auto Shotgun',
    damage: 96, // 12 damage x 8 pellets
    fireRate: 3,
    projectileSpeed: 60,
    range: 30,
    critMultiplier: 1.5, // Headshot multiplier
    magazineSize: 8,
    maxReserveAmmo: 64,
    defaultReserveAmmo: 32,
    reloadTimeMs: 2800,
  },
  double_barrel: {
    id: 'double_barrel',
    name: 'DB-12 Double Barrel',
    damage: 144, // 18 damage x 8 pellets
    fireRate: 1.5,
    projectileSpeed: 55,
    range: 20,
    critMultiplier: 1.5,
    magazineSize: 2,
    maxReserveAmmo: 40,
    defaultReserveAmmo: 20,
    reloadTimeMs: 2200,
  },
  // Heavy - Plasma Rifle: 22 damage, 1.5x headshot
  plasma_cannon: {
    id: 'plasma_cannon',
    name: 'M99 Plasma Rifle',
    damage: 22,
    fireRate: 8,
    projectileSpeed: 50,
    range: 80,
    critMultiplier: 1.5, // Headshot multiplier
    magazineSize: 40,
    maxReserveAmmo: 200,
    defaultReserveAmmo: 80,
    reloadTimeMs: 3000,
  },
  heavy_lmg: {
    id: 'heavy_lmg',
    name: 'PKP Heavy LMG',
    damage: 24,
    fireRate: 12,
    projectileSpeed: 75,
    range: 100,
    critMultiplier: 1.5,
    magazineSize: 100,
    maxReserveAmmo: 400,
    defaultReserveAmmo: 200,
    reloadTimeMs: 4500,
  },
  saw_lmg: {
    id: 'saw_lmg',
    name: 'M249 SAW',
    damage: 20,
    fireRate: 14,
    projectileSpeed: 80,
    range: 90,
    critMultiplier: 1.5,
    magazineSize: 150,
    maxReserveAmmo: 600,
    defaultReserveAmmo: 300,
    reloadTimeMs: 5000,
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

/**
 * Enemy health values by difficulty level
 * Base values are for Normal difficulty, scaled by difficulty modifiers
 *
 * | Enemy       | Easy | Normal | Hard | Nightmare |
 * |-------------|------|--------|------|-----------|
 * | Skitterer   | 50   | 80     | 100  | 130       |
 * | Spitter     | 80   | 120    | 150  | 200       |
 * | Warrior     | 150  | 200    | 250  | 350       |
 * | Heavy       | 300  | 400    | 500  | 700       |
 * | Stalker     | 100  | 150    | 180  | 250       |
 * | Broodmother | 500  | 700    | 900  | 1200      |
 * | Queen       | 2000 | 3000   | 4000 | 6000      |
 */
export const ENEMY_HEALTH_BY_DIFFICULTY: Record<string, Record<DifficultyLevel, number>> = {
  skitterer: { easy: 50, normal: 80, hard: 100, nightmare: 130 },
  spitter: { easy: 80, normal: 120, hard: 150, nightmare: 200 },
  warrior: { easy: 150, normal: 200, hard: 250, nightmare: 350 },
  heavy: { easy: 300, normal: 400, hard: 500, nightmare: 700 },
  stalker: { easy: 100, normal: 150, hard: 180, nightmare: 250 },
  broodmother: { easy: 500, normal: 700, hard: 900, nightmare: 1200 },
  queen: { easy: 2000, normal: 3000, hard: 4000, nightmare: 6000 },
  // Legacy mappings for backward compatibility
  lurker: { easy: 100, normal: 150, hard: 180, nightmare: 250 }, // Maps to Stalker
  spewer: { easy: 80, normal: 120, hard: 150, nightmare: 200 },  // Maps to Spitter
  husk: { easy: 150, normal: 200, hard: 250, nightmare: 350 },   // Maps to Warrior
};

/**
 * Enemy damage values by difficulty level
 *
 * | Enemy     | Easy | Normal | Hard | Nightmare |
 * |-----------|------|--------|------|-----------|
 * | Skitterer | 5    | 8      | 12   | 18        |
 * | Spitter   | 12   | 18     | 25   | 35        |
 * | Warrior   | 15   | 22     | 30   | 45        |
 * | Heavy     | 25   | 35     | 50   | 70        |
 * | Queen     | 30   | 50     | 75   | 100       |
 */
export const ENEMY_DAMAGE_BY_DIFFICULTY: Record<string, Record<DifficultyLevel, number>> = {
  skitterer: { easy: 5, normal: 8, hard: 12, nightmare: 18 },
  spitter: { easy: 12, normal: 18, hard: 25, nightmare: 35 },
  warrior: { easy: 15, normal: 22, hard: 30, nightmare: 45 },
  heavy: { easy: 25, normal: 35, hard: 50, nightmare: 70 },
  stalker: { easy: 10, normal: 15, hard: 20, nightmare: 30 },
  broodmother: { easy: 20, normal: 30, hard: 45, nightmare: 60 },
  queen: { easy: 30, normal: 50, hard: 75, nightmare: 100 },
  // Legacy mappings
  lurker: { easy: 10, normal: 15, hard: 20, nightmare: 30 },
  spewer: { easy: 12, normal: 18, hard: 25, nightmare: 35 },
  husk: { easy: 15, normal: 22, hard: 30, nightmare: 45 },
};

/**
 * Melee damage multipliers by enemy type
 * Allows melee to be more effective against certain enemy types
 */
export const MELEE_DAMAGE_MULTIPLIER: Record<string, number> = {
  skitterer: 1.5,   // Dies in 1-2 melee hits (100 * 1.5 = 150 vs 80 HP)
  spitter: 1.2,     // Medium vulnerability
  warrior: 1.0,     // Standard damage
  heavy: 0.8,       // Armored, takes reduced melee damage
  stalker: 1.3,     // Agile but fragile
  broodmother: 0.6, // Boss tier, heavily armored
  queen: 0.5,       // Boss tier, extremely armored
  // Legacy mappings
  lurker: 1.3,
  spewer: 1.2,
  husk: 1.0,
};

export const ENEMY_BALANCE: Record<string, EnemyBalanceEntry> = {
  // Skitterer - Fast, weak, swarm creatures (dies in 1-2 melee hits, 0.5-1s TTK)
  skitterer: {
    id: 'skitterer',
    name: 'Skitterer',
    baseHealth: 80, // Normal difficulty base
    baseDamage: 8,
    moveSpeed: 18,
    attackRange: 8,
    alertRadius: 30,
    fireRate: 4,
    projectileSpeed: 25,
    xpValue: 10,
    isBoss: false,
  },
  // Spitter - Ranged acid attacker (1-2s TTK)
  spitter: {
    id: 'spitter',
    name: 'Spitter',
    baseHealth: 120, // Normal difficulty base
    baseDamage: 18,
    moveSpeed: 8,
    attackRange: 25,
    alertRadius: 40,
    fireRate: 1.5,
    projectileSpeed: 30,
    xpValue: 25,
    isBoss: false,
  },
  // Warrior - Melee bruiser (2-3s TTK)
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    baseHealth: 200, // Normal difficulty base
    baseDamage: 22,
    moveSpeed: 12,
    attackRange: 10,
    alertRadius: 45,
    fireRate: 2,
    projectileSpeed: 0, // Melee only
    xpValue: 40,
    isBoss: false,
  },
  // Heavy - Tanky armored enemy (4-6s TTK, 3-4 melee hits)
  heavy: {
    id: 'heavy',
    name: 'Heavy',
    baseHealth: 400, // Normal difficulty base
    baseDamage: 35,
    moveSpeed: 6,
    attackRange: 15,
    alertRadius: 35,
    fireRate: 1,
    projectileSpeed: 20,
    xpValue: 75,
    isBoss: false,
  },
  // Stalker - Stealthy, fast hunter
  stalker: {
    id: 'stalker',
    name: 'Stalker',
    baseHealth: 150, // Normal difficulty base
    baseDamage: 15,
    moveSpeed: 16,
    attackRange: 12,
    alertRadius: 60,
    fireRate: 2.5,
    projectileSpeed: 35,
    xpValue: 35,
    isBoss: false,
  },
  // Broodmother - Mini-boss, spawns skitterers (60-90s TTK with mechanics)
  broodmother: {
    id: 'broodmother',
    name: 'Broodmother',
    baseHealth: 700, // Normal difficulty base
    baseDamage: 30,
    moveSpeed: 4,
    attackRange: 20,
    alertRadius: 45,
    fireRate: 0.5,
    projectileSpeed: 15,
    xpValue: 200,
    isBoss: true,
  },
  // Queen - Final boss (60-90s TTK with mechanics)
  queen: {
    id: 'queen',
    name: 'Hive Queen',
    baseHealth: 3000, // Normal difficulty base
    baseDamage: 50,
    moveSpeed: 3,
    attackRange: 30,
    alertRadius: 80,
    fireRate: 0.3,
    projectileSpeed: 25,
    xpValue: 500,
    isBoss: true,
  },
  // Legacy enemies for backward compatibility
  lurker: {
    id: 'lurker',
    name: 'Lurker',
    baseHealth: 150,
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
    baseHealth: 120,
    baseDamage: 18,
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
    baseHealth: 200,
    baseDamage: 22,
    moveSpeed: 14,
    attackRange: 10,
    alertRadius: 60,
    fireRate: 2,
    projectileSpeed: 30,
    xpValue: 40,
    isBoss: false,
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
// Melee balance configuration
// ---------------------------------------------------------------------------

export interface MeleeBalanceConfig {
  /** Base melee damage */
  baseDamage: number;
  /** Headshot/critical hit multiplier for melee */
  critMultiplier: number;
  /** Attack range in meters */
  attackRange: number;
  /** Cooldown between attacks in seconds */
  cooldown: number;
}

export const MELEE_BALANCE: MeleeBalanceConfig = {
  baseDamage: 100, // Was 50, now 100 for satisfying quick kills
  critMultiplier: 2.0,
  attackRange: 2.0,
  cooldown: 0.8,
};

// ---------------------------------------------------------------------------
// TTK (Time-To-Kill) targets per difficulty
// ---------------------------------------------------------------------------

/** TTK range in seconds [min, max] */
export type TTKRange = [number, number];

export interface TTKTargets {
  /** TTK for basic enemies (skitterer) - target: 0.5-1s */
  basicEnemy: TTKRange;
  /** TTK for medium enemies (spitter, stalker, warrior) - target: 1-3s */
  mediumEnemy: TTKRange;
  /** TTK for heavy enemies - target: 4-6s */
  heavyEnemy: TTKRange;
  /** TTK for boss enemies (broodmother, queen) - target: 60-90s with mechanics */
  bossEnemy: TTKRange;
  /** How many enemy hits the player should survive */
  playerSurvivesHits: [number, number];
  /** Player time-to-death in seconds (8-12s for Normal) */
  playerTTD: TTKRange;
}

export const TTK_TARGETS: Record<DifficultyLevel, TTKTargets> = {
  easy: {
    basicEnemy: [0.3, 0.8],      // Quick kills
    mediumEnemy: [0.8, 2.0],     // Satisfying kills
    heavyEnemy: [2.5, 4.0],      // Manageable tanks
    bossEnemy: [30.0, 60.0],     // Forgiving boss fights
    playerSurvivesHits: [10, 15], // Very forgiving
    playerTTD: [15, 20],         // Generous survival time
  },
  normal: {
    basicEnemy: [0.5, 1.0],      // Skitterer: 0.5-1 second (satisfying quick kills)
    mediumEnemy: [1.0, 2.0],     // Spitter: 1-2 seconds
    heavyEnemy: [4.0, 6.0],      // Heavy: 4-6 seconds
    bossEnemy: [60.0, 90.0],     // Queen: 60-90 seconds (with mechanics)
    playerSurvivesHits: [8, 12],  // Full health to death: 8-12 seconds
    playerTTD: [8, 12],          // Allows reaction time but punishes mistakes
  },
  hard: {
    basicEnemy: [0.7, 1.3],      // Slightly tankier
    mediumEnemy: [1.5, 2.5],     // More time required
    heavyEnemy: [5.0, 8.0],      // Serious threat
    bossEnemy: [75.0, 120.0],    // Extended boss fights
    playerSurvivesHits: [5, 8],   // Less forgiving
    playerTTD: [5, 8],           // Faster death if careless
  },
  nightmare: {
    basicEnemy: [1.0, 1.8],      // Even basic enemies are dangerous
    mediumEnemy: [2.0, 3.5],     // Extended fights
    heavyEnemy: [7.0, 12.0],     // Major threat
    bossEnemy: [90.0, 150.0],    // Endurance battles
    playerSurvivesHits: [3, 5],   // Punishing
    playerTTD: [3, 5],           // Very fast death if mistakes are made
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
    case 'spitter':
    case 'warrior':
    case 'stalker':
    case 'lurker':  // Legacy
    case 'husk':    // Legacy
    case 'spewer':  // Legacy (maps to medium now)
      return 'mediumEnemy';
    case 'heavy':
      return 'heavyEnemy';
    case 'broodmother':
    case 'queen':
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
 * Uses the explicit per-difficulty health tables if available.
 */
export function getScaledEnemyHealth(enemyId: string, difficulty: DifficultyLevel): number {
  // Check if we have explicit difficulty-specific health values
  const healthTable = ENEMY_HEALTH_BY_DIFFICULTY[enemyId];
  if (healthTable && healthTable[difficulty] !== undefined) {
    return healthTable[difficulty];
  }

  // Fallback to base health with multiplier
  const enemy = ENEMY_BALANCE[enemyId];
  if (!enemy) return 0;
  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  return Math.round(enemy.baseHealth * modifiers.enemyHealthMultiplier);
}

/**
 * Calculate effective enemy damage after difficulty scaling.
 * Uses the explicit per-difficulty damage tables if available.
 */
export function getScaledEnemyDamage(enemyId: string, difficulty: DifficultyLevel): number {
  // Check if we have explicit difficulty-specific damage values
  const damageTable = ENEMY_DAMAGE_BY_DIFFICULTY[enemyId];
  if (damageTable && damageTable[difficulty] !== undefined) {
    return damageTable[difficulty];
  }

  // Fallback to base damage with multiplier
  const enemy = ENEMY_BALANCE[enemyId];
  if (!enemy) return 0;
  const modifiers = DIFFICULTY_PRESETS[difficulty].modifiers;
  return Math.round(enemy.baseDamage * modifiers.enemyDamageMultiplier);
}

/**
 * Get melee damage multiplier for an enemy type.
 */
export function getMeleeDamageMultiplier(enemyId: string): number {
  return MELEE_DAMAGE_MULTIPLIER[enemyId] ?? 1.0;
}

/**
 * Calculate effective melee damage against an enemy type.
 */
export function calculateMeleeDamage(enemyId: string, baseMeleeDamage: number = MELEE_BALANCE.baseDamage): number {
  const multiplier = getMeleeDamageMultiplier(enemyId);
  return Math.round(baseMeleeDamage * multiplier);
}

/**
 * Calculate how many melee hits to kill an enemy at a given difficulty.
 */
export function calculateMeleeHitsToKill(enemyId: string, difficulty: DifficultyLevel): number {
  const enemyHealth = getScaledEnemyHealth(enemyId, difficulty);
  const meleeDamage = calculateMeleeDamage(enemyId);
  return Math.ceil(enemyHealth / meleeDamage);
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
