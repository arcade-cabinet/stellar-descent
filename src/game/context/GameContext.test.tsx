import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCombatStore } from '../stores/useCombatStore';
import { useMissionStore } from '../stores/useMissionStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import {
  DEFAULT_HUD_VISIBILITY,
  GameProvider,
  TUTORIAL_START_HUD_VISIBILITY,
  useGame,
} from './GameContext';

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
      <button type="button" onClick={() => game.setPlayerHealth(50)}>
        Set Health
      </button>
      <button type="button" onClick={() => game.addKill()}>
        Add Kill
      </button>
      <button type="button" onClick={() => game.setMissionText('New Mission')}>
        Set Mission
      </button>
      <button type="button" onClick={() => game.setObjective('Title', 'Instructions')}>
        Set Objective
      </button>
      <button type="button" onClick={() => game.setIsCalibrating(true)}>
        Start Calibrating
      </button>
      <button
        type="button"
        onClick={() =>
          game.showComms({ sender: 'Test', callsign: 'TST', portrait: 'ai', text: 'Hello' })
        }
      >
        Show Comms
      </button>
      <button type="button" onClick={() => game.hideComms()}>
        Hide Comms
      </button>
      <button type="button" onClick={() => game.showNotification('Test notification')}>
        Show Notification
      </button>
    </div>
  );
}

