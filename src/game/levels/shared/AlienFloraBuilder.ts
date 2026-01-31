/**
 * AlienFloraBuilder - Reusable alien vegetation placement for outdoor levels
 *
 * Provides a catalog of all alien flora GLB assets, deterministic cluster
 * generation via seeded PRNG, and an async builder that loads unique GLBs
 * once then clones/instances for each placement.
 *
 * Usage:
 *   import {
 *     generateFloraCluster,
 *     buildFloraFromPlacements,
 *     getLandfallFlora,
 *   } from '../shared/AlienFloraBuilder';
 *
 *   const placements = getLandfallFlora();
 *   const nodes = await buildFloraFromPlacements(scene, placements, parentNode);
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';

import '@babylonjs/loaders/glTF';

// ============================================================================
// FLORA CATALOG
// ============================================================================

/** Base path for all alien flora GLB files. */
const FLORA_BASE = '/models/environment/alien-flora';

/**
 * Complete catalog of alien flora assets grouped by category.
 * Each entry is the filename (without .glb extension) under FLORA_BASE.
 */
const FLORA_CATALOG = {
  trees: [
    'alien_twistedtree_1',
    'alien_twistedtree_2',
    'alien_twistedtree_3',
    'alien_twistedtree_4',
    'alien_twistedtree_5',
    'alien_commontree_1',
    'alien_commontree_3',
    'alien_deadtree_1',
    'alien_deadtree_2',
    'alien_deadtree_3',
    'alien_spruce_01',
    'alien_spruce_02',
    'alien_tree_01',
    'alien_tree_02',
  ],
  mushrooms: [
    'alien_mushroom_01',
    'alien_mushroom_02',
    'alien_mushroom_03',
    'alien_mushroom_04',
    'alien_mushroom_05',
    'alien_mushroom_06',
    'alien_mushroom_07',
    'alien_mushroom_08',
    'alien_mushroom_09',
    'alien_mushroom_brown_01',
    'alien_mushroom_common',
    'alien_mushroom_laetiporus',
    'alien_mushroom_red_01',
    'alien_mushroom_tall_01',
  ],
  plants: [
    'alien_fern_1',
    'alien_flower',
    'alien_grass',
    'alien_bush_common',
    'alien_plant_1_big',
    'alien_plant_7_big',
    'alien_reed',
    'alien_hanging_moss_01',
    'alien_fallen_trunk_01',
  ],
  rocks: [
    'alien_rock_medium_1',
    'alien_rock_medium_2',
    'alien_rock_medium_3',
    'alien_tall_rock_1_01',
    'alien_tall_rock_2_01',
    'alien_tall_rock_3_01',
    'alien_boulder_polyhaven',
  ],
  groundCover: [
    'alien_iceplant',
  ],
} as const;

type FloraCategoryKey = keyof typeof FLORA_CATALOG;

/** Resolves a catalog filename to the full GLB path. */
function floraCatalogPath(filename: string): string {
  return `${FLORA_BASE}/${filename}.glb`;
}

// ============================================================================
// TYPES
// ============================================================================

export interface FloraPlacement {
  /** Full path to the GLB file (e.g. "/models/environment/alien-flora/alien_tree_01.glb"). */
  path: string;
  /** World-space position. */
  position: Vector3;
  /** Y-axis rotation in radians. */
  rotationY: number;
  /** Uniform scale multiplier. */
  scale: number;
}

export type FloraTheme =
  | 'forest'
  | 'mushroom_grove'
  | 'rocky_outcrop'
  | 'mixed'
  | 'frozen'
  | 'bioluminescent';

export type FloraDensity = 'sparse' | 'medium' | 'dense';

export interface FloraClusterConfig {
  /** Center of the cluster in world space. */
  center: Vector3;
  /** Radius of the placement area around center. */
  radius: number;
  /** How many items to place. sparse: 4-8, medium: 8-16, dense: 16-28. */
  density: FloraDensity;
  /** Determines which asset categories are selected. */
  theme: FloraTheme;
  /** Deterministic seed so clusters are identical each play session. */
  seed: number;
}

// ============================================================================
// SEEDED PRNG
// ============================================================================

/**
 * Park-Miller LCG with Bays-Durham shuffle.
 * Returns values in the half-open interval (0, 1).
 */
