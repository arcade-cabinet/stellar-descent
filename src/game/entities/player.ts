import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getAchievementManager } from '../achievements';
import { getMeleeSystem } from '../combat';
import { getCurrentWeaponDef } from '../context/useWeaponActions';
import { AssetManager } from '../core/AssetManager';
import { getAudioManager } from '../core/AudioManager';
import { getDifficultyModifiers, loadDifficultySetting } from '../core/DifficultySettings';
import { createEntity, type Entity } from '../core/ecs';
import { getLogger } from '../core/Logger';
import { particleManager } from '../effects/ParticleManager';
import { weaponEffects } from '../effects/WeaponEffects';
import { getInputManager, type InputManager } from '../input';
import { getJetpackSystem, getVerticalMovement } from '../movement';
import type { TouchInput } from '../types';
import { tokens } from '../utils/designTokens';
import { getScreenInfo, vibrate } from '../utils/responsive';
import { firstPersonWeapons } from '../weapons/FirstPersonWeapons';
import { STARTER_WEAPON } from './weapons';

const log = getLogger('Player');

// Path to the marine soldier GLB model
const PLAYER_MODEL_PATH = '/assets/models/npcs/marine/marine_soldier.glb';

// Sun direction for optimal visuals - sun should be top-right when facing forward
const _SUN_DIRECTION = new Vector3(0.4, 0.3, -0.5).normalize();
// Player should face so sun is top-right (roughly northeast facing southwest)
const OPTIMAL_SPAWN_ROTATION_Y = Math.PI * 0.75; // Face southwest, sun top-right

export class Player {
  public entity: Entity;
  public camera: UniversalCamera;
  public mesh: Mesh;
  public isDropComplete = false;

  /** Resolves when the GLB model has finished loading (or failed gracefully). */
  public readonly modelReady: Promise<void>;

  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private engine: Engine;

  // Third-person model root (loaded from GLB, follows collision capsule)
  private playerModelRoot: TransformNode | null = null;

  // First-person weapon view
  private weaponContainer: TransformNode;
  private weaponBobTime = 0;
  private weaponRecoilOffset = 0;

  private moveSpeed = 20;
  private sprintMultiplier = 2;
  private isSprinting = false;

  // Slide mechanic state
  private isSliding = false;
  private slideTimer = 0;
  private slideCooldown = 0;
  private readonly slideDuration = 0.8; // seconds
  private readonly slideCooldownDuration = 1.0; // seconds
  private readonly slideSpeedMultiplier = 1.5; // relative to sprint speed
  private slideDirection: Vector3 = Vector3.Zero();
  private readonly slideBaseHeight = 0.6; // lower camera height during slide (for cover)
  private readonly crouchHeight = 1.0; // crouch height
  private readonly standingHeight = 1.8; // normal camera height
  private slideDistance = 0; // track distance slid
  private readonly maxSlideDistance = 12; // auto-cancel after this distance

  // Sprint FOV effect
  private readonly baseFOV = Math.PI / 2; // 90 degrees
  private readonly sprintFOVIncrease = 0.15; // ~8.6 degrees
  private readonly slideFOVIncrease = 0.25; // ~14.3 degrees during slide
  private currentFOVOffset = 0;
  private readonly fovLerpSpeed = 8; // smooth transition speed

  // Crouch state
  private isCrouching = false;

  // Vertical movement state (jump, mantle, jetpack)
  private isJumping = false;
  private spacePressed = false;
  private spaceHoldTime = 0;
  private readonly jetpackActivationDelay = 0.15; // Hold space for 150ms to activate jetpack

  // Input manager for keybinding-aware input handling
  private inputManager: InputManager;
  private keysPressed: Set<string> = new Set();
  private lastFireTime = 0;
  private fireRate = 8;

  // Touch control support
  private isTouchDevice: boolean;
  private touchInput: TouchInput | null = null;

  // Camera rotation state
  private rotationX = 0;
  private rotationY = OPTIMAL_SPAWN_ROTATION_Y;

  // Smooth camera rotation - target values set by input, actual values interpolate
  private targetRotationX = 0;
  private targetRotationY = OPTIMAL_SPAWN_ROTATION_Y;
  private readonly rotationLerpSpeed = 15; // Higher = snappier, lower = smoother

  // Drop sequence state
  private isDropping = true;
  private dropStartY = 800; // Higher start for more dramatic drop
  private dropTargetY = 1.8;
  private dropProgress = 0;
  private dropDuration = 6000; // 6 seconds for more cinematic descent
  private dropStartTime = 0;
  private dropPhase: 'freefall' | 'deceleration' | 'landing' = 'freefall';

