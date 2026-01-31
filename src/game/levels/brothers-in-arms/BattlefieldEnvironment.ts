/**
 * BattlefieldEnvironment - GLB-based battlefield construction for Brothers in Arms
 *
 * Replaces the old MeshBuilder rock pillars with hand-placed GLB assets that
 * create a Halo Reach "Tip of the Spear" style open battlefield:
 *
 * LAYOUT CONCEPT (top-down, North = -Z toward Breach):
 *
 *   ==================== NORTH WALL (canyon) ====================
 *   |                                                            |
 *   |  [station wreck]          BREACH (100m dia)   [water tower]|
 *   |                     ---- sinkhole ----                     |
 *   |                                                            |
 *   |    FAR COVER RING (~60-70m from center)                    |
 *   |    [barricade]  [boiler]  [platform]  [barricade]          |
 *   |                                                            |
 *   |    MID COVER RING (~30-40m)                                |
 *   |    [crates] [barricade] [container] [barricade] [crates]   |
 *   |                                                            |
 *   |    =========== MARCUS RALLY POINT (0, 0, 10) ===========  |
 *   |    [supply] [fortification ring] [supply]                  |
 *   |                                                            |
 *   |    CLOSE COVER (~10-20m)                                   |
 *   |    [barricade] [debris] [barricade]                        |
 *   |                                                            |
 *   |                  PLAYER START (0, 1.7, 50)                 |
 *   ==================== SOUTH WALL (canyon) ====================
 *
 * COVER DISTANCES:
 *   Close:  10-20m from center  - emergency fallback near Marcus
 *   Mid:    30-40m from center  - primary engagement range
 *   Far:    55-70m from center  - forward/flanking positions near breach
 *
 * All GLB IDs reference entries in brothers-in-arms.ts asset manifest.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';

// ============================================================================
// TYPES
// ============================================================================

export interface BattlefieldResult {
  /** Root transform node containing all placed GLB instances */
  root: TransformNode;
  /** All meshes created (for disposal) */
  meshes: Mesh[];
  /** Lights created for fire effects */
  lights: PointLight[];
  /** Supply crate positions (for gameplay item pickups) */
  supplyCratePositions: Vector3[];
  /** Dispose all battlefield assets */
  dispose: () => void;
}

interface GLBPlacement {
  /** Asset path relative to public root */
  path: string;
  /** World position */
  position: Vector3;
  /** Y-axis rotation in radians */
  rotationY: number;
  /** Uniform scale (default 1.0) */
  scale: number;
  /** Display name for debug logging */
  label: string;
}

// ============================================================================
// ASSET PATHS
// ============================================================================

const PATHS = {
  // Barricades (military defensive cover)
  barricade_b1: '/models/props/modular/barricade_b_1.glb',
  barricade_b2: '/models/props/modular/barricade_b_2.glb',
  barricade_b3: '/models/props/modular/barricade_b_3.glb',
  barricade_b4: '/models/props/modular/barricade_b_4.glb',
  barricade_a1: '/models/props/modular/barricade_a_1.glb',
  barricade_a2: '/models/props/modular/barricade_a_2.glb',

  // Industrial structures (battlefield landmarks)
  water_tower: '/models/environment/industrial/water_tower_hm_1.glb',
  platform: '/models/environment/industrial/platform_mx_1.glb',
  boiler: '/models/environment/industrial/boiler_hx_4.glb',
  storage_tank: '/models/environment/industrial/storage_tank_mx_1.glb',
  shipping_container: '/models/environment/industrial/shipping_container_mx_1.glb',
  shipping_container_hollow: '/models/environment/industrial/shipping_container_mx_1_hollow_1.glb',

  // Station external (burning wreckage on horizon)
  station_wreck: '/models/environment/station-external/station03.glb',

  // Decal posters (military propaganda on barricades)
  poster_5: '/models/props/decals/poster_cx_5.glb',
  poster_9: '/models/props/decals/poster_cx_9.glb',

  // Props (supply crates, debris)
  wooden_crate: '/models/props/containers/wooden_crate_1.glb',
  metal_barrel: '/models/props/containers/metal_barrel_hr_1.glb',
  metal_barrel_2: '/models/props/containers/metal_barrel_hr_2.glb',
  scrap_metal: '/models/props/containers/scrap_metal_mx_1.glb',
  gravel_pile: '/models/props/debris/gravel_pile_hr_2.glb',
  bricks_stacked: '/models/props/debris/bricks_stacked_mx_1.glb',
  cement_bags: '/models/props/containers/cement_bags_mp_1_pallet_1.glb',
  jerrycan: '/models/props/containers/jerrycan_mx_1.glb',
  tire: '/models/props/containers/tire_1.glb',
  toolbox: '/models/props/containers/toolbox_mx_1.glb',

  // Fencing / perimeter
  concrete_fence: '/models/props/modular/concrete_fence_hr_1.glb',
  metal_fence: '/models/props/modular/metal_fence_hr_1.glb',
} as const;

