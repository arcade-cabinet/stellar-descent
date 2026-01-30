/**
 * SkullMenu - Skull Modifier Selection Panel
 *
 * A modal UI component that displays all skulls (found and unfound)
 * grouped by category. Players can toggle found skulls on/off to
 * modify gameplay difficulty and behaviour.
 *
 * Accessibility:
 * - Full keyboard navigation (Tab, Enter/Space, Escape)
 * - ARIA roles, labels, and descriptions
 * - Focus trapping within the modal
 * - Respects prefers-reduced-motion
 *
 * Integration:
 * - Reads from SkullSystem singleton for state
 * - Fires toggle actions back to SkullSystem
 * - Can be opened from MainMenu or in-game pause
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getSkullSystem,
  SKULL_ORDER,
  type SkullCategory,
  type SkullId,
  type SkullState,
} from '../../game/collectibles/SkullSystem';
import { getAudioManager } from '../../game/core/AudioManager';
import { CAMPAIGN_LEVELS, type LevelId } from '../../game/levels/types';
import styles from './SkullMenu.module.css';

// ============================================================================
// PROPS
// ============================================================================

interface SkullMenuProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Human-readable category labels */
const CATEGORY_LABELS: Record<SkullCategory, string> = {
  difficulty: 'DIFFICULTY SKULLS',
  mythic: 'MYTHIC SKULLS',
  fun: 'FUN SKULLS',
};

/** Category display order */
const CATEGORY_ORDER: SkullCategory[] = ['difficulty', 'mythic', 'fun'];

