import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GrenadeType, grenadeSystem, MAX_GRENADES } from '../../game/combat';
import { useGame } from '../../game/context/GameContext';
import { useWeaponOptional } from '../../game/context/WeaponContext';
import { WEAPONS, type WeaponId } from '../../game/entities/weapons';
import { saveSystem } from '../../game/persistence';
import { useSettings } from '../../game/stores/useSettingsStore';
import { formatTimeMMSS, useMissionTime } from '../../game/timer';
import { useGameEvent } from '../../hooks/useGameEvent';
import { ActionButtons } from './ActionButtons';
import { Compass } from './Compass';
import { Crosshair } from './Crosshair';
import { DamageIndicators } from './DamageIndicators';
import styles from './HUD.module.css';
import { ObjectiveMarkers } from './ObjectiveMarkers';
import { WeaponSelector } from './WeaponSelector';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface HUDProps {
  health: number;
  maxHealth: number;
  kills: number;
  missionText: string;
}

interface KillFeedEntry {
  id: number;
  enemyType: string;
  weaponId?: string;
  isCritical?: boolean;
  timestamp: number;
}

interface ScorePopup {
  id: number;
  points: number;
  label: string;
  isCritical?: boolean;
  isCombo?: boolean;
  x: number;
  y: number;
  timestamp: number;
}

