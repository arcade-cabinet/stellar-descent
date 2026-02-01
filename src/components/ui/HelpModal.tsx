import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './HelpModal.module.css';
import { MilitaryButton } from './MilitaryButton';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type HelpSection = 'objective' | 'controls' | 'gameplay' | 'tips';

const SECTIONS: { id: HelpSection; label: string }[] = [
  { id: 'objective', label: 'OBJECTIVE' },
  { id: 'controls', label: 'CONTROLS' },
  { id: 'gameplay', label: 'GAMEPLAY' },
  { id: 'tips', label: 'TIPS' },
];

/**
 * HelpModal - Game guide modal with military terminal styling
 *
 * Displays comprehensive game information including:
 * - Mission objective
 * - Controls for desktop and mobile
 * - Gameplay mechanics
 * - Combat tips
 */
export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeSection, setActiveSection] = useState<HelpSection>('objective');
  const [screenInfo, setScreenInfo] = useState(() => getScreenInfo());
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isMobile = screenInfo.deviceType === 'mobile' || screenInfo.deviceType === 'foldable';

  useEffect(() => {
    const handleResize = () => setScreenInfo(getScreenInfo());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Focus close button on open
  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusOut = (e: FocusEvent) => {
      if (
        containerRef.current &&
        e.relatedTarget &&
        !containerRef.current.contains(e.relatedTarget as Node)
      ) {
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener('focusout', handleFocusOut);
    return () => document.removeEventListener('focusout', handleFocusOut);
  }, [isOpen]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleSectionChange = useCallback(
    (section: HelpSection) => {
      playClickSound();
      setActiveSection(section);
    },
    [playClickSound]
  );

  const handleClose = useCallback(() => {
    playClickSound();
    onClose();
  }, [playClickSound, onClose]);

  if (!isOpen) return null;

  const renderObjectiveSection = () => (
    <div className={styles.sectionContent}>
      <div className={styles.missionBrief}>
        <div className={styles.briefingHeader}>
          <span className={styles.briefingIcon}>{'\u25C9'}</span>
          <span className={styles.briefingLabel}>MISSION BRIEFING</span>
        </div>
        <p className={styles.briefingText}>
          You are a Drop Trooper in the 7th Marines. Your mission: survive the Proxima Breach and
          eliminate the alien threat.
        </p>
        <div className={styles.briefingDetails}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>UNIT</span>
            <span className={styles.detailValue}>7th Drop Marines</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>DESIGNATION</span>
            <span className={styles.detailValue}>Drop Trooper</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>OPERATION</span>
            <span className={styles.detailValue}>Proxima Breach</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderControlsSection = () => (
    <div className={styles.sectionContent}>
      {!isMobile ? (
        <>
          <div className={styles.controlsSubsection}>
            <h3 className={styles.subsectionTitle}>DESKTOP CONTROLS</h3>
            <div className={styles.controlsGrid}>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>WASD</span>
                <span className={styles.controlAction}>Move</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>MOUSE</span>
                <span className={styles.controlAction}>Look</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>LEFT CLICK</span>
                <span className={styles.controlAction}>Fire</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>R</span>
                <span className={styles.controlAction}>Reload</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>E</span>
                <span className={styles.controlAction}>Interact</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>SHIFT</span>
                <span className={styles.controlAction}>Sprint</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>C</span>
                <span className={styles.controlAction}>Crouch</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>ESC</span>
                <span className={styles.controlAction}>Pause</span>
              </div>
            </div>
          </div>
          <div className={styles.controlsNote}>
            Click on screen to lock mouse for aiming. Customize bindings in Settings.
          </div>
        </>
      ) : (
        <>
          <div className={styles.controlsSubsection}>
            <h3 className={styles.subsectionTitle}>MOBILE CONTROLS</h3>
            <div className={styles.controlsGrid}>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>LEFT STICK</span>
                <span className={styles.controlAction}>Move</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>RIGHT AREA</span>
                <span className={styles.controlAction}>Look</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>FIRE BUTTON</span>
                <span className={styles.controlAction}>Shoot</span>
              </div>
              <div className={styles.controlItem}>
                <span className={styles.controlKey}>WEAPON RACK</span>
                <span className={styles.controlAction}>Switch Weapons</span>
              </div>
            </div>
          </div>
          <div className={styles.controlsNote}>
            Touch controls adapt to landscape orientation. Rotate device for best experience.
          </div>
        </>
      )}
    </div>
  );

  const renderGameplaySection = () => (
    <div className={styles.sectionContent}>
      <div className={styles.gameplayList}>
        <div className={styles.gameplayItem}>
          <span className={styles.gameplayIcon}>{'\u25B6'}</span>
          <div className={styles.gameplayContent}>
            <span className={styles.gameplayTitle}>Complete Objectives</span>
            <span className={styles.gameplayDesc}>
              Follow mission markers to progress through the campaign
            </span>
          </div>
        </div>
        <div className={styles.gameplayItem}>
          <span className={styles.gameplayIcon}>{'\u266A'}</span>
          <div className={styles.gameplayContent}>
            <span className={styles.gameplayTitle}>Find Audio Logs</span>
            <span className={styles.gameplayDesc}>
              Discover hidden recordings to uncover the story
            </span>
          </div>
        </div>
        <div className={styles.gameplayItem}>
          <span className={styles.gameplayIcon}>{'\u2605'}</span>
          <div className={styles.gameplayContent}>
            <span className={styles.gameplayTitle}>Discover Secrets</span>
            <span className={styles.gameplayDesc}>
              Explore off-path areas for bonus upgrades and collectibles
            </span>
          </div>
        </div>
        <div className={styles.gameplayItem}>
          <span className={styles.gameplayIcon}>{'\u2620'}</span>
          <div className={styles.gameplayContent}>
            <span className={styles.gameplayTitle}>Defeat the Queen</span>
            <span className={styles.gameplayDesc}>
              Your ultimate goal: eliminate the alien threat to save humanity
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTipsSection = () => (
    <div className={styles.sectionContent}>
      <div className={styles.tipsList}>
        <div className={styles.tipItem}>
          <span className={styles.tipMarker}>{'\u25AA'}</span>
          <span className={styles.tipText}>Use cover in combat to minimize damage taken</span>
        </div>
        <div className={styles.tipItem}>
          <span className={styles.tipMarker}>{'\u25AA'}</span>
          <span className={styles.tipText}>Reload before engaging enemies when possible</span>
        </div>
        <div className={styles.tipItem}>
          <span className={styles.tipMarker}>{'\u25AA'}</span>
          <span className={styles.tipText}>
            Aim for weak points on large enemies for critical damage
          </span>
        </div>
        <div className={styles.tipItem}>
          <span className={styles.tipMarker}>{'\u25AA'}</span>
          <span className={styles.tipText}>
            Marcus has your back in co-op levels - coordinate with him
          </span>
        </div>
        <div className={styles.tipItem}>
          <span className={styles.tipMarker}>{'\u25AA'}</span>
          <span className={styles.tipText}>
            Different weapons are effective against different enemy types
          </span>
        </div>
        <div className={styles.tipItem}>
          <span className={styles.tipMarker}>{'\u25AA'}</span>
          <span className={styles.tipText}>
            Listen for audio cues to detect enemies before they appear
          </span>
        </div>
      </div>
      <div className={styles.tipsNote}>
        <span className={styles.noteIcon}>{'\u26A0'}</span>
        <span className={styles.noteText}>
          Difficulty can be adjusted in Settings if missions prove too challenging.
        </span>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'objective':
        return renderObjectiveSection();
      case 'controls':
        return renderControlsSection();
      case 'gameplay':
        return renderGameplaySection();
      case 'tips':
        return renderTipsSection();
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
    <div
      className={styles.overlay}
      onClick={handleClose}
      onKeyDown={(e) => e.key === 'Escape' && handleClose()}
      role="presentation"
    >
      <div
        ref={containerRef}
        className={styles.container}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        {/* Corner decorations */}
        <div className={styles.cornerTL} aria-hidden="true" />
        <div className={styles.cornerTR} aria-hidden="true" />
        <div className={styles.cornerBL} aria-hidden="true" />
        <div className={styles.cornerBR} aria-hidden="true" />

        {/* Header */}
        <div className={styles.header}>
          <h1 id="help-title" className={styles.title}>
            OPERATIONS MANUAL
          </h1>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close help modal"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Tab Navigation */}
        <nav className={styles.tabNav} aria-label="Help sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`${styles.tabButton} ${activeSection === section.id ? styles.tabActive : ''}`}
              onClick={() => handleSectionChange(section.id)}
              aria-selected={activeSection === section.id}
              role="tab"
            >
              {section.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content} role="tabpanel">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <MilitaryButton onClick={handleClose} size="sm">
            CLOSE
          </MilitaryButton>
        </div>
      </div>
    </div>
  );
}
