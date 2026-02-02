/**
 * Database - Unified SQLite interface for all platforms
 *
 * Uses the appropriate implementation based on platform:
 * - Web: sql.js (WebSQLiteDatabase) - pure JS SQLite in browser
 * - Native (iOS/Android/Electron): @capacitor-community/sqlite
 *
 * All consumers should import from this file, not directly from implementations.
 */

import { Capacitor } from '@capacitor/core';
import { getLogger } from '../core/Logger';

const log = getLogger('Database');

/**
 * Result type for run/execute operations
 */
export interface RunResult {
  changes: number;
  lastId: number;
}

/**
 * Common database interface
 */
export interface IDatabase {
  init(): Promise<void>;
  isOpen(): Promise<boolean>;
  run(sql: string, params?: (string | number | null)[]): Promise<RunResult>;
  execute(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: (string | number | null)[]
  ): Promise<T[]>;
  tableExists(tableName: string): Promise<boolean>;
  persist(): Promise<void>;
  close(): Promise<void>;
  deleteDatabase(): Promise<void>;
  exportDatabase(): Promise<Uint8Array | null>;
  importDatabase(data: Uint8Array): Promise<void>;
}

/**
 * Platform detection
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Singleton database instance
 */
let dbInstance: IDatabase | null = null;
let initPromise: Promise<IDatabase> | null = null;

/**
 * Get the database instance, initializing if needed
 */
export async function getDatabase(): Promise<IDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = initDatabase();
  return initPromise;
}

/**
 * Initialize the appropriate database implementation
 */
async function initDatabase(): Promise<IDatabase> {
  const isNative = isNativePlatform();
  log.info(`Initializing database for platform: ${isNative ? 'native' : 'web'}`);

  if (isNative) {
    // Use Capacitor SQLite for native platforms
    const { CapacitorDatabase } = await import('./CapacitorDatabase');
    const db = new CapacitorDatabase();
    await db.init();
    dbInstance = db;
    log.info('Native database initialized');
  } else {
    // Use sql.js for web
    const { WebSQLiteDatabase } = await import('./WebSQLiteDatabase');
    const db = new WebSQLiteDatabase();
    await db.init();
    dbInstance = db;
    log.info('Web database initialized');
  }

  return dbInstance;
}

/**
 * Dispose the database singleton
 */
export async function disposeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    initPromise = null;
  }
}

/**
 * Legacy export for backward compatibility
 * This creates a proxy that auto-initializes
 */
class DatabaseProxy implements IDatabase {
  private getDb(): Promise<IDatabase> {
    return getDatabase();
  }

  async init(): Promise<void> {
    await this.getDb();
  }

  async isOpen(): Promise<boolean> {
    const db = await this.getDb();
    return db.isOpen();
  }

  async run(sql: string, params: (string | number | null)[] = []): Promise<RunResult> {
    const db = await this.getDb();
    return db.run(sql, params);
  }

  async execute(sql: string): Promise<void> {
    const db = await this.getDb();
    return db.execute(sql);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: (string | number | null)[] = []
  ): Promise<T[]> {
    const db = await this.getDb();
    return db.query<T>(sql, params);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const db = await this.getDb();
    return db.tableExists(tableName);
  }

  async persist(): Promise<void> {
    const db = await this.getDb();
    return db.persist();
  }

  async close(): Promise<void> {
    const db = await this.getDb();
    await db.close();
    // Clear singleton so next getDatabase() creates a fresh instance
    dbInstance = null;
    initPromise = null;
  }

  async deleteDatabase(): Promise<void> {
    const db = await this.getDb();
    await db.deleteDatabase();
    // Clear singleton so next getDatabase() creates a fresh instance
    dbInstance = null;
    initPromise = null;
  }

  async exportDatabase(): Promise<Uint8Array | null> {
    const db = await this.getDb();
    return db.exportDatabase();
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    const db = await this.getDb();
    return db.importDatabase(data);
  }
}

/**
 * Default database export - auto-initializes on first use
 * Use this for backward compatibility with existing code that uses capacitorDb
 */
export const capacitorDb = new DatabaseProxy();
