/**
 * Landfall Environment Creation
 * Factory functions for creating all visual elements during level setup
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import { AssetManager } from '../../core/AssetManager';
import { createDynamicTerrain, ROCK_TERRAIN } from '../shared/SurfaceTerrainFactory';
import { createAcidPools, createUnstableTerrain } from './surface-combat';
import { SURFACE_GLB_PATHS, ARENA_GLB_PATHS } from './constants';

export interface EnvironmentMeshes {
  planet: Mesh;
  planetAtmosphere: Mesh;
  starfield: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
  leftGlove: Mesh;
  rightGlove: Mesh;
  visorFrame: Mesh;
  leftHandle: Mesh;
  rightHandle: Mesh;
  thrusterGlow: Mesh;
  plasmaGlow: Mesh;
  heatDistortion: Mesh;
  lzPad: TransformNode;
  lzBeacon: Mesh;
  terrain: Mesh;
  skyDome: Mesh;
  fobDeltaMarker: Mesh;
  fobDeltaBeacon: Mesh;
}

export interface SurfaceElements {
  terrain: Mesh;
  canyonWalls: TransformNode[];
  coverObjects: (Mesh | TransformNode)[];
  acidPools: Mesh[];
  unstableTerrain: Mesh[];
  skyDome: Mesh;
  fobDeltaMarker: Mesh;
  fobDeltaBeacon: Mesh;
}

/**
 * Create starfield sphere
 */
export function createStarfield(scene: Scene): Mesh {
  const starfield = MeshBuilder.CreateSphere('stars', { diameter: 8000, segments: 16, sideOrientation: 1 }, scene);
  const mat = new StandardMaterial('starsMat', scene);
  mat.emissiveColor = new Color3(0.03, 0.03, 0.06);
  mat.disableLighting = true;
  starfield.material = mat;
  starfield.infiniteDistance = true;
  return starfield;
}

/**
 * Create planet and atmosphere
 */
export function createPlanet(scene: Scene): { planet: Mesh; planetAtmosphere: Mesh } {
  const planet = MeshBuilder.CreateSphere('planet', { diameter: 80, segments: 64 }, scene);
  const planetMat = new StandardMaterial('planetMat', scene);
  planetMat.diffuseColor = Color3.FromHexString('#9B7B5A');
  planetMat.specularColor = new Color3(0.08, 0.06, 0.04);
  planet.material = planetMat;
  planet.position.set(0, -150, 0);

  const planetAtmosphere = MeshBuilder.CreateSphere('atmos', { diameter: 90, segments: 32 }, scene);
  const atmosMat = new StandardMaterial('atmosMat', scene);
  atmosMat.emissiveColor = new Color3(0.9, 0.6, 0.4);
  atmosMat.alpha = 0.15;
  atmosMat.backFaceCulling = false;
  planetAtmosphere.material = atmosMat;
  planetAtmosphere.position.copyFrom(planet.position);

  return { planet, planetAtmosphere };
}

/**
 * Create freefall view elements (arms, gloves, visor)
 */
export function createFreefallView(scene: Scene): {
  leftArm: Mesh;
  rightArm: Mesh;
  leftGlove: Mesh;
  rightGlove: Mesh;
  visorFrame: Mesh;
} {
  const armMat = new StandardMaterial('armMat', scene);
  armMat.diffuseColor = new Color3(0.15, 0.15, 0.18);

  const leftArm = MeshBuilder.CreateCylinder('leftArm', { height: 3, diameterTop: 0.25, diameterBottom: 0.3 }, scene);
  leftArm.material = armMat;
  leftArm.position.set(-1.8, -2.5, 0);

  const rightArm = MeshBuilder.CreateCylinder('rightArm', { height: 3, diameterTop: 0.25, diameterBottom: 0.3 }, scene);
  rightArm.material = armMat;
  rightArm.position.set(1.8, -2.5, 0);

  const gloveMat = new StandardMaterial('gloveMat', scene);
  gloveMat.diffuseColor = new Color3(0.3, 0.25, 0.2);

  const leftGlove = MeshBuilder.CreateSphere('leftGlove', { diameter: 0.5 }, scene);
  leftGlove.material = gloveMat;
  leftGlove.position.set(-1.8, -4.2, 0.3);
  leftGlove.scaling.set(1, 0.6, 1.2);

  const rightGlove = MeshBuilder.CreateSphere('rightGlove', { diameter: 0.5 }, scene);
  rightGlove.material = gloveMat;
  rightGlove.position.set(1.8, -4.2, 0.3);
  rightGlove.scaling.set(1, 0.6, 1.2);

  const visorFrame = MeshBuilder.CreateTorus('visor', { diameter: 10, thickness: 0.3 }, scene);
  const visorMat = new StandardMaterial('visorMat', scene);
  visorMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
  visorMat.alpha = 0.6;
  visorFrame.material = visorMat;
  visorFrame.rotation.x = Math.PI / 2;
  visorFrame.position.y = -2;

  return { leftArm, rightArm, leftGlove, rightGlove, visorFrame };
}

