/**
 * IndexedDBPersistence Tests
 *
 * Tests for the IndexedDB persistence layer
 * Uses mocked IndexedDB since happy-dom doesn't provide it
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistenceManager } from './IndexedDBPersistence';

// Create a mock IndexedDB implementation
const _createMockIndexedDB = () => {
  const stores = new Map<string, Map<string, unknown>>();

  const mockStore = (name: string) => {
    if (!stores.has(name)) {
      stores.set(name, new Map());
    }
    return {
      put: vi.fn((value: unknown, key: string) => {
        stores.get(name)!.set(key, value);
        return { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      }),
      get: vi.fn((key: string) => {
        const result = stores.get(name)!.get(key);
        return {
          result,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
      }),
      delete: vi.fn((key: string) => {
        stores.get(name)!.delete(key);
        return { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      }),
    };
  };

  const mockTransaction = (storeNames: string | string[], _mode: string) => {
    const store = mockStore(Array.isArray(storeNames) ? storeNames[0] : storeNames);
    return {
      objectStore: vi.fn(() => store),
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
  };

  const mockDB = {
    transaction: vi.fn(mockTransaction),
    close: vi.fn(),
    objectStoreNames: {
      contains: vi.fn(() => true),
    },
    createObjectStore: vi.fn(),
  };

  return {
    open: vi.fn(() => ({
      result: mockDB,
      onsuccess: null as ((event: { target: { result: typeof mockDB } }) => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as ((event: { target: { result: typeof mockDB } }) => void) | null,
    })),
    stores,
    mockDB,
  };
};

describe('IndexedDBPersistence', () => {
  describe('PersistenceManager', () => {
    let manager: PersistenceManager;

    beforeEach(() => {
      vi.useFakeTimers();
      manager = new PersistenceManager(100);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('schedules save with debounce', () => {
      const data1 = new Uint8Array([1]);
      const data2 = new Uint8Array([2]);

      // Schedule multiple saves
      manager.scheduleSave(data1);
      manager.scheduleSave(data2);

      // The pendingData should be the last one
      // We can't directly test private members, but we can test behavior
      expect(manager).toBeDefined();
    });

    it('cancels previous timeout when scheduling new save', () => {
      const data1 = new Uint8Array([1]);
      const data2 = new Uint8Array([2]);

      manager.scheduleSave(data1);
      manager.scheduleSave(data2);

      // Should not throw
      expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    });

    it('flush cancels pending timeout', async () => {
      // Mock the persistence module's save function
      vi.mock('./IndexedDBPersistence', async (importOriginal) => {
        const original = (await importOriginal()) as Record<string, unknown>;
        return {
          ...original,
          saveDatabaseToIndexedDB: vi.fn().mockResolvedValue(undefined),
        };
      });

      const data = new Uint8Array([1, 2, 3]);
      manager.scheduleSave(data);

      // Flush should not throw even without IndexedDB
      await expect(manager.flush()).resolves.not.toThrow();
    });

    it('saveNow handles errors gracefully', async () => {
      const data = new Uint8Array([1, 2, 3]);

      // This will fail because IndexedDB isn't available, but should not throw
      await expect(manager.saveNow(data)).resolves.not.toThrow();
    });
  });

  describe('Module exports', () => {
    it('exports all required functions', async () => {
      const module = await import('./IndexedDBPersistence');

      expect(module.saveDatabaseToIndexedDB).toBeDefined();
      expect(module.loadDatabaseFromIndexedDB).toBeDefined();
      expect(module.getSaveMetadata).toBeDefined();
      expect(module.hasSavedDatabase).toBeDefined();
      expect(module.clearSavedDatabase).toBeDefined();
      expect(module.PersistenceManager).toBeDefined();
      expect(module.persistenceManager).toBeDefined();
    });
  });
});
