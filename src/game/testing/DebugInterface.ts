/**
 * DebugInterface - Exposes game internals for Playwright E2E testing
 *
 * This module creates a window.__STELLAR_DESCENT_DEBUG__ object that allows
 * E2E tests to:
 * - Control the PlayerGovernor for automated gameplay
 * - Access CampaignDirector state and dispatch commands
 * - Access TutorialManager for tutorial level testing
 * - Toggle dev flags (god mode, noclip, etc.)
 * - Read vehicle and level state for assertions
 *
 * IMPORTANT: Only enabled in development builds via BUILD_FLAGS.DEV_MENU
 *
 * @module game/testing/DebugInterface
 */

import type { DifficultyLevel } from '../core/DifficultySettings';
import type { TutorialManager } from '../levels/anchor-station/TutorialManager';
import type { LevelId } from '../levels/types';
import {
  type GovernorEvent,
  type GovernorGoal,
  getPlayerGovernor,
} from '../systems/PlayerGovernor';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Vehicle state exposed for E2E testing.
 */
export interface VehicleDebugState {
  position: { x: number; y: number; z: number };
  rotation: number;
  speed: number;
  health: number;
  maxHealth: number;
  boostFuel: number;
  boostFuelMax: number;
  isBoosting: boolean;
  isGrounded: boolean;
  isDead: boolean;
  turretYaw: number;
  turretPitch: number;
  turretHeat: number;
  turretOverheated: boolean;
}

/**
 * Level state exposed for E2E testing.
 */
export interface LevelDebugState {
  id: LevelId;
  phase: string;
  phaseTime: number;
  kills: number;
  checkpointsReached: string[];
  wraithCount: number;
  bridgeCollapsed: boolean;
}

/**
 * Campaign command for controlling game flow.
 */
export interface CampaignCommand {
  type: 'NEW_GAME' | 'CONTINUE' | 'PAUSE' | 'RESUME' | 'RESTART' | 'QUIT';
  difficulty?: DifficultyLevel;
  startLevel?: LevelId;
}

/**
 * Campaign state snapshot.
 */
export interface CampaignState {
  phase: string;
  currentLevelId: LevelId | null;
  difficulty: DifficultyLevel;
}

/**
 * Dev flags for testing scenarios.
 */
export interface DevFlags {
  godMode: boolean;
  noclip: boolean;
  allLevelsUnlocked: boolean;
  showColliders: boolean;
  showEntityCount: boolean;
  showFPS: boolean;
}

/**
 * Input state from PlayerGovernor.
 */
export interface InputState {
  moveForward: boolean;
  moveBack: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  shoot: boolean;
  interact: boolean;
  advanceDialogue: boolean;
}

/**
 * Tutorial step info exposed for E2E testing.
 */
export interface TutorialStepInfo {
  id: string;
  title: string;
  phase: number;
  instructions: string;
}

/**
 * Tutorial manager interface for E2E testing.
 */
export interface TutorialDebugInterface {
  getCurrentStep: () => TutorialStepInfo | null;
  getCurrentPhase: () => number;
  getProgress: () => number;
  skip: () => void;
  isRunning: () => boolean;
}

/**
 * Player state for E2E testing.
 */
export interface PlayerDebugState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  maxHealth: number;
  isAlive: boolean;
}

/**
 * The full debug interface exposed on window.
 */
export interface StellarDescentDebug {
  playerGovernor: {
    setGoal: (goal: GovernorGoal) => void;
    clearGoals: () => void;
    queueGoal: (goal: GovernorGoal) => void;
    addEventListener: (listener: (event: GovernorEvent) => void) => void;
    removeEventListener: (listener: (event: GovernorEvent) => void) => void;
    getCurrentGoal: () => GovernorGoal;
    getInputState: () => InputState;
    runTutorialPlaythrough: () => void;
    navigateTo: (position: { x: number; y: number; z: number }, threshold?: number) => void;
    wait: (duration: number) => void;
  };
  campaignDirector: {
    dispatch: (command: CampaignCommand) => void;
    getPhase: () => string;
    getState: () => CampaignState;
  };
  tutorialManager: TutorialDebugInterface | null;
  player: PlayerDebugState;
  devFlags: DevFlags;
  vehicle: VehicleDebugState | null;
  level: LevelDebugState | null;

