/**
 * GameChronometer - In-universe time tracking for Stellar Descent
 *
 * The game is set in year 3147. This system provides:
 * - In-universe date/time display (not real-world Date.now())
 * - Mission elapsed time tracking
 * - Campaign total time tracking
 * - Military-style time formatting (Zulu time)
 *
 * Uses microsecond precision internally, displayed as seconds.milliseconds
 */

import { LORE } from '../core/lore';
import type { LevelId } from '../levels/types';

// ============================================================================
// Constants
// ============================================================================

/** Base year from game lore */
const BASE_YEAR = LORE.setting.year; // 3147

/** Base month (mission starts in this month) */
const BASE_MONTH = 8; // August

/** Base day (mission starts on this day) */
const BASE_DAY = 17;

/** Microseconds per second */
const MICROSECONDS_PER_SECOND = 1_000_000;

/** Microseconds per millisecond */
const MICROSECONDS_PER_MS = 1_000;

// ============================================================================
// Types
// ============================================================================

export interface ChronometerSnapshot {
  /** Mission elapsed time in microseconds */
  missionTimeMicros: number;
  /** Total campaign time in microseconds */
  campaignTimeMicros: number;
  /** Current level being tracked */
  currentLevelId: LevelId | null;
  /** Whether the chronometer is running */
  isRunning: boolean;
  /** The in-universe date for display */
  loreDate: LoreDate;
  /** Formatted mission time (MM:SS.mmm) */
  formattedMissionTime: string;
  /** Formatted campaign time (HH:MM:SS) */
  formattedCampaignTime: string;
  /** Military-style timestamp */
  militaryTimestamp: string;
}

export interface LoreDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

// ============================================================================
// GameChronometer class
// ============================================================================

class GameChronometer {
  private snapshot: ChronometerSnapshot;
  private listeners: Set<() => void> = new Set();

