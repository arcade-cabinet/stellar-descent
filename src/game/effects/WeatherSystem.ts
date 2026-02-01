/**
 * WeatherSystem - Atmospheric and weather effects for different level environments
 *
 * Supports multiple weather types per environment:
 * - SURFACE (Landfall, Extraction): Dust storms, wind, lightning, heat haze
 * - STATION (Anchor Station, FOB Delta): Steam vents, sparks, emergency lights, air vents
 * - HIVE (The Breach): Floating spores, organic mist, bioluminescence, dripping moisture
 *
 * Features:
 * - Smooth transitions between weather states
 * - Performance-aware particle counts
 * - Sound integration via AudioManager
 * - Fog and lighting adjustments
 *
 * @see ParticleManager for low-level particle pooling
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Particles/particleSystemComponent';

import { getLogger } from '../core/Logger';

const log = getLogger('WeatherSystem');

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Environment types that determine available weather effects */
export type WeatherEnvironment = 'surface' | 'station' | 'hive';

/** Weather types available for surface environments */
export type SurfaceWeather = 'clear' | 'dusty' | 'dust_storm' | 'sandstorm';

/** Weather types available for station environments */
export type StationWeather = 'normal' | 'damaged' | 'emergency' | 'depressurizing';

/** Weather types available for hive environments */
export type HiveWeather = 'calm' | 'active' | 'alarmed' | 'queen_chamber';

/** Combined weather type */
export type WeatherType = SurfaceWeather | StationWeather | HiveWeather;

/** Intensity level for weather effects (affects particle counts and visibility) */
export type WeatherIntensity = 'low' | 'medium' | 'high' | 'extreme';

/** Weather state configuration */
export interface WeatherState {
  environment: WeatherEnvironment;
  type: WeatherType;
  intensity: WeatherIntensity;
  windDirection: Vector3;
  windSpeed: number;
  fogDensity: number;
  fogColor: Color3;
  ambientModifier: number; // Multiplier for ambient light
}

/** Configuration for a weather effect preset */
export interface WeatherPreset {
  fogDensity: number;
  fogColor: Color3;
  windSpeed: number;
  ambientModifier: number;
  particleMultiplier: number;
}

// ============================================================================
// WEATHER PRESETS
// ============================================================================

const SURFACE_PRESETS: Record<SurfaceWeather, WeatherPreset> = {
  clear: {
    fogDensity: 0.001,
    fogColor: new Color3(0.85, 0.7, 0.55),
    windSpeed: 2,
    ambientModifier: 1.0,
    particleMultiplier: 0.2,
  },
  dusty: {
    fogDensity: 0.003,
    fogColor: new Color3(0.75, 0.6, 0.45),
    windSpeed: 5,
    ambientModifier: 0.9,
    particleMultiplier: 0.5,
  },
  dust_storm: {
    fogDensity: 0.008,
    fogColor: new Color3(0.65, 0.5, 0.35),
    windSpeed: 12,
    ambientModifier: 0.6,
    particleMultiplier: 1.0,
  },
  sandstorm: {
    fogDensity: 0.015,
    fogColor: new Color3(0.55, 0.4, 0.25),
    windSpeed: 25,
    ambientModifier: 0.3,
    particleMultiplier: 1.5,
  },
};

const STATION_PRESETS: Record<StationWeather, WeatherPreset> = {
  normal: {
    fogDensity: 0.0,
    fogColor: new Color3(0.1, 0.12, 0.15),
    windSpeed: 0,
    ambientModifier: 1.0,
    particleMultiplier: 0.3,
  },
  damaged: {
    fogDensity: 0.002,
    fogColor: new Color3(0.2, 0.18, 0.15),
    windSpeed: 0.5,
    ambientModifier: 0.7,
    particleMultiplier: 0.7,
  },
  emergency: {
    fogDensity: 0.004,
    fogColor: new Color3(0.25, 0.15, 0.1),
    windSpeed: 1,
    ambientModifier: 0.4,
    particleMultiplier: 1.0,
  },
  depressurizing: {
    fogDensity: 0.006,
    fogColor: new Color3(0.15, 0.15, 0.2),
    windSpeed: 8,
    ambientModifier: 0.5,
    particleMultiplier: 1.3,
  },
};

