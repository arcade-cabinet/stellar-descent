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
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

// ============================================================================
// Layout Constants (all in meters)
// ============================================================================
//
// ENTRY ELEVATOR SHAFT (arrives from surface)
//     |
// MINING HUB (40m x 30m) - Central processing area, branching tunnels
//     |
// COLLAPSED TUNNELS (winding 60m passage) - Debris navigation, cave-ins
//     |
// DEEP SHAFT (25m x 25m, 30m tall) - Vertical descent, boss arena
//
// ============================================================================

// Section centers
const ENTRY_CENTER = new Vector3(0, 0, 0);
const HUB_CENTER = new Vector3(0, 0, -25);
const TUNNEL_START = new Vector3(0, 0, -50);
const TUNNEL_MID = new Vector3(-15, -5, -70);
const TUNNEL_END = new Vector3(-10, -10, -95);
const SHAFT_CENTER = new Vector3(-10, -15, -120);

// Room dimensions
const HUB_WIDTH = 40;
const HUB_DEPTH = 30;
const HUB_HEIGHT = 8;

const TUNNEL_WIDTH = 5;
const TUNNEL_HEIGHT = 4;

const SHAFT_WIDTH = 25;
const SHAFT_DEPTH = 25;
const SHAFT_HEIGHT = 30;

