/**
 * VehicleHUD - React overlay rendered when the player is piloting a vehicle
 *
 * Displays:
 *  - Vehicle shield and health bars
 *  - Speed indicator + altitude (for flying vehicles)
 *  - Active weapon name + heat bar with overheat warning
 *  - Vehicle-specific crosshair
 *  - Minimap with enemy positions
 *  - Passenger manifest
 *  - Exit hint
 *
 * Consumes live data from a VehicleBase instance passed via props.
 * Uses CSS Modules with the same military sci-fi aesthetic as HUD.module.css.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { VehicleBase } from './VehicleBase';
import type { PhantomDropship } from './PhantomDropship';
import styles from './VehicleHUD.module.css';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface EnemyBlip {
  id: string;
  /** Normalised X position relative to player (-1..1) */
  nx: number;
  /** Normalised Z position relative to player (-1..1) */
  nz: number;
}

interface VehicleHUDProps {
  vehicle: VehicleBase;
  /** Enemy positions for minimap (world coords, updated externally) */
  enemies?: { id: string; x: number; z: number }[];
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function VehicleHUD({ vehicle, enemies = [] }: VehicleHUDProps) {
  // Re-render at ~20 fps for HUD data
  const [, setTick] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      frame++;
      // Throttle React re-renders to every 3rd animation frame (~20 fps)
      if (frame % 3 === 0) {
        setTick((t) => t + 1);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // --- Derive HUD data from vehicle ---
  const { stats, weapons, activeWeaponIndex, passengers, displayName, damageState } = vehicle;

  const shieldPct = stats.maxShield > 0
    ? Math.max(0, Math.min(100, (stats.shield / stats.maxShield) * 100))
    : 0;
  const healthPct = stats.maxHealth > 0
    ? Math.max(0, Math.min(100, (stats.health / stats.maxHealth) * 100))
    : 0;

  const activeWeapon = weapons[activeWeaponIndex] ?? null;
  const heatPct = activeWeapon
    ? Math.max(0, Math.min(100, activeWeapon.currentHeat * 100))
    : 0;
  const isOverheated = activeWeapon?.isOverheated ?? false;

  // Flight-specific data (duck-type check for PhantomDropship)
  const isFlying = 'getSpeed' in vehicle && 'getAltitude' in vehicle;
  const speed = isFlying
    ? Math.round((vehicle as PhantomDropship).getSpeed())
    : 0;
  const altitude = isFlying
    ? Math.round((vehicle as PhantomDropship).getAltitude())
    : 0;
  const flightMode = isFlying
    ? (vehicle as PhantomDropship).flightMode
    : null;

  // --- Minimap blips ---
  const MINIMAP_RANGE = 80;
  const vehiclePos = vehicle.position;
  const enemyBlips: EnemyBlip[] = enemies
    .map((e) => {
      const dx = e.x - vehiclePos.x;
      const dz = e.z - vehiclePos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > MINIMAP_RANGE) return null;
      return {
        id: e.id,
        nx: dx / MINIMAP_RANGE,
        nz: dz / MINIMAP_RANGE,
      };
    })
    .filter((b): b is EnemyBlip => b !== null);

  return (
    <div className={styles.vehicleHud} aria-label="Vehicle heads-up display">
      {/* ---- Header ---- */}
      <div className={styles.vehicleHeader}>
        <span className={styles.vehicleName}>{displayName}</span>
        {flightMode && (
          <span className={styles.flightMode}>
            {flightMode === 'hover' ? 'HOVER' : 'FORWARD FLIGHT'}
          </span>
        )}
      </div>

      {/* ---- Left panel: Shield / Health ---- */}
      <div className={styles.leftPanel}>
        {/* Shield */}
        {stats.maxShield > 0 && (
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>SHIELD</span>
            <div className={styles.barOuter}>
              <div
                className={`${styles.barFill} ${styles.fillShield}`}
                style={{ width: `${shieldPct}%` }}
              />
              <span className={styles.barText}>
                {Math.round(stats.shield)}/{stats.maxShield}
              </span>
            </div>
          </div>
        )}

        {/* Health */}
        <div className={styles.statGroup}>
          <span className={styles.statLabel}>HULL INTEGRITY</span>
          <div className={styles.barOuter}>
            <div
              className={`${styles.barFill} ${healthPct <= 25 ? styles.fillHealthLow : styles.fillHealth}`}
              style={{ width: `${healthPct}%` }}
            />
            <span className={styles.barText}>
              {Math.round(stats.health)}/{stats.maxHealth}
            </span>
          </div>
        </div>

        {/* Weapon heat */}
        {activeWeapon && (
          <div className={styles.statGroup}>
            <span className={styles.statLabel}>WEAPON HEAT</span>
            <div className={`${styles.barOuter} ${styles.weaponHeatBar}`}>
              <div
                className={`${styles.barFill} ${isOverheated ? styles.fillHeatOverheat : styles.fillHeat}`}
                style={{ width: `${heatPct}%` }}
              />
            </div>
            {isOverheated && (
              <span className={styles.overheatWarning}>OVERHEAT</span>
            )}
          </div>
        )}
      </div>

      {/* ---- Right panel: Speed / Altitude / Weapon ---- */}
      <div className={styles.rightPanel}>
        {isFlying && (
          <>
            <div className={styles.speedDisplay}>
              <span className={styles.speedValue}>{speed}</span>
              <span className={styles.speedUnit}>M/S</span>
            </div>
            <div className={styles.altitudeDisplay}>
              <span className={styles.altitudeValue}>{altitude}</span>
              <span className={styles.altitudeUnit}>ALT</span>
            </div>
          </>
        )}

        {activeWeapon && (
          <div className={styles.weaponDisplay}>
            <span className={styles.weaponName}>{activeWeapon.name}</span>
          </div>
        )}
      </div>

      {/* ---- Vehicle crosshair ---- */}
      <div className={styles.vehicleCrosshair} aria-hidden="true">
        <div className={styles.crosshairRing} />
        <div className={styles.crosshairDot} />
        <div className={`${styles.crosshairTick} ${styles.crosshairTickTop}`} />
        <div className={`${styles.crosshairTick} ${styles.crosshairTickBottom}`} />
        <div className={`${styles.crosshairTick} ${styles.crosshairTickLeft}`} />
        <div className={`${styles.crosshairTick} ${styles.crosshairTickRight}`} />
      </div>

      {/* ---- Minimap ---- */}
      <div className={styles.minimap} aria-label="Minimap">
        <div className={styles.minimapInner}>
          {/* Player indicator */}
          <div className={styles.minimapPlayer} />
          <div className={styles.minimapPlayerDir} />

          {/* Enemy blips */}
          {enemyBlips.map((blip) => (
            <div
              key={blip.id}
              className={styles.minimapEnemy}
              style={{
                left: `${50 + blip.nx * 45}%`,
                top: `${50 - blip.nz * 45}%`,
              }}
            />
          ))}

          <span className={styles.minimapLabel}>TACTICAL</span>
        </div>
      </div>

      {/* ---- Passengers ---- */}
      {passengers.length > 0 && (
        <div className={styles.passengerList}>
          <span className={styles.passengerLabel}>
            PASSENGERS ({passengers.length}/{vehicle.maxPassengers})
          </span>
          {passengers.map((p, i) => (
            <span key={i} className={styles.passengerEntry}>
              {p.name}
            </span>
          ))}
        </div>
      )}

      {/* ---- Exit hint ---- */}
      <div className={styles.exitHint}>
        Press <span className={styles.exitKey}>E</span> to exit vehicle
        {isFlying && (
          <>
            {' '}| <span className={styles.exitKey}>G</span> takeoff/land
            {' '}| <span className={styles.exitKey}>F</span> toggle flight mode
          </>
        )}
      </div>
    </div>
  );
}
