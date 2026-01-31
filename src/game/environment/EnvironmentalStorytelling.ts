/**
 * EnvironmentalStorytelling - Ambient world-building elements
 *
 * Provides non-combat environmental details that enhance immersion:
 * - Dead bodies with nearby audio logs (discoverable lore)
 * - Graffiti and signs showing previous inhabitants
 * - Emergency lights that flicker when entering areas
 * - Alarms that trigger based on player proximity
 * - Environmental audio cues (distant screams, machinery, organic sounds)
 * - Atmospheric debris (papers, leaves, dust)
 *
 * These elements make the world feel lived-in and dangerous without
 * requiring active combat engagement.
 */

import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getLogger } from '../core/Logger';

const log = getLogger('EnvironmentalStorytelling');

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Types of environmental storytelling elements */
export type StorytellingElementType =
  | 'body'
  | 'graffiti'
  | 'sign'
  | 'emergency_light'
  | 'alarm'
  | 'audio_point'
  | 'debris_zone';

/** Base configuration for any element */
export interface StorytellingElementConfig {
  id: string;
  type: StorytellingElementType;
  position: Vector3;
  /** Activation radius for proximity triggers */
  activationRadius?: number;
  /** Whether element can only trigger once */
  oneShot?: boolean;
}

/** Dead body with optional audio log */
export interface BodyConfig extends StorytellingElementConfig {
  type: 'body';
  /** Pose type */
  pose: 'slumped' | 'reaching' | 'defensive' | 'crawling';
  /** Whether body is uniformed (marine) or civilian */
  isUniformed: boolean;
  /** Audio log ID if this body has one */
  audioLogId?: string;
  /** Whether body has a blinking data pad */
  hasDataPad?: boolean;
  /** Optional death cause for visual hints */
  deathCause?: 'gunfire' | 'alien' | 'environmental' | 'unknown';
}

/** Graffiti or writing on walls */
export interface GraffitiConfig extends StorytellingElementConfig {
  type: 'graffiti';
  /** Text content */
  text: string;
  /** Style of writing */
  style: 'scrawled' | 'scratched' | 'spray' | 'blood';
  /** Wall normal direction for placement */
  wallNormal: Vector3;
  /** Size multiplier */
  scale?: number;
}

/** Signs showing previous inhabitants */
export interface SignConfig extends StorytellingElementConfig {
  type: 'sign';
  /** Sign text content */
  text: string;
  /** Sign type */
  signType: 'warning' | 'direction' | 'info' | 'emergency';
  /** Whether sign is damaged */
  isDamaged?: boolean;
  /** Wall normal for placement */
  wallNormal: Vector3;
}

/** Emergency light that flickers */
export interface EmergencyLightConfig extends StorytellingElementConfig {
  type: 'emergency_light';
  /** Light color */
  color?: Color3;
  /** Flicker pattern */
  pattern: 'steady' | 'flicker' | 'pulse' | 'dying';
  /** Light range */
  range?: number;
  /** Whether light is currently on */
  isOn?: boolean;
}

/** Alarm that can trigger */
export interface AlarmConfig extends StorytellingElementConfig {
  type: 'alarm';
  /** Alarm type */
  alarmType: 'breach' | 'intruder' | 'fire' | 'biohazard';
  /** Whether alarm is currently active */
  isActive?: boolean;
  /** Duration of alarm in seconds (0 = indefinite) */
  duration?: number;
  /** Whether alarm triggers on proximity */
  triggerOnProximity?: boolean;
}

/** Ambient audio point */
export interface AudioPointConfig extends StorytellingElementConfig {
  type: 'audio_point';
  /** Sound effect identifier */
  soundId: string;
  /** Volume multiplier */
  volume?: number;
  /** Whether sound loops */
  loop?: boolean;
  /** Interval for non-looping sounds (random within range) */
  intervalRange?: [number, number];
  /** Maximum audible distance */
  maxDistance?: number;
}

