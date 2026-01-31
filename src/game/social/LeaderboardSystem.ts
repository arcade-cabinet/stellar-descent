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
import { getLogger } from '../core/Logger';
import { capacitorDb } from '../db/CapacitorDatabase';
import type { LevelId } from '../levels/types';
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

// Local storage key for player ID
const PLAYER_ID_KEY = 'stellar_descent_player_id';
const PLAYER_NAME_KEY = 'stellar_descent_player_name';

/**
 * Generate a unique player ID
 */
function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get or create the local player ID
 */
function getPlayerId(): string {
  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId) {
    playerId = generatePlayerId();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

/**
 * Get the local player name
 */
function getPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || 'MARINE';
}

/**
 * Set the local player name
 */
function setPlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name.toUpperCase().substring(0, 16));
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
    this.initialized = true;
    log.info('Initialized successfully');
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
      case 'score':
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
  async getPlayerEntries(levelId: LevelId | 'campaign', limit: number = 10): Promise<LeaderboardEntry[]> {
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
}

// Singleton instance
export const leaderboardSystem = new LeaderboardSystem();

// Export helper functions
export { getPlayerId, getPlayerName, setPlayerName };
