/**
 * PathVisualizer - Visual markers for Marcus's navigation path
 *
 * Renders:
 * - Path line showing Marcus's planned route
 * - Waypoint markers at path nodes
 * - Scout position marker at destination
 * - Progress indicator along path
 *
 * INTEGRATION:
 * - Called by MarcusSteeringAI when pathfinding is active
 * - Updates each frame to show current path progress
 * - Automatically disposes when path completes
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { tokens } from '../utils/designTokens';

// ============================================================================
// TYPES
// ============================================================================

export interface PathVisualizerConfig {
  /** Color for the path line */
  pathColor: string;
  /** Color for waypoint markers */
  waypointColor: string;
  /** Color for destination marker */
  destinationColor: string;
  /** Line width for path */
  pathWidth: number;
  /** Waypoint marker size */
  waypointSize: number;
  /** Destination marker size */
  destinationSize: number;
  /** Show waypoint markers */
  showWaypoints: boolean;
  /** Animate the path line */
  animatePath: boolean;
  /** Path alpha (transparency) */
  pathAlpha: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: PathVisualizerConfig = {
  pathColor: tokens.colors.accent.brass,
  waypointColor: '#4DA6FF', // Blue
  destinationColor: '#44FF44', // Green
  pathWidth: 0.3,
  waypointSize: 0.5,
  destinationSize: 1.5,
  showWaypoints: true,
  animatePath: true,
  pathAlpha: 0.7,
};

// ============================================================================
// PATH VISUALIZER CLASS
// ============================================================================

export class PathVisualizer {
  private scene: Scene;
  private config: PathVisualizerConfig;

  // Visual elements
  private pathLines: Mesh[] = [];
  private waypointMarkers: Mesh[] = [];
  private destinationMarker: Mesh | null = null;
  private progressMarker: Mesh | null = null;

  // Materials (cached)
  private pathMaterial: StandardMaterial | null = null;
  private waypointMaterial: StandardMaterial | null = null;
  private destinationMaterial: StandardMaterial | null = null;
  private progressMaterial: StandardMaterial | null = null;

  // State
  private isVisible: boolean = false;
  private currentWaypoints: Vector3[] = [];
  private animationTime: number = 0;

  constructor(scene: Scene, config?: Partial<PathVisualizerConfig>) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.createMaterials();
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Show the path visualization with given waypoints.
   */
  showPath(waypoints: Vector3[], destination?: Vector3): void {
    this.clearPath();

    if (waypoints.length === 0) return;

    this.currentWaypoints = waypoints.map((w) => w.clone());
    this.isVisible = true;

    // Create path lines between waypoints
    this.createPathLines();

    // Create waypoint markers
    if (this.config.showWaypoints) {
      this.createWaypointMarkers();
    }

    // Create destination marker
    const finalPos = destination ?? waypoints[waypoints.length - 1];
    this.createDestinationMarker(finalPos);

    // Create progress marker
    this.createProgressMarker();
  }

  /**
   * Update the progress marker position along the path.
   * @param progress 0-1 representing path completion
   */
  updateProgress(progress: number): void {
    if (!this.progressMarker || this.currentWaypoints.length === 0) return;

    // Calculate position along path
    const totalWaypoints = this.currentWaypoints.length;
    const exactIndex = progress * (totalWaypoints - 1);
    const lowIndex = Math.floor(exactIndex);
    const highIndex = Math.min(lowIndex + 1, totalWaypoints - 1);
    const t = exactIndex - lowIndex;

    const pos = Vector3.Lerp(this.currentWaypoints[lowIndex], this.currentWaypoints[highIndex], t);

    pos.y += 0.5; // Float above ground
    this.progressMarker.position = pos;
  }

  /**
   * Update animation each frame.
   */
  update(deltaTime: number): void {
    if (!this.isVisible) return;

    this.animationTime += deltaTime;

    // Animate path alpha for "flowing" effect
    if (this.config.animatePath && this.pathMaterial) {
      const pulse = 0.5 + Math.sin(this.animationTime * 3) * 0.2;
      this.pathMaterial.alpha = this.config.pathAlpha * pulse;
    }

    // Rotate destination marker
    if (this.destinationMarker) {
      this.destinationMarker.rotation.y += deltaTime * 2;
      this.destinationMarker.position.y =
        this.currentWaypoints[this.currentWaypoints.length - 1]?.y +
        1 +
        Math.sin(this.animationTime * 2) * 0.3;
    }

    // Pulse progress marker
    if (this.progressMarker && this.progressMaterial) {
      const scale = 0.8 + Math.sin(this.animationTime * 5) * 0.2;
      this.progressMarker.scaling.setAll(scale);
    }
  }