  // Setters for level/vehicle to be called by game code
  _setVehicleState: (state: VehicleDebugState | null) => void;
  _setLevelState: (state: LevelDebugState | null) => void;
  _setCampaignDirector: (director: CampaignDirectorInterface | null) => void;
  _setTutorialManager: (manager: TutorialManager | null) => void;
  _updatePlayerState: (state: Partial<PlayerDebugState>) => void;
}

/**
 * Interface for CampaignDirector methods we need.
 */
interface CampaignDirectorInterface {
  dispatch: (command: CampaignCommand) => void;
  getPhase: () => string;
  getCurrentLevelId: () => LevelId | null;
  getDifficulty: () => DifficultyLevel;
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

let vehicleState: VehicleDebugState | null = null;
let levelState: LevelDebugState | null = null;
let campaignDirector: CampaignDirectorInterface | null = null;
let tutorialManagerRef: TutorialManager | null = null;

const playerState: PlayerDebugState = {
  position: { x: 0, y: 1.5, z: 0 },
  rotation: { x: 0, y: 0 },
  health: 100,
  maxHealth: 100,
  isAlive: true,
};

const devFlags: DevFlags = {
  godMode: false,
  noclip: false,
  allLevelsUnlocked: false,
  showColliders: false,
  showEntityCount: false,
  showFPS: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a GovernorGoal from a string type and optional params.
 * Maps E2E test goal strings to proper GovernorGoal objects.
 */
function createGovernorGoal(
  type: string,
  params?: Record<string, unknown>
): GovernorGoal | null {
  // Import Vector3 for navigation goals
  const Vector3 = (() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const babylon = require('@babylonjs/core/Maths/math.vector');
      return babylon.Vector3;
    } catch {
      return null;
    }
  })();

  switch (type) {
    case 'idle':
      return { type: 'idle' };

    case 'navigate':
      if (params?.target && Vector3) {
        const target = params.target as { x: number; y: number; z: number };
        return {
          type: 'navigate',
          target: new Vector3(target.x, target.y, target.z),
          threshold: (params.threshold as number) ?? 2,
        };
      }
      return null;

    case 'follow_objective':
      return { type: 'follow_objective' };

    case 'engage_enemies':
      return {
        type: 'engage_enemies',
        aggressive: (params?.aggressive as boolean) ?? false,
      };

    case 'advance_dialogue':
      return { type: 'advance_dialogue' };

    case 'interact':
      return {
        type: 'interact',
        targetId: params?.targetId as string | undefined,
      };

    case 'complete_tutorial':
      return { type: 'complete_tutorial' };

    case 'wait':
      return {
        type: 'wait',
        duration: (params?.duration as number) ?? 1000,
      };

    case 'complete_level':
      // Map to follow_objective for level completion
      return { type: 'follow_objective' };

    default:
      console.warn(`[DebugInterface] Unknown goal type: ${type}`);
      return null;
  }
}

// ============================================================================
// DEBUG INTERFACE CREATION
// ============================================================================

/**
 * Create and expose the debug interface on window.
 * Should be called once at app initialization in dev mode.
 */
