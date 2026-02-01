/**
 * InputManager - Unified input handling with keybinding support
 *
 * This module provides a central input management system that:
 * - Reads from KeybindingsContext for keyboard/mouse bindings
 * - Polls connected gamepads and maps buttons to actions
 * - Combines keyboard/mouse/gamepad/touch into unified InputState
 * - Exposes isActionPressed(action) for action-based input queries
 *
 * The goal is that when a user rebinds 'fire' from Mouse0 to KeyF,
 * the game responds to KeyF instead.
 */

import { getLogger } from '../core/Logger';
import type {
  BindableAction,
  DynamicAction,
  DynamicBindings,
  GamepadBindings,
  GamepadButton,
  Keybindings,
  KeybindingValue,
} from '../stores/useKeybindingsStore';
import {
  GAMEPAD_BUTTON_INDEX,
  getDynamicBindings as getDynamicBindingsFromStore,
  getGamepadBindings as getGamepadBindingsFromStore,
  getKeybindings as getKeybindingsFromStore,
  getKeysForAction,
  subscribeToKeybindings,
} from '../stores/useKeybindingsStore';

const log = getLogger('InputManager');

// Gamepad analog stick deadzone
const STICK_DEADZONE = 0.15;

// Trigger threshold for considering a trigger "pressed"
const TRIGGER_THRESHOLD = 0.5;

/**
 * Analog input state for movement and camera
 */
export interface AnalogState {
  /** Left stick X (-1 to 1, negative = left) */
  moveX: number;
  /** Left stick Y (-1 to 1, negative = forward) */
  moveY: number;
  /** Right stick X (-1 to 1, negative = look left) */
  lookX: number;
  /** Right stick Y (-1 to 1, negative = look up) */
  lookY: number;
  /** Left trigger (0 to 1) */
  leftTrigger: number;
  /** Right trigger (0 to 1) */
  rightTrigger: number;
}

/**
 * Touch input state from virtual controls
 */
export interface TouchInputState {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  isFiring: boolean;
  isSprinting: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
  isJetpacking?: boolean;
  isReloading?: boolean;
  isInteracting?: boolean;
  /** Melee attack triggered */
  isMelee?: boolean;
  /** Grenade throw triggered */
  isGrenade?: boolean;
  /** Grenade aiming mode (long press to aim arc) */
  isAimingGrenade?: boolean;
  /** Slide triggered (double-tap crouch or swipe down while moving) */
  isSliding?: boolean;
}

/**
 * Complete input state for a frame
 */
export interface InputState {
  /** Keyboard keys currently pressed (Set of key codes) */
  keysPressed: Set<string>;
  /** Mouse buttons currently pressed (Set of button indices) */
  mouseButtons: Set<number>;
  /** Gamepad button states (array of pressed states indexed by button) */
  gamepadButtons: boolean[];
  /** Analog input state (sticks and triggers) */
  analog: AnalogState;
  /** Touch input state (from virtual controls) */
  touch: TouchInputState | null;
  /** Whether a gamepad is connected */
  gamepadConnected: boolean;
  /** Name of connected gamepad (for display) */
  gamepadName: string | null;
}

/**
 * Union type for all action types
 */
export type AnyAction = BindableAction | DynamicAction;

/**
 * Input source detection for UI hints
 */
export type InputSource = 'keyboard' | 'mouse' | 'gamepad' | 'touch';

/**
 * InputManager - Singleton class for unified input handling
 *
 * Tracks all input sources and provides action-based queries that
 * respect user keybindings.
 */
export class InputManager {
  // Current input state
  private state: InputState;

  // Keybindings loaded from Zustand store
  private keybindings: Keybindings;
  private dynamicBindings: DynamicBindings;
  private gamepadBindings: GamepadBindings;

  // Event handlers (bound for cleanup)
  private keydownHandler: (e: KeyboardEvent) => void;
  private keyupHandler: (e: KeyboardEvent) => void;
  private mousedownHandler: (e: MouseEvent) => void;
  private mouseupHandler: (e: MouseEvent) => void;
  private gamepadConnectedHandler: (e: GamepadEvent) => void;
  private gamepadDisconnectedHandler: (e: GamepadEvent) => void;
  private blurHandler: () => void;

