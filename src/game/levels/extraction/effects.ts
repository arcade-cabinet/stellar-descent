/**
 * ExtractionLevel - Visual Effects
 *
 * Contains visual effects for collapse, explosions, debris, and dropship arrival.
 */

import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import { particleManager } from '../../effects/ParticleManager';
import {
  COLLAPSE_HEALTH_PICKUP_AMOUNTS,
  COLLAPSE_HEALTH_PICKUP_POSITIONS,
  CRUMBLING_WALL_CONFIGS,
  GLB_AMMO_BOX,
  GLB_CRUMBLING_WALL,
  GLB_SUPPLY_DROP,
  LZ_POSITION,
  SUPPLY_DROP_RADIUS,
} from './constants';
import type {
  CrumblingWall,
  DebrisChunk,
  FallingStalactite,
  HealthPickup,
  SupplyDrop,
} from './types';

// ============================================================================
// DEBRIS EFFECTS
// ============================================================================

/**
 * Spawn a debris chunk in the escape tunnel
 */
export function spawnTunnelDebris(scene: Scene, playerZ: number): DebrisChunk {
  const debris = MeshBuilder.CreatePolyhedron(
    `debris_${Date.now()}`,
    { type: Math.floor(Math.random() * 4), size: 0.3 + Math.random() * 0.5 },
    scene
  );

  const debrisMat = new StandardMaterial('debrisMat', scene);
  debrisMat.diffuseColor = new Color3(0.3, 0.2, 0.25);
  debris.material = debrisMat;

  // Spawn ahead of player
  debris.position.set(
    (Math.random() - 0.5) * 6,
    3 + Math.random() * 2,
    playerZ - 20 - Math.random() * 30
  );

  return {
    mesh: debris,
    velocity: new Vector3(
      (Math.random() - 0.5) * 2,
      -5 - Math.random() * 5,
      (Math.random() - 0.5) * 2
    ),
    rotationSpeed: new Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3),
    lifetime: 5,
  };
}

/**
 * Spawn a debris chunk during collapse sequence
 * FIX #26: Varied debris colors
 */
export function spawnCollapseDebris(
  scene: Scene,
  playerPosition: Vector3,
  originPosition?: Vector3
): DebrisChunk {
  const debris = MeshBuilder.CreatePolyhedron(
    `collapseDebris_${Date.now()}_${Math.random()}`,
    { type: Math.floor(Math.random() * 4), size: 0.5 + Math.random() * 1.5 },
    scene
  );

  // FIX #26: Vary debris colors for visual interest
  const debrisMat = new StandardMaterial(`collapseDebrisMat_${Date.now()}`, scene);
  const colorVariant = Math.random();
  if (colorVariant < 0.33) {
    debrisMat.diffuseColor = new Color3(0.4 + Math.random() * 0.1, 0.25, 0.2);
  } else if (colorVariant < 0.66) {
    debrisMat.diffuseColor = new Color3(0.35, 0.3 + Math.random() * 0.1, 0.25);
  } else {
    debrisMat.diffuseColor = new Color3(0.3, 0.2, 0.25 + Math.random() * 0.1);
  }
  debris.material = debrisMat;

  // Spawn from origin or random position near player path
  let spawnPos: Vector3;
  if (originPosition) {
    spawnPos = originPosition.clone();
    spawnPos.y = 10 + Math.random() * 20;
    spawnPos.x += (Math.random() - 0.5) * 10;
    spawnPos.z += (Math.random() - 0.5) * 10;
  } else {
    spawnPos = new Vector3(
      playerPosition.x + (Math.random() - 0.5) * 40,
      15 + Math.random() * 25,
      playerPosition.z - 20 - Math.random() * 60
    );
  }
  debris.position = spawnPos;

  return {
    mesh: debris,
    velocity: new Vector3(
      (Math.random() - 0.5) * 8,
      -8 - Math.random() * 12,
      (Math.random() - 0.5) * 8
    ),
    rotationSpeed: new Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
    lifetime: 3 + Math.random() * 2,
  };
}

/**
 * Update debris physics and check for player collision
 * Returns damage to player if hit
 */
