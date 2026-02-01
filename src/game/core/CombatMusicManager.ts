/**
 * CombatMusicManager - Adaptive Combat Music System for Stellar Descent
 *
 * Features:
 * - 5-layer adaptive music system synced with gameplay state
 * - Layer 0: Ambient pad (always playing, low volume)
 * - Layer 1: Percussion (combat detected)
 * - Layer 2: Bass line (enemies nearby)
 * - Layer 3: Synth stabs (taking/dealing damage)
 * - Layer 4: Lead melody (intense combat)
 *
 * - Smooth crossfade transitions (2 seconds)
 * - Quantized to musical bars (4 beats)
 * - Combat exit handling with gradual de-escalation
 * - Boss music override with phase-based intensity
 * - Level-specific music themes
 * - Pre-loaded layers for performance
 */

import * as Tone from 'tone';
import type { LevelId } from '../levels/types';
import {
  type CombatState,
  calculateCombatIntensity,
  generateAmbientPattern,
  generateBassPattern,
  generateLeadPattern,
  generatePercussionPattern,
  generateStabPattern,
  getActiveLayersForIntensity,
  getSynthFactoryForStyle,
  LAYER_VOLUMES,
  type LayerSynthSet,
  LEVEL_MUSIC_THEMES,
  type LevelMusicTheme,
  MusicLayerType,
  scheduleAtNextBar,
  TRANSITION_TIMING,
} from './audio/MusicLayers';
import { getLogger } from './Logger';

const log = getLogger('CombatMusicManager');

// ============================================================================
// TYPES
// ============================================================================

/** Combat intensity levels for music adaptation */
export type CombatIntensity = 'none' | 'low' | 'medium' | 'high' | 'boss';

/** Combat music theme types */
export type CombatTheme = 'station' | 'surface' | 'hive' | 'boss';

/** Boss phase for phase-based intensity */
export type BossPhase = 1 | 2 | 3;

/** Layer state tracking */
interface LayerStateInfo {
  type: MusicLayerType;
  isActive: boolean;
  gain: Tone.Gain;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patterns: (Tone.Loop | Tone.Sequence<any>)[];
}

// ============================================================================
// COMBAT MUSIC MANAGER
// ============================================================================

export class CombatMusicManager {
  // Audio chain
  private masterGain: Tone.Gain;
  private compressor: Tone.Compressor;
  private lowpassFilter: Tone.Filter;
  private reverb: Tone.Reverb;
  private distortion: Tone.Distortion;

  // Layer management
  private layers: Map<MusicLayerType, LayerStateInfo> = new Map();
  private synths: LayerSynthSet | null = null;

  // State
  private isPlaying = false;
  private isPreloaded = false;
  private currentLevelId: LevelId | null = null;
  private currentTheme: LevelMusicTheme | null = null;
  private currentIntensity: CombatIntensity = 'none';
  private intensityValue = 0; // 0-1 continuous value
  private volume = 0.6;
  private isMuted = false;

  // Combat state tracking
  private combatState: CombatState = {
    nearbyEnemies: 0,
    recentDamageDealt: 0,
    recentDamageTaken: 0,
    playerHealthPercent: 1.0,
    bossActive: false,
  };
  private combatExitTimeout: ReturnType<typeof setTimeout> | null = null;
  private deescalationInterval: ReturnType<typeof setInterval> | null = null;
  private transitionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Boss music state
  private bossPhase: BossPhase = 1;
  private isBossMusicActive = false;

  // Scheduled events for cleanup
  private scheduledIds: number[] = [];

