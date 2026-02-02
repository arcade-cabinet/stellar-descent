/**
 * StatisticsTracker - Real-time statistics tracking and persistence
 *
 * Tracks all player statistics during gameplay, persists to IndexedDB,
 * and provides methods for querying and updating stats.
 *
 * Features:
 * - Real-time stat updates during gameplay
 * - Automatic persistence with debouncing
 * - Session tracking
 * - Derived stat calculations
 * - Event-based stat updates
 */

import { getLogger } from '../core/Logger';
import { worldDb } from '../db/worldDatabase';
import type { WeaponId } from '../entities/weapons';
import type { LevelId } from '../levels/types';
import {
  calculateDerivedStats,
  createDefaultStats,
  type DerivedStats,
  type EnemyType,
  type PlayerStats,
  type SessionStats,
  STATS_VERSION,
} from './PlayerStats';

const log = getLogger('StatisticsTracker');

// Storage key for stats in IndexedDB
const STATS_STORAGE_KEY = 'player_stats';

// Debounce time for persistence (ms)
const PERSIST_DEBOUNCE_MS = 2000;

// ============================================================================
// STATISTICS TRACKER CLASS
// ============================================================================

class StatisticsTrackerClass {
  private stats: PlayerStats;
  private sessionStats: SessionStats;
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private listeners: Set<(stats: PlayerStats) => void> = new Set();

  // Kill streak tracking
  private currentKillStreak = 0;
  private sessionKillStreak = 0;

  constructor() {
    this.stats = createDefaultStats();
    this.sessionStats = this.createNewSession();
  }

