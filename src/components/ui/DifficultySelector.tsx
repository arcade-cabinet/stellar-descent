/**
 * DifficultySelector - UI component for selecting game difficulty
 *
 * Can be used in:
 * - Settings menu (inline)
 * - Main menu (modal)
 * - Pre-game screen
 *
 * Layout: Bottom row shows nightmare | permadeath toggle | ultra-nightmare
 * Permadeath toggle adds +50% XP to any difficulty when enabled
 */

import { useCallback, useEffect, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import {
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  type DifficultyLevel,
  isPermadeathActive,
  loadPermadeathSetting,
  PERMADEATH_XP_BONUS,
  savePermadeathSetting,
} from '../../game/core/DifficultySettings';
import { useDifficultyStore } from '../../game/difficulty';
import styles from './DifficultySelector.module.css';

interface DifficultySelectorProps {
  /** Compact mode for inline use in settings */
  compact?: boolean;
  /** Called when difficulty is changed */
  onSelect?: (difficulty: DifficultyLevel) => void;
  /** Called when permadeath toggle changes */
  onPermadeathChange?: (enabled: boolean) => void;
}

export function DifficultySelector({
  compact = false,
  onSelect,
  onPermadeathChange,
}: DifficultySelectorProps) {
  const difficulty = useDifficultyStore((state) => state.difficulty);
  const setDifficulty = useDifficultyStore((state) => state.setDifficulty);
  const [permadeathEnabled, setPermadeathEnabled] = useState(loadPermadeathSetting);

  // Load permadeath setting on mount
  useEffect(() => {
    setPermadeathEnabled(loadPermadeathSetting());
  }, []);

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

  const handlePermadeathToggle = useCallback(() => {
    playClickSound();
    const newValue = !permadeathEnabled;
    setPermadeathEnabled(newValue);
    savePermadeathSetting(newValue);
    onPermadeathChange?.(newValue);
  }, [permadeathEnabled, playClickSound, onPermadeathChange]);

  // Split difficulties: top row (easy, normal, hard) and bottom row (nightmare, ultra_nightmare)
  const topDifficulties = DIFFICULTY_ORDER.filter(
    (d) => !['nightmare', 'ultra_nightmare'].includes(d)
  );
  const bottomDifficulties = DIFFICULTY_ORDER.filter((d) =>
    ['nightmare', 'ultra_nightmare'].includes(d)
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

  // Check if permadeath is active for current difficulty
  const permadeathActive = isPermadeathActive(difficulty, permadeathEnabled);

  // Full mode: cards with bottom row showing nightmare | permadeath toggle | ultra-nightmare
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>SELECT DIFFICULTY</h3>

      {/* Top difficulties: easy, normal, hard */}
      <div className={styles.grid}>
        {topDifficulties.map((level) => {
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

      {/* Bottom row: nightmare | permadeath toggle | ultra-nightmare */}
      <div className={styles.bottomRow}>
        {/* Nightmare */}
        {bottomDifficulties.slice(0, 1).map((level) => {
          const info = DIFFICULTY_PRESETS[level];
          const isSelected = difficulty === level;
          return (
            <button
              key={level}
              type="button"
              className={`${styles.card} ${styles.bottomCard} ${isSelected ? styles.cardSelected : ''}`}
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
                <ModifierBadge label="XP" value={info.modifiers.xpMultiplier} />
              </div>
            </button>
          );
        })}

        {/* Permadeath Toggle */}
        <button
          type="button"
          className={`${styles.permadeathToggle} ${permadeathActive ? styles.permadeathActive : ''}`}
          onClick={handlePermadeathToggle}
          disabled={DIFFICULTY_PRESETS[difficulty].modifiers.forcesPermadeath}
          aria-pressed={permadeathActive}
        >
          <div className={styles.permadeathIcon}>{'\u2620'}</div>
          <div className={styles.permadeathLabel}>PERMADEATH</div>
          <div className={styles.permadeathStatus}>
            {DIFFICULTY_PRESETS[difficulty].modifiers.forcesPermadeath
              ? 'FORCED'
              : permadeathEnabled
                ? 'ON'
                : 'OFF'}
          </div>
          {permadeathActive && !DIFFICULTY_PRESETS[difficulty].modifiers.forcesPermadeath && (
            <div className={styles.permadeathBonus}>
              +{Math.round(PERMADEATH_XP_BONUS * 100)}% XP
            </div>
          )}
        </button>

        {/* Ultra-Nightmare */}
        {bottomDifficulties.slice(1).map((level) => {
          const info = DIFFICULTY_PRESETS[level];
          const isSelected = difficulty === level;
          return (
            <button
              key={level}
              type="button"
              className={`${styles.card} ${styles.bottomCard} ${styles.ultraNightmare} ${isSelected ? styles.cardSelected : ''}`}
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
                <ModifierBadge label="XP" value={info.modifiers.xpMultiplier} />
                <span className={`${styles.badge} ${styles.badgeSkull}`}>
                  {'\u2620'} PERMADEATH
                </span>
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
