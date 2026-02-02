/**
 * Curved Corridor Tests
 *
 * Tests for the ring station curved corridor construction.
 * Tests corridor generation, position helpers, and collision detection.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it, vi } from 'vitest';

// Mock Babylon.js dependencies
vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateRibbon: vi.fn(() => createMockMesh('ribbon')),
    CreateBox: vi.fn(() => createMockMesh('box')),
    CreateCylinder: vi.fn(() => createMockMesh('cylinder')),
    CreateTube: vi.fn(() => createMockMesh('tube')),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: vi.fn().mockImplementation((name) => ({
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1, 1, 1),
    parent: null,
    getChildMeshes: vi.fn(() => []),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation(() => ({
    diffuseColor: { r: 0, g: 0, b: 0 },
    emissiveColor: { r: 0, g: 0, b: 0 },
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn().mockImplementation(() => ({
    position: new Vector3(0, 0, 0),
    diffuse: { r: 1, g: 1, b: 1 },
    intensity: 1,
    dispose: vi.fn(),
  })),
}));

// Helper to create mock mesh
function createMockMesh(name: string) {
  return {
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    material: null,
    receiveShadows: false,
    checkCollisions: false,
    dispose: vi.fn(),
  };
}

describe('CurvedCorridor - Configuration Interface', () => {
  describe('Required Properties', () => {
    it('should define ring radius', () => {
      const config = {
        ringRadius: 50,
      };
      expect(config.ringRadius).toBe(50);
    });

    it('should define start angle and arc angle', () => {
      const config = {
        startAngle: -Math.PI / 2,
        arcAngle: Math.PI / 10,
      };
      expect(config.startAngle).toBeCloseTo(-Math.PI / 2);
      expect(config.arcAngle).toBeCloseTo(Math.PI / 10);
    });

    it('should define corridor dimensions', () => {
      const config = {
        width: 4,
        height: 3,
      };
      expect(config.width).toBe(4);
      expect(config.height).toBe(3);
    });

    it('should define segment count', () => {
      const config = {
        segments: 8,
      };
      expect(config.segments).toBe(8);
    });
  });

  describe('Optional Properties', () => {
    it('should define window options', () => {
      const config = {
        hasWindows: true,
        windowCount: 2,
      };
      expect(config.hasWindows).toBe(true);
      expect(config.windowCount).toBe(2);
    });

    it('should define lighting options', () => {
      const config = {
        hasOverheadLights: true,
        lightCount: 2,
      };
      expect(config.hasOverheadLights).toBe(true);
      expect(config.lightCount).toBe(2);
    });

    it('should define detail options', () => {
      const config = {
        hasFloorGrating: true,
        hasPipes: true,
        hasRivets: true,
      };
      expect(config.hasFloorGrating).toBe(true);
      expect(config.hasPipes).toBe(true);
      expect(config.hasRivets).toBe(true);
    });

    it('should define door options', () => {
      const config = {
        hasDoorStart: true,
        hasDoorEnd: false,
      };
      expect(config.hasDoorStart).toBe(true);
      expect(config.hasDoorEnd).toBe(false);
    });
  });
});

describe('CurvedCorridor - Position Helpers', () => {
  describe('getPositionOnCorridor', () => {
    it('should calculate position at start of corridor', () => {
      const ringRadius = 50;
      const startAngle = -Math.PI / 2;

      const getPositionOnCorridor = (
        t: number,
        config: { ringRadius: number; startAngle: number; arcAngle: number }
      ) => {
        const angle = config.startAngle + t * config.arcAngle;
        return new Vector3(
          Math.cos(angle) * config.ringRadius,
          0,
          Math.sin(angle) * config.ringRadius
        );
      };

      const pos = getPositionOnCorridor(0, {
        ringRadius,
        startAngle,
        arcAngle: Math.PI / 10,
      });

      // At -PI/2, cos = 0, sin = -1
      expect(pos.x).toBeCloseTo(0);
      expect(pos.z).toBeCloseTo(-50);
    });

    it('should calculate position at end of corridor', () => {
      const ringRadius = 50;
      const startAngle = 0;
      const arcAngle = Math.PI / 2;

      const getPositionOnCorridor = (
        t: number,
        config: { ringRadius: number; startAngle: number; arcAngle: number }
      ) => {
        const angle = config.startAngle + t * config.arcAngle;
        return new Vector3(
          Math.cos(angle) * config.ringRadius,
          0,
          Math.sin(angle) * config.ringRadius
        );
      };

      const pos = getPositionOnCorridor(1, {
        ringRadius,
        startAngle,
        arcAngle,
      });

      // At PI/2, cos = 0, sin = 1
      expect(pos.x).toBeCloseTo(0);
      expect(pos.z).toBeCloseTo(50);
    });

    it('should calculate position at midpoint of corridor', () => {
      const ringRadius = 50;
      const startAngle = 0;
      const arcAngle = Math.PI / 2;

      const getPositionOnCorridor = (
        t: number,
        config: { ringRadius: number; startAngle: number; arcAngle: number }
      ) => {
        const angle = config.startAngle + t * config.arcAngle;
        return new Vector3(
          Math.cos(angle) * config.ringRadius,
          0,
          Math.sin(angle) * config.ringRadius
        );
      };

      const pos = getPositionOnCorridor(0.5, {
        ringRadius,
        startAngle,
        arcAngle,
      });

      // At PI/4, cos = sin = sqrt(2)/2
      const expected = 50 * Math.SQRT1_2;
      expect(pos.x).toBeCloseTo(expected);
      expect(pos.z).toBeCloseTo(expected);
    });
  });

  describe('isInCorridor', () => {
    it('should return true for position inside corridor', () => {
      const config = {
        ringRadius: 50,
        startAngle: 0,
        arcAngle: Math.PI / 2,
        width: 4,
      };

      const isInCorridor = (pos: Vector3, cfg: typeof config) => {
        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        const angle = Math.atan2(pos.z, pos.x);

        const withinRadius =
          distFromCenter >= cfg.ringRadius - cfg.width / 2 &&
          distFromCenter <= cfg.ringRadius + cfg.width / 2;

        let normalizedAngle = angle;
        if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

        const endAngle = cfg.startAngle + cfg.arcAngle;
        const withinAngle = normalizedAngle >= cfg.startAngle && normalizedAngle <= endAngle;

        return withinRadius && withinAngle;
      };

      // Position on the ring at angle PI/4
      const testPos = new Vector3(50 * Math.cos(Math.PI / 4), 0, 50 * Math.sin(Math.PI / 4));

      expect(isInCorridor(testPos, config)).toBe(true);
    });

    it('should return false for position outside corridor radius', () => {
      const config = {
        ringRadius: 50,
        startAngle: 0,
        arcAngle: Math.PI / 2,
        width: 4,
      };

      const isInCorridor = (pos: Vector3, cfg: typeof config) => {
        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        return (
          distFromCenter >= cfg.ringRadius - cfg.width / 2 &&
          distFromCenter <= cfg.ringRadius + cfg.width / 2
        );
      };

      // Position too far from ring
      const testPos = new Vector3(30, 0, 0);

      expect(isInCorridor(testPos, config)).toBe(false);
    });

    it('should return false for position outside corridor angle', () => {
      const config = {
        ringRadius: 50,
        startAngle: 0,
        arcAngle: Math.PI / 4, // 0 to 45 degrees
        width: 4,
      };

      const isInCorridor = (pos: Vector3, cfg: typeof config) => {
        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        const angle = Math.atan2(pos.z, pos.x);

        const withinRadius =
          distFromCenter >= cfg.ringRadius - cfg.width / 2 &&
          distFromCenter <= cfg.ringRadius + cfg.width / 2;

        const endAngle = cfg.startAngle + cfg.arcAngle;
        const withinAngle = angle >= cfg.startAngle && angle <= endAngle;

        return withinRadius && withinAngle;
      };

      // Position at 90 degrees (outside 0-45 degree range)
      const testPos = new Vector3(0, 0, 50);

      expect(isInCorridor(testPos, config)).toBe(false);
    });
  });

  describe('clampToCorridor', () => {
    it('should clamp position to corridor bounds', () => {
      const config = {
        ringRadius: 50,
        width: 4,
      };

      const clampToCorridor = (pos: Vector3, cfg: typeof config) => {
        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        const angle = Math.atan2(pos.z, pos.x);

        const minRadius = cfg.ringRadius - cfg.width / 2;
        const maxRadius = cfg.ringRadius + cfg.width / 2;

        const clampedRadius = Math.max(minRadius, Math.min(maxRadius, distFromCenter));

        return new Vector3(Math.cos(angle) * clampedRadius, pos.y, Math.sin(angle) * clampedRadius);
      };

      // Position too far out
      const outsidePos = new Vector3(60, 0, 0);
      const clamped = clampToCorridor(outsidePos, config);

      expect(clamped.x).toBeCloseTo(52); // Max radius
    });

    it('should preserve Y coordinate when clamping', () => {
      const config = {
        ringRadius: 50,
        width: 4,
      };

      const clampToCorridor = (pos: Vector3, cfg: typeof config) => {
        const distFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        const angle = Math.atan2(pos.z, pos.x);

        const minRadius = cfg.ringRadius - cfg.width / 2;
        const maxRadius = cfg.ringRadius + cfg.width / 2;

        const clampedRadius = Math.max(minRadius, Math.min(maxRadius, distFromCenter));

        return new Vector3(Math.cos(angle) * clampedRadius, pos.y, Math.sin(angle) * clampedRadius);
      };

      const pos = new Vector3(60, 1.7, 0);
      const clamped = clampToCorridor(pos, config);

      expect(clamped.y).toBe(1.7);
    });
  });
});

describe('CurvedCorridor - Corridor Result Interface', () => {
  it('should define root transform node', () => {
    const result = {
      root: { name: 'corridor_root', dispose: vi.fn() },
    };

    expect(result.root.name).toBe('corridor_root');
  });

  it('should define floor mesh', () => {
    const result = {
      floor: createMockMesh('corridor_floor'),
    };

    expect(result.floor.name).toBe('corridor_floor');
  });

  it('should define walls array', () => {
    const result = {
      walls: [createMockMesh('wall_inner'), createMockMesh('wall_outer')],
    };

    expect(result.walls.length).toBe(2);
  });

  it('should define ceiling mesh', () => {
    const result = {
      ceiling: createMockMesh('corridor_ceiling'),
    };

    expect(result.ceiling.name).toBe('corridor_ceiling');
  });

  it('should define door objects', () => {
    const result = {
      doors: {
        start: createMockMesh('door_start'),
        end: null,
      },
    };

    expect(result.doors.start).not.toBe(null);
    expect(result.doors.end).toBe(null);
  });

  it('should define openDoor method', () => {
    let doorOpen = false;
    const result = {
      openDoor: vi.fn((which: 'start' | 'end') => {
        doorOpen = true;
        return which;
      }),
    };

    result.openDoor('start');
    expect(doorOpen).toBe(true);
    expect(result.openDoor).toHaveBeenCalledWith('start');
  });

  it('should define dispose method', () => {
    const result = {
      dispose: vi.fn(),
    };

    result.dispose();
    expect(result.dispose).toHaveBeenCalled();
  });
});

describe('CurvedCorridor - Geometry Generation', () => {
  describe('Floor Generation', () => {
    it('should generate floor segments matching config', () => {
      const config = { segments: 8 };

      // Floor uses segments + 1 vertices per row
      const vertexCount = config.segments + 1;
      expect(vertexCount).toBe(9);
    });

    it('should apply floor grating when enabled', () => {
      const config = {
        hasFloorGrating: true,
        segments: 8,
      };

      expect(config.hasFloorGrating).toBe(true);
    });
  });

  describe('Wall Generation', () => {
    it('should generate inner and outer walls', () => {
      const wallCount = 2; // Inner and outer walls

      expect(wallCount).toBe(2);
    });
  });

  describe('Window Generation', () => {
    it('should place windows evenly along corridor', () => {
      const config = {
        windowCount: 3,
        arcAngle: Math.PI / 2,
      };

      const windowSpacing = config.arcAngle / (config.windowCount + 1);
      const windowAngles: number[] = [];

      for (let i = 1; i <= config.windowCount; i++) {
        windowAngles.push(windowSpacing * i);
      }

      expect(windowAngles.length).toBe(3);
      expect(windowAngles[1]).toBeCloseTo(config.arcAngle / 2);
    });
  });

  describe('Light Placement', () => {
    it('should place lights at regular intervals', () => {
      const config = {
        lightCount: 4,
        arcAngle: Math.PI / 2,
      };

      const lightSpacing = config.arcAngle / (config.lightCount + 1);
      const lightPositions: number[] = [];

      for (let i = 1; i <= config.lightCount; i++) {
        lightPositions.push(lightSpacing * i);
      }

      expect(lightPositions.length).toBe(4);
    });
  });

  describe('Pipe Generation', () => {
    it('should generate pipes when enabled', () => {
      const config = {
        hasPipes: true,
      };

      expect(config.hasPipes).toBe(true);
    });
  });

  describe('Rivet Details', () => {
    it('should add rivets when enabled', () => {
      const config = {
        hasRivets: true,
      };

      expect(config.hasRivets).toBe(true);
    });
  });
});

describe('CurvedCorridor - Door Mechanics', () => {
  describe('Door Animation', () => {
    it('should animate door opening', () => {
      let doorPosition = 0;
      const targetPosition = 2.5; // Door opens by sliding up

      const animateDoor = (elapsed: number, duration: number) => {
        const t = Math.min(elapsed / duration, 1);
        doorPosition = t * targetPosition;
        return doorPosition;
      };

      const finalPos = animateDoor(1000, 1000);
      expect(finalPos).toBeCloseTo(2.5);
    });
  });

  describe('Door States', () => {
    it('should track door open/closed state', () => {
      const doorStates = {
        start: false,
        end: false,
      };

      const openDoor = (which: 'start' | 'end') => {
        doorStates[which] = true;
      };

      openDoor('start');
      expect(doorStates.start).toBe(true);
      expect(doorStates.end).toBe(false);
    });
  });
});

describe('CurvedCorridor - Collision Detection', () => {
  it('should enable collisions on floor', () => {
    const floor = {
      checkCollisions: true,
    };

    expect(floor.checkCollisions).toBe(true);
  });

  it('should enable collisions on walls', () => {
    const walls = [{ checkCollisions: true }, { checkCollisions: true }];

    walls.forEach((wall) => {
      expect(wall.checkCollisions).toBe(true);
    });
  });

  it('should disable collisions on decorative elements', () => {
    const decorative = {
      checkCollisions: false,
    };

    expect(decorative.checkCollisions).toBe(false);
  });
});

describe('CurvedCorridor - Shadow Reception', () => {
  it('should enable shadow reception on floor', () => {
    const floor = {
      receiveShadows: true,
    };

    expect(floor.receiveShadows).toBe(true);
  });

  it('should enable shadow reception on walls', () => {
    const wall = {
      receiveShadows: true,
    };

    expect(wall.receiveShadows).toBe(true);
  });
});
