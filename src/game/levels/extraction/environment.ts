/**
 * ExtractionLevel - Environment Creation
 *
 * Contains environment setup methods for tunnel, surface, and LZ areas.
 * Uses GLB assets for all static geometry; MeshBuilder only for VFX beacons.
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
import { HiveEnvironmentBuilder } from '../shared/HiveEnvironmentBuilder';

const log = getLogger('ExtractionEnvironment');

import {
  createDynamicTerrain,
  SAND_TERRAIN,
  type TerrainResult,
} from '../shared/SurfaceTerrainFactory';
import * as C from './constants';
import {
  buildExtractionEnvironment,
  type ExtractionEnvironmentResult,
} from './ExtractionEnvironmentBuilder';

// ============================================================================
// GLB ASSET PATHS FOR ENVIRONMENT
// ============================================================================

/** Debris/rubble for collapse wall */
const GLB_COLLAPSE_RUBBLE = '/assets/models/props/debris/bricks_stacked_mx_4.glb';

/** Floor tile for dropship ramp */
const GLB_RAMP_FLOOR = '/assets/models/environment/modular/FloorTile_Basic.glb';

// ============================================================================
// ENVIRONMENT REFS
// ============================================================================

export interface TunnelEnvironment {
  hiveBuilder: HiveEnvironmentBuilder;
  tunnelSegments: TransformNode[];
  tunnelLights: PointLight[];
  collapseWall: Mesh;
  exitLight: PointLight;
}

export interface SurfaceEnvironment {
  surfaceTerrain: TerrainResult;
  terrain: Mesh;
}

export interface LZEnvironment {
  extractionEnv: ExtractionEnvironmentResult | null;
  lzBeacon: Mesh;
  spawnPoints: Vector3[];
  coverObjects: Mesh[];
}

export interface DropshipAssets {
  dropship: TransformNode;
  dropshipRamp: Mesh;
  dropshipLight: PointLight;
  dropshipRampLight: PointLight;
  dropshipThrustEmitters: TransformNode[];
}

export interface MechAssets {
  mechMesh: TransformNode;
  mechGunLight: PointLight;
}

// ============================================================================
// TUNNEL CREATION
// ============================================================================

