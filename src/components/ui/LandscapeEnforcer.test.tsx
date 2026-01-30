import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandscapeEnforcer } from './LandscapeEnforcer';

// Mock the responsive utilities
const mockShouldEnforceLandscape = vi.fn();
const mockVibrate = vi.fn();
const mockLockToLandscape = vi.fn();

vi.mock('../../game/utils/responsive', () => ({
  shouldEnforceLandscape: () => mockShouldEnforceLandscape(),
  vibrate: (pattern: number | number[]) => mockVibrate(pattern),
  lockToLandscape: () => mockLockToLandscape(),
}));

describe('LandscapeEnforcer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockShouldEnforceLandscape.mockReturnValue(false);
    mockVibrate.mockClear();
    mockLockToLandscape.mockClear();
    mockLockToLandscape.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when landscape orientation is detected', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer />);

      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('should render when portrait orientation is detected on mobile', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    it('should display default title', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      expect(screen.getByText('ROTATE DEVICE')).toBeTruthy();
    });

    it('should display custom title when provided', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer title="TURN YOUR PHONE" />);

      expect(screen.getByText('TURN YOUR PHONE')).toBeTruthy();
    });

    it('should display custom message when provided', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer message="Please rotate to continue." />);

      expect(screen.getByText('Please rotate to continue.')).toBeTruthy();
    });

    it('should display game logo/branding', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      expect(screen.getByText('STELLAR DESCENT')).toBeTruthy();
      expect(screen.getByText('SD')).toBeTruthy();
    });

    it('should display warning badge', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      expect(screen.getByText('ALERT')).toBeTruthy();
    });

    it('should display status line', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      expect(screen.getByText('AWAITING ORIENTATION CHANGE')).toBeTruthy();
    });
  });

  describe('orientation changes', () => {
    it('should hide overlay when orientation changes to landscape', async () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      // Verify it's showing
      expect(screen.getByRole('alertdialog')).toBeTruthy();

      // Simulate orientation change to landscape
      mockShouldEnforceLandscape.mockReturnValue(false);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Wait for fade-out animation
      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('should show overlay when orientation changes to portrait', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer />);

      expect(screen.queryByRole('alertdialog')).toBeNull();

      // Simulate orientation change to portrait
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(screen.getByRole('alertdialog')).toBeTruthy();
    });
  });

  describe('callbacks', () => {
    it('should call onPortraitDetected when portrait mode is detected', () => {
      const onPortraitDetected = vi.fn();
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer onPortraitDetected={onPortraitDetected} />);

      expect(onPortraitDetected).not.toHaveBeenCalled();

      // Simulate orientation change to portrait
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(onPortraitDetected).toHaveBeenCalledTimes(1);
    });

    it('should call onLandscapeRestored when landscape mode is restored', () => {
      const onLandscapeRestored = vi.fn();
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer onLandscapeRestored={onLandscapeRestored} />);

      expect(onLandscapeRestored).not.toHaveBeenCalled();

      // Simulate orientation change to landscape
      mockShouldEnforceLandscape.mockReturnValue(false);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(onLandscapeRestored).toHaveBeenCalledTimes(1);
    });
  });

  describe('haptic feedback', () => {
    it('should trigger vibration when overlay appears', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer />);

      // Simulate orientation change to portrait
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(mockVibrate).toHaveBeenCalledWith([50, 30, 50]);
    });

    it('should not trigger vibration when haptics are disabled', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer enableHaptics={false} />);

      // Simulate orientation change to portrait
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(mockVibrate).not.toHaveBeenCalled();
    });
  });

  describe('orientation lock', () => {
    it('should attempt to lock orientation when overlay appears', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer />);

      expect(mockLockToLandscape).not.toHaveBeenCalled();

      // Simulate orientation change to portrait
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(mockLockToLandscape).toHaveBeenCalledTimes(1);
    });

    it('should not attempt to lock orientation when attemptOrientationLock is false', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer attemptOrientationLock={false} />);

      // Simulate orientation change to portrait
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(mockLockToLandscape).not.toHaveBeenCalled();
    });

    it('should only attempt orientation lock once per portrait detection', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer />);

      // First portrait detection
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Additional resize events while in portrait
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(mockLockToLandscape).toHaveBeenCalledTimes(1);
    });

    it('should allow new orientation lock attempt after landscape is restored', () => {
      mockShouldEnforceLandscape.mockReturnValue(false);
      render(<LandscapeEnforcer />);

      // First portrait detection
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(mockLockToLandscape).toHaveBeenCalledTimes(1);

      // Restore landscape
      mockShouldEnforceLandscape.mockReturnValue(false);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Second portrait detection
      mockShouldEnforceLandscape.mockReturnValue(true);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(mockLockToLandscape).toHaveBeenCalledTimes(2);
    });
  });

  describe('accessibility', () => {
    it('should have proper alertdialog role', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      expect(screen.getByRole('alertdialog')).toBeTruthy();
    });

    it('should have aria-modal attribute', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('should have aria-labelledby pointing to title', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog.getAttribute('aria-labelledby')).toBe('landscape-enforcer-title');
    });

    it('should have aria-describedby pointing to message', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      const dialog = screen.getByRole('alertdialog');
      expect(dialog.getAttribute('aria-describedby')).toBe('landscape-enforcer-message');
    });

    it('should have screen reader announcement', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      const srAnnouncement = screen.getByText(/rotate your device to landscape/i);
      expect(srAnnouncement).toBeTruthy();
    });

    it('should have decorative elements hidden from screen readers', () => {
      mockShouldEnforceLandscape.mockReturnValue(true);
      render(<LandscapeEnforcer />);

      // Check that decorative elements have aria-hidden
      const dialog = screen.getByRole('alertdialog');
      const hiddenElements = dialog.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenElements.length).toBeGreaterThan(0);
    });
  });
});
