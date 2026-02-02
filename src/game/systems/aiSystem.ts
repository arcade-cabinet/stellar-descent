import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 as BabylonVector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import {
  ArriveBehavior,
  EntityManager,
  FleeBehavior,
  PursuitBehavior,
  SeekBehavior,
  Vehicle,
  WanderBehavior,
  Vector3 as YukaVector3,
} from 'yuka';
import { getEnemySoundManager } from '../core/EnemySoundManager';
import { getEventBus } from '../core/EventBus';
import { createEntity, type Entity, getEntitiesInRadius, queries } from '../core/ecs';
import { getLogger } from '../core/Logger';

const log = getLogger('AISystem');

// ---------------------------------------------------------------------------
// Enemy Fire Configuration by Species
// ---------------------------------------------------------------------------

/**
 * Fire pattern configuration for different enemy types.
 * Melee-only enemies have isMeleeOnly: true
 */
interface EnemyFireConfig {
  fireRate: number; // Shots per second
  damage: number;
  projectileSpeed: number;
  projectileCount: number; // For multi-shot attacks
  spreadAngle: number; // Max spread in radians
  projectileColor: string; // Core color
  projectileGlowColor: string; // Glow color
  projectileSize: number; // Scale multiplier
  isMeleeOnly: boolean; // If true, no ranged attack
  soundId: string; // Sound to play on fire
}

const ENEMY_FIRE_CONFIGS: Record<string, EnemyFireConfig> = {
  // Skitterer: Melee only (no ranged attacks)
  skitterer: {
    fireRate: 0,
    damage: 8,
    projectileSpeed: 0,
    projectileCount: 0,
    spreadAngle: 0,
    projectileColor: '#00FF00',
    projectileGlowColor: '#00AA00',
    projectileSize: 1,
    isMeleeOnly: true,
    soundId: 'alien_melee',
  },

  // Spitter/Spewer: Acid projectile, slow rate (0.5 shots/sec = 2s between shots), high damage
  spewer: {
    fireRate: 0.5,
    damage: 25,
    projectileSpeed: 20,
    projectileCount: 1,
    spreadAngle: Math.PI / 36, // ±5 degrees
    projectileColor: '#88FF44',
    projectileGlowColor: '#44DD00',
    projectileSize: 1.3,
    isMeleeOnly: false,
    soundId: 'alien_spit',
  },

  // Lurker/Warrior: Plasma bolt, medium rate (1 shot/sec), medium damage
  lurker: {
    fireRate: 1.0,
    damage: 15,
    projectileSpeed: 35,
    projectileCount: 1,
    spreadAngle: Math.PI / 36, // ±5 degrees
    projectileColor: '#FF6644',
    projectileGlowColor: '#FF2222',
    projectileSize: 1.0,
    isMeleeOnly: false,
    soundId: 'alien_plasma',
  },

  // Husk/Heavy: Twin plasma, slow rate (0.4 shots/sec = 2.5s between shots), high damage
  husk: {
    fireRate: 0.4,
    damage: 20,
    projectileSpeed: 30,
    projectileCount: 2, // Twin shots
    spreadAngle: Math.PI / 24, // Wider spread for twin shots
    projectileColor: '#FF4488',
    projectileGlowColor: '#DD0044',
    projectileSize: 1.2,
    isMeleeOnly: false,
    soundId: 'alien_heavy',
  },

  // Stalker: Rapid fire (2 shots/sec = 0.5s between shots), low damage
  stalker: {
    fireRate: 2.0,
    damage: 8,
    projectileSpeed: 45,
    projectileCount: 1,
    spreadAngle: Math.PI / 30, // Tighter spread for rapid fire
    projectileColor: '#44AAFF',
    projectileGlowColor: '#0066FF',
    projectileSize: 0.7,
    isMeleeOnly: false,
    soundId: 'alien_rapid',
  },

  // Broodmother: Slow but devastating
  broodmother: {
    fireRate: 0.3,
    damage: 35,
    projectileSpeed: 18,
    projectileCount: 3, // Triple shot
    spreadAngle: Math.PI / 12, // Wide spread
    projectileColor: '#FF00FF',
    projectileGlowColor: '#AA00AA',
    projectileSize: 1.8,
    isMeleeOnly: false,
    soundId: 'alien_boss',
  },
};

