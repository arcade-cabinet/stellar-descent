/**
 * HazardSystem - Environmental hazards that damage and affect the player
 *
 * Provides comprehensive environmental hazards for gameplay:
 *
 * ## Zone-Based Hazards (meter-drain systems):
 * - **Cold Exposure** (Southern Ice): Damage over time, thermal vents for warmth
 * - **Toxic Atmosphere** (Hive levels): Spore clouds deal DoT, quick traversal required
 * - **Low Oxygen** (Station areas): Breached sections drain oxygen meter
 * - **Radiation** (Mining Depths): Hot zones cause damage, suits/shields help
 *
 * ## Instant/Damage Hazards:
 * - **Acid Pool**: Green glowing area, DOT damage (5 dmg/sec)
 * - **Fire**: Orange flickering, rapid damage (10 dmg/sec)
 * - **Electricity**: Sparking area, burst damage (15 dmg every 2 sec)
 * - **Toxic Gas**: Green fog, DOT + vision impairment
 * - **Freezing Zone**: Blue mist, slows player + DOT
 * - **Explosive Barrel**: Explodes when shot, area damage
 * - **Laser Grid**: Instant high damage on contact
 * - **Falling Debris**: Periodic falling rocks in unstable areas
 *
 * Each hazard type has:
 * - Configurable damage rates and thresholds
 * - Visual screen effects (frost overlay, green tint, etc.)
 * - Audio cues (bubbling, crackling, buzzing, etc.)
 * - Safe zones that provide relief (for zone-based hazards)
 *
 * Integration:
 * - Works with ConditionHUD for meter display
 * - Triggers PlayerVoice comments based on conditions
 * - Integrates with PostProcessManager for visual effects
 * - Spatial partitioning for performance optimization
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import { getLogger } from '../core/Logger';
import { particleManager } from '../effects/ParticleManager';

const log = getLogger('HazardSystem');

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Types of zone-based environmental hazards (meter drain systems) */
export type HazardType = 'cold' | 'toxic' | 'oxygen' | 'radiation';

/** Types of instant/damage hazards */
export type InstantHazardType =
  | 'acid_pool'
  | 'fire'
  | 'electricity'
  | 'toxic_gas'
  | 'freezing'
  | 'explosive_barrel'
  | 'laser_grid'
  | 'falling_debris';

/** Combined hazard type */
export type AnyHazardType = HazardType | InstantHazardType;

/** Configuration for a zone-based hazard zone */
export interface HazardZoneConfig {
  id: string;
  type: HazardType;
  position: Vector3;
  radius: number;
  /** Height of the zone (default: infinite) */
  height?: number;
  /** Damage per second when fully exposed */
  damageRate: number;
  /** How fast the exposure meter drains (units per second) */
  exposureDrainRate: number;
  /** Whether this is a safe zone (provides relief) */
  isSafeZone?: boolean;
  /** Recovery rate if this is a safe zone */
  recoveryRate?: number;
  /** Custom intensity multiplier (0-1) */
  intensity?: number;
}

/** Configuration for instant damage hazards */
export interface InstantHazardConfig {
  id: string;
  type: InstantHazardType;
  position: Vector3;
  /** Radius for collision detection */
  radius: number;
  /** Height of the hazard zone */
  height?: number;
  /** Damage per application (meaning varies by type) */
  damage: number;
  /** For periodic hazards: interval in seconds between damage */
  damageInterval?: number;
  /** For explosive: whether already detonated */
  detonated?: boolean;
  /** For falling debris: trigger chance per second */
  triggerChance?: number;
  /** Whether this hazard is currently active */
  active?: boolean;
  /** For moving hazards: velocity */
  velocity?: Vector3;
  /** Custom visual parameters */
  visualScale?: number;
  /** Custom color override */
  color?: Color3;
}

/** Active zone hazard tracking */
export interface HazardZone extends HazardZoneConfig {
  isActive: boolean;
}

/** Active instant hazard with visual components */
export interface InstantHazard extends InstantHazardConfig {
  isActive: boolean;
  mesh?: Mesh | TransformNode;
  light?: PointLight;
  lastDamageTime: number;
  animationPhase: number;
  soundId?: string;
}

/** Hazard state for a specific zone hazard type */
export interface HazardState {
  type: HazardType;
  /** Current exposure meter (0-100, 0 = fully exposed/danger) */
  meter: number;
  /** Maximum meter value */
  maxMeter: number;
  /** Is player currently in a hazard zone */
  isInHazard: boolean;
  /** Is player currently in a safe zone */
  isInSafeZone: boolean;
  /** Current intensity (0-1) */
  intensity: number;
  /** Time spent in current hazard (seconds) */
  exposureTime: number;
  /** Accumulated damage not yet applied */
  damageAccumulator: number;
}

/** Hazard preset configurations by type */
export interface HazardPreset {
  name: string;
  maxMeter: number;
  baseDrainRate: number;
  baseRecoveryRate: number;
  baseDamageRate: number;
  damageThreshold: number; // Meter value below which damage starts
  warningThreshold: number;
  criticalThreshold: number;
  screenEffectColor: Color4;
  screenEffectIntensity: number;
}

/** Instant hazard preset configuration */
export interface InstantHazardPreset {
  name: string;
  baseDamage: number;
  damageInterval: number;
  color: Color3;
  emissiveColor: Color3;
  glowIntensity: number;
  soundEffect: string;
  screenEffectColor?: Color4;
  screenEffectIntensity?: number;
  slowFactor?: number;
}

/** Callback for hazard events */
export interface HazardCallbacks {
  onDamage?: (damage: number, hazardType: AnyHazardType, direction?: Vector3) => void;
  onWarning?: (hazardType: AnyHazardType, isCritical: boolean) => void;
  onRecovered?: (hazardType: HazardType) => void;
  onEnterHazard?: (hazardType: AnyHazardType) => void;
  onExitHazard?: (hazardType: AnyHazardType) => void;
  onEnterSafeZone?: (hazardType: HazardType) => void;
  onExitSafeZone?: (hazardType: HazardType) => void;
  onExplosion?: (position: Vector3, radius: number, damage: number) => void;
  onScreenEffect?: (color: Color4, intensity: number, duration: number) => void;
  onScreenShake?: (intensity: number) => void;
  onSlowEffect?: (factor: number, duration: number) => void;
  onVisionImpairment?: (intensity: number, duration: number) => void;
}

/** Player feedback state */
export interface HazardFeedback {
  damageDirection: Vector3 | null;
  screenTint: Color4 | null;
  screenShakeIntensity: number;
  slowFactor: number;
  visionImpairment: number;
  warningMessage: string | null;
}

// ============================================================================
// HAZARD PRESETS
// ============================================================================

