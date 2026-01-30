/**
 * AtmosphericEffects Tests
 *
 * Tests for god rays, emergency lighting, dust storms, and spore clouds.
 */

import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js modules
vi.mock('@babylonjs/core/Layers/glowLayer', () => ({
  GlowLayer: class MockGlowLayer {
    intensity = 0;
    addIncludedOnlyMesh = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class MockPointLight {
    diffuse = new Color3(1, 1, 1);
    intensity = 0;
    range = 10;
    position = new Vector3(0, 0, 0);
    dispose = vi.fn();
    constructor(name: string, position: Vector3, scene: unknown) {
      this.position = position.clone();
    }
  },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: class MockStandardMaterial {
    diffuseColor = new Color3(1, 1, 1);
    emissiveColor = new Color3(0, 0, 0);
    specularColor = new Color3(1, 1, 1);
    alpha = 1;
    backFaceCulling = true;
    disableLighting = false;
    dispose = vi.fn();
  },
}));

vi.mock('@babylonjs/core/Materials/Textures/texture', () => ({
  Texture: class MockTexture {
    name = 'mockTexture';
    static BILINEAR_SAMPLINGMODE = 2;
    dispose = vi.fn();
  },
}));

const createMockMesh = () => ({
  position: new Vector3(0, 0, 0),
  rotation: new Vector3(0, 0, 0),
  scaling: { setAll: vi.fn() },
  material: null,
  isVisible: true,
  dispose: vi.fn(),
});

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateSphere: vi.fn().mockImplementation(() => createMockMesh()),
    CreatePlane: vi.fn().mockImplementation(() => createMockMesh()),
    CreateCylinder: vi.fn().mockImplementation(() => createMockMesh()),
  },
}));

