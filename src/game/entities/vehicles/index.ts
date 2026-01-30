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

export type { ManagedVehicle, SpawnWraithOptions, VehicleType } from './EnemyVehicleManager';
// Manager (primary API for levels)
export { EnemyVehicleManager } from './EnemyVehicleManager';
export type { WraithConfig, WraithState, WraithWaypoint } from './WraithAI';
// Wraith AI
export { DEFAULT_WRAITH_CONFIG, WraithAI } from './WraithAI';
export type { MortarProjectile } from './WraithMortar';
// Mortar projectile system
export {
  detonateMortar,
  launchMortar,
  MORTAR_AOE_RADIUS,
  MORTAR_CHARGE_TIME,
  MORTAR_FLIGHT_TIME,
  MORTAR_MAX_DAMAGE,
  MORTAR_MIN_DAMAGE,
  predictTargetPosition,
  updateMortar,
} from './WraithMortar';
