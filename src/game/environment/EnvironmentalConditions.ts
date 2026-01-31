/**
 * EnvironmentalConditions - Central manager for environmental condition effects
 *
 * Integrates multiple systems to create cohesive environmental gameplay:
 * - HazardSystem for damage and meter management
 * - AdvancedWeatherSystem for weather effects
 * - Player movement modifiers based on conditions
 * - Weapon effects (jamming in cold, overheating in heat)
 * - Enemy condition effects
 * - Marcus (AI companion) environmental comments
 *
 * This is the main interface for levels to interact with environmental conditions.
 * Each level can configure which conditions are active and their parameters.
 */

import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';
import type { CommsMessage } from '../types';
import {
  disposeAdvancedWeatherSystem,
  getAdvancedWeatherSystem,
  type WeatherEventType,
  type AdvancedWeatherSystem,
} from './AdvancedWeatherSystem';
import {
  disposeHazardSystem,
  getHazardSystem,
  type HazardType,
  type HazardSystem,
  type HazardZoneConfig,
} from './HazardSystem';

const log = getLogger('EnvironmentalConditions');

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Environment type determines which conditions are available */
export type EnvironmentType =
  | 'station' // Indoor space station
  | 'surface_temperate' // Outdoor temperate
  | 'surface_ice' // Outdoor frozen
  | 'surface_desert' // Outdoor desert/canyon
  | 'hive' // Underground alien hive
  | 'mine' // Underground mining facility;

/** Configuration for environmental conditions */
export interface EnvironmentConfig {
  type: EnvironmentType;
  /** Base temperature (-1 = freezing, 0 = normal, 1 = hot) */
  baseTemperature: number;
  /** Base oxygen level (0-1, 1 = normal) */
  baseOxygen: number;
  /** Base toxicity (0-1, 0 = clean) */
  baseToxicity: number;
  /** Base radiation (0-1, 0 = clean) */
  baseRadiation: number;
  /** Initial weather event */
  initialWeather?: WeatherEventType;
  /** Whether cold affects weapons */
  coldAffectsWeapons?: boolean;
  /** Whether enemies are also affected by conditions */
  enemiesAffected?: boolean;
}

/** Player condition status */
export interface PlayerConditionStatus {
  /** Movement speed multiplier (all sources combined) */
  moveSpeedMultiplier: number;
  /** Sprint speed multiplier */
  sprintMultiplier: number;
  /** Weapon fire rate multiplier (cold jamming) */
  weaponFireRateMultiplier: number;
  /** Whether weapon is currently jammed */
  isWeaponJammed: boolean;
  /** Combined screen effect color */
  screenEffectColor: Color4;
  /** Screen effect intensity */
  screenEffectIntensity: number;
  /** List of active condition warnings */
  activeWarnings: string[];
  /** Wind force affecting player movement */
  windForce: Vector3;
}

/** Callbacks for condition events */
export interface ConditionCallbacks {
  onDamage: (damage: number, source: string) => void;
  onCommsMessage: (message: CommsMessage) => void;
  onNotification: (text: string, duration?: number) => void;
  onScreenEffect?: (color: Color4, intensity: number) => void;
  onWeaponJam?: () => void;
  onWeaponUnjam?: () => void;
}

/** Environmental comment for Marcus */
interface EnvironmentalComment {
  condition: string;
  comments: string[];
  cooldown: number; // seconds between comments
}

// ============================================================================
// MARCUS ENVIRONMENTAL COMMENTS
// ============================================================================

