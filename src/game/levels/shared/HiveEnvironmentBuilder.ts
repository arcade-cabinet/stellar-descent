/**
 * Shared HiveEnvironmentBuilder
 *
 * Reusable environment builder for hive-themed levels (The Breach, Hive Assault,
 * Extraction, Final Escape). Creates tunnels, chambers, bioluminescent lighting,
 * hive structures, and captured vehicles.
 *
 * Structural geometry (tunnels, chambers, organic growths) is loaded from GLB
 * models via AssetManager. Transient VFX (bioluminescent light bulbs) remain
 * as MeshBuilder primitives so they can be created cheaply at runtime.
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';

import '@babylonjs/core/Layers/effectLayerSceneComponent';

import { getLogger } from '../../core/Logger';

const log = getLogger('HiveEnvironmentBuilder');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Diameter of standard tunnel segments in meters */
export const TUNNEL_DIAMETER = 4;

/** Length of tunnel segments in meters */
export const TUNNEL_SEGMENT_LENGTH = 8;

/**
 * Color palette used by the hive environment builder.
 * Levels may extend or override these via their own constants.
 */
export const HIVE_COLORS = {
  /** Dark chitin surface */
  chitinDark: '#3A2A3A',
  /** Purple chitin highlights */
  chitinPurple: '#5A3A5A',
  /** Bioluminescent glow */
  bioGlow: '#4AC8C8',
  /** Dimmer bioluminescent glow */
  bioGlowDim: '#2A8888',
} as const;

// ============================================================================
// GLB ASSET PATHS
// ============================================================================

/** Base path for hive structure GLBs. */
const HIVE_GLB_BASE = '/assets/models/environment/hive';

/** Base path for alien flora GLBs (used for organic growths). */
const FLORA_GLB_BASE = '/assets/models/environment/alien-flora';

/**
 * GLB assets used for structural hive geometry.
 * Each entry maps a logical role to the GLB path under HIVE_GLB_BASE.
 */
const HIVE_STRUCTURE_GLBS = {
  /** Repeating tunnel segment -- elongated organic corridor */
  tunnel: `${HIVE_GLB_BASE}/building_terraformer.glb`,
  /** Large enclosed organic chamber */
  chamber: `${HIVE_GLB_BASE}/building_stomach.glb`,
} as const;

/**
 * Organic growth GLBs chosen from the alien flora catalog.
 * These replace the procedural sphere growths on tunnel walls and chamber
 * bioluminescent patches.
 */
const ORGANIC_GROWTH_GLBS = [
  `${FLORA_GLB_BASE}/alien_mushroom_01.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_03.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_05.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_07.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_common.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_tall_01.glb`,
] as const;

/**
 * Bioluminescent patch GLBs for chamber surfaces.
 * Glowing mushroom variants placed on chamber walls.
 */
const BIO_PATCH_GLBS = [
  `${FLORA_GLB_BASE}/alien_mushroom_02.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_04.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_06.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_red_01.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_laetiporus.glb`,
] as const;

/**
 * GLBs for organic growths on captured vehicles (hive absorption effect).
 * Uses mushroom and plant variants for alien biological matter.
 */
const VEHICLE_GROWTH_GLBS = [
  `${FLORA_GLB_BASE}/alien_mushroom_08.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_09.glb`,
  `${FLORA_GLB_BASE}/alien_mushroom_brown_01.glb`,
  `${FLORA_GLB_BASE}/alien_plant_1_big.glb`,
] as const;

/**
 * GLB for tendril-like connections from captured vehicles to hive walls.
 * Hanging moss provides an organic tendril appearance.
 */
const VEHICLE_TENDRIL_GLB = `${FLORA_GLB_BASE}/alien_hanging_moss_01.glb`;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Hive zones representing depth progression:
 * - upper: 0-50m depth, linear tunnels, drones only
 * - mid: 50-100m depth, branching tunnels, grunts/spitters
 * - lower: 100-150m depth, large chambers, all enemy types
 * - queen_chamber: 200m depth, boss arena
 */
