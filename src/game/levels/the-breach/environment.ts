/**
 * TheBreachLevel - Environment Creation
 *
 * Enhances the shared HiveEnvironmentBuilder with hand-placed GLB assets
 * to create a "human infrastructure consumed by alien hive" atmosphere.
 *
 * Three distinct zones:
 *   1. ENTRY TUNNEL  -- mostly station tech with hive growth creeping in
 *   2. DEEP HIVE     -- organic tunnels with occasional tech remnants
 *   3. QUEEN CHAMBER -- massive organic arena with brain/birther structures
 *
 * GLB assets used:
 *   - Station beams (beam_hc_h1/h2, beam_hc_v2, beam_hl_1)
 *   - Quaternius detail plates (plate_detail, plate_long, plate_sm)
 *   - Tech fragments (detail_x, detail_triangles)
 *   - Hive structures (birther, brain, claw, crystals, stomach, terraformer, undercrystal)
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('BreachEnvironment');

// Re-export shared builder so existing imports keep working
export { HiveEnvironmentBuilder, updateBiolights } from '../shared/HiveEnvironmentBuilder';

// ============================================================================
// ASSET PATH MAPPINGS
// ============================================================================

/** Station beam GLB paths (path-based loading) */
const STATION_BEAM_PATHS: Record<string, string> = {
  beam_hc_h1: '/assets/models/environment/station/beam_hc_horizonatal_1.glb',
  beam_hc_h2: '/assets/models/environment/station/beam_hc_horizonatal_2.glb',
  beam_hc_v2: '/assets/models/environment/station/beam_hc_vertical_2.glb',
  beam_hl_1: '/assets/models/environment/station/beam_hl_1.glb',
};

/** Quaternius modular detail GLB paths (path-based loading) */
const MODULAR_DETAIL_PATHS: Record<string, string> = {
  plate_detail: '/assets/models/environment/modular/Details_Plate_Details.glb',
  plate_long: '/assets/models/environment/modular/Details_Plate_Long.glb',
  plate_sm: '/assets/models/environment/modular/Details_Plate_Small.glb',
  detail_x: '/assets/models/environment/modular/Details_X.glb',
  detail_triangles: '/assets/models/environment/modular/Details_Triangles.glb',
};

// ============================================================================
// PLACEMENT TYPES
// ============================================================================

/** A single placed GLB asset instance in the environment */
export interface PlacedAsset {
  node: TransformNode;
  type: string;
  zone: 'entry' | 'deep_hive' | 'queen_chamber';
}

/** Configuration for a station beam or modular detail placement */
interface AssetPlacement {
  /** Key into STATION_BEAM_PATHS or MODULAR_DETAIL_PATHS */
  assetKey: string;
  /** Whether this is a station beam or a modular detail */
  assetGroup: 'beam' | 'detail';
  /** World position */
  position: Vector3;
  /** Rotation in radians (x, y, z) */
  rotation: Vector3;
  /** Uniform scale */
  scale: number;
  /** Zone tag */
  zone: 'entry' | 'deep_hive' | 'queen_chamber';
}

// ============================================================================
// ZONE 1: ENTRY TUNNEL PLACEMENTS
// Mostly intact station infrastructure with creeping hive growth.
// Beams form structural archways; detail plates line the walls.
// ============================================================================

