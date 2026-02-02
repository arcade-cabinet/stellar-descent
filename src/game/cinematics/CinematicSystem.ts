/**
 * CinematicSystem - Level intro cinematics with proper timing and callbacks
 *
 * Provides a comprehensive system for level intro sequences featuring:
 * - Camera path interpolation with cubic easing
 * - Dialogue/subtitle timing synced to sequences
 * - Letterbox bars during cinematics
 * - Fade/flash transitions between scenes
 * - Skip functionality (hold Escape/tap screen)
 * - Save/load handling (cinematics only play once per save)
 */

import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Animations/animatable';

import { getLogger } from '../core/Logger';

const log = getLogger('CinematicSystem');

// ============================================================================
// TYPES
// ============================================================================

/**
 * A keyframe for camera position and target during cinematics.
 */
export interface CameraKeyframe {
  /** Camera position in world space */
  position: Vector3;
  /** Target point the camera looks at */
  target: Vector3;
  /** Time to reach this keyframe from the previous one (ms) */
  duration: number;
  /** Optional FOV override (radians) */
  fov?: number;
}

/**
 * A dialogue line displayed during cinematics.
 */
export interface DialogueLine {
  /** Character name/callsign */
  sender: string;
  /** Short identifier */
  callsign?: string;
  /** Portrait key for UI */
  portrait?: string;
  /** The dialogue text */
  text: string;
}

/**
 * A single step in a cinematic sequence.
 */
export interface CinematicStep {
  /** Duration of this step in milliseconds */
  duration: number;
  /** Optional camera path keyframes for this step */
  cameraPath?: CameraKeyframe[];
  /** Optional dialogue to display */
  dialogue?: DialogueLine;
  /** Optional subtitle text (for non-dialogue captions) */
  subtitle?: string;
  /** Optional action to execute at the start of this step */
  action?: () => void;
  /** Optional camera shake intensity to trigger */
  cameraShake?: number;
  /** Transition effect at the start of this step */
  transition?: 'fade_in' | 'fade_out' | 'flash' | 'crossfade';
  /** Transition duration in ms (default 500) */
  transitionDuration?: number;
}

/**
 * A complete cinematic sequence definition.
 */
export interface CinematicSequence {
  /** Unique identifier for this cinematic (for save tracking) */
  id: string;
  /** The steps that make up this sequence */
  steps: CinematicStep[];
  /** Callback when the cinematic completes (including skip) */
  onComplete: () => void;
  /** Optional callback when cinematic starts */
  onStart?: () => void;
  /** Allow skipping this cinematic (default true) */
  skippable?: boolean;
}

/**
 * Callbacks for cinematic system to communicate with the game.
 */
export interface CinematicCallbacks {
  /** Display a comms message */
  onCommsMessage: (message: {
    sender: string;
    callsign?: string;
    portrait?: string;
    text: string;
  }) => void;
  /** Display a notification */
  onNotification: (text: string, duration?: number) => void;
  /** Update the objective display */
  onObjectiveUpdate: (title: string, instructions: string) => void;
  /** Trigger camera shake */
  onShakeCamera: (intensity: number) => void;
  /** Notify game that cinematic started (disable player input) */
  onCinematicStart: () => void;
  /** Notify game that cinematic ended (re-enable player input) */
  onCinematicEnd: () => void;
}

/**
 * Internal state for managing cinematic playback.
 */
interface CinematicState {
  isPlaying: boolean;
  currentSequence: CinematicSequence | null;
  currentStepIndex: number;
  stepStartTime: number;
  totalElapsed: number;
  canSkip: boolean;
  skipHoldTime: number;
  tapCount: number;
  lastTapTime: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SKIP_HOLD_DURATION = 1000; // Hold Escape for 1 second to skip
const SKIP_TAP_COUNT = 3; // Tap screen 3 times to skip (mobile)
const SKIP_TAP_WINDOW = 1500; // Tap window in ms
const SKIP_PROMPT_DELAY = 2000; // Show skip prompt after 2 seconds
const _LETTERBOX_HEIGHT = 0.08; // Letterbox bar height as fraction of screen
const LETTERBOX_ANIMATION_DURATION = 400; // ms for letterbox animation

// ============================================================================
// CINEMATIC SYSTEM CLASS
// ============================================================================

export class CinematicSystem {
  private scene: Scene;
  private camera: UniversalCamera;
  private callbacks: CinematicCallbacks;