export function updateDebris(
  debris: DebrisChunk[],
  playerPosition: Vector3,
  deltaTime: number
): { updatedDebris: DebrisChunk[]; playerDamage: number } {
  let playerDamage = 0;
  const remainingDebris: DebrisChunk[] = [];

  for (const d of debris) {
    d.mesh.position.addInPlace(d.velocity.scale(deltaTime));
    d.mesh.rotation.addInPlace(d.rotationSpeed.scale(deltaTime));
    d.lifetime -= deltaTime;

    // Check for collision with player
    const dist = Vector3.Distance(d.mesh.position, playerPosition);
    if (dist < 1.5 && d.mesh.position.y < 2) {
      playerDamage += 10;
      d.mesh.dispose();
      continue;
    }

    // Remove if expired or below ground
    if (d.lifetime <= 0 || d.mesh.position.y < -2) {
      d.mesh.dispose();
      continue;
    }

    remainingDebris.push(d);
  }

  return { updatedDebris: remainingDebris, playerDamage };
}

// ============================================================================
// STALACTITE EFFECTS
// ============================================================================

/**
 * Spawn a falling stalactite with warning shadow
 * FIX #25: Added spawn randomization
 */
export function spawnFallingStalactite(scene: Scene, playerPosition: Vector3): FallingStalactite {
  // FIX #25: Spawn in front of player path with more variance
  const angle = Math.random() * Math.PI * 2;
  const distance = 20 + Math.random() * 40;
  const spawnX = playerPosition.x + Math.cos(angle) * distance * 0.5;
  const spawnZ = playerPosition.z - 15 - Math.random() * 60 - distance * 0.3;
  const spawnY = 20 + Math.random() * 20;

  // Create stalactite mesh
  const stalactite = MeshBuilder.CreateCylinder(
    `stalactite_${Date.now()}_${Math.random()}`,
    {
      height: 4 + Math.random() * 6,
      diameterTop: 0.3 + Math.random() * 0.5,
      diameterBottom: 1.5 + Math.random() * 2,
      tessellation: 6,
    },
    scene
  );

  const stalactiteMat = new StandardMaterial(`stalactiteMat_${Date.now()}`, scene);
  stalactiteMat.diffuseColor = new Color3(
    0.35 + Math.random() * 0.1,
    0.25 + Math.random() * 0.1,
    0.3 + Math.random() * 0.1
  );
  stalactiteMat.specularColor = new Color3(0.15, 0.1, 0.1);
  stalactite.material = stalactiteMat;

  stalactite.position.set(spawnX, spawnY, spawnZ);
  stalactite.rotation.set(
    Math.random() * 0.3 - 0.15,
    Math.random() * Math.PI * 2,
    Math.random() * 0.3 - 0.15
  );

  // Create warning shadow marker
  const shadowMarker = MeshBuilder.CreateDisc(
    `shadowMarker_${Date.now()}`,
    { radius: 2 + Math.random() },
    scene
  );
  const shadowMat = new StandardMaterial(`shadowMat_${Date.now()}`, scene);
  shadowMat.diffuseColor = new Color3(0.8, 0.2, 0.1);
  shadowMat.emissiveColor = new Color3(0.6, 0.15, 0.05);
  shadowMat.alpha = 0.5;
  shadowMat.disableLighting = true;
  shadowMarker.material = shadowMat;
  shadowMarker.position.set(spawnX, 0.1, spawnZ);
  shadowMarker.rotation.x = Math.PI / 2;

  // Play dislodge sound
  getAudioManager().play('structure_groan', { volume: 0.4 });

  return {
    mesh: stalactite,
    velocity: new Vector3(
      (Math.random() - 0.5) * 2,
      -2 - Math.random() * 3,
      (Math.random() - 0.5) * 2
    ),
    rotationSpeed: new Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 1,
      (Math.random() - 0.5) * 2
    ),
    hasImpacted: false,
    shadowMarker,
  };
}

/**
 * Update falling stalactites
 * Returns damage to player and updated stalactite list
 */
