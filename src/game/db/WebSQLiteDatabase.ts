/**
 * WebSQLiteDatabase - SQLite implementation for web using sql.js directly
 *
 * This provides a clean SQLite interface for web browsers without the
 * complexity of jeep-sqlite. For native platforms (iOS/Android/Electron),
 * use CapacitorDatabase which wraps @capacitor-community/sqlite.
 */

import { getLogger } from '../core/Logger';

// sql.js types
interface SqlJsDatabase {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
  prepare(sql: string): SqlJsStatement;
  getRowsModified(): number;
  export(): Uint8Array;
  close(): void;
}

interface SqlJsStatement {
  bind(params?: unknown[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): boolean;
}

interface SqlJsStatic {
  Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

const log = getLogger('WebSQLiteDatabase');

const DATABASE_NAME = 'stellar_descent';
const STORAGE_KEY = `sqlite_${DATABASE_NAME}`;

/**
 * Result type for query operations
 */
export interface QueryResult {
  values: Record<string, unknown>[];
}

/**
 * Result type for run/execute operations
 */
export interface RunResult {
  changes: number;
  lastId: number;
}

/**
 * WebSQLiteDatabase - Uses sql.js for in-browser SQLite
 *
 * Data is persisted to IndexedDB for durability across sessions.
 */
export class WebSQLiteDatabase {
  private SQL: SqlJsStatic | null = null;
  private db: SqlJsDatabase | null = null;
  private initialized = false;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   * Safe to call multiple times - only initializes once
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    if (WebSQLiteDatabase.initPromise) {
      return WebSQLiteDatabase.initPromise;
    }

    WebSQLiteDatabase.initPromise = this.doInit();

    try {
      await WebSQLiteDatabase.initPromise;
    } catch (error) {
      WebSQLiteDatabase.initPromise = null;
      throw error;
    }
  }

  private async doInit(): Promise<void> {
    log.info('Initializing sql.js...');

    // Dynamically import sql.js (UMD module)
    const sqlJsModule = await import('sql.js');
    const initSqlJs = (sqlJsModule.default || sqlJsModule) as InitSqlJs;

    // Initialize sql.js with WASM from public/assets
    this.SQL = await initSqlJs({
      locateFile: (file: string) => `/assets/${file}`,
    });

    log.info('sql.js initialized, loading database...');

    // Try to load existing database from IndexedDB
    const savedData = await this.loadFromStorage();

    if (savedData) {
      log.info('Restoring database from IndexedDB');
      this.db = new this.SQL.Database(savedData);
    } else {
      log.info('Creating new database');
      this.db = new this.SQL.Database();
    }

    this.initialized = true;
    log.info('Database initialized successfully');
  }

  /**
   * Check if database is open
   */
  async isOpen(): Promise<boolean> {
    return this.db !== null && this.initialized;
  }

  /**
   * Execute SQL statements (for CREATE, INSERT, UPDATE, DELETE)
   */
  async run(sql: string, params: (string | number | null)[] = []): Promise<RunResult> {
    if (!this.db) {
      throw new Error('[WebSQLiteDatabase] Database not initialized');
    }

    try {
      this.db.run(sql, params);
      const changes = this.db.getRowsModified();
      // sql.js doesn't provide lastInsertRowid directly in run(), query it
      const lastIdResult = this.db.exec('SELECT last_insert_rowid() as id');
      const lastId = lastIdResult.length > 0 && lastIdResult[0].values.length > 0
        ? (lastIdResult[0].values[0][0] as number)
        : 0;

      return { changes, lastId };
    } catch (error) {
      log.error('Run error:', sql, error);
      throw error;
    }
  }

  /**
   * Execute multiple SQL statements (for batch operations)
   */
  async execute(sql: string): Promise<void> {
    if (!this.db) {
      throw new Error('[WebSQLiteDatabase] Database not initialized');
    }

    try {
      this.db.exec(sql);
    } catch (error) {
      log.error('Execute error:', sql, error);
      throw error;
    }
  }

  /**
   * Query the database and return results
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params: (string | number | null)[] = []
  ): Promise<T[]> {
    if (!this.db) {
      throw new Error('[WebSQLiteDatabase] Database not initialized');
    }

    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);

      const results: T[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as T;
        results.push(row);
      }
      stmt.free();

      return results;
    } catch (error) {
      log.error('Query error:', sql, error);
      throw error;
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    if (!this.db) return false;

    const result = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return result.length > 0;
  }

  /**
   * Save database to IndexedDB for persistence
   */
  async persist(): Promise<void> {
    if (!this.db) return;

    const data = this.db.export();
    await this.saveToStorage(data);
    log.info('Database saved to IndexedDB');
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      // Save before closing
      await this.persist();
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Delete the database entirely
   */
  async deleteDatabase(): Promise<void> {
    await this.close();
    await this.removeFromStorage();
    log.info('Database deleted');
  }

  /**
   * Export database as Uint8Array
   */
  async exportDatabase(): Promise<Uint8Array | null> {
    if (!this.db) return null;
    return this.db.export();
  }

  /**
   * Import database from Uint8Array
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    if (!this.SQL) {
      throw new Error('[WebSQLiteDatabase] sql.js not initialized');
    }

    await this.close();
    this.db = new this.SQL.Database(data);
    this.initialized = true;
    await this.persist();
  }

  // IndexedDB helpers for persistence

  private async loadFromStorage(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('stellar_descent_db', 1);

      request.onerror = () => {
        log.warn('IndexedDB error, starting fresh');
        resolve(null);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('databases')) {
          db.createObjectStore('databases');
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['databases'], 'readonly');
        const store = transaction.objectStore('databases');
        const getRequest = store.get(STORAGE_KEY);

        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };

        getRequest.onerror = () => {
          resolve(null);
        };
      };
    });
  }

  private async saveToStorage(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('stellar_descent_db', 1);

      request.onerror = () => reject(new Error('IndexedDB error'));

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('databases')) {
          db.createObjectStore('databases');
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['databases'], 'readwrite');
        const store = transaction.objectStore('databases');
        store.put(data, STORAGE_KEY);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('IndexedDB write error'));
      };
    });
  }

  private async removeFromStorage(): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open('stellar_descent_db', 1);

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['databases'], 'readwrite');
        const store = transaction.objectStore('databases');
        store.delete(STORAGE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve(); // Resolve anyway
      };

      request.onerror = () => resolve();
    });
  }
}

// Singleton instance
export const webSqliteDb = new WebSQLiteDatabase();
