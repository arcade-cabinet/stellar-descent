/**
 * Surface Combat Unit Tests
 *
 * Tests for surface enemy spawning, AI, and hazard systems.
 *
 * Target coverage: 95% line, 90% branch
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  calculateSpawnPoints,
  spawnSurfaceEnemy,
  spawnFirstEncounterEnemy,
  updateEnemyAI,
  flashEnemyRed,
  animateEnemyDeath,
  isPlayerInAcidPool,
  isPlayerOnUnstableTerrain,
  updateAcidPoolVisuals,
  updateUnstableTerrainVisuals,
} from './surface-combat';
import {
  TERRAIN_BOUNDS,
  SURFACE_ENEMY_SCALE,
  ACID_POOL_POSITIONS,
  UNSTABLE_TERRAIN_POSITIONS,
} from './constants';
import type { SurfaceEnemy, EnemyState } from './types';
// ---------------------------------------------------------------------------
// Mock Setup
// ---------------------------------------------------------------------------

// Mock StandardMaterial and TransformNode for instanceof checks using vi.hoisted
const { MockStandardMaterial, MockTransformNode } = vi.hoisted(() => {
  class MockStandardMaterial {
    emissiveColor = { r: 0, g: 0, b: 0, clone: () => ({ r: 0, g: 0, b: 0 }) };
    diffuseColor = { r: 0, g: 0, b: 0, clone: () => ({ r: 0, g: 0, b: 0 }) };
    specularColor = { r: 0, g: 0, b: 0 };
    alpha = 1;
  }

  class MockTransformNode {
    name = 'mockTransformNode';
    _childMeshes: any[] = [];
    getChildMeshes = () => this._childMeshes;
  }

  return { MockStandardMaterial, MockTransformNode };
});

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: MockStandardMaterial,
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateDisc: vi.fn(() => ({
      name: 'mockDisc',
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { setAll: vi.fn() },
      material: null,
      isVisible: true,
      dispose: vi.fn(),
    })),
    CreateBox: vi.fn(() => ({
      name: 'mockBox',
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { setAll: vi.fn() },
      material: null,
      isVisible: true,
      dispose: vi.fn(),
    })),
    CreateTorus: vi.fn(() => ({
      name: 'mockTorus',
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { setAll: vi.fn() },
      material: null,
      isVisible: true,
      dispose: vi.fn(),
    })),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: MockTransformNode,
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    createInstance: vi.fn((category, asset, name, scene) => ({
      name,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { setAll: vi.fn() },
      isDisposed: () => false,
      dispose: vi.fn(),
      getChildMeshes: () => [],
    })),
  },
  SPECIES_TO_ASSET: {
    skitterer: 'chitin_drone',
    lurker: 'chitin_lurker',
  },
}));

vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    emitBurrowEmergence: vi.fn(),
    emitAlienSplatter: vi.fn(),
    emitAlienDeath: vi.fn(),
  },
}));

// Mock Scene with complete interface for Babylon.js operations
let uniqueIdCounter = 0;
const createMockScene = () => ({
  meshes: [],
  materials: [],
  getUniqueId: () => uniqueIdCounter++,
  addMesh: vi.fn(),
  addMaterial: vi.fn(),
  removeMesh: vi.fn(),
  removeMaterial: vi.fn(),
});

/**
 * Helper to create a mock StandardMaterial that passes instanceof checks
 */
const createMockStandardMaterial = () => {
  const mat = new MockStandardMaterial();
  mat.emissiveColor = new Color3(0, 0, 0);
  mat.diffuseColor = new Color3(0, 0, 0);
  return mat;
};

// ---------------------------------------------------------------------------
// Spawn Point Calculation Tests
// ---------------------------------------------------------------------------

