/**
 * useLevelManager - React hook for level system integration
 *
 * Provides:
 * - Level lifecycle management
 * - State persistence
 * - React state synchronization
 * - Level transition handling
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommsMessage } from '../types';
import type { ActionButtonGroup } from '../types/actions';
import { LevelManager, type LevelManagerConfig } from './LevelManager';
import type { ILevel, LevelCallbacks, LevelConfig, LevelFactoryRegistry, LevelId } from './types';

export interface UseLevelManagerOptions {
  engine: Engine | null;
  canvas: HTMLCanvasElement | null;
  levelFactories: Partial<LevelFactoryRegistry>;
  onCommsMessage?: (message: CommsMessage) => void;
  onObjectiveUpdate?: (title: string, instructions: string) => void;
  onChapterChange?: (chapter: number) => void;
  onHealthChange?: (health: number) => void;
  onKill?: () => void;
  onDamage?: () => void;
  onNotification?: (text: string, duration?: number) => void;
  onLevelComplete?: (nextLevelId: LevelId | null) => void;
  onCombatStateChange?: (inCombat: boolean) => void;
  // Action button system
  onActionGroupsChange?: (groups: ActionButtonGroup[]) => void;
  onActionHandlerRegister?: (handler: ((actionId: string) => void) | null) => void;
  // Combat feedback system
  onHitMarker?: (damage: number, isCritical: boolean) => void;
  onDirectionalDamage?: (angle: number, damage: number) => void;
}

export interface LevelManagerState {
  currentLevelId: LevelId | null;
  currentLevel: ILevel | null;
  chapter: number;
  isLoading: boolean;
  isTransitioning: boolean;
  inCombat: boolean;
}

export interface LevelManagerActions {
  startLevel: (levelId: LevelId) => Promise<void>;
  transitionToNext: () => Promise<void>;
  transitionTo: (levelId: LevelId) => Promise<void>;
  getCurrentLevel: () => ILevel | null;
  dispose: () => void;
}

export function useLevelManager(
  options: UseLevelManagerOptions
): [LevelManagerState, LevelManagerActions] {
  const {
    engine,
    canvas,
    levelFactories,
    onCommsMessage,
    onObjectiveUpdate,
    onChapterChange,
    onHealthChange,
    onKill,
    onDamage,
    onNotification,
    onLevelComplete,
    onCombatStateChange,
    onActionGroupsChange,
    onActionHandlerRegister,
    onHitMarker,
    onDirectionalDamage,
  } = options;

  // State
  const [state, setState] = useState<LevelManagerState>({
    currentLevelId: null,
    currentLevel: null,
    chapter: 1,
    isLoading: false,
    isTransitioning: false,
    inCombat: false,
  });

  // Manager ref
  const managerRef = useRef<LevelManager | null>(null);

  // Create callbacks that update React state and forward to props
  const callbacks: LevelCallbacks = {
    onCommsMessage: (message) => {
      onCommsMessage?.(message);
    },
    onObjectiveUpdate: (title, instructions) => {
      onObjectiveUpdate?.(title, instructions);
    },
    onChapterChange: (chapter) => {
      setState((prev) => ({ ...prev, chapter }));
      onChapterChange?.(chapter);
    },
    onHealthChange: (health) => {
      onHealthChange?.(health);
    },
    onKill: () => {
      onKill?.();
    },
    onDamage: () => {
      onDamage?.();
    },
    onNotification: (text, duration) => {
      onNotification?.(text, duration);
    },
    onLevelComplete: (nextLevelId) => {
      onLevelComplete?.(nextLevelId);
    },
    onCombatStateChange: (inCombat) => {
      setState((prev) => ({ ...prev, inCombat }));
      onCombatStateChange?.(inCombat);
    },
    onActionGroupsChange: (groups) => {
      onActionGroupsChange?.(groups);
    },
    onActionHandlerRegister: (handler) => {
      onActionHandlerRegister?.(handler);
    },
    onHitMarker: (damage, isCritical) => {
      onHitMarker?.(damage, isCritical);
    },
    onDirectionalDamage: (angle, damage) => {
      onDirectionalDamage?.(angle, damage);
    },
  };

  // Initialize manager when engine/canvas are ready
  useEffect(() => {
    if (!engine || !canvas) return;

    const config: LevelManagerConfig = {
      engine,
      canvas,
      callbacks,
      levelFactories,
    };

    managerRef.current = new LevelManager(config);

    return () => {
      managerRef.current?.dispose();
      managerRef.current = null;
    };
  }, [engine, canvas]); // Note: callbacks and factories are stable

  // Actions
  const startLevel = useCallback(async (levelId: LevelId) => {
    if (!managerRef.current) {
      console.warn('LevelManager not initialized');
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, isTransitioning: true }));

    try {
      await managerRef.current.startLevel(levelId);
      const currentLevel = managerRef.current.getCurrentLevel();
      setState((prev) => ({
        ...prev,
        currentLevelId: levelId,
        currentLevel,
        isLoading: false,
        isTransitioning: false,
      }));
    } catch (error) {
      console.error('Failed to start level:', error);
      setState((prev) => ({ ...prev, isLoading: false, isTransitioning: false }));
    }
  }, []);

  const transitionToNext = useCallback(async () => {
    if (!managerRef.current) return;

    setState((prev) => ({ ...prev, isTransitioning: true }));

    try {
      await managerRef.current.transitionToNext();
      const currentLevel = managerRef.current.getCurrentLevel();
      setState((prev) => ({
        ...prev,
        currentLevelId: currentLevel?.id ?? null,
        currentLevel,
        isTransitioning: false,
      }));
    } catch (error) {
      console.error('Failed to transition to next level:', error);
      setState((prev) => ({ ...prev, isTransitioning: false }));
    }
  }, []);

  const transitionTo = useCallback(async (levelId: LevelId) => {
    if (!managerRef.current) return;

    setState((prev) => ({ ...prev, isTransitioning: true }));

    try {
      await managerRef.current.transitionTo(levelId);
      const currentLevel = managerRef.current.getCurrentLevel();
      setState((prev) => ({
        ...prev,
        currentLevelId: levelId,
        currentLevel,
        isTransitioning: false,
      }));
    } catch (error) {
      console.error('Failed to transition to level:', error);
      setState((prev) => ({ ...prev, isTransitioning: false }));
    }
  }, []);

  const getCurrentLevel = useCallback(() => {
    return managerRef.current?.getCurrentLevel() ?? null;
  }, []);

  const dispose = useCallback(() => {
    managerRef.current?.dispose();
    setState({
      currentLevelId: null,
      currentLevel: null,
      chapter: 1,
      isLoading: false,
      isTransitioning: false,
      inCombat: false,
    });
  }, []);

  const actions: LevelManagerActions = {
    startLevel,
    transitionToNext,
    transitionTo,
    getCurrentLevel,
    dispose,
  };

  return [state, actions];
}
