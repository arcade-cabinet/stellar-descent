/**
 * HiveAssaultLevel - Environment Creation
 *
 * Builds the combined-arms battlefield: open terrain leading to the hive entrance.
 * Environment layers (far to near):
 *
 * 1. STAGING AREA (z: 0 to -50)
 *    - FOB structures, sandbags, crates, vehicle bays
 *    - Briefing hologram platform
 *
 * 2. OPEN FIELD (z: -50 to -400)
 *    - Rocky terrain with scattered cover (boulders, ridges)
 *    - Destroyed vehicles (decorative wrecks)
 *    - AA turret emplacements (destructible objectives)
 *
 * 3. BREACH POINT (z: -400 to -550)
 *    - Fortified enemy position around hive entrance
 *    - Organic chitin barriers mixed with rock
 *    - Hive spore vents, acid pools
 *
 * 4. HIVE ENTRANCE (z: -550 to -650)
 *    - Massive organic gate (50m tall)
 *    - Bioluminescent growths
 *    - Transitional zone: rock becomes chitin
 */

import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import '@babylonjs/core/Layers/effectLayerSceneComponent';

// ============================================================================
// COLORS & CONSTANTS
// ============================================================================

export const ENV_COLORS = {
  // Terrain
  terrainBase: '#7A5230',
  terrainRock: '#6B4423',
  terrainDark: '#4A2E18',
  sand: '#C2A06A',

  // Military
  metalGrey: '#5A5A5A',
  militaryGreen: '#4A5A3A',
  concretePad: '#8A8A7A',
  sandbag: '#B8A880',
  crate: '#6A5A3A',

  // Hive organic
  chitinDark: '#2A1A2A',
  chitinPurple: '#4A2A4A',
  chitinRed: '#5A2A2A',
  bioGlow: '#4AFF9F',
  bioGlowDim: '#2A8A5A',
  sporeYellow: '#AAFF44',
  acidGreen: '#44FF44',

  // Wreckage
  burntMetal: '#3A3A3A',
  rust: '#7A4A2A',
  scorchBlack: '#1A1A1A',
} as const;

const TERRAIN_WIDTH = 300;
const TERRAIN_DEPTH = 700;
const TERRAIN_SUBDIVISIONS = 80;

// ============================================================================
// ENVIRONMENT STRUCTURES
// ============================================================================

export interface StagingAreaProps {
  vehicleBay: Mesh;
  briefingPlatform: Mesh;
  sandbags: Mesh[];
  crates: Mesh[];
  lights: PointLight[];
}

export interface AATurret {
  rootNode: TransformNode;
  baseMesh: Mesh;
  barrelMesh: Mesh;
  position: Vector3;
  health: number;
  maxHealth: number;
  destroyed: boolean;
  fireTimer: number;
}

export interface DestroyedVehicle {
  mesh: Mesh;
  position: Vector3;
  type: 'warthog' | 'scorpion' | 'pelican';
}

export interface HiveEntrance {
  gateMesh: Mesh;
  archLeft: Mesh;
  archRight: Mesh;
  organicGrowths: Mesh[];
  bioLights: { mesh: Mesh; light: PointLight; baseIntensity: number; flickerPhase: number }[];
  sporeVents: Mesh[];
}

export interface Fortification {
  mesh: Mesh;
  position: Vector3;
  type: 'sandbag' | 'barrier' | 'crate' | 'rock';
  provideCover: boolean;
}

// ============================================================================
// ASSAULT ENVIRONMENT BUILDER
// ============================================================================

export class AssaultEnvironmentBuilder {
  private scene: Scene;
  private glowLayer: GlowLayer | null = null;

