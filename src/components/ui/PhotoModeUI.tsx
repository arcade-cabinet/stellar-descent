/**
 * PhotoModeUI - React UI component for Photo Mode
 *
 * Features:
 * - Real-time preview with adjustable settings
 * - Filter preset selection
 * - Sliders for FOV, DoF, exposure, etc.
 * - Capture button with flash animation
 * - Photo gallery viewer
 * - Keyboard hint display
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getPhotoMode,
  type PhotoFilter,
  type PhotoMetadata,
  type PhotoModeSettings,
} from '../../game/modes/PhotoMode';
import { getAudioManager } from '../../game/core/AudioManager';
import styles from './PhotoModeUI.module.css';

// ============================================================================
// TYPES
// ============================================================================

interface PhotoModeUIProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// FILTER DISPLAY NAMES
// ============================================================================

const FILTER_NAMES: Record<PhotoFilter, string> = {
  normal: 'Normal',
  cinematic: 'Cinema',
  noir: 'Noir',
  vintage: 'Vintage',
  neon: 'Neon',
  horror: 'Horror',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PhotoModeUI({ isOpen, onClose }: PhotoModeUIProps) {
  // State
  const [settings, setSettings] = useState<PhotoModeSettings | null>(null);
  const [showSettings, setShowSettings] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [gallery, setGallery] = useState<PhotoMetadata[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMetadata | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const photoMode = getPhotoMode();

  // Initialize settings from PhotoMode
  useEffect(() => {
    if (isOpen && photoMode) {
      setSettings(photoMode.getSettings());
      setGallery(photoMode.getGallery());
    }
  }, [isOpen, photoMode]);

  // Sync settings changes from PhotoMode
  useEffect(() => {
    if (!isOpen || !photoMode) return;

    const interval = setInterval(() => {
      const currentSettings = photoMode.getSettings();
      setSettings(currentSettings);
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, photoMode]);

  // Play click sound
  const playClick = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  // ============================================================================
  // SETTINGS HANDLERS
  // ============================================================================

  const updateSetting = useCallback(
    <K extends keyof PhotoModeSettings>(key: K, value: PhotoModeSettings[K]) => {
      if (!photoMode) return;
      photoMode.updateSettings({ [key]: value });
      setSettings(photoMode.getSettings());
    },
    [photoMode]
  );

  const handleFilterChange = useCallback(
    (filter: PhotoFilter) => {
      playClick();
      if (!photoMode) return;
      photoMode.applyFilter(filter);
      setSettings(photoMode.getSettings());
    },
    [photoMode, playClick]
  );

  const handleReset = useCallback(() => {
    playClick();
    if (!photoMode) return;
    photoMode.resetSettings();
    setSettings(photoMode.getSettings());
  }, [photoMode, playClick]);

  // ============================================================================
  // CAPTURE HANDLER
  // ============================================================================

  const handleCapture = useCallback(async () => {
    if (!photoMode || isCapturing) return;

    playClick();
    setIsCapturing(true);

    // Play shutter sound (use notification for capture confirmation)
    getAudioManager().play('notification', { volume: 0.5 });

    try {
      await photoMode.capturePhoto();
      setGallery(photoMode.getGallery());
    } finally {
      // Reset flash after animation
      setTimeout(() => setIsCapturing(false), 300);
    }
  }, [photoMode, isCapturing, playClick]);

  // ============================================================================
  // GALLERY HANDLERS
  // ============================================================================

  const handleOpenGallery = useCallback(() => {
    playClick();
    if (photoMode) {
      setGallery(photoMode.getGallery());
    }
    setShowGallery(true);
  }, [photoMode, playClick]);

  const handleCloseGallery = useCallback(() => {
    playClick();
    setShowGallery(false);
    setSelectedPhoto(null);
    setPreviewUrl(null);
  }, [playClick]);

  const handleSelectPhoto = useCallback(
    async (photo: PhotoMetadata) => {
      if (!photoMode) return;

      playClick();
      setSelectedPhoto(photo);

      // Load full image
      const blob = await photoMode.getPhoto(photo.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      }
    },
    [photoMode, playClick]
  );

  const handleClosePreview = useCallback(() => {
    playClick();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedPhoto(null);
    setPreviewUrl(null);
  }, [previewUrl, playClick]);

  const handleSharePhoto = useCallback(async () => {
    if (!photoMode || !selectedPhoto) return;
    playClick();
    await photoMode.sharePhoto(selectedPhoto.id);
  }, [photoMode, selectedPhoto, playClick]);

  const handleDeletePhoto = useCallback(
    async (photoId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!photoMode) return;

      playClick();

      // Confirm deletion
      if (!window.confirm('Delete this photo?')) return;

      await photoMode.deletePhoto(photoId);
      setGallery(photoMode.getGallery());

      // Close preview if viewing deleted photo
      if (selectedPhoto?.id === photoId) {
        handleClosePreview();
      }
    },
    [photoMode, selectedPhoto, handleClosePreview, playClick]
  );

  // ============================================================================
  // CLOSE HANDLER
  // ============================================================================

  const handleClose = useCallback(() => {
    playClick();
    if (showGallery) {
      handleCloseGallery();
    } else {
      onClose();
    }
  }, [showGallery, handleCloseGallery, onClose, playClick]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab to toggle settings panel
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowSettings((prev) => !prev);
      }

      // G to open gallery
      if (e.code === 'KeyG' && !showGallery) {
        e.preventDefault();
        handleOpenGallery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showGallery, handleOpenGallery]);

  // ============================================================================
  // FORMAT HELPERS
  // ============================================================================

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen || !settings) {
    return null;
  }

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.active : ''}`}>
      {/* Letterbox bars */}
      <div
        className={`${styles.letterbox} ${styles.letterboxTop} ${
          !settings.showLetterbox ? styles.hidden : ''
        }`}
      />
      <div
        className={`${styles.letterbox} ${styles.letterboxBottom} ${
          !settings.showLetterbox ? styles.hidden : ''
        }`}
      />

      {/* Info Panel - Camera stats */}
      <div className={`${styles.infoPanel} ${!showSettings ? styles.hidden : ''}`}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>FOV</span>
          <span className={styles.infoValue}>{settings.fov.toFixed(0)}deg</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>FILTER</span>
          <span className={styles.infoValue}>{FILTER_NAMES[settings.filter]}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>PHOTOS</span>
          <span className={styles.infoValue}>{gallery.length}</span>
        </div>
      </div>

      {/* Settings Panel */}
      <div className={`${styles.settingsPanel} ${!showSettings ? styles.hidden : ''}`}>
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />

        <div className={styles.settingsHeader}>
          <h3 className={styles.settingsTitle}>Photo Settings</h3>
          <button
            className={styles.closeSettingsButton}
            onClick={() => setShowSettings(false)}
            type="button"
            aria-label="Hide settings"
          >
            x
          </button>
        </div>

        <div className={styles.settingsContent}>
          {/* Filter Presets */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Filter Preset</h4>
            <div className={styles.filterGrid}>
              {(Object.keys(FILTER_NAMES) as PhotoFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`${styles.filterButton} ${
                    settings.filter === filter ? styles.active : ''
                  }`}
                  onClick={() => handleFilterChange(filter)}
                >
                  {FILTER_NAMES[filter]}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Settings */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Camera</h4>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Field of View</span>
                <span className={styles.sliderValue}>{settings.fov.toFixed(0)}</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="30"
                max="120"
                step="1"
                value={settings.fov}
                onChange={(e) => updateSetting('fov', Number(e.target.value))}
              />
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Focus Distance</span>
                <span className={styles.sliderValue}>{settings.focusDistance.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0.5"
                max="100"
                step="0.5"
                value={settings.focusDistance}
                onChange={(e) => updateSetting('focusDistance', Number(e.target.value))}
              />
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Depth of Field</span>
                <span className={styles.sliderValue}>
                  {(settings.depthOfField * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max="1"
                step="0.01"
                value={settings.depthOfField}
                onChange={(e) => updateSetting('depthOfField', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Effects */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Effects</h4>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Exposure</span>
                <span className={styles.sliderValue}>{settings.exposure.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0.5"
                max="2"
                step="0.05"
                value={settings.exposure}
                onChange={(e) => updateSetting('exposure', Number(e.target.value))}
              />
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Contrast</span>
                <span className={styles.sliderValue}>{settings.contrast.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0.5"
                max="2"
                step="0.05"
                value={settings.contrast}
                onChange={(e) => updateSetting('contrast', Number(e.target.value))}
              />
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Saturation</span>
                <span className={styles.sliderValue}>{settings.saturation.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max="2"
                step="0.05"
                value={settings.saturation}
                onChange={(e) => updateSetting('saturation', Number(e.target.value))}
              />
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Vignette</span>
                <span className={styles.sliderValue}>
                  {(settings.vignette * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max="1"
                step="0.05"
                value={settings.vignette}
                onChange={(e) => updateSetting('vignette', Number(e.target.value))}
              />
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Film Grain</span>
                <span className={styles.sliderValue}>
                  {(settings.filmGrain * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max="0.3"
                step="0.01"
                value={settings.filmGrain}
                onChange={(e) => updateSetting('filmGrain', Number(e.target.value))}
              />
            </div>

            <div className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>Bloom</span>
                <span className={styles.sliderValue}>{settings.bloom.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min="0"
                max="2"
                step="0.1"
                value={settings.bloom}
                onChange={(e) => updateSetting('bloom', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Toggles */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Display</h4>

            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Letterbox</span>
              <button
                type="button"
                className={`${styles.toggleButton} ${
                  settings.showLetterbox ? styles.active : ''
                }`}
                onClick={() => updateSetting('showLetterbox', !settings.showLetterbox)}
                aria-pressed={settings.showLetterbox}
              />
            </div>

            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Hide Game UI</span>
              <button
                type="button"
                className={`${styles.toggleButton} ${settings.hideUI ? styles.active : ''}`}
                onClick={() => updateSetting('hideUI', !settings.hideUI)}
                aria-pressed={settings.hideUI}
              />
            </div>
          </div>

          {/* Reset */}
          <button type="button" className={styles.resetButton} onClick={handleReset}>
            Reset to Default
          </button>
        </div>
      </div>

      {/* Main Controls */}
      <div className={`${styles.controlPanel} ${showGallery ? styles.hidden : ''}`}>
        <div className={styles.mainControls}>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => setShowSettings((prev) => !prev)}
          >
            <span className={styles.buttonIcon}>{showSettings ? '-' : '+'}</span>
            <span className={styles.buttonLabel}>Settings</span>
          </button>

          <button
            type="button"
            className={`${styles.captureButton} ${isCapturing ? styles.captureFlash : ''}`}
            onClick={handleCapture}
            aria-label="Capture photo"
          />

          <button
            type="button"
            className={styles.controlButton}
            onClick={handleOpenGallery}
          >
            <span className={styles.buttonIcon}>&#9633;</span>
            <span className={styles.buttonLabel}>Gallery</span>
          </button>

          <button
            type="button"
            className={`${styles.controlButton} ${styles.primary}`}
            onClick={handleClose}
          >
            <span className={styles.buttonLabel}>Exit</span>
          </button>
        </div>

        <div className={styles.hints}>
          <div className={styles.hint}>
            <span className={styles.hintKey}>WASD</span>
            <span>Move</span>
          </div>
          <div className={styles.hint}>
            <span className={styles.hintKey}>Q/E</span>
            <span>Up/Down</span>
          </div>
          <div className={styles.hint}>
            <span className={styles.hintKey}>Scroll</span>
            <span>Speed</span>
          </div>
          <div className={styles.hint}>
            <span className={styles.hintKey}>Space</span>
            <span>Capture</span>
          </div>
          <div className={styles.hint}>
            <span className={styles.hintKey}>Tab</span>
            <span>Settings</span>
          </div>
          <div className={styles.hint}>
            <span className={styles.hintKey}>Esc</span>
            <span>Exit</span>
          </div>
        </div>
      </div>

      {/* Gallery Overlay */}
      {showGallery && (
        <div className={styles.galleryOverlay}>
          <div className={styles.galleryHeader}>
            <h2 className={styles.galleryTitle}>
              Photo Gallery
              <span className={styles.galleryCount}>({gallery.length})</span>
            </h2>
            <button
              type="button"
              className={styles.galleryCloseButton}
              onClick={handleCloseGallery}
            >
              Close
            </button>
          </div>

          <div className={styles.galleryContent}>
            {gallery.length === 0 ? (
              <div className={styles.galleryEmpty}>
                <div className={styles.galleryEmptyIcon}>&#128247;</div>
                <div className={styles.galleryEmptyText}>No photos yet</div>
                <div className={styles.galleryEmptyHint}>
                  Press Space or the capture button to take photos
                </div>
              </div>
            ) : (
              <div className={styles.galleryGrid}>
                {gallery.map((photo) => (
                  <div
                    key={photo.id}
                    className={`${styles.galleryItem} ${
                      selectedPhoto?.id === photo.id ? styles.selected : ''
                    }`}
                    onClick={() => handleSelectPhoto(photo)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSelectPhoto(photo)}
                    role="button"
                    tabIndex={0}
                  >
                    {photo.thumbnail ? (
                      <img
                        src={photo.thumbnail}
                        alt={`Photo taken ${formatDate(photo.timestamp)}`}
                        className={styles.galleryThumbnail}
                      />
                    ) : (
                      <div className={styles.galleryThumbnail} />
                    )}
                    <div className={styles.galleryItemOverlay}>
                      <span className={styles.galleryItemDate}>
                        {formatDate(photo.timestamp)}
                      </span>
                      <span className={styles.galleryItemFilter}>
                        {FILTER_NAMES[photo.filter]}
                      </span>
                    </div>
                    <div className={styles.galleryActions}>
                      <button
                        type="button"
                        className={`${styles.galleryActionButton} ${styles.delete}`}
                        onClick={(e) => handleDeletePhoto(photo.id, e)}
                        aria-label="Delete photo"
                      >
                        &#10005;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Preview */}
      {selectedPhoto && previewUrl && (
        <div
          className={styles.previewOverlay}
          onClick={handleClosePreview}
          onKeyDown={(e) => e.key === 'Escape' && handleClosePreview()}
          role="button"
          tabIndex={0}
        >
          <div
            className={styles.previewContainer}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <button
              type="button"
              className={styles.previewCloseButton}
              onClick={handleClosePreview}
            >
              Close
            </button>
            <img
              src={previewUrl}
              alt={`Photo preview - ${formatDate(selectedPhoto.timestamp)}`}
              className={styles.previewImage}
            />
            <div className={styles.previewActions}>
              <button
                type="button"
                className={styles.controlButton}
                onClick={handleSharePhoto}
              >
                <span className={styles.buttonIcon}>&#8599;</span>
                <span className={styles.buttonLabel}>Share/Download</span>
              </button>
              <button
                type="button"
                className={`${styles.controlButton} ${styles.delete}`}
                onClick={() => handleDeletePhoto(selectedPhoto.id)}
              >
                <span className={styles.buttonLabel}>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotoModeUI;
