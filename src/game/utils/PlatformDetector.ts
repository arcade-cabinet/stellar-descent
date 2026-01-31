/**
 * PlatformDetector - Unified platform detection using Capacitor API
 *
 * Supports:
 * - iOS native (Capacitor)
 * - Android native (Capacitor)
 * - Electron desktop (Capacitor Community)
 * - Web browser (mobile and desktop)
 * - Physical keyboard detection for mobile devices
 */

import { Capacitor } from '@capacitor/core';
import { getScreenInfo } from './responsive';

// ============================================================================
// Physical Keyboard Detection State
// ============================================================================

/** Track if a physical keyboard has been detected on this device */
let physicalKeyboardDetected = false;

/** Listeners for keyboard detection changes */
const keyboardDetectionListeners: Set<(detected: boolean) => void> = new Set();

/**
 * Runtime platform targets
 */
export type Platform = 'ios' | 'android' | 'electron' | 'web';

/**
 * Device form factor
 */
export type FormFactor = 'phone' | 'tablet' | 'foldable' | 'desktop';

/**
 * Input method preference
 */
export type InputMethod = 'touch' | 'keyboard_mouse' | 'gamepad';

/**
 * Complete platform info
 */
export interface PlatformInfo {
  platform: Platform;
  formFactor: FormFactor;
  isNative: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  primaryInput: InputMethod;
  supportsKeyboard: boolean;
  supportsTouchControls: boolean;
}

/**
 * Get the current runtime platform
 */
export function getPlatform(): Platform {
  return Capacitor.getPlatform() as Platform;
}

/**
 * Check if running in a native app context (iOS, Android, or Electron)
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check if running on mobile native (iOS or Android)
 */
export function isMobileNative(): boolean {
  const platform = getPlatform();
  return platform === 'ios' || platform === 'android';
}

/**
 * Check if running in Electron desktop app
 */
export function isElectron(): boolean {
  return getPlatform() === 'electron';
}

/**
 * Check if running in web browser
 */
export function isWeb(): boolean {
  return getPlatform() === 'web';
}

/**
 * Determine form factor from screen info and platform
 */
function getFormFactor(): FormFactor {
  const { deviceType } = getScreenInfo();

  switch (deviceType) {
    case 'mobile':
      return 'phone';
    case 'tablet':
      return 'tablet';
    case 'foldable':
      return 'foldable';
    case 'desktop':
    default:
      return 'desktop';
  }
}

/**
 * Determine primary input method based on platform and form factor
 */
function getPrimaryInput(platform: Platform, formFactor: FormFactor): InputMethod {
  // Native mobile always uses touch
  if (platform === 'ios' || platform === 'android') {
    return 'touch';
  }

  // Electron desktop uses keyboard/mouse
  if (platform === 'electron') {
    return 'keyboard_mouse';
  }

  // Web - depends on form factor
  if (formFactor === 'phone' || formFactor === 'tablet' || formFactor === 'foldable') {
    return 'touch';
  }

  return 'keyboard_mouse';
}

/**
 * Get comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  const platform = getPlatform();
  const formFactor = getFormFactor();
  const primaryInput = getPrimaryInput(platform, formFactor);

  const isNativeApp = isNative();
  const isMobileDevice =
    platform === 'ios' ||
    platform === 'android' ||
    formFactor === 'phone' ||
    formFactor === 'tablet' ||
    formFactor === 'foldable';

  return {
    platform,
    formFactor,
    isNative: isNativeApp,
    isMobile: isMobileDevice,
    isDesktop: !isMobileDevice,
    primaryInput,
    // Desktop and Electron always support keyboard remapping
    supportsKeyboard: platform === 'electron' || platform === 'web',
    // Mobile native and mobile web support touch controls
    supportsTouchControls: isMobileDevice,
  };
}

/**
 * Determine if touch controls should be shown
 * - Native mobile (iOS/Android): YES
 * - Electron desktop: NO
 * - Web on mobile device: YES
 * - Web on desktop: NO
 */
export function shouldShowTouchControls(): boolean {
  const { supportsTouchControls, isDesktop, platform } = getPlatformInfo();

  // Electron desktop app never shows touch controls
  if (platform === 'electron') return false;

  // Native mobile always shows touch controls
  if (platform === 'ios' || platform === 'android') return true;

  // Web - show on mobile form factors only
  return supportsTouchControls && !isDesktop;
}

/**
 * Determine if keyboard remapping UI should use visual keyboard
 * - Mobile without physical keyboard: Show visual keyboard picker (simple-keyboard)
 * - Mobile WITH physical keyboard: Use "press any key" listening mode
 * - Desktop: Use "press any key" listening mode
 */
export function shouldUseVisualKeyboard(): boolean {
  const { platform, formFactor } = getPlatformInfo();

  // Electron desktop - always use key listening mode
  if (platform === 'electron') return false;

  // Desktop web - always use key listening mode
  if (formFactor === 'desktop') return false;

  // Mobile/tablet - check if physical keyboard is connected
  // If physical keyboard detected, use listening mode instead of visual
  if (physicalKeyboardDetected) return false;

  // Mobile without physical keyboard - use visual keyboard picker
  return true;
}

