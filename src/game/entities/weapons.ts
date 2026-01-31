/**
 * Weapon Definitions - DOOM-style weapon roster with pickup/cache system
 *
 * Full arsenal of 18 weapons organized by category:
 *   SIDEARMS:     Sidearm, Heavy Pistol, Classic Pistol, Revolver
 *   SMGs:         Pulse SMG, PDW, SMG MP5, SMG UMP
 *   RIFLES:       Assault Rifle, Battle Rifle, Carbine
 *   MARKSMAN:     DMR, Sniper Rifle
 *   SHOTGUNS:     Auto Shotgun, Double Barrel
 *   HEAVY:        Plasma Cannon, Heavy LMG, SAW LMG
 *
 * Players start with a basic sidearm and find weapon caches in levels.
 * Each weapon has unique damage, fire rate, reload, and ammo properties.
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';

// ---------------------------------------------------------------------------
// Weapon ID union -- every weapon in the game
// ---------------------------------------------------------------------------

export type WeaponId =
  // Sidearms
  | 'sidearm'
  | 'heavy_pistol'
  | 'classic_pistol'
  | 'revolver'
  // SMGs
  | 'pulse_smg'
  | 'pdw'
  | 'smg_mp5'
  | 'smg_ump'
  // Rifles
  | 'assault_rifle'
  | 'battle_rifle'
  | 'carbine'
  // Marksman
  | 'dmr'
  | 'sniper_rifle'
  // Shotguns
  | 'auto_shotgun'
  | 'double_barrel'
  // Heavy
  | 'plasma_cannon'
  | 'heavy_lmg'
  | 'saw_lmg';

// ---------------------------------------------------------------------------
// Weapon categories (for inventory grouping and sound fallback)
// ---------------------------------------------------------------------------

export type WeaponCategory =
  | 'sidearm'
  | 'smg'
  | 'rifle'
  | 'marksman'
  | 'shotgun'
  | 'heavy';

// ---------------------------------------------------------------------------
// Ammo types (weapons in the same ammo pool share reserves)
// ---------------------------------------------------------------------------

export type AmmoType = '9mm' | '556' | '762' | '12gauge' | 'plasma_cell';

// ---------------------------------------------------------------------------
// Weapon definition
// ---------------------------------------------------------------------------

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  shortName: string;
  category: WeaponCategory;
  ammoType: AmmoType;

  // Combat stats
  damage: number;
  fireRate: number; // Shots per second
  projectileSpeed: number;
  range: number;

  // Magazine
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number; // milliseconds

  // Visual
  projectileColor: Color3;
  projectileGlowColor: Color3;
  projectileSize: number;
  muzzleFlashColor: Color3;
  muzzleFlashIntensity: number;
  muzzleFlashRange: number;

  // GLB model path (relative to /models/props/weapons/)
  glbFile: string;

  // Weapon tier for pickup ordering (1 = starter, 5 = endgame)
  tier: number;

  // Audio (not implemented yet, for future)
  fireSound: string;
  reloadSound: string;
}

// ---------------------------------------------------------------------------
// Sidearms
// ---------------------------------------------------------------------------

export const SIDEARM: WeaponDefinition = {
  id: 'sidearm',
  name: 'M6C Sidearm',
  shortName: 'SIDEARM',
  category: 'sidearm',
  ammoType: '9mm',
  damage: 15,
  fireRate: 5,
  projectileSpeed: 70,
  range: 40,
  magazineSize: 12,
  reserveAmmo: 48,
  reloadTime: 1200,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.05,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.0,
  muzzleFlashRange: 5,
  glbFile: 'fps_sidearm.glb',
  tier: 1,
  fireSound: 'pistol_fire',
  reloadSound: 'pistol_reload',
};

export const HEAVY_PISTOL: WeaponDefinition = {
  id: 'heavy_pistol',
  name: 'M7 Heavy Pistol',
  shortName: 'HEAVY P.',
  category: 'sidearm',
  ammoType: '9mm',
  damage: 28,
  fireRate: 3,
  projectileSpeed: 75,
  range: 50,
  magazineSize: 8,
  reserveAmmo: 32,
  reloadTime: 1600,
  projectileColor: new Color3(1, 0.8, 0.1),
  projectileGlowColor: new Color3(1, 0.85, 0.2),
  projectileSize: 0.06,
  muzzleFlashColor: new Color3(1, 0.85, 0.4),
  muzzleFlashIntensity: 1.3,
  muzzleFlashRange: 6,
  glbFile: 'fps_heavy_pistol.glb',
  tier: 2,
  fireSound: 'pistol_fire',
  reloadSound: 'pistol_reload',
};

export const CLASSIC_PISTOL: WeaponDefinition = {
  id: 'classic_pistol',
  name: 'M1911 Classic',
  shortName: 'CLASSIC',
  category: 'sidearm',
  ammoType: '9mm',
  damage: 20,
  fireRate: 4,
  projectileSpeed: 72,
  range: 45,
  magazineSize: 7,
  reserveAmmo: 42,
  reloadTime: 1400,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.05,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.1,
  muzzleFlashRange: 5,
  glbFile: 'fps_classic_pistol.glb',
  tier: 1,
  fireSound: 'pistol_fire',
  reloadSound: 'pistol_reload',
};

export const REVOLVER: WeaponDefinition = {
  id: 'revolver',
  name: 'S&W Executor',
  shortName: 'REVOLVER',
  category: 'sidearm',
  ammoType: '9mm',
  damage: 45,
  fireRate: 1.5,
  projectileSpeed: 80,
  range: 55,
  magazineSize: 6,
  reserveAmmo: 24,
  reloadTime: 2800,
  projectileColor: new Color3(1, 0.75, 0.1),
  projectileGlowColor: new Color3(1, 0.8, 0.2),
  projectileSize: 0.07,
  muzzleFlashColor: new Color3(1, 0.8, 0.3),
  muzzleFlashIntensity: 1.8,
  muzzleFlashRange: 7,
  glbFile: 'fps_revolver.glb',
  tier: 3,
  fireSound: 'pistol_fire',
  reloadSound: 'pistol_reload',
};

// ---------------------------------------------------------------------------
// SMGs
// ---------------------------------------------------------------------------

export const PULSE_SMG: WeaponDefinition = {
  id: 'pulse_smg',
  name: 'P2025 Pulse SMG',
  shortName: 'SMG',
  category: 'smg',
  ammoType: '9mm',
  damage: 12,
  fireRate: 15,
  projectileSpeed: 100,
  range: 60,
  magazineSize: 48,
  reserveAmmo: 192,
  reloadTime: 1500,
  projectileColor: new Color3(0.2, 1, 0.4),
  projectileGlowColor: new Color3(0.4, 1, 0.6),
  projectileSize: 0.05,
  muzzleFlashColor: new Color3(0.3, 1, 0.5),
  muzzleFlashIntensity: 1.0,
  muzzleFlashRange: 6,
  glbFile: 'fps_pulse_smg.glb',
  tier: 2,
  fireSound: 'smg_fire',
  reloadSound: 'smg_reload',
};

export const PDW: WeaponDefinition = {
  id: 'pdw',
  name: 'P90 PDW',
  shortName: 'PDW',
  category: 'smg',
  ammoType: '9mm',
  damage: 14,
  fireRate: 13,
  projectileSpeed: 95,
  range: 55,
  magazineSize: 50,
  reserveAmmo: 150,
  reloadTime: 1800,
  projectileColor: new Color3(0.3, 0.9, 0.5),
  projectileGlowColor: new Color3(0.4, 1, 0.6),
  projectileSize: 0.05,
  muzzleFlashColor: new Color3(0.4, 0.9, 0.5),
  muzzleFlashIntensity: 1.0,
  muzzleFlashRange: 6,
  glbFile: 'fps_pdw.glb',
  tier: 2,
  fireSound: 'smg_fire',
  reloadSound: 'smg_reload',
};

export const SMG_MP5: WeaponDefinition = {
  id: 'smg_mp5',
  name: 'MP5K Tactical',
  shortName: 'MP5',
  category: 'smg',
  ammoType: '9mm',
  damage: 13,
  fireRate: 12,
  projectileSpeed: 90,
  range: 50,
  magazineSize: 30,
  reserveAmmo: 120,
  reloadTime: 1400,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.05,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.0,
  muzzleFlashRange: 6,
  glbFile: 'fps_smg_mp5.glb',
  tier: 2,
  fireSound: 'smg_fire',
  reloadSound: 'smg_reload',
};

export const SMG_UMP: WeaponDefinition = {
  id: 'smg_ump',
  name: 'UMP-45 Breacher',
  shortName: 'UMP',
  category: 'smg',
  ammoType: '9mm',
  damage: 18,
  fireRate: 9,
  projectileSpeed: 85,
  range: 55,
  magazineSize: 25,
  reserveAmmo: 100,
  reloadTime: 1600,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.06,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.1,
  muzzleFlashRange: 6,
  glbFile: 'fps_smg_ump.glb',
  tier: 2,
  fireSound: 'smg_fire',
  reloadSound: 'smg_reload',
};

// ---------------------------------------------------------------------------
// Rifles
// ---------------------------------------------------------------------------

export const ASSAULT_RIFLE: WeaponDefinition = {
  id: 'assault_rifle',
  name: 'MA5K Assault Rifle',
  shortName: 'RIFLE',
  category: 'rifle',
  ammoType: '556',
  damage: 25,
  fireRate: 8,
  projectileSpeed: 80,
  range: 100,
  magazineSize: 32,
  reserveAmmo: 128,
  reloadTime: 2000,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.08,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.5,
  muzzleFlashRange: 8,
  glbFile: 'fps_assault_rifle.glb',
  tier: 3,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

export const BATTLE_RIFLE: WeaponDefinition = {
  id: 'battle_rifle',
  name: 'BR55 Battle Rifle',
  shortName: 'BR',
  category: 'rifle',
  ammoType: '762',
  damage: 35,
  fireRate: 5,
  projectileSpeed: 90,
  range: 120,
  magazineSize: 20,
  reserveAmmo: 80,
  reloadTime: 2200,
  projectileColor: new Color3(1, 0.8, 0.15),
  projectileGlowColor: new Color3(1, 0.85, 0.25),
  projectileSize: 0.08,
  muzzleFlashColor: new Color3(1, 0.85, 0.4),
  muzzleFlashIntensity: 1.6,
  muzzleFlashRange: 9,
  glbFile: 'fps_battle_rifle.glb',
  tier: 3,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

export const CARBINE: WeaponDefinition = {
  id: 'carbine',
  name: 'M4 Carbine',
  shortName: 'CARBINE',
  category: 'rifle',
  ammoType: '556',
  damage: 22,
  fireRate: 10,
  projectileSpeed: 85,
  range: 90,
  magazineSize: 30,
  reserveAmmo: 120,
  reloadTime: 1800,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.07,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.4,
  muzzleFlashRange: 8,
  glbFile: 'fps_carbine.glb',
  tier: 3,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

// ---------------------------------------------------------------------------
// Marksman
// ---------------------------------------------------------------------------

export const DMR: WeaponDefinition = {
  id: 'dmr',
  name: 'M14 DMR',
  shortName: 'DMR',
  category: 'marksman',
  ammoType: '762',
  damage: 55,
  fireRate: 3,
  projectileSpeed: 120,
  range: 150,
  magazineSize: 10,
  reserveAmmo: 40,
  reloadTime: 2500,
  projectileColor: new Color3(1, 0.75, 0.1),
  projectileGlowColor: new Color3(1, 0.8, 0.2),
  projectileSize: 0.09,
  muzzleFlashColor: new Color3(1, 0.85, 0.4),
  muzzleFlashIntensity: 1.8,
  muzzleFlashRange: 10,
  glbFile: 'fps_dmr.glb',
  tier: 4,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

export const SNIPER_RIFLE: WeaponDefinition = {
  id: 'sniper_rifle',
  name: 'SRS99 Sniper',
  shortName: 'SNIPER',
  category: 'marksman',
  ammoType: '762',
  damage: 120,
  fireRate: 0.8,
  projectileSpeed: 200,
  range: 250,
  magazineSize: 4,
  reserveAmmo: 16,
  reloadTime: 3500,
  projectileColor: new Color3(1, 0.6, 0.1),
  projectileGlowColor: new Color3(1, 0.7, 0.15),
  projectileSize: 0.1,
  muzzleFlashColor: new Color3(1, 0.8, 0.3),
  muzzleFlashIntensity: 2.2,
  muzzleFlashRange: 12,
  glbFile: 'fps_sniper_rifle.glb',
  tier: 5,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

// ---------------------------------------------------------------------------
// Shotguns
// ---------------------------------------------------------------------------

export const AUTO_SHOTGUN: WeaponDefinition = {
  id: 'auto_shotgun',
  name: 'M90 Auto Shotgun',
  shortName: 'SHOTGUN',
  category: 'shotgun',
  ammoType: '12gauge',
  damage: 60, // per trigger pull, 8 pellets x ~7.5 each
  fireRate: 3,
  projectileSpeed: 60,
  range: 30,
  magazineSize: 8,
  reserveAmmo: 32,
  reloadTime: 2800,
  projectileColor: new Color3(1, 0.7, 0.1),
  projectileGlowColor: new Color3(1, 0.8, 0.2),
  projectileSize: 0.04,
  muzzleFlashColor: new Color3(1, 0.8, 0.3),
  muzzleFlashIntensity: 2.0,
  muzzleFlashRange: 12,
  glbFile: 'fps_auto_shotgun.glb',
  tier: 3,
  fireSound: 'shotgun_fire',
  reloadSound: 'shotgun_reload',
};

export const DOUBLE_BARREL: WeaponDefinition = {
  id: 'double_barrel',
  name: 'DB-12 Double Barrel',
  shortName: 'DB-12',
  category: 'shotgun',
  ammoType: '12gauge',
  damage: 110, // massive close-range damage
  fireRate: 1.5,
  projectileSpeed: 55,
  range: 20,
  magazineSize: 2,
  reserveAmmo: 20,
  reloadTime: 2200,
  projectileColor: new Color3(1, 0.65, 0.05),
  projectileGlowColor: new Color3(1, 0.75, 0.15),
  projectileSize: 0.05,
  muzzleFlashColor: new Color3(1, 0.75, 0.2),
  muzzleFlashIntensity: 2.5,
  muzzleFlashRange: 15,
  glbFile: 'fps_double_barrel.glb',
  tier: 4,
  fireSound: 'shotgun_fire',
  reloadSound: 'shotgun_reload',
};

// ---------------------------------------------------------------------------
// Heavy
// ---------------------------------------------------------------------------

export const PLASMA_CANNON: WeaponDefinition = {
  id: 'plasma_cannon',
  name: 'M99 Plasma Cannon',
  shortName: 'PLASMA',
  category: 'heavy',
  ammoType: 'plasma_cell',
  damage: 75,
  fireRate: 2,
  projectileSpeed: 50,
  range: 80,
  magazineSize: 8,
  reserveAmmo: 32,
  reloadTime: 3500,
  projectileColor: new Color3(0.2, 0.6, 1),
  projectileGlowColor: new Color3(0.4, 0.8, 1),
  projectileSize: 0.15,
  muzzleFlashColor: new Color3(0.3, 0.7, 1),
  muzzleFlashIntensity: 2.5,
  muzzleFlashRange: 14,
  glbFile: 'fps_plasma_cannon.glb',
  tier: 5,
  fireSound: 'plasma_fire',
  reloadSound: 'plasma_reload',
};

export const HEAVY_LMG: WeaponDefinition = {
  id: 'heavy_lmg',
  name: 'PKP Heavy LMG',
  shortName: 'LMG',
  category: 'heavy',
  ammoType: '762',
  damage: 30,
  fireRate: 10,
  projectileSpeed: 75,
  range: 100,
  magazineSize: 100,
  reserveAmmo: 200,
  reloadTime: 4500,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.08,
  muzzleFlashColor: new Color3(1, 0.85, 0.4),
  muzzleFlashIntensity: 1.8,
  muzzleFlashRange: 12,
  glbFile: 'fps_heavy_lmg.glb',
  tier: 4,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

export const SAW_LMG: WeaponDefinition = {
  id: 'saw_lmg',
  name: 'M249 SAW',
  shortName: 'SAW',
  category: 'heavy',
  ammoType: '556',
  damage: 22,
  fireRate: 12,
  projectileSpeed: 80,
  range: 90,
  magazineSize: 150,
  reserveAmmo: 300,
  reloadTime: 5000,
  projectileColor: new Color3(1, 0.85, 0.2),
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.07,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.6,
  muzzleFlashRange: 11,
  glbFile: 'fps_saw_lmg.glb',
  tier: 4,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

// ---------------------------------------------------------------------------
// Master registry
// ---------------------------------------------------------------------------

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  // Sidearms
  sidearm: SIDEARM,
  heavy_pistol: HEAVY_PISTOL,
  classic_pistol: CLASSIC_PISTOL,
  revolver: REVOLVER,
  // SMGs
  pulse_smg: PULSE_SMG,
  pdw: PDW,
  smg_mp5: SMG_MP5,
  smg_ump: SMG_UMP,
  // Rifles
  assault_rifle: ASSAULT_RIFLE,
  battle_rifle: BATTLE_RIFLE,
  carbine: CARBINE,
  // Marksman
  dmr: DMR,
  sniper_rifle: SNIPER_RIFLE,
  // Shotguns
  auto_shotgun: AUTO_SHOTGUN,
  double_barrel: DOUBLE_BARREL,
  // Heavy
  plasma_cannon: PLASMA_CANNON,
  heavy_lmg: HEAVY_LMG,
  saw_lmg: SAW_LMG,
};

// ---------------------------------------------------------------------------
// All weapon IDs (ordered by tier then category for UI)
// ---------------------------------------------------------------------------

export const ALL_WEAPON_IDS: WeaponId[] = [
  'sidearm',
  'classic_pistol',
  'heavy_pistol',
  'revolver',
  'pulse_smg',
  'pdw',
  'smg_mp5',
  'smg_ump',
  'assault_rifle',
  'battle_rifle',
  'carbine',
  'dmr',
  'sniper_rifle',
  'auto_shotgun',
  'double_barrel',
  'plasma_cannon',
  'heavy_lmg',
  'saw_lmg',
];

// ---------------------------------------------------------------------------
// Quick-switch weapon slots (the 3 visible in HUD -- backward-compat)
// ---------------------------------------------------------------------------

/** The player's active weapon loadout (3 slots, DOOM-style quick switch). */
export const WEAPON_SLOTS: WeaponId[] = ['assault_rifle', 'pulse_smg', 'plasma_cannon'];

