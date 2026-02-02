/**
 * WorldDatabase - Game data persistence using @capacitor-community/sqlite
 *
 * Provides a unified SQLite interface for all platforms (Web, iOS, Android).
 * Uses the CapacitorDatabase abstraction layer for cross-platform compatibility.
 *
 * The database stores:
 * - World chunks and procedural generation data
 * - Player stats and progression
 * - Alien kill tracking
 * - Inventory items
 * - Quest progress
 * - Tutorial state
 * - Level completion records
 */

import { getLogger } from '../core/Logger';
import { capacitorDb } from './database';

const log = getLogger('WorldDatabase');

export interface ChunkData {
  chunkX: number;
  chunkZ: number;
  seed: number;
  buildings: string; // JSON serialized
  obstacles: string; // JSON serialized
  enemies: string; // JSON serialized
  visited: boolean;
}

export interface SavedEntity {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  health: number;
  data: string; // JSON serialized extra data
}

// Alien kill tracking
export interface AlienKillStats {
  speciesId: string;
  totalKilled: number;
  damageDealt: number;
  damageReceived: number;
  firstKillTimestamp: number;
  lastKillTimestamp: number;
}

// Loot/inventory item
export interface InventoryItem {
  itemId: string;
  quantity: number;
  acquiredTimestamp: number;
}

// Quest progress
export interface QuestProgress {
  questId: string;
  stepIndex: number;
  completed: boolean;
  startedTimestamp: number;
  completedTimestamp: number | null;
  data: string; // JSON serialized quest-specific data
}

// Database row types for type-safe queries
interface ChunkRow {
  chunk_x: number;
  chunk_z: number;
  seed: number;
  buildings: string;
  obstacles: string;
  enemies: string;
  visited: number;
  created_at: number;
}

interface EntityRow {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  health: number;
  data: string;
  chunk_x: number;
  chunk_z: number;
}

interface PlayerStatsRow {
  id: number;
  kills: number;
  distance_traveled: number;
  bosses_defeated: number;
  mechs_called: number;
  last_x: number;
  last_y: number;
  last_z: number;
}

interface AlienKillRow {
  species_id: string;
  total_killed: number;
  damage_dealt: number;
  damage_received: number;
  first_kill_timestamp: number;
  last_kill_timestamp: number;
}

interface InventoryRow {
  item_id: string;
  quantity: number;
  acquired_timestamp: number;
}

interface QuestRow {
  quest_id: string;
  step_index: number;
  completed: number;
  started_timestamp: number;
  completed_timestamp: number | null;
  data: string;
}

interface TutorialRow {
  id: number;
  tutorial_completed: number;
  current_step: number;
  steps_completed: string;
}

interface ChunkDataRow {
  key: string;
  data: string;
  updated_at: number;
}

interface LevelCompletionRow {
  level_id: string;
  completed: number;
  completed_at: number | null;
  best_time_seconds: number | null;
  total_kills: number;
}

interface CountRow {
  'count(*)': number;
}

class WorldDatabase {
  private initialized = false;
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly PERSIST_DEBOUNCE_MS = 1000;

  /**
   * Singleton initialization promise to prevent race conditions.
   * Multiple callers may invoke init() simultaneously, but we only
   * want to run initialization once.
   */
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize the world database.
   * Safe to call multiple times concurrently - only the first call
   * performs initialization, subsequent calls wait for completion.
   */
  async init(): Promise<void> {
    // Fast path: already initialized
    if (this.initialized) return;

    // If initialization is already in progress, wait for it
    if (WorldDatabase.initPromise) {
      return WorldDatabase.initPromise;
    }

    // Start initialization and store the promise
    WorldDatabase.initPromise = this.doInit();

    try {
      await WorldDatabase.initPromise;
    } catch (error) {
      // Reset the promise so initialization can be retried
      WorldDatabase.initPromise = null;
      throw error;
    }
  }

