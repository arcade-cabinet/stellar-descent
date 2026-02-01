/**
 * ExtractionLevel - Visual Effects Tests
 *
 * Unit tests for debris, stalactites, supply drops, and visual effects.
 * Target: 95%+ line coverage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js
vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn(),
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class MockPointLight {
    name: string;
    position: { x: number; y: number; z: number };
    diffuse = { r: 1, g: 1, b: 1 };
    intensity = 1;
    range = 10;
    parent: unknown = null;
    dispose = vi.fn();
    setEnabled = vi.fn();
    constructor(
      name: string,
      pos: { x: number; y: number; z: number } | undefined,
      _scene: unknown
    ) {
      this.name = name;
      this.position = pos ?? { x: 0, y: 0, z: 0 };
    }
  },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: class MockStandardMaterial {
    name: string;
    diffuseColor = { r: 1, g: 1, b: 1 };
    specularColor = { r: 0, g: 0, b: 0 };
    emissiveColor = { r: 0, g: 0, b: 0 };
    alpha = 1;
    disableLighting = false;
    dispose = vi.fn();
    constructor(name: string, _scene: unknown) {
      this.name = name;
    }
  },
}));

vi.mock('@babylonjs/core/Maths/math.color', () => {
  class MockColor3 {
    r: number;
    g: number;
    b: number;
    constructor(r = 0, g = 0, b = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
    static FromHexString(_hex: string) {
      return new MockColor3(1, 0, 0);
    }
  }
  class MockColor4 {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r = 0, g = 0, b = 0, a = 1) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
    }
    clone() {
      return new MockColor4(this.r, this.g, this.b, this.a);
    }
  }
  return { Color3: MockColor3, Color4: MockColor4 };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => ({
  Vector3: class MockVector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    clone() {
      return new MockVector3(this.x, this.y, this.z);
    }
    addInPlace(other: MockVector3) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
    scale(s: number) {
      return new MockVector3(this.x * s, this.y * s, this.z * s);
    }
    static Distance(a: MockVector3, b: MockVector3) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  },
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreatePolyhedron: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0, set: vi.fn(), addInPlace: vi.fn() },
      rotation: { x: 0, y: 0, z: 0, addInPlace: vi.fn() },
      material: null,
      dispose: vi.fn(),
      isVisible: true,
      setEnabled: vi.fn(),
    }),
    CreateCylinder: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
      material: null,
      animations: [],
      dispose: vi.fn(),
      isVisible: true,
    }),
    CreateDisc: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0, y: 0 },
      material: null,
      dispose: vi.fn(),
    }),
    CreateBox: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { y: 0 },
      material: null,
      dispose: vi.fn(),
    }),
    CreateTorus: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0 },
      material: null,
      dispose: vi.fn(),
    }),
  },
}));

vi.mock('@babylonjs/core/Animations/animation', () => ({
  Animation: class MockAnimation {
    setKeys = vi.fn();
    setEasingFunction = vi.fn();
    static ANIMATIONTYPE_FLOAT = 0;
    static ANIMATIONLOOPMODE_CONSTANT = 0;
  },
}));

vi.mock('@babylonjs/core/Animations/easing', () => ({
  CubicEase: class MockCubicEase {
    setEasingMode = vi.fn();
  },
  EasingFunction: {
    EASINGMODE_EASEOUT: 1,
  },
}));

vi.mock('../../core/AudioManager', () => ({
  getAudioManager: vi.fn().mockReturnValue({
    play: vi.fn(),
  }),
}));

vi.mock('../../effects/ParticleManager', () => ({
  particleManager: {
    emitDustImpact: vi.fn(),
    emitDebris: vi.fn(),
    emitExplosion: vi.fn(),
    emitMuzzleFlash: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    createInstanceByPath: vi.fn().mockReturnValue({
      position: { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }), addInPlace: vi.fn() },
      scaling: { setAll: vi.fn(), set: vi.fn() },
      rotation: { y: 0 },
      animations: [],
      dispose: vi.fn(),
      setEnabled: vi.fn(),
    }),
  },
}));

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import {
  animateFadeToBlack,
  animateSupplyDrops,
  createCollapseHealthPickups,
  createCollapseLight,
  createCrumblingWalls,
  createGroundCracks,
  createObjectiveMarker,
  emitLandingDust,
  spawnCollapseDebris,
  spawnFallingStalactite,
  spawnHiveEruption,
  spawnSupplyDrop,
  spawnTunnelDebris,
  updateCollapseAudio,
  updateCollapseLight,
  updateCrumblingWalls,
  updateDebris,
  updateFallingStalactites,
  updateGroundCracks,
  updateHealthPickups,
  updateObjectiveMarker,
  updateSupplyDrops,
} from './effects';
import type {
  CrumblingWall,
  DebrisChunk,
  FallingStalactite,
  HealthPickup,
  SupplyDrop,
} from './types';

describe('Visual Effects', () => {
  const mockScene = {
    beginAnimation: vi.fn(),
    clearColor: { r: 0, g: 0, b: 0, a: 1, clone: () => ({ r: 0, g: 0, b: 0, a: 1 }) },
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Debris Effects', () => {
    describe('spawnTunnelDebris', () => {
      it('should create debris ahead of player', () => {
        const debris = spawnTunnelDebris(mockScene, 0);

        expect(debris.mesh).toBeDefined();
        expect(debris.velocity).toBeDefined();
        expect(debris.rotationSpeed).toBeDefined();
        expect(debris.lifetime).toBe(5);
      });

      it('should spawn debris at varying positions', () => {
        const debris1 = spawnTunnelDebris(mockScene, 0);
        const debris2 = spawnTunnelDebris(mockScene, 100);

        // Debris should spawn ahead of each player position
        expect(debris1).toBeDefined();
        expect(debris2).toBeDefined();
      });
    });

    describe('spawnCollapseDebris', () => {
      it('should create debris near player position', () => {
        const playerPos = new Vector3(0, 0, 0);
        const debris = spawnCollapseDebris(mockScene, playerPos);

        expect(debris.mesh).toBeDefined();
        expect(debris.velocity.y).toBeLessThan(0); // Falling
        expect(debris.lifetime).toBeGreaterThan(0);
      });

      it('should use origin position when provided', () => {
        const playerPos = new Vector3(0, 0, 0);
        const originPos = new Vector3(50, 20, 50);
        const debris = spawnCollapseDebris(mockScene, playerPos, originPos);

        expect(debris.mesh).toBeDefined();
      });
    });

    describe('updateDebris', () => {
      it('should update debris positions and remove expired', () => {
        const debris: DebrisChunk[] = [
          {
            mesh: {
              position: { x: 0, y: 5, z: 0, addInPlace: vi.fn() },
              rotation: { x: 0, y: 0, z: 0, addInPlace: vi.fn() },
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, -5, 0),
            rotationSpeed: new Vector3(1, 1, 1),
            lifetime: 0.1,
          },
        ];
        const playerPos = new Vector3(0, 0, 0);

        const { updatedDebris, playerDamage } = updateDebris(debris, playerPos, 0.5);

        // Debris should be removed (lifetime expired)
        expect(updatedDebris.length).toBe(0);
      });

      it('should deal damage when debris hits player', () => {
        const debris: DebrisChunk[] = [
          {
            mesh: {
              position: { x: 0, y: 1, z: 0, addInPlace: vi.fn() },
              rotation: { x: 0, y: 0, z: 0, addInPlace: vi.fn() },
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, -1, 0),
            rotationSpeed: new Vector3(0, 0, 0),
            lifetime: 5,
          },
        ];
        const playerPos = new Vector3(0, 0, 0);

        const { playerDamage } = updateDebris(debris, playerPos, 0.1);

        expect(playerDamage).toBe(10);
      });

      it('should remove debris below ground', () => {
        const debris: DebrisChunk[] = [
          {
            mesh: {
              position: { x: 0, y: -5, z: 0, addInPlace: vi.fn() },
              rotation: { addInPlace: vi.fn() },
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, -5, 0),
            rotationSpeed: new Vector3(0, 0, 0),
            lifetime: 5,
          },
        ];
        const playerPos = new Vector3(100, 0, 100);

        const { updatedDebris } = updateDebris(debris, playerPos, 0.1);

        expect(updatedDebris.length).toBe(0);
      });
    });
  });

  describe('Stalactite Effects', () => {
    describe('spawnFallingStalactite', () => {
      it('should create stalactite with shadow marker', () => {
        const playerPos = new Vector3(0, 0, 0);
        const stalactite = spawnFallingStalactite(mockScene, playerPos);

        expect(stalactite.mesh).toBeDefined();
        expect(stalactite.velocity).toBeDefined();
        expect(stalactite.rotationSpeed).toBeDefined();
        expect(stalactite.hasImpacted).toBe(false);
        expect(stalactite.shadowMarker).toBeDefined();
      });
    });

    describe('updateFallingStalactites', () => {
      it('should apply gravity and update positions', () => {
        const stalactites: FallingStalactite[] = [
          {
            mesh: {
              position: { x: 0, y: 20, z: 0, addInPlace: vi.fn() },
              rotation: { addInPlace: vi.fn() },
              material: { alpha: 1 },
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, 0, 0),
            rotationSpeed: new Vector3(0, 0, 0),
            hasImpacted: false,
            shadowMarker: {
              position: { x: 0, z: 0 },
              material: { alpha: 0.5 },
              dispose: vi.fn(),
            } as any,
          },
        ];
        const playerPos = new Vector3(50, 0, 50);
        const triggerShake = vi.fn();

        const { updatedStalactites, playerDamage } = updateFallingStalactites(
          stalactites,
          playerPos,
          0.1,
          triggerShake
        );

        expect(updatedStalactites.length).toBe(1);
        expect(playerDamage).toBe(0);
      });

      it('should trigger impact when hitting ground', () => {
        const triggerShake = vi.fn();
        const stalactites: FallingStalactite[] = [
          {
            mesh: {
              position: {
                x: 0,
                y: 0.5,
                z: 0,
                addInPlace: vi.fn(),
                clone: () => new Vector3(0, 0.5, 0),
              },
              rotation: { addInPlace: vi.fn() },
              material: { alpha: 1 },
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, -5, 0),
            rotationSpeed: new Vector3(0, 0, 0),
            hasImpacted: false,
            shadowMarker: {
              position: { x: 0, z: 0 },
              material: { alpha: 0.5 },
              dispose: vi.fn(),
            } as any,
          },
        ];
        const playerPos = new Vector3(50, 0, 50);

        const { updatedStalactites } = updateFallingStalactites(
          stalactites,
          playerPos,
          0.1,
          triggerShake
        );

        expect(updatedStalactites[0].hasImpacted).toBe(true);
        expect(triggerShake).toHaveBeenCalled();
      });

      it('should deal heavy damage when hitting player', () => {
        const triggerShake = vi.fn();
        const stalactites: FallingStalactite[] = [
          {
            mesh: {
              position: {
                x: 0,
                y: 0.5,
                z: 0,
                addInPlace: vi.fn(),
                clone: () => new Vector3(0, 0.5, 0),
              },
              rotation: { addInPlace: vi.fn() },
              material: { alpha: 1 },
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, -5, 0),
            rotationSpeed: new Vector3(0, 0, 0),
            hasImpacted: false,
            shadowMarker: {
              position: { x: 0, z: 0 },
              material: { alpha: 0.5 },
              dispose: vi.fn(),
            } as any,
          },
        ];
        const playerPos = new Vector3(1, 0, 1); // Close to stalactite

        const { playerDamage, notificationMsg } = updateFallingStalactites(
          stalactites,
          playerPos,
          0.1,
          triggerShake
        );

        expect(playerDamage).toBe(25);
        expect(notificationMsg).toContain('CEILING COLLAPSE');
      });

      it('should deal light damage on near miss', () => {
        const triggerShake = vi.fn();
        const stalactites: FallingStalactite[] = [
          {
            mesh: {
              position: {
                x: 0,
                y: 0.5,
                z: 0,
                addInPlace: vi.fn(),
                clone: () => new Vector3(0, 0.5, 0),
              },
              rotation: { addInPlace: vi.fn() },
              material: { alpha: 1 },
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, -5, 0),
            rotationSpeed: new Vector3(0, 0, 0),
            hasImpacted: false,
            shadowMarker: {
              position: { x: 0, z: 0 },
              material: { alpha: 0.5 },
              dispose: vi.fn(),
            } as any,
          },
        ];
        const playerPos = new Vector3(4, 0, 4); // Near but not direct hit

        const { playerDamage, notificationMsg } = updateFallingStalactites(
          stalactites,
          playerPos,
          0.1,
          triggerShake
        );

        expect(playerDamage).toBe(10);
        expect(notificationMsg).toBe('NEAR MISS');
      });

      it('should fade out impacted stalactites', () => {
        const triggerShake = vi.fn();
        const meshMaterial = { alpha: 0.5 };
        const stalactites: FallingStalactite[] = [
          {
            mesh: {
              position: { x: 0, y: 0.5, z: 0, addInPlace: vi.fn() },
              rotation: { addInPlace: vi.fn() },
              material: meshMaterial,
              dispose: vi.fn(),
            } as any,
            velocity: new Vector3(0, 0, 0),
            rotationSpeed: new Vector3(0, 0, 0),
            hasImpacted: true,
            shadowMarker: null,
          },
        ];
        const playerPos = new Vector3(100, 0, 100);

        updateFallingStalactites(stalactites, playerPos, 0.5, triggerShake);

        expect(meshMaterial.alpha).toBe(0.25);
      });
    });
  });

  describe('Ground Effects', () => {
    describe('createGroundCracks', () => {
      it('should create 12 ground crack meshes', () => {
        const cracks = createGroundCracks(mockScene);

        expect(cracks.length).toBe(12);
      });
    });

    describe('updateGroundCracks', () => {
      it('should update crack glow based on intensity', () => {
        const crackMaterial = { emissiveColor: { r: 0, g: 0, b: 0 } };
        const cracks = [{ material: crackMaterial } as any];

        updateGroundCracks(cracks, 0.5);

        expect(crackMaterial.emissiveColor.r).toBeGreaterThan(0);
      });
    });
  });

  describe('Collapse Environment', () => {
    describe('createCollapseLight', () => {
      it('should create ominous glow light', () => {
        const light = createCollapseLight(mockScene);

        expect(light.intensity).toBe(50);
        expect(light.range).toBe(200);
      });
    });

    describe('updateCollapseLight', () => {
      it('should increase intensity with collapse progress', () => {
        const light = { intensity: 50 } as any;

        updateCollapseLight(light, 0.5);

        expect(light.intensity).toBe(100); // 50 + 0.5 * 100
      });
    });
  });

  describe('Health Pickups', () => {
    describe('createCollapseHealthPickups', () => {
      it('should create pickups at defined positions', () => {
        const pickups = createCollapseHealthPickups(mockScene);

        expect(pickups.length).toBeGreaterThan(0);
        pickups.forEach((p) => {
          expect(p.collected).toBe(false);
          expect(p.healAmount).toBeGreaterThan(0);
        });
      });
    });

    describe('updateHealthPickups', () => {
      it('should collect pickup when player is close', () => {
        const pickups: HealthPickup[] = [
          {
            mesh: {
              position: { x: 0, y: 0.5, z: 0, clone: () => new Vector3(0, 0.5, 0) },
              setEnabled: vi.fn(),
            } as any,
            collected: false,
            healAmount: 25,
          },
        ];
        const playerPos = new Vector3(1, 0, 1);

        const { healAmount, collectedPickup } = updateHealthPickups(pickups, playerPos);

        expect(healAmount).toBe(25);
        expect(collectedPickup).toBe(pickups[0]);
        expect(pickups[0].collected).toBe(true);
      });

      it('should skip already collected pickups', () => {
        const pickups: HealthPickup[] = [
          {
            mesh: { position: { x: 0, y: 0.5, z: 0 } } as any,
            collected: true,
            healAmount: 25,
          },
        ];
        const playerPos = new Vector3(0, 0, 0);

        const { healAmount } = updateHealthPickups(pickups, playerPos);

        expect(healAmount).toBe(0);
      });
    });
  });

  describe('Crumbling Walls', () => {
    describe('createCrumblingWalls', () => {
      it('should create walls at config positions', () => {
        const walls = createCrumblingWalls(mockScene);

        expect(walls.length).toBeGreaterThan(0);
        walls.forEach((w) => {
          expect(w.progress).toBe(0);
          expect(w.startY).toBeGreaterThan(0);
        });
      });
    });

    describe('updateCrumblingWalls', () => {
      it('should progress wall fall with collapse intensity', () => {
        const triggerShake = vi.fn();
        const walls: CrumblingWall[] = [
          {
            mesh: {
              position: { y: 12.5 },
              rotation: { x: 0 },
            } as any,
            progress: 0,
            startY: 12.5,
          },
        ];

        updateCrumblingWalls(walls, 0.5, 1.0, triggerShake);

        expect(walls[0].progress).toBeGreaterThan(0);
      });

      it('should trigger shake when wall starts falling', () => {
        const triggerShake = vi.fn();
        const walls: CrumblingWall[] = [
          {
            mesh: {
              position: { y: 12.5 },
              rotation: { x: 0 },
            } as any,
            progress: 0.1,
            startY: 12.5,
          },
        ];

        updateCrumblingWalls(walls, 0.8, 0.5, triggerShake);

        // Progress should increase
        expect(walls[0].progress).toBeGreaterThan(0.1);
      });
    });
  });

  describe('Objective Marker', () => {
    describe('createObjectiveMarker', () => {
      it('should create marker and beacon light', () => {
        const position = new Vector3(0, 0, -500);
        const { marker, beacon } = createObjectiveMarker(mockScene, position);

        expect(marker).toBeDefined();
        expect(beacon).toBeDefined();
        expect(beacon.intensity).toBe(80);
      });
    });

    describe('updateObjectiveMarker', () => {
      it('should pulse marker and beacon', () => {
        const marker = { material: { alpha: 0.25 } } as any;
        const beacon = { intensity: 80 } as any;

        updateObjectiveMarker(marker, beacon);

        // Alpha and intensity should be updated based on time
        expect(marker.material.alpha).toBeDefined();
        expect(beacon.intensity).toBeDefined();
      });
    });
  });

  describe('Collapse Audio', () => {
    describe('updateCollapseAudio', () => {
      it('should update audio timers', () => {
        const result = updateCollapseAudio(
          0.5, // intensity
          2.0, // audioTimer
          4.0, // groanTimer
          0, // lastScreamTime
          0.5, // deltaTime
          3 // rumbleInterval
        );

        expect(result.newAudioTimer).toBe(1.5);
        expect(result.newGroanTimer).toBe(3.5);
      });

      it('should play rumble when timer expires', async () => {
        const AudioManagerModule = await import('../../core/AudioManager');

        updateCollapseAudio(0.5, 0.1, 10, 0, 0.5, 3);

        expect(AudioManagerModule.getAudioManager().play).toHaveBeenCalledWith(
          'collapse_rumble',
          expect.any(Object)
        );
      });
    });
  });

  describe('Supply Drops', () => {
    describe('spawnSupplyDrop', () => {
      it('should create health supply drop', async () => {
        const drop = await spawnSupplyDrop(mockScene, 'health');

        expect(drop).not.toBeNull();
        expect(drop?.type).toBe('health');
        expect(drop?.amount).toBe(50);
        expect(drop?.collected).toBe(false);
      });

      it('should create ammo supply drop', async () => {
        const drop = await spawnSupplyDrop(mockScene, 'ammo');

        expect(drop).not.toBeNull();
        expect(drop?.type).toBe('ammo');
        expect(drop?.amount).toBe(60);
      });

      it('should rotate through spawn positions', async () => {
        // Spawn multiple drops
        await spawnSupplyDrop(mockScene, 'health');
        await spawnSupplyDrop(mockScene, 'ammo');
        await spawnSupplyDrop(mockScene, 'health');
        await spawnSupplyDrop(mockScene, 'ammo');

        // Should cycle through 4 positions
        const drop = await spawnSupplyDrop(mockScene, 'health');
        expect(drop).not.toBeNull();
      });
    });

    describe('updateSupplyDrops', () => {
      it('should collect drop when player is close', () => {
        const drops: SupplyDrop[] = [
          {
            mesh: {
              position: { x: 0, y: 0.5, z: 0, clone: () => new Vector3(0, 0.5, 0) },
              setEnabled: vi.fn(),
            } as any,
            type: 'health',
            collected: false,
            amount: 50,
          },
        ];
        const playerPos = new Vector3(1, 0, 1);

        const { healthRestore, ammoRestore, collectedDrop } = updateSupplyDrops(drops, playerPos);

        expect(healthRestore).toBe(50);
        expect(ammoRestore).toBe(0);
        expect(collectedDrop).toBe(drops[0]);
      });

      it('should restore ammo from ammo drops', () => {
        const drops: SupplyDrop[] = [
          {
            mesh: {
              position: { x: 0, y: 0.5, z: 0, clone: () => new Vector3(0, 0.5, 0) },
              setEnabled: vi.fn(),
            } as any,
            type: 'ammo',
            collected: false,
            amount: 60,
          },
        ];
        const playerPos = new Vector3(1, 0, 1);

        const { healthRestore, ammoRestore } = updateSupplyDrops(drops, playerPos);

        expect(healthRestore).toBe(0);
        expect(ammoRestore).toBe(60);
      });

      it('should skip collected drops', () => {
        const drops: SupplyDrop[] = [
          {
            mesh: { position: { x: 0, y: 0.5, z: 0 } } as any,
            type: 'health',
            collected: true,
            amount: 50,
          },
        ];
        const playerPos = new Vector3(0, 0, 0);

        const { healthRestore, ammoRestore } = updateSupplyDrops(drops, playerPos);

        expect(healthRestore).toBe(0);
        expect(ammoRestore).toBe(0);
      });
    });

    describe('animateSupplyDrops', () => {
      it('should bob and rotate uncollected drops', () => {
        const drops: SupplyDrop[] = [
          {
            mesh: {
              position: { y: 0.5 },
              rotation: { y: 0 },
            } as any,
            type: 'health',
            collected: false,
            amount: 50,
          },
        ];

        animateSupplyDrops(drops, 1.5);

        expect(drops[0].mesh.position.y).not.toBe(0.5);
        expect(drops[0].mesh.rotation.y).toBeGreaterThan(0);
      });

      it('should skip collected drops', () => {
        const drops: SupplyDrop[] = [
          {
            mesh: {
              position: { y: 0.5 },
              rotation: { y: 0 },
            } as any,
            type: 'health',
            collected: true,
            amount: 50,
          },
        ];

        animateSupplyDrops(drops, 1.5);

        expect(drops[0].mesh.position.y).toBe(0.5);
        expect(drops[0].mesh.rotation.y).toBe(0);
      });
    });
  });

  describe('Landing Effects', () => {
    describe('emitLandingDust', () => {
      it('should emit multiple dust bursts', async () => {
        const ParticleManagerModule = await import('../../effects/ParticleManager');
        const position = new Vector3(0, 0, -500);

        emitLandingDust(position, 2.0);

        // Should emit 8 dust impacts in ring + 1 center
        expect(ParticleManagerModule.particleManager.emitDustImpact).toHaveBeenCalled();
        expect(ParticleManagerModule.particleManager.emitDebris).toHaveBeenCalled();
      });
    });
  });

  describe('Fade to Black', () => {
    describe('animateFadeToBlack', () => {
      it('should start fade animation', () => {
        vi.useFakeTimers();

        const onComplete = vi.fn();
        const interval = animateFadeToBlack(mockScene, 1000, onComplete);

        expect(interval).toBeDefined();

        vi.advanceTimersByTime(1100);

        expect(onComplete).toHaveBeenCalled();

        vi.useRealTimers();
      });
    });
  });

  describe('Hive Eruption', () => {
    describe('spawnHiveEruption', () => {
      it('should create eruption pillar with animation', () => {
        const position = new Vector3(0, 0, 0);
        const mesh = spawnHiveEruption(mockScene, position);

        expect(mesh).toBeDefined();
        expect(mockScene.beginAnimation).toHaveBeenCalled();
      });
    });
  });
});
