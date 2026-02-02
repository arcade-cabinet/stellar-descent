/**
 * ScreenshotCapture - Captures game canvas as shareable images
 *
 * Features:
 * - Capture game canvas as image blob
 * - Add stats overlay with level info
 * - Add game logo watermark
 * - Support different aspect ratios (1:1 for social, 16:9 for wide)
 */

import { getLogger } from '../core/Logger';
import type { LevelId } from '../levels/types';

/** Stats data for screenshot overlay (flexible format) */
export interface ScreenshotStats {
  /** Time spent in level in seconds */
  timeSpent: number;
  /** Kill count (optional, can be passed separately) */
  kills?: number;
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

const log = getLogger('ScreenshotCapture');

export interface ScreenshotOptions {
  /** Include stats overlay on screenshot */
  includeStats?: boolean;
  /** Include game logo watermark */
  includeLogo?: boolean;
  /** Output aspect ratio */
  aspectRatio?: '16:9' | '1:1' | '4:3' | 'original';
  /** Output quality (0-1) */
  quality?: number;
  /** Maximum output width */
  maxWidth?: number;
}

export interface ScreenshotData {
  /** Stats from the completed level */
  stats: ScreenshotStats;
  /** Level ID */
  levelId: LevelId;
  /** Mission name */
  missionName: string;
  /** Performance rating */
  rating: string;
  /** Kill count from context */
  kills: number;
  /** Whether it's a personal best */
  isPersonalBest?: boolean;
  /** Whether this is campaign completion */
  isCampaignComplete?: boolean;
}

// Constants for overlay rendering
const OVERLAY_PADDING = 20;
const LOGO_HEIGHT_RATIO = 0.08; // 8% of image height
const STATS_PANEL_HEIGHT_RATIO = 0.25; // 25% of image height for stats
const FONT_FAMILY = '"Share Tech Mono", "Courier New", monospace';

/**
 * ScreenshotCapture - Singleton for capturing and processing game screenshots
 */
class ScreenshotCaptureImpl {
  /**
   * Capture the game canvas and optionally add overlays
   */
  async captureCanvas(
    canvas: HTMLCanvasElement,
    data?: ScreenshotData,
    options: ScreenshotOptions = {}
  ): Promise<Blob> {
    const {
      includeStats = true,
      includeLogo = true,
      aspectRatio = 'original',
      quality = 0.92,
      maxWidth = 1920,
    } = options;

    log.info('Capturing screenshot', { aspectRatio, includeStats, includeLogo });

    // Get source dimensions
    const srcWidth = canvas.width;
    const srcHeight = canvas.height;

    // Calculate output dimensions based on aspect ratio
    const { width: outWidth, height: outHeight } = this.calculateOutputDimensions(
      srcWidth,
      srcHeight,
      aspectRatio,
      maxWidth
    );

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outWidth;
    outputCanvas.height = outHeight;
    const ctx = outputCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D context for screenshot');
    }

    // Draw base game image (centered/cropped for aspect ratio)
    this.drawGameImage(ctx, canvas, srcWidth, srcHeight, outWidth, outHeight, aspectRatio);

    // Add vignette effect
    this.drawVignette(ctx, outWidth, outHeight);

    // Add overlays if requested
    if (includeLogo) {
      await this.drawLogo(ctx, outWidth, outHeight);
    }

    if (includeStats && data) {
      this.drawStatsOverlay(ctx, data, outWidth, outHeight);
    }

    // Add scan lines for retro effect
    this.drawScanLines(ctx, outWidth, outHeight);

