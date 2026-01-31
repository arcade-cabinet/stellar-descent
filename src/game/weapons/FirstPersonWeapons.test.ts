import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@babylonjs/loaders/glTF', () => ({}));
vi.mock('@babylonjs/core/Loading/sceneLoader', () => ({
  SceneLoader: { ImportMeshAsync: vi.fn().mockResolvedValue({ meshes: [] }) },
}));
vi.mock('@babylonjs/core/Layers/glowLayer', () => {
  class MockGlowLayer {
    intensity = 0.6;
    customEmissiveColorSelector = null;
    dispose = vi.fn();
  }
  return { GlowLayer: MockGlowLayer };
});
vi.mock('@babylonjs/core/Meshes/transformNode', () => {
  class MockTransformNode {
    name: string;
    parent = null;
    position = { x: 0, y: 0, z: 0, copyFrom: vi.fn(), set: vi.fn(), addInPlace: vi.fn() };
    rotation = { x: 0, y: 0, z: 0, copyFrom: vi.fn(), set: vi.fn() };
    scaling = { x: 1, y: 1, z: 1, copyFrom: vi.fn(), setAll: vi.fn() };
    setEnabled = vi.fn();
    dispose = vi.fn();
    getChildMeshes = vi.fn().mockReturnValue([]);
    getWorldMatrix = vi.fn().mockReturnValue({});
    constructor(name: string) {
      this.name = name;
    }
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
vi.mock('../context/useWeaponActions', () => ({
  getWeaponActions: vi.fn().mockReturnValue({
    getState: vi.fn().mockReturnValue({}),
  }),
}));
vi.mock('./WeaponAnimations', () => {
  class MockWeaponAnimationController {
    update = vi.fn();
    output = {
      adsBlend: 0,
      positionOffset: { x: 0, y: 0, z: 0 },
      rotationOffset: { x: 0, y: 0, z: 0 },
    };
    triggerFire = vi.fn();
    triggerReload = vi.fn();
    cancelReload = vi.fn();
    triggerSwitch = vi.fn((callback: () => void) => callback());
    setADS = vi.fn();
    setWeapon = vi.fn();
    triggerMeleeLunge = vi.fn();
    isMeleeLungePlaying = false;
    isSwitching = false;
    dispose = vi.fn();
  }
  return { WeaponAnimationController: MockWeaponAnimationController };
});
vi.mock('./WeaponRecoilSystem', () => ({
  WeaponRecoilSystem: { getInstance: vi.fn().mockReturnValue({
    init: vi.fn(),
    setWeapon: vi.fn(),
    update: vi.fn().mockReturnValue({ chromaticIntensity: 0 }),
    triggerFire: vi.fn(),
    setADSBlend: vi.fn(),
    shakeOffset: { x: 0, y: 0, z: 0 },
    dispose: vi.fn(),
  }) },
}));
vi.mock('../effects/MuzzleFlash', () => ({
  MuzzleFlashManager: { getInstance: vi.fn().mockReturnValue({ emit: vi.fn() }) },
  createMuzzleFlashConfigFromWeapon: vi.fn().mockReturnValue({}),
}));
vi.mock('../effects/ShellCasings', () => ({
  shellCasings: { init: vi.fn(), eject: vi.fn(), dispose: vi.fn() },
  categoryToCasingType: vi.fn().mockReturnValue('rifle'),
}));
vi.mock('../effects/WeaponEffects', () => ({
  WeaponEffects: { getInstance: vi.fn().mockReturnValue({ emitMuzzleFlash: vi.fn() }) },
}));
vi.mock('../core/PostProcessManager', () => ({
  getPostProcessManager: vi.fn().mockReturnValue({ triggerHitConfirmation: vi.fn() }),
}));
vi.mock('../core/WeaponSoundManager', () => ({
  weaponSoundManager: { playImpact: vi.fn() },
}));
vi.mock('./VehicleYoke', () => ({
  VehicleYokeSystem: { getInstance: vi.fn().mockReturnValue({
    init: vi.fn(),
    getYoke: vi.fn().mockReturnValue({
      getRoot: vi.fn().mockReturnValue({ parent: null }),
      getMeshes: vi.fn().mockReturnValue([]),
      show: vi.fn(),
      hide: vi.fn(),
    }),
    update: vi.fn(),
    dispose: vi.fn(),
  }) },
}));

let FirstPersonWeaponSystem: any;

describe('FirstPersonWeaponSystem', () => {
  let system: any;
  let mockScene: any;
  let mockCamera: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./FirstPersonWeapons');
    FirstPersonWeaponSystem = mod.FirstPersonWeaponSystem;
    (FirstPersonWeaponSystem as any).instance = null;

    mockScene = {
      onBeforeRenderObservable: { add: vi.fn().mockReturnValue({}), remove: vi.fn() },
      getEngine: vi.fn().mockReturnValue({ getDeltaTime: vi.fn().mockReturnValue(16) }),
    };
    mockCamera = {
      position: { x: 0, y: 0, z: 0, clone: vi.fn().mockReturnThis(), subtract: vi.fn().mockReturnValue({ scale: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }) }) },
      getForwardRay: vi.fn().mockReturnValue({ direction: { normalize: vi.fn().mockReturnThis() } }),
      getDirection: vi.fn().mockReturnValue({ normalize: vi.fn().mockReturnThis(), add: vi.fn().mockReturnThis(), scale: vi.fn().mockReturnThis() }),
    };
    system = FirstPersonWeaponSystem.getInstance();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = FirstPersonWeaponSystem.getInstance();
      const instance2 = FirstPersonWeaponSystem.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Weapon switching', () => {
    it('should initialize with weapons', async () => {
      await system.init(mockScene, mockCamera, ['sidearm', 'assault_rifle']);
      expect(system.hasWeapon('assault_rifle')).toBe(true);
      expect(system.hasWeapon('sidearm')).toBe(true);
    });
  });

  describe('Vehicle mode', () => {
    it('should enter vehicle mode', async () => {
      await system.init(mockScene, mockCamera, ['assault_rifle']);
      system.enterVehicleMode();
      expect(system.inVehicleMode).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should report initialized status', async () => {
      expect(system.isInitialized).toBe(false);
      await system.init(mockScene, mockCamera, ['assault_rifle']);
      expect(system.isInitialized).toBe(true);
    });
  });
});
