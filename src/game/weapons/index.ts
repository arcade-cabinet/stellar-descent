/**
 * Weapons module - First-person weapon view model system
 *
 * Exports:
 * - FirstPersonWeaponSystem / firstPersonWeapons  - View model mesh + rendering
 * - WeaponAnimationController                     - Procedural animation driver
 * - WeaponRecoilSystem / weaponRecoilSystem       - Camera recoil, shake, FOV effects
 * - Animation types and profiles
 */

export { FirstPersonWeaponSystem, firstPersonWeapons } from './FirstPersonWeapons';

export {
  getAnimationProfile,
  WeaponAnimationController,
  type WeaponAnimationOutput,
  type WeaponAnimationProfile,
  type WeaponAnimState,
  type WeaponMovementInput,
} from './WeaponAnimations';

export {
  getRecoilProfile,
  type WeaponRecoilProfile,
  WeaponRecoilSystem,
  weaponRecoilSystem,
} from './WeaponRecoilSystem';
