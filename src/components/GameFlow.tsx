/**
 * GameFlow - In-game screens and gameplay
 *
 * Handles:
 * - IntroBriefing (new game narrative intro)
 * - MissionBriefing (level objectives)
 * - LevelIntro (cinematic level start)
 * - Loading (asset loading progress)
 * - Tutorial (first-time controls)
 * - Playing (main gameplay with HUD + controls)
 * - Paused (pause menu)
 * - Death (game over screen)
 * - LevelComplete (stats + continue)
 */

import { useCallback, useEffect, useState } from 'react';
import { GameCanvas } from './GameCanvas';
import { CommsDisplay } from './ui/CommsDisplay';
import { ControlHints } from './ui/ControlHints';
import { DeathScreen } from './ui/DeathScreen';
import { HUD } from './ui/HUD';
import { IntroBriefing } from './ui/IntroBriefing';
import { LevelCompletionScreen } from './ui/LevelCompletionScreen';
import { LevelIntro } from './ui/LevelIntro';
import { LoadingModal, type LoadingState } from './ui/LoadingModal';
import { MissionBriefing } from './ui/MissionBriefing';
import { MobileTutorial } from './ui/MobileTutorial';
import { PauseMenu } from './ui/PauseMenu';
import { TouchControls } from './ui/TouchControls';
import { getAchievementManager } from '../game/achievements';
import type { CampaignCommand, CampaignPhase, CampaignSnapshot } from '../game/campaign/types';
import { useGame } from '../game/context/GameContext';
import { CAMPAIGN_LEVELS, type LevelId } from '../game/levels/types';
import { saveSystem } from '../game/persistence';

interface GameFlowProps {
  snapshot: CampaignSnapshot;
  dispatch: (cmd: CampaignCommand) => void;
  isTouchDevice: boolean;
}

/**
 * Phases that require the 3D canvas to be mounted
 */
const PHASES_NEEDING_3D: Set<CampaignPhase> = new Set([
  'loading', 'tutorial', 'dropping', 'playing', 'paused',
]);

/**
 * Game flow phases that this component handles
 */
const GAME_PHASES: Set<CampaignPhase> = new Set([
  'introBriefing', 'briefing', 'intro', 'loading',
  'tutorial', 'dropping', 'playing', 'paused',
  'gameover', 'levelComplete',
]);

export function isGamePhase(phase: CampaignPhase): boolean {
  return GAME_PHASES.has(phase);
}

