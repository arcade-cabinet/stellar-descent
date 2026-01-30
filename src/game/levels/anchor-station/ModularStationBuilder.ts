import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

// ============================================================================
// MODULAR STATION BUILDER
// ============================================================================
// Uses GLB corridor segments (4.0 units per segment) to construct the station
// All corridors snap together at 4-unit intervals on the Y axis
// ============================================================================

// Corridor module size (from asset analysis)
const MODULE_LENGTH = 4.0; // Y-axis length per corridor segment
const MODULE_WIDTH = 5.55; // X-axis width
const MODULE_HEIGHT = 3.09; // Z-axis height (becomes Y in Babylon)

// Model paths (reorganized asset structure)
const MODELS = {
  corridorMain: '/models/environment/station/corridor_main.glb',
  corridorJunction: '/models/environment/station/corridor_junction.glb',
  corridorCorner: '/models/environment/station/corridor_corner.glb',
  corridorWide: '/models/environment/station/corridor_wide.glb',
  stationDoor: '/models/environment/station/station_door.glb',
  stationBarrel: '/models/environment/station/station_barrel.glb',
  // Additional station pieces
  wall: '/models/environment/station/wall_hr_1_double.glb',
  doorway: '/models/environment/station/doorway_hr_1.glb',
  floorCeiling: '/models/environment/station/floor_ceiling_hr_1.glb',
  beam: '/models/environment/station/beam_hc_vertical_1.glb',
  pipe: '/models/environment/station/pipe_cx_1.glb',
};

// Station layout definition
export interface StationSegment {
  type: 'main' | 'junction' | 'corner' | 'wide';
  position: Vector3; // World position
  rotation: number; // Y rotation in radians
  name: string; // For collision/identification
}

export interface StationLayout {
  segments: StationSegment[];
  spawnPoint: Vector3;
  rooms: RoomDefinition[];
}

export interface RoomDefinition {
  name: string;
  center: Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  connectedTo: string[];
}

// ============================================================================
// ANCHOR STATION PROMETHEUS - DELIBERATE LAYOUT DESIGN
// ============================================================================
// A rotating staging base where Hell Jumpers prepare for deployment.
// Cool blue lighting for psychological calm during long deployments.
//
// NARRATIVE FLOW (Critical Path):
//   Briefing → Corridor → Equipment/Armory → HOLODECK → Shooting Range → Hangar
//
// The HOLODECK is key - it's where players learn platforming controls!
// VR training room that procedurally generates platforms, teaches jump/crouch.
// Science Officer: "Before planetfall, run through movement calibration in the holodeck."
//
// EXPLORATION AREAS (Optional - reward curiosity):
//   - Observation Deck: View of Proxima Centauri b below
//   - Biosphere: Living plants, contrast to metal corridors
//   - Engine Room: Industrial machinery, station power
//   - Crew Quarters: Personal touches, marine bunks
//   - Medical Bay: First aid station
//
// ┌───────────────┐                           ┌───────────────┐
// │  OBSERVATION  │                           │   ENGINE      │
// │     DECK      │                           │    ROOM       │
// │   (scenic)    │                           │  (machinery)  │
// └───────┬───────┘                           └───────┬───────┘
//         │                                           │
//         │         ┌─────────────────┐               │
//         └─────────┤   BRIEFING      ├───────────────┘
//                   │     ROOM        │
//                   └────────┬────────┘
//                            │
//      ┌─────────────────────┼─────────────────────┐
//      │                     │                     │
// ┌────┴────┐       ┌────────┴────────┐       ┌────┴────┐
// │ CREW    │       │   CORRIDOR A    │       │ MEDICAL │
// │QUARTERS │       │                 │       │   BAY   │
// └─────────┘       └────────┬────────┘       └─────────┘
//                            │
//            ┌───────────────┼───────────────┐
//            │               │               │
//    ┌───────┴───────┐       │       ┌───────┴───────┐
//    │   EQUIPMENT   │       │       │    ARMORY     │
//    │      BAY      │       │       │   (Weapons)   │
//    └───────────────┘       │       └───────────────┘
//                            │
//                   ┌────────┴────────┐
//                   │   BIOSPHERE     │  ← Living plants (optional)
//                   └────────┬────────┘
//                            │
//           ┌────────────────┴────────────────┐
//           │            HOLODECK             │  ← VR TRAINING (REQUIRED)
//           │   ┌──────────────────────┐      │    Procedural platforms
//           │   │  ▓▓▓    ▓▓▓    ▓▓▓  │      │    Teaches: jump, crouch,
//           │   │     ▓▓▓    ▓▓▓      │      │    movement, look controls
//           │   │  ▓▓▓    ▓▓▓    ▓▓▓  │      │
//           │   └──────────────────────┘      │    Platforms materialize
//           └────────────────┬────────────────┘    and vanish!
//                            │
//                   ┌────────┴────────┐
//                   │  SHOOTING RANGE │  ← Weapons training
//                   └────────┬────────┘
//                            │
//                   ┌────────┴────────┐
//                   │   HANGAR BAY    │  → Launch to Landfall
//                   └─────────────────┘
// ============================================================================

