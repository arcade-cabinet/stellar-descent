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
  WEAK_POINT_DURATION_BASE,
  WEAK_POINT_COOLDOWN_BASE,
  QUEEN_HEALTH_SCALING,
  QUEEN_DAMAGE_SCALING,
  QUEEN_COOLDOWN_SCALING,
  WEAK_POINT_DURATION_SCALING,
  SCAN_COOLDOWN_SCALING,
  INVINCIBILITY_SCALING,
  ARENA_PILLAR_COUNT,
  ARENA_PILLAR_RADIUS,
  ARENA_PILLAR_HEIGHT,
  QUEEN_ATTACK_DAMAGE,
  QUEEN_ATTACK_TELEGRAPH,
  QUEEN_ATTACK_RANGE,
  WEAK_POINT_PULSE_SPEED,
  WEAK_POINT_MIN_ALPHA,
  WEAK_POINT_MAX_ALPHA,
  GROUND_POUND_INDICATOR_DURATION,
  ACID_SPIT_PROJECTILE_SPEED,
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
export {
  disposeBreachAssets,
  HiveEnvironmentBuilder,
  HIVE_STRUCTURE_PLACEMENTS,
  loadBreachAssets,
  placeBreachAssets,
  updateBiolights,
} from './environment';
export type { HiveStructurePlacement, PlacedAsset } from './environment';
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
  animateTailSlam,
  animateGroundPound,
  animateAcidSpit,
  animateQueenAwakening,
  animateQueenDeath,
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
  preloadQueenModels,
  setQueenDifficulty,
  getScaledQueenHealth,
  getScaledQueenDamage,
  getScaledCooldown,
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
