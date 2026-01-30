/**
 * MarcusCombatCoordinator - Combat Coordination System for Marcus AI
 *
 * Provides advanced coordination between Marcus and the player including:
 * - Focus fire requests ("Hit this target!")
 * - Flanking maneuvers
 * - Cover fire while player advances
 * - Target priority sharing
 * - Tactical callouts with directional awareness
 * - Visual target highlighting
 * - Combat state management
 *
 * COMBAT STATES:
 * - Aggressive: Leading assault, high damage output
 * - Defensive: Protecting player, intercepting threats
 * - Support: Following player lead, providing assistance
 * - Damaged: Seeking cover, reduced effectiveness
 */

import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { Entity } from '../../core/ecs';
import type { CommsMessage } from '../../types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type CoordinationCombatState = 'aggressive' | 'defensive' | 'support' | 'damaged';

export type TacticalCalloutType =
  | 'enemy_left'
  | 'enemy_right'
  | 'enemy_behind'
  | 'enemy_above'
  | 'reloading'
  | 'heavy_incoming'
  | 'taking_damage'
  | 'shields_down'
  | 'focus_fire'
  | 'flanking'
  | 'cover_fire'
  | 'advance'
  | 'hold_position'
  | 'retreat';

export interface CoordinationTarget {
  entity: Entity;
  mesh: Mesh;
  priority: number;
  assignedTo: 'player' | 'marcus' | 'shared';
  highlightColor: Color3;
  calloutTime: number;
  isHighlighted: boolean;
}

export interface CoordinationRequest {
  type: 'focus_fire' | 'flank' | 'cover_fire' | 'suppress';
  target?: Entity;
  position?: Vector3;
  duration: number;
  startTime: number;
  acknowledged: boolean;
}

export interface MarcusStatusUpdate {
  health: number;
  maxHealth: number;
  shields: number;
  maxShields: number;
  isReloading: boolean;
  currentTarget: Entity | null;
  combatState: CoordinationCombatState;
}

export interface CoordinatorCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onNotification?: (text: string, duration: number) => void;
  onTargetHighlight?: (target: Entity, color: Color3) => void;
  onTargetUnhighlight?: (target: Entity) => void;
  onCombatStateChange?: (state: CoordinationCombatState) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MARCUS_CHARACTER: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'HAMMER',
  portrait: 'marcus',
};

// Tactical callout dialogue pools
const TACTICAL_CALLOUTS: Record<TacticalCalloutType, string[]> = {
  enemy_left: [
    'Contact left!',
    'Enemy on your left!',
    'Left side, watch it!',
    "Hostiles, nine o'clock!",
  ],
  enemy_right: [
    'Contact right!',
    'Enemy on your right!',
    'Right side!',
    "Hostiles, three o'clock!",
  ],
  enemy_behind: [
    'Behind you!',
    'Check your six!',
    'Contact rear!',
    "They're flanking, watch your back!",
  ],
  enemy_above: ['Above you!', 'Contact high!', 'Eyes up!', 'Incoming from above!'],
  reloading: [
    'Reloading! Cover me!',
    'Mag change - cover!',
    'Going dry, need a second!',
    'Cycling ammo!',
  ],
  heavy_incoming: [
    'Heavy incoming!',
    'Big one approaching!',
    'Major contact inbound!',
    'Watch it - heavy unit!',
  ],
  taking_damage: ["I'm hit!", 'Taking fire!', 'Getting hammered here!', 'Under heavy fire!'],
  shields_down: [
    'Shields down!',
    'Lost my shields!',
    "Armor's taking a beating!",
    'Primary shields offline!',
  ],
  focus_fire: [
    'Focus fire on that one!',
    'Hit this target!',
    'Concentrate fire!',
    "Let's drop this one together!",
  ],
  flanking: [
    'Moving to flank!',
    'Going around!',
    'Flanking maneuver!',
    "I'll hit 'em from the side!",
  ],
  cover_fire: [
    'Covering fire! Move up!',
    'Suppressing! Advance now!',
    "Go go go! I've got you covered!",
    'Move while I pin them down!',
  ],
  advance: ['Pushing forward!', 'Moving up!', 'Advancing position!', 'Taking ground!'],
  hold_position: ['Holding position!', 'Digging in here!', 'Staying put!', 'Maintaining position!'],
  retreat: ['Falling back!', 'Pulling back!', 'Need to reposition!', 'Taking cover!'],
};

