/**
 * Combat Balance System
 *
 * Central source of truth for all combat numbers in Stellar Descent.
 *
 * Usage:
 *   import { WEAPON_BALANCE, ENEMY_BALANCE, calculateTTK } from '../balance';
 *   import { runBalanceValidation, formatBalanceReport } from '../balance';
 */

export type {
  BalanceValidationReport,
  ValidationEntry,
  ValidationSeverity,
} from './BalanceValidator';
// Validation
export {
  BalanceValidator,
  formatBalanceReport,
  runBalanceValidation,
} from './BalanceValidator';
export type {
  AmmoPickupConfig,
  BalanceSummaryEntry,
  EnemyBalanceEntry,
  HealthPickupConfig,
  LevelSpawnConfig,
  PlayerBalanceConfig,
  TTKRange,
  TTKTargets,
  WeaponBalanceEntry,
} from './CombatBalanceConfig';
// Configuration - the single source of truth
export {
  AMMO_ECONOMY,
  calculateAmmoRequiredForLevel,
  calculatePlayerSurvivableHits,
  calculateSustainedDPS,
  calculateSustainedTTK,
  calculateTotalAmmo,
  calculateTotalAmmoWithPickups,
  calculateTTK,
  calculateWeaponDPS,
  ENEMY_BALANCE,
  generateBalanceSummary,
  getEnemyTier,
  getScaledEnemyDamage,
  getScaledEnemyHealth,
  getScaledPlayerDamageReceived,
  HEALTH_ECONOMY,
  LEVEL_SPAWN_CONFIG,
  PLAYER_BALANCE,
  TTK_TARGETS,
  WEAPON_BALANCE,
} from './CombatBalanceConfig';
