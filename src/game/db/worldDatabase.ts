import initSqlJs, { type Database } from 'sql.js';

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

class WorldDatabase {
  private db: Database | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    const SQL = await initSqlJs({
      locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
    });

    this.db = new SQL.Database();

    // Create tables
    this.db.run(`
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
      )
    `);

    this.db.run(`
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
      )
    `);

    // Add index for faster chunk queries
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_entities_chunk ON entities(chunk_x, chunk_z)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS player_stats (
        id INTEGER PRIMARY KEY DEFAULT 1,
        kills INTEGER DEFAULT 0,
        distance_traveled REAL DEFAULT 0,
        bosses_defeated INTEGER DEFAULT 0,
        mechs_called INTEGER DEFAULT 0,
        last_x REAL DEFAULT 0,
        last_y REAL DEFAULT 0,
        last_z REAL DEFAULT 0
      )
    `);

    // Initialize player stats if not exists
    this.db.run(`INSERT OR IGNORE INTO player_stats (id) VALUES (1)`);

    // Alien kill stats table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS alien_kills (
        species_id TEXT PRIMARY KEY,
        total_killed INTEGER DEFAULT 0,
        damage_dealt REAL DEFAULT 0,
        damage_received REAL DEFAULT 0,
        first_kill_timestamp INTEGER,
        last_kill_timestamp INTEGER
      )
    `);

    // Inventory table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        item_id TEXT PRIMARY KEY,
        quantity INTEGER DEFAULT 0,
        acquired_timestamp INTEGER
      )
    `);

    // Quest progress table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS quests (
        quest_id TEXT PRIMARY KEY,
        step_index INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        started_timestamp INTEGER,
        completed_timestamp INTEGER,
        data TEXT DEFAULT '{}'
      )
    `);

    // Tutorial completion tracking
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tutorial_progress (
        id INTEGER PRIMARY KEY DEFAULT 1,
        tutorial_completed INTEGER DEFAULT 0,
        current_step INTEGER DEFAULT 0,
        steps_completed TEXT DEFAULT '[]'
      )
    `);
    this.db.run(`INSERT OR IGNORE INTO tutorial_progress (id) VALUES (1)`);

    // Chunk state storage for procedural generation persistence
    // Uses string keys like "chunk_station_interior_0_0" to store full ChunkState JSON
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chunk_data (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER
      )
    `);

    this.initialized = true;
  }

  exportDatabase(): Uint8Array | null {
    if (!this.db) return null;
    return this.db.export();
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    if (this.db) {
      this.db.close();
    }
    const SQL = await initSqlJs({
      locateFile: (file: string) => `${import.meta.env.BASE_URL}${file}`,
    });
    this.db = new SQL.Database(data);
    this.initialized = true;
  }

  async resetDatabase(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
    this.initialized = false;
    await this.init();
  }

  hasSaveData(): boolean {
    if (!this.db) return false;
    try {
      // Check if player_stats table has entries other than default or if there are saved entities/chunks
      // A simple check is if we have any stats progress or if tutorial is completed
      const tutorial = this.getTutorialProgress();
      if (tutorial.completed || tutorial.currentStep > 0) return true;

      const stats = this.getPlayerStats();
      if (stats.kills > 0 || stats.distanceTraveled > 10) return true;

      // Also check if we have any chunks visited
      const visitedChunks = this.db.exec('SELECT count(*) FROM chunks WHERE visited = 1');
      if (visitedChunks.length > 0 && (visitedChunks[0].values[0][0] as number) > 0) return true;

      return false;
    } catch (_e) {
      return false;
    }
  }

  saveChunk(chunk: ChunkData): void {
    if (!this.db) return;

    this.db.run(
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

  getChunk(chunkX: number, chunkZ: number): ChunkData | null {
    if (!this.db) return null;

    const result = this.db.exec(
      'SELECT * FROM chunks WHERE chunk_x = ? AND chunk_z = ?',
      [chunkX, chunkZ]
    );

    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      chunkX: row[0] as number,
      chunkZ: row[1] as number,
      seed: row[2] as number,
      buildings: row[3] as string,
      obstacles: row[4] as string,
      enemies: row[5] as string,
      visited: row[6] === 1,
    };
  }

  saveEntity(entity: SavedEntity, chunkX: number, chunkZ: number): void {
    if (!this.db) return;

    this.db.run(
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

  getEntitiesInChunk(chunkX: number, chunkZ: number): SavedEntity[] {
    if (!this.db) return [];

    const result = this.db.exec(
      'SELECT id, type, x, y, z, health, data FROM entities WHERE chunk_x = ? AND chunk_z = ?',
      [chunkX, chunkZ]
    );

    if (result.length === 0) return [];

    return result[0].values.map((row) => ({
      id: row[0] as string,
      type: row[1] as string,
      x: row[2] as number,
      y: row[3] as number,
      z: row[4] as number,
      health: row[5] as number,
      data: row[6] as string,
    }));
  }

  removeEntity(id: string): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM entities WHERE id = ?`, [id]);
  }

  updatePlayerStats(stats: {
    kills?: number;
    distanceTraveled?: number;
    bossesDefeated?: number;
    mechsCalled?: number;
    lastX?: number;
    lastY?: number;
    lastZ?: number;
  }): void {
    if (!this.db) return;

    const updates: string[] = [];
    const values: number[] = [];

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
      this.db.run(`UPDATE player_stats SET ${updates.join(', ')} WHERE id = 1`, values);
    }
  }

  getPlayerStats(): {
    kills: number;
    distanceTraveled: number;
    bossesDefeated: number;
    mechsCalled: number;
    lastX: number;
    lastY: number;
    lastZ: number;
  } {
    if (!this.db) {
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

    const result = this.db.exec(`SELECT * FROM player_stats WHERE id = 1`);
    if (result.length === 0 || result[0].values.length === 0) {
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

    const row = result[0].values[0];
    return {
      kills: row[1] as number,
      distanceTraveled: row[2] as number,
      bossesDefeated: row[3] as number,
      mechsCalled: row[4] as number,
      lastX: row[5] as number,
      lastY: row[6] as number,
      lastZ: row[7] as number,
    };
  }

  clearChunksOutsideRadius(centerX: number, centerZ: number, radius: number): void {
    if (!this.db) return;

    // Get chunks outside radius
    const result = this.db.exec(`
      SELECT chunk_x, chunk_z FROM chunks
      WHERE (chunk_x - ?) * (chunk_x - ?) +
            (chunk_z - ?) * (chunk_z - ?) > ?
    `, [centerX, centerX, centerZ, centerZ, radius * radius]);

    if (result.length === 0) return;

    // Mark them for potential cleanup (we keep the seed for regeneration consistency)
    for (const row of result[0].values) {
      const cx = row[0] as number;
      const cz = row[1] as number;
      this.db.run(`DELETE FROM entities WHERE chunk_x = ? AND chunk_z = ?`, [cx, cz]);
    }
  }

  // Record an alien kill
  recordAlienKill(speciesId: string, damageDealt: number): void {
    if (!this.db) return;

    const now = Date.now();

    // Check if species exists
    const existing = this.db.exec(
      'SELECT total_killed FROM alien_kills WHERE species_id = ?',
      [speciesId]
    );

    if (existing.length === 0 || existing[0].values.length === 0) {
      // First kill of this species
      this.db.run(
        `INSERT INTO alien_kills (species_id, total_killed, damage_dealt, first_kill_timestamp, last_kill_timestamp)
         VALUES (?, 1, ?, ?, ?)`,
        [speciesId, damageDealt, now, now]
      );
    } else {
      // Update existing
      this.db.run(
        `UPDATE alien_kills SET
         total_killed = total_killed + 1,
         damage_dealt = damage_dealt + ?,
         last_kill_timestamp = ?
         WHERE species_id = ?`,
        [damageDealt, now, speciesId]
      );
    }
  }

  // Record damage received from alien
  recordAlienDamage(speciesId: string, damageReceived: number): void {
    if (!this.db) return;

    // Ensure species entry exists
    this.db.run(
      `INSERT OR IGNORE INTO alien_kills (species_id, total_killed, damage_dealt, damage_received)
       VALUES (?, 0, 0, 0)`,
      [speciesId]
    );

    this.db.run(
      `UPDATE alien_kills SET damage_received = damage_received + ?
       WHERE species_id = ?`,
      [damageReceived, speciesId]
    );
  }

  // Get all alien kill stats
  getAlienKillStats(): AlienKillStats[] {
    if (!this.db) return [];

    const result = this.db.exec(`SELECT * FROM alien_kills`);
    if (result.length === 0) return [];

    return result[0].values.map((row) => ({
      speciesId: row[0] as string,
      totalKilled: row[1] as number,
      damageDealt: row[2] as number,
      damageReceived: row[3] as number,
      firstKillTimestamp: row[4] as number,
      lastKillTimestamp: row[5] as number,
    }));
  }

  // Add item to inventory
  addToInventory(itemId: string, quantity: number): void {
    if (!this.db) return;

    const now = Date.now();
    const existing = this.db.exec('SELECT quantity FROM inventory WHERE item_id = ?', [itemId]);

    if (existing.length === 0 || existing[0].values.length === 0) {
      this.db.run(
        `INSERT INTO inventory (item_id, quantity, acquired_timestamp) VALUES (?, ?, ?)`,
        [itemId, quantity, now]
      );
    } else {
      this.db.run(`UPDATE inventory SET quantity = quantity + ? WHERE item_id = ?`, [
        quantity,
        itemId,
      ]);
    }
  }

  // Get inventory
  getInventory(): InventoryItem[] {
    if (!this.db) return [];

    const result = this.db.exec(`SELECT * FROM inventory WHERE quantity > 0`);
    if (result.length === 0) return [];

    return result[0].values.map((row) => ({
      itemId: row[0] as string,
      quantity: row[1] as number,
      acquiredTimestamp: row[2] as number,
    }));
  }

  // Quest management
  startQuest(questId: string): void {
    if (!this.db) return;

    this.db.run(
      `INSERT OR REPLACE INTO quests (quest_id, step_index, completed, started_timestamp, data)
       VALUES (?, 0, 0, ?, '{}')`,
      [questId, Date.now()]
    );
  }

  updateQuestStep(questId: string, stepIndex: number, data?: Record<string, unknown>): void {
    if (!this.db) return;

    this.db.run(`UPDATE quests SET step_index = ?, data = ? WHERE quest_id = ?`, [
      stepIndex,
      JSON.stringify(data || {}),
      questId,
    ]);
  }

  completeQuest(questId: string): void {
    if (!this.db) return;

    this.db.run(`UPDATE quests SET completed = 1, completed_timestamp = ? WHERE quest_id = ?`, [
      Date.now(),
      questId,
    ]);
  }

  getQuestProgress(questId: string): QuestProgress | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT * FROM quests WHERE quest_id = ?', [questId]);

    if (result.length === 0 || result[0].values.length === 0) return null;

    const row = result[0].values[0];
    return {
      questId: row[0] as string,
      stepIndex: row[1] as number,
      completed: row[2] === 1,
      startedTimestamp: row[3] as number,
      completedTimestamp: row[4] as number | null,
      data: row[5] as string,
    };
  }

  getAllQuests(): QuestProgress[] {
    if (!this.db) return [];

    const result = this.db.exec(`SELECT * FROM quests`);
    if (result.length === 0) return [];

    return result[0].values.map((row) => ({
      questId: row[0] as string,
      stepIndex: row[1] as number,
      completed: row[2] === 1,
      startedTimestamp: row[3] as number,
      completedTimestamp: row[4] as number | null,
      data: row[5] as string,
    }));
  }

  // Tutorial progress
  getTutorialProgress(): { completed: boolean; currentStep: number; stepsCompleted: string[] } {
    if (!this.db) return { completed: false, currentStep: 0, stepsCompleted: [] };

    const result = this.db.exec(`SELECT * FROM tutorial_progress WHERE id = 1`);
    if (result.length === 0 || result[0].values.length === 0) {
      return { completed: false, currentStep: 0, stepsCompleted: [] };
    }

    const row = result[0].values[0];
    return {
      completed: row[1] === 1,
      currentStep: row[2] as number,
      stepsCompleted: JSON.parse(row[3] as string),
    };
  }

  updateTutorialProgress(currentStep: number, stepsCompleted: string[]): void {
    if (!this.db) return;

    this.db.run(`UPDATE tutorial_progress SET current_step = ?, steps_completed = ? WHERE id = 1`, [
      currentStep,
      JSON.stringify(stepsCompleted),
    ]);
  }

  completeTutorial(): void {
    if (!this.db) return;

    this.db.run(`UPDATE tutorial_progress SET tutorial_completed = 1 WHERE id = 1`);
  }

  isTutorialCompleted(): boolean {
    if (!this.db) return false;

    const result = this.db.exec(`SELECT tutorial_completed FROM tutorial_progress WHERE id = 1`);

    if (result.length === 0 || result[0].values.length === 0) return false;
    return result[0].values[0][0] === 1;
  }

  // ============================================================================
  // CHUNK DATA PERSISTENCE (for ChunkManager procedural generation)
  // ============================================================================

  /**
   * Get chunk state data by key
   * @param key Format: "chunk_{environment}_{x}_{z}" e.g., "chunk_station_interior_0_1"
   * @returns JSON string of ChunkState or null if not found
   */
  getChunkData(key: string): string | null {
    if (!this.db) return null;

    const result = this.db.exec('SELECT data FROM chunk_data WHERE key = ?', [key]);

    if (result.length === 0 || result[0].values.length === 0) return null;

    return result[0].values[0][0] as string;
  }

  /**
   * Save chunk state data by key
   * @param key Format: "chunk_{environment}_{x}_{z}"
   * @param data JSON-serialized ChunkState
   */
  setChunkData(key: string, data: string): void {
    if (!this.db) return;

    this.db.run(
      `INSERT OR REPLACE INTO chunk_data (key, data, updated_at) VALUES (?, ?, ?)`,
      [key, data, Date.now()]
    );
  }

  /**
   * Delete chunk data by key
   */
  deleteChunkData(key: string): void {
    if (!this.db) return;

    this.db.run(`DELETE FROM chunk_data WHERE key = ?`, [key]);
  }

  /**
   * Get all chunk keys for a specific environment
   */
  getChunkKeysByEnvironment(environment: string): string[] {
    if (!this.db) return [];

    const result = this.db.exec(
      `SELECT key FROM chunk_data WHERE key LIKE ?`,
      [`chunk_${environment}_%`]
    );

    if (result.length === 0) return [];

    return result[0].values.map((row) => row[0] as string);
  }

  /**
   * Clear all chunk data for an environment (useful for regeneration)
   */
  clearEnvironmentChunks(environment: string): void {
    if (!this.db) return;

    this.db.run(`DELETE FROM chunk_data WHERE key LIKE ?`, [`chunk_${environment}_%`]);
  }

  /**
   * Get chunk data statistics
   */
  getChunkStats(): { totalChunks: number; byEnvironment: Record<string, number> } {
    if (!this.db) return { totalChunks: 0, byEnvironment: {} };

    const totalResult = this.db.exec('SELECT COUNT(*) FROM chunk_data');
    const total = totalResult.length > 0 ? (totalResult[0].values[0][0] as number) : 0;

    // Get counts by environment prefix
    const byEnvironment: Record<string, number> = {};
    const envResult = this.db.exec(`
      SELECT
        SUBSTR(key, 7, INSTR(SUBSTR(key, 7), '_') - 1) as env,
        COUNT(*) as count
      FROM chunk_data
      GROUP BY env
    `);

    if (envResult.length > 0) {
      for (const row of envResult[0].values) {
        const env = row[0] as string;
        const count = row[1] as number;
        if (env) {
          byEnvironment[env] = count;
        }
      }
    }

    return { totalChunks: total, byEnvironment };
  }
}

export const worldDb = new WorldDatabase();
