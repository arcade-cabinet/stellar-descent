import { type ReactNode, useEffect, useMemo } from 'react';
import { useCombatStore, playChapterMusic } from '../stores/useCombatStore';
import {
  useMissionStore,
  type CompassData,
  type ObjectiveMarker,
  type ScreenSpaceObjective,
} from '../stores/useMissionStore';
import {
  usePlayerStore,
  type HUDVisibility,
  DEFAULT_HUD_VISIBILITY,
  TUTORIAL_START_HUD_VISIBILITY,
} from '../stores/usePlayerStore';
import {
  type DifficultyLevel,
  type DifficultyModifiers,
  getDifficultyModifiers,
  useDifficultyStore,
} from '../difficulty';
import { getLogger } from '../core/Logger';

const log = getLogger('GameContext');

// Re-export types from mission store (was MissionContext)
export type { CompassData, ObjectiveMarker, ScreenSpaceObjective } from '../stores/useMissionStore';
export type { MissionStoreState as MissionContextType } from '../stores/useMissionStore';

// Re-export types from player store (was PlayerContext)
export type { HUDVisibility } from '../stores/usePlayerStore';
export { DEFAULT_HUD_VISIBILITY, TUTORIAL_START_HUD_VISIBILITY } from '../stores/usePlayerStore';

/**
 * PlayerContextType - Backward-compatible type for code that referenced
 * the old PlayerContext interface.
 */
export interface PlayerContextType {
  playerHealth: number;
  maxHealth: number;
  setPlayerHealth: (health: number) => void;
  isPlayerDead: boolean;
  resetPlayerHealth: () => void;
  onPlayerDeath: (() => void) | null;
  setOnPlayerDeath: (callback: (() => void) | null) => void;
  touchInput: import('../types').TouchInput | null;
  setTouchInput: (input: import('../types').TouchInput | null) => void;
  tutorialPhase: import('../levels/anchor-station/tutorialSteps').TutorialPhase;
  setTutorialPhase: (phase: import('../levels/anchor-station/tutorialSteps').TutorialPhase) => void;
  isTutorialActive: boolean;
  setIsTutorialActive: (active: boolean) => void;
  difficulty: DifficultyLevel;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  difficultyModifiers: DifficultyModifiers;
  hudVisibility: HUDVisibility;
  setHUDVisibility: (visibility: Partial<HUDVisibility>) => void;
  resetHUDVisibility: () => void;
}

// Module-scoped stable function for setDifficulty with persistence
function setDifficultyWithPersistence(newDifficulty: DifficultyLevel) {
  useDifficultyStore.getState().setDifficulty(newDifficulty);
  import('../persistence/SaveSystem').then(({ saveSystem }) => {
    saveSystem.setDifficulty(newDifficulty);
  });
  log.info(`Difficulty set to ${newDifficulty}`);
}

/**
 * Access combined player state from Zustand stores.
 * Backward-compatible replacement for the old PlayerContext hook.
 *
 * For new code, prefer importing from focused stores directly:
 * - usePlayerStore() for health, death, HUD, touch, tutorial
 * - useDifficultyStore() for difficulty settings
 */
export function usePlayer(): PlayerContextType {
  const store = usePlayerStore();
  const difficulty = useDifficultyStore((s) => s.difficulty);
  const difficultyModifiers = useMemo(() => getDifficultyModifiers(difficulty), [difficulty]);

  return {
    playerHealth: store.health,
    maxHealth: store.maxHealth,
    setPlayerHealth: store.setPlayerHealth,
    isPlayerDead: store.isDead,
    resetPlayerHealth: store.resetPlayerHealth,
    onPlayerDeath: null,
    setOnPlayerDeath: store.setOnPlayerDeath,
    touchInput: store.touchInput,
    setTouchInput: store.setTouchInput,
    tutorialPhase: store.tutorialPhase,
    setTutorialPhase: store.setTutorialPhase,
    isTutorialActive: store.isTutorialActive,
    setIsTutorialActive: store.setIsTutorialActive,
    difficulty,
    setDifficulty: setDifficultyWithPersistence,
    difficultyModifiers,
    hudVisibility: store.hudVisibility,
    setHUDVisibility: store.setHUDVisibility,
    resetHUDVisibility: store.resetHUDVisibility,
  };
}

/**
 * Access mission store as a hook (backward-compatible alias).
 * For new code, import useMissionStore directly.
 */
export function useMission() {
  return useMissionStore();
}

/**
 * Facade hook that combines player store, mission store, and combat store
 * for backward compatibility. Components that use useGame() will continue to work.
 *
 * For new code, prefer using the focused hooks:
 * - usePlayer() for health, death, difficulty, HUD, touch, tutorial
 * - useCombatStore() for kills, damage, combat state
 * - useMissionStore() for objectives, comms, notifications, chapters
 */
export function useGame() {
  const player = usePlayer();
  const mission = useMissionStore();
  const combatStore = useCombatStore();

  return {
    ...player,
    ...mission,
    // Combat fields from Zustand store (was CombatContext)
    kills: combatStore.kills,
    addKill: combatStore.addKill,
    isCalibrating: combatStore.isCalibrating,
    setIsCalibrating: combatStore.setIsCalibrating,
    inCombat: combatStore.inCombat,
    setInCombat: combatStore.setInCombat,
  };
}

interface GameProviderProps {
  children: ReactNode;
}

/**
 * Composed provider for backward compatibility.
 * All state is now in Zustand stores; this just provides the MusicBridge effect.
 */
export function GameProvider({ children }: GameProviderProps) {
  return <MusicBridge>{children}</MusicBridge>;
}

/**
 * Bridge that plays chapter-based music when currentChapter changes.
 * Reads from mission store (was MissionContext).
 */
function MusicBridge({ children }: { children: ReactNode }) {
  const currentChapter = useMissionStore((s) => s.currentChapter);

  useEffect(() => {
    playChapterMusic(currentChapter);
  }, [currentChapter]);

  return <>{children}</>;
}