const MARCUS_COMMENTS: EnvironmentalComment[] = [
  {
    condition: 'cold_warning',
    comments: [
      "It's freezing in here.",
      'My suit sensors are showing sub-zero temps.',
      "This cold... it's brutal.",
      'Need to find some warmth soon.',
    ],
    cooldown: 30,
  },
  {
    condition: 'cold_critical',
    comments: [
      "Can't... feel my fingers...",
      'Hypothermia setting in...',
      'Find heat... now...',
    ],
    cooldown: 15,
  },
  {
    condition: 'oxygen_warning',
    comments: [
      "Oxygen's getting thin.",
      'Pressure breach detected. Need to seal up.',
      "Can't breathe properly in here.",
    ],
    cooldown: 25,
  },
  {
    condition: 'oxygen_critical',
    comments: [
      "Can't... breathe...",
      'Need air... NOW...',
      'Suffocating...',
    ],
    cooldown: 10,
  },
  {
    condition: 'toxic_warning',
    comments: [
      'Spores in the air. Move quickly.',
      'This atmosphere is toxic.',
      "Don't breathe too deep in here.",
    ],
    cooldown: 25,
  },
  {
    condition: 'toxic_critical',
    comments: [
      'Filters overloaded...',
      'Poison... everywhere...',
      "Can't... take much more...",
    ],
    cooldown: 10,
  },
  {
    condition: 'radiation_warning',
    comments: [
      "Geiger counter's clicking. Not good.",
      'Radiation levels rising.',
      'This area is hot. Move through quickly.',
    ],
    cooldown: 30,
  },
  {
    condition: 'radiation_critical',
    comments: [
      'Radiation is off the charts!',
      'Get out of here NOW!',
      "This much radiation... it's lethal.",
    ],
    cooldown: 15,
  },
  {
    condition: 'blizzard',
    comments: [
      "Can't see a thing in this blizzard.",
      'Visibility near zero.',
      'This storm is brutal.',
    ],
    cooldown: 45,
  },
  {
    condition: 'weapon_jam',
    comments: [
      "Weapon's jammed! Too cold!",
      'Mechanism froze up!',
      'Damn this cold!',
    ],
    cooldown: 20,
  },
  {
    condition: 'warmth_found',
    comments: [
      'Ah... warmth. Finally.',
      'Temperature stabilizing.',
      'That heat source saved us.',
    ],
    cooldown: 60,
  },
  {
    condition: 'safe_air',
    comments: [
      'Clean air. Take a breather.',
      'Pressure sealed. We can breathe.',
      'Oxygen levels normal.',
    ],
    cooldown: 60,
  },
];

// ============================================================================
// ENVIRONMENT PRESETS
// ============================================================================

export const ENVIRONMENT_PRESETS: Record<EnvironmentType, Partial<EnvironmentConfig>> = {
  station: {
    baseTemperature: 0,
    baseOxygen: 1,
    baseToxicity: 0,
    baseRadiation: 0,
    coldAffectsWeapons: false,
    enemiesAffected: false,
  },
  surface_temperate: {
    baseTemperature: 0,
    baseOxygen: 1,
    baseToxicity: 0,
    baseRadiation: 0,
    initialWeather: 'clear',
    coldAffectsWeapons: false,
    enemiesAffected: true,
  },
  surface_ice: {
    baseTemperature: -0.8,
    baseOxygen: 1,
    baseToxicity: 0,
    baseRadiation: 0,
    initialWeather: 'ice_storm',
    coldAffectsWeapons: true,
    enemiesAffected: true,
  },
  surface_desert: {
    baseTemperature: 0.3,
    baseOxygen: 1,
    baseToxicity: 0,
    baseRadiation: 0,
    initialWeather: 'dust_devils',
    coldAffectsWeapons: false,
    enemiesAffected: true,
  },
  hive: {
    baseTemperature: 0.1,
    baseOxygen: 0.9,
    baseToxicity: 0.3,
    baseRadiation: 0,
    coldAffectsWeapons: false,
    enemiesAffected: false,
  },
  mine: {
    baseTemperature: 0,
    baseOxygen: 0.8,
    baseToxicity: 0,
    baseRadiation: 0.2,
    coldAffectsWeapons: false,
    enemiesAffected: true,
  },
};

// ============================================================================
// ENVIRONMENTAL CONDITIONS MANAGER
// ============================================================================

export class EnvironmentalConditionsManager {
  private scene: Scene;
  private hazardSystem: HazardSystem;
  private weatherSystem: AdvancedWeatherSystem;
  private config: EnvironmentConfig;
  private callbacks: ConditionCallbacks | null = null;
  private isDisposed = false;

  // Weapon jamming
  private isWeaponJammed = false;
  private weaponJamChance = 0; // 0-1
  private jamCheckTimer = 0;
  private readonly JAM_CHECK_INTERVAL = 0.5; // seconds

