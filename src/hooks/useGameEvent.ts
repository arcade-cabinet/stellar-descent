import { useCallback, useEffect, useRef } from 'react';

import {
  getEventBus,
  type GameEvent,
  type GameEventListener,
} from '../game/core/EventBus';

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

/** All valid event type strings derived from the GameEvent discriminated union. */
export type GameEventType = GameEvent['type'];

/**
 * Extract the full event payload for a given event type string.
 *
 * @example
 * ```ts
 * type E = GameEventPayload<'ENEMY_KILLED'>;
 * // { type: 'ENEMY_KILLED'; position: Vector3; enemyType: string }
 * ```
 */
export type GameEventPayload<T extends GameEventType> = Extract<
  GameEvent,
  { type: T }
>;

// ---------------------------------------------------------------------------
// useGameEvent
// ---------------------------------------------------------------------------

/**
 * Subscribe a React component to a specific {@link GameEvent} from the
 * shared {@link EventBus}.
 *
 * The subscription is created when the component mounts (or when
 * `eventName` changes) and is automatically cleaned up on unmount.
 *
 * The handler reference is kept stable via `useRef`, so the latest
 * handler closure is always invoked without needing to tear down and
 * recreate the subscription every render.
 *
 * @param eventName - The discriminated-union event type to listen for.
 * @param handler   - Callback invoked with the full typed event payload.
 *
 * @example
 * ```tsx
 * function KillFeed() {
 *   const [kills, setKills] = useState<string[]>([]);
 *
 *   useGameEvent('ENEMY_KILLED', (event) => {
 *     setKills((prev) => [...prev, event.enemyType]);
 *   });
 *
 *   return <ul>{kills.map((k, i) => <li key={i}>{k}</li>)}</ul>;
 * }
 * ```
 */
export function useGameEvent<T extends GameEventType>(
  eventName: T,
  handler: GameEventListener<T>,
): void {
  // Store the latest handler in a ref so the subscription callback never
  // goes stale, even if the consumer passes an inline arrow function that
  // changes every render.
  const handlerRef = useRef<GameEventListener<T>>(handler);

  // Keep the ref current without triggering a re-subscription.
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const bus = getEventBus();

    // The stable listener delegates to whatever is in `handlerRef` at call
    // time.  This avoids tearing down / re-adding the listener when the
    // consumer's handler identity changes.
    const stableListener: GameEventListener<T> = (event) => {
      handlerRef.current(event);
    };

    const unsubscribe = bus.on(eventName, stableListener);

    return () => {
      unsubscribe();
    };
  }, [eventName]);
}

// ---------------------------------------------------------------------------
// useGameEventOnce
// ---------------------------------------------------------------------------

/**
 * Subscribe to a single occurrence of a {@link GameEvent}. The listener is
 * removed after the first matching event fires, or when the component
 * unmounts -- whichever comes first.
 *
 * @param eventName - The event type to listen for.
 * @param handler   - Callback invoked once with the full typed event payload.
 *
 * @example
 * ```tsx
 * useGameEventOnce('CHECKPOINT_REACHED', (event) => {
 *   showToast(`Checkpoint: ${event.checkpointId}`);
 * });
 * ```
 */
export function useGameEventOnce<T extends GameEventType>(
  eventName: T,
  handler: GameEventListener<T>,
): void {
  const handlerRef = useRef<GameEventListener<T>>(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const bus = getEventBus();

    const stableListener: GameEventListener<T> = (event) => {
      handlerRef.current(event);
    };

    const unsubscribe = bus.once(eventName, stableListener);

    return () => {
      unsubscribe();
    };
  }, [eventName]);
}

// ---------------------------------------------------------------------------
// useGameEventEmitter
// ---------------------------------------------------------------------------

/**
 * Returns a stable, memoised `emit` function bound to the shared
 * {@link EventBus}.  Useful when a React component needs to *dispatch*
 * events rather than (or in addition to) listening for them.
 *
 * The returned function has the same signature as `EventBus.emit` and
 * maintains a stable identity across re-renders, making it safe to pass
 * as a prop or include in dependency arrays.
 *
 * @returns A typed emit function: `(event: GameEvent) => void`.
 *
 * @example
 * ```tsx
 * function FireButton() {
 *   const emit = useGameEventEmitter();
 *
 *   const handleClick = () => {
 *     emit({
 *       type: 'WEAPON_FIRED',
 *       weaponId: 'rifle',
 *       position: playerPosition,
 *     });
 *   };
 *
 *   return <button onClick={handleClick}>Fire</button>;
 * }
 * ```
 */
export function useGameEventEmitter(): (event: GameEvent) => void {
  return useCallback((event: GameEvent) => {
    getEventBus().emit(event);
  }, []);
}
