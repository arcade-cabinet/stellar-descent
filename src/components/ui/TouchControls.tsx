/**
 * TouchControls - Enhanced mobile touch controls for FPS gameplay
 *
 * Features:
 * - Virtual joystick with dead zones and acceleration curves
 * - Smooth look control with sensitivity and inverted Y option
 * - Fire button with haptic feedback
 * - Reload button with progress indicator
 * - Jump/Crouch/Sprint buttons
 * - Context-sensitive action button
 * - Double-tap to sprint gesture
 * - Swipe to switch weapons gesture
 * - Adjustable control positions, sizes, and opacity
 * - Haptic feedback for various actions
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TouchInput } from '../../game/types';
import {
  DYNAMIC_ACTION_LABELS,
  type DynamicAction,
  useKeybindings,
} from '../../game/context/KeybindingsContext';
import { getScreenInfo } from '../../game/utils/responsive';
import {
  applyAccelerationCurve,
  applyDeadZone,
  DEFAULT_TOUCH_SETTINGS,
  GestureDetector,
  getScaledControlSizes,
  LookSmoother,
  loadTouchSettings,
  MIN_TOUCH_TARGET_SIZE,
  saveTouchSettings,
  type TouchControlSettings,
  triggerHaptic,
} from '../../game/utils/touchSettings';
import styles from './TouchControls.module.css';

interface TouchControlsProps {
  onInput: (input: TouchInput | null) => void;
  /** Whether to show the settings panel */
  showSettings?: boolean;
  /** Callback when settings panel is toggled */
  onSettingsToggle?: (show: boolean) => void;
  /** Reload progress (0-1), undefined when not reloading */
  reloadProgress?: number;
  /** Whether a context-sensitive interaction is available */
  interactionAvailable?: boolean;
  /** Label for the context-sensitive interaction button */
  interactionLabel?: string;
  /** Callback when pause button is pressed */
  onPause?: () => void;
  /** Callback when a dynamic action button is pressed */
  onDynamicAction?: (action: DynamicAction) => void;
}

/**
 * Configuration for dynamic action button appearance
 */
interface DynamicActionConfig {
  icon: string;
  shortLabel: string;
  category: 'vehicle' | 'squad' | 'ability' | 'weapon' | 'movement';
  color: string;
  borderColor: string;
}

/**
 * Map of dynamic actions to their button configurations
 */
const DYNAMIC_ACTION_CONFIG: Record<DynamicAction, DynamicActionConfig> = {
  // Vehicle controls - blue/cyan theme
  vehicleBoost: {
    icon: '>',
    shortLabel: 'BOOST',
    category: 'vehicle',
    color: 'rgba(0, 188, 212, 0.3)',
    borderColor: '#00bcd4',
  },
  vehicleBrake: {
    icon: '||',
    shortLabel: 'BRAKE',
    category: 'vehicle',
    color: 'rgba(255, 152, 0, 0.3)',
    borderColor: '#ff9800',
  },
  vehicleEject: {
    icon: '^',
    shortLabel: 'EJECT',
    category: 'vehicle',
    color: 'rgba(244, 67, 54, 0.3)',
    borderColor: '#f44336',
  },
  // Squad commands - purple/magenta theme
  squadFollow: {
    icon: 'F',
    shortLabel: 'FOLLOW',
    category: 'squad',
    color: 'rgba(156, 39, 176, 0.3)',
    borderColor: '#9c27b0',
  },
  squadHold: {
    icon: 'H',
    shortLabel: 'HOLD',
    category: 'squad',
    color: 'rgba(156, 39, 176, 0.3)',
    borderColor: '#9c27b0',
  },
  squadAttack: {
    icon: '!',
    shortLabel: 'ATTACK',
    category: 'squad',
    color: 'rgba(233, 30, 99, 0.3)',
    borderColor: '#e91e63',
  },
  squadRegroup: {
    icon: 'R',
    shortLabel: 'REGROUP',
    category: 'squad',
    color: 'rgba(156, 39, 176, 0.3)',
    borderColor: '#9c27b0',
  },
  // Abilities - teal theme
  useAbility1: {
    icon: '1',
    shortLabel: 'ABILITY',
    category: 'ability',
    color: 'rgba(0, 150, 136, 0.3)',
    borderColor: '#009688',
  },
  useAbility2: {
    icon: '2',
    shortLabel: 'ABILITY',
    category: 'ability',
    color: 'rgba(0, 150, 136, 0.3)',
    borderColor: '#009688',
  },
  useAbility3: {
    icon: '3',
    shortLabel: 'ABILITY',
    category: 'ability',
    color: 'rgba(0, 150, 136, 0.3)',
    borderColor: '#009688',
  },
  // Weapon controls - red/orange theme
  weaponMelee: {
    icon: 'M',
    shortLabel: 'MELEE',
    category: 'weapon',
    color: 'rgba(255, 87, 34, 0.3)',
    borderColor: '#ff5722',
  },
  weaponGrenade: {
    icon: 'G',
    shortLabel: 'NADE',
    category: 'weapon',
    color: 'rgba(255, 152, 0, 0.3)',
    borderColor: '#ff9800',
  },
  // Movement abilities - green theme
  mantle: {
    icon: '^',
    shortLabel: 'MANTLE',
    category: 'movement',
    color: 'rgba(76, 175, 80, 0.3)',
    borderColor: '#4caf50',
  },
  slide: {
    icon: '_',
    shortLabel: 'SLIDE',
    category: 'movement',
    color: 'rgba(76, 175, 80, 0.3)',
    borderColor: '#4caf50',
  },
};

/**
 * Groups dynamic actions by category for organized display
 */
function groupDynamicActionsByCategory(
  actions: DynamicAction[]
): Map<string, DynamicAction[]> {
  const grouped = new Map<string, DynamicAction[]>();

  for (const action of actions) {
    const config = DYNAMIC_ACTION_CONFIG[action];
    const category = config.category;
    const existing = grouped.get(category) || [];
    existing.push(action);
    grouped.set(category, existing);
  }

  return grouped;
}

