/**
 * Southern Ice Environment - Procedural frozen wasteland generation
 *
 * Creates the frozen landscape of LV-847's southern continent:
 * - Ice/snow terrain with BabylonJS procedural materials
 * - Blizzard particle system (snow, wind, ice particles)
 * - Ice sheet material (reflective, transparent edges)
 * - Frozen structures (abandoned research outpost)
 * - Aurora borealis (animated emissive sky elements)
 * - Temperature zones (warm near heat sources, cold in open)
 * - Ice cave geometry for shelter
 * - Frozen waterfall formations
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Particles/particleSystemComponent';

// ============================================================================
// TYPES
// ============================================================================

export interface TemperatureZone {
  id: string;
  position: Vector3;
  radius: number;
  /** Temperature offset: positive = warmer, negative = colder */
  temperatureOffset: number;
  /** Whether this is a heat source (campfire, heater, etc.) */
  isHeatSource: boolean;
  /** Visual indicator mesh */
  indicator?: Mesh;
  /** Light source for heat emitters */
  light?: PointLight;
}

export interface IceEnvironmentConfig {
  terrainSize: number;
  terrainSubdivisions: number;
  cavePositions: Vector3[];
  outpostPosition: Vector3;
  frozenLakeCenter: Vector3;
  frozenLakeRadius: number;
  heatSourcePositions: Vector3[];
}

export interface IceEnvironment {
  terrain: Mesh;
  skyDome: Mesh;
  frozenLake: Mesh;
  iceCaves: TransformNode[];
  outpost: TransformNode;
  frozenWaterfalls: Mesh[];
  iceFormations: Mesh[];
  temperatureZones: TemperatureZone[];
  auroraNodes: TransformNode[];
  blizzardSystem: ParticleSystem | null;
  snowSystem: ParticleSystem | null;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: IceEnvironmentConfig = {
  terrainSize: 600,
  terrainSubdivisions: 64,
  cavePositions: [
    new Vector3(-80, 0, -120),
    new Vector3(60, 0, -200),
    new Vector3(-30, 0, -280),
  ],
  outpostPosition: new Vector3(40, 0, -50),
  frozenLakeCenter: new Vector3(0, -0.5, -160),
  frozenLakeRadius: 60,
  heatSourcePositions: [
    new Vector3(40, 0, -50),   // Outpost heater
    new Vector3(-80, 0, -120), // Cave 1 entrance
    new Vector3(60, 0, -200),  // Cave 2 interior
    new Vector3(-30, 0, -280), // Cave 3 interior
    new Vector3(0, 0, -80),    // Mid-field barrel fire
  ],
};

// ============================================================================
// MATERIAL CREATION
// ============================================================================

/**
 * Create reflective, semi-transparent ice sheet material.
 * Used for frozen lake surfaces and icicle formations.
 */
export function createIceSheetMaterial(scene: Scene, name = 'iceSheet'): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = new Color3(0.7, 0.82, 0.95);
  mat.specularColor = new Color3(0.9, 0.95, 1.0);
  mat.specularPower = 256;
  mat.alpha = 0.75;
  mat.emissiveColor = new Color3(0.05, 0.08, 0.12);
  mat.backFaceCulling = false;
  return mat;
}

/**
 * Create snow terrain material - matte white with subtle blue tint.
 */
function createSnowMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial('snowTerrain', scene);
  mat.diffuseColor = new Color3(0.9, 0.92, 0.96);
  mat.specularColor = new Color3(0.3, 0.35, 0.4);
  mat.specularPower = 16;
  return mat;
}

/**
 * Create frozen rock material - dark blue-grey with frost.
 */
function createFrozenRockMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial('frozenRock', scene);
  mat.diffuseColor = new Color3(0.35, 0.38, 0.45);
  mat.specularColor = new Color3(0.4, 0.45, 0.5);
  mat.specularPower = 32;
  return mat;
}

/**
 * Create metal material for the abandoned outpost.
 */
function createOutpostMetalMaterial(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial('outpostMetal', scene);
  mat.diffuseColor = new Color3(0.4, 0.42, 0.45);
  mat.specularColor = new Color3(0.5, 0.5, 0.5);
  mat.specularPower = 48;
  return mat;
}

// ============================================================================
// TERRAIN GENERATION
// ============================================================================

/**
 * Create the main snow/ice terrain with subtle elevation changes.
 */