export function createEscapeTunnel(scene: Scene): TunnelEnvironment {
  const hiveBuilder = new HiveEnvironmentBuilder(scene, { logPrefix: 'Extraction' });
  hiveBuilder.setupGlowLayer();

  const tunnelSegments: TransformNode[] = [];
  const tunnelLights: PointLight[] = [];

  const segmentLength = 20;
  const numSegments = 15;

  // Create tunnel segments
  for (let i = 0; i < numSegments; i++) {
    const segment = hiveBuilder.createTunnelSegment(
      new Vector3(0, 0, -i * segmentLength - segmentLength / 2),
      0,
      'upper'
    );
    tunnelSegments.push(segment.node);
  }

  // Create biolights
  for (let i = 0; i < numSegments; i++) {
    if (i % 2 === 0) {
      const side = i % 4 === 0 ? -1.5 : 1.5;
      hiveBuilder.createBiolight(
        new Vector3(side, 3, -i * segmentLength - segmentLength / 2),
        0.8 + Math.random() * 0.4
      );
    }
  }

  // Create starting chamber
  hiveBuilder.createChamber(new Vector3(0, 0, 5), 8, 'lower');

  // FIX #33: Create cave collapse wall using GLB rubble asset
  // Stack multiple rubble instances to create a convincing collapse barrier
  const collapseRoot = new TransformNode('collapseWallRoot', scene);
  collapseRoot.position.z = 30;
  collapseRoot.position.y = 0;

  // Load and instance rubble GLB for collapse wall
  const rubbleNode = AssetManager.createInstanceByPath(
    GLB_COLLAPSE_RUBBLE,
    'collapseWall_main',
    scene,
    false,
    'environment'
  );

  let collapseWall: Mesh;
  if (rubbleNode) {
    rubbleNode.position.set(0, 2, 0);
    rubbleNode.scaling.set(4, 6, 3);
    rubbleNode.rotation.set(0.3, 0, 0.1);
    rubbleNode.parent = collapseRoot;

    // Add secondary rubble for more coverage
    const rubbleNode2 = AssetManager.createInstanceByPath(
      GLB_COLLAPSE_RUBBLE,
      'collapseWall_secondary',
      scene,
      false,
      'environment'
    );
    if (rubbleNode2) {
      rubbleNode2.position.set(-3, 1, 1);
      rubbleNode2.scaling.set(3, 4, 2.5);
      rubbleNode2.rotation.set(-0.2, 0.5, 0.15);
      rubbleNode2.parent = collapseRoot;
    }

    const rubbleNode3 = AssetManager.createInstanceByPath(
      GLB_COLLAPSE_RUBBLE,
      'collapseWall_tertiary',
      scene,
      false,
      'environment'
    );
    if (rubbleNode3) {
      rubbleNode3.position.set(3, 0.5, -0.5);
      rubbleNode3.scaling.set(2.5, 5, 2);
      rubbleNode3.rotation.set(0.1, -0.3, -0.1);
      rubbleNode3.parent = collapseRoot;
    }

    // Cast the root's first mesh child as the collision reference
    collapseWall = rubbleNode as unknown as Mesh;
  } else {
    // Fallback: create simple box if GLB fails (should not happen per CLAUDE.md)
    log.warn('Failed to load collapse rubble GLB, using fallback');
    const collapseMat = new StandardMaterial('collapseMat', scene);
    collapseMat.diffuseColor = new Color3(0.25, 0.12, 0.08);
    collapseMat.emissiveColor = new Color3(0.4, 0.2, 0.08);

    collapseWall = MeshBuilder.CreateCylinder(
      'collapseWall',
      {
        height: 12,
        diameter: 10,
        tessellation: 12,
      },
      scene
    );
    collapseWall.material = collapseMat;
    collapseWall.position.z = 30;
    collapseWall.position.y = 0;
    collapseWall.rotation.x = Math.PI / 2;
    collapseWall.scaling.set(1.5, 3, 1.5);
  }

  // FIX #32: Stronger exit light to guide player
  const exitLight = new PointLight('exitLight', new Vector3(0, 2, -C.ESCAPE_TUNNEL_LENGTH), scene);
  exitLight.diffuse = new Color3(1, 0.85, 0.6);
  exitLight.intensity = 120; // Increased from 50
  exitLight.range = 120; // Increased from 80

  return {
    hiveBuilder,
    tunnelSegments,
    tunnelLights,
    collapseWall,
    exitLight,
  };
}

// ============================================================================
// SURFACE CREATION
// ============================================================================

export function createSurfaceEnvironment(scene: Scene): SurfaceEnvironment {
  const surfaceTerrain = createDynamicTerrain(scene, {
    ...SAND_TERRAIN,
    size: 800,
    heightScale: 8,
    seed: 99210,
    materialName: 'extractionSandTerrain',
  });

  const terrain = surfaceTerrain.mesh;
  terrain.position.z = -400;

  return {
    surfaceTerrain,
    terrain,
  };
}

// ============================================================================
// LZ CREATION
// ============================================================================

export async function buildLZEnvironment(
  scene: Scene
): Promise<ExtractionEnvironmentResult | null> {
  try {
    return await buildExtractionEnvironment(scene);
  } catch (err) {
    log.error('Failed to build LZ environment:', err);
    return null;
  }
}

export function createLZBeacon(scene: Scene): Mesh {
  const lzBeacon = MeshBuilder.CreateCylinder('beacon', { height: 40, diameter: 3 }, scene);
  const beaconMat = new StandardMaterial('beaconMat', scene);
  beaconMat.emissiveColor = new Color3(0.2, 1, 0.3);
  beaconMat.alpha = 0.3;
  lzBeacon.material = beaconMat;
  lzBeacon.position.set(C.LZ_POSITION.x, 20, C.LZ_POSITION.z);
  return lzBeacon;
}

