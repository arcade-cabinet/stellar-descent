/**
 * ScoutingSystem - Marcus Scouting Mission Management
 *
 * Enables player to order Marcus to scout ahead, discover enemies,
 * find collectibles, and report back with tactical intelligence.
 *
 * SCOUTING FEATURES:
 * - SCOUT command - Marcus pathfinds to distant scout position
 * - Enemy detection and position reporting
 * - Collectible/secret discovery
 * - Status updates via comms ("Moving to scout position", "Contact!", etc.)
 * - Safe return pathfinding back to player
 *
 * INTEGRATION:
 * - Works with MarcusSteeringAI for pathfinding
 * - Integrates with SquadCommandSystem for command handling
 * - Uses NavMeshBuilder for navigation mesh queries
 */

import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Entity } from '../core/ecs';
import type { CommsMessage } from '../types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ScoutingState =
  | 'idle' // Not scouting
  | 'moving_to_position' // En route to scout position
  | 'scanning' // At position, scanning for threats
  | 'returning' // Returning to player
  | 'reporting'; // Delivering intel report

export type IntelType =
  | 'enemy_contact' // Enemy spotted
  | 'enemy_group' // Multiple enemies
  | 'collectible' // Found pickup
  | 'secret' // Found secret area
  | 'area_clear' // No threats found
  | 'danger_zone'; // Area is heavily defended

export interface ScoutWaypoint {
  position: BabylonVector3;
  scanned: boolean;
  intel: IntelReport[];
  arrivalTime: number | null;
  scanDuration: number;
}

export interface IntelReport {
  type: IntelType;
  position: BabylonVector3;
  description: string;
  timestamp: number;
  entityIds?: string[];
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
  collectibleType?: string;
}

export interface ScoutingCallbacks {
  onCommsMessage: (message: CommsMessage) => void;
  onNotification: (text: string, duration: number) => void;
  onIntelReceived?: (intel: IntelReport) => void;
  onScoutingComplete?: (reports: IntelReport[]) => void;
  onEnemyMarked?: (position: BabylonVector3, threatLevel: string) => void;
  onCollectibleMarked?: (position: BabylonVector3, type: string) => void;
}

export interface ScoutingConfig {
  /** How long Marcus scans at each waypoint (ms) */
  scanDuration: number;
  /** Detection radius for enemies */
  enemyDetectionRadius: number;
  /** Detection radius for collectibles */
  collectibleDetectionRadius: number;
  /** Minimum distance from player for scout positions */
  minScoutDistance: number;
  /** Maximum distance from player for scout positions */
  maxScoutDistance: number;
  /** Cooldown between scout missions (ms) */
  missionCooldown: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: ScoutingConfig = {
  scanDuration: 3000,
  enemyDetectionRadius: 40,
  collectibleDetectionRadius: 25,
  minScoutDistance: 20,
  maxScoutDistance: 80,
  missionCooldown: 10000,
};

// Marcus character for comms messages
const MARCUS_CHARACTER: Pick<CommsMessage, 'sender' | 'callsign' | 'portrait'> = {
  sender: 'Corporal Marcus Cole',
  callsign: 'HAMMER',
  portrait: 'marcus',
};

// Scouting dialogue pools
const SCOUTING_DIALOGUE = {
  MOVING_TO_POSITION: [
    'Moving to scout position.',
    'Roger, scouting ahead.',
    "I'll check it out.",
    'HAMMER moving to recon.',
    'On my way to scout.',
  ],
  ARRIVED_AT_POSITION: [
    'In position. Scanning.',
    'Reached scout point. Eyes open.',
    "I'm here. Let me take a look.",
    'At the waypoint. Surveying area.',
  ],
  CONTACT_SINGLE: [
    'Contact! Single hostile detected.',
    'Got one! Enemy spotted ahead.',
    "I see one. It hasn't seen me.",
    'Hostile sighted. Marking position.',
  ],
  CONTACT_GROUP: [
    'Multiple contacts! Count {count} hostiles.',
    'Group of enemies ahead! {count} tangos.',
    'Heavy presence! I see {count} of them.',
    'Watch out, James. {count} hostiles grouped up.',
  ],
  AREA_CLEAR: [
    'Area clear. No contacts.',
    'Nothing here. Moving on.',
    'All clear at this position.',
    'No hostiles detected.',
  ],
  DANGER_ZONE: [
    "Heavy enemy presence! Don't come this way!",
    'Bad news - this area is crawling with them.',
    'Danger zone! Multiple high-threat contacts.',
    'Abort approach! Too many hostiles!',
  ],
  FOUND_COLLECTIBLE: [
    'Found something interesting here.',
    'There is a pickup nearby.',
    'Marking a supply cache.',
    'Something useful over here, James.',
  ],
  FOUND_SECRET: [
    'Wait... there is a hidden area here!',
    'Secret passage! Marking it for you.',
    'Hidden cache discovered!',
    'I found a secret! Check your map.',
  ],
  RETURNING: [
    'Intel gathered. Heading back.',
    'Returning to your position.',
    'Scouting complete. On my way back.',
    'Coming back to you, James.',
  ],
  REPORT_SUMMARY: [
    'Scout report: {summary}',
    'Here is what I found: {summary}',
    'Intel report ready: {summary}',
    'Scouting mission complete. {summary}',
  ],
};

// ============================================================================
// SCOUTING SYSTEM CLASS
// ============================================================================

export class ScoutingSystem {
  private scene: Scene;
  private config: ScoutingConfig;
  private callbacks: ScoutingCallbacks;

