/**
 * AudioManager - Centralized Audio Coordination
 *
 * This is the main audio manager that composes all audio subsystems.
 * The heavy lifting is done by modular subsystems in ./audio/
 */

import type { Sound } from '@babylonjs/core/Audio/sound';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { WeaponId } from '../entities/weapons';
import type { LevelId } from '../levels/types';
import { getLogger } from './Logger';

const log = getLogger('AudioManager');
import {
  type AudioZone,
  disposeEnvironmentalAudioManager,
  getEnvironmentalAudioManager,
  type SpatialSoundSource,
} from './EnvironmentalAudioManager';
import { disposeProceduralMusicEngine, getProceduralMusicEngine } from './ProceduralMusicEngine';
import { type EnvironmentType, type ImpactSurface, weaponSoundManager } from './WeaponSoundManager';

// Import modular audio components
import {
  type SoundEffect,
  type MusicTrack,
  type LevelAudioConfig,
  type AudioLoopHandle,
  LEVEL_AUDIO_CONFIGS,
  DEFAULT_VOLUMES,
  COMBAT_EXIT_DELAY_MS,
} from './audio';
import { SoundDispatcher, ProceduralAmbientGenerator } from './audio/SoundDispatcher';
import { MusicPlayer } from './audio/music';

// Re-export types for external use
export type { SoundEffect, MusicTrack, LevelAudioConfig } from './audio';

/**
 * Main Audio Manager class - Coordinates all audio subsystems
 */
export class AudioManager {
  private scene: Scene | null = null;
  private sounds: Map<string, Sound> = new Map();
  private soundDispatcher: SoundDispatcher;
  private musicPlayer: MusicPlayer;
  private ambientGenerator: ProceduralAmbientGenerator;
  private activeLoops: Map<string, AudioLoopHandle> = new Map();

  private masterVolume: number = DEFAULT_VOLUMES.master;
  private sfxVolume: number = DEFAULT_VOLUMES.sfx;
  private musicVolume: number = DEFAULT_VOLUMES.music;
  private voiceVolume: number = DEFAULT_VOLUMES.voice;
  private ambientVolume: number = DEFAULT_VOLUMES.ambient;

  private isMuted = false;
  private currentMusic: Sound | null = null;
  private currentLevelId: LevelId | null = null;
  private currentLevelConfig: LevelAudioConfig | null = null;
  private isInCombat = false;
  private combatTransitionTimeout: ReturnType<typeof setTimeout> | null = null;
  private useProceduralMusic = true;

  constructor() {
    this.soundDispatcher = new SoundDispatcher();
    this.musicPlayer = new MusicPlayer();
    this.ambientGenerator = new ProceduralAmbientGenerator();
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
  }

  initialize(scene: Scene): void {
    this.scene = scene;
  }

  // ===== Music Controls =====

  async playMusic(track: MusicTrack, crossfadeDuration = 2): Promise<void> {
    if (!this.isMuted) await this.musicPlayer.play(track, crossfadeDuration);
  }

  stopMusic(fadeDuration = 1): void {
    this.musicPlayer.stop(fadeDuration);
  }

  getCurrentMusicTrack(): MusicTrack | null {
    return this.musicPlayer.getCurrentTrack();
  }

  setMusicMuffled(muffled: boolean): void {
    muffled ? this.musicPlayer.setFilterCutoff(800) : this.musicPlayer.resetFilter();
  }

  // ===== Sound Effect Playback =====

  play(effect: SoundEffect, options?: { volume?: number; position?: Vector3 }): void {
    if (this.isMuted) return;
    this.soundDispatcher.play(
      effect,
      (options?.volume ?? 1) * this.sfxVolume * this.masterVolume
    );
  }

  // ===== Loop Controls =====

  startLoop(effect: 'drop_wind' | 'drop_thrust', volume = 1): void {
    if (this.isMuted || this.activeLoops.has(effect)) return;
    const vol = volume * this.sfxVolume * this.masterVolume;
    const loop =
      effect === 'drop_wind'
        ? this.soundDispatcher.generateDropWind(5, vol)
        : this.soundDispatcher.generateThrustSound(vol);
    this.activeLoops.set(effect, loop);
  }

