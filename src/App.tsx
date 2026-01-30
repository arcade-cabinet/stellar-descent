import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas, type GameState } from './components/GameCanvas';
import { AchievementPopup } from './components/ui/AchievementPopup';
import { CommsDisplay } from './components/ui/CommsDisplay';
import { ControlHints } from './components/ui/ControlHints';
import { CreditsSequence } from './components/ui/CreditsSequence';
import { DeathScreen } from './components/ui/DeathScreen';
import { HUD } from './components/ui/HUD';
import { InstallPrompt, useInstallPrompt } from './components/ui/InstallPrompt';
import { LandscapeEnforcer } from './components/ui/LandscapeEnforcer';
import { LevelCompletionScreen, type LevelStats } from './components/ui/LevelCompletionScreen';
import { LevelIntro } from './components/ui/LevelIntro';
import { LoadingModal, type LoadingState } from './components/ui/LoadingModal';
import { MainMenu } from './components/ui/MainMenu';
import { MissionBriefing } from './components/ui/MissionBriefing';
import { MobileTutorial } from './components/ui/MobileTutorial';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { PauseMenu } from './components/ui/PauseMenu';
import { PWAUpdatePrompt } from './components/ui/PWAUpdatePrompt';
import { SubtitleDisplay } from './components/ui/SubtitleDisplay';
import { TitleSequence } from './components/ui/TitleSequence';
import { TouchControls } from './components/ui/TouchControls';
import { initAchievements } from './game/achievements';
import { GameProvider, useGame } from './game/context/GameContext';
import { KeybindingsProvider, useKeybindings } from './game/context/KeybindingsContext';
import { SettingsProvider } from './game/context/SettingsContext';
import { SubtitleProvider } from './game/context/SubtitleContext';
import { WeaponProvider } from './game/context/WeaponContext';
import { useCommsSubtitles } from './game/hooks/useCommsSubtitles';
import { CAMPAIGN_LEVELS, type LevelId } from './game/levels/types';
import { saveSystem } from './game/persistence';
import { usePWA } from './hooks/usePWA';
import { useSavePersistence } from './hooks/useSavePersistence';

// Key for localStorage to track if title sequence has been shown this session
const TITLE_SHOWN_KEY = 'stellar_descent_title_shown';

/**
 * Detect touch capability - works on ALL touch devices including foldables
 * Uses multiple detection methods for maximum compatibility:
 * - 'ontouchstart' in window: Standard touch event support
 * - navigator.maxTouchPoints > 0: Modern API, works even before touch events fire
 * - matchMedia('(pointer: coarse)'): CSS media query for touch-primary devices
 */
function detectTouchCapability(): boolean {
  // Primary detection: touch event support or touch points
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Secondary detection: CSS media query for coarse pointer (touch)
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

  // Tertiary detection: any-pointer coarse (device has at least one touch input)
  const hasAnyCoarsePointer = window.matchMedia?.('(any-pointer: coarse)')?.matches ?? false;

  return hasTouch || hasCoarsePointer || hasAnyCoarsePointer;
}

// Initialize achievement system
initAchievements();

// Valid level IDs for URL-based selection (dev/testing)
const VALID_LEVELS: LevelId[] = [
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
];

/**
 * Parse URL parameters for dev/testing level selection
 * Usage: ?level=fob_delta
 */
function getStartLevelFromURL(): LevelId | null {
  const params = new URLSearchParams(window.location.search);
  const levelParam = params.get('level');
  if (levelParam && VALID_LEVELS.includes(levelParam as LevelId)) {
    return levelParam as LevelId;
  }
  return null;
}

