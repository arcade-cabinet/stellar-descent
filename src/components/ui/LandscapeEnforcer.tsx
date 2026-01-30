import { useCallback, useEffect, useRef, useState } from 'react';
import { lockToLandscape, shouldEnforceLandscape, vibrate } from '../../game/utils/responsive';
import styles from './LandscapeEnforcer.module.css';

/**
 * SVG icon showing a phone rotating from portrait to landscape
 * The phone animates with a smooth 90-degree rotation
 */
function RotatePhoneIcon() {
  return (
    <svg
      className={styles.phoneIcon}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Phone body that rotates */}
      <g className={styles.rotatingPhone}>
        <rect
          x="40"
          y="25"
          width="40"
          height="70"
          rx="4"
          stroke="#b5a642"
          strokeWidth="2"
          fill="rgba(74, 93, 35, 0.2)"
        />
        {/* Screen */}
        <rect x="44" y="32" width="32" height="52" rx="2" fill="rgba(181, 166, 66, 0.15)" />
        {/* Home button indicator */}
        <circle cx="60" cy="90" r="3" fill="rgba(74, 93, 35, 0.4)" />
        {/* Screen content indicator */}
        <rect x="48" y="38" width="24" height="4" rx="1" fill="rgba(181, 166, 66, 0.3)" />
        <rect x="48" y="46" width="18" height="3" rx="1" fill="rgba(181, 166, 66, 0.2)" />
        <rect x="48" y="52" width="20" height="3" rx="1" fill="rgba(181, 166, 66, 0.2)" />
      </g>

      {/* Rotation arrow indicator */}
      <g className={styles.rotationArrow}>
        <path
          d="M95 60 A35 35 0 0 1 60 95"
          stroke="#5c7a2e"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray="5 3"
        />
        <path
          d="M60 88 L60 98 L70 93"
          stroke="#5c7a2e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

/**
 * Game logo/branding component for the enforcer screen
 */
function GameLogo() {
  return (
    <div className={styles.logoContainer}>
      <div className={styles.logoInsignia}>
        <span className={styles.logoText}>SD</span>
      </div>
      <div className={styles.logoTitle}>STELLAR DESCENT</div>
    </div>
  );
}

/**
 * Animated rotation hint with pulsing arrows
 */
function RotationHint() {
  return (
    <div className={styles.rotationHint} aria-hidden="true">
      <div className={styles.hintArrowLeft}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" role="presentation">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
        </svg>
      </div>
      <span className={styles.hintText}>ROTATE</span>
      <div className={styles.hintArrowRight}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" role="presentation">
          <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

interface LandscapeEnforcerProps {
  /** Custom title text */
  title?: string;
  /** Custom message text */
  message?: string;
  /** Enable haptic feedback when overlay appears (default: true) */
  enableHaptics?: boolean;
  /** Attempt to programmatically lock orientation when overlay appears (default: true)
   * Uses Capacitor ScreenOrientation plugin on native apps, or web Screen Orientation API.
   * Falls back gracefully if not supported (e.g., iOS Safari). */
  attemptOrientationLock?: boolean;
  /** Callback when portrait mode is detected - use to pause game */
  onPortraitDetected?: () => void;
  /** Callback when landscape mode is restored - use to resume game */
  onLandscapeRestored?: () => void;
}

/**
 * LandscapeEnforcer component
 *
 * Displays a fullscreen overlay on mobile devices when in portrait orientation,
 * prompting the user to rotate their device to landscape mode.
 *
 * Features:
 * - Clear visual indicator showing portrait-to-landscape rotation
 * - Animated phone icon rotating to landscape
 * - Automatic dismissal when device is rotated to landscape
 * - Haptic feedback when overlay appears
 * - Full accessibility support with ARIA attributes and screen reader announcements
 * - Reduced motion support for users who prefer it
 * - Game logo/branding visible
 * - Callbacks for game pause/resume integration
 * - Capacitor ScreenOrientation plugin support for native iOS/Android apps
 * - Falls back to web Screen Orientation API when Capacitor is not available
 *
 * This component only enforces landscape on phones (< 768px).
 * Tablets, foldables, and desktops are allowed to use any orientation.
 */
export function LandscapeEnforcer({
  title = 'ROTATE DEVICE',
  message = 'This experience requires landscape orientation for optimal gameplay.',
  enableHaptics = true,
  attemptOrientationLock = true,
  onPortraitDetected,
  onLandscapeRestored,
}: LandscapeEnforcerProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const wasShowingRef = useRef(false);
  const hasAttemptedLockRef = useRef(false);

  const checkOrientation = useCallback(() => {
    const needsLandscape = shouldEnforceLandscape();
    const wasShowing = wasShowingRef.current;

    // Track state changes for haptic feedback and callbacks
    const isNewlyShowing = needsLandscape && !wasShowing;
    const isNewlyHiding = !needsLandscape && wasShowing;

    setShouldShow(needsLandscape);
    wasShowingRef.current = needsLandscape;

    // Provide haptic feedback when overlay first appears
    if (isNewlyShowing && enableHaptics) {
      vibrate([50, 30, 50]); // Double tap pattern
    }

    // Attempt to lock orientation when overlay first appears
    // This uses Capacitor ScreenOrientation on native apps or web API as fallback
    if (isNewlyShowing && attemptOrientationLock && !hasAttemptedLockRef.current) {
      hasAttemptedLockRef.current = true;
      // Fire and forget - we don't need to wait for the result
      // The lock will either work (on native/Android) or silently fail (iOS Safari)
      lockToLandscape().catch(() => {
        // Silently handle - the overlay will remain visible for manual rotation
      });
    }

    // Reset lock attempt flag when orientation is restored
    if (isNewlyHiding) {
      hasAttemptedLockRef.current = false;
    }

    // Fire callbacks for game state management
    if (isNewlyShowing) {
      onPortraitDetected?.();
    } else if (isNewlyHiding) {
      onLandscapeRestored?.();
    }

    // Handle visibility transitions
    if (needsLandscape) {
      setIsVisible(true);
    } else {
      // Allow fade-out animation before hiding
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [enableHaptics, attemptOrientationLock, onPortraitDetected, onLandscapeRestored]);

  useEffect(() => {
    // Initial check
    checkOrientation();

    // Listen for orientation changes
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Also check on screen.orientation API if available
    if (screen.orientation) {
      screen.orientation.addEventListener('change', checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', checkOrientation);
      }
    };
  }, [checkOrientation]);

  // Don't render anything if not needed
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`${styles.overlay} ${!shouldShow ? styles.overlayHidden : ''}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="landscape-enforcer-title"
      aria-describedby="landscape-enforcer-message"
      aria-live="assertive"
    >
      {/* Decorative terminal effects */}
      <div className={styles.scanline} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.border} aria-hidden="true" />
      <div className={styles.cornerTL} aria-hidden="true" />
      <div className={styles.cornerTR} aria-hidden="true" />
      <div className={styles.cornerBL} aria-hidden="true" />
      <div className={styles.cornerBR} aria-hidden="true" />

      <div className={styles.content}>
        {/* Game logo/branding */}
        <GameLogo />

        {/* Warning indicator */}
        <div className={styles.warningBadge} aria-hidden="true">
          <span className={styles.warningIcon}>!</span>
          <span className={styles.warningText}>ALERT</span>
        </div>

        <h2 id="landscape-enforcer-title" className={styles.title}>
          {title}
        </h2>

        <div className={styles.iconContainer}>
          <div className={styles.iconGlow} aria-hidden="true" />
          <RotatePhoneIcon />
        </div>

        <RotationHint />

        <p id="landscape-enforcer-message" className={styles.message}>
          {message}
        </p>

        <div className={styles.instruction}>
          <span className={styles.instructionBracket} aria-hidden="true">
            [
          </span>
          <span className={styles.highlight}>ROTATE DEVICE TO CONTINUE</span>
          <span className={styles.instructionBracket} aria-hidden="true">
            ]
          </span>
        </div>

        {/* Status indicator */}
        <div className={styles.statusLine} aria-hidden="true">
          <span className={styles.statusDot} />
          <span className={styles.statusText}>AWAITING ORIENTATION CHANGE</span>
        </div>

        {/* Screen reader announcement for accessibility */}
        <output className={styles.srOnly} aria-live="polite">
          Please rotate your device to landscape orientation to continue playing. This overlay will
          automatically close when you rotate your device.
        </output>
      </div>
    </div>
  );
}

export default LandscapeEnforcer;