// Exported positions for level scripting
export const MINE_POSITIONS = {
  entry: ENTRY_CENTER.clone(),
  hubCenter: HUB_CENTER.clone(),
  hubTerminal: new Vector3(-12, 0, -20),
  hubKeycard: new Vector3(14, 0, -30),
  tunnelStart: TUNNEL_START.clone(),
  tunnelMid: TUNNEL_MID.clone(),
  tunnelEnd: TUNNEL_END.clone(),
  shaftCenter: SHAFT_CENTER.clone(),
  shaftFloor: new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y - SHAFT_HEIGHT / 2 + 1, SHAFT_CENTER.z),
  shaftBossSpawn: new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y - SHAFT_HEIGHT / 2 + 3, SHAFT_CENTER.z),
  // Audio log pickup locations
  audioLog1: new Vector3(8, 0, -18),
  audioLog2: new Vector3(-15, -5, -75),
  audioLog3: new Vector3(-10, -15, -115),
  // Gas vent hazard positions
  gasVent1: new Vector3(-5, 0, -55),
  gasVent2: new Vector3(-18, -5, -80),
  // Unstable ground hazard positions
  rockfall1: new Vector3(5, 0, -60),
  rockfall2: new Vector3(-12, -8, -90),
  // Flooded section
  floodedArea: new Vector3(-10, -12, -105),
  // Burrower spawn positions
  burrowerSpawn1: new Vector3(10, 0, -35),
  burrowerSpawn2: new Vector3(-20, -5, -65),
  burrowerSpawn3: new Vector3(-5, -10, -100),
  burrowerSpawn4: new Vector3(-15, -15, -125),
  burrowerSpawn5: new Vector3(-5, -15, -115),
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
  dispose: () => void;
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
  flickerLights: FlickerLightDef[]
): void {
  const dir = end.subtract(start);
  const length = dir.length();
  const mid = start.add(dir.scale(0.5));
  const angle = Math.atan2(dir.x, dir.z);

  // Floor
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

  // Left wall
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

  // Right wall
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

  // Ceiling (arched via box)
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

  // Support beams every 6 meters
  const beamCount = Math.floor(length / 6);
  for (let i = 0; i <= beamCount; i++) {
    const t = beamCount > 0 ? i / beamCount : 0.5;
    const beamPos = start.add(dir.scale(t));

    // Left beam
    const lBeam = MeshBuilder.CreateBox(
      `beam_l_${allMeshes.length}`,
      { width: 0.2, height, depth: 0.2 },
      scene
    );
    lBeam.position = beamPos.clone();
    lBeam.position.y += height / 2;
    lBeam.position.x += Math.cos(angle) * (width / 2 - 0.1);
    lBeam.position.z -= Math.sin(angle) * (width / 2 - 0.1);
    lBeam.material = materials.get('metal')!;
    lBeam.parent = parent;
    allMeshes.push(lBeam);

    // Right beam
    const rBeam = MeshBuilder.CreateBox(
      `beam_r_${allMeshes.length}`,
      { width: 0.2, height, depth: 0.2 },
      scene
    );
    rBeam.position = beamPos.clone();
    rBeam.position.y += height / 2;
    rBeam.position.x -= Math.cos(angle) * (width / 2 - 0.1);
    rBeam.position.z += Math.sin(angle) * (width / 2 - 0.1);
    rBeam.material = materials.get('metal')!;
    rBeam.parent = parent;
    allMeshes.push(rBeam);

    // Cross beam
    const crossBeam = MeshBuilder.CreateBox(
      `beam_cross_${allMeshes.length}`,
      { width: width - 0.2, height: 0.15, depth: 0.2 },
      scene
    );
    crossBeam.position = beamPos.clone();
    crossBeam.position.y += height - 0.1;
    crossBeam.rotation.y = angle;
    crossBeam.material = materials.get('metal')!;
    crossBeam.parent = parent;
    allMeshes.push(crossBeam);
  }

  // Mining lamp lights every 8 meters
  const lampCount = Math.max(1, Math.floor(length / 8));
  for (let i = 0; i < lampCount; i++) {
    const t = (i + 0.5) / lampCount;
    const lampPos = start.add(dir.scale(t));
    lampPos.y += height - 0.5;

    // Lamp fixture
    const lampMesh = MeshBuilder.CreateSphere(
      `lamp_${allMeshes.length}`,
      { diameter: 0.25, segments: 8 },
      scene
    );
    lampMesh.position = lampPos.clone();
    lampMesh.material = materials.get('emergency')!;
    lampMesh.parent = parent;
    allMeshes.push(lampMesh);

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
  const matKey = variant === 'cyan' ? 'crystal' : 'crystal_purple';
  const lightColor =
    variant === 'cyan' ? new Color3(0.1, 0.6, 0.8) : new Color3(0.5, 0.2, 0.8);

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
    const angle = (i / shardCount) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 0.3 * scale + Math.random() * 0.3 * scale;
    shard.position = position.clone();
    shard.position.x += Math.cos(angle) * dist;
    shard.position.z += Math.sin(angle) * dist;
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
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): void {
  // Cart body (open-top box)
  const body = MeshBuilder.CreateBox(
    `cart_${allMeshes.length}`,
    { width: 1.2, height: 0.8, depth: 1.8 },
    scene
  );
  body.position = position.clone();
  body.position.y += 0.6;
  body.rotation.y = rotationY;
  body.material = materials.get('cart')!;
  body.parent = parent;
  allMeshes.push(body);

  // Wheels (4 cylinders)
  for (let w = 0; w < 4; w++) {
    const wheel = MeshBuilder.CreateCylinder(
      `cartwheel_${allMeshes.length}`,
      { height: 0.08, diameter: 0.3, tessellation: 8 },
      scene
    );
    const wx = w < 2 ? -0.5 : 0.5;
    const wz = w % 2 === 0 ? -0.6 : 0.6;
    wheel.position = position.clone();
    wheel.position.x += wx * Math.cos(rotationY) - wz * Math.sin(rotationY);
    wheel.position.z += wx * Math.sin(rotationY) + wz * Math.cos(rotationY);
    wheel.position.y += 0.15;
    wheel.rotation.z = Math.PI / 2;
    wheel.material = materials.get('track')!;
    wheel.parent = parent;
    allMeshes.push(wheel);
  }
}

function createDrillRig(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  rotationY: number,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): void {
  // Base platform
  const base = MeshBuilder.CreateBox(
    `drill_base_${allMeshes.length}`,
    { width: 3, height: 0.4, depth: 3 },
    scene
  );
  base.position = position.clone();
  base.position.y += 0.2;
  base.rotation.y = rotationY;
  base.material = materials.get('equipment')!;
  base.parent = parent;
  allMeshes.push(base);

  // Vertical arm
  const arm = MeshBuilder.CreateBox(
    `drill_arm_${allMeshes.length}`,
    { width: 0.5, height: 4, depth: 0.5 },
    scene
  );
  arm.position = position.clone();
  arm.position.y += 2.4;
  arm.rotation.y = rotationY;
  arm.material = materials.get('metal')!;
  arm.parent = parent;
  allMeshes.push(arm);

  // Drill bit (cone)
  const bit = MeshBuilder.CreateCylinder(
    `drill_bit_${allMeshes.length}`,
    { height: 1.5, diameterTop: 0, diameterBottom: 0.6, tessellation: 8 },
    scene
  );
  bit.position = position.clone();
  bit.position.y += 0.75;
  bit.position.z -= Math.cos(rotationY) * 1.5;
  bit.position.x -= Math.sin(rotationY) * 1.5;
  bit.rotation.x = Math.PI / 2;
  bit.rotation.y = rotationY;
  bit.material = materials.get('metal')!;
  bit.parent = parent;
  allMeshes.push(bit);

  // Hydraulic pistons
  for (let i = 0; i < 2; i++) {
    const piston = MeshBuilder.CreateCylinder(
      `drill_piston_${allMeshes.length}`,
      { height: 2, diameter: 0.15, tessellation: 8 },
      scene
    );
    piston.position = position.clone();
    piston.position.y += 2;
    piston.position.x += (i === 0 ? -0.4 : 0.4) * Math.cos(rotationY);
    piston.position.z += (i === 0 ? -0.4 : 0.4) * Math.sin(rotationY);
    piston.rotation.x = 0.3;
    piston.material = materials.get('metal')!;
    piston.parent = parent;
    allMeshes.push(piston);
  }
}

function createDebrisPile(
  scene: Scene,
  parent: TransformNode,
  position: Vector3,
  scale: number,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): void {
  const count = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i++) {
    const size = (0.3 + Math.random() * 0.8) * scale;
    const rock = MeshBuilder.CreateBox(
      `debris_${allMeshes.length}`,
      {
        width: size * (0.8 + Math.random() * 0.4),
        height: size * (0.5 + Math.random() * 0.5),
        depth: size * (0.8 + Math.random() * 0.4),
      },
      scene
    );
    rock.position = position.clone();
    rock.position.x += (Math.random() - 0.5) * 3 * scale;
    rock.position.z += (Math.random() - 0.5) * 3 * scale;
    rock.position.y += size * 0.25;
    rock.rotation.set(
      Math.random() * Math.PI * 0.3,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 0.3
    );
    rock.material = materials.get('debris')!;
    rock.parent = parent;
    allMeshes.push(rock);
  }
}

