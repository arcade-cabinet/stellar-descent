/**
 * StatisticsScreen - Comprehensive player statistics display
 *
 * Features:
 * - Overview tab with key metrics
 * - Combat stats with kill breakdowns
 * - Campaign progress with level times
 * - Weapon usage charts (bar charts)
 * - Enemy kill distribution (pie chart)
 * - Time played visualizations
 * - Military-style UI consistent with game aesthetic
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import { getLogger } from '../../game/core/Logger';
import { WEAPONS, type WeaponId } from '../../game/entities/weapons';
import { CAMPAIGN_LEVELS, type LevelId } from '../../game/levels/types';
import {
  calculateDerivedStats,
  createDefaultStats,
  type DerivedStats,
  getEnemyDisplayName,
  type PlayerStats,
} from '../../game/stats/PlayerStats';
import { getStatisticsTracker } from '../../game/stats/StatisticsTracker';
import styles from './StatisticsScreen.module.css';

interface StatisticsScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

type StatTab = 'overview' | 'combat' | 'campaign' | 'weapons' | 'enemies' | 'time';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${num.toFixed(1)}%`;
}

// ============================================================================
// CHART COMPONENTS
// ============================================================================

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  showValues?: boolean;
}

function BarChart({ data, maxValue, showValues = true }: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={styles.barChart}>
      {data.map((item) => (
        <div key={item.label} className={styles.barRow}>
          <span className={styles.barLabel}>{item.label}</span>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          {showValues && <span className={styles.barValue}>{formatNumber(item.value)}</span>}
        </div>
      ))}
    </div>
  );
}

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

function PieChart({ data, size = 120 }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className={styles.pieChartEmpty} style={{ width: size, height: size }}>
        <span>No data</span>
      </div>
    );
  }

  // Calculate pie segments
  let currentAngle = -90; // Start from top
  const segments: { path: string; color: string; label: string; percent: number }[] = [];

  for (const item of data) {
    if (item.value === 0) continue;

    const percent = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const endAngle = currentAngle + angle;

    // Calculate arc path
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const r = size / 2 - 2;
    const cx = size / 2;
    const cy = size / 2;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    segments.push({
      path,
      color: item.color,
      label: item.label,
      percent,
    });

    currentAngle = endAngle;
  }

  return (
    <div className={styles.pieChartContainer}>
      <svg width={size} height={size} className={styles.pieChart}>
        {segments.map((seg, i) => (
          <path key={i} d={seg.path} fill={seg.color} className={styles.pieSegment} />
        ))}
      </svg>
      <div className={styles.pieLegend}>
        {segments.map((seg, i) => (
          <div key={i} className={styles.legendItem}>
            <span className={styles.legendColor} style={{ backgroundColor: seg.color }} />
            <span className={styles.legendLabel}>{seg.label}</span>
            <span className={styles.legendPercent}>{formatPercent(seg.percent)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  highlight?: boolean;
}

function StatCard({ label, value, subLabel, highlight = false }: StatCardProps) {
  return (
    <div className={`${styles.statCard} ${highlight ? styles.highlight : ''}`}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {subLabel && <div className={styles.statSubLabel}>{subLabel}</div>}
    </div>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

function OverviewTab({ stats, derived }: { stats: PlayerStats; derived: DerivedStats }) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.statGrid}>
        <StatCard label="Total Kills" value={formatNumber(stats.totalKills)} highlight />
        <StatCard label="K/D Ratio" value={derived.kdRatio.toFixed(2)} />
        <StatCard label="Accuracy" value={formatPercent(stats.accuracy)} />
        <StatCard label="Deaths" value={formatNumber(stats.deaths)} />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Time Played</h3>
        <div className={styles.statGrid}>
          <StatCard label="Total Time" value={formatTime(stats.totalPlayTime)} highlight />
          <StatCard label="Longest Session" value={formatTime(stats.longestSession)} />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Campaign Progress</h3>
        <div className={styles.statGrid}>
          <StatCard label="Levels Completed" value={stats.levelsCompleted} subLabel="of 10" />
          <StatCard label="Campaign Completions" value={stats.campaignCompletions} />
          <StatCard
            label="Fastest Campaign"
            value={stats.fastestCampaign ? formatTime(stats.fastestCampaign) : '--:--'}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Collectibles</h3>
        <div className={styles.statGrid}>
          <StatCard label="Skulls Found" value={stats.skullsFound} />
          <StatCard label="Audio Logs" value={stats.audioLogsFound} />
          <StatCard label="Secrets" value={stats.secretsFound} />
          <StatCard label="Achievements" value={stats.achievementsUnlocked} />
        </div>
      </div>
    </div>
  );
}

function CombatTab({ stats }: { stats: PlayerStats }) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.statGrid}>
        <StatCard label="Total Kills" value={formatNumber(stats.totalKills)} highlight />
        <StatCard label="Headshots" value={formatNumber(stats.headshots)} />
        <StatCard label="Melee Kills" value={formatNumber(stats.meleeKills)} />
        <StatCard label="Grenade Kills" value={formatNumber(stats.grenadeKills)} />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Damage Stats</h3>
        <div className={styles.statGrid}>
          <StatCard label="Damage Dealt" value={formatNumber(stats.damageDealt)} />
          <StatCard label="Damage Taken" value={formatNumber(stats.damageTaken)} />
          <StatCard label="Health Healed" value={formatNumber(stats.healthHealed)} />
          <StatCard label="Armor Absorbed" value={formatNumber(stats.armorAbsorbed)} />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Accuracy</h3>
        <div className={styles.statGrid}>
          <StatCard label="Shots Fired" value={formatNumber(stats.shotsFired)} />
          <StatCard label="Shots Hit" value={formatNumber(stats.shotsHit)} />
          <StatCard label="Accuracy" value={formatPercent(stats.accuracy)} highlight />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Streaks</h3>
        <div className={styles.statGrid}>
          <StatCard label="Best Kill Streak" value={stats.highestKillStreak} />
          <StatCard label="Longest Without Death" value={stats.longestKillStreak} />
          <StatCard label="Bosses Defeated" value={stats.bossesDefeated} />
        </div>
      </div>
    </div>
  );
}

function CampaignTab({ stats }: { stats: PlayerStats }) {
  const levelData = useMemo(() => {
    return Object.entries(CAMPAIGN_LEVELS).map(([id, config]) => {
      const levelId = id as LevelId;
      const completions = stats.levelCompletionCounts[levelId] || 0;
      const bestTime = stats.levelBestTimes[levelId];
      const timeSpent = stats.timeByLevel[levelId] || 0;
      const deaths = stats.deathsByLevel[levelId] || 0;

      return {
        id: levelId,
        name: config.missionName,
        chapter: config.chapter,
        completions,
        bestTime,
        timeSpent,
        deaths,
      };
    });
  }, [stats]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.statGrid}>
        <StatCard label="Levels Completed" value={stats.levelsCompleted} highlight />
        <StatCard label="Campaign Completions" value={stats.campaignCompletions} />
        <StatCard
          label="Fastest Campaign"
          value={stats.fastestCampaign ? formatTime(stats.fastestCampaign) : '--:--'}
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Level Progress</h3>
        <div className={styles.levelGrid}>
          {levelData.map((level) => (
            <div
              key={level.id}
              className={`${styles.levelCard} ${level.completions > 0 ? styles.completed : ''}`}
            >
              <div className={styles.levelHeader}>
                <span className={styles.levelChapter}>CH.{level.chapter}</span>
                <span className={styles.levelName}>{level.name}</span>
              </div>
              <div className={styles.levelStats}>
                <span>Completions: {level.completions}</span>
                <span>Best: {level.bestTime ? formatTime(level.bestTime) : '--:--'}</span>
                <span>Deaths: {level.deaths}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeaponsTab({ stats }: { stats: PlayerStats }) {
  const weaponData = useMemo(() => {
    const data: { label: string; value: number; color: string }[] = [];

    for (const [weaponId, kills] of Object.entries(stats.killsByWeapon)) {
      if (kills && kills > 0) {
        const weapon = WEAPONS[weaponId as WeaponId];
        data.push({
          label: weapon?.shortName || weaponId,
          value: kills,
          color: getCategoryColor(weapon?.category || 'rifle'),
        });
      }
    }

    // Sort by kills descending
    data.sort((a, b) => b.value - a.value);

    return data.slice(0, 10); // Top 10
  }, [stats]);

  const accuracyData = useMemo(() => {
    const data: { label: string; value: number; color: string }[] = [];

    for (const [weaponId, shots] of Object.entries(stats.shotsFiredByWeapon)) {
      if (shots && shots > 10) {
        // Minimum 10 shots for meaningful accuracy
        const hits = stats.shotsHitByWeapon[weaponId as WeaponId] || 0;
        const accuracy = (hits / shots) * 100;
        const weapon = WEAPONS[weaponId as WeaponId];
        data.push({
          label: weapon?.shortName || weaponId,
          value: Math.round(accuracy * 10) / 10,
          color: getCategoryColor(weapon?.category || 'rifle'),
        });
      }
    }

    // Sort by accuracy descending
    data.sort((a, b) => b.value - a.value);

    return data.slice(0, 10); // Top 10
  }, [stats]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Kills by Weapon</h3>
        {weaponData.length > 0 ? (
          <BarChart data={weaponData} />
        ) : (
          <div className={styles.emptyState}>No weapon kills recorded yet</div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Accuracy by Weapon</h3>
        {accuracyData.length > 0 ? (
          <BarChart data={accuracyData} maxValue={100} />
        ) : (
          <div className={styles.emptyState}>Not enough data for accuracy stats</div>
        )}
      </div>
    </div>
  );
}

function EnemiesTab({ stats }: { stats: PlayerStats }) {
  const enemyData = useMemo(() => {
    const colors = [
      '#ff4040',
      '#ff8040',
      '#ffbb40',
      '#40ff40',
      '#40ffff',
      '#4080ff',
      '#8040ff',
      '#ff40ff',
      '#ff4080',
      '#80ff40',
    ];

    const data: { label: string; value: number; color: string }[] = [];
    let colorIndex = 0;

    for (const [enemyType, kills] of Object.entries(stats.killsByEnemy)) {
      if (kills && kills > 0) {
        data.push({
          label: getEnemyDisplayName(enemyType as any),
          value: kills,
          color: colors[colorIndex % colors.length],
        });
        colorIndex++;
      }
    }

    // Sort by kills descending
    data.sort((a, b) => b.value - a.value);

    return data;
  }, [stats]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Kills by Enemy Type</h3>
        {enemyData.length > 0 ? (
          <div className={styles.chartRow}>
            <PieChart data={enemyData} size={160} />
            <div className={styles.chartSide}>
              <BarChart data={enemyData.slice(0, 8)} showValues />
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>No enemy kills recorded yet</div>
        )}
      </div>
    </div>
  );
}

function TimeTab({ stats }: { stats: PlayerStats }) {
  const timeByLevelData = useMemo(() => {
    const data: { label: string; value: number; color: string }[] = [];

    for (const [levelId, time] of Object.entries(stats.timeByLevel)) {
      if (time && time > 0) {
        const level = CAMPAIGN_LEVELS[levelId as LevelId];
        data.push({
          label: level?.missionName || levelId,
          value: time,
          color: '#4a5d23',
        });
      }
    }

    // Sort by time descending
    data.sort((a, b) => b.value - a.value);

    return data.slice(0, 10); // Top 10
  }, [stats]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.statGrid}>
        <StatCard label="Total Play Time" value={formatTime(stats.totalPlayTime)} highlight />
        <StatCard label="Longest Session" value={formatTime(stats.longestSession)} />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Time by Level</h3>
        {timeByLevelData.length > 0 ? (
          <div className={styles.timeGrid}>
            {timeByLevelData.map((item) => (
              <div key={item.label} className={styles.timeCard}>
                <span className={styles.timeLevelName}>{item.label}</span>
                <span className={styles.timeLevelValue}>{formatTime(item.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>No level time data recorded yet</div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Milestones</h3>
        <div className={styles.milestoneGrid}>
          {stats.firstKillAt && (
            <div className={styles.milestone}>
              <span className={styles.milestoneLabel}>First Kill</span>
              <span className={styles.milestoneValue}>
                {new Date(stats.firstKillAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {stats.firstDeathAt && (
            <div className={styles.milestone}>
              <span className={styles.milestoneLabel}>First Death</span>
              <span className={styles.milestoneValue}>
                {new Date(stats.firstDeathAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {stats.firstCampaignCompleteAt && (
            <div className={styles.milestone}>
              <span className={styles.milestoneLabel}>First Campaign Complete</span>
              <span className={styles.milestoneValue}>
                {new Date(stats.firstCampaignCompleteAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    melee: '#ff8040',
    sidearm: '#ffbb40',
    smg: '#40ff80',
    rifle: '#40bbff',
    marksman: '#8040ff',
    shotgun: '#ff4040',
    heavy: '#ff40ff',
    vehicle: '#808080',
  };
  return colors[category] || '#666666';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const log = getLogger('StatisticsScreen');

export function StatisticsScreen({ isOpen, onClose }: StatisticsScreenProps) {
  const [activeTab, setActiveTab] = useState<StatTab>('overview');
  const [stats, setStats] = useState<PlayerStats>(createDefaultStats());
  const [derived, setDerived] = useState<DerivedStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stats on open
  useEffect(() => {
    if (!isOpen) return;

    const loadStats = async () => {
      setLoading(true);
      try {
        const tracker = getStatisticsTracker();
        await tracker.initialize();
        const currentStats = tracker.getStats();
        setStats(currentStats);
        setDerived(calculateDerivedStats(currentStats));
      } catch (error) {
        log.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [isOpen]);

  const handleTabChange = useCallback((tab: StatTab) => {
    setActiveTab(tab);
    try {
      getAudioManager().play('ui_click', { volume: 0.2 });
    } catch {
      // Audio may not be initialized
    }
  }, []);

  const handleClose = useCallback(() => {
    try {
      getAudioManager().play('ui_click', { volume: 0.3 });
    } catch {
      // Audio may not be initialized
    }
    onClose();
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!isOpen) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="statistics-title"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="statistics-title" className={styles.title}>
            Combat Statistics
          </h2>
        </div>

        {/* Tabs */}
        <div className={styles.tabs} role="tablist">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'combat', label: 'Combat' },
            { id: 'campaign', label: 'Campaign' },
            { id: 'weapons', label: 'Weapons' },
            { id: 'enemies', label: 'Enemies' },
            { id: 'time', label: 'Time' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => handleTabChange(tab.id as StatTab)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={styles.content} role="tabpanel">
          {loading ? (
            <div className={styles.loading}>Loading statistics...</div>
          ) : (
            <>
              {activeTab === 'overview' && derived && (
                <OverviewTab stats={stats} derived={derived} />
              )}
              {activeTab === 'combat' && <CombatTab stats={stats} />}
              {activeTab === 'campaign' && <CampaignTab stats={stats} />}
              {activeTab === 'weapons' && <WeaponsTab stats={stats} />}
              {activeTab === 'enemies' && <EnemiesTab stats={stats} />}
              {activeTab === 'time' && <TimeTab stats={stats} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerInfo}>
            Last updated: {new Date(stats.lastUpdated).toLocaleString()}
          </span>
          <button type="button" className={styles.closeButton} onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
