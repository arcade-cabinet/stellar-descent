/**
 * ExtractionLevel Orchestrator - Escape Sequence and Final Holdout
 *
 * After killing the Queen, the player must escape the collapsing hive
 * and hold out at LZ Omega until the dropship arrives.
 *
 * FIVE DISTINCT PHASES:
 *
 * PHASE 1: ESCAPE (3-4 minutes) - Collapsing tunnels
 * PHASE 2: SURFACE RUN (2-3 minutes) - 500m to LZ Omega
 * PHASE 3: HOLDOUT (5-7 minutes) - Wave-based defense (7 waves)
 * PHASE 4: HIVE COLLAPSE (45-90 seconds) - Final escape to dropship
 * PHASE 5: VICTORY - Dropship boarding and epilogue
 */

import type { Engine } from '@babylonjs/core/Engines/engine';
import type { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { getAchievementManager } from '../../achievements';
import { getWeaponActions, startReload } from '../../context/useWeaponActions';
import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import { bindableActionParams, levelActionParams } from '../../input/InputBridge';
import { type ActionButtonGroup, createAction } from '../../types/actions';
import { BaseLevel } from '../BaseLevel';
import { buildFloraFromPlacements, getExtractionFlora } from '../shared/AlienFloraBuilder';
import { buildCollectibles, type CollectibleSystemResult, getExtractionCollectibles } from '../shared/CollectiblePlacer';
import { updateBiolights } from '../shared/HiveEnvironmentBuilder';
import type { TerrainResult } from '../shared/SurfaceTerrainFactory';
import type { LevelCallbacks, LevelConfig, LevelId } from '../types';
import type { ExtractionEnvironmentResult } from './ExtractionEnvironmentBuilder';

// Import modular components
import type { Enemy, DebrisChunk, FallingStalactite, HealthPickup, CrumblingWall, SupplyDrop, ExtractionPhase } from './types';
import * as C from './constants';
import * as Comms from './comms';
import * as Enemies from './enemies';
import * as Phases from './phases';
import * as Effects from './effects';
import * as Environment from './environment';
import * as Victory from './victory';

export class ExtractionLevel extends BaseLevel {
  // Flora & collectibles
  private floraNodes: TransformNode[] = [];
  private collectibleSystem: CollectibleSystemResult | null = null;

  // Phase and wave state
  private phaseState = Phases.createPhaseState();
  private waveState = Phases.createWaveState();
  private victoryState = Victory.createVictoryState();
  private kills = 0;
  private playerHealth = 100;
  private noDeathBonus = true;
  private mechIntegrity = 100;

  // Environment refs
  private tunnelEnv: Environment.TunnelEnvironment | null = null;
  private surfaceEnv: Environment.SurfaceEnvironment | null = null;
  private extractionEnv: ExtractionEnvironmentResult | null = null;

  // Surface objects
  private terrain: Mesh | null = null;
  private skyDome: Mesh | null = null;
  private lzPad: Mesh | null = null;
  private lzBeacon: Mesh | null = null;
  private breachHoles: Mesh[] = [];
  private canyonWalls: Mesh[] = [];
  private barrierWalls: Mesh[] = [];
  private spawnPoints: Vector3[] = [];
  private coverObjects: Mesh[] = [];

  // Mech
  private mechMesh: TransformNode | null = null;
  private mechGunLight: PointLight | null = null;
  private mechFireTimer = 0;

  // Enemies & debris
  private enemies: Enemy[] = [];
  private debris: DebrisChunk[] = [];

  // Dropship
  private dropship: TransformNode | null = null;
  private dropshipRamp: Mesh | null = null;
  private dropshipRampLight: PointLight | null = null;
  private dropshipThrustEmitters: TransformNode[] = [];

  // Hive collapse
  private collapseLight: PointLight | null = null;
  private groundCracks: Mesh[] = [];
  private hiveEruptionMeshes: Mesh[] = [];
  private healthPickups: HealthPickup[] = [];
  private crumblingWalls: CrumblingWall[] = [];
  private collapseEnemies: Enemy[] = [];
  private fallingStalactites: FallingStalactite[] = [];
  private objectiveMarker: Mesh | null = null;
  private objectiveBeacon: PointLight | null = null;
  private collapseCommsPlayed: Set<string> = new Set();
  private stalactiteSpawnTimer = 0;
  private collapseAudioTimer = 0;
  private structureGroanTimer = 0;
  private lastAlienScreamTime = 0;
  private collapseDebrisTimer = 0;
  private collapseIntensity = 0;

  // Supply drops
  private supplyDrops: SupplyDrop[] = [];

  // Actions
  private actionCallback: ((actionId: string) => void) | null = null;
  private grenadeCooldown = 0;
  private flareCooldown = 0;

  constructor(engine: Engine, canvas: HTMLCanvasElement, config: LevelConfig, callbacks: LevelCallbacks) {
    super(engine, canvas, config, callbacks);
  }

  protected getBackgroundColor(): Color4 {
    return C.PHASE_COLORS[this.phaseState.phase] ?? C.PHASE_COLORS.escape;
  }

  protected async createEnvironment(): Promise<void> {
    this.camera.position.set(0, 1.7, 0);
    this.camera.rotation.set(0, 0, 0);
    this.rotationX = 0;
    this.rotationY = 0;

    particleManager.init(this.scene);

    // Create environments
    this.tunnelEnv = Environment.createEscapeTunnel(this.scene);
    await Environment.preloadAssets(this.scene);

    this.surfaceEnv = Environment.createSurfaceEnvironment(this.scene);
    this.terrain = this.surfaceEnv.terrain;

    this.extractionEnv = await Environment.buildLZEnvironment(this.scene);
    if (this.extractionEnv) {
      for (const mesh of this.extractionEnv.coverMeshes) {
        this.coverObjects.push(mesh);
      }
    }

    const mechAssets = Environment.createMarcusMech(this.scene);
    this.mechMesh = mechAssets.mechMesh;
    this.mechGunLight = mechAssets.mechGunLight;

    const dropshipAssets = Environment.createDropship(this.scene);
    this.dropship = dropshipAssets.dropship;
    this.dropshipRamp = dropshipAssets.dropshipRamp;
    this.dropshipRampLight = dropshipAssets.dropshipRampLight;
    this.dropshipThrustEmitters = dropshipAssets.dropshipThrustEmitters;

    this.lzBeacon = Environment.createLZBeacon(this.scene);
    this.spawnPoints = Environment.setupHoldoutArena();

    this.setSurfaceVisible(false);

    // Build flora and collectibles
    const floraRoot = new TransformNode('flora_root', this.scene);
    this.floraNodes = await buildFloraFromPlacements(this.scene, getExtractionFlora(), floraRoot);

    const collectibleRoot = new TransformNode('collectible_root', this.scene);
    this.collectibleSystem = await buildCollectibles(this.scene, getExtractionCollectibles(), collectibleRoot);

    this.startEscape();
  }

  private setTunnelVisible(visible: boolean): void {
    if (this.tunnelEnv) Environment.setTunnelVisible(this.tunnelEnv, visible);
  }

  private setSurfaceVisible(visible: boolean): void {
    Environment.setSurfaceVisible(
      this.terrain, this.extractionEnv, this.skyDome, this.lzPad, this.lzBeacon,
      this.breachHoles, this.canyonWalls, this.barrierWalls, this.coverObjects, this.mechMesh, visible
    );
  }

  // ============================================================================
  // PHASE MANAGEMENT
  // ============================================================================

  private startEscape(): void {
    this.phaseState.phase = 'escape_start';
    this.phaseState.escapeTimer = C.ESCAPE_TIMER_INITIAL;
    this.phaseState.phaseTime = 0;
    this.phaseState.playerEscapeProgress = 0;
    this.phaseState.collapseDistance = -20;

    this.callbacks.onCinematicStart?.();
    this.callbacks.onNotification('THE HIVE IS COLLAPSING', 3000);

    this.actionCallback = this.handleAction.bind(this);
    this.callbacks.onActionHandlerRegister(this.actionCallback);

    setTimeout(() => this.callbacks.onCommsMessage(Comms.ESCAPE_START_COMMS), 1000);
    setTimeout(() => this.transitionToPhase('escape_tunnel'), 3000);
  }

  private transitionToPhase(newPhase: ExtractionPhase): void {
    this.phaseState.phase = newPhase;
    this.phaseState.phaseTime = 0;

    switch (newPhase) {
      case 'escape_tunnel':
        this.callbacks.onObjectiveUpdate('ESCAPE THE HIVE', 'RUN! The collapse is right behind you!');
        this.updateActionButtons('escape');
        this.setBaseShake(1.5);
        this.callbacks.onCombatStateChange(true);
        break;

      case 'surface_run':
        this.callbacks.onNotification('SURFACE REACHED', 2000);
        this.callbacks.onCinematicEnd?.();
        this.setTunnelVisible(false);
        this.setSurfaceVisible(true);
        this.camera.position.set(0, 1.7, 0);
        this.camera.rotation.set(0, Math.PI, 0);
        this.rotationX = 0;
        this.rotationY = Math.PI;
        this.scene.clearColor = new Color4(0.75, 0.5, 0.35, 1);
        this.setBaseShake(0.5);
        setTimeout(() => {
          this.callbacks.onCommsMessage(Comms.SURFACE_REACHED_COMMS);
          this.callbacks.onObjectiveUpdate('REACH LZ OMEGA', `Distance: ${this.phaseState.distanceToLZ.toFixed(0)}m`);
        }, 2000);
        break;

      case 'holdout':
        this.callbacks.onNotification('DEFEND THE LZ', 3000);
        this.phaseState.dropshipETA = C.DROPSHIP_ETA_INITIAL;
        this.waveState = Phases.createWaveState();
        this.setBaseShake(0);
        this.camera.position.set(C.LZ_POSITION.x, 1.7, C.LZ_POSITION.z + 15);
        setTimeout(() => this.callbacks.onCommsMessage(Comms.HOLDOUT_START_COMMS), 1500);
        setTimeout(() => {
          this.waveState = Phases.startWaveIntermission(this.waveState, 1);
          const config = Phases.getWaveConfig(1);
          if (config) {
            this.callbacks.onNotification(`INCOMING: ${config.waveTitle}`, 3000);
            if (config.commsMessage) setTimeout(() => this.callbacks.onCommsMessage(config.commsMessage!), 1000);
          }
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
        if (this.noDeathBonus) {
          setTimeout(() => {
            this.callbacks.onNotification('BONUS: FLAWLESS EXTRACTION - NO DEATHS', 4000);
            getAchievementManager().onLevelComplete(this.id, false);
          }, 2000);
        }
        getAudioManager().playVictory();
        Victory.startDropshipArrival(this.createVictoryContext());
        break;

      case 'epilogue':
        Victory.showEpilogue(this.createVictoryContext(), this.id);
        this.state.completed = true;
        break;
    }
  }

  private createVictoryContext(): Victory.VictoryContext {
    return {
      scene: this.scene,
      state: this.victoryState,
      callbacks: this.callbacks,
      dropship: this.dropship,
      dropshipRamp: this.dropshipRamp,
      dropshipRampLight: this.dropshipRampLight,
      dropshipThrustEmitters: this.dropshipThrustEmitters,
      mechMesh: this.mechMesh,
      enemies: this.enemies,
      kills: this.kills,
      noDeathBonus: this.noDeathBonus,
      setBaseShake: this.setBaseShake.bind(this),
      triggerShake: this.triggerShake.bind(this),
      setSurfaceVisible: this.setSurfaceVisible.bind(this),
      disposeCollapseResources: this.disposeCollapseResources.bind(this),
      onTransitionToEpilogue: () => this.transitionToPhase('epilogue'),
      completeLevel: this.completeLevel.bind(this),
      setMechIntegrity: (v: number) => { this.mechIntegrity = v; },
    };
  }

  private handleAction(actionId: string): void {
    switch (actionId) {
      case 'grenade':
        if (this.grenadeCooldown <= 0) { this.throwGrenade(); this.grenadeCooldown = C.GRENADE_COOLDOWN_TIME; }
        else this.callbacks.onNotification('GRENADE ON COOLDOWN', 500);
        break;
      case 'melee':
        this.performMelee();
        break;
      case 'flare':
        if (this.flareCooldown <= 0) { this.fireSignalFlare(); this.flareCooldown = C.FLARE_COOLDOWN_TIME; }
        else this.callbacks.onNotification('FLARE ON COOLDOWN', 500);
        break;
      case 'reload':
        this.handleReload();
        break;
    }
  }

  private handleReload(): void {
    const weaponActions = getWeaponActions();
    if (!weaponActions) return;
    const state = weaponActions.getState();
    if (state.isReloading) return this.callbacks.onNotification('ALREADY RELOADING', 500);
    if (state.currentAmmo >= state.maxMagazineSize) return this.callbacks.onNotification('MAGAZINE FULL', 500);
    if (state.reserveAmmo <= 0) return this.callbacks.onNotification('NO RESERVE AMMO', 500);
    startReload();
    this.callbacks.onNotification('RELOADING...', 1800);
  }

  private throwGrenade(): void {
    this.callbacks.onNotification('GRENADE OUT', 1000);
    const grenadePos = this.camera.position.clone();
    grenadePos.addInPlace(new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).scale(10));
    particleManager.emitSmallExplosion(grenadePos, 1.5);
    const { kills, killedEnemies } = Enemies.applyGrenadeDamage(this.enemies, grenadePos);
    this.kills += kills;
    for (const e of killedEnemies) { this.waveState = Phases.recordWaveKill(this.waveState); this.callbacks.onKill(); }
    if (kills > 0) this.callbacks.onNotification(`${kills} KILLS`, 1500);
    this.triggerShake(3);
  }

  private performMelee(): void {
    const hitEnemy = Enemies.checkMeleeHit(this.enemies, this.camera.position);
    if (hitEnemy) {
      if (!hitEnemy.isActive) { this.waveState = Phases.recordWaveKill(this.waveState); this.kills++; this.callbacks.onKill(); }
      this.callbacks.onNotification('MELEE HIT', 500);
      this.triggerShake(1);
    } else {
      this.callbacks.onNotification('MISS', 300);
    }
  }

  private fireSignalFlare(): void {
    this.callbacks.onNotification('SIGNAL FLARE DEPLOYED', 2000);
    this.callbacks.onCommsMessage(Comms.SIGNAL_FLARE_COMMS);
    this.phaseState.dropshipETA = Math.max(30, this.phaseState.dropshipETA - 30);
  }

  private updateActionButtons(mode: 'escape' | 'holdout' | 'none'): void {
    let groups: ActionButtonGroup[] = [];
    const sprint = bindableActionParams('sprint');
    const reload = bindableActionParams('reload');
    const grenade = levelActionParams('grenade');
    const melee = levelActionParams('melee');
    const flare = levelActionParams('flare');

    switch (mode) {
      case 'escape':
        groups = [{ id: 'escape', position: 'bottom', buttons: [createAction('sprint', 'SPRINT', sprint.key, { keyDisplay: sprint.keyDisplay, variant: 'danger', size: 'large', highlighted: true })] }];
        break;
      case 'holdout':
        groups = [{ id: 'combat', position: 'right', buttons: [
          createAction('reload', 'RELOAD', reload.key, { keyDisplay: reload.keyDisplay, variant: 'secondary' }),
          createAction('grenade', 'GRENADE', grenade.key, { keyDisplay: grenade.keyDisplay, variant: 'danger', cooldown: C.GRENADE_COOLDOWN_TIME }),
          createAction('melee', 'MELEE', melee.key, { keyDisplay: melee.keyDisplay, variant: 'primary' }),
          createAction('flare', 'SIGNAL FLARE', flare.key, { keyDisplay: flare.keyDisplay, variant: 'warning', cooldown: C.FLARE_COOLDOWN_TIME }),
        ] }];
        break;
    }
    this.callbacks.onActionGroupsChange(groups);
  }

  // ============================================================================
  // HIVE COLLAPSE
  // ============================================================================

  private startHiveCollapseSequence(): void {
    this.phaseState.hiveCollapseTimer = C.HIVE_COLLAPSE_TIMER;
    this.collapseIntensity = 0;
    this.collapseDebrisTimer = 0;
    this.collapseCommsPlayed.clear();
    this.stalactiteSpawnTimer = 2;
    this.collapseAudioTimer = 0.5;
    this.structureGroanTimer = 3;
    this.lastAlienScreamTime = performance.now() - 5000;

    this.scene.clearColor = new Color4(0.85, 0.4, 0.2, 1);
    this.collapseLight = Effects.createCollapseLight(this.scene);
    this.groundCracks = Effects.createGroundCracks(this.scene);
    this.healthPickups = Effects.createCollapseHealthPickups(this.scene);
    this.crumblingWalls = Effects.createCrumblingWalls(this.scene);
    const marker = Effects.createObjectiveMarker(this.scene, C.DROPSHIP_COLLAPSE_POSITION);
    this.objectiveMarker = marker.marker;
    this.objectiveBeacon = marker.beacon;

    this.spawnCollapseEnemies();

    if (this.dropship) {
      this.dropship.setEnabled(true);
      this.dropship.position.set(C.DROPSHIP_COLLAPSE_POSITION.x, C.DROPSHIP_COLLAPSE_POSITION.y + 15, C.DROPSHIP_COLLAPSE_POSITION.z);
    }

    this.updateActionButtons('escape');
    this.setBaseShake(3);
    this.triggerShake(6);

    getAudioManager().play('collapse_rumble', { volume: 0.6 });
    setTimeout(() => getAudioManager().play('alien_death_scream', { volume: 0.5 }), 500);
    setTimeout(() => getAudioManager().play('ground_crack', { volume: 0.5 }), 800);

    this.callbacks.onNotification('THE HIVE IS COLLAPSING - GET TO THE DROPSHIP', 4000);
    this.callbacks.onCombatStateChange(true);

    for (const item of Comms.COLLAPSE_START_SEQUENCE) setTimeout(() => this.callbacks.onCommsMessage(item.message), item.delay);
    for (const item of Comms.COLLAPSE_PROGRESSION_SEQUENCE) {
      setTimeout(() => { if (this.phaseState.phase === 'hive_collapse') { this.callbacks.onCommsMessage(item.message); this.triggerShake(5); } }, item.delay);
    }
  }

  private async spawnCollapseEnemies(): Promise<void> {
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const enemy = await Enemies.spawnCollapseStraggler(this.scene, this.camera.position, this.collapseEnemies.length);
      if (enemy) this.collapseEnemies.push(enemy);
    }
  }

  private updateHiveCollapse(deltaTime: number): void {
    this.phaseState.hiveCollapseTimer -= deltaTime;
    this.collapseIntensity = Math.min(1, 1 - this.phaseState.hiveCollapseTimer / C.HIVE_COLLAPSE_TIMER);
    this.setBaseShake(2 + this.collapseIntensity * 6);

    // Spawn debris and stalactites
    this.collapseDebrisTimer -= deltaTime;
    const debrisSpawnRate = 0.5 - this.collapseIntensity * 0.35;
    if (this.collapseDebrisTimer <= 0) {
      this.collapseDebrisTimer = debrisSpawnRate;
      this.debris.push(Effects.spawnCollapseDebris(this.scene, this.camera.position));
      if (this.collapseIntensity > 0.5) this.debris.push(Effects.spawnCollapseDebris(this.scene, this.camera.position));
      if (this.collapseIntensity > 0.8) { this.debris.push(Effects.spawnCollapseDebris(this.scene, this.camera.position)); this.debris.push(Effects.spawnCollapseDebris(this.scene, this.camera.position)); }
    }

    this.stalactiteSpawnTimer -= deltaTime;
    const stalactiteRate = C.STALACTITE_SPAWN_INTERVAL * (1.2 - this.collapseIntensity * 0.7);
    if (this.stalactiteSpawnTimer <= 0) {
      this.stalactiteSpawnTimer = stalactiteRate;
      this.fallingStalactites.push(Effects.spawnFallingStalactite(this.scene, this.camera.position));
      if (this.collapseIntensity > 0.7 && Math.random() < 0.4) setTimeout(() => this.fallingStalactites.push(Effects.spawnFallingStalactite(this.scene, this.camera.position)), 500);
    }

    // Update effects
    const debrisResult = Effects.updateDebris(this.debris, this.camera.position, deltaTime);
    this.debris = debrisResult.updatedDebris;
    if (debrisResult.playerDamage > 0) { this.onPlayerDamaged(debrisResult.playerDamage); this.callbacks.onNotification('DEBRIS HIT', 500); }

    const stalactiteResult = Effects.updateFallingStalactites(this.fallingStalactites, this.camera.position, deltaTime, this.triggerShake.bind(this));
    this.fallingStalactites = stalactiteResult.updatedStalactites;
    if (stalactiteResult.playerDamage > 0) this.onPlayerDamaged(stalactiteResult.playerDamage);
    if (stalactiteResult.notificationMsg) this.callbacks.onNotification(stalactiteResult.notificationMsg, 1000);

    const audioResult = Effects.updateCollapseAudio(this.collapseIntensity, this.collapseAudioTimer, this.structureGroanTimer, this.lastAlienScreamTime, deltaTime, C.COLLAPSE_RUMBLE_INTERVAL);
    this.collapseAudioTimer = audioResult.newAudioTimer;
    this.structureGroanTimer = audioResult.newGroanTimer;
    this.lastAlienScreamTime = audioResult.newScreamTime;

    const pickupResult = Effects.updateHealthPickups(this.healthPickups, this.camera.position);
    if (pickupResult.healAmount > 0) { this.playerHealth = Math.min(100, this.playerHealth + pickupResult.healAmount); this.callbacks.onHealthChange(this.playerHealth); this.callbacks.onNotification(`+${pickupResult.healAmount} HEALTH`, 1000); }

    Effects.updateCrumblingWalls(this.crumblingWalls, this.collapseIntensity, deltaTime, this.triggerShake.bind(this));

    const enemyDamage = Enemies.updateCollapseEnemies(this.collapseEnemies, this.camera.position, deltaTime);
    if (enemyDamage > 0) this.onPlayerDamaged(enemyDamage);

    if (this.objectiveMarker && this.objectiveBeacon) Effects.updateObjectiveMarker(this.objectiveMarker, this.objectiveBeacon);

    const playerPos2D = new Vector3(this.camera.position.x, 0, this.camera.position.z);
    const dropshipPos2D = new Vector3(C.DROPSHIP_COLLAPSE_POSITION.x, 0, C.DROPSHIP_COLLAPSE_POSITION.z);
    this.phaseState.distanceToDropship = Vector3.Distance(playerPos2D, dropshipPos2D);

    Effects.updateGroundCracks(this.groundCracks, this.collapseIntensity);
    if (this.collapseLight) Effects.updateCollapseLight(this.collapseLight, this.collapseIntensity);

    const hud = Phases.getCollapseHUDDisplay(this.phaseState.hiveCollapseTimer, this.phaseState.distanceToDropship);
    this.callbacks.onObjectiveUpdate(hud.title, hud.description);

    if (this.phaseState.distanceToDropship < 20) { this.callbacks.onNotification('BOARDING DROPSHIP', 2000); this.disposeCollapseResources(); this.transitionToPhase('victory'); return; }
    if (this.phaseState.hiveCollapseTimer <= 0) { this.onCollapseFailure(); return; }

    // Distance-based comms
    if (this.phaseState.distanceToDropship < 100 && !this.collapseCommsPlayed.has('almost')) { this.collapseCommsPlayed.add('almost'); this.callbacks.onCommsMessage(Comms.DISTANCE_COMMS.almost); }
    if (this.phaseState.distanceToDropship < 50 && !this.collapseCommsPlayed.has('soClose')) { this.collapseCommsPlayed.add('soClose'); this.callbacks.onCommsMessage(Comms.DISTANCE_COMMS.soClose); }
    if (this.playerHealth < 30 && !this.collapseCommsPlayed.has('lowHealth')) { this.collapseCommsPlayed.add('lowHealth'); this.callbacks.onCommsMessage(Comms.DISTANCE_COMMS.lowHealth); }

    const timerInt = Math.ceil(Math.max(0, this.phaseState.hiveCollapseTimer));
    if (timerInt === 60 && !this.collapseCommsPlayed.has('60s')) { this.collapseCommsPlayed.add('60s'); this.callbacks.onNotification('60 SECONDS REMAINING', 1500); }
    else if (timerInt === 30 && !this.collapseCommsPlayed.has('30s')) { this.collapseCommsPlayed.add('30s'); this.callbacks.onNotification('30 SECONDS - SPRINT!', 2000); this.triggerShake(4); }
    else if (timerInt === 20 && !this.collapseCommsPlayed.has('20s')) { this.collapseCommsPlayed.add('20s'); this.callbacks.onNotification('20 SECONDS REMAINING', 1500); this.triggerShake(5); }
    else if (timerInt === 10 && !this.collapseCommsPlayed.has('10s')) { this.collapseCommsPlayed.add('10s'); this.callbacks.onNotification('10 SECONDS - MOVE IT!', 1500); this.triggerShake(6); }
    else if (timerInt === 5 && !this.collapseCommsPlayed.has('5s')) { this.collapseCommsPlayed.add('5s'); this.callbacks.onNotification('5 SECONDS!', 1000); this.triggerShake(7); }
  }

  private onCollapseFailure(): void {
    this.callbacks.onNotification('COLLAPSE - KIA', 3000);
    this.triggerShake(10);
    this.setBaseShake(8);
    setTimeout(() => {
      this.callbacks.onCommsMessage(Comms.COLLAPSE_FAILURE_COMMS);
      this.phaseState.hiveCollapseTimer = 15;
      const newPos = C.DROPSHIP_COLLAPSE_POSITION.clone();
      newPos.z += 40;
      this.camera.position.set(newPos.x, 1.7, newPos.z);
      this.callbacks.onNotification('MARCUS IS COVERING YOU - MOVE', 2000);
    }, 2000);
  }

  private disposeCollapseResources(): void {
    for (const p of this.healthPickups) p.mesh.dispose();
    this.healthPickups = [];
    for (const w of this.crumblingWalls) w.mesh.dispose();
    this.crumblingWalls = [];
    for (const e of this.collapseEnemies) e.mesh.dispose();
    this.collapseEnemies = [];
    for (const s of this.fallingStalactites) { s.mesh.dispose(); s.shadowMarker?.dispose(); }
    this.fallingStalactites = [];
    this.objectiveMarker?.dispose();
    this.objectiveMarker = null;
    this.objectiveBeacon?.dispose();
    this.objectiveBeacon = null;
    for (const c of this.groundCracks) c.dispose();
    this.groundCracks = [];
    for (const m of this.hiveEruptionMeshes) m.dispose();
    this.hiveEruptionMeshes = [];
    this.collapseLight?.dispose();
    this.collapseLight = null;
  }

  // ============================================================================
  // UPDATE LOOP
  // ============================================================================

  protected override processMovement(deltaTime: number): void {
    if (!this.isPointerLocked()) return;
    const baseSpeed = this.getMoveSpeed();
    const isSprinting = this.inputTracker.isActionActive('sprint');
    const moveSpeed = isSprinting ? baseSpeed * 1.8 : baseSpeed;
    const speed = moveSpeed * deltaTime;

    const forward = new Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const right = new Vector3(Math.cos(this.rotationY), 0, -Math.sin(this.rotationY));

    let dx = 0, dz = 0;
    if (this.inputTracker.isActionActive('moveForward')) { dx += forward.x; dz += forward.z; }
    if (this.inputTracker.isActionActive('moveBackward')) { dx -= forward.x; dz -= forward.z; }
    if (this.inputTracker.isActionActive('moveLeft')) { dx -= right.x; dz -= right.z; }
    if (this.inputTracker.isActionActive('moveRight')) { dx += right.x; dz += right.z; }

    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;
      this.camera.position.x += dx;
      this.camera.position.z += dz;
    }

    if (this.phaseState.phase === 'escape_tunnel') {
      this.phaseState.playerEscapeProgress = Math.abs(this.camera.position.z) / C.ESCAPE_TUNNEL_LENGTH;
      const tunnelRadius = 3.5;
      const distFromCenter = Math.sqrt(this.camera.position.x ** 2 + (this.camera.position.y - 1.7) ** 2);
      if (distFromCenter > tunnelRadius) {
        const scale = tunnelRadius / distFromCenter;
        this.camera.position.x *= scale;
      }
    }
  }

  protected override getMoveSpeed(): number {
    return (this.phaseState.phase === 'escape_tunnel' || this.phaseState.phase === 'hive_collapse') ? 8 : 5;
  }

  protected override handleKeyDown(e: KeyboardEvent): void {
    super.handleKeyDown(e);
    const reloadKeys = this.inputTracker.getAllKeysForAction('reload');
    if (reloadKeys.includes(e.code) && (this.phaseState.phase === 'holdout' || this.phaseState.phase === 'surface_run')) this.handleReload();
  }

  protected updateLevel(deltaTime: number): void {
    this.phaseState.phaseTime += deltaTime;

    if (this.collectibleSystem) {
      const nearby = this.collectibleSystem.update(this.camera.position, deltaTime);
      if (nearby) this.collectibleSystem.collect(nearby.id);
    }

    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - deltaTime * 1000);
    this.flareCooldown = Math.max(0, this.flareCooldown - deltaTime * 1000);

    if (this.tunnelEnv && (this.phaseState.phase === 'escape_start' || this.phaseState.phase === 'escape_tunnel')) {
      updateBiolights(this.tunnelEnv.hiveBuilder.getBiolights(), this.phaseState.phaseTime);
    }

    switch (this.phaseState.phase) {
      case 'escape_tunnel': this.updateEscapeTunnel(deltaTime); break;
      case 'surface_run': this.updateSurfaceRun(deltaTime); break;
      case 'holdout': this.updateHoldout(deltaTime); break;
      case 'hive_collapse': this.updateHiveCollapse(deltaTime); break;
    }
  }

  private updateEscapeTunnel(deltaTime: number): void {
    this.phaseState.escapeTimer -= deltaTime;
    const collapseSpeed = 12 + (180 - this.phaseState.escapeTimer) * 0.05;
    this.phaseState.collapseDistance += collapseSpeed * deltaTime;
    if (this.tunnelEnv) this.tunnelEnv.collapseWall.position.z = -this.phaseState.collapseDistance;

    if (Math.random() < 0.3) this.debris.push(Effects.spawnTunnelDebris(this.scene, this.camera.position.z));

    const debrisResult = Effects.updateDebris(this.debris, this.camera.position, deltaTime);
    this.debris = debrisResult.updatedDebris;
    if (debrisResult.playerDamage > 0) { this.onPlayerDamaged(debrisResult.playerDamage); this.callbacks.onNotification('DEBRIS HIT', 500); }

    const playerZ = Math.abs(this.camera.position.z);
    if (this.phaseState.collapseDistance > playerZ + 5) {
      this.onPlayerDamaged(25);
      this.callbacks.onNotification('COLLAPSE DAMAGE', 1000);
      this.phaseState.collapseDistance = playerZ - 10;
    }

    if (this.phaseState.playerEscapeProgress >= 0.95) this.transitionToPhase('surface_run');
    this.callbacks.onObjectiveUpdate('ESCAPE THE HIVE', `TIME: ${Math.ceil(this.phaseState.escapeTimer)}s | PROGRESS: ${Math.floor(this.phaseState.playerEscapeProgress * 100)}%`);
  }

  private updateSurfaceRun(deltaTime: number): void {
    const playerPos2D = new Vector3(this.camera.position.x, 0, this.camera.position.z);
    const lzPos2D = new Vector3(C.LZ_POSITION.x, 0, C.LZ_POSITION.z);
    this.phaseState.distanceToLZ = Vector3.Distance(playerPos2D, lzPos2D);
    this.callbacks.onObjectiveUpdate('REACH LZ OMEGA', `Distance: ${this.phaseState.distanceToLZ.toFixed(0)}m`);

    if (Math.random() < 0.02 && this.enemies.length < 10) {
      const species = Math.random() < 0.7 ? 'skitterer' : 'lurker';
      const { position } = Enemies.calculateSpawnPosition(species, this.spawnPoints, this.breachHoles, C.LZ_POSITION, this.waveState.currentSpawnPointIndex);
      Enemies.spawnEnemy(this.scene, species, position, 1, this.enemies.length).then(enemy => { if (enemy) this.enemies.push(enemy); });
    }

    const playerDamage = Enemies.updateEnemies(this.enemies, this.camera.position, deltaTime);
    if (playerDamage > 0) this.onPlayerDamaged(playerDamage);

    if (this.phaseState.distanceToLZ < 30) this.transitionToPhase('holdout');
  }

  private updateHoldout(deltaTime: number): void {
    this.phaseState.dropshipETA -= deltaTime;
    this.waveState.wavePhaseTimer += deltaTime;

    switch (this.waveState.wavePhase) {
      case 'intermission': {
        const result = Phases.updateWaveIntermission(this.waveState, deltaTime);
        this.waveState = result.newState;
        if (result.shouldTransition) {
          const config = Phases.getWaveConfig(this.waveState.currentWave);
          if (config) { this.callbacks.onNotification(config.waveTitle, 2500); this.callbacks.onObjectiveUpdate(config.waveTitle, config.waveDescription); this.triggerShake(2); }
        }
        break;
      }
      case 'announcement': {
        const result = Phases.updateWaveAnnouncement(this.waveState, deltaTime);
        this.waveState = result.newState;
        if (result.shouldTransition) {
          getAudioManager().enterCombat();
          if (this.waveState.currentWave === C.TOTAL_WAVES) {
            this.callbacks.onNotification('FINAL WAVE - HOLD THE LINE', 3000);
            setTimeout(() => { if (this.phaseState.phase === 'holdout') this.transitionToPhase('hive_collapse'); }, 50000);
          }
          this.mechIntegrity = Math.min(this.mechIntegrity, Phases.getMechIntegrityCapForWave(this.waveState.currentWave));
        }
        break;
      }
      case 'active': {
        const spawnResult = Phases.updateActiveWaveSpawning(this.waveState, deltaTime);
        this.waveState = spawnResult.newState;
        if (spawnResult.spawnSpecies) {
          const { position, newSpawnPointIndex } = Enemies.calculateSpawnPosition(spawnResult.spawnSpecies, this.spawnPoints, this.breachHoles, C.LZ_POSITION, this.waveState.currentSpawnPointIndex);
          this.waveState.currentSpawnPointIndex = newSpawnPointIndex;
          Enemies.spawnEnemy(this.scene, spawnResult.spawnSpecies, position, this.waveState.currentWave, this.enemies.length).then(enemy => { if (enemy) this.enemies.push(enemy); });
        }
        break;
      }
    }

    const playerDamage = Enemies.updateEnemies(this.enemies, this.camera.position, deltaTime);
    if (playerDamage > 0) this.onPlayerDamaged(playerDamage);

    // Mech AI
    if (this.mechMesh && this.mechGunLight && this.mechIntegrity > 0) {
      this.mechFireTimer -= deltaTime;
      if (this.mechFireTimer <= 0) {
        this.mechFireTimer = C.MECH_FIRE_RATE;
        const { enemy, damage } = Enemies.mechFireAtEnemy(this.mechMesh, this.mechGunLight, this.enemies, this.mechIntegrity);
        if (enemy) {
          enemy.health -= damage;
          if (enemy.health <= 0) { Enemies.killEnemy(enemy); this.waveState = Phases.recordWaveKill(this.waveState); this.kills++; this.callbacks.onKill(); }
        }
      }
    }

    if (this.waveState.wavePhase === 'active' && this.mechIntegrity > 0) this.mechIntegrity -= deltaTime * 0.3;

    if (Phases.isWaveComplete(this.waveState)) {
      this.waveState = Phases.completeWave(this.waveState);
      this.callbacks.onNotification(`WAVE ${this.waveState.currentWave} CLEAR - ${this.waveState.waveEnemiesKilled} KILLS`, 3000);
      getAudioManager().exitCombat(500);

      const comms = Comms.WAVE_COMPLETE_COMMS[this.waveState.currentWave];
      if (comms) setTimeout(() => this.callbacks.onCommsMessage(comms), 1500);

      if (this.waveState.currentWave >= C.TOTAL_WAVES) {
        setTimeout(() => { if (this.phaseState.phase === 'holdout') this.transitionToPhase('hive_collapse'); }, 2000);
      } else if (this.waveState.currentWave < C.TOTAL_WAVES) {
        setTimeout(() => {
          this.waveState = Phases.startWaveIntermission(this.waveState, this.waveState.currentWave + 1);
          const config = Phases.getWaveConfig(this.waveState.currentWave);
          if (config) { this.callbacks.onNotification(`INCOMING: ${config.waveTitle}`, 3000); if (config.commsMessage) setTimeout(() => this.callbacks.onCommsMessage(config.commsMessage!), 1000); }
        }, 2000);
      }
    }

    const hud = Phases.getWaveHUDDisplay(this.waveState, this.phaseState.dropshipETA, this.kills, this.mechIntegrity, this.enemies.filter(e => e.isActive).length);
    this.callbacks.onObjectiveUpdate(hud.title, hud.description);

    if (this.phaseState.dropshipETA <= 0 && this.phaseState.phase === 'holdout') this.transitionToPhase('victory');
  }

  private onPlayerDamaged(damage: number): void {
    this.playerHealth -= damage;
    this.callbacks.onHealthChange(this.playerHealth);
    this.callbacks.onDamage();
    this.triggerDamageShake(damage);
    this.trackPlayerDamage(damage);

    if (this.playerHealth <= 0) {
      this.noDeathBonus = false;
      this.onPlayerDeath();
      this.callbacks.onNotification('KIA', 3000);
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  override canTransitionTo(levelId: LevelId): boolean { return false; }

  protected disposeLevel(): void {
    for (const node of this.floraNodes) node.dispose(false, true);
    this.floraNodes = [];
    this.collectibleSystem?.dispose();
    this.collectibleSystem = null;
    this.callbacks.onActionHandlerRegister(null);
    this.callbacks.onActionGroupsChange([]);
    Victory.disposeVictoryState(this.victoryState);
    this.tunnelEnv?.hiveBuilder.dispose();
    this.tunnelEnv = null;
    this.debris.forEach(d => d.mesh.dispose());
    this.disposeCollapseResources();
    if (this.surfaceEnv) { this.surfaceEnv.terrain.dispose(); this.surfaceEnv.surfaceTerrain.material.dispose(); this.surfaceEnv = null; this.terrain = null; } else { this.terrain?.dispose(); }
    this.extractionEnv?.dispose();
    this.extractionEnv = null;
    this.skyDome?.dispose();
    this.lzPad?.dispose();
    this.lzBeacon?.dispose();
    this.breachHoles.forEach(h => h.dispose());
    this.canyonWalls.forEach(w => w.dispose());
    this.barrierWalls.forEach(b => b.dispose());
    this.coverObjects.forEach(c => c.dispose());
    this.coverObjects = [];
    this.supplyDrops.forEach(d => d.mesh.dispose());
    this.supplyDrops = [];
    this.spawnPoints = [];
    this.mechMesh?.dispose();
    this.mechGunLight?.dispose();
    this.dropship?.dispose();
    this.enemies.forEach(e => e.mesh.dispose());
  }
}
