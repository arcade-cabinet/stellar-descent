import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_DIFFICULTY,
  type DifficultyLevel,
  type DifficultyModifiers,
  getDifficultyModifiers,
  loadDifficultySetting,
  saveDifficultySetting,
} from '../core/DifficultySettings';
import type { TutorialPhase } from '../levels/anchor-station/tutorialSteps';
import type { TouchInput } from '../types';

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

export interface PlayerContextType {
  // Player state
  playerHealth: number;
  maxHealth: number;
  setPlayerHealth: (health: number) => void;
  isPlayerDead: boolean;
  resetPlayerHealth: () => void;
  onPlayerDeath: (() => void) | null;
  setOnPlayerDeath: (callback: (() => void) | null) => void;

  // Touch input
  touchInput: TouchInput | null;
  setTouchInput: (input: TouchInput | null) => void;

  // Tutorial phase (for control hints)
  tutorialPhase: TutorialPhase;
  setTutorialPhase: (phase: TutorialPhase) => void;
  isTutorialActive: boolean;
  setIsTutorialActive: (active: boolean) => void;

  // Difficulty settings
  difficulty: DifficultyLevel;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  difficultyModifiers: DifficultyModifiers;

  // HUD visibility (progressive unlocking)
  hudVisibility: HUDVisibility;
  setHUDVisibility: (visibility: Partial<HUDVisibility>) => void;
  resetHUDVisibility: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

interface PlayerProviderProps {
  children: ReactNode;
}

export function PlayerProvider({ children }: PlayerProviderProps) {
  const [playerHealth, setPlayerHealthRaw] = useState(100);
  const [maxHealth] = useState(100);
  const [isPlayerDead, setIsPlayerDead] = useState(false);
  const playerDeathCallbackRef = useRef<(() => void) | null>(null);
  const [touchInput, setTouchInput] = useState<TouchInput | null>(null);
  const [tutorialPhase, setTutorialPhase] = useState<TutorialPhase>(0);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [hudVisibility, setHUDVisibilityState] = useState<HUDVisibility>(DEFAULT_HUD_VISIBILITY);

  // Difficulty state - load from localStorage on mount
  const [difficulty, setDifficultyState] = useState<DifficultyLevel>(() => loadDifficultySetting());
  const [difficultyModifiers, setDifficultyModifiers] = useState<DifficultyModifiers>(() =>
    getDifficultyModifiers(loadDifficultySetting())
  );

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

  // Difficulty setter - persists to localStorage, updates modifiers, and syncs with save system
  const setDifficulty = useCallback((newDifficulty: DifficultyLevel) => {
    setDifficultyState(newDifficulty);
    setDifficultyModifiers(getDifficultyModifiers(newDifficulty));
    saveDifficultySetting(newDifficulty);
    // Import dynamically to avoid circular dependency
    import('../persistence/SaveSystem').then(({ saveSystem }) => {
      saveSystem.setDifficulty(newDifficulty);
    });
    console.log(`[PlayerContext] Difficulty set to ${newDifficulty}`);
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

  const value: PlayerContextType = {
    playerHealth,
    maxHealth,
    setPlayerHealth,
    isPlayerDead,
    resetPlayerHealth,
    onPlayerDeath: playerDeathCallbackRef.current,
    setOnPlayerDeath,
    touchInput,
    setTouchInput,
    tutorialPhase,
    setTutorialPhase,
    isTutorialActive,
    setIsTutorialActive,
    difficulty,
    setDifficulty,
    difficultyModifiers,
    hudVisibility,
    setHUDVisibility,
    resetHUDVisibility,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
