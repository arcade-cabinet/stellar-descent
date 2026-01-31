import React, { useEffect, useMemo, useState } from 'react';
import { useCombat } from '../../game/context/CombatContext';
import { useSettings } from '../../game/context/SettingsContext';
import styles from './Hitmarker.module.css';

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
      {type === 'critical' && (
        <div className={styles.criticalFlash} />
      )}
    </div>
  );
}

/**
 * HitmarkerDisplay - Container component that manages multiple hitmarkers
 * Integrates with CombatContext for automatic display
 *
 * This component automatically renders hitmarkers based on the hitMarkers
 * array from CombatContext. It handles:
 * - Normal hits (white X)
 * - Critical hits (red X, slightly larger)
 * - Kill confirmations (large red X with + icon)
 *
 * Can be toggled via the showHitmarkers setting.
 */
export function HitmarkerDisplay() {
  const { hitMarkers, removeHitMarker } = useCombat();
  const { settings } = useSettings();

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
      const currentTime = performance.now();
      hitMarkers.forEach((marker) => {
        let duration = HIT_DURATION;
        if (marker.isKill) {
          duration = KILL_DURATION;
        } else if (marker.isCritical) {
          duration = CRITICAL_DURATION;
        }

        if (currentTime - marker.timestamp > duration) {
          removeHitMarker(marker.id);
        }
      });
    }, 50);

    return () => clearInterval(interval);
  }, [hitMarkers, removeHitMarker]);

  // Don't render if hitmarkers are disabled in settings
  if (!settings.showHitmarkers) {
    return null;
  }

  if (hitMarkers.length === 0) {
    return null;
  }

  return (
    <div className={styles.hitmarkerContainer} aria-hidden="true">
      {hitMarkers.map((marker) => {
        const type: HitmarkerType = marker.isKill
          ? 'kill'
          : marker.isCritical
            ? 'critical'
            : 'hit';

        return (
          <div
            key={marker.id}
            className={[
              styles.hitmarker,
              styles[type],
              prefersReducedMotion ? styles.reducedMotion : '',
            ].filter(Boolean).join(' ')}
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
            {type === 'critical' && (
              <div className={styles.criticalFlash} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Hitmarker;
