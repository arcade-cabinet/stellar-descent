import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import type { Engine } from '@babylonjs/core/Engines/engine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getAudioManager } from '../core/AudioManager';
import { createEntity, type Entity } from '../core/ecs';
import type { TouchInput } from '../types';
import { tokens } from '../utils/designTokens';
import { getScreenInfo, vibrate } from '../utils/responsive';

// Sun direction for optimal visuals - sun should be top-right when facing forward
const SUN_DIRECTION = new Vector3(0.4, 0.3, -0.5).normalize();
// Player should face so sun is top-right (roughly northeast facing southwest)
const OPTIMAL_SPAWN_ROTATION_Y = Math.PI * 0.75; // Face southwest, sun top-right

export class Player {
  public entity: Entity;
  public camera: UniversalCamera;
  public mesh: Mesh;
  public isDropComplete = false;

  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private engine: Engine;

  // First-person weapon view
  private weaponContainer: TransformNode;
  private weaponMesh: Mesh;
  private handsMesh: Mesh;
  private muzzleFlashMesh: Mesh | null = null;
  private weaponBobTime = 0;
  private weaponRecoilOffset = 0;

  private moveSpeed = 20;
  private sprintMultiplier = 2;
  private isSprinting = false;

  private keysPressed: Set<string> = new Set();
  private mouseDown = false;
  private lastFireTime = 0;
  private fireRate = 8;

  // Touch control support
  private isTouchDevice: boolean;
  private touchInput: TouchInput | null = null;

  // Camera rotation state
  private rotationX = 0;
  private rotationY = OPTIMAL_SPAWN_ROTATION_Y;

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

    this.mesh = this.createPlayerMesh();
    this.camera = this.createCamera();

    // Create first-person weapon view
    const { container, weapon, hands } = this.createWeaponView();
    this.weaponContainer = container;
    this.weaponMesh = weapon;
    this.handsMesh = hands;

    this.entity = this.createEntity();

