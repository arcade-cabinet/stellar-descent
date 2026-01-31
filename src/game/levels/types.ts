/**
 * Level System Types
 *
 * This module defines the type system for levels. Campaign data (CAMPAIGN_LEVELS)
 * is imported from LevelRegistry.ts - the single source of truth for level configurations.
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import type { CommsMessage } from '../types';
import type { ActionButtonGroup } from '../types/actions';

// ============================================================================
// CORE TYPES FROM LEVEL REGISTRY
// ============================================================================

// Import core types that other interfaces depend on
import type {
  LevelType as RegistryLevelType,
  LevelId as RegistryLevelId,
  WeatherConfig as RegistryWeatherConfig,
  MissionObjective as RegistryMissionObjective,
  LevelEntry,
  BonusLevelEntry,
  MissionDefinition as RegistryMissionDefinition,
} from './LevelRegistry';

// Re-export core types
export type LevelType = RegistryLevelType;
export type LevelId = RegistryLevelId;
export type MissionObjective = RegistryMissionObjective;
export type { LevelEntry, BonusLevelEntry };
export type MissionDefinition = RegistryMissionDefinition;

// ============================================================================
// RE-EXPORTS FROM LEVEL REGISTRY
// ============================================================================

export {
  // Campaign data
  LEVEL_REGISTRY,
  LEVEL_REGISTRY as CAMPAIGN_LEVELS,
  BONUS_LEVELS,

  // Accessor functions
  getLevel,
  getLevelIds,
  getFirstLevel,
  getNextLevel,
  getPreviousLevel,
  getLevelCount,
  getLevelCount as getTotalLevels,
  getLevelIndex,
  iterateLevels,
  getTotalAudioLogCount,
  getTotalSecretCount,
  getTotalSkullCount,

  // Backward compatibility
  getMissionDefinition,
  MISSION_DEFINITIONS,
} from './LevelRegistry';

// ============================================================================
// LOCAL TYPES
// ============================================================================

// Weather configuration for levels
export interface WeatherConfig {
  environment: 'surface' | 'station' | 'hive' | 'underground' | 'ice';
  initialWeather: string;
  initialIntensity: 'low' | 'medium' | 'high' | 'extreme';
  qualityLevel?: 'low' | 'medium' | 'high';
}

// Level configuration (for backward compatibility)
export interface LevelConfig {
  id: LevelId;
  type: LevelType;
  nextLevelId: LevelId | null;
  previousLevelId: LevelId | null;
  chapter: number;
  actName: string;
  missionName: string;
  missionSubtitle?: string;
  playerSpawnPosition?: { x: number; y: number; z: number };
  playerSpawnRotation?: number;
  ambientTrack?: string;
  combatTrack?: string;
  hasCinematicIntro?: boolean;
  weather?: WeatherConfig;
  totalSecrets?: number;
  totalAudioLogs?: number;
}

// Callbacks from level to game system
export interface LevelCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onObjectiveUpdate: (title: string, instructions: string) => void;
  onChapterChange: (chapter: number) => void;
  onHealthChange: (health: number) => void;
  onKill: () => void;
  onDamage: () => void;
  onNotification: (text: string, duration?: number) => void;
  onLevelComplete: (nextLevelId: LevelId | null) => void;
  onCombatStateChange: (inCombat: boolean) => void;
  onCinematicStart?: () => void;
  onCinematicEnd?: () => void;
  onActionGroupsChange: (groups: ActionButtonGroup[]) => void;
  onActionHandlerRegister: (handler: ((actionId: string) => void) | null) => void;
  onHitMarker?: (damage: number, isCritical: boolean, isKill?: boolean) => void;
  onDirectionalDamage?: (angle: number, damage: number) => void;
  onAudioLogFound?: (logId: string) => void;
  onSecretFound?: (secretId: string) => void;
  onSkullFound?: (skullId: string) => void;
  onDialogueTrigger?: (trigger: string) => void;
  onObjectiveMarker?: (position: { x: number; y: number; z: number } | null, label?: string) => void;
  onExposureChange?: (exposure: number) => void;
  onFrostDamage?: (damage: number) => void;
  onSquadCommandWheelChange?: (isOpen: boolean, selectedCommand: string | null) => void;
}

// State that can be persisted for a level
export interface LevelState {
  id: LevelId;
  visited: boolean;
  completed: boolean;
  playerPosition?: { x: number; y: number; z: number };
  playerRotation?: number;
  stats?: LevelStats;
  flags?: Record<string, boolean>;
  checkpoint?: {
    position: { x: number; y: number; z: number };
    rotation: number;
    phase?: string;
  };
}

// Comprehensive stats tracking for level completion screen
export interface LevelStats {
  kills: number;
  totalShots?: number;
  shotsHit?: number;
  accuracy?: number;
  headshots?: number;
  meleKills?: number;
  grenadeKills?: number;
  timeSpent: number;
  parTime?: number;
  secretsFound: number;
  totalSecrets?: number;
  audioLogsFound?: number;
  totalAudioLogs?: number;
  skullsFound?: number;
  deaths: number;
  damageDealt?: number;
  damageTaken?: number;
  objectivesCompleted?: number;
  totalObjectives?: number;
  bonusObjectivesCompleted?: number;
}

// Victory condition result
export interface VictoryResult {
  success: boolean;
  nextLevelId: LevelId | null;
  stats: LevelStats;
  bonuses?: {
    noDeaths?: boolean;
    speedrun?: boolean;
    allSecrets?: boolean;
    perfectAccuracy?: boolean;
  };
}

// Touch input type for levels
export interface TouchInputState {
  movement: { x: number; y: number };
  look: { x: number; y: number };
  isFiring?: boolean;
  isSprinting?: boolean;
  isJumping?: boolean;
  isCrouching?: boolean;
}

// The unified Level interface
export interface ILevel {
  readonly id: LevelId;
  readonly type: LevelType;
  readonly config: LevelConfig;

  initialize(): Promise<void>;
  update(deltaTime: number): void;
  dispose(): void;

  getScene(): Scene;

  getState(): LevelState;
  setState(state: Partial<LevelState>): void;

  lockPointer(): void;
  unlockPointer(): void;
  isPointerLocked(): boolean;

  setTouchInput(input: TouchInputState | null): void;

  canTransitionTo(levelId: LevelId): boolean;
  prepareTransition(targetLevelId: LevelId): Promise<void>;
}

// Factory function signature
export type LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
) => ILevel;

// Registry of level factories by type
export interface LevelFactoryRegistry {
  station: LevelFactory;
  drop: LevelFactory;
  canyon: LevelFactory;
  base: LevelFactory;
  brothers: LevelFactory;
  hive: LevelFactory;
  extraction: LevelFactory;
  vehicle: LevelFactory;
  ice: LevelFactory;
  combined_arms: LevelFactory;
  finale: LevelFactory;
  mine: LevelFactory;
  boss: LevelFactory;
  assault: LevelFactory;
  escape: LevelFactory;
}
