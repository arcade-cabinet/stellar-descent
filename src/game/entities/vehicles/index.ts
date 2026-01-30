/**
 * Enemy Vehicle System
 *
 * Provides alien hover-tank AI, mortar projectiles, and a manager
 * that levels use to spawn and control enemy vehicles.
 *
 * Primary exports:
 *   EnemyVehicleManager  - Level-facing manager (spawn, update, dispose).
 *   WraithAI             - Wraith hover-tank AI class.
 *   WraithMortar         - Mortar projectile launcher + utilities.
 */

// Manager (primary API for levels)
export { EnemyVehicleManager } from './EnemyVehicleManager';
export type { ManagedVehicle, SpawnWraithOptions, VehicleType } from './EnemyVehicleManager';

// Wraith AI
export { WraithAI, DEFAULT_WRAITH_CONFIG } from './WraithAI';
export type { WraithConfig, WraithState, WraithWaypoint } from './WraithAI';

// Mortar projectile system
export {
  launchMortar,
  updateMortar,
  detonateMortar,
  predictTargetPosition,
  MORTAR_FLIGHT_TIME,
  MORTAR_CHARGE_TIME,
  MORTAR_AOE_RADIUS,
  MORTAR_MAX_DAMAGE,
  MORTAR_MIN_DAMAGE,
} from './WraithMortar';
export type { MortarProjectile } from './WraithMortar';
