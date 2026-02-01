/**
 * LODManager - Level of Detail system for 3D models
 *
 * Manages automatic LOD level selection based on camera distance to improve performance.
 * Uses BabylonJS built-in LOD system with configurable distance thresholds.
 *
 * LOD Levels:
 * - LOD0: Full detail (0-20 meters)
 * - LOD1: Medium detail (20-50 meters)
 * - LOD2: Low detail (50-100 meters)
 * - Billboard: Very distant objects (optional)
 * - Culled: Hidden (100+ meters)
 *
 * Features:
 * - Automatic LOD generation for loaded GLB meshes
 * - Distance-based LOD switching using BabylonJS native LOD
 * - Configurable LOD distances (near, medium, far)
 * - Billboard fallback for distant objects
 * - Performance monitoring to verify LOD benefits
 * - Mobile-optimized with aggressive distance culling
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { SimplificationQueue } from '@babylonjs/core/Meshes/meshSimplification';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from './Logger';
import { getPerformanceManager } from './PerformanceManager';

const log = getLogger('LODManager');

// Side-effect import to register SimplificationQueue with the scene
import '@babylonjs/core/Meshes/meshSimplificationSceneComponent';

/**
 * LOD configuration per mesh category
 */
export interface LODConfig {
  /** Distance thresholds in meters [LOD1, LOD2, Cull] */
  distances: [number, number, number];
  /** Quality ratios for each LOD level [LOD1, LOD2] - 0 to 1 */
  quality: [number, number];
  /** Whether to use billboards for distant objects */
  useBillboard: boolean;
  /** Billboard distance threshold (when to show billboard instead of LOD2) */
  billboardDistance: number;
  /** Skip LOD for this category (e.g., player weapons) */
  skip: boolean;
  /** Use async mesh simplification (slower but better quality reduction) */
  useAsyncSimplification: boolean;
  /** Minimum vertex count to apply LOD (skip small meshes) */
  minVerticesForLOD: number;
}

/**
 * Default LOD configurations by category
 */
export const DEFAULT_LOD_CONFIGS: Record<string, LODConfig> = {
  // Enemies - aggressive LOD since they move around
  enemy: {
    distances: [20, 50, 100],
    quality: [0.5, 0.25],
    useBillboard: false,
    billboardDistance: 80,
    skip: false,
    useAsyncSimplification: false, // Fast decimation for enemies
    minVerticesForLOD: 100,
  },
  // Props - medium LOD, static objects
  prop: {
    distances: [25, 60, 120],
    quality: [0.6, 0.3],
    useBillboard: true,
    billboardDistance: 100,
    skip: false,
    useAsyncSimplification: true, // Better quality for static props
    minVerticesForLOD: 50,
  },
  // Environment/structures - conservative LOD since they're large
  environment: {
    distances: [30, 80, 150],
    quality: [0.7, 0.4],
    useBillboard: false,
    billboardDistance: 120,
    skip: false,
    useAsyncSimplification: true,
    minVerticesForLOD: 200,
  },
  // Vehicles - need to look good at medium range
  vehicle: {
    distances: [35, 70, 140],
    quality: [0.6, 0.35],
    useBillboard: false,
    billboardDistance: 110,
    skip: false,
    useAsyncSimplification: false,
    minVerticesForLOD: 100,
  },
  // Player weapons/hands - never apply LOD
  player: {
    distances: [0, 0, 0],
    quality: [1, 1],
    useBillboard: false,
    billboardDistance: 0,
    skip: true,
    useAsyncSimplification: false,
    minVerticesForLOD: 0,
  },
  // Small decorative items - very aggressive LOD
  decoration: {
    distances: [15, 35, 70],
    quality: [0.4, 0.2],
    useBillboard: true,
    billboardDistance: 50,
    skip: false,
    useAsyncSimplification: false,
    minVerticesForLOD: 30,
  },
};

/**
 * Tracked mesh info for LOD management
 */
interface TrackedMesh {
  rootNode: TransformNode;
  meshes: Mesh[];
  category: string;
  config: LODConfig;
  lodLevels: Map<Mesh, Mesh[]>; // Original mesh -> [LOD1, LOD2]
  billboardMesh?: Mesh;
  lastUpdateTime: number;
  currentLOD: number; // 0=full, 1=medium, 2=low, 3=billboard, 4=culled
  originalTriangleCount: number;
  currentTriangleCount: number;
  simplificationPending: boolean;
}

