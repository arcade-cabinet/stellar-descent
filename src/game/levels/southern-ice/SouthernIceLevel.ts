/**
 * SouthernIceLevel - Chapter 6: Frozen Wasteland Expansion
 *
 * LEVEL STRUCTURE:
 * 1. ICE FIELDS - Traverse the blizzard, reach the frozen lake
 *    - Blizzard conditions with variable visibility
 *    - Temperature mechanic: exposure timer - must reach heat sources
 *    - Marcus provides overwatch from his cold-resistant mech
 *
 * 2. FROZEN LAKE - Cross thin ice, avoid hazards
 *    - Thin ice mechanic (cracking underfoot, fall-through zones)
 *    - Dormant alien nests along the shore begin to awaken
 *    - Reduced blizzard (lake is in a valley)
 *
 * 3. ICE CAVERNS - Chitin nest, combat through to the southern hive
 *    - Indoor cave environment (shelter from blizzard)
 *    - Frozen alien nests: dormant Ice Chitins awaken as player approaches
 *    - Boss-like encounter at deepest cave before The Breach entrance
 *
 * KEY FEATURES:
 * - New Ice Chitin enemy variant (white/blue, ice shard attack, frost aura)
 * - Temperature / exposure mechanic (seek heat sources periodically)
 * - Blizzard particle system with variable intensity
 * - Aurora borealis in the sky
 * - Marcus AI ally (cold-resistant mech, provides support comms)
 * - Objective: reach the southern hive entrance (leads to The Breach)
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { fireWeapon, getWeaponActions, startReload } from '../../context/useWeaponActions';
import { getAudioManager } from '../../core/AudioManager';
import { createEntity, type Entity, removeEntity } from '../../core/ecs';
import { damageFeedback } from '../../effects/DamageFeedback';
import { particleManager } from '../../effects/ParticleManager';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { type SurfaceConfig, SurfaceLevel } from '../SurfaceLevel';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import {
  createIceEnvironment,
  disposeIceEnvironment,
  getTemperatureAtPosition,
  type IceEnvironment,
  type TemperatureZone,
  updateAuroraBorealis,
  updateBlizzardEmitter,
} from './environment';
import {
  BURROW_CONFIG,
  createDormantCocoonMesh,
  createIceChitinMesh,
  createIceShardMesh,
  FROST_AURA,
  ICE_CHITIN_RESISTANCES,
  ICE_CHITIN_SPECIES,
  ICE_SHARD_PROJECTILE,
  type IceChitinInstance,
  type IceChitinState,
} from './IceChitin';

// ============================================================================
// TYPES
// ============================================================================

type LevelPhase = 'ice_fields' | 'frozen_lake' | 'ice_caverns' | 'complete';

interface MarcusMech {
  rootNode: TransformNode;
  body: Mesh;
  position: Vector3;
  health: number;
  maxHealth: number;
}

interface ActiveProjectile {
  mesh: TransformNode;
  position: Vector3;
  direction: Vector3;
  speed: number;
  damage: number;
  lifetime: number;
  source: 'player' | 'enemy';
}

// ============================================================================
// COMMS & NARRATIVE
// ============================================================================

const COMMS = {
  // Phase 1: Ice Fields
  levelStart: {
    sender: 'CMDR. VASQUEZ',
    callsign: 'PROMETHEUS-ACTUAL',
    portrait: 'commander' as const,
    text: 'Reyes, the southern hive entrance is 2 klicks south. Watch your core temp -- that blizzard will freeze you solid in minutes. Stay near heat sources.',
  },
  marcusJoins: {
    sender: 'CPL. MARCUS COLE',
    callsign: 'IRONJAW',
    portrait: 'marcus' as const,
    text: "I'll take point, James. My mech's reactor keeps me toasty. You stick close to the heaters -- I'll call out targets.",
  },
  temperatureWarning: {
    sender: 'SUIT A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'WARNING: Core temperature critical. Seek heat source immediately or risk hypothermia.',
  },
  temperatureRecovered: {
    sender: 'SUIT A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Core temperature stabilizing. Thermal reserves restored.',
  },

  // Phase 2: Frozen Lake
  frozenLakeEnter: {
    sender: 'CPL. MARCUS COLE',
    callsign: 'IRONJAW',
    portrait: 'marcus' as const,
    text: "Careful on that ice, James. My scanners show it's only a few centimeters thick in places. I'm too heavy to follow -- I'll provide overwatch from the shore.",
  },
  iceCreaking: {
    sender: 'SUIT A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Structural integrity of ice surface: compromised. Recommend reduced movement speed.',
  },
  nestDetected: {
    sender: 'SUIT A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Biological signatures detected beneath the ice. Dormant Chitin organisms -- new strain. Designating STRAIN-X6-CRYO.',
  },

  // Phase 3: Ice Caverns
  cavernEnter: {
    sender: 'CPL. MARCUS COLE',
    callsign: 'IRONJAW',
    portrait: 'marcus' as const,
    text: 'I can squeeze through. These tunnels lead south to the main hive. Stay sharp -- my thermals show heat signatures all around us.',
  },
  dormantNest: {
    sender: 'SUIT A.I.',
    callsign: 'ATHENA',
    portrait: 'ai' as const,
    text: 'Multiple dormant Ice Chitins detected. Proximity vibrations may trigger awakening sequence.',
  },
  hiveEntrance: {
    sender: 'CPL. MARCUS COLE',
    callsign: 'IRONJAW',
    portrait: 'marcus' as const,
    text: "There it is -- the southern hive entrance. Once we're through, there's no turning back. Ready when you are.",
  },
  levelComplete: {
    sender: 'CMDR. VASQUEZ',
    callsign: 'PROMETHEUS-ACTUAL',
    portrait: 'commander' as const,
    text: 'Good work, Reyes. You and Marcus are at the breach point. Proceed with extreme caution -- we have no intel on what lies below.',
  },
};

const OBJECTIVES = {
  iceFields: {
    title: 'TRAVERSE ICE FIELDS',
    instructions: 'Move south through the blizzard. Stay near heat sources to avoid hypothermia.',
  },
  frozenLake: {
    title: 'CROSS FROZEN LAKE',
    instructions: 'Navigate across the thin ice. Avoid dark patches -- the ice is weakest there.',
  },
  iceCaverns: {
    title: 'CLEAR ICE CAVERNS',
    instructions: 'Fight through the Chitin nest. Reach the southern hive entrance.',
  },
  reachBreach: {
    title: 'REACH THE BREACH',
    instructions: 'Enter the southern hive entrance to proceed to The Breach.',
  },
};

const NOTIFICATIONS = {
  phaseIceFields: 'CHAPTER 6: SOUTHERN ICE',
  phaseFrozenLake: 'CROSSING THE FROZEN LAKE',
  phaseIceCaverns: 'ENTERING THE ICE CAVERNS',
  temperatureLow: 'HYPOTHERMIA WARNING - SEEK HEAT',
  temperatureCritical: 'CRITICAL TEMPERATURE - FIND WARMTH NOW',
  temperatureRecovered: 'TEMPERATURE STABILIZED',
  iceChitinAwake: 'DORMANT CHITIN AWAKENING',
  thinIce: 'THIN ICE - MOVE CAREFULLY',
};

// ============================================================================
// CONSTANTS
// ============================================================================

const PLAYER_MAX_HEALTH = 100;
const STARTING_GRENADES = 3;
const GRENADE_COOLDOWN = 5000; // ms
const GRENADE_RADIUS = 8;
const GRENADE_MAX_DAMAGE = 80;
const MELEE_COOLDOWN = 1000;
const MELEE_DAMAGE = 40;
const MELEE_RANGE = 3;
const DAMAGE_INVINCIBILITY_MS = 300;

// Temperature / exposure system
const EXPOSURE_MAX = 100; // Full exposure meter
const EXPOSURE_DRAIN_RATE = 8; // Per second in blizzard (empty in ~12s)
const EXPOSURE_DRAIN_RATE_COLD = 12; // Per second in cold zones
const EXPOSURE_RECOVERY_RATE = 25; // Per second near heat source
const EXPOSURE_WARNING_THRESHOLD = 40;
const EXPOSURE_CRITICAL_THRESHOLD = 15;
const EXPOSURE_DAMAGE_RATE = 10; // HP/sec when meter is 0
const EXPOSURE_DAMAGE_INTERVAL = 1000; // ms between damage ticks

// Phase transition triggers (Z positions moving south = negative Z)
const FROZEN_LAKE_TRIGGER_Z = -100;
const ICE_CAVERNS_TRIGGER_Z = -220;
const BREACH_TRIGGER_Z = -310;

// Arena bounds
const ARENA_HALF_WIDTH = 150;
const ARENA_SOUTH_BOUND = -330;
const ARENA_NORTH_BOUND = 50;

// Enemy spawn configuration per phase
const PHASE_ENEMY_COUNTS = {
  ice_fields: { dormant: 0, active: 6 },
  frozen_lake: { dormant: 8, active: 4 },
  ice_caverns: { dormant: 12, active: 6 },
} as const;

// ============================================================================
// LEVEL CLASS
// ============================================================================

export class SouthernIceLevel extends SurfaceLevel {
  // Phase management
  private phase: LevelPhase = 'ice_fields';
  private phaseTime = 0;
  private levelTime = 0;

  // Environment
  private iceEnvironment: IceEnvironment | null = null;

  // Temperature / exposure system
  private exposureMeter = EXPOSURE_MAX;
  private lastExposureDamageTick = 0;
  private hasShownExposureWarning = false;
  private hasShownExposureCritical = false;
  private isInWarmZone = false;

  // Player combat
  private playerHealth = PLAYER_MAX_HEALTH;
  private grenadeCount = STARTING_GRENADES;
  private grenadeCooldownTimer = 0;
  private meleeCooldownTimer = 0;
  private lastDamageTime = 0;
  private totalKills = 0;

  // Marcus AI ally
  private marcus: MarcusMech | null = null;

  // Ice Chitin enemies
  private iceChitins: IceChitinInstance[] = [];
  private dormantNests: { cocoon: TransformNode; position: Vector3; awoken: boolean }[] = [];
  private projectiles: ActiveProjectile[] = [];
  private nextChitinSeed = 42;

  // Blizzard intensity (varies by phase and location)
  private blizzardIntensity = 0.7;
  private targetBlizzardIntensity = 0.7;

  // Action handler
  private actionCallback: ((actionId: string) => void) | null = null;

  // Comms tracking (avoid duplicate messages)
  private sentComms = new Set<string>();

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    config: LevelConfig,
    callbacks: LevelCallbacks
  ) {
    const surfaceConfig: SurfaceConfig = {
      terrainSize: 600,
      heightScale: 10,
      timeOfDay: 0.15, // Near-night (polar conditions)
      fogDensity: 0.005,
      dustIntensity: 0,
      enemyDensity: 0.4,
      maxEnemies: 30,
    };
    super(engine, canvas, config, callbacks, surfaceConfig);
  }

  // ============================================================================
  // OVERRIDES
  // ============================================================================

  protected override getBackgroundColor(): Color4 {
    // Dark polar sky with blue-grey tones
    return new Color4(0.04, 0.05, 0.09, 1);
  }

  protected override setupBasicLighting(): void {
    // Low polar sun near the horizon
    const sunDir = new Vector3(0.3, -0.15, -0.6).normalize();
    this.sunLight = new DirectionalLight('polarSun', sunDir, this.scene);
    this.sunLight.intensity = 0.6;
    this.sunLight.diffuse = new Color3(0.7, 0.75, 0.85); // Cold blue-white

    // Ambient fill: deep blue
    const ambient = new DirectionalLight('ambientFill', new Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.25;
    ambient.diffuse = new Color3(0.3, 0.35, 0.5);
  }

  protected override getMoveSpeed(): number {
    // Slower movement in blizzard, even slower on ice
    if (this.phase === 'frozen_lake') return 5; // Cautious on ice
    if (this.exposureMeter < EXPOSURE_CRITICAL_THRESHOLD) return 4; // Freezing
    return 6; // General outdoor (slower than standard surface due to snow)
  }

  protected override getSprintMultiplier(): number {
    if (this.phase === 'frozen_lake') return 1.2; // Limited sprint on ice
    return 1.4;
  }

  // ============================================================================
  // ENVIRONMENT CREATION
  // ============================================================================

  protected override async createEnvironment(): Promise<void> {
    // Create the complete ice environment
    this.iceEnvironment = createIceEnvironment(this.scene);

    // Create Marcus mech
    this.createMarcusMech();

    // Set up initial camera position (northern edge of ice fields)
    this.camera.position.set(0, 1.7, 30);
    this.rotationY = Math.PI; // Face south
    this.targetRotationY = Math.PI;
    this.camera.rotation.y = this.rotationY;

    // Set up action handlers
    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    // Configure fog for blizzard
    this.scene.fogMode = 2; // Exponential fog
    this.scene.fogDensity = 0.012;
    this.scene.fogColor = new Color3(0.7, 0.75, 0.82);

    // Send initial comms
    this.sendComms('levelStart', COMMS.levelStart);

    // Set initial objective
    this.callbacks.onObjectiveUpdate(OBJECTIVES.iceFields.title, OBJECTIVES.iceFields.instructions);
    this.callbacks.onChapterChange(6);
    this.callbacks.onNotification(NOTIFICATIONS.phaseIceFields, 4000);

    // Marcus comms after brief delay
    setTimeout(() => {
      this.sendComms('marcusJoins', COMMS.marcusJoins);
    }, 3000);

    // Set up initial action buttons
    this.updateActionButtons();

    // Spawn initial enemies for ice fields phase
    this.spawnPhaseEnemies('ice_fields');
  }

  // ============================================================================
  // MAIN UPDATE LOOP
  // ============================================================================

  protected override updateLevel(deltaTime: number): void {
    this.phaseTime += deltaTime;
    this.levelTime += deltaTime;

    // Update environment
    this.updateEnvironment(deltaTime);

    // Update temperature / exposure
    this.updateExposure(deltaTime);

    // Update phase transitions
    this.updatePhaseTransitions();

    // Update combat
    this.updateCombat(deltaTime);

    // Update enemies
    this.updateIceChitins(deltaTime);
    this.updateProjectiles(deltaTime);

    // Update dormant nests (proximity awakening)
    this.updateDormantNests();

    // Update Marcus AI
    this.updateMarcus(deltaTime);

    // Enforce bounds
    this.enforceBounds();

    // Update blizzard intensity based on location
    this.updateBlizzardIntensity(deltaTime);

    // Update HUD
    this.callbacks.onHealthChange(this.playerHealth);
  }

  // ============================================================================
  // ENVIRONMENT UPDATES
  // ============================================================================

  private updateEnvironment(deltaTime: number): void {
    if (!this.iceEnvironment) return;

    // Update aurora borealis animation
    updateAuroraBorealis(this.iceEnvironment.auroraNodes, this.levelTime);

    // Update blizzard particle emitter to follow camera
    if (this.iceEnvironment.blizzardSystem) {
      updateBlizzardEmitter(this.iceEnvironment.blizzardSystem, this.camera.position);

      // Adjust blizzard emission rate based on intensity
      this.iceEnvironment.blizzardSystem.emitRate = 500 * this.blizzardIntensity;
    }

    // Update ambient snow emitter position
    if (this.iceEnvironment.snowSystem) {
      updateBlizzardEmitter(this.iceEnvironment.snowSystem, this.camera.position);
    }

    // Update fog density based on blizzard intensity
    this.scene.fogDensity = 0.005 + this.blizzardIntensity * 0.012;
  }

  private updateBlizzardIntensity(deltaTime: number): void {
    // Determine target intensity based on location
    const playerZ = this.camera.position.z;

    if (this.phase === 'ice_caverns') {
      // Indoor: minimal blizzard
      this.targetBlizzardIntensity = 0.1;
    } else if (this.phase === 'frozen_lake') {
      // Valley: reduced blizzard
      this.targetBlizzardIntensity = 0.4;
    } else {
      // Open fields: full blizzard
      this.targetBlizzardIntensity = 0.7;
    }

    // Check if near a cave/shelter
    if (this.iceEnvironment) {
      for (const cave of this.iceEnvironment.iceCaves) {
        const dist = Vector3.Distance(this.camera.position, cave.position);
        if (dist < 15) {
          this.targetBlizzardIntensity = Math.min(this.targetBlizzardIntensity, 0.15);
          break;
        }
      }
    }

    // Smooth transition
    const lerpSpeed = 0.5 * deltaTime;
    this.blizzardIntensity += (this.targetBlizzardIntensity - this.blizzardIntensity) * lerpSpeed;
  }

  // ============================================================================
  // TEMPERATURE / EXPOSURE SYSTEM
  // ============================================================================

  private updateExposure(deltaTime: number): void {
    if (!this.iceEnvironment) return;

    // Calculate temperature at player position
    const tempOffset = getTemperatureAtPosition(
      this.camera.position,
      this.iceEnvironment.temperatureZones
    );

    this.isInWarmZone = tempOffset > 10;

    if (this.isInWarmZone) {
      // Recover exposure meter near heat sources
      this.exposureMeter = Math.min(
        EXPOSURE_MAX,
        this.exposureMeter + EXPOSURE_RECOVERY_RATE * deltaTime
      );

      // Clear warnings on recovery
      if (this.exposureMeter > EXPOSURE_WARNING_THRESHOLD && this.hasShownExposureWarning) {
        this.hasShownExposureWarning = false;
        this.hasShownExposureCritical = false;
        this.sendComms('tempRecovered', COMMS.temperatureRecovered);
        this.callbacks.onNotification(NOTIFICATIONS.temperatureRecovered, 2000);
      }
    } else {
      // Drain exposure based on zone coldness
      let drainRate = EXPOSURE_DRAIN_RATE;
      if (tempOffset < -10) {
        drainRate = EXPOSURE_DRAIN_RATE_COLD;
      }

      // Indoor areas drain slower
      if (this.phase === 'ice_caverns') {
        drainRate *= 0.4;
      }

      this.exposureMeter = Math.max(0, this.exposureMeter - drainRate * deltaTime);
    }

    // Exposure warnings
    if (this.exposureMeter <= EXPOSURE_WARNING_THRESHOLD && !this.hasShownExposureWarning) {
      this.hasShownExposureWarning = true;
      this.callbacks.onNotification(NOTIFICATIONS.temperatureLow, 3000);
    }
    if (this.exposureMeter <= EXPOSURE_CRITICAL_THRESHOLD && !this.hasShownExposureCritical) {
      this.hasShownExposureCritical = true;
      this.sendComms('tempWarning', COMMS.temperatureWarning);
      this.callbacks.onNotification(NOTIFICATIONS.temperatureCritical, 4000);
    }

    // Hypothermia damage when meter is empty
    if (this.exposureMeter <= 0) {
      const now = Date.now();
      if (now - this.lastExposureDamageTick >= EXPOSURE_DAMAGE_INTERVAL) {
        this.lastExposureDamageTick = now;
        this.damagePlayer(EXPOSURE_DAMAGE_RATE, 'hypothermia');
      }
    }

    // Visual feedback: increase vignette and blue tint as exposure drops
    const exposurePercent = this.exposureMeter / EXPOSURE_MAX;
    if (exposurePercent < 0.5) {
      // Camera shake from shivering
      this.setBaseShake((1 - exposurePercent * 2) * 1.5);
    } else {
      this.setBaseShake(0);
    }
  }

  // ============================================================================
  // PHASE TRANSITIONS
  // ============================================================================

  private updatePhaseTransitions(): void {
    const playerZ = this.camera.position.z;

    switch (this.phase) {
      case 'ice_fields':
        if (playerZ <= FROZEN_LAKE_TRIGGER_Z) {
          this.transitionToPhase('frozen_lake');
        }
        break;
      case 'frozen_lake':
        if (playerZ <= ICE_CAVERNS_TRIGGER_Z) {
          this.transitionToPhase('ice_caverns');
        }
        break;
      case 'ice_caverns':
        if (playerZ <= BREACH_TRIGGER_Z) {
          this.transitionToPhase('complete');
        }
        break;
    }
  }

  private transitionToPhase(newPhase: LevelPhase): void {
    const oldPhase = this.phase;
    this.phase = newPhase;
    this.phaseTime = 0;

    switch (newPhase) {
      case 'frozen_lake':
        this.sendComms('frozenLake', COMMS.frozenLakeEnter);
        this.callbacks.onObjectiveUpdate(
          OBJECTIVES.frozenLake.title,
          OBJECTIVES.frozenLake.instructions
        );
        this.callbacks.onNotification(NOTIFICATIONS.phaseFrozenLake, 3000);
        this.spawnPhaseEnemies('frozen_lake');
        break;

      case 'ice_caverns':
        this.sendComms('cavernEnter', COMMS.cavernEnter);
        this.callbacks.onObjectiveUpdate(
          OBJECTIVES.iceCaverns.title,
          OBJECTIVES.iceCaverns.instructions
        );
        this.callbacks.onNotification(NOTIFICATIONS.phaseIceCaverns, 3000);
        this.spawnPhaseEnemies('ice_caverns');

        // Transition to indoor color grading
        this.transitionColorGrading('hive', 2000);
        break;

      case 'complete':
        this.sendComms('hiveEntrance', COMMS.hiveEntrance);
        this.callbacks.onObjectiveUpdate(
          OBJECTIVES.reachBreach.title,
          OBJECTIVES.reachBreach.instructions
        );

        // Delay completion to let the final comms play
        setTimeout(() => {
          this.sendComms('levelComplete', COMMS.levelComplete);
          setTimeout(() => {
            this.completeLevel();
          }, 3000);
        }, 2000);
        break;
    }

    this.updateActionButtons();
  }

  // ============================================================================
  // COMBAT SYSTEM
  // ============================================================================

  private updateCombat(deltaTime: number): void {
    // Update cooldowns
    if (this.grenadeCooldownTimer > 0) {
      this.grenadeCooldownTimer -= deltaTime * 1000;
    }
    if (this.meleeCooldownTimer > 0) {
      this.meleeCooldownTimer -= deltaTime * 1000;
    }

    // Process firing
    if (this.isPointerLocked() || this.touchInput !== null) {
      const isFiring =
        this.inputTracker.isActionActive('fire') || (this.touchInput?.isFiring ?? false);
      if (isFiring) {
        this.handlePlayerFire();
      }
    }

    // Check for weapon reload
    if (this.inputTracker.isActionActive('reload')) {
      startReload();
    }

    // Determine combat state
    const hasActiveEnemies = this.iceChitins.some(
      (c) => c.state !== 'dormant' && c.state !== 'dead'
    );
    this.setCombatState(hasActiveEnemies);
  }

  private handlePlayerFire(): void {
    const weaponActions = getWeaponActions();
    if (!weaponActions) return;

    const fired = fireWeapon();
    if (!fired) return;

    // Play weapon sound
    this.playSound('weapon_fire');

    // Raycast for hit detection
    const origin = this.camera.position.clone();
    const forward = new Vector3(
      Math.sin(this.rotationY) * Math.cos(this.rotationX),
      Math.sin(this.rotationX),
      Math.cos(this.rotationY) * Math.cos(this.rotationX)
    );

    this.checkEnemyHit(origin, forward);

    // Camera recoil
    this.triggerShake(0.8);
  }

  private checkEnemyHit(origin: Vector3, direction: Vector3): void {
    const maxRange = 100;
    let closestHit: { chitin: IceChitinInstance; distance: number } | null = null;

    for (const chitin of this.iceChitins) {
      if (chitin.state === 'dormant' || chitin.state === 'dead' || chitin.state === 'underground') {
        continue;
      }

      const toEnemy = chitin.position.subtract(origin);
      const dot = Vector3.Dot(toEnemy, direction);
      if (dot < 0 || dot > maxRange) continue;

      const closest = origin.add(direction.scale(dot));
      const dist = Vector3.Distance(closest, chitin.position);

      // Hit radius varies by state
      const hitRadius = chitin.state === 'burrowing' || chitin.state === 'emerging' ? 0.8 : 1.2;
      if (dist < hitRadius) {
        if (!closestHit || dot < closestHit.distance) {
          closestHit = { chitin, distance: dot };
        }
      }
    }

    if (closestHit) {
      // Determine damage type (default kinetic for standard rifle)
      const baseDamage = 15;
      const damageMultiplier = ICE_CHITIN_RESISTANCES.kinetic;
      const finalDamage = Math.floor(baseDamage * damageMultiplier);

      this.damageChitin(closestHit.chitin, finalDamage);

      // Visual feedback
      this.triggerHitConfirmation();
      this.callbacks.onHitMarker?.(finalDamage, finalDamage > 20);

      // Particle impact at hit point
      const hitPoint = origin.add(direction.scale(closestHit.distance));
      particleManager.emit('impact', hitPoint, { direction });
    }
  }

  private damageChitin(chitin: IceChitinInstance, damage: number): void {
    chitin.health -= damage;

    // Damage feedback visual
    damageFeedback.applyHitFlash(chitin.rootNode);

    if (chitin.health <= 0) {
      this.killChitin(chitin);
    } else {
      // Aggro: if idle or dormant, switch to chase
      if (chitin.state === 'idle') {
        chitin.state = 'chase';
      }
    }
  }

  private killChitin(chitin: IceChitinInstance): void {
    chitin.state = 'dead';
    chitin.frostAuraActive = false;

    // Death particle effect
    particleManager.emit('alien_death', chitin.position);

    // Remove mesh after brief delay
    setTimeout(() => {
      chitin.rootNode.getChildMeshes().forEach((m) => m.dispose());
      chitin.rootNode.dispose();
    }, 500);

    this.totalKills++;
    this.callbacks.onKill();
    this.updateKillStreak(this.totalKills);
    this.playSound('enemy_death');
  }

  private damagePlayer(amount: number, source: string): void {
    const now = Date.now();
    if (source !== 'hypothermia' && now - this.lastDamageTime < DAMAGE_INVINCIBILITY_MS) {
      return;
    }
    this.lastDamageTime = now;

    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.callbacks.onHealthChange(this.playerHealth);
    this.callbacks.onDamage();
    this.trackPlayerDamage(amount);

    // Visual damage feedback
    this.triggerDamageFlash(Math.min(1, amount / 30));
    this.triggerDamageShake(amount);
    this.updatePlayerHealthVisual(this.playerHealth);

    if (this.playerHealth <= 0) {
      this.handlePlayerDeath();
    }
  }

  private handlePlayerDeath(): void {
    this.onPlayerDeath();
    this.callbacks.onNotification('KIA - MISSION FAILED', 5000);
  }

  private handleGrenade(): void {
    if (this.grenadeCount <= 0 || this.grenadeCooldownTimer > 0) return;

    this.grenadeCount--;
    this.grenadeCooldownTimer = GRENADE_COOLDOWN;

    // Grenade lands at the aim point, roughly 15m forward
    const throwDir = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const grenadePos = this.camera.position.add(throwDir.scale(15));
    grenadePos.y = 0.5;

    // Explosion particle
    particleManager.emit('explosion', grenadePos);
    this.playSound('explosion');
    this.triggerShake(4);

    // Damage all enemies in radius
    for (const chitin of this.iceChitins) {
      if (chitin.state === 'dead' || chitin.state === 'underground') continue;
      const dist = Vector3.Distance(chitin.position, grenadePos);
      if (dist < GRENADE_RADIUS) {
        const falloff = 1 - dist / GRENADE_RADIUS;
        const damage = Math.floor(GRENADE_MAX_DAMAGE * falloff * ICE_CHITIN_RESISTANCES.explosive);
        this.damageChitin(chitin, damage);
      }
    }

    this.updateActionButtons();
  }

  private handleMelee(): void {
    if (this.meleeCooldownTimer > 0) return;
    this.meleeCooldownTimer = MELEE_COOLDOWN;

    this.playSound('alien_attack');

    // Check for enemies in melee range
    for (const chitin of this.iceChitins) {
      if (chitin.state === 'dead' || chitin.state === 'underground' || chitin.state === 'dormant') {
        continue;
      }
      const dist = Vector3.Distance(chitin.position, this.camera.position);
      if (dist < MELEE_RANGE) {
        const damage = Math.floor(MELEE_DAMAGE * ICE_CHITIN_RESISTANCES.melee);
        this.damageChitin(chitin, damage);
      }
    }
  }

  // ============================================================================
  // ICE CHITIN ENEMY AI
  // ============================================================================

  private spawnPhaseEnemies(phase: 'ice_fields' | 'frozen_lake' | 'ice_caverns'): void {
    const config = PHASE_ENEMY_COUNTS[phase];
    const phaseZ = phase === 'ice_fields' ? 0 : phase === 'frozen_lake' ? -160 : -260;

    // Spawn dormant nests
    for (let i = 0; i < config.dormant; i++) {
      const pos = new Vector3((Math.random() - 0.5) * 100, 0, phaseZ + (Math.random() - 0.5) * 60);
      this.spawnDormantNest(pos);
    }

    // Spawn active enemies
    for (let i = 0; i < config.active; i++) {
      const pos = new Vector3(
        (Math.random() - 0.5) * 120,
        0.8,
        phaseZ + (Math.random() - 0.5) * 80 - 20
      );
      this.spawnIceChitin(pos, 'idle');
    }
  }

  private spawnDormantNest(position: Vector3): void {
    const seed = this.nextChitinSeed++;
    const cocoon = createDormantCocoonMesh(this.scene, seed);
    cocoon.position.copyFrom(position);

    this.dormantNests.push({
      cocoon,
      position: position.clone(),
      awoken: false,
    });
  }

  private spawnIceChitin(position: Vector3, initialState: IceChitinState): IceChitinInstance {
    const seed = this.nextChitinSeed++;
    const mesh = createIceChitinMesh(this.scene, seed);
    mesh.position.copyFrom(position);

    const chitin: IceChitinInstance = {
      rootNode: mesh,
      health: ICE_CHITIN_SPECIES.baseHealth,
      maxHealth: ICE_CHITIN_SPECIES.baseHealth,
      state: initialState,
      position: position.clone(),
      speed: ICE_CHITIN_SPECIES.moveSpeed,
      attackCooldown: 0,
      burrowCooldown: BURROW_CONFIG.burrowCooldown,
      stateTimer: 0,
      targetPosition: null,
      lastKnownPlayerDistance: Infinity,
      frostAuraActive: initialState !== 'dormant',
      awakenTimer: 0,
    };

    this.iceChitins.push(chitin);
    return chitin;
  }

  private updateDormantNests(): void {
    const awakenRadius = 12;

    for (const nest of this.dormantNests) {
      if (nest.awoken) continue;

      const dist = Vector3.Distance(this.camera.position, nest.position);
      if (dist < awakenRadius) {
        nest.awoken = true;

        // Spawn Ice Chitin at nest location
        const chitin = this.spawnIceChitin(nest.position.clone(), 'awakening');
        chitin.awakenTimer = 2.0; // 2 seconds to awaken

        // Dispose cocoon with cracking effect
        this.callbacks.onNotification(NOTIFICATIONS.iceChitinAwake, 2000);
        this.playSound('alien_screech');
        this.triggerShake(2);

        // Dispose cocoon after awakening delay
        setTimeout(() => {
          nest.cocoon.getChildMeshes().forEach((m) => m.dispose());
          nest.cocoon.dispose();
        }, 1500);
      }
    }
  }

  private updateIceChitins(deltaTime: number): void {
    const playerPos = this.camera.position.clone();

    for (const chitin of this.iceChitins) {
      if (chitin.state === 'dead') continue;

      chitin.stateTimer += deltaTime;
      chitin.attackCooldown = Math.max(0, chitin.attackCooldown - deltaTime);
      chitin.burrowCooldown = Math.max(0, chitin.burrowCooldown - deltaTime);

      const distToPlayer = Vector3.Distance(chitin.position, playerPos);
      chitin.lastKnownPlayerDistance = distToPlayer;

      switch (chitin.state) {
        case 'dormant':
          // Do nothing -- awaiting proximity trigger
          break;

        case 'awakening':
          chitin.awakenTimer -= deltaTime;
          if (chitin.awakenTimer <= 0) {
            chitin.state = 'chase';
            chitin.frostAuraActive = true;
          }
          break;

        case 'idle':
          if (distToPlayer < ICE_CHITIN_SPECIES.alertRadius) {
            chitin.state = 'chase';
            chitin.targetPosition = playerPos.clone();
          }
          break;

        case 'chase':
          this.updateChitinChase(chitin, playerPos, deltaTime);
          break;

        case 'attack_ranged':
          this.updateChitinRangedAttack(chitin, playerPos, deltaTime);
          break;

        case 'attack_melee':
          this.updateChitinMeleeAttack(chitin, playerPos, deltaTime);
          break;

        case 'burrowing':
          chitin.stateTimer += deltaTime;
          // Sink into ground
          chitin.rootNode.position.y = Math.max(-1.5, chitin.rootNode.position.y - deltaTime * 2);
          if (chitin.stateTimer >= BURROW_CONFIG.burrowDuration) {
            chitin.state = 'underground';
            chitin.stateTimer = 0;
            chitin.rootNode.setEnabled(false);
            // Choose emergence point near player
            const angle = Math.random() * Math.PI * 2;
            chitin.targetPosition = playerPos.add(
              new Vector3(
                Math.cos(angle) * BURROW_CONFIG.burrowDistance * 0.5,
                0,
                Math.sin(angle) * BURROW_CONFIG.burrowDistance * 0.5
              )
            );
          }
          break;

        case 'underground':
          chitin.stateTimer += deltaTime;
          if (chitin.stateTimer >= BURROW_CONFIG.undergroundDuration && chitin.targetPosition) {
            chitin.state = 'emerging';
            chitin.stateTimer = 0;
            chitin.position.copyFrom(chitin.targetPosition);
            chitin.rootNode.position.set(chitin.targetPosition.x, -1.5, chitin.targetPosition.z);
            chitin.rootNode.setEnabled(true);
          }
          break;

        case 'emerging':
          chitin.stateTimer += deltaTime;
          chitin.rootNode.position.y =
            -1.5 + (chitin.stateTimer / BURROW_CONFIG.emergeDuration) * 2.3;
          if (chitin.stateTimer >= BURROW_CONFIG.emergeDuration) {
            chitin.state = 'chase';
            chitin.stateTimer = 0;
            chitin.rootNode.position.y = 0.8;
            chitin.position.set(chitin.rootNode.position.x, 0.8, chitin.rootNode.position.z);
            chitin.frostAuraActive = true;
            chitin.burrowCooldown = BURROW_CONFIG.burrowCooldown;

            // Emergence damage
            const emergeDist = Vector3.Distance(chitin.position, playerPos);
            if (emergeDist < BURROW_CONFIG.emergeRadius) {
              this.damagePlayer(BURROW_CONFIG.emergeDamage, 'ice_chitin_emerge');
              this.triggerShake(4);
            }

            this.playSound('alien_screech');
          }
          break;
      }

      // Frost aura damage
      if (chitin.frostAuraActive && distToPlayer < FROST_AURA.radius) {
        // Slow effect handled via getMoveSpeed override
        // Apply frost damage
        if (chitin.stateTimer % 1.0 < deltaTime) {
          this.damagePlayer(Math.floor(FROST_AURA.damagePerSecond), 'frost_aura');
        }
      }

      // Update mesh position
      chitin.rootNode.position.set(
        chitin.position.x,
        chitin.rootNode.position.y,
        chitin.position.z
      );
    }
  }

  private updateChitinChase(
    chitin: IceChitinInstance,
    playerPos: Vector3,
    deltaTime: number
  ): void {
    const dist = chitin.lastKnownPlayerDistance;

    // Check if should attack
    if (dist < 3) {
      chitin.state = 'attack_melee';
      chitin.stateTimer = 0;
      return;
    }
    if (dist < ICE_CHITIN_SPECIES.attackRange && chitin.attackCooldown <= 0) {
      chitin.state = 'attack_ranged';
      chitin.stateTimer = 0;
      return;
    }

    // Check if should burrow
    if (dist > 15 && dist < 40 && chitin.burrowCooldown <= 0 && Math.random() < 0.005) {
      chitin.state = 'burrowing';
      chitin.stateTimer = 0;
      chitin.frostAuraActive = false;
      return;
    }

    // Move toward player
    const direction = playerPos.subtract(chitin.position);
    direction.y = 0;
    direction.normalize();

    const moveSpeed = chitin.speed * deltaTime;
    chitin.position.addInPlace(direction.scale(moveSpeed));

    // Face player
    chitin.rootNode.rotation.y = Math.atan2(direction.x, direction.z);
  }

  private updateChitinRangedAttack(
    chitin: IceChitinInstance,
    playerPos: Vector3,
    deltaTime: number
  ): void {
    if (chitin.stateTimer > 0.5 && chitin.attackCooldown <= 0) {
      // Fire ice shard burst
      this.fireIceShards(chitin, playerPos);
      chitin.attackCooldown = ICE_SHARD_PROJECTILE.burstCooldown;
      chitin.state = 'chase';
      chitin.stateTimer = 0;
    }

    // Face player during attack
    const dir = playerPos.subtract(chitin.position);
    dir.y = 0;
    dir.normalize();
    chitin.rootNode.rotation.y = Math.atan2(dir.x, dir.z);
  }

  private updateChitinMeleeAttack(
    chitin: IceChitinInstance,
    playerPos: Vector3,
    deltaTime: number
  ): void {
    if (chitin.stateTimer > 0.6) {
      // Deal melee damage
      const dist = Vector3.Distance(chitin.position, playerPos);
      if (dist < 4) {
        this.damagePlayer(ICE_CHITIN_SPECIES.baseDamage, 'ice_chitin_melee');
      }
      chitin.attackCooldown = 1.0 / ICE_CHITIN_SPECIES.fireRate;
      chitin.state = 'chase';
      chitin.stateTimer = 0;
    }
  }

  private fireIceShards(chitin: IceChitinInstance, targetPos: Vector3): void {
    const burstCount = ICE_SHARD_PROJECTILE.burstCount;

    for (let i = 0; i < burstCount; i++) {
      const shardMesh = createIceShardMesh(this.scene);

      const baseDir = targetPos.subtract(chitin.position).normalize();
      // Add spread
      const spread = (i - (burstCount - 1) / 2) * ICE_SHARD_PROJECTILE.burstSpreadAngle;
      const dir = new Vector3(
        baseDir.x * Math.cos(spread) - baseDir.z * Math.sin(spread),
        baseDir.y,
        baseDir.x * Math.sin(spread) + baseDir.z * Math.cos(spread)
      );

      const startPos = chitin.position.add(dir.scale(1.2));
      startPos.y = 1.0;
      shardMesh.position.copyFrom(startPos);

      this.projectiles.push({
        mesh: shardMesh,
        position: startPos.clone(),
        direction: dir.clone(),
        speed: ICE_SHARD_PROJECTILE.speed,
        damage: ICE_SHARD_PROJECTILE.damage,
        lifetime: 3,
        source: 'enemy',
      });
    }

    this.playSound('alien_attack');
  }

  // ============================================================================
  // PROJECTILE MANAGEMENT
  // ============================================================================

  private updateProjectiles(deltaTime: number): void {
    const playerPos = this.camera.position;
    const playerHitRadius = 0.8;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.lifetime -= deltaTime;

      if (proj.lifetime <= 0) {
        proj.mesh.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }

      // Move projectile
      const movement = proj.direction.scale(proj.speed * deltaTime);
      proj.position.addInPlace(movement);
      proj.mesh.position.copyFrom(proj.position);

      // Rotate projectile to face movement direction
      proj.mesh.rotation.y = Math.atan2(proj.direction.x, proj.direction.z);

      // Check player collision (enemy projectiles only)
      if (proj.source === 'enemy') {
        const distToPlayer = Vector3.Distance(proj.position, playerPos);
        if (distToPlayer < playerHitRadius) {
          this.damagePlayer(proj.damage, 'ice_shard');
          proj.mesh.dispose();
          this.projectiles.splice(i, 1);

          // Ice shard impact particle
          particleManager.emit('impact', proj.position);
          continue;
        }
      }

      // Check terrain collision (Y < 0)
      if (proj.position.y < 0) {
        // Ice shard sticks into ground briefly
        proj.mesh.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // MARCUS AI COMPANION
  // ============================================================================

  private createMarcusMech(): void {
    const root = new TransformNode('marcusMech', this.scene);
    root.position.set(10, 0, 20);

    // Simplified mech body (8m tall Titan)
    const bodyMat = new StandardMaterial('marcusBodyMat', this.scene);
    bodyMat.diffuseColor = new Color3(0.35, 0.4, 0.35); // Military green-grey
    bodyMat.specularColor = new Color3(0.3, 0.3, 0.3);

    // Torso
    const body = MeshBuilder.CreateBox(
      'marcusBody',
      { width: 3, height: 4, depth: 2.5 },
      this.scene
    );
    body.material = bodyMat;
    body.parent = root;
    body.position.y = 5;

    // Legs
    const legMat = new StandardMaterial('marcusLegMat', this.scene);
    legMat.diffuseColor = new Color3(0.3, 0.32, 0.3);

    for (let i = 0; i < 2; i++) {
      const leg = MeshBuilder.CreateBox(
        `marcusLeg_${i}`,
        { width: 1, height: 3, depth: 1.2 },
        this.scene
      );
      leg.material = legMat;
      leg.parent = root;
      leg.position.set((i - 0.5) * 1.5, 1.5, 0);
    }

    // Reactor glow (warm -- indicates cold resistance)
    const reactorMat = new StandardMaterial('reactorMat', this.scene);
    reactorMat.emissiveColor = new Color3(0.8, 0.4, 0.15);
    reactorMat.disableLighting = true;

    const reactor = MeshBuilder.CreateSphere('marcusReactor', { diameter: 0.8 }, this.scene);
    reactor.material = reactorMat;
    reactor.parent = root;
    reactor.position.set(0, 5.5, -1.3);

    this.marcus = {
      rootNode: root,
      body,
      position: new Vector3(10, 0, 20),
      health: 500,
      maxHealth: 500,
    };
  }

  private updateMarcus(deltaTime: number): void {
    if (!this.marcus) return;

    // Marcus follows the player at a distance, stays on the surface
    const playerPos = this.camera.position;
    const toPlayer = playerPos.subtract(this.marcus.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    if (dist > 20) {
      // Move toward player
      const dir = toPlayer.normalize();
      const moveSpeed = 8 * deltaTime;
      this.marcus.position.addInPlace(dir.scale(moveSpeed));
    }

    // Don't cross onto thin ice (phase 2) -- too heavy
    if (this.phase === 'frozen_lake') {
      this.marcus.position.z = Math.max(this.marcus.position.z, FROZEN_LAKE_TRIGGER_Z + 10);
    }

    this.marcus.rootNode.position.set(this.marcus.position.x, 0, this.marcus.position.z);

    // Face player
    if (dist > 1) {
      this.marcus.rootNode.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }
  }

  // ============================================================================
  // ACTION HANDLING
  // ============================================================================

  private handleAction(actionId: string): void {
    switch (actionId) {
      case 'grenade':
        this.handleGrenade();
        break;
      case 'melee':
        this.handleMelee();
        break;
      case 'reload':
        startReload();
        break;
    }
  }

  private updateActionButtons(): void {
    const reload = bindableActionParams('reload');
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');

    const combatGroup: ActionButtonGroup = {
      id: 'combat',
      label: 'COMBAT',
      position: 'right',
      buttons: [
        createAction('reload', 'RELOAD', reload.key, {
          keyDisplay: reload.keyDisplay,
          variant: 'secondary',
        }),
        createAction('grenade', `GRENADE (${this.grenadeCount})`, grenade.key, {
          keyDisplay: grenade.keyDisplay,
          variant: 'danger',
          enabled: this.grenadeCount > 0 && this.grenadeCooldownTimer <= 0,
        }),
        createAction('melee', 'MELEE', melee.key, {
          keyDisplay: melee.keyDisplay,
          variant: 'primary',
          enabled: this.meleeCooldownTimer <= 0,
        }),
      ],
    };

    this.callbacks.onActionGroupsChange([combatGroup]);
  }

  // ============================================================================
  // BOUNDS ENFORCEMENT
  // ============================================================================

  private enforceBounds(): void {
    const pos = this.camera.position;

    // East/West bounds
    if (pos.x > ARENA_HALF_WIDTH) pos.x = ARENA_HALF_WIDTH;
    if (pos.x < -ARENA_HALF_WIDTH) pos.x = -ARENA_HALF_WIDTH;

    // North/South bounds
    if (pos.z > ARENA_NORTH_BOUND) pos.z = ARENA_NORTH_BOUND;
    if (pos.z < ARENA_SOUTH_BOUND) pos.z = ARENA_SOUTH_BOUND;

    // Maintain player height above terrain
    pos.y = 1.7;
  }

  // ============================================================================
  // COMMS UTILITY
  // ============================================================================

  private sendComms(
    id: string,
    message: {
      sender: string;
      callsign: string;
      portrait: 'commander' | 'ai' | 'marcus' | 'armory' | 'player';
      text: string;
    }
  ): void {
    if (this.sentComms.has(id)) return;
    this.sentComms.add(id);
    this.callbacks.onCommsMessage(message);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  protected override disposeLevel(): void {
    // Dispose Ice Chitins
    for (const chitin of this.iceChitins) {
      chitin.rootNode.getChildMeshes().forEach((m) => m.dispose());
      chitin.rootNode.dispose();
    }
    this.iceChitins = [];

    // Dispose dormant nests
    for (const nest of this.dormantNests) {
      nest.cocoon.getChildMeshes().forEach((m) => m.dispose());
      nest.cocoon.dispose();
    }
    this.dormantNests = [];

    // Dispose projectiles
    for (const proj of this.projectiles) {
      proj.mesh.dispose();
    }
    this.projectiles = [];

    // Dispose Marcus
    if (this.marcus) {
      this.marcus.rootNode.getChildMeshes().forEach((m) => m.dispose());
      this.marcus.rootNode.dispose();
      this.marcus = null;
    }

    // Dispose ice environment
    if (this.iceEnvironment) {
      disposeIceEnvironment(this.iceEnvironment);
      this.iceEnvironment = null;
    }

    // Unregister action handler
    this.callbacks.onActionHandlerRegister(null);
    this.actionCallback = null;

    // Call parent dispose
    super.disposeLevel();
  }
}