interface JoystickState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  pointerId: number | null;
}

interface LookTouchState {
  active: boolean;
  lastX: number;
  lastY: number;
  pointerId: number | null;
}

export function TouchControls({
  onInput,
  showSettings = false,
  onSettingsToggle,
  reloadProgress,
  interactionAvailable = false,
  interactionLabel = 'USE',
  onPause,
  onDynamicAction,
}: TouchControlsProps) {
  // Get active dynamic actions from keybindings context
  const { activeDynamicActions, getRegisteredDynamicActions } = useKeybindings();

  // Group dynamic actions by category for organized display
  const groupedDynamicActions = useMemo(
    () => groupDynamicActionsByCategory(activeDynamicActions),
    [activeDynamicActions]
  );

  // Track which dynamic action buttons are currently pressed
  const [activeDynamicButtons, setActiveDynamicButtons] = useState<Set<DynamicAction>>(
    new Set()
  );

  // Settings
  const [settings, setSettings] = useState<TouchControlSettings>(() => loadTouchSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(showSettings);

  // Joystick state
  const [moveStick, setMoveStick] = useState<JoystickState>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    pointerId: null,
  });

  // Look touch state
  const [lookTouch, setLookTouch] = useState<LookTouchState>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
  });
  const [lookDelta, setLookDelta] = useState({ x: 0, y: 0 });

  // Action buttons state
  const [isFiring, setIsFiring] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [isCrouching, setIsCrouching] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isMelee, setIsMelee] = useState(false);
  const [isGrenade, setIsGrenade] = useState(false);
  const [isAimingGrenade, setIsAimingGrenade] = useState(false);
  const [isSliding, setIsSliding] = useState(false);

  // Melee cooldown tracking
  const [meleeCooldown, setMeleeCooldown] = useState(0);
  const meleeCooldownDuration = 800; // ms
  const lastMeleeTimeRef = useRef(0);

  // Grenade long-press tracking
  const grenadeTimerRef = useRef<number | null>(null);
  const grenadeAimStartTime = useRef(0);
  const [grenadeCount, setGrenadeCount] = useState(3); // TODO: Get from game state

  // Slide double-tap tracking
  const lastCrouchTapRef = useRef(0);
  const doubleTapThreshold = 250; // ms - reduced from 300ms for faster response

  // Track active slide visual state (for button highlighting)
  const [isSlideActive, setIsSlideActive] = useState(false);
  const slideVisualTimerRef = useRef<number | null>(null);

  // Weapon switching
  const [activeWeapon, setActiveWeapon] = useState(0);
  const [weaponSwitchRequest, setWeaponSwitchRequest] = useState<number | undefined>(undefined);

  // Gesture detection
  const gestureDetectorRef = useRef(new GestureDetector());
  const lookSmootherRef = useRef(new LookSmoother(0.5)); // Reduced smoothing for faster response

  // Scaled sizes based on device and settings
  const controlSizes = useMemo(
    () => getScaledControlSizes(settings.controlSizeMultiplier),
    [settings.controlSizeMultiplier]
  );

  // Max joystick distance
  const maxDistance = controlSizes.joystickSize * 0.4;

  // Update settings when showSettings prop changes
  useEffect(() => {
    setIsSettingsOpen(showSettings);
  }, [showSettings]);

  // Calculate joystick output with dead zone and acceleration
  // Also returns whether joystick is at edge (for sprint)
  const getJoystickOutput = useCallback(
    (stick: JoystickState): { x: number; y: number; atEdge: boolean } => {
      if (!stick.active) return { x: 0, y: 0, atEdge: false };

      const dx = stick.currentX - stick.startX;
      const dy = stick.currentY - stick.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Apply dead zone
      const deadZone = settings.movementDeadZone * maxDistance;
      if (distance < deadZone) return { x: 0, y: 0, atEdge: false };

      // Normalize and apply dead zone scaling
      const effectiveDistance = distance - deadZone;
      const maxEffective = maxDistance - deadZone;
      const clampedDist = Math.min(effectiveDistance, maxEffective);
      const normalizedDist = clampedDist / maxEffective;

      // Calculate direction
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Apply acceleration curve based on user preference
      const curvedMagnitude = applyAccelerationCurve(normalizedDist, settings.joystickCurve);

      // Check if joystick is pushed to edge (>90% of max distance) for sprint
      const atEdge = normalizedDist > 0.9;

      return {
        x: dirX * curvedMagnitude,
        y: dirY * curvedMagnitude,
        atEdge,
      };
    },
    [maxDistance, settings.movementDeadZone, settings.joystickCurve]
  );

  // Send input updates
  useEffect(() => {
    const movement = getJoystickOutput(moveStick);

    // Apply look smoothing if enabled with velocity-based scaling
    let finalLook = lookDelta;
    if (settings.smoothLook && (lookDelta.x !== 0 || lookDelta.y !== 0)) {
      const smoothResult = lookSmootherRef.current.smooth(lookDelta.x, lookDelta.y, {
        velocityScaling: settings.velocityAimScaling,
        deadZone: settings.lookDeadZone,
      });
      finalLook = { x: smoothResult.x, y: smoothResult.y };
    } else if (settings.lookDeadZone > 0) {
      // Apply dead zone even without smoothing
      const magnitude = Math.sqrt(lookDelta.x ** 2 + lookDelta.y ** 2);
      if (magnitude < settings.lookDeadZone) {
        finalLook = { x: 0, y: 0 };
      }
    }

    // Apply sensitivity and inverted Y
    const scaledLook = {
      x: finalLook.x * settings.lookSensitivity,
      y: finalLook.y * settings.lookSensitivity * (settings.invertedY ? -1 : 1),
    };

    // Sprint if button pressed OR joystick pushed to edge
    const shouldSprint = isSprinting || movement.atEdge;

    onInput({
      movement: { x: movement.x, y: -movement.y }, // Invert Y for forward
      look: scaledLook,
      isFiring,
      isSprinting: shouldSprint,
      isJumping,
      isCrouching,
      weaponSlot: weaponSwitchRequest,
      isReloading,
      isInteracting,
      aimAssist: settings.aimAssist,
      aimAssistStrength: settings.aimAssistStrength,
      isMelee,
      isGrenade,
      isAimingGrenade,
      isSliding,
    });

    // Reset look delta after sending
    if (lookDelta.x !== 0 || lookDelta.y !== 0) {
      setLookDelta({ x: 0, y: 0 });
    }
    // Clear one-shot actions
    if (weaponSwitchRequest !== undefined) {
      setWeaponSwitchRequest(undefined);
    }
    if (isReloading) {
      setIsReloading(false);
    }
    if (isInteracting) {
      setIsInteracting(false);
    }
    if (isMelee) {
      setIsMelee(false);
    }
    if (isGrenade) {
      setIsGrenade(false);
    }
    if (isSliding) {
      setIsSliding(false);
    }
  }, [
    moveStick,
    lookDelta,
    isFiring,
    isSprinting,
    isJumping,
    isCrouching,
    weaponSwitchRequest,
    isReloading,
    isInteracting,
    isMelee,
    isGrenade,
    isAimingGrenade,
    isSliding,
    getJoystickOutput,
    onInput,
    settings.lookSensitivity,
    settings.invertedY,
    settings.smoothLook,
    settings.velocityAimScaling,
    settings.lookDeadZone,
    settings.aimAssist,
    settings.aimAssistStrength,
  ]);

  // Movement joystick handlers
  const handleMoveStart = useCallback(
    (e: React.PointerEvent) => {
      if (moveStick.pointerId !== null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Trigger haptic on touch
      triggerHaptic('buttonPress', settings.hapticFeedback, settings.hapticIntensity);

      setMoveStick({
        active: true,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        pointerId: e.pointerId,
      });
    },
    [moveStick.pointerId, settings.hapticFeedback, settings.hapticIntensity]
  );

  const handleMoveMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== moveStick.pointerId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setMoveStick((prev) => ({
        ...prev,
        currentX: e.clientX - rect.left - rect.width / 2,
        currentY: e.clientY - rect.top - rect.height / 2,
      }));
    },
    [moveStick.pointerId]
  );

  const handleMoveEnd = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== moveStick.pointerId) return;
      setMoveStick({
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        pointerId: null,
      });
    },
    [moveStick.pointerId]
  );

  // Screen touch for looking
  const handleScreenTouchStart = useCallback(
    (e: React.PointerEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Exclude left 30% (joystick area with padding)
      if (x < rect.width * 0.3) return;
      // Exclude right 25% (buttons)
      if (x > rect.width * 0.75) return;
      // Exclude bottom 35% (action buttons area)
      if (y > rect.height * 0.65) return;

      if (lookTouch.pointerId !== null) return;

      // Check for gestures (double-tap sprint)
      if (settings.doubleTapSprint) {
        const gesture = gestureDetectorRef.current.onTouchStart(e.clientX, e.clientY);
        if (gesture.doubleTapDetected) {
          setIsSprinting(true);
          triggerHaptic('sprint', settings.hapticFeedback, settings.hapticIntensity);
          // Auto-disable sprint after 3 seconds if not held
          setTimeout(() => setIsSprinting(false), 3000);
          return;
        }
      }

      setLookTouch({
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
        pointerId: e.pointerId,
      });
    },
    [lookTouch.pointerId, settings.doubleTapSprint, settings.hapticFeedback]
  );

  const handleScreenTouchMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== lookTouch.pointerId || !lookTouch.active) return;

      // Base sensitivity
      const baseSensitivity = 0.003;
      const dx = (e.clientX - lookTouch.lastX) * baseSensitivity;
      const dy = (e.clientY - lookTouch.lastY) * baseSensitivity;

      setLookDelta((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLookTouch((prev) => ({
        ...prev,
        lastX: e.clientX,
        lastY: e.clientY,
      }));
    },
    [lookTouch]
  );

  const handleScreenTouchEnd = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== lookTouch.pointerId) return;

      // Check for swipe gesture (weapon switch)
      if (settings.swipeWeaponSwitch) {
        const gesture = gestureDetectorRef.current.onTouchEnd(e.clientX, e.clientY);
        if (gesture.swipeDirection === 'left') {
          const newWeapon = (activeWeapon + 1) % 3;
          setActiveWeapon(newWeapon);
          setWeaponSwitchRequest(newWeapon);
          triggerHaptic('weaponSwitch', settings.hapticFeedback, settings.hapticIntensity);
        } else if (gesture.swipeDirection === 'right') {
          const newWeapon = (activeWeapon + 2) % 3;
          setActiveWeapon(newWeapon);
          setWeaponSwitchRequest(newWeapon);
          triggerHaptic('weaponSwitch', settings.hapticFeedback, settings.hapticIntensity);
        }
      }

      setLookTouch({
        active: false,
        lastX: 0,
        lastY: 0,
        pointerId: null,
      });
      lookSmootherRef.current.reset();
    },
    [lookTouch.pointerId, settings.swipeWeaponSwitch, settings.hapticFeedback, activeWeapon]
  );

  // Calculate thumb position
  const getThumbStyle = (stick: JoystickState) => {
    if (!stick.active) return { transform: 'translate(-50%, -50%)' };

    const dx = stick.currentX - stick.startX;
    const dy = stick.currentY - stick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let thumbX = dx;
    let thumbY = dy;

    if (distance > maxDistance) {
      thumbX = (dx / distance) * maxDistance;
      thumbY = (dy / distance) * maxDistance;
    }

    return {
      transform: `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`,
    };
  };

  // Fire button handlers with haptic
  const handleFireStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      setIsFiring(true);
      triggerHaptic('fire', settings.hapticFeedback, settings.hapticIntensity);
    },
    [settings.hapticFeedback, settings.hapticIntensity]
  );

  const handleFireEnd = useCallback(() => {
    setIsFiring(false);
  }, []);

  // Reload button handler
  const handleReload = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      setIsReloading(true);
      triggerHaptic('reload', settings.hapticFeedback, settings.hapticIntensity);
    },
    [settings.hapticFeedback, settings.hapticIntensity]
  );

  // Interaction button handler
  const handleInteract = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      setIsInteracting(true);
      triggerHaptic('interact', settings.hapticFeedback, settings.hapticIntensity);
    },
    [settings.hapticFeedback, settings.hapticIntensity]
  );

  // Melee button handler with cooldown
  const handleMelee = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const now = performance.now();
      if (now - lastMeleeTimeRef.current < meleeCooldownDuration) {
        return; // Still on cooldown
      }
      lastMeleeTimeRef.current = now;
      setIsMelee(true);
      setMeleeCooldown(100);
      triggerHaptic('fire', settings.hapticFeedback, settings.hapticIntensity);

      // Animate cooldown
      const startTime = now;
      const animateCooldown = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(100, (elapsed / meleeCooldownDuration) * 100);
        setMeleeCooldown(progress);
        if (progress < 100) {
          requestAnimationFrame(animateCooldown);
        }
      };
      requestAnimationFrame(animateCooldown);
    },
    [settings.hapticFeedback, settings.hapticIntensity]
  );

  // Grenade button handlers - tap to throw, long press to aim
  const handleGrenadeStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (grenadeCount <= 0) {
        triggerHaptic('emptyClip', settings.hapticFeedback, settings.hapticIntensity);
        return;
      }
      grenadeAimStartTime.current = performance.now();
      // Start timer for aim mode activation (300ms hold)
      grenadeTimerRef.current = window.setTimeout(() => {
        setIsAimingGrenade(true);
        triggerHaptic('buttonPress', settings.hapticFeedback, settings.hapticIntensity);
      }, 300);
    },
    [settings.hapticFeedback, settings.hapticIntensity, grenadeCount]
  );

  const handleGrenadeEnd = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      // Clear aim timer if still pending
      if (grenadeTimerRef.current) {
        clearTimeout(grenadeTimerRef.current);
        grenadeTimerRef.current = null;
      }

      const holdDuration = performance.now() - grenadeAimStartTime.current;

      if (isAimingGrenade) {
        // Release after aiming - throw grenade with arc
        setIsAimingGrenade(false);
        setIsGrenade(true);
        setGrenadeCount((prev) => Math.max(0, prev - 1));
        triggerHaptic('fire', settings.hapticFeedback, settings.hapticIntensity);
      } else if (holdDuration < 300 && grenadeCount > 0) {
        // Quick tap - throw immediately
        setIsGrenade(true);
        setGrenadeCount((prev) => Math.max(0, prev - 1));
        triggerHaptic('fire', settings.hapticFeedback, settings.hapticIntensity);
      }
    },
    [settings.hapticFeedback, settings.hapticIntensity, isAimingGrenade, grenadeCount]
  );

  // Crouch button with double-tap slide detection
  // Enhanced for mobile: faster double-tap detection, instant slide initiation
  const handleCrouchStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const now = performance.now();
      const timeSinceLast = now - lastCrouchTapRef.current;

      // Check for double-tap to trigger slide (instant initiation on second tap)
      if (timeSinceLast < doubleTapThreshold && timeSinceLast > 50) {
        // Double-tap detected - instant slide
        setIsSliding(true);
        setIsCrouching(false); // Clear crouch since we're sliding

        // Set visual slide state with auto-clear (slide lasts ~0.8s)
        setIsSlideActive(true);
        if (slideVisualTimerRef.current) {
          clearTimeout(slideVisualTimerRef.current);
        }
        slideVisualTimerRef.current = window.setTimeout(() => {
          setIsSlideActive(false);
        }, 800); // Match slide duration

        // Strong haptic feedback for slide
        triggerHaptic('sprint', settings.hapticFeedback, settings.hapticIntensity);
      } else {
        // Single tap - crouch with immediate visual feedback
        setIsCrouching(true);
        // Light haptic feedback for crouch
        triggerHaptic('buttonPress', settings.hapticFeedback, settings.hapticIntensity);
      }
      lastCrouchTapRef.current = now;
    },
    [settings.hapticFeedback, settings.hapticIntensity]
  );

  const handleCrouchEnd = useCallback(() => {
    setIsCrouching(false);
    // Haptic feedback on stand
    triggerHaptic('buttonRelease', settings.hapticFeedback, settings.hapticIntensity);
  }, [settings.hapticFeedback, settings.hapticIntensity]);

  // Pause button handler
  const handlePause = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      triggerHaptic('buttonPress', settings.hapticFeedback, settings.hapticIntensity);
      onPause?.();
    },
    [settings.hapticFeedback, settings.hapticIntensity, onPause]
  );

  // Dynamic action button handlers
  const handleDynamicActionStart = useCallback(
    (e: React.PointerEvent, action: DynamicAction) => {
      e.stopPropagation();
      setActiveDynamicButtons((prev) => new Set(prev).add(action));
      triggerHaptic('buttonPress', settings.hapticFeedback, settings.hapticIntensity);
      onDynamicAction?.(action);
    },
    [settings.hapticFeedback, settings.hapticIntensity, onDynamicAction]
  );

  const handleDynamicActionEnd = useCallback((action: DynamicAction) => {
    setActiveDynamicButtons((prev) => {
      const next = new Set(prev);
      next.delete(action);
      return next;
    });
  }, []);

  // Settings handlers
  const handleSettingChange = useCallback(
    <K extends keyof TouchControlSettings>(key: K, value: TouchControlSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveTouchSettings(next);
        return next;
      });
    },
    []
  );

  const toggleSettings = useCallback(() => {
    const newState = !isSettingsOpen;
    setIsSettingsOpen(newState);
    onSettingsToggle?.(newState);
  }, [isSettingsOpen, onSettingsToggle]);

  // Calculate control positions with custom offsets
  const joystickStyle = useMemo(() => {
    const baseLeft = 20 + settings.joystickPositionX;
    const baseBottom = 100 + settings.joystickPositionY;
    return {
      left: `max(${baseLeft}px, calc(env(safe-area-inset-left, 20px) + ${settings.joystickPositionX}px))`,
      bottom: `max(${baseBottom}px, calc(env(safe-area-inset-bottom, 30px) + 70px + ${settings.joystickPositionY}px))`,
      width: `${controlSizes.joystickSize}px`,
      height: `${controlSizes.joystickSize}px`,
      opacity: settings.controlOpacity,
    };
  }, [
    settings.joystickPositionX,
    settings.joystickPositionY,
    settings.controlOpacity,
    controlSizes.joystickSize,
  ]);

  const buttonsStyle = useMemo(() => {
    const baseRight = 20 + settings.buttonPositionX;
    const baseBottom = 100 + settings.buttonPositionY;
    return {
      right: `max(${baseRight}px, calc(env(safe-area-inset-right, 20px) + ${settings.buttonPositionX}px))`,
      bottom: `max(${baseBottom}px, calc(env(safe-area-inset-bottom, 30px) + 70px + ${settings.buttonPositionY}px))`,
      opacity: settings.controlOpacity,
    };
  }, [settings.buttonPositionX, settings.buttonPositionY, settings.controlOpacity]);

  // Touch area style (larger than visual for easier touch)
  const touchAreaStyle = useMemo(
    () => ({
      padding: `${controlSizes.touchAreaPadding}px`,
      margin: `-${controlSizes.touchAreaPadding}px`,
    }),
    [controlSizes.touchAreaPadding]
  );

  return (
    <div
      className={styles.touchControls}
      onPointerDown={handleScreenTouchStart}
      onPointerMove={handleScreenTouchMove}
      onPointerUp={handleScreenTouchEnd}
      onPointerCancel={handleScreenTouchEnd}
    >
      {/* Look area indicator */}
      <div className={`${styles.lookArea} ${lookTouch.active ? styles.lookAreaActive : ''}`}>
        <span className={styles.lookAreaLabel}>DRAG TO LOOK</span>
      </div>

      {/* Left Joystick - Movement */}
      <div
        className={styles.joystickContainer}
        style={joystickStyle}
        onPointerDown={handleMoveStart}
        onPointerMove={handleMoveMove}
        onPointerUp={handleMoveEnd}
        onPointerCancel={handleMoveEnd}
        role="slider"
        aria-label="Movement joystick"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={0}
        tabIndex={0}
      >
        {/* Extended touch area */}
        <div className={styles.joystickTouchArea} style={touchAreaStyle} aria-hidden="true" />
        <div className={styles.joystickBase} aria-hidden="true">
          {/* Direction indicators */}
          <div className={styles.joystickIndicators}>
            <div className={`${styles.indicator} ${styles.indicatorUp}`} />
            <div className={`${styles.indicator} ${styles.indicatorDown}`} />
            <div className={`${styles.indicator} ${styles.indicatorLeft}`} />
            <div className={`${styles.indicator} ${styles.indicatorRight}`} />
          </div>
          <div
            className={`${styles.joystickThumb} ${moveStick.active ? styles.active : ''}`}
            style={getThumbStyle(moveStick)}
          />
        </div>
        <span className={styles.joystickLabel}>MOVE</span>
      </div>

      {/* Right Side Action Buttons */}
      <div className={styles.actionButtonColumn} style={buttonsStyle} role="group" aria-label="Action buttons">
        {/* Fire Button - Large, prominent */}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.fireButton} ${isFiring ? styles.active : ''}`}
          style={{
            width: `${controlSizes.fireButtonSize}px`,
            height: `${controlSizes.fireButtonSize}px`,
          }}
          onPointerDown={handleFireStart}
          onPointerUp={handleFireEnd}
          onPointerCancel={handleFireEnd}
          onPointerLeave={handleFireEnd}
          aria-label="Fire weapon"
          aria-pressed={isFiring}
        >
          <span className={styles.buttonIcon} aria-hidden="true">+</span>
          <span className={styles.buttonLabel} aria-hidden="true">FIRE</span>
        </button>

        {/* Reload Button with progress indicator */}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.reloadButton} ${reloadProgress !== undefined ? styles.reloading : ''}`}
          style={{
            width: `${controlSizes.smallButtonSize}px`,
            height: `${controlSizes.smallButtonSize}px`,
          }}
          onPointerDown={handleReload}
          aria-label={reloadProgress !== undefined ? `Reloading: ${Math.round(reloadProgress * 100)}%` : 'Reload weapon'}
        >
          {reloadProgress !== undefined && (
            <div
              className={styles.reloadProgress}
              style={{ '--progress': `${reloadProgress * 100}%` } as React.CSSProperties}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(reloadProgress * 100)}
            />
          )}
          <span className={styles.buttonLabel} aria-hidden="true">R</span>
        </button>

        {/* Secondary buttons row */}
        <div className={styles.secondaryButtonRow} role="group" aria-label="Movement actions">
          {/* Jump Button */}
          <button
            type="button"
            className={`${styles.actionButton} ${styles.smallButton} ${isJumping ? styles.active : ''}`}
            style={{
              width: `${controlSizes.smallButtonSize}px`,
              height: `${controlSizes.smallButtonSize}px`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsJumping(true);
              triggerHaptic('buttonPress', settings.hapticFeedback, settings.hapticIntensity);
            }}
            onPointerUp={() => setIsJumping(false)}
            onPointerCancel={() => setIsJumping(false)}
            onPointerLeave={() => setIsJumping(false)}
            aria-label="Jump"
            aria-pressed={isJumping}
          >
            <span className={styles.buttonIcon} aria-hidden="true">^</span>
            <span className={styles.buttonLabel} aria-hidden="true">JUMP</span>
          </button>

          {/* Crouch Button - Double tap for slide */}
          <button
            type="button"
            className={`${styles.actionButton} ${styles.smallButton} ${isCrouching ? styles.active : ''} ${isSlideActive ? styles.sliding : ''}`}
            style={{
              width: `${controlSizes.smallButtonSize}px`,
              height: `${controlSizes.smallButtonSize}px`,
            }}
            onPointerDown={handleCrouchStart}
            onPointerUp={handleCrouchEnd}
            onPointerCancel={handleCrouchEnd}
            onPointerLeave={handleCrouchEnd}
            aria-label="Crouch (double-tap to slide)"
            aria-pressed={isCrouching || isSlideActive}
          >
            <span className={styles.buttonIcon} aria-hidden="true">{isSlideActive ? '_' : 'v'}</span>
            <span className={styles.buttonLabel} aria-hidden="true">{isSlideActive ? 'SLIDE' : 'DUCK'}</span>
          </button>
        </div>

        {/* Sprint Button */}
        <button
          type="button"
          className={`${styles.actionButton} ${styles.sprintButton} ${isSprinting ? styles.active : ''}`}
          style={{
            width: `${controlSizes.sprintButtonSize}px`,
            height: `${controlSizes.sprintButtonSize}px`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setIsSprinting(true);
            triggerHaptic('sprint', settings.hapticFeedback, settings.hapticIntensity);
          }}
          onPointerUp={() => setIsSprinting(false)}
          onPointerCancel={() => setIsSprinting(false)}
          onPointerLeave={() => setIsSprinting(false)}
          aria-label="Sprint"
          aria-pressed={isSprinting}
        >
          <span className={styles.buttonIcon} aria-hidden="true">&gt;&gt;</span>
          <span className={styles.buttonLabel} aria-hidden="true">RUN</span>
        </button>

        {/* Combat buttons row - Melee and Grenade */}
        <div className={styles.secondaryButtonRow} role="group" aria-label="Combat actions">
          {/* Melee Button with cooldown indicator */}
          <button
            type="button"
            className={`${styles.actionButton} ${styles.meleeButton} ${meleeCooldown < 100 && meleeCooldown > 0 ? styles.onCooldown : ''}`}
            style={{
              width: `${controlSizes.smallButtonSize}px`,
              height: `${controlSizes.smallButtonSize}px`,
            }}
            onPointerDown={handleMelee}
            aria-label={meleeCooldown < 100 ? `Melee (cooldown: ${Math.round(100 - meleeCooldown)}%)` : 'Melee attack'}
            disabled={meleeCooldown < 100 && meleeCooldown > 0}
          >
            {meleeCooldown > 0 && meleeCooldown < 100 && (
              <div
                className={styles.cooldownProgress}
                style={{ '--progress': `${meleeCooldown}%` } as React.CSSProperties}
                aria-hidden="true"
              />
            )}
            <span className={styles.buttonIcon} aria-hidden="true">M</span>
            <span className={styles.buttonLabel} aria-hidden="true">MELEE</span>
          </button>

          {/* Grenade Button with count - Long press to aim */}
          <button
            type="button"
            className={`${styles.actionButton} ${styles.grenadeButton} ${isAimingGrenade ? styles.aiming : ''} ${grenadeCount <= 0 ? styles.empty : ''}`}
            style={{
              width: `${controlSizes.smallButtonSize}px`,
              height: `${controlSizes.smallButtonSize}px`,
            }}
            onPointerDown={handleGrenadeStart}
            onPointerUp={handleGrenadeEnd}
            onPointerCancel={handleGrenadeEnd}
            onPointerLeave={handleGrenadeEnd}
            aria-label={`Throw grenade (${grenadeCount} remaining). Hold to aim.`}
          >
            <span className={styles.buttonIcon} aria-hidden="true">G</span>
            <span className={styles.buttonLabel} aria-hidden="true">{grenadeCount}</span>
            {isAimingGrenade && (
              <div className={styles.aimIndicator} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Context-sensitive Interaction Button */}
        {interactionAvailable && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.interactButton}`}
            style={{
              width: `${controlSizes.smallButtonSize + 10}px`,
              height: `${controlSizes.smallButtonSize + 10}px`,
            }}
            onPointerDown={handleInteract}
            aria-label={`Interact: ${interactionLabel}`}
          >
            <span className={styles.buttonIcon} aria-hidden="true">E</span>
            <span className={styles.buttonLabel} aria-hidden="true">{interactionLabel}</span>
          </button>
        )}

        {/* Dynamic Action Buttons - Grouped by Category */}
        {activeDynamicActions.length > 0 && (
          <div className={styles.dynamicActionsContainer} role="group" aria-label="Dynamic actions">
            {/* Vehicle Controls Group */}
            {groupedDynamicActions.has('vehicle') && (
              <div className={styles.dynamicActionGroup} role="group" aria-label="Vehicle controls">
                <span className={styles.dynamicGroupLabel}>VEHICLE</span>
                <div className={styles.dynamicActionRow}>
                  {groupedDynamicActions.get('vehicle')!.map((action) => {
                    const config = DYNAMIC_ACTION_CONFIG[action];
                    const isActive = activeDynamicButtons.has(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        className={`${styles.actionButton} ${styles.dynamicActionButton} ${isActive ? styles.active : ''}`}
                        style={{
                          width: `${controlSizes.smallButtonSize}px`,
                          height: `${controlSizes.smallButtonSize}px`,
                          background: config.color,
                          borderColor: config.borderColor,
                        }}
                        onPointerDown={(e) => handleDynamicActionStart(e, action)}
                        onPointerUp={() => handleDynamicActionEnd(action)}
                        onPointerCancel={() => handleDynamicActionEnd(action)}
                        onPointerLeave={() => handleDynamicActionEnd(action)}
                        aria-label={DYNAMIC_ACTION_LABELS[action]}
                        aria-pressed={isActive}
                      >
                        <span className={styles.buttonIcon} aria-hidden="true">{config.icon}</span>
                        <span className={styles.buttonLabel} aria-hidden="true">{config.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Squad Commands Group */}
            {groupedDynamicActions.has('squad') && (
              <div className={styles.dynamicActionGroup} role="group" aria-label="Squad commands">
                <span className={styles.dynamicGroupLabel}>SQUAD</span>
                <div className={styles.dynamicActionRow}>
                  {groupedDynamicActions.get('squad')!.map((action) => {
                    const config = DYNAMIC_ACTION_CONFIG[action];
                    const isActive = activeDynamicButtons.has(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        className={`${styles.actionButton} ${styles.dynamicActionButton} ${isActive ? styles.active : ''}`}
                        style={{
                          width: `${controlSizes.smallButtonSize}px`,
                          height: `${controlSizes.smallButtonSize}px`,
                          background: config.color,
                          borderColor: config.borderColor,
                        }}
                        onPointerDown={(e) => handleDynamicActionStart(e, action)}
                        onPointerUp={() => handleDynamicActionEnd(action)}
                        onPointerCancel={() => handleDynamicActionEnd(action)}
                        onPointerLeave={() => handleDynamicActionEnd(action)}
                        aria-label={DYNAMIC_ACTION_LABELS[action]}
                        aria-pressed={isActive}
                      >
                        <span className={styles.buttonIcon} aria-hidden="true">{config.icon}</span>
                        <span className={styles.buttonLabel} aria-hidden="true">{config.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ability Controls Group */}
            {groupedDynamicActions.has('ability') && (
              <div className={styles.dynamicActionGroup} role="group" aria-label="Abilities">
                <span className={styles.dynamicGroupLabel}>ABILITY</span>
                <div className={styles.dynamicActionRow}>
                  {groupedDynamicActions.get('ability')!.map((action) => {
                    const config = DYNAMIC_ACTION_CONFIG[action];
                    const isActive = activeDynamicButtons.has(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        className={`${styles.actionButton} ${styles.dynamicActionButton} ${isActive ? styles.active : ''}`}
                        style={{
                          width: `${controlSizes.smallButtonSize}px`,
                          height: `${controlSizes.smallButtonSize}px`,
                          background: config.color,
                          borderColor: config.borderColor,
                        }}
                        onPointerDown={(e) => handleDynamicActionStart(e, action)}
                        onPointerUp={() => handleDynamicActionEnd(action)}
                        onPointerCancel={() => handleDynamicActionEnd(action)}
                        onPointerLeave={() => handleDynamicActionEnd(action)}
                        aria-label={DYNAMIC_ACTION_LABELS[action]}
                        aria-pressed={isActive}
                      >
                        <span className={styles.buttonIcon} aria-hidden="true">{config.icon}</span>
                        <span className={styles.buttonLabel} aria-hidden="true">{config.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Weapon Controls Group */}
            {groupedDynamicActions.has('weapon') && (
              <div className={styles.dynamicActionGroup} role="group" aria-label="Weapon controls">
                <span className={styles.dynamicGroupLabel}>WEAPON</span>
                <div className={styles.dynamicActionRow}>
                  {groupedDynamicActions.get('weapon')!.map((action) => {
                    const config = DYNAMIC_ACTION_CONFIG[action];
                    const isActive = activeDynamicButtons.has(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        className={`${styles.actionButton} ${styles.dynamicActionButton} ${isActive ? styles.active : ''}`}
                        style={{
                          width: `${controlSizes.smallButtonSize}px`,
                          height: `${controlSizes.smallButtonSize}px`,
                          background: config.color,
                          borderColor: config.borderColor,
                        }}
                        onPointerDown={(e) => handleDynamicActionStart(e, action)}
                        onPointerUp={() => handleDynamicActionEnd(action)}
                        onPointerCancel={() => handleDynamicActionEnd(action)}
                        onPointerLeave={() => handleDynamicActionEnd(action)}
                        aria-label={DYNAMIC_ACTION_LABELS[action]}
                        aria-pressed={isActive}
                      >
                        <span className={styles.buttonIcon} aria-hidden="true">{config.icon}</span>
                        <span className={styles.buttonLabel} aria-hidden="true">{config.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Movement Abilities Group */}
            {groupedDynamicActions.has('movement') && (
              <div className={styles.dynamicActionGroup} role="group" aria-label="Movement abilities">
                <span className={styles.dynamicGroupLabel}>MOVE</span>
                <div className={styles.dynamicActionRow}>
                  {groupedDynamicActions.get('movement')!.map((action) => {
                    const config = DYNAMIC_ACTION_CONFIG[action];
                    const isActive = activeDynamicButtons.has(action);
                    return (
                      <button
                        key={action}
                        type="button"
                        className={`${styles.actionButton} ${styles.dynamicActionButton} ${isActive ? styles.active : ''}`}
                        style={{
                          width: `${controlSizes.smallButtonSize}px`,
                          height: `${controlSizes.smallButtonSize}px`,
                          background: config.color,
                          borderColor: config.borderColor,
                        }}
                        onPointerDown={(e) => handleDynamicActionStart(e, action)}
                        onPointerUp={() => handleDynamicActionEnd(action)}
                        onPointerCancel={() => handleDynamicActionEnd(action)}
                        onPointerLeave={() => handleDynamicActionEnd(action)}
                        aria-label={DYNAMIC_ACTION_LABELS[action]}
                        aria-pressed={isActive}
                      >
                        <span className={styles.buttonIcon} aria-hidden="true">{config.icon}</span>
                        <span className={styles.buttonLabel} aria-hidden="true">{config.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Weapon Rack */}
      <div className={styles.weaponRack} role="radiogroup" aria-label="Weapon selection">
        {[
          { slot: 0, icon: '1', name: 'RIFLE' },
          { slot: 1, icon: '2', name: 'PISTOL' },
          { slot: 2, icon: '3', name: 'NADE' },
        ].map((weapon) => (
          <button
            key={weapon.slot}
            type="button"
            role="radio"
            aria-checked={activeWeapon === weapon.slot}
            aria-label={`Select ${weapon.name}`}
            className={`${styles.weaponSlot} ${activeWeapon === weapon.slot ? styles.weaponActive : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (activeWeapon !== weapon.slot) {
                setActiveWeapon(weapon.slot);
                setWeaponSwitchRequest(weapon.slot);
                triggerHaptic('weaponSwitch', settings.hapticFeedback, settings.hapticIntensity);
              }
            }}
          >
            <span className={styles.weaponIcon} aria-hidden="true">{weapon.icon}</span>
            <span className={styles.weaponName} aria-hidden="true">{weapon.name}</span>
          </button>
        ))}
        <span className={styles.swipeHint} aria-hidden="true">SWIPE TO SWITCH</span>
      </div>

      {/* Top Right Buttons: Pause and Settings */}
      <div className={styles.topRightButtons}>
        {/* Pause Button */}
        {onPause && (
          <button
            type="button"
            className={styles.pauseButton}
            onPointerDown={handlePause}
            aria-label="Pause Game"
          >
            <span className={styles.pauseIcon}>II</span>
          </button>
        )}

        {/* Settings Toggle Button */}
        <button
          type="button"
          className={styles.settingsToggle}
          onPointerDown={(e) => {
            e.stopPropagation();
            toggleSettings();
          }}
          aria-label="Touch Control Settings"
        >
          <span className={styles.settingsIcon}>...</span>
        </button>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div
          className={styles.settingsPanel}
          onPointerDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="touch-settings-title"
        >
          <h3 id="touch-settings-title" className={styles.settingsTitle}>Touch Controls</h3>

          {/* Aiming Section */}
          <div className={styles.settingSection}>
            <span className={styles.settingSectionTitle}>AIMING</span>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Look Sensitivity: {settings.lookSensitivity.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={settings.lookSensitivity}
              onChange={(e) => handleSettingChange('lookSensitivity', parseFloat(e.target.value))}
              className={styles.settingSlider}
            />
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Aim Dead Zone: {(settings.lookDeadZone * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              value={settings.lookDeadZone}
              onChange={(e) => handleSettingChange('lookDeadZone', parseFloat(e.target.value))}
              className={styles.settingSlider}
            />
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingCheckbox}>
              <input
                type="checkbox"
                checked={settings.aimAssist}
                onChange={(e) => handleSettingChange('aimAssist', e.target.checked)}
              />
              Aim Assist
            </label>
          </div>

          {settings.aimAssist && (
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>
                Aim Assist Strength: {(settings.aimAssistStrength * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={settings.aimAssistStrength}
                onChange={(e) =>
                  handleSettingChange('aimAssistStrength', parseFloat(e.target.value))
                }
                className={styles.settingSlider}
              />
            </div>
          )}

          <div className={styles.settingGroup}>
            <label className={styles.settingCheckbox}>
              <input
                type="checkbox"
                checked={settings.smoothLook}
                onChange={(e) => handleSettingChange('smoothLook', e.target.checked)}
              />
              Smooth Look
            </label>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingCheckbox}>
              <input
                type="checkbox"
                checked={settings.velocityAimScaling}
                onChange={(e) => handleSettingChange('velocityAimScaling', e.target.checked)}
              />
              Velocity Aim Scaling
            </label>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingCheckbox}>
              <input
                type="checkbox"
                checked={settings.invertedY}
                onChange={(e) => handleSettingChange('invertedY', e.target.checked)}
              />
              Invert Y-Axis
            </label>
          </div>

          {/* Movement Section */}
          <div className={styles.settingSection}>
            <span className={styles.settingSectionTitle}>MOVEMENT</span>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Movement Dead Zone: {(settings.movementDeadZone * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.02"
              value={settings.movementDeadZone}
              onChange={(e) => handleSettingChange('movementDeadZone', parseFloat(e.target.value))}
              className={styles.settingSlider}
            />
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Joystick Response</label>
            <select
              value={settings.joystickCurve}
              onChange={(e) =>
                handleSettingChange(
                  'joystickCurve',
                  e.target.value as 'linear' | 'exponential' | 'aggressive'
                )
              }
              className={styles.settingSelect}
            >
              <option value="linear">Linear (Raw)</option>
              <option value="exponential">Exponential (Default)</option>
              <option value="aggressive">Aggressive (Precision)</option>
            </select>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingCheckbox}>
              <input
                type="checkbox"
                checked={settings.doubleTapSprint}
                onChange={(e) => handleSettingChange('doubleTapSprint', e.target.checked)}
              />
              Double-Tap Sprint
            </label>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingCheckbox}>
              <input
                type="checkbox"
                checked={settings.swipeWeaponSwitch}
                onChange={(e) => handleSettingChange('swipeWeaponSwitch', e.target.checked)}
              />
              Swipe Weapon Switch
            </label>
          </div>

          {/* Appearance Section */}
          <div className={styles.settingSection}>
            <span className={styles.settingSectionTitle}>APPEARANCE</span>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Control Size: {(settings.controlSizeMultiplier * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              value={settings.controlSizeMultiplier}
              onChange={(e) =>
                handleSettingChange('controlSizeMultiplier', parseFloat(e.target.value))
              }
              className={styles.settingSlider}
            />
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Opacity: {(settings.controlOpacity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={settings.controlOpacity}
              onChange={(e) => handleSettingChange('controlOpacity', parseFloat(e.target.value))}
              className={styles.settingSlider}
            />
          </div>

          {/* Feedback Section */}
          <div className={styles.settingSection}>
            <span className={styles.settingSectionTitle}>FEEDBACK</span>
          </div>

          <div className={styles.settingGroup}>
            <label className={styles.settingCheckbox}>
              <input
                type="checkbox"
                checked={settings.hapticFeedback}
                onChange={(e) => handleSettingChange('hapticFeedback', e.target.checked)}
              />
              Haptic Feedback
            </label>
          </div>

          {settings.hapticFeedback && (
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>
                Haptic Intensity: {(settings.hapticIntensity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.hapticIntensity}
                onChange={(e) => handleSettingChange('hapticIntensity', parseFloat(e.target.value))}
                className={styles.settingSlider}
              />
            </div>
          )}

          <button
            type="button"
            className={styles.settingsClose}
            onPointerDown={(e) => {
              e.stopPropagation();
              toggleSettings();
            }}
          >
            CLOSE
          </button>
        </div>
      )}
    </div>
  );
}