function seededRandom(seed: number): () => number {
  let s = Math.abs(seed % 2147483647) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ============================================================================
// THEME -> ASSET POOL MAPPING
// ============================================================================

/**
 * Returns a weighted pool of (categoryKey, weight) pairs for the given theme.
 * Weights control relative frequency of each category in the cluster.
 */
function getThemePool(theme: FloraTheme): Array<{ category: FloraCategoryKey; weight: number }> {
  switch (theme) {
    case 'forest':
      return [
        { category: 'trees', weight: 0.35 },
        { category: 'plants', weight: 0.35 },
        { category: 'rocks', weight: 0.10 },
        { category: 'groundCover', weight: 0.20 },
      ];
    case 'mushroom_grove':
      return [
        { category: 'mushrooms', weight: 0.55 },
        { category: 'groundCover', weight: 0.15 },
        { category: 'plants', weight: 0.30 },
      ];
    case 'rocky_outcrop':
      return [
        { category: 'rocks', weight: 0.55 },
        { category: 'groundCover', weight: 0.25 },
        { category: 'plants', weight: 0.20 },
      ];
    case 'mixed':
      return [
        { category: 'trees', weight: 0.25 },
        { category: 'mushrooms', weight: 0.20 },
        { category: 'plants', weight: 0.25 },
        { category: 'rocks', weight: 0.20 },
        { category: 'groundCover', weight: 0.10 },
      ];
    case 'frozen':
      return [
        { category: 'rocks', weight: 0.35 },
        { category: 'groundCover', weight: 0.25 },
        { category: 'trees', weight: 0.40 },
      ];
    case 'bioluminescent':
      return [
        { category: 'mushrooms', weight: 0.45 },
        { category: 'plants', weight: 0.35 },
        { category: 'groundCover', weight: 0.20 },
      ];
  }
}

/**
 * For the "frozen" theme, restrict trees to dead/spruce variants only.
 * For "bioluminescent", restrict plants to flowers/moss/ferns only.
 * For "forest", restrict plants to ferns/bushes/grass/trunks only (no hanging moss).
 */
function getFilteredItems(category: FloraCategoryKey, theme: FloraTheme): readonly string[] {
  const items = FLORA_CATALOG[category];

  if (theme === 'frozen' && category === 'trees') {
    return items.filter(
      (name) =>
        name.startsWith('alien_deadtree') ||
        name.startsWith('alien_spruce')
    );
  }

  if (theme === 'bioluminescent' && category === 'plants') {
    return items.filter(
      (name) =>
        name === 'alien_flower' ||
        name === 'alien_hanging_moss_01' ||
        name === 'alien_fern_1'
    );
  }

  if (theme === 'forest' && category === 'plants') {
    return items.filter(
      (name) =>
        name === 'alien_fern_1' ||
        name === 'alien_grass' ||
        name === 'alien_bush_common' ||
        name === 'alien_fallen_trunk_01' ||
        name === 'alien_plant_1_big' ||
        name === 'alien_plant_7_big'
    );
  }

  return items;
}

// ============================================================================
// DENSITY -> COUNT RANGE
// ============================================================================

function getDensityRange(density: FloraDensity): [number, number] {
  switch (density) {
    case 'sparse':
      return [4, 8];
    case 'medium':
      return [8, 16];
    case 'dense':
      return [16, 28];
  }
}

// ============================================================================
// SCALE RANGES PER CATEGORY
// ============================================================================

function getScaleRange(category: FloraCategoryKey): [number, number] {
  switch (category) {
    case 'trees':
      return [0.8, 1.6];
    case 'mushrooms':
      return [0.5, 1.2];
    case 'plants':
      return [0.6, 1.4];
    case 'rocks':
      return [0.7, 2.0];
    case 'groundCover':
      return [0.8, 1.5];
  }
}

// ============================================================================
// CLUSTER GENERATION
// ============================================================================

/**
 * Generate a deterministic array of flora placements for a single cluster.
 *
 * The output is fully determined by the `config.seed`, so the exact same
 * vegetation appears on every load.
 */
export function generateFloraCluster(config: FloraClusterConfig): FloraPlacement[] {
  const rng = seededRandom(config.seed);
  const pool = getThemePool(config.theme);
  const [minCount, maxCount] = getDensityRange(config.density);
  const count = minCount + Math.floor(rng() * (maxCount - minCount + 1));

  // Build the cumulative weight distribution for category selection.
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  const cumulativeWeights: number[] = [];
  let running = 0;
  for (const entry of pool) {
    running += entry.weight / totalWeight;
    cumulativeWeights.push(running);
  }

  const placements: FloraPlacement[] = [];

  for (let i = 0; i < count; i++) {
    // Pick a category using weighted random selection.
    const roll = rng();
    let categoryIndex = 0;
    for (let w = 0; w < cumulativeWeights.length; w++) {
      if (roll <= cumulativeWeights[w]) {
        categoryIndex = w;
        break;
      }
    }
    const { category } = pool[categoryIndex];

    // Pick a random item within the filtered category.
    const items = getFilteredItems(category, config.theme);
    if (items.length === 0) continue;
    const itemIndex = Math.floor(rng() * items.length);
    const filename = items[itemIndex];

    // Compute position within the cluster radius (uniform disk distribution).
    const angle = rng() * Math.PI * 2;
    const distance = Math.sqrt(rng()) * config.radius;
    const offsetX = Math.cos(angle) * distance;
    const offsetZ = Math.sin(angle) * distance;

    // Random rotation and scale.
    const rotationY = rng() * Math.PI * 2;
    const [minScale, maxScale] = getScaleRange(category);
    const scale = minScale + rng() * (maxScale - minScale);

    placements.push({
      path: floraCatalogPath(filename),
      position: new Vector3(
        config.center.x + offsetX,
        config.center.y,
        config.center.z + offsetZ
      ),
      rotationY,
      scale,
    });
  }

  return placements;
}

// ============================================================================
// ASYNC BUILDER
// ============================================================================

/**
 * Load GLB assets and create scene nodes for every placement.
 *
 * Each unique GLB is loaded exactly once via `SceneLoader.ImportMeshAsync`.
 * Subsequent placements of the same GLB are created by cloning the first
 * loaded container. All nodes are parented under `parent`.
 *
 * Uses `Promise.allSettled` so a single missing asset does not block the
 * entire cluster from appearing.
 *
 * @param scene       Active BabylonJS scene.
 * @param placements  Array of flora placements to realise.
 * @param parent      TransformNode that owns all created nodes.
 * @returns           Array of all created TransformNode roots (for disposal).
 */
export async function buildFloraFromPlacements(
  scene: Scene,
  placements: FloraPlacement[],
  parent: TransformNode
): Promise<TransformNode[]> {
  if (placements.length === 0) return [];

  // --- Phase 1: Determine unique GLB paths ---------------------------------
  const uniquePaths = Array.from(new Set(placements.map((p) => p.path)));

  // --- Phase 2: Load each unique GLB once ----------------------------------
  const loaded = new Map<string, TransformNode>();

  const loadResults = await Promise.allSettled(
    uniquePaths.map(async (glbPath) => {
      const result = await SceneLoader.ImportMeshAsync('', glbPath, '', scene);
      if (result.meshes.length === 0) {
        throw new Error(`No meshes in ${glbPath}`);
      }

      // Create a container TransformNode to hold the loaded meshes.
      const container = new TransformNode(`flora_template_${glbPath}`, scene);
      for (const mesh of result.meshes) {
        if (!mesh.parent) {
          mesh.parent = container;
        }
        mesh.receiveShadows = true;
      }

      // Disable the template (it is only used for cloning).
      container.setEnabled(false);
      loaded.set(glbPath, container);
    })
  );

  // Log failures for debugging.
  for (let i = 0; i < loadResults.length; i++) {
    if (loadResults[i].status === 'rejected') {
      const reason = (loadResults[i] as PromiseRejectedResult).reason;
      console.warn(
        `[AlienFloraBuilder] Failed to load: ${uniquePaths[i]}`,
        reason
      );
    }
  }

  // --- Phase 3: Clone / instance each placement ----------------------------
  const createdNodes: TransformNode[] = [];
  const cloneCounters = new Map<string, number>();

  for (const placement of placements) {
    const template = loaded.get(placement.path);
    if (!template) continue; // Asset failed to load -- skip.

    const count = (cloneCounters.get(placement.path) ?? 0) + 1;
    cloneCounters.set(placement.path, count);

    const nodeName = `flora_${stripFilename(placement.path)}_${count}`;
    const clone = template.clone(nodeName, parent);

    if (!clone) {
      console.warn(`[AlienFloraBuilder] Clone failed for ${placement.path}`);
      continue;
    }

    clone.position = placement.position.clone();
    clone.rotation = new Vector3(0, placement.rotationY, 0);
    clone.scaling = new Vector3(placement.scale, placement.scale, placement.scale);
    clone.setEnabled(true);

    // Ensure all child meshes receive shadows.
    const children = clone.getChildMeshes(false);
    for (const child of children) {
      child.receiveShadows = true;
    }

    createdNodes.push(clone);
  }

  // --- Phase 4: Dispose templates ------------------------------------------
  loaded.forEach((template) => {
    template.dispose(false, true);
  });

  console.log(
    `[AlienFloraBuilder] Built ${createdNodes.length}/${placements.length} flora placements ` +
      `(${uniquePaths.length} unique assets)`
  );

  return createdNodes;
}

/**
 * Extract the base filename from a full GLB path for node naming.
 * "/models/environment/alien-flora/alien_tree_01.glb" -> "alien_tree_01"
 */
function stripFilename(glbPath: string): string {
  const lastSlash = glbPath.lastIndexOf('/');
  const name = lastSlash >= 0 ? glbPath.substring(lastSlash + 1) : glbPath;
  return name.replace('.glb', '');
}

// ============================================================================
// LEVEL-SPECIFIC PRESET FUNCTIONS
// ============================================================================

/**
 * Landfall (Chapter 2) - Surface combat area after HALO drop.
 *
 * The terrain is a 500x500 rocky surface centered at origin. The LZ pad sits
 * at (0, 0, 0). Combat occurs mostly in the Z > 0 half. We place:
 *   - Mixed alien vegetation around the arena edges
 *   - Mushroom groves in the lowlands (negative Y pockets)
 *   - Twisted trees near the canyon rim (high X values)
 *   - Sparse rocky outcrops at extreme range
 */
export function getLandfallFlora(): FloraPlacement[] {
  return [
    // NE forest cluster near canyon edge
    ...generateFloraCluster({
      center: new Vector3(80, 0, 60),
      radius: 30,
      density: 'medium',
      theme: 'forest',
      seed: 20001,
    }),
    // NW mushroom grove in lowland area
    ...generateFloraCluster({
      center: new Vector3(-70, -2, 50),
      radius: 25,
      density: 'dense',
      theme: 'mushroom_grove',
      seed: 20002,
    }),
    // South-east rocky outcrop beyond the perimeter
    ...generateFloraCluster({
      center: new Vector3(100, 0, -40),
      radius: 35,
      density: 'sparse',
      theme: 'rocky_outcrop',
      seed: 20003,
    }),
    // Far north mixed cluster (distant scenery)
    ...generateFloraCluster({
      center: new Vector3(0, 0, 120),
      radius: 40,
      density: 'medium',
      theme: 'mixed',
      seed: 20004,
    }),
  ];
}

/**
 * Canyon Run (Chapter 3) - Vehicle chase through a canyon.
 *
 * Canyon spans Z: 0 to -3000, width ~60 units (CANYON_HALF_WIDTH = 30).
 * Vegetation is sparse along canyon walls with pockets of growth.
 */
export function getCanyonRunFlora(): FloraPlacement[] {
  return [
    // Opening section: twisted trees along left wall
    ...generateFloraCluster({
      center: new Vector3(-25, 0, -100),
      radius: 15,
      density: 'sparse',
      theme: 'forest',
      seed: 30001,
    }),
    // Shaded alcove with mushrooms at z=-400
    ...generateFloraCluster({
      center: new Vector3(22, 0, -400),
      radius: 12,
      density: 'medium',
      theme: 'mushroom_grove',
      seed: 30002,
    }),
    // Rocky outcrop mid-canyon
    ...generateFloraCluster({
      center: new Vector3(-20, 0, -700),
      radius: 18,
      density: 'medium',
      theme: 'rocky_outcrop',
      seed: 30003,
    }),
    // Mixed vegetation near bridge approach
    ...generateFloraCluster({
      center: new Vector3(15, 0, -1300),
      radius: 14,
      density: 'sparse',
      theme: 'mixed',
      seed: 30004,
    }),
    // Post-bridge scattered trees
    ...generateFloraCluster({
      center: new Vector3(-18, 0, -1800),
      radius: 20,
      density: 'sparse',
      theme: 'forest',
      seed: 30005,
    }),
    // Rocky cluster near extraction
    ...generateFloraCluster({
      center: new Vector3(20, 0, -2700),
      radius: 16,
      density: 'sparse',
      theme: 'rocky_outcrop',
      seed: 30006,
    }),
  ];
}

/**
 * Brothers in Arms (Chapter 4) - Open canyon arena (200m x 150m).
 *
 * Battlefield at roughly (0, 0, 0). The Breach sinkhole is at Z ~ -120.
 * Vegetation is sparse and battle-damaged.
 */
export function getBrothersFlora(): FloraPlacement[] {
  return [
    // Dead trees around the arena flanks (battle-scorched)
    ...generateFloraCluster({
      center: new Vector3(-70, 0, -30),
      radius: 25,
      density: 'sparse',
      theme: 'frozen', // Reuse frozen theme for dead trees
      seed: 40001,
    }),
    // Rocky cover along the east side
    ...generateFloraCluster({
      center: new Vector3(60, 0, -50),
      radius: 20,
      density: 'medium',
      theme: 'rocky_outcrop',
      seed: 40002,
    }),
    // Scattered alien plants near the breach
    ...generateFloraCluster({
      center: new Vector3(-20, 0, -100),
      radius: 18,
      density: 'sparse',
      theme: 'mixed',
      seed: 40003,
    }),
    // Small bioluminescent cluster near hive entrance
    ...generateFloraCluster({
      center: new Vector3(10, 0, -130),
      radius: 12,
      density: 'sparse',
      theme: 'bioluminescent',
      seed: 40004,
    }),
  ];
}

/**
 * Southern Ice (Chapter 6) - Frozen wasteland.
 *
 * Terrain is 600x600, centered at origin. Frozen lake at (0, -0.5, -160).
 * Outpost at (40, 0, -50). Cave entrances at various positions.
 * Sparse, windswept feel using dead trees, ice plants, and rocks.
 */
export function getSouthernIceFlora(): FloraPlacement[] {
  return [
    // Windswept dead trees near spawn
    ...generateFloraCluster({
      center: new Vector3(-30, 0, 20),
      radius: 30,
      density: 'sparse',
      theme: 'frozen',
      seed: 60001,
    }),
    // Rocky ice formations near frozen lake shore
    ...generateFloraCluster({
      center: new Vector3(40, 0, -100),
      radius: 25,
      density: 'medium',
      theme: 'frozen',
      seed: 60002,
    }),
    // Ice plants and rocks near cave entrance 1
    ...generateFloraCluster({
      center: new Vector3(-80, 0, -110),
      radius: 15,
      density: 'sparse',
      theme: 'frozen',
      seed: 60003,
    }),
    // Frozen rocky outcrop between lake and cave 2
    ...generateFloraCluster({
      center: new Vector3(60, 0, -180),
      radius: 20,
      density: 'medium',
      theme: 'rocky_outcrop',
      seed: 60004,
    }),
    // Sparse dead trees near cave 3
    ...generateFloraCluster({
      center: new Vector3(-30, 0, -260),
      radius: 18,
      density: 'sparse',
      theme: 'frozen',
      seed: 60005,
    }),
  ];
}

/**
 * Extraction (Chapter 9) - Night-time surface holdout at LZ Omega.
 *
 * Player emerges from hive and runs 500m to LZ Omega. Combat waves at the
 * LZ. Uses SAND_TERRAIN. Bioluminescent mushrooms provide eerie glow in
 * the dark. Sparse twisted trees silhouetted against the sky.
 */
export function getExtractionFlora(): FloraPlacement[] {
  return [
    // Bioluminescent mushrooms near the hive exit
    ...generateFloraCluster({
      center: new Vector3(0, 0, -20),
      radius: 20,
      density: 'dense',
      theme: 'bioluminescent',
      seed: 90001,
    }),
    // Eerie glow cluster along the run path
    ...generateFloraCluster({
      center: new Vector3(-30, 0, -120),
      radius: 18,
      density: 'medium',
      theme: 'bioluminescent',
      seed: 90002,
    }),
    // Sparse twisted trees on the approach to LZ
    ...generateFloraCluster({
      center: new Vector3(40, 0, -250),
      radius: 25,
      density: 'sparse',
      theme: 'forest',
      seed: 90003,
    }),
    // Rocky outcrop near LZ perimeter
    ...generateFloraCluster({
      center: new Vector3(-50, 0, -350),
      radius: 20,
      density: 'medium',
      theme: 'rocky_outcrop',
      seed: 90004,
    }),
    // Bioluminescent accent near LZ itself
    ...generateFloraCluster({
      center: new Vector3(20, 0, -450),
      radius: 14,
      density: 'sparse',
      theme: 'bioluminescent',
      seed: 90005,
    }),
  ];
}

/**
 * Final Escape (Chapter 10) - Vehicle escape to shuttle.
 *
 * Surface run section only (Z: -500 to -1500). Burning, destroyed alien
 * landscape. Player is racing through at high speed, so flora is scattered
 * and sparse -- mostly silhouettes and obstacles at the edges.
 */
export function getFinalEscapeFlora(): FloraPlacement[] {
  return [
    // Scattered dead trees at surface exit
    ...generateFloraCluster({
      center: new Vector3(30, 0, -550),
      radius: 25,
      density: 'sparse',
      theme: 'frozen', // Dead trees for devastated landscape
      seed: 100001,
    }),
    // Rocky debris mid-surface
    ...generateFloraCluster({
      center: new Vector3(-40, 0, -800),
      radius: 30,
      density: 'sparse',
      theme: 'rocky_outcrop',
      seed: 100002,
    }),
    // Burning alien landscape fragments
    ...generateFloraCluster({
      center: new Vector3(50, 0, -1100),
      radius: 22,
      density: 'sparse',
      theme: 'mixed',
      seed: 100003,
    }),
    // Final scattered rocks before lava canyon
    ...generateFloraCluster({
      center: new Vector3(-25, 0, -1400),
      radius: 20,
      density: 'sparse',
      theme: 'rocky_outcrop',
      seed: 100004,
    }),
  ];
}

/**
 * Hive Assault (Chapter 8) - Combined arms push toward the hive entrance.
 *
 * Staging area at Z: 0 to -50, open field Z: -50 to -400, breach point
 * Z: -400 to -550, hive entrance Z: -550 to -650. Terrain is 300m wide.
 * Transition from military outpost to alien-dominated landscape.
 */
export function getHiveAssaultFlora(): FloraPlacement[] {
  return [
    // Mixed vegetation outside the FOB staging area
    ...generateFloraCluster({
      center: new Vector3(-80, 0, -20),
      radius: 28,
      density: 'medium',
      theme: 'mixed',
      seed: 80001,
    }),
    // Rocky outcrops providing cover on the open field
    ...generateFloraCluster({
      center: new Vector3(70, 0, -150),
      radius: 22,
      density: 'medium',
      theme: 'rocky_outcrop',
      seed: 80002,
    }),
    // Alien forest encroaching on the battlefield
    ...generateFloraCluster({
      center: new Vector3(-60, 0, -280),
      radius: 25,
      density: 'medium',
      theme: 'forest',
      seed: 80003,
    }),
    // Bioluminescent mushrooms near the breach
    ...generateFloraCluster({
      center: new Vector3(20, 0, -420),
      radius: 18,
      density: 'dense',
      theme: 'bioluminescent',
      seed: 80004,
    }),
    // Dense bioluminescent cluster flanking the hive entrance
    ...generateFloraCluster({
      center: new Vector3(-30, 0, -560),
      radius: 20,
      density: 'dense',
      theme: 'bioluminescent',
      seed: 80005,
    }),
    // Opposite side of hive entrance
    ...generateFloraCluster({
      center: new Vector3(40, 0, -580),
      radius: 16,
      density: 'medium',
      theme: 'bioluminescent',
      seed: 80006,
    }),
  ];
}
