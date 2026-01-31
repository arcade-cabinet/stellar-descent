import { Capacitor } from '@capacitor/core';
import { getLogger } from '../../game/core/Logger';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../../game/context/GameContext';
import { getAudioManager } from '../../game/core/AudioManager';
import { disposeSplashAudioManager, getSplashAudioManager } from '../../game/core/audio/SplashAudioManager';
import { type DifficultyLevel, getDifficultyDisplayName } from '../../game/core/DifficultySettings';
import { GAME_SUBTITLE, GAME_TITLE, GAME_VERSION, LORE } from '../../game/core/lore';
import type { LevelId } from '../../game/levels/types';
import {
  formatPlayTime,
  type GameSaveMetadata,
  getLevelDisplayName,
  saveSystem,
} from '../../game/persistence';
import { AchievementsPanel } from './AchievementsPanel';
import { DifficultySelector } from './DifficultySelector';
import { HelpModal } from './HelpModal';
// PWA install is handled transparently - no button or prompt needed
import { LevelSelect } from './LevelSelect';
import styles from './MainMenu.module.css';
import { MilitaryButton } from './MilitaryButton';
import { SettingsMenu } from './SettingsMenu';

const log = getLogger('MainMenu');

interface MainMenuProps {
  onStart: () => void;
  onNewGame?: (difficulty: DifficultyLevel, startLevel: LevelId) => void;
  onContinue?: () => void;
  onSelectLevel?: (levelId: LevelId) => void;
  onReplayTitle?: () => void;
}

