import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { createEntity, type Entity } from '../core/ecs';
import { tokens } from '../utils/designTokens';

export class MechWarrior {
  public entity: Entity;
  public rootNode: TransformNode;

  private scene: Scene;
  private leftArm: Mesh;
  private rightArm: Mesh;
  private legs: Mesh;

  private targetPosition: Vector3 | null = null;
  private attackTarget: Entity | null = null;
  private lastFireTime = 0;
  private fireRate = 2;

  constructor(scene: Scene, position: Vector3) {
    this.scene = scene;
    this.rootNode = new TransformNode('mechRoot', scene);
    this.rootNode.position = position;

    this.createBody();
    this.leftArm = this.createArm('left');
    this.rightArm = this.createArm('right');
    this.legs = this.createLegs();

    this.entity = this.createEntity();

    // Spawn animation
    this.playSpawnAnimation();
  }

  private createBody(): Mesh {
    const body = MeshBuilder.CreateBox('mechBody', { width: 3, height: 4, depth: 2 }, this.scene);

    const material = new StandardMaterial('mechBodyMat', this.scene);
    material.diffuseColor = Color3.FromHexString(tokens.colors.primary.oliveDark);
    material.specularColor = new Color3(0.4, 0.4, 0.4);
    body.material = material;

    body.parent = this.rootNode;
    body.position.y = 6;

    // Add cockpit
    const cockpit = MeshBuilder.CreateBox(
      'cockpit',
      { width: 1.5, height: 1, depth: 0.8 },
      this.scene
    );
    const cockpitMat = new StandardMaterial('cockpitMat', this.scene);
    cockpitMat.diffuseColor = Color3.FromHexString(tokens.colors.accent.gunmetal);
    cockpitMat.emissiveColor = new Color3(0.1, 0.15, 0.1);
    cockpit.material = cockpitMat;
    cockpit.parent = body;
    cockpit.position.set(0, 1.5, 0.7);

    return body;
  }

  private createArm(side: 'left' | 'right'): Mesh {
    const xPos = side === 'left' ? -2.2 : 2.2;

    const arm = MeshBuilder.CreateCylinder(
      `mechArm_${side}`,
      { height: 4, diameter: 0.8 },
      this.scene
    );

    const material = new StandardMaterial(`mechArmMat_${side}`, this.scene);
    material.diffuseColor = Color3.FromHexString(tokens.colors.primary.olive);
    material.specularColor = new Color3(0.3, 0.3, 0.3);
    arm.material = material;

    arm.parent = this.rootNode;
    arm.position.set(xPos, 5, 0);
    arm.rotation.z = side === 'left' ? 0.3 : -0.3;

    // Add weapon barrel
    const barrel = MeshBuilder.CreateCylinder(
      `mechBarrel_${side}`,
      { height: 2.5, diameter: 0.4 },
      this.scene
    );
    const barrelMat = new StandardMaterial(`barrelMat_${side}`, this.scene);
    barrelMat.diffuseColor = Color3.FromHexString(tokens.colors.accent.gunmetal);
    barrel.material = barrelMat;
    barrel.parent = arm;
    barrel.position.y = -2.5;
    barrel.rotation.x = Math.PI / 2;

    return arm;
  }

  private createLegs(): Mesh {
    const legsContainer = MeshBuilder.CreateBox(
      'mechLegs',
      { width: 2.5, height: 0.5, depth: 1.5 },
      this.scene
    );
    legsContainer.visibility = 0;
    legsContainer.parent = this.rootNode;
    legsContainer.position.y = 3;

    const legMat = new StandardMaterial('mechLegMat', this.scene);
    legMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.khakiDark);

    // Left leg
    const leftLeg = MeshBuilder.CreateCylinder(
      'leftLeg',
      { height: 5, diameterTop: 0.8, diameterBottom: 1.2 },
      this.scene
    );
    leftLeg.material = legMat;
    leftLeg.parent = legsContainer;
    leftLeg.position.set(-0.8, -2.5, 0);

    // Right leg
    const rightLeg = MeshBuilder.CreateCylinder(
      'rightLeg',
      { height: 5, diameterTop: 0.8, diameterBottom: 1.2 },
      this.scene
    );
    rightLeg.material = legMat;
    rightLeg.parent = legsContainer;
    rightLeg.position.set(0.8, -2.5, 0);

    // Feet
    const footMat = new StandardMaterial('footMat', this.scene);
    footMat.diffuseColor = Color3.FromHexString(tokens.colors.accent.gunmetal);

    const leftFoot = MeshBuilder.CreateBox(
      'leftFoot',
      { width: 1.5, height: 0.5, depth: 2 },
      this.scene
    );
    leftFoot.material = footMat;
    leftFoot.parent = legsContainer;
    leftFoot.position.set(-0.8, -5.25, 0.3);

    const rightFoot = MeshBuilder.CreateBox(
      'rightFoot',
      { width: 1.5, height: 0.5, depth: 2 },
      this.scene
    );
    rightFoot.material = footMat;
    rightFoot.parent = legsContainer;
    rightFoot.position.set(0.8, -5.25, 0.3);

    return legsContainer;
  }

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
          const tt = t - 1.5 / 2.75;
          return 7.5625 * tt * tt + 0.75;
        }
        if (t < 2.5 / 2.75) {
          const tt = t - 2.25 / 2.75;
          return 7.5625 * tt * tt + 0.9375;
        }
        const tt = t - 2.625 / 2.75;
        return 7.5625 * tt * tt + 0.984375;
      };

      this.rootNode.position.y = startY - (startY - endY) * bounceOut(progress);

      if (progress < 1) {
        requestAnimationFrame(animateDrop);
      }
    };

    requestAnimationFrame(animateDrop);
  }

  setTarget(position: Vector3): void {
    this.targetPosition = position;
  }

  setAttackTarget(target: Entity): void {
    this.attackTarget = target;
  }

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

      // Arm recoil animation
      const originalZ = arm.rotation.z;
      const recoilZ = originalZ + (arm.position.x < 0 ? 0.2 : -0.2);
      const restZ = arm.position.x < 0 ? 0.3 : -0.3;

      arm.rotation.z = recoilZ;
      setTimeout(() => {
        arm.rotation.z = restZ;
      }, 100);

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
            projectile.dispose();
            projMat.dispose();
          },
        },
      });
    }
  }

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

        // Walking animation
        const time = performance.now() * 0.005;
        this.legs.position.y = 3 + Math.sin(time) * 0.2;
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
      if (this.rootNode.rotationQuaternion) {
        this.entity.transform.rotation = this.rootNode.rotationQuaternion.toEulerAngles();
      } else {
        this.entity.transform.rotation = this.rootNode.rotation.clone();
      }
    }
  }

  dispose(): void {
    this.rootNode.dispose();
  }
}