export function GameFlow({ snapshot, dispatch, isTouchDevice }: GameFlowProps) {
  const phase = snapshot.phase;
  const currentLevelId = snapshot.currentLevelId;

  // Loading state for progress UI
  const [loadingState, setLoadingState] = useState<LoadingState>({
    stage: 'INITIALIZING',
    progress: 0,
  });

  // Mobile tutorial overlay state
  const [showMobileTutorial, setShowMobileTutorial] = useState(false);

  // Game context for HUD data
  const {
    playerHealth, maxHealth, kills, missionText,
    objectiveTitle, objectiveInstructions,
    setTouchInput, currentComms, hideComms,
    isCalibrating, tutorialPhase, isTutorialActive,
  } = useGame();

  // Show mobile tutorial when entering tutorial phase on touch devices
  useEffect(() => {
    if (phase === 'tutorial' && isTouchDevice) {
      setShowMobileTutorial(true);
    }
  }, [phase, isTouchDevice]);

  // Dispatch helpers
  const handlePause = useCallback(() => dispatch({ type: 'PAUSE' }), [dispatch]);
  const handleCommsDismiss = useCallback(() => hideComms(), [hideComms]);

  // Derived state
  const needs3D = PHASES_NEEDING_3D.has(phase);
  const showCombatHUD = phase === 'playing' || phase === 'dropping';
  const showTutorialHUD = phase === 'tutorial';

  // Only render if we're in a game phase
  if (!isGamePhase(phase)) {
    return null;
  }

  return (
    <>
      {/* 3D Canvas - only mounted when needed */}
      {needs3D && (
        <GameCanvas
          key={snapshot.restartCounter}
          gameState={phase}
          startLevelId={currentLevelId}
          onTutorialComplete={() => dispatch({ type: 'TUTORIAL_COMPLETE' })}
          onDropComplete={() => dispatch({ type: 'DROP_COMPLETE' })}
          onLoadingProgress={setLoadingState}
          onLevelChange={(levelId: LevelId) => saveSystem.setCurrentLevel(levelId)}
          onLevelComplete={() => {
            const timeElapsed = (Date.now() - snapshot.levelStartTime) / 1000;
            const levelStats = getAchievementManager().getLevelStats();
            const levelConfig = CAMPAIGN_LEVELS[currentLevelId];
            dispatch({
              type: 'LEVEL_COMPLETE',
              stats: {
                timeElapsed,
                kills: levelStats.kills || snapshot.levelKills,
                shotsFired: levelStats.shotsFired,
                shotsHit: levelStats.shotsHit,
                secretsFound: levelStats.secretsFound,
                totalSecrets: levelConfig?.totalSecrets ?? 0,
              },
            });
          }}
        />
      )}

      {/* Intro Briefing (new game narrative) */}
      {phase === 'introBriefing' && (
        <IntroBriefing onComplete={() => dispatch({ type: 'INTRO_BRIEFING_COMPLETE' })} />
      )}

      {/* Mission Briefing */}
      {phase === 'briefing' && (
        <MissionBriefing
          isOpen={true}
          levelId={currentLevelId}
          onBeginMission={() => dispatch({ type: 'BEGIN_MISSION' })}
          onCancel={() => dispatch({ type: 'MAIN_MENU' })}
        />
      )}

      {/* Level Intro Cinematic */}
      {phase === 'intro' && (
        <LevelIntro
          isOpen={true}
          levelId={currentLevelId}
          onComplete={() => dispatch({ type: 'INTRO_COMPLETE' })}
        />
      )}

      {/* Loading Modal */}
      {phase === 'loading' && (
        <LoadingModal
          isOpen={true}
          loadingState={loadingState}
          onLoadComplete={() => dispatch({ type: 'LOADING_COMPLETE' })}
          levelId={currentLevelId}
        />
      )}

      {/* Comms Display */}
      {currentComms && (phase === 'tutorial' || phase === 'playing') && (
        <CommsDisplay isOpen={true} onClose={handleCommsDismiss} message={currentComms} />
      )}

      {/* Tutorial HUD */}
      {showTutorialHUD && (
        <div className="tutorial-hud">
          {objectiveTitle && (
            <div className="objective-display">
              <div className="objective-title">{objectiveTitle}</div>
              {objectiveInstructions && (
                <div className="objective-instructions">{objectiveInstructions}</div>
              )}
            </div>
          )}
          {isCalibrating && (
            <div className="calibration-crosshair">
              <div className="crosshair-dot" />
              <div className="crosshair-line top" />
              <div className="crosshair-line bottom" />
              <div className="crosshair-line left" />
              <div className="crosshair-line right" />
            </div>
          )}
        </div>
      )}

      {/* Mobile Tutorial */}
      {showTutorialHUD && showMobileTutorial && (
        <MobileTutorial onComplete={() => setShowMobileTutorial(false)} />
      )}

      {/* Touch Controls for tutorial */}
      {showTutorialHUD && isTouchDevice && !showMobileTutorial && (
        <TouchControls onInput={setTouchInput} onPause={handlePause} />
      )}

      {/* Desktop Control Hints */}
      {showTutorialHUD && !isTouchDevice && (
        <ControlHints tutorialPhase={tutorialPhase} isActive={isTutorialActive} />
      )}

      {/* Combat HUD */}
      {showCombatHUD && (
        <>
          <HUD health={playerHealth} maxHealth={maxHealth} kills={kills} missionText={missionText} />
          {isTouchDevice && <TouchControls onInput={setTouchInput} onPause={handlePause} />}
        </>
      )}

      {/* Death Screen */}
      {phase === 'gameover' && (
        <DeathScreen
          onRestartMission={() => dispatch({ type: 'RETRY' })}
          onMainMenu={() => dispatch({ type: 'MAIN_MENU' })}
          deathReason="SPECTER DOWN - KIA"
          missionName={CAMPAIGN_LEVELS[currentLevelId]?.missionName ?? 'CURRENT MISSION'}
        />
      )}

      {/* Pause Menu */}
      {phase === 'paused' && (
        <PauseMenu
          onResume={() => dispatch({ type: 'RESUME' })}
          onMainMenu={() => dispatch({ type: 'MAIN_MENU' })}
          onRestartLevel={() => dispatch({ type: 'RETRY' })}
          missionName={CAMPAIGN_LEVELS[currentLevelId]?.missionName ?? 'CURRENT MISSION'}
          currentLevelId={currentLevelId}
          objectiveTitle={objectiveTitle}
          objectiveInstructions={objectiveInstructions}
        />
      )}

      {/* Level Completion Screen */}
      {phase === 'levelComplete' && snapshot.completionStats && (
        <LevelCompletionScreen
          onContinue={() => dispatch({ type: 'ADVANCE' })}
          onRetry={() => dispatch({ type: 'RETRY' })}
          onMainMenu={() => dispatch({ type: 'MAIN_MENU' })}
          levelId={currentLevelId}
          missionName={CAMPAIGN_LEVELS[currentLevelId]?.missionName ?? 'MISSION'}
          stats={snapshot.completionStats}
          isFinalLevel={!CAMPAIGN_LEVELS[currentLevelId]?.nextLevelId}
        />
      )}
    </>
  );
}
