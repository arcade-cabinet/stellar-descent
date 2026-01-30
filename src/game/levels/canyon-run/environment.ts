/**
 * Canyon Run Environment - Procedural canyon terrain and obstacle generation
 *
 * Creates a dramatic canyon environment for the vehicle chase sequence:
 * - Terrain floor with height variation
 * - Canyon walls on both sides with irregular surfaces
 * - Rock formations and boulders as obstacles
 * - Dust cloud particle emitters
 * - Alien vegetation clusters
 * - Bridge structures (intact and collapsed)
 * - Lighting through canyon gaps (volumetric sun shafts)
 * - Wrecked vehicle props
 * - Objective waypoint markers
 *
 * The canyon is laid out as a long track along the Z axis:
 *   Z = 0      : Start (player spawns)
 *   Z = -1500  : Bridge crossing (scripted event)
 *   Z = -3000  : Extraction point (level end)
 */

import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

// ============================================================================
// TYPES
// ============================================================================

export interface CanyonEnvironment {
  terrain: Mesh;
  leftWalls: Mesh[];
  rightWalls: Mesh[];
  boulders: Mesh[];
  bridges: BridgeStructure[];
  wrecks: TransformNode[];
  vegetation: Mesh[];
  dustEmitters: TransformNode[];
  objectiveMarkers: ObjectiveMarker[];
  sunLight: DirectionalLight;
  canyonLights: PointLight[];
  extractionZone: Mesh;
}

export interface BridgeStructure {
  mesh: Mesh;
  position: Vector3;
  /** Whether this bridge collapses during gameplay */
  isCollapsible: boolean;
  /** Whether the bridge has already collapsed */
  collapsed: boolean;
  /** Individual deck segments for collapse animation */
  segments: Mesh[];
}

export interface ObjectiveMarker {
  mesh: Mesh;
  beacon: PointLight;
  position: Vector3;
  label: string;
  reached: boolean;
}