  constructor() {
    // Create effects chain
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });

    this.lowpassFilter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
      rolloff: -24,
    });

    this.reverb = new Tone.Reverb({
      decay: 2,
      wet: 0.15,
    });

    this.distortion = new Tone.Distortion({
      distortion: 0,
      wet: 0,
    });

    // Master output
    this.masterGain = new Tone.Gain(0);

    // Chain: layers -> distortion -> compressor -> filter -> reverb -> master -> destination
    this.distortion.connect(this.compressor);
    this.compressor.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.reverb);
    this.reverb.connect(this.masterGain);
    this.masterGain.toDestination();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Preload all music layers for a level (call on level start)
   */
  async preloadForLevel(levelId: LevelId): Promise<void> {
    const theme = LEVEL_MUSIC_THEMES[levelId];
    if (!theme) {
      log.warn(`No music theme for level: ${levelId}`);
      return;
    }

    // Start Tone.js if needed
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    // Clean up previous level if any
    if (this.isPreloaded) {
      this.disposeLayersAndSynths();
    }

    this.currentLevelId = levelId;
    this.currentTheme = theme;

    // Create synths for this level's style
    const synthFactory = getSynthFactoryForStyle(theme.style);
    this.synths = synthFactory();

    // Set tempo
    Tone.getTransport().bpm.value = theme.tempo;

    // Create and connect all layers
    this.createAllLayers(theme);

    // Apply theme-specific effects
    this.applyThemeEffects(theme.style);

    this.isPreloaded = true;
    log.info(`Preloaded music for level: ${levelId} (${theme.style} style @ ${theme.tempo} BPM)`);
  }

  /**
   * Start combat music (typically when first enemy is detected)
   */
  async startCombat(levelId: LevelId, initialIntensity: CombatIntensity = 'low'): Promise<void> {
    if (this.isMuted) return;

    // Preload if needed
    if (!this.isPreloaded || this.currentLevelId !== levelId) {
      await this.preloadForLevel(levelId);
    }

    if (!this.currentTheme) {
      log.warn('No theme loaded, cannot start combat music');
      return;
    }

    // Already playing - just update intensity
    if (this.isPlaying) {
      this.setIntensityLevel(initialIntensity);
      return;
    }

    this.isPlaying = true;
    this.lastEnemyTime = Date.now();

    // Clear any pending exit transitions
    this.clearCombatExitTimers();

    // Set initial intensity
    this.setIntensityLevel(initialIntensity);

    // Fade in master gain
    this.masterGain.gain.rampTo(this.volume, TRANSITION_TIMING.CROSSFADE_DURATION);

    // Start all layer patterns
    this.startAllPatterns();

    // Start transport if not already running
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }

    log.info(
      `Started combat music: ${this.currentTheme.style} @ ${this.currentTheme.tempo} BPM, intensity: ${initialIntensity}`
    );
  }

  /**
   * Stop combat music with fade
   */
  stopCombat(fadeDuration = TRANSITION_TIMING.CROSSFADE_DURATION): void {
    if (!this.isPlaying) return;

    // Clear any pending transitions
    this.clearCombatExitTimers();

    // Fade out master
    this.masterGain.gain.rampTo(0, fadeDuration);

    // Schedule cleanup
    this.transitionTimeout = setTimeout(
      () => {
        this.isPlaying = false;
        this.stopAllPatterns();
        this.resetAllLayerVolumes();
        this.currentIntensity = 'none';
        this.intensityValue = 0;
        this.isBossMusicActive = false;
        log.info('Combat music stopped');
      },
      fadeDuration * 1000 + 100
    );
  }

  /**
   * Update combat state from game - this drives adaptive music
   * Call this every frame or when combat state changes
   */
  updateCombatState(state: Partial<CombatState>): void {
    const hadEnemies = this.combatState.nearbyEnemies > 0;

    // Merge new state
    this.combatState = { ...this.combatState, ...state };

    const hasEnemies = this.combatState.nearbyEnemies > 0;

    // Track last enemy time for combat exit handling
    if (hasEnemies) {
      this.lastEnemyTime = Date.now();
      this.clearCombatExitTimers();
    } else if (hadEnemies && this.isPlaying) {
      // No more enemies - start combat exit sequence
      this.scheduleCombatExit();
    }

    // Calculate intensity and update layers
    if (this.isPlaying && !this.isBossMusicActive) {
      const intensity = calculateCombatIntensity(this.combatState);
      this.setIntensityValue(intensity);
    }

    // Decay recent damage values
    if (this.combatState.recentDamageDealt > 0) {
      this.combatState.recentDamageDealt = Math.max(0, this.combatState.recentDamageDealt - 1);
    }
    if (this.combatState.recentDamageTaken > 0) {
      this.combatState.recentDamageTaken = Math.max(0, this.combatState.recentDamageTaken - 1);
    }
  }

  /**
   * Notify of damage dealt (triggers synth stabs)
   */
  onDamageDealt(amount: number): void {
    this.combatState.recentDamageDealt = Math.min(this.combatState.recentDamageDealt + amount, 100);
    this.updateCombatState({});
  }

  /**
   * Notify of damage taken (triggers synth stabs, increases intensity)
   */
  onDamageTaken(amount: number): void {
    this.combatState.recentDamageTaken = Math.min(this.combatState.recentDamageTaken + amount, 100);
    this.updateCombatState({});
  }

  /**
   * Set discrete intensity level
   */
  setIntensityLevel(intensity: CombatIntensity): void {
    if (this.currentIntensity === intensity) return;

    this.currentIntensity = intensity;

    // Map intensity to continuous value
    switch (intensity) {
      case 'none':
        this.setIntensityValue(0);
        break;
      case 'low':
        this.setIntensityValue(0.25);
        break;
      case 'medium':
        this.setIntensityValue(0.5);
        break;
      case 'high':
        this.setIntensityValue(0.8);
        break;
      case 'boss':
        this.setIntensityValue(1.0);
        this.startBossMusic();
        break;
    }

    log.info(`Intensity set to: ${intensity} (${this.intensityValue})`);
  }

  /**
   * Start boss music override
   */
  startBossMusic(phase: BossPhase = 1): void {
    if (!this.isPlaying) {
      log.warn('Cannot start boss music - combat music not playing');
      return;
    }

    this.isBossMusicActive = true;
    this.bossPhase = phase;
    this.combatState.bossActive = true;

    // All layers active at max intensity
    this.setIntensityValue(1.0);

    // Increase tempo for boss fight
    if (this.currentTheme) {
      const bossTempoBoost = phase * 10;
      Tone.getTransport().bpm.rampTo(this.currentTheme.tempo + bossTempoBoost, 2);
    }

    // More aggressive effects
    this.distortion.distortion = 0.4 + phase * 0.1;
    this.distortion.wet.rampTo(0.5, 1);
    this.lowpassFilter.frequency.rampTo(18000, 1);

    log.info(`Boss music started at phase ${phase}`);
  }

  /**
   * Transition to new boss phase
   */
  setBossPhase(phase: BossPhase): void {
    if (!this.isBossMusicActive) return;

    this.bossPhase = phase;

    // Tempo increases with phase
    if (this.currentTheme) {
      const bossTempoBoost = phase * 10;
      Tone.getTransport().bpm.rampTo(this.currentTheme.tempo + bossTempoBoost, 2);
    }

    // Effects intensify with phase
    this.distortion.distortion = 0.4 + phase * 0.1;

    log.info(`Boss phase set to: ${phase}`);
  }

  /**
   * Play victory sting when boss is defeated
   */
  playVictoryStinger(): void {
    if (this.isMuted) return;

    this.isBossMusicActive = false;
    this.combatState.bossActive = false;

    // Create victory synth
    const victorySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 },
    });

    const victoryGain = new Tone.Gain(0.4);
    const victoryReverb = new Tone.Reverb({ decay: 2, wet: 0.3 });

    victorySynth.connect(victoryGain);
    victoryGain.connect(victoryReverb);
    victoryReverb.toDestination();

    // Play triumphant arpeggio
    const now = Tone.now();
    const notes = ['C4', 'E4', 'G4', 'C5'];

    notes.forEach((note, i) => {
      victorySynth.triggerAttackRelease(note, '8n', now + i * 0.12, 0.8);
    });

    // Final chord
    victorySynth.triggerAttackRelease(['C5', 'E5', 'G5'], '2n', now + 0.5, 0.6);

    // Clean up after stinger and crossfade back to ambient
    setTimeout(() => {
      victorySynth.dispose();
      victoryGain.dispose();
      victoryReverb.dispose();
    }, 3000);

    // Start gradual return to ambient
    this.startGradualDeescalation();

    log.info('Victory stinger played');
  }

  /**
   * Play brief combat clear stinger
   */
  playClearStinger(): void {
    if (this.isMuted) return;

    const stingerSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 },
    });

    const stingerGain = new Tone.Gain(0.3);
    stingerSynth.connect(stingerGain);
    stingerGain.toDestination();

    const now = Tone.now();
    stingerSynth.triggerAttackRelease('E4', '16n', now);
    stingerSynth.triggerAttackRelease('G4', '16n', now + 0.08);
    stingerSynth.triggerAttackRelease('B4', '8n', now + 0.16);

    setTimeout(() => {
      stingerSynth.dispose();
      stingerGain.dispose();
    }, 1000);

    log.info('Clear stinger played');
  }

  /**
   * Calculate intensity from enemy state
   * Convenience method for game systems
   */
  calculateIntensityFromEnemies(
    enemyCount: number,
    maxExpectedEnemies: number,
    hasActiveBoss = false,
    playerHealthPercent = 1.0
  ): CombatIntensity {
    if (hasActiveBoss) return 'boss';
    if (enemyCount === 0) return 'none';

    const countRatio = Math.min(enemyCount / maxExpectedEnemies, 1);
    const healthModifier = playerHealthPercent < 0.3 ? 0.2 : playerHealthPercent < 0.5 ? 0.1 : 0;
    const totalIntensity = countRatio + healthModifier;

    if (totalIntensity >= 0.8) return 'high';
    if (totalIntensity >= 0.5) return 'medium';
    return 'low';
  }

  // ============================================================================
  // VOLUME & MUTE
  // ============================================================================

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.isPlaying && !this.isMuted) {
      this.masterGain.gain.rampTo(this.volume, 0.1);
    }
  }

  mute(): void {
    this.isMuted = true;
    this.masterGain.gain.rampTo(0, 0.1);
  }

  unmute(): void {
    this.isMuted = false;
    if (this.isPlaying) {
      this.masterGain.gain.rampTo(this.volume, 0.1);
    }
  }

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  isActive(): boolean {
    return this.isPlaying;
  }

  getIntensity(): CombatIntensity {
    return this.currentIntensity;
  }

  getIntensityValue(): number {
    return this.intensityValue;
  }

  getTheme(): LevelMusicTheme | null {
    return this.currentTheme;
  }

  isBossActive(): boolean {
    return this.isBossMusicActive;
  }

  getBossPhase(): BossPhase {
    return this.bossPhase;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  dispose(): void {
    this.clearCombatExitTimers();

    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }

    // Clear scheduled transport events
    for (const id of this.scheduledIds) {
      Tone.getTransport().clear(id);
    }
    this.scheduledIds = [];

    if (this.isPlaying) {
      Tone.getTransport().stop();
    }

    this.disposeLayersAndSynths();

    this.masterGain.dispose();
    this.compressor.dispose();
    this.lowpassFilter.dispose();
    this.reverb.dispose();
    this.distortion.dispose();

    this.isPlaying = false;
    this.isPreloaded = false;
  }

  // ============================================================================
  // PRIVATE: LAYER MANAGEMENT
  // ============================================================================

  /**
   * Set continuous intensity value (0-1) and update layers accordingly
   */
  private setIntensityValue(value: number): void {
    const newValue = Math.max(0, Math.min(1, value));

    // Skip if no significant change
    if (Math.abs(newValue - this.intensityValue) < 0.05) return;

    this.intensityValue = newValue;

    // Update discrete intensity level for external queries
    if (this.intensityValue < 0.1) {
      this.currentIntensity = 'none';
    } else if (this.intensityValue < 0.35) {
      this.currentIntensity = 'low';
    } else if (this.intensityValue < 0.65) {
      this.currentIntensity = 'medium';
    } else if (this.intensityValue < 0.9) {
      this.currentIntensity = 'high';
    } else {
      this.currentIntensity = 'boss';
    }

    // Update layer activation based on intensity
    this.updateLayerActivation();

    // Update effects based on intensity
    this.updateIntensityEffects();
  }

  /**
   * Update which layers are active based on current intensity
   */
  private updateLayerActivation(): void {
    const activeLayers = getActiveLayersForIntensity(this.intensityValue);

    for (const [layerType, layerInfo] of this.layers) {
      const shouldBeActive = activeLayers.includes(layerType);

      if (shouldBeActive && !layerInfo.isActive) {
        this.activateLayer(layerType);
      } else if (
        !shouldBeActive &&
        layerInfo.isActive &&
        layerType !== MusicLayerType.AMBIENT_PAD
      ) {
        this.deactivateLayer(layerType);
      }
    }
  }

  /**
   * Activate a layer with crossfade
   */
  private activateLayer(type: MusicLayerType): void {
    const layerInfo = this.layers.get(type);
    if (!layerInfo || layerInfo.isActive) return;

    layerInfo.isActive = true;
    const volumeRange = LAYER_VOLUMES[type];

    // Schedule activation at next bar for quantized transition
    if (this.currentTheme) {
      const id = scheduleAtNextBar(this.currentTheme.tempo, () => {
        layerInfo.gain.gain.rampTo(volumeRange.max, TRANSITION_TIMING.CROSSFADE_DURATION);
      });
      this.scheduledIds.push(id);
    } else {
      layerInfo.gain.gain.rampTo(volumeRange.max, TRANSITION_TIMING.CROSSFADE_DURATION);
    }
  }

  /**
   * Deactivate a layer with crossfade
   */
  private deactivateLayer(type: MusicLayerType): void {
    const layerInfo = this.layers.get(type);
    if (!layerInfo || !layerInfo.isActive) return;

    layerInfo.isActive = false;

    // Schedule deactivation at next bar for quantized transition
    if (this.currentTheme) {
      const id = scheduleAtNextBar(this.currentTheme.tempo, () => {
        layerInfo.gain.gain.rampTo(0, TRANSITION_TIMING.CROSSFADE_DURATION);
      });
      this.scheduledIds.push(id);
    } else {
      layerInfo.gain.gain.rampTo(0, TRANSITION_TIMING.CROSSFADE_DURATION);
    }
  }

  /**
   * Update audio effects based on intensity
   */
  private updateIntensityEffects(): void {
    if (!this.isPlaying || !this.currentTheme) return;

    // Scale BPM slightly with intensity
    const bpmBoost = this.intensityValue * 15;
    Tone.getTransport().bpm.rampTo(this.currentTheme.tempo + bpmBoost, 2);

    // Increase distortion with intensity
    this.distortion.wet.rampTo(this.intensityValue * 0.4, 1);

    // Open filter as intensity increases
    const filterFreq = 3000 + this.intensityValue * 17000;
    this.lowpassFilter.frequency.rampTo(filterFreq, 1);

    // Adjust reverb (less reverb at high intensity for clarity)
    this.reverb.wet.rampTo(0.25 - this.intensityValue * 0.15, 1);
  }

  // ============================================================================
  // PRIVATE: COMBAT EXIT HANDLING
  // ============================================================================

  /**
   * Schedule combat exit after delay
   */
  private scheduleCombatExit(): void {
    if (this.combatExitTimeout) return; // Already scheduled

    this.combatExitTimeout = setTimeout(() => {
      // Check if enemies returned during delay
      if (this.combatState.nearbyEnemies > 0) {
        this.combatExitTimeout = null;
        return;
      }

      log.info('Combat exit: Starting gradual de-escalation');
      this.startGradualDeescalation();
    }, TRANSITION_TIMING.COMBAT_EXIT_DELAY);
  }

  /**
   * Start gradual layer removal for smooth de-escalation
   */
  private startGradualDeescalation(): void {
    // Clear any existing de-escalation
    if (this.deescalationInterval) {
      clearInterval(this.deescalationInterval);
    }

    // Get current active layers (excluding ambient which stays)
    const layersToRemove = [
      MusicLayerType.LEAD_MELODY,
      MusicLayerType.SYNTH_STABS,
      MusicLayerType.BASS_LINE,
      MusicLayerType.PERCUSSION,
    ];

    let removeIndex = 0;

    this.deescalationInterval = setInterval(() => {
      // Check if enemies returned
      if (this.combatState.nearbyEnemies > 0) {
        this.clearCombatExitTimers();
        return;
      }

      if (removeIndex < layersToRemove.length) {
        this.deactivateLayer(layersToRemove[removeIndex]);
        removeIndex++;
      } else {
        // All layers removed, return to ambient
        this.clearCombatExitTimers();
        this.setIntensityValue(0);
        log.info('Combat music returned to ambient');
      }
    }, TRANSITION_TIMING.LAYER_REMOVAL_INTERVAL);
  }

  /**
   * Clear combat exit timers
   */
  private clearCombatExitTimers(): void {
    if (this.combatExitTimeout) {
      clearTimeout(this.combatExitTimeout);
      this.combatExitTimeout = null;
    }
    if (this.deescalationInterval) {
      clearInterval(this.deescalationInterval);
      this.deescalationInterval = null;
    }
  }

  // ============================================================================
  // PRIVATE: LAYER CREATION
  // ============================================================================

  /**
   * Create all music layers for the current theme
   */
  private createAllLayers(theme: LevelMusicTheme): void {
    if (!this.synths) return;

    // Create layer 0: Ambient Pad
    this.createAmbientLayer(theme);

    // Create layer 1: Percussion
    this.createPercussionLayer(theme);

    // Create layer 2: Bass Line
    this.createBassLayer(theme);

    // Create layer 3: Synth Stabs
    this.createStabsLayer(theme);

    // Create layer 4: Lead Melody
    this.createLeadLayer(theme);
  }

  private createAmbientLayer(theme: LevelMusicTheme): void {
    if (!this.synths?.ambient) return;

    const gain = new Tone.Gain(LAYER_VOLUMES[MusicLayerType.AMBIENT_PAD].min);
    gain.connect(this.distortion);

    this.synths.ambient.volume.value = -8;
    this.synths.ambient.connect(gain);

    const pattern = generateAmbientPattern(this.synths.ambient, theme.key, theme.tempo);

    this.layers.set(MusicLayerType.AMBIENT_PAD, {
      type: MusicLayerType.AMBIENT_PAD,
      isActive: true, // Ambient is always active
      gain,
      patterns: [pattern],
    });
  }

  private createPercussionLayer(theme: LevelMusicTheme): void {
    if (!this.synths?.percussion || !this.synths?.hihat) return;

    const gain = new Tone.Gain(0);
    gain.connect(this.distortion);

    this.synths.percussion.volume.value = -4;
    this.synths.percussion.connect(gain);

    this.synths.hihat.volume.value = -16;
    this.synths.hihat.connect(gain);

    const { kickPattern, hihatPattern } = generatePercussionPattern(
      this.synths.percussion,
      this.synths.hihat,
      theme.style,
      theme.tempo
    );

    this.layers.set(MusicLayerType.PERCUSSION, {
      type: MusicLayerType.PERCUSSION,
      isActive: false,
      gain,
      patterns: [kickPattern, hihatPattern],
    });
  }

  private createBassLayer(theme: LevelMusicTheme): void {
    if (!this.synths?.bass) return;

    const gain = new Tone.Gain(0);
    gain.connect(this.distortion);

    this.synths.bass.volume.value = -6;
    this.synths.bass.connect(gain);

    const pattern = generateBassPattern(this.synths.bass, theme.key, theme.style);

    this.layers.set(MusicLayerType.BASS_LINE, {
      type: MusicLayerType.BASS_LINE,
      isActive: false,
      gain,
      patterns: [pattern],
    });
  }

  private createStabsLayer(theme: LevelMusicTheme): void {
    if (!this.synths?.stabs) return;

    const gain = new Tone.Gain(0);
    gain.connect(this.distortion);

    this.synths.stabs.volume.value = -10;
    this.synths.stabs.connect(gain);

    const pattern = generateStabPattern(this.synths.stabs, theme.key, theme.style);

    this.layers.set(MusicLayerType.SYNTH_STABS, {
      type: MusicLayerType.SYNTH_STABS,
      isActive: false,
      gain,
      patterns: [pattern],
    });
  }

  private createLeadLayer(theme: LevelMusicTheme): void {
    if (!this.synths?.lead) return;

    const gain = new Tone.Gain(0);
    gain.connect(this.distortion);

    this.synths.lead.volume.value = -8;
    this.synths.lead.connect(gain);

    const pattern = generateLeadPattern(this.synths.lead, theme.key, theme.style);

    this.layers.set(MusicLayerType.LEAD_MELODY, {
      type: MusicLayerType.LEAD_MELODY,
      isActive: false,
      gain,
      patterns: [pattern],
    });
  }

  /**
   * Apply theme-specific audio effects
   */
  private applyThemeEffects(style: LevelMusicTheme['style']): void {
    switch (style) {
      case 'industrial':
        this.distortion.distortion = 0.2;
        this.reverb.decay = 3;
        this.reverb.wet.value = 0.2;
        break;
      case 'desolate':
        this.distortion.distortion = 0.1;
        this.reverb.decay = 4;
        this.reverb.wet.value = 0.25;
        break;
      case 'organic':
        this.distortion.distortion = 0.15;
        this.reverb.decay = 4;
        this.reverb.wet.value = 0.3;
        break;
      case 'urgent':
        this.distortion.distortion = 0.3;
        this.reverb.decay = 1.5;
        this.reverb.wet.value = 0.1;
        break;
      case 'horror':
        this.distortion.distortion = 0.1;
        this.reverb.decay = 5;
        this.reverb.wet.value = 0.35;
        break;
      case 'frozen':
        this.distortion.distortion = 0.15;
        this.reverb.decay = 4.5;
        this.reverb.wet.value = 0.28;
        break;
    }
  }

  /**
   * Start all layer patterns
   */
  private startAllPatterns(): void {
    for (const layerInfo of this.layers.values()) {
      for (const pattern of layerInfo.patterns) {
        pattern.start(0);
      }
    }
  }

  /**
   * Stop all layer patterns
   */
  private stopAllPatterns(): void {
    for (const layerInfo of this.layers.values()) {
      for (const pattern of layerInfo.patterns) {
        pattern.stop();
      }
    }
  }

  /**
   * Reset all layer volumes to initial state
   */
  private resetAllLayerVolumes(): void {
    for (const [layerType, layerInfo] of this.layers) {
      const volumeRange = LAYER_VOLUMES[layerType];
      const targetVolume = layerType === MusicLayerType.AMBIENT_PAD ? volumeRange.min : 0;
      layerInfo.gain.gain.value = targetVolume;
      layerInfo.isActive = layerType === MusicLayerType.AMBIENT_PAD;
    }
  }

  /**
   * Dispose all layers and synths
   */
  private disposeLayersAndSynths(): void {
    // Dispose layers
    for (const layerInfo of this.layers.values()) {
      for (const pattern of layerInfo.patterns) {
        pattern.stop();
        pattern.dispose();
      }
      layerInfo.gain.dispose();
    }
    this.layers.clear();

    // Dispose synths
    if (this.synths) {
      this.synths.ambient?.dispose();
      this.synths.percussion?.dispose();
      this.synths.hihat?.dispose();
      this.synths.bass?.dispose();
      this.synths.stabs?.dispose();
      this.synths.lead?.dispose();
      this.synths = null;
    }

    this.isPreloaded = false;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let combatMusicManagerInstance: CombatMusicManager | null = null;

export function getCombatMusicManager(): CombatMusicManager {
  if (!combatMusicManagerInstance) {
    combatMusicManagerInstance = new CombatMusicManager();
  }
  return combatMusicManagerInstance;
}

export function disposeCombatMusicManager(): void {
  if (combatMusicManagerInstance) {
    combatMusicManagerInstance.dispose();
    combatMusicManagerInstance = null;
  }
}
