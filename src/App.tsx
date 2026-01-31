/**
 * App.tsx - Thin router orchestrating Landing, Game, and Credits flows
 *
 * Responsibilities:
 * - Global providers (Settings, Keybindings, Subtitle, Game, Weapon)
 * - Campaign phase initialization and URL-based dev jumps
 * - Route to LandingFlow, GameFlow, or Credits based on phase
 * - Always-on overlays (achievements, PWA prompts, landscape enforcer)
 */

import { useEffect, useRef, useState } from 'react';
import { GameFlow, isGamePhase } from './components/GameFlow';
import { LandingFlow, isLandingPhase } from './components/LandingFlow';
import { AchievementPopup } from './components/ui/AchievementPopup';
import { CreditsSequence } from './components/ui/CreditsSequence';
import { DevMenu } from './components/ui/DevMenu';
import { InstallPrompt, useInstallPrompt } from './components/ui/InstallPrompt';
import { LandscapeEnforcer } from './components/ui/LandscapeEnforcer';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { PWAUpdatePrompt } from './components/ui/PWAUpdatePrompt';
import { SubtitleDisplay } from './components/ui/SubtitleDisplay';
import { initAchievements } from './game/achievements';
import { getCampaignDirector } from './game/campaign/CampaignDirector';
import type { CampaignPhase } from './game/campaign/types';
import { useCampaign } from './game/campaign/useCampaign';
import { GameProvider, useGame } from './game/context/GameContext';
import { KeybindingsProvider, useKeybindings } from './game/context/KeybindingsContext';
import { SettingsProvider } from './game/context/SettingsContext';
import { SubtitleProvider } from './game/context/SubtitleContext';
import { WeaponProvider } from './game/context/WeaponContext';
import { useCommsSubtitles } from './game/hooks/useCommsSubtitles';
import type { LevelId } from './game/levels/types';
import { usePWA } from './hooks/usePWA';
import { useSavePersistence } from './hooks/useSavePersistence';

// ============================================================================
// Constants
// ============================================================================

const TITLE_SHOWN_KEY = 'stellar_descent_title_shown';