export interface TerrainSample {
  height: number;
  isOnBridge: boolean;
  isInWater: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Total canyon length along Z axis */
export const CANYON_LENGTH = 3000;

/** Half-width of the drivable canyon floor */
export const CANYON_HALF_WIDTH = 25;

/** Canyon wall height */
const WALL_HEIGHT = 80;

/** Number of wall segments per side */
const WALL_SEGMENTS = 60;

/** Segment length along Z */
const WALL_SEGMENT_LENGTH = CANYON_LENGTH / WALL_SEGMENTS;

/** Z position of the bridge */
export const BRIDGE_Z = -1500;

/** Z position of the extraction point */
export const EXTRACTION_Z = -2900;

/** Number of boulders to scatter */
const BOULDER_COUNT = 45;

/** Number of wrecked vehicles */
const WRECK_COUNT = 8;

/** Number of vegetation clusters */
const VEGETATION_COUNT = 30;

// Seeded random for deterministic layout
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ============================================================================
// ENVIRONMENT CREATION
// ============================================================================

/**
 * Create the complete canyon environment.
 */
export function createCanyonEnvironment(scene: Scene): CanyonEnvironment {
  const rand = seededRandom(42);

  // Materials
  const materials = createMaterials(scene);

  // Terrain floor
  const terrain = createTerrain(scene, materials);

  // Canyon walls
  const { leftWalls, rightWalls } = createCanyonWalls(scene, materials, rand);

  // Boulders / obstacles
  const boulders = createBoulders(scene, materials, rand);

  // Bridges
  const bridges = createBridges(scene, materials);

  // Wrecked vehicles
  const wrecks = createWrecks(scene, materials, rand);

  // Vegetation
  const vegetation = createVegetation(scene, materials, rand);

  // Dust emitter positions
  const dustEmitters = createDustEmitters(scene, rand);

  // Lighting
  const { sunLight, canyonLights } = createLighting(scene);

  // Objective markers
  const objectiveMarkers = createObjectiveMarkers(scene);

  // Extraction zone
  const extractionZone = createExtractionZone(scene, materials);

  // Sky dome
  createSkyDome(scene);

  return {
    terrain,
    leftWalls,
    rightWalls,
    boulders,
    bridges,
    wrecks,
    vegetation,
    dustEmitters,
    objectiveMarkers,
    sunLight,
    canyonLights,
    extractionZone,
  };
}

// ============================================================================
// MATERIALS
// ============================================================================

interface CanyonMaterials {
  ground: StandardMaterial;
  wall: StandardMaterial;
  boulder: StandardMaterial;
  bridge: StandardMaterial;
  bridgeMetal: StandardMaterial;
  wreck: StandardMaterial;
  vegetation: StandardMaterial;
  beacon: StandardMaterial;
  extraction: StandardMaterial;
}

function createMaterials(scene: Scene): CanyonMaterials {
  const ground = new StandardMaterial('canyon_ground_mat', scene);
  ground.diffuseColor = Color3.FromHexString('#8B7355');
  ground.specularColor = new Color3(0.1, 0.08, 0.05);

  const wall = new StandardMaterial('canyon_wall_mat', scene);
  wall.diffuseColor = Color3.FromHexString('#6B4F3A');
  wall.specularColor = new Color3(0.05, 0.04, 0.03);

  const boulder = new StandardMaterial('canyon_boulder_mat', scene);
  boulder.diffuseColor = Color3.FromHexString('#7A6B5B');
  boulder.specularColor = new Color3(0.08, 0.06, 0.04);

  const bridge = new StandardMaterial('canyon_bridge_mat', scene);
  bridge.diffuseColor = Color3.FromHexString('#5A5A5A');
  bridge.specularColor = new Color3(0.15, 0.15, 0.12);

  const bridgeMetal = new StandardMaterial('canyon_bridge_metal_mat', scene);
  bridgeMetal.diffuseColor = Color3.FromHexString('#4A4A4A');
  bridgeMetal.specularColor = new Color3(0.3, 0.3, 0.25);

  const wreck = new StandardMaterial('canyon_wreck_mat', scene);
  wreck.diffuseColor = Color3.FromHexString('#3A3A3A');
  wreck.specularColor = new Color3(0.1, 0.1, 0.08);

  const vegetation = new StandardMaterial('canyon_veg_mat', scene);
  vegetation.diffuseColor = Color3.FromHexString('#3A5C3A');
  vegetation.specularColor = new Color3(0.05, 0.08, 0.05);
  vegetation.alpha = 0.9;

  const beacon = new StandardMaterial('canyon_beacon_mat', scene);
  beacon.emissiveColor = new Color3(0.2, 0.8, 1.0);
  beacon.disableLighting = true;

  const extraction = new StandardMaterial('canyon_extraction_mat', scene);
  extraction.emissiveColor = new Color3(0.1, 1.0, 0.3);
  extraction.alpha = 0.3;
  extraction.disableLighting = true;

  return {
    ground,
    wall,
    boulder,
    bridge,
    bridgeMetal,
    wreck,
    vegetation,
    beacon,
    extraction,
  };
}

// ============================================================================
// TERRAIN
// ============================================================================

function createTerrain(scene: Scene, materials: CanyonMaterials): Mesh {
  const terrain = MeshBuilder.CreateGround(
    'canyon_terrain',
    {
      width: CANYON_HALF_WIDTH * 2 + 20,
      height: CANYON_LENGTH + 100,
      subdivisions: 128,
    },
    scene
  );
  terrain.material = materials.ground;
  terrain.position.set(0, 0, -CANYON_LENGTH / 2);
  terrain.receiveShadows = true;

  // Apply height variation to vertices
  const positions = terrain.getVerticesData('position');
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      // Gentle rolling + some noise
      positions[i + 1] +=
        Math.sin(x * 0.05) * 0.8 +
        Math.sin(z * 0.03) * 1.2 +
        Math.sin(x * 0.15 + z * 0.1) * 0.3;
    }
    terrain.updateVerticesData('position', positions);
    terrain.createNormals(true);
  }

  return terrain;
}

