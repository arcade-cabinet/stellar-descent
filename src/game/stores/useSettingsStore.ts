/**
 * useSettingsStore - Zustand store for game settings with SQLite persistence
 *
 * Replaces the legacy SettingsContext with a modern Zustand store that:
 * - Persists settings to SQLite via SaveSystem
 * - Emits SETTINGS_CHANGED events via EventBus
 * - Provides type-safe access to all game settings
 * - Includes computed values like colorPalette
 *
 * Usage:
 * ```ts
 * import { useSettingsStore } from '../stores/useSettingsStore';
 *
 * // In a component:
 * const settings = useSettingsStore((state) => state.settings);
 * const updateSetting = useSettingsStore((state) => state.updateSetting);
 *
 * // Or with shallow selector for multiple values:
 * const { settings, colorPalette } = useSettingsStore(
 *   (state) => ({ settings: state.settings, colorPalette: state.colorPalette }),
 *   shallow
 * );
 * ```
 */

import { getAudioManager } from '../core/AudioManager';
import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import { createPersistedStore } from './createPersistedStore';

const log = getLogger('SettingsStore');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Graphics quality presets
 */
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * FPS limit options
 */
export type FPSLimit = 30 | 60 | 120 | 0; // 0 = uncapped

/**
 * Particle density levels
 */
export type ParticleDensity = 'off' | 'low' | 'medium' | 'high';

/**
 * Shadow quality levels
 */
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';

/**
 * All game settings
 */
export interface GameSettings {
  // Audio settings
  masterVolume: number; // 0-1
  musicVolume: number; // 0-1
  sfxVolume: number; // 0-1
  voiceVolume: number; // 0-1 (for dialogue/comms)
  ambientVolume: number; // 0-1
  masterMuted: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
  voiceMuted: boolean;
  ambientMuted: boolean;

  // Control settings
  mouseSensitivity: number; // 0.1-3.0, default 1.0
  invertMouseY: boolean;
  touchSensitivity: number; // 0.1-3.0, default 1.0
  fieldOfView: number; // FOV in degrees, 60-120, default 90

  // Graphics settings
  graphicsQuality: GraphicsQuality;
  showFPS: boolean;
  reduceMotion: boolean;
  screenShake: boolean;
  screenShakeIntensity: number; // 0-1, default 0.7
  shadowsEnabled: boolean;
  shadowQuality: ShadowQuality; // off, low, medium, high
  particlesEnabled: boolean;
  particleDensity: ParticleDensity; // off, low, medium, high
  postProcessingEnabled: boolean;
  motionBlur: boolean;
  resolutionScale: number; // 0.5-1.0, default 1.0
  fpsLimit: FPSLimit;

  // Post-processing specific settings
  bloomEnabled: boolean;
  bloomIntensity: number; // 0-1, default 0.5
  chromaticAberrationEnabled: boolean;
  vignetteEnabled: boolean;
  filmGrainEnabled: boolean;
  filmGrainIntensity: number; // 0-1, default 0.3
  colorGradingEnabled: boolean; // Level-specific color grading

  // Accessibility settings
  highContrast: boolean;
  largeUI: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'high-contrast';
  /** Add shapes (diamond/circle) in addition to colors for enemy/friendly */
  useShapeIndicators: boolean;
  /** Add patterns to health bars for additional distinction */
  usePatternIndicators: boolean;
  autoAim: boolean;
  reducedFlashing: boolean;

  // Combat feedback settings
  /** Show hitmarkers when damaging enemies */
  showHitmarkers: boolean;

  // Dev/Testing settings (only visible when BUILD_FLAGS.ENABLE_AI_PLAYER is set)
  /** Enable AI-controlled player for automated testing/demos */
  aiPlayerEnabled: boolean;
}

/**
 * Color palette for semantic color usage across the game UI
 * These roles provide consistent meaning regardless of colorblind mode
 */
