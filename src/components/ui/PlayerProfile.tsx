/**
 * PlayerProfile - Player profile display and editing
 *
 * Features:
 * - Player name (editable)
 * - Avatar selection
 * - Level/XP display
 * - Featured achievement
 * - Quick stats summary
 * - Military-style UI consistent with game aesthetic
 */

import { useCallback, useEffect, useState } from 'react';
import { getAchievementManager } from '../../game/achievements';
import { getAudioManager } from '../../game/core/AudioManager';
import { worldDb } from '../../game/db/worldDatabase';
import { WEAPONS, type WeaponId } from '../../game/entities/weapons';
import {
  calculateDerivedStats,
  createDefaultStats,
  type PlayerStats,
} from '../../game/stats/PlayerStats';
import { getStatisticsTracker } from '../../game/stats/StatisticsTracker';
import styles from './PlayerProfile.module.css';

// ============================================================================
// TYPES
// ============================================================================

interface PlayerProfileProps {
  isOpen: boolean;
  onClose: () => void;
  compact?: boolean; // For inline display in menus
}

interface PlayerProfileData {
  name: string;
  avatarId: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  featuredAchievementId: string | null;
  createdAt: number;
}

// Storage key for profile data
const PROFILE_STORAGE_KEY = 'player_profile';

// Available avatars (military ranks/icons)
const AVATARS = [
  { id: 'marine', icon: '7', label: 'Marine' },
  { id: 'corporal', icon: 'II', label: 'Corporal' },
  { id: 'sergeant', icon: 'III', label: 'Sergeant' },
  { id: 'lieutenant', icon: 'LT', label: 'Lieutenant' },
  { id: 'captain', icon: 'CPT', label: 'Captain' },
  { id: 'major', icon: 'MAJ', label: 'Major' },
  { id: 'colonel', icon: 'COL', label: 'Colonel' },
  { id: 'general', icon: 'GEN', label: 'General' },
];

// XP required per level (exponential growth)
function getXpForLevel(level: number): number {
  return Math.floor(100 * 1.5 ** (level - 1));
}

// Calculate level from total XP
function calculateLevel(totalXp: number): { level: number; currentXp: number; xpToNext: number } {
  let level = 1;
  let remainingXp = totalXp;

  while (remainingXp >= getXpForLevel(level)) {
    remainingXp -= getXpForLevel(level);
    level++;
  }

  return {
    level,
    currentXp: remainingXp,
    xpToNext: getXpForLevel(level),
  };
}

// Calculate XP from stats
function calculateTotalXp(stats: PlayerStats): number {
  let xp = 0;

  // Kills give XP
  xp += stats.totalKills * 10;
  xp += stats.headshots * 5;
  xp += stats.bossesDefeated * 100;

  // Level completions give XP
  xp += stats.levelsCompleted * 200;
  xp += stats.campaignCompletions * 1000;

  // Collectibles give XP
  xp += stats.skullsFound * 50;
  xp += stats.audioLogsFound * 30;
  xp += stats.secretsFound * 40;

  // Achievements give XP
  xp += stats.achievementsUnlocked * 100;

  return xp;
}

// ============================================================================
// DEFAULT PROFILE
// ============================================================================

function createDefaultProfile(): PlayerProfileData {
  return {
    name: 'MARINE',
    avatarId: 'marine',
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    featuredAchievementId: null,
    createdAt: Date.now(),
  };
}

// ============================================================================
// COMPACT PROFILE COMPONENT (for menu display)
// ============================================================================

interface CompactProfileProps {
  profile: PlayerProfileData;
  stats: PlayerStats;
  onClick?: () => void;
}

