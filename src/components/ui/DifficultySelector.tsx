/**
 * DifficultySelector - UI component for selecting game difficulty
 *
 * Can be used in:
 * - Settings menu (inline)
 * - Main menu (modal)
 * - Pre-game screen
 */

import React, { useCallback } from 'react';
import { useGame } from '../../game/context/GameContext';
import { getAudioManager } from '../../game/core/AudioManager';
import {
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
} from '../../game/core/DifficultySettings';
import styles from './DifficultySelector.module.css';

interface DifficultySelectorProps {
  /** Compact mode for inline use in settings */
  compact?: boolean;
  /** Called when difficulty is changed */
  onSelect?: (difficulty: DifficultyLevel) => void;
}

export function DifficultySelector({ compact = false, onSelect }: DifficultySelectorProps) {
  const { difficulty, setDifficulty } = useGame();

  const playClickSound = useCallback(() => {
    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  const handleSelect = useCallback(
    (newDifficulty: DifficultyLevel) => {
      playClickSound();
      setDifficulty(newDifficulty);
      onSelect?.(newDifficulty);
    },
    [playClickSound, setDifficulty, onSelect]
  );

  if (compact) {
    // Compact mode: horizontal button row for settings menu
    return (
      <div className={styles.compactContainer}>
        <div className={styles.compactLabel}>DIFFICULTY</div>
        <div className={styles.compactButtons}>
          {DIFFICULTY_ORDER.map((level) => {
            const info = DIFFICULTY_PRESETS[level];
            const isSelected = difficulty === level;
            return (
              <button
                key={level}
                type="button"
                className={`${styles.compactButton} ${isSelected ? styles.selected : ''}`}
                onClick={() => handleSelect(level)}
                title={info.description}
                aria-pressed={isSelected}
              >
                {info.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Full mode: vertical cards with descriptions
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>SELECT DIFFICULTY</h3>
      <div className={styles.grid}>
        {DIFFICULTY_ORDER.map((level) => {
          const info = DIFFICULTY_PRESETS[level];
          const isSelected = difficulty === level;
          return (
            <button
              key={level}
              type="button"
              className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
              onClick={() => handleSelect(level)}
              aria-pressed={isSelected}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardName}>{info.name}</span>
                {isSelected && <span className={styles.cardCheck}>&#10003;</span>}
              </div>
              <p className={styles.cardDescription}>{info.description}</p>
              <div className={styles.cardModifiers}>
                <ModifierBadge label="Enemy HP" value={info.modifiers.enemyHealthMultiplier} />
                <ModifierBadge
                  label="Damage Taken"
                  value={info.modifiers.playerDamageReceivedMultiplier}
                />
                <ModifierBadge label="XP Bonus" value={info.modifiers.xpMultiplier} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ModifierBadgeProps {
  label: string;
  value: number;
}

function ModifierBadge({ label, value }: ModifierBadgeProps) {
  const percentage = Math.round(value * 100);
  const isReduced = value < 1;
  const isIncreased = value > 1;

  return (
    <span
      className={`${styles.badge} ${isReduced ? styles.badgeGreen : ''} ${isIncreased ? styles.badgeRed : ''}`}
    >
      {label}: {percentage}%
    </span>
  );
}