function createTerrain(scene: Scene, config: IceEnvironmentConfig): Mesh {
  const terrain = MeshBuilder.CreateGround(
    'iceTerrain',
    {
      width: config.terrainSize,
      height: config.terrainSize,
      subdivisions: config.terrainSubdivisions,
      updatable: false,
    },
    scene
  );

  terrain.material = createSnowMaterial(scene);

  // Apply height map displacement for rolling hills
  const positions = terrain.getVerticesData('position');
  if (positions) {
    const newPositions = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];

      // Multi-octave noise for natural terrain
      let height = 0;
      height += Math.sin(x * 0.02) * Math.cos(z * 0.015) * 3;
      height += Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.04 + 0.7) * 1.5;
      height += Math.sin(x * 0.1 + 2.1) * Math.cos(z * 0.08 + 1.4) * 0.5;

      // Flatten the frozen lake area
      const distToLake = Math.sqrt(
        (x - config.frozenLakeCenter.x) ** 2 + (z - config.frozenLakeCenter.z) ** 2
      );
      if (distToLake < config.frozenLakeRadius * 1.3) {
        const blend = Math.max(0, 1 - distToLake / (config.frozenLakeRadius * 1.3));
        height *= 1 - blend;
        height -= blend * 0.5; // Slightly depressed lake bed
      }

      // Raise edges for ice cliffs
      const distFromCenter = Math.sqrt(x * x + z * z);
      const edgeFactor = Math.max(0, (distFromCenter - config.terrainSize * 0.35) / (config.terrainSize * 0.15));
      height += edgeFactor * edgeFactor * 15;

      newPositions[i] = positions[i];
      newPositions[i + 1] = height;
      newPositions[i + 2] = positions[i + 2];
    }
    terrain.updateVerticesData('position', newPositions);
    terrain.createNormals(false);
  }

  terrain.receiveShadows = true;
  return terrain;
}

// ============================================================================
// SKY AND ATMOSPHERE
// ============================================================================

/**
 * Create a frozen sky dome with dark blue-black gradient.
 */