const ENTRY_TUNNEL_PLACEMENTS: AssetPlacement[] = [
  // --- Structural beam archways at tunnel entrance ---
  // First arch: horizontal beam spanning the tunnel mouth
  {
    assetKey: 'beam_hc_h1',
    assetGroup: 'beam',
    position: new Vector3(0, 0.5, 4),
    rotation: new Vector3(0, 0, 0),
    scale: 0.8,
    zone: 'entry',
  },
  // Vertical beam left side of entrance -- partially tipped
  {
    assetKey: 'beam_hc_v2',
    assetGroup: 'beam',
    position: new Vector3(-2.5, -1, 6),
    rotation: new Vector3(0.1, 0, 0.15),
    scale: 0.7,
    zone: 'entry',
  },
  // Vertical beam right side of entrance
  {
    assetKey: 'beam_hc_v2',
    assetGroup: 'beam',
    position: new Vector3(2.5, -1, 6),
    rotation: new Vector3(-0.05, Math.PI, -0.12),
    scale: 0.7,
    zone: 'entry',
  },
  // Second arch deeper in -- beam_hc_h2 variant
  {
    assetKey: 'beam_hc_h2',
    assetGroup: 'beam',
    position: new Vector3(0, -4, 16),
    rotation: new Vector3(0.08, 0.2, 0),
    scale: 0.75,
    zone: 'entry',
  },
  // Collapsed horizontal beam across path (player ducks under)
  {
    assetKey: 'beam_hl_1',
    assetGroup: 'beam',
    position: new Vector3(-0.5, -8, 24),
    rotation: new Vector3(0, 0.4, 0.3),
    scale: 0.6,
    zone: 'entry',
  },
  // Third archway -- deeper, more warped by organic growth
  {
    assetKey: 'beam_hc_h1',
    assetGroup: 'beam',
    position: new Vector3(0, -14, 36),
    rotation: new Vector3(0.15, -0.1, 0.08),
    scale: 0.7,
    zone: 'entry',
  },

  // --- Detail plates embedded in walls (remnants of station paneling) ---
  // Right wall panel near entrance
  {
    assetKey: 'plate_long',
    assetGroup: 'detail',
    position: new Vector3(2.2, 0.2, 8),
    rotation: new Vector3(0, -Math.PI / 2, 0.1),
    scale: 0.5,
    zone: 'entry',
  },
  // Left wall panel
  {
    assetKey: 'plate_detail',
    assetGroup: 'detail',
    position: new Vector3(-2.0, -2, 12),
    rotation: new Vector3(0, Math.PI / 2, -0.08),
    scale: 0.45,
    zone: 'entry',
  },
  // Small plate partially consumed -- ceiling
  {
    assetKey: 'plate_sm',
    assetGroup: 'detail',
    position: new Vector3(0.8, 1.2, 18),
    rotation: new Vector3(Math.PI / 2, 0.3, 0),
    scale: 0.4,
    zone: 'entry',
  },
  // Detail X grate embedded in floor -- corroded
  {
    assetKey: 'detail_x',
    assetGroup: 'detail',
    position: new Vector3(-1.0, -6.5, 20),
    rotation: new Vector3(Math.PI / 2, 0, 0.2),
    scale: 0.6,
    zone: 'entry',
  },
  // Triangle detail -- tech fragment in right wall
  {
    assetKey: 'detail_triangles',
    assetGroup: 'detail',
    position: new Vector3(2.0, -5, 22),
    rotation: new Vector3(0, -Math.PI / 2, 0),
    scale: 0.5,
    zone: 'entry',
  },
  // Long plate on left wall further in
  {
    assetKey: 'plate_long',
    assetGroup: 'detail',
    position: new Vector3(-2.3, -10, 30),
    rotation: new Vector3(0.05, Math.PI / 2, 0.15),
    scale: 0.4,
    zone: 'entry',
  },
  // More detail plates deeper in the entry
  {
    assetKey: 'plate_detail',
    assetGroup: 'detail',
    position: new Vector3(1.8, -12, 34),
    rotation: new Vector3(0, -Math.PI / 2, -0.1),
    scale: 0.35,
    zone: 'entry',
  },
  // Floor grate detail
  {
    assetKey: 'detail_x',
    assetGroup: 'detail',
    position: new Vector3(0, -15, 40),
    rotation: new Vector3(Math.PI / 2, 0.5, 0),
    scale: 0.5,
    zone: 'entry',
  },
];

// ============================================================================
// ZONE 2: DEEP HIVE PLACEMENTS
// Organic tunnels dominant with occasional tech remnants half-absorbed.
// Beams are broken, tilted, wrapped in organic growth.
// Hive structures appear: crystals, claw, stomach, terraformer.
// ============================================================================

