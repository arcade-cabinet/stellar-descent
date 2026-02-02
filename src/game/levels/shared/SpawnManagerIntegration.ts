/**
 * SpawnManagerIntegration - Helper utilities for integrating SpawnManager into levels
 *
 * Provides factory functions and event wiring to help levels adopt the centralized
 * SpawnManager for enemy wave orchestration. Levels can import this module to get
 * a pre-configured SpawnManager instance wired to the EventBus for automatic
 * event emission (ENEMY_SPAWNED, WAVE_START, WAVE_COMPLETE, etc.).
 *
 * Usage:
 * ```ts
 * import { createLevelSpawnManager, LEVEL_SPAWN_CONFIGS } from './shared/SpawnManagerIntegration';
 *
 * // In createEnvironment():
 * this.spawnManager = createLevelSpawnManager('fob_delta', {
 *   onSpawnEnemy: (speciesId, position, facingAngle, overrides) => {
 *     // Create the enemy entity and return its unique ID
 *     const enemy = this.spawnEnemyEntity(speciesId, position, facingAngle, overrides);
 *     return enemy.id;
 *   },
 *   onWaveStart: (waveNumber, label) => {
 *     this.emitNotification(`${label ?? 'WAVE ' + (waveNumber + 1)}`, 2000);
 *   },
 *   onWaveComplete: (waveNumber) => {
 *     this.emitNotification('WAVE CLEARED', 1500);
 *   },
 *   onAllWavesComplete: () => {
 *     this.onCombatCleared();
 *   },
 * });
 *
 * // In updateLevel(deltaTime):
 * this.spawnManager.update(deltaTime, this.camera.position);
 *
 * // When an enemy dies:
 * this.spawnManager.reportKill(enemy.id);
 *
 * // To trigger objective-based waves:
 * this.spawnManager.setFlag('ambush_triggered', true);
 * ```
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import { getEventBus } from '../../core/EventBus';
import { getLogger } from '../../core/Logger';
import { LEVEL_SPAWN_CONFIGS } from './LevelSpawnConfigs';
import type { EnemyStatOverrides, LevelSpawnConfig } from './SpawnConfig';
import { SpawnManager, type SpawnManagerCallbacks } from './SpawnManager';

const log = getLogger('SpawnManagerIntegration');

// Re-export for convenience
export { LEVEL_SPAWN_CONFIGS };
export type { SpawnManagerCallbacks };

/**
 * Extended callbacks that include level-specific handlers.
 * The core callbacks are passed to SpawnManager, while additional
 * hooks are used for EventBus integration.
 */
export interface LevelSpawnCallbacks extends SpawnManagerCallbacks {
  /**
   * Optional callback when spawn manager emits to EventBus.
   * Useful for levels that want to intercept events before they're published.
   */
  onEventEmit?: (eventType: string, payload: unknown) => void;
}

/**
 * Creates a SpawnManager instance for a level with EventBus integration.
 *
 * @param levelId - The level identifier (must match a key in LEVEL_SPAWN_CONFIGS)
 * @param callbacks - Callbacks for entity creation and level notifications
 * @param options - Optional configuration overrides
 * @returns Configured SpawnManager instance, or null if level config not found
 */
export function createLevelSpawnManager(
  levelId: string,
  callbacks: LevelSpawnCallbacks,
  options?: {
    /** Emit events to EventBus automatically (default: true) */
    emitEvents?: boolean;
    /** Override the spawn config (useful for testing or difficulty modifiers) */
    configOverride?: Partial<LevelSpawnConfig>;
  }
): SpawnManager | null {
  const baseConfig = LEVEL_SPAWN_CONFIGS[levelId];
  if (!baseConfig) {
    log.warn(`No spawn config found for level: ${levelId}`);
    return null;
  }

  // Merge any config overrides
  const config: LevelSpawnConfig = options?.configOverride
    ? { ...baseConfig, ...options.configOverride }
    : baseConfig;

  const emitEvents = options?.emitEvents ?? true;
  const eventBus = getEventBus();

  // Wrap callbacks to add EventBus emission
  const wrappedCallbacks: SpawnManagerCallbacks = {
    onSpawnEnemy: (speciesId, position, facingAngle, overrides) => {
      const entityId = callbacks.onSpawnEnemy(speciesId, position, facingAngle, overrides);

      if (entityId && emitEvents) {
        eventBus.emit({
          type: 'ENEMY_SPAWNED',
          levelId,
          speciesId,
          entityId,
          position: { x: position.x, y: position.y, z: position.z },
          facingAngle,
        });
        callbacks.onEventEmit?.('ENEMY_SPAWNED', {
          levelId,
          speciesId,
          entityId,
          position,
          facingAngle,
        });
      }

      return entityId;
    },

    onWaveStart: (waveNumber, label) => {
      callbacks.onWaveStart?.(waveNumber, label);

      if (emitEvents) {
        eventBus.emit({
          type: 'WAVE_START',
          levelId,
          waveNumber,
          label,
        });
        callbacks.onEventEmit?.('WAVE_START', { levelId, waveNumber, label });
      }
    },

    onWaveComplete: (waveNumber) => {
      callbacks.onWaveComplete?.(waveNumber);

      if (emitEvents) {
        eventBus.emit({
          type: 'WAVE_COMPLETE',
          levelId,
          waveNumber,
        });
        callbacks.onEventEmit?.('WAVE_COMPLETE', { levelId, waveNumber });
      }
    },

    onAllWavesComplete: () => {
      callbacks.onAllWavesComplete?.();

      if (emitEvents) {
        eventBus.emit({
          type: 'ALL_WAVES_COMPLETE',
          levelId,
        });
        callbacks.onEventEmit?.('ALL_WAVES_COMPLETE', { levelId });
      }
    },
  };

  log.info(`Creating SpawnManager for level: ${levelId} with ${config.waves.length} waves`);
  return new SpawnManager(config, wrappedCallbacks);
}