// ============================================================================
// Physical Keyboard Detection
// ============================================================================

/**
 * Check if a physical keyboard is currently detected
 */
export function hasPhysicalKeyboard(): boolean {
  return physicalKeyboardDetected;
}

/**
 * Subscribe to physical keyboard detection changes
 */
export function onPhysicalKeyboardChange(listener: (detected: boolean) => void): () => void {
  keyboardDetectionListeners.add(listener);
  return () => keyboardDetectionListeners.delete(listener);
}

/**
 * Notify all listeners of keyboard detection change
 */
function notifyKeyboardChange(detected: boolean): void {
  keyboardDetectionListeners.forEach((listener) => listener(detected));
}

/**
 * Detect physical keyboard from keyboard event characteristics
 * Physical keyboards have different event patterns than on-screen keyboards:
 * - Consistent timing
 * - No inputType in associated input events
 * - Key repeat behavior
 */
function detectPhysicalKeyboard(event: KeyboardEvent): boolean {
  // Virtual keyboards typically don't fire keydown for modifier keys alone
  // Physical keyboards always do
  const modifierKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];
  if (modifierKeys.includes(event.key)) {
    return true;
  }

  // Check for key repeat - virtual keyboards don't usually support this
  if (event.repeat) {
    return true;
  }

  // Function keys are only on physical keyboards
  if (event.key.startsWith('F') && /^F[0-9]+$/.test(event.key)) {
    return true;
  }

  // Escape key - rarely on virtual keyboards
  if (event.key === 'Escape') {
    return true;
  }

  // Check for keyboard API (only available with physical keyboard on some browsers)
  if ('keyboard' in navigator) {
    return true;
  }

  // If we got a keydown event with a single character and no composition,
  // it's likely a physical keyboard
  if (event.key.length === 1 && !event.isComposing) {
    return true;
  }

  return false;
}

/**
 * Initialize physical keyboard detection
 * Call this early in app startup to begin monitoring for keyboard connection
 */
export function initPhysicalKeyboardDetection(): void {
  // Skip on desktop - always has keyboard
  const { formFactor, platform } = getPlatformInfo();
  if (formFactor === 'desktop' || platform === 'electron') {
    physicalKeyboardDetected = true;
    return;
  }

  // Listen for keyboard events that indicate physical keyboard
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!physicalKeyboardDetected && detectPhysicalKeyboard(event)) {
      physicalKeyboardDetected = true;
      notifyKeyboardChange(true);
      console.log('[PlatformDetector] Physical keyboard detected');
    }
  };

  // Bluetooth/USB keyboard disconnect detection via visibility change
  // When external keyboard disconnects on iOS/Android, we can't detect it directly
  // but we can reset on app resume and re-detect
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && physicalKeyboardDetected) {
      // On app resume, we'll re-detect if keyboard is still connected
      // by waiting for the next keyboard event
      // For now, keep the detected state
    }
  };

  window.addEventListener('keydown', handleKeyDown, { passive: true });
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Check if keybinding settings should be shown at all
 * - Desktop/Electron: Always show (keyboard is primary input)
 * - Mobile with physical keyboard: Show
 * - Mobile without physical keyboard: HIDE (using touch controls)
 */
export function shouldShowKeyboardSettings(): boolean {
  const { platform, formFactor } = getPlatformInfo();

  // Desktop always shows keyboard settings
  if (platform === 'electron' || formFactor === 'desktop') {
    return true;
  }

  // Mobile/tablet - only show if physical keyboard connected
  return physicalKeyboardDetected;
}

// ============================================================================
// Gamepad Detection
// ============================================================================

/**
 * Controller type detection based on gamepad ID strings
 */
export type ControllerType = 'xbox' | 'playstation' | 'nintendo' | 'generic';

/**
 * Extended gamepad info with controller type
 */
export interface GamepadInfo {
  gamepad: Gamepad;
  controllerType: ControllerType;
  displayName: string;
}

/** Track connected gamepads */
let connectedGamepads: Map<number, GamepadInfo> = new Map();

/** Listeners for gamepad connection changes */
const gamepadChangeListeners: Set<(gamepads: GamepadInfo[]) => void> = new Set();

/** Gamepad polling interval handle */
let gamepadPollingInterval: number | null = null;

/**
 * Detect controller type from gamepad ID string
 */
function detectControllerType(gamepad: Gamepad): ControllerType {
  const id = gamepad.id.toLowerCase();

  // Xbox controllers
  if (
    id.includes('xbox') ||
    id.includes('xinput') ||
    id.includes('microsoft') ||
    id.includes('045e') // Microsoft vendor ID
  ) {
    return 'xbox';
  }

  // PlayStation controllers
  if (
    id.includes('playstation') ||
    id.includes('dualshock') ||
    id.includes('dualsense') ||
    id.includes('sony') ||
    id.includes('054c') // Sony vendor ID
  ) {
    return 'playstation';
  }

  // Nintendo controllers
  if (
    id.includes('nintendo') ||
    id.includes('pro controller') ||
    id.includes('joy-con') ||
    id.includes('057e') // Nintendo vendor ID
  ) {
    return 'nintendo';
  }

  return 'generic';
}

