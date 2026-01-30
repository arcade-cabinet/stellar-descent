import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector';
import {
  ArriveBehavior,
  EntityManager,
  EvadeBehavior,
  FleeBehavior,
  PursuitBehavior,
  SeekBehavior,
  Vehicle,
  WanderBehavior,
  Vector3 as YukaVector3,
} from 'yuka';
import { type Entity, getEntitiesInRadius, queries } from '../core/ecs';

// Convert between Babylon and Yuka vectors
function toYuka(v: BabylonVector3): YukaVector3 {
  return new YukaVector3(v.x, v.y, v.z);
}

function toBabylon(v: YukaVector3): BabylonVector3 {
  return new BabylonVector3(v.x, v.y, v.z);
}

export class AISystem {
  private entityManager: EntityManager;
  private vehicles: Map<string, Vehicle> = new Map();
  private playerEntity: Entity | null = null;

  constructor() {
    this.entityManager = new EntityManager();
  }

  setPlayer(player: Entity): void {
    this.playerEntity = player;
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
    }

    this.entityManager.add(vehicle);
    this.vehicles.set(entity.id, vehicle);
  }

  unregisterEntity(entity: Entity): void {
    const vehicle = this.vehicles.get(entity.id);
    if (vehicle) {
      this.entityManager.remove(vehicle);
      this.vehicles.delete(entity.id);
    }
  }

  update(deltaTime: number): void {
    if (!this.playerEntity?.transform) return;

    const playerPos = this.playerEntity.transform.position;

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

      // State machine for enemy AI
      if (entity.tags?.enemy) {
        if (distToPlayer < entity.ai.attackRadius) {
          // Attack state - pursue and attack
          entity.ai.state = 'attack';

          const pursuit = new PursuitBehavior(
            (() => {
              const target = new Vehicle();
              target.position = toYuka(playerPos);
              return target;
            })()
          );
          pursuit.weight = 1.0;
          vehicle.steering.add(pursuit);
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

    // Sync positions back from Yuka to Babylon
    for (const entity of queries.withAI) {
      if (!entity.transform) continue;

      const vehicle = this.vehicles.get(entity.id);
      if (!vehicle) continue;

      // Update entity position
      entity.transform.position = toBabylon(vehicle.position);
      entity.transform.position.y = 1; // Keep on ground

      // Update mesh position
      if (entity.renderable?.mesh) {
        entity.renderable.mesh.position = entity.transform.position.clone();

        // Face movement direction
        if (vehicle.velocity.length() > 0.1) {
          const rotation = Math.atan2(vehicle.velocity.x, vehicle.velocity.z);
          entity.renderable.mesh.rotation.y = rotation;
        }
      }
    }
  }
}
