/**
 * LandfallLevel Anchor Station
 * Building logic for the Anchor Station Prometheus visible during HALO drop.
 */

import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';

import { AssetManager } from '../../core/AssetManager';
import { STATION_GLB_PATHS, STATION_INITIAL_DISTANCE } from './constants';

// ---------------------------------------------------------------------------
// Station Building Result
// ---------------------------------------------------------------------------

export interface AnchorStationNodes {
  /** Root transform node for the station */
  root: TransformNode;
  /** GLB model nodes */
  glbNodes: TransformNode[];
  /** Running light meshes */
  lights: Mesh[];
}

// ---------------------------------------------------------------------------
// Station Light Positions
// ---------------------------------------------------------------------------

const LIGHT_POSITIONS = [
  { pos: new Vector3(20, 0, 0), type: 'nav' },
  { pos: new Vector3(-20, 0, 0), type: 'nav' },
  { pos: new Vector3(0, 0, 20), type: 'nav' },
  { pos: new Vector3(0, 0, -20), type: 'nav' },
  { pos: new Vector3(0, 8, 0), type: 'warning' },
  { pos: new Vector3(0, -8, 0), type: 'warning' },
  { pos: new Vector3(3, -12, 3), type: 'warning' },
  { pos: new Vector3(-3, -12, 3), type: 'warning' },
  { pos: new Vector3(3, -12, -3), type: 'warning' },
  { pos: new Vector3(-3, -12, -3), type: 'warning' },
] as const;

// ---------------------------------------------------------------------------
// Station Building
// ---------------------------------------------------------------------------

/**
 * Creates the Anchor Station Prometheus visible above the player during the HALO drop.
 * Uses pre-loaded station-external GLB models composed into a station assembly.
 */
export function createAnchorStation(scene: Scene): AnchorStationNodes {
  const root = new TransformNode('anchorStation', scene);
  root.position.set(0, STATION_INITIAL_DISTANCE, 0);

  const glbNodes: TransformNode[] = [];
  const lights: Mesh[] = [];

  // Helper: create a GLB instance parented to the station
  const placeStationPart = (
    path: string,
    name: string,
    pos: Vector3,
    rot: Vector3,
    scale: Vector3
  ): void => {
    const node = AssetManager.createInstanceByPath(path, name, scene, true, 'environment');
    if (!node) {
      throw new Error(`[Landfall] Station GLB instance failed: ${name} (${path}) - asset not loaded`);
    }
    node.position = pos;
    node.rotation = rot;
    node.scaling = scale;
    node.parent = root;
    glbNodes.push(node);
  };

  // === CENTRAL HUB (station01) ===
  placeStationPart(
    STATION_GLB_PATHS.hullCenter,
    'stationHub',
    Vector3.Zero(),
    Vector3.Zero(),
    new Vector3(4, 4, 4)
  );

  // === HABITAT RING SECTIONS (station02 + station03) ===
  placeStationPart(
    STATION_GLB_PATHS.hullRingA,
    'stationRingA',
    new Vector3(12, 0, 0),
    new Vector3(0, 0, 0),
    new Vector3(3.5, 3.5, 3.5)
  );
  placeStationPart(
    STATION_GLB_PATHS.hullRingB,
    'stationRingB',
    new Vector3(-12, 0, 0),
    new Vector3(0, Math.PI, 0),
    new Vector3(3.5, 3.5, 3.5)
  );

  // === SOLAR PANEL WINGS (station04) ===
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    placeStationPart(
      STATION_GLB_PATHS.solarWing,
      `solarWing_${i}`,
      new Vector3(Math.cos(angle) * 20, 2, Math.sin(angle) * 20),
      new Vector3(0, angle, 0),
      new Vector3(3, 3, 3)
    );
  }

  // === DOCKING / DROP BAY (station05) ===
  placeStationPart(
    STATION_GLB_PATHS.dockingBay,
    'stationDropBay',
    new Vector3(0, -10, 0),
    Vector3.Zero(),
    new Vector3(3, 3, 3)
  );

  // === ANTENNA / COMMS ARRAY (station06) ===
  placeStationPart(
    STATION_GLB_PATHS.antenna,
    'stationAntenna',
    new Vector3(0, 10, 0),
    Vector3.Zero(),
    new Vector3(2.5, 2.5, 2.5)
  );

  // === DROP BAY OPENING (VFX, kept as MeshBuilder) ===
  const bayOpening = MeshBuilder.CreatePlane(
    'bayOpening',
    { width: 4, height: 4 },
    scene
  );
  const bayOpeningMat = new StandardMaterial('bayOpeningMat', scene);
  bayOpeningMat.emissiveColor = new Color3(1.0, 0.6, 0.2);
  bayOpeningMat.alpha = 0.6;
  bayOpeningMat.disableLighting = true;
  bayOpening.material = bayOpeningMat;
  bayOpening.position.y = -12;
  bayOpening.rotation.x = Math.PI / 2;
  bayOpening.parent = root;

  // === RUNNING LIGHTS (VFX - kept as MeshBuilder spheres) ===
  const lightMat = new StandardMaterial('stationLightMat', scene);
  lightMat.emissiveColor = new Color3(0.2, 0.8, 1.0);
  lightMat.disableLighting = true;

  const warningLightMat = new StandardMaterial('stationWarningMat', scene);
  warningLightMat.emissiveColor = new Color3(1.0, 0.3, 0.1);
  warningLightMat.disableLighting = true;

  for (let i = 0; i < LIGHT_POSITIONS.length; i++) {
    const light = MeshBuilder.CreateSphere(
      `stationLight_${i}`,
      { diameter: 0.5, segments: 8 },
      scene
    );
    light.material = LIGHT_POSITIONS[i].type === 'nav' ? lightMat : warningLightMat;
    light.position = LIGHT_POSITIONS[i].pos.clone();
    light.parent = root;
    lights.push(light);
  }

  return { root, glbNodes, lights };
}

