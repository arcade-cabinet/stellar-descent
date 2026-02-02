/**
 * EnvironmentalAudio - Composable ambient audio system for levels
 *
 * Extracted from BaseLevel for composition over inheritance.
 * Manages ambient sounds, environmental audio, and spatial audio zones.
 *
 * NOTE: This module is a wrapper around AudioManager's environmental audio
 * features. Actual audio playback is delegated to AudioManager methods.
 *
 * Usage:
 *   const ambience = new EnvironmentalAudio();
 *   ambience.startEnvironment('anchor_station');
 *   ambience.addAudioZone('generator_room', position, 'machinery', 10);
 */

import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { getAudioManager } from '../../core/AudioManager';
import { getLogger } from '../../core/Logger';
import type { LevelId } from '../types';

const log = getLogger('EnvironmentalAudio');

export interface AudioZoneConfig {
  id: string;
  position: Vector3;
  radius: number;
  soundType: string;
  volume: number;
  isPlaying: boolean;
}

export class EnvironmentalAudio {
  private currentLevelId: LevelId | null = null;
  private audioZones: Map<string, AudioZoneConfig> = new Map();
  private masterVolume = 1.0;

  constructor() {
    // Audio system is accessed via singleton
  }

  /**
   * Start environmental audio for a level
   */
  startEnvironment(levelId: LevelId, intensity = 1.0): void {
    const audio = getAudioManager();
    this.currentLevelId = levelId;
    audio.startEnvironmentalAudio(levelId, intensity);
    log.debug(`Environmental audio started for: ${levelId}`);
  }

  /**
   * Stop environmental audio
   */
  stopEnvironment(fadeDuration = 1.0): void {
    if (this.currentLevelId) {
      getAudioManager().stopEnvironmentalAudio(fadeDuration);
      this.currentLevelId = null;
    }
  }

  /**
   * Add a spatial audio zone (delegates to AudioManager)
   */
  addAudioZone(id: string, position: Vector3, soundType: string, radius = 10, volume = 1.0): void {
    const config: AudioZoneConfig = {
      id,
      position: position.clone(),
      radius,
      soundType,
      volume,
      isPlaying: false,
    };
    this.audioZones.set(id, config);

    // Delegate to AudioManager's zone system
    // Note: soundType is mapped to 'type' which expects an EnvironmentType
    getAudioManager().addAudioZone({
      id,
      position: { x: position.x, y: position.y, z: position.z },
      radius,
      type: soundType as 'station' | 'surface' | 'hive' | 'base' | 'extraction',
      intensity: volume,
      isIndoor: true,
    });

    log.debug(`Audio zone added: ${id} (${soundType}) at radius ${radius}`);
  }

  /**
   * Remove an audio zone
   */
  removeAudioZone(id: string): void {
    this.audioZones.delete(id);
    getAudioManager().removeAudioZone(id);
    log.debug(`Audio zone removed: ${id}`);
  }

  /**
   * Update player position for spatial audio
   */
  updatePlayerPosition(position: Vector3): void {
    getAudioManager().updatePlayerPositionForAudio({
      x: position.x,
      y: position.y,
      z: position.z,
    });
  }

  /**
   * Play a one-shot sound effect at a position
   */
  playSound(effect: string, position?: Vector3, volume = 1.0): void {
    getAudioManager().play(effect as never, {
      volume: volume * this.masterVolume,
      position,
    });
  }

  /**
   * Set master volume for environmental audio
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    getAudioManager().setAmbientVolume(volume);
  }

  /**
   * Set combat state for adaptive audio
   */
  setCombatState(inCombat: boolean): void {
    getAudioManager().setEnvironmentalCombatState(inCombat);
  }

  /**
   * Pause all environmental audio
   */
  pause(): void {
    this.stopEnvironment(0);
  }

  /**
   * Resume environmental audio
   */
  resume(): void {
    if (this.currentLevelId) {
      this.startEnvironment(this.currentLevelId);
    }
  }

  /**
   * Reset for level restart
   */
  reset(): void {
    this.stopEnvironment(0);
    for (const id of this.audioZones.keys()) {
      getAudioManager().removeAudioZone(id);
    }
    this.audioZones.clear();
  }

  dispose(): void {
    this.reset();
  }
}