function createSkyDome(scene: Scene): Mesh {
  const skyDome = MeshBuilder.CreateSphere(
    'iceSkyDome',
    { diameter: 4000, segments: 32, sideOrientation: 1 },
    scene
  );

  const skyMat = new StandardMaterial('iceSkyMat', scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  // Deep polar night sky
  skyMat.emissiveColor = new Color3(0.02, 0.03, 0.06);
  skyDome.material = skyMat;
  skyDome.infiniteDistance = true;
  skyDome.renderingGroupId = 0;

  return skyDome;
}

/**
 * Create aurora borealis effect using animated emissive strips.
 * Multiple translucent curtains that shift color and position.
 */
export function createAuroraBorealis(scene: Scene): TransformNode[] {
  const auroraNodes: TransformNode[] = [];
  const curtainCount = 5;

  for (let i = 0; i < curtainCount; i++) {
    const node = new TransformNode(`aurora_${i}`, scene);
    node.position.y = 300 + i * 30;

    // Each curtain is a thin, wide, undulating ribbon
    const ribbon = MeshBuilder.CreatePlane(
      `aurora_ribbon_${i}`,
      {
        width: 400 + i * 80,
        height: 30 + i * 10,
      },
      scene
    );

    const mat = new StandardMaterial(`aurora_mat_${i}`, scene);
    mat.disableLighting = true;
    mat.alpha = 0.12 + i * 0.03;
    mat.backFaceCulling = false;

    // Cycle through aurora colors: green, teal, blue, purple
    const hueOffset = (i / curtainCount) * Math.PI * 2;
    const r = 0.1 + Math.sin(hueOffset) * 0.1;
    const g = 0.4 + Math.cos(hueOffset * 0.7) * 0.3;
    const b = 0.3 + Math.sin(hueOffset * 1.3 + 1) * 0.3;
    mat.emissiveColor = new Color3(r, g, b);

    ribbon.material = mat;
    ribbon.parent = node;
    ribbon.rotation.x = Math.PI / 6 + i * 0.05;
    ribbon.position.z = -500 + i * 50;
    ribbon.position.x = (i - curtainCount / 2) * 60;

    auroraNodes.push(node);
  }

  return auroraNodes;
}

/**
 * Update aurora borealis animation.
 * Call each frame to animate the color and position of aurora curtains.
 */
export function updateAuroraBorealis(
  auroraNodes: TransformNode[],
  time: number
): void {
  for (let i = 0; i < auroraNodes.length; i++) {
    const node = auroraNodes[i];
    // Gentle swaying
    node.position.x = Math.sin(time * 0.1 + i * 1.5) * 40;
    node.rotation.y = Math.sin(time * 0.05 + i * 0.8) * 0.15;

    // Color shift on material
    const ribbon = node.getChildMeshes()[0];
    if (ribbon?.material instanceof StandardMaterial) {
      const phase = time * 0.2 + i * 1.2;
      const r = 0.1 + Math.sin(phase) * 0.15;
      const g = 0.35 + Math.cos(phase * 0.7) * 0.25;
      const b = 0.3 + Math.sin(phase * 1.3 + 1) * 0.25;
      ribbon.material.emissiveColor.set(
        Math.max(0, r),
        Math.max(0, g),
        Math.max(0, b)
      );
      ribbon.material.alpha = 0.1 + Math.sin(phase * 0.5) * 0.06;
    }
  }
}

// ============================================================================
// BLIZZARD PARTICLE SYSTEM
// ============================================================================

/**
 * Create the blizzard/snowstorm particle system.
 * Follows the camera and emits wind-driven snow and ice particles.
 */
export function createBlizzardParticles(
  scene: Scene,
  intensity: number = 0.5
): ParticleSystem {
  const emitter = MeshBuilder.CreateBox(
    'blizzardEmitter',
    { size: 0.1 },
    scene
  );
  emitter.isVisible = false;

  const system = new ParticleSystem('blizzard', Math.floor(2000 * intensity), scene);

  // Use default particle texture (white dot)
  system.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAI0lEQVQYV2P8////fwYkwMjAwMCERACnJLIibCYR5R5h4QAA5HULAVxOgIwAAAAASUVORK5CYII=', scene);

  system.emitter = emitter;

  // Emission
  system.emitRate = 500 * intensity;
  system.minLifeTime = 2;
  system.maxLifeTime = 5;

  // Size
  system.minSize = 0.02;
  system.maxSize = 0.08;

  // Color: white to light blue
  system.color1 = new Color4(1, 1, 1, 0.8);
  system.color2 = new Color4(0.8, 0.9, 1.0, 0.6);
  system.colorDead = new Color4(0.7, 0.8, 0.9, 0);

  // Direction: primarily horizontal (wind) with some vertical
  system.direction1 = new Vector3(-8, -1, -2);
  system.direction2 = new Vector3(-4, 1, 2);

  // Emission box (large area around player)
  system.minEmitBox = new Vector3(-40, -2, -40);
  system.maxEmitBox = new Vector3(40, 15, 40);

  // Speed
  system.minEmitPower = 3;
  system.maxEmitPower = 8;

  // Gravity (slight downward drift)
  system.gravity = new Vector3(-2, -0.5, 0);

  // Angular speed for tumbling
  system.minAngularSpeed = -2;
  system.maxAngularSpeed = 2;

  system.blendMode = ParticleSystem.BLENDMODE_ADD;

  system.start();
  return system;
}

/**
 * Create a gentler ambient snow system for calm areas (caves, shelters).
 */
function createAmbientSnow(scene: Scene): ParticleSystem {
  const emitter = MeshBuilder.CreateBox('snowEmitter', { size: 0.1 }, scene);
  emitter.isVisible = false;

  const system = new ParticleSystem('ambientSnow', 300, scene);
  system.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAI0lEQVQYV2P8////fwYkwMjAwMCERACnJLIibCYR5R5h4QAA5HULAVxOgIwAAAAASUVORK5CYII=', scene);
  system.emitter = emitter;

  system.emitRate = 60;
  system.minLifeTime = 3;
  system.maxLifeTime = 7;
  system.minSize = 0.01;
  system.maxSize = 0.04;

  system.color1 = new Color4(1, 1, 1, 0.5);
  system.color2 = new Color4(0.9, 0.95, 1.0, 0.3);
  system.colorDead = new Color4(1, 1, 1, 0);

  system.direction1 = new Vector3(-0.5, -1, -0.3);
  system.direction2 = new Vector3(0.5, -0.5, 0.3);

  system.minEmitBox = new Vector3(-30, 10, -30);
  system.maxEmitBox = new Vector3(30, 20, 30);

  system.minEmitPower = 0.5;
  system.maxEmitPower = 1.5;
  system.gravity = new Vector3(0, -0.3, 0);

  system.blendMode = ParticleSystem.BLENDMODE_ADD;
  system.start();

  return system;
}

/**
 * Update blizzard particle emitter to follow the camera position.
 */
export function updateBlizzardEmitter(
  system: ParticleSystem,
  cameraPosition: Vector3
): void {
  const emitter = system.emitter;
  if (emitter && 'position' in emitter) {
    (emitter as Mesh).position.copyFrom(cameraPosition);
  }
}

// ============================================================================
// FROZEN LAKE
// ============================================================================

/**
 * Create the frozen lake surface (Phase 2 - thin ice hazard).
 */
function createFrozenLake(
  scene: Scene,
  center: Vector3,
  radius: number
): Mesh {
  const lake = MeshBuilder.CreateDisc(
    'frozenLake',
    { radius, tessellation: 48 },
    scene
  );
  lake.rotation.x = Math.PI / 2;
  lake.position.copyFrom(center);
  lake.position.y = center.y + 0.02; // Slightly above terrain depression

  const iceMat = createIceSheetMaterial(scene, 'frozenLakeMat');
  iceMat.alpha = 0.65;
  iceMat.specularPower = 512;
  lake.material = iceMat;

  // Add subtle crack lines using child meshes
  const crackMat = new StandardMaterial('iceCrackMat', scene);
  crackMat.diffuseColor = new Color3(0.5, 0.6, 0.7);
  crackMat.alpha = 0.3;
  crackMat.emissiveColor = new Color3(0.1, 0.15, 0.2);

  const crackCount = 8;
  for (let i = 0; i < crackCount; i++) {
    const angle = (i / crackCount) * Math.PI * 2 + Math.random() * 0.5;
    const length = radius * (0.3 + Math.random() * 0.5);
    const crack = MeshBuilder.CreatePlane(
      `crack_${i}`,
      { width: 0.15, height: length },
      scene
    );
    crack.material = crackMat;
    crack.rotation.x = Math.PI / 2;
    crack.position.set(
      center.x + Math.cos(angle) * length * 0.3,
      center.y + 0.03,
      center.z + Math.sin(angle) * length * 0.3
    );
    crack.rotation.z = angle;
  }

  return lake;
}

// ============================================================================
// ICE CAVES
// ============================================================================

/**
 * Create an ice cave structure at the given position.
 * Provides shelter from blizzard and temperature protection.
 */
function createIceCave(
  scene: Scene,
  position: Vector3,
  index: number
): TransformNode {
  const root = new TransformNode(`iceCave_${index}`, scene);
  root.position.copyFrom(position);

  const rockMat = createFrozenRockMaterial(scene);
  const iceMat = createIceSheetMaterial(scene, `caveIce_${index}`);

  // Cave entrance arch
  const archLeft = MeshBuilder.CreateCylinder(
    `caveArchL_${index}`,
    { height: 6, diameterTop: 1.5, diameterBottom: 2.5, tessellation: 8 },
    scene
  );
  archLeft.material = rockMat;
  archLeft.parent = root;
  archLeft.position.set(-3, 3, 0);
  archLeft.rotation.z = 0.2;

  const archRight = MeshBuilder.CreateCylinder(
    `caveArchR_${index}`,
    { height: 6, diameterTop: 1.5, diameterBottom: 2.5, tessellation: 8 },
    scene
  );
  archRight.material = rockMat;
  archRight.parent = root;
  archRight.position.set(3, 3, 0);
  archRight.rotation.z = -0.2;

  // Roof boulder
  const roof = MeshBuilder.CreateSphere(
    `caveRoof_${index}`,
    { diameterX: 10, diameterY: 3, diameterZ: 8, segments: 8 },
    scene
  );
  roof.material = rockMat;
  roof.parent = root;
  roof.position.set(0, 5.5, -2);

  // Interior floor (slightly raised, snow-free)
  const floor = MeshBuilder.CreateGround(
    `caveFloor_${index}`,
    { width: 8, height: 10, subdivisions: 4 },
    scene
  );
  const floorMat = new StandardMaterial(`caveFloorMat_${index}`, scene);
  floorMat.diffuseColor = new Color3(0.3, 0.32, 0.38);
  floor.material = floorMat;
  floor.parent = root;
  floor.position.set(0, 0.1, -3);

  // Icicles hanging from ceiling
  const icicleCount = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < icicleCount; i++) {
    const icicle = MeshBuilder.CreateCylinder(
      `icicle_${index}_${i}`,
      {
        height: 0.5 + Math.random() * 1.5,
        diameterTop: 0.02,
        diameterBottom: 0.1 + Math.random() * 0.1,
        tessellation: 4,
      },
      scene
    );
    icicle.material = iceMat;
    icicle.parent = root;
    icicle.position.set(
      (Math.random() - 0.5) * 7,
      5 + Math.random() * 0.5,
      -1 + (Math.random() - 0.5) * 6
    );
    icicle.rotation.x = Math.PI; // Point downward
  }

  // Interior light (warm glow from bioluminescent ice)
  const caveLight = new PointLight(`caveLight_${index}`, Vector3.Zero(), scene);
  caveLight.position.set(position.x, position.y + 3, position.z - 3);
  caveLight.intensity = 0.6;
  caveLight.diffuse = new Color3(0.3, 0.5, 0.7); // Cool blue interior
  caveLight.range = 15;

  return root;
}

