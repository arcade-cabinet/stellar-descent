import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TouchInput } from '../../game/types';
import styles from './TouchControls.module.css';

interface TouchControlsProps {
  onInput: (input: TouchInput | null) => void;
}

interface JoystickState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  pointerId: number | null;
}

// Track touch on screen for look (not on joystick or buttons)
interface LookTouchState {
  active: boolean;
  lastX: number;
  lastY: number;
  pointerId: number | null;
}

export function TouchControls({ onInput }: TouchControlsProps) {
  // Left joystick for movement
  const [moveStick, setMoveStick] = useState<JoystickState>({
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    pointerId: null,
  });

  // Look via screen drag (not a joystick)
  const [lookTouch, setLookTouch] = useState<LookTouchState>({
    active: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
  });
  const [lookDelta, setLookDelta] = useState({ x: 0, y: 0 });

  // Action buttons
  const [isFiring, setIsFiring] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [isCrouching, setIsCrouching] = useState(false);

  const maxDistance = 40;

  // Calculate joystick output
  const getJoystickOutput = useCallback((stick: JoystickState) => {
    if (!stick.active) return { x: 0, y: 0 };

    const dx = stick.currentX - stick.startX;
    const dy = stick.currentY - stick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 5) return { x: 0, y: 0 };

    const clampedDist = Math.min(distance, maxDistance);
    return {
      x: (dx / distance) * (clampedDist / maxDistance),
      y: (dy / distance) * (clampedDist / maxDistance),
    };
  }, []);

  // Send input updates
  useEffect(() => {
    const movement = getJoystickOutput(moveStick);

    onInput({
      movement: { x: movement.x, y: -movement.y }, // Invert Y for forward
      look: lookDelta,
      isFiring,
      isSprinting,
    });

    // Reset look delta after sending
    if (lookDelta.x !== 0 || lookDelta.y !== 0) {
      setLookDelta({ x: 0, y: 0 });
    }
  }, [moveStick, lookDelta, isFiring, isSprinting, getJoystickOutput, onInput]);

  // Movement joystick handlers
  const handleMoveStart = useCallback(
    (e: React.PointerEvent) => {
      if (moveStick.pointerId !== null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      setMoveStick({
        active: true,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        pointerId: e.pointerId,
      });
    },
    [moveStick.pointerId]
  );

  const handleMoveMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== moveStick.pointerId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setMoveStick((prev) => ({
        ...prev,
        currentX: e.clientX - rect.left - rect.width / 2,
        currentY: e.clientY - rect.top - rect.height / 2,
      }));
    },
    [moveStick.pointerId]
  );

  const handleMoveEnd = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== moveStick.pointerId) return;
      setMoveStick({
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        pointerId: null,
      });
    },
    [moveStick.pointerId]
  );

  // Screen touch for looking (drag anywhere on screen)
  const handleScreenTouchStart = useCallback(
    (e: React.PointerEvent) => {
      // Only capture touches in the center area (not on controls)
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Exclude left 25% (joystick) and right 25% (buttons)
      if (x < rect.width * 0.25 || x > rect.width * 0.75) return;
      // Exclude bottom 30% (action buttons area)
      if (y > rect.height * 0.7) return;

      if (lookTouch.pointerId !== null) return;

      setLookTouch({
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
        pointerId: e.pointerId,
      });
    },
    [lookTouch.pointerId]
  );

  const handleScreenTouchMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== lookTouch.pointerId || !lookTouch.active) return;

      const sensitivity = 0.003;
      const dx = (e.clientX - lookTouch.lastX) * sensitivity;
      const dy = (e.clientY - lookTouch.lastY) * sensitivity;

      setLookDelta((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLookTouch((prev) => ({
        ...prev,
        lastX: e.clientX,
        lastY: e.clientY,
      }));
    },
    [lookTouch]
  );

  const handleScreenTouchEnd = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerId !== lookTouch.pointerId) return;
      setLookTouch({
        active: false,
        lastX: 0,
        lastY: 0,
        pointerId: null,
      });
    },
    [lookTouch.pointerId]
  );

  // Calculate thumb position
  const getThumbStyle = (stick: JoystickState) => {
    if (!stick.active) return { transform: 'translate(-50%, -50%)' };

    const dx = stick.currentX - stick.startX;
    const dy = stick.currentY - stick.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let thumbX = dx;
    let thumbY = dy;

    if (distance > maxDistance) {
      thumbX = (dx / distance) * maxDistance;
      thumbY = (dy / distance) * maxDistance;
    }

    return {
      transform: `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`,
    };
  };

  return (
    <div
      className={styles.touchControls}
      onPointerDown={handleScreenTouchStart}
      onPointerMove={handleScreenTouchMove}
      onPointerUp={handleScreenTouchEnd}
      onPointerCancel={handleScreenTouchEnd}
    >
      {/* Left Joystick - Movement Only */}
      <div
        className={styles.joystickContainer}
        style={{ left: 'max(20px, env(safe-area-inset-left, 20px))' }}
        onPointerDown={handleMoveStart}
        onPointerMove={handleMoveMove}
        onPointerUp={handleMoveEnd}
        onPointerCancel={handleMoveEnd}
      >
        <div className={styles.joystickBase}>
          <div
            className={`${styles.joystickThumb} ${moveStick.active ? styles.active : ''}`}
            style={getThumbStyle(moveStick)}
          />
        </div>
        <span className={styles.joystickLabel}>MOVE</span>
      </div>

      {/* Right Side Action Buttons */}
      <div className={styles.actionButtonColumn}>
        {/* Fire Button - Large, prominent */}
        <button
          className={`${styles.actionButton} ${styles.fireButton} ${isFiring ? styles.active : ''}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            setIsFiring(true);
          }}
          onPointerUp={() => setIsFiring(false)}
          onPointerCancel={() => setIsFiring(false)}
          onPointerLeave={() => setIsFiring(false)}
        >
          FIRE
        </button>

        {/* Secondary buttons row */}
        <div className={styles.secondaryButtonRow}>
          {/* Jump Button */}
          <button
            className={`${styles.actionButton} ${styles.smallButton} ${isJumping ? styles.active : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsJumping(true);
            }}
            onPointerUp={() => setIsJumping(false)}
            onPointerCancel={() => setIsJumping(false)}
            onPointerLeave={() => setIsJumping(false)}
          >
            JUMP
          </button>

          {/* Crouch Button */}
          <button
            className={`${styles.actionButton} ${styles.smallButton} ${isCrouching ? styles.active : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsCrouching(true);
            }}
            onPointerUp={() => setIsCrouching(false)}
            onPointerCancel={() => setIsCrouching(false)}
            onPointerLeave={() => setIsCrouching(false)}
          >
            CROUCH
          </button>
        </div>

        {/* Sprint Button */}
        <button
          className={`${styles.actionButton} ${styles.sprintButton} ${isSprinting ? styles.active : ''}`}
          onPointerDown={(e) => {
            e.stopPropagation();
            setIsSprinting(true);
          }}
          onPointerUp={() => setIsSprinting(false)}
          onPointerCancel={() => setIsSprinting(false)}
          onPointerLeave={() => setIsSprinting(false)}
        >
          RUN
        </button>
      </div>

      {/* Bottom Weapon Rack - TODO: Implement weapon switching */}
      <div className={styles.weaponRack}>
        <div className={`${styles.weaponSlot} ${styles.weaponActive}`}>
          <span className={styles.weaponIcon}>1</span>
          <span className={styles.weaponName}>RIFLE</span>
        </div>
        <div className={styles.weaponSlot}>
          <span className={styles.weaponIcon}>2</span>
          <span className={styles.weaponName}>PISTOL</span>
        </div>
        <div className={styles.weaponSlot}>
          <span className={styles.weaponIcon}>3</span>
          <span className={styles.weaponName}>NADE</span>
        </div>
      </div>
    </div>
  );
}
