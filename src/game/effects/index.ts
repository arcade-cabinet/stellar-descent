/**
 * Effects Module - Particle systems and visual effects
 *
 * Provides comprehensive visual feedback systems for combat:
 * - ParticleManager: Low-level pooled particle system management
 * - WeaponEffects: High-level weapon-specific effects (muzzle, impacts, trails)
 * - DamageFeedback: Damage number popups, hit flash, screen shake
 * - MuzzleFlash: Enhanced muzzle flash with light pulses
 * - DeathEffects: Enemy dissolve, disintegrate, and explosion effects
 * - EnvironmentalParticles: Ambient dust, sparks, drips for atmosphere
 * - WeatherSystem: Atmospheric and weather effects for different environments
 * - AtmosphericEffects: God rays, emergency lighting, dust storms, spore clouds
 * - FrostEffect: Screen frost overlay and movement slow debuff (Southern Ice level)
 * - IceShardProjectile: Ice crystal ranged projectile with frost AOE
 */

export type {
  AtmosphereType,
  DustStormConfig,
  EmergencyLightConfig,
  FogZoneConfig,
  GodRayConfig,
  SporeCloudConfig,
} from './AtmosphericEffects';
export {
  AtmosphericEffects,
  disposeAtmosphericEffects,
  getAtmosphericEffects,
} from './AtmosphericEffects';
export type { DamageFeedbackConfig } from './DamageFeedback';
export { DamageFeedbackManager, damageFeedback } from './DamageFeedback';
export type { DeathEffectConfig, DeathEffectType } from './DeathEffects';
export { DeathEffects, deathEffects } from './DeathEffects';
export type { EnvironmentalEffectType, EnvironmentalEmitterConfig } from './EnvironmentalParticles';
export { EnvironmentalParticles, environmentalParticles } from './EnvironmentalParticles';
export type { MuzzleFlashConfig } from './MuzzleFlash';
export { MuzzleFlashManager, muzzleFlash, WEAPON_FLASH_CONFIGS } from './MuzzleFlash';
export type { ParticleEffectConfig } from './ParticleManager';
export { ParticleManager, particleManager } from './ParticleManager';
export type { SurfaceMaterial, WeaponType } from './WeaponEffects';
export { WeaponEffects, weaponEffects } from './WeaponEffects';
export type {
  HiveWeather,
  StationWeather,
  SurfaceWeather,
  WeatherEnvironment,
  WeatherIntensity,
  WeatherPreset,
  WeatherState,
  WeatherType,
} from './WeatherSystem';
export { disposeWeatherSystem, getWeatherSystem, WeatherSystem } from './WeatherSystem';

// Frost / Ice effects (Southern Ice level)
export type { FrostEffectConfig } from './FrostEffect';
export { FrostEffectManager, frostEffect } from './FrostEffect';
export type { IceShardConfig } from './IceShardProjectile';
export { fireIceShard, destroyIceShardInAir } from './IceShardProjectile';
