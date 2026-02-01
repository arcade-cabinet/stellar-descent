/**
 * Environment Module - Environmental atmosphere and condition systems
 *
 * This module provides comprehensive environmental gameplay systems:
 *
 * ## HazardSystem
 * Zone-based environmental hazards (meter-drain systems):
 * - Cold exposure (Southern Ice levels)
 * - Toxic atmosphere (Hive levels)
 * - Low oxygen (Station breaches)
 * - Radiation (Mining Depths)
 *
 * Instant/damage hazards:
 * - Acid pools (5 dmg/sec, green glow)
 * - Fire (10 dmg/sec, flickering light)
 * - Electricity (15 dmg every 2 sec, arcing)
 * - Toxic gas (DOT + vision impairment)
 * - Freezing zones (DOT + slow)
 * - Explosive barrels (area damage when shot)
 * - Laser grids (instant high damage)
 * - Falling debris (random damage in unstable areas)
 *
 * ## AdvancedWeatherSystem
 * Dynamic weather with gameplay impact:
 * - Ice storms with movement penalties
 * - Meteor showers with damage zones
 * - Electrical storms with EMP effects
 * - Sandstorms with visibility reduction
 *
 * ## EnvironmentalConditions
 * Central manager integrating all systems:
 * - Player movement modifiers
 * - Weapon effects (cold jamming)
 * - Screen effects
 * - Marcus environmental comments
 *
 * ## EnvironmentalStorytelling
 * Ambient world-building elements:
 * - Dead bodies with audio logs
 * - Graffiti and signs
 * - Emergency lights
 * - Environmental audio cues
 *
 * ## ConditionHUD
 * React component for condition display:
 * - Temperature/oxygen/toxicity meters
 * - Warning indicators
 * - Screen overlay effects
 *
 * @example
 * ```typescript
 * // Initialize for a frozen level
 * const conditions = createEnvironmentalConditions(scene, {
 *   type: 'surface_ice',
 *   initialWeather: 'blizzard'
 * });
 *
 * // Add thermal vents for warmth
 * conditions.addThermalVent('vent_1', new Vector3(10, 0, 20), 5);
 *
 * // Set callbacks
 * conditions.setCallbacks({
 *   onDamage: (damage, source) => damagePlayer(damage),
 *   onCommsMessage: (msg) => showComms(msg),
 *   onNotification: (text) => showNotification(text),
 * });
 *
 * // Update each frame
 * conditions.update(deltaTime, playerPosition);
 *
 * // Get player status for movement calculations
 * const status = conditions.getPlayerStatus();
 * moveSpeed *= status.moveSpeedMultiplier;
 * ```
 */

// AdvancedWeatherSystem - Dynamic weather effects
export {
  AdvancedWeatherSystem,
  disposeAdvancedWeatherSystem,
  getAdvancedWeatherSystem,
  type LightningStrike,
  type MeteorImpact,
  WEATHER_PRESETS,
  type WeatherEventCallbacks,
  type WeatherEventConfig,
  type WeatherEventPreset,
  type WeatherEventState,
  type WeatherEventType,
} from './AdvancedWeatherSystem';
// ConditionHUD - React component
export {
  ConditionHUD,
  type ConditionHUDProps,
  type ConditionMeterData,
  useConditionHUDData,
} from './ConditionHUD';

// EnvironmentalConditions - Central manager
export {
  type ConditionCallbacks,
  createEnvironmentalConditions,
  disposeEnvironmentalConditions,
  ENVIRONMENT_PRESETS,
  EnvironmentalConditionsManager,
  type EnvironmentConfig,
  type EnvironmentType,
  getEnvironmentalConditions,
  type PlayerConditionStatus,
} from './EnvironmentalConditions';

// EnvironmentalStorytelling - Ambient world-building
export {
  type AlarmConfig,
  type AnyStorytellingConfig,
  type AudioPointConfig,
  type BodyConfig,
  type DebrisZoneConfig,
  disposeEnvironmentalStorytelling,
  type EmergencyLightConfig,
  EnvironmentalStorytellingManager,
  type GraffitiConfig,
  getEnvironmentalStorytelling,
  type SignConfig,
  type StorytellingCallbacks,
  type StorytellingElementConfig,
  type StorytellingElementType,
} from './EnvironmentalStorytelling';
// HazardSystem - Environmental hazards (zone-based and instant)
export {
  type AnyHazardType,
  disposeHazardSystem,
  getHazardSystem,
  HAZARD_PRESETS,
  type HazardCallbacks,
  type HazardFeedback,
  type HazardPreset,
  type HazardState,
  HazardSystem,
  type HazardType,
  type HazardZone,
  type HazardZoneConfig,
  INSTANT_HAZARD_PRESETS,
  type InstantHazard,
  type InstantHazardConfig,
  type InstantHazardPreset,
  type InstantHazardType,
} from './HazardSystem';
