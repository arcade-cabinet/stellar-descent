/**
 * Southern Ice Environment - GLB-enhanced frozen wasteland
 *
 * Creates the frozen landscape of LV-847's southern continent using a mix
 * of procedural geometry (sky, lake, particles, temperature zones) and
 * hand-placed GLB assets from the Quaternius modular kit, metal fence
 * pack, and station-external set.
 *
 * THREE DISTINCT AREAS:
 *   a) Frozen Lake      -- center of the map (Z -100 to -220)
 *   b) Abandoned Outpost -- north-east (Z -20 to -90), fenced perimeter
 *   c) Ice Caves         -- three entrances with fence barriers and rock arches
 *
 * Aesthetic reference: Halo 3 "Sierra 117" crossed with The Thing's
 * Antarctic research base.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
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

import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('IceEnv');
import { SkyboxManager, type SkyboxResult } from '../../core/SkyboxManager';
import {
  ICE_TERRAIN_CONFIG,
  ICE_ROCK_CONFIG,
  createPBRTerrainMaterial,
} from '../shared/PBRTerrainMaterials';

// ============================================================================
// TYPES
// ============================================================================

/** All GLB paths used by the ice environment. Exported for preloading. */
export const ICE_ENVIRONMENT_GLB_PATHS: readonly string[] = [
  // Quaternius modular kit - wall / window segments
  '/models/environment/modular/LongWindow_Wall_SideA.glb',
  '/models/environment/modular/LongWindow_Wall_SideB.glb',
  '/models/environment/modular/SmallWindows_Wall_SideA.glb',
  '/models/environment/modular/SmallWindows_Wall_SideB.glb',
  // Quaternius modular kit - props
  '/models/environment/modular/Props_Capsule.glb',
  '/models/environment/modular/Props_Pod.glb',
  '/models/environment/modular/Props_Vessel.glb',
  '/models/environment/modular/Props_Vessel_Short.glb',
  '/models/environment/modular/Props_Vessel_Tall.glb',
  '/models/environment/modular/Props_Crate.glb',
  '/models/environment/modular/Props_CrateLong.glb',
  '/models/environment/modular/Props_ContainerFull.glb',
  // Quaternius modular kit - detail pieces
  '/models/environment/modular/Details_Cylinder.glb',
  '/models/environment/modular/Details_Cylinder_Long.glb',
  '/models/environment/modular/Details_Dots.glb',
  '/models/environment/modular/Details_Hexagon.glb',
  // Metal fences
  '/models/props/modular/metal_fence_hr_1.glb',
  '/models/props/modular/metal_fence_hr_1_pillar_1.glb',
  '/models/props/modular/metal_fence_hr_1_pillar_1_corner.glb',
  '/models/props/modular/metal_fence_hr_1_pillar_1_corner_tall.glb',
  '/models/props/modular/metal_fence_hr_1_pillar_1_tall.glb',
  '/models/props/modular/metal_fence_hr_1_tall.glb',
  // Station external (crashed ship)
  '/models/environment/station-external/station05.glb',
  // Alien-flora rocks
  '/models/environment/alien-flora/alien_tall_rock_1_01.glb',
  '/models/environment/alien-flora/alien_tall_rock_2_01.glb',
  '/models/environment/alien-flora/alien_tall_rock_3_01.glb',
  '/models/environment/alien-flora/alien_boulder_polyhaven.glb',
  // Industrial props
  '/models/environment/industrial/chimney_a_1.glb',
  '/models/props/containers/metal_barrel_hr_1.glb',
  // Alien-flora medium rocks
  '/models/environment/alien-flora/alien_rock_medium_1.glb',
  '/models/environment/alien-flora/alien_rock_medium_2.glb',
  '/models/environment/alien-flora/alien_rock_medium_3.glb',
  // Station pillars
  '/models/environment/station/pillar_hr_2.glb',
  '/models/environment/station/pillar_hr_1_broken.glb',
  // Pipe props
  '/models/props/pipes/pipe_e_1.glb',
  '/models/props/pipes/pipe_e_2.glb',
] as const;

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
  iceFormations: TransformNode[];
  temperatureZones: TemperatureZone[];
  auroraNodes: TransformNode[];
  blizzardSystem: ParticleSystem | null;
  snowSystem: ParticleSystem | null;
  /** All GLB-loaded nodes -- tracked for disposal */
  glbNodes: TransformNode[];
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
// GLB MODEL PATHS (must match southern-ice asset manifest)
// ============================================================================

const GLB = {
  // Quaternius modular kit - wall / window segments
  longWindowA: '/models/environment/modular/LongWindow_Wall_SideA.glb',
  longWindowB: '/models/environment/modular/LongWindow_Wall_SideB.glb',
  smallWindowsA: '/models/environment/modular/SmallWindows_Wall_SideA.glb',
  smallWindowsB: '/models/environment/modular/SmallWindows_Wall_SideB.glb',

  // Quaternius modular kit - props
  capsule: '/models/environment/modular/Props_Capsule.glb',
  pod: '/models/environment/modular/Props_Pod.glb',
  vessel: '/models/environment/modular/Props_Vessel.glb',
  vesselShort: '/models/environment/modular/Props_Vessel_Short.glb',
  vesselTall: '/models/environment/modular/Props_Vessel_Tall.glb',
  crate: '/models/environment/modular/Props_Crate.glb',
  crateLong: '/models/environment/modular/Props_CrateLong.glb',
  containerFull: '/models/environment/modular/Props_ContainerFull.glb',

  // Quaternius modular kit - detail pieces
  detailCylinder: '/models/environment/modular/Details_Cylinder.glb',
  detailCylLong: '/models/environment/modular/Details_Cylinder_Long.glb',
  detailDots: '/models/environment/modular/Details_Dots.glb',
  detailHexagon: '/models/environment/modular/Details_Hexagon.glb',

  // Metal fences
  metalFence: '/models/props/modular/metal_fence_hr_1.glb',
  metalPillar: '/models/props/modular/metal_fence_hr_1_pillar_1.glb',
  metalCorner: '/models/props/modular/metal_fence_hr_1_pillar_1_corner.glb',
  metalCornerTall: '/models/props/modular/metal_fence_hr_1_pillar_1_corner_tall.glb',
  metalPillarTall: '/models/props/modular/metal_fence_hr_1_pillar_1_tall.glb',
  metalFenceTall: '/models/props/modular/metal_fence_hr_1_tall.glb',

  // Station external (crashed ship)
  station05: '/models/environment/station-external/station05.glb',

  // Alien-flora rocks (cave arch pillars and roof boulders)
  tallRock1: '/models/environment/alien-flora/alien_tall_rock_1_01.glb',
  tallRock2: '/models/environment/alien-flora/alien_tall_rock_2_01.glb',
  tallRock3: '/models/environment/alien-flora/alien_tall_rock_3_01.glb',
  boulder: '/models/environment/alien-flora/alien_boulder_polyhaven.glb',

  // Industrial props (outpost antenna and heater)
  chimney: '/models/environment/industrial/chimney_a_1.glb',
  metalBarrel: '/models/props/containers/metal_barrel_hr_1.glb',

  // Alien-flora medium rocks (ice formations, snow drifts, warning poles)
  rockMedium1: '/models/environment/alien-flora/alien_rock_medium_1.glb',
  rockMedium2: '/models/environment/alien-flora/alien_rock_medium_2.glb',
  rockMedium3: '/models/environment/alien-flora/alien_rock_medium_3.glb',

  // Station pillars (warning poles around frozen lake)
  stationPillar: '/models/environment/station/pillar_hr_2.glb',
  stationPillarBroken: '/models/environment/station/pillar_hr_1_broken.glb',

  // Pipe props (ice formation replacement for tall cylinders)
  pipeE1: '/models/props/pipes/pipe_e_1.glb',
  pipeE2: '/models/props/pipes/pipe_e_2.glb',
} as const;

