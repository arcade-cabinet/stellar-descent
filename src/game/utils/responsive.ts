import type { DeviceType, Orientation, ScreenInfo } from '../types';

const BREAKPOINTS = {
  mobile: 0,
  mobileLarge: 414,
  tablet: 768,
  foldableOpen: 717,
  desktop: 1024,
  desktopLarge: 1440,
} as const;

export function getScreenInfo(): ScreenInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const orientation: Orientation = width > height ? 'landscape' : 'portrait';

  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  const isFoldable =
    isTouchDevice &&
    ((width >= 700 && width <= 900 && aspectRatio < 1.5) ||
      (height >= 700 && height <= 900 && aspectRatio < 1.5) ||
      width === BREAKPOINTS.foldableOpen);

  let deviceType: DeviceType;
  if (isFoldable) {
    deviceType = 'foldable';
  } else if (width < BREAKPOINTS.tablet) {
    deviceType = 'mobile';
  } else if (width < BREAKPOINTS.desktop || isTouchDevice) {
    deviceType = 'tablet';
  } else {
    deviceType = 'desktop';
  }

  return {
    width,
    height,
    deviceType,
    orientation,
    pixelRatio,
    isTouchDevice,
    isFoldable,
  };
}

export function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

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
