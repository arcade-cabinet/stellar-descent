/**
 * useLevelManager - React hook for level system integration
 *
 * Provides:
 * - Level lifecycle management
 * - State persistence
 * - React state synchronization
 * - Level transition handling
 *
 * Events are now handled via EventBus subscriptions.
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getEventBus } from '../core/EventBus';
import { getLogger } from '../core/Logger';
import type { CommsMessage } from '../types';
import type { ActionButtonGroup } from '../types/actions';
import { LevelManager, type LevelManagerConfig } from './LevelManager';
import type { ILevel, LevelFactoryRegistry, LevelId } from './types';

const log = getLogger('useLevelManager');

export interface UseLevelManagerOptions {
  engine: Engine | null;
  canvas: HTMLCanvasElement | null;
  levelFactories: Partial<LevelFactoryRegistry>;
  // Event handlers - these subscribe to EventBus events
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
  onHitMarker?: (damage: number, isCritical: boolean, isKill?: boolean) => void;
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

  // Subscribe to EventBus events and forward to callbacks
  useEffect(() => {
    const eventBus = getEventBus();
    const unsubscribers: (() => void)[] = [];

    // Subscribe to COMMS_MESSAGE events
    if (onCommsMessage) {
      unsubscribers.push(
        eventBus.on('COMMS_MESSAGE', (event) => {
          onCommsMessage(event.message);
        })
      );
    }

    // Subscribe to OBJECTIVE_UPDATED events
    if (onObjectiveUpdate) {
      unsubscribers.push(
        eventBus.on('OBJECTIVE_UPDATED', (event) => {
          onObjectiveUpdate(event.title, event.instructions);
        })
      );
    }

    // Subscribe to CHAPTER_CHANGED events
    unsubscribers.push(
      eventBus.on('CHAPTER_CHANGED', (event) => {
        setState((prev) => ({ ...prev, chapter: event.chapter }));
        onChapterChange?.(event.chapter);
      })
    );

    // Subscribe to HEALTH_CHANGED events
    if (onHealthChange) {
      unsubscribers.push(
        eventBus.on('HEALTH_CHANGED', (event) => {
          onHealthChange(event.health);
        })
      );
    }

    // Subscribe to KILL_REGISTERED events
    if (onKill) {
      unsubscribers.push(
        eventBus.on('KILL_REGISTERED', () => {
          onKill();
        })
      );
    }

    // Subscribe to DAMAGE_REGISTERED events
    if (onDamage) {
      unsubscribers.push(
        eventBus.on('DAMAGE_REGISTERED', () => {
          onDamage();
        })
      );
    }

    // Subscribe to NOTIFICATION events
    if (onNotification) {
      unsubscribers.push(
        eventBus.on('NOTIFICATION', (event) => {
          onNotification(event.text, event.duration);
        })
      );
    }

    // Subscribe to LEVEL_COMPLETE events
    if (onLevelComplete) {
      unsubscribers.push(
        eventBus.on('LEVEL_COMPLETE', (event) => {
          onLevelComplete(event.nextLevelId);
        })
      );
    }

    // Subscribe to COMBAT_STATE_CHANGED events
    unsubscribers.push(
      eventBus.on('COMBAT_STATE_CHANGED', (event) => {
        setState((prev) => ({ ...prev, inCombat: event.inCombat }));
        onCombatStateChange?.(event.inCombat);
      })
    );

    // Subscribe to ACTION_GROUPS_CHANGED events
    if (onActionGroupsChange) {
      unsubscribers.push(
        eventBus.on('ACTION_GROUPS_CHANGED', (event) => {
          onActionGroupsChange(event.groups);
        })
      );
    }

    // Subscribe to ACTION_HANDLER_REGISTERED events
    if (onActionHandlerRegister) {
      unsubscribers.push(
        eventBus.on('ACTION_HANDLER_REGISTERED', (event) => {
          onActionHandlerRegister(event.handler);
        })
      );
    }

    // Subscribe to HIT_MARKER events
    if (onHitMarker) {
      unsubscribers.push(
        eventBus.on('HIT_MARKER', (event) => {
          onHitMarker(event.damage, event.isCritical, event.isKill);
        })
      );
    }

    // Subscribe to DIRECTIONAL_DAMAGE events
    if (onDirectionalDamage) {
      unsubscribers.push(
        eventBus.on('DIRECTIONAL_DAMAGE', (event) => {
          onDirectionalDamage(event.angle, event.damage);
        })
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
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
  ]);

  // Initialize manager when engine/canvas are ready
  useEffect(() => {
    if (!engine || !canvas) return;

    const config: LevelManagerConfig = {
      engine,
      canvas,
      levelFactories,
    };

    managerRef.current = new LevelManager(config);

    return () => {
      managerRef.current?.dispose();
      managerRef.current = null;
    };
  }, [engine, canvas, levelFactories]);

  // Actions
  const startLevel = useCallback(async (levelId: LevelId) => {
    if (!managerRef.current) {
      log.warn('LevelManager not initialized');
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
      log.error('Failed to start level:', error);
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
      log.error('Failed to transition to next level:', error);
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
      log.error('Failed to transition to level:', error);
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