// Default config for unknown enemy types
const DEFAULT_FIRE_CONFIG: EnemyFireConfig = {
  fireRate: 1.0,
  damage: 12,
  projectileSpeed: 30,
  projectileCount: 1,
  spreadAngle: Math.PI / 36,
  projectileColor: '#FF6644',
  projectileGlowColor: '#FF2222',
  projectileSize: 1.0,
  isMeleeOnly: false,
  soundId: 'alien_plasma',
};

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

// Convert between Babylon and Yuka vectors
function toYuka(v: BabylonVector3): YukaVector3 {
  return new YukaVector3(v.x, v.y, v.z);
}

function toBabylon(v: YukaVector3): BabylonVector3 {
  return new BabylonVector3(v.x, v.y, v.z);
}

/**
 * Get fire configuration for an enemy entity based on its species.
 */
function getFireConfig(entity: Entity): EnemyFireConfig {
  const speciesId = entity.alienInfo?.speciesId;
  if (speciesId && ENEMY_FIRE_CONFIGS[speciesId]) {
    return ENEMY_FIRE_CONFIGS[speciesId];
  }
  return DEFAULT_FIRE_CONFIG;
}

/**
 * Add random spread to a direction vector.
 * @param direction - The base direction vector (will be modified)
 * @param maxSpread - Maximum spread angle in radians
 * @returns The modified direction with spread applied
 */
function addSpread(direction: BabylonVector3, maxSpread: number): BabylonVector3 {
  if (maxSpread <= 0) return direction;

  // Random spread within ±maxSpread
  const spreadX = (Math.random() - 0.5) * 2 * maxSpread;
  const spreadY = (Math.random() - 0.5) * 2 * maxSpread;

  // Create rotation quaternion for spread
  const spreadQuat = Quaternion.FromEulerAngles(spreadY, spreadX, 0);

  // Apply rotation to direction
  const result = direction.clone();
  result.rotateByQuaternionToRef(spreadQuat, result);

  return result.normalize();
}

// ---------------------------------------------------------------------------
// AI System
// ---------------------------------------------------------------------------

export class AISystem {
  private entityManager: EntityManager;
  private vehicles: Map<string, Vehicle> = new Map();
  private playerEntity: Entity | null = null;
  private scene: Scene | null = null;

  // Track previous AI states for state change detection
  private previousStates: Map<string, string> = new Map();

  // Track last fire time per entity for cooldown management
  private lastFireTimes: Map<string, number> = new Map();

  constructor() {
    this.entityManager = new EntityManager();
  }

  /**
   * Initialize the AI system with scene reference for projectile spawning.
   */
  init(scene: Scene): void {
    this.scene = scene;
    log.info('AI System initialized with scene');
  }

  setPlayer(player: Entity): void {
    this.playerEntity = player;
    // Update enemy sound manager with player position
    if (player.transform) {
      getEnemySoundManager().setPlayerPosition(player.transform.position);
    }
  }

  registerEntity(entity: Entity): void {
    if (!entity.transform) return;

    const vehicle = new Vehicle();
    vehicle.position = toYuka(entity.transform.position);
    vehicle.maxSpeed = entity.velocity?.maxSpeed || 10;
    vehicle.maxForce = 10;

    // Set up behaviors based on entity tags
    if (entity.tags?.enemy) {
      // Enemies will wander until player is in range
      const wander = new WanderBehavior();
      wander.weight = 0.5;
      vehicle.steering.add(wander);

      // Register with enemy sound manager
      getEnemySoundManager().registerEntity(entity);
    }

    this.entityManager.add(vehicle);
    this.vehicles.set(entity.id, vehicle);

    // Initialize previous state
    if (entity.ai) {
      this.previousStates.set(entity.id, entity.ai.state);
    }

    // Initialize fire time tracking
    this.lastFireTimes.set(entity.id, 0);
  }