interface ObjectiveState {
  title: string;
  instructions: string;
  subObjectives: { id: string; text: string; completed: boolean }[];
  distance?: number;
  fadeState: 'in' | 'visible' | 'out';
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const KILL_FEED_DURATION = 3000; // 3 seconds
const COMBO_WINDOW = 2000; // 2 seconds for combo chain
const SCORE_POPUP_DURATION = 1500; // 1.5 seconds

// Point values
const POINTS = {
  kill: 100,
  critical: 50,
  headshot: 75,
  combo2: 25,
  combo3: 50,
  combo4: 100,
  combo5Plus: 150,
};

// ---------------------------------------------------------------------------
// HUD COMPONENT
// ---------------------------------------------------------------------------

export function HUD({ health, maxHealth, kills, missionText }: HUDProps) {
  const {
    notification,
    damageFlash,
    actionGroups,
    triggerAction,
    hudVisibility,
    objectiveMarker,
    compassData,
    objectiveTitle,
    objectiveInstructions,
  } = useGame();
  const { colorPalette, settings } = useSettings();
  const weaponContext = useWeaponOptional();
  const missionTimeSeconds = useMissionTime();
  const [isSaving, setIsSaving] = useState(false);

  // Grenade inventory state
  const [grenadeCount, setGrenadeCount] = useState(grenadeSystem.getTotalGrenadeCount());
  const [selectedGrenadeType, setSelectedGrenadeType] = useState<GrenadeType>(
    grenadeSystem.getSelectedType()
  );
  const [grenadeInventory, setGrenadeInventory] = useState<Map<GrenadeType, number>>(
    grenadeSystem.getInventory()
  );

  // Kill feed state
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const killFeedIdRef = useRef(0);

  // Health state from EventBus (supplements props for self-contained operation)
  const [eventBusHealth, setEventBusHealth] = useState<number | null>(null);

  // Score/combo state
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const scorePopupIdRef = useRef(0);
  const [comboCount, setComboCount] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const lastKillTimeRef = useRef(0);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Objective state
  const [objectiveState, setObjectiveState] = useState<ObjectiveState>({
    title: '',
    instructions: '',
    subObjectives: [],
    fadeState: 'visible',
  });
  const objectiveFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Weapon switch flash state
  const [weaponSwitchFlash, setWeaponSwitchFlash] = useState(false);
  const weaponSwitchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-reload prompt state
  const [showAutoReloadPrompt, setShowAutoReloadPrompt] = useState(false);

  // Subscribe to grenade inventory changes
  useEffect(() => {
    const updateGrenadeState = () => {
      setGrenadeCount(grenadeSystem.getTotalGrenadeCount());
      setSelectedGrenadeType(grenadeSystem.getSelectedType());
      setGrenadeInventory(grenadeSystem.getInventory());
    };

    grenadeSystem.onInventoryChange(updateGrenadeState);

    return () => {
      // Clear callback on unmount
    };
  }, []);

  // Subscribe to ENEMY_KILLED events for kill feed and score
  useGameEvent('ENEMY_KILLED', (event) => {
    const now = performance.now();
    const weaponId = weaponContext?.weapon.currentWeaponId;

    // Add to kill feed
    const killEntry: KillFeedEntry = {
      id: killFeedIdRef.current++,
      enemyType: event.enemyType,
      weaponId,
      timestamp: now,
    };
    setKillFeed((prev) => [killEntry, ...prev].slice(0, 5));

    // Calculate combo
    const timeSinceLastKill = now - lastKillTimeRef.current;
    let newComboCount = 1;
    let newMultiplier = 1;

    if (timeSinceLastKill < COMBO_WINDOW && lastKillTimeRef.current > 0) {
      newComboCount = comboCount + 1;
      newMultiplier = Math.min(5, 1 + Math.floor(newComboCount / 2));
    }

    setComboCount(newComboCount);
    setComboMultiplier(newMultiplier);
    lastKillTimeRef.current = now;

    // Clear existing combo timeout
    if (comboTimeoutRef.current) {
      clearTimeout(comboTimeoutRef.current);
    }

    // Set combo decay timeout
    comboTimeoutRef.current = setTimeout(() => {
      setComboCount(0);
      setComboMultiplier(1);
    }, COMBO_WINDOW);

    // Calculate score
    let points = POINTS.kill * newMultiplier;
    let label = `+${POINTS.kill}`;

    // Add combo bonus
    if (newComboCount >= 5) {
      points += POINTS.combo5Plus;
      label = `COMBO x${newComboCount}! +${points}`;
    } else if (newComboCount >= 4) {
      points += POINTS.combo4;
      label = `COMBO x${newComboCount}! +${points}`;
    } else if (newComboCount >= 3) {
      points += POINTS.combo3;
      label = `COMBO x${newComboCount}! +${points}`;
    } else if (newComboCount >= 2) {
      points += POINTS.combo2;
      label = `DOUBLE KILL! +${points}`;
    }

    // Create score popup
    const popup: ScorePopup = {
      id: scorePopupIdRef.current++,
      points,
      label,
      isCombo: newComboCount >= 2,
      x: 50 + (Math.random() - 0.5) * 10,
      y: 40 + (Math.random() - 0.5) * 5,
      timestamp: now,
    };
    setScorePopups((prev) => [...prev, popup]);
  });

  // Subscribe to WEAPON_SWITCHED events
  useGameEvent('WEAPON_SWITCHED', () => {
    setWeaponSwitchFlash(true);
    if (weaponSwitchTimeoutRef.current) {
      clearTimeout(weaponSwitchTimeoutRef.current);
    }
    weaponSwitchTimeoutRef.current = setTimeout(() => {
      setWeaponSwitchFlash(false);
    }, 200);
  });

  // Subscribe to OBJECTIVE_UPDATED events
  useGameEvent('OBJECTIVE_UPDATED', (event) => {
    // Clear any existing fade timeout
    if (objectiveFadeTimeoutRef.current) {
      clearTimeout(objectiveFadeTimeoutRef.current);
    }

    // Fade in new objective
    setObjectiveState((prev) => ({
      ...prev,
      title: event.title,
      instructions: event.instructions,
      fadeState: 'in',
    }));

    // Transition to visible
    setTimeout(() => {
      setObjectiveState((prev) => ({ ...prev, fadeState: 'visible' }));
    }, 500);
  });

  // Subscribe to OBJECTIVE_COMPLETED events
  useGameEvent('OBJECTIVE_COMPLETED', (event) => {
    setObjectiveState((prev) => ({
      ...prev,
      subObjectives: prev.subObjectives.map((obj) =>
        obj.id === event.objectiveId ? { ...obj, completed: true } : obj
      ),
    }));
  });

  // Subscribe to WAVE_STARTED events for wave announcements
  useGameEvent('WAVE_STARTED', (event) => {
    // Could show wave notification here
    if (event.label) {
      // Wave label announcement handled by notification system
    }
  });

  // Subscribe to CHECKPOINT_REACHED events
  useGameEvent('CHECKPOINT_REACHED', () => {
    // Checkpoint notification is handled by the level, but HUD could show an icon
  });

  // Subscribe to PLAYER_DAMAGED events for health tracking
  useGameEvent('PLAYER_DAMAGED', (event) => {
    // Update local health state based on damage taken
    // This supplements the health prop for self-contained EventBus operation
    setEventBusHealth((prev) => {
      const currentHealth = prev ?? health;
      return Math.max(0, currentHealth - event.amount);
    });
  });

  // Subscribe to PLAYER_HEALED events for health tracking
  useGameEvent('PLAYER_HEALED', (event) => {
    // Update local health state based on healing
    setEventBusHealth((prev) => {
      const currentHealth = prev ?? health;
      return Math.min(maxHealth, currentHealth + event.amount);
    });
  });

  // Subscribe to LOW_HEALTH_WARNING events for visual feedback
  useGameEvent('LOW_HEALTH_WARNING', () => {
    // Could trigger additional low health visual effects here
  });

  // Subscribe to NOTIFICATION events
  useGameEvent('NOTIFICATION', () => {
    // Notifications are handled by the notification system in GameContext
    // This subscription enables future self-contained notification handling
  });

  // Clean up kill feed entries
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      setKillFeed((prev) => prev.filter((entry) => now - entry.timestamp < KILL_FEED_DURATION));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Clean up score popups
  useEffect(() => {
    const interval = setInterval(() => {
      const now = performance.now();
      setScorePopups((prev) =>
        prev.filter((popup) => now - popup.timestamp < SCORE_POPUP_DURATION)
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
      if (objectiveFadeTimeoutRef.current) clearTimeout(objectiveFadeTimeoutRef.current);
      if (weaponSwitchTimeoutRef.current) clearTimeout(weaponSwitchTimeoutRef.current);
    };
  }, []);

  // Check for auto-reload prompt
  useEffect(() => {
    if (
      weaponContext &&
      weaponContext.weapon.currentAmmo === 0 &&
      weaponContext.weapon.reserveAmmo > 0 &&
      !weaponContext.weapon.isReloading
    ) {
      setShowAutoReloadPrompt(true);
    } else {
      setShowAutoReloadPrompt(false);
    }
  }, [
    weaponContext?.weapon.currentAmmo,
    weaponContext?.weapon.reserveAmmo,
    weaponContext?.weapon.isReloading,
    weaponContext,
  ]);

  // Check if running on web platform (not native iOS/Android)
  const isWebPlatform = !Capacitor.isNativePlatform();

  // Get grenade type icon class
  const getGrenadeIconClass = (type: GrenadeType) => {
    switch (type) {
      case 'frag':
        return styles.grenadeIconFrag;
      case 'plasma':
        return styles.grenadeIconPlasma;
      case 'emp':
        return styles.grenadeIconEmp;
    }
  };

  // Get grenade type display name
  const getGrenadeTypeName = (type: GrenadeType) => {
    switch (type) {
      case 'frag':
        return 'FRAG';
      case 'plasma':
        return 'PLASMA';
      case 'emp':
        return 'EMP';
    }
  };

  // Get weapon category icon class
  const getWeaponIconClass = (weaponId: WeaponId): string => {
    const weapon = WEAPONS[weaponId];
    switch (weapon.category) {
      case 'sidearm':
        return styles.weaponIconPistol;
      case 'smg':
        return styles.weaponIconSmg;
      case 'rifle':
      case 'marksman':
        return styles.weaponIconRifle;
      case 'shotgun':
        return styles.weaponIconShotgun;
      case 'heavy':
        return weapon.id === 'plasma_cannon' ? styles.weaponIconPlasma : styles.weaponIconHeavy;
      default:
        return styles.weaponIconRifle;
    }
  };

  // Handle save/download for web platform
  const handleSaveDownload = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveSystem.exportDatabaseFile();
    } finally {
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [isSaving]);

  // Use EventBus health if available, otherwise fall back to props
  const effectiveHealth = eventBusHealth ?? health;
  const healthPercent =
    maxHealth > 0 ? Math.max(0, Math.min(100, (effectiveHealth / maxHealth) * 100)) : 0;

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
      main: '#FFD700',
      interact: '#FFFFFF',
      optional: '#4DA6FF',
      waypoint: '#FFFF00',
    };
    return { borderColor: colors[objectiveMarker.type] || '#FFD700' };
  };

