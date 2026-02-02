/**
 * LevelNavMeshData - Navigation mesh definitions for each level type
 *
 * Provides pre-configured NavMesh settings for different level environments:
 * - Station levels (indoor corridors)
 * - Surface levels (outdoor terrain)
 * - Hive levels (underground tunnels)
 * - Vehicle levels (wide paths for driving)
 *
 * USAGE:
 * Called by LevelManager during level initialization to build NavMesh.
 * Each level type has optimized settings for its geometry.
 */

import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { LevelId, LevelType } from '../levels/types';
import {
  type EnvironmentType,
  NavMeshBuilder,
  type NavMeshBuildResult,
  type NavMeshConfig,
} from './NavMeshBuilder';

// ============================================================================
// TYPES
// ============================================================================

export interface LevelNavMeshDefinition {
  levelId: LevelId;
  levelType: LevelType;
  environmentType: EnvironmentType;
  bounds: {
    min: BabylonVector3;
    max: BabylonVector3;
  };
  cellSize: number;
  agentRadius: number;
  /** Optional pre-built NavMesh GLB file path */
  navMeshGLBPath?: string;
  /** Obstacle areas to exclude from NavMesh */
  obstacles?: {
    position: BabylonVector3;
    radius: number;
    id: string;
  }[];
  /** Vertical connections (stairs, ramps, elevators) */
  verticalConnections?: {
    lowerY: number;
    upperY: number;
    position: BabylonVector3;
    type: 'ramp' | 'stairs' | 'elevator';
  }[];
}

// ============================================================================
// LEVEL NAVMESH DEFINITIONS
// ============================================================================

/**
 * NavMesh definitions for each campaign level.
 */
