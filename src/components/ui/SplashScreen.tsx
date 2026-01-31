import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SplashScreen.module.css';

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * SplashScreen - Full-screen video splash with orientation-aware playback.
 * Detects portrait vs landscape and plays the appropriate video.
 * Tap/keypress to skip. Transitions on video end.
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isPortrait, setIsPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches
  );
  const [fading, setFading] = useState(false);
  const landscapeRef = useRef<HTMLVideoElement>(null);
  const portraitRef = useRef<HTMLVideoElement>(null);

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

  // Start playing the active video
  useEffect(() => {
    const activeVideo = isPortrait ? portraitRef.current : landscapeRef.current;
    activeVideo?.play().catch(() => {
      // Autoplay blocked - that's OK, user can tap to skip
    });
  }, [isPortrait]);

  const handleComplete = useCallback(() => {
    if (fading) return;
    setFading(true);
    setTimeout(onComplete, 500);
  }, [fading, onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Skip on any key or touch
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      e.preventDefault();
      handleSkip();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSkip]);

  return (
    <div
      className={`${styles.overlay} ${fading ? styles.fadeOut : ''}`}
      onClick={handleSkip}
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
        onEnded={handleComplete}
      />
      {/* Portrait video (9:16) */}
      <video
        ref={portraitRef}
        className={`${styles.video} ${!isPortrait ? styles.hidden : ''}`}
        src="/video/splash-9-16.mp4"
        playsInline
        muted
        onEnded={handleComplete}
      />
      <div className={styles.skipHint}>TAP TO SKIP</div>
    </div>
  );
}