const HIVE_PRESETS: Record<HiveWeather, WeatherPreset> = {
  calm: {
    fogDensity: 0.003,
    fogColor: new Color3(0.1, 0.05, 0.15),
    windSpeed: 0.2,
    ambientModifier: 0.4,
    particleMultiplier: 0.4,
  },
  active: {
    fogDensity: 0.005,
    fogColor: new Color3(0.15, 0.08, 0.18),
    windSpeed: 0.5,
    ambientModifier: 0.5,
    particleMultiplier: 0.7,
  },
  alarmed: {
    fogDensity: 0.008,
    fogColor: new Color3(0.2, 0.1, 0.15),
    windSpeed: 1,
    ambientModifier: 0.6,
    particleMultiplier: 1.0,
  },
  queen_chamber: {
    fogDensity: 0.01,
    fogColor: new Color3(0.25, 0.12, 0.2),
    windSpeed: 0.3,
    ambientModifier: 0.7,
    particleMultiplier: 1.2,
  },
};

// Particle count multipliers based on intensity
const INTENSITY_MULTIPLIERS: Record<WeatherIntensity, number> = {
  low: 0.3,
  medium: 0.6,
  high: 1.0,
  extreme: 1.5,
};

// ============================================================================
// WEATHER SYSTEM CLASS
// ============================================================================

export class WeatherSystem {
  private scene: Scene;
  private currentState: WeatherState;
  private targetState: WeatherState | null = null;
  private transitionProgress = 0;
  private transitionDuration = 2.0; // seconds

  // Particle systems
  private dustParticles: ParticleSystem | null = null;
  private windStreaks: ParticleSystem | null = null;
  private steamVents: ParticleSystem[] = [];
  private sparkSystems: ParticleSystem[] = [];
  private sporeParticles: ParticleSystem | null = null;
  private mistParticles: ParticleSystem | null = null;
  private dripParticles: ParticleSystem[] = [];

  // Visual effects
  private lightningTimer = 0;
  private lightningCooldown = 0;
  private lightningLight: PointLight | null = null;
  private heatHazeMesh: Mesh | null = null;
  private emergencyLights: PointLight[] = [];
  private emergencyLightTimer = 0;
  private bioluminescents: PointLight[] = [];
  private glowLayer: GlowLayer | null = null;

  // Particle texture
  private particleTexture: Texture | null = null;

  // Camera reference for positioned effects
  private cameraPosition: Vector3 = Vector3.Zero();
  private qualityLevel: 'low' | 'medium' | 'high' = 'medium';

  constructor(scene: Scene) {
    this.scene = scene;

    // Initialize default state
    this.currentState = {
      environment: 'surface',
      type: 'clear',
      intensity: 'medium',
      windDirection: new Vector3(1, 0, 0.3).normalize(),
      windSpeed: 2,
      fogDensity: 0.001,
      fogColor: new Color3(0.85, 0.7, 0.55),
      ambientModifier: 1.0,
    };

    // Create particle texture
    this.createParticleTexture();

    log.info('Initialized');
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private createParticleTexture(): void {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const gradient = ctx.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }

    this.particleTexture = new Texture(
      canvas.toDataURL(),
      this.scene,
      false,
      true,
      Texture.BILINEAR_SAMPLINGMODE
    );
    this.particleTexture.name = 'weatherParticleTexture';
  }

  /**
   * Initialize weather for a specific environment
   */
  initializeEnvironment(environment: WeatherEnvironment, initialWeather?: WeatherType): void {
    this.currentState.environment = environment;

    // Set default weather for environment
    let defaultWeather: WeatherType;
    switch (environment) {
      case 'surface':
        defaultWeather = initialWeather ?? 'dusty';
        break;
      case 'station':
        defaultWeather = initialWeather ?? 'normal';
        break;
      case 'hive':
        defaultWeather = initialWeather ?? 'calm';
        break;
    }

    this.setWeather(defaultWeather as WeatherType, 'medium', true);

    // Create environment-specific effects
    this.createEnvironmentEffects();
  }

  private createEnvironmentEffects(): void {
    switch (this.currentState.environment) {
      case 'surface':
        this.createSurfaceEffects();
        break;
      case 'station':
        this.createStationEffects();
        break;
      case 'hive':
        this.createHiveEffects();
        break;
    }
  }

  // ============================================================================
  // SURFACE ENVIRONMENT EFFECTS
  // ============================================================================

  private createSurfaceEffects(): void {
    // Create dust/sand particles
    this.createDustParticles();

    // Create wind streak particles
    this.createWindStreaks();

    // Create lightning light (for storms)
    this.createLightningEffect();

    // Create heat haze mesh (for shimmer effect)
    this.createHeatHaze();
  }

