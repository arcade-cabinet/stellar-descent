import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { DamageIndicator, HitMarker } from '../../components/ui/DamageIndicators';
import { getAchievementManager } from '../achievements';
import { getAudioManager, type MusicTrack } from '../core/AudioManager';
import {
  DEFAULT_DIFFICULTY,
  type DifficultyLevel,
  type DifficultyModifiers,
  getDifficultyModifiers,
  loadDifficultySetting,
  saveDifficultySetting,
} from '../core/DifficultySettings';
import type { TutorialPhase } from '../levels/anchor-station/tutorialSteps';
import type { CommsMessage, TouchInput } from '../types';
import type { ActionButtonGroup } from '../types/actions';

/**
 * HUD visibility state for progressive unlocking
 * Tutorial levels can enable elements one at a time
 */
export interface HUDVisibility {
  healthBar: boolean;
  crosshair: boolean;
  killCounter: boolean;
  missionText: boolean;
  actionButtons: boolean;
  commsDisplay: boolean;
  notifications: boolean;
  compass: boolean;
}

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
 * Default HUD visibility - all elements visible (post-tutorial state)
 */
export const DEFAULT_HUD_VISIBILITY: HUDVisibility = {
  healthBar: true,
  crosshair: true,
  killCounter: true,
  missionText: true,
  actionButtons: true,
  commsDisplay: true,
  notifications: true,
  compass: true,
};

/**
 * Tutorial start HUD visibility - minimal UI
 */
export const TUTORIAL_START_HUD_VISIBILITY: HUDVisibility = {
  healthBar: false,
  crosshair: false,
  killCounter: false,
  missionText: false,
  actionButtons: false,
  commsDisplay: true, // Always available for narrative
  notifications: true, // Always available for feedback
  compass: false, // Unlocked later in tutorial
};

interface GameContextType {
  // Player state
  playerHealth: number;
  maxHealth: number;
  setPlayerHealth: (health: number) => void;
  isPlayerDead: boolean;
  resetPlayerHealth: () => void;
  onPlayerDeath: (() => void) | null;
  setOnPlayerDeath: (callback: (() => void) | null) => void;

  // Combat stats
  kills: number;
  addKill: () => void;

  // Mission/Objective
  missionText: string;
  setMissionText: (text: string) => void;
  objectiveTitle: string;
  objectiveInstructions: string;
  setObjective: (title: string, instructions: string) => void;
  currentChapter: number;
  setCurrentChapter: (chapter: number) => void;

  // Touch input
  touchInput: TouchInput | null;
  setTouchInput: (input: TouchInput | null) => void;

  // Notifications
  showNotification: (text: string, duration?: number) => void;
  notification: { text: string; id: number } | null;

  // Comms display
  showComms: (message: CommsMessage) => void;
  hideComms: () => void;
  currentComms: CommsMessage | null;
  commsDismissedFlag: number; // Increments when comms dismissed

  // Game events
  onDamage: () => void;
  damageFlash: boolean;

  // Calibration mode (shooting range)
  isCalibrating: boolean;
  setIsCalibrating: (value: boolean) => void;

  // Music/combat state
  inCombat: boolean;
  setInCombat: (value: boolean) => void;
  playMusic: (track: MusicTrack) => void;

  // Dynamic action buttons
  actionGroups: ActionButtonGroup[];
  setActionGroups: (groups: ActionButtonGroup[]) => void;
  triggerAction: (actionId: string) => void;
  onActionTriggered: ((actionId: string) => void) | null;
  setOnActionTriggered: (handler: ((actionId: string) => void) | null) => void;

  // HUD visibility (progressive unlocking)
  hudVisibility: HUDVisibility;
  setHUDVisibility: (visibility: Partial<HUDVisibility>) => void;
  resetHUDVisibility: () => void;

  // Objective marker
  objectiveMarker: ObjectiveMarker | null;
  setObjectiveMarker: (marker: ObjectiveMarker | null) => void;

  // Screen-space objectives for edge markers
  screenSpaceObjectives: ScreenSpaceObjective[];
  setScreenSpaceObjectives: (objectives: ScreenSpaceObjective[]) => void;

  // Compass navigation data
  compassData: CompassData;
  setCompassData: (data: CompassData) => void;

  // Tutorial phase (for control hints)
  tutorialPhase: TutorialPhase;
  setTutorialPhase: (phase: TutorialPhase) => void;
  isTutorialActive: boolean;
  setIsTutorialActive: (active: boolean) => void;

  // Difficulty settings
  difficulty: DifficultyLevel;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  difficultyModifiers: DifficultyModifiers;