// ============================================================================
// GLB PRELOADING
// ============================================================================

/**
 * Preload all GLB assets for the ice environment via AssetManager.
 * Call this once during level setup before createIceEnvironment.
 */
export async function preloadIceEnvironmentAssets(scene: Scene): Promise<void> {
  await Promise.all(
    ICE_ENVIRONMENT_GLB_PATHS.map((path) => AssetManager.loadAssetByPath(path, scene))
  );
}

// ============================================================================
// GLB INSTANCING HELPER
// ============================================================================

interface GLBPlacement {
  path: string;
  name: string;
  position: Vector3;
  rotationY?: number;
  scale?: number;
  parent?: TransformNode;
}

/**
 * Instance a preloaded GLB model using AssetManager, position / rotate / scale it.
 *
 * Requires preloadIceEnvironmentAssets to have been called first. Failures are
 * tolerated (logged) so the level still loads if an asset is missing.
 */
function placeGLBSync(
  scene: Scene,
  path: string,
  name: string,
  position: Vector3,
  opts: { rotationY?: number; scale?: number; parent?: TransformNode } = {}
): TransformNode | null {
  const root = AssetManager.createInstanceByPath(path, name, scene, true, 'environment');

  if (!root) {
    log.warn(`GLB not cached for ${path}. Was preloadIceEnvironmentAssets called?`);
    return null;
  }

  root.position.copyFrom(position);
  root.rotation.y = opts.rotationY ?? 0;
  const s = opts.scale ?? 1;
  root.scaling.setAll(s);

  if (opts.parent) {
    root.parent = opts.parent;
  }

  return root;
}

/**
 * Instance an array of preloaded GLB placements synchronously.
 * Returns an array of successfully created TransformNodes.
 */
function placeGLBBatchSync(scene: Scene, placements: GLBPlacement[]): TransformNode[] {
  const results: TransformNode[] = [];
  for (const p of placements) {
    const node = placeGLBSync(scene, p.path, p.name, p.position, {
      rotationY: p.rotationY,
      scale: p.scale,
      parent: p.parent,
    });
    if (node) results.push(node);
  }
  return results;
}

// ============================================================================
// MATERIAL CREATION
// ============================================================================

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
 * Create PBR snow terrain material with AmbientCG textures.
 */
function createSnowMaterial(scene: Scene, terrainSize: number = 600): PBRMaterial {
  const mat = createPBRTerrainMaterial(scene, ICE_TERRAIN_CONFIG, 'snowTerrain');

  // Adjust UV scale for terrain size
  const uvScale = 0.015 * terrainSize;
  if (mat.albedoTexture instanceof Texture) {
    mat.albedoTexture.uScale = uvScale;
    mat.albedoTexture.vScale = uvScale;
  }
  if (mat.bumpTexture instanceof Texture) {
    mat.bumpTexture.uScale = uvScale;
    mat.bumpTexture.vScale = uvScale;
  }
  if (mat.metallicTexture instanceof Texture) {
    mat.metallicTexture.uScale = uvScale;
    mat.metallicTexture.vScale = uvScale;
  }

  return mat;
}

/**
 * Fallback simple snow material (for compatibility).
 */
function createSnowMaterialSimple(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial('snowTerrainSimple', scene);
  mat.diffuseColor = new Color3(0.9, 0.92, 0.96);
  mat.specularColor = new Color3(0.3, 0.35, 0.4);
  mat.specularPower = 16;
  return mat;
}

/**
 * Create PBR frozen rock material with AmbientCG textures.
 */
function createFrozenRockMaterial(scene: Scene): PBRMaterial {
  const mat = createPBRTerrainMaterial(scene, ICE_ROCK_CONFIG, 'frozenRock');
  return mat;
}

/**
 * Fallback simple frozen rock material (for compatibility).
 */
function createFrozenRockMaterialSimple(scene: Scene): StandardMaterial {
  const mat = new StandardMaterial('frozenRockSimple', scene);
  mat.diffuseColor = new Color3(0.35, 0.38, 0.45);
  mat.specularColor = new Color3(0.4, 0.45, 0.5);
  mat.specularPower = 32;
  return mat;
}

function createFrostOverlayMaterial(scene: Scene, name: string): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = new Color3(0.75, 0.82, 0.92);
  mat.specularColor = new Color3(0.6, 0.65, 0.7);
  mat.specularPower = 128;
  mat.alpha = 0.35;
  mat.emissiveColor = new Color3(0.03, 0.05, 0.08);
  mat.backFaceCulling = false;
  return mat;
}

// ============================================================================
// TERRAIN GENERATION (kept for initial disposal -- replaced by factory later)
// ============================================================================

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
  // Use PBR snow material with proper UV scaling
  terrain.material = createSnowMaterial(scene, config.terrainSize);

  const positions = terrain.getVerticesData('position');
  if (positions) {
    const newPositions = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];

      let height = 0;
      height += Math.sin(x * 0.02) * Math.cos(z * 0.015) * 3;
      height += Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.04 + 0.7) * 1.5;
      height += Math.sin(x * 0.1 + 2.1) * Math.cos(z * 0.08 + 1.4) * 0.5;

      const distToLake = Math.sqrt(
        (x - config.frozenLakeCenter.x) ** 2 + (z - config.frozenLakeCenter.z) ** 2
      );
      if (distToLake < config.frozenLakeRadius * 1.3) {
        const blend = Math.max(0, 1 - distToLake / (config.frozenLakeRadius * 1.3));
        height *= 1 - blend;
        height -= blend * 0.5;
      }

      const distFromCenter = Math.sqrt(x * x + z * z);
      const edgeFactor = Math.max(
        0,
        (distFromCenter - config.terrainSize * 0.35) / (config.terrainSize * 0.15)
      );
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
// SKY AND ATMOSPHERE - Using proper Babylon.js skybox with SkyboxManager
// ============================================================================