export function setupHoldoutArena(): Vector3[] {
  const spawnPoints: Vector3[] = [];
  const spawnRadius = 55;

  // Perimeter spawn points
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    spawnPoints.push(
      new Vector3(
        C.LZ_POSITION.x + Math.cos(angle) * spawnRadius,
        0,
        C.LZ_POSITION.z + Math.sin(angle) * spawnRadius
      )
    );
  }

  // North gap spawn points
  spawnPoints.push(new Vector3(C.LZ_POSITION.x - 8, 0, C.LZ_POSITION.z + 60));
  spawnPoints.push(new Vector3(C.LZ_POSITION.x + 8, 0, C.LZ_POSITION.z + 60));
  spawnPoints.push(new Vector3(C.LZ_POSITION.x, 0, C.LZ_POSITION.z + 65));

  // Breach hole spawn points
  const breachPositions = [
    new Vector3(C.LZ_POSITION.x - 50, 0, C.LZ_POSITION.z + 15),
    new Vector3(C.LZ_POSITION.x + 50, 0, C.LZ_POSITION.z + 10),
    new Vector3(C.LZ_POSITION.x - 30, 0, C.LZ_POSITION.z + 55),
    new Vector3(C.LZ_POSITION.x + 30, 0, C.LZ_POSITION.z + 55),
  ];
  for (const pos of breachPositions) {
    spawnPoints.push(pos);
  }

  return spawnPoints;
}

// ============================================================================
// MECH CREATION
// ============================================================================

export function createMarcusMech(scene: Scene): MechAssets {
  const mechNode = AssetManager.createInstanceByPath(
    C.GLB_MECH,
    'marcusMech',
    scene,
    true,
    'vehicle'
  );
  const mechMesh = mechNode ?? new TransformNode('marcusMech', scene);

  const mechGunLight = new PointLight('mechGunLight', new Vector3(0, 5, -3), scene);
  mechGunLight.diffuse = new Color3(1, 0.8, 0.3);
  mechGunLight.intensity = 0;
  mechGunLight.range = 30;
  mechGunLight.parent = mechMesh;

  mechMesh.position.set(15, 0, C.LZ_POSITION.z + 20);
  mechMesh.rotation.y = Math.PI * 0.8;
  mechMesh.setEnabled(false);

  return {
    mechMesh,
    mechGunLight,
  };
}

// ============================================================================
// DROPSHIP CREATION
// ============================================================================

export function createDropship(scene: Scene): DropshipAssets {
  const dropship = new TransformNode('dropship', scene);

  // Load hull GLB
  const hullNode = AssetManager.createInstanceByPath(
    C.GLB_DROPSHIP,
    'dropshipHull',
    scene,
    true,
    'vehicle'
  );
  if (hullNode) hullNode.parent = dropship;

  // Create ramp using GLB floor tile asset
  let dropshipRamp: Mesh;
  const rampNode = AssetManager.createInstanceByPath(
    GLB_RAMP_FLOOR,
    'dropshipRamp',
    scene,
    false,
    'vehicle'
  );

  if (rampNode) {
    // Scale and position the floor tile to serve as a ramp
    rampNode.scaling.set(0.72, 0.05, 1.1); // Width ~4m, thin, depth ~6m
    rampNode.position.set(0, -2, 7.5);
    rampNode.rotation.set(0, 0, 0);
    rampNode.parent = dropship;
    dropshipRamp = rampNode as unknown as Mesh;
  } else {
    // Fallback: create simple box if GLB fails
    log.warn('Failed to load ramp GLB, using fallback');
    const rampMat = new StandardMaterial('rampMat', scene);
    rampMat.diffuseColor = new Color3(0.35, 0.35, 0.4);
    rampMat.specularColor = new Color3(0.2, 0.2, 0.2);

    dropshipRamp = MeshBuilder.CreateBox(
      'dropshipRamp',
      { width: 4, height: 0.2, depth: 6 },
      scene
    );
    dropshipRamp.material = rampMat;
    dropshipRamp.position.set(0, -2, 7.5);
    dropshipRamp.setPivotPoint(new Vector3(0, 0, -3));
    dropshipRamp.parent = dropship;
  }

  // Ramp light
  const dropshipRampLight = new PointLight('rampLight', new Vector3(0, -1, 5), scene);
  dropshipRampLight.diffuse = Color3.FromHexString('#90E0FF');
  dropshipRampLight.intensity = 0;
  dropshipRampLight.range = 20;
  dropshipRampLight.parent = dropship;

  // Thrust emitters
  const dropshipThrustEmitters: TransformNode[] = [];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const thrustEmitter = new TransformNode(`thrustEmitter_${i}`, scene);
    thrustEmitter.position.set(side * 10, -1, 4);
    thrustEmitter.parent = dropship;
    dropshipThrustEmitters.push(thrustEmitter);
  }

  const mainThrustEmitter = new TransformNode('mainThrustEmitter', scene);
  mainThrustEmitter.position.set(0, -2.5, 0);
  mainThrustEmitter.parent = dropship;
  dropshipThrustEmitters.push(mainThrustEmitter);

  // Main light
  const dropshipLight = new PointLight('dropshipLight', new Vector3(0, -5, 0), scene);
  dropshipLight.diffuse = new Color3(1, 0.95, 0.8);
  dropshipLight.intensity = 100;
  dropshipLight.range = 80;
  dropshipLight.parent = dropship;

  // Initial position (offscreen)
  dropship.position.set(0, 200, C.LZ_POSITION.z - 300);
  dropship.setEnabled(false);

  return {
    dropship,
    dropshipRamp,
    dropshipLight,
    dropshipRampLight,
    dropshipThrustEmitters,
  };
}

