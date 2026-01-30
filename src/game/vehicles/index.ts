/**
 * Vehicle system barrel exports
 *
 * Provides the Phantom Dropship (player-pilotable alien craft),
 * the Wraith Tank (AI enemy vehicle, hijackable), the shared
 * VehicleBase class, and the VehicleHUD React overlay.
 */

// Base class & types
export { VehicleBase } from './VehicleBase';
export type {
  DamageState,
  VehiclePassenger,
  VehicleStats,
  VehicleWeapon,
} from './VehicleBase';

// Phantom Dropship
export { PhantomDropship } from './PhantomDropship';
export type { PhantomFlightMode, PhantomLandingState } from './PhantomDropship';

// Wraith Tank
export { WraithTank } from './WraithTank';
export type { WraithAIState } from './WraithTank';

// HUD
export { VehicleHUD } from './VehicleHUD';
