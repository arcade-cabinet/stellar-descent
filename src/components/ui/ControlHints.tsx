/**
 * ControlHints - Desktop control hints overlay for tutorial
 *
 * Shows key bindings visually during the tutorial:
 * - Displays WASD/Arrow keys for movement, mouse for look, etc.
 * - Highlights keys as player uses them (feedback)
 * - Fades out individual hints after player demonstrates proficiency
 * - Only visible on desktop (not touch devices)
 * - Integrates with tutorial phases to show relevant hints
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { TutorialPhase } from '../../game/levels/anchor-station/tutorialSteps';
import { getScreenInfo } from '../../game/utils/responsive';
import styles from './ControlHints.module.css';

interface ControlHintsProps {
  /** Current tutorial phase (0-4) */
  tutorialPhase: TutorialPhase;
  /** Whether the tutorial is active */
  isActive: boolean;
}

/** Tracks how many times a control has been used */
interface ControlUsage {
  moveForward: number;
  moveBackward: number;
  moveLeft: number;
  moveRight: number;
  look: number;
  jump: number;
  crouch: number;
  interact: number;
  reload: number;
  sprint: number;
  fire: number;
}

/** Number of uses before a hint is considered "learned" and fades out */
const PROFICIENCY_THRESHOLD = 3;

/** Maps key codes to control actions */
const KEY_TO_ACTION: Record<string, keyof ControlUsage> = {
  KeyW: 'moveForward',
  ArrowUp: 'moveForward',
  KeyS: 'moveBackward',
  ArrowDown: 'moveBackward',
  KeyA: 'moveLeft',
  ArrowLeft: 'moveLeft',
  KeyD: 'moveRight',
  ArrowRight: 'moveRight',
  Space: 'jump',
  ControlLeft: 'crouch',
  ControlRight: 'crouch',
  KeyC: 'crouch',
  KeyE: 'interact',
  KeyR: 'reload',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
};