/**
 * Performance metrics for LOD system
 */
export interface LODMetrics {
  totalTrackedMeshes: number;
  meshesPerLOD: [number, number, number, number, number]; // LOD0, LOD1, LOD2, Billboard, Culled
  totalTrianglesVisible: number;
  totalTrianglesFull: number;
  triangleSavings: number; // percentage
  lastUpdateDuration: number; // ms
  /** Draw calls saved by LOD culling */
  drawCallsSaved: number;
  /** Number of meshes pending simplification */
  pendingSimplifications: number;
  /** Average FPS during last measurement window */
  avgFPS: number;
  /** Whether performance target (60fps) is being met */
  performanceTargetMet: boolean;
}

/**
 * LOD Manager singleton class
 */
class LODManagerClass {
  private scene: Scene | null = null;
  private camera: Camera | null = null;
  private trackedMeshes: Map<string, TrackedMesh> = new Map();
  private simplificationQueue: SimplificationQueue | null = null;

  // Update throttling - don't update LOD every frame
  private lastFullUpdate = 0;
  private updateInterval = 100; // ms between full LOD updates
  private distanceCheckInterval = 50; // ms between distance checks

  // FPS tracking for performance monitoring
  private fpsHistory: number[] = [];
  private maxFpsHistoryLength = 60;
  private lastFpsUpdate = 0;

  // Metrics
  private metrics: LODMetrics = {
    totalTrackedMeshes: 0,
    meshesPerLOD: [0, 0, 0, 0, 0],
    totalTrianglesVisible: 0,
    totalTrianglesFull: 0,
    triangleSavings: 0,
    lastUpdateDuration: 0,
    drawCallsSaved: 0,
    pendingSimplifications: 0,
    avgFPS: 60,
    performanceTargetMet: true,
  };

  // Category overrides
  private categoryConfigs: Map<string, LODConfig> = new Map();

  // Simplification tracking
  private pendingSimplifications: Set<string> = new Set();
  private simplificationCallbacks: Map<string, () => void> = new Map();

  // Triangle budget
  private maxTrianglesPerFrame = 500000;

  /**
   * Initialize the LOD manager with scene and camera
   */
  init(scene: Scene, camera: Camera): void {
    this.scene = scene;
    this.camera = camera;
    this.simplificationQueue = new SimplificationQueue();

    // Set up default configs
    for (const [category, config] of Object.entries(DEFAULT_LOD_CONFIGS)) {
      this.categoryConfigs.set(category, { ...config });
    }

    // Adjust configs based on device performance
    this.adjustConfigsForDevice();

    log.info('Initialized with default configs');
  }

  /**
   * Adjust LOD configs based on device capabilities
   */
  private adjustConfigsForDevice(): void {
    const perfManager = getPerformanceManager();
    const isMobile = perfManager.isMobile();

    if (isMobile) {
      // More aggressive LOD on mobile for 60fps target
      for (const [category, config] of this.categoryConfigs) {
        if (!config.skip) {
          // Reduce LOD distances by 40% on mobile
          const mobileDistances: [number, number, number] = [
            Math.round(config.distances[0] * 0.6),
            Math.round(config.distances[1] * 0.6),
            Math.round(config.distances[2] * 0.6),
          ];
          this.categoryConfigs.set(category, {
            ...config,
            distances: mobileDistances,
            billboardDistance: Math.round(config.billboardDistance * 0.6),
          });
        }
      }
      log.info('Applied mobile LOD distance adjustments');
    }
  }

  /**
   * Set camera reference (useful when camera changes)
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Override LOD config for a category
   */
  setCategoryConfig(category: string, config: Partial<LODConfig>): void {
    const existing = this.categoryConfigs.get(category) ?? DEFAULT_LOD_CONFIGS.prop;
    this.categoryConfigs.set(category, { ...existing, ...config });
  }

  /**
   * Get LOD config for a category, adjusted for current performance settings
   */
  getConfig(category: string): LODConfig {
    const baseConfig = this.categoryConfigs.get(category) ?? DEFAULT_LOD_CONFIGS.prop;

    // Apply performance-based distance adjustment
    const perfManager = getPerformanceManager();
    const lodMultiplier = perfManager.getSettings().lodDistanceMultiplier;

    // Return adjusted config with scaled distances (closer LOD transitions on mobile)
    return {
      ...baseConfig,
      distances: [
        Math.round(baseConfig.distances[0] * lodMultiplier),
        Math.round(baseConfig.distances[1] * lodMultiplier),
        Math.round(baseConfig.distances[2] * lodMultiplier),
      ] as [number, number, number],
    };
  }