/** Stored skybox result for disposal */
let iceSkyboxResult: SkyboxResult | null = null;

/** Stored lake crack meshes for disposal */
const lakeCrackMeshes: Mesh[] = [];

function createSkyDome(scene: Scene): Mesh {
  // Use SkyboxManager for proper Babylon.js skybox with ice/arctic atmosphere
  const skyboxManager = new SkyboxManager(scene);
  iceSkyboxResult = skyboxManager.createFallbackSkybox({
    type: 'ice',
    size: 10000,
    useEnvironmentLighting: true,
    environmentIntensity: 0.6, // Overcast, cold lighting
    // Dark arctic night sky with hints of aurora
    tint: new Color3(0.02, 0.03, 0.06),
  });

  return iceSkyboxResult.mesh;
}

/**
 * Get the current ice skybox result for disposal.
 */
export function getIceSkyboxResult(): SkyboxResult | null {
  return iceSkyboxResult;
}

export function createAuroraBorealis(scene: Scene): TransformNode[] {
  const auroraNodes: TransformNode[] = [];
  const curtainCount = 5;

  for (let i = 0; i < curtainCount; i++) {
    const node = new TransformNode(`aurora_${i}`, scene);
    // Lower altitude for better visibility (was 300+, now 150+)
    node.position.y = 150 + i * 25;

    const ribbon = MeshBuilder.CreatePlane(
      `aurora_ribbon_${i}`,
      { width: 400 + i * 80, height: 30 + i * 10 },
      scene
    );
    const mat = new StandardMaterial(`aurora_mat_${i}`, scene);
    mat.disableLighting = true;
    mat.alpha = 0.12 + i * 0.03;
    mat.backFaceCulling = false;

    const hueOffset = (i / curtainCount) * Math.PI * 2;
    mat.emissiveColor = new Color3(
      0.1 + Math.sin(hueOffset) * 0.1,
      0.4 + Math.cos(hueOffset * 0.7) * 0.3,
      0.3 + Math.sin(hueOffset * 1.3 + 1) * 0.3
    );

    ribbon.material = mat;
    ribbon.parent = node;
    ribbon.rotation.x = Math.PI / 6 + i * 0.05;
    // Bring aurora closer for better visibility
    ribbon.position.z = -200 + i * 40;
    ribbon.position.x = (i - curtainCount / 2) * 50;

    auroraNodes.push(node);
  }
  return auroraNodes;
}

export function updateAuroraBorealis(auroraNodes: TransformNode[], time: number): void {
  for (let i = 0; i < auroraNodes.length; i++) {
    const node = auroraNodes[i];
    node.position.x = Math.sin(time * 0.1 + i * 1.5) * 40;
    // Use absolute value to prevent sign jitter in rotation
    node.rotation.y = Math.abs(Math.sin(time * 0.05 + i * 0.8)) * 0.15 - 0.075;

    const ribbon = node.getChildMeshes()[0];
    if (ribbon?.material instanceof StandardMaterial) {
      const phase = time * 0.2 + i * 1.2;
      ribbon.material.emissiveColor.set(
        Math.max(0, 0.1 + Math.sin(phase) * 0.15),
        Math.max(0, 0.35 + Math.cos(phase * 0.7) * 0.25),
        Math.max(0, 0.3 + Math.sin(phase * 1.3 + 1) * 0.25)
      );
      ribbon.material.alpha = 0.1 + Math.sin(phase * 0.5) * 0.06;
    }
  }
}

// ============================================================================
// BLIZZARD PARTICLE SYSTEMS
// ============================================================================

export function createBlizzardParticles(scene: Scene, intensity = 0.5): ParticleSystem {
  const emitter = MeshBuilder.CreateBox('blizzardEmitter', { size: 0.1 }, scene);
  emitter.isVisible = false;

  const system = new ParticleSystem('blizzard', Math.floor(2000 * intensity), scene);
  system.particleTexture = new Texture(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAI0lEQVQYV2P8////fwYkwMjAwMCERACnJLIibCYR5R5h4QAA5HULAVxOgIwAAAAASUVORK5CYII=',
    scene
  );
  system.emitter = emitter;

  system.emitRate = 500 * intensity;
  system.minLifeTime = 2;
  system.maxLifeTime = 5;
  // Smaller particle sizes for more realistic snow
  system.minSize = 0.01;
  system.maxSize = 0.04;

  // Reduce alpha for more subtle snow particles
  system.color1 = new Color4(1, 1, 1, 0.5);
  system.color2 = new Color4(0.8, 0.9, 1.0, 0.35);
  system.colorDead = new Color4(0.7, 0.8, 0.9, 0);

  system.direction1 = new Vector3(-8, -1, -2);
  system.direction2 = new Vector3(-4, 1, 2);
  system.minEmitBox = new Vector3(-40, -2, -40);
  system.maxEmitBox = new Vector3(40, 15, 40);
  system.minEmitPower = 3;
  system.maxEmitPower = 8;
  system.gravity = new Vector3(-2, -0.5, 0);
  system.minAngularSpeed = -2;
  system.maxAngularSpeed = 2;
  system.blendMode = ParticleSystem.BLENDMODE_ADD;

  system.start();
  return system;
}