// ============================================================================
// FROZEN STRUCTURES
// ============================================================================

/**
 * Create the abandoned research outpost.
 * A small cluster of frost-covered prefab structures with a working heater.
 */
function createOutpost(scene: Scene, position: Vector3): TransformNode {
  const root = new TransformNode('researchOutpost', scene);
  root.position.copyFrom(position);

  const metalMat = createOutpostMetalMaterial(scene);
  const frostMat = createIceSheetMaterial(scene, 'outpostFrost');
  frostMat.alpha = 0.4;

  // Main habitat module
  const habitat = MeshBuilder.CreateBox(
    'habitat',
    { width: 6, height: 3, depth: 8 },
    scene
  );
  habitat.material = metalMat;
  habitat.parent = root;
  habitat.position.y = 1.5;

  // Frost coating on habitat
  const frostCoat = MeshBuilder.CreateBox(
    'habitatFrost',
    { width: 6.1, height: 3.1, depth: 8.1 },
    scene
  );
  frostCoat.material = frostMat;
  frostCoat.parent = root;
  frostCoat.position.y = 1.5;

  // Communications antenna (broken)
  const antenna = MeshBuilder.CreateCylinder(
    'antenna',
    { height: 5, diameterTop: 0.05, diameterBottom: 0.15, tessellation: 6 },
    scene
  );
  antenna.material = metalMat;
  antenna.parent = root;
  antenna.position.set(2, 5.5, 0);
  antenna.rotation.z = 0.3; // Leaning, damaged

  // Supply crate stack
  for (let i = 0; i < 3; i++) {
    const crate = MeshBuilder.CreateBox(
      `crate_${i}`,
      { width: 1.2, height: 0.8, depth: 1.2 },
      scene
    );
    const crateMat = new StandardMaterial(`crateMat_${i}`, scene);
    crateMat.diffuseColor = new Color3(0.35, 0.38, 0.3);
    crate.material = crateMat;
    crate.parent = root;
    crate.position.set(-4, 0.4 + i * 0.85, 2 + (Math.random() - 0.5));
    crate.rotation.y = Math.random() * 0.3;
  }

  // Heater (heat source with warm light)
  const heater = MeshBuilder.CreateCylinder(
    'heater',
    { height: 1.2, diameter: 0.6, tessellation: 8 },
    scene
  );
  const heaterMat = new StandardMaterial('heaterMat', scene);
  heaterMat.diffuseColor = new Color3(0.3, 0.3, 0.3);
  heaterMat.emissiveColor = new Color3(0.6, 0.25, 0.1);
  heater.material = heaterMat;
  heater.parent = root;
  heater.position.set(0, 0.6, -5);

  // Heater glow light
  const heaterLight = new PointLight('heaterLight', Vector3.Zero(), scene);
  heaterLight.position.set(position.x, position.y + 1, position.z - 5);
  heaterLight.intensity = 1.2;
  heaterLight.diffuse = new Color3(1.0, 0.6, 0.3); // Warm orange
  heaterLight.range = 12;

  // Snow buildup around outpost
  const snowDrift = MeshBuilder.CreateSphere(
    'snowDrift',
    { diameterX: 12, diameterY: 1.5, diameterZ: 10, segments: 8 },
    scene
  );
  const snowMat = new StandardMaterial('driftMat', scene);
  snowMat.diffuseColor = new Color3(0.92, 0.94, 0.97);
  snowDrift.material = snowMat;
  snowDrift.parent = root;
  snowDrift.position.set(5, 0.3, 0);

  return root;
}