// ============================================================================
// Main Environment Creation
// ============================================================================

export function createMiningEnvironment(scene: Scene): MiningEnvironment {
  const root = new TransformNode('miningDepths', scene);
  const materials = createMiningMaterials(scene);
  const allMeshes: Mesh[] = [];
  const lights: PointLight[] = [];
  const flickerLights: FlickerLightDef[] = [];

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

  // Entry elevator shaft - player arrives from surface
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

  // Elevator platform (destroyed)
  const elevatorPlatform = MeshBuilder.CreateBox(
    'elevatorPlatform',
    { width: 3, height: 0.3, depth: 3 },
    scene
  );
  elevatorPlatform.position = ENTRY_CENTER.clone();
  elevatorPlatform.position.y = 0.15;
  elevatorPlatform.rotation.z = 0.08;
  elevatorPlatform.material = materials.get('metal')!;
  elevatorPlatform.parent = entrySection;
  allMeshes.push(elevatorPlatform);

  // Destroyed elevator cable
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
    scene, entrySection,
    ENTRY_CENTER, new Vector3(0, 0, -10),
    TUNNEL_WIDTH, TUNNEL_HEIGHT,
    materials, allMeshes, lights, flickerLights
  );

  // ------ MINING HUB (40m x 30m x 8m) ------
  // Large open room - central processing area

  // Floor
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

  // Ceiling
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

  // Hub walls (rock)
  const hubWalls: Array<{ pos: Vector3; w: number; d: number; ry: number }> = [
    // North wall (with entry opening)
    {
      pos: new Vector3(-12, HUB_HEIGHT / 2, HUB_CENTER.z + HUB_DEPTH / 2),
      w: 16, d: 0.5, ry: 0,
    },
    {
      pos: new Vector3(12, HUB_HEIGHT / 2, HUB_CENTER.z + HUB_DEPTH / 2),
      w: 16, d: 0.5, ry: 0,
    },
    // South wall (with tunnel exit opening)
    {
      pos: new Vector3(-12, HUB_HEIGHT / 2, HUB_CENTER.z - HUB_DEPTH / 2),
      w: 16, d: 0.5, ry: 0,
    },
    {
      pos: new Vector3(12, HUB_HEIGHT / 2, HUB_CENTER.z - HUB_DEPTH / 2),
      w: 16, d: 0.5, ry: 0,
    },
    // East wall
    {
      pos: new Vector3(HUB_CENTER.x + HUB_WIDTH / 2, HUB_HEIGHT / 2, HUB_CENTER.z),
      w: 0.5, d: HUB_DEPTH, ry: 0,
    },
    // West wall
    {
      pos: new Vector3(HUB_CENTER.x - HUB_WIDTH / 2, HUB_HEIGHT / 2, HUB_CENTER.z),
      w: 0.5, d: HUB_DEPTH, ry: 0,
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

  // Hub support columns (4 large pillars)
  const pillarPositions = [
    new Vector3(HUB_CENTER.x - 10, 0, HUB_CENTER.z - 6),
    new Vector3(HUB_CENTER.x + 10, 0, HUB_CENTER.z - 6),
    new Vector3(HUB_CENTER.x - 10, 0, HUB_CENTER.z + 6),
    new Vector3(HUB_CENTER.x + 10, 0, HUB_CENTER.z + 6),
  ];

  for (const pp of pillarPositions) {
    const pillar = MeshBuilder.CreateBox(
      `pillar_${allMeshes.length}`,
      { width: 1.5, height: HUB_HEIGHT, depth: 1.5 },
      scene
    );
    pillar.position = pp.clone();
    pillar.position.y = HUB_HEIGHT / 2;
    pillar.material = materials.get('rock')!;
    pillar.parent = hubSection;
    allMeshes.push(pillar);
  }

  // Mining equipment in hub
  createDrillRig(scene, hubSection, new Vector3(8, 0, -20), 0, materials, allMeshes);
  createDrillRig(scene, hubSection, new Vector3(-8, 0, -28), Math.PI / 3, materials, allMeshes);

  // Conveyor belt fragment
  const conveyor = MeshBuilder.CreateBox(
    'conveyor',
    { width: 2, height: 1, depth: 8 },
    scene
  );
  conveyor.position.set(0, 0.5, HUB_CENTER.z + 5);
  conveyor.material = materials.get('equipment')!;
  conveyor.parent = hubSection;
  allMeshes.push(conveyor);

  // Scattered crates
  const cratePositions = [
    new Vector3(5, 0.4, -15),
    new Vector3(-6, 0.4, -22),
    new Vector3(12, 0.4, -18),
    new Vector3(-14, 0.4, -32),
    new Vector3(6, 0.8, -16),
  ];
  for (const cp of cratePositions) {
    const size = 0.6 + Math.random() * 0.4;
    const crate = MeshBuilder.CreateBox(
      `crate_${allMeshes.length}`,
      { width: size, height: size, depth: size },
      scene
    );
    crate.position = cp.clone();
    crate.rotation.y = Math.random() * Math.PI;
    crate.material = materials.get('equipment')!;
    crate.parent = hubSection;
    allMeshes.push(crate);
  }

  // Minecart tracks through hub
  createMinecartTrack(
    scene, hubSection,
    [
      new Vector3(-18, 0, -12),
      new Vector3(-10, 0, -15),
      new Vector3(0, 0, -20),
      new Vector3(10, 0, -25),
      new Vector3(15, 0, -30),
    ],
    materials, allMeshes
  );

  // Minecarts
  createMinecart(scene, hubSection, new Vector3(-14, 0, -13), 0.3, materials, allMeshes);
  createMinecart(scene, hubSection, new Vector3(12, 0, -26), 0.8, materials, allMeshes);

  // Crystal formations in hub (natural light sources)
  createCrystalFormation(
    scene, hubSection,
    new Vector3(-16, 0, -18), 1.5,
    materials, allMeshes, lights, 'cyan'
  );
  createCrystalFormation(
    scene, hubSection,
    new Vector3(16, 0, -30), 1.2,
    materials, allMeshes, lights, 'purple'
  );
  createCrystalFormation(
    scene, hubSection,
    new Vector3(-5, 0, -35), 0.8,
    materials, allMeshes, lights, 'cyan'
  );

  // Hub emergency lights
  const hubEmergencyPositions = [
    new Vector3(-15, HUB_HEIGHT - 0.5, HUB_CENTER.z - 5),
    new Vector3(15, HUB_HEIGHT - 0.5, HUB_CENTER.z + 5),
    new Vector3(0, HUB_HEIGHT - 0.5, HUB_CENTER.z),
    new Vector3(-10, HUB_HEIGHT - 0.5, HUB_CENTER.z + 10),
    new Vector3(10, HUB_HEIGHT - 0.5, HUB_CENTER.z - 10),
  ];

  for (const elp of hubEmergencyPositions) {
    const lampMesh = MeshBuilder.CreateSphere(
      `hub_lamp_${allMeshes.length}`,
      { diameter: 0.3, segments: 8 },
      scene
    );
    lampMesh.position = elp.clone();
    lampMesh.material = materials.get('emergency')!;
    lampMesh.parent = hubSection;
    allMeshes.push(lampMesh);

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

  // Keycard pickup location (glowing item)
  const keycardPickup = MeshBuilder.CreateBox(
    'keycardPickup',
    { width: 0.3, height: 0.05, depth: 0.2 },
    scene
  );
  keycardPickup.position = MINE_POSITIONS.hubKeycard.clone();
  keycardPickup.position.y = 1.0;
  keycardPickup.material = materials.get('log_glow')!;
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

  // Alien resin patches (environmental storytelling - infestation signs)
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
    resinPatch.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI * 2,
      0
    );
    resinPatch.material = materials.get('resin')!;
    resinPatch.parent = hubSection;
    allMeshes.push(resinPatch);
  }

  // ===========================================================================
  // SECTION 2: COLLAPSED TUNNELS
  // ===========================================================================

  // Tunnel from hub to collapsed area
  createTunnelSegment(
    scene, tunnelSection,
    TUNNEL_START, new Vector3(-5, -2, -58),
    TUNNEL_WIDTH, TUNNEL_HEIGHT,
    materials, allMeshes, lights, flickerLights
  );

  // Debris pile at start of collapsed area
  createDebrisPile(scene, tunnelSection, new Vector3(-3, -1, -55), 1.2, materials, allMeshes);

  // Collapsed tunnel segment 1 (narrower, lower ceiling)
  createTunnelSegment(
    scene, tunnelSection,
    new Vector3(-5, -2, -58), new Vector3(-12, -4, -68),
    TUNNEL_WIDTH - 1, TUNNEL_HEIGHT - 1,
    materials, allMeshes, lights, flickerLights
  );

  // More debris and cave-in rocks
  createDebrisPile(scene, tunnelSection, new Vector3(-8, -3, -62), 1.5, materials, allMeshes);

  // Crystal formation lighting the way
  createCrystalFormation(
    scene, tunnelSection,
    new Vector3(-10, -4, -66), 1.0,
    materials, allMeshes, lights, 'purple'
  );

  // Gas vent hazard area 1
  const gasVent1 = MeshBuilder.CreateCylinder(
    'gasVent1',
    { height: 0.2, diameter: 2, tessellation: 12 },
    scene
  );
  gasVent1.position = MINE_POSITIONS.gasVent1.clone();
  gasVent1.material = materials.get('gas')!;
  gasVent1.parent = tunnelSection;
  allMeshes.push(gasVent1);

  // Collapsed tunnel segment 2
  createTunnelSegment(
    scene, tunnelSection,
    new Vector3(-12, -4, -68), TUNNEL_MID,
    TUNNEL_WIDTH, TUNNEL_HEIGHT,
    materials, allMeshes, lights, flickerLights
  );

  // Tunnel mid-point widened area with minecart
  createMinecart(scene, tunnelSection, new Vector3(-16, -5, -72), 1.2, materials, allMeshes);

  // Gas vent hazard area 2
  const gasVent2 = MeshBuilder.CreateCylinder(
    'gasVent2',
    { height: 0.2, diameter: 1.5, tessellation: 12 },
    scene
  );
  gasVent2.position = MINE_POSITIONS.gasVent2.clone();
  gasVent2.material = materials.get('gas')!;
  gasVent2.parent = tunnelSection;
  allMeshes.push(gasVent2);

  // Crystal cluster mid-tunnel
  createCrystalFormation(
    scene, tunnelSection,
    new Vector3(-18, -5, -74), 0.7,
    materials, allMeshes, lights, 'cyan'
  );

  // Collapsed tunnel segment 3 (descending further)
  createTunnelSegment(
    scene, tunnelSection,
    TUNNEL_MID, new Vector3(-12, -8, -85),
    TUNNEL_WIDTH - 0.5, TUNNEL_HEIGHT - 0.5,
    materials, allMeshes, lights, flickerLights
  );

  // Rockfall hazard areas
  createDebrisPile(scene, tunnelSection, MINE_POSITIONS.rockfall1.clone(), 1.0, materials, allMeshes);
  createDebrisPile(scene, tunnelSection, MINE_POSITIONS.rockfall2.clone(), 1.3, materials, allMeshes);

  // More alien resin
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
    resinPatch.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI * 2,
      0
    );
    resinPatch.material = materials.get('resin')!;
    resinPatch.parent = tunnelSection;
    allMeshes.push(resinPatch);
  }

  // Final tunnel segment to deep shaft
  createTunnelSegment(
    scene, tunnelSection,
    new Vector3(-12, -8, -85), TUNNEL_END,
    TUNNEL_WIDTH, TUNNEL_HEIGHT,
    materials, allMeshes, lights, flickerLights
  );

  // Flooded section
  const floodWater = MeshBuilder.CreateBox(
    'floodWater',
    { width: 12, height: 0.5, depth: 15 },
    scene
  );
  floodWater.position = MINE_POSITIONS.floodedArea.clone();
  floodWater.position.y -= 0.25;
  floodWater.material = materials.get('water')!;
  floodWater.parent = tunnelSection;
  allMeshes.push(floodWater);

  // Transition tunnel from collapsed to shaft
  createTunnelSegment(
    scene, tunnelSection,
    TUNNEL_END, new Vector3(-10, -13, -108),
    TUNNEL_WIDTH, TUNNEL_HEIGHT,
    materials, allMeshes, lights, flickerLights
  );

  // ===========================================================================
  // SECTION 3: DEEP SHAFT (Boss Arena)
  // ===========================================================================

  // Gate/door blocking shaft entry (requires keycard)
  const shaftGate = MeshBuilder.CreateBox(
    'shaftGate',
    { width: TUNNEL_WIDTH - 0.5, height: TUNNEL_HEIGHT - 0.3, depth: 0.3 },
    scene
  );
  shaftGate.position = new Vector3(-10, -13 + (TUNNEL_HEIGHT - 0.3) / 2, -110);
  shaftGate.material = materials.get('metal')!;
  shaftGate.parent = shaftSection;
  allMeshes.push(shaftGate);

  // Gate warning stripes
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
    scene, shaftSection,
    new Vector3(-10, -13, -110), new Vector3(-10, -15, -115),
    TUNNEL_WIDTH, TUNNEL_HEIGHT,
    materials, allMeshes, lights, flickerLights
  );

  // Deep Shaft room (25m x 25m x 30m tall)
  // Floor (bottom of shaft)
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

  // Shaft walls (tall rock)
  const shaftWalls: Array<{ pos: Vector3; w: number; h: number; d: number }> = [
    // North wall (with entry)
    {
      pos: new Vector3(SHAFT_CENTER.x - 8, SHAFT_CENTER.y, SHAFT_CENTER.z + SHAFT_DEPTH / 2),
      w: 9, h: SHAFT_HEIGHT, d: 0.5,
    },
    {
      pos: new Vector3(SHAFT_CENTER.x + 8, SHAFT_CENTER.y, SHAFT_CENTER.z + SHAFT_DEPTH / 2),
      w: 9, h: SHAFT_HEIGHT, d: 0.5,
    },
    // South wall
    {
      pos: new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y, SHAFT_CENTER.z - SHAFT_DEPTH / 2),
      w: SHAFT_WIDTH, h: SHAFT_HEIGHT, d: 0.5,
    },
    // East wall
    {
      pos: new Vector3(SHAFT_CENTER.x + SHAFT_WIDTH / 2, SHAFT_CENTER.y, SHAFT_CENTER.z),
      w: 0.5, h: SHAFT_HEIGHT, d: SHAFT_DEPTH,
    },
    // West wall
    {
      pos: new Vector3(SHAFT_CENTER.x - SHAFT_WIDTH / 2, SHAFT_CENTER.y, SHAFT_CENTER.z),
      w: 0.5, h: SHAFT_HEIGHT, d: SHAFT_DEPTH,
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

  // Shaft ceiling (open to above - high rock dome)
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

  // Spiral descent ledges (player navigates down)
  const ledgeCount = 6;
  for (let i = 0; i < ledgeCount; i++) {
    const angle = (i / ledgeCount) * Math.PI * 1.5;
    const radius = 8;
    const yOff = SHAFT_CENTER.y + SHAFT_HEIGHT / 2 - 3 - (i / ledgeCount) * (SHAFT_HEIGHT - 6);

    const ledge = MeshBuilder.CreateBox(
      `ledge_${allMeshes.length}`,
      { width: 4, height: 0.4, depth: 3 },
      scene
    );
    ledge.position.set(
      SHAFT_CENTER.x + Math.cos(angle) * radius,
      yOff,
      SHAFT_CENTER.z + Math.sin(angle) * radius
    );
    ledge.rotation.y = angle;
    ledge.material = materials.get('rock')!;
    ledge.parent = shaftSection;
    allMeshes.push(ledge);

    // Railing
    const railing = MeshBuilder.CreateBox(
      `railing_${allMeshes.length}`,
      { width: 4, height: 1, depth: 0.1 },
      scene
    );
    railing.position = ledge.position.clone();
    railing.position.y += 0.7;
    railing.position.x -= Math.sin(angle) * 1.5;
    railing.position.z += Math.cos(angle) * 1.5;
    railing.rotation.y = angle;
    railing.material = materials.get('metal')!;
    railing.parent = shaftSection;
    allMeshes.push(railing);
  }

  // Large crystal formations in shaft (lighting)
  createCrystalFormation(
    scene, shaftSection,
    new Vector3(SHAFT_CENTER.x - 8, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z - 8),
    2.0, materials, allMeshes, lights, 'cyan'
  );
  createCrystalFormation(
    scene, shaftSection,
    new Vector3(SHAFT_CENTER.x + 8, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z + 6),
    2.5, materials, allMeshes, lights, 'purple'
  );
  createCrystalFormation(
    scene, shaftSection,
    new Vector3(SHAFT_CENTER.x + 3, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z - 10),
    1.8, materials, allMeshes, lights, 'cyan'
  );
  createCrystalFormation(
    scene, shaftSection,
    new Vector3(SHAFT_CENTER.x - 10, SHAFT_CENTER.y - SHAFT_HEIGHT / 2, SHAFT_CENTER.z + 4),
    1.5, materials, allMeshes, lights, 'purple'
  );

  // Boss arena floor details
  // Central mining rig (destroyed)
  createDrillRig(
    scene, shaftSection,
    new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y - SHAFT_HEIGHT / 2 + 0.2, SHAFT_CENTER.z + 5),
    Math.PI / 4, materials, allMeshes
  );

  // Boss arena door (blocks exit during boss fight)
  const bossArenaDoor = MeshBuilder.CreateBox(
    'bossArenaDoor',
    { width: TUNNEL_WIDTH, height: TUNNEL_HEIGHT, depth: 0.3 },
    scene
  );
  bossArenaDoor.position = new Vector3(-10, -15 + TUNNEL_HEIGHT / 2, SHAFT_CENTER.z + SHAFT_DEPTH / 2 - 0.5);
  bossArenaDoor.material = materials.get('metal')!;
  bossArenaDoor.parent = shaftSection;
  bossArenaDoor.isVisible = false; // Hidden until boss fight starts
  allMeshes.push(bossArenaDoor);

  // Massive alien resin covering shaft walls (heavy infestation)
  for (let i = 0; i < 12; i++) {
    const shaftResin = MeshBuilder.CreateDisc(
      `shaft_resin_${allMeshes.length}`,
      { radius: 1.0 + Math.random() * 1.5, tessellation: 8 },
      scene
    );
    const angle = Math.random() * Math.PI * 2;
    const wallDist = SHAFT_WIDTH / 2 - 0.3;
    shaftResin.position.set(
      SHAFT_CENTER.x + Math.cos(angle) * wallDist,
      SHAFT_CENTER.y + (Math.random() - 0.5) * SHAFT_HEIGHT * 0.8,
      SHAFT_CENTER.z + Math.sin(angle) * wallDist
    );
    shaftResin.rotation.set(
      Math.random() * Math.PI,
      angle + Math.PI / 2,
      0
    );
    shaftResin.material = materials.get('resin')!;
    shaftResin.parent = shaftSection;
    allMeshes.push(shaftResin);
  }

  // Shaft emergency lights (more intense, for boss fight visibility)
  const shaftLightPositions = [
    new Vector3(SHAFT_CENTER.x - 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z - 10),
    new Vector3(SHAFT_CENTER.x + 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z + 10),
    new Vector3(SHAFT_CENTER.x - 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z + 10),
    new Vector3(SHAFT_CENTER.x + 10, SHAFT_CENTER.y - 5, SHAFT_CENTER.z - 10),
    new Vector3(SHAFT_CENTER.x, SHAFT_CENTER.y + 5, SHAFT_CENTER.z),
  ];

  for (const slp of shaftLightPositions) {
    const lampMesh = MeshBuilder.CreateSphere(
      `shaft_lamp_${allMeshes.length}`,
      { diameter: 0.35, segments: 8 },
      scene
    );
    lampMesh.position = slp.clone();
    lampMesh.material = materials.get('emergency')!;
    lampMesh.parent = shaftSection;
    allMeshes.push(lampMesh);

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
  // AUDIO LOG PICKUPS (glowing collectible markers)
  // ===========================================================================
  const audioLogMeshes: Mesh[] = [];

  for (const log of AUDIO_LOGS) {
    const logMesh = MeshBuilder.CreateBox(
      `audioLog_${log.id}`,
      { width: 0.2, height: 0.12, depth: 0.15 },
      scene
    );
    logMesh.position = log.position.clone();
    logMesh.position.y += 0.8;
    logMesh.material = materials.get('log_glow')!;
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
  // HAZARD VISUAL MARKERS
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
      // Water already created above
      continue;
    }
  }

  // ===========================================================================
  // DISPOSE
  // ===========================================================================

  const dispose = (): void => {
    for (const mesh of allMeshes) {
      mesh.dispose();
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
    dispose,
  };
}