  // State
  private state: CinematicState = {
    isPlaying: false,
    currentSequence: null,
    currentStepIndex: -1,
    stepStartTime: 0,
    totalElapsed: 0,
    canSkip: false,
    skipHoldTime: 0,
    tapCount: 0,
    lastTapTime: 0,
  };

  // Original camera state (for restoration)
  private originalCameraPosition: Vector3 = Vector3.Zero();
  private originalCameraRotation: Vector3 = Vector3.Zero();
  private originalFov: number = 1.2;

  // Visual elements
  private letterboxTop: Mesh | null = null;
  private letterboxBottom: Mesh | null = null;
  private letterboxMaterial: StandardMaterial | null = null;
  private fadeOverlay: Mesh | null = null;
  private fadeMaterial: StandardMaterial | null = null;

  // Skip prompt
  private skipPromptShown = false;
  private skipPromptTimeout: ReturnType<typeof setTimeout> | null = null;

  // Event handlers
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;
  private touchHandler: ((e: TouchEvent) => void) | null = null;

  // Pending timeouts for cleanup
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Viewed cinematics (tracked for save/load)
  private viewedCinematics: Set<string> = new Set();

  constructor(scene: Scene, camera: UniversalCamera, callbacks: CinematicCallbacks) {
    this.scene = scene;
    this.camera = camera;
    this.callbacks = callbacks;

    this.createVisualElements();
    this.setupEventListeners();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Play a cinematic sequence.
   * If the cinematic has already been viewed (in this session or from save),
   * it will be skipped and onComplete called immediately unless forcePlay is true.
   */
  play(sequence: CinematicSequence, forcePlay = false): void {
    // Check if already viewed
    if (!forcePlay && this.viewedCinematics.has(sequence.id)) {
      log.info(`Cinematic "${sequence.id}" already viewed, skipping`);
      sequence.onComplete();
      return;
    }

    if (this.state.isPlaying) {
      log.warn('Cinematic already playing, ignoring new play request');
      return;
    }

    log.info(`Starting cinematic: ${sequence.id}`);

    // Store original camera state
    this.originalCameraPosition = this.camera.position.clone();
    this.originalCameraRotation = this.camera.rotation.clone();
    this.originalFov = this.camera.fov;

    // Initialize state
    this.state = {
      isPlaying: true,
      currentSequence: sequence,
      currentStepIndex: -1,
      stepStartTime: performance.now(),
      totalElapsed: 0,
      canSkip: sequence.skippable !== false,
      skipHoldTime: 0,
      tapCount: 0,
      lastTapTime: 0,
    };

    // Notify game
    this.callbacks.onCinematicStart();

    // Show letterbox bars
    this.showLetterbox();

    // Call onStart if provided
    sequence.onStart?.();

    // Schedule skip prompt
    if (this.state.canSkip) {
      this.skipPromptTimeout = setTimeout(() => {
        if (this.state.isPlaying && !this.skipPromptShown) {
          this.callbacks.onNotification('Hold [ESC] to skip', 3000);
          this.skipPromptShown = true;
        }
      }, SKIP_PROMPT_DELAY);
      this.pendingTimeouts.push(this.skipPromptTimeout);
    }

    // Start first step
    this.advanceToNextStep();
  }

  /**
   * Update the cinematic system. Call this every frame.
   */
  update(deltaTime: number): void {
    if (!this.state.isPlaying || !this.state.currentSequence) return;

    const now = performance.now();
    this.state.totalElapsed += deltaTime * 1000;

    // Check if current step is complete
    const currentStep = this.state.currentSequence.steps[this.state.currentStepIndex];
    if (currentStep) {
      const stepElapsed = now - this.state.stepStartTime;
      if (stepElapsed >= currentStep.duration) {
        this.advanceToNextStep();
      }
    }

    // Update fade overlay
    this.updateFadeOverlay(deltaTime);
  }

  /**
   * Check if a cinematic is currently playing.
   */
  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * Mark a cinematic as viewed (for save/load).
   */
  markViewed(cinematicId: string): void {
    this.viewedCinematics.add(cinematicId);
  }

  /**
   * Get list of viewed cinematic IDs (for saving).
   */
  getViewedCinematics(): string[] {
    return Array.from(this.viewedCinematics);
  }

  /**
   * Set viewed cinematics from save data.
   */
  setViewedCinematics(cinematicIds: string[]): void {
    this.viewedCinematics = new Set(cinematicIds);
  }

  /**
   * Clear all viewed cinematics (for new game).
   */
  clearViewedCinematics(): void {
    this.viewedCinematics.clear();
  }

  /**
   * Dispose the cinematic system and clean up resources.
   */
  dispose(): void {
    this.stop();
    this.removeEventListeners();

    // Clear timeouts
    for (const timeout of this.pendingTimeouts) {
      clearTimeout(timeout);
    }
    this.pendingTimeouts = [];

    // Dispose visual elements
    this.letterboxTop?.dispose();
    this.letterboxBottom?.dispose();
    this.letterboxMaterial?.dispose();
    this.fadeOverlay?.dispose();
    this.fadeMaterial?.dispose();

    this.letterboxTop = null;
    this.letterboxBottom = null;
    this.letterboxMaterial = null;
    this.fadeOverlay = null;
    this.fadeMaterial = null;
  }

  // ============================================================================
  // STEP MANAGEMENT
  // ============================================================================

  private advanceToNextStep(): void {
    if (!this.state.currentSequence) return;

    this.state.currentStepIndex++;
    this.state.stepStartTime = performance.now();

    // Check if sequence is complete
    if (this.state.currentStepIndex >= this.state.currentSequence.steps.length) {
      this.completeSequence();
      return;
    }

    const step = this.state.currentSequence.steps[this.state.currentStepIndex];
    this.executeStep(step);
  }

  private executeStep(step: CinematicStep): void {
    // Handle transition
    if (step.transition) {
      this.executeTransition(step.transition, step.transitionDuration ?? 500);
    }

    // Execute action
    if (step.action) {
      step.action();
    }

    // Trigger camera shake
    if (step.cameraShake) {
      this.callbacks.onShakeCamera(step.cameraShake);
    }

    // Display dialogue
    if (step.dialogue) {
      this.callbacks.onCommsMessage({
        sender: step.dialogue.sender,
        callsign: step.dialogue.callsign,
        portrait: step.dialogue.portrait,
        text: step.dialogue.text,
      });
    }

    // Display subtitle
    if (step.subtitle) {
      this.callbacks.onNotification(step.subtitle, step.duration);
    }

    // Animate camera path
    if (step.cameraPath && step.cameraPath.length > 0) {
      this.animateCameraPath(step.cameraPath, step.duration);
    }
  }

  private completeSequence(): void {
    if (!this.state.currentSequence) return;

    const sequence = this.state.currentSequence;

    // Mark as viewed
    this.viewedCinematics.add(sequence.id);

    // Hide letterbox
    this.hideLetterbox();

    // Hide fade overlay (may still be visible after a fade_out transition)
    if (this.fadeOverlay) {
      this.fadeOverlay.isVisible = false;
      this.fadeOverlay.parent = null;
    }
    if (this.fadeMaterial) {
      this.fadeMaterial.alpha = 0;
    }

    // Restore camera
    this.restoreCamera();

    // Clear state
    this.state.isPlaying = false;
    this.state.currentSequence = null;
    this.state.currentStepIndex = -1;

    // Clear skip prompt state
    this.skipPromptShown = false;
    if (this.skipPromptTimeout) {
      clearTimeout(this.skipPromptTimeout);
      this.skipPromptTimeout = null;
    }

    // Notify game
    this.callbacks.onCinematicEnd();

    // Call completion callback
    log.info(`Cinematic complete: ${sequence.id}`);
    sequence.onComplete();
  }

  // ============================================================================
  // CAMERA ANIMATION
  // ============================================================================

  private animateCameraPath(keyframes: CameraKeyframe[], totalDuration: number): void {
    if (keyframes.length === 0) return;

    // For single keyframe, animate directly to it
    if (keyframes.length === 1) {
      this.animateCameraTo(
        keyframes[0].position,
        keyframes[0].target,
        totalDuration,
        keyframes[0].fov
      );
      return;
    }

    // Schedule camera moves for each keyframe
    let cumulativeTime = 0;
    for (let i = 0; i < keyframes.length; i++) {
      const keyframe = keyframes[i];

      if (i === 0) {
        // Set initial position immediately
        this.camera.position = keyframe.position.clone();
        this.lookAt(keyframe.target);
        if (keyframe.fov) this.camera.fov = keyframe.fov;
        continue;
      }

      const delay = cumulativeTime;
      cumulativeTime += keyframe.duration;

      const timeout = setTimeout(() => {
        if (!this.state.isPlaying) return;
        this.animateCameraTo(keyframe.position, keyframe.target, keyframe.duration, keyframe.fov);
      }, delay);

      this.pendingTimeouts.push(timeout);
    }
  }

  private animateCameraTo(
    position: Vector3,
    target: Vector3,
    duration: number,
    fov?: number
  ): void {
    const frameRate = 60;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    // Position animation
    const posAnim = new Animation(
      'cinematicCameraPosAnim',
      'position',
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    posAnim.setEasingFunction(easing);

    posAnim.setKeys([
      { frame: 0, value: this.camera.position.clone() },
      { frame: totalFrames, value: position },
    ]);

    this.camera.animations = [];
    this.camera.animations.push(posAnim);

    // FOV animation if specified
    if (fov !== undefined) {
      const fovAnim = new Animation(
        'cinematicCameraFovAnim',
        'fov',
        frameRate,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      fovAnim.setEasingFunction(easing);
      fovAnim.setKeys([
        { frame: 0, value: this.camera.fov },
        { frame: totalFrames, value: fov },
      ]);
      this.camera.animations.push(fovAnim);
    }

    // Animate rotation to look at target
    this.animateLookAt(target, duration);

    this.scene.beginAnimation(this.camera, 0, totalFrames, false);
  }

  private animateLookAt(target: Vector3, duration: number): void {
    const direction = target.subtract(this.camera.position);
    const targetRotationY = Math.atan2(direction.x, direction.z);
    const horizontalDistance = Math.sqrt(direction.x ** 2 + direction.z ** 2);
    const targetRotationX = -Math.atan2(direction.y, horizontalDistance);

    const frameRate = 60;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    // Rotation Y animation
    const rotYAnim = new Animation(
      'cinematicCameraRotYAnim',
      'rotation.y',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rotYAnim.setEasingFunction(easing);
    rotYAnim.setKeys([
      { frame: 0, value: this.camera.rotation.y },
      { frame: totalFrames, value: targetRotationY },
    ]);
    this.camera.animations.push(rotYAnim);

    // Rotation X animation
    const rotXAnim = new Animation(
      'cinematicCameraRotXAnim',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rotXAnim.setEasingFunction(easing);
    rotXAnim.setKeys([
      { frame: 0, value: this.camera.rotation.x },
      { frame: totalFrames, value: targetRotationX },
    ]);
    this.camera.animations.push(rotXAnim);
  }

  private lookAt(target: Vector3): void {
    const direction = target.subtract(this.camera.position);
    this.camera.rotation.y = Math.atan2(direction.x, direction.z);
    const horizontalDistance = Math.sqrt(direction.x ** 2 + direction.z ** 2);
    this.camera.rotation.x = -Math.atan2(direction.y, horizontalDistance);
  }

  private restoreCamera(): void {
    // Smooth transition back to gameplay camera
    this.animateCameraTo(
      this.originalCameraPosition,
      this.originalCameraPosition.add(
        new Vector3(
          Math.sin(this.originalCameraRotation.y),
          0,
          Math.cos(this.originalCameraRotation.y)
        ).scale(10)
      ),
      800,
      this.originalFov
    );
  }

  // ============================================================================
  // VISUAL ELEMENTS
  // ============================================================================

  private createVisualElements(): void {
    // Create letterbox bars
    this.letterboxMaterial = new StandardMaterial('cinematicLetterboxMat', this.scene);
    this.letterboxMaterial.diffuseColor = Color3.Black();
    this.letterboxMaterial.emissiveColor = Color3.Black();
    this.letterboxMaterial.disableLighting = true;

    this.letterboxTop = MeshBuilder.CreatePlane(
      'cinematicLetterboxTop',
      { width: 10, height: 1 },
      this.scene
    );
    this.letterboxTop.material = this.letterboxMaterial;
    this.letterboxTop.isVisible = false;
    this.letterboxTop.renderingGroupId = 3;

    this.letterboxBottom = MeshBuilder.CreatePlane(
      'cinematicLetterboxBottom',
      { width: 10, height: 1 },
      this.scene
    );
    this.letterboxBottom.material = this.letterboxMaterial;
    this.letterboxBottom.isVisible = false;
    this.letterboxBottom.renderingGroupId = 3;

    // Create fade overlay
    this.fadeMaterial = new StandardMaterial('cinematicFadeMat', this.scene);
    this.fadeMaterial.diffuseColor = Color3.Black();
    this.fadeMaterial.emissiveColor = Color3.Black();
    this.fadeMaterial.alpha = 0;
    this.fadeMaterial.disableLighting = true;

    this.fadeOverlay = MeshBuilder.CreatePlane(
      'cinematicFadeOverlay',
      { width: 10, height: 10 },
      this.scene
    );
    this.fadeOverlay.material = this.fadeMaterial;
    this.fadeOverlay.isVisible = false;
    this.fadeOverlay.renderingGroupId = 3;
  }

  private showLetterbox(): void {
    if (!this.letterboxTop || !this.letterboxBottom) return;

    // Position letterbox bars relative to camera
    this.letterboxTop.parent = this.camera;
    this.letterboxBottom.parent = this.camera;

    this.letterboxTop.position.set(0, 0.8, 2);
    this.letterboxBottom.position.set(0, -0.8, 2);

    this.letterboxTop.scaling.y = 0.01;
    this.letterboxBottom.scaling.y = 0.01;

    this.letterboxTop.isVisible = true;
    this.letterboxBottom.isVisible = true;

    // Animate letterbox bars sliding in
    const frameRate = 60;
    const totalFrames = Math.round((LETTERBOX_ANIMATION_DURATION / 1000) * frameRate);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

    for (const bar of [this.letterboxTop, this.letterboxBottom]) {
      const scaleAnim = new Animation(
        'letterboxScale',
        'scaling.y',
        frameRate,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      scaleAnim.setEasingFunction(easing);
      scaleAnim.setKeys([
        { frame: 0, value: 0.01 },
        { frame: totalFrames, value: 0.2 },
      ]);
      bar.animations = [scaleAnim];
      this.scene.beginAnimation(bar, 0, totalFrames, false);
    }
  }

  private hideLetterbox(): void {
    if (!this.letterboxTop || !this.letterboxBottom) return;

    const frameRate = 60;
    const totalFrames = Math.round((LETTERBOX_ANIMATION_DURATION / 1000) * frameRate);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN);

    for (const bar of [this.letterboxTop, this.letterboxBottom]) {
      const scaleAnim = new Animation(
        'letterboxHideScale',
        'scaling.y',
        frameRate,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      scaleAnim.setEasingFunction(easing);
      scaleAnim.setKeys([
        { frame: 0, value: bar.scaling.y },
        { frame: totalFrames, value: 0.01 },
      ]);
      bar.animations = [scaleAnim];
      this.scene.beginAnimation(bar, 0, totalFrames, false, 1, () => {
        bar.isVisible = false;
        bar.parent = null;
      });
    }
  }

  // ============================================================================
  // TRANSITIONS
  // ============================================================================

  private executeTransition(type: string, duration: number): void {
    switch (type) {
      case 'fade_in':
        this.fadeIn(duration);
        break;
      case 'fade_out':
        this.fadeOut(duration);
        break;
      case 'flash':
        this.flash(duration);
        break;
      case 'crossfade': {
        // For crossfade, do a quick fade out then fade in
        this.fadeOut(duration / 2);
        const crossfadeTimeout = setTimeout(() => this.fadeIn(duration / 2), duration / 2);
        this.pendingTimeouts.push(crossfadeTimeout);
        break;
      }
    }
  }

  private fadeIn(duration: number): void {
    if (!this.fadeOverlay || !this.fadeMaterial) return;

    this.fadeMaterial.alpha = 1;
    this.fadeOverlay.isVisible = true;
    this.fadeOverlay.parent = this.camera;
    this.fadeOverlay.position.set(0, 0, 2);

    const frameRate = 60;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

    const fadeAnim = new Animation(
      'fadeInAnim',
      'alpha',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setEasingFunction(easing);
    fadeAnim.setKeys([
      { frame: 0, value: 1 },
      { frame: totalFrames, value: 0 },
    ]);
    this.fadeMaterial.animations = [fadeAnim];
    this.scene.beginAnimation(this.fadeMaterial, 0, totalFrames, false, 1, () => {
      if (this.fadeOverlay) {
        this.fadeOverlay.isVisible = false;
        this.fadeOverlay.parent = null;
      }
    });
  }

  private fadeOut(duration: number): void {
    if (!this.fadeOverlay || !this.fadeMaterial) return;

    this.fadeMaterial.alpha = 0;
    this.fadeOverlay.isVisible = true;
    this.fadeOverlay.parent = this.camera;
    this.fadeOverlay.position.set(0, 0, 2);

    const frameRate = 60;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN);

    const fadeAnim = new Animation(
      'fadeOutAnim',
      'alpha',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setEasingFunction(easing);
    fadeAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: totalFrames, value: 1 },
    ]);
    this.fadeMaterial.animations = [fadeAnim];
    this.scene.beginAnimation(this.fadeMaterial, 0, totalFrames, false);
  }

  private flash(duration: number): void {
    if (!this.fadeOverlay || !this.fadeMaterial) return;

    this.fadeMaterial.diffuseColor = Color3.White();
    this.fadeMaterial.emissiveColor = Color3.White();
    this.fadeMaterial.alpha = 1;
    this.fadeOverlay.isVisible = true;
    this.fadeOverlay.parent = this.camera;
    this.fadeOverlay.position.set(0, 0, 2);

    const frameRate = 60;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    const fadeAnim = new Animation(
      'flashAnim',
      'alpha',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setKeys([
      { frame: 0, value: 1 },
      { frame: totalFrames, value: 0 },
    ]);
    this.fadeMaterial.animations = [fadeAnim];
    this.scene.beginAnimation(this.fadeMaterial, 0, totalFrames, false, 1, () => {
      if (this.fadeMaterial) {
        this.fadeMaterial.diffuseColor = Color3.Black();
        this.fadeMaterial.emissiveColor = Color3.Black();
      }
      if (this.fadeOverlay) {
        this.fadeOverlay.isVisible = false;
        this.fadeOverlay.parent = null;
      }
    });
  }

  private updateFadeOverlay(_deltaTime: number): void {
    // Future: could animate fade overlay colors or effects here
  }

  // ============================================================================
  // SKIP FUNCTIONALITY
  // ============================================================================

  private setupEventListeners(): void {
    this.keyDownHandler = (e: KeyboardEvent) => {
      if (!this.state.isPlaying || !this.state.canSkip) return;

      if (e.code === 'Escape') {
        this.state.skipHoldTime = performance.now();
      }
    };

    this.keyUpHandler = (e: KeyboardEvent) => {
      if (!this.state.isPlaying || !this.state.canSkip) return;

      if (e.code === 'Escape' && this.state.skipHoldTime > 0) {
        const holdDuration = performance.now() - this.state.skipHoldTime;
        if (holdDuration >= SKIP_HOLD_DURATION) {
          this.skip();
        }
        this.state.skipHoldTime = 0;
      }
    };

    this.touchHandler = (_e: TouchEvent) => {
      if (!this.state.isPlaying || !this.state.canSkip) return;

      const now = performance.now();

      // Reset tap count if window expired
      if (now - this.state.lastTapTime > SKIP_TAP_WINDOW) {
        this.state.tapCount = 0;
      }

      this.state.tapCount++;
      this.state.lastTapTime = now;

      if (this.state.tapCount >= SKIP_TAP_COUNT) {
        this.skip();
      }
    };

    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    document.addEventListener('touchstart', this.touchHandler);
  }

  private removeEventListeners(): void {
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }
    if (this.keyUpHandler) {
      document.removeEventListener('keyup', this.keyUpHandler);
      this.keyUpHandler = null;
    }
    if (this.touchHandler) {
      document.removeEventListener('touchstart', this.touchHandler);
      this.touchHandler = null;
    }
  }

  /**
   * Skip the current cinematic.
   */
  skip(): void {
    if (!this.state.isPlaying) return;

    log.info('Cinematic skipped');
    this.callbacks.onNotification('CINEMATIC SKIPPED', 1500);

    // Stop all camera animations
    this.scene.stopAllAnimations();

    // Complete the sequence (triggers onComplete)
    this.completeSequence();
  }

  /**
   * Stop the cinematic without triggering completion.
   * Use this for cleanup when the level is disposed during a cinematic.
   */
  stop(): void {
    if (!this.state.isPlaying) return;

    this.scene.stopAllAnimations();

    // Clear state
    this.state.isPlaying = false;
    this.state.currentSequence = null;
    this.state.currentStepIndex = -1;

    // Hide visual elements
    if (this.letterboxTop) this.letterboxTop.isVisible = false;
    if (this.letterboxBottom) this.letterboxBottom.isVisible = false;
    if (this.fadeOverlay) this.fadeOverlay.isVisible = false;

    // Clear timeouts
    for (const timeout of this.pendingTimeouts) {
      clearTimeout(timeout);
    }
    this.pendingTimeouts = [];

    // Clear skip prompt
    this.skipPromptShown = false;
    if (this.skipPromptTimeout) {
      clearTimeout(this.skipPromptTimeout);
      this.skipPromptTimeout = null;
    }
  }
}

// ============================================================================
// LEVEL-SPECIFIC CINEMATIC DEFINITIONS
// ============================================================================

/**
 * Create the Anchor Station intro cinematic sequence (15 seconds).
 * - Pan across station exterior
 * - Cut to player in cryo pod
 * - Alarm sounds, pod opens
 * - Tutorial prompt appears
 */
export function createAnchorStationIntroCinematic(
  onComplete: () => void,
  playerSpawnPosition: Vector3
): CinematicSequence {
  return {
    id: 'anchor_station_intro',
    steps: [
      {
        duration: 3000,
        cameraPath: [
          {
            // Start inside the station: hangar end looking north through corridors
            position: new Vector3(0, 2.5, -64),
            target: new Vector3(0, 2, -40),
            duration: 0,
            fov: 1.4,
          },
          {
            // Sweep through the corridor toward the briefing room
            position: new Vector3(0, 2.5, -20),
            target: new Vector3(0, 2, 0),
            duration: 3000,
            fov: 1.2,
          },
        ],
        dialogue: {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: "Anchor Station Prometheus, geosynchronous orbit above Kepler's Promise.",
        },
        transition: 'fade_in',
        transitionDuration: 1000,
      },
      {
        duration: 3000,
        cameraPath: [
          {
            position: new Vector3(0, 1.5, 2),
            target: new Vector3(0, 1.5, 0),
            duration: 500,
            fov: 0.9,
          },
        ],
        dialogue: {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Sergeant James Cole, initiating cryo-revival sequence.',
        },
        transition: 'crossfade',
        transitionDuration: 500,
      },
      {
        duration: 4000,
        action: () => {
          // This would trigger the cryo pod opening animation in the level
        },
        cameraShake: 2,
        subtitle: '[ALARM KLAXON SOUNDS]',
      },
      {
        duration: 3000,
        cameraPath: [
          {
            // End looking SOUTH (-Z) into the station corridors, not north into space
            position: playerSpawnPosition.clone(),
            target: playerSpawnPosition.add(new Vector3(0, 0, -5)),
            duration: 2000,
            fov: 1.2,
          },
        ],
        dialogue: {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Revival complete. Proceed to the briefing room, Sergeant.',
        },
      },
      {
        duration: 2000,
        transition: 'fade_out',
        transitionDuration: 500,
      },
    ],
    onComplete,
    skippable: true,
  };
}

/**
 * Create the Landfall intro cinematic sequence (12 seconds).
 * - Dropship descending through atmosphere
 * - Player view from inside looking out window
 * - "30 seconds to LZ" radio chatter
 * - Hard landing, door opens
 */
export function createLandfallIntroCinematic(
  onComplete: () => void,
  planetPosition: Vector3
): CinematicSequence {
  return {
    id: 'landfall_intro',
    steps: [
      {
        duration: 3000,
        cameraPath: [
          {
            position: new Vector3(0, 500, 50),
            target: planetPosition,
            duration: 0,
            fov: 1.6,
          },
          {
            position: new Vector3(0, 400, 30),
            target: planetPosition,
            duration: 3000,
            fov: 1.4,
          },
        ],
        dialogue: {
          sender: 'Dropship Pilot',
          callsign: 'PHOENIX',
          portrait: 'player',
          text: "Drop pod away! You're going in hot, Sergeant!",
        },
        transition: 'fade_in',
        transitionDuration: 800,
        cameraShake: 1,
      },
      {
        duration: 3000,
        cameraPath: [
          {
            position: new Vector3(0, 300, 0),
            target: planetPosition,
            duration: 3000,
            fov: 1.3,
          },
        ],
        cameraShake: 2,
        subtitle: '[ATMOSPHERIC ENTRY - TURBULENCE INCREASING]',
      },
      {
        duration: 3000,
        dialogue: {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: '30 seconds to LZ. Brace for impact. Good luck, Sergeant.',
        },
        cameraShake: 3,
      },
      {
        duration: 3000,
        transition: 'flash',
        transitionDuration: 300,
        cameraShake: 5,
        subtitle: '[HARD LANDING]',
      },
    ],
    onComplete,
    skippable: true,
  };
}

/**
 * Create The Breach intro cinematic sequence (20 seconds).
 * - Approach to Queen's chamber
 * - Camera slowly reveals Queen's scale
 * - Queen roars, screen shakes
 * - "This is it. For humanity." dialogue
 */
export function createTheBreachIntroCinematic(
  onComplete: () => void,
  queenPosition: Vector3
): CinematicSequence {
  return {
    id: 'the_breach_intro',
    steps: [
      {
        duration: 4000,
        cameraPath: [
          {
            position: new Vector3(0, 2, queenPosition.z + 50),
            target: new Vector3(0, 0, queenPosition.z + 30),
            duration: 0,
            fov: 1.0,
          },
          {
            position: new Vector3(0, 3, queenPosition.z + 35),
            target: new Vector3(0, 5, queenPosition.z),
            duration: 4000,
            fov: 1.2,
          },
        ],
        dialogue: {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Massive bio-signature detected ahead. This is it, Sergeant. The heart of the hive.',
        },
        transition: 'fade_in',
        transitionDuration: 1000,
      },
      {
        duration: 5000,
        cameraPath: [
          {
            position: new Vector3(-10, 8, queenPosition.z + 20),
            target: queenPosition.clone().addInPlace(new Vector3(0, 10, 0)),
            duration: 5000,
            fov: 1.5,
          },
        ],
        subtitle: '[MASSIVE CREATURE DETECTED]',
      },
      {
        duration: 4000,
        action: () => {
          // This would trigger the Queen awakening animation
        },
        cameraShake: 6,
        subtitle: '[DEAFENING ROAR]',
      },
      {
        duration: 4000,
        dialogue: {
          sender: 'Sergeant James Cole',
          callsign: 'SPECTER',
          portrait: 'player',
          text: 'This is it. For Marcus. For humanity. No retreat.',
        },
        cameraPath: [
          {
            position: new Vector3(0, 2, queenPosition.z + 45),
            target: queenPosition.clone().addInPlace(new Vector3(0, 8, 0)),
            duration: 4000,
            fov: 1.2,
          },
        ],
      },
      {
        duration: 3000,
        dialogue: {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: "Queen's weak points will be revealed when scanned. Stay mobile, Sergeant.",
        },
        transition: 'fade_out',
        transitionDuration: 500,
      },
    ],
    onComplete,
    skippable: true,
  };
}

/**
 * Create the Final Escape intro cinematic sequence (10 seconds).
 * - Hive collapsing around player
 * - "Extraction inbound, get to the surface!"
 * - Rumbling, debris falling
 */
export function createFinalEscapeIntroCinematic(
  onComplete: () => void,
  playerStartPosition: Vector3
): CinematicSequence {
  return {
    id: 'final_escape_intro',
    steps: [
      {
        duration: 3000,
        cameraPath: [
          {
            position: playerStartPosition.add(new Vector3(0, 5, 10)),
            target: playerStartPosition,
            duration: 0,
            fov: 1.3,
          },
          {
            position: playerStartPosition.add(new Vector3(0, 3, 5)),
            target: playerStartPosition,
            duration: 3000,
            fov: 1.2,
          },
        ],
        cameraShake: 4,
        subtitle: '[HIVE DESTABILIZING - STRUCTURAL COLLAPSE IMMINENT]',
        transition: 'fade_in',
        transitionDuration: 500,
      },
      {
        duration: 4000,
        dialogue: {
          sender: 'Corporal Marcus Cole',
          callsign: 'HAMMER',
          portrait: 'marcus',
          text: 'James! The hive is collapsing! Extraction shuttle inbound - GET TO THE SURFACE NOW!',
        },
        cameraShake: 5,
      },
      {
        duration: 3000,
        dialogue: {
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Vehicle located. Timer initiated. 4 minutes to planetary collapse.',
        },
        cameraPath: [
          {
            position: playerStartPosition.clone(),
            target: playerStartPosition.add(new Vector3(0, 0, -50)),
            duration: 2500,
            fov: 1.2,
          },
        ],
        transition: 'fade_out',
        transitionDuration: 500,
      },
    ],
    onComplete,
    skippable: true,
  };
}
