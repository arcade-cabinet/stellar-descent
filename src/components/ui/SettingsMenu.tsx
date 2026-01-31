import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  ACTION_LABELS,
  type BindableAction,
  DEFAULT_KEYBINDINGS,
  getKeyDisplayName,
  getPrimaryKey,
  useKeybindings,
} from '../../game/context/KeybindingsContext';
import {
  COLOR_BLIND_MODE_DESCRIPTIONS,
  COLOR_BLIND_MODE_LABELS,
  DEFAULT_GAME_SETTINGS,
  FPS_LIMIT_OPTIONS,
  type FPSLimit,
  type GameSettings,
  GRAPHICS_QUALITY_DESCRIPTIONS,
  type GraphicsQuality,
  PARTICLE_DENSITY_OPTIONS,
  type ParticleDensity,
  SHADOW_QUALITY_OPTIONS,
  type ShadowQuality,
  useSettings,
} from '../../game/context/SettingsContext';
import { BUILD_FLAGS } from '../../game/core/BuildConfig';
import { getAudioManager } from '../../game/core/AudioManager';
import { DifficultySelector } from './DifficultySelector';
import styles from './SettingsMenu.module.css';
import { SubtitleSettings } from './SubtitleSettings';
import { KeybindingsSettings } from './KeybindingsSettings';

/**
 * Settings tab categories
 */
type SettingsTab = 'gameplay' | 'audio' | 'controls' | 'graphics' | 'accessibility';

/**
 * Local state for keybindings uses single keys per action.
 * The full Keybindings type supports arrays, but the settings UI
 * only allows configuring the primary key for simplicity.
 */
type SingleKeyBindings = Record<BindableAction, string>;

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Actions to display in the movement category */
const MOVEMENT_ACTIONS: BindableAction[] = [
  'moveForward',
  'moveBackward',
  'moveLeft',
  'moveRight',
  'jump',
  'crouch',
  'sprint',
];

/** Actions to display in the combat category */
const COMBAT_ACTIONS: BindableAction[] = ['fire', 'reload'];

/** Actions to display in the misc category */
const MISC_ACTIONS: BindableAction[] = ['interact', 'pause'];

