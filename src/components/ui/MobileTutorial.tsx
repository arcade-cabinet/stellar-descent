import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../../game/context/GameContext';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './MobileTutorial.module.css';

// localStorage key for tutorial completion
const MOBILE_TUTORIAL_COMPLETED_KEY = 'stellar-descent:mobile-tutorial-completed';

// Tutorial step definitions
interface TutorialStep {
  id: string;
  title: string;
  description: string;
  gestureType: 'joystick' | 'swipe' | 'tap' | 'hold';
  detectAction: (input: TutorialInputState) => boolean;
}

// Input state for detecting user actions
interface TutorialInputState {
  joystickMoved: boolean;
  swipeDelta: { x: number; y: number };
  firePressed: boolean;
  sprintHeld: boolean;
  sprintHoldDuration: number;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'movement',
    title: 'Move',
    description: 'Drag the left joystick to move your character.',
    gestureType: 'joystick',
    detectAction: (input) => input.joystickMoved,
  },
  {
    id: 'look',
    title: 'Look Around',
    description: 'Swipe on the right side of the screen to look around.',
    gestureType: 'swipe',
    detectAction: (input) => Math.abs(input.swipeDelta.x) > 50 || Math.abs(input.swipeDelta.y) > 50,
  },
  {
    id: 'fire',
    title: 'Fire Weapon',
    description: 'Tap the FIRE button to shoot.',
    gestureType: 'tap',
    detectAction: (input) => input.firePressed,
  },
  {
    id: 'sprint',
    title: 'Sprint',
    description: 'Hold the RUN button while moving to sprint faster.',
    gestureType: 'hold',
    detectAction: (input) => input.sprintHoldDuration > 1500, // Must hold for 1.5 seconds
  },
];

interface MobileTutorialProps {
  onComplete: () => void;
  forceShow?: boolean; // For testing - bypass localStorage check
}