/**
 * Create powered descent view elements (handles, thruster glow)
 */
export function createPoweredDescentView(scene: Scene): {
  leftHandle: Mesh;
  rightHandle: Mesh;
  thrusterGlow: Mesh;
} {
  const handleMat = new StandardMaterial('handleMat', scene);
  handleMat.diffuseColor = new Color3(0.2, 0.2, 0.22);

  const leftHandle = MeshBuilder.CreateCylinder('leftHandle', { height: 0.8, diameter: 0.12 }, scene);
  leftHandle.material = handleMat;
  leftHandle.position.set(-0.6, -0.3, 0.5);
  leftHandle.rotation.z = Math.PI / 2;

  const rightHandle = MeshBuilder.CreateCylinder('rightHandle', { height: 0.8, diameter: 0.12 }, scene);
  rightHandle.material = handleMat;
  rightHandle.position.set(0.6, -0.3, 0.5);
  rightHandle.rotation.z = Math.PI / 2;

  const thrusterGlow = MeshBuilder.CreateDisc('thrusterGlow', { radius: 0.8 }, scene);
  const thrusterMat = new StandardMaterial('thrusterMat', scene);
  thrusterMat.emissiveColor = new Color3(0.3, 0.5, 1);
  thrusterMat.alpha = 0;
  thrusterMat.disableLighting = true;
  thrusterGlow.material = thrusterMat;
  thrusterGlow.position.set(0, -1, 1);
  thrusterGlow.rotation.x = Math.PI / 2;

  return { leftHandle, rightHandle, thrusterGlow };
}

/**
 * Create plasma and heat distortion effects
 */
export function createEntryEffectMeshes(scene: Scene): {
  plasmaGlow: Mesh;
  heatDistortion: Mesh;
} {
  const plasmaGlow = MeshBuilder.CreateTorus('plasma', { diameter: 12, thickness: 2 }, scene);
  const plasmaMat = new StandardMaterial('plasmaMat', scene);
  plasmaMat.emissiveColor = new Color3(1, 0.5, 0.15);
  plasmaMat.alpha = 0;
  plasmaMat.disableLighting = true;
  plasmaGlow.material = plasmaMat;
  plasmaGlow.rotation.x = Math.PI / 2;
  plasmaGlow.position.y = -3;

  const heatDistortion = MeshBuilder.CreateSphere('heatDistortion', { diameter: 8, segments: 16 }, scene);
  const heatMat = new StandardMaterial('heatMat', scene);
  heatMat.emissiveColor = new Color3(1, 0.4, 0.1);
  heatMat.alpha = 0;
  heatMat.disableLighting = true;
  heatMat.backFaceCulling = false;
  heatDistortion.material = heatMat;
  heatDistortion.position.y = -4;

  return { plasmaGlow, heatDistortion };
}

/**
 * Create landing zone pad and beacon
 */
export function createLandingZone(scene: Scene): {
  lzPad: TransformNode | null;
  lzBeacon: Mesh;
} {
  const lzPadNode = AssetManager.createInstanceByPath(SURFACE_GLB_PATHS.lzPadAsphalt, 'lzPad', scene, true, 'environment');
  if (lzPadNode) {
    lzPadNode.scaling.set(2, 1, 2);
    lzPadNode.position.set(0, 0.05, 0);
    lzPadNode.setEnabled(false);
  }

  const lzBeacon = MeshBuilder.CreateCylinder('beacon', { height: 20, diameter: 2 }, scene);
  const beaconMat = new StandardMaterial('beaconMat', scene);
  beaconMat.emissiveColor = new Color3(0.2, 1, 0.3);
  beaconMat.alpha = 0.3;
  lzBeacon.material = beaconMat;
  lzBeacon.position.y = 10;
  lzBeacon.isVisible = false;

  return { lzPad: lzPadNode, lzBeacon };
}

/**
 * Create surface elements (terrain, sky, canyon walls)
 */
