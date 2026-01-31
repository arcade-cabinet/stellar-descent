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
import { getLogger } from '../core/Logger';

const log = getLogger('CapacitorDatabase');

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
      log.info('Database initialized successfully');
    } catch (error) {
      log.error('Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Initialize web platform specific components
   * Note: jeep-sqlite element should already be in index.html and initialized by main.tsx
   */
  private async initWebPlatform(): Promise<void> {
    log.info('initWebPlatform: starting');

    // Wait for the custom element to be defined first
    await customElements.whenDefined('jeep-sqlite');
    log.info('initWebPlatform: custom element defined');

    // Get the jeep-sqlite element (should already exist in DOM from index.html)
    // Cast through unknown because HTMLJeepSqliteElement's componentOnReady returns
    // Promise<HTMLJeepSqliteElement> but we only need to await it (treat as Promise<void>)
    const jeepSqliteEl = document.querySelector('jeep-sqlite') as unknown as HTMLElement & {
      componentOnReady?: () => Promise<void>;
      isStoreOpen?: () => Promise<boolean>;
    };

    if (!jeepSqliteEl) {
      throw new Error('jeep-sqlite element not found in DOM. Ensure it is in index.html.');
    }
    log.info('initWebPlatform: element found in DOM');

    // Wait for the Stencil component to be fully ready
    if (typeof jeepSqliteEl.componentOnReady === 'function') {
      log.info('initWebPlatform: waiting for componentOnReady');
      await jeepSqliteEl.componentOnReady();
      log.info('initWebPlatform: componentOnReady resolved');
    }

    // Check if the web store is already open
    // Note: isStoreOpen() returns Promise<boolean> directly, not { result: boolean }
    const checkStoreOpen = async (): Promise<boolean> => {
      if (typeof jeepSqliteEl.isStoreOpen === 'function') {
        try {
          const result = await jeepSqliteEl.isStoreOpen();
          return result === true;
        } catch (e) {
          log.warn('initWebPlatform: isStoreOpen error:', e);
          return false;
        }
      }
      log.warn('initWebPlatform: isStoreOpen method not available');
      return false;
    };

    // The jeep-sqlite component's connectedCallback calls openStore() asynchronously
    // with a .then() handler. We need to wait for that async operation to complete.
    // Give it a brief moment to initialize, then poll for readiness.
    const maxWait = 5000;
    const pollInterval = 100;
    const startTime = Date.now();

    // First, wait for the store to be open from the element's internal initialization
    let pollCount = 0;
    while (Date.now() - startTime < maxWait) {
      const isOpen = await checkStoreOpen();
      pollCount++;
      if (pollCount <= 5 || pollCount % 10 === 0) {
        log.info(`initWebPlatform: poll #${pollCount}, isStoreOpen=${isOpen}`);
      }
      if (isOpen) {
        log.info('initWebPlatform: store ready from element initialization');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Now initialize the SQLiteConnection's web store handler
    log.info('initWebPlatform: calling sqlite.initWebStore()');
    await this.sqlite.initWebStore();
    log.info('initWebPlatform: initWebStore() completed');

    // Verify the store is actually open
    const finalCheck = await checkStoreOpen();
    log.info(`initWebPlatform: final isStoreOpen check = ${finalCheck}`);

    if (finalCheck) {
      log.info('initWebPlatform: web store initialized successfully');
      return;
    }

    // If still not open after initWebStore, poll a bit more
    log.info('initWebPlatform: extended polling...');
    const extendedStart = Date.now();
    while (Date.now() - extendedStart < 2000) {
      if (await checkStoreOpen()) {
        log.info('initWebPlatform: store ready (extended wait)');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Web store failed to open after initialization');
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
      log.error('Run error:', sql, error);
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
      throw new Error('[CapacitorDatabase] Database not initialized');
    }

    try {
      const result = await this.db.query(sql, params);
      return (result.values ?? []) as T[];
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
      log.error('Export error:', error);
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
      log.error('Import error:', error);
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

      log.info('Database deleted');
    } catch (error) {
      log.error('Delete error:', error);
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
    log.info('Saved to web store');
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