export type HiveZone = 'upper' | 'mid' | 'lower' | 'queen_chamber';

/**
 * Organic tunnel segment in the hive.
 *
 * The `node` field is a TransformNode root of the GLB instance.
 * Use `node.setEnabled(false)` for visibility toggling.
 */
export interface TunnelSegment {
  node: TransformNode;
  position: Vector3;
  rotation: number;
  zone: HiveZone;
}

/**
 * Bioluminescent light source (glowing fungal growth).
 * Kept as MeshBuilder primitive -- transient VFX.
 */
export interface BioluminescentLight {
  mesh: Mesh;
  light: PointLight;
  baseIntensity: number;
  flickerSpeed: number;
  flickerPhase: number;
}

/**
 * Hive structure instance (GLB asset placement)
 */
export interface HiveStructure {
  node: import('@babylonjs/core/Meshes/transformNode').TransformNode;
  position: Vector3;
  type: 'birther' | 'brain' | 'claw' | 'crystals' | 'stomach' | 'terraformer' | 'undercrystal';
  zone: HiveZone;
  scale: number;
}

/**
 * Captured/crashed military vehicle being absorbed by the hive
 */
export interface CapturedVehicle {
  node: import('@babylonjs/core/Meshes/transformNode').TransformNode;
  position: Vector3;
  type: 'wraith' | 'phantom';
  zone: HiveZone;
  scale: number;
  organicGrowth: TransformNode[]; // Organic matter growing over the vehicle (GLB instances)
}

// ============================================================================
// ENVIRONMENT BUILDER CLASS
// ============================================================================

/**
 * Configuration options that let each level customise the builder without
 * subclassing. Every property is optional and falls back to a sensible default.
 */
export interface HiveEnvironmentBuilderOptions {
  /** Override the default color palette (partial overrides allowed). */
  colors?: Partial<typeof HIVE_COLORS>;
  /** Label used in console log messages (default: "HiveEnvironmentBuilder"). */
  logPrefix?: string;
}

/**
 * Builds the hive environment: tunnels, chambers, lighting, and structures.
 *
 * Structural geometry is loaded from GLB models. Call {@link loadHiveGeometry}
 * after construction to preload the required GLBs before creating segments.
 */
export class HiveEnvironmentBuilder {
  private scene: Scene;
  private glowLayer: GlowLayer | null = null;
  private tunnelSegments: TunnelSegment[] = [];
  private biolights: BioluminescentLight[] = [];
  private hiveStructures: HiveStructure[] = [];
  private capturedVehicles: CapturedVehicle[] = [];
  private structuresLoaded = false;
  private vehiclesLoaded = false;
  private geometryLoaded = false;
  private colors: typeof HIVE_COLORS;
  private logPrefix: string;

  constructor(scene: Scene, options?: HiveEnvironmentBuilderOptions) {
    this.scene = scene;
    this.colors = { ...HIVE_COLORS, ...options?.colors };
    this.logPrefix = options?.logPrefix ?? 'HiveEnvironmentBuilder';
  }

  /**
   * Initialize the glow layer for bioluminescence effects
   */
  setupGlowLayer(): GlowLayer {
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 0.8;
    return this.glowLayer;
  }

  /**
   * Preload GLB assets used for tunnels, chambers, organic growths, and vehicle decorations.
   * Must be called (and awaited) before {@link createTunnelSegment},
   * {@link createChamber}, or {@link placeCapturedVehicle}.
   */
  async loadHiveGeometry(): Promise<void> {
    const allPaths = [
      HIVE_STRUCTURE_GLBS.tunnel,
      HIVE_STRUCTURE_GLBS.chamber,
      ...ORGANIC_GROWTH_GLBS,
      ...BIO_PATCH_GLBS,
      ...VEHICLE_GROWTH_GLBS,
      VEHICLE_TENDRIL_GLB,
    ];

    try {
      await Promise.all(
        allPaths.map((glbPath) => {
          if (!AssetManager.isPathCached(glbPath)) {
            return AssetManager.loadAssetByPath(glbPath, this.scene);
          }
          return Promise.resolve(null);
        })
      );
      this.geometryLoaded = true;
      log.info(`[${this.logPrefix}] Hive geometry GLBs loaded (${allPaths.length} assets)`);
    } catch (error) {
      log.error(`[${this.logPrefix}] Failed to load hive geometry GLBs:`, error);
    }
  }

