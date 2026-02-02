# Research: Shell Casings and Impact Decals for BabylonJS

**Date:** 2026-01-30
**Purpose:** Implementation approaches for shell casing ejection and bullet hole decals in Stellar Descent

---

## Executive Summary

This document outlines two primary systems needed to enhance weapon feedback:

1. **Shell Casings** - Physical brass casings ejected from weapons during firing
2. **Impact Decals** - Bullet holes that appear on surfaces when projectiles hit

Both systems require careful attention to performance due to the high frequency of spawning during intense combat.

---

## Shell Casing Implementation

### Approach Comparison

| Approach | Performance | Visual Quality | Complexity | Recommended Use |
|----------|-------------|----------------|------------|-----------------|
| **Solid Particle System (SPS)** | Excellent | High (3D meshes) | Medium | Best overall choice |
| **Thin Instances** | Excellent | High | Medium | Static displays |
| **Standard Particle System** | Good | Medium (2D sprites) | Low | Simple effects |
| **Individual Meshes** | Poor | High | Low | Avoid for casings |

### Recommended: Solid Particle System (SPS)

The SPS is ideal for shell casings because it renders all particles in a single draw call while supporting full 3D mesh geometry. Unlike the standard particle system, you have complete control over physics behavior.

**Key Characteristics:**
- Single updatable mesh with one draw call
- Full 3D mesh support (actual shell casing models)
- Manual physics implementation required
- Supports custom collision detection
- Memory efficient with particle recycling

### Implementation Pseudocode

```typescript
// ShellCasingSystem.ts

import * as BABYLON from 'babylonjs';

interface ShellCasing {
  particle: BABYLON.SolidParticle;
  velocity: BABYLON.Vector3;
  angularVelocity: BABYLON.Vector3;
  lifetime: number;
  active: boolean;
}

class ShellCasingSystem {
  private sps: BABYLON.SolidParticleSystem;
  private casings: ShellCasing[] = [];
  private poolSize = 50; // Pre-allocate for performance
  private casingLifetime = 3.0; // seconds before recycling
  private gravity = -9.81;
  private groundY = 0;

  constructor(scene: BABYLON.Scene) {
    // Create the Solid Particle System
    this.sps = new BABYLON.SolidParticleSystem("shellCasings", scene, {
      updatable: true,
      isPickable: false,
    });

    // Create shell casing mesh (cylinder approximation)
    const casingMesh = BABYLON.MeshBuilder.CreateCylinder("casing", {
      height: 0.025,  // 2.5cm typical pistol casing
      diameter: 0.009, // 9mm diameter
      tessellation: 8,
    }, scene);

    // Add particles to the pool
    this.sps.addShape(casingMesh, this.poolSize);

    // Build the SPS mesh
    const spsMesh = this.sps.buildMesh();
    spsMesh.hasVertexAlpha = false;

    // Apply brass material
    const brassMaterial = new BABYLON.StandardMaterial("brass", scene);
    brassMaterial.diffuseColor = new BABYLON.Color3(0.78, 0.57, 0.11);
    brassMaterial.specularColor = new BABYLON.Color3(1, 0.9, 0.5);
    brassMaterial.specularPower = 64;
    spsMesh.material = brassMaterial;

    // Dispose the source mesh
    casingMesh.dispose();

    // Initialize all particles as inactive (hidden)
    this.sps.initParticles = () => {
      for (let i = 0; i < this.sps.nbParticles; i++) {
        const p = this.sps.particles[i];
        p.isVisible = false;
        this.casings.push({
          particle: p,
          velocity: BABYLON.Vector3.Zero(),
          angularVelocity: BABYLON.Vector3.Zero(),
          lifetime: 0,
          active: false,
        });
      }
    };

    this.sps.initParticles();
    this.sps.setParticles();

    // Register update loop
    scene.registerBeforeRender(() => this.update(scene.getEngine().getDeltaTime() / 1000));
  }

  /**
   * Eject a shell casing from the weapon
   */
  eject(
    position: BABYLON.Vector3,
    ejectionDirection: BABYLON.Vector3,
    weaponVelocity: BABYLON.Vector3 = BABYLON.Vector3.Zero()
  ): void {
    // Find inactive casing in pool
    const casing = this.casings.find(c => !c.active);
    if (!casing) return; // Pool exhausted, skip this casing

    const p = casing.particle;

    // Set position at weapon ejection port
    p.position.copyFrom(position);

    // Calculate ejection velocity with randomization
    const baseSpeed = 3 + Math.random() * 2; // 3-5 m/s
    casing.velocity = ejectionDirection.scale(baseSpeed).add(weaponVelocity);
    casing.velocity.y += 1 + Math.random() * 0.5; // Upward component

    // Random angular velocity for tumbling effect
    casing.angularVelocity = new BABYLON.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    );

    // Reset state
    casing.lifetime = 0;
    casing.active = true;
    p.isVisible = true;

    // Random initial rotation
    p.rotation.x = Math.random() * Math.PI * 2;
    p.rotation.y = Math.random() * Math.PI * 2;
    p.rotation.z = Math.random() * Math.PI * 2;
  }

  private update(deltaTime: number): void {
    let needsUpdate = false;

    for (const casing of this.casings) {
      if (!casing.active) continue;
      needsUpdate = true;

      const p = casing.particle;

      // Apply gravity
      casing.velocity.y += this.gravity * deltaTime;

      // Update position
      p.position.addInPlace(casing.velocity.scale(deltaTime));

      // Update rotation (tumbling)
      p.rotation.addInPlace(casing.angularVelocity.scale(deltaTime));

      // Ground collision
      if (p.position.y <= this.groundY) {
        p.position.y = this.groundY;

        // Bounce with energy loss
        if (Math.abs(casing.velocity.y) > 0.5) {
          casing.velocity.y *= -0.3; // Bounce coefficient
          casing.velocity.x *= 0.8; // Friction
          casing.velocity.z *= 0.8;
          casing.angularVelocity.scaleInPlace(0.7);

          // TODO: Play casing clink sound
        } else {
          // Stop movement when energy is low
          casing.velocity.setAll(0);
          casing.angularVelocity.setAll(0);
        }
      }

      // Update lifetime
      casing.lifetime += deltaTime;

      // Recycle after lifetime expires
      if (casing.lifetime > this.casingLifetime) {
        casing.active = false;
        p.isVisible = false;
      }
    }

    // Only update SPS if there are active casings
    if (needsUpdate) {
      this.sps.setParticles();
    }
  }

  dispose(): void {
    this.sps.dispose();
  }
}
```

