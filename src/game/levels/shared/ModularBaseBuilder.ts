import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';

import { getLogger } from '../../core/Logger';

const log = getLogger('ModularBaseBuilder');

// ============================================================================
// MODULAR BASE BUILDER
// ============================================================================
// Generalizes the ModularStationBuilder pattern for damaged military bases.
// Supports damage overlays (wall holes), emergency/horror lighting modes, and
// prop scattering. Designed for levels like FOB Delta where players encounter
// an abandoned, battle-scarred outpost.
//
// Module dimensions (shared with station segments):
//   Length: 4.0 units (Y-axis per segment)
//   Width:  5.55 units (X-axis)
//   Height: 3.09 units (Z-axis, remapped to Y in Babylon)
// ============================================================================

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODULE_LENGTH = 4.0;
const _MODULE_WIDTH = 5.55;
const MODULE_HEIGHT = 3.09;

/** Spacing between ceiling lights along the corridor spine */
const _LIGHT_SPACING = MODULE_LENGTH * 2;

/** Maximum number of lights to avoid GPU saturation */
const MAX_LIGHTS = 32;

// ---------------------------------------------------------------------------
// Asset IDs -- map to entries in AssetManifest SHARED_ASSETS
// ---------------------------------------------------------------------------

const SEGMENT_ASSET_IDS: Record<BaseSegmentType, string> = {
  corridor: 'station/corridor_main',
  junction: 'station/corridor_junction',
  corner: 'station/corridor_corner',
  wide: 'station/corridor_wide',
};

/** Damaged wall variant swapped in based on damageRatio */
const DAMAGED_WALL_ASSET_ID = 'station/wall_hole';

/** Normal (intact) wall asset */
const INTACT_WALL_ASSET_ID = 'station/wall_double';

// ---------------------------------------------------------------------------
// Lighting colour presets
// ---------------------------------------------------------------------------

