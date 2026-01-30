import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../../game/context/GameContext';
import {
  getKeyDisplayName,
  getPrimaryKey,
  useKeybindings,
} from '../../game/context/KeybindingsContext';
import { getAudioManager } from '../../game/core/AudioManager';
import { type DifficultyLevel, getDifficultyDisplayName } from '../../game/core/DifficultySettings';
import { GAME_SUBTITLE, GAME_TITLE, GAME_VERSION, LORE } from '../../game/core/lore';
import { worldDb } from '../../game/db/worldDatabase';
import type { LevelId } from '../../game/levels/types';
import {
  formatPlayTime,
  type GameSaveMetadata,
  getLevelDisplayName,
  saveSystem,
} from '../../game/persistence';
import { getScreenInfo } from '../../game/utils/responsive';
import { AchievementsPanel } from './AchievementsPanel';
import { DifficultySelector } from './DifficultySelector';
import { InstallPrompt, useInstallAvailable } from './InstallPrompt';
import { LevelSelect } from './LevelSelect';
import styles from './MainMenu.module.css';
import { SettingsMenu } from './SettingsMenu';

interface MainMenuProps {
  onStart: () => void;
  onContinue?: () => void;
  onSkipTutorial?: () => void;
  onSelectLevel?: (levelId: LevelId) => void;
  onReplayTitle?: () => void;
}

