/**
 * Mining Depths Environment - Underground Mine Generation
 *
 * Creates the BabylonJS mesh environment for an abandoned mining facility
 * deep underground on LV-847. Features:
 * - Tunnel systems with rock walls and ore veins
 * - Mining equipment (drills, carts, conveyor fragments)
 * - Crystal formations as natural light sources
 * - Cave-in debris and structural damage
 * - Minecart tracks (decorative)
 * - Volumetric fog via point lights
 * - Three distinct sections: Mining Hub, Collapsed Tunnels, Deep Shaft
 *
 * GLB models are loaded via AssetManager for props, equipment, structural
 * elements, and collectibles. MeshBuilder is retained for terrain surfaces,
 * collision volumes, VFX planes, and procedural geometry (crystals, tracks).
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('MiningDepthsEnv');

// ============================================================================
// GLB Asset Path Constants
// ============================================================================

const GLB_PATHS = {
  // Structural beams
  beamVertical: '/models/environment/station/beam_hc_vertical_2.glb',
  beamHorizontal: '/models/environment/station/beam_hc_horizontal_2.glb',

  // Support pillars
  pillar: '/models/environment/station/pillar_hr_2.glb',

  // Industrial equipment
  machinery: '/models/environment/industrial/machinery_mx_1.glb',
  platform: '/models/environment/industrial/platform_mx_1.glb',

  // Crates and containers
  crateSmall: '/models/props/containers/wooden_crate_1.glb',
  crateMedium: '/models/props/containers/wooden_crate_2_a.glb',
  crateLarge: '/models/props/containers/wooden_crate_2_b.glb',
  metalBarrel: '/models/props/containers/metal_barrel_hr_1.glb',
  toolbox: '/models/props/containers/toolbox_mx_1.glb',

  // Debris
  gravelPile1: '/models/props/debris/gravel_pile_hr_1.glb',
  gravelPile2: '/models/props/debris/gravel_pile_hr_2.glb',
  debrisBricks: '/models/props/debris/debris_bricks_mx_1.glb',
  brick1: '/models/props/debris/brick_mx_1.glb',
  brick2: '/models/props/debris/brick_mx_2.glb',

  // Doors and gates
  gate: '/models/props/doors/gate_1.glb',
  door: '/models/props/doors/door_hr_6.glb',

  // Platforms and railings
  platformLedge: '/models/environment/station/platform_bx_1.glb',
  handrail: '/models/environment/station/platform_b_handrail_1.glb',
  elevatorPlatform: '/models/environment/station/platform_small_mx_1.glb',

  // Collectibles
  audioLog: '/models/props/collectibles/audio_log.glb',
  dataPad: '/models/props/collectibles/data_pad.glb',

  // Lamps
  lampOn: '/models/props/electrical/lamp_mx_1_a_on.glb',
} as const;

// Unique set of all GLB paths for preloading
const ALL_GLB_PATHS: readonly string[] = [...new Set(Object.values(GLB_PATHS))];

// Crate path rotation for visual variety
const CRATE_VARIANTS: readonly string[] = [
  GLB_PATHS.crateSmall,
  GLB_PATHS.crateMedium,
  GLB_PATHS.crateLarge,
  GLB_PATHS.toolbox,
  GLB_PATHS.metalBarrel,
];

// Debris model rotation for visual variety
const DEBRIS_VARIANTS: readonly string[] = [
  GLB_PATHS.gravelPile1,
  GLB_PATHS.gravelPile2,
  GLB_PATHS.debrisBricks,
  GLB_PATHS.brick1,
  GLB_PATHS.brick2,
];

// ============================================================================
// Layout Constants (all in meters)
// ============================================================================
//
// LAYOUT DIAGRAM:
//
//    SURFACE (elevator shaft destroyed)
//         |
//    ENTRY ELEVATOR SHAFT (Y=0)
//         |
//    MINING HUB (40m x 30m, Y=0) - Central processing area
//         |
//    CONNECTOR TUNNEL (transition hub->tunnels)
//         |
//    COLLAPSED TUNNELS (winding 60m passage, Y=-5 to -10)
//         |
//    TRANSITION CORRIDOR
//         |
//    DEEP SHAFT (25m x 25m, 30m tall, Y=-15 to -45)
//         Boss Arena at shaft floor
//
// ============================================================================

// Section centers - carefully connected for seamless navigation
const ENTRY_CENTER = new Vector3(0, 0, 0);
const HUB_CENTER = new Vector3(0, 0, -25);
const HUB_EXIT = new Vector3(0, 0, -40); // Where hub connects to tunnels
const TUNNEL_START = new Vector3(0, 0, -50);
const TUNNEL_BEND_1 = new Vector3(-8, -3, -60); // First bend
const TUNNEL_MID = new Vector3(-15, -5, -70);
const TUNNEL_BEND_2 = new Vector3(-12, -7, -82); // Second bend
const TUNNEL_END = new Vector3(-10, -10, -95);
const SHAFT_ENTRY = new Vector3(-10, -13, -108); // Where tunnels meet shaft
const SHAFT_CENTER = new Vector3(-10, -15, -120);

// Room dimensions
const HUB_WIDTH = 40;
const HUB_DEPTH = 30;
const HUB_HEIGHT = 8;

const TUNNEL_WIDTH = 5;
const TUNNEL_HEIGHT = 4;
const TUNNEL_NARROW_WIDTH = 3.5; // For claustrophobic sections

const SHAFT_WIDTH = 25;
const SHAFT_DEPTH = 25;
const SHAFT_HEIGHT = 30;

// Exported positions for level scripting
export const MINE_POSITIONS = {
  // Main navigation points
  entry: ENTRY_CENTER.clone(),
  hubCenter: HUB_CENTER.clone(),
  hubTerminal: new Vector3(-12, 0, -20),
  hubKeycard: new Vector3(14, 0, -30),
  hubExit: HUB_EXIT.clone(),
  tunnelStart: TUNNEL_START.clone(),
  tunnelBend1: TUNNEL_BEND_1.clone(),
  tunnelMid: TUNNEL_MID.clone(),
  tunnelBend2: TUNNEL_BEND_2.clone(),
  tunnelEnd: TUNNEL_END.clone(),
  shaftEntry: SHAFT_ENTRY.clone(),
  shaftCenter: SHAFT_CENTER.clone(),
  shaftFloor: new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y - SHAFT_HEIGHT / 2 + 1, SHAFT_CENTER.z),
  shaftBossSpawn: new Vector3(
    SHAFT_CENTER.x,
    SHAFT_CENTER.y - SHAFT_HEIGHT / 2 + 3,
    SHAFT_CENTER.z
  ),

  // Audio log pickup locations (placed at memorable spots)
  audioLog1: new Vector3(8, 0, -18), // Hub - near machinery
  audioLog2: new Vector3(-15, -5, -75), // Tunnel mid - near crystal
  audioLog3: new Vector3(-10, -28, -115), // Shaft floor - near boss arena

  // Gas vent hazard positions
  gasVent1: new Vector3(-5, -1, -55), // After tunnel start
  gasVent2: new Vector3(-18, -6, -78), // Near tunnel mid

  // Unstable ground hazard positions (rockfall traps)
  rockfall1: new Vector3(-3, -2, -58), // Early warning
  rockfall2: new Vector3(-12, -8, -88), // Late tunnel section

  // Flooded section
  floodedArea: new Vector3(-10, -12, -103),

  // Burrower spawn positions (ambush points)
  burrowerSpawn1: new Vector3(10, 0, -35), // Hub - first encounter
  burrowerSpawn2: new Vector3(-12, -4, -62), // After tunnel bend 1
  burrowerSpawn3: new Vector3(-8, -9, -92), // Before tunnel end
  burrowerSpawn4: new Vector3(-18, -28, -125), // Shaft floor - left
  burrowerSpawn5: new Vector3(-2, -28, -115), // Shaft floor - right
};

// ============================================================================
// Hazard Zone Definitions
// ============================================================================

export interface HazardZone {
  id: string;
  type: 'gas_vent' | 'unstable_ground' | 'flooded';
  center: Vector3;
  radius: number;
  damage: number; // DPS
  active: boolean;
}

export const HAZARD_ZONES: HazardZone[] = [
  {
    id: 'gas_vent_1',
    type: 'gas_vent',
    center: MINE_POSITIONS.gasVent1.clone(),
    radius: 4,
    damage: 5,
    active: true,
  },
  {
    id: 'gas_vent_2',
    type: 'gas_vent',
    center: MINE_POSITIONS.gasVent2.clone(),
    radius: 3,
    damage: 8,
    active: true,
  },
  {
    id: 'rockfall_1',
    type: 'unstable_ground',
    center: MINE_POSITIONS.rockfall1.clone(),
    radius: 5,
    damage: 15,
    active: true,
  },
  {
    id: 'rockfall_2',
    type: 'unstable_ground',
    center: MINE_POSITIONS.rockfall2.clone(),
    radius: 4,
    damage: 12,
    active: true,
  },
  {
    id: 'flooded_section',
    type: 'flooded',
    center: MINE_POSITIONS.floodedArea.clone(),
    radius: 8,
    damage: 0, // No damage, just limited visibility
    active: true,
  },
];

// ============================================================================
// Audio Log Definitions
// ============================================================================

export interface AudioLogPickup {
  id: string;
  position: Vector3;
  title: string;
  text: string;
  collected: boolean;
}

export const AUDIO_LOGS: AudioLogPickup[] = [
  {
    id: 'log_foreman',
    position: MINE_POSITIONS.audioLog1.clone(),
    title: 'FOREMAN VASQUEZ - DAY 12',
    text: 'The deeper veins are showing strange crystalline growths. Not in any geological survey. The crystals pulse with their own light. Beautiful, but... unsettling. Pulled the night shift from Tunnel C after two miners reported hearing scratching inside the walls.',
    collected: false,
  },
  {
    id: 'log_geologist',
    position: MINE_POSITIONS.audioLog2.clone(),
    title: 'DR. CHEN - DAY 15',
    text: 'The crystal formations are biological. Not mineral. They respond to sound and vibration. When the drill rigs operate, the crystals pulse faster. I think... I think we have been drilling into something alive. I have recommended immediate cessation of all mining operations.',
    collected: false,
  },
  {
    id: 'log_survivor',
    position: MINE_POSITIONS.audioLog3.clone(),
    title: 'UNKNOWN MINER - DAY 18',
    text: 'They came from the walls. Broke through the rock like it was paper. Vasquez is gone. The elevator is destroyed. We sealed ourselves in the deep shaft but we can hear them drilling through. If anyone finds this... do not dig deeper. The mine is theirs now.',
    collected: false,
  },
];

// ============================================================================
// Material Creation
// ============================================================================

export function createMiningMaterials(scene: Scene): Map<string, StandardMaterial> {
  const materials = new Map<string, StandardMaterial>();

  // Rock wall - dark grey/brown
  const rock = new StandardMaterial('mine_rock', scene);
  rock.diffuseColor = Color3.FromHexString('#2A2520');
  rock.specularColor = new Color3(0.08, 0.08, 0.06);
  materials.set('rock', rock);

  // Ore vein - metallic blue-grey
  const ore = new StandardMaterial('mine_ore', scene);
  ore.diffuseColor = Color3.FromHexString('#3A4555');
  ore.specularColor = new Color3(0.3, 0.3, 0.4);
  materials.set('ore', ore);

  // Mine floor - dusty concrete
  const floor = new StandardMaterial('mine_floor', scene);
  floor.diffuseColor = Color3.FromHexString('#352E28');
  floor.specularColor = new Color3(0.06, 0.06, 0.05);
  materials.set('floor', floor);

  // Metal support beams - rusted industrial
  const metal = new StandardMaterial('mine_metal', scene);
  metal.diffuseColor = Color3.FromHexString('#4A3A2A');
  metal.specularColor = new Color3(0.2, 0.15, 0.1);
  materials.set('metal', metal);

  // Mining equipment - worn olive/grey
  const equipment = new StandardMaterial('mine_equipment', scene);
  equipment.diffuseColor = Color3.FromHexString('#4A4A3A');
  equipment.specularColor = new Color3(0.15, 0.15, 0.12);
  materials.set('equipment', equipment);

  // Crystal - glowing cyan/teal
  const crystal = new StandardMaterial('mine_crystal', scene);
  crystal.diffuseColor = Color3.FromHexString('#1A4A5A');
  crystal.emissiveColor = Color3.FromHexString('#22AACC');
  crystal.specularColor = new Color3(0.5, 0.5, 0.6);
  crystal.alpha = 0.85;
  materials.set('crystal', crystal);

  // Crystal variant - purple
  const crystalPurple = new StandardMaterial('mine_crystal_purple', scene);
  crystalPurple.diffuseColor = Color3.FromHexString('#3A1A5A');
  crystalPurple.emissiveColor = Color3.FromHexString('#8844CC');
  crystalPurple.specularColor = new Color3(0.4, 0.3, 0.6);
  crystalPurple.alpha = 0.85;
  materials.set('crystal_purple', crystalPurple);

  // Cart track - dark iron
  const track = new StandardMaterial('mine_track', scene);
  track.diffuseColor = Color3.FromHexString('#2A2828');
  track.specularColor = new Color3(0.25, 0.25, 0.25);
  materials.set('track', track);

  // Minecart - rusty brown
  const cart = new StandardMaterial('mine_cart', scene);
  cart.diffuseColor = Color3.FromHexString('#5A3A22');
  cart.specularColor = new Color3(0.2, 0.15, 0.1);
  materials.set('cart', cart);

  // Caution/warning stripes
  const caution = new StandardMaterial('mine_caution', scene);
  caution.diffuseColor = Color3.FromHexString('#C4A000');
  caution.specularColor = new Color3(0.2, 0.2, 0.1);
  materials.set('caution', caution);

  // Emergency light panel
  const emergency = new StandardMaterial('mine_emergency', scene);
  emergency.diffuseColor = Color3.FromHexString('#220000');
  emergency.emissiveColor = Color3.FromHexString('#FF2200');
  materials.set('emergency', emergency);

  // Water/flood - murky green
  const water = new StandardMaterial('mine_water', scene);
  water.diffuseColor = Color3.FromHexString('#1A2A1A');
  water.emissiveColor = new Color3(0.02, 0.05, 0.03);
  water.specularColor = new Color3(0.3, 0.3, 0.3);
  water.alpha = 0.6;
  materials.set('water', water);

  // Gas vent haze
  const gas = new StandardMaterial('mine_gas', scene);
  gas.diffuseColor = Color3.FromHexString('#3A4A1A');
  gas.emissiveColor = new Color3(0.1, 0.15, 0.05);
  gas.alpha = 0.3;
  materials.set('gas', gas);

  // Debris/rubble
  const debris = new StandardMaterial('mine_debris', scene);
  debris.diffuseColor = Color3.FromHexString('#3A3028');
  debris.specularColor = new Color3(0.06, 0.06, 0.05);
  materials.set('debris', debris);

  // Audio log pickup glow
  const logGlow = new StandardMaterial('mine_log_glow', scene);
  logGlow.diffuseColor = Color3.FromHexString('#002200');
  logGlow.emissiveColor = Color3.FromHexString('#44FF88');
  materials.set('log_glow', logGlow);

  // Alien resin/infestation
  const resin = new StandardMaterial('mine_resin', scene);
  resin.diffuseColor = Color3.FromHexString('#1A0A2A');
  resin.emissiveColor = new Color3(0.05, 0.02, 0.08);
  resin.specularColor = new Color3(0.3, 0.2, 0.3);
  materials.set('resin', resin);

  // Boss chitin - dark armored
  const chitin = new StandardMaterial('mine_chitin', scene);
  chitin.diffuseColor = Color3.FromHexString('#1A1A20');
  chitin.specularColor = new Color3(0.35, 0.3, 0.35);
  materials.set('chitin', chitin);

  // Elevator shaft metal
  const elevator = new StandardMaterial('mine_elevator', scene);
  elevator.diffuseColor = Color3.FromHexString('#303030');
  elevator.specularColor = new Color3(0.25, 0.25, 0.25);
  materials.set('elevator', elevator);

  return materials;
}

// ============================================================================
// Environment Result Interface
// ============================================================================

export interface FlickerLightDef {
  light: PointLight;
  baseIntensity: number;
  flickerSpeed: number;
  flickerAmount: number;
  timer: number;
  isOff: boolean;
  offDuration: number;
  offTimer: number;
}

export interface MiningEnvironment {
  root: TransformNode;
  allMeshes: Mesh[];
  materials: Map<string, StandardMaterial>;
  lights: PointLight[];
  flickerLights: FlickerLightDef[];
  // Section roots
  sections: {
    entry: TransformNode;
    hub: TransformNode;
    tunnels: TransformNode;
    shaft: TransformNode;
  };
  // Key interactable meshes
  keycardPickup: Mesh;
  shaftGate: Mesh;
  audioLogMeshes: Mesh[];
  hazardMeshes: Mesh[];
  bossArenaDoor: Mesh;
  // GLB instance roots for disposal
  glbInstances: TransformNode[];
  dispose: () => void;
}

// ============================================================================
// GLB Preloading
// ============================================================================

/**
 * Preload all GLB assets required by the mining depths environment.
 * Call this before createMiningEnvironment() so that instances can be
 * created synchronously during environment construction.
 */