  /**
   * Initialize the statistics tracker
   * Loads existing stats from IndexedDB or creates new ones
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await worldDb.init();

      // Try to load existing stats
      const storedData = await worldDb.getChunkData(STATS_STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData) as PlayerStats;
        this.stats = this.migrateStats(parsed);
        log.info('Loaded existing player statistics');
      } else {
        this.stats = createDefaultStats();
        log.info('Created new player statistics');
      }

      // Start new session
      this.sessionStats = this.createNewSession();
      this.stats.currentSessionStart = Date.now();

      this.initialized = true;
    } catch (error) {
      log.error('Failed to initialize statistics tracker:', error);
      this.stats = createDefaultStats();
      this.initialized = true;
    }
  }

  /**
   * Create a new session object
   */
  private createNewSession(): SessionStats {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // lgtm[js/insecure-randomness] -- game session ID, not security token
      startTime: Date.now(),
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      damageTaken: 0,
      shotsFired: 0,
      shotsHit: 0,
      levelsCompleted: [],
      collectiblesFound: 0,
    };
  }

  /**
   * Migrate stats from older versions
   */
  private migrateStats(stats: PlayerStats): PlayerStats {
    if (stats.version === STATS_VERSION) {
      return stats;
    }

    log.info(`Migrating stats from v${stats.version} to v${STATS_VERSION}`);

    // Apply migrations as needed
    const migrated = {
      ...createDefaultStats(),
      ...stats,
      version: STATS_VERSION,
      lastUpdated: Date.now(),
    };

    return migrated;
  }

  /**
   * Schedule persistence (debounced)
   */
  private schedulePersist(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = setTimeout(() => {
      this.persist();
    }, PERSIST_DEBOUNCE_MS);
  }

  /**
   * Persist stats to IndexedDB
   */
  async persist(): Promise<void> {
    if (!this.initialized) return;

    try {
      this.stats.lastUpdated = Date.now();
      await worldDb.setChunkData(STATS_STORAGE_KEY, JSON.stringify(this.stats));
      worldDb.persistToIndexedDB();
      log.debug('Statistics persisted');
    } catch (error) {
      log.error('Failed to persist statistics:', error);
    }
  }

  /**
   * Force immediate persistence
   */
  async flush(): Promise<void> {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    await this.persist();
  }

  /**
   * Add a listener for stat changes
   */
  addListener(listener: (stats: PlayerStats) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of stat changes
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.stats);
      } catch (error) {
        log.error('Stats listener error:', error);
      }
    }
  }

  // ============================================================================
  // STAT GETTERS
  // ============================================================================

  /**
   * Get current stats
   */
  getStats(): PlayerStats {
    return { ...this.stats };
  }

  /**
   * Get derived stats
   */
  getDerivedStats(): DerivedStats {
    return calculateDerivedStats(this.stats);
  }

  /**
   * Get current session stats
   */
  getSessionStats(): SessionStats {
    return { ...this.sessionStats };
  }

  /**
   * Get total play time including current session
   */
  getTotalPlayTime(): number {
    const currentSessionTime = Date.now() - this.stats.currentSessionStart;
    return this.stats.totalPlayTime + currentSessionTime;
  }

  // ============================================================================
  // COMBAT TRACKING
  // ============================================================================

  /**
   * Record a kill
   */
  recordKill(
    enemyType: EnemyType,
    weaponId: WeaponId,
    isHeadshot = false,
    isMelee = false,
    isGrenade = false
  ): void {
    this.stats.totalKills++;
    this.sessionStats.kills++;

    // Track by weapon
    this.stats.killsByWeapon[weaponId] = (this.stats.killsByWeapon[weaponId] || 0) + 1;

    // Track by enemy
    this.stats.killsByEnemy[enemyType] = (this.stats.killsByEnemy[enemyType] || 0) + 1;

    // Track special kills
    if (isHeadshot) this.stats.headshots++;
    if (isMelee) this.stats.meleeKills++;
    if (isGrenade) this.stats.grenadeKills++;

    // Track boss kills
    if (enemyType === 'queen' || enemyType === 'broodmother') {
      this.stats.bossesDefeated++;
    }

    // Update kill streaks
    this.currentKillStreak++;
    this.sessionKillStreak++;
    if (this.currentKillStreak > this.stats.longestKillStreak) {
      this.stats.longestKillStreak = this.currentKillStreak;
    }
    if (this.sessionKillStreak > this.stats.highestKillStreak) {
      this.stats.highestKillStreak = this.sessionKillStreak;
    }

    // First kill milestone
    if (this.stats.firstKillAt === null) {
      this.stats.firstKillAt = Date.now();
    }

    this.schedulePersist();
    this.notifyListeners();
  }

  /**
   * Record a player death
   */
  recordDeath(levelId?: LevelId): void {
    this.stats.deaths++;
    this.sessionStats.deaths++;

    // Reset kill streak
    this.currentKillStreak = 0;

    // Track by level
    if (levelId) {
      this.stats.deathsByLevel[levelId] = (this.stats.deathsByLevel[levelId] || 0) + 1;
    }

    // First death milestone
    if (this.stats.firstDeathAt === null) {
      this.stats.firstDeathAt = Date.now();
    }

    this.schedulePersist();
    this.notifyListeners();
  }

  // ============================================================================
  // ACCURACY TRACKING
  // ============================================================================

  /**
   * Record a shot fired
   */
  recordShotFired(weaponId: WeaponId): void {
    this.stats.shotsFired++;
    this.sessionStats.shotsFired++;
    this.stats.shotsFiredByWeapon[weaponId] = (this.stats.shotsFiredByWeapon[weaponId] || 0) + 1;

    // Update accuracy
    this.updateAccuracy();
    this.schedulePersist();
  }

  /**
   * Record a shot hit
   */
  recordShotHit(weaponId: WeaponId): void {
    this.stats.shotsHit++;
    this.sessionStats.shotsHit++;
    this.stats.shotsHitByWeapon[weaponId] = (this.stats.shotsHitByWeapon[weaponId] || 0) + 1;

    // Update accuracy
    this.updateAccuracy();
    this.schedulePersist();
  }

  /**
   * Update accuracy calculation
   */
  private updateAccuracy(): void {
    if (this.stats.shotsFired > 0) {
      this.stats.accuracy = (this.stats.shotsHit / this.stats.shotsFired) * 100;
    }
  }

  // ============================================================================
  // DAMAGE TRACKING
  // ============================================================================

  /**
   * Record damage dealt to enemy
   */
  recordDamageDealt(damage: number): void {
    this.stats.damageDealt += damage;
    this.sessionStats.damageDealt += damage;
    this.schedulePersist();
  }

  /**
   * Record damage taken by player
   */
  recordDamageTaken(damage: number): void {
    this.stats.damageTaken += damage;
    this.sessionStats.damageTaken += damage;
    this.schedulePersist();
  }

  /**
   * Record health healed
   */
  recordHealthHealed(amount: number): void {
    this.stats.healthHealed += amount;
    this.schedulePersist();
  }

  /**
   * Record armor damage absorbed
   */
  recordArmorAbsorbed(amount: number): void {
    this.stats.armorAbsorbed += amount;
    this.schedulePersist();
  }

  /**
   * Record grenade thrown
   */
  recordGrenadeThrown(): void {
    this.stats.grenadesThrown++;
    this.schedulePersist();
  }

  // ============================================================================
  // LEVEL & CAMPAIGN TRACKING
  // ============================================================================

  /**
   * Record level completion
   */
  recordLevelComplete(levelId: LevelId, timeMs: number): void {
    this.stats.levelsCompleted++;
    this.sessionStats.levelsCompleted.push(levelId);

    // Track completion count
    this.stats.levelCompletionCounts[levelId] =
      (this.stats.levelCompletionCounts[levelId] || 0) + 1;

    // Track best time
    const currentBest = this.stats.levelBestTimes[levelId];
    if (currentBest === undefined || timeMs < currentBest) {
      this.stats.levelBestTimes[levelId] = timeMs;
    }

    // Track time spent
    this.stats.timeByLevel[levelId] = (this.stats.timeByLevel[levelId] || 0) + timeMs;

    this.schedulePersist();
    this.notifyListeners();
  }

  /**
   * Record campaign completion
   */
  recordCampaignComplete(totalTimeMs: number): void {
    this.stats.campaignCompletions++;

    // Track fastest campaign
    if (this.stats.fastestCampaign === null || totalTimeMs < this.stats.fastestCampaign) {
      this.stats.fastestCampaign = totalTimeMs;
    }

    // First completion milestone
    if (this.stats.firstCampaignCompleteAt === null) {
      this.stats.firstCampaignCompleteAt = Date.now();
    }

    this.schedulePersist();
    this.notifyListeners();
  }

  // ============================================================================
  // COLLECTIBLE TRACKING
  // ============================================================================

  /**
   * Record skull found
   */
  recordSkullFound(skullId: string, levelId: LevelId): void {
    // Check if already found
    const levelSkulls = this.stats.skullsByLevel[levelId] || [];
    if (levelSkulls.includes(skullId)) return;

    this.stats.skullsFound++;
    this.stats.skullsByLevel[levelId] = [...levelSkulls, skullId];
    this.sessionStats.collectiblesFound++;

    this.schedulePersist();
    this.notifyListeners();
  }

  /**
   * Record audio log found
   */
  recordAudioLogFound(logId: string, levelId: LevelId): void {
    // Check if already found
    const levelLogs = this.stats.audioLogsByLevel[levelId] || [];
    if (levelLogs.includes(logId)) return;

    this.stats.audioLogsFound++;
    this.stats.audioLogsByLevel[levelId] = [...levelLogs, logId];
    this.sessionStats.collectiblesFound++;

    this.schedulePersist();
    this.notifyListeners();
  }

  /**
   * Record secret area found
   */
  recordSecretFound(secretId: string, levelId: LevelId): void {
    // Check if already found
    const levelSecrets = this.stats.secretsByLevel[levelId] || [];
    if (levelSecrets.includes(secretId)) return;

    this.stats.secretsFound++;
    this.stats.secretsByLevel[levelId] = [...levelSecrets, secretId];
    this.sessionStats.collectiblesFound++;

    this.schedulePersist();
    this.notifyListeners();
  }

  // ============================================================================
  // ACHIEVEMENT TRACKING
  // ============================================================================

  /**
   * Record achievement unlocked
   */
  recordAchievementUnlocked(achievementId: string): void {
    if (this.stats.unlockedAchievementIds.includes(achievementId)) return;

    this.stats.achievementsUnlocked++;
    this.stats.unlockedAchievementIds.push(achievementId);

    this.schedulePersist();
    this.notifyListeners();
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * End the current session and start a new one
   */
  endSession(): void {
    const sessionDuration = Date.now() - this.sessionStats.startTime;

    // Update total play time
    this.stats.totalPlayTime += sessionDuration;

    // Update longest session
    if (sessionDuration > this.stats.longestSession) {
      this.stats.longestSession = sessionDuration;
    }

    // Persist final session stats
    this.persist();

    // Start new session
    this.sessionStats = this.createNewSession();
    this.stats.currentSessionStart = Date.now();
    this.sessionKillStreak = 0;
    this.currentKillStreak = 0;
  }

  /**
   * Update play time (call periodically during gameplay)
   */
  updatePlayTime(): void {
    const currentSessionTime = Date.now() - this.stats.currentSessionStart;
    const _totalTime = this.stats.totalPlayTime + currentSessionTime;

    // Only schedule persist if significant time has passed
    if (currentSessionTime % 60000 < 1000) {
      this.schedulePersist();
    }
  }

  // ============================================================================
  // RESET OPERATIONS
  // ============================================================================

  /**
   * Reset all statistics (with confirmation callback)
   */
  async resetAllStats(): Promise<void> {
    this.stats = createDefaultStats();
    this.sessionStats = this.createNewSession();
    this.currentKillStreak = 0;
    this.sessionKillStreak = 0;

    await this.persist();
    this.notifyListeners();
    log.info('All statistics reset');
  }

  /**
   * Dispose the tracker (cleanup)
   */
  dispose(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    this.endSession();
    this.listeners.clear();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const statisticsTracker = new StatisticsTrackerClass();

/**
 * Get the statistics tracker instance
 */
export function getStatisticsTracker(): StatisticsTrackerClass {
  return statisticsTracker;
}