  // Disposable references
  private terrainMesh: Mesh | null = null;
  private skyDome: Mesh | null = null;
  private allMeshes: Mesh[] = [];
  private allLights: PointLight[] = [];
  private allNodes: TransformNode[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  // ============================================================================
  // MAIN BUILD METHODS
  // ============================================================================

  /**
   * Initialize glow layer for bioluminescence and muzzle flashes
   */
  setupGlowLayer(): GlowLayer {
    this.glowLayer = new GlowLayer('assaultGlow', this.scene);
    this.glowLayer.intensity = 0.6;
    return this.glowLayer;
  }

  /**
   * Create the main terrain ground plane
   */
  createTerrain(): Mesh {
    this.terrainMesh = MeshBuilder.CreateGround(
      'assaultTerrain',
      {
        width: TERRAIN_WIDTH,
        height: TERRAIN_DEPTH,
        subdivisions: TERRAIN_SUBDIVISIONS,
      },
      this.scene
    );

    const terrainMat = new StandardMaterial('terrainMat', this.scene);
    terrainMat.diffuseColor = Color3.FromHexString(ENV_COLORS.terrainBase);
    terrainMat.specularColor = new Color3(0.05, 0.04, 0.03);
    this.terrainMesh.material = terrainMat;

    // Center terrain so staging is at z=0 and hive entrance is at z=-650
    this.terrainMesh.position.z = -TERRAIN_DEPTH / 2;

    this.allMeshes.push(this.terrainMesh);
    return this.terrainMesh;
  }

  /**
   * Create sky dome with dusty battlefield atmosphere
   */
  createSkyDome(): Mesh {
    this.skyDome = MeshBuilder.CreateSphere(
      'skyDome',
      { diameter: 4000, segments: 16, sideOrientation: 1 },
      this.scene
    );

    const skyMat = new StandardMaterial('skyMat', this.scene);
    skyMat.emissiveColor = new Color3(0.6, 0.4, 0.25);
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    this.skyDome.material = skyMat;
    this.skyDome.infiniteDistance = true;
    this.skyDome.renderingGroupId = 0;

    this.allMeshes.push(this.skyDome);
    return this.skyDome;
  }

  // ============================================================================
  // STAGING AREA (z: 0 to -50)
  // ============================================================================

  /**
   * Build the forward operating base staging area
   */
  createStagingArea(): StagingAreaProps {
    const sandbags: Mesh[] = [];
    const crates: Mesh[] = [];
    const lights: PointLight[] = [];

    // Vehicle bay - open-air parking for Warthog/Scorpion
    const vehicleBay = MeshBuilder.CreateBox(
      'vehicleBay',
      { width: 20, height: 0.3, depth: 15 },
      this.scene
    );
    const bayMat = new StandardMaterial('bayMat', this.scene);
    bayMat.diffuseColor = Color3.FromHexString(ENV_COLORS.concretePad);
    vehicleBay.material = bayMat;
    vehicleBay.position.set(15, 0.15, -10);
    this.allMeshes.push(vehicleBay);

    // Briefing hologram platform
    const briefingPlatform = MeshBuilder.CreateCylinder(
      'briefingPlatform',
      { height: 0.4, diameter: 4, tessellation: 16 },
      this.scene
    );
    const platMat = new StandardMaterial('platMat', this.scene);
    platMat.diffuseColor = Color3.FromHexString(ENV_COLORS.metalGrey);
    platMat.emissiveColor = new Color3(0.05, 0.1, 0.15);
    briefingPlatform.material = platMat;
    briefingPlatform.position.set(-8, 0.2, -5);
    this.allMeshes.push(briefingPlatform);

    // Hologram light
    const holoLight = new PointLight(
      'holoLight',
      new Vector3(-8, 2.5, -5),
      this.scene
    );
    holoLight.diffuse = new Color3(0.2, 0.5, 0.8);
    holoLight.intensity = 8;
    holoLight.range = 10;
    lights.push(holoLight);
    this.allLights.push(holoLight);

    // Sandbag walls around staging area
    const sandbagPositions = [
      { x: -20, z: -30, rot: 0 },
      { x: 20, z: -30, rot: 0 },
      { x: -15, z: -35, rot: Math.PI / 6 },
      { x: 15, z: -35, rot: -Math.PI / 6 },
      { x: 0, z: -40, rot: 0 },
    ];

    const sandbagMat = new StandardMaterial('sandbagMat', this.scene);
    sandbagMat.diffuseColor = Color3.FromHexString(ENV_COLORS.sandbag);

    for (let i = 0; i < sandbagPositions.length; i++) {
      const pos = sandbagPositions[i];
      const bag = MeshBuilder.CreateBox(
        `sandbag_staging_${i}`,
        { width: 5, height: 1.2, depth: 1 },
        this.scene
      );
      bag.material = sandbagMat;
      bag.position.set(pos.x, 0.6, pos.z);
      bag.rotation.y = pos.rot;
      sandbags.push(bag);
      this.allMeshes.push(bag);
    }

    // Supply crates
    const crateMat = new StandardMaterial('crateMat', this.scene);
    crateMat.diffuseColor = Color3.FromHexString(ENV_COLORS.crate);

    for (let i = 0; i < 6; i++) {
      const crate = MeshBuilder.CreateBox(
        `crate_staging_${i}`,
        {
          width: 1.2 + Math.random() * 0.5,
          height: 0.8 + Math.random() * 0.4,
          depth: 1.0 + Math.random() * 0.3,
        },
        this.scene
      );
      crate.material = crateMat;
      crate.position.set(
        -12 + Math.random() * 8,
        0.4 + Math.random() * 0.2,
        -15 - Math.random() * 10
      );
      crate.rotation.y = Math.random() * 0.3;
      crates.push(crate);
      this.allMeshes.push(crate);
    }

    // Staging area perimeter lights
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const radius = 25;
      const perimeterLight = new PointLight(
        `perimLight_${i}`,
        new Vector3(Math.cos(angle) * radius, 5, -20 + Math.sin(angle) * radius),
        this.scene
      );
      perimeterLight.diffuse = new Color3(1.0, 0.9, 0.7);
      perimeterLight.intensity = 5;
      perimeterLight.range = 20;
      lights.push(perimeterLight);
      this.allLights.push(perimeterLight);
    }

    return { vehicleBay, briefingPlatform, sandbags, crates, lights };
  }