// Combat state dialogue when transitioning
const COMBAT_STATE_CALLOUTS: Record<CoordinationCombatState, string[]> = {
  aggressive: ['Going aggressive!', 'Taking the lead!', 'Pushing hard!', 'Time to finish this!'],
  defensive: [
    'Covering you!',
    'Protecting your flank!',
    "I've got your back!",
    'Defensive posture!',
  ],
  support: [
    'Following your lead!',
    'Right behind you!',
    'Supporting your advance!',
    "Call the shots, I'll back you up!",
  ],
  damaged: [
    'Need a moment!',
    'Taking too much damage!',
    'Pulling back to repair!',
    'Systems critical - finding cover!',
  ],
};

// Highlight colors for different target priorities
const TARGET_HIGHLIGHT_COLORS = {
  focusFire: Color3.FromHexString('#FF4444'), // Red - priority target
  shared: Color3.FromHexString('#FFAA00'), // Orange - coordinated target
  marcus: Color3.FromHexString('#44FF44'), // Green - Marcus handling
  player: Color3.FromHexString('#4444FF'), // Blue - player handling
};

// ============================================================================
// MARCUS COMBAT COORDINATOR CLASS
// ============================================================================

export class MarcusCombatCoordinator {
  private scene: Scene;
  private callbacks: CoordinatorCallbacks;

  // Combat state
  private combatState: CoordinationCombatState = 'support';
  private previousCombatState: CoordinationCombatState = 'support';

  // Target coordination
  private coordinatedTargets: Map<string, CoordinationTarget> = new Map();
  private activeRequest: CoordinationRequest | null = null;

  // Marcus status
  private marcusHealth: number = 500;
  private marcusMaxHealth: number = 500;
  private marcusShields: number = 100;
  private marcusMaxShields: number = 100;
  private isReloading: boolean = false;
  private currentMarcusTarget: Entity | null = null;

  // Callout management
  private lastCalloutTime: Map<TacticalCalloutType, number> = new Map();
  private calloutCooldown: number = 3000; // 3 seconds between similar callouts
  private globalCalloutCooldown: number = 1500; // 1.5 seconds between any callouts
  private lastGlobalCalloutTime: number = 0;

  // Visual feedback
  private highlightLayer: HighlightLayer | null = null;
  private targetMarkers: Map<string, Mesh> = new Map();

  // Player tracking
  private playerPosition: Vector3 = Vector3.Zero();
  private playerForward: Vector3 = Vector3.Forward();

  constructor(scene: Scene, callbacks: CoordinatorCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;

    // Create highlight layer for target visualization
    this.highlightLayer = new HighlightLayer('marcusTargetHighlight', scene);
    this.highlightLayer.blurHorizontalSize = 0.3;
    this.highlightLayer.blurVerticalSize = 0.3;
  }

  // ============================================================================
  // PUBLIC METHODS - STATE MANAGEMENT
  // ============================================================================

  /**
   * Set the current combat state
   */
  setCombatState(state: CoordinationCombatState): void {
    if (state === this.combatState) return;

    this.previousCombatState = this.combatState;
    this.combatState = state;

    // Announce state change
    this.announceStateChange(state);

    // Notify callback
    this.callbacks.onCombatStateChange?.(state);
  }

  /**
   * Get current combat state
   */
  getCombatState(): CoordinationCombatState {
    return this.combatState;
  }

  /**
   * Update Marcus's status for coordination decisions
   */
  updateMarcusStatus(status: Partial<MarcusStatusUpdate>): void {
    if (status.health !== undefined) this.marcusHealth = status.health;
    if (status.maxHealth !== undefined) this.marcusMaxHealth = status.maxHealth;
    if (status.shields !== undefined) this.marcusShields = status.shields;
    if (status.maxShields !== undefined) this.marcusMaxShields = status.maxShields;
    if (status.isReloading !== undefined) {
      if (status.isReloading && !this.isReloading) {
        this.sendCallout('reloading');
      }
      this.isReloading = status.isReloading;
    }
    if (status.currentTarget !== undefined) this.currentMarcusTarget = status.currentTarget;

    // Auto-transition to damaged state if health is low
    const healthPercent = this.marcusHealth / this.marcusMaxHealth;
    if (healthPercent <= 0.25 && this.combatState !== 'damaged') {
      this.setCombatState('damaged');
    } else if (healthPercent > 0.5 && this.combatState === 'damaged') {
      // Recovered from damaged state
      this.setCombatState(this.previousCombatState);
    }

    // Shields down callout
    if (status.shields !== undefined && status.shields <= 0 && this.marcusShields > 0) {
      this.sendCallout('shields_down');
    }
  }