  // Damage indicators (for DamageIndicators component)
  damageIndicators: DamageIndicator[];
  addDamageIndicator: (angle: number, damage: number) => void;
  removeDamageIndicator: (id: number) => void;
  hitMarkers: HitMarker[];
  addHitMarker: (damage: number, isCritical?: boolean) => void;
  removeHitMarker: (id: number) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [playerHealth, setPlayerHealthRaw] = useState(100);
  const [maxHealth] = useState(100);
  const [isPlayerDead, setIsPlayerDead] = useState(false);
  const [kills, setKills] = useState(0);
  const playerDeathCallbackRef = useRef<(() => void) | null>(null);
  const [missionText, setMissionText] = useState('DROP ZONE ALPHA');
  const [objectiveTitle, setObjectiveTitle] = useState('');
  const [objectiveInstructions, setObjectiveInstructions] = useState('');
  const [currentChapter, setCurrentChapter] = useState(2);
  const [touchInput, setTouchInput] = useState<TouchInput | null>(null);
  const [notification, setNotification] = useState<{ text: string; id: number } | null>(null);
  const [damageFlash, setDamageFlash] = useState(false);
  const [currentComms, setCurrentComms] = useState<CommsMessage | null>(null);
  const [commsDismissedFlag, setCommsDismissedFlag] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [inCombat, setInCombatState] = useState(false);
  const [actionGroups, setActionGroups] = useState<ActionButtonGroup[]>([]);
  const actionHandlerRef = useRef<((actionId: string) => void) | null>(null);
  const [hudVisibility, setHUDVisibilityState] = useState<HUDVisibility>(DEFAULT_HUD_VISIBILITY);
  const [objectiveMarker, setObjectiveMarker] = useState<ObjectiveMarker | null>(null);
  const [screenSpaceObjectives, setScreenSpaceObjectives] = useState<ScreenSpaceObjective[]>([]);
  const [compassData, setCompassData] = useState<CompassData>({ heading: 0 });
  const [tutorialPhase, setTutorialPhase] = useState<TutorialPhase>(0);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [damageIndicators, setDamageIndicators] = useState<DamageIndicator[]>([]);
  const [hitMarkers, setHitMarkers] = useState<HitMarker[]>([]);
  const damageIndicatorIdRef = useRef(0);
  const hitMarkerIdRef = useRef(0);

