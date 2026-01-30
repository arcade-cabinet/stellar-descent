import type { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { Player } from '../entities/player';
import { AISystem } from '../systems/aiSystem';
import { CombatSystem } from '../systems/combatSystem';
import type { TouchInput } from '../types';
import { ChunkManager } from '../world/chunkManager';

export interface GameCallbacks {
  onHealthChange: (health: number) => void;
  onKill: () => void;
  onDamage: () => void;
  onNotification: (text: string, duration?: number) => void;
}

export class GameManager {
  private scene: Scene;
  private engine: Engine;
  private canvas: HTMLCanvasElement;

  private player: Player | null = null;
  private chunkManager: ChunkManager | null = null;
  private combatSystem: CombatSystem | null = null;
  private aiSystem: AISystem | null = null;

  private callbacks: GameCallbacks;
  private isRunning = false;
  private lastTime = 0;
  private dropNotificationShown = false;

  constructor(scene: Scene, engine: Engine, canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.scene = scene;
    this.engine = engine;
    this.canvas = canvas;
    this.callbacks = callbacks;
  }

  initialize(): void {
    // Remove the default camera that was created during scene setup
    if (this.scene.activeCamera) {
      this.scene.activeCamera.dispose();
    }

    // Create player
    this.player = new Player(this.scene, this.canvas, this.engine);

    // Set player camera as the active camera
    this.scene.activeCamera = this.player.camera;

    // Create game systems
    this.chunkManager = new ChunkManager(this.scene);
    this.combatSystem = new CombatSystem(this.scene);
    this.aiSystem = new AISystem();

    // Connect systems
    this.combatSystem.setPlayer(this.player.entity);
    this.aiSystem.setPlayer(this.player.entity);

    // Set up callbacks
    this.combatSystem.onKill(() => {
      this.callbacks.onKill();
    });

    this.combatSystem.onPlayerDamage((amount) => {
      this.callbacks.onDamage();
      if (this.player?.entity.health) {
        this.callbacks.onHealthChange(this.player.entity.health.current);
      }
    });

    // Load initial chunks around spawn
    this.chunkManager.update(Vector3.Zero());

    this.isRunning = true;
    this.lastTime = performance.now();
    this.dropNotificationShown = false;

    this.callbacks.onNotification('ORBITAL DROP INITIATED', 3000);
  }

  setTouchInput(input: TouchInput | null): void {
    if (this.player) {
      this.player.setTouchInput(input);
    }
  }

  update(): void {
    if (!this.isRunning || !this.player) return;

    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Cap delta time to prevent huge jumps
    const cappedDelta = Math.min(deltaTime, 0.1);

    // Update player
    this.player.update(cappedDelta);

    // Show notification when drop completes
    if (this.player.isDropComplete && !this.dropNotificationShown) {
      this.dropNotificationShown = true;
      this.callbacks.onNotification('TOUCHDOWN - WEAPONS HOT', 3000);
    }

    // Update chunk loading based on player position
    if (this.chunkManager) {
      this.chunkManager.update(this.player.getPosition());
    }

    // Update AI system
    if (this.aiSystem) {
      this.aiSystem.update(cappedDelta);
    }

    // Update combat system
    if (this.combatSystem) {
      this.combatSystem.update(cappedDelta);
    }

    // Update health in UI
    if (this.player.entity.health) {
      this.callbacks.onHealthChange(this.player.entity.health.current);
    }
  }

  getPlayer(): Player | null {
    return this.player;
  }

  getPlayerPosition(): Vector3 {
    return this.player?.getPosition() ?? Vector3.Zero();
  }

  getPlayerHealth(): number {
    return this.player?.entity.health?.current ?? 100;
  }

  pause(): void {
    this.isRunning = false;
  }

  resume(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
  }

  dispose(): void {
    this.isRunning = false;
    this.player = null;
    this.chunkManager = null;
    this.combatSystem = null;
    this.aiSystem = null;
  }
}
