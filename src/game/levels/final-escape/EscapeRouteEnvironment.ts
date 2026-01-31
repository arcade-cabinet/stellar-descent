/**
 * EscapeRouteEnvironment - GLB-based linear escape route for Final Escape (Chapter 10)
 *
 * Replaces procedural tunnel/shuttle geometry with placed GLB assets from the
 * asset manifest. Builds a 3000m linear escape route in four sequential sections
 * that the player drives through at high speed:
 *
 * SECTION A: COLLAPSING TUNNELS (z: 0 to -500)
 *   Station beams and modular walls collapsing. Metal fences as barriers to dodge.
 *   Ladder pieces as debris scattered on the floor.
 *
 * SECTION B: SURFACE RUN (z: -500 to -1500)
 *   Crashed spaceships (Bob, Pancake, Spitfire, Zenith) as massive wreckage
 *   obstacles. Station external (station05b) as giant collapsing station.
 *   Detail arrows as directional markers along the escape route.
 *
 * SECTION C: LAVA CANYON (z: -1500 to -2500)
 *   Metal fences as collapsing bridges. Teleporter models as alien tech scattered
 *   around. Modular laser/statue as destroyed equipment.
 *
 * SECTION D: LAUNCH PAD (z: -2500 to -3000)
 *   Final platform with escape shuttle. Detail_basic models as landing markers.
 *
 * Uses AssetManager.loadAssetByPath / createInstanceByPath for all GLB placement,
 * following the same pattern as ModularBaseBuilder.
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

const log = getLogger('EscapeRouteEnvironment');

// GLB path for the escape shuttle (replaces procedural box geometry)
const SHUTTLE_GLB_PATH = '/models/spaceships/Challenger.glb';

// ============================================================================
// TYPES
// ============================================================================

export interface EscapeRouteResult {
  /** Root transform node for the entire escape route */
  root: TransformNode;
  /** All placed GLB instance nodes (for disposal) */
  instances: TransformNode[];
  /** Procedural meshes created for fill/decoration */
  proceduralMeshes: Mesh[];
  /** Lights placed in the environment */
  lights: PointLight[];
  /** Shuttle transform node (for launch animation) */
  shuttle: TransformNode | null;
  /** Launch pad mesh */
  launchPad: Mesh | null;
  /** Shuttle beacon mesh */
  shuttleBeacon: Mesh | null;
  /** Shuttle engine lights */
  shuttleEngines: PointLight[];
  /** Shuttle navigation light */
  shuttleLight: PointLight | null;
  /** Dispose all resources */
  dispose: () => void;
}

/** A single asset placement in the escape route */
interface Placement {
  path: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  name: string;
}

// ============================================================================
// ASSET PATHS (from final-escape manifest)
// ============================================================================

const ASSETS = {
  // Environment modular
  columnB: '/models/environment/modular/Column_B.glb',
  detailA: '/models/environment/modular/Detail_A.glb',
  detailB: '/models/environment/modular/Detail_B.glb',

  // Quaternius modular props
  laser: '/models/environment/modular/Props_Laser.glb',
  statue: '/models/environment/modular/Props_Statue.glb',
  teleporter1: '/models/environment/modular/Props_Teleporter_1.glb',
  teleporter2: '/models/environment/modular/Props_Teleporter_2.glb',
  detailArrow: '/models/environment/modular/Details_Arrow.glb',
  detailArrow2: '/models/environment/modular/Details_Arrow_2.glb',
  detailBasic1: '/models/environment/modular/Details_Basic_1.glb',
  detailBasic2: '/models/environment/modular/Details_Basic_2.glb',
  detailBasic3: '/models/environment/modular/Details_Basic_3.glb',
  detailBasic4: '/models/environment/modular/Details_Basic_4.glb',

  // Metal fences
  metalFence2: '/models/props/modular/metal_fence_hr_2.glb',
  metalFence2Tall: '/models/props/modular/metal_fence_hr_2_tall.glb',
  ladder: '/models/props/modular/ladder_hr_1_long.glb',

  // Spaceships (crashed wreckage)
  wreckBob: '/models/spaceships/Bob.glb',
  wreckPancake: '/models/spaceships/Pancake.glb',
  wreckSpitfire: '/models/spaceships/Spitfire.glb',
  wreckZenith: '/models/spaceships/Zenith.glb',

  // Station external
  station05b: '/models/environment/station-external/station05.glb',

  // Additional modular pieces for tunnel walls
  column1: '/models/environment/modular/Column_1.glb',
  column2: '/models/environment/modular/Column_2.glb',
  column3: '/models/environment/modular/Column_3.glb',
  columnSlim: '/models/environment/modular/Column_Slim.glb',
  pipes: '/models/environment/modular/Pipes.glb',
  doorDouble: '/models/environment/modular/Door_Double.glb',
  floorTile: '/models/environment/modular/FloorTile_Basic.glb',
  floorTile2: '/models/environment/modular/FloorTile_Basic2.glb',
  wallSideA: '/models/environment/modular/DoorDouble_Wall_SideA.glb',
  wallSideB: '/models/environment/modular/DoorDouble_Wall_SideB.glb',
  crate: '/models/environment/modular/Props_Crate.glb',
  crateLong: '/models/environment/modular/Props_CrateLong.glb',
  container: '/models/environment/modular/Props_ContainerFull.glb',

  // Shuttle GLB (replaces procedural box/cylinder geometry)
  shuttle: SHUTTLE_GLB_PATH,

  // Station environment GLBs (replacing procedural floor/wall/platform geometry)
  floorHr1: '/models/environment/station/floor_ceiling_hr_1.glb',
  floorHr3: '/models/environment/station/floor_ceiling_hr_3.glb',
  floorRtx1: '/models/environment/station/floor_ceiling_rtx_1.glb',
  platformBx1: '/models/environment/station/platform_bx_1.glb',
  platformBx2: '/models/environment/station/platform_bx_2.glb',
  platformLarge: '/models/environment/station/platform_large_mx_1.glb',
  asphalt1: '/models/environment/station/asphalt_hr_1.glb',
  asphalt2: '/models/environment/station/asphalt_hr_2.glb',
  asphaltLarge: '/models/environment/station/asphalt_hr_1_large.glb',
  wallHr1: '/models/environment/station/wall_hr_1.glb',
  wallHr15: '/models/environment/station/wall_hr_15.glb',
  wallRg1: '/models/environment/station/wall_rg_1.glb',
} as const;

