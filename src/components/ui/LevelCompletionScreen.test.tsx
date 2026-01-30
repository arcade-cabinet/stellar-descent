import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameProvider } from '../../game/context/GameContext';
import { LevelCompletionScreen, type LevelStats } from './LevelCompletionScreen';

// Mock the audio manager
vi.mock('../../game/core/AudioManager', () => ({
  getAudioManager: () => ({
    playMusic: vi.fn(),
    play: vi.fn(),
  }),
}));

const defaultStats: LevelStats = {
  timeElapsed: 325, // 5:25
  kills: 15,
  shotsFired: 100,
  shotsHit: 65,
  headshots: 12,
  damageTaken: 35,
  deaths: 1,
};

const minimalStats: LevelStats = {
  timeElapsed: 180,
  kills: 5,
};

const perfectStats: LevelStats = {
  timeElapsed: 120,
  kills: 30,
  shotsFired: 50,
  shotsHit: 45,
  headshots: 20,
  damageTaken: 0,
  deaths: 0,
};

function renderComponent(props: Partial<Parameters<typeof LevelCompletionScreen>[0]> = {}) {
  const defaultProps = {
    onContinue: vi.fn(),
    onMainMenu: vi.fn(),
    levelId: 'landfall' as const,
    missionName: 'LANDFALL',
    stats: defaultStats,
    ...props,
  };

  return render(
    <GameProvider>
      <LevelCompletionScreen {...defaultProps} />
    </GameProvider>
  );
}

describe('LevelCompletionScreen', () => {
  describe('rendering', () => {
    it('should render mission complete title', () => {
      renderComponent();

      expect(screen.getByText('MISSION COMPLETE')).toBeTruthy();
    });

    it('should render campaign complete title for final level', () => {
      renderComponent({ isFinalLevel: true });

      expect(screen.getByText('CAMPAIGN COMPLETE')).toBeTruthy();
    });

    it('should render mission name', () => {
      renderComponent({ missionName: 'FOB DELTA' });

      expect(screen.getByText('FOB DELTA')).toBeTruthy();
    });

    it('should render time stat in MM:SS format', async () => {
      renderComponent({ stats: { ...defaultStats, timeElapsed: 325 } });

      await vi.waitFor(
        () => {
          expect(screen.getByText('05:25')).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should render accuracy when tracked', async () => {
      renderComponent({
        stats: {
          ...defaultStats,
          shotsFired: 100,
          shotsHit: 65,
        },
      });

      await vi.waitFor(
        () => {
          expect(screen.getByText('65%')).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should not render accuracy when not tracked', () => {
      renderComponent({ stats: minimalStats });

      expect(screen.queryByText('ACCURACY')).toBeNull();
    });

    it('should render intel/secrets when provided', () => {
      renderComponent({
        stats: {
          ...defaultStats,
          secretsFound: 2,
          totalSecrets: 5,
        },
      });

      expect(screen.getByText('INTEL RECOVERED')).toBeTruthy();
      expect(screen.getByText('2/5')).toBeTruthy();
    });

    it('should render headshots when provided', () => {
      renderComponent({
        stats: {
          ...defaultStats,
          headshots: 15,
        },
      });

      expect(screen.getByText('HEADSHOTS')).toBeTruthy();
    });

    it('should render damage taken when provided', () => {
      renderComponent({
        stats: {
          ...defaultStats,
          damageTaken: 50,
        },
      });

      expect(screen.getByText('DAMAGE TAKEN')).toBeTruthy();
    });

    it('should render deaths when provided', () => {
      renderComponent({
        stats: {
          ...defaultStats,
          deaths: 2,
        },
      });

      expect(screen.getByText('DEATHS')).toBeTruthy();
    });

    it('should render survival stats section in breakdown', async () => {
      renderComponent({ stats: perfectStats });

      // Wait for breakdown to appear
      await vi.waitFor(
        () => {
          expect(screen.getByText('Survival Bonus')).toBeTruthy();
        },
        { timeout: 3500 }
      );
    });
  });

  describe('rating calculation', () => {
    it('should display a rating', () => {
      renderComponent();

      // Should have a rating value visible
      const ratingLabel = screen.getByText('PERFORMANCE RATING');
      expect(ratingLabel).toBeTruthy();
    });
  });

  describe('button interactions', () => {
    it('should call onContinue when continue button is clicked', () => {
      const onContinue = vi.fn();
      renderComponent({ onContinue });

      act(() => {
        screen.getByText('CONTINUE').click();
      });

      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('should show VIEW CREDITS for final level', () => {
      renderComponent({ isFinalLevel: true });

      expect(screen.getByText('VIEW CREDITS')).toBeTruthy();
      expect(screen.queryByText('CONTINUE')).toBeNull();
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      renderComponent({ onRetry });

      act(() => {
        screen.getByText('RETRY MISSION').click();
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should not render retry button when onRetry is not provided', () => {
      renderComponent({ onRetry: undefined });

      expect(screen.queryByText('RETRY MISSION')).toBeNull();
    });

    it('should call onMainMenu when main menu button is clicked', () => {
      const onMainMenu = vi.fn();
      renderComponent({ onMainMenu });

      act(() => {
        screen.getByText('MAIN MENU').click();
      });

      expect(onMainMenu).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have proper dialog role', () => {
      renderComponent();

      expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('should have aria-labelledby pointing to title', () => {
      renderComponent();

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-labelledby')).toBe('completion-title');
    });

    it('should focus continue button on mount', () => {
      renderComponent();

      const continueButton = screen.getByText('CONTINUE');
      expect(document.activeElement).toBe(continueButton);
    });
  });

  describe('time formatting', () => {
    it('should format single-digit minutes with leading zero', async () => {
      renderComponent({ stats: { ...defaultStats, timeElapsed: 65 } }); // 1:05

      // Wait for animation to complete or check for time display element
      await vi.waitFor(
        () => {
          expect(screen.getByText('01:05')).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should format double-digit minutes correctly', async () => {
      renderComponent({ stats: { ...defaultStats, timeElapsed: 725 } }); // 12:05

      await vi.waitFor(
        () => {
          expect(screen.getByText('12:05')).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should format zero seconds correctly', async () => {
      renderComponent({ stats: { ...defaultStats, timeElapsed: 120 } }); // 2:00

      await vi.waitFor(
        () => {
          expect(screen.getByText('02:00')).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });
  });
});