function createAmbientSnow(scene: Scene): ParticleSystem {
  const emitter = MeshBuilder.CreateBox('snowEmitter', { size: 0.1 }, scene);
  emitter.isVisible = false;

  const system = new ParticleSystem('ambientSnow', 300, scene);
  system.particleTexture = new Texture(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAI0lEQVQYV2P8////fwYkwMjAwMCERACnJLIibCYR5R5h4QAA5HULAVxOgIwAAAAASUVORK5CYII=',
    scene
  );
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

export function updateBlizzardEmitter(system: ParticleSystem, cameraPosition: Vector3): void {
  const emitter = system.emitter;
  if (emitter && 'position' in emitter) {
    (emitter as Mesh).position.copyFrom(cameraPosition);
  }
}

// ============================================================================
// FROZEN LAKE (AREA A)
// ============================================================================

function createFrozenLake(scene: Scene, center: Vector3, radius: number): Mesh {
  const lake = MeshBuilder.CreateDisc('frozenLake', { radius, tessellation: 48 }, scene);
  lake.rotation.x = Math.PI / 2;
  lake.position.copyFrom(center);
  lake.position.y = center.y + 0.02;

  const iceMat = createIceSheetMaterial(scene, 'frozenLakeMat');
  iceMat.alpha = 0.65;
  iceMat.specularPower = 512;
  lake.material = iceMat;

  // Crack lines - track for disposal
  const crackMat = new StandardMaterial('iceCrackMat', scene);
  crackMat.diffuseColor = new Color3(0.4, 0.5, 0.6);
  crackMat.alpha = 0.4;
  crackMat.emissiveColor = new Color3(0.08, 0.12, 0.18);

  // Clear any previous crack meshes
  lakeCrackMeshes.length = 0;

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
    const length = radius * (0.3 + Math.random() * 0.5);
    const crack = MeshBuilder.CreatePlane(`crack_${i}`, { width: 0.12, height: length }, scene);
    crack.material = crackMat;
    crack.rotation.x = Math.PI / 2;
    // Position cracks relative to lake center with slight Y offset above ice surface
    const crackDist = length * 0.4;
    crack.position.set(
      center.x + Math.cos(angle) * crackDist,
      center.y + 0.025, // Just above lake surface
      center.z + Math.sin(angle) * crackDist
    );
    crack.rotation.z = angle;
    lakeCrackMeshes.push(crack);
  }

  // Add dark thin ice patches as visual warnings
  const darkIceMat = new StandardMaterial('thinIceMat', scene);
  darkIceMat.diffuseColor = new Color3(0.2, 0.25, 0.35);
  darkIceMat.alpha = 0.5;
  darkIceMat.emissiveColor = new Color3(0.02, 0.04, 0.06);

  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.4 + Math.random() * 0.4);
    const patchSize = 4 + Math.random() * 6;
    const patch = MeshBuilder.CreateDisc(`thinIce_${i}`, { radius: patchSize, tessellation: 16 }, scene);
    patch.material = darkIceMat;
    patch.rotation.x = Math.PI / 2;
    patch.position.set(
      center.x + Math.cos(angle) * dist,
      center.y + 0.015,
      center.z + Math.sin(angle) * dist
    );
    lakeCrackMeshes.push(patch);
  }

  // Thin-ice warning poles around the lake edge (GLB station pillars)
  // Poles are placed via the batch GLB loader in createIceEnvironment;
  // store the placements here for the async pipeline.
  const poleVariants = [GLB.stationPillar, GLB.stationPillarBroken];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    frozenLakeGLBPlacements.push({
      path: poleVariants[i % poleVariants.length],
      name: `warnPole_${i}`,
      position: new Vector3(
        center.x + Math.cos(a) * (radius + 2),
        0,
        center.z + Math.sin(a) * (radius + 2)
      ),
      rotationY: a,
      scale: 0.5,
    });
  }

  return lake;
}

// ============================================================================
// ICE CAVES (AREA C) -- rock arches + GLB fence barriers
// ============================================================================

function createIceCaveBase(scene: Scene, position: Vector3, index: number): TransformNode {
  const root = new TransformNode(`iceCave_${index}`, scene);
  root.position.copyFrom(position);

  const iceMat = createIceSheetMaterial(scene, `caveIce_${index}`);

  // Cave entrance arch -- left rock pillar (GLB)
  const rockVariants = [GLB.tallRock1, GLB.tallRock2, GLB.tallRock3];
  const leftRockPath = rockVariants[index % rockVariants.length];
  const rightRockPath = rockVariants[(index + 1) % rockVariants.length];

  // Arch pillars will be placed via the batch GLB loader in createIceEnvironment;
  // store the placements here for the async pipeline
  iceCaveGLBPlacements.push(
    {
      path: leftRockPath,
      name: `caveArchL_${index}`,
      position: new Vector3(position.x - 4, position.y, position.z),
      rotationY: 0.18,
      scale: 2.5,
    },
    {
      path: rightRockPath,
      name: `caveArchR_${index}`,
      position: new Vector3(position.x + 4, position.y, position.z),
      rotationY: -0.18,
      scale: 2.5,
    },
    // Massive roof boulder (GLB)
    {
      path: GLB.boulder,
      name: `caveRoof_${index}`,
      position: new Vector3(position.x, position.y + 4, position.z - 3),
      rotationY: index * 0.7,
      scale: 4.0,
    }
  );

  // Interior floor (terrain with frost overlay -- kept as MeshBuilder)
  const floor = MeshBuilder.CreateGround(
    `caveFloor_${index}`,
    { width: 10, height: 14, subdivisions: 4 },
    scene
  );
  const floorMat = new StandardMaterial(`caveFloorMat_${index}`, scene);
  floorMat.diffuseColor = new Color3(0.35, 0.4, 0.48); // Slightly blue-grey for ice tint
  floorMat.specularColor = new Color3(0.2, 0.25, 0.3);
  floorMat.specularPower = 32;
  floorMat.emissiveColor = new Color3(0.02, 0.03, 0.05); // Subtle ice glow
  floor.material = floorMat;
  floor.parent = root;
  floor.position.set(0, 0.1, -4);

  // Icicles hanging from ceiling (VFX -- kept as MeshBuilder)
  const icicleCount = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < icicleCount; i++) {
    const icicleHeight = 0.6 + Math.random() * 2;
    const icicle = MeshBuilder.CreateCylinder(
      `icicle_${index}_${i}`,
      {
        height: icicleHeight,
        diameterTop: 0.02,
        diameterBottom: 0.1 + Math.random() * 0.12,
        tessellation: 4,
      },
      scene
    );
    // Create unique material per icicle with randomized alpha for variety
    const icicleMat = new StandardMaterial(`icicleMat_${index}_${i}`, scene);
    icicleMat.diffuseColor = new Color3(0.7, 0.82, 0.95);
    icicleMat.specularColor = new Color3(0.9, 0.95, 1.0);
    icicleMat.specularPower = 256;
    icicleMat.alpha = 0.55 + Math.random() * 0.3; // Randomized transparency
    icicleMat.emissiveColor = new Color3(0.03, 0.06, 0.1);
    icicleMat.backFaceCulling = false;
    icicle.material = icicleMat;
    icicle.parent = root;
    icicle.position.set(
      (Math.random() - 0.5) * 9,
      5.5 + Math.random() * 0.8,
      -1 + (Math.random() - 0.5) * 8
    );
    icicle.rotation.x = Math.PI;
  }

  // Interior light (warmer for shelter feel, with hints of ice blue)
  const caveLight = new PointLight(`caveLight_${index}`, Vector3.Zero(), scene);
  caveLight.position.set(position.x, position.y + 3.5, position.z - 4);
  caveLight.intensity = 0.85;
  caveLight.diffuse = new Color3(0.55, 0.6, 0.7); // Warmer than pure blue for shelter feeling
  caveLight.range = 20;

  return root;
}