  // Scouting state
  private state: ScoutingState = 'idle';
  private waypoints: ScoutWaypoint[] = [];
  private currentWaypointIndex: number = 0;
  private collectedIntel: IntelReport[] = [];

  // Timing
  private stateStartTime: number = 0;
  private lastMissionTime: number = 0;
  private scanStartTime: number = 0;

  // Position tracking
  private marcusPosition: BabylonVector3 = BabylonVector3.Zero();
  private playerPosition: BabylonVector3 = BabylonVector3.Zero();

  // References for detection
  private knownEnemies: Entity[] = [];
  private knownCollectibles: { position: BabylonVector3; type: string; id: string }[] = [];

  // Dialogue cooldowns
  private lastDialogueTime: number = 0;
  private dialogueCooldown: number = 2000;

  constructor(scene: Scene, callbacks: ScoutingCallbacks, config?: Partial<ScoutingConfig>) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // PUBLIC METHODS - MISSION CONTROL
  // ============================================================================

  /**
   * Start a scouting mission to a single position.
   * Returns false if on cooldown or already scouting.
   */
  startScoutMission(targetPosition: BabylonVector3): boolean {
    const now = performance.now();

    // Check cooldown
    if (now - this.lastMissionTime < this.config.missionCooldown) {
      this.callbacks.onNotification('Scout mission on cooldown', 1500);
      return false;
    }

    // Check if already scouting
    if (this.state !== 'idle') {
      this.callbacks.onNotification('Already scouting', 1500);
      return false;
    }

    // Validate distance
    const distance = BabylonVector3.Distance(this.playerPosition, targetPosition);
    if (distance < this.config.minScoutDistance) {
      this.callbacks.onNotification('Position too close', 1500);
      return false;
    }
    if (distance > this.config.maxScoutDistance) {
      this.callbacks.onNotification('Position too far', 1500);
      return false;
    }

    // Initialize mission
    this.waypoints = [
      {
        position: targetPosition.clone(),
        scanned: false,
        intel: [],
        arrivalTime: null,
        scanDuration: this.config.scanDuration,
      },
    ];
    this.currentWaypointIndex = 0;
    this.collectedIntel = [];
    this.lastMissionTime = now;

    // Start moving
    this.setState('moving_to_position');
    this.sendDialogue('MOVING_TO_POSITION');

    return true;
  }

  /**
   * Start a multi-waypoint scouting patrol.
   */
  startPatrolMission(waypoints: BabylonVector3[]): boolean {
    if (waypoints.length === 0) return false;

    const now = performance.now();

    if (now - this.lastMissionTime < this.config.missionCooldown) {
      this.callbacks.onNotification('Scout mission on cooldown', 1500);
      return false;
    }

    if (this.state !== 'idle') {
      this.callbacks.onNotification('Already scouting', 1500);
      return false;
    }

    // Initialize patrol waypoints
    this.waypoints = waypoints.map((pos) => ({
      position: pos.clone(),
      scanned: false,
      intel: [],
      arrivalTime: null,
      scanDuration: this.config.scanDuration,
    }));
    this.currentWaypointIndex = 0;
    this.collectedIntel = [];
    this.lastMissionTime = now;

    // Start moving
    this.setState('moving_to_position');
    this.sendDialogue('MOVING_TO_POSITION');

    return true;
  }

