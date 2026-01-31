/**
 * Combat Module - Barrel Export
 *
 * Exports all combat-related systems and utilities.
 */

// Melee combat system
export {
  MeleeSystem,
  meleeSystem,
  getMeleeSystem,
  type MeleeConfig,
  type MeleeAttackResult,
} from './MeleeSystem';

// Grenade/throwable system
export {
  GrenadeSystem,
  grenadeSystem,
  type GrenadeType,
  type GrenadeConfig,
  MAX_GRENADES,
} from './GrenadeSystem';
