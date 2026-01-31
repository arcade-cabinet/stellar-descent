/**
 * AudioAssetManifest - Audio Asset Definitions for Stellar Descent
 *
 * JSON-driven manifest of all audio assets to be downloaded from Freesound.org.
 * Defines search queries, filters, and processing options for each sound effect,
 * ambience, and music stinger used in the game.
 */

import type { AudioAssetDef, AudioAssetManifest } from './types';

// ============================================================================
// WEAPON SOUND EFFECTS
// ============================================================================

/**
 * Weapon-related sound effects
 */
export const WEAPON_SFX: AudioAssetDef[] = [
  // Pistol
  {
    id: 'sfx_pistol_fire',
    type: 'sfx',
    searchQuery: 'pistol gunshot single',
    filters: {
      maxDuration: 2,
      tags: ['weapon', 'gun', 'pistol'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeOut: 0.1,
    },
    fallbackProcedural: 'proc_pistol_shot',
  },
  {
    id: 'sfx_pistol_fire_alt',
    type: 'sfx',
    searchQuery: 'handgun shot suppressed',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_pistol_shot',
  },

  // Assault Rifle
  {
    id: 'sfx_rifle_fire',
    type: 'sfx',
    searchQuery: 'assault rifle burst automatic',
    filters: {
      maxDuration: 3,
      tags: ['weapon', 'rifle'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeOut: 0.05,
    },
    fallbackProcedural: 'proc_rifle_shot',
  },
  {
    id: 'sfx_rifle_single',
    type: 'sfx',
    searchQuery: 'rifle single shot',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_rifle_shot',
  },

  // Shotgun
  {
    id: 'sfx_shotgun_fire',
    type: 'sfx',
    searchQuery: 'shotgun blast pump action',
    filters: {
      maxDuration: 2,
      tags: ['shotgun', 'blast'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeOut: 0.15,
    },
    fallbackProcedural: 'proc_shotgun_blast',
  },
  {
    id: 'sfx_shotgun_pump',
    type: 'sfx',
    searchQuery: 'shotgun pump reload',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_shotgun_pump',
  },

  // SMG
  {
    id: 'sfx_smg_fire',
    type: 'sfx',
    searchQuery: 'submachine gun automatic burst',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: 2, // Slightly higher pitch for sci-fi feel
    },
    fallbackProcedural: 'proc_smg_burst',
  },

  // Plasma/Energy Weapons (sci-fi)
  {
    id: 'sfx_plasma_fire',
    type: 'sfx',
    searchQuery: 'laser plasma energy weapon shot',
    filters: {
      maxDuration: 2,
      tags: ['laser', 'sci-fi', 'energy'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_plasma_shot',
  },
  {
    id: 'sfx_plasma_charge',
    type: 'sfx',
    searchQuery: 'energy charge power up sci-fi',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeIn: 0.2,
    },
    fallbackProcedural: 'proc_plasma_charge',
  },

  // Explosives
  {
    id: 'sfx_grenade_explosion',
    type: 'sfx',
    searchQuery: 'grenade explosion blast',
    filters: {
      maxDuration: 4,
      tags: ['explosion', 'grenade'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_explosion',
  },
  {
    id: 'sfx_rocket_launch',
    type: 'sfx',
    searchQuery: 'rocket launcher whoosh',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_rocket_launch',
  },
  {
    id: 'sfx_rocket_explosion',
    type: 'sfx',
    searchQuery: 'large explosion impact',
    filters: {
      maxDuration: 5,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_explosion',
  },

  // Reload and Handling
  {
    id: 'sfx_reload_magazine',
    type: 'sfx',
    searchQuery: 'gun reload magazine insert',
    filters: {
      maxDuration: 3,
      tags: ['reload', 'magazine'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_reload',
  },
  {
    id: 'sfx_reload_chamber',
    type: 'sfx',
    searchQuery: 'gun chamber slide rack',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_chamber',
  },
  {
    id: 'sfx_weapon_switch',
    type: 'sfx',
    searchQuery: 'weapon holster draw',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_weapon_switch',
  },
  {
    id: 'sfx_ammo_pickup',
    type: 'sfx',
    searchQuery: 'ammunition pickup collect',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_pickup',
  },
];

// ============================================================================
// ENEMY SOUND EFFECTS
// ============================================================================

/**
 * Alien enemy sound effects
 */
export const ENEMY_SFX: AudioAssetDef[] = [
  // Basic Alien Sounds
  {
    id: 'sfx_alien_screech',
    type: 'sfx',
    searchQuery: 'alien creature screech monster',
    filters: {
      maxDuration: 3,
      tags: ['creature', 'monster', 'alien'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -3,
      reverb: true,
    },
    fallbackProcedural: 'proc_alien_screech',
  },
  {
    id: 'sfx_alien_growl',
    type: 'sfx',
    searchQuery: 'monster growl aggressive creature',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -5,
    },
    fallbackProcedural: 'proc_alien_growl',
  },
  {
    id: 'sfx_alien_hiss',
    type: 'sfx',
    searchQuery: 'snake hiss creature',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_alien_hiss',
  },

  // Alien Death
  {
    id: 'sfx_alien_death',
    type: 'sfx',
    searchQuery: 'monster death growl creature die',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -4,
      fadeOut: 0.3,
    },
    fallbackProcedural: 'proc_alien_death',
  },
  {
    id: 'sfx_alien_death_screech',
    type: 'sfx',
    searchQuery: 'creature scream death agony',
    filters: {
      maxDuration: 4,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -2,
    },
    fallbackProcedural: 'proc_alien_death',
  },

  // Alien Movement
  {
    id: 'sfx_alien_footstep',
    type: 'sfx',
    searchQuery: 'creature footstep claw',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_alien_step',
  },
  {
    id: 'sfx_alien_crawl',
    type: 'sfx',
    searchQuery: 'insect crawling skittering',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -2,
    },
    fallbackProcedural: 'proc_alien_crawl',
  },
  {
    id: 'sfx_alien_wing_flutter',
    type: 'sfx',
    searchQuery: 'wings flutter insect flying',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -3,
    },
    fallbackProcedural: 'proc_wing_flutter',
  },

  // Alien Attacks
  {
    id: 'sfx_alien_spit',
    type: 'sfx',
    searchQuery: 'spit acid spray liquid',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_alien_spit',
  },
  {
    id: 'sfx_alien_claw_swipe',
    type: 'sfx',
    searchQuery: 'claw swipe slash attack',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_claw_swipe',
  },
  {
    id: 'sfx_alien_bite',
    type: 'sfx',
    searchQuery: 'bite chomp creature attack',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_bite',
  },

  // Queen Boss Sounds
  {
    id: 'sfx_queen_roar',
    type: 'sfx',
    searchQuery: 'monster roar deep massive creature',
    filters: {
      minDuration: 3,
      maxDuration: 8,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -8,
      reverb: true,
    },
    fallbackProcedural: 'proc_queen_roar',
  },
  {
    id: 'sfx_queen_screech',
    type: 'sfx',
    searchQuery: 'loud screech monster boss',
    filters: {
      maxDuration: 5,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -6,
      reverb: true,
    },
    fallbackProcedural: 'proc_queen_screech',
  },
  {
    id: 'sfx_queen_summon',
    type: 'sfx',
    searchQuery: 'alien call summon creatures',
    filters: {
      maxDuration: 4,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_queen_summon',
  },
];

// ============================================================================
// AMBIENCE
// ============================================================================

/**
 * Environmental ambience sounds
 */
export const AMBIENCE_SFX: AudioAssetDef[] = [
  // Station Interiors
  {
    id: 'amb_station_hum',
    type: 'ambience',
    searchQuery: 'spaceship interior hum engine room',
    filters: {
      minDuration: 30,
      tags: ['ambient', 'spaceship', 'interior'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeIn: 2,
      fadeOut: 2,
    },
    fallbackProcedural: 'proc_station_hum',
  },
  {
    id: 'amb_station_alarm',
    type: 'ambience',
    searchQuery: 'alarm siren emergency spaceship',
    filters: {
      minDuration: 5,
      maxDuration: 30,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_alarm',
  },
  {
    id: 'amb_station_ventilation',
    type: 'ambience',
    searchQuery: 'ventilation air conditioning hum',
    filters: {
      minDuration: 20,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeIn: 1,
      fadeOut: 1,
    },
    fallbackProcedural: 'proc_ventilation',
  },
  {
    id: 'amb_station_electrical',
    type: 'ambience',
    searchQuery: 'electrical buzz hum machinery',
    filters: {
      minDuration: 15,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_electrical',
  },

  // Outdoor Environments
  {
    id: 'amb_wind',
    type: 'ambience',
    searchQuery: 'wind howling outdoor desert',
    filters: {
      minDuration: 30,
      tags: ['wind', 'outdoor'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeIn: 3,
      fadeOut: 3,
    },
    fallbackProcedural: 'proc_wind',
  },
  {
    id: 'amb_wind_strong',
    type: 'ambience',
    searchQuery: 'strong wind storm gusts',
    filters: {
      minDuration: 20,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeIn: 2,
      fadeOut: 2,
    },
    fallbackProcedural: 'proc_wind_strong',
  },
  {
    id: 'amb_dust_storm',
    type: 'ambience',
    searchQuery: 'sandstorm dust wind',
    filters: {
      minDuration: 30,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_dust_storm',
  },

  // Cave/Underground
  {
    id: 'amb_cave_drip',
    type: 'ambience',
    searchQuery: 'cave water dripping echo underground',
    filters: {
      minDuration: 20,
      tags: ['cave', 'drip', 'echo'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_cave_drip',
  },
  {
    id: 'amb_cave_rumble',
    type: 'ambience',
    searchQuery: 'underground rumble cave ambient',
    filters: {
      minDuration: 20,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -3,
    },
    fallbackProcedural: 'proc_cave_rumble',
  },

  // Ice/Cold
  {
    id: 'amb_ice_crack',
    type: 'sfx',
    searchQuery: 'ice cracking frozen crack',
    filters: {
      maxDuration: 5,
      tags: ['ice', 'crack'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_ice_crack',
  },
  {
    id: 'amb_blizzard',
    type: 'ambience',
    searchQuery: 'blizzard snowstorm arctic wind',
    filters: {
      minDuration: 30,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeIn: 3,
      fadeOut: 3,
    },
    fallbackProcedural: 'proc_blizzard',
  },
  {
    id: 'amb_ice_creak',
    type: 'sfx',
    searchQuery: 'ice creaking groaning frozen',
    filters: {
      maxDuration: 4,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ice_creak',
  },

  // Hive/Organic
  {
    id: 'amb_hive_organic',
    type: 'ambience',
    searchQuery: 'organic alien hive pulsing',
    filters: {
      minDuration: 20,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -2,
      reverb: true,
    },
    fallbackProcedural: 'proc_hive_pulse',
  },
  {
    id: 'amb_hive_breathing',
    type: 'ambience',
    searchQuery: 'breathing creature organic slow',
    filters: {
      minDuration: 15,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -4,
    },
    fallbackProcedural: 'proc_hive_breath',
  },
  {
    id: 'amb_insect_swarm',
    type: 'ambience',
    searchQuery: 'insect swarm buzzing flies',
    filters: {
      minDuration: 10,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_insect_swarm',
  },
];

// ============================================================================
// UI SOUND EFFECTS
// ============================================================================

/**
 * User interface sound effects
 */
export const UI_SFX: AudioAssetDef[] = [
  {
    id: 'ui_select',
    type: 'sfx',
    searchQuery: 'ui click select interface',
    filters: {
      maxDuration: 1,
      tags: ['ui', 'click', 'interface'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_click',
  },
  {
    id: 'ui_hover',
    type: 'sfx',
    searchQuery: 'ui hover soft subtle',
    filters: {
      maxDuration: 0.5,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_hover',
  },
  {
    id: 'ui_confirm',
    type: 'sfx',
    searchQuery: 'success confirmation positive',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_confirm',
  },
  {
    id: 'ui_cancel',
    type: 'sfx',
    searchQuery: 'cancel back error negative',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_cancel',
  },
  {
    id: 'ui_menu_open',
    type: 'sfx',
    searchQuery: 'menu open interface whoosh',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_open',
  },
  {
    id: 'ui_menu_close',
    type: 'sfx',
    searchQuery: 'menu close interface',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_close',
  },
  {
    id: 'ui_notification',
    type: 'sfx',
    searchQuery: 'notification alert ping',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_notification',
  },
  {
    id: 'ui_objective_complete',
    type: 'sfx',
    searchQuery: 'achievement unlock complete fanfare short',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_objective_complete',
  },
  {
    id: 'ui_warning',
    type: 'sfx',
    searchQuery: 'warning alert beep danger',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_ui_warning',
  },
];

// ============================================================================
// PLAYER SOUND EFFECTS
// ============================================================================

/**
 * Player-related sound effects
 */
export const PLAYER_SFX: AudioAssetDef[] = [
  // Movement
  {
    id: 'sfx_footstep_metal',
    type: 'sfx',
    searchQuery: 'footstep metal boot military',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_footstep_metal',
  },
  {
    id: 'sfx_footstep_dirt',
    type: 'sfx',
    searchQuery: 'footstep dirt gravel outdoor',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_footstep_dirt',
  },
  {
    id: 'sfx_footstep_ice',
    type: 'sfx',
    searchQuery: 'footstep snow ice crunch',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_footstep_ice',
  },
  {
    id: 'sfx_footstep_organic',
    type: 'sfx',
    searchQuery: 'footstep wet squelch organic',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_footstep_organic',
  },

  // Health/Damage
  {
    id: 'sfx_player_hurt',
    type: 'sfx',
    searchQuery: 'male grunt pain impact',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_player_hurt',
  },
  {
    id: 'sfx_player_death',
    type: 'sfx',
    searchQuery: 'male death scream',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeOut: 0.5,
    },
    fallbackProcedural: 'proc_player_death',
  },
  {
    id: 'sfx_health_pickup',
    type: 'sfx',
    searchQuery: 'health powerup healing collect',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_health_pickup',
  },
  {
    id: 'sfx_armor_pickup',
    type: 'sfx',
    searchQuery: 'armor powerup shield collect',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_armor_pickup',
  },

  // Suit/Equipment
  {
    id: 'sfx_suit_servo',
    type: 'sfx',
    searchQuery: 'servo motor mechanical movement',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_servo',
  },
  {
    id: 'sfx_helmet_hud',
    type: 'sfx',
    searchQuery: 'hud interface beep sci-fi',
    filters: {
      maxDuration: 1,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_hud_beep',
  },
];

// ============================================================================
// VEHICLE SOUND EFFECTS
// ============================================================================

/**
 * Vehicle-related sound effects
 */
export const VEHICLE_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_buggy_engine',
    type: 'sfx',
    searchQuery: 'offroad vehicle engine running loop',
    filters: {
      minDuration: 5,
      maxDuration: 20,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_engine_loop',
  },
  {
    id: 'sfx_buggy_accelerate',
    type: 'sfx',
    searchQuery: 'vehicle accelerate rev engine',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_engine_rev',
  },
  {
    id: 'sfx_mech_footstep',
    type: 'sfx',
    searchQuery: 'heavy metal footstep robot mech',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      pitchShift: -2,
    },
    fallbackProcedural: 'proc_mech_step',
  },
  {
    id: 'sfx_mech_servo',
    type: 'sfx',
    searchQuery: 'heavy servo mechanical hydraulic',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_mech_servo',
  },
  {
    id: 'sfx_dropship_engine',
    type: 'sfx',
    searchQuery: 'spacecraft engine thrust hover',
    filters: {
      minDuration: 5,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_dropship_engine',
  },
  {
    id: 'sfx_dropship_land',
    type: 'sfx',
    searchQuery: 'spacecraft landing touchdown',
    filters: {
      maxDuration: 5,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_dropship_land',
  },
];

// ============================================================================
// MUSIC STINGERS
// ============================================================================

/**
 * Music stingers and short musical cues
 */
export const MUSIC_STINGERS: AudioAssetDef[] = [
  {
    id: 'music_victory',
    type: 'music',
    searchQuery: 'victory fanfare orchestral triumphant',
    filters: {
      maxDuration: 10,
      tags: ['victory', 'fanfare'],
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeOut: 1,
    },
    fallbackProcedural: 'proc_victory_stinger',
  },
  {
    id: 'music_defeat',
    type: 'music',
    searchQuery: 'defeat sad orchestral somber',
    filters: {
      maxDuration: 8,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeOut: 1,
    },
    fallbackProcedural: 'proc_defeat_stinger',
  },
  {
    id: 'music_tension_rise',
    type: 'music',
    searchQuery: 'tension rising suspense horror',
    filters: {
      maxDuration: 10,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_tension_rise',
  },
  {
    id: 'music_boss_intro',
    type: 'music',
    searchQuery: 'boss battle intro dramatic',
    filters: {
      maxDuration: 15,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      fadeIn: 0.5,
    },
    fallbackProcedural: 'proc_boss_intro',
  },
  {
    id: 'music_mission_start',
    type: 'music',
    searchQuery: 'mission briefing military drums',
    filters: {
      maxDuration: 10,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_mission_start',
  },
  {
    id: 'music_discovery',
    type: 'music',
    searchQuery: 'discovery mysterious ambient pad',
    filters: {
      maxDuration: 8,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_discovery',
  },
];

// ============================================================================
// COLLECTIBLE SOUNDS
// ============================================================================

/**
 * Collectible and secret-related sounds
 */
export const COLLECTIBLE_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_skull_pickup',
    type: 'sfx',
    searchQuery: 'mystical pickup collect magical',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
      reverb: true,
    },
    fallbackProcedural: 'proc_skull_pickup',
  },
  {
    id: 'sfx_secret_found',
    type: 'sfx',
    searchQuery: 'secret discover hidden reveal',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_secret_found',
  },
  {
    id: 'sfx_audio_log_play',
    type: 'sfx',
    searchQuery: 'tape play start recording',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_audio_log_start',
  },
  {
    id: 'sfx_data_terminal',
    type: 'sfx',
    searchQuery: 'computer terminal beep access',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_terminal_access',
  },
];

// ============================================================================
// ENVIRONMENTAL EFFECTS
// ============================================================================

/**
 * Environmental interaction sounds
 */
export const ENVIRONMENT_SFX: AudioAssetDef[] = [
  {
    id: 'sfx_door_open_metal',
    type: 'sfx',
    searchQuery: 'metal door open mechanical sci-fi',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_door_open',
  },
  {
    id: 'sfx_door_close_metal',
    type: 'sfx',
    searchQuery: 'metal door close slam',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_door_close',
  },
  {
    id: 'sfx_elevator',
    type: 'sfx',
    searchQuery: 'elevator moving mechanical hum',
    filters: {
      maxDuration: 5,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_elevator',
  },
  {
    id: 'sfx_debris_fall',
    type: 'sfx',
    searchQuery: 'debris falling rocks rubble',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_debris',
  },
  {
    id: 'sfx_glass_break',
    type: 'sfx',
    searchQuery: 'glass break shatter',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_glass_break',
  },
  {
    id: 'sfx_steam_release',
    type: 'sfx',
    searchQuery: 'steam release hiss pipe',
    filters: {
      maxDuration: 3,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_steam',
  },
  {
    id: 'sfx_sparks',
    type: 'sfx',
    searchQuery: 'electrical sparks arc zap',
    filters: {
      maxDuration: 2,
      license: 'cc0',
    },
    processing: {
      normalize: true,
    },
    fallbackProcedural: 'proc_sparks',
  },
];

// ============================================================================
// COMPLETE MANIFEST
// ============================================================================

/**
 * All audio asset definitions combined
 */
export const ALL_AUDIO_ASSETS: AudioAssetDef[] = [
  ...WEAPON_SFX,
  ...ENEMY_SFX,
  ...AMBIENCE_SFX,
  ...UI_SFX,
  ...PLAYER_SFX,
  ...VEHICLE_SFX,
  ...MUSIC_STINGERS,
  ...COLLECTIBLE_SFX,
  ...ENVIRONMENT_SFX,
];

/**
 * Complete audio asset manifest
 */
export const AUDIO_ASSET_MANIFEST: AudioAssetManifest = {
  version: '1.0.0',
  generatedAt: Date.now(),
  weapons: WEAPON_SFX,
  enemies: ENEMY_SFX,
  ambience: AMBIENCE_SFX,
  ui: UI_SFX,
  player: PLAYER_SFX,
  vehicles: VEHICLE_SFX,
  music: MUSIC_STINGERS,
  collectibles: COLLECTIBLE_SFX,
  environment: ENVIRONMENT_SFX,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all audio assets of a specific type
 */
export function getAudioAssetsByType(type: AudioAssetDef['type']): AudioAssetDef[] {
  return ALL_AUDIO_ASSETS.filter((a) => a.type === type);
}

/**
 * Get audio asset by ID
 */
export function getAudioAssetById(id: string): AudioAssetDef | undefined {
  return ALL_AUDIO_ASSETS.find((a) => a.id === id);
}

/**
 * Get all assets that require CC0 license (safest for commercial use)
 */
export function getCC0AudioAssets(): AudioAssetDef[] {
  return ALL_AUDIO_ASSETS.filter((a) => a.filters?.license === 'cc0');
}

/**
 * Get assets grouped by category
 */
export function getAudioAssetsByCategory(): Record<string, AudioAssetDef[]> {
  return {
    weapons: WEAPON_SFX,
    enemies: ENEMY_SFX,
    ambience: AMBIENCE_SFX,
    ui: UI_SFX,
    player: PLAYER_SFX,
    vehicles: VEHICLE_SFX,
    music: MUSIC_STINGERS,
    collectibles: COLLECTIBLE_SFX,
    environment: ENVIRONMENT_SFX,
  };
}

/**
 * Get total count of audio assets
 */
export function getAudioAssetCount(): number {
  return ALL_AUDIO_ASSETS.length;
}

export default AUDIO_ASSET_MANIFEST;