/** Zone with floating debris */
export interface DebrisZoneConfig extends StorytellingElementConfig {
  type: 'debris_zone';
  /** Debris type */
  debrisType: 'papers' | 'leaves' | 'dust' | 'sparks' | 'organic';
  /** Zone radius */
  radius: number;
  /** Particle density */
  density?: number;
  /** Wind direction for debris movement */
  windDirection?: Vector3;
}

/** Union type for all config types */
export type AnyStorytellingConfig =
  | BodyConfig
  | GraffitiConfig
  | SignConfig
  | EmergencyLightConfig
  | AlarmConfig
  | AudioPointConfig
  | DebrisZoneConfig;

/** Active element tracking */
interface ActiveElement {
  config: AnyStorytellingConfig;
  mesh?: AbstractMesh | TransformNode;
  light?: PointLight;
  isTriggered: boolean;
  timer: number;
}

/** Callbacks for storytelling events */
export interface StorytellingCallbacks {
  onAudioLogDiscovered?: (logId: string, position: Vector3) => void;
  onAlarmTriggered?: (alarmType: string) => void;
  onAlarmStopped?: (alarmType: string) => void;
  onGraffitiDiscovered?: (text: string) => void;
  onAudioCue?: (soundId: string, position: Vector3, volume: number) => void;
}

// ============================================================================
// ENVIRONMENTAL STORYTELLING MANAGER
// ============================================================================

export class EnvironmentalStorytellingManager {
  private scene: Scene;
  private elements: Map<string, ActiveElement> = new Map();
  private callbacks: StorytellingCallbacks = {};
  private playerPosition: Vector3 = Vector3.Zero();
  private isDisposed = false;

  // Update optimization
  private updateCounter = 0;
  private readonly UPDATE_INTERVAL = 3; // Check every N frames

  constructor(scene: Scene) {
    this.scene = scene;
    log.info('Initialized');
  }

  // ============================================================================
  // ELEMENT CREATION
  // ============================================================================

  /**
   * Add a storytelling element
   */
  addElement(config: AnyStorytellingConfig): void {
    const element: ActiveElement = {
      config,
      isTriggered: false,
      timer: 0,
    };

    // Create visual representation based on type
    switch (config.type) {
      case 'body':
        this.createBodyMesh(element, config as BodyConfig);
        break;
      case 'graffiti':
        this.createGraffitiMesh(element, config as GraffitiConfig);
        break;
      case 'sign':
        this.createSignMesh(element, config as SignConfig);
        break;
      case 'emergency_light':
        this.createEmergencyLight(element, config as EmergencyLightConfig);
        break;
      case 'alarm':
        // Alarm is mostly audio, no mesh needed
        break;
      case 'audio_point':
        // Audio point is invisible
        break;
      case 'debris_zone':
        // Handled by particle system elsewhere
        break;
    }

    this.elements.set(config.id, element);
  }

  /**
   * Add multiple elements
   */
  addElements(configs: AnyStorytellingConfig[]): void {
    for (const config of configs) {
      this.addElement(config);
    }
  }

  /**
   * Remove an element
   */
  removeElement(id: string): void {
    const element = this.elements.get(id);
    if (element) {
      element.mesh?.dispose();
      element.light?.dispose();
      this.elements.delete(id);
    }
  }

  /**
   * Clear all elements
   */
  clearElements(): void {
    for (const element of this.elements.values()) {
      element.mesh?.dispose();
      element.light?.dispose();
    }
    this.elements.clear();
  }

  // ============================================================================
  // MESH CREATION
  // ============================================================================

