/**
 * Sound Effect Dispatcher
 * Maps sound effect names to their generators for cleaner AudioManager code
 *
 * Supports 3D spatial audio with:
 * - Positioned sounds using Web Audio API panner nodes
 * - Distance-based attenuation
 * - Environment-based reverb
 */

import type { SoundEffect, AudioLoopHandle } from './types';
import { UISoundGenerator } from './sounds/ui';
import { WeaponSoundGenerator } from './sounds/weapons';
import { EnemySoundGenerator } from './sounds/enemies';
import { EnvironmentSoundGenerator, ProceduralAmbientGenerator } from './sounds/environment';
import { weaponSoundManager } from '../WeaponSoundManager';
import { hitAudioManager } from '../HitAudioManager';

/**
 * 3D Position for spatial audio
 */
export interface AudioPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Environment type for reverb configuration
 */
export type SpatialEnvironment = 'indoor' | 'outdoor' | 'cave' | 'hive' | 'default';

/**
 * Reverb configuration per environment
 */
interface ReverbConfig {
  decay: number;
  wetMix: number;
  damping: number;
}

const ENVIRONMENT_REVERB: Record<SpatialEnvironment, ReverbConfig> = {
  indoor: { decay: 1.0, wetMix: 0.3, damping: 0.4 },
  outdoor: { decay: 0.4, wetMix: 0.1, damping: 0.8 },
  cave: { decay: 2.5, wetMix: 0.5, damping: 0.3 },
  hive: { decay: 1.8, wetMix: 0.45, damping: 0.5 },
  default: { decay: 0.8, wetMix: 0.2, damping: 0.5 },
};

/**
 * Unified Procedural Audio - Combines all sound generators with dispatch
 */
export class SoundDispatcher {
  private ui = new UISoundGenerator();
  private weapons = new WeaponSoundGenerator();
  private enemies = new EnemySoundGenerator();
  private environment = new EnvironmentSoundGenerator();

