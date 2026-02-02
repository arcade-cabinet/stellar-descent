/**
 * AnchorStationLevel - Tutorial and briefing station level
 *
 * This is the first level of the game, introducing the player to:
 * - Movement controls (Phase 1)
 * - Look controls (Phase 2)
 * - Interaction mechanics (Phase 2)
 * - Suit equipment (Phase 2)
 * - Weapon calibration / shooting range (Phase 3)
 * - Drop pod deployment (Phase 4)
 *
 * Room Layout:
 * BRIEFING ROOM (20m x 15m) -> CORRIDOR A (30m x 4m) -> EQUIPMENT BAY (15m x 12m)
 *                                    |
 *                             SHOOTING RANGE (25m x 10m)
 *                                    |
 *                             HANGAR BAY (40m x 30m) -> [EXIT TO LANDFALL]
 *
 * Progressive HUD Unlocks:
 * - Phase 0: Briefing - notifications only
 * - Phase 1: After briefing - health bar appears, WASD enabled
 * - Phase 2: Equipment Bay - crosshair appears, mouse look enabled
 * - Phase 3: Shooting Range - ammo counter, fire enabled
 * - Phase 4: Hangar Bay - full HUD, ready for drop
 *
 * Extends StationLevel for interior space station rendering.
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import {
  type CinematicCallbacks,
  CinematicSystem,
  createAnchorStationIntroCinematic,
} from '../../cinematics';
import { getLogger } from '../../core/Logger';
import { bindableActionParams, formatKeyForDisplay } from '../../input/InputBridge';
import type { ActionButtonGroup } from '../../types/actions';
import { StationLevel } from '../StationLevel';
import type { LevelConfig, LevelId } from '../types';
import styles from './AnchorStationLevel.module.css';
import { MODULAR_ROOM_POSITIONS } from './ModularStationBuilder';
import { StationLightTubes } from './StationLightTubes';
// Use modular GLB-based station (replaces legacy procedural generation)
import {
  createModularStationEnvironment,
  type ModularStationEnv,
} from './ModularStationEnvironment';
import { TutorialManager } from './TutorialManager';
import type { HUDUnlockState, TutorialPhase } from './tutorialSteps';

const log = getLogger('AnchorStationLevel');

export class AnchorStationLevel extends StationLevel {
  // Player collision proxy mesh for indoor movement
  private playerCollider: Mesh | null = null;

  // Station environment (modular GLB-based)
  private stationEnvironment: ModularStationEnv | null = null;

  // Visible light tube fixtures along corridors
  private lightTubes: StationLightTubes | null = null;

  // Cinematic system for intro sequence
  private cinematicSystem: CinematicSystem | null = null;

  // Tutorial system
  private tutorialManager: TutorialManager | null = null;

  // Objective marker (! above objectives)
  private objectiveMarker: Mesh | null = null;
  private objectiveMarkerExclamation: Mesh | null = null;

  // Interact marker ([E] above interactables)
  private interactMarker: Mesh | null = null;

  // Interaction prompt (HTML overlay)
  private interactionPrompt: HTMLDivElement | null = null;
  private showingPrompt = false;
  private targetsHit = 0;
  private totalTargets = 5;

  // Current HUD state based on tutorial phase
  private currentHUDState: HUDUnlockState = {
    healthBar: false,
    crosshair: false,
    ammoCounter: false,
    missionText: false,
    actionButtons: false,
    movementEnabled: false,
    lookEnabled: false,
    fireEnabled: false,
  };

  // Current tutorial phase
  private currentPhase: TutorialPhase = 0;

  // Equipment state
  private suitEquipped = false;
  private weaponAcquired = false;

  // Movement state for holodeck tutorial
  private isCrouching = false;

  constructor(engine: Engine, canvas: HTMLCanvasElement, config: LevelConfig) {
    super(engine, canvas, config);

    // ========================================================================
    // BESPOKE INDOOR COLLISION SETUP
    // ========================================================================
    // Station levels need collision-based movement because the player walks
    // through enclosed corridors. The default BaseLevel direct-position movement
    // is for open outdoor levels where there are no walls to collide with.
    //
    // We use an invisible proxy mesh with moveWithCollisions() since
    // UniversalCamera doesn't expose this method directly when using
    // manual input handling (camera.inputs.clear()).
    // ========================================================================
    this.scene.collisionsEnabled = true;

    // Create invisible collision proxy at player spawn position
    this.playerCollider = MeshBuilder.CreateBox(
      'playerCollider',
      { width: 0.1, height: 0.1, depth: 0.1 },
      this.scene
    );
    this.playerCollider.isVisible = false;
    this.playerCollider.isPickable = false;
    this.playerCollider.checkCollisions = true;
    // Collision ellipsoid: 0.4m radius × 0.85m half-height × 0.4m depth
    this.playerCollider.ellipsoid = new Vector3(0.4, 0.85, 0.4);
    this.playerCollider.ellipsoidOffset = new Vector3(0, 0.85, 0);
    this.playerCollider.position.copyFrom(this.camera.position);

    log.info('Indoor collision system enabled: proxy ellipsoid=(0.4, 0.85, 0.4)');
  }

  /**
   * Bespoke collision-based movement for indoor station levels.
   * Uses an invisible proxy mesh with BabylonJS moveWithCollisions()
   * to detect corridor walls instead of BaseLevel's direct position update.
   */
  protected override applyMovement(dx: number, dz: number): void {
    if (!this.playerCollider) {
      // Fallback to direct movement if collider not ready
      this.camera.position.x += dx;
      this.camera.position.z += dz;
      return;
    }

    // Sync collider to current camera XZ (Y is managed separately)
    this.playerCollider.position.x = this.camera.position.x;
    this.playerCollider.position.z = this.camera.position.z;
    this.playerCollider.position.y = 0.85; // Ellipsoid center height

    // Move with wall collision detection
    this.playerCollider.moveWithCollisions(new Vector3(dx, 0, dz));

    // Copy collision-adjusted position back to camera
    this.camera.position.x = this.playerCollider.position.x;
    this.camera.position.z = this.playerCollider.position.z;
  }

  /**
   * Track crouch state for holodeck tutorial.
   * In the station, crouching lowers camera height to simulate ducking under obstacles.
   */
  protected override onCrouch(isCrouching: boolean): void {
    this.isCrouching = isCrouching;
    if (isCrouching) {
      this.camera.position.y = 1.0; // Crouched eye height
    }
    // Standing height is enforced in updateLevel() every frame
  }

  protected override getBackgroundColor(): Color4 {
    // Dark station interior
    return new Color4(0.01, 0.01, 0.02, 1);
  }

  protected async createEnvironment(): Promise<void> {
    log.info('createEnvironment() starting...');

    // CRITICAL: This is an INDOOR level - ensure fog is disabled before anything else
    this.disableFog();

    // Create modular station from GLB corridor segments
    // This replaces the legacy procedural generation with snap-together GLB corridors
    log.info('About to call createModularStationEnvironment');
    log.debug(
      'createModularStationEnvironment function exists:',
      typeof createModularStationEnvironment
    );
    this.stationEnvironment = await createModularStationEnvironment(this.scene);
    log.info('Station environment created');

    // ========================================================================
    // LIGHTING STRATEGY: VISUAL TUBES + ZONE LIGHTS
    // ========================================================================
    // Emissive tube meshes provide the VISUAL impression of fluorescent
    // ceiling lights (zero GPU cost - just emissive material on static mesh).
    // A small number of zone PointLights provide ACTUAL illumination for
    // key areas. The DirectionalLight + HemisphericLight from StationLevel
    // handle the bulk of PBR illumination.
    //
    // Previous: 65 PointLights (one per tube) = thousands of draw calls
    // Now: ~8 PointLights (one per major room) = manageable draw calls
    // ========================================================================
    this.lightTubes = new StationLightTubes(this.scene, new Color3(0.95, 0.95, 1.0));

    // ALL tube meshes are visual-only (no PointLights attached)
    const visualOnly = { visualOnly: true } as const;

    // BRIEFING ROOM - Visual tubes
    this.lightTubes.addCeilingLights(
      'briefing', new Vector3(0, 0, 2), 10, 8, 3.5, 3, 2,
      { ...visualOnly }
    );

    // CORRIDOR A - Visual tubes
    this.lightTubes.addCorridorLights(
      'corridorA', new Vector3(0, 0, -4), new Vector3(0, 0, -24), 3.0, 5,
      { ...visualOnly, length: 1.5 }
    );

    // EQUIPMENT BAY - Visual tubes
    this.lightTubes.addCeilingLights(
      'equipBay', new Vector3(-10, 0, -16), 10, 8, 3.5, 2, 2,
      { ...visualOnly, color: new Color3(0.9, 1.0, 0.9) }
    );

    // ARMORY - Visual tubes
    this.lightTubes.addCeilingLights(
      'armory', new Vector3(10, 0, -16), 10, 8, 3.5, 2, 2,
      { ...visualOnly, color: new Color3(1.0, 0.95, 0.9) }
    );

    // HOLODECK - Visual tubes
    this.lightTubes.addCeilingLights(
      'holodeck', new Vector3(0, 0, -34), 12, 12, 4.0, 3, 3,
      { ...visualOnly, color: new Color3(0.8, 0.9, 1.0) }
    );

    // SHOOTING RANGE - Visual tubes (center + side strips)
    this.lightTubes.addCorridorLights(
      'range_center', new Vector3(0, 0, -44), new Vector3(0, 0, -60), 3.5, 4,
      { ...visualOnly }
    );
    this.lightTubes.addCorridorLights(
      'range_left', new Vector3(-3, 0, -44), new Vector3(-3, 0, -60), 3.5, 6,
      { ...visualOnly }
    );
    this.lightTubes.addCorridorLights(
      'range_right', new Vector3(3, 0, -44), new Vector3(3, 0, -60), 3.5, 6,
      { ...visualOnly }
    );

    // HANGAR BAY - Visual tubes
    this.lightTubes.addCeilingLights(
      'hangar', new Vector3(0, 0, -70), 16, 12, 8.0, 4, 3,
      { ...visualOnly, length: 2.5 }
    );

    // EXPLORATION AREAS - Visual tubes only
    this.lightTubes.addCeilingLights(
      'observation', new Vector3(-12, 0, 4), 8, 8, 3.5, 2, 2,
      { ...visualOnly, color: new Color3(0.7, 0.8, 1.0) }
    );
    this.lightTubes.addCeilingLights(
      'engine', new Vector3(12, 0, 4), 8, 8, 3.5, 2, 2,
      { ...visualOnly, color: new Color3(1.0, 0.9, 0.7) }
    );
    this.lightTubes.addCeilingLights(
      'crewQuarters', new Vector3(-12, 0, -8), 8, 8, 3.0, 2, 1,
      { ...visualOnly, color: new Color3(1.0, 0.95, 0.85) }
    );
    this.lightTubes.addCeilingLights(
      'medical', new Vector3(12, 0, -8), 8, 8, 3.0, 2, 2,
      { ...visualOnly, color: new Color3(0.95, 0.98, 1.0) }
    );
    this.lightTubes.addCeilingLights(
      'biosphere', new Vector3(-8, 0, -24), 6, 8, 3.5, 2, 2,
      { ...visualOnly, color: new Color3(0.7, 1.0, 0.8) }
    );

    // ========================================================================
    // ZONE LIGHTS - One per major room for atmosphere color tinting
    // ========================================================================
    // These are the ONLY PointLights in the station (besides 4 emergency)
    // Global DirectionalLight + HemisphericLight handle base PBR illumination
    // ========================================================================
    this.addStationLight('zone_briefing', new Vector3(0, 3.0, 2),
      new Color3(0.95, 0.95, 1.0), 2.5, 22);
    this.addStationLight('zone_equipment', new Vector3(-10, 3.0, -16),
      new Color3(0.9, 1.0, 0.9), 2.0, 18);
    this.addStationLight('zone_armory', new Vector3(10, 3.0, -16),
      new Color3(1.0, 0.95, 0.9), 2.0, 18);
    this.addStationLight('zone_holodeck', new Vector3(0, 3.5, -34),
      new Color3(0.8, 0.9, 1.0), 2.0, 22);
    this.addStationLight('zone_range', new Vector3(0, 3.0, -52),
      new Color3(0.95, 0.95, 1.0), 2.5, 28);
    this.addStationLight('zone_hangar', new Vector3(0, 6.0, -70),
      new Color3(0.8, 0.85, 0.95), 3.0, 40);
    this.addStationLight('zone_corridor_a', new Vector3(0, 2.8, -10),
      new Color3(0.9, 0.9, 1.0), 1.5, 20);
    this.addStationLight('zone_corridor_b', new Vector3(0, 2.8, -20),
      new Color3(0.9, 0.9, 1.0), 1.5, 20);
    this.addStationLight('zone_engine', new Vector3(12, 3.0, 4),
      new Color3(1.0, 0.9, 0.7), 1.5, 18);
    this.addStationLight('zone_observation', new Vector3(-12, 3.0, 4),
      new Color3(0.7, 0.8, 1.0), 1.5, 18);

    // EMERGENCY LIGHTS (red accent - 4 small PointLights)
    this.addEmergencyLight('emergency1', new Vector3(-2, 2, -28), 3.0);
    this.addEmergencyLight('emergency2', new Vector3(2, 2, -40), 3.0);
    this.addEmergencyLight('emergency3', new Vector3(-4, 4, -64), 4.0);
    this.addEmergencyLight('emergency4', new Vector3(4, 4, -64), 4.0);

    log.info(`Lighting setup: 10 zone lights + 4 emergency + 2 global = 16 total`);

    // Create space view through windows (purely visual - no fog or environment lighting)
    this.createSpaceView();

    // Final fog disable to ensure nothing re-enabled it
    this.disableFog();

    // Create objective marker
    this.createObjectiveMarker();

    // Create interact marker
    this.createInteractMarker();

    // Create interaction prompt
    this.createInteractionPrompt();

    // Initialize tutorial manager
    this.tutorialManager = new TutorialManager(this.scene);

    // Initialize cinematic system
    this.initializeCinematicSystem();

    // Play intro cinematic (or start tutorial directly if already viewed)
    this.playIntroCinematic();

    // Set up environmental audio for station atmosphere
    this.setupStationEnvironmentalAudio();
  }

  /**
   * Initialize the cinematic system with appropriate callbacks.
   */
  private initializeCinematicSystem(): void {
    const cinematicCallbacks: CinematicCallbacks = {
      onCommsMessage: (message) => {
        this.emitCommsMessage({
          sender: message.sender,
          callsign: message.callsign ?? '',
          portrait: (message.portrait ?? 'ai') as
            | 'commander'
            | 'ai'
            | 'marcus'
            | 'armory'
            | 'player',
          text: message.text,
        });
      },
      onNotification: (text, duration) => {
        this.emitNotification(text, duration ?? 3000);
      },
      onObjectiveUpdate: (title, instructions) => {
        this.emitObjectiveUpdate(title, instructions);
      },
      onShakeCamera: (intensity) => {
        this.triggerShake(intensity);
      },
      onCinematicStart: () => {
        this.emitCinematicStart();
      },
      onCinematicEnd: () => {
        this.emitCinematicEnd();
      },
    };

    this.cinematicSystem = new CinematicSystem(this.scene, this.camera, cinematicCallbacks);
  }

  /**
   * Play the level intro cinematic sequence.
   * Cinematic is skipped if already viewed in the current save.
   */
  private playIntroCinematic(): void {
    if (!this.cinematicSystem) {
      this.startTutorial();
      return;
    }

    // Player spawn position for the intro cinematic
    const playerSpawnPosition = new Vector3(0, 1.7, 2);

    const sequence = createAnchorStationIntroCinematic(() => {
      // Cinematic complete - start the tutorial
      this.startTutorial();
    }, playerSpawnPosition);

    this.cinematicSystem.play(sequence);
  }

  /**
   * Set up spatial sound sources for immersive station atmosphere.
   * Machinery hum, air vents, electrical panels, and computer terminals.
   * Uses MODULAR_ROOM_POSITIONS for accurate placement.
   */
  private setupStationEnvironmentalAudio(): void {
    // BRIEFING ROOM - Air vents and computer terminals
    this.addSpatialSound('vent_briefing', 'vent', { x: 0, y: 3, z: 2 }, { maxDistance: 10 });
    this.addSpatialSound(
      'terminal_briefing1',
      'terminal',
      { x: -3, y: 1.2, z: 2 },
      { maxDistance: 5, volume: 0.15, interval: 4000 }
    );
    this.addSpatialSound(
      'terminal_briefing2',
      'terminal',
      { x: 3, y: 1.2, z: 2 },
      { maxDistance: 5, volume: 0.12, interval: 5500 }
    );

    // CORRIDOR A - Multiple vent sounds along the length
    this.addSpatialSound('vent_corridor1', 'vent', { x: 0, y: 2.8, z: -8 }, { maxDistance: 12 });
    this.addSpatialSound('vent_corridor2', 'vent', { x: 0, y: 2.8, z: -18 }, { maxDistance: 12 });

    // EQUIPMENT BAY - Machinery and electrical hum
    const eqBay = MODULAR_ROOM_POSITIONS.equipmentBay;
    this.addSpatialSound(
      'machinery_equipment',
      'machinery',
      { x: eqBay.x, y: 1.5, z: eqBay.z },
      { maxDistance: 15, volume: 0.4 }
    );
    this.addSpatialSound(
      'electric_panel1',
      'electrical_panel',
      { x: eqBay.x - 4, y: 2, z: eqBay.z },
      { maxDistance: 6, volume: 0.2 }
    );

    // ARMORY - Weapon racks hum
    const armory = MODULAR_ROOM_POSITIONS.armory;
    this.addSpatialSound(
      'machinery_armory',
      'machinery',
      { x: armory.x, y: 1.5, z: armory.z },
      { maxDistance: 12, volume: 0.3 }
    );

    // HOLODECK - Low electronic hum
    const holodeck = MODULAR_ROOM_POSITIONS.holodeckCenter;
    this.addSpatialSound(
      'holodeck_hum',
      'electrical_panel',
      { x: holodeck.x, y: 2, z: holodeck.z },
      { maxDistance: 18, volume: 0.25 }
    );

    // SHOOTING RANGE - Mechanical target system
    const range = MODULAR_ROOM_POSITIONS.shootingRange;
    this.addSpatialSound(
      'range_machinery',
      'machinery',
      { x: range.x, y: 1.5, z: range.z - 5 },
      { maxDistance: 15, volume: 0.35 }
    );

    // HANGAR BAY - Large generator and ship systems
    const hangar = MODULAR_ROOM_POSITIONS.hangarBay;
    this.addSpatialSound(
      'generator_hangar',
      'generator',
      { x: hangar.x + 10, y: 2, z: hangar.z },
      { maxDistance: 25, volume: 0.5 }
    );
    this.addSpatialSound(
      'vent_hangar',
      'vent',
      { x: hangar.x - 8, y: 8, z: hangar.z },
      { maxDistance: 20, volume: 0.3 }
    );

    // ENGINE ROOM - Heavy machinery (exploration area)
    const engine = MODULAR_ROOM_POSITIONS.engineRoom;
    this.addSpatialSound(
      'generator_engine',
      'generator',
      { x: engine.x, y: 2, z: engine.z },
      { maxDistance: 18, volume: 0.6 }
    );

    // Define audio zones for different station areas (ambient reverb/atmosphere)
    this.addAudioZone('zone_briefing', 'station', { x: 0, y: 0, z: 2 }, 12, {
      isIndoor: true,
      intensity: 0.25,
    });
    this.addAudioZone('zone_corridorA', 'station', { x: 0, y: 0, z: -14 }, 15, {
      isIndoor: true,
      intensity: 0.2,
    });
    this.addAudioZone('zone_equipment', 'station', { x: eqBay.x, y: 0, z: eqBay.z }, 12, {
      isIndoor: true,
      intensity: 0.35,
    });
    this.addAudioZone('zone_armory', 'station', { x: armory.x, y: 0, z: armory.z }, 12, {
      isIndoor: true,
      intensity: 0.3,
    });
    this.addAudioZone('zone_holodeck', 'station', { x: holodeck.x, y: 0, z: holodeck.z }, 18, {
      isIndoor: true,
      intensity: 0.2,
    });
    this.addAudioZone('zone_range', 'station', { x: range.x, y: 0, z: range.z }, 15, {
      isIndoor: true,
      intensity: 0.35,
    });
    this.addAudioZone('zone_hangar', 'station', { x: hangar.x, y: 0, z: hangar.z }, 30, {
      isIndoor: true,
      intensity: 0.5,
    });
  }

  private createObjectiveMarker(): void {
    // Base ring marker
    this.objectiveMarker = MeshBuilder.CreateTorus(
      'objectiveMarker',
      {
        diameter: 1.5,
        thickness: 0.08,
        tessellation: 24,
      },
      this.scene
    );
    this.objectiveMarker.rotation.x = Math.PI / 2;
    const markerMat = new StandardMaterial('markerMat', this.scene);
    markerMat.emissiveColor = Color3.FromHexString('#FFD700');
    markerMat.diffuseColor = Color3.FromHexString('#3A3000');
    markerMat.alpha = 0.8;
    this.objectiveMarker.material = markerMat;
    this.objectiveMarker.isVisible = false;

    // Exclamation mark above marker
    this.objectiveMarkerExclamation = MeshBuilder.CreateCylinder(
      'exclamation',
      { height: 0.6, diameter: 0.2, tessellation: 8 },
      this.scene
    );
    const exclamationMat = new StandardMaterial('exclamationMat', this.scene);
    exclamationMat.emissiveColor = Color3.FromHexString('#FFD700');
    exclamationMat.diffuseColor = Color3.FromHexString('#3A3000');
    this.objectiveMarkerExclamation.material = exclamationMat;
    this.objectiveMarkerExclamation.isVisible = false;
  }

  private createInteractMarker(): void {
    // [E] marker for interactables
    this.interactMarker = MeshBuilder.CreateBox(
      'interactMarker',
      { width: 0.5, height: 0.5, depth: 0.1 },
      this.scene
    );
    const interactMat = new StandardMaterial('interactMat', this.scene);
    interactMat.emissiveColor = new Color3(0.9, 0.9, 0.9);
    interactMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    this.interactMarker.material = interactMat;
    this.interactMarker.isVisible = false;
  }

  private createInteractionPrompt(): void {
    this.interactionPrompt = document.createElement('div');
    this.interactionPrompt.className = styles.interactionPrompt;

    const key = document.createElement('div');
    key.className = styles.promptKey;
    key.textContent = 'E';

    const text = document.createElement('div');
    text.className = styles.promptText;
    text.textContent = 'INTERACT';

    this.interactionPrompt.appendChild(key);
    this.interactionPrompt.appendChild(text);

    document.body.appendChild(this.interactionPrompt);
  }

  private startTutorial(): void {
    log.info('startTutorial() called');
    if (!this.tutorialManager) {
      log.warn('No tutorialManager!');
      return;
    }

    this.tutorialManager.start({
      onStepChange: (_step) => {
        // Update objective marker position
        const target = this.tutorialManager?.getCurrentObjectiveTarget();
        if (target && this.objectiveMarker && this.objectiveMarkerExclamation) {
          this.objectiveMarker.position = target.clone();
          this.objectiveMarker.position.y = 0.1;
          this.objectiveMarker.isVisible = true;

          this.objectiveMarkerExclamation.position = target.clone();
          this.objectiveMarkerExclamation.position.y = 2.5;
          this.objectiveMarkerExclamation.isVisible = true;
        } else if (this.objectiveMarker && this.objectiveMarkerExclamation) {
          this.objectiveMarker.isVisible = false;
          this.objectiveMarkerExclamation.isVisible = false;
        }
      },
      onPhaseChange: (phase, hudState) => {
        this.currentPhase = phase;
        this.currentHUDState = hudState;

        // Notify game context about HUD changes if needed
        // This would typically be done through a dedicated callback
        this.handlePhaseChange(phase);
      },
      onCommsMessage: (message) => {
        log.debug('onCommsMessage callback received:', message.text.substring(0, 40));
        this.emitCommsMessage({
          sender: message.sender,
          callsign: message.callsign,
          portrait: message.portrait,
          text: message.text,
        });
      },
      onObjectiveUpdate: (title, instructions) => {
        // Only show objective if missionText is unlocked
        if (this.currentHUDState.missionText) {
          this.emitObjectiveUpdate(title, instructions);
        }
      },
      onActionButtonsChange: (buttons) => {
        // Only show action buttons if unlocked
        if (this.currentHUDState.actionButtons && buttons.length > 0) {
          const actionGroup: ActionButtonGroup = {
            id: 'tutorial',
            position: 'right',
            buttons: buttons.map((btn) => {
              // Look up the actual keybinding for configurable actions
              const keyInfo = this.getKeyForActionId(btn.id, btn.key);
              return {
                id: btn.id,
                label: btn.label,
                key: keyInfo.key,
                keyDisplay: keyInfo.keyDisplay,
                enabled: true,
                visible: true,
                highlighted: btn.highlighted,
                variant: btn.variant ?? 'primary',
                size: btn.size ?? 'medium',
              };
            }),
          };
          this.emitActionGroupsChanged([actionGroup]);
        } else {
          this.emitActionGroupsChanged([]);
        }
      },
      onTriggerSequence: (sequence) => {
        this.handleSequence(sequence);
      },
      onComplete: () => {
        // Tutorial complete - transition to next level
        this.completeLevel();
      },
    });

    this.emitNotification('ANCHOR STATION PROMETHEUS', 3000);
  }

  /**
   * Get the actual keybinding for an action ID, supporting both
   * configurable actions (jump, crouch, fire, reload, interact) and
   * level-specific fixed actions.
   */
  private getKeyForActionId(
    actionId: string,
    fallbackKey: string
  ): { key: string; keyDisplay: string } {
    // Map tutorial action IDs to configurable keybindings
    const bindableActionMap: Record<string, Parameters<typeof bindableActionParams>[0]> = {
      jump: 'jump',
      crouch: 'crouch',
      fire: 'fire',
      reload: 'reload',
      interact: 'interact',
      equip_suit: 'interact', // Equip suit uses interact key
    };

    if (bindableActionMap[actionId]) {
      return bindableActionParams(bindableActionMap[actionId]);
    }

    // Fallback to static key with formatting
    return {
      key: fallbackKey,
      keyDisplay: formatKeyForDisplay(fallbackKey),
    };
  }

  private handlePhaseChange(phase: TutorialPhase): void {
    // Show notification for major unlocks
    switch (phase) {
      case 1:
        this.emitNotification('MOVEMENT CONTROLS ONLINE', 2000);
        break;
      case 2:
        this.emitNotification('TARGETING SYSTEMS ONLINE', 2000);
        break;
      case 3:
        this.emitNotification('WEAPONS SYSTEMS ONLINE', 2000);
        break;
      case 4:
        this.emitNotification('ALL SYSTEMS NOMINAL', 2000);
        break;
    }
  }

  private handleSequence(sequence: string): void {
    if (!this.stationEnvironment) return;

    switch (sequence) {
      case 'equip_suit':
        this.suitEquipped = true;
        this.stationEnvironment.playEquipSuit(() => {
          this.emitNotification('EVA SUIT EQUIPPED', 2000);
        });
        break;

      case 'pickup_weapon':
        this.weaponAcquired = true;
        this.emitNotification('M7 RIFLE ACQUIRED', 2000);
        break;

      case 'depressurize':
        this.stationEnvironment.playDepressurize(() => {
          // Depressurization complete
        });
        break;

      case 'open_bay_doors':
        this.stationEnvironment.playOpenBayDoors(() => {
          this.emitNotification('BAY DOORS OPEN', 2000);
        });
        break;

      case 'enter_pod':
        this.stationEnvironment.playEnterPod(() => {
          // Lock player in pod position
          this.camera.position = MODULAR_ROOM_POSITIONS.dropPod.clone();
          this.camera.position.y = 1.7;
          this.rotationY = Math.PI;
          this.camera.rotation.y = this.rotationY;
        });
        break;

      case 'launch':
        this.stationEnvironment.playLaunch(() => {
          // Tutorial complete - handled by onComplete
        });
        break;

      case 'start_platforming':
        this.stationEnvironment.startHolodeckTutorial({
          onPhaseComplete: (_phase) => {
            // Individual phases tracked via platform/crouch checks
          },
          onAllPhasesComplete: () => {
            this.tutorialManager?.onPlatformingComplete();
          },
          onPlatformReached: (_platformId) => {
            // Jump objective completion is handled in updateLevel via checkPlatformReached
          },
          onCrouchSuccess: () => {
            // Crouch objective completion is handled in updateLevel via checkCrouchZone
          },
        });
        break;

      case 'start_calibration':
        this.targetsHit = 0;
        this.stationEnvironment.startCalibration({
          onTargetHit: (_targetIndex) => {
            this.targetsHit++;
            this.emitNotification(`TARGET ${this.targetsHit}/${this.totalTargets}`, 800);
            // Trigger hit confirmation visual feedback
            this.triggerHitConfirmation();
            // Update kill streak for progressive visual feedback
            this.updateKillStreak(this.targetsHit);
          },
          onAllTargetsHit: () => {
            this.emitNotification('CALIBRATION COMPLETE', 1500);
            this.tutorialManager?.onShootingRangeComplete();
          },
        });
        break;
    }
  }

  protected override handleKeyDown(e: KeyboardEvent): void {
    // Only process movement if enabled
    if (this.currentHUDState.movementEnabled) {
      super.handleKeyDown(e);
    }

    // Get keybindings for interact and jump actions
    const interactKeys = this.inputTracker.getAllKeysForAction('interact');
    const jumpKeys = this.inputTracker.getAllKeysForAction('jump');

    // Handle interaction (configurable keybinding, default: E)
    if (interactKeys.includes(e.code) && this.tutorialManager?.isInteractStep()) {
      this.tryInteract();
    }

    // Handle jump/space for launch (configurable keybinding, default: Space)
    if (jumpKeys.includes(e.code) && this.tutorialManager?.isLaunchStep()) {
      this.tutorialManager.tryLaunchAction();
    }
  }

  protected override handleKeyUp(e: KeyboardEvent): void {
    if (this.currentHUDState.movementEnabled) {
      super.handleKeyUp(e);
    }
  }

  protected override handleMouseMove(e: MouseEvent): void {
    // Only process look if enabled
    if (this.currentHUDState.lookEnabled) {
      super.handleMouseMove(e);
    }
  }

  protected override handleClick(): void {
    // If calibration is active and pointer is locked, try to shoot
    if (
      this.currentHUDState.fireEnabled &&
      this.stationEnvironment?.isCalibrationActive() &&
      this.isPointerLocked()
    ) {
      this.tryShoot();
      return;
    }

    // If showing interaction prompt, try to interact
    if (this.showingPrompt && this.tutorialManager?.isInteractStep()) {
      this.tryInteract();
    } else if (this.currentHUDState.lookEnabled) {
      // Only lock pointer if look is enabled
      super.handleClick();
    }
  }

  private tryShoot(): void {
    if (!this.stationEnvironment?.isCalibrationActive()) return;
    if (!this.currentHUDState.fireEnabled) return;

    // Get ray from camera center
    const rayOrigin = this.camera.position.clone();
    const rayDirection = this.camera.getDirection(Vector3.Forward());

    // Check for target hit
    this.stationEnvironment.checkTargetHit(rayOrigin, rayDirection);
  }

  private tryInteract(): void {
    if (this.tutorialManager?.tryInteract(this.camera.position)) {
      this.hideInteractionPrompt();
    }
  }

  private showInteractionPrompt(): void {
    if (this.interactionPrompt && !this.showingPrompt) {
      this.interactionPrompt.style.display = 'flex';
      this.showingPrompt = true;
    }
  }

  private hideInteractionPrompt(): void {
    if (this.interactionPrompt && this.showingPrompt) {
      this.interactionPrompt.style.display = 'none';
      this.showingPrompt = false;
    }
  }

  // Note: setTouchInput is inherited from BaseLevel

  protected updateLevel(deltaTime: number): void {
    // Update cinematic system
    if (this.cinematicSystem) {
      this.cinematicSystem.update(deltaTime);

      // Don't update gameplay if cinematic is playing
      if (this.cinematicSystem.isPlaying()) {
        return;
      }
    }

    // Touch look input (respecting HUD state)
    // Note: Touch movement is handled by BaseLevel.processMovement() via setTouchInput(),
    // which calls applyMovement() with collision detection. We only handle look here.
    if (this.touchInput) {
      const look = this.touchInput.look;
      if (
        this.currentHUDState.lookEnabled &&
        (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001)
      ) {
        this.targetRotationY += look.x;
        this.targetRotationX -= look.y;
        this.targetRotationX = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, this.targetRotationX)
        );
      }
    }

    // Keep at correct height (no gravity in station - mag boots)
    // Collision system handles X/Z wall detection; we just enforce Y.
    this.camera.position.y = this.isCrouching ? 1.0 : 1.7;

    // Check tutorial objectives
    if (this.tutorialManager) {
      const lookDir = this.camera.getDirection(Vector3.Forward());
      this.tutorialManager.checkObjective(this.camera.position, lookDir);

      // Wire holodeck platform/crouch checks to tutorial manager
      if (this.stationEnvironment?.isHolodeckActive()) {
        // Check if player reached a platform (jump objective)
        if (this.tutorialManager.isJumpTutorialStep()) {
          if (this.stationEnvironment.checkPlatformReached(this.camera.position)) {
            this.tutorialManager.onJumpComplete();
          }
        }

        // Check if player successfully crouched through passage
        if (this.tutorialManager.isCrouchTutorialStep()) {
          if (this.stationEnvironment.checkCrouchZone(this.camera.position, this.isCrouching)) {
            this.tutorialManager.onCrouchComplete();
          }
        }
      }

      // Show/hide interaction prompt
      if (this.tutorialManager.canPlayerInteract(this.camera.position)) {
        this.showInteractionPrompt();

        // Update interact marker position
        if (this.interactMarker) {
          const target = this.tutorialManager.getCurrentObjectiveTarget();
          if (target) {
            this.interactMarker.position = target.clone();
            this.interactMarker.position.y = 2.8;
            this.interactMarker.isVisible = true;
          }
        }
      } else {
        this.hideInteractionPrompt();
        if (this.interactMarker) {
          this.interactMarker.isVisible = false;
        }
      }
    }

    // Animate objective marker
    if (this.objectiveMarker?.isVisible) {
      this.objectiveMarker.rotation.y += deltaTime * 2;
      const pulse = 0.6 + Math.sin(performance.now() * 0.003) * 0.2;
      (this.objectiveMarker.material as StandardMaterial).alpha = pulse;
    }

    // Animate exclamation mark (bob up and down)
    if (this.objectiveMarkerExclamation?.isVisible) {
      const bob = Math.sin(performance.now() * 0.004) * 0.15;
      const target = this.tutorialManager?.getCurrentObjectiveTarget();
      if (target) {
        this.objectiveMarkerExclamation.position.y = 2.5 + bob;
      }
    }

    // Animate interact marker
    if (this.interactMarker?.isVisible) {
      const bob = Math.sin(performance.now() * 0.005) * 0.1;
      this.interactMarker.position.y = 2.8 + bob;
    }
  }

  // Override movement processing to respect HUD state
  protected override processMovement(deltaTime: number): void {
    if (!this.currentHUDState.movementEnabled) return;
    if (!this.isPointerLocked()) return;

    super.processMovement(deltaTime);
  }

  // Called when player dismisses comms
  onCommsDismissed(): void {
    this.tutorialManager?.onCommsDismissed();
  }

  // Skip tutorial for debugging
  skip(): void {
    this.tutorialManager?.skip();
  }

  override canTransitionTo(levelId: LevelId): boolean {
    // Can only transition to next level when tutorial is complete
    return levelId === this.config.nextLevelId && this.state.completed;
  }

  protected override disposeLevel(): void {
    // Dispose cinematic system
    this.cinematicSystem?.dispose();
    this.cinematicSystem = null;

    // Dispose tutorial manager
    this.tutorialManager?.dispose();
    this.tutorialManager = null;

    // Dispose light tubes
    this.lightTubes?.dispose();
    this.lightTubes = null;

    // Dispose station environment
    this.stationEnvironment?.dispose();
    this.stationEnvironment = null;

    // Dispose collision proxy
    this.playerCollider?.dispose();
    this.playerCollider = null;

    // Dispose markers
    this.objectiveMarker?.dispose();
    this.objectiveMarker = null;
    this.objectiveMarkerExclamation?.dispose();
    this.objectiveMarkerExclamation = null;
    this.interactMarker?.dispose();
    this.interactMarker = null;

    // Remove interaction prompt from DOM
    if (this.interactionPrompt?.parentNode) {
      this.interactionPrompt.parentNode.removeChild(this.interactionPrompt);
    }
    this.interactionPrompt = null;

    // Clear action buttons
    this.emitActionGroupsChanged([]);

    // Call parent dispose
    super.disposeLevel();
  }
}