  // ============================================================================
  // OPEN FIELD (z: -50 to -400)
  // ============================================================================

  /**
   * Create cover objects scattered across the open field
   */
  createFieldCover(): Fortification[] {
    const fortifications: Fortification[] = [];

    const rockMat = new StandardMaterial('rockMat', this.scene);
    rockMat.diffuseColor = Color3.FromHexString(ENV_COLORS.terrainRock);
    rockMat.specularColor = new Color3(0.05, 0.04, 0.03);

    // Large boulders for vehicle cover
    const boulderPositions = [
      new Vector3(-40, 0, -100),
      new Vector3(30, 0, -150),
      new Vector3(-20, 0, -200),
      new Vector3(50, 0, -250),
      new Vector3(-55, 0, -300),
      new Vector3(15, 0, -350),
      new Vector3(-35, 0, -180),
      new Vector3(45, 0, -280),
    ];

    for (let i = 0; i < boulderPositions.length; i++) {
      const size = 3 + Math.random() * 4;
      const boulder = MeshBuilder.CreateSphere(
        `boulder_${i}`,
        {
          diameterX: size * (0.8 + Math.random() * 0.4),
          diameterY: size * (0.5 + Math.random() * 0.3),
          diameterZ: size * (0.8 + Math.random() * 0.4),
          segments: 8,
        },
        this.scene
      );
      boulder.material = rockMat;
      boulder.position = boulderPositions[i].clone();
      boulder.position.y = size * 0.2;
      boulder.rotation.y = Math.random() * Math.PI;

      fortifications.push({
        mesh: boulder,
        position: boulder.position.clone(),
        type: 'rock',
        provideCover: true,
      });
      this.allMeshes.push(boulder);
    }

    // Terrain ridges (elongated boxes for natural cover)
    for (let i = 0; i < 5; i++) {
      const ridge = MeshBuilder.CreateBox(
        `ridge_${i}`,
        {
          width: 15 + Math.random() * 10,
          height: 1.5 + Math.random() * 1,
          depth: 2 + Math.random(),
        },
        this.scene
      );
      ridge.material = rockMat;
      ridge.position.set(
        (Math.random() - 0.5) * 100,
        0.5,
        -80 - i * 60 - Math.random() * 30
      );
      ridge.rotation.y = (Math.random() - 0.5) * 0.4;

      fortifications.push({
        mesh: ridge,
        position: ridge.position.clone(),
        type: 'rock',
        provideCover: true,
      });
      this.allMeshes.push(ridge);
    }

    return fortifications;
  }

