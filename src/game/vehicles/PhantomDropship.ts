/**
 * PhantomDropship - Alien dropship vehicle the player can pilot
 *
 * Inspired by the Covenant Phantom from Halo.
 * Built entirely from BabylonJS primitives (no GLB).
 *
 * Features:
 *  - Flight controls: pitch, yaw, roll, throttle, strafe
 *  - Hover mode (default) and forward-flight mode
 *  - Weapons: plasma turret (auto-aim, heat-based), plasma bomb (AOE)
 *  - Regenerating energy shield
 *  - Passenger capacity for NPC marines
 *  - Landing / takeoff animations
 *  - Procedural engine sound via Web Audio API
 *  - Purple/blue glowing hull using StandardMaterial emissive
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import { createEntity, getEntitiesInRadius, removeEntity } from '../core/ecs';
import { particleManager } from '../effects/ParticleManager';
import { VehicleBase, type VehicleStats, type VehicleWeapon } from './VehicleBase';

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const PHANTOM_STATS: VehicleStats = {
  health: 800,
  maxHealth: 800,
  shield: 300,
  maxShield: 300,
  shieldRegenRate: 25, // per second
  shieldRegenDelay: 4000, // 4s after last damage
  speed: 0,
  maxSpeed: 55,
  acceleration: 18,
  turnRate: 1.4, // rad/s
  mass: 4000,
};

const HOVER_HEIGHT = 12;
const LANDING_HEIGHT = 0.5;
const TAKEOFF_SPEED = 8; // units/s for vertical transition
const STRAFE_SPEED = 22;
const VERTICAL_SPEED = 15;
const ROLL_LIMIT = Math.PI / 6;
const PITCH_LIMIT = Math.PI / 8;

// Colors
const HULL_COLOR = '#2E1B4E'; // Dark purple
const HULL_ACCENT = '#4A2D7A'; // Lighter purple
const GLOW_PRIMARY = '#7B4FE0'; // Purple glow
const GLOW_SECONDARY = '#4FA0E0'; // Blue glow
const ENGINE_GLOW = '#6B8CFF'; // Engine blue

// --------------------------------------------------------------------------
// Phantom Dropship
// --------------------------------------------------------------------------

export type PhantomFlightMode = 'hover' | 'forward';
export type PhantomLandingState = 'grounded' | 'taking_off' | 'airborne' | 'landing';

export class PhantomDropship extends VehicleBase {
  // Flight state
  public flightMode: PhantomFlightMode = 'hover';
  public landingState: PhantomLandingState = 'grounded';
  public altitude = LANDING_HEIGHT;
  public targetAltitude = LANDING_HEIGHT;

  // Flight physics
  private throttle = 0; // 0-1
  private pitch = 0;
  private yaw = 0;
  private roll = 0;
  private strafeInput = 0;
  private verticalInput = 0;

  // Engine sound
  private engineAudioCtx: AudioContext | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGainNode: GainNode | null = null;
  private engineLFO: OscillatorNode | null = null;

  // Visual references
  private engineGlowMeshes: Mesh[] = [];
  private shieldMesh: Mesh | null = null;
  private shieldMat: StandardMaterial | null = null;
  private hullGlowMat: StandardMaterial | null = null;

  // Landing animation progress
  private landingProgress = 0;

  constructor(scene: Scene, position: Vector3) {
    super(scene, 'phantom_dropship', 'Phantom Dropship', position, PHANTOM_STATS, 4);
    this.weapons = this.initWeapons();
    this.setVehicleCameraOffset(new Vector3(0, 6, -18));
  }

  // ------------------------------------------------------------------
  // Hull construction from BabylonJS primitives
  // ------------------------------------------------------------------

  protected buildHull(): void {
    // --- Materials ---
    const hullMat = new StandardMaterial('phantomHull', this.scene);
    hullMat.diffuseColor = Color3.FromHexString(HULL_COLOR);
    hullMat.specularColor = new Color3(0.2, 0.15, 0.3);
    hullMat.emissiveColor = new Color3(0.05, 0.02, 0.08);

    const accentMat = new StandardMaterial('phantomAccent', this.scene);
    accentMat.diffuseColor = Color3.FromHexString(HULL_ACCENT);
    accentMat.specularColor = new Color3(0.25, 0.2, 0.35);

    this.hullGlowMat = new StandardMaterial('phantomGlow', this.scene);
    this.hullGlowMat.emissiveColor = Color3.FromHexString(GLOW_PRIMARY);
    this.hullGlowMat.disableLighting = true;
    this.hullGlowMat.alpha = 0.85;

    const engineMat = new StandardMaterial('phantomEngine', this.scene);
    engineMat.emissiveColor = Color3.FromHexString(ENGINE_GLOW);
    engineMat.disableLighting = true;
    engineMat.alpha = 0.9;

    // --- Main body - flattened elongated ellipsoid ---
    const body = MeshBuilder.CreateSphere(
      'phantomBody',
      {
        diameterX: 8,
        diameterY: 2.5,
        diameterZ: 14,
        segments: 16,
      },
      this.scene,
    );
    body.material = hullMat;
    body.parent = this.rootNode;
    body.position.y = 0;
    this.hullMeshes.push(body);

    // --- Top canopy / bridge ---
    const canopy = MeshBuilder.CreateSphere(
      'phantomCanopy',
      {
        diameterX: 3.5,
        diameterY: 1.8,
        diameterZ: 4,
        segments: 12,
      },
      this.scene,
    );
    canopy.material = accentMat;
    canopy.parent = this.rootNode;
    canopy.position.set(0, 1.3, -2);
    this.hullMeshes.push(canopy);

    // --- Side wings / fins ---
    for (let side = -1; side <= 1; side += 2) {
      const wing = MeshBuilder.CreateBox(
        `phantomWing_${side}`,
        { width: 5, height: 0.4, depth: 6 },
        this.scene,
      );
      wing.material = hullMat;
      wing.parent = this.rootNode;
      wing.position.set(side * 5.5, -0.3, -1);
      wing.rotation.z = side * 0.15;
      this.hullMeshes.push(wing);

      // Wing tip fin
      const fin = MeshBuilder.CreateBox(
        `phantomFin_${side}`,
        { width: 0.4, height: 2, depth: 3 },
        this.scene,
      );
      fin.material = accentMat;
      fin.parent = this.rootNode;
      fin.position.set(side * 8, 0.5, -2);
      this.hullMeshes.push(fin);

      // Engine pods under wings
      const enginePod = MeshBuilder.CreateCylinder(
        `phantomEnginePod_${side}`,
        {
          height: 2.5,
          diameterTop: 1.2,
          diameterBottom: 1.8,
          tessellation: 12,
        },
        this.scene,
      );
      enginePod.material = hullMat;
      enginePod.parent = this.rootNode;
      enginePod.position.set(side * 5, -1.2, 1);
      this.hullMeshes.push(enginePod);

      // Engine glow disc
      const engineGlow = MeshBuilder.CreateDisc(
        `phantomEngineGlow_${side}`,
        { radius: 0.8, tessellation: 16 },
        this.scene,
      );
      engineGlow.material = engineMat;
      engineGlow.parent = this.rootNode;
      engineGlow.position.set(side * 5, -2.5, 1);
      engineGlow.rotation.x = Math.PI / 2;
      this.hullMeshes.push(engineGlow);
      this.engineGlowMeshes.push(engineGlow);
    }

    // --- Central engine (underside) ---
    const centralEngine = MeshBuilder.CreateCylinder(
      'phantomCentralEngine',
      {
        height: 1.5,
        diameterTop: 2,
        diameterBottom: 3,
        tessellation: 16,
      },
      this.scene,
    );
    centralEngine.material = hullMat;
    centralEngine.parent = this.rootNode;
    centralEngine.position.set(0, -1.5, 0);
    this.hullMeshes.push(centralEngine);

    const centralGlow = MeshBuilder.CreateDisc(
      'phantomCentralGlow',
      { radius: 1.4, tessellation: 16 },
      this.scene,
    );
    centralGlow.material = engineMat;
    centralGlow.parent = this.rootNode;
    centralGlow.position.set(0, -2.3, 0);
    centralGlow.rotation.x = Math.PI / 2;
    this.hullMeshes.push(centralGlow);
    this.engineGlowMeshes.push(centralGlow);

    // --- Troop bay / underside compartment ---
    const bay = MeshBuilder.CreateBox(
      'phantomBay',
      { width: 3.5, height: 1.5, depth: 6 },
      this.scene,
    );
    bay.material = accentMat;
    bay.parent = this.rootNode;
    bay.position.set(0, -1, 2);
    this.hullMeshes.push(bay);

    // --- Glow strips along hull seams ---
    const stripPositions = [
      { pos: new Vector3(0, 0.8, -5), rot: new Vector3(0, 0, 0), len: 3 },
      { pos: new Vector3(0, 0.8, 4), rot: new Vector3(0, 0, 0), len: 2 },
      { pos: new Vector3(-3, 0, 0), rot: new Vector3(0, Math.PI / 2, 0), len: 4 },
      { pos: new Vector3(3, 0, 0), rot: new Vector3(0, Math.PI / 2, 0), len: 4 },
    ];

    for (let i = 0; i < stripPositions.length; i++) {
      const { pos, rot, len } = stripPositions[i];
      const strip = MeshBuilder.CreateBox(
        `phantomStrip_${i}`,
        { width: 0.1, height: 0.08, depth: len },
        this.scene,
      );
      strip.material = this.hullGlowMat;
      strip.parent = this.rootNode;
      strip.position = pos;
      strip.rotation = rot;
      this.hullMeshes.push(strip);
    }

    // --- Plasma turret mount (front underside) ---
    const turretMount = MeshBuilder.CreateCylinder(
      'phantomTurret',
      {
        height: 0.8,
        diameterTop: 0.6,
        diameterBottom: 1.0,
        tessellation: 10,
      },
      this.scene,
    );
    turretMount.material = accentMat;
    turretMount.parent = this.rootNode;
    turretMount.position.set(0, -1.8, -4);
    this.hullMeshes.push(turretMount);

    // Turret barrel
    const turretBarrel = MeshBuilder.CreateCylinder(
      'phantomTurretBarrel',
      {
        height: 2.5,
        diameterTop: 0.15,
        diameterBottom: 0.2,
        tessellation: 8,
      },
      this.scene,
    );
    turretBarrel.material = hullMat;
    turretBarrel.parent = this.rootNode;
    turretBarrel.position.set(0, -2.2, -5);
    turretBarrel.rotation.x = Math.PI / 2;
    this.hullMeshes.push(turretBarrel);

    // Turret glow tip
    const turretGlow = MeshBuilder.CreateSphere(
      'phantomTurretGlow',
      { diameter: 0.3 },
      this.scene,
    );
    turretGlow.material = this.hullGlowMat;
    turretGlow.parent = this.rootNode;
    turretGlow.position.set(0, -2.2, -6.3);
    this.hullMeshes.push(turretGlow);

    // --- Shield bubble (invisible until hit) ---
    this.shieldMat = new StandardMaterial('phantomShield', this.scene);
    this.shieldMat.emissiveColor = Color3.FromHexString(GLOW_SECONDARY);
    this.shieldMat.alpha = 0;
    this.shieldMat.disableLighting = true;
    this.shieldMat.backFaceCulling = false;

    this.shieldMesh = MeshBuilder.CreateSphere(
      'phantomShieldBubble',
      { diameter: 18, segments: 16 },
      this.scene,
    );
    this.shieldMesh.material = this.shieldMat;
    this.shieldMesh.parent = this.rootNode;
    this.shieldMesh.position.y = 0;
    this.hullMeshes.push(this.shieldMesh);
  }

  // ------------------------------------------------------------------
  // Weapons
  // ------------------------------------------------------------------

  protected initWeapons(): VehicleWeapon[] {
    return [
      {
        id: 'plasma_turret',
        name: 'Plasma Turret',
        damage: 18,
        fireRate: 8,
        cooldownMax: 0.85,
        heatPerShot: 0.06,
        coolRate: 0.25,
        projectileSpeed: 90,
        isAOE: false,
        lastFireTime: 0,
        currentHeat: 0,
        isOverheated: false,
      },
      {
        id: 'plasma_bomb',
        name: 'Plasma Bomb',
        damage: 120,
        fireRate: 0.4,
        cooldownMax: 1.0,
        heatPerShot: 0.5,
        coolRate: 0.15,
        projectileSpeed: 40,
        isAOE: true,
        aoeRadius: 12,
        lastFireTime: 0,
        currentHeat: 0,
        isOverheated: false,
      },
    ];
  }

  public fireWeapon(): void {
    const weapon = this.weapons[0]; // plasma turret
    if (!this.canFireWeapon(weapon)) return;
    this.onWeaponFired(weapon);

    const forward = this.getForward();
    const spawnPos = this.rootNode.position
      .add(forward.scale(-6.5))
      .add(new Vector3(0, -2.2, 0));

    this.createPlasmaBolt(spawnPos, forward, weapon);
    getAudioManager().play('mech_fire', { volume: 0.4 });
  }

  public fireSecondaryWeapon(): void {
    const weapon = this.weapons[1]; // plasma bomb
    if (!this.canFireWeapon(weapon)) return;
    this.onWeaponFired(weapon);

    const forward = this.getForward();
    const spawnPos = this.rootNode.position
      .add(new Vector3(0, -2.5, 0));

    this.createPlasmaBomb(spawnPos, forward, weapon);
    getAudioManager().play('explosion', { volume: 0.35 });
  }

  private createPlasmaBolt(
    spawnPos: Vector3,
    direction: Vector3,
    weapon: VehicleWeapon,
  ): void {
    const bolt = MeshBuilder.CreateCylinder(
      'phantomBolt',
      {
        height: 1.8,
        diameterTop: 0.15,
        diameterBottom: 0.1,
        tessellation: 8,
      },
      this.scene,
    );
    bolt.position = spawnPos;

    // Orient along direction
    const up = Vector3.Up();
    const axis = Vector3.Cross(up, direction).normalize();
    if (axis.length() > 0.001) {
      const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(up, direction))));
      bolt.rotationQuaternion = Quaternion.RotationAxis(axis, angle);
    }

    const boltMat = new StandardMaterial('phantomBoltMat', this.scene);
    boltMat.emissiveColor = Color3.FromHexString(GLOW_PRIMARY);
    boltMat.disableLighting = true;
    bolt.material = boltMat;

    // Outer glow
    const glow = MeshBuilder.CreateCylinder(
      'phantomBoltGlow',
      { height: 2.2, diameterTop: 0.4, diameterBottom: 0.3, tessellation: 8 },
      this.scene,
    );
    glow.parent = bolt;
    glow.position = Vector3.Zero();

    const glowMat = new StandardMaterial('phantomBoltGlowMat', this.scene);
    glowMat.emissiveColor = Color3.FromHexString(GLOW_SECONDARY);
    glowMat.disableLighting = true;
    glowMat.alpha = 0.35;
    glow.material = glowMat;

    bolt.onDisposeObservable.add(() => {
      boltMat.dispose();
      glowMat.dispose();
    });

    const velocity = direction.scale(weapon.projectileSpeed);

    createEntity({
      transform: {
        position: spawnPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: weapon.projectileSpeed,
      },
      renderable: {
        mesh: bolt,
        visible: true,
      },
      tags: {
        projectile: true,
        player: true, // vehicle projectiles count as player
      },
      lifetime: {
        remaining: 2500,
        onExpire: () => bolt.dispose(),
      },
    });
  }

  private createPlasmaBomb(
    spawnPos: Vector3,
    direction: Vector3,
    weapon: VehicleWeapon,
  ): void {
    const bomb = MeshBuilder.CreateSphere(
      'phantomBomb',
      { diameter: 0.8, segments: 10 },
      this.scene,
    );
    bomb.position = spawnPos;

    const bombMat = new StandardMaterial('phantomBombMat', this.scene);
    bombMat.emissiveColor = Color3.FromHexString(GLOW_PRIMARY);
    bombMat.disableLighting = true;
    bombMat.alpha = 0.9;
    bomb.material = bombMat;

    // Glow shell
    const shell = MeshBuilder.CreateSphere(
      'phantomBombGlow',
      { diameter: 1.4, segments: 8 },
      this.scene,
    );
    shell.parent = bomb;
    const shellMat = new StandardMaterial('phantomBombGlowMat', this.scene);
    shellMat.emissiveColor = Color3.FromHexString(GLOW_SECONDARY);
    shellMat.disableLighting = true;
    shellMat.alpha = 0.25;
    shell.material = shellMat;

    bomb.onDisposeObservable.add(() => {
      bombMat.dispose();
      shellMat.dispose();
    });

    // The bomb drops with gravity and forward momentum
    const velocity = direction.scale(weapon.projectileSpeed).add(new Vector3(0, -5, 0));

    const startTime = performance.now();
    const gravityAccum = Vector3.Zero();

    // Animate gravity
    const animGravity = () => {
      if (bomb.isDisposed()) return;
      const elapsed = (performance.now() - startTime) / 1000;
      gravityAccum.y = -9.8 * elapsed; // accumulate gravity
      requestAnimationFrame(animGravity);
    };
    requestAnimationFrame(animGravity);

    const bombEntity = createEntity({
      transform: {
        position: spawnPos.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: weapon.projectileSpeed * 2,
      },
      renderable: {
        mesh: bomb,
        visible: true,
      },
      tags: {
        projectile: true,
        player: true,
      },
      lifetime: {
        remaining: 4000,
        onExpire: () => {
          // AOE damage on impact/timeout
          this.detonatePlasmaAOE(bomb.position, weapon);
          bomb.dispose();
        },
      },
    });

    // Check for ground impact each frame
    const checkImpact = () => {
      if (bomb.isDisposed()) return;
      if (bombEntity.transform && bombEntity.transform.position.y <= 0.5) {
        // Hit ground - detonate
        this.detonatePlasmaAOE(bombEntity.transform.position, weapon);
        bomb.dispose();
        removeEntity(bombEntity);
        return;
      }
      // Apply gravity to velocity
      if (bombEntity.velocity) {
        bombEntity.velocity.linear.y -= 9.8 * 0.016;
      }
      requestAnimationFrame(checkImpact);
    };
    requestAnimationFrame(checkImpact);
  }

  private detonatePlasmaAOE(position: Vector3, weapon: VehicleWeapon): void {
    const radius = weapon.aoeRadius ?? 10;

    // Damage entities in radius
    const targets = getEntitiesInRadius(position, radius, (e) => e.tags?.enemy === true);
    for (const target of targets) {
      if (!target.health || !target.transform) continue;
      const dist = Vector3.Distance(position, target.transform.position);
      const falloff = 1 - dist / radius;
      const dmg = Math.round(weapon.damage * Math.max(0.2, falloff));
      target.health.current -= dmg;
    }

    // Visual explosion
    particleManager.emitExplosion(position, 2.5);
    getAudioManager().play('explosion', { volume: 0.7 });
  }

  // ------------------------------------------------------------------
  // Flight input
  // ------------------------------------------------------------------

  protected processInput(deltaTime: number): void {
    // Throttle
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) {
      this.throttle = Math.min(1, this.throttle + deltaTime * 1.5);
    } else if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) {
      this.throttle = Math.max(-0.3, this.throttle - deltaTime * 2);
    } else {
      // Throttle decay
      this.throttle *= Math.pow(0.3, deltaTime);
      if (Math.abs(this.throttle) < 0.01) this.throttle = 0;
    }

    // Yaw
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) {
      this.yaw = -this.stats.turnRate;
    } else if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) {
      this.yaw = this.stats.turnRate;
    } else {
      this.yaw = 0;
    }

    // Strafe
    if (this.isKeyDown('KeyQ')) {
      this.strafeInput = -1;
    } else if (this.isKeyDown('KeyE') && !this.isKeyDown('KeyE')) {
      // E is exit, handled in base. For strafe use alternative
      this.strafeInput = 0;
    } else {
      this.strafeInput = 0;
    }

    // Vertical
    if (this.isKeyDown('Space')) {
      this.verticalInput = 1;
    } else if (this.isKeyDown('ControlLeft') || this.isKeyDown('ShiftLeft')) {
      this.verticalInput = -1;
    } else {
      this.verticalInput = 0;
    }

    // Toggle flight mode
    if (this.isKeyDown('KeyF') && this.landingState === 'airborne') {
      this.flightMode = this.flightMode === 'hover' ? 'forward' : 'hover';
    }

    // Takeoff / Landing
    if (this.isKeyDown('KeyG')) {
      if (this.landingState === 'grounded') {
        this.beginTakeoff();
      } else if (this.landingState === 'airborne') {
        this.beginLanding();
      }
    }

    // Fire weapons
    if (this.isFiring) {
      this.fireWeapon();
    }
    if (this.isFiringSecondary) {
      this.fireSecondaryWeapon();
    }
  }

  // ------------------------------------------------------------------
  // Takeoff / Landing
  // ------------------------------------------------------------------

  private beginTakeoff(): void {
    if (this.landingState !== 'grounded') return;
    this.landingState = 'taking_off';
    this.landingProgress = 0;
    this.targetAltitude = HOVER_HEIGHT;
    this.startEngineSound();
    console.log('[Phantom] Takeoff initiated');
  }

  private beginLanding(): void {
    if (this.landingState !== 'airborne') return;
    this.landingState = 'landing';
    this.landingProgress = 0;
    this.targetAltitude = LANDING_HEIGHT;
    console.log('[Phantom] Landing initiated');
  }

  // ------------------------------------------------------------------
  // Engine sound (procedural Web Audio API)
  // ------------------------------------------------------------------

  private startEngineSound(): void {
    if (this.engineAudioCtx) return;

    try {
      this.engineAudioCtx = new AudioContext();
      const ctx = this.engineAudioCtx;

      // Main engine tone - deep rumble
      this.engineOscillator = ctx.createOscillator();
      this.engineOscillator.type = 'sawtooth';
      this.engineOscillator.frequency.setValueAtTime(55, ctx.currentTime);

      // LFO for wobble
      this.engineLFO = ctx.createOscillator();
      this.engineLFO.type = 'sine';
      this.engineLFO.frequency.setValueAtTime(3, ctx.currentTime);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(8, ctx.currentTime);
      this.engineLFO.connect(lfoGain);
      lfoGain.connect(this.engineOscillator.frequency);

      // Low-pass filter for that bassy throb
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, ctx.currentTime);
      filter.Q.setValueAtTime(2, ctx.currentTime);

      // Output gain
      this.engineGainNode = ctx.createGain();
      this.engineGainNode.gain.setValueAtTime(0.08, ctx.currentTime);

      // Chain: osc -> filter -> gain -> destination
      this.engineOscillator.connect(filter);
      filter.connect(this.engineGainNode);
      this.engineGainNode.connect(ctx.destination);

      this.engineOscillator.start();
      this.engineLFO.start();
    } catch {
      console.warn('[Phantom] Could not create engine audio');
    }
  }

  private updateEngineSound(): void {
    if (!this.engineOscillator || !this.engineGainNode || !this.engineAudioCtx) return;
    const ctx = this.engineAudioCtx;
    const now = ctx.currentTime;

    // Frequency varies with throttle
    const baseFreq = 55 + Math.abs(this.throttle) * 45;
    this.engineOscillator.frequency.setTargetAtTime(baseFreq, now, 0.1);

    // Volume varies with activity
    const baseVol = this.landingState === 'grounded' ? 0 : 0.06;
    const throttleVol = Math.abs(this.throttle) * 0.06;
    this.engineGainNode.gain.setTargetAtTime(baseVol + throttleVol, now, 0.1);
  }

  private stopEngineSound(): void {
    try {
      this.engineOscillator?.stop();
      this.engineLFO?.stop();
      this.engineAudioCtx?.close();
    } catch {
      // May already be stopped
    }
    this.engineOscillator = null;
    this.engineLFO = null;
    this.engineGainNode = null;
    this.engineAudioCtx = null;
  }

  // ------------------------------------------------------------------
  // Vehicle update
  // ------------------------------------------------------------------

  protected updateVehicle(deltaTime: number): void {
    this.updateLandingState(deltaTime);
    this.updateFlightPhysics(deltaTime);
    this.updateEngineGlow(deltaTime);
    this.updateShieldVisual(deltaTime);
    this.updateEngineSound();
  }

  private updateLandingState(deltaTime: number): void {
    if (this.landingState === 'taking_off') {
      this.altitude = Math.min(
        this.targetAltitude,
        this.altitude + TAKEOFF_SPEED * deltaTime,
      );
      this.landingProgress = (this.altitude - LANDING_HEIGHT) / (HOVER_HEIGHT - LANDING_HEIGHT);

      if (this.altitude >= this.targetAltitude) {
        this.landingState = 'airborne';
        this.altitude = HOVER_HEIGHT;
        console.log('[Phantom] Airborne');
      }
    } else if (this.landingState === 'landing') {
      this.altitude = Math.max(
        this.targetAltitude,
        this.altitude - TAKEOFF_SPEED * 0.7 * deltaTime,
      );
      this.landingProgress = 1 - (this.altitude - LANDING_HEIGHT) / (HOVER_HEIGHT - LANDING_HEIGHT);

      if (this.altitude <= LANDING_HEIGHT + 0.1) {
        this.landingState = 'grounded';
        this.altitude = LANDING_HEIGHT;
        this.throttle = 0;
        this.stopEngineSound();
        getAudioManager().play('drop_impact', { volume: 0.3 });
        console.log('[Phantom] Grounded');
      }
    }
  }

  private updateFlightPhysics(deltaTime: number): void {
    if (this.landingState === 'grounded') return;

    const root = this.rootNode;
    const quat = root.rotationQuaternion ?? Quaternion.Identity();

    // -- Yaw rotation --
    if (Math.abs(this.yaw) > 0.001) {
      const yawQ = Quaternion.RotationAxis(Vector3.Up(), this.yaw * deltaTime);
      root.rotationQuaternion = quat.multiply(yawQ);
    }

    // -- Forward motion --
    const forward = root.forward;
    const right = root.right;

    const targetSpeed = this.throttle * this.stats.maxSpeed;
    const currentSpeed = this.linearVelocity.length();
    const speedDiff = targetSpeed - currentSpeed;
    const accelForce = Math.sign(speedDiff) * Math.min(
      Math.abs(speedDiff),
      this.stats.acceleration * deltaTime,
    );

    if (this.flightMode === 'forward') {
      this.linearVelocity.addInPlace(forward.scale(accelForce));
    }

    // -- Strafe --
    if (Math.abs(this.strafeInput) > 0.01 && this.landingState === 'airborne') {
      this.linearVelocity.addInPlace(right.scale(this.strafeInput * STRAFE_SPEED * deltaTime));
    }

    // -- Vertical --
    if (this.landingState === 'airborne') {
      this.altitude += this.verticalInput * VERTICAL_SPEED * deltaTime;
      this.altitude = Math.max(2, Math.min(80, this.altitude));
    }

    // -- Hover mode: bleed forward speed, maintain altitude --
    if (this.flightMode === 'hover') {
      this.linearVelocity.scaleInPlace(Math.pow(0.15, deltaTime)); // heavy drag
    } else {
      // Forward mode: lighter drag
      this.linearVelocity.scaleInPlace(Math.pow(0.7, deltaTime));
    }

    // -- Apply velocity --
    root.position.addInPlace(this.linearVelocity.scale(deltaTime));
    root.position.y = this.altitude;

    // -- Visual tilt based on movement --
    const targetPitch = this.flightMode === 'forward'
      ? -this.throttle * PITCH_LIMIT
      : 0;
    const targetRoll = -this.yaw * ROLL_LIMIT * 0.6;

    this.pitch += (targetPitch - this.pitch) * Math.min(1, 3 * deltaTime);
    this.roll += (targetRoll - this.roll) * Math.min(1, 4 * deltaTime);

    // Apply pitch and roll on top of yaw
    if (root.rotationQuaternion) {
      const pitchQ = Quaternion.RotationAxis(Vector3.Right(), this.pitch);
      const rollQ = Quaternion.RotationAxis(Vector3.Forward(), this.roll);
      // Keep current yaw, apply pitch+roll
      const yawOnly = Quaternion.RotationYawPitchRoll(
        root.rotationQuaternion.toEulerAngles().y,
        0,
        0,
      );
      root.rotationQuaternion = yawOnly.multiply(pitchQ).multiply(rollQ);
    }
  }

  private updateEngineGlow(deltaTime: number): void {
    const time = performance.now() * 0.003;
    const intensity = this.landingState === 'grounded'
      ? 0.2
      : 0.5 + Math.abs(this.throttle) * 0.4 + Math.sin(time) * 0.1;

    for (const glow of this.engineGlowMeshes) {
      if (glow.material && glow.material instanceof StandardMaterial) {
        glow.material.alpha = intensity;
      }
    }

    // Hull glow pulses
    if (this.hullGlowMat) {
      const pulse = 0.6 + Math.sin(time * 0.8) * 0.25;
      this.hullGlowMat.alpha = pulse;
    }
  }

  private updateShieldVisual(_deltaTime: number): void {
    if (!this.shieldMat || !this.shieldMesh) return;

    const shieldRatio = this.stats.shield / this.stats.maxShield;
    // Shield becomes visible when recently hit or when regenerating
    const recentlyHit = performance.now() - (this as any).lastDamageTime < 500;
    const targetAlpha = recentlyHit ? 0.15 + (1 - shieldRatio) * 0.2 : 0;
    this.shieldMat.alpha += (targetAlpha - this.shieldMat.alpha) * 0.1;
  }

  // ------------------------------------------------------------------
  // HUD data accessors (consumed by VehicleHUD React component)
  // ------------------------------------------------------------------

  public getSpeed(): number {
    return this.linearVelocity.length();
  }

  public getAltitude(): number {
    return this.altitude;
  }

  public getThrottle(): number {
    return this.throttle;
  }

  public getShieldRatio(): number {
    return this.stats.maxShield > 0 ? this.stats.shield / this.stats.maxShield : 0;
  }

  public getHealthRatio(): number {
    return this.stats.maxHealth > 0 ? this.stats.health / this.stats.maxHealth : 0;
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  public override dispose(): void {
    this.stopEngineSound();
    super.dispose();
  }
}
