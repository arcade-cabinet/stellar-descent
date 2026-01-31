import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF';
import { createEntity, type Entity } from '../core/ecs';
import { getLogger } from '../core/Logger';
import { tokens } from '../utils/designTokens';

const log = getLogger('MechWarrior');

/** Path to the Marcus mech GLB model (relative to public/) */
const MECH_GLB_PATH = '/models/vehicles/tea/marcus_mech.glb';

/**
 * Try to find a child mesh whose name contains one of the given substrings
 * (case-insensitive). Returns the first match or null.
 */
function findChildMesh(
  meshes: AbstractMesh[],
  ...substrings: string[]
): Mesh | null {
  for (const sub of substrings) {
    const lower = sub.toLowerCase();
    const found = meshes.find(
      (m) => m.name.toLowerCase().includes(lower) && m instanceof Mesh
    );
    if (found) return found as Mesh;
  }
  return null;
}

export class MechWarrior {
  public entity: Entity;
  public rootNode: TransformNode;

  private scene: Scene;
  private body: Mesh;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private legs: Mesh;

  private targetPosition: Vector3 | null = null;
  private attackTarget: Entity | null = null;
  private lastFireTime = 0;
  private fireRate = 2;

  // -----------------------------------------------------------------------
  // Private constructor -- use the async MechWarrior.create() factory
  // -----------------------------------------------------------------------
  private constructor(
    scene: Scene,
    position: Vector3,
    rootNode: TransformNode,
    body: Mesh,
    leftArm: Mesh,
    rightArm: Mesh,
    legs: Mesh
  ) {
    this.scene = scene;
    this.rootNode = rootNode;
    this.rootNode.position = position;

    this.body = body;
    this.leftArm = leftArm;
    this.rightArm = rightArm;
    this.legs = legs;

    this.entity = this.createEntity();

    // Spawn animation
    this.playSpawnAnimation();
  }

  // -----------------------------------------------------------------------
  // Async factory
  // -----------------------------------------------------------------------

  /**
   * Create a MechWarrior by loading the GLB model asynchronously.
   *
   * Replaces the previous synchronous constructor that used MeshBuilder.
   * The loaded GLB is searched for child meshes matching body, arm, and leg
   * naming conventions. If a particular part is not found, a tiny invisible
   * placeholder mesh is used so that animation & fire logic degrades
   * gracefully rather than crashing.
   */
  static async create(scene: Scene, position: Vector3): Promise<MechWarrior> {
    const rootNode = new TransformNode('mechRoot', scene);

    // ------------------------------------------------------------------
    // Load GLB
    // ------------------------------------------------------------------
    const result = await SceneLoader.ImportMeshAsync('', MECH_GLB_PATH, '', scene);

    // Parent all top-level meshes under our root transform
    for (const mesh of result.meshes) {
      if (!mesh.parent) {
        mesh.parent = rootNode;
      }
      mesh.isVisible = true;
    }

    // ------------------------------------------------------------------
    // Locate key sub-meshes by name convention from the GLB
    // ------------------------------------------------------------------
    const allMeshes = rootNode.getChildMeshes(false) as AbstractMesh[];

    const body = findChildMesh(allMeshes, 'body', 'torso', 'chassis', 'hull');
    if (!body) {
      throw new Error(
        `[MechWarrior] GLB at ${MECH_GLB_PATH} missing required mesh: body/torso/chassis/hull. ` +
          `Available meshes: ${allMeshes.map((m) => m.name).join(', ')}`
      );
    }

    const leftArm = findChildMesh(allMeshes, 'leftarm', 'left_arm', 'arm_l', 'arm_left');
    if (!leftArm) {
      throw new Error(
        `[MechWarrior] GLB at ${MECH_GLB_PATH} missing required mesh: leftarm/left_arm/arm_l. ` +
          `Available meshes: ${allMeshes.map((m) => m.name).join(', ')}`
      );
    }

    const rightArm = findChildMesh(allMeshes, 'rightarm', 'right_arm', 'arm_r', 'arm_right');
    if (!rightArm) {
      throw new Error(
        `[MechWarrior] GLB at ${MECH_GLB_PATH} missing required mesh: rightarm/right_arm/arm_r. ` +
          `Available meshes: ${allMeshes.map((m) => m.name).join(', ')}`
      );
    }

    const legs = findChildMesh(allMeshes, 'legs', 'leg', 'hip', 'pelvis', 'lower');
    if (!legs) {
      throw new Error(
        `[MechWarrior] GLB at ${MECH_GLB_PATH} missing required mesh: legs/leg/hip/pelvis/lower. ` +
          `Available meshes: ${allMeshes.map((m) => m.name).join(', ')}`
      );
    }

    // Ensure names match what cinematics & other systems expect
    body.name = 'mechBody';
    leftArm.name = 'mechLeftArm';
    rightArm.name = 'mechRightArm';
    legs.name = 'mechLegs';

    return new MechWarrior(scene, position, rootNode, body, leftArm, rightArm, legs);
  }