  private createDustParticles(): void {
    if (!this.particleTexture) return;

    const dust = new ParticleSystem('dust', this.getParticleCapacity(200), this.scene);
    dust.particleTexture = this.particleTexture;

    // Emission
    dust.emitter = this.cameraPosition.clone();
    dust.minEmitBox = new Vector3(-50, -2, -50);
    dust.maxEmitBox = new Vector3(50, 30, 50);

    // Particles appear around camera
    dust.emitRate = 50;
    dust.minLifeTime = 3;
    dust.maxLifeTime = 6;

    // Size
    dust.minSize = 0.05;
    dust.maxSize = 0.2;

    // Color (dust/sand color)
    dust.color1 = new Color4(0.8, 0.65, 0.45, 0.4);
    dust.color2 = new Color4(0.7, 0.55, 0.35, 0.3);
    dust.colorDead = new Color4(0.6, 0.5, 0.4, 0);

    // Movement
    dust.minEmitPower = 0.5;
    dust.maxEmitPower = 2;
    dust.direction1 = new Vector3(-1, -0.1, -0.3);
    dust.direction2 = new Vector3(1, 0.3, 0.3);
    dust.gravity = new Vector3(0, -0.5, 0);

    // Add some rotation
    dust.minAngularSpeed = 0;
    dust.maxAngularSpeed = Math.PI / 4;

    dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    dust.updateSpeed = 0.01;

    this.dustParticles = dust;
    dust.start();
  }

  private createWindStreaks(): void {
    if (!this.particleTexture) return;

    const streaks = new ParticleSystem('windStreaks', this.getParticleCapacity(100), this.scene);
    streaks.particleTexture = this.particleTexture;

    streaks.emitter = this.cameraPosition.clone();
    streaks.minEmitBox = new Vector3(-40, 0, -40);
    streaks.maxEmitBox = new Vector3(40, 20, 40);

    streaks.emitRate = 20;
    streaks.minLifeTime = 0.5;
    streaks.maxLifeTime = 1.5;

    // Stretched particles for wind streaks
    streaks.minSize = 0.02;
    streaks.maxSize = 0.05;
    streaks.minScaleX = 1;
    streaks.maxScaleX = 1;
    streaks.minScaleY = 5;
    streaks.maxScaleY = 15;

    // Semi-transparent white/beige
    streaks.color1 = new Color4(1, 0.95, 0.85, 0.3);
    streaks.color2 = new Color4(0.9, 0.85, 0.75, 0.2);
    streaks.colorDead = new Color4(0.8, 0.75, 0.65, 0);

    // Fast horizontal movement
    streaks.minEmitPower = 10;
    streaks.maxEmitPower = 25;
    streaks.direction1 = new Vector3(0.8, 0, 0.2);
    streaks.direction2 = new Vector3(1, 0.1, 0.4);
    streaks.gravity = new Vector3(0, 0, 0);

    streaks.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.windStreaks = streaks;
    streaks.start();
  }

  private createLightningEffect(): void {
    // Create distant lightning light
    this.lightningLight = new PointLight('lightningLight', new Vector3(200, 100, -300), this.scene);
    this.lightningLight.diffuse = new Color3(0.9, 0.95, 1.0);
    this.lightningLight.specular = new Color3(0.5, 0.5, 0.6);
    this.lightningLight.intensity = 0;
    this.lightningLight.range = 500;

    // Random initial cooldown
    this.lightningCooldown = 5 + Math.random() * 10;
  }

  private createHeatHaze(): void {
    // Create a transparent plane for heat haze distortion effect
    // This would ideally use a shader for proper distortion, but we'll simulate with mesh animation
    this.heatHazeMesh = MeshBuilder.CreatePlane('heatHaze', { width: 200, height: 50 }, this.scene);
    this.heatHazeMesh.position.set(0, 2, 100);
    this.heatHazeMesh.rotation.x = Math.PI / 2 - 0.1;

    const hazeMat = new StandardMaterial('hazeMat', this.scene);
    hazeMat.diffuseColor = new Color3(1, 0.95, 0.85);
    hazeMat.alpha = 0.02;
    hazeMat.backFaceCulling = false;
    hazeMat.disableLighting = true;

    this.heatHazeMesh.material = hazeMat;
    this.heatHazeMesh.isVisible = false; // Enable based on weather
  }

  // ============================================================================
  // STATION ENVIRONMENT EFFECTS
  // ============================================================================

  private createStationEffects(): void {
    // Create glow layer for emergency lights
    this.glowLayer = new GlowLayer('emergencyGlow', this.scene);
    this.glowLayer.intensity = 0.5;

    // Steam vents will be placed by level
    // Spark systems will be placed by level
    // Emergency lights will be placed by level
  }