vi.mock('@babylonjs/core/Particles/particleSystem', () => ({
  ParticleSystem: class MockParticleSystem {
    static BLENDMODE_STANDARD = 0;
    static BLENDMODE_ADD = 1;
    particleTexture = null;
    emitter = new Vector3(0, 0, 0);
    minEmitBox = new Vector3(0, 0, 0);
    maxEmitBox = new Vector3(0, 0, 0);
    emitRate = 0;
    minLifeTime = 0;
    maxLifeTime = 1;
    minSize = 0.1;
    maxSize = 0.5;
    minScaleY = 1;
    maxScaleY = 1;
    color1 = new Color4(1, 1, 1, 1);
    color2 = new Color4(1, 1, 1, 1);
    colorDead = new Color4(0, 0, 0, 0);
    minEmitPower = 1;
    maxEmitPower = 2;
    direction1 = new Vector3(0, 1, 0);
    direction2 = new Vector3(0, 1, 0);
    gravity = new Vector3(0, 0, 0);
    minAngularSpeed = 0;
    maxAngularSpeed = 0;
    blendMode = 0;
    updateSpeed = 0.01;
    start = vi.fn();
    stop = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess', () => ({
  VolumetricLightScatteringPostProcess: class MockVolumetricLightScatteringPostProcess {
    exposure = 0.3;
    decay = 0.97;
    weight = 0.5;
    dispose = vi.fn();
  },
}));

// Import after mocks
import {
  AtmosphericEffects,
  disposeAtmosphericEffects,
  getAtmosphericEffects,
} from './AtmosphericEffects';

// Create mock scene and camera
const createMockScene = () => ({
  fogMode: 0,
  fogDensity: 0,
  fogColor: new Color3(0.5, 0.5, 0.5),
  getEngine: vi.fn().mockReturnValue({}),
});

const createMockCamera = () => ({
  position: new Vector3(0, 0, 0),
  rotation: new Vector3(0, 0, 0),
});

describe('AtmosphericEffects', () => {
  let scene: ReturnType<typeof createMockScene>;
  let camera: ReturnType<typeof createMockCamera>;
  let effects: AtmosphericEffects;

  beforeEach(() => {
    // Reset singleton
    disposeAtmosphericEffects();

    scene = createMockScene();
    camera = createMockCamera();
    effects = new AtmosphericEffects(scene as any, camera as any);
  });

  describe('initialization', () => {
    it('should create an instance', () => {
      expect(effects).toBeDefined();
    });

    it('should allow setting camera', () => {
      const newCamera = createMockCamera();
      effects.setCamera(newCamera as any);
      // No error thrown
    });

    it('should allow setting quality level', () => {
      effects.setQualityLevel('high');
      effects.setQualityLevel('low');
      // No error thrown
    });
  });

  describe('emergency lights', () => {
    it('should create an emergency light with pulse pattern', () => {
      effects.createEmergencyLight('test', {
        position: new Vector3(0, 2, 0),
        pattern: 'pulse',
      });

      // Light should be created
      expect(effects['emergencyLights'].has('test')).toBe(true);
    });

    it('should create an emergency light with strobe pattern', () => {
      effects.createEmergencyLight('strobe1', {
        position: new Vector3(5, 2, 0),
        pattern: 'strobe',
        speed: 2,
      });

      expect(effects['emergencyLights'].has('strobe1')).toBe(true);
    });

    it('should create an emergency light with custom color', () => {
      effects.createEmergencyLight('custom', {
        position: new Vector3(0, 2, 0),
        color: new Color3(0, 1, 0),
        pattern: 'alarm',
      });

      const light = effects['emergencyLights'].get('custom');
      expect(light).toBeDefined();
    });

    it('should create a row of emergency lights', () => {
      effects.createEmergencyLightRow(
        'corridor',
        new Vector3(0, 2, 0),
        new Vector3(0, 2, 20),
        5,
        'sweep'
      );

      // Should create 5 lights
      expect(effects['emergencyLights'].has('corridor_0')).toBe(true);
      expect(effects['emergencyLights'].has('corridor_4')).toBe(true);
    });

    it('should remove an emergency light', () => {
      effects.createEmergencyLight('toRemove', {
        position: new Vector3(0, 2, 0),
        pattern: 'pulse',
      });

      expect(effects['emergencyLights'].has('toRemove')).toBe(true);

      effects.removeEmergencyLight('toRemove');

      expect(effects['emergencyLights'].has('toRemove')).toBe(false);
    });

    it('should toggle emergency lights active state', () => {
      effects.createEmergencyLight('toggle1', {
        position: new Vector3(0, 2, 0),
        pattern: 'pulse',
      });

      effects.setEmergencyLightsActive(true);
      effects.setEmergencyLightsActive(false);
      // No error thrown
    });
  });

  describe('dust storms', () => {
    it('should initialize a dust storm', () => {
      effects.initializeDustStorm({
        intensity: 0.8,
        windDirection: new Vector3(1, 0, 0.3).normalize(),
        windSpeed: 15,
        particleColor: new Color4(0.7, 0.55, 0.35, 0.4),
        visibility: 0.3,
      });

      expect(effects['dustStormParticles']).not.toBeNull();
      expect(effects['windStreakParticles']).not.toBeNull();
      expect(effects['debrisParticles']).not.toBeNull();
    });

    it('should update dust storm intensity', () => {
      effects.initializeDustStorm({
        intensity: 0.5,
        windDirection: new Vector3(1, 0, 0),
        windSpeed: 10,
        particleColor: new Color4(0.6, 0.5, 0.4, 0.3),
        visibility: 0.5,
      });

      effects.setDustStormIntensity(1.0);

      expect(effects['dustStormConfig']?.intensity).toBe(1.0);
    });

    it('should stop dust storm', () => {
      effects.initializeDustStorm({
        intensity: 0.5,
        windDirection: new Vector3(1, 0, 0),
        windSpeed: 10,
        particleColor: new Color4(0.6, 0.5, 0.4, 0.3),
        visibility: 0.5,
      });

      effects.stopDustStorm();

      expect(effects['dustStormParticles']).toBeNull();
      expect(effects['dustStormConfig']).toBeNull();
    });
  });

  describe('spore clouds', () => {
    it('should create a spore cloud', () => {
      effects.createSporeCloud('hiveSpores', {
        position: new Vector3(10, 0, 10),
        radius: 5,
        density: 1,
        color: new Color4(0.4, 0.9, 0.5, 0.6),
      });

      expect(effects['sporeClouds'].has('hiveSpores')).toBe(true);
    });

    it('should create a pulsing spore cloud', () => {
      effects.createSporeCloud('pulsingSpores', {
        position: new Vector3(0, 0, 0),
        radius: 3,
        density: 0.5,
        color: new Color4(0.6, 0.5, 0.9, 0.5),
        pulsing: true,
      });

      const cloud = effects['sporeClouds'].get('pulsingSpores');
      expect(cloud?.config.pulsing).toBe(true);
    });

    it('should create a pheromone cloud', () => {
      const id = effects.createPheromoneCloud(new Vector3(5, 0, 5), 4);

      expect(id).toMatch(/^pheromone_/);
      expect(effects['sporeClouds'].has(id)).toBe(true);
    });

    it('should remove a spore cloud', () => {
      effects.createSporeCloud('toRemove', {
        position: new Vector3(0, 0, 0),
        radius: 2,
        density: 1,
        color: new Color4(0.3, 0.8, 0.4, 0.5),
      });

      effects.removeSporeCloud('toRemove');

      expect(effects['sporeClouds'].has('toRemove')).toBe(false);
    });
  });

  describe('fog zones', () => {
    it('should create a fog zone', () => {
      effects.createFogZone('transitZone', {
        position: new Vector3(20, 0, 20),
        radius: 10,
        density: 0.5,
        color: new Color3(0.2, 0.2, 0.3),
      });

      expect(effects['fogZones'].has('transitZone')).toBe(true);
    });

    it('should create a fog zone with custom height', () => {
      effects.createFogZone('tallFog', {
        position: new Vector3(0, 0, 0),
        radius: 8,
        density: 0.3,
        color: new Color3(0.1, 0.15, 0.2),
        height: 5,
      });

      const zone = effects['fogZones'].get('tallFog');
      expect(zone?.config.height).toBe(5);
    });

    it('should remove a fog zone', () => {
      effects.createFogZone('toRemove', {
        position: new Vector3(0, 0, 0),
        radius: 5,
        density: 0.4,
        color: new Color3(0.2, 0.2, 0.2),
      });

      effects.removeFogZone('toRemove');

      expect(effects['fogZones'].has('toRemove')).toBe(false);
    });
  });

  describe('heat haze', () => {
    it('should initialize heat haze', () => {
      effects.initializeHeatHaze();

      expect(effects['heatHazeMesh']).not.toBeNull();
    });

    it('should set heat haze intensity', () => {
      effects.initializeHeatHaze();
      effects.setHeatHazeIntensity(0.8);

      expect(effects['heatHazeIntensity']).toBe(0.8);
    });

    it('should hide heat haze when intensity is zero', () => {
      effects.initializeHeatHaze();
      effects.setHeatHazeIntensity(0);

      expect(effects['heatHazeMesh']?.isVisible).toBe(false);
    });
  });

  describe('god rays', () => {
    it('should warn if camera not set when creating god rays', () => {
      const noCamera = new AtmosphericEffects(scene as any);
      const warnSpy = vi.spyOn(console, 'warn');

      noCamera.createGodRays('test', {
        position: new Vector3(100, 100, 0),
        color: new Color3(1, 0.9, 0.7),
        density: 0.5,
        decay: 0.97,
        exposure: 0.3,
        samples: 50,
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Camera required for god rays'));
    });

    it('should create god rays with camera', () => {
      effects.createGodRays('sunRays', {
        position: new Vector3(200, 150, -300),
        color: new Color3(1, 0.95, 0.8),
        density: 0.7,
        decay: 0.97,
        exposure: 0.3,
        samples: 80,
      });

      expect(effects['godRays'].has('sunRays')).toBe(true);
    });

    it('should create sun god rays', () => {
      effects.createSunGodRays(new Vector3(100, 200, -500), 0.8);

      expect(effects['godRays'].has('sun')).toBe(true);
    });

    it('should create spotlight god rays', () => {
      effects.createSpotlightGodRays('window1', new Vector3(5, 3, 0));

      expect(effects['godRays'].has('window1')).toBe(true);
    });

    it('should update god ray position', () => {
      effects.createGodRays('movingLight', {
        position: new Vector3(0, 50, 0),
        color: new Color3(1, 1, 1),
        density: 0.5,
        decay: 0.95,
        exposure: 0.3,
        samples: 50,
      });

      effects.updateGodRayPosition('movingLight', new Vector3(10, 50, 10));
      // No error thrown
    });

    it('should remove god rays', () => {
      effects.createGodRays('toRemove', {
        position: new Vector3(0, 100, 0),
        color: new Color3(1, 1, 1),
        density: 0.5,
        decay: 0.95,
        exposure: 0.3,
        samples: 50,
      });

      effects.removeGodRays('toRemove');

      expect(effects['godRays'].has('toRemove')).toBe(false);
    });
  });

  describe('update loop', () => {
    it('should update without errors', () => {
      effects.createEmergencyLight('test', {
        position: new Vector3(0, 2, 0),
        pattern: 'pulse',
      });

      effects.initializeDustStorm({
        intensity: 0.5,
        windDirection: new Vector3(1, 0, 0),
        windSpeed: 10,
        particleColor: new Color4(0.5, 0.4, 0.3, 0.3),
        visibility: 0.5,
      });

      effects.createSporeCloud('test', {
        position: new Vector3(0, 0, 0),
        radius: 3,
        density: 1,
        color: new Color4(0.4, 0.8, 0.5, 0.5),
        pulsing: true,
      });

      effects.initializeHeatHaze();
      effects.setHeatHazeIntensity(0.5);

      // Run update for a few frames
      effects.update(0.016, new Vector3(0, 1.7, 0));
      effects.update(0.016, new Vector3(1, 1.7, 1));
      effects.update(0.016, new Vector3(2, 1.7, 2));
    });
  });

  describe('disposal', () => {
    it('should dispose all effects', () => {
      // Create various effects
      effects.createEmergencyLight('light1', {
        position: new Vector3(0, 2, 0),
        pattern: 'pulse',
      });

      effects.initializeDustStorm({
        intensity: 0.5,
        windDirection: new Vector3(1, 0, 0),
        windSpeed: 10,
        particleColor: new Color4(0.5, 0.4, 0.3, 0.3),
        visibility: 0.5,
      });

      effects.createSporeCloud('cloud1', {
        position: new Vector3(10, 0, 10),
        radius: 5,
        density: 1,
        color: new Color4(0.4, 0.9, 0.5, 0.6),
      });

      effects.createFogZone('zone1', {
        position: new Vector3(0, 0, 0),
        radius: 10,
        density: 0.5,
        color: new Color3(0.2, 0.2, 0.3),
      });

      effects.initializeHeatHaze();

      effects.createGodRays('rays1', {
        position: new Vector3(100, 100, 0),
        color: new Color3(1, 1, 1),
        density: 0.5,
        decay: 0.95,
        exposure: 0.3,
        samples: 50,
      });

      // Dispose
      effects.dispose();

      // All collections should be empty
      expect(effects['emergencyLights'].size).toBe(0);
      expect(effects['sporeClouds'].size).toBe(0);
      expect(effects['fogZones'].size).toBe(0);
      expect(effects['godRays'].size).toBe(0);
      expect(effects['dustStormParticles']).toBeNull();
      expect(effects['heatHazeMesh']).toBeNull();
    });
  });

  describe('singleton', () => {
    it('should return same instance from getAtmosphericEffects', () => {
      disposeAtmosphericEffects();

      const instance1 = getAtmosphericEffects(scene as any, camera as any);
      const instance2 = getAtmosphericEffects();

      expect(instance1).toBe(instance2);
    });

    it('should throw if getting without initialization', () => {
      disposeAtmosphericEffects();

      expect(() => getAtmosphericEffects()).toThrow('AtmosphericEffects not initialized');
    });

    it('should dispose singleton properly', () => {
      disposeAtmosphericEffects();
      getAtmosphericEffects(scene as any, camera as any);
      disposeAtmosphericEffects();

      expect(() => getAtmosphericEffects()).toThrow();
    });
  });
});