export const ANCHOR_STATION_LAYOUT: StationLayout = {
  spawnPoint: new Vector3(0, 1.5, 2), // Slightly back in briefing room, facing south
  segments: [
    // ========================================================================
    // BRIEFING ROOM - Where it all begins
    // ========================================================================
    { type: 'wide', position: new Vector3(0, 0, 0), rotation: 0, name: 'briefing_center' },
    { type: 'main', position: new Vector3(0, 0, 4), rotation: 0, name: 'briefing_north' },
    { type: 'main', position: new Vector3(-4, 0, 0), rotation: 0, name: 'briefing_west' },
    { type: 'main', position: new Vector3(4, 0, 0), rotation: 0, name: 'briefing_east' },

    // ========================================================================
    // OBSERVATION DECK - Northwest of briefing (SCENIC/OPTIONAL)
    // Panoramic window overlooking Proxima Centauri b
    // SECRET: Data pad with intel on Chitin movements
    // ========================================================================
    { type: 'corner', position: new Vector3(-4, 0, 4), rotation: 0, name: 'obs_corner' },
    { type: 'main', position: new Vector3(-8, 0, 4), rotation: Math.PI / 2, name: 'obs_hall' },
    { type: 'wide', position: new Vector3(-12, 0, 4), rotation: Math.PI / 2, name: 'obs_deck' },

    // ========================================================================
    // ENGINE ROOM - Northeast of briefing (EXPLORATION)
    // Humming generators, industrial machinery
    // SECRET: Hidden supply cache behind machinery
    // ========================================================================
    { type: 'corner', position: new Vector3(4, 0, 4), rotation: Math.PI, name: 'engine_corner' },
    { type: 'main', position: new Vector3(8, 0, 4), rotation: Math.PI / 2, name: 'engine_hall' },
    { type: 'wide', position: new Vector3(12, 0, 4), rotation: Math.PI / 2, name: 'engine_room' },

    // ========================================================================
    // CORRIDOR A - Main spine going south
    // ========================================================================
    { type: 'main', position: new Vector3(0, 0, -4), rotation: 0, name: 'corridor_1' },
    { type: 'junction', position: new Vector3(0, 0, -8), rotation: 0, name: 'corridor_junction1' },
    { type: 'main', position: new Vector3(0, 0, -12), rotation: 0, name: 'corridor_2' },
    { type: 'junction', position: new Vector3(0, 0, -16), rotation: 0, name: 'corridor_junction2' },
    { type: 'main', position: new Vector3(0, 0, -20), rotation: 0, name: 'corridor_3' },

    // ========================================================================
    // CREW QUARTERS - West of first junction (EXPLORATION)
    // Marine bunks, personal lockers
    // SECRET: Marcus's locker with family photo, audio log about the mission
    // ========================================================================
    {
      type: 'corner',
      position: new Vector3(-4, 0, -8),
      rotation: Math.PI / 2,
      name: 'crew_corner',
    },
    { type: 'main', position: new Vector3(-8, 0, -8), rotation: Math.PI / 2, name: 'crew_hall' },
    {
      type: 'wide',
      position: new Vector3(-12, 0, -8),
      rotation: Math.PI / 2,
      name: 'crew_quarters',
    },

    // ========================================================================
    // MEDICAL BAY - East of first junction (EXPLORATION)
    // First aid supplies, containment pod
    // SECRET: Dead Chitin specimen in containment (foreshadowing!)
    // ========================================================================
    { type: 'corner', position: new Vector3(4, 0, -8), rotation: -Math.PI / 2, name: 'med_corner' },
    { type: 'main', position: new Vector3(8, 0, -8), rotation: Math.PI / 2, name: 'med_hall' },
    { type: 'wide', position: new Vector3(12, 0, -8), rotation: Math.PI / 2, name: 'medical_bay' },

    // ========================================================================
    // EQUIPMENT BAY - West of second junction (REQUIRED - get suit)
    // ========================================================================
    {
      type: 'corner',
      position: new Vector3(-4, 0, -16),
      rotation: Math.PI / 2,
      name: 'equip_corner',
    },
    { type: 'main', position: new Vector3(-8, 0, -16), rotation: Math.PI / 2, name: 'equip_hall' },
    { type: 'wide', position: new Vector3(-12, 0, -16), rotation: Math.PI / 2, name: 'equip_bay' },

    // ========================================================================
    // ARMORY - East of second junction (REQUIRED - get weapons)
    // SECRET: Memorial wall with names of fallen marines
    // ========================================================================
    {
      type: 'corner',
      position: new Vector3(4, 0, -16),
      rotation: -Math.PI / 2,
      name: 'armory_corner',
    },
    { type: 'main', position: new Vector3(8, 0, -16), rotation: Math.PI / 2, name: 'armory_hall' },
    { type: 'wide', position: new Vector3(12, 0, -16), rotation: Math.PI / 2, name: 'armory_bay' },

    // ========================================================================
    // BIOSPHERE - Side alcove (EXPLORATION/OPTIONAL)
    // Living plants, terraforming research
    // SECRET: Holographic display of terraforming progress for Kepler's Promise
    // ========================================================================
    { type: 'junction', position: new Vector3(0, 0, -24), rotation: 0, name: 'bio_junction' },
    {
      type: 'corner',
      position: new Vector3(-4, 0, -24),
      rotation: Math.PI / 2,
      name: 'bio_corner',
    },
    { type: 'wide', position: new Vector3(-8, 0, -24), rotation: Math.PI / 2, name: 'biosphere' },

    // ========================================================================
    // HOLODECK - VR Training Room (REQUIRED - platforming tutorial)
    // ========================================================================
    // This is where players learn movement controls before deployment:
    // - Desktop/Laptop: WASD movement, mouse look, SPACE jump, CTRL crouch
    // - Mobile/Tablet: Left joystick, right touch area, on-screen buttons
    //
    // The room starts as an empty grid, then MOTHER/Science Officer activates
    // the training program. Platforms materialize and vanish, teaching:
    // 1. Basic movement and camera control
    // 2. Jumping between platforms
    // 3. Crouching under obstacles
    // 4. Timed platforming sequences
    // ========================================================================
    { type: 'main', position: new Vector3(0, 0, -28), rotation: 0, name: 'holo_entry' },
    { type: 'wide', position: new Vector3(0, 0, -32), rotation: 0, name: 'holo_center' },
    { type: 'wide', position: new Vector3(-4, 0, -32), rotation: Math.PI / 2, name: 'holo_west' },
    { type: 'wide', position: new Vector3(4, 0, -32), rotation: Math.PI / 2, name: 'holo_east' },
    { type: 'wide', position: new Vector3(0, 0, -36), rotation: 0, name: 'holo_south' },
    { type: 'main', position: new Vector3(0, 0, -40), rotation: 0, name: 'holo_exit' },

    // ========================================================================
    // SHOOTING RANGE - Weapons training
    // Wide corridors for firing lane
    // ========================================================================
    { type: 'wide', position: new Vector3(0, 0, -44), rotation: 0, name: 'range_entry' },
    { type: 'wide', position: new Vector3(0, 0, -48), rotation: 0, name: 'range_1' },
    { type: 'wide', position: new Vector3(0, 0, -52), rotation: 0, name: 'range_2' },
    { type: 'wide', position: new Vector3(0, 0, -56), rotation: 0, name: 'range_3' },
    { type: 'main', position: new Vector3(0, 0, -60), rotation: 0, name: 'range_end' },

    // ========================================================================
    // HANGAR BAY - Final destination
    // Drop pod awaits
    // ========================================================================
    { type: 'junction', position: new Vector3(0, 0, -64), rotation: 0, name: 'hangar_entry' },
    { type: 'wide', position: new Vector3(0, 0, -68), rotation: 0, name: 'hangar_center' },
    { type: 'wide', position: new Vector3(0, 0, -72), rotation: 0, name: 'hangar_south' },
    { type: 'wide', position: new Vector3(-4, 0, -68), rotation: Math.PI / 2, name: 'hangar_west' },
    { type: 'wide', position: new Vector3(4, 0, -68), rotation: Math.PI / 2, name: 'hangar_east' },
    { type: 'main', position: new Vector3(0, 0, -76), rotation: 0, name: 'hangar_pod_bay' },
  ],
  rooms: [
    // CRITICAL PATH ROOMS
    {
      name: 'briefing',
      center: new Vector3(0, 0, 0),
      bounds: { minX: -6, maxX: 6, minZ: -2, maxZ: 6 },
      connectedTo: ['corridorA', 'observation', 'engine'],
    },
    {
      name: 'corridorA',
      center: new Vector3(0, 0, -14),
      bounds: { minX: -2, maxX: 2, minZ: -26, maxZ: -2 },
      connectedTo: [
        'briefing',
        'crewQuarters',
        'medical',
        'equipment',
        'armory',
        'biosphere',
        'holodeck',
      ],
    },
    {
      name: 'equipment',
      center: new Vector3(-10, 0, -16),
      bounds: { minX: -15, maxX: -2, minZ: -20, maxZ: -12 },
      connectedTo: ['corridorA'],
    },
    {
      name: 'armory',
      center: new Vector3(10, 0, -16),
      bounds: { minX: 2, maxX: 15, minZ: -20, maxZ: -12 },
      connectedTo: ['corridorA'],
    },
    {
      name: 'holodeck',
      center: new Vector3(0, 0, -34),
      bounds: { minX: -8, maxX: 8, minZ: -42, maxZ: -26 },
      connectedTo: ['corridorA', 'shootingRange'],
    },
    {
      name: 'shootingRange',
      center: new Vector3(0, 0, -52),
      bounds: { minX: -4, maxX: 4, minZ: -62, maxZ: -42 },
      connectedTo: ['holodeck', 'hangar'],
    },
    {
      name: 'hangar',
      center: new Vector3(0, 0, -70),
      bounds: { minX: -8, maxX: 8, minZ: -78, maxZ: -62 },
      connectedTo: ['shootingRange'],
    },
    // EXPLORATION ROOMS (OPTIONAL)
    {
      name: 'observation',
      center: new Vector3(-10, 0, 4),
      bounds: { minX: -15, maxX: -2, minZ: 0, maxZ: 8 },
      connectedTo: ['briefing'],
    },
    {
      name: 'engine',
      center: new Vector3(10, 0, 4),
      bounds: { minX: 2, maxX: 15, minZ: 0, maxZ: 8 },
      connectedTo: ['briefing'],
    },
    {
      name: 'crewQuarters',
      center: new Vector3(-10, 0, -8),
      bounds: { minX: -15, maxX: -2, minZ: -12, maxZ: -4 },
      connectedTo: ['corridorA'],
    },
    {
      name: 'medical',
      center: new Vector3(10, 0, -8),
      bounds: { minX: 2, maxX: 15, minZ: -12, maxZ: -4 },
      connectedTo: ['corridorA'],
    },
    {
      name: 'biosphere',
      center: new Vector3(-6, 0, -24),
      bounds: { minX: -12, maxX: -2, minZ: -28, maxZ: -20 },
      connectedTo: ['corridorA'],
    },
  ],
};

