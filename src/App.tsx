import React, { useCallback, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { CommsDisplay } from './components/ui/CommsDisplay';
import { HUD } from './components/ui/HUD';
import { LoadingModal, type LoadingState } from './components/ui/LoadingModal';
import { MainMenu } from './components/ui/MainMenu';
import { TouchControls } from './components/ui/TouchControls';
import { GameProvider, useGame } from './game/context/GameContext';
import { getScreenInfo } from './game/utils/responsive';

// Game states - proper flow from menu through tutorial to combat
type GameState =
  | 'menu' // Main menu
  | 'loading' // Asset loading
  | 'tutorial' // Anchor Station tutorial
  | 'dropping' // HALO drop sequence
  | 'playing' // Surface combat
  | 'paused'
  | 'gameover';

function GameUI() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [skipTutorial, setSkipTutorial] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    stage: 'INITIALIZING',
    progress: 0,
  });
  const gameCanvasRef = useRef<{ startLoading: () => Promise<void> } | null>(null);

  const {
    playerHealth,
    maxHealth,
    kills,
    missionText,
    objectiveTitle,
    objectiveInstructions,
    setTouchInput,
    currentComms,
    hideComms,
    isCalibrating,
  } = useGame();

  const screenInfo = getScreenInfo();

  // Start with tutorial
  const handleStartGame = useCallback(() => {
    setSkipTutorial(false);
    setGameState('loading');
  }, []);

  // Skip tutorial - go straight to HALO drop
  const handleSkipTutorial = useCallback(() => {
    setSkipTutorial(true);
    setGameState('loading');
  }, []);

  const handleLoadComplete = useCallback(() => {
    if (skipTutorial) {
      // Skip straight to HALO drop
      setGameState('dropping');
    } else {
      // Start tutorial on Anchor Station
      setGameState('tutorial');
    }
  }, [skipTutorial]);

  const handleTutorialComplete = useCallback(() => {
    // Transition from tutorial to HALO drop
    setGameState('dropping');
  }, []);

  const handleDropComplete = useCallback(() => {
    // HALO drop finished, now playing on surface
    setGameState('playing');
  }, []);

  const handleRestart = useCallback(() => {
    setGameState('menu');
  }, []);

  const handleCommsDismiss = useCallback(() => {
    hideComms();
  }, [hideComms]);

  // Determine what HUD to show based on state
  const showCombatHUD = gameState === 'playing' || gameState === 'dropping';
  const showTutorialHUD = gameState === 'tutorial';

  return (
    <div className="game-container">
      {/* 3D Canvas - renders based on current state */}
      <GameCanvas
        gameState={gameState}
        onTutorialComplete={handleTutorialComplete}
        onDropComplete={handleDropComplete}
        onLoadingProgress={setLoadingState}
      />

      {/* Main Menu */}
      {gameState === 'menu' && (
        <MainMenu onStart={handleStartGame} onSkipTutorial={handleSkipTutorial} />
      )}

      {/* Loading Modal */}
      {gameState === 'loading' && (
        <LoadingModal
          isOpen={true}
          loadingState={loadingState}
          onLoadComplete={handleLoadComplete}
        />
      )}

      {/* Comms Display - shows during tutorial and gameplay */}
      {currentComms && (gameState === 'tutorial' || gameState === 'playing') && (
        <CommsDisplay isOpen={true} onClose={handleCommsDismiss} message={currentComms} />
      )}

      {/* Tutorial HUD - objective display */}
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
          {/* Crosshair for shooting range calibration */}
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

      {/* Combat HUD */}
      {showCombatHUD && (
        <>
          <HUD
            health={playerHealth}
            maxHealth={maxHealth}
            kills={kills}
            missionText={missionText}
          />
          {screenInfo.isTouchDevice && <TouchControls onInput={setTouchInput} />}
        </>
      )}

      {/* Game Over */}
      {gameState === 'gameover' && (
        <div className="gameover-overlay">
          <div className="gameover-content">
            <h1>MISSION FAILED</h1>
            <p>SPECTER DOWN - KIA</p>
            <button type="button" onClick={handleRestart}>RETURN TO BASE</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <GameProvider>
      <GameUI />
    </GameProvider>
  );
}