export interface ColorPalette {
  /** Health high (>50%) */
  healthHigh: string;
  /** Health medium (25-50%) */
  healthMedium: string;
  /** Health low (<25%) - also damage indicator */
  healthLow: string;
  /** Enemy/hostile indicator */
  enemy: string;
  /** Friendly/ally indicator */
  friendly: string;
  /** Neutral/ambient */
  neutral: string;
  /** Primary action/interact - gold/military theme */
  primary: string;
  /** Warning/caution */
  warning: string;
  /** Objective/waypoint */
  objective: string;
  /** Success/positive feedback */
  success: string;
  /** Crosshair default state */
  crosshairDefault: string;
  /** Crosshair when hovering enemy */
  crosshairHover: string;
  /** Crosshair hit confirmed */
  crosshairHit: string;
  /** Ammo normal */
  ammoNormal: string;
  /** Ammo low warning */
  ammoLow: string;
  /** Compass cardinal directions */
  compassCardinal: string;
}

/**
 * Settings store state (excluding actions)
 */
export interface SettingsState {
  /** Current game settings */
  settings: GameSettings;
  /** Current color palette based on colorblind mode */
  colorPalette: ColorPalette;
  /** Whether colorblind mode is active (not 'none') */
  isColorblindMode: boolean;
}

/**
 * Settings store actions
 */
export interface SettingsActions {
  /** Update a single setting */
  updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  /** Update multiple settings at once */
  updateSettings: (updates: Partial<GameSettings>) => void;
  /** Reset all settings to defaults */
  resetSettings: () => void;
  /** Reset a specific category to defaults */
  resetCategory: (category: 'audio' | 'controls' | 'graphics' | 'accessibility') => void;
  /** Check if current settings differ from defaults */
  hasCustomSettings: () => boolean;
  /** Get computed mouse sensitivity (base * user multiplier) */
  getMouseSensitivity: () => number;
  /** Get computed touch sensitivity (base * user multiplier) */
  getTouchSensitivity: () => number;
  /** Get FOV in radians (for Babylon.js camera) */
  getFOVRadians: () => number;
  /** Get a specific color from the palette by role */
  getColor: (role: keyof ColorPalette) => string;
}

// Combined type for the full store (including persisted actions)
export type SettingsStoreState = SettingsState & SettingsActions;

// Internal type for createPersistedStore - includes state, custom actions, and will receive persisted actions
type SettingsStoreInternal = SettingsState & SettingsActions;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default game settings
 */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  // Audio
  masterVolume: 1.0,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  voiceVolume: 0.8,
  ambientVolume: 0.5,
  masterMuted: false,
  musicMuted: false,
  sfxMuted: false,
  voiceMuted: false,
  ambientMuted: false,

  // Controls
  mouseSensitivity: 1.0,
  invertMouseY: false,
  touchSensitivity: 1.0,
  fieldOfView: 90, // 90 degrees - standard FPS default

  // Graphics
  graphicsQuality: 'high',
  showFPS: false,
  reduceMotion: false,
  screenShake: true,
  screenShakeIntensity: 0.7,
  shadowsEnabled: true,
  shadowQuality: 'medium',
  particlesEnabled: true,
  particleDensity: 'medium',
  postProcessingEnabled: true,
  motionBlur: false,
  resolutionScale: 1.0,
  fpsLimit: 60,

  // Post-processing specific
  bloomEnabled: true,
  bloomIntensity: 0.5,
  chromaticAberrationEnabled: true,
  vignetteEnabled: true,
  filmGrainEnabled: true,
  filmGrainIntensity: 0.3,
  colorGradingEnabled: true,

  // Accessibility
  highContrast: false,
  largeUI: false,
  colorBlindMode: 'none',
  useShapeIndicators: false,
  usePatternIndicators: false,
  autoAim: false,
  reducedFlashing: false,

  // Combat feedback
  showHitmarkers: true,

  // Dev/Testing
  aiPlayerEnabled: false,
};

/**
 * FPS limit options with labels
 */
export const FPS_LIMIT_OPTIONS: { value: FPSLimit; label: string }[] = [
  { value: 30, label: '30 FPS' },
  { value: 60, label: '60 FPS' },
  { value: 120, label: '120 FPS' },
  { value: 0, label: 'Uncapped' },
];

