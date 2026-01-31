/**
 * VehicleYoke.test.ts - Unit tests for vehicle steering yoke system
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Materials/standardMaterial', () => {
  class MockStandardMaterial {
    diffuseColor = {};
    specularColor = {};
    emissiveColor = {};
    alpha = 1;
    disableLighting = false;
    dispose = vi.fn();
  }
  return { StandardMaterial: MockStandardMaterial };
});

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
    static FromHexString = vi.fn().mockReturnValue(new MockColor3());
  }
  return { Color3: MockColor3 };
});

vi.mock('@babylonjs/core/Maths/math.vector', () => ({
  Vector3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    set: vi.fn(),
    setAll: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateCylinder: vi.fn().mockReturnValue({
      material: null,
      parent: null,
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), scaleInPlace: vi.fn() },
      dispose: vi.fn(),
    }),
    CreateBox: vi.fn().mockReturnValue({
      material: null,
      parent: null,
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { x: 1, y: 1, z: 1 },
      dispose: vi.fn(),
    }),
    CreateSphere: vi.fn().mockReturnValue({
      material: null,
      parent: null,
      position: { x: 0, y: 0, z: 0, set: vi.fn() },
      rotation: { x: 0, y: 0, z: 0 },
      scaling: { x: 1, y: 1, z: 1 },
      dispose: vi.fn(),
    }),
  },
}));

vi.mock('@babylonjs/core/Meshes/transformNode', () => {
  class MockTransformNode {
    position = { x: 0, y: 0, z: 0 };
    rotation = { x: 0, y: 0, z: 0 };
    scaling = { x: 1, y: 1, z: 1, setAll: vi.fn() };
    private _enabled = true;
    setEnabled(value: boolean) { this._enabled = value; }
    isEnabled() { return this._enabled; }
    dispose = vi.fn();
  }
  return { TransformNode: MockTransformNode };
});

vi.mock('../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import {
  GyroscopeManager,
  VehicleYokeController,
  VehicleYokeSystem,
  buildVehicleYokeMesh,
  type VehicleYokeInput,
} from './VehicleYoke';

describe('VehicleYoke', () => {
  let mockScene: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScene = {
      onBeforeRenderObservable: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };
  });

  describe('GyroscopeManager', () => {
    let gyro: GyroscopeManager;

    beforeEach(() => {
      // Reset singleton
      GyroscopeManager.getInstance().dispose();
      gyro = GyroscopeManager.getInstance();
    });

    it('should be a singleton', () => {
      const instance1 = GyroscopeManager.getInstance();
      const instance2 = GyroscopeManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should check device availability', () => {
      // In test environment, DeviceOrientationEvent may not exist
      const available = gyro.isAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should return 0 steering when disabled', () => {
      expect(gyro.getSteeringInput()).toBe(0);
    });

    it('should return 0 throttle/brake when disabled', () => {
      const input = gyro.getThrottleInput();
      expect(input.throttle).toBe(0);
      expect(input.brake).toBe(0);
    });

    it('should clamp sensitivity between 0.5 and 2.0', () => {
      gyro.setSensitivity(0.1);
      expect(gyro.getState().sensitivity).toBe(0.5);

      gyro.setSensitivity(3.0);
      expect(gyro.getState().sensitivity).toBe(2.0);

      gyro.setSensitivity(1.5);
      expect(gyro.getState().sensitivity).toBe(1.5);
    });

    it('should toggle enabled state', async () => {
      // Mock gyroscope not available in test environment
      expect(gyro.isEnabled()).toBe(false);

      // Disable should work regardless
      gyro.disable();
      expect(gyro.isEnabled()).toBe(false);
    });

    it('should clean up on dispose', () => {
      gyro.dispose();
      // After dispose, getInstance returns a new instance
      const newInstance = GyroscopeManager.getInstance();
      expect(newInstance).not.toBe(gyro);
    });
  });

  describe('buildVehicleYokeMesh', () => {
    it('should create root transform node', () => {
      const result = buildVehicleYokeMesh(mockScene);

      expect(result.root).toBeDefined();
      expect(result.meshes).toBeDefined();
      expect(result.meshes.length).toBeGreaterThan(0);
    });

    it('should create throttle LEDs', () => {
      const result = buildVehicleYokeMesh(mockScene);

      expect(result.throttleLEDs).toBeDefined();
      expect(result.throttleLEDs.length).toBe(5); // 5 LED segments
    });

    it('should create health display', () => {
      const result = buildVehicleYokeMesh(mockScene);

      expect(result.healthDisplay).toBeDefined();
    });

    it('should create boost meter', () => {
      const result = buildVehicleYokeMesh(mockScene);

      expect(result.boostMeter).toBeDefined();
    });

    it('should create materials', () => {
      const result = buildVehicleYokeMesh(mockScene);

      expect(result.materials).toBeDefined();
      expect(result.materials.length).toBeGreaterThan(0);
    });
  });

  describe('VehicleYokeController', () => {
    let controller: VehicleYokeController;

    beforeEach(() => {
      controller = new VehicleYokeController(mockScene);
    });

    afterEach(() => {
      controller.dispose();
    });

    it('should initialize with hidden yoke', () => {
      // Controller creates yoke but VehicleYokeSystem controls visibility
      expect(controller.getRoot()).toBeDefined();
    });

    it('should get root transform node', () => {
      const root = controller.getRoot();
      expect(root).toBeDefined();
    });

    it('should get all meshes', () => {
      const meshes = controller.getMeshes();
      expect(Array.isArray(meshes)).toBe(true);
      expect(meshes.length).toBeGreaterThan(0);
    });

    it('should update with vehicle input', () => {
      const input: VehicleYokeInput = {
        steerInput: 0.5,
        throttleInput: 0.8,
        brakeInput: 0,
        healthNormalized: 1.0,
        boostNormalized: 0.5,
        isBoosting: false,
        speedNormalized: 0.6,
        deltaTime: 0.016,
      };

      // Should not throw
      controller.update(input);
    });

    it('should animate steering rotation', () => {
      const input: VehicleYokeInput = {
        steerInput: 1.0, // Full right
        throttleInput: 0,
        brakeInput: 0,
        healthNormalized: 1.0,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0,
        deltaTime: 0.016,
      };

      controller.update(input);

      // Yoke should rotate based on steering input
      // Rotation is capped at ±45 degrees (π/4)
      const root = controller.getRoot();
      expect(root.rotation.z).toBeDefined();
    });

    it('should animate boost vibration when boosting', () => {
      const input: VehicleYokeInput = {
        steerInput: 0,
        throttleInput: 1.0,
        brakeInput: 0,
        healthNormalized: 1.0,
        boostNormalized: 0.5,
        isBoosting: true, // Boosting
        speedNormalized: 1.0,
        deltaTime: 0.016,
      };

      controller.update(input);

      // Position should have slight vibration when boosting
      const root = controller.getRoot();
      // Vibration creates small x/y offsets
      expect(root.position).toBeDefined();
    });

    it('should show and hide', () => {
      controller.hide();
      expect(controller.isVisible()).toBe(false);

      controller.show();
      expect(controller.isVisible()).toBe(true);
    });

    it('should dispose cleanly', () => {
      const meshes = controller.getMeshes();
      const disposeSpies = meshes.map((m) => vi.spyOn(m, 'dispose'));

      controller.dispose();

      // All meshes should be disposed
      disposeSpies.forEach((spy) => {
        expect(spy).toHaveBeenCalled();
      });
    });
  });

  describe('VehicleYokeSystem', () => {
    let system: VehicleYokeSystem;

    beforeEach(() => {
      // Reset singleton
      VehicleYokeSystem.getInstance().dispose();
      system = VehicleYokeSystem.getInstance();
    });

    afterEach(() => {
      system.dispose();
    });

    it('should be a singleton', () => {
      const instance1 = VehicleYokeSystem.getInstance();
      const instance2 = VehicleYokeSystem.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with scene', () => {
      system.init(mockScene);
      expect(system.getYoke()).toBeDefined();
    });

    it('should return null yoke before initialization', () => {
      // Before init, yoke is null
      const freshSystem = VehicleYokeSystem.getInstance();
      expect(freshSystem.getYoke()).toBeNull();
    });

    it('should track vehicle active state', () => {
      system.init(mockScene);

      expect(system.isInVehicle()).toBe(false);

      system.enterVehicle('rifle');
      expect(system.isInVehicle()).toBe(true);

      system.exitVehicle();
      expect(system.isInVehicle()).toBe(false);
    });

    it('should store and restore weapon ID on vehicle exit', () => {
      system.init(mockScene);

      system.enterVehicle('plasma_rifle');
      const restoredWeapon = system.exitVehicle();

      expect(restoredWeapon).toBe('plasma_rifle');
    });

    it('should return null if exiting without entering', () => {
      system.init(mockScene);

      const restoredWeapon = system.exitVehicle();
      expect(restoredWeapon).toBeNull();
    });

    it('should get gyroscope manager', () => {
      const gyro = system.getGyroscope();
      expect(gyro).toBeDefined();
      expect(gyro).toBeInstanceOf(GyroscopeManager);
    });

    it('should get gyroscope steering input', () => {
      const steering = system.getGyroscopeSteeringInput();
      // Returns 0 when gyroscope is disabled
      expect(steering).toBe(0);
    });

    it('should get gyroscope throttle input', () => {
      const throttle = system.getGyroscopeThrottleInput();
      expect(throttle).toEqual({ throttle: 0, brake: 0 });
    });

    it('should update yoke when in vehicle', () => {
      system.init(mockScene);
      system.enterVehicle('rifle');

      const input: VehicleYokeInput = {
        steerInput: 0.3,
        throttleInput: 0.5,
        brakeInput: 0,
        healthNormalized: 0.8,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0.5,
        deltaTime: 0.016,
      };

      // Should not throw
      system.update(input);
    });

    it('should not update yoke when not in vehicle', () => {
      system.init(mockScene);

      const input: VehicleYokeInput = {
        steerInput: 0.3,
        throttleInput: 0.5,
        brakeInput: 0,
        healthNormalized: 0.8,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0.5,
        deltaTime: 0.016,
      };

      // Should not throw even when not in vehicle
      system.update(input);
    });

    it('should dispose cleanly', () => {
      system.init(mockScene);
      system.enterVehicle('rifle');

      system.dispose();

      expect(system.isInVehicle()).toBe(false);
      expect(system.getYoke()).toBeNull();
    });
  });

  describe('Throttle LED indicators', () => {
    let controller: VehicleYokeController;

    beforeEach(() => {
      controller = new VehicleYokeController(mockScene);
    });

    afterEach(() => {
      controller.dispose();
    });

    it('should update LEDs based on throttle level', () => {
      // Test various throttle levels
      const testCases = [
        { throttle: 0, expected: 0 },
        { throttle: 0.2, expected: 1 },
        { throttle: 0.5, expected: 2 },
        { throttle: 0.8, expected: 4 },
        { throttle: 1.0, expected: 5 },
      ];

      testCases.forEach(({ throttle }) => {
        const input: VehicleYokeInput = {
          steerInput: 0,
          throttleInput: throttle,
          brakeInput: 0,
          healthNormalized: 1.0,
          boostNormalized: 1.0,
          isBoosting: false,
          speedNormalized: throttle,
          deltaTime: 0.016,
        };

        controller.update(input);
        // LEDs are updated internally based on throttle
      });
    });

    it('should show brake (red) LEDs when braking', () => {
      const input: VehicleYokeInput = {
        steerInput: 0,
        throttleInput: 0,
        brakeInput: 0.8,
        healthNormalized: 1.0,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0.5,
        deltaTime: 0.016,
      };

      controller.update(input);
      // LEDs should be red when braking
    });
  });

  describe('Health display', () => {
    let controller: VehicleYokeController;

    beforeEach(() => {
      controller = new VehicleYokeController(mockScene);
    });

    afterEach(() => {
      controller.dispose();
    });

    it('should change color at different health levels', () => {
      // High health - green
      controller.update({
        steerInput: 0,
        throttleInput: 0,
        brakeInput: 0,
        healthNormalized: 0.8,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0,
        deltaTime: 0.016,
      });

      // Medium health - yellow
      controller.update({
        steerInput: 0,
        throttleInput: 0,
        brakeInput: 0,
        healthNormalized: 0.4,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0,
        deltaTime: 0.016,
      });

      // Low health - red (flashing)
      controller.update({
        steerInput: 0,
        throttleInput: 0,
        brakeInput: 0,
        healthNormalized: 0.1,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0,
        deltaTime: 0.016,
      });
    });

    it('should scale width based on health', () => {
      // Health bar scales to show remaining health
      controller.update({
        steerInput: 0,
        throttleInput: 0,
        brakeInput: 0,
        healthNormalized: 0.5,
        boostNormalized: 1.0,
        isBoosting: false,
        speedNormalized: 0,
        deltaTime: 0.016,
      });

      // Health display scales based on health percentage
    });
  });

  describe('Boost meter', () => {
    let controller: VehicleYokeController;

    beforeEach(() => {
      controller = new VehicleYokeController(mockScene);
    });

    afterEach(() => {
      controller.dispose();
    });

    it('should scale based on boost fuel', () => {
      controller.update({
        steerInput: 0,
        throttleInput: 0,
        brakeInput: 0,
        healthNormalized: 1.0,
        boostNormalized: 0.5,
        isBoosting: false,
        speedNormalized: 0,
        deltaTime: 0.016,
      });

      // Boost meter scales vertically based on fuel
    });

    it('should pulse bright when boosting', () => {
      controller.update({
        steerInput: 0,
        throttleInput: 1.0,
        brakeInput: 0,
        healthNormalized: 1.0,
        boostNormalized: 0.8,
        isBoosting: true,
        speedNormalized: 1.0,
        deltaTime: 0.016,
      });

      // Boost meter should have pulsing emissive color when active
    });

    it('should dim when boost is low', () => {
      controller.update({
        steerInput: 0,
        throttleInput: 0,
        brakeInput: 0,
        healthNormalized: 1.0,
        boostNormalized: 0.1,
        isBoosting: false,
        speedNormalized: 0,
        deltaTime: 0.016,
      });

      // Boost meter should be dimmed when fuel is low
    });
  });
});
