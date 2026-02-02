/**
 * VehicleController.test.ts - Comprehensive unit tests for vehicle physics and controls
 *
 * Tests cover:
 * - Vehicle initialization and configuration
 * - Steering input (keyboard, mouse, gyroscope, touch)
 * - Throttle/brake mechanics
 * - Boost system with cooldown
 * - Turret aiming and firing
 * - Vehicle damage and destruction
 * - Ramp jump mechanics
 * - Camera following behavior
 * - Vehicle exit conditions
 *
 * Coverage target: 95% line coverage, 90% branch coverage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Define mock helpers with vi.hoisted to fix hoisting issues
const { createMockVector3, createMockMesh } = vi.hoisted(() => {
  const createMockVector3 = (x = 0, y = 0, z = 0): any => ({
    x,
    y,
    z,
    clone: function () {
      return createMockVector3(this.x, this.y, this.z);
    },
    copyFrom: function (other: any) {
      this.x = other.x;
      this.y = other.y;
      this.z = other.z;
      return this;
    },
    add: function (other: any) {
      return createMockVector3(this.x + other.x, this.y + other.y, this.z + other.z);
    },
    addInPlace: function (other: any) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    },
    subtract: function (other: any) {
      return createMockVector3(this.x - other.x, this.y - other.y, this.z - other.z);
    },
    scale: function (s: number) {
      return createMockVector3(this.x * s, this.y * s, this.z * s);
    },
    normalize: () => createMockVector3(0, 0, 1),
    set: () => {},
    setAll: () => {},
    length: function () {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    },
  });

  const createMockMesh = (name = 'mesh'): any => ({
    name,
    position: createMockVector3(0, 0, 0),
    rotation: { x: 0, y: 0, z: 0 },
    rotationQuaternion: null,
    scaling: { x: 1, y: 1, z: 1, set: () => {}, setAll: () => {}, scaleInPlace: () => {} },
    material: null,
    parent: null,
    isVisible: true,
    isDisposed: () => false,
    dispose: () => {},
    getWorldMatrix: () => ({}),
    getAbsolutePosition: () => createMockVector3(0, 2, 0),
  });

  return { createMockVector3, createMockMesh };
});

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Cameras/universalCamera', () => ({
  UniversalCamera: class MockUniversalCamera {
    position = { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }), copyFrom: () => {} };
    rotation = { x: 0, y: 0, z: 0 };
    fov = Math.PI / 4;
  },
}));

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: class MockPointLight {
    intensity = 0;
    diffuse = {};
    range = 8;
    parent: any = null;
    dispose = () => {};
  },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: class MockStandardMaterial {
    diffuseColor = {};
    specularColor = {};
    emissiveColor = {};
    alpha = 1;
    disableLighting = false;
    dispose = () => {};
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
    static FromHexString = () => new MockColor3(0.5, 0.5, 0.5);
  }
  return { Color3: MockColor3 };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => {
  class MockVector3 {
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
    copyFrom(other: any) {
      this.x = other.x;
      this.y = other.y;
      this.z = other.z;
      return this;
    }
    add(other: any) {
      return new MockVector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }
    addInPlace(other: any) {
      this.x += other.x;
      this.y += other.y;
      this.z += other.z;
      return this;
    }
    subtract(other: any) {
      return new MockVector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
    scale(s: number) {
      return new MockVector3(this.x * s, this.y * s, this.z * s);
    }
    scaleInPlace(s: number) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      return this;
    }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
      if (len > 0) {
        return new MockVector3(this.x / len, this.y / len, this.z / len);
      }
      return new MockVector3(0, 0, 1);
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    setAll(v: number) {
      this.x = v;
      this.y = v;
      this.z = v;
    }
    length() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    static Zero = () => new MockVector3(0, 0, 0);
    static Up = () => new MockVector3(0, 1, 0);
    static Distance = () => 10;
    static Lerp = (a: any, b: any, t: number) =>
      new MockVector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    static Cross = () => new MockVector3(1, 0, 0);
    static Dot = () => 0.5;
    static TransformNormal = () => new MockVector3(0, 1, 0);
  }

  class MockQuaternion {
    x = 0;
    y = 0;
    z = 0;
    w = 1;
    static RotationAxis = () => new MockQuaternion();
  }

  return { Vector3: MockVector3, Quaternion: MockQuaternion };
});

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn((name) => createMockMesh(name)),
    CreateCylinder: vi.fn((name) => createMockMesh(name)),
    CreateSphere: vi.fn((name) => createMockMesh(name)),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => ({
  TransformNode: class MockTransformNode {
    name: string;
    position = createMockVector3(0, 0, 0);
    rotation = { x: 0, y: 0, z: 0 };
    scaling = { x: 1, y: 1, z: 1, set: () => {}, setAll: () => {} };
    parent: any = null;
    dispose = () => {};
    getAbsolutePosition = () => createMockVector3(0, 2, 0);
    getWorldMatrix = () => ({});
    constructor(name: string) {
      this.name = name;
    }
  },
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    loadAssetByPath: vi.fn().mockResolvedValue({}),
    createInstanceByPath: vi.fn().mockReturnValue({
      position: createMockVector3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { x: 1, y: 1, z: 1, set: vi.fn(), setAll: vi.fn() },
      parent: null,
      dispose: vi.fn(),
      getWorldMatrix: vi.fn().mockReturnValue({}),
      getAbsolutePosition: () => createMockVector3(0, 2, 0),
    }),
  },
}));

vi.mock('../../core/AudioManager', () => ({
  getAudioManager: () => ({
    play: vi.fn(),
  }),
}));

vi.mock('../../input/InputBridge', () => ({
  isVehicleKeyPressed: vi.fn(() => false),
}));

// Import after mocks
import { VehicleController, type VehicleTouchInput } from './VehicleController';

describe('VehicleController', () => {
  let mockScene: any;
  let mockCamera: any;
  let spawnPosition: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScene = {
      onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
    };

    mockCamera = {
      position: createMockVector3(0, 4, -10),
      rotation: { x: 0, y: 0, z: 0 },
      fov: Math.PI / 4,
    };

    spawnPosition = createMockVector3(0, 2, -20);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Static Factory', () => {
    it('should create vehicle via static factory method', async () => {
      const vehicle = await VehicleController.create(mockScene, mockCamera, spawnPosition);
      expect(vehicle).toBeInstanceOf(VehicleController);
    });

    it('should accept partial config override', async () => {
      const vehicle = await VehicleController.create(mockScene, mockCamera, spawnPosition, {
        maxSpeed: 80,
        maxHealth: 150,
      });
      expect(vehicle).toBeDefined();
    });

    it('should accept partial camera config override', async () => {
      const vehicle = await VehicleController.create(
        mockScene,
        mockCamera,
        spawnPosition,
        {},
        { followDistance: 20 }
      );
      expect(vehicle).toBeDefined();
    });
  });

  describe('Constructor', () => {
    it('should initialize with spawn position', () => {
      const vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
      const pos = vehicle.getPosition();
      expect(pos.x).toBe(0);
      expect(pos.y).toBe(2);
      expect(pos.z).toBe(-20);
    });

    it('should initialize health to max health', () => {
      const vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
      expect(vehicle.getHealth()).toBe(120);
    });

    it('should initialize with full boost fuel', () => {
      const vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
      expect(vehicle.getBoostFuelNormalized()).toBe(1.0);
    });

    it('should not be dead initially', () => {
      const vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
      expect(vehicle.isDead()).toBe(false);
    });

    it('should not be boosting initially', () => {
      const vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
      expect(vehicle.isBoosting()).toBe(false);
    });
  });

  describe('Input Building', () => {
    describe('Keyboard Input', () => {
      it('should build input with no keys pressed', () => {
        const keys = new Set<string>();
        const input = VehicleController.buildInput(keys, null);
        expect(input.steer).toBe(0);
        expect(input.throttle).toBe(0);
        expect(input.brake).toBe(0);
        expect(input.boost).toBe(false);
      });

      it('should detect left steering with KeyA', () => {
        const keys = new Set(['KeyA']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.steer).toBe(-1);
      });

      it('should detect right steering with KeyD', () => {
        const keys = new Set(['KeyD']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.steer).toBe(1);
      });

      it('should detect left steering with ArrowLeft', () => {
        const keys = new Set(['ArrowLeft']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.steer).toBe(-1);
      });

      it('should detect right steering with ArrowRight', () => {
        const keys = new Set(['ArrowRight']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.steer).toBe(1);
      });

      it('should cancel steering when both left and right pressed', () => {
        const keys = new Set(['KeyA', 'KeyD']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.steer).toBe(0);
      });

      it('should detect throttle with KeyW', () => {
        const keys = new Set(['KeyW']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.throttle).toBe(1);
      });

      it('should detect throttle with ArrowUp', () => {
        const keys = new Set(['ArrowUp']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.throttle).toBe(1);
      });

      it('should detect brake with KeyS', () => {
        const keys = new Set(['KeyS']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.brake).toBe(1);
      });

      it('should detect boost with ShiftLeft', () => {
        const keys = new Set(['ShiftLeft']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.boost).toBe(true);
      });

      it('should detect handbrake with Space', () => {
        const keys = new Set(['Space']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.handbrake).toBe(true);
      });

      it('should detect exit request with KeyE', () => {
        const keys = new Set(['KeyE']);
        const input = VehicleController.buildInput(keys, null);
        expect(input.exitRequest).toBe(true);
      });
    });

    describe('Mouse Input', () => {
      it('should build turret aim from mouse movement', () => {
        const keys = new Set<string>();
        const mouseState = {
          movementX: 100,
          movementY: -50,
          leftButton: false,
          rightButton: false,
        };
        const input = VehicleController.buildInput(keys, null, mouseState);
        expect(input.turretAimX).toBe(100 * 0.003);
        expect(input.turretAimY).toBe(-50 * 0.003);
      });

      it('should detect fire from left mouse button', () => {
        const keys = new Set<string>();
        const mouseState = {
          movementX: 0,
          movementY: 0,
          leftButton: true,
          rightButton: false,
        };
        const input = VehicleController.buildInput(keys, null, mouseState);
        expect(input.fire).toBe(true);
      });
    });

    describe('Touch Input', () => {
      it('should detect steering from touch movement X', () => {
        const keys = new Set<string>();
        const touchInput = { movement: { x: 0.5, y: 0 } };
        const input = VehicleController.buildInput(keys, touchInput);
        expect(input.steer).toBe(0.5);
      });

      it('should clamp steering to -1 to 1', () => {
        const keys = new Set<string>();
        const touchInput = { movement: { x: 2.0, y: 0 } };
        const input = VehicleController.buildInput(keys, touchInput);
        expect(input.steer).toBe(1);
      });

      it('should detect throttle from positive touch Y', () => {
        const keys = new Set<string>();
        const touchInput = { movement: { x: 0, y: 0.8 } };
        const input = VehicleController.buildInput(keys, touchInput);
        expect(input.throttle).toBe(0.8);
      });

      it('should detect brake from negative touch Y', () => {
        const keys = new Set<string>();
        const touchInput = { movement: { x: 0, y: -0.6 } };
        const input = VehicleController.buildInput(keys, touchInput);
        expect(input.brake).toBe(0.6);
      });

      it('should detect boost from touch sprint', () => {
        const keys = new Set<string>();
        const touchInput = { movement: { x: 0, y: 0 }, isSprinting: true };
        const input = VehicleController.buildInput(keys, touchInput);
        expect(input.boost).toBe(true);
      });
    });

    describe('Touch Input (Mobile-specific)', () => {
      it('should build input from VehicleTouchInput', () => {
        const touch: VehicleTouchInput = {
          movement: { x: 0.5, y: 0.7 },
          turretAim: { x: 0.3, y: -0.1 },
          isFiring: true,
          isBoosting: true,
        };
        const input = VehicleController.buildInputFromTouch(touch);
        expect(input.steer).toBe(0.5);
        expect(input.throttle).toBe(0.7);
        expect(input.boost).toBe(true);
        expect(input.fire).toBe(true);
      });

      it('should apply deadzone to touch input', () => {
        const touch: VehicleTouchInput = {
          movement: { x: 0.1, y: 0.1 },
          turretAim: { x: 0, y: 0 },
          isFiring: false,
          isBoosting: false,
        };
        const input = VehicleController.buildInputFromTouch(touch);
        expect(input.steer).toBe(0);
        expect(input.throttle).toBe(0);
      });
    });
  });

  describe('Physics Update', () => {
    let vehicle: VehicleController;
    const getTerrainHeight = vi.fn(() => 0);

    beforeEach(() => {
      vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
    });

    afterEach(() => {
      vehicle.dispose();
    });

    it('should not update when dead', () => {
      (vehicle as any).state.isDead = true;
      const initialPos = vehicle.getPosition().clone();
      vehicle.setInput({
        steer: 0,
        throttle: 1,
        brake: 0,
        boost: false,
        handbrake: false,
        turretAimX: 0,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(0.016, getTerrainHeight);
      expect(vehicle.getPosition().x).toBe(initialPos.x);
    });

    it('should accelerate when throttle is applied', () => {
      vehicle.setInput({
        steer: 0,
        throttle: 1,
        brake: 0,
        boost: false,
        handbrake: false,
        turretAimX: 0,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(0.016, getTerrainHeight);
      expect(vehicle.getSpeed()).toBeGreaterThan(0);
    });

    it('should decelerate when brake is applied', () => {
      vehicle.setInput({
        steer: 0,
        throttle: 1,
        brake: 0,
        boost: false,
        handbrake: false,
        turretAimX: 0,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(0.5, getTerrainHeight);
      const speedBeforeBrake = vehicle.getSpeed();
      vehicle.setInput({
        steer: 0,
        throttle: 0,
        brake: 1,
        boost: false,
        handbrake: false,
        turretAimX: 0,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(0.1, getTerrainHeight);
      expect(vehicle.getSpeed()).toBeLessThan(speedBeforeBrake);
    });

    it('should allow boosting when has fuel', () => {
      vehicle.setInput({
        steer: 0,
        throttle: 1,
        brake: 0,
        boost: true,
        handbrake: false,
        turretAimX: 0,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(0.016, getTerrainHeight);
      expect(vehicle.isBoosting()).toBe(true);
    });

    it('should consume boost fuel when boosting', () => {
      const initialFuel = vehicle.getBoostFuelNormalized();
      vehicle.setInput({
        steer: 0,
        throttle: 1,
        brake: 0,
        boost: true,
        handbrake: false,
        turretAimX: 0,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(1.0, getTerrainHeight);
      expect(vehicle.getBoostFuelNormalized()).toBeLessThan(initialFuel);
    });

    it('should track handbraking state', () => {
      vehicle.setInput({
        steer: 0,
        throttle: 0,
        brake: 0,
        boost: false,
        handbrake: true,
        turretAimX: 0,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(0.016, getTerrainHeight);
      expect(vehicle.getState().isHandbraking).toBe(true);
    });
  });

  describe('Turret System', () => {
    let vehicle: VehicleController;
    const getTerrainHeight = vi.fn(() => 0);

    beforeEach(() => {
      vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
    });

    afterEach(() => {
      vehicle.dispose();
    });

    it('should rotate turret with aim input', () => {
      vehicle.setInput({
        steer: 0,
        throttle: 0,
        brake: 0,
        boost: false,
        handbrake: false,
        turretAimX: 0.5,
        turretAimY: 0,
        fire: false,
        exitRequest: false,
      });
      vehicle.update(0.016, getTerrainHeight);
      const state = vehicle.getState();
      expect(state.turretYaw).not.toBe(0);
    });

    it('should fire turret when fire input and not overheated', () => {
      vehicle.setInput({
        steer: 0,
        throttle: 0,
        brake: 0,
        boost: false,
        handbrake: false,
        turretAimX: 0,
        turretAimY: 0,
        fire: true,
        exitRequest: false,
      });
      vehicle.update(0.016, getTerrainHeight);
      const state = vehicle.getState();
      expect(state.turretHeat).toBeGreaterThan(0);
    });

    it('should track turret ammo', () => {
      expect(vehicle.getTurretAmmo()).toBe(200);
    });

    it('should get turret ammo normalized', () => {
      expect(vehicle.getTurretAmmoNormalized()).toBe(1.0);
    });

    it('should get crosshair world position', () => {
      const crosshair = vehicle.getCrosshairWorldPosition();
      expect(crosshair).toBeDefined();
    });
  });

  describe('Damage System', () => {
    let vehicle: VehicleController;

    beforeEach(() => {
      vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
    });

    afterEach(() => {
      vehicle.dispose();
    });

    it('should apply damage to health', () => {
      const initialHealth = vehicle.getHealth();
      vehicle.applyDamage(20);
      expect(vehicle.getHealth()).toBe(initialHealth - 20);
    });

    it('should not go below 0 health', () => {
      vehicle.applyDamage(500);
      expect(vehicle.getHealth()).toBe(0);
    });

    it('should mark vehicle as dead when health reaches 0', () => {
      vehicle.applyDamage(500);
      expect(vehicle.isDead()).toBe(true);
    });

    it('should return true from applyDamage when destroyed', () => {
      const destroyed = vehicle.applyDamage(500);
      expect(destroyed).toBe(true);
    });

    it('should heal vehicle', () => {
      vehicle.applyDamage(50);
      const healthAfterDamage = vehicle.getHealth();
      vehicle.heal(30);
      expect(vehicle.getHealth()).toBe(healthAfterDamage + 30);
    });

    it('should not heal above max health', () => {
      vehicle.heal(100);
      expect(vehicle.getHealth()).toBe(120);
    });

    it('should return normalized health', () => {
      vehicle.applyDamage(60);
      expect(vehicle.getHealthNormalized()).toBe(0.5);
    });
  });

  describe('Vehicle Exit', () => {
    let vehicle: VehicleController;

    beforeEach(() => {
      vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
    });

    afterEach(() => {
      vehicle.dispose();
    });

    it('should allow exit when stopped', () => {
      expect(vehicle.canExit()).toBe(true);
    });

    it('should not allow exit when moving fast', () => {
      (vehicle as any).state.speed = 30;
      expect(vehicle.canExit()).toBe(false);
    });

    it('should provide exit position', () => {
      const exitPos = vehicle.getExitPosition();
      expect(exitPos).toBeDefined();
    });
  });

  describe('Accessors', () => {
    let vehicle: VehicleController;

    beforeEach(() => {
      vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
    });

    afterEach(() => {
      vehicle.dispose();
    });

    it('should return position clone', () => {
      const pos = vehicle.getPosition();
      expect(pos).toBeDefined();
    });

    it('should return rotation', () => {
      const rot = vehicle.getRotation();
      expect(typeof rot).toBe('number');
    });

    it('should return speed', () => {
      const speed = vehicle.getSpeed();
      expect(typeof speed).toBe('number');
    });

    it('should return speed normalized', () => {
      (vehicle as any).state.speed = 32.5;
      expect(vehicle.getSpeedNormalized()).toBe(0.5);
    });

    it('should return root node', () => {
      const root = vehicle.getRootNode();
      expect(root).toBeDefined();
    });

    it('should return forward direction', () => {
      const forward = vehicle.getForwardDirection();
      expect(forward).toBeDefined();
    });

    it('should return yoke input', () => {
      const yokeInput = vehicle.getYokeInput(0.016);
      expect(yokeInput).toBeDefined();
      expect(yokeInput.deltaTime).toBe(0.016);
    });

    it('should return complete vehicle state', () => {
      const state = vehicle.getState();
      expect(state.position).toBeDefined();
      expect(state.rotation).toBeDefined();
      expect(state.speed).toBeDefined();
      expect(state.health).toBeDefined();
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      const vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
      expect(() => vehicle.dispose()).not.toThrow();
    });
  });

  describe('Ramp Launch', () => {
    let vehicle: VehicleController;

    beforeEach(() => {
      vehicle = new VehicleController(mockScene, mockCamera, spawnPosition);
    });

    afterEach(() => {
      vehicle.dispose();
    });

    it('should set vertical velocity when launching', () => {
      vehicle.launchVertical(15);
      expect((vehicle as any).verticalVelocity).toBe(15);
      expect(vehicle.getState().isGrounded).toBe(false);
    });

    it('should not launch when airborne', () => {
      (vehicle as any).state.isGrounded = false;
      (vehicle as any).state.speed = 60;
      const rampNormal = createMockVector3(0, 0.7, -0.7);
      const launched = vehicle.checkRampLaunch(rampNormal, 20);
      expect(launched).toBe(false);
    });
  });
});