  const getMarkerIcon = () => {
    if (!objectiveMarker) return '';
    const icons: Record<string, string> = {
      main: '!',
      interact: 'E',
      optional: '?',
      waypoint: '\u25C6',
    };
    return icons[objectiveMarker.type] || '!';
  };

  // Check for low/empty ammo states
  const isEmptyMagazine = weaponContext ? weaponContext.weapon.currentAmmo === 0 : false;
  const isLowAmmo = weaponContext ? weaponContext.isLowAmmo : false;

  // Armor value (placeholder for future implementation)
  const armor = 0;
  const maxArmor = 100;

  // Prefetch reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  return (
    <div className={styles.hud} role="region" aria-label="Game HUD">
      {/* Combat damage feedback - directional indicators, hit markers, vignettes */}
      <DamageIndicators />

      {/* Health bar - bottom left */}
      <div
        className={`${styles.healthContainer} ${hudVisibility.healthBar ? styles.visible : styles.hidden}`}
        aria-hidden={!hudVisibility.healthBar}
        role="status"
        aria-live="polite"
        aria-label={`Health: ${Math.floor(effectiveHealth)} of ${maxHealth}`}
      >
        <span className={styles.healthLabel} aria-hidden="true">
          HEALTH
        </span>
        <div
          className={`${styles.healthBar} ${settings.usePatternIndicators ? styles.withPatterns : ''} ${healthStatus === 'low' && !prefersReducedMotion ? styles.healthBarPulsing : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={maxHealth}
          aria-valuenow={Math.floor(effectiveHealth)}
          aria-label="Health"
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
          {Math.floor(effectiveHealth)}/{maxHealth}
        </span>
      </div>

      {/* Armor bar - below health (only shown if armor > 0) */}
      {armor > 0 && hudVisibility.healthBar && (
        <div
          className={`${styles.armorContainer} ${styles.visible}`}
          role="status"
          aria-label={`Armor: ${armor} of ${maxArmor}`}
        >
          <span className={styles.armorLabel} aria-hidden="true">
            ARMOR
          </span>
          <div className={styles.armorBar}>
            <div className={styles.armorFill} style={{ width: `${(armor / maxArmor) * 100}%` }} />
          </div>
          <span className={styles.armorText}>
            {armor}/{maxArmor}
          </span>
        </div>
      )}

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
        role="status"
        aria-label={`Kills: ${kills}`}
      >
        <span className={styles.killsLabel} aria-hidden="true">
          KILLS
        </span>
        <span className={styles.killsCount} aria-hidden="true">
          {kills}
        </span>
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
          className={`${styles.ammoContainer} ${hudVisibility.healthBar ? styles.visible : styles.hidden} ${isEmptyMagazine ? styles.ammoEmpty : ''} ${weaponSwitchFlash ? styles.weaponSwitchFlash : ''}`}
          aria-hidden={!hudVisibility.healthBar}
          role="status"
          aria-label={`Ammo: ${weaponContext.weapon.isReloading ? 'Reloading' : `${weaponContext.weapon.currentAmmo} of ${weaponContext.weapon.maxMagazineSize}, Reserve: ${weaponContext.weapon.reserveAmmo}`}`}
        >
          {/* Current weapon name */}
          <div className={styles.weaponName} aria-hidden="true">
            <span
              className={`${styles.weaponIcon} ${getWeaponIconClass(weaponContext.weapon.currentWeaponId)}`}
            />
            <span>{WEAPONS[weaponContext.weapon.currentWeaponId].shortName}</span>
          </div>

          {/* Reload progress ring (around ammo display) */}
          {weaponContext.weapon.isReloading && (
            <svg className={styles.reloadRing} viewBox="0 0 100 100">
              <circle
                className={styles.reloadRingBg}
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="4"
              />
              <circle
                className={styles.reloadRingProgress}
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="4"
                strokeDasharray={`${weaponContext.reloadProgress * 283} 283`}
                transform="rotate(-90 50 50)"
              />
            </svg>
          )}

          <div className={styles.ammoMain} aria-hidden="true">
            <span
              className={`${styles.ammoCount} ${isLowAmmo ? styles.ammoLow : ''} ${isEmptyMagazine ? styles.ammoEmptyText : ''} ${weaponContext.weapon.isReloading ? styles.ammoReloading : ''}`}
            >
              {weaponContext.weapon.isReloading ? '--' : weaponContext.weapon.currentAmmo}
            </span>
            <span className={styles.ammoSeparator}>/</span>
            <span className={styles.ammoMagazine}>{weaponContext.weapon.maxMagazineSize}</span>
          </div>
          <div className={styles.ammoReserve} aria-hidden="true">
            <span className={styles.ammoReserveLabel}>RESERVE</span>
            <span className={styles.ammoReserveCount}>{weaponContext.weapon.reserveAmmo}</span>
          </div>
          {weaponContext.weapon.isReloading && (
            <div className={styles.reloadContainer} role="status" aria-live="polite">
              <div
                className={styles.reloadBar}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(weaponContext.reloadProgress * 100)}
                aria-label="Reload progress"
              >
                <div
                  className={styles.reloadProgress}
                  style={{ width: `${weaponContext.reloadProgress * 100}%` }}
                />
              </div>
              <span className={styles.reloadText} aria-hidden="true">
                RELOADING...
              </span>
            </div>
          )}
          {/* Auto-reload prompt */}
          {showAutoReloadPrompt && !weaponContext.weapon.isReloading && (
            <div className={styles.autoReloadPrompt}>
              <span className={styles.autoReloadKey}>[R]</span>
              <span>RELOAD</span>
            </div>
          )}
        </div>
      )}

      {/* Weapon slots display - above ammo */}
      {weaponContext && hudVisibility.healthBar && (
        <div className={styles.weaponSlotsContainer}>
          {weaponContext.weapon.inventory.slots.map((slotWeaponId, index) => {
            const isActive = index === weaponContext.weapon.currentWeaponSlot;
            const isEmpty = slotWeaponId === null;

            return (
              <div
                key={index}
                className={`${styles.weaponSlot} ${isActive ? styles.weaponSlotActive : ''} ${isEmpty ? styles.weaponSlotEmpty : ''}`}
              >
                <span className={styles.weaponSlotKey}>{index + 1}</span>
                {slotWeaponId && (
                  <span
                    className={`${styles.weaponSlotIcon} ${getWeaponIconClass(slotWeaponId)}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Notification */}
      {hudVisibility.notifications && notification && (
        <div
          className={styles.notification}
          key={notification.id}
          role="alert"
          aria-live="assertive"
        >
          {notification.text}
        </div>
      )}