export function updateFallingStalactites(
  stalactites: FallingStalactite[],
  playerPosition: Vector3,
  deltaTime: number,
  triggerShake: (intensity: number) => void
): {
  updatedStalactites: FallingStalactite[];
  playerDamage: number;
  notificationMsg: string | null;
} {
  const gravity = 15;
  let playerDamage = 0;
  let notificationMsg: string | null = null;
  const remaining: FallingStalactite[] = [];

  for (const stal of stalactites) {
    if (!stal.hasImpacted) {
      // Apply gravity
      stal.velocity.y -= gravity * deltaTime;

      // Update position
      stal.mesh.position.addInPlace(stal.velocity.scale(deltaTime));
      stal.mesh.rotation.addInPlace(stal.rotationSpeed.scale(deltaTime));

      // Update shadow marker
      if (stal.shadowMarker) {
        stal.shadowMarker.position.x = stal.mesh.position.x;
        stal.shadowMarker.position.z = stal.mesh.position.z;
        const heightAboveGround = stal.mesh.position.y;
        const urgency = Math.max(0, 1 - heightAboveGround / 25);
        const pulse = 0.3 + urgency * 0.5 + Math.sin(performance.now() / 100) * 0.2 * urgency;
        const mat = stal.shadowMarker.material as StandardMaterial;
        if (mat) mat.alpha = pulse;
      }

      // Check for ground impact
      if (stal.mesh.position.y <= 1) {
        stal.hasImpacted = true;
        stal.mesh.position.y = 0.5;

        // Impact effects
        onStalactiteImpact(stal.mesh.position.clone(), triggerShake);

        // Dispose shadow marker
        stal.shadowMarker?.dispose();
        stal.shadowMarker = null;

        // Check for player collision
        const distToPlayer = Vector3.Distance(stal.mesh.position, playerPosition);
        if (distToPlayer < 3) {
          playerDamage += 25;
          notificationMsg = 'CEILING COLLAPSE - HEAVY DAMAGE';
          triggerShake(6);
        } else if (distToPlayer < 6) {
          playerDamage += 10;
          notificationMsg = 'NEAR MISS';
          triggerShake(3);
        }
      }

      remaining.push(stal);
    } else {
      // Already impacted - fade out
      const mat = stal.mesh.material as StandardMaterial;
      if (mat && mat.alpha > 0.1) {
        mat.alpha -= deltaTime * 0.5;
        remaining.push(stal);
      } else {
        stal.mesh.dispose();
      }
    }
  }

  return { updatedStalactites: remaining, playerDamage, notificationMsg };
}

/**
 * Handle stalactite impact effects
 */
function onStalactiteImpact(position: Vector3, triggerShake: (intensity: number) => void): void {
  getAudioManager().play('debris_impact', { volume: 0.7 });
  getAudioManager().play('collapse_crack', { volume: 0.5 });
  triggerShake(4);

  particleManager.emitDustImpact(position, 3);
  particleManager.emitDebris(position, 2.5);
}

// ============================================================================
// HIVE ERUPTION EFFECTS
// ============================================================================

/**
 * Spawn a dramatic hive eruption
 */