  /**
   * Cancel the current scouting mission.
   * Marcus will return to player immediately.
   */
  cancelMission(): void {
    if (this.state === 'idle') return;

    this.setState('returning');
    this.callbacks.onNotification('Scout mission cancelled', 1500);
  }

  /**
   * Check if Marcus is currently scouting.
   */
  isScouting(): boolean {
    return this.state !== 'idle';
  }

  /**
   * Get current scouting state.
   */
  getState(): ScoutingState {
    return this.state;
  }

  /**
   * Get the current target position Marcus is moving to.
   */
  getCurrentTargetPosition(): BabylonVector3 | null {
    if (this.state === 'idle') return null;

    if (this.state === 'returning') {
      return this.playerPosition.clone();
    }

    if (this.currentWaypointIndex < this.waypoints.length) {
      return this.waypoints[this.currentWaypointIndex].position.clone();
    }

    return null;
  }

  /**
   * Get all waypoints in the current mission.
   */
  getWaypoints(): ScoutWaypoint[] {
    return this.waypoints;
  }

  /**
   * Get all collected intel from the current/last mission.
   */
  getCollectedIntel(): IntelReport[] {
    return this.collectedIntel;
  }

  // ============================================================================
  // PUBLIC METHODS - STATE UPDATES
  // ============================================================================

  /**
   * Update Marcus position (called by MarcusSteeringAI).
   */
  updateMarcusPosition(position: BabylonVector3): void {
    this.marcusPosition = position.clone();
  }

  /**
   * Update player position.
   */
  updatePlayerPosition(position: BabylonVector3): void {
    this.playerPosition = position.clone();
  }

  /**
   * Update known enemies for detection.
   */
  updateKnownEnemies(enemies: Entity[]): void {
    this.knownEnemies = enemies;
  }

  /**
   * Update known collectibles for detection.
   */
  updateKnownCollectibles(
    collectibles: { position: BabylonVector3; type: string; id: string }[]
  ): void {
    this.knownCollectibles = collectibles;
  }