  // Marcus comments
  private lastCommentTime: Map<string, number> = new Map();

  // Status cache
  private cachedStatus: PlayerConditionStatus | null = null;
  private statusCacheTime = 0;
  private readonly STATUS_CACHE_DURATION = 0.05; // 50ms cache

  constructor(scene: Scene, config: Partial<EnvironmentConfig>) {
    this.scene = scene;

    // Merge with preset if type provided
    const preset = config.type ? ENVIRONMENT_PRESETS[config.type] : {};
    this.config = {
      type: 'surface_temperate',
      baseTemperature: 0,
      baseOxygen: 1,
      baseToxicity: 0,
      baseRadiation: 0,
      ...preset,
      ...config,
    } as EnvironmentConfig;

    // Initialize subsystems
    this.hazardSystem = getHazardSystem(scene);
    this.weatherSystem = getAdvancedWeatherSystem(scene);

    // Set up hazard callbacks
    this.setupHazardCallbacks();

    // Set up weather callbacks
    this.setupWeatherCallbacks();

    // Apply initial weather if specified
    if (this.config.initialWeather) {
      this.weatherSystem.setWeatherImmediate(this.config.initialWeather, 0.7);
    }

    log.info(`Initialized for ${this.config.type} environment`);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private setupHazardCallbacks(): void {
    this.hazardSystem.setCallbacks({
      onDamage: (damage, hazardType) => {
        this.callbacks?.onDamage(damage, `hazard_${hazardType}`);
      },
      onWarning: (hazardType, isCritical) => {
        this.handleHazardWarning(hazardType, isCritical);
      },
      onRecovered: (hazardType) => {
        this.handleHazardRecovered(hazardType);
      },
      onEnterHazard: (hazardType) => {
        log.debug(`Entered ${hazardType} hazard`);
      },
      onExitHazard: (hazardType) => {
        log.debug(`Exited ${hazardType} hazard`);
      },
      onEnterSafeZone: (hazardType) => {
        this.handleEnterSafeZone(hazardType);
      },
    });
  }

  private setupWeatherCallbacks(): void {
    this.weatherSystem.setCallbacks({
      onLightningNearPlayer: (distance) => {
        this.callbacks?.onNotification('LIGHTNING STRIKE NEARBY!', 2000);
      },
      onMeteorWarning: (position, timeToImpact) => {
        this.callbacks?.onNotification('INCOMING METEOR - TAKE COVER!', 2000);
      },
      onMeteorImpact: (position, damage, distance) => {
        if (damage > 0) {
          this.callbacks?.onDamage(damage, 'meteor_impact');
        }
      },
      onEMPEffect: () => {
        this.callbacks?.onNotification('EMP EFFECT - SYSTEMS DISRUPTED', 2000);
      },
      onWeatherChange: (newWeather) => {
        if (newWeather === 'blizzard' || newWeather === 'ice_storm') {
          this.triggerMarcusComment('blizzard');
        }
      },
    });
  }

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Set condition event callbacks
   */
  setCallbacks(callbacks: ConditionCallbacks): void {
    this.callbacks = callbacks;
  }

  // ============================================================================
  // ZONE MANAGEMENT (delegated to HazardSystem)
  // ============================================================================

  /**
   * Add a hazard zone
   */
  addHazardZone(config: HazardZoneConfig): void {
    this.hazardSystem.addZone(config);
  }

  /**
   * Add a thermal vent (cold safe zone)
   */
  addThermalVent(id: string, position: Vector3, radius: number = 5): void {
    this.hazardSystem.addThermalVent(id, position, radius);
  }

  /**
   * Add a spore cloud (toxic hazard)
   */
  addSporeCloud(id: string, position: Vector3, radius: number, intensity: number = 1): void {
    this.hazardSystem.addSporeCloud(id, position, radius, intensity);
  }

  /**
   * Add a breached section (oxygen hazard)
   */
  addBreachedSection(id: string, position: Vector3, radius: number): void {
    this.hazardSystem.addBreachedSection(id, position, radius);
  }

  /**
   * Add a sealed room (oxygen safe zone)
   */
  addSealedRoom(id: string, position: Vector3, radius: number): void {
    this.hazardSystem.addSealedRoom(id, position, radius);
  }

  /**
   * Add a radiation zone
   */
  addRadiationZone(id: string, position: Vector3, radius: number, intensity: number = 1): void {
    this.hazardSystem.addRadiationZone(id, position, radius, intensity);
  }

  /**
   * Remove a zone
   */
  removeZone(id: string): void {
    this.hazardSystem.removeZone(id);
  }

  /**
   * Clear all zones
   */
  clearAllZones(): void {
    this.hazardSystem.clearAllZones();
  }

  // ============================================================================
  // WEATHER CONTROL (delegated to AdvancedWeatherSystem)
  // ============================================================================

  /**
   * Start a weather event
   */
  startWeather(
    type: WeatherEventType,
    intensity: number = 1,
    duration: number = 0,
    transitionTime: number = 3
  ): void {
    this.weatherSystem.startWeatherEvent({
      type,
      intensity,
      duration,
      transitionTime,
    });
  }

  /**
   * Set weather immediately (no transition)
   */
  setWeatherImmediate(type: WeatherEventType, intensity: number = 1): void {
    this.weatherSystem.setWeatherImmediate(type, intensity);
  }

  /**
   * Clear weather to calm
   */
  clearWeather(transitionTime: number = 3): void {
    this.weatherSystem.clearWeather(transitionTime);
  }

  /**
   * Set weather intensity
   */
  setWeatherIntensity(intensity: number): void {
    this.weatherSystem.setIntensity(intensity);
  }

  // ============================================================================
  // EQUIPMENT
  // ============================================================================

  /**
   * Set radiation resistance (0-1, from suits)
   */
  setRadiationResistance(value: number): void {
    this.hazardSystem.setRadiationResistance(value);
  }

  /**
   * Set cold resistance (0-1, from thermal gear)
   */
  setColdResistance(value: number): void {
    this.hazardSystem.setColdResistance(value);
  }

  /**
   * Set toxin resistance (0-1, from gas masks)
   */
  setToxinResistance(value: number): void {
    this.hazardSystem.setToxinResistance(value);
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update environmental conditions - call every frame
   */
  update(deltaTime: number, playerPosition: Vector3): void {
    if (this.isDisposed) return;

    // Update subsystems
    this.hazardSystem.update(deltaTime, playerPosition);
    this.weatherSystem.update(deltaTime, playerPosition);

    // Update weapon jamming
    this.updateWeaponJamming(deltaTime);

    // Invalidate status cache
    this.cachedStatus = null;
  }

  // ============================================================================
  // WEAPON JAMMING
  // ============================================================================

  private updateWeaponJamming(deltaTime: number): void {
    if (!this.config.coldAffectsWeapons) return;

    // Calculate jam chance based on cold exposure
    const coldState = this.hazardSystem.getState('cold');
    if (!coldState || !coldState.isInHazard) {
      // Not in cold, weapon won't jam
      this.weaponJamChance = Math.max(0, this.weaponJamChance - deltaTime * 0.2);
      if (this.isWeaponJammed && this.weaponJamChance < 0.1) {
        this.unjamWeapon();
      }
      return;
    }

    // Increase jam chance based on exposure
    const exposurePercent = 1 - coldState.meter / coldState.maxMeter;
    this.weaponJamChance = Math.min(0.5, exposurePercent * 0.6);

    // Periodic jam check
    this.jamCheckTimer += deltaTime;
    if (this.jamCheckTimer >= this.JAM_CHECK_INTERVAL) {
      this.jamCheckTimer = 0;

      if (!this.isWeaponJammed && Math.random() < this.weaponJamChance * 0.1) {
        this.jamWeapon();
      }
    }
  }

  private jamWeapon(): void {
    if (this.isWeaponJammed) return;

    this.isWeaponJammed = true;
    this.callbacks?.onWeaponJam?.();
    this.callbacks?.onNotification('WEAPON JAMMED - TOO COLD!', 2000);
    this.triggerMarcusComment('weapon_jam');
  }

  private unjamWeapon(): void {
    if (!this.isWeaponJammed) return;

    this.isWeaponJammed = false;
    this.callbacks?.onWeaponUnjam?.();
    this.callbacks?.onNotification('Weapon cleared', 1500);
  }

  /**
   * Manually unjam weapon (player action)
   */
  manualUnjam(): boolean {
    if (!this.isWeaponJammed) return false;

    // 70% chance to successfully unjam
    if (Math.random() < 0.7) {
      this.unjamWeapon();
      return true;
    } else {
      this.callbacks?.onNotification('Unjam failed - try again!', 1500);
      return false;
    }
  }

  // ============================================================================
  // HAZARD EVENT HANDLERS
  // ============================================================================

  private handleHazardWarning(hazardType: HazardType, isCritical: boolean): void {
    const conditionKey = `${hazardType}_${isCritical ? 'critical' : 'warning'}`;
    this.triggerMarcusComment(conditionKey);

    // Show notification
    const preset = {
      cold: { warning: 'HYPOTHERMIA WARNING', critical: 'HYPOTHERMIA CRITICAL' },
      toxic: { warning: 'TOXICITY WARNING', critical: 'TOXICITY CRITICAL' },
      oxygen: { warning: 'LOW OXYGEN', critical: 'OXYGEN CRITICAL' },
      radiation: { warning: 'RADIATION WARNING', critical: 'RADIATION CRITICAL' },
    };

    const messages = preset[hazardType];
    if (messages) {
      const msg = isCritical ? messages.critical : messages.warning;
      this.callbacks?.onNotification(msg, 3000);
    }
  }

  private handleHazardRecovered(hazardType: HazardType): void {
    const recovery = {
      cold: 'warmth_found',
      oxygen: 'safe_air',
      toxic: 'safe_air',
      radiation: null,
    };

    const conditionKey = recovery[hazardType];
    if (conditionKey) {
      this.triggerMarcusComment(conditionKey);
    }
  }

  private handleEnterSafeZone(hazardType: HazardType): void {
    const safeZoneMessages = {
      cold: 'warmth_found',
      oxygen: 'safe_air',
      toxic: 'safe_air',
      radiation: null,
    };

    const conditionKey = safeZoneMessages[hazardType];
    if (conditionKey) {
      this.triggerMarcusComment(conditionKey);
    }
  }

  // ============================================================================
  // MARCUS COMMENTS
  // ============================================================================

  private triggerMarcusComment(condition: string): void {
    const commentConfig = MARCUS_COMMENTS.find((c) => c.condition === condition);
    if (!commentConfig) return;

    // Check cooldown
    const now = Date.now();
    const lastTime = this.lastCommentTime.get(condition) ?? 0;
    if (now - lastTime < commentConfig.cooldown * 1000) return;

    this.lastCommentTime.set(condition, now);

    // Pick random comment
    const comment = commentConfig.comments[Math.floor(Math.random() * commentConfig.comments.length)];

    // Send as comms message
    this.callbacks?.onCommsMessage({
      sender: 'SGT. JAMES REYES',
      callsign: 'SPECTER',
      portrait: 'player',
      text: comment,
    });
  }

  // ============================================================================
  // STATUS GETTERS
  // ============================================================================

  /**
   * Get combined player condition status
   */
  getPlayerStatus(): PlayerConditionStatus {
    // Return cached if valid
    const now = performance.now() / 1000;
    if (this.cachedStatus && now - this.statusCacheTime < this.STATUS_CACHE_DURATION) {
      return this.cachedStatus;
    }

    const weatherPreset = this.weatherSystem.getCurrentPreset();

    // Calculate movement speed multipliers
    let moveSpeedMultiplier = weatherPreset.moveSpeedMultiplier;
    let sprintMultiplier = weatherPreset.sprintMultiplier;

    // Cold slows movement further based on exposure
    const coldState = this.hazardSystem.getState('cold');
    if (coldState && coldState.meter < coldState.maxMeter * 0.5) {
      const coldPenalty = 1 - (1 - coldState.meter / coldState.maxMeter) * 0.3;
      moveSpeedMultiplier *= coldPenalty;
      sprintMultiplier *= coldPenalty;
    }

    // Oxygen affects sprint
    const oxygenState = this.hazardSystem.getState('oxygen');
    if (oxygenState && oxygenState.meter < oxygenState.maxMeter * 0.5) {
      const oxygenPenalty = 0.5 + (oxygenState.meter / oxygenState.maxMeter) * 0.5;
      sprintMultiplier *= oxygenPenalty;
    }

    // Weapon fire rate
    let weaponFireRateMultiplier = 1;
    if (this.config.coldAffectsWeapons && coldState && coldState.isInHazard) {
      const coldPercent = 1 - coldState.meter / coldState.maxMeter;
      weaponFireRateMultiplier = 1 - coldPercent * 0.3; // Up to 30% slower
    }

    // Screen effects - combine hazard and weather
    const hazardEffects = this.hazardSystem.getScreenEffects();
    const weatherTint = this.weatherSystem.getScreenTint();

    let combinedColor = weatherTint.clone();
    for (const effect of hazardEffects) {
      // Additive blend
      combinedColor.r = Math.min(1, combinedColor.r + effect.color.r * effect.color.a);
      combinedColor.g = Math.min(1, combinedColor.g + effect.color.g * effect.color.a);
      combinedColor.b = Math.min(1, combinedColor.b + effect.color.b * effect.color.a);
      combinedColor.a = Math.min(1, combinedColor.a + effect.color.a);
    }

    // Active warnings
    const activeWarnings: string[] = [];
    for (const type of this.hazardSystem.getActiveHazardTypes()) {
      const state = this.hazardSystem.getState(type);
      if (state && state.meter < state.maxMeter * 0.4) {
        activeWarnings.push(type);
      }
    }
    if (this.isWeaponJammed) {
      activeWarnings.push('weapon_jammed');
    }

    this.cachedStatus = {
      moveSpeedMultiplier,
      sprintMultiplier,
      weaponFireRateMultiplier,
      isWeaponJammed: this.isWeaponJammed,
      screenEffectColor: combinedColor,
      screenEffectIntensity: combinedColor.a,
      activeWarnings,
      windForce: this.weatherSystem.getWindForce(),
    };

    this.statusCacheTime = now;
    return this.cachedStatus;
  }

  /**
   * Get hazard meter as percentage (0-1)
   */
  getHazardMeter(type: HazardType): number {
    return this.hazardSystem.getMeterPercent(type);
  }

  /**
   * Get all hazard states
   */
  getAllHazardStates() {
    return this.hazardSystem.getAllStates();
  }

  /**
   * Get current weather type
   */
  getCurrentWeather(): WeatherEventType {
    return this.weatherSystem.getCurrentWeatherType();
  }

  /**
   * Get weather intensity
   */
  getWeatherIntensity(): number {
    return this.weatherSystem.getIntensity();
  }

  /**
   * Check if player is in any hazard
   */
  isPlayerInHazard(): boolean {
    return this.hazardSystem.isPlayerInAnyHazard();
  }

  /**
   * Get environment config
   */
  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  // ============================================================================
  // RESET / CLEANUP
  // ============================================================================

  /**
   * Reset all condition states
   */
  reset(): void {
    this.hazardSystem.resetStates();
    this.isWeaponJammed = false;
    this.weaponJamChance = 0;
    this.lastCommentTime.clear();
    this.cachedStatus = null;
  }

  /**
   * Dispose the manager and all subsystems
   */
  dispose(): void {
    this.isDisposed = true;
    disposeHazardSystem();
    disposeAdvancedWeatherSystem();
    this.lastCommentTime.clear();
    log.info('Disposed');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let conditionsInstance: EnvironmentalConditionsManager | null = null;

/**
 * Create a new environmental conditions manager
 */
export function createEnvironmentalConditions(
  scene: Scene,
  config: Partial<EnvironmentConfig>
): EnvironmentalConditionsManager {
  // Dispose existing if any
  if (conditionsInstance) {
    conditionsInstance.dispose();
  }

  conditionsInstance = new EnvironmentalConditionsManager(scene, config);
  return conditionsInstance;
}

/**
 * Get the current environmental conditions manager
 */
export function getEnvironmentalConditions(): EnvironmentalConditionsManager | null {
  return conditionsInstance;
}

/**
 * Dispose the environmental conditions manager
 */
export function disposeEnvironmentalConditions(): void {
  if (conditionsInstance) {
    conditionsInstance.dispose();
    conditionsInstance = null;
  }
}