export const HAZARD_PRESETS: Record<HazardType, HazardPreset> = {
  cold: {
    name: 'Cold Exposure',
    maxMeter: 100,
    baseDrainRate: 8, // Empty in ~12.5 seconds
    baseRecoveryRate: 25, // Recover fully in ~4 seconds at thermal vent
    baseDamageRate: 10, // 10 HP/sec when meter is empty
    damageThreshold: 0, // Damage only when meter is 0
    warningThreshold: 40,
    criticalThreshold: 15,
    screenEffectColor: new Color4(0.5, 0.7, 1.0, 0.3), // Ice blue
    screenEffectIntensity: 0.4,
  },
  toxic: {
    name: 'Toxic Atmosphere',
    maxMeter: 100,
    baseDrainRate: 15, // Faster drain - need to move quickly
    baseRecoveryRate: 20,
    baseDamageRate: 8,
    damageThreshold: 0,
    warningThreshold: 50,
    criticalThreshold: 25,
    screenEffectColor: new Color4(0.2, 0.8, 0.2, 0.25), // Toxic green
    screenEffectIntensity: 0.35,
  },
  oxygen: {
    name: 'Low Oxygen',
    maxMeter: 100,
    baseDrainRate: 5, // Slower drain - time to find sealed room
    baseRecoveryRate: 30, // Fast recovery in pressurized area
    baseDamageRate: 15, // Higher damage when suffocating
    damageThreshold: 10, // Start taking damage at 10%
    warningThreshold: 40,
    criticalThreshold: 20,
    screenEffectColor: new Color4(0.1, 0.1, 0.2, 0.4), // Darkening vision
    screenEffectIntensity: 0.5,
  },
  radiation: {
    name: 'Radiation',
    maxMeter: 100,
    baseDrainRate: 12,
    baseRecoveryRate: 5, // Slow recovery - radiation lingers
    baseDamageRate: 5, // Lower but constant damage
    damageThreshold: 50, // Start taking damage at 50%
    warningThreshold: 70,
    criticalThreshold: 40,
    screenEffectColor: new Color4(0.9, 0.7, 0.2, 0.2), // Yellow/amber
    screenEffectIntensity: 0.3,
  },
};

export const INSTANT_HAZARD_PRESETS: Record<InstantHazardType, InstantHazardPreset> = {
  acid_pool: {
    name: 'Acid Pool',
    baseDamage: 5, // Per second
    damageInterval: 0.2,
    color: new Color3(0.2, 0.9, 0.2),
    emissiveColor: new Color3(0.1, 0.6, 0.1),
    glowIntensity: 0.8,
    soundEffect: 'acid_sizzle',
    screenEffectColor: new Color4(0.2, 0.8, 0.2, 0.15),
    screenEffectIntensity: 0.2,
  },
  fire: {
    name: 'Fire',
    baseDamage: 10, // Per second
    damageInterval: 0.1,
    color: new Color3(1.0, 0.5, 0.1),
    emissiveColor: new Color3(1.0, 0.3, 0.05),
    glowIntensity: 1.5,
    soundEffect: 'fire_crackling',
    screenEffectColor: new Color4(1.0, 0.5, 0.1, 0.2),
    screenEffectIntensity: 0.3,
  },
  electricity: {
    name: 'Electricity',
    baseDamage: 15, // Per burst
    damageInterval: 2.0,
    color: new Color3(0.5, 0.7, 1.0),
    emissiveColor: new Color3(0.3, 0.5, 1.0),
    glowIntensity: 2.0,
    soundEffect: 'electricity_buzz',
    screenEffectColor: new Color4(0.5, 0.7, 1.0, 0.3),
    screenEffectIntensity: 0.4,
  },
  toxic_gas: {
    name: 'Toxic Gas',
    baseDamage: 3, // Per second
    damageInterval: 0.5,
    color: new Color3(0.4, 0.7, 0.3),
    emissiveColor: new Color3(0.2, 0.5, 0.15),
    glowIntensity: 0.4,
    soundEffect: 'gas_hiss',
    screenEffectColor: new Color4(0.3, 0.6, 0.2, 0.4),
    screenEffectIntensity: 0.5,
  },
  freezing: {
    name: 'Freezing Zone',
    baseDamage: 2, // Per second
    damageInterval: 0.5,
    color: new Color3(0.6, 0.8, 1.0),
    emissiveColor: new Color3(0.4, 0.6, 1.0),
    glowIntensity: 0.6,
    soundEffect: 'frost_crystals',
    screenEffectColor: new Color4(0.6, 0.8, 1.0, 0.35),
    screenEffectIntensity: 0.4,
    slowFactor: 0.5,
  },
  explosive_barrel: {
    name: 'Explosive Barrel',
    baseDamage: 50, // On explosion
    damageInterval: 0, // One-time
    color: new Color3(0.8, 0.2, 0.1),
    emissiveColor: new Color3(0.4, 0.1, 0.05),
    glowIntensity: 0.3,
    soundEffect: 'explosion',
  },
  laser_grid: {
    name: 'Laser Grid',
    baseDamage: 30, // On contact
    damageInterval: 0.5,
    color: new Color3(1.0, 0.1, 0.1),
    emissiveColor: new Color3(1.0, 0.05, 0.05),
    glowIntensity: 2.5,
    soundEffect: 'laser_hum',
    screenEffectColor: new Color4(1.0, 0.2, 0.2, 0.3),
    screenEffectIntensity: 0.5,
  },
  falling_debris: {
    name: 'Falling Debris',
    baseDamage: 25, // Per hit
    damageInterval: 0, // Random intervals
    color: new Color3(0.5, 0.4, 0.3),
    emissiveColor: new Color3(0, 0, 0),
    glowIntensity: 0,
    soundEffect: 'debris_rumble',
  },
};

// ============================================================================
// SPATIAL PARTITIONING GRID
// ============================================================================

interface SpatialCell {
  zoneHazards: Set<string>;
  instantHazards: Set<string>;
}

class SpatialGrid {
  private cellSize: number;
  private cells: Map<string, SpatialCell> = new Map();

  constructor(cellSize: number = 20) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  private getCell(key: string): SpatialCell {
    let cell = this.cells.get(key);
    if (!cell) {
      cell = { zoneHazards: new Set(), instantHazards: new Set() };
      this.cells.set(key, cell);
    }
    return cell;
  }

  addZoneHazard(id: string, position: Vector3, radius: number): void {
    const minX = position.x - radius;
    const maxX = position.x + radius;
    const minZ = position.z - radius;
    const maxZ = position.z + radius;

    for (let x = minX; x <= maxX; x += this.cellSize) {
      for (let z = minZ; z <= maxZ; z += this.cellSize) {
        const key = this.getCellKey(x, z);
        this.getCell(key).zoneHazards.add(id);
      }
    }
  }

