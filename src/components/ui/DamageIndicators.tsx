import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../game/context/GameContext';
import { getAudioManager } from '../../game/core/AudioManager';
import { useSettings } from '../../game/stores/useSettingsStore';
import { useGameEvent } from '../../hooks/useGameEvent';
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
  /** Whether this hit resulted in a kill */
  isKill: boolean;
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

  // EventBus-driven state (supplements context for self-contained operation)
  const [eventBusDamageFlash, setEventBusDamageFlash] = useState(false);
  const [eventBusDamageIndicators, setEventBusDamageIndicators] = useState<DamageIndicator[]>([]);
  const [eventBusHitMarkers, setEventBusHitMarkers] = useState<HitMarker[]>([]);
  const eventBusIndicatorIdRef = useRef(0);
  const eventBusHitMarkerIdRef = useRef(0);
  const damageFlashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to PLAYER_DAMAGED events for damage flash and directional indicators
  useGameEvent('PLAYER_DAMAGED', (event) => {
    // Trigger damage flash
    setEventBusDamageFlash(true);

    if (damageFlashTimeoutRef.current) {
      clearTimeout(damageFlashTimeoutRef.current);
    }
    damageFlashTimeoutRef.current = setTimeout(() => {
      setEventBusDamageFlash(false);
    }, 300);

    // Add directional damage indicator if direction is provided
    if (event.direction !== undefined) {
      const id = eventBusIndicatorIdRef.current++;
      const newIndicator: DamageIndicator = {
        id,
        angle: event.direction,
        damage: event.amount,
        timestamp: performance.now(),
      };
      setEventBusDamageIndicators((prev) => [...prev, newIndicator]);
    }
  });

  // Subscribe to PROJECTILE_IMPACT events for hit markers
  useGameEvent('PROJECTILE_IMPACT', (event) => {
    const id = eventBusHitMarkerIdRef.current++;
    const newMarker: HitMarker = {
      id,
      damage: event.damage,
      isCritical: event.isCritical,
      isKill: false,
      timestamp: performance.now(),
    };
    setEventBusHitMarkers((prev) => [...prev, newMarker]);
  });

  // Subscribe to ENEMY_KILLED events for kill markers
  useGameEvent('ENEMY_KILLED', () => {
    const id = eventBusHitMarkerIdRef.current++;
    const newMarker: HitMarker = {
      id,
      damage: 0,
      isCritical: false,
      isKill: true,
      timestamp: performance.now(),
    };
    setEventBusHitMarkers((prev) => [...prev, newMarker]);
  });

  // Clean up EventBus damage indicators
  useEffect(() => {
    const INDICATOR_DURATION = 1000;
    const interval = setInterval(() => {
      const now = performance.now();
      setEventBusDamageIndicators((prev) =>
        prev.filter((indicator) => now - indicator.timestamp < INDICATOR_DURATION)
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Clean up EventBus hit markers
  useEffect(() => {
    const HIT_DURATION = 150;
    const CRITICAL_DURATION = 200;
    const KILL_DURATION = 300;

    const interval = setInterval(() => {
      const now = performance.now();
      setEventBusHitMarkers((prev) =>
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

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (damageFlashTimeoutRef.current) {
        clearTimeout(damageFlashTimeoutRef.current);
      }
    };
  }, []);

  // Combine context and EventBus state
  const effectiveDamageFlash = damageFlash || eventBusDamageFlash;
  const effectiveDamageIndicators = [...damageIndicators, ...eventBusDamageIndicators];
  const effectiveHitMarkers = [...hitMarkers, ...eventBusHitMarkers];

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
    const HIT_MARKER_DURATION = 150; // 150ms for snappy feedback
    const CRITICAL_HIT_DURATION = 200; // Slightly longer for criticals
    const KILL_MARKER_DURATION = 300; // Longest for kills

    const interval = setInterval(() => {
      const currentTime = performance.now();
      hitMarkers.forEach((marker) => {
        let duration = HIT_MARKER_DURATION;
        if (marker.isKill) {
          duration = KILL_MARKER_DURATION;
        } else if (marker.isCritical) {
          duration = CRITICAL_HIT_DURATION;
        }
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
      {effectiveDamageFlash && (
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
        {effectiveDamageIndicators.map((indicator) => (
          <div
            key={`indicator-${indicator.id}`}
            className={`${styles.directionalIndicator} ${
              prefersReducedMotion ? styles.reducedMotion : ''
            }`}
            style={getIndicatorStyle(indicator)}
          />
        ))}
      </div>

      {/* Hit markers - center of screen */}
      {settings.showHitmarkers && effectiveHitMarkers.length > 0 && (
        <div className={styles.hitMarkerContainer}>
          {effectiveHitMarkers.map((marker) => {
            // Determine marker type class
            const typeClass = marker.isKill
              ? styles.kill
              : marker.isCritical
                ? styles.critical
                : '';

            return (
              <div
                key={`marker-${marker.id}`}
                className={`${styles.hitMarker} ${typeClass} ${
                  prefersReducedMotion ? styles.reducedMotion : ''
                }`}
              >
                {/* X-shaped hit marker */}
                <div className={styles.hitMarkerLine1} />
                <div className={styles.hitMarkerLine2} />
                {/* Kill indicator */}
                {marker.isKill && (
                  <div className={styles.killIndicator}>
                    <span className={styles.killIcon}>+</span>
                  </div>
                )}
                {/* Critical hit indicator (only if not a kill) */}
                {marker.isCritical && !marker.isKill && (
                  <div className={styles.criticalIndicator}>
                    <span className={styles.criticalText}>CRITICAL</span>
                  </div>
                )}
              </div>
            );
          })}
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
