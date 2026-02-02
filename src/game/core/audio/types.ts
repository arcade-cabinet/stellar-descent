/**
 * Audio System Type Definitions
 * Central type definitions for the modular audio system
 */

import type { LevelId } from '../../levels/types';

// Sound effect types - all procedural audio effects
export type SoundEffect =
  | 'weapon_fire'
  | 'weapon_reload'
  | 'weapon_reload_start'
  | 'weapon_reload_complete'
  | 'weapon_empty_click'
  | 'weapon_switch'
  | 'hit_marker'
  | 'headshot'
  | 'kill_confirm'
  | 'enemy_death'
  | 'player_damage'
  | 'footstep'
  | 'jump'
  | 'land'
  | 'ambient_wind'
  | 'ui_click'
  | 'ui_hover'
  | 'notification'
  | 'achievement_unlock'
  | 'drop_wind'
  | 'drop_thrust'
  | 'drop_impact'
  | 'comms_open'
  | 'comms_close'
  | 'door_open'
  | 'airlock'
  | 'alien_screech'
  | 'alien_growl'
  | 'hive_pulse'
  | 'organic_squish'
  | 'mech_step'
  | 'mech_fire'
  | 'explosion'
  | 'dropship_engine'
  // Enemy-specific sounds
  | 'alien_footstep'
  | 'alien_attack'
  | 'alien_spawn'
  | 'alien_alert'
  | 'alien_chittering'
  | 'alien_heavy_step'
  | 'alien_acid_spit'
  | 'alien_roar'
  | 'alien_hiss'
  // Collectible sounds
  | 'audio_log_pickup'
  | 'secret_found'
  // HALO drop near-miss sounds
  | 'near_miss_whoosh'
  | 'near_miss_ice'
  | 'near_miss_metal'
  // HALO drop environment sounds
  | 'asteroid_rumble'
  | 'grenade_explosion'
  | 'grenade_throw'
  // Hive collapse sounds
  | 'collapse_rumble'
  | 'collapse_crack'
  | 'structure_groan'
  | 'debris_impact'
  | 'alien_death_scream'
  | 'ground_crack'
  // Timer / checkpoint sounds
  | 'shield_recharge'
  | 'alert'
  // Hit feedback sounds
  | 'hit_confirm'
  | 'critical_hit'
  | 'armor_break'
  | 'low_ammo_warning'
  | 'multi_kill'
  // Movement sounds
  | 'slide'
  | 'slide_end'
  // Melee combat sounds
  | 'melee_swing'
  | 'melee_impact'
  // Platforming sounds
  | 'land_metal'
  | 'mantle'
  | 'ledge_grab'
  | 'pull_up'
  // Vehicle weapon sounds
  | 'rocket_fire'
  | 'rifle_fire'
  | 'turret_fire'
  | 'cannon_fire';

// Music tracks - mapped to actual audio files
export type MusicTrack =
  | 'menu'
  | 'ambient'
  | 'combat'
  | 'exploration'
  | 'boss'
  | 'victory'
  | 'defeat';

// Sound configuration for file-based sounds
export interface SoundConfig {
  url: string;
  volume: number;
  loop?: boolean;
  spatialSound?: boolean;
  maxDistance?: number;
}

// Level-specific audio configuration
export interface LevelAudioConfig {
  ambientTrack: MusicTrack;
  combatTrack: MusicTrack;
  ambientVolume: number;
  combatVolume: number;
  // Procedural ambient settings (sound effects layer)
  proceduralAmbient?: {
    type: ProceduralAmbientType;
    intensity: number;
  };
  // Procedural music settings (Tone.js generated music)
  proceduralMusic?: {
    enabled: boolean;
    environment: MusicEnvironment;
    volume: number;
  };
}

// Procedural ambient sound types
export type ProceduralAmbientType = 'station' | 'wind' | 'horror' | 'hive' | 'extraction' | 'ice';

// Music environment for procedural music engine
export type MusicEnvironment = 'station' | 'surface' | 'base' | 'hive' | 'extraction';

// Track characteristics for intelligent blending
export interface TrackInfo {
  intensity: number;
  bpm?: number;
}

// Loopable sound effect types
export type LoopableSoundEffect = 'drop_wind' | 'drop_thrust' | 'dropship_engine';

// Audio loop handle for stopping looped sounds
export interface AudioLoopHandle {
  stop: () => void;
}

// Volume settings interface
export interface VolumeSettings {
  master: number;
  sfx: number;
  music: number;
  voice: number;
  ambient: number;
}

// Audio state for persistence
export interface AudioState {
  isMuted: boolean;
  volumes: VolumeSettings;
  currentLevelId: LevelId | null;
  isInCombat: boolean;
}