const LIGHTING_PRESETS: Record<LightingMode, LightingPreset> = {
  normal: {
    color: new Color3(0.9, 0.95, 1.0),
    intensity: 0.8,
    flickerBase: 0.0,
  },
  emergency: {
    color: new Color3(1.0, 0.25, 0.15),
    intensity: 0.6,
    flickerBase: 0.3,
  },
  horror: {
    color: new Color3(0.6, 0.55, 0.4),
    intensity: 0.35,
    flickerBase: 0.7,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BaseSegmentType = 'corridor' | 'junction' | 'corner' | 'wide';
export type LightingMode = 'normal' | 'emergency' | 'horror';

interface LightingPreset {
  color: Color3;
  intensity: number;
  /** Minimum flicker amount baked into this mode (before flickerIntensity) */
  flickerBase: number;
}

export interface DamageConfig {
  /** Percentage of wall segments that use the damaged (hole) variant, 0-1 */
  damageRatio: number;
  /** Overall lighting mood */
  lightingMode: LightingMode;
  /** Additional flicker intensity layered on top of the lighting mode, 0-1 */
  flickerIntensity: number;
}

export interface BaseSegment {
  /** World-space position of the segment origin */
  position: Vector3;
  /** Y-axis rotation in radians */
  rotation: number;
  /** Corridor geometry type */
  type: BaseSegmentType;
  /** When true, this segment uses the damaged wall variant regardless of damageRatio.
   *  When false, it uses the intact wall variant regardless of damageRatio.
   *  When undefined, the builder decides based on damageRatio. */
  damaged?: boolean;
}

export interface PropPlacement {
  /** Asset ID from the manifest (e.g. 'prop/barrel_1', 'prop/box') */
  assetId: string;
  /** World-space position */
  position: Vector3;
  /** Y-axis rotation in radians */
  rotation?: number;
  /** Uniform scale multiplier (default 1.0) */
  scale?: number;
}

export interface FlickerLight {
  light: PointLight;
  baseIntensity: number;
  flickerSpeed: number;
  /** Internal phase accumulator */
  timer: number;
}

export interface ModularBaseResult {
  root: TransformNode;
  meshes: Mesh[];
  lights: FlickerLight[];
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Seeded PRNG -- deterministic damage distribution from a layout
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function _hashSegment(seg: BaseSegment, index: number): number {
  // Simple hash combining position components and index
  return (
    ((seg.position.x * 73856093) ^
      (seg.position.y * 19349663) ^
      (seg.position.z * 83492791) ^
      (index * 48611)) |
    0
  );
}

// ---------------------------------------------------------------------------
// Main builder function
// ---------------------------------------------------------------------------

/**
 * Build a modular military base from corridor segments with damage, lighting,
 * and prop support.
 *
 * Uses the AssetManager singleton for all GLB loading and instancing. Assets
 * must be preloaded before calling this function (via `AssetManager.preloadLevel`
 * or `AssetManager.loadAssetByPath`). Missing assets are skipped with a warning.
 *
 * @param scene - Active BabylonJS scene
 * @param layout - Array of base segments defining the geometry
 * @param damageConfig - Controls damage ratio, lighting mode, and flicker
 * @param props - Optional array of prop placements to scatter in the base
 * @returns Promise resolving to a ModularBaseResult with root, meshes, lights, and dispose()
 */
export async function buildModularBase(
  scene: Scene,
  layout: BaseSegment[],
  damageConfig: DamageConfig,
  props?: PropPlacement[]
): Promise<ModularBaseResult> {
  const root = new TransformNode('ModularBase', scene);
  const allMeshes: Mesh[] = [];
  const flickerLights: FlickerLight[] = [];

  const preset = LIGHTING_PRESETS[damageConfig.lightingMode];
  const rng = seededRandom(layout.length * 7919);

  // ------------------------------------------------------------------
  // 1. Preload unique asset IDs referenced by segments and props
  // ------------------------------------------------------------------
  const requiredAssetIds = new Set<string>();

  for (const seg of layout) {
    requiredAssetIds.add(SEGMENT_ASSET_IDS[seg.type]);
  }

  // Always preload both wall variants when damage is possible
  if (damageConfig.damageRatio > 0) {
    requiredAssetIds.add(DAMAGED_WALL_ASSET_ID);
  }
  requiredAssetIds.add(INTACT_WALL_ASSET_ID);

  if (props) {
    for (const prop of props) {
      requiredAssetIds.add(prop.assetId);
    }
  }

  // Load all required assets in parallel
  const loadPromises = [...requiredAssetIds].map((assetId) => {
    const slashIdx = assetId.indexOf('/');
    if (slashIdx === -1) {
      return AssetManager.loadAssetByPath(assetId, scene);
    }
    const category = assetId.substring(0, slashIdx);
    const name = assetId.substring(slashIdx + 1);

    // Use path-based loading for station assets (they are typically raw-path assets)
    // and category-based loading for prop/enemy/vehicle assets
    if (category === 'station') {
      // Station assets are loaded by path through the pipeline; check if cached
      if (!AssetManager.isPathCached(getAssetPath(assetId))) {
        return AssetManager.loadAssetByPath(getAssetPath(assetId), scene);
      }
      return Promise.resolve(null);
    }
    // For props and other manifest-based assets, use category loading
    return AssetManager.loadAsset(
      category as 'props' | 'aliens' | 'vehicles' | 'structures',
      name,
      scene
    );
  });

  await Promise.all(loadPromises);

  // ------------------------------------------------------------------
  // 2. Instantiate corridor segments
  // ------------------------------------------------------------------
  let lightCount = 0;

  for (let i = 0; i < layout.length; i++) {
    const seg = layout[i];
    const assetId = SEGMENT_ASSET_IDS[seg.type];

    const instanceName = `base_seg_${i}_${seg.type}`;
    const instance = createAssetInstance(assetId, instanceName, scene);

    if (!instance) {
      log.warn(`Skipping segment ${i}: asset ${assetId} not available`);
      continue;
    }

    instance.position = seg.position.clone();
    instance.rotation = new Vector3(0, seg.rotation, 0);
    instance.parent = root;

    collectMeshes(instance, allMeshes);

    // Decide whether this segment gets a damaged wall overlay
    const isDamaged = resolveDamage(seg, damageConfig.damageRatio, rng, i);
    if (isDamaged) {
      const wallId = DAMAGED_WALL_ASSET_ID;
      const wallInstance = createAssetInstance(wallId, `base_wall_dmg_${i}`, scene);
      if (wallInstance) {
        wallInstance.position = seg.position.clone();
        wallInstance.rotation = new Vector3(0, seg.rotation, 0);
        wallInstance.parent = root;
        collectMeshes(wallInstance, allMeshes);
      }
    }

    // Place a light at every other segment (respecting MAX_LIGHTS)
    if (i % 2 === 0 && lightCount < MAX_LIGHTS) {
      const lightPos = seg.position.clone();
      lightPos.y += MODULE_HEIGHT * 0.85; // Near ceiling
      const fl = createFlickerLight(
        scene,
        `base_light_${i}`,
        lightPos,
        preset,
        damageConfig.flickerIntensity,
        root
      );
      flickerLights.push(fl);
      lightCount++;
    }
  }

  // ------------------------------------------------------------------
  // 3. Place props
  // ------------------------------------------------------------------
  if (props) {
    for (let p = 0; p < props.length; p++) {
      const prop = props[p];
      const instanceName = `base_prop_${p}`;
      const instance = createAssetInstance(prop.assetId, instanceName, scene);

      if (!instance) {
        log.warn(`Skipping prop ${p}: asset ${prop.assetId} not available`);
        continue;
      }

      instance.position = prop.position.clone();
      instance.rotation = new Vector3(0, prop.rotation ?? 0, 0);
      const s = prop.scale ?? 1.0;
      instance.scaling = new Vector3(s, s, s);
      instance.parent = root;

      collectMeshes(instance, allMeshes);
    }
  }

  log.info(
    `Built base: ${layout.length} segments, ` +
      `${flickerLights.length} lights, ${props?.length ?? 0} props, ` +
      `${allMeshes.length} total meshes`
  );

  // ------------------------------------------------------------------
  // 4. Assemble result
  // ------------------------------------------------------------------
  return {
    root,
    meshes: allMeshes,
    lights: flickerLights,
    dispose: () => {
      for (const fl of flickerLights) {
        fl.light.dispose();
      }
      for (const mesh of allMeshes) {
        mesh.dispose();
      }
      root.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Flicker light update (call each frame)
// ---------------------------------------------------------------------------

/**
 * Advance flicker timers and update light intensities.
 * Call this once per frame from the level's update loop.
 *
 * @param lights - Array of FlickerLight entries from ModularBaseResult.lights
 * @param deltaTime - Frame delta time in seconds
 */
export function updateFlickerLights(lights: FlickerLight[], deltaTime: number): void {
  for (const fl of lights) {
    if (fl.flickerSpeed <= 0) continue;

    fl.timer += deltaTime * fl.flickerSpeed;

    // Layer two sine waves at different frequencies for organic flicker
    const wave1 = Math.sin(fl.timer * 6.28);
    const wave2 = Math.sin(fl.timer * 15.71) * 0.3;
    const combined = (wave1 + wave2) * 0.5; // -0.65 .. +0.65

    // Map to intensity range: base +/- flickerAmount
    const flickerAmount = fl.baseIntensity * 0.4;
    fl.light.intensity = Math.max(0, fl.baseIntensity + combined * flickerAmount);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map a manifest asset id to its file path for path-based loading.
 * Station assets follow the convention: /models/environment/station/<name>.glb
 */
function getAssetPath(assetId: string): string {
  // For station/ prefixed ids, map to the environment/station path
  if (assetId.startsWith('station/')) {
    const name = assetId.substring('station/'.length);
    return `/assets/models/environment/station/${name}.glb`;
  }
  // For prop/ prefixed ids, map to the props/industrial path
  if (assetId.startsWith('prop/')) {
    const name = assetId.substring('prop/'.length);
    return `/assets/models/props/industrial/${name}.glb`;
  }
  // Fallback: treat the id itself as a path
  return assetId;
}

/**
 * Create an instance of an asset via AssetManager.
 * Tries path-based instancing first (for station/structural pieces),
 * then falls back to category-based instancing.
 */
function createAssetInstance(
  assetId: string,
  instanceName: string,
  scene: Scene
): TransformNode | null {
  const path = getAssetPath(assetId);

  // Try path-based first (station segments, structural pieces)
  if (AssetManager.isPathCached(path)) {
    return AssetManager.createInstanceByPath(path, instanceName, scene, true, 'environment');
  }

  // Try category-based (props, etc.)
  const slashIdx = assetId.indexOf('/');
  if (slashIdx !== -1) {
    const category = assetId.substring(0, slashIdx);
    const name = assetId.substring(slashIdx + 1);

    // Map manifest category prefix to AssetManager category
    const categoryMap: Record<string, 'props' | 'aliens' | 'vehicles' | 'structures'> = {
      prop: 'props',
      enemy: 'aliens',
      vehicle: 'vehicles',
      structure: 'structures',
    };

    const amCategory = categoryMap[category];
    if (amCategory && AssetManager.isCached(amCategory, name)) {
      return AssetManager.createInstance(amCategory, name, instanceName, scene, true);
    }
  }

  log.warn(`Asset not cached: ${assetId} (path: ${path})`);
  return null;
}

/**
 * Determine whether a segment should use the damaged wall variant.
 */
function resolveDamage(
  seg: BaseSegment,
  damageRatio: number,
  rng: () => number,
  _index: number
): boolean {
  // Explicit override takes precedence
  if (seg.damaged === true) return true;
  if (seg.damaged === false) return false;

  // Otherwise roll against the damage ratio
  return rng() < damageRatio;
}

/**
 * Recursively collect Mesh nodes from a TransformNode hierarchy.
 */
function collectMeshes(node: TransformNode, out: Mesh[]): void {
  // Check if the node itself is a Mesh (Mesh extends TransformNode)
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

/**
 * Create a single flickering point light parented under the given root.
 */
function createFlickerLight(
  scene: Scene,
  name: string,
  position: Vector3,
  preset: LightingPreset,
  flickerIntensity: number,
  parent: TransformNode
): FlickerLight {
  const light = new PointLight(name, position, scene);
  light.diffuse = preset.color.clone();
  light.specular = preset.color.scale(0.3);
  light.intensity = preset.intensity;
  light.range = MODULE_LENGTH * 3;
  light.parent = parent;

  // Combine the mode's base flicker with the user-specified intensity
  const effectiveFlicker = Math.min(1, preset.flickerBase + flickerIntensity);

  return {
    light,
    baseIntensity: preset.intensity,
    flickerSpeed: effectiveFlicker > 0 ? 1.0 + effectiveFlicker * 3.0 : 0,
    timer: Math.random() * Math.PI * 2, // Random phase offset
  };
}
