/**
 * AudioEventHandler - Wires audio to EventBus events
 *
 * Automatically plays appropriate sounds in response to game events.
 * This creates the AAA shooter feel by ensuring consistent audio feedback.
 */

import { getEventBus, type GameEvent, type GameEventListener } from '../EventBus';
import { getAudioManager } from '../AudioManager';
import { weaponSoundManager } from '../WeaponSoundManager';
import {
  hitAudioManager,
  playPlayerHitSound,
  playHeartbeat,
  playHeavyBreathing,
  playShieldBreak,
  playCriticalHealthWarning,
} from '../HitAudioManager';
import type { WeaponId } from '../../entities/weapons';

/**
 * Enemy type to sound mapping for death sounds
 */
const ENEMY_DEATH_SOUNDS: Record<string, string> = {
  skitterer: 'skitterer_death',
  spitter: 'spitter_death',
  warrior: 'warrior_death',
  heavy: 'heavy_death',
  queen: 'queen_death',
  broodmother: 'queen_death',
  drone: 'enemy_death',
  runner: 'skitterer_death',
  spewer: 'spitter_death',
  hunter: 'warrior_death',
  mech: 'mech_death',
};

/**
 * Tracks player health state for low health audio effects
 */
interface PlayerHealthState {
  currentHealth: number;
  maxHealth: number;
  isLowHealth: boolean;
  heartbeatIntervalId: ReturnType<typeof setInterval> | null;
}

/**
 * AudioEventHandler class - Singleton that manages event-driven audio
 */
export class AudioEventHandler {
  private static instance: AudioEventHandler | null = null;

  private unsubscribers: Array<() => void> = [];
  private playerHealthState: PlayerHealthState = {
    currentHealth: 100,
    maxHealth: 100,
    isLowHealth: false,
    heartbeatIntervalId: null,
  };
  private lastDamageTime = 0;
  private readonly DAMAGE_SOUND_COOLDOWN_MS = 100;

  // Combat state tracking
  private enemiesInCombat = 0;
  private lastCombatSoundTime = 0;

  private constructor() {}

  static getInstance(): AudioEventHandler {
    if (!AudioEventHandler.instance) {
      AudioEventHandler.instance = new AudioEventHandler();
    }
    return AudioEventHandler.instance;
  }

  /**
   * Initialize event subscriptions
   */
  initialize(): void {
    const bus = getEventBus();

    // Enemy killed - play appropriate death sound
    this.subscribe('ENEMY_KILLED', (event) => {
      this.handleEnemyKilled(event.enemyType, event.position);
    });

    // Player damaged - play hit sound and check for low health
    this.subscribe('PLAYER_DAMAGED', (event) => {
      this.handlePlayerDamaged(event.amount);
    });

    // Player healed - update health state
    this.subscribe('PLAYER_HEALED', (event) => {
      this.handlePlayerHealed(event.amount);
    });

    // Weapon fired - handled by existing weapon system
    this.subscribe('WEAPON_FIRED', (event) => {
      this.handleWeaponFired(event.weaponId as WeaponId, event.position);
    });

    // Weapon switched
    this.subscribe('WEAPON_SWITCHED', (event) => {
      this.handleWeaponSwitched(event.weaponId as WeaponId);
    });

    // Combat state changed
    this.subscribe('COMBAT_STATE_CHANGED', (event) => {
      this.handleCombatStateChanged(event.inCombat);
    });

    // Collectible picked up
    this.subscribe('COLLECTIBLE_PICKED_UP', (event) => {
      this.handleCollectiblePickedUp(event.collectibleType);
    });

    // Audio log found
    this.subscribe('AUDIO_LOG_FOUND', () => {
      const audioManager = getAudioManager();
      audioManager.play('audio_log_pickup');
    });

    // Secret found
    this.subscribe('SECRET_FOUND', () => {
      const audioManager = getAudioManager();
      audioManager.play('secret_found');
    });

    // Notification
    this.subscribe('NOTIFICATION', () => {
      const audioManager = getAudioManager();
      audioManager.play('notification');
    });

    // Objective updated
    this.subscribe('OBJECTIVE_UPDATED', () => {
      const audioManager = getAudioManager();
      audioManager.play('comms_open');
    });

    // Objective completed
    this.subscribe('OBJECTIVE_COMPLETED', () => {
      const audioManager = getAudioManager();
      audioManager.play('achievement_unlock');
    });

    // Checkpoint reached
    this.subscribe('CHECKPOINT_REACHED', () => {
      const audioManager = getAudioManager();
      audioManager.play('notification');
    });

    // Dialogue started
    this.subscribe('DIALOGUE_STARTED', () => {
      const audioManager = getAudioManager();
      audioManager.play('comms_open');
    });

    // Dialogue ended
    this.subscribe('DIALOGUE_ENDED', () => {
      const audioManager = getAudioManager();
      audioManager.play('comms_close');
    });

    // Vehicle entered
    this.subscribe('VEHICLE_ENTERED', (event) => {
      this.handleVehicleEntered(event.vehicleType);
    });

    // Vehicle exited
    this.subscribe('VEHICLE_EXITED', () => {
      const audioManager = getAudioManager();
      audioManager.play('door_open');
    });

    // Level started
    this.subscribe('LEVEL_STARTED', () => {
      // Reset player health state on new level
      this.setPlayerMaxHealth(100);
    });

    // Wave started
    this.subscribe('WAVE_STARTED', (event) => {
      const audioManager = getAudioManager();
      audioManager.play('notification');
      // Enter combat mode when wave starts
      audioManager.enterCombat();
    });

    // Wave completed
    this.subscribe('WAVE_COMPLETED', () => {
      const audioManager = getAudioManager();
      audioManager.play('achievement_unlock');
    });

    // Player death
    this.subscribe('PLAYER_DEATH', () => {
      const audioManager = getAudioManager();
      audioManager.playDefeat();
      this.exitLowHealthState();
    });

    // Pickup collected
    this.subscribe('PICKUP_COLLECTED', (event) => {
      this.handleCollectiblePickedUp(event.pickupType);
    });
  }