### Ejection Port Integration

```typescript
// In FirstPersonWeapons.ts or similar

class WeaponSystem {
  private shellCasings: ShellCasingSystem;

  fire(): void {
    // ... existing firing logic ...

    // Eject shell casing
    const ejectionPort = this.getEjectionPortWorldPosition();
    const ejectionDirection = this.getEjectionDirection(); // Usually right + slightly back
    this.shellCasings.eject(ejectionPort, ejectionDirection, this.playerVelocity);
  }

  private getEjectionDirection(): BABYLON.Vector3 {
    // Typically ejects to the right of the weapon
    const right = this.camera.getDirection(BABYLON.Axis.X);
    const back = this.camera.getDirection(BABYLON.Axis.Z).scale(-0.3);
    return right.add(back).normalize();
  }
}
```

---

## Impact Decal Implementation

### Approach Comparison

| Approach | Performance | Quality | Max Count | Best For |
|----------|-------------|---------|-----------|----------|
| **Texture Decals (MeshUVSpaceRenderer)** | Excellent | High | Unlimited* | High-frequency hits |
| **Mesh Decals** | Moderate | High | ~100 | Infrequent hits |
| **Sprite Billboards** | Good | Low | ~200 | Stylized games |

*Texture decals are baked into the surface texture, so they persist without additional draw calls.

### Recommended: Hybrid Approach

Use **Texture Decals** for static environment surfaces (walls, floors) and **Mesh Decals** for dynamic objects where texture modification is impractical.

### Mesh Decals (Simple Approach)

Best for dynamic objects or when you need decals that can be removed.

