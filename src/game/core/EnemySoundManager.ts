/**
 * EnemySoundManager - Handles spatial audio and rate-limiting for enemy sounds
 *
 * Provides per-species sound variations, 3D positioned audio with distance falloff,
 * and intelligent rate limiting to prevent audio overload with many enemies.
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AlienSpecies } from '../entities/aliens';
import { getAudioManager, type SoundEffect } from './AudioManager';
import type { Entity } from './ecs';

// Enemy sound types
export type EnemySoundType =
  | 'spawn'
  | 'alert'
  | 'footstep'
  | 'attack'
  | 'attack_windup'
  | 'hit'
  | 'death'
  | 'idle'
  | 'chase';

// Per-species sound configuration
interface SpeciesSoundConfig {
  // Pitch variation range (multiplier)
  pitchMin: number;
  pitchMax: number;
  // Volume multiplier
  volumeMultiplier: number;
  // Sound cooldowns in ms
  cooldowns: Partial<Record<EnemySoundType, number>>;
  // Idle sound chance (0-1) per check
  idleSoundChance: number;
  // Whether this species makes footstep sounds
  hasFootsteps: boolean;
  // Footstep interval in ms
  footstepInterval: number;
}

// Species-specific sound configurations
const SPECIES_SOUND_CONFIGS: Record<string, SpeciesSoundConfig> = {
  skitterer: {
    pitchMin: 1.2,
    pitchMax: 1.8, // High-pitched chittering
    volumeMultiplier: 0.6, // Quieter individually
    cooldowns: {
      spawn: 200,
      alert: 500,
      footstep: 100,
      attack: 300,
      death: 0,
      idle: 2000,
      chase: 800,
    },
    idleSoundChance: 0.3,
    hasFootsteps: true,
    footstepInterval: 120, // Fast skittering
  },
  lurker: {
    pitchMin: 0.6,
    pitchMax: 0.9, // Deep, menacing
    volumeMultiplier: 0.8,
    cooldowns: {
      spawn: 500,
      alert: 1000,
      footstep: 400,
      attack: 600,
      death: 0,
      idle: 4000,
      chase: 1500,
    },
    idleSoundChance: 0.15,
    hasFootsteps: true,
    footstepInterval: 350, // Slow stalking
  },
  spewer: {
    pitchMin: 0.7,
    pitchMax: 1.0, // Wet, gurgling
    volumeMultiplier: 0.9,
    cooldowns: {
      spawn: 400,
      alert: 800,
      footstep: 500,
      attack: 400,
      attack_windup: 600,
      death: 0,
      idle: 3000,
      chase: 1200,
    },
    idleSoundChance: 0.25,
    hasFootsteps: false, // Slithers instead
    footstepInterval: 500,
  },
  husk: {
    pitchMin: 0.8,
    pitchMax: 1.3, // Raspy, screeching
    volumeMultiplier: 1.0,
    cooldowns: {
      spawn: 300,
      alert: 600,
      footstep: 200,
      attack: 400,
      death: 0,
      idle: 2500,
      chase: 600,
    },
    idleSoundChance: 0.35,
    hasFootsteps: true,
    footstepInterval: 180, // Fast pursuit
  },
  broodmother: {
    pitchMin: 0.4,
    pitchMax: 0.6, // Massive, booming
    volumeMultiplier: 1.5, // Louder, boss presence
    cooldowns: {
      spawn: 1000,
      alert: 2000,
      footstep: 800,
      attack: 1000,
      attack_windup: 1500,
      death: 0,
      idle: 5000,
      chase: 2000,
    },
    idleSoundChance: 0.4,
    hasFootsteps: true,
    footstepInterval: 600, // Heavy, ground-shaking
  },
};

// Default config for unknown species
const DEFAULT_SOUND_CONFIG: SpeciesSoundConfig = {
  pitchMin: 0.9,
  pitchMax: 1.1,
  volumeMultiplier: 0.8,
  cooldowns: {
    spawn: 300,
    alert: 600,
    footstep: 250,
    attack: 400,
    death: 0,
    idle: 3000,
    chase: 1000,
  },
  idleSoundChance: 0.2,
  hasFootsteps: true,
  footstepInterval: 300,
};

// Track per-entity sound state
interface EntitySoundState {
  lastSoundTimes: Map<EnemySoundType, number>;
  lastFootstepTime: number;
  lastIdleCheck: number;
  previousAIState: string | null;
}

// Spatial audio configuration
const SPATIAL_CONFIG = {
  maxDistance: 60, // Beyond this, sounds are inaudible
  referenceDistance: 10, // Distance at which volume is 1.0
  rolloffFactor: 1.5, // How quickly volume decreases with distance
  minVolume: 0.05, // Minimum audible volume
};

// Global rate limiting to prevent audio overload
const GLOBAL_LIMITS = {
  maxSoundsPerFrame: 4, // Maximum sounds that can play per update
  maxConcurrentFootsteps: 3, // Max footstep sounds at once
  maxConcurrentAlerts: 2, // Max alert sounds at once
  footstepCooldown: 50, // Global footstep cooldown in ms
  alertCooldown: 200, // Global alert cooldown in ms
};

class EnemySoundManager {
  private entityStates: Map<string, EntitySoundState> = new Map();
  private playerPosition: Vector3 | null = null;

  // Global rate limiting state
  private soundsThisFrame = 0;
  private concurrentFootsteps = 0;
  private concurrentAlerts = 0;
  private lastGlobalFootstep = 0;
  private lastGlobalAlert = 0;

  // Frame tracking for rate limit reset
  private lastFrameTime = 0;

  /**
   * Update player position for spatial audio calculations
   */
  setPlayerPosition(position: Vector3): void {
    this.playerPosition = position;
  }

  /**
   * Register an entity for sound tracking
   */
  registerEntity(entity: Entity): void {
    if (!entity.id) return;

    this.entityStates.set(entity.id, {
      lastSoundTimes: new Map(),
      lastFootstepTime: 0,
      lastIdleCheck: 0,
      previousAIState: null,
    });
  }

  /**
   * Unregister an entity when it's removed
   */
  unregisterEntity(entity: Entity): void {
    if (!entity.id) return;
    this.entityStates.delete(entity.id);
  }

  /**
   * Calculate volume based on distance from player (spatial audio)
   */
  private calculateSpatialVolume(entityPosition: Vector3): number {
    if (!this.playerPosition) return 0;

    const distance = Vector3.Distance(entityPosition, this.playerPosition);

    if (distance > SPATIAL_CONFIG.maxDistance) {
      return 0;
    }

    // Simple linear falloff with reference distance
    const normalizedDistance = distance / SPATIAL_CONFIG.referenceDistance;
    const attenuation = 1 / (1 + SPATIAL_CONFIG.rolloffFactor * normalizedDistance);

    return Math.max(SPATIAL_CONFIG.minVolume, Math.min(1, attenuation));
  }

  /**
   * Calculate stereo pan based on direction to entity (-1 = left, 1 = right)
   * Note: This is a simplified implementation. For true 3D audio, we'd use Web Audio API's PannerNode
   */
  private calculatePan(_entityPosition: Vector3): number {
    // For now, return 0 (center) - full spatial implementation would need camera orientation
    return 0;
  }

  /**
   * Get sound configuration for a species
   */
  private getSpeciesConfig(speciesId: string): SpeciesSoundConfig {
    return SPECIES_SOUND_CONFIGS[speciesId] || DEFAULT_SOUND_CONFIG;
  }

  /**
   * Check if a sound can play (respecting cooldowns and rate limits)
   */
  private canPlaySound(
    entityId: string,
    soundType: EnemySoundType,
    speciesId: string,
    now: number
  ): boolean {
    // Check global frame limit
    if (this.soundsThisFrame >= GLOBAL_LIMITS.maxSoundsPerFrame) {
      return false;
    }

    // Get entity state
    const state = this.entityStates.get(entityId);
    if (!state) return false;

    // Get species config
    const config = this.getSpeciesConfig(speciesId);
    const cooldown = config.cooldowns[soundType] ?? 500;

    // Check entity-specific cooldown
    const lastTime = state.lastSoundTimes.get(soundType) ?? 0;
    if (now - lastTime < cooldown) {
      return false;
    }

    // Check global limits for specific sound types
    if (soundType === 'footstep') {
      if (this.concurrentFootsteps >= GLOBAL_LIMITS.maxConcurrentFootsteps) {
        return false;
      }
      if (now - this.lastGlobalFootstep < GLOBAL_LIMITS.footstepCooldown) {
        return false;
      }
    }

    if (soundType === 'alert' || soundType === 'chase') {
      if (this.concurrentAlerts >= GLOBAL_LIMITS.maxConcurrentAlerts) {
        return false;
      }
      if (now - this.lastGlobalAlert < GLOBAL_LIMITS.alertCooldown) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record that a sound was played
   */
  private recordSoundPlayed(entityId: string, soundType: EnemySoundType, now: number): void {
    const state = this.entityStates.get(entityId);
    if (!state) return;

    state.lastSoundTimes.set(soundType, now);
    this.soundsThisFrame++;

    // Update global tracking
    if (soundType === 'footstep') {
      this.concurrentFootsteps++;
      this.lastGlobalFootstep = now;
      // Reset footstep counter after a short delay
      setTimeout(() => {
        this.concurrentFootsteps = Math.max(0, this.concurrentFootsteps - 1);
      }, 150);
    }

    if (soundType === 'alert' || soundType === 'chase') {
      this.concurrentAlerts++;
      this.lastGlobalAlert = now;
      setTimeout(() => {
        this.concurrentAlerts = Math.max(0, this.concurrentAlerts - 1);
      }, 500);
    }
  }

  /**
   * Play a species-specific sound with spatial audio
   */
  playSound(
    entity: Entity,
    soundType: EnemySoundType,
    options?: { forcePlay?: boolean; volumeOverride?: number }
  ): void {
    if (!entity.id || !entity.transform || !entity.alienInfo) return;

    const now = performance.now();
    const speciesId = entity.alienInfo.speciesId;

    // Reset frame counter if this is a new frame
    if (now - this.lastFrameTime > 16) {
      // ~60fps
      this.soundsThisFrame = 0;
      this.lastFrameTime = now;
    }

    // Check if we can play this sound
    if (!options?.forcePlay && !this.canPlaySound(entity.id, soundType, speciesId, now)) {
      return;
    }

    // Calculate spatial audio
    const spatialVolume = this.calculateSpatialVolume(entity.transform.position);
    if (spatialVolume <= 0) return;

    // Get species config
    const config = this.getSpeciesConfig(speciesId);

    // Calculate final volume
    const baseVolume = options?.volumeOverride ?? 1;
    const finalVolume = baseVolume * spatialVolume * config.volumeMultiplier;

    // Map sound type to AudioManager sound effect and play
    const soundEffect = this.getSoundEffectForType(soundType, speciesId);
    if (soundEffect) {
      getAudioManager().play(soundEffect, { volume: finalVolume });
    }

    // Record the sound
    this.recordSoundPlayed(entity.id, soundType, now);
  }

  /**
   * Map enemy sound type to AudioManager SoundEffect
   * Uses species-specific sounds where available
   */
  private getSoundEffectForType(soundType: EnemySoundType, speciesId: string): SoundEffect | null {
    // Map based on sound type and species
    switch (soundType) {
      case 'spawn':
        // Different spawn sounds per species
        if (speciesId === 'broodmother') return 'alien_roar';
        if (speciesId === 'spewer') return 'organic_squish';
        return 'alien_spawn';

      case 'alert':
        // Alert when spotting player
        if (speciesId === 'broodmother') return 'alien_roar';
        if (speciesId === 'skitterer') return 'alien_chittering';
        if (speciesId === 'lurker') return 'alien_hiss';
        return 'alien_alert';

      case 'footstep':
        // Different footstep sounds per species
        if (speciesId === 'broodmother') return 'alien_heavy_step';
        if (speciesId === 'spewer') return 'organic_squish'; // Wet slithering
        if (speciesId === 'skitterer') return 'alien_chittering'; // Rapid skittering
        if (speciesId === 'lurker') return 'alien_footstep'; // Light steps
        return 'alien_footstep';

      case 'attack':
        // Attack sounds per species
        if (speciesId === 'spewer') return 'alien_acid_spit';
        if (speciesId === 'broodmother') return 'alien_roar';
        if (speciesId === 'skitterer') return 'alien_chittering';
        return 'alien_attack';

      case 'attack_windup':
        // Windup/telegraphing before attack
        if (speciesId === 'spewer') return 'alien_hiss';
        if (speciesId === 'broodmother') return 'alien_growl';
        return 'alien_hiss';

      case 'hit':
        // When enemy takes damage
        return 'organic_squish';

      case 'death':
        // Death sounds per species
        if (speciesId === 'broodmother') return 'alien_roar';
        return 'enemy_death';

      case 'idle':
        // Ambient idle sounds per species
        if (speciesId === 'skitterer') return 'alien_chittering';
        if (speciesId === 'spewer') return 'organic_squish';
        if (speciesId === 'lurker') return 'alien_hiss';
        if (speciesId === 'broodmother') return 'hive_pulse';
        return Math.random() < 0.5 ? 'alien_growl' : 'hive_pulse';

      case 'chase':
        // Chase/pursuit sounds
        if (speciesId === 'broodmother') return 'alien_roar';
        if (speciesId === 'skitterer') return 'alien_chittering';
        if (speciesId === 'husk') return 'alien_screech';
        return 'alien_alert';

      default:
        return null;
    }
  }

  /**
   * Handle AI state changes - triggers appropriate sounds
   */
  onAIStateChange(entity: Entity, previousState: string, newState: string): void {
    if (!entity.id || !entity.alienInfo) return;

    // Alert sound when first spotting player
    if (previousState === 'patrol' && (newState === 'chase' || newState === 'attack')) {
      this.playSound(entity, 'alert');
    }

    // Chase sound when entering chase from other states
    if (newState === 'chase' && previousState !== 'chase') {
      this.playSound(entity, 'chase', { volumeOverride: 0.7 });
    }
  }

  /**
   * Play spawn sound for a newly created entity
   */
  playSpawnSound(entity: Entity): void {
    this.playSound(entity, 'spawn', { forcePlay: true, volumeOverride: 0.8 });
  }

  /**
   * Play death sound for an entity
   */
  playDeathSound(entity: Entity): void {
    this.playSound(entity, 'death', { forcePlay: true, volumeOverride: 1.0 });
  }

  /**
   * Play attack sound for an entity
   */
  playAttackSound(entity: Entity): void {
    this.playSound(entity, 'attack');
  }

  /**
   * Play hit sound when entity takes damage
   */
  playHitSound(entity: Entity): void {
    this.playSound(entity, 'hit', { volumeOverride: 0.6 });
  }

  /**
   * Update footstep and idle sounds based on movement and state
   * Call this from the AI system update
   */
  updateMovementSounds(entity: Entity, isMoving: boolean): void {
    if (!entity.id || !entity.alienInfo || !entity.transform) return;

    const now = performance.now();
    const state = this.entityStates.get(entity.id);
    if (!state) {
      this.registerEntity(entity);
      return;
    }

    const config = this.getSpeciesConfig(entity.alienInfo.speciesId);

    // Footstep sounds while moving
    if (isMoving && config.hasFootsteps) {
      if (now - state.lastFootstepTime >= config.footstepInterval) {
        this.playSound(entity, 'footstep', { volumeOverride: 0.4 });
        state.lastFootstepTime = now;
      }
    }

    // Idle sounds occasionally when not moving
    if (!isMoving && entity.ai?.state === 'patrol') {
      if (now - state.lastIdleCheck >= 1000) {
        // Check once per second
        state.lastIdleCheck = now;
        if (Math.random() < config.idleSoundChance) {
          this.playSound(entity, 'idle', { volumeOverride: 0.3 });
        }
      }
    }

    // Track AI state changes
    const currentAIState = entity.ai?.state ?? 'patrol';
    if (state.previousAIState !== null && state.previousAIState !== currentAIState) {
      this.onAIStateChange(entity, state.previousAIState, currentAIState);
    }
    state.previousAIState = currentAIState;
  }

  /**
   * Clean up all tracking data
   */
  dispose(): void {
    this.entityStates.clear();
    this.playerPosition = null;
    this.soundsThisFrame = 0;
    this.concurrentFootsteps = 0;
    this.concurrentAlerts = 0;
  }
}

// Singleton instance
let enemySoundManagerInstance: EnemySoundManager | null = null;

export function getEnemySoundManager(): EnemySoundManager {
  if (!enemySoundManagerInstance) {
    enemySoundManagerInstance = new EnemySoundManager();
  }
  return enemySoundManagerInstance;
}

export function disposeEnemySoundManager(): void {
  if (enemySoundManagerInstance) {
    enemySoundManagerInstance.dispose();
    enemySoundManagerInstance = null;
  }
}