const DEEP_HIVE_PLACEMENTS: AssetPlacement[] = [
  // --- Broken beams jutting out of organic walls ---
  // Beam protruding from left wall -- snapped, organic covering base
  {
    assetKey: 'beam_hl_1',
    assetGroup: 'beam',
    position: new Vector3(-4, -52, 62),
    rotation: new Vector3(0.4, 0.8, 0.6),
    scale: 0.5,
    zone: 'deep_hive',
  },
  // Horizontal beam embedded in ceiling, half-consumed
  {
    assetKey: 'beam_hc_h1',
    assetGroup: 'beam',
    position: new Vector3(1, -48, 68),
    rotation: new Vector3(0.3, 0.1, 0.2),
    scale: 0.55,
    zone: 'deep_hive',
  },
  // Vertical beam standing in mid-tunnel (obstacle), wrapped in hive matter
  {
    assetKey: 'beam_hc_v2',
    assetGroup: 'beam',
    position: new Vector3(3, -60, 78),
    rotation: new Vector3(0.15, 0.5, 0.1),
    scale: 0.5,
    zone: 'deep_hive',
  },
  // Beam segment at junction -- dragged/tilted by organic growth
  {
    assetKey: 'beam_hc_h2',
    assetGroup: 'beam',
    position: new Vector3(-2, -68, 88),
    rotation: new Vector3(0.6, -0.3, 0.4),
    scale: 0.45,
    zone: 'deep_hive',
  },
  // Collapsed beam across side passage
  {
    assetKey: 'beam_hl_1',
    assetGroup: 'beam',
    position: new Vector3(5, -72, 94),
    rotation: new Vector3(0.2, 1.2, 0.7),
    scale: 0.4,
    zone: 'deep_hive',
  },

  // --- Small tech fragments half-absorbed into hive walls ---
  // Plate detail in organic wall
  {
    assetKey: 'plate_sm',
    assetGroup: 'detail',
    position: new Vector3(-3, -55, 65),
    rotation: new Vector3(0.3, 0.6, 0.2),
    scale: 0.3,
    zone: 'deep_hive',
  },
  // Detail triangles embedded in floor
  {
    assetKey: 'detail_triangles',
    assetGroup: 'detail',
    position: new Vector3(2, -62, 76),
    rotation: new Vector3(0.8, 0.2, 0.1),
    scale: 0.35,
    zone: 'deep_hive',
  },
  // Detail X in organic ceiling
  {
    assetKey: 'detail_x',
    assetGroup: 'detail',
    position: new Vector3(-1, -50, 58),
    rotation: new Vector3(0.5, 1.0, 0.3),
    scale: 0.4,
    zone: 'deep_hive',
  },
  // Plate long fragment in wall near acid pool
  {
    assetKey: 'plate_long',
    assetGroup: 'detail',
    position: new Vector3(4, -66, 84),
    rotation: new Vector3(0.2, -0.7, 0.5),
    scale: 0.3,
    zone: 'deep_hive',
  },
  // Another plate absorbed near chamber entrance
  {
    assetKey: 'plate_detail',
    assetGroup: 'detail',
    position: new Vector3(-5, -75, 96),
    rotation: new Vector3(0.4, 0.9, -0.2),
    scale: 0.25,
    zone: 'deep_hive',
  },
];

// ============================================================================
// ZONE 3: QUEEN CHAMBER PLACEMENTS
// Massive organic arena with scattered tech debris.
// Central brain/birther structures; ring of claw/crystal formations.
// Beams are rare -- only fragments visible as the hive fully absorbed them.
// ============================================================================

const QUEEN_CHAMBER_PLACEMENTS: AssetPlacement[] = [
  // --- Entrance approach: last tech remnants ---
  // Beam arch at chamber entrance -- buckled inward, organic coating
  {
    assetKey: 'beam_hc_h1',
    assetGroup: 'beam',
    position: new Vector3(0, -144, 155),
    rotation: new Vector3(0.25, 0, 0.35),
    scale: 0.6,
    zone: 'queen_chamber',
  },
  // Vertical beam fragment left of entrance
  {
    assetKey: 'beam_hc_v2',
    assetGroup: 'beam',
    position: new Vector3(-4, -146, 158),
    rotation: new Vector3(0.3, 0.4, 0.5),
    scale: 0.4,
    zone: 'queen_chamber',
  },
  // Beam fragment right side -- mostly consumed
  {
    assetKey: 'beam_hl_1',
    assetGroup: 'beam',
    position: new Vector3(5, -147, 160),
    rotation: new Vector3(0.5, -0.6, 0.3),
    scale: 0.35,
    zone: 'queen_chamber',
  },

  // --- Scattered tech debris around arena perimeter ---
  // Detail plate near arena left wall
  {
    assetKey: 'plate_long',
    assetGroup: 'detail',
    position: new Vector3(-18, -149, 178),
    rotation: new Vector3(0.3, 1.2, 0.4),
    scale: 0.35,
    zone: 'queen_chamber',
  },
  // Tech fragment right side
  {
    assetKey: 'detail_x',
    assetGroup: 'detail',
    position: new Vector3(16, -149, 185),
    rotation: new Vector3(0.6, -0.8, 0.1),
    scale: 0.4,
    zone: 'queen_chamber',
  },
  // Detail triangles rear of chamber
  {
    assetKey: 'detail_triangles',
    assetGroup: 'detail',
    position: new Vector3(-8, -149, 200),
    rotation: new Vector3(0.7, 0.3, 0.5),
    scale: 0.3,
    zone: 'queen_chamber',
  },
  // Small plate detail near queen position
  {
    assetKey: 'plate_sm',
    assetGroup: 'detail',
    position: new Vector3(10, -148, 195),
    rotation: new Vector3(0.4, -0.5, 0.2),
    scale: 0.25,
    zone: 'queen_chamber',
  },
  // Plate detail embedded in floor
  {
    assetKey: 'plate_detail',
    assetGroup: 'detail',
    position: new Vector3(-12, -150, 170),
    rotation: new Vector3(Math.PI / 2 - 0.1, 0.6, 0),
    scale: 0.3,
    zone: 'queen_chamber',
  },
];

