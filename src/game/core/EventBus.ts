import type { Vector3 } from '@babylonjs/core/Maths/math.vector';

// ---------------------------------------------------------------------------
// Game event types
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: 'ENEMY_KILLED'; position: Vector3; enemyType: string }
  | { type: 'PLAYER_DAMAGED'; amount: number; direction?: number }
  | { type: 'PLAYER_HEALED'; amount: number }
  | { type: 'OBJECTIVE_UPDATED'; title: string; instructions: string }
  | { type: 'OBJECTIVE_COMPLETED'; objectiveId: string }
  | { type: 'COMBAT_STATE_CHANGED'; inCombat: boolean }
  | { type: 'WEAPON_SWITCHED'; weaponId: string }
  | { type: 'WEAPON_FIRED'; weaponId: string; position: Vector3 }
  | { type: 'AMMO_CHANGED'; current: number; max: number }
  | { type: 'COLLECTIBLE_PICKED_UP'; collectibleId: string; collectibleType: string }
  | { type: 'AUDIO_LOG_FOUND'; logId: string }
  | { type: 'SECRET_FOUND'; secretId: string }
  | { type: 'VEHICLE_ENTERED'; vehicleType: string }
  | { type: 'VEHICLE_EXITED'; vehicleType: string }
  | { type: 'CHECKPOINT_REACHED'; checkpointId: string }
  | { type: 'DIALOGUE_STARTED'; triggerId: string }
  | { type: 'DIALOGUE_ENDED'; triggerId: string }
  | { type: 'NOTIFICATION'; text: string; duration?: number };

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
        console.warn(
          `[EventBus] No listeners registered for event "${event.type}"`,
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