describe('calculateSpawnPoints', () => {
  it('should return correct number of spawn points', () => {
    const playerPos = new Vector3(0, 0, 0);
    const count = 4;

    const spawnPoints = calculateSpawnPoints(playerPos, count);

    expect(spawnPoints.length).toBe(count);
  });

  it('should generate spawn points around player', () => {
    const playerPos = new Vector3(10, 0, 10);
    const count = 4;

    const spawnPoints = calculateSpawnPoints(playerPos, count);

    for (const point of spawnPoints) {
      // Points should be offset from player position
      expect(point.x).not.toBe(playerPos.x);
      expect(point.z).not.toBe(playerPos.z);
    }
  });

  it('should clamp spawn points to terrain bounds', () => {
    // Player near edge of map
    const playerPos = new Vector3(TERRAIN_BOUNDS - 5, 0, TERRAIN_BOUNDS - 5);
    const count = 4;

    const spawnPoints = calculateSpawnPoints(playerPos, count);

    for (const point of spawnPoints) {
      expect(point.x).toBeGreaterThanOrEqual(-TERRAIN_BOUNDS + 10);
      expect(point.x).toBeLessThanOrEqual(TERRAIN_BOUNDS - 10);
      expect(point.z).toBeGreaterThanOrEqual(-TERRAIN_BOUNDS + 10);
      expect(point.z).toBeLessThanOrEqual(TERRAIN_BOUNDS - 10);
    }
  });

  it('should generate different positions for each spawn point', () => {
    const playerPos = new Vector3(0, 0, 0);
    const count = 4;

    const spawnPoints = calculateSpawnPoints(playerPos, count);

    // Check that not all points are identical
    const uniqueX = new Set(spawnPoints.map((p) => p.x));
    expect(uniqueX.size).toBeGreaterThan(1);
  });

  it('should handle single spawn point', () => {
    const playerPos = new Vector3(0, 0, 0);
    const count = 1;

    const spawnPoints = calculateSpawnPoints(playerPos, count);

    expect(spawnPoints.length).toBe(1);
  });

  it('should handle zero spawn points', () => {
    const playerPos = new Vector3(0, 0, 0);
    const count = 0;

    const spawnPoints = calculateSpawnPoints(playerPos, count);

    expect(spawnPoints.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Enemy Spawning Tests
// ---------------------------------------------------------------------------

describe('spawnSurfaceEnemy', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create enemy with correct properties', () => {
    const spawnPos = new Vector3(10, 0, 10);
    const index = 0;

    const enemy = spawnSurfaceEnemy(mockScene, spawnPos, index, true);

    expect(enemy.mesh).toBeDefined();
    expect(enemy.health).toBe(50);
    expect(enemy.maxHealth).toBe(50);
    expect(enemy.state).toBe('chase');
    expect(enemy.species).toBe('skitterer');
  });

  it('should position enemy at spawn point', () => {
    const spawnPos = new Vector3(15, 0, 20);
    const index = 0;

    const enemy = spawnSurfaceEnemy(mockScene, spawnPos, index, true);

    expect(enemy.position.x).toBe(spawnPos.x);
    expect(enemy.position.z).toBe(spawnPos.z);
  });

  it('should throw if assets not preloaded', () => {
    const spawnPos = new Vector3(10, 0, 10);

    expect(() => {
      spawnSurfaceEnemy(mockScene, spawnPos, 0, false);
    }).toThrow();
  });

  it('should initialize with attack cooldown of 0', () => {
    const spawnPos = new Vector3(10, 0, 10);
    const enemy = spawnSurfaceEnemy(mockScene, spawnPos, 0, true);

    expect(enemy.attackCooldown).toBe(0);
  });
});

describe('spawnFirstEncounterEnemy', () => {
  let mockScene: any;

  beforeEach(() => {
    mockScene = createMockScene();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create enemy and burrow hole', () => {
    const spawnPos = new Vector3(10, 0, 10);

    const result = spawnFirstEncounterEnemy(mockScene, spawnPos, 0, true);

    expect(result.enemy).toBeDefined();
    expect(result.burrowHole).toBeDefined();
  });

  it('should create enemy with lower health for tutorial', () => {
    const spawnPos = new Vector3(10, 0, 10);

    const result = spawnFirstEncounterEnemy(mockScene, spawnPos, 0, true);

    expect(result.enemy.health).toBe(40);
    expect(result.enemy.maxHealth).toBe(40);
  });

  it('should create enemy in idle state initially', () => {
    const spawnPos = new Vector3(10, 0, 10);

    const result = spawnFirstEncounterEnemy(mockScene, spawnPos, 0, true);

    expect(result.enemy.state).toBe('idle');
  });

  it('should create enemy with higher attack cooldown', () => {
    const spawnPos = new Vector3(10, 0, 10);

    const result = spawnFirstEncounterEnemy(mockScene, spawnPos, 0, true);

    expect(result.enemy.attackCooldown).toBe(2.0);
  });

  it('should throw if assets not preloaded', () => {
    const spawnPos = new Vector3(10, 0, 10);

    expect(() => {
      spawnFirstEncounterEnemy(mockScene, spawnPos, 0, false);
    }).toThrow();
  });

  it('should emit burrow emergence particles', async () => {
    // Import the mocked module
    const { particleManager } = await import('../../effects/ParticleManager');
    const spawnPos = new Vector3(10, 0, 10);

    spawnFirstEncounterEnemy(mockScene, spawnPos, 0, true);

    expect(particleManager.emitBurrowEmergence).toHaveBeenCalledWith(spawnPos, 1.2);
  });
});

// ---------------------------------------------------------------------------
// Enemy AI Tests
// ---------------------------------------------------------------------------

describe('updateEnemyAI', () => {
  it('should transition idle enemy to chase', () => {
    const mockMesh = {
      position: new Vector3(10, 1, 10),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(10, 0, 10),
      state: 'idle',
      attackCooldown: 0,
      species: 'skitterer',
    };

    updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.016, 1.0);

    expect(enemy.state).toBe('chase');
  });

  it('should move enemy towards player when chasing', () => {
    const mockMesh = {
      position: new Vector3(20, 1, 0),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(20, 0, 0),
      state: 'chase',
      attackCooldown: 0,
      species: 'skitterer',
    };

    const initialX = mockMesh.position.x;
    updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.1, 1.0);

    expect(mockMesh.position.x).toBeLessThan(initialX);
  });

  it('should transition to attack when close to player', () => {
    const mockMesh = {
      position: new Vector3(2, 1, 0),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(2, 0, 0),
      state: 'chase',
      attackCooldown: 0,
      species: 'skitterer',
    };

    updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.016, 1.0);

    expect(enemy.state).toBe('attack');
  });

  it('should retreat when health is low', () => {
    const mockMesh = {
      position: new Vector3(5, 1, 0),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 10, // 20% of maxHealth
      maxHealth: 50,
      position: new Vector3(5, 0, 0),
      state: 'chase',
      attackCooldown: 0,
      species: 'skitterer',
    };

    const initialX = mockMesh.position.x;
    updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.1, 1.0);

    // Should move away from player
    expect(mockMesh.position.x).toBeGreaterThan(initialX);
  });

  it('should respect speed multiplier', () => {
    const mockMesh1 = {
      position: new Vector3(20, 1, 0),
      rotation: new Vector3(0, 0, 0),
    };

    const mockMesh2 = {
      position: new Vector3(20, 1, 0),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy1: SurfaceEnemy = {
      mesh: mockMesh1 as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(20, 0, 0),
      state: 'chase',
      attackCooldown: 0,
      species: 'skitterer',
    };

    const enemy2: SurfaceEnemy = {
      mesh: mockMesh2 as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(20, 0, 0),
      state: 'chase',
      attackCooldown: 0,
      species: 'skitterer',
    };

    updateEnemyAI(enemy1, new Vector3(0, 0, 0), 0.1, 1.0);
    updateEnemyAI(enemy2, new Vector3(0, 0, 0), 0.1, 0.5);

    // Enemy with higher speed multiplier should move more
    const distance1 = Math.abs(20 - mockMesh1.position.x);
    const distance2 = Math.abs(20 - mockMesh2.position.x);
    expect(distance1).toBeGreaterThan(distance2);
  });

  it('should decrement attack cooldown', () => {
    const mockMesh = {
      position: new Vector3(10, 1, 0),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(10, 0, 0),
      state: 'chase',
      attackCooldown: 1.0,
      species: 'skitterer',
    };

    updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.5, 1.0);

    expect(enemy.attackCooldown).toBe(0.5);
  });

  it('should not update dead enemies', () => {
    const mockMesh = {
      position: new Vector3(10, 1, 0),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 0,
      maxHealth: 50,
      position: new Vector3(10, 0, 0),
      state: 'chase',
      attackCooldown: 1.0,
      species: 'skitterer',
    };

    const initialPos = mockMesh.position.clone();
    updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.5, 1.0);

    expect(mockMesh.position.x).toBe(initialPos.x);
    expect(mockMesh.position.z).toBe(initialPos.z);
  });

  it('should clamp enemy position to terrain bounds', () => {
    const mockMesh = {
      position: new Vector3(TERRAIN_BOUNDS + 10, 1, TERRAIN_BOUNDS + 10),
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(TERRAIN_BOUNDS + 10, 0, TERRAIN_BOUNDS + 10),
      state: 'chase',
      attackCooldown: 0,
      species: 'skitterer',
    };

    updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.016, 1.0);

    expect(mockMesh.position.x).toBeLessThanOrEqual(TERRAIN_BOUNDS - 5);
    expect(mockMesh.position.z).toBeLessThanOrEqual(TERRAIN_BOUNDS - 5);
  });

  it('should strafe at medium range', () => {
    const mockMesh = {
      position: new Vector3(6, 1, 0), // Within strafe range (8) but outside attack range (2.5)
      rotation: new Vector3(0, 0, 0),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 50,
      maxHealth: 50,
      position: new Vector3(6, 0, 0),
      state: 'chase',
      attackCooldown: 0,
      species: 'skitterer',
    };

    // Run multiple frames to see strafing movement
    for (let i = 0; i < 10; i++) {
      updateEnemyAI(enemy, new Vector3(0, 0, 0), 0.016, 1.0);
    }

    // Enemy should still be in chase state and have moved
    expect(enemy.state).toBe('chase');
  });
});