  /**
   * Load all hive structure GLB assets via AssetManager
   */
  async loadHiveStructures(): Promise<void> {
    const structureTypes = [
      'birther',
      'brain',
      'claw',
      'crystals',
      'stomach',
      'terraformer',
      'undercrystal',
    ] as const;

    try {
      await Promise.all(
        structureTypes.map((type) => AssetManager.loadAsset('structures', type, this.scene))
      );
      this.structuresLoaded = true;
      log.info(`[${this.logPrefix}] Hive structures loaded successfully`);
    } catch (error) {
      log.error(`[${this.logPrefix}] Failed to load hive structures:`, error);
    }
  }

  /**
   * Load captured alien vehicle GLB assets (Wraith and Phantom).
   */
  async loadCapturedVehicles(): Promise<void> {
    try {
      await Promise.all([
        AssetManager.loadAsset('vehicles', 'wraith', this.scene),
        AssetManager.loadAsset('vehicles', 'phantom', this.scene),
      ]);
      this.vehiclesLoaded = true;
      log.info(`[${this.logPrefix}] Captured vehicles loaded successfully`);
    } catch (error) {
      log.warn(`[${this.logPrefix}] Failed to load vehicle assets:`, error);
    }
  }

  /**
   * Create a tunnel segment at the specified position using a GLB model.
   *
   * Throws an error if the GLB is not preloaded. Call loadHiveGeometry() first.
   */
  createTunnelSegment(position: Vector3, rotation: number, zone: HiveZone): TunnelSegment {
    const index = this.tunnelSegments.length;

    let tunnelNode: TransformNode;

    if (this.geometryLoaded && AssetManager.isPathCached(HIVE_STRUCTURE_GLBS.tunnel)) {
      const instance = AssetManager.createInstanceByPath(
        HIVE_STRUCTURE_GLBS.tunnel,
        `tunnel_${index}`,
        this.scene,
        true,
        'environment'
      );

      if (instance) {
        tunnelNode = instance;
      } else {
        throw new Error(
          `[HiveEnvironmentBuilder] Failed to create tunnel instance from cached GLB`
        );
      }
    } else {
      throw new Error(`[HiveEnvironmentBuilder] Tunnel GLB not preloaded`);
    }

    tunnelNode.position = position;
    // For GLB models, apply rotation as Y-axis rotation.
    // The tunnel GLB is assumed to be oriented along Z-forward.
    tunnelNode.rotation = new Vector3(0, rotation, 0);

    // Scale the GLB to match the expected tunnel dimensions.
    // The terraformer GLB is scaled to approximate TUNNEL_DIAMETER width
    // and TUNNEL_SEGMENT_LENGTH depth.
    if (this.geometryLoaded) {
      tunnelNode.scaling = new Vector3(
        TUNNEL_DIAMETER / 4,
        TUNNEL_DIAMETER / 4,
        TUNNEL_SEGMENT_LENGTH / 8
      );
    }

    // Add organic growths on walls using flora GLBs
    const growthCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < growthCount; i++) {
      this.createOrganicGrowth(tunnelNode, i);
    }