      {/* Dynamic action buttons */}
      {hudVisibility.actionButtons && actionGroups.length > 0 && (
        <ActionButtons groups={actionGroups} onAction={triggerAction} />
      )}

      {/* Grenade display - above ammo display */}
      <div
        className={`${styles.grenadeContainer} ${hudVisibility.healthBar ? styles.visible : styles.hidden}`}
        aria-hidden={!hudVisibility.healthBar}
        role="status"
        aria-label={`Grenades: ${grenadeCount} ${getGrenadeTypeName(selectedGrenadeType)}`}
      >
        <div className={styles.grenadeHeader}>
          <span className={styles.grenadeLabel}>GRENADE</span>
          <span className={styles.grenadeKey}>[G]</span>
        </div>
        {/* Grenade type icons with counts */}
        <div className={styles.grenadeTypes}>
          {(['frag', 'plasma', 'emp'] as GrenadeType[]).map((type) => {
            const count = grenadeInventory.get(type) ?? 0;
            const isSelected = type === selectedGrenadeType;
            return (
              <div
                key={type}
                className={`${styles.grenadeTypeSlot} ${isSelected ? styles.grenadeTypeSelected : ''} ${count === 0 ? styles.grenadeTypeEmpty : ''}`}
              >
                <div
                  className={`${styles.grenadeIcon} ${getGrenadeIconClass(type)}`}
                  aria-hidden="true"
                />
                <span className={styles.grenadeTypeCount}>{count}</span>
              </div>
            );
          })}
        </div>
        <span className={styles.grenadeType}>{getGrenadeTypeName(selectedGrenadeType)}</span>
        {/* Visual grenade slot indicators */}
        <div className={styles.grenadeSlots} aria-hidden="true">
          {Array.from({ length: MAX_GRENADES }).map((_, i) => (
            <div
              key={i}
              className={`${styles.grenadeSlot} ${
                i < grenadeCount
                  ? selectedGrenadeType === 'plasma'
                    ? styles.grenadeSlotFilledPlasma
                    : selectedGrenadeType === 'emp'
                      ? styles.grenadeSlotFilledEmp
                      : styles.grenadeSlotFilled
                  : ''
              }`}
            />
          ))}
        </div>
      </div>

