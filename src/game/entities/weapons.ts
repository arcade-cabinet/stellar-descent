/**
 * Weapon Definitions - Different weapon types with unique stats
 *
 * The game supports 3 primary weapons:
 * - ASSAULT RIFLE: Balanced, default weapon
 * - PLASMA CANNON: High damage, slow fire rate
 * - PULSE SMG: Low damage, very fast fire rate
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';

export type WeaponId = 'assault_rifle' | 'plasma_cannon' | 'pulse_smg';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  shortName: string;
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
  // Audio (not implemented yet, for future)
  fireSound: string;
  reloadSound: string;
}

/**
 * ASSAULT RIFLE - MA5K "Reaper"
 * Balanced weapon, good for all situations
 */
export const ASSAULT_RIFLE: WeaponDefinition = {
  id: 'assault_rifle',
  name: 'MA5K Assault Rifle',
  shortName: 'RIFLE',
  damage: 25,
  fireRate: 8, // 8 shots/sec
  projectileSpeed: 80,
  range: 100,
  magazineSize: 32,
  reserveAmmo: 128,
  reloadTime: 2000,
  projectileColor: new Color3(1, 0.85, 0.2), // Yellow-gold
  projectileGlowColor: new Color3(1, 0.9, 0.3),
  projectileSize: 0.08,
  muzzleFlashColor: new Color3(1, 0.9, 0.5),
  muzzleFlashIntensity: 1.5,
  fireSound: 'rifle_fire',
  reloadSound: 'rifle_reload',
};

/**
 * PLASMA CANNON - M99 "Sunfire"
 * Heavy weapon, high damage, slow fire rate
 */
export const PLASMA_CANNON: WeaponDefinition = {
  id: 'plasma_cannon',
  name: 'M99 Plasma Cannon',
  shortName: 'PLASMA',
  damage: 75, // 3x damage
  fireRate: 2, // 2 shots/sec (slow)
  projectileSpeed: 50, // Slower projectile
  range: 80,
  magazineSize: 8,
  reserveAmmo: 32,
  reloadTime: 3500, // Longer reload
  projectileColor: new Color3(0.2, 0.6, 1), // Blue plasma
  projectileGlowColor: new Color3(0.4, 0.8, 1),
  projectileSize: 0.15, // Bigger projectile
  muzzleFlashColor: new Color3(0.3, 0.7, 1),
  muzzleFlashIntensity: 2.5,
  fireSound: 'plasma_fire',
  reloadSound: 'plasma_reload',
};

/**
 * PULSE SMG - P2025 "Hornet"
 * Fast firing, low damage per shot
 */
export const PULSE_SMG: WeaponDefinition = {
  id: 'pulse_smg',
  name: 'P2025 Pulse SMG',
  shortName: 'SMG',
  damage: 12, // Lower damage
  fireRate: 15, // Very fast
  projectileSpeed: 100, // Fast projectiles
  range: 60,
  magazineSize: 48,
  reserveAmmo: 192,
  reloadTime: 1500, // Quick reload
  projectileColor: new Color3(0.2, 1, 0.4), // Green pulse
  projectileGlowColor: new Color3(0.4, 1, 0.6),
  projectileSize: 0.05, // Smaller projectile
  muzzleFlashColor: new Color3(0.3, 1, 0.5),
  muzzleFlashIntensity: 1.0,
  fireSound: 'smg_fire',
  reloadSound: 'smg_reload',
};

/**
 * All weapons indexed by ID
 */
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  assault_rifle: ASSAULT_RIFLE,
  plasma_cannon: PLASMA_CANNON,
  pulse_smg: PULSE_SMG,
};

/**
 * Weapon slot order
 */
export const WEAPON_SLOTS: WeaponId[] = ['assault_rifle', 'pulse_smg', 'plasma_cannon'];

/**
 * Get weapon definition by ID
 */
export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS[id];
}

/**
 * Get weapon by slot index (0, 1, 2)
 */
export function getWeaponBySlot(slot: number): WeaponDefinition | null {
  const id = WEAPON_SLOTS[slot];
  return id ? WEAPONS[id] : null;
}

/**
 * Get slot index for weapon ID
 */
export function getWeaponSlot(id: WeaponId): number {
  return WEAPON_SLOTS.indexOf(id);
}

/**
 * Default starting weapon
 */
export const DEFAULT_WEAPON: WeaponId = 'assault_rifle';
