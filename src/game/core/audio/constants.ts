/**
 * Audio System Constants
 * Volume levels, fade times, frequency values, and level configurations
 */

import { MUSIC_PATHS as CONFIG_MUSIC_PATHS } from '@config/audio';
import type { LevelId } from '../../levels/types';
import type { LevelAudioConfig, MusicTrack, TrackInfo } from './types';

// Music file paths - spread from config, add defeat override
export const MUSIC_PATHS: Record<MusicTrack, string> = {
  ...CONFIG_MUSIC_PATHS,
  defeat: CONFIG_MUSIC_PATHS.combat, // Reuse combat for defeat tension
};

// Track characteristics for intelligent blending
export const TRACK_INFO: Record<MusicTrack, TrackInfo> = {
  menu: { intensity: 0.2, bpm: 80 },
  ambient: { intensity: 0.3, bpm: 70 },
  exploration: { intensity: 0.4, bpm: 90 },
  combat: { intensity: 0.8, bpm: 140 },
  boss: { intensity: 1.0, bpm: 160 },
  victory: { intensity: 0.5, bpm: 100 },
  defeat: { intensity: 0.7, bpm: 120 },
};

// Level audio configurations
export const LEVEL_AUDIO_CONFIGS: Partial<Record<LevelId, LevelAudioConfig>> = {
  anchor_station: {
    ambientTrack: 'ambient',
    combatTrack: 'combat',
    ambientVolume: 0.4,
    combatVolume: 0.6,
    proceduralAmbient: {
      type: 'station',
      intensity: 0.3,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'station',
      volume: 0.45,
    },
  },
  landfall: {
    ambientTrack: 'exploration',
    combatTrack: 'combat',
    ambientVolume: 0.5,
    combatVolume: 0.7,
    proceduralAmbient: {
      type: 'wind',
      intensity: 0.6,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'surface',
      volume: 0.4,
    },
  },
  fob_delta: {
    ambientTrack: 'ambient',
    combatTrack: 'combat',
    ambientVolume: 0.3,
    combatVolume: 0.65,
    proceduralAmbient: {
      type: 'horror',
      intensity: 0.5,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'base',
      volume: 0.4,
    },
  },
  brothers_in_arms: {
    ambientTrack: 'exploration',
    combatTrack: 'combat',
    ambientVolume: 0.45,
    combatVolume: 0.75,
    proceduralAmbient: {
      type: 'wind',
      intensity: 0.4,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'surface',
      volume: 0.45,
    },
  },
  the_breach: {
    ambientTrack: 'ambient',
    combatTrack: 'boss',
    ambientVolume: 0.35,
    combatVolume: 0.8,
    proceduralAmbient: {
      type: 'hive',
      intensity: 0.6,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'hive',
      volume: 0.5,
    },
  },
  extraction: {
    ambientTrack: 'exploration',
    combatTrack: 'combat',
    ambientVolume: 0.5,
    combatVolume: 0.85,
    proceduralAmbient: {
      type: 'extraction',
      intensity: 0.7,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'extraction',
      volume: 0.55,
    },
  },
  southern_ice: {
    ambientTrack: 'ambient',
    combatTrack: 'combat',
    ambientVolume: 0.45,
    combatVolume: 0.7,
    proceduralAmbient: {
      type: 'ice',
      intensity: 0.6,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'surface',
      volume: 0.4,
    },
  },
  canyon_run: {
    ambientTrack: 'exploration',
    combatTrack: 'combat',
    ambientVolume: 0.5,
    combatVolume: 0.75,
    proceduralAmbient: {
      type: 'wind',
      intensity: 0.5,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'surface',
      volume: 0.45,
    },
  },
  hive_assault: {
    ambientTrack: 'ambient',
    combatTrack: 'boss',
    ambientVolume: 0.35,
    combatVolume: 0.8,
    proceduralAmbient: {
      type: 'hive',
      intensity: 0.65,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'hive',
      volume: 0.5,
    },
  },
  final_escape: {
    ambientTrack: 'combat',
    combatTrack: 'boss',
    ambientVolume: 0.55,
    combatVolume: 0.9,
    proceduralAmbient: {
      type: 'extraction',
      intensity: 0.8,
    },
    proceduralMusic: {
      enabled: true,
      environment: 'extraction',
      volume: 0.6,
    },
  },
};

// Default volume levels
export const DEFAULT_VOLUMES: Record<string, number> = {
  master: 1.0,
  sfx: 0.7,
  music: 0.5,
  voice: 0.8,
  ambient: 0.5,
};

// Fade durations in seconds
export const FADE_DURATIONS = {
  quickTransition: 1,
  normalTransition: 2,
  slowTransition: 3,
  combatEnter: 1,
  combatExit: 2,
  victory: 1.5,
  defeat: 1,
} as const;

// Combat exit delay in milliseconds
export const COMBAT_EXIT_DELAY_MS = 3000;

// Frequency constants for procedural audio
export const FREQUENCIES = {
  // Base frequencies
  lowHum: 60,
  midHum: 120,

  // Weapon frequencies
  laserBase: 800,
  laserHigh: 2000,

  // UI frequencies
  clickBase: 600,
  clickHigh: 800,
  notificationLow: 880,
  notificationHigh: 1100,

  // Achievement arpeggio (C major: C5, E5, G5, C6)
  achievementNotes: [523.25, 659.25, 783.99, 1046.5] as const,

  // Secret found (E minor: E4, G4, B4, E5)
  secretNotes: [329.63, 392.0, 493.88, 659.25] as const,

  // Audio log pickup (A major arpeggio: A4, C#5, E5, A5)
  audioLogNotes: [440, 554, 659, 880] as const,

  // Enemy sound ranges
  alienScreechLow: 200,
  alienScreechHigh: 800,
  alienGrowlBase: 80,
  alienRoarBase: 60,

  // Mech sounds
  mechStepBase: 60,
  mechFireBase: 120,

  // Explosion
  explosionBass: 80,
  explosionRumble: 150,
} as const;

// LFO rates for various effects
export const LFO_RATES = {
  alienVibrato: 30,
  growlTremolo: 6,
  thrusterWobble: 8,
  windGust: 0.1,
  hivePulse: 0.3,
  structureWaver: 2,
} as const;

// Filter Q values
export const FILTER_Q = {
  sharp: 8,
  moderate: 5,
  gentle: 2,
  subtle: 1,
} as const;