  /**
   * Create destroyed vehicle wrecks (decorative)
   */
  createDestroyedVehicles(): DestroyedVehicle[] {
    const wrecks: DestroyedVehicle[] = [];

    const burntMat = new StandardMaterial('burntMat', this.scene);
    burntMat.diffuseColor = Color3.FromHexString(ENV_COLORS.burntMetal);
    burntMat.specularColor = new Color3(0.02, 0.02, 0.02);

    const rustMat = new StandardMaterial('rustMat', this.scene);
    rustMat.diffuseColor = Color3.FromHexString(ENV_COLORS.rust);

    // Warthog wreck - overturned
    const warthogBody = MeshBuilder.CreateBox(
      'wreck_warthog',
      { width: 3, height: 1.5, depth: 5 },
      this.scene
    );
    warthogBody.material = burntMat;
    warthogBody.position.set(-30, 1.2, -120);
    warthogBody.rotation.set(0.3, 0.5, Math.PI * 0.7);
    this.allMeshes.push(warthogBody);

    // Add scorch marks around wreck
    const scorch1 = MeshBuilder.CreateDisc(
      'scorch_warthog',
      { radius: 4, tessellation: 8 },
      this.scene
    );
    const scorchMat = new StandardMaterial('scorchMat', this.scene);
    scorchMat.diffuseColor = Color3.FromHexString(ENV_COLORS.scorchBlack);
    scorchMat.alpha = 0.6;
    scorch1.material = scorchMat;
    scorch1.position.set(-30, 0.05, -120);
    scorch1.rotation.x = Math.PI / 2;
    this.allMeshes.push(scorch1);

    wrecks.push({
      mesh: warthogBody,
      position: warthogBody.position.clone(),
      type: 'warthog',
    });

    // Scorpion wreck - blown turret
    const scorpionHull = MeshBuilder.CreateBox(
      'wreck_scorpion_hull',
      { width: 4, height: 2, depth: 7 },
      this.scene
    );
    scorpionHull.material = rustMat;
    scorpionHull.position.set(40, 1, -230);
    scorpionHull.rotation.y = -0.3;
    this.allMeshes.push(scorpionHull);

    const scorpionTurret = MeshBuilder.CreateBox(
      'wreck_scorpion_turret',
      { width: 2, height: 1.5, depth: 2 },
      this.scene
    );
    scorpionTurret.material = burntMat;
    scorpionTurret.position.set(44, 0.5, -228);
    scorpionTurret.rotation.set(0.4, 1.2, 0.2);
    this.allMeshes.push(scorpionTurret);

    wrecks.push({
      mesh: scorpionHull,
      position: scorpionHull.position.clone(),
      type: 'scorpion',
    });

    // Pelican wreck - crashed into ridge
    const pelicanBody = MeshBuilder.CreateBox(
      'wreck_pelican',
      { width: 6, height: 4, depth: 14 },
      this.scene
    );
    pelicanBody.material = burntMat;
    pelicanBody.position.set(-50, 2, -320);
    pelicanBody.rotation.set(-0.15, 0.8, 0.1);
    this.allMeshes.push(pelicanBody);

    // Pelican wing debris
    const wing = MeshBuilder.CreateBox(
      'wreck_pelican_wing',
      { width: 8, height: 0.3, depth: 3 },
      this.scene
    );
    wing.material = rustMat;
    wing.position.set(-42, 0.5, -315);
    wing.rotation.set(0.1, 1.5, 0.3);
    this.allMeshes.push(wing);

    wrecks.push({
      mesh: pelicanBody,
      position: pelicanBody.position.clone(),
      type: 'pelican',
    });

    return wrecks;
  }

