import React, { useMemo } from 'react';
import styles from './Compass.module.css';

interface CompassProps {
  /** Player heading in radians (0 = North, positive = clockwise) */
  heading: number;
  /** Optional objective position for marker arrow */
  objectiveDirection?: number;
  /** Optional distance to objective in meters */
  objectiveDistance?: number;
  /** Whether compass is visible */
  visible?: boolean;
}

/**
 * Military-style compass HUD element
 * Shows cardinal directions (N/S/E/W) and an objective marker arrow
 */
export function Compass({
  heading,
  objectiveDirection,
  objectiveDistance,
  visible = true,
}: CompassProps) {
  // Convert heading to degrees (0-360)
  const headingDegrees = useMemo(() => {
    // Normalize to 0-360 range
    let deg = ((heading * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    return deg;
  }, [heading]);

  // Calculate objective arrow rotation relative to player heading
  const objectiveArrowRotation = useMemo(() => {
    if (objectiveDirection === undefined) return null;
    // Direction from player to objective minus player heading
    let relativeAngle = objectiveDirection - heading;
    // Normalize to -PI to PI for display
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;
    return (relativeAngle * 180) / Math.PI;
  }, [heading, objectiveDirection]);

  // Format distance for display
  const formattedDistance = useMemo(() => {
    if (objectiveDistance === undefined) return null;
    if (objectiveDistance >= 1000) {
      return `${(objectiveDistance / 1000).toFixed(1)}km`;
    }
    return `${Math.round(objectiveDistance)}m`;
  }, [objectiveDistance]);

  // Cardinal direction markers with positions
  const cardinalMarkers = useMemo(() => {
    const markers = [
      { label: 'N', angle: 0 },
      { label: 'NE', angle: 45 },
      { label: 'E', angle: 90 },
      { label: 'SE', angle: 135 },
      { label: 'S', angle: 180 },
      { label: 'SW', angle: 225 },
      { label: 'W', angle: 270 },
      { label: 'NW', angle: 315 },
    ];

    return markers.map((marker) => {
      // Calculate position relative to current heading
      // The marker should appear at the position based on (marker.angle - heading)
      let relativeAngle = marker.angle - headingDegrees;
      // Normalize to -180 to 180
      while (relativeAngle > 180) relativeAngle -= 360;
      while (relativeAngle < -180) relativeAngle += 360;

      // Only show markers within view range (-90 to 90 degrees)
      const inView = Math.abs(relativeAngle) <= 90;

      // Map -90 to 90 degrees to 0% to 100% position
      const position = ((relativeAngle + 90) / 180) * 100;

      return {
        ...marker,
        relativeAngle,
        position,
        inView,
        isCardinal: ['N', 'E', 'S', 'W'].includes(marker.label),
      };
    });
  }, [headingDegrees]);

  // Degree tick marks
  const tickMarks = useMemo(() => {
    const ticks: { angle: number; position: number; major: boolean }[] = [];
    // Generate ticks every 15 degrees
    for (let angle = 0; angle < 360; angle += 15) {
      let relativeAngle = angle - headingDegrees;
      while (relativeAngle > 180) relativeAngle -= 360;
      while (relativeAngle < -180) relativeAngle += 360;

      if (Math.abs(relativeAngle) <= 90) {
        const position = ((relativeAngle + 90) / 180) * 100;
        const major = angle % 45 === 0;
        ticks.push({ angle, position, major });
      }
    }
    return ticks;
  }, [headingDegrees]);

  if (!visible) return null;

  return (
    <div className={styles.compassContainer} aria-label="Navigation compass">
      {/* Compass strip background */}
      <div className={styles.compassStrip}>
        {/* Tick marks */}
        {tickMarks.map((tick) => (
          <div
            key={`tick-${tick.angle}`}
            className={`${styles.tickMark} ${tick.major ? styles.major : ''}`}
            style={{ left: `${tick.position}%` }}
          />
        ))}

        {/* Cardinal direction labels */}
        {cardinalMarkers.map(
          (marker) =>
            marker.inView && (
              <div
                key={marker.label}
                className={`${styles.cardinalLabel} ${marker.isCardinal ? styles.primary : styles.secondary}`}
                style={{ left: `${marker.position}%` }}
              >
                {marker.label}
              </div>
            )
        )}

        {/* Center indicator */}
        <div className={styles.centerIndicator}>
          <div className={styles.centerTriangle} />
        </div>
      </div>

      {/* Heading readout */}
      <div className={styles.headingReadout}>
        <span className={styles.headingValue}>
          {Math.round(headingDegrees).toString().padStart(3, '0')}
        </span>
        <span className={styles.headingUnit}>DEG</span>
      </div>

      {/* Objective marker */}
      {objectiveArrowRotation !== null && (
        <div className={styles.objectiveContainer}>
          <div
            className={styles.objectiveArrow}
            style={{ transform: `rotate(${objectiveArrowRotation}deg)` }}
            aria-label={`Objective ${formattedDistance || ''}`}
          >
            <svg viewBox="0 0 24 24" className={styles.arrowSvg}>
              <path d="M12 2 L20 20 L12 16 L4 20 Z" fill="currentColor" />
            </svg>
          </div>
          {formattedDistance && (
            <span className={styles.objectiveDistance}>{formattedDistance}</span>
          )}
        </div>
      )}
    </div>
  );
}
