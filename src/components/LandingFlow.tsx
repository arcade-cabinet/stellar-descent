/**
 * LandingFlow - Pre-game screens before mission begins
 *
 * Handles:
 * - SplashScreen (video)
 * - TitleSequence (typing briefing + title reveal)
 * - MainMenu (level selection, continue, new game)
 *
 * Returns control to parent when user starts a game.
 */

import { MainMenu } from './ui/MainMenu';
import { SplashScreen } from './ui/SplashScreen';
import { TitleSequence } from './ui/TitleSequence';
import type { CampaignCommand, CampaignPhase } from '../game/campaign/types';
import type { DifficultyLevel } from '../game/core/DifficultySettings';
import type { LevelId } from '../game/levels/types';

interface LandingFlowProps {
  phase: CampaignPhase;
  dispatch: (cmd: CampaignCommand) => void;
  isTouchDevice?: boolean;
}

/**
 * Landing flow phases that this component handles
 */
const LANDING_PHASES: Set<CampaignPhase> = new Set([
  'idle', 'splash', 'title', 'menu',
]);

export function isLandingPhase(phase: CampaignPhase): boolean {
  return LANDING_PHASES.has(phase);
}

export function LandingFlow({ phase, dispatch, isTouchDevice = false }: LandingFlowProps) {
  // Handle the initial 'idle' phase as splash
  const effectivePhase = phase === 'idle' ? 'splash' : phase;

  // Only render if we're in a landing phase
  if (!isLandingPhase(phase)) {
    return null;
  }

  return (
    <>
      {/* Splash Screen */}
      {effectivePhase === 'splash' && (
        <SplashScreen onComplete={() => dispatch({ type: 'SPLASH_COMPLETE' })} />
      )}

      {/* Title Sequence */}
      {effectivePhase === 'title' && (
        <TitleSequence
          onComplete={() => dispatch({ type: 'TITLE_COMPLETE' })}
          isTouchDevice={isTouchDevice}
        />
      )}

      {/* Main Menu */}
      {effectivePhase === 'menu' && (
        <MainMenu
          onStart={() => dispatch({ type: 'NEW_GAME' })}
          onNewGame={(difficulty: DifficultyLevel, startLevel: LevelId) =>
            dispatch({ type: 'NEW_GAME', difficulty, startLevel })
          }
          onContinue={() => dispatch({ type: 'CONTINUE' })}
          onSelectLevel={(levelId: LevelId) => dispatch({ type: 'SELECT_LEVEL', levelId })}
          onReplayTitle={() => dispatch({ type: 'SPLASH_COMPLETE' })}
        />
      )}
    </>
  );
}