```typescript
// DecalSystem.ts

interface BulletHoleDecal {
  mesh: BABYLON.Mesh;
  createdAt: number;
}

class MeshDecalSystem {
  private decals: BulletHoleDecal[] = [];
  private maxDecals = 100;
  private decalLifetime = 30; // seconds
  private bulletHoleTexture: BABYLON.Texture;
  private decalMaterial: BABYLON.StandardMaterial;

  constructor(private scene: BABYLON.Scene) {
    // Load bullet hole texture
    this.bulletHoleTexture = new BABYLON.Texture(
      "/textures/effects/bullet_hole.png",
      scene
    );

    // Create shared decal material
    this.decalMaterial = new BABYLON.StandardMaterial("bulletHoleMat", scene);
    this.decalMaterial.diffuseTexture = this.bulletHoleTexture;
    this.decalMaterial.diffuseTexture.hasAlpha = true;
    this.decalMaterial.useAlphaFromDiffuseTexture = true;
    this.decalMaterial.zOffset = -2; // Prevent z-fighting

    // Cleanup loop
    scene.registerBeforeRender(() => this.cleanupOldDecals());
  }

  createBulletHole(
    targetMesh: BABYLON.AbstractMesh,
    position: BABYLON.Vector3,
    normal: BABYLON.Vector3
  ): void {
    // Remove oldest decal if at limit
    if (this.decals.length >= this.maxDecals) {
      const oldest = this.decals.shift();
      oldest?.mesh.dispose();
    }

    // Create decal
    const decalSize = new BABYLON.Vector3(0.1, 0.1, 0.1); // 10cm bullet hole
    const decal = BABYLON.MeshBuilder.CreateDecal("bulletHole", targetMesh, {
      position: position,
      normal: normal,
      size: decalSize,
      angle: Math.random() * Math.PI * 2, // Random rotation
      cullBackFaces: true, // Prevent texture leak-through
    });

    decal.material = this.decalMaterial;

    this.decals.push({
      mesh: decal,
      createdAt: performance.now(),
    });
  }

  private cleanupOldDecals(): void {
    const now = performance.now();
    const lifetimeMs = this.decalLifetime * 1000;

    this.decals = this.decals.filter(decal => {
      if (now - decal.createdAt > lifetimeMs) {
        decal.mesh.dispose();
        return false;
      }
      return true;
    });
  }

  dispose(): void {
    this.decals.forEach(d => d.mesh.dispose());
    this.decalMaterial.dispose();
    this.bulletHoleTexture.dispose();
  }
}
```

### Texture Decals (High-Performance Approach)

Best for static environment geometry with high hit frequency.

```typescript
// TextureDecalSystem.ts

class TextureDecalSystem {
  private decalRenderers: Map<BABYLON.AbstractMesh, BABYLON.MeshUVSpaceRenderer> = new Map();
  private bulletHoleTexture: BABYLON.Texture;

  constructor(private scene: BABYLON.Scene) {
    this.bulletHoleTexture = new BABYLON.Texture(
      "/textures/effects/bullet_hole_decal.png",
      scene
    );
  }

  /**
   * Pre-register meshes that will receive texture decals
   * Call this for walls, floors, and other static geometry
   */
  registerMesh(mesh: BABYLON.AbstractMesh): void {
    if (this.decalRenderers.has(mesh)) return;

    const renderer = new BABYLON.MeshUVSpaceRenderer(mesh, this.scene, {
      uvEdgeBlending: true, // Better quality at UV seams
    });

    this.decalRenderers.set(mesh, renderer);

    // Enable decal map on material
    if (mesh.material) {
      (mesh.material as any).decalMap = renderer;
      if ((mesh.material as any).decalMap) {
        (mesh.material as any).decalMap.isEnabled = true;
      }
    }
  }

  createBulletHole(
    mesh: BABYLON.AbstractMesh,
    position: BABYLON.Vector3,
    normal: BABYLON.Vector3
  ): void {
    const renderer = this.decalRenderers.get(mesh);
    if (!renderer) {
      console.warn("Mesh not registered for texture decals:", mesh.name);
      return;
    }

    const decalSize = new BABYLON.Vector3(0.1, 0.1, 0.1);

    // Render decal directly to mesh's texture
    renderer.renderTexture(
      this.bulletHoleTexture,
      position,
      normal,
      decalSize
    );
  }

  dispose(): void {
    this.decalRenderers.forEach(r => r.dispose());
    this.bulletHoleTexture.dispose();
  }
}
```

### Integration with Raycast Hits

```typescript
// In weapon firing logic

onWeaponFire(): void {
  const ray = this.camera.getForwardRay(100);
  const hit = this.scene.pickWithRay(ray);

  if (hit?.hit && hit.pickedMesh && hit.pickedPoint && hit.getNormal(true)) {
    const normal = hit.getNormal(true)!;

    // Create bullet hole at impact point
    if (this.isStaticEnvironment(hit.pickedMesh)) {
      this.textureDecals.createBulletHole(hit.pickedMesh, hit.pickedPoint, normal);
    } else {
      this.meshDecals.createBulletHole(hit.pickedMesh, hit.pickedPoint, normal);
    }

    // Spawn impact particle effect
    this.spawnImpactEffect(hit.pickedPoint, normal);
  }
}
```

---

## Performance Considerations

### Object Pooling Guidelines

Based on industry best practices from Unity and Unreal implementations:

