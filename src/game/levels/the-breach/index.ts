/**
 * TheBreachLevel - Underground Hive Tunnels with Queen Boss Fight
 *
 * This module exports the level class and all supporting utilities.
 */

// Communications
export {
  COMMS_BOSS_DEATH,
  COMMS_BOSS_DETECTED,
  COMMS_BOSS_PHASE_2,
  COMMS_BOSS_PHASE_3,
  COMMS_LEVEL_START,
  NOTIFICATIONS,
  OBJECTIVES,
} from './comms';
// Constants
export {
  COLORS,
  DAMAGE_INVINCIBILITY_MS,
  ENEMY_DETECTION_RANGE,
  ENEMY_STATS,
  GRENADE_COOLDOWN,
  GRENADE_MAX_DAMAGE,
  GRENADE_RADIUS,
  MELEE_COOLDOWN,
  MELEE_DAMAGE,
  MELEE_RANGE,
  PLAYER_MAX_HEALTH,
  QUEEN_MAX_HEALTH,
  QUEEN_PHASE_2_THRESHOLD,
  QUEEN_PHASE_3_THRESHOLD,
  STARTING_GRENADES,
  TUNNEL_DIAMETER,
  TUNNEL_SEGMENT_LENGTH,
  WEAK_POINT_COOLDOWN,
  WEAK_POINT_DAMAGE_MULTIPLIER,
  WEAK_POINT_DURATION,
} from './constants';
// Enemies
export {
  checkEnemyHit,
  damageEnemy,
  disposeEnemies,
  getEnemyAttackDamage,
  getInitialSpawnConfig,
  spawnEnemy,
  updateEnemyAI,
} from './enemies';
// Environment
export { HiveEnvironmentBuilder, updateBiolights } from './environment';
// Hazards
export {
  checkAcidPoolDamage,
  checkEggClusterTrigger,
  checkPheromoneCloud,
  HazardBuilder,
} from './hazards';
// Queen Boss
export {
  animateClawSwipe,
  animateQueen,
  calculateQueenDamage,
  createQueen,
  disposeQueen,
  getAvailableAttacks,
  getPhaseMultiplier,
  getQueenPhase,
  getSpawnCooldown,
  getSpawnCount,
  getSpawnType,
} from './queen';
// Main level class
export { TheBreachLevel } from './TheBreachLevel';
// Types
export type {
  AcidPool,
  BioluminescentLight,
  CapturedVehicle,
  EggCluster,
  Enemy,
  EnemyState,
  EnemyStats,
  EnemyType,
  HiveStructure,
  HiveZone,
  LevelPhase,
  PheromoneCloud,
  Queen,
  QueenAttackType,
  QueenBodyParts,
  QueenPhase,
  TunnelSegment,
} from './types';