    const segment: TunnelSegment = { node: tunnelNode, position, rotation, zone };
    this.tunnelSegments.push(segment);
    return segment;
  }

  /**
   * Create organic growth decoration on a tunnel wall using alien flora GLBs.
   *
   * Throws an error if the GLB is not preloaded. Call loadHiveGeometry() first.
   */
  private createOrganicGrowth(parent: TransformNode, index: number): void {
    const glbPath = ORGANIC_GROWTH_GLBS[index % ORGANIC_GROWTH_GLBS.length];

    if (this.geometryLoaded && AssetManager.isPathCached(glbPath)) {
      const instance = AssetManager.createInstanceByPath(
        glbPath,
        `growth_${parent.name}_${index}`,
        this.scene,
        false // No LOD for small decorations
      );

      if (instance) {
        const angle = Math.random() * Math.PI * 2;
        const radius = TUNNEL_DIAMETER / 2 - 0.2;
        instance.position.set(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * TUNNEL_SEGMENT_LENGTH * 0.8,
          Math.sin(angle) * radius
        );
        // Small random scale for organic variation
        const s = 0.15 + Math.random() * 0.25;
        instance.scaling.setAll(s);
        instance.rotation.set(
          (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.4
        );
        instance.parent = parent;
        return;
      } else {
        throw new Error(
          `[HiveEnvironmentBuilder] Failed to create organic growth instance from cached GLB: ${glbPath}`
        );
      }
    } else {
      throw new Error(`[HiveEnvironmentBuilder] Organic growth GLB not preloaded: ${glbPath}`);
    }
  }

  /**
   * Create a chamber at the specified position using a GLB model.
   *
   * Throws an error if the GLB is not preloaded. Call loadHiveGeometry() first.
   */
  async createChamber(position: Vector3, radius: number, zone: HiveZone): Promise<void> {
    if (this.geometryLoaded && AssetManager.isPathCached(HIVE_STRUCTURE_GLBS.chamber)) {
      const instance = AssetManager.createInstanceByPath(
        HIVE_STRUCTURE_GLBS.chamber,
        `chamber_${zone}_${this.tunnelSegments.length}`,
        this.scene,
        true,
        'environment'
      );

      if (instance) {
        instance.position = position;
        // Scale the stomach GLB to approximate the requested chamber radius.
        // The stomach model is roughly 4 units across, so scale by radius/2.
        const scaleFactor = radius / 2;
        instance.scaling = new Vector3(
          scaleFactor * (0.9 + Math.random() * 0.2),
          scaleFactor * 0.75,
          scaleFactor * (0.9 + Math.random() * 0.2)
        );
        // Slight random rotation for organic feel
        instance.rotation = new Vector3(
          (Math.random() - 0.5) * 0.1,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.1
        );

        // Add bioluminescent patches using flora GLBs
        await this.createChamberBioPatches(instance, position, radius, zone);
        return;
      } else {
        throw new Error(
          `[HiveEnvironmentBuilder] Failed to create chamber instance from cached GLB`
        );
      }
    } else {
      throw new Error(`[HiveEnvironmentBuilder] Chamber GLB not preloaded`);
    }
  }

  /**
   * Create bioluminescent patches inside a chamber using alien flora GLBs.
   */
  private async createChamberBioPatches(
    parent: TransformNode,
    _center: Vector3,
    radius: number,
    zone: HiveZone
  ): Promise<void> {
    for (let i = 0; i < 6; i++) {
      const glbPath = BIO_PATCH_GLBS[i % BIO_PATCH_GLBS.length];

      if (AssetManager.isPathCached(glbPath)) {
        const instance = AssetManager.createInstanceByPath(
          glbPath,
          `bioPatch_${zone}_${i}`,
          this.scene,
          false
        );

        if (instance) {
          const angle = Math.random() * Math.PI * 2;
          const vAngle = Math.random() * Math.PI - Math.PI / 2;
          // Position on the inside surface of the chamber
          instance.position.set(
            Math.cos(angle) * Math.cos(vAngle) * (radius - 0.5),
            Math.sin(vAngle) * (radius * 0.7 - 0.5),
            Math.sin(angle) * Math.cos(vAngle) * (radius - 0.5)
          );
          const s = 0.3 + Math.random() * 0.3;
          instance.scaling.setAll(s);
          instance.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.5
          );
          instance.parent = parent;
        } else {
          throw new Error(
            `[HiveEnvironmentBuilder] Failed to create bio patch instance from cached GLB: ${glbPath}`
          );
        }
      } else {
        throw new Error(`[HiveEnvironmentBuilder] Bio patch GLB not preloaded: ${glbPath}`);
      }
    }
  }

  /**
   * Create a bioluminescent light source (glowing fungal growth).
   *
   * This remains as a MeshBuilder primitive -- it is a transient VFX element
   * (small emissive sphere + point light) that does not benefit from GLB loading.
   */
  createBiolight(position: Vector3, intensity: number): BioluminescentLight {
    const index = this.biolights.length;

    // Glowing fungal bulb
    const bulb = MeshBuilder.CreateSphere(
      `biolight_${index}`,
      { diameter: 0.3 + Math.random() * 0.2, segments: 8 },
      this.scene
    );
    const bulbMat = new StandardMaterial(`biolightMat_${index}`, this.scene);
    bulbMat.emissiveColor = Color3.FromHexString(this.colors.bioGlow);
    bulbMat.disableLighting = true;
    bulb.material = bulbMat;
    bulb.position = position;

    // Point light
    const light = new PointLight(`biolightPL_${index}`, position, this.scene);
    light.diffuse = Color3.FromHexString(this.colors.bioGlow);
    light.intensity = intensity;
    light.range = 8;

    const biolight = {
      mesh: bulb,
      light,
      baseIntensity: intensity,
      flickerSpeed: 1 + Math.random() * 2,
      flickerPhase: Math.random() * Math.PI * 2,
    };

    this.biolights.push(biolight);
    return biolight;
  }

  /**
   * Place a hive structure instance at the specified location
   */
  placeStructure(
    type: HiveStructure['type'],
    position: Vector3,
    zone: HiveZone,
    scale: number,
    rotationY: number
  ): HiveStructure | null {
    if (!this.structuresLoaded) {
      log.warn(`[${this.logPrefix}] Structures not loaded, skipping placement`);
      return null;
    }

    const instanceName = `hive_${type}_${this.hiveStructures.length}`;
    const node = AssetManager.createInstance('structures', type, instanceName, this.scene);

    if (!node) {
      log.warn(`[${this.logPrefix}] Failed to create instance for structure: ${type}`);
      return null;
    }

    // Position and transform the structure
    node.position = position.clone();
    node.scaling.setAll(scale);
    node.rotation.y = rotationY;

    // Add slight random rotation variation for organic feel
    node.rotation.x = (Math.random() - 0.5) * 0.1;
    node.rotation.z = (Math.random() - 0.5) * 0.1;

    const structure = {
      node,
      position: position.clone(),
      type,
      zone,
      scale,
    };

    this.hiveStructures.push(structure);
    return structure;
  }

  /**
   * Place a captured vehicle with organic growth effects using GLB models.
   *
   * Requires both vehicles and hive geometry to be preloaded. Call
   * {@link loadCapturedVehicles} and {@link loadHiveGeometry} first.
   */
  placeCapturedVehicle(
    type: 'wraith' | 'phantom',
    position: Vector3,
    zone: HiveZone,
    scale: number,
    rotation: Vector3
  ): CapturedVehicle | null {
    if (!this.vehiclesLoaded) {
      log.warn(`[${this.logPrefix}] Vehicles not loaded, skipping placement`);
      return null;
    }

    if (!this.geometryLoaded) {
      log.warn(`[${this.logPrefix}] Hive geometry not loaded, skipping vehicle growth decorations`);
    }

    const instance = AssetManager.createInstance(
      'vehicles',
      type,
      `captured_${type}_${this.capturedVehicles.length}`,
      this.scene
    );

    if (!instance) {
      log.warn(`[${this.logPrefix}] Failed to create instance of ${type}`);
      return null;
    }

    instance.position = position;
    instance.scaling.setAll(scale);
    instance.rotation = rotation;

    // Create organic growth over the vehicle using GLB flora assets
    const organicGrowth: TransformNode[] = [];
    const growthCount = 3 + Math.floor(Math.random() * 3);
    const vehicleIndex = this.capturedVehicles.length;

    for (let j = 0; j < growthCount; j++) {
      const glbPath = VEHICLE_GROWTH_GLBS[j % VEHICLE_GROWTH_GLBS.length];

      if (this.geometryLoaded && AssetManager.isPathCached(glbPath)) {
        const growth = AssetManager.createInstanceByPath(
          glbPath,
          `growth_${type}_${vehicleIndex}_${j}`,
          this.scene,
          false // No LOD for small decorations
        );

        if (growth) {
          // Position growth on the vehicle surface with random offsets
          growth.position.set(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.5,
            (Math.random() - 0.5) * 3
          );
          // Random scale for organic variation
          const s = 0.3 + Math.random() * 0.4;
          growth.scaling.setAll(s);
          growth.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.5
          );
          growth.parent = instance;
          organicGrowth.push(growth);
        }
      }
    }

    // Add tendril-like connections to surrounding hive using hanging moss GLB
    for (let k = 0; k < 2; k++) {
      if (this.geometryLoaded && AssetManager.isPathCached(VEHICLE_TENDRIL_GLB)) {
        const tendril = AssetManager.createInstanceByPath(
          VEHICLE_TENDRIL_GLB,
          `tendril_${type}_${vehicleIndex}_${k}`,
          this.scene,
          false
        );

        if (tendril) {
          tendril.position.set(
            (Math.random() - 0.5) * 2,
            1 + Math.random(),
            (Math.random() - 0.5) * 2
          );
          // Scale to approximate tendril dimensions
          const tendrilScale = 0.4 + Math.random() * 0.3;
          tendril.scaling.set(tendrilScale, tendrilScale * 1.5, tendrilScale);
          tendril.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI,
            (Math.random() - 0.5) * 0.5
          );
          tendril.parent = instance;
          organicGrowth.push(tendril);
        }
      }
    }

    // Add eerie dim glow underneath (damaged systems)
    const damageLight = new PointLight(
      `vehicleDamage_${vehicleIndex}`,
      position.add(new Vector3(0, 0.5, 0)),
      this.scene
    );
    damageLight.diffuse = Color3.FromHexString('#602020');
    damageLight.intensity = 0.15;
    damageLight.range = 4;

    const vehicle: CapturedVehicle = {
      node: instance,
      position,
      type,
      zone,
      scale,
      organicGrowth,
    };

    this.capturedVehicles.push(vehicle);
    log.info(`[${this.logPrefix}] Placed captured ${type} at ${zone}`);
    return vehicle;
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  getTunnelSegments(): TunnelSegment[] {
    return this.tunnelSegments;
  }

  getBiolights(): BioluminescentLight[] {
    return this.biolights;
  }

  getHiveStructures(): HiveStructure[] {
    return this.hiveStructures;
  }

  getCapturedVehicles(): CapturedVehicle[] {
    return this.capturedVehicles;
  }

  getGlowLayer(): GlowLayer | null {
    return this.glowLayer;
  }

  isGeometryLoaded(): boolean {
    return this.geometryLoaded;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    // Dispose tunnel segments
    for (const segment of this.tunnelSegments) {
      segment.node.dispose();
    }
    this.tunnelSegments = [];

    // Dispose biolights
    for (const biolight of this.biolights) {
      biolight.mesh.dispose();
      biolight.light.dispose();
    }
    this.biolights = [];

    // Dispose hive structures
    for (const structure of this.hiveStructures) {
      structure.node.dispose();
    }
    this.hiveStructures = [];

    // Dispose captured vehicles
    for (const vehicle of this.capturedVehicles) {
      for (const growth of vehicle.organicGrowth) {
        growth.dispose();
      }
      vehicle.node.dispose();
    }
    this.capturedVehicles = [];

    // Dispose glow layer
    this.glowLayer?.dispose();
    this.glowLayer = null;

    // Clear asset cache
    AssetManager.clearCache();
  }
}

// ============================================================================
// UPDATE UTILITIES
// ============================================================================

/**
 * Update bioluminescent light flickering effect
 */
export function updateBiolights(biolights: BioluminescentLight[], time: number): void {
  for (const biolight of biolights) {
    const flicker = Math.sin(time * biolight.flickerSpeed + biolight.flickerPhase) * 0.2 + 0.8;
    biolight.light.intensity = biolight.baseIntensity * flicker;
  }
}