  unregisterEntity(entity: Entity): void {
    const vehicle = this.vehicles.get(entity.id);
    if (vehicle) {
      this.entityManager.remove(vehicle);
      this.vehicles.delete(entity.id);
    }

    // Unregister from enemy sound manager
    if (entity.tags?.enemy) {
      getEnemySoundManager().unregisterEntity(entity);
    }

    // Clean up previous state tracking
    this.previousStates.delete(entity.id);

    // Clean up fire time tracking
    this.lastFireTimes.delete(entity.id);
  }

  /**
   * Attempt to fire a projectile from an enemy toward the player.
   * Returns true if fire was successful, false if on cooldown or invalid state.
   */
  private tryEnemyFire(entity: Entity, playerPos: BabylonVector3): boolean {
    // Safety checks - entity must be alive and have required components
    if (!entity.transform || !entity.health || entity.health.current <= 0) {
      return false;
    }

    // Scene required for projectile spawning
    if (!this.scene) {
      return false;
    }

    // Get fire configuration for this enemy type
    const fireConfig = getFireConfig(entity);

    // Melee-only enemies don't fire projectiles
    if (fireConfig.isMeleeOnly) {
      return false;
    }

    // Check fire rate cooldown
    const now = performance.now();
    const lastFireTime = this.lastFireTimes.get(entity.id) ?? 0;

    // Use entity's combat fireRate if available, otherwise use config
    const effectiveFireRate = entity.combat?.fireRate ?? fireConfig.fireRate;
    const fireInterval = effectiveFireRate > 0 ? 1000 / effectiveFireRate : Infinity;

    if (now - lastFireTime < fireInterval) {
      return false; // Still on cooldown
    }

    // Double-check entity is still alive (may have died during cooldown check)
    if (!entity.health || entity.health.current <= 0) {
      return false;
    }

    // Update last fire time
    this.lastFireTimes.set(entity.id, now);

    // Calculate base direction toward player
    const enemyPos = entity.transform.position.clone();
    enemyPos.y = 1.5; // Spawn projectile at chest height

    const baseDirection = playerPos.subtract(enemyPos).normalize();

    // Spawn projectiles (may be multiple for multi-shot attacks)
    for (let i = 0; i < fireConfig.projectileCount; i++) {
      // Add spread to direction
      const direction = addSpread(baseDirection.clone(), fireConfig.spreadAngle);

      // Spawn the projectile
      this.spawnEnemyProjectile(entity, enemyPos.clone(), direction, fireConfig);
    }

    // Emit fire event for audio/effects
    const eventBus = getEventBus();
    eventBus.emit({
      type: 'WEAPON_FIRED',
      weaponId: fireConfig.soundId,
      position: enemyPos,
    });

    // Play attack sound through enemy sound manager
    getEnemySoundManager().playAttackSound(entity);

    return true;
  }

