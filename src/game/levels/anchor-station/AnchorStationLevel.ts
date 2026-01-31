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
  bindableActionParams,
  formatKeyForDisplay,
  levelActionParams,
} from '../../input/InputBridge';
import type { ActionButtonGroup } from '../../types/actions';
import { StationLevel } from '../StationLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import styles from './AnchorStationLevel.module.css';
import { MODULAR_ROOM_POSITIONS } from './ModularStationBuilder';
// Use modular GLB-based station (replaces legacy procedural generation)
import {
  createModularStationEnvironment,
  type ModularStationEnv,
} from './ModularStationEnvironment';
import { TutorialManager } from './TutorialManager';
import type { HUDUnlockState, TutorialPhase } from './tutorialSteps';
import { getLogger } from '../../core/Logger';

const log = getLogger('AnchorStationLevel');

export class AnchorStationLevel extends StationLevel {
  // Station environment (modular GLB-based)
  private stationEnvironment: ModularStationEnv | null = null;

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

  // Note: touchInput is inherited from BaseLevel (protected)

  // Tutorial state
  private suitEquipped = false;
  private weaponAcquired = false;
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

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
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

    // Add station-specific interior lights throughout the level
    // These are the PRIMARY light sources for the indoor level
    // Match positions to MODULAR_ROOM_POSITIONS layout

    // BRIEFING ROOM (centered at 0, 0, 2)
    this.addStationLight('briefing1', new Vector3(-5, 3.5, 2), new Color3(0.85, 0.9, 1.0), 0.6, 15);
    this.addStationLight('briefing2', new Vector3(5, 3.5, 2), new Color3(0.85, 0.9, 1.0), 0.6, 15);
    this.addStationLight('briefing3', new Vector3(0, 3.5, 2), new Color3(0.9, 0.95, 1.0), 0.7, 18);

    // CORRIDOR A (extends from z=-4 to z=-24)
    this.addStationLight('corridor1', new Vector3(0, 2.8, -8), new Color3(0.8, 0.85, 1.0), 0.5, 15);
    this.addStationLight('corridor2', new Vector3(0, 2.8, -14), new Color3(0.8, 0.85, 1.0), 0.5, 15);
    this.addStationLight('corridor3', new Vector3(0, 2.8, -20), new Color3(0.8, 0.85, 1.0), 0.5, 15);

    // EQUIPMENT BAY (at -10, -16)
    this.addStationLight('equipBay1', new Vector3(-10, 3.5, -16), new Color3(0.7, 0.8, 0.7), 0.6, 15);
    this.addStationLight('equipBay2', new Vector3(-14, 3.5, -16), new Color3(0.7, 0.8, 0.7), 0.5, 12);

    // ARMORY (at 10, -16)
    this.addStationLight('armory1', new Vector3(10, 3.5, -16), new Color3(0.8, 0.6, 0.5), 0.6, 15);
    this.addStationLight('armory2', new Vector3(14, 3.5, -16), new Color3(0.8, 0.6, 0.5), 0.5, 12);

    // HOLODECK / PLATFORMING ROOM (at 0, -34)
    this.addStationLight('holodeck1', new Vector3(-3, 4, -32), new Color3(0.5, 0.6, 1.0), 0.4, 12);
    this.addStationLight('holodeck2', new Vector3(0, 4, -34), new Color3(0.5, 0.6, 1.0), 0.5, 15);
    this.addStationLight('holodeck3', new Vector3(3, 4, -38), new Color3(0.5, 0.6, 1.0), 0.4, 12);

    // SHOOTING RANGE (at 0, -52)
    this.addStationLight('range1', new Vector3(0, 3.5, -48), new Color3(0.9, 0.85, 0.7), 0.7, 18);
    this.addStationLight('range2', new Vector3(-6, 3.5, -52), new Color3(0.9, 0.85, 0.7), 0.5, 12);
    this.addStationLight('range3', new Vector3(6, 3.5, -52), new Color3(0.9, 0.85, 0.7), 0.5, 12);

    // HANGAR BAY (at 0, -70)
    this.addStationLight('hangar1', new Vector3(0, 10, -68), new Color3(0.5, 0.6, 0.8), 0.8, 25);
    this.addStationLight('hangar2', new Vector3(-8, 6, -70), new Color3(0.5, 0.6, 0.8), 0.5, 15);
    this.addStationLight('hangar3', new Vector3(8, 6, -70), new Color3(0.5, 0.6, 0.8), 0.5, 15);

    // EMERGENCY LIGHTS (red accent lighting for atmosphere)
    this.addEmergencyLight('emergency1', new Vector3(-2, 2, -28), 0.25);
    this.addEmergencyLight('emergency2', new Vector3(2, 2, -40), 0.25);
    this.addEmergencyLight('emergency3', new Vector3(-4, 4, -64), 0.3);
    this.addEmergencyLight('emergency4', new Vector3(4, 4, -64), 0.3);

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
    this.startTutorial();