/** Accumulator for cave GLB placements -- populated by createIceCaveBase, consumed by createIceEnvironment */
let iceCaveGLBPlacements: GLBPlacement[] = [];

/** Accumulator for frozen lake GLB placements -- populated by createFrozenLake, consumed by createIceEnvironment */
let frozenLakeGLBPlacements: GLBPlacement[] = [];

// ============================================================================
// ABANDONED OUTPOST (AREA B) -- GLB buildings + fenced perimeter
// ============================================================================

/**
 * Build the outpost using GLB modular window walls for structures,
 * capsule/pod as research stations, and vessels as fuel tanks.
 * Returns the root TransformNode and all GLB nodes for disposal tracking.
 *
 * Note: GLBs must be preloaded via preloadIceEnvironmentAssets before calling.
 */
function createOutpost(
  scene: Scene,
  position: Vector3
): { root: TransformNode; glbNodes: TransformNode[] } {
  const root = new TransformNode('researchOutpost', scene);
  root.position.copyFrom(position);

  const allGlbNodes: TransformNode[] = [];

  // ---- Main building: Long Window walls forming an L-shaped habitat ----

  // Front wall (facing south, SideA exterior)
  const buildingPlacements: GLBPlacement[] = [
    // Main habitat -- front wall
    {
      path: GLB.longWindowA,
      name: 'outpost_front_1',
      position: new Vector3(-3, 0, 5),
      rotationY: 0,
      scale: 1.8,
      parent: root,
    },
    {
      path: GLB.longWindowA,
      name: 'outpost_front_2',
      position: new Vector3(3, 0, 5),
      rotationY: 0,
      scale: 1.8,
      parent: root,
    },
    // Back wall (SideB interior-facing)
    {
      path: GLB.longWindowB,
      name: 'outpost_back_1',
      position: new Vector3(-3, 0, -3),
      rotationY: Math.PI,
      scale: 1.8,
      parent: root,
    },
    {
      path: GLB.longWindowB,
      name: 'outpost_back_2',
      position: new Vector3(3, 0, -3),
      rotationY: Math.PI,
      scale: 1.8,
      parent: root,
    },
    // Side walls with smaller windows
    {
      path: GLB.smallWindowsA,
      name: 'outpost_side_L',
      position: new Vector3(-7, 0, 1),
      rotationY: Math.PI / 2,
      scale: 1.8,
      parent: root,
    },
    {
      path: GLB.smallWindowsB,
      name: 'outpost_side_R',
      position: new Vector3(7, 0, 1),
      rotationY: -Math.PI / 2,
      scale: 1.8,
      parent: root,
    },

    // ---- Secondary structure: Science annex (east wing) ----
    {
      path: GLB.smallWindowsA,
      name: 'annex_front',
      position: new Vector3(14, 0, 3),
      rotationY: 0,
      scale: 1.6,
      parent: root,
    },
    {
      path: GLB.smallWindowsB,
      name: 'annex_back',
      position: new Vector3(14, 0, -2),
      rotationY: Math.PI,
      scale: 1.6,
      parent: root,
    },

    // ---- Research stations: Capsule and Pod ----
    {
      path: GLB.capsule,
      name: 'research_capsule',
      position: new Vector3(-10, 0, -1),
      rotationY: 0.4,
      scale: 2.0,
      parent: root,
    },
    {
      path: GLB.pod,
      name: 'survival_pod',
      position: new Vector3(10, 0, -6),
      rotationY: -0.3,
      scale: 2.0,
      parent: root,
    },

    // ---- Fuel / supply tanks: Vessels ----
    {
      path: GLB.vesselTall,
      name: 'fuel_tank_1',
      position: new Vector3(-12, 0, 5),
      rotationY: 0,
      scale: 2.2,
      parent: root,
    },
    {
      path: GLB.vessel,
      name: 'fuel_tank_2',
      position: new Vector3(-12, 0, 0),
      rotationY: 0.5,
      scale: 2.0,
      parent: root,
    },
    {
      path: GLB.vesselShort,
      name: 'fuel_tank_3',
      position: new Vector3(-12, 0, -4),
      rotationY: -0.2,
      scale: 2.0,
      parent: root,
    },

    // ---- Scattered crates and containers ----
    {
      path: GLB.crate,
      name: 'supply_crate_1',
      position: new Vector3(-5, 0, -6),
      rotationY: 0.15,
      scale: 1.5,
      parent: root,
    },
    {
      path: GLB.crateLong,
      name: 'supply_crate_2',
      position: new Vector3(-6, 0, -7),
      rotationY: -0.3,
      scale: 1.5,
      parent: root,
    },
    {
      path: GLB.containerFull,
      name: 'supply_container',
      position: new Vector3(5, 0, -7),
      rotationY: 0.8,
      scale: 1.5,
      parent: root,
    },
    {
      path: GLB.crate,
      name: 'supply_crate_3',
      position: new Vector3(6, 0, -8),
      rotationY: 1.2,
      scale: 1.3,
      parent: root,
    },

    // ---- Detail pieces on building surfaces ----
    {
      path: GLB.detailCylinder,
      name: 'detail_cyl_1',
      position: new Vector3(0, 2.5, 5.2),
      rotationY: 0,
      scale: 1.6,
      parent: root,
    },
    {
      path: GLB.detailDots,
      name: 'detail_dots_1',
      position: new Vector3(-5, 2.0, 5.2),
      rotationY: 0,
      scale: 1.6,
      parent: root,
    },
    {
      path: GLB.detailHexagon,
      name: 'detail_hex_1',
      position: new Vector3(5, 2.0, 5.2),
      rotationY: 0,
      scale: 2.0,
      parent: root,
    },
    {
      path: GLB.detailCylLong,
      name: 'detail_cyllong_1',
      position: new Vector3(14, 2.2, 3.2),
      rotationY: 0,
      scale: 1.4,
      parent: root,
    },
  ];

  const buildingNodes = placeGLBBatchSync(scene, buildingPlacements);
  allGlbNodes.push(...buildingNodes);

  // ---- Frost overlay on main structures (VFX -- kept as MeshBuilder) ----
  // Expand frost overlay to cover all buildings including annex
  const frostMat = createFrostOverlayMaterial(scene, 'outpostFrost');
  const frostBox = MeshBuilder.CreateBox('outpostFrostOverlay', { width: 30, height: 5, depth: 16 }, scene);
  frostBox.material = frostMat;
  frostBox.parent = root;
  frostBox.position.set(2, 2.5, 0);

  // ---- Communications antenna (broken) -- GLB chimney model ----
  buildingPlacements.push({
    path: GLB.chimney,
    name: 'outpost_antenna',
    position: new Vector3(3, 0, 1),
    rotationY: 0.3,
    scale: 1.5,
    parent: root,
  });

  // ---- Heater (heat source) -- GLB metal barrel ----
  const heaterRelativePos = new Vector3(0, 0, -5);
  buildingPlacements.push({
    path: GLB.metalBarrel,
    name: 'outpost_heater',
    position: heaterRelativePos.clone(),
    rotationY: 0,
    scale: 1.2,
    parent: root,
  });

  // Position heater light correctly relative to the barrel position
  const heaterLight = new PointLight('heaterLight', Vector3.Zero(), scene);
  heaterLight.position.set(
    position.x + heaterRelativePos.x,
    position.y + heaterRelativePos.y + 1.5, // Above the barrel
    position.z + heaterRelativePos.z
  );
  heaterLight.intensity = 1.5;
  heaterLight.diffuse = new Color3(1.0, 0.65, 0.35); // Warm amber
  heaterLight.range = 16;

  // ---- Snow drifts around outpost (GLB boulders/rocks) ----
  const driftPlacements: GLBPlacement[] = [
    {
      path: GLB.boulder,
      name: 'snowDrift_0',
      position: new Vector3(8, -0.3, 4),
      rotationY: 0.5,
      scale: 2.5,
      parent: root,
    },
    {
      path: GLB.rockMedium1,
      name: 'snowDrift_1',
      position: new Vector3(-8, -0.2, -2),
      rotationY: 1.8,
      scale: 3.0,
      parent: root,
    },
    {
      path: GLB.rockMedium2,
      name: 'snowDrift_2',
      position: new Vector3(12, -0.3, -5),
      rotationY: 2.4,
      scale: 2.8,
      parent: root,
    },
  ];
  const driftNodes = placeGLBBatchSync(scene, driftPlacements);
  allGlbNodes.push(...driftNodes);

  return { root, glbNodes: allGlbNodes };
}

