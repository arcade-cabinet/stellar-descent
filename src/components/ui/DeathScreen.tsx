import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../../game/context/GameContext';
import { getAudioManager } from '../../game/core/AudioManager';
import styles from './DeathScreen.module.css';
import { MilitaryButton } from './MilitaryButton';

/**
 * Increment death counter in localStorage for campaign stats
 */
function incrementDeathCount(): void {
  try {
    const key = 'stellar_descent_death_count';
    const current = Number.parseInt(localStorage.getItem(key) ?? '0', 10);
    localStorage.setItem(key, String(current + 1));
  } catch {
    // Ignore storage errors
  }
}

interface DeathScreenProps {
  /** Callback when restart mission button is clicked */
  onRestartMission: () => void;
  /** Callback when main menu button is clicked */
  onMainMenu: () => void;
  /** Optional death reason/cause text */
  deathReason?: string;
  /** Current mission name for display */
  missionName?: string;
}

/**
 * DeathScreen - Game Over screen with military terminal styling
 *
 * Displays when player health reaches zero. Features:
 * - Glitch effect on "MISSION FAILED" title
 * - Death reason/cause text
 * - Stats display (kills, etc.)
 * - Restart mission and main menu buttons
 * - Blood vignette and scan line effects
 */
export function DeathScreen({
  onRestartMission,
  onMainMenu,
  deathReason = 'SPECTER DOWN - KIA',
  missionName = 'CURRENT MISSION',
}: DeathScreenProps) {
  const { kills } = useGame();
  const [hasPlayedSound, setHasPlayedSound] = useState(false);
  const restartButtonRef = useRef<HTMLButtonElement>(null);

  // Play death sound on mount, increment death counter, and focus restart button
  useEffect(() => {
    if (!hasPlayedSound) {
      // Play a somber/failure sound
      getAudioManager().playMusic('menu', 2); // Fade to menu music
      // Track death for campaign stats
      incrementDeathCount();
      setHasPlayedSound(true);
    }
    // Focus restart button for accessibility
    restartButtonRef.current?.focus();
  }, [hasPlayedSound]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleRestartMission = useCallback(() => {
    playClickSound();
    onRestartMission();
  }, [onRestartMission, playClickSound]);

  const handleMainMenu = useCallback(() => {
    playClickSound();
    onMainMenu();
  }, [onMainMenu, playClickSound]);

  return (
    <div className={styles.overlay} role="dialog" aria-labelledby="death-title" aria-modal="true">
      {/* Scan line effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      {/* Blood vignette */}
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.container}>
        {/* Corner brackets */}
        <div className={styles.cornerTL} aria-hidden="true" />
        <div className={styles.cornerTR} aria-hidden="true" />
        <div className={styles.cornerBL} aria-hidden="true" />
        <div className={styles.cornerBR} aria-hidden="true" />

        {/* KIA Marker */}
        <div className={styles.kiaMarker} aria-hidden="true">
          <div className={styles.kiaMarkerInner}>KIA</div>
        </div>

        {/* Title with glitch effect */}
        <h1 id="death-title" className={styles.title}>
          MISSION FAILED
        </h1>

        {/* Death reason */}
        <p className={styles.deathReason}>{deathReason}</p>

        {/* Divider */}
        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerText}>COMBAT LOG</span>
        </div>

        {/* Stats display */}
        <div className={styles.statsContainer}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>HOSTILES ELIMINATED</span>
            <span className={styles.statValue}>{kills}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>MISSION STATUS</span>
            <span className={styles.statValue}>FAILED</span>
          </div>
        </div>

        {/* Buttons */}
        <div className={styles.buttonGroup}>
          <MilitaryButton
            variant="primary"
            onClick={handleRestartMission}
            icon={<>&#8635;</>}
            buttonRef={restartButtonRef}
          >
            RESTART MISSION
          </MilitaryButton>

          <MilitaryButton onClick={handleMainMenu} icon={<>&#9664;</>}>
            MAIN MENU
          </MilitaryButton>
        </div>

        {/* Footer info */}
        <div className={styles.footer}>
          <span>{missionName}</span>
          <span className={styles.footerCenter}>7TH DROP MARINES</span>
          <span>CASUALTY REPORT</span>
        </div>
      </div>
    </div>
  );
}