  /**
   * Update player position and direction for directional callouts
   */
  updatePlayerPosition(position: Vector3, forward: Vector3): void {
    this.playerPosition = position.clone();
    this.playerForward = forward.clone();
  }

  // ============================================================================
  // PUBLIC METHODS - COORDINATION REQUESTS
  // ============================================================================

  /**
   * Request focus fire on a specific target
   */
  requestFocusFire(target: Entity): CoordinationRequest | null {
    if (!target.transform) return null;

    const request: CoordinationRequest = {
      type: 'focus_fire',
      target,
      position: target.transform.position.clone(),
      duration: 5000,
      startTime: performance.now(),
      acknowledged: true,
    };

    this.activeRequest = request;

    // Highlight the target
    this.highlightTarget(target, TARGET_HIGHLIGHT_COLORS.focusFire);

    // Send callout
    this.sendCallout('focus_fire', true);

    return request;
  }

  /**
   * Request flanking maneuver
   */
  requestFlank(targetPosition: Vector3): CoordinationRequest {
    const request: CoordinationRequest = {
      type: 'flank',
      position: targetPosition.clone(),
      duration: 8000,
      startTime: performance.now(),
      acknowledged: true,
    };

    this.activeRequest = request;

    // Send callout
    this.sendCallout('flanking', true);

    return request;
  }

  /**
   * Request cover fire while player advances
   */
  requestCoverFire(duration: number = 5000): CoordinationRequest {
    const request: CoordinationRequest = {
      type: 'cover_fire',
      position: this.playerPosition.clone(),
      duration,
      startTime: performance.now(),
      acknowledged: true,
    };

    this.activeRequest = request;

    // Send callout
    this.sendCallout('cover_fire', true);

    return request;
  }

  /**
   * Request suppression fire on an area
   */
  requestSuppression(position: Vector3, duration: number = 5000): CoordinationRequest {
    const request: CoordinationRequest = {
      type: 'suppress',
      position: position.clone(),
      duration,
      startTime: performance.now(),
      acknowledged: true,
    };

    this.activeRequest = request;

    // Send callout
    this.sendCallout('cover_fire', true);

    return request;
  }

  /**
   * Get active coordination request
   */
  getActiveRequest(): CoordinationRequest | null {
    if (!this.activeRequest) return null;

    // Check if request has expired
    const elapsed = performance.now() - this.activeRequest.startTime;
    if (elapsed >= this.activeRequest.duration) {
      this.clearActiveRequest();
      return null;
    }

    return this.activeRequest;
  }

  /**
   * Clear the active coordination request
   */
  clearActiveRequest(): void {
    if (this.activeRequest?.target) {
      this.unhighlightTarget(this.activeRequest.target);
    }
    this.activeRequest = null;
  }

  // ============================================================================
  // PUBLIC METHODS - TACTICAL AWARENESS
  // ============================================================================

  /**
   * Analyze enemy positions and send appropriate tactical callouts
   */
  analyzeEnemyPositions(enemies: Entity[]): void {
    if (enemies.length === 0) return;

    // Check for threats in different directions
    let threatsLeft = 0;
    let threatsRight = 0;
    let threatsBehind = 0;
    let heavyThreats = 0;

    for (const enemy of enemies) {
      if (!enemy.transform) continue;

      const toEnemy = enemy.transform.position.subtract(this.playerPosition);
      toEnemy.y = 0;
      toEnemy.normalize();

      // Calculate angle relative to player facing
      const right = Vector3.Cross(Vector3.Up(), this.playerForward).normalize();
      const forward = this.playerForward.clone();
      forward.y = 0;
      forward.normalize();

      const forwardDot = Vector3.Dot(forward, toEnemy);
      const rightDot = Vector3.Dot(right, toEnemy);

      // Behind the player (facing away)
      if (forwardDot < -0.5) {
        threatsBehind++;
      }
      // To the left
      else if (rightDot < -0.5 && forwardDot < 0.5) {
        threatsLeft++;
      }
      // To the right
      else if (rightDot > 0.5 && forwardDot < 0.5) {
        threatsRight++;
      }

      // Check for heavy enemies
      if (enemy.tags?.boss || (enemy.health && enemy.health.max >= 150)) {
        heavyThreats++;
      }
    }

    // Send appropriate callouts based on threat assessment
    if (threatsBehind >= 2) {
      this.sendCallout('enemy_behind');
    } else if (threatsLeft >= 3) {
      this.sendCallout('enemy_left');
    } else if (threatsRight >= 3) {
      this.sendCallout('enemy_right');
    }

    if (heavyThreats > 0) {
      this.sendCallout('heavy_incoming');
    }
  }

