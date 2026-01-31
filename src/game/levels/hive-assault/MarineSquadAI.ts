/**
 * MarineSquadAI - NPC marine squad behavior system
 *
 * Each squad has 4 marines operating in formation with tactical AI:
 *
 * FORMATIONS:
 * - Diamond: Default patrol/movement, one point, two flanks, one rear
 * - Line: Assault formation, all marines abreast for maximum firepower
 * - Cover: Defensive posture, marines spread to available cover positions
 *
 * ORDERS:
 * - follow_player: Squad moves with player, engages targets of opportunity
 * - hold_position: Squad stays at assigned position, defends area
 * - advance: Squad pushes forward toward waypoint
 * - retreat: Squad falls back to previous position
 *
 * COMBAT BEHAVIOR:
 * - Marines seek cover when taking fire
 * - Suppressive fire on detected enemies
 * - Call out threats over radio
 * - Revivable when downed (player approaches and holds interact)
 *
 * HEALTH MODEL:
 * - Each marine has individual HP
 * - When HP reaches 0, marine is "downed" (not dead)
 * - Downed marines can be revived by player proximity + interact hold
 * - If all squad members are downed, squad is "wiped"
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import type { CommsMessage } from '../../types';

// Marine GLB model paths
const MARINE_GLBS = [
  '/models/npcs/marine/marine_soldier.glb',
  '/models/npcs/marine/marine_sergeant.glb',
  '/models/npcs/marine/marine_elite.glb',
  '/models/npcs/marine/marine_crusader.glb',
] as const;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SquadFormation = 'diamond' | 'line' | 'cover';
export type SquadOrder = 'follow_player' | 'hold_position' | 'advance' | 'retreat';

export type MarineState =
  | 'idle'
  | 'moving'
  | 'combat'
  | 'taking_cover'
  | 'suppressing'
  | 'downed'
  | 'reviving';

export interface Marine {
  id: string;
  squadId: string;
  name: string;
  rootNode: TransformNode;
  bodyMesh: Mesh;
  helmetMesh: Mesh;
  weaponMesh: Mesh;
  health: number;
  maxHealth: number;
  state: MarineState;
  position: Vector3;
  targetPosition: Vector3;
  moveSpeed: number;
  /** Accumulated fire cooldown */
  fireCooldown: number;
  fireRate: number;
  damage: number;
  attackRange: number;
  /** Time remaining for revive (player must stay close for duration) */
  reviveProgress: number;
  /** Total time to revive a downed marine (seconds) */
  reviveTime: number;
  /** Current target entity being fired upon */
  targetEnemyPos: Vector3 | null;
  /** Time since last callout to prevent spam */
  lastCalloutTime: number;
  /** Is this marine alive (not downed)? */
  isActive: boolean;
}

export interface MarineSquad {
  id: string;
  callsign: string;
  marines: Marine[];
  formation: SquadFormation;
  order: SquadOrder;
  /** Center position of the squad */
  position: Vector3;
  /** Assigned waypoint for advance/hold orders */
  waypointPosition: Vector3;
  /** Is the entire squad wiped out? */
  isWiped: boolean;
  /** Number of active (non-downed) marines */
  activeCount: number;
  /** Squad morale affects accuracy and aggressiveness */
  morale: number;
  /** Whether the squad has been saved by the player (scripted event flag) */
  wasRescued: boolean;
}

export interface EnemyTarget {
  position: Vector3;
  health: number;
  threatLevel: 'low' | 'medium' | 'high';
}

export interface MarineSquadCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onNotification: (text: string, duration?: number) => void;
  onMarineRevived: (marine: Marine) => void;
  onSquadWiped: (squad: MarineSquad) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MARINE_MAX_HEALTH = 100;
