/**
 * ShareDialog - Social sharing modal for Stellar Descent
 *
 * Features:
 * - Screenshot preview with stats overlay toggle
 * - Editable share text
 * - Platform buttons (Twitter, Facebook, native share)
 * - Copy and download actions
 * - Military terminal styling
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { getAudioManager } from '../../game/core/AudioManager';
import type { LevelId } from '../../game/levels/types';
import {
  getShareSystem,
  type ShareStats,
  type ShareTrigger,
} from '../../game/social/ShareSystem';
import type { ScreenshotData } from '../../game/social/ScreenshotCapture';
import styles from './ShareDialog.module.css';

/** Stats data for the share dialog */
export interface ShareDialogStats {
  /** Time spent in level in seconds */
  timeSpent: number;
  /** Number of kills */
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

export interface ShareDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Level ID for sharing */
  levelId: LevelId;
  /** Mission name */
  missionName: string;
  /** Level stats */
  stats: ShareDialogStats;
  /** Kill count */
  kills: number;
  /** Performance rating */
  rating: string;
  /** Share trigger type */
  trigger?: ShareTrigger;
  /** Whether this is a personal best */
  isPersonalBest?: boolean;
  /** Whether this is campaign completion */
  isCampaignComplete?: boolean;
  /** Achievement name if sharing an achievement */
  achievementName?: string;
  /** Boss name if sharing a boss defeat */
  bossName?: string;
}

// Twitter character limit
const TWITTER_CHAR_LIMIT = 280;

/**
 * ShareDialog - Modal for sharing game achievements
 */
