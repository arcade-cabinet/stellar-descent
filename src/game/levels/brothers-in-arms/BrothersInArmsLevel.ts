/**
 * BrothersInArmsLevel - Chapter 4: Reunite with Marcus, Wave Combat
 *
 * LEVEL STRUCTURE:
 * 1. REUNION - Emotional cutscene with Marcus
 * 2. WAVE COMBAT - 4 waves of increasing difficulty
 * 3. THE BREACH - Final battle at massive sinkhole entrance
 * 4. TRANSITION - Marcus can't follow into tunnels
 *
 * KEY FEATURES:
 * - Marcus AI ally (8m tall Titan mech)
 * - Wave-based Chitin combat
 * - Open canyon arena (200m x 150m)
 * - The Breach: 100m diameter sinkhole
 * - Orange-red sunset lighting
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { getAchievementManager } from '../../achievements';
import { createEntity, type Entity, removeEntity } from '../../core/ecs';
import { levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { tokens } from '../../utils/designTokens';
import { BaseLevel } from '../BaseLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import { COMMS, NOTIFICATIONS, OBJECTIVES, ReunionCinematic } from './cinematics';
import { MarcusCombatAI, type MarcusCombatState } from './MarcusCombatAI';
import type { CoordinationCombatState } from './MarcusCombatCoordinator';
import { createMarcusBanterManager, type MarcusBanterManager } from './marcusBanter';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type LevelPhase = 'reunion' | 'wave_combat' | 'breach_battle' | 'transition';

type MarcusState = 'patrol' | 'combat' | 'dialogue' | 'coordinated';

interface MarcusMech {
  rootNode: TransformNode;
  body: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
  legs: Mesh;
  position: Vector3;
  health: number;
  maxHealth: number;
  targetEnemy: Entity | null;
  state: MarcusState;
  lastFireTime: number;
  fireRate: number;
  damage: number;
  range: number;
}

type EnemyType = 'drone' | 'grunt' | 'spitter' | 'brute';

interface EnemyConfig {
  type: EnemyType;
  health: number;
  damage: number;
  speed: number;
  size: number;
  color: string;
  attackRange: number;
}

interface Wave {
  id: number;
  enemies: { type: EnemyType; count: number }[];
  spawnPoints: Vector3[];
  dialogue: string;
  dialogueSender: string;
}

interface ActiveEnemy {
  entity: Entity;
  mesh: Mesh;
  type: EnemyType;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  attackRange: number;
  lastAttackTime: number;
  targetPosition: Vector3;
  state: 'spawning' | 'moving' | 'attacking' | 'dead';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  drone: {
    type: 'drone',
    health: 30,
    damage: 5,
    speed: 18,
    size: 0.6,
    color: '#2D4A3E',
    attackRange: 8,
  },
  grunt: {
    type: 'grunt',
    health: 100,
    damage: 15,
    speed: 10,
    size: 1.6,
    color: '#3A3A4A',
    attackRange: 12,
  },
  spitter: {
    type: 'spitter',
    health: 50,
    damage: 40,
    speed: 6,
    size: 1.3,
    color: '#3E5A2D',
    attackRange: 25,
  },
  brute: {
    type: 'brute',
    health: 200,
    damage: 25,
    speed: 5,
    size: 2.8,
    color: '#5A2A2A',
    attackRange: 15,
  },
};

const WAVES: Wave[] = [
  {
    id: 1,
    enemies: [{ type: 'drone', count: 15 }],
    spawnPoints: [],
    dialogue: 'Contacts inbound! Just like the Europa job, eh James?',
    dialogueSender: 'Marcus',
  },
  {
    id: 2,
    enemies: [{ type: 'grunt', count: 10 }],
    spawnPoints: [],
    dialogue: 'Grunts incoming! Keep your distance!',
    dialogueSender: 'Marcus',
  },
  {
    id: 3,
    enemies: [
      { type: 'grunt', count: 8 },
      { type: 'drone', count: 5 },
      { type: 'spitter', count: 2 },
    ],
    spawnPoints: [],
    dialogue: 'Mixed wave! Watch for acid spitters!',
    dialogueSender: 'Marcus',
  },
  {
    id: 4,
    enemies: [
      { type: 'brute', count: 1 },
      { type: 'grunt', count: 6 },
      { type: 'drone', count: 10 },
    ],
    spawnPoints: [],
    dialogue: 'Something big is coming... BRUTE! Focus fire!',
    dialogueSender: 'Marcus',
  },
];

const ARENA_WIDTH = 200;
const ARENA_DEPTH = 150;
const BREACH_DIAMETER = 100;
const BREACH_POSITION = new Vector3(0, 0, -60);
const MARCUS_START_POSITION = new Vector3(15, 0, 10);
const WAVE_REST_DURATION = 30000; // 30 seconds between waves

// ============================================================================
// LEVEL CLASS
// ============================================================================

export class BrothersInArmsLevel extends BaseLevel {
  // Phase management
  private phase: LevelPhase = 'reunion';
  private phaseTime = 0;

  // Marcus AI ally
  private marcus: MarcusMech | null = null;
  private marcusCombatAI: MarcusCombatAI | null = null;
  private marcusHealthBar: Mesh | null = null;
  private marcusHealthBarFill: Mesh | null = null;

  // Wave combat
  private currentWave = 0;
  private waveEnemies: ActiveEnemy[] = [];
  private waveComplete = false;
  private waveRestTimer = 0;
  private allWavesComplete = false;
  private totalKills = 0;

  // Environment
  private terrain: Mesh | null = null;
  private canyonWalls: Mesh[] = [];
  private rockPillars: Mesh[] = [];
  private breachMesh: Mesh | null = null;
  private breachGlow: PointLight | null = null;
  private skyDome: Mesh | null = null;

  // Combat
  private playerHealth = 100;
  private fireSuportCooldown = 0;
  private grenadeCooldown = 0;
  private flankCooldown = 0;
  private focusFireCooldown = 0;
  private lastMarcusDamageTime = 0;

  // Marcus coordination state
  private marcusCoordinationState: CoordinationCombatState = 'support';

  // Marcus downed state tracking
  private marcusDownedIndicator: Mesh | null = null;
  private marcusShieldBar: Mesh | null = null;
  private marcusShieldBarFill: Mesh | null = null;

  // Action handler reference
  private actionCallback: ((actionId: string) => void) | null = null;

  // Spawn points generated once
  private spawnPoints: Vector3[] = [];

  // Cinematic system
  private reunionCinematic: ReunionCinematic | null = null;
  private cinematicInProgress = false;

  // Marcus banter system - situation-aware dialogue
  private marcusBanterManager: MarcusBanterManager | null = null;
  private previousPlayerHealth = 100;
  private previousMarcusHealth = 500;
  private previousMarcusHealthPercent = 1;
  private lastBanterUpdateTime = 0;
  private waveStartEnemyCount = 0;
  private hasSeenBreach = false;
  private hasTriggeredDefendingPosition = false;

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    // Orange-red sunset sky
    return new Color4(0.85, 0.55, 0.35, 1);
  }

  protected async createEnvironment(): Promise<void> {
    // Override default lighting with sunset-style
    this.setupSunsetLighting();

    // Create environment
    this.createTerrain();
    this.createCanyonWalls();
    this.createRockPillars();
    this.createBreach();
    this.createSkyDome();
    this.generateSpawnPoints();

    // Create Marcus
    this.createMarcusMech();

    // Setup camera for FPS
    this.camera.position.set(0, 1.7, 50);
    this.rotationY = Math.PI;
    this.camera.rotation.y = this.rotationY;

    // Setup action handler
    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    // Start reunion phase
    this.startReunionPhase();
  }

  private setupSunsetLighting(): void {
    // Remove default lighting
    if (this.sunLight) {
      this.sunLight.dispose();
      this.sunLight = null;
    }
    if (this.ambientLight) {
      this.ambientLight.dispose();
      this.ambientLight = null;
    }

    // Low-angle sunset sun
    const sunDir = new Vector3(0.5, -0.3, -0.6).normalize();
    const sun = new DirectionalLight('sunsetSun', sunDir, this.scene);
    sun.intensity = 2.5;
    sun.diffuse = Color3.FromHexString('#FFA040'); // Orange-red
    sun.specular = Color3.FromHexString('#FFD080');
    this.sunLight = sun;

    // Ambient fill with warm tones
    const ambient = new DirectionalLight('ambientFill', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.4;
    ambient.diffuse = new Color3(0.5, 0.35, 0.25);
  }

  private createTerrain(): void {
    this.terrain = MeshBuilder.CreateGround(
      'terrain',
      {
        width: ARENA_WIDTH * 1.5,
        height: ARENA_DEPTH * 1.5,
        subdivisions: 64,
      },
      this.scene
    );

    const terrainMat = new StandardMaterial('terrainMat', this.scene);
    terrainMat.diffuseColor = Color3.FromHexString('#9B7B5A'); // Rust brown
    terrainMat.specularColor = new Color3(0.05, 0.04, 0.03);
    this.terrain.material = terrainMat;
  }

  private createCanyonWalls(): void {
    const wallMat = new StandardMaterial('wallMat', this.scene);
    wallMat.diffuseColor = Color3.FromHexString('#6B4423'); // Dark brown

    // North wall
    const northWall = MeshBuilder.CreateBox(
      'northWall',
      { width: ARENA_WIDTH * 1.5, height: 80, depth: 30 },
      this.scene
    );
    northWall.position.set(0, 40, -ARENA_DEPTH / 2 - 30);
    northWall.material = wallMat;
    this.canyonWalls.push(northWall);

    // South wall
    const southWall = MeshBuilder.CreateBox(
      'southWall',
      { width: ARENA_WIDTH * 1.5, height: 80, depth: 30 },
      this.scene
    );
    southWall.position.set(0, 40, ARENA_DEPTH / 2 + 30);
    southWall.material = wallMat;
    this.canyonWalls.push(southWall);

    // East wall
    const eastWall = MeshBuilder.CreateBox(
      'eastWall',
      { width: 30, height: 80, depth: ARENA_DEPTH * 1.5 },
      this.scene
    );
    eastWall.position.set(ARENA_WIDTH / 2 + 30, 40, 0);
    eastWall.material = wallMat;
    this.canyonWalls.push(eastWall);

    // West wall
    const westWall = MeshBuilder.CreateBox(
      'westWall',
      { width: 30, height: 80, depth: ARENA_DEPTH * 1.5 },
      this.scene
    );
    westWall.position.set(-ARENA_WIDTH / 2 - 30, 40, 0);
    westWall.material = wallMat;
    this.canyonWalls.push(westWall);
  }

  private createRockPillars(): void {
    const pillarMat = new StandardMaterial('pillarMat', this.scene);
    pillarMat.diffuseColor = Color3.FromHexString('#8B5A2B');
    pillarMat.specularColor = new Color3(0.08, 0.06, 0.04);

    // Create 10-15 rock pillars for cover
    const pillarPositions = [
      new Vector3(-40, 0, 30),
      new Vector3(35, 0, 25),
      new Vector3(-25, 0, -10),
      new Vector3(50, 0, 0),
      new Vector3(-55, 0, 15),
      new Vector3(20, 0, -30),
      new Vector3(-45, 0, -25),
      new Vector3(60, 0, -20),
      new Vector3(-30, 0, 50),
      new Vector3(45, 0, 45),
      new Vector3(-60, 0, -40),
      new Vector3(25, 0, 55),
      new Vector3(-15, 0, 40),
    ];

    pillarPositions.forEach((pos, i) => {
      const height = 8 + Math.random() * 12;
      const diameterBottom = 3 + Math.random() * 3;
      const diameterTop = diameterBottom * (0.4 + Math.random() * 0.3);

      const pillar = MeshBuilder.CreateCylinder(
        `pillar_${i}`,
        {
          height,
          diameterTop,
          diameterBottom,
          tessellation: 8,
        },
        this.scene
      );

      pillar.position = pos.clone();
      pillar.position.y = height / 2;
      pillar.material = pillarMat;

      // Slight random rotation for variety
      pillar.rotation.y = Math.random() * Math.PI * 2;

      this.rockPillars.push(pillar);
    });
  }

  private createBreach(): void {
    // The Breach - massive sinkhole entrance to hive
    // Create as a cylinder going down
    this.breachMesh = MeshBuilder.CreateCylinder(
      'breach',
      {
        height: 50,
        diameter: BREACH_DIAMETER,
        tessellation: 32,
      },
      this.scene
    );

    const breachMat = new StandardMaterial('breachMat', this.scene);
    breachMat.diffuseColor = new Color3(0.15, 0.1, 0.15);
    breachMat.emissiveColor = new Color3(0.05, 0.15, 0.15); // Slight bioluminescent glow
    this.breachMesh.material = breachMat;

    this.breachMesh.position = BREACH_POSITION.clone();
    this.breachMesh.position.y = -25;

    // Create rim around breach
    const rimMat = new StandardMaterial('rimMat', this.scene);
    rimMat.diffuseColor = Color3.FromHexString('#5A3A5A');
    rimMat.emissiveColor = new Color3(0.1, 0.3, 0.3);

    const rim = MeshBuilder.CreateTorus(
      'breachRim',
      {
        diameter: BREACH_DIAMETER + 5,
        thickness: 4,
        tessellation: 32,
      },
      this.scene
    );
    rim.position = BREACH_POSITION.clone();
    rim.position.y = 0.5;
    rim.rotation.x = Math.PI / 2;
    rim.material = rimMat;

    // Bioluminescent glow from below
    this.breachGlow = new PointLight('breachGlow', BREACH_POSITION.clone(), this.scene);
    this.breachGlow.position.y = -10;
    this.breachGlow.intensity = 1.5;
    this.breachGlow.diffuse = Color3.FromHexString('#4AC8C8');
    this.breachGlow.range = 80;
  }

  private createSkyDome(): void {
    this.skyDome = MeshBuilder.CreateSphere(
      'sky',
      {
        diameter: 5000,
        segments: 16,
        sideOrientation: 1, // Inside facing
      },
      this.scene
    );

    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.emissiveColor = new Color3(0.85, 0.55, 0.35); // Sunset orange
    skyMat.disableLighting = true;
    this.skyDome.material = skyMat;
  }

  private generateSpawnPoints(): void {
    // Generate spawn points around arena edges
    this.spawnPoints = [];

    // North edge (behind breach)
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 30;
      this.spawnPoints.push(new Vector3(x, 0, -ARENA_DEPTH / 2 + 20));
    }

    // East edge
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * 30;
      this.spawnPoints.push(new Vector3(ARENA_WIDTH / 2 - 20, 0, z));
    }

    // West edge
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * 30;
      this.spawnPoints.push(new Vector3(-ARENA_WIDTH / 2 + 20, 0, z));
    }

    // South edge (near player start)
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 30;
      this.spawnPoints.push(new Vector3(x, 0, ARENA_DEPTH / 2 - 30));
    }

    // Assign to waves
    WAVES.forEach((wave) => {
      wave.spawnPoints = [...this.spawnPoints];
    });
  }

  // ============================================================================
  // MARCUS MECH
  // ============================================================================

  private createMarcusMech(): void {
    const root = new TransformNode('marcusRoot', this.scene);
    root.position = MARCUS_START_POSITION.clone();

    // Materials
    const bodyMat = new StandardMaterial('mechBodyMat', this.scene);
    bodyMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.oliveDark);
    bodyMat.specularColor = new Color3(0.4, 0.4, 0.4);

    const accentMat = new StandardMaterial('mechAccentMat', this.scene);
    accentMat.diffuseColor = Color3.FromHexString(tokens.colors.accent.gunmetal);
    accentMat.emissiveColor = new Color3(0.1, 0.15, 0.1);

    // Body (torso) - scaled up to 8m tall total
    const body = MeshBuilder.CreateBox('mechBody', { width: 4, height: 5, depth: 3 }, this.scene);
    body.material = bodyMat;
    body.parent = root;
    body.position.y = 6;

    // Cockpit
    const cockpit = MeshBuilder.CreateBox(
      'cockpit',
      { width: 2, height: 1.2, depth: 1 },
      this.scene
    );
    cockpit.material = accentMat;
    cockpit.parent = body;
    cockpit.position.set(0, 2, 1);

    // Left arm with autocannon
    const leftArm = MeshBuilder.CreateCylinder(
      'mechLeftArm',
      { height: 5, diameter: 1 },
      this.scene
    );
    leftArm.material = bodyMat;
    leftArm.parent = root;
    leftArm.position.set(-3, 5.5, 0);
    leftArm.rotation.z = 0.3;

    // Left autocannon barrel
    const leftBarrel = MeshBuilder.CreateCylinder(
      'leftBarrel',
      { height: 3.5, diameter: 0.5 },
      this.scene
    );
    leftBarrel.material = accentMat;
    leftBarrel.parent = leftArm;
    leftBarrel.position.y = -3.5;
    leftBarrel.rotation.x = Math.PI / 2;

    // Right arm with autocannon
    const rightArm = MeshBuilder.CreateCylinder(
      'mechRightArm',
      { height: 5, diameter: 1 },
      this.scene
    );
    rightArm.material = bodyMat;
    rightArm.parent = root;
    rightArm.position.set(3, 5.5, 0);
    rightArm.rotation.z = -0.3;

    // Right autocannon barrel
    const rightBarrel = MeshBuilder.CreateCylinder(
      'rightBarrel',
      { height: 3.5, diameter: 0.5 },
      this.scene
    );
    rightBarrel.material = accentMat;
    rightBarrel.parent = rightArm;
    rightBarrel.position.y = -3.5;
    rightBarrel.rotation.x = Math.PI / 2;

    // Legs container
    const legs = MeshBuilder.CreateBox(
      'mechLegs',
      { width: 3.5, height: 0.8, depth: 2 },
      this.scene
    );
    legs.visibility = 0;
    legs.parent = root;
    legs.position.y = 3;

    // Left leg
    const leftLeg = MeshBuilder.CreateCylinder(
      'leftLeg',
      { height: 5.5, diameterTop: 1, diameterBottom: 1.5 },
      this.scene
    );
    leftLeg.material = bodyMat;
    leftLeg.parent = legs;
    leftLeg.position.set(-1, -2.75, 0);

    // Right leg
    const rightLeg = MeshBuilder.CreateCylinder(
      'rightLeg',
      { height: 5.5, diameterTop: 1, diameterBottom: 1.5 },
      this.scene
    );
    rightLeg.material = bodyMat;
    rightLeg.parent = legs;
    rightLeg.position.set(1, -2.75, 0);

    // Feet
    const footMat = new StandardMaterial('footMat', this.scene);
    footMat.diffuseColor = Color3.FromHexString(tokens.colors.accent.gunmetal);

    const leftFoot = MeshBuilder.CreateBox(
      'leftFoot',
      { width: 2, height: 0.6, depth: 2.5 },
      this.scene
    );
    leftFoot.material = footMat;
    leftFoot.parent = legs;
    leftFoot.position.set(-1, -5.8, 0.3);

    const rightFoot = MeshBuilder.CreateBox(
      'rightFoot',
      { width: 2, height: 0.6, depth: 2.5 },
      this.scene
    );
    rightFoot.material = footMat;
    rightFoot.parent = legs;
    rightFoot.position.set(1, -5.8, 0.3);

    this.marcus = {
      rootNode: root,
      body,
      leftArm,
      rightArm,
      legs,
      position: MARCUS_START_POSITION.clone(),
      health: 500,
      maxHealth: 500,
      targetEnemy: null,
      state: 'dialogue',
      lastFireTime: 0,
      fireRate: 2.5, // 2.5 shots per second
      damage: 50,
      range: 80,
    };

    // Initialize the advanced Combat AI system
    this.marcusCombatAI = new MarcusCombatAI(
      this.scene,
      root,
      leftArm,
      rightArm,
      {
        onCommsMessage: (message) => this.callbacks.onCommsMessage(message),
        onMarcusHealthChange: (health, maxHealth) => {
          this.updateMarcusHealthBar(health, maxHealth);
          if (this.marcus) {
            this.marcus.health = health;
            this.marcus.maxHealth = maxHealth;
          }
          // Trigger banter for Marcus damage/health changes
          this.handleMarcusHealthBanter(health, maxHealth);
        },
        onMarcusShieldChange: (shields, maxShields) => {
          this.updateMarcusShieldBar(shields, maxShields);
        },
        onStateChange: (newState, oldState) => {
          this.onMarcusCombatStateChange(newState, oldState);
        },
        onCoordinatedAttack: (attack) => {
          this.onCoordinatedAttackStarted(attack);
        },
        onNotification: (text, duration) => {
          this.callbacks.onNotification(text, duration);
        },
        onMarcusDowned: () => {
          this.onMarcusDowned();
        },
        onMarcusRevived: () => {
          this.onMarcusRevived();
        },
      },
      {
        maxHealth: 500,
        damage: 50,
        fireRate: 2.5,
        range: 80,
        moveSpeed: 12,
        rotationSpeed: 2,
        repairRate: 8,
        lowHealthThreshold: 0.4,
        criticalHealthThreshold: 0.15,
      }
    );

    // Create Marcus's health bar (floating above mech)
    this.createMarcusHealthBar(root);

    // Initialize the Marcus banter system for situation-aware dialogue
    this.marcusBanterManager = createMarcusBanterManager(
      (message) => this.callbacks.onCommsMessage(message),
      {
        globalCooldown: 4000, // 4 seconds between dialogue to not overwhelm
        banterChance: 0.35, // 35% chance for optional banter
        allowInterrupts: true,
      }
    );
  }

  /**
   * Create a health bar that floats above Marcus
   */
  private createMarcusHealthBar(root: TransformNode): void {
    // Background bar
    this.marcusHealthBar = MeshBuilder.CreatePlane(
      'marcusHealthBarBg',
      { width: 4, height: 0.4 },
      this.scene
    );
    this.marcusHealthBar.parent = root;
    this.marcusHealthBar.position.y = 10;
    this.marcusHealthBar.billboardMode = 7; // Always face camera

    const bgMat = new StandardMaterial('healthBarBgMat', this.scene);
    bgMat.diffuseColor = new Color3(0.2, 0.2, 0.2);
    bgMat.emissiveColor = new Color3(0.1, 0.1, 0.1);
    bgMat.disableLighting = true;
    this.marcusHealthBar.material = bgMat;

    // Shield bar (above health bar)
    this.marcusShieldBar = MeshBuilder.CreatePlane(
      'marcusShieldBarBg',
      { width: 4, height: 0.2 },
      this.scene
    );
    this.marcusShieldBar.parent = this.marcusHealthBar;
    this.marcusShieldBar.position.y = 0.35;

    const shieldBgMat = new StandardMaterial('shieldBarBgMat', this.scene);
    shieldBgMat.diffuseColor = new Color3(0.15, 0.15, 0.25);
    shieldBgMat.emissiveColor = new Color3(0.05, 0.05, 0.15);
    shieldBgMat.disableLighting = true;
    this.marcusShieldBar.material = shieldBgMat;

    // Shield fill
    this.marcusShieldBarFill = MeshBuilder.CreatePlane(
      'marcusShieldBarFill',
      { width: 3.9, height: 0.15 },
      this.scene
    );
    this.marcusShieldBarFill.parent = this.marcusShieldBar;
    this.marcusShieldBarFill.position.z = -0.01;

    const shieldFillMat = new StandardMaterial('shieldBarFillMat', this.scene);
    shieldFillMat.diffuseColor = Color3.FromHexString('#4A9FFF');
    shieldFillMat.emissiveColor = Color3.FromHexString('#2A6FAF');
    shieldFillMat.disableLighting = true;
    this.marcusShieldBarFill.material = shieldFillMat;

    // Health fill bar
    this.marcusHealthBarFill = MeshBuilder.CreatePlane(
      'marcusHealthBarFill',
      { width: 3.9, height: 0.35 },
      this.scene
    );
    this.marcusHealthBarFill.parent = this.marcusHealthBar;
    this.marcusHealthBarFill.position.z = -0.01; // Slightly in front

    const fillMat = new StandardMaterial('healthBarFillMat', this.scene);
    fillMat.diffuseColor = Color3.FromHexString('#4AFF4A');
    fillMat.emissiveColor = Color3.FromHexString('#2A9F2A');
    fillMat.disableLighting = true;
    this.marcusHealthBarFill.material = fillMat;

    // Downed indicator (hidden by default)
    this.marcusDownedIndicator = MeshBuilder.CreatePlane(
      'marcusDownedIndicator',
      { width: 5, height: 1 },
      this.scene
    );
    this.marcusDownedIndicator.parent = root;
    this.marcusDownedIndicator.position.y = 11;
    this.marcusDownedIndicator.billboardMode = 7;
    this.marcusDownedIndicator.visibility = 0;

    const downedMat = new StandardMaterial('downedIndicatorMat', this.scene);
    downedMat.diffuseColor = Color3.FromHexString('#FF4444');
    downedMat.emissiveColor = Color3.FromHexString('#FF2222');
    downedMat.disableLighting = true;
    this.marcusDownedIndicator.material = downedMat;
  }

  /**
   * Update Marcus's shield bar display
   */
  private updateMarcusShieldBar(shields: number, maxShields: number): void {
    if (!this.marcusShieldBarFill) return;

    const percent = shields / maxShields;
    this.marcusShieldBarFill.scaling.x = Math.max(0.01, percent);
    this.marcusShieldBarFill.position.x = (1 - percent) * -1.95;

    // Change opacity based on shield level
    const mat = this.marcusShieldBarFill.material as StandardMaterial;
    if (percent <= 0) {
      mat.alpha = 0.3; // Dim when depleted
    } else {
      mat.alpha = 0.8 + percent * 0.2;
    }
  }

  /**
   * Handle Marcus being downed
   */
  private onMarcusDowned(): void {
    // Show downed indicator with pulsing animation
    if (this.marcusDownedIndicator) {
      this.marcusDownedIndicator.visibility = 1;
      this.animateDownedIndicator();
    }

    // Update objective to show Marcus is down
    this.callbacks.onObjectiveUpdate('HAMMER DOWN', 'Stay close to Marcus to help him recover!');
  }

  /**
   * Handle Marcus reviving
   */
  private onMarcusRevived(): void {
    // Hide downed indicator
    if (this.marcusDownedIndicator) {
      this.marcusDownedIndicator.visibility = 0;
    }

    // Restore objective
    const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead').length;
    if (aliveEnemies > 0) {
      this.callbacks.onObjectiveUpdate(
        OBJECTIVES.WAVE_COMBAT.getTitle(this.currentWave + 1, WAVES.length),
        OBJECTIVES.WAVE_COMBAT.getDescription(this.totalKills)
      );
    }
  }

  /**
   * Animate the downed indicator with pulsing effect
   */
  private animateDownedIndicator(): void {
    if (!this.marcusDownedIndicator || this.marcusDownedIndicator.visibility === 0) return;

    const mat = this.marcusDownedIndicator.material as StandardMaterial;
    const time = performance.now() * 0.005;
    const pulse = 0.7 + Math.sin(time) * 0.3;
    mat.alpha = pulse;

    // Also update position based on recovery progress
    if (this.marcusCombatAI?.isDowned()) {
      const progress = this.marcusCombatAI.getDownedRecoveryProgress();
      // Scale the indicator to show recovery progress
      this.marcusDownedIndicator.scaling.x = 1 - progress * 0.5;

      requestAnimationFrame(() => this.animateDownedIndicator());
    }
  }

  /**
   * Update Marcus's health bar display
   */
  private updateMarcusHealthBar(health: number, maxHealth: number): void {
    if (!this.marcusHealthBarFill) return;

    const percent = health / maxHealth;
    this.marcusHealthBarFill.scaling.x = percent;
    this.marcusHealthBarFill.position.x = (1 - percent) * -1.95;

    // Change color based on health
    const mat = this.marcusHealthBarFill.material as StandardMaterial;
    if (percent > 0.6) {
      mat.diffuseColor = Color3.FromHexString('#4AFF4A');
      mat.emissiveColor = Color3.FromHexString('#2A9F2A');
    } else if (percent > 0.3) {
      mat.diffuseColor = Color3.FromHexString('#FFAA00');
      mat.emissiveColor = Color3.FromHexString('#AA6600');
    } else {
      mat.diffuseColor = Color3.FromHexString('#FF4444');
      mat.emissiveColor = Color3.FromHexString('#AA2222');
    }
  }

  /**
   * Handle Marcus health changes for banter triggers
   * This creates emotional reactions to Marcus being hurt
   */
  private handleMarcusHealthBanter(health: number, maxHealth: number): void {
    if (!this.marcusBanterManager) return;

    const healthPercent = health / maxHealth;
    const damage = this.previousMarcusHealth - health;

    // Check for damage taken
    if (damage > 0) {
      this.marcusBanterManager.onMarcusTakeDamage(damage, healthPercent);
    }

    // Check for recovery (health increased)
    if (
      health > this.previousMarcusHealth &&
      this.previousMarcusHealthPercent <= 0.4 &&
      healthPercent > 0.5
    ) {
      this.marcusBanterManager.onMarcusRecovered();
    }

    // Update previous values
    this.previousMarcusHealth = health;
    this.previousMarcusHealthPercent = healthPercent;
  }

  /**
   * Handle Marcus combat state changes
   */
  private onMarcusCombatStateChange(
    newState: MarcusCombatState,
    oldState: MarcusCombatState
  ): void {
    // Update the legacy marcus state to reflect AI state
    if (this.marcus) {
      switch (newState) {
        case 'idle':
        case 'support':
          this.marcus.state = 'patrol';
          break;
        case 'assault':
        case 'defensive':
        case 'suppression':
          this.marcus.state = 'combat';
          break;
        case 'damaged':
        case 'repairing':
        case 'downed':
          this.marcus.state = 'combat'; // Still in combat, just damaged/downed
          break;
      }
    }

    // Show notification for significant state changes
    if (newState === 'repairing') {
      this.callbacks.onNotification('HAMMER REPAIRING', 2000);
    } else if (newState === 'downed') {
      this.callbacks.onNotification('HAMMER IS DOWN!', 3000);
    } else if (oldState === 'repairing') {
      // Exited repairing state (newState is guaranteed to not be 'repairing' in this branch)
      this.callbacks.onNotification('HAMMER BACK ONLINE', 2000);
    } else if (oldState === 'downed') {
      // Recovered from downed state
      this.callbacks.onNotification('HAMMER BACK ONLINE!', 2000);
    }
  }

  /**
   * Handle coordinated attack notifications
   */
  private onCoordinatedAttackStarted(attack: { type: string; targetPosition: Vector3 }): void {
    // Visual indicator for coordinated attacks
    switch (attack.type) {
      case 'focus_fire':
        this.callbacks.onNotification('FOCUS FIRE', 1500);
        break;
      case 'flank':
        this.callbacks.onNotification('FLANKING MANEUVER', 1500);
        break;
      case 'suppress':
        this.callbacks.onNotification('SUPPRESSION FIRE', 1500);
        break;
      case 'cover_player':
        this.callbacks.onNotification('COVERING FIRE', 1500);
        break;
    }
  }

  private updateMarcus(deltaTime: number): void {
    if (!this.marcus) return;

    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    // Use the advanced Combat AI system during combat phases
    if (
      this.marcusCombatAI &&
      (this.phase === 'wave_combat' || this.phase === 'breach_battle') &&
      this.marcus.state !== 'dialogue'
    ) {
      // Convert ActiveEnemy[] to Entity[] for the combat AI
      const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead').map((e) => e.entity);

      // Pass player forward direction for tactical awareness
      const playerForward = this.camera.getDirection(Vector3.Forward());
      this.marcusCombatAI.update(deltaTime, playerPos, aliveEnemies, playerForward);

      // Sync position from Combat AI back to legacy marcus struct
      this.marcus.position = this.marcusCombatAI.getPosition();
      this.marcus.health = this.marcusCombatAI.getHealth();
      this.marcus.rootNode.position = this.marcus.position.clone();

      // Walking animation based on movement
      const time = performance.now() * 0.003;
      const aiState = this.marcusCombatAI.getState();
      if (aiState !== 'repairing') {
        this.marcus.legs.position.y = 3 + Math.sin(time) * 0.15;
      }

      return;
    }

    // Fallback to legacy behavior for dialogue/cinematic phases
    switch (this.marcus.state) {
      case 'dialogue':
        // Just face player
        this.faceMarcusTowards(playerPos);
        break;

      case 'patrol':
        // Follow player loosely (stay ~20m away)
        this.marcusFollowPlayer(deltaTime);
        break;

      case 'combat':
        // Target enemies >15m from player, provide covering fire
        this.marcusCombat(deltaTime);
        break;
    }

    // Update root position
    this.marcus.rootNode.position = this.marcus.position.clone();

    // Walking animation when moving
    const time = performance.now() * 0.003;
    if (this.marcus.state !== 'dialogue') {
      this.marcus.legs.position.y = 3 + Math.sin(time) * 0.15;
    }
  }

  private faceMarcusTowards(target: Vector3): void {
    if (!this.marcus) return;

    const direction = target.subtract(this.marcus.position);
    direction.y = 0;

    if (direction.length() > 0.1) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.marcus.rootNode.rotation.y = targetRotation;
    }
  }

  private marcusFollowPlayer(deltaTime: number): void {
    if (!this.marcus) return;

    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    const toPlayer = playerPos.subtract(this.marcus.position);
    const distance = toPlayer.length();

    // Stay between 15-25m from player
    if (distance > 25) {
      toPlayer.normalize();
      this.marcus.position.addInPlace(toPlayer.scale(10 * deltaTime));
      this.faceMarcusTowards(playerPos);
    } else if (distance < 15) {
      toPlayer.normalize();
      this.marcus.position.subtractInPlace(toPlayer.scale(5 * deltaTime));
    }

    // Keep Marcus in arena bounds
    this.marcus.position.x = Math.max(
      -ARENA_WIDTH / 2 + 10,
      Math.min(ARENA_WIDTH / 2 - 10, this.marcus.position.x)
    );
    this.marcus.position.z = Math.max(
      -ARENA_DEPTH / 2 + 10,
      Math.min(ARENA_DEPTH / 2 - 10, this.marcus.position.z)
    );
  }

  private marcusCombat(deltaTime: number): void {
    if (!this.marcus) return;

    // Find enemy >15m from player to target
    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    let bestTarget: ActiveEnemy | null = null;
    let bestDistance = Infinity;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const enemyPos = enemy.mesh.position.clone();
      enemyPos.y = 0;

      const distToPlayer = Vector3.Distance(enemyPos, playerPos);
      const distToMarcus = Vector3.Distance(enemyPos, this.marcus.position);

      // Only target enemies >15m from player that are in range
      if (distToPlayer > 15 && distToMarcus < this.marcus.range && distToMarcus < bestDistance) {
        bestDistance = distToMarcus;
        bestTarget = enemy;
      }
    }

    if (bestTarget) {
      // Face and fire at target
      this.faceMarcusTowards(bestTarget.mesh.position);
      this.marcusFire(bestTarget);
    } else {
      // No valid target, follow player
      this.marcusFollowPlayer(deltaTime);
    }
  }

  private marcusFire(target: ActiveEnemy): void {
    if (!this.marcus) return;

    const now = performance.now();
    const fireInterval = 1000 / this.marcus.fireRate;

    if (now - this.marcus.lastFireTime < fireInterval) return;
    this.marcus.lastFireTime = now;

    // Create projectile from both arms
    const arms = [this.marcus.leftArm, this.marcus.rightArm];

    for (const arm of arms) {
      const startPos = arm.absolutePosition.clone();
      startPos.y -= 2;

      const direction = target.mesh.position.subtract(startPos).normalize();
      const velocity = direction.scale(60);

      // Create projectile mesh
      const projectile = MeshBuilder.CreateSphere(
        'marcusProjectile',
        { diameter: 0.6 },
        this.scene
      );
      projectile.position = startPos;

      const projMat = new StandardMaterial('marcusProjMat', this.scene);
      projMat.emissiveColor = Color3.FromHexString(tokens.colors.accent.brass);
      projMat.disableLighting = true;
      projectile.material = projMat;

      // Arm recoil
      const originalZ = arm.rotation.z;
      arm.rotation.z += arm.position.x < 0 ? 0.15 : -0.15;
      setTimeout(() => {
        if (this.marcus) {
          arm.rotation.z = arm.position.x < 0 ? 0.3 : -0.3;
        }
      }, 100);

      // Create projectile entity
      const projEntity = createEntity({
        transform: {
          position: startPos.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: velocity,
          angular: Vector3.Zero(),
          maxSpeed: 60,
        },
        renderable: {
          mesh: projectile,
          visible: true,
        },
        tags: {
          projectile: true,
          ally: true,
        },
        lifetime: {
          remaining: 3000,
          onExpire: () => {
            projectile.material?.dispose();
            projectile.dispose();
          },
        },
      });

      // Check collision with target after short delay
      setTimeout(() => {
        if (target.state !== 'dead') {
          const dist = Vector3.Distance(projectile.position, target.mesh.position);
          if (dist < target.mesh.scaling.x + 1) {
            target.health -= this.marcus!.damage;
            if (target.health <= 0) {
              this.killEnemy(target, true); // Marcus kill
            }
          }
        }
        projectile.material?.dispose();
        projectile.dispose();
        removeEntity(projEntity);
      }, 500);
    }
  }

  // ============================================================================
  // ENEMY MANAGEMENT
  // ============================================================================

  private spawnEnemy(type: EnemyType, position: Vector3): ActiveEnemy {
    const config = ENEMY_CONFIGS[type];

    // Create enemy mesh based on type
    let mesh: Mesh;

    switch (type) {
      case 'drone':
        mesh = MeshBuilder.CreateSphere(
          `drone_${Date.now()}`,
          { diameter: config.size },
          this.scene
        );
        break;
      case 'grunt':
        mesh = MeshBuilder.CreateCapsule(
          `grunt_${Date.now()}`,
          { height: config.size, radius: config.size * 0.3 },
          this.scene
        );
        break;
      case 'spitter':
        mesh = MeshBuilder.CreateSphere(
          `spitter_${Date.now()}`,
          { diameterX: config.size, diameterY: config.size * 0.7, diameterZ: config.size },
          this.scene
        );
        break;
      case 'brute':
        mesh = MeshBuilder.CreateBox(
          `brute_${Date.now()}`,
          { width: config.size, height: config.size * 1.2, depth: config.size * 0.8 },
          this.scene
        );
        break;
      default:
        mesh = MeshBuilder.CreateSphere(
          `enemy_${Date.now()}`,
          { diameter: config.size },
          this.scene
        );
    }

    const mat = new StandardMaterial(`enemy_mat_${Date.now()}`, this.scene);
    mat.diffuseColor = Color3.FromHexString(config.color);
    mat.specularColor = new Color3(0.2, 0.2, 0.2);

    // Add glowing eyes for all enemy types
    const glowMat = new StandardMaterial(`enemy_glow_${Date.now()}`, this.scene);
    glowMat.emissiveColor = Color3.FromHexString('#4AFF9F');
    glowMat.disableLighting = true;

    // Add eyes
    const leftEye = MeshBuilder.CreateSphere('eye', { diameter: config.size * 0.1 }, this.scene);
    leftEye.material = glowMat;
    leftEye.parent = mesh;
    leftEye.position.set(-config.size * 0.15, config.size * 0.2, -config.size * 0.4);

    const rightEye = MeshBuilder.CreateSphere('eye', { diameter: config.size * 0.1 }, this.scene);
    rightEye.material = glowMat;
    rightEye.parent = mesh;
    rightEye.position.set(config.size * 0.15, config.size * 0.2, -config.size * 0.4);

    mesh.material = mat;
    mesh.position = position.clone();
    mesh.position.y = config.size / 2;

    // Spawn animation - scale up
    mesh.scaling.setAll(0.1);
    const spawnStart = performance.now();
    const animateSpawn = () => {
      const elapsed = performance.now() - spawnStart;
      const progress = Math.min(elapsed / 500, 1);
      mesh.scaling.setAll(0.1 + progress * 0.9);
      if (progress < 1) requestAnimationFrame(animateSpawn);
    };
    requestAnimationFrame(animateSpawn);

    const entity = createEntity({
      transform: {
        position: position.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      health: {
        current: config.health,
        max: config.health,
        regenRate: 0,
      },
      tags: {
        enemy: true,
      },
    });

    const enemy: ActiveEnemy = {
      entity,
      mesh,
      type,
      health: config.health,
      maxHealth: config.health,
      speed: config.speed,
      damage: config.damage,
      attackRange: config.attackRange,
      lastAttackTime: 0,
      targetPosition: this.camera.position.clone(),
      state: 'spawning',
    };

    setTimeout(() => {
      enemy.state = 'moving';
    }, 500);

    this.waveEnemies.push(enemy);
    return enemy;
  }

  private updateEnemies(deltaTime: number): void {
    const playerPos = this.camera.position.clone();
    const marcusPos = this.marcus?.position ?? playerPos;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      // Determine target - some enemies will prioritize Marcus
      const distToPlayer = Vector3.Distance(enemy.mesh.position, playerPos);
      const distToMarcus = Vector3.Distance(enemy.mesh.position, marcusPos);

      // Brutes always target Marcus, other enemies have a chance if Marcus is closer
      const shouldTargetMarcus =
        this.marcus &&
        this.marcusCombatAI &&
        (enemy.type === 'brute' || (distToMarcus < distToPlayer * 0.7 && Math.random() < 0.3));

      const targetPos = shouldTargetMarcus ? marcusPos : playerPos;
      enemy.targetPosition = targetPos.clone();

      const toTarget = enemy.targetPosition.subtract(enemy.mesh.position);
      toTarget.y = 0;
      const distance = toTarget.length();

      // Face target
      if (distance > 0.1) {
        const targetRotation = Math.atan2(toTarget.x, toTarget.z);
        enemy.mesh.rotation.y = targetRotation;
      }

      // Move or attack
      if (distance > enemy.attackRange) {
        // Move towards target
        enemy.state = 'moving';
        toTarget.normalize();
        enemy.mesh.position.addInPlace(toTarget.scale(enemy.speed * deltaTime));
      } else {
        // Attack target
        enemy.state = 'attacking';
        const now = performance.now();
        const attackInterval = enemy.type === 'spitter' ? 2000 : 1000;

        if (now - enemy.lastAttackTime > attackInterval) {
          enemy.lastAttackTime = now;

          if (shouldTargetMarcus && this.marcusCombatAI) {
            // Attack Marcus
            if (enemy.type === 'spitter') {
              this.spawnEnemyProjectileAtMarcus(enemy);
            } else {
              // Melee attack on Marcus - brutes deal 50% more damage
              const damage = enemy.damage * (enemy.type === 'brute' ? 1.5 : 1);
              this.marcusCombatAI.takeDamage(damage);
              this.lastMarcusDamageTime = now;
            }
          } else {
            // Attack player
            if (enemy.type === 'spitter') {
              this.spawnEnemyProjectile(enemy);
            } else {
              // Melee attack - direct damage
              this.playerHealth -= enemy.damage;
              this.callbacks.onHealthChange(this.playerHealth);
              this.callbacks.onDamage();
              this.triggerDamageShake(enemy.damage);

              if (this.playerHealth <= 0) {
                this.callbacks.onNotification('CRITICAL DAMAGE - MISSION FAILED', 3000);
              }
            }
          }
        }
      }

      // Update entity transform
      if (enemy.entity.transform) {
        enemy.entity.transform.position = enemy.mesh.position.clone();
      }
    }
  }

  /**
   * Spawn acid projectile targeting Marcus's mech
   */
  private spawnEnemyProjectileAtMarcus(enemy: ActiveEnemy): void {
    if (!this.marcus) return;

    const startPos = enemy.mesh.position.clone();
    startPos.y += 0.5;

    // Target Marcus's torso (higher up on the mech)
    const targetPos = this.marcus.position.clone();
    targetPos.y += 4;
    const direction = targetPos.subtract(startPos).normalize();
    const velocity = direction.scale(20);

    const projectile = MeshBuilder.CreateSphere('acidBoltMarcus', { diameter: 0.4 }, this.scene);
    projectile.position = startPos;

    const projMat = new StandardMaterial('acidMatMarcus', this.scene);
    projMat.emissiveColor = Color3.FromHexString('#AAFF00');
    projMat.disableLighting = true;
    projectile.material = projMat;

    const projEntity = createEntity({
      transform: {
        position: startPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: 20,
      },
      renderable: {
        mesh: projectile,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 3000,
        onExpire: () => {
          projectile.material?.dispose();
          projectile.dispose();
        },
      },
    });

    // Check collision with Marcus
    const checkCollision = () => {
      if (projectile.isDisposed() || !this.marcus || !this.marcusCombatAI) return;

      const dist = Vector3.Distance(projectile.position, this.marcus.position);
      if (dist < 4) {
        // Hit Marcus - apply damage
        this.marcusCombatAI.takeDamage(enemy.damage);
        this.lastMarcusDamageTime = performance.now();
        projectile.material?.dispose();
        projectile.dispose();
        removeEntity(projEntity);
        return;
      }

      // Update projectile position
      projectile.position.addInPlace(velocity.scale(0.016));

      if (!projectile.isDisposed()) {
        requestAnimationFrame(checkCollision);
      }
    };
    requestAnimationFrame(checkCollision);
  }

  private spawnEnemyProjectile(enemy: ActiveEnemy): void {
    const startPos = enemy.mesh.position.clone();
    startPos.y += 0.5;

    const direction = this.camera.position.subtract(startPos).normalize();
    const velocity = direction.scale(20);

    const projectile = MeshBuilder.CreateSphere('acidBolt', { diameter: 0.4 }, this.scene);
    projectile.position = startPos;

    const projMat = new StandardMaterial('acidMat', this.scene);
    projMat.emissiveColor = Color3.FromHexString('#AAFF00');
    projMat.disableLighting = true;
    projectile.material = projMat;

    // Track projectile for collision
    const projEntity = createEntity({
      transform: {
        position: startPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: 20,
      },
      renderable: {
        mesh: projectile,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 3000,
        onExpire: () => {
          projectile.material?.dispose();
          projectile.dispose();
        },
      },
    });

    // Check collision with player
    const checkCollision = () => {
      if (projectile.isDisposed()) return;

      const dist = Vector3.Distance(projectile.position, this.camera.position);
      if (dist < 1.5) {
        this.playerHealth -= enemy.damage;
        this.callbacks.onHealthChange(this.playerHealth);
        this.callbacks.onDamage();
        this.triggerDamageShake(enemy.damage);
        projectile.material?.dispose();
        projectile.dispose();
        removeEntity(projEntity);
        return;
      }

      // Update projectile position
      projectile.position.addInPlace(velocity.scale(0.016));

      if (!projectile.isDisposed()) {
        requestAnimationFrame(checkCollision);
      }
    };
    requestAnimationFrame(checkCollision);
  }

  private killEnemy(enemy: ActiveEnemy, killedByMarcus: boolean = false): void {
    if (enemy.state === 'dead') return;

    enemy.state = 'dead';
    this.totalKills++;
    this.callbacks.onKill();

    // Trigger banter for the kill
    if (this.marcusBanterManager) {
      if (killedByMarcus) {
        this.marcusBanterManager.onMarcusKill();
      } else {
        this.marcusBanterManager.onPlayerKill(enemy.type);
      }
    }

    // Death animation
    const startY = enemy.mesh.position.y;
    const startTime = performance.now();

    const animateDeath = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 300, 1);

      enemy.mesh.scaling.setAll(1 - progress);
      enemy.mesh.position.y = startY - progress * 0.5;

      if (progress < 1) {
        requestAnimationFrame(animateDeath);
      } else {
        enemy.mesh.dispose();
        removeEntity(enemy.entity);
      }
    };
    requestAnimationFrame(animateDeath);
  }

  // ============================================================================
  // WAVE MANAGEMENT
  // ============================================================================

  private startWave(waveIndex: number): void {
    if (waveIndex >= WAVES.length) {
      this.allWavesComplete = true;
      return;
    }

    const wave = WAVES[waveIndex];
    this.currentWave = waveIndex;
    this.waveComplete = false;

    // Send wave-specific dialogue using COMMS module
    const waveComms = [
      COMMS.WAVE_1_START,
      COMMS.WAVE_2_START,
      COMMS.WAVE_3_START,
      COMMS.WAVE_4_START,
    ];
    if (waveIndex < waveComms.length) {
      this.callbacks.onCommsMessage(waveComms[waveIndex]);
    }

    this.callbacks.onNotification(NOTIFICATIONS.WAVE_INCOMING(wave.id), 2000);
    this.callbacks.onObjectiveUpdate(
      OBJECTIVES.WAVE_COMBAT.getTitle(wave.id, WAVES.length),
      OBJECTIVES.WAVE_COMBAT.getDescription(this.totalKills)
    );

    // Set Marcus to combat mode
    if (this.marcus) {
      this.marcus.state = 'combat';
    }

    // Track starting enemy count for wave progress banter
    const totalWaveEnemies = wave.enemies.reduce((sum, e) => sum + e.count, 0);
    this.waveStartEnemyCount = totalWaveEnemies;

    // Notify banter system about wave start
    const isFinalWave = waveIndex === WAVES.length - 1;
    if (this.marcusBanterManager) {
      this.marcusBanterManager.onWaveStart(waveIndex + 1, isFinalWave);
    }

    // Spawn enemies
    let spawnIndex = 0;
    wave.enemies.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        const spawnPoint = wave.spawnPoints[spawnIndex % wave.spawnPoints.length];
        const offset = new Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
        const position = spawnPoint.add(offset);

        // Stagger spawns
        const spawnDelay = spawnIndex * 200;
        setTimeout(() => {
          const spawnedEnemy = this.spawnEnemy(type, position);

          // Trigger banter for special enemy types when they first spawn
          if (this.marcusBanterManager && i === 0) {
            if (type === 'brute') {
              this.marcusBanterManager.onEnemySpotted('brute', count);
            } else if (type === 'spitter') {
              this.marcusBanterManager.onEnemySpotted('spitter', count);
            } else if (type === 'drone' && count >= 5) {
              this.marcusBanterManager.onEnemySpotted('drone', count);
            }
          }
        }, spawnDelay);

        spawnIndex++;
      }
    });
  }

  private checkWaveComplete(): boolean {
    const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead');
    return aliveEnemies.length === 0 && !this.waveComplete;
  }

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  private startReunionPhase(): void {
    this.phase = 'reunion';
    this.phaseTime = 0;
    this.cinematicInProgress = true;

    // Unlock Reunited achievement - Marcus found!
    getAchievementManager().onMarcusFound();

    // Create and start the reunion cinematic
    this.reunionCinematic = new ReunionCinematic(
      this.scene,
      this.camera,
      {
        onCommsMessage: (message) => this.callbacks.onCommsMessage(message),
        onNotification: (text, duration) => this.callbacks.onNotification(text, duration),
        onObjectiveUpdate: (title, instructions) =>
          this.callbacks.onObjectiveUpdate(title, instructions),
        onCinematicStart: () => {
          this.callbacks.onCinematicStart?.();
          this.cinematicInProgress = true;
        },
        onCinematicEnd: () => {
          this.callbacks.onCinematicEnd?.();
          this.cinematicInProgress = false;
          // Transition to wave combat after cinematic
          this.startWaveCombatPhase();
        },
        onShakeCamera: (intensity) => this.triggerShake(intensity),
      },
      this.marcus?.rootNode ?? null
    );

    this.reunionCinematic.play();
  }

  private startWaveCombatPhase(): void {
    this.phase = 'wave_combat';
    this.phaseTime = 0;

    // Reset camera to gameplay position if coming from cinematic
    this.camera.position.set(0, 1.7, 50);
    this.rotationY = Math.PI;
    this.targetRotationY = Math.PI;
    this.camera.rotation.y = this.rotationY;
    this.camera.fov = 1.2;

    // Setup combat action buttons
    this.updateActionButtons('combat');

    // Notify gameplay transition
    this.callbacks.onNotification('COMBAT INITIATED', 2000);

    // Start first wave after short delay
    setTimeout(() => {
      this.startWave(0);
    }, 2000);
  }

  private startBreachBattlePhase(): void {
    this.phase = 'breach_battle';
    this.phaseTime = 0;

    this.callbacks.onNotification(NOTIFICATIONS.THE_BREACH, 3000);
    this.callbacks.onObjectiveUpdate(
      OBJECTIVES.BREACH_BATTLE.title,
      OBJECTIVES.BREACH_BATTLE.description
    );

    this.callbacks.onCommsMessage(COMMS.BREACH_APPROACH);

    // Final wave already completed - now player must enter breach
    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.BREACH_CLEARED);
    }, 3000);

    setTimeout(() => {
      this.startTransitionPhase();
    }, 6000);
  }

  private startTransitionPhase(): void {
    this.phase = 'transition';
    this.phaseTime = 0;
    this.cinematicInProgress = true;

    this.callbacks.onCinematicStart?.();
    this.callbacks.onObjectiveUpdate(
      OBJECTIVES.ENTER_BREACH.title,
      OBJECTIVES.ENTER_BREACH.description
    );

    // Marcus dialogue about not being able to follow
    this.callbacks.onCommsMessage(COMMS.TRANSITION_START);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.TRANSITION_FAREWELL);
    }, 4000);

    setTimeout(() => {
      this.callbacks.onCommsMessage(COMMS.TRANSITION_FINAL);
    }, 8000);

    setTimeout(() => {
      this.callbacks.onCinematicEnd?.();
      this.cinematicInProgress = false;

      // Update objective to enter breach
      this.callbacks.onNotification(NOTIFICATIONS.ENTER_THE_BREACH, 2000);
    }, 12000);
  }

  // ============================================================================
  // ACTION HANDLING
  // ============================================================================

  private handleAction(actionId: string): void {
    // Ignore actions during cinematics
    if (this.cinematicInProgress) return;

    switch (actionId) {
      case 'grenade':
        if (this.grenadeCooldown <= 0) {
          this.throwGrenade();
          this.grenadeCooldown = 5000;
        }
        break;

      case 'melee':
        this.meleeAttack();
        break;

      case 'call_marcus':
        if (this.fireSuportCooldown <= 0 && this.marcus) {
          this.callFireSupport();
          this.fireSuportCooldown = 30000;
        }
        break;

      case 'focus_fire':
        if (this.focusFireCooldown <= 0 && this.marcusCombatAI) {
          this.requestFocusFire();
          this.focusFireCooldown = 10000;
        }
        break;

      case 'flank':
        if (this.flankCooldown <= 0 && this.marcusCombatAI) {
          this.requestFlank();
          this.flankCooldown = 20000;
        }
        break;

      case 'marcus_aggressive':
        this.setMarcusCoordinationState('aggressive');
        break;

      case 'marcus_defensive':
        this.setMarcusCoordinationState('defensive');
        break;

      case 'marcus_support':
        this.setMarcusCoordinationState('support');
        break;
    }
  }

  /**
   * Request focus fire on nearest enemy
   */
  private requestFocusFire(): void {
    if (!this.marcusCombatAI) return;

    // Find the nearest enemy to player's crosshair direction
    const playerPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());

    let bestTarget: ActiveEnemy | null = null;
    let bestScore = -1;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const toEnemy = enemy.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();
      toEnemy.normalize();

      // Score based on alignment with crosshair and distance
      const alignment = Vector3.Dot(forward, toEnemy);
      const score = alignment * 100 - dist;

      if (alignment > 0.5 && score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    if (bestTarget) {
      const request = this.marcusCombatAI.requestFocusFire(bestTarget.entity);
      if (request) {
        this.callbacks.onNotification('FOCUS FIRE REQUESTED', 1500);
      }
    } else {
      this.callbacks.onNotification('NO TARGET IN SIGHT', 1000);
    }
  }

  /**
   * Request flanking maneuver
   */
  private requestFlank(): void {
    if (!this.marcusCombatAI) return;

    // Find highest threat enemy group
    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    const threatCenter = Vector3.Zero();
    let threatCount = 0;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const dist = Vector3.Distance(enemy.mesh.position, playerPos);
      if (dist < 50) {
        threatCenter.addInPlace(enemy.mesh.position);
        threatCount++;
      }
    }

    if (threatCount > 0) {
      threatCenter.scaleInPlace(1 / threatCount);
      const request = this.marcusCombatAI.requestFlank(threatCenter);
      if (request) {
        this.callbacks.onNotification('FLANKING MANEUVER', 1500);
      }
    }
  }

  /**
   * Set Marcus's coordination combat state
   */
  private setMarcusCoordinationState(state: CoordinationCombatState): void {
    if (!this.marcusCombatAI) return;

    this.marcusCoordinationState = state;
    this.marcusCombatAI.setCoordinationState(state);

    // Show notification
    const stateNames: Record<CoordinationCombatState, string> = {
      aggressive: 'AGGRESSIVE',
      defensive: 'DEFENSIVE',
      support: 'SUPPORT',
      damaged: 'DAMAGED',
    };
    this.callbacks.onNotification(`MARCUS: ${stateNames[state]} MODE`, 1500);
  }

  private throwGrenade(): void {
    this.callbacks.onNotification(NOTIFICATIONS.GRENADE_OUT, 1000);

    // Create grenade projectile
    const startPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());
    const throwVelocity = forward.scale(30).add(new Vector3(0, 10, 0));

    const grenade = MeshBuilder.CreateSphere('grenade', { diameter: 0.3 }, this.scene);
    grenade.position = startPos.add(forward.scale(1));

    const grenadeMat = new StandardMaterial('grenadeMat', this.scene);
    grenadeMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);
    grenade.material = grenadeMat;

    // Animate grenade flight
    const velocity = throwVelocity.clone();
    const gravity = new Vector3(0, -40, 0);
    const startTime = performance.now();

    const animateGrenade = () => {
      const dt = 0.016;
      velocity.addInPlace(gravity.scale(dt));
      grenade.position.addInPlace(velocity.scale(dt));

      // Ground collision
      if (grenade.position.y <= 0.3) {
        // Explode
        this.explodeGrenade(grenade.position.clone());
        grenade.dispose();
        return;
      }

      // Timeout after 3 seconds
      if (performance.now() - startTime > 3000) {
        this.explodeGrenade(grenade.position.clone());
        grenade.dispose();
        return;
      }

      requestAnimationFrame(animateGrenade);
    };
    requestAnimationFrame(animateGrenade);
  }

  private explodeGrenade(position: Vector3): void {
    // Explosion effect
    const explosion = MeshBuilder.CreateSphere('explosion', { diameter: 2 }, this.scene);
    explosion.position = position;

    const explosionMat = new StandardMaterial('explosionMat', this.scene);
    explosionMat.emissiveColor = Color3.FromHexString('#FF8800');
    explosionMat.disableLighting = true;
    explosion.material = explosionMat;

    // Damage enemies in radius
    const damageRadius = 10;
    const damage = 75;
    let grenadeKills = 0;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const dist = Vector3.Distance(enemy.mesh.position, position);
      if (dist < damageRadius) {
        const damageAmount = damage * (1 - dist / damageRadius);
        enemy.health -= damageAmount;

        if (enemy.health <= 0) {
          this.killEnemy(enemy);
          grenadeKills++;
        }
      }
    }

    // Trigger banter for grenade kills
    if (this.marcusBanterManager && grenadeKills > 0) {
      this.marcusBanterManager.onGrenadeKill(grenadeKills);
      if (grenadeKills >= 2) {
        this.marcusBanterManager.onMultiKill();
      }
    }

    // Animate explosion
    const startTime = performance.now();
    const animateExplosion = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / 500;

      if (progress < 1) {
        explosion.scaling.setAll(1 + progress * 4);
        explosionMat.alpha = 1 - progress;
        requestAnimationFrame(animateExplosion);
      } else {
        explosion.dispose();
      }
    };
    requestAnimationFrame(animateExplosion);
  }

  private meleeAttack(): void {
    this.callbacks.onNotification(NOTIFICATIONS.MELEE, 500);

    // Check for enemies in melee range
    const playerPos = this.camera.position.clone();
    const forward = this.camera.getDirection(Vector3.Forward());
    const meleeRange = 3;
    const meleeDamage = 50;

    for (const enemy of this.waveEnemies) {
      if (enemy.state === 'dead') continue;

      const toEnemy = enemy.mesh.position.subtract(playerPos);
      const dist = toEnemy.length();
      toEnemy.normalize();

      const dot = Vector3.Dot(forward, toEnemy);

      if (dist < meleeRange && dot > 0.5) {
        enemy.health -= meleeDamage;

        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
        break; // Only hit one enemy
      }
    }
  }

  private callFireSupport(): void {
    if (!this.marcus) return;

    this.callbacks.onNotification(NOTIFICATIONS.FIRE_SUPPORT_CALLED, 2000);

    this.callbacks.onCommsMessage({
      ...COMMS.WAVE_1_START,
      text: 'Covering fire! Get down!',
    });

    // Notify banter system about fire support
    if (this.marcusBanterManager) {
      this.marcusBanterManager.onFireSupportCalled();
    }

    // Marcus focuses fire on all visible enemies for 5 seconds
    const supportEndTime = performance.now() + 5000;
    const originalFireRate = this.marcus.fireRate;
    this.marcus.fireRate = 6; // Triple fire rate

    const supportLoop = () => {
      if (performance.now() < supportEndTime && this.marcus) {
        // Fire at any enemy
        for (const enemy of this.waveEnemies) {
          if (enemy.state !== 'dead') {
            this.marcusFire(enemy);
            break;
          }
        }
        setTimeout(supportLoop, 150);
      } else if (this.marcus) {
        this.marcus.fireRate = originalFireRate;
        // Notify banter system fire support is complete
        if (this.marcusBanterManager) {
          this.marcusBanterManager.onFireSupportComplete();
        }
      }
    };
    supportLoop();
  }

  private updateActionButtons(mode: 'combat' | 'none'): void {
    let groups: ActionButtonGroup[] = [];

    // Get keybindings for level-specific actions
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');
    const callMarcus = levelActionParams('callMarcus');
    // Level-specific coordination keys (not configurable)
    const focusFire = { key: 'KeyF', keyDisplay: 'F' };
    const flank = { key: 'KeyH', keyDisplay: 'H' };

    if (mode === 'combat') {
      groups = [
        {
          id: 'combat',
          position: 'right',
          buttons: [
            createAction('grenade', 'GRENADE', grenade.key, {
              keyDisplay: grenade.keyDisplay,
              cooldown: 5000,
              cooldownRemaining: this.grenadeCooldown,
            }),
            createAction('melee', 'MELEE', melee.key, {
              keyDisplay: melee.keyDisplay,
            }),
            createAction('call_marcus', 'FIRE SUPPORT', callMarcus.key, {
              keyDisplay: callMarcus.keyDisplay,
              cooldown: 30000,
              cooldownRemaining: this.fireSuportCooldown,
              variant: 'primary',
              enabled: !this.marcusCombatAI?.isDowned(),
            }),
          ],
        },
        {
          id: 'coordination',
          position: 'left',
          buttons: [
            createAction('focus_fire', 'FOCUS FIRE', focusFire.key, {
              keyDisplay: focusFire.keyDisplay,
              cooldown: 10000,
              cooldownRemaining: this.focusFireCooldown,
              variant: 'secondary',
              enabled: !this.marcusCombatAI?.isDowned(),
            }),
            createAction('flank', 'FLANK', flank.key, {
              keyDisplay: flank.keyDisplay,
              cooldown: 20000,
              cooldownRemaining: this.flankCooldown,
              variant: 'secondary',
              enabled: !this.marcusCombatAI?.isDowned(),
            }),
          ],
        },
        {
          id: 'marcus_stance',
          position: 'center',
          label: this.marcusCombatAI?.isDowned() ? 'MARCUS DOWN' : 'MARCUS STANCE',
          buttons: [
            createAction('marcus_aggressive', 'AGR', 'Digit1', {
              keyDisplay: '1',
              variant: this.marcusCoordinationState === 'aggressive' ? 'primary' : 'secondary',
              enabled:
                this.marcusCoordinationState !== 'damaged' && !this.marcusCombatAI?.isDowned(),
            }),
            createAction('marcus_defensive', 'DEF', 'Digit2', {
              keyDisplay: '2',
              variant: this.marcusCoordinationState === 'defensive' ? 'primary' : 'secondary',
              enabled:
                this.marcusCoordinationState !== 'damaged' && !this.marcusCombatAI?.isDowned(),
            }),
            createAction('marcus_support', 'SUP', 'Digit3', {
              keyDisplay: '3',
              variant: this.marcusCoordinationState === 'support' ? 'primary' : 'secondary',
              enabled:
                this.marcusCoordinationState !== 'damaged' && !this.marcusCombatAI?.isDowned(),
            }),
          ],
        },
      ];
    }

    this.callbacks.onActionGroupsChange(groups);
  }

  // ============================================================================
  // UPDATE & DISPOSE
  // ============================================================================

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    // Update cooldowns
    if (this.grenadeCooldown > 0) {
      this.grenadeCooldown = Math.max(0, this.grenadeCooldown - deltaTime * 1000);
    }
    if (this.fireSuportCooldown > 0) {
      this.fireSuportCooldown = Math.max(0, this.fireSuportCooldown - deltaTime * 1000);
    }
    if (this.focusFireCooldown > 0) {
      this.focusFireCooldown = Math.max(0, this.focusFireCooldown - deltaTime * 1000);
    }
    if (this.flankCooldown > 0) {
      this.flankCooldown = Math.max(0, this.flankCooldown - deltaTime * 1000);
    }

    // Sync Marcus coordination state from AI
    if (this.marcusCombatAI) {
      this.marcusCoordinationState = this.marcusCombatAI.getCoordinationState();
    }

    // Update action buttons to show cooldowns
    if (this.phase === 'wave_combat' || this.phase === 'breach_battle') {
      this.updateActionButtons('combat');
    }

    // Update Marcus
    this.updateMarcus(deltaTime);

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update Marcus banter system with combat awareness
    this.updateMarcusBanter(deltaTime);

    // Phase-specific updates
    switch (this.phase) {
      case 'reunion':
        // Handled by timers in startReunionPhase
        break;

      case 'wave_combat':
        // Check wave completion
        if (this.checkWaveComplete()) {
          this.waveComplete = true;

          if (this.currentWave < WAVES.length - 1) {
            // Wave complete, start rest period
            this.callbacks.onNotification(NOTIFICATIONS.WAVE_CLEARED(this.currentWave + 1), 2000);
            this.waveRestTimer = WAVE_REST_DURATION;

            // Wave completion dialogue using COMMS module
            const waveCompleteComms = [
              COMMS.WAVE_1_COMPLETE,
              COMMS.WAVE_2_COMPLETE,
              COMMS.WAVE_3_COMPLETE,
              COMMS.WAVE_4_COMPLETE,
            ];
            if (this.currentWave < waveCompleteComms.length) {
              this.callbacks.onCommsMessage(waveCompleteComms[this.currentWave]);
            }
          } else {
            // All waves complete
            this.allWavesComplete = true;
            this.callbacks.onNotification(NOTIFICATIONS.ALL_WAVES_CLEARED, 3000);
            this.callbacks.onCommsMessage(COMMS.WAVE_4_COMPLETE);

            // Trigger banter for all waves complete
            if (this.marcusBanterManager) {
              this.marcusBanterManager.onAllWavesComplete();
            }

            this.startBreachBattlePhase();
          }
        }

        // Handle rest period between waves
        if (this.waveComplete && !this.allWavesComplete) {
          this.waveRestTimer -= deltaTime * 1000;

          if (this.waveRestTimer <= 0) {
            this.startWave(this.currentWave + 1);
          } else {
            const secondsLeft = Math.ceil(this.waveRestTimer / 1000);
            if (secondsLeft % 10 === 0 || secondsLeft <= 5) {
              this.callbacks.onObjectiveUpdate(
                OBJECTIVES.NEXT_WAVE.getTitle(secondsLeft),
                OBJECTIVES.NEXT_WAVE.getDescription(this.totalKills)
              );
            }
          }
        }
        break;

      case 'breach_battle':
        // Handled by startBreachBattlePhase timer
        break;

      case 'transition': {
        // Check if player enters breach
        const playerPos = this.camera.position.clone();
        playerPos.y = 0;
        const distToBreach = Vector3.Distance(playerPos, BREACH_POSITION);

        if (distToBreach < BREACH_DIAMETER / 2 - 10) {
          // Player entered breach - complete level
          this.completeLevel();
        }
        break;
      }
    }

    // Animate breach glow
    if (this.breachGlow) {
      const time = performance.now() * 0.001;
      this.breachGlow.intensity = 1.5 + Math.sin(time * 2) * 0.5;
    }
  }

  /**
   * Update Marcus banter system with situation awareness
   */
  private updateMarcusBanter(deltaTime: number): void {
    if (!this.marcusBanterManager || this.cinematicInProgress) return;

    const now = performance.now();

    // Throttle banter updates to every 500ms for performance
    if (now - this.lastBanterUpdateTime < 500) return;
    this.lastBanterUpdateTime = now;

    // Track player health changes for banter
    if (this.playerHealth !== this.previousPlayerHealth) {
      this.marcusBanterManager.onPlayerHealthChange(
        this.playerHealth,
        100, // max health
        this.previousPlayerHealth
      );
      this.previousPlayerHealth = this.playerHealth;
    }

    // Only process combat-related banter during active combat phases
    if (this.phase !== 'wave_combat' && this.phase !== 'breach_battle') {
      return;
    }

    const aliveEnemies = this.waveEnemies.filter((e) => e.state !== 'dead');
    const playerPos = this.camera.position.clone();
    playerPos.y = 0;

    // Calculate wave progress for banter
    if (aliveEnemies.length > 0 && this.waveStartEnemyCount > 0) {
      this.marcusBanterManager.onWaveProgress(
        aliveEnemies.length,
        this.waveStartEnemyCount,
        this.currentWave + 1
      );
    }

    // Area cleared banter
    if (aliveEnemies.length === 0 && !this.waveComplete) {
      this.marcusBanterManager.onAreaCleared();
    }

    // Combat situation awareness - check for flanking/surrounded
    if (aliveEnemies.length >= 3) {
      const forward = this.camera.getDirection(Vector3.Forward());
      let enemiesInFront = 0;
      let enemiesBehind = 0;

      for (const enemy of aliveEnemies) {
        const toEnemy = enemy.mesh.position.subtract(playerPos).normalize();
        const dot = Vector3.Dot(forward, toEnemy);

        if (dot > 0.3) {
          enemiesInFront++;
        } else if (dot < -0.3) {
          enemiesBehind++;
        }
      }

      this.marcusBanterManager.onCombatSituation(
        enemiesInFront,
        enemiesBehind,
        aliveEnemies.length
      );
    }

    // Check proximity to breach for contextual dialogue
    const distToBreach = Vector3.Distance(playerPos, BREACH_POSITION);
    if (distToBreach < BREACH_DIAMETER * 0.75 && this.phase === 'breach_battle') {
      this.marcusBanterManager.onNearBreach();
    }

    // First time seeing the breach - story moment
    if (!this.hasSeenBreach && distToBreach < BREACH_DIAMETER * 1.2) {
      this.hasSeenBreach = true;
      this.marcusBanterManager.onViewingBreachFirst();
    }

    // Defending position trigger - when near Marcus's original spot
    if (!this.hasTriggeredDefendingPosition && this.marcus) {
      const distToMarcusStart = Vector3.Distance(playerPos, MARCUS_START_POSITION);
      if (distToMarcusStart < 20) {
        this.hasTriggeredDefendingPosition = true;
        this.marcusBanterManager.onDefendingPosition();
      }
    }

    // Near canyon walls - cover advice
    const distToWallEast = Math.abs(playerPos.x - ARENA_WIDTH / 2);
    const distToWallWest = Math.abs(playerPos.x + ARENA_WIDTH / 2);
    if (distToWallEast < 15 || distToWallWest < 15) {
      this.marcusBanterManager.onNearCanyonWall();
    }

    // Trigger idle banter during rest periods between waves
    if (this.waveComplete && !this.allWavesComplete && this.waveRestTimer > 5000) {
      // Use extended idle for longer lulls to get deeper emotional moments
      if (this.waveRestTimer > 15000) {
        this.marcusBanterManager.onExtendedIdle();
      } else {
        this.marcusBanterManager.onIdleUpdate();
      }
    }

    // Occasional mech commentary during combat lulls
    if (aliveEnemies.length === 0 && !this.waveComplete && Math.random() < 0.01) {
      this.marcusBanterManager.onCommentOnMech();
    }
  }

  override canTransitionTo(levelId: LevelId): boolean {
    return levelId === 'the_breach' && this.phase === 'transition';
  }

  protected disposeLevel(): void {
    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    // Dispose cinematic
    this.reunionCinematic?.dispose();
    this.reunionCinematic = null;

    // Dispose banter manager
    this.marcusBanterManager?.reset();
    this.marcusBanterManager = null;

    // Dispose Marcus Combat AI
    this.marcusCombatAI?.dispose();
    this.marcusCombatAI = null;

    // Dispose Marcus
    this.marcus?.rootNode.dispose();

    // Dispose enemies
    this.waveEnemies.forEach((enemy) => {
      if (!enemy.mesh.isDisposed()) {
        enemy.mesh.dispose();
      }
      removeEntity(enemy.entity);
    });
    this.waveEnemies = [];

    // Dispose environment
    this.terrain?.dispose();
    this.canyonWalls.forEach((w) => w.dispose());
    this.rockPillars.forEach((p) => p.dispose());
    this.breachMesh?.dispose();
    this.breachGlow?.dispose();
    this.skyDome?.dispose();
  }
}
