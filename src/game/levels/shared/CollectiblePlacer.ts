/**
 * CollectiblePlacer - Reusable collectible / discovery item placement system
 *
 * Provides a shared system for placing and managing collectible items across
 * all outdoor and indoor levels. Each collectible is loaded from a GLB model,
 * given a type-specific glow light, and animated with a gentle floating bob
 * and slow rotation.
 *
 * Usage:
 *   import { buildCollectibles, getLandfallCollectibles } from './shared/CollectiblePlacer';
 *   const result = await buildCollectibles(scene, getLandfallCollectibles(), envRoot);
 *   // In update loop:
 *   const nearby = result.update(playerPos, dt);
 *   if (nearby && playerPressedInteract) result.collect(nearby.id);
 *   // On dispose:
 *   result.dispose();
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/loaders/glTF';

import { getLogger } from '../../core/Logger';

const log = getLogger('CollectiblePlacer');

// ============================================================================
// TYPES
// ============================================================================

export type CollectibleType =
  | 'data_pad'
  | 'audio_log'
  | 'weapon_cache'
  | 'alien_artifact'
  | 'supply_drop';

export interface CollectiblePlacement {
  type: CollectibleType;
  position: Vector3;
  rotationY: number;
  /** Unique ID for save system tracking */
  id: string;
  /** Optional display name shown on HUD when nearby */
  displayName?: string;
  /** Pickup radius in meters (default 2.5) */
  pickupRadius?: number;
}

export interface PlacedCollectible {
  placement: CollectiblePlacement;
  rootNode: TransformNode;
  /** Meshes for raycasting/interaction */
  meshes: AbstractMesh[];
  /** Whether this collectible has been collected in this session */
  collected: boolean;
  /** Glow light for visibility */
  glowLight: PointLight;
}

