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

// HazardSystem - Environmental hazards (zone-based and instant)
export {
  HazardSystem,
  getHazardSystem,
  disposeHazardSystem,
  HAZARD_PRESETS,
  INSTANT_HAZARD_PRESETS,
  type HazardType,
  type InstantHazardType,
  type AnyHazardType,
  type HazardZoneConfig,
  type HazardZone,
  type InstantHazardConfig,
  type InstantHazard,
  type HazardState,
  type HazardPreset,
  type InstantHazardPreset,
  type HazardCallbacks,
  type HazardFeedback,
} from './HazardSystem';

// AdvancedWeatherSystem - Dynamic weather effects
export {
  AdvancedWeatherSystem,
  getAdvancedWeatherSystem,
  disposeAdvancedWeatherSystem,
  WEATHER_PRESETS,
  type WeatherEventType,
  type WeatherEventConfig,
  type WeatherEventPreset,
  type WeatherEventState,
  type WeatherEventCallbacks,
  type LightningStrike,
  type MeteorImpact,
} from './AdvancedWeatherSystem';

// EnvironmentalConditions - Central manager
export {
  EnvironmentalConditionsManager,
  createEnvironmentalConditions,
  getEnvironmentalConditions,
  disposeEnvironmentalConditions,
  ENVIRONMENT_PRESETS,
  type EnvironmentType,
  type EnvironmentConfig,
  type PlayerConditionStatus,
  type ConditionCallbacks,
} from './EnvironmentalConditions';

// EnvironmentalStorytelling - Ambient world-building
export {
  EnvironmentalStorytellingManager,
  getEnvironmentalStorytelling,
  disposeEnvironmentalStorytelling,
  type StorytellingElementType,
  type StorytellingElementConfig,
  type BodyConfig,
  type GraffitiConfig,
  type SignConfig,
  type EmergencyLightConfig,
  type AlarmConfig,
  type AudioPointConfig,
  type DebrisZoneConfig,
  type AnyStorytellingConfig,
  type StorytellingCallbacks,
} from './EnvironmentalStorytelling';

// ConditionHUD - React component
export {
  ConditionHUD,
  useConditionHUDData,
  type ConditionMeterData,
  type ConditionHUDProps,
} from './ConditionHUD';
