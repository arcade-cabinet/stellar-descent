/**
 * Effects Module - Particle systems and visual effects
 *
 * Provides comprehensive visual feedback systems for combat:
 * - ParticleManager: Low-level pooled particle system management
 * - WeaponEffects: High-level weapon-specific effects (muzzle, impacts, trails)
 * - BulletTrails: Bullet trail and tracer effects for ballistic weapons
 * - DamageFeedback: Damage number popups, hit flash, screen shake
 * - MuzzleFlash: Enhanced muzzle flash with light pulses
 * - DeathEffects: Enemy dissolve, disintegrate, and explosion effects
 * - EnvironmentalParticles: Ambient dust, sparks, drips for atmosphere
 * - WeatherSystem: Atmospheric and weather effects for different environments
 * - AtmosphericEffects: God rays, emergency lighting, dust storms, spore clouds
 * - FrostEffect: Screen frost overlay and movement slow debuff (Southern Ice level)
 * - IceShardProjectile: Ice crystal ranged projectile with frost AOE
 * - ShellCasings: Physical brass casing ejection with SPS and ground physics
 * - ImpactDecals: Pool-based bullet hole decals with surface-specific visuals
 * - ImpactParticles: Multi-layer surface-specific impact VFX (metal sparks, concrete dust, etc.)
 */

export type {
  AtmosphereType,
  DustStormConfig,
  EmergencyLightConfig,
  FogZoneConfig,
  GodRayConfig,
  SporeCloudConfig,
} from './AtmosphericEffects';
// Bullet trails and tracers
export type { BulletTrailConfig, WeaponTrailConfig } from './BulletTrails';
export { BulletTrailManager, bulletTrails } from './BulletTrails';
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
// Frost / Ice effects (Southern Ice level)
export type { FrostEffectConfig } from './FrostEffect';
export { FrostEffectManager, frostEffect } from './FrostEffect';
// Low health feedback effects (vignette, heartbeat, breathing)
export type { LowHealthFeedbackConfig } from './LowHealthFeedback';
export {
  LowHealthFeedbackManager,
  lowHealthFeedback,
  getLowHealthFeedback,
  disposeLowHealthFeedback,
} from './LowHealthFeedback';
export type { IceShardConfig } from './IceShardProjectile';
export { destroyIceShardInAir, fireIceShard } from './IceShardProjectile';
// Impact particles - surface-specific impact VFX
export type {
  ImpactParticleLayerConfig,
  ImpactSurfaceConfig,
  ImpactSurfaceType,
} from './ImpactParticles';
export { ImpactParticles, impactParticles } from './ImpactParticles';
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
// Shell casing ejection system
export type { CasingConfig, CasingWeaponType } from './ShellCasings';
export { ShellCasingSystem, shellCasings, categoryToCasingType } from './ShellCasings';
// Impact decals - bullet hole and damage marks
export type { DecalConfig, DecalSurfaceType } from './ImpactDecals';
export {
  ImpactDecalSystem,
  impactDecals,
  createImpactDecal,
  detectMeshSurfaceType,
} from './ImpactDecals';
