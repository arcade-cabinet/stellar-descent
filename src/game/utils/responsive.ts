import type { DeviceType, Orientation, ScreenInfo } from '../types';

/**
 * Device size breakpoints
 * - Phone: < 768px width
 * - Tablet: 768px - 1024px
 * - Desktop: > 1024px
 */
export const BREAKPOINTS = {
  phone: 768,
  tablet: 1024,
  // Foldable detection ranges
  foldableMinWidth: 700,
  foldableMaxWidth: 932, // Galaxy Fold unfolded width
  foldableMaxAspectRatio: 1.5,
} as const;

/**
 * Viewport strategy for FOV slicing
 * - full: Use the entire viewport (desktop/tablet)
 * - rectangular: Center a 16:9 viewport (narrow landscape)
 * - vertical: Vertical slice for portrait (should be blocked on phones)
 */
export type ViewportStrategy = 'full' | 'rectangular' | 'vertical';

export interface ViewportConfig {
  strategy: ViewportStrategy;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Check if device is likely a foldable in unfolded state
 * Foldables when unfolded have:
 * - Wider aspect ratios (closer to square)
 * - Specific width ranges (700-932px typically)
 * - Touch capability
 */
function detectFoldableUnfolded(width: number, height: number, isTouchDevice: boolean): boolean {
  if (!isTouchDevice) return false;

  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  const aspectRatio = maxDim / minDim;

  // Unfolded foldables have aspect ratios closer to square (< 1.5)
  // and widths in the 700-932px range
  const inFoldableRange =
    minDim >= BREAKPOINTS.foldableMinWidth && minDim <= BREAKPOINTS.foldableMaxWidth;
  const hasSquareishAspect = aspectRatio < BREAKPOINTS.foldableMaxAspectRatio;

  return inFoldableRange && hasSquareishAspect;
}

/**
 * Determine device type based on screen dimensions
 */
function determineDeviceType(
  width: number,
  height: number,
  isTouchDevice: boolean,
  isFoldable: boolean
): DeviceType {
  // Foldables in unfolded state are treated as tablets
  if (isFoldable) {
    return 'tablet';
  }

  // Use the larger dimension for classification (handles rotation)
  const effectiveWidth = Math.max(width, height);

  if (effectiveWidth < BREAKPOINTS.phone) {
    return 'mobile';
  }

  if (effectiveWidth < BREAKPOINTS.tablet) {
    return isTouchDevice ? 'tablet' : 'desktop';
  }

  // Large touch devices are tablets, others are desktop
  return isTouchDevice && effectiveWidth < 1366 ? 'tablet' : 'desktop';
}

/**
 * Detect touch capability - works on ALL touch devices including foldables
 * Uses multiple detection methods for maximum compatibility:
 * - 'ontouchstart' in window: Standard touch event support
 * - navigator.maxTouchPoints > 0: Modern API, works even before touch events fire
 * - matchMedia('(pointer: coarse)'): CSS media query for touch-primary devices
 * - matchMedia('(any-pointer: coarse)'): Device has at least one touch input
 */
function detectTouchCapability(): boolean {
  // Primary detection: touch event support or touch points
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Secondary detection: CSS media query for coarse pointer (touch)
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

  // Tertiary detection: any-pointer coarse (device has at least one touch input)
  const hasAnyCoarsePointer = window.matchMedia?.('(any-pointer: coarse)')?.matches ?? false;

  return hasTouch || hasCoarsePointer || hasAnyCoarsePointer;
}

/**
 * Get comprehensive screen information
 */
export function getScreenInfo(): ScreenInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;

  const isTouchDevice = detectTouchCapability();
  const orientation: Orientation = width > height ? 'landscape' : 'portrait';

  const isFoldable = detectFoldableUnfolded(width, height, isTouchDevice);
  const deviceType = determineDeviceType(width, height, isTouchDevice, isFoldable);

  return {
    width,
    height,
    deviceType,
    orientation,
    pixelRatio,
    isTouchDevice,
    isFoldable,
    isMobile: deviceType === 'mobile' || deviceType === 'foldable',
  };
}

/**
 * Check if landscape orientation should be enforced
 * Only phones require landscape; tablets/desktops/foldables can use any orientation
 */
export function shouldEnforceLandscape(): boolean {
  const info = getScreenInfo();
  return info.deviceType === 'mobile' && info.orientation === 'portrait';
}

/**
 * Calculate viewport configuration based on device and orientation
 * Implements FOV slicing strategy:
 * - Full viewport for desktop/tablet
 * - Rectangular 16:9 slice for narrow landscape
 * - Vertical slice if somehow in portrait (should be blocked on mobile)
 */
