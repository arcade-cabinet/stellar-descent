import { type ReactNode, useEffect } from 'react';
import { useCombatStore, playChapterMusic } from '../stores/useCombatStore';
import {
  useMissionStore,
  type CompassData,
  type ObjectiveMarker,
  type ScreenSpaceObjective,
} from '../stores/useMissionStore';
import { PlayerProvider, usePlayer } from './PlayerContext';

// Re-export types from mission store (was MissionContext)
export type { CompassData, ObjectiveMarker, ScreenSpaceObjective } from '../stores/useMissionStore';
export type { MissionStoreState as MissionContextType } from '../stores/useMissionStore';

/**
 * Access mission store as a hook (backward-compatible alias).
 * For new code, import useMissionStore directly.
 */
export function useMission() {
  return useMissionStore();
}

// Re-export all types and constants from sub-contexts for backward compatibility
export type { HUDVisibility, PlayerContextType } from './PlayerContext';
export { DEFAULT_HUD_VISIBILITY, TUTORIAL_START_HUD_VISIBILITY, usePlayer } from './PlayerContext';

/**
 * Facade hook that combines PlayerContext, mission store, and combat store
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
 * Composed provider that wraps PlayerProvider.
 * MissionContext and CombatContext have been replaced by Zustand stores.
 * Chapter-based music is handled by MusicBridge.
 */
export function GameProvider({ children }: GameProviderProps) {
  return (
    <PlayerProvider>
      <MusicBridge>{children}</MusicBridge>
    </PlayerProvider>
  );
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