export async function preloadMiningAssets(scene: Scene): Promise<void> {
  const loadPromises = ALL_GLB_PATHS.map((path) =>
    AssetManager.loadAssetByPath(path, scene).catch((err) => {
      log.warn(`Failed to preload GLB ${path}:`, err);
      return null;
    })
  );
  await Promise.all(loadPromises);
  log.info(`Preloaded ${ALL_GLB_PATHS.length} GLB assets`);
}

// ============================================================================
// GLB Instance Helpers
// ============================================================================

/** Counter to guarantee unique instance names */
let _instanceCounter = 0;

/**
 * Create a positioned GLB instance and add its root to the tracking array.
 * Returns the TransformNode root of the instance (or null on failure).
 */
function placeGLBInstance(
  scene: Scene,
  parent: TransformNode,
  glbPath: string,
  namePrefix: string,
  position: Vector3,
  glbInstances: TransformNode[],
  opts?: {
    rotationY?: number;
    scale?: Vector3;
  }
): TransformNode | null {
  const instanceName = `${namePrefix}_${_instanceCounter++}`;
  const node = AssetManager.createInstanceByPath(glbPath, instanceName, scene, true, 'prop');
  if (!node) {
    return null;
  }
  node.position = position.clone();
  if (opts?.rotationY !== undefined) {
    node.rotation.y = opts.rotationY;
  }
  if (opts?.scale) {
    node.scaling = opts.scale.clone();
  }
  node.parent = parent;
  glbInstances.push(node);
  return node;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createTunnelSegment(
  scene: Scene,
  parent: TransformNode,
  start: Vector3,
  end: Vector3,
  width: number,
  height: number,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[],
  lights: PointLight[],
  flickerLights: FlickerLightDef[],
  glbInstances: TransformNode[]
): void {
  const dir = end.subtract(start);
  const length = dir.length();
  const mid = start.add(dir.scale(0.5));
  const angle = Math.atan2(dir.x, dir.z);

  // Floor (terrain surface -- kept as MeshBuilder)
  const floor = MeshBuilder.CreateBox(
    `tunnel_floor_${allMeshes.length}`,
    { width, height: 0.3, depth: length },
    scene
  );
  floor.position = mid.clone();
  floor.position.y = start.y - 0.15;
  floor.rotation.y = angle;
  floor.material = materials.get('floor')!;
  floor.parent = parent;
  allMeshes.push(floor);

  // Left wall (terrain surface -- kept as MeshBuilder)
  const leftWall = MeshBuilder.CreateBox(
    `tunnel_lwall_${allMeshes.length}`,
    { width: 0.5, height, depth: length },
    scene
  );
  leftWall.position = mid.clone();
  leftWall.position.y = start.y + height / 2;
  leftWall.position.x += Math.cos(angle) * (width / 2 + 0.25);
  leftWall.position.z -= Math.sin(angle) * (width / 2 + 0.25);
  leftWall.rotation.y = angle;
  leftWall.material = materials.get('rock')!;
  leftWall.parent = parent;
  allMeshes.push(leftWall);

  // Right wall (terrain surface -- kept as MeshBuilder)
  const rightWall = MeshBuilder.CreateBox(
    `tunnel_rwall_${allMeshes.length}`,
    { width: 0.5, height, depth: length },
    scene
  );
  rightWall.position = mid.clone();
  rightWall.position.y = start.y + height / 2;
  rightWall.position.x -= Math.cos(angle) * (width / 2 + 0.25);
  rightWall.position.z += Math.sin(angle) * (width / 2 + 0.25);
  rightWall.rotation.y = angle;
  rightWall.material = materials.get('rock')!;
  rightWall.parent = parent;
  allMeshes.push(rightWall);

  // Ceiling (terrain surface -- kept as MeshBuilder)
  const ceiling = MeshBuilder.CreateBox(
    `tunnel_ceil_${allMeshes.length}`,
    { width: width + 1, height: 0.4, depth: length },
    scene
  );
  ceiling.position = mid.clone();
  ceiling.position.y = start.y + height;
  ceiling.rotation.y = angle;
  ceiling.material = materials.get('rock')!;
  ceiling.parent = parent;
  allMeshes.push(ceiling);

  // Support beams every 6 meters -> GLB instances
  const beamCount = Math.floor(length / 6);
  for (let i = 0; i <= beamCount; i++) {
    const t = beamCount > 0 ? i / beamCount : 0.5;
    const beamPos = start.add(dir.scale(t));

    // Left vertical beam -> GLB
    const lBeamPos = beamPos.clone();
    lBeamPos.y += height / 2;
    lBeamPos.x += Math.cos(angle) * (width / 2 - 0.1);
    lBeamPos.z -= Math.sin(angle) * (width / 2 - 0.1);
    placeGLBInstance(scene, parent, GLB_PATHS.beamVertical, 'beam_l', lBeamPos, glbInstances, {
      rotationY: angle,
      scale: new Vector3(0.15, height / 4, 0.15),
    });

    // Right vertical beam -> GLB
    const rBeamPos = beamPos.clone();
    rBeamPos.y += height / 2;
    rBeamPos.x -= Math.cos(angle) * (width / 2 - 0.1);
    rBeamPos.z += Math.sin(angle) * (width / 2 - 0.1);
    placeGLBInstance(scene, parent, GLB_PATHS.beamVertical, 'beam_r', rBeamPos, glbInstances, {
      rotationY: angle,
      scale: new Vector3(0.15, height / 4, 0.15),
    });

    // Cross beam -> GLB
    const crossPos = beamPos.clone();
    crossPos.y += height - 0.1;
    placeGLBInstance(
      scene,
      parent,
      GLB_PATHS.beamHorizontal,
      'beam_cross',
      crossPos,
      glbInstances,
      {
        rotationY: angle,
        scale: new Vector3((width - 0.2) / 4, 0.12, 0.15),
      }
    );
  }

  // Mining lamp lights every 8 meters
  const lampCount = Math.max(1, Math.floor(length / 8));
  for (let i = 0; i < lampCount; i++) {
    const t = (i + 0.5) / lampCount;
    const lampPos = start.add(dir.scale(t));
    lampPos.y += height - 0.5;

    // Lamp fixture -> GLB
    placeGLBInstance(scene, parent, GLB_PATHS.lampOn, 'tunnel_lamp', lampPos, glbInstances, {
      scale: new Vector3(0.15, 0.15, 0.15),
    });

    // Point light
    const lamp = new PointLight(`tunnel_lamp_${lights.length}`, lampPos.clone(), scene);
    lamp.diffuse = new Color3(1.0, 0.3, 0.15);
    lamp.intensity = 0.4;
    lamp.range = 10;
    lights.push(lamp);

    flickerLights.push({
      light: lamp,
      baseIntensity: 0.4,
      flickerSpeed: 8 + Math.random() * 10,
      flickerAmount: 0.6,
      timer: Math.random() * Math.PI * 2,
      isOff: false,
      offDuration: 0,
      offTimer: 0,
    });
  }
}

function createCrystalFormation(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  scale: number,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[],
  lights: PointLight[],
  variant: 'cyan' | 'purple' = 'cyan'
): void {
  // Crystals are procedurally randomized -- kept as MeshBuilder
  const matKey = variant === 'cyan' ? 'crystal' : 'crystal_purple';
  const lightColor = variant === 'cyan' ? new Color3(0.1, 0.6, 0.8) : new Color3(0.5, 0.2, 0.8);

  // Main crystal shard
  const mainCrystal = MeshBuilder.CreateCylinder(
    `crystal_main_${allMeshes.length}`,
    {
      height: 1.5 * scale,
      diameterTop: 0,
      diameterBottom: 0.4 * scale,
      tessellation: 6,
    },
    scene
  );
  mainCrystal.position = position.clone();
  mainCrystal.position.y += (0.75 * scale) / 2;
  mainCrystal.rotation.x = (Math.random() - 0.5) * 0.3;
  mainCrystal.rotation.z = (Math.random() - 0.5) * 0.3;
  mainCrystal.material = materials.get(matKey)!;
  mainCrystal.parent = parent;
  allMeshes.push(mainCrystal);

  // Secondary smaller shards
  const shardCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < shardCount; i++) {
    const shardHeight = (0.5 + Math.random() * 0.8) * scale;
    const shard = MeshBuilder.CreateCylinder(
      `crystal_shard_${allMeshes.length}`,
      {
        height: shardHeight,
        diameterTop: 0,
        diameterBottom: (0.15 + Math.random() * 0.2) * scale,
        tessellation: 6,
      },
      scene
    );
    const shardAngle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 0.3 * scale + Math.random() * 0.3 * scale;
    shard.position = position.clone();
    shard.position.x += Math.cos(shardAngle) * dist;
    shard.position.z += Math.sin(shardAngle) * dist;
    shard.position.y += shardHeight / 2;
    shard.rotation.x = (Math.random() - 0.5) * 0.5;
    shard.rotation.z = (Math.random() - 0.5) * 0.5;
    shard.material = materials.get(matKey)!;
    shard.parent = parent;
    allMeshes.push(shard);
  }

  // Glow light from crystal
  const crystalLight = new PointLight(
    `crystal_light_${lights.length}`,
    position.add(new Vector3(0, scale * 0.5, 0)),
    scene
  );
  crystalLight.diffuse = lightColor;
  crystalLight.intensity = 0.5 * scale;
  crystalLight.range = 8 * scale;
  lights.push(crystalLight);
}

