/**
 * ExtractionLevel - Type Definitions
 *
 * Contains all type definitions and interfaces for the extraction level.
 */

import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

// ============================================================================
// PHASE TYPES
// ============================================================================

/**
 * Extraction level progression phases
 */
export type ExtractionPhase =
  | 'escape_start' // Initial orientation after Queen kill
  | 'escape_tunnel' // Running through collapsing tunnels
  | 'surface_run' // Running 500m to LZ Omega
  | 'holdout' // Wave-based defense
  | 'hive_collapse' // Final hive collapse after holdout - escape to dropship
  | 'victory' // Dropship arrival and extraction
  | 'epilogue'; // Post-mission epilogue

/**
 * Wave combat state machine phases
 */
export type WavePhase =
  | 'waiting' // Waiting for holdout to start
  | 'announcement' // Wave announcement phase (3s)
  | 'active' // Wave in progress
  | 'intermission'; // Between waves countdown

// ============================================================================
// ENEMY TYPES
// ============================================================================

/**
 * Enemy instance data for extraction level
 */
export interface Enemy {
  mesh: TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  velocity: Vector3;
  species: string;
  isActive: boolean;
}

// ============================================================================
// ENVIRONMENT STRUCTURES
// ============================================================================

/**
 * Falling debris chunk
 */
export interface DebrisChunk {
  mesh: Mesh;
  velocity: Vector3;
  rotationSpeed: Vector3;
  lifetime: number;
}

/**
 * Hive collapse visual elements
 */
export interface CollapseEffect {
  mesh: Mesh;
  startPosition: Vector3;
  endPosition: Vector3;
  progress: number;
  speed: number;
  type: 'ground_crack' | 'hive_eruption' | 'falling_structure';
}

/**
 * Falling stalactite/ceiling chunk during collapse
 */
export interface FallingStalactite {
  mesh: Mesh;
  velocity: Vector3;
  rotationSpeed: Vector3;
  hasImpacted: boolean;
  shadowMarker: Mesh | null;
}

/**
 * Health pickup during collapse escape
 */
export interface HealthPickup {
  mesh: Mesh;
  collected: boolean;
  healAmount: number;
}

/**
 * Crumbling wall obstacle
 */
export interface CrumblingWall {
  mesh: Mesh;
  progress: number;
  startY: number;
}

/**
 * Supply drop (health or ammo) between waves
 */
export interface SupplyDrop {
  mesh: Mesh;
  type: 'health' | 'ammo';
  collected: boolean;
  amount: number;
}

// ============================================================================
// WAVE CONFIGURATION
// ============================================================================

/**
 * Comms message configuration
 */
export interface CommsMessage {
  sender: string;
  callsign: string;
  portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
  text: string;
}

/**
 * Wave configuration for holdout defense
 */
export interface WaveConfig {
  /** Number of drone/skitterer enemies */
  drones: number;
  /** Number of grunt/lurker enemies */
  grunts: number;
  /** Number of spitter/spewer enemies */
  spitters: number;
  /** Number of brute/broodmother enemies */
  brutes: number;
  /** Number of husk enemies (FIX #3: Added husk support) */
  husks: number;
  /** Delay between enemy spawns in seconds */
  spawnDelay: number;
  /** Wave title for HUD display */
  waveTitle: string;
  /** Wave description for HUD display */
  waveDescription: string;
  /** Optional comms message at wave start */
  commsMessage?: CommsMessage;
  /** Whether to spawn a supply drop after this wave (FIX #11) */
  supplyDropAfter?: boolean;
}

// ============================================================================
// CALLBACK INTERFACES
// ============================================================================

/**
 * Level callbacks subset used by extraction subsystems
 */
export interface ExtractionCallbacks {
  onNotification: (message: string, duration: number) => void;
  onCommsMessage: (message: CommsMessage) => void;
  onObjectiveUpdate: (title: string, description: string) => void;
  onHealthChange: (health: number) => void;
  onDamage: () => void;
  onKill: () => void;
  onCombatStateChange: (inCombat: boolean) => void;
  onCinematicStart?: () => void;
  onCinematicEnd?: () => void;
}
