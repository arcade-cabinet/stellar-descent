import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../game/context/GameContext';
import { useSettings } from '../../game/context/SettingsContext';
import { getAudioManager } from '../../game/core/AudioManager';
import styles from './DamageIndicators.module.css';

/**
 * Directional damage indicator data
 */
export interface DamageIndicator {
  id: number;
  /** Angle in radians (0 = front, PI/2 = right, PI = back, -PI/2 = left) */
  angle: number;
  /** Damage amount (affects intensity) */
  damage: number;
  /** Time created */
  timestamp: number;
}

/**
 * Hit marker data for dealing damage
 */
export interface HitMarker {
  id: number;
  /** Whether this was a critical/headshot */
  isCritical: boolean;
  /** Damage dealt */
  damage: number;
  /** Time created */
  timestamp: number;
}

/**
 * DamageIndicators - Comprehensive damage feedback UI system
 *
 * Features:
 * - Directional damage indicators showing where damage came from
 * - Screen vignette/flash on taking damage
 * - Hit markers when dealing damage (with critical hit variant)
 * - Low health heartbeat/warning effects
 * - All effects support reduced motion preferences
 */
export function DamageIndicators() {
  const {
    playerHealth,
    maxHealth,
    damageIndicators,
    hitMarkers,
    removeDamageIndicator,
    removeHitMarker,
    damageFlash,
  } = useGame();
  const { settings } = useSettings();

  // Calculate health percentage
  const healthPercent =
    maxHealth > 0 ? Math.max(0, Math.min(100, (playerHealth / maxHealth) * 100)) : 100;
  const isLowHealth = healthPercent <= 25;
  const isCriticalHealth = healthPercent <= 10;

  // Track heartbeat audio
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatRef = useRef<number>(0);

  // Low health heartbeat audio
  useEffect(() => {
    if (isLowHealth && playerHealth > 0) {
      // Calculate heartbeat interval based on health (faster when lower)
      const interval = isCriticalHealth ? 400 : 800;
      const now = performance.now();

      // Don't play if we just played recently
      if (now - lastHeartbeatRef.current < interval * 0.8) {
        return;
      }

      // Clear existing interval
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }

      // Start heartbeat
      const playHeartbeat = () => {
        lastHeartbeatRef.current = performance.now();
        // Use player_damage sound as heartbeat (could add dedicated heartbeat sound)
        getAudioManager().play('player_damage', { volume: isCriticalHealth ? 0.2 : 0.1 });
      };

      // Play immediately then on interval
      playHeartbeat();
      heartbeatRef.current = setInterval(playHeartbeat, interval);

      return () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
      };
    } else {
      // Clear heartbeat when health is restored
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }
  }, [isLowHealth, isCriticalHealth, playerHealth]);

  // Remove expired damage indicators
  useEffect(() => {
    const INDICATOR_DURATION = 1000; // 1 second
    const now = performance.now();

    damageIndicators.forEach((indicator) => {
      if (now - indicator.timestamp > INDICATOR_DURATION) {
        removeDamageIndicator(indicator.id);
      }
    });

    // Set up cleanup interval
    const interval = setInterval(() => {
      const currentTime = performance.now();
      damageIndicators.forEach((indicator) => {
        if (currentTime - indicator.timestamp > INDICATOR_DURATION) {
          removeDamageIndicator(indicator.id);
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [damageIndicators, removeDamageIndicator]);

  // Remove expired hit markers
  useEffect(() => {
    const HIT_MARKER_DURATION = 200; // 200ms for snappy feedback
    const CRITICAL_HIT_DURATION = 400; // Longer for criticals

    const interval = setInterval(() => {
      const currentTime = performance.now();
      hitMarkers.forEach((marker) => {
        const duration = marker.isCritical ? CRITICAL_HIT_DURATION : HIT_MARKER_DURATION;
        if (currentTime - marker.timestamp > duration) {
          removeHitMarker(marker.id);
        }
      });
    }, 50);

    return () => clearInterval(interval);
  }, [hitMarkers, removeHitMarker]);

  // Convert angle to screen position for directional indicators
  const getIndicatorStyle = useCallback((indicator: DamageIndicator) => {
    // Calculate intensity based on damage (more damage = more visible)
    const intensity = Math.min(1, 0.4 + (indicator.damage / 50) * 0.6);
    // Calculate fade based on age
    const age = performance.now() - indicator.timestamp;
    const fade = Math.max(0, 1 - age / 1000);

    // Convert angle to rotation for the indicator
    // Angle 0 = damage from front, PI = from back, etc.
    // We want to show the indicator pointing TO the source
    const rotation = (indicator.angle * 180) / Math.PI;

    return {
      '--indicator-rotation': `${rotation}deg`,
      '--indicator-opacity': intensity * fade,
    } as React.CSSProperties;
  }, []);

  // Determine if we should use reduced animations
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  return (
    <div className={styles.damageIndicators} aria-hidden="true">
      {/* Damage vignette - red border when taking damage */}
      {damageFlash && (
        <div
          className={`${styles.damageVignette} ${prefersReducedMotion ? styles.reducedMotion : ''}`}
        />
      )}

      {/* Low health vignette - persistent when health is low */}
      {isLowHealth && playerHealth > 0 && (
        <div
          className={`${styles.lowHealthVignette} ${isCriticalHealth ? styles.critical : ''} ${
            prefersReducedMotion ? styles.reducedMotion : ''
          }`}
        />
      )}

      {/* Low health heartbeat pulse overlay */}
      {isLowHealth && playerHealth > 0 && !prefersReducedMotion && (
        <div className={`${styles.heartbeatPulse} ${isCriticalHealth ? styles.critical : ''}`} />
      )}

      {/* Directional damage indicators */}
      <div className={styles.directionalIndicators}>
        {damageIndicators.map((indicator) => (
          <div
            key={indicator.id}
            className={`${styles.directionalIndicator} ${
              prefersReducedMotion ? styles.reducedMotion : ''
            }`}
            style={getIndicatorStyle(indicator)}
          />
        ))}
      </div>

      {/* Hit markers - center of screen */}
      {hitMarkers.length > 0 && (
        <div className={styles.hitMarkerContainer}>
          {hitMarkers.map((marker) => (
            <div
              key={marker.id}
              className={`${styles.hitMarker} ${marker.isCritical ? styles.critical : ''} ${
                prefersReducedMotion ? styles.reducedMotion : ''
              }`}
            >
              {/* X-shaped hit marker */}
              <div className={styles.hitMarkerLine1} />
              <div className={styles.hitMarkerLine2} />
              {/* Critical hit indicator */}
              {marker.isCritical && (
                <div className={styles.criticalIndicator}>
                  <span className={styles.criticalText}>CRITICAL</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Low health warning text */}
      {isCriticalHealth && playerHealth > 0 && (
        <div
          className={`${styles.warningText} ${prefersReducedMotion ? styles.reducedMotion : ''}`}
        >
          <span className={styles.warningIcon}>!</span>
          <span>CRITICAL DAMAGE</span>
        </div>
      )}
    </div>
  );
}