/**
 * Graphics quality descriptions
 */
export const GRAPHICS_QUALITY_DESCRIPTIONS: Record<GraphicsQuality, string> = {
  low: 'Best performance, reduced visual effects',
  medium: 'Balanced performance and visuals',
  high: 'High quality visuals (recommended)',
  ultra: 'Maximum quality, may impact performance',
};

/**
 * Particle density options with labels
 */
export const PARTICLE_DENSITY_OPTIONS: { value: ParticleDensity; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/**
 * Shadow quality options with labels
 */
export const SHADOW_QUALITY_OPTIONS: { value: ShadowQuality; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/**
 * Particle density descriptions
 */
export const PARTICLE_DENSITY_DESCRIPTIONS: Record<ParticleDensity, string> = {
  off: 'No particles (best performance)',
  low: 'Minimal particle effects',
  medium: 'Balanced particle density',
  high: 'Full particle effects',
};

/**
 * Shadow quality descriptions
 */
export const SHADOW_QUALITY_DESCRIPTIONS: Record<ShadowQuality, string> = {
  off: 'No shadows (best performance)',
  low: 'Basic shadows',
  medium: 'Soft shadows',
  high: 'High-quality shadows with soft edges',
};

/**
 * Color blind mode labels
 */
export const COLOR_BLIND_MODE_LABELS: Record<GameSettings['colorBlindMode'], string> = {
  none: 'None',
  protanopia: 'Protanopia (Red-Weak)',
  deuteranopia: 'Deuteranopia (Green-Weak)',
  tritanopia: 'Tritanopia (Blue-Weak)',
  'high-contrast': 'High Contrast',
};

/**
 * Color blind mode descriptions
 */
export const COLOR_BLIND_MODE_DESCRIPTIONS: Record<GameSettings['colorBlindMode'], string> = {
  none: 'Standard color scheme',
  protanopia: 'Optimized for reduced red sensitivity - uses blue/yellow contrast',
  deuteranopia: 'Optimized for reduced green sensitivity - uses blue/yellow contrast',
  tritanopia: 'Optimized for reduced blue/yellow sensitivity - uses red/cyan contrast',
  'high-contrast': 'Maximum visibility with pure colors and enhanced outlines',
};

// ============================================================================
// COLOR PALETTES
// ============================================================================

/**
 * Default color palette - designed for typical color vision
 */
const DEFAULT_PALETTE: ColorPalette = {
  healthHigh: '#4CAF50', // Green
  healthMedium: '#FF9800', // Orange
  healthLow: '#F44336', // Red
  enemy: '#F44336', // Red
  friendly: '#4DA6FF', // Blue
  neutral: '#a0a0a0', // Gray
  primary: '#b5a642', // Gold (military theme)
  warning: '#FF9800', // Orange
  objective: '#FFD700', // Gold
  success: '#4CAF50', // Green
  crosshairDefault: 'rgba(255, 255, 255, 0.9)',
  crosshairHover: '#ffbf00', // Amber
  crosshairHit: '#ff4444', // Red
  ammoNormal: '#e8e8e8', // White
  ammoLow: '#ff6b35', // Orange-red
  compassCardinal: '#ffbf00', // Amber
};

/**
 * Protanopia palette - Red-weak colorblindness
 * Replaces red with magenta/pink, uses blue-yellow contrast
 */
const PROTANOPIA_PALETTE: ColorPalette = {
  healthHigh: '#00BCD4', // Cyan
  healthMedium: '#FFD700', // Yellow
  healthLow: '#FF00FF', // Magenta
  enemy: '#FF00FF', // Magenta (replaces red)
  friendly: '#00BFFF', // Deep sky blue
  neutral: '#a0a0a0', // Gray
  primary: '#FFD700', // Yellow (high contrast)
  warning: '#FFD700', // Yellow
  objective: '#00FFFF', // Cyan
  success: '#00BCD4', // Cyan
  crosshairDefault: 'rgba(255, 255, 255, 0.9)',
  crosshairHover: '#FFD700', // Yellow
  crosshairHit: '#FF00FF', // Magenta
  ammoNormal: '#e8e8e8', // White
  ammoLow: '#FFD700', // Yellow
  compassCardinal: '#FFD700', // Yellow
};

/**
 * Deuteranopia palette - Green-weak colorblindness
 * Similar to protanopia, uses blue-yellow contrast
 */
const DEUTERANOPIA_PALETTE: ColorPalette = {
  healthHigh: '#00BCD4', // Cyan
  healthMedium: '#FFD700', // Yellow
  healthLow: '#FF00FF', // Magenta
  enemy: '#FF00FF', // Magenta
  friendly: '#00BFFF', // Deep sky blue
  neutral: '#a0a0a0', // Gray
  primary: '#FFD700', // Yellow
  warning: '#FFD700', // Yellow
  objective: '#00FFFF', // Cyan
  success: '#00BCD4', // Cyan
  crosshairDefault: 'rgba(255, 255, 255, 0.9)',
  crosshairHover: '#FFD700', // Yellow
  crosshairHit: '#FF00FF', // Magenta
  ammoNormal: '#e8e8e8', // White
  ammoLow: '#FFD700', // Yellow
  compassCardinal: '#FFD700', // Yellow
};

/**
 * Tritanopia palette - Blue-yellow colorblindness
 * Uses red-cyan contrast instead of blue-yellow
 */
const TRITANOPIA_PALETTE: ColorPalette = {
  healthHigh: '#00FF00', // Bright green
  healthMedium: '#FF6B6B', // Light red/pink
  healthLow: '#FF0000', // Red
  enemy: '#FF0000', // Red
  friendly: '#00FFFF', // Cyan (replaces blue)
  neutral: '#a0a0a0', // Gray
  primary: '#FF6B6B', // Pink/salmon
  warning: '#FF6B6B', // Pink/salmon
  objective: '#00FFFF', // Cyan
  success: '#00FF00', // Green
  crosshairDefault: 'rgba(255, 255, 255, 0.9)',
  crosshairHover: '#00FFFF', // Cyan
  crosshairHit: '#FF0000', // Red
  ammoNormal: '#e8e8e8', // White
  ammoLow: '#FF0000', // Red
  compassCardinal: '#00FFFF', // Cyan
};

/**
 * High Contrast palette - Maximum visibility
 * Uses pure, saturated colors with enhanced outlines
 */
const HIGH_CONTRAST_PALETTE: ColorPalette = {
  healthHigh: '#00FF00', // Pure green
  healthMedium: '#FFFF00', // Pure yellow
  healthLow: '#FF0000', // Pure red
  enemy: '#FF0000', // Pure red
  friendly: '#00FFFF', // Pure cyan
  neutral: '#FFFFFF', // White
  primary: '#FFFF00', // Pure yellow
  warning: '#FFFF00', // Pure yellow
  objective: '#FFFF00', // Pure yellow
  success: '#00FF00', // Pure green
  crosshairDefault: '#FFFFFF', // Pure white
  crosshairHover: '#FFFF00', // Pure yellow
  crosshairHit: '#FF0000', // Pure red
  ammoNormal: '#FFFFFF', // Pure white
  ammoLow: '#FFFF00', // Pure yellow
  compassCardinal: '#FFFF00', // Pure yellow
};

const COLOR_PALETTES: Record<GameSettings['colorBlindMode'], ColorPalette> = {
  none: DEFAULT_PALETTE,
  protanopia: PROTANOPIA_PALETTE,
  deuteranopia: DEUTERANOPIA_PALETTE,
  tritanopia: TRITANOPIA_PALETTE,
  'high-contrast': HIGH_CONTRAST_PALETTE,
};

// Base sensitivity values
const BASE_MOUSE_SENSITIVITY = 0.002;
const BASE_TOUCH_SENSITIVITY = 0.003;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the color palette for a given colorblind mode
 */
function getColorPalette(mode: GameSettings['colorBlindMode']): ColorPalette {
  return COLOR_PALETTES[mode];
}

/**
 * Apply accessibility preferences to document (CSS classes and custom properties)
 */
function applyAccessibilitySettings(settings: GameSettings): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const palette = COLOR_PALETTES[settings.colorBlindMode];
  const isColorblindMode = settings.colorBlindMode !== 'none';

  // Toggle CSS classes for global styling
  root.classList.toggle('reduce-motion', settings.reduceMotion);
  root.classList.toggle(
    'high-contrast',
    settings.highContrast || settings.colorBlindMode === 'high-contrast'
  );
  root.classList.toggle('large-ui', settings.largeUI);
  root.classList.toggle('reduced-flashing', settings.reducedFlashing);
  root.classList.toggle('colorblind-mode', isColorblindMode);
  root.classList.toggle('cb-shapes', settings.useShapeIndicators);
  root.classList.toggle('cb-patterns', settings.usePatternIndicators);

  // Set color blind mode as data attribute for CSS targeting
  root.setAttribute('data-color-blind-mode', settings.colorBlindMode);

  // Apply colorblind-aware CSS custom properties
  root.style.setProperty('--cb-health-high', palette.healthHigh);
  root.style.setProperty('--cb-health-medium', palette.healthMedium);
  root.style.setProperty('--cb-health-low', palette.healthLow);
  root.style.setProperty('--cb-enemy', palette.enemy);
  root.style.setProperty('--cb-friendly', palette.friendly);
  root.style.setProperty('--cb-neutral', palette.neutral);
  root.style.setProperty('--cb-primary', palette.primary);
  root.style.setProperty('--cb-warning', palette.warning);
  root.style.setProperty('--cb-objective', palette.objective);
  root.style.setProperty('--cb-success', palette.success);
  root.style.setProperty('--cb-crosshair-default', palette.crosshairDefault);
  root.style.setProperty('--cb-crosshair-hover', palette.crosshairHover);
  root.style.setProperty('--cb-crosshair-hit', palette.crosshairHit);
  root.style.setProperty('--cb-ammo-normal', palette.ammoNormal);
  root.style.setProperty('--cb-ammo-low', palette.ammoLow);
  root.style.setProperty('--cb-compass-cardinal', palette.compassCardinal);
}

/**
 * Apply audio settings to AudioManager
 */
function applyAudioSettings(settings: GameSettings): void {
  try {
    const audioManager = getAudioManager();
    audioManager.setMasterVolume(settings.masterVolume, false);
    audioManager.setMusicVolume(settings.musicVolume, false);
    audioManager.setSFXVolume(settings.sfxVolume, false);
    audioManager.setVoiceVolume(settings.voiceVolume, false);
    audioManager.setAmbientVolume(settings.ambientVolume, false);
  } catch (e) {
    // AudioManager may not be initialized yet
    log.debug('Could not apply audio settings:', e);
  }
}

// ============================================================================
// STORE CREATION
// ============================================================================

const initialState: SettingsState = {
  settings: { ...DEFAULT_GAME_SETTINGS },
  colorPalette: DEFAULT_PALETTE,
  isColorblindMode: false,
};

/**
 * Settings store with SQLite persistence
 *
 * Note: The initialState cast is needed because createPersistedStore's type signature
 * expects Omit<T, keyof PersistedActions> which includes action method types, but
 * initial state only contains data properties. The stateCreator provides the actions.
 */
export const useSettingsStore = createPersistedStore<SettingsStoreState>(
  'settings',
  initialState as Omit<SettingsStoreState, '_hydrate' | '_persist' | '_reset'>,
  (set, get) => ({
    // State
    settings: { ...DEFAULT_GAME_SETTINGS },
    colorPalette: DEFAULT_PALETTE,
    isColorblindMode: false,

    // Actions
    updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
      set((state) => {
        const newSettings = { ...state.settings, [key]: value };
        const newPalette = getColorPalette(newSettings.colorBlindMode);
        const newIsColorblind = newSettings.colorBlindMode !== 'none';

        // Apply side effects
        applyAccessibilitySettings(newSettings);
        applyAudioSettings(newSettings);

        // Emit event
        getEventBus().emit({ type: 'SETTINGS_CHANGED', key, value });

        return {
          settings: newSettings,
          colorPalette: newPalette,
          isColorblindMode: newIsColorblind,
        };
      });
    },

    updateSettings: (updates: Partial<GameSettings>) => {
      set((state) => {
        const newSettings = { ...state.settings, ...updates };
        const newPalette = getColorPalette(newSettings.colorBlindMode);
        const newIsColorblind = newSettings.colorBlindMode !== 'none';

        // Apply side effects
        applyAccessibilitySettings(newSettings);
        applyAudioSettings(newSettings);

        // Emit events for each changed setting
        for (const [key, value] of Object.entries(updates)) {
          getEventBus().emit({ type: 'SETTINGS_CHANGED', key, value });
        }

        return {
          settings: newSettings,
          colorPalette: newPalette,
          isColorblindMode: newIsColorblind,
        };
      });
    },

    resetSettings: () => {
      set(() => {
        const newSettings = { ...DEFAULT_GAME_SETTINGS };
        const newPalette = DEFAULT_PALETTE;

        // Apply side effects
        applyAccessibilitySettings(newSettings);
        applyAudioSettings(newSettings);

        return {
          settings: newSettings,
          colorPalette: newPalette,
          isColorblindMode: false,
        };
      });
    },

    resetCategory: (category: 'audio' | 'controls' | 'graphics' | 'accessibility') => {
      set((state) => {
        let updates: Partial<GameSettings>;

        switch (category) {
          case 'audio':
            updates = {
              masterVolume: DEFAULT_GAME_SETTINGS.masterVolume,
              musicVolume: DEFAULT_GAME_SETTINGS.musicVolume,
              sfxVolume: DEFAULT_GAME_SETTINGS.sfxVolume,
              voiceVolume: DEFAULT_GAME_SETTINGS.voiceVolume,
              ambientVolume: DEFAULT_GAME_SETTINGS.ambientVolume,
              masterMuted: DEFAULT_GAME_SETTINGS.masterMuted,
              musicMuted: DEFAULT_GAME_SETTINGS.musicMuted,
              sfxMuted: DEFAULT_GAME_SETTINGS.sfxMuted,
              voiceMuted: DEFAULT_GAME_SETTINGS.voiceMuted,
              ambientMuted: DEFAULT_GAME_SETTINGS.ambientMuted,
            };
            break;
          case 'controls':
            updates = {
              mouseSensitivity: DEFAULT_GAME_SETTINGS.mouseSensitivity,
              invertMouseY: DEFAULT_GAME_SETTINGS.invertMouseY,
              touchSensitivity: DEFAULT_GAME_SETTINGS.touchSensitivity,
              fieldOfView: DEFAULT_GAME_SETTINGS.fieldOfView,
            };
            break;
          case 'graphics':
            updates = {
              graphicsQuality: DEFAULT_GAME_SETTINGS.graphicsQuality,
              showFPS: DEFAULT_GAME_SETTINGS.showFPS,
              reduceMotion: DEFAULT_GAME_SETTINGS.reduceMotion,
              screenShake: DEFAULT_GAME_SETTINGS.screenShake,
              screenShakeIntensity: DEFAULT_GAME_SETTINGS.screenShakeIntensity,
              shadowsEnabled: DEFAULT_GAME_SETTINGS.shadowsEnabled,
              shadowQuality: DEFAULT_GAME_SETTINGS.shadowQuality,
              particlesEnabled: DEFAULT_GAME_SETTINGS.particlesEnabled,
              particleDensity: DEFAULT_GAME_SETTINGS.particleDensity,
              postProcessingEnabled: DEFAULT_GAME_SETTINGS.postProcessingEnabled,
              motionBlur: DEFAULT_GAME_SETTINGS.motionBlur,
              resolutionScale: DEFAULT_GAME_SETTINGS.resolutionScale,
              fpsLimit: DEFAULT_GAME_SETTINGS.fpsLimit,
              bloomEnabled: DEFAULT_GAME_SETTINGS.bloomEnabled,
              bloomIntensity: DEFAULT_GAME_SETTINGS.bloomIntensity,
              chromaticAberrationEnabled: DEFAULT_GAME_SETTINGS.chromaticAberrationEnabled,
              vignetteEnabled: DEFAULT_GAME_SETTINGS.vignetteEnabled,
              filmGrainEnabled: DEFAULT_GAME_SETTINGS.filmGrainEnabled,
              filmGrainIntensity: DEFAULT_GAME_SETTINGS.filmGrainIntensity,
              colorGradingEnabled: DEFAULT_GAME_SETTINGS.colorGradingEnabled,
            };
            break;
          case 'accessibility':
            updates = {
              highContrast: DEFAULT_GAME_SETTINGS.highContrast,
              largeUI: DEFAULT_GAME_SETTINGS.largeUI,
              colorBlindMode: DEFAULT_GAME_SETTINGS.colorBlindMode,
              useShapeIndicators: DEFAULT_GAME_SETTINGS.useShapeIndicators,
              usePatternIndicators: DEFAULT_GAME_SETTINGS.usePatternIndicators,
              autoAim: DEFAULT_GAME_SETTINGS.autoAim,
              reducedFlashing: DEFAULT_GAME_SETTINGS.reducedFlashing,
            };
            break;
          default:
            return state;
        }

        const newSettings = { ...state.settings, ...updates };
        const newPalette = getColorPalette(newSettings.colorBlindMode);
        const newIsColorblind = newSettings.colorBlindMode !== 'none';

        // Apply side effects
        applyAccessibilitySettings(newSettings);
        applyAudioSettings(newSettings);

        return {
          settings: newSettings,
          colorPalette: newPalette,
          isColorblindMode: newIsColorblind,
        };
      });
    },

    hasCustomSettings: () => {
      const state = get();
      return JSON.stringify(state.settings) !== JSON.stringify(DEFAULT_GAME_SETTINGS);
    },

    getMouseSensitivity: () => {
      return BASE_MOUSE_SENSITIVITY * get().settings.mouseSensitivity;
    },

    getTouchSensitivity: () => {
      return BASE_TOUCH_SENSITIVITY * get().settings.touchSensitivity;
    },

    getFOVRadians: () => {
      // Convert degrees to radians: degrees * (PI / 180)
      return get().settings.fieldOfView * (Math.PI / 180);
    },

    getColor: (role: keyof ColorPalette) => {
      return get().colorPalette[role];
    },
  }),
  {
    onHydrate: (state) => {
      // Apply accessibility settings after hydration
      applyAccessibilitySettings(state.settings);
      applyAudioSettings(state.settings);
      log.info('Settings hydrated and applied');
    },
  }
);