  // Difficulty state - load from localStorage on mount
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>(() => loadDifficultySetting());
  const [difficultyModifiers, setDifficultyModifiers] = useState<DifficultyModifiers>(() =>
    getDifficultyModifiers(loadDifficultySetting())
  );

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const damageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const combatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      if (damageTimeoutRef.current) clearTimeout(damageTimeoutRef.current);
      if (combatTimeoutRef.current) clearTimeout(combatTimeoutRef.current);
    };
  }, []);

  // Play music function
  const playMusic = useCallback((track: MusicTrack) => {
    getAudioManager().playMusic(track, 2);
  }, []);

  // Combat state management with auto-decay
  const setInCombat = useCallback(
    (value: boolean) => {
      setInCombatState(value);

      if (value) {
        // Start combat music
        playMusic('combat');

        // Clear any existing decay timeout
        if (combatTimeoutRef.current) clearTimeout(combatTimeoutRef.current);

        // Auto-decay combat after 8 seconds of no activity
        combatTimeoutRef.current = setTimeout(() => {
          setInCombatState(false);
          // Return to exploration music
          playMusic('exploration');
        }, 8000);
      }
    },
    [playMusic]
  );

  // Music based on chapter changes
  useEffect(() => {
    // Don't override combat music
    if (inCombat) return;

    switch (currentChapter) {
      case 1:
        // Tutorial/Anchor Station - ambient
        playMusic('ambient');
        break;
      case 2:
        // Surface - exploration
        playMusic('exploration');
        break;
      case 7:
        // Boss fight (The Breach - Queen)
        playMusic('boss');
        break;
      case 9:
        // Extraction holdout
        playMusic('exploration');
        break;
      case 10:
        // Final Escape / Victory
        playMusic('victory');
        break;
      default:
        playMusic('exploration');
    }
  }, [currentChapter, inCombat, playMusic]);

  const addKill = useCallback(() => {
    setKills((k) => k + 1);
    // Track kill for achievement progress
    getAchievementManager().onKill();
  }, []);

  // Clamped health setter that prevents negative health and detects death
  const setPlayerHealth = useCallback(
    (health: number) => {
      // Don't process health changes if player is already dead
      if (isPlayerDead) return;

      // Clamp health between 0 and maxHealth
      const clampedHealth = Math.max(0, Math.min(maxHealth, health));
      setPlayerHealthRaw(clampedHealth);

      // Trigger death if health reaches 0
      if (clampedHealth <= 0 && !isPlayerDead) {
        setIsPlayerDead(true);
        if (playerDeathCallbackRef.current) {
          playerDeathCallbackRef.current();
        }
      }
    },
    [isPlayerDead, maxHealth]
  );

  // Reset player health and death state (for restart)
  const resetPlayerHealth = useCallback(() => {
    setPlayerHealthRaw(maxHealth);
    setIsPlayerDead(false);
  }, [maxHealth]);

  // Set the death callback
  const setOnPlayerDeath = useCallback((callback: (() => void) | null) => {
    playerDeathCallbackRef.current = callback;
  }, []);

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
    console.log('[GameContext] showComms called:', message.text?.substring(0, 40));
    setCurrentComms(message);
  }, []);

  const hideComms = useCallback(() => {
    setCurrentComms(null);
    setCommsDismissedFlag((prev) => prev + 1);
  }, []);

  const onDamage = useCallback(() => {
    setDamageFlash(true);

    if (damageTimeoutRef.current) clearTimeout(damageTimeoutRef.current);

    damageTimeoutRef.current = setTimeout(() => setDamageFlash(false), 300);
  }, []);

  const triggerAction = useCallback((actionId: string) => {
    if (actionHandlerRef.current) {
      actionHandlerRef.current(actionId);
    }
  }, []);

  const setOnActionTriggered = useCallback((handler: ((actionId: string) => void) | null) => {
    actionHandlerRef.current = handler;
  }, []);

  // HUD visibility management - allows partial updates
  const setHUDVisibility = useCallback((visibility: Partial<HUDVisibility>) => {
    setHUDVisibilityState((prev) => ({
      ...prev,
      ...visibility,
    }));
  }, []);

  // Reset HUD to default (all visible) state
  const resetHUDVisibility = useCallback(() => {
    setHUDVisibilityState(DEFAULT_HUD_VISIBILITY);
  }, []);

  // Difficulty setter - persists to localStorage, updates modifiers, and syncs with save system
  const setDifficulty = useCallback((newDifficulty: DifficultyLevel) => {
    setDifficultyState(newDifficulty);
    setDifficultyModifiers(getDifficultyModifiers(newDifficulty));
    saveDifficultySetting(newDifficulty);
    // Import dynamically to avoid circular dependency
    import('../persistence/SaveSystem').then(({ saveSystem }) => {
      saveSystem.setDifficulty(newDifficulty);
    });
    console.log(`[GameContext] Difficulty set to ${newDifficulty}`);
  }, []);

  // Damage indicator management
  const addDamageIndicator = useCallback((angle: number, damage: number) => {
    const id = damageIndicatorIdRef.current++;
    setDamageIndicators((prev) => [...prev, { id, angle, damage, timestamp: performance.now() }]);
  }, []);

  const removeDamageIndicator = useCallback((id: number) => {
    setDamageIndicators((prev) => prev.filter((indicator) => indicator.id !== id));
  }, []);

  // Hit marker management
  const addHitMarker = useCallback((damage: number, isCritical = false) => {
    const id = hitMarkerIdRef.current++;
    setHitMarkers((prev) => [...prev, { id, damage, isCritical, timestamp: performance.now() }]);
  }, []);

  const removeHitMarker = useCallback((id: number) => {
    setHitMarkers((prev) => prev.filter((marker) => marker.id !== id));
  }, []);

  const value: GameContextType = {
    playerHealth,
    maxHealth,
    setPlayerHealth,
    isPlayerDead,
    resetPlayerHealth,
    onPlayerDeath: playerDeathCallbackRef.current,
    setOnPlayerDeath,
    kills,
    addKill,
    missionText,
    setMissionText,
    objectiveTitle,
    objectiveInstructions,
    setObjective,
    currentChapter,
    setCurrentChapter,
    touchInput,
    setTouchInput,
    showNotification,
    notification,
    showComms,
    hideComms,
    currentComms,
    commsDismissedFlag,
    onDamage,
    damageFlash,
    isCalibrating,
    setIsCalibrating,
    inCombat,
    setInCombat,
    playMusic,
    actionGroups,
    setActionGroups,
    triggerAction,
    onActionTriggered: actionHandlerRef.current,
    setOnActionTriggered,
    hudVisibility,
    setHUDVisibility,
    resetHUDVisibility,
    objectiveMarker,
    setObjectiveMarker,
    screenSpaceObjectives,
    setScreenSpaceObjectives,
    compassData,
    setCompassData,
    tutorialPhase,
    setTutorialPhase,
    isTutorialActive,
    setIsTutorialActive,
    difficulty,
    setDifficulty,
    difficultyModifiers,
    damageIndicators,
    addDamageIndicator,
    removeDamageIndicator,
    hitMarkers,
    addHitMarker,
    removeHitMarker,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
