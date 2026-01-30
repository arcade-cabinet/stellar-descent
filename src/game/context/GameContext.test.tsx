import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, useGame } from './GameContext';

// Test component that uses the game context
function TestConsumer() {
  const game = useGame();
  return (
    <div>
      <span data-testid="health">{game.playerHealth}</span>
      <span data-testid="max-health">{game.maxHealth}</span>
      <span data-testid="kills">{game.kills}</span>
      <span data-testid="mission">{game.missionText}</span>
      <span data-testid="objective-title">{game.objectiveTitle}</span>
      <span data-testid="objective-instructions">{game.objectiveInstructions}</span>
      <span data-testid="is-calibrating">{game.isCalibrating.toString()}</span>
      <span data-testid="comms">{game.currentComms?.text || 'none'}</span>
      <span data-testid="notification">{game.notification?.text || 'none'}</span>
      <button onClick={() => game.setPlayerHealth(50)}>Set Health</button>
      <button onClick={() => game.addKill()}>Add Kill</button>
      <button onClick={() => game.setMissionText('New Mission')}>Set Mission</button>
      <button onClick={() => game.setObjective('Title', 'Instructions')}>Set Objective</button>
      <button onClick={() => game.setIsCalibrating(true)}>Start Calibrating</button>
      <button
        onClick={() =>
          game.showComms({ sender: 'Test', callsign: 'TST', portrait: 'ai', text: 'Hello' })
        }
      >
        Show Comms
      </button>
      <button onClick={() => game.hideComms()}>Hide Comms</button>
      <button onClick={() => game.showNotification('Test notification')}>Show Notification</button>
      <button onClick={() => game.onDamage()}>Trigger Damage</button>
    </div>
  );
}

describe('GameContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should provide default values', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      expect(screen.getByTestId('health').textContent).toBe('100');
      expect(screen.getByTestId('max-health').textContent).toBe('100');
      expect(screen.getByTestId('kills').textContent).toBe('0');
      expect(screen.getByTestId('is-calibrating').textContent).toBe('false');
      expect(screen.getByTestId('comms').textContent).toBe('none');
    });
  });

  describe('player health', () => {
    it('should update player health', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Health').click();
      });

      expect(screen.getByTestId('health').textContent).toBe('50');
    });
  });

  describe('kills', () => {
    it('should increment kills', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Add Kill').click();
      });

      expect(screen.getByTestId('kills').textContent).toBe('1');

      act(() => {
        screen.getByText('Add Kill').click();
        screen.getByText('Add Kill').click();
      });

      expect(screen.getByTestId('kills').textContent).toBe('3');
    });
  });

  describe('mission text', () => {
    it('should update mission text', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Mission').click();
      });

      expect(screen.getByTestId('mission').textContent).toBe('New Mission');
    });
  });

  describe('objectives', () => {
    it('should update objective title and instructions', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Objective').click();
      });

      expect(screen.getByTestId('objective-title').textContent).toBe('Title');
      expect(screen.getByTestId('objective-instructions').textContent).toBe('Instructions');
    });
  });

  describe('calibration state', () => {
    it('should update calibration state', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      expect(screen.getByTestId('is-calibrating').textContent).toBe('false');

      act(() => {
        screen.getByText('Start Calibrating').click();
      });

      expect(screen.getByTestId('is-calibrating').textContent).toBe('true');
    });
  });

  describe('comms', () => {
    it('should show comms message', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Show Comms').click();
      });

      expect(screen.getByTestId('comms').textContent).toBe('Hello');
    });

    it('should hide comms message', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Show Comms').click();
      });

      expect(screen.getByTestId('comms').textContent).toBe('Hello');

      act(() => {
        screen.getByText('Hide Comms').click();
      });

      expect(screen.getByTestId('comms').textContent).toBe('none');
    });
  });

  describe('notifications', () => {
    it('should show notification', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Show Notification').click();
      });

      expect(screen.getByTestId('notification').textContent).toBe('Test notification');
    });

    it('should auto-hide notification after duration', () => {
      render(
        <GameProvider>
          <TestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Show Notification').click();
      });

      expect(screen.getByTestId('notification').textContent).toBe('Test notification');

      // Default duration is 3000ms
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId('notification').textContent).toBe('none');
    });
  });

  describe('damage flash', () => {
    it('should trigger damage flash', () => {
      let damageFlash = false;

      function DamageTestConsumer() {
        const game = useGame();
        damageFlash = game.damageFlash;
        return <button onClick={() => game.onDamage()}>Trigger Damage</button>;
      }

      render(
        <GameProvider>
          <DamageTestConsumer />
        </GameProvider>
      );

      expect(damageFlash).toBe(false);

      act(() => {
        screen.getByText('Trigger Damage').click();
      });

      expect(damageFlash).toBe(true);

      // Damage flash should clear after 300ms
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(damageFlash).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw when useGame is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useGame must be used within a GameProvider');

      consoleSpy.mockRestore();
    });
  });
});
