/**
 * NavMeshBuilder - Navigation Mesh Generation for Stellar Descent
 *
 * Generates navigation meshes from level geometry for Marcus pathfinding.
 * Supports three environment types:
 * - Indoor (station): Corridors, rooms, doorways
 * - Outdoor (surface): Open terrain with obstacles
 * - Underground (hive): Tunnel networks
 *
 * YUKA NAVMESH STRUCTURE:
 * - NavMesh consists of convex polygons (regions)
 * - Each region has edges that connect to neighbors
 * - PathFinder uses A* to find optimal path through regions
 *
 * INTEGRATION:
 * - Called by LevelManager during level initialization
 * - NavMesh data stored per level for Marcus AI pathfinding
 * - Dynamic obstacle avoidance handled separately
 */

import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { CellSpacePartitioning, NavMesh, NavMeshLoader, Vector3 as YukaVector3 } from 'yuka';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type EnvironmentType = 'station' | 'surface' | 'hive';

export interface NavMeshConfig {
  /** Environment type determines generation strategy */
  environmentType: EnvironmentType;
  /** Walkable area bounds (min/max corners) */
  bounds: {
    min: BabylonVector3;
    max: BabylonVector3;
  };
  /** Cell size for spatial partitioning (smaller = more precise, slower) */
  cellSize: number;
  /** Agent radius for obstacle padding */
  agentRadius: number;
  /** Max slope angle (radians) agent can traverse */
  maxSlope: number;
  /** Step height agent can climb */
  stepHeight: number;
}

export interface NavMeshObstacle {
  id: string;
  position: BabylonVector3;
  radius: number;
  isDynamic: boolean;
}

export interface NavMeshRegionData {
  /** Center position of the region */
  centroid: BabylonVector3;
  /** Vertices defining the convex polygon */
  vertices: BabylonVector3[];
  /** Neighboring region indices */
  neighbors: number[];
  /** Walkability flags (e.g., can jump, requires crouch) */
  flags: number;
}

export interface NavMeshBuildResult {
  navMesh: NavMesh;
  spatialIndex: CellSpacePartitioning | null;
  regionCount: number;
  buildTimeMs: number;
}

export interface VerticalConnection {
  /** Lower region index */
  lowerRegion: number;
  /** Upper region index */
  upperRegion: number;
  /** Connection type */
  type: 'ramp' | 'stairs' | 'elevator' | 'jump';
  /** Position of the connection point */
  position: BabylonVector3;
}

// Region flags for navigation constraints
export const NAV_FLAGS = {
  WALKABLE: 1 << 0,
  REQUIRES_JUMP: 1 << 1,
  REQUIRES_CROUCH: 1 << 2,
  HAZARD: 1 << 3,
  COVER_POSITION: 1 << 4,
  TACTICAL_VANTAGE: 1 << 5,
} as const;

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