  // Internal state
  private missionStartMicros: number | null = null;
  private accumulatedMissionMicros: number = 0;
  private campaignBaseTimeMicros: number = 0;
  private sessionStartMicros: number = this.getMicroseconds();
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.snapshot = this.createDefaultSnapshot();
  }

  // ---- React integration (useSyncExternalStore compatible) ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ChronometerSnapshot => {
    return this.snapshot;
  };

  private notify(): void {
    this.snapshot = { ...this.snapshot };
    for (const listener of this.listeners) {
      listener();
    }
  }

  private createDefaultSnapshot(): ChronometerSnapshot {
    return {
      missionTimeMicros: 0,
      campaignTimeMicros: 0,
      currentLevelId: null,
      isRunning: false,
      loreDate: this.computeLoreDate(0),
      formattedMissionTime: '00:00.000',
      formattedCampaignTime: '00:00:00',
      militaryTimestamp: this.formatMilitaryTimestamp(this.computeLoreDate(0)),
    };
  }

  // ---- High-precision time ----

  private getMicroseconds(): number {
    // Use performance.now() for high precision (milliseconds with decimals)
    // Convert to microseconds for internal tracking
    return Math.floor(performance.now() * MICROSECONDS_PER_MS);
  }

  // ---- Mission time controls ----

  /**
   * Start timing a mission
   */
  startMission(levelId: LevelId): void {
    this.snapshot.currentLevelId = levelId;
    this.accumulatedMissionMicros = 0;
    this.missionStartMicros = this.getMicroseconds();
    this.snapshot.isRunning = true;
    this.updateTimes();
    this.startUpdateLoop();
    this.notify();
  }

  /**
   * Pause the chronometer
   */
  pause(): void {
    if (!this.snapshot.isRunning || this.missionStartMicros === null) return;

    this.accumulatedMissionMicros += this.getMicroseconds() - this.missionStartMicros;
    this.missionStartMicros = null;
    this.snapshot.isRunning = false;
    this.stopUpdateLoop();
    this.updateTimes();
    this.notify();
  }

  /**
   * Resume the chronometer
   */
  resume(): void {
    if (this.snapshot.isRunning) return;
    if (this.snapshot.currentLevelId === null) return;

    this.missionStartMicros = this.getMicroseconds();
    this.snapshot.isRunning = true;
    this.startUpdateLoop();
    this.notify();
  }

  /**
   * Stop and finalize the mission timer
   * Returns the final elapsed time in seconds
   */
  stopMission(): number {
    if (this.missionStartMicros !== null) {
      this.accumulatedMissionMicros += this.getMicroseconds() - this.missionStartMicros;
    }

    const finalTimeSeconds = this.accumulatedMissionMicros / MICROSECONDS_PER_SECOND;
    this.snapshot.isRunning = false;
    this.missionStartMicros = null;
    this.stopUpdateLoop();
    this.updateTimes();
    this.notify();

    return finalTimeSeconds;
  }

  /**
   * Reset mission timer without saving
   */
  resetMission(): void {
    this.accumulatedMissionMicros = 0;
    this.missionStartMicros = null;
    this.snapshot.currentLevelId = null;
    this.snapshot.isRunning = false;
    this.stopUpdateLoop();
    this.updateTimes();
    this.notify();
  }

  /**
   * Get current mission time in seconds
   */
  getMissionTimeSeconds(): number {
    const elapsed = this.getMissionTimeMicros();
    return elapsed / MICROSECONDS_PER_SECOND;
  }

  /**
   * Get current mission time in microseconds
   */
  getMissionTimeMicros(): number {
    if (this.missionStartMicros !== null) {
      return this.accumulatedMissionMicros + (this.getMicroseconds() - this.missionStartMicros);
    }
    return this.accumulatedMissionMicros;
  }

  // ---- Campaign time tracking ----

  /**
   * Set campaign base time from loaded save (in milliseconds for compatibility)
   */
  setCampaignTime(ms: number): void {
    this.campaignBaseTimeMicros = ms * MICROSECONDS_PER_MS;
    this.sessionStartMicros = this.getMicroseconds();
    this.updateTimes();
    this.notify();
  }

  /**
   * Get total campaign time in milliseconds (for save compatibility)
   */
  getCampaignTimeMs(): number {
    const sessionMicros = this.getMicroseconds() - this.sessionStartMicros;
    return Math.floor((this.campaignBaseTimeMicros + sessionMicros) / MICROSECONDS_PER_MS);
  }

  /**
   * Flush session time to campaign total (call before saving)
   */
  flushSessionTime(): number {
    const sessionMicros = this.getMicroseconds() - this.sessionStartMicros;
    this.campaignBaseTimeMicros += sessionMicros;
    this.sessionStartMicros = this.getMicroseconds();
    return Math.floor(this.campaignBaseTimeMicros / MICROSECONDS_PER_MS);
  }

  // ---- Lore date computation ----

  /**
   * Compute the in-universe date based on campaign progress
   * Each mission-hour in real-time equals roughly 1 day in-universe
   */
  private computeLoreDate(campaignMicros: number): LoreDate {
    // Campaign time in hours
    const campaignHours = campaignMicros / (MICROSECONDS_PER_SECOND * 3600);

    // Each real hour = 1 in-universe day (for dramatic pacing)
    const daysElapsed = Math.floor(campaignHours);

    // Remaining time within the current day
    const remainingHours = (campaignHours - daysElapsed) * 24;
    const hour = Math.floor(remainingHours);
    const remainingMinutes = (remainingHours - hour) * 60;
    const minute = Math.floor(remainingMinutes);
    const remainingSeconds = (remainingMinutes - minute) * 60;
    const second = Math.floor(remainingSeconds);
    const millisecond = Math.floor((remainingSeconds - second) * 1000);

    // Calculate date from base
    let year = BASE_YEAR;
    let month = BASE_MONTH;
    let day = BASE_DAY + daysElapsed;

    // Simple month overflow (28 days per month for alien world)
    while (day > 28) {
      day -= 28;
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    return { year, month, day, hour, minute, second, millisecond };
  }

  /**
   * Format lore date as military timestamp
   * Format: YYYY.MM.DD // HH:MM:SS.mmm Zulu
   */
  private formatMilitaryTimestamp(date: LoreDate): string {
    const year = date.year.toString();
    const month = date.month.toString().padStart(2, '0');
    const day = date.day.toString().padStart(2, '0');
    const hour = date.hour.toString().padStart(2, '0');
    const minute = date.minute.toString().padStart(2, '0');
    const second = date.second.toString().padStart(2, '0');
    const ms = date.millisecond.toString().padStart(3, '0');

    return `${year}.${month}.${day} // ${hour}:${minute}:${second}.${ms}Z`;
  }

  // ---- Formatting ----

  /**
   * Format mission time as MM:SS.mmm (microsecond precision displayed as milliseconds)
   */
  static formatMissionTime(micros: number): string {
    const totalSeconds = micros / MICROSECONDS_PER_SECOND;
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 1000);

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  /**
   * Format campaign time as HH:MM:SS
   */
  static formatCampaignTime(micros: number): string {
    const totalSeconds = Math.floor(micros / MICROSECONDS_PER_SECOND);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // ---- Update loop ----

  private updateTimes(): void {
    const missionMicros = this.getMissionTimeMicros();
    const sessionMicros = this.getMicroseconds() - this.sessionStartMicros;
    const campaignMicros = this.campaignBaseTimeMicros + sessionMicros;

    this.snapshot.missionTimeMicros = missionMicros;
    this.snapshot.campaignTimeMicros = campaignMicros;
    this.snapshot.formattedMissionTime = GameChronometer.formatMissionTime(missionMicros);
    this.snapshot.formattedCampaignTime = GameChronometer.formatCampaignTime(campaignMicros);
    this.snapshot.loreDate = this.computeLoreDate(campaignMicros);
    this.snapshot.militaryTimestamp = this.formatMilitaryTimestamp(this.snapshot.loreDate);
  }

  private startUpdateLoop(): void {
    if (this.updateInterval) return;

    // Update at 60fps for smooth HUD display
    this.updateInterval = setInterval(() => {
      if (this.snapshot.isRunning) {
        this.updateTimes();
        this.notify();
      }
    }, 16); // ~60fps
  }

  private stopUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // ---- Cleanup ----

  dispose(): void {
    this.stopUpdateLoop();
    this.listeners.clear();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let chronometerInstance: GameChronometer | null = null;

export function getGameChronometer(): GameChronometer {
  if (!chronometerInstance) {
    chronometerInstance = new GameChronometer();
  }
  return chronometerInstance;
}

export function disposeGameChronometer(): void {
  if (chronometerInstance) {
    chronometerInstance.dispose();
    chronometerInstance = null;
  }
}

// ============================================================================
// React hook
// ============================================================================

export { GameChronometer };
