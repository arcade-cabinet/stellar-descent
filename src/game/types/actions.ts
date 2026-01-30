/**
 * Dynamic Action Button System
 *
 * Levels can register context-sensitive action buttons that appear on the HUD.
 * Buttons can be added, removed, enabled/disabled, and have cooldowns.
 *
 * For configurable keybindings, use:
 * - bindableActionParams() for actions like reload, interact, fire, sprint, jump
 * - levelActionParams() for level-specific fixed actions like flashlight, scanner
 *
 * Examples:
 * - Landfall: "IGNITE JETS" → "BOOST" → "STABILIZE"
 * - FOB Delta: "FLASHLIGHT" → "SCAN" → "INTERACT"
 * - Combat: "RELOAD" → "GRENADE" → "MELEE"
 */

import { bindableActionParams, formatKeyForDisplay, levelActionParams } from '../input/InputBridge';

export type ActionButtonId = string;

export interface ActionButton {
  id: ActionButtonId;
  label: string;
  icon?: string; // Optional icon name or emoji

  // Keybinding
  key: string; // e.g., 'Space', 'KeyE', 'KeyQ'
  keyDisplay: string; // e.g., 'SPACE', 'E', 'Q'

  // State
  enabled: boolean;
  visible: boolean;
  highlighted?: boolean; // Glowing/pulsing to draw attention

  // Cooldown (optional)
  cooldown?: number; // Total cooldown time in ms
  cooldownRemaining?: number; // Current remaining cooldown

  // Progress bar (optional, for charging/timing)
  progress?: number; // 0-1, shows a progress bar on the button
  progressColor?: string;

  // Styling
  variant?: 'primary' | 'secondary' | 'danger' | 'warning';
  size?: 'small' | 'medium' | 'large';
}

export interface ActionButtonGroup {
  id: string;
  label?: string;
  buttons: ActionButton[];
  position: 'left' | 'right' | 'bottom' | 'center';
}

/**
 * Action state passed to HUD
 */
export interface ActionState {
  groups: ActionButtonGroup[];
}

/**
 * Create a simple action button with defaults
 */
export function createAction(
  id: string,
  label: string,
  key: string,
  options: Partial<ActionButton> = {}
): ActionButton {
  return {
    id,
    label,
    key,
    keyDisplay: formatKeyDisplay(key),
    enabled: true,
    visible: true,
    variant: 'primary',
    size: 'medium',
    ...options,
  };
}

/**
 * Format key code for display.
 * Delegates to the centralized formatKeyForDisplay from InputBridge.
 */
function formatKeyDisplay(key: string): string {
  return formatKeyForDisplay(key);
}

/**
 * Preset action groups for common scenarios.
 *
 * Actions are divided into:
 * - Bindable actions (reload, interact, fire, sprint, jump, crouch) - use user keybindings
 * - Level-specific actions (flashlight, scanner, grenade, melee) - fixed keys
 */
export const ACTION_PRESETS = {
  // Landing phase (level-specific action)
  landing: (): ActionButtonGroup => {
    const jets = levelActionParams('igniteJets');
    return {
      id: 'landing',
      label: 'DESCENT',
      position: 'right',
      buttons: [
        createAction('ignite_jets', 'IGNITE JETS', jets.key, {
          keyDisplay: jets.keyDisplay,
          variant: 'danger',
          size: 'large',
          highlighted: true,
          icon: '🔥',
        }),
      ],
    };
  },

  // Powered descent (level-specific actions)
  poweredDescent: (): ActionButtonGroup => {
    const boost = levelActionParams('boost');
    const stabilize = levelActionParams('stabilize');
    const brake = levelActionParams('brake');
    return {
      id: 'powered_descent',
      label: 'THRUSTERS',
      position: 'right',
      buttons: [
        createAction('boost', 'BOOST', boost.key, {
          keyDisplay: boost.keyDisplay,
          variant: 'primary',
          size: 'large',
          icon: '⬆️',
        }),
        createAction('stabilize', 'STABILIZE', stabilize.key, {
          keyDisplay: stabilize.keyDisplay,
          variant: 'secondary',
          icon: '⚖️',
        }),
        createAction('brake', 'BRAKE', brake.key, {
          keyDisplay: brake.keyDisplay,
          variant: 'warning',
          icon: '⬇️',
        }),
      ],
    };
  },

  // Combat (reload is configurable, grenade/melee are level-specific)
  combat: (): ActionButtonGroup => {
    const reload = bindableActionParams('reload');
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');
    return {
      id: 'combat',
      label: 'COMBAT',
      position: 'right',
      buttons: [
        createAction('reload', 'RELOAD', reload.key, {
          keyDisplay: reload.keyDisplay,
          variant: 'secondary',
          icon: '🔄',
        }),
        createAction('grenade', 'GRENADE', grenade.key, {
          keyDisplay: grenade.keyDisplay,
          variant: 'danger',
          icon: '💥',
        }),
        createAction('melee', 'MELEE', melee.key, {
          keyDisplay: melee.keyDisplay,
          variant: 'primary',
          icon: '🔪',
        }),
      ],
    };
  },

  // Exploration (interact is configurable, flashlight/scan are level-specific)
  exploration: (): ActionButtonGroup => {
    const flashlight = levelActionParams('flashlight');
    const scanner = levelActionParams('scanner');
    const interact = bindableActionParams('interact');
    return {
      id: 'exploration',
      label: 'TOOLS',
      position: 'right',
      buttons: [
        createAction('flashlight', 'FLASHLIGHT', flashlight.key, {
          keyDisplay: flashlight.keyDisplay,
          variant: 'secondary',
          icon: '🔦',
        }),
        createAction('scan', 'SCAN', scanner.key, {
          keyDisplay: scanner.keyDisplay,
          variant: 'primary',
          icon: '📡',
        }),
        createAction('interact', 'INTERACT', interact.key, {
          keyDisplay: interact.keyDisplay,
          variant: 'primary',
          icon: '🖐️',
        }),
      ],
    };
  },

  // Empty (no actions)
  empty: (): ActionButtonGroup => ({
    id: 'empty',
    position: 'right',
    buttons: [],
  }),
};
