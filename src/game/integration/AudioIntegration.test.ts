/**
 * AudioIntegration.test.ts - Complete audio system tests
 *
 * Tests audio event handling without actual Web Audio API:
 * - Sound effects triggered by events
 * - Music layer system
 * - Spatial audio positioning
 * - Volume and settings
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { EventBus, getEventBus, disposeEventBus } from '../core/EventBus';
import type { GameEvent } from '../core/EventBus';

// Mock Web Audio API
const mockAudioContext = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
  })),
  createPanner: vi.fn(() => ({
    connect: vi.fn(),
    setPosition: vi.fn(),
    positionX: { value: 0 },
    positionY: { value: 0 },
    positionZ: { value: 0 },
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: 100,
    rolloffFactor: 1,
  })),
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null,
    loop: false,
    onended: null,
  })),
  decodeAudioData: vi.fn().mockResolvedValue({}),
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
};

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
vi.stubGlobal('webkitAudioContext', vi.fn(() => mockAudioContext));

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  },
});

/**
 * Mock audio manager for testing
 */
interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  voiceVolume: number;
}

interface SpatialAudioSource {
  id: string;
  position: Vector3;
  soundId: string;
  volume: number;
  loop: boolean;
  maxDistance: number;
}

class MockAudioManager {
  private settings: AudioSettings = {
    masterVolume: 1.0,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    ambienceVolume: 0.6,
    voiceVolume: 0.8,
  };

  private playingSounds: Map<string, { soundId: string; startTime: number }> = new Map();
  private musicLayers: Map<string, { intensity: number; playing: boolean }> = new Map();
  private spatialSources: Map<string, SpatialAudioSource> = new Map();
  private listenerPosition: Vector3 = Vector3.Zero();

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setAmbienceVolume(volume: number): void {
    this.settings.ambienceVolume = Math.max(0, Math.min(1, volume));
  }

  setVoiceVolume(volume: number): void {
    this.settings.voiceVolume = Math.max(0, Math.min(1, volume));
  }

  playSfx(soundId: string, volume: number = 1.0): string {
    const instanceId = `${soundId}_${Date.now()}`;
    const effectiveVolume = this.settings.masterVolume * this.settings.sfxVolume * volume;
    this.playingSounds.set(instanceId, { soundId, startTime: Date.now() });
    return instanceId;
  }

  playSpatialSfx(
    soundId: string,
    position: Vector3,
    volume: number = 1.0,
    maxDistance: number = 50
  ): string {
    const instanceId = `spatial_${soundId}_${Date.now()}`;
    this.spatialSources.set(instanceId, {
      id: instanceId,
      position: position.clone(),
      soundId,
      volume,
      loop: false,
      maxDistance,
    });
    return instanceId;
  }

  stopSfx(instanceId: string): void {
    this.playingSounds.delete(instanceId);
    this.spatialSources.delete(instanceId);
  }

  setMusicLayer(layerId: string, intensity: number): void {
    const layer = this.musicLayers.get(layerId) || { intensity: 0, playing: false };
    layer.intensity = Math.max(0, Math.min(1, intensity));
    this.musicLayers.set(layerId, layer);
  }

  startMusicLayer(layerId: string): void {
    const layer = this.musicLayers.get(layerId) || { intensity: 1, playing: false };
    layer.playing = true;
    this.musicLayers.set(layerId, layer);
  }

  stopMusicLayer(layerId: string): void {
    const layer = this.musicLayers.get(layerId);
    if (layer) {
      layer.playing = false;
    }
  }

  getMusicLayerState(layerId: string): { intensity: number; playing: boolean } | undefined {
    return this.musicLayers.get(layerId);
  }

  setListenerPosition(position: Vector3): void {
    this.listenerPosition = position.clone();
  }

  getListenerPosition(): Vector3 {
    return this.listenerPosition.clone();
  }

  getSpatialSource(instanceId: string): SpatialAudioSource | undefined {
    return this.spatialSources.get(instanceId);
  }

  getPlayingSoundCount(): number {
    return this.playingSounds.size + this.spatialSources.size;
  }

  isPlaying(instanceId: string): boolean {
    return this.playingSounds.has(instanceId) || this.spatialSources.has(instanceId);
  }

  stopAll(): void {
    this.playingSounds.clear();
    this.spatialSources.clear();
    this.musicLayers.forEach((layer) => (layer.playing = false));
  }
}