// ============================================================================
// ICE FORMATIONS
// ============================================================================

/**
 * Create scattered ice formations (crystalline pillars, wind-carved arches).
 */
function createIceFormations(scene: Scene, terrainSize: number): Mesh[] {
  const formations: Mesh[] = [];
  const iceMat = createIceSheetMaterial(scene, 'formationIce');
  const rockMat = createFrozenRockMaterial(scene);

  // Crystal pillars
  const pillarPositions = [
    new Vector3(-60, 0, -30),
    new Vector3(80, 0, -100),
    new Vector3(-100, 0, -180),
    new Vector3(30, 0, -240),
    new Vector3(-50, 0, -60),
    new Vector3(70, 0, -150),
    new Vector3(-20, 0, 20),
    new Vector3(100, 0, -40),
  ];

  for (let i = 0; i < pillarPositions.length; i++) {
    const pos = pillarPositions[i];
    const height = 4 + Math.random() * 8;

    const pillar = MeshBuilder.CreateCylinder(
      `icePillar_${i}`,
      {
        height,
        diameterTop: 0.3 + Math.random() * 0.5,
        diameterBottom: 1.5 + Math.random() * 1,
        tessellation: 5 + Math.floor(Math.random() * 3),
      },
      scene
    );
    pillar.material = i % 3 === 0 ? rockMat : iceMat;
    pillar.position.set(pos.x, height / 2, pos.z);
    pillar.rotation.z = (Math.random() - 0.5) * 0.15;
    pillar.rotation.x = (Math.random() - 0.5) * 0.1;
    formations.push(pillar);
  }

  // Frozen waterfall formations (curtains of ice on cliff faces)
  return formations;
}

