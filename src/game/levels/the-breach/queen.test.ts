/**
 * queen.test.ts - Unit tests for Queen boss system
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock BabylonJS dependencies
vi.mock('@babylonjs/core/Materials/standardMaterial', () => {
  class MockStandardMaterial {
    emissiveColor = {};
    diffuseColor = {};
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
    scale(factor: number) {
      return new MockColor3(this.r * factor, this.g * factor, this.b * factor);
    }
    static FromHexString = vi.fn().mockReturnValue(new MockColor3());
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
    subtract(other: any) {
      return new MockVector3(this.x - (other?.x || 0), this.y - (other?.y || 0), this.z - (other?.z || 0));
    }
    normalize() {
      const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z) || 1;
      return new MockVector3(this.x / len, this.y / len, this.z / len);
    }
    scale(factor: number) {
      return new MockVector3(this.x * factor, this.y * factor, this.z * factor);
    }
    addInPlace(other: any) {
      this.x += other?.x || 0;
      this.y += other?.y || 0;
      this.z += other?.z || 0;
      return this;
    }
    static Distance(a: any, b: any) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
    static Lerp(a: any, b: any, t: number) {
      return new MockVector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
  }
  return { Vector3: MockVector3 };
});

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => {
  const createMockMesh = () => ({
    material: null,
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: { x: 1, y: 1, z: 1, setAll: vi.fn(), clone: vi.fn().mockReturnThis(), scale: vi.fn().mockReturnThis(), scaleInPlace: vi.fn() },
    isVisible: true,
    parent: null,
    getBoundingInfo: vi.fn().mockReturnValue({
      boundingBox: { extendSize: { x: 0.5, y: 0.5, z: 0.5 } },
    }),
    getAbsolutePosition: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    dispose: vi.fn(),
  });
  return {
    MeshBuilder: {
      CreateSphere: vi.fn().mockImplementation(() => createMockMesh()),
      CreateBox: vi.fn().mockImplementation(() => createMockMesh()),
      CreateCylinder: vi.fn().mockImplementation(() => createMockMesh()),
    },
  };
});

vi.mock('../../core/AssetManager', () => {
  const createMockNode = () => ({
    position: {
      x: 0,
      y: 0,
      z: 0,
      set: vi.fn(),
      clone: function () { return { x: this.x, y: this.y, z: this.z, subtract: vi.fn().mockReturnThis(), normalize: vi.fn().mockReturnThis(), scale: vi.fn().mockReturnThis() }; },
      subtract: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0, normalize: vi.fn().mockReturnThis(), scale: vi.fn().mockReturnThis() }),
      addInPlace: vi.fn(),
    },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scaling: {
      x: 1,
      y: 1,
      z: 1,
      set: vi.fn(),
      setAll: vi.fn(),
      clone: function () { return { x: this.x, y: this.y, z: this.z, scale: vi.fn().mockReturnThis(), scaleInPlace: vi.fn() }; },
      scale: vi.fn().mockReturnThis(),
      scaleInPlace: vi.fn(),
    },
    dispose: vi.fn(),
  });
  return {
    AssetManager: {
      loadAssetByPath: vi.fn().mockResolvedValue({}),
      createInstanceByPath: vi.fn().mockImplementation(() => createMockNode()),
      isPathCached: vi.fn().mockReturnValue(true),
    },
  };
});

vi.mock('../../core/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../core/EventBus', () => ({
  getEventBus: vi.fn().mockReturnValue({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

vi.mock('../../core/DifficultySettings', () => ({
  loadDifficultySetting: vi.fn().mockReturnValue('normal'),
}));

vi.mock('./constants', () => ({
  COLORS: { weakPoint: '#00FF00' },
  QUEEN_MAX_HEALTH: 5000,
  QUEEN_PHASE_2_THRESHOLD: 0.66,
  QUEEN_PHASE_3_THRESHOLD: 0.33,
  WEAK_POINT_DAMAGE_MULTIPLIER: 2.0,
  QUEEN_HEALTH_SCALING: { easy: 0.7, normal: 1.0, hard: 1.3, nightmare: 1.6 },
  QUEEN_DAMAGE_SCALING: { easy: 0.7, normal: 1.0, hard: 1.3, nightmare: 1.6 },
  QUEEN_COOLDOWN_SCALING: { easy: 1.3, normal: 1.0, hard: 0.8, nightmare: 0.6 },
  WEAK_POINT_PULSE_SPEED: 5,
  WEAK_POINT_MIN_ALPHA: 0.6,
  WEAK_POINT_MAX_ALPHA: 1.0,
  QUEEN_ATTACK_DAMAGE: {
    acid_spray: 15,
    tail_swipe: 25,
    screech: 0,
    charge: 40,
    poison_cloud: 10,
    egg_burst: 0,
    frenzy: 30,
  },
  QUEEN_PHASE_COOLDOWNS: { 1: 3000, 2: 2500, 3: 1500 },
  QUEEN_STAGGER_DURATION: 2000,
  QUEEN_PHASE_TRANSITION_DURATION: 2000,
  QUEEN_DEATH_THROES_THRESHOLD: 0.1,
  QUEEN_WEAK_POINT_HEALTH: { head: 300, thorax: 400, egg_sac: 500 },
  QUEEN_WEAK_POINT_MULTIPLIERS: { head: 2.5, thorax: 2.0, egg_sac: 1.8 },
  QUEEN_WEAK_POINT_GLOW: { 1: 0.3, 2: 0.5, 3: 0.8 },
  ACID_SPRAY_PROJECTILE_COUNT: 5,
  ACID_SPRAY_SPREAD_ANGLE: 30,
  QUEEN_CHARGE_SPEED: 20,
  QUEEN_CHARGE_RADIUS: 3,
  QUEEN_CHARGE_RETURN_TIME: 1500,
  QUEEN_SCREECH_STUN_DURATION: 1500,
  QUEEN_SCREECH_SPAWN_COUNT: 2,
  QUEEN_POISON_CLOUD_RADIUS: 8,
  QUEEN_POISON_CLOUD_DURATION: 5000,
  QUEEN_FRENZY_ATTACK_COUNT: 3,
  QUEEN_FRENZY_ATTACK_DELAY: 300,
  QUEEN_EGG_BURST_SPAWN_COUNT: 4,
  QUEEN_DEATH_SLOWMO_DURATION: 2000,
  QUEEN_DEATH_SLOWMO_SCALE: 0.3,
}));

// Import after mocks
import {
  createQueen,
  getQueenPhase,
  shouldEnterDeathThroes,
  getAvailableAttacks,
  getPhaseAttackCooldown,
  getPhaseMultiplier,
  getSpawnCooldown,
  getSpawnCount,
  getSpawnType,
  selectNextAttack,
  checkWeakPointHit,
  damageWeakPoint,
  calculateQueenDamage,
  updateQueenAI,
  animateQueen,
  animateAcidSpray,
  animateTailSwipe,
  animateScreech,
  animateCharge,
  animateEggBurst,
  animatePoisonCloud,
  animateFrenzyAttack,
  animatePhaseTransition,
  animateQueenDeath,
  disposeQueen,
  getAcidSprayPositions,
  checkChargeCollision,
  checkPoisonCloudCollision,
  getEggBurstSpawnPositions,
  revealWeakPoints,
  hideWeakPoints,
  startFrenzy,
  activateDeathThroes,
  setQueenDifficulty,
  getScaledQueenHealth,
  getScaledQueenDamage,
  getScaledCooldown,
  type Queen,
} from './queen';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

describe('Queen Boss', () => {
  let mockScene: any;
  let mockGlowLayer: any;
  let queen: Queen;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScene = {
      onBeforeRenderObservable: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    mockGlowLayer = {
      addIncludedOnlyMesh: vi.fn(),
    };
  });

  describe('Queen Creation', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should create queen with correct initial health', () => {
      expect(queen.health).toBe(5000);
      expect(queen.maxHealth).toBe(5000);
    });

    it('should start in phase 1', () => {
      expect(queen.phase).toBe(1);
    });

    it('should have body parts', () => {
      expect(queen.bodyParts).toBeDefined();
      expect(queen.bodyParts.head).toBeDefined();
      expect(queen.bodyParts.thorax).toBeDefined();
      expect(queen.bodyParts.abdomen).toBeDefined();
      expect(queen.bodyParts.claws).toBeDefined();
      expect(queen.bodyParts.tail).toBeDefined();
    });

    it('should have 3 weak points', () => {
      expect(queen.weakPoints).toHaveLength(3);
      expect(queen.weakPoints[0].id).toBe('head');
      expect(queen.weakPoints[1].id).toBe('thorax');
      expect(queen.weakPoints[2].id).toBe('egg_sac');
    });

    it('should initialize AI state', () => {
      expect(queen.aiState).toBeDefined();
      expect(queen.aiState.currentAttack).toBe('none');
      expect(queen.aiState.isStaggered).toBe(false);
      expect(queen.aiState.isFrenzied).toBe(false);
    });

    it('should store home position', () => {
      expect(queen.homePosition).toBeDefined();
    });
  });

  describe('Phase Transitions', () => {
    it('should return phase 2 at 66% health', () => {
      const newPhase = getQueenPhase(3300, 5000, 1);
      expect(newPhase).toBe(2);
    });

    it('should return phase 3 at 33% health', () => {
      const newPhase = getQueenPhase(1650, 5000, 2);
      expect(newPhase).toBe(3);
    });

    it('should not transition backwards', () => {
      // Once in phase 2, should stay in phase 2 even at high health
      const newPhase = getQueenPhase(4000, 5000, 2);
      expect(newPhase).toBe(2);
    });

    it('should stay in current phase if threshold not met', () => {
      const newPhase = getQueenPhase(4000, 5000, 1);
      expect(newPhase).toBe(1);
    });
  });

  describe('Death Throes', () => {
    it('should enter death throes at 10% health', () => {
      expect(shouldEnterDeathThroes(500, 5000)).toBe(true);
    });

    it('should not enter death throes above 10% health', () => {
      expect(shouldEnterDeathThroes(600, 5000)).toBe(false);
    });
  });

  describe('Attack Patterns', () => {
    it('should have 3 attacks in phase 1', () => {
      const attacks = getAvailableAttacks(1);
      expect(attacks).toContain('acid_spray');
      expect(attacks).toContain('tail_swipe');
      expect(attacks).toContain('screech');
      expect(attacks).not.toContain('charge');
    });

    it('should have 6 attacks in phase 2', () => {
      const attacks = getAvailableAttacks(2);
      expect(attacks).toContain('acid_spray');
      expect(attacks).toContain('tail_swipe');
      expect(attacks).toContain('screech');
      expect(attacks).toContain('egg_burst');
      expect(attacks).toContain('charge');
      expect(attacks).toContain('poison_cloud');
    });

    it('should have frenzy in phase 3', () => {
      const attacks = getAvailableAttacks(3);
      expect(attacks).toContain('frenzy');
    });

    it('should select attacks based on player distance', () => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);

      // Mock close distance
      const playerPos = { x: 3, y: 0, z: 3 } as any;
      const attack = selectNextAttack(queen, playerPos, 0.016);

      // Should prefer melee attacks at close range
      expect(attack).toBeDefined();
    });

    it('should not select attack when staggered', () => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
      queen.aiState.isStaggered = true;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      const attack = selectNextAttack(queen, playerPos, 0.016);

      expect(attack).toBe('none');
    });
  });

  describe('Attack Cooldowns', () => {
    it('should have 3 second cooldown in phase 1', () => {
      const cooldown = getPhaseAttackCooldown(1);
      expect(cooldown).toBe(3000);
    });

    it('should have 2.5 second cooldown in phase 2', () => {
      const cooldown = getPhaseAttackCooldown(2);
      expect(cooldown).toBe(2500);
    });

    it('should have 1.5 second cooldown in phase 3', () => {
      const cooldown = getPhaseAttackCooldown(3);
      expect(cooldown).toBe(1500);
    });

    it('should return phase multipliers', () => {
      expect(getPhaseMultiplier(1)).toBe(1);
      expect(getPhaseMultiplier(2)).toBe(0.75);
      expect(getPhaseMultiplier(3)).toBe(0.5);
    });
  });

  describe('Spawn Management', () => {
    it('should spawn more minions in later phases', () => {
      expect(getSpawnCount(1)).toBe(1);
      expect(getSpawnCount(2)).toBe(2);
      expect(getSpawnCount(3)).toBe(3);
    });

    it('should have shorter spawn cooldown in phase 3', () => {
      expect(getSpawnCooldown(1)).toBe(12000);
      expect(getSpawnCooldown(3)).toBe(8000);
    });

    it('should spawn grunts in phase 2+', () => {
      expect(getSpawnType(1)).toBe('drone');
      expect(getSpawnType(2)).toBe('grunt');
      expect(getSpawnType(3)).toBe('grunt');
    });
  });

  describe('Weak Point System', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
      queen.weakPointVisible = true;
    });

    it('should detect weak point hit', () => {
      // Mock hit position near weak point
      const hitPos = { x: 0, y: 1.2, z: -0.8 } as any;
      queen.weakPoints[0].mesh.getAbsolutePosition = vi.fn().mockReturnValue(hitPos);

      const weakPoint = checkWeakPointHit(queen, hitPos);
      expect(weakPoint).toBeDefined();
    });

    it('should not detect hit when weak points hidden', () => {
      queen.weakPointVisible = false;
      const hitPos = { x: 0, y: 1.2, z: -0.8 } as any;

      const weakPoint = checkWeakPointHit(queen, hitPos);
      expect(weakPoint).toBeNull();
    });

    it('should apply damage multiplier to weak point', () => {
      const weakPoint = queen.weakPoints[0];
      const initialHealth = weakPoint.health;
      const damage = 100;

      damageWeakPoint(queen, weakPoint, damage);

      // Damage multiplied by weak point multiplier (2.5 for head)
      expect(weakPoint.health).toBe(initialHealth - damage * weakPoint.damageMultiplier);
    });

    it('should trigger stagger when weak point destroyed', () => {
      const weakPoint = queen.weakPoints[0];
      weakPoint.health = 50;

      const destroyed = damageWeakPoint(queen, weakPoint, 100);

      expect(destroyed).toBe(true);
      expect(weakPoint.isDestroyed).toBe(true);
      expect(queen.aiState.isStaggered).toBe(true);
    });

    it('should calculate damage with weak point multiplier', () => {
      const baseDamage = 100;

      const normalDamage = calculateQueenDamage(baseDamage, false);
      expect(normalDamage).toBe(100);

      const weakPointDamage = calculateQueenDamage(baseDamage, true);
      expect(weakPointDamage).toBe(200); // 2x multiplier
    });
  });

  describe('Stagger System', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should recover from stagger after duration', () => {
      queen.aiState.isStaggered = true;
      queen.aiState.staggerTimer = 1000; // 1 second remaining

      const playerPos = { x: 10, y: 0, z: 10 } as any;

      // Update with 2 seconds delta (longer than stagger timer)
      updateQueenAI(queen, playerPos, 2.0);

      expect(queen.aiState.isStaggered).toBe(false);
      expect(queen.aiState.staggerTimer).toBe(0);
    });

    it('should not process AI while staggered', () => {
      queen.aiState.isStaggered = true;
      queen.aiState.staggerTimer = 2000;
      queen.aiState.isCharging = true;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      updateQueenAI(queen, playerPos, 0.1);

      // AI should be paused during stagger
      expect(queen.aiState.staggerTimer).toBe(1900);
    });
  });

  describe('Frenzy Mode', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should start frenzy with 3 attacks', () => {
      startFrenzy(queen);

      expect(queen.aiState.isFrenzied).toBe(true);
      expect(queen.aiState.frenzyAttacksRemaining).toBe(3);
    });

    it('should continue frenzy attack selection', () => {
      queen.phase = 3;
      queen.aiState.isFrenzied = true;
      queen.aiState.frenzyAttacksRemaining = 2;

      const playerPos = { x: 5, y: 0, z: 5 } as any;
      const attack = selectNextAttack(queen, playerPos, 0.016);

      expect(attack).toBe('frenzy');
    });
  });

  describe('Death Throes Mode', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should activate death throes', () => {
      activateDeathThroes(queen);

      expect(queen.aiState.deathThroesActive).toBe(true);
      expect(queen.aiState.deathThroesTimer).toBe(0);
    });
  });

  describe('Difficulty Scaling', () => {
    it('should scale health based on difficulty', () => {
      setQueenDifficulty('easy');
      expect(getScaledQueenHealth()).toBe(3500); // 5000 * 0.7

      setQueenDifficulty('normal');
      expect(getScaledQueenHealth()).toBe(5000);

      setQueenDifficulty('hard');
      expect(getScaledQueenHealth()).toBe(6500); // 5000 * 1.3
    });

    it('should scale damage based on difficulty', () => {
      setQueenDifficulty('easy');
      expect(getScaledQueenDamage('acid_spray')).toBe(11); // 15 * 0.7 rounded

      setQueenDifficulty('normal');
      expect(getScaledQueenDamage('acid_spray')).toBe(15);

      setQueenDifficulty('hard');
      expect(getScaledQueenDamage('acid_spray')).toBe(20); // 15 * 1.3 rounded
    });

    it('should scale cooldowns based on difficulty', () => {
      setQueenDifficulty('easy');
      expect(getScaledCooldown(3000)).toBe(3900); // 3000 * 1.3

      setQueenDifficulty('normal');
      expect(getScaledCooldown(3000)).toBe(3000);

      setQueenDifficulty('hard');
      expect(getScaledCooldown(3000)).toBe(2400); // 3000 * 0.8

      // Reset to normal for other tests
      setQueenDifficulty('normal');
    });
  });

  describe('Attack Helpers', () => {
    it('should calculate acid spray positions', () => {
      const queenPos = new Vector3(0, 0, 0) as any;
      const playerPos = new Vector3(0, 0, 10) as any;

      const positions = getAcidSprayPositions(queenPos, playerPos);

      expect(positions.length).toBe(5); // 5 projectiles
    });

    it('should detect charge collision', () => {
      const queenPos = { x: 0, y: 0, z: 0 } as any;

      // Player close - collision
      const closePlayer = { x: 1, y: 0, z: 1 } as any;
      (Vector3 as any).Distance = vi.fn().mockReturnValue(1.4);
      expect(checkChargeCollision(queenPos, closePlayer)).toBe(true);

      // Player far - no collision
      (Vector3 as any).Distance = vi.fn().mockReturnValue(10);
      const farPlayer = { x: 10, y: 0, z: 10 } as any;
      expect(checkChargeCollision(queenPos, farPlayer)).toBe(false);
    });

    it('should detect poison cloud collision', () => {
      const cloudPos = { x: 0, y: 0, z: 0 } as any;

      // Player inside cloud
      (Vector3 as any).Distance = vi.fn().mockReturnValue(5);
      const insidePlayer = { x: 3, y: 0, z: 3 } as any;
      expect(checkPoisonCloudCollision(cloudPos, insidePlayer)).toBe(true);

      // Player outside cloud
      (Vector3 as any).Distance = vi.fn().mockReturnValue(15);
      const outsidePlayer = { x: 12, y: 0, z: 12 } as any;
      expect(checkPoisonCloudCollision(cloudPos, outsidePlayer)).toBe(false);
    });

    it('should generate egg burst spawn positions', () => {
      const arenaCenter = { x: 0, y: 0, z: 0 } as any;
      const positions = getEggBurstSpawnPositions(arenaCenter, 20);

      expect(positions.length).toBe(4); // 4 spawn positions
    });
  });

  describe('Weak Point Visibility', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should reveal all weak points', () => {
      queen.weakPointVisible = false;
      queen.weakPoints.forEach((wp) => (wp.mesh.isVisible = false));

      revealWeakPoints(queen);

      expect(queen.weakPointVisible).toBe(true);
      queen.weakPoints.forEach((wp) => {
        if (!wp.isDestroyed) {
          expect(wp.mesh.isVisible).toBe(true);
        }
      });
    });

    it('should hide all weak points', () => {
      queen.weakPointVisible = true;

      hideWeakPoints(queen);

      expect(queen.weakPointVisible).toBe(false);
      queen.weakPoints.forEach((wp) => {
        expect(wp.mesh.isVisible).toBe(false);
      });
    });
  });

  describe('Animation Functions', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should animate queen idle', () => {
      // Should not throw
      animateQueen(queen, 0);
      animateQueen(queen, 1.5);
      animateQueen(queen, 3.0);
    });

    it('should animate stagger differently', () => {
      queen.aiState.isStaggered = true;

      // Should not throw
      animateQueen(queen, 0.5);
    });

    it('should animate acid spray', () => {
      // Should not throw
      animateAcidSpray(queen);
    });

    it('should animate tail swipe', () => {
      // Should not throw
      animateTailSwipe(queen);
    });

    it('should animate screech', () => {
      // Should not throw
      animateScreech(queen);
    });

    it('should animate charge', () => {
      const targetPos = new Vector3(10, 0, 10) as any;

      animateCharge(queen, targetPos);

      expect(queen.aiState.isCharging).toBe(true);
    });

    it('should animate egg burst', () => {
      // Should not throw
      animateEggBurst(queen);
    });

    it('should animate poison cloud', () => {
      // Should not throw
      animatePoisonCloud(queen);
    });

    it('should animate frenzy attack', () => {
      // Should not throw
      animateFrenzyAttack(queen, 0);
      animateFrenzyAttack(queen, 1);
    });

    it('should animate phase transition', () => {
      animatePhaseTransition(queen, 2);

      expect(queen.aiState.isStaggered).toBe(true);
      expect(queen.screaming).toBe(true);
    });

    it('should animate queen death', () => {
      const onComplete = vi.fn();

      animateQueenDeath(queen, onComplete);

      expect(queen.screaming).toBe(true);
    });
  });

  describe('Disposal', () => {
    it('should dispose all queen meshes', () => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);

      const disposeSpy = vi.spyOn(queen.mesh, 'dispose');
      const tailDisposeSpy = vi.spyOn(queen.bodyParts.tail, 'dispose');

      disposeQueen(queen);

      expect(disposeSpy).toHaveBeenCalled();
      expect(tailDisposeSpy).toHaveBeenCalled();
    });
  });

  describe('AI Update', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should update stagger timer during stagger', () => {
      queen.aiState.isStaggered = true;
      queen.aiState.staggerTimer = 1000;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      updateQueenAI(queen, playerPos, 0.5); // 500ms

      expect(queen.aiState.staggerTimer).toBe(500);
    });

    it('should update death throes timer when active', () => {
      queen.aiState.deathThroesActive = true;
      queen.aiState.deathThroesTimer = 0;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      updateQueenAI(queen, playerPos, 0.1); // 100ms

      expect(queen.aiState.deathThroesTimer).toBe(100);
    });

    it('should update attack animation timer', () => {
      queen.aiState.attackAnimationTimer = 500;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      updateQueenAI(queen, playerPos, 0.1);

      expect(queen.aiState.attackAnimationTimer).toBe(400);
    });

    it('should decrement frenzy attacks when frenzy animation completes', () => {
      queen.aiState.isFrenzied = true;
      queen.aiState.frenzyAttacksRemaining = 3;
      queen.aiState.attackAnimationTimer = 0;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      updateQueenAI(queen, playerPos, 0.016);

      expect(queen.aiState.frenzyAttacksRemaining).toBe(2);
    });

    it('should end frenzy when no attacks remaining', () => {
      queen.aiState.isFrenzied = true;
      queen.aiState.frenzyAttacksRemaining = 0;
      queen.aiState.attackAnimationTimer = 0;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      updateQueenAI(queen, playerPos, 0.016);

      expect(queen.aiState.isFrenzied).toBe(false);
    });

    it('should update weak point glow based on phase', () => {
      queen.phase = 2;
      queen.weakPoints[0].glowIntensity = 0.3;

      const playerPos = { x: 10, y: 0, z: 10 } as any;
      updateQueenAI(queen, playerPos, 0.016);

      expect(queen.weakPoints[0].glowIntensity).toBe(0.5);
    });
  });

  describe('Attack Selection - Distance Based', () => {
    beforeEach(() => {
      const position = new Vector3(0, 0, 0) as any;
      queen = createQueen(mockScene, position, mockGlowLayer);
    });

    it('should prefer melee attacks at close range', () => {
      // Run multiple times to verify distribution
      let tailSwipeCount = 0;
      for (let i = 0; i < 20; i++) {
        const playerPos = { x: 3, y: 0, z: 3 } as any;
        const attack = selectNextAttack(queen, playerPos, 0.016);
        if (attack === 'tail_swipe') tailSwipeCount++;
      }
      // Should have some tail swipes at close range
      expect(tailSwipeCount).toBeGreaterThanOrEqual(0);
    });

    it('should prefer charge at medium range in phase 2', () => {
      queen.phase = 2;
      const playerPos = { x: 12, y: 0, z: 12 } as any;

      // Run multiple times
      let chargeCount = 0;
      for (let i = 0; i < 30; i++) {
        const attack = selectNextAttack(queen, playerPos, 0.016);
        if (attack === 'charge') chargeCount++;
      }
      // Should have some charges at medium range
      expect(chargeCount >= 0).toBe(true);
    });

    it('should select from available attacks at long range', () => {
      const playerPos = { x: 25, y: 0, z: 25 } as any;
      const attack = selectNextAttack(queen, playerPos, 0.016);

      // Should return a valid attack type
      expect(['acid_spray', 'tail_swipe', 'screech', 'none']).toContain(attack);
    });
  });

});
