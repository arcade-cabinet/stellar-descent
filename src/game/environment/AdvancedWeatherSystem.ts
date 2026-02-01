/**
 * AdvancedWeatherSystem - Dynamic weather effects with gameplay impact
 *
 * Extends the base WeatherSystem with more dramatic weather events:
 * - **Ice Storms** (Southern Ice): Reduced visibility, slower movement, screen frost
 * - **Meteor Showers** (Surface): Random impacts with damage zones, seek cover
 * - **Electrical Storms**: Random lightning strikes, EMP effects on HUD
 * - **Ash Storms** (Volcanic areas): Low visibility, burning particles
 * - **Sandstorms** (Canyon/desert): Reduced visibility, wind push effect
 *
 * Features:
 * - Dynamic transitions between weather states
 * - Weather-specific audio (howling wind, thunder, impacts)
 * - Gameplay modifiers (movement speed, visibility, damage)
 * - Integration with WeatherSystem for base particle effects
 *
 * Note: This system builds on top of the existing WeatherSystem (effects/WeatherSystem.ts)
 * to add gameplay-affecting weather mechanics.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';

const log = getLogger('AdvancedWeatherSystem');

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Advanced weather event types */
export type WeatherEventType =
  | 'clear'
  | 'ice_storm'
  | 'blizzard'
  | 'meteor_shower'
  | 'electrical_storm'
  | 'ash_storm'
  | 'sandstorm'
  | 'dust_devils';

/** Weather event configuration */
export interface WeatherEventConfig {
  type: WeatherEventType;
  /** Duration of the event in seconds (0 = indefinite) */
  duration: number;
  /** Intensity 0-1 */
  intensity: number;
  /** Transition time in seconds */
  transitionTime: number;
}

/** Weather event preset with gameplay effects */
export interface WeatherEventPreset {
  name: string;
  /** Movement speed multiplier (0.5 = 50% speed) */
  moveSpeedMultiplier: number;
  /** Sprint speed multiplier */
  sprintMultiplier: number;
  /** Visibility distance multiplier (0.3 = 30% visibility) */
  visibilityMultiplier: number;
  /** Ambient damage per second (0 = no damage) */
  ambientDamage: number;
  /** Wind force direction and magnitude */
  windForce: Vector3;
  /** Screen effect color tint */
  screenTint: Color4;
  /** Fog density multiplier */
  fogMultiplier: number;
  /** Fog color */
  fogColor: Color3;
  /** Particle color for weather effects */
  particleColor: Color4;
  /** Audio loop identifier */
  audioLoop: string | null;
  /** Whether this weather can cause random events (lightning, impacts) */
  hasRandomEvents: boolean;
  /** Interval between random events in seconds */
  randomEventInterval: number;
}

/** Lightning strike data */
export interface LightningStrike {
  position: Vector3;
  intensity: number;
  duration: number;
  timer: number;
  light: PointLight;
  /** Whether this strike hit near the player (for EMP effect) */
  isNearPlayer: boolean;
}

/** Meteor impact data */
export interface MeteorImpact {
  position: Vector3;
  radius: number;
  damage: number;
  warningTime: number;
  impactTime: number;
  timer: number;
  warningMesh: Mesh | null;
  hasImpacted: boolean;
}

/** Weather event state */
export interface WeatherEventState {
  currentEvent: WeatherEventType;
  targetEvent: WeatherEventType;
  transitionProgress: number;
  transitionDuration: number;
  eventDuration: number;
  eventTimer: number;
  intensity: number;
  targetIntensity: number;
  randomEventTimer: number;
}

/** Callbacks for weather events */
export interface WeatherEventCallbacks {
  onLightningNearPlayer?: (distance: number) => void;
  onMeteorWarning?: (position: Vector3, timeToImpact: number) => void;
  onMeteorImpact?: (position: Vector3, damage: number, distance: number) => void;
  onEMPEffect?: () => void;
  onWeatherChange?: (newWeather: WeatherEventType) => void;
  onVisibilityChange?: (visibility: number) => void;
}

// ============================================================================
// WEATHER PRESETS
// ============================================================================