export function MainMenu({
  onStart,
  onContinue,
  onSkipTutorial,
  onSelectLevel,
  onReplayTitle,
}: MainMenuProps) {
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showDifficultySelect, setShowDifficultySelect] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [saveMetadata, setSaveMetadata] = useState<GameSaveMetadata | null>(null);
  const [screenInfo, setScreenInfo] = useState(() => getScreenInfo());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { keybindings } = useKeybindings();
  const { difficulty } = useGame();

  // PWA install availability
  const { isAvailable: canInstall, isStandalone } = useInstallAvailable();

  const isMobile = screenInfo.deviceType === 'mobile' || screenInfo.deviceType === 'foldable';

  useEffect(() => {
    const handleResize = () => setScreenInfo(getScreenInfo());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkSave = async () => {
      await saveSystem.initialize();
      const hasSaveData = saveSystem.hasSave();
      setHasSave(hasSaveData);
      if (hasSaveData) {
        const metadata = saveSystem.getSaveMetadata();
        setSaveMetadata(metadata);
      }
    };
    checkSave();
  }, []);

  // Start menu music
  useEffect(() => {
    const audioManager = getAudioManager();
    audioManager.playMusic('menu', 1.5);

    return () => {
      // Don't stop music on unmount - let it crossfade to next track
    };
  }, []);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleNewGame = useCallback(() => {
    playClickSound();
    // If there's an existing save, ask for confirmation
    if (hasSave) {
      setShowNewGameConfirm(true);
    } else {
      // No save exists, show difficulty selection first
      setShowDifficultySelect(true);
    }
  }, [hasSave, playClickSound]);

  const handleStartWithDifficulty = useCallback(
    (selectedDifficulty: DifficultyLevel) => {
      playClickSound();
      setShowDifficultySelect(false);
      saveSystem.newGame(selectedDifficulty).then(() => {
        onStart();
      });
    },
    [onStart, playClickSound]
  );

  const handleCancelDifficultySelect = useCallback(() => {
    playClickSound();
    setShowDifficultySelect(false);
  }, [playClickSound]);

  const handleConfirmNewGame = useCallback(async () => {
    playClickSound();
    setShowNewGameConfirm(false);
    // Show difficulty selection for the new game
    setShowDifficultySelect(true);
  }, [playClickSound]);

  const handleCancelNewGame = useCallback(() => {
    playClickSound();
    setShowNewGameConfirm(false);
  }, [playClickSound]);

  const handleContinue = useCallback(async () => {
    playClickSound();
    // Load the saved game
    const save = await saveSystem.loadGame();
    if (save && onContinue) {
      onContinue();
    } else if (save) {
      // Fallback to onStart if onContinue not provided
      onStart();
    }
  }, [onContinue, onStart, playClickSound]);

  const handleSkipTutorial = useCallback(async () => {
    playClickSound();
    // Create new game but skip tutorial
    await saveSystem.newGame();
    saveSystem.completeTutorial();
    saveSystem.setCurrentLevel('landfall');
    onSkipTutorial?.();
  }, [onSkipTutorial, playClickSound]);

  const handleLoadClick = useCallback(() => {
    playClickSound();
    fileInputRef.current?.click();
  }, [playClickSound]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        await worldDb.importDatabase(data);
        setHasSave(true);
        onStart();
      } catch (err) {
        console.error('Failed to load save file', err);
        // Alert user (simple fallback)
        alert(`Failed to load save file: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onStart]
  );

  const handleExport = useCallback(() => {
    playClickSound();
    const data = worldDb.exportDatabase();
    if (!data) return;

    // Create a copy in a standard ArrayBuffer for Blob compatibility
    const arrayBuffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(arrayBuffer).set(data);
    const blob = new Blob([arrayBuffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stellar_descent_save_${new Date().toISOString().slice(0, 10)}.db`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [playClickSound]);

  const handleShowControls = useCallback(() => {
    playClickSound();
    setShowControls(true);
  }, [playClickSound]);

  const handleCloseControls = useCallback(() => {
    playClickSound();
    setShowControls(false);
  }, [playClickSound]);

  const handleShowSettings = useCallback(() => {
    playClickSound();
    setShowSettings(true);
  }, [playClickSound]);

  const handleReplayTitle = useCallback(() => {
    playClickSound();
    onReplayTitle?.();
  }, [playClickSound, onReplayTitle]);

  const handleCloseSettings = useCallback(() => {
    playClickSound();
    setShowSettings(false);
  }, [playClickSound]);

  const handleShowLevelSelect = useCallback(() => {
    playClickSound();
    setShowLevelSelect(true);
  }, [playClickSound]);

  const handleCloseLevelSelect = useCallback(() => {
    playClickSound();
    setShowLevelSelect(false);
  }, [playClickSound]);

  const handleLevelSelect = useCallback(
    (levelId: LevelId) => {
      setShowLevelSelect(false);
      onSelectLevel?.(levelId);
    },
    [onSelectLevel]
  );

  const handleShowAchievements = useCallback(() => {
    playClickSound();
    setShowAchievements(true);
  }, [playClickSound]);

  const handleCloseAchievements = useCallback(() => {
    playClickSound();
    setShowAchievements(false);
  }, [playClickSound]);

  const handleShowInstall = useCallback(() => {
    playClickSound();
    setShowInstallPrompt(true);
  }, [playClickSound]);

  const handleCloseInstall = useCallback(() => {
    setShowInstallPrompt(false);
  }, []);

  return (
    <div className={styles.overlay}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".db,.sqlite"
        onChange={handleFileChange}
      />

      {/* Scan line effect */}
      <div className={styles.scanLines} />

      <div className={styles.container}>
        {/* Corner brackets */}
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />

        {/* Logo/Insignia */}
        <div className={styles.insignia}>
          <div className={styles.insigniaInner}>TEA</div>
        </div>

        {/* Title */}
        <h1 className={styles.title}>{GAME_TITLE}</h1>
        <h2 className={styles.subtitle}>{GAME_SUBTITLE}</h2>

        {/* Divider */}
        <div className={styles.divider}>
          <span className={styles.dividerText}>{LORE.setting.year}</span>
        </div>

        {/* Buttons */}
        <div className={styles.buttonGroup}>
          {/* Show CONTINUE as primary if save exists */}
          {hasSave && (
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={handleContinue}
            >
              <span className={styles.buttonIcon}>▶</span>
              CONTINUE
              {saveMetadata && (
                <span className={styles.saveInfo}>
                  Ch.{saveMetadata.currentChapter} - {formatPlayTime(saveMetadata.playTime)} -{' '}
                  {getDifficultyDisplayName(saveMetadata.difficulty)}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            className={`${styles.button} ${!hasSave ? styles.primaryButton : ''}`}
            onClick={handleNewGame}
          >
            <span className={styles.buttonIcon}>{hasSave ? '◆' : '▶'}</span>
            NEW CAMPAIGN
          </button>

          <button type="button" className={styles.button} onClick={handleLoadClick}>
            <span className={styles.buttonIcon}>▲</span>
            LOAD CAMPAIGN
          </button>

          {hasSave && (
            <button type="button" className={styles.button} onClick={handleExport}>
              <span className={styles.buttonIcon}>▼</span>
              EXPORT SAVE
            </button>
          )}

          {onSkipTutorial && (
            <button type="button" className={styles.button} onClick={handleSkipTutorial}>
              <span className={styles.buttonIcon}>⬇</span>
              HALO DROP
            </button>
          )}

          {onSelectLevel && (
            <button type="button" className={styles.button} onClick={handleShowLevelSelect}>
              <span className={styles.buttonIcon}>&#9632;</span>
              SELECT MISSION
            </button>
          )}

          <button type="button" className={styles.button} onClick={handleShowAchievements}>
            <span className={styles.buttonIcon}>{'\u2605'}</span>
            ACHIEVEMENTS
          </button>

          <button type="button" className={styles.button} onClick={handleShowControls}>
            <span className={styles.buttonIcon}>◈</span>
            CONTROLS
          </button>

          <button type="button" className={styles.button} onClick={handleShowSettings}>
            <span className={styles.buttonIcon}>⚙</span>
            SETTINGS
          </button>

          {onReplayTitle && (
            <button type="button" className={styles.button} onClick={handleReplayTitle}>
              <span className={styles.buttonIcon}>&#9654;</span>
              REPLAY INTRO
            </button>
          )}

          {/* Install App button - only show when PWA install is available and not already installed */}
          {canInstall && !isStandalone && (
            <button type="button" className={styles.button} onClick={handleShowInstall}>
              <span className={styles.buttonIcon}>&#8681;</span>
              INSTALL APP
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className={styles.footer}>
          <span className={styles.footerLeft}>v{GAME_VERSION}</span>
          <span className={styles.footerCenter}>7TH DROP MARINES</span>
          <span className={styles.footerRight}>CLASSIFIED</span>
        </div>
      </div>

      {/* Controls Modal */}
      {showControls && (
        // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
        <div
          className={styles.modalOverlay}
          onClick={handleCloseControls}
          onKeyDown={(e) => e.key === 'Escape' && handleCloseControls()}
          role="presentation"
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className={styles.modalHeader}>
              <span>OPERATIONS MANUAL</span>
            </div>

            <div className={styles.modalContent}>
              {isMobile ? (
                <div className={styles.controlsGrid}>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>LEFT STICK</span>
                    <span className={styles.controlAction}>Move</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>RIGHT STICK</span>
                    <span className={styles.controlAction}>Aim / Look</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>FIRE</span>
                    <span className={styles.controlAction}>Shoot</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>RUN</span>
                    <span className={styles.controlAction}>Sprint</span>
                  </div>
                </div>
              ) : (
                <div className={styles.controlsGrid}>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>
                      {getKeyDisplayName(getPrimaryKey(keybindings.moveForward))}{' '}
                      {getKeyDisplayName(getPrimaryKey(keybindings.moveLeft))}{' '}
                      {getKeyDisplayName(getPrimaryKey(keybindings.moveBackward))}{' '}
                      {getKeyDisplayName(getPrimaryKey(keybindings.moveRight))} / Arrows
                    </span>
                    <span className={styles.controlAction}>Move</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>MOUSE</span>
                    <span className={styles.controlAction}>Aim / Look</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>
                      {getKeyDisplayName(getPrimaryKey(keybindings.fire))}
                    </span>
                    <span className={styles.controlAction}>Fire</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>
                      {getKeyDisplayName(getPrimaryKey(keybindings.sprint))}
                    </span>
                    <span className={styles.controlAction}>Sprint</span>
                  </div>
                </div>
              )}

              <div className={styles.controlsNote}>Click on screen to lock mouse for aiming</div>
            </div>

            <button type="button" className={styles.modalClose} onClick={handleCloseControls}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Settings Menu */}
      <SettingsMenu isOpen={showSettings} onClose={handleCloseSettings} />

      {/* Level Select */}
      <LevelSelect
        isOpen={showLevelSelect}
        onClose={handleCloseLevelSelect}
        onSelectLevel={handleLevelSelect}
      />

      {/* Achievements Panel */}
      <AchievementsPanel isOpen={showAchievements} onClose={handleCloseAchievements} />

      {/* New Game Confirmation Modal */}
      {showNewGameConfirm && (
        // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
        <div
          className={styles.modalOverlay}
          onClick={handleCancelNewGame}
          onKeyDown={(e) => e.key === 'Escape' && handleCancelNewGame()}
          role="presentation"
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className={styles.modalHeader}>
              <span>START NEW CAMPAIGN?</span>
            </div>

            <div className={styles.modalContent}>
              <p className={styles.confirmText}>
                Starting a new campaign will overwrite your existing save data.
              </p>
              {saveMetadata && (
                <div className={styles.savePreview}>
                  <div className={styles.savePreviewRow}>
                    <span>Current Progress:</span>
                    <span>Chapter {saveMetadata.currentChapter}</span>
                  </div>
                  <div className={styles.savePreviewRow}>
                    <span>Location:</span>
                    <span>{getLevelDisplayName(saveMetadata.currentLevel)}</span>
                  </div>
                  <div className={styles.savePreviewRow}>
                    <span>Play Time:</span>
                    <span>{formatPlayTime(saveMetadata.playTime)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalButtons}>
              <button type="button" className={styles.modalButton} onClick={handleCancelNewGame}>
                CANCEL
              </button>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.dangerButton}`}
                onClick={handleConfirmNewGame}
              >
                START NEW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Difficulty Selection Modal */}
      {showDifficultySelect && (
        // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
        <div
          className={styles.modalOverlay}
          onClick={handleCancelDifficultySelect}
          onKeyDown={(e) => e.key === 'Escape' && handleCancelDifficultySelect()}
          role="presentation"
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
          <div
            className={`${styles.modal} ${styles.difficultyModal}`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="difficulty-title"
          >
            <div className={styles.modalHeader}>
              <span id="difficulty-title">SELECT DIFFICULTY</span>
            </div>

            <div className={styles.modalContent}>
              <DifficultySelector onSelect={handleStartWithDifficulty} />
            </div>

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.modalButton}
                onClick={handleCancelDifficultySelect}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt triggerShow={showInstallPrompt} onClose={handleCloseInstall} />
    </div>
  );
}