export function initializeDebugInterface(): void {
  if (typeof window === 'undefined') return;

  // Check if already initialized
  if ((window as any).__STELLAR_DESCENT_DEBUG__) {
    return;
  }

  const governor = getPlayerGovernor();

  const debugInterface: StellarDescentDebug = {
    playerGovernor: {
      setGoal: (goal: GovernorGoal) => governor.setGoal(goal),
      clearGoals: () => governor.clearGoals(),
      queueGoal: (goal: GovernorGoal) => governor.queueGoal(goal),
      addEventListener: (listener: (event: GovernorEvent) => void) =>
        governor.addEventListener(listener),
      removeEventListener: (listener: (event: GovernorEvent) => void) =>
        governor.removeEventListener(listener),
      getCurrentGoal: () => governor.getCurrentGoal(),
      getInputState: () => {
        const input = governor.getInputState();
        return {
          moveForward: input.moveForward,
          moveBack: input.moveBack,
          moveLeft: input.moveLeft,
          moveRight: input.moveRight,
          shoot: input.shoot,
          interact: input.interact,
          advanceDialogue: input.advanceDialogue,
        };
      },
      runTutorialPlaythrough: () => governor.runTutorialPlaythrough(),
      navigateTo: (position: { x: number; y: number; z: number }, threshold?: number) => {
        // Import Vector3 dynamically to avoid circular deps
        import('@babylonjs/core/Maths/math.vector').then(({ Vector3 }) => {
          governor.navigateTo(new Vector3(position.x, position.y, position.z), threshold);
        });
      },
      wait: (duration: number) => governor.wait(duration),
    },

    campaignDirector: {
      dispatch: (command: CampaignCommand) => {
        if (campaignDirector) {
          campaignDirector.dispatch(command);
        } else {
          console.warn('[DebugInterface] CampaignDirector not available');
        }
      },
      getPhase: () => campaignDirector?.getPhase() ?? 'unknown',
      getState: () => ({
        phase: campaignDirector?.getPhase() ?? 'unknown',
        currentLevelId: campaignDirector?.getCurrentLevelId() ?? null,
        difficulty: campaignDirector?.getDifficulty() ?? 'normal',
      }),
    },

    get tutorialManager(): TutorialDebugInterface | null {
      if (!tutorialManagerRef) return null;
      return {
        getCurrentStep: () => {
          const step = tutorialManagerRef!.getCurrentStep();
          if (!step) return null;
          return {
            id: step.id,
            title: step.title,
            phase: step.phase,
            instructions: step.instructions || '',
          };
        },
        getCurrentPhase: () => tutorialManagerRef!.getCurrentPhase(),
        getProgress: () => tutorialManagerRef!.getProgress(),
        skip: () => tutorialManagerRef!.skip(),
        isRunning: () => tutorialManagerRef!.isRunning(),
      };
    },

    get player(): PlayerDebugState {
      return { ...playerState };
    },

    devFlags,

    get vehicle() {
      return vehicleState;
    },

    get level() {
      return levelState;
    },

    _setVehicleState: (state: VehicleDebugState | null) => {
      vehicleState = state;
    },

    _setLevelState: (state: LevelDebugState | null) => {
      levelState = state;
    },

    _setCampaignDirector: (director: CampaignDirectorInterface | null) => {
      campaignDirector = director;
    },

    _setTutorialManager: (manager: TutorialManager | null) => {
      tutorialManagerRef = manager;
    },

    _updatePlayerState: (state: Partial<PlayerDebugState>) => {
      Object.assign(playerState, state);
    },
  };

  (window as any).__STELLAR_DESCENT_DEBUG__ = debugInterface;

  // Also expose on __STELLAR_DESCENT__ for compatibility with game-fixture.ts
  // This provides a unified interface that matches the test expectations
  const unifiedInterface = {
    campaign: {
      get phase() {
        return campaignDirector?.getPhase() ?? 'idle';
      },
      get currentLevelId() {
        return campaignDirector?.getCurrentLevelId() ?? 'anchor_station';
      },
      get difficulty() {
        return campaignDirector?.getDifficulty() ?? 'normal';
      },
      deathCount: 0,
      totalKills: 0,
      levelKills: 0,
    },
    player: playerState,
    level: {
      get id() {
        return levelState?.id ?? 'anchor_station';
      },
      get phase() {
        return levelState?.phase ?? 'idle';
      },
      get phaseTime() {
        return levelState?.phaseTime ?? 0;
      },
      get kills() {
        return levelState?.kills ?? 0;
      },
      get checkpointsReached() {
        return levelState?.checkpointsReached ?? [];
      },
      get wraithCount() {
        return levelState?.wraithCount ?? 0;
      },
      get bridgeCollapsed() {
        return levelState?.bridgeCollapsed ?? false;
      },
      timeElapsed: 0,
      secretsFound: 0,
      totalSecrets: 0,
      audioLogsFound: 0,
      totalAudioLogs: 0,
      damageVehicle: (amount: number) => {
        if (vehicleState) {
          vehicleState.health = Math.max(0, vehicleState.health - amount);
          if (vehicleState.health <= 0) {
            vehicleState.isDead = true;
          }
        }
      },
    },
    vehicle: {
      get position() {
        return vehicleState?.position ?? { x: 0, y: 0, z: 0 };
      },
      get speed() {
        return vehicleState?.speed ?? 0;
      },
      get health() {
        return vehicleState?.health ?? 120;
      },
      get maxHealth() {
        return vehicleState?.maxHealth ?? 120;
      },
      get boostFuel() {
        return vehicleState?.boostFuel ?? 100;
      },
      get isBoosting() {
        return vehicleState?.isBoosting ?? false;
      },
      get isGrounded() {
        return vehicleState?.isGrounded ?? true;
      },
      get isDead() {
        return vehicleState?.isDead ?? false;
      },
      get turretYaw() {
        return vehicleState?.turretYaw ?? 0;
      },
      get turretPitch() {
        return vehicleState?.turretPitch ?? 0;
      },
      get turretHeat() {
        return vehicleState?.turretHeat ?? 0;
      },
      get turretOverheated() {
        return vehicleState?.turretOverheated ?? false;
      },
    },
    governor: {
      // Track enabled state locally since governor doesn't have enable/disable
      _enabled: false,
      get enabled() {
        return this._enabled;
      },
      get currentGoal() {
        return governor.getCurrentGoal().type;
      },
      get goalQueue() {
        // Use getQueuedGoals which is the actual method name
        return governor.getQueuedGoals().map((g) => g.type);
      },
      eventsLog: [] as string[],
      enable: function () {
        this._enabled = true;
      },
      disable: function () {
        this._enabled = false;
        governor.clearGoals();
      },
      setGoal: (type: string, params?: Record<string, unknown>) => {
        // Map string type to proper GovernorGoal format
        const goal = createGovernorGoal(type, params);
        if (goal) {
          governor.setGoal(goal);
        }
      },
      queueGoal: (type: string, params?: Record<string, unknown>) => {
        const goal = createGovernorGoal(type, params);
        if (goal) {
          governor.queueGoal(goal);
        }
      },
      clearGoals: () => governor.clearGoals(),
      configure: (_config: Record<string, unknown>) => {
        // Governor config is set at construction, but we can log this for debugging
        console.log('[DebugInterface] Governor configure called with:', _config);
      },
      runTutorialPlaythrough: () => governor.runTutorialPlaythrough(),
    },
    devFlags,
    performance: {
      fps: 60,
      frameTime: 16.67,
      drawCalls: 0,
      triangles: 0,
    },
    achievements: {
      unlocked: [] as string[],
      progress: {} as Record<string, number>,
    },
  };

  (window as any).__STELLAR_DESCENT__ = unifiedInterface;

  console.log('[DebugInterface] Initialized for E2E testing');
}