export const WEATHER_PRESETS: Record<WeatherEventType, WeatherEventPreset> = {
  clear: {
    name: 'Clear',
    moveSpeedMultiplier: 1.0,
    sprintMultiplier: 1.0,
    visibilityMultiplier: 1.0,
    ambientDamage: 0,
    windForce: Vector3.Zero(),
    screenTint: new Color4(0, 0, 0, 0),
    fogMultiplier: 0.5,
    fogColor: new Color3(0.7, 0.75, 0.8),
    particleColor: new Color4(0.8, 0.8, 0.8, 0.2),
    audioLoop: null,
    hasRandomEvents: false,
    randomEventInterval: 0,
  },

  ice_storm: {
    name: 'Ice Storm',
    moveSpeedMultiplier: 0.7,
    sprintMultiplier: 0.8,
    visibilityMultiplier: 0.4,
    ambientDamage: 0, // Cold damage handled by HazardSystem
    windForce: new Vector3(-8, 0, -3),
    screenTint: new Color4(0.5, 0.7, 1.0, 0.15),
    fogMultiplier: 3.0,
    fogColor: new Color3(0.7, 0.8, 0.95),
    particleColor: new Color4(0.9, 0.95, 1.0, 0.6),
    audioLoop: 'ice_storm_wind',
    hasRandomEvents: false,
    randomEventInterval: 0,
  },

  blizzard: {
    name: 'Blizzard',
    moveSpeedMultiplier: 0.5,
    sprintMultiplier: 0.6,
    visibilityMultiplier: 0.2,
    ambientDamage: 0,
    windForce: new Vector3(-15, 0, -5),
    screenTint: new Color4(0.6, 0.75, 1.0, 0.25),
    fogMultiplier: 5.0,
    fogColor: new Color3(0.75, 0.82, 0.95),
    particleColor: new Color4(0.95, 0.98, 1.0, 0.8),
    audioLoop: 'blizzard_howl',
    hasRandomEvents: false,
    randomEventInterval: 0,
  },

  meteor_shower: {
    name: 'Meteor Shower',
    moveSpeedMultiplier: 1.0,
    sprintMultiplier: 1.0,
    visibilityMultiplier: 0.8,
    ambientDamage: 0,
    windForce: Vector3.Zero(),
    screenTint: new Color4(1.0, 0.6, 0.3, 0.1),
    fogMultiplier: 1.2,
    fogColor: new Color3(0.6, 0.5, 0.4),
    particleColor: new Color4(1.0, 0.7, 0.4, 0.8),
    audioLoop: 'meteor_ambient',
    hasRandomEvents: true,
    randomEventInterval: 4, // Impact every 4 seconds on average
  },

  electrical_storm: {
    name: 'Electrical Storm',
    moveSpeedMultiplier: 0.9,
    sprintMultiplier: 0.9,
    visibilityMultiplier: 0.6,
    ambientDamage: 0,
    windForce: new Vector3(-5, 0, 2),
    screenTint: new Color4(0.3, 0.4, 0.6, 0.15),
    fogMultiplier: 2.0,
    fogColor: new Color3(0.4, 0.45, 0.55),
    particleColor: new Color4(0.5, 0.6, 0.8, 0.5),
    audioLoop: 'thunder_ambient',
    hasRandomEvents: true,
    randomEventInterval: 6, // Lightning every 6 seconds on average
  },

  ash_storm: {
    name: 'Ash Storm',
    moveSpeedMultiplier: 0.8,
    sprintMultiplier: 0.85,
    visibilityMultiplier: 0.3,
    ambientDamage: 1, // Light burning damage
    windForce: new Vector3(-6, 0, 0),
    screenTint: new Color4(0.4, 0.35, 0.3, 0.2),
    fogMultiplier: 4.0,
    fogColor: new Color3(0.35, 0.3, 0.28),
    particleColor: new Color4(0.4, 0.35, 0.3, 0.7),
    audioLoop: 'ash_wind',
    hasRandomEvents: false,
    randomEventInterval: 0,
  },

  sandstorm: {
    name: 'Sandstorm',
    moveSpeedMultiplier: 0.6,
    sprintMultiplier: 0.7,
    visibilityMultiplier: 0.25,
    ambientDamage: 0,
    windForce: new Vector3(-12, 0, -4),
    screenTint: new Color4(0.8, 0.6, 0.35, 0.25),
    fogMultiplier: 4.5,
    fogColor: new Color3(0.65, 0.5, 0.35),
    particleColor: new Color4(0.75, 0.6, 0.4, 0.75),
    audioLoop: 'sandstorm_howl',
    hasRandomEvents: false,
    randomEventInterval: 0,
  },

  dust_devils: {
    name: 'Dust Devils',
    moveSpeedMultiplier: 0.9,
    sprintMultiplier: 0.95,
    visibilityMultiplier: 0.7,
    ambientDamage: 0,
    windForce: new Vector3(-3, 0, 0),
    screenTint: new Color4(0.7, 0.55, 0.4, 0.1),
    fogMultiplier: 1.5,
    fogColor: new Color3(0.7, 0.6, 0.5),
    particleColor: new Color4(0.7, 0.6, 0.5, 0.5),
    audioLoop: 'wind_gusts',
    hasRandomEvents: false,
    randomEventInterval: 0,
  },
};

