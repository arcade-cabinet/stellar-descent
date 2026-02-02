/**
 * Combat Module - Barrel Export
 *
 * Exports all combat-related systems and utilities.
 */

// Grenade/throwable system
export {
  type GrenadeConfig,
  GrenadeSystem,
  type GrenadeType,
  grenadeSystem,
  MAX_GRENADES,
} from './GrenadeSystem';
// Melee combat system
export {
  getMeleeSystem,
  type MeleeAttackResult,
  type MeleeConfig,
  MeleeSystem,
  meleeSystem,
} from './MeleeSystem';