function createMinecartTrack(
  scene: Scene,
  parent: TransformNode,
  points: Vector3[],
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): void {
  // Track rails and ties are very thin procedural geometry -- kept as MeshBuilder
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const dir = end.subtract(start);
    const length = dir.length();
    const mid = start.add(dir.scale(0.5));
    const angle = Math.atan2(dir.x, dir.z);

    // Left rail
    const leftRail = MeshBuilder.CreateBox(
      `rail_l_${allMeshes.length}`,
      { width: 0.08, height: 0.08, depth: length },
      scene
    );
    leftRail.position = mid.clone();
    leftRail.position.y = start.y + 0.04;
    leftRail.position.x += Math.cos(angle) * 0.4;
    leftRail.position.z -= Math.sin(angle) * 0.4;
    leftRail.rotation.y = angle;
    leftRail.material = materials.get('track')!;
    leftRail.parent = parent;
    allMeshes.push(leftRail);

    // Right rail
    const rightRail = MeshBuilder.CreateBox(
      `rail_r_${allMeshes.length}`,
      { width: 0.08, height: 0.08, depth: length },
      scene
    );
    rightRail.position = mid.clone();
    rightRail.position.y = start.y + 0.04;
    rightRail.position.x -= Math.cos(angle) * 0.4;
    rightRail.position.z += Math.sin(angle) * 0.4;
    rightRail.rotation.y = angle;
    rightRail.material = materials.get('track')!;
    rightRail.parent = parent;
    allMeshes.push(rightRail);

    // Cross ties
    const tieCount = Math.floor(length / 0.8);
    for (let t = 0; t < tieCount; t++) {
      const tieT = t / tieCount;
      const tiePos = start.add(dir.scale(tieT));
      const tie = MeshBuilder.CreateBox(
        `tie_${allMeshes.length}`,
        { width: 1.0, height: 0.06, depth: 0.12 },
        scene
      );
      tie.position = tiePos.clone();
      tie.position.y += 0.01;
      tie.rotation.y = angle;
      tie.material = materials.get('metal')!;
      tie.parent = parent;
      allMeshes.push(tie);
    }
  }
}