  /**
   * Register a mesh/TransformNode for LOD management
   * @param id Unique identifier for tracking
   * @param rootNode The root TransformNode containing meshes
   * @param category Category for LOD config (enemy, prop, environment, etc.)
   * @param autoSimplify Whether to auto-generate LOD meshes via simplification
   */
  async registerMesh(
    id: string,
    rootNode: TransformNode,
    category: string,
    autoSimplify: boolean = true
  ): Promise<void> {
    if (!this.scene) {
      log.warn('Not initialized, cannot register mesh');
      return;
    }

    const config = this.getConfig(category);

    // Skip if category is marked to skip LOD
    if (config.skip) {
      return;
    }

    // Collect all meshes under the root node
    const meshes: Mesh[] = [];
    this.collectMeshes(rootNode, meshes);

    if (meshes.length === 0) {
      log.warn(`No meshes found under node: ${id}`);
      return;
    }

    // Calculate original triangle count
    let originalTriangles = 0;
    for (const mesh of meshes) {
      originalTriangles += Math.floor(mesh.getTotalIndices() / 3);
    }

    const tracked: TrackedMesh = {
      rootNode,
      meshes,
      category,
      config,
      lodLevels: new Map(),
      lastUpdateTime: 0,
      currentLOD: 0,
      originalTriangleCount: originalTriangles,
      currentTriangleCount: originalTriangles,
      simplificationPending: false,
    };

    // Generate LOD levels
    if (autoSimplify) {
      await this.generateLODLevels(tracked);
    }

    // Create billboard for distant view if configured
    if (config.useBillboard) {
      tracked.billboardMesh = this.createBillboard(rootNode, meshes) ?? undefined;
    }

    this.trackedMeshes.set(id, tracked);
    this.metrics.totalTrackedMeshes = this.trackedMeshes.size;
  }

  /**
   * Unregister a mesh from LOD management
   */
  unregisterMesh(id: string): void {
    const tracked = this.trackedMeshes.get(id);
    if (!tracked) return;

    // Dispose LOD meshes
    for (const lodMeshes of tracked.lodLevels.values()) {
      for (const mesh of lodMeshes) {
        mesh.dispose();
      }
    }

    // Dispose billboard
    if (tracked.billboardMesh) {
      tracked.billboardMesh.dispose();
    }

    this.trackedMeshes.delete(id);
    this.metrics.totalTrackedMeshes = this.trackedMeshes.size;
  }

  /**
   * Collect all Mesh instances under a transform node
   */
  private collectMeshes(node: TransformNode, meshes: Mesh[]): void {
    if (node instanceof Mesh && node.getTotalVertices() > 0) {
      meshes.push(node);
    }

    for (const child of node.getChildMeshes(false)) {
      if (child instanceof Mesh && child.getTotalVertices() > 0) {
        meshes.push(child);
      }
    }
  }

  /**
   * Generate LOD levels for a tracked mesh using BabylonJS simplification
   */
  private async generateLODLevels(tracked: TrackedMesh): Promise<void> {
    if (!this.scene || !this.simplificationQueue) return;

    const { meshes, config } = tracked;

    for (const mesh of meshes) {
      // Skip meshes with too few vertices
      if (mesh.getTotalVertices() < 100) continue;

      const lodMeshes: Mesh[] = [];

      try {
        // Use BabylonJS built-in addLODLevel instead of manual simplification
        // This is more efficient and handles the switching automatically

        // LOD1 - Medium quality at medium distance
        const lod1 = this.createSimplifiedMesh(mesh, config.quality[0], 'lod1');
        if (lod1) {
          mesh.addLODLevel(config.distances[0], lod1);
          lodMeshes.push(lod1);
        }

        // LOD2 - Low quality at far distance
        const lod2 = this.createSimplifiedMesh(mesh, config.quality[1], 'lod2');
        if (lod2) {
          mesh.addLODLevel(config.distances[1], lod2);
          lodMeshes.push(lod2);
        }

        // Cull at max distance - pass null to hide mesh
        mesh.addLODLevel(config.distances[2], null);

        tracked.lodLevels.set(mesh, lodMeshes);
      } catch (error) {
        log.warn(`Failed to generate LOD for mesh ${mesh.name}:`, error);
      }
    }
  }

