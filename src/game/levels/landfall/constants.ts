/**
 * LandfallLevel Constants
 * All timing, physics, distances, damage values, and configuration constants.
 */

// ---------------------------------------------------------------------------
// GLB Asset Paths
// ---------------------------------------------------------------------------

/** Station-external GLBs used to build the Anchor Station Prometheus */
export const STATION_GLB_PATHS = {
  /** Main hull sections (composed to form the station) */
  hullCenter: '/assets/models/environment/station-external/station01.glb',
  hullRingA: '/assets/models/environment/station-external/station02.glb',
  hullRingB: '/assets/models/environment/station-external/station03.glb',
  solarWing: '/assets/models/environment/station-external/station04.glb',
  dockingBay: '/assets/models/environment/station-external/station05.glb',
  antenna: '/assets/models/environment/station-external/station06.glb',
} as const;

/** Props used in the combat arena for cover and environmental detail */
export const ARENA_GLB_PATHS = {
  /** Natural cover -- alien boulder formations */
  boulderA: '/assets/models/environment/alien-flora/alien_boulder_polyhaven.glb',
  rockMedA: '/assets/models/environment/alien-flora/alien_rock_medium_1.glb',
  rockMedB: '/assets/models/environment/alien-flora/alien_rock_medium_2.glb',
  rockMedC: '/assets/models/environment/alien-flora/alien_rock_medium_3.glb',
  /** Crashed debris -- shipping container as hull wreckage */
  shippingContainer: '/assets/models/environment/industrial/shipping_container_mx_1.glb',
  /** Metallic wing debris */
  scrapMetalA: '/assets/models/props/containers/scrap_metal_mx_1.glb',
  scrapMetalB: '/assets/models/props/containers/scrap_metal_mx_1_1.glb',
  scrapMetalC: '/assets/models/props/containers/scrap_metal_mx_1_2.glb',
  /** Metal barrels for additional cover detail */
  metalBarrel: '/assets/models/props/containers/metal_barrel_hr_1.glb',
} as const;

/** GLB paths for surface environment (LZ pad, canyon walls) */
export const SURFACE_GLB_PATHS = {
  /** Landing zone asphalt pad */
  lzPadAsphalt: '/assets/models/environment/station/asphalt_hr_1_large.glb',
  /** Canyon wall segments */
  wallRg1: '/assets/models/environment/station/wall_rg_1.glb',
  wallRg15: '/assets/models/environment/station/wall_rg_15.glb',
  wallHs1: '/assets/models/environment/station/wall_hs_1.glb',
  wallHs15: '/assets/models/environment/station/wall_hs_15.glb',
} as const;

/** GLB paths for asteroid belt debris (alien rocks) */
export const ASTEROID_GLB_PATHS = {
  rockMedium1: '/assets/models/environment/alien-flora/alien_rock_medium_1.glb',
  rockMedium2: '/assets/models/environment/alien-flora/alien_rock_medium_2.glb',
  rockMedium3: '/assets/models/environment/alien-flora/alien_rock_medium_3.glb',
  rockTall1: '/assets/models/environment/alien-flora/alien_tall_rock_1_01.glb',
  rockTall2: '/assets/models/environment/alien-flora/alien_tall_rock_2_01.glb',
  rockTall3: '/assets/models/environment/alien-flora/alien_tall_rock_3_01.glb',
  boulder: '/assets/models/environment/alien-flora/alien_boulder_polyhaven.glb',
} as const;

/** GLB paths for spaceships visible during HALO drop */
export const SPACESHIP_GLB_PATHS = {
  // Human military ships (distant friendlies)
  challenger: '/assets/models/spaceships/Challenger.glb',
  dispatcher: '/assets/models/spaceships/Dispatcher.glb',
  imperial: '/assets/models/spaceships/Imperial.glb',
  striker: '/assets/models/spaceships/Striker.glb',
  zenith: '/assets/models/spaceships/Zenith.glb',
  // Alien/hostile ships (threats)
  executioner: '/assets/models/spaceships/Executioner.glb',
  insurgent: '/assets/models/spaceships/Insurgent.glb',
  omen: '/assets/models/spaceships/Omen.glb',
  spitfire: '/assets/models/spaceships/Spitfire.glb',
} as const;