  addInstantHazard(id: string, position: Vector3, radius: number): void {
    const minX = position.x - radius;
    const maxX = position.x + radius;
    const minZ = position.z - radius;
    const maxZ = position.z + radius;

    for (let x = minX; x <= maxX; x += this.cellSize) {
      for (let z = minZ; z <= maxZ; z += this.cellSize) {
        const key = this.getCellKey(x, z);
        this.getCell(key).instantHazards.add(id);
      }
    }
  }

  removeZoneHazard(id: string): void {
    for (const cell of this.cells.values()) {
      cell.zoneHazards.delete(id);
    }
  }

  removeInstantHazard(id: string): void {
    for (const cell of this.cells.values()) {
      cell.instantHazards.delete(id);
    }
  }

  getNearbyZoneHazards(position: Vector3): Set<string> {
    const key = this.getCellKey(position.x, position.z);
    const cell = this.cells.get(key);
    return cell?.zoneHazards ?? new Set();
  }

  getNearbyInstantHazards(position: Vector3): Set<string> {
    const key = this.getCellKey(position.x, position.z);
    const cell = this.cells.get(key);
    return cell?.instantHazards ?? new Set();
  }

  clear(): void {
    this.cells.clear();
  }
}

// ============================================================================
// HAZARD SYSTEM CLASS
// ============================================================================

export class HazardSystem {
  private scene: Scene;
  private zones: Map<string, HazardZone> = new Map();
  private instantHazards: Map<string, InstantHazard> = new Map();
  private states: Map<HazardType, HazardState> = new Map();
  private callbacks: HazardCallbacks = {};
  private playerPosition: Vector3 = Vector3.Zero();
  private isDisposed = false;
  private spatialGrid: SpatialGrid;

  // Tracking for warning triggers (avoid spam)
  private lastWarningTime: Map<AnyHazardType, number> = new Map();
  private readonly WARNING_COOLDOWN = 5000; // ms between warnings

  // Damage tick interval
  private readonly DAMAGE_TICK_INTERVAL = 0.5; // seconds

  // Immunity frames tracking
  private lastDamageTime = 0;
  private readonly IMMUNITY_DURATION = 500; // 0.5s immunity frames

  // Equipment modifiers
  private radiationResistance = 0; // 0-1, from suits/shields
  private coldResistance = 0;
  private toxinResistance = 0;

  // Current feedback state
  private feedback: HazardFeedback = {
    damageDirection: null,
    screenTint: null,
    screenShakeIntensity: 0,
    slowFactor: 1.0,
    visionImpairment: 0,
    warningMessage: null,
  };

  // Active hazards the player is currently in
  private activeInstantHazards: Set<string> = new Set();