export function MobileTutorial({ onComplete, forceShow = false }: MobileTutorialProps) {
  const { touchInput } = useGame();
  const screenInfo = getScreenInfo();

  const [isVisible, setIsVisible] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepCompleted, setStepCompleted] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // For rendering hold progress bar

  // Track input state for current step
  const inputStateRef = useRef<TutorialInputState>({
    joystickMoved: false,
    swipeDelta: { x: 0, y: 0 },
    firePressed: false,
    sprintHeld: false,
    sprintHoldDuration: 0,
  });

  const sprintStartTimeRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if tutorial should be shown
  useEffect(() => {
    if (!screenInfo.isTouchDevice && !forceShow) {
      // Not a touch device, complete immediately
      onComplete();
      return;
    }

    // Check localStorage for completion
    if (!forceShow) {
      const completed = localStorage.getItem(MOBILE_TUTORIAL_COMPLETED_KEY);
      if (completed === 'true') {
        onComplete();
        return;
      }
    }

    // Show tutorial
    setIsVisible(true);
  }, [screenInfo.isTouchDevice, forceShow, onComplete]);

  // Track touch input changes
  useEffect(() => {
    if (!touchInput || !isVisible) return;

    const state = inputStateRef.current;
    const currentStep = TUTORIAL_STEPS[currentStepIndex];

    // Update input state based on current step requirements
    switch (currentStep.gestureType) {
      case 'joystick':
        // Detect significant joystick movement
        if (Math.abs(touchInput.movement.x) > 0.3 || Math.abs(touchInput.movement.y) > 0.3) {
          state.joystickMoved = true;
        }
        break;

      case 'swipe':
        // Accumulate look delta
        state.swipeDelta.x += touchInput.look.x * 100;
        state.swipeDelta.y += touchInput.look.y * 100;
        break;

      case 'tap':
        // Detect fire button press
        if (touchInput.isFiring) {
          state.firePressed = true;
        }
        break;

      case 'hold':
        // Track sprint hold duration
        if (touchInput.isSprinting) {
          if (!sprintStartTimeRef.current) {
            sprintStartTimeRef.current = Date.now();
          }
          state.sprintHoldDuration = Date.now() - sprintStartTimeRef.current;
          state.sprintHeld = true;
          // Update progress for rendering
          setHoldProgress(Math.min(100, (state.sprintHoldDuration / 1500) * 100));
        } else {
          sprintStartTimeRef.current = null;
          state.sprintHoldDuration = 0;
          state.sprintHeld = false;
          setHoldProgress(0);
        }
        break;
    }

    // Check if current step is completed
    if (!stepCompleted && currentStep.detectAction(state)) {
      setStepCompleted(true);

      // Wait briefly to show completion, then advance
      completionTimeoutRef.current = setTimeout(() => {
        advanceToNextStep();
      }, 800);
    }
  }, [touchInput, isVisible, currentStepIndex, stepCompleted, advanceToNextStep]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  const advanceToNextStep = useCallback(() => {
    // Reset input state for next step
    inputStateRef.current = {
      joystickMoved: false,
      swipeDelta: { x: 0, y: 0 },
      firePressed: false,
      sprintHeld: false,
      sprintHoldDuration: 0,
    };
    sprintStartTimeRef.current = null;
    setStepCompleted(false);
    setHoldProgress(0);

    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Tutorial complete
      handleComplete();
    }
  }, [
    currentStepIndex, // Tutorial complete
    handleComplete,
  ]);

  const handleComplete = useCallback(() => {
    // Save completion to localStorage
    localStorage.setItem(MOBILE_TUTORIAL_COMPLETED_KEY, 'true');
    setIsVisible(false);
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
    }
    handleComplete();
  }, [handleComplete]);

  if (!isVisible) {
    return null;
  }

  const currentStep = TUTORIAL_STEPS[currentStepIndex];

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile controls tutorial"
    >
      <button
        type="button"
        className={styles.skipButton}
        onClick={handleSkip}
        aria-label="Skip tutorial"
      >
        Skip Tutorial
      </button>

      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Touch Controls</h2>
          <p className={styles.subtitle}>Learn the basics</p>
        </div>

        {/* Step progress indicator */}
        <div
          className={styles.stepIndicator}
          role="progressbar"
          aria-valuenow={currentStepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={TUTORIAL_STEPS.length}
        >
          {TUTORIAL_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`${styles.stepDot} ${index === currentStepIndex ? styles.active : ''} ${index < currentStepIndex ? styles.completed : ''}`}
              aria-label={`Step ${index + 1}: ${step.title} ${index < currentStepIndex ? '(completed)' : index === currentStepIndex ? '(current)' : ''}`}
            />
          ))}
        </div>

        {/* Current step content */}
        <div className={styles.stepContent}>
          <GestureAnimation gestureType={currentStep.gestureType} isCompleted={stepCompleted} />

          <div className={styles.textContainer}>
            <h3 className={styles.stepTitle}>{currentStep.title}</h3>
            <p className={styles.stepDescription}>{currentStep.description}</p>

            {!stepCompleted && <p className={styles.tryPrompt}>Try it now</p>}

            {/* Sprint hold progress */}
            {currentStep.gestureType === 'hold' && !stepCompleted && (
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${holdProgress}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Animated gesture demonstrations
interface GestureAnimationProps {
  gestureType: 'joystick' | 'swipe' | 'tap' | 'hold';
  isCompleted: boolean;
}

function GestureAnimation({ gestureType, isCompleted }: GestureAnimationProps) {
  return (
    <div className={styles.gestureContainer}>
      {isCompleted ? (
        <div className={styles.completedOverlay}>
          <CheckmarkIcon />
        </div>
      ) : (
        <>
          {gestureType === 'joystick' && <JoystickAnimation />}
          {gestureType === 'swipe' && <SwipeAnimation />}
          {gestureType === 'tap' && <TapAnimation />}
          {gestureType === 'hold' && <HoldAnimation />}
        </>
      )}
    </div>
  );
}

// Joystick drag animation
function JoystickAnimation() {
  return (
    <>
      <div className={styles.joystickBase}>
        <div className={`${styles.joystickThumb} ${styles.joystickAnimated}`} />
      </div>
      <HandIcon className={`${styles.hand} ${styles.handOnJoystick}`} />
    </>
  );
}

// Swipe gesture animation
function SwipeAnimation() {
  return (
    <>
      <div className={styles.swipeArea}>
        <span className={styles.swipeLabel}>Look Area</span>
      </div>
      <div className={styles.swipeTrail} />
      <HandIcon className={`${styles.hand} ${styles.handSwiping}`} />
    </>
  );
}

// Tap gesture animation
function TapAnimation() {
  return (
    <>
      <div className={`${styles.fireButton} ${styles.tapped}`}>FIRE</div>
      <HandIcon
        className={`${styles.hand} ${styles.handTapping}`}
        style={{ top: '70%', left: '55%' }}
      />
    </>
  );
}

// Hold gesture animation
function HoldAnimation() {
  return (
    <>
      <div className={`${styles.sprintButton} ${styles.held}`}>RUN</div>
      <HandIcon
        className={`${styles.hand} ${styles.handHolding}`}
        style={{ top: '70%', left: '55%' }}
      />
      <div className={styles.holdIndicator}>
        <span>Hold</span>
      </div>
    </>
  );
}

// Simple hand pointer SVG icon
function HandIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10.5 8.5c.27 0 .5.23.5.5v4h.5c.27 0 .5.23.5.5s-.23.5-.5.5H11v.5c0 .27-.23.5-.5.5s-.5-.23-.5-.5V9c0-.27.23-.5.5-.5m0-1.5c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2s2-.9 2-2V9c0-1.1-.9-2-2-2m7.46 6.5c-.32-.23-.74-.2-1.02.08l-1.44 1.44V10.5c0-.55-.45-1-1-1s-1 .45-1 1v7.59l-1.79-1.79c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l2.79 2.79c.4.4.93.5 1.41.5h5c.55 0 1-.45 1-1v-3c0-.26-.1-.52-.29-.71l-2.25-2.29z" />
    </svg>
  );
}

// Checkmark SVG icon
function CheckmarkIcon() {
  return (
    <svg
      className={styles.checkmark}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Hook to check if mobile tutorial has been completed
export function useMobileTutorialCompleted(): boolean {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const value = localStorage.getItem(MOBILE_TUTORIAL_COMPLETED_KEY);
    setCompleted(value === 'true');
  }, []);

  return completed;
}

// Function to reset mobile tutorial (for testing or settings)
export function resetMobileTutorial(): void {
  localStorage.removeItem(MOBILE_TUTORIAL_COMPLETED_KEY);
}