  /**
   * Create a simplified version of a mesh using vertex decimation
   * This performs actual geometry reduction for performance gains
   */
  private createSimplifiedMesh(original: Mesh, quality: number, suffix: string): Mesh | null {
    if (!this.scene) return null;

    try {
      const vertexCount = original.getTotalVertices();
      const _targetVertexCount = Math.floor(vertexCount * quality);

      // For very small reductions, just clone without decimation
      if (quality > 0.9 || vertexCount < 100) {
        const clone = original.clone(`${original.name}_${suffix}`, original.parent);
        if (clone) {
          clone.isVisible = false;
        }
        return clone;
      }

      // Create a decimated mesh using vertex data manipulation
      const simplified = this.decimateMesh(original, quality, suffix);
      if (simplified) {
        simplified.isVisible = false;
        return simplified;
      }

      // Fallback to simple clone if decimation fails
      const clone = original.clone(`${original.name}_${suffix}`, original.parent);
      if (clone) {
        clone.isVisible = false;
      }
      return clone;
    } catch (error) {
      log.warn(`Failed to create simplified mesh:`, error);
      return null;
    }
  }

  /**
   * Decimate a mesh by reducing vertex count using a quadric-based approach
   * This is a simplified edge collapse algorithm for real-time LOD generation
   */
  private decimateMesh(original: Mesh, quality: number, suffix: string): Mesh | null {
    if (!this.scene) return null;

    try {
      // Get vertex data from original mesh
      const positions = original.getVerticesData('position');
      const indices = original.getIndices();
      const normals = original.getVerticesData('normal');
      const uvs = original.getVerticesData('uv');

      if (!positions || !indices) {
        return null;
      }

      const vertexCount = positions.length / 3;
      const targetVertexCount = Math.max(4, Math.floor(vertexCount * quality));

      // If we can't reduce meaningfully, skip decimation
      if (targetVertexCount >= vertexCount * 0.95) {
        return original.clone(`${original.name}_${suffix}`, original.parent);
      }

      // Use a strided vertex reduction approach for performance
      // This creates a simpler but still effective LOD
      const result = this.stridedDecimation(positions, indices as number[], normals, uvs, quality);

      if (!result) {
        return null;
      }

      // Create new mesh with decimated geometry
      const simplified = new Mesh(`${original.name}_${suffix}`, this.scene);
      const vertexData = new VertexData();

      vertexData.positions = result.positions;
      vertexData.indices = result.indices;
      if (result.normals) {
        vertexData.normals = result.normals;
      }
      if (result.uvs) {
        vertexData.uvs = result.uvs;
      }

      vertexData.applyToMesh(simplified);

      // Copy material from original
      simplified.material = original.material;
      simplified.parent = original.parent;

      return simplified;
    } catch (error) {
      log.warn(`Mesh decimation failed:`, error);
      return null;
    }
  }

  /**
   * Strided vertex decimation - reduces vertices by sampling at intervals
   * Fast but maintains mesh topology better than random sampling
   */
  private stridedDecimation(
    positions: Float32Array | number[],
    indices: number[],
    normals: Float32Array | number[] | null,
    uvs: Float32Array | number[] | null,
    quality: number
  ): { positions: number[]; indices: number[]; normals?: number[]; uvs?: number[] } | null {
    const vertexCount = positions.length / 3;
    const _stride = Math.max(1, Math.floor(1 / quality));

    // Build unique vertex map (collapse nearby vertices)
    const gridSize = 0.1 / quality; // Larger grid = more aggressive merging
    const vertexMap = new Map<string, number>();
    const newPositions: number[] = [];
    const newNormals: number[] = [];
    const newUvs: number[] = [];
    const oldToNewIndex: number[] = new Array(vertexCount).fill(-1);

    let newVertexCount = 0;

    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      // Quantize position to grid cell
      const gx = Math.round(x / gridSize);
      const gy = Math.round(y / gridSize);
      const gz = Math.round(z / gridSize);
      const key = `${gx},${gy},${gz}`;

      if (vertexMap.has(key)) {
        // Reuse existing vertex
        oldToNewIndex[i] = vertexMap.get(key)!;
      } else {
        // Create new vertex
        vertexMap.set(key, newVertexCount);
        oldToNewIndex[i] = newVertexCount;

        newPositions.push(x, y, z);
        if (normals) {
          newNormals.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        }
        if (uvs) {
          newUvs.push(uvs[i * 2], uvs[i * 2 + 1]);
        }

        newVertexCount++;
      }
    }