function createMinecart(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  rotationY: number,
  glbInstances: TransformNode[]
): void {
  // Minecart -> GLB barrel model as stand-in
  placeGLBInstance(scene, parent, GLB_PATHS.metalBarrel, 'minecart', position, glbInstances, {
    rotationY,
    scale: new Vector3(1.0, 0.8, 1.5),
  });
}

function createDrillRig(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  rotationY: number,
  glbInstances: TransformNode[]
): void {
  // Full drill rig -> single machinery GLB model
  placeGLBInstance(scene, parent, GLB_PATHS.machinery, 'drill_rig', position, glbInstances, {
    rotationY,
    scale: new Vector3(1.5, 1.5, 1.5),
  });
}

function createDebrisPile(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  scale: number,
  glbInstances: TransformNode[]
): void {
  // Place 2-3 debris GLB instances for each pile
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const variant = DEBRIS_VARIANTS[Math.floor(Math.random() * DEBRIS_VARIANTS.length)];
    const offset = position.clone();
    offset.x += (Math.random() - 0.5) * 2 * scale;
    offset.z += (Math.random() - 0.5) * 2 * scale;
    placeGLBInstance(scene, parent, variant, 'debris', offset, glbInstances, {
      rotationY: Math.random() * Math.PI * 2,
      scale: new Vector3(scale * 0.8, scale * 0.6, scale * 0.8),
    });
  }
}

/**
 * Create blood stain decal for environmental storytelling.
 * Tells the story of what happened to the miners.
 */
function createBloodStain(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  size: number,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): void {
  // Create a dark stain decal
  const stain = MeshBuilder.CreateDisc(
    `bloodStain_${allMeshes.length}`,
    { radius: size, tessellation: 12 },
    scene
  );
  stain.position = position.clone();
  stain.position.y += 0.02; // Slightly above floor
  stain.rotation.x = Math.PI / 2;
  stain.rotation.y = Math.random() * Math.PI * 2;

  // Create dark stain material (not red - more subtle)
  const stainMat = new StandardMaterial(`stainMat_${allMeshes.length}`, scene);
  stainMat.diffuseColor = new Color3(0.15, 0.08, 0.06);
  stainMat.specularColor = new Color3(0.1, 0.05, 0.03);
  stainMat.alpha = 0.6;
  stain.material = stainMat;

  stain.parent = parent;
  allMeshes.push(stain);
}

/**
 * Create overturned equipment for environmental storytelling.
 * Shows signs of struggle/escape.
 */
function createOverturnedEquipment(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  glbInstances: TransformNode[]
): void {
  // Tipped over crate
  const crateVariant = CRATE_VARIANTS[Math.floor(Math.random() * CRATE_VARIANTS.length)];
  placeGLBInstance(scene, parent, crateVariant, 'overturned', position, glbInstances, {
    rotationY: Math.random() * Math.PI * 2,
    scale: new Vector3(0.7, 0.7, 0.7),
  });
}

// ============================================================================
// Main Environment Creation
// ============================================================================

