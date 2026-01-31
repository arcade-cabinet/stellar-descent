/**
 * CapacitorDatabase - Cross-platform SQLite abstraction using @capacitor-community/sqlite
 *
 * This module provides a unified SQLite interface that works on:
 * - iOS/Android: Native SQLite via Capacitor plugin
 * - Web: IndexedDB-backed SQLite via jeep-sqlite web component
 *
 * Key features:
 * - Single API for all platforms
 * - Automatic platform detection
 * - Handles web component initialization
 * - Encryption support on native platforms
 */

import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';

const DATABASE_NAME = 'stellar_descent';
const DATABASE_VERSION = 1;

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
 * Platform detection helper
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * CapacitorDatabase class - wraps @capacitor-community/sqlite
 */
export class CapacitorDatabase {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private initialized = false;
  private isWeb = false;

  /**
   * Singleton initialization promise to prevent race conditions.
   * Multiple React components may call init() simultaneously on mount,
   * but initWebStore() must only be called once or it will error.
   */
  private static initPromise: Promise<void> | null = null;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    this.isWeb = !isNativePlatform();
  }

  /**
   * Initialize the database connection
   * Must be called before any database operations.
   *
   * This method is safe to call multiple times concurrently - only the first
   * call will perform initialization, subsequent calls will wait for it to complete.
   */
  async init(): Promise<void> {
    // Fast path: already initialized
    if (this.initialized) return;

    // If initialization is already in progress, wait for it
    if (CapacitorDatabase.initPromise) {
      return CapacitorDatabase.initPromise;
    }

    // Start initialization and store the promise so concurrent callers can await it
    CapacitorDatabase.initPromise = this.doInit();

    try {
      await CapacitorDatabase.initPromise;
    } catch (error) {
      // Reset the promise so initialization can be retried
      CapacitorDatabase.initPromise = null;
      throw error;
    }
  }

  /**
   * Perform the actual initialization (internal method)
   */
  private async doInit(): Promise<void> {
    try {
      // For web platform, initialize the web store first
      if (this.isWeb) {
        await this.initWebPlatform();
      }

      // Check if connection already exists
      const isConnExists = await this.sqlite.isConnection(DATABASE_NAME, false);

      if (isConnExists.result) {
        this.db = await this.sqlite.retrieveConnection(DATABASE_NAME, false);
      } else {
        // Create new connection
        this.db = await this.sqlite.createConnection(
          DATABASE_NAME,
          false, // encrypted
          'no-encryption', // encryption mode
          DATABASE_VERSION,
          false // readonly
        );
      }

      // Open the database
      await this.db.open();

      this.initialized = true;
      console.log('[CapacitorDatabase] Database initialized successfully');
    } catch (error) {
      console.error('[CapacitorDatabase] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Initialize web platform specific components
   */
  private async initWebPlatform(): Promise<void> {
    // Ensure jeep-sqlite element exists
    let jeepSqliteEl = document.querySelector('jeep-sqlite');

    if (!jeepSqliteEl) {
      // Create and append the jeep-sqlite element
      const element = document.createElement('jeep-sqlite');
      document.body.appendChild(element);
      jeepSqliteEl = element;
    }

    // Wait for the custom element to be defined
    await customElements.whenDefined('jeep-sqlite');

    // Always initialize the web store on web platform
    await this.sqlite.initWebStore();

    console.log('[CapacitorDatabase] Web store initialized');
  }

  /**
   * Check if the database is open
   */
  async isOpen(): Promise<boolean> {
    if (!this.db) return false;
    const result = await this.db.isDBOpen();
    return result.result ?? false;
  }

  /**
   * Execute SQL statements (for CREATE, INSERT, UPDATE, DELETE)
   * Returns the number of changes and last insert ID
   */
  async run(sql: string, params: (string | number | null)[] = []): Promise<RunResult> {
    if (!this.db) {
      throw new Error('[CapacitorDatabase] Database not initialized');
    }

    try {
      const result = await this.db.run(sql, params);
      return {
        changes: result.changes?.changes ?? 0,
        lastId: result.changes?.lastId ?? 0,
      };
    } catch (error) {
      console.error('[CapacitorDatabase] Run error:', sql, error);
      throw error;
    }
  }

  /**
   * Execute multiple SQL statements (for batch operations like table creation)
   */
  async execute(sql: string): Promise<void> {
    if (!this.db) {
      throw new Error('[CapacitorDatabase] Database not initialized');
    }

    try {
      await this.db.execute(sql);
    } catch (error) {
      console.error('[CapacitorDatabase] Execute error:', sql, error);
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
      throw new Error('[CapacitorDatabase] Database not initialized');
    }

    try {
      const result = await this.db.query(sql, params);
      return (result.values ?? []) as T[];
    } catch (error) {
      console.error('[CapacitorDatabase] Query error:', sql, error);
      throw error;
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    if (!this.db) return false;

    const result = await this.db.isTable(tableName);
    return result.result ?? false;
  }

  /**
   * Export the database as a Uint8Array (for backup/transfer)
   * Note: Only works reliably on native platforms
   */
  async exportDatabase(): Promise<Uint8Array | null> {
    if (!this.db) return null;

    try {
      // Use exportToJson for a portable format
      const result = await this.db.exportToJson('full');

      if (result.export) {
        // Convert JSON to Uint8Array
        const jsonStr = JSON.stringify(result.export);
        const encoder = new TextEncoder();
        return encoder.encode(jsonStr);
      }

      return null;
    } catch (error) {
      console.error('[CapacitorDatabase] Export error:', error);
      return null;
    }
  }

  /**
   * Import database from Uint8Array
   */
  async importDatabase(data: Uint8Array): Promise<void> {
    try {
      // Close existing connection first
      await this.close();

      // Decode the data
      const decoder = new TextDecoder();
      const jsonStr = decoder.decode(data);
      const jsonData = JSON.parse(jsonStr);

      // Import the JSON data
      await this.sqlite.importFromJson(JSON.stringify(jsonData));

      // Reinitialize
      this.initialized = false;
      await this.init();
    } catch (error) {
      console.error('[CapacitorDatabase] Import error:', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      await this.sqlite.closeConnection(DATABASE_NAME, false);
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Delete the database entirely
   */
  async deleteDatabase(): Promise<void> {
    try {
      await this.close();
      // Use the CapacitorSQLite plugin directly for deleteDatabase
      await CapacitorSQLite.deleteDatabase({ database: DATABASE_NAME });

      if (this.isWeb) {
        // Also clear web store
        await this.sqlite.saveToStore(DATABASE_NAME);
      }

      console.log('[CapacitorDatabase] Database deleted');
    } catch (error) {
      console.error('[CapacitorDatabase] Delete error:', error);
      throw error;
    }
  }

  /**
   * Save to persistent store (web platform only)
   * On native platforms, this is a no-op
   */
  async persist(): Promise<void> {
    if (!this.db || !this.isWeb) return;

    await this.sqlite.saveToStore(DATABASE_NAME);
    console.log('[CapacitorDatabase] Saved to web store');
  }

  /**
   * Get database path (native only)
   */
  async getPath(): Promise<string | null> {
    if (!this.db || this.isWeb) return null;

    const result = await this.db.getUrl();
    return result.url ?? null;
  }
}

// Global singleton instance
export const capacitorDb = new CapacitorDatabase();