  // Visual effects during drop
  private dropBaseX = 0;
  private dropBaseZ = 0;
  private dropSpinVelocity = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine) {
    this.scene = scene;
    this.canvas = canvas;
    this.engine = engine;
    this.isTouchDevice = getScreenInfo().isTouchDevice;

    // Initialize input manager for keybinding-aware input handling
    this.inputManager = getInputManager();

    // Create invisible collision capsule (used for physics / entity position)
    this.mesh = this.createCollisionCapsule();
    this.camera = this.createCamera();

    // Create the weapon view container (initially empty -- populated by GLB)
    this.weaponContainer = this.createWeaponContainer();

    this.entity = this.createEntity();

    // Initialize vertical movement system
    this.initVerticalMovement();

    this.setupControls();
    this.startHaloDrop();

    // Kick off async GLB model loading.
    // The model loads in the background while the 6-second drop sequence plays.
    this.modelReady = this.initModelAsync();
  }

  /**
   * Initialize the vertical movement system with scene and callbacks
   */
  private initVerticalMovement(): void {
    const vertical = getVerticalMovement();
    vertical.init(this.scene);

    // Add player mesh to ignored meshes for ground detection
    vertical.addIgnoredMesh(this.mesh);

    // Set up callbacks
    vertical.setOnLand((velocity, surfaceType) => {
      log.debug(`Landed with velocity ${velocity.toFixed(1)} on ${surfaceType}`);
      // Trigger screen shake on hard landing
      if (velocity > 15 && this.isTouchDevice) {
        vibrate([30, 20, 30]);
      }
    });

    vertical.setOnJump(() => {
      log.debug('Jumped');
    });

    vertical.setOnFallDamage((damage) => {
      log.info(`Fall damage: ${damage}`);
      this.takeDamage(damage);
    });
  }

  // ---------------------------------------------------------------------------
  // Collision capsule (physics only -- invisible)
  // ---------------------------------------------------------------------------

  private createCollisionCapsule(): Mesh {
    const body = MeshBuilder.CreateCapsule(
      'playerCollider',
      { height: 2, radius: 0.5 }, // Increased from 0.4 for better collision detection
      this.scene
    );
    body.position.y = 1;
    body.isVisible = false; // Collision-only, never rendered
    body.isPickable = false;
    return body;
  }

  // ---------------------------------------------------------------------------
  // Async GLB model loading
  // ---------------------------------------------------------------------------

  /**
   * Load the marine_soldier GLB and wire up:
   *   - Third-person body model (for shadows / spectate)
   *   - First-person weapon view (via FirstPersonWeaponSystem with dedicated GLBs)
   */
  private async initModelAsync(): Promise<void> {
    // Load third-person body model
    const asset = await AssetManager.loadAssetByPath(PLAYER_MODEL_PATH, this.scene);
    if (!asset) {
      throw new Error(`[Player] Failed to load player GLB model from ${PLAYER_MODEL_PATH}`);
    }

    log.info(`GLB loaded: ${asset.meshes.length} meshes in ${asset.loadTime.toFixed(0)}ms`);

    // ----- Third-person body (follows collision capsule) -----
    this.playerModelRoot = this.createThirdPersonModel(asset.meshes);

    // ----- First-person weapon view (via dedicated FPS weapon GLBs) -----
    // Initialize the FirstPersonWeaponSystem with proper FPS weapon models.
    // The system loads dedicated fps_*.glb files from /models/props/weapons/
    await firstPersonWeapons.init(this.scene, this.camera, [STARTER_WEAPON, 'assault_rifle']);
    log.info('FirstPersonWeaponSystem initialized with FPS weapon GLBs');

    // Hide the old weaponContainer since FirstPersonWeaponSystem handles rendering
    this.weaponContainer.setEnabled(false);
  }

  /**
   * Create the third-person body by cloning meshes from the loaded GLB.
   * The model is invisible in first-person but casts shadows and is visible
   * in third-person spectating / reflections.
   */
  private createThirdPersonModel(
    sourceMeshes: import('@babylonjs/core/Meshes/abstractMesh').AbstractMesh[]
  ): TransformNode {
    const root = new TransformNode('playerModel', this.scene);

    // Clone every mesh with geometry into the third-person root
    for (const mesh of sourceMeshes) {
      if (mesh instanceof Mesh && mesh.getTotalVertices() > 0) {
        const clone = mesh.clone(`playerBody_${mesh.name}`, root);
        if (clone) {
          clone.isVisible = true;
          clone.isPickable = false;
          // The model will cast shadows but the first-person camera sits inside,
          // so the body is effectively invisible to the player.
        }
      }
    }

    // Scale and position to match the collision capsule
    root.scaling.setAll(0.01); // GLB models are often in cm; adjust to metres
    root.position.y = 0; // Feet at ground level; updated each frame

    // Parent to the collision capsule so it moves with the player
    root.parent = this.mesh;

    return root;
  }

  // ---------------------------------------------------------------------------
  // Weapon container (empty shell, populated by initModelAsync)
  // ---------------------------------------------------------------------------

  private createWeaponContainer(): TransformNode {
    // Create container that follows camera
    const container = new TransformNode('weaponContainer', this.scene);
    container.parent = this.camera;

    // Position weapon in lower right of view (typical FPS style)
    container.position = new Vector3(0.35, -0.25, 0.5);
    container.rotation = new Vector3(0, 0.05, 0);

    return container;
  }

  private createCamera(): UniversalCamera {
    // Start high up for drop sequence
    const camera = new UniversalCamera(
      'playerCamera',
      new Vector3(0, this.dropStartY, 0),
      this.scene
    );

    // Set initial rotation to face optimal direction (sun top-right)
    camera.rotation.y = this.rotationY;
    camera.rotation.x = 0.3; // Slight downward look during drop

    camera.minZ = 0.1;
    camera.maxZ = 2000;
    // 90 degrees FOV - standard for FPS games, provides good peripheral vision
    camera.fov = Math.PI / 2; // 1.5708 radians = 90 degrees

    // Disable built-in controls - we handle everything manually
    camera.inputs.clear();

    return camera;
  }

  private createEntity(): Entity {
    return createEntity({
      transform: {
        position: new Vector3(0, 1, 0),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      health: {
        current: 100,
        max: 100,
        regenRate: 2,
      },
      velocity: {
        linear: Vector3.Zero(),
        angular: Vector3.Zero(),
        maxSpeed: this.moveSpeed,
      },
      combat: {
        damage: 25,
        range: 100,
        fireRate: this.fireRate,
        lastFire: 0,
        projectileSpeed: 80,
      },
      tags: {
        player: true,
      },
      renderable: {
        mesh: this.mesh,
        visible: true,
      },
    });
  }

  private setupControls(): void {
    // Track previous action states for edge detection
    // (The InputManager handles this internally, but we need local tracking for
    // actions that trigger once on press rather than while held)
    const _wasJumpPressed = false;
    const _wasCrouchPressed = false;
    const _wasMeleePressed = false;

    // Keyboard controls - we still track raw keys for the keysPressed set
    // but use InputManager for action-based queries
    const keydownHandler = (e: KeyboardEvent) => {
      this.keysPressed.add(e.code);
    };
    window.addEventListener('keydown', keydownHandler);
    this._listeners.push(() => window.removeEventListener('keydown', keydownHandler));

    const keyupHandler = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.code);
    };
    window.addEventListener('keyup', keyupHandler);
    this._listeners.push(() => window.removeEventListener('keyup', keyupHandler));

    // Mouse look - only when pointer is locked
    // Updates TARGET rotation - actual rotation interpolates toward this for smooth feel
    // Also accumulates movement in InputManager for gamepad look integration
    const mousemoveHandler = (e: MouseEvent) => {
      if (document.pointerLockElement === this.canvas && !this.isDropping) {
        const sensitivity = 0.002;
        this.targetRotationY += e.movementX * sensitivity;
        this.targetRotationX -= e.movementY * sensitivity;

        // Clamp vertical rotation
        this.targetRotationX = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, this.targetRotationX)
        );

        // Accumulate in InputManager for unified tracking
        this.inputManager.accumulateMouseMovement(e.movementX, e.movementY);
      }
    };
    document.addEventListener('mousemove', mousemoveHandler);
    this._listeners.push(() => document.removeEventListener('mousemove', mousemoveHandler));

    // Request pointer lock on click (desktop only)
    if (!this.isTouchDevice) {
      const clickHandler = () => {
        if (!this.isDropping) {
          this.canvas.requestPointerLock();
        }
      };
      this.canvas.addEventListener('click', clickHandler);
      this._listeners.push(() => this.canvas.removeEventListener('click', clickHandler));
    }

    // Prevent context menu
    const contextMenuHandler = (e: Event) => e.preventDefault();
    this.canvas.addEventListener('contextmenu', contextMenuHandler);
    this._listeners.push(() => this.canvas.removeEventListener('contextmenu', contextMenuHandler));
  }

  private _listeners: (() => void)[] = [];

  dispose(): void {
    this._listeners.forEach((cleanup) => cleanup());
    this._listeners = [];
    this.keysPressed.clear();

    // Dispose third-person model
    if (this.playerModelRoot) {
      this.playerModelRoot.dispose(false, true);
      this.playerModelRoot = null;
    }

    this.mesh.dispose();
    this.weaponContainer.dispose(false, true);
  }

  private startHaloDrop(): void {
    this.isDropping = true;
    this.isDropComplete = false;
    this.dropStartTime = performance.now();
    this.dropProgress = 0;

    // Position camera high up, looking down at the planet
    this.camera.position.set(0, this.dropStartY, 0);
    this.camera.rotation.x = 0.4; // Look down during drop
    this.camera.rotation.y = this.rotationY;

    // Start drop audio
    const audio = getAudioManager();
    audio.startLoop('drop_wind', 0.6);
  }

  setTouchInput(input: TouchInput | null): void {
    this.touchInput = input;
  }

  fire(): void {
    if (this.isDropping) return;

    const now = performance.now();
    const fireInterval = 1000 / this.fireRate;

    if (now - this.lastFireTime < fireInterval) return;
    this.lastFireTime = now;

    // Track shot fired for achievement accuracy tracking
    getAchievementManager().onShotFired();

    // Trigger first-person weapon visual effects (muzzle flash, shell casing, recoil)
    firstPersonWeapons.fireWeapon();

    // Play per-weapon fire sound (polished, with variation)
    const weaponDef = getCurrentWeaponDef();
    getAudioManager().playWeaponFire(weaponDef.id, 0.5);

    if (this.isTouchDevice) {
      vibrate(15);
    }

    const forward = this.camera.getDirection(Vector3.Forward());
    const spawnPos = this.camera.position.add(forward.scale(1.5));

    // Create laser bolt - elongated cylinder for that plasma bolt look
    const laserBolt = MeshBuilder.CreateCylinder(
      'laserBolt',
      {
        height: 1.2,
        diameterTop: 0.08,
        diameterBottom: 0.08,
        tessellation: 8,
      },
      this.scene
    );

    // Rotate to face direction of travel
    laserBolt.position = spawnPos;
    const rotationAxis = Vector3.Cross(Vector3.Up(), forward).normalize();
    const angle = Math.acos(Vector3.Dot(Vector3.Up(), forward));
    laserBolt.rotationQuaternion = Quaternion.RotationAxis(rotationAxis, angle);

    // Glowing core material
    const coreMat = new StandardMaterial('laserCoreMat', this.scene);
    coreMat.emissiveColor = Color3.FromHexString('#FFDD44'); // Bright yellow-gold
    coreMat.disableLighting = true;
    laserBolt.material = coreMat;

    // Outer glow shell - slightly larger, more transparent
    const glowShell = MeshBuilder.CreateCylinder(
      'laserGlow',
      {
        height: 1.4,
        diameterTop: 0.2,
        diameterBottom: 0.15,
        tessellation: 8,
      },
      this.scene
    );
    glowShell.parent = laserBolt;
    glowShell.position = Vector3.Zero();

    const glowMat = new StandardMaterial('laserGlowMat', this.scene);
    glowMat.emissiveColor = Color3.FromHexString(tokens.colors.accent.amber);
    glowMat.disableLighting = true;
    glowMat.alpha = 0.4;
    glowShell.material = glowMat;

    // Enhanced muzzle flash using particle system
    // Emits core flash, sparks, and lingering smoke for realistic effect
    particleManager.emitEnhancedMuzzleFlash(spawnPos, forward, 1.0);

    // Also create a simple mesh flash for the bright core (supplements particles)
    const flash = MeshBuilder.CreateSphere('muzzleFlash', { diameter: 0.3 }, this.scene);
    flash.position = spawnPos;
    const flashMat = new StandardMaterial('flashMat', this.scene);
    flashMat.emissiveColor = Color3.FromHexString('#FFFFFF');
    flashMat.disableLighting = true;
    flashMat.alpha = 0.9;
    flash.material = flashMat;

    // Animate muzzle flash fade
    const flashStart = performance.now();
    const animateFlash = () => {
      const elapsed = performance.now() - flashStart;
      const progress = elapsed / 60; // Faster fade for snappier feel
      if (progress < 1) {
        flashMat.alpha = 0.9 * (1 - progress);
        flash.scaling.setAll(1 + progress * 0.3);
        requestAnimationFrame(animateFlash);
      } else {
        flash.material?.dispose();
        flash.dispose();
      }
    };
    requestAnimationFrame(animateFlash);

    const velocity = forward.scale(this.entity.combat!.projectileSpeed);

    // Animate the laser bolt's glow pulsing
    const boltStartTime = performance.now();
    const animateBolt = () => {
      if (laserBolt.isDisposed()) return;

      const elapsed = performance.now() - boltStartTime;
      // Pulsing glow intensity
      const pulse = 0.3 + Math.sin(elapsed * 0.02) * 0.15;
      glowMat.alpha = pulse;

      // Slight core color variation
      const intensity = 0.9 + Math.sin(elapsed * 0.03) * 0.1;
      coreMat.emissiveColor = new Color3(intensity, intensity * 0.85, intensity * 0.3);

      requestAnimationFrame(animateBolt);
    };
    requestAnimationFrame(animateBolt);

    // Add particle trail effect to the projectile
    const projectileId = `player_proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    weaponEffects.createProjectileTrail(laserBolt, 'player_plasma', projectileId);

    // Create projectile entity with current weapon's damage stats
    createEntity({
      transform: {
        position: laserBolt.position.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: Vector3.Zero(),
        maxSpeed: this.entity.combat!.projectileSpeed,
      },
      combat: {
        damage: weaponDef.damage,
        range: weaponDef.range,
        fireRate: weaponDef.fireRate,
        lastFire: performance.now(),
        projectileSpeed: weaponDef.projectileSpeed,
      },
      renderable: {
        mesh: laserBolt,
        visible: true,
      },
      tags: {
        projectile: true,
        player: true, // Mark as player projectile for collision detection
      },
      lifetime: {
        remaining: 2000,
        onExpire: () => {
          laserBolt.material?.dispose(); // coreMat
          glowShell.material?.dispose(); // glowMat
          laserBolt.dispose();
        },
      },
    });
  }

  private updateDropSequence(deltaTime: number): void {
    const now = performance.now();
    const elapsed = now - this.dropStartTime;
    this.dropProgress = Math.min(elapsed / this.dropDuration, 1);

    // Three-phase drop for maximum drama
    // Phase 1 (0-40%): Freefall - accelerating, spinning, looking down
    // Phase 2 (40-85%): Deceleration - retro thrusters, stabilizing
    // Phase 3 (85-100%): Landing - final approach, camera levels out

    let currentY: number;
    let cameraRotX: number;
    let shakeIntensity: number;

    if (this.dropProgress < 0.4) {
      // PHASE 1: FREEFALL
      this.dropPhase = 'freefall';
      const phaseProgress = this.dropProgress / 0.4;

      // Accelerating fall - quadratic easing
      const fallProgress = phaseProgress * phaseProgress;
      currentY = this.dropStartY - (this.dropStartY - 100) * fallProgress;

      // Camera looking down, slight spin effect
      cameraRotX = 0.6 + Math.sin(elapsed * 0.003) * 0.15;

      // Build up spin velocity
      this.dropSpinVelocity = phaseProgress * 0.8;
      this.rotationY += this.dropSpinVelocity * deltaTime;

      // Violent shaking increases as atmosphere thickens
      shakeIntensity = 0.02 + phaseProgress * 0.08;
    } else if (this.dropProgress < 0.85) {
      // PHASE 2: DECELERATION - Retro thrusters fire
      const prevPhase = this.dropPhase;
      this.dropPhase = 'deceleration';

      // Start thrust sound when entering deceleration phase
      if (prevPhase === 'freefall') {
        getAudioManager().startLoop('drop_thrust', 0.7);
      }

      const phaseProgress = (this.dropProgress - 0.4) / 0.45;

      // Dramatic deceleration curve
      const easeOutQuart = 1 - (1 - phaseProgress) ** 4;
      currentY = 100 - (100 - 20) * easeOutQuart;

      // Camera gradually levels out
      cameraRotX = 0.6 * (1 - phaseProgress * 0.8);

      // Spin dampens
      this.dropSpinVelocity *= 1 - deltaTime * 2;
      this.rotationY += this.dropSpinVelocity * deltaTime;

      // Shaking from retro thrusters, gradually decreasing
      shakeIntensity = 0.1 * (1 - phaseProgress * 0.7);
    } else {
      // PHASE 3: LANDING
      this.dropPhase = 'landing';
      const phaseProgress = (this.dropProgress - 0.85) / 0.15;

      // Smooth final descent
      const easeOutCubic = 1 - (1 - phaseProgress) ** 3;
      currentY = 20 - (20 - this.dropTargetY) * easeOutCubic;

      // Camera fully levels
      cameraRotX = 0.6 * 0.2 * (1 - phaseProgress);

      // Stop all rotation
      this.dropSpinVelocity = 0;

      // Minimal shake, settling
      shakeIntensity = 0.02 * (1 - phaseProgress);
    }

    // Apply camera position
    this.camera.position.y = currentY;
    this.camera.rotation.x = cameraRotX;
    this.camera.rotation.y = this.rotationY;

    // Apply shake with smooth noise
    if (shakeIntensity > 0.001) {
      const shakeTime = elapsed * 0.015;
      const shakeX = (Math.sin(shakeTime * 1.1) + Math.sin(shakeTime * 2.3) * 0.5) * shakeIntensity;
      const shakeZ = (Math.cos(shakeTime * 1.3) + Math.cos(shakeTime * 1.9) * 0.5) * shakeIntensity;
      this.camera.position.x = this.dropBaseX + shakeX;
      this.camera.position.z = this.dropBaseZ + shakeZ;
    } else {
      this.camera.position.x = this.dropBaseX;
      this.camera.position.z = this.dropBaseZ;
    }

    // Complete the drop
    if (this.dropProgress >= 1) {
      this.isDropping = false;
      this.isDropComplete = true;
      this.camera.position.set(this.dropBaseX, this.dropTargetY, this.dropBaseZ);
      this.camera.rotation.x = 0;
      this.rotationX = 0;

      // Stop all drop sounds
      const audio = getAudioManager();
      audio.stopAllLoops();
    }
  }

  update(deltaTime: number): void {
    // Handle drop sequence
    if (this.isDropping) {
      this.updateDropSequence(deltaTime);
      return;
    }

    // Update input manager state (polls gamepad, updates edge detection)
    this.inputManager.update();

    // Sync touch input with InputManager
    if (this.touchInput) {
      this.inputManager.setTouchInput({
        movement: this.touchInput.movement,
        look: this.touchInput.look,
        isFiring: this.touchInput.isFiring,
        isSprinting: this.touchInput.isSprinting,
        isJumping: this.touchInput.isJumping,
        isCrouching: this.touchInput.isCrouching,
        isJetpacking: this.touchInput.isJetpacking,
        isReloading: this.touchInput.isReloading,
        isInteracting: this.touchInput.isInteracting,
        isMelee: this.touchInput.isMelee,
        isGrenade: this.touchInput.isGrenade,
        isAimingGrenade: this.touchInput.isAimingGrenade,
        isSliding: this.touchInput.isSliding,
      });
    } else {
      this.inputManager.setTouchInput(null);
    }

    // Determine input source
    const usingTouch = this.touchInput !== null && this.isTouchDevice;

    // Process look input (touch and gamepad via InputManager)
    const lookInput = this.inputManager.getLookInput();
    if (usingTouch && this.touchInput) {
      const look = this.touchInput.look;
      if (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001) {
        // Touch controls provide raw delta - add to target rotation
        this.targetRotationY += look.x;
        this.targetRotationX -= look.y;
        this.targetRotationX = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, this.targetRotationX)
        );
      }
    }
    // Gamepad right stick look (from InputManager)
    if (Math.abs(lookInput.x) > 0.01 || Math.abs(lookInput.y) > 0.01) {
      const gamepadLookSensitivity = 0.03; // Adjust for gamepad feel
      this.targetRotationY += lookInput.x * gamepadLookSensitivity;
      this.targetRotationX -= lookInput.y * gamepadLookSensitivity;
      this.targetRotationX = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, this.targetRotationX)
      );
    }

    // Smooth camera rotation interpolation (lerp toward target)
    // This creates fluid, non-snappy camera movement for both mouse and touch
    const lerpFactor = Math.min(1, this.rotationLerpSpeed * deltaTime);
    this.rotationX += (this.targetRotationX - this.rotationX) * lerpFactor;
    this.rotationY += (this.targetRotationY - this.rotationY) * lerpFactor;

    // Apply smoothed camera rotation
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;

    // Sprint state (uses keybindings via InputManager)
    const _wasSprinting = this.isSprinting;
    this.isSprinting = this.inputManager.isActionPressed('sprint');

    // Crouch state (uses keybindings via InputManager)
    const wasCrouching = this.isCrouching;
    const isCrouchPressed = this.inputManager.isActionPressed('crouch');
    if (isCrouchPressed && !wasCrouching) {
      this.isCrouching = true;
      this.tryInitiateSlide();

      // Haptic feedback on crouch start (touch devices)
      if (this.isTouchDevice) {
        vibrate(10);
      }
    } else if (!isCrouchPressed && wasCrouching) {
      // Crouch released - if sliding, cancel to crouch first then stand
      if (this.isSliding) {
        this.cancelSlide(true); // Cancel to crouch
      }
      this.isCrouching = false;

      // Haptic feedback on stand (touch devices)
      if (this.isTouchDevice) {
        vibrate(8);
      }
    }

    // Jump action (uses keybindings via InputManager)
    const isJumpPressed = this.inputManager.isActionPressed('jump');
    if (isJumpPressed && !this.spacePressed) {
      this.spacePressed = true;
      this.spaceHoldTime = 0;

      // If sliding, cancel slide with jump (slide-jump combo)
      if (this.isSliding) {
        this.cancelSlideWithJump();
      } else {
        // Request jump immediately
        const vertical = getVerticalMovement();
        vertical.requestJump();
      }
    } else if (!isJumpPressed && this.spacePressed) {
      this.spacePressed = false;
      this.spaceHoldTime = 0;
      const vertical = getVerticalMovement();
      vertical.stopJetpack();
    }

    // Melee attack (check for weaponMelee dynamic action)
    if (this.inputManager.isActionJustPressed('weaponMelee')) {
      this.tryMeleeAttack();
    }

    // Grenade throw (check for weaponGrenade dynamic action)
    if (this.inputManager.isActionJustPressed('weaponGrenade')) {
      this.tryThrowGrenade();
    }

    // Slide action (check for slide dynamic action, often from touch double-tap crouch)
    if (this.inputManager.isActionJustPressed('slide')) {
      this.tryInitiateSlide();
    }

    // Update slide state
    this.updateSlide(deltaTime);

    // Update FOV for sprint/slide effects
    this.updateFOV(deltaTime);

    // Update vertical movement (jump, mantle, jetpack)
    this.updateVerticalMovement(deltaTime, usingTouch);

    // Calculate speed based on state
    let speed: number;
    const vertical = getVerticalMovement();
    const airControl = vertical.getAirControlMultiplier();

    if (this.isSliding) {
      // Sliding at boosted speed
      speed = this.moveSpeed * this.sprintMultiplier * this.slideSpeedMultiplier;
    } else if (this.isSprinting) {
      speed = this.moveSpeed * this.sprintMultiplier;
    } else if (this.isCrouching) {
      speed = this.moveSpeed * 0.5; // Crouch walk is slower
    } else {
      speed = this.moveSpeed;
    }

    // Apply air control reduction
    speed *= airControl;

    // Calculate movement (relative to camera facing direction)
    const moveDir = Vector3.Zero();

    // If sliding, use locked slide direction
    if (this.isSliding) {
      moveDir.addInPlace(this.slideDirection);
    } else {
      // Get movement input from InputManager (combines keyboard, gamepad, touch)
      const movementInput = this.inputManager.getMovementInput();

      // Apply movement relative to camera direction
      if (Math.abs(movementInput.x) > 0.01 || Math.abs(movementInput.y) > 0.01) {
        // Forward/backward
        if (movementInput.y !== 0) {
          moveDir.addInPlace(this.camera.getDirection(Vector3.Forward()).scale(movementInput.y));
        }
        // Left/right strafe
        if (movementInput.x !== 0) {
          moveDir.addInPlace(this.camera.getDirection(Vector3.Right()).scale(movementInput.x));
        }
      }
    }

    // Set movement input for jetpack directional boost
    vertical.setMovementInput(moveDir);

    // Apply horizontal movement
    if (moveDir.length() > 0) {
      moveDir.normalize();
      moveDir.y = 0;
      moveDir.scaleInPlace(speed * deltaTime);
      this.camera.position.addInPlace(moveDir);
    }

    // Get base camera height from vertical movement
    const _verticalState = vertical.getState();
    const baseHeight = this.getTargetCameraHeight();

    // Smoothly interpolate camera height based on crouch/slide state
    // Faster lerp on touch devices for more responsive feel (0.15s vs 0.3s)
    const lerpSpeed = this.isTouchDevice ? 20 : 12; // Higher = faster transition
    const heightLerpFactor = Math.min(1, lerpSpeed * deltaTime);
    this.camera.position.y += (baseHeight - this.camera.position.y) * heightLerpFactor;

    // Update entity transform
    if (this.entity.transform) {
      this.entity.transform.position = this.camera.position.clone();
      this.entity.transform.position.y = 1;
    }

    // Update mesh position
    this.mesh.position = this.camera.position.clone();
    this.mesh.position.y = 1;

    // Fire logic (uses keybindings via InputManager)
    const shouldFire = this.inputManager.isActionPressed('fire');

    if (shouldFire) {
      this.fire();
    }

    // Health regen (scaled by difficulty)
    if (this.entity.health) {
      if (this.entity.health.current < this.entity.health.max && !this.isDead) {
        const difficulty = loadDifficultySetting();
        const modifiers = getDifficultyModifiers(difficulty);
        const scaledRegenRate =
          this.entity.health.regenRate * modifiers.playerHealthRegenMultiplier;
        this.entity.health.current = Math.min(
          this.entity.health.max,
          this.entity.health.current + scaledRegenRate * deltaTime
        );
      }
    }

    // Update weapon animation
    this.updateWeaponAnimation(deltaTime, moveDir.length() > 0);
  }

  private updateWeaponAnimation(deltaTime: number, isMoving: boolean): void {
    const vertical = getVerticalMovement();
    const verticalState = this.lastVerticalState ?? vertical.getState();

    // Weapon bob while moving - reduced during slide and in air
    if (this.isSliding) {
      // Minimal bob during slide - weapon stays steady
      this.weaponBobTime += deltaTime * 4;
    } else if (!verticalState.isGrounded) {
      // Reduced bob while airborne
      this.weaponBobTime += deltaTime * 3;
    } else if (isMoving) {
      this.weaponBobTime += deltaTime * (this.isSprinting ? 14 : 10);
    } else {
      // Subtle idle sway
      this.weaponBobTime += deltaTime * 2;
    }

    // Calculate bob offsets - reduced during slide and air
    let bobAmplitudeX: number;
    let bobAmplitudeY: number;

    if (this.isSliding) {
      // Very minimal bob during slide
      bobAmplitudeX = 0.005;
      bobAmplitudeY = 0.003;
    } else if (!verticalState.isGrounded) {
      // Reduced bob while airborne
      bobAmplitudeX = 0.004;
      bobAmplitudeY = 0.003;
    } else if (isMoving) {
      bobAmplitudeX = this.isSprinting ? 0.025 : 0.015;
      bobAmplitudeY = this.isSprinting ? 0.03 : 0.018;
    } else {
      bobAmplitudeX = 0.003;
      bobAmplitudeY = 0.004;
    }

    const bobX = Math.sin(this.weaponBobTime) * bobAmplitudeX;
    const bobY = Math.abs(Math.sin(this.weaponBobTime * 2)) * bobAmplitudeY;

    // Smooth recoil recovery - use proper exponential decay
    // 0.05^deltaTime gives ~2-3 frames to recover at 60fps
    const recoilDecay = 0.05 ** deltaTime;
    this.weaponRecoilOffset *= recoilDecay;
    if (this.weaponRecoilOffset < 0.01) this.weaponRecoilOffset = 0;

    // Apply to weapon container (relative to base position)
    // During slide, lower the weapon slightly for a more dynamic feel
    const baseX = 0.35;
    let baseY = this.isSliding ? -0.32 : -0.25;
    const baseZ = this.isSliding ? 0.45 : 0.5;

    // Apply landing impact to weapon (weapon dips down on hard landing)
    const landingBob = vertical.getLandingBobOffset();
    if (landingBob !== 0) {
      baseY += landingBob * 0.5; // Weapon dips down
    }

    // Raise weapon slightly while jumping/mantling
    if (verticalState.isMantling) {
      baseY += 0.05; // Raise weapon during mantle
    } else if (verticalState.isJumping && verticalState.velocityY > 0) {
      baseY += 0.02; // Slight raise during jump apex
    }

    this.weaponContainer.position.x = baseX + bobX;
    this.weaponContainer.position.y = baseY + bobY - this.weaponRecoilOffset * 0.05;
    this.weaponContainer.position.z = baseZ - this.weaponRecoilOffset * 0.08;

    // Slight rotation during recoil, additional tilt during slide
    const slideRotation = this.isSliding ? 0.1 : 0;
    let mantleRotation = 0;
    if (verticalState.isMantling) {
      // Tilt weapon forward during mantle
      mantleRotation = 0.15;
    }
    this.weaponContainer.rotation.x =
      -this.weaponRecoilOffset * 0.3 + slideRotation + mantleRotation + landingBob * 0.3;
  }

  /**
   * Attempt to initiate a slide - only works if sprinting and not on cooldown
   */
  private tryInitiateSlide(): void {
    // Can only slide if: sprinting, not already sliding, and off cooldown
    if (!this.isSprinting || this.isSliding || this.slideCooldown > 0) {
      return;
    }

    // Check if player is moving using InputManager (respects keybindings)
    const movementInput = this.inputManager.getMovementInput();
    const forward = this.camera.getDirection(Vector3.Forward());
    const right = this.camera.getDirection(Vector3.Right());
    const moveDir = Vector3.Zero();

    // Apply movement relative to camera direction
    if (Math.abs(movementInput.x) > 0.1 || Math.abs(movementInput.y) > 0.1) {
      if (movementInput.y !== 0) {
        moveDir.addInPlace(forward.scale(movementInput.y));
      }
      if (movementInput.x !== 0) {
        moveDir.addInPlace(right.scale(movementInput.x));
      }
    }

    // Need movement to slide
    if (moveDir.length() < 0.1) {
      return;
    }

    // Initiate slide
    this.isSliding = true;
    this.slideTimer = this.slideDuration;
    this.slideDistance = 0; // Reset distance tracking
    this.slideDirection = moveDir.normalize();
    this.slideDirection.y = 0; // Keep slide horizontal

    // Play slide sound
    getAudioManager().play('slide', { volume: 0.5 });

    // Haptic feedback on touch devices
    if (this.isTouchDevice) {
      vibrate([20, 10, 20]);
    }

    log.info('Slide initiated');
  }

  /**
   * Update slide state each frame
   */
  private updateSlide(deltaTime: number): void {
    // Update slide cooldown
    if (this.slideCooldown > 0) {
      this.slideCooldown = Math.max(0, this.slideCooldown - deltaTime);
    }

    // Update active slide
    if (this.isSliding) {
      this.slideTimer -= deltaTime;

      // Track distance traveled during slide
      const slideSpeed = this.moveSpeed * this.sprintMultiplier * this.slideSpeedMultiplier;
      this.slideDistance += slideSpeed * deltaTime;

      // Check for slide cancel conditions
      const shouldCancel =
        this.slideTimer <= 0 || // Time expired
        this.slideDistance >= this.maxSlideDistance; // Max distance reached

      if (shouldCancel) {
        this.cancelSlide(false);
      }
    }
  }

  /**
   * Cancel the current slide
   * @param toCrouch - If true, transition to crouch instead of stand
   */
  private cancelSlide(toCrouch: boolean = false): void {
    if (!this.isSliding) return;

    this.isSliding = false;
    this.slideCooldown = this.slideCooldownDuration;
    this.slideDistance = 0;

    // If canceling to crouch, keep crouched
    if (toCrouch) {
      this.isCrouching = true;
    }

    // Play slide end sound
    getAudioManager().play('slide_end', { volume: 0.4 });

    log.info(`Slide ended (to ${toCrouch ? 'crouch' : 'stand'})`);
  }

  /**
   * Cancel slide with a jump (for slide-jump combo)
   */
  cancelSlideWithJump(): void {
    if (!this.isSliding) return;

    this.isSliding = false;
    this.slideCooldown = this.slideCooldownDuration * 0.5; // Reduced cooldown for jump cancel
    this.slideDistance = 0;

    // Request jump immediately
    const vertical = getVerticalMovement();
    vertical.requestJump();

    log.info('Slide canceled with jump');
  }

  /**
   * Update vertical movement (jump, mantle, jetpack)
   */
  private updateVerticalMovement(deltaTime: number, usingTouch: boolean): void {
    const vertical = getVerticalMovement();
    const forward = this.camera.getDirection(Vector3.Forward());

    // Handle space key hold for jetpack activation
    if (this.spacePressed) {
      this.spaceHoldTime += deltaTime;

      // If holding space and not grounded, try to activate jetpack
      if (this.spaceHoldTime >= this.jetpackActivationDelay) {
        const state = vertical.getState();
        if (!state.isGrounded && !state.isMantling) {
          vertical.tryJetpack();
        }
      }
    }

    // Handle touch jetpack input
    if (usingTouch && this.touchInput?.isJetpacking) {
      const state = vertical.getState();
      if (!state.isGrounded && !state.isMantling) {
        vertical.tryJetpack();
      }
    } else if (usingTouch && !this.touchInput?.isJumping) {
      vertical.stopJetpack();
    }

    // Handle touch jump input
    if (usingTouch && this.touchInput?.isJumping && !this.isJumping) {
      vertical.requestJump();
      this.isJumping = true;
    } else if (usingTouch && !this.touchInput?.isJumping) {
      this.isJumping = false;
    }

    // Update vertical movement physics
    const verticalDelta = vertical.update(deltaTime, this.camera.position, forward);

    // Apply vertical position change
    if (verticalDelta !== 0) {
      this.camera.position.y += verticalDelta;
    }

    // Get camera animation from vertical movement (mantle + jetpack)
    const cameraAnim = vertical.getCameraAnimation();

    // Apply camera effects (subtle pitch/roll during mantle, shake during jetpack)
    if (cameraAnim.pitchOffset !== 0 || cameraAnim.rollOffset !== 0) {
      // These are additive offsets during mantle animation
      // We don't modify rotationX/Y directly to avoid interfering with mouse look
      this.camera.rotation.x = this.rotationX + cameraAnim.pitchOffset;
      this.camera.rotation.z = cameraAnim.rollOffset;
    } else {
      this.camera.rotation.z = 0;
    }

    // Apply jetpack camera shake
    if (cameraAnim.shakeX !== 0 || cameraAnim.shakeY !== 0) {
      this.camera.position.x += cameraAnim.shakeX;
      this.camera.position.z += cameraAnim.shakeY;
    }

    // Apply landing bob effect to camera
    const landingBob = vertical.getLandingBobOffset();
    if (landingBob !== 0) {
      this.camera.position.y += landingBob;
      // Also add a subtle pitch dip during landing
      this.camera.rotation.x = this.rotationX + landingBob * 0.5;
    }

    // Auto-mantle detection when approaching ledges
    const state = vertical.getState();
    if (!state.isGrounded && !state.isMantling && !state.isJetpacking && state.velocityY < 0) {
      // Player is falling - check for mantle opportunity
      vertical.tryMantle(this.camera.position, forward);
    }

    // Store vertical state for weapon animation
    this.lastVerticalState = state;
  }

  // Track vertical state for weapon animation
  private lastVerticalState: import('../movement').VerticalState | null = null;

  /**
   * Get current target camera height based on slide/crouch state
   * - Standing: 1.8m
   * - Crouching: 1.0m
   * - Sliding: 0.6m (lower for cover)
   */
  private getTargetCameraHeight(): number {
    if (this.isSliding) {
      return this.slideBaseHeight; // 0.6m
    }
    if (this.isCrouching && !this.isSprinting) {
      return this.crouchHeight; // 1.0m
    }
    return this.standingHeight; // 1.8m
  }

  /**
   * Update FOV based on sprint/slide state with smooth transitions
   */
  private updateFOV(deltaTime: number): void {
    // Determine target FOV offset
    let targetOffset = 0;

    if (this.isSliding) {
      targetOffset = this.slideFOVIncrease;
    } else if (this.isSprinting) {
      targetOffset = this.sprintFOVIncrease;
    }

    // Smoothly interpolate FOV
    const lerpFactor = Math.min(1, this.fovLerpSpeed * deltaTime);
    this.currentFOVOffset += (targetOffset - this.currentFOVOffset) * lerpFactor;

    // Apply FOV
    this.camera.fov = this.baseFOV + this.currentFOVOffset;
  }

  /**
   * Attempt to perform a melee attack
   */
  private tryMeleeAttack(): void {
    if (this.isDropping || this.isDead) return;

    const melee = getMeleeSystem();
    if (!melee.canAttack()) return;

    // Execute the attack
    melee.attack();
  }

  /**
   * Attempt to throw a grenade
   */
  private tryThrowGrenade(): void {
    if (this.isDropping || this.isDead) return;

    // Import grenadeSystem dynamically to avoid circular deps
    import('../combat').then(({ grenadeSystem }) => {
      if (grenadeSystem.getTotalGrenadeCount() <= 0) {
        // No grenades - play empty click sound
        getAudioManager().play('weapon_empty_click', { volume: 0.4 });
        return;
      }

      // Throw the grenade - the system handles position, direction from camera
      grenadeSystem.throwGrenade(
        this.camera.position.clone(),
        this.camera.getDirection(Vector3.Forward())
      );
    });
  }

  getPosition(): Vector3 {
    return this.camera.position.clone();
  }

  /**
   * Check if player is currently sliding
   */
  isPlayerSliding(): boolean {
    return this.isSliding;
  }

  /**
   * Check if player is currently sprinting
   */
  isPlayerSprinting(): boolean {
    return this.isSprinting;
  }

  /**
   * Check if player is crouching (not sliding)
   */
  isPlayerCrouching(): boolean {
    return this.isCrouching && !this.isSliding;
  }

  /**
   * Get slide cooldown remaining (0 = ready to slide)
   */
  getSlideCooldownRemaining(): number {
    return this.slideCooldown;
  }

  /**
   * Get current FOV (useful for UI or other systems)
   */
  getCurrentFOV(): number {
    return this.camera.fov;
  }

  /**
   * Get player heading in radians (0 = North/+Z, positive = clockwise)
   * This is used for the compass HUD element
   */
  getHeading(): number {
    // Camera rotation Y is the horizontal rotation
    // In Babylon.js, rotation Y=0 faces +Z (forward)
    // We need to convert so that 0 = North (+Z in world space)
    return this.rotationY;
  }

  /**
   * Check if player is currently mantling (ledge climbing)
   */
  isPlayerMantling(): boolean {
    return getVerticalMovement().getState().isMantling;
  }

  /**
   * Check if player is currently using jetpack
   */
  isPlayerJetpacking(): boolean {
    return getVerticalMovement().getState().isJetpacking;
  }

  /**
   * Check if player is airborne (not grounded)
   */
  isPlayerAirborne(): boolean {
    return !getVerticalMovement().getState().isGrounded;
  }

  /**
   * Get jetpack fuel level (0-1)
   */
  getJetpackFuel(): number {
    return getVerticalMovement().getState().jetpackFuel;
  }

  /**
   * Get vertical movement state for HUD
   */
  getVerticalState() {
    return getVerticalMovement().getState();
  }

  // Invincibility frames tracking
  private lastDamageTime = 0;
  private readonly invincibilityDuration = 200; // 200ms invincibility after hit
  private isDead = false;

  takeDamage(amount: number): void {
    if (!this.entity.health) return;
    if (this.isDead) return;

    // Check invincibility frames
    const now = performance.now();
    if (now - this.lastDamageTime < this.invincibilityDuration) {
      return; // Still invincible
    }
    this.lastDamageTime = now;

    this.entity.health.current = Math.max(0, this.entity.health.current - amount);

    // Check for death
    if (this.entity.health.current <= 0 && !this.isDead) {
      this.isDead = true;
      this.onDeath();
      return;
    }

    // Play damage sound
    getAudioManager().play('player_damage', { volume: 0.6 });

    if (this.isTouchDevice) {
      vibrate([50, 30, 50]);
    }

    // Simple screen shake without anime.js
    const originalX = this.camera.position.x;
    const originalZ = this.camera.position.z;
    const startTime = performance.now();
    const duration = 150;

    const shake = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        const intensity = 0.1 * (1 - progress);
        this.camera.position.x = originalX + (Math.random() - 0.5) * intensity;
        this.camera.position.z = originalZ + (Math.random() - 0.5) * intensity;
        requestAnimationFrame(shake);
      } else {
        this.camera.position.x = originalX;
        this.camera.position.z = originalZ;
      }
    };

    requestAnimationFrame(shake);
  }

  /**
   * Handle player death - called when health reaches 0
   */
  private onDeath(): void {
    log.info('Death triggered');

    // Cancel any in-progress vertical movement
    getVerticalMovement().cancelMovement();

    // Play death sound
    getAudioManager().play('player_damage', { volume: 0.8 });

    // Vibrate on death for touch devices
    if (this.isTouchDevice) {
      vibrate([100, 50, 100, 50, 200]);
    }

    // Camera fall effect
    const startY = this.camera.position.y;
    const startTime = performance.now();
    const fallDuration = 800;

    const animateFall = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / fallDuration, 1);

      // Ease out fall
      const easeOut = 1 - (1 - progress) ** 3;
      this.camera.position.y = startY - easeOut * 1.3;

      // Tilt camera
      this.camera.rotation.z = easeOut * 0.3;

      if (progress < 1) {
        requestAnimationFrame(animateFall);
      }
    };

    requestAnimationFrame(animateFall);
  }

  /**
   * Check if the player is dead
   */
  isPlayerDead(): boolean {
    return this.isDead;
  }

  /**
   * Respawn the player (reset death state and health)
   */
  respawn(position?: Vector3): void {
    this.isDead = false;
    if (this.entity.health) {
      this.entity.health.current = this.entity.health.max;
    }
    this.camera.rotation.z = 0;

    // Reset vertical movement state
    const vertical = getVerticalMovement();
    vertical.reset();

    // Refuel jetpack
    getJetpackSystem().refuel();

    if (position) {
      this.camera.position = position.clone();
      this.mesh.position = position.clone();
      this.mesh.position.y = 1;
    }
    log.info('Respawned');
  }

  /**
   * Refresh keybindings from localStorage.
   * Call this when returning from settings menu where bindings may have changed.
   */
  refreshKeybindings(): void {
    this.inputManager.refreshKeybindings();
    log.info('Keybindings refreshed');
  }

  /**
   * Get the input manager instance.
   * Useful for advanced input queries from external systems.
   */
  getInputManager(): InputManager {
    return this.inputManager;
  }
}