const MARINE_FIRE_RATE = 2.5; // shots per second
const MARINE_DAMAGE = 12;
const MARINE_ATTACK_RANGE = 50;
const MARINE_MOVE_SPEED = 6;
const MARINE_SPRINT_SPEED = 9; // when catching up to player
const REVIVE_TIME = 3.0; // seconds of holding interact
const REVIVE_PROXIMITY = 4; // meters
const CALLOUT_COOLDOWN = 8; // seconds between callouts per marine
const COVER_SEEK_RADIUS = 15; // how far a marine will look for cover
const MORALE_RECOVERY_RATE = 0.02; // per second
const MORALE_LOSS_PER_DOWN = 0.2;
const MARINE_ACCURACY_BASE = 0.7; // base hit chance
const MARINE_ACCURACY_MORALE_BONUS = 0.2; // bonus from high morale
const MARINE_FOLLOW_DISTANCE = 8; // meters behind player

// Formation offsets relative to squad center
const FORMATION_OFFSETS: Record<SquadFormation, Vector3[]> = {
  diamond: [
    new Vector3(0, 0, 3), // Point
    new Vector3(-2.5, 0, 0), // Left flank
    new Vector3(2.5, 0, 0), // Right flank
    new Vector3(0, 0, -3), // Rear guard
  ],
  line: [
    new Vector3(-4, 0, 0),
    new Vector3(-1.3, 0, 0),
    new Vector3(1.3, 0, 0),
    new Vector3(4, 0, 0),
  ],
  cover: [
    new Vector3(-5, 0, 2),
    new Vector3(5, 0, 2),
    new Vector3(-3, 0, -3),
    new Vector3(3, 0, -3),
  ],
};

// Squad callsigns
const SQUAD_CALLSIGNS = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];

// Marine first names for callouts
const MARINE_NAMES = [
  'Rodriguez',
  'Chen',
  'Kowalski',
  'Okafor',
  'Singh',
  'Petrov',
  'Nakamura',
  'Garcia',
  'Kim',
  'Adeyemi',
  'Hansen',
  'Torres',
  'Yamamoto',
  'Mensah',
  'Johansson',
  'Diallo',
];

// Radio callouts
const CALLOUTS = {
  CONTACT: [
    'Contact! Hostiles ahead!',
    'Enemy spotted! Engaging!',
    'We have contact! Opening fire!',
    "Tangos at twelve o'clock!",
  ],
  TAKING_FIRE: [
    'Taking fire! Need support!',
    'Heavy fire on our position!',
    "We're pinned down!",
    'Under heavy fire here!',
  ],
  MAN_DOWN: [
    '%NAME% is down! Need a medic!',
    'Man down! %NAME% is hit!',
    'We lost %NAME%! Marine down!',
    '%NAME% is hit bad!',
  ],
  THREAT_HIGH: [
    'Heavy contact! Big ones incoming!',
    'Armored hostiles! We need heavy weapons!',
    'Watch out, heavy Chitin!',
    'Armored targets approaching!',
  ],
  OVERWHELMED: [
    "We're getting overwhelmed here!",
    'Too many of them! We need backup!',
    "They're everywhere! Help us!",
    "Can't hold them! We need support!",
  ],
  RESCUED: [
    'Thank God! Friendlies! Keep firing!',
    "We're saved! Pushing back!",
    "About time! Let's push these things back!",
    'Reinforcements! We can hold now!',
  ],
  REVIVE_THANKS: [
    'Thanks, I owe you one!',
    "I'm back in the fight!",
    "Patched up! Let's go!",
    'Good as new! Well, close enough.',
  ],
  ADVANCING: [
    'Moving up! Covering fire!',
    'Advancing to next position!',
    'On the move! Watch our six!',
    'Pushing forward! Cover me!',
  ],
  CLEAR: [
    'Area secure!',
    'All clear! Moving on!',
    'Hostiles eliminated!',
    "Clear! Let's keep moving!",
  ],
  FORMATION_CHANGE: [
    'Adjusting formation!',
    'Reforming on your position!',
    'Copy that, changing formation!',
    'Moving to new positions!',
  ],
  COVER: [
    'Taking cover!',
    'Getting to cover!',
    'Find some cover!',
    'Behind the barrier!',
  ],
  RELOAD: [
    'Reloading!',
    'Swapping mags!',
    'Cover me, reloading!',
    'Mag change!',
  ],
  KILL: [
    'Target down!',
    'Got one!',
    'Hostile eliminated!',
    'Tango down!',
  ],
};