export function createSurface(scene: Scene): SurfaceElements {
  const { mesh: terrain } = createDynamicTerrain(scene, { ...ROCK_TERRAIN, size: 600, materialName: 'landfallTerrain' });
  terrain.isVisible = false;

  // Canyon walls
  const wallGlbPaths = [SURFACE_GLB_PATHS.wallRg1, SURFACE_GLB_PATHS.wallRg15, SURFACE_GLB_PATHS.wallHs1, SURFACE_GLB_PATHS.wallHs15];
  const wallPositions = [{ x: -70, z: -50, rotY: 0 }, { x: 70, z: -50, rotY: Math.PI }, { x: -80, z: -80, rotY: 0 }, { x: 80, z: -80, rotY: Math.PI }];
  const canyonWalls: TransformNode[] = [];

  for (let i = 0; i < 4; i++) {
    const wallNode = AssetManager.createInstanceByPath(wallGlbPaths[i], `canyonWall_${i}`, scene, true, 'environment');
    if (wallNode) {
      wallNode.scaling.set(8, 15, 25);
      wallNode.position.set(wallPositions[i].x, 50, wallPositions[i].z);
      wallNode.rotation.y = wallPositions[i].rotY;
      wallNode.setEnabled(false);
      canyonWalls.push(wallNode);
    }
  }

  const coverObjects = createCombatArenaCover(scene);
  const acidPools = createAcidPools(scene);
  const unstableTerrain = createUnstableTerrain(scene);
  const { fobDeltaMarker, fobDeltaBeacon } = createFOBDeltaMarker(scene);

  const skyDome = MeshBuilder.CreateSphere('sky', { diameter: 5000, segments: 16, sideOrientation: 1 }, scene);
  const skyMat = new StandardMaterial('skyMat', scene);
  skyMat.emissiveColor = new Color3(0.75, 0.5, 0.35);
  skyMat.disableLighting = true;
  skyDome.material = skyMat;
  skyDome.isVisible = false;

  return { terrain, canyonWalls, coverObjects, acidPools, unstableTerrain, skyDome, fobDeltaMarker, fobDeltaBeacon };
}

/**
 * Create combat arena cover objects
 */
function createCombatArenaCover(scene: Scene): (Mesh | TransformNode)[] {
  const coverObjects: (Mesh | TransformNode)[] = [];
  const rockGlbs = [ARENA_GLB_PATHS.boulderA, ARENA_GLB_PATHS.rockMedA, ARENA_GLB_PATHS.rockMedB, ARENA_GLB_PATHS.rockMedC];
  const rockPositions = [
    { pos: new Vector3(15, 0, 20), scale: new Vector3(2.5, 2.5, 3), rotY: 0.3 },
    { pos: new Vector3(-18, 0, 15), scale: new Vector3(2, 2, 2.5), rotY: -0.5 },
    { pos: new Vector3(8, 0, 35), scale: new Vector3(1.8, 1.8, 2), rotY: 0.8 },
    { pos: new Vector3(-10, 0, 30), scale: new Vector3(1.5, 1.2, 1.5), rotY: 1.2 },
  ];

  for (let i = 0; i < rockPositions.length; i++) {
    const r = rockPositions[i];
    const node = AssetManager.createInstanceByPath(rockGlbs[i], `rock_${i}`, scene, true, 'prop');
    if (node) {
      node.position = r.pos;
      node.rotation = new Vector3(0, r.rotY, 0);
      node.scaling = r.scale;
      node.setEnabled(false);
      coverObjects.push(node);
    }
  }

  const crashedHull = AssetManager.createInstanceByPath(ARENA_GLB_PATHS.shippingContainer, 'crashedHull', scene, true, 'prop');
  if (crashedHull) {
    crashedHull.position.set(0, 0, 25);
    crashedHull.rotation.set(0, 0.4, Math.PI / 6);
    crashedHull.scaling.setAll(1.5);
    crashedHull.setEnabled(false);
    coverObjects.push(crashedHull);
  }

  return coverObjects;
}

/**
 * Create FOB Delta waypoint marker
 */
function createFOBDeltaMarker(scene: Scene): { fobDeltaMarker: Mesh; fobDeltaBeacon: Mesh } {
  const fobDeltaPosition = new Vector3(0, 0, -150);

  const markerMat = new StandardMaterial('fobMarkerMat', scene);
  markerMat.emissiveColor = new Color3(0.2, 0.6, 1.0);
  markerMat.alpha = 0.6;
  markerMat.disableLighting = true;

  const fobDeltaBeacon = MeshBuilder.CreateCylinder('fobDeltaBeacon', { height: 50, diameter: 3, tessellation: 8 }, scene);
  fobDeltaBeacon.material = markerMat;
  fobDeltaBeacon.position = fobDeltaPosition.clone();
  fobDeltaBeacon.position.y = 25;
  fobDeltaBeacon.isVisible = false;

  const fobDeltaMarker = MeshBuilder.CreateTorus('fobDeltaMarker', { diameter: 8, thickness: 0.5, tessellation: 24 }, scene);
  const groundMat = new StandardMaterial('fobGroundMat', scene);
  groundMat.diffuseColor = Color3.FromHexString('#4080C0');
  groundMat.emissiveColor = new Color3(0.1, 0.3, 0.5);
  fobDeltaMarker.material = groundMat;
  fobDeltaMarker.position = fobDeltaPosition.clone();
  fobDeltaMarker.position.y = 0.2;
  fobDeltaMarker.rotation.x = Math.PI / 2;
  fobDeltaMarker.isVisible = false;

  return { fobDeltaMarker, fobDeltaBeacon };
}
