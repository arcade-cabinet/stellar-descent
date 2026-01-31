/**
 * BrothersInArms - Cinematic Sequences
 *
 * MARCUS REUNION CINEMATIC:
 * A powerful emotional moment where the player finally reunites with their
 * younger brother Marcus, piloting the massive HAMMER Titan mech.
 *
 * The cinematic features:
 * - Marcus emerging dramatically from behind cover/rubble
 * - Smooth camera transitions that frame the emotional reunion
 * - Debris and dust effects as Marcus's mech rises
 * - Carefully timed dialogue building to an emotional crescendo
 * - Marcus joining as AI companion after the cinematic
 *
 * The cinematic uses Babylon.js Animation system for smooth keyframed
 * camera movement, with cubic easing for cinematic feel.
 */

import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { CommsMessage } from '../../types';

// Import animation module for easing
import '@babylonjs/core/Animations/animatable';

// ============================================================================
// TYPES
// ============================================================================

export interface CinematicCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onNotification: (text: string, duration?: number) => void;
  onObjectiveUpdate: (title: string, instructions: string) => void;
  onCinematicStart?: () => void;
  onCinematicEnd?: () => void;
  onShakeCamera: (intensity: number) => void;
  onSkipCinematic?: () => void; // Allow cinematic skip
}

export interface CinematicState {
  isPlaying: boolean;
  currentBeat: number;
  startTime: number;
  playerControlEnabled: boolean;
}

// ============================================================================
// DIALOGUE DEFINITIONS
// ============================================================================

const MARCUS_CHARACTER: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'HAMMER',
  portrait: 'marcus',
};

const JAMES_CHARACTER: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Sergeant James Cole',
  callsign: 'SPECTER',
  portrait: 'player',
};

const ATHENA_CHARACTER: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'PROMETHEUS A.I.',
  callsign: 'ATHENA',
  portrait: 'ai',
};

// Reunion dialogue sequence - emotional reunion between brothers
// The dialogue builds from tension to relief to determination, creating
// an emotional arc that establishes Marcus as both a character and ally.
export const REUNION_DIALOGUE: Array<{
  character: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'>;
  text: string;
  delay: number; // ms from cinematic start
  cameraShake?: number; // optional camera shake intensity
  marcusAction?: 'emerge' | 'stand' | 'arm_weapons' | 'face_breach'; // Marcus animation triggers
}> = [
  {
    // Beat 1: Detection - AI confirms the reading, builds anticipation
    character: ATHENA_CHARACTER,
    text: "Titan-class mech signature detected ahead. IFF confirms friendly... It's him, Sergeant. It's Marcus.",
    delay: 1500,
  },
  {
    // Beat 2: Emergence - Marcus rises from cover, dust and debris falling
    character: MARCUS_CHARACTER,
    text: 'James? JAMES! You actually came...',
    delay: 5000,
    marcusAction: 'emerge',
    cameraShake: 3,
  },
  {
    // Beat 3: Relief and emotion - Marcus's voice breaks slightly
    character: MARCUS_CHARACTER,
    text: "I... I didn't think anyone was coming. Command stopped responding three days ago. I thought I was alone.",
    delay: 9500,
    marcusAction: 'stand',
  },
  {
    // Beat 4: James's determination - the protective older brother
    character: JAMES_CHARACTER,
    text: "I told you I'd always have your back, little brother. No force in this galaxy was keeping me from finding you.",
    delay: 15500,
  },
  {
    // Beat 5: Marcus composes himself, soldier mode returning
    character: MARCUS_CHARACTER,
    text: "It's good to hear your voice. It's been... rough. Lost contact with everyone at FOB Delta. I've been holding this position alone.",
    delay: 22000,
  },
  {
    // Beat 6: James probes for intel - establish the threat
    character: JAMES_CHARACTER,
    text: "We found what's left of Delta. What happened here, Marcus? What are we fighting?",
    delay: 28500,
  },
  {
    // Beat 7: The reveal - Marcus describes the horror
    character: MARCUS_CHARACTER,
    text: 'They came from below. From that pit. Thousands of them, crawling out like nightmares given form.',
    delay: 33000,
    marcusAction: 'face_breach',
    cameraShake: 1,
  },
  {
    // Beat 8: The queen - key narrative hook for the campaign
    character: MARCUS_CHARACTER,
    text: "There's something down there... controlling them. A queen. I've seen it through the thermals. Massive. Ancient.",
    delay: 39000,
    cameraShake: 2,
  },
  {
    // Beat 9: AI warning - transition to combat
    character: ATHENA_CHARACTER,
    text: 'Warning: Multiple hostile signatures converging on your position. Threat level critical. Recommend immediate defensive posture.',
    delay: 46000,
  },
  {
    // Beat 10: Marcus arms up - the brothers ready for battle
    character: MARCUS_CHARACTER,
    text: "Here they come again. Stay close, James. Like the Europa job - you spot 'em, I'll hammer 'em.",
    delay: 50500,
    marcusAction: 'arm_weapons',
    cameraShake: 1,
  },
];

