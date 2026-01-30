import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COLOR_BLIND_MODE_DESCRIPTIONS,
  COLOR_BLIND_MODE_LABELS,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
  SettingsProvider,
  useSettings,
} from './SettingsContext';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock AudioManager
vi.mock('../core/AudioManager', () => ({
  getAudioManager: () => ({
    setMasterVolume: vi.fn(),
    setMusicVolume: vi.fn(),
    setSFXVolume: vi.fn(),
    setVoiceVolume: vi.fn(),
    setAmbientVolume: vi.fn(),
  }),
}));

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset document root state
    document.documentElement.removeAttribute('data-color-blind-mode');
    document.documentElement.classList.remove(
      'reduce-motion',
      'high-contrast',
      'large-ui',
      'reduced-flashing',
      'colorblind-mode',
      'cb-shapes',
      'cb-patterns'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  describe('Color Blind Mode Settings', () => {
    it('should have all colorblind mode labels defined', () => {
      expect(COLOR_BLIND_MODE_LABELS).toEqual({
        none: 'None',
        protanopia: 'Protanopia (Red-Weak)',
        deuteranopia: 'Deuteranopia (Green-Weak)',
        tritanopia: 'Tritanopia (Blue-Weak)',
        'high-contrast': 'High Contrast',
      });
    });

    it('should have all colorblind mode descriptions defined', () => {
      expect(COLOR_BLIND_MODE_DESCRIPTIONS).toEqual({
        none: 'Standard color scheme',
        protanopia: 'Optimized for reduced red sensitivity - uses blue/yellow contrast',
        deuteranopia: 'Optimized for reduced green sensitivity - uses blue/yellow contrast',
        tritanopia: 'Optimized for reduced blue/yellow sensitivity - uses red/cyan contrast',
        'high-contrast': 'Maximum visibility with pure colors and enhanced outlines',
      });
    });

    it('should default to none colorblind mode', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.colorBlindMode).toBe('none');
      expect(result.current.isColorblindMode).toBe(false);
    });

    it('should update colorBlindMode setting', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('colorBlindMode', 'protanopia');
      });

      await waitFor(() => {
        expect(result.current.settings.colorBlindMode).toBe('protanopia');
        expect(result.current.isColorblindMode).toBe(true);
      });
    });

    it('should apply correct color palette for each colorblind mode', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      // Test default palette
      expect(result.current.colorPalette.healthHigh).toBe('#4CAF50');
      expect(result.current.colorPalette.enemy).toBe('#F44336');

      // Test protanopia palette
      act(() => {
        result.current.updateSetting('colorBlindMode', 'protanopia');
      });

      await waitFor(() => {
        expect(result.current.colorPalette.healthHigh).toBe('#00BCD4');
        expect(result.current.colorPalette.enemy).toBe('#FF00FF');
      });

      // Test high-contrast palette
      act(() => {
        result.current.updateSetting('colorBlindMode', 'high-contrast');
      });

      await waitFor(() => {
        expect(result.current.colorPalette.healthHigh).toBe('#00FF00');
        expect(result.current.colorPalette.enemy).toBe('#FF0000');
      });
    });

    it('should set data-color-blind-mode attribute on document root', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('colorBlindMode', 'deuteranopia');
      });

      await waitFor(() => {
        expect(document.documentElement.getAttribute('data-color-blind-mode')).toBe('deuteranopia');
      });
    });

    it('should toggle colorblind-mode class when mode is not none', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(document.documentElement.classList.contains('colorblind-mode')).toBe(false);

      act(() => {
        result.current.updateSetting('colorBlindMode', 'tritanopia');
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('colorblind-mode')).toBe(true);
      });

      act(() => {
        result.current.updateSetting('colorBlindMode', 'none');
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('colorblind-mode')).toBe(false);
      });
    });

    it('should apply high-contrast class for high-contrast mode', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('colorBlindMode', 'high-contrast');
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
      });
    });
  });

  describe('Shape and Pattern Indicators', () => {
    it('should default useShapeIndicators to false', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.useShapeIndicators).toBe(false);
    });

    it('should default usePatternIndicators to false', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current.settings.usePatternIndicators).toBe(false);
    });

    it('should toggle cb-shapes class when useShapeIndicators is enabled', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(document.documentElement.classList.contains('cb-shapes')).toBe(false);

      act(() => {
        result.current.updateSetting('useShapeIndicators', true);
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('cb-shapes')).toBe(true);
      });
    });

    it('should toggle cb-patterns class when usePatternIndicators is enabled', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(document.documentElement.classList.contains('cb-patterns')).toBe(false);

      act(() => {
        result.current.updateSetting('usePatternIndicators', true);
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('cb-patterns')).toBe(true);
      });
    });
  });

  describe('getColor helper', () => {
    it('should return correct color for role based on current mode', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      // Default mode
      expect(result.current.getColor('healthHigh')).toBe('#4CAF50');

      // Change to protanopia
      act(() => {
        result.current.updateSetting('colorBlindMode', 'protanopia');
      });

      await waitFor(() => {
        expect(result.current.getColor('healthHigh')).toBe('#00BCD4');
      });
    });
  });

  describe('CSS Custom Properties', () => {
    it('should apply CSS custom properties for colorblind palette', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('colorBlindMode', 'tritanopia');
      });

      await waitFor(() => {
        const rootStyle = document.documentElement.style;
        expect(rootStyle.getPropertyValue('--cb-health-high')).toBe('#00FF00');
        expect(rootStyle.getPropertyValue('--cb-enemy')).toBe('#FF0000');
        expect(rootStyle.getPropertyValue('--cb-friendly')).toBe('#00FFFF');
      });
    });
  });

  describe('Reset Settings', () => {
    it('should reset accessibility settings including colorblind mode', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      // Change settings
      act(() => {
        result.current.updateSettings({
          colorBlindMode: 'protanopia',
          useShapeIndicators: true,
          usePatternIndicators: true,
          highContrast: true,
        });
      });

      await waitFor(() => {
        expect(result.current.settings.colorBlindMode).toBe('protanopia');
      });

      // Reset accessibility
      act(() => {
        result.current.resetCategory('accessibility');
      });

      await waitFor(() => {
        expect(result.current.settings.colorBlindMode).toBe(DEFAULT_GAME_SETTINGS.colorBlindMode);
        expect(result.current.settings.useShapeIndicators).toBe(
          DEFAULT_GAME_SETTINGS.useShapeIndicators
        );
        expect(result.current.settings.usePatternIndicators).toBe(
          DEFAULT_GAME_SETTINGS.usePatternIndicators
        );
        expect(result.current.settings.highContrast).toBe(DEFAULT_GAME_SETTINGS.highContrast);
      });
    });
  });

  describe('Persistence', () => {
    it('should persist colorblind settings to localStorage', async () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSetting('colorBlindMode', 'deuteranopia');
      });

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
        const savedSettings = JSON.parse(
          localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1]
        );
        expect(savedSettings.colorBlindMode).toBe('deuteranopia');
      });
    });
  });
});