/**
 * Create frozen waterfall meshes attached to cave entrances and cliffs.
 */
function createFrozenWaterfalls(
  scene: Scene,
  positions: Vector3[]
): Mesh[] {
  const waterfalls: Mesh[] = [];
  const iceMat = createIceSheetMaterial(scene, 'waterfallIce');
  iceMat.alpha = 0.55;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    // Each waterfall is a series of elongated ice columns
    const columnCount = 5 + Math.floor(Math.random() * 4);

    for (let j = 0; j < columnCount; j++) {
      const height = 3 + Math.random() * 5;
      const col = MeshBuilder.CreateCylinder(
        `waterfall_${i}_${j}`,
        {
          height,
          diameterTop: 0.1 + Math.random() * 0.15,
          diameterBottom: 0.3 + Math.random() * 0.2,
          tessellation: 6,
        },
        scene
      );
      col.material = iceMat;
      col.position.set(
        pos.x + (j - columnCount / 2) * 0.5,
        pos.y + height / 2 + 2,
        pos.z
      );
      col.rotation.z = (Math.random() - 0.5) * 0.1;
      waterfalls.push(col);
    }
  }

  return waterfalls;
}

// ============================================================================
// TEMPERATURE ZONE SYSTEM
// ============================================================================

/**
 * Create temperature zones around heat sources.
 * Each zone has a position, radius, and temperature offset.
 * Players inside warm zones reset their exposure timer.
 */
export function createTemperatureZones(
  scene: Scene,
  heatSourcePositions: Vector3[]
): TemperatureZone[] {
  const zones: TemperatureZone[] = [];

  for (let i = 0; i < heatSourcePositions.length; i++) {
    const pos = heatSourcePositions[i];

    // Create a subtle warm light indicator
    const light = new PointLight(`heatLight_${i}`, pos.clone(), scene);
    light.position.y += 1.5;
    light.intensity = 0.8;
    light.diffuse = new Color3(1.0, 0.7, 0.4);
    light.range = 10;

    // Visual warmth indicator (ground ring)
    const ring = MeshBuilder.CreateTorus(
      `heatZone_${i}`,
      { diameter: 8, thickness: 0.1, tessellation: 24 },
      scene
    );
    const ringMat = new StandardMaterial(`heatRingMat_${i}`, scene);
    ringMat.emissiveColor = new Color3(0.6, 0.3, 0.1);
    ringMat.alpha = 0.2;
    ringMat.disableLighting = true;
    ring.material = ringMat;
    ring.position.copyFrom(pos);
    ring.position.y += 0.05;
    ring.rotation.x = Math.PI / 2;

    zones.push({
      id: `heat_${i}`,
      position: pos.clone(),
      radius: 8,
      temperatureOffset: 30, // Degrees warmer
      isHeatSource: true,
      indicator: ring,
      light,
    });
  }

  // Add cold zones in open areas
  const coldPositions = [
    new Vector3(0, 0, -160), // Frozen lake center (extra cold)
    new Vector3(-120, 0, -100), // Open tundra
    new Vector3(120, 0, -200), // Wind-exposed ridge
  ];

  for (let i = 0; i < coldPositions.length; i++) {
    zones.push({
      id: `cold_${i}`,
      position: coldPositions[i].clone(),
      radius: 25,
      temperatureOffset: -15, // Colder than baseline
      isHeatSource: false,
    });
  }

  return zones;
}