      {/* Kill feed - top right below kills counter */}
      <div
        className={`${styles.killFeed} ${hudVisibility.killCounter ? styles.visible : styles.hidden}`}
      >
        {killFeed.map((entry) => {
          const age = performance.now() - entry.timestamp;
          const opacity = Math.max(0, 1 - age / KILL_FEED_DURATION);
          const weaponName = entry.weaponId
            ? WEAPONS[entry.weaponId as WeaponId]?.shortName
            : 'UNKNOWN';

          return (
            <div
              key={entry.id}
              className={`${styles.killFeedEntry} ${entry.isCritical ? styles.killFeedCritical : ''}`}
              style={{ opacity }}
            >
              <span className={styles.killFeedIcon}>+</span>
              <span className={styles.killFeedEnemy}>{entry.enemyType.toUpperCase()}</span>
              <span className={styles.killFeedWeapon}>{weaponName}</span>
              {entry.isCritical && <span className={styles.killFeedCriticalBadge}>CRIT</span>}
            </div>
          );
        })}
      </div>

      {/* Score/combo display - center screen */}
      <div className={styles.scorePopupContainer}>
        {scorePopups.map((popup) => {
          const age = performance.now() - popup.timestamp;
          const progress = age / SCORE_POPUP_DURATION;
          const opacity = Math.max(0, 1 - progress);
          const translateY = -30 * progress;

          return (
            <div
              key={popup.id}
              className={`${styles.scorePopup} ${popup.isCombo ? styles.scorePopupCombo : ''} ${popup.isCritical ? styles.scorePopupCritical : ''}`}
              style={{
                opacity,
                transform: `translate(-50%, ${translateY}px)`,
                left: `${popup.x}%`,
                top: `${popup.y}%`,
              }}
            >
              {popup.label}
            </div>
          );
        })}
      </div>

