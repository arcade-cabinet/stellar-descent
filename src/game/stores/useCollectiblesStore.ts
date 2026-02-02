/**
 * useCollectiblesStore - Unified Zustand store for all collectibles with SQLite persistence
 *
 * Consolidates the previously separate persistence modules:
 * - skullPersistence.ts (skull discoveries and activations)
 * - audioLogPersistence.ts (audio log discoveries and playback tracking)
 * - secretPersistence.ts (secret area discoveries)
 *
 * Usage:
 * ```ts
 * import { useCollectiblesStore } from '../stores/useCollectiblesStore';
 *
 * // In a component:
 * const { skulls, addSkull, hasSkull } = useCollectiblesStore();
 *
 * // Or with selector:
 * const skullCount = useCollectiblesStore((state) => state.skulls.size);
 * ```
 */

import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import { createPersistedStore, type PersistedStore } from './createPersistedStore';

const log = getLogger('CollectiblesStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Audio log discovery metadata
 */
export interface AudioLogEntry {
  logId: string;
  levelId: LevelId;
  discoveredAt: number;
  hasBeenPlayed: boolean;
}

/**
 * Secret discovery metadata
 */
export interface SecretEntry {
  secretId: string;
  levelId: LevelId;
  discoveredAt: number;
}

/**
 * Skull discovery and activation state
 */
export interface SkullEntry {
  skullId: string;
  isActive: boolean;
  discoveredAt: number;
}

/**
 * Progress statistics for collectibles
 */
export interface CollectiblesProgress {
  skulls: { found: number; total: number; active: number };
  audioLogs: { found: number; total: number; played: number };
  secrets: { found: number; total: number };
}

/**
 * Collectibles store state (data only, excludes actions)
 */
export interface CollectiblesState {
  /** Set of found skull IDs */
  skulls: Set<string>;
  /** Map of skull ID -> activation state */
  skullActivations: Map<string, boolean>;
  /** Map of audio log ID -> discovery metadata */
  audioLogs: Map<string, AudioLogEntry>;
  /** Set of found secret IDs */
  secrets: Set<string>;
  /** Map of secret ID -> discovery metadata */
  secretMetadata: Map<string, SecretEntry>;
}

/**
 * Collectibles store actions
 */
export interface CollectiblesActions {
  // Skulls
  addSkull: (id: string) => boolean;
  hasSkull: (id: string) => boolean;
  activateSkull: (id: string) => boolean;
  deactivateSkull: (id: string) => boolean;
  toggleSkull: (id: string) => boolean;
  isSkullActive: (id: string) => boolean;
  getActiveSkullIds: () => string[];
  getFoundSkullIds: () => string[];

  // Audio Logs
  addAudioLog: (logId: string, levelId: LevelId) => boolean;
  markAudioLogPlayed: (logId: string) => void;
  hasAudioLog: (logId: string) => boolean;
  getAudioLog: (logId: string) => AudioLogEntry | undefined;
  getAudioLogsByLevel: (levelId: LevelId) => AudioLogEntry[];
  getUnplayedAudioLogs: () => AudioLogEntry[];

  // Secrets
  addSecret: (secretId: string, levelId: LevelId) => boolean;
  hasSecret: (id: string) => boolean;
  getSecret: (secretId: string) => SecretEntry | undefined;
  getSecretsByLevel: (levelId: LevelId) => SecretEntry[];

  // Progress
  getProgress: () => CollectiblesProgress;

  // Initialization
  initialize: () => Promise<void>;

  // Reset
  resetAll: () => void;
  resetSkulls: () => void;
  resetAudioLogs: () => void;
  resetSecrets: () => void;
}

// Combined type for the full store
export type CollectiblesStoreState = CollectiblesState & CollectiblesActions;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Total number of skulls in the game */
const TOTAL_SKULLS = 10;

/** Total number of audio logs in the game */
const TOTAL_AUDIO_LOGS = 18;

/** Total number of secrets in the game */
const TOTAL_SECRETS = 15;

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

/**
 * Serialized format for persistence
 */
interface SerializedCollectibles {
  skulls: string[];
  skullActivations: [string, boolean][];
  audioLogs: [string, AudioLogEntry][];
  secrets: string[];
  secretMetadata: [string, SecretEntry][];
}

/**
 * Custom serializer for Set and Map types
 */
function serializeCollectibles(state: Partial<CollectiblesState>): string {
  const serialized: SerializedCollectibles = {
    skulls: state.skulls ? Array.from(state.skulls) : [],
    skullActivations: state.skullActivations ? Array.from(state.skullActivations.entries()) : [],
    audioLogs: state.audioLogs ? Array.from(state.audioLogs.entries()) : [],
    secrets: state.secrets ? Array.from(state.secrets) : [],
    secretMetadata: state.secretMetadata ? Array.from(state.secretMetadata.entries()) : [],
  };
  return JSON.stringify(serialized);
}

/**
 * Custom deserializer for Set and Map types
 */
function deserializeCollectibles(data: string): Partial<CollectiblesState> {
  try {
    const parsed = JSON.parse(data) as SerializedCollectibles;
    return {
      skulls: new Set(parsed.skulls || []),
      skullActivations: new Map(parsed.skullActivations || []),
      audioLogs: new Map(parsed.audioLogs || []),
      secrets: new Set(parsed.secrets || []),
      secretMetadata: new Map(parsed.secretMetadata || []),
    };
  } catch (error) {
    log.error('Failed to deserialize collectibles:', error);
    return {
      skulls: new Set(),
      skullActivations: new Map(),
      audioLogs: new Map(),
      secrets: new Set(),
      secretMetadata: new Map(),
    };
  }
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: CollectiblesState = {
  skulls: new Set<string>(),
  skullActivations: new Map<string, boolean>(),
  audioLogs: new Map<string, AudioLogEntry>(),
  secrets: new Set<string>(),
  secretMetadata: new Map<string, SecretEntry>(),
};

// ============================================================================
// STORE CREATION
// ============================================================================

/**
 * Collectibles store with SQLite persistence
 *
 * Unified store for all collectible types: skulls, audio logs, and secrets.
 * Uses custom serialization to handle Set and Map types properly.
 */
export const useCollectiblesStore = createPersistedStore<CollectiblesStoreState>(
  'collectibles',
  initialState as Omit<CollectiblesStoreState, '_hydrate' | '_persist' | '_reset'>,
  (set, get) => ({
    // Initial state
    skulls: new Set<string>(),
    skullActivations: new Map<string, boolean>(),
    audioLogs: new Map<string, AudioLogEntry>(),
    secrets: new Set<string>(),
    secretMetadata: new Map<string, SecretEntry>(),

    // ========================================================================
    // SKULL ACTIONS
    // ========================================================================

    addSkull: (id: string): boolean => {
      const state = get();
      if (state.skulls.has(id)) {
        return false; // Already found
      }

      set((s) => {
        const newSkulls = new Set(s.skulls);
        newSkulls.add(id);
        return { skulls: newSkulls };
      });

      log.info(`Skull discovered: ${id}`);

      // Emit event via EventBus (SKULL_FOUND would need to be added to EventBus types)
      // For now, use COLLECTIBLE_PICKED_UP as a workaround
      getEventBus().emit({
        type: 'COLLECTIBLE_PICKED_UP',
        collectibleId: id,
        collectibleType: 'skull',
      });

      return true;
    },

    hasSkull: (id: string): boolean => {
      return get().skulls.has(id);
    },

    activateSkull: (id: string): boolean => {
      const state = get();
      if (!state.skulls.has(id)) {
        log.warn(`Cannot activate unfound skull: ${id}`);
        return false;
      }

      if (state.skullActivations.get(id) === true) {
        return false; // Already active
      }

      set((s) => {
        const newActivations = new Map(s.skullActivations);
        newActivations.set(id, true);
        return { skullActivations: newActivations };
      });

      log.info(`Skull activated: ${id}`);
      return true;
    },

    deactivateSkull: (id: string): boolean => {
      const state = get();
      if (!state.skullActivations.get(id)) {
        return false; // Not active
      }

      set((s) => {
        const newActivations = new Map(s.skullActivations);
        newActivations.set(id, false);
        return { skullActivations: newActivations };
      });

      log.info(`Skull deactivated: ${id}`);
      return true;
    },

    toggleSkull: (id: string): boolean => {
      const state = get();
      if (state.skullActivations.get(id)) {
        get().deactivateSkull(id);
        return false;
      }
      return get().activateSkull(id);
    },

    isSkullActive: (id: string): boolean => {
      return get().skullActivations.get(id) === true;
    },

    getActiveSkullIds: (): string[] => {
      const activations = get().skullActivations;
      return Array.from(activations.entries())
        .filter(([, isActive]) => isActive)
        .map(([id]) => id);
    },

    getFoundSkullIds: (): string[] => {
      return Array.from(get().skulls);
    },

    // ========================================================================
    // AUDIO LOG ACTIONS
    // ========================================================================

    addAudioLog: (logId: string, levelId: LevelId): boolean => {
      const state = get();
      if (state.audioLogs.has(logId)) {
        return false; // Already discovered
      }

      const entry: AudioLogEntry = {
        logId,
        levelId,
        discoveredAt: Date.now(),
        hasBeenPlayed: false,
      };

      set((s) => {
        const newAudioLogs = new Map(s.audioLogs);
        newAudioLogs.set(logId, entry);
        return { audioLogs: newAudioLogs };
      });

      log.info(`Audio log discovered: ${logId}`);

      // Emit event
      getEventBus().emit({
        type: 'AUDIO_LOG_FOUND',
        logId,
      });

      return true;
    },

    markAudioLogPlayed: (logId: string): void => {
      const state = get();
      const entry = state.audioLogs.get(logId);
      if (!entry) {
        log.warn(`Cannot mark unplayed: audio log not found: ${logId}`);
        return;
      }

      if (entry.hasBeenPlayed) {
        return; // Already played
      }

      set((s) => {
        const newAudioLogs = new Map(s.audioLogs);
        newAudioLogs.set(logId, { ...entry, hasBeenPlayed: true });
        return { audioLogs: newAudioLogs };
      });

      log.debug(`Audio log marked as played: ${logId}`);
    },

    hasAudioLog: (logId: string): boolean => {
      return get().audioLogs.has(logId);
    },

    getAudioLog: (logId: string): AudioLogEntry | undefined => {
      return get().audioLogs.get(logId);
    },

    getAudioLogsByLevel: (levelId: LevelId): AudioLogEntry[] => {
      const entries: AudioLogEntry[] = [];
      for (const entry of get().audioLogs.values()) {
        if (entry.levelId === levelId) {
          entries.push(entry);
        }
      }
      return entries;
    },

    getUnplayedAudioLogs: (): AudioLogEntry[] => {
      const entries: AudioLogEntry[] = [];
      for (const entry of get().audioLogs.values()) {
        if (!entry.hasBeenPlayed) {
          entries.push(entry);
        }
      }
      return entries;
    },

    // ========================================================================
    // SECRET ACTIONS
    // ========================================================================

    addSecret: (secretId: string, levelId: LevelId): boolean => {
      const state = get();
      if (state.secrets.has(secretId)) {
        return false; // Already discovered
      }

      const entry: SecretEntry = {
        secretId,
        levelId,
        discoveredAt: Date.now(),
      };

      set((s) => {
        const newSecrets = new Set(s.secrets);
        newSecrets.add(secretId);
        const newMetadata = new Map(s.secretMetadata);
        newMetadata.set(secretId, entry);
        return { secrets: newSecrets, secretMetadata: newMetadata };
      });

      log.info(`Secret discovered: ${secretId}`);

      // Emit event
      getEventBus().emit({
        type: 'SECRET_FOUND',
        secretId,
      });

      return true;
    },

    hasSecret: (id: string): boolean => {
      return get().secrets.has(id);
    },

    getSecret: (secretId: string): SecretEntry | undefined => {
      return get().secretMetadata.get(secretId);
    },

    getSecretsByLevel: (levelId: LevelId): SecretEntry[] => {
      const entries: SecretEntry[] = [];
      for (const entry of get().secretMetadata.values()) {
        if (entry.levelId === levelId) {
          entries.push(entry);
        }
      }
      return entries;
    },

    // ========================================================================
    // PROGRESS
    // ========================================================================

    getProgress: (): CollectiblesProgress => {
      const state = get();

      let playedCount = 0;
      for (const entry of state.audioLogs.values()) {
        if (entry.hasBeenPlayed) playedCount++;
      }

      let activeCount = 0;
      for (const [, isActive] of state.skullActivations) {
        if (isActive) activeCount++;
      }

      return {
        skulls: {
          found: state.skulls.size,
          total: TOTAL_SKULLS,
          active: activeCount,
        },
        audioLogs: {
          found: state.audioLogs.size,
          total: TOTAL_AUDIO_LOGS,
          played: playedCount,
        },
        secrets: {
          found: state.secrets.size,
          total: TOTAL_SECRETS,
        },
      };
    },

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    initialize: async (): Promise<void> => {
      const store = useCollectiblesStore.getState() as PersistedStore<CollectiblesStoreState>;
      await store._hydrate();
      log.info('Collectibles store initialized');
    },

    // ========================================================================
    // RESET
    // ========================================================================

    resetAll: (): void => {
      set(() => ({
        skulls: new Set<string>(),
        skullActivations: new Map<string, boolean>(),
        audioLogs: new Map<string, AudioLogEntry>(),
        secrets: new Set<string>(),
        secretMetadata: new Map<string, SecretEntry>(),
      }));
      log.info('All collectibles reset');
    },

    resetSkulls: (): void => {
      set(() => ({
        skulls: new Set<string>(),
        skullActivations: new Map<string, boolean>(),
      }));
      log.info('Skulls reset');
    },

    resetAudioLogs: (): void => {
      set(() => ({
        audioLogs: new Map<string, AudioLogEntry>(),
      }));
      log.info('Audio logs reset');
    },

    resetSecrets: (): void => {
      set(() => ({
        secrets: new Set<string>(),
        secretMetadata: new Map<string, SecretEntry>(),
      }));
      log.info('Secrets reset');
    },
  }),
  {
    serialize: serializeCollectibles,
    deserialize: deserializeCollectibles,
    persistDebounce: 300,
    onHydrate: () => {
      log.info('Collectibles store hydrated from persistence');
    },
  }
);

// ============================================================================
// CONVENIENCE HOOKS AND HELPERS
// ============================================================================

/**
 * Initialize the collectibles store
 * Call this once at app startup to hydrate from persistence
 */
export async function initializeCollectiblesStore(): Promise<void> {
  await useCollectiblesStore.getState().initialize();
}

/**
 * Get collectibles progress (non-reactive, for one-time reads)
 */
export function getCollectiblesProgress(): CollectiblesProgress {
  return useCollectiblesStore.getState().getProgress();
}

/**
 * Check if a skull is found (non-reactive)
 */
export function hasSkull(id: string): boolean {
  return useCollectiblesStore.getState().hasSkull(id);
}

/**
 * Check if an audio log is found (non-reactive)
 */
export function hasAudioLog(logId: string): boolean {
  return useCollectiblesStore.getState().hasAudioLog(logId);
}

/**
 * Check if a secret is found (non-reactive)
 */
export function hasSecret(id: string): boolean {
  return useCollectiblesStore.getState().hasSecret(id);
}

/**
 * Get all found skull IDs (non-reactive)
 */
export function getFoundSkullIds(): string[] {
  return useCollectiblesStore.getState().getFoundSkullIds();
}

/**
 * Get all active skull IDs (non-reactive)
 */
export function getActiveSkullIds(): string[] {
  return useCollectiblesStore.getState().getActiveSkullIds();
}

/**
 * Get all discovered audio log IDs (non-reactive)
 */
export function getDiscoveredAudioLogIds(): string[] {
  return Array.from(useCollectiblesStore.getState().audioLogs.keys());
}

/**
 * Get all discovered secret IDs (non-reactive)
 */
export function getDiscoveredSecretIds(): string[] {
  return Array.from(useCollectiblesStore.getState().secrets);
}

// ============================================================================
// BACKWARDS COMPATIBILITY HELPERS
// These functions maintain API compatibility with the old persistence modules
// ============================================================================

/**
 * Get unplayed audio logs (non-reactive)
 * @deprecated Use useCollectiblesStore().getUnplayedAudioLogs() instead
 */
export function getUnplayedAudioLogs(): AudioLogEntry[] {
  return useCollectiblesStore.getState().getUnplayedAudioLogs();
}

/**
 * Mark an audio log as played (non-reactive)
 * @deprecated Use useCollectiblesStore().markAudioLogPlayed() instead
 */
export function markAudioLogPlayed(logId: string): void {
  useCollectiblesStore.getState().markAudioLogPlayed(logId);
}

/**
 * Add a discovered audio log
 * @deprecated Use useCollectiblesStore().addAudioLog() instead
 */
export function addDiscoveredAudioLog(logId: string, levelId: LevelId): void {
  useCollectiblesStore.getState().addAudioLog(logId, levelId);
}

/**
 * Add a discovered secret
 * @deprecated Use useCollectiblesStore().addSecret() instead
 */
export function addDiscoveredSecret(secretId: string, levelId: LevelId): void {
  useCollectiblesStore.getState().addSecret(secretId, levelId);
}

/**
 * Add a found skull
 * @deprecated Use useCollectiblesStore().addSkull() instead
 */
export function addFoundSkull(skullId: string): void {
  useCollectiblesStore.getState().addSkull(skullId);
}

/**
 * Check if an audio log is discovered
 * @deprecated Use hasAudioLog() instead
 */
export function isAudioLogDiscovered(logId: string): boolean {
  return hasAudioLog(logId);
}

/**
 * Check if a secret is discovered
 * @deprecated Use hasSecret() instead
 */
export function isSecretDiscovered(secretId: string): boolean {
  return hasSecret(secretId);
}

/**
 * Check if a skull is found
 * @deprecated Use hasSkull() instead
 */
export function isSkullFound(skullId: string): boolean {
  return hasSkull(skullId);
}

/**
 * Get audio logs by level (non-reactive)
 */
export function getDiscoveredLogsByLevel(levelId: LevelId): AudioLogEntry[] {
  return useCollectiblesStore.getState().getAudioLogsByLevel(levelId);
}

/**
 * Get secrets by level (non-reactive)
 */
export function getDiscoveredSecretsByLevel(levelId: LevelId): SecretEntry[] {
  return useCollectiblesStore.getState().getSecretsByLevel(levelId);
}