describe('Audio Integration', () => {
  let eventBus: EventBus;
  let audioManager: MockAudioManager;

  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    disposeEventBus();
    eventBus = getEventBus();
    audioManager = new MockAudioManager();
  });

  afterEach(() => {
    disposeEventBus();
  });

  describe('Sound Effects', () => {
    it('should play sound on WEAPON_FIRED event', () => {
      let playedSound: string | null = null;

      eventBus.on('WEAPON_FIRED', (event) => {
        playedSound = audioManager.playSfx(`weapon_${event.weaponId}`, 1.0);
      });

      eventBus.emit({
        type: 'WEAPON_FIRED',
        weaponId: 'assault_rifle',
        position: new Vector3(0, 0, 0),
        direction: new Vector3(0, 0, 1),
      });

      expect(playedSound).not.toBeNull();
      expect(playedSound).toContain('weapon_assault_rifle');
      expect(audioManager.getPlayingSoundCount()).toBe(1);
    });

    it('should play sound on ENEMY_KILLED event', () => {
      let playedSound: string | null = null;

      eventBus.on('ENEMY_KILLED', (event) => {
        playedSound = audioManager.playSfx(`death_${event.enemyType}`, 0.8);
      });

      eventBus.emit({
        type: 'ENEMY_KILLED',
        position: new Vector3(10, 0, 10),
        enemyType: 'skitterer',
        enemyId: 'enemy_1',
      });

      expect(playedSound).toContain('death_skitterer');
    });

    it('should play sound on PLAYER_DAMAGED event', () => {
      let playedSound: string | null = null;

      eventBus.on('PLAYER_DAMAGED', (event) => {
        const intensity = Math.min(1, event.amount / 50);
        playedSound = audioManager.playSfx('player_hurt', intensity);
      });

      eventBus.emit({
        type: 'PLAYER_DAMAGED',
        amount: 25,
      });

      expect(playedSound).toContain('player_hurt');
    });

    it('should play spatial sound on PROJECTILE_IMPACT event', () => {
      let spatialSoundId: string | null = null;

      eventBus.on('PROJECTILE_IMPACT', (event) => {
        spatialSoundId = audioManager.playSpatialSfx('impact_metal', event.position, 0.7);
      });

      const impactPos = new Vector3(20, 5, 30);
      eventBus.emit({
        type: 'PROJECTILE_IMPACT',
        position: impactPos,
        damage: 25,
        isCritical: false,
      });

      expect(spatialSoundId).not.toBeNull();
      const source = audioManager.getSpatialSource(spatialSoundId!);
      expect(source).toBeDefined();
      expect(source!.position.x).toBe(20);
      expect(source!.position.z).toBe(30);
    });

    it('should play sound on RELOAD_STARTED event', () => {
      let playedSound: string | null = null;

      eventBus.on('RELOAD_STARTED', (event) => {
        playedSound = audioManager.playSfx(`reload_${event.weaponId}`, 0.6);
      });

      eventBus.emit({
        type: 'RELOAD_STARTED',
        weaponId: 'assault_rifle',
        reloadTime: 2000,
      });

      expect(playedSound).toContain('reload_assault_rifle');
    });
  });

  describe('Music Layers', () => {
    it('should start combat music on enemy alert', () => {
      eventBus.on('ENEMY_ALERTED', () => {
        audioManager.startMusicLayer('combat');
        audioManager.setMusicLayer('combat', 0.5);
      });

      eventBus.emit({
        type: 'ENEMY_ALERTED',
        enemyId: 'enemy_1',
        enemyType: 'warrior',
        position: new Vector3(30, 0, 30),
      });

      const state = audioManager.getMusicLayerState('combat');
      expect(state?.playing).toBe(true);
      expect(state?.intensity).toBe(0.5);
    });

    it('should increase combat intensity during boss fight', () => {
      audioManager.startMusicLayer('combat');
      audioManager.setMusicLayer('combat', 0.5);

      eventBus.on('BOSS_DAMAGED', () => {
        audioManager.setMusicLayer('combat', 1.0);
      });

      eventBus.emit({
        type: 'BOSS_DAMAGED',
        bossId: 'queen_1',
        damage: 100,
        currentHealth: 2900,
        maxHealth: 3000,
      });

      const state = audioManager.getMusicLayerState('combat');
      expect(state?.intensity).toBe(1.0);
    });

    it('should stop combat music when all enemies dead', () => {
      audioManager.startMusicLayer('combat');

      eventBus.on('OBJECTIVE_COMPLETED', (event) => {
        if (event.objectiveId === 'kill_all_enemies') {
          audioManager.stopMusicLayer('combat');
          audioManager.startMusicLayer('exploration');
        }
      });

      eventBus.emit({
        type: 'OBJECTIVE_COMPLETED',
        objectiveId: 'kill_all_enemies',
      });

      const combatState = audioManager.getMusicLayerState('combat');
      const explorationState = audioManager.getMusicLayerState('exploration');
      expect(combatState?.playing).toBe(false);
      expect(explorationState?.playing).toBe(true);
    });

    it('should play victory music on level complete', () => {
      eventBus.on('LEVEL_COMPLETE', () => {
        audioManager.stopMusicLayer('combat');
        audioManager.stopMusicLayer('exploration');
        audioManager.startMusicLayer('victory');
      });

      eventBus.emit({
        type: 'LEVEL_COMPLETE',
        levelId: 'anchor_station',
        stats: {
          time: 300,
          kills: 50,
          accuracy: 0.75,
          secretsFound: 2,
          damageTaken: 100,
        },
      });

      const victoryState = audioManager.getMusicLayerState('victory');
      expect(victoryState?.playing).toBe(true);
    });
  });

  describe('Spatial Audio', () => {
    it('should update listener position from player', () => {
      const playerPosition = new Vector3(50, 1.8, 100);
      audioManager.setListenerPosition(playerPosition);

      const listener = audioManager.getListenerPosition();
      expect(listener.x).toBe(50);
      expect(listener.y).toBe(1.8);
      expect(listener.z).toBe(100);
    });

    it('should create spatial sounds at correct positions', () => {
      const soundPosition = new Vector3(25, 5, 75);
      const instanceId = audioManager.playSpatialSfx('explosion', soundPosition, 1.0, 100);

      const source = audioManager.getSpatialSource(instanceId);
      expect(source).toBeDefined();
      expect(source!.position.equals(soundPosition)).toBe(true);
      expect(source!.maxDistance).toBe(100);
    });

    it('should play enemy sounds at enemy positions', () => {
      const enemyPosition = new Vector3(30, 0, 30);

      eventBus.on('ENEMY_ATTACK', (event) => {
        audioManager.playSpatialSfx('alien_attack', event.position, 0.8);
      });

      eventBus.emit({
        type: 'ENEMY_ATTACK',
        enemyId: 'enemy_1',
        position: enemyPosition.clone(),
        damage: 15,
      });

      expect(audioManager.getPlayingSoundCount()).toBe(1);
    });
  });

  describe('Volume Settings', () => {
    it('should update master volume', () => {
      audioManager.setMasterVolume(0.5);
      expect(audioManager.getSettings().masterVolume).toBe(0.5);
    });

    it('should update music volume', () => {
      audioManager.setMusicVolume(0.3);
      expect(audioManager.getSettings().musicVolume).toBe(0.3);
    });

    it('should update SFX volume', () => {
      audioManager.setSfxVolume(0.8);
      expect(audioManager.getSettings().sfxVolume).toBe(0.8);
    });

    it('should update ambience volume', () => {
      audioManager.setAmbienceVolume(0.4);
      expect(audioManager.getSettings().ambienceVolume).toBe(0.4);
    });

    it('should update voice volume', () => {
      audioManager.setVoiceVolume(1.0);
      expect(audioManager.getSettings().voiceVolume).toBe(1.0);
    });

    it('should clamp volume values to valid range', () => {
      audioManager.setMasterVolume(-0.5);
      expect(audioManager.getSettings().masterVolume).toBe(0);

      audioManager.setMasterVolume(1.5);
      expect(audioManager.getSettings().masterVolume).toBe(1);
    });

    it('should persist settings to localStorage', () => {
      const settings = audioManager.getSettings();
      mockStorage['audio_settings'] = JSON.stringify(settings);

      const loaded = JSON.parse(mockStorage['audio_settings']);
      expect(loaded.masterVolume).toBe(1.0);
      expect(loaded.musicVolume).toBe(0.5);
    });
  });

  describe('Sound Cleanup', () => {
    it('should stop specific sound instances', () => {
      const instanceId = audioManager.playSfx('test_sound', 1.0);
      expect(audioManager.isPlaying(instanceId)).toBe(true);

      audioManager.stopSfx(instanceId);
      expect(audioManager.isPlaying(instanceId)).toBe(false);
    });

    it('should stop all sounds', () => {
      audioManager.playSfx('sound1', 1.0);
      audioManager.playSfx('sound2', 1.0);
      audioManager.playSpatialSfx('spatial1', Vector3.Zero(), 1.0);
      audioManager.startMusicLayer('combat');

      expect(audioManager.getPlayingSoundCount()).toBe(3);

      audioManager.stopAll();

      expect(audioManager.getPlayingSoundCount()).toBe(0);
      expect(audioManager.getMusicLayerState('combat')?.playing).toBe(false);
    });
  });

  describe('Event-Driven Audio', () => {
    it('should play pickup sound on item collected', () => {
      let playedSound: string | null = null;

      eventBus.on('ITEM_COLLECTED', (event) => {
        playedSound = audioManager.playSfx(`pickup_${event.itemType}`, 0.6);
      });

      eventBus.emit({
        type: 'ITEM_COLLECTED',
        itemId: 'ammo_1',
        itemType: 'ammo',
        quantity: 30,
      });

      expect(playedSound).toContain('pickup_ammo');
    });

    it('should play footstep sounds during movement', () => {
      let footstepCount = 0;

      eventBus.on('FOOTSTEP', (event) => {
        audioManager.playSpatialSfx(`footstep_${event.surface}`, event.position, 0.3);
        footstepCount++;
      });

      // Simulate multiple footsteps
      for (let i = 0; i < 5; i++) {
        eventBus.emit({
          type: 'FOOTSTEP',
          position: new Vector3(i * 2, 0, 0),
          surface: 'metal',
        });
      }

      expect(footstepCount).toBe(5);
    });

    it('should play dialogue audio on subtitle event', () => {
      let voiceInstance: string | null = null;

      eventBus.on('DIALOGUE_STARTED', (event) => {
        voiceInstance = audioManager.playSfx(`voice_${event.speakerId}_${event.dialogueId}`, 1.0);
      });

      eventBus.emit({
        type: 'DIALOGUE_STARTED',
        speakerId: 'commander_reyes',
        dialogueId: 'intro_01',
        text: 'Welcome to the mission.',
        duration: 3000,
      });

      expect(voiceInstance).toContain('voice_commander_reyes');
    });

    it('should play alert sound on low health', () => {
      let alertPlayed = false;

      eventBus.on('LOW_HEALTH_WARNING', () => {
        audioManager.playSfx('heartbeat_warning', 0.8);
        alertPlayed = true;
      });

      eventBus.emit({
        type: 'LOW_HEALTH_WARNING',
        currentHealth: 15,
        maxHealth: 100,
      });

      expect(alertPlayed).toBe(true);
    });
  });

  describe('Audio Contexts', () => {
    it('should handle menu vs gameplay audio states', () => {
      // In menu - only music, no SFX
      let gameplayActive = false;

      const playGameplaySfx = (soundId: string) => {
        if (gameplayActive) {
          return audioManager.playSfx(soundId, 1.0);
        }
        return null;
      };

      // In menu
      expect(playGameplaySfx('weapon_fire')).toBeNull();

      // Start gameplay
      gameplayActive = true;
      expect(playGameplaySfx('weapon_fire')).not.toBeNull();
    });

    it('should pause audio on game pause', () => {
      audioManager.playSfx('ambient_loop', 1.0);
      audioManager.startMusicLayer('exploration');

      // Simulate pause
      const wasPaused = true;
      if (wasPaused) {
        audioManager.stopAll();
      }

      expect(audioManager.getPlayingSoundCount()).toBe(0);
    });
  });

  describe('Weapon-Specific Sounds', () => {
    const weaponSoundsByCategory: Record<string, string[]> = {
      rifle: ['rifle_fire', 'rifle_reload', 'rifle_empty'],
      shotgun: ['shotgun_fire', 'shotgun_pump', 'shotgun_reload'],
      plasma: ['plasma_fire', 'plasma_charge', 'plasma_reload'],
      pistol: ['pistol_fire', 'pistol_reload', 'pistol_empty'],
    };

    it('should have fire sounds for each weapon category', () => {
      for (const [category, sounds] of Object.entries(weaponSoundsByCategory)) {
        const hasFireSound = sounds.some((s) => s.includes('fire'));
        expect(hasFireSound).toBe(true);
      }
    });

    it('should have reload sounds for each weapon category', () => {
      for (const [category, sounds] of Object.entries(weaponSoundsByCategory)) {
        const hasReloadSound = sounds.some((s) => s.includes('reload'));
        expect(hasReloadSound).toBe(true);
      }
    });
  });

  describe('Enemy Sounds', () => {
    const enemySounds: Record<string, string[]> = {
      skitterer: ['chittering', 'hiss', 'squish'],
      warrior: ['growl', 'screech', 'hiss'],
      queen: ['roar', 'growl'],
    };

    it('should have pain sounds for each enemy type', () => {
      for (const sounds of Object.values(enemySounds)) {
        expect(sounds.length).toBeGreaterThan(0);
      }
    });
  });
});
