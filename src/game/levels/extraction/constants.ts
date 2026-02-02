/**
 * ExtractionLevel - Constants
 *
 * Contains all constant values for the extraction level.
 */

import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { WaveConfig } from './types';

// ============================================================================
// ASSET PATHS
// ============================================================================

/** Marcus's Titan mech GLB model */
export const GLB_MECH = '/assets/models/vehicles/marcus_mech.glb';

/** Dropship GLB model */
export const GLB_DROPSHIP = '/assets/models/spaceships/Dispatcher.glb';

/** Supply drop container GLB model */
export const GLB_SUPPLY_DROP = '/assets/models/props/collectibles/supply_drop.glb';

/** Ammo box GLB model */
export const GLB_AMMO_BOX = '/assets/models/props/weapons/ammo_box_556.glb';

/** Debris variant GLB models */
export const GLB_DEBRIS_VARIANTS = [
  '/assets/models/props/debris/brick_mx_1.glb',
  '/assets/models/props/debris/brick_mx_2.glb',
  '/assets/models/props/debris/brick_mx_3.glb',
  '/assets/models/props/debris/brick_mx_4.glb',
];

/** Crumbling wall GLB model */
export const GLB_CRUMBLING_WALL = '/assets/models/props/debris/bricks_stacked_mx_4.glb';

// ============================================================================
// COLORS
// ============================================================================

/**
 * Background colors for each phase
 */
export const PHASE_COLORS: Record<string, Color4> = {
  escape_start: new Color4(0.02, 0.01, 0.03, 1), // Dark hive colors
  escape_tunnel: new Color4(0.02, 0.01, 0.03, 1), // Dark hive colors
  escape: new Color4(0.02, 0.01, 0.03, 1), // Dark hive colors (fallback)
  surface_run: new Color4(0.02, 0.02, 0.04, 1), // Night sky - dark, desperate
  surface: new Color4(0.02, 0.02, 0.04, 1), // Night sky (fallback)
  holdout: new Color4(0.02, 0.02, 0.04, 1), // Night sky during holdout
  hive_collapse: new Color4(0.6, 0.2, 0.05, 1), // Apocalyptic orange-red
  collapse: new Color4(0.6, 0.2, 0.05, 1), // Apocalyptic orange-red (fallback)
  victory: new Color4(0.03, 0.03, 0.06, 1), // Pre-dawn night
  epilogue: new Color4(0.1, 0.1, 0.15, 1), // Station interior
};

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/** Initial escape countdown timer in seconds */
export const ESCAPE_TIMER_INITIAL = 180; // 3:00

/** Initial dropship ETA for holdout phase in seconds */
export const DROPSHIP_ETA_INITIAL = 420; // 7:00 for 7 waves

/** Hive collapse escape timer in seconds */
export const HIVE_COLLAPSE_TIMER = 90; // 90 seconds to reach dropship

/** Duration of wave announcement phase in seconds */
export const WAVE_ANNOUNCEMENT_DURATION = 4; // FIX #22: Increased from 3 for readability

/** Duration of intermission between waves in seconds */
export const WAVE_INTERMISSION_DURATION = 12; // FIX #12: Increased from 8 for resupply time

/** Total number of holdout waves */
export const TOTAL_WAVES = 7;

/** Supply drop spawn delay after wave complete (seconds) */
export const SUPPLY_DROP_DELAY = 2.0;

/** Supply drop collection radius */
export const SUPPLY_DROP_RADIUS = 3.0;

// ============================================================================
// DISTANCE CONSTANTS
// ============================================================================

/** Length of the escape tunnel in meters */
export const ESCAPE_TUNNEL_LENGTH = 300;

/** Distance to LZ Omega from surface exit in meters */
export const DISTANCE_TO_LZ_INITIAL = 500;

/** LZ Omega position */
export const LZ_POSITION = new Vector3(0, 0, -500);

/** Dropship position during collapse escape */
export const DROPSHIP_COLLAPSE_POSITION = new Vector3(0, 8, -500);

// ============================================================================
// COMBAT CONSTANTS
// ============================================================================

/** Maximum enemies allowed at once */
export const MAX_ENEMIES = 40;

/** Grenade cooldown in milliseconds */
export const GRENADE_COOLDOWN_TIME = 5000;

/** Signal flare cooldown in milliseconds */
export const FLARE_COOLDOWN_TIME = 60000;

/** Mech fire rate (shots per second) */
export const MECH_FIRE_RATE = 0.2;

// ============================================================================
// COLLAPSE TIMING
// ============================================================================

/** Interval between stalactite spawns in seconds */
export const STALACTITE_SPAWN_INTERVAL = 1.5;

/** Interval between collapse rumble sounds in seconds */
export const COLLAPSE_RUMBLE_INTERVAL = 3;

/** Stalactite spawn interval randomization factor (0-1) */
export const STALACTITE_SPAWN_VARIANCE = 0.5; // FIX #25: Add randomization

/** Collapse failure respawn distance from dropship */
export const COLLAPSE_RESPAWN_DISTANCE = 80; // FIX #21: Increased from 40

// ============================================================================
// WAVE CONFIGURATIONS
// ============================================================================

/**
 * Wave configurations - 7 waves with escalating difficulty and variety
 * FIX #3: Added husks to wave 6, improved enemy variety throughout
 * FIX #16: Better spawn diversity with mixed enemy types per wave
 */
