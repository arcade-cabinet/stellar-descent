/**
 * AtmosphericEffects - Enhanced atmospheric and volumetric lighting effects
 *
 * Features:
 * - God rays / volumetric light scattering from light sources
 * - Dynamic dust storm visualization with wind-driven particles
 * - Enhanced emergency lighting with flashing patterns
 * - Hive spore clouds with pheromone visualization
 * - Heat haze/distortion effects for hot environments
 * - Fog density zones for transitional areas
 *
 * Integrates with WeatherSystem for environment-specific effects.
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import type { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { VolumetricLightScatteringPostProcess } from '@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';

// ============================================================================
// TYPES
// ============================================================================

export type AtmosphereType = 'surface' | 'station' | 'hive' | 'space';

export interface GodRayConfig {
  position: Vector3;
  color: Color3;
  density: number;
  decay: number;
  exposure: number;
  samples: number;
  direction?: Vector3;
}

export interface EmergencyLightConfig {
  position: Vector3;
  color?: Color3;
  range?: number;
  pattern: 'pulse' | 'strobe' | 'sweep' | 'alarm';
  speed?: number;
}

export interface DustStormConfig {
  intensity: number; // 0-1
  windDirection: Vector3;
  windSpeed: number;
  particleColor: Color4;
  visibility: number; // 0-1 (fog density inverse)
}

export interface SporeCloudConfig {
  position: Vector3;
  radius: number;
  density: number;
  color: Color4;
  pulsing?: boolean;
  damage?: number;
}

export interface FogZoneConfig {
  position: Vector3;
  radius: number;
  density: number;
  color: Color3;
  height?: number;
}

// ============================================================================
// ATMOSPHERIC EFFECTS CLASS
// ============================================================================

export class AtmosphericEffects {
  private scene: Scene;
  private camera: Camera | null = null;

  // God rays
  private godRays: Map<
    string,
    {
      postProcess: VolumetricLightScatteringPostProcess;
      mesh: Mesh;
      light?: PointLight;
    }
  > = new Map();

  // Emergency lights
  private emergencyLights: Map<
    string,
    {
      light: PointLight | SpotLight;
      mesh: Mesh;
      config: EmergencyLightConfig;
      phase: number;
    }
  > = new Map();
  private emergencyLightGlow: GlowLayer | null = null;

  // Dust storm system
  private dustStormParticles: ParticleSystem | null = null;
  private windStreakParticles: ParticleSystem | null = null;
  private debrisParticles: ParticleSystem | null = null;
  private dustStormConfig: DustStormConfig | null = null;

  // Spore clouds
  private sporeClouds: Map<
    string,
    {
      particles: ParticleSystem;
      config: SporeCloudConfig;
      glowMesh?: Mesh;
    }
  > = new Map();

  // Fog zones
  private fogZones: Map<
    string,
    {
      mesh: Mesh;
      config: FogZoneConfig;
    }
  > = new Map();

  // Heat haze
  private heatHazeMesh: Mesh | null = null;
  private heatHazeIntensity = 0;

  // Shared texture
  private particleTexture: Texture | null = null;

  // Camera position for effects
  private cameraPosition: Vector3 = Vector3.Zero();

  // Performance settings
  private qualityLevel: 'low' | 'medium' | 'high' = 'medium';

  constructor(scene: Scene, camera?: Camera) {
    this.scene = scene;
    this.camera = camera ?? null;
    this.createParticleTexture();
    console.log('[AtmosphericEffects] Initialized');
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private createParticleTexture(): void {
    const size = 64;
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
      gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
      gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
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
    this.particleTexture.name = 'atmosphericParticleTexture';
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  setQualityLevel(quality: 'low' | 'medium' | 'high'): void {
    this.qualityLevel = quality;
  }

  // ============================================================================
  // GOD RAYS / VOLUMETRIC LIGHT
  // ============================================================================

  /**
   * Create god rays (volumetric light scattering) from a light source
   * Creates dramatic light shafts through dust/fog
   */
  createGodRays(id: string, config: GodRayConfig): void {
    if (!this.camera) {
      console.warn('[AtmosphericEffects] Camera required for god rays');
      return;
    }

    // Create the light source mesh (sun/light visual)
    const lightMesh = MeshBuilder.CreateSphere(
      `godRayMesh_${id}`,
      {
        diameter: 5,
        segments: 16,
      },
      this.scene
    );

    const lightMat = new StandardMaterial(`godRayMat_${id}`, this.scene);
    lightMat.emissiveColor = config.color;
    lightMat.disableLighting = true;
    lightMesh.material = lightMat;
    lightMesh.position = config.position.clone();

    // Create optional point light for actual illumination
    let light: PointLight | undefined;
    if (config.density > 0.5) {
      light = new PointLight(`godRayLight_${id}`, config.position, this.scene);
      light.diffuse = config.color;
      light.intensity = config.density * 2;
      light.range = 200;
    }

    // Create volumetric light scattering post process
    const godRay = new VolumetricLightScatteringPostProcess(
      `godRay_${id}`,
      1.0, // Ratio
      this.camera,
      lightMesh,
      this.qualityLevel === 'high' ? config.samples : Math.floor(config.samples * 0.5),
      Texture.BILINEAR_SAMPLINGMODE,
      this.scene.getEngine(),
      false // Exclude transparent meshes
    );

    // Configure the effect
    godRay.exposure = config.exposure;
    godRay.decay = config.decay;
    godRay.weight = config.density;

    // Apply custom mesh position if direction specified
    if (config.direction) {
      const dir = config.direction.normalize();
      lightMesh.position = this.cameraPosition.add(dir.scale(500));
    }

    this.godRays.set(id, { postProcess: godRay, mesh: lightMesh, light });
    console.log(`[AtmosphericEffects] Created god rays: ${id}`);
  }

  /**
   * Create sun god rays for surface levels
   */
  createSunGodRays(sunPosition: Vector3, intensity: number = 0.8): void {
    this.createGodRays('sun', {
      position: sunPosition,
      color: new Color3(1.0, 0.9, 0.7), // Warm sunlight
      density: intensity,
      decay: 0.97,
      exposure: 0.3,
      samples: 100,
    });
  }

  /**
   * Create spotlight god rays (e.g., through windows/vents)
   */
  createSpotlightGodRays(id: string, position: Vector3, color: Color3 = new Color3(1, 1, 1)): void {
    this.createGodRays(id, {
      position,
      color,
      density: 0.5,
      decay: 0.95,
      exposure: 0.4,
      samples: 50,
    });
  }

  /**
   * Update god ray position (for moving light sources)
   */
  updateGodRayPosition(id: string, position: Vector3): void {
    const godRay = this.godRays.get(id);
    if (godRay) {
      godRay.mesh.position = position;
      if (godRay.light) {
        godRay.light.position = position;
      }
    }
  }

  /**
   * Remove god rays
   */
  removeGodRays(id: string): void {
    const godRay = this.godRays.get(id);
    if (godRay) {
      godRay.postProcess.dispose(this.camera!);
      godRay.mesh.material?.dispose();
      godRay.mesh.dispose();
      godRay.light?.dispose();
      this.godRays.delete(id);
    }
  }

  // ============================================================================
  // EMERGENCY LIGHTING
  // ============================================================================

  /**
   * Create an emergency light with various patterns
   */
  createEmergencyLight(id: string, config: EmergencyLightConfig): void {
    const color = config.color ?? new Color3(1, 0.2, 0.1);
    const range = config.range ?? 15;
    const speed = config.speed ?? 1;

    // Create light source
    const light = new PointLight(`emergencyLight_${id}`, config.position, this.scene);
    light.diffuse = color;
    light.intensity = 0;
    light.range = range;

    // Create visible fixture mesh
    const fixture = MeshBuilder.CreateSphere(
      `emergencyFixture_${id}`,
      {
        diameter: 0.3,
      },
      this.scene
    );
    fixture.position = config.position.clone();

    const fixtureMat = new StandardMaterial(`emergencyFixtureMat_${id}`, this.scene);
    fixtureMat.emissiveColor = color;
    fixtureMat.disableLighting = true;
    fixture.material = fixtureMat;

    // Initialize glow layer if needed
    if (!this.emergencyLightGlow) {
      this.emergencyLightGlow = new GlowLayer('emergencyGlow', this.scene);
      this.emergencyLightGlow.intensity = 1.5;
    }
    this.emergencyLightGlow.addIncludedOnlyMesh(fixture);

    this.emergencyLights.set(id, {
      light,
      mesh: fixture,
      config: { ...config, speed },
      phase: Math.random() * Math.PI * 2, // Random initial phase
    });
  }

  /**
   * Create a row of emergency lights (e.g., along a corridor)
   */
  createEmergencyLightRow(
    baseId: string,
    startPos: Vector3,
    endPos: Vector3,
    count: number,
    pattern: EmergencyLightConfig['pattern'] = 'pulse'
  ): void {
    const direction = endPos.subtract(startPos);
    const spacing = direction.length() / (count - 1);
    const dirNorm = direction.normalize();

    for (let i = 0; i < count; i++) {
      const pos = startPos.add(dirNorm.scale(i * spacing));
      this.createEmergencyLight(`${baseId}_${i}`, {
        position: pos,
        pattern,
        speed: 1 + i * 0.2, // Slight phase offset for wave effect
      });
    }
  }

  /**
   * Remove emergency light
   */
  removeEmergencyLight(id: string): void {
    const emergency = this.emergencyLights.get(id);
    if (emergency) {
      emergency.light.dispose();
      emergency.mesh.material?.dispose();
      emergency.mesh.dispose();
      this.emergencyLights.delete(id);
    }
  }

  /**
   * Set all emergency lights active/inactive
   */
  setEmergencyLightsActive(active: boolean): void {
    for (const [_, emergency] of this.emergencyLights) {
      emergency.light.intensity = active ? 2 : 0;
    }
  }

  // ============================================================================
  // DUST STORMS
  // ============================================================================

  /**
   * Initialize dust storm particle system for surface levels
   */
  initializeDustStorm(config: DustStormConfig): void {
    if (!this.particleTexture) return;

    this.dustStormConfig = config;

    // Main dust particles - large volume particles
    const dust = new ParticleSystem('dustStorm', this.getParticleCapacity(500), this.scene);
    dust.particleTexture = this.particleTexture;

    dust.emitter = this.cameraPosition.clone();
    dust.minEmitBox = new Vector3(-100, -5, -100);
    dust.maxEmitBox = new Vector3(100, 40, 100);

    dust.emitRate = 100 * config.intensity;
    dust.minLifeTime = 3;
    dust.maxLifeTime = 8;

    dust.minSize = 0.3;
    dust.maxSize = 1.5;

    dust.color1 = config.particleColor;
    dust.color2 = config.particleColor.clone();
    dust.color2.a *= 0.7;
    dust.colorDead = new Color4(
      config.particleColor.r,
      config.particleColor.g,
      config.particleColor.b,
      0
    );

    // Wind-driven movement
    const windPower = config.windSpeed * 2;
    dust.minEmitPower = windPower * 0.5;
    dust.maxEmitPower = windPower;
    dust.direction1 = config.windDirection.add(new Vector3(-0.2, -0.1, -0.2));
    dust.direction2 = config.windDirection.add(new Vector3(0.2, 0.2, 0.2));
    dust.gravity = new Vector3(0, -0.5, 0);

    dust.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    dust.updateSpeed = 0.01;

    this.dustStormParticles = dust;
    dust.start();

    // Wind streaks - fast horizontal particles
    const streaks = new ParticleSystem('windStreaks', this.getParticleCapacity(200), this.scene);
    streaks.particleTexture = this.particleTexture;

    streaks.emitter = this.cameraPosition.clone();
    streaks.minEmitBox = new Vector3(-80, 0, -80);
    streaks.maxEmitBox = new Vector3(80, 30, 80);

    streaks.emitRate = 50 * config.intensity;
    streaks.minLifeTime = 0.3;
    streaks.maxLifeTime = 1.0;

    // Stretched for wind streak effect
    streaks.minSize = 0.03;
    streaks.maxSize = 0.08;
    streaks.minScaleY = 5;
    streaks.maxScaleY = 20;

    // Semi-transparent
    streaks.color1 = new Color4(1, 0.95, 0.85, 0.3);
    streaks.color2 = new Color4(0.9, 0.85, 0.75, 0.2);
    streaks.colorDead = new Color4(0.8, 0.75, 0.65, 0);

    streaks.minEmitPower = windPower * 2;
    streaks.maxEmitPower = windPower * 4;
    streaks.direction1 = config.windDirection.scale(0.9);
    streaks.direction2 = config.windDirection.scale(1.1).add(new Vector3(0, 0.1, 0));
    streaks.gravity = Vector3.Zero();

    streaks.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.windStreakParticles = streaks;
    streaks.start();

    // Debris particles - larger, slower, tumbling
    const debris = new ParticleSystem('debris', this.getParticleCapacity(50), this.scene);
    debris.particleTexture = this.particleTexture;

    debris.emitter = this.cameraPosition.clone();
    debris.minEmitBox = new Vector3(-50, 0, -50);
    debris.maxEmitBox = new Vector3(50, 15, 50);

    debris.emitRate = 5 * config.intensity;
    debris.minLifeTime = 2;
    debris.maxLifeTime = 5;

    debris.minSize = 0.05;
    debris.maxSize = 0.15;

    debris.color1 = new Color4(0.5, 0.4, 0.3, 1);
    debris.color2 = new Color4(0.4, 0.35, 0.3, 0.8);
    debris.colorDead = new Color4(0.3, 0.25, 0.2, 0);

    debris.minEmitPower = windPower * 0.3;
    debris.maxEmitPower = windPower * 0.8;
    debris.direction1 = config.windDirection.add(new Vector3(-0.5, 0.5, -0.5));
    debris.direction2 = config.windDirection.add(new Vector3(0.5, 1, 0.5));
    debris.gravity = new Vector3(0, -3, 0);

    // Angular rotation for tumbling effect
    debris.minAngularSpeed = -Math.PI;
    debris.maxAngularSpeed = Math.PI;

    debris.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    this.debrisParticles = debris;
    debris.start();

    // Apply fog for visibility reduction
    this.scene.fogMode = 3; // Exponential
    this.scene.fogDensity = 0.015 * config.intensity;
    this.scene.fogColor = new Color3(
      config.particleColor.r,
      config.particleColor.g,
      config.particleColor.b
    );

    console.log(`[AtmosphericEffects] Dust storm initialized at intensity ${config.intensity}`);
  }

  /**
   * Update dust storm intensity
   */
  setDustStormIntensity(intensity: number): void {
    if (!this.dustStormConfig) return;

    this.dustStormConfig.intensity = intensity;

    if (this.dustStormParticles) {
      this.dustStormParticles.emitRate = 100 * intensity;
    }
    if (this.windStreakParticles) {
      this.windStreakParticles.emitRate = 50 * intensity;
    }
    if (this.debrisParticles) {
      this.debrisParticles.emitRate = 5 * intensity;
    }

    this.scene.fogDensity = 0.015 * intensity;
  }

  /**
   * Stop dust storm
   */
  stopDustStorm(): void {
    this.dustStormParticles?.dispose();
    this.dustStormParticles = null;

    this.windStreakParticles?.dispose();
    this.windStreakParticles = null;

    this.debrisParticles?.dispose();
    this.debrisParticles = null;

    this.dustStormConfig = null;

    this.scene.fogMode = 0;
  }

  // ============================================================================
  // SPORE CLOUDS (Hive environments)
  // ============================================================================

  /**
   * Create a spore cloud for hive environments
   */
  createSporeCloud(id: string, config: SporeCloudConfig): void {
    if (!this.particleTexture) return;

    const spores = new ParticleSystem(
      `sporeCloud_${id}`,
      this.getParticleCapacity(200),
      this.scene
    );
    spores.particleTexture = this.particleTexture;

    spores.emitter = config.position.clone();
    spores.minEmitBox = new Vector3(-config.radius, -1, -config.radius);
    spores.maxEmitBox = new Vector3(config.radius, config.radius * 0.5, config.radius);

    spores.emitRate = 30 * config.density;
    spores.minLifeTime = 4;
    spores.maxLifeTime = 10;

    spores.minSize = 0.03;
    spores.maxSize = 0.12;

    spores.color1 = config.color;
    spores.color2 = config.color.clone();
    spores.color2.a *= 0.8;
    spores.colorDead = new Color4(config.color.r, config.color.g, config.color.b, 0);

    // Slow, drifting movement
    spores.minEmitPower = 0.1;
    spores.maxEmitPower = 0.5;
    spores.direction1 = new Vector3(-0.3, 0.5, -0.3);
    spores.direction2 = new Vector3(0.3, 1, 0.3);
    spores.gravity = new Vector3(0, 0.1, 0); // Slight upward drift

    // Swaying motion
    spores.minAngularSpeed = -Math.PI / 8;
    spores.maxAngularSpeed = Math.PI / 8;

    spores.blendMode = ParticleSystem.BLENDMODE_ADD;

    // Optional glowing center for pulsing clouds
    let glowMesh: Mesh | undefined;
    if (config.pulsing) {
      glowMesh = MeshBuilder.CreateSphere(
        `sporeGlow_${id}`,
        {
          diameter: config.radius * 0.3,
          segments: 8,
        },
        this.scene
      );
      glowMesh.position = config.position.clone();

      const glowMat = new StandardMaterial(`sporeGlowMat_${id}`, this.scene);
      glowMat.emissiveColor = new Color3(config.color.r, config.color.g, config.color.b);
      glowMat.alpha = 0.3;
      glowMat.disableLighting = true;
      glowMesh.material = glowMat;
    }

    spores.start();

    this.sporeClouds.set(id, { particles: spores, config, glowMesh });
  }

  /**
   * Create pheromone trail/cloud (alerts nearby enemies)
   */
  createPheromoneCloud(position: Vector3, radius: number = 3): string {
    const id = `pheromone_${Date.now()}`;
    this.createSporeCloud(id, {
      position,
      radius,
      density: 1.5,
      color: new Color4(0.8, 0.4, 0.1, 0.5), // Orange-ish warning color
      pulsing: true,
      damage: 0, // No damage, just alerts
    });
    return id;
  }

  /**
   * Remove spore cloud
   */
  removeSporeCloud(id: string): void {
    const cloud = this.sporeClouds.get(id);
    if (cloud) {
      cloud.particles.dispose();
      cloud.glowMesh?.material?.dispose();
      cloud.glowMesh?.dispose();
      this.sporeClouds.delete(id);
    }
  }

  // ============================================================================
  // FOG ZONES
  // ============================================================================

  /**
   * Create a localized fog zone
   */
  createFogZone(id: string, config: FogZoneConfig): void {
    const height = config.height ?? config.radius * 0.5;

    // Create fog volume mesh (cylinder)
    const fogMesh = MeshBuilder.CreateCylinder(
      `fogZone_${id}`,
      {
        height,
        diameter: config.radius * 2,
        tessellation: 16,
      },
      this.scene
    );

    fogMesh.position = config.position.clone();
    fogMesh.position.y += height / 2;

    const fogMat = new StandardMaterial(`fogMat_${id}`, this.scene);
    fogMat.diffuseColor = config.color;
    fogMat.emissiveColor = config.color.scale(0.1);
    fogMat.alpha = config.density * 0.3;
    fogMat.backFaceCulling = false;
    fogMat.disableLighting = true;
    fogMesh.material = fogMat;

    this.fogZones.set(id, { mesh: fogMesh, config });
  }

  /**
   * Remove fog zone
   */
  removeFogZone(id: string): void {
    const zone = this.fogZones.get(id);
    if (zone) {
      zone.mesh.material?.dispose();
      zone.mesh.dispose();
      this.fogZones.delete(id);
    }
  }

  // ============================================================================
  // HEAT HAZE
  // ============================================================================

  /**
   * Initialize heat haze effect for hot environments
   */
  initializeHeatHaze(): void {
    // Create a large plane for heat distortion
    this.heatHazeMesh = MeshBuilder.CreatePlane(
      'heatHaze',
      {
        width: 400,
        height: 100,
      },
      this.scene
    );
    this.heatHazeMesh.position.set(0, 15, 150);
    this.heatHazeMesh.rotation.x = Math.PI / 2 - 0.15;

    const hazeMat = new StandardMaterial('hazeMat', this.scene);
    hazeMat.diffuseColor = new Color3(1, 0.95, 0.9);
    hazeMat.alpha = 0.02;
    hazeMat.backFaceCulling = false;
    hazeMat.disableLighting = true;
    this.heatHazeMesh.material = hazeMat;
    this.heatHazeMesh.isVisible = false;
  }

  /**
   * Set heat haze intensity
   */
  setHeatHazeIntensity(intensity: number): void {
    this.heatHazeIntensity = intensity;
    if (this.heatHazeMesh) {
      this.heatHazeMesh.isVisible = intensity > 0.01;
      if (this.heatHazeMesh.material) {
        (this.heatHazeMesh.material as StandardMaterial).alpha = 0.02 * intensity;
      }
    }
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update all atmospheric effects - call every frame
   */
  update(deltaTime: number, cameraPosition: Vector3): void {
    this.cameraPosition = cameraPosition;

    // Update particle emitter positions
    this.updateParticlePositions();

    // Update emergency lights
    this.updateEmergencyLights(deltaTime);

    // Update spore cloud pulsing
    this.updateSporeClouds(deltaTime);

    // Update heat haze animation
    this.updateHeatHaze(deltaTime);

    // Update fog zones (check player proximity)
    this.updateFogZones();
  }

  private updateParticlePositions(): void {
    if (this.dustStormParticles) {
      (this.dustStormParticles.emitter as Vector3).copyFrom(this.cameraPosition);
    }
    if (this.windStreakParticles) {
      (this.windStreakParticles.emitter as Vector3).copyFrom(this.cameraPosition);
    }
    if (this.debrisParticles) {
      (this.debrisParticles.emitter as Vector3).copyFrom(this.cameraPosition);
    }
  }

  private updateEmergencyLights(deltaTime: number): void {
    const time = performance.now() * 0.001;

    for (const [_, emergency] of this.emergencyLights) {
      emergency.phase += deltaTime * (emergency.config.speed ?? 1);

      let intensity = 0;
      switch (emergency.config.pattern) {
        case 'pulse':
          // Smooth sine wave pulsing
          intensity = Math.sin(emergency.phase * 4) * 0.5 + 0.5;
          break;

        case 'strobe':
          // Sharp on/off flashing
          intensity = Math.sin(emergency.phase * 12) > 0.5 ? 1 : 0;
          break;

        case 'sweep':
          // Slow sweep pattern
          intensity = Math.sin(emergency.phase * 1.5) * 0.5 + 0.5;
          intensity = intensity ** 2; // More dramatic falloff
          break;

        case 'alarm': {
          // Two quick flashes, pause, repeat
          const t = emergency.phase % (Math.PI * 2);
          if (t < Math.PI * 0.3) {
            intensity = 1;
          } else if (t < Math.PI * 0.6) {
            intensity = 0;
          } else if (t < Math.PI * 0.9) {
            intensity = 1;
          } else {
            intensity = 0;
          }
          break;
        }
      }

      emergency.light.intensity = intensity * 2;

      // Update fixture glow
      const mat = emergency.mesh.material as StandardMaterial;
      if (mat) {
        mat.emissiveColor = (emergency.config.color ?? new Color3(1, 0.2, 0.1)).scale(intensity);
      }
    }
  }

  private updateSporeClouds(deltaTime: number): void {
    const time = performance.now() * 0.001;

    for (const [_, cloud] of this.sporeClouds) {
      if (cloud.config.pulsing && cloud.glowMesh) {
        // Pulsing glow effect
        const pulse = Math.sin(time * 2) * 0.3 + 0.7;
        const mat = cloud.glowMesh.material as StandardMaterial;
        if (mat) {
          mat.alpha = 0.3 * pulse;
        }

        // Subtle scale breathing
        const scale = 1 + Math.sin(time * 1.5) * 0.1;
        cloud.glowMesh.scaling.setAll(scale);
      }
    }
  }

  private updateHeatHaze(deltaTime: number): void {
    if (!this.heatHazeMesh || this.heatHazeIntensity <= 0) return;

    const time = performance.now() * 0.001;

    // Animate position for shimmer effect
    this.heatHazeMesh.position.y = 15 + Math.sin(time * 0.5) * 2;

    // Follow camera roughly
    this.heatHazeMesh.position.x = this.cameraPosition.x;
    this.heatHazeMesh.position.z = this.cameraPosition.z + 150;
  }

  private updateFogZones(): void {
    // Could implement density falloff based on camera distance
    // For now, fog zones are static
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private getParticleCapacity(base: number): number {
    const multiplier =
      this.qualityLevel === 'low' ? 0.3 : this.qualityLevel === 'medium' ? 0.6 : 1.0;
    return Math.floor(base * multiplier);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    // Dispose god rays
    for (const [id] of this.godRays) {
      this.removeGodRays(id);
    }

    // Dispose emergency lights
    for (const [id] of this.emergencyLights) {
      this.removeEmergencyLight(id);
    }
    this.emergencyLightGlow?.dispose();
    this.emergencyLightGlow = null;

    // Dispose dust storm
    this.stopDustStorm();

    // Dispose spore clouds
    for (const [id] of this.sporeClouds) {
      this.removeSporeCloud(id);
    }

    // Dispose fog zones
    for (const [id] of this.fogZones) {
      this.removeFogZone(id);
    }

    // Dispose heat haze
    this.heatHazeMesh?.material?.dispose();
    this.heatHazeMesh?.dispose();
    this.heatHazeMesh = null;

    // Dispose particle texture
    this.particleTexture?.dispose();
    this.particleTexture = null;

    console.log('[AtmosphericEffects] Disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let atmosphericEffectsInstance: AtmosphericEffects | null = null;

/**
 * Get or create the atmospheric effects singleton
 */
export function getAtmosphericEffects(scene?: Scene, camera?: Camera): AtmosphericEffects {
  if (!atmosphericEffectsInstance && scene) {
    atmosphericEffectsInstance = new AtmosphericEffects(scene, camera);
  }
  if (!atmosphericEffectsInstance) {
    throw new Error('AtmosphericEffects not initialized - provide a scene');
  }
  return atmosphericEffectsInstance;
}

/**
 * Dispose the atmospheric effects singleton
 */
export function disposeAtmosphericEffects(): void {
  if (atmosphericEffectsInstance) {
    atmosphericEffectsInstance.dispose();
    atmosphericEffectsInstance = null;
  }
}
