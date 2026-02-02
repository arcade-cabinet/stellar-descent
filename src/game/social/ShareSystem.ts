/**
 * ShareSystem - Social sharing functionality for Stellar Descent
 *
 * Handles:
 * - Screenshot capture with stats overlay
 * - Social platform sharing (Twitter, Facebook)
 * - Web Share API for native mobile sharing
 * - Clipboard and download operations
 * - Share text generation
 */

import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';
import { CAMPAIGN_LEVELS } from '../levels/types';
import {
  getScreenshotCapture,
  type ScreenshotData,
  type ScreenshotOptions,
} from './ScreenshotCapture';

const log = getLogger('ShareSystem');

// Game URL for sharing (can be configured)
const GAME_URL = 'https://stellar-descent.game';

/** Stats data for sharing (flexible format) */
export interface ShareableStats {
  /** Time spent in level in seconds */
  timeSpent: number;
  /** Kill count */
  kills: number;
  /** Shots fired (for accuracy calculation) */
  totalShots?: number;
  /** Shots that hit targets */
  shotsHit?: number;
  /** Number of headshots */
  headshots?: number;
  /** Number of deaths */
  deaths?: number;
  /** Secrets found */
  secretsFound?: number;
  /** Total secrets in level */
  totalSecrets?: number;
}

export interface ShareStats {
  /** Level ID */
  levelId: LevelId;
  /** Mission name */
  missionName: string;
  /** Performance rating (S, A, B, C, D) */
  rating: string;
  /** Level stats */
  stats: ShareableStats;
  /** Kill count */
  kills: number;
  /** Whether this is a personal best */
  isPersonalBest?: boolean;
  /** Whether this is campaign completion */
  isCampaignComplete?: boolean;
  /** Achievement name if sharing an achievement */
  achievementName?: string;
  /** Boss name if sharing a boss defeat */
  bossName?: string;
}

export type ShareTrigger =
  | 'level_complete'
  | 'achievement_unlocked'
  | 'campaign_complete'
  | 'boss_defeat'
  | 'personal_best';

/**
 * ShareSystem - Singleton for social sharing functionality
 */
class ShareSystemImpl {
  private gameCanvas: HTMLCanvasElement | null = null;

  /**
   * Set the game canvas reference for screenshot capture
   */
  setGameCanvas(canvas: HTMLCanvasElement | null): void {
    this.gameCanvas = canvas;
  }

  /**
   * Capture a screenshot of the current game state
   */
  async captureScreenshot(data?: ScreenshotData, options?: ScreenshotOptions): Promise<Blob> {
    if (!this.gameCanvas) {
      throw new Error('Game canvas not set. Call setGameCanvas first.');
    }

    const capture = getScreenshotCapture();
    return capture.captureCanvas(this.gameCanvas, data, options);
  }

  /**
   * Capture a preview image (smaller, for UI display)
   */
  async capturePreview(data?: ScreenshotData): Promise<string> {
    if (!this.gameCanvas) {
      throw new Error('Game canvas not set. Call setGameCanvas first.');
    }

    const capture = getScreenshotCapture();
    return capture.capturePreview(this.gameCanvas, data);
  }

  /**
   * Check if Web Share API is supported
   */
  canNativeShare(): boolean {
    return typeof navigator !== 'undefined' && 'share' in navigator;
  }

  /**
   * Check if sharing files is supported
   */
  canShareFiles(): boolean {
    return typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator;
  }

  /**
   * Share using native Web Share API (mobile-friendly)
   */
  async shareNative(text: string, image?: Blob): Promise<boolean> {
    if (!this.canNativeShare()) {
      log.warn('Web Share API not supported');
      return false;
    }

    try {
      const shareData: ShareData = {
        title: 'Stellar Descent',
        text: text,
        url: GAME_URL,
      };

      // Try to include image if supported
      if (image && this.canShareFiles()) {
        const file = new File([image], 'stellar-descent.png', { type: 'image/png' });
        const testData = { ...shareData, files: [file] };

        if (navigator.canShare?.(testData)) {
          shareData.files = [file];
        }
      }

      await navigator.share(shareData);
      log.info('Native share completed');
      return true;
    } catch (error) {
      // User cancelled or error
      if ((error as Error).name === 'AbortError') {
        log.debug('Share cancelled by user');
      } else {
        log.error('Native share failed:', error);
      }
      return false;
    }
  }

  /**
   * Share to Twitter/X
   */
  async shareToTwitter(text: string, _image?: Blob): Promise<void> {
    // Twitter doesn't support direct image upload via URL, so we just share text
    // Users can attach the downloaded screenshot manually
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;

    window.open(twitterUrl, '_blank', 'width=550,height=420,noopener');
    log.info('Opened Twitter share dialog');
  }

