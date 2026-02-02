/**
 * Statistics System Exports
 *
 * Provides comprehensive player statistics tracking including:
 * - Combat stats (kills, accuracy, damage)
 * - Campaign progress (levels, times, completions)
 * - Collectibles (skulls, audio logs, secrets)
 * - Time tracking (play time, sessions)
 */

export {
  calculateDerivedStats,
  createDefaultStats,
  type DerivedStats,
  type EnemyType,
  getEnemyDisplayName,
  type PlayerStats,
  type SessionStats,
  STATS_VERSION,
} from './PlayerStats';

export {
  getStatisticsTracker,
  statisticsTracker,
} from './StatisticsTracker';