/**
 * Sample terrain height at a given world position.
 * This is a simplified approximation matching the vertex displacement above.
 */
export function sampleTerrainHeight(x: number, z: number): number {
  // Replicate the same height function used in createTerrain
  const localZ = z + CANYON_LENGTH / 2;
  const localX = x;
  return (
    Math.sin(localX * 0.05) * 0.8 +
    Math.sin(localZ * 0.03) * 1.2 +
    Math.sin(localX * 0.15 + localZ * 0.1) * 0.3
  );
}

// ============================================================================
// CANYON WALLS
// ============================================================================

function createCanyonWalls(
  scene: Scene,
  materials: CanyonMaterials,
  rand: () => number
): { leftWalls: Mesh[]; rightWalls: Mesh[] } {
  const leftWalls: Mesh[] = [];
  const rightWalls: Mesh[] = [];

  for (let i = 0; i < WALL_SEGMENTS; i++) {
    const z = -i * WALL_SEGMENT_LENGTH;

    // Left wall - varies in distance from center
    const leftOffset = CANYON_HALF_WIDTH + rand() * 8;
    const leftWall = MeshBuilder.CreateBox(
      `canyon_wall_left_${i}`,
      {
        width: 15 + rand() * 10,
        height: WALL_HEIGHT + rand() * 30,
        depth: WALL_SEGMENT_LENGTH + 2,
      },
      scene
    );
    leftWall.material = materials.wall;
    leftWall.position.set(-leftOffset - 5, WALL_HEIGHT / 2 - 5, z);
    leftWall.rotation.y = (rand() - 0.5) * 0.1;
    leftWalls.push(leftWall);

    // Right wall
    const rightOffset = CANYON_HALF_WIDTH + rand() * 8;
    const rightWall = MeshBuilder.CreateBox(
      `canyon_wall_right_${i}`,
      {
        width: 15 + rand() * 10,
        height: WALL_HEIGHT + rand() * 30,
        depth: WALL_SEGMENT_LENGTH + 2,
      },
      scene
    );
    rightWall.material = materials.wall;
    rightWall.position.set(rightOffset + 5, WALL_HEIGHT / 2 - 5, z);
    rightWall.rotation.y = (rand() - 0.5) * 0.1;
    rightWalls.push(rightWall);
  }

  return { leftWalls, rightWalls };
}

// ============================================================================
// BOULDERS / OBSTACLES
// ============================================================================

function createBoulders(
  scene: Scene,
  materials: CanyonMaterials,
  rand: () => number
): Mesh[] {
  const boulders: Mesh[] = [];

  for (let i = 0; i < BOULDER_COUNT; i++) {
    const x = (rand() - 0.5) * CANYON_HALF_WIDTH * 1.6;
    const z = -rand() * (CANYON_LENGTH - 200) - 100;
    const size = 1.5 + rand() * 3.5;

    // Skip boulders too close to bridge or extraction
    if (Math.abs(z - BRIDGE_Z) < 60) continue;
    if (Math.abs(z - EXTRACTION_Z) < 50) continue;

    const boulder = MeshBuilder.CreateSphere(
      `canyon_boulder_${i}`,
      { diameter: size, segments: 8 },
      scene
    );
    boulder.material = materials.boulder;
    boulder.position.set(
      x,
      sampleTerrainHeight(x, z) + size * 0.3,
      z
    );
    boulder.scaling.set(
      0.7 + rand() * 0.6,
      0.5 + rand() * 0.5,
      0.7 + rand() * 0.6
    );
    boulder.rotation.set(
      rand() * Math.PI,
      rand() * Math.PI,
      rand() * Math.PI
    );

    boulders.push(boulder);
  }

  return boulders;
}