// ============================================================================
// HIVE STRUCTURE PLACEMENTS (using category-based AssetManager API)
// These are the organic alien structures placed throughout all three zones.
// ============================================================================

export interface HiveStructurePlacement {
  type: 'birther' | 'brain' | 'claw' | 'crystals' | 'stomach' | 'terraformer' | 'undercrystal';
  position: Vector3;
  zone: 'entry' | 'deep_hive' | 'queen_chamber';
  scale: number;
  rotationY: number;
}

export const HIVE_STRUCTURE_PLACEMENTS: HiveStructurePlacement[] = [
  // --- Entry Tunnel: crystal growths beginning to overtake station walls ---
  {
    type: 'crystals',
    position: new Vector3(1.5, -15, 25),
    zone: 'entry',
    scale: 0.4,
    rotationY: Math.PI / 4,
  },
  {
    type: 'crystals',
    position: new Vector3(-1.8, -25, 35),
    zone: 'entry',
    scale: 0.35,
    rotationY: -Math.PI / 6,
  },
  {
    type: 'undercrystal',
    position: new Vector3(2.0, -20, 30),
    zone: 'entry',
    scale: 0.3,
    rotationY: Math.PI / 3,
  },
  // Small claw structure near tunnel wall -- first sign of danger
  {
    type: 'claw',
    position: new Vector3(-2.5, -10, 20),
    zone: 'entry',
    scale: 0.25,
    rotationY: Math.PI * 0.7,
  },

  // --- Deep Hive: dense organic structures ---
  {
    type: 'birther',
    position: new Vector3(-4, -58, 75),
    zone: 'deep_hive',
    scale: 0.6,
    rotationY: Math.PI,
  },
  {
    type: 'terraformer',
    position: new Vector3(5, -65, 82),
    zone: 'deep_hive',
    scale: 0.5,
    rotationY: -Math.PI / 4,
  },
  {
    type: 'stomach',
    position: new Vector3(-2, -70, 90),
    zone: 'deep_hive',
    scale: 0.55,
    rotationY: Math.PI / 2,
  },
  {
    type: 'claw',
    position: new Vector3(4, -55, 68),
    zone: 'deep_hive',
    scale: 0.5,
    rotationY: -Math.PI / 3,
  },
  {
    type: 'crystals',
    position: new Vector3(-5, -62, 80),
    zone: 'deep_hive',
    scale: 0.45,
    rotationY: Math.PI * 0.6,
  },
  {
    type: 'undercrystal',
    position: new Vector3(2, -75, 95),
    zone: 'deep_hive',
    scale: 0.4,
    rotationY: 0,
  },

  // --- Lower Hive (transition to Queen) ---
  {
    type: 'brain',
    position: new Vector3(0, -95, 112),
    zone: 'deep_hive',
    scale: 0.8,
    rotationY: 0,
  },
  {
    type: 'terraformer',
    position: new Vector3(-6, -100, 120),
    zone: 'deep_hive',
    scale: 0.6,
    rotationY: Math.PI / 5,
  },
  {
    type: 'stomach',
    position: new Vector3(5, -105, 125),
    zone: 'deep_hive',
    scale: 0.5,
    rotationY: -Math.PI / 2,
  },
  {
    type: 'claw',
    position: new Vector3(-3, -108, 132),
    zone: 'deep_hive',
    scale: 0.6,
    rotationY: Math.PI * 0.8,
  },
  {
    type: 'crystals',
    position: new Vector3(3, -110, 140),
    zone: 'deep_hive',
    scale: 0.5,
    rotationY: Math.PI / 4,
  },

  // --- Queen Chamber: massive organic architecture ---
  // Central brain structure behind the Queen's position
  {
    type: 'brain',
    position: new Vector3(0, -148, 198),
    zone: 'queen_chamber',
    scale: 1.2,
    rotationY: Math.PI,
  },
  // Flanking birther structures (spawn pods)
  {
    type: 'birther',
    position: new Vector3(-15, -148, 190),
    zone: 'queen_chamber',
    scale: 0.8,
    rotationY: Math.PI / 3,
  },
  {
    type: 'birther',
    position: new Vector3(15, -148, 190),
    zone: 'queen_chamber',
    scale: 0.8,
    rotationY: -Math.PI / 3,
  },
  // Claw formations around arena perimeter
  {
    type: 'claw',
    position: new Vector3(-20, -148, 175),
    zone: 'queen_chamber',
    scale: 0.7,
    rotationY: Math.PI / 2,
  },
  {
    type: 'claw',
    position: new Vector3(20, -148, 175),
    zone: 'queen_chamber',
    scale: 0.7,
    rotationY: -Math.PI / 2,
  },
  {
    type: 'claw',
    position: new Vector3(-18, -148, 195),
    zone: 'queen_chamber',
    scale: 0.6,
    rotationY: Math.PI * 0.7,
  },
  {
    type: 'claw',
    position: new Vector3(18, -148, 195),
    zone: 'queen_chamber',
    scale: 0.6,
    rotationY: -Math.PI * 0.7,
  },
  // Crystal formations around chamber
  {
    type: 'crystals',
    position: new Vector3(-12, -148, 165),
    zone: 'queen_chamber',
    scale: 0.6,
    rotationY: Math.PI / 6,
  },
  {
    type: 'crystals',
    position: new Vector3(12, -148, 165),
    zone: 'queen_chamber',
    scale: 0.6,
    rotationY: -Math.PI / 6,
  },
  {
    type: 'undercrystal',
    position: new Vector3(0, -149, 170),
    zone: 'queen_chamber',
    scale: 0.5,
    rotationY: 0,
  },
  // Stomach structure -- digestive pit at the rear
  {
    type: 'stomach',
    position: new Vector3(8, -148, 202),
    zone: 'queen_chamber',
    scale: 0.7,
    rotationY: Math.PI * 0.4,
  },
  // Terraformer at chamber edges -- the hive reshaping rock
  {
    type: 'terraformer',
    position: new Vector3(-10, -148, 200),
    zone: 'queen_chamber',
    scale: 0.65,
    rotationY: Math.PI * 0.6,
  },
];

