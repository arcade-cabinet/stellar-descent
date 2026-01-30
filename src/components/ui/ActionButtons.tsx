/**
 * ActionButtons - Dynamic context-sensitive action buttons
 *
 * Displays action button groups on the HUD that can be:
 * - Changed per level/phase
 * - Enabled/disabled dynamically
 * - Show cooldowns and progress
 * - Highlighted to draw attention
 */

import React from 'react';
import type { ActionButton, ActionButtonGroup } from '../../game/types/actions';
import styles from './ActionButtons.module.css';

interface ActionButtonsProps {
  groups: ActionButtonGroup[];
  onAction?: (actionId: string) => void;
}

export function ActionButtons({ groups, onAction }: ActionButtonsProps) {
  // Group by position
  const rightGroups = groups.filter((g) => g.position === 'right');
  const leftGroups = groups.filter((g) => g.position === 'left');
  const bottomGroups = groups.filter((g) => g.position === 'bottom');

  return (
    <>
      {/* Right side buttons */}
      {rightGroups.length > 0 && (
        <div className={styles.rightPanel}>
          {rightGroups.map((group) => (
            <ButtonGroup key={group.id} group={group} onAction={onAction} />
          ))}
        </div>
      )}

      {/* Left side buttons */}
      {leftGroups.length > 0 && (
        <div className={styles.leftPanel}>
          {leftGroups.map((group) => (
            <ButtonGroup key={group.id} group={group} onAction={onAction} />
          ))}
        </div>
      )}

      {/* Bottom buttons */}
      {bottomGroups.length > 0 && (
        <div className={styles.bottomPanel}>
          {bottomGroups.map((group) => (
            <ButtonGroup key={group.id} group={group} onAction={onAction} />
          ))}
        </div>
      )}
    </>
  );
}

interface ButtonGroupProps {
  group: ActionButtonGroup;
  onAction?: (actionId: string) => void;
}

function ButtonGroup({ group, onAction }: ButtonGroupProps) {
  const visibleButtons = group.buttons.filter((b) => b.visible);
  if (visibleButtons.length === 0) return null;

  return (
    <div className={styles.group}>
      {group.label && <div className={styles.groupLabel}>{group.label}</div>}
      <div className={styles.buttons}>
        {visibleButtons.map((button) => (
          <ActionButtonComponent key={button.id} button={button} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}

interface ActionButtonComponentProps {
  button: ActionButton;
  onAction?: (actionId: string) => void;
}

function ActionButtonComponent({ button, onAction }: ActionButtonComponentProps) {
  const {
    id,
    label,
    icon,
    keyDisplay,
    enabled,
    highlighted,
    cooldown,
    cooldownRemaining,
    progress,
    progressColor,
    variant = 'primary',
    size = 'medium',
  } = button;

  const isOnCooldown = !!(cooldown && cooldownRemaining && cooldownRemaining > 0);
  const cooldownPercent = isOnCooldown ? ((cooldown - cooldownRemaining) / cooldown) * 100 : 100;

  const handleClick = () => {
    if (enabled && !isOnCooldown && onAction) {
      onAction(id);
    }
  };

  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    !enabled && styles.disabled,
    highlighted && styles.highlighted,
    isOnCooldown && styles.cooldown,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classNames} onClick={handleClick} disabled={!enabled || isOnCooldown}>
      {/* Cooldown overlay */}
      {isOnCooldown && (
        <div className={styles.cooldownOverlay} style={{ width: `${100 - cooldownPercent}%` }} />
      )}

      {/* Progress bar */}
      {progress !== undefined && progress > 0 && (
        <div
          className={styles.progressBar}
          style={{
            width: `${progress * 100}%`,
            backgroundColor: progressColor || '#4CAF50',
          }}
        />
      )}

      {/* Content */}
      <div className={styles.buttonContent}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
        <span className={styles.key}>{keyDisplay}</span>
      </div>
    </button>
  );
}