// ============================================================================
// PERIMETER FENCING (surrounds outpost + marks cave entrances)
// ============================================================================

function createPerimeterFencing(
  scene: Scene,
  outpostPos: Vector3,
  cavePositions: Vector3[]
): TransformNode[] {
  const placements: GLBPlacement[] = [];

  // ---- Outpost perimeter (rectangular fence ring) ----
  // The outpost is centered at outpostPos, roughly 30x20 units.
  // Place fences in a rectangle around it with corners.
  const ox = outpostPos.x;
  const oz = outpostPos.z;
  const fenceScale = 1.2;

  // South side (4 fence panels)
  for (let i = 0; i < 4; i++) {
    placements.push({
      path: GLB.metalFence,
      name: `perim_s_${i}`,
      position: new Vector3(ox - 12 + i * 8, 0, oz - 12),
      rotationY: 0,
      scale: fenceScale,
    });
  }
  // North side (4 fence panels)
  for (let i = 0; i < 4; i++) {
    placements.push({
      path: GLB.metalFence,
      name: `perim_n_${i}`,
      position: new Vector3(ox - 12 + i * 8, 0, oz + 10),
      rotationY: Math.PI,
      scale: fenceScale,
    });
  }
  // West side (3 fence panels)
  for (let i = 0; i < 3; i++) {
    placements.push({
      path: GLB.metalFence,
      name: `perim_w_${i}`,
      position: new Vector3(ox - 16, 0, oz - 8 + i * 7),
      rotationY: Math.PI / 2,
      scale: fenceScale,
    });
  }
  // East side (3 fence panels)
  for (let i = 0; i < 3; i++) {
    placements.push({
      path: GLB.metalFence,
      name: `perim_e_${i}`,
      position: new Vector3(ox + 20, 0, oz - 8 + i * 7),
      rotationY: -Math.PI / 2,
      scale: fenceScale,
    });
  }

  // Corner pillars (tall variants at the 4 corners)
  const corners = [
    { x: ox - 16, z: oz - 12, rot: 0 },
    { x: ox + 20, z: oz - 12, rot: -Math.PI / 2 },
    { x: ox - 16, z: oz + 10, rot: Math.PI / 2 },
    { x: ox + 20, z: oz + 10, rot: Math.PI },
  ];
  for (let i = 0; i < corners.length; i++) {
    placements.push({
      path: GLB.metalCornerTall,
      name: `perim_corner_${i}`,
      position: new Vector3(corners[i].x, 0, corners[i].z),
      rotationY: corners[i].rot,
      scale: fenceScale,
    });
  }

  // Gate pillars (south side entrance gap -- pillar on each side)
  placements.push({
    path: GLB.metalPillarTall,
    name: 'gate_pillar_L',
    position: new Vector3(ox - 2, 0, oz - 12),
    rotationY: 0,
    scale: fenceScale,
  });
  placements.push({
    path: GLB.metalPillarTall,
    name: 'gate_pillar_R',
    position: new Vector3(ox + 2, 0, oz - 12),
    rotationY: 0,
    scale: fenceScale,
  });

  // ---- Cave entrance barriers (tall fences flanking each cave) ----
  // Use consistent scale with outpost fencing
  const caveFenceScale = fenceScale; // Match outpost scale for consistency
  for (let ci = 0; ci < cavePositions.length; ci++) {
    const cp = cavePositions[ci];
    // Two tall fence sections on either side of the cave mouth
    placements.push({
      path: GLB.metalFenceTall,
      name: `cave_fence_L_${ci}`,
      position: new Vector3(cp.x - 6, 0, cp.z + 3),
      rotationY: Math.PI / 2 + (ci * 0.2),
      scale: caveFenceScale,
    });
    placements.push({
      path: GLB.metalFenceTall,
      name: `cave_fence_R_${ci}`,
      position: new Vector3(cp.x + 6, 0, cp.z + 3),
      rotationY: -Math.PI / 2 + (ci * 0.2),
      scale: caveFenceScale,
    });
    // Pillar at each fence end
    placements.push({
      path: GLB.metalPillar,
      name: `cave_pillar_L_${ci}`,
      position: new Vector3(cp.x - 8, 0, cp.z + 3),
      rotationY: 0,
      scale: caveFenceScale,
    });
    placements.push({
      path: GLB.metalPillar,
      name: `cave_pillar_R_${ci}`,
      position: new Vector3(cp.x + 8, 0, cp.z + 3),
      rotationY: 0,
      scale: caveFenceScale,
    });
  }

  return placeGLBBatchSync(scene, placements);
}

// ============================================================================
// CRASHED STATION (horizon piece)
// ============================================================================

