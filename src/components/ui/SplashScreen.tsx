import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AudioUnlockState,
  getSplashAudioManager,
} from '../../game/core/audio/SplashAudioManager';
import styles from './SplashScreen.module.css';

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * SplashScreen - Full-screen video splash with orientation-aware playback.
 * Detects portrait vs landscape and plays the appropriate video.
 * Handles Web Audio API unlock for modern browsers.
 * Tap/keypress to skip. Transitions on video end.
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isPortrait, setIsPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches
  );
  const [fading, setFading] = useState(false);
  const [audioState, setAudioState] = useState<AudioUnlockState>('locked');
  const [showTapToStart, setShowTapToStart] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const landscapeRef = useRef<HTMLVideoElement>(null);
  const portraitRef = useRef<HTMLVideoElement>(null);
  const audioManagerRef = useRef(getSplashAudioManager());
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track orientation changes
  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)');
    const handler = (e: MediaQueryListEvent) => {
      setIsPortrait(e.matches);
      // Sync current time between videos
      const from = e.matches ? landscapeRef.current : portraitRef.current;
      const to = e.matches ? portraitRef.current : landscapeRef.current;
      if (from && to) {
        to.currentTime = from.currentTime;
        to.play().catch(() => {});
        from.pause();
      }
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Subscribe to audio state changes
  useEffect(() => {
    const audioManager = audioManagerRef.current;
    const unsubscribe = audioManager.onStateChange((state) => {
      setAudioState(state);
    });
    return () => unsubscribe();
  }, []);

  // Show "Tap to start" if audio is locked after a delay
  useEffect(() => {
    if (audioState === 'locked' && !hasInteracted) {
      interactionTimeoutRef.current = setTimeout(() => {
        setShowTapToStart(true);
      }, 1500); // Show after 1.5s if still locked
    } else {
      setShowTapToStart(false);
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
    }
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [audioState, hasInteracted]);

  // Start playing the active video and attempt audio playback
  useEffect(() => {
    const activeVideo = isPortrait ? portraitRef.current : landscapeRef.current;
    activeVideo?.play().catch(() => {
      // Autoplay blocked - that's OK, user can tap to skip
    });

    // Attempt to play audio (will queue if locked)
    const audioManager = audioManagerRef.current;
    audioManager.play();
  }, [isPortrait]);

  // Handle user interaction to unlock audio
  const handleInteraction = useCallback(async () => {
    if (hasInteracted) return;
    setHasInteracted(true);

    const audioManager = audioManagerRef.current;
    const unlocked = await audioManager.unlockAudio();

    if (unlocked) {
      // Audio unlocked, playback will start automatically if queued
      setShowTapToStart(false);
    }
  }, [hasInteracted]);

  const handleComplete = useCallback(() => {
    if (fading) return;
    setFading(true);

    // Begin audio crossfade before transitioning
    const audioManager = audioManagerRef.current;
    audioManager.beginCrossfade(0.5); // Short fade for skip scenario

    setTimeout(() => {
      onComplete();
    }, 500);
  }, [fading, onComplete]);

  // Natural video end handler - longer crossfade
  const handleVideoEnd = useCallback(() => {
    if (fading) return;
    setFading(true);

    // Begin audio crossfade with longer duration for natural end
    const audioManager = audioManagerRef.current;
    audioManager.beginCrossfade(2); // 2 second crossfade

    setTimeout(() => {
      onComplete();
    }, 500);
  }, [fading, onComplete]);

  const handleSkip = useCallback(() => {
    // First ensure audio is unlocked, then complete
    handleInteraction();
    handleComplete();
  }, [handleInteraction, handleComplete]);

  // Handle click/tap - unlock audio if needed, or skip
  const handleClick = useCallback(() => {
    if (audioState === 'locked' && showTapToStart) {
      // First tap just unlocks audio
      handleInteraction();
    } else {
      // Subsequent tap or already unlocked - skip
      handleSkip();
    }
  }, [audioState, showTapToStart, handleInteraction, handleSkip]);

  // Skip on any key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      handleClick();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't dispose - let it continue for crossfade to menu
      // The menu will handle cleanup after crossfade completes
    };
  }, []);

  return (
    <div
      className={`${styles.overlay} ${fading ? styles.fadeOut : ''}`}
      onClick={handleClick}
      onKeyDown={() => {}}
      role="presentation"
    >
      {/* Landscape video (16:9) */}
      <video
        ref={landscapeRef}
        className={`${styles.video} ${isPortrait ? styles.hidden : ''}`}
        src="/video/splash-16-9.mp4"
        playsInline
        muted
        onEnded={handleVideoEnd}
      />
      {/* Portrait video (9:16) */}
      <video
        ref={portraitRef}
        className={`${styles.video} ${!isPortrait ? styles.hidden : ''}`}
        src="/video/splash-9-16.mp4"
        playsInline
        muted
        onEnded={handleVideoEnd}
      />

      {/* Audio unlock prompt */}
      {showTapToStart && audioState === 'locked' && (
        <div className={styles.tapToStart}>
          <div className={styles.tapToStartIcon}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
            </svg>
          </div>
          <span>TAP TO START</span>
        </div>
      )}

      {/* Loading indicator while unlocking */}
      {audioState === 'unlocking' && (
        <div className={styles.loadingIndicator}>
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
        </div>
      )}

      {/* Skip hint - only show if audio is unlocked or user has interacted */}
      {(audioState === 'unlocked' || hasInteracted) && !showTapToStart && (
        <div className={styles.skipHint}>TAP TO SKIP</div>
      )}
    </div>
  );
}