// ============================================================================
// BRIDGES
// ============================================================================

function createBridges(
  scene: Scene,
  materials: CanyonMaterials
): BridgeStructure[] {
  const bridges: BridgeStructure[] = [];

  // Main bridge (collapsible during gameplay)
  const mainBridge = createSingleBridge(
    scene,
    materials,
    new Vector3(0, 8, BRIDGE_Z),
    true
  );
  bridges.push(mainBridge);

  // A smaller intact bridge earlier in the canyon (non-collapsible)
  const earlyBridge = createSingleBridge(
    scene,
    materials,
    new Vector3(0, 6, -600),
    false
  );
  bridges.push(earlyBridge);

  return bridges;
}

function createSingleBridge(
  scene: Scene,
  materials: CanyonMaterials,
  position: Vector3,
  isCollapsible: boolean
): BridgeStructure {
  const bridgeWidth = CANYON_HALF_WIDTH * 2 + 10;
  const segmentCount = isCollapsible ? 8 : 1;
  const segmentDepth = 8 / segmentCount;
  const segments: Mesh[] = [];

  // Bridge deck - split into segments for collapse animation
  for (let i = 0; i < segmentCount; i++) {
    const segment = MeshBuilder.CreateBox(
      `canyon_bridge_segment_${position.z}_${i}`,
      { width: bridgeWidth, height: 1.5, depth: segmentDepth + 0.1 },
      scene
    );
    segment.material = materials.bridge;
    segment.position.set(
      position.x,
      position.y,
      position.z + (i - segmentCount / 2) * segmentDepth
    );
    segments.push(segment);
  }

  // Support pillars
  const pillarPositions = [
    new Vector3(-bridgeWidth / 2 + 2, position.y / 2, position.z),
    new Vector3(bridgeWidth / 2 - 2, position.y / 2, position.z),
  ];

  for (let p = 0; p < pillarPositions.length; p++) {
    const pillar = MeshBuilder.CreateBox(
      `canyon_bridge_pillar_${position.z}_${p}`,
      { width: 2, height: position.y, depth: 3 },
      scene
    );
    pillar.material = materials.bridgeMetal;
    pillar.position = pillarPositions[p];
  }

  // Railing meshes
  for (const side of [-1, 1]) {
    const railing = MeshBuilder.CreateBox(
      `canyon_bridge_railing_${position.z}_${side}`,
      { width: 0.3, height: 1.5, depth: 10 },
      scene
    );
    railing.material = materials.bridgeMetal;
    railing.position.set(
      position.x + side * (bridgeWidth / 2 - 0.5),
      position.y + 1.0,
      position.z
    );
  }

  // Use the first segment as the representative mesh
  const bridgeMesh = segments[0];

  return {
    mesh: bridgeMesh,
    position: position.clone(),
    isCollapsible,
    collapsed: false,
    segments,
  };
}

// ============================================================================
// WRECKED VEHICLES
// ============================================================================

