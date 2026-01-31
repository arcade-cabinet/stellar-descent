import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { getLogger } from './Logger';

const log = getLogger('EventBus');

// ---------------------------------------------------------------------------
// Game event types
// ---------------------------------------------------------------------------

// Trigger types for TriggerSystem integration
export type TriggerType =
  | 'volume'
  | 'proximity'
  | 'interaction'
  | 'line_of_sight'
  | 'combat'
  | 'collectible';

export type GameEvent =
  // Core gameplay events
  | { type: 'ENEMY_KILLED'; position: Vector3; enemyType: string; enemyId?: string }
  | { type: 'ENEMY_ALERTED'; enemyId: string; enemyType: string; position: Vector3 }
  | { type: 'ENEMY_ATTACK'; enemyId: string; position: Vector3; damage: number }
  | { type: 'PLAYER_DAMAGED'; amount: number; source?: string; direction?: number }
  | { type: 'PLAYER_DEATH'; cause: string; position: Vector3 }
  | { type: 'PLAYER_HEALED'; amount: number }
  | { type: 'LOW_HEALTH_WARNING'; currentHealth: number; maxHealth: number }
  | { type: 'OBJECTIVE_UPDATED'; title: string; instructions: string }
  | { type: 'OBJECTIVE_STARTED'; objectiveId: string; title: string }
  | { type: 'OBJECTIVE_COMPLETED'; objectiveId: string }
  | { type: 'OBJECTIVE_FAILED'; objectiveId: string; reason?: string }
  | { type: 'COMBAT_STATE_CHANGED'; inCombat: boolean }
  | { type: 'WEAPON_SWITCHED'; weaponId: string; fromWeapon?: string; toWeapon?: string; slot?: number }
  | { type: 'WEAPON_FIRED'; weaponId: string; position: Vector3; direction?: Vector3 }
  | { type: 'RELOAD_STARTED'; weaponId: string; reloadTime: number }
  | { type: 'RELOAD_COMPLETE'; weaponId: string; ammoLoaded: number }
  | { type: 'PROJECTILE_IMPACT'; position: Vector3; damage: number; isCritical: boolean }
  | { type: 'AMMO_CHANGED'; current: number; max: number }
  | { type: 'ITEM_COLLECTED'; itemId: string; itemType: string; quantity: number }
  | { type: 'COLLECTIBLE_PICKED_UP'; collectibleId: string; collectibleType: string }
  | { type: 'PICKUP_COLLECTED'; pickupId: string; pickupType: string; value?: number }
  | { type: 'AUDIO_LOG_FOUND'; logId: string }
  | { type: 'SECRET_FOUND'; secretId: string }
  | { type: 'VEHICLE_ENTERED'; vehicleType: string }
  | { type: 'VEHICLE_EXITED'; vehicleType: string }
  | { type: 'CHECKPOINT_REACHED'; checkpointId: string; phase?: string }
  | { type: 'DIALOGUE_STARTED'; triggerId: string; speakerId?: string; dialogueId?: string; text?: string; duration?: number }
  | { type: 'DIALOGUE_ENDED'; triggerId: string }
  | { type: 'NOTIFICATION'; text: string; duration?: number }
  | { type: 'FOOTSTEP'; position: Vector3; surface: string }
  // Level lifecycle events
  | { type: 'LEVEL_LOADED'; levelId: string }
  | { type: 'LEVEL_STARTED'; levelId: string; chapter: number }
  | { type: 'LEVEL_COMPLETE'; levelId: string; stats: { time: number; kills: number; accuracy: number; secretsFound: number; damageTaken: number } }
  | { type: 'LEVEL_FAILED'; levelId: string; reason: string }
  // Wave events
  | { type: 'WAVE_STARTED'; levelId: string; waveNumber: number; waveId?: string; totalEnemies?: number; label?: string }
  | { type: 'WAVE_COMPLETED'; levelId: string; waveNumber: number; waveId?: string }
  // Boss events
  | { type: 'BOSS_DAMAGED'; bossId: string; damage: number; currentHealth: number; maxHealth: number }
  | { type: 'BOSS_DEFEATED'; bossId: string; bossType: string; position: Vector3 }
  // Trigger system events
  | { type: 'TRIGGER_ENTER'; triggerId: string; triggerType: TriggerType }
  | { type: 'TRIGGER_EXIT'; triggerId: string; triggerType: TriggerType }
  | { type: 'TRIGGER_STAY'; triggerId: string; triggerType: TriggerType; duration: number }
  | { type: 'TRIGGER_INTERACT'; triggerId: string }
  | { type: 'TRIGGER_LINE_OF_SIGHT'; triggerId: string; targetPosition: Vector3 }
  | { type: 'TRIGGER_COMBAT_COMPLETE'; triggerId: string; enemiesKilled: number }
  | { type: 'TRIGGER_COLLECTIBLE'; triggerId: string; collectibleId: string }
  | { type: 'TRIGGER_GROUP_COMPLETE'; groupId: string; mode: 'all' | 'any' }
  // SpawnManager events (wave-based enemy spawning)
  | { type: 'ENEMY_SPAWNED'; levelId: string; speciesId: string; entityId: string; position: { x: number; y: number; z: number }; facingAngle: number; waveId?: string }
  | { type: 'WAVE_START'; levelId: string; waveNumber: number; label?: string }
  | { type: 'WAVE_COMPLETE'; levelId: string; waveNumber: number }
  | { type: 'ALL_WAVES_COMPLETE'; levelId: string };

