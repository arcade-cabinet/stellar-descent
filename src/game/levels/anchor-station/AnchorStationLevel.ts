import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { TouchInput } from '../../types';
import styles from './AnchorStationLevel.module.css';
import { createStationEnvironment, type StationEnvironment } from './environment';
import { TutorialManager } from './TutorialManager';
import type { TutorialStep } from './tutorialSteps';

export interface AnchorStationCallbacks {
  onCommsMessage: (message: NonNullable<TutorialStep['commsMessage']>) => void;
  onObjectiveUpdate: (title: string, instructions: string) => void;
  onTutorialComplete: () => void;
  onNotification: (text: string, duration?: number) => void;
  onCalibrationStart?: () => void;
  onCalibrationEnd?: () => void;
}

// The Anchor Station level - tutorial introduction to the game
export class AnchorStationLevel {
  private scene: Scene;
  private canvas: HTMLCanvasElement;

  private camera: UniversalCamera;
  private environment: StationEnvironment | null = null;
  private tutorialManager: TutorialManager;
  private callbacks: AnchorStationCallbacks;

  // Player state
  private isActive = false;
  private moveSpeed = 8;
  private keysPressed: Set<string> = new Set();
  private touchInput: TouchInput | null = null;

  // Camera rotation - fixed FOV, player turns with mouse/touch drag
  private rotationX = 0;
  private rotationY = Math.PI; // Face down the corridor

  // Objective marker
  private objectiveMarker: Mesh | null = null;

  // Interaction prompt
  private interactionPrompt: HTMLDivElement | null = null;
  private showingPrompt = false;

  // Shooting range state
  private targetsHit = 0;
  private totalTargets = 5;

  // Store bound handlers for cleanup
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundClick: () => void;

  constructor(
    scene: Scene,
    _engine: Engine,
    canvas: HTMLCanvasElement,
    callbacks: AnchorStationCallbacks
  ) {
    this.scene = scene;
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.camera = this.createCamera();
    this.tutorialManager = new TutorialManager(scene);

    // Bind handlers
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundClick = this.handleClick.bind(this);
  }

  private createCamera(): UniversalCamera {
    const camera = new UniversalCamera(
      'stationCamera',
      new Vector3(0, 1.7, 0), // Standing height at start
      this.scene
    );

    camera.rotation.y = this.rotationY;
    camera.minZ = 0.1;
    camera.maxZ = 500;
    // Proper FPS FOV - not too wide, not too narrow
    camera.fov = 1.2; // ~69 degrees - good for FPS

    // Clear default inputs - we handle manually
    camera.inputs.clear();

    return camera;
  }

  initialize(): void {
    // Create station environment
    this.environment = createStationEnvironment(this.scene);

    // Set this camera as active
    this.scene.activeCamera = this.camera;

    // Create objective marker
    this.objectiveMarker = MeshBuilder.CreateCylinder(
      'objectiveMarker',
      {
        height: 0.1,
        diameter: 1.5,
        tessellation: 16,
      },
      this.scene
    );
    const markerMat = new StandardMaterial('markerMat', this.scene);
    markerMat.emissiveColor = Color3.FromHexString('#FFD700');
    markerMat.alpha = 0.4;
    this.objectiveMarker.material = markerMat;
    this.objectiveMarker.isVisible = false;

    // Create interaction prompt (HTML overlay)
    this.createInteractionPrompt();

    // Setup controls
    this.setupControls();

    // Start tutorial with sequence handlers
    this.tutorialManager.start({
      onStepChange: (_step) => {
        // Update objective marker position
        const target = this.tutorialManager.getCurrentObjectiveTarget();
        if (target && this.objectiveMarker) {
          this.objectiveMarker.position = target.clone();
          this.objectiveMarker.position.y = 0.1;
          this.objectiveMarker.isVisible = true;
        } else if (this.objectiveMarker) {
          this.objectiveMarker.isVisible = false;
        }
      },
      onCommsMessage: (message) => {
        this.callbacks.onCommsMessage(message);
      },
      onObjectiveUpdate: (title, instructions) => {
        this.callbacks.onObjectiveUpdate(title, instructions);
      },
      onTriggerSequence: (sequence) => {
        this.handleSequence(sequence);
      },
      onComplete: () => {
        this.callbacks.onTutorialComplete();
      },
    });

    this.isActive = true;
    this.callbacks.onNotification('ANCHOR STATION PROMETHEUS', 3000);
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

    // Initial hidden state
    this.interactionPrompt.style.display = 'none';

    document.body.appendChild(this.interactionPrompt);
  }

