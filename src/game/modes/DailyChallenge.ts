/**
 * DailyChallenge - Challenge Manager for tracking and updating challenges
 *
 * Provides:
 * - Challenge state management
 * - Progress tracking and updates
 * - Reward claiming
 * - Integration with game systems
 *
 * Integration Points:
 * - ChallengeMode: Challenge definitions and generation
 * - GameContext: Combat stats
 * - AchievementManager: Cross-system progress
 */

import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import {
  type Challenge,
  type ChallengeState,
  type DifficultyModifier,
  generateDailyChallenges,
  generateWeeklyChallenges,
  getDateSeed,
  getPermanentChallenges,
  getTimeUntilDailyReset,
  getTimeUntilWeeklyReset,
  getWeekSeed,
  isChallengeActive,
  isChallengeExpired,
  loadChallengeState,
  type ObjectiveType,
  saveChallengeState,
} from './ChallengeMode';

const log = getLogger('DailyChallenge');

// ============================================================================
// TYPES
// ============================================================================

export type ChallengeEventType =
  | 'challenge_completed'
  | 'challenge_progress'
  | 'reward_claimed'
  | 'challenges_refreshed'
  | 'streak_updated';

export interface ChallengeEvent {
  type: ChallengeEventType;
  challenge?: Challenge;
  progress?: number;
  total?: number;
  rewardType?: string;
  rewardAmount?: number;
  streak?: number;
}

export type ChallengeEventCallback = (event: ChallengeEvent) => void;

// ============================================================================
// CHALLENGE MANAGER CLASS
// ============================================================================

