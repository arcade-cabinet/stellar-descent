/**
 * TheBreachLevel - Environmental Hazards
 *
 * Contains acid pools, egg clusters, and pheromone cloud hazards.
 *
 * GLB assets used:
 *   - Egg clusters: alien flora mushrooms (organic pod-like shapes)
 *   - Acid pools / pheromone clouds: remain procedural (transient VFX)
 */

import type { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('HazardBuilder');
import { COLORS } from './constants';
import type { AcidPool, EggCluster, HiveZone, PheromoneCloud } from './types';

// ============================================================================
// GLB ASSET PATHS FOR HAZARDS
// ============================================================================

/** GLB paths for egg cluster models (organic pod-like shapes) */
const EGG_CLUSTER_GLBS = [
  '/assets/models/environment/alien-flora/alien_mushroom_01.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_02.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_04.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_06.glb',
  '/assets/models/environment/alien-flora/alien_mushroom_08.glb',
] as const;

// ============================================================================
// HAZARD BUILDER CLASS
// ============================================================================

/**
 * Builds and manages environmental hazards in the hive.
 */
export class HazardBuilder {
  private scene: Scene;
  private glowLayer: GlowLayer | null;
  private acidPools: AcidPool[] = [];
  private eggClusters: EggCluster[] = [];
  private pheromoneClouds: PheromoneCloud[] = [];
  private eggAssetsLoaded = false;

  constructor(scene: Scene, glowLayer: GlowLayer | null = null) {
    this.scene = scene;
    this.glowLayer = glowLayer;
  }

  /**
   * Preload GLB assets used for egg clusters.
   * Call this during level initialization before creating egg clusters.
   */
  async loadHazardAssets(): Promise<void> {
    const loadPromises: Promise<unknown>[] = [];

    for (const path of EGG_CLUSTER_GLBS) {
      if (!AssetManager.isPathCached(path)) {
        loadPromises.push(AssetManager.loadAssetByPath(path, this.scene));
      }
    }

    await Promise.all(loadPromises);
    this.eggAssetsLoaded = true;
    log.info('Egg cluster GLB assets loaded');
  }

  // ============================================================================
  // ACID POOLS
  // ============================================================================

  /**
   * Create an acid pool hazard at the specified position
   */
  createAcidPool(position: Vector3, radius: number, damage: number = 5): AcidPool {
    const index = this.acidPools.length;

    const pool = MeshBuilder.CreateDisc(
      `acidPool_${index}`,
      { radius, tessellation: 16 },
      this.scene
    );

    const poolMat = new StandardMaterial(`acidPoolMat_${index}`, this.scene);
    poolMat.diffuseColor = Color3.FromHexString(COLORS.acidGreen);
    poolMat.emissiveColor = Color3.FromHexString(COLORS.acidGreen).scale(0.4);
    poolMat.alpha = 0.8;
    pool.material = poolMat;

    pool.position = position.clone();
    pool.position.y += 0.05; // Slightly above ground
    pool.rotation.x = Math.PI / 2;

    // Add to glow layer for visual effect
    if (this.glowLayer) {
      this.glowLayer.addIncludedOnlyMesh(pool);
    }

    const acidPool: AcidPool = {
      mesh: pool,
      position,
      radius,
      damage,
    };

    this.acidPools.push(acidPool);
    return acidPool;
  }

  /**
   * Create standard acid pools for mid and lower hive
   */
  createStandardAcidPools(): void {
    const poolPositions = [
      new Vector3(-3, -60, 70),
      new Vector3(4, -70, 85),
      new Vector3(-2, -90, 105),
      new Vector3(5, -100, 120),
      new Vector3(-4, -110, 135),
    ];

    for (const pos of poolPositions) {
      this.createAcidPool(pos, 1.5 + Math.random() * 1);
    }
  }

  // ============================================================================
  // EGG CLUSTERS
  // ============================================================================

  /**
   * Create an egg cluster that spawns drones when triggered.
   * Uses GLB models from alien flora for organic pod-like egg shapes.
   */
  createEggCluster(position: Vector3, droneCount: number = 2): EggCluster {
    const index = this.eggClusters.length;

    if (!this.eggAssetsLoaded) {
      throw new Error('[HiveHazards] Egg cluster assets not preloaded - call loadHazardAssets() first');
    }

    // Create cluster root node
    const clusterRoot = new TransformNode(`eggCluster_${index}`, this.scene);
    clusterRoot.position = position;

    // Group of 5-8 eggs
    const eggCount = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < eggCount; i++) {
      const angle = (i / eggCount) * Math.PI * 2;
      const dist = 0.3 + Math.random() * 0.4;
      const eggPos = new Vector3(Math.cos(angle) * dist, 0.25, Math.sin(angle) * dist);

      const glbPath = EGG_CLUSTER_GLBS[i % EGG_CLUSTER_GLBS.length];

      if (!AssetManager.isPathCached(glbPath)) {
        throw new Error(`[HiveHazards] Egg GLB not cached: ${glbPath}`);
      }

      const eggNode = AssetManager.createInstanceByPath(
        glbPath,
        `egg_${index}_${i}`,
        this.scene,
        false // No LOD for small decorations
      );

      if (!eggNode) {
        throw new Error(`[HiveHazards] Failed to create egg instance from: ${glbPath}`);
      }

      // Scale down and position the egg
      const scale = 0.15 + Math.random() * 0.1;
      eggNode.scaling.setAll(scale);
      eggNode.position = eggPos;
      eggNode.rotation.set(
        (Math.random() - 0.5) * 0.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4
      );
      eggNode.parent = clusterRoot;
    }

    const cluster: EggCluster = {
      mesh: clusterRoot,
      position,
      triggered: false,
      droneCount: droneCount + Math.floor(Math.random() * 2),
    };

    this.eggClusters.push(cluster);
    return cluster;
  }

  /**
   * Create standard egg clusters throughout the hive
   */
  createStandardEggClusters(): void {
    const clusterPositions = [
      { pos: new Vector3(2, -30, 40), zone: 'upper' as HiveZone },
      { pos: new Vector3(-2, -50, 60), zone: 'mid' as HiveZone },
      { pos: new Vector3(3, -70, 90), zone: 'mid' as HiveZone },
      { pos: new Vector3(-3, -95, 115), zone: 'lower' as HiveZone },
      { pos: new Vector3(2, -105, 130), zone: 'lower' as HiveZone },
      { pos: new Vector3(-2, -115, 145), zone: 'lower' as HiveZone },
    ];

    for (const { pos } of clusterPositions) {
      this.createEggCluster(pos);
    }
  }

  // ============================================================================
  // PHEROMONE CLOUDS
  // ============================================================================

  /**
   * Create a pheromone cloud that obscures vision
   */
  createPheromoneCloud(position: Vector3, radius: number, lifetime: number): PheromoneCloud {
    const index = this.pheromoneClouds.length;

    const cloud = MeshBuilder.CreateSphere(
      `pheromone_${index}`,
      { diameter: radius * 2, segments: 8 },
      this.scene
    );

    const cloudMat = new StandardMaterial(`pheromoneMat_${index}`, this.scene);
    cloudMat.diffuseColor = Color3.FromHexString(COLORS.acidGreen);
    cloudMat.alpha = 0.3;
    cloudMat.emissiveColor = Color3.FromHexString(COLORS.acidGreen).scale(0.2);
    cloud.material = cloudMat;
    cloud.position = position;

    const pheromoneCloud: PheromoneCloud = {
      mesh: cloud,
      position,
      radius,
      lifetime,
      maxLifetime: lifetime,
    };

    this.pheromoneClouds.push(pheromoneCloud);
    return pheromoneCloud;
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getAcidPools(): AcidPool[] {
    return this.acidPools;
  }

  getEggClusters(): EggCluster[] {
    return this.eggClusters;
  }

  getPheromoneClouds(): PheromoneCloud[] {
    return this.pheromoneClouds;
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * Update pheromone clouds (fade out over time)
   * @returns Array of clouds that expired this frame
   */
  updatePheromoneClouds(deltaTime: number): PheromoneCloud[] {
    const expired: PheromoneCloud[] = [];

    for (let i = this.pheromoneClouds.length - 1; i >= 0; i--) {
      const cloud = this.pheromoneClouds[i];
      cloud.lifetime -= deltaTime * 1000;

      if (cloud.lifetime <= 0) {
        expired.push(cloud);
        cloud.mesh.dispose();
        this.pheromoneClouds.splice(i, 1);
      } else {
        const alpha = (cloud.lifetime / cloud.maxLifetime) * 0.3;
        (cloud.mesh.material as StandardMaterial).alpha = alpha;
      }
    }

    return expired;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    // Dispose acid pools
    for (const pool of this.acidPools) {
      pool.mesh.dispose();
    }
    this.acidPools = [];

    // Dispose egg clusters
    for (const cluster of this.eggClusters) {
      cluster.mesh.dispose();
    }
    this.eggClusters = [];

    // Dispose pheromone clouds
    for (const cloud of this.pheromoneClouds) {
      cloud.mesh.dispose();
    }
    this.pheromoneClouds = [];
  }
}

// ============================================================================
// HAZARD CHECK UTILITIES
// ============================================================================

/**
 * Check if a position is inside an acid pool
 * @returns Damage per second if in pool, 0 otherwise
 */
export function checkAcidPoolDamage(playerPosition: Vector3, acidPools: AcidPool[]): number {
  for (const pool of acidPools) {
    const dist2D = Math.sqrt(
      (playerPosition.x - pool.position.x) ** 2 + (playerPosition.z - pool.position.z) ** 2
    );
    if (dist2D < pool.radius && Math.abs(playerPosition.y - pool.position.y) < 2) {
      return pool.damage;
    }
  }
  return 0;
}

/**
 * Check if player is near any untriggered egg cluster
 * @returns The cluster to trigger, or null
 */
export function checkEggClusterTrigger(
  playerPosition: Vector3,
  eggClusters: EggCluster[],
  triggerDistance: number = 4
): EggCluster | null {
  for (const cluster of eggClusters) {
    if (cluster.triggered) continue;

    const dist = Vector3.Distance(playerPosition, cluster.position);
    if (dist < triggerDistance) {
      return cluster;
    }
  }
  return null;
}

/**
 * Check if player is inside a pheromone cloud
 * @returns True if in a cloud
 */
export function checkPheromoneCloud(
  playerPosition: Vector3,
  pheromoneClouds: PheromoneCloud[]
): boolean {
  for (const cloud of pheromoneClouds) {
    const dist = Vector3.Distance(playerPosition, cloud.position);
    if (dist < cloud.radius) {
      return true;
    }
  }
  return false;
}
