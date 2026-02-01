/**
 * ChallengeScreen - UI for daily, weekly, and permanent challenges
 *
 * Features:
 * - Tab-based navigation between challenge types
 * - Real-time countdown timers for daily/weekly reset
 * - Progress bars for each objective
 * - Reward preview and claiming
 * - Streak display for consecutive daily completions
 * - Military styling consistent with game aesthetic
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import {
  type Challenge,
  type ChallengeEvent,
  formatTimeRemaining,
  getChallengeManager,
} from '../../game/modes';
import styles from './ChallengeScreen.module.css';

interface ChallengeScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabFilter = 'daily' | 'weekly' | 'permanent';

const REWARD_ICONS: Record<string, string> = {
  xp: '\u2605', // Star
  skull: '\u2620', // Skull
  cosmetic: '\u2728', // Sparkles
  badge: '\u2606', // Star outline
  title: '\u265F', // Chess pawn
  leaderboard_entry: '\u2616', // Trophy
};

export function ChallengeScreen({ isOpen, onClose }: ChallengeScreenProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>('daily');
  const [challenges, setChallenges] = useState<{
    daily: Challenge[];
    weekly: Challenge[];
    permanent: Challenge[];
  }>({
    daily: [],
    weekly: [],
    permanent: [],
  });
  const [totalXP, setTotalXP] = useState(0);
  const [streak, setStreak] = useState(0);
  const [dailyTimeRemaining, setDailyTimeRemaining] = useState(0);
  const [weeklyTimeRemaining, setWeeklyTimeRemaining] = useState(0);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());

  // Load challenges data
  useEffect(() => {
    if (!isOpen) return;

    const manager = getChallengeManager();
    manager.init();

    const loadChallenges = () => {
      setChallenges({
        daily: manager.getDailyChallenges(),
        weekly: manager.getWeeklyChallenges(),
        permanent: manager.getPermanentChallenges(),
      });
      setTotalXP(manager.getTotalXP());
      setStreak(manager.getStreak());
      setDailyTimeRemaining(manager.getTimeUntilDailyReset());
      setWeeklyTimeRemaining(manager.getTimeUntilWeeklyReset());
    };

    loadChallenges();

    // Subscribe to challenge events
    const unsubscribe = manager.subscribe((event: ChallengeEvent) => {
      loadChallenges();

      if (event.type === 'challenge_completed' && event.challenge) {
        // Add to just completed set for animation
        setJustCompletedIds((prev) => new Set(prev).add(event.challenge!.id));

        // Remove after animation
        setTimeout(() => {
          setJustCompletedIds((prev) => {
            const next = new Set(prev);
            next.delete(event.challenge!.id);
            return next;
          });
        }, 1000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // Update countdown timers
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const manager = getChallengeManager();
      setDailyTimeRemaining(manager.getTimeUntilDailyReset());
      setWeeklyTimeRemaining(manager.getTimeUntilWeeklyReset());
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Get challenges for current tab
  const displayChallenges = useMemo(() => {
    return challenges[activeTab];
  }, [challenges, activeTab]);

  // Count unclaimed challenges per tab
  const unclaimedCounts = useMemo(
    () => ({
      daily: challenges.daily.filter((c) => c.completed && !c.claimed).length,
      weekly: challenges.weekly.filter((c) => c.completed && !c.claimed).length,
      permanent: challenges.permanent.filter((c) => c.completed && !c.claimed).length,
    }),
    [challenges]
  );

  const handleTabChange = useCallback((tab: TabFilter) => {
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

  const handleClaimRewards = useCallback((challengeId: string) => {
    const manager = getChallengeManager();
    const success = manager.claimRewards(challengeId);
    if (success) {
      try {
        getAudioManager().play('achievement_unlock', { volume: 0.4 });
      } catch {
        // Audio may not be initialized
      }

      // Refresh challenges
      setChallenges({
        daily: manager.getDailyChallenges(),
        weekly: manager.getWeeklyChallenges(),
        permanent: manager.getPermanentChallenges(),
      });
      setTotalXP(manager.getTotalXP());
    }
  }, []);

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

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenges-title"
    >
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id="challenges-title" className={styles.title}>
              Challenges
            </h2>
            <span className={styles.subtitle}>Complete objectives to earn rewards</span>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.xpDisplay}>{totalXP.toLocaleString()} XP</span>
            {streak > 0 && (
              <div className={styles.streakBadge}>
                <span className={styles.streakIcon}>{'\u26A1'}</span>
                {streak} Day Streak
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'daily' ? styles.active : ''}`}
            onClick={() => handleTabChange('daily')}
            role="tab"
            aria-selected={activeTab === 'daily'}
          >
            Daily
            {unclaimedCounts.daily > 0 && (
              <span className={styles.tabBadge}>{unclaimedCounts.daily}</span>
            )}
            <span className={styles.tabTimer}>{formatTimeRemaining(dailyTimeRemaining)}</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'weekly' ? styles.active : ''}`}
            onClick={() => handleTabChange('weekly')}
            role="tab"
            aria-selected={activeTab === 'weekly'}
          >
            Weekly
            {unclaimedCounts.weekly > 0 && (
              <span className={styles.tabBadge}>{unclaimedCounts.weekly}</span>
            )}
            <span className={styles.tabTimer}>{formatTimeRemaining(weeklyTimeRemaining)}</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'permanent' ? styles.active : ''}`}
            onClick={() => handleTabChange('permanent')}
            role="tab"
            aria-selected={activeTab === 'permanent'}
          >
            Permanent
            {unclaimedCounts.permanent > 0 && (
              <span className={styles.tabBadge}>{unclaimedCounts.permanent}</span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className={styles.content} role="tabpanel">
          {displayChallenges.length === 0 ? (
            <div className={styles.emptyState}>No challenges available</div>
          ) : (
            <div className={styles.challengeList}>
              {displayChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  onClaim={handleClaimRewards}
                  justCompleted={justCompletedIds.has(challenge.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.timerDisplay}>
            {activeTab === 'daily' && (
              <>
                <span className={styles.timerLabel}>Resets in:</span>
                <span className={styles.timerValue}>{formatTimeRemaining(dailyTimeRemaining)}</span>
              </>
            )}
            {activeTab === 'weekly' && (
              <>
                <span className={styles.timerLabel}>Resets in:</span>
                <span className={styles.timerValue}>
                  {formatTimeRemaining(weeklyTimeRemaining)}
                </span>
              </>
            )}
            {activeTab === 'permanent' && <span className={styles.timerLabel}>No time limit</span>}
          </div>
          <button type="button" className={styles.closeButton} onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CHALLENGE CARD COMPONENT
// ============================================================================

interface ChallengeCardProps {
  challenge: Challenge;
  onClaim: (challengeId: string) => void;
  justCompleted: boolean;
}

function ChallengeCard({ challenge, onClaim, justCompleted }: ChallengeCardProps) {
  const _allObjectivesComplete = challenge.objectives.every((obj) => obj.current >= obj.target);

  const cardClasses = [
    styles.challengeCard,
    challenge.completed ? styles.completed : '',
    challenge.claimed ? styles.claimed : '',
    justCompleted ? styles.justCompleted : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses}>
      <div className={styles.challengeHeader}>
        <div className={styles.challengeInfo}>
          <h3 className={styles.challengeName}>
            {challenge.name}
            {challenge.minDifficulty && (
              <span className={`${styles.difficultyIndicator} ${styles[challenge.minDifficulty]}`}>
                {challenge.minDifficulty}+
              </span>
            )}
          </h3>
          <p className={styles.challengeDescription}>{challenge.description}</p>
        </div>
        <div className={styles.challengeStatus}>
          <span className={`${styles.statusBadge} ${styles[challenge.type]}`}>
            {challenge.type}
          </span>
          {challenge.completed && !challenge.claimed && (
            <span className={styles.completedBadge}>Complete!</span>
          )}
        </div>
      </div>

      {/* Objectives */}
      <div className={styles.objectives}>
        {challenge.objectives.map((objective, index) => {
          const progress = Math.min(100, (objective.current / objective.target) * 100);
          const isComplete = objective.current >= objective.target;

          return (
            <div
              key={`${challenge.id}-obj-${index}`}
              className={`${styles.objective} ${isComplete ? styles.complete : ''}`}
            >
              <div className={styles.objectiveText}>
                <span>{objective.description}</span>
                <span className={styles.objectiveProgress}>
                  {objective.current}/{objective.target}
                </span>
              </div>
              <div className={styles.progressBarContainer}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Rewards */}
      <div className={styles.rewards}>
        {challenge.rewards.map((reward, index) => (
          <div
            key={`${challenge.id}-reward-${index}`}
            className={`${styles.reward} ${styles[reward.type]}`}
            title={reward.description}
          >
            <span className={styles.rewardIcon}>{REWARD_ICONS[reward.type] || '\u2726'}</span>
            <span className={styles.rewardText}>{reward.name}</span>
          </div>
        ))}
      </div>

      {/* Claim Button */}
      {challenge.completed && !challenge.claimed && (
        <button type="button" className={styles.claimButton} onClick={() => onClaim(challenge.id)}>
          Claim Rewards
        </button>
      )}
    </div>
  );
}
