import type { ReactNode } from 'react';
import { CombatProvider, useCombat } from './CombatContext';
import { MissionProvider, useMission } from './MissionContext';
import { PlayerProvider, usePlayer } from './PlayerContext';

export type { CombatContextType } from './CombatContext';
export { useCombat } from './CombatContext';
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
 * Facade hook that combines all three contexts for backward compatibility.
 * Components that use useGame() will continue to work without changes.
 *
 * For new code, prefer using the focused hooks:
 * - usePlayer() for health, death, difficulty, HUD, touch, tutorial
 * - useCombat() for kills, damage, combat state, music
 * - useMission() for objectives, comms, notifications, chapters
 */
export function useGame() {
  const player = usePlayer();
  const combat = useCombat();
  const mission = useMission();

  return {
    ...player,
    ...combat,
    ...mission,
  };
}

interface GameProviderProps {
  children: ReactNode;
}

/**
 * Composed provider that wraps PlayerProvider, CombatProvider, and MissionProvider.
 * MissionProvider is the outermost so that currentChapter can be passed down to CombatProvider
 * for the music-based-on-chapter logic.
 *
 * We use an inner component to bridge currentChapter from MissionContext to CombatProvider.
 */
export function GameProvider({ children }: GameProviderProps) {
  return (
    <PlayerProvider>
      <MissionProvider>
        <CombatBridge>{children}</CombatBridge>
      </MissionProvider>
    </PlayerProvider>
  );
}

/**
 * Inner bridge component that reads currentChapter from MissionContext
 * and passes it to CombatProvider (which needs it for chapter-based music).
 */
function CombatBridge({ children }: { children: ReactNode }) {
  const { currentChapter } = useMission();
  return <CombatProvider currentChapter={currentChapter}>{children}</CombatProvider>;
}