      {/* Combo multiplier indicator - when active */}
      {comboCount >= 2 && (
        <div className={styles.comboIndicator}>
          <span className={styles.comboLabel}>COMBO</span>
          <span className={styles.comboCount}>x{comboCount}</span>
          <span className={styles.comboMultiplier}>{comboMultiplier}x POINTS</span>
        </div>
      )}

      {/* Objective display - left side */}
      {(objectiveTitle || objectiveInstructions) && hudVisibility.healthBar && (
        <div
          className={`${styles.objectiveDisplay} ${styles[`objectiveFade${objectiveState.fadeState.charAt(0).toUpperCase() + objectiveState.fadeState.slice(1)}`]}`}
        >
          <div className={styles.objectiveHeader}>
            <span className={styles.objectiveIcon}>!</span>
            <span className={styles.objectiveLabel}>OBJECTIVE</span>
          </div>
          {objectiveTitle && <div className={styles.objectiveTitle}>{objectiveTitle}</div>}
          {objectiveInstructions && (
            <div className={styles.objectiveInstructions}>{objectiveInstructions}</div>
          )}
          {compassData.objectiveDistance !== undefined && (
            <div className={styles.objectiveDistance}>
              {Math.round(compassData.objectiveDistance)}m
            </div>
          )}
          {/* Sub-objectives */}
          {objectiveState.subObjectives.length > 0 && (
            <div className={styles.subObjectives}>
              {objectiveState.subObjectives.map((obj) => (
                <div
                  key={obj.id}
                  className={`${styles.subObjective} ${obj.completed ? styles.subObjectiveComplete : ''}`}
                >
                  <span className={styles.subObjectiveCheck}>
                    {obj.completed ? '\u2713' : '\u25A1'}
                  </span>
                  <span>{obj.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Minimap placeholder - top left corner */}
      {hudVisibility.compass && (
        <div className={styles.minimapContainer}>
          <div className={styles.minimap}>
            {/* Player arrow at center */}
            <div className={styles.minimapPlayer} />
            {/* Objective marker */}
            {compassData.objectiveDirection !== undefined && (
              <div
                className={styles.minimapObjective}
                style={{
                  transform: `rotate(${compassData.objectiveDirection}rad) translateY(-20px)`,
                }}
              />
            )}
          </div>
          <span className={styles.minimapLabel}>RADAR</span>
        </div>
      )}

      {/* Save/Download button - web platform only */}
      {isWebPlatform && hudVisibility.healthBar && (
        <button
          type="button"
          className={`${styles.saveButton} ${hudVisibility.missionText ? '' : styles.saveButtonRight} ${isSaving ? styles.saveButtonSaving : ''}`}
          onClick={handleSaveDownload}
          disabled={isSaving}
          aria-label="Download save file"
          title="Download save to your device"
        >
          <span className={styles.saveButtonIcon} aria-hidden="true">
            {isSaving ? '\u21BB' : '\u2913'}
          </span>
          <span className={styles.saveButtonText}>{isSaving ? 'SAVING...' : 'SAVE'}</span>
        </button>
      )}
    </div>
  );
}
