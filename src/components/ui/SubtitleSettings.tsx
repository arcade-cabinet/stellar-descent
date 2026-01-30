import type React from 'react';
import { useCallback, useMemo } from 'react';
import {
  DEFAULT_SUBTITLE_SETTINGS,
  type SpeakerType,
  type SubtitleFontSize,
  type SubtitlePosition,
  useSubtitles,
} from '../../game/context/SubtitleContext';
import { getAudioManager } from '../../game/core/AudioManager';
import styles from './SubtitleSettings.module.css';

/**
 * SubtitleSettings - Accessibility settings panel for subtitles
 *
 * Features:
 * - Enable/disable subtitles
 * - Font size selection (small/medium/large/extra-large)
 * - Position selection (top/bottom)
 * - Speaker name and prefix toggles
 * - Background opacity slider
 * - Live preview of changes
 */
/** Toggle keys that can be controlled in settings */
type ToggleKey =
  | 'enabled'
  | 'showSpeakerName'
  | 'showSpeakerPrefix'
  | 'highContrastMode'
  | 'textOutline'
  | 'showSoundEffects';

export function SubtitleSettings() {
  const { settings, updateSetting, resetSettings } = useSubtitles();

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleToggle = useCallback(
    (key: ToggleKey) => {
      playClickSound();
      updateSetting(key, !settings[key]);
    },
    [settings, updateSetting, playClickSound]
  );

  const handleFontSizeChange = useCallback(
    (size: SubtitleFontSize) => {
      playClickSound();
      updateSetting('fontSize', size);
    },
    [updateSetting, playClickSound]
  );

  const handlePositionChange = useCallback(
    (position: SubtitlePosition) => {
      playClickSound();
      updateSetting('position', position);
    },
    [updateSetting, playClickSound]
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(e.target.value);
      updateSetting('backgroundOpacity', value);
    },
    [updateSetting]
  );

  const handleReset = useCallback(() => {
    playClickSound();
    resetSettings();
  }, [resetSettings, playClickSound]);

  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SUBTITLE_SETTINGS);

  return (
    <div className={styles.container}>
      {/* Enable/Disable Toggle */}
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>Subtitles</span>
        <button
          type="button"
          className={`${styles.toggleButton} ${settings.enabled ? styles.toggleOn : ''}`}
          onClick={() => handleToggle('enabled')}
          aria-pressed={settings.enabled}
          aria-label={settings.enabled ? 'Disable subtitles' : 'Enable subtitles'}
        >
          {settings.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Font Size Selection */}
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>Font Size</span>
        <div className={styles.buttonGroup}>
          {(['small', 'medium', 'large', 'extra-large'] as SubtitleFontSize[]).map((size) => (
            <button
              key={size}
              type="button"
              className={`${styles.optionButton} ${settings.fontSize === size ? styles.optionActive : ''}`}
              onClick={() => handleFontSizeChange(size)}
              disabled={!settings.enabled}
              aria-pressed={settings.fontSize === size}
            >
              {size === 'extra-large' ? 'XL' : size.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Position Selection */}
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>Position</span>
        <div className={styles.buttonGroup}>
          {(['bottom', 'top'] as SubtitlePosition[]).map((pos) => (
            <button
              key={pos}
              type="button"
              className={`${styles.optionButton} ${settings.position === pos ? styles.optionActive : ''}`}
              onClick={() => handlePositionChange(pos)}
              disabled={!settings.enabled}
              aria-pressed={settings.position === pos}
            >
              {pos.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Show Speaker Name Toggle */}
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>Show Speaker Name</span>
        <button
          type="button"
          className={`${styles.toggleButton} ${settings.showSpeakerName ? styles.toggleOn : ''}`}
          onClick={() => handleToggle('showSpeakerName')}
          disabled={!settings.enabled}
          aria-pressed={settings.showSpeakerName}
        >
          {settings.showSpeakerName ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Show Speaker Prefix Toggle */}
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>Show Rank Prefix</span>
        <button
          type="button"
          className={`${styles.toggleButton} ${settings.showSpeakerPrefix ? styles.toggleOn : ''}`}
          onClick={() => handleToggle('showSpeakerPrefix')}
          disabled={!settings.enabled}
          aria-pressed={settings.showSpeakerPrefix}
        >
          {settings.showSpeakerPrefix ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Background Opacity Slider */}
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>
          Background Opacity ({Math.round(settings.backgroundOpacity * 100)}%)
        </span>
        <input
          type="range"
          min="0.3"
          max="1"
          step="0.1"
          value={settings.backgroundOpacity}
          onChange={handleOpacityChange}
          disabled={!settings.enabled}
          className={styles.slider}
          aria-label="Background opacity"
        />
      </div>

      {/* Accessibility Divider */}
      <div className={styles.sectionDivider}>
        <span className={styles.sectionLabel}>ACCESSIBILITY</span>
      </div>

      {/* High Contrast Mode Toggle */}
      <div className={styles.settingRow}>
        <div className={styles.settingLabelGroup}>
          <span className={styles.settingLabel}>High Contrast Mode</span>
          <span className={styles.settingDescription}>Increases text visibility</span>
        </div>
        <button
          type="button"
          className={`${styles.toggleButton} ${settings.highContrastMode ? styles.toggleOn : ''}`}
          onClick={() => handleToggle('highContrastMode')}
          disabled={!settings.enabled}
          aria-pressed={settings.highContrastMode}
          aria-label={settings.highContrastMode ? 'Disable high contrast' : 'Enable high contrast'}
        >
          {settings.highContrastMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Text Outline Toggle */}
      <div className={styles.settingRow}>
        <div className={styles.settingLabelGroup}>
          <span className={styles.settingLabel}>Text Outline</span>
          <span className={styles.settingDescription}>Adds shadow for readability</span>
        </div>
        <button
          type="button"
          className={`${styles.toggleButton} ${settings.textOutline ? styles.toggleOn : ''}`}
          onClick={() => handleToggle('textOutline')}
          disabled={!settings.enabled}
          aria-pressed={settings.textOutline}
          aria-label={settings.textOutline ? 'Disable text outline' : 'Enable text outline'}
        >
          {settings.textOutline ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Sound Effect Descriptions Toggle */}
      <div className={styles.settingRow}>
        <div className={styles.settingLabelGroup}>
          <span className={styles.settingLabel}>Sound Effect Captions</span>
          <span className={styles.settingDescription}>[GUNFIRE], [EXPLOSION], etc.</span>
        </div>
        <button
          type="button"
          className={`${styles.toggleButton} ${settings.showSoundEffects ? styles.toggleOn : ''}`}
          onClick={() => handleToggle('showSoundEffects')}
          disabled={!settings.enabled}
          aria-pressed={settings.showSoundEffects}
          aria-label={settings.showSoundEffects ? 'Disable sound effects' : 'Enable sound effects'}
        >
          {settings.showSoundEffects ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Preview */}
      {settings.enabled && (
        <div className={styles.previewSection}>
          <span className={styles.previewLabel}>PREVIEW</span>
          <SubtitlePreview />
        </div>
      )}

      {/* Reset Button */}
      <div className={styles.resetRow}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleReset}
          disabled={isDefault}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

/**
 * Live preview of subtitle settings
 */
function SubtitlePreview() {
  const { settings, getSpeakerConfig, fontSizePx } = useSubtitles();

  const previewSpeaker: SpeakerType = 'commander';
  const config = getSpeakerConfig(previewSpeaker);
  const hasName = config.name && settings.showSpeakerName;
  const hasPrefix = config.prefix && settings.showSpeakerPrefix;

  // Build CSS classes based on settings
  const containerClasses = useMemo(() => {
    const classes = [styles.previewContainer];
    if (settings.highContrastMode) {
      classes.push(styles.highContrast);
    }
    if (settings.textOutline) {
      classes.push(styles.textOutline);
    }
    return classes.join(' ');
  }, [settings.highContrastMode, settings.textOutline]);

  return (
    <div
      className={containerClasses}
      style={
        {
          '--subtitle-font-size': `${fontSizePx}px`,
          '--subtitle-bg-opacity': settings.backgroundOpacity,
        } as React.CSSProperties
      }
    >
      {/* Main dialogue preview */}
      <div className={styles.previewSubtitle}>
        {(hasPrefix || hasName) && (
          <span className={styles.previewSpeaker} style={{ color: config.color }}>
            {hasPrefix && <span>{config.prefix} </span>}
            {hasName && <span>{config.name}: </span>}
          </span>
        )}
        <span className={styles.previewText}>
          This is how your subtitles will appear during gameplay.
        </span>
      </div>

      {/* Sound effect preview */}
      {settings.showSoundEffects && (
        <div className={`${styles.previewSubtitle} ${styles.soundEffectPreview}`}>
          <span className={styles.previewSoundEffect}>[GUNFIRE]</span>
        </div>
      )}
    </div>
  );
}