  /**
   * Spawn a single enemy projectile.
   */
  private spawnEnemyProjectile(
    _sourceEntity: Entity,
    spawnPos: BabylonVector3,
    direction: BabylonVector3,
    config: EnemyFireConfig
  ): void {
    if (!this.scene) return;

    const scene = this.scene;

    // Create plasma bolt mesh - elongated cylinder
    const boltSize = config.projectileSize;
    const plasmaBolt = MeshBuilder.CreateCylinder(
      'enemyBolt',
      {
        height: 0.8 * boltSize,
        diameterTop: 0.12 * boltSize,
        diameterBottom: 0.06 * boltSize,
        tessellation: 6,
      },
      scene
    );

    // Orient bolt toward target
    const rotationAxis = BabylonVector3.Cross(BabylonVector3.Up(), direction).normalize();
    const angle = Math.acos(BabylonVector3.Dot(BabylonVector3.Up(), direction));
    if (rotationAxis.length() > 0.001) {
      plasmaBolt.rotationQuaternion = Quaternion.RotationAxis(rotationAxis, angle);
    }

    plasmaBolt.position = spawnPos;

    // Core material
    const coreMat = new StandardMaterial('enemyCoreMat', scene);
    coreMat.emissiveColor = Color3.FromHexString(config.projectileColor);
    coreMat.disableLighting = true;
    plasmaBolt.material = coreMat;

    // Outer glow shell
    const glowShell = MeshBuilder.CreateCylinder(
      'enemyGlow',
      {
        height: 1.0 * boltSize,
        diameterTop: 0.25 * boltSize,
        diameterBottom: 0.15 * boltSize,
        tessellation: 6,
      },
      scene
    );
    glowShell.parent = plasmaBolt;
    glowShell.position = BabylonVector3.Zero();

    const glowMat = new StandardMaterial('enemyGlowMat', scene);
    glowMat.emissiveColor = Color3.FromHexString(config.projectileGlowColor);
    glowMat.disableLighting = true;
    glowMat.alpha = 0.35;
    glowShell.material = glowMat;

    // Animate glow flicker
    const boltStartTime = performance.now();
    const animateBolt = () => {
      if (plasmaBolt.isDisposed()) return;

      const elapsed = performance.now() - boltStartTime;
      const flicker = 0.25 + Math.sin(elapsed * 0.025) * 0.1 + Math.random() * 0.05;
      glowMat.alpha = flicker;

      requestAnimationFrame(animateBolt);
    };
    requestAnimationFrame(animateBolt);

    // Clean up materials when mesh is disposed
    plasmaBolt.onDisposeObservable.add(() => {
      coreMat.dispose();
      glowMat.dispose();
    });

    // Calculate velocity
    const velocity = direction.scale(config.projectileSpeed);

    // Create projectile entity
    createEntity({
      transform: {
        position: spawnPos.clone(),
        rotation: BabylonVector3.Zero(),
        scale: new BabylonVector3(1, 1, 1),
      },
      velocity: {
        linear: velocity,
        angular: BabylonVector3.Zero(),
        maxSpeed: config.projectileSpeed,
      },
      combat: {
        damage: config.damage,
        range: 100,
        fireRate: 0,
        lastFire: 0,
        projectileSpeed: config.projectileSpeed,
      },
      renderable: {
        mesh: plasmaBolt,
        visible: true,
      },
      tags: {
        projectile: true,
        enemy: true,
      },
      lifetime: {
        remaining: 4000, // 4 second lifetime
        onExpire: () => {
          plasmaBolt.dispose();
        },
      },
    });
  }

