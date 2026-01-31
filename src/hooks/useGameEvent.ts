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
 * Subscribe a React component to one or more {@link GameEvent} types from the
 * shared {@link EventBus}.
 *
 * The subscription is created when the component mounts (or when
 * `eventTypes` changes) and is automatically cleaned up on unmount.
 *
 * The handler reference is kept stable via `useRef`, so the latest
 * handler closure is always invoked without needing to tear down and
 * recreate the subscription every render.
 *
 * @param eventTypes - A single event type or an array of event types to listen for.
 * @param handler    - Callback invoked with the full typed event payload.
 *
 * @example
 * ```tsx
 * // Single event type
 * function KillFeed() {
 *   const [kills, setKills] = useState<string[]>([]);
 *
 *   useGameEvent('ENEMY_KILLED', (event) => {
 *     setKills((prev) => [...prev, event.enemyType]);
 *   });
 *
 *   return <ul>{kills.map((k, i) => <li key={i}>{k}</li>)}</ul>;
 * }
 *
 * // Multiple event types
 * function CombatLog() {
 *   useGameEvent(['ENEMY_KILLED', 'BOSS_DEFEATED'], (event) => {
 *     if (event.type === 'ENEMY_KILLED') {
 *       console.log('Enemy killed:', event.enemyType);
 *     } else {
 *       console.log('Boss defeated:', event.bossType);
 *     }
 *   });
 * }
 * ```
 */
export function useGameEvent<T extends GameEventType>(
  eventTypes: T | T[],
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

  // Normalize to array and create stable key for dependency tracking
  const typesArray = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
  const typesKey = typesArray.join(',');

  useEffect(() => {
    const bus = getEventBus();

    // The stable listener delegates to whatever is in `handlerRef` at call
    // time.  This avoids tearing down / re-adding the listener when the
    // consumer's handler identity changes.
    const stableListener: GameEventListener<T> = (event) => {
      handlerRef.current(event);
    };

    // Subscribe to all event types and collect unsubscribe functions
    const unsubscribers = typesArray.map((eventType) =>
      bus.on(eventType, stableListener),
    );

    return () => {
      // Unsubscribe from all event types on cleanup
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey]);
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
