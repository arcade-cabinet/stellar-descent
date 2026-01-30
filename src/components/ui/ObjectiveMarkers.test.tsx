import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectiveMarkers } from './ObjectiveMarkers';

// Mock the GameContext
vi.mock('../../game/context/GameContext', () => ({
  useGame: vi.fn(),
}));

import { useGame } from '../../game/context/GameContext';

const mockUseGame = vi.mocked(useGame);

describe('ObjectiveMarkers', () => {
  beforeEach(() => {
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
  });

  it('should not render when compass is hidden', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          label: 'Test',
          screenX: 1.5,
          screenY: 0,
          distance: 100,
          isInFront: true,
          isOnScreen: false,
        },
      ],
      hudVisibility: { compass: false },
    } as ReturnType<typeof useGame>);

    const { container } = render(<ObjectiveMarkers />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when compass is visible', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [],
      hudVisibility: { compass: true },
    } as unknown as ReturnType<typeof useGame>);

    const { container } = render(<ObjectiveMarkers />);
    expect(container.firstChild).not.toBeNull();
  });

  it('should not render markers for on-screen objectives', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          label: 'On Screen',
          screenX: 0,
          screenY: 0,
          distance: 50,
          isInFront: true,
          isOnScreen: true, // On screen - should not show edge marker
        },
      ],
      hudVisibility: { compass: true },
    } as ReturnType<typeof useGame>);

    render(<ObjectiveMarkers />);
    expect(screen.queryByText('On Screen')).toBeNull();
  });

  it('should render markers for off-screen objectives in front of camera', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          label: 'Off Screen',
          screenX: 1.5,
          screenY: 0.3,
          distance: 150,
          isInFront: true,
          isOnScreen: false,
        },
      ],
      hudVisibility: { compass: true },
    } as ReturnType<typeof useGame>);

    render(<ObjectiveMarkers />);
    const label = screen.getByText('Off Screen');
    expect(label).toBeTruthy();
  });

  it('should not render markers for objectives behind camera', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          label: 'Behind',
          screenX: -1.5,
          screenY: 0,
          distance: 100,
          isInFront: false, // Behind camera
          isOnScreen: false,
        },
      ],
      hudVisibility: { compass: true },
    } as ReturnType<typeof useGame>);

    render(<ObjectiveMarkers />);
    expect(screen.queryByText('Behind')).toBeNull();
  });

  it('should display distance for objectives', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          screenX: 1.5,
          screenY: 0,
          distance: 250,
          isInFront: true,
          isOnScreen: false,
        },
      ],
      hudVisibility: { compass: true },
    } as ReturnType<typeof useGame>);

    render(<ObjectiveMarkers />);
    const distance = screen.getByText('250m');
    expect(distance).toBeTruthy();
  });

  it('should display distance in km for far objectives', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          screenX: 1.5,
          screenY: 0,
          distance: 1500,
          isInFront: true,
          isOnScreen: false,
        },
      ],
      hudVisibility: { compass: true },
    } as ReturnType<typeof useGame>);

    render(<ObjectiveMarkers />);
    const distance = screen.getByText('1.5km');
    expect(distance).toBeTruthy();
  });

  it('should render multiple off-screen objectives', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          label: 'Primary',
          screenX: 1.5,
          screenY: 0,
          distance: 100,
          isInFront: true,
          isOnScreen: false,
        },
        {
          id: 'obj-2',
          type: 'optional',
          label: 'Secondary',
          screenX: -1.2,
          screenY: 0.5,
          distance: 200,
          isInFront: true,
          isOnScreen: false,
        },
      ],
      hudVisibility: { compass: true },
    } as ReturnType<typeof useGame>);

    render(<ObjectiveMarkers />);
    expect(screen.getByText('Primary')).toBeTruthy();
    expect(screen.getByText('Secondary')).toBeTruthy();
  });

  it('should have proper aria label for accessibility', () => {
    mockUseGame.mockReturnValue({
      screenSpaceObjectives: [
        {
          id: 'obj-1',
          type: 'main',
          label: 'Base Camp',
          screenX: 1.5,
          screenY: 0,
          distance: 150,
          isInFront: true,
          isOnScreen: false,
        },
      ],
      hudVisibility: { compass: true },
    } as ReturnType<typeof useGame>);

    render(<ObjectiveMarkers />);
    const marker = screen.getByLabelText('Base Camp objective, 150m');
    expect(marker).toBeTruthy();
  });
});
