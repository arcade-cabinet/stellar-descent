/**
 * TheBreachLevel - Environment Creation
 *
 * Contains all tunnel, chamber, and bioluminescent environment creation.
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { COLORS, TUNNEL_DIAMETER, TUNNEL_SEGMENT_LENGTH } from './constants';
import type {
  BioluminescentLight,
  CapturedVehicle,
  HiveStructure,
  HiveZone,
  TunnelSegment,
} from './types';

import '@babylonjs/core/Layers/effectLayerSceneComponent';

// ============================================================================
// ENVIRONMENT BUILDER CLASS
// ============================================================================

/**
 * Builds the hive environment: tunnels, chambers, lighting, and structures.
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

  constructor(scene: Scene) {
    this.scene = scene;
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
      console.log('[TheBreachLevel] Hive structures loaded successfully');
    } catch (error) {
      console.error('[TheBreachLevel] Failed to load hive structures:', error);
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
      console.log('[TheBreachLevel] Captured vehicles loaded successfully');
    } catch (error) {
      console.warn('[TheBreachLevel] Failed to load vehicle assets:', error);
    }
  }

  /**
   * Create a tunnel segment at the specified position
   */
  createTunnelSegment(position: Vector3, rotation: number, zone: HiveZone): TunnelSegment {
    const index = this.tunnelSegments.length;
    const tunnel = MeshBuilder.CreateCylinder(
      `tunnel_${index}`,
      {
        height: TUNNEL_SEGMENT_LENGTH,
        diameter: TUNNEL_DIAMETER,
        tessellation: 12,
        sideOrientation: 1, // Inside-out
      },
      this.scene
    );

    const mat = new StandardMaterial(`tunnelMat_${index}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(COLORS.chitinDark);
    mat.specularColor = new Color3(0.05, 0.05, 0.08);
    tunnel.material = mat;

    tunnel.position = position;
    tunnel.rotation.x = Math.PI / 2; // Lay horizontal
    tunnel.rotation.y = rotation;

    // Add organic growths on walls
    const growthCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < growthCount; i++) {
      this.createOrganicGrowth(tunnel, i);
    }

    const segment = { mesh: tunnel, position, rotation, zone };
    this.tunnelSegments.push(segment);
    return segment;
  }

  /**
   * Create organic growth decoration on a tunnel wall
   */
  private createOrganicGrowth(parent: Mesh, index: number): void {
    const growth = MeshBuilder.CreateSphere(
      `growth_${parent.name}_${index}`,
      {
        diameterX: 0.2 + Math.random() * 0.3,
        diameterY: 0.3 + Math.random() * 0.4,
        diameterZ: 0.2 + Math.random() * 0.3,
        segments: 6,
      },
      this.scene
    );

    const mat = new StandardMaterial(`growthMat_${parent.name}_${index}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(COLORS.chitinPurple);
    mat.emissiveColor = Color3.FromHexString(COLORS.bioGlowDim).scale(0.3);
    growth.material = mat;

    const angle = Math.random() * Math.PI * 2;
    const radius = TUNNEL_DIAMETER / 2 - 0.2;
    growth.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * TUNNEL_SEGMENT_LENGTH * 0.8,
      Math.sin(angle) * radius
    );
    growth.parent = parent;
  }

  /**
   * Create a spherical chamber at the specified position
   */
  createChamber(position: Vector3, radius: number, zone: HiveZone): void {
    const chamber = MeshBuilder.CreateSphere(
      `chamber_${zone}`,
      {
        diameterX: radius * 2 * (0.9 + Math.random() * 0.2),
        diameterY: radius * 1.5,
        diameterZ: radius * 2 * (0.9 + Math.random() * 0.2),
        segments: 16,
        sideOrientation: 1,
      },
      this.scene
    );

    const mat = new StandardMaterial(`chamberMat_${zone}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(COLORS.chitinDark);
    mat.specularColor = new Color3(0.05, 0.05, 0.08);
    chamber.material = mat;
    chamber.position = position;

    // Add bioluminescent patches
    for (let i = 0; i < 6; i++) {
      const patch = MeshBuilder.CreateDisc(
        `bioPatch_${zone}_${i}`,
        { radius: 0.5 + Math.random() * 0.5, tessellation: 8 },
        this.scene
      );
      const patchMat = new StandardMaterial(`bioPatchMat_${zone}_${i}`, this.scene);
      patchMat.emissiveColor = Color3.FromHexString(COLORS.bioGlow);
      patchMat.alpha = 0.6;
      patchMat.disableLighting = true;
      patch.material = patchMat;

      const angle = Math.random() * Math.PI * 2;
      const vAngle = Math.random() * Math.PI - Math.PI / 2;
      patch.position.set(
        position.x + Math.cos(angle) * Math.cos(vAngle) * (radius - 0.5),
        position.y + Math.sin(vAngle) * (radius * 0.7 - 0.5),
        position.z + Math.sin(angle) * Math.cos(vAngle) * (radius - 0.5)
      );
      patch.lookAt(position);
    }
  }

  /**
   * Create a bioluminescent light source (glowing fungal growth)
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
    bulbMat.emissiveColor = Color3.FromHexString(COLORS.bioGlow);
    bulbMat.disableLighting = true;
    bulb.material = bulbMat;
    bulb.position = position;

    // Point light
    const light = new PointLight(`biolightPL_${index}`, position, this.scene);
    light.diffuse = Color3.FromHexString(COLORS.bioGlow);
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
      console.warn('[TheBreachLevel] Structures not loaded, skipping placement');
      return null;
    }

    const instanceName = `hive_${type}_${this.hiveStructures.length}`;
    const node = AssetManager.createInstance('structures', type, instanceName, this.scene);

    if (!node) {
      console.warn(`[TheBreachLevel] Failed to create instance for structure: ${type}`);
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
   * Place a captured vehicle with organic growth effects.
   */
  placeCapturedVehicle(
    type: 'wraith' | 'phantom',
    position: Vector3,
    zone: HiveZone,
    scale: number,
    rotation: Vector3
  ): CapturedVehicle | null {
    if (!this.vehiclesLoaded) {
      console.warn('[TheBreachLevel] Vehicles not loaded, skipping placement');
      return null;
    }

    const instance = AssetManager.createInstance(
      'vehicles',
      type,
      `captured_${type}_${this.capturedVehicles.length}`,
      this.scene
    );

    if (!instance) {
      console.warn(`[TheBreachLevel] Failed to create instance of ${type}`);
      return null;
    }

    instance.position = position;
    instance.scaling.setAll(scale);
    instance.rotation = rotation;

    // Create organic growth over the vehicle (hive absorption)
    const organicGrowth: Mesh[] = [];
    const growthCount = 3 + Math.floor(Math.random() * 3);

    const growthMat = new StandardMaterial(
      `vehicleGrowth_${this.capturedVehicles.length}`,
      this.scene
    );
    growthMat.diffuseColor = Color3.FromHexString(COLORS.chitinPurple);
    growthMat.emissiveColor = Color3.FromHexString(COLORS.bioGlowDim).scale(0.2);

    for (let j = 0; j < growthCount; j++) {
      const growth = MeshBuilder.CreateSphere(
        `growth_${type}_${this.capturedVehicles.length}_${j}`,
        {
          diameterX: 0.8 + Math.random() * 1.2,
          diameterY: 0.5 + Math.random() * 0.8,
          diameterZ: 0.8 + Math.random() * 1.2,
          segments: 8,
        },
        this.scene
      );
      growth.material = growthMat;

      // Position growth on the vehicle surface
      growth.position.set(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 3
      );
      growth.parent = instance;
      organicGrowth.push(growth);
    }

    // Add tendril-like connections to surrounding hive
    const tendrilMat = new StandardMaterial(`tendril_${this.capturedVehicles.length}`, this.scene);
    tendrilMat.diffuseColor = Color3.FromHexString(COLORS.chitinDark);

    for (let k = 0; k < 2; k++) {
      const tendril = MeshBuilder.CreateCylinder(
        `tendril_${type}_${this.capturedVehicles.length}_${k}`,
        {
          height: 2 + Math.random() * 2,
          diameterTop: 0.1,
          diameterBottom: 0.3,
          tessellation: 6,
        },
        this.scene
      );
      tendril.material = tendrilMat;
      tendril.position.set((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2);
      tendril.rotation.set(
        (Math.random() - 0.5) * 0.5,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.5
      );
      tendril.parent = instance;
      organicGrowth.push(tendril);
    }

    // Add eerie dim glow underneath (damaged systems)
    const damageLight = new PointLight(
      `vehicleDamage_${this.capturedVehicles.length}`,
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
    console.log(`[TheBreachLevel] Placed captured ${type} at ${zone}`);
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

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    // Dispose tunnel segments
    for (const segment of this.tunnelSegments) {
      segment.mesh.dispose();
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
