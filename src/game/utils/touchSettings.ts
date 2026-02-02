/**
 * Touch Control Settings - Persistent user preferences for mobile controls
 *
 * Features:
 * - Control position customization
 * - Sensitivity settings (look, movement)
 * - Size and opacity preferences
 * - Inverted Y-axis option
 * - Haptic feedback toggle
 */

import { getScreenInfo } from './responsive';

/**
 * Touch control preferences
 */
export interface TouchControlSettings {
  // Look sensitivity (0.1 - 3.0, default 1.0)
  lookSensitivity: number;

  // Whether Y-axis is inverted for look
  invertedY: boolean;

  // Smooth vs raw look input (smooth applies easing)
  smoothLook: boolean;

  // Movement dead zone (0 - 0.5, default 0.12)
  movementDeadZone: number;

  // Look/aim dead zone - separate from movement (0 - 0.3, default 0.05)
  lookDeadZone: number;

  // Control opacity (0.3 - 1.0)
  controlOpacity: number;

  // Control size multiplier (0.75 - 1.5)
  controlSizeMultiplier: number;

  // Haptic feedback enabled
  hapticFeedback: boolean;

  // Haptic intensity (0.5 - 2.0, multiplier for vibration duration)
  hapticIntensity: number;

  // Custom joystick position offset from default (0-100 as percentage)
  joystickPositionX: number;
  joystickPositionY: number;

  // Custom button area position offset
  buttonPositionX: number;
  buttonPositionY: number;

  // Double-tap sprint enabled
  doubleTapSprint: boolean;

  // Swipe weapon switch enabled
  swipeWeaponSwitch: boolean;

  // Aim assist for touch players (auto-correction towards enemies)
  aimAssist: boolean;

  // Aim assist strength (0.1 - 1.0, default 0.5)
  aimAssistStrength: number;

  // Velocity-based aim sensitivity (reduces sensitivity during fast swipes)
  velocityAimScaling: boolean;

  // Joystick response curve: 'linear' | 'exponential' | 'aggressive'
  joystickCurve: 'linear' | 'exponential' | 'aggressive';
}

const STORAGE_KEY = 'stellar-descent-touch-settings';

/**
 * Default touch control settings
 * Optimized for responsive mobile FPS gameplay
 */
export const DEFAULT_TOUCH_SETTINGS: TouchControlSettings = {
  lookSensitivity: 1.0,
  invertedY: false,
  smoothLook: true,
  movementDeadZone: 0.12, // Reduced for faster response
  lookDeadZone: 0.05, // Small dead zone for precise aiming
  controlOpacity: 0.85,
  controlSizeMultiplier: 1.0,
  hapticFeedback: true,
  hapticIntensity: 1.0,
  joystickPositionX: 0,
  joystickPositionY: 0,
  buttonPositionX: 0,
  buttonPositionY: 0,
  doubleTapSprint: true,
  swipeWeaponSwitch: true,
  aimAssist: true, // Enabled by default for touch
  aimAssistStrength: 0.5,
  velocityAimScaling: true,
  joystickCurve: 'exponential',
};

/**
 * Load touch control settings from localStorage
 */
export function loadTouchSettings(): TouchControlSettings {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    // Merge with defaults to handle new properties
    return { ...DEFAULT_TOUCH_SETTINGS, ...parsed };
  }
  return { ...DEFAULT_TOUCH_SETTINGS };
}

/**
 * Save touch control settings to localStorage
 */
