/**
 * CommandWheel - Radial menu for issuing squad commands to Marcus
 *
 * USAGE:
 * - Hold Tab to open the command wheel
 * - Move mouse to select a command segment
 * - Release Tab to confirm the selected command
 *
 * DESIGN:
 * - 5 command segments arranged radially
 * - Military-style icons and labels
 * - Visual feedback for selected segment
 * - Animated open/close transitions
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { COMMAND_INFO, type SquadCommand } from '../../game/ai/SquadCommandSystem';
import styles from './CommandWheel.module.css';

interface CommandWheelProps {
  isOpen: boolean;
  selectedCommand: SquadCommand | null;
  onSelectionChange: (angle: number, distance: number) => void;
  onClose: () => void;
}

// Command arrangement (clockwise from top)
const COMMAND_ORDER: SquadCommand[] = [
  'FOLLOW_ME',       // Top (270 degrees)
  'ATTACK_TARGET',   // Top-right (342 degrees)
  'SUPPRESSING_FIRE', // Bottom-right (54 degrees)
  'REGROUP',         // Bottom-left (126 degrees)
  'HOLD_POSITION',   // Top-left (198 degrees)
];

// Calculate segment angles
const SEGMENT_ANGLE = (Math.PI * 2) / 5; // 72 degrees per segment

export function CommandWheel({
  isOpen,
  selectedCommand,
  onSelectionChange,
  onClose,
}: CommandWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const [centerPos, setCenterPos] = useState({ x: 0, y: 0 });
  const [showWheel, setShowWheel] = useState(false);

  // Track center position when wheel opens
  useEffect(() => {
    if (isOpen && wheelRef.current) {
      const rect = wheelRef.current.getBoundingClientRect();
      setCenterPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      // Small delay for animation
      requestAnimationFrame(() => setShowWheel(true));
    } else {
      setShowWheel(false);
    }
  }, [isOpen]);

  // Handle mouse movement
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isOpen) return;

      const dx = e.clientX - centerPos.x;
      const dy = e.clientY - centerPos.y;

      // Calculate angle (0 = right, going counter-clockwise)
      const angle = Math.atan2(-dy, dx);

      // Calculate normalized distance (0-1, based on wheel radius)
      const maxRadius = 150; // Match CSS size
      const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / maxRadius);

      onSelectionChange(angle, distance);
    },
    [isOpen, centerPos, onSelectionChange]
  );

  // Handle Tab key release
  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Tab' && isOpen) {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onClose]
  );

  // Attach event listeners
  useEffect(() => {
    if (isOpen) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isOpen, handleMouseMove, handleKeyUp]);

  if (!isOpen) return null;

  return (
    <div
      className={`${styles.wheelOverlay} ${showWheel ? styles.visible : ''}`}
      role="menu"
      aria-label="Squad Command Wheel"
    >
      <div
        ref={wheelRef}
        className={`${styles.wheel} ${showWheel ? styles.open : ''}`}
      >
        {/* Center indicator */}
        <div className={styles.centerHub}>
          <span className={styles.centerLabel}>COMMAND</span>
        </div>

        {/* Command segments */}
        {COMMAND_ORDER.map((command, index) => {
          const isSelected = selectedCommand === command;
          const info = COMMAND_INFO[command];

          // Calculate segment position
          // Start from top (-90 degrees) and go clockwise
          const baseAngle = -90 + (index * 72); // degrees
          const angleRad = (baseAngle * Math.PI) / 180;

          // Position at segment center (radius ~100px from center)
          const radius = 100;
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;

          return (
            <div
              key={command}
              className={`${styles.segment} ${isSelected ? styles.selected : ''}`}
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
              role="menuitem"
              aria-selected={isSelected}
            >
              <div className={styles.segmentContent}>
                <span className={styles.commandIcon}>{info.icon}</span>
                <span className={styles.commandLabel}>{info.label}</span>
              </div>
            </div>
          );
        })}

        {/* Segment divider lines */}
        {[0, 1, 2, 3, 4].map((index) => {
          const angle = -90 + 36 + (index * 72); // Start at segment boundary
          return (
            <div
              key={`divider-${index}`}
              className={styles.divider}
              style={{
                transform: `rotate(${angle}deg)`,
              }}
            />
          );
        })}

        {/* Selection indicator ring */}
        <svg className={styles.selectionRing} viewBox="0 0 300 300">
          {COMMAND_ORDER.map((command, index) => {
            const isSelected = selectedCommand === command;
            const startAngle = -90 + (index * 72) - 36;
            const endAngle = startAngle + 72;

            // Convert to SVG arc
            const start = polarToCartesian(150, 150, 140, startAngle);
            const end = polarToCartesian(150, 150, 140, endAngle);

            const d = [
              'M', start.x, start.y,
              'A', 140, 140, 0, 0, 1, end.x, end.y,
            ].join(' ');

            return (
              <path
                key={`arc-${command}`}
                d={d}
                className={`${styles.arcSegment} ${isSelected ? styles.arcSelected : ''}`}
                fill="none"
                strokeWidth="8"
              />
            );
          })}
        </svg>

        {/* Instruction text */}
        <div className={styles.instructions}>
          {selectedCommand ? (
            <>
              <span className={styles.selectedName}>{COMMAND_INFO[selectedCommand].label}</span>
              <span className={styles.selectedDesc}>{COMMAND_INFO[selectedCommand].description}</span>
            </>
          ) : (
            <span className={styles.hint}>Move mouse to select</span>
          )}
        </div>
      </div>

      {/* Key hint */}
      <div className={styles.keyHint}>
        <span className={styles.keyIcon}>TAB</span>
        <span>Release to confirm</span>
      </div>
    </div>
  );
}

// Helper function for SVG arc calculation
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}