// ============================================================================
// CINEMATIC CAMERA POSITIONS
// ============================================================================

interface CameraKeyframe {
  position: Vector3;
  target: Vector3; // What the camera looks at
  duration: number; // Duration to reach this keyframe (ms)
  fov?: number;
}

// Marcus starting position (behind cover) and final standing position
const MARCUS_COVER_POSITION = new Vector3(15, -2, 10); // Crouched/hidden behind rock
const MARCUS_STAND_POSITION = new Vector3(15, 0, 10); // Full standing height

// Cinematic camera path for Marcus reunion - 7 keyframes across ~55 seconds
const REUNION_CAMERA_PATH: CameraKeyframe[] = [
  // Beat 1: Start wide - player approaches canyon, rock pile visible ahead
  // Duration: 0ms (initial position)
  {
    position: new Vector3(0, 3, 60),
    target: new Vector3(15, 2, 10), // Looking at cover where Marcus hides
    duration: 0,
    fov: 1.4,
  },
  // Beat 2: Slow push toward the rock formation as Athena detects Marcus
  // Duration: 4000ms - builds anticipation
  {
    position: new Vector3(-5, 2.5, 45),
    target: new Vector3(15, 3, 10),
    duration: 4000,
    fov: 1.25,
  },
  // Beat 3: Marcus emerges! Camera reacts - slight pull back and up for drama
  // Duration: 3000ms - the reveal moment, Marcus rises from cover
  {
    position: new Vector3(0, 4, 35),
    target: new Vector3(15, 6, 10), // Rising to track his full height
    duration: 3000,
    fov: 1.15,
  },
  // Beat 4: Close-up on Marcus cockpit as emotional dialogue plays
  // Duration: 8000ms - intimate moment, showing the mech's cockpit
  {
    position: new Vector3(10, 6, 18),
    target: new Vector3(15, 7, 10),
    duration: 8000,
    fov: 0.85,
  },
  // Beat 5: Two-shot - pull back to show James and Marcus together
  // Duration: 12000ms - brothers reunited, long hold for dialogue
  {
    position: new Vector3(-12, 3, 32),
    target: new Vector3(8, 4, 15),
    duration: 12000,
    fov: 1.3,
  },
  // Beat 6: Look toward the Breach as Marcus describes the horror
  // Duration: 10000ms - dramatic reveal of the pit
  {
    position: new Vector3(0, 5, 15),
    target: new Vector3(0, -8, -60),
    duration: 10000,
    fov: 1.5,
  },
  // Beat 7: Return to gameplay position - Marcus arms up
  // Duration: 4000ms - transition back to action
  {
    position: new Vector3(0, 1.7, 50),
    target: new Vector3(15, 4, 10), // Looking toward Marcus
    duration: 4000,
    fov: 1.2,
  },
];

// ============================================================================
// CINEMATIC MANAGER
// ============================================================================

export class ReunionCinematic {
  private scene: Scene;
  private camera: UniversalCamera;
  private callbacks: CinematicCallbacks;
  private marcusRoot: TransformNode | null = null;

  private state: CinematicState = {
    isPlaying: false,
    currentBeat: 0,
    startTime: 0,
    playerControlEnabled: false,
  };