export interface CollectibleSystemResult {
  collectibles: PlacedCollectible[];
  /** Call each frame to update hover animations and proximity detection */
  update(playerPosition: Vector3, deltaTime: number): CollectiblePlacement | null;
  /** Collect a specific item (removes from world, marks collected) */
  collect(id: string): void;
  /** Get all uncollected items */
  getRemaining(): CollectiblePlacement[];
  /** Dispose all */
  dispose(): void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** GLB paths for each collectible type */
const COLLECTIBLE_PATHS: Record<CollectibleType, string> = {
  data_pad: '/assets/models/props/collectibles/data_pad.glb',
  audio_log: '/assets/models/props/collectibles/audio_log.glb',
  weapon_cache: '/assets/models/props/collectibles/weapon_cache.glb',
  alien_artifact: '/assets/models/props/collectibles/alien_artifact.glb',
  supply_drop: '/assets/models/props/collectibles/supply_drop.glb',
};

/** Glow colors per type */
const GLOW_COLORS: Record<CollectibleType, Color3> = {
  data_pad: new Color3(0.3, 0.5, 1.0), // blue
  audio_log: new Color3(0.2, 0.9, 0.3), // green
  weapon_cache: new Color3(1.0, 0.75, 0.2), // amber
  alien_artifact: new Color3(0.7, 0.2, 1.0), // purple
  supply_drop: new Color3(1.0, 0.5, 0.1), // orange
};

/** Default pickup radius in meters */
const DEFAULT_PICKUP_RADIUS = 2.5;

/** Bobbing amplitude in meters */
const BOB_AMPLITUDE = 0.3;

/** Bobbing period in seconds */
const BOB_PERIOD = 2.0;

/** Rotation speed in radians per second (~30 degrees/s) */
const ROTATION_SPEED = (30 * Math.PI) / 180;

/** Uniform scale applied to all collectible meshes */
const COLLECTIBLE_SCALE = 0.65;

/** Point light intensity for the glow */
const GLOW_INTENSITY = 0.6;

/** Point light range in meters */
const GLOW_RANGE = 6;

// ============================================================================
// BUILDER
// ============================================================================

/**
 * Load collectible GLB assets and create placed instances in the scene.
 *
 * Each unique collectible type is loaded once via `SceneLoader.ImportMeshAsync`.
 * Subsequent placements of the same type clone the original loaded meshes.
 *
 * @param scene      - Active BabylonJS scene
 * @param placements - Array of placement descriptors
 * @param parent     - Parent TransformNode to attach all collectibles under
 * @returns Promise resolving to the full collectible system (update, collect, dispose)
 */
export async function buildCollectibles(
  scene: Scene,
  placements: CollectiblePlacement[],
  parent: TransformNode
): Promise<CollectibleSystemResult> {
  // ------------------------------------------------------------------
  // 1. Determine which types we need to load
  // ------------------------------------------------------------------
  const typesNeeded = new Set<CollectibleType>();
  for (const p of placements) {
    typesNeeded.add(p.type);
  }

  // ------------------------------------------------------------------
  // 2. Load each unique type once
  // ------------------------------------------------------------------
  const templateRoots = new Map<CollectibleType, TransformNode>();
  const templateMeshes = new Map<CollectibleType, AbstractMesh[]>();

  const loadPromises = [...typesNeeded].map(async (type) => {
    const path = COLLECTIBLE_PATHS[type];
    try {
      const result = await SceneLoader.ImportMeshAsync('', path, '', scene);
      // Wrap all imported meshes under a single hidden template root
      const templateRoot = new TransformNode(`__collectible_template_${type}`, scene);
      templateRoot.setEnabled(false);

      for (const mesh of result.meshes) {
        if (!mesh.parent) {
          mesh.parent = templateRoot;
        }
      }

      templateRoots.set(type, templateRoot);
      templateMeshes.set(type, result.meshes);
    } catch (err) {
      log.warn(`Failed to load ${type} from ${path}:`, err);
    }
  });

  await Promise.all(loadPromises);

  // ------------------------------------------------------------------
  // 3. Clone templates for each placement
  // ------------------------------------------------------------------
  const placedCollectibles: PlacedCollectible[] = [];

  /** Internal per-instance animation state */
  const animStates: { baseY: number; elapsed: number }[] = [];

  for (let i = 0; i < placements.length; i++) {
    const placement = placements[i];
    const template = templateRoots.get(placement.type);

    if (!template) {
      log.warn(`No template for type "${placement.type}", skipping placement "${placement.id}"`);
      continue;
    }

    // Clone the template hierarchy
    const cloneName = `collectible_${placement.id}`;
    const clone = template.clone(cloneName, parent);
    if (!clone) {
      log.warn(`Clone failed for "${placement.id}"`);
      continue;
    }

    clone.setEnabled(true);
    clone.position = placement.position.clone();
    clone.rotation = new Vector3(0, placement.rotationY, 0);
    clone.scaling = new Vector3(COLLECTIBLE_SCALE, COLLECTIBLE_SCALE, COLLECTIBLE_SCALE);

    // Collect cloned meshes for raycasting
    const meshes: AbstractMesh[] = [];
    collectChildMeshes(clone, meshes);

    // Create glow light
    const glowColor = GLOW_COLORS[placement.type];
    const glowLight = new PointLight(
      `collectible_glow_${placement.id}`,
      placement.position.add(new Vector3(0, 0.5, 0)),
      scene
    );
    glowLight.diffuse = glowColor.clone();
    glowLight.specular = glowColor.scale(0.3);
    glowLight.intensity = GLOW_INTENSITY;
    glowLight.range = GLOW_RANGE;
    glowLight.parent = parent;

    placedCollectibles.push({
      placement,
      rootNode: clone,
      meshes,
      collected: false,
      glowLight,
    });

    animStates.push({
      baseY: placement.position.y,
      elapsed: i * 0.4, // stagger phase so nearby items don't bob in sync
    });
  }

  log.info(`Placed ${placedCollectibles.length}/${placements.length} collectibles`);

  // ------------------------------------------------------------------
  // 4. Dispose templates (they are no longer needed)
  // ------------------------------------------------------------------
  for (const [, root] of templateRoots) {
    root.dispose(false, true);
  }
  templateRoots.clear();
  templateMeshes.clear();

  // ------------------------------------------------------------------
  // 5. Build system result
  // ------------------------------------------------------------------
  const angularSpeed = ROTATION_SPEED;
  const bobAngularSpeed = (2 * Math.PI) / BOB_PERIOD;

  function update(playerPosition: Vector3, deltaTime: number): CollectiblePlacement | null {
    let closestPlacement: CollectiblePlacement | null = null;
    let closestDist = Infinity;

    for (let i = 0; i < placedCollectibles.length; i++) {
      const item = placedCollectibles[i];
      if (item.collected) continue;

      const anim = animStates[i];
      anim.elapsed += deltaTime;

      // Bobbing animation (sine wave on Y)
      const bobOffset = Math.sin(anim.elapsed * bobAngularSpeed) * BOB_AMPLITUDE;
      item.rootNode.position.y = anim.baseY + bobOffset;
      item.glowLight.position.y = anim.baseY + bobOffset + 0.5;

      // Rotation animation (slow Y spin)
      item.rootNode.rotation.y += angularSpeed * deltaTime;

      // Proximity check (XZ distance for performance, Y tolerance generous)
      const dx = playerPosition.x - item.placement.position.x;
      const dz = playerPosition.z - item.placement.position.z;
      const dy = playerPosition.y - (anim.baseY + bobOffset);
      const distSq = dx * dx + dy * dy + dz * dz;

      const radius = item.placement.pickupRadius ?? DEFAULT_PICKUP_RADIUS;
      if (distSq < radius * radius && distSq < closestDist) {
        closestDist = distSq;
        closestPlacement = item.placement;
      }
    }

    return closestPlacement;
  }

  function collect(id: string): void {
    for (const item of placedCollectibles) {
      if (item.placement.id === id && !item.collected) {
        item.collected = true;
        item.rootNode.setEnabled(false);
        item.glowLight.setEnabled(false);
        item.glowLight.dispose();
        log.info(`Collected: ${id}`);
        return;
      }
    }
    log.warn(`collect() - id not found or already collected: ${id}`);
  }

  function getRemaining(): CollectiblePlacement[] {
    const remaining: CollectiblePlacement[] = [];
    for (const item of placedCollectibles) {
      if (!item.collected) {
        remaining.push(item.placement);
      }
    }
    return remaining;
  }

  function dispose(): void {
    for (const item of placedCollectibles) {
      if (!item.collected) {
        item.glowLight.dispose();
      }
      for (const mesh of item.meshes) {
        mesh.dispose();
      }
      item.rootNode.dispose(false, true);
    }
    placedCollectibles.length = 0;
    animStates.length = 0;
    log.info('Disposed');
  }

  return {
    collectibles: placedCollectibles,
    update,
    collect,
    getRemaining,
    dispose,
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Recursively collect AbstractMesh descendants from a TransformNode hierarchy.
 */
function collectChildMeshes(node: TransformNode, out: AbstractMesh[]): void {
  const children = node.getChildMeshes(false);
  for (const child of children) {
    out.push(child);
  }
}

// ============================================================================
// LEVEL-SPECIFIC PLACEMENT PRESETS
// ============================================================================

// ---------------------------------------------------------------------------
// Chapter 2: LANDFALL - 5 items scattered across the surface combat area
// ---------------------------------------------------------------------------

export function getLandfallCollectibles(): CollectiblePlacement[] {
  return [
    {
      type: 'data_pad',
      position: new Vector3(-30, 1, -50),
      rotationY: 0,
      id: 'landfall_datapad_1',
      displayName: 'Mission Briefing Fragment',
    },
    {
      type: 'audio_log',
      position: new Vector3(45, 1, -120),
      rotationY: Math.PI / 4,
      id: 'landfall_audiolog_1',
      displayName: 'Commander Reyes Recording',
    },
    {
      type: 'weapon_cache',
      position: new Vector3(-60, 1, -80),
      rotationY: 0,
      id: 'landfall_weapons_1',
      displayName: 'Weapons Cache',
    },
    {
      type: 'alien_artifact',
      position: new Vector3(20, 1, -200),
      rotationY: 0,
      id: 'landfall_artifact_1',
      displayName: 'Alien Data Crystal',
    },
    {
      type: 'supply_drop',
      position: new Vector3(-15, 1, -30),
      rotationY: 0,
      id: 'landfall_supply_1',
      displayName: 'Emergency Supply Pod',
    },
  ];
}

// ---------------------------------------------------------------------------
// Chapter 3: CANYON RUN - 4 items along the canyon route at landmarks
// ---------------------------------------------------------------------------

export function getCanyonRunCollectibles(): CollectiblePlacement[] {
  return [
    {
      type: 'data_pad',
      position: new Vector3(10, 3, -150),
      rotationY: 0,
      id: 'canyon_datapad_1',
      displayName: 'Geological Survey Notes',
    },
    {
      type: 'audio_log',
      position: new Vector3(-80, 5, -400),
      rotationY: Math.PI / 3,
      id: 'canyon_audiolog_1',
      displayName: "Pilot Harris's Mayday",
    },
    {
      type: 'alien_artifact',
      position: new Vector3(55, 2, -650),
      rotationY: Math.PI,
      id: 'canyon_artifact_1',
      displayName: 'Pulsing Hive Fragment',
    },
    {
      type: 'supply_drop',
      position: new Vector3(-35, 4, -280),
      rotationY: Math.PI / 6,
      id: 'canyon_supply_1',
      displayName: 'Crashed Resupply Crate',
    },
  ];
}

// ---------------------------------------------------------------------------
// Chapter 5: BROTHERS IN ARMS - 3 items on the battlefield
// ---------------------------------------------------------------------------

export function getBrothersCollectibles(): CollectiblePlacement[] {
  return [
    {
      type: 'data_pad',
      position: new Vector3(-45, 1, -90),
      rotationY: Math.PI / 2,
      id: 'brothers_datapad_1',
      displayName: "Marcus Cole's Field Journal",
    },
    {
      type: 'weapon_cache',
      position: new Vector3(70, 1, -160),
      rotationY: 0,
      id: 'brothers_weapons_1',
      displayName: 'Mech Weapon Module',
    },
    {
      type: 'audio_log',
      position: new Vector3(5, 1, -220),
      rotationY: Math.PI / 5,
      id: 'brothers_audiolog_1',
      displayName: "Marcus's Last Transmission Before Silence",
    },
  ];
}

// ---------------------------------------------------------------------------
// Chapter 6: SOUTHERN ICE - 4 items around the ice outpost and caves
// ---------------------------------------------------------------------------

export function getSouthernIceCollectibles(): CollectiblePlacement[] {
  return [
    {
      type: 'data_pad',
      position: new Vector3(-20, 1, -40),
      rotationY: 0,
      id: 'ice_datapad_1',
      displayName: 'Outpost Theta Weather Log',
    },
    {
      type: 'audio_log',
      position: new Vector3(60, 1, -180),
      rotationY: Math.PI / 4,
      id: 'ice_audiolog_1',
      displayName: "Dr. Vasquez's Research Notes",
    },
    {
      type: 'alien_artifact',
      position: new Vector3(-50, 0.5, -250),
      rotationY: Math.PI / 2,
      id: 'ice_artifact_1',
      displayName: 'Frozen Hive Node',
    },
    {
      type: 'supply_drop',
      position: new Vector3(30, 1, -100),
      rotationY: 0,
      id: 'ice_supply_1',
      displayName: 'Thermal Gear Cache',
    },
  ];
}

// ---------------------------------------------------------------------------
// Chapter 9: EXTRACTION - 4 items around LZ Omega
// ---------------------------------------------------------------------------

export function getExtractionCollectibles(): CollectiblePlacement[] {
  return [
    {
      type: 'data_pad',
      position: new Vector3(-40, 1, -30),
      rotationY: 0,
      id: 'extraction_datapad_1',
      displayName: 'Evac Protocol Override Codes',
    },
    {
      type: 'audio_log',
      position: new Vector3(50, 1, -90),
      rotationY: Math.PI / 3,
      id: 'extraction_audiolog_1',
      displayName: "Captain Torres's Final Orders",
    },
    {
      type: 'weapon_cache',
      position: new Vector3(-25, 1, -150),
      rotationY: Math.PI,
      id: 'extraction_weapons_1',
      displayName: 'Heavy Ordnance Stash',
    },
    {
      type: 'supply_drop',
      position: new Vector3(15, 1, -60),
      rotationY: Math.PI / 8,
      id: 'extraction_supply_1',
      displayName: 'Field Medic Kit',
    },
  ];
}

// ---------------------------------------------------------------------------
// Chapter 10: FINAL ESCAPE - 2 items along the escape route (risky pickups)
// ---------------------------------------------------------------------------

export function getFinalEscapeCollectibles(): CollectiblePlacement[] {
  // Collectibles positioned within the drivable route (X: -25 to +25, Z: 0 to -3000)
  // Player moves fast, so collectibles are placed near the center line with large pickup radii
  return [
    {
      type: 'alien_artifact',
      position: new Vector3(8, 1.5, -250), // Tunnel section, right side
      rotationY: 0,
      id: 'escape_artifact_1',
      displayName: 'Hive Queen Core Sample',
      pickupRadius: 5.0, // Large radius for fast-moving vehicle
    },
    {
      type: 'data_pad',
      position: new Vector3(-10, 1.5, -750), // Surface run section, left side
      rotationY: Math.PI / 4,
      id: 'escape_datapad_1',
      displayName: 'Project STELLAR Abort Dossier',
      pickupRadius: 5.0,
    },
    {
      type: 'weapon_cache',
      position: new Vector3(5, 1.5, -1800), // Canyon section, near center
      rotationY: -Math.PI / 6,
      id: 'escape_weapons_1',
      displayName: 'Emergency Ordinance',
      pickupRadius: 5.0,
    },
    {
      type: 'supply_drop',
      position: new Vector3(-8, 1.5, -2600), // Launch pad approach, health pickup
      rotationY: 0,
      id: 'escape_supply_1',
      displayName: 'Medical Kit',
      pickupRadius: 6.0, // Extra large for final stretch
    },
  ];
}

// ---------------------------------------------------------------------------
// Chapter 8: HIVE ASSAULT - 3 items at the FOB and near hive entrance
// ---------------------------------------------------------------------------

export function getHiveAssaultCollectibles(): CollectiblePlacement[] {
  return [
    {
      type: 'data_pad',
      position: new Vector3(-15, 1, -20),
      rotationY: 0,
      id: 'assault_datapad_1',
      displayName: 'Assault Deployment Orders',
    },
    {
      type: 'weapon_cache',
      position: new Vector3(40, 1, -120),
      rotationY: Math.PI / 6,
      id: 'assault_weapons_1',
      displayName: 'Demolitions Pack',
    },
    {
      type: 'audio_log',
      position: new Vector3(-30, 0.5, -200),
      rotationY: Math.PI / 2,
      id: 'assault_audiolog_1',
      displayName: "Sergeant Okafor's Rallying Cry",
    },
  ];
}

// ---------------------------------------------------------------------------
// Chapter 7: THE BREACH - 3 items in the hive corridors
// ---------------------------------------------------------------------------

export function getTheBreachCollectibles(): CollectiblePlacement[] {
  return [
    {
      type: 'alien_artifact',
      position: new Vector3(10, 0.5, -60),
      rotationY: 0,
      id: 'breach_artifact_1',
      displayName: 'Bio-Luminescent Gland',
    },
    {
      type: 'data_pad',
      position: new Vector3(-25, 0.5, -140),
      rotationY: Math.PI / 3,
      id: 'breach_datapad_1',
      displayName: 'Previous Expedition Recorder',
    },
    {
      type: 'audio_log',
      position: new Vector3(15, 0.5, -220),
      rotationY: Math.PI,
      id: 'breach_audiolog_1',
      displayName: "The Queen's Signal - Decoded Fragment",
    },
  ];
}