// ============================================================================
// ASSET LOADING
// ============================================================================

/**
 * Preload all station beam, modular detail, and organic growth GLBs needed for the level.
 * Call this during level initialization before placing assets.
 */
export async function loadBreachAssets(scene: Scene): Promise<void> {
  const loadPromises: Promise<unknown>[] = [];

  // Load station beams by path
  for (const path of Object.values(STATION_BEAM_PATHS)) {
    if (!AssetManager.isPathCached(path)) {
      loadPromises.push(AssetManager.loadAssetByPath(path, scene));
    }
  }

  // Load modular detail pieces by path
  for (const path of Object.values(MODULAR_DETAIL_PATHS)) {
    if (!AssetManager.isPathCached(path)) {
      loadPromises.push(AssetManager.loadAssetByPath(path, scene));
    }
  }

  // Load organic growth GLBs for beam decorations
  for (const path of BEAM_GROWTH_GLBS) {
    if (!AssetManager.isPathCached(path)) {
      loadPromises.push(AssetManager.loadAssetByPath(path, scene));
    }
  }

  // Load tendril GLBs for beam decorations
  for (const path of BEAM_TENDRIL_GLBS) {
    if (!AssetManager.isPathCached(path)) {
      loadPromises.push(AssetManager.loadAssetByPath(path, scene));
    }
  }

  // Load corrosion patch GLBs for detail decorations
  for (const path of CORROSION_PATCH_GLBS) {
    if (!AssetManager.isPathCached(path)) {
      loadPromises.push(AssetManager.loadAssetByPath(path, scene));
    }
  }

  await Promise.all(loadPromises);
  log.info('Station beam, modular detail, and organic growth assets loaded');
}

