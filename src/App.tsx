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
import { isLandingPhase, LandingFlow } from './components/LandingFlow';
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
import { GameProvider } from './game/context/GameContext';
import { SubtitleProvider } from './game/context/SubtitleContext';
import { WeaponProvider } from './game/context/WeaponContext';
import { BUILD_FLAGS } from './game/core/BuildConfig';
import { initializeDebugInterface } from './game/testing/DebugInterface';
import { getLogger } from './game/core/Logger';
import { useCommsSubtitles } from './game/hooks/useCommsSubtitles';
import type { LevelId } from './game/levels/types';
import { CAMPAIGN_LEVELS } from './game/levels/types';
import { useKeybindings } from './game/stores/useKeybindingsStore';
import { usePlayerStore } from './game/stores/usePlayerStore';
import { shouldShowTouchControls } from './game/utils/PlatformDetector';
import { usePWA } from './hooks/usePWA';
import { useSavePersistence } from './hooks/useSavePersistence';

// ============================================================================
// Constants
// ============================================================================

const log = getLogger('App');

const TITLE_SHOWN_KEY = 'stellar_descent_title_shown';

// Derive VALID_LEVELS from CAMPAIGN_LEVELS to keep them in sync
const VALID_LEVELS = Object.keys(CAMPAIGN_LEVELS) as LevelId[];

// ============================================================================
// Utility Functions
// ============================================================================

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

// Initialize debug interface for E2E testing (only in dev mode)
if (BUILD_FLAGS.DEV_MENU) {
  initializeDebugInterface();
}

// ============================================================================
// GameUI - Main UI component using campaign state
// ============================================================================

function GameUI() {
  const [snapshot, dispatch] = useCampaign();
  const phase = snapshot.phase;

  // Touch controls detection - based on device TYPE, not just touch capability
  // Desktop = no touch controls; Mobile/Tablet/Foldable = custom TouchControls
  const [isTouchDevice, setIsTouchDevice] = useState(() => shouldShowTouchControls());

  // PWA state
  const {
    isOffline,
    isOfflineReady,
    needsUpdate,
    updateServiceWorker,
    dismissOfflineReady,
    dismissUpdate,
  } = usePWA();
  useSavePersistence();

  const {
    shouldTrigger: shouldShowInstallPrompt,
    triggerPrompt: triggerInstallPrompt,
    resetTrigger: resetInstallPromptTrigger,
  } = useInstallPrompt();

  // Player state from Zustand store (migrated from GameContext)
  const isPlayerDead = usePlayerStore((state) => state.isDead);
  const resetPlayerHealth = usePlayerStore((state) => state.reset);

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
      log.info(`[Dev] Starting level from URL: ${urlLevel}`);
      director.dispatch({ type: 'DEV_JUMP_TO_LEVEL', levelId: urlLevel });
      return;
    }

    // If we should skip splash and go to menu (already shown this session)
    if (initialPhase === 'menu') {
      director.dispatch({ type: 'SPLASH_COMPLETE' }); // idle -> menu (title skipped)
    }
  }, []);

  // ---- Touch controls detection ----
  // Re-check on resize/orientation change since device type can change (e.g., foldable unfold)
  useEffect(() => {
    const update = () => setIsTouchDevice(shouldShowTouchControls());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // ---- Player death -> dispatch PLAYER_DIED ----
  // Watch for isDead state changes in the player store
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
        'idle',
        'splash',
        'title',
        'menu',
        'briefing',
        'introBriefing',
        'intro',
        'loading',
        'gameover',
        'levelComplete',
        'credits',
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
    if (
      phase === 'loading' &&
      (prev === 'gameover' || prev === 'levelComplete' || prev === 'paused')
    ) {
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
        <GameFlow snapshot={snapshot} dispatch={dispatch} isTouchDevice={isTouchDevice} />
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

      {/* Dev Menu - only when build flag is enabled */}
      {BUILD_FLAGS.DEV_MENU && <DevMenu />}
    </div>
  );
}

// ============================================================================
// App - Root component with providers
// ============================================================================

export function App() {
  return (
    <SubtitleProvider>
      <GameProvider>
        <WeaponProvider>
          <GameUI />
        </WeaponProvider>
      </GameProvider>
    </SubtitleProvider>
  );
}