// ============================================================================
// DISCOVERY POINTS - Secrets and collectibles
// ============================================================================
export interface DiscoveryPoint {
  id: string;
  room: string;
  position: Vector3;
  type: 'datapad' | 'audio_log' | 'supply_cache' | 'scenic' | 'lore' | 'easter_egg';
  title: string;
  description: string;
}

export const DISCOVERY_POINTS: DiscoveryPoint[] = [
  // OBSERVATION DECK
  {
    id: 'obs_view',
    room: 'observation',
    position: new Vector3(-14, 1.5, 4),
    type: 'scenic',
    title: "Kepler's Promise",
    description:
      'The alien world hangs in space below, red deserts and purple mountains. Your brother is down there somewhere.',
  },
  {
    id: 'obs_datapad',
    room: 'observation',
    position: new Vector3(-12, 1, 6),
    type: 'datapad',
    title: 'Chitin Movement Patterns',
    description:
      'Intel report: Strain-X activity increasing near FOB Delta. Recommend immediate investigation.',
  },

  // ENGINE ROOM
  {
    id: 'engine_cache',
    room: 'engine',
    position: new Vector3(14, 0.5, 6),
    type: 'supply_cache',
    title: 'Hidden Ammo Stash',
    description:
      'Someone tucked extra magazines behind the secondary coolant pump. Finders keepers.',
  },

  // CREW QUARTERS
  {
    id: 'marcus_locker',
    room: 'crewQuarters',
    position: new Vector3(-14, 1.2, -8),
    type: 'lore',
    title: "Marcus's Locker",
    description:
      'A photo taped inside: you and Marcus as kids, both in toy marine helmets. "Brothers to the end - M"',
  },
  {
    id: 'crew_audio',
    room: 'crewQuarters',
    position: new Vector3(-10, 1, -6),
    type: 'audio_log',
    title: 'Recon Team Vanguard',
    description:
      'Audio log from Marcus: "We found something in the caves. Not just bugs - structures. They\'re building something."',
  },

  // MEDICAL BAY
  {
    id: 'chitin_specimen',
    room: 'medical',
    position: new Vector3(14, 1, -8),
    type: 'lore',
    title: 'Containment Pod 7',
    description:
      'A dead Chitin drone floats in preservation fluid. Its carapace glistens with an oily sheen. The mandibles twitch occasionally - nervous system still firing.',
  },

  // ARMORY
  {
    id: 'memorial_wall',
    room: 'armory',
    position: new Vector3(14, 1.5, -14),
    type: 'lore',
    title: 'Memorial Wall',
    description:
      "Names etched in brass. Thirty-seven Hell Jumpers lost since planetfall. Recon Team Vanguard is listed as MIA, not KIA. There's still hope.",
  },

  // BIOSPHERE
  {
    id: 'bio_terraforming',
    room: 'biosphere',
    position: new Vector3(-10, 1.5, -24),
    type: 'scenic',
    title: 'Terraforming Progress',
    description:
      'Holographic display: "Project Eden - 0.3% atmospheric conversion complete. Estimated time to habitable: 847 years." The plants here are the first step.',
  },

  // HANGAR - EASTER EGG
  {
    id: 'hangar_graffiti',
    room: 'hangar',
    position: new Vector3(6, 2, -50),
    type: 'easter_egg',
    title: 'Marine Wisdom',
    description:
      'Scratched into the wall: "BUGS SUCK" with a tally of 47 kills. Below it: "Get some, Hammer! - Specter"',
  },
];

