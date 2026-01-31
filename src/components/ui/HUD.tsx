import React from 'react';
import { useGame } from '../../game/context/GameContext';
import { useSettings } from '../../game/context/SettingsContext';
import { useWeaponOptional } from '../../game/context/WeaponContext';
import { formatTimeMMSS, useMissionTime } from '../../game/timer';
import { ActionButtons } from './ActionButtons';
import { Compass } from './Compass';
import { Crosshair } from './Crosshair';
import { DamageIndicators } from './DamageIndicators';
import styles from './HUD.module.css';
import { ObjectiveMarkers } from './ObjectiveMarkers';
import { WeaponSelector } from './WeaponSelector';

interface HUDProps {
  health: number;
  maxHealth: number;
  kills: number;
  missionText: string;
}

export function HUD({ health, maxHealth, kills, missionText }: HUDProps) {
  const {
    notification,
    damageFlash,
    actionGroups,
    triggerAction,
    hudVisibility,
    objectiveMarker,
    compassData,
  } = useGame();
  const { colorPalette, settings } = useSettings();
  const weaponContext = useWeaponOptional();
  const missionTimeSeconds = useMissionTime();

  const healthPercent = maxHealth > 0 ? Math.max(0, Math.min(100, (health / maxHealth) * 100)) : 0;

  // Determine health status for both color and shape indicators
  const healthStatus: 'high' | 'medium' | 'low' =
    healthPercent > 50 ? 'high' : healthPercent > 25 ? 'medium' : 'low';

  // Use colorblind-aware palette colors
  const getHealthColor = () => {
    switch (healthStatus) {
      case 'high':
        return colorPalette.healthHigh;
      case 'medium':
        return colorPalette.healthMedium;
      case 'low':
        return colorPalette.healthLow;
    }
  };

  // Get objective marker styling based on type
  const getMarkerStyle = () => {
    if (!objectiveMarker) return {};
    const colors: Record<string, string> = {
      main: '#FFD700', // Gold
      interact: '#FFFFFF', // White
      optional: '#4DA6FF', // Blue
      waypoint: '#FFFF00', // Yellow
    };
    return { borderColor: colors[objectiveMarker.type] || '#FFD700' };
  };

  const getMarkerIcon = () => {
    if (!objectiveMarker) return '';
    const icons: Record<string, string> = {
      main: '!',
      interact: 'E',
      optional: '?',
      waypoint: '\u25C6', // Diamond
    };
    return icons[objectiveMarker.type] || '!';
  };

  return (
    <div className={styles.hud}>
      {/* Combat damage feedback - directional indicators, hit markers, vignettes */}
      <DamageIndicators />

      {/* Health bar - bottom left */}
      <div
        className={`${styles.healthContainer} ${hudVisibility.healthBar ? styles.visible : styles.hidden}`}
        aria-hidden={!hudVisibility.healthBar}
      >
        <span className={styles.healthLabel}>HEALTH</span>
        <div
          className={`${styles.healthBar} ${settings.usePatternIndicators ? styles.withPatterns : ''}`}
        >
          <div
            className={`${styles.healthFill} ${styles[`health${healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}`]}`}
            style={{
              width: `${healthPercent}%`,
              backgroundColor: getHealthColor(),
            }}
          />
          {/* Shape indicator for low health when enabled */}
          {settings.useShapeIndicators && healthStatus === 'low' && (
            <span className={styles.healthCriticalIndicator} aria-label="Critical health warning">
              !
            </span>
          )}
        </div>
        <span className={styles.healthText}>
          {Math.floor(health)}/{maxHealth}
        </span>
      </div>

      {/* Compass - top center (when mission text not shown) */}
      {hudVisibility.compass && !hudVisibility.missionText && (
        <Compass
          heading={compassData.heading}
          objectiveDirection={compassData.objectiveDirection}
          objectiveDistance={compassData.objectiveDistance}
        />
      )}

      {/* Mission text - top center (takes priority over compass position) */}
      <div
        className={`${styles.missionContainer} ${hudVisibility.missionText ? styles.visible : styles.hidden}`}
        aria-hidden={!hudVisibility.missionText}
      >
        <span className={styles.missionText}>{missionText}</span>
      </div>

      {/* Compass - below mission text when mission is visible */}
      {hudVisibility.compass && hudVisibility.missionText && (
        <div className={styles.compassBelowMission}>
          <Compass
            heading={compassData.heading}
            objectiveDirection={compassData.objectiveDirection}
            objectiveDistance={compassData.objectiveDistance}
          />
        </div>
      )}

      {/* Kills counter - top right */}
      <div
        className={`${styles.killsContainer} ${hudVisibility.killCounter ? styles.visible : styles.hidden}`}
        aria-hidden={!hudVisibility.killCounter}
      >
        <span className={styles.killsLabel}>KILLS</span>
        <span className={styles.killsCount}>{kills}</span>
      </div>

      {/* Mission Timer - top left */}
      <div
        className={`${styles.timerContainer} ${hudVisibility.healthBar ? styles.visible : styles.hidden}`}
        aria-hidden={!hudVisibility.healthBar}
        aria-label={`Mission time: ${formatTimeMMSS(missionTimeSeconds)}`}
      >
        <span className={styles.timerLabel}>TIME</span>
        <span className={styles.timerValue}>{formatTimeMMSS(missionTimeSeconds)}</span>
      </div>

      {/* Crosshair - tactical reticle for combat phases */}
      <Crosshair />

      {/* Edge-of-screen objective markers */}
      <ObjectiveMarkers />

      {/* Weapon Selector - desktop weapon quick-switch (hidden on mobile) */}
      {weaponContext && <WeaponSelector visible={hudVisibility.healthBar} />}

      {/* Objective marker indicator - shows when objective marker is visible */}
      {objectiveMarker?.visible && (
        <div className={styles.objectiveMarker} style={getMarkerStyle()}>
          <span className={styles.objectiveMarkerIcon}>{getMarkerIcon()}</span>
          {objectiveMarker.label && (
            <span className={styles.objectiveMarkerLabel}>{objectiveMarker.label}</span>
          )}
        </div>
      )}

      {/* Ammo display - bottom right */}
      {weaponContext && (
        <div
          className={`${styles.ammoContainer} ${hudVisibility.healthBar ? styles.visible : styles.hidden}`}
          aria-hidden={!hudVisibility.healthBar}
        >
          <div className={styles.ammoMain}>
            <span
              className={`${styles.ammoCount} ${weaponContext.isLowAmmo ? styles.ammoLow : ''} ${weaponContext.weapon.isReloading ? styles.ammoReloading : ''}`}
            >
              {weaponContext.weapon.isReloading ? '--' : weaponContext.weapon.currentAmmo}
            </span>
            <span className={styles.ammoSeparator}>/</span>
            <span className={styles.ammoMagazine}>{weaponContext.weapon.maxMagazineSize}</span>
          </div>
          <div className={styles.ammoReserve}>
            <span className={styles.ammoReserveLabel}>RESERVE</span>
            <span className={styles.ammoReserveCount}>{weaponContext.weapon.reserveAmmo}</span>
          </div>
          {weaponContext.weapon.isReloading && (
            <div className={styles.reloadContainer}>
              <div className={styles.reloadBar}>
                <div
                  className={styles.reloadProgress}
                  style={{ width: `${weaponContext.reloadProgress * 100}%` }}
                />
              </div>
              <span className={styles.reloadText}>RELOADING...</span>
            </div>
          )}
        </div>
      )}

      {/* Notification */}
      {hudVisibility.notifications && notification && (
        <div className={styles.notification} key={notification.id}>
          {notification.text}
        </div>
      )}

      {/* Dynamic action buttons */}
      {hudVisibility.actionButtons && actionGroups.length > 0 && (
        <ActionButtons groups={actionGroups} onAction={triggerAction} />
      )}
    </div>
  );
}
