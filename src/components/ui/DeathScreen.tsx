import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { useCombatStore } from '../../game/stores/useCombatStore';
import { useGameStatsStore } from '../../game/stores/useGameStatsStore';
import styles from './DeathScreen.module.css';
import { MilitaryButton } from './MilitaryButton';

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
  const kills = useCombatStore((state) => state.kills);
  const [hasPlayedSound, setHasPlayedSound] = useState(false);
  const restartButtonRef = useRef<HTMLButtonElement>(null);

  // Play death sound on mount, increment death counter, and focus restart button
  useEffect(() => {
    if (!hasPlayedSound) {
      // Play a somber/failure sound
      getAudioManager().playMusic('menu', 2); // Fade to menu music
      // Track death for campaign stats
      useGameStatsStore.getState().incrementDeathCount();
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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        // Allow default button behavior
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRestartMission();
      }
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleMainMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRestartMission, handleMainMenu]);

  return (
    <div
      className={styles.overlay}
      role="alertdialog"
      aria-labelledby="death-title"
      aria-describedby="death-reason"
      aria-modal="true"
    >
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
        <p id="death-reason" className={styles.deathReason}>
          {deathReason}
        </p>

        {/* Divider */}
        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerText}>COMBAT LOG</span>
        </div>

        {/* Stats display */}
        <div className={styles.statsContainer} role="group" aria-label="Mission statistics">
          <div className={styles.statItem}>
            <span className={styles.statLabel} id="kills-label">
              HOSTILES ELIMINATED
            </span>
            <span className={styles.statValue} aria-labelledby="kills-label">
              {kills}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel} id="status-label">
              MISSION STATUS
            </span>
            <span className={styles.statValue} aria-labelledby="status-label">
              FAILED
            </span>
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