function createWrecks(
  scene: Scene,
  materials: CanyonMaterials,
  rand: () => number
): TransformNode[] {
  const wrecks: TransformNode[] = [];

  for (let i = 0; i < WRECK_COUNT; i++) {
    const x = (rand() - 0.5) * CANYON_HALF_WIDTH * 1.4;
    const z = -200 - rand() * (CANYON_LENGTH - 500);

    // Skip near bridge or extraction
    if (Math.abs(z - BRIDGE_Z) < 80) continue;
    if (Math.abs(z - EXTRACTION_Z) < 60) continue;

    const wreck = new TransformNode(`canyon_wreck_${i}`, scene);
    wreck.position.set(x, sampleTerrainHeight(x, z), z);
    wreck.rotation.y = rand() * Math.PI * 2;

    // Wreck body (overturned vehicle)
    const body = MeshBuilder.CreateBox(
      `wreck_body_${i}`,
      { width: 2.5 + rand(), height: 1.2, depth: 4.0 + rand() * 2 },
      scene
    );
    body.material = materials.wreck;
    body.parent = wreck;
    body.position.y = 0.6;
    body.rotation.z = (rand() - 0.3) * 0.5;
    body.rotation.x = (rand() - 0.5) * 0.3;

    // Debris around wreck
    for (let d = 0; d < 3; d++) {
      const debris = MeshBuilder.CreateBox(
        `wreck_debris_${i}_${d}`,
        {
          width: 0.3 + rand() * 0.8,
          height: 0.2 + rand() * 0.5,
          depth: 0.3 + rand() * 0.8,
        },
        scene
      );
      debris.material = materials.wreck;
      debris.parent = wreck;
      debris.position.set(
        (rand() - 0.5) * 5,
        rand() * 0.3,
        (rand() - 0.5) * 5
      );
      debris.rotation.set(
        rand() * Math.PI,
        rand() * Math.PI,
        rand() * Math.PI
      );
    }

    wrecks.push(wreck);
  }

  return wrecks;
}

// ============================================================================
// VEGETATION
// ============================================================================

function createVegetation(
  scene: Scene,
  materials: CanyonMaterials,
  rand: () => number
): Mesh[] {
  const vegMeshes: Mesh[] = [];

  for (let i = 0; i < VEGETATION_COUNT; i++) {
    // Vegetation grows at base of canyon walls
    const side = rand() > 0.5 ? 1 : -1;
    const x = side * (CANYON_HALF_WIDTH - 3 + rand() * 6);
    const z = -rand() * CANYON_LENGTH;

    const cluster = MeshBuilder.CreateSphere(
      `canyon_veg_${i}`,
      { diameter: 1.5 + rand() * 2, segments: 6 },
      scene
    );
    cluster.material = materials.vegetation;
    cluster.position.set(
      x,
      sampleTerrainHeight(x, z) + 0.5,
      z
    );
    cluster.scaling.set(
      1 + rand() * 0.5,
      0.5 + rand() * 0.5,
      1 + rand() * 0.5
    );

    vegMeshes.push(cluster);
  }

  return vegMeshes;
}

// ============================================================================
// DUST EMITTERS
// ============================================================================

function createDustEmitters(
  scene: Scene,
  rand: () => number
): TransformNode[] {
  const emitters: TransformNode[] = [];

  // Place dust sources along the canyon
  for (let i = 0; i < 15; i++) {
    const x = (rand() - 0.5) * CANYON_HALF_WIDTH * 1.5;
    const z = -rand() * CANYON_LENGTH;
    const emitter = new TransformNode(`canyon_dust_${i}`, scene);
    emitter.position.set(x, 1, z);
    emitters.push(emitter);
  }

  return emitters;
}

// ============================================================================
// LIGHTING
// ============================================================================

function createLighting(scene: Scene): {
  sunLight: DirectionalLight;
  canyonLights: PointLight[];
} {
  // Sun coming from high angle, casting light through canyon gaps
  const sunLight = new DirectionalLight(
    'canyon_sun',
    new Vector3(0.3, -0.7, -0.4).normalize(),
    scene
  );
  sunLight.intensity = 2.2;
  sunLight.diffuse = Color3.FromHexString('#FFD4A0');

  // Point lights along the canyon for ambient fill in shadowed areas
  const canyonLights: PointLight[] = [];
  for (let i = 0; i < 10; i++) {
    const z = -(i / 10) * CANYON_LENGTH;
    const light = new PointLight(
      `canyon_fill_${i}`,
      new Vector3(0, 15, z),
      scene
    );
    light.intensity = 0.4;
    light.diffuse = Color3.FromHexString('#FFC090');
    light.range = 80;
    canyonLights.push(light);
  }

  return { sunLight, canyonLights };
}

// ============================================================================
// OBJECTIVE MARKERS
// ============================================================================