// ============================================================================
// ASSET PLACEMENT
// ============================================================================

/**
 * Place all hand-positioned station beam and modular detail GLB assets
 * throughout the three zones of The Breach.
 *
 * Each placed asset gets organic growth meshes attached to simulate
 * the hive absorbing human-built infrastructure.
 *
 * @returns Array of placed asset nodes for later disposal
 */
export function placeBreachAssets(scene: Scene): PlacedAsset[] {
  const placed: PlacedAsset[] = [];

  const allPlacements = [
    ...ENTRY_TUNNEL_PLACEMENTS,
    ...DEEP_HIVE_PLACEMENTS,
    ...QUEEN_CHAMBER_PLACEMENTS,
  ];

  for (let i = 0; i < allPlacements.length; i++) {
    const p = allPlacements[i];

    // Resolve path based on asset group
    const pathMap = p.assetGroup === 'beam' ? STATION_BEAM_PATHS : MODULAR_DETAIL_PATHS;
    const path = pathMap[p.assetKey];
    if (!path) {
      log.warn(`Unknown asset key: ${p.assetKey}`);
      continue;
    }

    const instanceName = `breach_${p.assetGroup}_${p.assetKey}_${i}`;
    const node = AssetManager.createInstanceByPath(path, instanceName, scene, true, 'environment');

    if (!node) {
      log.warn(`Failed to create instance for ${p.assetKey} at index ${i}`);
      continue;
    }

    // Apply transform
    node.position = p.position.clone();
    node.rotation = p.rotation.clone();
    node.scaling.setAll(p.scale);

    // Add organic growth overlay on beams (hive absorption effect)
    if (p.assetGroup === 'beam') {
      addOrganicGrowthToBeam(scene, node, p.zone);
    }

    // Add corrosion tint to detail plates in deep zones
    if (p.assetGroup === 'detail' && p.zone !== 'entry') {
      addCorrosionOverlay(scene, node, i);
    }

    placed.push({ node, type: p.assetKey, zone: p.zone });
  }

  log.info(`Placed ${placed.length} GLB assets across 3 zones`);
  return placed;
}

// ============================================================================
// ORGANIC GROWTH GLB PATHS
// ============================================================================

/** GLB paths for organic growths on beams (alien flora assets) */
const BEAM_GROWTH_GLBS = [
  '/assets/models/environment/alien-flora/alien_mushroom_01.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_03.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_05.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_07.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_common.glb',
] as const;

/** GLB paths for tendril-like growths on beams */
const BEAM_TENDRIL_GLBS = [
  '/assets/models/environment/alien-flora/alien_hanging_moss_01.glb',
  '/assets/models/environment/alien-flora/alien_fern_1.glb',
  '/assets/models/environment/alien-flora/alien_reed.glb',
] as const;

// ============================================================================
// ORGANIC GROWTH EFFECTS
// ============================================================================

/**
 * Add organic hive growth meshes on and around a station beam to simulate
 * the alien hive absorbing the human infrastructure.
 *
 * Uses GLB models from alien-flora for bulbous growths and tendrils,
 * with density increasing by zone.
 */
