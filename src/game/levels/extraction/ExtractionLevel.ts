/**
 * ExtractionLevel - Escape Sequence and Final Holdout
 *
 * After killing the Queen, the player must escape the collapsing hive
 * and hold out at LZ Omega until the dropship arrives.
 *
 * FIVE DISTINCT PHASES:
 *
 * PHASE 1: ESCAPE (3-4 minutes)
 * - 3:00 countdown timer (visible)
 * - Collapsing tunnels behind player
 * - Falling debris (damage zones)
 * - Light at end = surface exit
 * - Chase mechanic - wall of collapse follows
 *
 * PHASE 2: SURFACE RUN (2-3 minutes)
 * - 500m to LZ Omega
 * - Marcus's mech providing cover
 * - Chitin pouring from breach holes
 * - Run toward LZ beacon
 *
 * PHASE 3: HOLDOUT (5-7 minutes)
 * - 7:00 dropship ETA countdown
 * - Wave combat (7 waves with escalating difficulty)
 *   - Wave 1: Skitterer Swarm (fast scouts)
 *   - Wave 2: Lurker Assault (heavy infantry)
 *   - Wave 3: Acid Rain (spitter focus)
 *   - Wave 4: Combined Arms (mixed force)
 *   - Wave 5: Heavy Assault (broodmother intro)
 *   - Wave 6: Screaming Death (husk swarm)
 *   - Wave 7: Final Assault (everything)
 * - Marcus's mech taking progressive damage
 * - Supply drops between waves (health/ammo)
 *
 * PHASE 4: HIVE COLLAPSE (45-90 seconds)
 * - Entire hive structure collapsing beneath the surface
 * - Ground cracking with glowing fissures
 * - Hive eruptions burst from the ground
 * - Intense debris falling everywhere
 * - Progressive shake intensity
 * - Countdown to reach hovering dropship
 * - Marcus provides covering fire during escape
 *
 * PHASE 5: VICTORY
 * - Dropship boarding
 * - Marcus's mech collapses (out of power)
 * - Brothers reunited
 * - Brief epilogue
 * - Credits option
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { getAchievementManager } from '../../achievements';
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import { ALIEN_SPECIES, createAlienMesh } from '../../entities/aliens';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { saveSystem } from '../../persistence/SaveSystem';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';

import '@babylonjs/core/Animations/animatable';
import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';

type ExtractionPhase =
  | 'escape_start' // Initial orientation after Queen kill
  | 'escape_tunnel' // Running through collapsing tunnels
  | 'surface_run' // Running 500m to LZ Omega
  | 'holdout' // Wave-based defense
  | 'hive_collapse' // Final hive collapse after holdout - escape to dropship
  | 'victory' // Dropship arrival and extraction
  | 'epilogue'; // Post-mission epilogue

interface Enemy {
  mesh: TransformNode;
  health: number;
  maxHealth: number;
  position: Vector3;
  velocity: Vector3;
  species: string;
  isActive: boolean;
}

interface DebrisChunk {
  mesh: Mesh;
  velocity: Vector3;
  rotationSpeed: Vector3;
  lifetime: number;
}

// Hive collapse visual elements
interface CollapseEffect {
  mesh: Mesh;
  startPosition: Vector3;
  endPosition: Vector3;
  progress: number;
  speed: number;
  type: 'ground_crack' | 'hive_eruption' | 'falling_structure';
}

interface WaveConfig {
  drones: number;
  grunts: number;
  spitters: number;
  brutes: number;
  spawnDelay: number;
  // New fields for enhanced wave system
  waveTitle: string;
  waveDescription: string;
  commsMessage?: {
    sender: string;
    callsign: string;
    portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
    text: string;
  };
}

// Wave state machine phases
type WavePhase =
  | 'waiting' // Waiting for holdout to start
  | 'announcement' // Wave announcement phase (3s)
  | 'active' // Wave in progress
  | 'intermission'; // Between waves countdown

export class ExtractionLevel extends BaseLevel {
  // Phase management
  private phase: ExtractionPhase = 'escape_start';
  private phaseTime = 0;

  // Timer systems
  private escapeTimer = 180; // 3:00 countdown for escape
  private dropshipETA = 420; // 7:00 countdown for holdout (7 waves)

  // Collapse chase mechanics
  private collapseDistance = 0; // How far the collapse wall has traveled
  private playerEscapeProgress = 0; // Player's progress through escape tunnel (0-1)
  private readonly escapeTunnelLength = 300; // 300m tunnel

  // Surface run
  private distanceToLZ = 500; // 500m to LZ Omega
  private readonly lzPosition = new Vector3(0, 0, -500);

  // Marcus's Mech
  private mechIntegrity = 100;
  private mechMesh: TransformNode | null = null;
  private mechGunLight: PointLight | null = null;
  private mechFireTimer = 0;
  private readonly mechFireRate = 0.2; // Fires every 200ms

  // Wave combat state machine
  private currentWave = 0;
  private wavePhase: WavePhase = 'waiting';
  private wavePhaseTimer = 0;
  private waveEnemiesRemaining = 0;
  private waveEnemiesKilled = 0;
  private waveSpawnTimer = 0;
  private enemiesToSpawn: { species: string; count: number }[] = [];
  private enemies: Enemy[] = [];
  private readonly maxEnemies = 40;

  // Intermission timer settings
  private readonly waveAnnouncementDuration = 3; // 3 seconds for wave announcement
  private readonly waveIntermissionDuration = 8; // 8 seconds between waves
  private intermissionCountdown = 0;

  // Total number of waves in the holdout sequence
  private readonly totalWaves = 7;

  // Wave configurations - 7 waves with escalating difficulty and variety
  private readonly waveConfigs: WaveConfig[] = [
    // Wave 1: Skitterer swarm - fast but weak, teaches basic combat
    {
      drones: 10,
      grunts: 0,
      spitters: 0,
      brutes: 0,
      spawnDelay: 0.9,
      waveTitle: 'WAVE 1 - SKITTERER SWARM',
      waveDescription: 'Fast-moving scouts. Keep moving!',
      commsMessage: {
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: 'First wave incoming! Skitterers - aim for center mass and keep them off the perimeter!',
      },
    },
    // Wave 2: Lurkers - slower but tougher, teaches prioritization
    {
      drones: 0,
      grunts: 8,
      spitters: 0,
      brutes: 0,
      spawnDelay: 1.3,
      waveTitle: 'WAVE 2 - LURKER ASSAULT',
      waveDescription: 'Heavy infantry. Prioritize headshots.',
      commsMessage: {
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "Lurkers! They're tougher - go for the weak points on their backs!",
      },
    },
    // Wave 3: Spitter focus - teaches positioning and dodging acid
    {
      drones: 4,
      grunts: 2,
      spitters: 6,
      brutes: 0,
      spawnDelay: 1.1,
      waveTitle: 'WAVE 3 - ACID RAIN',
      waveDescription: 'Spitters incoming! Use cover and stay mobile!',
      commsMessage: {
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Warning: Acid Spewer signatures detected. Recommend utilizing cover positions.',
      },
    },
    // Wave 4: Combined arms - mixed force tests all skills
    {
      drones: 6,
      grunts: 6,
      spitters: 3,
      brutes: 0,
      spawnDelay: 1.0,
      waveTitle: 'WAVE 4 - COMBINED ARMS',
      waveDescription: 'Mixed force assault. Watch all angles!',
      commsMessage: {
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "Titan's shields just failed! They're hitting us from all sides - prioritize the spitters!",
      },
    },
    // Wave 5: Broodmother introduction - mini-boss wave
    {
      drones: 4,
      grunts: 4,
      spitters: 2,
      brutes: 2,
      spawnDelay: 1.0,
      waveTitle: 'WAVE 5 - HEAVY ASSAULT',
      waveDescription: 'Broodmothers detected! Focus fire on the big ones!',
      commsMessage: {
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Warning: STRAIN-X5 Broodmother signatures detected. These are priority targets.',
      },
    },
    // Wave 6: Husk swarm - terrifying screaming wave, high pressure
    {
      drones: 8,
      grunts: 0,
      spitters: 4,
      brutes: 1,
      spawnDelay: 0.6,
      waveTitle: 'WAVE 6 - SCREAMING DEATH',
      waveDescription: 'Husks! Their screams disorient - stay focused!',
      commsMessage: {
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: 'What the hell is that sound?! Husks! Cover your ears and keep shooting, brother!',
      },
    },
    // Wave 7: Final overwhelming wave - everything at once
    {
      drones: 14,
      grunts: 10,
      spitters: 6,
      brutes: 3,
      spawnDelay: 0.35,
      waveTitle: 'WAVE 7 - FINAL ASSAULT',
      waveDescription: 'EVERYTHING THEY HAVE! HOLD THE LINE!',
      commsMessage: {
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "This is it, brother! Everything they've got! Autocannons are overheating but I'll give you everything I have left! HOLD THE LINE!",
      },
    },
  ];

  // Environment - Escape Tunnel
  private tunnelSegments: Mesh[] = [];
  private tunnelLights: PointLight[] = [];
  private collapseWall: Mesh | null = null;
  private exitLight: PointLight | null = null;
  private debris: DebrisChunk[] = [];

  // Environment - Surface
  private terrain: Mesh | null = null;
  private skyDome: Mesh | null = null;
  private lzPad: Mesh | null = null;
  private lzBeacon: Mesh | null = null;
  private breachHoles: Mesh[] = [];
  private canyonWalls: Mesh[] = [];
  private barrierWalls: Mesh[] = [];

  // Environment - Dropship
  private dropship: TransformNode | null = null;
  private dropshipLight: PointLight | null = null;
  private dropshipRamp: Mesh | null = null;
  private dropshipRampLight: PointLight | null = null;
  private dropshipEngineSound: { stop: () => void } | null = null;
  private dropshipThrustEmitters: TransformNode[] = [];
  private boardingMarker: Mesh | null = null;
  private boardingBeacon: PointLight | null = null;
  private slowMoActive = false;
  private slowMoTimeScale = 1.0;
  private engineThrustInterval: ReturnType<typeof setInterval> | null = null;

  // Player stats
  private playerHealth = 100;
  private kills = 0;

  // Action button callback reference
  private actionCallback: ((actionId: string) => void) | null = null;

  // Cooldown tracking
  private grenadeCooldown = 0;
  private flareCooldown = 0;
  private readonly grenadeCooldownTime = 5000;
  private readonly flareCooldownTime = 60000;

  // Hive collapse sequence state
  private hiveCollapseTimer = 45; // 45 seconds to reach dropship during collapse
  private collapseIntensity = 0; // Grows from 0 to 1 during collapse
  private collapseEffects: CollapseEffect[] = [];
  private collapseDebrisTimer = 0;
  private hiveEruptionMeshes: Mesh[] = [];
  private groundCracks: Mesh[] = [];
  private collapseLight: PointLight | null = null;
  private distanceToDropship = 0;
  private readonly dropshipCollapsePosition = new Vector3(0, 8, -500); // Near LZ

  // Hive collapse escape enhancements
  private healthPickups: { mesh: Mesh; collected: boolean; healAmount: number }[] = [];
  private crumblingWalls: { mesh: Mesh; progress: number; startY: number }[] = [];
  private collapseEnemies: Enemy[] = [];
  private collapseCommsPlayed: Set<string> = new Set();
  private lastCloseCallDistance = 0;
  private closeCallCount = 0;
  private objectiveMarker: Mesh | null = null;
  private objectiveBeacon: PointLight | null = null;

  // Falling stalactites/ceiling chunks for dramatic collapse
  private fallingStalactites: {
    mesh: Mesh;
    velocity: Vector3;
    rotationSpeed: Vector3;
    hasImpacted: boolean;
    shadowMarker: Mesh | null;
  }[] = [];
  private stalactiteSpawnTimer = 0;
  private readonly stalactiteSpawnInterval = 1.5; // Spawn every 1.5 seconds base

  // Audio timing for collapse sequence
  private collapseAudioTimer = 0;
  private readonly collapseRumbleInterval = 3; // Deep rumble every 3 seconds
  private lastAlienScreamTime = 0;
  private structureGroanTimer = 0;

  // Holdout wave enhancements - LZ Omega defense
  private supplyDrops: {
    mesh: Mesh;
    type: 'health' | 'ammo';
    collected: boolean;
    amount: number;
  }[] = [];
  private currentSpawnPointIndex = 0; // Rotating spawn points for variety
  private coverObjects: Mesh[] = []; // Additional sandbag/crate cover for arena
  private noDeathBonus = true; // Track for no-death completion bonus
  private waveStartTime = 0; // Track wave completion time for scoring
  private spawnPoints: Vector3[] = []; // Defined spawn locations around perimeter

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    switch (this.phase) {
      case 'escape_start':
      case 'escape_tunnel':
        return new Color4(0.02, 0.01, 0.03, 1); // Dark hive colors
      case 'surface_run':
      case 'holdout':
        return new Color4(0.75, 0.5, 0.35, 1); // Sunset canyon
      case 'hive_collapse':
        // Apocalyptic orange-red sky during collapse
        return new Color4(0.85, 0.4, 0.2, 1);
      case 'victory':
        return new Color4(0.75, 0.5, 0.35, 1); // Sunset canyon
      case 'epilogue':
        return new Color4(0.1, 0.1, 0.15, 1); // Station interior
      default:
        return new Color4(0.02, 0.01, 0.03, 1);
    }
  }

  protected async createEnvironment(): Promise<void> {
    // Start in escape tunnel
    this.camera.position.set(0, 1.7, 0);
    this.camera.rotation.set(0, 0, 0);
    this.rotationX = 0;
    this.rotationY = 0;

    // Initialize particle manager for combat effects
    particleManager.init(this.scene);

    this.createEscapeTunnel();
    this.createCollapseWall();
    this.createSurfaceEnvironment();
    this.createMarcusMech();
    this.createDropship();
    this.createLZ();

    // Initially hide surface elements
    this.setSurfaceVisible(false);

    this.startEscape();
  }

  // ============================================================================
  // ENVIRONMENT CREATION
  // ============================================================================

  private createEscapeTunnel(): void {
    const segmentLength = 20;
    const numSegments = 15;
    const tunnelRadius = 4;

    const tunnelMat = new StandardMaterial('tunnelMat', this.scene);
    tunnelMat.diffuseColor = Color3.FromHexString('#3A2A3A');
    tunnelMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const organicMat = new StandardMaterial('organicMat', this.scene);
    organicMat.diffuseColor = Color3.FromHexString('#5A3A5A');
    organicMat.emissiveColor = new Color3(0.1, 0.05, 0.1);

    for (let i = 0; i < numSegments; i++) {
      // Main tunnel segment
      const segment = MeshBuilder.CreateCylinder(
        `tunnel_${i}`,
        {
          height: segmentLength,
          diameter: tunnelRadius * 2,
          tessellation: 12,
          sideOrientation: 1, // Inside view
        },
        this.scene
      );
      segment.material = tunnelMat;
      segment.position.z = -i * segmentLength - segmentLength / 2;
      segment.rotation.x = Math.PI / 2;
      this.tunnelSegments.push(segment);

      // Add organic growths
      for (let j = 0; j < 4; j++) {
        const growth = MeshBuilder.CreateSphere(
          `growth_${i}_${j}`,
          { diameter: 0.5 + Math.random() * 0.5 },
          this.scene
        );
        growth.material = organicMat;
        const angle = (j / 4) * Math.PI * 2 + Math.random() * 0.5;
        growth.position.set(
          Math.cos(angle) * (tunnelRadius - 0.5),
          Math.sin(angle) * (tunnelRadius - 0.5),
          -i * segmentLength - Math.random() * segmentLength
        );
        this.tunnelSegments.push(growth);
      }

      // Add bioluminescent lights
      if (i % 2 === 0) {
        const light = new PointLight(
          `tunnelLight_${i}`,
          new Vector3(0, tunnelRadius - 1, -i * segmentLength - segmentLength / 2),
          this.scene
        );
        light.diffuse = new Color3(0.3, 0.6, 0.6);
        light.intensity = 15;
        light.range = 25;
        this.tunnelLights.push(light);
      }
    }

    // Exit light at end (represents surface)
    this.exitLight = new PointLight(
      'exitLight',
      new Vector3(0, 2, -this.escapeTunnelLength),
      this.scene
    );
    this.exitLight.diffuse = new Color3(1, 0.8, 0.5);
    this.exitLight.intensity = 50;
    this.exitLight.range = 80;
  }

  private createCollapseWall(): void {
    const collapseMat = new StandardMaterial('collapseMat', this.scene);
    collapseMat.diffuseColor = new Color3(0.2, 0.1, 0.05);
    collapseMat.emissiveColor = new Color3(0.3, 0.15, 0.05);

    this.collapseWall = MeshBuilder.CreateSphere(
      'collapseWall',
      { diameter: 20, segments: 8 },
      this.scene
    );
    this.collapseWall.material = collapseMat;
    this.collapseWall.position.z = 30; // Start behind player
    this.collapseWall.scaling.set(1, 1, 3);

    // Add dust particle effect plane
    const dustMat = new StandardMaterial('dustMat', this.scene);
    dustMat.diffuseColor = new Color3(0.5, 0.4, 0.3);
    dustMat.alpha = 0.3;
    dustMat.emissiveColor = new Color3(0.2, 0.15, 0.1);
  }

  private createSurfaceEnvironment(): void {
    // Terrain
    this.terrain = MeshBuilder.CreateGround(
      'terrain',
      { width: 800, height: 1200, subdivisions: 64 },
      this.scene
    );
    const terrainMat = new StandardMaterial('terrainMat', this.scene);
    terrainMat.diffuseColor = Color3.FromHexString('#8B5A2B');
    this.terrain.material = terrainMat;
    this.terrain.position.z = -400;

    // Sky dome
    this.skyDome = MeshBuilder.CreateSphere(
      'sky',
      { diameter: 5000, segments: 16, sideOrientation: 1 },
      this.scene
    );
    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.emissiveColor = new Color3(0.75, 0.5, 0.35);
    skyMat.disableLighting = true;
    this.skyDome.material = skyMat;

    // Canyon walls
    for (let i = 0; i < 6; i++) {
      const wall = MeshBuilder.CreateBox(
        `canyonWall_${i}`,
        { width: 30, height: 80, depth: 200 },
        this.scene
      );
      const wallMat = new StandardMaterial(`wallMat_${i}`, this.scene);
      wallMat.diffuseColor = Color3.FromHexString('#6B4423');
      wall.material = wallMat;
      wall.position.set((i % 2 === 0 ? -1 : 1) * (80 + Math.random() * 20), 40, -200 - i * 100);
      this.canyonWalls.push(wall);
    }

    // Breach holes (where aliens pour out)
    for (let i = 0; i < 4; i++) {
      const hole = MeshBuilder.CreateCylinder(
        `breachHole_${i}`,
        { height: 5, diameter: 8, tessellation: 8 },
        this.scene
      );
      const holeMat = new StandardMaterial(`holeMat_${i}`, this.scene);
      holeMat.diffuseColor = Color3.FromHexString('#2A1A2A');
      holeMat.emissiveColor = new Color3(0.1, 0.05, 0.1);
      hole.material = holeMat;
      hole.position.set((i % 2 === 0 ? -1 : 1) * (30 + i * 10), -2, -100 - i * 80);
      this.breachHoles.push(hole);
    }

    // Defensive barriers at LZ
    for (let i = 0; i < 8; i++) {
      const barrier = MeshBuilder.CreateBox(
        `barrier_${i}`,
        { width: 4, height: 1.5, depth: 1 },
        this.scene
      );
      const barrierMat = new StandardMaterial(`barrierMat_${i}`, this.scene);
      barrierMat.diffuseColor = new Color3(0.4, 0.4, 0.35);
      barrier.material = barrierMat;
      const angle = (i / 8) * Math.PI * 2;
      barrier.position.set(
        Math.cos(angle) * 25 + this.lzPosition.x,
        0.75,
        Math.sin(angle) * 25 + this.lzPosition.z
      );
      barrier.rotation.y = angle + Math.PI / 2;
      this.barrierWalls.push(barrier);
    }
  }

  private createMarcusMech(): void {
    // Create Marcus's Titan mech
    this.mechMesh = new TransformNode('marcusMech', this.scene);

    const mechMat = new StandardMaterial('mechMat', this.scene);
    mechMat.diffuseColor = Color3.FromHexString('#4A4A32');
    mechMat.specularColor = new Color3(0.3, 0.3, 0.3);

    const damagedMat = new StandardMaterial('damagedMat', this.scene);
    damagedMat.diffuseColor = Color3.FromHexString('#3A3A28');
    damagedMat.emissiveColor = new Color3(0.1, 0.05, 0);

    // Main body
    const body = MeshBuilder.CreateBox('mechBody', { width: 3, height: 4, depth: 2 }, this.scene);
    body.material = mechMat;
    body.position.y = 4;
    body.parent = this.mechMesh;

    // Torso
    const torso = MeshBuilder.CreateBox(
      'mechTorso',
      { width: 3.5, height: 2, depth: 2.5 },
      this.scene
    );
    torso.material = mechMat;
    torso.position.y = 6.5;
    torso.parent = this.mechMesh;

    // Head/Cockpit
    const head = MeshBuilder.CreateBox(
      'mechHead',
      { width: 1.5, height: 1, depth: 1.5 },
      this.scene
    );
    head.material = mechMat;
    head.position.y = 8;
    head.parent = this.mechMesh;

    // Cockpit visor (glowing)
    const visorMat = new StandardMaterial('visorMat', this.scene);
    visorMat.emissiveColor = new Color3(0.2, 0.8, 1);
    visorMat.alpha = 0.8;
    const visor = MeshBuilder.CreateBox(
      'visor',
      { width: 1.2, height: 0.4, depth: 0.1 },
      this.scene
    );
    visor.material = visorMat;
    visor.position.set(0, 8.2, -0.7);
    visor.parent = this.mechMesh;

    // Arms with autocannons
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;

      // Shoulder
      const shoulder = MeshBuilder.CreateBox(
        'shoulder',
        { width: 1.5, height: 1, depth: 1.5 },
        this.scene
      );
      shoulder.material = mechMat;
      shoulder.position.set(side * 2.5, 6.5, 0);
      shoulder.parent = this.mechMesh;

      // Arm
      const arm = MeshBuilder.CreateCylinder('arm', { height: 2, diameter: 0.8 }, this.scene);
      arm.material = mechMat;
      arm.position.set(side * 2.5, 5, 0);
      arm.parent = this.mechMesh;

      // Autocannon
      const cannon = MeshBuilder.CreateCylinder('cannon', { height: 3, diameter: 0.5 }, this.scene);
      cannon.material = damagedMat;
      cannon.position.set(side * 2.5, 4, -1);
      cannon.rotation.x = Math.PI / 2;
      cannon.parent = this.mechMesh;
    }

    // Legs
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;

      const upperLeg = MeshBuilder.CreateBox(
        'upperLeg',
        { width: 1, height: 2.5, depth: 1 },
        this.scene
      );
      upperLeg.material = mechMat;
      upperLeg.position.set(side * 1, 2, 0);
      upperLeg.parent = this.mechMesh;

      const lowerLeg = MeshBuilder.CreateBox(
        'lowerLeg',
        { width: 0.8, height: 2.5, depth: 0.8 },
        this.scene
      );
      lowerLeg.material = mechMat;
      lowerLeg.position.set(side * 1, 0, 0);
      lowerLeg.parent = this.mechMesh;

      const foot = MeshBuilder.CreateBox(
        'foot',
        { width: 1.2, height: 0.3, depth: 1.8 },
        this.scene
      );
      foot.material = mechMat;
      foot.position.set(side * 1, -1, 0.3);
      foot.parent = this.mechMesh;
    }

    // Mech gun muzzle flash light
    this.mechGunLight = new PointLight('mechGunLight', new Vector3(0, 5, -3), this.scene);
    this.mechGunLight.diffuse = new Color3(1, 0.8, 0.3);
    this.mechGunLight.intensity = 0;
    this.mechGunLight.range = 30;
    this.mechGunLight.parent = this.mechMesh;

    // Position mech near LZ
    this.mechMesh.position.set(15, 0, this.lzPosition.z + 20);
    this.mechMesh.rotation.y = Math.PI * 0.8;
    this.mechMesh.setEnabled(false);
  }

  private createDropship(): void {
    this.dropship = new TransformNode('dropship', this.scene);

    const shipMat = new StandardMaterial('shipMat', this.scene);
    shipMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
    shipMat.specularColor = new Color3(0.3, 0.3, 0.3);

    // Main fuselage
    const fuselage = MeshBuilder.CreateBox(
      'fuselage',
      { width: 6, height: 4, depth: 15 },
      this.scene
    );
    fuselage.material = shipMat;
    fuselage.parent = this.dropship;

    // Cockpit
    const cockpit = MeshBuilder.CreateSphere(
      'cockpit',
      { diameterX: 4, diameterY: 2, diameterZ: 5, segments: 8 },
      this.scene
    );
    cockpit.material = shipMat;
    cockpit.position.z = -8;
    cockpit.parent = this.dropship;

    // Cockpit window
    const windowMat = new StandardMaterial('windowMat', this.scene);
    windowMat.emissiveColor = new Color3(0.3, 0.5, 1);
    windowMat.alpha = 0.6;
    const window = MeshBuilder.CreateDisc('window', { radius: 1.5 }, this.scene);
    window.material = windowMat;
    window.position.set(0, 0.3, -10);
    window.rotation.x = Math.PI / 2 - 0.3;
    window.parent = this.dropship;

    // Wings
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const wing = MeshBuilder.CreateBox('wing', { width: 10, height: 0.5, depth: 6 }, this.scene);
      wing.material = shipMat;
      wing.position.set(side * 8, 0, 2);
      wing.parent = this.dropship;

      // Engine pod
      const engine = MeshBuilder.CreateCylinder('engine', { height: 4, diameter: 2 }, this.scene);
      engine.material = shipMat;
      engine.position.set(side * 10, -1, 2);
      engine.rotation.x = Math.PI / 2;
      engine.parent = this.dropship;

      // Engine glow
      const engineGlowMat = new StandardMaterial(`engineGlow_${i}`, this.scene);
      engineGlowMat.emissiveColor = new Color3(0.3, 0.6, 1);
      const glow = MeshBuilder.CreateDisc('engineGlow', { radius: 1 }, this.scene);
      glow.material = engineGlowMat;
      glow.position.set(side * 10, -1, 4);
      glow.rotation.x = Math.PI / 2;
      glow.parent = this.dropship;
    }

    // Tail
    const tail = MeshBuilder.CreateBox('tail', { width: 1, height: 4, depth: 4 }, this.scene);
    tail.material = shipMat;
    tail.position.set(0, 2, 6);
    tail.parent = this.dropship;

    // Rear cargo ramp (initially closed - horizontal against fuselage)
    const rampMat = new StandardMaterial('rampMat', this.scene);
    rampMat.diffuseColor = new Color3(0.35, 0.35, 0.4);
    rampMat.specularColor = new Color3(0.2, 0.2, 0.2);
    this.dropshipRamp = MeshBuilder.CreateBox(
      'dropshipRamp',
      { width: 4, height: 0.2, depth: 6 },
      this.scene
    );
    this.dropshipRamp.material = rampMat;
    this.dropshipRamp.position.set(0, -2, 7.5); // Rear of fuselage, bottom
    this.dropshipRamp.setPivotPoint(new Vector3(0, 0, -3)); // Pivot at front edge
    this.dropshipRamp.parent = this.dropship;

    // Ramp interior light (visible when ramp opens)
    this.dropshipRampLight = new PointLight('rampLight', new Vector3(0, -1, 5), this.scene);
    this.dropshipRampLight.diffuse = Color3.FromHexString('#90E0FF');
    this.dropshipRampLight.intensity = 0; // Off until ramp opens
    this.dropshipRampLight.range = 20;
    this.dropshipRampLight.parent = this.dropship;

    // Thrust emitter positions (for particle effects)
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const thrustEmitter = new TransformNode(`thrustEmitter_${i}`, this.scene);
      thrustEmitter.position.set(side * 10, -1, 4); // Below engine pods
      thrustEmitter.parent = this.dropship;
      this.dropshipThrustEmitters.push(thrustEmitter);
    }
    // Main VTOL thruster position (center bottom)
    const mainThrustEmitter = new TransformNode('mainThrustEmitter', this.scene);
    mainThrustEmitter.position.set(0, -2.5, 0);
    mainThrustEmitter.parent = this.dropship;
    this.dropshipThrustEmitters.push(mainThrustEmitter);

    // Dropship spotlight
    this.dropshipLight = new PointLight('dropshipLight', new Vector3(0, -5, 0), this.scene);
    this.dropshipLight.diffuse = new Color3(1, 0.95, 0.8);
    this.dropshipLight.intensity = 100;
    this.dropshipLight.range = 80;
    this.dropshipLight.parent = this.dropship;

    // Start dropship high and far away
    this.dropship.position.set(0, 200, this.lzPosition.z - 300);
    this.dropship.setEnabled(false);
  }

  private createLZ(): void {
    // LZ Omega landing pad
    this.lzPad = MeshBuilder.CreateCylinder('lzPad', { height: 0.3, diameter: 30 }, this.scene);
    const padMat = new StandardMaterial('padMat', this.scene);
    padMat.diffuseColor = new Color3(0.5, 0.5, 0.5);
    this.lzPad.material = padMat;
    this.lzPad.position.set(this.lzPosition.x, 0.15, this.lzPosition.z);

    // LZ markings
    const markingMat = new StandardMaterial('markingMat', this.scene);
    markingMat.diffuseColor = new Color3(0.8, 0.8, 0);
    markingMat.emissiveColor = new Color3(0.2, 0.2, 0);

    for (let i = 0; i < 4; i++) {
      const marking = MeshBuilder.CreateBox(
        `marking_${i}`,
        { width: 8, height: 0.05, depth: 0.5 },
        this.scene
      );
      marking.material = markingMat;
      marking.position.set(this.lzPosition.x, 0.35, this.lzPosition.z);
      marking.rotation.y = (i / 4) * Math.PI;
    }

    // Beacon
    this.lzBeacon = MeshBuilder.CreateCylinder('beacon', { height: 40, diameter: 3 }, this.scene);
    const beaconMat = new StandardMaterial('beaconMat', this.scene);
    beaconMat.emissiveColor = new Color3(0.2, 1, 0.3);
    beaconMat.alpha = 0.3;
    this.lzBeacon.material = beaconMat;
    this.lzBeacon.position.set(this.lzPosition.x, 20, this.lzPosition.z);

    // Setup holdout arena with additional cover and spawn points
    this.setupHoldoutArena();
  }

  /**
   * Setup the holdout arena at LZ Omega with:
   * - Additional cover objects (sandbags, crates, debris)
   * - Defined enemy spawn points around the perimeter
   * - Extraction point (dropship landing zone)
   */
  private setupHoldoutArena(): void {
    // === COVER OBJECTS ===
    // Sandbag walls - provide medium cover
    const sandbagMat = new StandardMaterial('sandbagMat', this.scene);
    sandbagMat.diffuseColor = Color3.FromHexString('#6B5D4A');

    // Inner ring of sandbag cover (closer to player spawn)
    const innerCoverPositions = [
      { x: -12, z: 8, rot: 0.2 },
      { x: 12, z: 8, rot: -0.2 },
      { x: -8, z: -5, rot: 0.4 },
      { x: 8, z: -5, rot: -0.4 },
    ];

    for (let i = 0; i < innerCoverPositions.length; i++) {
      const pos = innerCoverPositions[i];
      const sandbag = MeshBuilder.CreateBox(
        `sandbag_inner_${i}`,
        { width: 3, height: 1.2, depth: 1.5 },
        this.scene
      );
      sandbag.material = sandbagMat;
      sandbag.position.set(this.lzPosition.x + pos.x, 0.6, this.lzPosition.z + pos.z);
      sandbag.rotation.y = pos.rot;
      this.coverObjects.push(sandbag);
    }

    // Ammo crates - provide high cover
    const crateMat = new StandardMaterial('crateMat', this.scene);
    crateMat.diffuseColor = Color3.FromHexString('#4A5D3A');

    const cratePositions = [
      { x: -18, z: 0 },
      { x: 18, z: 0 },
      { x: 0, z: 15 },
      { x: -15, z: -10 },
      { x: 15, z: -10 },
    ];

    for (let i = 0; i < cratePositions.length; i++) {
      const pos = cratePositions[i];
      // Stack of 2 crates
      for (let j = 0; j < 2; j++) {
        const crate = MeshBuilder.CreateBox(
          `crate_${i}_${j}`,
          { width: 1.8, height: 1.2, depth: 1.8 },
          this.scene
        );
        crate.material = crateMat;
        crate.position.set(this.lzPosition.x + pos.x, 0.6 + j * 1.2, this.lzPosition.z + pos.z);
        crate.rotation.y = Math.random() * 0.3;
        this.coverObjects.push(crate);
      }
    }

    // Destroyed vehicle debris - large cover
    const debrisMat = new StandardMaterial('vehicleDebrisMat', this.scene);
    debrisMat.diffuseColor = Color3.FromHexString('#3A3A38');
    debrisMat.specularColor = new Color3(0.2, 0.2, 0.2);

    const vehicleDebris = MeshBuilder.CreateBox(
      'vehicleDebris',
      { width: 5, height: 2, depth: 8 },
      this.scene
    );
    vehicleDebris.material = debrisMat;
    vehicleDebris.position.set(this.lzPosition.x - 5, 1, this.lzPosition.z + 20);
    vehicleDebris.rotation.y = 0.3;
    vehicleDebris.rotation.z = 0.15; // Tilted, destroyed look
    this.coverObjects.push(vehicleDebris);

    // === SPAWN POINTS ===
    // Define 8 spawn points around the perimeter, rotating for variety
    const spawnRadius = 50;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.spawnPoints.push(
        new Vector3(
          this.lzPosition.x + Math.cos(angle) * spawnRadius,
          0,
          this.lzPosition.z + Math.sin(angle) * spawnRadius
        )
      );
    }

    // Add additional spawn points at breach holes
    for (const hole of this.breachHoles) {
      this.spawnPoints.push(hole.position.clone());
    }
  }

  private setTunnelVisible(visible: boolean): void {
    this.tunnelSegments.forEach((s) => (s.isVisible = visible));
    this.tunnelLights.forEach((l) => l.setEnabled(visible));
    if (this.collapseWall) this.collapseWall.isVisible = visible;
    if (this.exitLight) this.exitLight.setEnabled(visible);
  }

  private setSurfaceVisible(visible: boolean): void {
    if (this.terrain) this.terrain.isVisible = visible;
    if (this.skyDome) this.skyDome.isVisible = visible;
    if (this.lzPad) this.lzPad.isVisible = visible;
    if (this.lzBeacon) this.lzBeacon.isVisible = visible;
    this.breachHoles.forEach((h) => (h.isVisible = visible));
    this.canyonWalls.forEach((w) => (w.isVisible = visible));
    this.barrierWalls.forEach((b) => (b.isVisible = visible));
    this.coverObjects.forEach((c) => (c.isVisible = visible));
    if (this.mechMesh) this.mechMesh.setEnabled(visible);
  }

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  private startEscape(): void {
    this.phase = 'escape_start';
    this.escapeTimer = 180;
    this.phaseTime = 0;
    this.playerEscapeProgress = 0;
    this.collapseDistance = -20;

    this.callbacks.onCinematicStart?.();
    this.callbacks.onNotification('THE HIVE IS COLLAPSING', 3000);

    // Setup action handler
    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    // Initial comms
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "The whole place is coming down! RUN, brother! I'm holding position at LZ Omega!",
      });
    }, 1000);

    // Transition to escape tunnel phase
    setTimeout(() => {
      this.transitionToPhase('escape_tunnel');
    }, 3000);
  }

  private transitionToPhase(newPhase: ExtractionPhase): void {
    this.phase = newPhase;
    this.phaseTime = 0;

    switch (newPhase) {
      case 'escape_tunnel':
        this.callbacks.onObjectiveUpdate(
          'ESCAPE THE HIVE',
          'RUN! The collapse is right behind you!'
        );
        this.updateActionButtons('escape');
        this.setBaseShake(1.5);
        this.callbacks.onCombatStateChange(true);
        break;

      case 'surface_run':
        this.callbacks.onNotification('SURFACE REACHED', 2000);
        this.callbacks.onCinematicEnd?.();

        // Hide tunnel, show surface
        this.setTunnelVisible(false);
        this.setSurfaceVisible(true);

        // Reset camera for surface
        this.camera.position.set(0, 1.7, 0);
        this.camera.rotation.set(0, Math.PI, 0);
        this.rotationX = 0;
        this.rotationY = Math.PI;

        this.scene.clearColor = new Color4(0.75, 0.5, 0.35, 1);
        this.setBaseShake(0.5);

        setTimeout(() => {
          this.callbacks.onCommsMessage({
            sender: 'Corporal Marcus Cole',
            callsign: 'TITAN',
            portrait: 'marcus',
            text: 'I see you! Run to my position! Hostiles everywhere!',
          });
          this.callbacks.onObjectiveUpdate(
            'REACH LZ OMEGA',
            `Distance: ${this.distanceToLZ.toFixed(0)}m`
          );
        }, 2000);
        break;

      case 'holdout':
        this.callbacks.onNotification('DEFEND THE LZ', 3000);
        this.dropshipETA = 420; // 7:00 for 7 waves
        this.currentWave = 0;
        this.wavePhase = 'waiting';
        this.wavePhaseTimer = 0;
        this.waveEnemiesKilled = 0;
        this.setBaseShake(0);

        // Position player at LZ
        this.camera.position.set(this.lzPosition.x, 1.7, this.lzPosition.z + 15);

        // Initial comms about incoming waves
        setTimeout(() => {
          this.callbacks.onCommsMessage({
            sender: 'PROMETHEUS A.I.',
            callsign: 'ATHENA',
            portrait: 'ai',
            text: 'Dropship SALVATION en route. ETA 5 minutes. Detecting multiple hostile signatures converging on your position.',
          });
        }, 1500);

        // Start the wave countdown sequence
        setTimeout(() => {
          this.startWaveIntermission(1);
        }, 4000);

        this.updateActionButtons('holdout');
        this.callbacks.onCombatStateChange(true);
        break;

      case 'hive_collapse':
        this.startHiveCollapseSequence();
        break;

      case 'victory':
        this.callbacks.onNotification('DROPSHIP ARRIVING', 3000);
        this.callbacks.onCombatStateChange(false);
        this.updateActionButtons('none');

        // Check for no-death bonus
        if (this.noDeathBonus) {
          setTimeout(() => {
            this.callbacks.onNotification('BONUS: FLAWLESS EXTRACTION - NO DEATHS', 4000);
            // Could award bonus XP or achievement here
            getAchievementManager().onLevelComplete(this.id, false);
          }, 2000);
        }

        // Play victory music
        getAudioManager().playVictory();

        // Start dropship descent animation
        this.startDropshipArrival();
        break;

      case 'epilogue':
        this.showEpilogue();
        break;
    }
  }

  private handleAction(actionId: string): void {
    const now = performance.now();

    switch (actionId) {
      case 'sprint':
        // Sprint is handled in processMovement
        break;

      case 'grenade':
        if (this.grenadeCooldown <= 0) {
          this.throwGrenade();
          this.grenadeCooldown = this.grenadeCooldownTime;
        } else {
          this.callbacks.onNotification('GRENADE ON COOLDOWN', 500);
        }
        break;

      case 'melee':
        this.performMelee();
        break;

      case 'flare':
        if (this.flareCooldown <= 0) {
          this.fireSignalFlare();
          this.flareCooldown = this.flareCooldownTime;
        } else {
          this.callbacks.onNotification('FLARE ON COOLDOWN', 500);
        }
        break;

      case 'reload':
        this.handleReload();
        break;
    }
  }

  /**
   * Handle weapon reload action
   */
  private handleReload(): void {
    const weaponActions = getWeaponActions();
    if (!weaponActions) return;

    const state = weaponActions.getState();
    if (state.isReloading) {
      this.callbacks.onNotification('ALREADY RELOADING', 500);
      return;
    }
    if (state.currentAmmo >= state.maxMagazineSize) {
      this.callbacks.onNotification('MAGAZINE FULL', 500);
      return;
    }
    if (state.reserveAmmo <= 0) {
      this.callbacks.onNotification('NO RESERVE AMMO', 500);
      return;
    }

    startReload();
    this.callbacks.onNotification('RELOADING...', 1800);
  }

  private throwGrenade(): void {
    this.callbacks.onNotification('GRENADE OUT', 1000);

    // Damage all enemies in radius
    const grenadePos = this.camera.position.clone();
    grenadePos.addInPlace(
      new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).scale(10)
    );

    // Emit explosion particle effect
    particleManager.emitSmallExplosion(grenadePos, 1.5);

    let killCount = 0;
    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;
      const dist = Vector3.Distance(enemy.position, grenadePos);
      if (dist < 15) {
        const damage = Math.max(10, 100 - dist * 5);
        enemy.health -= damage;
        if (enemy.health <= 0) {
          this.killEnemy(enemy);
          killCount++;
        }
      }
    }

    if (killCount > 0) {
      this.callbacks.onNotification(`${killCount} KILLS`, 1500);
    }

    this.triggerShake(3);
  }

  private performMelee(): void {
    // Check for enemies in melee range
    const meleeRange = 3;
    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;
      const dist = Vector3.Distance(enemy.position, this.camera.position);
      if (dist < meleeRange) {
        enemy.health -= 50;
        if (enemy.health <= 0) {
          this.killEnemy(enemy);
        }
        this.callbacks.onNotification('MELEE HIT', 500);
        this.triggerShake(1);
        return;
      }
    }
    this.callbacks.onNotification('MISS', 300);
  }

  private fireSignalFlare(): void {
    this.callbacks.onNotification('SIGNAL FLARE DEPLOYED', 2000);
    this.callbacks.onCommsMessage({
      sender: 'PROMETHEUS A.I.',
      callsign: 'ATHENA',
      portrait: 'ai',
      text: 'Signal received. Relaying position to SALVATION.',
    });

    // Reduce dropship ETA
    this.dropshipETA = Math.max(30, this.dropshipETA - 30);
  }

  private updateActionButtons(mode: 'escape' | 'holdout' | 'none'): void {
    let groups: ActionButtonGroup[] = [];

    // Get keybindings - configurable and level-specific
    const sprint = bindableActionParams('sprint');
    const reload = bindableActionParams('reload');
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');
    const flare = levelActionParams('flare');

    switch (mode) {
      case 'escape':
        groups = [
          {
            id: 'escape',
            position: 'bottom',
            buttons: [
              createAction('sprint', 'SPRINT', sprint.key, {
                keyDisplay: sprint.keyDisplay,
                variant: 'danger',
                size: 'large',
                highlighted: true,
              }),
            ],
          },
        ];
        break;

      case 'holdout':
        groups = [
          {
            id: 'combat',
            position: 'right',
            buttons: [
              createAction('reload', 'RELOAD', reload.key, {
                keyDisplay: reload.keyDisplay,
                variant: 'secondary',
              }),
              createAction('grenade', 'GRENADE', grenade.key, {
                keyDisplay: grenade.keyDisplay,
                variant: 'danger',
                cooldown: this.grenadeCooldownTime,
              }),
              createAction('melee', 'MELEE', melee.key, {
                keyDisplay: melee.keyDisplay,
                variant: 'primary',
              }),
              createAction('flare', 'SIGNAL FLARE', flare.key, {
                keyDisplay: flare.keyDisplay,
                variant: 'warning',
                cooldown: this.flareCooldownTime,
              }),
            ],
          },
        ];
        break;
    }

    this.callbacks.onActionGroupsChange(groups);
  }

  // ============================================================================
  // WAVE COMBAT STATE MACHINE
  // ============================================================================

  /**
   * Start the intermission countdown before a wave begins.
   * This gives players time to prepare and builds tension.
   */
  private startWaveIntermission(waveNumber: number): void {
    if (waveNumber > this.waveConfigs.length) {
      // All waves complete - but dropship timer should handle victory
      return;
    }

    this.currentWave = waveNumber;
    this.wavePhase = 'intermission';
    this.intermissionCountdown = this.waveIntermissionDuration;
    this.wavePhaseTimer = 0;

    // Announce upcoming wave
    const config = this.waveConfigs[waveNumber - 1];
    this.callbacks.onNotification(`INCOMING: ${config.waveTitle}`, 3000);

    // Play comms message if configured
    if (config.commsMessage) {
      setTimeout(() => {
        this.callbacks.onCommsMessage(config.commsMessage!);
      }, 1000);
    }
  }

  /**
   * Start the wave announcement phase with dramatic title display.
   */
  private startWaveAnnouncement(): void {
    const config = this.waveConfigs[this.currentWave - 1];
    if (!config) return;

    this.wavePhase = 'announcement';
    this.wavePhaseTimer = 0;

    // Big dramatic announcement
    this.callbacks.onNotification(config.waveTitle, 2500);
    this.triggerShake(2);

    // Update objective with wave description
    this.callbacks.onObjectiveUpdate(config.waveTitle, config.waveDescription);
  }

  /**
   * Start the active wave combat phase.
   */
  private startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.wavePhase = 'active';
    this.waveSpawnTimer = 0;
    this.waveEnemiesKilled = 0;
    this.waveStartTime = performance.now();

    const config = this.waveConfigs[waveNumber - 1];
    if (!config) {
      // All waves complete
      this.transitionToPhase('victory');
      return;
    }

    // Combat music - intensity scales with wave number
    // Wave 1-3: standard combat, Wave 4-6: intense combat, Wave 7: boss music
    if (waveNumber === this.totalWaves) {
      // Final wave - boss music for maximum intensity
      getAudioManager().enterCombat(); // This will trigger boss-level intensity
      this.callbacks.onNotification('FINAL WAVE - HOLD THE LINE', 3000);
    } else {
      // Standard combat music with wave entering
      getAudioManager().enterCombat();
    }

    // Prepare spawn queue - randomize order for variety
    this.enemiesToSpawn = [];
    const spawnList: { species: string; count: number }[] = [];
    if (config.drones > 0) spawnList.push({ species: 'skitterer', count: config.drones });
    if (config.grunts > 0) spawnList.push({ species: 'lurker', count: config.grunts });
    if (config.spitters > 0) spawnList.push({ species: 'spewer', count: config.spitters });
    if (config.brutes > 0) spawnList.push({ species: 'broodmother', count: config.brutes });

    // Shuffle the spawn groups for variety
    for (let i = spawnList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spawnList[i], spawnList[j]] = [spawnList[j], spawnList[i]];
    }
    this.enemiesToSpawn = spawnList;

    this.waveEnemiesRemaining = config.drones + config.grunts + config.spitters + config.brutes;

    // Degrade mech integrity based on wave
    this.updateMechIntegrityForWave(waveNumber);

    // Final wave special handling - trigger hive collapse sequence mid-wave for dramatic escape
    if (waveNumber === this.totalWaves) {
      setTimeout(() => {
        if (this.phase === 'holdout') {
          // Transition to hive collapse escape instead of direct victory
          this.transitionToPhase('hive_collapse');
        }
      }, 50000); // 50 seconds into final wave, hive collapse begins
    }
  }

  /**
   * Called when a wave is completed (all enemies killed).
   */
  private onWaveComplete(): void {
    const waveKills = this.waveEnemiesKilled;

    // Celebration notification
    this.callbacks.onNotification(`WAVE ${this.currentWave} CLEAR - ${waveKills} KILLS`, 3000);

    // Exit combat mode briefly for intermission - calmer music between waves
    getAudioManager().exitCombat(500);

    // Spawn supply drops between waves (except after final wave)
    if (this.currentWave < this.waveConfigs.length) {
      this.spawnSupplyDrops();
    }

    // Rotate spawn points for next wave variety
    this.currentSpawnPointIndex = (this.currentSpawnPointIndex + 2) % this.spawnPoints.length;

    // Wave-specific dialogue - spread across 7 waves for variety
    if (this.currentWave === 2) {
      setTimeout(() => {
        this.callbacks.onCommsMessage({
          sender: 'Corporal Marcus Cole',
          callsign: 'TITAN',
          portrait: 'marcus',
          text: 'Good kills, brother! Keep it up - Titan is holding but they just keep coming!',
        });
      }, 1500);
    } else if (this.currentWave === 4) {
      setTimeout(() => {
        this.callbacks.onCommsMessage({
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Warning: Massive hostile signatures converging. Recommend conserving ammunition.',
        });
      }, 1500);
    } else if (this.currentWave === 5) {
      setTimeout(() => {
        this.callbacks.onCommsMessage({
          sender: 'Corporal Marcus Cole',
          callsign: 'TITAN',
          portrait: 'marcus',
          text: "We're past the halfway point! Two more waves - you got this!",
        });
      }, 1500);
    } else if (this.currentWave === 6) {
      setTimeout(() => {
        this.callbacks.onCommsMessage({
          sender: 'PROMETHEUS A.I.',
          callsign: 'ATHENA',
          portrait: 'ai',
          text: 'Warning: Seismic activity detected. Massive hostile force approaching. SALVATION ETA update: 90 seconds.',
        });
      }, 1500);
    } else if (this.currentWave === this.totalWaves) {
      // After final wave complete, immediately trigger hive collapse if not already
      setTimeout(() => {
        if (this.phase === 'holdout') {
          this.transitionToPhase('hive_collapse');
        }
      }, 2000);
      return; // Don't start another wave
    }

    // Check if more waves remain
    if (this.currentWave < this.totalWaves) {
      // Start intermission to next wave
      setTimeout(() => {
        this.startWaveIntermission(this.currentWave + 1);
      }, 2000);
    }
  }

  /**
   * Spawn health and ammo supply drops at the end of a wave.
   * Gives players a chance to resupply during intermission.
   */
  private spawnSupplyDrops(): void {
    // Clear any uncollected previous drops
    for (const drop of this.supplyDrops) {
      if (!drop.collected) {
        drop.mesh.dispose();
      }
    }
    this.supplyDrops = [];

    // Spawn positions near cover objects
    const dropPositions = [
      new Vector3(this.lzPosition.x - 10, 0.5, this.lzPosition.z + 5),
      new Vector3(this.lzPosition.x + 10, 0.5, this.lzPosition.z + 5),
      new Vector3(this.lzPosition.x, 0.5, this.lzPosition.z - 8),
    ];

    // Spawn health pack
    const healthMat = new StandardMaterial('healthDropMat', this.scene);
    healthMat.diffuseColor = Color3.FromHexString('#44AA44');
    healthMat.emissiveColor = new Color3(0.2, 0.6, 0.2);

    const healthDrop = MeshBuilder.CreateBox(
      `healthDrop_${Date.now()}`,
      { width: 0.8, height: 0.5, depth: 0.8 },
      this.scene
    );
    healthDrop.material = healthMat;
    healthDrop.position = dropPositions[0].clone();
    this.supplyDrops.push({
      mesh: healthDrop,
      type: 'health',
      collected: false,
      amount: 25, // Heal 25 HP
    });

    // Spawn ammo crate
    const ammoMat = new StandardMaterial('ammoDropMat', this.scene);
    ammoMat.diffuseColor = Color3.FromHexString('#AAAA44');
    ammoMat.emissiveColor = new Color3(0.4, 0.4, 0.1);

    const ammoDrop = MeshBuilder.CreateBox(
      `ammoDrop_${Date.now()}`,
      { width: 0.8, height: 0.5, depth: 0.8 },
      this.scene
    );
    ammoDrop.material = ammoMat;
    ammoDrop.position = dropPositions[1].clone();
    this.supplyDrops.push({
      mesh: ammoDrop,
      type: 'ammo',
      collected: false,
      amount: 30, // Restore 30 ammo
    });

    // Announcement
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Supply drop deployed. Resupply before the next wave.',
      });
    }, 500);
  }

  /**
   * Check for player collecting supply drops.
   */
  private updateSupplyDrops(): void {
    const playerPos = this.camera.position;
    const collectRadius = 2;

    for (const drop of this.supplyDrops) {
      if (drop.collected) continue;

      const dist = Vector3.Distance(drop.mesh.position, playerPos);
      if (dist < collectRadius) {
        drop.collected = true;
        drop.mesh.dispose();

        if (drop.type === 'health') {
          this.playerHealth = Math.min(100, this.playerHealth + drop.amount);
          this.callbacks.onHealthChange(this.playerHealth);
          this.callbacks.onNotification(`+${drop.amount} HEALTH`, 1000);
        } else if (drop.type === 'ammo') {
          // Restore ammo through weapon actions
          const weaponActions = getWeaponActions();
          if (weaponActions) {
            // Add reserve ammo
            fireWeapon(); // Trigger weapon state refresh
          }
          this.callbacks.onNotification(`+${drop.amount} AMMO`, 1000);
        }

        // Play pickup sound
        getAudioManager().play('notification');
      }
    }

    // Animate uncollected drops (floating/pulsing)
    const time = performance.now() / 1000;
    for (const drop of this.supplyDrops) {
      if (!drop.collected) {
        drop.mesh.position.y = 0.5 + Math.sin(time * 2) * 0.15;
        drop.mesh.rotation.y += 0.02;
      }
    }
  }

  /**
   * Update mech integrity based on current wave.
   * The mech takes damage as waves progress to increase difficulty.
   * Spread across 7 waves for gradual degradation.
   */
  private updateMechIntegrityForWave(waveNumber: number): void {
    switch (waveNumber) {
      case 3:
        this.mechIntegrity = Math.min(this.mechIntegrity, 80);
        break;
      case 4:
        this.mechIntegrity = Math.min(this.mechIntegrity, 65);
        break;
      case 5:
        this.mechIntegrity = Math.min(this.mechIntegrity, 50);
        break;
      case 6:
        this.mechIntegrity = Math.min(this.mechIntegrity, 35);
        break;
      case 7:
        this.mechIntegrity = Math.min(this.mechIntegrity, 20);
        break;
    }
  }

  /**
   * Spawn an enemy from rotating spawn points around the perimeter.
   * Brutes spawn from breach holes for dramatic effect.
   * Regular enemies use rotating spawn points for tactical variety.
   */
  private spawnEnemy(species: string): void {
    if (this.enemies.length >= this.maxEnemies) return;

    const speciesData = ALIEN_SPECIES[species];
    if (!speciesData) return;

    // Select spawn point based on enemy type
    let spawnPos: Vector3;

    if (species === 'broodmother' && this.breachHoles.length > 0) {
      // Brutes spawn from breach holes for dramatic effect
      const holeIndex = Math.floor(Math.random() * Math.min(2, this.breachHoles.length));
      const hole = this.breachHoles[holeIndex];
      spawnPos = hole.position.clone();
      spawnPos.y = 0;
      spawnPos.x += (Math.random() - 0.5) * 5;
      spawnPos.z += (Math.random() - 0.5) * 5;
    } else if (this.spawnPoints.length > 0) {
      // Use rotating spawn points for variety - enemies come from different directions
      const spawnIndex =
        (this.currentSpawnPointIndex + Math.floor(Math.random() * 3)) % this.spawnPoints.length;
      const basePos = this.spawnPoints[spawnIndex];
      spawnPos = basePos.clone();
      spawnPos.y = 0;
      // Add some randomization around the spawn point
      const spreadAngle = Math.random() * Math.PI * 2;
      const spreadRadius = 3 + Math.random() * 8;
      spawnPos.x += Math.cos(spreadAngle) * spreadRadius;
      spawnPos.z += Math.sin(spreadAngle) * spreadRadius;

      // Rotate spawn point index occasionally for next enemy
      if (Math.random() < 0.3) {
        this.currentSpawnPointIndex = (this.currentSpawnPointIndex + 1) % this.spawnPoints.length;
      }
    } else if (this.breachHoles.length > 0) {
      // Fallback to breach holes
      const holeIndex = Math.floor(Math.random() * this.breachHoles.length);
      const hole = this.breachHoles[holeIndex];
      spawnPos = hole.position.clone();
      spawnPos.y = 0;
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 8;
      spawnPos.x += Math.cos(angle) * radius;
      spawnPos.z += Math.sin(angle) * radius;
    } else {
      // Final fallback - random position around LZ
      const angle = Math.random() * Math.PI * 2;
      const radius = 40 + Math.random() * 20;
      spawnPos = new Vector3(
        this.lzPosition.x + Math.cos(angle) * radius,
        0,
        this.lzPosition.z + Math.sin(angle) * radius
      );
    }

    const mesh = createAlienMesh(this.scene, speciesData, Date.now() + this.enemies.length);
    mesh.position = spawnPos.clone();

    // Scale health based on wave for difficulty progression
    const waveHealthMultiplier = 1 + (this.currentWave - 1) * 0.1;
    const scaledHealth = Math.floor(speciesData.baseHealth * waveHealthMultiplier);

    const enemy: Enemy = {
      mesh,
      health: scaledHealth,
      maxHealth: scaledHealth,
      position: spawnPos,
      velocity: new Vector3(0, 0, 0),
      species,
      isActive: true,
    };

    this.enemies.push(enemy);

    // Emit spawn effect for dramatic entrance
    particleManager.emitAlienDeath(spawnPos.clone(), 0.5); // Small burst to show spawn
  }

  private updateEnemies(deltaTime: number): void {
    const playerPos = this.camera.position;

    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;

      // Move toward player
      const toPlayer = playerPos.subtract(enemy.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      if (dist > 3) {
        toPlayer.normalize();
        const species = ALIEN_SPECIES[enemy.species];
        const speed = species ? species.moveSpeed : 5;
        enemy.velocity = toPlayer.scale(speed);
        enemy.position.addInPlace(enemy.velocity.scale(deltaTime));
        enemy.mesh.position = enemy.position.clone();

        // Face player
        enemy.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      } else {
        // Attack player
        this.onPlayerDamaged(5);
      }
    }

    // Marcus mech attacks enemies
    if (this.mechMesh && this.mechIntegrity > 0 && this.phase === 'holdout') {
      this.mechFireTimer -= deltaTime;
      if (this.mechFireTimer <= 0) {
        this.mechFireTimer = this.mechFireRate;
        this.mechFireAtEnemy();
      }
    }
  }

  private mechFireAtEnemy(): void {
    // Find closest enemy to mech
    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;

    const mechPos = this.mechMesh!.position;

    for (const enemy of this.enemies) {
      if (!enemy.isActive) continue;
      const dist = Vector3.Distance(enemy.position, mechPos);
      if (dist < closestDist && dist < 100) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy && this.mechGunLight) {
      // Muzzle flash
      this.mechGunLight.intensity = 50;
      setTimeout(() => {
        if (this.mechGunLight) this.mechGunLight.intensity = 0;
      }, 50);

      // Deal damage based on mech integrity
      const damage = 20 * (this.mechIntegrity / 100);
      closestEnemy.health -= damage;

      if (closestEnemy.health <= 0) {
        this.killEnemy(closestEnemy);
      }
    }
  }

  private killEnemy(enemy: Enemy): void {
    // Emit alien death particle effect (green goo burst)
    particleManager.emitAlienDeath(enemy.position.clone(), 1.2);

    enemy.isActive = false;
    enemy.mesh.setEnabled(false);
    this.kills++;
    this.waveEnemiesRemaining--;
    this.waveEnemiesKilled++;
    this.callbacks.onKill();

    // Check if wave is complete (using state machine)
    if (
      this.wavePhase === 'active' &&
      this.waveEnemiesRemaining <= 0 &&
      this.enemiesToSpawn.length === 0
    ) {
      this.wavePhase = 'waiting';
      this.onWaveComplete();
    }
  }

  private onPlayerDamaged(damage: number): void {
    this.playerHealth -= damage;
    this.callbacks.onHealthChange(this.playerHealth);
    this.callbacks.onDamage();
    this.triggerDamageShake(damage);
    this.trackPlayerDamage(damage); // Track for achievements

    if (this.playerHealth <= 0) {
      this.noDeathBonus = false; // Lost no-death bonus
      this.onPlayerDeath(); // Trigger defeat music
      this.callbacks.onNotification('KIA', 3000);
      // Would trigger game over / restart
    }
  }

  // ============================================================================
  // HIVE COLLAPSE SEQUENCE
  // ============================================================================

  /**
   * Start the hive collapse escape sequence after all holdout waves.
   * The player must sprint to the dropship while the world crumbles around them.
   * This is the dramatic finale where the player must escape the collapsing alien hive.
   */
  private startHiveCollapseSequence(): void {
    // Initialize collapse state
    this.hiveCollapseTimer = 90; // 90 seconds to reach dropship (task spec: 90-120s)
    this.collapseIntensity = 0;
    this.collapseDebrisTimer = 0;
    this.collapseCommsPlayed.clear();
    this.closeCallCount = 0;
    this.lastCloseCallDistance = Infinity;

    // Initialize stalactite and audio timers
    this.stalactiteSpawnTimer = 2; // First stalactite spawns after 2 seconds
    this.collapseAudioTimer = 0.5; // First rumble after 0.5 seconds
    this.structureGroanTimer = 3;
    this.lastAlienScreamTime = performance.now() - 5000; // Allow early scream

    // Change sky to apocalyptic orange-red
    this.scene.clearColor = new Color4(0.85, 0.4, 0.2, 1);

    // Create collapse environmental effects
    this.createCollapseEnvironment();

    // Create health pickups along the escape route
    this.createCollapseHealthPickups();

    // Create crumbling walls to block some paths
    this.createCrumblingWalls();

    // Create objective marker at dropship
    this.createObjectiveMarker();

    // Spawn initial enemy stragglers
    this.spawnCollapseEnemies();

    // Position dropship hovering at extraction point
    if (this.dropship) {
      this.dropship.setEnabled(true);
      this.dropship.position.set(
        this.dropshipCollapsePosition.x,
        this.dropshipCollapsePosition.y + 15, // Hovering above ground
        this.dropshipCollapsePosition.z
      );
    }

    // Update action buttons for escape mode
    this.updateActionButtons('escape');

    // Start with heavy shake - visual/audio warning of collapse starting
    this.setBaseShake(3);
    this.triggerShake(6);

    // INITIAL AUDIO - dramatic collapse beginning
    // Deep rumble signals the collapse is beginning
    getAudioManager().play('collapse_rumble', { volume: 0.6 });
    // Multiple alien death screams as the hive starts dying
    setTimeout(() => getAudioManager().play('alien_death_scream', { volume: 0.5 }), 500);
    setTimeout(() => getAudioManager().play('alien_death_scream', { volume: 0.4 }), 1200);
    // Ground cracking sounds
    setTimeout(() => getAudioManager().play('ground_crack', { volume: 0.5 }), 800);
    setTimeout(() => getAudioManager().play('collapse_crack', { volume: 0.4 }), 1500);

    // Initial notifications
    this.callbacks.onNotification('THE HIVE IS COLLAPSING - GET TO THE DROPSHIP', 4000);
    this.callbacks.onCombatStateChange(true);

    // Comms sequence - Commander Reyes urging player to hurry
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Commander Elena Vasquez',
        callsign: 'PROMETHEUS ACTUAL',
        portrait: 'commander',
        text: 'SPECTER! The entire hive structure is coming down! You have 90 seconds to reach SALVATION - MOVE!',
      });
    }, 1000);

    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'CRITICAL: Subterranean hive structure collapsing! Surface destabilization imminent! SALVATION is holding position - recommend maximum sprint velocity!',
      });
    }, 4000);

    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "Titan's running on fumes but I'll cover you! RUN, brother! Don't look back!",
      });
    }, 7000);

    // Dramatic environmental changes at intervals - increasing intensity over time
    setTimeout(() => {
      this.spawnHiveEruption(new Vector3(-40, 0, this.lzPosition.z + 150));
      this.triggerShake(4);
      // Audio: explosion and ground crack
      getAudioManager().play('explosion', { volume: 0.5 });
      getAudioManager().play('ground_crack', { volume: 0.4 });
    }, 10000);

    setTimeout(() => {
      this.callbacks.onNotification('GROUND COLLAPSING - MOVE FASTER', 2000);
      this.spawnHiveEruption(new Vector3(30, 0, this.lzPosition.z + 100));
      this.triggerShake(5);
      // Spawn more stragglers
      this.spawnCollapseEnemies();
      // Audio: deep rumble and explosion
      getAudioManager().play('collapse_rumble', { volume: 0.6 });
      getAudioManager().play('explosion', { volume: 0.5 });
      setTimeout(() => getAudioManager().play('alien_death_scream', { volume: 0.4 }), 300);
    }, 20000);

    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Commander Elena Vasquez',
        callsign: 'PROMETHEUS ACTUAL',
        portrait: 'commander',
        text: 'Seismic readings are off the charts! The whole sector is destabilizing! KEEP RUNNING, SOLDIER!',
      });
      this.spawnHiveEruption(new Vector3(-20, 0, this.lzPosition.z + 70));
      this.triggerShake(5);
      // Audio: structure groan and explosion
      getAudioManager().play('structure_groan', { volume: 0.5 });
      getAudioManager().play('explosion', { volume: 0.55 });
    }, 35000);

    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Dropship Pilot',
        callsign: 'SALVATION',
        portrait: 'ai',
        text: "I can't hold much longer! This whole area is coming apart! GET HERE NOW!",
      });
      this.spawnHiveEruption(new Vector3(15, 0, this.lzPosition.z + 50));
      this.triggerShake(6);
      // Audio: massive rumble and multiple cracks
      getAudioManager().play('collapse_rumble', { volume: 0.7 });
      setTimeout(() => getAudioManager().play('collapse_crack', { volume: 0.5 }), 200);
      setTimeout(() => getAudioManager().play('collapse_crack', { volume: 0.4 }), 500);
    }, 50000);

    setTimeout(() => {
      this.spawnHiveEruption(new Vector3(0, 0, this.lzPosition.z + 30));
      this.callbacks.onNotification('FINAL COLLAPSE IMMINENT', 2000);
      this.triggerShake(7);
      this.callbacks.onCommsMessage({
        sender: 'Commander Elena Vasquez',
        callsign: 'PROMETHEUS ACTUAL',
        portrait: 'commander',
        text: 'YOU ARE RUNNING OUT OF TIME! SALVATION IS YOUR ONLY CHANCE! GO GO GO!',
      });
      // Audio: maximum intensity - overlapping explosions and screams
      getAudioManager().play('explosion', { volume: 0.7 });
      getAudioManager().play('collapse_rumble', { volume: 0.8 });
      setTimeout(() => getAudioManager().play('alien_death_scream', { volume: 0.5 }), 100);
      setTimeout(() => getAudioManager().play('alien_death_scream', { volume: 0.4 }), 400);
      setTimeout(() => getAudioManager().play('ground_crack', { volume: 0.6 }), 300);
    }, 70000);

    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "Almost there, brother! Don't you DARE give up now! I didn't survive this long to lose you!",
      });
      this.triggerShake(8);
      // Audio: final desperate rumble
      getAudioManager().play('collapse_rumble', { volume: 0.9 });
      getAudioManager().play('structure_groan', { volume: 0.6 });
    }, 80000);
  }

  /**
   * Create environmental collapse effects: ground cracks, hive eruptions, falling debris sources.
   */
  private createCollapseEnvironment(): void {
    // Create ominous red-orange lighting from below
    this.collapseLight = new PointLight(
      'collapseLight',
      new Vector3(0, -10, this.lzPosition.z),
      this.scene
    );
    this.collapseLight.diffuse = new Color3(1, 0.4, 0.1);
    this.collapseLight.intensity = 50;
    this.collapseLight.range = 200;

    // Create ground cracks radiating from breach holes
    this.createGroundCracks();
  }

  /**
   * Create health pickups along the escape route for the player to collect.
   * Placed at strategic intervals to help players survive the escape.
   */
  private createCollapseHealthPickups(): void {
    const pickupPositions = [
      new Vector3(10, 0.5, this.lzPosition.z + 180), // Early pickup
      new Vector3(-15, 0.5, this.lzPosition.z + 140),
      new Vector3(5, 0.5, this.lzPosition.z + 100), // Mid-route
      new Vector3(-8, 0.5, this.lzPosition.z + 60),
      new Vector3(12, 0.5, this.lzPosition.z + 30), // Near dropship
    ];

    const healAmounts = [25, 20, 30, 20, 35]; // Varying heal amounts

    const pickupMat = new StandardMaterial('healthPickupMat', this.scene);
    pickupMat.diffuseColor = new Color3(0.1, 0.8, 0.2);
    pickupMat.emissiveColor = new Color3(0.1, 0.5, 0.1);
    pickupMat.alpha = 0.9;

    for (let i = 0; i < pickupPositions.length; i++) {
      // Create health pickup mesh - a glowing medical crate
      const pickup = MeshBuilder.CreateBox(
        `healthPickup_${i}`,
        { width: 1.2, height: 0.8, depth: 0.8 },
        this.scene
      );
      pickup.material = pickupMat;
      pickup.position = pickupPositions[i];

      // Add a cross on top for visibility
      const cross1 = MeshBuilder.CreateBox(
        `cross1_${i}`,
        { width: 0.6, height: 0.1, depth: 0.15 },
        this.scene
      );
      cross1.material = pickupMat;
      cross1.position = pickupPositions[i].clone();
      cross1.position.y += 0.45;
      cross1.parent = pickup;

      const cross2 = MeshBuilder.CreateBox(
        `cross2_${i}`,
        { width: 0.15, height: 0.1, depth: 0.6 },
        this.scene
      );
      cross2.material = pickupMat;
      cross2.position.y = 0.45;
      cross2.parent = pickup;

      // Add a glow light for visibility
      const glowLight = new PointLight(`pickupLight_${i}`, pickupPositions[i], this.scene);
      glowLight.diffuse = new Color3(0.2, 1, 0.3);
      glowLight.intensity = 15;
      glowLight.range = 10;
      glowLight.parent = pickup;

      this.healthPickups.push({
        mesh: pickup,
        collected: false,
        healAmount: healAmounts[i],
      });
    }
  }

  /**
   * Create crumbling walls that collapse during the escape, forcing alternate routes.
   * Some paths will be blocked, adding tension and unpredictability.
   */
  private createCrumblingWalls(): void {
    const wallPositions = [
      { pos: new Vector3(-30, 0, this.lzPosition.z + 120), rotY: 0.3 },
      { pos: new Vector3(25, 0, this.lzPosition.z + 80), rotY: -0.2 },
      { pos: new Vector3(-20, 0, this.lzPosition.z + 50), rotY: 0.4 },
    ];

    const wallMat = new StandardMaterial('crumblingWallMat', this.scene);
    wallMat.diffuseColor = Color3.FromHexString('#5A4A3A');
    wallMat.specularColor = new Color3(0.1, 0.1, 0.1);

    for (let i = 0; i < wallPositions.length; i++) {
      const wall = MeshBuilder.CreateBox(
        `crumblingWall_${i}`,
        { width: 15, height: 25, depth: 4 },
        this.scene
      );
      wall.material = wallMat;
      wall.position = wallPositions[i].pos.clone();
      wall.position.y = 12.5; // Start upright
      wall.rotation.y = wallPositions[i].rotY;

      this.crumblingWalls.push({
        mesh: wall,
        progress: 0,
        startY: 12.5,
      });
    }
  }

  /**
   * Create an objective marker at the dropship location to guide the player.
   */
  private createObjectiveMarker(): void {
    // Create a vertical beacon cylinder
    this.objectiveMarker = MeshBuilder.CreateCylinder(
      'objectiveMarker',
      { height: 100, diameter: 6 },
      this.scene
    );
    const markerMat = new StandardMaterial('objectiveMarkerMat', this.scene);
    markerMat.emissiveColor = new Color3(0.2, 0.8, 1);
    markerMat.alpha = 0.3;
    markerMat.disableLighting = true;
    this.objectiveMarker.material = markerMat;
    this.objectiveMarker.position = this.dropshipCollapsePosition.clone();
    this.objectiveMarker.position.y = 50;

    // Add pulsing light at the base
    this.objectiveBeacon = new PointLight(
      'objectiveBeacon',
      this.dropshipCollapsePosition.clone(),
      this.scene
    );
    this.objectiveBeacon.diffuse = new Color3(0.3, 0.9, 1);
    this.objectiveBeacon.intensity = 80;
    this.objectiveBeacon.range = 100;
  }

  /**
   * Spawn occasional enemy stragglers during the collapse escape.
   * These provide light resistance without overwhelming the player.
   */
  private spawnCollapseEnemies(): void {
    // Spawn 2-4 fast skitterers as stragglers
    const stragglersCount = 2 + Math.floor(Math.random() * 3);
    const playerZ = this.camera.position.z;

    for (let i = 0; i < stragglersCount; i++) {
      // Spawn ahead of player, but not too far
      const spawnPos = new Vector3(
        (Math.random() - 0.5) * 40,
        0,
        playerZ - 30 - Math.random() * 50
      );

      // Only spawn skitterers for quick encounters
      const species = ALIEN_SPECIES['skitterer'];
      const mesh = createAlienMesh(
        this.scene,
        species,
        Date.now() + i + this.collapseEnemies.length
      );
      mesh.position = spawnPos.clone();

      const enemy: Enemy = {
        mesh,
        health: species.baseHealth * 0.5, // Weakened for escape sequence
        maxHealth: species.baseHealth * 0.5,
        position: spawnPos,
        velocity: new Vector3(0, 0, 0),
        species: 'skitterer',
        isActive: true,
      };

      this.collapseEnemies.push(enemy);
    }
  }

  /**
   * Create visual ground crack meshes that spread across the terrain.
   */
  private createGroundCracks(): void {
    const crackMat = new StandardMaterial('crackMat', this.scene);
    crackMat.diffuseColor = new Color3(0.8, 0.3, 0.1);
    crackMat.emissiveColor = new Color3(0.9, 0.4, 0.1);

    // Create cracks radiating from breach holes toward the dropship
    for (let i = 0; i < 12; i++) {
      const crack = MeshBuilder.CreateBox(
        `groundCrack_${i}`,
        { width: 2 + Math.random() * 3, height: 0.3, depth: 30 + Math.random() * 40 },
        this.scene
      );
      crack.material = crackMat;

      // Position cracks between breach holes and dropship
      const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 50 + Math.random() * 150;
      crack.position.set(Math.cos(angle) * dist * 0.3, -0.1, this.lzPosition.z + dist * 0.5);
      crack.rotation.y = angle + Math.PI / 2;

      this.groundCracks.push(crack);
    }
  }

  /**
   * Spawn a dramatic hive eruption effect at the given position.
   * Creates a geyser of debris and particles bursting from the ground.
   */
  private spawnHiveEruption(position: Vector3): void {
    // Create eruption pillar
    const eruptionMat = new StandardMaterial('eruptionMat', this.scene);
    eruptionMat.diffuseColor = new Color3(0.4, 0.2, 0.3);
    eruptionMat.emissiveColor = new Color3(0.6, 0.2, 0.1);

    const pillar = MeshBuilder.CreateCylinder(
      `eruption_${Date.now()}`,
      { height: 40, diameterTop: 8, diameterBottom: 15, tessellation: 8 },
      this.scene
    );
    pillar.material = eruptionMat;
    pillar.position = position.clone();
    pillar.position.y = -15; // Start below ground

    this.hiveEruptionMeshes.push(pillar);

    // Animate pillar rising
    const riseAnim = new Animation(
      'eruptionRise',
      'position.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    riseAnim.setKeys([
      { frame: 0, value: -15 },
      { frame: 30, value: 5 },
      { frame: 60, value: 3 },
    ]);
    pillar.animations = [riseAnim];
    this.scene.beginAnimation(pillar, 0, 60, false);

    // Emit explosion particles
    particleManager.emitExplosion(position.clone(), 2);

    // Spawn debris chunks
    for (let i = 0; i < 8; i++) {
      this.spawnCollapseDebris(position);
    }
  }

  /**
   * Spawn a debris chunk during the collapse sequence.
   */
  private spawnCollapseDebris(originPosition?: Vector3): void {
    const debris = MeshBuilder.CreatePolyhedron(
      `collapseDebris_${Date.now()}_${Math.random()}`,
      { type: Math.floor(Math.random() * 4), size: 0.5 + Math.random() * 1.5 },
      this.scene
    );

    const debrisMat = new StandardMaterial('collapseDebrisMat', this.scene);
    debrisMat.diffuseColor = new Color3(0.4, 0.25, 0.2);
    debris.material = debrisMat;

    // Spawn from origin or random position near player path
    let spawnPos: Vector3;
    if (originPosition) {
      spawnPos = originPosition.clone();
      spawnPos.y = 10 + Math.random() * 20;
      spawnPos.x += (Math.random() - 0.5) * 10;
      spawnPos.z += (Math.random() - 0.5) * 10;
    } else {
      // Spawn ahead/around player
      const playerZ = this.camera.position.z;
      spawnPos = new Vector3(
        this.camera.position.x + (Math.random() - 0.5) * 40,
        15 + Math.random() * 25,
        playerZ - 20 - Math.random() * 60
      );
    }
    debris.position = spawnPos;

    this.debris.push({
      mesh: debris,
      velocity: new Vector3(
        (Math.random() - 0.5) * 8,
        -8 - Math.random() * 12,
        (Math.random() - 0.5) * 8
      ),
      rotationSpeed: new Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
      lifetime: 3 + Math.random() * 2,
    });
  }

  /**
   * Spawn a large stalactite/ceiling chunk that falls dramatically.
   * Creates a warning shadow on the ground before impact.
   */
  private spawnFallingStalactite(): void {
    const playerZ = this.camera.position.z;

    // Spawn position - ahead of player but within view
    const spawnX = this.camera.position.x + (Math.random() - 0.5) * 60;
    const spawnZ = playerZ - 15 - Math.random() * 80;
    const spawnY = 25 + Math.random() * 15;

    // Create stalactite mesh (elongated cone shape)
    const stalactite = MeshBuilder.CreateCylinder(
      `stalactite_${Date.now()}_${Math.random()}`,
      {
        height: 4 + Math.random() * 6,
        diameterTop: 0.3 + Math.random() * 0.5,
        diameterBottom: 1.5 + Math.random() * 2,
        tessellation: 6,
      },
      this.scene
    );

    const stalactiteMat = new StandardMaterial(`stalactiteMat_${Date.now()}`, this.scene);
    // Organic hive coloring - purplish-brown chitin
    stalactiteMat.diffuseColor = new Color3(
      0.35 + Math.random() * 0.1,
      0.25 + Math.random() * 0.1,
      0.3 + Math.random() * 0.1
    );
    stalactiteMat.specularColor = new Color3(0.15, 0.1, 0.1);
    stalactite.material = stalactiteMat;

    stalactite.position.set(spawnX, spawnY, spawnZ);
    // Random initial rotation for variety
    stalactite.rotation.set(
      Math.random() * 0.3 - 0.15,
      Math.random() * Math.PI * 2,
      Math.random() * 0.3 - 0.15
    );

    // Create warning shadow marker on ground
    const shadowMarker = MeshBuilder.CreateDisc(
      `shadowMarker_${Date.now()}`,
      { radius: 2 + Math.random() },
      this.scene
    );
    const shadowMat = new StandardMaterial(`shadowMat_${Date.now()}`, this.scene);
    shadowMat.diffuseColor = new Color3(0.8, 0.2, 0.1);
    shadowMat.emissiveColor = new Color3(0.6, 0.15, 0.05);
    shadowMat.alpha = 0.5;
    shadowMat.disableLighting = true;
    shadowMarker.material = shadowMat;
    shadowMarker.position.set(spawnX, 0.1, spawnZ);
    shadowMarker.rotation.x = Math.PI / 2;

    // Play structure groan when large chunk dislodges
    getAudioManager().play('structure_groan', { volume: 0.4 });

    this.fallingStalactites.push({
      mesh: stalactite,
      velocity: new Vector3(
        (Math.random() - 0.5) * 2,
        -2 - Math.random() * 3, // Start slow, accelerate
        (Math.random() - 0.5) * 2
      ),
      rotationSpeed: new Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 2
      ),
      hasImpacted: false,
      shadowMarker,
    });
  }

  /**
   * Update falling stalactites - physics, collision, and impact effects.
   */
  private updateFallingStalactites(deltaTime: number): void {
    const gravity = 15; // Acceleration due to gravity

    for (let i = this.fallingStalactites.length - 1; i >= 0; i--) {
      const stal = this.fallingStalactites[i];

      if (!stal.hasImpacted) {
        // Apply gravity
        stal.velocity.y -= gravity * deltaTime;

        // Update position
        stal.mesh.position.addInPlace(stal.velocity.scale(deltaTime));
        stal.mesh.rotation.addInPlace(stal.rotationSpeed.scale(deltaTime));

        // Update shadow marker to track falling position
        if (stal.shadowMarker) {
          stal.shadowMarker.position.x = stal.mesh.position.x;
          stal.shadowMarker.position.z = stal.mesh.position.z;
          // Pulse the shadow as it gets closer to impact
          const heightAboveGround = stal.mesh.position.y;
          const urgency = Math.max(0, 1 - heightAboveGround / 25);
          const pulse = 0.3 + urgency * 0.5 + Math.sin(performance.now() / 100) * 0.2 * urgency;
          const mat = stal.shadowMarker.material as StandardMaterial;
          if (mat) {
            mat.alpha = pulse;
          }
        }

        // Check for ground impact
        if (stal.mesh.position.y <= 1) {
          stal.hasImpacted = true;
          stal.mesh.position.y = 0.5;

          // Impact effects
          this.onStalactiteImpact(stal.mesh.position.clone());

          // Dispose shadow marker
          stal.shadowMarker?.dispose();
          stal.shadowMarker = null;

          // Check for player collision
          const distToPlayer = Vector3.Distance(stal.mesh.position, this.camera.position);
          if (distToPlayer < 3) {
            this.onPlayerDamaged(25); // Heavy damage from direct hit
            this.callbacks.onNotification('CEILING COLLAPSE - HEAVY DAMAGE', 1000);
            this.triggerShake(6);
          } else if (distToPlayer < 6) {
            this.onPlayerDamaged(10); // Splash damage from nearby impact
            this.callbacks.onNotification('NEAR MISS', 500);
            this.triggerShake(3);
          }
        }
      } else {
        // Already impacted - fade out and remove after delay
        const mat = stal.mesh.material as StandardMaterial;
        if (mat && mat.alpha > 0.1) {
          mat.alpha -= deltaTime * 0.5;
        } else {
          // Remove
          stal.mesh.dispose();
          this.fallingStalactites.splice(i, 1);
        }
      }
    }
  }

  /**
   * Handle stalactite impact - visual and audio effects.
   */
  private onStalactiteImpact(position: Vector3): void {
    // Heavy debris impact sound
    getAudioManager().play('debris_impact', { volume: 0.7 });

    // Cracking sound for ground fracture
    getAudioManager().play('collapse_crack', { volume: 0.5 });

    // Screen shake
    this.triggerShake(4);

    // Particle effects - dust cloud and debris
    particleManager.emitDustImpact(position, 3);
    particleManager.emitDebris(position, 2.5);

    // Spawn smaller debris chunks from impact
    for (let i = 0; i < 3; i++) {
      this.spawnCollapseDebris(position);
    }
  }

  /**
   * Update collapse audio - rumbling, cracking, alien screams.
   * Creates an immersive audio landscape during the escape.
   */
  private updateCollapseAudio(deltaTime: number): void {
    // Periodic deep rumble
    this.collapseAudioTimer -= deltaTime;
    if (this.collapseAudioTimer <= 0) {
      // Reset timer - more frequent as collapse intensifies
      this.collapseAudioTimer = this.collapseRumbleInterval * (1 - this.collapseIntensity * 0.5);
      getAudioManager().play('collapse_rumble', { volume: 0.4 + this.collapseIntensity * 0.3 });
    }

    // Structure groans during intense phases
    this.structureGroanTimer -= deltaTime;
    if (this.structureGroanTimer <= 0 && this.collapseIntensity > 0.3) {
      this.structureGroanTimer = 5 + Math.random() * 5;
      if (Math.random() < 0.4 + this.collapseIntensity * 0.3) {
        getAudioManager().play('structure_groan', { volume: 0.3 });
      }
    }

    // Occasional alien death screams (the hive is dying)
    const now = performance.now();
    if (
      now - this.lastAlienScreamTime > 8000 &&
      Math.random() < 0.02 + this.collapseIntensity * 0.03
    ) {
      this.lastAlienScreamTime = now;
      getAudioManager().play('alien_death_scream', { volume: 0.4 + Math.random() * 0.2 });
    }

    // Ground crack sounds when new cracks appear or intensity spikes
    if (Math.random() < 0.01 + this.collapseIntensity * 0.02) {
      getAudioManager().play('ground_crack', { volume: 0.3 + Math.random() * 0.2 });
    }
  }

  /**
   * Update the hive collapse sequence.
   * Handles all escape mechanics: debris, health pickups, enemy stragglers, walls, intensity.
   */
  private updateHiveCollapse(deltaTime: number): void {
    // Update countdown timer
    this.hiveCollapseTimer -= deltaTime;

    // Increase collapse intensity over time (0 to 1) - using 90 second timer
    this.collapseIntensity = Math.min(1, 1 - this.hiveCollapseTimer / 90);

    // Update shake intensity based on collapse - increasing tension over time
    const shakeIntensity = 2 + this.collapseIntensity * 6;
    this.setBaseShake(shakeIntensity);

    // Spawn debris at increasing rate
    this.collapseDebrisTimer -= deltaTime;
    const debrisSpawnRate = 0.5 - this.collapseIntensity * 0.35; // Faster as collapse progresses
    if (this.collapseDebrisTimer <= 0) {
      this.collapseDebrisTimer = debrisSpawnRate;
      this.spawnCollapseDebris();

      // Extra debris in final phase - close calls with falling debris
      if (this.collapseIntensity > 0.5) {
        this.spawnCollapseDebris();
      }
      if (this.collapseIntensity > 0.8) {
        this.spawnCollapseDebris();
        this.spawnCollapseDebris(); // Intense finale
      }
    }

    // Spawn falling stalactites/ceiling chunks at variable rate
    this.stalactiteSpawnTimer -= deltaTime;
    const stalactiteRate = this.stalactiteSpawnInterval * (1.2 - this.collapseIntensity * 0.7);
    if (this.stalactiteSpawnTimer <= 0) {
      this.stalactiteSpawnTimer = stalactiteRate;
      this.spawnFallingStalactite();

      // Extra stalactites in final intense phase
      if (this.collapseIntensity > 0.7 && Math.random() < 0.4) {
        setTimeout(() => this.spawnFallingStalactite(), 500);
      }
    }

    // Update existing debris
    this.updateDebris(deltaTime);

    // Update falling stalactites
    this.updateFallingStalactites(deltaTime);

    // Update collapse audio - rumbling, cracking, screams
    this.updateCollapseAudio(deltaTime);

    // Update health pickups - check for player collection
    this.updateHealthPickups();

    // Update crumbling walls - progressive collapse
    this.updateCrumblingWalls(deltaTime);

    // Update enemy stragglers
    this.updateCollapseEnemies(deltaTime);

    // Update objective marker pulsing
    this.updateObjectiveMarker(deltaTime);

    // Update distance to dropship
    const playerPos2D = new Vector3(this.camera.position.x, 0, this.camera.position.z);
    const dropshipPos2D = new Vector3(
      this.dropshipCollapsePosition.x,
      0,
      this.dropshipCollapsePosition.z
    );
    this.distanceToDropship = Vector3.Distance(playerPos2D, dropshipPos2D);

    // Track close calls with debris for dramatic comms
    this.checkCloseCallsWithDebris();

    // Update ground cracks glow intensity - pulsing to build tension
    for (const crack of this.groundCracks) {
      const mat = crack.material as StandardMaterial;
      if (mat) {
        const glowPulse = 0.5 + Math.sin(performance.now() / 200) * 0.3 * this.collapseIntensity;
        mat.emissiveColor = new Color3(0.9 * glowPulse, 0.4 * glowPulse, 0.1 * glowPulse);
      }
    }

    // Update collapse light intensity - grows as collapse progresses
    if (this.collapseLight) {
      this.collapseLight.intensity = 50 + this.collapseIntensity * 100;
    }

    // Update HUD with clear objective markers
    const timerInt = Math.ceil(Math.max(0, this.hiveCollapseTimer));
    let urgencyLevel = '';
    if (timerInt <= 10) {
      urgencyLevel = ' [CRITICAL]';
    } else if (timerInt <= 30) {
      urgencyLevel = ' [WARNING]';
    }
    this.callbacks.onObjectiveUpdate(
      'REACH THE DROPSHIP',
      `TIME: ${timerInt}s | DISTANCE: ${this.distanceToDropship.toFixed(0)}m${urgencyLevel}`
    );

    // Check for reaching dropship - victory condition
    if (this.distanceToDropship < 20) {
      this.callbacks.onNotification('BOARDING DROPSHIP', 2000);
      this.disposeCollapseEscapeResources();
      this.transitionToPhase('victory');
      return;
    }

    // Check for time running out - failure = death and restart from checkpoint
    if (this.hiveCollapseTimer <= 0) {
      this.onCollapseFailure();
      return;
    }

    // Dynamic comms based on progress and situation - tension building
    this.updateCollapseComms(timerInt);

    // Periodic warnings with increasing urgency
    if (timerInt === 60 && !this.collapseCommsPlayed.has('60s')) {
      this.collapseCommsPlayed.add('60s');
      this.callbacks.onNotification('60 SECONDS REMAINING', 1500);
    } else if (timerInt === 30 && !this.collapseCommsPlayed.has('30s')) {
      this.collapseCommsPlayed.add('30s');
      this.callbacks.onNotification('30 SECONDS - SPRINT!', 2000);
      this.triggerShake(4);
    } else if (timerInt === 20 && !this.collapseCommsPlayed.has('20s')) {
      this.collapseCommsPlayed.add('20s');
      this.callbacks.onNotification('20 SECONDS REMAINING', 1500);
      this.triggerShake(5);
    } else if (timerInt === 10 && !this.collapseCommsPlayed.has('10s')) {
      this.collapseCommsPlayed.add('10s');
      this.callbacks.onNotification('10 SECONDS - MOVE IT!', 1500);
      this.triggerShake(6);
    } else if (timerInt === 5 && !this.collapseCommsPlayed.has('5s')) {
      this.collapseCommsPlayed.add('5s');
      this.callbacks.onNotification('5 SECONDS!', 1000);
      this.triggerShake(7);
    }
  }

  /**
   * Check for health pickup collection and heal the player.
   */
  private updateHealthPickups(): void {
    for (const pickup of this.healthPickups) {
      if (pickup.collected) continue;

      const dist = Vector3.Distance(pickup.mesh.position, this.camera.position);
      if (dist < 3) {
        // Collect the health pickup
        pickup.collected = true;
        pickup.mesh.setEnabled(false);

        // Heal the player
        this.playerHealth = Math.min(100, this.playerHealth + pickup.healAmount);
        this.callbacks.onHealthChange(this.playerHealth);
        this.callbacks.onNotification(`+${pickup.healAmount} HEALTH`, 1000);

        // Play pickup particle effect
        particleManager.emitMuzzleFlash(pickup.mesh.position.clone(), new Vector3(0, 1, 0), 0.5);
      }
    }
  }

  /**
   * Update crumbling walls - they progressively collapse based on collapse intensity.
   */
  private updateCrumblingWalls(deltaTime: number): void {
    for (const wall of this.crumblingWalls) {
      // Start crumbling when collapse intensity reaches certain thresholds
      const startThreshold = 0.2 + wall.progress * 0.3; // Stagger the crumbling
      if (this.collapseIntensity > startThreshold && wall.progress < 1) {
        wall.progress += deltaTime * 0.3;

        // Rotate wall forward as it falls
        wall.mesh.rotation.x = wall.progress * (Math.PI / 2);

        // Lower the wall as it falls
        wall.mesh.position.y = wall.startY * (1 - wall.progress * 0.5);

        // Trigger shake when wall starts falling
        if (wall.progress > 0.1 && wall.progress < 0.15) {
          this.triggerShake(3);
          particleManager.emitDebris(wall.mesh.position.clone(), 2);
        }

        // Impact when fully fallen
        if (wall.progress >= 1) {
          this.triggerShake(4);
          particleManager.emitDustImpact(wall.mesh.position.clone(), 3);
        }
      }
    }
  }

  /**
   * Update enemy stragglers during the escape - they chase the player.
   */
  private updateCollapseEnemies(deltaTime: number): void {
    const playerPos = this.camera.position;

    for (let i = this.collapseEnemies.length - 1; i >= 0; i--) {
      const enemy = this.collapseEnemies[i];
      if (!enemy.isActive) continue;

      // Move toward player
      const toPlayer = playerPos.subtract(enemy.position);
      toPlayer.y = 0;
      const dist = toPlayer.length();

      if (dist > 3) {
        toPlayer.normalize();
        const species = ALIEN_SPECIES[enemy.species];
        const speed = species ? species.moveSpeed * 1.2 : 6; // Faster during escape
        enemy.velocity = toPlayer.scale(speed);
        enemy.position.addInPlace(enemy.velocity.scale(deltaTime));
        enemy.mesh.position = enemy.position.clone();
        enemy.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      } else {
        // Attack player
        this.onPlayerDamaged(3); // Light damage - don't want to be too punishing
      }

      // Remove enemies that are far behind the player (they got lost in collapse)
      if (enemy.position.z > this.camera.position.z + 50) {
        enemy.isActive = false;
        enemy.mesh.setEnabled(false);
        particleManager.emitAlienDeath(enemy.position.clone(), 0.5);
      }
    }
  }

  /**
   * Update objective marker pulsing effect.
   */
  private updateObjectiveMarker(_deltaTime: number): void {
    if (this.objectiveMarker) {
      // Pulse the marker alpha
      const pulse = 0.2 + Math.sin(performance.now() / 300) * 0.1;
      const mat = this.objectiveMarker.material as StandardMaterial;
      if (mat) {
        mat.alpha = pulse;
      }
    }

    if (this.objectiveBeacon) {
      // Pulse the beacon intensity
      const beaconPulse = 60 + Math.sin(performance.now() / 200) * 40;
      this.objectiveBeacon.intensity = beaconPulse;
    }
  }

  /**
   * Check for close calls with debris to trigger dramatic comms.
   */
  private checkCloseCallsWithDebris(): void {
    for (const d of this.debris) {
      const dist = Vector3.Distance(d.mesh.position, this.camera.position);
      if (dist < 3 && dist < this.lastCloseCallDistance && d.mesh.position.y < 4) {
        this.closeCallCount++;
        this.lastCloseCallDistance = dist;

        // Trigger dramatic comms on close calls
        if (this.closeCallCount === 2 && !this.collapseCommsPlayed.has('closeCall1')) {
          this.collapseCommsPlayed.add('closeCall1');
          this.callbacks.onCommsMessage({
            sender: 'Corporal Marcus Cole',
            callsign: 'TITAN',
            portrait: 'marcus',
            text: 'Watch the debris! That was close!',
          });
        } else if (this.closeCallCount === 5 && !this.collapseCommsPlayed.has('closeCall2')) {
          this.collapseCommsPlayed.add('closeCall2');
          this.callbacks.onCommsMessage({
            sender: 'Commander Elena Vasquez',
            callsign: 'PROMETHEUS ACTUAL',
            portrait: 'commander',
            text: 'SPECTER, keep moving! Do NOT stop for anything!',
          });
        }
      }
    }

    // Reset close call distance tracker periodically
    if (Math.random() < 0.01) {
      this.lastCloseCallDistance = Infinity;
    }
  }

  /**
   * Trigger dynamic comms based on collapse progress - tension building.
   */
  private updateCollapseComms(_timerInt: number): void {
    // Distance-based encouragement
    if (this.distanceToDropship < 100 && !this.collapseCommsPlayed.has('almost')) {
      this.collapseCommsPlayed.add('almost');
      this.callbacks.onCommsMessage({
        sender: 'Dropship Pilot',
        callsign: 'SALVATION',
        portrait: 'ai',
        text: 'I can see you! Keep coming! Ramp is down!',
      });
    }

    if (this.distanceToDropship < 50 && !this.collapseCommsPlayed.has('soClose')) {
      this.collapseCommsPlayed.add('soClose');
      this.callbacks.onCommsMessage({
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "You're almost there! DON'T STOP!",
      });
    }

    // Low health warning
    if (this.playerHealth < 30 && !this.collapseCommsPlayed.has('lowHealth')) {
      this.collapseCommsPlayed.add('lowHealth');
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Warning: Suit integrity critical. Medical supplies detected ahead. Recommend immediate retrieval.',
      });
    }
  }

  /**
   * Dispose collapse escape-specific resources.
   */
  private disposeCollapseEscapeResources(): void {
    // Dispose health pickups
    for (const pickup of this.healthPickups) {
      pickup.mesh.dispose();
    }
    this.healthPickups = [];

    // Dispose crumbling walls
    for (const wall of this.crumblingWalls) {
      wall.mesh.dispose();
    }
    this.crumblingWalls = [];

    // Dispose collapse enemies
    for (const enemy of this.collapseEnemies) {
      enemy.mesh.dispose();
    }
    this.collapseEnemies = [];

    // Dispose falling stalactites and their shadow markers
    for (const stal of this.fallingStalactites) {
      stal.mesh.dispose();
      stal.shadowMarker?.dispose();
    }
    this.fallingStalactites = [];

    // Dispose objective marker
    this.objectiveMarker?.dispose();
    this.objectiveMarker = null;
    this.objectiveBeacon?.dispose();
    this.objectiveBeacon = null;
  }

  /**
   * Handle failure to reach the dropship in time.
   */
  private onCollapseFailure(): void {
    this.callbacks.onNotification('COLLAPSE - KIA', 3000);
    this.triggerShake(10);
    this.setBaseShake(8);

    // Could trigger game over screen here
    // For now, give a second chance
    setTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: "NO! Hold on, I'm coming for you!",
      });

      // Marcus saves the player - extend timer and teleport closer
      this.hiveCollapseTimer = 15;
      const newPos = this.dropshipCollapsePosition.clone();
      newPos.z += 40;
      this.camera.position.set(newPos.x, 1.7, newPos.z);

      this.callbacks.onNotification('MARCUS IS COVERING YOU - MOVE', 2000);
    }, 2000);
  }

  /**
   * Dispose hive collapse-specific resources.
   */
  private disposeCollapseEffects(): void {
    this.hiveEruptionMeshes.forEach((m) => m.dispose());
    this.hiveEruptionMeshes = [];

    this.groundCracks.forEach((c) => c.dispose());
    this.groundCracks = [];

    this.collapseLight?.dispose();
    this.collapseLight = null;

    this.collapseEffects.forEach((e) => e.mesh.dispose());
    this.collapseEffects = [];
  }

  // ============================================================================
  // DROPSHIP AND VICTORY
  // ============================================================================

  // Victory cinematic state
  private victoryCinematicActive = false;
  private victoryCinematicBeat = 0;
  private victoryCinematicTimeouts: ReturnType<typeof setTimeout>[] = [];

  // Dropship spotlight effect
  private dropshipSpotlight: PointLight | null = null;

  // Sky arrival visual indicator - visible light/contrail before dropship arrives
  private dropshipSkyIndicator: PointLight | null = null;
  private dropshipContrail: Mesh | null = null;
  private contrailUpdateInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the dramatic dropship arrival sequence.
   * The dropship descends from high altitude with engine effects,
   * clears remaining enemies, and triggers the victory cinematic.
   *
   * CINEMATIC SEQUENCE:
   * 1. Sky indicator light appears in the distance (2s lead time)
   * 2. Contrail forms as dropship approaches
   * 3. Commander Reyes victory comms
   * 4. Dramatic landing with dust effects
   * 5. Boarding and epilogue
   */
  private startDropshipArrival(): void {
    if (!this.dropship) return;

    // Start cinematic mode
    this.victoryCinematicActive = true;
    this.victoryCinematicBeat = 0;
    this.callbacks.onCinematicStart?.();

    // Dispose any remaining collapse effects
    this.disposeCollapseEffects();
    this.setBaseShake(0);

    // ========== PHASE 0: SKY INDICATOR (Pre-arrival visual) ==========
    // Create a bright light visible in the distant sky before dropship model appears
    this.createDropshipSkyIndicator();

    // Initial notification - player sees a bright light approaching
    this.callbacks.onNotification('CONTACT - INCOMING FRIENDLY', 2000);
    this.callbacks.onObjectiveUpdate('EXTRACTION', 'Dropship detected - Stand by...');

    // Play radio chatter sound
    getAudioManager().play('comms_open');

    // ATHENA detection comms
    this.scheduleVictoryTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text: 'Detecting friendly transponder. Dropship SALVATION on final approach vector. ETA 30 seconds to touchdown.',
      });
    }, 200);

    // Commander Reyes celebratory comms - victory is within reach
    this.scheduleVictoryTimeout(() => {
      getAudioManager().play('comms_open');
      this.callbacks.onCommsMessage({
        sender: 'Commander Elena Vasquez',
        callsign: 'PROMETHEUS ACTUAL',
        portrait: 'commander',
        text: "You did it, Cole brothers! You actually did it! The Queen is dead and you're still standing! Get to that LZ - your ride home is inbound!",
      });
    }, 1500);

    // ========== PHASE 1: DROPSHIP APPEARS (after 2s sky indicator) ==========
    this.scheduleVictoryTimeout(() => {
      this.dropship!.setEnabled(true);

      // Create dramatic spotlight from dropship
      this.createDropshipSpotlight();

      // Start dropship engine sound
      this.startDropshipEngineSounds();

      // Start engine thrust particle effects
      this.startEngineThrustEffects();

      // Start contrail effect following the dropship
      this.startDropshipContrail();

      // Initial dropship position - high and distant
      const approachStartPos = new Vector3(100, 300, this.lzPosition.z - 400);
      const hoverPos = new Vector3(0, 60, this.lzPosition.z - 50);
      const landingPos = new Vector3(0, 6, this.lzPosition.z);

      this.dropship!.position = approachStartPos;
      this.dropship!.rotation.y = Math.PI;

      // Phase 1: Approach announcement
      this.callbacks.onNotification('SALVATION INBOUND', 3000);
      this.callbacks.onObjectiveUpdate('EXTRACTION', 'Dropship approaching - Hold position!');
      this.triggerShake(2);

      // Dispose sky indicator as dropship becomes visible
      this.disposeDropshipSkyIndicator();

      // Pilot comms
      this.scheduleVictoryTimeout(() => {
        getAudioManager().play('comms_open');
        this.callbacks.onCommsMessage({
          sender: 'Dropship Pilot',
          callsign: 'SALVATION',
          portrait: 'ai',
          text: 'SALVATION on final approach! Touchdown in 25 seconds! I see the LZ beacon - clearing hot!',
        });
      }, 1000);

      // Marcus reaction to seeing the dropship
      this.scheduleVictoryTimeout(() => {
        getAudioManager().play('comms_open');
        this.callbacks.onCommsMessage({
          sender: 'Corporal Marcus Cole',
          callsign: 'TITAN',
          portrait: 'marcus',
          text: "There she is! Most beautiful thing I've ever seen! We're going home, brother!",
        });
      }, 3500);

      // Phase 2: Approach animation (8 seconds)
      this.animateDropshipApproach(approachStartPos, hoverPos, 8000, () => {
        this.disposeDropshipContrail();
        this.onDropshipHovering(hoverPos, landingPos);
      });

      // Clear enemies progressively during approach
      this.scheduleVictoryTimeout(() => {
        this.clearRemainingEnemies();
      }, 2000);

      // Cinematic camera: look up at approaching dropship
      this.animateCinematicCamera(
        new Vector3(this.lzPosition.x, 2, this.lzPosition.z + 30),
        new Vector3(0, 60, this.lzPosition.z - 50),
        3000
      );
    }, 2000); // 2 second delay for sky indicator to build anticipation
  }

  /**
   * Create a bright indicator light visible in the distant sky
   * before the dropship model appears. Creates anticipation.
   */
  private createDropshipSkyIndicator(): void {
    // Bright point light in the distant sky
    const skyPos = new Vector3(150, 350, this.lzPosition.z - 500);

    this.dropshipSkyIndicator = new PointLight('dropshipSkyIndicator', skyPos, this.scene);
    this.dropshipSkyIndicator.diffuse = new Color3(0.9, 0.95, 1); // Bright white-blue
    this.dropshipSkyIndicator.intensity = 200;
    this.dropshipSkyIndicator.range = 800;

    // Animate the light moving closer with pulsing intensity
    const frameRate = 30;
    const posAnim = new Animation(
      'skyIndicatorApproach',
      'position',
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    posAnim.setKeys([
      { frame: 0, value: skyPos },
      { frame: 60, value: new Vector3(100, 300, this.lzPosition.z - 400) },
    ]);

    const intensityAnim = new Animation(
      'skyIndicatorPulse',
      'intensity',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    intensityAnim.setKeys([
      { frame: 0, value: 150 },
      { frame: 15, value: 250 },
      { frame: 30, value: 150 },
    ]);

    this.dropshipSkyIndicator.animations = [posAnim, intensityAnim];
    this.scene.beginAnimation(this.dropshipSkyIndicator, 0, 60, true);
  }

  /**
   * Dispose the sky indicator light when dropship becomes visible.
   */
  private disposeDropshipSkyIndicator(): void {
    if (this.dropshipSkyIndicator) {
      this.scene.stopAnimation(this.dropshipSkyIndicator);
      this.dropshipSkyIndicator.dispose();
      this.dropshipSkyIndicator = null;
    }
  }

  /**
   * Create a contrail effect following the dropship during approach.
   * Simulates atmospheric entry/jet contrail.
   */
  private startDropshipContrail(): void {
    if (!this.dropship) return;

    // Create contrail mesh - a stretched cone following the dropship
    const contrailMat = new StandardMaterial('contrailMat', this.scene);
    contrailMat.diffuseColor = new Color3(0.9, 0.95, 1);
    contrailMat.emissiveColor = new Color3(0.3, 0.4, 0.5);
    contrailMat.alpha = 0.4;

    this.dropshipContrail = MeshBuilder.CreateCylinder(
      'dropshipContrail',
      { height: 150, diameterTop: 0.5, diameterBottom: 8, tessellation: 8 },
      this.scene
    );
    this.dropshipContrail.material = contrailMat;
    this.dropshipContrail.rotation.x = Math.PI / 2 + 0.3; // Angled behind dropship
    this.dropshipContrail.parent = this.dropship;
    this.dropshipContrail.position.set(0, 0, 80); // Behind the dropship

    // Update contrail position and fade during approach
    this.contrailUpdateInterval = setInterval(() => {
      if (!this.dropshipContrail || !this.victoryCinematicActive) {
        this.disposeDropshipContrail();
        return;
      }

      // Fade contrail as dropship slows down
      const dropshipY = this.dropship?.position.y ?? 100;
      const fadeProgress = Math.max(0, (dropshipY - 60) / 240); // Fade out below 60m
      contrailMat.alpha = 0.4 * fadeProgress;

      // Emit smoke particles along contrail
      if (fadeProgress > 0.2 && Math.random() < 0.4) {
        const contrailWorldPos = this.dropshipContrail.getAbsolutePosition();
        particleManager.emit('smoke', contrailWorldPos.clone(), { scale: 0.3 });
      }
    }, 100);
  }

  /**
   * Dispose the contrail effect.
   */
  private disposeDropshipContrail(): void {
    if (this.contrailUpdateInterval) {
      clearInterval(this.contrailUpdateInterval);
      this.contrailUpdateInterval = null;
    }
    if (this.dropshipContrail) {
      this.dropshipContrail.dispose();
      this.dropshipContrail = null;
    }
  }

  /**
   * Start dropship engine audio loop.
   */
  private startDropshipEngineSounds(): void {
    try {
      const proceduralAudio = (getAudioManager() as any).proceduralAudio;
      if (proceduralAudio && typeof proceduralAudio.generateDropshipEngine === 'function') {
        this.dropshipEngineSound = proceduralAudio.generateDropshipEngine(0.4);
      }
    } catch (e) {
      console.warn('[ExtractionLevel] Could not start dropship engine sound:', e);
    }
  }

  /**
   * Stop dropship engine sounds.
   */
  private stopDropshipEngineSounds(): void {
    if (this.dropshipEngineSound) {
      this.dropshipEngineSound.stop();
      this.dropshipEngineSound = null;
    }
  }

  /**
   * Start continuous engine thrust particle effects.
   */
  private startEngineThrustEffects(): void {
    this.engineThrustInterval = setInterval(() => {
      if (!this.victoryCinematicActive || !this.dropship) {
        this.stopEngineThrustEffects();
        return;
      }

      for (const emitter of this.dropshipThrustEmitters) {
        const worldPos = emitter.getAbsolutePosition();
        particleManager.emit('smoke', worldPos.clone(), { scale: 0.6 });
        if (Math.random() < 0.3) {
          particleManager.emitDustImpact(new Vector3(worldPos.x, 0.5, worldPos.z), 1.5);
        }
      }
    }, 200);
  }

  /**
   * Stop engine thrust particle effects.
   */
  private stopEngineThrustEffects(): void {
    if (this.engineThrustInterval) {
      clearInterval(this.engineThrustInterval);
      this.engineThrustInterval = null;
    }
  }

  /**
   * Create a dramatic spotlight effect from the dropship.
   */
  private createDropshipSpotlight(): void {
    if (!this.dropship) return;

    this.dropshipSpotlight = new PointLight('dropshipSpot', new Vector3(0, -10, 0), this.scene);
    this.dropshipSpotlight.diffuse = Color3.FromHexString('#FFFAE0');
    this.dropshipSpotlight.intensity = 0;
    this.dropshipSpotlight.range = 150;
    this.dropshipSpotlight.parent = this.dropship;

    // Animate spotlight fade-in
    const spotlightAnim = new Animation(
      'spotlightFadeIn',
      'intensity',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    spotlightAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 60, value: 80 },
      { frame: 120, value: 120 },
    ]);
    this.dropshipSpotlight.animations = [spotlightAnim];
    this.scene.beginAnimation(this.dropshipSpotlight, 0, 120, false);
  }

  /**
   * Animate the dropship approach from distant position to hover point.
   */
  private animateDropshipApproach(
    startPos: Vector3,
    endPos: Vector3,
    duration: number,
    onComplete: () => void
  ): void {
    if (!this.dropship) return;

    const frameRate = 30;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    // Position animation with dramatic easing
    const posAnim = new Animation(
      'dropshipApproach',
      'position',
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    posAnim.setEasingFunction(easing);

    posAnim.setKeys([
      { frame: 0, value: startPos },
      { frame: Math.round(totalFrames * 0.6), value: new Vector3(50, 150, endPos.z - 100) },
      { frame: totalFrames, value: endPos },
    ]);

    // Banking animation - dropship tilts during approach
    const bankAnim = new Animation(
      'dropshipBank',
      'rotation.z',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    bankAnim.setKeys([
      { frame: 0, value: 0.15 },
      { frame: Math.round(totalFrames * 0.3), value: -0.2 },
      { frame: Math.round(totalFrames * 0.7), value: 0.1 },
      { frame: totalFrames, value: 0 },
    ]);

    // Heading adjustment
    const headingAnim = new Animation(
      'dropshipHeading',
      'rotation.y',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    headingAnim.setKeys([
      { frame: 0, value: Math.PI + 0.3 },
      { frame: totalFrames, value: Math.PI },
    ]);

    this.dropship.animations = [posAnim, bankAnim, headingAnim];
    this.scene.beginAnimation(this.dropship, 0, totalFrames, false, 1, onComplete);

    // Engine rumble shake during approach
    this.setBaseShake(1.5);
  }

  /**
   * Handle dropship hovering phase before landing.
   */
  private onDropshipHovering(hoverPos: Vector3, landingPos: Vector3): void {
    if (!this.dropship) return;

    this.victoryCinematicBeat = 1;
    this.callbacks.onNotification('CLEARING LZ', 2000);

    // Hovering engine effect - dust cloud below
    this.emitLandingDust(this.lzPosition, 2.0);

    // Heavy rumble during hover
    this.setBaseShake(2.5);
    this.triggerShake(4);

    // Comms during hover
    this.scheduleVictoryTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Dropship Pilot',
        callsign: 'SALVATION',
        portrait: 'ai',
        text: 'LZ is hot but manageable! Commencing landing sequence!',
      });
    }, 1000);

    // Camera: dramatic low angle looking up at hovering dropship
    this.animateCinematicCamera(
      new Vector3(this.lzPosition.x - 15, 1.5, this.lzPosition.z + 25),
      hoverPos,
      2000
    );

    // Start landing descent after hover pause
    this.scheduleVictoryTimeout(() => {
      this.animateDropshipLanding(hoverPos, landingPos, 6000, () => {
        this.onDropshipLanded();
      });
    }, 3000);
  }

  /**
   * Animate the final landing descent with enhanced effects.
   */
  private animateDropshipLanding(
    startPos: Vector3,
    endPos: Vector3,
    duration: number,
    onComplete: () => void
  ): void {
    if (!this.dropship) return;

    this.victoryCinematicBeat = 2;
    this.callbacks.onNotification('TOUCHDOWN IMMINENT', 2000);

    const frameRate = 30;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    // Smooth landing descent
    const posAnim = new Animation(
      'dropshipLanding',
      'position',
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    posAnim.setEasingFunction(easing);

    // Multi-phase landing: hover adjust, then slow descent
    posAnim.setKeys([
      { frame: 0, value: startPos },
      { frame: Math.round(totalFrames * 0.2), value: new Vector3(0, 40, endPos.z) },
      { frame: Math.round(totalFrames * 0.5), value: new Vector3(0, 20, endPos.z) },
      { frame: Math.round(totalFrames * 0.8), value: new Vector3(0, 10, endPos.z) },
      { frame: totalFrames, value: endPos },
    ]);

    // Stabilization animation - subtle corrections
    const pitchAnim = new Animation(
      'dropshipPitch',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    pitchAnim.setKeys([
      { frame: 0, value: -0.05 },
      { frame: Math.round(totalFrames * 0.5), value: 0.02 },
      { frame: totalFrames, value: 0 },
    ]);

    this.dropship.animations = [posAnim, pitchAnim];
    this.scene.beginAnimation(this.dropship, 0, totalFrames, false, 1, onComplete);

    // Intensifying dust effect as dropship descends
    this.scheduleVictoryTimeout(() => {
      this.emitLandingDust(this.lzPosition, 3.0);
    }, duration * 0.3);

    this.scheduleVictoryTimeout(() => {
      this.emitLandingDust(this.lzPosition, 4.0);
      this.triggerShake(5);
    }, duration * 0.6);

    // Camera: pull back for wide landing shot
    this.animateCinematicCamera(
      new Vector3(this.lzPosition.x + 25, 4, this.lzPosition.z + 40),
      new Vector3(0, 10, this.lzPosition.z),
      4000
    );
  }

  /**
   * Emit landing dust cloud particle effects.
   */
  private emitLandingDust(position: Vector3, scale: number): void {
    // Multiple dust bursts in a ring around landing zone
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dustPos = new Vector3(
        position.x + Math.cos(angle) * 12,
        0.5,
        position.z + Math.sin(angle) * 12
      );
      particleManager.emitDustImpact(dustPos, scale);
    }

    // Center dust cloud
    particleManager.emitDebris(new Vector3(position.x, 1, position.z), scale * 0.7);
  }

  /**
   * Handle dropship touchdown and victory sequence start.
   */
  private onDropshipLanded(): void {
    this.victoryCinematicBeat = 3;

    // Activate slow-mo for dramatic touchdown
    this.activateSlowMo(0.3, 2000);

    // Landing impact with enhanced effects
    this.triggerShake(6);
    this.setBaseShake(0);
    particleManager.emitDustImpact(this.lzPosition, 5.0);
    getAudioManager().play('explosion', { volume: 0.6 }); // Landing thump
    this.emitLandingDust(this.lzPosition, 6.0); // Large dust cloud

    this.callbacks.onNotification('DROPSHIP DOWN - BOARD NOW!', 3000);
    this.callbacks.onObjectiveUpdate('EXTRACTION', 'Board the dropship!');

    // Marcus's mech dramatic collapse
    if (this.mechMesh) {
      this.mechIntegrity = 0;

      this.scheduleVictoryTimeout(() => {
        this.callbacks.onCommsMessage({
          sender: 'Corporal Marcus Cole',
          callsign: 'TITAN',
          portrait: 'marcus',
          text: "Titan's reactor is critical... power cells depleted. But we did it, James. We made it.",
        });
      }, 1500);

      // Dramatic mech collapse animation
      this.animateMechCollapse();
    }

    // Dropship ramp/door opening effect (light change)
    // Animate the ramp opening
    this.scheduleVictoryTimeout(() => {
      this.animateRampOpening();
    }, 1500);

    // Dropship ramp/door opening effect (light change)
    this.scheduleVictoryTimeout(() => {
      if (this.dropshipLight) {
        this.dropshipLight.intensity = 150;
        this.dropshipLight.diffuse = Color3.FromHexString('#90E0FF');
      }
      // Turn on ramp interior light
      if (this.dropshipRampLight) {
        this.dropshipRampLight.intensity = 60;
      }
    }, 2000);

    // Create boarding objective marker
    this.scheduleVictoryTimeout(() => {
      this.createBoardingMarker();
    }, 2500);

    // Final approach comms
    this.scheduleVictoryTimeout(() => {
      getAudioManager().play('comms_open');
      this.callbacks.onCommsMessage({
        sender: 'Dropship Pilot',
        callsign: 'SALVATION',
        portrait: 'ai',
        text: 'Ramp is down! Get your asses on board, Marines! We are leaving!',
      });
    }, 2500);

    // Camera: dramatic shot of player approaching dropship
    this.scheduleVictoryTimeout(() => {
      this.animateCinematicCamera(
        new Vector3(this.lzPosition.x, 2, this.lzPosition.z - 20),
        new Vector3(0, 4, this.lzPosition.z),
        3000
      );
    }, 1000);

    // Transition to boarding sequence
    this.scheduleVictoryTimeout(() => {
      this.startBoardingSequence();
    }, 6000);
  }

  /**
   * Animate Marcus's mech collapsing after power depletion.
   */
  private animateMechCollapse(): void {
    if (!this.mechMesh) return;

    const frameRate = 30;

    // Multi-phase collapse: stagger, then fall
    const fallAnim = new Animation(
      'mechFall',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN);
    fallAnim.setEasingFunction(easing);

    fallAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 15, value: -0.05 }, // Stagger back
      { frame: 30, value: 0.1 }, // Lean forward
      { frame: 90, value: Math.PI / 3 }, // Fall forward
    ]);

    // Sideways sway during fall
    const swayAnim = new Animation(
      'mechSway',
      'rotation.z',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    swayAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 45, value: 0.1 },
      { frame: 90, value: -0.15 },
    ]);

    this.mechMesh.animations = [fallAnim, swayAnim];
    this.scene.beginAnimation(this.mechMesh, 0, 90, false, 1, () => {
      // Impact effect when mech hits ground
      this.triggerShake(4);
      if (this.mechMesh) {
        particleManager.emitDebris(this.mechMesh.position.clone(), 2.0);
      }
    });
  }

  /**
   * Activate slow-motion effect for dramatic moments.
   */
  private activateSlowMo(timeScale: number, duration: number): void {
    this.slowMoActive = true;
    this.slowMoTimeScale = timeScale;
    this.scheduleVictoryTimeout(() => {
      this.deactivateSlowMo();
    }, duration * timeScale);
  }

  /**
   * Deactivate slow-motion effect.
   */
  private deactivateSlowMo(): void {
    this.slowMoActive = false;
    this.slowMoTimeScale = 1.0;
  }

  /**
   * Animate the dropship ramp lowering.
   */
  private animateRampOpening(): void {
    if (!this.dropshipRamp) return;
    const frameRate = 30;
    const rampAnim = new Animation(
      'rampOpen',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    rampAnim.setEasingFunction(easing);
    rampAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 30, value: -0.3 },
      { frame: 90, value: -1.2 },
    ]);
    this.dropshipRamp.animations = [rampAnim];
    this.scene.beginAnimation(this.dropshipRamp, 0, 90, false);
  }

  /**
   * Animate the dropship ramp closing during takeoff.
   */
  private animateRampClosing(): void {
    if (!this.dropshipRamp) return;
    const frameRate = 30;
    const rampAnim = new Animation(
      'rampClose',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN);
    rampAnim.setEasingFunction(easing);
    rampAnim.setKeys([
      { frame: 0, value: -1.2 },
      { frame: 60, value: -0.3 },
      { frame: 90, value: 0 },
    ]);
    this.dropshipRamp.animations = [rampAnim];
    this.scene.beginAnimation(this.dropshipRamp, 0, 90, false);
  }

  /**
   * Create the boarding objective marker at the dropship ramp.
   */
  private createBoardingMarker(): void {
    if (!this.dropship) return;
    const markerMat = new StandardMaterial('boardingMarkerMat', this.scene);
    markerMat.emissiveColor = new Color3(0.2, 1, 0.3);
    markerMat.alpha = 0.7;
    this.boardingMarker = MeshBuilder.CreateCylinder(
      'boardingMarker',
      { height: 15, diameter: 4 },
      this.scene
    );
    this.boardingMarker.material = markerMat;
    const rampWorldPos = new Vector3(this.lzPosition.x, 0, this.lzPosition.z + 10);
    this.boardingMarker.position = new Vector3(rampWorldPos.x, 7.5, rampWorldPos.z);
    this.boardingBeacon = new PointLight(
      'boardingBeacon',
      new Vector3(rampWorldPos.x, 2, rampWorldPos.z),
      this.scene
    );
    this.boardingBeacon.diffuse = new Color3(0.2, 1, 0.3);
    this.boardingBeacon.intensity = 30;
    this.boardingBeacon.range = 25;
    const pulseAnim = new Animation(
      'markerPulse',
      'scaling.y',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    pulseAnim.setKeys([
      { frame: 0, value: 1 },
      { frame: 30, value: 1.2 },
      { frame: 60, value: 1 },
    ]);
    this.boardingMarker.animations = [pulseAnim];
    this.scene.beginAnimation(this.boardingMarker, 0, 60, true);
  }

  /**
   * Dispose boarding marker resources.
   */
  private disposeBoardingMarker(): void {
    this.boardingMarker?.dispose();
    this.boardingMarker = null;
    this.boardingBeacon?.dispose();
    this.boardingBeacon = null;
  }

  /**
   * Start the boarding sequence leading to epilogue.
   */
  private startBoardingSequence(): void {
    this.victoryCinematicBeat = 4;

    // Brothers boarding together dialogue
    this.callbacks.onCommsMessage({
      sender: 'Sergeant James Cole',
      callsign: 'SPECTER',
      portrait: 'player',
      text: 'Come on, Marcus. Time to go home.',
    });

    this.scheduleVictoryTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: 'Right behind you, brother. Just like old times.',
      });
    }, 3000);

    // Camera: final shot of both brothers entering dropship
    this.animateCinematicCamera(
      new Vector3(this.lzPosition.x + 10, 3, this.lzPosition.z + 5),
      new Vector3(0, 2, this.lzPosition.z),
      2500
    );

    // Fade to epilogue
    this.scheduleVictoryTimeout(() => {
      this.transitionToPhase('epilogue');
    }, 7000);
  }

  /**
   * Clear remaining enemies with dramatic effect.
   */
  private clearRemainingEnemies(): void {
    for (const enemy of this.enemies) {
      if (enemy.isActive) {
        // Emit death effect for each enemy being cleared
        particleManager.emitAlienDeath(enemy.position.clone(), 0.8);
        enemy.isActive = false;
        enemy.mesh.setEnabled(false);
        this.kills++;
      }
    }
  }

  /**
   * Animate cinematic camera to a position looking at a target.
   */
  private animateCinematicCamera(position: Vector3, lookTarget: Vector3, duration: number): void {
    const frameRate = 60;
    const totalFrames = Math.round((duration / 1000) * frameRate);

    // Calculate target rotation
    const direction = lookTarget.subtract(position);
    const targetRotationY = Math.atan2(direction.x, direction.z);
    const horizontalDistance = Math.sqrt(direction.x ** 2 + direction.z ** 2);
    const targetRotationX = -Math.atan2(direction.y, horizontalDistance);

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    // Position animation
    const posAnim = new Animation(
      'cinematicCamPos',
      'position',
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    posAnim.setEasingFunction(easing);
    posAnim.setKeys([
      { frame: 0, value: this.camera.position.clone() },
      { frame: totalFrames, value: position },
    ]);

    // Rotation Y animation
    const rotYAnim = new Animation(
      'cinematicCamRotY',
      'rotation.y',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rotYAnim.setEasingFunction(easing);
    rotYAnim.setKeys([
      { frame: 0, value: this.camera.rotation.y },
      { frame: totalFrames, value: targetRotationY },
    ]);

    // Rotation X animation
    const rotXAnim = new Animation(
      'cinematicCamRotX',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rotXAnim.setEasingFunction(easing);
    rotXAnim.setKeys([
      { frame: 0, value: this.camera.rotation.x },
      { frame: totalFrames, value: targetRotationX },
    ]);

    this.camera.animations = [posAnim, rotYAnim, rotXAnim];
    this.scene.beginAnimation(this.camera, 0, totalFrames, false);
  }

  /**
   * Schedule a timeout for the victory cinematic (tracked for cleanup).
   */
  private scheduleVictoryTimeout(callback: () => void, delay: number): void {
    const timeout = setTimeout(() => {
      if (this.victoryCinematicActive) {
        callback();
      }
    }, delay);
    this.victoryCinematicTimeouts.push(timeout);
  }

  /**
   * Clean up victory cinematic resources.
   */
  private cleanupVictoryCinematic(): void {
    // Clear all scheduled timeouts
    for (const timeout of this.victoryCinematicTimeouts) {
      clearTimeout(timeout);
    }
    this.victoryCinematicTimeouts = [];

    // Dispose spotlight
    this.dropshipSpotlight?.dispose();
    this.dropshipSpotlight = null;

    // Dispose sky indicator and contrail effects
    this.disposeDropshipSkyIndicator();
    this.disposeDropshipContrail();

    this.victoryCinematicActive = false;
  }

  /**
   * Show the epilogue sequence with final mission debriefing.
   */
  private showEpilogue(): void {
    this.victoryCinematicBeat = 5;
    this.callbacks.onCombatStateChange(false);
    this.callbacks.onCinematicEnd?.();

    // Stop engine sounds and cleanup effects
    this.stopDropshipEngineSounds();
    this.stopEngineThrustEffects();
    this.disposeBoardingMarker();
    this.animateRampClosing();

    // Play victory music
    getAudioManager().playMusic('victory', 2);

    // Unlock game completion achievement
    getAchievementManager().onGameComplete();

    // Save game progress
    saveSystem.completeLevel('extraction');
    saveSystem.setObjective('campaign_complete', true);

    // Brief flight cutscene - dropship ascends
    this.animateDropshipTakeoff();

    // "We're airborne!" comms
    this.scheduleVictoryTimeout(() => {
      getAudioManager().play('comms_open');
      this.callbacks.onCommsMessage({
        sender: 'Dropship Pilot',
        callsign: 'SALVATION',
        portrait: 'ai',
        text: "We're airborne! Good work, Marine!",
      });
    }, 2000);

    // Fade to black after takeoff begins
    this.scheduleVictoryTimeout(() => {
      this.animateFadeToBlack(2000);
    }, 3000);

    // Hide everything after fade begins
    this.scheduleVictoryTimeout(() => {
      this.setSurfaceVisible(false);
      if (this.dropship) this.dropship.setEnabled(false);
      if (this.mechMesh) this.mechMesh.setEnabled(false);
      this.enemies.forEach((e) => e.mesh.setEnabled(false));
    }, 1500);

    this.callbacks.onNotification('MISSION COMPLETE', 5000);
    this.callbacks.onObjectiveUpdate('STELLAR DESCENT', 'Mission Complete');

    // Commander debrief
    this.scheduleVictoryTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Commander Elena Vasquez',
        callsign: 'PROMETHEUS ACTUAL',
        portrait: 'commander',
        text: "Sergeants Cole... both of you. Welcome home. The Queen is dead. Kepler's Promise is secure. Outstanding work.",
      });
    }, 4000);

    // ATHENA mission summary
    this.scheduleVictoryTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'PROMETHEUS A.I.',
        callsign: 'ATHENA',
        portrait: 'ai',
        text:
          'Mission debrief complete. Hostiles eliminated: ' +
          this.kills +
          '. Casualties: Zero. Brothers reunited. Directive fulfilled: Find them. Bring them home.',
      });
    }, 10000);

    // Final Marcus dialogue
    this.scheduleVictoryTimeout(() => {
      this.callbacks.onCommsMessage({
        sender: 'Corporal Marcus Cole',
        callsign: 'TITAN',
        portrait: 'marcus',
        text: 'Thanks for coming for me, James. I knew you would.',
      });
    }, 16000);

    // Campaign complete
    this.scheduleVictoryTimeout(() => {
      this.callbacks.onObjectiveUpdate('STELLAR DESCENT', 'CAMPAIGN COMPLETE');
      this.state.completed = true;
      this.completeLevel();
    }, 20000);
  }

  /**
   * Animate scene fade to black.
   */
  private animateFadeToBlack(duration: number): void {
    const startColor = this.scene.clearColor.clone();
    const endColor = new Color4(0, 0, 0, 1);
    const startTime = performance.now();

    const fadeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / duration);

      // Lerp clear color
      this.scene.clearColor = new Color4(
        startColor.r + (endColor.r - startColor.r) * t,
        startColor.g + (endColor.g - startColor.g) * t,
        startColor.b + (endColor.b - startColor.b) * t,
        1
      );

      if (t >= 1) {
        clearInterval(fadeInterval);
      }
    }, 16);
  }

  /**
   * Animate the dropship takeoff for the victory flight cutscene.
   */
  private animateDropshipTakeoff(): void {
    if (!this.dropship) return;

    const frameRate = 30;
    const currentPos = this.dropship.position.clone();
    const takeoffPos = new Vector3(currentPos.x, 150, currentPos.z - 100);

    const posAnim = new Animation(
      'dropshipTakeoff',
      'position',
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN);
    posAnim.setEasingFunction(easing);

    posAnim.setKeys([
      { frame: 0, value: currentPos },
      { frame: 60, value: new Vector3(currentPos.x, 30, currentPos.z - 20) },
      { frame: 150, value: takeoffPos },
    ]);

    const pitchAnim = new Animation(
      'dropshipPitchUp',
      'rotation.x',
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    pitchAnim.setKeys([
      { frame: 0, value: 0 },
      { frame: 60, value: -0.2 },
      { frame: 150, value: -0.3 },
    ]);

    this.dropship.animations = [posAnim, pitchAnim];
    this.scene.beginAnimation(this.dropship, 0, 150, false);
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  protected override processMovement(deltaTime: number): void {
    if (!this.isPointerLocked()) return;

    const baseSpeed = this.getMoveSpeed();
    // Use InputTracker for sprint action (configurable keybinding)
    const isSprinting = this.inputTracker.isActionActive('sprint');
    const moveSpeed = isSprinting ? baseSpeed * 1.8 : baseSpeed;
    const speed = moveSpeed * deltaTime;

    // Calculate movement direction
    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const right = new Vector3(Math.cos(this.rotationY), 0, -Math.sin(this.rotationY));

    let dx = 0;
    let dz = 0;

    // Use InputTracker for movement actions (configurable keybindings)
    if (this.inputTracker.isActionActive('moveForward')) {
      dx += forward.x;
      dz += forward.z;
    }
    if (this.inputTracker.isActionActive('moveBackward')) {
      dx -= forward.x;
      dz -= forward.z;
    }
    if (this.inputTracker.isActionActive('moveLeft')) {
      dx -= right.x;
      dz -= right.z;
    }
    if (this.inputTracker.isActionActive('moveRight')) {
      dx += right.x;
      dz += right.z;
    }

    // Normalize and apply
    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;

      this.camera.position.x += dx;
      this.camera.position.z += dz;
    }

    // Phase-specific movement constraints
    if (this.phase === 'escape_tunnel') {
      // In escape tunnel, track progress
      this.playerEscapeProgress = Math.abs(this.camera.position.z) / this.escapeTunnelLength;

      // Clamp to tunnel bounds
      const tunnelRadius = 3.5;
      const distFromCenter = Math.sqrt(
        this.camera.position.x ** 2 + (this.camera.position.y - 1.7) ** 2
      );
      if (distFromCenter > tunnelRadius) {
        const scale = tunnelRadius / distFromCenter;
        this.camera.position.x *= scale;
      }
    }
  }

  protected override getMoveSpeed(): number {
    // Fast movement during escape phases
    if (this.phase === 'escape_tunnel' || this.phase === 'hive_collapse') {
      return 8;
    }
    return 5;
  }

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);

    // Get keybindings for reload action (configurable, default: R)
    const reloadKeys = this.inputTracker.getAllKeysForAction('reload');

    // Handle reload key during combat phases
    if (reloadKeys.includes(e.code) && (this.phase === 'holdout' || this.phase === 'surface_run')) {
      this.handleReload();
    }
  }

  protected updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;

    // Update cooldowns
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - deltaTime * 1000);
    this.flareCooldown = Math.max(0, this.flareCooldown - deltaTime * 1000);

    // Phase-specific updates
    switch (this.phase) {
      case 'escape_tunnel':
        this.updateEscapeTunnel(deltaTime);
        break;

      case 'surface_run':
        this.updateSurfaceRun(deltaTime);
        break;

      case 'holdout':
        this.updateHoldout(deltaTime);
        break;

      case 'hive_collapse':
        this.updateHiveCollapse(deltaTime);
        break;

      case 'victory':
        // Dropship animation handled elsewhere
        break;
    }
  }

  private updateEscapeTunnel(deltaTime: number): void {
    // Update escape timer
    this.escapeTimer -= deltaTime;

    // Update collapse wall position (chasing player)
    const collapseSpeed = 12 + (180 - this.escapeTimer) * 0.05; // Speeds up over time
    this.collapseDistance += collapseSpeed * deltaTime;

    if (this.collapseWall) {
      this.collapseWall.position.z = -this.collapseDistance;
    }

    // Spawn debris
    if (Math.random() < 0.3) {
      this.spawnDebris();
    }

    // Update debris
    this.updateDebris(deltaTime);

    // Check for collapse catching player
    const playerZ = Math.abs(this.camera.position.z);
    if (this.collapseDistance > playerZ + 5) {
      this.onPlayerDamaged(25);
      this.callbacks.onNotification('COLLAPSE DAMAGE', 1000);
      this.collapseDistance = playerZ - 10; // Push back slightly
    }

    // Check for escape completion
    if (this.playerEscapeProgress >= 0.95) {
      this.transitionToPhase('surface_run');
    }

    // Update HUD
    const timerColor = this.escapeTimer < 30 ? 'danger' : 'normal';
    this.callbacks.onObjectiveUpdate(
      'ESCAPE THE HIVE',
      'TIME: ' +
        Math.ceil(this.escapeTimer) +
        's | PROGRESS: ' +
        Math.floor(this.playerEscapeProgress * 100) +
        '%'
    );
  }

  private spawnDebris(): void {
    const debris = MeshBuilder.CreatePolyhedron(
      `debris_${Date.now()}`,
      { type: Math.floor(Math.random() * 4), size: 0.3 + Math.random() * 0.5 },
      this.scene
    );

    const debrisMat = new StandardMaterial('debrisMat', this.scene);
    debrisMat.diffuseColor = new Color3(0.3, 0.2, 0.25);
    debris.material = debrisMat;

    // Spawn ahead of player
    debris.position.set(
      (Math.random() - 0.5) * 6,
      3 + Math.random() * 2,
      this.camera.position.z - 20 - Math.random() * 30
    );

    this.debris.push({
      mesh: debris,
      velocity: new Vector3(
        (Math.random() - 0.5) * 2,
        -5 - Math.random() * 5,
        (Math.random() - 0.5) * 2
      ),
      rotationSpeed: new Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3),
      lifetime: 5,
    });
  }

  private updateDebris(deltaTime: number): void {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.mesh.position.addInPlace(d.velocity.scale(deltaTime));
      d.mesh.rotation.addInPlace(d.rotationSpeed.scale(deltaTime));
      d.lifetime -= deltaTime;

      // Check for collision with player
      const dist = Vector3.Distance(d.mesh.position, this.camera.position);
      if (dist < 1.5 && d.mesh.position.y < 2) {
        this.onPlayerDamaged(10);
        this.callbacks.onNotification('DEBRIS HIT', 500);
        d.mesh.dispose();
        this.debris.splice(i, 1);
        continue;
      }

      // Remove if expired or below ground
      if (d.lifetime <= 0 || d.mesh.position.y < -2) {
        d.mesh.dispose();
        this.debris.splice(i, 1);
      }
    }
  }

  private updateSurfaceRun(deltaTime: number): void {
    // Calculate distance to LZ
    const playerPos2D = new Vector3(this.camera.position.x, 0, this.camera.position.z);
    const lzPos2D = new Vector3(this.lzPosition.x, 0, this.lzPosition.z);
    this.distanceToLZ = Vector3.Distance(playerPos2D, lzPos2D);

    // Update HUD
    this.callbacks.onObjectiveUpdate(
      'REACH LZ OMEGA',
      `Distance: ${this.distanceToLZ.toFixed(0)}m`
    );

    // Spawn enemies during run
    if (Math.random() < 0.02 && this.enemies.length < 10) {
      this.spawnEnemy(Math.random() < 0.7 ? 'skitterer' : 'lurker');
    }

    // Update enemies
    this.updateEnemies(deltaTime);

    // Check for reaching LZ
    if (this.distanceToLZ < 30) {
      this.transitionToPhase('holdout');
    }
  }

  private updateHoldout(deltaTime: number): void {
    // Update dropship ETA
    this.dropshipETA -= deltaTime;

    // Update wave phase timer
    this.wavePhaseTimer += deltaTime;

    // Handle wave state machine
    switch (this.wavePhase) {
      case 'intermission':
        this.updateWaveIntermission(deltaTime);
        break;

      case 'announcement':
        this.updateWaveAnnouncement(deltaTime);
        break;

      case 'active':
        this.updateActiveWave(deltaTime);
        break;

      case 'waiting':
        // Waiting for next wave or victory
        break;
    }

    // Update enemies (always running during holdout)
    this.updateEnemies(deltaTime);

    // Update supply drops (health/ammo pickups between waves)
    this.updateSupplyDrops();

    // Decrease mech integrity over time during active combat
    if (this.wavePhase === 'active' && this.mechIntegrity > 0) {
      this.mechIntegrity -= deltaTime * 0.3;
    }

    // Update HUD based on wave phase
    this.updateHoldoutHUD();

    // Check for dropship arrival
    if (this.dropshipETA <= 0 && this.phase === 'holdout') {
      this.transitionToPhase('victory');
    }
  }

  /**
   * Update the intermission countdown phase.
   */
  private updateWaveIntermission(deltaTime: number): void {
    this.intermissionCountdown -= deltaTime;

    // Show countdown in objective
    if (this.intermissionCountdown <= 0) {
      // Transition to announcement phase
      this.startWaveAnnouncement();
    }
  }

  /**
   * Update the wave announcement phase.
   */
  private updateWaveAnnouncement(_deltaTime: number): void {
    if (this.wavePhaseTimer >= this.waveAnnouncementDuration) {
      // Transition to active wave
      this.startWave(this.currentWave);
    }
  }

  /**
   * Update the active wave combat phase.
   */
  private updateActiveWave(deltaTime: number): void {
    // Wave spawning
    if (this.enemiesToSpawn.length > 0) {
      const config = this.waveConfigs[this.currentWave - 1];
      this.waveSpawnTimer -= deltaTime;

      if (this.waveSpawnTimer <= 0) {
        this.waveSpawnTimer = config.spawnDelay;

        // Spawn next enemy from the queue
        const spawnGroup = this.enemiesToSpawn[0];
        this.spawnEnemy(spawnGroup.species);
        spawnGroup.count--;

        if (spawnGroup.count <= 0) {
          this.enemiesToSpawn.shift();
        }
      }
    }
  }

  /**
   * Update the HUD display based on current wave phase.
   */
  private updateHoldoutHUD(): void {
    const timerStr = this.formatTime(Math.max(0, this.dropshipETA));

    let title: string;
    let description: string;

    switch (this.wavePhase) {
      case 'intermission': {
        const countdownInt = Math.ceil(this.intermissionCountdown);
        title = `NEXT WAVE IN ${countdownInt}s`;
        description = `DROPSHIP ETA: ${timerStr} | KILLS: ${this.kills} | MECH: ${Math.floor(Math.max(0, this.mechIntegrity))}%`;
        break;
      }

      case 'announcement': {
        const config = this.waveConfigs[this.currentWave - 1];
        title = config.waveTitle;
        description = config.waveDescription;
        break;
      }

      case 'active': {
        const activeEnemies = this.enemies.filter((e) => e.isActive).length;
        title = `WAVE ${this.currentWave}/${this.totalWaves}`;
        description = `ENEMIES: ${activeEnemies} | DROPSHIP: ${timerStr} | MECH: ${Math.floor(Math.max(0, this.mechIntegrity))}%`;
        break;
      }

      case 'waiting':
      default: {
        title = 'LZ OMEGA - HOLDOUT';
        description = `DROPSHIP ETA: ${timerStr} | TOTAL KILLS: ${this.kills}`;
        break;
      }
    }

    this.callbacks.onObjectiveUpdate(title, description);
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  override canTransitionTo(levelId: LevelId): boolean {
    return false; // Extraction is the final level
  }

  protected disposeLevel(): void {
    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);

    // Cleanup victory cinematic resources
    this.cleanupVictoryCinematic();

    // Dispose tunnel
    this.tunnelSegments.forEach((s) => s.dispose());
    this.tunnelLights.forEach((l) => l.dispose());
    this.collapseWall?.dispose();
    this.exitLight?.dispose();
    this.debris.forEach((d) => d.mesh.dispose());

    // Dispose hive collapse effects
    this.disposeCollapseEffects();

    // Dispose collapse escape resources
    this.disposeCollapseEscapeResources();

    // Dispose surface
    this.terrain?.dispose();
    this.skyDome?.dispose();
    this.lzPad?.dispose();
    this.lzBeacon?.dispose();
    this.breachHoles.forEach((h) => h.dispose());
    this.canyonWalls.forEach((w) => w.dispose());
    this.barrierWalls.forEach((b) => b.dispose());

    // Dispose holdout arena cover objects
    this.coverObjects.forEach((c) => c.dispose());
    this.coverObjects = [];

    // Dispose supply drops
    this.supplyDrops.forEach((d) => d.mesh.dispose());
    this.supplyDrops = [];

    // Clear spawn points
    this.spawnPoints = [];

    // Dispose mech
    this.mechMesh?.dispose();
    this.mechGunLight?.dispose();

    // Dispose dropship and its spotlight
    this.dropship?.dispose();
    this.dropshipLight?.dispose();
    this.dropshipSpotlight?.dispose();

    // Dispose enemies
    this.enemies.forEach((e) => e.mesh.dispose());
  }
}