export function SettingsMenu({ isOpen, onClose }: SettingsMenuProps) {
  const { keybindings, setKeybinding, resetToDefaults } = useKeybindings();
  const { settings, updateSetting, resetCategory, colorPalette } = useSettings();

  // Detect if device has fine pointer (mouse) - indicates desktop/laptop
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(pointer: fine)').matches;
  });

  // Listen for pointer capability changes (e.g., connecting a mouse to tablet)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: fine)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Current active tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('gameplay');

  // Track which action is currently being rebound
  const [listeningFor, setListeningFor] = useState<BindableAction | null>(null);

  // Track if the dedicated keybindings panel is open
  const [showAdvancedKeybindings, setShowAdvancedKeybindings] = useState(false);

  /**
   * Convert keybindings to single-key format for the settings UI.
   * Only the primary key is shown/editable; alternatives like arrow keys
   * are preserved as defaults but not customizable through this UI.
   */
  const keybindingsToSingleKey = useCallback((): SingleKeyBindings => {
    const result = {} as SingleKeyBindings;
    for (const action of Object.keys(keybindings) as BindableAction[]) {
      result[action] = getPrimaryKey(keybindings[action]);
    }
    return result;
  }, [keybindings]);

  // Track pending changes before save (single key per action)
  const [pendingBindings, setPendingBindings] = useState<SingleKeyBindings>(keybindingsToSingleKey);

  // Reset pending bindings when menu opens
  useEffect(() => {
    if (isOpen) {
      setPendingBindings(keybindingsToSingleKey());
    }
  }, [isOpen, keybindingsToSingleKey]);

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleTabChange = useCallback(
    (tab: SettingsTab) => {
      playClickSound();
      setActiveTab(tab);
    },
    [playClickSound]
  );

  const handleKeyButtonClick = useCallback(
    (action: BindableAction) => {
      playClickSound();
      setListeningFor(action);
    },
    [playClickSound]
  );

  const handleCancelListening = useCallback(() => {
    playClickSound();
    setListeningFor(null);
  }, [playClickSound]);

  // Listen for key/mouse input when rebinding
  useEffect(() => {
    if (!listeningFor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Allow Escape to cancel
      if (e.code === 'Escape') {
        setListeningFor(null);
        return;
      }

      // Set the new binding
      setPendingBindings((prev) => {
        const newBindings = { ...prev };
        // Remove from any other action
        for (const action of Object.keys(newBindings) as BindableAction[]) {
          if (newBindings[action] === e.code) {
            newBindings[action] = '';
          }
        }
        newBindings[listeningFor] = e.code;
        return newBindings;
      });

      playClickSound();
      setListeningFor(null);
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mouseCode = `Mouse${e.button}`;

      setPendingBindings((prev) => {
        const newBindings = { ...prev };
        // Remove from any other action
        for (const action of Object.keys(newBindings) as BindableAction[]) {
          if (newBindings[action] === mouseCode) {
            newBindings[action] = '';
          }
        }
        newBindings[listeningFor] = mouseCode;
        return newBindings;
      });

      playClickSound();
      setListeningFor(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleMouseDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [listeningFor, playClickSound]);

  const handleSave = useCallback(() => {
    playClickSound();
    // Apply all pending keybindings
    for (const [action, code] of Object.entries(pendingBindings)) {
      setKeybinding(action as BindableAction, code);
    }
    onClose();
  }, [pendingBindings, setKeybinding, onClose, playClickSound]);

  const handleCancel = useCallback(() => {
    playClickSound();
    // Discard pending changes
    setPendingBindings(keybindingsToSingleKey());
    onClose();
  }, [keybindingsToSingleKey, onClose, playClickSound]);

  const handleResetKeybindings = useCallback(() => {
    playClickSound();
    // Convert default keybindings to single-key format
    const defaultSingleKey = {} as SingleKeyBindings;
    for (const action of Object.keys(DEFAULT_KEYBINDINGS) as BindableAction[]) {
      defaultSingleKey[action] = getPrimaryKey(DEFAULT_KEYBINDINGS[action]);
    }
    setPendingBindings(defaultSingleKey);
  }, [playClickSound]);

  // Audio handlers
  const handleVolumeChange = useCallback(
    (
      key: keyof Pick<
        GameSettings,
        'masterVolume' | 'musicVolume' | 'sfxVolume' | 'voiceVolume' | 'ambientVolume'
      >
    ) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number.parseFloat(e.target.value);
        updateSetting(key, value);
      },
    [updateSetting]
  );

  // Control handlers
  const handleSensitivityChange = useCallback(
    (key: 'mouseSensitivity' | 'touchSensitivity') => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseFloat(e.target.value);
      updateSetting(key, value);
    },
    [updateSetting]
  );

  const handleToggle = useCallback(
    (key: keyof GameSettings) => () => {
      playClickSound();
      updateSetting(key, !settings[key] as any);
    },
    [settings, updateSetting, playClickSound]
  );

  const handleGraphicsQualityChange = useCallback(
    (quality: GraphicsQuality) => {
      playClickSound();
      updateSetting('graphicsQuality', quality);
    },
    [updateSetting, playClickSound]
  );

  const handleColorBlindModeChange = useCallback(
    (mode: GameSettings['colorBlindMode']) => {
      playClickSound();
      updateSetting('colorBlindMode', mode);
    },
    [updateSetting, playClickSound]
  );

  const handleResetCategory = useCallback(
    (category: 'audio' | 'controls' | 'graphics' | 'accessibility') => () => {
      playClickSound();
      resetCategory(category);
    },
    [resetCategory, playClickSound]
  );

  // Check if pending bindings differ from saved
  const hasUnsavedBindings =
    JSON.stringify(pendingBindings) !== JSON.stringify(keybindingsToSingleKey());

  if (!isOpen) return null;

  const renderKeybindingRow = (action: BindableAction) => {
    const currentKey = pendingBindings[action];
    const isUnbound = !currentKey;
    const isListening = listeningFor === action;

    return (
      <div key={action} className={styles.keybindingRow}>
        <span className={styles.actionLabel}>{ACTION_LABELS[action]}</span>
        <button
          type="button"
          className={`${styles.keyButton} ${isListening ? styles.listening : ''} ${isUnbound ? styles.unbound : ''}`}
          onClick={() => handleKeyButtonClick(action)}
          aria-label={`Rebind ${ACTION_LABELS[action]}`}
        >
          {isListening ? 'PRESS KEY...' : isUnbound ? 'UNBOUND' : getKeyDisplayName(currentKey)}
        </button>
      </div>
    );
  };

  const renderSliderRow = (
    label: string,
    value: number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    options: { min?: number; max?: number; step?: number; showPercent?: boolean } = {}
  ) => {
    const { min = 0, max = 1, step = 0.05, showPercent = true } = options;
    const displayValue = showPercent ? `${Math.round(value * 100)}%` : value.toFixed(1);
    const sliderId = `slider-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div className={styles.settingRow}>
        <label htmlFor={sliderId} className={styles.settingLabel}>
          {label} ({displayValue})
        </label>
        <input
          id={sliderId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className={styles.slider}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
        />
      </div>
    );
  };

  const renderVolumeRow = (
    label: string,
    value: number,
    isMuted: boolean,
    onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onMuteToggle: () => void,
    onPreview?: () => void
  ) => {
    const displayValue = `${Math.round(value * 100)}%`;
    const effectiveVolume = isMuted ? 0 : value;

    return (
      <div className={styles.volumeRow}>
        <div className={styles.volumeHeader}>
          <span className={`${styles.settingLabel} ${isMuted ? styles.muted : ''}`}>
            {label} ({isMuted ? 'MUTED' : displayValue})
          </span>
          <div className={styles.volumeControls}>
            {onPreview && (
              <button
                type="button"
                className={styles.previewButton}
                onClick={onPreview}
                aria-label={`Preview ${label}`}
                title="Preview sound"
              >
                {'\u266A'}
              </button>
            )}
            <button
              type="button"
              className={`${styles.muteButton} ${isMuted ? styles.muted : ''}`}
              onClick={onMuteToggle}
              aria-pressed={isMuted}
              aria-label={`${label}: ${isMuted ? 'Unmute' : 'Mute'}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '\u{1F507}' : '\u{1F50A}'}
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={effectiveVolume}
          onChange={onVolumeChange}
          className={`${styles.slider} ${styles.volumeSlider} ${isMuted ? styles.muted : ''}`}
          aria-label={label}
          disabled={isMuted}
        />
      </div>
    );
  };

  const renderToggleRow = (
    label: string,
    value: boolean,
    onChange: () => void,
    description?: string
  ) => {
    const toggleId = `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const descId = description ? `${toggleId}-desc` : undefined;

    return (
      <div className={styles.settingRow}>
        <div className={styles.settingLabelGroup}>
          <span id={toggleId} className={styles.settingLabel}>{label}</span>
          {description && <span id={descId} className={styles.settingDescription}>{description}</span>}
        </div>
        <button
          type="button"
          className={`${styles.toggleButton} ${value ? styles.toggleOn : ''}`}
          onClick={onChange}
          aria-pressed={value}
          aria-labelledby={toggleId}
          aria-describedby={descId}
        >
          {value ? 'ON' : 'OFF'}
        </button>
      </div>
    );
  };

  const renderGameplayTab = () => (
    <div className={styles.tabContent}>
      {/* Difficulty Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Difficulty</h3>
        <DifficultySelector compact />
        <p className={styles.difficultyNote}>
          Difficulty affects enemy health, damage, and aggression. Changes take effect immediately.
        </p>
      </div>

      {/* Combat Feedback Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Combat Feedback</h3>
        {renderToggleRow(
          'Hitmarkers',
          settings.showHitmarkers,
          handleToggle('showHitmarkers'),
          'Show visual confirmation when damaging enemies'
        )}
      </div>

      {/* AI Player Section - only visible when build flag is enabled */}
      {BUILD_FLAGS.ENABLE_AI_PLAYER && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Developer Options</h3>
          {renderToggleRow(
            'AI Player',
            settings.aiPlayerEnabled,
            handleToggle('aiPlayerEnabled'),
            'Enable AI-controlled player for automated testing and demos'
          )}
        </div>
      )}
    </div>
  );

  const renderAudioTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Volume Levels</h3>
        {renderVolumeRow(
          'Master Volume',
          settings.masterVolume,
          settings.masterMuted,
          handleVolumeChange('masterVolume'),
          handleToggle('masterMuted')
        )}
        {renderVolumeRow(
          'Music',
          settings.musicVolume,
          settings.musicMuted,
          handleVolumeChange('musicVolume'),
          handleToggle('musicMuted'),
          () => getAudioManager().play('notification', { volume: 0.3 })
        )}
        {renderVolumeRow(
          'Sound Effects',
          settings.sfxVolume,
          settings.sfxMuted,
          handleVolumeChange('sfxVolume'),
          handleToggle('sfxMuted'),
          () => getAudioManager().play('weapon_fire', { volume: 0.3 })
        )}
        {renderVolumeRow(
          'Voice/Dialogue',
          settings.voiceVolume,
          settings.voiceMuted,
          handleVolumeChange('voiceVolume'),
          handleToggle('voiceMuted'),
          () => getAudioManager().play('comms_open', { volume: 0.5 })
        )}
        {renderVolumeRow(
          'Ambient',
          settings.ambientVolume,
          settings.ambientMuted,
          handleVolumeChange('ambientVolume'),
          handleToggle('ambientMuted')
        )}
      </div>

      <div className={styles.resetRow}>
        <button
          type="button"
          className={styles.resetCategoryButton}
          onClick={handleResetCategory('audio')}
          disabled={
            settings.masterVolume === DEFAULT_GAME_SETTINGS.masterVolume &&
            settings.musicVolume === DEFAULT_GAME_SETTINGS.musicVolume &&
            settings.sfxVolume === DEFAULT_GAME_SETTINGS.sfxVolume &&
            settings.voiceVolume === DEFAULT_GAME_SETTINGS.voiceVolume &&
            settings.ambientVolume === DEFAULT_GAME_SETTINGS.ambientVolume &&
            settings.masterMuted === DEFAULT_GAME_SETTINGS.masterMuted &&
            settings.musicMuted === DEFAULT_GAME_SETTINGS.musicMuted &&
            settings.sfxMuted === DEFAULT_GAME_SETTINGS.sfxMuted &&
            settings.voiceMuted === DEFAULT_GAME_SETTINGS.voiceMuted &&
            settings.ambientMuted === DEFAULT_GAME_SETTINGS.ambientMuted
          }
        >
          Reset Audio to Defaults
        </button>
      </div>
    </div>
  );

  const renderControlsTab = () => (
    <div className={styles.tabContent}>
      {/* Advanced Keybindings Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Key Bindings</h3>
        <div className={styles.advancedKeybindingsRow}>
          <div className={styles.keybindingsDescription}>
            <span className={styles.keybindingsLabel}>Advanced Key Binding Editor</span>
            <span className={styles.keybindingsHint}>Full rebinding with conflict detection and alternative keys</span>
          </div>
          <button
            type="button"
            className={styles.openAdvancedButton}
            onClick={() => {
              playClickSound();
              setShowAdvancedKeybindings(true);
            }}
            aria-label="Open advanced key bindings editor"
          >
            OPEN EDITOR
          </button>
        </div>
      </div>

      {/* Sensitivity Settings */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Sensitivity</h3>
        {renderSliderRow(
          'Mouse Sensitivity',
          settings.mouseSensitivity,
          handleSensitivityChange('mouseSensitivity'),
          { min: 0.1, max: 3.0, step: 0.1, showPercent: false }
        )}
        {renderSliderRow(
          'Touch Sensitivity',
          settings.touchSensitivity,
          handleSensitivityChange('touchSensitivity'),
          { min: 0.1, max: 3.0, step: 0.1, showPercent: false }
        )}
        {renderToggleRow('Invert Mouse Y', settings.invertMouseY, handleToggle('invertMouseY'))}
      </div>

      {/* Keybindings */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Movement</h3>
        <div className={styles.keybindingList}>{MOVEMENT_ACTIONS.map(renderKeybindingRow)}</div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Combat</h3>
        <div className={styles.keybindingList}>{COMBAT_ACTIONS.map(renderKeybindingRow)}</div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>General</h3>
        <div className={styles.keybindingList}>{MISC_ACTIONS.map(renderKeybindingRow)}</div>
      </div>

      <div className={styles.note}>
        <p className={styles.noteText}>
          Click a binding and press any key or mouse button to rebind. Press ESC to cancel. Mouse
          look is controlled by mouse movement when pointer is locked.
        </p>
      </div>

      <div className={styles.resetRow}>
        <button
          type="button"
          className={styles.resetCategoryButton}
          onClick={handleResetKeybindings}
          disabled={(() => {
            const defaultSingleKey = {} as SingleKeyBindings;
            for (const action of Object.keys(DEFAULT_KEYBINDINGS) as BindableAction[]) {
              defaultSingleKey[action] = getPrimaryKey(DEFAULT_KEYBINDINGS[action]);
            }
            return JSON.stringify(pendingBindings) === JSON.stringify(defaultSingleKey);
          })()}
        >
          Reset Keybindings to Defaults
        </button>
      </div>
    </div>
  );

  const renderGraphicsTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Quality Preset</h3>
        <div className={styles.qualityGrid}>
          {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((quality) => (
            <button
              key={quality}
              type="button"
              className={`${styles.qualityButton} ${settings.graphicsQuality === quality ? styles.qualityActive : ''}`}
              onClick={() => handleGraphicsQualityChange(quality)}
              aria-pressed={settings.graphicsQuality === quality}
            >
              <span className={styles.qualityLabel}>{quality.toUpperCase()}</span>
              <span className={styles.qualityDescription}>
                {GRAPHICS_QUALITY_DESCRIPTIONS[quality]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Visual Effects</h3>
        <div className={styles.settingRow}>
          <div className={styles.settingLabelGroup}>
            <span className={styles.settingLabel}>Shadow Quality</span>
            <span className={styles.settingDescription}>Dynamic shadow rendering quality</span>
          </div>
          <select
            className={styles.selectInput}
            value={settings.shadowQuality}
            onChange={(e) => {
              playClickSound();
              const quality = e.target.value as ShadowQuality;
              updateSetting('shadowQuality', quality);
              updateSetting('shadowsEnabled', quality !== 'off');
            }}
            aria-label="Shadow Quality"
          >
            {SHADOW_QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.settingRow}>
          <div className={styles.settingLabelGroup}>
            <span className={styles.settingLabel}>Particle Density</span>
            <span className={styles.settingDescription}>Explosion and effect particles</span>
          </div>
          <select
            className={styles.selectInput}
            value={settings.particleDensity}
            onChange={(e) => {
              playClickSound();
              const density = e.target.value as ParticleDensity;
              updateSetting('particleDensity', density);
              updateSetting('particlesEnabled', density !== 'off');
            }}
            aria-label="Particle Density"
          >
            {PARTICLE_DENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {renderToggleRow(
          'Post-Processing',
          settings.postProcessingEnabled,
          handleToggle('postProcessingEnabled'),
          'Master toggle for all post-processing effects'
        )}
        {settings.postProcessingEnabled && (
          <>
            {renderToggleRow(
              'Bloom',
              settings.bloomEnabled,
              handleToggle('bloomEnabled'),
              'Glow effect for bright lights and explosions'
            )}
            {settings.bloomEnabled &&
              renderSliderRow(
                'Bloom Intensity',
                settings.bloomIntensity,
                (e: React.ChangeEvent<HTMLInputElement>) =>
                  updateSetting('bloomIntensity', Number.parseFloat(e.target.value)),
                { min: 0, max: 1.0, step: 0.1, showPercent: true }
              )}
            {renderToggleRow(
              'Chromatic Aberration',
              settings.chromaticAberrationEnabled,
              handleToggle('chromaticAberrationEnabled'),
              'Color fringing effect on damage'
            )}
            {renderToggleRow(
              'Vignette',
              settings.vignetteEnabled,
              handleToggle('vignetteEnabled'),
              'Darkened screen edges'
            )}
            {renderToggleRow(
              'Film Grain',
              settings.filmGrainEnabled,
              handleToggle('filmGrainEnabled'),
              'Subtle noise for cinematic look'
            )}
            {settings.filmGrainEnabled &&
              renderSliderRow(
                'Grain Intensity',
                settings.filmGrainIntensity,
                (e: React.ChangeEvent<HTMLInputElement>) =>
                  updateSetting('filmGrainIntensity', Number.parseFloat(e.target.value)),
                { min: 0, max: 1.0, step: 0.1, showPercent: true }
              )}
            {renderToggleRow(
              'Color Grading',
              settings.colorGradingEnabled,
              handleToggle('colorGradingEnabled'),
              'Environment-specific color adjustments'
            )}
            {renderToggleRow(
              'Motion Blur',
              settings.motionBlur,
              handleToggle('motionBlur'),
              'Blur effect during fast movement'
            )}
          </>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Performance</h3>
        {renderSliderRow(
          'Resolution Scale',
          settings.resolutionScale,
          (e: React.ChangeEvent<HTMLInputElement>) =>
            updateSetting('resolutionScale', Number.parseFloat(e.target.value)),
          { min: 0.5, max: 1.0, step: 0.1, showPercent: true }
        )}
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>FPS Limit</span>
          <select
            className={styles.selectInput}
            value={settings.fpsLimit}
            onChange={(e) => {
              playClickSound();
              updateSetting('fpsLimit', Number.parseInt(e.target.value, 10) as FPSLimit);
            }}
            aria-label="FPS Limit"
          >
            {FPS_LIMIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Display Options</h3>
        {renderToggleRow('Show FPS Counter', settings.showFPS, handleToggle('showFPS'))}
        {renderToggleRow(
          'Screen Shake',
          settings.screenShake,
          handleToggle('screenShake'),
          'Camera shake effects during combat'
        )}
        {settings.screenShake &&
          renderSliderRow(
            'Shake Intensity',
            settings.screenShakeIntensity,
            (e: React.ChangeEvent<HTMLInputElement>) =>
              updateSetting('screenShakeIntensity', Number.parseFloat(e.target.value)),
            { min: 0.1, max: 1.0, step: 0.1, showPercent: true }
          )}
        {renderToggleRow(
          'Reduce Motion',
          settings.reduceMotion,
          handleToggle('reduceMotion'),
          'Minimizes animations and motion effects'
        )}
      </div>

      <div className={styles.resetRow}>
        <button
          type="button"
          className={styles.resetCategoryButton}
          onClick={handleResetCategory('graphics')}
          disabled={
            settings.graphicsQuality === DEFAULT_GAME_SETTINGS.graphicsQuality &&
            settings.showFPS === DEFAULT_GAME_SETTINGS.showFPS &&
            settings.reduceMotion === DEFAULT_GAME_SETTINGS.reduceMotion &&
            settings.screenShake === DEFAULT_GAME_SETTINGS.screenShake &&
            settings.screenShakeIntensity === DEFAULT_GAME_SETTINGS.screenShakeIntensity &&
            settings.shadowsEnabled === DEFAULT_GAME_SETTINGS.shadowsEnabled &&
            settings.shadowQuality === DEFAULT_GAME_SETTINGS.shadowQuality &&
            settings.particlesEnabled === DEFAULT_GAME_SETTINGS.particlesEnabled &&
            settings.particleDensity === DEFAULT_GAME_SETTINGS.particleDensity &&
            settings.postProcessingEnabled === DEFAULT_GAME_SETTINGS.postProcessingEnabled &&
            settings.motionBlur === DEFAULT_GAME_SETTINGS.motionBlur &&
            settings.resolutionScale === DEFAULT_GAME_SETTINGS.resolutionScale &&
            settings.fpsLimit === DEFAULT_GAME_SETTINGS.fpsLimit &&
            settings.bloomEnabled === DEFAULT_GAME_SETTINGS.bloomEnabled &&
            settings.bloomIntensity === DEFAULT_GAME_SETTINGS.bloomIntensity &&
            settings.chromaticAberrationEnabled ===
              DEFAULT_GAME_SETTINGS.chromaticAberrationEnabled &&
            settings.vignetteEnabled === DEFAULT_GAME_SETTINGS.vignetteEnabled &&
            settings.filmGrainEnabled === DEFAULT_GAME_SETTINGS.filmGrainEnabled &&
            settings.filmGrainIntensity === DEFAULT_GAME_SETTINGS.filmGrainIntensity &&
            settings.colorGradingEnabled === DEFAULT_GAME_SETTINGS.colorGradingEnabled
          }
        >
          Reset Graphics to Defaults
        </button>
      </div>
    </div>
  );

  const renderAccessibilityTab = () => (
    <div className={styles.tabContent}>
      {/* Subtitles Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Subtitles</h3>
        <SubtitleSettings />
      </div>

      {/* Visual Accessibility */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Visual</h3>
        {renderToggleRow(
          'High Contrast Mode',
          settings.highContrast,
          handleToggle('highContrast'),
          'Increases contrast for better visibility'
        )}
        {renderToggleRow(
          'Large UI',
          settings.largeUI,
          handleToggle('largeUI'),
          'Increases size of UI elements'
        )}
        {renderToggleRow(
          'Reduced Flashing',
          settings.reducedFlashing,
          handleToggle('reducedFlashing'),
          'Reduces bright flashing effects'
        )}

        {/* Color Blind Mode */}
        <div className={styles.settingRow}>
          <div className={styles.settingLabelGroup}>
            <span className={styles.settingLabel}>Color Blind Mode</span>
            {settings.colorBlindMode !== 'none' && (
              <span className={styles.settingDescription}>
                {COLOR_BLIND_MODE_DESCRIPTIONS[settings.colorBlindMode]}
              </span>
            )}
          </div>
          <select
            className={styles.selectInput}
            value={settings.colorBlindMode}
            onChange={(e) =>
              handleColorBlindModeChange(e.target.value as GameSettings['colorBlindMode'])
            }
            aria-label="Color blind mode"
          >
            {(Object.keys(COLOR_BLIND_MODE_LABELS) as GameSettings['colorBlindMode'][]).map(
              (mode) => (
                <option key={mode} value={mode}>
                  {COLOR_BLIND_MODE_LABELS[mode]}
                </option>
              )
            )}
          </select>
        </div>

        {/* Shape Indicators - adds shapes in addition to colors */}
        {renderToggleRow(
          'Shape Indicators',
          settings.useShapeIndicators,
          handleToggle('useShapeIndicators'),
          'Add diamond/circle shapes to distinguish enemies from friendlies'
        )}

        {/* Pattern Indicators - adds patterns to health bars */}
        {renderToggleRow(
          'Pattern Indicators',
          settings.usePatternIndicators,
          handleToggle('usePatternIndicators'),
          'Add striped patterns to health bars for additional distinction'
        )}

        {/* Color Preview */}
        <div className={styles.colorPreviewSection}>
          <span className={styles.colorPreviewLabel}>Color Preview</span>
          <div className={styles.colorPreviewGrid}>
            <div className={styles.colorPreviewItem}>
              <div
                className={styles.colorPreviewSwatch}
                style={{ backgroundColor: colorPalette.healthHigh }}
              />
              <span className={styles.colorPreviewName}>Healthy</span>
            </div>
            <div className={styles.colorPreviewItem}>
              <div
                className={styles.colorPreviewSwatch}
                style={{ backgroundColor: colorPalette.healthMedium }}
              />
              <span className={styles.colorPreviewName}>Caution</span>
            </div>
            <div className={styles.colorPreviewItem}>
              <div
                className={styles.colorPreviewSwatch}
                style={{ backgroundColor: colorPalette.healthLow }}
              />
              <span className={styles.colorPreviewName}>Critical</span>
            </div>
            <div className={styles.colorPreviewItem}>
              <div
                className={`${styles.colorPreviewSwatch} ${settings.useShapeIndicators ? styles.enemyShape : ''}`}
                style={{ backgroundColor: colorPalette.enemy }}
              />
              <span className={styles.colorPreviewName}>Enemy</span>
            </div>
            <div className={styles.colorPreviewItem}>
              <div
                className={`${styles.colorPreviewSwatch} ${settings.useShapeIndicators ? styles.friendlyShape : ''}`}
                style={{ backgroundColor: colorPalette.friendly }}
              />
              <span className={styles.colorPreviewName}>Friendly</span>
            </div>
            <div className={styles.colorPreviewItem}>
              <div
                className={styles.colorPreviewSwatch}
                style={{ backgroundColor: colorPalette.objective }}
              />
              <span className={styles.colorPreviewName}>Objective</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gameplay Accessibility */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Gameplay</h3>
        {renderToggleRow(
          'Auto-Aim Assist',
          settings.autoAim,
          handleToggle('autoAim'),
          'Assists with aiming at enemies'
        )}
      </div>

      <div className={styles.resetRow}>
        <button
          type="button"
          className={styles.resetCategoryButton}
          onClick={handleResetCategory('accessibility')}
          disabled={
            settings.highContrast === DEFAULT_GAME_SETTINGS.highContrast &&
            settings.largeUI === DEFAULT_GAME_SETTINGS.largeUI &&
            settings.colorBlindMode === DEFAULT_GAME_SETTINGS.colorBlindMode &&
            settings.useShapeIndicators === DEFAULT_GAME_SETTINGS.useShapeIndicators &&
            settings.usePatternIndicators === DEFAULT_GAME_SETTINGS.usePatternIndicators &&
            settings.autoAim === DEFAULT_GAME_SETTINGS.autoAim &&
            settings.reducedFlashing === DEFAULT_GAME_SETTINGS.reducedFlashing
          }
        >
          Reset Accessibility to Defaults
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'gameplay':
        return renderGameplayTab();
      case 'audio':
        return renderAudioTab();
      case 'controls':
        return renderControlsTab();
      case 'graphics':
        return renderGraphicsTab();
      case 'accessibility':
        return renderAccessibilityTab();
      default:
        return null;
    }
  };

  return (
    <>
      {/* Main settings panel */}
      <div
        className={styles.overlay}
        onClick={handleCancel}
        onKeyDown={(e) => e.key === 'Escape' && !listeningFor && handleCancel()}
        role="presentation"
      >
        <div
          className={styles.container}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          {/* Corner decorations */}
          <div className={styles.cornerTL} />
          <div className={styles.cornerTR} />
          <div className={styles.cornerBL} />
          <div className={styles.cornerBR} />

          {/* Header */}
          <div className={styles.header}>
            <h2 id="settings-title" className={styles.title}>
              SETTINGS
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={handleCancel}
              aria-label="Close settings"
            >
              X
            </button>
          </div>

          {/* Tab Navigation */}
          <div className={styles.tabNav} role="tablist" aria-label="Settings categories">
            {(['gameplay', 'audio', 'controls', 'graphics', 'accessibility'] as SettingsTab[])
              .filter((tab) => tab !== 'controls' || isDesktop)
              .map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`${tab}-panel`}
                  className={`${styles.tabButton} ${activeTab === tab ? styles.tabActive : ''}`}
                  onClick={() => handleTabChange(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
          </div>

          {/* Content */}
          <div
            className={styles.content}
            role="tabpanel"
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
          >
            {renderTabContent()}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button type="button" className={styles.button} onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={handleSave}
            >
              {hasUnsavedBindings ? 'Save Changes' : 'Done'}
            </button>
          </div>
        </div>
      </div>

      {/* Listening overlay for keybindings */}
      {listeningFor && (
        <div
          className={styles.listeningOverlay}
          onClick={handleCancelListening}
          role="presentation"
        >
          <div className={styles.listeningModal}>
            <p className={styles.listeningText}>PRESS A KEY OR MOUSE BUTTON</p>
            <p className={styles.listeningHint}>
              Binding: {ACTION_LABELS[listeningFor]} | Press ESC to cancel
            </p>
          </div>
        </div>
      )}

      {/* Advanced Keybindings Panel */}
      <KeybindingsSettings
        isOpen={showAdvancedKeybindings}
        onClose={() => {
          playClickSound();
          setShowAdvancedKeybindings(false);
        }}
      />
    </>
  );
}
