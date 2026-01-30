/**
 * Weapon actions module for non-React code (levels, systems)
 *
 * This provides a way for Babylon.js level code to interact with the
 * React weapon context without being inside a React component.
 */

import {
  DEFAULT_WEAPON,
  getWeapon,
  getWeaponBySlot,
  type WeaponDefinition,
  type WeaponId,
} from '../entities/weapons';

export interface WeaponActions {
  fire: () => boolean;
  startReload: () => void;
  cancelReload: () => void;
  addAmmo: (amount: number) => void;
  resetWeapon: () => void;
  switchWeapon: (slot: number) => void;
  getState: () => WeaponStateSnapshot;
}

export interface WeaponStateSnapshot {
  currentAmmo: number;
  reserveAmmo: number;
  maxMagazineSize: number;
  maxReserveAmmo: number;
  isReloading: boolean;
  canFire: boolean;
  isLowAmmo: boolean;
  currentWeaponId: WeaponId;
  currentWeaponSlot: number;
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
 * Switch to weapon by slot (0, 1, 2)
 */
export function switchToWeaponSlot(slot: number): void {
  currentWeaponActions?.switchWeapon(slot);
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
 * Get weapon definition by slot
 */
export function getWeaponDefBySlot(slot: number): WeaponDefinition | null {
  return getWeaponBySlot(slot);
}
