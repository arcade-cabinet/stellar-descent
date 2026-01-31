/**
 * ExtractionLevel - Environment Creation
 *
 * Contains environment setup methods for tunnel, surface, and LZ areas.
 */

import type { Scene } from '@babylonjs/core/scene';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { AssetManager } from '../../core/AssetManager';
import { HiveEnvironmentBuilder } from '../shared/HiveEnvironmentBuilder';
import { createDynamicTerrain, SAND_TERRAIN, type TerrainResult } from '../shared/SurfaceTerrainFactory';
import { buildExtractionEnvironment, type ExtractionEnvironmentResult } from './ExtractionEnvironmentBuilder';

import * as C from './constants';

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

  // Create collapse wall
  const collapseMat = new StandardMaterial('collapseMat', scene);
  collapseMat.diffuseColor = new Color3(0.2, 0.1, 0.05);
  collapseMat.emissiveColor = new Color3(0.3, 0.15, 0.05);

  const collapseWall = MeshBuilder.CreateSphere('collapseWall', { diameter: 20, segments: 8 }, scene);
  collapseWall.material = collapseMat;
  collapseWall.position.z = 30;
  collapseWall.scaling.set(1, 1, 3);

  // Create exit light
  const exitLight = new PointLight('exitLight', new Vector3(0, 2, -C.ESCAPE_TUNNEL_LENGTH), scene);
  exitLight.diffuse = new Color3(1, 0.8, 0.5);
  exitLight.intensity = 50;
  exitLight.range = 80;

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

export async function buildLZEnvironment(scene: Scene): Promise<ExtractionEnvironmentResult | null> {
  try {
    return await buildExtractionEnvironment(scene);
  } catch (err) {
    console.error('[ExtractionLevel] Failed to build LZ environment:', err);
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
    spawnPoints.push(new Vector3(
      C.LZ_POSITION.x + Math.cos(angle) * spawnRadius,
      0,
      C.LZ_POSITION.z + Math.sin(angle) * spawnRadius
    ));
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
  const mechNode = AssetManager.createInstanceByPath(C.GLB_MECH, 'marcusMech', scene, true, 'vehicle');
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
  const hullNode = AssetManager.createInstanceByPath(C.GLB_DROPSHIP, 'dropshipHull', scene, true, 'vehicle');
  if (hullNode) hullNode.parent = dropship;

  // Create ramp
  const rampMat = new StandardMaterial('rampMat', scene);
  rampMat.diffuseColor = new Color3(0.35, 0.35, 0.4);
  rampMat.specularColor = new Color3(0.2, 0.2, 0.2);

  const dropshipRamp = MeshBuilder.CreateBox('dropshipRamp', { width: 4, height: 0.2, depth: 6 }, scene);
  dropshipRamp.material = rampMat;
  dropshipRamp.position.set(0, -2, 7.5);
  dropshipRamp.setPivotPoint(new Vector3(0, 0, -3));
  dropshipRamp.parent = dropship;

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
    ...C.GLB_DEBRIS_VARIANTS.map((p) => AssetManager.loadAssetByPath(p, scene)),
  ]);
}