/**
 * Updates the Anchor Station position and rotation during freefall.
 * The station slowly rotates and recedes into the distance as the player falls.
 * Includes warning light blinking and gentle hull creaking.
 */
export function updateAnchorStation(
  station: AnchorStationNodes | null,
  deltaTime: number,
  altitude: number,
  positionX: number,
  positionZ: number,
  phase: string
): void {
  if (!station) return;

  // Station is only visible during freefall phases
  if (
    phase !== 'freefall_start' &&
    phase !== 'freefall_belt' &&
    phase !== 'freefall_clear'
  ) {
    station.root.setEnabled(false);
    return;
  }

  station.root.setEnabled(true);

  // Slowly rotate the station
  station.root.rotation.y += deltaTime * 0.1;

  // Station recedes as player falls - exponential distance increase
  const altitudeFactor = Math.max(0, (altitude - 600) / 400);
  const distance = STATION_INITIAL_DISTANCE + (1 - altitudeFactor) * 150;
  station.root.position.y = distance;

  // Scale down as it gets further (perspective effect)
  const scale = Math.max(0.3, altitudeFactor);
  station.root.scaling.setAll(scale);

  // Animate running lights with blinking effect
  const time = performance.now() * 0.001;
  for (let i = 0; i < station.lights.length; i++) {
    const light = station.lights[i];
    if (light.material) {
      const mat = light.material as StandardMaterial;
      const baseLightIntensity = Math.max(0.2, altitudeFactor);

      // Warning lights blink faster
      if (light.name.includes('warning') || i >= 4) {
        const blink = Math.sin(time * 4 + i * 0.5) > 0 ? 1.0 : 0.3;
        mat.alpha = baseLightIntensity * blink;
      } else {
        // Nav lights pulse slowly
        const pulse = 0.7 + Math.sin(time * 1.5 + i * 0.3) * 0.3;
        mat.alpha = baseLightIntensity * pulse;
      }
    }
  }

  // Add slight drift to simulate relative motion
  station.root.position.x = -positionX * 0.02;
  station.root.position.z = -positionZ * 0.02;

  // Subtle wobble to simulate station's own movement
  station.root.rotation.x = Math.sin(time * 0.3) * 0.02;
  station.root.rotation.z = Math.cos(time * 0.25) * 0.015;
}

/**
 * Disposes all station nodes.
 */
export function disposeAnchorStation(station: AnchorStationNodes | null): void {
  if (!station) return;

  for (const node of station.glbNodes) {
    node.dispose(false, true);
  }
  station.glbNodes.length = 0;

  for (const light of station.lights) {
    light.dispose();
  }
  station.lights.length = 0;

  station.root.dispose();
}
