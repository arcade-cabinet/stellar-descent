/**
 * LandfallLevel HALO Drop Mechanics
 * Freefall, asteroid dodging, descent physics, and visual effects.
 *
 * Key Features:
 * - Procedural asteroid spawning with GLB models
 * - Multi-type asteroids (rock, ice, metal) with distinct trails
 * - Distant threat vehicles for atmosphere
 * - Re-entry particle effects (plasma, smoke, heat distortion)
 * - Wind streak speed indicators
 */

import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import type { Scene } from '@babylonjs/core/scene';

import { AssetManager } from '../../core/AssetManager';
import { getAudioManager } from '../../core/AudioManager';
import type {
  Asteroid,
  AsteroidType,
  DistantThreat,
  DistantThreatDefinition,
  DistantSpaceship,
  DistantSpaceshipDefinition,
  DistantSpaceshipType,
} from './types';
import { ASTEROID_GLB_PATHS, SPACESHIP_GLB_PATHS } from './constants';

// ---------------------------------------------------------------------------
// Particle Texture Creation
// ---------------------------------------------------------------------------

/**
 * Creates a procedural particle texture for effects.
 */
export function createParticleTexture(scene: Scene): Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new Texture(
    canvas.toDataURL(),
    scene,
    false,
    true,
    Texture.BILINEAR_SAMPLINGMODE
  );
  texture.name = 'landfallParticleTexture';
  return texture;
}

// ---------------------------------------------------------------------------
// Asteroid Management
// ---------------------------------------------------------------------------

/**
 * Get a random asteroid GLB path based on type.
 */
export function getAsteroidGlbPath(type: AsteroidType): string {
  const rockPaths = [
    ASTEROID_GLB_PATHS.rockMedium1,
    ASTEROID_GLB_PATHS.rockMedium2,
    ASTEROID_GLB_PATHS.rockMedium3,
    ASTEROID_GLB_PATHS.rockTall1,
    ASTEROID_GLB_PATHS.rockTall2,
    ASTEROID_GLB_PATHS.rockTall3,
  ];

  if (type === 'rock') {
    const allRockPaths = [...rockPaths, ASTEROID_GLB_PATHS.boulder];
    return allRockPaths[Math.floor(Math.random() * allRockPaths.length)];
  } else {
    const smallerRocks = [
      ASTEROID_GLB_PATHS.rockMedium1,
      ASTEROID_GLB_PATHS.rockMedium2,
      ASTEROID_GLB_PATHS.rockMedium3,
    ];
    return smallerRocks[Math.floor(Math.random() * smallerRocks.length)];
  }
}

/**
 * Spawns a new asteroid in the debris field.
 */
export function spawnAsteroid(
  scene: Scene,
  asteroidId: number,
  particleTexture: Texture | null
): Asteroid | null {
  // Determine asteroid type for visual variety
  const typeRoll = Math.random();
  let asteroidType: AsteroidType;
  if (typeRoll < 0.6) {
    asteroidType = 'rock';
  } else if (typeRoll < 0.85) {
    asteroidType = 'ice';
  } else {
    asteroidType = 'metal';
  }

  const size = 0.8 + Math.random() * 2.5;
  const glbPath = getAsteroidGlbPath(asteroidType);

  const asteroidNode = AssetManager.createInstanceByPath(
    glbPath,
    `ast_glb_${asteroidId}`,
    scene,
    true,
    'environment'
  );

  if (!asteroidNode) {
    throw new Error(`[LandfallLevel] Failed to create asteroid from: ${glbPath}`);
  }

  // Random rotation for variety
  asteroidNode.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  asteroidNode.scaling.setAll(size * 0.4);

  // Spawn position
  const spawnClose = Math.random() < 0.15;
  const spawnDistance = spawnClose ? 60 : 120 + Math.random() * 40;
  const lateralSpread = spawnClose ? 25 : 50;

  asteroidNode.position.set(
    (Math.random() - 0.5) * lateralSpread,
    -spawnDistance,
    (Math.random() - 0.5) * lateralSpread
  );

  // Velocity varies by size
  const speedFactor = 1.5 - size / 3;
  const baseSpeed = 35 + Math.random() * 25;

  // Create trail for larger asteroids
  let trail: ParticleSystem | undefined;
  if (size > 2.0 && particleTexture) {
    trail = createAsteroidTrail(asteroidNode, asteroidType, scene, particleTexture);
  }

  // Play distant rumble for large asteroids
  if (size > 2.0) {
    getAudioManager().play('asteroid_rumble', { volume: 0.2 + size * 0.05 });
  }

  return {
    mesh: asteroidNode,
    velocity: new Vector3(
      (Math.random() - 0.5) * 8,
      baseSpeed * speedFactor,
      (Math.random() - 0.5) * 8
    ),
    rotationSpeed: new Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3),
    passed: false,
    size,
    trail,
    type: asteroidType,
  };
}