/** Get a readable level name from a LevelId */
function getLevelDisplayName(levelId: LevelId): string {
  const config = CAMPAIGN_LEVELS[levelId];
  return config?.missionName ?? levelId;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SkullMenu({ isOpen, onClose }: SkullMenuProps) {
  const [skullStates, setSkullStates] = useState<SkullState[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Sync state from the skull system
  const refreshState = useCallback(() => {
    const system = getSkullSystem();
    setSkullStates(system.getAllSkullStates());
  }, []);

  // Refresh on open and subscribe to changes
  useEffect(() => {
    if (!isOpen) return;
    refreshState();

    const unsubscribe = getSkullSystem().onChange(refreshState);
    return unsubscribe;
  }, [isOpen, refreshState]);

  // Focus trap: focus the close button when opening
  useEffect(() => {
    if (isOpen) {
      // Delay to allow render
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Toggle skull active state
  const handleToggle = useCallback((skullId: SkullId, isFound: boolean) => {
    if (!isFound) return;

    const system = getSkullSystem();
    system.toggleSkull(skullId);

    getAudioManager().play('ui_click', { volume: 0.3 });
  }, []);

  // Derived data
  const grouped = useMemo(() => {
    const groups: Record<SkullCategory, SkullState[]> = {
      difficulty: [],
      mythic: [],
      fun: [],
    };
    for (const state of skullStates) {
      groups[state.definition.category].push(state);
    }
    return groups;
  }, [skullStates]);

  const activeCount = useMemo(() => skullStates.filter((s) => s.active).length, [skullStates]);

  const foundCount = useMemo(() => skullStates.filter((s) => s.found).length, [skullStates]);

  const totalScoreMultiplier = useMemo(() => {
    let multiplier = 1.0;
    for (const state of skullStates) {
      if (state.active) {
        multiplier *= state.definition.scoreMultiplier;
      }
    }
    return multiplier;
  }, [skullStates]);

  const hasDifficultySkulls = useMemo(
    () => skullStates.some((s) => s.active && s.definition.category !== 'fun'),
    [skullStates]
  );

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="presentation"
    >
      {/* Panel */}
      <div
        ref={panelRef}
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skull-menu-title"
        aria-describedby="skull-menu-desc"
      >
        {/* Corner decorations */}
        <div className={styles.cornerTL} />
        <div className={styles.cornerTR} />
        <div className={styles.cornerBL} />
        <div className={styles.cornerBR} />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon} aria-hidden="true">
              {'\u{1F480}'}
            </span>
            <h2 id="skull-menu-title" className={styles.headerTitle}>
              SKULL MODIFIERS
            </h2>
          </div>
          <span className={styles.headerCount}>
            {foundCount} / {SKULL_ORDER.length} FOUND
          </span>
        </div>

        {/* Warning banner (shown when difficulty skulls are active) */}
        {hasDifficultySkulls && (
          <div className={styles.warningBanner} role="alert">
            <span className={styles.warningIcon} aria-hidden="true">
              /!\
            </span>
            <span className={styles.warningText} id="skull-menu-desc">
              Difficulty skulls are active. Enemies will be stronger and gameplay will be more
              challenging. Score multiplier: x{totalScoreMultiplier.toFixed(2)}.
            </span>
          </div>
        )}

        {/* Skull list */}
        <div className={styles.content} role="list" aria-label="Skull modifiers">
          {foundCount === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden="true">
                {'\u{1F480}'}
              </span>
              <p className={styles.emptyText}>
                No skulls discovered yet.
                <br />
                Explore hidden areas in each level to find them.
              </p>
            </div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const skulls = grouped[category];
              if (skulls.length === 0) return null;

              return (
                <div key={category} className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryLine} />
                    <span className={styles.categoryLabel}>{CATEGORY_LABELS[category]}</span>
                    <span className={styles.categoryLine} />
                  </div>

                  <div className={styles.skullGrid}>
                    {skulls.map((skullState) => (
                      <SkullCard
                        key={skullState.definition.id}
                        skullState={skullState}
                        onToggle={handleToggle}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerInfo}>
            {activeCount > 0 ? (
              <span>
                {activeCount} ACTIVE{' '}
                <span className={styles.footerMultiplier}>
                  x{totalScoreMultiplier.toFixed(2)} SCORE
                </span>
              </span>
            ) : (
              <span>NO SKULLS ACTIVE</span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close skull menu"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKULL CARD SUB-COMPONENT
// ============================================================================

interface SkullCardProps {
  skullState: SkullState;
  onToggle: (id: SkullId, found: boolean) => void;
}

function SkullCard({ skullState, onToggle }: SkullCardProps) {
  const { definition, found, active } = skullState;

  const cardClassName = [
    styles.skullCard,
    active ? styles.skullCardActive : '',
    !found ? styles.skullCardLocked : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = useCallback(() => {
    onToggle(definition.id, found);
  }, [definition.id, found, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(definition.id, found);
      }
    },
    [definition.id, found, onToggle]
  );

  const statusLabel = !found ? 'Locked' : active ? 'Active' : 'Inactive';

  const ariaLabel = found
    ? `${definition.name} skull. ${definition.description}. Currently ${statusLabel.toLowerCase()}. Press Enter to toggle.`
    : `${definition.name} skull. Not yet discovered. Hidden in ${getLevelDisplayName(definition.levelFound)}.`;

  return (
    <div
      className={cardClassName}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="listitem"
      tabIndex={found ? 0 : -1}
      aria-label={ariaLabel}
      aria-pressed={found ? active : undefined}
      aria-disabled={!found}
    >
      {/* Icon */}
      <div className={styles.skullIcon} aria-hidden="true">
        {found ? definition.icon : '?'}
      </div>

      {/* Info */}
      <div className={styles.skullInfo}>
        <p className={styles.skullName}>{found ? definition.name : '???'}</p>
        <p className={styles.skullDescription}>
          {found
            ? definition.description
            : `Hidden in ${getLevelDisplayName(definition.levelFound)}`}
        </p>
        {!found && <p className={styles.skullLevel}>Explore to discover</p>}
      </div>

      {/* Score multiplier badge (only for found skulls with > 1.0) */}
      {found && definition.scoreMultiplier > 1.0 && (
        <span
          className={styles.scoreBadge}
          aria-label={`Score multiplier: ${definition.scoreMultiplier}x`}
        >
          x{definition.scoreMultiplier.toFixed(1)}
        </span>
      )}

      {/* Toggle status */}
      <div
        className={[
          styles.skullStatus,
          active ? styles.skullStatusActive : '',
          !found ? styles.skullStatusLocked : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      >
        {!found ? '\u2013' : active ? '\u2713' : '\u25CB'}
      </div>
    </div>
  );
}
