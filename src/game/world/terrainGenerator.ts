import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PhysicsShapeType } from '@babylonjs/core/Physics/';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import type { Scene } from '@babylonjs/core/scene';
import { tokens } from '../utils/designTokens';

export class TerrainGenerator {
  private scene: Scene;
  private groundMesh: Mesh | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  createMainGround(): Mesh {
    // Create a large ground plane with desert/rocky appearance
    const ground = MeshBuilder.CreateGround(
      'mainGround',
      { width: 2000, height: 2000, subdivisions: 64 },
      this.scene
    );

    // Create material with harsh sunlit desert appearance
    const groundMat = new StandardMaterial('groundMat', this.scene);

    // Use Babylon.js texture library for rock/sand texture
    const diffuseTex = new Texture('/texture/ground.jpg', this.scene);
    diffuseTex.uScale = 100;
    diffuseTex.vScale = 100;
    groundMat.diffuseTexture = diffuseTex;

    // Adjust colors for harsh sunlit appearance
    groundMat.diffuseColor = Color3.FromHexString(tokens.colors.primary.tan);
    groundMat.specularColor = new Color3(0.15, 0.12, 0.1);
    groundMat.specularPower = 8;

    // Add bump map for texture
    const bumpTex = new Texture('/texture/rockn.png', this.scene);
    bumpTex.uScale = 80;
    bumpTex.vScale = 80;
    groundMat.bumpTexture = bumpTex;

    ground.material = groundMat;
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    // Add physics
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    this.groundMesh = ground;
    return ground;
  }

  createRockFormations(count: number): Mesh[] {
    const rocks: Mesh[] = [];
    const rockMat = new StandardMaterial('rockFormationMat', this.scene);

    // Create high contrast rock material for harsh lighting
    rockMat.diffuseColor = Color3.FromHexString(tokens.colors.environment.rockLight);
    rockMat.specularColor = new Color3(0.4, 0.35, 0.3);
    rockMat.specularPower = 16;

    const rockTex = new Texture('/texture/rock.png', this.scene);
    rockMat.diffuseTexture = rockTex;

    for (let i = 0; i < count; i++) {
      // Create jutting rock pillars and formations
      const height = 10 + Math.random() * 30;
      const baseRadius = 3 + Math.random() * 8;

      const rock = MeshBuilder.CreateCylinder(
        `rockFormation_${i}`,
        {
          height,
          diameterTop: baseRadius * (0.2 + Math.random() * 0.4),
          diameterBottom: baseRadius,
          tessellation: 6 + Math.floor(Math.random() * 6),
        },
        this.scene
      );

      // Random position in a ring pattern from center
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 800;
      rock.position.x = Math.cos(angle) * distance;
      rock.position.z = Math.sin(angle) * distance;
      rock.position.y = height / 2;

      // Add some tilt for more natural appearance
      rock.rotation.x = (Math.random() - 0.5) * 0.3;
      rock.rotation.z = (Math.random() - 0.5) * 0.3;
      rock.rotation.y = Math.random() * Math.PI;

      rock.material = rockMat;
      rock.receiveShadows = true;
      rock.checkCollisions = true;

      // Add physics
      new PhysicsAggregate(rock, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

      rocks.push(rock);
    }

    return rocks;
  }

  createDistantMountains(): Mesh {
    // Create a ring of distant mountains for skyline
    const mountainMat = new StandardMaterial('mountainMat', this.scene);
    mountainMat.diffuseColor = Color3.FromHexString(tokens.colors.environment.rockDark);
    mountainMat.specularColor = new Color3(0.1, 0.1, 0.1);
    mountainMat.emissiveColor = new Color3(0.02, 0.02, 0.03); // Slight atmospheric haze

    // Create mountain ring using merged boxes
    const mountainRing = MeshBuilder.CreateTorus(
      'mountainRing',
      {
        diameter: 3000,
        thickness: 200,
        tessellation: 32,
      },
      this.scene
    );

    mountainRing.position.y = -50;
    mountainRing.scaling.y = 2;
    mountainRing.material = mountainMat;

    return mountainRing;
  }
}