  /**
   * Share to Facebook
   */
  async shareToFacebook(text: string, _image?: Blob): Promise<void> {
    // Facebook share dialog with URL
    const encodedUrl = encodeURIComponent(GAME_URL);
    const encodedQuote = encodeURIComponent(text);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedQuote}`;

    window.open(facebookUrl, '_blank', 'width=550,height=420,noopener');
    log.info('Opened Facebook share dialog');
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      log.info('Text copied to clipboard');
      return true;
    } catch (error) {
      log.error('Failed to copy to clipboard:', error);

      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        log.info('Text copied to clipboard (fallback)');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Copy image to clipboard
   */
  async copyImageToClipboard(image: Blob): Promise<boolean> {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': image,
        }),
      ]);
      log.info('Image copied to clipboard');
      return true;
    } catch (error) {
      log.error('Failed to copy image to clipboard:', error);
      return false;
    }
  }

  /**
   * Download image to device
   */
  async downloadImage(image: Blob, filename?: string): Promise<void> {
    const defaultFilename = `stellar-descent-${Date.now()}.png`;
    const finalFilename = filename || defaultFilename;

    const url = URL.createObjectURL(image);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up object URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    log.info('Downloaded image:', finalFilename);
  }

  /**
   * Generate share text based on stats and trigger
   */
  generateShareText(stats: ShareStats, trigger: ShareTrigger = 'level_complete'): string {
    const {
      levelId,
      missionName,
      rating,
      kills,
      isPersonalBest,
      isCampaignComplete,
      achievementName,
      bossName,
    } = stats;
    const levelStats = stats.stats;

    // Format time
    const timeSeconds = levelStats.timeSpent;
    const mins = Math.floor(timeSeconds / 60);
    const secs = Math.floor(timeSeconds % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Calculate accuracy
    let accuracyStr = '';
    if (levelStats.totalShots && levelStats.totalShots > 0 && levelStats.shotsHit !== undefined) {
      const accuracy = Math.round((levelStats.shotsHit / levelStats.totalShots) * 100);
      accuracyStr = `${accuracy}%`;
    }

    // Build share text based on trigger
    let text = '';

    switch (trigger) {
      case 'campaign_complete':
        text = `I just completed the STELLAR DESCENT campaign!\n\n`;
        text += `Final Rating: ${rating}\n`;
        text += `Total Kills: ${kills}\n`;
        if (accuracyStr) text += `Accuracy: ${accuracyStr}\n`;
        text += `\nThe colony is saved. For now...\n`;
        break;

      case 'boss_defeat':
        text = `I defeated ${bossName || 'the Brood Queen'} in STELLAR DESCENT!\n\n`;
        text += `Time: ${timeStr}\n`;
        text += `Kills: ${kills}\n`;
        text += `Rating: ${rating}\n`;
        break;

      case 'achievement_unlocked':
        text = `Achievement Unlocked in STELLAR DESCENT!\n\n`;
        text += `"${achievementName}"\n`;
        if (missionName) text += `Level: ${missionName}\n`;
        break;

      case 'personal_best':
        text = `NEW PERSONAL BEST in STELLAR DESCENT!\n\n`;
        text += `${missionName}\n`;
        text += `Time: ${timeStr}\n`;
        text += `Kills: ${kills}\n`;
        if (accuracyStr) text += `Accuracy: ${accuracyStr}\n`;
        text += `Rating: ${rating}\n`;
        break;
      default:
        text = `Just completed ${missionName} in STELLAR DESCENT!\n\n`;
        text += `Time: ${timeStr}\n`;
        text += `Kills: ${kills}\n`;
        if (accuracyStr) text += `Accuracy: ${accuracyStr}\n`;
        text += `Rating: ${rating}`;
        if (isPersonalBest) text += ` - NEW BEST!`;
        text += '\n';
        break;
    }

    // Add game link
    text += `\nPlay now: ${GAME_URL}`;
    text += '\n\n#StellarDescent #FPS #Gaming';

    return text;
  }

  /**
   * Generate share text with emoji formatting
   */
  generateShareTextWithEmoji(stats: ShareStats, trigger: ShareTrigger = 'level_complete'): string {
    const {
      missionName,
      rating,
      kills,
      isPersonalBest,
      isCampaignComplete,
      achievementName,
      bossName,
    } = stats;
    const levelStats = stats.stats;

    // Format time
    const timeSeconds = levelStats.timeSpent;
    const mins = Math.floor(timeSeconds / 60);
    const secs = Math.floor(timeSeconds % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Calculate accuracy
    let accuracyStr = '';
    if (levelStats.totalShots && levelStats.totalShots > 0 && levelStats.shotsHit !== undefined) {
      const accuracy = Math.round((levelStats.shotsHit / levelStats.totalShots) * 100);
      accuracyStr = `${accuracy}%`;
    }

    // Rating emoji
    const ratingEmoji: Record<string, string> = {
      S: '\u2B50\u2B50\u2B50', // 3 stars
      A: '\u2B50\u2B50', // 2 stars
      B: '\u2B50', // 1 star
      C: '\u2705', // check
      D: '\u274C', // x
    };

    let text = '';

    switch (trigger) {
      case 'campaign_complete':
        text = `\uD83C\uDF89 CAMPAIGN COMPLETE - STELLAR DESCENT \uD83C\uDF89\n\n`;
        text += `${ratingEmoji[rating] || ''} Rating: ${rating}\n`;
        text += `\uD83D\uDC80 Kills: ${kills}\n`;
        if (accuracyStr) text += `\uD83C\uDFAF Accuracy: ${accuracyStr}\n`;
        text += `\nThe colony is saved! \uD83D\uDE80\n`;
        break;

      case 'boss_defeat':
        text = `\uD83D\uDC7E BOSS DEFEATED - STELLAR DESCENT \uD83D\uDC7E\n\n`;
        text += `${bossName || 'The Brood Queen'} is down!\n`;
        text += `\u23F1\uFE0F Time: ${timeStr}\n`;
        text += `\uD83D\uDC80 Kills: ${kills}\n`;
        text += `${ratingEmoji[rating] || ''} Rating: ${rating}\n`;
        break;

      case 'achievement_unlocked':
        text = `\uD83C\uDFC6 ACHIEVEMENT UNLOCKED \uD83C\uDFC6\n\n`;
        text += `"${achievementName}"\n`;
        if (missionName) text += `\uD83D\uDCCD Level: ${missionName}\n`;
        text += `\n\uD83C\uDFAE STELLAR DESCENT\n`;
        break;

      case 'personal_best':
        text = `\uD83D\uDEA8 NEW PERSONAL BEST! \uD83D\uDEA8\n\n`;
        text += `\uD83D\uDCCD ${missionName}\n`;
        text += `\u23F1\uFE0F Time: ${timeStr}\n`;
        text += `\uD83D\uDC80 Kills: ${kills}\n`;
        if (accuracyStr) text += `\uD83C\uDFAF Accuracy: ${accuracyStr}\n`;
        text += `${ratingEmoji[rating] || ''} Rating: ${rating}\n`;
        break;
      default:
        text = `\uD83C\uDFAE Just completed ${missionName} in STELLAR DESCENT!\n\n`;
        text += `\u23F1\uFE0F Time: ${timeStr}\n`;
        text += `\uD83D\uDC80 Kills: ${kills}\n`;
        if (accuracyStr) text += `\uD83C\uDFAF Accuracy: ${accuracyStr}\n`;
        text += `${ratingEmoji[rating] || ''} Rating: ${rating}`;
        if (isPersonalBest) text += ` \uD83C\uDD95`;
        text += '\n';
        break;
    }

    // Add game link
    text += `\n\uD83D\uDD17 Play: ${GAME_URL}`;
    text += '\n\n#StellarDescent #FPS #Gaming';

    return text;
  }

  /**
   * Get level name from level ID
   */
  getLevelName(levelId: LevelId): string {
    const config = CAMPAIGN_LEVELS[levelId];
    return config?.missionName || levelId;
  }

  /**
   * Create screenshot data from share stats
   */
  createScreenshotData(stats: ShareStats): ScreenshotData {
    return {
      stats: stats.stats,
      levelId: stats.levelId,
      missionName: stats.missionName,
      rating: stats.rating,
      kills: stats.kills,
      isPersonalBest: stats.isPersonalBest,
      isCampaignComplete: stats.isCampaignComplete,
    };
  }
}

// Singleton instance
let shareSystemInstance: ShareSystemImpl | null = null;

/**
 * Get the singleton ShareSystem instance
 */
export function getShareSystem(): ShareSystemImpl {
  if (!shareSystemInstance) {
    shareSystemInstance = new ShareSystemImpl();
  }
  return shareSystemInstance;
}

/**
 * Initialize the share system with game canvas reference
 */
export function initShareSystem(canvas: HTMLCanvasElement): void {
  getShareSystem().setGameCanvas(canvas);
}

/**
 * Dispose the ShareSystem singleton
 */
export function disposeShareSystem(): void {
  if (shareSystemInstance) {
    shareSystemInstance = null;
  }
}

export type ShareSystem = ShareSystemImpl;