export function getViewportConfig(): ViewportConfig {
  const { width, height, deviceType, orientation } = getScreenInfo();

  // Desktop and tablets get full viewport
  if (deviceType === 'desktop' || deviceType === 'tablet') {
    return {
      strategy: 'full',
      width,
      height,
      offsetX: 0,
      offsetY: 0,
    };
  }

  // Mobile in landscape - check if we need rectangular slicing
  if (orientation === 'landscape') {
    const currentAspect = width / height;
    const targetAspect = 16 / 9;

    // If aspect ratio is very different from 16:9, apply rectangular slice
    if (currentAspect > targetAspect * 1.1 || currentAspect < targetAspect * 0.9) {
      // Calculate centered 16:9 viewport
      let viewWidth = width;
      let viewHeight = height;

      if (currentAspect > targetAspect) {
        // Too wide - reduce width
        viewWidth = Math.round(height * targetAspect);
      } else {
        // Too tall - reduce height
        viewHeight = Math.round(width / targetAspect);
      }

      return {
        strategy: 'rectangular',
        width: viewWidth,
        height: viewHeight,
        offsetX: Math.round((width - viewWidth) / 2),
        offsetY: Math.round((height - viewHeight) / 2),
      };
    }

    // Close enough to 16:9, use full viewport
    return {
      strategy: 'full',
      width,
      height,
      offsetX: 0,
      offsetY: 0,
    };
  }

  // Portrait mode (should be blocked on mobile, but handle gracefully)
  // Vertical slice - take the middle portion
  const viewWidth = Math.min(width, Math.round(height * (9 / 16)));
  return {
    strategy: 'vertical',
    width: viewWidth,
    height,
    offsetX: Math.round((width - viewWidth) / 2),
    offsetY: 0,
  };
}

export function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// Re-export haptic utilities for convenience
export { cancelHaptic, HAPTIC_PATTERNS, type HapticPattern, triggerHaptic } from './touchSettings';

let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<void> {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      // Wake lock not available
    }
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLock) {
    try {
      await wakeLock.release();
    } catch {
      // Already released
    } finally {
      wakeLock = null;
    }
  }
}

/**
 * Check if running in a Capacitor native app context
 */
export function isCapacitorNative(): boolean {
  // Check for Capacitor native bridge
  // Use unknown cast first then to specific type to satisfy TypeScript
  const win = window as unknown as { Capacitor?: { isNativePlatform?: boolean } };
  return !!(typeof window !== 'undefined' && win.Capacitor?.isNativePlatform);
}

/**
 * Lock screen orientation to landscape using Capacitor plugin (if available)
 * Falls back to web Screen Orientation API if Capacitor is not available
 *
 * This is used on mobile phones to ensure the game is played in landscape.
 * The function is safe to call even if the APIs are not available.
 */
export async function lockToLandscape(): Promise<boolean> {
  // Try Capacitor ScreenOrientation plugin first (for native iOS/Android)
  if (isCapacitorNative()) {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.lock({ orientation: 'landscape' });
      return true;
    } catch {
      // Capacitor plugin not available or failed, fall through to web API
    }
  }

  // Try web Screen Orientation API (works in some browsers, especially Android Chrome)
  // The lock method is experimental and not in all TypeScript defs, so we need type assertion
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };
  if (orientation && typeof orientation.lock === 'function') {
    try {
      await orientation.lock('landscape');
      return true;
    } catch {
      // Web API not supported or permission denied
      // This is common on iOS Safari which doesn't support orientation lock
    }
  }

  return false;
}

/**
 * Unlock screen orientation, allowing free rotation
 */
export async function unlockOrientation(): Promise<boolean> {
  // Try Capacitor ScreenOrientation plugin first
  if (isCapacitorNative()) {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.unlock();
      return true;
    } catch {
      // Capacitor plugin not available or failed
    }
  }

  // Try web Screen Orientation API
  if (screen.orientation && typeof screen.orientation.unlock === 'function') {
    try {
      screen.orientation.unlock();
      return true;
    } catch {
      // Web API not supported
    }
  }

  return false;
}

/**
 * Get current orientation using Capacitor or web API
 */
export async function getCurrentOrientation(): Promise<Orientation> {
  // Try Capacitor first
  if (isCapacitorNative()) {
    try {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      const { type } = await ScreenOrientation.orientation();
      return type.includes('landscape') ? 'landscape' : 'portrait';
    } catch {
      // Fall through to web API
    }
  }

  // Use web API or window dimensions
  if (screen.orientation) {
    return screen.orientation.type.includes('landscape') ? 'landscape' : 'portrait';
  }

  // Fallback to window dimensions
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}
