/**
 * Weapon actions module for non-React code (levels, systems)
 *
 * This provides a way for Babylon.js level code to interact with the
 * React weapon context without being inside a React component.
 */

import {
  DEFAULT_WEAPON,
  getWeapon,
  type WeaponDefinition,
  type WeaponId,
} from '../entities/weapons';
import type { WeaponInventoryState } from './WeaponContext';

export interface WeaponActions {
  fire: () => boolean;
  startReload: () => void;
  cancelReload: () => void;
  addAmmo: (amount: number, weaponId?: WeaponId) => void;
  resetWeapon: () => void;
  switchWeapon: (slot: number) => void;
  switchToWeaponId: (weaponId: WeaponId) => void;
  cycleWeapon: (direction: 1 | -1) => void;
  quickSwap: () => void;
  grantWeapon: (weaponId: WeaponId) => boolean;
  hasWeapon: (weaponId: WeaponId) => boolean;
  getOwnedWeapons: () => WeaponId[];
  getState: () => WeaponStateSnapshot;
}

export interface WeaponStateSnapshot {
  currentAmmo: number;
  reserveAmmo: number;
  maxMagazineSize: number;
  maxReserveAmmo: number;
  isReloading: boolean;
  isSwitching: boolean;
  canFire: boolean;
  isLowAmmo: boolean;
  currentWeaponId: WeaponId;
  currentWeaponSlot: number;
  inventory: WeaponInventoryState;
}

// Singleton to hold the current weapon actions
let currentWeaponActions: WeaponActions | null = null;

/**
 * Register weapon actions from the WeaponContext
 * Called by the WeaponProvider when it mounts
 */
export function registerWeaponActions(actions: WeaponActions | null): void {
  currentWeaponActions = actions;
}

/**
 * Get the current weapon actions
 * Returns null if WeaponProvider is not mounted
 */
export function getWeaponActions(): WeaponActions | null {
  return currentWeaponActions;
}

/**
 * Check if weapon actions are available
 */
export function hasWeaponActions(): boolean {
  return currentWeaponActions !== null;
}

/**
 * Convenience function to fire the weapon
 * Returns true if fired, false if no ammo or reloading
 */
export function fireWeapon(): boolean {
  if (!currentWeaponActions) return true; // Allow fire if no weapon system
  return currentWeaponActions.fire();
}

/**
 * Convenience function to start reload
 */
export function startReload(): void {
  currentWeaponActions?.startReload();
}

/**
 * Convenience function to check if can fire
 */
export function canFireWeapon(): boolean {
  if (!currentWeaponActions) return true; // Allow fire if no weapon system
  return currentWeaponActions.getState().canFire;
}

/**
 * Convenience function to check if reloading
 */
export function isReloading(): boolean {
  if (!currentWeaponActions) return false;
  return currentWeaponActions.getState().isReloading;
}

/**
 * Convenience function to get current ammo
 */
export function getCurrentAmmo(): number {
  if (!currentWeaponActions) return Infinity;
  return currentWeaponActions.getState().currentAmmo;
}

/**
 * Switch to weapon by slot (0-3)
 */
export function switchToWeaponSlot(slot: number): void {
  currentWeaponActions?.switchWeapon(slot);
}

/**
 * Switch to a specific weapon by ID
 */
export function switchToWeapon(weaponId: WeaponId): void {
  currentWeaponActions?.switchToWeaponId(weaponId);
}

/**
 * Cycle to next/previous weapon
 */
export function cycleWeapon(direction: 1 | -1): void {
  currentWeaponActions?.cycleWeapon(direction);
}

/**
 * Quick swap to last used weapon
 */
export function quickSwapWeapon(): void {
  currentWeaponActions?.quickSwap();
}

/**
 * Grant a weapon to the player
 */
export function grantWeapon(weaponId: WeaponId): boolean {
  return currentWeaponActions?.grantWeapon(weaponId) ?? false;
}

/**
 * Check if player owns a weapon
 */
export function hasWeapon(weaponId: WeaponId): boolean {
  return currentWeaponActions?.hasWeapon(weaponId) ?? false;
}

/**
 * Get list of owned weapons
 */
export function getOwnedWeapons(): WeaponId[] {
  return currentWeaponActions?.getOwnedWeapons() ?? [];
}

/**
 * Check if weapon switch animation is in progress
 */
export function isSwitchingWeapon(): boolean {
  if (!currentWeaponActions) return false;
  return currentWeaponActions.getState().isSwitching;
}

/**
 * Get current weapon definition
 */
export function getCurrentWeaponDef(): WeaponDefinition {
  if (!currentWeaponActions) return getWeapon(DEFAULT_WEAPON);
  return getWeapon(currentWeaponActions.getState().currentWeaponId);
}

/**
 * Get current weapon slot
 */
export function getCurrentWeaponSlot(): number {
  if (!currentWeaponActions) return 0;
  return currentWeaponActions.getState().currentWeaponSlot;
}

/**
 * Get weapon definition by ID from inventory slot
 */
export function getWeaponInSlot(slot: number): WeaponDefinition | null {
  if (!currentWeaponActions) return null;
  const inventory = currentWeaponActions.getState().inventory;
  const weaponId = inventory.slots[slot];
  return weaponId ? getWeapon(weaponId) : null;
}