/**
 * Get display name for controller
 */
function getControllerDisplayName(gamepad: Gamepad, type: ControllerType): string {
  const id = gamepad.id.toLowerCase();

  switch (type) {
    case 'xbox':
      if (id.includes('series')) return 'Xbox Series Controller';
      if (id.includes('one')) return 'Xbox One Controller';
      if (id.includes('360')) return 'Xbox 360 Controller';
      return 'Xbox Controller';

    case 'playstation':
      if (id.includes('dualsense')) return 'DualSense Controller';
      if (id.includes('dualshock 4') || id.includes('dualshock4')) return 'DualShock 4';
      if (id.includes('dualshock 3') || id.includes('dualshock3')) return 'DualShock 3';
      return 'PlayStation Controller';

    case 'nintendo':
      if (id.includes('pro controller')) return 'Switch Pro Controller';
      if (id.includes('joy-con')) return 'Joy-Con';
      return 'Nintendo Controller';

    default:
      // Try to extract a cleaner name from the ID
      const match = gamepad.id.match(/^([^(]+)/);
      if (match) {
        return match[1].trim();
      }
      return 'Generic Controller';
  }
}

/**
 * Notify all listeners of gamepad changes
 */
function notifyGamepadChange(): void {
  const gamepads = Array.from(connectedGamepads.values());
  gamepadChangeListeners.forEach((listener) => listener(gamepads));
}

/**
 * Check if any gamepad is currently connected
 */
export function hasGamepad(): boolean {
  return connectedGamepads.size > 0;
}

/**
 * Get all connected gamepads with their info
 */
export function getConnectedGamepads(): GamepadInfo[] {
  return Array.from(connectedGamepads.values());
}

/**
 * Get raw Gamepad objects (for input polling)
 */
export function getRawGamepads(): Gamepad[] {
  // Always get fresh state from the API
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  return Array.from(gamepads).filter((gp): gp is Gamepad => gp !== null);
}

/**
 * Subscribe to gamepad connection/disconnection changes
 */
export function onGamepadChange(listener: (gamepads: GamepadInfo[]) => void): () => void {
  gamepadChangeListeners.add(listener);
  return () => gamepadChangeListeners.delete(listener);
}

/**
 * Update gamepad state from the API
 */
function updateGamepadState(): void {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const newConnected = new Map<number, GamepadInfo>();

  for (const gamepad of gamepads) {
    if (gamepad && gamepad.connected) {
      // Check if this is a new connection
      if (!connectedGamepads.has(gamepad.index)) {
        const type = detectControllerType(gamepad);
        const displayName = getControllerDisplayName(gamepad, type);
        console.log(`[PlatformDetector] Gamepad connected: ${displayName}`);
      }

      const type = detectControllerType(gamepad);
      newConnected.set(gamepad.index, {
        gamepad,
        controllerType: type,
        displayName: getControllerDisplayName(gamepad, type),
      });
    }
  }

  // Check for disconnections
  for (const [index, info] of connectedGamepads) {
    if (!newConnected.has(index)) {
      console.log(`[PlatformDetector] Gamepad disconnected: ${info.displayName}`);
    }
  }

  // Update state and notify if changed
  const wasConnected = connectedGamepads.size > 0;
  const isConnected = newConnected.size > 0;
  const countChanged = connectedGamepads.size !== newConnected.size;

  connectedGamepads = newConnected;

  if (wasConnected !== isConnected || countChanged) {
    notifyGamepadChange();
  }
}

/**
 * Initialize gamepad detection
 * Uses both event listeners and polling for maximum compatibility
 */
export function initGamepadDetection(): void {
  // Handle gamepad connected event
  const handleGamepadConnected = (event: GamepadEvent) => {
    const gamepad = event.gamepad;
    const type = detectControllerType(gamepad);
    const displayName = getControllerDisplayName(gamepad, type);

    console.log(`[PlatformDetector] Gamepad connected: ${displayName}`);

    connectedGamepads.set(gamepad.index, {
      gamepad,
      controllerType: type,
      displayName,
    });

    notifyGamepadChange();
  };

  // Handle gamepad disconnected event
  const handleGamepadDisconnected = (event: GamepadEvent) => {
    const info = connectedGamepads.get(event.gamepad.index);
    if (info) {
      console.log(`[PlatformDetector] Gamepad disconnected: ${info.displayName}`);
    }

    connectedGamepads.delete(event.gamepad.index);
    notifyGamepadChange();
  };

  // Listen for gamepad events
  window.addEventListener('gamepadconnected', handleGamepadConnected);
  window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

  // Some browsers don't fire events reliably, so also poll
  // Poll at 1Hz for connection changes (input polling is handled separately)
  if (gamepadPollingInterval === null) {
    gamepadPollingInterval = window.setInterval(updateGamepadState, 1000);
  }

  // Check for already-connected gamepads
  updateGamepadState();
}

/**
 * Check if gamepad settings should be shown
 */
export function shouldShowGamepadSettings(): boolean {
  return hasGamepad();
}
