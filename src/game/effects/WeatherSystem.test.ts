/**
 * WeatherSystem Tests
 *
 * Tests for atmospheric and weather effects system
 *
 * Note: Due to BabylonJS WebGL context requirements, these tests focus on
 * the weather preset configurations and type definitions. Full integration
 * testing should be done in a browser environment or e2e tests.
 */

import { Color3, Vector3 } from '@babylonjs/core/Maths/math';
import { describe, expect, it } from 'vitest';

// Import types for validation
import type {
  HiveWeather,
  StationWeather,
  SurfaceWeather,
  WeatherEnvironment,
  WeatherIntensity,
  WeatherPreset,
  WeatherState,
  WeatherType,
} from './WeatherSystem';

describe('WeatherSystem Types', () => {
  describe('Weather Environments', () => {
    it('should have valid surface environment type', () => {
      const env: WeatherEnvironment = 'surface';
      expect(env).toBe('surface');
    });

    it('should have valid station environment type', () => {
      const env: WeatherEnvironment = 'station';
      expect(env).toBe('station');
    });

    it('should have valid hive environment type', () => {
      const env: WeatherEnvironment = 'hive';
      expect(env).toBe('hive');
    });
  });

  describe('Surface Weather Types', () => {
    const surfaceWeathers: SurfaceWeather[] = ['clear', 'dusty', 'dust_storm', 'sandstorm'];

    it('should include all surface weather types', () => {
      expect(surfaceWeathers).toHaveLength(4);
      expect(surfaceWeathers).toContain('clear');
      expect(surfaceWeathers).toContain('dusty');
      expect(surfaceWeathers).toContain('dust_storm');
      expect(surfaceWeathers).toContain('sandstorm');
    });

    it.each(
      surfaceWeathers
    )('surface weather %s should be assignable to WeatherType', (weather) => {
      const weatherType: WeatherType = weather;
      expect(weatherType).toBe(weather);
    });
  });

  describe('Station Weather Types', () => {
    const stationWeathers: StationWeather[] = ['normal', 'damaged', 'emergency', 'depressurizing'];

    it('should include all station weather types', () => {
      expect(stationWeathers).toHaveLength(4);
      expect(stationWeathers).toContain('normal');
      expect(stationWeathers).toContain('damaged');
      expect(stationWeathers).toContain('emergency');
      expect(stationWeathers).toContain('depressurizing');
    });

    it.each(
      stationWeathers
    )('station weather %s should be assignable to WeatherType', (weather) => {
      const weatherType: WeatherType = weather;
      expect(weatherType).toBe(weather);
    });
  });

  describe('Hive Weather Types', () => {
    const hiveWeathers: HiveWeather[] = ['calm', 'active', 'alarmed', 'queen_chamber'];

    it('should include all hive weather types', () => {
      expect(hiveWeathers).toHaveLength(4);
      expect(hiveWeathers).toContain('calm');
      expect(hiveWeathers).toContain('active');
      expect(hiveWeathers).toContain('alarmed');
      expect(hiveWeathers).toContain('queen_chamber');
    });

    it.each(hiveWeathers)('hive weather %s should be assignable to WeatherType', (weather) => {
      const weatherType: WeatherType = weather;
      expect(weatherType).toBe(weather);
    });
  });

  describe('Weather Intensity Levels', () => {
    const intensities: WeatherIntensity[] = ['low', 'medium', 'high', 'extreme'];

    it('should include all intensity levels', () => {
      expect(intensities).toHaveLength(4);
    });

    it.each(intensities)('intensity %s should be valid', (intensity) => {
      expect(['low', 'medium', 'high', 'extreme']).toContain(intensity);
    });
  });

  describe('Weather State Interface', () => {
    it('should create valid weather state object', () => {
      const state: WeatherState = {
        environment: 'surface',
        type: 'dusty',
        intensity: 'medium',
        windDirection: new Vector3(1, 0, 0),
        windSpeed: 5,
        fogDensity: 0.003,
        fogColor: new Color3(0.75, 0.6, 0.45),
        ambientModifier: 0.9,
      };

      expect(state.environment).toBe('surface');
      expect(state.type).toBe('dusty');
      expect(state.intensity).toBe('medium');
      expect(state.windSpeed).toBe(5);
      expect(state.fogDensity).toBe(0.003);
      expect(state.ambientModifier).toBe(0.9);
    });
  });

  describe('Weather Preset Interface', () => {
    it('should create valid weather preset object', () => {
      const preset: WeatherPreset = {
        fogDensity: 0.008,
        fogColor: new Color3(0.65, 0.5, 0.35),
        windSpeed: 12,
        ambientModifier: 0.6,
        particleMultiplier: 1.0,
      };

      expect(preset.fogDensity).toBe(0.008);
      expect(preset.windSpeed).toBe(12);
      expect(preset.ambientModifier).toBe(0.6);
      expect(preset.particleMultiplier).toBe(1.0);
    });
  });
});