  update(deltaTime: number): void {
    if (!this.playerEntity?.transform) return;

    const playerPos = this.playerEntity.transform.position;
    const enemySoundManager = getEnemySoundManager();

    // Update player position for spatial audio
    enemySoundManager.setPlayerPosition(playerPos);

    // Update AI for each entity with AI component
    for (const entity of queries.withAI) {
      if (!entity.transform || !entity.ai) continue;

      const vehicle = this.vehicles.get(entity.id);
      if (!vehicle) {
        this.registerEntity(entity);
        continue;
      }

      // Sync position from Babylon to Yuka
      vehicle.position = toYuka(entity.transform.position);

      // Calculate distance to player
      const distToPlayer = BabylonVector3.Distance(entity.transform.position, playerPos);

      // Clear existing behaviors
      vehicle.steering.clear();

      // Track previous state for sound triggering
      const previousState = this.previousStates.get(entity.id) ?? 'patrol';

      // State machine for enemy AI
      if (entity.tags?.enemy) {
        if (distToPlayer < entity.ai.attackRadius) {
          // Attack state - pursue and attack
          entity.ai.state = 'attack';

          // Reuse a shared target vehicle or update a persistent one
          // For Yuka Pursuit, we need a moving target (Vehicle)
          // We can create a lightweight vehicle representation of the player
          const targetVehicle = new Vehicle();
          targetVehicle.position = toYuka(playerPos);
          // If we had player velocity, we'd set it here for better prediction

          const pursuit = new PursuitBehavior(targetVehicle);
          pursuit.weight = 1.0;
          vehicle.steering.add(pursuit);

          // --- ENEMY SHOOTING ---
          // When in attack state and within attack radius, attempt to fire
          this.tryEnemyFire(entity, playerPos);
        } else if (distToPlayer < entity.ai.alertRadius) {
          // Chase state
          entity.ai.state = 'chase';

          const seek = new SeekBehavior(toYuka(playerPos));
          seek.weight = 1.0;
          vehicle.steering.add(seek);
        } else {
          // Patrol state
          entity.ai.state = 'patrol';

          const wander = new WanderBehavior();
          wander.weight = 0.5;
          vehicle.steering.add(wander);
        }

        // Flee if health is low
        if (entity.health && entity.health.current < entity.health.max * 0.2) {
          entity.ai.state = 'flee';
          vehicle.steering.clear();

          const flee = new FleeBehavior(toYuka(playerPos));
          flee.weight = 2.0;
          vehicle.steering.add(flee);
        }

        // Handle AI state change sounds
        if (previousState !== entity.ai.state) {
          enemySoundManager.onAIStateChange(entity, previousState, entity.ai.state);
          this.previousStates.set(entity.id, entity.ai.state);
        }
      }

      // Ally AI (mechs)
      if (entity.tags?.ally) {
        // Find nearest enemy to attack
        const nearbyEnemies = getEntitiesInRadius(
          entity.transform.position,
          entity.ai.alertRadius,
          (e) => e.tags?.enemy === true
        );

        if (nearbyEnemies.length > 0) {
          entity.ai.state = 'attack';
          entity.ai.target = nearbyEnemies[0];

          const targetPos = nearbyEnemies[0].transform?.position;
          if (targetPos) {
            // Keep some distance for ranged attacks
            const arrive = new ArriveBehavior(toYuka(targetPos), 20);
            arrive.weight = 1.0;
            vehicle.steering.add(arrive);
          }
        } else {
          // Follow player
          entity.ai.state = 'support';

          const arrive = new ArriveBehavior(toYuka(playerPos), 15);
          arrive.weight = 0.8;
          vehicle.steering.add(arrive);
        }
      }
    }

    // Update Yuka entity manager
    this.entityManager.update(deltaTime);

    // Sync positions back from Yuka to Babylon and handle movement sounds
    for (const entity of queries.withAI) {
      if (!entity.transform) continue;

      const vehicle = this.vehicles.get(entity.id);
      if (!vehicle) continue;

      // Update entity position
      entity.transform.position = toBabylon(vehicle.position);
      entity.transform.position.y = 1; // Keep on ground

      // Check if entity is moving (for footstep sounds)
      const isMoving = vehicle.velocity.length() > 0.1;

      // Update movement sounds for enemies
      if (entity.tags?.enemy) {
        enemySoundManager.updateMovementSounds(entity, isMoving);
      }

      // Update mesh position
      if (entity.renderable?.mesh) {
        entity.renderable.mesh.position = entity.transform.position.clone();

        // Face movement direction (or face player when attacking)
        if (entity.ai?.state === 'attack' && this.playerEntity?.transform) {
          // Face the player when attacking
          const toPlayer = this.playerEntity.transform.position.subtract(entity.transform.position);
          const rotation = Math.atan2(toPlayer.x, toPlayer.z);
          entity.renderable.mesh.rotation.y = rotation;
        } else if (isMoving) {
          const rotation = Math.atan2(vehicle.velocity.x, vehicle.velocity.z);
          entity.renderable.mesh.rotation.y = rotation;
        }
      }
    }
  }

  dispose(): void {
    // Clear all entities from Yuka
    this.entityManager.clear();

    // Clear vehicle map
    this.vehicles.clear();

    // Clear previous states
    this.previousStates.clear();

    // Clear fire time tracking
    this.lastFireTimes.clear();

    // Clear player reference
    this.playerEntity = null;

    // Clear scene reference
    this.scene = null;

    log.info('AI System disposed');
  }
}
