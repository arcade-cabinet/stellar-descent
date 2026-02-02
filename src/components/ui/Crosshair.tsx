import { useEffect, useState } from 'react';
import { usePlayer } from '../../game/context/GameContext';
import { useCombatStore } from '../../game/stores/useCombatStore';
import styles from './Crosshair.module.css';

export interface CrosshairState {
  isHovering: boolean; // Hovering over an enemy
  isFiring: boolean; // Currently firing weapon
  isHit: boolean; // Just hit an enemy
}

interface CrosshairProps {
  /** External state for hover/fire/hit effects */
  state?: CrosshairState;
}

/**
 * Tactical crosshair component for combat phases.
 * Features:
 * - Center dot with surrounding lines
 * - Color changes: white (default) -> amber (hover) -> red (hit)
 * - Expands slightly when firing
 * - Hidden during non-combat phases via hudVisibility
 */
export function Crosshair({ state }: CrosshairProps) {
  const { hudVisibility } = usePlayer();
  const inCombat = useCombatStore((s) => s.inCombat);
  const [localFiring, setLocalFiring] = useState(false);
  const [localHit, setLocalHit] = useState(false);

  // Use external state or internal defaults
  const isHovering = state?.isHovering ?? false;
  const isFiring = state?.isFiring ?? localFiring;
  const isHit = state?.isHit ?? localHit;

  // Determine crosshair color based on state
  const getColorClass = () => {
    if (isHit) return styles.hit;
    if (isHovering) return styles.hover;
    return '';
  };

  // Listen for global firing events (mouse clicks when pointer locked)
  useEffect(() => {
    if (!inCombat) return;

    const handleMouseDown = () => {
      setLocalFiring(true);
    };

    const handleMouseUp = () => {
      setLocalFiring(false);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [inCombat]);

  // Auto-clear hit state after brief flash
  useEffect(() => {
    if (state?.isHit) {
      const timeout = setTimeout(() => {
        setLocalHit(false);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [state?.isHit]);

  // Don't render if crosshair is hidden in HUD visibility settings
  if (!hudVisibility.crosshair) {
    return null;
  }

  const containerClasses = [styles.crosshair, isFiring ? styles.firing : '', getColorClass()]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses} role="presentation" aria-hidden="true">
      {/* Center dot */}
      <div className={styles.dot} />

      {/* Crosshair lines */}
      <div className={`${styles.line} ${styles.top}`} />
      <div className={`${styles.line} ${styles.bottom}`} />
      <div className={`${styles.line} ${styles.left}`} />
      <div className={`${styles.line} ${styles.right}`} />

      {/* Optional: outer ring for hit feedback */}
      {isHit && <div className={styles.hitRing} />}
    </div>
  );
}

/**
 * Hook for managing crosshair state from game logic.
 * Call setHovering/setFiring/triggerHit from combat systems.
 */
export function useCrosshairState() {
  const [state, setState] = useState<CrosshairState>({
    isHovering: false,
    isFiring: false,
    isHit: false,
  });

  const setHovering = (hovering: boolean) => {
    setState((prev) => ({ ...prev, isHovering: hovering }));
  };

  const setFiring = (firing: boolean) => {
    setState((prev) => ({ ...prev, isFiring: firing }));
  };

  const triggerHit = () => {
    setState((prev) => ({ ...prev, isHit: true }));
    // Auto-clear after animation
    setTimeout(() => {
      setState((prev) => ({ ...prev, isHit: false }));
    }, 150);
  };

  return {
    state,
    setHovering,
    setFiring,
    triggerHit,
  };
}
