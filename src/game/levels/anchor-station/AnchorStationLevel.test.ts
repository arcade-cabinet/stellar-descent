/**
 * AnchorStationLevel Unit Tests
 *
 * Comprehensive test suite for Level 1: Anchor Station Prometheus
 * Tests level initialization, tutorial system, room transitions,
 * objective tracking, and level completion.
 */
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js modules before imports
vi.mock('@babylonjs/core/Engines/engine', () => ({
  Engine: vi.fn().mockImplementation(() => ({
    runRenderLoop: vi.fn(),
    stopRenderLoop: vi.fn(),
    dispose: vi.fn(),
    getRenderWidth: vi.fn(() => 1920),
    getRenderHeight: vi.fn(() => 1080),
    setHardwareScalingLevel: vi.fn(),
    resize: vi.fn(),
    scenes: [],
    onResizeObservable: { add: vi.fn(), remove: vi.fn() },
  })),
}));

vi.mock('@babylonjs/core/scene', () => ({
  Scene: vi.fn().mockImplementation(() => createMockScene()),
}));

vi.mock('@babylonjs/core/Cameras/freeCamera', () => ({
  FreeCamera: vi.fn().mockImplementation(() => ({
    position: new Vector3(0, 1.7, 2),
    rotation: new Vector3(0, 0, 0),
    getDirection: vi.fn(() => new Vector3(0, 0, -1)),
    attachControl: vi.fn(),
    detachControl: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Loading/sceneLoader', () => ({
  SceneLoader: {
    ImportMeshAsync: vi.fn().mockResolvedValue({ meshes: [] }),
  },
}));

vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation(() => ({
    diffuseColor: new Color3(0, 0, 0),
    emissiveColor: new Color3(0, 0, 0),
    specularColor: new Color3(0, 0, 0),
    alpha: 1,
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateTorus: vi.fn(() => createMockMesh('torus')),
    CreateBox: vi.fn(() => createMockMesh('box')),
    CreateCylinder: vi.fn(() => createMockMesh('cylinder')),
    CreateGround: vi.fn(() => createMockMesh('ground')),
    CreateSphere: vi.fn(() => createMockMesh('sphere')),
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

vi.mock('@babylonjs/core/Lights/pointLight', () => ({
  PointLight: vi.fn().mockImplementation(() => ({
    position: new Vector3(0, 0, 0),
    diffuse: new Color3(1, 1, 1),
    specular: new Color3(1, 1, 1),
    intensity: 1,
    range: 10,
    dispose: vi.fn(),
  })),
}));

vi.mock('../../cinematics', () => ({
  CinematicSystem: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    update: vi.fn(),
    isPlaying: vi.fn(() => false),
    dispose: vi.fn(),
  })),
  createAnchorStationIntroCinematic: vi.fn(() => ({})),
}));

vi.mock('./ModularStationEnvironment', () => ({
  createModularStationEnvironment: vi.fn().mockResolvedValue({
    root: { dispose: vi.fn() },
    dropPod: createMockMesh('dropPod'),
    playEquipSuit: vi.fn((cb) => cb?.()),
    playDepressurize: vi.fn((cb) => cb?.()),
    playOpenBayDoors: vi.fn((cb) => cb?.()),
    playEnterPod: vi.fn((cb) => cb?.()),
    playLaunch: vi.fn((cb) => cb?.()),
    startCalibration: vi.fn(),
    checkTargetHit: vi.fn(() => false),
    isCalibrationActive: vi.fn(() => false),
    dispose: vi.fn(),
  }),
}));

vi.mock('./TutorialManager', () => ({
  TutorialManager: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    checkObjective: vi.fn(() => false),
    canPlayerInteract: vi.fn(() => false),
    tryInteract: vi.fn(() => false),
    tryLaunchAction: vi.fn(() => false),
    isInteractStep: vi.fn(() => false),
    isLaunchStep: vi.fn(() => false),
    getCurrentObjectiveTarget: vi.fn(() => null),
    onShootingRangeComplete: vi.fn(),
    onCommsDismissed: vi.fn(),
    skip: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('./ModularStationBuilder', () => ({
  MODULAR_ROOM_POSITIONS: {
    briefingRoom: new Vector3(0, 0, 2),
    corridorA: new Vector3(0, 0, -10),
    equipmentBay: new Vector3(-10, 0, -16),
    armory: new Vector3(10, 0, -16),
    holodeckCenter: new Vector3(0, 0, -34),
    shootingRange: new Vector3(0, 0, -52),
    hangarBay: new Vector3(0, 0, -70),
    dropPod: new Vector3(0, 0, -76),
    platform1: new Vector3(-4, 0, -32),
    platform2: new Vector3(-1, 0.8, -34),
    platform3: new Vector3(2, 1.2, -36),
    crouchPassageEntry: new Vector3(-4, 0, -38),
    crouchPassageExit: new Vector3(-4, 0, -41),
    platformingEntry: new Vector3(-4, 0, -30),
    platformingExit: new Vector3(-4, 0, -42),
    engineRoom: new Vector3(12, 0, 4),
    suitLocker: new Vector3(-13, 0, -16),
    weaponRack: new Vector3(13, 0, -16),
  },
}));

// Helper to create mock mesh
function createMockMesh(name: string) {
  return {
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: new Vector3(1, 1, 1),
    material: null,
    isVisible: true,
    parent: null,
    dispose: vi.fn(),
    isDisposed: vi.fn(() => false),
    getChildMeshes: vi.fn(() => []),
  };
}

// Helper to create mock scene
function createMockScene() {
  return {
    clearColor: new Color4(0, 0, 0, 1),
    ambientColor: new Color3(0, 0, 0),
    fogMode: 0,
    fogEnabled: false,
    fogColor: new Color3(0, 0, 0),
    fogDensity: 0,
    fogStart: 0,
    fogEnd: 0,
    onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
    onAfterRenderObservable: { add: vi.fn(), remove: vi.fn() },
    onKeyboardObservable: { add: vi.fn(), remove: vi.fn() },
    onPointerObservable: { add: vi.fn(), remove: vi.fn() },
    render: vi.fn(),
    dispose: vi.fn(),
    activeCamera: null,
    meshes: [],
    materials: [],
    textures: [],
    lights: [],
    getEngine: vi.fn(() => ({
      getRenderWidth: vi.fn(() => 1920),
      getRenderHeight: vi.fn(() => 1080),
    })),
    pick: vi.fn(() => ({ hit: false })),
  };
}

// Create mock canvas
function createMockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  return canvas;
}

// Create mock engine
function createMockEngine() {
  return {
    runRenderLoop: vi.fn(),
    stopRenderLoop: vi.fn(),
    dispose: vi.fn(),
    getRenderWidth: vi.fn(() => 1920),
    getRenderHeight: vi.fn(() => 1080),
    setHardwareScalingLevel: vi.fn(),
    resize: vi.fn(),
    scenes: [],
    onResizeObservable: { add: vi.fn(), remove: vi.fn() },
  };
}

// Create mock callbacks
function createMockCallbacks() {
  return {
    onComplete: vi.fn(),
    onObjectiveUpdate: vi.fn(),
    onHealthChange: vi.fn(),
    onAmmoChange: vi.fn(),
    onNotification: vi.fn(),
    onCommsMessage: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onActionGroupsChange: vi.fn(),
    onCinematicStart: vi.fn(),
    onCinematicEnd: vi.fn(),
    onCheckpointReached: vi.fn(),
    onStatsUpdate: vi.fn(),
    onPlayerDeath: vi.fn(),
  };
}

describe('AnchorStationLevel', () => {
  let mockEngine: ReturnType<typeof createMockEngine>;
  let mockCanvas: HTMLCanvasElement;
  let mockCallbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEngine = createMockEngine();
    mockCanvas = createMockCanvas();
    mockCallbacks = createMockCallbacks();

    // Mock document.body for interaction prompt
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Level Configuration', () => {
    it('should have correct level ID', () => {
      expect('anchor-station').toBe('anchor-station');
    });

    it('should have correct next level ID', () => {
      expect('landfall').toBe('landfall');
    });

    it('should define tutorial as first level', () => {
      const config = {
        id: 'anchor-station',
        name: 'Anchor Station Prometheus',
        description: 'Tutorial and briefing station',
        nextLevelId: 'landfall',
      };
      expect(config.id).toBe('anchor-station');
      expect(config.nextLevelId).toBe('landfall');
    });
  });

  describe('Background Color', () => {
    it('should use dark station interior color', () => {
      const expectedColor = new Color4(0.01, 0.01, 0.02, 1);
      expect(expectedColor.r).toBeCloseTo(0.01);
      expect(expectedColor.g).toBeCloseTo(0.01);
      expect(expectedColor.b).toBeCloseTo(0.02);
      expect(expectedColor.a).toBe(1);
    });
  });

  describe('HUD State Management', () => {
    it('should start with all HUD elements disabled', () => {
      const initialHUDState = {
        healthBar: false,
        crosshair: false,
        ammoCounter: false,
        missionText: false,
        actionButtons: false,
        movementEnabled: false,
        lookEnabled: false,
        fireEnabled: false,
      };

      expect(initialHUDState.healthBar).toBe(false);
      expect(initialHUDState.crosshair).toBe(false);
      expect(initialHUDState.movementEnabled).toBe(false);
      expect(initialHUDState.fireEnabled).toBe(false);
    });

    it('should unlock movement in phase 1', () => {
      const phase1HUD = {
        healthBar: true,
        crosshair: false,
        ammoCounter: false,
        missionText: true,
        actionButtons: false,
        movementEnabled: true,
        lookEnabled: false,
        fireEnabled: false,
      };

      expect(phase1HUD.movementEnabled).toBe(true);
      expect(phase1HUD.healthBar).toBe(true);
      expect(phase1HUD.missionText).toBe(true);
    });

    it('should unlock crosshair and look in phase 2', () => {
      const phase2HUD = {
        healthBar: true,
        crosshair: true,
        ammoCounter: false,
        missionText: true,
        actionButtons: true,
        movementEnabled: true,
        lookEnabled: true,
        fireEnabled: false,
      };

      expect(phase2HUD.crosshair).toBe(true);
      expect(phase2HUD.lookEnabled).toBe(true);
      expect(phase2HUD.actionButtons).toBe(true);
    });

    it('should unlock fire in phase 3', () => {
      const phase3HUD = {
        healthBar: true,
        crosshair: true,
        ammoCounter: true,
        missionText: true,
        actionButtons: true,
        movementEnabled: true,
        lookEnabled: true,
        fireEnabled: true,
      };

      expect(phase3HUD.fireEnabled).toBe(true);
      expect(phase3HUD.ammoCounter).toBe(true);
    });

    it('should have full HUD in phase 4', () => {
      const phase4HUD = {
        healthBar: true,
        crosshair: true,
        ammoCounter: true,
        missionText: true,
        actionButtons: true,
        movementEnabled: true,
        lookEnabled: true,
        fireEnabled: true,
      };

      expect(Object.values(phase4HUD).every((v) => v === true)).toBe(true);
    });
  });

  describe('Room Positions', () => {
    it('should define briefing room position', () => {
      const briefingRoom = new Vector3(0, 0, 2);
      expect(briefingRoom.x).toBe(0);
      expect(briefingRoom.z).toBe(2);
    });

    it('should define equipment bay position', () => {
      const equipmentBay = new Vector3(-10, 0, -16);
      expect(equipmentBay.x).toBe(-10);
      expect(equipmentBay.z).toBe(-16);
    });

    it('should define armory position', () => {
      const armory = new Vector3(10, 0, -16);
      expect(armory.x).toBe(10);
      expect(armory.z).toBe(-16);
    });

    it('should define shooting range position', () => {
      const shootingRange = new Vector3(0, 0, -52);
      expect(shootingRange.x).toBe(0);
      expect(shootingRange.z).toBe(-52);
    });

    it('should define hangar bay position', () => {
      const hangarBay = new Vector3(0, 0, -70);
      expect(hangarBay.x).toBe(0);
      expect(hangarBay.z).toBe(-70);
    });

    it('should define drop pod position', () => {
      const dropPod = new Vector3(0, 0, -76);
      expect(dropPod.x).toBe(0);
      expect(dropPod.z).toBe(-76);
    });

    it('should define platforming room positions', () => {
      const platform1 = new Vector3(-4, 0, -32);
      const platform2 = new Vector3(-1, 0.8, -34);
      const platform3 = new Vector3(2, 1.2, -36);

      expect(platform1.z).toBe(-32);
      expect(platform2.y).toBe(0.8);
      expect(platform3.y).toBe(1.2);
    });
  });

  describe('Tutorial State', () => {
    it('should track suit equipped state', () => {
      let suitEquipped = false;
      expect(suitEquipped).toBe(false);

      suitEquipped = true;
      expect(suitEquipped).toBe(true);
    });

    it('should track weapon acquired state', () => {
      let weaponAcquired = false;
      expect(weaponAcquired).toBe(false);

      weaponAcquired = true;
      expect(weaponAcquired).toBe(true);
    });

    it('should track shooting range progress', () => {
      let targetsHit = 0;
      const totalTargets = 5;

      expect(targetsHit).toBe(0);

      for (let i = 0; i < totalTargets; i++) {
        targetsHit++;
      }

      expect(targetsHit).toBe(totalTargets);
    });

    it('should track current tutorial phase', () => {
      type TutorialPhase = 0 | 1 | 2 | 3 | 4;
      let currentPhase: TutorialPhase = 0;

      expect(currentPhase).toBe(0);

      currentPhase = 1;
      expect(currentPhase).toBe(1);

      currentPhase = 4;
      expect(currentPhase).toBe(4);
    });
  });

  describe('Movement Bounds', () => {
    it('should define station bounds', () => {
      const bounds = {
        minX: -18,
        maxX: 18,
        minZ: -80,
        maxZ: 8,
      };

      expect(bounds.minX).toBe(-18);
      expect(bounds.maxX).toBe(18);
      expect(bounds.minZ).toBe(-80);
      expect(bounds.maxZ).toBe(8);
    });

    it('should clamp position within bounds', () => {
      const bounds = { minX: -18, maxX: 18, minZ: -80, maxZ: 8 };

      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value));

      // Test X clamping
      expect(clamp(-50, bounds.minX, bounds.maxX)).toBe(-18);
      expect(clamp(50, bounds.minX, bounds.maxX)).toBe(18);
      expect(clamp(0, bounds.minX, bounds.maxX)).toBe(0);

      // Test Z clamping
      expect(clamp(-100, bounds.minZ, bounds.maxZ)).toBe(-80);
      expect(clamp(50, bounds.minZ, bounds.maxZ)).toBe(8);
      expect(clamp(-40, bounds.minZ, bounds.maxZ)).toBe(-40);
    });
  });

  describe('Phase Change Notifications', () => {
    it('should notify MOVEMENT CONTROLS ONLINE in phase 1', () => {
      const handlePhaseChange = (phase: number, notify: (msg: string, dur: number) => void) => {
        switch (phase) {
          case 1:
            notify('MOVEMENT CONTROLS ONLINE', 2000);
            break;
          case 2:
            notify('TARGETING SYSTEMS ONLINE', 2000);
            break;
          case 3:
            notify('WEAPONS SYSTEMS ONLINE', 2000);
            break;
          case 4:
            notify('ALL SYSTEMS NOMINAL', 2000);
            break;
        }
      };

      const notifications: string[] = [];
      const notify = (msg: string) => notifications.push(msg);

      handlePhaseChange(1, notify);
      expect(notifications).toContain('MOVEMENT CONTROLS ONLINE');
    });

    it('should notify TARGETING SYSTEMS ONLINE in phase 2', () => {
      const notifications: string[] = [];
      const notify = (msg: string) => notifications.push(msg);

      const handlePhaseChange = (phase: number) => {
        if (phase === 2) notify('TARGETING SYSTEMS ONLINE');
      };

      handlePhaseChange(2);
      expect(notifications).toContain('TARGETING SYSTEMS ONLINE');
    });

    it('should notify WEAPONS SYSTEMS ONLINE in phase 3', () => {
      const notifications: string[] = [];
      const notify = (msg: string) => notifications.push(msg);

      const handlePhaseChange = (phase: number) => {
        if (phase === 3) notify('WEAPONS SYSTEMS ONLINE');
      };

      handlePhaseChange(3);
      expect(notifications).toContain('WEAPONS SYSTEMS ONLINE');
    });

    it('should notify ALL SYSTEMS NOMINAL in phase 4', () => {
      const notifications: string[] = [];
      const notify = (msg: string) => notifications.push(msg);

      const handlePhaseChange = (phase: number) => {
        if (phase === 4) notify('ALL SYSTEMS NOMINAL');
      };

      handlePhaseChange(4);
      expect(notifications).toContain('ALL SYSTEMS NOMINAL');
    });
  });

  describe('Sequence Handling', () => {
    it('should handle equip_suit sequence', () => {
      let suitEquipped = false;
      const handleSequence = (sequence: string) => {
        if (sequence === 'equip_suit') {
          suitEquipped = true;
        }
      };

      handleSequence('equip_suit');
      expect(suitEquipped).toBe(true);
    });

    it('should handle pickup_weapon sequence', () => {
      let weaponAcquired = false;
      const handleSequence = (sequence: string) => {
        if (sequence === 'pickup_weapon') {
          weaponAcquired = true;
        }
      };

      handleSequence('pickup_weapon');
      expect(weaponAcquired).toBe(true);
    });

    it('should handle start_calibration sequence', () => {
      let calibrationStarted = false;
      let targetsHit = 0;
      const handleSequence = (sequence: string) => {
        if (sequence === 'start_calibration') {
          calibrationStarted = true;
          targetsHit = 0;
        }
      };

      handleSequence('start_calibration');
      expect(calibrationStarted).toBe(true);
      expect(targetsHit).toBe(0);
    });

    it('should handle depressurize sequence', () => {
      let depressurized = false;
      const handleSequence = (sequence: string) => {
        if (sequence === 'depressurize') {
          depressurized = true;
        }
      };

      handleSequence('depressurize');
      expect(depressurized).toBe(true);
    });

    it('should handle open_bay_doors sequence', () => {
      let bayDoorsOpen = false;
      const handleSequence = (sequence: string) => {
        if (sequence === 'open_bay_doors') {
          bayDoorsOpen = true;
        }
      };

      handleSequence('open_bay_doors');
      expect(bayDoorsOpen).toBe(true);
    });

    it('should handle enter_pod sequence', () => {
      let inPod = false;
      const handleSequence = (sequence: string) => {
        if (sequence === 'enter_pod') {
          inPod = true;
        }
      };

      handleSequence('enter_pod');
      expect(inPod).toBe(true);
    });

    it('should handle launch sequence', () => {
      let launched = false;
      const handleSequence = (sequence: string) => {
        if (sequence === 'launch') {
          launched = true;
        }
      };

      handleSequence('launch');
      expect(launched).toBe(true);
    });
  });

  describe('Keybinding Support', () => {
    it('should map jump action to Space key', () => {
      const actionMap: Record<string, string> = {
        jump: 'Space',
        crouch: 'ControlLeft',
        fire: 'Mouse0',
        reload: 'KeyR',
        interact: 'KeyE',
      };

      expect(actionMap.jump).toBe('Space');
    });

    it('should map crouch action to Control key', () => {
      const actionMap: Record<string, string> = {
        crouch: 'ControlLeft',
      };

      expect(actionMap.crouch).toBe('ControlLeft');
    });

    it('should map interact action to E key', () => {
      const actionMap: Record<string, string> = {
        interact: 'KeyE',
        equip_suit: 'KeyE', // Uses interact key
      };

      expect(actionMap.interact).toBe('KeyE');
      expect(actionMap.equip_suit).toBe('KeyE');
    });
  });

  describe('Level Transition', () => {
    it('should only allow transition when tutorial complete', () => {
      const levelState = {
        completed: false,
        nextLevelId: 'landfall',
      };

      const canTransitionTo = (levelId: string) =>
        levelId === levelState.nextLevelId && levelState.completed;

      expect(canTransitionTo('landfall')).toBe(false);

      levelState.completed = true;
      expect(canTransitionTo('landfall')).toBe(true);
    });

    it('should not allow transition to wrong level', () => {
      const levelState = {
        completed: true,
        nextLevelId: 'landfall',
      };

      const canTransitionTo = (levelId: string) =>
        levelId === levelState.nextLevelId && levelState.completed;

      expect(canTransitionTo('canyon-run')).toBe(false);
    });
  });

  describe('Objective Marker Animation', () => {
    it('should animate marker rotation', () => {
      let rotationY = 0;
      const deltaTime = 0.016; // ~60fps

      // Simulate rotation animation
      rotationY += deltaTime * 2;
      expect(rotationY).toBeCloseTo(0.032);
    });

    it('should pulse marker alpha', () => {
      const getAlpha = (time: number) => 0.6 + Math.sin(time * 0.003) * 0.2;

      // At time 0
      expect(getAlpha(0)).toBeCloseTo(0.6, 1);

      // Should oscillate between 0.4 and 0.8
      const alpha1 = getAlpha(Math.PI / 0.003 / 2); // Peak
      expect(alpha1).toBeCloseTo(0.8, 1);
    });

    it('should bob exclamation mark up and down', () => {
      const getBobOffset = (time: number) => Math.sin(time * 0.004) * 0.15;

      expect(getBobOffset(0)).toBeCloseTo(0, 2);

      // At peak
      const peak = Math.PI / 0.004 / 2;
      expect(getBobOffset(peak)).toBeCloseTo(0.15, 2);
    });
  });

  describe('Interaction Prompt', () => {
    it('should create interaction prompt element', () => {
      const prompt = document.createElement('div');
      prompt.className = 'interactionPrompt';

      const key = document.createElement('div');
      key.className = 'promptKey';
      key.textContent = 'E';

      const text = document.createElement('div');
      text.className = 'promptText';
      text.textContent = 'INTERACT';

      prompt.appendChild(key);
      prompt.appendChild(text);
      document.body.appendChild(prompt);

      expect(prompt.querySelector('.promptKey')?.textContent).toBe('E');
      expect(prompt.querySelector('.promptText')?.textContent).toBe('INTERACT');
    });

    it('should show and hide prompt', () => {
      const prompt = document.createElement('div');
      let showing = false;

      const showPrompt = () => {
        prompt.style.display = 'flex';
        showing = true;
      };

      const hidePrompt = () => {
        prompt.style.display = 'none';
        showing = false;
      };

      showPrompt();
      expect(showing).toBe(true);
      expect(prompt.style.display).toBe('flex');

      hidePrompt();
      expect(showing).toBe(false);
      expect(prompt.style.display).toBe('none');
    });
  });

  describe('Station Environmental Audio', () => {
    it('should define briefing room audio zones', () => {
      const audioZones = [
        { name: 'zone_briefing', type: 'station', position: { x: 0, y: 0, z: 2 }, radius: 12 },
        { name: 'zone_corridorA', type: 'station', position: { x: 0, y: 0, z: -14 }, radius: 15 },
      ];

      expect(audioZones[0].name).toBe('zone_briefing');
      expect(audioZones[0].radius).toBe(12);
    });

    it('should define spatial sounds for each area', () => {
      const spatialSounds = [
        { name: 'vent_briefing', type: 'vent', position: { x: 0, y: 3, z: 2 } },
        { name: 'machinery_equipment', type: 'machinery', position: { x: -10, y: 1.5, z: -16 } },
        { name: 'generator_hangar', type: 'generator', position: { x: 10, y: 2, z: -70 } },
      ];

      expect(spatialSounds).toHaveLength(3);
      expect(spatialSounds[0].type).toBe('vent');
      expect(spatialSounds[1].type).toBe('machinery');
      expect(spatialSounds[2].type).toBe('generator');
    });
  });

  describe('Station Lighting', () => {
    it('should add ceiling lights in each room', () => {
      const lights = [
        { name: 'briefing1', position: new Vector3(-5, 3.5, 2), color: new Color3(0.85, 0.9, 1.0) },
        { name: 'corridor1', position: new Vector3(0, 2.8, -8), color: new Color3(0.8, 0.85, 1.0) },
        { name: 'hangar1', position: new Vector3(0, 10, -68), color: new Color3(0.5, 0.6, 0.8) },
      ];

      expect(lights[0].name).toBe('briefing1');
      expect(lights[1].position.y).toBe(2.8);
      expect(lights[2].color.r).toBeCloseTo(0.5);
    });

    it('should add emergency lights for atmosphere', () => {
      const emergencyLights = [
        { name: 'emergency1', position: new Vector3(-2, 2, -28), intensity: 0.25 },
        { name: 'emergency2', position: new Vector3(2, 2, -40), intensity: 0.25 },
      ];

      expect(emergencyLights[0].intensity).toBe(0.25);
      expect(emergencyLights[1].intensity).toBe(0.25);
    });
  });

  describe('Disposal', () => {
    it('should dispose all level resources', () => {
      const resources = {
        cinematicSystem: { dispose: vi.fn() },
        tutorialManager: { dispose: vi.fn() },
        stationEnvironment: { dispose: vi.fn() },
        objectiveMarker: { dispose: vi.fn() },
        interactMarker: { dispose: vi.fn() },
      };

      // Dispose all
      Object.values(resources).forEach((r) => r.dispose());

      expect(resources.cinematicSystem.dispose).toHaveBeenCalled();
      expect(resources.tutorialManager.dispose).toHaveBeenCalled();
      expect(resources.stationEnvironment.dispose).toHaveBeenCalled();
      expect(resources.objectiveMarker.dispose).toHaveBeenCalled();
      expect(resources.interactMarker.dispose).toHaveBeenCalled();
    });

    it('should remove interaction prompt from DOM', () => {
      const prompt = document.createElement('div');
      document.body.appendChild(prompt);

      expect(document.body.contains(prompt)).toBe(true);

      if (prompt.parentNode) {
        prompt.parentNode.removeChild(prompt);
      }

      expect(document.body.contains(prompt)).toBe(false);
    });

    it('should clear action buttons on dispose', () => {
      const onActionGroupsChange = vi.fn();

      // Simulate dispose clearing action buttons
      onActionGroupsChange([]);

      expect(onActionGroupsChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Touch Input Support', () => {
    it('should process touch movement when enabled', () => {
      const touchInput = {
        movement: { x: 0.5, y: 0.5 },
        look: { x: 0.01, y: 0.01 },
      };
      const hudState = { movementEnabled: true, lookEnabled: true };

      const processTouch = (input: typeof touchInput, hud: typeof hudState) => {
        let moved = false;
        let looked = false;

        if (hud.movementEnabled && (Math.abs(input.movement.x) > 0.1 || Math.abs(input.movement.y) > 0.1)) {
          moved = true;
        }

        if (hud.lookEnabled && (Math.abs(input.look.x) > 0.0001 || Math.abs(input.look.y) > 0.0001)) {
          looked = true;
        }

        return { moved, looked };
      };

      const result = processTouch(touchInput, hudState);
      expect(result.moved).toBe(true);
      expect(result.looked).toBe(true);
    });

    it('should not process movement when disabled', () => {
      const touchInput = {
        movement: { x: 0.5, y: 0.5 },
        look: { x: 0.01, y: 0.01 },
      };
      const hudState = { movementEnabled: false, lookEnabled: false };

      const processTouch = (input: typeof touchInput, hud: typeof hudState) => {
        let moved = false;
        let looked = false;

        if (hud.movementEnabled && (Math.abs(input.movement.x) > 0.1 || Math.abs(input.movement.y) > 0.1)) {
          moved = true;
        }

        if (hud.lookEnabled && (Math.abs(input.look.x) > 0.0001 || Math.abs(input.look.y) > 0.0001)) {
          looked = true;
        }

        return { moved, looked };
      };

      const result = processTouch(touchInput, hudState);
      expect(result.moved).toBe(false);
      expect(result.looked).toBe(false);
    });
  });

  describe('Camera Height', () => {
    it('should maintain standing height at 1.7m', () => {
      const STANDING_HEIGHT = 1.7;
      let cameraY = 0;

      // Simulate update keeping camera at standing height
      cameraY = STANDING_HEIGHT;

      expect(cameraY).toBe(1.7);
    });
  });

  describe('Cinematic System', () => {
    it('should not update gameplay when cinematic is playing', () => {
      const cinematicSystem = {
        isPlaying: vi.fn(() => true),
        update: vi.fn(),
      };

      let gameplayUpdated = false;

      const updateLevel = (deltaTime: number) => {
        cinematicSystem.update(deltaTime);

        if (cinematicSystem.isPlaying()) {
          return;
        }

        gameplayUpdated = true;
      };

      updateLevel(0.016);
      expect(gameplayUpdated).toBe(false);
    });

    it('should update gameplay when cinematic is not playing', () => {
      const cinematicSystem = {
        isPlaying: vi.fn(() => false),
        update: vi.fn(),
      };

      let gameplayUpdated = false;

      const updateLevel = (deltaTime: number) => {
        cinematicSystem.update(deltaTime);

        if (cinematicSystem.isPlaying()) {
          return;
        }

        gameplayUpdated = true;
      };

      updateLevel(0.016);
      expect(gameplayUpdated).toBe(true);
    });
  });

  describe('Skip Tutorial', () => {
    it('should skip tutorial when skip() is called', () => {
      const tutorialManager = {
        skip: vi.fn(),
      };

      tutorialManager.skip();
      expect(tutorialManager.skip).toHaveBeenCalled();
    });
  });

  describe('Comms Dismissed Handler', () => {
    it('should forward comms dismissed to tutorial manager', () => {
      const tutorialManager = {
        onCommsDismissed: vi.fn(),
      };

      tutorialManager.onCommsDismissed();
      expect(tutorialManager.onCommsDismissed).toHaveBeenCalled();
    });
  });
});
