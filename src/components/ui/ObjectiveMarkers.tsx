import { useMemo } from 'react';
import { type ScreenSpaceObjective, useGame } from '../../game/context/GameContext';
import styles from './ObjectiveMarkers.module.css';

/**
 * Edge-of-screen objective markers
 * Shows directional indicators when objectives are off-screen
 * Displays distance and pulses when close
 */
export function ObjectiveMarkers() {
  const { screenSpaceObjectives, hudVisibility } = useGame();

  // Only show markers that are off-screen and in front of camera
  const edgeMarkers = useMemo(() => {
    return screenSpaceObjectives.filter((obj) => !obj.isOnScreen && obj.isInFront);
  }, [screenSpaceObjectives]);

  // Don't render if compass/markers are hidden
  if (!hudVisibility.compass) {
    return null;
  }

  return (
    <div className={styles.markersContainer} aria-label="Objective markers">
      {edgeMarkers.map((objective) => (
        <EdgeMarker key={objective.id} objective={objective} />
      ))}
    </div>
  );
}

interface EdgeMarkerProps {
  objective: ScreenSpaceObjective;
}

/**
 * Individual edge marker that positions itself at screen edge
 * pointing toward the objective
 */
function EdgeMarker({ objective }: EdgeMarkerProps) {
  // Calculate edge position and rotation
  const { position, rotation, edge } = useMemo(() => {
    // Normalize to viewport coordinates (-1 to 1)
    const x = objective.screenX;
    const y = objective.screenY;

    // Calculate angle from center to objective
    const angle = Math.atan2(y, x);
    const rotationDeg = (angle * 180) / Math.PI + 90; // +90 to point arrow outward

    // Determine which edge the marker should be on
    // Account for aspect ratio (viewport is not square)
    const aspectRatio = window.innerWidth / window.innerHeight;
    const normalizedX = x / aspectRatio;

    let edgeX: number;
    let edgeY: number;
    let edgeName: 'top' | 'bottom' | 'left' | 'right';

    // Project point to edge along the line from center
    const absX = Math.abs(normalizedX);
    const absY = Math.abs(y);

    if (absX > absY) {
      // Left or right edge
      edgeX = x > 0 ? 1 : -1;
      edgeY = y / absX;
      edgeName = x > 0 ? 'right' : 'left';
    } else {
      // Top or bottom edge
      edgeY = y > 0 ? 1 : -1;
      edgeX = normalizedX / absY;
      edgeName = y > 0 ? 'bottom' : 'top';
    }

    // Convert to percentage positions with padding
    const padding = 48; // pixels from edge
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;

    // Clamp position to stay within padding
    let posX = halfWidth + edgeX * (halfWidth - padding);
    let posY = halfHeight + edgeY * (halfHeight - padding);

    // Clamp to valid screen area
    posX = Math.max(padding, Math.min(window.innerWidth - padding, posX));
    posY = Math.max(padding, Math.min(window.innerHeight - padding, posY));

    return {
      position: { x: posX, y: posY },
      rotation: rotationDeg,
      edge: edgeName,
    };
  }, [objective.screenX, objective.screenY]);

  // Format distance for display
  const formattedDistance = useMemo(() => {
    if (objective.distance >= 1000) {
      return `${(objective.distance / 1000).toFixed(1)}km`;
    }
    return `${Math.round(objective.distance)}m`;
  }, [objective.distance]);

  // Determine if objective is close (for pulse animation)
  const isClose = objective.distance < 50;
  const isMedium = objective.distance < 200;

  // Get marker color based on type
  const getTypeClass = () => {
    switch (objective.type) {
      case 'main':
        return styles.main;
      case 'interact':
        return styles.interact;
      case 'optional':
        return styles.optional;
      case 'waypoint':
        return styles.waypoint;
      default:
        return styles.main;
    }
  };

  const markerClasses = [
    styles.edgeMarker,
    getTypeClass(),
    isClose ? styles.close : '',
    isMedium && !isClose ? styles.medium : '',
    styles[edge],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={markerClasses}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      aria-label={`${objective.label || objective.type} objective, ${formattedDistance}`}
    >
      {/* Arrow pointing toward objective */}
      <div className={styles.arrow} style={{ transform: `rotate(${rotation}deg)` }}>
        <svg viewBox="0 0 24 24" className={styles.arrowSvg}>
          <path d="M12 4 L18 14 L12 11 L6 14 Z" fill="currentColor" />
        </svg>
      </div>

      {/* Distance indicator */}
      <div className={styles.distance}>{formattedDistance}</div>

      {/* Optional label */}
      {objective.label && <div className={styles.label}>{objective.label}</div>}
    </div>
  );
}
