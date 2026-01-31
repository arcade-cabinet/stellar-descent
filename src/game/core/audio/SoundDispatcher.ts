/**
 * Sound Effect Dispatcher
 * Maps sound effect names to their generators for cleaner AudioManager code
 */

import type { SoundEffect, AudioLoopHandle } from './types';
import { UISoundGenerator } from './sounds/ui';
import { WeaponSoundGenerator } from './sounds/weapons';
import { EnemySoundGenerator } from './sounds/enemies';
import { EnvironmentSoundGenerator, ProceduralAmbientGenerator } from './sounds/environment';
import { weaponSoundManager } from '../WeaponSoundManager';

/**
 * Unified Procedural Audio - Combines all sound generators with dispatch
 */
export class SoundDispatcher {
  private ui = new UISoundGenerator();
  private weapons = new WeaponSoundGenerator();
  private enemies = new EnemySoundGenerator();
  private environment = new EnvironmentSoundGenerator();

  /**
   * Play a sound effect by name
   */
  play(effect: SoundEffect, volume: number): void {
    const handler = this.soundHandlers[effect];
    if (handler) {
      handler(volume);
    }
  }

  /**
   * Map of sound effects to their handler functions
   */
  private soundHandlers: Record<SoundEffect, ((volume: number) => void) | null> = {
    // Weapon sounds
    weapon_fire: (v) => this.weapons.generateLaserShot(v),
    hit_marker: (v) => weaponSoundManager.playHitMarker(v),
    headshot: (v) => weaponSoundManager.playHeadshot(v),
    kill_confirm: (v) => weaponSoundManager.playKillConfirmation(v),
    weapon_switch: (v) => weaponSoundManager.playWeaponSwitch(v),
    player_damage: (v) => this.weapons.generateDamage(v),
    footstep: (v) => this.weapons.generateFootstep(v),

    // UI sounds
    ui_click: (v) => this.ui.generateUIClick(v),
    ui_hover: (v) => this.ui.generateUIHover(v),
    notification: (v) => this.ui.generateNotificationBeep(v),
    comms_open: (v) => this.ui.generateNotificationBeep(v),
    comms_close: (v) => this.ui.generateCommsClose(v),
    achievement_unlock: (v) => this.ui.generateAchievementUnlock(v),
    audio_log_pickup: (v) => this.ui.generateAudioLogPickup(v),
    secret_found: (v) => this.ui.generateSecretFound(v),

    // Enemy sounds
    enemy_death: (v) => this.enemies.generateEnemyDeath(v),
    alien_screech: (v) => this.enemies.generateAlienScreech(v),
    alien_growl: (v) => this.enemies.generateAlienGrowl(v),
    hive_pulse: (v) => this.enemies.generateHivePulse(v),
    organic_squish: (v) => this.enemies.generateOrganicSquish(v),
    alien_footstep: (v) => this.enemies.generateAlienFootstep(v),
    alien_attack: (v) => this.enemies.generateAlienAttack(v),
    alien_spawn: (v) => this.enemies.generateAlienSpawn(v),
    alien_alert: (v) => this.enemies.generateAlienAlert(v),
    alien_chittering: (v) => this.enemies.generateAlienChittering(v),
    alien_heavy_step: (v) => this.enemies.generateAlienHeavyStep(v),
    alien_acid_spit: (v) => this.enemies.generateAlienAcidSpit(v),
    alien_roar: (v) => this.enemies.generateAlienRoar(v),
    alien_hiss: (v) => this.enemies.generateAlienHiss(v),
    alien_death_scream: (v) => this.enemies.generateAlienDeathScream(v),

    // Mech sounds
    mech_step: (v) => this.weapons.generateMechStep(v),
    mech_fire: (v) => this.weapons.generateMechFire(v),
    explosion: (v) => this.weapons.generateExplosion(v),

    // Near-miss sounds
    near_miss_whoosh: (v) => this.environment.generateNearMissWhoosh(v),
    near_miss_ice: (v) => this.environment.generateIceNearMissWhoosh(v),
    near_miss_metal: (v) => this.environment.generateMetalNearMissWhoosh(v),

    // Collapse sounds
    collapse_rumble: (v) => this.environment.generateCollapseRumble(v),
    collapse_crack: (v) => this.environment.generateCollapseCrack(v),
    structure_groan: (v) => this.environment.generateStructureGroan(v),
    debris_impact: (v) => this.environment.generateDebrisImpact(v),
    ground_crack: (v) => this.environment.generateGroundCrack(v),

    // Vehicle/door sounds
    door_open: (v) => this.environment.generateDoorOpen(v),
    airlock: (v) => this.environment.generateAirlockCycle(v),
    drop_impact: (v) => this.environment.generateDropImpact(v),

    // Loopable sounds (use the loop generators instead)
    drop_wind: null, // Use generateDropWind() for looping
    drop_thrust: null, // Use generateThrustSound() for looping
    dropship_engine: null, // Use generateDropshipEngine() for looping

    // Not yet implemented - stub with related sounds
    weapon_reload: (v) => this.weapons.generateFootstep(v * 0.5), // Placeholder: mechanical click
    weapon_reload_start: (v) => this.weapons.generateFootstep(v * 0.4),
    weapon_reload_complete: (v) => this.ui.generateUIClick(v),
    weapon_empty_click: (v) => this.ui.generateUIClick(v * 0.6),
    jump: (v) => this.weapons.generateFootstep(v * 0.7),
    land: (v) => this.environment.generateDebrisImpact(v * 0.3),
    ambient_wind: null, // Use ProceduralAmbientGenerator for looping ambient
    shield_recharge: (v) => this.ui.generateAchievementUnlock(v * 0.5),
    alert: (v) => this.ui.generateNotificationBeep(v * 1.2),
  };

  // Loop generators
  generateDropWind(duration?: number, volume?: number): AudioLoopHandle {
    return this.environment.generateDropWind(duration, volume);
  }

  generateThrustSound(volume?: number): AudioLoopHandle {
    return this.environment.generateThrustSound(volume);
  }

  generateDropshipEngine(volume?: number): AudioLoopHandle {
    return this.environment.generateDropshipEngine(volume);
  }

  dispose(): void {
    this.ui.dispose();
    this.weapons.dispose();
    this.enemies.dispose();
    this.environment.dispose();
  }
}

// Re-export the ambient generator
export { ProceduralAmbientGenerator };
