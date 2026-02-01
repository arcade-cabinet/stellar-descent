/**
 * SquadCommandSystem - Player-issued commands for Marcus AI companion
 *
 * COMMAND TYPES:
 * - FOLLOW_ME: Marcus stays close to player
 * - HOLD_POSITION: Marcus stays at current location
 * - ATTACK_TARGET: Marcus focuses fire on crosshair target
 * - SUPPRESSING_FIRE: Marcus lays down covering fire in direction
 * - REGROUP: Marcus returns to player immediately
 *
 * INTEGRATION:
 * - Works with MarcusCombatAI to override autonomous behavior
 * - Commands expire after 30 seconds or when a new command is issued
 * - Visual feedback via waypoint markers and voice lines
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { Entity } from '../core/ecs';
import type { CommsMessage } from '../types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SquadCommand =
  | 'FOLLOW_ME'
  | 'HOLD_POSITION'
  | 'ATTACK_TARGET'
  | 'SUPPRESSING_FIRE'
  | 'REGROUP'
  | 'SCOUT_AHEAD'
  | 'FLANK_TARGET';

export interface SquadCommandData {
  command: SquadCommand;
  issuedAt: number;
  expiresAt: number;
  targetPosition?: Vector3;
  targetEntity?: Entity;
  direction?: Vector3;
}

export interface SquadCommandConfig {
  commandDuration: number; // How long commands last (ms)
  followDistance: number; // Distance Marcus keeps when following
  holdPositionTolerance: number; // How far Marcus can drift from hold position
  suppressionDuration: number; // Duration of suppression fire
  regroupSpeedMultiplier: number; // Speed boost when regrouping
}

export interface SquadCommandCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onNotification: (text: string, duration: number) => void;
  onCommandIssued?: (command: SquadCommand) => void;
  onCommandExpired?: (command: SquadCommand) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: SquadCommandConfig = {
  commandDuration: 30000, // 30 seconds
  followDistance: 12, // 12 meters
  holdPositionTolerance: 3, // 3 meters
  suppressionDuration: 5000, // 5 seconds of suppression
  regroupSpeedMultiplier: 1.5, // 50% faster when regrouping
};

// Marcus character for comms messages
const MARCUS_CHARACTER: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'HAMMER',
  portrait: 'marcus',
};

// Command acknowledgment voice lines
export const COMMAND_ACKNOWLEDGMENTS: Record<SquadCommand, string[]> = {
  FOLLOW_ME: [
    'On your six, James!',
    'Right behind you!',
    'Following your lead!',
    "I've got your back!",
    'Moving with you!',
  ],
  HOLD_POSITION: [
    'Holding position!',
    'Digging in here!',
    "I'll hold this spot!",
    'Staying put!',
    'Maintaining position!',
  ],
  ATTACK_TARGET: [
    'Target acquired!',
    'Engaging that target!',
    'Focus fire!',
    'Locking on!',
    "I've got it!",
  ],
  SUPPRESSING_FIRE: [
    'Suppressing!',
    'Covering fire!',
    'Laying it down!',
    'Keeping them pinned!',
    'Fire support!',
  ],
  REGROUP: [
    'Coming to you!',
    'On my way!',
    'Regrouping now!',
    "I'm coming, James!",
    'Moving to your position!',
  ],
  SCOUT_AHEAD: [
    'Moving to scout position!',
    'Scouting ahead!',
    "I'll check it out!",
    'Recon mission active!',
    'Let me take a look!',
  ],
  FLANK_TARGET: [
    "Going around - I'll hit them from the side!",
    'Flanking maneuver!',
    "I'll circle around!",
    'Taking the long way!',
    'Moving to flank position!',
  ],
};

// Command UI labels and icons
export const COMMAND_INFO: Record<
  SquadCommand,
  { label: string; icon: string; description: string }
> = {
  FOLLOW_ME: {
    label: 'FOLLOW ME',
    icon: '\u2B9D', // Up arrow
    description: 'Marcus stays close behind you',
  },
  HOLD_POSITION: {
    label: 'HOLD POSITION',
    icon: '\u2B1B', // Square
    description: 'Marcus holds current location',
  },
  ATTACK_TARGET: {
    label: 'ATTACK TARGET',
    icon: '\u2A2F', // Crosshair
    description: 'Marcus focuses on your target',
  },
  SUPPRESSING_FIRE: {
    label: 'SUPPRESSING FIRE',
    icon: '\u27A1', // Arrow right
    description: 'Marcus provides covering fire',
  },
  REGROUP: {
    label: 'REGROUP',
    icon: '\u2302', // House/rally point
    description: 'Marcus returns to you immediately',
  },
  SCOUT_AHEAD: {
    label: 'SCOUT AHEAD',
    icon: '\u2316', // Telescope/scout
    description: 'Marcus scouts ahead and reports intel',
  },
  FLANK_TARGET: {
    label: 'FLANK TARGET',
    icon: '\u21BB', // Circular arrow
    description: 'Marcus takes alternate route around enemies',
  },
};

// ============================================================================
// SQUAD COMMAND SYSTEM CLASS
// ============================================================================

export class SquadCommandSystem {
  private scene: Scene;
  private config: SquadCommandConfig;
  private callbacks: SquadCommandCallbacks;

  // Current command state
  private activeCommand: SquadCommandData | null = null;

  // Command wheel state
  private isCommandWheelOpen: boolean = false;
  private selectedCommand: SquadCommand | null = null;

  // Visual markers
  private holdPositionMarker: Mesh | null = null;
  private attackTargetMarker: Mesh | null = null;
  private suppressionDirectionMarker: Mesh | null = null;

  // Player tracking
  private playerPosition: Vector3 = Vector3.Zero();
  private playerForward: Vector3 = Vector3.Forward();

  // Last acknowledgment time (to prevent spam)
  private lastAcknowledgmentTime: number = 0;
  private acknowledgmentCooldown: number = 2000;

  constructor(
    scene: Scene,
    callbacks: SquadCommandCallbacks,
    config?: Partial<SquadCommandConfig>
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // PUBLIC METHODS - COMMAND WHEEL
  // ============================================================================

  /**
   * Open the command wheel (called when Tab is pressed)
   */
  openCommandWheel(): void {
    if (this.isCommandWheelOpen) return;

    this.isCommandWheelOpen = true;
    this.commandWheelOpenTime = performance.now();
    this.selectedCommand = null;
  }

  /**
   * Close the command wheel and issue selected command (called when Tab is released)
   */
  closeCommandWheel(): SquadCommand | null {
    if (!this.isCommandWheelOpen) return null;

    this.isCommandWheelOpen = false;
    const command = this.selectedCommand;

    if (command) {
      this.issueCommand(command);
    }

    this.selectedCommand = null;
    return command;
  }

  /**
   * Update the selected command based on mouse position
   * @param angle Angle in radians from center (0 = right, PI/2 = up)
   * @param distance Distance from center (0-1, commands only selected if > 0.3)
   */
  updateCommandWheelSelection(angle: number, distance: number): void {
    if (!this.isCommandWheelOpen) return;

    // Only select if mouse is far enough from center
    if (distance < 0.3) {
      this.selectedCommand = null;
      return;
    }

    // Normalize angle to 0-2PI
    let normalizedAngle = angle;
    while (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
    while (normalizedAngle >= Math.PI * 2) normalizedAngle -= Math.PI * 2;

    // Map angle to command (5 segments, each 72 degrees = 0.4PI)
    // Starting from top (3PI/2) going clockwise
    const segmentAngle = (Math.PI * 2) / 5;
    const offsetAngle = normalizedAngle + segmentAngle / 2; // Center segments

    // Calculate segment index (0 = top, going clockwise)
    const segmentIndex = Math.floor(((offsetAngle + Math.PI / 2) % (Math.PI * 2)) / segmentAngle);

    const commands: SquadCommand[] = [
      'FOLLOW_ME', // Top
      'ATTACK_TARGET', // Top-right
      'SUPPRESSING_FIRE', // Bottom-right
      'REGROUP', // Bottom-left
      'HOLD_POSITION', // Top-left
    ];

    this.selectedCommand = commands[segmentIndex % 5];
  }

  /**
   * Check if command wheel is currently open
   */
  isWheelOpen(): boolean {
    return this.isCommandWheelOpen;
  }

  /**
   * Get currently selected command (for UI highlighting)
   */
  getSelectedCommand(): SquadCommand | null {
    return this.selectedCommand;
  }

  // ============================================================================
  // PUBLIC METHODS - COMMAND ISSUANCE
  // ============================================================================

  /**
   * Issue a squad command
   */
  issueCommand(command: SquadCommand, targetEntity?: Entity, targetPosition?: Vector3): void {
    const now = performance.now();

    // Clean up previous command's visual markers
    this.cleanupMarkers();

    // Store previous command
    if (this.activeCommand) {
      this.previousCommand = this.activeCommand.command;
    }

    // Create command data
    const commandData: SquadCommandData = {
      command,
      issuedAt: now,
      expiresAt: now + this.config.commandDuration,
    };

    // Command-specific setup
    switch (command) {
      case 'HOLD_POSITION':
        // Use current Marcus position (will be set by update)
        commandData.targetPosition = this.playerPosition.clone();
        break;

      case 'ATTACK_TARGET':
        commandData.targetEntity = targetEntity;
        commandData.targetPosition = targetPosition?.clone();
        if (targetPosition) {
          this.createAttackTargetMarker(targetPosition);
        }
        break;

      case 'SUPPRESSING_FIRE':
        commandData.direction = this.playerForward.clone();
        commandData.targetPosition = this.playerPosition.add(this.playerForward.scale(50));
        this.createSuppressionMarker(commandData.targetPosition);
        break;

      case 'FOLLOW_ME':
      case 'REGROUP':
        // No special setup needed
        break;
    }

    this.activeCommand = commandData;

    // Send acknowledgment
    this.sendAcknowledgment(command);

    // Notify callbacks
    this.callbacks.onCommandIssued?.(command);

    // Show notification
    const info = COMMAND_INFO[command];
    this.callbacks.onNotification(`COMMAND: ${info.label}`, 1500);
  }

  /**
   * Cancel the current command and return to autonomous behavior
   */
  cancelCommand(): void {
    if (!this.activeCommand) return;

    const expiredCommand = this.activeCommand.command;
    this.activeCommand = null;
    this.cleanupMarkers();

    this.callbacks.onCommandExpired?.(expiredCommand);
    this.callbacks.onNotification('COMMAND CANCELLED', 1000);
  }

  /**
   * Get the current active command
   */
  getActiveCommand(): SquadCommandData | null {
    return this.activeCommand;
  }

  /**
   * Check if a specific command is active
   */
  isCommandActive(command: SquadCommand): boolean {
    return this.activeCommand?.command === command;
  }

  // ============================================================================
  // PUBLIC METHODS - STATE QUERIES
  // ============================================================================

  /**
   * Get movement override based on current command
   * Returns target position Marcus should move toward, or null for autonomous behavior
   */
  getMovementOverride(marcusPosition: Vector3): Vector3 | null {
    if (!this.activeCommand) return null;

    switch (this.activeCommand.command) {
      case 'FOLLOW_ME': {
        // Stay behind player at configured distance
        const behindPlayer = this.playerPosition.subtract(
          this.playerForward.scale(this.config.followDistance)
        );
        behindPlayer.y = 0;
        return behindPlayer;
      }

      case 'HOLD_POSITION':
        // Return to hold position if drifted too far
        if (this.activeCommand.targetPosition) {
          const dist = Vector3.Distance(marcusPosition, this.activeCommand.targetPosition);
          if (dist > this.config.holdPositionTolerance) {
            return this.activeCommand.targetPosition;
          }
        }
        return marcusPosition; // Stay in place

      case 'ATTACK_TARGET':
        // Move toward target if too far, otherwise autonomous positioning
        if (this.activeCommand.targetPosition) {
          const distToTarget = Vector3.Distance(marcusPosition, this.activeCommand.targetPosition);
          if (distToTarget > 40) {
            // Get closer to target
            const toTarget = this.activeCommand.targetPosition.subtract(marcusPosition).normalize();
            return marcusPosition.add(toTarget.scale(10));
          }
        }
        return null; // Let AI handle positioning

      case 'SUPPRESSING_FIRE':
        // Hold position while suppressing
        return marcusPosition;

      case 'REGROUP': {
        // Move directly to player with urgency
        const toPlayer = this.playerPosition.subtract(marcusPosition);
        toPlayer.y = 0;
        if (toPlayer.length() > 8) {
          return this.playerPosition;
        }
        // Close enough, switch to follow mode
        this.issueCommand('FOLLOW_ME');
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Get targeting override based on current command
   * Returns entity Marcus should target, or null for autonomous targeting
   */
  getTargetOverride(): Entity | null {
    if (!this.activeCommand) return null;

    if (this.activeCommand.command === 'ATTACK_TARGET') {
      return this.activeCommand.targetEntity ?? null;
    }

    return null;
  }

  /**
   * Get fire mode override based on current command
   * Returns special fire behavior, or null for normal behavior
   */
  getFireModeOverride(): 'suppression' | 'focused' | null {
    if (!this.activeCommand) return null;

    switch (this.activeCommand.command) {
      case 'SUPPRESSING_FIRE':
        return 'suppression';
      case 'ATTACK_TARGET':
        return 'focused';
      default:
        return null;
    }
  }

  /**
   * Get suppression direction (only valid during SUPPRESSING_FIRE command)
   */
  getSuppressionDirection(): Vector3 | null {
    if (this.activeCommand?.command !== 'SUPPRESSING_FIRE') return null;
    return this.activeCommand.direction ?? null;
  }

  /**
   * Get speed multiplier based on current command
   */
  getSpeedMultiplier(): number {
    if (this.activeCommand?.command === 'REGROUP') {
      return this.config.regroupSpeedMultiplier;
    }
    return 1;
  }

  // ============================================================================
  // PUBLIC METHODS - UPDATE
  // ============================================================================

  /**
   * Update system each frame
   */
  update(playerPosition: Vector3, playerForward: Vector3, marcusPosition: Vector3): void {
    this.playerPosition = playerPosition.clone();
    this.playerForward = playerForward.clone();

    // Check for command expiration
    if (this.activeCommand) {
      const now = performance.now();

      if (now >= this.activeCommand.expiresAt) {
        // Command expired
        const expiredCommand = this.activeCommand.command;
        this.activeCommand = null;
        this.cleanupMarkers();
        this.callbacks.onCommandExpired?.(expiredCommand);
        this.callbacks.onNotification('COMMAND EXPIRED', 1000);
      } else {
        // Update hold position marker
        if (this.activeCommand.command === 'HOLD_POSITION' && !this.activeCommand.targetPosition) {
          this.activeCommand.targetPosition = marcusPosition.clone();
          this.createHoldPositionMarker(marcusPosition);
        }

        // Update suppression direction to follow player aim
        if (this.activeCommand.command === 'SUPPRESSING_FIRE') {
          this.activeCommand.direction = this.playerForward.clone();
          this.activeCommand.targetPosition = this.playerPosition.add(this.playerForward.scale(50));
          this.updateSuppressionMarker(this.activeCommand.targetPosition);
        }
      }
    }

    // Update visual markers
    this.updateMarkers();
  }

  // ============================================================================
  // PRIVATE METHODS - VISUAL MARKERS
  // ============================================================================

  private createHoldPositionMarker(position: Vector3): void {
    if (this.holdPositionMarker) {
      this.holdPositionMarker.dispose();
    }

    // Create a ground marker ring
    this.holdPositionMarker = MeshBuilder.CreateTorus(
      'holdPositionMarker',
      { diameter: 4, thickness: 0.3, tessellation: 32 },
      this.scene
    );
    this.holdPositionMarker.position = position.clone();
    this.holdPositionMarker.position.y = 0.2;
    this.holdPositionMarker.rotation.x = Math.PI / 2;

    const mat = new StandardMaterial('holdMarkerMat', this.scene);
    mat.emissiveColor = Color3.FromHexString('#4DA6FF'); // Blue
    mat.disableLighting = true;
    mat.alpha = 0.7;
    this.holdPositionMarker.material = mat;
  }

  private createAttackTargetMarker(position: Vector3): void {
    if (this.attackTargetMarker) {
      this.attackTargetMarker.dispose();
    }

    // Create a diamond shape above target
    this.attackTargetMarker = MeshBuilder.CreateBox(
      'attackTargetMarker',
      { width: 1.5, height: 1.5, depth: 1.5 },
      this.scene
    );
    this.attackTargetMarker.position = position.clone();
    this.attackTargetMarker.position.y += 3;
    this.attackTargetMarker.rotation.y = Math.PI / 4;
    this.attackTargetMarker.rotation.z = Math.PI / 4;

    const mat = new StandardMaterial('attackMarkerMat', this.scene);
    mat.emissiveColor = Color3.FromHexString('#FF4444'); // Red
    mat.disableLighting = true;
    mat.alpha = 0.8;
    this.attackTargetMarker.material = mat;
  }

  private createSuppressionMarker(position: Vector3): void {
    if (this.suppressionDirectionMarker) {
      this.suppressionDirectionMarker.dispose();
    }

    // Create an arrow-like indicator
    this.suppressionDirectionMarker = MeshBuilder.CreateCylinder(
      'suppressionMarker',
      { height: 8, diameterTop: 0, diameterBottom: 3, tessellation: 4 },
      this.scene
    );
    this.suppressionDirectionMarker.position = position.clone();
    this.suppressionDirectionMarker.position.y = 2;
    this.suppressionDirectionMarker.rotation.z = Math.PI / 2;

    const mat = new StandardMaterial('suppressionMarkerMat', this.scene);
    mat.emissiveColor = Color3.FromHexString('#FFAA00'); // Orange
    mat.disableLighting = true;
    mat.alpha = 0.6;
    this.suppressionDirectionMarker.material = mat;
  }

  private updateSuppressionMarker(position: Vector3): void {
    if (this.suppressionDirectionMarker) {
      this.suppressionDirectionMarker.position = position.clone();
      this.suppressionDirectionMarker.position.y = 2;

      // Point in direction of suppression
      const dir = this.playerForward.clone();
      const angle = Math.atan2(dir.x, dir.z);
      this.suppressionDirectionMarker.rotation.y = angle;
    }
  }

  private updateMarkers(): void {
    const time = performance.now() * 0.003;

    // Animate hold position marker
    if (this.holdPositionMarker && !this.holdPositionMarker.isDisposed()) {
      this.holdPositionMarker.scaling.setAll(1 + Math.sin(time) * 0.1);
      (this.holdPositionMarker.material as StandardMaterial).alpha = 0.5 + Math.sin(time * 2) * 0.2;
    }

    // Animate attack target marker
    if (this.attackTargetMarker && !this.attackTargetMarker.isDisposed()) {
      this.attackTargetMarker.rotation.y += 0.02;
      this.attackTargetMarker.position.y =
        (this.activeCommand?.targetPosition?.y ?? 0) + 3 + Math.sin(time) * 0.3;
    }

    // Animate suppression marker
    if (this.suppressionDirectionMarker && !this.suppressionDirectionMarker.isDisposed()) {
      const alpha = 0.4 + Math.sin(time * 4) * 0.3;
      (this.suppressionDirectionMarker.material as StandardMaterial).alpha = alpha;
    }
  }

  private cleanupMarkers(): void {
    if (this.holdPositionMarker) {
      this.holdPositionMarker.material?.dispose();
      this.holdPositionMarker.dispose();
      this.holdPositionMarker = null;
    }
    if (this.attackTargetMarker) {
      this.attackTargetMarker.material?.dispose();
      this.attackTargetMarker.dispose();
      this.attackTargetMarker = null;
    }
    if (this.suppressionDirectionMarker) {
      this.suppressionDirectionMarker.material?.dispose();
      this.suppressionDirectionMarker.dispose();
      this.suppressionDirectionMarker = null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - ACKNOWLEDGMENTS
  // ============================================================================

  private sendAcknowledgment(command: SquadCommand): void {
    const now = performance.now();

    // Check cooldown
    if (now - this.lastAcknowledgmentTime < this.acknowledgmentCooldown) {
      return;
    }

    this.lastAcknowledgmentTime = now;

    // Get random acknowledgment
    const acknowledgments = COMMAND_ACKNOWLEDGMENTS[command];
    const text = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

    // Send comms message
    this.callbacks.onCommsMessage({
      ...MARCUS_CHARACTER,
      text,
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.cleanupMarkers();
    this.activeCommand = null;
    this.isCommandWheelOpen = false;
    this.selectedCommand = null;
  }
}