export async function createMiningEnvironment(scene: Scene): Promise<MiningEnvironment> {
  // Preload all GLB assets first
  await preloadMiningAssets(scene);

  const root = new TransformNode('miningDepths', scene);
  const materials = createMiningMaterials(scene);
  const allMeshes: Mesh[] = [];
  const lights: PointLight[] = [];
  const flickerLights: FlickerLightDef[] = [];
  const glbInstances: TransformNode[] = [];

  // Section root nodes
  const entrySection = new TransformNode('entry', scene);
  entrySection.parent = root;

  const hubSection = new TransformNode('hub', scene);
  hubSection.parent = root;

  const tunnelSection = new TransformNode('tunnels', scene);
  tunnelSection.parent = root;

  const shaftSection = new TransformNode('shaft', scene);
  shaftSection.parent = root;

  // ===========================================================================
  // SECTION 1: ENTRY ELEVATOR & MINING HUB
  // ===========================================================================

  // Entry elevator shaft - player arrives from surface (structural -- kept as MeshBuilder)
  const elevatorShaft = MeshBuilder.CreateBox(
    'elevatorShaft',
    { width: 4, height: 12, depth: 4 },
    scene
  );
  elevatorShaft.position = ENTRY_CENTER.clone();
  elevatorShaft.position.y += 6;
  elevatorShaft.material = materials.get('elevator')!;
  elevatorShaft.parent = entrySection;
  allMeshes.push(elevatorShaft);

  // Elevator platform (destroyed) -> GLB
  const elevPlatPos = ENTRY_CENTER.clone();
  elevPlatPos.y = 0.15;
  placeGLBInstance(
    scene,
    entrySection,
    GLB_PATHS.elevatorPlatform,
    'elevatorPlatform',
    elevPlatPos,
    glbInstances,
    { rotationY: 0.08, scale: new Vector3(1.0, 0.3, 1.0) }
  );

  // Destroyed elevator cable (thin cylinder -- kept as MeshBuilder)
  const cable = MeshBuilder.CreateCylinder(
    'elevatorCable',
    { height: 10, diameter: 0.08, tessellation: 6 },
    scene
  );
  cable.position = ENTRY_CENTER.clone();
  cable.position.y = 5;
  cable.position.x = 0.5;
  cable.material = materials.get('metal')!;
  cable.parent = entrySection;
  allMeshes.push(cable);

  // Entry tunnel to hub
  createTunnelSegment(
    scene,
    entrySection,
    ENTRY_CENTER,
    new Vector3(0, 0, -10),
    TUNNEL_WIDTH,
    TUNNEL_HEIGHT,
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // ------ MINING HUB (40m x 30m x 8m) ------
  // Large open room - central processing area

  // Floor (terrain surface -- kept as MeshBuilder)
  const hubFloor = MeshBuilder.CreateBox(
    'hubFloor',
    { width: HUB_WIDTH, height: 0.3, depth: HUB_DEPTH },
    scene
  );
  hubFloor.position = HUB_CENTER.clone();
  hubFloor.position.y = -0.15;
  hubFloor.material = materials.get('floor')!;
  hubFloor.parent = hubSection;
  allMeshes.push(hubFloor);

  // Ceiling (terrain surface -- kept as MeshBuilder)
  const hubCeiling = MeshBuilder.CreateBox(
    'hubCeiling',
    { width: HUB_WIDTH, height: 0.4, depth: HUB_DEPTH },
    scene
  );
  hubCeiling.position = HUB_CENTER.clone();
  hubCeiling.position.y = HUB_HEIGHT;
  hubCeiling.material = materials.get('rock')!;
  hubCeiling.parent = hubSection;
  allMeshes.push(hubCeiling);

  // Hub walls (terrain/structural rock -- kept as MeshBuilder)
  const hubWalls: Array<{ pos: Vector3; w: number; d: number; ry: number }> = [
    // North wall (with entry opening)
    {
      pos: new Vector3(-12, HUB_HEIGHT / 2, HUB_CENTER.z + HUB_DEPTH / 2),
      w: 16,
      d: 0.5,
      ry: 0,
    },
    {
      pos: new Vector3(12, HUB_HEIGHT / 2, HUB_CENTER.z + HUB_DEPTH / 2),
      w: 16,
      d: 0.5,
      ry: 0,
    },
    // South wall (with tunnel exit opening)
    {
      pos: new Vector3(-12, HUB_HEIGHT / 2, HUB_CENTER.z - HUB_DEPTH / 2),
      w: 16,
      d: 0.5,
      ry: 0,
    },
    {
      pos: new Vector3(12, HUB_HEIGHT / 2, HUB_CENTER.z - HUB_DEPTH / 2),
      w: 16,
      d: 0.5,
      ry: 0,
    },
    // East wall
    {
      pos: new Vector3(HUB_CENTER.x + HUB_WIDTH / 2, HUB_HEIGHT / 2, HUB_CENTER.z),
      w: 0.5,
      d: HUB_DEPTH,
      ry: 0,
    },
    // West wall
    {
      pos: new Vector3(HUB_CENTER.x - HUB_WIDTH / 2, HUB_HEIGHT / 2, HUB_CENTER.z),
      w: 0.5,
      d: HUB_DEPTH,
      ry: 0,
    },
  ];

  for (const wall of hubWalls) {
    const mesh = MeshBuilder.CreateBox(
      `hubWall_${allMeshes.length}`,
      { width: wall.w, height: HUB_HEIGHT, depth: wall.d },
      scene
    );
    mesh.position = wall.pos;
    mesh.rotation.y = wall.ry;
    mesh.material = materials.get('rock')!;
    mesh.parent = hubSection;
    allMeshes.push(mesh);
  }

  // Hub support columns (4 large pillars) -> GLB
  const pillarPositions = [
    new Vector3(HUB_CENTER.x - 10, 0, HUB_CENTER.z - 6),
    new Vector3(HUB_CENTER.x + 10, 0, HUB_CENTER.z - 6),
    new Vector3(HUB_CENTER.x - 10, 0, HUB_CENTER.z + 6),
    new Vector3(HUB_CENTER.x + 10, 0, HUB_CENTER.z + 6),
  ];

  for (const pp of pillarPositions) {
    const pillarPos = pp.clone();
    pillarPos.y = HUB_HEIGHT / 2;
    placeGLBInstance(scene, hubSection, GLB_PATHS.pillar, 'hub_pillar', pillarPos, glbInstances, {
      scale: new Vector3(0.5, HUB_HEIGHT / 4, 0.5),
    });
  }

  // Mining equipment in hub -> GLB drill rigs
  createDrillRig(scene, hubSection, new Vector3(8, 0, -20), 0, glbInstances);
  createDrillRig(scene, hubSection, new Vector3(-8, 0, -28), Math.PI / 3, glbInstances);

  // Conveyor belt fragment -> GLB platform
  placeGLBInstance(
    scene,
    hubSection,
    GLB_PATHS.platform,
    'conveyor',
    new Vector3(0, 0.5, HUB_CENTER.z + 5),
    glbInstances,
    { scale: new Vector3(1.0, 0.5, 2.0) }
  );

  // Scattered crates -> GLB crate variants
  const cratePositions = [
    new Vector3(5, 0.4, -15),
    new Vector3(-6, 0.4, -22),
    new Vector3(12, 0.4, -18),
    new Vector3(-14, 0.4, -32),
    new Vector3(6, 0.8, -16),
  ];
  for (let ci = 0; ci < cratePositions.length; ci++) {
    const cp = cratePositions[ci];
    const cratePath = CRATE_VARIANTS[ci % CRATE_VARIANTS.length];
    const crateScale = 0.6 + Math.random() * 0.4;
    placeGLBInstance(scene, hubSection, cratePath, 'crate', cp, glbInstances, {
      rotationY: Math.random() * Math.PI,
      scale: new Vector3(crateScale, crateScale, crateScale),
    });
  }

  // Minecart tracks through hub (procedural thin geometry -- kept as MeshBuilder)
  createMinecartTrack(
    scene,
    hubSection,
    [
      new Vector3(-18, 0, -12),
      new Vector3(-10, 0, -15),
      new Vector3(0, 0, -20),
      new Vector3(10, 0, -25),
      new Vector3(15, 0, -30),
    ],
    materials,
    allMeshes
  );

  // Minecarts -> GLB
  createMinecart(scene, hubSection, new Vector3(-14, 0, -13), 0.3, glbInstances);
  createMinecart(scene, hubSection, new Vector3(12, 0, -26), 0.8, glbInstances);

  // Crystal formations in hub (natural light sources -- procedural, kept as MeshBuilder)
  createCrystalFormation(
    scene,
    hubSection,
    new Vector3(-16, 0, -18),
    1.5,
    materials,
    allMeshes,
    lights,
    'cyan'
  );
  createCrystalFormation(
    scene,
    hubSection,
    new Vector3(16, 0, -30),
    1.2,
    materials,
    allMeshes,
    lights,
    'purple'
  );
  createCrystalFormation(
    scene,
    hubSection,
    new Vector3(-5, 0, -35),
    0.8,
    materials,
    allMeshes,
    lights,
    'cyan'
  );

  // Hub emergency lights -> GLB lamp fixtures
  const hubEmergencyPositions = [
    new Vector3(-15, HUB_HEIGHT - 0.5, HUB_CENTER.z - 5),
    new Vector3(15, HUB_HEIGHT - 0.5, HUB_CENTER.z + 5),
    new Vector3(0, HUB_HEIGHT - 0.5, HUB_CENTER.z),
    new Vector3(-10, HUB_HEIGHT - 0.5, HUB_CENTER.z + 10),
    new Vector3(10, HUB_HEIGHT - 0.5, HUB_CENTER.z - 10),
  ];

  for (const elp of hubEmergencyPositions) {
    placeGLBInstance(scene, hubSection, GLB_PATHS.lampOn, 'hub_lamp', elp, glbInstances, {
      scale: new Vector3(0.2, 0.2, 0.2),
    });

    const lamp = new PointLight(`hub_light_${lights.length}`, elp.clone(), scene);
    lamp.diffuse = new Color3(1.0, 0.2, 0.1);
    lamp.intensity = 0.3;
    lamp.range = 12;
    lights.push(lamp);

    flickerLights.push({
      light: lamp,
      baseIntensity: 0.3,
      flickerSpeed: 5 + Math.random() * 8,
      flickerAmount: 0.5,
      timer: Math.random() * Math.PI * 2,
      isOff: false,
      offDuration: 0,
      offTimer: 0,
    });
  }

  // Keycard pickup location -> GLB data pad
  const keycardPos = MINE_POSITIONS.hubKeycard.clone();
  keycardPos.y = 1.0;
  const keycardNode = placeGLBInstance(
    scene,
    hubSection,
    GLB_PATHS.dataPad,
    'keycardPickup',
    keycardPos,
    glbInstances,
    { scale: new Vector3(0.3, 0.3, 0.3) }
  );
  if (!keycardNode) {
    throw new Error(`[MiningDepths] Failed to load keycard GLB: ${GLB_PATHS.dataPad}`);
  }

  // Use a small invisible collision box for the interactable
  const keycardPickup = MeshBuilder.CreateBox(
    'keycardPickup_collider',
    { width: 0.3, height: 0.3, depth: 0.3 },
    scene
  );
  keycardPickup.position = keycardPos;
  keycardPickup.isVisible = false;
  keycardPickup.parent = hubSection;
  allMeshes.push(keycardPickup);

  // Keycard glow light
  const keycardLight = new PointLight(
    'keycardLight',
    MINE_POSITIONS.hubKeycard.add(new Vector3(0, 1, 0)),
    scene
  );
  keycardLight.diffuse = new Color3(0.2, 1.0, 0.5);
  keycardLight.intensity = 0.4;
  keycardLight.range = 5;
  lights.push(keycardLight);

  // Alien resin patches (VFX decals -- kept as MeshBuilder)
  const resinPositions = [
    new Vector3(-18, 0, -25),
    new Vector3(17, 1, -22),
    new Vector3(-12, 3, -30),
    new Vector3(5, 5, -35),
  ];
  for (const rp of resinPositions) {
    const resinPatch = MeshBuilder.CreateDisc(
      `resin_${allMeshes.length}`,
      { radius: 0.5 + Math.random() * 1.0, tessellation: 8 },
      scene
    );
    resinPatch.position = rp.clone();
    resinPatch.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, 0);
    resinPatch.material = materials.get('resin')!;
    resinPatch.parent = hubSection;
    allMeshes.push(resinPatch);
  }

  // =========================================================================
  // ENVIRONMENTAL STORYTELLING - Signs of what happened to the miners
  // =========================================================================

  // Blood stains near where miners were attacked
  createBloodStain(scene, hubSection, new Vector3(8, 0, -22), 1.2, materials, allMeshes);
  createBloodStain(scene, hubSection, new Vector3(-10, 0, -32), 0.8, materials, allMeshes);
  createBloodStain(scene, hubSection, new Vector3(15, 0, -28), 0.6, materials, allMeshes);

  // Overturned equipment near keycard (someone dropped it fleeing)
  createOverturnedEquipment(scene, hubSection, new Vector3(12, 0, -31), glbInstances);
  createOverturnedEquipment(scene, hubSection, new Vector3(-8, 0, -25), glbInstances);

  // Scattered tools (hasty evacuation)
  placeGLBInstance(scene, hubSection, GLB_PATHS.toolbox, 'scattered_tools_1',
    new Vector3(10, 0, -24), glbInstances,
    { rotationY: 2.1, scale: new Vector3(0.4, 0.4, 0.4) }
  );
  placeGLBInstance(scene, hubSection, GLB_PATHS.toolbox, 'scattered_tools_2',
    new Vector3(-15, 0, -20), glbInstances,
    { rotationY: 0.5, scale: new Vector3(0.35, 0.35, 0.35) }
  );

  // ===========================================================================
  // CONNECTOR: Hub Exit to Tunnel Start
  // ===========================================================================

  // Transition tunnel from hub south exit to tunnel start
  createTunnelSegment(
    scene,
    tunnelSection,
    HUB_EXIT,
    TUNNEL_START,
    TUNNEL_WIDTH,
    TUNNEL_HEIGHT,
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // Warning sign at tunnel entrance (environmental storytelling)
  const warningSign = MeshBuilder.CreateBox(
    'warningSign',
    { width: 1.5, height: 1.0, depth: 0.05 },
    scene
  );
  warningSign.position = new Vector3(2, 1.5, -48);
  warningSign.rotation.y = Math.PI * 0.1;
  warningSign.material = materials.get('caution')!;
  warningSign.parent = tunnelSection;
  allMeshes.push(warningSign);

  // ===========================================================================
  // SECTION 2: COLLAPSED TUNNELS
  // ===========================================================================

  // Tunnel segment 1: Start to first bend (begins descent)
  createTunnelSegment(
    scene,
    tunnelSection,
    TUNNEL_START,
    TUNNEL_BEND_1,
    TUNNEL_WIDTH,
    TUNNEL_HEIGHT,
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // Debris pile at first collapse zone -> GLB
  createDebrisPile(scene, tunnelSection, new Vector3(-3, -2, -55), 1.2, glbInstances);
  createDebrisPile(scene, tunnelSection, new Vector3(-6, -2.5, -57), 0.8, glbInstances);

  // Tunnel segment 2: First bend to tunnel mid (narrower, claustrophobic)
  createTunnelSegment(
    scene,
    tunnelSection,
    TUNNEL_BEND_1,
    TUNNEL_MID,
    TUNNEL_NARROW_WIDTH, // Narrower for tension
    TUNNEL_HEIGHT - 0.5, // Lower ceiling
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // Major debris pile blocking partial path -> GLB
  createDebrisPile(scene, tunnelSection, new Vector3(-10, -4, -64), 1.5, glbInstances);
  createDebrisPile(scene, tunnelSection, new Vector3(-13, -4.5, -67), 1.2, glbInstances);

  // Crystal formation lighting the way (procedural -- kept as MeshBuilder)
  createCrystalFormation(
    scene,
    tunnelSection,
    new Vector3(-12, -4.5, -66),
    1.0,
    materials,
    allMeshes,
    lights,
    'purple'
  );

  // Gas vent hazard area 1 with improved visuals
  const gasVent1 = MeshBuilder.CreateCylinder(
    'gasVent1',
    { height: 0.3, diameter: 3, tessellation: 16 },
    scene
  );
  gasVent1.position = MINE_POSITIONS.gasVent1.clone();
  gasVent1.material = materials.get('gas')!;
  gasVent1.parent = tunnelSection;
  allMeshes.push(gasVent1);

  // Gas vent glow light
  const gasLight1 = new PointLight('gasLight1', MINE_POSITIONS.gasVent1.add(new Vector3(0, 0.5, 0)), scene);
  gasLight1.diffuse = new Color3(0.3, 0.5, 0.1);
  gasLight1.intensity = 0.3;
  gasLight1.range = 6;
  lights.push(gasLight1);

  // Tunnel segment 3: Tunnel mid to second bend
  createTunnelSegment(
    scene,
    tunnelSection,
    TUNNEL_MID,
    TUNNEL_BEND_2,
    TUNNEL_WIDTH,
    TUNNEL_HEIGHT,
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // Tunnel mid-point widened area with minecart and supplies -> GLB
  createMinecart(scene, tunnelSection, new Vector3(-16, -5, -72), 1.2, glbInstances);

  // Abandoned supplies near minecart (environmental storytelling)
  placeGLBInstance(
    scene, tunnelSection, GLB_PATHS.toolbox, 'toolbox_tunnel',
    new Vector3(-17, -5, -71), glbInstances,
    { rotationY: 0.8, scale: new Vector3(0.5, 0.5, 0.5) }
  );

  // Gas vent hazard area 2 with improved visuals
  const gasVent2 = MeshBuilder.CreateCylinder(
    'gasVent2',
    { height: 0.3, diameter: 2.5, tessellation: 16 },
    scene
  );
  gasVent2.position = MINE_POSITIONS.gasVent2.clone();
  gasVent2.material = materials.get('gas')!;
  gasVent2.parent = tunnelSection;
  allMeshes.push(gasVent2);

  // Gas vent glow light
  const gasLight2 = new PointLight('gasLight2', MINE_POSITIONS.gasVent2.add(new Vector3(0, 0.5, 0)), scene);
  gasLight2.diffuse = new Color3(0.4, 0.6, 0.1);
  gasLight2.intensity = 0.35;
  gasLight2.range = 5;
  lights.push(gasLight2);

  // Crystal cluster mid-tunnel (procedural -- kept as MeshBuilder)
  createCrystalFormation(
    scene,
    tunnelSection,
    new Vector3(-18, -5, -74),
    0.9,
    materials,
    allMeshes,
    lights,
    'cyan'
  );
  createCrystalFormation(
    scene,
    tunnelSection,
    new Vector3(-14, -6, -78),
    0.6,
    materials,
    allMeshes,
    lights,
    'purple'
  );

  // Tunnel segment 4: Second bend to tunnel end (descending further)
  createTunnelSegment(
    scene,
    tunnelSection,
    TUNNEL_BEND_2,
    TUNNEL_END,
    TUNNEL_WIDTH - 0.5,
    TUNNEL_HEIGHT - 0.5,
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // Rockfall hazard areas with debris piles -> GLB
  createDebrisPile(scene, tunnelSection, MINE_POSITIONS.rockfall1.clone(), 1.0, glbInstances);
  createDebrisPile(scene, tunnelSection, MINE_POSITIONS.rockfall2.clone(), 1.3, glbInstances);

  // Cracked ground warning near rockfall areas
  const crackWarning1 = MeshBuilder.CreateDisc(
    'crackWarning1',
    { radius: 2.5, tessellation: 8 },
    scene
  );
  crackWarning1.position = MINE_POSITIONS.rockfall1.clone();
  crackWarning1.position.y += 0.02;
  crackWarning1.rotation.x = Math.PI / 2;
  crackWarning1.material = materials.get('debris')!;
  crackWarning1.parent = tunnelSection;
  allMeshes.push(crackWarning1);

  const crackWarning2 = MeshBuilder.CreateDisc(
    'crackWarning2',
    { radius: 2.0, tessellation: 8 },
    scene
  );
  crackWarning2.position = MINE_POSITIONS.rockfall2.clone();
  crackWarning2.position.y += 0.02;
  crackWarning2.rotation.x = Math.PI / 2;
  crackWarning2.material = materials.get('debris')!;
  crackWarning2.parent = tunnelSection;
  allMeshes.push(crackWarning2);

  // More alien resin (VFX decals -- kept as MeshBuilder)
  for (let i = 0; i < 6; i++) {
    const rp = new Vector3(
      TUNNEL_MID.x + (Math.random() - 0.5) * 8,
      TUNNEL_MID.y + Math.random() * 3,
      TUNNEL_MID.z + (Math.random() - 0.5) * 15
    );
    const resinPatch = MeshBuilder.CreateDisc(
      `tunnel_resin_${allMeshes.length}`,
      { radius: 0.3 + Math.random() * 0.6, tessellation: 8 },
      scene
    );
    resinPatch.position = rp;
    resinPatch.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, 0);
    resinPatch.material = materials.get('resin')!;
    resinPatch.parent = tunnelSection;
    allMeshes.push(resinPatch);
  }

  // Flooded section with improved water plane (VFX -- kept as MeshBuilder)
  const floodWater = MeshBuilder.CreateBox(
    'floodWater',
    { width: 14, height: 0.6, depth: 18 },
    scene
  );
  floodWater.position = MINE_POSITIONS.floodedArea.clone();
  floodWater.position.y -= 0.3;
  floodWater.material = materials.get('water')!;
  floodWater.parent = tunnelSection;
  allMeshes.push(floodWater);

  // Water surface reflection hint light
  const waterLight = new PointLight('waterLight', MINE_POSITIONS.floodedArea.add(new Vector3(0, 0.5, 0)), scene);
  waterLight.diffuse = new Color3(0.1, 0.2, 0.15);
  waterLight.intensity = 0.2;
  waterLight.range = 10;
  lights.push(waterLight);

  // Transition tunnel from tunnel end to shaft entry
  createTunnelSegment(
    scene,
    tunnelSection,
    TUNNEL_END,
    SHAFT_ENTRY,
    TUNNEL_WIDTH,
    TUNNEL_HEIGHT,
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // More crystals near shaft entrance - signaling something different ahead
  createCrystalFormation(
    scene,
    tunnelSection,
    new Vector3(-8, -11, -100),
    1.1,
    materials,
    allMeshes,
    lights,
    'purple'
  );
  createCrystalFormation(
    scene,
    tunnelSection,
    new Vector3(-12, -12, -105),
    0.8,
    materials,
    allMeshes,
    lights,
    'cyan'
  );

  // ===========================================================================
  // SECTION 3: DEEP SHAFT (Boss Arena)
  // ===========================================================================

  // Gate/door blocking shaft entry (requires keycard) -> GLB
  const gatePos = new Vector3(-10, -13 + (TUNNEL_HEIGHT - 0.3) / 2, -110);
  const gateNode = placeGLBInstance(
    scene,
    shaftSection,
    GLB_PATHS.gate,
    'shaftGate',
    gatePos,
    glbInstances,
    { scale: new Vector3((TUNNEL_WIDTH - 0.5) / 4, (TUNNEL_HEIGHT - 0.3) / 4, 0.3) }
  );
  // Interactable collision mesh for the gate
  const shaftGate = MeshBuilder.CreateBox(
    'shaftGate_collider',
    { width: TUNNEL_WIDTH - 0.5, height: TUNNEL_HEIGHT - 0.3, depth: 0.3 },
    scene
  );
  shaftGate.position = gatePos.clone();
  if (gateNode) {
    shaftGate.isVisible = false; // GLB provides visual, collider is invisible
  } else {
    shaftGate.material = materials.get('metal')!; // Fallback visual
  }
  shaftGate.parent = shaftSection;
  allMeshes.push(shaftGate);

  // Gate warning stripes (simple thin indicator -- kept as MeshBuilder)
  const gateStripe = MeshBuilder.CreateBox(
    'gateStripe',
    { width: TUNNEL_WIDTH - 0.5, height: 0.2, depth: 0.32 },
    scene
  );
  gateStripe.position = shaftGate.position.clone();
  gateStripe.position.y += 0.8;
  gateStripe.material = materials.get('caution')!;
  gateStripe.parent = shaftSection;
  allMeshes.push(gateStripe);

  // Short tunnel to shaft
  createTunnelSegment(
    scene,
    shaftSection,
    new Vector3(-10, -13, -110),
    new Vector3(-10, -15, -115),
    TUNNEL_WIDTH,
    TUNNEL_HEIGHT,
    materials,
    allMeshes,
    lights,
    flickerLights,
    glbInstances
  );

  // Deep Shaft room (25m x 25m x 30m tall)
  // Floor (terrain surface -- kept as MeshBuilder)
  const shaftFloor = MeshBuilder.CreateBox(
    'shaftFloor',
    { width: SHAFT_WIDTH, height: 0.4, depth: SHAFT_DEPTH },
    scene
  );
  shaftFloor.position = SHAFT_CENTER.clone();
  shaftFloor.position.y -= SHAFT_HEIGHT / 2;
  shaftFloor.material = materials.get('floor')!;
  shaftFloor.parent = shaftSection;
  allMeshes.push(shaftFloor);

  // Shaft walls (terrain/structural rock -- kept as MeshBuilder)
  const shaftWalls: Array<{ pos: Vector3; w: number; h: number; d: number }> = [
    // North wall (with entry)
    {
      pos: new Vector3(SHAFT_CENTER.x - 8, SHAFT_CENTER.y, SHAFT_CENTER.z + SHAFT_DEPTH / 2),
      w: 9,
      h: SHAFT_HEIGHT,
      d: 0.5,
    },
    {
      pos: new Vector3(SHAFT_CENTER.x + 8, SHAFT_CENTER.y, SHAFT_CENTER.z + SHAFT_DEPTH / 2),
      w: 9,
      h: SHAFT_HEIGHT,
      d: 0.5,
    },
    // South wall
    {
      pos: new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y, SHAFT_CENTER.z - SHAFT_DEPTH / 2),
      w: SHAFT_WIDTH,
      h: SHAFT_HEIGHT,
      d: 0.5,
    },
    // East wall
    {
      pos: new Vector3(SHAFT_CENTER.x + SHAFT_WIDTH / 2, SHAFT_CENTER.y, SHAFT_CENTER.z),
      w: 0.5,
      h: SHAFT_HEIGHT,
      d: SHAFT_DEPTH,
    },
    // West wall
    {
      pos: new Vector3(SHAFT_CENTER.x - SHAFT_WIDTH / 2, SHAFT_CENTER.y, SHAFT_CENTER.z),
      w: 0.5,
      h: SHAFT_HEIGHT,
      d: SHAFT_DEPTH,
    },
  ];

  for (const sw of shaftWalls) {
    const mesh = MeshBuilder.CreateBox(
      `shaftWall_${allMeshes.length}`,
      { width: sw.w, height: sw.h, depth: sw.d },
      scene
    );
    mesh.position = sw.pos.clone();
    mesh.material = materials.get('rock')!;
    mesh.parent = shaftSection;
    allMeshes.push(mesh);
  }

  // Shaft ceiling (terrain surface -- kept as MeshBuilder)
  const shaftCeiling = MeshBuilder.CreateBox(
    'shaftCeiling',
    { width: SHAFT_WIDTH, height: 0.5, depth: SHAFT_DEPTH },
    scene
  );
  shaftCeiling.position = SHAFT_CENTER.clone();
  shaftCeiling.position.y += SHAFT_HEIGHT / 2;
  shaftCeiling.material = materials.get('rock')!;
  shaftCeiling.parent = shaftSection;
  allMeshes.push(shaftCeiling);

  // Spiral descent ledges (player navigates down) -> GLB platforms + handrails
  const ledgeCount = 6;
  for (let i = 0; i < ledgeCount; i++) {
    const ledgeAngle = (i / ledgeCount) * Math.PI * 1.5;
    const radius = 8;
    const yOff = SHAFT_CENTER.y + SHAFT_HEIGHT / 2 - 3 - (i / ledgeCount) * (SHAFT_HEIGHT - 6);

    const ledgePos = new Vector3(
      SHAFT_CENTER.x + Math.cos(ledgeAngle) * radius,
      yOff,
      SHAFT_CENTER.z + Math.sin(ledgeAngle) * radius
    );

    // Ledge platform -> GLB
    placeGLBInstance(
      scene,
      shaftSection,
      GLB_PATHS.platformLedge,
      'ledge',
      ledgePos,
      glbInstances,
      {
        rotationY: ledgeAngle,
        scale: new Vector3(1.0, 0.4, 0.8),
      }
    );

    // Railing -> GLB handrail
    const railPos = ledgePos.clone();
    railPos.y += 0.7;
    railPos.x -= Math.sin(ledgeAngle) * 1.5;
    railPos.z += Math.cos(ledgeAngle) * 1.5;
    placeGLBInstance(
      scene,
      shaftSection,
      GLB_PATHS.handrail,
      'railing',
      railPos,
      glbInstances,
      {
        rotationY: ledgeAngle,
        scale: new Vector3(1.0, 1.0, 1.0),
      }
    );
  }

  // Large crystal formations in shaft (procedural -- kept as MeshBuilder)
  createCrystalFormation(
    scene,
    shaftSection,
    new Vector3(SHAFT_CENTER.x - 8, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z - 8),
    2.0,
    materials,
    allMeshes,
    lights,
    'cyan'
  );
  createCrystalFormation(
    scene,
    shaftSection,
    new Vector3(SHAFT_CENTER.x + 8, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z + 6),
    2.5,
    materials,
    allMeshes,
    lights,
    'purple'
  );
  createCrystalFormation(
    scene,
    shaftSection,
    new Vector3(SHAFT_CENTER.x + 3, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z - 10),
    1.8,
    materials,
    allMeshes,
    lights,
    'cyan'
  );
  createCrystalFormation(
    scene,
    shaftSection,
    new Vector3(SHAFT_CENTER.x - 10, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z + 4),
    1.5,
    materials,
    allMeshes,
    lights,
    'purple'
  );

  // Boss arena floor details - central mining rig (destroyed) -> GLB
  createDrillRig(
    scene,
    shaftSection,
    new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y - SHAFT_HEIGHT / 2 + 0.2, SHAFT_CENTER.z + 5),
    Math.PI / 4,
    glbInstances
  );

  // Boss arena door (blocks exit during boss fight) -> GLB
  const bossDoorPos = new Vector3(
    -10,
    -15 + TUNNEL_HEIGHT / 2,
    SHAFT_CENTER.z + SHAFT_DEPTH / 2 - 0.5
  );
  const bossDoorNode = placeGLBInstance(
    scene,
    shaftSection,
    GLB_PATHS.door,
    'bossArenaDoor',
    bossDoorPos,
    glbInstances,
    { scale: new Vector3(TUNNEL_WIDTH / 4, TUNNEL_HEIGHT / 4, 0.3) }
  );
  // Interactable collision mesh for boss arena door
  const bossArenaDoor = MeshBuilder.CreateBox(
    'bossArenaDoor_collider',
    { width: TUNNEL_WIDTH, height: TUNNEL_HEIGHT, depth: 0.3 },
    scene
  );
  bossArenaDoor.position = bossDoorPos.clone();
  bossArenaDoor.isVisible = false; // Hidden until boss fight starts
  if (!bossDoorNode) {
    bossArenaDoor.material = materials.get('metal')!;
  }
  bossArenaDoor.parent = shaftSection;
  allMeshes.push(bossArenaDoor);
  // Also hide the GLB instance until boss fight starts
  if (bossDoorNode) {
    bossDoorNode.setEnabled(false);
  }

  // Massive alien resin covering shaft walls (VFX decals -- kept as MeshBuilder)
  for (let i = 0; i < 12; i++) {
    const shaftResin = MeshBuilder.CreateDisc(
      `shaft_resin_${allMeshes.length}`,
      { radius: 1.0 + Math.random() * 1.5, tessellation: 8 },
      scene
    );
    const resinAngle = Math.random() * Math.PI * 2;
    const wallDist = SHAFT_WIDTH / 2 - 0.3;
    shaftResin.position.set(
      SHAFT_CENTER.x + Math.cos(resinAngle) * wallDist,
      SHAFT_CENTER.y + (Math.random() - 0.5) * SHAFT_HEIGHT * 0.8,
      SHAFT_CENTER.z + Math.sin(resinAngle) * wallDist
    );
    shaftResin.rotation.set(Math.random() * Math.PI, resinAngle + Math.PI / 2, 0);
    shaftResin.material = materials.get('resin')!;
    shaftResin.parent = shaftSection;
    allMeshes.push(shaftResin);
  }

  // Shaft emergency lights -> GLB lamp fixtures
  const shaftLightPositions = [
    new Vector3(SHAFT_CENTER.x - 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z - 10),
    new Vector3(SHAFT_CENTER.x + 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z + 10),
    new Vector3(SHAFT_CENTER.x - 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z + 10),
    new Vector3(SHAFT_CENTER.x + 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z - 10),
    new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y + 5, SHAFT_CENTER.z),
  ];

  for (const slp of shaftLightPositions) {
    placeGLBInstance(scene, shaftSection, GLB_PATHS.lampOn, 'shaft_lamp', slp, glbInstances, {
      scale: new Vector3(0.2, 0.2, 0.2),
    });

    const lamp = new PointLight(`shaft_light_${lights.length}`, slp.clone(), scene);
    lamp.diffuse = new Color3(1.0, 0.2, 0.1);
    lamp.intensity = 0.5;
    lamp.range = 15;
    lights.push(lamp);

    flickerLights.push({
      light: lamp,
      baseIntensity: 0.5,
      flickerSpeed: 4 + Math.random() * 6,
      flickerAmount: 0.4,
      timer: Math.random() * Math.PI * 2,
      isOff: false,
      offDuration: 0,
      offTimer: 0,
    });
  }

  // ===========================================================================
  // AUDIO LOG PICKUPS -> GLB audio_log model
  // ===========================================================================
  const audioLogMeshes: Mesh[] = [];

  for (const log of AUDIO_LOGS) {
    const logPos = log.position.clone();
    logPos.y += 0.8;
    const logNode = placeGLBInstance(
      scene,
      root,
      GLB_PATHS.audioLog,
      `audioLog_${log.id}`,
      logPos,
      glbInstances,
      { scale: new Vector3(0.3, 0.3, 0.3) }
    );

    // Create an invisible collision mesh for the interactable
    const logMesh = MeshBuilder.CreateBox(
      `audioLog_collider_${log.id}`,
      { width: 0.3, height: 0.3, depth: 0.3 },
      scene
    );
    logMesh.position = logPos.clone();
    logMesh.isVisible = false;
    if (!logNode) {
      throw new Error(`[MiningDepths] Failed to load audio log GLB: ${GLB_PATHS.audioLog}`);
    }
    logMesh.parent = root;
    allMeshes.push(logMesh);
    audioLogMeshes.push(logMesh);

    // Pickup glow light
    const logLight = new PointLight(
      `logLight_${log.id}`,
      log.position.add(new Vector3(0, 1, 0)),
      scene
    );
    logLight.diffuse = new Color3(0.2, 1.0, 0.5);
    logLight.intensity = 0.3;
    logLight.range = 4;
    lights.push(logLight);
  }

  // ===========================================================================
  // HAZARD VISUAL MARKERS (VFX -- kept as MeshBuilder)
  // ===========================================================================
  const hazardMeshes: Mesh[] = [];

  for (const hazard of HAZARD_ZONES) {
    if (hazard.type === 'gas_vent') {
      // Gas cloud visual already created above
      continue;
    }
    if (hazard.type === 'unstable_ground') {
      // Warning cracks in ground
      const crack = MeshBuilder.CreateDisc(
        `crack_${hazard.id}`,
        { radius: hazard.radius * 0.6, tessellation: 8 },
        scene
      );
      crack.position = hazard.center.clone();
      crack.position.y += 0.02;
      crack.rotation.x = Math.PI / 2;
      crack.material = materials.get('debris')!;
      crack.parent = root;
      allMeshes.push(crack);
      hazardMeshes.push(crack);
    }
    if (hazard.type === 'flooded') {
    }
  }

  // ===========================================================================
  // DISPOSE
  // ===========================================================================

  const dispose = (): void => {
    for (const mesh of allMeshes) {
      mesh.dispose();
    }
    for (const node of glbInstances) {
      node.dispose(false, true);
    }
    for (const light of lights) {
      light.dispose();
    }
    for (const mat of materials.values()) {
      mat.dispose();
    }
    root.dispose();
  };

  return {
    root,
    allMeshes,
    materials,
    lights,
    flickerLights,
    sections: {
      entry: entrySection,
      hub: hubSection,
      tunnels: tunnelSection,
      shaft: shaftSection,
    },
    keycardPickup,
    shaftGate,
    audioLogMeshes,
    hazardMeshes,
    bossArenaDoor,
    glbInstances,
    dispose,
  };
}