// ============================================================================
// CONVENIENCE HOOK FOR COMPATIBILITY
// ============================================================================

/**
 * Convenience hook that provides a similar API to the old useSettings()
 * For new code, prefer using useSettingsStore directly with selectors.
 */
export function useSettings() {
  const settings = useSettingsStore((state) => state.settings);
  const colorPalette = useSettingsStore((state) => state.colorPalette);
  const isColorblindMode = useSettingsStore((state) => state.isColorblindMode);
  const updateSetting = useSettingsStore((state) => state.updateSetting);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const resetCategory = useSettingsStore((state) => state.resetCategory);
  const hasCustomSettings = useSettingsStore((state) => state.hasCustomSettings);
  const getMouseSensitivity = useSettingsStore((state) => state.getMouseSensitivity);
  const getTouchSensitivity = useSettingsStore((state) => state.getTouchSensitivity);
  const getFOVRadians = useSettingsStore((state) => state.getFOVRadians);
  const getColor = useSettingsStore((state) => state.getColor);

  return {
    settings,
    colorPalette,
    isColorblindMode,
    updateSetting,
    updateSettings,
    resetSettings,
    resetCategory,
    hasCustomSettings: hasCustomSettings(),
    getMouseSensitivity,
    getTouchSensitivity,
    getFOVRadians,
    getColor,
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the settings store (hydrate from persistence)
 * Call this during app startup before rendering
 */
export async function initializeSettingsStore(): Promise<void> {
  await useSettingsStore.getState()._hydrate();
}