// ============================================================================
// VISIBILITY HELPERS
// ============================================================================

export function setTunnelVisible(env: TunnelEnvironment, visible: boolean): void {
  env.tunnelSegments.forEach((s) => s.setEnabled(visible));
  env.tunnelLights.forEach((l) => l.setEnabled(visible));
  env.collapseWall.isVisible = visible;
  env.exitLight.setEnabled(visible);
}

export function setSurfaceVisible(
  terrain: Mesh | null,
  extractionEnv: ExtractionEnvironmentResult | null,
  skyDome: Mesh | null,
  lzPad: Mesh | null,
  lzBeacon: Mesh | null,
  breachHoles: Mesh[],
  canyonWalls: Mesh[],
  barrierWalls: Mesh[],
  coverObjects: Mesh[],
  mechMesh: TransformNode | null,
  visible: boolean
): void {
  if (terrain) terrain.isVisible = visible;
  if (extractionEnv) {
    extractionEnv.root.setEnabled(visible);
    for (const light of extractionEnv.lights) light.setEnabled(visible);
  }
  if (skyDome) skyDome.isVisible = visible;
  if (lzPad) lzPad.isVisible = visible;
  if (lzBeacon) lzBeacon.isVisible = visible;
  breachHoles.forEach((h) => (h.isVisible = visible));
  canyonWalls.forEach((w) => (w.isVisible = visible));
  barrierWalls.forEach((b) => (b.isVisible = visible));
  coverObjects.forEach((c) => (c.isVisible = visible));
  if (mechMesh) mechMesh.setEnabled(visible);
}

// ============================================================================
// ASSET PRELOADING
// ============================================================================

export async function preloadAssets(scene: Scene): Promise<void> {
  await Promise.all([
    AssetManager.loadAssetByPath(C.GLB_MECH, scene),
    AssetManager.loadAssetByPath(C.GLB_DROPSHIP, scene),
    AssetManager.loadAssetByPath(C.GLB_SUPPLY_DROP, scene),
    AssetManager.loadAssetByPath(C.GLB_AMMO_BOX, scene),
    AssetManager.loadAssetByPath(C.GLB_CRUMBLING_WALL, scene),
    AssetManager.loadAssetByPath(GLB_COLLAPSE_RUBBLE, scene),
    AssetManager.loadAssetByPath(GLB_RAMP_FLOOR, scene),
    ...C.GLB_DEBRIS_VARIANTS.map((p) => AssetManager.loadAssetByPath(p, scene)),
  ]);
}