/**
 * Creates a particle trail for larger asteroids.
 */
export function createAsteroidTrail(
  asteroid: Mesh | TransformNode,
  type: AsteroidType,
  scene: Scene,
  particleTexture: Texture
): ParticleSystem {
  const trail = new ParticleSystem(`asteroidTrail_${asteroid.name}`, 50, scene);
  trail.particleTexture = particleTexture;

  trail.emitter = asteroid.position.clone();
  trail.minEmitBox = new Vector3(-0.2, -0.2, -0.2);
  trail.maxEmitBox = new Vector3(0.2, 0.2, 0.2);

  trail.direction1 = new Vector3(-0.5, -2, -0.5);
  trail.direction2 = new Vector3(0.5, -4, 0.5);

  switch (type) {
    case 'rock':
      trail.color1 = new Color4(0.5, 0.4, 0.3, 0.5);
      trail.color2 = new Color4(0.4, 0.3, 0.2, 0.3);
      trail.colorDead = new Color4(0.2, 0.15, 0.1, 0);
      break;
    case 'ice':
      trail.color1 = new Color4(0.7, 0.8, 1, 0.6);
      trail.color2 = new Color4(0.6, 0.7, 0.9, 0.4);
      trail.colorDead = new Color4(0.4, 0.5, 0.7, 0);
      break;
    case 'metal':
      trail.color1 = new Color4(1, 0.6, 0.2, 0.5);
      trail.color2 = new Color4(0.8, 0.4, 0.1, 0.3);
      trail.colorDead = new Color4(0.4, 0.2, 0.05, 0);
      break;
  }

  trail.minSize = 0.1;
  trail.maxSize = 0.3;
  trail.minLifeTime = 0.3;
  trail.maxLifeTime = 0.6;

  trail.emitRate = 30;
  trail.minEmitPower = 2;
  trail.maxEmitPower = 5;

  trail.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  trail.gravity = new Vector3(0, 0, 0);

  trail.start();
  return trail;
}

// ---------------------------------------------------------------------------
// Distant Threat Definitions
// ---------------------------------------------------------------------------

/**
 * Default distant threat definitions.
 */
export const DISTANT_THREAT_DEFINITIONS: DistantThreatDefinition[] = [
  {
    type: 'wraith',
    position: new Vector3(-80, -40, -60),
    velocity: new Vector3(8, 0, 3),
    rotationSpeed: 0.2,
    scale: 10,
  },
  {
    type: 'phantom',
    position: new Vector3(100, -30, -80),
    velocity: new Vector3(-5, 1, 4),
    rotationSpeed: 0.15,
    scale: 12,
  },
  {
    type: 'wraith',
    position: new Vector3(50, -60, 70),
    velocity: new Vector3(-3, 0.5, -2),
    rotationSpeed: 0.25,
    scale: 8,
  },
];

/**
 * Spawns distant alien vehicle threats.
 */
export function spawnDistantThreat(
  scene: Scene,
  def: DistantThreatDefinition,
  index: number
): DistantThreat | null {
  const instance = AssetManager.createInstance(
    'vehicles',
    def.type,
    `distant_${def.type}_${index}`,
    scene
  );

  if (!instance) {
    throw new Error(`[Landfall] Failed to create distant threat GLB instance for ${def.type} - asset not loaded`);
  }

  instance.position = def.position.clone();
  instance.scaling.setAll(def.scale);
  instance.setEnabled(true);

  return {
    node: instance,
    position: def.position.clone(),
    velocity: def.velocity,
    rotationSpeed: def.rotationSpeed,
    type: def.type,
    spawnAltitude: 900,
  };
}

/**
 * Updates distant threat positions and animations.
 */
