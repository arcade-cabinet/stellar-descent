/**
 * KeybindingsSettings - Dedicated keybindings configuration panel
 *
 * Displays all keybindings grouped by category with full rebinding support.
 * Uses the KeyboardRemapper component for the actual key selection.
 *
 * Features:
 * - Tab navigation between Keyboard and Gamepad settings
 * - Grouped display by category (Movement, Combat, Actions, System)
 * - Shows all bound keys including alternatives
 * - Visual conflict warnings for duplicate bindings
 * - Reset to defaults functionality
 * - Integrates with KeyboardRemapper for mobile/desktop rebinding
 * - Integrates with GamepadRemapper for controller rebinding
 * - Only appears on mobile when physical keyboard is connected
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACTION_LABELS,
  type BindableAction,
  type GamepadButton,
  DEFAULT_KEYBINDINGS,
  DEFAULT_GAMEPAD_BINDINGS,
  getKeyDisplayName,
  getKeysForAction,
  getPrimaryKey,
  getGamepadButtonLabel,
  useKeybindings,
} from '../../game/context/KeybindingsContext';
import { getAudioManager } from '../../game/core/AudioManager';
import {
  shouldShowKeyboardSettings,
  shouldShowGamepadSettings,
  onPhysicalKeyboardChange,
  onGamepadChange,
  hasGamepad,
  getConnectedGamepads,
  type GamepadInfo,
} from '../../game/utils/PlatformDetector';
import { KeyboardRemapper } from './KeyboardRemapper';
import { GamepadRemapper } from './GamepadRemapper';
import styles from './KeybindingsSettings.module.css';

/**
 * Settings tab type
 */
type SettingsTab = 'keyboard' | 'gamepad';

/**
 * Keybinding categories for organized display
 */
interface KeybindingCategory {
  id: string;
  title: string;
  description: string;
  actions: BindableAction[];
}

const KEYBINDING_CATEGORIES: KeybindingCategory[] = [
  {
    id: 'movement',
    title: 'MOVEMENT',
    description: 'Player locomotion controls',
    actions: ['moveForward', 'moveBackward', 'moveLeft', 'moveRight', 'jump', 'crouch', 'sprint'],
  },
  {
    id: 'combat',
    title: 'COMBAT',
    description: 'Weapon and attack controls',
    actions: ['fire', 'reload'],
  },
  {
    id: 'actions',
    title: 'ACTIONS',
    description: 'Interaction and utility',
    actions: ['interact'],
  },
  {
    id: 'system',
    title: 'SYSTEM',
    description: 'Game system controls',
    actions: ['pause'],
  },
];

/**
 * Gamepad-specific categories (excludes movement as it uses analog sticks)
 */
const GAMEPAD_CATEGORIES: KeybindingCategory[] = [
  {
    id: 'movement',
    title: 'MOVEMENT',
    description: 'Movement modifiers (analog sticks for movement/look)',
    actions: ['jump', 'crouch', 'sprint'],
  },
  {
    id: 'combat',
    title: 'COMBAT',
    description: 'Weapon and attack controls',
    actions: ['fire', 'reload'],
  },
  {
    id: 'actions',
    title: 'ACTIONS',
    description: 'Interaction and utility',
    actions: ['interact'],
  },
  {
    id: 'system',
    title: 'SYSTEM',
    description: 'Game system controls',
    actions: ['pause'],
  },
];

interface KeybindingsSettingsProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
}

/**
 * Conflict information for a key
 */
interface KeyConflict {
  key: string;
  actions: BindableAction[];
}

/**
 * Conflict information for a gamepad button
 */
interface GamepadConflict {
  button: GamepadButton;
  actions: BindableAction[];
}

