import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { GAME_SUBTITLE, GAME_TITLE, GAME_VERSION, LORE } from '../../game/core/lore';
import { worldDb } from '../../game/db/worldDatabase';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './MainMenu.module.css';

interface MainMenuProps {
  onStart: () => void;
  onSkipTutorial?: () => void;
}

export function MainMenu({ onStart, onSkipTutorial }: MainMenuProps) {
  const [showControls, setShowControls] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenInfo = getScreenInfo();
  const isMobile = screenInfo.deviceType === 'mobile' || screenInfo.deviceType === 'foldable';

  useEffect(() => {
    const checkSave = async () => {
      await worldDb.init();
      setHasSave(worldDb.hasSaveData());
    };
    checkSave();
  }, []);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleStart = useCallback(() => {
    playClickSound();
    onStart();
  }, [onStart, playClickSound]);

  const handleContinue = useCallback(() => {
    playClickSound();
    onStart();
  }, [onStart, playClickSound]);

  const handleSkipTutorial = useCallback(() => {
    playClickSound();
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

    const blob = new Blob([data as any], { type: 'application/x-sqlite3' });
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
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={handleStart}
          >
            <span className={styles.buttonIcon}>▶</span>
            NEW CAMPAIGN
          </button>

          <button
            type="button"
            className={`${styles.button} ${!hasSave ? styles.disabled : ''}`}
            disabled={!hasSave}
            onClick={handleContinue}
          >
            <span className={styles.buttonIcon}>◆</span>
            CONTINUE
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

          <button type="button" className={styles.button} onClick={handleShowControls}>
            <span className={styles.buttonIcon}>◈</span>
            CONTROLS
          </button>
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
          role="button"
          tabIndex={0}
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
                    <span className={styles.controlKey}>W A S D</span>
                    <span className={styles.controlAction}>Move</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>MOUSE</span>
                    <span className={styles.controlAction}>Aim / Look</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>LEFT CLICK</span>
                    <span className={styles.controlAction}>Fire</span>
                  </div>
                  <div className={styles.controlItem}>
                    <span className={styles.controlKey}>SHIFT</span>
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
    </div>
  );
}
