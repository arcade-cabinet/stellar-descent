/**
 * JetpackGauge - HUD component for jetpack fuel display
 *
 * Shows:
 * - Fuel level (vertical bar)
 * - Cooldown state indicator
 * - Boost active animation
 * - Ready/Recharging/Cooldown states
 */

import React, { useEffect, useState } from 'react';
import { getJetpackSystem, type JetpackState } from '../../game/movement';
import styles from './JetpackGauge.module.css';

interface JetpackGaugeProps {
  /** Whether to show the gauge (visibility control) */
  visible?: boolean;
}

export function JetpackGauge({ visible = true }: JetpackGaugeProps) {
  const [fuel, setFuel] = useState(1);
  const [state, setState] = useState<JetpackState>('ready');
  const [cooldownProgress, setCooldownProgress] = useState(0);

  useEffect(() => {
    const jetpack = getJetpackSystem();

    // Set initial state
    setFuel(jetpack.getFuel());
    setState(jetpack.getState());
    setCooldownProgress(jetpack.getCooldownProgress());

    // Subscribe to fuel changes
    jetpack.setOnFuelChange((currentFuel, maxFuel) => {
      setFuel(currentFuel / maxFuel);
    });

    // Subscribe to state changes
    jetpack.setOnStateChange((newState) => {
      setState(newState);
    });

    // Update loop for cooldown progress
    let animationFrame: number;
    const updateCooldown = () => {
      setCooldownProgress(jetpack.getCooldownProgress());
      animationFrame = requestAnimationFrame(updateCooldown);
    };
    animationFrame = requestAnimationFrame(updateCooldown);

    return () => {
      cancelAnimationFrame(animationFrame);
      // Note: Don't clear callbacks here as other components might use them
    };
  }, []);

  if (!visible) {
    return null;
  }

  const fuelPercent = fuel * 100;
  const isBoosting = state === 'boosting';
  const isOnCooldown = state === 'cooldown';
  const isRecharging = state === 'recharging';
  const isReady = state === 'ready' && fuel >= 0.3;
  const isLowFuel = fuel < 0.3 && fuel > 0;

  // Get status color
  const getStatusColor = () => {
    if (isBoosting) return '#ffbf00'; // Amber when active
    if (isOnCooldown) return '#ff4444'; // Red on cooldown
    if (isLowFuel) return '#ff6b35'; // Orange when low
    if (isRecharging) return '#44aaff'; // Blue when recharging
    return '#4caf50'; // Green when ready
  };

  // Get status text
  const getStatusText = () => {
    if (isBoosting) return 'BOOST';
    if (isOnCooldown) return 'COOLDOWN';
    if (isRecharging) return 'CHARGING';
    if (isReady) return 'READY';
    return 'LOW';
  };

  return (
    <div
      className={`${styles.container} ${isOnCooldown ? styles.cooldown : ''} ${isBoosting ? styles.boosting : ''}`}
      role="status"
      aria-label={`Jetpack: ${getStatusText()}, Fuel: ${Math.round(fuelPercent)}%`}
    >
      <div className={styles.header}>
        <span className={styles.label}>JETPACK</span>
        <span className={styles.key}>[SPACE]</span>
      </div>

      <div className={styles.gaugeContainer}>
        {/* Fuel bar */}
        <div className={styles.gauge}>
          <div
            className={`${styles.fuelFill} ${isBoosting ? styles.fuelActive : ''} ${isLowFuel ? styles.fuelLow : ''}`}
            style={{
              height: `${fuelPercent}%`,
              backgroundColor: getStatusColor(),
            }}
          />

          {/* Cooldown overlay */}
          {isOnCooldown && (
            <div
              className={styles.cooldownOverlay}
              style={{ height: `${cooldownProgress * 100}%` }}
            />
          )}

          {/* Segment markers */}
          <div className={styles.segments}>
            <div className={styles.segment} />
            <div className={styles.segment} />
            <div className={styles.segment} />
            <div className={styles.segment} />
          </div>
        </div>

        {/* Thruster icon */}
        <div className={`${styles.thrusterIcon} ${isBoosting ? styles.thrusterActive : ''}`}>
          <div className={styles.thrusterBase} />
          {isBoosting && (
            <div className={styles.thrusterFlame}>
              <div className={styles.flame1} />
              <div className={styles.flame2} />
            </div>
          )}
        </div>
      </div>

      <div className={styles.statusContainer}>
        <span
          className={`${styles.status} ${isBoosting ? styles.statusActive : ''} ${isOnCooldown ? styles.statusCooldown : ''}`}
          style={{ color: getStatusColor() }}
        >
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}