/** GLB paths for drop pod / capsule during powered descent */
export const DROP_POD_GLB_PATHS = {
  /** Sci-fi escape/drop pod for player's HALO drop */
  dropPod: '/assets/models/environment/modular/Props_Pod.glb',
  /** Alternative capsule design */
  capsule: '/assets/models/environment/modular/Props_Capsule.glb',
  /** Cylindrical vessel for drop pod interior frame */
  vesselFrame: '/assets/models/environment/modular/Props_Vessel.glb',
} as const;

/** Collect all unique GLB paths that need preloading */
export const ALL_LANDFALL_GLB_PATHS: string[] = [
  ...Object.values(STATION_GLB_PATHS),
  ...Object.values(ARENA_GLB_PATHS),
  ...Object.values(SURFACE_GLB_PATHS),
  ...Object.values(ASTEROID_GLB_PATHS),
  ...Object.values(SPACESHIP_GLB_PATHS),
  ...Object.values(DROP_POD_GLB_PATHS),
];

// ---------------------------------------------------------------------------
// Camera FOV Settings (in radians)
// ---------------------------------------------------------------------------

/** Wide cinematic FOV during freefall for dramatic ODST-style drop (~100 degrees) */
export const FREEFALL_FOV = 1.75;

/** Still dramatic FOV during powered descent (~80 degrees) */
export const POWERED_DESCENT_FOV = 1.4;

/** Standard FPS FOV on surface (~90 degrees) */
export const SURFACE_FOV = Math.PI / 2; // 1.5708 radians = 90 degrees

// ---------------------------------------------------------------------------
// Terrain Constants
// ---------------------------------------------------------------------------

/** Player eye height above terrain */
export const MIN_PLAYER_HEIGHT = 1.7;

/** Half of terrain size (600/2 - margin) */
export const TERRAIN_BOUNDS = 280;

// ---------------------------------------------------------------------------
// Fuel System Constants
// ---------------------------------------------------------------------------

/** Maximum fuel capacity */
export const MAX_FUEL = 100;

/** Fuel consumption rate per second when boosting */
export const FUEL_BURN_RATE = 8;

/** Passive fuel regeneration rate */
export const FUEL_REGEN_RATE = 2;

// ---------------------------------------------------------------------------
// Landing Zone Constants
// ---------------------------------------------------------------------------

/** Perfect landing zone radius */
export const LZ_RADIUS = 8;

/** Near miss zone radius */
export const NEAR_MISS_RADIUS = 25;

/** Maximum drift before slingshot */
export const MAX_DRIFT = 100;

// ---------------------------------------------------------------------------
// Station Animation Constants
// ---------------------------------------------------------------------------

/** Initial distance of Anchor Station above player */
export const STATION_INITIAL_DISTANCE = 50;

/** How fast the station appears to recede */
export const STATION_RECEDE_SPEED = 8;

// ---------------------------------------------------------------------------
// Near-Miss Feedback Constants
// ---------------------------------------------------------------------------

/** Seconds between near-miss alerts */
export const NEAR_MISS_COOLDOWN = 0.5;

// ---------------------------------------------------------------------------
// Surface Combat Constants
// ---------------------------------------------------------------------------

/** Enemy species for surface combat */
export const SURFACE_ENEMY_SPECIES = 'skitterer' as const;

/** Scale of surface enemy models */
export const SURFACE_ENEMY_SCALE = 0.5;

/** Maximum surface enemies at once */
export const MAX_SURFACE_ENEMIES = 6;

// ---------------------------------------------------------------------------
// Combat Cooldown Constants
// ---------------------------------------------------------------------------

/** Milliseconds between melee attacks */
export const MELEE_COOLDOWN = 0.8;

/** Milliseconds between shots */
export const PRIMARY_FIRE_COOLDOWN = 0.15;

/** Melee attack damage */
export const MELEE_DAMAGE = 40;

/** Melee attack range */
export const MELEE_RANGE = 2.5;

/** Primary fire damage */
export const PRIMARY_FIRE_DAMAGE = 25;

/** Primary fire range */
export const PRIMARY_FIRE_RANGE = 50;

