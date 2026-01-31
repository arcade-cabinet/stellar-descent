/**
 * IndexedDBPersistence - DEPRECATED
 *
 * This module was used to bridge sql.js with IndexedDB for web persistence.
 * It has been replaced by @capacitor-community/sqlite which handles persistence
 * automatically across all platforms (Web, iOS, Android).
 *
 * The new CapacitorDatabase.ts and updated worldDatabase.ts now handle all
 * database persistence. This file is kept for backward compatibility but
 * is no longer used.
 *
 * @deprecated Use CapacitorDatabase.ts instead
 */

const DB_NAME = 'stellar_descent_db';
const DB_VERSION = 1;
const STORE_NAME = 'game_data';
const DATABASE_KEY = 'sql_database';
const METADATA_KEY = 'save_metadata';

/**
 * Metadata stored alongside the database for quick access
 */
export interface SaveMetadata {
  lastSaved: number;
  version: number;
  hasSaveData: boolean;
}

/**
 * Opens the IndexedDB database, creating object stores if needed
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for game data
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        console.log('[IndexedDB] Created game_data object store');
      }
    };
  });
}

/**
 * Save the sql.js database binary data to IndexedDB
 */
export async function saveDatabaseToIndexedDB(data: Uint8Array): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Save the database binary
      const dataRequest = store.put(data, DATABASE_KEY);

      // Save metadata
      const metadata: SaveMetadata = {
        lastSaved: Date.now(),
        version: 1,
        hasSaveData: true,
      };
      store.put(metadata, METADATA_KEY);

      transaction.oncomplete = () => {
        db.close();
        console.log('[IndexedDB] Database saved successfully');
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        console.error('[IndexedDB] Failed to save database:', transaction.error);
        reject(transaction.error);
      };

      dataRequest.onerror = () => {
        console.error('[IndexedDB] Failed to save data:', dataRequest.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error saving database:', error);
    throw error;
  }
}

/**
 * Load the sql.js database binary data from IndexedDB
 */
export async function loadDatabaseFromIndexedDB(): Promise<Uint8Array | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(DATABASE_KEY);

    request.onsuccess = () => {
      db.close();
      if (request.result) {
        console.log('[IndexedDB] Database loaded successfully');
        resolve(request.result as Uint8Array);
      } else {
        console.log('[IndexedDB] No saved database found');
        resolve(null);
      }
    };

    request.onerror = () => {
      db.close();
      console.error('[IndexedDB] Failed to load database:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Get save metadata without loading the full database
 */
export async function getSaveMetadata(): Promise<SaveMetadata | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(METADATA_KEY);

    request.onsuccess = () => {
      db.close();
      resolve(request.result as SaveMetadata | null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Check if a save exists in IndexedDB
 */
export async function hasSavedDatabase(): Promise<boolean> {
  const metadata = await getSaveMetadata();
  return metadata?.hasSaveData ?? false;
}

/**
 * Clear all saved data from IndexedDB
 */
export async function clearSavedDatabase(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.delete(DATABASE_KEY);
      store.delete(METADATA_KEY);

      transaction.oncomplete = () => {
        db.close();
        console.log('[IndexedDB] Database cleared');
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] Error clearing database:', error);
    throw error;
  }
}

/**
 * PersistenceManager - Handles automatic persistence with debouncing
 *
 * Wraps the persistence operations with intelligent batching to avoid
 * excessive writes while ensuring data is saved reliably.
 */
export class PersistenceManager {
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingData: Uint8Array | null = null;
  private isSaving = false;
  private debounceMs: number;

  constructor(debounceMs = 1000) {
    this.debounceMs = debounceMs;
  }

  /**
   * Schedule a save operation (debounced)
   * Multiple calls within the debounce window will be batched
   */
  scheduleSave(data: Uint8Array): void {
    this.pendingData = data;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.executeSave();
    }, this.debounceMs);
  }

  /**
   * Force an immediate save (use sparingly)
   */
  async saveNow(data: Uint8Array): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.pendingData = data;
    await this.executeSave();
  }

  /**
   * Execute the pending save
   */
  private async executeSave(): Promise<void> {
    if (this.isSaving || !this.pendingData) {
      return;
    }

    this.isSaving = true;
    const dataToSave = this.pendingData;
    this.pendingData = null;

    try {
      await saveDatabaseToIndexedDB(dataToSave);
    } catch (error) {
      console.error('[PersistenceManager] Save failed:', error);
      // Re-queue the data for retry
      this.pendingData = dataToSave;
    } finally {
      this.isSaving = false;
    }

    // If more data came in while we were saving, save it too
    if (this.pendingData) {
      this.scheduleSave(this.pendingData);
    }
  }

  /**
   * Ensure any pending saves are completed (call before app unload)
   */
  async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (this.pendingData) {
      await this.executeSave();
    }
  }
}

// Global singleton instance
export const persistenceManager = new PersistenceManager();
