import { type ReactNode, useEffect } from 'react';
import { MissionProvider, useMission } from './MissionContext';
import { PlayerProvider, usePlayer } from './PlayerContext';

import { useCombatStore, playChapterMusic } from '../stores/useCombatStore';

export type {
  CompassData,
  MissionContextType,
  ObjectiveMarker,
  ScreenSpaceObjective,
} from './MissionContext';
export { useMission } from './MissionContext';
// Re-export all types and constants from sub-contexts for backward compatibility
export type { HUDVisibility, PlayerContextType } from './PlayerContext';
export { DEFAULT_HUD_VISIBILITY, TUTORIAL_START_HUD_VISIBILITY, usePlayer } from './PlayerContext';

/**
 * Facade hook that combines PlayerContext, MissionContext, and combat store
 * for backward compatibility. Components that use useGame() will continue to work.
 *
 * For new code, prefer using the focused hooks:
 * - usePlayer() for health, death, difficulty, HUD, touch, tutorial
 * - useCombatStore() for kills, damage, combat state
 * - useMission() for objectives, comms, notifications, chapters
 */
export function useGame() {
  const player = usePlayer();
  const mission = useMission();
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
 * Composed provider that wraps PlayerProvider and MissionProvider.
 * CombatContext has been replaced by useCombatStore (Zustand).
 * Chapter-based music is handled by MusicBridge.
 */
export function GameProvider({ children }: GameProviderProps) {
  return (
    <PlayerProvider>
      <MissionProvider>
        <MusicBridge>{children}</MusicBridge>
      </MissionProvider>
    </PlayerProvider>
  );
}

/**
 * Bridge that plays chapter-based music when currentChapter changes.
 * Replaces the music logic that was in CombatContext/CombatBridge.
 */
function MusicBridge({ children }: { children: ReactNode }) {
  const { currentChapter } = useMission();

  useEffect(() => {
    playChapterMusic(currentChapter);
  }, [currentChapter]);

  return <>{children}</>;
}
