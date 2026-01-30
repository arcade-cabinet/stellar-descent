import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import type { TouchInput } from '../../types';

// Base interface all levels implement
export interface GameLevel {
  initialize(): void;
  update(deltaTime: number): void;
  setTouchInput(input: TouchInput | null): void;
  getCamera(): Camera;
  dispose(): void;
}

// Level identifiers
export type LevelId =
  | 'anchor-station' // Tutorial - space station
  | 'surface-drop' // HALO drop to planet
  | 'fob-delta' // Marcus's location
  | 'the-breach' // Hive entrance
  | 'queens-chamber'; // Final boss