export function KeybindingsSettings({ isOpen, onClose }: KeybindingsSettingsProps) {
  const {
    keybindings,
    gamepadBindings,
    setKeybinding,
    setGamepadBinding,
    resetToDefaults,
    resetGamepadToDefaults,
    hasCustomBindings,
    hasCustomGamepadBindings,
    getAllKeysForAction,
    getGamepadButtonForAction,
  } = useKeybindings();

  // Active tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('keyboard');

  // Track if keyboard settings should be shown (mobile needs physical keyboard)
  const [showKeyboardSettings, setShowKeyboardSettings] = useState(() => shouldShowKeyboardSettings());

  // Track if gamepad is connected
  const [gamepadConnected, setGamepadConnected] = useState(() => hasGamepad());
  const [connectedGamepad, setConnectedGamepad] = useState<GamepadInfo | null>(() => {
    const gamepads = getConnectedGamepads();
    return gamepads.length > 0 ? gamepads[0] : null;
  });

  // Subscribe to physical keyboard detection changes
  useEffect(() => {
    const unsubscribe = onPhysicalKeyboardChange((detected) => {
      setShowKeyboardSettings(shouldShowKeyboardSettings());
      if (detected) {
        console.log('[KeybindingsSettings] Physical keyboard detected, enabling settings');
      }
    });
    return unsubscribe;
  }, []);

  // Subscribe to gamepad connection changes
  useEffect(() => {
    const unsubscribe = onGamepadChange((gamepads) => {
      setGamepadConnected(gamepads.length > 0);
      setConnectedGamepad(gamepads.length > 0 ? gamepads[0] : null);
      if (gamepads.length > 0) {
        console.log('[KeybindingsSettings] Gamepad connected:', gamepads[0].displayName);
      }
    });
    return unsubscribe;
  }, []);

  // Track which action is being remapped (keyboard)
  const [remappingAction, setRemappingAction] = useState<BindableAction | null>(null);

  // Track which action is being remapped (gamepad)
  const [remappingGamepadAction, setRemappingGamepadAction] = useState<BindableAction | null>(null);

  // Track expanded categories (all expanded by default)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(KEYBINDING_CATEGORIES.map((c) => c.id))
  );

  // Calculate keyboard conflicts - keys bound to multiple actions
  const keyboardConflicts = useMemo((): KeyConflict[] => {
    const keyToActions = new Map<string, BindableAction[]>();

    // Build map of key -> actions
    for (const [action, binding] of Object.entries(keybindings)) {
      const keys = getKeysForAction(binding);
      for (const key of keys) {
        if (!key) continue;
        const existing = keyToActions.get(key) || [];
        existing.push(action as BindableAction);
        keyToActions.set(key, existing);
      }
    }

    // Find conflicts (keys with multiple actions)
    const result: KeyConflict[] = [];
    for (const [key, actions] of keyToActions) {
      if (actions.length > 1) {
        result.push({ key, actions });
      }
    }

    return result;
  }, [keybindings]);

  // Calculate gamepad conflicts - buttons bound to multiple actions
  const gamepadConflicts = useMemo((): GamepadConflict[] => {
    const buttonToActions = new Map<GamepadButton, BindableAction[]>();

    // Build map of button -> actions
    for (const [action, button] of Object.entries(gamepadBindings)) {
      if (!button) continue;
      const existing = buttonToActions.get(button as GamepadButton) || [];
      existing.push(action as BindableAction);
      buttonToActions.set(button as GamepadButton, existing);
    }

    // Find conflicts (buttons with multiple actions)
    const result: GamepadConflict[] = [];
    for (const [button, actions] of buttonToActions) {
      if (actions.length > 1) {
        result.push({ button, actions });
      }
    }

    return result;
  }, [gamepadBindings]);

  const hasKeyboardConflicts = keyboardConflicts.length > 0;
  const hasGamepadConflicts = gamepadConflicts.length > 0;

  // Check if a specific action has a keyboard conflict
  const getKeyboardConflictForAction = useCallback(
    (action: BindableAction): KeyConflict | null => {
      const keys = getAllKeysForAction(action);
      for (const key of keys) {
        const conflict = keyboardConflicts.find((c) => c.key === key && c.actions.length > 1);
        if (conflict) return conflict;
      }
      return null;
    },
    [keyboardConflicts, getAllKeysForAction]
  );

  // Check if a specific action has a gamepad conflict
  const getGamepadConflictForAction = useCallback(
    (action: BindableAction): GamepadConflict | null => {
      const button = getGamepadButtonForAction(action);
      if (!button) return null;
      const conflict = gamepadConflicts.find((c) => c.button === button && c.actions.length > 1);
      return conflict || null;
    },
    [gamepadConflicts, getGamepadButtonForAction]
  );

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleTabChange = useCallback(
    (tab: SettingsTab) => {
      playClickSound();
      setActiveTab(tab);
    },
    [playClickSound]
  );

  // Keyboard rebind handlers
  const handleRebindClick = useCallback(
    (action: BindableAction) => {
      playClickSound();
      setRemappingAction(action);
    },
    [playClickSound]
  );

  const handleKeySelected = useCallback(
    (keyCode: string) => {
      if (!remappingAction) return;
      playClickSound();
      setKeybinding(remappingAction, keyCode);
      setRemappingAction(null);
    },
    [remappingAction, setKeybinding, playClickSound]
  );

  const handleCancelRemap = useCallback(() => {
    playClickSound();
    setRemappingAction(null);
  }, [playClickSound]);

  // Gamepad rebind handlers
  const handleGamepadRebindClick = useCallback(
    (action: BindableAction) => {
      playClickSound();
      setRemappingGamepadAction(action);
    },
    [playClickSound]
  );

  const handleGamepadButtonSelected = useCallback(
    (button: GamepadButton) => {
      if (!remappingGamepadAction) return;
      playClickSound();
      setGamepadBinding(remappingGamepadAction, button);
      setRemappingGamepadAction(null);
    },
    [remappingGamepadAction, setGamepadBinding, playClickSound]
  );

  const handleCancelGamepadRemap = useCallback(() => {
    playClickSound();
    setRemappingGamepadAction(null);
  }, [playClickSound]);

  // Reset handlers
  const handleResetKeyboardToDefaults = useCallback(() => {
    playClickSound();
    resetToDefaults();
  }, [resetToDefaults, playClickSound]);

  const handleResetGamepadToDefaults = useCallback(() => {
    playClickSound();
    resetGamepadToDefaults();
  }, [resetGamepadToDefaults, playClickSound]);

  const toggleCategory = useCallback(
    (categoryId: string) => {
      playClickSound();
      setExpandedCategories((prev) => {
        const next = new Set(prev);
        if (next.has(categoryId)) {
          next.delete(categoryId);
        } else {
          next.add(categoryId);
        }
        return next;
      });
    },
    [playClickSound]
  );

  // Handle escape to close
  useEffect(() => {
    if (!isOpen || remappingAction || remappingGamepadAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, remappingAction, remappingGamepadAction]);

  // Don't render if not open
  if (!isOpen) return null;

  // Check if we have any input methods available
  const hasAnyInputMethod = showKeyboardSettings || gamepadConnected;

  if (!hasAnyInputMethod) {
    // No keyboard or gamepad - show info message
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true">
        <div className={styles.noKeyboardContainer}>
          <div className={styles.noKeyboardIcon}>
            <span role="img" aria-label="keyboard">&#x2328;&#xFE0F;</span>
          </div>
          <h3 className={styles.noKeyboardTitle}>NO INPUT DEVICES DETECTED</h3>
          <p className={styles.noKeyboardText}>
            Connect a keyboard or gamepad controller to customize bindings.
          </p>
          <p className={styles.noKeyboardHint}>
            Touch controls are active while using on-screen input.
          </p>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    );
  }

  // Keyboard keybinding row renderer
  const renderKeybindingRow = (action: BindableAction) => {
    const keys = getAllKeysForAction(action);
    const primaryKey = keys[0] || '';
    const alternativeKeys = keys.slice(1);
    const conflict = getKeyboardConflictForAction(action);
    const defaultKeys = getKeysForAction(DEFAULT_KEYBINDINGS[action]);
    const isModified = JSON.stringify(keys) !== JSON.stringify(defaultKeys);

    return (
      <div
        key={action}
        className={`${styles.keybindingRow} ${conflict ? styles.hasConflict : ''} ${isModified ? styles.modified : ''}`}
      >
        {/* Action name */}
        <div className={styles.actionInfo}>
          <span className={styles.actionName}>{ACTION_LABELS[action]}</span>
          {isModified && <span className={styles.modifiedBadge}>MODIFIED</span>}
        </div>

        {/* Current bindings */}
        <div className={styles.bindingsContainer}>
          {/* Primary key */}
          <div className={`${styles.keyBadge} ${styles.primaryKey}`}>
            {primaryKey ? getKeyDisplayName(primaryKey) : 'UNBOUND'}
          </div>

          {/* Alternative keys */}
          {alternativeKeys.map((key, idx) => (
            <div key={`${action}-alt-${idx}`} className={`${styles.keyBadge} ${styles.altKey}`}>
              {getKeyDisplayName(key)}
            </div>
          ))}

          {/* Conflict warning */}
          {conflict && (
            <div className={styles.conflictWarning} title={`Conflicts with: ${conflict.actions.filter((a) => a !== action).map((a) => ACTION_LABELS[a]).join(', ')}`}>
              !
            </div>
          )}
        </div>

        {/* Rebind button */}
        <button
          type="button"
          className={styles.rebindButton}
          onClick={() => handleRebindClick(action)}
          aria-label={`Rebind ${ACTION_LABELS[action]}`}
        >
          REBIND
        </button>
      </div>
    );
  };

  // Gamepad keybinding row renderer
  const renderGamepadBindingRow = (action: BindableAction) => {
    const button = getGamepadButtonForAction(action);
    const conflict = getGamepadConflictForAction(action);
    const defaultButton = DEFAULT_GAMEPAD_BINDINGS[action];
    const isModified = button !== defaultButton;
    const controllerType = connectedGamepad?.controllerType || 'xbox';

    return (
      <div
        key={action}
        className={`${styles.keybindingRow} ${conflict ? styles.hasConflict : ''} ${isModified ? styles.modified : ''}`}
      >
        {/* Action name */}
        <div className={styles.actionInfo}>
          <span className={styles.actionName}>{ACTION_LABELS[action]}</span>
          {isModified && <span className={styles.modifiedBadge}>MODIFIED</span>}
        </div>

        {/* Current binding */}
        <div className={styles.bindingsContainer}>
          <div className={`${styles.keyBadge} ${styles.primaryKey}`}>
            {button ? getGamepadButtonLabel(button, controllerType) : 'UNBOUND'}
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div className={styles.conflictWarning} title={`Conflicts with: ${conflict.actions.filter((a) => a !== action).map((a) => ACTION_LABELS[a]).join(', ')}`}>
              !
            </div>
          )}
        </div>

        {/* Rebind button */}
        <button
          type="button"
          className={styles.rebindButton}
          onClick={() => handleGamepadRebindClick(action)}
          aria-label={`Rebind ${ACTION_LABELS[action]}`}
        >
          REBIND
        </button>
      </div>
    );
  };

  // Category renderer for keyboard
  const renderKeyboardCategory = (category: KeybindingCategory) => {
    const isExpanded = expandedCategories.has(category.id);
    const categoryConflicts = category.actions.filter((a) => getKeyboardConflictForAction(a)).length;

    return (
      <div key={category.id} className={styles.category}>
        <button
          type="button"
          className={`${styles.categoryHeader} ${isExpanded ? styles.expanded : ''}`}
          onClick={() => toggleCategory(category.id)}
          aria-expanded={isExpanded}
        >
          <div className={styles.categoryTitleArea}>
            <span className={styles.expandIcon}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
            <span className={styles.categoryTitle}>{category.title}</span>
            {categoryConflicts > 0 && (
              <span className={styles.categoryConflictBadge}>{categoryConflicts} CONFLICT{categoryConflicts > 1 ? 'S' : ''}</span>
            )}
          </div>
          <span className={styles.categoryDescription}>{category.description}</span>
        </button>

        {isExpanded && (
          <div className={styles.categoryContent}>
            {category.actions.map(renderKeybindingRow)}
          </div>
        )}
      </div>
    );
  };

  // Category renderer for gamepad
  const renderGamepadCategory = (category: KeybindingCategory) => {
    const isExpanded = expandedCategories.has(category.id);
    const categoryConflicts = category.actions.filter((a) => getGamepadConflictForAction(a)).length;

    return (
      <div key={category.id} className={styles.category}>
        <button
          type="button"
          className={`${styles.categoryHeader} ${isExpanded ? styles.expanded : ''}`}
          onClick={() => toggleCategory(category.id)}
          aria-expanded={isExpanded}
        >
          <div className={styles.categoryTitleArea}>
            <span className={styles.expandIcon}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
            <span className={styles.categoryTitle}>{category.title}</span>
            {categoryConflicts > 0 && (
              <span className={styles.categoryConflictBadge}>{categoryConflicts} CONFLICT{categoryConflicts > 1 ? 'S' : ''}</span>
            )}
          </div>
          <span className={styles.categoryDescription}>{category.description}</span>
        </button>

        {isExpanded && (
          <div className={styles.categoryContent}>
            {category.actions.map(renderGamepadBindingRow)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="keybindings-title">
      <div className={styles.container}>
        {/* Corner decorations */}
        <div className={styles.cornerTL} aria-hidden="true" />
        <div className={styles.cornerTR} aria-hidden="true" />
        <div className={styles.cornerBL} aria-hidden="true" />
        <div className={styles.cornerBR} aria-hidden="true" />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id="keybindings-title" className={styles.title}>
              CONTROLS
            </h2>
            <span className={styles.subtitle}>Configure control scheme</span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close settings"
          >
            X
          </button>
        </div>

        {/* Tab navigation */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'keyboard' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('keyboard')}
            disabled={!showKeyboardSettings}
            aria-selected={activeTab === 'keyboard'}
          >
            KEYBOARD
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${activeTab === 'gamepad' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('gamepad')}
            disabled={!gamepadConnected}
            aria-selected={activeTab === 'gamepad'}
          >
            GAMEPAD
            {gamepadConnected && connectedGamepad && (
              <span className={styles.connectedBadge}>CONNECTED</span>
            )}
          </button>
        </div>

        {/* Keyboard Tab Content */}
        {activeTab === 'keyboard' && (
          <>
            {/* Conflict warning banner */}
            {hasKeyboardConflicts && (
              <div className={styles.conflictBanner} role="alert">
                <span className={styles.conflictIcon}>!</span>
                <div className={styles.conflictText}>
                  <strong>KEY CONFLICTS DETECTED</strong>
                  <p>
                    {keyboardConflicts.length} key{keyboardConflicts.length > 1 ? 's are' : ' is'} bound to multiple actions.
                    This may cause unexpected behavior.
                  </p>
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div className={styles.content}>
              {KEYBINDING_CATEGORIES.map(renderKeyboardCategory)}

              {/* Mouse/Touch info */}
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelHeader}>ADDITIONAL CONTROLS</div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Camera Look</span>
                  <span className={styles.infoValue}>Mouse Movement / Touch Drag</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Fire Weapon</span>
                  <span className={styles.infoValue}>Left Click / Mouse0</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Aim Down Sights</span>
                  <span className={styles.infoValue}>Right Click / Mouse1</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleResetKeyboardToDefaults}
                disabled={!hasCustomBindings}
                aria-label="Reset keyboard bindings to defaults"
              >
                RESET TO DEFAULTS
              </button>
              <button type="button" className={styles.doneButton} onClick={onClose}>
                DONE
              </button>
            </div>
          </>
        )}

        {/* Gamepad Tab Content */}
        {activeTab === 'gamepad' && (
          <>
            {/* Controller info */}
            {connectedGamepad && (
              <div className={styles.controllerInfo}>
                <span className={styles.controllerIcon}>&#x1F3AE;</span>
                <span className={styles.controllerName}>{connectedGamepad.displayName}</span>
              </div>
            )}

            {/* Conflict warning banner */}
            {hasGamepadConflicts && (
              <div className={styles.conflictBanner} role="alert">
                <span className={styles.conflictIcon}>!</span>
                <div className={styles.conflictText}>
                  <strong>BUTTON CONFLICTS DETECTED</strong>
                  <p>
                    {gamepadConflicts.length} button{gamepadConflicts.length > 1 ? 's are' : ' is'} bound to multiple actions.
                    This may cause unexpected behavior.
                  </p>
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div className={styles.content}>
              {GAMEPAD_CATEGORIES.map(renderGamepadCategory)}

              {/* Analog info */}
              <div className={styles.infoPanel}>
                <div className={styles.infoPanelHeader}>ANALOG CONTROLS</div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Movement</span>
                  <span className={styles.infoValue}>Left Stick</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Camera Look</span>
                  <span className={styles.infoValue}>Right Stick</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Aim Down Sights</span>
                  <span className={styles.infoValue}>Left Trigger (Hold)</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleResetGamepadToDefaults}
                disabled={!hasCustomGamepadBindings}
                aria-label="Reset gamepad bindings to defaults"
              >
                RESET TO DEFAULTS
              </button>
              <button type="button" className={styles.doneButton} onClick={onClose}>
                DONE
              </button>
            </div>
          </>
        )}
      </div>

      {/* KeyboardRemapper overlay */}
      {remappingAction && (
        <KeyboardRemapper
          action={remappingAction}
          currentKey={getPrimaryKey(keybindings[remappingAction])}
          onKeySelected={handleKeySelected}
          onCancel={handleCancelRemap}
        />
      )}

      {/* GamepadRemapper overlay */}
      {remappingGamepadAction && (
        <GamepadRemapper
          action={remappingGamepadAction}
          currentButton={getGamepadButtonForAction(remappingGamepadAction)}
          onButtonSelected={handleGamepadButtonSelected}
          onCancel={handleCancelGamepadRemap}
        />
      )}
    </div>
  );
}

export default KeybindingsSettings;