function createObjectiveMarkers(scene: Scene): ObjectiveMarker[] {
  const markers: ObjectiveMarker[] = [];

  const markerConfigs = [
    { z: -500, label: 'CHECKPOINT ALPHA' },
    { z: -1000, label: 'CHECKPOINT BRAVO' },
    { z: BRIDGE_Z, label: 'BRIDGE CROSSING' },
    { z: -2000, label: 'CHECKPOINT CHARLIE' },
    { z: -2500, label: 'CHECKPOINT DELTA' },
    { z: EXTRACTION_Z, label: 'EXTRACTION POINT' },
  ];

  for (let i = 0; i < markerConfigs.length; i++) {
    const cfg = markerConfigs[i];
    const pos = new Vector3(0, 10, cfg.z);

    const markerMesh = MeshBuilder.CreateCylinder(
      `canyon_marker_${i}`,
      { diameter: 1.5, height: 20, tessellation: 6 },
      scene
    );
    const markerMat = new StandardMaterial(`canyon_marker_mat_${i}`, scene);
    markerMat.emissiveColor = new Color3(0.2, 0.7, 1.0);
    markerMat.alpha = 0.35;
    markerMat.disableLighting = true;
    markerMesh.material = markerMat;
    markerMesh.position = pos.clone();

    const beacon = new PointLight(
      `canyon_marker_light_${i}`,
      pos.add(new Vector3(0, 10, 0)),
      scene
    );
    beacon.intensity = 1.5;
    beacon.diffuse = new Color3(0.2, 0.7, 1.0);
    beacon.range = 40;

    markers.push({
      mesh: markerMesh,
      beacon,
      position: pos,
      label: cfg.label,
      reached: false,
    });
  }

  return markers;
}

// ============================================================================
// EXTRACTION ZONE
// ============================================================================

function createExtractionZone(
  scene: Scene,
  materials: CanyonMaterials
): Mesh {
  const zone = MeshBuilder.CreateCylinder(
    'canyon_extraction_zone',
    { diameter: 30, height: 0.3, tessellation: 32 },
    scene
  );
  zone.material = materials.extraction;
  zone.position.set(0, 0.2, EXTRACTION_Z);

  // Landing pad markings
  const padCenter = MeshBuilder.CreateCylinder(
    'canyon_extraction_pad',
    { diameter: 10, height: 0.1, tessellation: 32 },
    scene
  );
  const padMat = new StandardMaterial('canyon_pad_mat', scene);
  padMat.diffuseColor = Color3.FromHexString('#555555');
  padCenter.material = padMat;
  padCenter.position.set(0, 0.3, EXTRACTION_Z);

  return zone;
}

// ============================================================================
// SKY DOME
// ============================================================================

function createSkyDome(scene: Scene): Mesh {
  const skyDome = MeshBuilder.CreateSphere(
    'canyon_sky',
    { diameter: 6000, segments: 32, sideOrientation: 1 },
    scene
  );
  const skyMat = new StandardMaterial('canyon_sky_mat', scene);
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  skyMat.emissiveColor = Color3.FromHexString('#C8845A');
  skyDome.material = skyMat;
  skyDome.infiniteDistance = true;
  skyDome.renderingGroupId = 0;

  return skyDome;
}

// ============================================================================
// BRIDGE COLLAPSE ANIMATION
// ============================================================================

/**
 * Animate the collapse of a bridge structure.
 * Each segment falls with slightly different timing for dramatic effect.
 */
export function collapseBridge(
  bridge: BridgeStructure,
  scene: Scene
): void {
  if (bridge.collapsed || !bridge.isCollapsible) return;
  bridge.collapsed = true;

  // Sequentially drop each segment with slight delay
  bridge.segments.forEach((segment, index) => {
    const delay = index * 150; // 150ms between each segment

    setTimeout(() => {
      // Animate segment falling
      const startY = segment.position.y;
      const startTime = performance.now();
      const duration = 2000; // 2 seconds to fall

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / duration);

        // Accelerating fall (gravity)
        const fallDistance = t * t * 30;
        segment.position.y = startY - fallDistance;

        // Tumble rotation
        segment.rotation.x += 0.02 * t;
        segment.rotation.z += 0.01 * t;

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Remove after falling off-screen
          segment.isVisible = false;
        }
      };

      animate();
    }, delay);
  });
}