// ============================================================================
// ADVANCED WEATHER SYSTEM CLASS
// ============================================================================

export class AdvancedWeatherSystem {
  private scene: Scene;
  private state: WeatherEventState;
  private callbacks: WeatherEventCallbacks = {};
  private isDisposed = false;

  // Active effects
  private lightningStrikes: LightningStrike[] = [];
  private meteorImpacts: MeteorImpact[] = [];

  // Particle systems
  private weatherParticles: ParticleSystem | null = null;
  private debrisParticles: ParticleSystem | null = null;

  // Player position for relative effects
  private playerPosition: Vector3 = Vector3.Zero();

  // Cached preset for current interpolation
  private currentPreset: WeatherEventPreset;
  private targetPreset: WeatherEventPreset;

  // Constants
  private readonly LIGHTNING_NEAR_DISTANCE = 30;
  private readonly METEOR_DAMAGE_RADIUS = 15;

  constructor(scene: Scene) {
    this.scene = scene;

    // Initialize state with clear weather
    this.state = {
      currentEvent: 'clear',
      targetEvent: 'clear',
      transitionProgress: 1,
      transitionDuration: 0,
      eventDuration: 0,
      eventTimer: 0,
      intensity: 0,
      targetIntensity: 0,
      randomEventTimer: 0,
    };

    this.currentPreset = WEATHER_PRESETS.clear;
    this.targetPreset = WEATHER_PRESETS.clear;

    log.info('Initialized');
  }

  // ============================================================================
  // WEATHER CONTROL
  // ============================================================================

  /**
   * Start a weather event
   */
  startWeatherEvent(config: WeatherEventConfig): void {
    if (config.type === this.state.currentEvent && this.state.transitionProgress >= 1) {
      // Already at this weather, just update intensity
      this.state.targetIntensity = config.intensity;
      return;
    }

    this.state.targetEvent = config.type;
    this.state.transitionDuration = config.transitionTime;
    this.state.transitionProgress = 0;
    this.state.eventDuration = config.duration;
    this.state.eventTimer = 0;
    this.state.targetIntensity = config.intensity;

    this.targetPreset = WEATHER_PRESETS[config.type];

    this.callbacks.onWeatherChange?.(config.type);
    log.info(`Weather transitioning to ${config.type} over ${config.transitionTime}s`);
  }

  /**
   * Immediately set weather (no transition)
   */
  setWeatherImmediate(type: WeatherEventType, intensity: number = 1): void {
    this.state.currentEvent = type;
    this.state.targetEvent = type;
    this.state.transitionProgress = 1;
    this.state.intensity = intensity;
    this.state.targetIntensity = intensity;

    this.currentPreset = WEATHER_PRESETS[type];
    this.targetPreset = WEATHER_PRESETS[type];

    this.applyWeatherEffects();
    this.callbacks.onWeatherChange?.(type);
  }