    // Rebuild indices with new vertex references
    const newIndices: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = oldToNewIndex[indices[i]];
      const i1 = oldToNewIndex[indices[i + 1]];
      const i2 = oldToNewIndex[indices[i + 2]];

      // Skip degenerate triangles (all indices same)
      if (i0 !== i1 && i1 !== i2 && i0 !== i2) {
        newIndices.push(i0, i1, i2);
      }
    }

    // Return null if we didn't reduce enough
    if (newPositions.length >= positions.length * 0.95) {
      return null;
    }

    return {
      positions: newPositions,
      indices: newIndices,
      normals: newNormals.length > 0 ? newNormals : undefined,
      uvs: newUvs.length > 0 ? newUvs : undefined,
    };
  }

  /**
   * Create a billboard sprite for very distant objects
   * Uses a silhouette-style representation for far LOD
   */
  private createBillboard(rootNode: TransformNode, meshes: Mesh[]): Mesh | null {
    if (!this.scene) return null;

    // Calculate bounding info from all meshes
    let minY = Infinity,
      maxY = -Infinity;
    let minX = Infinity,
      maxX = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    for (const mesh of meshes) {
      const bounds = mesh.getBoundingInfo();
      if (bounds) {
        const min = bounds.boundingBox.minimumWorld;
        const max = bounds.boundingBox.maximumWorld;

        minY = Math.min(minY, min.y);
        maxY = Math.max(maxY, max.y);
        minX = Math.min(minX, min.x);
        maxX = Math.max(maxX, max.x);
        minZ = Math.min(minZ, min.z);
        maxZ = Math.max(maxZ, max.z);
      }
    }

    // Handle edge cases
    if (!Number.isFinite(minY)) minY = 0;
    if (!Number.isFinite(maxY)) maxY = 2;
    if (!Number.isFinite(minX)) minX = -1;
    if (!Number.isFinite(maxX)) maxX = 1;
    if (!Number.isFinite(minZ)) minZ = -1;
    if (!Number.isFinite(maxZ)) maxZ = 1;

    const height = Math.max(0.5, maxY - minY);
    const widthX = maxX - minX;
    const widthZ = maxZ - minZ;
    const width = Math.max(0.5, Math.max(widthX, widthZ));

    // Create billboard plane
    const billboard = MeshBuilder.CreatePlane(
      `${rootNode.name}_billboard`,
      { width, height },
      this.scene
    );

    // Position at center of mesh
    billboard.position.y = (minY + maxY) / 2;
    billboard.position.x = (minX + maxX) / 2;
    billboard.position.z = (minZ + maxZ) / 2;
    billboard.parent = rootNode;
    billboard.isVisible = false;

    // Billboard always faces camera on Y axis only (keeps upright)
    billboard.billboardMode = Mesh.BILLBOARDMODE_Y;

    // Create a simple silhouette material
    const mat = new StandardMaterial(`${rootNode.name}_billboard_mat`, this.scene);

    // Try to extract color from mesh material
    let baseColor = new Color3(0.3, 0.3, 0.3);
    for (const mesh of meshes) {
      if (mesh.material instanceof StandardMaterial) {
        baseColor = mesh.material.diffuseColor || baseColor;
        break;
      }
    }

    // Slightly darker for silhouette effect
    mat.diffuseColor = new Color3(baseColor.r * 0.7, baseColor.g * 0.7, baseColor.b * 0.7);
    mat.emissiveColor = new Color3(baseColor.r * 0.2, baseColor.g * 0.2, baseColor.b * 0.2);
    mat.alpha = 0.85;
    mat.backFaceCulling = false; // Visible from both sides
    mat.disableLighting = true; // Consistent appearance at distance

    billboard.material = mat;
    billboard.isPickable = false; // Don't interfere with raycasts

    return billboard;
  }

  /**
   * Update LOD levels based on camera distance
   * Should be called from the game loop, but throttled internally
   */
  update(): void {
    if (!this.camera || !this.scene) return;

    const now = performance.now();

    // Track FPS for performance monitoring
    this.updateFPSTracking(now);

    // Throttle full updates
    if (now - this.lastFullUpdate < this.updateInterval) {
      return;
    }

    const updateStart = performance.now();
    this.lastFullUpdate = now;

    const cameraPos = this.camera.position;

    // Reset metrics
    this.metrics.meshesPerLOD = [0, 0, 0, 0, 0];
    this.metrics.totalTrianglesVisible = 0;
    this.metrics.totalTrianglesFull = 0;
    this.metrics.drawCallsSaved = 0;

    let pendingCount = 0;

    for (const [_id, tracked] of this.trackedMeshes) {
      // Skip if recently updated (stagger updates across frames)
      if (now - tracked.lastUpdateTime < this.distanceCheckInterval) {
        continue;
      }
      tracked.lastUpdateTime = now;

      // Track pending simplifications
      if (tracked.simplificationPending) {
        pendingCount++;
      }

      // Calculate distance to root node
      const meshPos = tracked.rootNode.getAbsolutePosition();
      const distance = Vector3.Distance(cameraPos, meshPos);

      // Determine LOD level (including billboard)
      const config = tracked.config;
      let lodLevel: number;

      if (distance < config.distances[0]) {
        lodLevel = 0; // Full detail
      } else if (distance < config.distances[1]) {
        lodLevel = 1; // Medium
      } else if (distance < config.distances[2]) {
        if (config.useBillboard && distance >= config.billboardDistance) {
          lodLevel = 3; // Billboard
        } else {
          lodLevel = 2; // Low
        }
      } else {
        lodLevel = 4; // Culled
      }

      // Update if LOD changed
      if (lodLevel !== tracked.currentLOD) {
        this.applyLODLevel(tracked, lodLevel);
        tracked.currentLOD = lodLevel;
      }

      // Update metrics
      this.metrics.meshesPerLOD[lodLevel]++;

      // Count triangles
      this.metrics.totalTrianglesFull += tracked.originalTriangleCount;

      if (lodLevel < 4) {
        // Estimate visible triangles based on LOD level
        let qualityFactor: number;
        switch (lodLevel) {
          case 0:
            qualityFactor = 1;
            break;
          case 1:
            qualityFactor = config.quality[0];
            break;
          case 2:
            qualityFactor = config.quality[1];
            break;
          case 3: // Billboard
            qualityFactor = 0.01; // Billboard is essentially 2 triangles
            break;
          default:
            qualityFactor = 0;
        }
        this.metrics.totalTrianglesVisible += tracked.originalTriangleCount * qualityFactor;
      } else {
        // Culled - count as saved draw calls
        this.metrics.drawCallsSaved += tracked.meshes.length;
      }
    }

    // Update pending count
    this.metrics.pendingSimplifications = pendingCount;

    // Calculate savings
    if (this.metrics.totalTrianglesFull > 0) {
      this.metrics.triangleSavings =
        (1 - this.metrics.totalTrianglesVisible / this.metrics.totalTrianglesFull) * 100;
    }

    // Update FPS metrics
    this.metrics.avgFPS = this.calculateAverageFPS();
    this.metrics.performanceTargetMet = this.metrics.avgFPS >= 55; // 60fps with 5fps margin

    this.metrics.lastUpdateDuration = performance.now() - updateStart;
  }

  /**
   * Update FPS tracking for performance monitoring
   */
  private updateFPSTracking(now: number): void {
    if (this.lastFpsUpdate > 0) {
      const deltaMs = now - this.lastFpsUpdate;
      if (deltaMs > 0 && deltaMs < 500) {
        // Ignore huge gaps
        const fps = 1000 / deltaMs;
        this.fpsHistory.push(fps);
        if (this.fpsHistory.length > this.maxFpsHistoryLength) {
          this.fpsHistory.shift();
        }
      }
    }
    this.lastFpsUpdate = now;
  }

  /**
   * Calculate average FPS from history
   */
  private calculateAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return sum / this.fpsHistory.length;
  }

  /**
   * Apply a specific LOD level to a tracked mesh
   * LOD levels: 0=full, 1=medium, 2=low, 3=billboard, 4=culled
   */
  private applyLODLevel(tracked: TrackedMesh, lodLevel: number): void {
    const { meshes, billboardMesh, config } = tracked;

    // Handle billboard visibility
    if (billboardMesh) {
      billboardMesh.isVisible = lodLevel === 3; // Show billboard at level 3
    }

    // Update mesh visibility based on LOD level
    for (const mesh of meshes) {
      if (lodLevel === 4) {
        // Completely culled - disable all
        mesh.isVisible = false;
        mesh.setEnabled(false); // Also disable for performance
      } else if (lodLevel === 3 && billboardMesh) {
        // Billboard mode - hide actual meshes
        mesh.isVisible = false;
        mesh.setEnabled(false);
      } else {
        // LOD0, LOD1, or LOD2 - BabylonJS handles LOD mesh switching
        mesh.setEnabled(true);
        mesh.isVisible = true;
      }
    }

    // Update triangle count tracking
    if (lodLevel === 4 || lodLevel === 3) {
      tracked.currentTriangleCount = lodLevel === 3 ? 2 : 0; // Billboard = 2 triangles
    } else {
      const qualityFactor =
        lodLevel === 0 ? 1 : lodLevel === 1 ? config.quality[0] : config.quality[1];
      tracked.currentTriangleCount = Math.floor(tracked.originalTriangleCount * qualityFactor);
    }
  }

  /**
   * Force update all LOD levels (useful after camera changes)
   */
  forceUpdate(): void {
    this.lastFullUpdate = 0;
    for (const tracked of this.trackedMeshes.values()) {
      tracked.lastUpdateTime = 0;
      tracked.currentLOD = -1; // Force recalculation
    }
    this.update();
  }

  /**
   * Set the performance budget (max triangles per frame)
   */
  setTriangleBudget(maxTriangles: number): void {
    this.maxTrianglesPerFrame = maxTriangles;
  }

  /**
   * Get current LOD metrics
   */
  getMetrics(): LODMetrics {
    return { ...this.metrics };
  }

  /**
   * Get LOD level for a specific tracked mesh
   */
  getLODLevel(id: string): number {
    return this.trackedMeshes.get(id)?.currentLOD ?? -1;
  }

  /**
   * Check if a mesh ID is registered
   */
  isRegistered(id: string): boolean {
    return this.trackedMeshes.has(id);
  }

  /**
   * Apply LOD to an existing mesh using BabylonJS native LOD
   * This is the recommended approach for meshes loaded from GLB files
   */
  applyNativeLOD(mesh: Mesh, category: string = 'prop'): void {
    const config = this.getConfig(category);
    if (config.skip) return;

    // Use BabylonJS native LOD with null for culling
    // LOD1: Medium quality at medium distance
    // LOD2: Low quality at far distance
    // Cull: null at max distance

    // Create simplified versions using decimation
    const lod1 = this.createSimplifiedMesh(mesh, config.quality[0], 'lod1');
    const lod2 = this.createSimplifiedMesh(mesh, config.quality[1], 'lod2');

    if (lod1) {
      mesh.addLODLevel(config.distances[0], lod1);
    }
    if (lod2) {
      mesh.addLODLevel(config.distances[1], lod2);
    }

    // Cull at max distance
    mesh.addLODLevel(config.distances[2], null);
  }

  /**
   * Apply LOD to all meshes under a TransformNode
   */
  applyNativeLODToNode(rootNode: TransformNode, category: string = 'prop'): void {
    const meshes: Mesh[] = [];
    this.collectMeshes(rootNode, meshes);

    for (const mesh of meshes) {
      this.applyNativeLOD(mesh, category);
    }
  }

  /**
   * Get a detailed performance report for debugging
   */
  getPerformanceReport(): string {
    const m = this.metrics;
    const lines = [
      '=== LOD System Performance Report ===',
      `Tracked Meshes: ${m.totalTrackedMeshes}`,
      `LOD Distribution: LOD0=${m.meshesPerLOD[0]}, LOD1=${m.meshesPerLOD[1]}, LOD2=${m.meshesPerLOD[2]}, Billboard=${m.meshesPerLOD[3]}, Culled=${m.meshesPerLOD[4]}`,
      `Triangles: ${Math.round(m.totalTrianglesVisible).toLocaleString()} visible / ${Math.round(m.totalTrianglesFull).toLocaleString()} total`,
      `Triangle Savings: ${m.triangleSavings.toFixed(1)}%`,
      `Draw Calls Saved: ${m.drawCallsSaved}`,
      `Avg FPS: ${m.avgFPS.toFixed(1)}`,
      `Performance Target Met: ${m.performanceTargetMet ? 'YES' : 'NO'}`,
      `Update Duration: ${m.lastUpdateDuration.toFixed(2)}ms`,
      `Pending Simplifications: ${m.pendingSimplifications}`,
      '=====================================',
    ];
    return lines.join('\n');
  }

  /**
   * Log performance report to console
   */
  logPerformanceReport(): void {
    log.info(this.getPerformanceReport());
  }

  /**
   * Check if LOD system is providing performance benefit
   * Returns true if triangle savings exceed 20%
   */
  isProvidingBenefit(): boolean {
    return this.metrics.triangleSavings > 20;
  }

  /**
   * Get suggested LOD distance multiplier based on current performance
   * Returns a multiplier to adjust distances (< 1 = more aggressive, > 1 = less aggressive)
   */
  getSuggestedDistanceMultiplier(): number {
    if (this.metrics.avgFPS < 30) {
      return 0.5; // Very aggressive LOD needed
    } else if (this.metrics.avgFPS < 45) {
      return 0.7; // More aggressive LOD needed
    } else if (this.metrics.avgFPS < 55) {
      return 0.85; // Slightly more aggressive
    } else if (this.metrics.avgFPS > 58 && this.metrics.triangleSavings > 50) {
      return 1.1; // Can afford less aggressive LOD
    }
    return 1.0; // Current settings are good
  }

  /**
   * Auto-tune LOD distances based on performance
   */
  autoTune(): void {
    const multiplier = this.getSuggestedDistanceMultiplier();

    if (Math.abs(multiplier - 1.0) > 0.05) {
      log.info(
        `Auto-tuning: applying ${multiplier.toFixed(2)}x distance multiplier (FPS: ${this.metrics.avgFPS.toFixed(1)})`
      );

      for (const [category, config] of this.categoryConfigs) {
        if (!config.skip) {
          const newDistances: [number, number, number] = [
            Math.round(config.distances[0] * multiplier),
            Math.round(config.distances[1] * multiplier),
            Math.round(config.distances[2] * multiplier),
          ];
          this.categoryConfigs.set(category, {
            ...config,
            distances: newDistances,
            billboardDistance: Math.round(config.billboardDistance * multiplier),
          });
        }
      }
    }
  }

  /**
   * Dispose the LOD manager and clean up all LOD meshes
   */
  dispose(): void {
    // Unregister all tracked meshes
    const ids = Array.from(this.trackedMeshes.keys());
    for (const id of ids) {
      this.unregisterMesh(id);
    }

    this.trackedMeshes.clear();
    this.simplificationQueue = null;
    this.scene = null;
    this.camera = null;
    this.fpsHistory = [];
    this.pendingSimplifications.clear();
    this.simplificationCallbacks.clear();

    // Reset metrics
    this.metrics = {
      totalTrackedMeshes: 0,
      meshesPerLOD: [0, 0, 0, 0, 0],
      totalTrianglesVisible: 0,
      totalTrianglesFull: 0,
      triangleSavings: 0,
      lastUpdateDuration: 0,
      drawCallsSaved: 0,
      pendingSimplifications: 0,
      avgFPS: 60,
      performanceTargetMet: true,
    };

    log.info('Disposed');
  }
}

