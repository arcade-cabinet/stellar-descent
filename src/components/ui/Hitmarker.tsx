import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../../game/stores/useSettingsStore';
import { useGameEvent } from '../../hooks/useGameEvent';
import styles from './Hitmarker.module.css';

/**
 * HitMarker data structure for EventBus-driven markers
 */
interface EventBusHitMarker {
  id: number;
  isCritical: boolean;
  isKill: boolean;
  damage: number;
  timestamp: number;
}

/**
 * Hit marker type determines the visual style
 */
export type HitmarkerType = 'hit' | 'critical' | 'kill';

/**
 * Props for the individual Hitmarker component
 */
interface HitmarkerProps {
  /** The type of hitmarker to display */
  type: HitmarkerType;
  /** Whether the hitmarker is visible */
  visible: boolean;
  /** Optional callback when animation completes */
  onComplete?: () => void;
}

/**
 * Individual hitmarker visual component
 * Displays an X-shaped marker at screen center with type-based styling
 *
 * Usage:
 * - type 'hit': White X marker (normal damage)
 * - type 'critical': Red X marker with slight size increase
 * - type 'kill': Larger red X with plus icon
 * - Duration: 100-200ms with fade out
 */
export function Hitmarker({ type, visible, onComplete }: HitmarkerProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const { settings } = useSettings();

  // Start animation when visible
  useEffect(() => {
    if (visible) {
      setIsAnimating(true);

      // Duration based on type
      const duration = type === 'kill' ? 300 : type === 'critical' ? 200 : 150;

      const timer = setTimeout(() => {
        setIsAnimating(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, type, onComplete]);

  // Determine if we should use reduced animations
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || settings.reduceMotion;
  }, [settings.reduceMotion]);

  if (!visible && !isAnimating) {
    return null;
  }

  const containerClasses = [
    styles.hitmarker,
    styles[type],
    prefersReducedMotion ? styles.reducedMotion : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="presentation" aria-hidden="true">
      {/* X-shaped marker lines */}
      <div className={styles.line1} />
      <div className={styles.line2} />

      {/* Kill indicator - plus icon for confirmed kills */}
      {type === 'kill' && (
        <div className={styles.killIndicator}>
          <span className={styles.killIcon}>+</span>
        </div>
      )}

      {/* Critical hit flash effect */}
      {type === 'critical' && <div className={styles.criticalFlash} />}
    </div>
  );
}

/**
 * HitmarkerDisplay - Container component that manages multiple hitmarkers
 * Renders hitmarkers based on EventBus events.
 *
 * This component automatically renders hitmarkers based on:
 * - PROJECTILE_IMPACT and ENEMY_KILLED events from EventBus
 *
 * It handles:
 * - Normal hits (white X)
 * - Critical hits (red X, slightly larger)
 * - Kill confirmations (large red X with + icon)
 *
 * Can be toggled via the showHitmarkers setting.
 */
export function HitmarkerDisplay() {
  const { settings } = useSettings();

  // All hit markers are EventBus-driven (CombatContext removed)
  const [markers, setMarkers] = useState<EventBusHitMarker[]>([]);
  const markerIdRef = useRef(0);

  // Subscribe to PROJECTILE_IMPACT events for hit markers
  useGameEvent('PROJECTILE_IMPACT', (event) => {
    const id = markerIdRef.current++;
    const newMarker: EventBusHitMarker = {
      id,
      damage: event.damage,
      isCritical: event.isCritical,
      isKill: false,
      timestamp: performance.now(),
    };
    setMarkers((prev) => [...prev, newMarker]);
  });

  // Subscribe to ENEMY_KILLED events for kill markers
  useGameEvent('ENEMY_KILLED', () => {
    const id = markerIdRef.current++;
    const newMarker: EventBusHitMarker = {
      id,
      damage: 0,
      isCritical: false,
      isKill: true,
      timestamp: performance.now(),
    };
    setMarkers((prev) => [...prev, newMarker]);
  });

  // Determine if we should use reduced animations
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches || settings.reduceMotion;
  }, [settings.reduceMotion]);

  // Remove expired hit markers
  useEffect(() => {
    const HIT_DURATION = 150;
    const CRITICAL_DURATION = 200;
    const KILL_DURATION = 300;

    const interval = setInterval(() => {
      const now = performance.now();
      setMarkers((prev) =>
        prev.filter((marker) => {
          let duration = HIT_DURATION;
          if (marker.isKill) duration = KILL_DURATION;
          else if (marker.isCritical) duration = CRITICAL_DURATION;
          return now - marker.timestamp < duration;
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Don't render if hitmarkers are disabled in settings
  if (!settings.showHitmarkers) {
    return null;
  }

  if (markers.length === 0) {
    return null;
  }

  return (
    <div className={styles.hitmarkerContainer} aria-hidden="true">
      {markers.map((marker) => {
        const type: HitmarkerType = marker.isKill ? 'kill' : marker.isCritical ? 'critical' : 'hit';

        return (
          <div
            key={`marker-${marker.id}`}
            className={[
              styles.hitmarker,
              styles[type],
              prefersReducedMotion ? styles.reducedMotion : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* X-shaped marker lines */}
            <div className={styles.line1} />
            <div className={styles.line2} />

            {/* Kill indicator */}
            {type === 'kill' && (
              <div className={styles.killIndicator}>
                <span className={styles.killIcon}>+</span>
              </div>
            )}

            {/* Critical flash */}
            {type === 'critical' && <div className={styles.criticalFlash} />}
          </div>
        );
      })}
    </div>
  );
}

export default Hitmarker;