// Room positions for tutorial system and interaction points
export const MODULAR_ROOM_POSITIONS = {
  // CRITICAL PATH
  briefingRoom: new Vector3(0, 1.5, 2),
  corridorA: new Vector3(0, 1.5, -14),
  equipmentBay: new Vector3(-10, 1.5, -16),
  suitLocker: new Vector3(-12, 1.5, -16),
  armory: new Vector3(10, 1.5, -16),
  weaponRack: new Vector3(12, 1.5, -16),

  // HOLODECK - Platforming training
  holodeckEntry: new Vector3(0, 1.5, -28),
  holodeckCenter: new Vector3(0, 1.5, -34),
  holodeckExit: new Vector3(0, 1.5, -40),

  // SHOOTING RANGE
  shootingRange: new Vector3(0, 1.5, -52),
  shootingPosition: new Vector3(0, 1.5, -48),

  // HANGAR
  hangarEntry: new Vector3(0, 1.5, -64),
  hangarBay: new Vector3(0, 1.5, -70),
  dropPod: new Vector3(0, 1.5, -76),

  // EXPLORATION AREAS
  observationDeck: new Vector3(-12, 1.5, 4),
  observationWindow: new Vector3(-14, 1.5, 4),
  engineRoom: new Vector3(12, 1.5, 4),
  crewQuarters: new Vector3(-12, 1.5, -8),
  marcusLocker: new Vector3(-14, 1.5, -8),
  medicalBay: new Vector3(12, 1.5, -8),
  chitinSpecimen: new Vector3(14, 1.5, -8),
  biosphere: new Vector3(-8, 1.5, -24),
  terraformDisplay: new Vector3(-10, 1.5, -24),
};