  /**
   * Add a steam vent at a specific position
   */
  addSteamVent(position: Vector3, direction: Vector3 = new Vector3(0, 1, 0)): ParticleSystem {
    if (!this.particleTexture) {
      throw new Error('Weather system not initialized');
    }

    const steam = new ParticleSystem(
      `steamVent_${this.steamVents.length}`,
      this.getParticleCapacity(50),
      this.scene
    );
    steam.particleTexture = this.particleTexture;

    steam.emitter = position.clone();
    steam.minEmitBox = new Vector3(-0.1, 0, -0.1);
    steam.maxEmitBox = new Vector3(0.1, 0, 0.1);

    steam.emitRate = 30;
    steam.minLifeTime = 0.5;
    steam.maxLifeTime = 1.5;

    steam.minSize = 0.1;
    steam.maxSize = 0.4;

    // White/gray steam
    steam.color1 = new Color4(0.8, 0.8, 0.85, 0.6);
    steam.color2 = new Color4(0.7, 0.7, 0.75, 0.4);
    steam.colorDead = new Color4(0.5, 0.5, 0.55, 0);

    steam.minEmitPower = 2;
    steam.maxEmitPower = 5;
    steam.direction1 = direction.add(new Vector3(-0.2, 0, -0.2));
    steam.direction2 = direction.add(new Vector3(0.2, 0.5, 0.2));
    steam.gravity = new Vector3(0, 0.5, 0);

    steam.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    this.steamVents.push(steam);
    steam.start();

    return steam;
  }

  /**
   * Add electrical sparks at a specific position
   */
  addSparkEffect(position: Vector3): ParticleSystem {
    if (!this.particleTexture) {
      throw new Error('Weather system not initialized');
    }

    const sparks = new ParticleSystem(
      `sparks_${this.sparkSystems.length}`,
      this.getParticleCapacity(30),
      this.scene
    );
    sparks.particleTexture = this.particleTexture;

    sparks.emitter = position.clone();
    sparks.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
    sparks.maxEmitBox = new Vector3(0.05, 0.05, 0.05);

    // Burst emission
    sparks.emitRate = 0;
    sparks.manualEmitCount = 15;
    sparks.minLifeTime = 0.1;
    sparks.maxLifeTime = 0.4;

    sparks.minSize = 0.02;
    sparks.maxSize = 0.06;

    // Electric blue/white
    sparks.color1 = new Color4(0.6, 0.8, 1, 1);
    sparks.color2 = new Color4(1, 1, 1, 1);
    sparks.colorDead = new Color4(0.3, 0.5, 0.8, 0);

    sparks.minEmitPower = 3;
    sparks.maxEmitPower = 8;
    sparks.direction1 = new Vector3(-1, -1, -1);
    sparks.direction2 = new Vector3(1, 1, 1);
    sparks.gravity = new Vector3(0, -15, 0);

    sparks.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.sparkSystems.push(sparks);
    sparks.start();

    // Set up periodic bursting
    const burstInterval = 1000 + Math.random() * 3000;
    const intervalId = setInterval(() => {
      if (sparks.isAlive()) {
        sparks.manualEmitCount = 10 + Math.floor(Math.random() * 20);
      }
    }, burstInterval);

    // Store interval for cleanup
    (sparks as any)._burstInterval = intervalId;

    return sparks;
  }

  /**
   * Add emergency light at a specific position
   */
  addEmergencyLight(position: Vector3): PointLight {
    const light = new PointLight(
      `emergencyLight_${this.emergencyLights.length}`,
      position,
      this.scene
    );
    light.diffuse = new Color3(1, 0.2, 0.1);
    light.specular = new Color3(0.5, 0.1, 0.05);
    light.intensity = 0;
    light.range = 15;

    if (this.glowLayer) {
      // Add a small mesh for the light fixture
      const fixture = MeshBuilder.CreateSphere(
        `emergencyFixture_${this.emergencyLights.length}`,
        { diameter: 0.2 },
        this.scene
      );
      fixture.position = position.clone();
      const fixtureMat = new StandardMaterial(
        `emergencyFixtureMat_${this.emergencyLights.length}`,
        this.scene
      );
      fixtureMat.emissiveColor = new Color3(1, 0.2, 0.1);
      fixture.material = fixtureMat;
      this.glowLayer.addIncludedOnlyMesh(fixture);
    }

    this.emergencyLights.push(light);
    return light;
  }