// ============================================================================
// MARINE SQUAD MANAGER
// ============================================================================

export class MarineSquadManager {
  private scene: Scene;
  private squads: MarineSquad[] = [];
  private callbacks: MarineSquadCallbacks;
  private time = 0;
  private usedNameIndices: Set<number> = new Set();

  constructor(scene: Scene, callbacks: MarineSquadCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  // ============================================================================
  // SQUAD CREATION
  // ============================================================================

  /**
   * Create a new marine squad at the specified position
   */
  createSquad(
    position: Vector3,
    squadIndex: number,
    initialOrder: SquadOrder = 'follow_player'
  ): MarineSquad {
    const squadId = `squad_${squadIndex}`;
    const callsign = SQUAD_CALLSIGNS[squadIndex] ?? `SQUAD-${squadIndex + 1}`;

    const marines: Marine[] = [];
    for (let i = 0; i < 4; i++) {
      const marine = this.createMarine(squadId, callsign, i, position);
      marines.push(marine);
    }

    const squad: MarineSquad = {
      id: squadId,
      callsign,
      marines,
      formation: 'diamond',
      order: initialOrder,
      position: position.clone(),
      waypointPosition: position.clone(),
      isWiped: false,
      activeCount: 4,
      morale: 1.0,
      wasRescued: false,
    };

    this.squads.push(squad);
    this.updateFormationPositions(squad);
    return squad;
  }

  /**
   * Create a single marine mesh and data
   */
  private createMarine(squadId: string, callsign: string, index: number, basePos: Vector3): Marine {
    const name = this.getUniqueName();
    const marineId = `${squadId}_marine_${index}`;

    const rootNode = new TransformNode(marineId, this.scene);
    rootNode.position = basePos.clone();

    // Load GLB marine model (each squad member gets a different variant)
    const glbPath = MARINE_GLBS[index % MARINE_GLBS.length];
    if (AssetManager.isPathCached(glbPath)) {
      const marineModel = AssetManager.createInstanceByPath(
        glbPath, `${marineId}_model`, this.scene, true, 'npc'
      );
      if (marineModel) {
        marineModel.scaling.setAll(1.0);
        marineModel.parent = rootNode;
      }
    }

    // Invisible proxy meshes to satisfy the Marine interface (body, helmet, weapon)
    const bodyMesh = MeshBuilder.CreateBox(
      `${marineId}_body`,
      { width: 0.6, height: 1.4, depth: 0.4 },
      this.scene
    );
    bodyMesh.position.y = 0.9;
    bodyMesh.parent = rootNode;
    bodyMesh.isVisible = false;

    const helmetMat = new StandardMaterial(`${marineId}_helmetMat`, this.scene);
    helmetMat.diffuseColor = Color3.FromHexString('#4A5A4A');

    const helmetMesh = MeshBuilder.CreateSphere(
      `${marineId}_helmet`,
      { diameter: 0.45, segments: 4 },
      this.scene
    );
    helmetMesh.material = helmetMat;
    helmetMesh.position.y = 1.8;
    helmetMesh.parent = rootNode;
    helmetMesh.isVisible = false;

    const weaponMesh = MeshBuilder.CreateBox(
      `${marineId}_weapon`,
      { width: 0.08, height: 0.08, depth: 0.8 },
      this.scene
    );
    weaponMesh.position.set(0.3, 0.9, 0.3);
    weaponMesh.parent = rootNode;
    weaponMesh.isVisible = false;

    return {
      id: marineId,
      squadId,
      name,
      rootNode,
      bodyMesh,
      helmetMesh,
      weaponMesh,
      health: MARINE_MAX_HEALTH,
      maxHealth: MARINE_MAX_HEALTH,
      state: 'idle',
      position: basePos.clone(),
      targetPosition: basePos.clone(),
      moveSpeed: MARINE_MOVE_SPEED,
      fireCooldown: 0,
      fireRate: MARINE_FIRE_RATE,
      damage: MARINE_DAMAGE,
      attackRange: MARINE_ATTACK_RANGE,
      reviveProgress: 0,
      reviveTime: REVIVE_TIME,
      targetEnemyPos: null,
      lastCalloutTime: -CALLOUT_COOLDOWN, // Allow immediate first callout
      isActive: true,
    };
  }

  /**
   * Get a unique marine name
   */
  private getUniqueName(): string {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * MARINE_NAMES.length);
    } while (this.usedNameIndices.has(idx) && this.usedNameIndices.size < MARINE_NAMES.length);
    this.usedNameIndices.add(idx);
    return MARINE_NAMES[idx];
  }

  // ============================================================================
  // SQUAD COMMANDS
  // ============================================================================

  /**
   * Set formation for a squad
   */
  setFormation(squad: MarineSquad, formation: SquadFormation): void {
    squad.formation = formation;
    this.updateFormationPositions(squad);
  }

  /**
   * Issue an order to a squad
   */
  issueOrder(squad: MarineSquad, order: SquadOrder, waypoint?: Vector3): void {
    squad.order = order;
    if (waypoint) {
      squad.waypointPosition = waypoint.clone();
    }
  }

  /**
   * Set all squads to the same order
   */
  issueGlobalOrder(order: SquadOrder, waypoint?: Vector3): void {
    for (const squad of this.squads) {
      this.issueOrder(squad, order, waypoint);
    }
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  /**
   * Update all marine squads
   */
  update(
    deltaTime: number,
    playerPosition: Vector3,
    enemies: EnemyTarget[],
    coverPositions: Vector3[]
  ): void {
    this.time += deltaTime;

    for (const squad of this.squads) {
      if (squad.isWiped) continue;

      this.updateSquadPosition(squad, playerPosition, deltaTime);
      this.updateFormationPositions(squad);
      this.updateSquadCombat(squad, enemies, coverPositions, deltaTime);
      this.updateSquadMorale(squad, deltaTime);
      this.updateSquadState(squad);
    }
  }

  /**
   * Update squad center position based on order
   */
  private updateSquadPosition(
    squad: MarineSquad,
    playerPosition: Vector3,
    deltaTime: number
  ): void {
    let targetPos: Vector3;
    let moveSpeed = MARINE_MOVE_SPEED;

    const squadIndex = this.squads.indexOf(squad);

    switch (squad.order) {
      case 'follow_player':
        // Follow behind player with squad-specific offset to prevent clumping
        const sideOffset = Math.sin((squadIndex * Math.PI) / 2) * MARINE_FOLLOW_DISTANCE;
        const behindOffset = MARINE_FOLLOW_DISTANCE + squadIndex * 3;
        targetPos = playerPosition.add(new Vector3(sideOffset, 0, behindOffset));

        // Sprint to catch up if too far
        const distToPlayer = Vector3.Distance(squad.position, playerPosition);
        if (distToPlayer > 25) {
          moveSpeed = MARINE_SPRINT_SPEED;
        }
        break;

      case 'hold_position':
        targetPos = squad.waypointPosition;
        moveSpeed = MARINE_MOVE_SPEED * 0.5; // Slow down when holding
        break;

      case 'advance':
        targetPos = squad.waypointPosition;
        moveSpeed = MARINE_SPRINT_SPEED; // Move faster when advancing
        break;

      case 'retreat':
        targetPos = squad.waypointPosition;
        moveSpeed = MARINE_SPRINT_SPEED; // Retreat quickly
        break;

      default:
        targetPos = squad.position;
    }

    // Smooth movement toward target
    const diff = targetPos.subtract(squad.position);
    const distance = diff.length();
    if (distance > 1) {
      const moveDir = diff.normalize();
      const moveAmount = Math.min(distance, moveSpeed * deltaTime);
      squad.position.addInPlace(moveDir.scale(moveAmount));
    }
  }

  /**
   * Calculate formation positions for each marine
   */
  private updateFormationPositions(squad: MarineSquad): void {
    const offsets = FORMATION_OFFSETS[squad.formation];

    for (let i = 0; i < squad.marines.length; i++) {
      const marine = squad.marines[i];
      if (!marine.isActive) continue;

      // Calculate world-space formation position
      const offset = offsets[i] ?? Vector3.Zero();
      marine.targetPosition = squad.position.add(offset);
    }
  }

  /**
   * Update combat behavior for all marines in a squad
   */
  private updateSquadCombat(
    squad: MarineSquad,
    enemies: EnemyTarget[],
    coverPositions: Vector3[],
    deltaTime: number
  ): void {
    const nearbyEnemies = enemies.filter(
      (e) => Vector3.Distance(e.position, squad.position) < MARINE_ATTACK_RANGE * 1.5
    );

    const inCombat = nearbyEnemies.length > 0;

    for (const marine of squad.marines) {
      if (!marine.isActive) {
        // Handle downed marine revive logic
        this.updateDownedMarine(marine, deltaTime);
        continue;
      }

      if (inCombat) {
        this.updateMarineCombat(marine, squad, nearbyEnemies, coverPositions, deltaTime);
      } else {
        this.updateMarineMovement(marine, deltaTime);
        marine.state =
          marine.position.subtract(marine.targetPosition).length() > 1 ? 'moving' : 'idle';
        marine.targetEnemyPos = null;
      }
    }
  }

  /**
   * Update a single marine's combat behavior
   */
  private updateMarineCombat(
    marine: Marine,
    squad: MarineSquad,
    enemies: EnemyTarget[],
    coverPositions: Vector3[],
    deltaTime: number
  ): void {
    // Find best target (prioritize high-threat enemies)
    let bestEnemy: EnemyTarget | null = null;
    let bestScore = -Infinity;

    for (const enemy of enemies) {
      const dist = Vector3.Distance(marine.position, enemy.position);
      if (dist > marine.attackRange) continue;

      // Score based on distance and threat level
      let score = 100 - dist;

      // Prioritize high threat enemies
      if (enemy.threatLevel === 'high') score += 40;
      else if (enemy.threatLevel === 'medium') score += 20;

      // Prioritize low health enemies (finish them off)
      if (enemy.health < 30) score += 25;

      if (score > bestScore) {
        bestScore = score;
        bestEnemy = enemy;
      }
    }

    if (bestEnemy) {
      marine.targetEnemyPos = bestEnemy.position.clone();
      marine.state = 'combat';

      // Face the enemy smoothly
      const lookDir = bestEnemy.position.subtract(marine.position);
      if (lookDir.length() > 0.01) {
        const targetRotY = Math.atan2(lookDir.x, lookDir.z);
        const currentRotY = marine.rootNode.rotation.y;
        const rotDiff = targetRotY - currentRotY;
        marine.rootNode.rotation.y += rotDiff * Math.min(1, deltaTime * 6);
      }

      // Fire weapon with accuracy based on morale
      marine.fireCooldown -= deltaTime;
      if (marine.fireCooldown <= 0) {
        marine.fireCooldown = 1 / marine.fireRate;

        // Calculate hit chance based on morale and distance
        const distanceFactor = 1 - (Vector3.Distance(marine.position, bestEnemy.position) / marine.attackRange) * 0.3;
        const moraleFactor = MARINE_ACCURACY_BASE + squad.morale * MARINE_ACCURACY_MORALE_BONUS;
        const hitChance = distanceFactor * moraleFactor;

        // Store hit result for level to process
        if (Math.random() < hitChance) {
          // Fire event is handled by the level (checking hit registration)
        }
      }

      // Tactical behavior based on health and morale
      const healthPercent = marine.health / marine.maxHealth;

      if (healthPercent < 0.3) {
        // Critically low health - seek cover urgently
        const nearestCover = this.findNearestCover(marine.position, coverPositions);
        if (nearestCover) {
          marine.targetPosition = nearestCover;
          marine.state = 'taking_cover';
        }
      } else if (healthPercent < 0.5 || squad.morale < 0.4) {
        // Low health or morale - fight from cover if available
        const nearestCover = this.findNearestCover(marine.position, coverPositions);
        if (nearestCover && Vector3.Distance(marine.position, nearestCover) < 10) {
          marine.targetPosition = nearestCover;
          marine.state = 'taking_cover';
        }
      } else if (squad.morale > 0.7 && healthPercent > 0.7) {
        // High morale and health - aggressive positioning
        marine.state = 'suppressing';
      }

      // Radio callouts
      this.tryCallout(marine, squad, bestEnemy, enemies.length);
    } else {
      // No enemy in range, advance toward formation position
      this.updateMarineMovement(marine, deltaTime);
      marine.state = 'moving';
    }

    // Move toward target position
    this.updateMarineMovement(marine, deltaTime);
  }

  /**
   * Move marine toward target position
   */
  private updateMarineMovement(marine: Marine, deltaTime: number): void {
    const diff = marine.targetPosition.subtract(marine.position);
    const distance = diff.length();

    if (distance > 0.5) {
      const moveDir = diff.normalize();
      const moveAmount = Math.min(distance, marine.moveSpeed * deltaTime);
      marine.position.addInPlace(moveDir.scale(moveAmount));
    }

    // Update mesh position
    marine.rootNode.position.copyFrom(marine.position);
  }

  /**
   * Find nearest cover position
   */
  private findNearestCover(position: Vector3, coverPositions: Vector3[]): Vector3 | null {
    let nearest: Vector3 | null = null;
    let nearestDist = COVER_SEEK_RADIUS;

    for (const coverPos of coverPositions) {
      const dist = Vector3.Distance(position, coverPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = coverPos;
      }
    }

    return nearest;
  }

  /**
   * Handle downed marine state and revive mechanics
   */
  private updateDownedMarine(marine: Marine, deltaTime: number): void {
    if (marine.state !== 'downed' && marine.state !== 'reviving') return;

    // Visual: marine body slumps
    marine.bodyMesh.position.y = 0.3;
    marine.rootNode.rotation.x = Math.PI / 6;

    if (marine.state === 'reviving') {
      marine.reviveProgress += deltaTime;
      if (marine.reviveProgress >= marine.reviveTime) {
        this.reviveMarine(marine);
      }
    }
  }

  // ============================================================================
  // DAMAGE & REVIVE
  // ============================================================================

  /**
   * Apply damage to a marine
   */
  damageMarine(marine: Marine, damage: number): void {
    if (!marine.isActive) return;

    marine.health -= damage;

    if (marine.health <= 0) {
      marine.health = 0;
      this.downMarine(marine);
    }
  }

  /**
   * Down a marine (incapacitated but revivable)
   */
  private downMarine(marine: Marine): void {
    marine.isActive = false;
    marine.state = 'downed';
    marine.reviveProgress = 0;

    // Update body visual
    marine.bodyMesh.position.y = 0.3;
    marine.rootNode.rotation.x = Math.PI / 6;

    // Dim the helmet to indicate downed
    const helmetMat = marine.helmetMesh.material as StandardMaterial;
    if (helmetMat) {
      helmetMat.emissiveColor = new Color3(0.3, 0.05, 0.05);
    }

    // Find the squad and update count
    const squad = this.squads.find((s) => s.id === marine.squadId);
    if (squad) {
      squad.activeCount = squad.marines.filter((m) => m.isActive).length;
      squad.morale = Math.max(0, squad.morale - MORALE_LOSS_PER_DOWN);

      // Callout
      this.sendSquadComms(
        squad,
        this.pickCallout(CALLOUTS.MAN_DOWN).replace('%NAME%', marine.name)
      );

      // Check if squad is wiped
      if (squad.activeCount === 0) {
        squad.isWiped = true;
        this.callbacks.onSquadWiped(squad);
      }
    }
  }

  /**
   * Start revive process for a downed marine (call when player is near and holding interact)
   */
  startRevive(marine: Marine): void {
    if (marine.state === 'downed') {
      marine.state = 'reviving';
    }
  }

  /**
   * Cancel revive (player moved away or released interact)
   */
  cancelRevive(marine: Marine): void {
    if (marine.state === 'reviving') {
      marine.state = 'downed';
      marine.reviveProgress = 0;
    }
  }

  /**
   * Complete the revive
   */
  private reviveMarine(marine: Marine): void {
    marine.isActive = true;
    marine.state = 'idle';
    marine.health = marine.maxHealth * 0.5; // Revive at half health
    marine.reviveProgress = 0;

    // Reset visuals
    marine.bodyMesh.position.y = 0.9;
    marine.rootNode.rotation.x = 0;

    const helmetMat = marine.helmetMesh.material as StandardMaterial;
    if (helmetMat) {
      helmetMat.emissiveColor = Color3.Black();
    }

    // Update squad
    const squad = this.squads.find((s) => s.id === marine.squadId);
    if (squad) {
      squad.activeCount = squad.marines.filter((m) => m.isActive).length;
      squad.isWiped = false;

      this.sendSquadComms(squad, this.pickCallout(CALLOUTS.REVIVE_THANKS));
    }

    this.callbacks.onMarineRevived(marine);
  }

  /**
   * Check if player is near any downed marine and return them
   */
  getDownedMarinesNearPlayer(playerPosition: Vector3): Marine[] {
    const downed: Marine[] = [];

    for (const squad of this.squads) {
      for (const marine of squad.marines) {
        if (
          (marine.state === 'downed' || marine.state === 'reviving') &&
          Vector3.Distance(marine.position, playerPosition) <= REVIVE_PROXIMITY
        ) {
          downed.push(marine);
        }
      }
    }

    return downed;
  }

  // ============================================================================
  // CALLOUTS & COMMS
  // ============================================================================

  /**
   * Try to emit a radio callout (respects cooldown)
   */
  private tryCallout(
    marine: Marine,
    squad: MarineSquad,
    closestEnemy: EnemyTarget,
    enemyCount: number
  ): void {
    if (this.time - marine.lastCalloutTime < CALLOUT_COOLDOWN) return;

    let callout: string | null = null;

    // Priority: overwhelmed > threat_high > contact
    if (enemyCount > 8 && squad.morale < 0.5) {
      callout = this.pickCallout(CALLOUTS.OVERWHELMED);
    } else if (closestEnemy.threatLevel === 'high') {
      callout = this.pickCallout(CALLOUTS.THREAT_HIGH);
    } else if (marine.fireCooldown <= 0) {
      // Only on first engagement
      callout = this.pickCallout(CALLOUTS.CONTACT);
    }

    if (callout) {
      marine.lastCalloutTime = this.time;
      this.sendSquadComms(squad, callout, marine.name);
    }
  }

  /**
   * Send a comms message from a squad
   */
  private sendSquadComms(squad: MarineSquad, text: string, marineName?: string): void {
    const sender = marineName ? `Pvt. ${marineName}` : `${squad.callsign} Lead`;

    this.callbacks.onCommsMessage({
      sender,
      callsign: squad.callsign,
      portrait: 'player', // Marines use generic portrait
      text,
    });
  }

  /**
   * Trigger the "rescued" callout for a squad
   */
  triggerRescueCallout(squad: MarineSquad): void {
    if (squad.wasRescued) return;
    squad.wasRescued = true;
    this.sendSquadComms(squad, this.pickCallout(CALLOUTS.RESCUED));
  }

  /**
   * Pick a random callout from a list
   */
  private pickCallout(callouts: string[]): string {
    return callouts[Math.floor(Math.random() * callouts.length)];
  }

  // ============================================================================
  // MORALE & STATE
  // ============================================================================

  /**
   * Update squad morale (recovers over time if not losing marines)
   */
  private updateSquadMorale(squad: MarineSquad, deltaTime: number): void {
    if (squad.morale < 1.0 && squad.activeCount > 0) {
      squad.morale = Math.min(1.0, squad.morale + MORALE_RECOVERY_RATE * deltaTime);
    }
  }

  /**
   * Update squad aggregate state
   */
  private updateSquadState(squad: MarineSquad): void {
    squad.activeCount = squad.marines.filter((m) => m.isActive).length;

    if (squad.activeCount === 0 && !squad.isWiped) {
      squad.isWiped = true;
      this.callbacks.onSquadWiped(squad);
    }
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get all squads
   */
  getSquads(): MarineSquad[] {
    return this.squads;
  }

  /**
   * Get all active marines across all squads
   */
  getActiveMarines(): Marine[] {
    return this.squads.flatMap((s) => s.marines.filter((m) => m.isActive));
  }

  /**
   * Get all marines (including downed)
   */
  getAllMarines(): Marine[] {
    return this.squads.flatMap((s) => s.marines);
  }

  /**
   * Get marines that are firing (have fireCooldown ready)
   */
  getFiringMarines(): { marine: Marine; targetPos: Vector3 }[] {
    const firing: { marine: Marine; targetPos: Vector3 }[] = [];

    for (const squad of this.squads) {
      for (const marine of squad.marines) {
        if (
          marine.isActive &&
          marine.state === 'combat' &&
          marine.fireCooldown <= 0 &&
          marine.targetEnemyPos
        ) {
          firing.push({ marine, targetPos: marine.targetEnemyPos });
        }
      }
    }

    return firing;
  }

  /**
   * Get total active marine count
   */
  getActiveMarineCount(): number {
    return this.squads.reduce((sum, s) => sum + s.activeCount, 0);
  }

  /**
   * Get squad by index
   */
  getSquad(index: number): MarineSquad | undefined {
    return this.squads[index];
  }

  // ============================================================================
  // SCRIPTED EVENTS
  // ============================================================================

  /**
   * Simulate a squad taking heavy damage (scripted ambush event)
   */
  simulateSquadUnderFire(squadIndex: number, damagePerMarine: number): void {
    const squad = this.squads[squadIndex];
    if (!squad) return;

    for (const marine of squad.marines) {
      if (marine.isActive) {
        this.damageMarine(marine, damagePerMarine);
      }
    }
  }

  /**
   * Set a squad to an overwhelmed state (scripted moment)
   */
  setSquadOverwhelmed(squadIndex: number): void {
    const squad = this.squads[squadIndex];
    if (!squad) return;

    squad.morale = 0.2;
    squad.formation = 'cover';
    squad.order = 'hold_position';

    this.sendSquadComms(squad, this.pickCallout(CALLOUTS.OVERWHELMED));
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    for (const squad of this.squads) {
      for (const marine of squad.marines) {
        marine.rootNode.dispose();
        marine.bodyMesh.dispose();
        marine.helmetMesh.dispose();
        marine.weaponMesh.dispose();
      }
    }
    this.squads = [];
    this.usedNameIndices.clear();
  }
}
