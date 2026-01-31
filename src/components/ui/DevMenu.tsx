import { useCallback, useEffect, useState } from 'react';
import { getAchievementManager } from '../../game/achievements';
import { useCampaign } from '../../game/campaign/useCampaign';
import { devMode } from '../../game/core/DevMode';
import { CAMPAIGN_LEVELS, type LevelId } from '../../game/levels/types';

// ============================================================================
// Constants
// ============================================================================

/** Ordered level IDs matching campaign progression */
const LEVEL_ORDER: LevelId[] = [
  'anchor_station',
  'landfall',
  'canyon_run',
  'fob_delta',
  'brothers_in_arms',
  'southern_ice',
  'the_breach',
  'hive_assault',
  'extraction',
  'final_escape',
];

/**
 * Map campaign phase to the next logical skip command.
 * Returns null when skipping is not meaningful for the current phase.
 */
function getSkipCommand(phase: string): { type: string; stats?: any } | null {
  switch (phase) {
    case 'splash':
      return { type: 'SPLASH_COMPLETE' };
    case 'title':
      return { type: 'TITLE_COMPLETE' };
    case 'introBriefing':
      return { type: 'INTRO_BRIEFING_COMPLETE' };
    case 'briefing':
      return { type: 'BEGIN_MISSION' };
    case 'intro':
      return { type: 'INTRO_COMPLETE' };
    case 'loading':
      return { type: 'LOADING_COMPLETE' };
    case 'tutorial':
      return { type: 'TUTORIAL_COMPLETE' };
    case 'dropping':
      return { type: 'DROP_COMPLETE' };
    case 'playing': {
      const levelStats = getAchievementManager().getLevelStats();
      return {
        type: 'LEVEL_COMPLETE',
        stats: {
          timeElapsed: 60, // Dev mode: 1 minute elapsed
          kills: levelStats.kills,
          shotsFired: levelStats.shotsFired,
          shotsHit: levelStats.shotsHit,
          secretsFound: levelStats.secretsFound,
          totalSecrets: 2, // Dev mode: assume 2 secrets per level
        },
      };
    }
    case 'levelComplete':
      return { type: 'ADVANCE' };
    case 'gameover':
      return { type: 'RETRY' };
    case 'paused':
      return { type: 'RESUME' };
    case 'credits':
      return { type: 'CREDITS_DONE' };
    default:
      return null;
  }
}

// ============================================================================
// Styles
// ============================================================================

const S = {
  overlay: {
    position: 'fixed' as const,
    top: 8,
    right: 8,
    zIndex: 99999,
    width: 320,
    maxHeight: 'calc(100vh - 16px)',
    overflowY: 'auto' as const,
    background: 'rgba(5, 12, 5, 0.92)',
    border: '1px solid #1a3a1a',
    borderTop: '2px solid #33ff33',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: 11,
    color: '#33ff33',
    boxShadow: '0 0 20px rgba(0, 255, 0, 0.08), inset 0 0 60px rgba(0, 20, 0, 0.3)',
    userSelect: 'none' as const,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    background: 'rgba(0, 40, 0, 0.5)',
    borderBottom: '1px solid #1a3a1a',
    letterSpacing: '0.1em',
  },

  headerTitle: {
    fontWeight: 700,
    fontSize: 11,
    textTransform: 'uppercase' as const,
  },

  headerHint: {
    fontSize: 9,
    color: '#1a6a1a',
    fontStyle: 'italic' as const,
  },

  section: {
    padding: '8px 10px',
    borderBottom: '1px solid #0d1f0d',
  },

  sectionLabel: {
    fontSize: 9,
    color: '#1a6a1a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    marginBottom: 6,
  },

  levelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 3,
  },

  levelBtn: (isActive: boolean) => ({
    background: isActive ? '#33ff33' : 'rgba(0, 40, 0, 0.6)',
    color: isActive ? '#050c05' : '#33ff33',
    border: `1px solid ${isActive ? '#33ff33' : '#1a3a1a'}`,
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: 10,
    fontWeight: isActive ? 800 : 400,
    padding: '4px 2px',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.1s',
  }),

  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '3px 0',
    cursor: 'pointer',
  },

  checkbox: {
    accentColor: '#33ff33',
    width: 13,
    height: 13,
    cursor: 'pointer',
  },

  checkboxLabel: {
    cursor: 'pointer',
    letterSpacing: '0.05em',
  },

  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
  },

  statKey: {
    color: '#1a6a1a',
  },

  statValue: {
    color: '#33ff33',
    fontWeight: 700,
  },

  skipBtn: {
    width: '100%',
    padding: '6px 0',
    background: 'rgba(60, 40, 0, 0.5)',
    color: '#ffaa33',
    border: '1px solid #4a3a1a',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'all 0.1s',
  },

  scanline: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none' as const,
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 20, 0, 0.15) 2px, rgba(0, 20, 0, 0.15) 4px)',
    zIndex: 1,
  },
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * DevMenu - Developer tools overlay for Stellar Descent
 *
 * Only renders when VITE_DEV_MENU=true. Toggle with backtick key.
 * Provides level jumping, god mode, noclip, collider display,
 * phase inspection, and skip-phase controls.
 */