/**
 * Helper to convert a simple position object to a Vector3.
 */
export function positionToVector3(pos: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(pos.x, pos.y, pos.z);
}

/**
 * Helper to apply stat overrides to base enemy stats.
 *
 * @param baseStats - Base stats for the enemy species
 * @param overrides - Optional overrides from spawn config
 * @returns Modified stats with overrides applied
 */
export function applyStatOverrides<
  T extends { health: number; damage: number; speed: number; scale?: number },
>(baseStats: T, overrides: Partial<EnemyStatOverrides> | null): T {
  if (!overrides) return baseStats;

  return {
    ...baseStats,
    health: baseStats.health * (overrides.healthMultiplier ?? 1),
    damage: baseStats.damage * (overrides.damageMultiplier ?? 1),
    speed: baseStats.speed * (overrides.speedMultiplier ?? 1),
    scale: (baseStats.scale ?? 1) * (overrides.scale ?? 1),
  };
}

/**
 * Utility type for levels that use SpawnManager.
 * Adds the spawnManager property and common helper methods.
 */
export interface SpawnManagerLevelMixin {
  /** The SpawnManager instance for this level */
  spawnManager: SpawnManager | null;

  /** Map of entity IDs to enemy objects for kill tracking */
  spawnedEnemyMap: Map<string, { id: string; mesh: unknown; health: number }>;

  /**
   * Report an enemy kill to the SpawnManager.
   * Call this when an enemy dies to update wave progress.
   */
  reportEnemyKill(entityId: string): void;

  /**
   * Set an objective flag to trigger objective-based waves.
   * Call this when the player completes an objective or enters a trigger zone.
   */
  setSpawnFlag(flagName: string, value?: boolean): void;

  /**
   * Manually start a specific wave (for manual trigger types).
   */
  startSpawnWave(waveNumber: number): void;

  /**
   * Pause all spawning (e.g., during cinematics or dialogue).
   */
  pauseSpawning(): void;

  /**
   * Resume spawning after a pause.
   */
  resumeSpawning(): void;

  /**
   * Get current spawn statistics for HUD display.
   */
  getSpawnStats(): {
    totalKills: number;
    aliveCount: number;
    currentWave: number;
    isComplete: boolean;
  };
}

/**
 * Default implementation helpers for SpawnManagerLevelMixin.
 * Levels can use these directly or override with custom logic.
 */
export const SpawnManagerHelpers = {
  reportEnemyKill(spawnManager: SpawnManager | null, entityId: string): void {
    spawnManager?.reportKill(entityId);
  },

  setSpawnFlag(spawnManager: SpawnManager | null, flagName: string, value = true): void {
    spawnManager?.setFlag(flagName, value);
  },

  startSpawnWave(spawnManager: SpawnManager | null, waveNumber: number): void {
    spawnManager?.startWave(waveNumber);
  },

  pauseSpawning(spawnManager: SpawnManager | null): void {
    spawnManager?.pause();
  },

  resumeSpawning(spawnManager: SpawnManager | null): void {
    spawnManager?.resume();
  },

  getSpawnStats(spawnManager: SpawnManager | null): {
    totalKills: number;
    aliveCount: number;
    currentWave: number;
    isComplete: boolean;
  } {
    if (!spawnManager) {
      return { totalKills: 0, aliveCount: 0, currentWave: -1, isComplete: true };
    }

    return {
      totalKills: spawnManager.getTotalKills(),
      aliveCount: spawnManager.getAliveCount(),
      currentWave: spawnManager.getCurrentWaveNumber(),
      isComplete: spawnManager.isComplete(),
    };
  },

  /**
   * Dispose the SpawnManager and clean up resources.
   */
  disposeSpawnManager(spawnManager: SpawnManager | null): void {
    spawnManager?.dispose();
  },
};