| Guideline | Recommendation |
|-----------|----------------|
| **Pool Size** | Start with max expected + 20-30% buffer |
| **Pre-warming** | Initialize pool during loading screen |
| **Exhaustion Strategy** | Skip newest spawns (user won't notice during intense action) |
| **Recycling Trigger** | Lifetime expiry OR pool exhaustion |
| **Physics Reset** | Always zero velocities before reuse |

### Shell Casing Optimizations

1. **Limit active count**: 30-50 casings maximum (covers rapid-fire scenarios)
2. **Reduce lifetime on mobile**: 1.5-2 seconds vs 3 seconds on desktop
3. **Disable SPS updates when empty**: Skip `setParticles()` if no active casings
4. **Simplify geometry**: 6-8 sided cylinders are sufficient
5. **Share materials**: All casings use a single brass material

### Decal Optimizations

1. **Mesh Decal Limits**: Cap at 50-100 decals on screen
2. **Use Texture Decals for environment**: No additional draw calls
3. **Decal size matters**: Larger decals require more geometry calculation
4. **Batch cleanup**: Remove multiple old decals per frame, not one at a time
5. **Material sharing**: All bullet holes use shared material instance

### Mobile-Specific Considerations

- Reduce shell casing pool to 20-30
- Use 2D sprite particles instead of SPS for low-end devices
- Limit texture decals to major surfaces only
- Consider disabling shell casings entirely in performance mode

---

## Audio Integration Notes

For complete weapon feedback, shell casings should play audio:

```typescript
// Shell casing sounds
interface CasingSoundEvent {
  type: 'brass_concrete' | 'brass_metal' | 'brass_wood';
  position: BABYLON.Vector3;
  volume: number; // Based on impact velocity
}

// Play on ground collision in ShellCasingSystem
if (hitGround && velocity > threshold) {
  const surfaceType = this.getSurfaceType(position);
  this.audioManager.playCasingSound(surfaceType, position, velocity);
}
```

---

## Sources

### Official BabylonJS Documentation
- [Solid Particle System Introduction](https://doc.babylonjs.com/features/featuresDeepDive/particles/solid_particle_system/sps_intro/)
- [SPS Physics and Collisions](https://doc.babylonjs.com/features/featuresDeepDive/particles/solid_particle_system/sps_physics/)
- [Decals Documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/decals)
- [Thin Instances](https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances)
- [Scene Optimization](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene)

### BabylonJS Community Resources
- [FPS Shooter Sample with Vite](https://forum.babylonjs.com/t/fps-shooter-sample-on-babylon-js-with-vite/21822)
- [FPS Gaming Engine Alpha](https://forum.babylonjs.com/t/first-person-shooter-fps-gaming-engine-alpha-version-demo/52564)
- [Texture Decals Discussion](https://babylonjs.medium.com/another-take-at-decals-ef8ec19221a1)
- [Visual Effects with Particles Guide](https://babylonjs.medium.com/visual-effects-with-particles-a-guide-for-beginners-5f322445388d)

### Reference FPS Projects
- [BabylonFpsDemo (GitHub)](https://github.com/renjianfeng/BabylonFpsDemo)
- [three-fps (GitHub)](https://github.com/mohsenheydari/three-fps) - Three.js reference
- [ThreeJS_FPS_2.0 (GitHub)](https://github.com/Footprintarts/ThreeJS_FPS_2.0) - Modular FPS template

### Object Pooling Best Practices
- [Game Programming Patterns - Object Pool](https://gameprogrammingpatterns.com/object-pool.html)
- [Unity Object Pooling Tutorial](https://learn.unity.com/tutorial/introduction-to-object-pooling)
- [Unreal Engine Object Pooling](https://outscal.com/blog/unreal-engine-object-pooling)
- [Unity Performance with Object Pooling](https://unity.com/how-to/use-object-pooling-boost-performance-c-scripts-unity)

---

## Recommendations for Stellar Descent

### Phase 1: Shell Casings
1. Implement `ShellCasingSystem` using SPS approach
2. Create simple brass cylinder mesh (8 sides)
3. Add basic ground collision with bounce
4. Integrate with existing weapon fire events

### Phase 2: Impact Decals
1. Start with `MeshDecalSystem` for all surfaces
2. Create bullet hole texture with alpha
3. Integrate with raycast hit detection
4. Add max decal limit and cleanup

### Phase 3: Optimization
1. Profile on target devices
2. Add texture decals for static environment if needed
3. Tune pool sizes based on actual usage
4. Add quality settings toggle

### Phase 4: Polish
1. Add shell casing audio (metal/concrete impacts)
2. Add variety to bullet hole textures (random selection)
3. Fade out old decals before removal
4. Add sparks/debris particles at impact point