  /**
   * Notify when Marcus takes damage
   */
  onMarcusDamage(amount: number): void {
    if (amount >= 50) {
      this.sendCallout('taking_damage');
    }
  }

  /**
   * Assign target priorities between Marcus and player
   */
  assignTargetPriorities(enemies: Entity[]): Map<string, CoordinationTarget> {
    const assignments = new Map<string, CoordinationTarget>();

    for (const enemy of enemies) {
      if (!enemy.transform || !enemy.renderable?.mesh) continue;

      const mesh = enemy.renderable.mesh as Mesh;
      const distToPlayer = Vector3.Distance(enemy.transform.position, this.playerPosition);

      // Calculate priority based on distance and threat level
      let priority = Math.max(0, 100 - distToPlayer);
      if (enemy.tags?.boss) priority += 50;
      if (enemy.health && enemy.health.current < enemy.health.max * 0.3) priority += 20;

      // Assign based on state and position
      let assignedTo: 'player' | 'marcus' | 'shared' = 'shared';
      let highlightColor = TARGET_HIGHLIGHT_COLORS.shared;

      if (this.combatState === 'aggressive') {
        // Marcus takes priority targets
        if (priority > 80) {
          assignedTo = 'marcus';
          highlightColor = TARGET_HIGHLIGHT_COLORS.marcus;
        }
      } else if (this.combatState === 'defensive') {
        // Marcus intercepts close threats
        if (distToPlayer < 15) {
          assignedTo = 'marcus';
          highlightColor = TARGET_HIGHLIGHT_COLORS.marcus;
        }
      } else if (this.combatState === 'support') {
        // Marcus supports player's targets
        if (distToPlayer > 25) {
          assignedTo = 'marcus';
          highlightColor = TARGET_HIGHLIGHT_COLORS.marcus;
        }
      }

      const coordTarget: CoordinationTarget = {
        entity: enemy,
        mesh,
        priority,
        assignedTo,
        highlightColor,
        calloutTime: 0,
        isHighlighted: false,
      };

      assignments.set(enemy.id, coordTarget);
    }

    this.coordinatedTargets = assignments;
    return assignments;
  }

  /**
   * Get the target currently assigned to Marcus
   */
  getMarcusAssignedTarget(): CoordinationTarget | null {
    // If there's an active focus fire request, that takes priority
    if (this.activeRequest?.type === 'focus_fire' && this.activeRequest.target) {
      const target = this.coordinatedTargets.get(this.activeRequest.target.id);
      if (target) return target;
    }

    // Otherwise find highest priority target assigned to Marcus
    let bestTarget: CoordinationTarget | null = null;

    for (const target of this.coordinatedTargets.values()) {
      if (target.assignedTo === 'marcus' || target.assignedTo === 'shared') {
        if (!bestTarget || target.priority > bestTarget.priority) {
          bestTarget = target;
        }
      }
    }

    return bestTarget;
  }

  // ============================================================================
  // PUBLIC METHODS - VISUAL FEEDBACK
  // ============================================================================

  /**
   * Highlight a target for coordination
   */
  highlightTarget(target: Entity, color: Color3): void {
    if (!target.renderable?.mesh || !this.highlightLayer) return;

    const mesh = target.renderable.mesh as Mesh;

    // Add to highlight layer
    this.highlightLayer.addMesh(mesh, color);

    // Create overhead marker
    this.createTargetMarker(target, color);

    // Update coordination target state
    const coordTarget = this.coordinatedTargets.get(target.id);
    if (coordTarget) {
      coordTarget.isHighlighted = true;
      coordTarget.highlightColor = color;
    }

    this.callbacks.onTargetHighlight?.(target, color);
  }

  /**
   * Remove highlight from target
   */
  unhighlightTarget(target: Entity): void {
    if (!target.renderable?.mesh || !this.highlightLayer) return;

    const mesh = target.renderable.mesh as Mesh;

    // Remove from highlight layer
    this.highlightLayer.removeMesh(mesh);

    // Remove overhead marker
    this.removeTargetMarker(target);

    // Update coordination target state
    const coordTarget = this.coordinatedTargets.get(target.id);
    if (coordTarget) {
      coordTarget.isHighlighted = false;
    }

    this.callbacks.onTargetUnhighlight?.(target);
  }

