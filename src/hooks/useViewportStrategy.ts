import { useCallback, useEffect, useState } from 'react';
import type { ScreenInfo } from '../game/types';
import {
  getScreenInfo,
  getViewportConfig,
  type ViewportConfig,
  type ViewportStrategy,
} from '../game/utils/responsive';

export interface ViewportState extends ViewportConfig {
  screenInfo: ScreenInfo;
  cssVars: Record<string, string>;
}

/**
 * Hook that provides viewport strategy information for FOV slicing
 *
 * Returns:
 * - strategy: 'full' | 'rectangular' | 'vertical'
 * - width/height: Effective viewport dimensions
 * - offsetX/offsetY: Offset from screen edges (for centering)
 * - screenInfo: Full device/screen information
 * - cssVars: CSS custom properties for styling
 */
export function useViewportStrategy(): ViewportState {
  const [state, setState] = useState<ViewportState>(() => {
    const config = getViewportConfig();
    const screenInfo = getScreenInfo();
    return {
      ...config,
      screenInfo,
      cssVars: generateCssVars(config, screenInfo),
    };
  });

  const updateViewport = useCallback(() => {
    const config = getViewportConfig();
    const screenInfo = getScreenInfo();
    setState({
      ...config,
      screenInfo,
      cssVars: generateCssVars(config, screenInfo),
    });
  }, []);

  useEffect(() => {
    // Initial update
    updateViewport();

    // Listen for changes
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    if (screen.orientation) {
      screen.orientation.addEventListener('change', updateViewport);
    }

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', updateViewport);
      }
    };
  }, [updateViewport]);

  return state;
}

/**
 * Generate CSS custom properties for viewport styling
 */
function generateCssVars(config: ViewportConfig, screenInfo: ScreenInfo): Record<string, string> {
  return {
    '--viewport-width': `${config.width}px`,
    '--viewport-height': `${config.height}px`,
    '--viewport-offset-x': `${config.offsetX}px`,
    '--viewport-offset-y': `${config.offsetY}px`,
    '--viewport-strategy': config.strategy,
    '--screen-width': `${screenInfo.width}px`,
    '--screen-height': `${screenInfo.height}px`,
    '--device-type': screenInfo.deviceType,
  };
}

/**
 * Utility to apply viewport CSS variables to an element
 */
export function applyViewportVars(
  element: HTMLElement | null,
  cssVars: Record<string, string>
): void {
  if (!element) return;

  for (const [key, value] of Object.entries(cssVars)) {
    element.style.setProperty(key, value);
  }
}

/**
 * Get CSS styles for the game viewport container based on strategy
 */
export function getViewportContainerStyles(config: ViewportConfig): React.CSSProperties {
  if (config.strategy === 'full') {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    };
  }

  return {
    position: 'absolute',
    top: config.offsetY,
    left: config.offsetX,
    width: config.width,
    height: config.height,
    // Add letterboxing background for non-full viewports
    boxShadow: 'inset 0 0 0 1px rgba(74, 93, 35, 0.3)',
  };
}

/**
 * Get CSS styles for letterbox bars (the areas outside the viewport)
 */
export function getLetterboxStyles(
  config: ViewportConfig,
  screenInfo: ScreenInfo
): {
  top: React.CSSProperties | null;
  bottom: React.CSSProperties | null;
  left: React.CSSProperties | null;
  right: React.CSSProperties | null;
} {
  if (config.strategy === 'full') {
    return { top: null, bottom: null, left: null, right: null };
  }

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    background: '#0a0a0f',
    zIndex: 10,
  };

  const { offsetX, offsetY, width, height } = config;
  const { width: screenWidth, height: screenHeight } = screenInfo;

  return {
    top:
      offsetY > 0
        ? {
            ...baseStyle,
            top: 0,
            left: 0,
            right: 0,
            height: offsetY,
          }
        : null,
    bottom:
      offsetY > 0
        ? {
            ...baseStyle,
            bottom: 0,
            left: 0,
            right: 0,
            height: offsetY,
          }
        : null,
    left:
      offsetX > 0
        ? {
            ...baseStyle,
            top: 0,
            left: 0,
            bottom: 0,
            width: offsetX,
          }
        : null,
    right:
      offsetX > 0
        ? {
            ...baseStyle,
            top: 0,
            right: 0,
            bottom: 0,
            width: offsetX,
          }
        : null,
  };
}

export default useViewportStrategy;