// ============================================================================
// ROCKSLIDE GENERATION
// ============================================================================

export interface RockslideRock {
  mesh: Mesh;
  velocity: Vector3;
  rotationSpeed: Vector3;
  lifetime: number;
}

/**
 * Spawn a rockslide from a canyon wall position.
 * Returns rocks that should be updated each frame.
 */
export function spawnRockslide(
  scene: Scene,
  wallSide: 'left' | 'right',
  zPosition: number,
  count: number = 12
): RockslideRock[] {
  const rocks: RockslideRock[] = [];
  const rand = seededRandom(Math.floor(zPosition * 100));

  const baseX = wallSide === 'left' ? -CANYON_HALF_WIDTH : CANYON_HALF_WIDTH;

  const rockMat = new StandardMaterial('rockslide_mat', scene);
  rockMat.diffuseColor = Color3.FromHexString('#7A6B5B');

  for (let i = 0; i < count; i++) {
    const size = 0.8 + rand() * 2.5;
    const rock = MeshBuilder.CreateSphere(
      `rockslide_${zPosition}_${i}`,
      { diameter: size, segments: 6 },
      scene
    );
    rock.material = rockMat;
    rock.position.set(
      baseX + (rand() - 0.5) * 5,
      WALL_HEIGHT * 0.5 + rand() * WALL_HEIGHT * 0.4,
      zPosition + (rand() - 0.5) * 15
    );

    // Velocity toward canyon center and downward
    const directionX = wallSide === 'left' ? 1 : -1;
    const velocity = new Vector3(
      directionX * (5 + rand() * 10),
      -2 - rand() * 5,
      (rand() - 0.5) * 5
    );

    const rotationSpeed = new Vector3(
      (rand() - 0.5) * 4,
      (rand() - 0.5) * 4,
      (rand() - 0.5) * 4
    );

    rocks.push({
      mesh: rock,
      velocity,
      rotationSpeed,
      lifetime: 5 + rand() * 3,
    });
  }

  return rocks;
}

/**
 * Update rockslide physics. Returns true if rocks still active.
 */
export function updateRockslide(
  rocks: RockslideRock[],
  deltaTime: number,
  gravity: number = 20
): boolean {
  let anyActive = false;

  for (const rock of rocks) {
    if (rock.lifetime <= 0) continue;

    rock.lifetime -= deltaTime;

    // Apply gravity
    rock.velocity.y -= gravity * deltaTime;

    // Update position
    rock.mesh.position.addInPlace(rock.velocity.scale(deltaTime));

    // Update rotation
    rock.mesh.rotation.addInPlace(rock.rotationSpeed.scale(deltaTime));

    // Bounce off ground
    const groundY = sampleTerrainHeight(
      rock.mesh.position.x,
      rock.mesh.position.z
    );
    if (rock.mesh.position.y < groundY + 0.5) {
      rock.mesh.position.y = groundY + 0.5;
      rock.velocity.y = Math.abs(rock.velocity.y) * 0.3;
      rock.velocity.x *= 0.7;
      rock.velocity.z *= 0.7;
    }

    if (rock.lifetime > 0) {
      anyActive = true;
    } else {
      rock.mesh.dispose();
    }
  }

  return anyActive;
}

/**
 * Dispose all rocks in a rockslide.
 */
export function disposeRockslide(rocks: RockslideRock[]): void {
  for (const rock of rocks) {
    rock.mesh.dispose();
  }
  rocks.length = 0;
}