// ---------------------------------------------------------------------------
// Environment Hazard Constants
// ---------------------------------------------------------------------------

/** Damage interval in seconds when in acid */
export const ACID_DAMAGE_INTERVAL = 0.5;

/** Damage per tick in acid */
export const ACID_DAMAGE = 8;

// ---------------------------------------------------------------------------
// Tutorial Constants
// ---------------------------------------------------------------------------

/** First encounter enemy count (small group of 3-4 Chitin Drones) */
export const FIRST_ENCOUNTER_ENEMY_COUNT = 4;

/** Duration of tutorial slowdown in seconds */
export const TUTORIAL_SLOWDOWN_DURATION = 8;

// ---------------------------------------------------------------------------
// Acid Pool Positions
// ---------------------------------------------------------------------------

export const ACID_POOL_POSITIONS = [
  { x: 25, z: 18, radius: 3.5 },
  { x: -22, z: 28, radius: 2.8 },
  { x: 12, z: 40, radius: 2.2 },
  { x: -8, z: 12, radius: 1.8 },
] as const;

// ---------------------------------------------------------------------------
// Unstable Terrain Positions
// ---------------------------------------------------------------------------

export const UNSTABLE_TERRAIN_POSITIONS = [
  { x: 5, z: 35, size: 6 },
  { x: -15, z: 22, size: 5 },
  { x: 18, z: 30, size: 4 },
] as const;

// ---------------------------------------------------------------------------
// Performance / LOD Constants
// ---------------------------------------------------------------------------

/** Distance at which environment objects start to fade (meters) */
export const LOD_FADE_START = 150;

/** Distance at which environment objects are fully culled (meters) */
export const LOD_CULL_DISTANCE = 250;

/** Distance for reduced detail on GLB models */
export const LOD_DETAIL_DISTANCE = 80;

// ---------------------------------------------------------------------------
// Additional Cover Positions for Combat Arena
// ---------------------------------------------------------------------------

/** Additional rock cover positions for tactical gameplay */
export const ADDITIONAL_COVER_POSITIONS = [
  // Flanking positions
  { x: 25, z: 10, scale: 1.8, rotY: 0.5, type: 'rock' as const },
  { x: -25, z: 12, scale: 2.0, rotY: -0.3, type: 'rock' as const },
  // Forward cover near enemy spawn
  { x: 0, z: 40, scale: 2.2, rotY: 0.8, type: 'debris' as const },
  { x: 12, z: 45, scale: 1.5, rotY: -0.6, type: 'rock' as const },
  { x: -14, z: 42, scale: 1.7, rotY: 0.4, type: 'rock' as const },
  // Rear cover near LZ
  { x: 8, z: -5, scale: 1.4, rotY: 1.2, type: 'barrel' as const },
  { x: -6, z: -8, scale: 1.6, rotY: -0.9, type: 'crate' as const },
] as const;

// ---------------------------------------------------------------------------
// Audio Constants
// ---------------------------------------------------------------------------

/** Wind ambience volume on surface */
export const SURFACE_WIND_VOLUME = 0.4;

/** Distance for spatial audio falloff */
export const SPATIAL_AUDIO_FALLOFF = 50;

/** Drop music fade duration (ms) */
export const DROP_MUSIC_FADE_DURATION = 2000;

// ---------------------------------------------------------------------------
// Objective Marker Constants
// ---------------------------------------------------------------------------

/** FOB Delta objective position */
export const FOB_DELTA_POSITION = { x: 0, y: 0, z: -150 } as const;

/** LZ pad center position */
export const LZ_CENTER_POSITION = { x: 0, y: 0, z: 0 } as const;

/** Beacon pulse animation speed */
export const BEACON_PULSE_SPEED = 2.0;

// ---------------------------------------------------------------------------
// Camera Constants
// ---------------------------------------------------------------------------

/** Camera shake during landing impact */
export const LANDING_SHAKE_INTENSITY = 4.0;

/** Camera shake during seismic warning */
export const SEISMIC_SHAKE_INTENSITY = 2.0;

/** Camera rotation animation duration (frames at 60fps) */
export const CAMERA_ROTATION_FRAMES = 48;