// ============================================================================
// PLACEMENT DATA
// ============================================================================

/**
 * All GLB placements organized by battlefield zone. Angles in radians;
 * 0 = facing +Z (south toward player start), Math.PI = facing north toward breach.
 *
 * Cover philosophy:
 * - Close (10-20m): Fallback positions for emergencies
 * - Mid (25-40m): Primary engagement range, most cover
 * - Far (55-70m): Forward/flanking positions near breach
 * - Fortification (around Marcus): Central defensive ring
 */
function getBattlefieldPlacements(): GLBPlacement[] {
  const placements: GLBPlacement[] = [];

  // Validate we have reasonable spacing - placements should not overlap
  const validatePlacement = (pos: Vector3, existingPlacements: GLBPlacement[]): boolean => {
    const MIN_SPACING = 5; // Minimum 5m between placements
    for (const p of existingPlacements) {
      if (Vector3.Distance(pos, p.position) < MIN_SPACING) {
        return false;
      }
    }
    return true;
  };

  // -----------------------------------------------------------------------
  // FAR COVER RING (55-70m from center, near breach)
  // These positions offer forward/flanking positions for aggressive play
  // -----------------------------------------------------------------------

  // Water tower (NE landmark, elevated sightline)
  placements.push({
    path: PATHS.water_tower,
    position: new Vector3(55, 0, -45),
    rotationY: 0.3,
    scale: 1.2,
    label: 'water_tower_ne',
  });

  // Boiler structure (NW landmark)
  placements.push({
    path: PATHS.boiler,
    position: new Vector3(-50, 0, -40),
    rotationY: -0.4,
    scale: 1.5,
    label: 'boiler_nw',
  });

  // Industrial platform (N, partially overlooking breach)
  placements.push({
    path: PATHS.platform,
    position: new Vector3(15, 0, -50),
    rotationY: Math.PI * 0.5,
    scale: 1.3,
    label: 'platform_n',
  });

  // Far barricade NE (angled to create cover facing west)
  placements.push({
    path: PATHS.barricade_b4,
    position: new Vector3(40, 0, -35),
    rotationY: Math.PI * 0.25,
    scale: 1.8,
    label: 'far_barricade_ne',
  });

  // Far barricade NW (angled to create cover facing east)
  placements.push({
    path: PATHS.barricade_b3,
    position: new Vector3(-35, 0, -30),
    rotationY: -Math.PI * 0.25,
    scale: 1.8,
    label: 'far_barricade_nw',
  });

  // Storage tank (far east, creates line-of-sight break)
  placements.push({
    path: PATHS.storage_tank,
    position: new Vector3(65, 0, -20),
    rotationY: 0.6,
    scale: 1.0,
    label: 'storage_tank_e',
  });

  // -----------------------------------------------------------------------
  // MID COVER RING (25-40m from center)
  // Primary engagement distance -- most combat happens here
  // -----------------------------------------------------------------------

  // Shipping container (E side, solid cover)
  placements.push({
    path: PATHS.shipping_container,
    position: new Vector3(35, 0, -5),
    rotationY: Math.PI * 0.15,
    scale: 1.0,
    label: 'container_e',
  });

  // Hollow shipping container (W side, player can move through)
  placements.push({
    path: PATHS.shipping_container_hollow,
    position: new Vector3(-30, 0, 0),
    rotationY: -Math.PI * 0.1,
    scale: 1.0,
    label: 'container_hollow_w',
  });

  // Mid barricade E (diagonal cover wall)
  placements.push({
    path: PATHS.barricade_b1,
    position: new Vector3(25, 0, 10),
    rotationY: Math.PI * 0.3,
    scale: 2.0,
    label: 'mid_barricade_e',
  });

  // Mid barricade W (diagonal cover wall)
  placements.push({
    path: PATHS.barricade_b2,
    position: new Vector3(-22, 0, 15),
    rotationY: -Math.PI * 0.3,
    scale: 2.0,
    label: 'mid_barricade_w',
  });

  // Mid barricade NE (forward fighting position)
  placements.push({
    path: PATHS.barricade_a1,
    position: new Vector3(18, 0, -15),
    rotationY: 0,
    scale: 2.2,
    label: 'mid_barricade_ne',
  });

  // Mid barricade NW (forward fighting position)
  placements.push({
    path: PATHS.barricade_a2,
    position: new Vector3(-15, 0, -12),
    rotationY: Math.PI,
    scale: 2.2,
    label: 'mid_barricade_nw',
  });

  // Crate cluster E (supply pickup area)
  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(40, 0, 15),
    rotationY: 0.5,
    scale: 2.0,
    label: 'crate_cluster_e1',
  });
  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(43, 0, 17),
    rotationY: 1.2,
    scale: 1.8,
    label: 'crate_cluster_e2',
  });

  // Crate cluster W (supply pickup area)
  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(-38, 0, 12),
    rotationY: -0.3,
    scale: 2.0,
    label: 'crate_cluster_w1',
  });
  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(-35, 0, 14),
    rotationY: 0.8,
    scale: 1.8,
    label: 'crate_cluster_w2',
  });

  // Cement bag piles (partial cover between mid barricades)
  placements.push({
    path: PATHS.cement_bags,
    position: new Vector3(5, 0, -8),
    rotationY: 0.2,
    scale: 2.5,
    label: 'cement_bags_center_n',
  });

  // -----------------------------------------------------------------------
  // MARCUS RALLY POINT / CENTRAL FORTIFICATION (around 0, 0, 10)
  // Defensive ring where Marcus's mech operates
  // -----------------------------------------------------------------------

  // Fortification ring -- barricades forming a horseshoe around Marcus
  placements.push({
    path: PATHS.barricade_b3,
    position: new Vector3(-10, 0, 5),
    rotationY: Math.PI * 0.5,
    scale: 1.6,
    label: 'fort_barricade_w',
  });
  placements.push({
    path: PATHS.barricade_b4,
    position: new Vector3(10, 0, 5),
    rotationY: -Math.PI * 0.5,
    scale: 1.6,
    label: 'fort_barricade_e',
  });
  placements.push({
    path: PATHS.barricade_b1,
    position: new Vector3(0, 0, 0),
    rotationY: 0,
    scale: 1.6,
    label: 'fort_barricade_n',
  });

  // Supply crates near Marcus (ammo/health pickups)
  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(-8, 0, 12),
    rotationY: 0.4,
    scale: 1.5,
    label: 'supply_crate_w',
  });
  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(8, 0, 12),
    rotationY: -0.4,
    scale: 1.5,
    label: 'supply_crate_e',
  });

  // Metal barrels at fortification (explosive hazard flavor)
  placements.push({
    path: PATHS.metal_barrel,
    position: new Vector3(-6, 0, 3),
    rotationY: 0,
    scale: 2.0,
    label: 'barrel_fort_1',
  });
  placements.push({
    path: PATHS.metal_barrel_2,
    position: new Vector3(7, 0, 2),
    rotationY: 1.0,
    scale: 2.0,
    label: 'barrel_fort_2',
  });

  // Jerrycans scattered near fortification
  placements.push({
    path: PATHS.jerrycan,
    position: new Vector3(-4, 0, 8),
    rotationY: 2.1,
    scale: 2.5,
    label: 'jerrycan_1',
  });
  placements.push({
    path: PATHS.jerrycan,
    position: new Vector3(5, 0, 9),
    rotationY: 0.7,
    scale: 2.5,
    label: 'jerrycan_2',
  });

  // Toolbox near Marcus (repair supplies lore)
  placements.push({
    path: PATHS.toolbox,
    position: new Vector3(12, 0, 8),
    rotationY: -0.5,
    scale: 2.0,
    label: 'toolbox_marcus',
  });

  // -----------------------------------------------------------------------
  // CLOSE COVER (10-20m from center, near player start)
  // Emergency fallback positions
  // -----------------------------------------------------------------------

  // Close barricade SE
  placements.push({
    path: PATHS.barricade_b2,
    position: new Vector3(15, 0, 30),
    rotationY: Math.PI * 0.15,
    scale: 1.8,
    label: 'close_barricade_se',
  });

  // Close barricade SW
  placements.push({
    path: PATHS.barricade_b1,
    position: new Vector3(-18, 0, 35),
    rotationY: -Math.PI * 0.1,
    scale: 1.8,
    label: 'close_barricade_sw',
  });

  // Close barricade center (between player spawn and Marcus)
  placements.push({
    path: PATHS.barricade_b3,
    position: new Vector3(0, 0, 25),
    rotationY: 0,
    scale: 1.6,
    label: 'close_barricade_center',
  });

  // -----------------------------------------------------------------------
  // VEHICLE DEBRIS (scattered wreckage across battlefield)
  // Tells the story of a battle already fought here
  // -----------------------------------------------------------------------

  // Scrap metal debris (multiple scattered pieces)
  placements.push({
    path: PATHS.scrap_metal,
    position: new Vector3(28, 0, -25),
    rotationY: 1.5,
    scale: 3.0,
    label: 'scrap_debris_1',
  });
  placements.push({
    path: PATHS.scrap_metal,
    position: new Vector3(-45, 0, 20),
    rotationY: 0.8,
    scale: 2.5,
    label: 'scrap_debris_2',
  });
  placements.push({
    path: PATHS.scrap_metal,
    position: new Vector3(50, 0, 30),
    rotationY: -1.2,
    scale: 3.5,
    label: 'scrap_debris_3',
  });

  // Tires (from destroyed vehicles)
  placements.push({
    path: PATHS.tire,
    position: new Vector3(20, 0, 40),
    rotationY: 0.3,
    scale: 2.0,
    label: 'tire_1',
  });
  placements.push({
    path: PATHS.tire,
    position: new Vector3(-25, 0, -20),
    rotationY: 1.8,
    scale: 2.0,
    label: 'tire_2',
  });

  // Gravel piles (from explosions / construction)
  placements.push({
    path: PATHS.gravel_pile,
    position: new Vector3(10, 0, 35),
    rotationY: 0.5,
    scale: 2.0,
    label: 'gravel_1',
  });
  placements.push({
    path: PATHS.gravel_pile,
    position: new Vector3(-40, 0, -15),
    rotationY: -0.3,
    scale: 1.8,
    label: 'gravel_2',
  });

  // Brick stacks (fortification materials)
  placements.push({
    path: PATHS.bricks_stacked,
    position: new Vector3(-12, 0, 20),
    rotationY: 0.2,
    scale: 2.5,
    label: 'bricks_1',
  });
  placements.push({
    path: PATHS.bricks_stacked,
    position: new Vector3(30, 0, 22),
    rotationY: -0.6,
    scale: 2.5,
    label: 'bricks_2',
  });

  // Metal barrels (scattered across field)
  placements.push({
    path: PATHS.metal_barrel,
    position: new Vector3(-55, 0, -10),
    rotationY: 0.4,
    scale: 2.0,
    label: 'barrel_field_1',
  });
  placements.push({
    path: PATHS.metal_barrel_2,
    position: new Vector3(48, 0, -30),
    rotationY: -0.8,
    scale: 2.0,
    label: 'barrel_field_2',
  });

  // -----------------------------------------------------------------------
  // STATION WRECKAGE (horizon set dressing)
  // Burning station visible in the distance
  // -----------------------------------------------------------------------

  placements.push({
    path: PATHS.station_wreck,
    position: new Vector3(-80, 8, -70),
    rotationY: Math.PI * 0.7,
    scale: 3.0,
    label: 'station_wreck_nw',
  });

  // -----------------------------------------------------------------------
  // PERIMETER FENCING (partial, battle-damaged)
  // Defines the arena boundary feel without blocking gameplay
  // -----------------------------------------------------------------------

  // South perimeter (behind player start)
  placements.push({
    path: PATHS.concrete_fence,
    position: new Vector3(-25, 0, 55),
    rotationY: 0,
    scale: 2.0,
    label: 'fence_s1',
  });
  placements.push({
    path: PATHS.concrete_fence,
    position: new Vector3(25, 0, 55),
    rotationY: 0,
    scale: 2.0,
    label: 'fence_s2',
  });
  placements.push({
    path: PATHS.metal_fence,
    position: new Vector3(0, 0, 60),
    rotationY: 0,
    scale: 2.0,
    label: 'fence_s3',
  });

  // East perimeter fragments (more coverage)
  placements.push({
    path: PATHS.metal_fence,
    position: new Vector3(75, 0, 15),
    rotationY: Math.PI * 0.5,
    scale: 2.0,
    label: 'fence_e1',
  });
  placements.push({
    path: PATHS.metal_fence,
    position: new Vector3(75, 0, -5),
    rotationY: Math.PI * 0.5,
    scale: 2.0,
    label: 'fence_e2',
  });
  placements.push({
    path: PATHS.concrete_fence,
    position: new Vector3(75, 0, -25),
    rotationY: Math.PI * 0.5,
    scale: 2.0,
    label: 'fence_e3',
  });

  // West perimeter fragments (more coverage)
  placements.push({
    path: PATHS.concrete_fence,
    position: new Vector3(-75, 0, 10),
    rotationY: Math.PI * 0.5,
    scale: 2.0,
    label: 'fence_w1',
  });
  placements.push({
    path: PATHS.metal_fence,
    position: new Vector3(-75, 0, -10),
    rotationY: Math.PI * 0.5,
    scale: 2.0,
    label: 'fence_w2',
  });
  placements.push({
    path: PATHS.concrete_fence,
    position: new Vector3(-75, 0, -30),
    rotationY: Math.PI * 0.5,
    scale: 2.0,
    label: 'fence_w3',
  });

  // -----------------------------------------------------------------------
  // ADDITIONAL COVER NEAR PLAYER SPAWN (emergency fallback)
  // -----------------------------------------------------------------------

  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(5, 0, 45),
    rotationY: 0.2,
    scale: 1.8,
    label: 'spawn_crate_1',
  });
  placements.push({
    path: PATHS.wooden_crate,
    position: new Vector3(-8, 0, 48),
    rotationY: -0.3,
    scale: 1.6,
    label: 'spawn_crate_2',
  });

  // -----------------------------------------------------------------------
  // DECAL POSTERS (military propaganda on barricades)
  // -----------------------------------------------------------------------

  placements.push({
    path: PATHS.poster_5,
    position: new Vector3(25.3, 1.2, 10),
    rotationY: Math.PI * 0.3,
    scale: 1.0,
    label: 'poster_mid_e',
  });
  placements.push({
    path: PATHS.poster_9,
    position: new Vector3(-22.3, 1.2, 15),
    rotationY: -Math.PI * 0.3,
    scale: 1.0,
    label: 'poster_mid_w',
  });
  placements.push({
    path: PATHS.poster_5,
    position: new Vector3(10.2, 1.0, 5),
    rotationY: -Math.PI * 0.5,
    scale: 1.0,
    label: 'poster_fort_e',
  });
  placements.push({
    path: PATHS.poster_9,
    position: new Vector3(-10.2, 1.0, 5),
    rotationY: Math.PI * 0.5,
    scale: 1.0,
    label: 'poster_fort_w',
  });

  return placements;
}