export function updateDistantThreat(threat: DistantThreat, deltaTime: number): void {
  threat.position.addInPlace(threat.velocity.scale(deltaTime));
  threat.node.position = threat.position;
  threat.node.rotation.y += threat.rotationSpeed * deltaTime;

  if (threat.type === 'phantom') {
    threat.node.position.y += Math.sin(performance.now() * 0.001) * 0.02;
  }
}

// ---------------------------------------------------------------------------
// Distant Spaceship Definitions (GLB models from spaceships/)
// ---------------------------------------------------------------------------

/**
 * Get the GLB path for a spaceship type.
 */
export function getSpaceshipGlbPath(type: DistantSpaceshipType): string {
  const pathMap: Record<DistantSpaceshipType, string> = {
    challenger: SPACESHIP_GLB_PATHS.challenger,
    dispatcher: SPACESHIP_GLB_PATHS.dispatcher,
    imperial: SPACESHIP_GLB_PATHS.imperial,
    striker: SPACESHIP_GLB_PATHS.striker,
    zenith: SPACESHIP_GLB_PATHS.zenith,
    executioner: SPACESHIP_GLB_PATHS.executioner,
    insurgent: SPACESHIP_GLB_PATHS.insurgent,
    omen: SPACESHIP_GLB_PATHS.omen,
    spitfire: SPACESHIP_GLB_PATHS.spitfire,
  };
  return pathMap[type];
}

/**
 * Default distant spaceship definitions.
 * Friendlies are human military ships providing cover during descent.
 * Hostiles are alien craft engaging with the friendlies.
 */
export const DISTANT_SPACESHIP_DEFINITIONS: DistantSpaceshipDefinition[] = [
  // Friendly escort fighters (left flank)
  {
    type: 'striker',
    position: new Vector3(-120, -20, -80),
    velocity: new Vector3(6, 0.5, 2),
    rotationSpeed: 0.1,
    scale: 8,
    isFriendly: true,
  },
  {
    type: 'challenger',
    position: new Vector3(-140, -35, -70),
    velocity: new Vector3(5, 0.3, 3),
    rotationSpeed: 0.08,
    scale: 10,
    isFriendly: true,
  },
  // Friendly capital ship (rear)
  {
    type: 'imperial',
    position: new Vector3(0, -100, -200),
    velocity: new Vector3(0, 0.2, 1),
    rotationSpeed: 0.02,
    scale: 25,
    isFriendly: true,
  },
  // Hostile interceptors (right flank)
  {
    type: 'executioner',
    position: new Vector3(100, -15, -90),
    velocity: new Vector3(-8, 0.4, 4),
    rotationSpeed: 0.15,
    scale: 7,
    isFriendly: false,
  },
  {
    type: 'omen',
    position: new Vector3(130, -40, -60),
    velocity: new Vector3(-6, 0.2, 3),
    rotationSpeed: 0.12,
    scale: 9,
    isFriendly: false,
  },
  // Hostile bomber (approaching from below)
  {
    type: 'insurgent',
    position: new Vector3(50, -80, 40),
    velocity: new Vector3(-2, 1, -5),
    rotationSpeed: 0.05,
    scale: 12,
    isFriendly: false,
  },
];

/**
 * Spawns a distant spaceship using GLB models.
 */
export function spawnDistantSpaceship(
  scene: Scene,
  def: DistantSpaceshipDefinition,
  index: number
): DistantSpaceship | null {
  const glbPath = getSpaceshipGlbPath(def.type);

  const instance = AssetManager.createInstanceByPath(
    glbPath,
    `distant_spaceship_${def.type}_${index}`,
    scene,
    true,
    'environment'
  );

  if (!instance) {
    throw new Error(`[Landfall] Failed to create distant spaceship GLB instance for ${def.type} at ${glbPath}`);
  }

  instance.position = def.position.clone();
  instance.scaling.setAll(def.scale);
  instance.setEnabled(true);

  return {
    node: instance,
    position: def.position.clone(),
    velocity: def.velocity.clone(),
    rotationSpeed: def.rotationSpeed,
    type: def.type,
    isFriendly: def.isFriendly,
  };
}

/**
 * Updates distant spaceship positions and animations.
 */