  /**
   * Main update loop - call each frame.
   */
  update(_deltaTime: number): void {
    if (this.state === 'idle') return;

    const now = performance.now();

    switch (this.state) {
      case 'moving_to_position':
        this.updateMovingToPosition();
        break;

      case 'scanning':
        this.updateScanning(now);
        break;

      case 'returning':
        this.updateReturning();
        break;

      case 'reporting':
        this.updateReporting(now);
        break;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - STATE UPDATES
  // ============================================================================

  private updateMovingToPosition(): void {
    const waypoint = this.waypoints[this.currentWaypointIndex];
    if (!waypoint) {
      this.setState('returning');
      return;
    }

    // Check if arrived at waypoint
    const distance = BabylonVector3.Distance(this.marcusPosition, waypoint.position);
    if (distance < 5) {
      // Arrived - start scanning
      waypoint.arrivalTime = performance.now();
      this.scanStartTime = performance.now();
      this.setState('scanning');
      this.sendDialogue('ARRIVED_AT_POSITION');
    }
  }

  private updateScanning(now: number): void {
    const waypoint = this.waypoints[this.currentWaypointIndex];
    if (!waypoint) {
      this.setState('returning');
      return;
    }

    // Perform enemy detection
    const detectedEnemies = this.detectEnemies();
    const detectedCollectibles = this.detectCollectibles();

    // Report contacts
    for (const enemyGroup of detectedEnemies) {
      const alreadyReported = waypoint.intel.some(
        (i) => i.type === enemyGroup.type && i.position.equals(enemyGroup.position)
      );

      if (!alreadyReported) {
        waypoint.intel.push(enemyGroup);
        this.collectedIntel.push(enemyGroup);
        this.reportIntel(enemyGroup);
      }
    }

    // Report collectibles
    for (const collectible of detectedCollectibles) {
      const alreadyReported = waypoint.intel.some(
        (i) =>
          (i.type === 'collectible' || i.type === 'secret') &&
          i.position.equals(collectible.position)
      );

      if (!alreadyReported) {
        waypoint.intel.push(collectible);
        this.collectedIntel.push(collectible);
        this.reportIntel(collectible);
      }
    }

    // Check if scan complete
    if (now - this.scanStartTime >= waypoint.scanDuration) {
      waypoint.scanned = true;

      // Report area clear if nothing found
      if (waypoint.intel.length === 0) {
        const clearReport: IntelReport = {
          type: 'area_clear',
          position: waypoint.position.clone(),
          description: 'No threats detected',
          timestamp: now,
        };
        waypoint.intel.push(clearReport);
        this.collectedIntel.push(clearReport);
        this.sendDialogue('AREA_CLEAR');
      }

      // Move to next waypoint or return
      this.currentWaypointIndex++;
      if (this.currentWaypointIndex < this.waypoints.length) {
        this.setState('moving_to_position');
        this.sendDialogue('MOVING_TO_POSITION');
      } else {
        this.setState('returning');
        this.sendDialogue('RETURNING');
      }
    }
  }

  private updateReturning(): void {
    // Check if arrived back at player
    const distance = BabylonVector3.Distance(this.marcusPosition, this.playerPosition);
    if (distance < 10) {
      this.setState('reporting');
      this.stateStartTime = performance.now();
      this.deliverReport();
    }
  }

  private updateReporting(now: number): void {
    // Stay in reporting state briefly, then return to idle
    if (now - this.stateStartTime > 2000) {
      this.setState('idle');
      this.callbacks.onScoutingComplete?.(this.collectedIntel);
    }
  }

  // ============================================================================
  // PRIVATE METHODS - DETECTION
  // ============================================================================

  private detectEnemies(): IntelReport[] {
    const reports: IntelReport[] = [];
    const detectionRadius = this.config.enemyDetectionRadius;

    // Group nearby enemies by position
    const enemyGroups: Map<string, { enemies: Entity[]; center: BabylonVector3 }> = new Map();

    for (const enemy of this.knownEnemies) {
      if (!enemy.transform || !enemy.health || enemy.health.current <= 0) continue;

      const dist = BabylonVector3.Distance(this.marcusPosition, enemy.transform.position);
      if (dist > detectionRadius) continue;

      // Create grid key for grouping nearby enemies
      const gridX = Math.floor(enemy.transform.position.x / 10);
      const gridZ = Math.floor(enemy.transform.position.z / 10);
      const key = `${gridX},${gridZ}`;

      if (!enemyGroups.has(key)) {
        enemyGroups.set(key, { enemies: [], center: enemy.transform.position.clone() });
      }
      enemyGroups.get(key)!.enemies.push(enemy);
    }

    // Create intel reports for each group
    for (const group of enemyGroups.values()) {
      const count = group.enemies.length;
      const threatLevel = this.assessThreatLevel(group.enemies);

      const report: IntelReport = {
        type: count === 1 ? 'enemy_contact' : 'enemy_group',
        position: group.center,
        description: count === 1 ? 'Single hostile detected' : `${count} hostiles grouped`,
        timestamp: performance.now(),
        entityIds: group.enemies.map((e) => e.id),
        threatLevel,
      };

      // Check for danger zone
      if (count >= 5 || threatLevel === 'critical') {
        report.type = 'danger_zone';
        report.description = 'Heavy enemy presence';
      }

      reports.push(report);
    }

    return reports;
  }

  private detectCollectibles(): IntelReport[] {
    const reports: IntelReport[] = [];
    const detectionRadius = this.config.collectibleDetectionRadius;

    for (const collectible of this.knownCollectibles) {
      const dist = BabylonVector3.Distance(this.marcusPosition, collectible.position);
      if (dist > detectionRadius) continue;

      const isSecret = collectible.type.toLowerCase().includes('secret');

      const report: IntelReport = {
        type: isSecret ? 'secret' : 'collectible',
        position: collectible.position.clone(),
        description: isSecret ? 'Hidden area discovered' : `Found ${collectible.type}`,
        timestamp: performance.now(),
        collectibleType: collectible.type,
      };

      reports.push(report);
    }

    return reports;
  }

  private assessThreatLevel(enemies: Entity[]): IntelReport['threatLevel'] {
    let totalThreat = 0;

    for (const enemy of enemies) {
      // Base threat
      totalThreat += 1;

      // High health enemies are more threatening
      if (enemy.health && enemy.health.max >= 150) {
        totalThreat += 2;
      }

      // Boss enemies
      if (enemy.tags?.boss) {
        totalThreat += 5;
      }
    }

    if (totalThreat >= 10) return 'critical';
    if (totalThreat >= 6) return 'high';
    if (totalThreat >= 3) return 'medium';
    return 'low';
  }

  // ============================================================================
  // PRIVATE METHODS - REPORTING
  // ============================================================================

  private reportIntel(intel: IntelReport): void {
    const now = performance.now();

    // Cooldown check
    if (now - this.lastDialogueTime < this.dialogueCooldown) return;
    this.lastDialogueTime = now;

    // Send appropriate dialogue
    switch (intel.type) {
      case 'enemy_contact':
        this.sendDialogue('CONTACT_SINGLE');
        this.callbacks.onEnemyMarked?.(intel.position, intel.threatLevel || 'low');
        break;

      case 'enemy_group':
        this.sendDialogueWithReplace('CONTACT_GROUP', {
          count: intel.entityIds?.length.toString() || '?',
        });
        this.callbacks.onEnemyMarked?.(intel.position, intel.threatLevel || 'medium');
        break;

      case 'danger_zone':
        this.sendDialogue('DANGER_ZONE');
        this.callbacks.onEnemyMarked?.(intel.position, 'critical');
        break;

      case 'collectible':
        this.sendDialogue('FOUND_COLLECTIBLE');
        this.callbacks.onCollectibleMarked?.(intel.position, intel.collectibleType || 'item');
        break;

      case 'secret':
        this.sendDialogue('FOUND_SECRET');
        this.callbacks.onCollectibleMarked?.(intel.position, 'secret');
        break;

      case 'area_clear':
        // Already handled in updateScanning
        break;
    }

    // Notify callback
    this.callbacks.onIntelReceived?.(intel);
  }

  private deliverReport(): void {
    // Generate summary
    const enemyCount = this.collectedIntel.filter(
      (i) => i.type === 'enemy_contact' || i.type === 'enemy_group'
    ).length;
    const collectibleCount = this.collectedIntel.filter(
      (i) => i.type === 'collectible' || i.type === 'secret'
    ).length;
    const dangerZones = this.collectedIntel.filter((i) => i.type === 'danger_zone').length;
    const clearAreas = this.collectedIntel.filter((i) => i.type === 'area_clear').length;

    let summary: string;
    if (dangerZones > 0) {
      summary = `Found ${dangerZones} danger zone(s). Watch yourself.`;
    } else if (enemyCount > 0) {
      summary = `Spotted ${enemyCount} enemy position(s).`;
      if (collectibleCount > 0) {
        summary += ` Also found ${collectibleCount} item(s).`;
      }
    } else if (collectibleCount > 0) {
      summary = `Area clear but found ${collectibleCount} item(s).`;
    } else if (clearAreas > 0) {
      summary = 'All areas clear. No threats.';
    } else {
      summary = 'Nothing to report.';
    }

    this.sendDialogueWithReplace('REPORT_SUMMARY', { summary });
  }

  // ============================================================================
  // PRIVATE METHODS - DIALOGUE
  // ============================================================================

  private setState(newState: ScoutingState): void {
    this.state = newState;
    this.stateStartTime = performance.now();
  }

  private sendDialogue(category: keyof typeof SCOUTING_DIALOGUE): void {
    const pool = SCOUTING_DIALOGUE[category];
    const text = pool[Math.floor(Math.random() * pool.length)];

    this.callbacks.onCommsMessage({
      ...MARCUS_CHARACTER,
      text,
    });
  }

  private sendDialogueWithReplace(
    category: keyof typeof SCOUTING_DIALOGUE,
    replacements: Record<string, string>
  ): void {
    const pool = SCOUTING_DIALOGUE[category];
    let text = pool[Math.floor(Math.random() * pool.length)];

    for (const [key, value] of Object.entries(replacements)) {
      text = text.replace(`{${key}}`, value);
    }

    this.callbacks.onCommsMessage({
      ...MARCUS_CHARACTER,
      text,
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.state = 'idle';
    this.waypoints = [];
    this.collectedIntel = [];
    this.knownEnemies = [];
    this.knownCollectibles = [];
  }
}
