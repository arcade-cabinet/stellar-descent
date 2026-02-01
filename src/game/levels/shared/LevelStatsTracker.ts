/**
 * LevelStatsTracker - Composable stats tracking for levels
 *
 * Extracted from BaseLevel for composition over inheritance.
 * Tracks kills, accuracy, secrets, time, and other level completion stats.
 *
 * Usage:
 *   const stats = new LevelStatsTracker({ parTime: 180 });
 *   stats.recordKill('soldier');
 *   stats.recordShot(true); // hit
 *   const result = stats.getStats();
 */

import { getLogger } from '../../core/Logger';

const log = getLogger('LevelStatsTracker');

export interface LevelStats {
  kills: number;
  totalShots: number;
  shotsHit: number;
  accuracy: number;
  headshots: number;
  meleeKills: number;
  grenadeKills: number;
  timeSpent: number;
  parTime: number;
  secretsFound: number;
  totalSecrets: number;
  audioLogsFound: number;
  totalAudioLogs: number;
  skullsFound: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  objectivesCompleted: number;
  totalObjectives: number;
  bonusObjectivesCompleted: number;
}

export interface LevelStatsConfig {
  parTime?: number;
  totalSecrets?: number;
  totalAudioLogs?: number;
  totalObjectives?: number;
}

const DEFAULT_STATS: LevelStats = {
  kills: 0,
  totalShots: 0,
  shotsHit: 0,
  accuracy: 0,
  headshots: 0,
  meleeKills: 0,
  grenadeKills: 0,
  timeSpent: 0,
  parTime: 0,
  secretsFound: 0,
  totalSecrets: 0,
  audioLogsFound: 0,
  totalAudioLogs: 0,
  skullsFound: 0,
  deaths: 0,
  damageDealt: 0,
  damageTaken: 0,
  objectivesCompleted: 0,
  totalObjectives: 0,
  bonusObjectivesCompleted: 0,
};

export class LevelStatsTracker {
  private stats: LevelStats;
  private startTime: number;

  constructor(config: LevelStatsConfig = {}) {
    this.stats = {
      ...DEFAULT_STATS,
      parTime: config.parTime ?? 0,
      totalSecrets: config.totalSecrets ?? 0,
      totalAudioLogs: config.totalAudioLogs ?? 0,
      totalObjectives: config.totalObjectives ?? 0,
    };
    this.startTime = performance.now();
  }

  /**
   * Record a kill
   */
  recordKill(enemyType?: string, isHeadshot = false, isMelee = false, isGrenade = false): void {
    this.stats.kills++;
    if (isHeadshot) this.stats.headshots++;
    if (isMelee) this.stats.meleeKills++;
    if (isGrenade) this.stats.grenadeKills++;
    log.debug(`Kill recorded: ${enemyType ?? 'unknown'} (total: ${this.stats.kills})`);
  }

  /**
   * Record a shot fired
   */
  recordShot(hit: boolean): void {
    this.stats.totalShots++;
    if (hit) this.stats.shotsHit++;
    this.updateAccuracy();
  }

  /**
   * Record damage dealt to enemies
   */
  recordDamageDealt(amount: number): void {
    this.stats.damageDealt += amount;
  }

  /**
   * Record damage taken by player
   */
  recordDamageTaken(amount: number): void {
    this.stats.damageTaken += amount;
  }

  /**
   * Record player death
   */
  recordDeath(): void {
    this.stats.deaths++;
  }

  /**
   * Record secret found
   */
  recordSecret(): void {
    this.stats.secretsFound++;
    log.info(`Secret found: ${this.stats.secretsFound}/${this.stats.totalSecrets}`);
  }

  /**
   * Record audio log found
   */
  recordAudioLog(): void {
    this.stats.audioLogsFound++;
    log.info(`Audio log found: ${this.stats.audioLogsFound}/${this.stats.totalAudioLogs}`);
  }

  /**
   * Record skull found
   */
  recordSkull(): void {
    this.stats.skullsFound++;
    log.info(`Skull found: ${this.stats.skullsFound}`);
  }

  /**
   * Record objective completed
   */
  recordObjectiveComplete(isBonus = false): void {
    this.stats.objectivesCompleted++;
    if (isBonus) this.stats.bonusObjectivesCompleted++;
  }

  /**
   * Update time spent (call before getting final stats)
   */
  updateTimeSpent(): void {
    this.stats.timeSpent = Math.floor((performance.now() - this.startTime) / 1000);
  }

  /**
   * Get current stats snapshot
   */
  getStats(): LevelStats {
    this.updateTimeSpent();
    this.updateAccuracy();
    return { ...this.stats };
  }

  /**
   * Check if player beat par time
   */
  isBelowParTime(): boolean {
    this.updateTimeSpent();
    return this.stats.parTime > 0 && this.stats.timeSpent <= this.stats.parTime;
  }

  /**
   * Check if all secrets found
   */
  allSecretsFound(): boolean {
    return this.stats.totalSecrets > 0 && this.stats.secretsFound >= this.stats.totalSecrets;
  }

  /**
   * Check if no deaths
   */
  isDeathless(): boolean {
    return this.stats.deaths === 0;
  }

  /**
   * Check if perfect accuracy (100% with at least 10 shots)
   */
  isPerfectAccuracy(): boolean {
    return this.stats.totalShots >= 10 && this.stats.accuracy === 100;
  }

  private updateAccuracy(): void {
    if (this.stats.totalShots > 0) {
      this.stats.accuracy = Math.round((this.stats.shotsHit / this.stats.totalShots) * 100);
    }
  }

  /**
   * Reset stats (for level restart)
   */
  reset(): void {
    const parTime = this.stats.parTime;
    const totalSecrets = this.stats.totalSecrets;
    const totalAudioLogs = this.stats.totalAudioLogs;
    const totalObjectives = this.stats.totalObjectives;

    this.stats = {
      ...DEFAULT_STATS,
      parTime,
      totalSecrets,
      totalAudioLogs,
      totalObjectives,
    };
    this.startTime = performance.now();
  }

  dispose(): void {
    // No cleanup needed
  }
}