// ============================================================================
// SUPPLY CRATE POSITIONS (gameplay hooks)
// ============================================================================

/**
 * Positions where ammo/health supply crates can be placed by the level logic.
 * These sit next to barricades and fortification points.
 * Distributed across all cover rings for consistent resupply opportunity.
 */
const SUPPLY_CRATE_POSITIONS: Vector3[] = [
  // Near Marcus fortification (central safe zone)
  new Vector3(-8, 0.5, 12),
  new Vector3(8, 0.5, 12),
  new Vector3(0, 0.5, 8),
  // Mid ring supply stashes (primary engagement zone)
  new Vector3(40, 0.5, 15),
  new Vector3(-38, 0.5, 12),
  new Vector3(25, 0.5, 5),
  new Vector3(-22, 0.5, 10),
  // Close cover area (near player spawn)
  new Vector3(15, 0.5, 30),
  new Vector3(-18, 0.5, 35),
  new Vector3(0, 0.5, 40),
  // Forward position near breach (high risk / high reward)
  new Vector3(18, 0.5, -15),
  new Vector3(-15, 0.5, -12),
  new Vector3(35, 0.5, -25),
  new Vector3(-30, 0.5, -20),
];

// ============================================================================
// BUILDER
// ============================================================================

/**
 * Load all GLB assets and build the battlefield environment.
 *
 * The function:
 * 1. Collects all unique asset paths from the placement data
 * 2. Loads them in parallel via AssetManager.loadAssetByPath
 * 3. Creates positioned instances for each placement
 * 4. Adds fire/smoke lights on the station wreckage
 * 5. Returns a BattlefieldResult with disposal support
 *
 * @param scene - Active BabylonJS scene
 * @returns Promise resolving to BattlefieldResult
 */