function createCrashedStation(scene: Scene): TransformNode | null {
  // station05 placed far to the south-west on the horizon, tilted as if
  // it crash-landed into the ice sheet.
  return placeGLBSync(scene, GLB.station05, 'crashedStation', new Vector3(-180, -4, -260), {
    rotationY: 0.6,
    scale: 3.5,
  });
}

// ============================================================================
// FROZEN LAKE SURROUNDINGS (GLB debris near lake)
// ============================================================================

function createLakeSurroundings(
  scene: Scene,
  lakeCenter: Vector3
): TransformNode[] {
  const placements: GLBPlacement[] = [
    // Abandoned research equipment near the lake shore
    {
      path: GLB.capsule,
      name: 'lake_capsule',
      position: new Vector3(lakeCenter.x + 50, 0, lakeCenter.z + 20),
      rotationY: 1.2,
      scale: 1.8,
    },
    {
      path: GLB.vesselShort,
      name: 'lake_vessel',
      position: new Vector3(lakeCenter.x - 45, 0, lakeCenter.z + 15),
      rotationY: -0.8,
      scale: 1.6,
    },
    // Crates that fell off a supply sled
    {
      path: GLB.crate,
      name: 'lake_crate_1',
      position: new Vector3(lakeCenter.x + 30, 0, lakeCenter.z - 35),
      rotationY: 0.6,
      scale: 1.3,
    },
    {
      path: GLB.containerFull,
      name: 'lake_container',
      position: new Vector3(lakeCenter.x - 35, 0, lakeCenter.z - 30),
      rotationY: 2.1,
      scale: 1.4,
    },
    // Detail elements on the shore
    {
      path: GLB.detailCylLong,
      name: 'lake_pipe_debris',
      position: new Vector3(lakeCenter.x + 55, 0.3, lakeCenter.z - 10),
      rotationY: 0.9,
      scale: 1.5,
    },
  ];

  return placeGLBBatchSync(scene, placements);
}

// ============================================================================
// ICE FORMATIONS (crystalline pillars, wind-carved structures) -- GLB rocks
// ============================================================================

/**
 * Create ice formation placements using GLB tall rocks and medium rocks.
 * Returns GLBPlacement array to be loaded by the batch loader.
 */
function buildIceFormationPlacements(): GLBPlacement[] {
  const pillarPositions = [
    new Vector3(-60, 0, -30),
    new Vector3(80, 0, -100),
    new Vector3(-100, 0, -180),
    new Vector3(30, 0, -240),
    new Vector3(-50, 0, -60),
    new Vector3(70, 0, -150),
    new Vector3(-20, 0, 20),
    new Vector3(100, 0, -40),
    // Additional pillars near frozen lake
    new Vector3(-65, 0, -145),
    new Vector3(55, 0, -175),
    new Vector3(10, 0, -130),
    new Vector3(-35, 0, -195),
  ];

  // Alternate between tall rock variants and medium rock variants
  const tallRockVariants = [GLB.tallRock1, GLB.tallRock2, GLB.tallRock3];
  const mediumRockVariants = [GLB.rockMedium1, GLB.rockMedium2, GLB.rockMedium3];

  const placements: GLBPlacement[] = [];

  for (let i = 0; i < pillarPositions.length; i++) {
    const pos = pillarPositions[i];
    // Tall rock for most, medium rock for every 3rd (matching original rockMat logic)
    const isRock = i % 3 === 0;
    const path = isRock
      ? mediumRockVariants[i % mediumRockVariants.length]
      : tallRockVariants[i % tallRockVariants.length];

    // Scale varies to approximate original height range (4-12 units)
    const scale = isRock ? 1.5 + (i * 0.17 % 1) * 1.5 : 2.0 + (i * 0.23 % 1) * 2.0;

    placements.push({
      path,
      name: `icePillar_${i}`,
      position: pos,
      rotationY: i * 0.73, // Varied rotation per pillar
      scale,
    });
  }

  return placements;
}

// ============================================================================
// FROZEN WATERFALLS (ice curtains near cave entrances)
// ============================================================================

function createFrozenWaterfalls(scene: Scene, positions: Vector3[]): Mesh[] {
  const waterfalls: Mesh[] = [];
  const iceMat = createIceSheetMaterial(scene, 'waterfallIce');
  iceMat.alpha = 0.55;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const columnCount = 6 + Math.floor(Math.random() * 4);

    for (let j = 0; j < columnCount; j++) {
      const height = 3.5 + Math.random() * 5.5;
      const col = MeshBuilder.CreateCylinder(
        `waterfall_${i}_${j}`,
        {
          height,
          diameterTop: 0.1 + Math.random() * 0.15,
          diameterBottom: 0.3 + Math.random() * 0.25,
          tessellation: 6,
        },
        scene
      );
      col.material = iceMat;
      col.position.set(
        pos.x + (j - columnCount / 2) * 0.6,
        pos.y + height / 2 + 2.5,
        pos.z
      );
      col.rotation.z = (Math.random() - 0.5) * 0.12;
      waterfalls.push(col);
    }
  }
  return waterfalls;
}

// ============================================================================
// TEMPERATURE ZONE SYSTEM
// ============================================================================

export function createTemperatureZones(
  scene: Scene,
  heatSourcePositions: Vector3[]
): TemperatureZone[] {
  const zones: TemperatureZone[] = [];
  const HEAT_RADIUS = 8;

  for (let i = 0; i < heatSourcePositions.length; i++) {
    const pos = heatSourcePositions[i];

    const light = new PointLight(`heatLight_${i}`, pos.clone(), scene);
    light.position.y += 1.5;
    light.intensity = 1.0;
    light.diffuse = new Color3(1.0, 0.75, 0.45); // Warmer amber color
    light.range = HEAT_RADIUS + 4;

    // Ring diameter should match heat radius for visual clarity (diameter = radius * 2)
    const ring = MeshBuilder.CreateTorus(
      `heatZone_${i}`,
      { diameter: HEAT_RADIUS * 2, thickness: 0.15, tessellation: 32 },
      scene
    );
    const ringMat = new StandardMaterial(`heatRingMat_${i}`, scene);
    ringMat.emissiveColor = new Color3(0.8, 0.4, 0.15);
    ringMat.alpha = 0.25;
    ringMat.disableLighting = true;
    ring.material = ringMat;
    ring.position.copyFrom(pos);
    ring.position.y += 0.08;
    ring.rotation.x = Math.PI / 2;

    zones.push({
      id: `heat_${i}`,
      position: pos.clone(),
      radius: HEAT_RADIUS,
      temperatureOffset: 30,
      isHeatSource: true,
      indicator: ring,
      light,
    });
  }

  // Cold zones in exposed areas - reference DEFAULT_CONFIG frozen lake position
  const coldPositions = [
    DEFAULT_CONFIG.frozenLakeCenter.clone(),    // Frozen lake center
    new Vector3(-120, 0, -100), // Open tundra west
    new Vector3(120, 0, -200),  // Wind-exposed ridge east
    new Vector3(0, 0, -280),    // Near cave entrances (exposed)
  ];
  for (let i = 0; i < coldPositions.length; i++) {
    zones.push({
      id: `cold_${i}`,
      position: coldPositions[i].clone(),
      radius: 25,
      temperatureOffset: -15,
      isHeatSource: false,
    });
  }

  return zones;
}