function addOrganicGrowthToBeam(
  scene: Scene,
  beamNode: TransformNode,
  zone: 'entry' | 'deep_hive' | 'queen_chamber'
): void {
  // More growth in deeper zones
  const growthCount = zone === 'entry' ? 2 : zone === 'deep_hive' ? 4 : 5;

  for (let i = 0; i < growthCount; i++) {
    const glbPath = BEAM_GROWTH_GLBS[i % BEAM_GROWTH_GLBS.length];

    if (!AssetManager.isPathCached(glbPath)) {
      log.warn(`[BreachEnvironment] Beam growth GLB not cached: ${glbPath}`);
      continue;
    }

    const growth = AssetManager.createInstanceByPath(
      glbPath,
      `growth_${beamNode.name}_${i}`,
      scene,
      false // No LOD for small decorations
    );

    if (!growth) {
      log.warn(`[BreachEnvironment] Failed to create beam growth instance: ${glbPath}`);
      continue;
    }

    // Scale based on zone depth (larger growths deeper in hive)
    const baseScale = zone === 'entry' ? 0.15 : zone === 'deep_hive' ? 0.25 : 0.35;
    const scale = baseScale + Math.random() * 0.15;
    growth.scaling.setAll(scale);

    growth.position.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 2
    );
    growth.rotation.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.4
    );
    growth.parent = beamNode;
  }

  // Add tendrils connecting to surrounding hive walls
  if (zone !== 'entry') {
    const tendrilCount = zone === 'deep_hive' ? 2 : 3;

    for (let t = 0; t < tendrilCount; t++) {
      const glbPath = BEAM_TENDRIL_GLBS[t % BEAM_TENDRIL_GLBS.length];

      if (!AssetManager.isPathCached(glbPath)) {
        log.warn(`[BreachEnvironment] Beam tendril GLB not cached: ${glbPath}`);
        continue;
      }

      const tendril = AssetManager.createInstanceByPath(
        glbPath,
        `tendril_${beamNode.name}_${t}`,
        scene,
        false
      );

      if (!tendril) {
        log.warn(`[BreachEnvironment] Failed to create beam tendril instance: ${glbPath}`);
        continue;
      }

      // Scale to approximate tendril dimensions
      const tendrilScale = 0.2 + Math.random() * 0.2;
      tendril.scaling.set(tendrilScale, tendrilScale * 1.5, tendrilScale);

      tendril.position.set(
        (Math.random() - 0.5) * 1.5,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 1.5
      );
      tendril.rotation.set(
        (Math.random() - 0.5) * 0.8,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.8
      );
      tendril.parent = beamNode;
    }
  }
}

/** GLB paths for corrosion patches (small glowing mushrooms) */
const CORROSION_PATCH_GLBS = [
  '/assets/models/environment/alien-flora/alien_mushroom_02.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_04.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_06.glb',
] as const;

/**
 * Add a dim corrosion/bioluminescent glow around a tech fragment that has
 * been sitting in the hive for a long time (deep hive and queen chamber).
 *
 * Uses GLB models for bioluminescent patches instead of MeshBuilder primitives.
 */
function addCorrosionOverlay(scene: Scene, detailNode: TransformNode, index: number): void {
  // Add a point light for eerie glow from corroded tech
  const glowLight = new PointLight(
    `corrosion_glow_${index}`,
    detailNode.position.clone(),
    scene
  );
  glowLight.diffuse = Color3.FromHexString('#2A8888');
  glowLight.intensity = 0.08 + Math.random() * 0.06;
  glowLight.range = 3;
  glowLight.parent = detailNode;

  // Small bioluminescent patch on the surface using alien mushroom GLB
  const glbPath = CORROSION_PATCH_GLBS[index % CORROSION_PATCH_GLBS.length];

  if (!AssetManager.isPathCached(glbPath)) {
    log.warn(`[BreachEnvironment] Corrosion patch GLB not cached: ${glbPath}`);
    return;
  }

  const patch = AssetManager.createInstanceByPath(
    glbPath,
    `corrosion_patch_${index}`,
    scene,
    false
  );

  if (!patch) {
    log.warn(`[BreachEnvironment] Failed to create corrosion patch instance: ${glbPath}`);
    return;
  }

  // Scale down for small patch appearance
  const scale = 0.08 + Math.random() * 0.06;
  patch.scaling.setAll(scale);

  patch.position.set(
    (Math.random() - 0.5) * 0.3,
    (Math.random() - 0.5) * 0.3,
    0.05
  );
  patch.rotation.set(
    (Math.random() - 0.5) * 0.3,
    Math.random() * Math.PI * 2,
    (Math.random() - 0.5) * 0.3
  );
  patch.parent = detailNode;
}

// ============================================================================
// DISPOSAL
// ============================================================================

/**
 * Dispose all placed breach environment assets.
 * Recursively disposes children (organic growths, tendrils, corrosion patches).
 */
export function disposeBreachAssets(assets: PlacedAsset[]): void {
  for (const asset of assets) {
    // Dispose children first (organic growths, lights, patches)
    const children = asset.node.getChildren();
    for (const child of children) {
      child.dispose();
    }
    asset.node.dispose();
  }
  log.info(`Disposed ${assets.length} placed assets`);
}