  // Visual effects
  private spotlightOnMarcus: PointLight | null = null;
  private dustParticles: Mesh[] = [];
  private debrisParticles: Mesh[] = [];
  private coverRubble: Mesh[] = [];
  private dialogueTimeouts: ReturnType<typeof setTimeout>[] = [];
  private animationTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Original camera state (for restoration)
  private originalCameraPosition: Vector3 = Vector3.Zero();
  private originalCameraRotation: Vector3 = Vector3.Zero();
  private originalFov: number = 1.2;

  // Marcus emergence state
  private marcusOriginalY: number = 0;
  private marcusHasEmerged: boolean = false;

  // Skip functionality
  private canSkip: boolean = false;
  private skipPromptShown: boolean = false;
  private skipKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    scene: Scene,
    camera: UniversalCamera,
    callbacks: CinematicCallbacks,
    marcusRoot: TransformNode | null
  ) {
    this.scene = scene;
    this.camera = camera;
    this.callbacks = callbacks;
    this.marcusRoot = marcusRoot;
  }

  /**
   * Start the Marcus reunion cinematic sequence
   */
  play(): void {
    if (this.state.isPlaying) return;

    this.state = {
      isPlaying: true,
      currentBeat: 0,
      startTime: performance.now(),
      playerControlEnabled: false,
    };

    // Store original camera state
    this.originalCameraPosition = this.camera.position.clone();
    this.originalCameraRotation = this.camera.rotation.clone();
    this.originalFov = this.camera.fov;

    // Store Marcus's original position and hide him behind cover
    if (this.marcusRoot) {
      this.marcusOriginalY = this.marcusRoot.position.y;
      // Lower Marcus below ground/behind cover initially
      this.marcusRoot.position.y = MARCUS_COVER_POSITION.y;
      this.marcusHasEmerged = false;
    }

    // Notify cinematic start (disables player input)
    this.callbacks.onCinematicStart?.();
    this.callbacks.onNotification('MARCUS LOCATED', 2000);
    this.callbacks.onObjectiveUpdate('REUNION', 'Link up with Marcus');

    // Create cover rubble that Marcus will emerge from
    this.createCoverRubble();

    // Create dramatic lighting on Marcus
    this.createDramaticLighting();

    // Create ambient dust particles for atmosphere
    this.createDustParticles();

    // Start camera animation sequence
    this.animateCameraPath();

    // Schedule dialogue with Marcus actions
    this.scheduleDialogue();

    // Enable skip after 3 seconds
    setTimeout(() => {
      this.canSkip = true;
      if (this.state.isPlaying && !this.skipPromptShown) {
        this.callbacks.onNotification('Press [SPACE] to skip', 3000);
        this.skipPromptShown = true;
      }
    }, 3000);

    // Add skip key listener
    this.skipKeyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && this.canSkip && this.state.isPlaying) {
        this.skipCinematic();
      }
    };
    document.addEventListener('keydown', this.skipKeyHandler);
  }

  /**
   * Skip the cinematic and jump to combat
   */
  skipCinematic(): void {
    if (!this.state.isPlaying) return;

    // Ensure Marcus is at final position
    if (this.marcusRoot) {
      this.marcusRoot.position.y = MARCUS_STAND_POSITION.y;
      this.marcusHasEmerged = true;
    }

    // Notify of skip
    this.callbacks.onNotification('CINEMATIC SKIPPED', 1500);

    // End immediately
    this.stop();
  }

  /**
   * Stop the cinematic and restore player control
   */
  stop(): void {
    if (!this.state.isPlaying) return;

    this.state.isPlaying = false;
    this.state.playerControlEnabled = true;

    // Clear any pending dialogue
    for (const timeout of this.dialogueTimeouts) {
      clearTimeout(timeout);
    }
    this.dialogueTimeouts = [];

    // Stop camera animations
    this.scene.stopAllAnimations();

    // Cleanup visual effects
    this.cleanup();

    // Notify cinematic end
    this.callbacks.onCinematicEnd?.();
  }

  /**
   * Check if cinematic is currently playing
   */
  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * Create dramatic spotlight on Marcus for cinematic effect
   */
  private createDramaticLighting(): void {
    if (!this.marcusRoot) return;

    // Spotlight from above/behind to create heroic silhouette
    this.spotlightOnMarcus = new PointLight('marcusSpotlight', new Vector3(15, 15, 5), this.scene);
    this.spotlightOnMarcus.intensity = 0;
    this.spotlightOnMarcus.diffuse = Color3.FromHexString('#FFD080');
    this.spotlightOnMarcus.specular = Color3.FromHexString('#FFFFFF');
    this.spotlightOnMarcus.range = 40;

    // Animate spotlight fade-in
    const lightAnim = new Animation(
      'spotlightFadeIn',
      'intensity',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    lightAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 60, value: 3 },
      { frame: 180, value: 2 },
    ]);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    lightAnim.setEasingFunction(easing);

    this.spotlightOnMarcus.animations = [lightAnim];
    this.scene.beginAnimation(this.spotlightOnMarcus, 0, 180, false);
  }

  /**
   * Create atmospheric dust particles floating in canyon air
   */
  private createDustParticles(): void {
    const dustMat = new StandardMaterial('dustMat', this.scene);
    dustMat.emissiveColor = new Color3(0.9, 0.7, 0.5);
    dustMat.alpha = 0.3;
    dustMat.disableLighting = true;

    // Create small floating dust particles
    for (let i = 0; i < 30; i++) {
      const dust = MeshBuilder.CreateSphere(
        `dust_${i}`,
        { diameter: 0.05 + Math.random() * 0.1 },
        this.scene
      );
      dust.material = dustMat;
      dust.position = new Vector3(
        (Math.random() - 0.5) * 80,
        Math.random() * 8,
        (Math.random() - 0.5) * 80
      );
      this.dustParticles.push(dust);

      // Animate dust floating
      const dustAnim = new Animation(
        `dustFloat_${i}`,
        'position.y',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CYCLE
      );
      const startY = dust.position.y;
      const floatRange = 0.5 + Math.random() * 1;
      const frameOffset = Math.random() * 120;
      dustAnim.setKeys([
        { frame: 0, value: startY },
        { frame: 60 + frameOffset, value: startY + floatRange },
        { frame: 120 + frameOffset * 2, value: startY },
      ]);
      dust.animations = [dustAnim];
      this.scene.beginAnimation(dust, 0, 120 + frameOffset * 2, true);
    }
  }

  /**
   * Create rubble/cover that Marcus is hiding behind
   */
  private createCoverRubble(): void {
    const rubbleMat = new StandardMaterial('rubbleMat', this.scene);
    rubbleMat.diffuseColor = Color3.FromHexString('#6B4423');
    rubbleMat.specularColor = new Color3(0.1, 0.1, 0.1);

    // Create several rock pieces around Marcus's position
    const rubblePositions = [
      new Vector3(12, 0.8, 8),
      new Vector3(18, 1.2, 9),
      new Vector3(14, 0.6, 12),
      new Vector3(16, 1.0, 7),
      new Vector3(13, 0.9, 11),
    ];

    rubblePositions.forEach((pos, i) => {
      const size = 1.5 + Math.random() * 2;
      const rock = MeshBuilder.CreateBox(
        `coverRubble_${i}`,
        {
          width: size * (0.8 + Math.random() * 0.4),
          height: size * (0.5 + Math.random() * 0.5),
          depth: size * (0.8 + Math.random() * 0.4),
        },
        this.scene
      );
      rock.position = pos;
      rock.rotation.y = Math.random() * Math.PI * 2;
      rock.rotation.x = (Math.random() - 0.5) * 0.3;
      rock.material = rubbleMat;
      this.coverRubble.push(rock);
    });
  }

  /**
   * Animate Marcus emerging from cover - dramatic rising motion
   */
  private animateMarcusEmergence(): void {
    if (!this.marcusRoot || this.marcusHasEmerged) return;

    this.marcusHasEmerged = true;

    // Create emergence dust cloud
    this.createEmergenceDustCloud();

    // Scatter the rubble pieces
    this.scatterCoverRubble();

    // Animate Marcus rising to full height
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

    const riseAnim = new Animation(
      'marcusRise',
      'position.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    riseAnim.setEasingFunction(easing);
    riseAnim.setKeys([
      { frame: 0, value: MARCUS_COVER_POSITION.y },
      { frame: 90, value: MARCUS_STAND_POSITION.y }, // 3 seconds to rise
    ]);

    this.marcusRoot.animations = [riseAnim];
    this.scene.beginAnimation(this.marcusRoot, 0, 90, false);
  }

  /**
   * Create a dust cloud effect when Marcus emerges
   */
  private createEmergenceDustCloud(): void {
    const dustMat = new StandardMaterial('emergenceDustMat', this.scene);
    dustMat.diffuseColor = new Color3(0.7, 0.6, 0.5);
    dustMat.emissiveColor = new Color3(0.3, 0.25, 0.2);
    dustMat.alpha = 0.6;
    dustMat.disableLighting = true;

    // Create multiple dust puffs around Marcus's position
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 2 + Math.random() * 4;
      const puff = MeshBuilder.CreateSphere(
        `emergenceDust_${i}`,
        { diameter: 1 + Math.random() * 2 },
        this.scene
      );
      puff.material = dustMat;
      puff.position = new Vector3(
        MARCUS_STAND_POSITION.x + Math.cos(angle) * radius,
        0.5 + Math.random() * 2,
        MARCUS_STAND_POSITION.z + Math.sin(angle) * radius
      );
      this.debrisParticles.push(puff);

      // Animate dust expanding and fading
      const expandAnim = new Animation(
        `dustExpand_${i}`,
        'scaling',
        30,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      const startScale = new Vector3(0.3, 0.3, 0.3);
      const endScale = new Vector3(2 + Math.random(), 1.5 + Math.random() * 0.5, 2 + Math.random());
      expandAnim.setKeys([
        { frame: 0, value: startScale },
        { frame: 60, value: endScale },
      ]);

      const fadeAnim = new Animation(
        `dustFade_${i}`,
        'visibility',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      fadeAnim.setKeys([
        { frame: 0, value: 0.6 },
        { frame: 30, value: 0.8 },
        { frame: 90, value: 0 },
      ]);

      const riseAnim = new Animation(
        `dustRise_${i}`,
        'position.y',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      const startY = puff.position.y;
      riseAnim.setKeys([
        { frame: 0, value: startY },
        { frame: 90, value: startY + 3 + Math.random() * 2 },
      ]);

      puff.animations = [expandAnim, fadeAnim, riseAnim];
      this.scene.beginAnimation(puff, 0, 90, false);
    }
  }

  /**
   * Scatter the cover rubble when Marcus emerges
   */
  private scatterCoverRubble(): void {
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

    this.coverRubble.forEach((rock, i) => {
      // Calculate scatter direction (away from Marcus)
      const toRock = rock.position.subtract(MARCUS_STAND_POSITION);
      toRock.y = 0;
      toRock.normalize();

      const scatterDistance = 3 + Math.random() * 4;
      const endPos = rock.position.add(toRock.scale(scatterDistance));
      endPos.y = rock.position.y + 1 + Math.random() * 2;

      // Position animation
      const scatterAnim = new Animation(
        `rubbleScatter_${i}`,
        'position',
        30,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      scatterAnim.setEasingFunction(easing);
      scatterAnim.setKeys([
        { frame: 0, value: rock.position.clone() },
        { frame: 45, value: endPos },
        { frame: 75, value: new Vector3(endPos.x, 0.3, endPos.z) }, // Fall back down
      ]);

      // Rotation animation (tumbling)
      const tumbleAnim = new Animation(
        `rubbleTumble_${i}`,
        'rotation',
        30,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      const endRot = new Vector3(
        rock.rotation.x + (Math.random() - 0.5) * Math.PI * 2,
        rock.rotation.y + (Math.random() - 0.5) * Math.PI * 2,
        rock.rotation.z + (Math.random() - 0.5) * Math.PI
      );
      tumbleAnim.setKeys([
        { frame: 0, value: rock.rotation.clone() },
        { frame: 75, value: endRot },
      ]);

      rock.animations = [scatterAnim, tumbleAnim];
      this.scene.beginAnimation(rock, 0, 75, false);
    });
  }

  /**
   * Animate Marcus turning to face the Breach
   */
  private animateMarcusFaceBreach(): void {
    if (!this.marcusRoot) return;

    const breachDirection = new Vector3(0, 0, -60).subtract(this.marcusRoot.position);
    breachDirection.y = 0;
    const targetRotation = Math.atan2(breachDirection.x, breachDirection.z);

    const rotAnim = new Animation(
      'marcusFaceBreach',
      'rotation.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    rotAnim.setEasingFunction(easing);
    rotAnim.setKeys([
      { frame: 0, value: this.marcusRoot.rotation.y },
      { frame: 45, value: targetRotation },
    ]);

    this.marcusRoot.animations = [rotAnim];
    this.scene.beginAnimation(this.marcusRoot, 0, 45, false);
  }

  /**
   * Animate Marcus arming weapons - subtle arm movement
   */
  private animateMarcusArmWeapons(): void {
    if (!this.marcusRoot) return;

    // Find arm meshes in Marcus's hierarchy
    const leftArm = this.marcusRoot.getChildMeshes().find((m) => m.name === 'mechLeftArm');
    const rightArm = this.marcusRoot.getChildMeshes().find((m) => m.name === 'mechRightArm');

    if (leftArm && rightArm) {
      const easing = new CubicEase();
      easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

      // Left arm raises slightly
      const leftArmAnim = new Animation(
        'leftArmRaise',
        'rotation.z',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      leftArmAnim.setEasingFunction(easing);
      leftArmAnim.setKeys([
        { frame: 0, value: leftArm.rotation.z },
        { frame: 15, value: leftArm.rotation.z + 0.3 },
        { frame: 30, value: leftArm.rotation.z + 0.1 },
      ]);

      // Right arm raises slightly
      const rightArmAnim = new Animation(
        'rightArmRaise',
        'rotation.z',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      rightArmAnim.setEasingFunction(easing);
      rightArmAnim.setKeys([
        { frame: 0, value: rightArm.rotation.z },
        { frame: 15, value: rightArm.rotation.z - 0.3 },
        { frame: 30, value: rightArm.rotation.z - 0.1 },
      ]);

      leftArm.animations = [leftArmAnim];
      rightArm.animations = [rightArmAnim];
      this.scene.beginAnimation(leftArm, 0, 30, false);
      this.scene.beginAnimation(rightArm, 0, 30, false);
    }
  }

  /**
   * Animate camera through cinematic path
   */
  private animateCameraPath(): void {
    let cumulativeTime = 0;

    for (let i = 0; i < REUNION_CAMERA_PATH.length; i++) {
      const keyframe = REUNION_CAMERA_PATH[i];
      const prevKeyframe = i > 0 ? REUNION_CAMERA_PATH[i - 1] : keyframe;

      if (i === 0) {
        // Set initial position immediately
        this.camera.position = keyframe.position.clone();
        this.lookAt(keyframe.target);
        if (keyframe.fov) this.camera.fov = keyframe.fov;
        continue;
      }

      // Schedule camera move to this keyframe
      const delay = cumulativeTime;
      cumulativeTime += keyframe.duration;

      setTimeout(() => {
        if (!this.state.isPlaying) return;

        this.animateCameraTo(keyframe.position, keyframe.target, keyframe.duration, keyframe.fov);
      }, delay);
    }

    // End cinematic after all camera moves complete
    const totalDuration = REUNION_CAMERA_PATH.reduce((sum, kf) => sum + kf.duration, 0);
    setTimeout(() => {
      if (this.state.isPlaying) {
        this.endCinematic();
      }
    }, totalDuration + 2000); // Extra buffer for final dialogue
  }

  /**
   * Smoothly animate camera to a new position and target
   */
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
      'cameraPosAnim',
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
        'cameraFovAnim',
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

    // Animate camera rotation to look at target
    this.animateLookAt(target, duration);

    this.scene.beginAnimation(this.camera, 0, totalFrames, false);
  }

  /**
   * Smoothly animate camera to look at a target
   */
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
      'cameraRotYAnim',
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
      'cameraRotXAnim',
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

  /**
   * Immediately point camera at target (no animation)
   */
  private lookAt(target: Vector3): void {
    const direction = target.subtract(this.camera.position);
    this.camera.rotation.y = Math.atan2(direction.x, direction.z);
    const horizontalDistance = Math.sqrt(direction.x ** 2 + direction.z ** 2);
    this.camera.rotation.x = -Math.atan2(direction.y, horizontalDistance);
  }

  /**
   * Schedule all dialogue messages and associated Marcus actions
   */
  private scheduleDialogue(): void {
    for (const dialogue of REUNION_DIALOGUE) {
      const timeout = setTimeout(() => {
        if (!this.state.isPlaying) return;

        // Send the dialogue message
        this.callbacks.onCommsMessage({
          ...dialogue.character,
          text: dialogue.text,
        });

        // Trigger camera shake if specified in dialogue
        if (dialogue.cameraShake) {
          this.callbacks.onShakeCamera(dialogue.cameraShake);
        }

        // Trigger Marcus actions based on dialogue beat
        if (dialogue.marcusAction) {
          switch (dialogue.marcusAction) {
            case 'emerge':
              // Marcus dramatically rises from behind cover
              this.animateMarcusEmergence();
              break;
            case 'stand':
              // Marcus has fully risen - ensure at standing position
              if (this.marcusRoot) {
                this.marcusRoot.position.y = MARCUS_STAND_POSITION.y;
              }
              break;
            case 'face_breach':
              // Marcus turns to look at the Breach
              this.animateMarcusFaceBreach();
              break;
            case 'arm_weapons':
              // Marcus readies weapons for combat
              this.animateMarcusArmWeapons();
              break;
          }
        }
      }, dialogue.delay);

      this.dialogueTimeouts.push(timeout);
    }
  }

  /**
   * End the cinematic and transition to gameplay
   */
  private endCinematic(): void {
    // Restore camera to gameplay position
    const gameplayPosition = new Vector3(0, 1.7, 50);
    const gameplayTarget = new Vector3(15, 4, 10); // Looking toward Marcus

    this.animateCameraTo(gameplayPosition, gameplayTarget, 1500, 1.2);

    // Fade out dramatic lighting
    if (this.spotlightOnMarcus) {
      const fadeOut = new Animation(
        'spotlightFadeOut',
        'intensity',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      fadeOut.setKeys([
        { frame: 0, value: this.spotlightOnMarcus.intensity },
        { frame: 45, value: 0.5 }, // Fade to subtle enhancement
      ]);
      this.spotlightOnMarcus.animations = [fadeOut];
      this.scene.beginAnimation(this.spotlightOnMarcus, 0, 45, false);
    }

    // Delay before transitioning
    setTimeout(() => {
      this.stop();
    }, 2000);
  }

  /**
   * Cleanup visual effects
   */
  private cleanup(): void {
    // Remove skip key handler
    if (this.skipKeyHandler) {
      document.removeEventListener('keydown', this.skipKeyHandler);
      this.skipKeyHandler = null;
    }

    // Dispose dust particles
    for (const dust of this.dustParticles) {
      dust.dispose();
    }
    this.dustParticles = [];

    // Dispose debris particles from emergence effect
    for (const debris of this.debrisParticles) {
      debris.dispose();
    }
    this.debrisParticles = [];

    // Dispose cover rubble (now scattered around)
    for (const rubble of this.coverRubble) {
      rubble.dispose();
    }
    this.coverRubble = [];

    // Clear animation timeouts
    for (const timeout of this.animationTimeouts) {
      clearTimeout(timeout);
    }
    this.animationTimeouts = [];

    // Restore Marcus to proper standing position
    if (this.marcusRoot) {
      this.marcusRoot.position.y = MARCUS_STAND_POSITION.y;
    }

    // Reset skip state
    this.canSkip = false;
    this.skipPromptShown = false;

    // Keep spotlight but at reduced intensity for gameplay
    // (disposed when level disposes)
  }

  /**
   * Dispose all cinematic resources
   */
  dispose(): void {
    this.stop();
    this.spotlightOnMarcus?.dispose();
    this.spotlightOnMarcus = null;
  }
}

// ============================================================================
// COMMS MESSAGE DEFINITIONS FOR OTHER LEVEL PHASES
// ============================================================================

export const COMMS = {
  // Wave combat messages
  WAVE_1_START: {
    ...MARCUS_CHARACTER,
    text: 'Contacts inbound! Just like the Europa job, eh James?',
  } as CommsMessage,

  WAVE_1_COMPLETE: {
    ...MARCUS_CHARACTER,
    text: 'Good shooting! Take a breather - more will come.',
  } as CommsMessage,

  WAVE_2_START: {
    ...MARCUS_CHARACTER,
    text: 'Grunts incoming! Keep your distance, their claws are nasty.',
  } as CommsMessage,

  WAVE_2_COMPLETE: {
    ...MARCUS_CHARACTER,
    text: "More incoming! They don't give up!",
  } as CommsMessage,

  WAVE_3_START: {
    ...MARCUS_CHARACTER,
    text: 'Mixed wave! Watch for acid spitters - green glowing ones!',
  } as CommsMessage,

  WAVE_3_COMPLETE: {
    ...MARCUS_CHARACTER,
    text: 'Stay sharp, I hear more coming!',
  } as CommsMessage,

  WAVE_4_START: {
    ...MARCUS_CHARACTER,
    text: 'Something big is coming... TWO BRUTES! Focus fire, James!',
  } as CommsMessage,

  WAVE_4_COMPLETE: {
    ...MARCUS_CHARACTER,
    text: 'That was the last of them... for now.',
  } as CommsMessage,

  // Breach battle messages
  BREACH_APPROACH: {
    ...MARCUS_CHARACTER,
    text: "That's the entrance to the hive. We need to clear it out!",
  } as CommsMessage,

  BREACH_CLEARED: {
    ...MARCUS_CHARACTER,
    text: 'The entrance is secure. You need to go down there, James.',
  } as CommsMessage,

  // Transition messages
  TRANSITION_START: {
    ...MARCUS_CHARACTER,
    text: "I can't fit in there. HAMMER's too big for those tunnels.",
  } as CommsMessage,

  TRANSITION_FAREWELL: {
    ...MARCUS_CHARACTER,
    text: "Find the queen. End this. I'll hold the surface - they won't get past me.",
  } as CommsMessage,

  TRANSITION_FINAL: {
    ...JAMES_CHARACTER,
    text: "I'll be back, Marcus. Keep the engine running.",
  } as CommsMessage,
} as const;

// ============================================================================
// NOTIFICATION STRINGS
// ============================================================================

export const NOTIFICATIONS = {
  MARCUS_LOCATED: 'MARCUS LOCATED',
  REUNION: 'REUNION',
  WAVE_INCOMING: (n: number) => `WAVE ${n} INCOMING`,
  WAVE_CLEARED: (n: number) => `WAVE ${n} CLEARED`,
  ALL_WAVES_CLEARED: 'ALL WAVES CLEARED',
  THE_BREACH: 'THE BREACH - FINAL BATTLE',
  ENTER_THE_BREACH: 'APPROACH THE BREACH',
  FIRE_SUPPORT_CALLED: 'FIRE SUPPORT CALLED',
  GRENADE_OUT: 'GRENADE OUT',
  MELEE: 'MELEE',
} as const;

// ============================================================================
// OBJECTIVE STRINGS
// ============================================================================

export const OBJECTIVES = {
  REUNION: {
    title: 'REUNION',
    description: 'Link up with Corporal Marcus Cole',
  },
  WAVE_COMBAT: {
    getTitle: (wave: number, total: number) => `WAVE ${wave}/${total}`,
    getDescription: (kills: number) => `Eliminate all hostiles | Total Kills: ${kills}`,
  },
  NEXT_WAVE: {
    getTitle: (seconds: number) => `NEXT WAVE IN ${seconds}s`,
    getDescription: (kills: number) => `Regroup with Marcus | Total Kills: ${kills}`,
  },
  BREACH_BATTLE: {
    title: 'THE BREACH',
    description: 'Secure the hive entrance with Marcus',
  },
  ENTER_BREACH: {
    title: 'ENTER THE BREACH',
    description: 'Proceed into the hive tunnels',
  },
} as const;
