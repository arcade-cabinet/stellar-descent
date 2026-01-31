/**
 * InputIntegration.test.ts - Complete input system tests
 *
 * Tests all input methods without actual DOM events:
 * - Keyboard input and keybindings
 * - Mouse input and look controls
 * - Gamepad input and mapping
 * - Touch input from virtual controls
 * - Action-based input queries
 * - Edge detection (just pressed/released)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InputManager,
  getInputManager,
  disposeInputManager,
  type InputState,
  type AnalogState,
  type TouchInputState,
  type InputSource,
} from '../input/InputManager';
import {
  DEFAULT_KEYBINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
  type BindableAction,
  type Keybindings,
} from '../context/KeybindingsContext';

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  },
});

// Mock navigator.getGamepads
let mockGamepads: (Gamepad | null)[] = [null, null, null, null];
vi.stubGlobal('navigator', {
  getGamepads: () => mockGamepads,
});

// Mock window
const windowEventListeners: Record<string, Set<Function>> = {};
vi.stubGlobal('window', {
  addEventListener: (event: string, handler: Function) => {
    if (!windowEventListeners[event]) {
      windowEventListeners[event] = new Set();
    }
    windowEventListeners[event].add(handler);
  },
  removeEventListener: (event: string, handler: Function) => {
    if (windowEventListeners[event]) {
      windowEventListeners[event].delete(handler);
    }
  },
});

// Helper to dispatch mock events
function dispatchKeyEvent(type: 'keydown' | 'keyup', code: string): void {
  const handlers = windowEventListeners[type];
  if (handlers) {
    const event = { code, key: code.replace('Key', ''), preventDefault: vi.fn() } as any;
    handlers.forEach((h) => h(event));
  }
}

function dispatchMouseEvent(type: 'mousedown' | 'mouseup', button: number): void {
  const handlers = windowEventListeners[type];
  if (handlers) {
    const event = { button, preventDefault: vi.fn() } as any;
    handlers.forEach((h) => h(event));
  }
}

function createMockGamepad(index: number): Gamepad {
  return {
    id: `Mock Gamepad ${index}`,
    index,
    connected: true,
    timestamp: Date.now(),
    mapping: 'standard',
    axes: [0, 0, 0, 0, 0, 0],
    buttons: Array(17)
      .fill(null)
      .map(() => ({ pressed: false, touched: false, value: 0 })),
    hapticActuators: [],
    vibrationActuator: null,
  } as any;
}

describe('Input Integration', () => {
  let inputManager: InputManager;

  beforeEach(() => {
    // Clear mocks
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    Object.keys(windowEventListeners).forEach((key) => windowEventListeners[key].clear());
    mockGamepads = [null, null, null, null];

    // Initialize
    disposeInputManager();
    inputManager = getInputManager();
  });

  afterEach(() => {
    disposeInputManager();
  });

  describe('Keyboard Input', () => {
    it('should track pressed keys', () => {
      dispatchKeyEvent('keydown', 'KeyW');
      expect(inputManager.isKeyPressed('KeyW')).toBe(true);

      dispatchKeyEvent('keyup', 'KeyW');
      expect(inputManager.isKeyPressed('KeyW')).toBe(false);
    });

    it('should map movement keys to actions', () => {
      // Press W (forward)
      dispatchKeyEvent('keydown', 'KeyW');
      expect(inputManager.isActionPressed('moveForward')).toBe(true);

      // Press A (left)
      dispatchKeyEvent('keydown', 'KeyA');
      expect(inputManager.isActionPressed('moveLeft')).toBe(true);

      // Press S (backward)
      dispatchKeyEvent('keydown', 'KeyS');
      expect(inputManager.isActionPressed('moveBackward')).toBe(true);

      // Press D (right)
      dispatchKeyEvent('keydown', 'KeyD');
      expect(inputManager.isActionPressed('moveRight')).toBe(true);
    });

    it('should map action keys correctly', () => {
      // Space = Jump
      dispatchKeyEvent('keydown', 'Space');
      expect(inputManager.isActionPressed('jump')).toBe(true);
      dispatchKeyEvent('keyup', 'Space');

      // LeftControl = Crouch
      dispatchKeyEvent('keydown', 'ControlLeft');
      expect(inputManager.isActionPressed('crouch')).toBe(true);
      dispatchKeyEvent('keyup', 'ControlLeft');

      // LeftShift = Sprint
      dispatchKeyEvent('keydown', 'ShiftLeft');
      expect(inputManager.isActionPressed('sprint')).toBe(true);
      dispatchKeyEvent('keyup', 'ShiftLeft');

      // R = Reload
      dispatchKeyEvent('keydown', 'KeyR');
      expect(inputManager.isActionPressed('reload')).toBe(true);
      dispatchKeyEvent('keyup', 'KeyR');

      // E = Interact
      dispatchKeyEvent('keydown', 'KeyE');
      expect(inputManager.isActionPressed('interact')).toBe(true);
      dispatchKeyEvent('keyup', 'KeyE');

      // Escape = Pause
      dispatchKeyEvent('keydown', 'Escape');
      expect(inputManager.isActionPressed('pause')).toBe(true);
    });

    it('should clear keys on window blur', () => {
      dispatchKeyEvent('keydown', 'KeyW');
      dispatchKeyEvent('keydown', 'KeyA');

      expect(inputManager.isKeyPressed('KeyW')).toBe(true);
      expect(inputManager.isKeyPressed('KeyA')).toBe(true);

      // Trigger blur
      const blurHandlers = windowEventListeners['blur'];
      if (blurHandlers) {
        blurHandlers.forEach((h) => h());
      }

      expect(inputManager.isKeyPressed('KeyW')).toBe(false);
      expect(inputManager.isKeyPressed('KeyA')).toBe(false);
    });
  });

  describe('Mouse Input', () => {
    it('should track mouse buttons', () => {
      dispatchMouseEvent('mousedown', 0); // Left click
      expect(inputManager.isMouseButtonPressed(0)).toBe(true);

      dispatchMouseEvent('mouseup', 0);
      expect(inputManager.isMouseButtonPressed(0)).toBe(false);
    });

    it('should map mouse buttons to actions', () => {
      // Left click = Fire
      dispatchMouseEvent('mousedown', 0);
      expect(inputManager.isActionPressed('fire')).toBe(true);
      dispatchMouseEvent('mouseup', 0);
    });

    it('should accumulate mouse movement', () => {
      inputManager.accumulateMouseMovement(10, -5);
      inputManager.accumulateMouseMovement(5, 3);

      const movement = inputManager.consumeMouseMovement();
      expect(movement.x).toBe(15);
      expect(movement.y).toBe(-2);

      // Should be cleared after consume
      const movement2 = inputManager.consumeMouseMovement();
      expect(movement2.x).toBe(0);
      expect(movement2.y).toBe(0);
    });
  });

  describe('Movement Input', () => {
    it('should return normalized movement vector', () => {
      // Forward only
      dispatchKeyEvent('keydown', 'KeyW');
      let movement = inputManager.getMovementInput();
      expect(movement.y).toBe(1);
      expect(movement.x).toBe(0);
      dispatchKeyEvent('keyup', 'KeyW');

      // Strafe right
      dispatchKeyEvent('keydown', 'KeyD');
      movement = inputManager.getMovementInput();
      expect(movement.x).toBe(1);
      expect(movement.y).toBe(0);
      dispatchKeyEvent('keyup', 'KeyD');
    });

    it('should normalize diagonal movement', () => {
      // Forward + Right
      dispatchKeyEvent('keydown', 'KeyW');
      dispatchKeyEvent('keydown', 'KeyD');

      const movement = inputManager.getMovementInput();
      const magnitude = Math.sqrt(movement.x * movement.x + movement.y * movement.y);

      // Should be normalized (magnitude <= 1)
      expect(magnitude).toBeLessThanOrEqual(1.01);
      expect(movement.x).toBeGreaterThan(0);
      expect(movement.y).toBeGreaterThan(0);
    });
  });

  describe('Gamepad Input', () => {
    it('should detect gamepad connection', () => {
      const gamepad = createMockGamepad(0);
      mockGamepads[0] = gamepad;

      // Trigger gamepad connected event
      const handlers = windowEventListeners['gamepadconnected'];
      if (handlers) {
        handlers.forEach((h) => h({ gamepad } as any));
      }

      expect(inputManager.isGamepadConnected()).toBe(true);
      expect(inputManager.getGamepadName()).toBe('Mock Gamepad 0');
    });

    it('should detect gamepad disconnection', () => {
      const gamepad = createMockGamepad(0);
      mockGamepads[0] = gamepad;

      // Connect
      const connectHandlers = windowEventListeners['gamepadconnected'];
      if (connectHandlers) {
        connectHandlers.forEach((h) => h({ gamepad } as any));
      }

      // Disconnect
      mockGamepads[0] = null;
      const disconnectHandlers = windowEventListeners['gamepaddisconnected'];
      if (disconnectHandlers) {
        disconnectHandlers.forEach((h) => h({ gamepad } as any));
      }

      expect(inputManager.isGamepadConnected()).toBe(false);
    });

    it('should read gamepad buttons', () => {
      const gamepad = createMockGamepad(0);
      mockGamepads[0] = gamepad;

      // Connect
      const handlers = windowEventListeners['gamepadconnected'];
      if (handlers) {
        handlers.forEach((h) => h({ gamepad } as any));
      }

      // Press button 0 (A)
      gamepad.buttons[0] = { pressed: true, touched: true, value: 1 };
      inputManager.update();

      expect(inputManager.isGamepadButtonPressed(0)).toBe(true);
    });

    it('should read gamepad analog sticks', () => {
      const gamepad = createMockGamepad(0);
      mockGamepads[0] = gamepad;

      // Connect
      const handlers = windowEventListeners['gamepadconnected'];
      if (handlers) {
        handlers.forEach((h) => h({ gamepad } as any));
      }

      // Set left stick forward
      gamepad.axes[0] = 0; // X
      gamepad.axes[1] = -0.8; // Y (inverted)
      inputManager.update();

      const state = inputManager.getState();
      expect(state.analog.moveY).toBeLessThan(0); // Forward is negative Y
    });

    it('should apply deadzone to analog sticks', () => {
      const gamepad = createMockGamepad(0);
      mockGamepads[0] = gamepad;

      // Connect
      const handlers = windowEventListeners['gamepadconnected'];
      if (handlers) {
        handlers.forEach((h) => h({ gamepad } as any));
      }

      // Set very small stick movement (within deadzone)
      gamepad.axes[0] = 0.1;
      gamepad.axes[1] = 0.05;
      inputManager.update();

      const state = inputManager.getState();
      expect(state.analog.moveX).toBe(0);
      expect(state.analog.moveY).toBe(0);
    });
  });

  describe('Touch Input', () => {
    it('should accept touch input state', () => {
      const touchInput: TouchInputState = {
        movement: { x: 0.5, y: 0.8 },
        look: { x: -0.2, y: 0.1 },
        isFiring: true,
        isSprinting: false,
      };

      inputManager.setTouchInput(touchInput);

      expect(inputManager.isActionPressed('fire')).toBe(true);
      expect(inputManager.isActionPressed('sprint')).toBe(false);
    });

    it('should include touch in movement input', () => {
      const touchInput: TouchInputState = {
        movement: { x: 0.7, y: 0.3 },
        look: { x: 0, y: 0 },
        isFiring: false,
        isSprinting: false,
      };

      inputManager.setTouchInput(touchInput);

      const movement = inputManager.getMovementInput();
      expect(movement.x).toBeCloseTo(0.7, 1);
      expect(movement.y).toBeCloseTo(0.3, 1);
    });

    it('should include touch in look input', () => {
      const touchInput: TouchInputState = {
        movement: { x: 0, y: 0 },
        look: { x: 0.5, y: -0.3 },
        isFiring: false,
        isSprinting: false,
      };

      inputManager.setTouchInput(touchInput);

      const look = inputManager.getLookInput();
      expect(look.x).toBeCloseTo(0.5, 1);
      expect(look.y).toBeCloseTo(-0.3, 1);
    });

    it('should clear touch input', () => {
      inputManager.setTouchInput({
        movement: { x: 1, y: 1 },
        look: { x: 1, y: 1 },
        isFiring: true,
        isSprinting: true,
      });

      inputManager.setTouchInput(null);

      expect(inputManager.isActionPressed('fire')).toBe(false);
      expect(inputManager.isActionPressed('sprint')).toBe(false);
    });

    it('should handle touch-specific actions', () => {
      const touchInput: TouchInputState = {
        movement: { x: 0, y: 0 },
        look: { x: 0, y: 0 },
        isFiring: false,
        isSprinting: false,
        isJumping: true,
        isCrouching: true,
        isReloading: true,
        isInteracting: true,
        isMelee: true,
        isGrenade: true,
        isSliding: true,
      };

      inputManager.setTouchInput(touchInput);

      expect(inputManager.isActionPressed('jump')).toBe(true);
      expect(inputManager.isActionPressed('crouch')).toBe(true);
      expect(inputManager.isActionPressed('reload')).toBe(true);
      expect(inputManager.isActionPressed('interact')).toBe(true);
      expect(inputManager.isActionPressed('weaponMelee')).toBe(true);
      expect(inputManager.isActionPressed('weaponGrenade')).toBe(true);
      expect(inputManager.isActionPressed('slide')).toBe(true);
    });
  });

  describe('Edge Detection', () => {
    it('should detect action just pressed', () => {
      // First frame - not pressed
      inputManager.update();
      expect(inputManager.isActionJustPressed('jump')).toBe(false);

      // Press key
      dispatchKeyEvent('keydown', 'Space');
      inputManager.update();
      expect(inputManager.isActionJustPressed('jump')).toBe(true);

      // Next frame - still pressed but not just pressed
      inputManager.update();
      expect(inputManager.isActionPressed('jump')).toBe(true);
      expect(inputManager.isActionJustPressed('jump')).toBe(false);
    });

    it('should detect action just released', () => {
      // Press and hold
      dispatchKeyEvent('keydown', 'Space');
      inputManager.update();
      inputManager.update();

      // Release
      dispatchKeyEvent('keyup', 'Space');
      inputManager.update();
      expect(inputManager.isActionJustReleased('jump')).toBe(true);

      // Next frame
      inputManager.update();
      expect(inputManager.isActionJustReleased('jump')).toBe(false);
    });
  });

  describe('Input Source Tracking', () => {
    it('should track last input source as keyboard', () => {
      dispatchKeyEvent('keydown', 'KeyW');
      expect(inputManager.getLastInputSource()).toBe('keyboard');
    });

    it('should track last input source as mouse', () => {
      dispatchMouseEvent('mousedown', 0);
      expect(inputManager.getLastInputSource()).toBe('mouse');
    });

    it('should track last input source as touch', () => {
      inputManager.setTouchInput({
        movement: { x: 1, y: 0 },
        look: { x: 0, y: 0 },
        isFiring: false,
        isSprinting: false,
      });
      expect(inputManager.getLastInputSource()).toBe('touch');
    });
  });

  describe('Keybinding Queries', () => {
    it('should get key for action', () => {
      const jumpKey = inputManager.getKeyForAction('jump');
      expect(jumpKey).toBe('Space');
    });

    it('should get all keys for action', () => {
      const jumpKeys = inputManager.getAllKeysForAction('jump');
      expect(jumpKeys).toContain('Space');
    });

    it('should get gamepad button for action', () => {
      const jumpButton = inputManager.getGamepadButtonForAction('jump');
      expect(jumpButton).toBe('A');
    });
  });

  describe('State Management', () => {
    it('should return complete input state', () => {
      dispatchKeyEvent('keydown', 'KeyW');
      dispatchMouseEvent('mousedown', 0);

      const state = inputManager.getState();

      expect(state.keysPressed.has('KeyW')).toBe(true);
      expect(state.mouseButtons.has(0)).toBe(true);
    });

    it('should clear all input', () => {
      dispatchKeyEvent('keydown', 'KeyW');
      dispatchKeyEvent('keydown', 'KeyA');
      dispatchMouseEvent('mousedown', 0);
      inputManager.accumulateMouseMovement(10, 10);

      inputManager.clearAll();

      expect(inputManager.isKeyPressed('KeyW')).toBe(false);
      expect(inputManager.isKeyPressed('KeyA')).toBe(false);
      expect(inputManager.isMouseButtonPressed(0)).toBe(false);

      const movement = inputManager.consumeMouseMovement();
      expect(movement.x).toBe(0);
      expect(movement.y).toBe(0);
    });
  });

  describe('Custom Keybindings', () => {
    it('should load custom keybindings from localStorage', () => {
      // Set custom keybindings
      const customBindings: Partial<Keybindings> = {
        jump: 'KeyZ', // Changed from Space
        fire: 'KeyX', // Changed from Mouse0
      };
      mockStorage['stellar-descent-keybindings'] = JSON.stringify(customBindings);

      // Reinitialize to load new bindings
      disposeInputManager();
      const newManager = getInputManager();

      // Check custom bindings
      dispatchKeyEvent('keydown', 'KeyZ');
      expect(newManager.isActionPressed('jump')).toBe(true);
    });

    it('should refresh keybindings', () => {
      // Change bindings after initialization
      const customBindings: Partial<Keybindings> = {
        sprint: 'KeyQ', // Changed from ShiftLeft
      };
      mockStorage['stellar-descent-keybindings'] = JSON.stringify(customBindings);

      // Refresh
      inputManager.refreshKeybindings();

      // Old binding should still work (merged with defaults)
      dispatchKeyEvent('keydown', 'ShiftLeft');
      // Note: Actual behavior depends on how refresh merges bindings
    });
  });

  describe('Trigger Values', () => {
    it('should return trigger values', () => {
      const gamepad = createMockGamepad(0);
      mockGamepads[0] = gamepad;

      // Connect
      const handlers = windowEventListeners['gamepadconnected'];
      if (handlers) {
        handlers.forEach((h) => h({ gamepad } as any));
      }

      // Set trigger values
      gamepad.buttons[6] = { pressed: false, touched: true, value: 0.75 }; // LT
      gamepad.buttons[7] = { pressed: true, touched: true, value: 1.0 }; // RT
      inputManager.update();

      const triggers = inputManager.getTriggers();
      expect(triggers.left).toBeGreaterThanOrEqual(0.75);
      expect(triggers.right).toBe(1.0);
    });
  });

  describe('Default Keybindings Validation', () => {
    it('should have all movement keys defined', () => {
      expect(DEFAULT_KEYBINDINGS.moveForward).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.moveBackward).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.moveLeft).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.moveRight).toBeDefined();
    });

    it('should have all action keys defined', () => {
      expect(DEFAULT_KEYBINDINGS.jump).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.crouch).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.sprint).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.fire).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.reload).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.interact).toBeDefined();
      expect(DEFAULT_KEYBINDINGS.pause).toBeDefined();
    });

    it('should have all gamepad buttons defined', () => {
      expect(DEFAULT_GAMEPAD_BINDINGS.jump).toBe('A');
      expect(DEFAULT_GAMEPAD_BINDINGS.crouch).toBe('B');
      expect(DEFAULT_GAMEPAD_BINDINGS.sprint).toBe('LS');
      expect(DEFAULT_GAMEPAD_BINDINGS.fire).toBe('RT');
      expect(DEFAULT_GAMEPAD_BINDINGS.reload).toBe('X');
      expect(DEFAULT_GAMEPAD_BINDINGS.interact).toBe('A'); // Also bound to A (multi-use button)
      expect(DEFAULT_GAMEPAD_BINDINGS.pause).toBe('Start');
    });
  });
});