export function updateDistantSpaceship(spaceship: DistantSpaceship, deltaTime: number): void {
  spaceship.position.addInPlace(spaceship.velocity.scale(deltaTime));
  spaceship.node.position = spaceship.position;
  spaceship.node.rotation.y += spaceship.rotationSpeed * deltaTime;

  // Add subtle banking for fighters
  if (spaceship.type === 'striker' || spaceship.type === 'challenger' || spaceship.type === 'executioner') {
    spaceship.node.rotation.z = Math.sin(performance.now() * 0.0015) * 0.15;
  }

  // Add slight bobbing for capital ships
  if (spaceship.type === 'imperial' || spaceship.type === 'insurgent') {
    spaceship.node.position.y += Math.sin(performance.now() * 0.0005) * 0.05;
  }
}

// ---------------------------------------------------------------------------
// Re-entry Particle Effects
// ---------------------------------------------------------------------------

/**
 * Creates the fiery re-entry particle effect.
 */
export function createReentryParticles(
  scene: Scene,
  particleTexture: Texture
): ParticleSystem {
  const particles = new ParticleSystem('reentryParticles', 200, scene);
  particles.particleTexture = particleTexture;

  particles.emitter = new Vector3(0, -2, 0);
  particles.minEmitBox = new Vector3(-2, 0, -2);
  particles.maxEmitBox = new Vector3(2, 0, 2);

  particles.direction1 = new Vector3(-0.5, 3, -0.5);
  particles.direction2 = new Vector3(0.5, 5, 0.5);

  particles.color1 = new Color4(1, 0.8, 0.3, 1);
  particles.color2 = new Color4(1, 0.5, 0.1, 1);
  particles.colorDead = new Color4(0.5, 0.1, 0.05, 0);

  particles.minSize = 0.3;
  particles.maxSize = 0.8;
  particles.minLifeTime = 0.2;
  particles.maxLifeTime = 0.5;

  particles.emitRate = 100;
  particles.minEmitPower = 8;
  particles.maxEmitPower = 15;

  particles.blendMode = ParticleSystem.BLENDMODE_ADD;
  particles.gravity = new Vector3(0, 0, 0);

  particles.stop();
  return particles;
}

/**
 * Creates the smoke trail behind the player during descent.
 */
export function createPlayerSmokeTrail(
  scene: Scene,
  particleTexture: Texture
): ParticleSystem {
  const trail = new ParticleSystem('smokeTrail', 150, scene);
  trail.particleTexture = particleTexture;

  trail.emitter = new Vector3(0, 2, 0);
  trail.minEmitBox = new Vector3(-0.5, 0, -0.5);
  trail.maxEmitBox = new Vector3(0.5, 0, 0.5);

  trail.direction1 = new Vector3(-1, 4, -1);
  trail.direction2 = new Vector3(1, 8, 1);

  trail.color1 = new Color4(0.8, 0.8, 0.9, 0.6);
  trail.color2 = new Color4(0.6, 0.6, 0.7, 0.4);
  trail.colorDead = new Color4(0.3, 0.3, 0.35, 0);

  trail.minSize = 0.4;
  trail.maxSize = 1.2;
  trail.minLifeTime = 0.8;
  trail.maxLifeTime = 1.5;

  trail.emitRate = 40;
  trail.minEmitPower = 3;
  trail.maxEmitPower = 6;

  trail.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  trail.gravity = new Vector3(0, 0.5, 0);

  trail.start();
  return trail;
}

/**
 * Creates atmosphere streaks (speed lines).
 */
export function createAtmosphereStreaks(
  scene: Scene,
  particleTexture: Texture
): ParticleSystem {
  const streaks = new ParticleSystem('atmosphereStreaks', 100, scene);
  streaks.particleTexture = particleTexture;

  streaks.emitter = new Vector3(0, -30, 0);
  streaks.minEmitBox = new Vector3(-30, 0, -30);
  streaks.maxEmitBox = new Vector3(30, 0, 30);

  streaks.direction1 = new Vector3(-0.2, 15, -0.2);
  streaks.direction2 = new Vector3(0.2, 25, 0.2);

  streaks.color1 = new Color4(0.8, 0.9, 1, 0.4);
  streaks.color2 = new Color4(0.7, 0.8, 0.95, 0.3);
  streaks.colorDead = new Color4(0.5, 0.6, 0.8, 0);

  streaks.minSize = 0.05;
  streaks.maxSize = 0.15;
  streaks.minLifeTime = 0.3;
  streaks.maxLifeTime = 0.6;

  streaks.emitRate = 60;
  streaks.minEmitPower = 30;
  streaks.maxEmitPower = 50;

  streaks.blendMode = ParticleSystem.BLENDMODE_ADD;
  streaks.gravity = new Vector3(0, 0, 0);

  streaks.start();
  return streaks;
}

