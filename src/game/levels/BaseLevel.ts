/**
 * BaseLevel - Abstract base class for all levels
 *
 * Handles common functionality:
 * - Scene creation and disposal
 * - Camera management
 * - Pointer lock
 * - ECS world integration
 * - Basic lighting setup
 * - Post-processing effects (film grain, vignette, color grading, combat feedback)
 */

import type { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, type Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { getAchievementManager } from '../achievements';
import { getInputTracker, type InputTracker } from '../context/useInputActions';
import { getAudioManager } from '../core/AudioManager';
import { createEntity, type Entity, world as ecsWorld, removeEntity } from '../core/ecs';
import {
  type PostProcessConfig,
  PostProcessManager,
  type PostProcessQuality,
} from '../core/PostProcessManager';
import {
  type AtmosphericEffects,
  disposeAtmosphericEffects,
  getAtmosphericEffects,
} from '../effects/AtmosphericEffects';
import {
  disposeWeatherSystem,
  getWeatherSystem,
  type WeatherEnvironment,
  type WeatherIntensity,
  type WeatherSystem,
  type WeatherType,
} from '../effects/WeatherSystem';
import type { ILevel, LevelCallbacks, LevelConfig, LevelId, LevelState, LevelType } from './types';

// Shader imports for StandardMaterial
import '@babylonjs/core/Shaders/default.vertex';
import '@babylonjs/core/Shaders/default.fragment';
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Meshes/meshBuilder';

// ============================================================================
// CAMERA SHAKE CONFIGURATION
// ============================================================================

/**
 * Configuration for camera shake effects.
 * Intensity values are approximate:
 * - 1-2: Light (minor damage, footsteps)
 * - 3-4: Medium (taking damage, nearby impacts)
 * - 5-6: Heavy (explosions, grenades)
 * - 7-10: Extreme (boss attacks, massive explosions)
 */
export interface CameraShakeConfig {
  /** Current shake intensity (decays over time) */
  intensity: number;
  /** Decay rate per frame (0.9 = fast decay, 0.95 = slow decay) */
  decayRate: number;
  /** Minimum intensity before shake stops */
  minIntensity: number;
  /** Base/ambient shake (doesn't decay, useful for rumbles) */
  baseShake: number;
  /** Shake translation multiplier (how much camera moves in X/Y) */
  translationScale: number;
  /** Shake rotation multiplier (how much camera rotates) */
  rotationScale: number;
}

const DEFAULT_SHAKE_CONFIG: CameraShakeConfig = {
  intensity: 0,
  decayRate: 0.9,
  minIntensity: 0.1,
  baseShake: 0,
  translationScale: 0.02,
  rotationScale: 0.015,
};

export abstract class BaseLevel implements ILevel {
  // Identity
  readonly id: LevelId;
  readonly type: LevelType;
  readonly config: LevelConfig;

  // Core references
  protected engine: Engine;
  protected canvas: HTMLCanvasElement;
  protected callbacks: LevelCallbacks;

  // Scene management
  protected scene: Scene;
  protected camera: UniversalCamera;
  protected sunLight: DirectionalLight | null = null;
  protected ambientLight: HemisphericLight | null = null;

  // State
  protected state: LevelState;
  protected entities: Map<string, Entity> = new Map();
  protected isInitialized = false;

  // Input state
  protected keys: Set<string> = new Set();
  protected inputTracker: InputTracker;
  protected rotationX = 0;
  protected rotationY = 0;

  // Smooth camera rotation - target values set by input, actual values interpolate
  protected targetRotationX = 0;
  protected targetRotationY = 0;
  protected readonly rotationLerpSpeed = 15; // Higher = snappier, lower = smoother

  // Touch input support
  protected touchInput: {
    movement: { x: number; y: number };
    look: { x: number; y: number };
    isFiring?: boolean;
    isSprinting?: boolean;
    isJumping?: boolean;
    isCrouching?: boolean;
  } | null = null;

  // Camera shake system
  protected shakeConfig: CameraShakeConfig = { ...DEFAULT_SHAKE_CONFIG };
  protected shakeEnabled = true;
  protected shakeIntensityMultiplier = 1.0;

  // Post-processing manager for visual effects
  protected postProcess: PostProcessManager | null = null;

  // Weather system for atmospheric effects
  protected weatherSystem: WeatherSystem | null = null;

  // Atmospheric effects for advanced visuals (god rays, emergency lights, etc.)
  protected atmosphericEffects: AtmosphericEffects | null = null;

  // Achievement tracking
  protected playerDiedInLevel = false;

  // Bound event handlers
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundClick: () => void;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    this.engine = engine;
    this.canvas = canvas;
    this.config = config;
    this.callbacks = callbacks;

    this.id = config.id;
    this.type = config.type;

    // Initialize state
    this.state = {
      id: config.id,
      visited: false,
      completed: false,
    };

    // Create scene
    this.scene = new Scene(engine);
    this.scene.clearColor = this.getBackgroundColor();

    // Create camera
    this.camera = this.createCamera();

    // Initialize input tracker for keybindings
    this.inputTracker = getInputTracker();

    // Bind event handlers
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundClick = this.handleClick.bind(this);
  }

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Create the level's environment (meshes, lights, etc.)
   */
  protected abstract createEnvironment(): Promise<void>;

  /**
   * Update level-specific logic
   */
  protected abstract updateLevel(deltaTime: number): void;

  /**
   * Get the background/clear color for this level type
   */
  protected abstract getBackgroundColor(): Color4;

  /**
   * Clean up level-specific resources
   */
  protected abstract disposeLevel(): void;

  // ============================================================================
  // ILevel IMPLEMENTATION
  // ============================================================================

  async initialize(): Promise<void> {
    console.log(`[BaseLevel] initialize() called for ${this.id}`);
    if (this.isInitialized) {
      console.warn(`Level ${this.id} already initialized`);
      return;
    }

    // Set camera as active
    this.scene.activeCamera = this.camera;

    // Set up basic lighting (can be overridden in subclass createEnvironment)
    this.setupBasicLighting();

    // Initialize post-processing effects
    this.initializePostProcessing();

    // Initialize weather system if configured
    this.initializeWeatherSystem();

    // Initialize atmospheric effects (god rays, emergency lights, etc.)
    this.initializeAtmosphericEffects();

    // Create level-specific environment
    console.log(`[BaseLevel] Calling createEnvironment() for ${this.id}`);
    await this.createEnvironment();
    console.log(`[BaseLevel] createEnvironment() completed for ${this.id}`);

    // Attach event listeners
    this.attachEventListeners();

    // Start level-specific audio (music and basic procedural ambient)
    await getAudioManager().startLevelAudio(this.id);

    // Start advanced environmental audio (layered soundscapes with spatial audio)
    getAudioManager().startEnvironmentalAudio(this.id);

    // Track level start for achievements
    getAchievementManager().onLevelStart(this.id);
    this.playerDiedInLevel = false;

    // Mark state
    this.state.visited = true;
    this.isInitialized = true;

    console.log(`Level ${this.id} initialized`);
  }

  update(deltaTime: number): void {
    if (!this.isInitialized) return;

    // Process movement input
    this.processMovement(deltaTime);

    // Update level-specific logic
    this.updateLevel(deltaTime);

    // Update post-processing effects
    this.postProcess?.update(deltaTime);

    // Update weather system
    this.weatherSystem?.update(deltaTime, this.camera.position);

    // Update atmospheric effects
    this.atmosphericEffects?.update(deltaTime, this.camera.position);

    // Update environmental audio with player position for spatial audio
    getAudioManager().updatePlayerPositionForAudio({
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
    });

    // Apply camera shake effects (after level update so levels can trigger shake)
    this.updateCameraShake();
  }

  dispose(): void {
    // Remove event listeners
    this.detachEventListeners();

    // Unlock pointer
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    // Stop level audio
    getAudioManager().stopLevelAudio();

    // Stop environmental audio
    getAudioManager().stopEnvironmentalAudio();

    // Dispose post-processing
    this.postProcess?.dispose();
    this.postProcess = null;

    // Dispose weather system
    disposeWeatherSystem();
    this.weatherSystem = null;

    // Dispose atmospheric effects
    disposeAtmosphericEffects();
    this.atmosphericEffects = null;

    // Dispose level-specific resources
    this.disposeLevel();

    // Dispose all tracked entities
    for (const entity of this.entities.values()) {
      removeEntity(entity);
    }
    this.entities.clear();

    // Dispose scene (this disposes all meshes, materials, etc.)
    this.scene.dispose();

    this.isInitialized = false;
    console.log(`Level ${this.id} disposed`);
  }

  getScene(): Scene {
    return this.scene;
  }

  getState(): LevelState {
    // Update position from camera
    if (this.camera) {
      this.state.playerPosition = {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      };
      this.state.playerRotation = this.rotationY;
    }
    return { ...this.state };
  }

  setState(state: Partial<LevelState>): void {
    this.state = { ...this.state, ...state };

    // Apply position if provided
    if (state.playerPosition && this.camera) {
      this.camera.position.set(
        state.playerPosition.x,
        state.playerPosition.y,
        state.playerPosition.z
      );
    }
    if (state.playerRotation !== undefined) {
      // Set both target and actual rotation to avoid interpolation drift
      this.rotationY = state.playerRotation;
      this.targetRotationY = state.playerRotation;
      this.camera.rotation.y = this.rotationY;
    }
  }

  lockPointer(): void {
    this.canvas.requestPointerLock();
  }

  unlockPointer(): void {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  canTransitionTo(levelId: LevelId): boolean {
    // By default, allow transition to next or previous level
    return levelId === this.config.nextLevelId || levelId === this.config.previousLevelId;
  }

  async prepareTransition(_targetLevelId: LevelId): Promise<void> {
    // Subclasses can override to add transition effects
    // e.g., fade to black, save additional state
    this.unlockPointer();
  }

  // ============================================================================
  // PROTECTED METHODS - Available to subclasses
  // ============================================================================

  protected createCamera(): UniversalCamera {
    const spawnPos = this.config.playerSpawnPosition ?? { x: 0, y: 1.7, z: 0 };
    const spawnRot = this.config.playerSpawnRotation ?? 0;

    const camera = new UniversalCamera(
      `${this.id}_camera`,
      new Vector3(spawnPos.x, spawnPos.y, spawnPos.z),
      this.scene
    );

    // Initialize both target and actual rotation to spawn rotation
    this.rotationY = spawnRot;
    this.rotationX = 0;
    this.targetRotationY = spawnRot;
    this.targetRotationX = 0;
    camera.rotation.y = this.rotationY;
    camera.rotation.x = this.rotationX;
    camera.minZ = 0.1;
    camera.maxZ = 5000;
    camera.fov = 1.2; // ~69 degrees - good for FPS

    // Clear default inputs - we handle manually
    camera.inputs.clear();

    return camera;
  }

  /**
   * Set touch input from external touch control component.
   * Touch input is processed in processMovement along with keyboard input.
   */
  setTouchInput(input: typeof this.touchInput): void {
    this.touchInput = input;
  }

  protected setupBasicLighting(): void {
    // Sun light
    const sunDir = new Vector3(0.4, -0.6, -0.5).normalize();
    this.sunLight = new DirectionalLight('sun', sunDir, this.scene);
    this.sunLight.intensity = 2.0;
    this.sunLight.diffuse = new Color3(1.0, 0.9, 0.8);

    // Ambient fill
    this.ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    this.ambientLight.intensity = 0.4;
    this.ambientLight.diffuse = new Color3(0.5, 0.5, 0.6);
    this.ambientLight.groundColor = new Color3(0.2, 0.15, 0.1);
  }

  /**
   * Create and track an ECS entity
   */
  protected createEntity(components: Partial<Entity>): Entity {
    const entity = createEntity(components);
    this.entities.set(entity.id, entity);
    return entity;
  }

  /**
   * Remove a tracked entity
   */
  protected removeTrackedEntity(entity: Entity): void {
    this.entities.delete(entity.id);
    removeEntity(entity);
  }

  /**
   * Notify that level is complete and trigger transition
   */
  protected completeLevel(): void {
    this.state.completed = true;
    // Play victory music
    getAudioManager().playVictory();
    // Track level completion for achievements
    getAchievementManager().onLevelComplete(this.id, this.playerDiedInLevel);
    this.callbacks.onLevelComplete(this.config.nextLevelId);
  }

  /**
   * Notify combat state change (switch music between ambient and combat)
   */
  protected setCombatState(inCombat: boolean): void {
    if (inCombat) {
      getAudioManager().enterCombat();
    } else {
      getAudioManager().exitCombat();
    }
    // Also update environmental audio combat state
    getAudioManager().setEnvironmentalCombatState(inCombat);
  }

  // ============================================================================
  // ENVIRONMENTAL AUDIO HELPERS
  // ============================================================================

  /**
   * Add a spatial sound source at a world position.
   * The sound will be 3D positioned and attenuate with distance from player.
   *
   * @param id - Unique identifier for the sound source
   * @param type - Type of sound (machinery, electrical_panel, vent, dripping, etc.)
   * @param position - World position of the sound source
   * @param options - Additional options (maxDistance, volume, interval for periodic sounds)
   */
  protected addSpatialSound(
    id: string,
    type: Parameters<ReturnType<typeof getAudioManager>['addSpatialSoundSource']>[0]['type'],
    position: { x: number; y: number; z: number },
    options?: {
      maxDistance?: number;
      volume?: number;
      interval?: number;
    }
  ): void {
    getAudioManager().addSpatialSoundSource({
      id,
      type,
      position,
      maxDistance: options?.maxDistance ?? 15,
      volume: options?.volume ?? 0.5,
      interval: options?.interval,
      active: true,
    });
  }

  /**
   * Remove a spatial sound source
   */
  protected removeSpatialSound(id: string): void {
    getAudioManager().removeSpatialSoundSource(id);
  }

  /**
   * Add an audio zone for zone-based audio transitions.
   * When the player enters a zone, the environmental audio will transition.
   *
   * @param id - Unique identifier for the zone
   * @param type - Environment type (station, surface, hive, base, extraction)
   * @param position - Center position of the zone
   * @param radius - Radius of the zone
   * @param options - Additional options (isIndoor, intensity, hasRadiation, highThreat)
   */
  protected addAudioZone(
    id: string,
    type: Parameters<ReturnType<typeof getAudioManager>['addAudioZone']>[0]['type'],
    position: { x: number; y: number; z: number },
    radius: number,
    options?: {
      isIndoor?: boolean;
      intensity?: number;
      hasRadiation?: boolean;
      highThreat?: boolean;
    }
  ): void {
    getAudioManager().addAudioZone({
      id,
      type,
      position,
      radius,
      isIndoor: options?.isIndoor ?? false,
      intensity: options?.intensity,
      hasRadiation: options?.hasRadiation,
      highThreat: options?.highThreat,
    });
  }

  /**
   * Remove an audio zone
   */
  protected removeAudioZone(id: string): void {
    getAudioManager().removeAudioZone(id);
  }

  /**
   * Play emergency klaxon sound (useful for station alerts)
   */
  protected playEmergencyKlaxon(duration = 3): void {
    getAudioManager().playEmergencyKlaxon(duration);
  }

  /**
   * Set up audio occlusion callback for realistic sound blocking behind walls.
   * The callback should perform a raycast or similar check to determine if there
   * are walls between the sound source and the player.
   *
   * @param callback - Function that returns 0 (clear) to 1 (fully blocked)
   */
  protected setAudioOcclusionCallback(
    callback:
      | ((
          sourcePos: { x: number; y: number; z: number },
          listenerPos: { x: number; y: number; z: number }
        ) => number)
      | null
  ): void {
    getAudioManager().setAudioOcclusionCallback(callback);
  }

  /**
   * Enable or disable audio occlusion for this level.
   * When enabled, spatial sounds behind walls will be muffled.
   */
  protected setAudioOcclusionEnabled(enabled: boolean): void {
    getAudioManager().setAudioOcclusionEnabled(enabled);
  }

  /**
   * Handle player death (play defeat music)
   */
  protected onPlayerDeath(): void {
    this.playerDiedInLevel = true;
    getAudioManager().playDefeat();
  }

  /**
   * Track player damage for achievements (call when player takes damage)
   */
  protected trackPlayerDamage(damage: number): void {
    getAchievementManager().onDamageTaken(this.id, damage);
  }

  /**
   * Play a sound effect
   */
  protected playSound(
    effect: Parameters<ReturnType<typeof getAudioManager>['play']>[0],
    options?: Parameters<ReturnType<typeof getAudioManager>['play']>[1]
  ): void {
    getAudioManager().play(effect, options);
  }

  // ============================================================================
  // CAMERA SHAKE SYSTEM
  // ============================================================================

  /**
   * Trigger camera shake effect.
   *
   * @param intensity - Shake intensity (1-10 recommended range)
   *   - 1-2: Light (minor damage, footsteps)
   *   - 3-4: Medium (taking damage, nearby impacts)
   *   - 5-6: Heavy (explosions, grenades)
   *   - 7-10: Extreme (boss attacks, massive explosions)
   * @param additive - If true, adds to current intensity; if false, takes max
   */
  protected triggerShake(intensity: number, additive: boolean = false): void {
    if (additive) {
      this.shakeConfig.intensity += intensity;
    } else {
      this.shakeConfig.intensity = Math.max(this.shakeConfig.intensity, intensity);
    }
  }

  /**
   * Trigger camera shake based on damage amount.
   * Useful for auto-triggering shake when player takes damage.
   *
   * @param damageAmount - Amount of damage taken (scaled to shake intensity)
   */
  protected triggerDamageShake(damageAmount: number): void {
    // Scale damage to reasonable shake intensity
    // 5 damage = light shake (1), 25 damage = medium (3), 50+ = heavy (5+)
    const intensity = Math.min(8, Math.max(1, damageAmount / 8));
    this.triggerShake(intensity);
  }

  /**
   * Set the base/ambient shake level.
   * This doesn't decay and is useful for continuous rumbles (escape sequences, etc.)
   *
   * @param baseIntensity - Persistent shake intensity (0 to disable)
   */
  protected setBaseShake(baseIntensity: number): void {
    this.shakeConfig.baseShake = Math.max(0, baseIntensity);
  }

  /**
   * Configure shake behavior.
   *
   * @param config - Partial configuration to merge with defaults
   */
  protected configureShake(config: Partial<CameraShakeConfig>): void {
    this.shakeConfig = { ...this.shakeConfig, ...config };
  }

  /**
   * Update and apply camera shake effect.
   * Called automatically by the base update() method.
   * Respects user's screen shake settings (enabled/intensity).
   */
  private updateCameraShake(): void {
    // Skip if screen shake is disabled
    if (!this.shakeEnabled) {
      this.camera.rotation.x = this.rotationX;
      this.camera.rotation.z = 0;
      return;
    }

    // Combine current intensity with base shake, apply user intensity multiplier
    const totalIntensity =
      Math.max(this.shakeConfig.intensity, this.shakeConfig.baseShake) *
      this.shakeIntensityMultiplier;

    if (totalIntensity > this.shakeConfig.minIntensity) {
      // Calculate random offsets
      const offsetX = (Math.random() - 0.5) * totalIntensity * this.shakeConfig.translationScale;
      const offsetY = (Math.random() - 0.5) * totalIntensity * this.shakeConfig.translationScale;
      const rotOffsetX = (Math.random() - 0.5) * totalIntensity * this.shakeConfig.rotationScale;
      const rotOffsetZ = (Math.random() - 0.5) * totalIntensity * this.shakeConfig.rotationScale;

      // Apply shake to camera rotation (preserves player's intended rotation)
      this.camera.rotation.x = this.rotationX + rotOffsetX;
      this.camera.rotation.z = rotOffsetZ;

      // Decay the intensity (but not the base shake)
      this.shakeConfig.intensity *= this.shakeConfig.decayRate;

      // Stop shake when below threshold
      if (this.shakeConfig.intensity < this.shakeConfig.minIntensity) {
        this.shakeConfig.intensity = 0;
      }
    } else {
      // No shake - reset camera rotation to player's intended values
      this.camera.rotation.x = this.rotationX;
      this.camera.rotation.z = 0;
    }
  }

  /**
   * Sync visual settings with user preferences from SettingsContext.
   * Call this when settings change or at level initialization.
   *
   * @param settings - Partial game settings object with relevant visual settings
   */
  syncVisualSettings(settings: {
    screenShake?: boolean;
    screenShakeIntensity?: number;
    postProcessingEnabled?: boolean;
    bloomEnabled?: boolean;
    bloomIntensity?: number;
    chromaticAberrationEnabled?: boolean;
    vignetteEnabled?: boolean;
    filmGrainEnabled?: boolean;
    filmGrainIntensity?: number;
    motionBlur?: boolean;
    colorGradingEnabled?: boolean;
    reducedFlashing?: boolean;
  }): void {
    // Screen shake settings
    if (settings.screenShake !== undefined) {
      this.shakeEnabled = settings.screenShake;
    }
    if (settings.screenShakeIntensity !== undefined) {
      this.shakeIntensityMultiplier = settings.screenShakeIntensity;
    }

    // Forward post-processing settings to PostProcessManager
    if (this.postProcess) {
      this.postProcess.syncWithGameSettings(settings);
    }
  }

  // ============================================================================
  // POST-PROCESSING EFFECTS
  // ============================================================================

  /**
   * Initialize post-processing pipeline with level-specific color grading.
   * Called automatically during level initialization.
   */
  protected initializePostProcessing(): void {
    this.postProcess = new PostProcessManager(this.scene, this.camera);
    this.postProcess.setLevelType(this.type);
    console.log(`[BaseLevel] Post-processing initialized for ${this.id} (${this.type})`);
  }

  /**
   * Initialize weather system based on level configuration.
   * Called automatically during level initialization if weather config exists.
   */
  protected initializeWeatherSystem(): void {
    const weatherConfig = this.config.weather;
    if (!weatherConfig) {
      console.log(`[BaseLevel] No weather config for ${this.id}, skipping weather initialization`);
      return;
    }

    try {
      this.weatherSystem = getWeatherSystem(this.scene);
      this.weatherSystem.initializeEnvironment(
        weatherConfig.environment as WeatherEnvironment,
        weatherConfig.initialWeather as WeatherType
      );
      this.weatherSystem.setIntensity(weatherConfig.initialIntensity as WeatherIntensity);

      if (weatherConfig.qualityLevel) {
        this.weatherSystem.setQualityLevel(weatherConfig.qualityLevel);
      }

      console.log(
        `[BaseLevel] Weather initialized for ${this.id}: ${weatherConfig.environment} / ${weatherConfig.initialWeather} (${weatherConfig.initialIntensity})`
      );
    } catch (error) {
      console.warn(`[BaseLevel] Failed to initialize weather system:`, error);
    }
  }

  /**
   * Initialize atmospheric effects (god rays, emergency lights, spore clouds, etc.).
   * Called automatically during level initialization.
   */
  protected initializeAtmosphericEffects(): void {
    try {
      this.atmosphericEffects = getAtmosphericEffects(this.scene, this.camera);
      console.log(`[BaseLevel] Atmospheric effects initialized for ${this.id}`);
    } catch (error) {
      console.warn(`[BaseLevel] Failed to initialize atmospheric effects:`, error);
    }
  }

  /**
   * Get the current atmospheric effects instance for advanced configuration.
   */
  protected getAtmosphericEffects(): AtmosphericEffects | null {
    return this.atmosphericEffects;
  }

  /**
   * Change weather type at runtime (for dynamic weather changes during gameplay).
   *
   * @param type - Weather type to transition to
   * @param intensity - Weather intensity level
   * @param immediate - If true, skip transition animation
   */
  protected setWeather(
    type: WeatherType,
    intensity: WeatherIntensity = 'medium',
    immediate = false
  ): void {
    this.weatherSystem?.setWeather(type, intensity, immediate);
  }

  /**
   * Get the current weather system instance for advanced effects.
   */
  protected getWeatherSystem(): WeatherSystem | null {
    return this.weatherSystem;
  }

  /**
   * Trigger damage flash effect on player hit.
   * Call this when the player takes damage for visual feedback.
   *
   * @param intensity - Flash intensity (0-1, default 1.0)
   */
  protected triggerDamageFlash(intensity: number = 1.0): void {
    this.postProcess?.triggerDamageFlash(intensity);
    // Also trigger camera shake for combined effect
    this.triggerShake(intensity * 3);
  }

  /**
   * Trigger hit confirmation flash when player lands a hit.
   */
  protected triggerHitConfirmation(): void {
    this.postProcess?.triggerHitConfirmation();
  }

  /**
   * Update kill streak visual feedback.
   * Call this when the player gets a kill.
   *
   * @param killCount - Current kill streak count
   */
  protected updateKillStreak(killCount: number): void {
    this.postProcess?.updateKillStreak(killCount);
  }

  /**
   * Update player health for low health warning effect.
   * Call this whenever player health changes.
   *
   * @param health - Current player health (0-100)
   */
  protected updatePlayerHealthVisual(health: number): void {
    this.postProcess?.setPlayerHealth(health);
  }

  /**
   * Set sprint state for motion blur effect.
   *
   * @param isSprinting - Whether the player is currently sprinting
   */
  protected setSprintingVisual(isSprinting: boolean): void {
    this.postProcess?.setSprinting(isSprinting);
  }

  /**
   * Enable depth of field for dramatic/cinematic moments.
   *
   * @param focusDistance - Distance to focus point in world units
   * @param focalLength - Focal length in mm (default 50)
   * @param fStop - Aperture f-stop (default 2.8, lower = more blur)
   */
  protected enableDramaticDepthOfField(
    focusDistance: number,
    focalLength: number = 50,
    fStop: number = 2.8
  ): void {
    this.postProcess?.enableDepthOfField(focusDistance, focalLength, fStop);
  }

  /**
   * Disable depth of field effect.
   */
  protected disableDramaticDepthOfField(): void {
    this.postProcess?.disableDepthOfField();
  }

  /**
   * Transition to a different level's color grading smoothly.
   * Useful for transitioning between areas within a level.
   *
   * @param levelType - Target level type for color grading
   * @param duration - Transition duration in ms (default 1000)
   */
  protected transitionColorGrading(levelType: LevelType, duration: number = 1000): void {
    this.postProcess?.transitionToLevelType(levelType, duration);
  }

  /**
   * Set post-processing quality level.
   *
   * @param quality - Quality preset ('low' | 'medium' | 'high' | 'ultra')
   */
  protected setPostProcessQuality(quality: PostProcessQuality): void {
    this.postProcess?.setQuality(quality);
  }

  /**
   * Get the post-processing manager for advanced configuration.
   */
  protected getPostProcessManager(): PostProcessManager | null {
    return this.postProcess;
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  private attachEventListeners(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    document.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('click', this.boundClick);
  }

  private detachEventListeners(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('click', this.boundClick);
  }

  protected handleKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
  }

  protected handleKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  protected handleMouseMove(e: MouseEvent): void {
    if (!this.isPointerLocked()) return;

    const sensitivity = 0.002;
    // Update TARGET rotation - actual rotation interpolates toward this
    this.targetRotationY += e.movementX * sensitivity;
    this.targetRotationX -= e.movementY * sensitivity;

    // Clamp vertical look
    this.targetRotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.targetRotationX));
  }

  protected handleClick(): void {
    if (!this.isPointerLocked()) {
      this.lockPointer();
    }
  }

  protected processMovement(deltaTime: number): void {
    // Process touch look input (even when pointer is not locked on mobile)
    if (this.touchInput) {
      const look = this.touchInput.look;
      if (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001) {
        // Touch controls provide raw delta - add to target rotation
        this.targetRotationY += look.x;
        this.targetRotationX -= look.y;
        this.targetRotationX = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, this.targetRotationX)
        );
      }
    }

    // Smooth camera rotation interpolation (lerp toward target)
    // This creates fluid, non-snappy camera movement
    const lerpFactor = Math.min(1, this.rotationLerpSpeed * deltaTime);
    this.rotationX += (this.targetRotationX - this.rotationX) * lerpFactor;
    this.rotationY += (this.targetRotationY - this.rotationY) * lerpFactor;

    // Apply smoothed rotation to camera (shake system will add offsets on top)
    this.camera.rotation.y = this.rotationY;
    // Note: camera.rotation.x is handled by updateCameraShake() which preserves this.rotationX

    // Check if we can process movement (pointer locked on desktop, or touch controls on mobile)
    const canMove = this.isPointerLocked() || this.touchInput !== null;
    if (!canMove) return;

    const baseSpeed = this.getMoveSpeed();
    // Check for sprint action (Shift by default, or touch sprint button)
    const isSprinting =
      this.inputTracker.isActionActive('sprint') || (this.touchInput?.isSprinting ?? false);
    const speed = (isSprinting ? baseSpeed * this.getSprintMultiplier() : baseSpeed) * deltaTime;

    // Calculate movement direction based on camera rotation (movement is RELATIVE to where camera faces)
    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const right = new Vector3(Math.cos(this.rotationY), 0, -Math.sin(this.rotationY));

    let dx = 0;
    let dz = 0;

    // Process touch input movement (joystick)
    if (this.touchInput) {
      const movement = this.touchInput.movement;
      if (Math.abs(movement.x) > 0.1 || Math.abs(movement.y) > 0.1) {
        // Joystick: Y is forward/backward, X is strafe
        dx += forward.x * movement.y + right.x * movement.x;
        dz += forward.z * movement.y + right.z * movement.x;
      }
    }

    // Use InputTracker to check for keyboard movement actions (respects user keybindings)
    // Supports both WASD and Arrow keys by default
    if (this.inputTracker.isActionActive('moveForward')) {
      dx += forward.x;
      dz += forward.z;
    }
    if (this.inputTracker.isActionActive('moveBackward')) {
      dx -= forward.x;
      dz -= forward.z;
    }
    if (this.inputTracker.isActionActive('moveLeft')) {
      dx -= right.x;
      dz -= right.z;
    }
    if (this.inputTracker.isActionActive('moveRight')) {
      dx += right.x;
      dz += right.z;
    }

    // Normalize diagonal movement
    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;

      this.camera.position.x += dx;
      this.camera.position.z += dz;
    }

    // Handle jump action (Space by default, or touch jump button) - subclasses can override onJump()
    if (this.inputTracker.isActionActive('jump') || (this.touchInput?.isJumping ?? false)) {
      this.onJump();
    }

    // Handle crouch action (Ctrl/C by default, or touch crouch button) - subclasses can override onCrouch()
    if (this.inputTracker.isActionActive('crouch') || (this.touchInput?.isCrouching ?? false)) {
      this.onCrouch(true);
    } else {
      this.onCrouch(false);
    }
  }

  protected getMoveSpeed(): number {
    // Subclasses can override for different speeds
    return 5;
  }

  protected getSprintMultiplier(): number {
    // Subclasses can override for different sprint speeds
    return 1.5;
  }

  /**
   * Called when jump action is pressed.
   * Subclasses should override to implement jump mechanics.
   */
  protected onJump(): void {
    // Default implementation does nothing
    // Subclasses can override to implement jumping
  }

  /**
   * Called when crouch action state changes.
   * @param isCrouching - Whether the crouch key is currently held
   */
  protected onCrouch(_isCrouching: boolean): void {
    // Default implementation does nothing
    // Subclasses can override to implement crouching
  }

  /**
   * Refresh keybindings from localStorage.
   * Call this when returning from settings menu where bindings may have changed.
   */
  refreshKeybindings(): void {
    this.inputTracker.refreshKeybindings();
  }
}