export function DevMenu() {
  const [visible, setVisible] = useState(false);
  const [snapshot, dispatch] = useCampaign();

  // Local mirrors of devMode so checkboxes re-render on toggle
  const [godMode, setGodMode] = useState(devMode.godMode);
  const [noclip, setNoclip] = useState(devMode.noclip);
  const [showColliders, setShowColliders] = useState(devMode.showColliders);
  const [showEntityCount, setShowEntityCount] = useState(devMode.showEntityCount);
  const [showFPS, setShowFPS] = useState(devMode.showFPS);

  // Gate: only active when env var is set
  const enabled = import.meta.env.VITE_DEV_MENU === 'true';

  // Toggle visibility with backtick key
  useEffect(() => {
    if (!enabled) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled]);

  // Checkbox toggle helpers
  const toggleGodMode = useCallback(() => {
    devMode.godMode = !devMode.godMode;
    setGodMode(devMode.godMode);
  }, []);

  const toggleNoclip = useCallback(() => {
    devMode.noclip = !devMode.noclip;
    setNoclip(devMode.noclip);
  }, []);

  const toggleColliders = useCallback(() => {
    devMode.showColliders = !devMode.showColliders;
    setShowColliders(devMode.showColliders);
  }, []);

  const toggleEntityCount = useCallback(() => {
    devMode.showEntityCount = !devMode.showEntityCount;
    setShowEntityCount(devMode.showEntityCount);
  }, []);

  const toggleFPS = useCallback(() => {
    devMode.showFPS = !devMode.showFPS;
    setShowFPS(devMode.showFPS);
  }, []);

  // Level jump handler
  const jumpToLevel = useCallback(
    (levelId: LevelId) => {
      dispatch({ type: 'DEV_JUMP_TO_LEVEL', levelId });
    },
    [dispatch],
  );

  // Skip phase handler
  const handleSkipPhase = useCallback(() => {
    const cmd = getSkipCommand(snapshot.phase);
    if (cmd) {
      dispatch(cmd as any);
    }
  }, [snapshot.phase, dispatch]);

  // ---- Early returns after all hooks ----

  if (!enabled || !visible) return null;

  const skipCmd = getSkipCommand(snapshot.phase);

  return (
    <div style={{ ...S.overlay, position: 'fixed' }}>
      {/* CRT scanline overlay */}
      <div style={S.scanline} />

      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>// DEV CONSOLE</span>
        <span style={S.headerHint}>[`] toggle</span>
      </div>

      {/* Level Selector */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Level Select</div>
        <div style={S.levelGrid}>
          {LEVEL_ORDER.map((id, i) => {
            const isActive = snapshot.currentLevelId === id;
            return (
              <button
                key={id}
                type="button"
                style={S.levelBtn(isActive)}
                onClick={() => jumpToLevel(id)}
                title={CAMPAIGN_LEVELS[id].missionName}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 80, 0, 0.8)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#33ff33';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 40, 0, 0.6)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a3a1a';
                  }
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Cheats</div>

        <label style={S.checkboxRow}>
          <input
            type="checkbox"
            checked={godMode}
            onChange={toggleGodMode}
            style={S.checkbox}
          />
          <span style={S.checkboxLabel}>God Mode</span>
        </label>

        <label style={S.checkboxRow}>
          <input
            type="checkbox"
            checked={noclip}
            onChange={toggleNoclip}
            style={S.checkbox}
          />
          <span style={S.checkboxLabel}>Noclip</span>
        </label>

        <label style={S.checkboxRow}>
          <input
            type="checkbox"
            checked={showColliders}
            onChange={toggleColliders}
            style={S.checkbox}
          />
          <span style={S.checkboxLabel}>Show Colliders</span>
        </label>

        <label style={S.checkboxRow}>
          <input
            type="checkbox"
            checked={showEntityCount}
            onChange={toggleEntityCount}
            style={S.checkbox}
          />
          <span style={S.checkboxLabel}>Show Entity Count</span>
        </label>

        <label style={S.checkboxRow}>
          <input
            type="checkbox"
            checked={showFPS}
            onChange={toggleFPS}
            style={S.checkbox}
          />
          <span style={S.checkboxLabel}>Show FPS</span>
        </label>
      </div>

      {/* Campaign State */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Campaign State</div>

        <div style={S.statRow}>
          <span style={S.statKey}>Phase</span>
          <span style={S.statValue}>{snapshot.phase}</span>
        </div>

        <div style={S.statRow}>
          <span style={S.statKey}>Level</span>
          <span style={S.statValue}>{snapshot.currentLevelId}</span>
        </div>

        <div style={S.statRow}>
          <span style={S.statKey}>Restarts</span>
          <span style={S.statValue}>{snapshot.restartCounter}</span>
        </div>
      </div>

      {/* Skip Phase */}
      <div style={S.section}>
        <button
          type="button"
          style={{
            ...S.skipBtn,
            opacity: skipCmd ? 1 : 0.35,
            cursor: skipCmd ? 'pointer' : 'default',
          }}
          onClick={handleSkipPhase}
          disabled={!skipCmd}
          onMouseEnter={(e) => {
            if (skipCmd) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(80, 60, 0, 0.7)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(60, 40, 0, 0.5)';
          }}
        >
          {skipCmd ? `Skip Phase [${snapshot.phase}]` : 'No skip available'}
        </button>
      </div>
    </div>
  );
}