/**
 * Calculate the temperature modifier at a given world position
 * based on all active temperature zones.
 *
 * @returns Temperature offset from baseline (positive = warmer, negative = colder)
 */
export function getTemperatureAtPosition(
  position: Vector3,
  zones: TemperatureZone[]
): number {
  let totalOffset = 0;

  for (const zone of zones) {
    const dist = Vector3.Distance(position, zone.position);
    if (dist < zone.radius) {
      // Linear falloff from center
      const factor = 1 - dist / zone.radius;
      totalOffset += zone.temperatureOffset * factor;
    }
  }

  return totalOffset;
}

// ============================================================================
// MAIN ENVIRONMENT CREATION
// ============================================================================

/**
 * Create the complete ice environment for the Southern Ice level.
 *
 * @param scene - The Babylon.js scene
 * @param config - Optional configuration overrides
 * @returns All created environment objects for lifecycle management
 */
export function createIceEnvironment(
  scene: Scene,
  config: Partial<IceEnvironmentConfig> = {}
): IceEnvironment {
  const cfg: IceEnvironmentConfig = { ...DEFAULT_CONFIG, ...config };

  // Terrain
  const terrain = createTerrain(scene, cfg);

  // Sky
  const skyDome = createSkyDome(scene);

  // Frozen lake (Phase 2 area)
  const frozenLake = createFrozenLake(
    scene,
    cfg.frozenLakeCenter,
    cfg.frozenLakeRadius
  );

  // Ice caves (Phase 3 and shelter)
  const iceCaves = cfg.cavePositions.map((pos, i) =>
    createIceCave(scene, pos, i)
  );

  // Research outpost
  const outpost = createOutpost(scene, cfg.outpostPosition);

  // Ice formations
  const iceFormations = createIceFormations(scene, cfg.terrainSize);

  // Frozen waterfalls near cave entrances
  const frozenWaterfalls = createFrozenWaterfalls(
    scene,
    cfg.cavePositions.map((p) => new Vector3(p.x + 5, p.y, p.z + 2))
  );

  // Temperature zones
  const temperatureZones = createTemperatureZones(scene, cfg.heatSourcePositions);

  // Aurora borealis
  const auroraNodes = createAuroraBorealis(scene);

  // Particle systems
  const blizzardSystem = createBlizzardParticles(scene, 0.6);
  const snowSystem = createAmbientSnow(scene);

  return {
    terrain,
    skyDome,
    frozenLake,
    iceCaves,
    outpost,
    frozenWaterfalls,
    iceFormations,
    temperatureZones,
    auroraNodes,
    blizzardSystem,
    snowSystem,
  };
}

/**
 * Dispose all ice environment resources.
 */
export function disposeIceEnvironment(env: IceEnvironment): void {
  env.terrain.dispose();
  env.skyDome.dispose();
  env.frozenLake.dispose();

  for (const cave of env.iceCaves) {
    cave.getChildMeshes().forEach((m) => m.dispose());
    cave.dispose();
  }

  env.outpost.getChildMeshes().forEach((m) => m.dispose());
  env.outpost.dispose();

  for (const wf of env.frozenWaterfalls) {
    wf.dispose();
  }

  for (const f of env.iceFormations) {
    f.dispose();
  }

  for (const zone of env.temperatureZones) {
    zone.indicator?.dispose();
    zone.light?.dispose();
  }

  for (const node of env.auroraNodes) {
    node.getChildMeshes().forEach((m) => m.dispose());
    node.dispose();
  }

  env.blizzardSystem?.dispose();
  env.snowSystem?.dispose();
}