export function saveTouchSettings(settings: TouchControlSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Reset touch control settings to defaults
 */
export function resetTouchSettings(): TouchControlSettings {
  const defaults = { ...DEFAULT_TOUCH_SETTINGS };
  saveTouchSettings(defaults);
  return defaults;
}

/**
 * Calculate scaled control sizes based on screen info and user preferences
 */
export interface ScaledControlSizes {
  joystickSize: number;
  joystickThumbSize: number;
  touchAreaPadding: number; // Extra touch area beyond visual
  fireButtonSize: number;
  smallButtonSize: number;
  sprintButtonSize: number;
  /** Minimum touch target size per WCAG guidelines (44x44px) */
  minTouchTarget: number;
}

/**
 * WCAG 2.1 minimum touch target size
 * https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
 */
export const MIN_TOUCH_TARGET_SIZE = 44;

export function getScaledControlSizes(sizeMultiplier: number = 1.0): ScaledControlSizes {
  const screenInfo = getScreenInfo();
  const { width, height, deviceType } = screenInfo;
  const minDim = Math.min(width, height);

  // Base sizes vary by device type - increased for better touch targets
  let baseJoystick: number;
  let baseFireButton: number;

  switch (deviceType) {
    case 'mobile':
      // Increased sizes for better mobile touch targets
      baseJoystick = Math.max(Math.min(minDim * 0.25, 110), 90);
      baseFireButton = Math.max(Math.min(minDim * 0.2, 88), 70);
      break;
    case 'tablet':
      baseJoystick = Math.max(Math.min(minDim * 0.17, 140), 110);
      baseFireButton = Math.max(Math.min(minDim * 0.14, 100), 80);
      break;
    default:
      baseJoystick = 120;
      baseFireButton = 85;
  }

  const scaled = (base: number) => Math.round(base * sizeMultiplier);

  // Ensure all touch targets meet minimum 44px requirement
  const ensureMinSize = (size: number) => Math.max(size, MIN_TOUCH_TARGET_SIZE);

  return {
    joystickSize: scaled(baseJoystick),
    joystickThumbSize: scaled(baseJoystick * 0.45),
    touchAreaPadding: scaled(24), // Increased padding for easier touch
    fireButtonSize: ensureMinSize(scaled(baseFireButton)),
    smallButtonSize: ensureMinSize(scaled(baseFireButton * 0.75)), // Increased from 0.7
    sprintButtonSize: ensureMinSize(scaled(baseFireButton * 0.9)), // Increased from 0.85
    minTouchTarget: MIN_TOUCH_TARGET_SIZE,
  };
}

/**
 * Response curve types for joystick input
 * - linear: Direct 1:1 mapping (raw input)
 * - exponential: Fine control at low values, fast at high (default)
 * - aggressive: Very slow at low values, rapid acceleration
 */
export type JoystickCurveType = 'linear' | 'exponential' | 'aggressive';

/**
 * Exponents for each curve type
 */
const CURVE_EXPONENTS: Record<JoystickCurveType, number> = {
  linear: 1.0,
  exponential: 1.5,
  aggressive: 2.2,
};

/**
 * Apply acceleration curve to joystick input
 * Creates a non-linear response for fine control at low values
 * and faster movement at high values
 */
export function applyAccelerationCurve(
  value: number,
  curveType: JoystickCurveType | number = 'exponential'
): number {
  // Preserve sign while applying curve
  const sign = Math.sign(value);
  const magnitude = Math.abs(value);

  // Get exponent from curve type or use direct number
  const exponent = typeof curveType === 'number' ? curveType : CURVE_EXPONENTS[curveType];

  return sign * magnitude ** exponent;
}

/**
 * Apply dead zone to joystick input
 * Values below dead zone return 0, above are scaled to full range
 */
export function applyDeadZone(value: number, deadZone: number): number {
  const magnitude = Math.abs(value);
  if (magnitude < deadZone) return 0;

  // Scale remaining range to 0-1
  const sign = Math.sign(value);
  const scaledMagnitude = (magnitude - deadZone) / (1 - deadZone);
  return sign * scaledMagnitude;
}

/**
 * Smooth look input using exponential smoothing with velocity-based adaptation
 */
export class LookSmoother {
  private previousX: number = 0;
  private previousY: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private lastTimestamp: number = 0;
  private smoothingFactor: number;

  constructor(smoothingFactor: number = 0.5) {
    // Reduced default smoothing for faster response
    this.smoothingFactor = smoothingFactor;
  }

  /**
   * Smooth input with optional velocity-based scaling
   * Fast movements get less smoothing for responsiveness
   * Slow movements get more smoothing for precision
   */
  smooth(
    x: number,
    y: number,
    options: { velocityScaling?: boolean; deadZone?: number } = {}
  ): { x: number; y: number; velocity: number } {
    const { velocityScaling = false, deadZone = 0 } = options;

    // Calculate delta time for velocity computation
    const now = performance.now();
    const dt = this.lastTimestamp > 0 ? (now - this.lastTimestamp) / 1000 : 0.016;
    this.lastTimestamp = now;

    // Apply dead zone to input
    const magnitude = Math.sqrt(x * x + y * y);
    if (magnitude < deadZone) {
      // Decay previous values toward zero
      this.previousX *= 0.8;
      this.previousY *= 0.8;
      return { x: this.previousX, y: this.previousY, velocity: 0 };
    }

    // Calculate instantaneous velocity
    const dx = x - this.previousX;
    const dy = y - this.previousY;
    const instantVelocity = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 0.001);

    // Smooth velocity for stability
    this.velocityX = this.velocityX * 0.7 + dx * 0.3;
    this.velocityY = this.velocityY * 0.7 + dy * 0.3;
    const velocity = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);

    // Adaptive smoothing based on velocity
    let adaptiveFactor = this.smoothingFactor;
    if (velocityScaling && instantVelocity > 0) {
      // Reduce smoothing for fast movements (more responsive)
      // Increase smoothing for slow movements (more precise)
      const velocityNorm = Math.min(instantVelocity / 500, 1); // Normalize to 0-1
      adaptiveFactor = this.smoothingFactor * (1 - velocityNorm * 0.5);
    }

    // Exponential moving average with adaptive factor
    this.previousX = this.previousX * adaptiveFactor + x * (1 - adaptiveFactor);
    this.previousY = this.previousY * adaptiveFactor + y * (1 - adaptiveFactor);

    return { x: this.previousX, y: this.previousY, velocity };
  }

  reset(): void {
    this.previousX = 0;
    this.previousY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastTimestamp = 0;
  }

  /** Update smoothing factor */
  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }
}