  /**
   * Add air vent particle stream
   */
  addAirVent(position: Vector3, direction: Vector3): ParticleSystem {
    if (!this.particleTexture) {
      throw new Error('Weather system not initialized');
    }

    const airVent = new ParticleSystem(
      `airVent_${Date.now()}`,
      this.getParticleCapacity(40),
      this.scene
    );
    airVent.particleTexture = this.particleTexture;

    airVent.emitter = position.clone();
    airVent.minEmitBox = new Vector3(-0.2, -0.2, -0.02);
    airVent.maxEmitBox = new Vector3(0.2, 0.2, 0.02);

    airVent.emitRate = 40;
    airVent.minLifeTime = 0.3;
    airVent.maxLifeTime = 0.8;

    airVent.minSize = 0.02;
    airVent.maxSize = 0.08;

    // Nearly invisible particles
    airVent.color1 = new Color4(0.6, 0.65, 0.7, 0.15);
    airVent.color2 = new Color4(0.55, 0.6, 0.65, 0.1);
    airVent.colorDead = new Color4(0.5, 0.55, 0.6, 0);

    airVent.minEmitPower = 3;
    airVent.maxEmitPower = 6;
    airVent.direction1 = direction.add(new Vector3(-0.1, -0.1, -0.1));
    airVent.direction2 = direction.add(new Vector3(0.1, 0.1, 0.1));
    airVent.gravity = new Vector3(0, 0, 0);

    airVent.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    airVent.start();

    return airVent;
  }

  // ============================================================================
  // HIVE ENVIRONMENT EFFECTS
  // ============================================================================

  private createHiveEffects(): void {
    // Create glow layer for bioluminescence
    this.glowLayer = new GlowLayer('hiveGlow', this.scene);
    this.glowLayer.intensity = 0.8;

    // Create spore particles
    this.createSporeParticles();

    // Create organic mist
    this.createOrganicMist();
  }

  private createSporeParticles(): void {
    if (!this.particleTexture) return;

    const spores = new ParticleSystem('spores', this.getParticleCapacity(150), this.scene);
    spores.particleTexture = this.particleTexture;

    spores.emitter = this.cameraPosition.clone();
    spores.minEmitBox = new Vector3(-20, -3, -20);
    spores.maxEmitBox = new Vector3(20, 10, 20);

    spores.emitRate = 25;
    spores.minLifeTime = 4;
    spores.maxLifeTime = 8;

    spores.minSize = 0.03;
    spores.maxSize = 0.1;

    // Bioluminescent green/purple
    spores.color1 = new Color4(0.4, 0.9, 0.5, 0.6);
    spores.color2 = new Color4(0.6, 0.5, 0.9, 0.5);
    spores.colorDead = new Color4(0.3, 0.4, 0.3, 0);

    // Slow, floating movement
    spores.minEmitPower = 0.1;
    spores.maxEmitPower = 0.5;
    spores.direction1 = new Vector3(-0.3, 0.5, -0.3);
    spores.direction2 = new Vector3(0.3, 1, 0.3);
    spores.gravity = new Vector3(0, 0.1, 0);

    // Add sine wave motion via angular speed
    spores.minAngularSpeed = -Math.PI / 8;
    spores.maxAngularSpeed = Math.PI / 8;

    spores.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.sporeParticles = spores;
    spores.start();
  }

  private createOrganicMist(): void {
    if (!this.particleTexture) return;

    const mist = new ParticleSystem('organicMist', this.getParticleCapacity(80), this.scene);
    mist.particleTexture = this.particleTexture;

    mist.emitter = this.cameraPosition.clone();
    mist.minEmitBox = new Vector3(-25, -1, -25);
    mist.maxEmitBox = new Vector3(25, 2, 25);

    mist.emitRate = 15;
    mist.minLifeTime = 5;
    mist.maxLifeTime = 10;

    mist.minSize = 0.5;
    mist.maxSize = 2;

    // Purple/green organic fog
    mist.color1 = new Color4(0.2, 0.15, 0.25, 0.2);
    mist.color2 = new Color4(0.15, 0.2, 0.15, 0.15);
    mist.colorDead = new Color4(0.1, 0.1, 0.12, 0);

    mist.minEmitPower = 0.05;
    mist.maxEmitPower = 0.2;
    mist.direction1 = new Vector3(-0.1, 0.1, -0.1);
    mist.direction2 = new Vector3(0.1, 0.3, 0.1);
    mist.gravity = new Vector3(0, 0.02, 0);

    mist.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    this.mistParticles = mist;
    mist.start();
  }