  /**
   * Set intensity of current weather
   */
  setIntensity(intensity: number): void {
    this.state.targetIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Transition to clear weather
   */
  clearWeather(transitionTime: number = 3): void {
    this.startWeatherEvent({
      type: 'clear',
      duration: 0,
      intensity: 0,
      transitionTime,
    });
  }

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Set weather event callbacks
   */
  setCallbacks(callbacks: WeatherEventCallbacks): void {
    this.callbacks = callbacks;
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update weather system - call every frame
   */
  update(deltaTime: number, playerPosition: Vector3): void {
    if (this.isDisposed) return;

    this.playerPosition = playerPosition;

    // Update transition
    this.updateTransition(deltaTime);

    // Update event duration
    this.updateEventDuration(deltaTime);

    // Update random events (lightning, meteors)
    this.updateRandomEvents(deltaTime);

    // Update active lightning strikes
    this.updateLightningStrikes(deltaTime);

    // Update active meteor impacts
    this.updateMeteorImpacts(deltaTime);

    // Update particle positions
    this.updateParticlePositions();

    // Lerp intensity
    const intensityLerp = Math.min(1, deltaTime * 2);
    this.state.intensity += (this.state.targetIntensity - this.state.intensity) * intensityLerp;
  }

  private updateTransition(deltaTime: number): void {
    if (this.state.transitionProgress >= 1) return;

    this.state.transitionProgress += deltaTime / this.state.transitionDuration;

    if (this.state.transitionProgress >= 1) {
      this.state.transitionProgress = 1;
      this.state.currentEvent = this.state.targetEvent;
      this.currentPreset = this.targetPreset;
    }

    this.applyWeatherEffects();
  }

  private updateEventDuration(deltaTime: number): void {
    if (this.state.eventDuration <= 0) return; // Indefinite

    this.state.eventTimer += deltaTime;

    if (this.state.eventTimer >= this.state.eventDuration) {
      // Event ended, transition to clear
      this.clearWeather();
    }
  }

  private updateRandomEvents(deltaTime: number): void {
    const preset = this.getCurrentPreset();
    if (!preset.hasRandomEvents || this.state.intensity < 0.3) return;

    this.state.randomEventTimer -= deltaTime;

    if (this.state.randomEventTimer <= 0) {
      // Calculate next event time (randomized around interval)
      const baseInterval = preset.randomEventInterval;
      this.state.randomEventTimer = baseInterval * (0.5 + Math.random());

      // Spawn random event based on weather type
      this.spawnRandomEvent();
    }
  }

  private spawnRandomEvent(): void {
    switch (this.state.currentEvent) {
      case 'electrical_storm':
        this.spawnLightningStrike();
        break;
      case 'meteor_shower':
        this.spawnMeteorImpact();
        break;
    }
  }

  // ============================================================================
  // LIGHTNING SYSTEM
  // ============================================================================

  private spawnLightningStrike(): void {
    // Random position within visible range
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 80;
    const position = new Vector3(
      this.playerPosition.x + Math.cos(angle) * distance,
      50 + Math.random() * 50,
      this.playerPosition.z + Math.sin(angle) * distance
    );

    const isNear = distance < this.LIGHTNING_NEAR_DISTANCE;
    const intensity = 5 + Math.random() * 10;

    // Create lightning light
    const light = new PointLight(`lightning_${Date.now()}`, position, this.scene);
    light.diffuse = new Color3(0.9, 0.95, 1.0);
    light.intensity = 0;
    light.range = 200;

    const strike: LightningStrike = {
      position,
      intensity,
      duration: 0.15 + Math.random() * 0.1,
      timer: 0,
      light,
      isNearPlayer: isNear,
    };

    this.lightningStrikes.push(strike);

    // Callback for near strikes
    if (isNear) {
      this.callbacks.onLightningNearPlayer?.(distance);

      // EMP effect for very close strikes
      if (distance < 15) {
        this.callbacks.onEMPEffect?.();
      }
    }

    log.debug(`Lightning strike at distance ${distance.toFixed(1)}m`);
  }

  private updateLightningStrikes(deltaTime: number): void {
    for (let i = this.lightningStrikes.length - 1; i >= 0; i--) {
      const strike = this.lightningStrikes[i];
      strike.timer += deltaTime;

      if (strike.timer >= strike.duration) {
        // Strike finished
        strike.light.dispose();
        this.lightningStrikes.splice(i, 1);
        continue;
      }

      // Flicker effect
      const progress = strike.timer / strike.duration;
      const flicker = Math.random() > 0.3 ? 1 : 0.3;
      strike.light.intensity = strike.intensity * (1 - progress * progress) * flicker;
    }
  }

  // ============================================================================
  // METEOR SYSTEM
  // ============================================================================

  private spawnMeteorImpact(): void {
    // Random position near player
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 60;
    const position = new Vector3(
      this.playerPosition.x + Math.cos(angle) * distance,
      0,
      this.playerPosition.z + Math.sin(angle) * distance
    );

    const warningTime = 2 + Math.random(); // 2-3 seconds warning
    const damage = 30 + Math.random() * 20;

    // Create warning indicator (red circle on ground)
    const warningMesh = MeshBuilder.CreateDisc(
      `meteor_warning_${Date.now()}`,
      { radius: this.METEOR_DAMAGE_RADIUS * 1.2 },
      this.scene
    );
    warningMesh.position.set(position.x, 0.1, position.z);
    warningMesh.rotation.x = Math.PI / 2;

    const impact: MeteorImpact = {
      position,
      radius: this.METEOR_DAMAGE_RADIUS,
      damage,
      warningTime,
      impactTime: warningTime + 0.5, // Half second after warning ends
      timer: 0,
      warningMesh,
      hasImpacted: false,
    };

    this.meteorImpacts.push(impact);

    // Warning callback
    this.callbacks.onMeteorWarning?.(position, warningTime);

    log.debug(`Meteor incoming at distance ${distance.toFixed(1)}m`);
  }

  private updateMeteorImpacts(deltaTime: number): void {
    for (let i = this.meteorImpacts.length - 1; i >= 0; i--) {
      const impact = this.meteorImpacts[i];
      impact.timer += deltaTime;

      // Update warning visual (pulse effect)
      if (impact.warningMesh && impact.timer < impact.warningTime) {
        const pulse = 0.5 + Math.sin(impact.timer * 8) * 0.3;
        impact.warningMesh.scaling.setAll(pulse);
      }

      // Remove warning mesh when warning time ends
      if (impact.warningMesh && impact.timer >= impact.warningTime) {
        impact.warningMesh.dispose();
        impact.warningMesh = null;
      }

      // Trigger impact
      if (!impact.hasImpacted && impact.timer >= impact.impactTime) {
        impact.hasImpacted = true;

        const distToPlayer = Vector3.Distance(this.playerPosition, impact.position);

        // Calculate damage based on distance
        let damageToPlayer = 0;
        if (distToPlayer < impact.radius) {
          const falloff = 1 - distToPlayer / impact.radius;
          damageToPlayer = Math.floor(impact.damage * falloff);
        }

        this.callbacks.onMeteorImpact?.(impact.position, damageToPlayer, distToPlayer);
      }

      // Remove after impact animation time
      if (impact.timer >= impact.impactTime + 1) {
        this.meteorImpacts.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // WEATHER EFFECTS
  // ============================================================================

  private applyWeatherEffects(): void {
    const t = this.easeInOut(this.state.transitionProgress);
    const preset = this.getCurrentPreset();

    // Apply fog
    this.scene.fogMode = 2; // Exponential
    this.scene.fogDensity = 0.005 * preset.fogMultiplier * this.state.intensity;
    this.scene.fogColor = Color3.Lerp(this.currentPreset.fogColor, this.targetPreset.fogColor, t);

    // Notify visibility change
    const visibility = this.lerp(
      this.currentPreset.visibilityMultiplier,
      this.targetPreset.visibilityMultiplier,
      t
    );
    this.callbacks.onVisibilityChange?.(visibility);
  }

  private updateParticlePositions(): void {
    // Weather particles follow camera
    if (this.weatherParticles) {
      (this.weatherParticles.emitter as Vector3).copyFrom(this.playerPosition);
    }
    if (this.debrisParticles) {
      (this.debrisParticles.emitter as Vector3).copyFrom(this.playerPosition);
    }
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get current interpolated preset
   */
  getCurrentPreset(): WeatherEventPreset {
    if (this.state.transitionProgress >= 1) {
      return this.currentPreset;
    }

    // Interpolate between current and target
    const t = this.easeInOut(this.state.transitionProgress);
    return {
      name: this.targetPreset.name,
      moveSpeedMultiplier: this.lerp(
        this.currentPreset.moveSpeedMultiplier,
        this.targetPreset.moveSpeedMultiplier,
        t
      ),
      sprintMultiplier: this.lerp(
        this.currentPreset.sprintMultiplier,
        this.targetPreset.sprintMultiplier,
        t
      ),
      visibilityMultiplier: this.lerp(
        this.currentPreset.visibilityMultiplier,
        this.targetPreset.visibilityMultiplier,
        t
      ),
      ambientDamage: this.lerp(
        this.currentPreset.ambientDamage,
        this.targetPreset.ambientDamage,
        t
      ),
      windForce: Vector3.Lerp(this.currentPreset.windForce, this.targetPreset.windForce, t),
      screenTint: Color4.Lerp(this.currentPreset.screenTint, this.targetPreset.screenTint, t),
      fogMultiplier: this.lerp(
        this.currentPreset.fogMultiplier,
        this.targetPreset.fogMultiplier,
        t
      ),
      fogColor: Color3.Lerp(this.currentPreset.fogColor, this.targetPreset.fogColor, t),
      particleColor: Color4.Lerp(
        this.currentPreset.particleColor,
        this.targetPreset.particleColor,
        t
      ),
      audioLoop: this.targetPreset.audioLoop,
      hasRandomEvents: this.targetPreset.hasRandomEvents,
      randomEventInterval: this.targetPreset.randomEventInterval,
    };
  }

  /**
   * Get current weather type
   */
  getCurrentWeatherType(): WeatherEventType {
    return this.state.currentEvent;
  }

  /**
   * Get current intensity
   */
  getIntensity(): number {
    return this.state.intensity;
  }

  /**
   * Get movement speed multiplier
   */
  getMoveSpeedMultiplier(): number {
    const preset = this.getCurrentPreset();
    return (
      preset.moveSpeedMultiplier * (1 - this.state.intensity * 0.3) + this.state.intensity * 0.3
    );
  }

  /**
   * Get sprint speed multiplier
   */
  getSprintMultiplier(): number {
    const preset = this.getCurrentPreset();
    return preset.sprintMultiplier;
  }

  /**
   * Get visibility multiplier
   */
  getVisibilityMultiplier(): number {
    const preset = this.getCurrentPreset();
    return (
      preset.visibilityMultiplier * (1 - this.state.intensity * 0.5) + this.state.intensity * 0.5
    );
  }

  /**
   * Get current wind force
   */
  getWindForce(): Vector3 {
    const preset = this.getCurrentPreset();
    return preset.windForce.scale(this.state.intensity);
  }

  /**
   * Get screen tint color
   */
  getScreenTint(): Color4 {
    const preset = this.getCurrentPreset();
    const tint = preset.screenTint.clone();
    tint.a *= this.state.intensity;
    return tint;
  }

  /**
   * Get ambient damage per second
   */
  getAmbientDamage(): number {
    const preset = this.getCurrentPreset();
    return preset.ambientDamage * this.state.intensity;
  }

  /**
   * Check if transitioning between weather states
   */
  isTransitioning(): boolean {
    return this.state.transitionProgress < 1;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose weather system
   */
  dispose(): void {
    this.isDisposed = true;

    // Dispose lightning
    for (const strike of this.lightningStrikes) {
      strike.light.dispose();
    }
    this.lightningStrikes = [];

    // Dispose meteor warnings
    for (const impact of this.meteorImpacts) {
      impact.warningMesh?.dispose();
    }
    this.meteorImpacts = [];

    // Dispose particles
    this.weatherParticles?.dispose();
    this.weatherParticles = null;
    this.debrisParticles?.dispose();
    this.debrisParticles = null;

    log.info('Disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let advancedWeatherInstance: AdvancedWeatherSystem | null = null;

/**
 * Get or create the advanced weather system singleton
 */
export function getAdvancedWeatherSystem(scene?: Scene): AdvancedWeatherSystem {
  if (!advancedWeatherInstance && scene) {
    advancedWeatherInstance = new AdvancedWeatherSystem(scene);
  }
  if (!advancedWeatherInstance) {
    throw new Error('AdvancedWeatherSystem not initialized - provide a scene');
  }
  return advancedWeatherInstance;
}

/**
 * Dispose the advanced weather system singleton
 */
export function disposeAdvancedWeatherSystem(): void {
  if (advancedWeatherInstance) {
    advancedWeatherInstance.dispose();
    advancedWeatherInstance = null;
  }
}