  private createBodyMesh(element: ActiveElement, config: BodyConfig): void {
    // Create simple representation of a body
    // In a full implementation, this would load appropriate models
    const body = MeshBuilder.CreateBox(
      `body_${config.id}`,
      { width: 0.5, height: 0.3, depth: 1.5 },
      this.scene
    );
    body.position.copyFrom(config.position);
    body.position.y = 0.15; // Slightly above ground

    const material = new StandardMaterial(`bodyMat_${config.id}`, this.scene);
    material.diffuseColor = config.isUniformed
      ? new Color3(0.2, 0.25, 0.3) // Military grey
      : new Color3(0.3, 0.25, 0.2); // Civilian brown
    body.material = material;

    // Apply pose rotation
    switch (config.pose) {
      case 'slumped':
        body.rotation.z = Math.PI * 0.1;
        break;
      case 'reaching':
        body.rotation.z = Math.PI * 0.05;
        body.rotation.y = Math.random() * Math.PI * 2;
        break;
      case 'defensive':
        body.rotation.x = -Math.PI * 0.2;
        break;
      case 'crawling':
        body.rotation.y = Math.random() * Math.PI * 2;
        break;
    }

    // Add data pad indicator if present
    if (config.hasDataPad) {
      const pad = MeshBuilder.CreateBox(
        `datapad_${config.id}`,
        { width: 0.15, height: 0.02, depth: 0.1 },
        this.scene
      );
      pad.parent = body;
      pad.position.set(0.4, 0.1, 0);

      const padMat = new StandardMaterial(`datapadMat_${config.id}`, this.scene);
      padMat.emissiveColor = new Color3(0.1, 0.3, 0.5);
      pad.material = padMat;

      // Blinking light on pad
      const padLight = new PointLight(`padLight_${config.id}`, Vector3.Zero(), this.scene);
      padLight.parent = pad;
      padLight.diffuse = new Color3(0.2, 0.5, 0.8);
      padLight.intensity = 0.3;
      padLight.range = 2;
      element.light = padLight;
    }

    element.mesh = body;
  }

  private createGraffitiMesh(element: ActiveElement, config: GraffitiConfig): void {
    // Create a plane with text texture
    // In a full implementation, this would use a texture with the text
    const scale = config.scale ?? 1;
    const plane = MeshBuilder.CreatePlane(
      `graffiti_${config.id}`,
      { width: config.text.length * 0.15 * scale, height: 0.5 * scale },
      this.scene
    );
    plane.position.copyFrom(config.position);

    // Orient to face away from wall
    const normal = config.wallNormal.normalize();
    plane.rotation.y = Math.atan2(normal.x, normal.z);

    const material = new StandardMaterial(`graffitiMat_${config.id}`, this.scene);

    // Color based on style
    switch (config.style) {
      case 'scrawled':
        material.diffuseColor = new Color3(0.1, 0.1, 0.1);
        break;
      case 'scratched':
        material.diffuseColor = new Color3(0.5, 0.5, 0.5);
        break;
      case 'spray':
        material.diffuseColor = new Color3(0.8, 0.2, 0.1);
        break;
      case 'blood':
        material.diffuseColor = new Color3(0.4, 0.05, 0.05);
        break;
    }

    material.emissiveColor = material.diffuseColor.scale(0.2);
    plane.material = material;

    element.mesh = plane;
  }

  private createSignMesh(element: ActiveElement, config: SignConfig): void {
    const plane = MeshBuilder.CreatePlane(
      `sign_${config.id}`,
      { width: 1.5, height: 0.5 },
      this.scene
    );
    plane.position.copyFrom(config.position);

    const normal = config.wallNormal.normalize();
    plane.rotation.y = Math.atan2(normal.x, normal.z);

    const material = new StandardMaterial(`signMat_${config.id}`, this.scene);

    // Color based on sign type
    switch (config.signType) {
      case 'warning':
        material.diffuseColor = new Color3(0.8, 0.6, 0.1);
        break;
      case 'direction':
        material.diffuseColor = new Color3(0.2, 0.4, 0.6);
        break;
      case 'info':
        material.diffuseColor = new Color3(0.3, 0.5, 0.3);
        break;
      case 'emergency':
        material.diffuseColor = new Color3(0.7, 0.1, 0.1);
        material.emissiveColor = new Color3(0.3, 0.05, 0.05);
        break;
    }

    if (config.isDamaged) {
      material.alpha = 0.7;
      plane.rotation.z = (Math.random() - 0.5) * 0.2;
    }

    plane.material = material;
    element.mesh = plane;
  }

