/**
 * LeaderboardSystem - Local leaderboards stored in IndexedDB
 *
 * Features:
 * - Per-level leaderboards
 * - Global campaign leaderboard
 * - Different categories (speedrun, high score, accuracy, kills)
 * - Top 100 entries per category
 * - Personal best tracking
 * - Difficulty filtering
 *
 * Uses the CapacitorDatabase for cross-platform SQLite persistence.
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import { type GameEventListener, getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import { capacitorDb } from '../db/database';
import type { LevelId, LevelStats } from '../levels/types';
import {
  LEADERBOARD_INFO,
  type LeaderboardEntry,
  type LeaderboardEvent,
  type LeaderboardFilter,
  type LeaderboardListener,
  type LeaderboardQueryResult,
  type LeaderboardRow,
  type LeaderboardSubmission,
  type LeaderboardType,
  type PersonalBest,
  type PersonalBestRow,
} from './LeaderboardTypes';

const log = getLogger('LeaderboardSystem');

// Maximum entries per leaderboard category
const MAX_ENTRIES_PER_CATEGORY = 100;

// Database table for player settings
const TABLE_PLAYER_SETTINGS = 'leaderboard_player_settings';

// In-memory cache for player settings (loaded from DB on init)
let cachedPlayerId: string | null = null;
let cachedPlayerName: string | null = null;
let playerSettingsLoaded = false;

/**
 * Generate a unique player ID
 */
function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Load player settings from SQLite (internal)
 */
async function loadPlayerSettings(): Promise<void> {
  if (playerSettingsLoaded) return;

  try {
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS ${TABLE_PLAYER_SETTINGS} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    const rows = await capacitorDb.query<{ key: string; value: string }>(
      `SELECT key, value FROM ${TABLE_PLAYER_SETTINGS}`
    );

    for (const row of rows) {
      if (row.key === 'player_id') {
        cachedPlayerId = row.value;
      } else if (row.key === 'player_name') {
        cachedPlayerName = row.value;
      }
    }

    // Generate new player ID if none exists
    if (!cachedPlayerId) {
      cachedPlayerId = generatePlayerId();
      await capacitorDb.run(
        `INSERT OR REPLACE INTO ${TABLE_PLAYER_SETTINGS} (key, value) VALUES (?, ?)`,
        ['player_id', cachedPlayerId]
      );
    }

    playerSettingsLoaded = true;
  } catch (error) {
    log.error('Failed to load player settings:', error);
    // Fallback to generated values
    if (!cachedPlayerId) {
      cachedPlayerId = generatePlayerId();
    }
    playerSettingsLoaded = true;
  }
}

/**
 * Get or create the local player ID
 */
function getPlayerId(): string {
  // Return cached value if available, or generate a temporary one
  // The real value is loaded during initialize()
  return cachedPlayerId ?? generatePlayerId();
}

/**
 * Get the local player name
 */
function getPlayerName(): string {
  return cachedPlayerName ?? 'MARINE';
}

/**
 * Set the local player name
 */
function setPlayerName(name: string): void {
  cachedPlayerName = name.toUpperCase().substring(0, 16);
  // Fire and forget save
  capacitorDb
    .run(`INSERT OR REPLACE INTO ${TABLE_PLAYER_SETTINGS} (key, value) VALUES (?, ?)`, [
      'player_name',
      cachedPlayerName,
    ])
    .catch((error) => {
      log.error('Failed to save player name:', error);
    });
}

/**
 * Calculate score for a leaderboard entry based on the leaderboard type
 */
function calculateScore(submission: LeaderboardSubmission, type: LeaderboardType): number {
  switch (type) {
    case 'speedrun':
      // Lower time is better, so we store the time as-is
      return submission.completionTime;
    case 'score':
      // Total score from performance rating
      return submission.totalScore;
    case 'accuracy':
      // Accuracy percentage
      return submission.accuracy;
    case 'kills':
      // Total enemies killed
      return submission.enemiesKilled;
    default:
      return 0;
  }
}

/**
 * LeaderboardSystem - Manages local leaderboards
 */
class LeaderboardSystem {
  private initialized = false;
  private listeners: Set<LeaderboardListener> = new Set();
  private static initPromise: Promise<void> | null = null;
  private eventBusUnsubscribers: (() => void)[] = [];