// ---------------------------------------------------------------------------
// Helpers (backward-compatible API)
// ---------------------------------------------------------------------------

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS[id];
}

export function getWeaponBySlot(slot: number): WeaponDefinition | null {
  const id = WEAPON_SLOTS[slot];
  return id ? WEAPONS[id] : null;
}

export function getWeaponSlot(id: WeaponId): number {
  return WEAPON_SLOTS.indexOf(id);
}

/** Map a WeaponCategory to the effect type used by muzzle flash / effects. */
export function categoryToEffectType(
  category: WeaponCategory
): 'rifle' | 'pistol' | 'plasma' | 'shotgun' | 'heavy' | 'default' {
  switch (category) {
    case 'sidearm':
      return 'pistol';
    case 'smg':
      return 'pistol';
    case 'rifle':
      return 'rifle';
    case 'marksman':
      return 'rifle';
    case 'shotgun':
      return 'shotgun';
    case 'heavy':
      return 'heavy';
    default:
      return 'default';
  }
}

/**
 * Get the GLB model path for a weapon (absolute from webroot).
 */
export function getWeaponGLBPath(id: WeaponId): string {
  return `/models/props/weapons/${WEAPONS[id].glbFile}`;
}

// ---------------------------------------------------------------------------
// Default starting weapon
// ---------------------------------------------------------------------------

export const DEFAULT_WEAPON: WeaponId = 'assault_rifle';

/** Starter weapon the player always begins with. */
export const STARTER_WEAPON: WeaponId = 'sidearm';