export const WAVE_CONFIGS: WaveConfig[] = [
  // Wave 1: Skitterer swarm - fast but weak, teaches basic combat
  {
    drones: 10,
    grunts: 0,
    spitters: 0,
    brutes: 0,
    husks: 0,
    spawnDelay: 0.9,
    waveTitle: 'WAVE 1 - SKITTERER SWARM',
    waveDescription: 'Fast-moving scouts. Keep moving!',
    commsMessage: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: 'First wave incoming! Skitterers - aim for center mass and keep them off the perimeter!',
    },
    supplyDropAfter: true, // FIX #11: Supply drop after first wave
  },
  // Wave 2: Lurkers - slower but tougher, teaches prioritization
  {
    drones: 2, // FIX #16: Added some skitterers for variety
    grunts: 8,
    spitters: 0,
    brutes: 0,
    husks: 0,
    spawnDelay: 1.3,
    waveTitle: 'WAVE 2 - LURKER ASSAULT',
    waveDescription: 'Heavy infantry. Prioritize headshots.',
    commsMessage: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "Lurkers! They're tougher - go for the weak points on their backs!",
    },
    supplyDropAfter: false,
  },
  // Wave 3: Spitter focus - teaches positioning and dodging acid
  {
    drones: 4,
    grunts: 2,
    spitters: 6,
    brutes: 0,
    husks: 0,
    spawnDelay: 1.1,
    waveTitle: 'WAVE 3 - ACID RAIN',
    waveDescription: 'Spitters incoming! Use cover and stay mobile!',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Warning: Acid Spewer signatures detected. Recommend utilizing cover positions.',
    },
    supplyDropAfter: true, // FIX #11: Supply drop mid-game
  },
  // Wave 4: Combined arms - mixed force tests all skills
  {
    drones: 6,
    grunts: 6,
    spitters: 3,
    brutes: 0,
    husks: 2, // FIX #3: Added husks to wave 4
    spawnDelay: 1.0,
    waveTitle: 'WAVE 4 - COMBINED ARMS',
    waveDescription: 'Mixed force assault. Watch all angles!',
    commsMessage: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "Titan's shields just failed! They're hitting us from all sides - prioritize the spitters!",
    },
    supplyDropAfter: false,
  },
  // Wave 5: Broodmother introduction - mini-boss wave
  {
    drones: 4,
    grunts: 4,
    spitters: 2,
    brutes: 2,
    husks: 0,
    spawnDelay: 1.0,
    waveTitle: 'WAVE 5 - HEAVY ASSAULT',
    waveDescription: 'Broodmothers detected! Focus fire on the big ones!',
    commsMessage: {
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Warning: STRAIN-X5 Broodmother signatures detected. These are priority targets.',
    },
    supplyDropAfter: true, // FIX #11: Supply drop before final waves
  },
  // Wave 6: Husk swarm - FIX #3: Actually spawn husks!
  {
    drones: 4,
    grunts: 0,
    spitters: 3,
    brutes: 1,
    husks: 8, // FIX #3: Husks are the focus of this wave
    spawnDelay: 0.6,
    waveTitle: 'WAVE 6 - SCREAMING DEATH',
    waveDescription: 'Husks! Their screams disorient - stay focused!',
    commsMessage: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: 'What the hell is that sound?! Husks! Cover your ears and keep shooting, brother!',
    },
    supplyDropAfter: false,
  },
  // Wave 7: Final overwhelming wave - everything at once
  {
    drones: 12,
    grunts: 8,
    spitters: 5,
    brutes: 3,
    husks: 6, // FIX #3: Husks in final wave too
    spawnDelay: 0.35,
    waveTitle: 'WAVE 7 - FINAL ASSAULT',
    waveDescription: 'EVERYTHING THEY HAVE! HOLD THE LINE!',
    commsMessage: {
      sender: 'Corporal Marcus Cole',
      callsign: 'TITAN',
      portrait: 'marcus',
      text: "This is it, brother! Everything they've got! Autocannons are overheating but I'll give you everything I have left! HOLD THE LINE!",
    },
    supplyDropAfter: false,
  },
];

// ============================================================================
// HEALTH PICKUP CONFIGURATION
// ============================================================================

/**
 * Health pickup positions along collapse escape route
 */
export const COLLAPSE_HEALTH_PICKUP_POSITIONS = [
  new Vector3(10, 0.5, LZ_POSITION.z + 180), // Early pickup
  new Vector3(-15, 0.5, LZ_POSITION.z + 140),
  new Vector3(5, 0.5, LZ_POSITION.z + 100), // Mid-route
  new Vector3(-8, 0.5, LZ_POSITION.z + 60),
  new Vector3(12, 0.5, LZ_POSITION.z + 30), // Near dropship
];

/**
 * Heal amounts for each health pickup
 */
export const COLLAPSE_HEALTH_PICKUP_AMOUNTS = [25, 20, 30, 20, 35];

// ============================================================================
// CRUMBLING WALL CONFIGURATION
// ============================================================================

/**
 * Crumbling wall positions and rotations
 */
export const CRUMBLING_WALL_CONFIGS = [
  { pos: new Vector3(-30, 0, LZ_POSITION.z + 120), rotY: 0.3 },
  { pos: new Vector3(25, 0, LZ_POSITION.z + 80), rotY: -0.2 },
  { pos: new Vector3(-20, 0, LZ_POSITION.z + 50), rotY: 0.4 },
];