  /**
   * Initialize the leaderboard system.
   * Safe to call multiple times.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (LeaderboardSystem.initPromise) {
      return LeaderboardSystem.initPromise;
    }

    LeaderboardSystem.initPromise = this.doInitialize();

    try {
      await LeaderboardSystem.initPromise;
    } catch (error) {
      LeaderboardSystem.initPromise = null;
      throw error;
    }
  }

  /**
   * Internal initialization
   */
  private async doInitialize(): Promise<void> {
    await capacitorDb.init();
    await this.createTables();
    await loadPlayerSettings();
    this.subscribeToEventBus();
    this.initialized = true;
    log.info('Initialized successfully');
  }

  /**
   * Subscribe to EventBus events for cross-system communication.
   * Listens to LEVEL_COMPLETE to automatically record scores.
   */
  private subscribeToEventBus(): void {
    const eventBus = getEventBus();

    // Subscribe to LEVEL_COMPLETE to automatically record scores
    const levelCompleteHandler: GameEventListener<'LEVEL_COMPLETE'> = (event) => {
      if (event.levelId && event.stats) {
        this.handleLevelComplete(event.levelId, event.stats);
      }
    };

    this.eventBusUnsubscribers.push(eventBus.on('LEVEL_COMPLETE', levelCompleteHandler));

    log.debug('Subscribed to EventBus events');
  }

  /**
   * Handle LEVEL_COMPLETE event by submitting the score to leaderboards.
   */
  private async handleLevelComplete(levelId: LevelId, stats: LevelStats): Promise<void> {
    try {
      // Calculate total score from stats
      const totalScore = this.calculateTotalScore(stats);

      // Calculate performance rating
      const rating = this.calculateRating(stats, totalScore);

      // Get current difficulty from global settings
      const { loadDifficultySetting } = await import('../core/DifficultySettings');
      const difficulty = loadDifficultySetting();

      const submission: LeaderboardSubmission = {
        levelId,
        playerName: getPlayerName(),
        completionTime: stats.timeSpent,
        difficulty,
        accuracy: stats.accuracy ?? 0,
        enemiesKilled: stats.kills,
        damageDealt: stats.damageDealt ?? 0,
        damageTaken: stats.damageTaken ?? 0,
        deaths: stats.deaths,
        headshots: stats.headshots ?? 0,
        secretsFound: stats.secretsFound,
        totalSecrets: stats.totalSecrets ?? 0,
        rating,
        totalScore,
      };

      await this.submitScore(submission);
      log.info(`Auto-recorded score for level ${levelId}: ${totalScore} points`);
    } catch (error) {
      log.error(`Failed to auto-record score for level ${levelId}:`, error);
    }
  }

  /**
   * Calculate total score from level stats.
   * Score formula: kills * 100 + accuracy bonus + secret bonus - death penalty
   */
  private calculateTotalScore(stats: LevelStats): number {
    const killScore = stats.kills * 100;
    const accuracyBonus = Math.round((stats.accuracy ?? 0) * 10);
    const secretBonus = stats.secretsFound * 500;
    const headShotBonus = (stats.headshots ?? 0) * 50;
    const deathPenalty = stats.deaths * 200;

    // Time bonus: faster completion = more points
    const parTime = stats.parTime ?? 300; // Default 5 minutes
    const timeBonus = Math.max(0, Math.round((parTime - stats.timeSpent) * 5));

    return Math.max(
      0,
      killScore + accuracyBonus + secretBonus + headShotBonus + timeBonus - deathPenalty
    );
  }

  /**
   * Calculate performance rating from stats.
   */
  private calculateRating(stats: LevelStats, totalScore: number): string {
    const accuracy = stats.accuracy ?? 0;
    const deaths = stats.deaths;

    // S rank: No deaths, 90%+ accuracy, high score
    if (deaths === 0 && accuracy >= 90 && totalScore >= 5000) {
      return 'S';
    }
    // A rank: 0-1 deaths, 75%+ accuracy
    if (deaths <= 1 && accuracy >= 75 && totalScore >= 3000) {
      return 'A';
    }
    // B rank: 0-2 deaths, 60%+ accuracy
    if (deaths <= 2 && accuracy >= 60 && totalScore >= 1500) {
      return 'B';
    }
    // C rank: 0-3 deaths, 40%+ accuracy
    if (deaths <= 3 && accuracy >= 40) {
      return 'C';
    }
    // D rank: everything else
    return 'D';
  }