// ============================================================================
// ROOM ATMOSPHERE DEFINITIONS
// Each room has a distinct emotional feel
// ============================================================================
export interface RoomAtmosphere {
  name: string;
  ambientColor: { r: number; g: number; b: number }; // RGB 0-1
  intensity: number;
  description: string; // For dev reference
}

export const ROOM_ATMOSPHERES: Record<string, RoomAtmosphere> = {
  briefing: {
    name: 'Briefing Room',
    ambientColor: { r: 0.7, g: 0.8, b: 1.0 }, // Cool blue - professional
    intensity: 0.8,
    description:
      "Focused, professional. MOTHER's screens cast soft glow. The calm before the storm.",
  },
  observation: {
    name: 'Observation Deck',
    ambientColor: { r: 0.4, g: 0.5, b: 0.8 }, // Deep blue - contemplative
    intensity: 0.4,
    description:
      'Dim lighting lets the view dominate. Stars and the alien world fill the window. Awe-inspiring.',
  },
  engine: {
    name: 'Engine Room',
    ambientColor: { r: 0.9, g: 0.7, b: 0.5 }, // Warm amber - industrial
    intensity: 0.7,
    description: 'Warm from machinery. Rhythmic hum of generators. Industrial and alive.',
  },
  crewQuarters: {
    name: 'Crew Quarters',
    ambientColor: { r: 0.8, g: 0.75, b: 0.7 }, // Soft warm - homey
    intensity: 0.5,
    description: 'Subdued, personal. This is where marines sleep. Photos, personal effects. Human.',
  },
  medical: {
    name: 'Medical Bay',
    ambientColor: { r: 0.9, g: 0.95, b: 1.0 }, // Clinical white-blue
    intensity: 0.9,
    description: 'Harsh, clinical. The containment pod glows ominously. Something is wrong here.',
  },
  equipment: {
    name: 'Equipment Bay',
    ambientColor: { r: 0.7, g: 0.8, b: 0.7 }, // Slight green - utilitarian
    intensity: 0.7,
    description: 'Functional. Rows of suits and gear. The smell of polymer and gun oil.',
  },
  armory: {
    name: 'Armory',
    ambientColor: { r: 0.8, g: 0.6, b: 0.5 }, // Warm brass - serious
    intensity: 0.6,
    description: 'Weapons gleam in soft light. The memorial wall demands respect. Serious place.',
  },
  biosphere: {
    name: 'Biosphere',
    ambientColor: { r: 0.5, g: 0.9, b: 0.6 }, // Green - alive
    intensity: 0.7,
    description:
      'Living green in a metal world. Plants reach toward UV lights. Hope for the future.',
  },
  shootingRange: {
    name: 'Shooting Range',
    ambientColor: { r: 0.9, g: 0.85, b: 0.7 }, // Bright warm - active
    intensity: 0.9,
    description: 'Well-lit for accuracy. Spent brass smell. Where marines prove themselves.',
  },
  hangar: {
    name: 'Hangar Bay',
    ambientColor: { r: 0.5, g: 0.6, b: 0.8 }, // Cool industrial
    intensity: 0.6,
    description: 'Cavernous. The drop pod waits, silent and deadly. Point of no return.',
  },
  corridorA: {
    name: 'Main Corridor',
    ambientColor: { r: 0.6, g: 0.7, b: 0.9 }, // Blue - calming
    intensity: 0.5,
    description: 'Transit space. Blue accent lighting guides the way. Station heartbeat.',
  },
};