export const LEVEL_NAVMESH_DEFINITIONS: Partial<Record<LevelId, LevelNavMeshDefinition>> = {
  // -------------------------------------------------------------------------
  // ACT 1: THE DROP
  // -------------------------------------------------------------------------
  anchor_station: {
    levelId: 'anchor_station',
    levelType: 'station',
    environmentType: 'station',
    bounds: {
      min: new BabylonVector3(-50, 0, -50),
      max: new BabylonVector3(50, 10, 50),
    },
    cellSize: 2,
    agentRadius: 1.5,
    // Station has doorways and corridors
    obstacles: [
      // Example obstacles - would be populated from level geometry
    ],
    verticalConnections: [],
  },

  landfall: {
    levelId: 'landfall',
    levelType: 'drop',
    environmentType: 'surface',
    bounds: {
      min: new BabylonVector3(-150, 0, -150),
      max: new BabylonVector3(150, 20, 150),
    },
    cellSize: 5,
    agentRadius: 2,
  },

  canyon_run: {
    levelId: 'canyon_run',
    levelType: 'vehicle',
    environmentType: 'surface',
    bounds: {
      min: new BabylonVector3(-200, 0, -500),
      max: new BabylonVector3(200, 50, 500),
    },
    cellSize: 8, // Larger cells for vehicle paths
    agentRadius: 3, // Wide for vehicle turning
  },

  // -------------------------------------------------------------------------
  // ACT 2: THE SEARCH
  // -------------------------------------------------------------------------
  fob_delta: {
    levelId: 'fob_delta',
    levelType: 'base',
    environmentType: 'station',
    bounds: {
      min: new BabylonVector3(-80, 0, -80),
      max: new BabylonVector3(80, 15, 80),
    },
    cellSize: 2.5,
    agentRadius: 1.5,
    verticalConnections: [
      // FOB has multiple floors
      {
        lowerY: 0,
        upperY: 5,
        position: new BabylonVector3(10, 2.5, 0),
        type: 'stairs',
      },
      {
        lowerY: 5,
        upperY: 10,
        position: new BabylonVector3(-10, 7.5, 0),
        type: 'stairs',
      },
    ],
  },

  brothers_in_arms: {
    levelId: 'brothers_in_arms',
    levelType: 'brothers',
    environmentType: 'surface',
    bounds: {
      min: new BabylonVector3(-100, 0, -75),
      max: new BabylonVector3(100, 15, 75),
    },
    cellSize: 4,
    agentRadius: 2, // Marcus mech is large
    obstacles: [
      // The Breach (large sinkhole)
      {
        id: 'breach',
        position: new BabylonVector3(0, 0, -60),
        radius: 50,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // ACT 3: THE TRUTH
  // -------------------------------------------------------------------------
  southern_ice: {
    levelId: 'southern_ice',
    levelType: 'ice',
    environmentType: 'surface',
    bounds: {
      min: new BabylonVector3(-200, 0, -200),
      max: new BabylonVector3(200, 30, 200),
    },
    cellSize: 5,
    agentRadius: 2,
    // Ice level has crevasses
    obstacles: [
      {
        id: 'crevasse_1',
        position: new BabylonVector3(-50, 0, 30),
        radius: 20,
      },
      {
        id: 'crevasse_2',
        position: new BabylonVector3(70, 0, -40),
        radius: 15,
      },
    ],
  },

  the_breach: {
    levelId: 'the_breach',
    levelType: 'hive',
    environmentType: 'hive',
    bounds: {
      min: new BabylonVector3(-100, -50, -100),
      max: new BabylonVector3(100, 10, 100),
    },
    cellSize: 3,
    agentRadius: 1.5,
    // Hive has tunnels at multiple levels
    verticalConnections: [
      {
        lowerY: -50,
        upperY: -30,
        position: new BabylonVector3(0, -40, 0),
        type: 'ramp',
      },
      {
        lowerY: -30,
        upperY: -10,
        position: new BabylonVector3(20, -20, 20),
        type: 'ramp',
      },
      {
        lowerY: -10,
        upperY: 0,
        position: new BabylonVector3(-15, -5, 10),
        type: 'ramp',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // ACT 4: ENDGAME
  // -------------------------------------------------------------------------
  hive_assault: {
    levelId: 'hive_assault',
    levelType: 'combined_arms',
    environmentType: 'hive',
    bounds: {
      min: new BabylonVector3(-150, -30, -150),
      max: new BabylonVector3(150, 20, 150),
    },
    cellSize: 4,
    agentRadius: 2,
  },

  extraction: {
    levelId: 'extraction',
    levelType: 'extraction',
    environmentType: 'surface',
    bounds: {
      min: new BabylonVector3(-100, 0, -100),
      max: new BabylonVector3(100, 20, 100),
    },
    cellSize: 4,
    agentRadius: 2,
    // LZ Omega defensive positions
    obstacles: [
      {
        id: 'landing_pad',
        position: new BabylonVector3(0, 0, 0),
        radius: 15,
      },
    ],
  },

  final_escape: {
    levelId: 'final_escape',
    levelType: 'finale',
    environmentType: 'surface',
    bounds: {
      min: new BabylonVector3(-100, 0, -1000),
      max: new BabylonVector3(100, 50, 1000),
    },
    cellSize: 10, // Very large cells for vehicle escape
    agentRadius: 4,
  },
};

// ============================================================================
// NAVMESH FACTORY
// ============================================================================

/**
 * Build NavMesh for a specific level.
 */
export async function buildLevelNavMesh(
  scene: Scene,
  levelId: LevelId
): Promise<NavMeshBuildResult | null> {
  const definition = LEVEL_NAVMESH_DEFINITIONS[levelId];
  if (!definition) {
    console.warn(`No NavMesh definition for level: ${levelId}`);
    return null;
  }

  const config: NavMeshConfig = {
    environmentType: definition.environmentType,
    bounds: definition.bounds,
    cellSize: definition.cellSize,
    agentRadius: definition.agentRadius,
    maxSlope: definition.environmentType === 'surface' ? Math.PI / 4 : Math.PI / 6,
    stepHeight: definition.environmentType === 'hive' ? 0.8 : 0.5,
  };

  const builder = new NavMeshBuilder(scene, config);

  // Add obstacles
  if (definition.obstacles) {
    for (const obstacle of definition.obstacles) {
      builder.addStaticObstacle({
        id: obstacle.id,
        position: obstacle.position,
        radius: obstacle.radius,
        isDynamic: false,
      });
    }
  }

  // Add vertical connections
  if (definition.verticalConnections) {
    for (const connection of definition.verticalConnections) {
      builder.addVerticalConnection({
        lowerRegion: 0, // Would be calculated properly
        upperRegion: 1, // Would be calculated properly
        type: connection.type,
        position: connection.position,
      });
    }
  }

  // Build from grid (or could load from GLB if available)
  let result: NavMeshBuildResult;

  if (definition.navMeshGLBPath) {
    // Load pre-built NavMesh from GLB
    result = await builder.loadFromGLB(definition.navMeshGLBPath);
  } else {
    // Build from grid
    const width = definition.bounds.max.x - definition.bounds.min.x;
    const depth = definition.bounds.max.z - definition.bounds.min.z;
    const center = definition.bounds.min.add(definition.bounds.max).scale(0.5);
    result = builder.buildFromGrid(width, depth, definition.cellSize, center);
  }

  console.log(
    `Built NavMesh for ${levelId}: ${result.regionCount} regions in ${result.buildTimeMs.toFixed(1)}ms`
  );

  return result;
}

/**
 * Get NavMesh definition for a level.
 */
export function getLevelNavMeshDefinition(levelId: LevelId): LevelNavMeshDefinition | null {
  return LEVEL_NAVMESH_DEFINITIONS[levelId] ?? null;
}

/**
 * Check if a level has NavMesh support.
 */
export function hasNavMeshSupport(levelId: LevelId): boolean {
  return levelId in LEVEL_NAVMESH_DEFINITIONS;
}