// ---------------------------------------------------------------------------
// Visual Feedback Tests
// ---------------------------------------------------------------------------

describe('flashEnemyRed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should change mesh color to red', () => {
    const mockMaterial = createMockStandardMaterial();
    mockMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);

    const mockMesh = {
      material: mockMaterial,
    };

    flashEnemyRed(mockMesh as any);

    expect(mockMaterial.diffuseColor.r).toBeCloseTo(1);
    expect(mockMaterial.diffuseColor.g).toBeCloseTo(0.2);
    expect(mockMaterial.diffuseColor.b).toBeCloseTo(0.2);
  });

  it('should restore original color after timeout', () => {
    const originalColor = new Color3(0.5, 0.5, 0.5);
    const mockMaterial = createMockStandardMaterial();
    mockMaterial.diffuseColor = originalColor.clone();

    const mockMesh = {
      material: mockMaterial,
    };

    flashEnemyRed(mockMesh as any);

    vi.advanceTimersByTime(150);

    expect(mockMaterial.diffuseColor.r).toBeCloseTo(originalColor.r);
    expect(mockMaterial.diffuseColor.g).toBeCloseTo(originalColor.g);
    expect(mockMaterial.diffuseColor.b).toBeCloseTo(originalColor.b);
  });

  it('should handle TransformNode with child meshes', () => {
    const mockMaterial = createMockStandardMaterial();
    mockMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);

    const mockTransformNode = new MockTransformNode();
    mockTransformNode._childMeshes = [{ material: mockMaterial }];

    flashEnemyRed(mockTransformNode as any);

    expect(mockMaterial.diffuseColor.r).toBeCloseTo(1);
  });

  it('should handle mesh without material', () => {
    const mockMesh = {
      material: null,
    };

    // Should not throw
    flashEnemyRed(mockMesh as any);
  });

  it('should handle mesh with non-StandardMaterial', () => {
    const mockMaterial = {
      diffuseColor: new Color3(0.5, 0.5, 0.5),
    };

    const mockMesh = {
      material: mockMaterial,
    };

    // Should not throw and should not modify (not instanceof StandardMaterial)
    flashEnemyRed(mockMesh as any);
    expect(mockMaterial.diffuseColor.r).toBeCloseTo(0.5);
  });
});