  constructor(scene: Scene) {
    this.scene = scene;
    this.spatialGrid = new SpatialGrid(20);
    this.initializeStates();
    log.info('Initialized');
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private initializeStates(): void {
    const hazardTypes: HazardType[] = ['cold', 'toxic', 'oxygen', 'radiation'];

    for (const type of hazardTypes) {
      const preset = HAZARD_PRESETS[type];
      this.states.set(type, {
        type,
        meter: preset.maxMeter,
        maxMeter: preset.maxMeter,
        isInHazard: false,
        isInSafeZone: false,
        intensity: 0,
        exposureTime: 0,
        damageAccumulator: 0,
      });
    }
  }

  // ============================================================================
  // ZONE HAZARD MANAGEMENT
  // ============================================================================

  /**
   * Add a zone-based hazard to the system
   */
  addZone(config: HazardZoneConfig): void {
    const zone: HazardZone = {
      ...config,
      isActive: true,
    };
    this.zones.set(config.id, zone);
    this.spatialGrid.addZoneHazard(config.id, config.position, config.radius);
    log.info(`Added ${config.type} zone: ${config.id}`);
  }

  /**
   * Remove a zone hazard
   */
  removeZone(id: string): void {
    this.zones.delete(id);
    this.spatialGrid.removeZoneHazard(id);
  }

  /**
   * Set zone active state
   */
  setZoneActive(id: string, active: boolean): void {
    const zone = this.zones.get(id);
    if (zone) {
      zone.isActive = active;
    }
  }

  /**
   * Add a thermal vent (cold safe zone)
   */
  addThermalVent(id: string, position: Vector3, radius: number = 5): void {
    this.addZone({
      id,
      type: 'cold',
      position,
      radius,
      damageRate: 0,
      exposureDrainRate: 0,
      isSafeZone: true,
      recoveryRate: HAZARD_PRESETS.cold.baseRecoveryRate,
    });
  }

  /**
   * Add a spore cloud (toxic hazard zone)
   */
  addSporeCloud(id: string, position: Vector3, radius: number, intensity: number = 1): void {
    const preset = HAZARD_PRESETS.toxic;
    this.addZone({
      id,
      type: 'toxic',
      position,
      radius,
      damageRate: preset.baseDamageRate * intensity,
      exposureDrainRate: preset.baseDrainRate * intensity,
      intensity,
    });
  }

  /**
   * Add a breached section (oxygen hazard)
   */
  addBreachedSection(id: string, position: Vector3, radius: number): void {
    const preset = HAZARD_PRESETS.oxygen;
    this.addZone({
      id,
      type: 'oxygen',
      position,
      radius,
      damageRate: preset.baseDamageRate,
      exposureDrainRate: preset.baseDrainRate,
    });
  }

  /**
   * Add a sealed room (oxygen safe zone)
   */
  addSealedRoom(id: string, position: Vector3, radius: number): void {
    this.addZone({
      id,
      type: 'oxygen',
      position,
      radius,
      damageRate: 0,
      exposureDrainRate: 0,
      isSafeZone: true,
      recoveryRate: HAZARD_PRESETS.oxygen.baseRecoveryRate,
    });
  }

  /**
   * Add a radiation zone
   */
  addRadiationZone(id: string, position: Vector3, radius: number, intensity: number = 1): void {
    const preset = HAZARD_PRESETS.radiation;
    this.addZone({
      id,
      type: 'radiation',
      position,
      radius,
      damageRate: preset.baseDamageRate * intensity,
      exposureDrainRate: preset.baseDrainRate * intensity,
      intensity,
    });
  }

  /**
   * Clear all zone hazards
   */
  clearAllZones(): void {
    this.zones.clear();
  }

  // ============================================================================
  // INSTANT HAZARD MANAGEMENT
  // ============================================================================

  /**
   * Add an instant hazard to the system
   */
  addInstantHazard(config: InstantHazardConfig): InstantHazard {
    const hazard: InstantHazard = {
      ...config,
      isActive: config.active ?? true,
      lastDamageTime: 0,
      animationPhase: Math.random() * Math.PI * 2,
    };

    // Create visual representation
    this.createHazardVisual(hazard);

    this.instantHazards.set(config.id, hazard);
    this.spatialGrid.addInstantHazard(config.id, config.position, config.radius);
    log.info(`Added ${config.type} hazard: ${config.id}`);

    return hazard;
  }

  /**
   * Create visual mesh and effects for a hazard
   */
  private createHazardVisual(hazard: InstantHazard): void {
    const preset = INSTANT_HAZARD_PRESETS[hazard.type];
    const scale = hazard.visualScale ?? 1;

    switch (hazard.type) {
      case 'acid_pool':
        this.createAcidPoolVisual(hazard, preset, scale);
        break;
      case 'fire':
        this.createFireVisual(hazard, preset, scale);
        break;
      case 'electricity':
        this.createElectricityVisual(hazard, preset, scale);
        break;
      case 'toxic_gas':
        this.createToxicGasVisual(hazard, preset, scale);
        break;
      case 'freezing':
        this.createFreezingVisual(hazard, preset, scale);
        break;
      case 'explosive_barrel':
        this.createExplosiveBarrelVisual(hazard, preset, scale);
        break;
      case 'laser_grid':
        this.createLaserGridVisual(hazard, preset, scale);
        break;
      case 'falling_debris':
        // No static visual - debris spawns dynamically
        break;
    }
  }

  private createAcidPoolVisual(
    hazard: InstantHazard,
    preset: InstantHazardPreset,
    scale: number
  ): void {
    const pool = MeshBuilder.CreateDisc(
      `acid_pool_${hazard.id}`,
      { radius: hazard.radius * scale, tessellation: 24 },
      this.scene
    );

    const mat = new StandardMaterial(`acid_mat_${hazard.id}`, this.scene);
    mat.diffuseColor = hazard.color ?? preset.color;
    mat.emissiveColor = preset.emissiveColor.scale(preset.glowIntensity);
    mat.alpha = 0.85;
    mat.backFaceCulling = false;
    pool.material = mat;

    pool.position = hazard.position.clone();
    pool.position.y += 0.02;
    pool.rotation.x = Math.PI / 2;

    hazard.mesh = pool;

    // Add point light for glow
    const light = new PointLight(`acid_light_${hazard.id}`, hazard.position.clone(), this.scene);
    light.diffuse = preset.color;
    light.intensity = preset.glowIntensity * 0.5;
    light.range = hazard.radius * 2;
    light.position.y = 0.5;
    hazard.light = light;
  }

  private createFireVisual(
    hazard: InstantHazard,
    preset: InstantHazardPreset,
    scale: number
  ): void {
    const root = new TransformNode(`fire_root_${hazard.id}`, this.scene);
    root.position = hazard.position.clone();

    // Fire base mesh
    const base = MeshBuilder.CreateCylinder(
      `fire_base_${hazard.id}`,
      { height: 0.1, diameter: hazard.radius * 2 * scale },
      this.scene
    );
    const baseMat = new StandardMaterial(`fire_base_mat_${hazard.id}`, this.scene);
    baseMat.diffuseColor = new Color3(0.1, 0.05, 0.02);
    baseMat.emissiveColor = preset.emissiveColor.scale(0.3);
    base.material = baseMat;
    base.parent = root;
    base.position.y = 0.05;

    hazard.mesh = root;

    // Fire light
    const light = new PointLight(`fire_light_${hazard.id}`, hazard.position.clone(), this.scene);
    light.diffuse = preset.color;
    light.intensity = preset.glowIntensity;
    light.range = hazard.radius * 3;
    light.position.y = 1.5;
    hazard.light = light;
  }

  private createElectricityVisual(
    hazard: InstantHazard,
    preset: InstantHazardPreset,
    scale: number
  ): void {
    const root = new TransformNode(`electricity_root_${hazard.id}`, this.scene);
    root.position = hazard.position.clone();

    // Central arc point
    const arc = MeshBuilder.CreateSphere(
      `electricity_arc_${hazard.id}`,
      { diameter: 0.3 * scale },
      this.scene
    );
    const arcMat = new StandardMaterial(`electricity_arc_mat_${hazard.id}`, this.scene);
    arcMat.diffuseColor = preset.color;
    arcMat.emissiveColor = preset.emissiveColor.scale(preset.glowIntensity);
    arc.material = arcMat;
    arc.parent = root;
    arc.position.y = 1;

    hazard.mesh = root;

    // Electric light (flickering)
    const light = new PointLight(
      `electricity_light_${hazard.id}`,
      hazard.position.clone(),
      this.scene
    );
    light.diffuse = preset.color;
    light.intensity = preset.glowIntensity;
    light.range = hazard.radius * 2.5;
    light.position.y = 1;
    hazard.light = light;
  }

  private createToxicGasVisual(
    hazard: InstantHazard,
    preset: InstantHazardPreset,
    scale: number
  ): void {
    const root = new TransformNode(`gas_root_${hazard.id}`, this.scene);
    root.position = hazard.position.clone();

    // Semi-transparent cloud sphere
    const cloud = MeshBuilder.CreateSphere(
      `gas_cloud_${hazard.id}`,
      { diameter: hazard.radius * 2 * scale, segments: 12 },
      this.scene
    );
    const cloudMat = new StandardMaterial(`gas_cloud_mat_${hazard.id}`, this.scene);
    cloudMat.diffuseColor = hazard.color ?? preset.color;
    cloudMat.emissiveColor = preset.emissiveColor.scale(0.5);
    cloudMat.alpha = 0.35;
    cloudMat.backFaceCulling = false;
    cloud.material = cloudMat;
    cloud.parent = root;
    cloud.position.y = hazard.height ? hazard.height / 2 : hazard.radius;

    hazard.mesh = root;
  }

  private createFreezingVisual(
    hazard: InstantHazard,
    preset: InstantHazardPreset,
    scale: number
  ): void {
    const root = new TransformNode(`freezing_root_${hazard.id}`, this.scene);
    root.position = hazard.position.clone();

    // Ice floor disc
    const floor = MeshBuilder.CreateDisc(
      `freezing_floor_${hazard.id}`,
      { radius: hazard.radius * scale, tessellation: 24 },
      this.scene
    );
    const floorMat = new StandardMaterial(`freezing_floor_mat_${hazard.id}`, this.scene);
    floorMat.diffuseColor = preset.color;
    floorMat.emissiveColor = preset.emissiveColor.scale(0.3);
    floorMat.alpha = 0.6;
    floorMat.specularColor = new Color3(0.8, 0.9, 1.0);
    floorMat.specularPower = 64;
    floor.material = floorMat;
    floor.parent = root;
    floor.rotation.x = Math.PI / 2;
    floor.position.y = 0.01;

    hazard.mesh = root;

    // Frost mist light
    const light = new PointLight(
      `freezing_light_${hazard.id}`,
      hazard.position.clone(),
      this.scene
    );
    light.diffuse = preset.color;
    light.intensity = preset.glowIntensity * 0.4;
    light.range = hazard.radius * 1.5;
    light.position.y = 0.5;
    hazard.light = light;
  }

  private createExplosiveBarrelVisual(
    hazard: InstantHazard,
    preset: InstantHazardPreset,
    scale: number
  ): void {
    const barrel = MeshBuilder.CreateCylinder(
      `barrel_${hazard.id}`,
      { height: 1.2 * scale, diameter: 0.6 * scale },
      this.scene
    );

    const mat = new StandardMaterial(`barrel_mat_${hazard.id}`, this.scene);
    mat.diffuseColor = preset.color;
    mat.emissiveColor = preset.emissiveColor;
    barrel.material = mat;

    barrel.position = hazard.position.clone();
    barrel.position.y = 0.6 * scale;

    hazard.mesh = barrel;
  }

  private createLaserGridVisual(
    hazard: InstantHazard,
    preset: InstantHazardPreset,
    scale: number
  ): void {
    const root = new TransformNode(`laser_root_${hazard.id}`, this.scene);
    root.position = hazard.position.clone();

    // Create laser beam lines
    const beamCount = 5;
    const height = hazard.height ?? 3;

    for (let i = 0; i < beamCount; i++) {
      const beam = MeshBuilder.CreateCylinder(
        `laser_beam_${hazard.id}_${i}`,
        { height: height * scale, diameter: 0.03 },
        this.scene
      );
      const beamMat = new StandardMaterial(`laser_beam_mat_${hazard.id}_${i}`, this.scene);
      beamMat.diffuseColor = preset.color;
      beamMat.emissiveColor = preset.emissiveColor.scale(preset.glowIntensity);
      beamMat.alpha = 0.9;
      beam.material = beamMat;
      beam.parent = root;

      const spacing = (hazard.radius * 2) / (beamCount - 1);
      beam.position.x = -hazard.radius + i * spacing;
      beam.position.y = height / 2;
    }

    hazard.mesh = root;

    // Laser light
    const light = new PointLight(`laser_light_${hazard.id}`, hazard.position.clone(), this.scene);
    light.diffuse = preset.color;
    light.intensity = preset.glowIntensity * 0.3;
    light.range = hazard.radius * 2;
    light.position.y = height / 2;
    hazard.light = light;
  }

  /**
   * Remove an instant hazard
   */
  removeInstantHazard(id: string): void {
    const hazard = this.instantHazards.get(id);
    if (hazard) {
      if (hazard.mesh) {
        hazard.mesh.dispose();
      }
      if (hazard.light) {
        hazard.light.dispose();
      }
      this.instantHazards.delete(id);
      this.spatialGrid.removeInstantHazard(id);
      this.activeInstantHazards.delete(id);
    }
  }

  /**
   * Set instant hazard active state
   */
  setInstantHazardActive(id: string, active: boolean): void {
    const hazard = this.instantHazards.get(id);
    if (hazard) {
      hazard.isActive = active;
      if (hazard.mesh) {
        hazard.mesh.setEnabled(active);
      }
      if (hazard.light) {
        hazard.light.setEnabled(active);
      }
    }
  }

  /**
   * Clear all instant hazards
   */
  clearAllInstantHazards(): void {
    for (const hazard of this.instantHazards.values()) {
      if (hazard.mesh) hazard.mesh.dispose();
      if (hazard.light) hazard.light.dispose();
    }
    this.instantHazards.clear();
    this.activeInstantHazards.clear();
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR INSTANT HAZARDS
  // ============================================================================

  /**
   * Add an acid pool hazard
   */
  addAcidPool(
    id: string,
    position: Vector3,
    radius: number = 2,
    damage: number = 5
  ): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'acid_pool',
      position,
      radius,
      damage,
      damageInterval: 0.2,
    });
  }

  /**
   * Add a fire hazard
   */
  addFire(id: string, position: Vector3, radius: number = 1.5, damage: number = 10): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'fire',
      position,
      radius,
      damage,
      damageInterval: 0.1,
    });
  }

  /**
   * Add an electricity hazard
   */
  addElectricity(
    id: string,
    position: Vector3,
    radius: number = 3,
    damage: number = 15
  ): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'electricity',
      position,
      radius,
      damage,
      damageInterval: 2.0,
    });
  }

  /**
   * Add a toxic gas hazard
   */
  addToxicGas(
    id: string,
    position: Vector3,
    radius: number = 4,
    damage: number = 3,
    height: number = 3
  ): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'toxic_gas',
      position,
      radius,
      height,
      damage,
      damageInterval: 0.5,
    });
  }

  /**
   * Add a freezing zone hazard
   */
  addFreezingZone(
    id: string,
    position: Vector3,
    radius: number = 5,
    damage: number = 2
  ): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'freezing',
      position,
      radius,
      damage,
      damageInterval: 0.5,
    });
  }

  /**
   * Add an explosive barrel
   */
  addExplosiveBarrel(id: string, position: Vector3, damage: number = 50): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'explosive_barrel',
      position,
      radius: 0.4,
      damage,
      detonated: false,
    });
  }

  /**
   * Add a laser grid hazard
   */
  addLaserGrid(
    id: string,
    position: Vector3,
    width: number = 3,
    height: number = 3,
    damage: number = 30
  ): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'laser_grid',
      position,
      radius: width / 2,
      height,
      damage,
      damageInterval: 0.5,
    });
  }

  /**
   * Add a falling debris zone
   */
  addFallingDebrisZone(
    id: string,
    position: Vector3,
    radius: number = 8,
    damage: number = 25,
    triggerChance: number = 0.1
  ): InstantHazard {
    return this.addInstantHazard({
      id,
      type: 'falling_debris',
      position,
      radius,
      damage,
      triggerChance,
    });
  }

  /**
   * Trigger an explosive barrel detonation
   */
  detonateBarrel(id: string): void {
    const hazard = this.instantHazards.get(id);
    if (!hazard || hazard.type !== 'explosive_barrel' || hazard.detonated) return;

    hazard.detonated = true;
    hazard.isActive = false;

    // Visual explosion
    if (hazard.mesh) {
      hazard.mesh.dispose();
      hazard.mesh = undefined;
    }

    // Particle effect
    particleManager.emit('explosion', hazard.position);

    // Sound
    try {
      getAudioManager().play('explosion', { position: hazard.position });
    } catch {
      // Audio may not be initialized
    }

    // Screen shake
    this.callbacks.onScreenShake?.(8);

    // Explosion callback
    const explosionRadius = 6;
    this.callbacks.onExplosion?.(hazard.position, explosionRadius, hazard.damage);

    // Check player damage
    const distToPlayer = Vector3.Distance(this.playerPosition, hazard.position);
    if (distToPlayer < explosionRadius) {
      const falloff = 1 - distToPlayer / explosionRadius;
      const explosionDamage = Math.floor(hazard.damage * falloff);
      if (explosionDamage > 0) {
        const direction = this.playerPosition.subtract(hazard.position).normalize();
        this.callbacks.onDamage?.(explosionDamage, 'explosive_barrel', direction);
      }
    }

    // Remove after delay
    setTimeout(() => {
      this.removeInstantHazard(id);
    }, 100);
  }

  /**
   * Trigger falling debris at a position
   */
  triggerDebrisFall(position: Vector3, radius: number = 2, damage: number = 25): void {
    // Particle effect for falling debris
    particleManager.emit('debris', position);

    // Sound
    try {
      getAudioManager().play('debris_impact', { position });
    } catch {
      // Audio may not be initialized
    }

    // Screen shake
    this.callbacks.onScreenShake?.(3);

    // Check player damage
    const distToPlayer = Vector3.Distance(this.playerPosition, position);
    if (distToPlayer < radius) {
      const direction = new Vector3(0, -1, 0);
      this.callbacks.onDamage?.(damage, 'falling_debris', direction);
    }
  }

  // ============================================================================
  // EQUIPMENT / RESISTANCE
  // ============================================================================

  /**
   * Set radiation resistance (0-1, from radiation suits)
   */
  setRadiationResistance(value: number): void {
    this.radiationResistance = Math.max(0, Math.min(1, value));
  }

  /**
   * Set cold resistance (0-1, from thermal gear)
   */
  setColdResistance(value: number): void {
    this.coldResistance = Math.max(0, Math.min(1, value));
  }

  /**
   * Set toxin resistance (0-1, from gas masks/filters)
   */
  setToxinResistance(value: number): void {
    this.toxinResistance = Math.max(0, Math.min(1, value));
  }

  private getResistance(type: HazardType): number {
    switch (type) {
      case 'cold':
        return this.coldResistance;
      case 'toxic':
        return this.toxinResistance;
      case 'radiation':
        return this.radiationResistance;
      case 'oxygen':
        return 0; // No resistance to vacuum
    }
  }

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Set hazard event callbacks
   */
  setCallbacks(callbacks: HazardCallbacks): void {
    this.callbacks = callbacks;
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update hazard system - call every frame
   * @param deltaTime Time since last frame in seconds
   * @param playerPosition Current player position
   */
  update(deltaTime: number, playerPosition: Vector3): void {
    if (this.isDisposed) return;

    this.playerPosition = playerPosition;
    this.animationTime += deltaTime;

    // Reset feedback
    this.feedback.screenTint = null;
    this.feedback.screenShakeIntensity = 0;
    this.feedback.slowFactor = 1.0;
    this.feedback.visionImpairment = 0;
    this.feedback.warningMessage = null;
    this.feedback.damageDirection = null;

    // Check zone hazards using spatial partitioning
    const nearbyZoneIds = this.spatialGrid.getNearbyZoneHazards(playerPosition);
    const activeZones: HazardZone[] = [];
    for (const id of nearbyZoneIds) {
      const zone = this.zones.get(id);
      if (zone?.isActive) {
        activeZones.push(zone);
      }
    }

    // Update each zone hazard type
    for (const [type, state] of this.states) {
      this.updateHazardState(type, state, activeZones, deltaTime);
    }

    // Check instant hazards using spatial partitioning
    const nearbyInstantIds = this.spatialGrid.getNearbyInstantHazards(playerPosition);
    this.updateInstantHazards(deltaTime, nearbyInstantIds);

    // Update hazard animations
    this.updateHazardAnimations(deltaTime);
  }

  private updateHazardState(
    type: HazardType,
    state: HazardState,
    activeZones: HazardZone[],
    deltaTime: number
  ): void {
    const preset = HAZARD_PRESETS[type];
    const relevantZones = activeZones.filter((z) => z.type === type);
    const resistance = this.getResistance(type);

    // Determine if player is in hazard or safe zone
    const hazardZones = relevantZones.filter((z) => !z.isSafeZone);
    const safeZones = relevantZones.filter((z) => z.isSafeZone);

    const wasInHazard = state.isInHazard;
    const wasInSafeZone = state.isInSafeZone;

    state.isInHazard = hazardZones.length > 0;
    state.isInSafeZone = safeZones.length > 0;

    // Trigger enter/exit callbacks
    if (state.isInHazard && !wasInHazard) {
      this.callbacks.onEnterHazard?.(type);
    } else if (!state.isInHazard && wasInHazard) {
      this.callbacks.onExitHazard?.(type);
    }

    if (state.isInSafeZone && !wasInSafeZone) {
      this.callbacks.onEnterSafeZone?.(type);
    } else if (!state.isInSafeZone && wasInSafeZone) {
      this.callbacks.onExitSafeZone?.(type);
    }

    // Calculate intensity (strongest hazard zone)
    let maxIntensity = 0;
    let maxDrainRate = 0;
    let maxDamageRate = 0;

    for (const zone of hazardZones) {
      const zoneIntensity = zone.intensity ?? 1;
      if (zoneIntensity > maxIntensity) {
        maxIntensity = zoneIntensity;
        maxDrainRate = zone.exposureDrainRate;
        maxDamageRate = zone.damageRate;
      }
    }

    state.intensity = maxIntensity;

    // Update exposure time
    if (state.isInHazard) {
      state.exposureTime += deltaTime;
    } else {
      state.exposureTime = 0;
    }

    // Update meter
    if (state.isInSafeZone) {
      // Recover in safe zone
      let recoveryRate = preset.baseRecoveryRate;
      for (const zone of safeZones) {
        if (zone.recoveryRate && zone.recoveryRate > recoveryRate) {
          recoveryRate = zone.recoveryRate;
        }
      }
      state.meter = Math.min(state.maxMeter, state.meter + recoveryRate * deltaTime);

      // Check for recovery callback
      if (state.meter >= preset.warningThreshold && wasInHazard) {
        this.callbacks.onRecovered?.(type);
      }
    } else if (state.isInHazard) {
      // Drain meter (reduced by resistance)
      const effectiveDrainRate = maxDrainRate * (1 - resistance);
      state.meter = Math.max(0, state.meter - effectiveDrainRate * deltaTime);
    } else {
      // Slowly recover when outside any zone (very slow natural recovery)
      const naturalRecovery = preset.baseRecoveryRate * 0.1;
      state.meter = Math.min(state.maxMeter, state.meter + naturalRecovery * deltaTime);
    }

    // Check warnings
    this.checkWarnings(type, state, preset);

    // Apply damage if meter is at/below threshold
    if (state.meter <= preset.damageThreshold && state.isInHazard) {
      const effectiveDamageRate = maxDamageRate * (1 - resistance);
      state.damageAccumulator += effectiveDamageRate * deltaTime;

      if (state.damageAccumulator >= this.DAMAGE_TICK_INTERVAL * effectiveDamageRate) {
        const damage = Math.floor(state.damageAccumulator);
        state.damageAccumulator -= damage;
        if (damage > 0) {
          this.callbacks.onDamage?.(damage, type);
        }
      }
    } else {
      state.damageAccumulator = 0;
    }
  }

  private updateInstantHazards(deltaTime: number, nearbyIds: Set<string>): void {
    const now = performance.now();
    const previousActive = new Set(this.activeInstantHazards);

    this.activeInstantHazards.clear();

    for (const id of nearbyIds) {
      const hazard = this.instantHazards.get(id);
      if (!hazard || !hazard.isActive) continue;

      // Check collision with player
      const isInHazard = this.checkHazardCollision(hazard);

      if (isInHazard) {
        this.activeInstantHazards.add(id);

        // Trigger enter callback if just entered
        if (!previousActive.has(id)) {
          this.callbacks.onEnterHazard?.(hazard.type);
        }

        // Handle damage based on hazard type
        this.handleInstantHazardDamage(hazard, deltaTime, now);

        // Apply effects (slow, vision, etc.)
        this.applyHazardEffects(hazard);
      }
    }

    // Check for exit callbacks
    for (const id of previousActive) {
      if (!this.activeInstantHazards.has(id)) {
        const hazard = this.instantHazards.get(id);
        if (hazard) {
          this.callbacks.onExitHazard?.(hazard.type);
        }
      }
    }

    // Handle debris zones (random triggers)
    for (const hazard of this.instantHazards.values()) {
      if (hazard.type === 'falling_debris' && hazard.isActive && hazard.triggerChance) {
        const distToPlayer = Vector3.Distance(this.playerPosition, hazard.position);
        if (distToPlayer < hazard.radius) {
          if (Math.random() < hazard.triggerChance * deltaTime) {
            // Random position within radius
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * hazard.radius;
            const debrisPos = hazard.position.add(
              new Vector3(Math.cos(angle) * dist, 5, Math.sin(angle) * dist)
            );
            this.triggerDebrisFall(debrisPos, 2, hazard.damage);
          }
        }
      }
    }
  }

  private checkHazardCollision(hazard: InstantHazard): boolean {
    const dx = this.playerPosition.x - hazard.position.x;
    const dz = this.playerPosition.z - hazard.position.z;
    const dist2D = Math.sqrt(dx * dx + dz * dz);

    if (dist2D > hazard.radius) return false;

    // Check height if specified
    if (hazard.height !== undefined) {
      const heightDiff = Math.abs(this.playerPosition.y - hazard.position.y);
      if (heightDiff > hazard.height / 2) return false;
    }

    return true;
  }

  private handleInstantHazardDamage(hazard: InstantHazard, _deltaTime: number, now: number): void {
    const preset = INSTANT_HAZARD_PRESETS[hazard.type];
    const interval = (hazard.damageInterval ?? preset.damageInterval) * 1000;

    // Check immunity frames for instant hazards
    if (now - this.lastDamageTime < this.IMMUNITY_DURATION) {
      return;
    }

    // Special handling for explosive barrels (no damage, just proximity tracking)
    if (hazard.type === 'explosive_barrel') {
      return;
    }

    // Check damage interval
    if (now - hazard.lastDamageTime < interval) {
      return;
    }

    hazard.lastDamageTime = now;
    this.lastDamageTime = now;

    // Calculate damage
    const damage = hazard.damage ?? preset.baseDamage;

    // Direction for damage indicator
    const direction = this.playerPosition.subtract(hazard.position).normalize();
    direction.y = 0;

    // Apply damage
    this.callbacks.onDamage?.(damage, hazard.type, direction);

    // Screen effects
    if (preset.screenEffectColor) {
      this.callbacks.onScreenEffect?.(
        preset.screenEffectColor,
        preset.screenEffectIntensity ?? 0.3,
        200
      );
    }

    // Sound effect
    try {
      getAudioManager().play(preset.soundEffect as any, { position: hazard.position });
    } catch {
      // Audio may not be initialized
    }
  }

  private applyHazardEffects(hazard: InstantHazard): void {
    const preset = INSTANT_HAZARD_PRESETS[hazard.type];

    // Slow effect (freezing zones)
    if (preset.slowFactor && preset.slowFactor < 1) {
      this.feedback.slowFactor = Math.min(this.feedback.slowFactor, preset.slowFactor);
      this.callbacks.onSlowEffect?.(preset.slowFactor, 0.1);
    }

    // Vision impairment (toxic gas)
    if (hazard.type === 'toxic_gas') {
      this.feedback.visionImpairment = Math.max(this.feedback.visionImpairment, 0.4);
      this.callbacks.onVisionImpairment?.(0.4, 0.2);
    }

    // Screen tint
    if (preset.screenEffectColor) {
      this.feedback.screenTint = preset.screenEffectColor;
    }
  }

  private updateHazardAnimations(deltaTime: number): void {
    for (const hazard of this.instantHazards.values()) {
      if (!hazard.isActive) continue;

      hazard.animationPhase += deltaTime;
      const preset = INSTANT_HAZARD_PRESETS[hazard.type];

      switch (hazard.type) {
        case 'fire':
          // Flickering fire light
          if (hazard.light) {
            const flicker = 0.8 + Math.sin(hazard.animationPhase * 15) * 0.2;
            hazard.light.intensity = preset.glowIntensity * flicker;
          }
          break;

        case 'electricity':
          // Pulsing/sparking electric light
          if (hazard.light) {
            const spark = Math.random() > 0.9 ? 2.0 : 1.0;
            const pulse = 0.6 + Math.sin(hazard.animationPhase * 8) * 0.4;
            hazard.light.intensity = preset.glowIntensity * pulse * spark;
          }
          break;

        case 'acid_pool':
          // Bubbling animation - subtle position oscillation
          if (hazard.mesh) {
            const bubble = Math.sin(hazard.animationPhase * 3) * 0.02;
            hazard.mesh.position.y = hazard.position.y + 0.02 + bubble;
          }
          if (hazard.light) {
            const glow = 0.9 + Math.sin(hazard.animationPhase * 2) * 0.1;
            hazard.light.intensity = preset.glowIntensity * 0.5 * glow;
          }
          break;

        case 'toxic_gas':
          // Slow rotation and scale pulse
          if (hazard.mesh) {
            hazard.mesh.rotation.y += deltaTime * 0.2;
            const scale = 1 + Math.sin(hazard.animationPhase * 0.5) * 0.05;
            hazard.mesh.scaling.setAll(scale);
          }
          break;

        case 'freezing':
          // Crystal shimmer
          if (hazard.light) {
            const shimmer = 0.8 + Math.sin(hazard.animationPhase * 4) * 0.2;
            hazard.light.intensity = preset.glowIntensity * 0.4 * shimmer;
          }
          break;

        case 'laser_grid':
          // Pulsing laser beams
          if (hazard.light) {
            const pulse = 0.7 + Math.sin(hazard.animationPhase * 6) * 0.3;
            hazard.light.intensity = preset.glowIntensity * 0.3 * pulse;
          }
          break;
      }
    }
  }

  private checkWarnings(type: HazardType, state: HazardState, preset: HazardPreset): void {
    const now = Date.now();
    const lastWarning = this.lastWarningTime.get(type) ?? 0;

    if (now - lastWarning < this.WARNING_COOLDOWN) return;

    if (state.meter <= preset.criticalThreshold && state.isInHazard) {
      this.callbacks.onWarning?.(type, true);
      this.lastWarningTime.set(type, now);
      this.feedback.warningMessage = `CRITICAL: ${preset.name}`;
    } else if (state.meter <= preset.warningThreshold && state.isInHazard) {
      this.callbacks.onWarning?.(type, false);
      this.lastWarningTime.set(type, now);
      this.feedback.warningMessage = `WARNING: ${preset.name}`;
    }
  }

  // ============================================================================
  // STATE GETTERS
  // ============================================================================

  /**
   * Get state for a specific zone hazard type.
   * Returns undefined for instant hazard types (fire, acid_pool, etc.)
   * since those don't have persistent meter states.
   */
  getState(type: AnyHazardType): HazardState | undefined {
    // Only zone hazard types have states - instant hazards return undefined
    return this.states.get(type as HazardType);
  }

  /**
   * Get all zone hazard states
   */
  getAllStates(): Map<HazardType, HazardState> {
    return new Map(this.states);
  }

  /**
   * Get meter value as percentage (0-1)
   */
  getMeterPercent(type: HazardType): number {
    const state = this.states.get(type);
    if (!state) return 1;
    return state.meter / state.maxMeter;
  }

  /**
   * Check if player is currently affected by any zone hazard
   */
  isPlayerInAnyHazard(): boolean {
    for (const state of this.states.values()) {
      if (state.isInHazard) return true;
    }
    return this.activeInstantHazards.size > 0;
  }

  /**
   * Get list of active hazard types affecting the player
   */
  getActiveHazardTypes(): AnyHazardType[] {
    const result: AnyHazardType[] = [];
    for (const state of this.states.values()) {
      if (state.isInHazard) {
        result.push(state.type);
      }
    }
    for (const id of this.activeInstantHazards) {
      const hazard = this.instantHazards.get(id);
      if (hazard) {
        result.push(hazard.type);
      }
    }
    return result;
  }

  /**
   * Get the screen effect parameters for current hazards
   */
  getScreenEffects(): { color: Color4; intensity: number }[] {
    const effects: { color: Color4; intensity: number }[] = [];

    // Zone hazard effects
    for (const state of this.states.values()) {
      if (!state.isInHazard && state.meter >= state.maxMeter * 0.9) continue;

      const preset = HAZARD_PRESETS[state.type];
      const effectIntensity =
        state.intensity * (1 - state.meter / state.maxMeter) * preset.screenEffectIntensity;

      if (effectIntensity > 0.01) {
        const color = preset.screenEffectColor.clone();
        color.a *= effectIntensity / preset.screenEffectIntensity;
        effects.push({ color, intensity: effectIntensity });
      }
    }

    // Instant hazard effects
    for (const id of this.activeInstantHazards) {
      const hazard = this.instantHazards.get(id);
      if (!hazard) continue;

      const preset = INSTANT_HAZARD_PRESETS[hazard.type];
      if (preset.screenEffectColor && preset.screenEffectIntensity) {
        effects.push({
          color: preset.screenEffectColor.clone(),
          intensity: preset.screenEffectIntensity,
        });
      }
    }

    return effects;
  }

  /**
   * Get current feedback state
   */
  getFeedback(): HazardFeedback {
    return { ...this.feedback };
  }

  /**
   * Get current slow factor from hazards
   */
  getSlowFactor(): number {
    return this.feedback.slowFactor;
  }

  /**
   * Get all instant hazards (for external systems like shooting detection)
   */
  getInstantHazards(): Map<string, InstantHazard> {
    return this.instantHazards;
  }

  /**
   * Check if a position is inside any explosive barrel (for shooting detection)
   */
  checkExplosiveBarrelHit(position: Vector3, radius: number = 0.5): string | null {
    for (const [id, hazard] of this.instantHazards) {
      if (hazard.type !== 'explosive_barrel' || hazard.detonated || !hazard.isActive) continue;

      const dist = Vector3.Distance(position, hazard.position);
      if (dist < hazard.radius + radius) {
        return id;
      }
    }
    return null;
  }

  // ============================================================================
  // RESET / CLEANUP
  // ============================================================================

  /**
   * Reset all zone hazard states to full meters
   */
  resetStates(): void {
    for (const [type, state] of this.states) {
      const preset = HAZARD_PRESETS[type];
      state.meter = preset.maxMeter;
      state.isInHazard = false;
      state.isInSafeZone = false;
      state.intensity = 0;
      state.exposureTime = 0;
      state.damageAccumulator = 0;
    }
    this.lastWarningTime.clear();
    this.activeInstantHazards.clear();
  }

  /**
   * Dispose the hazard system
   */
  dispose(): void {
    this.isDisposed = true;

    // Dispose instant hazard visuals
    for (const hazard of this.instantHazards.values()) {
      if (hazard.mesh) hazard.mesh.dispose();
      if (hazard.light) hazard.light.dispose();
    }

    this.zones.clear();
    this.instantHazards.clear();
    this.states.clear();
    this.lastWarningTime.clear();
    this.activeInstantHazards.clear();
    this.spatialGrid.clear();

    log.info('Disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let hazardSystemInstance: HazardSystem | null = null;

/**
 * Get or create the hazard system singleton
 */
export function getHazardSystem(scene?: Scene): HazardSystem {
  if (!hazardSystemInstance && scene) {
    hazardSystemInstance = new HazardSystem(scene);
  }
  if (!hazardSystemInstance) {
    throw new Error('HazardSystem not initialized - provide a scene');
  }
  return hazardSystemInstance;
}

/**
 * Dispose the hazard system singleton
 */
export function disposeHazardSystem(): void {
  if (hazardSystemInstance) {
    hazardSystemInstance.dispose();
    hazardSystemInstance = null;
  }
}
