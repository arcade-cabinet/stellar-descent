import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCollectionProgress } from '../../game/collectibles';
import {
  ACTION_LABELS,
  type BindableAction,
  getKeyDisplayName,
  useKeybindings,
} from '../../game/context/KeybindingsContext';
import { getAudioManager } from '../../game/core/AudioManager';
import { CAMPAIGN_LEVELS, type LevelId } from '../../game/levels/types';
import { AudioLogCollection } from './AudioLogCollection';
import { MilitaryButton } from './MilitaryButton';
import styles from './PauseMenu.module.css';
import { SettingsMenu } from './SettingsMenu';

interface PauseMenuProps {
  /** Callback when resume button is clicked or menu is dismissed */
  onResume: () => void;
  /** Callback when main menu button is clicked */
  onMainMenu: () => void;
  /** Callback when restart level button is clicked */
  onRestartLevel?: () => void;
  /** Current mission name for display */
  missionName?: string;
  /** Current level ID for objectives display */
  currentLevelId?: LevelId;
  /** Current objective title */
  objectiveTitle?: string;
  /** Current objective instructions */
  objectiveInstructions?: string;
}

/**
 * Confirmation dialog types for dangerous actions
 */
type ConfirmDialogType = 'restart' | 'quit' | null;

/**
 * Control reference categories for display
 */
const CONTROL_CATEGORIES: {
  title: string;
  actions: BindableAction[];
}[] = [
  {
    title: 'MOVEMENT',
    actions: ['moveForward', 'moveBackward', 'moveLeft', 'moveRight', 'jump', 'sprint', 'crouch'],
  },
  {
    title: 'COMBAT',
    actions: ['fire', 'reload'],
  },
  {
    title: 'OTHER',
    actions: ['interact', 'pause'],
  },
];

/**
 * Menu sections for keyboard navigation
 */
type MenuSection = 'main' | 'settings' | 'controls' | 'objectives' | 'audiologs';

/**
 * PauseMenu - In-game pause menu with military terminal styling
 *
 * Displays when player pauses the game. Features:
 * - Resume gameplay button
 * - Settings access
 * - Control reference display
 * - Mission objectives reminder
 * - Quit to main menu option
 * - Background blur effect
 * - Audio fade out/in
 * - Focus trap for accessibility
 * - Keyboard navigation
 */