const VALID_LEVELS: LevelId[] = [
  'anchor_station', 'landfall', 'canyon_run', 'fob_delta', 'brothers_in_arms',
  'southern_ice', 'the_breach', 'hive_assault', 'extraction', 'final_escape',
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect touch capability - works on ALL touch devices including foldables
 */
function detectTouchCapability(): boolean {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const hasAnyCoarsePointer = window.matchMedia?.('(any-pointer: coarse)')?.matches ?? false;
  return hasTouch || hasCoarsePointer || hasAnyCoarsePointer;
}

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

/**
 * Determine the initial campaign phase based on session state and URL params.
 */
function getInitialPhase(): CampaignPhase {
  if (getStartLevelFromURL()) return 'menu';
  if (sessionStorage.getItem(TITLE_SHOWN_KEY)) return 'menu';
  return 'splash';
}

// Initialize achievement system
initAchievements();

// ============================================================================
// GameUI - Main UI component using campaign state
// ============================================================================

function GameUI() {
  const [snapshot, dispatch] = useCampaign();
  const phase = snapshot.phase;

  // Touch device detection
  const [isTouchDevice, setIsTouchDevice] = useState(() => detectTouchCapability());

  // PWA state
  const {
    isOffline, isOfflineReady, needsUpdate,
    updateServiceWorker, dismissOfflineReady, dismissUpdate,
  } = usePWA();
  useSavePersistence();

  const {
    shouldTrigger: shouldShowInstallPrompt,
    triggerPrompt: triggerInstallPrompt,
    resetTrigger: resetInstallPromptTrigger,
  } = useInstallPrompt();

  // Game context for death detection and player state
  const {
    isPlayerDead, resetPlayerHealth, setOnPlayerDeath,
  } = useGame();

  const { isKeyBound } = useKeybindings();
  useCommsSubtitles();

  // ---- One-time initialization: handle URL dev jump and menu skip ----
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const director = getCampaignDirector();
    const initialPhase = getInitialPhase();

    // Handle URL-based dev jump - takes priority
    const urlLevel = getStartLevelFromURL();
    if (urlLevel) {
      console.log(`[Dev] Starting level from URL: ${urlLevel}`);
      director.dispatch({ type: 'DEV_JUMP_TO_LEVEL', levelId: urlLevel });
      return;
    }

    // If we should skip splash and go to menu (already shown this session)
    if (initialPhase === 'menu') {
      director.dispatch({ type: 'SPLASH_COMPLETE' }); // idle -> menu (title skipped)
    }
  }, []);

  // ---- Touch detection ----
  useEffect(() => {
    const update = () => setIsTouchDevice(detectTouchCapability());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const handleFirstTouch = () => {
      setIsTouchDevice(true);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
    window.addEventListener('touchstart', handleFirstTouch, { once: true, passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
  }, []);

  // ---- Player death -> dispatch PLAYER_DIED ----
  useEffect(() => {
    setOnPlayerDeath(() => {
      dispatch({ type: 'PLAYER_DIED' });
    });
    return () => setOnPlayerDeath(null);
  }, [setOnPlayerDeath, dispatch]);

  // Backup death detection
  useEffect(() => {
    if (isPlayerDead && phase !== 'gameover' && phase !== 'menu') {
      dispatch({ type: 'PLAYER_DIED' });
    }
  }, [isPlayerDead, phase, dispatch]);

  // ---- Escape key -> PAUSE ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isKeyBound(e.code, 'pause')) return;
      // Non-pausable phases
      const nonPausable: CampaignPhase[] = [
        'idle', 'splash', 'title', 'menu', 'briefing',
        'introBriefing', 'intro', 'loading', 'gameover',
        'levelComplete', 'credits',
      ];
      if (nonPausable.includes(phase)) return;
      if (phase !== 'paused') {
        e.preventDefault();
        dispatch({ type: 'PAUSE' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, isKeyBound, dispatch]);

  // ---- Title shown tracking ----
  useEffect(() => {
    if (phase === 'menu') {
      sessionStorage.setItem(TITLE_SHOWN_KEY, 'true');
    }
  }, [phase]);

  // ---- PWA install prompt after tutorial ----
  useEffect(() => {
    if (phase === 'dropping') {
      setTimeout(() => triggerInstallPrompt(), 2000);
    }
  }, [phase, triggerInstallPrompt]);

  // ---- Reset player health on menu/retry ----
  const prevPhaseRef = useRef<CampaignPhase>(phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    // Reset health when returning to menu or reloading
    if (phase === 'menu' && prev !== 'menu') {
      resetPlayerHealth();
    }
    if (phase === 'loading' && (prev === 'gameover' || prev === 'levelComplete' || prev === 'paused')) {
      resetPlayerHealth();
    }
  }, [phase, resetPlayerHealth]);

  return (
    <div className="game-container">
      {/* Landing Flow: splash, title, menu */}
      {isLandingPhase(phase) && (
        <LandingFlow phase={phase} dispatch={dispatch} isTouchDevice={isTouchDevice} />
      )}

      {/* Game Flow: briefing, loading, playing, paused, death, completion */}
      {isGamePhase(phase) && (
        <GameFlow
          snapshot={snapshot}
          dispatch={dispatch}
          isTouchDevice={isTouchDevice}
        />
      )}

      {/* Credits */}
      {phase === 'credits' && (
        <CreditsSequence onComplete={() => dispatch({ type: 'CREDITS_DONE' })} />
      )}

      {/* Always-on overlays */}
      <LandscapeEnforcer
        title="ROTATE DEVICE"
        message="STELLAR DESCENT requires landscape orientation for tactical operations."
      />
      <AchievementPopup />
      <SubtitleDisplay />
      <OfflineIndicator isOffline={isOffline} />
      <PWAUpdatePrompt
        needsUpdate={needsUpdate}
        isOfflineReady={isOfflineReady}
        onUpdate={updateServiceWorker}
        onDismissUpdate={dismissUpdate}
        onDismissOfflineReady={dismissOfflineReady}
      />
      <InstallPrompt triggerShow={shouldShowInstallPrompt} onClose={resetInstallPromptTrigger} />

      {/* Dev Menu - only in development */}
      {import.meta.env.VITE_DEV_MENU === 'true' && <DevMenu />}
    </div>
  );
}

// ============================================================================
// App - Root component with providers
// ============================================================================

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