    this.setupControls();
    this.startHaloDrop();
  }

  private createPlayerMesh(): Mesh {
    const body = MeshBuilder.CreateCapsule('playerBody', { height: 2, radius: 0.4 }, this.scene);

    const material = new StandardMaterial('playerMat', this.scene);
    material.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);

    const armorTex = new Texture('https://assets.babylonjs.com/textures/floor.png', this.scene);
    armorTex.uScale = 2;
    armorTex.vScale = 2;
    material.diffuseTexture = armorTex;
    material.specularColor = new Color3(0.3, 0.3, 0.3);

    body.material = material;
    body.position.y = 1;
    body.isVisible = false;

    return body;
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
    camera.fov = 1.2;

    // Disable built-in controls - we handle everything manually
    camera.inputs.clear();

    return camera;
  }

  private createWeaponView(): { container: TransformNode; weapon: Mesh; hands: Mesh } {
    // Create container that follows camera
    const container = new TransformNode('weaponContainer', this.scene);
    container.parent = this.camera;

    // Position weapon in lower right of view (typical FPS style)
    container.position = new Vector3(0.35, -0.25, 0.5);
    container.rotation = new Vector3(0, 0.05, 0);

    // === HANDS ===
    // Create armored gloves/hands
    const handsMat = new StandardMaterial('handsMat', this.scene);
    handsMat.diffuseColor = Color3.FromHexString('#2A2A2A'); // Dark armor
    handsMat.specularColor = new Color3(0.15, 0.15, 0.15);

    // Left hand (grip on weapon)
    const leftHand = MeshBuilder.CreateBox(
      'leftHand',
      {
        width: 0.06,
        height: 0.08,
        depth: 0.12,
      },
      this.scene
    );
    leftHand.position = new Vector3(-0.04, 0.02, 0.08);
    leftHand.rotation = new Vector3(0.3, 0, -0.1);
    leftHand.material = handsMat;
    leftHand.parent = container;

    // Right hand (trigger hand)
    const rightHand = MeshBuilder.CreateBox(
      'rightHand',
      {
        width: 0.07,
        height: 0.09,
        depth: 0.14,
      },
      this.scene
    );
    rightHand.position = new Vector3(0.04, -0.02, -0.06);
    rightHand.rotation = new Vector3(-0.2, 0, 0.15);
    rightHand.material = handsMat;
    rightHand.parent = container;

    // Merge hands for easier manipulation
    const hands = MeshBuilder.CreateBox('handsContainer', { size: 0.001 }, this.scene);
    hands.isVisible = false;
    hands.parent = container;
    leftHand.parent = hands;
    rightHand.parent = hands;

    // === WEAPON - Futuristic Assault Rifle ===
    const gunMat = new StandardMaterial('gunMat', this.scene);
    gunMat.diffuseColor = Color3.FromHexString('#1A1A1A');
    gunMat.specularColor = new Color3(0.3, 0.3, 0.35);

    const gunAccentMat = new StandardMaterial('gunAccentMat', this.scene);
    gunAccentMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);
    gunAccentMat.specularColor = new Color3(0.2, 0.2, 0.2);

    const gunGlowMat = new StandardMaterial('gunGlowMat', this.scene);
    gunGlowMat.emissiveColor = Color3.FromHexString('#4A7B3C');
    gunGlowMat.diffuseColor = Color3.FromHexString('#4A7B3C');

    // Main body/receiver
    const receiver = MeshBuilder.CreateBox(
      'gunReceiver',
      {
        width: 0.06,
        height: 0.08,
        depth: 0.25,
      },
      this.scene
    );
    receiver.position = new Vector3(0, 0, 0);
    receiver.material = gunMat;
    receiver.parent = container;

    // Barrel
    const barrel = MeshBuilder.CreateCylinder(
      'gunBarrel',
      {
        height: 0.22,
        diameter: 0.025,
        tessellation: 12,
      },
      this.scene
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new Vector3(0, 0.01, 0.22);
    barrel.material = gunMat;
    barrel.parent = container;

    // Barrel shroud (cooling vents)
    const shroud = MeshBuilder.CreateBox(
      'barrelShroud',
      {
        width: 0.045,
        height: 0.045,
        depth: 0.15,
      },
      this.scene
    );
    shroud.position = new Vector3(0, 0.01, 0.16);
    shroud.material = gunAccentMat;
    shroud.parent = container;

    // Magazine
    const magazine = MeshBuilder.CreateBox(
      'magazine',
      {
        width: 0.035,
        height: 0.12,
        depth: 0.06,
      },
      this.scene
    );
    magazine.position = new Vector3(0, -0.08, 0.02);
    magazine.rotation.x = -0.15;
    magazine.material = gunAccentMat;
    magazine.parent = container;

    // Stock
    const stock = MeshBuilder.CreateBox(
      'stock',
      {
        width: 0.04,
        height: 0.06,
        depth: 0.12,
      },
      this.scene
    );
    stock.position = new Vector3(0, -0.01, -0.14);
    stock.rotation.x = 0.1;
    stock.material = gunMat;
    stock.parent = container;

    // Sight/optic rail
    const sightRail = MeshBuilder.CreateBox(
      'sightRail',
      {
        width: 0.025,
        height: 0.015,
        depth: 0.1,
      },
      this.scene
    );
    sightRail.position = new Vector3(0, 0.05, 0.02);
    sightRail.material = gunMat;
    sightRail.parent = container;

    // Holographic sight housing
    const sightHousing = MeshBuilder.CreateBox(
      'sightHousing',
      {
        width: 0.04,
        height: 0.035,
        depth: 0.05,
      },
      this.scene
    );
    sightHousing.position = new Vector3(0, 0.07, 0.02);
    sightHousing.material = gunMat;
    sightHousing.parent = container;

    // Glowing elements (power indicator)
    const powerIndicator = MeshBuilder.CreateBox(
      'powerIndicator',
      {
        width: 0.01,
        height: 0.008,
        depth: 0.03,
      },
      this.scene
    );
    powerIndicator.position = new Vector3(0.025, 0.02, -0.02);
    powerIndicator.material = gunGlowMat;
    powerIndicator.parent = container;

    // Combine into single reference
    const weapon = receiver;

    return { container, weapon, hands };
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
    // Keyboard controls
    const keydownHandler = (e: KeyboardEvent) => {
      this.keysPressed.add(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.isSprinting = true;
      }
    };
    window.addEventListener('keydown', keydownHandler);
    this._listeners.push(() => window.removeEventListener('keydown', keydownHandler));

    const keyupHandler = (e: KeyboardEvent) => {
      this.keysPressed.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.isSprinting = false;
      }
    };
    window.addEventListener('keyup', keyupHandler);
    this._listeners.push(() => window.removeEventListener('keyup', keyupHandler));

    // Mouse controls
    const mousedownHandler = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = true;
      }
    };
    window.addEventListener('mousedown', mousedownHandler);
    this._listeners.push(() => window.removeEventListener('mousedown', mousedownHandler));

    const mouseupHandler = (e: MouseEvent) => {
      if (e.button === 0) {
        this.mouseDown = false;
      }
    };
    window.addEventListener('mouseup', mouseupHandler);
    this._listeners.push(() => window.removeEventListener('mouseup', mouseupHandler));

    // Mouse look - only when pointer is locked
    const mousemoveHandler = (e: MouseEvent) => {
      if (document.pointerLockElement === this.canvas && !this.isDropping) {
        const sensitivity = 0.002;
        this.rotationY += e.movementX * sensitivity;
        this.rotationX -= e.movementY * sensitivity;

        // Clamp vertical rotation
        this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));
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
    this._listeners.forEach(cleanup => cleanup());
    this._listeners = [];
    this.keysPressed.clear();
    this.mesh.dispose();
    this.weaponContainer.dispose();
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

    // Trigger weapon recoil animation
    this.triggerWeaponRecoil();

    // Play weapon fire sound
    getAudioManager().play('weapon_fire', { volume: 0.5 });

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

    // Muzzle flash at spawn point
    const flash = MeshBuilder.CreateSphere('muzzleFlash', { diameter: 0.4 }, this.scene);
    flash.position = spawnPos;
    const flashMat = new StandardMaterial('flashMat', this.scene);
    flashMat.emissiveColor = Color3.FromHexString('#FFFFFF');
    flashMat.disableLighting = true;
    flashMat.alpha = 0.8;
    flash.material = flashMat;

    // Animate muzzle flash fade
    const flashStart = performance.now();
    const animateFlash = () => {
      const elapsed = performance.now() - flashStart;
      const progress = elapsed / 80;
      if (progress < 1) {
        flashMat.alpha = 0.8 * (1 - progress);
        flash.scaling.setAll(1 + progress * 0.5);
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
      renderable: {
        mesh: laserBolt,
        visible: true,
      },
      tags: {
        projectile: true,
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

    // Apply camera rotation
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;

    // Determine input source
    const usingTouch = this.touchInput !== null && this.isTouchDevice;

    // Sprint state
    if (usingTouch && this.touchInput) {
      this.isSprinting = this.touchInput.isSprinting;
    }

    const speed = this.isSprinting ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed;

    // Calculate movement
    const moveDir = Vector3.Zero();

    if (usingTouch && this.touchInput) {
      // Touch joystick movement
      const movement = this.touchInput.movement;
      const moveMagnitude = Math.sqrt(movement.x * movement.x + movement.y * movement.y);
      if (moveMagnitude > 0.1) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Forward()).scale(movement.y));
        moveDir.addInPlace(this.camera.getDirection(Vector3.Right()).scale(movement.x));
      }

      // Camera rotation from screen touch-drag
      const look = this.touchInput.look;
      if (Math.abs(look.x) > 0.0001 || Math.abs(look.y) > 0.0001) {
        // Direct delta - touch controls already apply sensitivity
        this.rotationY += look.x;
        this.rotationX -= look.y;
        this.rotationX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotationX));
      }
    } else {
      // Keyboard movement
      if (this.keysPressed.has('KeyW')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Forward()));
      }
      if (this.keysPressed.has('KeyS')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Backward()));
      }
      if (this.keysPressed.has('KeyA')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Left()));
      }
      if (this.keysPressed.has('KeyD')) {
        moveDir.addInPlace(this.camera.getDirection(Vector3.Right()));
      }
    }

    // Apply movement
    if (moveDir.length() > 0) {
      moveDir.normalize();
      moveDir.y = 0;
      moveDir.scaleInPlace(speed * deltaTime);
      this.camera.position.addInPlace(moveDir);
    }

    // Keep camera at proper height
    this.camera.position.y = 1.8;

    // Update entity transform
    if (this.entity.transform) {
      this.entity.transform.position = this.camera.position.clone();
      this.entity.transform.position.y = 1;
    }

    // Update mesh position
    this.mesh.position = this.camera.position.clone();
    this.mesh.position.y = 1;

    // Fire logic
    const shouldFire = usingTouch ? (this.touchInput?.isFiring ?? false) : this.mouseDown;

    if (shouldFire) {
      this.fire();
    }

    // Health regen
    if (this.entity.health) {
      if (this.entity.health.current < this.entity.health.max) {
        this.entity.health.current = Math.min(
          this.entity.health.max,
          this.entity.health.current + this.entity.health.regenRate * deltaTime
        );
      }
    }

    // Update weapon animation
    this.updateWeaponAnimation(deltaTime, moveDir.length() > 0);
  }

  private updateWeaponAnimation(deltaTime: number, isMoving: boolean): void {
    // Weapon bob while moving
    if (isMoving) {
      this.weaponBobTime += deltaTime * (this.isSprinting ? 14 : 10);
    } else {
      // Subtle idle sway
      this.weaponBobTime += deltaTime * 2;
    }

    // Calculate bob offsets
    const bobAmplitudeX = isMoving ? (this.isSprinting ? 0.025 : 0.015) : 0.003;
    const bobAmplitudeY = isMoving ? (this.isSprinting ? 0.03 : 0.018) : 0.004;

    const bobX = Math.sin(this.weaponBobTime) * bobAmplitudeX;
    const bobY = Math.abs(Math.sin(this.weaponBobTime * 2)) * bobAmplitudeY;

    // Smooth recoil recovery
    this.weaponRecoilOffset *= 0.001 ** deltaTime; // Exponential decay
    if (this.weaponRecoilOffset < 0.001) this.weaponRecoilOffset = 0;

    // Apply to weapon container (relative to base position)
    const baseX = 0.35;
    const baseY = -0.25;
    const baseZ = 0.5;

    this.weaponContainer.position.x = baseX + bobX;
    this.weaponContainer.position.y = baseY + bobY - this.weaponRecoilOffset * 0.05;
    this.weaponContainer.position.z = baseZ - this.weaponRecoilOffset * 0.08;

    // Slight rotation during recoil
    this.weaponContainer.rotation.x = -this.weaponRecoilOffset * 0.3;
  }

  private triggerWeaponRecoil(): void {
    this.weaponRecoilOffset = 1.0;
  }

  getPosition(): Vector3 {
    return this.camera.position.clone();
  }

  takeDamage(amount: number): void {
    if (!this.entity.health) return;

    this.entity.health.current = Math.max(0, this.entity.health.current - amount);

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
}