  /**
   * Create leaderboard tables
   */
  private async createTables(): Promise<void> {
    // Main leaderboard entries table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS leaderboard_entries (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        player_name TEXT NOT NULL,
        level_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        completion_time REAL NOT NULL,
        difficulty TEXT NOT NULL,
        accuracy REAL NOT NULL,
        enemies_killed INTEGER NOT NULL,
        damage_dealt REAL NOT NULL,
        damage_taken REAL NOT NULL,
        deaths INTEGER NOT NULL,
        headshots INTEGER NOT NULL,
        secrets_found INTEGER NOT NULL,
        total_secrets INTEGER NOT NULL,
        rating TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    // Index for efficient queries
    await capacitorDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_level ON leaderboard_entries(level_id);
    `);

    await capacitorDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard_entries(player_id);
    `);

    await capacitorDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard_entries(level_id, score);
    `);

    await capacitorDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_leaderboard_time ON leaderboard_entries(level_id, completion_time);
    `);

    // Personal bests table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS personal_bests (
        level_id TEXT NOT NULL,
        leaderboard_type TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        best_value REAL NOT NULL,
        entry_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        PRIMARY KEY (level_id, leaderboard_type, difficulty)
      );
    `);
  }

  /**
   * Add an event listener
   */
  addListener(listener: LeaderboardListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: LeaderboardEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        log.error('Listener error:', e);
      }
    }
  }

  // ============================================================================
  // SUBMISSION
  // ============================================================================

  /**
   * Submit a new leaderboard entry
   * Creates entries for all leaderboard types
   */
  async submitScore(submission: LeaderboardSubmission): Promise<LeaderboardEntry> {
    if (!this.initialized) {
      await this.initialize();
    }

    const playerId = getPlayerId();
    const entryId = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create the entry
    const entry: LeaderboardEntry = {
      id: entryId,
      rank: 0, // Will be calculated after insertion
      playerId,
      playerName: submission.playerName || getPlayerName(),
      score: submission.totalScore,
      levelId: submission.levelId,
      completionTime: submission.completionTime,
      difficulty: submission.difficulty,
      accuracy: submission.accuracy,
      enemiesKilled: submission.enemiesKilled,
      damageDealt: submission.damageDealt,
      damageTaken: submission.damageTaken,
      deaths: submission.deaths,
      headshots: submission.headshots,
      secretsFound: submission.secretsFound,
      totalSecrets: submission.totalSecrets,
      timestamp: Date.now(),
      rating: submission.rating,
    };

    // Insert the entry
    await capacitorDb.run(
      `INSERT INTO leaderboard_entries (
        id, player_id, player_name, level_id, score, completion_time,
        difficulty, accuracy, enemies_killed, damage_dealt, damage_taken,
        deaths, headshots, secrets_found, total_secrets, rating, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.playerId,
        entry.playerName,
        entry.levelId,
        entry.score,
        entry.completionTime,
        entry.difficulty,
        entry.accuracy,
        entry.enemiesKilled,
        entry.damageDealt,
        entry.damageTaken,
        entry.deaths,
        entry.headshots,
        entry.secretsFound,
        entry.totalSecrets,
        entry.rating,
        entry.timestamp,
      ]
    );

    // Update personal bests for each leaderboard type
    await this.updatePersonalBests(entry);

    // Prune old entries to keep leaderboards at max size
    await this.pruneLeaderboard(submission.levelId);

    // Emit event
    this.emit({ type: 'entry_added', entry });

    log.info(`Score submitted for ${submission.levelId}: ${submission.totalScore}`);

    return entry;
  }

  /**
   * Update personal bests for all leaderboard types
   */
  private async updatePersonalBests(entry: LeaderboardEntry): Promise<void> {
    const leaderboardTypes: LeaderboardType[] = ['speedrun', 'score', 'accuracy', 'kills'];

    for (const type of leaderboardTypes) {
      const info = LEADERBOARD_INFO[type];
      const currentValue = calculateScore(
        {
          levelId: entry.levelId,
          playerName: entry.playerName,
          completionTime: entry.completionTime,
          difficulty: entry.difficulty,
          accuracy: entry.accuracy,
          enemiesKilled: entry.enemiesKilled,
          damageDealt: entry.damageDealt,
          damageTaken: entry.damageTaken,
          deaths: entry.deaths,
          headshots: entry.headshots,
          secretsFound: entry.secretsFound,
          totalSecrets: entry.totalSecrets,
          rating: entry.rating,
          totalScore: entry.score,
        },
        type
      );

      // Check current personal best
      const rows = await capacitorDb.query<PersonalBestRow>(
        `SELECT * FROM personal_bests WHERE level_id = ? AND leaderboard_type = ? AND difficulty = ?`,
        [entry.levelId, type, entry.difficulty]
      );

      let isNewBest = false;
      let previousBest: number | undefined;

      if (rows.length === 0) {
        // No existing personal best
        isNewBest = true;
      } else {
        previousBest = rows[0].best_value;
        // Check if this is better
        if (info.higherIsBetter) {
          isNewBest = currentValue > previousBest;
        } else {
          isNewBest = currentValue < previousBest;
        }
      }

      if (isNewBest) {
        // Update or insert personal best
        await capacitorDb.run(
          `INSERT OR REPLACE INTO personal_bests (level_id, leaderboard_type, difficulty, best_value, entry_id, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [entry.levelId, type, entry.difficulty, currentValue, entry.id, Date.now()]
        );

        // Emit personal best event
        this.emit({
          type: 'personal_best',
          levelId: entry.levelId,
          leaderboardType: type,
          entry,
          previousBest,
        });

        log.info(`New personal best for ${entry.levelId} ${type}: ${currentValue}`);
      }
    }
  }

  /**
   * Prune leaderboard to keep only top entries
   */
  private async pruneLeaderboard(levelId: LevelId | 'campaign'): Promise<void> {
    // Keep top 100 by score for each difficulty
    const difficulties: DifficultyLevel[] = ['easy', 'normal', 'hard', 'nightmare'];

    for (const difficulty of difficulties) {
      // Get IDs to keep (top entries by score)
      const keepRows = await capacitorDb.query<{ id: string }>(
        `SELECT id FROM leaderboard_entries
         WHERE level_id = ? AND difficulty = ?
         ORDER BY score DESC
         LIMIT ?`,
        [levelId, difficulty, MAX_ENTRIES_PER_CATEGORY]
      );

      const keepIds = keepRows.map((r) => r.id);

      if (keepIds.length >= MAX_ENTRIES_PER_CATEGORY) {
        // Delete entries not in the top list
        const placeholders = keepIds.map(() => '?').join(',');
        await capacitorDb.run(
          `DELETE FROM leaderboard_entries
           WHERE level_id = ? AND difficulty = ? AND id NOT IN (${placeholders})`,
          [levelId, difficulty, ...keepIds]
        );
      }
    }
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get leaderboard entries
   */
  async getLeaderboard(
    levelId: LevelId | 'campaign',
    type: LeaderboardType,
    filter?: LeaderboardFilter
  ): Promise<LeaderboardQueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const info = LEADERBOARD_INFO[type];
    const limit = filter?.limit ?? 100;
    const offset = filter?.offset ?? 0;
    const difficulty = filter?.difficulty;

    // Build ORDER BY based on leaderboard type
    let orderColumn: string;
    let orderDirection: string;

    switch (type) {
      case 'speedrun':
        orderColumn = 'completion_time';
        orderDirection = 'ASC';
        break;
      case 'accuracy':
        orderColumn = 'accuracy';
        orderDirection = 'DESC';
        break;
      case 'kills':
        orderColumn = 'enemies_killed';
        orderDirection = 'DESC';
        break;
      default:
        orderColumn = 'score';
        orderDirection = 'DESC';
        break;
    }

    // Build query
    let query = `SELECT * FROM leaderboard_entries WHERE level_id = ?`;
    const params: (string | number)[] = [levelId];

    if (difficulty && difficulty !== 'all') {
      query += ` AND difficulty = ?`;
      params.push(difficulty);
    }

    // Get total count
    const countRows = await capacitorDb.query<{ 'COUNT(*)': number }>(
      query.replace('*', 'COUNT(*)'),
      params
    );
    const totalCount = countRows[0]?.['COUNT(*)'] ?? 0;

    // Get entries with ordering and pagination
    query += ` ORDER BY ${orderColumn} ${orderDirection}, timestamp ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = await capacitorDb.query<LeaderboardRow>(query, params);

    // Convert to entries with rank
    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      id: row.id,
      rank: offset + index + 1,
      playerId: row.player_id,
      playerName: row.player_name,
      score: row.score,
      levelId: row.level_id as LevelId | 'campaign',
      completionTime: row.completion_time,
      difficulty: row.difficulty as DifficultyLevel,
      accuracy: row.accuracy,
      enemiesKilled: row.enemies_killed,
      damageDealt: row.damage_dealt,
      damageTaken: row.damage_taken,
      deaths: row.deaths,
      headshots: row.headshots,
      secretsFound: row.secrets_found,
      totalSecrets: row.total_secrets,
      rating: row.rating,
      timestamp: row.timestamp,
    }));

    // Find player's entry and rank
    const playerId = getPlayerId();
    const playerEntry = entries.find((e) => e.playerId === playerId);
    let playerRank: number | undefined;

    if (!playerEntry) {
      // Player not in current page, find their rank
      const rankQuery = info.higherIsBetter
        ? `SELECT COUNT(*) + 1 as rank FROM leaderboard_entries
           WHERE level_id = ? AND ${orderColumn} > (
             SELECT ${orderColumn} FROM leaderboard_entries
             WHERE level_id = ? AND player_id = ?
             ORDER BY ${orderColumn} ${orderDirection} LIMIT 1
           )`
        : `SELECT COUNT(*) + 1 as rank FROM leaderboard_entries
           WHERE level_id = ? AND ${orderColumn} < (
             SELECT ${orderColumn} FROM leaderboard_entries
             WHERE level_id = ? AND player_id = ?
             ORDER BY ${orderColumn} ${orderDirection} LIMIT 1
           )`;

      const rankRows = await capacitorDb.query<{ rank: number }>(rankQuery, [
        levelId,
        levelId,
        playerId,
      ]);
      playerRank = rankRows[0]?.rank;
    } else {
      playerRank = playerEntry.rank;
    }

    return {
      entries,
      totalCount,
      playerRank,
      playerEntry,
    };
  }

  /**
   * Get personal bests for a player
   */
  async getPersonalBests(levelId?: LevelId | 'campaign'): Promise<PersonalBest[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    let query = `SELECT pb.*, le.*
                 FROM personal_bests pb
                 JOIN leaderboard_entries le ON pb.entry_id = le.id`;
    const params: string[] = [];

    if (levelId) {
      query += ` WHERE pb.level_id = ?`;
      params.push(levelId);
    }

    const rows = await capacitorDb.query<PersonalBestRow & LeaderboardRow>(query, params);

    return rows.map((row) => ({
      levelId: row.level_id as LevelId | 'campaign',
      type: row.leaderboard_type as LeaderboardType,
      difficulty: row.difficulty as DifficultyLevel,
      value: row.best_value,
      timestamp: row.timestamp,
      entry: {
        id: row.id,
        rank: 0, // Not relevant for personal bests
        playerId: row.player_id,
        playerName: row.player_name,
        score: row.score,
        levelId: row.level_id as LevelId | 'campaign',
        completionTime: row.completion_time,
        difficulty: row.difficulty as DifficultyLevel,
        accuracy: row.accuracy,
        enemiesKilled: row.enemies_killed,
        damageDealt: row.damage_dealt,
        damageTaken: row.damage_taken,
        deaths: row.deaths,
        headshots: row.headshots,
        secretsFound: row.secrets_found,
        totalSecrets: row.total_secrets,
        rating: row.rating,
        timestamp: row.timestamp,
      },
    }));
  }

  /**
   * Get a specific personal best
   */
  async getPersonalBest(
    levelId: LevelId | 'campaign',
    type: LeaderboardType,
    difficulty: DifficultyLevel
  ): Promise<PersonalBest | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const rows = await capacitorDb.query<PersonalBestRow & LeaderboardRow>(
      `SELECT pb.*, le.*
       FROM personal_bests pb
       JOIN leaderboard_entries le ON pb.entry_id = le.id
       WHERE pb.level_id = ? AND pb.leaderboard_type = ? AND pb.difficulty = ?`,
      [levelId, type, difficulty]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      levelId: row.level_id as LevelId | 'campaign',
      type: row.leaderboard_type as LeaderboardType,
      difficulty: row.difficulty as DifficultyLevel,
      value: row.best_value,
      timestamp: row.timestamp,
      entry: {
        id: row.id,
        rank: 0,
        playerId: row.player_id,
        playerName: row.player_name,
        score: row.score,
        levelId: row.level_id as LevelId | 'campaign',
        completionTime: row.completion_time,
        difficulty: row.difficulty as DifficultyLevel,
        accuracy: row.accuracy,
        enemiesKilled: row.enemies_killed,
        damageDealt: row.damage_dealt,
        damageTaken: row.damage_taken,
        deaths: row.deaths,
        headshots: row.headshots,
        secretsFound: row.secrets_found,
        totalSecrets: row.total_secrets,
        rating: row.rating,
        timestamp: row.timestamp,
      },
    };
  }

  /**
   * Get player's entries for a level
   */
  async getPlayerEntries(
    levelId: LevelId | 'campaign',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const playerId = getPlayerId();

    const rows = await capacitorDb.query<LeaderboardRow>(
      `SELECT * FROM leaderboard_entries
       WHERE level_id = ? AND player_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [levelId, playerId, limit]
    );

    return rows.map((row) => ({
      id: row.id,
      rank: 0, // Not ranked in this context
      playerId: row.player_id,
      playerName: row.player_name,
      score: row.score,
      levelId: row.level_id as LevelId | 'campaign',
      completionTime: row.completion_time,
      difficulty: row.difficulty as DifficultyLevel,
      accuracy: row.accuracy,
      enemiesKilled: row.enemies_killed,
      damageDealt: row.damage_dealt,
      damageTaken: row.damage_taken,
      deaths: row.deaths,
      headshots: row.headshots,
      secretsFound: row.secrets_found,
      totalSecrets: row.total_secrets,
      rating: row.rating,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Get leaderboard statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    uniquePlayers: number;
    entriesByLevel: Record<string, number>;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const totalRows = await capacitorDb.query<{ 'COUNT(*)': number }>(
      `SELECT COUNT(*) FROM leaderboard_entries`
    );
    const totalEntries = totalRows[0]?.['COUNT(*)'] ?? 0;

    const playerRows = await capacitorDb.query<{ 'COUNT(DISTINCT player_id)': number }>(
      `SELECT COUNT(DISTINCT player_id) FROM leaderboard_entries`
    );
    const uniquePlayers = playerRows[0]?.['COUNT(DISTINCT player_id)'] ?? 0;

    const levelRows = await capacitorDb.query<{ level_id: string; count: number }>(
      `SELECT level_id, COUNT(*) as count FROM leaderboard_entries GROUP BY level_id`
    );

    const entriesByLevel: Record<string, number> = {};
    for (const row of levelRows) {
      entriesByLevel[row.level_id] = row.count;
    }

    return {
      totalEntries,
      uniquePlayers,
      entriesByLevel,
    };
  }

  // ============================================================================
  // PLAYER MANAGEMENT
  // ============================================================================

  /**
   * Get current player ID
   */
  getPlayerId(): string {
    return getPlayerId();
  }

  /**
   * Get current player name
   */
  getPlayerName(): string {
    return getPlayerName();
  }

  /**
   * Set player name
   */
  setPlayerName(name: string): void {
    setPlayerName(name);
  }

  // ============================================================================
  // DATA MANAGEMENT
  // ============================================================================

  /**
   * Clear all leaderboard data
   */
  async clearAllData(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await capacitorDb.run(`DELETE FROM leaderboard_entries`);
    await capacitorDb.run(`DELETE FROM personal_bests`);
    log.info('All leaderboard data cleared');
  }

  /**
   * Clear leaderboard data for a specific level
   */
  async clearLevelData(levelId: LevelId | 'campaign'): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await capacitorDb.run(`DELETE FROM leaderboard_entries WHERE level_id = ?`, [levelId]);
    await capacitorDb.run(`DELETE FROM personal_bests WHERE level_id = ?`, [levelId]);
    log.info(`Leaderboard data cleared for ${levelId}`);
  }

  /**
   * Persist data to storage
   */
  async persist(): Promise<void> {
    await capacitorDb.persist();
  }

  /**
   * Dispose the leaderboard system.
   * Unsubscribes from all EventBus events and clears listeners.
   */
  dispose(): void {
    // Unsubscribe from all EventBus events
    for (const unsubscribe of this.eventBusUnsubscribers) {
      unsubscribe();
    }
    this.eventBusUnsubscribers = [];

    // Clear internal listeners
    this.listeners.clear();

    this.initialized = false;
    LeaderboardSystem.initPromise = null;
    log.info('Disposed');
  }
}

// Singleton instance
export const leaderboardSystem = new LeaderboardSystem();

// Export helper functions
export { getPlayerId, getPlayerName, setPlayerName };