  /**
   * Perform actual initialization (internal method)
   */
  private async doInit(): Promise<void> {
    await capacitorDb.init();
    await this.createTables();
    this.initialized = true;
    log.info('Initialized successfully');
  }

  /**
   * Create all database tables
   */
  private async createTables(): Promise<void> {
    // Chunks table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS chunks (
        chunk_x INTEGER,
        chunk_z INTEGER,
        seed INTEGER,
        buildings TEXT,
        obstacles TEXT,
        enemies TEXT,
        visited INTEGER DEFAULT 0,
        created_at INTEGER,
        PRIMARY KEY (chunk_x, chunk_z)
      );
    `);

    // Entities table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT,
        x REAL,
        y REAL,
        z REAL,
        health REAL,
        data TEXT,
        chunk_x INTEGER,
        chunk_z INTEGER
      );
    `);

    await capacitorDb.execute(`
      CREATE INDEX IF NOT EXISTS idx_entities_chunk ON entities(chunk_x, chunk_z);
    `);

    // Player stats table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS player_stats (
        id INTEGER PRIMARY KEY DEFAULT 1,
        kills INTEGER DEFAULT 0,
        distance_traveled REAL DEFAULT 0,
        bosses_defeated INTEGER DEFAULT 0,
        mechs_called INTEGER DEFAULT 0,
        last_x REAL DEFAULT 0,
        last_y REAL DEFAULT 0,
        last_z REAL DEFAULT 0
      );
    `);

    await capacitorDb.run(`INSERT OR IGNORE INTO player_stats (id) VALUES (1)`);

    // Alien kills table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS alien_kills (
        species_id TEXT PRIMARY KEY,
        total_killed INTEGER DEFAULT 0,
        damage_dealt REAL DEFAULT 0,
        damage_received REAL DEFAULT 0,
        first_kill_timestamp INTEGER,
        last_kill_timestamp INTEGER
      );
    `);

    // Inventory table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS inventory (
        item_id TEXT PRIMARY KEY,
        quantity INTEGER DEFAULT 0,
        acquired_timestamp INTEGER
      );
    `);

    // Quests table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS quests (
        quest_id TEXT PRIMARY KEY,
        step_index INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        started_timestamp INTEGER,
        completed_timestamp INTEGER,
        data TEXT DEFAULT '{}'
      );
    `);

    // Tutorial progress table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS tutorial_progress (
        id INTEGER PRIMARY KEY DEFAULT 1,
        tutorial_completed INTEGER DEFAULT 0,
        current_step INTEGER DEFAULT 0,
        steps_completed TEXT DEFAULT '[]'
      );
    `);

    await capacitorDb.run(`INSERT OR IGNORE INTO tutorial_progress (id) VALUES (1)`);

    // Chunk data table (for ChunkManager procedural generation)
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS chunk_data (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER
      );
    `);

    // Level completion table
    await capacitorDb.execute(`
      CREATE TABLE IF NOT EXISTS level_completion (
        level_id TEXT PRIMARY KEY,
        completed INTEGER DEFAULT 0,
        completed_at INTEGER,
        best_time_seconds REAL,
        total_kills INTEGER DEFAULT 0
      );
    `);
  }

  /**
   * Export the database as a Uint8Array (for backup/transfer)
   */
  exportDatabase(): Uint8Array | null {
    // Note: This is now async, but we maintain sync signature for compatibility
    // The actual export happens on persist
    log.warn('exportDatabase is deprecated, use async exportDatabaseAsync instead');
    return null;
  }

  /**
   * Export the database as a Uint8Array (async version)
   */
  async exportDatabaseAsync(): Promise<Uint8Array | null> {
    return capacitorDb.exportDatabase();
  }

  /**
   * Import database from Uint8Array
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    await capacitorDb.importDatabase(data);
    this.initialized = true;
  }

  /**
   * Reset the database - clears all data and recreates tables
   */
  async resetDatabase(): Promise<void> {
    await capacitorDb.deleteDatabase();
    this.initialized = false;
    await this.init();
  }

  /**
   * Schedule persistence (debounced)
   */
  persistToIndexedDB(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = setTimeout(() => {
      capacitorDb.persist().catch((err) => {
        log.error('Persist failed:', err);
      });
    }, this.PERSIST_DEBOUNCE_MS);
  }

  /**
   * Force immediate persistence
   */
  async persistNow(): Promise<void> {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    await capacitorDb.persist();
  }

  /**
   * Flush pending persistence operations
   */
  async flushPersistence(): Promise<void> {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    await capacitorDb.persist();
  }

  /**
   * Check if save data exists
   */
  async hasSaveData(): Promise<boolean> {
    // Check tutorial progress
    const tutorial = await this.getTutorialProgressAsync();
    if (tutorial.completed || tutorial.currentStep > 0) return true;

    // Check player stats
    const stats = await this.getPlayerStatsAsync();
    if (stats.kills > 0 || stats.distanceTraveled > 10) return true;

    // Check visited chunks
    const rows = await capacitorDb.query<CountRow>('SELECT count(*) FROM chunks WHERE visited = 1');
    if (rows.length > 0 && rows[0]['count(*)'] > 0) return true;

    return false;
  }

  // ============================================================================
  // CHUNK OPERATIONS
  // ============================================================================

  async saveChunk(chunk: ChunkData): Promise<void> {
    await capacitorDb.run(
      `INSERT OR REPLACE INTO chunks (chunk_x, chunk_z, seed, buildings, obstacles, enemies, visited, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        chunk.chunkX,
        chunk.chunkZ,
        chunk.seed,
        chunk.buildings,
        chunk.obstacles,
        chunk.enemies,
        chunk.visited ? 1 : 0,
        Date.now(),
      ]
    );
  }

  async getChunk(chunkX: number, chunkZ: number): Promise<ChunkData | null> {
    const rows = await capacitorDb.query<ChunkRow>(
      'SELECT * FROM chunks WHERE chunk_x = ? AND chunk_z = ?',
      [chunkX, chunkZ]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      chunkX: row.chunk_x,
      chunkZ: row.chunk_z,
      seed: row.seed,
      buildings: row.buildings,
      obstacles: row.obstacles,
      enemies: row.enemies,
      visited: row.visited === 1,
    };
  }

  // ============================================================================
  // ENTITY OPERATIONS
  // ============================================================================

  async saveEntity(entity: SavedEntity, chunkX: number, chunkZ: number): Promise<void> {
    await capacitorDb.run(
      `INSERT OR REPLACE INTO entities (id, type, x, y, z, health, data, chunk_x, chunk_z)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entity.id,
        entity.type,
        entity.x,
        entity.y,
        entity.z,
        entity.health,
        entity.data,
        chunkX,
        chunkZ,
      ]
    );
  }

  async getEntitiesInChunk(chunkX: number, chunkZ: number): Promise<SavedEntity[]> {
    const rows = await capacitorDb.query<EntityRow>(
      'SELECT id, type, x, y, z, health, data FROM entities WHERE chunk_x = ? AND chunk_z = ?',
      [chunkX, chunkZ]
    );

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      x: row.x,
      y: row.y,
      z: row.z,
      health: row.health,
      data: row.data,
    }));
  }

  async removeEntity(id: string): Promise<void> {
    await capacitorDb.run('DELETE FROM entities WHERE id = ?', [id]);
  }

  // ============================================================================
  // PLAYER STATS
  // ============================================================================

  async updatePlayerStats(stats: {
    kills?: number;
    distanceTraveled?: number;
    bossesDefeated?: number;
    mechsCalled?: number;
    lastX?: number;
    lastY?: number;
    lastZ?: number;
  }): Promise<void> {
    const updates: string[] = [];
    const values: (number | null)[] = [];

    if (stats.kills !== undefined) {
      updates.push('kills = kills + ?');
      values.push(stats.kills);
    }
    if (stats.distanceTraveled !== undefined) {
      updates.push('distance_traveled = distance_traveled + ?');
      values.push(stats.distanceTraveled);
    }
    if (stats.bossesDefeated !== undefined) {
      updates.push('bosses_defeated = bosses_defeated + ?');
      values.push(stats.bossesDefeated);
    }
    if (stats.mechsCalled !== undefined) {
      updates.push('mechs_called = mechs_called + ?');
      values.push(stats.mechsCalled);
    }
    if (stats.lastX !== undefined) {
      updates.push('last_x = ?');
      values.push(stats.lastX);
    }
    if (stats.lastY !== undefined) {
      updates.push('last_y = ?');
      values.push(stats.lastY);
    }
    if (stats.lastZ !== undefined) {
      updates.push('last_z = ?');
      values.push(stats.lastZ);
    }

    if (updates.length > 0) {
      await capacitorDb.run(`UPDATE player_stats SET ${updates.join(', ')} WHERE id = 1`, values);
    }
  }

  async getPlayerStatsAsync(): Promise<{
    kills: number;
    distanceTraveled: number;
    bossesDefeated: number;
    mechsCalled: number;
    lastX: number;
    lastY: number;
    lastZ: number;
  }> {
    const rows = await capacitorDb.query<PlayerStatsRow>('SELECT * FROM player_stats WHERE id = 1');

    if (rows.length === 0) {
      return {
        kills: 0,
        distanceTraveled: 0,
        bossesDefeated: 0,
        mechsCalled: 0,
        lastX: 0,
        lastY: 0,
        lastZ: 0,
      };
    }

    const row = rows[0];
    return {
      kills: row.kills,
      distanceTraveled: row.distance_traveled,
      bossesDefeated: row.bosses_defeated,
      mechsCalled: row.mechs_called,
      lastX: row.last_x,
      lastY: row.last_y,
      lastZ: row.last_z,
    };
  }

  // Sync version for backward compatibility (returns defaults, use async version)
  getPlayerStats(): {
    kills: number;
    distanceTraveled: number;
    bossesDefeated: number;
    mechsCalled: number;
    lastX: number;
    lastY: number;
    lastZ: number;
  } {
    log.warn('getPlayerStats is deprecated, use getPlayerStatsAsync');
    return {
      kills: 0,
      distanceTraveled: 0,
      bossesDefeated: 0,
      mechsCalled: 0,
      lastX: 0,
      lastY: 0,
      lastZ: 0,
    };
  }

  async clearChunksOutsideRadius(centerX: number, centerZ: number, radius: number): Promise<void> {
    const rows = await capacitorDb.query<{ chunk_x: number; chunk_z: number }>(
      `SELECT chunk_x, chunk_z FROM chunks
       WHERE (chunk_x - ?) * (chunk_x - ?) + (chunk_z - ?) * (chunk_z - ?) > ?`,
      [centerX, centerX, centerZ, centerZ, radius * radius]
    );

    for (const row of rows) {
      await capacitorDb.run('DELETE FROM entities WHERE chunk_x = ? AND chunk_z = ?', [
        row.chunk_x,
        row.chunk_z,
      ]);
    }
  }

  // ============================================================================
  // ALIEN KILL TRACKING
  // ============================================================================

  async recordAlienKill(speciesId: string, damageDealt: number): Promise<void> {
    const now = Date.now();

    const existing = await capacitorDb.query<{ total_killed: number }>(
      'SELECT total_killed FROM alien_kills WHERE species_id = ?',
      [speciesId]
    );

    if (existing.length === 0) {
      // First kill of this species
      await capacitorDb.run(
        `INSERT INTO alien_kills (species_id, total_killed, damage_dealt, first_kill_timestamp, last_kill_timestamp)
         VALUES (?, 1, ?, ?, ?)`,
        [speciesId, damageDealt, now, now]
      );
    } else {
      // Update existing
      await capacitorDb.run(
        `UPDATE alien_kills SET
         total_killed = total_killed + 1,
         damage_dealt = damage_dealt + ?,
         last_kill_timestamp = ?
         WHERE species_id = ?`,
        [damageDealt, now, speciesId]
      );
    }
  }

  async recordAlienDamage(speciesId: string, damageReceived: number): Promise<void> {
    // Ensure species entry exists
    await capacitorDb.run(
      `INSERT OR IGNORE INTO alien_kills (species_id, total_killed, damage_dealt, damage_received)
       VALUES (?, 0, 0, 0)`,
      [speciesId]
    );

    await capacitorDb.run(
      `UPDATE alien_kills SET damage_received = damage_received + ?
       WHERE species_id = ?`,
      [damageReceived, speciesId]
    );
  }

  async getAlienKillStats(): Promise<AlienKillStats[]> {
    const rows = await capacitorDb.query<AlienKillRow>('SELECT * FROM alien_kills');

    return rows.map((row) => ({
      speciesId: row.species_id,
      totalKilled: row.total_killed,
      damageDealt: row.damage_dealt,
      damageReceived: row.damage_received,
      firstKillTimestamp: row.first_kill_timestamp,
      lastKillTimestamp: row.last_kill_timestamp,
    }));
  }

  // ============================================================================
  // INVENTORY
  // ============================================================================

  async addToInventory(itemId: string, quantity: number): Promise<void> {
    const now = Date.now();
    const existing = await capacitorDb.query<{ quantity: number }>(
      'SELECT quantity FROM inventory WHERE item_id = ?',
      [itemId]
    );

    if (existing.length === 0) {
      await capacitorDb.run(
        `INSERT INTO inventory (item_id, quantity, acquired_timestamp) VALUES (?, ?, ?)`,
        [itemId, quantity, now]
      );
    } else {
      await capacitorDb.run(`UPDATE inventory SET quantity = quantity + ? WHERE item_id = ?`, [
        quantity,
        itemId,
      ]);
    }
  }

  async getInventory(): Promise<InventoryItem[]> {
    const rows = await capacitorDb.query<InventoryRow>(
      'SELECT * FROM inventory WHERE quantity > 0'
    );

    return rows.map((row) => ({
      itemId: row.item_id,
      quantity: row.quantity,
      acquiredTimestamp: row.acquired_timestamp,
    }));
  }

  // ============================================================================
  // QUEST MANAGEMENT
  // ============================================================================

  async startQuest(questId: string): Promise<void> {
    await capacitorDb.run(
      `INSERT OR REPLACE INTO quests (quest_id, step_index, completed, started_timestamp, data)
       VALUES (?, 0, 0, ?, '{}')`,
      [questId, Date.now()]
    );
  }

  async updateQuestStep(
    questId: string,
    stepIndex: number,
    data?: Record<string, unknown>
  ): Promise<void> {
    await capacitorDb.run(`UPDATE quests SET step_index = ?, data = ? WHERE quest_id = ?`, [
      stepIndex,
      JSON.stringify(data || {}),
      questId,
    ]);
  }

  async completeQuest(questId: string): Promise<void> {
    await capacitorDb.run(
      `UPDATE quests SET completed = 1, completed_timestamp = ? WHERE quest_id = ?`,
      [Date.now(), questId]
    );
  }

  async getQuestProgress(questId: string): Promise<QuestProgress | null> {
    const rows = await capacitorDb.query<QuestRow>('SELECT * FROM quests WHERE quest_id = ?', [
      questId,
    ]);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      questId: row.quest_id,
      stepIndex: row.step_index,
      completed: row.completed === 1,
      startedTimestamp: row.started_timestamp,
      completedTimestamp: row.completed_timestamp,
      data: row.data,
    };
  }

  async getAllQuests(): Promise<QuestProgress[]> {
    const rows = await capacitorDb.query<QuestRow>('SELECT * FROM quests');

    return rows.map((row) => ({
      questId: row.quest_id,
      stepIndex: row.step_index,
      completed: row.completed === 1,
      startedTimestamp: row.started_timestamp,
      completedTimestamp: row.completed_timestamp,
      data: row.data,
    }));
  }

  // ============================================================================
  // TUTORIAL PROGRESS
  // ============================================================================

  async getTutorialProgressAsync(): Promise<{
    completed: boolean;
    currentStep: number;
    stepsCompleted: string[];
  }> {
    const rows = await capacitorDb.query<TutorialRow>(
      'SELECT * FROM tutorial_progress WHERE id = 1'
    );

    if (rows.length === 0) {
      return { completed: false, currentStep: 0, stepsCompleted: [] };
    }

    const row = rows[0];
    return {
      completed: row.tutorial_completed === 1,
      currentStep: row.current_step,
      stepsCompleted: JSON.parse(row.steps_completed),
    };
  }

  // Sync version for backward compatibility
  getTutorialProgress(): { completed: boolean; currentStep: number; stepsCompleted: string[] } {
    log.warn('getTutorialProgress is deprecated, use getTutorialProgressAsync');
    return { completed: false, currentStep: 0, stepsCompleted: [] };
  }

  async updateTutorialProgress(currentStep: number, stepsCompleted: string[]): Promise<void> {
    await capacitorDb.run(
      `UPDATE tutorial_progress SET current_step = ?, steps_completed = ? WHERE id = 1`,
      [currentStep, JSON.stringify(stepsCompleted)]
    );
  }

  async completeTutorial(): Promise<void> {
    await capacitorDb.run(`UPDATE tutorial_progress SET tutorial_completed = 1 WHERE id = 1`);
  }

  async isTutorialCompleted(): Promise<boolean> {
    const rows = await capacitorDb.query<{ tutorial_completed: number }>(
      'SELECT tutorial_completed FROM tutorial_progress WHERE id = 1'
    );

    if (rows.length === 0) return false;
    return rows[0].tutorial_completed === 1;
  }

  // ============================================================================
  // CHUNK DATA PERSISTENCE (for ChunkManager procedural generation)
  // ============================================================================

  async getChunkData(key: string): Promise<string | null> {
    const rows = await capacitorDb.query<ChunkDataRow>(
      'SELECT data FROM chunk_data WHERE key = ?',
      [key]
    );

    if (rows.length === 0) return null;
    return rows[0].data;
  }

  async setChunkData(key: string, data: string): Promise<void> {
    await capacitorDb.run(
      `INSERT OR REPLACE INTO chunk_data (key, data, updated_at) VALUES (?, ?, ?)`,
      [key, data, Date.now()]
    );
  }

  async deleteChunkData(key: string): Promise<void> {
    await capacitorDb.run('DELETE FROM chunk_data WHERE key = ?', [key]);
  }

  async getChunkKeysByEnvironment(environment: string): Promise<string[]> {
    const rows = await capacitorDb.query<{ key: string }>(
      'SELECT key FROM chunk_data WHERE key LIKE ?',
      [`chunk_${environment}_%`]
    );

    return rows.map((row) => row.key);
  }

  async clearEnvironmentChunks(environment: string): Promise<void> {
    await capacitorDb.run('DELETE FROM chunk_data WHERE key LIKE ?', [`chunk_${environment}_%`]);
  }

  async getChunkStats(): Promise<{ totalChunks: number; byEnvironment: Record<string, number> }> {
    const totalRows = await capacitorDb.query<CountRow>('SELECT COUNT(*) FROM chunk_data');
    const total = totalRows.length > 0 ? totalRows[0]['count(*)'] : 0;

    const byEnvironment: Record<string, number> = {};
    const envRows = await capacitorDb.query<{ env: string; count: number }>(`
      SELECT
        SUBSTR(key, 7, INSTR(SUBSTR(key, 7), '_') - 1) as env,
        COUNT(*) as count
      FROM chunk_data
      GROUP BY env
    `);

    for (const row of envRows) {
      if (row.env) {
        byEnvironment[row.env] = row.count;
      }
    }

    return { totalChunks: total, byEnvironment };
  }

  // ============================================================================
  // LEVEL COMPLETION TRACKING
  // ============================================================================

  async completeLevel(
    levelId: string,
    stats?: { timeSeconds?: number; kills?: number }
  ): Promise<void> {
    const now = Date.now();

    const existing = await capacitorDb.query<{ best_time_seconds: number | null }>(
      'SELECT best_time_seconds FROM level_completion WHERE level_id = ?',
      [levelId]
    );

    if (existing.length === 0) {
      // First completion
      await capacitorDb.run(
        `INSERT INTO level_completion (level_id, completed, completed_at, best_time_seconds, total_kills)
         VALUES (?, 1, ?, ?, ?)`,
        [levelId, now, stats?.timeSeconds ?? null, stats?.kills ?? 0]
      );
    } else {
      // Update existing - keep best time
      const currentBestTime = existing[0].best_time_seconds;
      const newTime = stats?.timeSeconds ?? null;
      const bestTime =
        newTime !== null && (currentBestTime === null || newTime < currentBestTime)
          ? newTime
          : currentBestTime;

      await capacitorDb.run(
        `UPDATE level_completion SET
         completed = 1,
         completed_at = ?,
         best_time_seconds = ?,
         total_kills = total_kills + ?
         WHERE level_id = ?`,
        [now, bestTime, stats?.kills ?? 0, levelId]
      );
    }
  }

  async isLevelCompleted(levelId: string): Promise<boolean> {
    const rows = await capacitorDb.query<{ completed: number }>(
      'SELECT completed FROM level_completion WHERE level_id = ?',
      [levelId]
    );

    if (rows.length === 0) return false;
    return rows[0].completed === 1;
  }

  async getCompletedLevels(): Promise<string[]> {
    const rows = await capacitorDb.query<{ level_id: string }>(
      'SELECT level_id FROM level_completion WHERE completed = 1'
    );

    return rows.map((row) => row.level_id);
  }

  async getLevelStats(levelId: string): Promise<{
    completed: boolean;
    completedAt: number | null;
    bestTimeSeconds: number | null;
    totalKills: number;
  } | null> {
    const rows = await capacitorDb.query<LevelCompletionRow>(
      'SELECT completed, completed_at, best_time_seconds, total_kills FROM level_completion WHERE level_id = ?',
      [levelId]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      completed: row.completed === 1,
      completedAt: row.completed_at,
      bestTimeSeconds: row.best_time_seconds,
      totalKills: row.total_kills,
    };
  }

  async getAllLevelStats(): Promise<
    Map<
      string,
      {
        completed: boolean;
        completedAt: number | null;
        bestTimeSeconds: number | null;
        totalKills: number;
      }
    >
  > {
    const stats = new Map<
      string,
      {
        completed: boolean;
        completedAt: number | null;
        bestTimeSeconds: number | null;
        totalKills: number;
      }
    >();

    const rows = await capacitorDb.query<LevelCompletionRow>(
      'SELECT level_id, completed, completed_at, best_time_seconds, total_kills FROM level_completion'
    );

    for (const row of rows) {
      stats.set(row.level_id, {
        completed: row.completed === 1,
        completedAt: row.completed_at,
        bestTimeSeconds: row.best_time_seconds,
        totalKills: row.total_kills,
      });
    }

    return stats;
  }
}

export const worldDb = new WorldDatabase();