describe('GameContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset shared Zustand store state between tests
    useCombatStore.getState().reset();
    useMissionStore.getState().reset();
    usePlayerStore.getState().reset();
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

    it('should clamp health to 0 (prevent negative values)', () => {
      function HealthClampTestConsumer() {
        const game = useGame();
        return (
          <div>
            <span data-testid="health">{game.playerHealth}</span>
            <button type="button" onClick={() => game.setPlayerHealth(-100)}>
              Set Negative Health
            </button>
          </div>
        );
      }

      render(
        <GameProvider>
          <HealthClampTestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Negative Health').click();
      });

      // Health should be clamped to 0, not -100
      expect(screen.getByTestId('health').textContent).toBe('0');
    });

    it('should clamp health to maxHealth (prevent over-heal)', () => {
      function HealthClampTestConsumer() {
        const game = useGame();
        return (
          <div>
            <span data-testid="health">{game.playerHealth}</span>
            <button type="button" onClick={() => game.setPlayerHealth(200)}>
              Set Over Health
            </button>
          </div>
        );
      }

      render(
        <GameProvider>
          <HealthClampTestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Over Health').click();
      });

      // Health should be clamped to maxHealth (100)
      expect(screen.getByTestId('health').textContent).toBe('100');
    });

    it('should trigger death when health reaches 0', () => {
      const deathCallback = vi.fn();

      function DeathTestConsumer() {
        const game = useGame();
        game.setOnPlayerDeath(deathCallback);
        return (
          <div>
            <span data-testid="is-dead">{game.isPlayerDead.toString()}</span>
            <button type="button" onClick={() => game.setPlayerHealth(0)}>
              Set Zero Health
            </button>
          </div>
        );
      }

      render(
        <GameProvider>
          <DeathTestConsumer />
        </GameProvider>
      );

      expect(screen.getByTestId('is-dead').textContent).toBe('false');

      act(() => {
        screen.getByText('Set Zero Health').click();
      });

      expect(screen.getByTestId('is-dead').textContent).toBe('true');
      expect(deathCallback).toHaveBeenCalledTimes(1);
    });

    it('should prevent health changes after player death', () => {
      function DeathTestConsumer() {
        const game = useGame();
        return (
          <div>
            <span data-testid="health">{game.playerHealth}</span>
            <span data-testid="is-dead">{game.isPlayerDead.toString()}</span>
            <button type="button" onClick={() => game.setPlayerHealth(0)}>
              Kill Player
            </button>
            <button type="button" onClick={() => game.setPlayerHealth(50)}>
              Try Heal
            </button>
          </div>
        );
      }

      render(
        <GameProvider>
          <DeathTestConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Kill Player').click();
      });

      expect(screen.getByTestId('is-dead').textContent).toBe('true');
      expect(screen.getByTestId('health').textContent).toBe('0');

      // Try to heal the dead player
      act(() => {
        screen.getByText('Try Heal').click();
      });

      // Health should remain 0 - no changes allowed on dead player
      expect(screen.getByTestId('health').textContent).toBe('0');
    });

    it('should reset health and death state with resetPlayerHealth', () => {
      function ResetTestConsumer() {
        const game = useGame();
        return (
          <div>
            <span data-testid="health">{game.playerHealth}</span>
            <span data-testid="is-dead">{game.isPlayerDead.toString()}</span>
            <button type="button" onClick={() => game.setPlayerHealth(0)}>
              Kill Player
            </button>
            <button type="button" onClick={() => game.resetPlayerHealth()}>
              Reset
            </button>
          </div>
        );
      }

      render(
        <GameProvider>
          <ResetTestConsumer />
        </GameProvider>
      );

      // Kill player
      act(() => {
        screen.getByText('Kill Player').click();
      });

      expect(screen.getByTestId('is-dead').textContent).toBe('true');
      expect(screen.getByTestId('health').textContent).toBe('0');

      // Reset
      act(() => {
        screen.getByText('Reset').click();
      });

      expect(screen.getByTestId('is-dead').textContent).toBe('false');
      expect(screen.getByTestId('health').textContent).toBe('100');
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

  describe('store-based state', () => {
    it('should work without GameProvider since all state is in Zustand stores', () => {
      // After migration to Zustand, useGame() works outside GameProvider
      render(<TestConsumer />);
      expect(screen.getByTestId('health').textContent).toBe('100');
    });
  });

  describe('HUD visibility', () => {
    function HUDVisibilityConsumer() {
      const game = useGame();
      return (
        <div>
          <span data-testid="health-visible">{game.hudVisibility.healthBar.toString()}</span>
          <span data-testid="crosshair-visible">{game.hudVisibility.crosshair.toString()}</span>
          <span data-testid="kill-counter-visible">
            {game.hudVisibility.killCounter.toString()}
          </span>
          <span data-testid="mission-visible">{game.hudVisibility.missionText.toString()}</span>
          <span data-testid="action-buttons-visible">
            {game.hudVisibility.actionButtons.toString()}
          </span>
          <button type="button" onClick={() => game.setHUDVisibility({ healthBar: false })}>
            Hide Health
          </button>
          <button
            type="button"
            onClick={() => game.setHUDVisibility({ crosshair: true, killCounter: true })}
          >
            Show Combat UI
          </button>
          <button type="button" onClick={() => game.resetHUDVisibility()}>
            Reset HUD
          </button>
        </div>
      );
    }

    it('should have all HUD elements visible by default', () => {
      render(
        <GameProvider>
          <HUDVisibilityConsumer />
        </GameProvider>
      );

      expect(screen.getByTestId('health-visible').textContent).toBe('true');
      expect(screen.getByTestId('crosshair-visible').textContent).toBe('true');
      expect(screen.getByTestId('kill-counter-visible').textContent).toBe('true');
      expect(screen.getByTestId('mission-visible').textContent).toBe('true');
      expect(screen.getByTestId('action-buttons-visible').textContent).toBe('true');
    });

    it('should allow partial updates to HUD visibility', () => {
      render(
        <GameProvider>
          <HUDVisibilityConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Hide Health').click();
      });

      expect(screen.getByTestId('health-visible').textContent).toBe('false');
      // Other elements should remain visible
      expect(screen.getByTestId('crosshair-visible').textContent).toBe('true');
    });

    it('should update multiple visibility flags at once', () => {
      render(
        <GameProvider>
          <HUDVisibilityConsumer />
        </GameProvider>
      );

      // First hide health to verify it gets reset
      act(() => {
        screen.getByText('Hide Health').click();
      });

      expect(screen.getByTestId('health-visible').textContent).toBe('false');

      // Now show combat UI (crosshair and kill counter)
      act(() => {
        screen.getByText('Show Combat UI').click();
      });

      expect(screen.getByTestId('crosshair-visible').textContent).toBe('true');
      expect(screen.getByTestId('kill-counter-visible').textContent).toBe('true');
      // Health should still be hidden
      expect(screen.getByTestId('health-visible').textContent).toBe('false');
    });

    it('should reset HUD to default state', () => {
      render(
        <GameProvider>
          <HUDVisibilityConsumer />
        </GameProvider>
      );

      // Hide health
      act(() => {
        screen.getByText('Hide Health').click();
      });

      expect(screen.getByTestId('health-visible').textContent).toBe('false');

      // Reset HUD
      act(() => {
        screen.getByText('Reset HUD').click();
      });

      expect(screen.getByTestId('health-visible').textContent).toBe('true');
    });
  });

  describe('objective marker', () => {
    function ObjectiveMarkerConsumer() {
      const game = useGame();
      return (
        <div>
          <span data-testid="marker-type">{game.objectiveMarker?.type || 'none'}</span>
          <span data-testid="marker-visible">
            {game.objectiveMarker?.visible?.toString() || 'none'}
          </span>
          <span data-testid="marker-label">{game.objectiveMarker?.label || 'none'}</span>
          <button
            type="button"
            onClick={() =>
              game.setObjectiveMarker({ type: 'main', visible: true, label: 'Find the exit' })
            }
          >
            Set Main Marker
          </button>
          <button
            type="button"
            onClick={() => game.setObjectiveMarker({ type: 'interact', visible: true })}
          >
            Set Interact Marker
          </button>
          <button type="button" onClick={() => game.setObjectiveMarker(null)}>
            Clear Marker
          </button>
        </div>
      );
    }

    it('should have no objective marker by default', () => {
      render(
        <GameProvider>
          <ObjectiveMarkerConsumer />
        </GameProvider>
      );

      expect(screen.getByTestId('marker-type').textContent).toBe('none');
      expect(screen.getByTestId('marker-visible').textContent).toBe('none');
    });

    it('should set objective marker with label', () => {
      render(
        <GameProvider>
          <ObjectiveMarkerConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Main Marker').click();
      });

      expect(screen.getByTestId('marker-type').textContent).toBe('main');
      expect(screen.getByTestId('marker-visible').textContent).toBe('true');
      expect(screen.getByTestId('marker-label').textContent).toBe('Find the exit');
    });

    it('should set objective marker without label', () => {
      render(
        <GameProvider>
          <ObjectiveMarkerConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Interact Marker').click();
      });

      expect(screen.getByTestId('marker-type').textContent).toBe('interact');
      expect(screen.getByTestId('marker-visible').textContent).toBe('true');
      expect(screen.getByTestId('marker-label').textContent).toBe('none');
    });

    it('should clear objective marker', () => {
      render(
        <GameProvider>
          <ObjectiveMarkerConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Main Marker').click();
      });

      expect(screen.getByTestId('marker-type').textContent).toBe('main');

      act(() => {
        screen.getByText('Clear Marker').click();
      });

      expect(screen.getByTestId('marker-type').textContent).toBe('none');
    });
  });

  describe('HUD visibility presets', () => {
    it('DEFAULT_HUD_VISIBILITY should have all elements visible', () => {
      expect(DEFAULT_HUD_VISIBILITY).toEqual({
        healthBar: true,
        crosshair: true,
        killCounter: true,
        missionText: true,
        actionButtons: true,
        commsDisplay: true,
        notifications: true,
        compass: true,
      });
    });

    it('TUTORIAL_START_HUD_VISIBILITY should have minimal UI', () => {
      expect(TUTORIAL_START_HUD_VISIBILITY).toEqual({
        healthBar: false,
        crosshair: false,
        killCounter: false,
        missionText: false,
        actionButtons: false,
        commsDisplay: true, // Always available for narrative
        notifications: true, // Always available for feedback
        compass: false, // Unlocked later in tutorial
      });
    });
  });

  describe('screenSpaceObjectives', () => {
    function ScreenSpaceObjectivesConsumer() {
      const game = useGame();
      return (
        <div>
          <span data-testid="objectives-count">{game.screenSpaceObjectives.length}</span>
          <span data-testid="first-objective-id">
            {game.screenSpaceObjectives[0]?.id || 'none'}
          </span>
          <span data-testid="first-objective-distance">
            {game.screenSpaceObjectives[0]?.distance || 'none'}
          </span>
          <button
            type="button"
            onClick={() =>
              game.setScreenSpaceObjectives([
                {
                  id: 'obj-1',
                  type: 'main',
                  label: 'Primary Objective',
                  screenX: 0.5,
                  screenY: -0.5,
                  distance: 150,
                  isInFront: true,
                  isOnScreen: false,
                },
              ])
            }
          >
            Set Single Objective
          </button>
          <button
            type="button"
            onClick={() =>
              game.setScreenSpaceObjectives([
                {
                  id: 'obj-1',
                  type: 'main',
                  label: 'Primary',
                  screenX: 0.5,
                  screenY: 0.5,
                  distance: 100,
                  isInFront: true,
                  isOnScreen: true,
                },
                {
                  id: 'obj-2',
                  type: 'optional',
                  label: 'Side Quest',
                  screenX: -0.8,
                  screenY: 0.2,
                  distance: 250,
                  isInFront: true,
                  isOnScreen: false,
                },
              ])
            }
          >
            Set Multiple Objectives
          </button>
          <button type="button" onClick={() => game.setScreenSpaceObjectives([])}>
            Clear Objectives
          </button>
        </div>
      );
    }

    it('should start with empty screenSpaceObjectives', () => {
      render(
        <GameProvider>
          <ScreenSpaceObjectivesConsumer />
        </GameProvider>
      );

      expect(screen.getByTestId('objectives-count').textContent).toBe('0');
      expect(screen.getByTestId('first-objective-id').textContent).toBe('none');
    });

    it('should set single objective', () => {
      render(
        <GameProvider>
          <ScreenSpaceObjectivesConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Single Objective').click();
      });

      expect(screen.getByTestId('objectives-count').textContent).toBe('1');
      expect(screen.getByTestId('first-objective-id').textContent).toBe('obj-1');
      expect(screen.getByTestId('first-objective-distance').textContent).toBe('150');
    });

    it('should set multiple objectives', () => {
      render(
        <GameProvider>
          <ScreenSpaceObjectivesConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Multiple Objectives').click();
      });

      expect(screen.getByTestId('objectives-count').textContent).toBe('2');
    });

    it('should clear objectives', () => {
      render(
        <GameProvider>
          <ScreenSpaceObjectivesConsumer />
        </GameProvider>
      );

      act(() => {
        screen.getByText('Set Single Objective').click();
      });

      expect(screen.getByTestId('objectives-count').textContent).toBe('1');

      act(() => {
        screen.getByText('Clear Objectives').click();
      });

      expect(screen.getByTestId('objectives-count').textContent).toBe('0');
    });
  });
});