export function getTemperatureAtPosition(position: Vector3, zones: TemperatureZone[]): number {
  let totalOffset = 0;
  for (const zone of zones) {
    const dist = Vector3.Distance(position, zone.position);
    if (dist < zone.radius) {
      const factor = 1 - dist / zone.radius;
      totalOffset += zone.temperatureOffset * factor;
    }
  }
  return totalOffset;
}

// ============================================================================
// MAIN ENVIRONMENT CREATION (async -- loads GLBs)
// ============================================================================

/**
 * Create the complete ice environment for the Southern Ice level.
 *
 * IMPORTANT: Call preloadIceEnvironmentAssets(scene) before this function
 * to ensure all GLB assets are cached in the AssetManager. All GLB placement
 * is now synchronous via AssetManager.createInstanceByPath.
 */
export function createIceEnvironment(
  scene: Scene,
  config: Partial<IceEnvironmentConfig> = {}
): IceEnvironment {
  const cfg: IceEnvironmentConfig = { ...DEFAULT_CONFIG, ...config };

  // ---- Procedural geometry (terrain, sky, VFX) ----
  // Reset cave GLB accumulator before building caves
  iceCaveGLBPlacements = [];
  frozenLakeGLBPlacements = [];

  const terrain = createTerrain(scene, cfg);
  const skyDome = createSkyDome(scene);
  const frozenLake = createFrozenLake(scene, cfg.frozenLakeCenter, cfg.frozenLakeRadius);
  const iceCaves = cfg.cavePositions.map((pos, i) => createIceCaveBase(scene, pos, i));
  const frozenWaterfalls = createFrozenWaterfalls(
    scene,
    cfg.cavePositions.map((p) => new Vector3(p.x + 5, p.y, p.z + 2))
  );
  const temperatureZones = createTemperatureZones(scene, cfg.heatSourcePositions);
  const auroraNodes = createAuroraBorealis(scene);
  const blizzardSystem = createBlizzardParticles(scene, 0.6);
  const snowSystem = createAmbientSnow(scene);

  // ---- GLB instancing (synchronous -- assets preloaded via AssetManager) ----
  const allGlbNodes: TransformNode[] = [];

  const outpostResult = createOutpost(scene, cfg.outpostPosition);
  const fenceNodes = createPerimeterFencing(scene, cfg.outpostPosition, cfg.cavePositions);
  const crashedStation = createCrashedStation(scene);
  const lakeProps = createLakeSurroundings(scene, cfg.frozenLakeCenter);
  const caveRockNodes = placeGLBBatchSync(scene, iceCaveGLBPlacements);
  const lakePoleNodes = placeGLBBatchSync(scene, frozenLakeGLBPlacements);
  const iceFormationNodes = placeGLBBatchSync(scene, buildIceFormationPlacements());

  const outpost = outpostResult.root;
  allGlbNodes.push(...outpostResult.glbNodes);
  allGlbNodes.push(...fenceNodes);
  // Include crashed station in GLB nodes for proper frost tinting
  if (crashedStation) {
    allGlbNodes.push(crashedStation);
  }
  allGlbNodes.push(...lakeProps);
  allGlbNodes.push(...caveRockNodes);
  allGlbNodes.push(...lakePoleNodes);
  allGlbNodes.push(...iceFormationNodes);

  // Apply frost tint to all GLB-loaded meshes for visual cohesion
  applyFrostTint(scene, allGlbNodes);

  return {
    terrain,
    skyDome,
    frozenLake,
    iceCaves,
    outpost,
    frozenWaterfalls,
    iceFormations: iceFormationNodes,
    temperatureZones,
    auroraNodes,
    blizzardSystem,
    snowSystem,
    glbNodes: allGlbNodes,
  };
}

// ============================================================================
// FROST TINT -- post-processing on loaded GLBs
// ============================================================================

/**
 * Apply a subtle blue-white frost tint to all meshes under the given nodes.
 * This modifies material diffuseColor toward ice-white and adds a faint
 * emissive glow, giving the appearance of frost and ice buildup on all
 * exterior surfaces.
 */
function applyFrostTint(scene: Scene, nodes: TransformNode[]): void {
  const frostBlend = 0.25; // How much to blend toward frost colour
  const frostColor = new Color3(0.8, 0.85, 0.92);
  const emissiveBoost = new Color3(0.02, 0.03, 0.05);

  for (const node of nodes) {
    const meshes = node.getChildMeshes(false);
    for (const mesh of meshes) {
      if (mesh.material instanceof StandardMaterial) {
        const mat = mesh.material;
        // Blend diffuse toward frost
        mat.diffuseColor = Color3.Lerp(mat.diffuseColor, frostColor, frostBlend);
        // Add subtle emissive for icy sheen
        mat.emissiveColor = Color3.Lerp(mat.emissiveColor, emissiveBoost, 0.5);
        // Increase specular for frozen-over look
        mat.specularColor = Color3.Lerp(
          mat.specularColor,
          new Color3(0.5, 0.55, 0.6),
          frostBlend
        );
        mat.specularPower = Math.min(mat.specularPower + 16, 128);
      }
    }
  }
}

// ============================================================================
// DISPOSAL
// ============================================================================

export function disposeIceEnvironment(env: IceEnvironment): void {
  env.terrain.dispose();
  env.skyDome.dispose();
  env.frozenLake.dispose();

  // Dispose lake crack meshes
  for (const crack of lakeCrackMeshes) {
    crack.material?.dispose();
    crack.dispose();
  }
  lakeCrackMeshes.length = 0;

  // Dispose skybox result
  if (iceSkyboxResult) {
    iceSkyboxResult.dispose();
    iceSkyboxResult = null;
  }

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

  // Dispose all GLB-loaded nodes
  if (env.glbNodes) {
    for (const node of env.glbNodes) {
      node.getChildMeshes().forEach((m) => {
        m.material?.dispose();
        m.dispose();
      });
      node.dispose();
    }
  }

  env.blizzardSystem?.dispose();
  env.snowSystem?.dispose();
}
