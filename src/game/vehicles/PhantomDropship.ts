/**
 * PhantomDropship - Alien dropship vehicle the player can pilot
 *
 * Inspired by the Covenant Phantom from Halo.
 * Hull geometry loaded from GLB model (models/spaceships/Dispatcher.glb).
 * VFX (shield bubble, projectiles, thrust glow) still use MeshBuilder.
 *
 * Features:
 *  - Flight controls: pitch, yaw, roll, throttle, strafe
 *  - Hover mode (default) and forward-flight mode
 *  - Weapons: plasma turret (auto-aim, heat-based), plasma bomb (AOE)
 *  - Regenerating energy shield
 *  - Passenger capacity for NPC marines
 *  - Landing / takeoff animations
 *  - Procedural engine sound via Web Audio API
 */

import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../core/AssetManager';
import { getAudioManager } from '../core/AudioManager';
import { createEntity, getEntitiesInRadius, removeEntity } from '../core/ecs';
import { getLogger } from '../core/Logger';
import { particleManager } from '../effects/ParticleManager';
import { VehicleBase, type VehicleStats, type VehicleWeapon } from './VehicleBase';

const log = getLogger('PhantomDropship');

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

// GLB model path (absolute from public root, used by AssetManager)
const PHANTOM_GLB_PATH = '/assets/models/vehicles/phantom.glb';