  stopLoop(effect: string): void {
    this.activeLoops.get(effect)?.stop();
    this.activeLoops.delete(effect);
  }

  stopAllLoops(): void {
    this.activeLoops.forEach((loop) => loop.stop());
    this.activeLoops.clear();
  }

  startDropshipEngine(volume = 0.35): void {
    if (this.isMuted || this.activeLoops.has('dropship_engine')) return;
    this.activeLoops.set(
      'dropship_engine',
      this.soundDispatcher.generateDropshipEngine(volume * this.sfxVolume * this.masterVolume)
    );
  }

  stopDropshipEngine(): void {
    this.stopLoop('dropship_engine');
  }

  // ===== Volume Controls =====

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
  }

  setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));
    this.updateAmbientVolume();
  }

  getAmbientVolume(): number {
    return this.ambientVolume;
  }

  setVoiceVolume(volume: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, volume));
  }

  getVoiceVolume(): number {
    return this.voiceVolume;
  }

  // ===== Mute Controls =====

  mute(): void {
    this.isMuted = true;
    this.stopAllLoops();
    this.musicPlayer.setVolume(0);
    this.ambientGenerator.setVolume(0);
    weaponSoundManager.mute();
  }

  unmute(): void {
    this.isMuted = false;
    this.musicPlayer.setVolume(this.musicVolume * this.masterVolume);
    weaponSoundManager.unmute();
    this.updateAmbientVolume();
  }

  toggleMute(): boolean {
    this.isMuted ? this.unmute() : this.mute();
    return this.isMuted;
  }

  private updateAmbientVolume(): void {
    if (this.currentLevelConfig?.proceduralAmbient) {
      const intensity = this.isInCombat ? 0.3 : 1;
      this.ambientGenerator.setVolume(
        this.currentLevelConfig.proceduralAmbient.intensity *
          intensity *
          this.ambientVolume *
          this.masterVolume
      );
    }
  }

  // ===== Level Audio Management =====

  async startLevelAudio(levelId: LevelId): Promise<void> {
    const config = LEVEL_AUDIO_CONFIGS[levelId];
    if (!config) {
      log.warn(`No audio config for level: ${levelId}`);
      return;
    }

    this.currentLevelId = levelId;
    this.currentLevelConfig = config;
    this.isInCombat = false;
    weaponSoundManager.setEnvironmentFromLevel(levelId);

    if (!this.isMuted) {
      if (this.useProceduralMusic && config.proceduralMusic?.enabled) {
        const procMusic = getProceduralMusicEngine();
        procMusic.setVolume(config.proceduralMusic.volume * this.musicVolume * this.masterVolume);
        await procMusic.start(config.proceduralMusic.environment, 'ambient');
        this.musicPlayer.setVolume(0);
      } else {
        await this.musicPlayer.play(config.ambientTrack, 2);
        this.musicPlayer.setVolume(config.ambientVolume * this.musicVolume * this.masterVolume);
      }
      if (config.proceduralAmbient) {
        this.ambientGenerator.start(
          config.proceduralAmbient.type,
          config.proceduralAmbient.intensity * this.ambientVolume * this.masterVolume
        );
      }
    }
  }

  stopLevelAudio(fadeDuration = 1): void {
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }
    this.isInCombat = false;
    this.musicPlayer.stop(fadeDuration);
    getProceduralMusicEngine().stop(fadeDuration);
    this.ambientGenerator.stop();
    this.currentLevelId = null;
    this.currentLevelConfig = null;
  }

  async transitionToLevel(newLevelId: LevelId, crossfadeDuration = 2): Promise<void> {
    const newConfig = LEVEL_AUDIO_CONFIGS[newLevelId];
    if (!newConfig) {
      log.warn(`No audio config for level: ${newLevelId}`);
      return;
    }

    this.ambientGenerator.stop();
    this.currentLevelId = newLevelId;
    this.currentLevelConfig = newConfig;
    this.isInCombat = false;

    if (!this.isMuted) {
      await this.musicPlayer.play(newConfig.ambientTrack, crossfadeDuration);
      this.musicPlayer.setVolume(newConfig.ambientVolume * this.musicVolume * this.masterVolume);
      if (newConfig.proceduralAmbient) {
        setTimeout(() => {
          if (this.currentLevelId === newLevelId && !this.isMuted) {
            this.ambientGenerator.start(
              newConfig.proceduralAmbient!.type,
              newConfig.proceduralAmbient!.intensity * this.ambientVolume * this.masterVolume
            );
          }
        }, crossfadeDuration * 500);
      }
    }
  }

  // ===== Combat State =====

  async enterCombat(): Promise<void> {
    if (this.isInCombat || !this.currentLevelConfig) return;
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }
    this.isInCombat = true;
    if (!this.isMuted) {
      this.updateAmbientVolume();
      await this.musicPlayer.play(this.currentLevelConfig.combatTrack, 1);
      this.musicPlayer.setVolume(
        this.currentLevelConfig.combatVolume * this.musicVolume * this.masterVolume
      );
    }
  }

  exitCombat(delayMs = COMBAT_EXIT_DELAY_MS): void {
    if (!this.isInCombat || !this.currentLevelConfig) return;
    if (this.combatTransitionTimeout) clearTimeout(this.combatTransitionTimeout);
    this.combatTransitionTimeout = setTimeout(async () => {
      this.isInCombat = false;
      this.combatTransitionTimeout = null;
      if (!this.isMuted && this.currentLevelConfig) {
        this.updateAmbientVolume();
        await this.musicPlayer.play(this.currentLevelConfig.ambientTrack, 2);
        this.musicPlayer.setVolume(
          this.currentLevelConfig.ambientVolume * this.musicVolume * this.masterVolume
        );
      }
    }, delayMs);
  }

  isInCombatMode(): boolean {
    return this.isInCombat;
  }

  getCurrentLevelId(): LevelId | null {
    return this.currentLevelId;
  }

  // ===== Victory/Defeat =====

  async playVictory(): Promise<void> {
    this.clearCombatState();
    this.ambientGenerator.stop();
    if (!this.isMuted) {
      await this.musicPlayer.play('victory', 1.5);
      this.musicPlayer.setVolume(0.7 * this.musicVolume * this.masterVolume);
    }
  }

  async playDefeat(): Promise<void> {
    this.clearCombatState();
    this.ambientGenerator.stop();
    if (!this.isMuted) {
      await this.musicPlayer.play('defeat', 1);
      this.musicPlayer.setVolume(0.6 * this.musicVolume * this.masterVolume);
    }
  }

  private clearCombatState(): void {
    this.isInCombat = false;
    if (this.combatTransitionTimeout) {
      clearTimeout(this.combatTransitionTimeout);
      this.combatTransitionTimeout = null;
    }
  }

  // ===== Weapon Sound Effects =====

  playWeaponFire(weaponId: WeaponId, volume = 0.5, distance = 0): void {
    if (!this.isMuted)
      weaponSoundManager.playWeaponFire(
        weaponId,
        volume * this.sfxVolume * this.masterVolume,
        distance
      );
  }

  playWeaponReload(weaponId: WeaponId, volume = 0.4): void {
    if (!this.isMuted)
      weaponSoundManager.playWeaponReload(weaponId, volume * this.sfxVolume * this.masterVolume);
  }

  playReloadStart(weaponId: WeaponId, volume = 0.3): void {
    if (!this.isMuted)
      weaponSoundManager.playReloadStart(weaponId, volume * this.sfxVolume * this.masterVolume);
  }

  playReloadComplete(weaponId: WeaponId, volume = 0.4): void {
    if (!this.isMuted)
      weaponSoundManager.playReloadComplete(weaponId, volume * this.sfxVolume * this.masterVolume);
  }

  playEmptyClick(weaponId: WeaponId, volume = 0.3): void {
    if (!this.isMuted)
      weaponSoundManager.playEmptyClick(weaponId, volume * this.sfxVolume * this.masterVolume);
  }

  playWeaponSwitch(volume = 0.35): void {
    if (!this.isMuted)
      weaponSoundManager.playWeaponSwitch(volume * this.sfxVolume * this.masterVolume);
  }

  playWeaponEquip(weaponId: WeaponId, volume = 0.4): void {
    if (!this.isMuted)
      weaponSoundManager.playWeaponEquip(weaponId, volume * this.sfxVolume * this.masterVolume);
  }

  playImpact(surface: ImpactSurface = 'default', volume = 0.3, distance = 0): void {
    if (!this.isMuted)
      weaponSoundManager.playImpact(surface, volume * this.sfxVolume * this.masterVolume, distance);
  }

  playHitMarker(volume = 0.25): void {
    if (!this.isMuted)
      weaponSoundManager.playHitMarker(volume * this.sfxVolume * this.masterVolume);
  }

  playHeadshot(volume = 0.35): void {
    if (!this.isMuted)
      weaponSoundManager.playHeadshot(volume * this.sfxVolume * this.masterVolume);
  }

  playKillConfirmation(volume = 0.4): void {
    if (!this.isMuted)
      weaponSoundManager.playKillConfirmation(volume * this.sfxVolume * this.masterVolume);
  }

  playDamageDealt(damage: number, volume = 0.2): void {
    if (!this.isMuted)
      weaponSoundManager.playDamageDealt(damage, volume * this.sfxVolume * this.masterVolume);
  }

  setWeaponSoundEnvironment(environment: EnvironmentType): void {
    weaponSoundManager.setEnvironment(environment);
  }

  setWeaponSoundEnvironmentFromLevel(levelId: LevelId): void {
    weaponSoundManager.setEnvironmentFromLevel(levelId);
  }

  // ===== Environmental Audio =====

  startEnvironmentalAudio(levelId: LevelId, intensity = 1.0): void {
    if (this.isMuted) return;
    const envAudio = getEnvironmentalAudioManager();
    envAudio.setMasterVolume(this.ambientVolume * this.masterVolume);
    envAudio.startEnvironment(levelId, intensity);
  }

  stopEnvironmentalAudio(fadeDuration = 1.0): void {
    getEnvironmentalAudioManager().stopEnvironment(fadeDuration);
  }

  updatePlayerPositionForAudio(position: { x: number; y: number; z: number }): void {
    getEnvironmentalAudioManager().updatePlayerPosition(position);
  }

  addAudioZone(zone: AudioZone): void {
    getEnvironmentalAudioManager().addZone(zone);
  }

  removeAudioZone(id: string): void {
    getEnvironmentalAudioManager().removeZone(id);
  }

  addSpatialSoundSource(source: SpatialSoundSource): void {
    getEnvironmentalAudioManager().addSpatialSource(source);
  }

  removeSpatialSoundSource(id: string): void {
    getEnvironmentalAudioManager().removeSpatialSource(id);
  }

  playEmergencyKlaxon(duration = 3): void {
    if (!this.isMuted) getEnvironmentalAudioManager().playEmergencyKlaxon(duration);
  }

  setEnvironmentalCombatState(inCombat: boolean): void {
    getEnvironmentalAudioManager().setCombatState(inCombat);
  }

  setAudioOcclusionCallback(
    callback:
      | ((
          sourcePos: { x: number; y: number; z: number },
          listenerPos: { x: number; y: number; z: number }
        ) => number)
      | null
  ): void {
    getEnvironmentalAudioManager().setOcclusionCallback(callback);
  }

  setAudioOcclusionEnabled(enabled: boolean): void {
    getEnvironmentalAudioManager().setOcclusionEnabled(enabled);
  }

  // ===== Cleanup =====

  dispose(): void {
    this.clearCombatState();
    this.stopAllLoops();
    this.sounds.forEach((sound) => sound.dispose());
    this.sounds.clear();
    this.currentMusic?.dispose();
    this.currentMusic = null;
    this.soundDispatcher.dispose();
    this.musicPlayer.dispose();
    this.ambientGenerator.dispose();
    weaponSoundManager.dispose();
    disposeEnvironmentalAudioManager();
    this.currentLevelId = null;
    this.currentLevelConfig = null;
    this.isInCombat = false;
  }
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) audioManagerInstance = new AudioManager();
  return audioManagerInstance;
}

export function disposeAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.dispose();
    audioManagerInstance = null;
  }
}

// Re-export boss music manager for direct access
export { type BossPhase, disposeBossMusicManager, getBossMusicManager } from './BossMusicManager';

// Re-export environmental audio types for external use
export type {
  AudioZone,
  EnvironmentType as EnvironmentalAudioType,
  OcclusionConfig,
  SpatialSoundSource,
  SpatialSoundType,
} from './EnvironmentalAudioManager';