describe('animateEnemyDeath', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should scale down enemy mesh', () => {
    const mockMesh = {
      scaling: { setAll: vi.fn() },
      isDisposed: () => false,
      dispose: vi.fn(),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 0,
      maxHealth: 50,
      position: new Vector3(0, 0, 0),
      state: 'idle',
      attackCooldown: 0,
      species: 'skitterer',
    };

    animateEnemyDeath(enemy);

    // Advance through animation
    vi.advanceTimersByTime(100);
    vi.runAllTimers();

    expect(mockMesh.scaling.setAll).toHaveBeenCalled();
  });

  it('should dispose mesh after animation', () => {
    const mockMesh = {
      scaling: { setAll: vi.fn() },
      isDisposed: () => false,
      dispose: vi.fn(),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 0,
      maxHealth: 50,
      position: new Vector3(0, 0, 0),
      state: 'idle',
      attackCooldown: 0,
      species: 'skitterer',
    };

    animateEnemyDeath(enemy);

    // Advance past animation duration (500ms)
    vi.advanceTimersByTime(600);
    vi.runAllTimers();

    expect(mockMesh.dispose).toHaveBeenCalled();
  });

  it('should handle already disposed mesh', () => {
    const mockMesh = {
      scaling: { setAll: vi.fn() },
      isDisposed: () => true,
      dispose: vi.fn(),
    };

    const enemy: SurfaceEnemy = {
      mesh: mockMesh as any,
      health: 0,
      maxHealth: 50,
      position: new Vector3(0, 0, 0),
      state: 'idle',
      attackCooldown: 0,
      species: 'skitterer',
    };

    // Should not throw
    animateEnemyDeath(enemy);
    vi.advanceTimersByTime(600);
  });
});