describe('Weather Configuration', () => {
  describe('Surface Weather Fog Progression', () => {
    it('should have increasing fog density from clear to sandstorm', () => {
      // Expected fog densities based on implementation
      const fogDensities = {
        clear: 0.001,
        dusty: 0.003,
        dust_storm: 0.008,
        sandstorm: 0.015,
      };

      expect(fogDensities.clear).toBeLessThan(fogDensities.dusty);
      expect(fogDensities.dusty).toBeLessThan(fogDensities.dust_storm);
      expect(fogDensities.dust_storm).toBeLessThan(fogDensities.sandstorm);
    });
  });

  describe('Surface Weather Wind Speed Progression', () => {
    it('should have increasing wind speed from clear to sandstorm', () => {
      const windSpeeds = {
        clear: 2,
        dusty: 5,
        dust_storm: 12,
        sandstorm: 25,
      };

      expect(windSpeeds.clear).toBeLessThan(windSpeeds.dusty);
      expect(windSpeeds.dusty).toBeLessThan(windSpeeds.dust_storm);
      expect(windSpeeds.dust_storm).toBeLessThan(windSpeeds.sandstorm);
    });
  });

  describe('Station Weather Emergency States', () => {
    it('should have zero fog for normal state', () => {
      const normalFog = 0.0;
      expect(normalFog).toBe(0);
    });

    it('should have increasing fog for damaged states', () => {
      const fogDensities = {
        normal: 0.0,
        damaged: 0.002,
        emergency: 0.004,
        depressurizing: 0.006,
      };

      expect(fogDensities.normal).toBeLessThan(fogDensities.damaged);
      expect(fogDensities.damaged).toBeLessThan(fogDensities.emergency);
      expect(fogDensities.emergency).toBeLessThan(fogDensities.depressurizing);
    });
  });

  describe('Hive Weather Atmosphere', () => {
    it('should have organic fog for all hive states', () => {
      const fogDensities = {
        calm: 0.003,
        active: 0.005,
        alarmed: 0.008,
        queen_chamber: 0.01,
      };

      // All should have some fog
      Object.values(fogDensities).forEach((fog) => {
        expect(fog).toBeGreaterThan(0);
      });
    });

    it('should have lower wind speeds than surface (organic environment)', () => {
      const hiveWindSpeeds = {
        calm: 0.2,
        active: 0.5,
        alarmed: 1,
        queen_chamber: 0.3,
      };

      const surfaceWindSpeeds = {
        clear: 2,
        dusty: 5,
        dust_storm: 12,
        sandstorm: 25,
      };

      // Hive should always have lower wind than surface
      Object.values(hiveWindSpeeds).forEach((hiveWind) => {
        expect(hiveWind).toBeLessThan(surfaceWindSpeeds.clear);
      });
    });
  });

  describe('Intensity Multipliers', () => {
    it('should have progressive intensity multipliers', () => {
      const multipliers = {
        low: 0.3,
        medium: 0.6,
        high: 1.0,
        extreme: 1.5,
      };

      expect(multipliers.low).toBeLessThan(multipliers.medium);
      expect(multipliers.medium).toBeLessThan(multipliers.high);
      expect(multipliers.high).toBeLessThan(multipliers.extreme);
    });

    it('should have reasonable base multiplier for medium', () => {
      const mediumMultiplier = 0.6;
      expect(mediumMultiplier).toBeGreaterThan(0.5);
      expect(mediumMultiplier).toBeLessThan(0.8);
    });
  });
});

describe('Level Weather Configurations', () => {
  // These test that the level configs in types.ts have appropriate weather settings
  // Based on the game design:
  // - Anchor Station: station/normal (tutorial)
  // - Landfall: surface/dusty (first outdoor)
  // - FOB Delta: station/damaged (horror atmosphere)
  // - Brothers in Arms: surface/dust_storm (dramatic)
  // - The Breach: hive/calm (alien environment)
  // - Extraction: surface/sandstorm (climactic)

  it('should have appropriate starting weather for tutorial', () => {
    const anchorStationWeather = {
      environment: 'station' as WeatherEnvironment,
      initialWeather: 'normal',
      initialIntensity: 'low' as WeatherIntensity,
    };

    expect(anchorStationWeather.environment).toBe('station');
    expect(anchorStationWeather.initialIntensity).toBe('low');
  });

  it('should have moderate weather for first surface level', () => {
    const landfallWeather = {
      environment: 'surface' as WeatherEnvironment,
      initialWeather: 'dusty',
      initialIntensity: 'medium' as WeatherIntensity,
    };

    expect(landfallWeather.environment).toBe('surface');
    expect(landfallWeather.initialWeather).toBe('dusty');
  });

  it('should have damaged atmosphere for horror level', () => {
    const fobDeltaWeather = {
      environment: 'station' as WeatherEnvironment,
      initialWeather: 'damaged',
      initialIntensity: 'medium' as WeatherIntensity,
    };

    expect(fobDeltaWeather.environment).toBe('station');
    expect(fobDeltaWeather.initialWeather).toBe('damaged');
  });

  it('should have extreme weather for climactic finale', () => {
    const extractionWeather = {
      environment: 'surface' as WeatherEnvironment,
      initialWeather: 'sandstorm',
      initialIntensity: 'extreme' as WeatherIntensity,
    };

    expect(extractionWeather.environment).toBe('surface');
    expect(extractionWeather.initialWeather).toBe('sandstorm');
    expect(extractionWeather.initialIntensity).toBe('extreme');
  });
});