  private handleSequence(sequence: string): void {
    if (!this.environment) return;

    switch (sequence) {
      case 'equip_suit':
        this.environment.playEquipSuit(() => {
          this.callbacks.onNotification('EVA SUIT EQUIPPED', 2000);
        });
        break;

      case 'depressurize':
        this.environment.playDepressurize(() => {
          // Depressurization complete
        });
        break;

      case 'open_bay_doors':
        this.environment.playOpenBayDoors(() => {
          this.callbacks.onNotification('BAY DOORS OPEN', 2000);
        });
        break;

      case 'enter_pod':
        this.environment.playEnterPod(() => {
          // Lock player in pod position
          this.camera.position.set(0, 1.7, -47);
          this.rotationY = Math.PI; // Face the opening
        });
        break;

      case 'launch':
        this.environment.playLaunch(() => {
          // Tutorial complete - transition to HALO drop
        });
        break;

      case 'start_calibration':
        this.targetsHit = 0;
        this.callbacks.onCalibrationStart?.();
        this.environment.startCalibration({
          onTargetHit: (_targetIndex) => {
            this.targetsHit++;
            this.callbacks.onNotification(`TARGET ${this.targetsHit}/${this.totalTargets}`, 800);
          },
          onAllTargetsHit: () => {
            this.callbacks.onCalibrationEnd?.();
            this.callbacks.onNotification('CALIBRATION COMPLETE', 1500);
            this.tutorialManager.onShootingRangeComplete();
          },
        });
        break;
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.keysPressed.add(e.code);

    // Handle interaction
    if (e.code === 'KeyE' && this.tutorialManager.isInteractStep()) {
      this.tryInteract();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysPressed.delete(e.code);
  }

  private handleMouseMove(e: MouseEvent): void {
    // Mouse look - turn the player when pointer is locked
    if (document.pointerLockElement === this.canvas) {
      const sensitivity = 0.002;
      this.rotationY += e.movementX * sensitivity;
      this.rotationX -= e.movementY * sensitivity;
      this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));
    }
  }

  private handleClick(): void {
    if (this.isActive) {
      // If calibration is active and pointer is locked, try to shoot
      if (this.environment?.isCalibrationActive() && document.pointerLockElement === this.canvas) {
        this.tryShoot();
        return;
      }

      // If showing interaction prompt, try to interact
      if (this.showingPrompt && this.tutorialManager.isInteractStep()) {
        this.tryInteract();
      } else {
        this.canvas.requestPointerLock();
      }
    }
  }

  private tryShoot(): void {
    if (!this.environment?.isCalibrationActive()) return;

    // Get ray from camera center
    const rayOrigin = this.camera.position.clone();
    const rayDirection = this.camera.getDirection(Vector3.Forward());

    // Check for target hit
    this.environment.checkTargetHit(rayOrigin, rayDirection);
  }

  private tryInteract(): void {
    if (this.tutorialManager.tryInteract(this.camera.position)) {
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

  private setupControls(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    document.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('click', this.boundClick);
  }

  private removeControls(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('click', this.boundClick);
  }

  setTouchInput(input: TouchInput | null): void {
    this.touchInput = input;
  }

  update(deltaTime: number): void {
    if (!this.isActive) return;

    // Apply camera rotation - camera follows player turn
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;

    // Movement
    const moveDir = Vector3.Zero();

    if (this.touchInput) {
      // Touch input - movement from left joystick
      const movement = this.touchInput.movement;
      if (Math.abs(movement.x) > 0.1 || Math.abs(movement.y) > 0.1) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Forward()).scale(movement.y));
        moveDir.addInPlace(this.camera.getDirection(Vector3.Right()).scale(movement.x));
      }

      // Touch look from screen drag
      const look = this.touchInput.look;
      if (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001) {
        this.rotationY += look.x;
        this.rotationX -= look.y;
        this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));
      }
    } else {
      // Keyboard
      if (this.keysPressed.has('KeyW')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Forward()));
      }
      if (this.keysPressed.has('KeyS')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Backward()));
      }
      if (this.keysPressed.has('KeyA')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Left()));
      }
      if (this.keysPressed.has('KeyD')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Right()));
      }
    }

    // Apply movement
    if (moveDir.length() > 0) {
      moveDir.normalize();
      moveDir.y = 0;
      moveDir.scaleInPlace(this.moveSpeed * deltaTime);
      this.camera.position.addInPlace(moveDir);
    }

    // Keep at standing height
    this.camera.position.y = 1.7;

    // Clamp to corridor bounds
    const corridorHalfWidth = 4.5;
    const corridorEnd = -53;
    this.camera.position.x = Math.max(
      -corridorHalfWidth,
      Math.min(corridorHalfWidth, this.camera.position.x)
    );
    this.camera.position.z = Math.max(corridorEnd, Math.min(2, this.camera.position.z));

    // Check tutorial objectives
    const lookDir = this.camera.getDirection(Vector3.Forward());
    this.tutorialManager.checkObjective(this.camera.position, lookDir);

    // Show/hide interaction prompt
    if (this.tutorialManager.canPlayerInteract(this.camera.position)) {
      this.showInteractionPrompt();
    } else {
      this.hideInteractionPrompt();
    }

    // Animate objective marker
    if (this.objectiveMarker?.isVisible) {
      this.objectiveMarker.rotation.y += deltaTime * 2;
      // Pulse alpha
      const pulse = 0.3 + Math.sin(performance.now() * 0.003) * 0.15;
      (this.objectiveMarker.material as StandardMaterial).alpha = pulse;
    }
  }

  // Called when player dismisses comms
  onCommsDismissed(): void {
    this.tutorialManager.onCommsDismissed();
  }

  skip(): void {
    this.tutorialManager.skip();
  }

  getCamera(): UniversalCamera {
    return this.camera;
  }

  dispose(): void {
    this.isActive = false;
    this.removeControls();
    this.tutorialManager.dispose();
    this.environment?.dispose();
    this.objectiveMarker?.dispose();
    this.camera.dispose();

    // Remove interaction prompt
    if (this.interactionPrompt?.parentNode) {
      this.interactionPrompt.parentNode.removeChild(this.interactionPrompt);
    }
  }
}