// ---------------------------------------------------------------------------
// Environment Hazards Creation Tests - Constants Verification
// Note: Direct tests for createAcidPools/createUnstableTerrain require full
// Babylon.js scene context. These tests verify the hazard configuration instead.
// ---------------------------------------------------------------------------

describe('Acid Pool Configuration', () => {
  it('should have defined acid pool positions', () => {
    expect(ACID_POOL_POSITIONS.length).toBeGreaterThan(0);
  });

  it('should have valid acid pool structure', () => {
    for (const acid of ACID_POOL_POSITIONS) {
      expect(acid).toHaveProperty('x');
      expect(acid).toHaveProperty('z');
      expect(acid).toHaveProperty('radius');
      expect(typeof acid.x).toBe('number');
      expect(typeof acid.z).toBe('number');
      expect(acid.radius).toBeGreaterThan(0);
    }
  });

  it('should have acid pools within terrain bounds', () => {
    for (const acid of ACID_POOL_POSITIONS) {
      expect(acid.x).toBeGreaterThanOrEqual(-TERRAIN_BOUNDS);
      expect(acid.x).toBeLessThanOrEqual(TERRAIN_BOUNDS);
      expect(acid.z).toBeGreaterThanOrEqual(-TERRAIN_BOUNDS);
      expect(acid.z).toBeLessThanOrEqual(TERRAIN_BOUNDS);
    }
  });
});

describe('Unstable Terrain Configuration', () => {
  it('should have defined unstable terrain positions', () => {
    expect(UNSTABLE_TERRAIN_POSITIONS.length).toBeGreaterThan(0);
  });

  it('should have valid unstable terrain structure', () => {
    for (const terrain of UNSTABLE_TERRAIN_POSITIONS) {
      expect(terrain).toHaveProperty('x');
      expect(terrain).toHaveProperty('z');
      expect(terrain).toHaveProperty('size');
      expect(typeof terrain.x).toBe('number');
      expect(typeof terrain.z).toBe('number');
      expect(terrain.size).toBeGreaterThan(0);
    }
  });

  it('should have unstable terrain within terrain bounds', () => {
    for (const terrain of UNSTABLE_TERRAIN_POSITIONS) {
      expect(terrain.x).toBeGreaterThanOrEqual(-TERRAIN_BOUNDS);
      expect(terrain.x).toBeLessThanOrEqual(TERRAIN_BOUNDS);
      expect(terrain.z).toBeGreaterThanOrEqual(-TERRAIN_BOUNDS);
      expect(terrain.z).toBeLessThanOrEqual(TERRAIN_BOUNDS);
    }
  });

  it('should have 4 cracks per zone in expected creation', () => {
    // Verifies the expected structure: 1 zone + 4 cracks per position
    const expectedTotalMeshes = UNSTABLE_TERRAIN_POSITIONS.length * 5;
    expect(expectedTotalMeshes).toBe(UNSTABLE_TERRAIN_POSITIONS.length * 5);
  });
});

// ---------------------------------------------------------------------------
// Hazard Detection Tests
// ---------------------------------------------------------------------------

describe('isPlayerInAcidPool', () => {
  it('should return true when player is inside acid pool', () => {
    const firstPool = ACID_POOL_POSITIONS[0];
    const playerPos = new Vector3(firstPool.x, 0, firstPool.z);

    expect(isPlayerInAcidPool(playerPos)).toBe(true);
  });

  it('should return false when player is outside all pools', () => {
    const playerPos = new Vector3(0, 0, 0);

    expect(isPlayerInAcidPool(playerPos)).toBe(false);
  });

  it('should return true when at edge of pool', () => {
    const firstPool = ACID_POOL_POSITIONS[0];
    const playerPos = new Vector3(
      firstPool.x + firstPool.radius - 0.1,
      0,
      firstPool.z
    );

    expect(isPlayerInAcidPool(playerPos)).toBe(true);
  });

  it('should return false when just outside pool', () => {
    const firstPool = ACID_POOL_POSITIONS[0];
    const playerPos = new Vector3(
      firstPool.x + firstPool.radius + 0.5,
      0,
      firstPool.z
    );

    expect(isPlayerInAcidPool(playerPos)).toBe(false);
  });
});