// Export singleton instance
export const LODManager = new LODManagerClass();

/**
 * Helper function to quickly apply LOD to a mesh
 * Uses the LODManager's decimation for actual geometry reduction
 */
export function applyLOD(
  mesh: Mesh,
  _distances: [number, number, number] = [20, 50, 100],
  _qualities: [number, number] = [0.5, 0.25]
): void {
  // Delegate to LODManager which has proper decimation
  LODManager.applyNativeLOD(mesh, 'prop');
}

/**
 * Apply LOD with custom configuration
 */
export function applyLODWithConfig(
  mesh: Mesh,
  config: {
    distances: [number, number, number];
    qualities: [number, number];
    useBillboard?: boolean;
  }
): void {
  const scene = mesh.getScene();
  if (!scene) return;

  // Use LODManager's helper method with custom config
  const customCategory = `custom_${mesh.id}`;
  LODManager.setCategoryConfig(customCategory, {
    distances: config.distances,
    quality: config.qualities,
    useBillboard: config.useBillboard ?? false,
    billboardDistance: config.distances[1],
    skip: false,
    useAsyncSimplification: false,
    minVerticesForLOD: 50,
  });

  LODManager.applyNativeLOD(mesh, customCategory);
}

/**
 * Get current LOD metrics for performance monitoring
 */
export function getLODMetrics(): LODMetrics {
  return LODManager.getMetrics();
}

/**
 * Check if LOD system is helping performance
 */
export function isLODEffective(): boolean {
  return LODManager.isProvidingBenefit();
}

/**
 * Log a detailed LOD performance report
 */
export function logLODPerformance(): void {
  LODManager.logPerformanceReport();
}
