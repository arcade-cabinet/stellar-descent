/**
 * Level Factories - Create levels by type
 *
 * This module provides factory functions for each level type.
 * The LevelManager uses these to instantiate levels based on their type.
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { AnchorStationLevel } from './anchor-station/AnchorStationLevel';
import { BrothersInArmsLevel } from './brothers-in-arms/BrothersInArmsLevel';
import { CanyonRunLevel } from './canyon-run/CanyonRunLevel';
import { ExtractionLevel } from './extraction';
import { FinalEscapeLevel } from './final-escape/FinalEscapeLevel';
import { FOBDeltaLevel } from './fob-delta/FOBDeltaLevel';
import { HiveAssaultLevel } from './hive-assault/HiveAssaultLevel';
import { LandfallLevel } from './landfall';
import { MiningDepthsLevel } from './mining-depths/MiningDepthsLevel';
import { SouthernIceLevel } from './southern-ice/SouthernIceLevel';
import { TheBreachLevel } from './the-breach/TheBreachLevel';
import type {
  ILevel,
  LevelCallbacks,
  LevelConfig,
  LevelFactory,
  LevelFactoryRegistry,
} from './types';

/**
 * Factory for station (interior) levels
 */
export const stationLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new AnchorStationLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for drop (HALO descent) levels
 */
export const dropLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new LandfallLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for canyon (exterior surface) levels
 * Used for canyon terrain combat scenarios
 * Currently unused - canyon levels use 'vehicle' type via CanyonRunLevel
 */
export const canyonLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  // Generic canyon infantry level - uses CanyonRunLevel as fallback
  return new CanyonRunLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for mine (underground mining) levels
 * Used for Mining Depths bonus level
 */
export const mineLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new MiningDepthsLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for base (abandoned FOB) levels
 */
export const baseLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new FOBDeltaLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for brothers (mech ally combat) levels
 */
export const brothersLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new BrothersInArmsLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for hive (underground + Queen boss) levels
 * Underground alien tunnels with Chitin Queen boss fight
 */
export const hiveLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new TheBreachLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for extraction zone levels
 * Escape the collapsing hive and hold out at LZ Omega
 */
export const extractionLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new ExtractionLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for vehicle chase levels (Canyon Run)
 * High-speed vehicle pursuit through canyon terrain
 */
export const vehicleLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new CanyonRunLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for ice/frozen wasteland levels (Southern Ice)
 * Frozen terrain with new enemy types and environmental hazards
 */
export const iceLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new SouthernIceLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for combined arms levels (Hive Assault)
 * Mixed vehicle and infantry gameplay pushing into the hive
 */
export const combinedArmsLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new HiveAssaultLevel(engine, canvas, config, callbacks);
};

/**
 * Factory for finale levels (Final Escape)
 * Timed vehicle escape sequence - Warthog Run style
 */
export const finaleLevelFactory: LevelFactory = (
  engine: Engine,
  canvas: HTMLCanvasElement,
  config: LevelConfig,
  callbacks: LevelCallbacks
): ILevel => {
  return new FinalEscapeLevel(engine, canvas, config, callbacks);
};

/**
 * Default factory registry with all level types
 */
export const defaultLevelFactories: LevelFactoryRegistry = {
  station: stationLevelFactory,
  drop: dropLevelFactory,
  canyon: canyonLevelFactory,
  base: baseLevelFactory,
  brothers: brothersLevelFactory,
  hive: hiveLevelFactory,
  extraction: extractionLevelFactory,
  vehicle: vehicleLevelFactory,
  ice: iceLevelFactory,
  combined_arms: combinedArmsLevelFactory,
  finale: finaleLevelFactory,
  mine: mineLevelFactory,
};

/**
 * Create a partial registry with only implemented level types
 * Use this during development when not all level types are ready
 */
export function createLevelFactories(
  overrides: Partial<LevelFactoryRegistry> = {}
): LevelFactoryRegistry {
  return {
    ...defaultLevelFactories,
    ...overrides,
  };
}