function CompactProfile({ profile, stats, onClick }: CompactProfileProps) {
  const avatar = AVATARS.find((a) => a.id === profile.avatarId) || AVATARS[0];
  const derived = calculateDerivedStats(stats);

  return (
    <button type="button" className={styles.compactProfile} onClick={onClick}>
      <div className={styles.compactAvatar}>
        <span>{avatar.icon}</span>
      </div>
      <div className={styles.compactInfo}>
        <div className={styles.compactName}>{profile.name}</div>
        <div className={styles.compactLevel}>Level {profile.level}</div>
      </div>
      <div className={styles.compactStats}>
        <span>{stats.totalKills} Kills</span>
        <span>{derived.kdRatio.toFixed(1)} K/D</span>
      </div>
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PlayerProfile({ isOpen, onClose, compact = false }: PlayerProfileProps) {
  const [profile, setProfile] = useState<PlayerProfileData>(createDefaultProfile());
  const [stats, setStats] = useState<PlayerStats>(createDefaultStats());
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectingAvatar, setSelectingAvatar] = useState(false);
  const [featuredAchievement, setFeaturedAchievement] = useState<{
    name: string;
    icon: string;
    description: string;
  } | null>(null);

  // Load profile and stats
  useEffect(() => {
    if (!isOpen && !compact) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Initialize database
        await worldDb.init();

        // Load profile
        const storedProfile = await worldDb.getChunkData(PROFILE_STORAGE_KEY);
        let loadedProfile = createDefaultProfile();
        if (storedProfile) {
          loadedProfile = { ...loadedProfile, ...JSON.parse(storedProfile) };
        }

        // Load stats
        const tracker = getStatisticsTracker();
        await tracker.initialize();
        const currentStats = tracker.getStats();

        // Calculate XP and level from stats
        const totalXp = calculateTotalXp(currentStats);
        const levelInfo = calculateLevel(totalXp);

        loadedProfile.xp = totalXp;
        loadedProfile.level = levelInfo.level;
        loadedProfile.xpToNextLevel = levelInfo.xpToNext;

        setProfile(loadedProfile);
        setStats(currentStats);
        setEditName(loadedProfile.name);

        // Load featured achievement if set
        if (loadedProfile.featuredAchievementId) {
          const manager = getAchievementManager();
          const achievement = manager
            .getAllAchievements()
            .find((a) => a.achievement.id === loadedProfile.featuredAchievementId);
          if (achievement?.state.unlockedAt) {
            setFeaturedAchievement({
              name: achievement.achievement.name,
              icon: achievement.achievement.icon,
              description: achievement.achievement.description,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, compact]);

  // Save profile
  const saveProfile = useCallback(async (updatedProfile: PlayerProfileData) => {
    try {
      await worldDb.setChunkData(PROFILE_STORAGE_KEY, JSON.stringify(updatedProfile));
      worldDb.persistToIndexedDB();
    } catch (error) {
      console.error('Failed to save profile:', error);
    }
  }, []);

  // Handle name edit
  const handleSaveName = useCallback(() => {
    if (editName.trim().length > 0) {
      const updatedProfile = { ...profile, name: editName.trim().toUpperCase() };
      setProfile(updatedProfile);
      saveProfile(updatedProfile);
    }
    setEditing(false);
    try {
      getAudioManager().play('ui_click', { volume: 0.3 });
    } catch {
      // Audio may not be initialized
    }
  }, [editName, profile, saveProfile]);

  // Handle avatar selection
  const handleSelectAvatar = useCallback(
    (avatarId: string) => {
      const updatedProfile = { ...profile, avatarId };
      setProfile(updatedProfile);
      saveProfile(updatedProfile);
      setSelectingAvatar(false);
      try {
        getAudioManager().play('ui_click', { volume: 0.3 });
      } catch {
        // Audio may not be initialized
      }
    },
    [profile, saveProfile]
  );

  // Handle featured achievement selection
  const _handleSelectFeaturedAchievement = useCallback(
    (achievementId: string | null) => {
      const updatedProfile = { ...profile, featuredAchievementId: achievementId };
      setProfile(updatedProfile);
      saveProfile(updatedProfile);

      // Update displayed achievement
      if (achievementId) {
        const manager = getAchievementManager();
        const achievement = manager
          .getAllAchievements()
          .find((a) => a.achievement.id === achievementId);
        if (achievement?.state.unlockedAt) {
          setFeaturedAchievement({
            name: achievement.achievement.name,
            icon: achievement.achievement.icon,
            description: achievement.achievement.description,
          });
        }
      } else {
        setFeaturedAchievement(null);
      }
    },
    [profile, saveProfile]
  );

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
        if (editing) {
          setEditing(false);
        } else if (selectingAvatar) {
          setSelectingAvatar(false);
        } else {
          handleClose();
        }
      }
    },
    [editing, selectingAvatar, handleClose]
  );

  // Compact mode - just render inline profile
  if (compact) {
    return <CompactProfile profile={profile} stats={stats} onClick={onClose} />;
  }

  if (!isOpen) return null;

  const avatar = AVATARS.find((a) => a.id === profile.avatarId) || AVATARS[0];
  const derived = calculateDerivedStats(stats);
  const levelProgress = calculateLevel(profile.xp);
  const favoriteWeapon = derived.favoriteWeapon
    ? WEAPONS[derived.favoriteWeapon as WeaponId]?.name
    : 'None';

  return (
    // biome-ignore lint/a11y/useSemanticElements: Overlay needs to be a div for layout
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {loading ? (
          <div className={styles.loading}>Loading profile...</div>
        ) : (
          <>
            {/* Header with avatar and name */}
            <div className={styles.profileHeader}>
              <button
                type="button"
                className={styles.avatarButton}
                onClick={() => setSelectingAvatar(true)}
                aria-label="Change avatar"
              >
                <div className={styles.avatarLarge}>
                  <span>{avatar.icon}</span>
                </div>
                <div className={styles.avatarChange}>Change</div>
              </button>

              <div className={styles.profileInfo}>
                {editing ? (
                  <div className={styles.nameEdit}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value.toUpperCase())}
                      maxLength={20}
                      className={styles.nameInput}
                    />
                    <button type="button" className={styles.saveButton} onClick={handleSaveName}>
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.nameButton}
                    onClick={() => {
                      setEditing(true);
                      setEditName(profile.name);
                    }}
                  >
                    <h2 id="profile-title" className={styles.profileName}>
                      {profile.name}
                    </h2>
                    <span className={styles.editHint}>Edit</span>
                  </button>
                )}

                <div className={styles.levelBadge}>
                  <span className={styles.levelLabel}>Level</span>
                  <span className={styles.levelValue}>{profile.level}</span>
                </div>
              </div>
            </div>

            {/* XP Progress */}
            <div className={styles.xpSection}>
              <div className={styles.xpInfo}>
                <span className={styles.xpLabel}>Experience</span>
                <span className={styles.xpValue}>
                  {levelProgress.currentXp.toLocaleString()} /{' '}
                  {levelProgress.xpToNext.toLocaleString()} XP
                </span>
              </div>
              <div className={styles.xpBar}>
                <div
                  className={styles.xpFill}
                  style={{ width: `${(levelProgress.currentXp / levelProgress.xpToNext) * 100}%` }}
                />
              </div>
              <span className={styles.totalXp}>Total: {profile.xp.toLocaleString()} XP</span>
            </div>

            {/* Featured Achievement */}
            <div className={styles.featuredSection}>
              <h3 className={styles.sectionTitle}>Featured Achievement</h3>
              {featuredAchievement ? (
                <div className={styles.featuredAchievement}>
                  <span className={styles.achievementIcon}>{featuredAchievement.icon}</span>
                  <div className={styles.achievementInfo}>
                    <span className={styles.achievementName}>{featuredAchievement.name}</span>
                    <span className={styles.achievementDesc}>
                      {featuredAchievement.description}
                    </span>
                  </div>
                </div>
              ) : (
                <div className={styles.noFeatured}>No achievement selected</div>
              )}
            </div>

            {/* Quick Stats */}
            <div className={styles.quickStats}>
              <h3 className={styles.sectionTitle}>Quick Stats</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{stats.totalKills.toLocaleString()}</span>
                  <span className={styles.statLabel}>Kills</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{derived.kdRatio.toFixed(2)}</span>
                  <span className={styles.statLabel}>K/D Ratio</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{stats.accuracy.toFixed(1)}%</span>
                  <span className={styles.statLabel}>Accuracy</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{stats.campaignCompletions}</span>
                  <span className={styles.statLabel}>Campaigns</span>
                </div>
              </div>
              <div className={styles.favoriteWeapon}>
                <span className={styles.favoriteLabel}>Favorite Weapon:</span>
                <span className={styles.favoriteValue}>{favoriteWeapon}</span>
              </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <span className={styles.joinDate}>
                Playing since: {new Date(profile.createdAt).toLocaleDateString()}
              </span>
              <button type="button" className={styles.closeButton} onClick={handleClose}>
                Close
              </button>
            </div>
          </>
        )}

        {/* Avatar Selection Modal */}
        {selectingAvatar && (
          // biome-ignore lint/a11y/useSemanticElements: Modal overlay
          <div
            className={styles.avatarModal}
            onClick={() => setSelectingAvatar(false)}
            onKeyDown={(e) => e.key === 'Escape' && setSelectingAvatar(false)}
            role="presentation"
          >
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Stop propagation */}
            <div
              className={styles.avatarGrid}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="listbox"
              aria-label="Select avatar"
            >
              <h3 className={styles.avatarTitle}>Select Avatar</h3>
              <div className={styles.avatarOptions}>
                {AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    className={`${styles.avatarOption} ${av.id === profile.avatarId ? styles.selected : ''}`}
                    onClick={() => handleSelectAvatar(av.id)}
                    role="option"
                    aria-selected={av.id === profile.avatarId}
                  >
                    <span className={styles.avatarIcon}>{av.icon}</span>
                    <span className={styles.avatarLabel}>{av.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HOOK FOR PROFILE DATA
// ============================================================================

export function usePlayerProfile(): {
  profile: PlayerProfileData | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
} {
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    try {
      await worldDb.init();
      const storedProfile = await worldDb.getChunkData(PROFILE_STORAGE_KEY);
      if (storedProfile) {
        setProfile({ ...createDefaultProfile(), ...JSON.parse(storedProfile) });
      } else {
        setProfile(createDefaultProfile());
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfile(createDefaultProfile());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return { profile, loading, refreshProfile };
}