function GameUI() {
  // Check if title sequence should be shown on initial load (fresh session, no save)
  const getInitialGameState = (): GameState => {
    // Skip title if URL has level param (dev mode)
    if (getStartLevelFromURL()) return 'menu';
    // Skip title if already shown this session
    if (sessionStorage.getItem(TITLE_SHOWN_KEY)) return 'menu';
    // Show title for fresh visits
    return 'title';
  };

  const [gameState, setGameState] = useState<GameState>(getInitialGameState);
  const [skipTutorial, setSkipTutorial] = useState(false);
  const [startLevelId, setStartLevelId] = useState<LevelId | null>(null);
  const [currentLevelId, setCurrentLevelId] = useState<LevelId>('anchor_station');
  const [restartKey, setRestartKey] = useState(0); // Used to force remount of GameCanvas
  const [loadingState, setLoadingState] = useState<LoadingState>({
    stage: 'INITIALIZING',
    progress: 0,
  });
  const [showMobileTutorial, setShowMobileTutorial] = useState(false);

  // Level completion state
  const [completionStats, setCompletionStats] = useState<LevelStats | null>(null);
  const levelStartTimeRef = useRef<number>(Date.now());

  // PWA state and actions
  const {
    isOffline,
    isOfflineReady,
    needsUpdate,
    updateServiceWorker,
    dismissOfflineReady,
    dismissUpdate,
  } = usePWA();

  // PWA save persistence - auto-saves on page unload/visibility change
  useSavePersistence();

  // PWA Install Prompt - triggered after tutorial completion
  const {
    shouldTrigger: shouldShowInstallPrompt,
    triggerPrompt: triggerInstallPrompt,
    resetTrigger: resetInstallPromptTrigger,
    isStandalone,
  } = useInstallPrompt();

  // Check URL for dev/testing level selection
  useEffect(() => {
    const urlLevel = getStartLevelFromURL();
    if (urlLevel) {
      console.log(`[Dev] Starting level from URL: ${urlLevel}`);
      setStartLevelId(urlLevel);
      // Auto-start loading for the specified level
      if (urlLevel === 'anchor_station') {
        setSkipTutorial(false);
      } else if (urlLevel === 'landfall') {
        setSkipTutorial(true);
      } else {
        // For levels 3-6, we need different handling
        setSkipTutorial(true);
      }
      setGameState('loading');
    }
  }, []);

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
    isPlayerDead,
    resetPlayerHealth,
    setOnPlayerDeath,
    tutorialPhase,
    isTutorialActive,
  } = useGame();

  const { isKeyBound } = useKeybindings();

  // Sync comms messages with subtitle system
  useCommsSubtitles();

  // Track the pre-pause game state to resume correctly
  const [prePauseState, setPrePauseState] = useState<GameState | null>(null);

  // Robust touch detection - uses multiple methods for foldables/tablets
  // This is a separate state from screenInfo to ensure touch controls appear
  // on ALL touch devices regardless of screen size classification
  const [isTouchDevice, setIsTouchDevice] = useState(() => detectTouchCapability());

  // Update touch detection on resize/orientation change
  useEffect(() => {
    const updateTouchDetection = () => {
      setIsTouchDevice(detectTouchCapability());
    };

    // Listen for resize and orientation changes (foldable state changes)
    window.addEventListener('resize', updateTouchDetection);
    window.addEventListener('orientationchange', updateTouchDetection);

    // Also detect touch on first touch event (fallback for some browsers)
    const handleFirstTouch = () => {
      setIsTouchDevice(true);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
    window.addEventListener('touchstart', handleFirstTouch, { once: true, passive: true });

    return () => {
      window.removeEventListener('resize', updateTouchDetection);
      window.removeEventListener('orientationchange', updateTouchDetection);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
  }, []);

  // Track whether to show briefing before loading
  const [briefingLevelId, setBriefingLevelId] = useState<LevelId | null>(null);

  // Handle title sequence completion
  const handleTitleComplete = useCallback(() => {
    // Mark title as shown for this session
    sessionStorage.setItem(TITLE_SHOWN_KEY, 'true');
    setGameState('menu');
  }, []);

  // Replay title sequence from menu
  const handleReplayTitle = useCallback(() => {
    setGameState('title');
  }, []);

  // Start with tutorial (new game) - show briefing first
  const handleStartGame = useCallback(() => {
    setSkipTutorial(false);
    setCurrentLevelId('anchor_station');
    setBriefingLevelId('anchor_station');
    setGameState('briefing');
  }, []);

  // Continue from saved game - show briefing for current level
  const handleContinue = useCallback(() => {
    const save = saveSystem.getCurrentSave();
    if (save) {
      const levelId = save.currentLevel;
      setStartLevelId(levelId);
      setCurrentLevelId(levelId);
      setSkipTutorial(save.tutorialCompleted);
      setRestartKey((k) => k + 1);
      setBriefingLevelId(levelId);
      setGameState('briefing');
    }
  }, []);

  // Skip tutorial - go straight to HALO drop (show briefing first)
  const handleSkipTutorial = useCallback(() => {
    setSkipTutorial(true);
    setStartLevelId('landfall');
    setCurrentLevelId('landfall');
    setBriefingLevelId('landfall');
    setGameState('briefing');
  }, []);

  const handleLoadComplete = useCallback(() => {
    // If a specific level was requested via URL, use appropriate state
    if (startLevelId) {
      switch (startLevelId) {
        case 'anchor_station':
          setGameState('tutorial');
          // Show mobile tutorial on touch devices at start of Anchor Station
          if (isTouchDevice) {
            setShowMobileTutorial(true);
          }
          break;
        case 'landfall':
          setGameState('dropping');
          break;
        case 'canyon_run':
        case 'fob_delta':
        case 'brothers_in_arms':
        case 'southern_ice':
        case 'the_breach':
        case 'hive_assault':
        case 'extraction':
        case 'final_escape':
          // These levels go straight to playing state
          setGameState('playing');
          break;
        default:
          setGameState('tutorial');
      }
      return;
    }

    if (skipTutorial) {
      // Skip straight to HALO drop
      setGameState('dropping');
    } else {
      // Start tutorial on Anchor Station
      setGameState('tutorial');
      // Show mobile tutorial on touch devices at start of Anchor Station
      if (isTouchDevice) {
        setShowMobileTutorial(true);
      }
    }
  }, [skipTutorial, startLevelId, isTouchDevice]);

  // Handle mobile tutorial completion
  const handleMobileTutorialComplete = useCallback(() => {
    setShowMobileTutorial(false);
  }, []);

  const handleTutorialComplete = useCallback(() => {
    // Transition from tutorial to HALO drop
    setGameState('dropping');
    // Trigger PWA install prompt after completing tutorial (good engagement point)
    // Small delay to let the transition settle
    setTimeout(() => {
      triggerInstallPrompt();
    }, 2000);
  }, [triggerInstallPrompt]);

  const handleDropComplete = useCallback(() => {
    // HALO drop finished, now playing on surface
    setGameState('playing');
    // Reset level start time for stats tracking
    levelStartTimeRef.current = Date.now();
  }, []);

  // Handle level completion - show completion screen with stats
  const handleLevelComplete = useCallback(() => {
    // Calculate stats for the completed level
    const timeElapsed = (Date.now() - levelStartTimeRef.current) / 1000;
    const stats: LevelStats = {
      timeElapsed,
      kills,
      shotsFired: 0, // TODO: Track shots fired
      shotsHit: 0, // TODO: Track shots hit
      secretsFound: 0, // TODO: Track secrets
      totalSecrets: 0,
    };
    setCompletionStats(stats);

    // Mark level as complete in save system
    saveSystem.completeLevel(currentLevelId);

    setGameState('levelComplete');
  }, [kills, currentLevelId]);

  // Continue to next level from completion screen
  const handleContinueToNextLevel = useCallback(() => {
    const levelConfig = CAMPAIGN_LEVELS[currentLevelId];
    const nextLevelId = levelConfig?.nextLevelId;

    if (nextLevelId) {
      // Reset stats for new level
      levelStartTimeRef.current = Date.now();
      setCompletionStats(null);

      // Set up next level
      setStartLevelId(nextLevelId);
      setCurrentLevelId(nextLevelId);
      setRestartKey((k) => k + 1);
      setBriefingLevelId(nextLevelId);
      setGameState('briefing');
    } else {
      // Final level complete - show credits
      setGameState('credits');
    }
  }, [currentLevelId]);

  // Credits complete - return to menu
  const handleCreditsComplete = useCallback(() => {
    setCompletionStats(null);
    resetPlayerHealth();
    setRestartKey((k) => k + 1);
    setStartLevelId(null);
    setCurrentLevelId('anchor_station');
    setGameState('menu');
  }, [resetPlayerHealth]);

  // Retry current level from completion screen
  const handleRetryLevel = useCallback(() => {
    setCompletionStats(null);
    levelStartTimeRef.current = Date.now();
    resetPlayerHealth();
    setRestartKey((k) => k + 1);
    setStartLevelId(currentLevelId);
    setGameState('loading');
  }, [currentLevelId, resetPlayerHealth]);

  // Return to main menu (resets everything)
  const handleMainMenu = useCallback(() => {
    resetPlayerHealth();
    setRestartKey((k) => k + 1); // Force GameCanvas remount
    setStartLevelId(null);
    setCurrentLevelId('anchor_station');
    setGameState('menu');
  }, [resetPlayerHealth]);

  // Restart current mission (reloads current level)
  const handleRestartMission = useCallback(() => {
    resetPlayerHealth();
    setRestartKey((k) => k + 1); // Force GameCanvas remount
    // Preserve current level for restart
    setStartLevelId(currentLevelId);
    setGameState('loading');
  }, [resetPlayerHealth, currentLevelId]);

  // Track current level when it changes and update save system
  const handleLevelChange = useCallback((levelId: LevelId) => {
    setCurrentLevelId(levelId);
    saveSystem.setCurrentLevel(levelId);
  }, []);

  // Handle level selection from level select screen - show briefing first
  const handleSelectLevel = useCallback((levelId: LevelId) => {
    setStartLevelId(levelId);
    setCurrentLevelId(levelId);
    setSkipTutorial(levelId !== 'anchor_station');
    setRestartKey((k) => k + 1);
    setBriefingLevelId(levelId);
    setGameState('briefing');
  }, []);

  // Begin mission from briefing screen - proceed to intro sequence
  const handleBeginMission = useCallback(() => {
    setBriefingLevelId(null);
    // Show cinematic intro before loading
    setGameState('intro');
  }, []);

  // Intro sequence completed - proceed to loading
  const handleIntroComplete = useCallback(() => {
    setGameState('loading');
  }, []);

  // Cancel briefing - return to menu
  const handleCancelBriefing = useCallback(() => {
    setBriefingLevelId(null);
    setStartLevelId(null);
    setGameState('menu');
  }, []);

  const handleCommsDismiss = useCallback(() => {
    hideComms();
  }, [hideComms]);

  // Pause the game
  const handlePause = useCallback(() => {
    // Only allow pausing during active gameplay states
    if (gameState === 'playing' || gameState === 'tutorial' || gameState === 'dropping') {
      setPrePauseState(gameState);
      setGameState('paused');
    }
  }, [gameState]);

  // Resume from pause
  const handleResume = useCallback(() => {
    if (gameState === 'paused' && prePauseState) {
      setGameState(prePauseState);
      setPrePauseState(null);
    }
  }, [gameState, prePauseState]);

  // Handle Escape key to toggle pause during gameplay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the pressed key is bound to pause action
      if (isKeyBound(e.code, 'pause')) {
        // Don't pause if we're in menu, title, briefing, intro, loading, gameover, or completion states
        if (
          gameState === 'title' ||
          gameState === 'menu' ||
          gameState === 'briefing' ||
          gameState === 'intro' ||
          gameState === 'loading' ||
          gameState === 'gameover' ||
          gameState === 'levelComplete' ||
          gameState === 'credits'
        ) {
          return;
        }

        // If already paused, PauseMenu handles the resume via its own Escape handler
        // We only handle entering pause state here
        if (gameState !== 'paused') {
          e.preventDefault();
          handlePause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isKeyBound, handlePause]);

  // Set up player death callback to trigger game over
  useEffect(() => {
    setOnPlayerDeath(() => {
      setGameState('gameover');
    });
    return () => setOnPlayerDeath(null);
  }, [setOnPlayerDeath]);

  // Watch for player death state change as backup trigger
  useEffect(() => {
    if (isPlayerDead && gameState !== 'gameover' && gameState !== 'menu') {
      setGameState('gameover');
    }
  }, [isPlayerDead, gameState]);

  // Determine what HUD to show based on state
  const showCombatHUD = gameState === 'playing' || gameState === 'dropping';
  const showTutorialHUD = gameState === 'tutorial';

  return (
    <div className="game-container">
      {/* 3D Canvas - renders based on current state */}
      <GameCanvas
        key={restartKey}
        gameState={gameState}
        startLevelId={startLevelId}
        onTutorialComplete={handleTutorialComplete}
        onDropComplete={handleDropComplete}
        onLoadingProgress={setLoadingState}
        onLevelChange={handleLevelChange}
        onLevelComplete={handleLevelComplete}
      />

      {/* Title Sequence - opening cinematic */}
      {gameState === 'title' && <TitleSequence onComplete={handleTitleComplete} />}

      {/* Main Menu */}
      {gameState === 'menu' && (
        <MainMenu
          onStart={handleStartGame}
          onContinue={handleContinue}
          onSkipTutorial={handleSkipTutorial}
          onSelectLevel={handleSelectLevel}
          onReplayTitle={handleReplayTitle}
        />
      )}

      {/* Mission Briefing Screen */}
      {gameState === 'briefing' && briefingLevelId && (
        <MissionBriefing
          isOpen={true}
          levelId={briefingLevelId}
          onBeginMission={handleBeginMission}
          onCancel={handleCancelBriefing}
        />
      )}

      {/* Level Intro Cinematic - short establishing shot before gameplay */}
      {gameState === 'intro' && (
        <LevelIntro isOpen={true} levelId={currentLevelId} onComplete={handleIntroComplete} />
      )}

      {/* Loading Modal */}
      {gameState === 'loading' && (
        <LoadingModal
          isOpen={true}
          loadingState={loadingState}
          onLoadComplete={handleLoadComplete}
          levelId={currentLevelId}
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

      {/* Mobile Tutorial - shows touch control instructions at start of tutorial on touch devices */}
      {showTutorialHUD && showMobileTutorial && (
        <MobileTutorial onComplete={handleMobileTutorialComplete} />
      )}

      {/* Touch Controls for tutorial - show after mobile tutorial is dismissed */}
      {showTutorialHUD && isTouchDevice && !showMobileTutorial && (
        <TouchControls onInput={setTouchInput} onPause={handlePause} />
      )}

      {/* Desktop Control Hints - shows key bindings during tutorial on desktop */}
      {showTutorialHUD && !isTouchDevice && (
        <ControlHints tutorialPhase={tutorialPhase} isActive={isTutorialActive} />
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
          {isTouchDevice && <TouchControls onInput={setTouchInput} onPause={handlePause} />}
        </>
      )}

      {/* Game Over / Death Screen */}
      {gameState === 'gameover' && (
        <DeathScreen
          onRestartMission={handleRestartMission}
          onMainMenu={handleMainMenu}
          deathReason="SPECTER DOWN - KIA"
          missionName={CAMPAIGN_LEVELS[currentLevelId]?.missionName ?? 'CURRENT MISSION'}
        />
      )}

      {/* Pause Menu */}
      {gameState === 'paused' && (
        <PauseMenu
          onResume={handleResume}
          onMainMenu={handleMainMenu}
          onRestartLevel={handleRestartMission}
          missionName={CAMPAIGN_LEVELS[currentLevelId]?.missionName ?? 'CURRENT MISSION'}
          currentLevelId={currentLevelId}
          objectiveTitle={objectiveTitle}
          objectiveInstructions={objectiveInstructions}
        />
      )}

      {/* Level Completion Screen */}
      {gameState === 'levelComplete' && completionStats && (
        <LevelCompletionScreen
          onContinue={handleContinueToNextLevel}
          onRetry={handleRetryLevel}
          onMainMenu={handleMainMenu}
          levelId={currentLevelId}
          missionName={CAMPAIGN_LEVELS[currentLevelId]?.missionName ?? 'MISSION'}
          stats={completionStats}
          isFinalLevel={!CAMPAIGN_LEVELS[currentLevelId]?.nextLevelId}
        />
      )}

      {/* Credits Sequence */}
      {gameState === 'credits' && <CreditsSequence onComplete={handleCreditsComplete} />}

      {/* Landscape Enforcer - shows on mobile in portrait mode */}
      <LandscapeEnforcer
        title="ROTATE DEVICE"
        message="STELLAR DESCENT requires landscape orientation for tactical operations."
      />

      {/* Achievement Popup - shows when achievements are unlocked */}
      <AchievementPopup />

      {/* Subtitle Display - shows accessible subtitles for dialogue */}
      <SubtitleDisplay />

      {/* PWA Offline Indicator - shows when device is offline */}
      <OfflineIndicator isOffline={isOffline} />

      {/* PWA Update Prompt - shows when new version is available or offline ready */}
      <PWAUpdatePrompt
        needsUpdate={needsUpdate}
        isOfflineReady={isOfflineReady}
        onUpdate={updateServiceWorker}
        onDismissUpdate={dismissUpdate}
        onDismissOfflineReady={dismissOfflineReady}
      />

      {/* PWA Install Prompt - shows after tutorial completion */}
      <InstallPrompt triggerShow={shouldShowInstallPrompt} onClose={resetInstallPromptTrigger} />
    </div>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <KeybindingsProvider>
        <SubtitleProvider>
          <GameProvider>
            <WeaponProvider>
              <GameUI />
            </WeaponProvider>
          </GameProvider>
        </SubtitleProvider>
      </KeybindingsProvider>
    </SettingsProvider>
  );
}