export async function buildBattlefieldEnvironment(
  scene: Scene
): Promise<BattlefieldResult> {
  const root = new TransformNode('BattlefieldEnvironment', scene);
  const allMeshes: Mesh[] = [];
  const allLights: PointLight[] = [];

  const placements = getBattlefieldPlacements();

  // ------------------------------------------------------------------
  // 1. Collect unique asset paths
  // ------------------------------------------------------------------
  const uniquePaths = new Set<string>();
  for (const p of placements) {
    uniquePaths.add(p.path);
  }

  // ------------------------------------------------------------------
  // 2. Load all assets in parallel
  // ------------------------------------------------------------------
  const loadPromises = [...uniquePaths].map(async (assetPath) => {
    try {
      if (!AssetManager.isPathCached(assetPath)) {
        await AssetManager.loadAssetByPath(assetPath, scene);
      }
    } catch (err) {
      console.warn(`[BattlefieldEnvironment] Failed to load: ${assetPath}`, err);
    }
  });

  await Promise.all(loadPromises);

  console.log(
    `[BattlefieldEnvironment] Loaded ${uniquePaths.size} unique assets, ` +
      `placing ${placements.length} instances`
  );

  // ------------------------------------------------------------------
  // 3. Create instances for each placement
  // ------------------------------------------------------------------
  let placed = 0;
  let skipped = 0;

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];

    if (!AssetManager.isPathCached(p.path)) {
      skipped++;
      continue;
    }

    const instance = AssetManager.createInstanceByPath(
      p.path,
      `bf_${p.label}_${i}`,
      scene,
      true,
      'environment'
    );

    if (!instance) {
      skipped++;
      continue;
    }

    instance.position = p.position.clone();
    instance.rotation = new Vector3(0, p.rotationY, 0);
    instance.scaling = new Vector3(p.scale, p.scale, p.scale);
    instance.parent = root;

    // Collect meshes for disposal
    collectMeshes(instance, allMeshes);
    placed++;
  }

  console.log(
    `[BattlefieldEnvironment] Placed ${placed} instances, skipped ${skipped}`
  );

  // ------------------------------------------------------------------
  // 4. Fire effects on station wreckage
  // ------------------------------------------------------------------
  const wreckFireLight = new PointLight(
    'wreckFire',
    new Vector3(-80, 14, -70),
    scene
  );
  wreckFireLight.diffuse = Color3.FromHexString('#FF6A20');
  wreckFireLight.specular = Color3.FromHexString('#FF4400');
  wreckFireLight.intensity = 2.0;
  wreckFireLight.range = 40;
  wreckFireLight.parent = root;
  allLights.push(wreckFireLight);

  // Secondary smaller fire
  const wreckFireLight2 = new PointLight(
    'wreckFire2',
    new Vector3(-75, 10, -65),
    scene
  );
  wreckFireLight2.diffuse = Color3.FromHexString('#FF8800');
  wreckFireLight2.intensity = 1.0;
  wreckFireLight2.range = 20;
  wreckFireLight2.parent = root;
  allLights.push(wreckFireLight2);

  // ------------------------------------------------------------------
  // 5. Validate asset loading - FAIL FAST if too many assets failed
  // ------------------------------------------------------------------
  if (skipped > placements.length * 0.5) {
    throw new Error(
      '[BattlefieldEnvironment] FATAL: Many assets failed to load. Cannot create battlefield environment.'
    );
  }

  // ------------------------------------------------------------------
  // 6. Assemble result
  // ------------------------------------------------------------------
  return {
    root,
    meshes: allMeshes,
    lights: allLights,
    supplyCratePositions: SUPPLY_CRATE_POSITIONS.map((p) => p.clone()),
    dispose: () => {
      for (const light of allLights) {
        light.dispose();
      }
      for (const mesh of allMeshes) {
        if (!mesh.isDisposed()) {
          mesh.dispose();
        }
      }
      root.dispose();
    },
  };
}

/**
 * Update fire light flickering. Call once per frame.
 */
export function updateBattlefieldLights(
  lights: PointLight[],
  _deltaTime: number
): void {
  const time = performance.now() * 0.001;
  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    // Organic fire flicker using layered sine waves
    const flicker1 = Math.sin(time * 8.0 + i * 1.3) * 0.3;
    const flicker2 = Math.sin(time * 13.7 + i * 2.7) * 0.15;
    const flicker3 = Math.sin(time * 3.1 + i * 0.9) * 0.1;
    const baseIntensity = i === 0 ? 2.0 : 1.0;
    light.intensity = Math.max(0.3, baseIntensity + flicker1 + flicker2 + flicker3);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Recursively collect Mesh nodes from a TransformNode hierarchy.
 */
function collectMeshes(node: TransformNode, out: Mesh[]): void {
  if ('geometry' in node && node.constructor.name !== 'TransformNode') {
    out.push(node as unknown as Mesh);
  }
  const children = node.getChildren();
  for (const child of children) {
    if (child instanceof TransformNode) {
      collectMeshes(child, out);
    }
  }
}