  // Track gamepad state
  private connectedGamepadIndex: number | null = null;

  // Track last input source for UI hints
  private lastInputSource: InputSource = 'keyboard';

  // Action just-pressed tracking (for edge detection)
  private actionsJustPressed: Set<AnyAction> = new Set();
  private actionsJustReleased: Set<AnyAction> = new Set();
  private previousActionStates: Map<AnyAction, boolean> = new Map();

  // Mouse movement accumulator (for look input)
  private mouseMovementX = 0;
  private mouseMovementY = 0;

  // Subscription cleanup for keybindings store
  private keybindingsUnsubscribe: (() => void) | null = null;

  constructor() {
    // Initialize state
    this.state = {
      keysPressed: new Set(),
      mouseButtons: new Set(),
      gamepadButtons: new Array(17).fill(false),
      analog: {
        moveX: 0,
        moveY: 0,
        lookX: 0,
        lookY: 0,
        leftTrigger: 0,
        rightTrigger: 0,
      },
      touch: null,
      gamepadConnected: false,
      gamepadName: null,
    };

    // Load keybindings from store
    this.keybindings = getKeybindingsFromStore();
    this.dynamicBindings = getDynamicBindingsFromStore();
    this.gamepadBindings = getGamepadBindingsFromStore();

    // Subscribe to keybinding changes
    this.keybindingsUnsubscribe = subscribeToKeybindings((keybindings) => {
      this.keybindings = keybindings;
      log.debug('Keybindings updated from store');
    });

    // Bind event handlers
    this.keydownHandler = this.handleKeyDown.bind(this);
    this.keyupHandler = this.handleKeyUp.bind(this);
    this.mousedownHandler = this.handleMouseDown.bind(this);
    this.mouseupHandler = this.handleMouseUp.bind(this);
    this.gamepadConnectedHandler = this.handleGamepadConnected.bind(this);
    this.gamepadDisconnectedHandler = this.handleGamepadDisconnected.bind(this);
    this.blurHandler = this.handleBlur.bind(this);

    // Attach listeners
    this.attach();

    // Check for already-connected gamepads
    this.checkExistingGamepads();

    log.info('InputManager initialized');
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Attach all event listeners
   */
  private attach(): void {
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
    window.addEventListener('mousedown', this.mousedownHandler);
    window.addEventListener('mouseup', this.mouseupHandler);
    window.addEventListener('gamepadconnected', this.gamepadConnectedHandler);
    window.addEventListener('gamepaddisconnected', this.gamepadDisconnectedHandler);
    window.addEventListener('blur', this.blurHandler);
  }

  /**
   * Detach all event listeners and clean up
   */
  dispose(): void {
    window.removeEventListener('keydown', this.keydownHandler);
    window.removeEventListener('keyup', this.keyupHandler);
    window.removeEventListener('mousedown', this.mousedownHandler);
    window.removeEventListener('mouseup', this.mouseupHandler);
    window.removeEventListener('gamepadconnected', this.gamepadConnectedHandler);
    window.removeEventListener('gamepaddisconnected', this.gamepadDisconnectedHandler);
    window.removeEventListener('blur', this.blurHandler);

    // Unsubscribe from keybindings store
    if (this.keybindingsUnsubscribe) {
      this.keybindingsUnsubscribe();
      this.keybindingsUnsubscribe = null;
    }

    this.state.keysPressed.clear();
    this.state.mouseButtons.clear();
    this.actionsJustPressed.clear();
    this.actionsJustReleased.clear();
    this.previousActionStates.clear();

    log.info('InputManager disposed');
  }

  // ============================================================================
  // KEYBINDING LOADING
  // ============================================================================

  /**
   * Refresh all keybindings from the store.
   * Note: With store subscription, this is mostly for manual refresh if needed.
   */
  refreshKeybindings(): void {
    this.keybindings = getKeybindingsFromStore();
    this.dynamicBindings = getDynamicBindingsFromStore();
    this.gamepadBindings = getGamepadBindingsFromStore();
    log.info('Keybindings refreshed from store');
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private handleKeyDown(e: KeyboardEvent): void {
    this.state.keysPressed.add(e.code);
    this.lastInputSource = 'keyboard';
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.state.keysPressed.delete(e.code);
  }

  private handleMouseDown(e: MouseEvent): void {
    this.state.mouseButtons.add(e.button);
    this.lastInputSource = 'mouse';
  }

  private handleMouseUp(e: MouseEvent): void {
    this.state.mouseButtons.delete(e.button);
  }

  private handleGamepadConnected(e: GamepadEvent): void {
    this.connectedGamepadIndex = e.gamepad.index;
    this.state.gamepadConnected = true;
    this.state.gamepadName = e.gamepad.id;
    this.lastButtonStates = new Array(e.gamepad.buttons.length).fill(false);
    log.info(`Gamepad connected: ${e.gamepad.id} (index ${e.gamepad.index})`);
  }

  private handleGamepadDisconnected(e: GamepadEvent): void {
    if (this.connectedGamepadIndex === e.gamepad.index) {
      this.connectedGamepadIndex = null;
      this.state.gamepadConnected = false;
      this.state.gamepadName = null;
      this.state.gamepadButtons.fill(false);
      this.state.analog = {
        moveX: 0,
        moveY: 0,
        lookX: 0,
        lookY: 0,
        leftTrigger: 0,
        rightTrigger: 0,
      };
      log.info(`Gamepad disconnected: ${e.gamepad.id}`);
    }
  }

  private handleBlur(): void {
    // Clear all pressed states when window loses focus
    this.state.keysPressed.clear();
    this.state.mouseButtons.clear();
  }

  private checkExistingGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad) {
        this.connectedGamepadIndex = gamepad.index;
        this.state.gamepadConnected = true;
        this.state.gamepadName = gamepad.id;
        this.lastButtonStates = new Array(gamepad.buttons.length).fill(false);
        log.info(`Found existing gamepad: ${gamepad.id}`);
        break;
      }
    }
  }

  // ============================================================================
  // UPDATE (call once per frame)
  // ============================================================================

  /**
   * Update input state. Call this once per frame before checking actions.
   * This polls gamepads and updates edge detection.
   */
  update(): void {
    // Poll gamepad
    this.pollGamepad();

    // Update edge detection for actions
    this.updateEdgeDetection();

    // Reset mouse movement accumulator (should be read and cleared each frame)
  }

  private pollGamepad(): void {
    if (this.connectedGamepadIndex === null) return;

    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[this.connectedGamepadIndex];

    if (!gamepad) {
      // Gamepad was disconnected without event
      this.connectedGamepadIndex = null;
      this.state.gamepadConnected = false;
      this.state.gamepadName = null;
      return;
    }

    // Update button states
    for (let i = 0; i < gamepad.buttons.length && i < 17; i++) {
      const button = gamepad.buttons[i];
      const isPressed = button.pressed || button.value > TRIGGER_THRESHOLD;
      this.state.gamepadButtons[i] = isPressed;
    }

    // Update analog sticks
    const axes = gamepad.axes;

    // Left stick (movement)
    const leftX = this.applyDeadzone(axes[0] ?? 0);
    const leftY = this.applyDeadzone(axes[1] ?? 0);

    // Right stick (look)
    const rightX = this.applyDeadzone(axes[2] ?? 0);
    const rightY = this.applyDeadzone(axes[3] ?? 0);

    // Triggers (some gamepads report as axes, some as buttons)
    let leftTrigger = 0;
    let rightTrigger = 0;

    // Check if triggers are axes (indices 4 and 5)
    if (axes.length > 5) {
      leftTrigger = (axes[4] + 1) / 2; // Convert from -1..1 to 0..1
      rightTrigger = (axes[5] + 1) / 2;
    }

    // Fallback to button values for triggers
    if (gamepad.buttons[6]) {
      leftTrigger = Math.max(leftTrigger, gamepad.buttons[6].value);
    }
    if (gamepad.buttons[7]) {
      rightTrigger = Math.max(rightTrigger, gamepad.buttons[7].value);
    }

    this.state.analog = {
      moveX: leftX,
      moveY: leftY,
      lookX: rightX,
      lookY: rightY,
      leftTrigger,
      rightTrigger,
    };

    // Track if gamepad is being used
    if (
      Math.abs(leftX) > 0.1 ||
      Math.abs(leftY) > 0.1 ||
      Math.abs(rightX) > 0.1 ||
      Math.abs(rightY) > 0.1 ||
      this.state.gamepadButtons.some((b) => b)
    ) {
      this.lastInputSource = 'gamepad';
    }
  }

  private applyDeadzone(value: number): number {
    if (Math.abs(value) < STICK_DEADZONE) {
      return 0;
    }
    // Remap from deadzone..1 to 0..1
    const sign = value > 0 ? 1 : -1;
    return sign * ((Math.abs(value) - STICK_DEADZONE) / (1 - STICK_DEADZONE));
  }

  private updateEdgeDetection(): void {
    this.actionsJustPressed.clear();
    this.actionsJustReleased.clear();

    // Check all core actions
    const allActions: AnyAction[] = [
      'moveForward',
      'moveBackward',
      'moveLeft',
      'moveRight',
      'jump',
      'crouch',
      'sprint',
      'fire',
      'reload',
      'interact',
      'pause',
    ];

    // Add dynamic actions
    const dynamicActions: DynamicAction[] = [
      'vehicleBoost',
      'vehicleBrake',
      'vehicleEject',
      'squadFollow',
      'squadHold',
      'squadAttack',
      'squadRegroup',
      'useAbility1',
      'useAbility2',
      'useAbility3',
      'weaponMelee',
      'weaponGrenade',
      'mantle',
      'slide',
    ];
    allActions.push(...dynamicActions);

    for (const action of allActions) {
      const isPressed = this.isActionPressed(action);
      const wasPressed = this.previousActionStates.get(action) ?? false;

      if (isPressed && !wasPressed) {
        this.actionsJustPressed.add(action);
      } else if (!isPressed && wasPressed) {
        this.actionsJustReleased.add(action);
      }

      this.previousActionStates.set(action, isPressed);
    }
  }

  // ============================================================================
  // ACTION QUERIES
  // ============================================================================

  /**
   * Check if an action is currently pressed (held down).
   * Checks keyboard, mouse, gamepad, and touch inputs based on bindings.
   *
   * @param action - The action to check (core or dynamic)
   * @returns True if the action is currently pressed
   */
  isActionPressed(action: AnyAction): boolean {
    // Check keyboard/mouse bindings
    if (this.isKeyboardActionPressed(action)) {
      return true;
    }

    // Check gamepad bindings
    if (this.isGamepadActionPressed(action)) {
      return true;
    }

    // Check touch input
    if (this.isTouchActionPressed(action)) {
      return true;
    }

    return false;
  }

  /**
   * Check if an action was just pressed this frame (edge detection).
   *
   * @param action - The action to check
   * @returns True if the action was just pressed
   */
  isActionJustPressed(action: AnyAction): boolean {
    return this.actionsJustPressed.has(action);
  }

  /**
   * Check if an action was just released this frame (edge detection).
   *
   * @param action - The action to check
   * @returns True if the action was just released
   */
  isActionJustReleased(action: AnyAction): boolean {
    return this.actionsJustReleased.has(action);
  }

  private isKeyboardActionPressed(action: AnyAction): boolean {
    // Get binding for action
    let binding: KeybindingValue | undefined;

    if (this.isBindableAction(action)) {
      binding = this.keybindings[action];
    } else {
      binding = this.dynamicBindings[action as DynamicAction];
    }

    if (!binding) return false;

    const keys = getKeysForAction(binding);

    for (const key of keys) {
      // Check mouse buttons (Mouse0, Mouse1, Mouse2)
      if (key.startsWith('Mouse')) {
        const buttonIndex = parseInt(key.slice(5), 10);
        if (this.state.mouseButtons.has(buttonIndex)) {
          return true;
        }
      } else {
        // Check keyboard
        if (this.state.keysPressed.has(key)) {
          return true;
        }
      }
    }

    return false;
  }

  private isGamepadActionPressed(action: AnyAction): boolean {
    if (!this.state.gamepadConnected) return false;

    const button = this.gamepadBindings[action];
    if (!button) return false;

    const buttonIndex = GAMEPAD_BUTTON_INDEX[button];
    if (buttonIndex === undefined) return false;

    // Special handling for triggers
    if (button === 'LT') {
      return this.state.analog.leftTrigger > TRIGGER_THRESHOLD;
    }
    if (button === 'RT') {
      return this.state.analog.rightTrigger > TRIGGER_THRESHOLD;
    }

    return this.state.gamepadButtons[buttonIndex] ?? false;
  }

  private isTouchActionPressed(action: AnyAction): boolean {
    if (!this.state.touch) return false;

    const touch = this.state.touch;

    switch (action) {
      case 'fire':
        return touch.isFiring;
      case 'sprint':
        return touch.isSprinting;
      case 'jump':
        return touch.isJumping ?? false;
      case 'crouch':
        return touch.isCrouching ?? false;
      case 'reload':
        return touch.isReloading ?? false;
      case 'interact':
        return touch.isInteracting ?? false;
      // Touch-specific actions mapped to dynamic actions
      case 'weaponMelee':
        return touch.isMelee ?? false;
      case 'weaponGrenade':
        return touch.isGrenade ?? false;
      case 'slide':
        return touch.isSliding ?? false;
      // Movement is handled via analog values, not boolean states
      default:
        return false;
    }
  }

  private isBindableAction(action: AnyAction): action is BindableAction {
    return action in this.keybindings;
  }

  // ============================================================================
  // ANALOG INPUT QUERIES
  // ============================================================================

  /**
   * Get movement input as a normalized vector.
   * Combines keyboard WASD, gamepad left stick, and touch joystick.
   *
   * @returns Object with x and y (-1 to 1)
   */
  getMovementInput(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    // Keyboard input (uses keybindings)
    if (this.isActionPressed('moveRight')) x += 1;
    if (this.isActionPressed('moveLeft')) x -= 1;
    if (this.isActionPressed('moveForward')) y += 1;
    if (this.isActionPressed('moveBackward')) y -= 1;

    // Gamepad left stick
    if (this.state.gamepadConnected) {
      const analog = this.state.analog;
      // Add gamepad input (prioritize if stronger)
      if (Math.abs(analog.moveX) > Math.abs(x)) x = analog.moveX;
      if (Math.abs(analog.moveY) > Math.abs(y)) y = -analog.moveY; // Invert Y
    }

    // Touch joystick
    if (this.state.touch) {
      const touch = this.state.touch.movement;
      if (Math.abs(touch.x) > Math.abs(x)) x = touch.x;
      if (Math.abs(touch.y) > Math.abs(y)) y = touch.y;
    }

    // Normalize diagonal movement
    const magnitude = Math.sqrt(x * x + y * y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }

    return { x, y };
  }

  /**
   * Get look/camera input.
   * Returns gamepad right stick and touch look values.
   * Mouse look is handled separately via pointer lock events.
   *
   * @returns Object with x and y (-1 to 1)
   */
  getLookInput(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    // Gamepad right stick
    if (this.state.gamepadConnected) {
      x = this.state.analog.lookX;
      y = this.state.analog.lookY;
    }

    // Touch look input
    if (this.state.touch) {
      const touch = this.state.touch.look;
      if (Math.abs(touch.x) > 0.0001) x = touch.x;
      if (Math.abs(touch.y) > 0.0001) y = touch.y;
    }

    return { x, y };
  }

  /**
   * Get trigger values for analog actions.
   *
   * @returns Object with left and right trigger values (0-1)
   */
  getTriggers(): { left: number; right: number } {
    return {
      left: this.state.analog.leftTrigger,
      right: this.state.analog.rightTrigger,
    };
  }

  // ============================================================================
  // TOUCH INPUT
  // ============================================================================

  /**
   * Set touch input state from external touch controls.
   * Call this from the touch controls component.
   *
   * @param input - Touch input state or null to clear
   */
  setTouchInput(input: TouchInputState | null): void {
    this.state.touch = input;
    if (input) {
      this.lastInputSource = 'touch';
    }
  }

  // ============================================================================
  // MOUSE MOVEMENT
  // ============================================================================

  /**
   * Accumulate mouse movement (call from mousemove handler).
   * This is separate from pointer lock handling which is done by the player/level.
   *
   * @param dx - Mouse movement X
   * @param dy - Mouse movement Y
   */
  accumulateMouseMovement(dx: number, dy: number): void {
    this.mouseMovementX += dx;
    this.mouseMovementY += dy;
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      this.lastInputSource = 'mouse';
    }
  }

  /**
   * Get and clear accumulated mouse movement.
   * Call this once per frame to get mouse look delta.
   *
   * @returns Object with x and y mouse movement since last call
   */
  consumeMouseMovement(): { x: number; y: number } {
    const movement = { x: this.mouseMovementX, y: this.mouseMovementY };
    this.mouseMovementX = 0;
    this.mouseMovementY = 0;
    return movement;
  }

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  /**
   * Get the current input state.
   * Useful for debugging or advanced input handling.
   */
  getState(): Readonly<InputState> {
    return this.state;
  }

  /**
   * Get the last input source used.
   * Useful for adapting UI prompts.
   */
  getLastInputSource(): InputSource {
    return this.lastInputSource;
  }

  /**
   * Check if a gamepad is connected.
   */
  isGamepadConnected(): boolean {
    return this.state.gamepadConnected;
  }

  /**
   * Get the connected gamepad name.
   */
  getGamepadName(): string | null {
    return this.state.gamepadName;
  }

  /**
   * Check if a specific key code is pressed (raw access).
   */
  isKeyPressed(code: string): boolean {
    return this.state.keysPressed.has(code);
  }

  /**
   * Check if a specific mouse button is pressed.
   */
  isMouseButtonPressed(button: number): boolean {
    return this.state.mouseButtons.has(button);
  }

  /**
   * Check if a specific gamepad button is pressed (by index).
   */
  isGamepadButtonPressed(buttonIndex: number): boolean {
    return this.state.gamepadButtons[buttonIndex] ?? false;
  }

  /**
   * Clear all pressed states.
   * Useful when pausing or losing focus.
   */
  clearAll(): void {
    this.state.keysPressed.clear();
    this.state.mouseButtons.clear();
    this.state.gamepadButtons.fill(false);
    this.state.analog = {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      leftTrigger: 0,
      rightTrigger: 0,
    };
    this.mouseMovementX = 0;
    this.mouseMovementY = 0;
  }

  // ============================================================================
  // BINDING QUERIES
  // ============================================================================

  /**
   * Get the primary key bound to an action (for display).
   */
  getKeyForAction(action: BindableAction): string {
    const binding = this.keybindings[action];
    const keys = getKeysForAction(binding);
    return keys[0] ?? '';
  }

  /**
   * Get all keys bound to an action.
   */
  getAllKeysForAction(action: BindableAction): string[] {
    return getKeysForAction(this.keybindings[action]);
  }

  /**
   * Get the gamepad button bound to an action.
   */
  getGamepadButtonForAction(action: AnyAction): GamepadButton | undefined {
    return this.gamepadBindings[action];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalInputManager: InputManager | null = null;

/**
 * Get the global InputManager instance.
 * Creates one if it doesn't exist.
 */
export function getInputManager(): InputManager {
  if (!globalInputManager) {
    globalInputManager = new InputManager();
  }
  return globalInputManager;
}

/**
 * Dispose the global InputManager instance.
 */
export function disposeInputManager(): void {
  if (globalInputManager) {
    globalInputManager.dispose();
    globalInputManager = null;
  }
}