// Colors (used for VFX: shield bubble, projectiles, engine glow animation)
const GLOW_PRIMARY = '#7B4FE0'; // Purple glow
const GLOW_SECONDARY = '#4FA0E0'; // Blue glow

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

  // GLB model state
  private modelReady = false;
  private glbRoot: TransformNode | null = null;
  private glbMeshes: AbstractMesh[] = [];

  // Cached animated part references (from GLB child meshes)
  private rampMesh: AbstractMesh | null = null;
  private leftEngineMesh: AbstractMesh | null = null;
  private rightEngineMesh: AbstractMesh | null = null;
  private turretMesh: AbstractMesh | null = null;

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
  // Hull construction -- VFX only (shield bubble).
  // Structural hull geometry is loaded async from GLB via loadModel().
  // ------------------------------------------------------------------

  protected buildHull(): void {
    // --- VFX materials (used by engine glow animation + shield) ---
    this.hullGlowMat = new StandardMaterial('phantomGlow', this.scene);
    this.hullGlowMat.emissiveColor = Color3.FromHexString(GLOW_PRIMARY);
    this.hullGlowMat.disableLighting = true;
    this.hullGlowMat.alpha = 0.85;

    // --- Shield bubble (invisible until hit) ---
    this.shieldMat = new StandardMaterial('phantomShield', this.scene);
    this.shieldMat.emissiveColor = Color3.FromHexString(GLOW_SECONDARY);
    this.shieldMat.alpha = 0;
    this.shieldMat.disableLighting = true;
    this.shieldMat.backFaceCulling = false;

    this.shieldMesh = MeshBuilder.CreateSphere(
      'phantomShieldBubble',
      { diameter: 18, segments: 16 },
      this.scene
    );
    this.shieldMesh.material = this.shieldMat;
    this.shieldMesh.parent = this.rootNode;
    this.shieldMesh.position.y = 0;
    this.hullMeshes.push(this.shieldMesh);
  }

  // ------------------------------------------------------------------
  // GLB model loading -- replaces procedural hull geometry
  // ------------------------------------------------------------------

  /**
   * Load the Phantom hull from the GLB model and parent it under the
   * vehicle's root TransformNode. Call this after construction to make
   * the hull visible. The vehicle remains functional (shield, weapons,
   * flight) while the model is loading; it just won't be visible yet.
   *
   * @returns Promise that resolves when the model is loaded and parented.
   */
  public async loadModel(): Promise<void> {
    if (this.modelReady) return;

    try {
      log.info('Loading GLB model via AssetManager...');

      // Load the spaceship GLB through AssetManager (caches for instancing)
      await AssetManager.loadAssetByPath(PHANTOM_GLB_PATH, this.scene);

      // Create an instance parented under our root transform node
      const instance = AssetManager.createInstanceByPath(
        PHANTOM_GLB_PATH,
        `phantom_model_${this.vehicleId}`,
        this.scene,
        true,
        'vehicle'
      );

      if (instance) {
        this.glbRoot = instance;
        this.glbRoot.parent = this.rootNode;
        this.glbRoot.position = Vector3.Zero();

        // Collect child meshes for hull disposal tracking
        const childMeshes = instance.getChildMeshes();
        for (const mesh of childMeshes) {
          this.glbMeshes.push(mesh);
          if (mesh instanceof Mesh) {
            this.hullMeshes.push(mesh);
          }
        }

        // Cache animated part references for animations
        this.cacheAnimatedParts(childMeshes);

        this.modelReady = true;
        log.info(
          `GLB loaded via AssetManager: ${childMeshes.length} mesh instances`
        );
      } else {
        log.warn('AssetManager instance creation failed');
      }
    } catch (error) {
      log.error('Failed to load GLB model:', error);
    }
  }

  /**
   * Cache references to animated mesh parts from the loaded GLB.
   * These are used for landing ramp animation, engine glow effects,
   * and turret rotation.
   */
  private cacheAnimatedParts(childMeshes: AbstractMesh[]): void {
    for (const mesh of childMeshes) {
      const name = mesh.name.toLowerCase();

      // Match ramp mesh for landing animation
      if (name.includes('ramp') || name.includes('door') || name.includes('hatch')) {
        this.rampMesh = mesh;
        log.info(`Cached ramp mesh: ${mesh.name}`);
      }

      // Match engine meshes for thrust glow
      if (name.includes('engine')) {
        if (name.includes('left') || name.includes('_l') || name.endsWith('l')) {
          this.leftEngineMesh = mesh;
          log.info(`Cached left engine mesh: ${mesh.name}`);
        } else if (name.includes('right') || name.includes('_r') || name.endsWith('r')) {
          this.rightEngineMesh = mesh;
          log.info(`Cached right engine mesh: ${mesh.name}`);
        }
      }

      // Match turret mesh for weapon rotation
      if (name.includes('turret') || name.includes('gun') || name.includes('cannon')) {
        this.turretMesh = mesh;
        log.info(`Cached turret mesh: ${mesh.name}`);
      }
    }
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
    const spawnPos = this.rootNode.position.add(forward.scale(-6.5)).add(new Vector3(0, -2.2, 0));

    this.createPlasmaBolt(spawnPos, forward, weapon);
    getAudioManager().play('mech_fire', { volume: 0.4 });
  }

  public fireSecondaryWeapon(): void {
    const weapon = this.weapons[1]; // plasma bomb
    if (!this.canFireWeapon(weapon)) return;
    this.onWeaponFired(weapon);

    const forward = this.getForward();
    const spawnPos = this.rootNode.position.add(new Vector3(0, -2.5, 0));

    this.createPlasmaBomb(spawnPos, forward, weapon);
    getAudioManager().play('explosion', { volume: 0.35 });
  }

  private createPlasmaBolt(spawnPos: Vector3, direction: Vector3, weapon: VehicleWeapon): void {
    const bolt = MeshBuilder.CreateCylinder(
      'phantomBolt',
      {
        height: 1.8,
        diameterTop: 0.15,
        diameterBottom: 0.1,
        tessellation: 8,
      },
      this.scene
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
      this.scene
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

  private createPlasmaBomb(spawnPos: Vector3, direction: Vector3, weapon: VehicleWeapon): void {
    const bomb = MeshBuilder.CreateSphere(
      'phantomBomb',
      { diameter: 0.8, segments: 10 },
      this.scene
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
      this.scene
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
    // Get unified input state
    const input = this.getVehicleInput();

    // Throttle from input
    if (input.throttle > 0) {
      this.throttle = Math.min(1, this.throttle + deltaTime * 1.5);
    } else if (input.brake > 0) {
      this.throttle = Math.max(-0.3, this.throttle - deltaTime * 2);
    } else {
      // Throttle decay
      this.throttle *= 0.3 ** deltaTime;
      if (Math.abs(this.throttle) < 0.01) this.throttle = 0;
    }

    // Yaw from steering input
    if (input.steer < 0) {
      this.yaw = -this.stats.turnRate;
    } else if (input.steer > 0) {
      this.yaw = this.stats.turnRate;
    } else {
      this.yaw = 0;
    }

    // Strafe (Q = left, R = right since E is exit)
    if (this.isKeyDown('KeyQ')) {
      this.strafeInput = -1;
    } else if (this.isKeyDown('KeyR')) {
      this.strafeInput = 1;
    } else {
      this.strafeInput = 0;
    }

    // Vertical: Space up, Ctrl/Shift down
    if (input.handbrake) { // Space = handbrake input = vertical up
      this.verticalInput = 1;
    } else if (this.isKeyDown('ControlLeft') || input.boost) {
      this.verticalInput = -1;
    } else {
      this.verticalInput = 0;
    }

    // Toggle flight mode with F key
    if (this.isKeyDown('KeyF') && this.landingState === 'airborne') {
      this.flightMode = this.flightMode === 'hover' ? 'forward' : 'hover';
    }

    // Takeoff / Landing with G key
    if (this.isKeyDown('KeyG')) {
      if (this.landingState === 'grounded') {
        this.beginTakeoff();
      } else if (this.landingState === 'airborne') {
        this.beginLanding();
      }
    }

    // Fire weapons from unified input
    if (input.fire) {
      this.fireWeapon();
    }
    if (input.fireSecondary) {
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
    log.info('Takeoff initiated');
  }

  private beginLanding(): void {
    if (this.landingState !== 'airborne') return;
    this.landingState = 'landing';
    this.landingProgress = 0;
    this.targetAltitude = LANDING_HEIGHT;
    log.info('Landing initiated');
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
      log.warn('Could not create engine audio');
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
      this.altitude = Math.min(this.targetAltitude, this.altitude + TAKEOFF_SPEED * deltaTime);
      this.landingProgress = (this.altitude - LANDING_HEIGHT) / (HOVER_HEIGHT - LANDING_HEIGHT);

      if (this.altitude >= this.targetAltitude) {
        this.landingState = 'airborne';
        this.altitude = HOVER_HEIGHT;
        log.info('Airborne');
      }
    } else if (this.landingState === 'landing') {
      this.altitude = Math.max(
        this.targetAltitude,
        this.altitude - TAKEOFF_SPEED * 0.7 * deltaTime
      );
      this.landingProgress = 1 - (this.altitude - LANDING_HEIGHT) / (HOVER_HEIGHT - LANDING_HEIGHT);

      if (this.altitude <= LANDING_HEIGHT + 0.1) {
        this.landingState = 'grounded';
        this.altitude = LANDING_HEIGHT;
        this.throttle = 0;
        this.stopEngineSound();
        getAudioManager().play('drop_impact', { volume: 0.3 });
        log.info('Grounded');
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
    const accelForce =
      Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), this.stats.acceleration * deltaTime);

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
      this.linearVelocity.scaleInPlace(0.15 ** deltaTime); // heavy drag
    } else {
      // Forward mode: lighter drag
      this.linearVelocity.scaleInPlace(0.7 ** deltaTime);
    }

    // -- Apply velocity --
    root.position.addInPlace(this.linearVelocity.scale(deltaTime));
    root.position.y = this.altitude;

    // -- Visual tilt based on movement --
    const targetPitch = this.flightMode === 'forward' ? -this.throttle * PITCH_LIMIT : 0;
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
        0
      );
      root.rotationQuaternion = yawOnly.multiply(pitchQ).multiply(rollQ);
    }
  }

  private updateEngineGlow(deltaTime: number): void {
    const time = performance.now() * 0.003;
    const intensity =
      this.landingState === 'grounded'
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

  // Track last damage time for shield visual
  private lastShieldDamageTime = 0;

  private updateShieldVisual(_deltaTime: number): void {
    if (!this.shieldMat || !this.shieldMesh) return;

    const shieldRatio = this.stats.shield / this.stats.maxShield;
    // Shield becomes visible when recently hit or when regenerating
    const recentlyHit = performance.now() - this.lastShieldDamageTime < 500;
    const targetAlpha = recentlyHit ? 0.15 + (1 - shieldRatio) * 0.2 : 0;
    this.shieldMat.alpha += (targetAlpha - this.shieldMat.alpha) * 0.1;
  }

  public override takeDamage(amount: number, source?: Vector3): void {
    this.lastShieldDamageTime = performance.now();
    super.takeDamage(amount, source);
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

    // Dispose GLB-specific resources
    if (this.glbRoot) {
      this.glbRoot.dispose();
      this.glbRoot = null;
    }
    for (const mesh of this.glbMeshes) {
      if (!mesh.isDisposed()) {
        mesh.material?.dispose();
        mesh.dispose();
      }
    }
    this.glbMeshes = [];

    super.dispose();
  }
}
