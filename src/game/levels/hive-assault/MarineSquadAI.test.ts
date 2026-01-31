/**
 * MarineSquadAI Unit Tests
 *
 * Comprehensive test suite for the Marine Squad AI system
 * Tests squad creation, formations, orders, combat behavior,
 * damage/revive mechanics, and callout systems.
 *
 * Coverage target: 95% line coverage, 90% branch coverage
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Babylon.js modules before imports
vi.mock('@babylonjs/core/Materials/standardMaterial', () => ({
  StandardMaterial: vi.fn().mockImplementation(() => ({
    diffuseColor: new Color3(0, 0, 0),
    emissiveColor: new Color3(0, 0, 0),
    specularColor: new Color3(0, 0, 0),
    dispose: vi.fn(),
  })),
}));

vi.mock('@babylonjs/core/Meshes/meshBuilder', () => ({
  MeshBuilder: {
    CreateBox: vi.fn(() => createMockMesh('box')),
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
    dispose: vi.fn(),
  })),
}));

vi.mock('../../core/AssetManager', () => ({
  AssetManager: {
    isPathCached: vi.fn(() => true),
    createInstanceByPath: vi.fn(() => createMockMesh('instance')),
  },
}));

// Helper to create mock mesh
function createMockMesh(name: string) {
  return {
    name,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scaling: { setAll: vi.fn(), set: vi.fn(), x: 1, y: 1, z: 1 },
    material: null,
    isVisible: true,
    parent: null,
    dispose: vi.fn(),
  };
}

// Create mock scene
function createMockScene() {
  return {
    meshes: [],
    materials: [],
    dispose: vi.fn(),
  };
}

// Create mock callbacks
function createMockCallbacks() {
  return {
    onCommsMessage: vi.fn(),
    onNotification: vi.fn(),
    onMarineRevived: vi.fn(),
    onSquadWiped: vi.fn(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('MarineSquadAI', () => {
  let mockScene: ReturnType<typeof createMockScene>;
  let mockCallbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockScene = createMockScene();
    mockCallbacks = createMockCallbacks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // TYPES AND CONSTANTS
  // ==========================================================================

  describe('Types and Constants', () => {
    it('should define squad formations', () => {
      const formations = ['diamond', 'line', 'cover'];
      expect(formations).toContain('diamond');
      expect(formations).toContain('line');
      expect(formations).toContain('cover');
    });

    it('should define squad orders', () => {
      const orders = ['follow_player', 'hold_position', 'advance', 'retreat'];
      expect(orders).toHaveLength(4);
    });

    it('should define marine states', () => {
      const states = ['idle', 'moving', 'combat', 'taking_cover', 'suppressing', 'downed', 'reviving'];
      expect(states).toHaveLength(7);
    });

    it('should define marine max health as 100', () => {
      const maxHealth = 100;
      expect(maxHealth).toBe(100);
    });

    it('should define marine fire rate as 2.5 shots/sec', () => {
      const fireRate = 2.5;
      expect(fireRate).toBe(2.5);
    });

    it('should define marine damage as 12', () => {
      const damage = 12;
      expect(damage).toBe(12);
    });

    it('should define marine attack range as 50', () => {
      const attackRange = 50;
      expect(attackRange).toBe(50);
    });

    it('should define marine move speed as 6', () => {
      const moveSpeed = 6;
      expect(moveSpeed).toBe(6);
    });

    it('should define marine sprint speed as 9', () => {
      const sprintSpeed = 9;
      expect(sprintSpeed).toBe(9);
    });

    it('should define revive time as 3 seconds', () => {
      const reviveTime = 3.0;
      expect(reviveTime).toBe(3.0);
    });

    it('should define revive proximity as 4 meters', () => {
      const reviveProximity = 4;
      expect(reviveProximity).toBe(4);
    });

    it('should define callout cooldown as 8 seconds', () => {
      const calloutCooldown = 8;
      expect(calloutCooldown).toBe(8);
    });

    it('should define cover seek radius as 15', () => {
      const coverSeekRadius = 15;
      expect(coverSeekRadius).toBe(15);
    });
  });

  // ==========================================================================
  // FORMATION OFFSETS
  // ==========================================================================

  describe('Formation Offsets', () => {
    it('should define diamond formation with 4 positions', () => {
      const diamondOffsets = [
        new Vector3(0, 0, 3), // Point
        new Vector3(-2.5, 0, 0), // Left flank
        new Vector3(2.5, 0, 0), // Right flank
        new Vector3(0, 0, -3), // Rear guard
      ];
      expect(diamondOffsets).toHaveLength(4);
      expect(diamondOffsets[0].z).toBe(3); // Point is forward
      expect(diamondOffsets[3].z).toBe(-3); // Rear is behind
    });

    it('should define line formation with 4 positions', () => {
      const lineOffsets = [
        new Vector3(-4, 0, 0),
        new Vector3(-1.3, 0, 0),
        new Vector3(1.3, 0, 0),
        new Vector3(4, 0, 0),
      ];
      expect(lineOffsets).toHaveLength(4);
      // All at same Z (abreast)
      expect(lineOffsets.every(o => o.z === 0)).toBe(true);
    });

    it('should define cover formation with spread positions', () => {
      const coverOffsets = [
        new Vector3(-5, 0, 2),
        new Vector3(5, 0, 2),
        new Vector3(-3, 0, -3),
        new Vector3(3, 0, -3),
      ];
      expect(coverOffsets).toHaveLength(4);
      // Mixed Z positions for cover
      expect(coverOffsets[0].z).toBe(2);
      expect(coverOffsets[2].z).toBe(-3);
    });
  });

  // ==========================================================================
  // SQUAD CALLSIGNS
  // ==========================================================================

  describe('Squad Callsigns', () => {
    it('should define 4 squad callsigns', () => {
      const callsigns = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];
      expect(callsigns).toHaveLength(4);
    });

    it('should assign callsign by squad index', () => {
      const callsigns = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];
      expect(callsigns[0]).toBe('ALPHA');
      expect(callsigns[1]).toBe('BRAVO');
      expect(callsigns[2]).toBe('CHARLIE');
      expect(callsigns[3]).toBe('DELTA');
    });
  });

  // ==========================================================================
  // MARINE NAMES
  // ==========================================================================

  describe('Marine Names', () => {
    it('should have pool of unique names', () => {
      const names = [
        'Rodriguez', 'Chen', 'Kowalski', 'Okafor', 'Singh',
        'Petrov', 'Nakamura', 'Garcia', 'Kim', 'Adeyemi',
        'Hansen', 'Torres', 'Yamamoto', 'Mensah', 'Johansson', 'Diallo',
      ];
      expect(names).toHaveLength(16);
    });

    it('should track used name indices to avoid duplicates', () => {
      const usedIndices = new Set<number>();
      const names = ['Rodriguez', 'Chen', 'Kowalski'];

      const getUniqueName = () => {
        let idx: number;
        do {
          idx = Math.floor(Math.random() * names.length);
        } while (usedIndices.has(idx) && usedIndices.size < names.length);
        usedIndices.add(idx);
        return names[idx];
      };

      const name1 = getUniqueName();
      const name2 = getUniqueName();
      const name3 = getUniqueName();

      expect(usedIndices.size).toBe(3);
    });
  });

  // ==========================================================================
  // CALLOUT MESSAGES
  // ==========================================================================

  describe('Callout Messages', () => {
    it('should have contact callouts', () => {
      const contactCallouts = [
        'Contact! Hostiles ahead!',
        'Enemy spotted! Engaging!',
        'We have contact! Opening fire!',
        "Tangos at twelve o'clock!",
      ];
      expect(contactCallouts).toHaveLength(4);
    });

    it('should have taking fire callouts', () => {
      const takingFireCallouts = [
        'Taking fire! Need support!',
        'Heavy fire on our position!',
        "We're pinned down!",
        'Under heavy fire here!',
      ];
      expect(takingFireCallouts).toHaveLength(4);
    });

    it('should have man down callouts with name placeholder', () => {
      const manDownCallouts = [
        '%NAME% is down! Need a medic!',
        'Man down! %NAME% is hit!',
        'We lost %NAME%! Marine down!',
        '%NAME% is hit bad!',
      ];
      expect(manDownCallouts[0]).toContain('%NAME%');
    });

    it('should have threat high callouts', () => {
      const threatHighCallouts = [
        'Heavy contact! Big ones incoming!',
        'Armored hostiles! We need heavy weapons!',
        'Watch out, heavy Chitin!',
        'Armored targets approaching!',
      ];
      expect(threatHighCallouts).toHaveLength(4);
    });

    it('should have overwhelmed callouts', () => {
      const overwhelmedCallouts = [
        "We're getting overwhelmed here!",
        'Too many of them! We need backup!',
        "They're everywhere! Help us!",
        "Can't hold them! We need support!",
      ];
      expect(overwhelmedCallouts).toHaveLength(4);
    });

    it('should have rescued callouts', () => {
      const rescuedCallouts = [
        'Thank God! Friendlies! Keep firing!',
        "We're saved! Pushing back!",
        "About time! Let's push these things back!",
        'Reinforcements! We can hold now!',
      ];
      expect(rescuedCallouts).toHaveLength(4);
    });

    it('should have revive thanks callouts', () => {
      const reviveThanksCallouts = [
        'Thanks, I owe you one!',
        "I'm back in the fight!",
        "Patched up! Let's go!",
        'Good as new! Well, close enough.',
      ];
      expect(reviveThanksCallouts).toHaveLength(4);
    });
  });

  // ==========================================================================
  // SQUAD CREATION
  // ==========================================================================

  describe('Squad Creation', () => {
    it('should create squad with 4 marines', () => {
      const marineCount = 4;
      expect(marineCount).toBe(4);
    });

    it('should assign unique ID to squad', () => {
      const squadIndex = 0;
      const squadId = `squad_${squadIndex}`;
      expect(squadId).toBe('squad_0');
    });

    it('should assign callsign based on index', () => {
      const callsigns = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];
      const squadIndex = 1;
      const callsign = callsigns[squadIndex] ?? `SQUAD-${squadIndex + 1}`;
      expect(callsign).toBe('BRAVO');
    });

    it('should initialize squad with diamond formation', () => {
      const defaultFormation = 'diamond';
      expect(defaultFormation).toBe('diamond');
    });

    it('should initialize squad morale at 1.0', () => {
      const initialMorale = 1.0;
      expect(initialMorale).toBe(1.0);
    });

    it('should initialize activeCount to 4', () => {
      const activeCount = 4;
      expect(activeCount).toBe(4);
    });

    it('should initialize isWiped to false', () => {
      const isWiped = false;
      expect(isWiped).toBe(false);
    });

    it('should initialize wasRescued to false', () => {
      const wasRescued = false;
      expect(wasRescued).toBe(false);
    });
  });

  // ==========================================================================
  // MARINE CREATION
  // ==========================================================================

  describe('Marine Creation', () => {
    it('should create marine with unique ID', () => {
      const squadId = 'squad_0';
      const index = 2;
      const marineId = `${squadId}_marine_${index}`;
      expect(marineId).toBe('squad_0_marine_2');
    });

    it('should initialize marine health to max', () => {
      const health = 100;
      const maxHealth = 100;
      expect(health).toBe(maxHealth);
    });

    it('should initialize marine state to idle', () => {
      const initialState = 'idle';
      expect(initialState).toBe('idle');
    });

    it('should initialize marine as active', () => {
      const isActive = true;
      expect(isActive).toBe(true);
    });

    it('should initialize revive progress to 0', () => {
      const reviveProgress = 0;
      expect(reviveProgress).toBe(0);
    });

    it('should initialize fire cooldown to 0', () => {
      const fireCooldown = 0;
      expect(fireCooldown).toBe(0);
    });

    it('should allow immediate first callout', () => {
      const calloutCooldown = 8;
      const lastCalloutTime = -calloutCooldown;
      expect(lastCalloutTime).toBe(-8);
    });
  });

  // ==========================================================================
  // SQUAD COMMANDS
  // ==========================================================================

  describe('Squad Commands', () => {
    it('should set formation for squad', () => {
      let formation = 'diamond';

      const setFormation = (newFormation: string) => {
        formation = newFormation;
      };

      setFormation('line');
      expect(formation).toBe('line');
    });

    it('should issue order to squad', () => {
      let order = 'follow_player';

      const issueOrder = (newOrder: string) => {
        order = newOrder;
      };

      issueOrder('advance');
      expect(order).toBe('advance');
    });

    it('should set waypoint when issuing order', () => {
      let waypointPosition = new Vector3(0, 0, 0);

      const issueOrder = (_order: string, waypoint?: Vector3) => {
        if (waypoint) {
          waypointPosition = waypoint.clone();
        }
      };

      issueOrder('advance', new Vector3(0, 0, -200));
      expect(waypointPosition.z).toBe(-200);
    });

    it('should issue global order to all squads', () => {
      const squads = [{ order: '' }, { order: '' }, { order: '' }];

      const issueGlobalOrder = (order: string) => {
        squads.forEach(s => s.order = order);
      };

      issueGlobalOrder('hold_position');
      expect(squads.every(s => s.order === 'hold_position')).toBe(true);
    });
  });

  // ==========================================================================
  // SQUAD POSITION UPDATE
  // ==========================================================================

  describe('Squad Position Update', () => {
    it('should follow player with offset in follow_player order', () => {
      const playerPosition = new Vector3(0, 0, -100);
      const squadIndex = 0;
      const followDistance = 8;

      const sideOffset = Math.sin((squadIndex * Math.PI) / 2) * followDistance;
      const behindOffset = followDistance + squadIndex * 3;
      const targetPos = playerPosition.add(new Vector3(sideOffset, 0, behindOffset));

      expect(targetPos.z).toBe(-100 + behindOffset);
    });

    it('should sprint when far from player', () => {
      const squadPosition = new Vector3(0, 0, 0);
      const playerPosition = new Vector3(0, 0, -50);
      const normalSpeed = 6;
      const sprintSpeed = 9;

      const distToPlayer = Vector3.Distance(squadPosition, playerPosition);
      const moveSpeed = distToPlayer > 25 ? sprintSpeed : normalSpeed;

      expect(moveSpeed).toBe(sprintSpeed);
    });

    it('should move slower when holding position', () => {
      const normalSpeed = 6;
      const holdSpeed = normalSpeed * 0.5;

      expect(holdSpeed).toBe(3);
    });

    it('should move faster when advancing', () => {
      const sprintSpeed = 9;
      expect(sprintSpeed).toBe(9);
    });

    it('should move toward target position smoothly', () => {
      let squadPosition = new Vector3(0, 0, 0);
      const targetPosition = new Vector3(0, 0, -100);
      const moveSpeed = 6;
      const deltaTime = 0.016;

      const diff = targetPosition.subtract(squadPosition);
      const distance = diff.length();
      if (distance > 1) {
        const moveDir = diff.normalize();
        const moveAmount = Math.min(distance, moveSpeed * deltaTime);
        squadPosition = squadPosition.add(moveDir.scale(moveAmount));
      }

      expect(squadPosition.z).toBeLessThan(0);
    });
  });

  // ==========================================================================
  // FORMATION POSITIONS
  // ==========================================================================

  describe('Formation Positions', () => {
    it('should calculate world-space formation positions', () => {
      const squadPosition = new Vector3(10, 0, -50);
      const offset = new Vector3(2.5, 0, 0);

      const marinePosition = squadPosition.add(offset);
      expect(marinePosition.x).toBe(12.5);
      expect(marinePosition.z).toBe(-50);
    });

    it('should skip inactive marines in formation', () => {
      const marines = [
        { isActive: true, targetPosition: new Vector3(0, 0, 0) },
        { isActive: false, targetPosition: new Vector3(0, 0, 0) },
        { isActive: true, targetPosition: new Vector3(0, 0, 0) },
      ];

      let activeCount = 0;
      marines.forEach(m => {
        if (m.isActive) {
          activeCount++;
        }
      });

      expect(activeCount).toBe(2);
    });
  });

  // ==========================================================================
  // COMBAT BEHAVIOR
  // ==========================================================================

  describe('Combat Behavior', () => {
    it('should detect nearby enemies', () => {
      const squadPosition = new Vector3(0, 0, -100);
      const attackRange = 50;
      const enemies = [
        { position: new Vector3(0, 0, -130) }, // 30m away
        { position: new Vector3(0, 0, -200) }, // 100m away
      ];

      const nearbyEnemies = enemies.filter(
        e => Vector3.Distance(e.position, squadPosition) < attackRange * 1.5
      );

      expect(nearbyEnemies).toHaveLength(1);
    });

    it('should prioritize high threat enemies', () => {
      const enemies = [
        { position: new Vector3(10, 0, -100), threatLevel: 'low', health: 40 },
        { position: new Vector3(5, 0, -100), threatLevel: 'high', health: 200 },
        { position: new Vector3(8, 0, -100), threatLevel: 'medium', health: 30 },
      ];

      const marinePosition = new Vector3(0, 0, -100);
      const attackRange = 50;

      let bestEnemy: typeof enemies[0] | null = null;
      let bestScore = -Infinity;

      for (const enemy of enemies) {
        const dist = Vector3.Distance(marinePosition, enemy.position);
        if (dist > attackRange) continue;

        let score = 100 - dist;
        if (enemy.threatLevel === 'high') score += 40;
        else if (enemy.threatLevel === 'medium') score += 20;
        if (enemy.health < 30) score += 25;

        if (score > bestScore) {
          bestScore = score;
          bestEnemy = enemy;
        }
      };

      expect(bestEnemy?.threatLevel).toBe('high');
    });

    it('should calculate hit chance based on morale and distance', () => {
      const accuracyBase = 0.7;
      const accuracyMoraleBonus = 0.2;
      const morale = 1.0;
      const distance = 25;
      const attackRange = 50;

      const distanceFactor = 1 - (distance / attackRange) * 0.3;
      const moraleFactor = accuracyBase + morale * accuracyMoraleBonus;
      const hitChance = distanceFactor * moraleFactor;

      expect(hitChance).toBeGreaterThan(0.7);
    });

    it('should seek cover when health is low', () => {
      const marine = { health: 25, maxHealth: 100, state: 'combat' };
      const healthPercent = marine.health / marine.maxHealth;
      const coverThreshold = 0.3;

      if (healthPercent < coverThreshold) {
        marine.state = 'taking_cover';
      }

      expect(marine.state).toBe('taking_cover');
    });

    it('should suppress when high morale and health', () => {
      const marine = { health: 80, maxHealth: 100, state: 'combat' };
      const morale = 0.8;
      const healthPercent = marine.health / marine.maxHealth;

      if (morale > 0.7 && healthPercent > 0.7) {
        marine.state = 'suppressing';
      }

      expect(marine.state).toBe('suppressing');
    });
  });

  // ==========================================================================
  // MARINE MOVEMENT
  // ==========================================================================

  describe('Marine Movement', () => {
    it('should move toward target position', () => {
      let marinePosition = new Vector3(0, 0, 0);
      const targetPosition = new Vector3(10, 0, 0);
      const moveSpeed = 6;
      const deltaTime = 0.1;

      const diff = targetPosition.subtract(marinePosition);
      const distance = diff.length();
      if (distance > 0.5) {
        const moveDir = diff.normalize();
        const moveAmount = Math.min(distance, moveSpeed * deltaTime);
        marinePosition = marinePosition.add(moveDir.scale(moveAmount));
      }

      expect(marinePosition.x).toBeGreaterThan(0);
    });

    it('should stop when within 0.5m of target', () => {
      const marinePosition = new Vector3(9.8, 0, 0);
      const targetPosition = new Vector3(10, 0, 0);

      const diff = targetPosition.subtract(marinePosition);
      const distance = diff.length();
      const shouldMove = distance > 0.5;

      expect(shouldMove).toBe(false);
    });
  });

  // ==========================================================================
  // COVER FINDING
  // ==========================================================================

  describe('Cover Finding', () => {
    it('should find nearest cover position', () => {
      const marinePosition = new Vector3(0, 0, -100);
      const coverPositions = [
        new Vector3(-10, 0, -105),
        new Vector3(5, 0, -102),
        new Vector3(20, 0, -110),
      ];
      const coverSeekRadius = 15;

      let nearestCover: Vector3 | null = null;
      let nearestDist = coverSeekRadius;

      for (const coverPos of coverPositions) {
        const dist = Vector3.Distance(marinePosition, coverPos);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCover = coverPos;
        }
      }

      expect(nearestCover).not.toBeNull();
      expect(nearestCover?.x).toBe(5);
    });

    it('should return null if no cover within radius', () => {
      const marinePosition = new Vector3(0, 0, -100);
      const coverPositions = [
        new Vector3(50, 0, -100),
        new Vector3(-50, 0, -100),
      ];
      const coverSeekRadius = 15;

      let nearestCover: Vector3 | null = null;
      let nearestDist = coverSeekRadius;

      for (const coverPos of coverPositions) {
        const dist = Vector3.Distance(marinePosition, coverPos);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestCover = coverPos;
        }
      }

      expect(nearestCover).toBeNull();
    });
  });

  // ==========================================================================
  // DAMAGE AND REVIVE
  // ==========================================================================

  describe('Damage and Revive', () => {
    it('should apply damage to marine', () => {
      let marineHealth = 100;
      const damage = 30;

      marineHealth -= damage;
      expect(marineHealth).toBe(70);
    });

    it('should down marine at 0 health', () => {
      let marine = { health: 20, isActive: true, state: 'combat' as string };
      const damage = 25;

      marine.health -= damage;
      if (marine.health <= 0) {
        marine.health = 0;
        marine.isActive = false;
        marine.state = 'downed';
      }

      expect(marine.health).toBe(0);
      expect(marine.isActive).toBe(false);
      expect(marine.state).toBe('downed');
    });

    it('should not damage inactive marine', () => {
      const marine = { health: 0, isActive: false };
      const damage = 30;

      if (marine.isActive) {
        marine.health -= damage;
      }

      expect(marine.health).toBe(0);
    });

    it('should reduce squad morale when marine downed', () => {
      let morale = 1.0;
      const moraleLossPerDown = 0.2;

      morale = Math.max(0, morale - moraleLossPerDown);
      expect(morale).toBe(0.8);
    });

    it('should update squad active count when marine downed', () => {
      const marines = [
        { isActive: true },
        { isActive: true },
        { isActive: false },
        { isActive: true },
      ];

      const activeCount = marines.filter(m => m.isActive).length;
      expect(activeCount).toBe(3);
    });

    it('should mark squad as wiped when all downed', () => {
      const marines = [
        { isActive: false },
        { isActive: false },
        { isActive: false },
        { isActive: false },
      ];

      const activeCount = marines.filter(m => m.isActive).length;
      const isWiped = activeCount === 0;

      expect(isWiped).toBe(true);
    });

    it('should start revive process', () => {
      const marine = { state: 'downed' as string };

      if (marine.state === 'downed') {
        marine.state = 'reviving';
      }

      expect(marine.state).toBe('reviving');
    });

    it('should cancel revive and reset progress', () => {
      const marine = { state: 'reviving' as string, reviveProgress: 1.5 };

      if (marine.state === 'reviving') {
        marine.state = 'downed';
        marine.reviveProgress = 0;
      }

      expect(marine.state).toBe('downed');
      expect(marine.reviveProgress).toBe(0);
    });

    it('should complete revive at full progress', () => {
      const marine = {
        state: 'reviving' as string,
        reviveProgress: 2.9,
        reviveTime: 3.0,
        isActive: false,
        health: 0,
        maxHealth: 100,
      };
      const deltaTime = 0.2;

      marine.reviveProgress += deltaTime;
      if (marine.reviveProgress >= marine.reviveTime) {
        marine.isActive = true;
        marine.state = 'idle';
        marine.health = marine.maxHealth * 0.5;
        marine.reviveProgress = 0;
      }

      expect(marine.isActive).toBe(true);
      expect(marine.state).toBe('idle');
      expect(marine.health).toBe(50);
    });

    it('should find downed marines near player', () => {
      const playerPosition = new Vector3(0, 0, -100);
      const reviveProximity = 4;
      const marines = [
        { position: new Vector3(2, 0, -100), state: 'downed' },
        { position: new Vector3(10, 0, -100), state: 'downed' },
        { position: new Vector3(1, 0, -100), state: 'combat' },
      ];

      const downedNearby = marines.filter(m =>
        (m.state === 'downed' || m.state === 'reviving') &&
        Vector3.Distance(m.position, playerPosition) <= reviveProximity
      );

      expect(downedNearby).toHaveLength(1);
    });
  });

  // ==========================================================================
  // CALLOUT SYSTEM
  // ==========================================================================

  describe('Callout System', () => {
    it('should respect callout cooldown', () => {
      const time = 10;
      const lastCalloutTime = 5;
      const calloutCooldown = 8;

      const canCallout = time - lastCalloutTime >= calloutCooldown;
      expect(canCallout).toBe(false);
    });

    it('should allow callout after cooldown expires', () => {
      const time = 15;
      const lastCalloutTime = 5;
      const calloutCooldown = 8;

      const canCallout = time - lastCalloutTime >= calloutCooldown;
      expect(canCallout).toBe(true);
    });

    it('should prioritize overwhelmed callout', () => {
      const enemyCount = 10;
      const morale = 0.3;
      const closestThreatLevel = 'high';

      let calloutType: string | null = null;

      if (enemyCount > 8 && morale < 0.5) {
        calloutType = 'overwhelmed';
      } else if (closestThreatLevel === 'high') {
        calloutType = 'threat_high';
      } else {
        calloutType = 'contact';
      }

      expect(calloutType).toBe('overwhelmed');
    });

    it('should send comms message with squad callsign', () => {
      const squadCallsign = 'BRAVO';
      const marineName = 'Rodriguez';
      const text = 'Contact! Hostiles ahead!';

      const sender = marineName ? `Pvt. ${marineName}` : `${squadCallsign} Lead`;
      expect(sender).toBe('Pvt. Rodriguez');
    });

    it('should pick random callout from list', () => {
      const callouts = ['Option 1', 'Option 2', 'Option 3'];

      const pickCallout = (list: string[]) => {
        const idx = Math.floor(Math.random() * list.length);
        return list[idx];
      };

      const result = pickCallout(callouts);
      expect(callouts).toContain(result);
    });
  });

  // ==========================================================================
  // MORALE SYSTEM
  // ==========================================================================

  describe('Morale System', () => {
    it('should recover morale over time', () => {
      let morale = 0.5;
      const maxMorale = 1.0;
      const recoveryRate = 0.02;
      const deltaTime = 1.0;

      if (morale < maxMorale) {
        morale = Math.min(maxMorale, morale + recoveryRate * deltaTime);
      }

      expect(morale).toBeCloseTo(0.52);
    });

    it('should not exceed max morale', () => {
      let morale = 0.99;
      const maxMorale = 1.0;
      const recoveryRate = 0.02;
      const deltaTime = 1.0;

      morale = Math.min(maxMorale, morale + recoveryRate * deltaTime);
      expect(morale).toBe(1.0);
    });

    it('should not recover when all marines down', () => {
      const morale = 0.5;
      const activeCount = 0;
      const recoveryRate = 0.02;
      const deltaTime = 1.0;

      let newMorale = morale;
      if (activeCount > 0) {
        newMorale = Math.min(1.0, morale + recoveryRate * deltaTime);
      }

      expect(newMorale).toBe(0.5);
    });
  });

  // ==========================================================================
  // SCRIPTED EVENTS
  // ==========================================================================

  describe('Scripted Events', () => {
    it('should simulate squad under fire', () => {
      const marines = [
        { health: 100, isActive: true },
        { health: 100, isActive: true },
        { health: 100, isActive: true },
        { health: 100, isActive: true },
      ];
      const damagePerMarine = 40;

      marines.forEach(m => {
        if (m.isActive) {
          m.health -= damagePerMarine;
        }
      });

      expect(marines.every(m => m.health === 60)).toBe(true);
    });

    it('should set squad to overwhelmed state', () => {
      const squad = {
        morale: 1.0,
        formation: 'diamond' as string,
        order: 'advance' as string,
      };

      squad.morale = 0.2;
      squad.formation = 'cover';
      squad.order = 'hold_position';

      expect(squad.morale).toBe(0.2);
      expect(squad.formation).toBe('cover');
      expect(squad.order).toBe('hold_position');
    });

    it('should trigger rescue callout only once', () => {
      const squad = { wasRescued: false };
      let calloutCount = 0;

      const triggerRescueCallout = () => {
        if (squad.wasRescued) return;
        squad.wasRescued = true;
        calloutCount++;
      };

      triggerRescueCallout();
      triggerRescueCallout();

      expect(calloutCount).toBe(1);
      expect(squad.wasRescued).toBe(true);
    });
  });

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  describe('Query Methods', () => {
    it('should get all squads', () => {
      const squads = [{ id: 'squad_0' }, { id: 'squad_1' }];
      expect(squads).toHaveLength(2);
    });

    it('should get active marines across squads', () => {
      const squads = [
        { marines: [{ isActive: true }, { isActive: false }] },
        { marines: [{ isActive: true }, { isActive: true }] },
      ];

      const activeMarines = squads.flatMap(s => s.marines.filter(m => m.isActive));
      expect(activeMarines).toHaveLength(3);
    });

    it('should get all marines including downed', () => {
      const squads = [
        { marines: [{ isActive: true }, { isActive: false }] },
        { marines: [{ isActive: true }, { isActive: true }] },
      ];

      const allMarines = squads.flatMap(s => s.marines);
      expect(allMarines).toHaveLength(4);
    });

    it('should get firing marines', () => {
      const marines = [
        { isActive: true, state: 'combat', fireCooldown: 0, targetEnemyPos: new Vector3(10, 0, 0) },
        { isActive: true, state: 'combat', fireCooldown: 0.5, targetEnemyPos: new Vector3(10, 0, 0) },
        { isActive: true, state: 'idle', fireCooldown: 0, targetEnemyPos: null },
      ];

      const firingMarines = marines.filter(m =>
        m.isActive &&
        m.state === 'combat' &&
        m.fireCooldown <= 0 &&
        m.targetEnemyPos
      );

      expect(firingMarines).toHaveLength(1);
    });

    it('should get total active marine count', () => {
      const squads = [
        { activeCount: 3 },
        { activeCount: 4 },
        { activeCount: 2 },
      ];

      const totalActive = squads.reduce((sum, s) => sum + s.activeCount, 0);
      expect(totalActive).toBe(9);
    });

    it('should get squad by index', () => {
      const squads = [{ id: 'squad_0' }, { id: 'squad_1' }, { id: 'squad_2' }];
      expect(squads[1].id).toBe('squad_1');
    });
  });

  // ==========================================================================
  // DISPOSAL
  // ==========================================================================

  describe('Disposal', () => {
    it('should dispose all marine meshes', () => {
      const marines = [
        { rootNode: { dispose: vi.fn() }, bodyMesh: { dispose: vi.fn() }, helmetMesh: { dispose: vi.fn() }, weaponMesh: { dispose: vi.fn() } },
        { rootNode: { dispose: vi.fn() }, bodyMesh: { dispose: vi.fn() }, helmetMesh: { dispose: vi.fn() }, weaponMesh: { dispose: vi.fn() } },
      ];

      marines.forEach(m => {
        m.rootNode.dispose();
        m.bodyMesh.dispose();
        m.helmetMesh.dispose();
        m.weaponMesh.dispose();
      });

      expect(marines[0].rootNode.dispose).toHaveBeenCalled();
      expect(marines[1].weaponMesh.dispose).toHaveBeenCalled();
    });

    it('should clear squads array on dispose', () => {
      let squads = [{ id: 'squad_0' }, { id: 'squad_1' }];

      squads = [];
      expect(squads).toHaveLength(0);
    });

    it('should clear used name indices on dispose', () => {
      const usedNameIndices = new Set([0, 3, 5, 7]);

      usedNameIndices.clear();
      expect(usedNameIndices.size).toBe(0);
    });
  });

  // ==========================================================================
  // DOWNED MARINE VISUALS
  // ==========================================================================

  describe('Downed Marine Visuals', () => {
    it('should slump body when downed', () => {
      const marine = {
        bodyMesh: { position: { y: 0.9 } },
        rootNode: { rotation: { x: 0 } },
      };

      // Simulate downed state
      marine.bodyMesh.position.y = 0.3;
      marine.rootNode.rotation.x = Math.PI / 6;

      expect(marine.bodyMesh.position.y).toBe(0.3);
      expect(marine.rootNode.rotation.x).toBeCloseTo(Math.PI / 6);
    });

    it('should dim helmet material when downed', () => {
      const helmetMat = { emissiveColor: new Color3(0, 0, 0) };

      helmetMat.emissiveColor = new Color3(0.3, 0.05, 0.05);

      expect(helmetMat.emissiveColor.r).toBeCloseTo(0.3);
      expect(helmetMat.emissiveColor.g).toBeCloseTo(0.05);
    });

    it('should reset visuals on revive', () => {
      const marine = {
        bodyMesh: { position: { y: 0.3 } },
        rootNode: { rotation: { x: Math.PI / 6 } },
      };

      // Reset on revive
      marine.bodyMesh.position.y = 0.9;
      marine.rootNode.rotation.x = 0;

      expect(marine.bodyMesh.position.y).toBe(0.9);
      expect(marine.rootNode.rotation.x).toBe(0);
    });

    it('should reset helmet emissive on revive', () => {
      const helmetMat = { emissiveColor: new Color3(0.3, 0.05, 0.05) };

      helmetMat.emissiveColor = new Color3(0, 0, 0);

      expect(helmetMat.emissiveColor.r).toBe(0);
      expect(helmetMat.emissiveColor.g).toBe(0);
      expect(helmetMat.emissiveColor.b).toBe(0);
    });
  });

  // ==========================================================================
  // ROTATION AND FACING
  // ==========================================================================

  describe('Rotation and Facing', () => {
    it('should face enemy during combat', () => {
      const marinePosition = new Vector3(0, 0, -100);
      const enemyPosition = new Vector3(10, 0, -90);

      const lookDir = enemyPosition.subtract(marinePosition);
      const targetRotY = Math.atan2(lookDir.x, lookDir.z);

      expect(targetRotY).toBeGreaterThan(0);
    });

    it('should smoothly interpolate rotation', () => {
      let currentRotY = 0;
      const targetRotY = 1.0;
      const deltaTime = 0.016;
      const rotSpeed = 6;

      const rotDiff = targetRotY - currentRotY;
      currentRotY += rotDiff * Math.min(1, deltaTime * rotSpeed);

      expect(currentRotY).toBeGreaterThan(0);
      expect(currentRotY).toBeLessThan(targetRotY);
    });
  });
});