    // Set up environmental audio for station atmosphere
    this.setupStationEnvironmentalAudio();
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
    this.addAudioZone(
      'zone_equipment',
      'station',
      { x: eqBay.x, y: 0, z: eqBay.z },
      12,
      { isIndoor: true, intensity: 0.35 }
    );
    this.addAudioZone(
      'zone_armory',
      'station',
      { x: armory.x, y: 0, z: armory.z },
      12,
      { isIndoor: true, intensity: 0.3 }
    );
    this.addAudioZone(
      'zone_holodeck',
      'station',
      { x: holodeck.x, y: 0, z: holodeck.z },
      18,
      { isIndoor: true, intensity: 0.2 }
    );
    this.addAudioZone(
      'zone_range',
      'station',
      { x: range.x, y: 0, z: range.z },
      15,
      { isIndoor: true, intensity: 0.35 }
    );
    this.addAudioZone(
      'zone_hangar',
      'station',
      { x: hangar.x, y: 0, z: hangar.z },
      30,
      { isIndoor: true, intensity: 0.5 }
    );
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
        log.debug(
          'onCommsMessage callback received:',
          message.text.substring(0, 40)
        );
        this.callbacks.onCommsMessage({
          sender: message.sender,
          callsign: message.callsign,
          portrait: message.portrait,
          text: message.text,
        });
      },
      onObjectiveUpdate: (title, instructions) => {
        // Only show objective if missionText is unlocked
        if (this.currentHUDState.missionText) {
          this.callbacks.onObjectiveUpdate(title, instructions);
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
          this.callbacks.onActionGroupsChange([actionGroup]);
        } else {
          this.callbacks.onActionGroupsChange([]);
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

    this.callbacks.onNotification('ANCHOR STATION PROMETHEUS', 3000);
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
        this.callbacks.onNotification('MOVEMENT CONTROLS ONLINE', 2000);
        break;
      case 2:
        this.callbacks.onNotification('TARGETING SYSTEMS ONLINE', 2000);
        break;
      case 3:
        this.callbacks.onNotification('WEAPONS SYSTEMS ONLINE', 2000);
        break;
      case 4:
        this.callbacks.onNotification('ALL SYSTEMS NOMINAL', 2000);
        break;
    }
  }

  private handleSequence(sequence: string): void {
    if (!this.stationEnvironment) return;

    switch (sequence) {
      case 'equip_suit':
        this.suitEquipped = true;
        this.stationEnvironment.playEquipSuit(() => {
          this.callbacks.onNotification('EVA SUIT EQUIPPED', 2000);
        });
        break;

      case 'pickup_weapon':
        this.weaponAcquired = true;
        this.callbacks.onNotification('M7 RIFLE ACQUIRED', 2000);
        break;

      case 'depressurize':
        this.stationEnvironment.playDepressurize(() => {
          // Depressurization complete
        });
        break;

      case 'open_bay_doors':
        this.stationEnvironment.playOpenBayDoors(() => {
          this.callbacks.onNotification('BAY DOORS OPEN', 2000);
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

      case 'start_calibration':
        this.targetsHit = 0;
        this.stationEnvironment.startCalibration({
          onTargetHit: (_targetIndex) => {
            this.targetsHit++;
            this.callbacks.onNotification(`TARGET ${this.targetsHit}/${this.totalTargets}`, 800);
            // Trigger hit confirmation visual feedback
            this.triggerHitConfirmation();
            // Update kill streak for progressive visual feedback
            this.updateKillStreak(this.targetsHit);
          },
          onAllTargetsHit: () => {
            this.callbacks.onNotification('CALIBRATION COMPLETE', 1500);
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
    // Process touch input for movement/look (respecting HUD state)
    if (this.touchInput) {
      const movement = this.touchInput.movement;
      if (
        this.currentHUDState.movementEnabled &&
        (Math.abs(movement.x) > 0.1 || Math.abs(movement.y) > 0.1)
      ) {
        const forward = this.camera.getDirection(Vector3.Forward());
        const right = this.camera.getDirection(Vector3.Right());
        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();

        const speed = this.getMoveSpeed() * deltaTime;
        this.camera.position.addInPlace(forward.scale(movement.y * speed));
        this.camera.position.addInPlace(right.scale(movement.x * speed));
      }

      const look = this.touchInput.look;
      if (
        this.currentHUDState.lookEnabled &&
        (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001)
      ) {
        this.rotationY += look.x;
        this.rotationX -= look.y;
        this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));
        this.camera.rotation.x = this.rotationX;
        this.camera.rotation.y = this.rotationY;
      }
    }

    // Keep at standing height
    this.camera.position.y = 1.7;

    // Clamp to station bounds based on MODULAR_ROOM_POSITIONS layout
    // Station extends from briefing (z=2) to drop pod (z=-76)
    // Width varies: main corridor is narrow, rooms extend to x=-15/+15
    const minX = -18; // Equipment bay and observation deck extend left
    const maxX = 18;  // Armory and engine room extend right
    const minZ = -80; // Beyond drop pod for launch sequence
    const maxZ = 8;   // Behind briefing room
    this.camera.position.x = Math.max(minX, Math.min(maxX, this.camera.position.x));
    this.camera.position.z = Math.max(minZ, Math.min(maxZ, this.camera.position.z));

    // Check tutorial objectives
    if (this.tutorialManager) {
      const lookDir = this.camera.getDirection(Vector3.Forward());
      this.tutorialManager.checkObjective(this.camera.position, lookDir);

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
    // Dispose tutorial manager
    this.tutorialManager?.dispose();
    this.tutorialManager = null;

    // Dispose station environment
    this.stationEnvironment?.dispose();
    this.stationEnvironment = null;

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
    this.callbacks.onActionGroupsChange([]);

    // Call parent dispose
    super.disposeLevel();
  }
}