  /**
   * Add bioluminescent glow point
   */
  addBioluminescent(
    position: Vector3,
    color: Color3 = new Color3(0.3, 0.9, 0.5),
    intensity = 1
  ): PointLight {
    const light = new PointLight(`biolight_${this.bioluminescents.length}`, position, this.scene);
    light.diffuse = color;
    light.specular = color.scale(0.3);
    light.intensity = intensity * 0.5;
    light.range = 8;

    // Pulsing will be handled in update
    (light as any)._baseIntensity = intensity * 0.5;
    (light as any)._pulseOffset = Math.random() * Math.PI * 2;

    this.bioluminescents.push(light);

    if (this.glowLayer) {
      // Create a small glowing sphere
      const glowSphere = MeshBuilder.CreateSphere(
        `biolightSphere_${this.bioluminescents.length}`,
        { diameter: 0.3 },
        this.scene
      );
      glowSphere.position = position.clone();
      const glowMat = new StandardMaterial(
        `biolightMat_${this.bioluminescents.length}`,
        this.scene
      );
      glowMat.emissiveColor = color;
      glowMat.disableLighting = true;
      glowSphere.material = glowMat;
      this.glowLayer.addIncludedOnlyMesh(glowSphere);
    }

    return light;
  }

  /**
   * Add dripping moisture effect
   */
  addDripPoint(position: Vector3): ParticleSystem {
    if (!this.particleTexture) {
      throw new Error('Weather system not initialized');
    }

    const drip = new ParticleSystem(
      `drip_${this.dripParticles.length}`,
      this.getParticleCapacity(20),
      this.scene
    );
    drip.particleTexture = this.particleTexture;

    drip.emitter = position.clone();
    drip.minEmitBox = new Vector3(-0.02, 0, -0.02);
    drip.maxEmitBox = new Vector3(0.02, 0, 0.02);

    // Irregular dripping
    drip.emitRate = 2;
    drip.minLifeTime = 0.5;
    drip.maxLifeTime = 1.5;

    drip.minSize = 0.03;
    drip.maxSize = 0.08;

    // Green-tinted moisture
    drip.color1 = new Color4(0.4, 0.6, 0.5, 0.8);
    drip.color2 = new Color4(0.35, 0.55, 0.45, 0.6);
    drip.colorDead = new Color4(0.3, 0.5, 0.4, 0);

    drip.minEmitPower = 0.1;
    drip.maxEmitPower = 0.3;
    drip.direction1 = new Vector3(-0.1, -1, -0.1);
    drip.direction2 = new Vector3(0.1, -0.8, 0.1);
    drip.gravity = new Vector3(0, -10, 0);

    drip.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    this.dripParticles.push(drip);
    drip.start();

    return drip;
  }

  // ============================================================================
  // WEATHER CONTROL
  // ============================================================================

  /**
   * Set weather type with optional intensity
   */
  setWeather(type: WeatherType, intensity: WeatherIntensity = 'medium', immediate = false): void {
    const preset = this.getPresetForType(type);
    if (!preset) {
      log.warn(`Unknown weather type: ${type}`);
      return;
    }

    const newState: WeatherState = {
      ...this.currentState,
      type,
      intensity,
      windSpeed: preset.windSpeed,
      fogDensity: preset.fogDensity,
      fogColor: preset.fogColor,
      ambientModifier: preset.ambientModifier,
    };

    if (immediate) {
      this.currentState = newState;
      this.targetState = null;
      this.applyWeatherState(this.currentState);
    } else {
      this.targetState = newState;
      this.transitionProgress = 0;
    }

    log.info(`Weather changing to ${type} (${intensity})`);
  }

  private getPresetForType(type: WeatherType): WeatherPreset | null {
    if (type in SURFACE_PRESETS) {
      return SURFACE_PRESETS[type as SurfaceWeather];
    }
    if (type in STATION_PRESETS) {
      return STATION_PRESETS[type as StationWeather];
    }
    if (type in HIVE_PRESETS) {
      return HIVE_PRESETS[type as HiveWeather];
    }
    return null;
  }

  /**
   * Set wind direction (affects particle movement)
   */
  setWindDirection(direction: Vector3): void {
    this.currentState.windDirection = direction.normalize();
    this.updateParticleDirections();
  }

  /**
   * Set intensity level
   */
  setIntensity(intensity: WeatherIntensity): void {
    this.currentState.intensity = intensity;
    this.updateParticleRates();
  }