/**
 * Creates thruster exhaust particles for powered descent.
 */
export function createThrusterExhaust(
  scene: Scene,
  particleTexture: Texture
): ParticleSystem {
  const exhaust = new ParticleSystem('thrusterExhaust', 300, scene);
  exhaust.particleTexture = particleTexture;

  exhaust.emitter = new Vector3(0, -1, 0.5);
  exhaust.minEmitBox = new Vector3(-0.3, 0, -0.3);
  exhaust.maxEmitBox = new Vector3(0.3, 0, 0.3);

  exhaust.direction1 = new Vector3(-0.3, -3, -0.5);
  exhaust.direction2 = new Vector3(0.3, -1, 0.5);

  exhaust.color1 = new Color4(0.5, 0.7, 1, 1);
  exhaust.color2 = new Color4(0.3, 0.5, 1, 0.8);
  exhaust.colorDead = new Color4(0.2, 0.3, 0.8, 0);

  exhaust.minSize = 0.2;
  exhaust.maxSize = 0.5;
  exhaust.minLifeTime = 0.1;
  exhaust.maxLifeTime = 0.3;

  exhaust.emitRate = 0;
  exhaust.minEmitPower = 10;
  exhaust.maxEmitPower = 20;

  exhaust.blendMode = ParticleSystem.BLENDMODE_ADD;
  exhaust.gravity = new Vector3(0, -5, 0);

  exhaust.start();
  return exhaust;
}

// ---------------------------------------------------------------------------
// Wind Streak Meshes
// ---------------------------------------------------------------------------

/**
 * Creates wind streak meshes for visual speed indication.
 */
export function createWindStreaks(scene: Scene): Mesh[] {
  const streaks: Mesh[] = [];
  const streakMat = new StandardMaterial('windStreakMat', scene);
  streakMat.emissiveColor = new Color3(0.7, 0.8, 1);
  streakMat.alpha = 0;
  streakMat.disableLighting = true;

  for (let i = 0; i < 20; i++) {
    const streak = MeshBuilder.CreateCylinder(
      `windStreak_${i}`,
      {
        height: 8 + Math.random() * 6,
        diameterTop: 0.02,
        diameterBottom: 0.02,
        tessellation: 4,
      },
      scene
    );
    streak.material = streakMat.clone(`windStreakMat_${i}`);
    streak.rotation.x = Math.PI / 2;
    streak.isVisible = false;

    streak.position.set(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 20 - 10,
      (Math.random() - 0.5) * 30
    );

    streaks.push(streak);
  }

  return streaks;
}

/**
 * Updates wind streak positions and visibility for speed effect.
 */
export function updateWindStreaks(
  windStreaks: Mesh[],
  deltaTime: number,
  intensity: number,
  windIntensity: number,
  velocity: number,
  lateralVelocityX: number,
  lateralVelocityZ: number,
  altitude: number
): void {
  const combinedIntensity = Math.min(1, intensity + windIntensity);
  const showStreaks = combinedIntensity > 0.15;
  const velocityScale = Math.min(2, velocity / 40);

  for (let i = 0; i < windStreaks.length; i++) {
    const streak = windStreaks[i];
    streak.isVisible = showStreaks;

    if (showStreaks) {
      const streakSpeed = (25 + velocity * 0.8) * velocityScale;
      streak.position.y += streakSpeed * deltaTime;

      streak.position.x -= lateralVelocityX * deltaTime * 0.3;
      streak.position.z -= lateralVelocityZ * deltaTime * 0.3;

      if (streak.position.y > 35) {
        streak.position.y = -45 - Math.random() * 25;
        streak.position.x = (Math.random() - 0.5) * 45;
        streak.position.z = (Math.random() - 0.5) * 45;
      }

      if (streak.material) {
        const mat = streak.material as StandardMaterial;
        mat.alpha = combinedIntensity * 0.4 * velocityScale;
        const heatFactor = Math.max(0, (700 - altitude) / 300);
        mat.emissiveColor = new Color3(
          0.7 + heatFactor * 0.3,
          0.8 - heatFactor * 0.2,
          1 - heatFactor * 0.5
        );
      }

      streak.scaling.y = 1 + velocityScale * 0.5;
    }
  }
}