// ---------------------------------------------------------------------------
// Type-safe listener signature
// ---------------------------------------------------------------------------

export type GameEventListener<T extends GameEvent['type']> = (
  event: Extract<GameEvent, { type: T }>,
) => void;

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

/**
 * A lightweight, typed publish/subscribe event bus for decoupling game
 * systems.  Designed as an incremental replacement for the callback chain
 * between levels and React UI contexts.
 *
 * Usage:
 * ```ts
 * const bus = getEventBus();
 * const unsub = bus.on('ENEMY_KILLED', (e) => {
 *   console.log(e.enemyType, e.position);
 * });
 * bus.emit({ type: 'ENEMY_KILLED', position: pos, enemyType: 'drone' });
 * unsub(); // or bus.off('ENEMY_KILLED', handler);
 * ```
 */
export class EventBus {
  /** Internal listener registry keyed by event type. */
  private listeners = new Map<string, Set<Function>>();

  /**
   * Subscribe to a specific event type.
   *
   * @returns An unsubscribe function. Calling it removes the listener.
   */
  on<T extends GameEvent['type']>(
    type: T,
    listener: GameEventListener<T>,
  ): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);

    return () => {
      this.off(type, listener);
    };
  }

  /**
   * Subscribe to a specific event type for a single invocation.  The
   * listener is automatically removed after the first matching event.
   *
   * @returns An unsubscribe function (in case you need to cancel before
   *          the event fires).
   */
  once<T extends GameEvent['type']>(
    type: T,
    listener: GameEventListener<T>,
  ): () => void {
    const wrapper: GameEventListener<T> = (event) => {
      this.off(type, wrapper);
      listener(event);
    };

    return this.on(type, wrapper);
  }

  /**
   * Manually remove a previously registered listener.
   */
  off<T extends GameEvent['type']>(
    type: T,
    listener: GameEventListener<T>,
  ): void {
    const set = this.listeners.get(type);
    if (!set) return;

    set.delete(listener);

    // Clean up empty sets so the Map does not grow unboundedly.
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  /**
   * Dispatch an event to all registered listeners for its type.
   */
  emit(event: GameEvent): void {
    const set = this.listeners.get(event.type);

    if (!set || set.size === 0) {
      if (import.meta.env.DEV) {
        log.warn(
          `No listeners registered for event "${event.type}"`,
        );
      }
      return;
    }

    // Iterate over a snapshot so that listeners added/removed during
    // dispatch do not cause unexpected behaviour.
    for (const listener of [...set]) {
      listener(event);
    }
  }

  /**
   * Remove **all** listeners for every event type.  Call this during
   * teardown (e.g. when the game scene is disposed) to avoid leaks.
   */
  clear(): void {
    this.listeners.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton access
// ---------------------------------------------------------------------------

let instance: EventBus | null = null;

/**
 * Return the shared EventBus singleton, creating it on first access.
 */
export function getEventBus(): EventBus {
  if (!instance) {
    instance = new EventBus();
  }
  return instance;
}

/**
 * Dispose the shared EventBus singleton.  Clears all listeners and
 * releases the reference so a fresh instance will be created on the
 * next call to {@link getEventBus}.
 */
export function disposeEventBus(): void {
  if (instance) {
    instance.clear();
    instance = null;
  }
}