  // Spatial audio components
  private audioContext: AudioContext | null = null;
  private listenerPosition: AudioPosition = { x: 0, y: 0, z: 0 };
  private listenerOrientation: { forward: AudioPosition; up: AudioPosition } = {
    forward: { x: 0, y: 0, z: -1 },
    up: { x: 0, y: 1, z: 0 },
  };
  private currentEnvironment: SpatialEnvironment = 'default';
  private reverbNode: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupSpatialAudio();
    }
    return this.audioContext;
  }

  /**
   * Set up the spatial audio graph
   */
  private setupSpatialAudio(): void {
    const ctx = this.audioContext!;

    // Master output
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(ctx.destination);

    // Dry path (direct sound)
    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 1 - ENVIRONMENT_REVERB[this.currentEnvironment].wetMix;
    this.dryGain.connect(this.masterGain);

    // Wet path (reverb)
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = ENVIRONMENT_REVERB[this.currentEnvironment].wetMix;
    this.wetGain.connect(this.masterGain);

    // Create reverb
    this.createReverbNode();

    // Set up listener
    this.updateListenerPosition(this.listenerPosition);
  }

  /**
   * Create convolver node for reverb effect
   */
  private createReverbNode(): void {
    const ctx = this.getContext();
    const config = ENVIRONMENT_REVERB[this.currentEnvironment];

    // Generate synthetic impulse response
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * config.decay);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with damping
        const decay = Math.exp(-3 * (i / length));
        const damping = Math.exp(-config.damping * 3 * (i / length));
        channelData[i] = (Math.random() * 2 - 1) * decay * damping;
      }
    }

    if (this.reverbNode) {
      this.reverbNode.disconnect();
    }

    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = impulse;
    this.reverbNode.connect(this.wetGain!);
  }

  /**
   * Update listener position for 3D audio
   */
  updateListenerPosition(position: AudioPosition): void {
    this.listenerPosition = position;

    const ctx = this.getContext();
    const listener = ctx.listener;

    if (listener.positionX) {
      // Modern API
      listener.positionX.setValueAtTime(position.x, ctx.currentTime);
      listener.positionY.setValueAtTime(position.y, ctx.currentTime);
      listener.positionZ.setValueAtTime(position.z, ctx.currentTime);
    } else {
      // Legacy API
      listener.setPosition(position.x, position.y, position.z);
    }
  }

  /**
   * Update listener orientation for 3D audio
   */
  updateListenerOrientation(forward: AudioPosition, up: AudioPosition): void {
    this.listenerOrientation = { forward, up };

    const ctx = this.getContext();
    const listener = ctx.listener;

    if (listener.forwardX) {
      // Modern API
      listener.forwardX.setValueAtTime(forward.x, ctx.currentTime);
      listener.forwardY.setValueAtTime(forward.y, ctx.currentTime);
      listener.forwardZ.setValueAtTime(forward.z, ctx.currentTime);
      listener.upX.setValueAtTime(up.x, ctx.currentTime);
      listener.upY.setValueAtTime(up.y, ctx.currentTime);
      listener.upZ.setValueAtTime(up.z, ctx.currentTime);
    } else {
      // Legacy API
      listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /**
   * Set the current environment for reverb
   */
  setEnvironment(environment: SpatialEnvironment): void {
    if (environment === this.currentEnvironment) return;

    this.currentEnvironment = environment;
    const config = ENVIRONMENT_REVERB[environment];

    // Update wet/dry mix
    if (this.dryGain && this.wetGain) {
      this.dryGain.gain.value = 1 - config.wetMix;
      this.wetGain.gain.value = config.wetMix;
    }

    // Recreate reverb with new settings
    this.createReverbNode();
  }

  /**
   * Calculate distance-based attenuation
   */
  private calculateAttenuation(
    sourcePosition: AudioPosition,
    maxDistance: number = 50,
    rolloffFactor: number = 1
  ): number {
    const dx = sourcePosition.x - this.listenerPosition.x;
    const dy = sourcePosition.y - this.listenerPosition.y;
    const dz = sourcePosition.z - this.listenerPosition.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Inverse distance attenuation with rolloff
    if (distance <= 1) return 1;
    if (distance >= maxDistance) return 0;

    return Math.pow(1 / Math.max(1, distance), rolloffFactor);
  }

  /**
   * Create a panner node for 3D positioned sound
   */
  private createPanner(position: AudioPosition): PannerNode {
    const ctx = this.getContext();
    const panner = ctx.createPanner();

    // Configure panner
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 50;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1;

    // Set position
    if (panner.positionX) {
      panner.positionX.setValueAtTime(position.x, ctx.currentTime);
      panner.positionY.setValueAtTime(position.y, ctx.currentTime);
      panner.positionZ.setValueAtTime(position.z, ctx.currentTime);
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }

    return panner;
  }

  /**
   * Play a 3D positioned sound
   */
  play3D(
    effect: SoundEffect,
    position: AudioPosition,
    options?: { volume?: number; maxDistance?: number }
  ): void {
    const volume = options?.volume ?? 1;
    const maxDistance = options?.maxDistance ?? 50;

    // Calculate distance attenuation
    const attenuation = this.calculateAttenuation(position, maxDistance);
    if (attenuation < 0.01) return; // Too far to hear

    const finalVolume = volume * attenuation;

    // Play the sound with the attenuated volume
    // Note: For full 3D positioning, the individual sound generators would need
    // to be modified to accept panner nodes. For now, we use volume-based attenuation.
    this.play(effect, finalVolume);
  }

  /**
   * Play a positioned enemy sound with full spatial audio
   */
  playEnemySoundPositioned(
    soundType: 'death' | 'attack' | 'footstep' | 'alert' | 'spawn',
    enemyType: string,
    position: AudioPosition,
    volume: number = 0.4
  ): void {
    const attenuation = this.calculateAttenuation(position, 40);
    if (attenuation < 0.01) return;

    const finalVolume = volume * attenuation;

    // Play appropriate enemy sound based on type
    switch (soundType) {
      case 'death':
        this.playEnemyDeathSound(enemyType, finalVolume);
        break;
      case 'attack':
        this.enemies.generateAlienAttack(finalVolume);
        break;
      case 'footstep':
        this.playEnemyFootstep(enemyType, finalVolume);
        break;
      case 'alert':
        this.enemies.generateAlienAlert(finalVolume);
        break;
      case 'spawn':
        this.enemies.generateAlienSpawn(finalVolume);
        break;
    }
  }

  /**
   * Play enemy-type-specific death sound
   */
  private playEnemyDeathSound(enemyType: string, volume: number): void {
    const type = enemyType.toLowerCase();

    switch (type) {
      case 'skitterer':
      case 'runner':
        this.enemies.generateSkittererDeath(volume);
        break;
      case 'spitter':
      case 'spewer':
        this.enemies.generateSpitterDeath(volume);
        break;
      case 'warrior':
      case 'hunter':
        this.enemies.generateWarriorDeath(volume);
        break;
      case 'heavy':
        this.enemies.generateAlienHeavyStep(volume * 0.5);
        this.enemies.generateAlienRoar(volume);
        break;
      case 'queen':
      case 'broodmother':
        this.enemies.generateQueenDeath(volume);
        break;
      default:
        this.enemies.generateEnemyDeath(volume);
    }
  }

  /**
   * Play enemy-type-specific footstep
   */
  private playEnemyFootstep(enemyType: string, volume: number): void {
    const type = enemyType.toLowerCase();

    switch (type) {
      case 'skitterer':
      case 'runner':
        this.enemies.generateSkittererScurry(volume);
        break;
      case 'heavy':
      case 'queen':
      case 'broodmother':
        this.enemies.generateHeavyFootstep(volume);
        break;
      default:
        this.enemies.generateAlienFootstep(volume);
    }
  }

  /**
   * Play a sound effect by name
   */
  play(effect: SoundEffect, volume: number): void {
    const handler = this.soundHandlers[effect];
    if (handler) {
      handler(volume);
    }
  }

  /**
   * Map of sound effects to their handler functions
   */
  private soundHandlers: Record<SoundEffect, ((volume: number) => void) | null> = {
    // Weapon sounds
    weapon_fire: (v) => this.weapons.generateLaserShot(v),
    hit_marker: (v) => weaponSoundManager.playHitMarker(v),
    headshot: (v) => weaponSoundManager.playHeadshot(v),
    kill_confirm: (v) => weaponSoundManager.playKillConfirmation(v),
    weapon_switch: (v) => weaponSoundManager.playWeaponSwitch(v),
    player_damage: (v) => this.weapons.generateDamage(v),
    footstep: (v) => this.weapons.generateFootstep(v),

    // UI sounds
    ui_click: (v) => this.ui.generateUIClick(v),
    ui_hover: (v) => this.ui.generateUIHover(v),
    notification: (v) => this.ui.generateNotificationBeep(v),
    comms_open: (v) => this.ui.generateNotificationBeep(v),
    comms_close: (v) => this.ui.generateCommsClose(v),
    achievement_unlock: (v) => this.ui.generateAchievementUnlock(v),
    audio_log_pickup: (v) => this.ui.generateAudioLogPickup(v),
    secret_found: (v) => this.ui.generateSecretFound(v),

    // Enemy sounds
    enemy_death: (v) => this.enemies.generateEnemyDeath(v),
    alien_screech: (v) => this.enemies.generateAlienScreech(v),
    alien_growl: (v) => this.enemies.generateAlienGrowl(v),
    hive_pulse: (v) => this.enemies.generateHivePulse(v),
    organic_squish: (v) => this.enemies.generateOrganicSquish(v),
    alien_footstep: (v) => this.enemies.generateAlienFootstep(v),
    alien_attack: (v) => this.enemies.generateAlienAttack(v),
    alien_spawn: (v) => this.enemies.generateAlienSpawn(v),
    alien_alert: (v) => this.enemies.generateAlienAlert(v),
    alien_chittering: (v) => this.enemies.generateAlienChittering(v),
    alien_heavy_step: (v) => this.enemies.generateAlienHeavyStep(v),
    alien_acid_spit: (v) => this.enemies.generateAlienAcidSpit(v),
    alien_roar: (v) => this.enemies.generateAlienRoar(v),
    alien_hiss: (v) => this.enemies.generateAlienHiss(v),
    alien_death_scream: (v) => this.enemies.generateAlienDeathScream(v),

    // Mech sounds
    mech_step: (v) => this.weapons.generateMechStep(v),
    mech_fire: (v) => this.weapons.generateMechFire(v),
    explosion: (v) => this.weapons.generateExplosion(v),

    // Near-miss sounds
    near_miss_whoosh: (v) => this.environment.generateNearMissWhoosh(v),
    near_miss_ice: (v) => this.environment.generateIceNearMissWhoosh(v),
    near_miss_metal: (v) => this.environment.generateMetalNearMissWhoosh(v),

    // Collapse sounds
    collapse_rumble: (v) => this.environment.generateCollapseRumble(v),
    collapse_crack: (v) => this.environment.generateCollapseCrack(v),
    structure_groan: (v) => this.environment.generateStructureGroan(v),
    debris_impact: (v) => this.environment.generateDebrisImpact(v),
    ground_crack: (v) => this.environment.generateGroundCrack(v),

    // Vehicle/door sounds
    door_open: (v) => this.environment.generateDoorOpen(v),
    airlock: (v) => this.environment.generateAirlockCycle(v),
    drop_impact: (v) => this.environment.generateDropImpact(v),

    // Loopable sounds (use the loop generators instead)
    drop_wind: null, // Use generateDropWind() for looping
    drop_thrust: null, // Use generateThrustSound() for looping
    dropship_engine: null, // Use generateDropshipEngine() for looping

    // Not yet implemented - stub with related sounds
    weapon_reload: (v) => this.weapons.generateFootstep(v * 0.5), // Placeholder: mechanical click
    weapon_reload_start: (v) => this.weapons.generateFootstep(v * 0.4),
    weapon_reload_complete: (v) => this.ui.generateUIClick(v),
    weapon_empty_click: (v) => this.ui.generateUIClick(v * 0.6),
    jump: (v) => this.weapons.generateFootstep(v * 0.7),
    land: (v) => this.environment.generateDebrisImpact(v * 0.3),
    ambient_wind: null, // Use ProceduralAmbientGenerator for looping ambient
    shield_recharge: (v) => this.ui.generateAchievementUnlock(v * 0.5),
    alert: (v) => this.ui.generateNotificationBeep(v * 1.2),

    // HALO drop additional sounds
    asteroid_rumble: (v) => this.environment.generateCollapseRumble(v * 0.5),
    grenade_explosion: (v) => this.weapons.generateExplosion(v),
    grenade_throw: (v) => this.weapons.generateFootstep(v * 0.6), // Placeholder: swoosh

    // Hit feedback sounds
    hit_confirm: (v) => hitAudioManager.playHitSound(25, false),
    critical_hit: (v) => hitAudioManager.playHitSound(50, true),
    armor_break: () => hitAudioManager.playArmorBreakSound(),
    low_ammo_warning: () => hitAudioManager.playLowAmmoWarning(),
    multi_kill: () => hitAudioManager.playMultiKillSound(3),

    // Movement sounds
    slide: (v) => this.environment.generateSlideSound(v),
    slide_end: (v) => this.environment.generateSlideEndSound(v),

    // Melee combat sounds
    melee_swing: (v) => this.weapons.generateMeleeSwing(v),
    melee_impact: (v) => this.weapons.generateMeleeImpact(v),

    // Platforming sounds (use existing environment sounds)
    land_metal: (v) => this.environment.generateMetalNearMissWhoosh(v * 0.5),
    mantle: (v) => this.environment.generateSlideEndSound(v * 0.6),
    ledge_grab: (v) => this.ui.generateUIClick(v * 0.5),
    pull_up: (v) => this.environment.generateSlideEndSound(v * 0.7),

    // Vehicle weapon sounds
    rifle_fire: (v) => this.weapons.generateLaserShot(v * 0.8),
    rocket_fire: (v) => this.weapons.generateExplosion(v * 0.6),
    turret_fire: (v) => this.weapons.generateLaserShot(v * 0.9),
    cannon_fire: (v) => this.weapons.generateMechFire(v),
  };

  // Loop generators
  generateDropWind(duration?: number, volume?: number): AudioLoopHandle {
    return this.environment.generateDropWind(duration, volume);
  }

  generateThrustSound(volume?: number): AudioLoopHandle {
    return this.environment.generateThrustSound(volume);
  }

  generateDropshipEngine(volume?: number): AudioLoopHandle {
    return this.environment.generateDropshipEngine(volume);
  }

  dispose(): void {
    this.ui.dispose();
    this.weapons.dispose();
    this.enemies.dispose();
    this.environment.dispose();

    // Clean up spatial audio
    if (this.reverbNode) {
      this.reverbNode.disconnect();
      this.reverbNode = null;
    }
    if (this.dryGain) {
      this.dryGain.disconnect();
      this.dryGain = null;
    }
    if (this.wetGain) {
      this.wetGain.disconnect();
      this.wetGain = null;
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Re-export the ambient generator
export { ProceduralAmbientGenerator };