const DEFAULT_CONFIGS: Record<EnvironmentType, Partial<NavMeshConfig>> = {
  station: {
    cellSize: 2,
    agentRadius: 1.5, // Marcus mech is ~2m wide
    maxSlope: Math.PI / 6, // 30 degrees
    stepHeight: 0.5,
  },
  surface: {
    cellSize: 4, // Larger cells for open terrain
    agentRadius: 2,
    maxSlope: Math.PI / 4, // 45 degrees - rougher terrain
    stepHeight: 1,
  },
  hive: {
    cellSize: 3,
    agentRadius: 1.5,
    maxSlope: Math.PI / 5, // 36 degrees
    stepHeight: 0.8,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toYukaVector(v: BabylonVector3): YukaVector3 {
  return new YukaVector3(v.x, v.y, v.z);
}

function toBabylonVector(v: YukaVector3): BabylonVector3 {
  return new BabylonVector3(v.x, v.y, v.z);
}

// ============================================================================
// NAVMESH BUILDER CLASS
// ============================================================================

export class NavMeshBuilder {
  private scene: Scene;
  private config: NavMeshConfig;
  private obstacles: Map<string, NavMeshObstacle> = new Map();
  private verticalConnections: VerticalConnection[] = [];
  private navMesh: NavMesh | null = null;
  private spatialIndex: CellSpacePartitioning | null = null;

  constructor(scene: Scene, config: NavMeshConfig) {
    this.scene = scene;
    this.config = {
      ...DEFAULT_CONFIGS[config.environmentType],
      ...config,
    };
  }

  // ============================================================================
  // PUBLIC METHODS - BUILDING
  // ============================================================================

  /**
   * Build navigation mesh from level geometry.
   * This is the main entry point for NavMesh generation.
   */
  async buildFromGeometry(walkableMeshes: Mesh[]): Promise<NavMeshBuildResult> {
    const startTime = performance.now();

    // Create a new NavMesh
    this.navMesh = new NavMesh();

    // Generate regions from meshes based on environment type
    switch (this.config.environmentType) {
      case 'station':
        await this.buildStationNavMesh(walkableMeshes);
        break;
      case 'surface':
        await this.buildSurfaceNavMesh(walkableMeshes);
        break;
      case 'hive':
        await this.buildHiveNavMesh(walkableMeshes);
        break;
    }

    // Create spatial index for efficient queries
    this.createSpatialIndex();

    const buildTime = performance.now() - startTime;

    return {
      navMesh: this.navMesh,
      spatialIndex: this.spatialIndex,
      regionCount: this.navMesh.regions.length,
      buildTimeMs: buildTime,
    };
  }

  /**
   * Load a pre-built NavMesh from a GLB file.
   * NavMesh geometry should be a single mesh with the name 'navmesh'.
   */
  async loadFromGLB(url: string): Promise<NavMeshBuildResult> {
    const startTime = performance.now();

    const loader = new NavMeshLoader();

    return new Promise((resolve, reject) => {
      loader
        .load(url)
        .then((navMesh) => {
          this.navMesh = navMesh;
          this.createSpatialIndex();

          const buildTime = performance.now() - startTime;

          resolve({
            navMesh: this.navMesh,
            spatialIndex: this.spatialIndex,
            regionCount: this.navMesh.regions.length,
            buildTimeMs: buildTime,
          });
        })
        .catch(reject);
    });
  }

  /**
   * Build NavMesh from a simple grid (fallback for levels without geometry).
   * Creates a rectangular walkable area subdivided into cells.
   *
   * Note: This creates a simplified NavMesh using triangulated polygons
   * that work correctly with Yuka's fromPolygons method.
   */
  buildFromGrid(
    width: number,
    depth: number,
    cellSize: number,
    center: BabylonVector3 = BabylonVector3.Zero()
  ): NavMeshBuildResult {
    const startTime = performance.now();

    this.navMesh = new NavMesh();

    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const cellsX = Math.ceil(width / cellSize);
    const cellsZ = Math.ceil(depth / cellSize);

    // Generate grid of triangles (2 per cell)
    // Yuka's fromPolygons works best with triangulated meshes
    const polygons: YukaVector3[][] = [];

    for (let x = 0; x < cellsX; x++) {
      for (let z = 0; z < cellsZ; z++) {
        const x0 = center.x - halfWidth + x * cellSize;
        const z0 = center.z - halfDepth + z * cellSize;
        const x1 = Math.min(x0 + cellSize, center.x + halfWidth);
        const z1 = Math.min(z0 + cellSize, center.z + halfDepth);

        // Create two triangles per cell (counter-clockwise winding)
        // Triangle 1: bottom-left
        polygons.push([
          new YukaVector3(x0, center.y, z0),
          new YukaVector3(x1, center.y, z0),
          new YukaVector3(x0, center.y, z1),
        ]);

        // Triangle 2: top-right
        polygons.push([
          new YukaVector3(x1, center.y, z0),
          new YukaVector3(x1, center.y, z1),
          new YukaVector3(x0, center.y, z1),
        ]);
      }
    }

    // Add polygons to navmesh
    try {
      this.navMesh.fromPolygons(polygons);
    } catch (error) {
      console.warn('Failed to build NavMesh from polygons:', error);
      // Create an empty but valid NavMesh
      this.navMesh = new NavMesh();
    }

    // Create spatial index
    this.createSpatialIndex();

    const buildTime = performance.now() - startTime;

    return {
      navMesh: this.navMesh,
      spatialIndex: this.spatialIndex,
      regionCount: this.navMesh.regions.length,
      buildTimeMs: buildTime,
    };
  }

  // ============================================================================
  // PUBLIC METHODS - OBSTACLES
  // ============================================================================

  /**
   * Add a static obstacle to the NavMesh.
   * Static obstacles are baked into the mesh and don't change.
   */
  addStaticObstacle(obstacle: NavMeshObstacle): void {
    this.obstacles.set(obstacle.id, { ...obstacle, isDynamic: false });
  }

  /**
   * Add a dynamic obstacle that can move.
   * Dynamic obstacles are handled at query time, not baked in.
   */
  addDynamicObstacle(obstacle: NavMeshObstacle): void {
    this.obstacles.set(obstacle.id, { ...obstacle, isDynamic: true });
  }

  /**
   * Update a dynamic obstacle's position.
   */
  updateObstacle(id: string, position: BabylonVector3): void {
    const obstacle = this.obstacles.get(id);
    if (obstacle?.isDynamic) {
      obstacle.position = position.clone();
    }
  }

  /**
   * Remove an obstacle.
   */
  removeObstacle(id: string): void {
    this.obstacles.delete(id);
  }

  /**
   * Get all dynamic obstacles for runtime avoidance.
   */
  getDynamicObstacles(): NavMeshObstacle[] {
    return Array.from(this.obstacles.values()).filter((o) => o.isDynamic);
  }

  // ============================================================================
  // PUBLIC METHODS - VERTICAL CONNECTIONS
  // ============================================================================

  /**
   * Add a vertical connection (ramps, stairs, elevators).
   * These link regions at different heights.
   */
  addVerticalConnection(connection: VerticalConnection): void {
    this.verticalConnections.push(connection);
  }

  /**
   * Get vertical connections for pathfinding.
   */
  getVerticalConnections(): VerticalConnection[] {
    return this.verticalConnections;
  }

  // ============================================================================
  // PUBLIC METHODS - QUERIES
  // ============================================================================

  /**
   * Get the built NavMesh.
   */
  getNavMesh(): NavMesh | null {
    return this.navMesh;
  }

  /**
   * Get the spatial index for efficient region lookups.
   */
  getSpatialIndex(): CellSpacePartitioning | null {
    return this.spatialIndex;
  }

  /**
   * Find the nearest point on the NavMesh to a given position.
   */
  clampToNavMesh(position: BabylonVector3): BabylonVector3 | null {
    if (!this.navMesh) return null;

    const yukaPos = toYukaVector(position);
    const region = this.navMesh.getRegionForPoint(yukaPos);

    if (region) {
      const clamped = new YukaVector3();
      region.clampPointToRegion(yukaPos, clamped);
      return toBabylonVector(clamped);
    }

    // Point not on mesh - find closest region
    let closestDist = Infinity;
    let closestPoint: BabylonVector3 | null = null;

    for (const r of this.navMesh.regions) {
      const centroid = r.centroid;
      const dist = yukaPos.distanceTo(centroid);
      if (dist < closestDist) {
        closestDist = dist;
        const clamped = new YukaVector3();
        r.clampPointToRegion(yukaPos, clamped);
        closestPoint = toBabylonVector(clamped);
      }
    }

    return closestPoint;
  }

  /**
   * Check if a position is on the NavMesh.
   */
  isOnNavMesh(position: BabylonVector3): boolean {
    if (!this.navMesh) return false;
    const region = this.navMesh.getRegionForPoint(toYukaVector(position));
    return region !== null;
  }

  /**
   * Get the region containing a position.
   */
  getRegionAt(position: BabylonVector3): number {
    if (!this.navMesh) return -1;
    const region = this.navMesh.getRegionForPoint(toYukaVector(position));
    if (!region) return -1;
    return this.navMesh.regions.indexOf(region);
  }

  /**
   * Get region data for debugging/visualization.
   */
  getRegionData(): NavMeshRegionData[] {
    if (!this.navMesh) return [];

    return this.navMesh.regions.map((region, _index) => {
      const vertices = region.contour.map((v) => toBabylonVector(v));
      const neighbors: number[] = [];

      // Find neighboring regions
      for (const edge of region.edge.entries()) {
        if (edge.twin?.polygon) {
          const neighborIndex = this.navMesh!.regions.indexOf(edge.twin.polygon);
          if (neighborIndex >= 0 && !neighbors.includes(neighborIndex)) {
            neighbors.push(neighborIndex);
          }
        }
      }

      return {
        centroid: toBabylonVector(region.centroid),
        vertices,
        neighbors,
        flags: NAV_FLAGS.WALKABLE, // Default flag
      };
    });
  }

  // ============================================================================
  // PRIVATE METHODS - BUILDING STRATEGIES
  // ============================================================================

  /**
   * Build NavMesh for indoor station environments.
   * Focuses on corridors, rooms, and doorways.
   */
  private async buildStationNavMesh(_walkableMeshes: Mesh[]): Promise<void> {
    // For station environments, we typically:
    // 1. Extract floor polygons from meshes
    // 2. Merge adjacent floor tiles
    // 3. Create doorway connections between rooms

    // Simplified: Create grid-based mesh within bounds
    const { min, max } = this.config.bounds;
    const width = max.x - min.x;
    const depth = max.z - min.z;
    const center = min.add(max).scale(0.5);

    const cellsX = Math.ceil(width / this.config.cellSize);
    const cellsZ = Math.ceil(depth / this.config.cellSize);
    const polygons: YukaVector3[][] = [];

    for (let x = 0; x < cellsX; x++) {
      for (let z = 0; z < cellsZ; z++) {
        const x0 = min.x + x * this.config.cellSize;
        const z0 = min.z + z * this.config.cellSize;
        const x1 = Math.min(x0 + this.config.cellSize, max.x);
        const z1 = Math.min(z0 + this.config.cellSize, max.z);

        const vertices = [
          new YukaVector3(x0, center.y, z0),
          new YukaVector3(x1, center.y, z0),
          new YukaVector3(x1, center.y, z1),
          new YukaVector3(x0, center.y, z1),
        ];

        polygons.push(vertices);
      }
    }

    this.navMesh!.fromPolygons(polygons);
  }

  /**
   * Build NavMesh for outdoor surface environments.
   * Handles open terrain with varied elevation.
   */
  private async buildSurfaceNavMesh(_walkableMeshes: Mesh[]): Promise<void> {
    // For surface environments:
    // 1. Sample terrain heightmap
    // 2. Create triangulated mesh based on slope
    // 3. Mark steep areas as non-walkable

    const { min, max } = this.config.bounds;
    const width = max.x - min.x;
    const depth = max.z - min.z;

    const cellsX = Math.ceil(width / this.config.cellSize);
    const cellsZ = Math.ceil(depth / this.config.cellSize);
    const polygons: YukaVector3[][] = [];

    for (let x = 0; x < cellsX; x++) {
      for (let z = 0; z < cellsZ; z++) {
        const x0 = min.x + x * this.config.cellSize;
        const z0 = min.z + z * this.config.cellSize;
        const x1 = Math.min(x0 + this.config.cellSize, max.x);
        const z1 = Math.min(z0 + this.config.cellSize, max.z);

        // For now, flat terrain at y=0
        const y = min.y;

        const vertices = [
          new YukaVector3(x0, y, z0),
          new YukaVector3(x1, y, z0),
          new YukaVector3(x1, y, z1),
          new YukaVector3(x0, y, z1),
        ];

        polygons.push(vertices);
      }
    }

    this.navMesh!.fromPolygons(polygons);
  }

  /**
   * Build NavMesh for underground hive environments.
   * Handles tunnel networks and organic cavern shapes.
   */
  private async buildHiveNavMesh(_walkableMeshes: Mesh[]): Promise<void> {
    // For hive environments:
    // 1. Process tunnel segments as corridors
    // 2. Handle branching points
    // 3. Account for irregular cavern shapes

    // Similar to station but with potential for more organic shapes
    const { min, max } = this.config.bounds;
    const width = max.x - min.x;
    const depth = max.z - min.z;
    const center = min.add(max).scale(0.5);

    const cellsX = Math.ceil(width / this.config.cellSize);
    const cellsZ = Math.ceil(depth / this.config.cellSize);
    const polygons: YukaVector3[][] = [];

    for (let x = 0; x < cellsX; x++) {
      for (let z = 0; z < cellsZ; z++) {
        const x0 = min.x + x * this.config.cellSize;
        const z0 = min.z + z * this.config.cellSize;
        const x1 = Math.min(x0 + this.config.cellSize, max.x);
        const z1 = Math.min(z0 + this.config.cellSize, max.z);

        const vertices = [
          new YukaVector3(x0, center.y, z0),
          new YukaVector3(x1, center.y, z0),
          new YukaVector3(x1, center.y, z1),
          new YukaVector3(x0, center.y, z1),
        ];

        polygons.push(vertices);
      }
    }

    this.navMesh!.fromPolygons(polygons);
  }

  /**
   * Create spatial partitioning index for efficient region lookups.
   */
  private createSpatialIndex(): void {
    if (!this.navMesh || this.navMesh.regions.length === 0) return;

    const { min, max } = this.config.bounds;
    const width = max.x - min.x;
    const depth = max.z - min.z;
    const height = max.y - min.y || 10; // Default height

    const cellsX = Math.ceil(width / this.config.cellSize);
    const cellsY = Math.ceil(height / this.config.cellSize) || 1;
    const cellsZ = Math.ceil(depth / this.config.cellSize);

    this.spatialIndex = new CellSpacePartitioning(width, height, depth, cellsX, cellsY, cellsZ);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.navMesh = null;
    this.spatialIndex = null;
    this.obstacles.clear();
    this.verticalConnections = [];
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a NavMesh for the Brothers in Arms level (surface canyon).
 */
export function createBrothersNavMesh(scene: Scene): NavMeshBuilder {
  return new NavMeshBuilder(scene, {
    environmentType: 'surface',
    bounds: {
      min: new BabylonVector3(-100, 0, -75),
      max: new BabylonVector3(100, 10, 75),
    },
    cellSize: 4,
    agentRadius: 2,
    maxSlope: Math.PI / 4,
    stepHeight: 1,
  });
}

/**
 * Create a NavMesh for station/indoor levels.
 */
export function createStationNavMesh(
  scene: Scene,
  bounds: { min: BabylonVector3; max: BabylonVector3 }
): NavMeshBuilder {
  return new NavMeshBuilder(scene, {
    environmentType: 'station',
    bounds,
    cellSize: 2,
    agentRadius: 1.5,
    maxSlope: Math.PI / 6,
    stepHeight: 0.5,
  });
}

/**
 * Create a NavMesh for hive/underground levels.
 */
export function createHiveNavMesh(
  scene: Scene,
  bounds: { min: BabylonVector3; max: BabylonVector3 }
): NavMeshBuilder {
  return new NavMeshBuilder(scene, {
    environmentType: 'hive',
    bounds,
    cellSize: 3,
    agentRadius: 1.5,
    maxSlope: Math.PI / 5,
    stepHeight: 0.8,
  });
}