  /**
   * Set quality level for performance adjustment
   */
  setQualityLevel(quality: 'low' | 'medium' | 'high'): void {
    this.qualityLevel = quality;
    // Recreate particles with new quality
    this.disposeParticles();
    this.createEnvironmentEffects();
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update weather system - call every frame
   */
  update(deltaTime: number, cameraPosition: Vector3): void {
    this.cameraPosition = cameraPosition;

    // Handle weather transitions
    if (this.targetState) {
      this.updateTransition(deltaTime);
    }

    // Update particle emitter positions
    this.updateParticlePositions();

    // Environment-specific updates
    switch (this.currentState.environment) {
      case 'surface':
        this.updateSurfaceEffects(deltaTime);
        break;
      case 'station':
        this.updateStationEffects(deltaTime);
        break;
      case 'hive':
        this.updateHiveEffects(deltaTime);
        break;
    }
  }

  private updateTransition(deltaTime: number): void {
    if (!this.targetState) return;

    this.transitionProgress += deltaTime / this.transitionDuration;

    if (this.transitionProgress >= 1) {
      this.currentState = this.targetState;
      this.targetState = null;
      this.transitionProgress = 0;
      this.applyWeatherState(this.currentState);
    } else {
      // Interpolate values
      const t = this.easeInOut(this.transitionProgress);
      const interpolatedState: WeatherState = {
        ...this.currentState,
        windSpeed: this.lerp(this.currentState.windSpeed, this.targetState.windSpeed, t),
        fogDensity: this.lerp(this.currentState.fogDensity, this.targetState.fogDensity, t),
        fogColor: Color3.Lerp(this.currentState.fogColor, this.targetState.fogColor, t),
        ambientModifier: this.lerp(
          this.currentState.ambientModifier,
          this.targetState.ambientModifier,
          t
        ),
      };
      this.applyWeatherState(interpolatedState);
    }
  }

  private applyWeatherState(state: WeatherState): void {
    // Apply fog
    if (state.fogDensity > 0) {
      this.scene.fogMode = 3; // Exponential fog
      this.scene.fogDensity = state.fogDensity;
      this.scene.fogColor = state.fogColor;
    } else {
      this.scene.fogMode = 0;
    }

    // Update particle rates based on intensity
    this.updateParticleRates();

    // Update particle directions based on wind
    this.updateParticleDirections();
  }

  private updateParticlePositions(): void {
    // Move ambient particles around camera
    if (this.dustParticles) {
      (this.dustParticles.emitter as Vector3).copyFrom(this.cameraPosition);
    }
    if (this.windStreaks) {
      (this.windStreaks.emitter as Vector3).copyFrom(this.cameraPosition);
    }
    if (this.sporeParticles) {
      (this.sporeParticles.emitter as Vector3).copyFrom(this.cameraPosition);
    }
    if (this.mistParticles) {
      (this.mistParticles.emitter as Vector3).copyFrom(this.cameraPosition);
    }
  }

  private updateParticleRates(): void {
    const multiplier =
      INTENSITY_MULTIPLIERS[this.currentState.intensity] *
      this.getPresetForType(this.currentState.type)!.particleMultiplier;

    if (this.dustParticles) {
      this.dustParticles.emitRate = 50 * multiplier;
    }
    if (this.windStreaks) {
      this.windStreaks.emitRate = 20 * multiplier;
    }
    if (this.sporeParticles) {
      this.sporeParticles.emitRate = 25 * multiplier;
    }
    if (this.mistParticles) {
      this.mistParticles.emitRate = 15 * multiplier;
    }
  }

  private updateParticleDirections(): void {
    const wind = this.currentState.windDirection.scale(this.currentState.windSpeed);

    if (this.dustParticles) {
      this.dustParticles.direction1 = wind.add(new Vector3(-2, -0.5, -1));
      this.dustParticles.direction2 = wind.add(new Vector3(2, 0.5, 1));
    }

    if (this.windStreaks) {
      this.windStreaks.direction1 = wind.scale(0.8);
      this.windStreaks.direction2 = wind.scale(1.2).add(new Vector3(0, 0.2, 0));
    }
  }

  private updateSurfaceEffects(deltaTime: number): void {
    // Lightning effect for storms
    const weatherType = this.currentState.type as SurfaceWeather;
    if (weatherType === 'dust_storm' || weatherType === 'sandstorm') {
      this.updateLightning(deltaTime);

      // Show heat haze
      if (this.heatHazeMesh) {
        this.heatHazeMesh.isVisible = true;
        // Animate heat haze position slightly
        this.heatHazeMesh.position.y = 2 + Math.sin(Date.now() * 0.001) * 0.5;
      }
    } else {
      if (this.lightningLight) {
        this.lightningLight.intensity = 0;
      }
      if (this.heatHazeMesh) {
        this.heatHazeMesh.isVisible = false;
      }
    }
  }

  private updateLightning(deltaTime: number): void {
    if (!this.lightningLight) return;

    this.lightningTimer -= deltaTime;
    this.lightningCooldown -= deltaTime;

    if (this.lightningCooldown <= 0 && Math.random() < 0.02) {
      // Trigger lightning flash
      this.lightningLight.intensity = 5 + Math.random() * 5;
      this.lightningTimer = 0.1 + Math.random() * 0.1;

      // Random position for variety
      this.lightningLight.position.x = (Math.random() - 0.5) * 400;
      this.lightningLight.position.z = -200 - Math.random() * 200;

      this.lightningCooldown = 3 + Math.random() * 8;
    }

    if (this.lightningTimer > 0) {
      // Flicker during flash
      if (Math.random() < 0.3) {
        this.lightningLight.intensity *= 0.5;
      }
    } else {
      // Fade out
      this.lightningLight.intensity *= 0.85;
      if (this.lightningLight.intensity < 0.1) {
        this.lightningLight.intensity = 0;
      }
    }
  }

  private updateStationEffects(deltaTime: number): void {
    // Update emergency lights
    const weatherType = this.currentState.type as StationWeather;
    if (
      weatherType === 'emergency' ||
      weatherType === 'damaged' ||
      weatherType === 'depressurizing'
    ) {
      this.emergencyLightTimer += deltaTime;

      for (const light of this.emergencyLights) {
        // Pulsing red emergency lights
        const pulse = Math.sin(this.emergencyLightTimer * 4) * 0.5 + 0.5;
        light.intensity = pulse * 2;
      }
    } else {
      for (const light of this.emergencyLights) {
        light.intensity = 0;
      }
    }
  }

  private updateHiveEffects(_deltaTime: number): void {
    // Update bioluminescent pulsing
    const time = Date.now() * 0.001;

    for (const light of this.bioluminescents) {
      const baseIntensity = (light as any)._baseIntensity ?? 0.5;
      const offset = (light as any)._pulseOffset ?? 0;

      // Slow organic pulsing
      const pulse = Math.sin(time * 0.5 + offset) * 0.3 + 0.7;
      light.intensity = baseIntensity * pulse;
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private getParticleCapacity(base: number): number {
    const qualityMultiplier =
      this.qualityLevel === 'low' ? 0.3 : this.qualityLevel === 'medium' ? 0.6 : 1.0;
    return Math.floor(base * qualityMultiplier);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  // ============================================================================
  // STATE GETTERS
  // ============================================================================

  getCurrentState(): WeatherState {
    return { ...this.currentState };
  }

  isTransitioning(): boolean {
    return this.targetState !== null;
  }

  getWindDirection(): Vector3 {
    return this.currentState.windDirection.clone();
  }

  getWindSpeed(): number {
    return this.currentState.windSpeed;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  private disposeParticles(): void {
    this.dustParticles?.dispose();
    this.dustParticles = null;

    this.windStreaks?.dispose();
    this.windStreaks = null;

    for (const steam of this.steamVents) {
      steam.dispose();
    }
    this.steamVents = [];

    for (const sparks of this.sparkSystems) {
      if ((sparks as any)._burstInterval) {
        clearInterval((sparks as any)._burstInterval);
      }
      sparks.dispose();
    }
    this.sparkSystems = [];

    this.sporeParticles?.dispose();
    this.sporeParticles = null;

    this.mistParticles?.dispose();
    this.mistParticles = null;

    for (const drip of this.dripParticles) {
      drip.dispose();
    }
    this.dripParticles = [];
  }

  dispose(): void {
    this.disposeParticles();

    this.lightningLight?.dispose();
    this.lightningLight = null;

    this.heatHazeMesh?.dispose();
    this.heatHazeMesh = null;

    for (const light of this.emergencyLights) {
      light.dispose();
    }
    this.emergencyLights = [];

    for (const light of this.bioluminescents) {
      light.dispose();
    }
    this.bioluminescents = [];

    this.glowLayer?.dispose();
    this.glowLayer = null;

    this.particleTexture?.dispose();
    this.particleTexture = null;

    log.info('Disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let weatherSystemInstance: WeatherSystem | null = null;

/**
 * Get or create the weather system singleton
 */
export function getWeatherSystem(scene?: Scene): WeatherSystem {
  if (!weatherSystemInstance && scene) {
    weatherSystemInstance = new WeatherSystem(scene);
  }
  if (!weatherSystemInstance) {
    throw new Error('WeatherSystem not initialized - provide a scene');
  }
  return weatherSystemInstance;
}

/**
 * Dispose the weather system singleton
 */
export function disposeWeatherSystem(): void {
  if (weatherSystemInstance) {
    weatherSystemInstance.dispose();
    weatherSystemInstance = null;
  }
}