  /**
   * Create AA turret emplacements (destructible objectives in Phase 2)
   */
  createAATurrets(): AATurret[] {
    const turrets: AATurret[] = [];

    const turretPositions = [
      new Vector3(-60, 0, -180),
      new Vector3(55, 0, -220),
      new Vector3(-45, 0, -300),
      new Vector3(65, 0, -340),
    ];

    const baseMat = new StandardMaterial('turretBaseMat', this.scene);
    baseMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinDark);
    baseMat.specularColor = new Color3(0.08, 0.06, 0.08);

    const barrelMat = new StandardMaterial('turretBarrelMat', this.scene);
    barrelMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinRed);
    barrelMat.emissiveColor = new Color3(0.15, 0.05, 0.05);

    for (let i = 0; i < turretPositions.length; i++) {
      const rootNode = new TransformNode(`aaTurret_${i}`, this.scene);
      rootNode.position = turretPositions[i].clone();
      this.allNodes.push(rootNode);

      // Organic base platform
      const base = MeshBuilder.CreateCylinder(
        `turretBase_${i}`,
        { height: 3, diameterTop: 4, diameterBottom: 6, tessellation: 8 },
        this.scene
      );
      base.material = baseMat;
      base.position.y = 1.5;
      base.parent = rootNode;
      this.allMeshes.push(base);

      // Barrel assembly
      const barrel = MeshBuilder.CreateCylinder(
        `turretBarrel_${i}`,
        { height: 5, diameterTop: 0.4, diameterBottom: 0.8, tessellation: 6 },
        this.scene
      );
      barrel.material = barrelMat;
      barrel.position.y = 3.5;
      barrel.rotation.x = -Math.PI / 4;
      barrel.parent = rootNode;
      this.allMeshes.push(barrel);

      // Organic growths around base
      for (let g = 0; g < 4; g++) {
        const growth = MeshBuilder.CreateSphere(
          `turretGrowth_${i}_${g}`,
          {
            diameterX: 1.5 + Math.random(),
            diameterY: 0.8 + Math.random() * 0.5,
            diameterZ: 1.5 + Math.random(),
            segments: 6,
          },
          this.scene
        );
        growth.material = baseMat;
        const gAngle = (g / 4) * Math.PI * 2;
        growth.position.set(Math.cos(gAngle) * 3.5, 0.5, Math.sin(gAngle) * 3.5);
        growth.parent = rootNode;
        this.allMeshes.push(growth);
      }

      // Turret warning light
      const warningLight = new PointLight(
        `turretLight_${i}`,
        turretPositions[i].add(new Vector3(0, 5, 0)),
        this.scene
      );
      warningLight.diffuse = new Color3(1, 0.2, 0.1);
      warningLight.intensity = 3;
      warningLight.range = 15;
      this.allLights.push(warningLight);

      turrets.push({
        rootNode,
        baseMesh: base,
        barrelMesh: barrel,
        position: turretPositions[i].clone(),
        health: 200,
        maxHealth: 200,
        destroyed: false,
        fireTimer: 0,
      });
    }

    return turrets;
  }

  // ============================================================================
  // BREACH POINT (z: -400 to -550)
  // ============================================================================

  /**
   * Create fortifications around the hive entrance breach point
   */
  createBreachFortifications(): Fortification[] {
    const fortifications: Fortification[] = [];

    const barrierMat = new StandardMaterial('barrierMat', this.scene);
    barrierMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinPurple);

    const sandbagMat = new StandardMaterial('breachSandbagMat', this.scene);
    sandbagMat.diffuseColor = Color3.FromHexString(ENV_COLORS.sandbag);

    // Chitin barriers flanking the approach
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const depth = -420 - Math.floor(i / 2) * 30;

      const barrier = MeshBuilder.CreateBox(
        `breachBarrier_${i}`,
        {
          width: 6 + Math.random() * 3,
          height: 2.5 + Math.random(),
          depth: 1.5 + Math.random(),
        },
        this.scene
      );
      barrier.material = barrierMat;
      barrier.position.set(side * (20 + Math.random() * 10), 1.2, depth);
      barrier.rotation.y = side * 0.2 + (Math.random() - 0.5) * 0.3;

      fortifications.push({
        mesh: barrier,
        position: barrier.position.clone(),
        type: 'barrier',
        provideCover: true,
      });
      this.allMeshes.push(barrier);
    }

    // Sandbag positions for marine cover
    const coverPositions = [
      new Vector3(-10, 0.5, -430),
      new Vector3(10, 0.5, -430),
      new Vector3(0, 0.5, -460),
      new Vector3(-15, 0.5, -480),
      new Vector3(15, 0.5, -480),
      new Vector3(0, 0.5, -510),
    ];

    for (let i = 0; i < coverPositions.length; i++) {
      const sandbag = MeshBuilder.CreateBox(
        `breachSandbag_${i}`,
        { width: 4, height: 1.2, depth: 1 },
        this.scene
      );
      sandbag.material = sandbagMat;
      sandbag.position = coverPositions[i];

      fortifications.push({
        mesh: sandbag,
        position: sandbag.position.clone(),
        type: 'sandbag',
        provideCover: true,
      });
      this.allMeshes.push(sandbag);
    }

    return fortifications;
  }

  /**
   * Create acid pools and spore vents near the breach
   */
  createHazards(): { acidPools: Mesh[]; sporeVents: Mesh[] } {
    const acidPools: Mesh[] = [];
    const sporeVents: Mesh[] = [];

    const acidMat = new StandardMaterial('acidMat', this.scene);
    acidMat.diffuseColor = Color3.FromHexString(ENV_COLORS.acidGreen);
    acidMat.emissiveColor = new Color3(0.1, 0.4, 0.1);
    acidMat.alpha = 0.7;

    const ventMat = new StandardMaterial('ventMat', this.scene);
    ventMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinDark);
    ventMat.emissiveColor = Color3.FromHexString(ENV_COLORS.sporeYellow).scale(0.3);

    // Acid pools near breach
    const acidPositions = [
      new Vector3(-25, 0.02, -450),
      new Vector3(30, 0.02, -470),
      new Vector3(-10, 0.02, -520),
      new Vector3(20, 0.02, -540),
    ];

    for (let i = 0; i < acidPositions.length; i++) {
      const pool = MeshBuilder.CreateDisc(
        `acidPool_${i}`,
        { radius: 3 + Math.random() * 2, tessellation: 10 },
        this.scene
      );
      pool.material = acidMat;
      pool.position = acidPositions[i];
      pool.rotation.x = Math.PI / 2;
      acidPools.push(pool);
      this.allMeshes.push(pool);
    }

    // Spore vents
    const ventPositions = [
      new Vector3(-35, 0, -480),
      new Vector3(40, 0, -500),
      new Vector3(-5, 0, -550),
    ];

    for (let i = 0; i < ventPositions.length; i++) {
      const vent = MeshBuilder.CreateCylinder(
        `sporeVent_${i}`,
        { height: 2, diameterTop: 1.5, diameterBottom: 2.5, tessellation: 8 },
        this.scene
      );
      vent.material = ventMat;
      vent.position = ventPositions[i];
      vent.position.y = 1;
      sporeVents.push(vent);
      this.allMeshes.push(vent);

      // Vent glow light
      const ventLight = new PointLight(
        `ventLight_${i}`,
        ventPositions[i].add(new Vector3(0, 2.5, 0)),
        this.scene
      );
      ventLight.diffuse = Color3.FromHexString(ENV_COLORS.sporeYellow);
      ventLight.intensity = 4;
      ventLight.range = 10;
      this.allLights.push(ventLight);
    }

    return { acidPools, sporeVents };
  }

  // ============================================================================
  // HIVE ENTRANCE (z: -550 to -650)
  // ============================================================================

  /**
   * Create the massive organic hive gate
   */
  createHiveEntrance(): HiveEntrance {
    const organicGrowths: Mesh[] = [];
    const bioLights: HiveEntrance['bioLights'] = [];
    const sporeVents: Mesh[] = [];

    const chitinMat = new StandardMaterial('hiveGateMat', this.scene);
    chitinMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinDark);
    chitinMat.specularColor = new Color3(0.08, 0.06, 0.1);

    const archMat = new StandardMaterial('archMat', this.scene);
    archMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinPurple);
    archMat.specularColor = new Color3(0.06, 0.04, 0.08);

    // Main gate - massive organic archway (50m tall)
    const gateMesh = MeshBuilder.CreateBox(
      'hiveGate',
      { width: 40, height: 50, depth: 8 },
      this.scene
    );
    gateMesh.material = chitinMat;
    gateMesh.position.set(0, 25, -600);
    this.allMeshes.push(gateMesh);

    // Left arch pillar
    const archLeft = MeshBuilder.CreateCylinder(
      'archLeft',
      { height: 55, diameterTop: 6, diameterBottom: 10, tessellation: 10 },
      this.scene
    );
    archLeft.material = archMat;
    archLeft.position.set(-25, 27.5, -600);
    // Slight organic lean
    archLeft.rotation.z = 0.08;
    this.allMeshes.push(archLeft);

    // Right arch pillar
    const archRight = MeshBuilder.CreateCylinder(
      'archRight',
      { height: 55, diameterTop: 6, diameterBottom: 10, tessellation: 10 },
      this.scene
    );
    archRight.material = archMat;
    archRight.position.set(25, 27.5, -600);
    archRight.rotation.z = -0.08;
    this.allMeshes.push(archRight);

    // Organic growths on pillars and gate
    const growthMat = new StandardMaterial('hiveGrowthMat', this.scene);
    growthMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinPurple);
    growthMat.emissiveColor = Color3.FromHexString(ENV_COLORS.bioGlowDim).scale(0.2);

    for (let i = 0; i < 20; i++) {
      const growth = MeshBuilder.CreateSphere(
        `hiveGrowth_${i}`,
        {
          diameterX: 1 + Math.random() * 2,
          diameterY: 0.8 + Math.random() * 1.5,
          diameterZ: 1 + Math.random() * 2,
          segments: 6,
        },
        this.scene
      );
      growth.material = growthMat;

      // Distribute along the gate and pillars
      const side = Math.random() > 0.5 ? 1 : -1;
      growth.position.set(
        side * (15 + Math.random() * 15),
        2 + Math.random() * 45,
        -598 + (Math.random() - 0.5) * 6
      );

      organicGrowths.push(growth);
      this.allMeshes.push(growth);
    }

    // Bioluminescent lights along the entrance
    const bioMat = new StandardMaterial('bioLightMat', this.scene);
    bioMat.emissiveColor = Color3.FromHexString(ENV_COLORS.bioGlow);
    bioMat.disableLighting = true;

    for (let i = 0; i < 10; i++) {
      const bulb = MeshBuilder.CreateSphere(
        `bioLight_${i}`,
        { diameter: 0.4 + Math.random() * 0.3, segments: 8 },
        this.scene
      );
      bulb.material = bioMat;

      const side = i % 2 === 0 ? -1 : 1;
      const height = 3 + (i / 10) * 40;
      bulb.position.set(
        side * (18 + Math.random() * 5),
        height,
        -598 + Math.random() * 2
      );

      const light = new PointLight(
        `bioLightPL_${i}`,
        bulb.position.clone(),
        this.scene
      );
      light.diffuse = Color3.FromHexString(ENV_COLORS.bioGlow);
      light.intensity = 2 + Math.random() * 2;
      light.range = 8;

      bioLights.push({
        mesh: bulb,
        light,
        baseIntensity: light.intensity,
        flickerPhase: Math.random() * Math.PI * 2,
      });

      this.allMeshes.push(bulb);
      this.allLights.push(light);
    }

    // Spore vents at the base of the entrance
    const sporeVentMat = new StandardMaterial('entranceVentMat', this.scene);
    sporeVentMat.diffuseColor = Color3.FromHexString(ENV_COLORS.chitinDark);
    sporeVentMat.emissiveColor = Color3.FromHexString(ENV_COLORS.sporeYellow).scale(0.2);

    for (let i = 0; i < 4; i++) {
      const vent = MeshBuilder.CreateCylinder(
        `entranceVent_${i}`,
        { height: 1.5, diameterTop: 1, diameterBottom: 2, tessellation: 6 },
        this.scene
      );
      vent.material = sporeVentMat;
      vent.position.set(
        (i % 2 === 0 ? -1 : 1) * (10 + i * 3),
        0.75,
        -590 - Math.random() * 5
      );
      sporeVents.push(vent);
      this.allMeshes.push(vent);
    }

    return {
      gateMesh,
      archLeft,
      archRight,
      organicGrowths,
      bioLights,
      sporeVents,
    };
  }

  // ============================================================================
  // CANYON WALLS (Battlefield boundaries)
  // ============================================================================

  /**
   * Create canyon walls that define the battlefield boundaries
   */
  createCanyonWalls(): Mesh[] {
    const walls: Mesh[] = [];

    const wallMat = new StandardMaterial('canyonWallMat', this.scene);
    wallMat.diffuseColor = Color3.FromHexString(ENV_COLORS.terrainRock);
    wallMat.specularColor = new Color3(0.03, 0.03, 0.02);

    // Left wall segments
    for (let i = 0; i < 7; i++) {
      const wall = MeshBuilder.CreateBox(
        `canyonWallL_${i}`,
        {
          width: 25 + Math.random() * 15,
          height: 60 + Math.random() * 30,
          depth: 80 + Math.random() * 40,
        },
        this.scene
      );
      wall.material = wallMat;
      wall.position.set(
        -(TERRAIN_WIDTH / 2 + 5) + (Math.random() - 0.5) * 10,
        30,
        -i * 100 - 20
      );
      walls.push(wall);
      this.allMeshes.push(wall);
    }

    // Right wall segments
    for (let i = 0; i < 7; i++) {
      const wall = MeshBuilder.CreateBox(
        `canyonWallR_${i}`,
        {
          width: 25 + Math.random() * 15,
          height: 60 + Math.random() * 30,
          depth: 80 + Math.random() * 40,
        },
        this.scene
      );
      wall.material = wallMat;
      wall.position.set(
        TERRAIN_WIDTH / 2 + 5 + (Math.random() - 0.5) * 10,
        30,
        -i * 100 - 20
      );
      walls.push(wall);
      this.allMeshes.push(wall);
    }

    return walls;
  }

  // ============================================================================
  // PARTICLE / ATMOSPHERIC HELPERS
  // ============================================================================

  /**
   * Update bioluminescent lights with flickering effect
   */
  updateBioLights(bioLights: HiveEntrance['bioLights'], time: number): void {
    for (const bio of bioLights) {
      const flicker = Math.sin(time * 1.5 + bio.flickerPhase) * 0.2 + 0.8;
      bio.light.intensity = bio.baseIntensity * flicker;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    for (const mesh of this.allMeshes) {
      mesh.dispose();
    }
    this.allMeshes = [];

    for (const light of this.allLights) {
      light.dispose();
    }
    this.allLights = [];

    for (const node of this.allNodes) {
      node.dispose();
    }
    this.allNodes = [];

    this.glowLayer?.dispose();
    this.glowLayer = null;

    this.terrainMesh = null;
    this.skyDome = null;
  }
}
