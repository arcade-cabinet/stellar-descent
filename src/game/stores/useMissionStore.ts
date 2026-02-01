/**
 * useMissionStore - Zustand store for mission/objective UI state
 *
 * Replaces MissionContext with a non-persisted Zustand store.
 * Manages mission text, objectives, comms, notifications, compass, and action buttons.
 *
 * Usage:
 * ```ts
 * // In React components:
 * import { useMissionStore } from '../stores/useMissionStore';
 * const { objectiveTitle, notification } = useMissionStore();
 *
 * // Direct access for game systems:
 * import { getMissionStore } from '../stores/useMissionStore';
 * getMissionStore().showNotification('Enemy spotted!', 3000);
 * ```
 */

import { getLogger } from '../core/Logger';
import type { CommsMessage } from '../types';
import type { ActionButtonGroup } from '../types/actions';
import { createStore } from './createPersistedStore';

const log = getLogger('MissionStore');

// ============================================================================
// TYPES (migrated from MissionContext)
// ============================================================================

/**
 * Objective marker for guiding player attention
 */
export interface ObjectiveMarker {
  type: 'main' | 'interact' | 'optional' | 'waypoint';
  visible: boolean;
  label?: string;
}

/**
 * Screen-space objective marker for edge indicators
 * Updated by the 3D game loop with projected positions
 */
export interface ScreenSpaceObjective {
  id: string;
  type: 'main' | 'interact' | 'optional' | 'waypoint';
  label?: string;
  /** Screen X position (-1 to 1, where 0 is center) */
  screenX: number;
  /** Screen Y position (-1 to 1, where 0 is center) */
  screenY: number;
  /** Distance from player in meters */
  distance: number;
  /** Whether the objective is in front of the camera */
  isInFront: boolean;
  /** Whether the objective is within the viewport */
  isOnScreen: boolean;
}

/**
 * Compass navigation data from player/camera
 */
export interface CompassData {
  /** Player heading in radians (0 = North, positive = clockwise) */
  heading: number;
  /** Direction to current objective in radians (optional) */
  objectiveDirection?: number;
  /** Distance to current objective in meters (optional) */
  objectiveDistance?: number;
}

/**
 * Mission state (data fields)
 */
export interface MissionState {
  missionText: string;
  objectiveTitle: string;
  objectiveInstructions: string;
  currentChapter: number;
  notification: { text: string; id: number } | null;
  currentComms: CommsMessage | null;
  commsDismissedFlag: number;
  actionGroups: ActionButtonGroup[];
  objectiveMarker: ObjectiveMarker | null;
  screenSpaceObjectives: ScreenSpaceObjective[];
  compassData: CompassData;
}

/**
 * Mission actions
 */
export interface MissionActions {
  setMissionText: (text: string) => void;
  setObjective: (title: string, instructions: string) => void;
  setCurrentChapter: (chapter: number) => void;
  showNotification: (text: string, duration?: number) => void;
  showComms: (message: CommsMessage) => void;
  hideComms: () => void;
  setActionGroups: (groups: ActionButtonGroup[]) => void;
  triggerAction: (actionId: string) => void;
  setOnActionTriggered: (handler: ((actionId: string) => void) | null) => void;
  onActionTriggered: ((actionId: string) => void) | null;
  setObjectiveMarker: (marker: ObjectiveMarker | null) => void;
  setScreenSpaceObjectives: (objectives: ScreenSpaceObjective[]) => void;
  setCompassData: (data: CompassData) => void;
  reset: () => void;
}

export type MissionStoreState = MissionState & MissionActions;

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: MissionState = {
  missionText: 'DROP ZONE ALPHA',
  objectiveTitle: '',
  objectiveInstructions: '',
  currentChapter: 2,
  notification: null,
  currentComms: null,
  commsDismissedFlag: 0,
  actionGroups: [],
  objectiveMarker: null,
  screenSpaceObjectives: [],
  compassData: { heading: 0 },
};

// Module-scoped timeout for notification auto-dismiss
let notificationTimeout: ReturnType<typeof setTimeout> | null = null;

// Module-scoped action handler (replaces useRef from context)
let actionHandler: ((actionId: string) => void) | null = null;

// ============================================================================
// STORE
// ============================================================================

export const useMissionStore = createStore<MissionStoreState>((set, get) => ({
  ...initialState,
  onActionTriggered: null,

  setMissionText: (text: string) => {
    set({ missionText: text });
  },

  setObjective: (title: string, instructions: string) => {
    set({ objectiveTitle: title, objectiveInstructions: instructions });
  },

  setCurrentChapter: (chapter: number) => {
    set({ currentChapter: chapter });
  },

  showNotification: (text: string, duration = 3000) => {
    const id = Date.now();
    set({ notification: { text, id } });

    if (notificationTimeout) clearTimeout(notificationTimeout);

    notificationTimeout = setTimeout(() => {
      const current = get().notification;
      if (current?.id === id) {
        set({ notification: null });
      }
    }, duration);
  },

  showComms: (message: CommsMessage) => {
    log.debug('showComms called:', message.text?.substring(0, 40));
    set({ currentComms: message });
  },

  hideComms: () => {
    set((state) => ({
      currentComms: null,
      commsDismissedFlag: state.commsDismissedFlag + 1,
    }));
  },

  setActionGroups: (groups: ActionButtonGroup[]) => {
    set({ actionGroups: groups });
  },

  triggerAction: (actionId: string) => {
    if (actionHandler) {
      actionHandler(actionId);
    }
  },

  setOnActionTriggered: (handler: ((actionId: string) => void) | null) => {
    actionHandler = handler;
    set({ onActionTriggered: handler });
  },

  setObjectiveMarker: (marker: ObjectiveMarker | null) => {
    set({ objectiveMarker: marker });
  },

  setScreenSpaceObjectives: (objectives: ScreenSpaceObjective[]) => {
    set({ screenSpaceObjectives: objectives });
  },

  setCompassData: (data: CompassData) => {
    set({ compassData: data });
  },

  reset: () => {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }
    actionHandler = null;
    set({ ...initialState, onActionTriggered: null });
    log.info('Mission state reset');
  },
}));

// ============================================================================
// DIRECT ACCESS FOR GAME SYSTEMS
// ============================================================================

/**
 * Get the mission store for direct access from game systems.
 * Prefer using the hook in React components.
 */
export function getMissionStore(): MissionStoreState {
  return useMissionStore.getState();
}