export function spawnHiveEruption(scene: Scene, position: Vector3): Mesh {
  const eruptionMat = new StandardMaterial('eruptionMat', scene);
  eruptionMat.diffuseColor = new Color3(0.4, 0.2, 0.3);
  eruptionMat.emissiveColor = new Color3(0.6, 0.2, 0.1);

  const pillar = MeshBuilder.CreateCylinder(
    `eruption_${Date.now()}`,
    { height: 40, diameterTop: 8, diameterBottom: 15, tessellation: 8 },
    scene
  );
  pillar.material = eruptionMat;
  pillar.position = position.clone();
  pillar.position.y = -15;

  // Animate pillar rising
  const riseAnim = new Animation(
    'eruptionRise',
    'position.y',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  riseAnim.setKeys([
    { frame: 0, value: -15 },
    { frame: 30, value: 5 },
    { frame: 60, value: 3 },
  ]);
  pillar.animations = [riseAnim];
  scene.beginAnimation(pillar, 0, 60, false);

  // Emit explosion particles
  particleManager.emitExplosion(position.clone(), 2);

  return pillar;
}

// ============================================================================
// GROUND CRACKS
// ============================================================================

/**
 * Create ground crack meshes
 */
export function createGroundCracks(scene: Scene): Mesh[] {
  const crackMat = new StandardMaterial('crackMat', scene);
  crackMat.diffuseColor = new Color3(0.8, 0.3, 0.1);
  crackMat.emissiveColor = new Color3(0.9, 0.4, 0.1);

  const cracks: Mesh[] = [];

  for (let i = 0; i < 12; i++) {
    const crack = MeshBuilder.CreateBox(
      `groundCrack_${i}`,
      { width: 2 + Math.random() * 3, height: 0.3, depth: 30 + Math.random() * 40 },
      scene
    );
    crack.material = crackMat;

    const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = 50 + Math.random() * 150;
    crack.position.set(Math.cos(angle) * dist * 0.3, -0.1, LZ_POSITION.z + dist * 0.5);
    crack.rotation.y = angle + Math.PI / 2;

    cracks.push(crack);
  }

  return cracks;
}

/**
 * Update ground crack glow based on collapse intensity
 */
export function updateGroundCracks(cracks: Mesh[], collapseIntensity: number): void {
  for (const crack of cracks) {
    const mat = crack.material as StandardMaterial;
    if (mat) {
      const glowPulse = 0.5 + Math.sin(performance.now() / 200) * 0.3 * collapseIntensity;
      mat.emissiveColor = new Color3(0.9 * glowPulse, 0.4 * glowPulse, 0.1 * glowPulse);
    }
  }
}

// ============================================================================
// COLLAPSE ENVIRONMENT
// ============================================================================

/**
 * Create collapse light (ominous glow from below)
 */
export function createCollapseLight(scene: Scene): PointLight {
  const light = new PointLight('collapseLight', new Vector3(0, -10, LZ_POSITION.z), scene);
  light.diffuse = new Color3(1, 0.4, 0.1);
  light.intensity = 50;
  light.range = 200;
  return light;
}

/**
 * Update collapse light intensity
 */
export function updateCollapseLight(light: PointLight, collapseIntensity: number): void {
  light.intensity = 50 + collapseIntensity * 100;
}

// ============================================================================
// HEALTH PICKUPS
// ============================================================================

/**
 * Create health pickups along collapse escape route
 * FIX #23: Changed glow color to red/white for health clarity
 */
export function createCollapseHealthPickups(scene: Scene): HealthPickup[] {
  const pickups: HealthPickup[] = [];

  for (let i = 0; i < COLLAPSE_HEALTH_PICKUP_POSITIONS.length; i++) {
    const pickupNode = AssetManager.createInstanceByPath(
      GLB_SUPPLY_DROP,
      `healthPickup_${i}`,
      scene,
      false
    );

    if (pickupNode) {
      pickupNode.position = COLLAPSE_HEALTH_PICKUP_POSITIONS[i].clone();
      pickupNode.scaling.setAll(1.0);

      // FIX #23: Red/white glow for health pickup (medical cross colors)
      const glowLight = new PointLight(
        `pickupLight_${i}`,
        COLLAPSE_HEALTH_PICKUP_POSITIONS[i],
        scene
      );
      glowLight.diffuse = new Color3(1, 0.3, 0.3); // Red for health
      glowLight.intensity = 18;
      glowLight.range = 12;
      glowLight.parent = pickupNode;

      pickups.push({
        mesh: pickupNode as unknown as Mesh,
        collected: false,
        healAmount: COLLAPSE_HEALTH_PICKUP_AMOUNTS[i],
      });
    }
  }

  return pickups;
}

/**
 * Update health pickups - check for collection
 * Returns heal amount if collected
 */
export function updateHealthPickups(
  pickups: HealthPickup[],
  playerPosition: Vector3
): { healAmount: number; collectedPickup: HealthPickup | null } {
  for (const pickup of pickups) {
    if (pickup.collected) continue;

    const dist = Vector3.Distance(pickup.mesh.position, playerPosition);
    if (dist < 3) {
      pickup.collected = true;
      pickup.mesh.setEnabled(false);
      particleManager.emitMuzzleFlash(pickup.mesh.position.clone(), new Vector3(0, 1, 0), 0.5);
      return { healAmount: pickup.healAmount, collectedPickup: pickup };
    }
  }

  return { healAmount: 0, collectedPickup: null };
}

// ============================================================================
// CRUMBLING WALLS
// ============================================================================

/**
 * Create crumbling walls
 */
export function createCrumblingWalls(scene: Scene): CrumblingWall[] {
  const walls: CrumblingWall[] = [];

  for (let i = 0; i < CRUMBLING_WALL_CONFIGS.length; i++) {
    const config = CRUMBLING_WALL_CONFIGS[i];
    const wallNode = AssetManager.createInstanceByPath(
      GLB_CRUMBLING_WALL,
      `crumblingWall_${i}`,
      scene,
      false
    );

    if (wallNode) {
      wallNode.position = config.pos.clone();
      wallNode.position.y = 12.5;
      wallNode.rotation.y = config.rotY;
      wallNode.scaling.set(5, 8, 2);

      walls.push({
        mesh: wallNode as unknown as Mesh,
        progress: 0,
        startY: 12.5,
      });
    }
  }

  return walls;
}

/**
 * Update crumbling walls based on collapse intensity
 * FIX #24: Added easing for smoother animation
 */
export function updateCrumblingWalls(
  walls: CrumblingWall[],
  collapseIntensity: number,
  deltaTime: number,
  triggerShake: (intensity: number) => void
): void {
  for (const wall of walls) {
    const startThreshold = 0.2 + wall.progress * 0.3;
    if (collapseIntensity > startThreshold && wall.progress < 1) {
      wall.progress += deltaTime * 0.3;

      // FIX #24: Apply easing curve for smoother animation
      // Ease-in-out for more natural fall
      const easedProgress =
        wall.progress < 0.5
          ? 2 * wall.progress * wall.progress
          : 1 - (-2 * wall.progress + 2) ** 2 / 2;

      // Rotate wall forward as it falls (with easing)
      wall.mesh.rotation.x = easedProgress * (Math.PI / 2);

      // Lower the wall as it falls (accelerating)
      const fallEase = wall.progress * wall.progress; // Quadratic fall
      wall.mesh.position.y = wall.startY * (1 - fallEase * 0.6);

      // Trigger shake when wall starts falling
      if (wall.progress > 0.1 && wall.progress < 0.15) {
        triggerShake(3);
        particleManager.emitDebris(wall.mesh.position.clone(), 2);
      }

      // Impact when fully fallen
      if (wall.progress >= 0.95 && wall.progress < 1) {
        triggerShake(5);
        particleManager.emitDustImpact(wall.mesh.position.clone(), 4);
        getAudioManager().play('debris_impact', { volume: 0.6 });
      }
    }
  }
}

// ============================================================================
// OBJECTIVE MARKER
// ============================================================================

/**
 * Create objective marker at dropship location
 * FIX #28: Reduced marker height to not obscure view
 */
export function createObjectiveMarker(
  scene: Scene,
  position: Vector3
): {
  marker: Mesh;
  beacon: PointLight;
} {
  // FIX #28: Reduced height from 100 to 40 for better visibility
  const marker = MeshBuilder.CreateCylinder('objectiveMarker', { height: 40, diameter: 4 }, scene);
  const markerMat = new StandardMaterial('objectiveMarkerMat', scene);
  markerMat.emissiveColor = new Color3(0.2, 0.8, 1);
  markerMat.alpha = 0.25;
  markerMat.disableLighting = true;
  marker.material = markerMat;
  marker.position = position.clone();
  marker.position.y = 20; // Lower position

  const beacon = new PointLight('objectiveBeacon', position.clone(), scene);
  beacon.diffuse = new Color3(0.3, 0.9, 1);
  beacon.intensity = 80;
  beacon.range = 100;

  return { marker, beacon };
}

/**
 * Update objective marker pulsing
 */
export function updateObjectiveMarker(marker: Mesh, beacon: PointLight): void {
  const pulse = 0.2 + Math.sin(performance.now() / 300) * 0.1;
  const mat = marker.material as StandardMaterial;
  if (mat) mat.alpha = pulse;

  const beaconPulse = 60 + Math.sin(performance.now() / 200) * 40;
  beacon.intensity = beaconPulse;
}

// ============================================================================
// COLLAPSE AUDIO
// ============================================================================

/**
 * Update collapse audio effects
 */
export function updateCollapseAudio(
  collapseIntensity: number,
  collapseAudioTimer: number,
  structureGroanTimer: number,
  lastAlienScreamTime: number,
  deltaTime: number,
  collapseRumbleInterval: number
): {
  newAudioTimer: number;
  newGroanTimer: number;
  newScreamTime: number;
} {
  let newAudioTimer = collapseAudioTimer - deltaTime;
  let newGroanTimer = structureGroanTimer - deltaTime;
  let newScreamTime = lastAlienScreamTime;

  // Periodic deep rumble
  if (newAudioTimer <= 0) {
    newAudioTimer = collapseRumbleInterval * (1 - collapseIntensity * 0.5);
    getAudioManager().play('collapse_rumble', { volume: 0.4 + collapseIntensity * 0.3 });
  }

  // Structure groans
  if (newGroanTimer <= 0 && collapseIntensity > 0.3) {
    newGroanTimer = 5 + Math.random() * 5;
    if (Math.random() < 0.4 + collapseIntensity * 0.3) {
      getAudioManager().play('structure_groan', { volume: 0.3 });
    }
  }

  // Occasional alien death screams
  const now = performance.now();
  if (now - lastAlienScreamTime > 8000 && Math.random() < 0.02 + collapseIntensity * 0.03) {
    newScreamTime = now;
    getAudioManager().play('alien_death_scream', { volume: 0.4 + Math.random() * 0.2 });
  }

  // Random ground crack sounds
  if (Math.random() < 0.01 + collapseIntensity * 0.02) {
    getAudioManager().play('ground_crack', { volume: 0.3 + Math.random() * 0.2 });
  }

  return {
    newAudioTimer,
    newGroanTimer,
    newScreamTime,
  };
}

// ============================================================================
// SUPPLY DROPS - FIX #1, #6, #11
// ============================================================================

/**
 * Supply drop spawn positions around the LZ
 */
const SUPPLY_DROP_POSITIONS = [
  new Vector3(LZ_POSITION.x - 12, 0, LZ_POSITION.z + 8),
  new Vector3(LZ_POSITION.x + 12, 0, LZ_POSITION.z + 8),
  new Vector3(LZ_POSITION.x - 10, 0, LZ_POSITION.z - 10),
  new Vector3(LZ_POSITION.x + 10, 0, LZ_POSITION.z - 10),
];

let supplyDropIndex = 0;

/**
 * Spawn a supply drop at a predetermined position
 * FIX #1: Implement supply drop spawning
 * FIX #11: Ammo resupply between waves
 */
export async function spawnSupplyDrop(
  scene: Scene,
  type: 'health' | 'ammo'
): Promise<SupplyDrop | null> {
  const position = SUPPLY_DROP_POSITIONS[supplyDropIndex % SUPPLY_DROP_POSITIONS.length];
  supplyDropIndex++;

  const modelPath = type === 'health' ? GLB_SUPPLY_DROP : GLB_AMMO_BOX;
  const dropNode = AssetManager.createInstanceByPath(
    modelPath,
    `supplyDrop_${type}_${Date.now()}`,
    scene,
    false
  );

  if (!dropNode) return null;

  // Spawn above and drop down
  dropNode.position = position.clone();
  dropNode.position.y = 15;
  dropNode.scaling.setAll(type === 'health' ? 1.2 : 1.5);

  // Add glow light
  const glowLight = new PointLight(`supplyDropLight_${Date.now()}`, position.clone(), scene);
  glowLight.diffuse =
    type === 'health'
      ? new Color3(0.2, 1, 0.3) // Green for health
      : new Color3(1, 0.8, 0.2); // Yellow for ammo
  glowLight.intensity = 20;
  glowLight.range = 12;
  glowLight.parent = dropNode;

  // Animate drop
  const dropAnim = new Animation(
    'supplyDropFall',
    'position.y',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );

  const easing = new CubicEase();
  easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
  dropAnim.setEasingFunction(easing);

  dropAnim.setKeys([
    { frame: 0, value: 15 },
    { frame: 45, value: 0.5 },
  ]);

  dropNode.animations = [dropAnim];
  scene.beginAnimation(dropNode, 0, 45, false);

  // Play drop sound
  getAudioManager().play('drop_impact', { volume: 0.5 });

  // Emit smoke trail
  particleManager.emit('smoke', position.clone().addInPlace(new Vector3(0, 10, 0)), { scale: 0.8 });

  return {
    mesh: dropNode as unknown as Mesh,
    type,
    collected: false,
    amount: type === 'health' ? 50 : 60, // Health restore or ammo count
  };
}

/**
 * Update supply drops - check for collection
 * FIX #6: Implement supply drop collection
 */
export function updateSupplyDrops(
  supplyDrops: SupplyDrop[],
  playerPosition: Vector3
): { healthRestore: number; ammoRestore: number; collectedDrop: SupplyDrop | null } {
  for (const drop of supplyDrops) {
    if (drop.collected) continue;

    const dist = Vector3.Distance(drop.mesh.position, playerPosition);
    if (dist < SUPPLY_DROP_RADIUS) {
      drop.collected = true;
      drop.mesh.setEnabled(false);

      // Collection effect
      particleManager.emitMuzzleFlash(drop.mesh.position.clone(), new Vector3(0, 1, 0), 0.6);
      getAudioManager().play('audio_log_pickup', { volume: 0.6 });

      if (drop.type === 'health') {
        return { healthRestore: drop.amount, ammoRestore: 0, collectedDrop: drop };
      } else {
        return { healthRestore: 0, ammoRestore: drop.amount, collectedDrop: drop };
      }
    }
  }

  return { healthRestore: 0, ammoRestore: 0, collectedDrop: null };
}

/**
 * Make supply drops bob and pulse
 */
export function animateSupplyDrops(supplyDrops: SupplyDrop[], time: number): void {
  for (const drop of supplyDrops) {
    if (drop.collected) continue;

    // Gentle bob
    drop.mesh.position.y = 0.5 + Math.sin(time * 2) * 0.2;

    // Slow rotation
    drop.mesh.rotation.y += 0.02;
  }
}

// ============================================================================
// LANDING DUST
// ============================================================================

/**
 * Emit landing dust cloud effects
 */
export function emitLandingDust(position: Vector3, scale: number): void {
  // Multiple dust bursts in a ring around landing zone
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dustPos = new Vector3(
      position.x + Math.cos(angle) * 12,
      0.5,
      position.z + Math.sin(angle) * 12
    );
    particleManager.emitDustImpact(dustPos, scale);
  }

  // Center dust cloud
  particleManager.emitDebris(new Vector3(position.x, 1, position.z), scale * 0.7);
}

// ============================================================================
// FADE TO BLACK
// ============================================================================

/**
 * Animate scene fade to black
 */
export function animateFadeToBlack(
  scene: Scene,
  duration: number,
  onComplete?: () => void
): ReturnType<typeof setInterval> {
  const startColor = scene.clearColor.clone();
  const endColor = new Color4(0, 0, 0, 1);
  const startTime = performance.now();

  const fadeInterval = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / duration);

    scene.clearColor = new Color4(
      startColor.r + (endColor.r - startColor.r) * t,
      startColor.g + (endColor.g - startColor.g) * t,
      startColor.b + (endColor.b - startColor.b) * t,
      1
    );

    if (t >= 1) {
      clearInterval(fadeInterval);
      onComplete?.();
    }
  }, 16);

  return fadeInterval;
}