/**
 * Gesture detector for double-tap and swipe
 */
export interface GestureState {
  doubleTapDetected: boolean;
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
  pinchScale: number | null;
}

export class GestureDetector {
  private lastTapTime: number = 0;
  private lastTapX: number = 0;
  private lastTapY: number = 0;
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private swipeStartTime: number = 0;
  private isTracking: boolean = false;

  // Configuration
  private doubleTapThreshold: number = 300; // ms
  private doubleTapRadius: number = 50; // px
  private swipeMinDistance: number = 50; // px
  private swipeMaxTime: number = 300; // ms

  onTouchStart(x: number, y: number): GestureState {
    const now = Date.now();
    const result: GestureState = {
      doubleTapDetected: false,
      swipeDirection: null,
      pinchScale: null,
    };

    // Check for double tap
    const timeSinceLast = now - this.lastTapTime;
    const distFromLast = Math.sqrt((x - this.lastTapX) ** 2 + (y - this.lastTapY) ** 2);

    if (timeSinceLast < this.doubleTapThreshold && distFromLast < this.doubleTapRadius) {
      result.doubleTapDetected = true;
    }

    this.lastTapTime = now;
    this.lastTapX = x;
    this.lastTapY = y;

    // Start tracking for swipe
    this.swipeStartX = x;
    this.swipeStartY = y;
    this.swipeStartTime = now;
    this.isTracking = true;

    return result;
  }

  onTouchEnd(x: number, y: number): GestureState {
    const result: GestureState = {
      doubleTapDetected: false,
      swipeDirection: null,
      pinchScale: null,
    };

    if (!this.isTracking) return result;
    this.isTracking = false;

    const now = Date.now();
    const elapsed = now - this.swipeStartTime;
    const dx = x - this.swipeStartX;
    const dy = y - this.swipeStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check for swipe
    if (elapsed < this.swipeMaxTime && distance > this.swipeMinDistance) {
      // Determine direction based on dominant axis
      if (Math.abs(dx) > Math.abs(dy)) {
        result.swipeDirection = dx > 0 ? 'right' : 'left';
      } else {
        result.swipeDirection = dy > 0 ? 'down' : 'up';
      }
    }

    return result;
  }

  reset(): void {
    this.lastTapTime = 0;
    this.isTracking = false;
  }
}

/**
 * Haptic feedback patterns
 * Each pattern is either a single duration (ms) or an array of [vibrate, pause, vibrate, ...]
 */
export const HAPTIC_PATTERNS = {
  // UI interactions
  buttonPress: 10,
  buttonRelease: 5,

  // Combat - shooting
  fire: [15, 30, 15], // Quick double tap
  fireHeavy: [25, 20, 25, 20, 25], // Heavy weapon triple
  fireAuto: 8, // Short burst for automatic fire

  // Combat - taking damage
  damage: [50, 100, 50], // Strong pulse for damage
  damageLight: [30, 50], // Light damage
  damageHeavy: [80, 50, 80, 50, 80], // Heavy damage - triple strong pulse
  damageCritical: [100, 30, 100, 30, 100, 30, 100], // Critical damage - rapid strong pulses
  shieldBreak: [60, 40, 80], // Shield depleted

  // Weapons
  weaponSwitch: [10, 50, 10],
  reload: [20, 80, 40], // Click-wait-snap pattern
  reloadComplete: [15, 30, 40], // Satisfying completion
  emptyClip: [5, 20, 5, 20, 5], // Dry fire clicking

  // Movement/interaction
  impact: [30],
  land: [25], // Landing from jump
  sprint: [8], // Sprint activation
  interact: [15, 40, 15], // Object interaction

  // Feedback
  success: [20, 100, 40], // Achievement/objective
  warning: [40, 60, 40, 60], // Low health/ammo warning
  death: [100, 50, 80, 50, 60, 50, 40], // Descending death rattle
} as const;

export type HapticPattern = keyof typeof HAPTIC_PATTERNS;

/**
 * Trigger haptic feedback if enabled and supported
 * @param pattern - The haptic pattern to trigger
 * @param enabled - Whether haptic feedback is enabled
 * @param intensity - Intensity multiplier (0.5-2.0, affects duration)
 */
export function triggerHaptic(
  pattern: HapticPattern,
  enabled: boolean = true,
  intensity: number = 1.0
): void {
  if (!enabled) return;
  if (!('vibrate' in navigator)) return;

  try {
    const p = HAPTIC_PATTERNS[pattern];
    const clampedIntensity = Math.max(0.5, Math.min(2.0, intensity));

    if (typeof p === 'number') {
      navigator.vibrate(Math.round(p * clampedIntensity));
    } else {
      // Scale all durations by intensity (including pauses for rhythm)
      const scaled = p.map((v) => Math.round(v * clampedIntensity));
      navigator.vibrate([...scaled]);
    }
  } catch {
    // Silently fail if vibration not supported
  }
}

/**
 * Cancel any ongoing haptic vibration
 */
export function cancelHaptic(): void {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {
      // Silently fail
    }
  }
}
