/**
 * createPersistedStore - Factory for creating Zustand stores with SQLite persistence
 *
 * This module provides a factory function that creates Zustand stores with:
 * - Automatic persistence to SQLite via SaveSystem's table abstraction
 * - Hydration from persisted state on initialization
 * - subscribeWithSelector middleware for fine-grained subscriptions
 * - Type-safe state and actions
 *
 * Usage:
 * ```ts
 * interface SettingsState {
 *   masterVolume: number;
 *   setMasterVolume: (volume: number) => void;
 * }
 *
 * const useSettingsStore = createPersistedStore<SettingsState>(
 *   'settings',
 *   { masterVolume: 1.0 },
 *   (set, get) => ({
 *     masterVolume: 1.0,
 *     setMasterVolume: (volume) => set({ masterVolume: volume }),
 *   })
 * );
 * ```
 */

import { create, type StateCreator } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getLogger } from '../core/Logger';
import { saveSystem } from '../persistence/SaveSystem';

const log = getLogger('PersistedStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Base interface for persisted store state
 * All persisted stores include these internal flags
 */
export interface PersistedState {
  /** Whether the store has been initialized */
  _initialized: boolean;
  /** Whether the store has been hydrated from persistence */
  _hydrated: boolean;
}

/**
 * Actions added to all persisted stores
 */
export interface PersistedActions {
  /** Hydrate the store from persisted state */
  _hydrate: () => Promise<void>;
  /** Persist the current state */
  _persist: () => Promise<void>;
  /** Reset to initial state and clear persistence */
  _reset: () => Promise<void>;
}

/**
 * Combined type for persisted store state + actions
 */
export type PersistedStore<T extends object> = T & PersistedState & PersistedActions;

/**
 * Configuration options for the persisted store
 */
export interface PersistedStoreConfig<T extends object> {
  /**
   * Keys to exclude from persistence
   * Functions and internal keys (_prefixed) are always excluded
   */
  excludeKeys?: (keyof T)[];

  /**
   * Debounce persistence writes (in ms)
   * Default: 500ms
   */
  persistDebounce?: number;

  /**
   * Custom serializer for the state
   * Default: JSON.stringify
   */
  serialize?: (state: Partial<T>) => string;

  /**
   * Custom deserializer for the state
   * Default: JSON.parse
   */
  deserialize?: (data: string) => Partial<T>;

  /**
   * Called after hydration completes
   */
  onHydrate?: (state: T) => void;

  /**
   * Called on persistence error
   */
  onPersistError?: (error: Error) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Filter out functions and internal keys from state for persistence
 */
function filterPersistableState<T extends object>(
  state: T,
  excludeKeys: (keyof T)[] = []
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const key of Object.keys(state) as (keyof T)[]) {
    // Skip functions
    if (typeof state[key] === 'function') continue;

    // Skip internal keys (prefixed with _)
    if (typeof key === 'string' && key.startsWith('_')) continue;

    // Skip explicitly excluded keys
    if (excludeKeys.includes(key)) continue;

    filtered[key] = state[key];
  }

  return filtered;
}

/**
 * Default serializer
 */
function defaultSerialize<T>(state: T): string {
  return JSON.stringify(state);
}

/**
 * Default deserializer
 */
function defaultDeserialize<T>(data: string): T {
  return JSON.parse(data) as T;
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a Zustand store with SQLite persistence
 *
 * @param tableName - The table name for persistence (used as key in SaveSystem)
 * @param initialState - Initial state values (excluding actions)
 * @param stateCreator - Zustand state creator function
 * @param config - Optional configuration
 * @returns A Zustand store with persistence capabilities
 */
export function createPersistedStore<T extends object>(
  tableName: string,
  initialState: Omit<T, keyof PersistedActions>,
  stateCreator: StateCreator<PersistedStore<T>, [['zustand/subscribeWithSelector', never]], [], T>,
  config: PersistedStoreConfig<T> = {}
) {
  const {
    excludeKeys = [],
    persistDebounce = 500,
    serialize = defaultSerialize,
    deserialize = defaultDeserialize,
    onHydrate,
    onPersistError,
  } = config;

  // Debounce timer for persistence
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  // Create the store with subscribeWithSelector middleware
  const useStore = create<PersistedStore<T>>()(
    subscribeWithSelector((set, get, api) => {
      // Get the user-defined state and actions
      const userState = stateCreator(set, get, api);

      // Hydration action
      const _hydrate = async () => {
        try {
          const data = await saveSystem.loadTable<string>(tableName);

          if (data) {
            const parsed = deserialize(data);
            set((state) => ({
              ...state,
              ...parsed,
              _hydrated: true,
              _initialized: true,
            }));

            log.info(`Store "${tableName}" hydrated from persistence`);

            if (onHydrate) {
              onHydrate(get() as unknown as T);
            }
          } else {
            set({ _hydrated: true, _initialized: true } as Partial<PersistedStore<T>>);
            log.info(`Store "${tableName}" initialized with defaults (no persisted data)`);
          }
        } catch (error) {
          log.error(`Failed to hydrate store "${tableName}":`, error);
          set({ _hydrated: true, _initialized: true } as Partial<PersistedStore<T>>);
        }
      };

      // Persistence action
      const _persist = async () => {
        try {
          const state = get();
          const persistable = filterPersistableState(state as unknown as T, excludeKeys);
          const serialized = serialize(persistable);

          await saveSystem.saveTable(tableName, serialized);
          log.debug(`Store "${tableName}" persisted`);
        } catch (error) {
          log.error(`Failed to persist store "${tableName}":`, error);
          if (onPersistError && error instanceof Error) {
            onPersistError(error);
          }
        }
      };

      // Reset action
      const _reset = async () => {
        try {
          // Clear persisted data
          await saveSystem.deleteTable(tableName);

          // Reset to initial state
          set(
            () =>
              ({
                ...initialState,
                _initialized: true,
                _hydrated: true,
              }) as PersistedStore<T>
          );

          log.info(`Store "${tableName}" reset to initial state`);
        } catch (error) {
          log.error(`Failed to reset store "${tableName}":`, error);
        }
      };

      // Return combined state
      return {
        ...initialState,
        ...userState,
        _initialized: false,
        _hydrated: false,
        _hydrate,
        _persist,
        _reset,
      } as PersistedStore<T>;
    })
  );

  // Set up auto-persistence on state changes (debounced)
  useStore.subscribe(
    (state) => filterPersistableState(state as unknown as T, excludeKeys),
    () => {
      const state = useStore.getState();

      // Don't persist until hydrated
      if (!state._hydrated) return;

      // Debounce persistence
      if (persistTimer) {
        clearTimeout(persistTimer);
      }

      persistTimer = setTimeout(() => {
        state._persist();
      }, persistDebounce);
    },
    {
      // Use shallow equality to detect changes
      equalityFn: (a, b) => {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (const key of aKeys) {
          if (a[key as keyof typeof a] !== b[key as keyof typeof b]) return false;
        }
        return true;
      },
    }
  );

  return useStore;
}

/**
 * Create a non-persisted Zustand store with subscribeWithSelector
 *
 * Useful for stores that don't need persistence but want the same API pattern
 *
 * @param stateCreator - Zustand state creator function
 * @returns A Zustand store without persistence
 */
export function createStore<T extends object>(
  stateCreator: StateCreator<T, [['zustand/subscribeWithSelector', never]], [], T>
) {
  return create<T>()(subscribeWithSelector(stateCreator));
}
