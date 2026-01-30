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
import { ExtractionLevel } from './extraction/ExtractionLevel';
import { FOBDeltaLevel } from './fob-delta/FOBDeltaLevel';
import { LandfallLevel } from './landfall/LandfallLevel';
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
 */
export const canyonLevelFactory: LevelFactory = (
  _engine: Engine,
  _canvas: HTMLCanvasElement,
  _config: LevelConfig,
  _callbacks: LevelCallbacks
): ILevel => {
  throw new Error(
    'Canyon level type is not yet implemented. Awaiting CanyonLevel class.'
  );
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
  _engine: Engine,
  _canvas: HTMLCanvasElement,
  _config: LevelConfig,
  _callbacks: LevelCallbacks
): ILevel => {
  // TODO: Implement SouthernIceLevel class
  throw new Error(
    'Ice level type is not yet implemented. Awaiting SouthernIceLevel class.'
  );
};

/**
 * Factory for combined arms levels (Hive Assault)
 * Mixed vehicle and infantry gameplay pushing into the hive
 */
export const combinedArmsLevelFactory: LevelFactory = (
  _engine: Engine,
  _canvas: HTMLCanvasElement,
  _config: LevelConfig,
  _callbacks: LevelCallbacks
): ILevel => {
  // TODO: Implement HiveAssaultLevel class
  throw new Error(
    'Combined arms level type is not yet implemented. Awaiting HiveAssaultLevel class.'
  );
};

/**
 * Factory for finale levels (Final Escape)
 * Timed vehicle escape sequence - Warthog Run style
 */
export const finaleLevelFactory: LevelFactory = (
  _engine: Engine,
  _canvas: HTMLCanvasElement,
  _config: LevelConfig,
  _callbacks: LevelCallbacks
): ILevel => {
  // TODO: Implement FinalEscapeLevel class
  throw new Error(
    'Finale level type is not yet implemented. Awaiting FinalEscapeLevel class.'
  );
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
};

/**
 * Create a partial registry with only implemented level types
 * Use this during development when not all level types are ready
 */
export function createLevelFactories(
  overrides: Partial<LevelFactoryRegistry> = {}
): Partial<LevelFactoryRegistry> {
  return {
    station: stationLevelFactory,
    drop: dropLevelFactory,
    vehicle: vehicleLevelFactory,
    base: baseLevelFactory,
    brothers: brothersLevelFactory,
    hive: hiveLevelFactory,
    extraction: extractionLevelFactory,
    ...overrides,
  };
}
