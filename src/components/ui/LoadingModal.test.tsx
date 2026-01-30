import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingModal, type LoadingState } from './LoadingModal';

describe('LoadingModal', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<LoadingModal isOpen={false} onLoadComplete={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal when isOpen is true', () => {
    render(<LoadingModal isOpen={true} onLoadComplete={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('displays loading progress', () => {
    const loadingState: LoadingState = {
      stage: 'LOADING ASSETS...',
      progress: 50,
    };
    render(<LoadingModal isOpen={true} loadingState={loadingState} onLoadComplete={vi.fn()} />);
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('LOADING ASSETS...')).toBeTruthy();
  });

  it('displays level info when levelId is provided', () => {
    render(<LoadingModal isOpen={true} onLoadComplete={vi.fn()} levelId="anchor_station" />);
    expect(screen.getByText('CHAPTER 1')).toBeTruthy();
    // Use getAllByText since ANCHOR STATION appears in both header and schematic
    expect(screen.getAllByText(/ANCHOR STATION/).length).toBeGreaterThan(0);
  });

  it('has proper ARIA attributes for accessibility', () => {
    const loadingState: LoadingState = {
      stage: 'LOADING...',
      progress: 75,
    };
    render(<LoadingModal isOpen={true} loadingState={loadingState} onLoadComplete={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-busy')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Loading');

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar.getAttribute('aria-valuenow')).toBe('75');
    expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('calls onLoadComplete when progress reaches 100%', async () => {
    vi.useFakeTimers();
    const onLoadComplete = vi.fn();
    const loadingState: LoadingState = {
      stage: 'COMPLETE',
      progress: 100,
    };

    render(
      <LoadingModal isOpen={true} loadingState={loadingState} onLoadComplete={onLoadComplete} />
    );

    // Advance timers with act to handle all state updates
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(onLoadComplete).toHaveBeenCalledTimes(1);
  });

  it('displays tips section', () => {
    render(<LoadingModal isOpen={true} onLoadComplete={vi.fn()} />);
    expect(screen.getByText('COMBAT ADVISORY')).toBeTruthy();
  });

  it('displays system status indicators', () => {
    render(<LoadingModal isOpen={true} onLoadComplete={vi.fn()} />);
    expect(screen.getByText('COMMS')).toBeTruthy();
    expect(screen.getByText('NAV')).toBeTruthy();
    expect(screen.getByText('WEAP')).toBeTruthy();
    expect(screen.getByText('LIFE')).toBeTruthy();
  });

  it('displays secure connection footer', () => {
    render(<LoadingModal isOpen={true} onLoadComplete={vi.fn()} />);
    expect(screen.getByText('SECURE CONNECTION')).toBeTruthy();
    // TERRAN EXPANSION AUTHORITY appears multiple times (header and footer)
    expect(screen.getAllByText('TERRAN EXPANSION AUTHORITY').length).toBeGreaterThan(0);
  });

  it('displays stage icons based on loading stage', () => {
    const loadingState: LoadingState = {
      stage: 'INITIALIZING...',
      progress: 10,
    };
    render(<LoadingModal isOpen={true} loadingState={loadingState} onLoadComplete={vi.fn()} />);
    // The stage icon is part of the progress label
    expect(screen.getByText(/\[.*\] LOADING/)).toBeTruthy();
  });

  it('shows transfer status subtext', () => {
    const loadingState: LoadingState = {
      stage: 'LOADING...',
      progress: 50,
    };
    render(<LoadingModal isOpen={true} loadingState={loadingState} onLoadComplete={vi.fn()} />);
    expect(screen.getByText('TRANSFERRING DATA...')).toBeTruthy();
  });

  it('shows transfer complete when progress is 100%', () => {
    const loadingState: LoadingState = {
      stage: 'COMPLETE',
      progress: 100,
    };
    render(<LoadingModal isOpen={true} loadingState={loadingState} onLoadComplete={vi.fn()} />);
    expect(screen.getByText('TRANSFER COMPLETE')).toBeTruthy();
  });

  it('displays different level mission names based on levelId', () => {
    // Station level
    const { unmount } = render(
      <LoadingModal isOpen={true} onLoadComplete={vi.fn()} levelId="anchor_station" />
    );
    expect(screen.getByText('ANCHOR STATION PROMETHEUS')).toBeTruthy();
    unmount();

    // Hive level
    render(<LoadingModal isOpen={true} onLoadComplete={vi.fn()} levelId="the_breach" />);
    expect(screen.getByText('INTO THE BREACH')).toBeTruthy();
  });

  it('displays act name in header when level is provided', () => {
    render(<LoadingModal isOpen={true} onLoadComplete={vi.fn()} levelId="landfall" />);
    expect(screen.getByText('ACT 1: THE DROP')).toBeTruthy();
  });
});