  /**
   * Create an overhead marker for a target
   */
  private createTargetMarker(target: Entity, color: Color3): void {
    if (!target.transform) return;

    const marker = MeshBuilder.CreateTorus(
      `targetMarker_${target.id}`,
      {
        diameter: 2,
        thickness: 0.15,
        tessellation: 16,
      },
      this.scene
    );

    const mat = new StandardMaterial(`targetMarkerMat_${target.id}`, this.scene);
    mat.emissiveColor = color;
    mat.disableLighting = true;
    mat.alpha = 0.8;
    marker.material = mat;

    marker.position = target.transform.position.clone();
    marker.position.y += 3;
    marker.rotation.x = Math.PI / 2;

    this.targetMarkers.set(target.id, marker);

    // Animate the marker
    const animateMarker = () => {
      if (marker.isDisposed()) return;
      if (!target.transform) {
        marker.dispose();
        mat.dispose();
        return;
      }

      // Follow target
      marker.position = target.transform.position.clone();
      marker.position.y += 3;

      // Rotate and pulse
      marker.rotation.z += 0.02;
      const pulse = 0.8 + Math.sin(performance.now() * 0.005) * 0.2;
      mat.alpha = pulse;

      requestAnimationFrame(animateMarker);
    };
    requestAnimationFrame(animateMarker);
  }

  /**
   * Remove target marker
   */
  private removeTargetMarker(target: Entity): void {
    const marker = this.targetMarkers.get(target.id);
    if (marker) {
      marker.material?.dispose();
      marker.dispose();
      this.targetMarkers.delete(target.id);
    }
  }

  // ============================================================================
  // PUBLIC METHODS - UPDATE
  // ============================================================================

  /**
   * Update coordinator each frame
   */
  update(_deltaTime: number, enemies: Entity[]): void {
    // Update active request status
    this.getActiveRequest();

    // Analyze enemy positions periodically (every 500ms)
    const now = performance.now();
    if (now - this.lastGlobalCalloutTime > 2000) {
      this.analyzeEnemyPositions(enemies);
    }

    // Update target assignments
    this.assignTargetPriorities(enemies);

    // Clean up markers for dead enemies
    for (const [entityId, marker] of this.targetMarkers) {
      const target = this.coordinatedTargets.get(entityId);
      if (!target || (target.entity.health && target.entity.health.current <= 0)) {
        marker.material?.dispose();
        marker.dispose();
        this.targetMarkers.delete(entityId);
      }
    }
  }

  // ============================================================================
  // PRIVATE METHODS - CALLOUTS
  // ============================================================================

  /**
   * Send a tactical callout
   */
  private sendCallout(type: TacticalCalloutType, force: boolean = false): void {
    const now = performance.now();

    // Check global cooldown
    if (!force && now - this.lastGlobalCalloutTime < this.globalCalloutCooldown) {
      return;
    }

    // Check type-specific cooldown
    const lastTime = this.lastCalloutTime.get(type) || 0;
    if (!force && now - lastTime < this.calloutCooldown) {
      return;
    }

    // Get random callout text
    const callouts = TACTICAL_CALLOUTS[type];
    const text = callouts[Math.floor(Math.random() * callouts.length)];

    // Send message
    this.callbacks.onCommsMessage({
      ...MARCUS_CHARACTER,
      text,
    });

    // Update cooldowns
    this.lastCalloutTime.set(type, now);
    this.lastGlobalCalloutTime = now;
  }

  /**
   * Announce combat state change
   */
  private announceStateChange(state: CoordinationCombatState): void {
    const callouts = COMBAT_STATE_CALLOUTS[state];
    const text = callouts[Math.floor(Math.random() * callouts.length)];

    this.callbacks.onCommsMessage({
      ...MARCUS_CHARACTER,
      text,
    });

    // Also send notification if available
    const notificationText = `MARCUS: ${state.toUpperCase()} MODE`;
    this.callbacks.onNotification?.(notificationText, 1500);

    this.lastGlobalCalloutTime = performance.now();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Dispose coordinator resources
   */
  dispose(): void {
    // Remove all highlights
    for (const target of this.coordinatedTargets.values()) {
      if (target.entity.renderable?.mesh && this.highlightLayer) {
        this.highlightLayer.removeMesh(target.entity.renderable.mesh as Mesh);
      }
    }

    // Dispose markers
    for (const marker of this.targetMarkers.values()) {
      marker.material?.dispose();
      marker.dispose();
    }
    this.targetMarkers.clear();

    // Dispose highlight layer
    this.highlightLayer?.dispose();
    this.highlightLayer = null;

    // Clear state
    this.coordinatedTargets.clear();
    this.activeRequest = null;
    this.lastCalloutTime.clear();
  }
}