    // Convert to blob
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            log.info('Screenshot captured', { size: blob.size, type: blob.type });
            resolve(blob);
          } else {
            reject(new Error('Failed to create screenshot blob'));
          }
        },
        'image/png',
        quality
      );
    });
  }

  /**
   * Calculate output dimensions based on aspect ratio
   */
  private calculateOutputDimensions(
    srcWidth: number,
    srcHeight: number,
    aspectRatio: string,
    maxWidth: number
  ): { width: number; height: number } {
    let width = srcWidth;
    let height = srcHeight;

    switch (aspectRatio) {
      case '16:9':
        width = Math.min(srcWidth, maxWidth);
        height = Math.round(width * (9 / 16));
        break;
      case '1:1':
        width = Math.min(srcWidth, srcHeight, maxWidth);
        height = width;
        break;
      case '4:3':
        width = Math.min(srcWidth, maxWidth);
        height = Math.round(width * (3 / 4));
        break;
      default:
        // Original aspect ratio, just limit width
        if (srcWidth > maxWidth) {
          width = maxWidth;
          height = Math.round((srcHeight / srcWidth) * maxWidth);
        }
    }

    return { width, height };
  }

  /**
   * Draw the game image, handling cropping for different aspect ratios
   */
  private drawGameImage(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    srcWidth: number,
    srcHeight: number,
    outWidth: number,
    outHeight: number,
    aspectRatio: string
  ): void {
    const srcAspect = srcWidth / srcHeight;
    const outAspect = outWidth / outHeight;

    let sx = 0,
      sy = 0,
      sw = srcWidth,
      sh = srcHeight;

    if (aspectRatio !== 'original') {
      if (srcAspect > outAspect) {
        // Source is wider, crop sides
        sw = Math.round(srcHeight * outAspect);
        sx = Math.round((srcWidth - sw) / 2);
      } else if (srcAspect < outAspect) {
        // Source is taller, crop top/bottom
        sh = Math.round(srcWidth / outAspect);
        sy = Math.round((srcHeight - sh) / 2);
      }
    }

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
  }

  /**
   * Draw vignette effect around edges
   */
  private drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Draw the game logo watermark
   */
  private async drawLogo(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): Promise<void> {
    // For now, draw text logo since we may not have a logo image
    const logoHeight = height * LOGO_HEIGHT_RATIO;
    const fontSize = Math.max(16, Math.round(logoHeight * 0.6));

    ctx.save();
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillText('STELLAR DESCENT', width - OVERLAY_PADDING + 2, OVERLAY_PADDING + 2);

    // Main text with olive gold color
    ctx.fillStyle = 'rgba(181, 166, 66, 0.9)';
    ctx.fillText('STELLAR DESCENT', width - OVERLAY_PADDING, OVERLAY_PADDING);

    ctx.restore();
  }

  /**
   * Draw stats overlay panel
   */
  private drawStatsOverlay(
    ctx: CanvasRenderingContext2D,
    data: ScreenshotData,
    width: number,
    height: number
  ): void {
    const panelHeight = height * STATS_PANEL_HEIGHT_RATIO;
    const panelY = height - panelHeight;

    // Semi-transparent panel background
    const gradient = ctx.createLinearGradient(0, panelY, 0, height);
    gradient.addColorStop(0, 'rgba(10, 10, 12, 0)');
    gradient.addColorStop(0.3, 'rgba(10, 10, 12, 0.85)');
    gradient.addColorStop(1, 'rgba(10, 10, 12, 0.95)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, panelY, width, panelHeight);

    // Draw border line at top of panel
    ctx.strokeStyle = 'rgba(74, 93, 35, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(OVERLAY_PADDING, panelY + panelHeight * 0.3);
    ctx.lineTo(width - OVERLAY_PADDING, panelY + panelHeight * 0.3);
    ctx.stroke();

    const contentY = panelY + panelHeight * 0.4;
    const _lineHeight = Math.max(14, Math.round(panelHeight * 0.15));

    // Mission complete text
    ctx.save();
    const titleSize = Math.max(18, Math.round(panelHeight * 0.18));
    ctx.font = `bold ${titleSize}px "Rajdhani", Impact, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Title
    ctx.fillStyle = '#b5a642';
    const titleText = data.isCampaignComplete ? 'CAMPAIGN COMPLETE' : 'MISSION COMPLETE';
    ctx.fillText(titleText, OVERLAY_PADDING, contentY);

    // Mission name
    const nameSize = Math.max(12, Math.round(panelHeight * 0.1));
    ctx.font = `${nameSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText(data.missionName, OVERLAY_PADDING, contentY + titleSize + 4);

    // Stats row
    const statsY = contentY + titleSize + nameSize + 16;
    const statsSize = Math.max(11, Math.round(panelHeight * 0.09));
    ctx.font = `${statsSize}px ${FONT_FAMILY}`;

    // Format time
    const timeSeconds = data.stats.timeSpent;
    const mins = Math.floor(timeSeconds / 60);
    const secs = Math.floor(timeSeconds % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    // Calculate accuracy
    let accuracyStr = 'N/A';
    if (data.stats.totalShots && data.stats.totalShots > 0 && data.stats.shotsHit !== undefined) {
      const accuracy = Math.round((data.stats.shotsHit / data.stats.totalShots) * 100);
      accuracyStr = `${accuracy}%`;
    }

    // Draw stats with icons
    const stats = [
      { icon: '\u23F1', label: 'TIME', value: timeStr },
      { icon: '\u2694', label: 'KILLS', value: data.kills.toString() },
      { icon: '\u25CE', label: 'ACCURACY', value: accuracyStr },
    ];

    let statX = OVERLAY_PADDING;
    const statSpacing = Math.min(150, (width - OVERLAY_PADDING * 2) / stats.length);

    stats.forEach((stat) => {
      // Icon
      ctx.fillStyle = '#b5a642';
      ctx.fillText(stat.icon, statX, statsY);

      // Label
      ctx.fillStyle = '#666';
      const labelSize = Math.max(9, Math.round(panelHeight * 0.06));
      ctx.font = `${labelSize}px ${FONT_FAMILY}`;
      ctx.fillText(stat.label, statX + 20, statsY);

      // Value
      ctx.fillStyle = '#b5a642';
      ctx.font = `bold ${statsSize}px ${FONT_FAMILY}`;
      ctx.fillText(stat.value, statX + 20, statsY + labelSize + 4);

      statX += statSpacing;
    });

    // Rating on the right
    const ratingSize = Math.max(32, Math.round(panelHeight * 0.35));
    ctx.font = `bold ${ratingSize}px "Rajdhani", Impact, sans-serif`;
    ctx.textAlign = 'right';

    // Rating color based on grade
    const ratingColors: Record<string, string> = {
      S: '#ffd700',
      A: '#66ff66',
      B: '#b5a642',
      C: '#a0a0a0',
      D: '#8b4513',
    };
    ctx.fillStyle = ratingColors[data.rating] || '#b5a642';

    // Add glow effect for S rating
    if (data.rating === 'S') {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
    }

    ctx.fillText(data.rating, width - OVERLAY_PADDING, contentY);
    ctx.shadowBlur = 0;

    // Rating label
    const ratingLabelSize = Math.max(9, Math.round(panelHeight * 0.06));
    ctx.font = `${ratingLabelSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = '#666';
    ctx.fillText('RATING', width - OVERLAY_PADDING, contentY + ratingSize + 2);

    // Personal best badge
    if (data.isPersonalBest) {
      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${ratingLabelSize}px ${FONT_FAMILY}`;
      ctx.fillText(
        'NEW BEST!',
        width - OVERLAY_PADDING,
        contentY + ratingSize + ratingLabelSize + 6
      );
    }

    ctx.restore();
  }

  /**
   * Draw subtle scan lines for retro effect
   */
  private drawScanLines(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.globalAlpha = 0.08;

    for (let y = 0; y < height; y += 4) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y, width, 2);
    }

    ctx.restore();
  }

  /**
   * Generate a quick preview (smaller, faster)
   */
  async capturePreview(
    canvas: HTMLCanvasElement,
    data?: ScreenshotData,
    options: ScreenshotOptions = {}
  ): Promise<string> {
    const previewOptions: ScreenshotOptions = {
      ...options,
      maxWidth: 640,
      quality: 0.8,
    };

    const blob = await this.captureCanvas(canvas, data, previewOptions);
    return URL.createObjectURL(blob);
  }
}

// Singleton instance
let screenshotCaptureInstance: ScreenshotCaptureImpl | null = null;

/**
 * Get the singleton ScreenshotCapture instance
 */
export function getScreenshotCapture(): ScreenshotCaptureImpl {
  if (!screenshotCaptureInstance) {
    screenshotCaptureInstance = new ScreenshotCaptureImpl();
  }
  return screenshotCaptureInstance;
}

/**
 * Dispose the ScreenshotCapture singleton
 */
export function disposeScreenshotCapture(): void {
  if (screenshotCaptureInstance) {
    screenshotCaptureInstance = null;
  }
}

export type ScreenshotCapture = ScreenshotCaptureImpl;