  /**
   * Subscribe to an event type with automatic cleanup tracking
   */
  private subscribe<T extends GameEvent['type']>(
    type: T,
    handler: GameEventListener<T>
  ): void {
    const bus = getEventBus();
    const unsub = bus.on(type, handler);
    this.unsubscribers.push(unsub);
  }

  /**
   * Handle enemy killed event
   */
  private handleEnemyKilled(
    enemyType: string,
    position: { x: number; y: number; z: number }
  ): void {
    const audioManager = getAudioManager();

    // Play kill confirmation
    hitAudioManager.playKillSound();

    // Play enemy-specific death sound
    const soundKey = ENEMY_DEATH_SOUNDS[enemyType.toLowerCase()] || 'enemy_death';

    // Use the SoundDispatcher for enemy death sounds
    switch (soundKey) {
      case 'skitterer_death':
        audioManager.play('alien_chittering');
        setTimeout(() => audioManager.play('enemy_death', { volume: 0.7 }), 50);
        break;
      case 'spitter_death':
        audioManager.play('organic_squish');
        audioManager.play('enemy_death', { volume: 0.6 });
        break;
      case 'warrior_death':
        audioManager.play('alien_growl');
        setTimeout(() => audioManager.play('enemy_death', { volume: 0.8 }), 100);
        break;
      case 'heavy_death':
        audioManager.play('alien_heavy_step');
        audioManager.play('alien_roar', { volume: 0.7 });
        break;
      case 'queen_death':
        audioManager.play('alien_death_scream');
        break;
      case 'mech_death':
        audioManager.play('explosion', { volume: 0.8 });
        break;
      default:
        audioManager.play('enemy_death');
    }
  }

  /**
   * Handle player damage event
   */
  private handlePlayerDamaged(damage: number): void {
    const now = performance.now();

    // Cooldown to prevent sound spam
    if (now - this.lastDamageTime < this.DAMAGE_SOUND_COOLDOWN_MS) return;
    this.lastDamageTime = now;

    // Play damage sound
    playPlayerHitSound(damage);

    // Update health tracking
    this.playerHealthState.currentHealth = Math.max(
      0,
      this.playerHealthState.currentHealth - damage
    );

    // Check for low health state
    const healthPercent =
      this.playerHealthState.currentHealth / this.playerHealthState.maxHealth;

    if (healthPercent <= 0.25 && !this.playerHealthState.isLowHealth) {
      this.enterLowHealthState();
    } else if (healthPercent <= 0.15) {
      // Critical health - play warning
      playCriticalHealthWarning();
    }

    // Check for shield break (if health dropped significantly)
    if (damage >= 30) {
      playShieldBreak();
    }
  }

  /**
   * Handle player healed event
   */
  private handlePlayerHealed(amount: number): void {
    this.playerHealthState.currentHealth = Math.min(
      this.playerHealthState.maxHealth,
      this.playerHealthState.currentHealth + amount
    );

    const healthPercent =
      this.playerHealthState.currentHealth / this.playerHealthState.maxHealth;

    // Exit low health state if healed enough
    if (healthPercent > 0.35 && this.playerHealthState.isLowHealth) {
      this.exitLowHealthState();
    }

    // Play healing sound
    const audioManager = getAudioManager();
    audioManager.play('shield_recharge');
  }