export interface ModularStationResult {
  root: TransformNode;
  meshes: AbstractMesh[];
  layout: StationLayout;
  dispose: () => void;
}

// Timeout for loading individual models (10 seconds)
const MODEL_LOAD_TIMEOUT_MS = 10000;

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`[loadModel] Timeout loading ${name} after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Load a GLB model and return its meshes
 */
async function loadModel(
  scene: Scene,
  modelPath: string,
  position: Vector3,
  rotation: number,
  name: string
): Promise<AbstractMesh[]> {
  console.log(`[loadModel] Loading ${name} from ${modelPath}`);
  const result = await withTimeout(
    SceneLoader.ImportMeshAsync('', modelPath, '', scene),
    MODEL_LOAD_TIMEOUT_MS,
    name
  );
  console.log(`[loadModel] Loaded ${name} - ${result.meshes.length} meshes`);

  // Create parent transform for positioning
  const parent = new TransformNode(name, scene);
  parent.position = position;
  parent.rotation.y = rotation;

  // Parent all meshes and set up
  for (const mesh of result.meshes) {
    // Only re-parent root meshes (those without a parent or with __root__ parent)
    if (mesh.parent === null || mesh.parent?.name === '__root__') {
      mesh.parent = parent;
    }
    mesh.receiveShadows = true;
    mesh.checkCollisions = true;
  }

  return result.meshes;
}

/**
 * Build the modular station from GLB segments
 */
export async function buildModularStation(
  scene: Scene,
  layout: StationLayout = ANCHOR_STATION_LAYOUT
): Promise<ModularStationResult> {
  console.log('[ModularStationBuilder] Starting station build, segments:', layout.segments.length);
  const root = new TransformNode('AnchorStation', scene);
  const allMeshes: AbstractMesh[] = [];

  // Map segment types to model paths
  const typeToModel: Record<StationSegment['type'], string> = {
    main: MODELS.corridorMain,
    junction: MODELS.corridorJunction,
    corner: MODELS.corridorCorner,
    wide: MODELS.corridorWide,
  };

  console.log('[ModularStationBuilder] Loading', layout.segments.length, 'segments...');
  // Load all segments
  const loadPromises = layout.segments.map(async (segment) => {
    const modelPath = typeToModel[segment.type];
    try {
      const meshes = await loadModel(
        scene,
        modelPath,
        segment.position,
        segment.rotation,
        segment.name
      );
      allMeshes.push(...meshes);
      return meshes;
    } catch (error) {
      console.warn(`[ModularStationBuilder] Failed to load segment ${segment.name}:`, error);
      return [];
    }
  });

  console.log('[ModularStationBuilder] Waiting for all segments to load...');
  await Promise.all(loadPromises);
  console.log('[ModularStationBuilder] All segments loaded, total meshes:', allMeshes.length);

  // Parent all to root
  for (const mesh of allMeshes) {
    const parent = mesh.parent;
    if (parent instanceof TransformNode && parent.name !== 'AnchorStation') {
      parent.parent = root;
    }
  }

  return {
    root,
    meshes: allMeshes,
    layout,
    dispose: () => {
      for (const mesh of allMeshes) {
        mesh.dispose();
      }
      root.dispose();
    },
  };
}

/**
 * Check if a position is within any room bounds
 */
export function isPositionInStation(
  position: Vector3,
  layout: StationLayout = ANCHOR_STATION_LAYOUT
): boolean {
  const x = position.x;
  const z = position.z;

  for (const room of layout.rooms) {
    if (
      x >= room.bounds.minX &&
      x <= room.bounds.maxX &&
      z >= room.bounds.minZ &&
      z <= room.bounds.maxZ
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Get the current room name for a position
 */
export function getCurrentRoom(
  position: Vector3,
  layout: StationLayout = ANCHOR_STATION_LAYOUT
): string | null {
  const x = position.x;
  const z = position.z;

  for (const room of layout.rooms) {
    if (
      x >= room.bounds.minX &&
      x <= room.bounds.maxX &&
      z >= room.bounds.minZ &&
      z <= room.bounds.maxZ
    ) {
      return room.name;
    }
  }
  return null;
}