export function MainMenu({
  onStart,
  onNewGame,
  onContinue,
  onSelectLevel,
  onReplayTitle,
}: MainMenuProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [showCampaignSelect, setShowCampaignSelect] = useState(false);
  const [showDifficultySelect, setShowDifficultySelect] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [saveMetadata, setSaveMetadata] = useState<GameSaveMetadata | null>(null);
  const [selectedStartLevel, setSelectedStartLevel] = useState<LevelId | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { difficulty } = useGame();

  // Check if running on web platform (not native iOS/Android)
  const isWebPlatform = !Capacitor.isNativePlatform();

  useEffect(() => {
    const checkSave = async () => {
      await saveSystem.initialize();
      const hasSaveData = await saveSystem.hasSave();
      setHasSave(hasSaveData);
      if (hasSaveData) {
        const metadata = await saveSystem.getSaveMetadata();
        setSaveMetadata(metadata);
      }
    };
    checkSave();
  }, []);

  // Start menu music with crossfade from splash audio
  useEffect(() => {
    const audioManager = getAudioManager();
    const splashAudioManager = getSplashAudioManager();

    // Check if splash audio is still playing (indicates we came from splash screen)
    const isFromSplash = splashAudioManager.isCurrentlyPlaying();

    if (isFromSplash) {
      // Use crossfade transition from splash audio
      log.info('Starting menu music with crossfade from splash');
      audioManager.playMusicWithCrossfadeFromSplash('menu', 2);

      // Dispose splash audio manager after crossfade completes
      setTimeout(() => {
        disposeSplashAudioManager();
        log.info('Splash audio manager disposed after crossfade');
      }, 2500);
    } else {
      // Normal menu music start (e.g., returning from game)
      audioManager.playMusic('menu', 1.5);
    }

    return () => {
      // Don't stop music on unmount - let it crossfade to next track
    };
  }, []);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleNewGame = useCallback(() => {
    playClickSound();
    // If there's an existing save, ask for confirmation first
    if (hasSave) {
      setShowNewGameConfirm(true);
    } else {
      // No save exists, show campaign selection first
      setShowCampaignSelect(true);
    }
  }, [hasSave, playClickSound]);

  // When difficulty is selected in the difficulty modal, just store it
  const handleDifficultySelect = useCallback(
    (diff: DifficultyLevel) => {
      setSelectedDifficulty(diff);
    },
    []
  );

  // When START CAMPAIGN is clicked in difficulty modal
  const handleStartCampaign = useCallback(() => {
    playClickSound();
    if (!selectedStartLevel || !selectedDifficulty) return;

    setShowDifficultySelect(false);
    // Use onNewGame if available (dispatches to CampaignDirector)
    if (onNewGame) {
      onNewGame(selectedDifficulty, selectedStartLevel);
    } else {
      // Fallback to legacy behavior
      saveSystem.newGame(selectedDifficulty, selectedStartLevel).then(() => {
        onStart();
      });
    }
  }, [selectedStartLevel, selectedDifficulty, onStart, onNewGame, playClickSound]);

  // Go back from difficulty to campaign selection
  const handleBackToCampaign = useCallback(() => {
    playClickSound();
    setShowDifficultySelect(false);
    setShowCampaignSelect(true);
  }, [playClickSound]);

  const handleCancelDifficultySelect = useCallback(() => {
    playClickSound();
    setShowDifficultySelect(false);
    setSelectedStartLevel(null);
    setSelectedDifficulty(null);
  }, [playClickSound]);

  // After confirming overwrite, show campaign selection
  const handleConfirmNewGame = useCallback(async () => {
    playClickSound();
    setShowNewGameConfirm(false);
    setShowCampaignSelect(true);
  }, [playClickSound]);

  const handleCancelNewGame = useCallback(() => {
    playClickSound();
    setShowNewGameConfirm(false);
  }, [playClickSound]);

  // When a level is selected in campaign selection, proceed to difficulty
  const handleCampaignLevelSelect = useCallback(
    (levelId: LevelId) => {
      playClickSound();
      setSelectedStartLevel(levelId);
      setShowCampaignSelect(false);
      setShowDifficultySelect(true);
    },
    [playClickSound]
  );

  const handleCancelCampaignSelect = useCallback(() => {
    playClickSound();
    setShowCampaignSelect(false);
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

  const handleLoadClick = useCallback(() => {
    playClickSound();
    fileInputRef.current?.click();
  }, [playClickSound]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        // Use SaveSystem's import method which handles validation and error reporting
        const success = await saveSystem.importDatabaseFile(file);
        if (success) {
          setHasSave(true);
          onStart();
        }
      } catch (err) {
        log.error('Failed to load save file', err);
        alert(`Failed to load save file: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onStart]
  );

  const handleShowSettings = useCallback(() => {
    playClickSound();
    setShowSettings(true);
  }, [playClickSound]);

  const handleCloseSettings = useCallback(() => {
    playClickSound();
    setShowSettings(false);
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

  const handleShowHelp = useCallback(() => {
    playClickSound();
    setShowHelp(true);
  }, [playClickSound]);

  const handleCloseHelp = useCallback(() => {
    playClickSound();
    setShowHelp(false);
  }, [playClickSound]);

  return (
    <div className={styles.overlay}>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".db,.sqlite,.json"
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

        {/* Two-column button layout */}
        <div className={styles.buttonColumns}>
          {/* Left Column - Game Actions */}
          <div className={styles.buttonColumn}>
            <MilitaryButton
              variant="primary"
              onClick={handleNewGame}
              icon={<>{'\u25B6'}</>}
            >
              NEW GAME
            </MilitaryButton>

            <MilitaryButton
              onClick={handleContinue}
              disabled={!hasSave}
              icon={<>{'\u25B6'}</>}
              info={
                saveMetadata
                  ? `Ch.${saveMetadata.currentChapter} - ${formatPlayTime(saveMetadata.playTime)}`
                  : undefined
              }
            >
              CONTINUE
            </MilitaryButton>

            <MilitaryButton onClick={handleLoadClick} icon={<>{'\u2191'}</>}>
              LOAD GAME
            </MilitaryButton>
          </div>

          {/* Right Column - System */}
          <div className={styles.buttonColumn}>
            <MilitaryButton onClick={handleShowSettings} icon={<>{'\u2699'}</>}>
              SETTINGS
            </MilitaryButton>

            <MilitaryButton onClick={handleShowAchievements} icon={<>{'\u2605'}</>}>
              ACHIEVEMENTS
            </MilitaryButton>

            <MilitaryButton onClick={handleShowHelp} icon={<>{'\u003F'}</>}>
              HELP
            </MilitaryButton>
          </div>
        </div>

        {/* Footer info */}
        <div className={styles.footer}>
          <span className={styles.footerLeft}>v{GAME_VERSION}</span>
          <span className={styles.footerCenter}>7TH DROP MARINES</span>
          <span className={styles.footerRight}>CLASSIFIED</span>
        </div>
      </div>

      {/* Settings Menu (includes Controls tab) */}
      <SettingsMenu isOpen={showSettings} onClose={handleCloseSettings} />

      {/* Level Select - used for New Game mission select */}
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
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="newgame-confirm-title"
            aria-describedby="newgame-confirm-desc"
          >
            <div className={styles.modalHeader}>
              <span id="newgame-confirm-title">START NEW CAMPAIGN?</span>
            </div>

            <div className={styles.modalContent}>
              <p id="newgame-confirm-desc" className={styles.confirmText}>
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
              <button
                type="button"
                className={styles.modalButton}
                onClick={handleCancelNewGame}
                aria-label="Cancel and keep existing save"
              >
                CANCEL
              </button>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.dangerButton}`}
                onClick={handleConfirmNewGame}
                aria-label="Confirm start new campaign"
              >
                START NEW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Selection Modal */}
      {showCampaignSelect && (
        <LevelSelect
          isOpen={showCampaignSelect}
          onClose={handleCancelCampaignSelect}
          onSelectLevel={handleCampaignLevelSelect}
        />
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
              <DifficultySelector onSelect={handleDifficultySelect} />
            </div>

            <div className={styles.modalButtons}>
              <button
                type="button"
                className={styles.modalButton}
                onClick={handleBackToCampaign}
              >
                ← BACK
              </button>
              <button
                type="button"
                className={`${styles.modalButton} ${styles.primaryButton}`}
                onClick={handleStartCampaign}
                disabled={!selectedDifficulty}
              >
                START CAMPAIGN →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      <HelpModal isOpen={showHelp} onClose={handleCloseHelp} />
    </div>
  );
}
