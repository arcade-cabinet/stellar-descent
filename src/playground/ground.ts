import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PhysicsShapeType } from '@babylonjs/core/Physics/';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { Scene } from '@babylonjs/core/scene';

export class Ground {
  constructor(private scene: Scene) {
    this.scene = scene;
    this._createGround();
    this._createSphere();
  }

  _createGround(): void {
    const mesh = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, this.scene);
    const pa = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    pa.body.startAsleep = true;
    console.log(pa);
  }

  _createSphere(): void {
    const mesh = MeshBuilder.CreateSphere('sphere', { diameter: 2, segments: 32 }, this.scene);
    mesh.position.y = 4;

    new PhysicsAggregate(mesh, PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.75 }, this.scene);
  }
}