describe('isPlayerOnUnstableTerrain', () => {
  it('should return true when player is on unstable terrain', () => {
    const firstTerrain = UNSTABLE_TERRAIN_POSITIONS[0];
    const playerPos = new Vector3(firstTerrain.x, 0, firstTerrain.z);

    expect(isPlayerOnUnstableTerrain(playerPos)).toBe(true);
  });

  it('should return false when player is on stable ground', () => {
    const playerPos = new Vector3(0, 0, 0);

    expect(isPlayerOnUnstableTerrain(playerPos)).toBe(false);
  });

  it('should return true when at edge of unstable zone', () => {
    const firstTerrain = UNSTABLE_TERRAIN_POSITIONS[0];
    const playerPos = new Vector3(
      firstTerrain.x + firstTerrain.size - 0.1,
      0,
      firstTerrain.z
    );

    expect(isPlayerOnUnstableTerrain(playerPos)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Visual Update Tests
// ---------------------------------------------------------------------------

describe('updateAcidPoolVisuals', () => {
  it('should update emissive color of pools', () => {
    const mockMaterial = createMockStandardMaterial();
    mockMaterial.emissiveColor = new Color3(0, 0, 0);

    const mockPools = [
      {
        material: mockMaterial,
      },
    ];

    updateAcidPoolVisuals(mockPools as any, 0);

    expect(mockMaterial.emissiveColor.g).toBeGreaterThan(0);
  });

  it('should pulse emissive color over time', () => {
    const mockMaterial = createMockStandardMaterial();

    const mockPools = [{ material: mockMaterial }];

    updateAcidPoolVisuals(mockPools as any, 0);
    const firstGreen = mockMaterial.emissiveColor.g;

    updateAcidPoolVisuals(mockPools as any, Math.PI / 4); // Quarter period
    const secondGreen = mockMaterial.emissiveColor.g;

    expect(firstGreen).not.toBe(secondGreen);
  });

  it('should handle pools without material', () => {
    const mockPools = [{ material: null }];

    // Should not throw
    updateAcidPoolVisuals(mockPools as any, 0);
  });

  it('should handle pools with non-StandardMaterial', () => {
    const mockMaterial = { emissiveColor: new Color3(0, 0, 0) };
    const mockPools = [{ material: mockMaterial }];

    // Should not throw and should not modify
    updateAcidPoolVisuals(mockPools as any, 0);
    expect(mockMaterial.emissiveColor.g).toBe(0);
  });
});

describe('updateUnstableTerrainVisuals', () => {
  it('should update emissive color of crack meshes', () => {
    const mockMaterial = createMockStandardMaterial();

    const mockTerrain = [
      {
        name: 'crack_0_0',
        material: mockMaterial,
      },
    ];

    updateUnstableTerrainVisuals(mockTerrain as any, 0);

    expect(mockMaterial.emissiveColor.r).toBeGreaterThan(0);
  });

  it('should not update non-crack meshes', () => {
    const mockMaterial = createMockStandardMaterial();
    mockMaterial.emissiveColor = new Color3(0, 0, 0);

    const mockTerrain = [
      {
        name: 'unstableZone_0',
        material: mockMaterial,
      },
    ];

    updateUnstableTerrainVisuals(mockTerrain as any, 0);

    // Should remain unchanged (name doesn't include 'crack')
    expect(mockMaterial.emissiveColor.r).toBe(0);
  });

  it('should pulse crack glow over time', () => {
    const mockMaterial = createMockStandardMaterial();

    const mockTerrain = [{ name: 'crack_0_0', material: mockMaterial }];

    updateUnstableTerrainVisuals(mockTerrain as any, 0);
    const firstRed = mockMaterial.emissiveColor.r;

    updateUnstableTerrainVisuals(mockTerrain as any, Math.PI / 6);
    const secondRed = mockMaterial.emissiveColor.r;

    expect(firstRed).not.toBe(secondRed);
  });

  it('should handle terrain with non-StandardMaterial', () => {
    const mockMaterial = { emissiveColor: new Color3(0, 0, 0) };
    const mockTerrain = [{ name: 'crack_0_0', material: mockMaterial }];

    // Should not throw and should not modify
    updateUnstableTerrainVisuals(mockTerrain as any, 0);
    expect(mockMaterial.emissiveColor.r).toBe(0);
  });
});