  private createEmergencyLight(element: ActiveElement, config: EmergencyLightConfig): void {
    const color = config.color ?? new Color3(1, 0.2, 0.1);
    const range = config.range ?? 10;

    // Light source
    const light = new PointLight(`emergencyLight_${config.id}`, config.position, this.scene);
    light.diffuse = color;
    light.intensity = config.isOn !== false ? 1.5 : 0;
    light.range = range;

    // Light fixture mesh
    const fixture = MeshBuilder.CreateSphere(
      `emergencyFixture_${config.id}`,
      { diameter: 0.2 },
      this.scene
    );
    fixture.position.copyFrom(config.position);

    const fixtureMat = new StandardMaterial(`emergencyFixtureMat_${config.id}`, this.scene);
    fixtureMat.emissiveColor = color;
    fixtureMat.disableLighting = true;
    fixture.material = fixtureMat;

    element.light = light;
    element.mesh = fixture;
  }

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Set storytelling event callbacks
   */
  setCallbacks(callbacks: StorytellingCallbacks): void {
    this.callbacks = callbacks;
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update storytelling elements - call every frame
   */
  update(deltaTime: number, playerPosition: Vector3): void {
    if (this.isDisposed) return;

    this.playerPosition = playerPosition;
    this.updateCounter++;

    // Only do full proximity checks periodically for performance
    const doProximityCheck = this.updateCounter % this.UPDATE_INTERVAL === 0;

    for (const element of this.elements.values()) {
      // Update timers for all elements
      element.timer += deltaTime;

      // Update visual effects
      this.updateElementVisuals(element, deltaTime);

      // Check proximity triggers
      if (doProximityCheck) {
        this.checkProximityTrigger(element);
      }
    }
  }

  private updateElementVisuals(element: ActiveElement, deltaTime: number): void {
    const config = element.config;

    // Update emergency lights
    if (config.type === 'emergency_light' && element.light) {
      const lightConfig = config as EmergencyLightConfig;
      const baseIntensity = lightConfig.isOn !== false ? 1.5 : 0;

      switch (lightConfig.pattern) {
        case 'steady':
          element.light.intensity = baseIntensity;
          break;
        case 'flicker':
          element.light.intensity = baseIntensity * (Math.random() > 0.1 ? 1 : 0.2);
          break;
        case 'pulse':
          element.light.intensity = baseIntensity * (0.5 + Math.sin(element.timer * 4) * 0.5);
          break;
        case 'dying':
          element.light.intensity =
            baseIntensity * (Math.random() > 0.3 ? (0.3 + Math.random() * 0.4) : 0);
          break;
      }

      // Update fixture emissive to match
      if (element.mesh && 'material' in element.mesh && element.mesh.material) {
        const mat = element.mesh.material as StandardMaterial;
        const intensity = element.light.intensity / 1.5;
        mat.emissiveColor = element.light.diffuse.scale(intensity);
      }
    }

    // Update data pad blink
    if (config.type === 'body') {
      const bodyConfig = config as BodyConfig;
      if (bodyConfig.hasDataPad && element.light) {
        const blink = Math.sin(element.timer * 2) > 0.7 ? 0.5 : 0.1;
        element.light.intensity = blink;
      }
    }

    // Update audio point intervals
    if (config.type === 'audio_point') {
      const audioConfig = config as AudioPointConfig;
      if (audioConfig.intervalRange && !audioConfig.loop) {
        // Check if it's time to play the sound
        // This is handled by checking timer against a random interval
        if (element.isTriggered) {
          const [minInterval, maxInterval] = audioConfig.intervalRange;
          const interval = minInterval + Math.random() * (maxInterval - minInterval);

          if (element.timer >= interval) {
            element.timer = 0;
            this.triggerAudioPoint(element, audioConfig);
          }
        }
      }
    }
  }

  private checkProximityTrigger(element: ActiveElement): void {
    const config = element.config;
    const radius = config.activationRadius ?? 5;
    const distance = Vector3.Distance(this.playerPosition, config.position);

    if (distance > radius) {
      // Player outside radius
      if (element.isTriggered && !config.oneShot) {
        element.isTriggered = false;
        this.handleElementDeactivate(element);
      }
      return;
    }

    // Player inside radius
    if (element.isTriggered) return; // Already triggered

    element.isTriggered = true;
    this.handleElementActivate(element);
  }

  private handleElementActivate(element: ActiveElement): void {
    const config = element.config;

    switch (config.type) {
      case 'body': {
        const bodyConfig = config as BodyConfig;
        if (bodyConfig.audioLogId) {
          this.callbacks.onAudioLogDiscovered?.(bodyConfig.audioLogId, config.position);
        }
        break;
      }

      case 'graffiti': {
        const graffitiConfig = config as GraffitiConfig;
        this.callbacks.onGraffitiDiscovered?.(graffitiConfig.text);
        break;
      }

      case 'alarm': {
        const alarmConfig = config as AlarmConfig;
        if (alarmConfig.triggerOnProximity) {
          this.triggerAlarm(element, alarmConfig);
        }
        break;
      }

      case 'audio_point': {
        const audioConfig = config as AudioPointConfig;
        this.triggerAudioPoint(element, audioConfig);
        break;
      }

      case 'emergency_light': {
        const lightConfig = config as EmergencyLightConfig;
        if (!lightConfig.isOn) {
          // Turn on when player approaches
          lightConfig.isOn = true;
        }
        break;
      }
    }
  }

  private handleElementDeactivate(element: ActiveElement): void {
    const config = element.config;

    switch (config.type) {
      case 'alarm': {
        const alarmConfig = config as AlarmConfig;
        if (alarmConfig.isActive) {
          this.stopAlarm(element, alarmConfig);
        }
        break;
      }
    }
  }

  private triggerAlarm(element: ActiveElement, config: AlarmConfig): void {
    config.isActive = true;
    this.callbacks.onAlarmTriggered?.(config.alarmType);
    log.debug(`Alarm triggered: ${config.id} (${config.alarmType})`);

    // Auto-stop after duration if specified
    if (config.duration && config.duration > 0) {
      setTimeout(() => {
        if (!this.isDisposed && config.isActive) {
          this.stopAlarm(element, config);
        }
      }, config.duration * 1000);
    }
  }

  private stopAlarm(element: ActiveElement, config: AlarmConfig): void {
    config.isActive = false;
    this.callbacks.onAlarmStopped?.(config.alarmType);
    log.debug(`Alarm stopped: ${config.id}`);
  }

  private triggerAudioPoint(element: ActiveElement, config: AudioPointConfig): void {
    const volume = config.volume ?? 1;
    const maxDistance = config.maxDistance ?? 30;
    const distance = Vector3.Distance(this.playerPosition, config.position);

    // Attenuate volume by distance
    const attenuatedVolume = volume * Math.max(0, 1 - distance / maxDistance);

    if (attenuatedVolume > 0.01) {
      this.callbacks.onAudioCue?.(config.soundId, config.position, attenuatedVolume);
    }
  }

  // ============================================================================
  // MANUAL TRIGGERS
  // ============================================================================

  /**
   * Manually trigger an alarm by ID
   */
  triggerAlarmById(id: string): void {
    const element = this.elements.get(id);
    if (element && element.config.type === 'alarm') {
      this.triggerAlarm(element, element.config as AlarmConfig);
    }
  }

  /**
   * Manually stop an alarm by ID
   */
  stopAlarmById(id: string): void {
    const element = this.elements.get(id);
    if (element && element.config.type === 'alarm') {
      this.stopAlarm(element, element.config as AlarmConfig);
    }
  }

  /**
   * Set emergency light state
   */
  setEmergencyLightState(id: string, isOn: boolean): void {
    const element = this.elements.get(id);
    if (element && element.config.type === 'emergency_light') {
      (element.config as EmergencyLightConfig).isOn = isOn;
    }
  }

  // ============================================================================
  // FACTORY METHODS
  // ============================================================================

  /**
   * Create a body with audio log
   */
  createBodyWithLog(
    id: string,
    position: Vector3,
    audioLogId: string,
    options?: Partial<BodyConfig>
  ): void {
    this.addElement({
      id,
      type: 'body',
      position,
      pose: 'slumped',
      isUniformed: true,
      audioLogId,
      hasDataPad: true,
      activationRadius: 4,
      oneShot: true,
      ...options,
    } as BodyConfig);
  }

  /**
   * Create graffiti on a wall
   */
  createGraffiti(
    id: string,
    position: Vector3,
    text: string,
    wallNormal: Vector3,
    style: GraffitiConfig['style'] = 'scrawled'
  ): void {
    this.addElement({
      id,
      type: 'graffiti',
      position,
      text,
      style,
      wallNormal,
      activationRadius: 3,
      oneShot: true,
    } as GraffitiConfig);
  }

  /**
   * Create a row of emergency lights
   */
  createEmergencyLightRow(
    baseId: string,
    start: Vector3,
    end: Vector3,
    count: number,
    pattern: EmergencyLightConfig['pattern'] = 'pulse'
  ): void {
    const direction = end.subtract(start);
    const spacing = direction.length() / (count - 1);
    const dirNorm = direction.normalize();

    for (let i = 0; i < count; i++) {
      const pos = start.add(dirNorm.scale(i * spacing));
      this.addElement({
        id: `${baseId}_${i}`,
        type: 'emergency_light',
        position: pos,
        pattern,
        range: 8,
        isOn: true,
      } as EmergencyLightConfig);
    }
  }

  /**
   * Create an ambient audio point
   */
  createAmbientSound(
    id: string,
    position: Vector3,
    soundId: string,
    options?: Partial<AudioPointConfig>
  ): void {
    this.addElement({
      id,
      type: 'audio_point',
      position,
      soundId,
      volume: 1,
      loop: true,
      maxDistance: 30,
      activationRadius: 25,
      ...options,
    } as AudioPointConfig);
  }

  /**
   * Create intermittent audio (distant screams, machinery, etc.)
   */
  createIntermittentSound(
    id: string,
    position: Vector3,
    soundId: string,
    intervalMin: number,
    intervalMax: number
  ): void {
    this.addElement({
      id,
      type: 'audio_point',
      position,
      soundId,
      volume: 0.7,
      loop: false,
      intervalRange: [intervalMin, intervalMax],
      maxDistance: 50,
      activationRadius: 40,
    } as AudioPointConfig);
  }

  // ============================================================================
  // GETTERS
  // ============================================================================

  /**
   * Get all active alarms
   */
  getActiveAlarms(): string[] {
    const active: string[] = [];
    for (const element of this.elements.values()) {
      if (element.config.type === 'alarm') {
        const alarmConfig = element.config as AlarmConfig;
        if (alarmConfig.isActive) {
          active.push(alarmConfig.alarmType);
        }
      }
    }
    return active;
  }

  /**
   * Get element by ID
   */
  getElement(id: string): ActiveElement | undefined {
    return this.elements.get(id);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.isDisposed = true;
    this.clearElements();
    log.info('Disposed');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storytellingInstance: EnvironmentalStorytellingManager | null = null;

/**
 * Get or create the environmental storytelling manager
 */
export function getEnvironmentalStorytelling(scene?: Scene): EnvironmentalStorytellingManager {
  if (!storytellingInstance && scene) {
    storytellingInstance = new EnvironmentalStorytellingManager(scene);
  }
  if (!storytellingInstance) {
    throw new Error('EnvironmentalStorytellingManager not initialized - provide a scene');
  }
  return storytellingInstance;
}

/**
 * Dispose the environmental storytelling manager
 */
export function disposeEnvironmentalStorytelling(): void {
  if (storytellingInstance) {
    storytellingInstance.dispose();
    storytellingInstance = null;
  }
}