/**
 * Update vehicle state for debug interface.
 * Call this from VehicleController or CanyonRunLevel each frame.
 */
export function updateDebugVehicleState(state: VehicleDebugState | null): void {
  vehicleState = state;
}

/**
 * Update level state for debug interface.
 * Call this from level implementations each frame.
 */
export function updateDebugLevelState(state: LevelDebugState | null): void {
  levelState = state;
}

/**
 * Register the CampaignDirector with the debug interface.
 * Call this after CampaignDirector is created.
 */
export function registerCampaignDirector(director: CampaignDirectorInterface): void {
  campaignDirector = director;
  if ((window as any).__STELLAR_DESCENT_DEBUG__) {
    (window as any).__STELLAR_DESCENT_DEBUG__._setCampaignDirector(director);
  }
}

/**
 * Get the dev flags for use in game code.
 */
export function getDevFlags(): DevFlags {
  return devFlags;
}

/**
 * Check if god mode is enabled.
 */
export function isGodModeEnabled(): boolean {
  return devFlags.godMode;
}

/**
 * Check if noclip is enabled.
 */
export function isNoclipEnabled(): boolean {
  return devFlags.noclip;
}

/**
 * Check if all levels are unlocked.
 */
export function areAllLevelsUnlocked(): boolean {
  return devFlags.allLevelsUnlocked;
}

/**
 * Register the TutorialManager with the debug interface.
 * Call this when AnchorStationLevel creates its TutorialManager.
 */
export function registerTutorialManager(manager: TutorialManager): void {
  tutorialManagerRef = manager;
  if ((window as any).__STELLAR_DESCENT_DEBUG__) {
    (window as any).__STELLAR_DESCENT_DEBUG__._setTutorialManager(manager);
  }
}

/**
 * Update player state for debug interface.
 * Call this from level implementations to keep player position/health current.
 */
export function updateDebugPlayerState(state: Partial<PlayerDebugState>): void {
  Object.assign(playerState, state);
}

// ============================================================================
// TYPE DECLARATIONS FOR WINDOW
// ============================================================================

declare global {
  interface Window {
    __STELLAR_DESCENT_DEBUG__?: StellarDescentDebug;
  }
}
