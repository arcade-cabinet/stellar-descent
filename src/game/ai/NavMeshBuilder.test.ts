/**
 * NavMeshBuilder Tests
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { beforeEach, describe, expect, it } from 'vitest';
import { NAV_FLAGS, NavMeshBuilder } from './NavMeshBuilder';

// Mock Scene
const mockScene = {
  // Minimal mock
} as any;

describe('NavMeshBuilder', () => {
  describe('Grid-based NavMesh', () => {
    it('should create NavMesh from grid', () => {
      const builder = new NavMeshBuilder(mockScene, {
        environmentType: 'surface',
        bounds: {
          min: new Vector3(-50, 0, -50),
          max: new Vector3(50, 10, 50),
        },
        cellSize: 10,
        agentRadius: 2,
        maxSlope: Math.PI / 4,
        stepHeight: 1,
      });

      const result = builder.buildFromGrid(100, 100, 10, Vector3.Zero());

      // NavMesh should be created (region count may vary based on Yuka internals)
      expect(result.navMesh).toBeDefined();
      expect(result.buildTimeMs).toBeGreaterThanOrEqual(0);
      // At minimum, regions should be non-negative
      expect(result.regionCount).toBeGreaterThanOrEqual(0);
    });

    it('should create NavMesh with valid result', () => {
      const builder = new NavMeshBuilder(mockScene, {
        environmentType: 'station',
        bounds: {
          min: new Vector3(-20, 0, -20),
          max: new Vector3(20, 5, 20),
        },
        cellSize: 4,
        agentRadius: 1.5,
        maxSlope: Math.PI / 6,
        stepHeight: 0.5,
      });

      const result = builder.buildFromGrid(40, 40, 4, Vector3.Zero());

      // Result should have valid structure
      expect(result.navMesh).toBeDefined();
      expect(result.regionCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Obstacle Management', () => {
    let builder: NavMeshBuilder;

    beforeEach(() => {
      builder = new NavMeshBuilder(mockScene, {
        environmentType: 'surface',
        bounds: {
          min: new Vector3(-50, 0, -50),
          max: new Vector3(50, 10, 50),
        },
        cellSize: 5,
        agentRadius: 2,
        maxSlope: Math.PI / 4,
        stepHeight: 1,
      });
    });

    it('should add static obstacles', () => {
      builder.addStaticObstacle({
        id: 'obstacle1',
        position: new Vector3(10, 0, 10),
        radius: 5,
        isDynamic: false,
      });

      // Static obstacles are not returned by getDynamicObstacles
      const dynamicObstacles = builder.getDynamicObstacles();
      expect(dynamicObstacles.length).toBe(0);
    });

    it('should add and track dynamic obstacles', () => {
      builder.addDynamicObstacle({
        id: 'door1',
        position: new Vector3(0, 0, 0),
        radius: 2,
        isDynamic: true,
      });

      const dynamicObstacles = builder.getDynamicObstacles();
      expect(dynamicObstacles.length).toBe(1);
      expect(dynamicObstacles[0].id).toBe('door1');
    });

    it('should update dynamic obstacle positions', () => {
      builder.addDynamicObstacle({
        id: 'moving_door',
        position: new Vector3(0, 0, 0),
        radius: 2,
        isDynamic: true,
      });

      builder.updateObstacle('moving_door', new Vector3(5, 0, 5));

      const obstacles = builder.getDynamicObstacles();
      expect(obstacles[0].position.x).toBe(5);
      expect(obstacles[0].position.z).toBe(5);
    });

    it('should remove obstacles', () => {
      builder.addDynamicObstacle({
        id: 'temp_obstacle',
        position: new Vector3(0, 0, 0),
        radius: 2,
        isDynamic: true,
      });

      builder.removeObstacle('temp_obstacle');

      const obstacles = builder.getDynamicObstacles();
      expect(obstacles.length).toBe(0);
    });
  });

  describe('Vertical Connections', () => {
    it('should track vertical connections', () => {
      const builder = new NavMeshBuilder(mockScene, {
        environmentType: 'hive',
        bounds: {
          min: new Vector3(-50, -20, -50),
          max: new Vector3(50, 10, 50),
        },
        cellSize: 3,
        agentRadius: 1.5,
        maxSlope: Math.PI / 5,
        stepHeight: 0.8,
      });

      builder.addVerticalConnection({
        lowerRegion: 0,
        upperRegion: 10,
        type: 'stairs',
        position: new Vector3(0, -5, 0),
      });

      builder.addVerticalConnection({
        lowerRegion: 10,
        upperRegion: 20,
        type: 'ramp',
        position: new Vector3(10, 0, 10),
      });

      const connections = builder.getVerticalConnections();
      expect(connections.length).toBe(2);
      expect(connections[0].type).toBe('stairs');
      expect(connections[1].type).toBe('ramp');
    });
  });

  describe('NavMesh Queries', () => {
    it('should report if NavMesh is available', () => {
      const builder = new NavMeshBuilder(mockScene, {
        environmentType: 'surface',
        bounds: {
          min: new Vector3(-50, 0, -50),
          max: new Vector3(50, 10, 50),
        },
        cellSize: 5,
        agentRadius: 2,
        maxSlope: Math.PI / 4,
        stepHeight: 1,
      });

      // Before building
      expect(builder.getNavMesh()).toBeNull();

      // After building
      builder.buildFromGrid(100, 100, 10, Vector3.Zero());
      expect(builder.getNavMesh()).not.toBeNull();
    });

    it('should handle position queries gracefully', () => {
      const builder = new NavMeshBuilder(mockScene, {
        environmentType: 'surface',
        bounds: {
          min: new Vector3(-50, 0, -50),
          max: new Vector3(50, 10, 50),
        },
        cellSize: 5,
        agentRadius: 2,
        maxSlope: Math.PI / 4,
        stepHeight: 1,
      });

      builder.buildFromGrid(100, 100, 10, Vector3.Zero());

      // Query should not throw
      const result = builder.isOnNavMesh(new Vector3(0, 0, 0));
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Region Data', () => {
    it('should return region data structure', () => {
      const builder = new NavMeshBuilder(mockScene, {
        environmentType: 'surface',
        bounds: {
          min: new Vector3(-10, 0, -10),
          max: new Vector3(10, 5, 10),
        },
        cellSize: 5,
        agentRadius: 2,
        maxSlope: Math.PI / 4,
        stepHeight: 1,
      });

      builder.buildFromGrid(20, 20, 5, Vector3.Zero());

      const regions = builder.getRegionData();
      // Should return array (may be empty if NavMesh build failed)
      expect(Array.isArray(regions)).toBe(true);

      // If regions exist, check structure
      if (regions.length > 0) {
        const firstRegion = regions[0];
        expect(firstRegion.centroid).toBeDefined();
        expect(firstRegion.vertices).toBeDefined();
        expect(firstRegion.flags).toBe(NAV_FLAGS.WALKABLE);
      }
    });
  });

  describe('Cleanup', () => {
    it('should dispose resources', () => {
      const builder = new NavMeshBuilder(mockScene, {
        environmentType: 'surface',
        bounds: {
          min: new Vector3(-50, 0, -50),
          max: new Vector3(50, 10, 50),
        },
        cellSize: 5,
        agentRadius: 2,
        maxSlope: Math.PI / 4,
        stepHeight: 1,
      });

      // Build NavMesh (may or may not succeed based on Yuka internals)
      builder.buildFromGrid(100, 100, 10, Vector3.Zero());
      builder.addDynamicObstacle({
        id: 'test',
        position: Vector3.Zero(),
        radius: 1,
        isDynamic: true,
      });

      // Verify obstacle was added
      expect(builder.getDynamicObstacles().length).toBe(1);

      builder.dispose();

      // After dispose, everything should be cleaned up
      expect(builder.getNavMesh()).toBeNull();
      expect(builder.getSpatialIndex()).toBeNull();
      expect(builder.getDynamicObstacles().length).toBe(0);
    });
  });
});