export function PauseMenu({
  onResume,
  onMainMenu,
  onRestartLevel,
  missionName = 'CURRENT MISSION',
  currentLevelId,
  objectiveTitle,
  objectiveInstructions,
}: PauseMenuProps) {
  const [activeSection, setActiveSection] = useState<MenuSection>('main');
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioLogs, setShowAudioLogs] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const mainButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const { getKeyForAction } = useKeybindings();

  // Get mission info from level config
  const missionInfo = useMemo(() => {
    if (!currentLevelId) return null;
    return CAMPAIGN_LEVELS[currentLevelId];
  }, [currentLevelId]);

  // Get audio log collection progress for badge display
  const audioLogProgress = useMemo(() => getCollectionProgress(), []);

  // Main menu buttons configuration
  const mainMenuButtons = useMemo(
    () => [
      { id: 'resume', label: 'RESUME', icon: '\u25B6', keyHint: '[ESC]', primary: true },
      { id: 'settings', label: 'SETTINGS', icon: '\u2699' },
      { id: 'controls', label: 'CONTROLS', icon: '\u2328' },
      { id: 'objectives', label: 'OBJECTIVES', icon: '\u25C9' },
      {
        id: 'audiologs',
        label: 'AUDIO LOGS',
        icon: '\u266A',
        badge:
          audioLogProgress.discovered > 0
            ? `${audioLogProgress.discovered}/${audioLogProgress.total}`
            : undefined,
      },
      ...(onRestartLevel
        ? [{ id: 'restart', label: 'RESTART LEVEL', icon: '\u21BA', warning: true }]
        : []),
      { id: 'mainmenu', label: 'QUIT TO MENU', icon: '\u25C0', danger: true },
    ],
    [onRestartLevel, audioLogProgress.discovered, audioLogProgress.total]
  );

  // Audio fade effect on mount/unmount
  useEffect(() => {
    const audioManager = getAudioManager();

    // Fade out audio when pausing (apply muffled effect)
    audioManager.setMusicMuffled(true);

    return () => {
      // Fade in audio when resuming
      audioManager.setMusicMuffled(false);
    };
  }, []);

  // Focus first button on mount, or confirm button when dialog is open
  useEffect(() => {
    if (confirmDialog) {
      confirmButtonRef.current?.focus();
    } else if (activeSection === 'main' && !showSettings) {
      resumeButtonRef.current?.focus();
    }
  }, [activeSection, showSettings, confirmDialog]);

  // Handle Escape key to resume or go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if settings or audio logs is open (they handle their own escape)
      if (showSettings || showAudioLogs) return;

      if (e.code === 'Escape') {
        e.preventDefault();
        // If confirmation dialog is open, close it first
        if (confirmDialog) {
          setConfirmDialog(null);
          return;
        }
        if (activeSection === 'main') {
          onResume();
        } else {
          setActiveSection('main');
          setFocusedIndex(0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResume, showSettings, showAudioLogs, activeSection, confirmDialog]);

  // Keyboard navigation within menu
  useEffect(() => {
    if (showSettings || activeSection !== 'main' || confirmDialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const maxIndex = mainMenuButtons.length - 1;

      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          setFocusedIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
          break;
        case 'Enter':
        case 'Space':
          e.preventDefault();
          mainButtonsRef.current[focusedIndex]?.click();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSettings, activeSection, focusedIndex, mainMenuButtons.length, confirmDialog]);

  // Update focus when index changes
  useEffect(() => {
    if (activeSection === 'main' && !showSettings) {
      mainButtonsRef.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, activeSection, showSettings]);

  // Focus trap - prevent focus from leaving the menu
  useEffect(() => {
    if (showSettings) return; // Settings has its own focus trap

    const handleFocusOut = (e: FocusEvent) => {
      if (
        containerRef.current &&
        e.relatedTarget &&
        !containerRef.current.contains(e.relatedTarget as Node)
      ) {
        // Focus is leaving the container, bring it back
        resumeButtonRef.current?.focus();
      }
    };

    document.addEventListener('focusout', handleFocusOut);
    return () => document.removeEventListener('focusout', handleFocusOut);
  }, [showSettings]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleButtonClick = useCallback(
    (buttonId: string) => {
      playClickSound();
      switch (buttonId) {
        case 'resume':
          onResume();
          break;
        case 'settings':
          setShowSettings(true);
          break;
        case 'controls':
          setActiveSection('controls');
          break;
        case 'objectives':
          setActiveSection('objectives');
          break;
        case 'audiologs':
          setShowAudioLogs(true);
          break;
        case 'restart':
          // Show confirmation dialog for restart
          setConfirmDialog('restart');
          break;
        case 'mainmenu':
          // Show confirmation dialog for quit
          setConfirmDialog('quit');
          break;
      }
    },
    [onResume, playClickSound]
  );

  const handleConfirmAction = useCallback(() => {
    playClickSound();
    if (confirmDialog === 'restart' && onRestartLevel) {
      onRestartLevel();
    } else if (confirmDialog === 'quit') {
      onMainMenu();
    }
    setConfirmDialog(null);
  }, [confirmDialog, onRestartLevel, onMainMenu, playClickSound]);

  const handleCancelConfirm = useCallback(() => {
    playClickSound();
    setConfirmDialog(null);
  }, [playClickSound]);

  const handleCloseSettings = useCallback(() => {
    playClickSound();
    setShowSettings(false);
    setFocusedIndex(1); // Focus settings button after closing
  }, [playClickSound]);

  const handleCloseAudioLogs = useCallback(() => {
    playClickSound();
    setShowAudioLogs(false);
    setFocusedIndex(4); // Focus audio logs button after closing
  }, [playClickSound]);

  const handleBackToMain = useCallback(() => {
    playClickSound();
    setActiveSection('main');
    setFocusedIndex(0);
  }, [playClickSound]);

  // Render control reference section
  const renderControlsSection = () => (
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBackToMain}
          aria-label="Back to pause menu"
        >
          {'\u25C0'} BACK
        </button>
        <h2 className={styles.sectionTitle}>CONTROL REFERENCE</h2>
      </div>

      <div className={styles.controlsGrid}>
        {CONTROL_CATEGORIES.map((category) => (
          <div key={category.title} className={styles.controlCategory}>
            <h3 className={styles.categoryTitle}>{category.title}</h3>
            <div className={styles.controlList}>
              {category.actions.map((action) => (
                <div key={action} className={styles.controlRow}>
                  <span className={styles.actionName}>{ACTION_LABELS[action]}</span>
                  <span className={styles.keyBinding}>
                    {getKeyDisplayName(getKeyForAction(action))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.controlNote}>
        <p>Mouse movement controls camera look. Hold Shift to sprint.</p>
        <p>Customize controls in Settings &gt; Controls.</p>
      </div>
    </div>
  );

  // Render objectives section
  const renderObjectivesSection = () => (
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBackToMain}
          aria-label="Back to pause menu"
        >
          {'\u25C0'} BACK
        </button>
        <h2 className={styles.sectionTitle}>MISSION OBJECTIVES</h2>
      </div>

      {missionInfo && (
        <div className={styles.missionInfoBlock}>
          <div className={styles.missionActName}>{missionInfo.actName}</div>
          <div className={styles.missionTitle}>{missionInfo.missionName}</div>
          {missionInfo.missionSubtitle && (
            <div className={styles.missionSubtitle}>{missionInfo.missionSubtitle}</div>
          )}
        </div>
      )}

      <div className={styles.objectivesBlock}>
        <div className={styles.objectiveMarker}>
          <span className={styles.objectiveIcon}>{'\u25C9'}</span>
          <span className={styles.objectiveLabel}>CURRENT OBJECTIVE</span>
        </div>

        {objectiveTitle ? (
          <div className={styles.objectiveContent}>
            <h3 className={styles.objectiveTitle}>{objectiveTitle}</h3>
            {objectiveInstructions && (
              <p className={styles.objectiveInstructions}>{objectiveInstructions}</p>
            )}
          </div>
        ) : (
          <div className={styles.objectiveContent}>
            <p className={styles.noObjective}>No active objective. Explore the area.</p>
          </div>
        )}
      </div>

      <div className={styles.objectiveNote}>
        <p>Complete objectives to progress through the mission.</p>
      </div>
    </div>
  );

  // Render main menu
  const renderMainSection = () => (
    <>
      {/* Pause Indicator */}
      <div className={styles.pauseMarker} aria-hidden="true">
        <div className={styles.pauseMarkerInner}>II</div>
      </div>

      {/* Title */}
      <h1 id="pause-title" className={styles.title}>
        MISSION PAUSED
      </h1>

      {/* Mission name subtitle */}
      <p className={styles.subtitle}>{missionName}</p>

      {/* Divider */}
      <div className={styles.divider} aria-hidden="true">
        <span className={styles.dividerText}>OPTIONS</span>
      </div>

      {/* Buttons */}
      <div className={styles.buttonGroup}>
        {mainMenuButtons.map((button, index) => (
          <button
            key={button.id}
            ref={(el) => {
              mainButtonsRef.current[index] = el;
              if (button.id === 'resume') {
                (resumeButtonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
              }
            }}
            type="button"
            className={`${styles.button} ${button.primary ? styles.primaryButton : ''} ${'warning' in button && button.warning ? styles.warningButton : ''} ${button.danger ? styles.dangerButton : ''} ${focusedIndex === index ? styles.focused : ''}`}
            onClick={() => handleButtonClick(button.id)}
            aria-current={focusedIndex === index ? 'true' : undefined}
          >
            <span className={styles.buttonIcon} aria-hidden="true">
              {button.icon}
            </span>
            {button.label}
            {'badge' in button && button.badge && (
              <span className={styles.buttonBadge}>{button.badge}</span>
            )}
            {'keyHint' in button && button.keyHint && (
              <span className={styles.keyHint}>{button.keyHint}</span>
            )}
          </button>
        ))}
      </div>

      {/* Footer info */}
      <div className={styles.footer}>
        <span>7TH DROP MARINES</span>
        <span className={styles.footerCenter}>STANDBY</span>
        <span>OPERATIONS</span>
      </div>
    </>
  );

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-labelledby="pause-title"
      aria-modal="true"
      ref={containerRef}
    >
      {/* Background blur layer */}
      <div className={styles.blurBackdrop} aria-hidden="true" />

      {/* Scan line effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      <div className={styles.container}>
        {/* Corner brackets */}
        <div className={styles.cornerTL} aria-hidden="true" />
        <div className={styles.cornerTR} aria-hidden="true" />
        <div className={styles.cornerBL} aria-hidden="true" />
        <div className={styles.cornerBR} aria-hidden="true" />

        {/* Content based on active section */}
        {activeSection === 'main' && renderMainSection()}
        {activeSection === 'controls' && renderControlsSection()}
        {activeSection === 'objectives' && renderObjectivesSection()}
      </div>

      {/* Settings Menu */}
      <SettingsMenu isOpen={showSettings} onClose={handleCloseSettings} />

      {/* Audio Logs Collection */}
      <AudioLogCollection isOpen={showAudioLogs} onClose={handleCloseAudioLogs} />

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className={styles.confirmOverlay} role="alertdialog" aria-modal="true">
          <div className={styles.confirmDialog}>
            {/* Corner decorations */}
            <div className={styles.cornerTL} aria-hidden="true" />
            <div className={styles.cornerTR} aria-hidden="true" />
            <div className={styles.cornerBL} aria-hidden="true" />
            <div className={styles.cornerBR} aria-hidden="true" />

            <div className={styles.confirmIcon} aria-hidden="true">
              {confirmDialog === 'restart' ? '\u21BA' : '\u26A0'}
            </div>

            <h2 className={styles.confirmTitle}>
              {confirmDialog === 'restart' ? 'RESTART LEVEL?' : 'QUIT TO MENU?'}
            </h2>

            <p className={styles.confirmMessage}>
              {confirmDialog === 'restart'
                ? 'All progress in this level will be lost. Your checkpoint will be reset to the start of this mission.'
                : 'Your current mission progress will be lost. You will return to the main menu.'}
            </p>

            <div className={styles.confirmButtons}>
              <MilitaryButton onClick={handleCancelConfirm} size="sm">
                CANCEL
              </MilitaryButton>
              <MilitaryButton
                variant={confirmDialog === 'quit' ? 'danger' : 'default'}
                onClick={handleConfirmAction}
                buttonRef={confirmButtonRef}
                size="sm"
              >
                {confirmDialog === 'restart' ? 'RESTART' : 'QUIT'}
              </MilitaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