class ChallengeManagerImpl {
  private state: ChallengeState;
  private listeners: Set<ChallengeEventCallback> = new Set();
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.state = this.createDefaultState();
  }

  /**
   * Create default state
   */
  private createDefaultState(): ChallengeState {
    return {
      dailyChallenges: [],
      weeklyChallenges: [],
      permanentChallenges: [],
      progress: {},
      claimedRewards: [],
      totalXP: 0,
      streak: 0,
    };
  }

  /**
   * Initialize the challenge manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.state = await loadChallengeState();
    this.refreshChallenges();
    this.setupRefreshTimer();
    this.initialized = true;

    log.info('Challenge manager initialized');
  }

  /**
   * Setup automatic refresh timer for daily/weekly challenges
   */
  private setupRefreshTimer(): void {
    // Check for refresh every minute
    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshChallenges();
    }, 60 * 1000);
  }

  /**
   * Check if challenges need refreshing and do so
   */
  private checkAndRefreshChallenges(): void {
    const now = new Date();
    const currentDaySeed = getDateSeed(now);
    const currentWeekSeed = getWeekSeed(now);

    // Check if daily challenges need refresh
    const dailySeed = this.state.dailyChallenges[0]?.seed;
    if (!dailySeed || dailySeed !== currentDaySeed) {
      this.refreshDailyChallenges();
    }

    // Check if weekly challenges need refresh
    const weeklySeed = this.state.weeklyChallenges[0]?.seed;
    if (!weeklySeed || weeklySeed !== currentWeekSeed) {
      this.refreshWeeklyChallenges();
    }
  }

  /**
   * Refresh all challenges (call on init and when needed)
   */
  refreshChallenges(): void {
    this.checkAndRefreshChallenges();

    // Initialize permanent challenges if not present
    if (this.state.permanentChallenges.length === 0) {
      this.state.permanentChallenges = getPermanentChallenges();
    }

    // Restore progress for permanent challenges
    for (const challenge of this.state.permanentChallenges) {
      const savedProgress = this.state.progress[challenge.id];
      if (savedProgress) {
        challenge.objectives = savedProgress.objectives;
        challenge.completed = savedProgress.completed;
        challenge.claimed = savedProgress.claimed;
      }
    }

    this.save();
    this.emit({ type: 'challenges_refreshed' });
  }

  /**
   * Refresh daily challenges
   */
  private refreshDailyChallenges(): void {
    // Check streak before refreshing
    this.checkDailyStreak();

    const dailyChallenges = generateDailyChallenges();

    // Restore any progress from today if exists
    for (const challenge of dailyChallenges) {
      const savedProgress = this.state.progress[challenge.id];
      if (savedProgress) {
        challenge.objectives = savedProgress.objectives;
        challenge.completed = savedProgress.completed;
        challenge.claimed = savedProgress.claimed;
      }
    }

    this.state.dailyChallenges = dailyChallenges;
    this.save();
    log.info('Daily challenges refreshed');
  }

  /**
   * Refresh weekly challenges
   */
  private refreshWeeklyChallenges(): void {
    const weeklyChallenges = generateWeeklyChallenges();

    // Restore any progress from this week if exists
    for (const challenge of weeklyChallenges) {
      const savedProgress = this.state.progress[challenge.id];
      if (savedProgress) {
        challenge.objectives = savedProgress.objectives;
        challenge.completed = savedProgress.completed;
        challenge.claimed = savedProgress.claimed;
      }
    }

    this.state.weeklyChallenges = weeklyChallenges;
    this.save();
    log.info('Weekly challenges refreshed');
  }

  /**
   * Check and update daily streak
   */
  private checkDailyStreak(): void {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (this.state.lastDailyCompletion) {
      const timeSinceLastCompletion = now - this.state.lastDailyCompletion;

      // If more than 48 hours, reset streak
      if (timeSinceLastCompletion > oneDayMs * 2) {
        this.state.streak = 0;
        log.info('Daily streak reset');
      }
    }
  }

  /**
   * Subscribe to challenge events
   */
  subscribe(callback: ChallengeEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: ChallengeEvent): void {
    for (const callback of this.listeners) {
      try {
        callback(event);
      } catch (error) {
        log.error('Error in challenge event callback:', error);
      }
    }
  }

  /**
   * Save current state
   */
  private save(): void {
    // Fire and forget - errors are logged by saveChallengeState
    saveChallengeState(this.state);
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get all active daily challenges
   */
  getDailyChallenges(): Challenge[] {
    return this.state.dailyChallenges.filter(isChallengeActive);
  }

  /**
   * Get all active weekly challenges
   */
  getWeeklyChallenges(): Challenge[] {
    return this.state.weeklyChallenges.filter(isChallengeActive);
  }

  /**
   * Get all permanent challenges
   */
  getPermanentChallenges(): Challenge[] {
    return this.state.permanentChallenges;
  }

  /**
   * Get all active challenges (daily + weekly + permanent)
   */
  getAllActiveChallenges(): Challenge[] {
    return [
      ...this.getDailyChallenges(),
      ...this.getWeeklyChallenges(),
      ...this.getPermanentChallenges().filter((c) => !c.completed),
    ];
  }

  /**
   * Get completed but unclaimed challenges
   */
  getUnclaimedChallenges(): Challenge[] {
    return this.getAllActiveChallenges().filter((c) => c.completed && !c.claimed);
  }

  /**
   * Get challenge by ID
   */
  getChallenge(id: string): Challenge | undefined {
    return (
      this.state.dailyChallenges.find((c) => c.id === id) ||
      this.state.weeklyChallenges.find((c) => c.id === id) ||
      this.state.permanentChallenges.find((c) => c.id === id)
    );
  }

  /**
   * Get total XP earned
   */
  getTotalXP(): number {
    return this.state.totalXP;
  }

  /**
   * Get current streak
   */
  getStreak(): number {
    return this.state.streak;
  }

  /**
   * Get time until daily reset
   */
  getTimeUntilDailyReset(): number {
    return getTimeUntilDailyReset();
  }

  /**
   * Get time until weekly reset
   */
  getTimeUntilWeeklyReset(): number {
    return getTimeUntilWeeklyReset();
  }

  // ============================================================================
  // PROGRESS TRACKING
  // ============================================================================

  /**
   * Update progress for a specific objective type
   * Called by game systems when relevant events occur
   */
  updateProgress(
    objectiveType: ObjectiveType,
    amount: number,
    options?: {
      levelId?: LevelId;
      weaponId?: string;
      difficulty?: DifficultyModifier;
    }
  ): void {
    const allChallenges = [
      ...this.state.dailyChallenges,
      ...this.state.weeklyChallenges,
      ...this.state.permanentChallenges,
    ];

    for (const challenge of allChallenges) {
      // Skip completed or expired challenges
      if (challenge.completed || isChallengeExpired(challenge)) continue;

      let challengeUpdated = false;

      for (const objective of challenge.objectives) {
        // Skip if objective type doesn't match
        if (objective.type !== objectiveType) continue;

        // Skip if level restriction doesn't match
        if (objective.levelId && options?.levelId && objective.levelId !== options.levelId) {
          continue;
        }

        // Skip if weapon restriction doesn't match
        if (objective.weaponId && options?.weaponId && objective.weaponId !== options.weaponId) {
          continue;
        }

        // Skip if difficulty restriction doesn't match
        if (objective.difficulty && options?.difficulty) {
          const difficultyOrder = ['easy', 'normal', 'hard', 'insane'];
          const requiredIndex = difficultyOrder.indexOf(objective.difficulty);
          const actualIndex = difficultyOrder.indexOf(options.difficulty);
          if (actualIndex < requiredIndex) continue;
        }

        // Update progress
        const oldProgress = objective.current;
        objective.current = Math.min(objective.target, objective.current + amount);
        challengeUpdated = objective.current !== oldProgress;

        // Emit progress event
        if (challengeUpdated) {
          this.emit({
            type: 'challenge_progress',
            challenge,
            progress: objective.current,
            total: objective.target,
          });
        }
      }

      // Check if all objectives are complete
      if (challengeUpdated) {
        const allComplete = challenge.objectives.every((obj) => obj.current >= obj.target);
        if (allComplete && !challenge.completed) {
          challenge.completed = true;
          this.onChallengeComplete(challenge);
        }

        // Save progress
        this.state.progress[challenge.id] = {
          challengeId: challenge.id,
          objectives: [...challenge.objectives],
          completed: challenge.completed,
          claimed: challenge.claimed,
          completedAt: challenge.completed ? Date.now() : undefined,
        };
      }
    }

    this.save();
  }

  /**
   * Handle challenge completion
   */
  private onChallengeComplete(challenge: Challenge): void {
    log.info(`Challenge completed: ${challenge.name}`);

    // Update streak for daily challenges
    if (challenge.type === 'daily') {
      const allDailyComplete = this.state.dailyChallenges.every((c) => c.completed);
      if (allDailyComplete) {
        this.state.streak++;
        this.state.lastDailyCompletion = Date.now();
        this.emit({ type: 'streak_updated', streak: this.state.streak });
      }
    }

    this.emit({ type: 'challenge_completed', challenge });
  }

  /**
   * Claim rewards for a completed challenge
   */
  claimRewards(challengeId: string): boolean {
    const challenge = this.getChallenge(challengeId);
    if (!challenge) {
      log.warn(`Challenge not found: ${challengeId}`);
      return false;
    }

    if (!challenge.completed) {
      log.warn(`Challenge not completed: ${challengeId}`);
      return false;
    }

    if (challenge.claimed) {
      log.warn(`Challenge already claimed: ${challengeId}`);
      return false;
    }

    // Grant rewards
    for (const reward of challenge.rewards) {
      if (reward.type === 'xp') {
        this.state.totalXP += reward.amount;
      }

      this.state.claimedRewards.push(`${challengeId}_${reward.type}_${reward.id || reward.amount}`);

      this.emit({
        type: 'reward_claimed',
        challenge,
        rewardType: reward.type,
        rewardAmount: reward.amount,
      });
    }

    challenge.claimed = true;

    // Update progress record
    if (this.state.progress[challengeId]) {
      this.state.progress[challengeId].claimed = true;
      this.state.progress[challengeId].claimedAt = Date.now();
    }

    this.save();
    log.info(`Rewards claimed for: ${challenge.name}`);

    return true;
  }

  // ============================================================================
  // GAME EVENT HANDLERS
  // ============================================================================

  /**
   * Called when player kills an enemy
   */
  onKill(options?: {
    levelId?: LevelId;
    weaponId?: string;
    isHeadshot?: boolean;
    isMelee?: boolean;
    isGrenade?: boolean;
  }): void {
    this.updateProgress('kills', 1, options);

    if (options?.isHeadshot) {
      this.updateProgress('headshots', 1, options);
    }

    if (options?.isMelee) {
      this.updateProgress('melee', 1, options);
    }

    if (options?.isGrenade) {
      this.updateProgress('grenade', 1, options);
    }

    if (options?.weaponId) {
      this.updateProgress('weaponMastery', 1, { weaponId: options.weaponId });
    }
  }

  /**
   * Called when player completes a level
   */
  onLevelComplete(
    levelId: LevelId,
    stats: {
      timeSeconds: number;
      accuracy: number;
      damageTaken: number;
      deaths: number;
      secretsFound: number;
      difficulty: DifficultyModifier;
    }
  ): void {
    this.updateProgress('levelComplete', 1, { levelId, difficulty: stats.difficulty });

    // Time-based challenges (target is in minutes)
    const timeMinutes = Math.ceil(stats.timeSeconds / 60);
    // For time challenges, we check if time is UNDER target
    // We update with 1 if successful (target is always 1 for "complete under X minutes")
    for (const challenge of this.getAllActiveChallenges()) {
      for (const objective of challenge.objectives) {
        if (objective.type === 'time' && objective.levelId === levelId) {
          if (timeMinutes <= objective.target) {
            objective.current = objective.target;
          }
        }
      }
    }

    // Accuracy challenges
    if (stats.accuracy >= 0) {
      // For accuracy, we store the achieved accuracy
      // The check compares current (achieved) against target (required)
      for (const challenge of this.getAllActiveChallenges()) {
        for (const objective of challenge.objectives) {
          if (objective.type === 'accuracy') {
            if (stats.accuracy >= objective.target) {
              objective.current = objective.target;
            }
          }
        }
      }
    }

    // No damage challenges
    if (stats.damageTaken === 0) {
      this.updateProgress('noDamage', 1, { levelId });
    }

    // No deaths challenges
    if (stats.deaths === 0) {
      this.updateProgress('noDeaths', 1, { levelId });
    }

    // Secrets found
    if (stats.secretsFound > 0) {
      this.updateProgress('secretsFound', stats.secretsFound, { levelId });
    }

    this.save();
  }

  /**
   * Called when campaign is completed
   */
  onCampaignComplete(difficulty: DifficultyModifier): void {
    this.updateProgress('campaignComplete', 1, { difficulty });
  }

  /**
   * Called when skulls are collected
   */
  onSkullCollected(_skullId: string): void {
    this.updateProgress('skullsCollected', 1);
  }

  /**
   * Called when a multi-kill occurs
   */
  onMultiKill(killCount: number): void {
    if (killCount >= 3) {
      this.updateProgress('multiKills', 1);
    }
  }

  /**
   * Called when a secret is found
   */
  onSecretFound(levelId: LevelId): void {
    this.updateProgress('secretsFound', 1, { levelId });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose the challenge manager
   */
  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Reset all challenge progress (for testing)
   */
  resetAll(): void {
    this.state = {
      dailyChallenges: [],
      weeklyChallenges: [],
      permanentChallenges: [],
      progress: {},
      claimedRewards: [],
      totalXP: 0,
      streak: 0,
    };
    this.save();
    this.refreshChallenges();
    log.info('All challenge progress reset');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let challengeManagerInstance: ChallengeManagerImpl | null = null;

/**
 * Get the singleton ChallengeManager instance
 */
export function getChallengeManager(): ChallengeManagerImpl {
  if (!challengeManagerInstance) {
    challengeManagerInstance = new ChallengeManagerImpl();
  }
  return challengeManagerInstance;
}

/**
 * Initialize the challenge system
 * Should be called once at app startup
 */
export async function initChallenges(): Promise<void> {
  await getChallengeManager().init();
}

/**
 * Dispose the challenge manager singleton
 */
export function disposeChallengeManager(): void {
  if (challengeManagerInstance) {
    challengeManagerInstance = null;
  }
}

// Re-export types
export type ChallengeManager = ChallengeManagerImpl;