  /**
   * Hide and clear the path visualization.
   */
  clearPath(): void {
    this.isVisible = false;
    this.currentWaypoints = [];

    // Dispose path lines
    for (const line of this.pathLines) {
      line.dispose();
    }
    this.pathLines = [];

    // Dispose waypoint markers
    for (const marker of this.waypointMarkers) {
      marker.dispose();
    }
    this.waypointMarkers = [];

    // Dispose destination marker
    if (this.destinationMarker) {
      this.destinationMarker.dispose();
      this.destinationMarker = null;
    }

    // Dispose progress marker
    if (this.progressMarker) {
      this.progressMarker.dispose();
      this.progressMarker = null;
    }
  }

  /**
   * Check if path is currently visible.
   */
  isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Get current waypoints.
   */
  getWaypoints(): Vector3[] {
    return this.currentWaypoints.map((w) => w.clone());
  }

  // ============================================================================
  // PRIVATE METHODS - VISUAL CREATION
  // ============================================================================

  private createMaterials(): void {
    // Path material
    this.pathMaterial = new StandardMaterial('pathMat', this.scene);
    this.pathMaterial.emissiveColor = Color3.FromHexString(this.config.pathColor);
    this.pathMaterial.disableLighting = true;
    this.pathMaterial.alpha = this.config.pathAlpha;

    // Waypoint material
    this.waypointMaterial = new StandardMaterial('waypointMat', this.scene);
    this.waypointMaterial.emissiveColor = Color3.FromHexString(this.config.waypointColor);
    this.waypointMaterial.disableLighting = true;
    this.waypointMaterial.alpha = 0.8;

    // Destination material
    this.destinationMaterial = new StandardMaterial('destMat', this.scene);
    this.destinationMaterial.emissiveColor = Color3.FromHexString(this.config.destinationColor);
    this.destinationMaterial.disableLighting = true;
    this.destinationMaterial.alpha = 0.9;

    // Progress material
    this.progressMaterial = new StandardMaterial('progressMat', this.scene);
    this.progressMaterial.emissiveColor = Color3.FromHexString('#FFFFFF');
    this.progressMaterial.disableLighting = true;
    this.progressMaterial.alpha = 1;
  }

  private createPathLines(): void {
    if (this.currentWaypoints.length < 2) return;

    for (let i = 0; i < this.currentWaypoints.length - 1; i++) {
      const start = this.currentWaypoints[i].clone();
      const end = this.currentWaypoints[i + 1].clone();

      // Elevate slightly above ground
      start.y += 0.2;
      end.y += 0.2;

      // Create tube between points
      const path = [start, end];
      const tube = MeshBuilder.CreateTube(
        `pathSegment_${i}`,
        {
          path,
          radius: this.config.pathWidth * 0.5,
          tessellation: 8,
          updatable: false,
        },
        this.scene
      );

      tube.material = this.pathMaterial;
      this.pathLines.push(tube);
    }
  }

  private createWaypointMarkers(): void {
    for (let i = 0; i < this.currentWaypoints.length; i++) {
      const pos = this.currentWaypoints[i].clone();
      pos.y += 0.5;

      const marker = MeshBuilder.CreateSphere(
        `waypoint_${i}`,
        { diameter: this.config.waypointSize },
        this.scene
      );
      marker.position = pos;
      marker.material = this.waypointMaterial;

      this.waypointMarkers.push(marker);
    }
  }

  private createDestinationMarker(position: Vector3): void {
    const pos = position.clone();
    pos.y += 1;

    // Create diamond shape
    this.destinationMarker = MeshBuilder.CreateBox(
      'destMarker',
      {
        width: this.config.destinationSize,
        height: this.config.destinationSize,
        depth: this.config.destinationSize,
      },
      this.scene
    );

    this.destinationMarker.position = pos;
    this.destinationMarker.rotation.y = Math.PI / 4;
    this.destinationMarker.rotation.z = Math.PI / 4;
    this.destinationMarker.material = this.destinationMaterial;
  }

  private createProgressMarker(): void {
    if (this.currentWaypoints.length === 0) return;

    const pos = this.currentWaypoints[0].clone();
    pos.y += 0.5;

    this.progressMarker = MeshBuilder.CreateSphere('progressMarker', { diameter: 0.8 }, this.scene);

    this.progressMarker.position = pos;
    this.progressMarker.material = this.progressMaterial;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.clearPath();

    // Dispose materials
    this.pathMaterial?.dispose();
    this.waypointMaterial?.dispose();
    this.destinationMaterial?.dispose();
    this.progressMaterial?.dispose();

    this.pathMaterial = null;
    this.waypointMaterial = null;
    this.destinationMaterial = null;
    this.progressMaterial = null;
  }
}