  /**
   * Enter low health state - start heartbeat loop
   */
  private enterLowHealthState(): void {
    if (this.playerHealthState.isLowHealth) return;

    this.playerHealthState.isLowHealth = true;

    // Play initial warning
    playCriticalHealthWarning();

    // Start heartbeat loop
    this.playerHealthState.heartbeatIntervalId = setInterval(() => {
      if (!this.playerHealthState.isLowHealth) return;

      playHeartbeat();

      // Occasionally play heavy breathing
      if (Math.random() < 0.3) {
        setTimeout(() => playHeavyBreathing(), 400);
      }
    }, 800); // ~75 BPM heartbeat
  }

  /**
   * Exit low health state - stop heartbeat loop
   */
  private exitLowHealthState(): void {
    this.playerHealthState.isLowHealth = false;

    if (this.playerHealthState.heartbeatIntervalId) {
      clearInterval(this.playerHealthState.heartbeatIntervalId);
      this.playerHealthState.heartbeatIntervalId = null;
    }
  }

  /**
   * Handle weapon fired event
   */
  private handleWeaponFired(
    weaponId: WeaponId,
    position: { x: number; y: number; z: number }
  ): void {
    // The weapon fire sound is typically played by the weapon system itself
    // This handler can add additional contextual sounds
    const audioManager = getAudioManager();
    audioManager.enterCombat();
  }

  /**
   * Handle weapon switched event
   */
  private handleWeaponSwitched(weaponId: WeaponId): void {
    weaponSoundManager.playWeaponSwitch();
    weaponSoundManager.playWeaponEquip(weaponId);
  }

  /**
   * Handle combat state changed event
   */
  private handleCombatStateChanged(inCombat: boolean): void {
    const audioManager = getAudioManager();

    if (inCombat) {
      audioManager.enterCombat();
      audioManager.setEnvironmentalCombatState(true);
    } else {
      audioManager.exitCombat();
      audioManager.setEnvironmentalCombatState(false);
    }
  }

  /**
   * Handle collectible pickup
   */
  private handleCollectiblePickedUp(collectibleType: string): void {
    const audioManager = getAudioManager();

    switch (collectibleType.toLowerCase()) {
      case 'health':
        audioManager.play('shield_recharge');
        break;
      case 'ammo':
        audioManager.play('weapon_reload_complete');
        break;
      case 'armor':
        audioManager.play('shield_recharge');
        break;
      case 'skull':
        audioManager.play('secret_found');
        break;
      case 'key':
      case 'keycard':
        audioManager.play('notification');
        break;
      default:
        audioManager.play('ui_click');
    }
  }

  /**
   * Handle vehicle entered
   */
  private handleVehicleEntered(vehicleType: string): void {
    const audioManager = getAudioManager();

    switch (vehicleType.toLowerCase()) {
      case 'tank':
      case 'wraith':
        audioManager.play('door_open');
        audioManager.startDropshipEngine(0.4);
        break;
      case 'mech':
        audioManager.play('mech_step');
        break;
      case 'dropship':
        audioManager.play('airlock');
        audioManager.startDropshipEngine();
        break;
      default:
        audioManager.play('door_open');
    }
  }

  /**
   * Update player max health (call when level starts)
   */
  setPlayerMaxHealth(maxHealth: number): void {
    this.playerHealthState.maxHealth = maxHealth;
    this.playerHealthState.currentHealth = maxHealth;
    this.exitLowHealthState();
  }

  /**
   * Set current player health directly (for sync with game state)
   */
  setPlayerHealth(currentHealth: number, maxHealth?: number): void {
    if (maxHealth !== undefined) {
      this.playerHealthState.maxHealth = maxHealth;
    }
    this.playerHealthState.currentHealth = currentHealth;

    const healthPercent =
      this.playerHealthState.currentHealth / this.playerHealthState.maxHealth;

    if (healthPercent <= 0.25 && !this.playerHealthState.isLowHealth) {
      this.enterLowHealthState();
    } else if (healthPercent > 0.35 && this.playerHealthState.isLowHealth) {
      this.exitLowHealthState();
    }
  }

  /**
   * Clean up all subscriptions and intervals
   */
  dispose(): void {
    // Unsubscribe from all events
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // Stop heartbeat loop
    this.exitLowHealthState();

    // Reset state
    this.playerHealthState = {
      currentHealth: 100,
      maxHealth: 100,
      isLowHealth: false,
      heartbeatIntervalId: null,
    };

    AudioEventHandler.instance = null;
  }
}

// Singleton accessor
let audioEventHandlerInstance: AudioEventHandler | null = null;

export function getAudioEventHandler(): AudioEventHandler {
  if (!audioEventHandlerInstance) {
    audioEventHandlerInstance = AudioEventHandler.getInstance();
  }
  return audioEventHandlerInstance;
}

export function initializeAudioEventHandler(): void {
  const handler = getAudioEventHandler();
  handler.initialize();
}

export function disposeAudioEventHandler(): void {
  if (audioEventHandlerInstance) {
    audioEventHandlerInstance.dispose();
    audioEventHandlerInstance = null;
  }
}
