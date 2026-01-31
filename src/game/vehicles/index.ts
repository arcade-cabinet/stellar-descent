/**
 * Vehicle system barrel exports
 *
 * Provides the Phantom Dropship (player-pilotable alien craft),
 * the Wraith Tank (AI enemy vehicle, hijackable), the shared
 * VehicleBase class, VehicleUtils for common functionality,
 * and the VehicleHUD React overlay.
 */

export type { PhantomFlightMode, PhantomLandingState } from './PhantomDropship';
// Phantom Dropship
export { PhantomDropship } from './PhantomDropship';
export type {
  DamageState,
  VehiclePassenger,
  VehicleStats,
  VehicleWeapon,
} from './VehicleBase';
// Base class & types
export { VehicleBase } from './VehicleBase';
// HUD
export { VehicleHUD } from './VehicleHUD';
export type { WraithAIState } from './WraithTank';
// Wraith Tank
export { WraithTank } from './WraithTank';
// Vehicle utilities for shared functionality
export {
  applyVehicleDamage,
  buildVehicleInput,
  createTransitionHandler,
  createVehicleDestructionEffect,
  disposeVehicle,
  getVehicleExitPosition,
  healVehicle,
  isNearVehicle,
  preloadVehicleAssets,
  spawnVehicle,
  updateVehicleDamageVisuals,
} from './VehicleUtils';
export type {
  SpawnedVehicle,
  TransitionConfig,
  TransitionState,
  VehicleDamageResult,
  VehicleSpawnConfig,
  VehicleType,
} from './VehicleUtils';