export function ControlHints({ tutorialPhase, isActive }: ControlHintsProps) {
  const [usage, setUsage] = useState<ControlUsage>({
    moveForward: 0,
    moveBackward: 0,
    moveLeft: 0,
    moveRight: 0,
    look: 0,
    jump: 0,
    crouch: 0,
    interact: 0,
    reload: 0,
    sprint: 0,
    fire: 0,
  });

  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [mouseMoved, setMouseMoved] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);

  const screenInfo = getScreenInfo();

  // Track keyboard input
  useEffect(() => {
    if (!isActive || screenInfo.isTouchDevice) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const action = KEY_TO_ACTION[e.code];
      if (action) {
        setActiveKeys((prev) => new Set(prev).add(e.code));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const action = KEY_TO_ACTION[e.code];
      if (action) {
        setActiveKeys((prev) => {
          const next = new Set(prev);
          next.delete(e.code);
          return next;
        });
        // Increment usage count
        setUsage((prev) => ({
          ...prev,
          [action]: prev[action] + 1,
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, screenInfo.isTouchDevice]);

  // Track mouse movement for look
  useEffect(() => {
    if (!isActive || screenInfo.isTouchDevice) return;

    let moveCount = 0;

    const handleMouseMove = () => {
      if (!mouseMoved) {
        moveCount++;
        if (moveCount > 10) {
          setMouseMoved(true);
          setUsage((prev) => ({
            ...prev,
            look: prev.look + 1,
          }));
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        setMouseDown(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        setMouseDown(false);
        setUsage((prev) => ({
          ...prev,
          fire: prev.fire + 1,
        }));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isActive, screenInfo.isTouchDevice, mouseMoved]);

  // Reset mouse moved state periodically for continued tracking
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setMouseMoved(false);
    }, 2000);

    return () => clearInterval(interval);
  }, [isActive]);

  // Check if a control is "learned" (used enough times)
  const isLearned = useCallback(
    (action: keyof ControlUsage) => {
      return usage[action] >= PROFICIENCY_THRESHOLD;
    },
    [usage]
  );

  // Check if a key is currently pressed
  const isKeyActive = useCallback(
    (...codes: string[]) => {
      return codes.some((code) => activeKeys.has(code));
    },
    [activeKeys]
  );

  // Don't render on touch devices or when inactive
  if (screenInfo.isTouchDevice || !isActive) {
    return null;
  }

  // Determine which hints to show based on tutorial phase
  // Phase 0: Briefing - no controls shown
  // Phase 1: Movement unlocked - show WASD/arrows
  // Phase 2: Look/interact unlocked - show mouse, E key
  // Phase 3: Combat unlocked - show fire, reload
  // Phase 4: Full control - show all remaining

  const showMovement = tutorialPhase >= 1;
  const showLook = tutorialPhase >= 2;
  const showInteract = tutorialPhase >= 2;
  const showCombat = tutorialPhase >= 3;
  const showAdvanced = tutorialPhase >= 4;

  // Check if all relevant hints for current phase are learned
  const allMovementLearned =
    isLearned('moveForward') &&
    isLearned('moveBackward') &&
    isLearned('moveLeft') &&
    isLearned('moveRight');

  return (
    <div className={styles.controlHints} aria-label="Control hints">
      {/* Movement hints - bottom left corner */}
      {showMovement && !allMovementLearned && (
        <div className={styles.movementHints}>
          <div className={styles.hintsLabel}>MOVEMENT</div>
          <div className={styles.keyCluster}>
            {/* WASD Keys */}
            <div className={styles.wasdGrid}>
              <div className={styles.wasdRow}>
                <KeyHint
                  label="W"
                  altLabel="UP"
                  active={isKeyActive('KeyW', 'ArrowUp')}
                  learned={isLearned('moveForward')}
                />
              </div>
              <div className={styles.wasdRow}>
                <KeyHint
                  label="A"
                  altLabel="LEFT"
                  active={isKeyActive('KeyA', 'ArrowLeft')}
                  learned={isLearned('moveLeft')}
                />
                <KeyHint
                  label="S"
                  altLabel="DOWN"
                  active={isKeyActive('KeyS', 'ArrowDown')}
                  learned={isLearned('moveBackward')}
                />
                <KeyHint
                  label="D"
                  altLabel="RIGHT"
                  active={isKeyActive('KeyD', 'ArrowRight')}
                  learned={isLearned('moveRight')}
                />
              </div>
            </div>
            <div className={styles.keyDescription}>or Arrow Keys</div>
          </div>
        </div>
      )}

      {/* Look hint - top right corner */}
      {showLook && !isLearned('look') && (
        <div className={styles.lookHints}>
          <div className={styles.hintsLabel}>LOOK</div>
          <div className={styles.mouseHint}>
            <div className={`${styles.mouseIcon} ${mouseMoved ? styles.active : ''}`}>
              <div className={styles.mouseBody}>
                <div className={styles.mouseScroll} />
              </div>
              <div className={styles.mouseArrows}>
                <span className={styles.mouseArrow}>&#8593;</span>
                <span className={styles.mouseArrow}>&#8595;</span>
                <span className={styles.mouseArrow}>&#8592;</span>
                <span className={styles.mouseArrow}>&#8594;</span>
              </div>
            </div>
            <div className={styles.keyDescription}>Move Mouse</div>
          </div>
        </div>
      )}

      {/* Interact hint - center right */}
      {showInteract && !isLearned('interact') && (
        <div className={styles.interactHints}>
          <div className={styles.hintsLabel}>INTERACT</div>
          <KeyHint label="E" active={isKeyActive('KeyE')} learned={isLearned('interact')} large />
        </div>
      )}

      {/* Combat hints - bottom right corner */}
      {showCombat && (!isLearned('fire') || !isLearned('reload')) && (
        <div className={styles.combatHints}>
          <div className={styles.hintsLabel}>COMBAT</div>
          <div className={styles.combatRow}>
            {!isLearned('fire') && (
              <div className={styles.fireHint}>
                <div
                  className={`${styles.mouseIcon} ${styles.fireIcon} ${mouseDown ? styles.active : ''}`}
                >
                  <div className={styles.mouseBody}>
                    <div className={`${styles.mouseButton} ${styles.leftButton}`} />
                  </div>
                </div>
                <div className={styles.keyDescription}>Fire</div>
              </div>
            )}
            {!isLearned('reload') && (
              <KeyHint
                label="R"
                description="Reload"
                active={isKeyActive('KeyR')}
                learned={isLearned('reload')}
              />
            )}
          </div>
        </div>
      )}

      {/* Advanced hints - shown in phase 4 */}
      {showAdvanced && (
        <div className={styles.advancedHints}>
          {!isLearned('jump') && (
            <KeyHint
              label="SPACE"
              description="Jump"
              active={isKeyActive('Space')}
              learned={isLearned('jump')}
              wide
            />
          )}
          {!isLearned('crouch') && (
            <KeyHint
              label="CTRL"
              altLabel="C"
              description="Crouch"
              active={isKeyActive('ControlLeft', 'ControlRight', 'KeyC')}
              learned={isLearned('crouch')}
            />
          )}
          {!isLearned('sprint') && (
            <KeyHint
              label="SHIFT"
              description="Sprint"
              active={isKeyActive('ShiftLeft', 'ShiftRight')}
              learned={isLearned('sprint')}
              wide
            />
          )}
        </div>
      )}
    </div>
  );
}

interface KeyHintProps {
  label: string;
  altLabel?: string;
  description?: string;
  active?: boolean;
  learned?: boolean;
  large?: boolean;
  wide?: boolean;
}

function KeyHint({ label, altLabel, description, active, learned, large, wide }: KeyHintProps) {
  const classNames = [
    styles.keyHint,
    active && styles.active,
    learned && styles.learned,
    large && styles.large,
    wide && styles.wide,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      <div className={styles.keyBox}>
        <span className={styles.keyLabel}>{label}</span>
        {altLabel && <span className={styles.keyAlt}>{altLabel}</span>}
      </div>
      {description && <span className={styles.keyDesc}>{description}</span>}
    </div>
  );
}
