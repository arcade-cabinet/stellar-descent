import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { CommsMessage } from '../types';
import type { ActionButtonGroup } from '../types/actions';

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

export interface MissionContextType {
  // Mission/Objective
  missionText: string;
  setMissionText: (text: string) => void;
  objectiveTitle: string;
  objectiveInstructions: string;
  setObjective: (title: string, instructions: string) => void;
  currentChapter: number;
  setCurrentChapter: (chapter: number) => void;

  // Notifications
  showNotification: (text: string, duration?: number) => void;
  notification: { text: string; id: number } | null;

  // Comms display
  showComms: (message: CommsMessage) => void;
  hideComms: () => void;
  currentComms: CommsMessage | null;
  commsDismissedFlag: number; // Increments when comms dismissed

  // Dynamic action buttons
  actionGroups: ActionButtonGroup[];
  setActionGroups: (groups: ActionButtonGroup[]) => void;
  triggerAction: (actionId: string) => void;
  onActionTriggered: ((actionId: string) => void) | null;
  setOnActionTriggered: (handler: ((actionId: string) => void) | null) => void;

  // Objective marker
  objectiveMarker: ObjectiveMarker | null;
  setObjectiveMarker: (marker: ObjectiveMarker | null) => void;

  // Screen-space objectives for edge markers
  screenSpaceObjectives: ScreenSpaceObjective[];
  setScreenSpaceObjectives: (objectives: ScreenSpaceObjective[]) => void;

  // Compass navigation data
  compassData: CompassData;
  setCompassData: (data: CompassData) => void;
}

const MissionContext = createContext<MissionContextType | null>(null);

export function useMission() {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return context;
}

interface MissionProviderProps {
  children: ReactNode;
  onChapterChange?: (chapter: number) => void;
}

export function MissionProvider({ children, onChapterChange }: MissionProviderProps) {
  const [missionText, setMissionText] = useState('DROP ZONE ALPHA');
  const [objectiveTitle, setObjectiveTitle] = useState('');
  const [objectiveInstructions, setObjectiveInstructions] = useState('');
  const [currentChapter, setCurrentChapterState] = useState(2);
  const [notification, setNotification] = useState<{ text: string; id: number } | null>(null);
  const [currentComms, setCurrentComms] = useState<CommsMessage | null>(null);
  const [commsDismissedFlag, setCommsDismissedFlag] = useState(0);
  const [actionGroups, setActionGroups] = useState<ActionButtonGroup[]>([]);
  const actionHandlerRef = useRef<((actionId: string) => void) | null>(null);
  const [objectiveMarker, setObjectiveMarker] = useState<ObjectiveMarker | null>(null);
  const [screenSpaceObjectives, setScreenSpaceObjectives] = useState<ScreenSpaceObjective[]>([]);
  const [compassData, setCompassData] = useState<CompassData>({ heading: 0 });

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  const setCurrentChapter = useCallback(
    (chapter: number) => {
      setCurrentChapterState(chapter);
      onChapterChange?.(chapter);
    },
    [onChapterChange]
  );

  const setObjective = useCallback((title: string, instructions: string) => {
    setObjectiveTitle(title);
    setObjectiveInstructions(instructions);
  }, []);

  const showNotification = useCallback((text: string, duration = 3000) => {
    const id = Date.now();
    setNotification({ text, id });

    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);

    notificationTimeoutRef.current = setTimeout(() => {
      setNotification((current) => (current?.id === id ? null : current));
    }, duration);
  }, []);

  const showComms = useCallback((message: CommsMessage) => {
    console.log('[MissionContext] showComms called:', message.text?.substring(0, 40));
    setCurrentComms(message);
  }, []);

  const hideComms = useCallback(() => {
    setCurrentComms(null);
    setCommsDismissedFlag((prev) => prev + 1);
  }, []);

  const triggerAction = useCallback((actionId: string) => {
    if (actionHandlerRef.current) {
      actionHandlerRef.current(actionId);
    }
  }, []);

  const setOnActionTriggered = useCallback((handler: ((actionId: string) => void) | null) => {
    actionHandlerRef.current = handler;
  }, []);

  const value: MissionContextType = {
    missionText,
    setMissionText,
    objectiveTitle,
    objectiveInstructions,
    setObjective,
    currentChapter,
    setCurrentChapter,
    showNotification,
    notification,
    showComms,
    hideComms,
    currentComms,
    commsDismissedFlag,
    actionGroups,
    setActionGroups,
    triggerAction,
    onActionTriggered: actionHandlerRef.current,
    setOnActionTriggered,
    objectiveMarker,
    setObjectiveMarker,
    screenSpaceObjectives,
    setScreenSpaceObjectives,
    compassData,
    setCompassData,
  };

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}