// ============================================================================
// SECTION BOUNDARIES
// ============================================================================

/** Section boundaries along the Z axis (player moves in -Z direction) */
export const ESCAPE_SECTIONS = {
  /** Section A: Collapsing Tunnels */
  tunnelStart: 0,
  tunnelEnd: -500,
  /** Section B: Surface Run */
  surfaceStart: -500,
  surfaceEnd: -1500,
  /** Section C: Lava Canyon */
  canyonStart: -1500,
  canyonEnd: -2500,
  /** Section D: Launch Pad */
  launchStart: -2500,
  launchEnd: -3000,
  /** Shuttle position */
  shuttleZ: -2900,
} as const;

// ============================================================================
// SEEDED RANDOM
// ============================================================================

function seededRandom(seed: number): () => number {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ============================================================================
// BUILDER
// ============================================================================

/**
 * Build the entire escape route environment from GLB assets.
 *
 * Assets must be preloaded via AssetManager.preloadLevel('final_escape')
 * before calling this function. Missing assets are skipped with a warning.
 */
export async function buildEscapeRouteEnvironment(
  scene: Scene
): Promise<EscapeRouteResult> {
  log.info('Building escape route environment...');

  const root = new TransformNode('EscapeRouteRoot', scene);
  const instances: TransformNode[] = [];
  const proceduralMeshes: Mesh[] = [];
  const lights: PointLight[] = [];
  const rng = seededRandom(42424);

  // ------------------------------------------------------------------
  // 1. Preload all unique asset paths
  // ------------------------------------------------------------------
  const uniquePaths = new Set(Object.values(ASSETS));
  const loadPromises = [...uniquePaths].map((path) =>
    AssetManager.loadAssetByPath(path, scene).catch((err) => {
      log.warn(`Failed to load ${path}:`, err);
      return null;
    })
  );
  await Promise.all(loadPromises);
  log.info(`Preloaded ${uniquePaths.size} unique assets`);

  // ------------------------------------------------------------------
  // Helper: place a single GLB instance
  // ------------------------------------------------------------------
  let instanceCounter = 0;
  function placeAsset(
    path: string,
    position: Vector3,
    rotation: Vector3 = Vector3.Zero(),
    scale: Vector3 = Vector3.One(),
    name?: string
  ): TransformNode | null {
    const instanceName = name ?? `esc_inst_${instanceCounter++}`;
    const node = AssetManager.createInstanceByPath(path, instanceName, scene, true, 'environment');
    if (!node) {
      // Silently skip - asset may not have loaded
      return null;
    }
    node.position = position.clone();
    node.rotation = rotation.clone();
    node.scaling = scale.clone();
    node.parent = root;
    instances.push(node);
    return node;
  }

  // ------------------------------------------------------------------
  // 2. SECTION A: COLLAPSING TUNNELS (z: 0 to -500)
  // ------------------------------------------------------------------
  buildSectionA(placeAsset, proceduralMeshes, lights, scene, root, rng);

  // ------------------------------------------------------------------
  // 3. SECTION B: SURFACE RUN (z: -500 to -1500)
  // ------------------------------------------------------------------
  buildSectionB(placeAsset, proceduralMeshes, lights, scene, root, rng);

  // ------------------------------------------------------------------
  // 4. SECTION C: LAVA CANYON (z: -1500 to -2500)
  // ------------------------------------------------------------------
  buildSectionC(placeAsset, proceduralMeshes, lights, scene, root, rng);

  // ------------------------------------------------------------------
  // 5. SECTION D: LAUNCH PAD (z: -2500 to -3000)
  // ------------------------------------------------------------------
  const launchResult = buildSectionD(placeAsset, proceduralMeshes, lights, scene, root, rng);

  log.info(
    `Built escape route: ${instances.length} GLB instances, ` +
      `${proceduralMeshes.length} procedural meshes, ${lights.length} lights`
  );

  // ------------------------------------------------------------------
  // Dispose function
  // ------------------------------------------------------------------
  function dispose(): void {
    for (const inst of instances) {
      inst.dispose();
    }
    for (const mesh of proceduralMeshes) {
      mesh.dispose();
    }
    for (const light of lights) {
      light.dispose();
    }
    launchResult.shuttle?.dispose();
    launchResult.launchPad?.dispose();
    launchResult.shuttleBeacon?.dispose();
    for (const eng of launchResult.shuttleEngines) {
      eng.dispose();
    }
    launchResult.shuttleLight?.dispose();
    root.dispose();
  }

  return {
    root,
    instances,
    proceduralMeshes,
    lights,
    shuttle: launchResult.shuttle,
    launchPad: launchResult.launchPad,
    shuttleBeacon: launchResult.shuttleBeacon,
    shuttleEngines: launchResult.shuttleEngines,
    shuttleLight: launchResult.shuttleLight,
    dispose,
  };
}

// ============================================================================
// SECTION A: COLLAPSING TUNNELS (z: 0 to -500)
// ============================================================================
// Station beams and modular walls forming a collapsing corridor. Metal fences
// as barriers the player must dodge. Ladder pieces as floor debris.

function buildSectionA(
  placeAsset: (
    path: string,
    position: Vector3,
    rotation?: Vector3,
    scale?: Vector3,
    name?: string
  ) => TransformNode | null,
  proceduralMeshes: Mesh[],
  lights: PointLight[],
  scene: Scene,
  root: TransformNode,
  rng: () => number
): void {
  const tunnelLength = 500;
  const segmentSpacing = 10;
  const numSegments = tunnelLength / segmentSpacing;
  const tunnelHalfWidth = 8;

  // Tunnel floor strips - use GLB floor tiles instead of procedural boxes
  // Alternate between floor tile variants for visual variety
  const floorPaths = [ASSETS.floorHr1, ASSETS.floorHr3, ASSETS.floorRtx1];
  for (let i = 0; i < numSegments; i++) {
    const z = -i * segmentSpacing;
    const floorPath = floorPaths[i % floorPaths.length];
    // Scale to fit tunnel width (~16m wide, 10m deep per segment)
    placeAsset(
      floorPath,
      new Vector3(0, -0.2, z),
      new Vector3(0, 0, 0),
      new Vector3(2.5, 1, 1.5),
      `tunnel_floor_${i}`
    );
  }

  // Column pairs along both sides of the tunnel
  const columnPaths = [ASSETS.column1, ASSETS.column2, ASSETS.column3, ASSETS.columnSlim, ASSETS.columnB];
  for (let i = 0; i < numSegments; i++) {
    const z = -i * segmentSpacing;
    const colPath = columnPaths[i % columnPaths.length];
    const colScale = new Vector3(2, 2.5, 2);

    // Left column
    placeAsset(
      colPath,
      new Vector3(-tunnelHalfWidth - 1, 0, z),
      new Vector3(0, rng() * 0.2, 0),
      colScale,
      `tunnel_col_L_${i}`
    );

    // Right column
    placeAsset(
      colPath,
      new Vector3(tunnelHalfWidth + 1, 0, z),
      new Vector3(0, Math.PI + rng() * 0.2, 0),
      colScale,
      `tunnel_col_R_${i}`
    );
  }

  // Ceiling structure: use wall pieces as overhead beams
  for (let i = 0; i < numSegments; i += 2) {
    const z = -i * segmentSpacing;
    placeAsset(
      ASSETS.wallSideA,
      new Vector3(0, 6, z),
      new Vector3(Math.PI / 2, 0, 0),
      new Vector3(2, 2, 2),
      `tunnel_ceiling_${i}`
    );
  }

  // Metal fence barriers to dodge - placed at random intervals
  const fencePositions = [
    { z: -40, x: -4 },
    { z: -80, x: 3 },
    { z: -130, x: -2 },
    { z: -170, x: 5 },
    { z: -220, x: -5 },
    { z: -260, x: 2 },
    { z: -310, x: -3 },
    { z: -350, x: 4 },
    { z: -390, x: -4 },
    { z: -440, x: 3 },
    { z: -470, x: -1 },
  ];
  for (let i = 0; i < fencePositions.length; i++) {
    const fp = fencePositions[i];
    const fencePath = i % 2 === 0 ? ASSETS.metalFence2 : ASSETS.metalFence2Tall;
    placeAsset(
      fencePath,
      new Vector3(fp.x, 0, fp.z),
      new Vector3(0, rng() * Math.PI, (rng() - 0.5) * 0.3),
      new Vector3(1.5, 1.5, 1.5),
      `tunnel_fence_${i}`
    );
  }

  // Ladder debris on the floor
  for (let i = 0; i < 12; i++) {
    const z = -30 - rng() * 460;
    const x = (rng() - 0.5) * tunnelHalfWidth * 1.4;
    placeAsset(
      ASSETS.ladder,
      new Vector3(x, 0.1, z),
      new Vector3((rng() - 0.5) * 0.4, rng() * Math.PI * 2, (rng() - 0.5) * 0.8),
      new Vector3(0.8, 0.8, 0.8),
      `tunnel_ladder_${i}`
    );
  }

  // Crates and containers as debris blocking partial routes
  for (let i = 0; i < 8; i++) {
    const z = -50 - rng() * 400;
    const x = (rng() - 0.5) * tunnelHalfWidth * 1.2;
    const cratePath = rng() > 0.5 ? ASSETS.crate : ASSETS.crateLong;
    placeAsset(
      cratePath,
      new Vector3(x, 0.3, z),
      new Vector3((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.5),
      new Vector3(1.5, 1.5, 1.5),
      `tunnel_crate_${i}`
    );
  }

  // Pipe decorations along ceiling
  for (let i = 0; i < 8; i++) {
    const z = -20 - i * 60;
    const side = i % 2 === 0 ? -1 : 1;
    placeAsset(
      ASSETS.pipes,
      new Vector3(side * (tunnelHalfWidth - 1), 5, z),
      new Vector3(0, 0, Math.PI / 2),
      new Vector3(1.5, 1.5, 1.5),
      `tunnel_pipes_${i}`
    );
  }

  // Tunnel lights (amber emergency lighting)
  for (let i = 0; i < numSegments; i += 3) {
    const z = -i * segmentSpacing;
    const light = new PointLight(`tunnel_light_${i}`, new Vector3(0, 5, z), scene);
    light.parent = root;
    light.diffuse = new Color3(1, 0.5, 0.2);
    light.intensity = 2.0;
    light.range = segmentSpacing * 2;
    lights.push(light);
  }

  // Collapse wall glow at tunnel entrance (chasing the player)
  const collapseLight = new PointLight(
    'tunnel_collapse_glow',
    new Vector3(0, 3, 10),
    scene
  );
  collapseLight.parent = root;
  collapseLight.diffuse = new Color3(1, 0.3, 0.05);
  collapseLight.intensity = 10;
  collapseLight.range = 30;
  lights.push(collapseLight);
}

// ============================================================================
// SECTION B: SURFACE RUN (z: -500 to -1500)
// ============================================================================
// Crashed spaceships as massive wreckage obstacles to dodge. Station external
// as giant collapsing station. Detail arrows as directional markers.

function buildSectionB(
  placeAsset: (
    path: string,
    position: Vector3,
    rotation?: Vector3,
    scale?: Vector3,
    name?: string
  ) => TransformNode | null,
  proceduralMeshes: Mesh[],
  lights: PointLight[],
  scene: Scene,
  root: TransformNode,
  rng: () => number
): void {
  // ------- Crashed spaceship wreckage (massive obstacles) -------
  // Bob - first wreckage, off to the left, tilted as if it plowed into the ground
  placeAsset(
    ASSETS.wreckBob,
    new Vector3(-15, -2, -600),
    new Vector3(0.3, 0.5, -0.2),
    new Vector3(4, 4, 4),
    'wreck_bob'
  );

  // Pancake - center-right, blocking the direct path
  placeAsset(
    ASSETS.wreckPancake,
    new Vector3(10, -1, -780),
    new Vector3(-0.15, 1.2, 0.25),
    new Vector3(5, 5, 5),
    'wreck_pancake'
  );

  // Spitfire - far left, nose-down into the dirt
  placeAsset(
    ASSETS.wreckSpitfire,
    new Vector3(-20, 3, -1000),
    new Vector3(0.6, -0.4, 0.1),
    new Vector3(3.5, 3.5, 3.5),
    'wreck_spitfire'
  );

  // Zenith - center, partially buried, massive obstacle to dodge around
  placeAsset(
    ASSETS.wreckZenith,
    new Vector3(5, -3, -1200),
    new Vector3(-0.2, 2.0, 0.35),
    new Vector3(6, 6, 6),
    'wreck_zenith'
  );

  // ------- Station external - giant collapsing station -------
  // station05b placed off to the right, towering over the escape route
  placeAsset(
    ASSETS.station05b,
    new Vector3(40, -5, -900),
    new Vector3(0.15, -0.3, 0.1),
    new Vector3(3, 3, 3),
    'station_collapse'
  );

  // Second station piece on the left, further along
  placeAsset(
    ASSETS.station05b,
    new Vector3(-35, -8, -1300),
    new Vector3(-0.1, 1.5, -0.15),
    new Vector3(2.5, 2.5, 2.5),
    'station_collapse_2'
  );

  // ------- Directional arrow markers along the route -------
  for (let i = 0; i < 20; i++) {
    const z = -520 - i * 50;
    const side = i % 2 === 0 ? -1 : 1;
    const arrowPath = i % 3 === 0 ? ASSETS.detailArrow2 : ASSETS.detailArrow;
    placeAsset(
      arrowPath,
      new Vector3(side * 12, 0.3, z),
      new Vector3(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0),
      new Vector3(3, 3, 3),
      `surface_arrow_${i}`
    );
  }

  // ------- Detail decorations scattered in the field -------
  const detailPaths = [ASSETS.detailA, ASSETS.detailB];
  for (let i = 0; i < 20; i++) {
    const z = -530 - rng() * 950;
    const x = (rng() - 0.5) * 50;
    placeAsset(
      detailPaths[i % detailPaths.length],
      new Vector3(x, 0, z),
      new Vector3(0, rng() * Math.PI * 2, 0),
      new Vector3(1.5, 1.5, 1.5),
      `surface_detail_${i}`
    );
  }

  // ------- Metal fences as perimeter wreckage -------
  for (let i = 0; i < 16; i++) {
    const z = -520 - i * 60;
    const side = i % 2 === 0 ? 1 : -1;
    const fencePath = i % 3 === 0 ? ASSETS.metalFence2Tall : ASSETS.metalFence2;
    placeAsset(
      fencePath,
      new Vector3(side * (18 + rng() * 8), 0, z),
      new Vector3(
        (rng() - 0.5) * 0.4,
        rng() * Math.PI,
        (rng() - 0.5) * 0.6
      ),
      new Vector3(2, 2, 2),
      `surface_fence_${i}`
    );
  }

  // ------- Wreckage fire lights near crashed ships -------
  const fireLightPositions = [
    new Vector3(-15, 3, -600),
    new Vector3(10, 3, -780),
    new Vector3(-20, 5, -1000),
    new Vector3(5, 3, -1200),
    new Vector3(40, 10, -900),
  ];
  for (let i = 0; i < fireLightPositions.length; i++) {
    const light = new PointLight(`surface_fire_${i}`, fireLightPositions[i], scene);
    light.parent = root;
    light.diffuse = new Color3(1, 0.5, 0.15);
    light.intensity = 6 + rng() * 4;
    light.range = 25 + rng() * 15;
    lights.push(light);
  }
}

// ============================================================================
// SECTION C: LAVA CANYON (z: -1500 to -2500)
// ============================================================================
// Metal fences as collapsing bridges. Teleporter models as alien tech.
// Modular laser/statue as destroyed equipment.

function buildSectionC(
  placeAsset: (
    path: string,
    position: Vector3,
    rotation?: Vector3,
    scale?: Vector3,
    name?: string
  ) => TransformNode | null,
  proceduralMeshes: Mesh[],
  lights: PointLight[],
  scene: Scene,
  root: TransformNode,
  rng: () => number
): void {
  // ------- Bridge segments from metal fences -------
  // Create a canyon feel with fence-bridges spanning gaps
  // Width increased to allow vehicle maneuvering (minimum 16m for safe passage)
  const bridgePositions = [
    { z: -1550, width: 18 },
    { z: -1700, width: 16 },
    { z: -1850, width: 20 },
    { z: -2000, width: 16 },
    { z: -2150, width: 18 },
    { z: -2300, width: 16 },
    { z: -2420, width: 20 },
  ];

  for (let i = 0; i < bridgePositions.length; i++) {
    const bp = bridgePositions[i];
    // Bridge surface - use GLB platform assets instead of procedural boxes
    const platformPaths = [ASSETS.platformBx1, ASSETS.platformBx2];
    const platformPath = platformPaths[i % platformPaths.length];
    // Scale platform to fit bridge dimensions (~12-14m wide, 15m deep)
    const scaleX = bp.width / 5; // Normalize to platform base size
    placeAsset(
      platformPath,
      new Vector3(0, -0.25, bp.z),
      new Vector3(0, 0, 0),
      new Vector3(scaleX, 1, 2.5),
      `canyon_bridge_${i}`
    );

    // Metal fence railings on each side of the bridge
    placeAsset(
      ASSETS.metalFence2Tall,
      new Vector3(-bp.width / 2 - 0.5, 0, bp.z),
      new Vector3(0, Math.PI / 2, 0),
      new Vector3(2, 2, 2),
      `canyon_railing_L_${i}`
    );
    placeAsset(
      ASSETS.metalFence2Tall,
      new Vector3(bp.width / 2 + 0.5, 0, bp.z),
      new Vector3(0, -Math.PI / 2, 0),
      new Vector3(2, 2, 2),
      `canyon_railing_R_${i}`
    );
  }

  // ------- Canyon walls - use GLB wall assets instead of procedural boxes -------
  const canyonLength = 1000;
  const wallSegments = 20;
  const wallSpacing = canyonLength / wallSegments;
  const wallPaths = [ASSETS.wallHr1, ASSETS.wallHr15, ASSETS.wallRg1];
  for (let i = 0; i < wallSegments; i++) {
    const z = -1500 - i * wallSpacing;
    // Vary wall scale for height variation (2.5-4x base height)
    const wallScaleY = 2.5 + rng() * 1.5;

    for (const side of [-1, 1]) {
      const xOffset = side * (20 + rng() * 5);
      const wallPath = wallPaths[i % wallPaths.length];
      placeAsset(
        wallPath,
        new Vector3(xOffset, 0, z),
        new Vector3(0, side > 0 ? Math.PI : 0, 0),
        new Vector3(2, wallScaleY, (wallSpacing + 2) / 8),
        `canyon_wall_${side > 0 ? 'R' : 'L'}_${i}`
      );
    }
  }

  // ------- Teleporter models as alien tech scattered in canyon -------
  const teleporterPlacements = [
    { path: ASSETS.teleporter1, pos: new Vector3(-8, 0, -1600) },
    { path: ASSETS.teleporter2, pos: new Vector3(12, 0, -1750) },
    { path: ASSETS.teleporter1, pos: new Vector3(-10, 0, -1920) },
    { path: ASSETS.teleporter2, pos: new Vector3(7, 0, -2080) },
    { path: ASSETS.teleporter1, pos: new Vector3(-6, 0, -2220) },
    { path: ASSETS.teleporter2, pos: new Vector3(14, 0, -2380) },
  ];
  for (let i = 0; i < teleporterPlacements.length; i++) {
    const tp = teleporterPlacements[i];
    placeAsset(
      tp.path,
      tp.pos,
      new Vector3(0, rng() * Math.PI * 2, 0),
      new Vector3(3, 3, 3),
      `canyon_teleporter_${i}`
    );
  }

  // ------- Destroyed equipment: laser and statue models -------
  const equipPlacements = [
    { path: ASSETS.laser, pos: new Vector3(5, 0, -1580), rot: 0.3 },
    { path: ASSETS.statue, pos: new Vector3(-12, 0, -1680), rot: 1.2 },
    { path: ASSETS.laser, pos: new Vector3(8, 1, -1880), rot: 2.5 },
    { path: ASSETS.statue, pos: new Vector3(-5, 0, -2050), rot: 0.8 },
    { path: ASSETS.laser, pos: new Vector3(10, 0, -2250), rot: 4.1 },
    { path: ASSETS.statue, pos: new Vector3(-8, 0, -2400), rot: 3.0 },
  ];
  for (let i = 0; i < equipPlacements.length; i++) {
    const ep = equipPlacements[i];
    placeAsset(
      ep.path,
      ep.pos,
      new Vector3((rng() - 0.5) * 0.5, ep.rot, (rng() - 0.5) * 0.4),
      new Vector3(2.5, 2.5, 2.5),
      `canyon_equip_${i}`
    );
  }

  // ------- Lava glow lights in the canyon depths -------
  for (let i = 0; i < 15; i++) {
    const z = -1520 - i * 65;
    const x = (rng() - 0.5) * 30;
    const light = new PointLight(`lava_glow_${i}`, new Vector3(x, -3, z), scene);
    light.parent = root;
    light.diffuse = new Color3(1, 0.35, 0.05);
    light.intensity = 4 + rng() * 4;
    light.range = 20 + rng() * 10;
    lights.push(light);
  }

  // ------- Ambient fill lights for canyon navigation -------
  // Ensure the canyon is visible enough for driving
  for (let i = 0; i < 10; i++) {
    const z = -1550 - i * 100;
    const ambientLight = new PointLight(`canyon_ambient_${i}`, new Vector3(0, 12, z), scene);
    ambientLight.parent = root;
    ambientLight.diffuse = new Color3(0.8, 0.5, 0.3); // Warm ambient
    ambientLight.intensity = 2;
    ambientLight.range = 60;
    lights.push(ambientLight);
  }

  // ------- Scattered debris: detail pieces -------
  for (let i = 0; i < 15; i++) {
    const z = -1520 - rng() * 960;
    const x = (rng() - 0.5) * 25;
    const paths = [ASSETS.detailA, ASSETS.detailB, ASSETS.detailBasic1, ASSETS.detailBasic2];
    placeAsset(
      paths[Math.floor(rng() * paths.length)],
      new Vector3(x, 0, z),
      new Vector3(0, rng() * Math.PI * 2, 0),
      new Vector3(1.5, 1.5, 1.5),
      `canyon_debris_${i}`
    );
  }

  // ------- Containers and crates fallen into canyon -------
  for (let i = 0; i < 6; i++) {
    const z = -1550 - rng() * 900;
    const x = (rng() - 0.5) * 18;
    const cratePath = rng() > 0.5 ? ASSETS.container : ASSETS.crate;
    placeAsset(
      cratePath,
      new Vector3(x, 0.2, z),
      new Vector3((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.8),
      new Vector3(2, 2, 2),
      `canyon_crate_${i}`
    );
  }
}

// ============================================================================
// SECTION D: LAUNCH PAD (z: -2500 to -3000)
// ============================================================================
// Final platform with escape shuttle. Detail_basic models as landing markers.

interface LaunchPadResult {
  shuttle: TransformNode | null;
  launchPad: Mesh | null;
  shuttleBeacon: Mesh | null;
  shuttleEngines: PointLight[];
  shuttleLight: PointLight | null;
}

function buildSectionD(
  placeAsset: (
    path: string,
    position: Vector3,
    rotation?: Vector3,
    scale?: Vector3,
    name?: string
  ) => TransformNode | null,
  proceduralMeshes: Mesh[],
  lights: PointLight[],
  scene: Scene,
  root: TransformNode,
  rng: () => number
): LaunchPadResult {
  const shuttleZ = ESCAPE_SECTIONS.shuttleZ;

  // ------- Approach road - use GLB asphalt assets instead of procedural boxes -------
  const roadPaths = [ASSETS.asphalt1, ASSETS.asphalt2, ASSETS.asphaltLarge];
  for (let i = 0; i < 10; i++) {
    const z = -2500 - i * 50;
    const roadPath = roadPaths[i % roadPaths.length];
    // Scale asphalt tiles to fit road dimensions (~30m wide, 50m deep)
    placeAsset(
      roadPath,
      new Vector3(0, -0.25, z),
      new Vector3(0, 0, 0),
      new Vector3(3, 1, 5),
      `launch_road_${i}`
    );
  }

  // ------- Landing marker details along the approach -------
  const markerPaths = [
    ASSETS.detailBasic1,
    ASSETS.detailBasic2,
    ASSETS.detailBasic3,
    ASSETS.detailBasic4,
  ];
  for (let i = 0; i < 16; i++) {
    const z = -2520 - i * 25;
    const side = i % 2 === 0 ? -1 : 1;
    placeAsset(
      markerPaths[i % markerPaths.length],
      new Vector3(side * 12, 0.2, z),
      new Vector3(0, 0, 0),
      new Vector3(4, 4, 4),
      `launch_marker_${i}`
    );
  }

  // ------- Directional arrows pointing toward shuttle -------
  for (let i = 0; i < 8; i++) {
    const z = -2530 - i * 45;
    placeAsset(
      ASSETS.detailArrow,
      new Vector3(0, 0.2, z),
      new Vector3(0, Math.PI, 0),
      new Vector3(5, 5, 5),
      `launch_arrow_${i}`
    );
  }

  // ------- Launch pad platform - use GLB platform asset -------
  // Place a large platform GLB as the landing pad (scaled to ~40m x 40m)
  const launchPadNode = placeAsset(
    ASSETS.platformLarge,
    new Vector3(0, -0.75, shuttleZ),
    new Vector3(0, 0, 0),
    new Vector3(5, 1.5, 5),
    'launch_pad'
  );

  // Create a procedural launch pad mesh for collision/interaction detection
  // The GLB is purely visual; this mesh is for gameplay
  const launchPad = MeshBuilder.CreateCylinder(
    'launch_pad_collision',
    { diameter: 40, height: 0.5, tessellation: 32 },
    scene
  );
  launchPad.position.set(0, -0.5, shuttleZ);
  launchPad.isVisible = false; // Invisible collision mesh
  launchPad.parent = root;
  proceduralMeshes.push(launchPad);

  // ------- Pad edge markers (detail basics around the perimeter) -------
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const radius = 18;
    const x = Math.cos(angle) * radius;
    const z = shuttleZ + Math.sin(angle) * radius;
    placeAsset(
      markerPaths[i % markerPaths.length],
      new Vector3(x, 0.3, z),
      new Vector3(0, angle + Math.PI / 2, 0),
      new Vector3(3, 3, 3),
      `pad_marker_${i}`
    );
  }

  // ------- Pad perimeter fencing -------
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 22;
    const x = Math.cos(angle) * radius;
    const z = shuttleZ + Math.sin(angle) * radius;
    placeAsset(
      ASSETS.metalFence2,
      new Vector3(x, 0, z),
      new Vector3(0, angle, 0),
      new Vector3(2, 2, 2),
      `pad_fence_${i}`
    );
  }

  // ------- Pad lighting -------
  const padLightPositions = [
    new Vector3(-15, 8, shuttleZ - 15),
    new Vector3(15, 8, shuttleZ - 15),
    new Vector3(-15, 8, shuttleZ + 15),
    new Vector3(15, 8, shuttleZ + 15),
  ];
  for (let i = 0; i < padLightPositions.length; i++) {
    const light = new PointLight(`pad_light_${i}`, padLightPositions[i], scene);
    light.parent = root;
    light.diffuse = new Color3(0.7, 0.85, 1.0);
    light.intensity = 6;
    light.range = 30;
    lights.push(light);
  }

  // ------- Shuttle (GLB model) -------
  const shuttle = new TransformNode('shuttle', scene);
  shuttle.position.set(0, 2, shuttleZ);
  shuttle.parent = root;

  // Place the shuttle GLB model as a child of the shuttle transform node
  const shuttleModel = placeAsset(
    ASSETS.shuttle,
    Vector3.Zero(),
    new Vector3(0, Math.PI, 0),
    new Vector3(4, 4, 4),
    'shuttle_glb'
  );
  if (shuttleModel) {
    // Re-parent under shuttle node instead of root so launch animation moves it
    shuttleModel.parent = shuttle;
    shuttleModel.position.set(0, 3, 0);
  }

  // Engine glow lights
  const shuttleEngines: PointLight[] = [];
  for (let i = -1; i <= 1; i++) {
    const engineLight = new PointLight(
      `shuttle_engine_${i}`,
      new Vector3(i * 2, 1.5, 9),
      scene
    );
    engineLight.parent = shuttle;
    engineLight.diffuse = new Color3(0.5, 0.7, 1.0);
    engineLight.intensity = 0;
    engineLight.range = 15;
    shuttleEngines.push(engineLight);
    lights.push(engineLight);
  }

  // Shuttle navigation spotlight
  const shuttleLight = new PointLight(
    'shuttle_spotlight',
    new Vector3(0, 8, shuttleZ),
    scene
  );
  shuttleLight.parent = root;
  shuttleLight.diffuse = new Color3(0.3, 0.5, 1.0);
  shuttleLight.intensity = 0;
  shuttleLight.range = 60;
  lights.push(shuttleLight);

  // Shuttle beacon (pulsing light marker)
  const shuttleBeacon = MeshBuilder.CreateSphere(
    'shuttle_beacon',
    { diameter: 1, segments: 8 },
    scene
  );
  shuttleBeacon.position.set(0, 12, shuttleZ);
  shuttleBeacon.parent = root;
  const beaconMat = new StandardMaterial('beacon_mat', scene);
  beaconMat.emissiveColor = new Color3(0, 0.5, 1);
  beaconMat.disableLighting = true;
  shuttleBeacon.material = beaconMat;
  proceduralMeshes.push(shuttleBeacon);

  return {
    shuttle,
    launchPad,
    shuttleBeacon,
    shuttleEngines,
    shuttleLight,
  };
}