export function ShareDialog({
  isOpen,
  onClose,
  levelId,
  missionName,
  stats,
  kills,
  rating,
  trigger = 'level_complete',
  isPersonalBest = false,
  isCampaignComplete = false,
  achievementName,
  bossName,
}: ShareDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [includeStats, setIncludeStats] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Build share stats object
  const shareStats: ShareStats = useMemo(() => ({
    levelId,
    missionName,
    rating,
    stats,
    kills,
    isPersonalBest,
    isCampaignComplete,
    achievementName,
    bossName,
  }), [levelId, missionName, rating, stats, kills, isPersonalBest, isCampaignComplete, achievementName, bossName]);

  // Generate initial share text
  const [shareText, setShareText] = useState('');

  useEffect(() => {
    if (isOpen) {
      const shareSystem = getShareSystem();
      const text = shareSystem.generateShareTextWithEmoji(shareStats, trigger);
      setShareText(text);
    }
  }, [isOpen, shareStats, trigger]);

  // Capture screenshot when dialog opens
  useEffect(() => {
    if (!isOpen) {
      // Clean up preview URL when closing
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setScreenshotBlob(null);
      setCopiedText(false);
      setCopiedImage(false);
      setStatusMessage(null);
      return;
    }

    const captureScreenshot = async () => {
      setIsLoading(true);
      try {
        const shareSystem = getShareSystem();
        const screenshotData: ScreenshotData = shareSystem.createScreenshotData(shareStats);

        // Capture preview
        const url = await shareSystem.capturePreview(
          includeStats ? screenshotData : undefined
        );
        setPreviewUrl(url);

        // Capture full-quality for download/share
        const blob = await shareSystem.captureScreenshot(
          includeStats ? screenshotData : undefined,
          { aspectRatio: '16:9', quality: 0.95 }
        );
        setScreenshotBlob(blob);
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
        setStatusMessage('Failed to capture screenshot');
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    captureScreenshot();
  }, [isOpen, includeStats, shareStats]);

  // Re-capture when stats toggle changes
  useEffect(() => {
    if (!isOpen) return;

    const recapture = async () => {
      setIsLoading(true);
      try {
        const shareSystem = getShareSystem();
        const screenshotData: ScreenshotData = shareSystem.createScreenshotData(shareStats);

        // Clean up old preview URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        const url = await shareSystem.capturePreview(
          includeStats ? screenshotData : undefined
        );
        setPreviewUrl(url);

        const blob = await shareSystem.captureScreenshot(
          includeStats ? screenshotData : undefined,
          { aspectRatio: '16:9', quality: 0.95 }
        );
        setScreenshotBlob(blob);
      } catch {
        // Silent fail on recapture
      } finally {
        setIsLoading(false);
      }
    };

    recapture();
  }, [includeStats]);

  // Play sound helper
  const playSound = useCallback((type: 'click' | 'success' | 'error') => {
    const audio = getAudioManager();
    switch (type) {
      case 'click':
        audio.play('ui_click', { volume: 0.3 });
        break;
      case 'success':
        audio.play('ui_click', { volume: 0.5 });
        break;
      case 'error':
        audio.play('ui_click', { volume: 0.2 });
        break;
    }
  }, []);

  // Show status message temporarily
  const showStatus = useCallback((message: string, error = false) => {
    setStatusMessage(message);
    setIsError(error);
    setTimeout(() => {
      setStatusMessage(null);
      setIsError(false);
    }, 3000);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    playSound('click');
    onClose();
  }, [onClose, playSound]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Check if native share is available
  const canNativeShare = useMemo(() => {
    const shareSystem = getShareSystem();
    return shareSystem.canNativeShare();
  }, []);

  // Handle Twitter share
  const handleTwitterShare = useCallback(async () => {
    playSound('click');
    const shareSystem = getShareSystem();
    await shareSystem.shareToTwitter(shareText, screenshotBlob || undefined);
    showStatus('Opening Twitter...');
  }, [shareText, screenshotBlob, playSound, showStatus]);

  // Handle Facebook share
  const handleFacebookShare = useCallback(async () => {
    playSound('click');
    const shareSystem = getShareSystem();
    await shareSystem.shareToFacebook(shareText, screenshotBlob || undefined);
    showStatus('Opening Facebook...');
  }, [shareText, screenshotBlob, playSound, showStatus]);

  // Handle native share
  const handleNativeShare = useCallback(async () => {
    playSound('click');
    const shareSystem = getShareSystem();
    const success = await shareSystem.shareNative(shareText, screenshotBlob || undefined);
    if (success) {
      playSound('success');
      showStatus('Shared successfully!');
    }
  }, [shareText, screenshotBlob, playSound, showStatus]);

  // Handle copy text
  const handleCopyText = useCallback(async () => {
    playSound('click');
    const shareSystem = getShareSystem();
    const success = await shareSystem.copyToClipboard(shareText);
    if (success) {
      playSound('success');
      setCopiedText(true);
      showStatus('Text copied to clipboard!');
      setTimeout(() => setCopiedText(false), 3000);
    } else {
      playSound('error');
      showStatus('Failed to copy text', true);
    }
  }, [shareText, playSound, showStatus]);

  // Handle copy image
  const handleCopyImage = useCallback(async () => {
    if (!screenshotBlob) return;

    playSound('click');
    const shareSystem = getShareSystem();
    const success = await shareSystem.copyImageToClipboard(screenshotBlob);
    if (success) {
      playSound('success');
      setCopiedImage(true);
      showStatus('Image copied to clipboard!');
      setTimeout(() => setCopiedImage(false), 3000);
    } else {
      playSound('error');
      showStatus('Failed to copy image', true);
    }
  }, [screenshotBlob, playSound, showStatus]);

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!screenshotBlob) return;

    playSound('click');
    const shareSystem = getShareSystem();
    const filename = `stellar-descent-${levelId}-${Date.now()}.png`;
    await shareSystem.downloadImage(screenshotBlob, filename);
    playSound('success');
    showStatus('Screenshot downloaded!');
  }, [screenshotBlob, levelId, playSound, showStatus]);

  // Handle stats toggle
  const handleToggleStats = useCallback(() => {
    playSound('click');
    setIncludeStats((prev) => !prev);
  }, [playSound]);

  // Handle text change
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setShareText(e.target.value);
  }, []);

  // Character count for Twitter
  const charCount = shareText.length;
  const charCountClass = useMemo(() => {
    if (charCount > TWITTER_CHAR_LIMIT) return styles.error;
    if (charCount > TWITTER_CHAR_LIMIT - 20) return styles.warning;
    return '';
  }, [charCount]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-labelledby="share-title"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      {/* Scan line effect */}
      <div className={styles.scanLines} aria-hidden="true" />

      <div className={styles.container}>
        {/* Corner brackets */}
        <div className={styles.cornerTL} aria-hidden="true" />
        <div className={styles.cornerTR} aria-hidden="true" />
        <div className={styles.cornerBL} aria-hidden="true" />
        <div className={styles.cornerBR} aria-hidden="true" />

        {/* Close button */}
        <button
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close share dialog"
        >
          {'\u2715'}
        </button>

        {/* Header */}
        <div className={styles.header}>
          <span className={styles.shareIcon} aria-hidden="true">{'\u2197'}</span>
          <h2 id="share-title" className={styles.title}>Share</h2>
        </div>

        {/* Screenshot preview section */}
        <div className={styles.divider}>
          <span className={styles.dividerText}>SCREENSHOT PREVIEW</span>
        </div>

        <div className={styles.previewContainer}>
          {isLoading && (
            <div className={styles.previewLoading}>
              Capturing...
            </div>
          )}
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Screenshot preview"
              className={styles.previewImage}
            />
          ) : !isLoading && (
            <div className={styles.previewPlaceholder}>
              Screenshot not available
            </div>
          )}
        </div>

        {/* Stats overlay toggle */}
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Include Stats Overlay</span>
          <button
            className={`${styles.toggle} ${includeStats ? styles.active : ''}`}
            onClick={handleToggleStats}
            aria-pressed={includeStats}
            aria-label="Toggle stats overlay"
          >
            <div className={styles.toggleKnob} />
          </button>
        </div>

        {/* Share text section */}
        <div className={styles.divider}>
          <span className={styles.dividerText}>SHARE MESSAGE</span>
        </div>

        <div className={styles.textAreaContainer}>
          <label className={styles.textAreaLabel} htmlFor="share-text">
            Edit your message (optional)
          </label>
          <textarea
            id="share-text"
            ref={textAreaRef}
            className={styles.textArea}
            value={shareText}
            onChange={handleTextChange}
            placeholder="Enter your share message..."
          />
          <div className={`${styles.charCount} ${charCountClass}`}>
            {charCount}/{TWITTER_CHAR_LIMIT}
          </div>
        </div>

        {/* Platform buttons */}
        <div className={styles.divider}>
          <span className={styles.dividerText}>SHARE TO</span>
        </div>

        <div className={styles.platformButtons}>
          {canNativeShare && (
            <button
              className={`${styles.platformButton} ${styles.native} ${styles.nativeShareButton}`}
              onClick={handleNativeShare}
              disabled={isLoading}
            >
              <span className={styles.platformIcon}>{'\u2197'}</span>
              Share
            </button>
          )}

          <button
            className={`${styles.platformButton} ${styles.twitter}`}
            onClick={handleTwitterShare}
            disabled={isLoading}
          >
            <span className={styles.platformIcon}>X</span>
            Twitter
          </button>

          <button
            className={`${styles.platformButton} ${styles.facebook}`}
            onClick={handleFacebookShare}
            disabled={isLoading}
          >
            <span className={styles.platformIcon}>f</span>
            Facebook
          </button>
        </div>

        {/* Action buttons */}
        <div className={styles.actionButtons}>
          <button
            className={`${styles.actionButton} ${copiedText ? styles.success : ''}`}
            onClick={handleCopyText}
            disabled={isLoading}
          >
            <span className={styles.actionIcon}>
              {copiedText ? '\u2713' : '\u2398'}
            </span>
            {copiedText ? 'Copied!' : 'Copy Text'}
          </button>

          <button
            className={`${styles.actionButton} ${copiedImage ? styles.success : ''}`}
            onClick={handleCopyImage}
            disabled={isLoading || !screenshotBlob}
          >
            <span className={styles.actionIcon}>
              {copiedImage ? '\u2713' : '\uD83D\uDCCB'}
            </span>
            {copiedImage ? 'Copied!' : 'Copy Image'}
          </button>

          <button
            className={styles.actionButton}
            onClick={handleDownload}
            disabled={isLoading || !screenshotBlob}
          >
            <span className={styles.actionIcon}>{'\u2193'}</span>
            Download
          </button>
        </div>

        {/* Status message */}
        {statusMessage && (
          <div className={`${styles.statusMessage} ${isError ? styles.error : ''}`}>
            {statusMessage}
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerText}>
            7TH DROP MARINES - STELLAR DESCENT
          </span>
        </div>
      </div>
    </div>
  );
}