  // -----------------------------------------------------------------------
  // Entity creation (unchanged)
  // -----------------------------------------------------------------------

  private createEntity(): Entity {
    return createEntity({
      transform: {
        position: this.rootNode.position.clone(),
        rotation: Vector3.Zero(),
        scale: new Vector3(1, 1, 1),
      },
      health: {
        current: 500,
        max: 500,
        regenRate: 5,
      },
      combat: {
        damage: 50,
        range: 80,
        fireRate: this.fireRate,
        lastFire: 0,
        projectileSpeed: 60,
      },
      renderable: {
        mesh: this.rootNode,
        visible: true,
      },
      tags: {
        ally: true,
        mech: true,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Spawn animation (unchanged)
  // -----------------------------------------------------------------------

  private playSpawnAnimation(): void {
    // Drop from sky animation
    const startY = this.rootNode.position.y + 50;
    const endY = 0;

    this.rootNode.position.y = startY;

    const startTime = performance.now();
    const duration = 1500;

    const animateDrop = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Bounce easing
      const bounceOut = (t: number) => {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) {
          const t2 = t - 1.5 / 2.75;
          return 7.5625 * t2 * t2 + 0.75;
        }
        if (t < 2.5 / 2.75) {
          const t3 = t - 2.25 / 2.75;
          return 7.5625 * t3 * t3 + 0.9375;
        }
        const t4 = t - 2.625 / 2.75;
        return 7.5625 * t4 * t4 + 0.984375;
      };

      this.rootNode.position.y = startY - (startY - endY) * bounceOut(progress);

      if (progress < 1) {
        requestAnimationFrame(animateDrop);
      }
    };

    requestAnimationFrame(animateDrop);
  }

  // -----------------------------------------------------------------------
  // Public API (unchanged)
  // -----------------------------------------------------------------------

  setTarget(position: Vector3): void {
    this.targetPosition = position;
  }

  setAttackTarget(target: Entity): void {
    this.attackTarget = target;
  }

  // -----------------------------------------------------------------------
  // Fire — projectile MeshBuilder is intentionally kept (transient VFX)
  // -----------------------------------------------------------------------

  fire(): void {
    const now = performance.now();
    const fireInterval = 1000 / this.fireRate;

    if (now - this.lastFireTime < fireInterval) return;
    if (!this.attackTarget?.transform) return;

    this.lastFireTime = now;

    // Fire from both arms
    for (const arm of [this.leftArm, this.rightArm]) {
      const projectile = MeshBuilder.CreateSphere('mechProjectile', { diameter: 0.4 }, this.scene);

      const projMat = new StandardMaterial('mechProjMat', this.scene);
      projMat.emissiveColor = Color3.FromHexString(tokens.colors.accent.brass);
      projMat.disableLighting = true;
      projectile.material = projMat;

      // Start from arm position
      projectile.position = arm.absolutePosition.clone();
      projectile.position.y -= 2;

      // Direction to target
      const direction = this.attackTarget.transform.position
        .subtract(projectile.position)
        .normalize();
      const velocity = direction.scale(this.entity.combat!.projectileSpeed);

      // Arm recoil animation - use requestAnimationFrame instead of setTimeout
      const recoilDir = arm.position.x < 0 ? 0.2 : -0.2;
      const restZ = arm.position.x < 0 ? 0.3 : -0.3;
      arm.rotation.z += recoilDir;

      const startTime = performance.now();
      const recoilDuration = 100;

      const animateRecoil = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / recoilDuration, 1);
        // Ease back to rest position
        arm.rotation.z = arm.rotation.z + (restZ - arm.rotation.z) * progress * 0.3;
        if (progress < 1) {
          requestAnimationFrame(animateRecoil);
        }
      };
      requestAnimationFrame(animateRecoil);

      createEntity({
        transform: {
          position: projectile.position.clone(),
          rotation: Vector3.Zero(),
          scale: new Vector3(1, 1, 1),
        },
        velocity: {
          linear: velocity,
          angular: Vector3.Zero(),
          maxSpeed: this.entity.combat!.projectileSpeed,
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
    }
  }

  // -----------------------------------------------------------------------
  // Update (unchanged)
  // -----------------------------------------------------------------------

  // Animation state
  private walkAnimTime = 0;
  private isMoving = false;

  update(deltaTime: number): void {
    // Move towards target position
    if (this.targetPosition) {
      const direction = this.targetPosition.subtract(this.rootNode.position);
      direction.y = 0;

      if (direction.length() > 5) {
        direction.normalize();
        this.rootNode.position.addInPlace(direction.scale(10 * deltaTime));

        // Face movement direction
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.rootNode.rotation.y = targetRotation;

        // Enhanced walking animation with leg movement and body sway
        this.isMoving = true;
        this.walkAnimTime += deltaTime * 4; // Walking cycle speed

        // Leg bobbing with rotation for more realistic walk
        const legBob = Math.sin(this.walkAnimTime) * 0.3;
        const legTilt = Math.sin(this.walkAnimTime * 2) * 0.05;
        this.legs.position.y = 3 + legBob;
        this.legs.rotation.z = legTilt;

        // Body sway
        this.body.rotation.z = Math.sin(this.walkAnimTime) * 0.02;
        this.body.position.y = Math.abs(Math.sin(this.walkAnimTime)) * 0.1;
      } else {
        this.isMoving = false;
        // Return to neutral pose
        this.legs.rotation.z *= 0.9;
        this.body.rotation.z *= 0.9;
      }
    }

    // Attack target if in range
    if (this.attackTarget?.transform) {
      const distToTarget = Vector3.Distance(
        this.rootNode.position,
        this.attackTarget.transform.position
      );

      if (distToTarget < this.entity.combat!.range) {
        // Face target
        const toTarget = this.attackTarget.transform.position.subtract(this.rootNode.position);
        const targetRotation = Math.atan2(toTarget.x, toTarget.z);
        this.rootNode.rotation.y = targetRotation;

        this.fire();
      }
    }

    // Update entity transform
    if (this.entity.transform) {
      this.entity.transform.position = this.rootNode.position.clone();
      this.entity.transform.rotation = this.rootNode.rotation.clone();
    }
  }

  /**
   * Apply damage to the mech with visual feedback
   */
  takeDamage(amount: number): void {
    if (!this.entity.health) return;

    this.entity.health.current = Math.max(0, this.entity.health.current - amount);

    // Visual damage feedback - flash body red
    this.flashDamage();

    // Body stagger animation
    const staggerDir = (Math.random() - 0.5) * 0.1;
    this.body.rotation.x = staggerDir;
    this.body.rotation.z = staggerDir * 0.5;

    const staggerStart = performance.now();
    const animateStagger = () => {
      const elapsed = performance.now() - staggerStart;
      const progress = Math.min(elapsed / 200, 1);
      this.body.rotation.x *= 0.9;
      this.body.rotation.z *= 0.9;
      if (progress < 1) {
        requestAnimationFrame(animateStagger);
      }
    };
    requestAnimationFrame(animateStagger);

    // Check for destruction
    if (this.entity.health.current <= 0) {
      this.onDestroyed();
    }
  }

  /**
   * Flash the mech body red briefly on damage
   */
  private flashDamage(): void {
    const meshes = [this.body, this.leftArm, this.rightArm, this.legs];

    for (const mesh of meshes) {
      if (mesh?.material instanceof StandardMaterial) {
        const originalEmissive = mesh.material.emissiveColor.clone();
        mesh.material.emissiveColor = Color3.FromHexString('#FF2222');

        setTimeout(() => {
          if (mesh?.material instanceof StandardMaterial) {
            mesh.material.emissiveColor = originalEmissive;
          }
        }, 100);
      }
    }
  }

  /**
   * Handle mech destruction with explosion effect
   */
  private onDestroyed(): void {
    log.info('Destroyed');

    // Simple explosion flash
    const explosionPos = this.rootNode.position.clone();
    const flash = MeshBuilder.CreateSphere('mechExplosion', { diameter: 8 }, this.scene);
    flash.position = explosionPos;

    const flashMat = new StandardMaterial('mechExpMat', this.scene);
    flashMat.emissiveColor = Color3.FromHexString('#FFAA22');
    flashMat.disableLighting = true;
    flash.material = flashMat;

    const startTime = performance.now();
    const animateExplosion = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / 500, 1);
      flash.scaling.setAll(1 + progress * 2);
      flashMat.alpha = 1 - progress;

      if (progress < 1) {
        requestAnimationFrame(animateExplosion);
      } else {
        flash.dispose();
        flashMat.dispose();
        this.dispose();
      }
    };
    requestAnimationFrame(animateExplosion);
  }

  dispose(): void {
    this.rootNode.dispose();
  }
}
