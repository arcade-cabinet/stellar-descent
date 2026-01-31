/**
 * ExtractionLevel - Victory Sequence
 *
 * Contains dropship arrival, boarding sequence, and epilogue logic.
 */

import type { Scene } from '@babylonjs/core/scene';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Animation } from '@babylonjs/core/Animations/animation';
import { CubicEase, EasingFunction } from '@babylonjs/core/Animations/easing';

import { getAchievementManager } from '../../achievements';
import { getAudioManager } from '../../core/AudioManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('Victory');
import { particleManager } from '../../effects/ParticleManager';
import { saveSystem } from '../../persistence/SaveSystem';
import type { LevelCallbacks } from '../types';

import type { CommsMessage } from './types';
import * as C from './constants';
import * as Comms from './comms';
import * as Effects from './effects';
import * as Enemies from './enemies';
import type { Enemy } from './types';

// ============================================================================
// VICTORY STATE
// ============================================================================

export interface VictoryState {
  cinematic_active: boolean;
  cinematic_beat: number;
  timeouts: ReturnType<typeof setTimeout>[];
  dropshipEngineSound: { stop: () => void } | null;
  engineThrustInterval: ReturnType<typeof setInterval> | null;
}

export function createVictoryState(): VictoryState {
  return {
    cinematic_active: false,
    cinematic_beat: 0,
    timeouts: [],
    dropshipEngineSound: null,
    engineThrustInterval: null,
  };
}

// ============================================================================
// VICTORY CINEMATIC HELPERS
// ============================================================================

function scheduleTimeout(
  state: VictoryState,
  callback: () => void,
  delay: number
): void {
  const timeout = setTimeout(() => {
    if (state.cinematic_active) callback();
  }, delay);
  state.timeouts.push(timeout);
}

function clearAllTimeouts(state: VictoryState): void {
  for (const t of state.timeouts) clearTimeout(t);
  state.timeouts = [];
}

// ============================================================================
// DROPSHIP ENGINE SOUNDS
// ============================================================================

export function startDropshipEngineSounds(state: VictoryState): void {
  try {
    const proceduralAudio = (getAudioManager() as any).proceduralAudio;
    if (proceduralAudio?.generateDropshipEngine) {
      state.dropshipEngineSound = proceduralAudio.generateDropshipEngine(0.4);
    }
  } catch (e) {
    log.warn('Could not start dropship engine sound:', e);
  }
}

export function stopDropshipEngineSounds(state: VictoryState): void {
  state.dropshipEngineSound?.stop();
  state.dropshipEngineSound = null;
}

// ============================================================================
// ENGINE THRUST EFFECTS
// ============================================================================

export function startEngineThrustEffects(
  state: VictoryState,
  dropship: TransformNode | null,
  thrustEmitters: TransformNode[]
): void {
  state.engineThrustInterval = setInterval(() => {
    if (!state.cinematic_active || !dropship) {
      stopEngineThrustEffects(state);
      return;
    }
    for (const emitter of thrustEmitters) {
      const worldPos = emitter.getAbsolutePosition();
      particleManager.emit('smoke', worldPos.clone(), { scale: 0.6 });
      if (Math.random() < 0.3) {
        particleManager.emitDustImpact(new Vector3(worldPos.x, 0.5, worldPos.z), 1.5);
      }
    }
  }, 200);
}

export function stopEngineThrustEffects(state: VictoryState): void {
  if (state.engineThrustInterval) {
    clearInterval(state.engineThrustInterval);
    state.engineThrustInterval = null;
  }
}

// ============================================================================
// DROPSHIP ANIMATIONS
// ============================================================================

export function animateDropshipApproach(
  scene: Scene,
  dropship: TransformNode,
  startPos: Vector3,
  endPos: Vector3,
  duration: number,
  setBaseShake: (intensity: number) => void,
  onComplete: () => void
): void {
  const frameRate = 30;
  const totalFrames = Math.round((duration / 1000) * frameRate);

  const posAnim = new Animation(
    'dropshipApproach',
    'position',
    frameRate,
    Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );

  const easing = new CubicEase();
  easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
  posAnim.setEasingFunction(easing);

  posAnim.setKeys([
    { frame: 0, value: startPos },
    { frame: Math.round(totalFrames * 0.6), value: new Vector3(50, 150, endPos.z - 100) },
    { frame: totalFrames, value: endPos },
  ]);

  dropship.animations = [posAnim];
  scene.beginAnimation(dropship, 0, totalFrames, false, 1, onComplete);
  setBaseShake(1.5);
}

export function animateDropshipLanding(
  scene: Scene,
  dropship: TransformNode,
  startPos: Vector3,
  endPos: Vector3,
  duration: number,
  state: VictoryState,
  callbacks: LevelCallbacks,
  triggerShake: (intensity: number) => void,
  onComplete: () => void
): void {
  state.cinematic_beat = 2;
  callbacks.onNotification('TOUCHDOWN IMMINENT', 2000);

  const frameRate = 30;
  const totalFrames = Math.round((duration / 1000) * frameRate);

  const posAnim = new Animation(
    'dropshipLanding',
    'position',
    frameRate,
    Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );

  const easing = new CubicEase();
  easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
  posAnim.setEasingFunction(easing);

  posAnim.setKeys([
    { frame: 0, value: startPos },
    { frame: Math.round(totalFrames * 0.2), value: new Vector3(0, 40, endPos.z) },
    { frame: Math.round(totalFrames * 0.5), value: new Vector3(0, 20, endPos.z) },
    { frame: Math.round(totalFrames * 0.8), value: new Vector3(0, 10, endPos.z) },
    { frame: totalFrames, value: endPos },
  ]);

  dropship.animations = [posAnim];
  scene.beginAnimation(dropship, 0, totalFrames, false, 1, onComplete);

  // Schedule dust effects
  scheduleTimeout(state, () => {
    Effects.emitLandingDust(C.LZ_POSITION, 3.0);
  }, duration * 0.3);

  scheduleTimeout(state, () => {
    Effects.emitLandingDust(C.LZ_POSITION, 4.0);
    triggerShake(5);
  }, duration * 0.6);
}

export function animateRampOpening(scene: Scene, ramp: Mesh): void {
  const rampAnim = new Animation(
    'rampOpen',
    'rotation.x',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );

  const easing = new CubicEase();
  easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
  rampAnim.setEasingFunction(easing);

  rampAnim.setKeys([
    { frame: 0, value: 0 },
    { frame: 30, value: -0.3 },
    { frame: 90, value: -1.2 },
  ]);

  ramp.animations = [rampAnim];
  scene.beginAnimation(ramp, 0, 90, false);
}

// ============================================================================
// VICTORY SEQUENCE ORCHESTRATION
// ============================================================================

export interface VictoryContext {
  scene: Scene;
  state: VictoryState;
  callbacks: LevelCallbacks;
  dropship: TransformNode | null;
  dropshipRamp: Mesh | null;
  dropshipRampLight: PointLight | null;
  dropshipThrustEmitters: TransformNode[];
  mechMesh: TransformNode | null;
  enemies: Enemy[];
  kills: number;
  noDeathBonus: boolean;
  setBaseShake: (intensity: number) => void;
  triggerShake: (intensity: number) => void;
  setSurfaceVisible: (visible: boolean) => void;
  disposeCollapseResources: () => void;
  onTransitionToEpilogue: () => void;
  completeLevel: () => void;
  setMechIntegrity: (value: number) => void;
}

export function startDropshipArrival(ctx: VictoryContext): void {
  if (!ctx.dropship) return;

  ctx.state.cinematic_active = true;
  ctx.state.cinematic_beat = 0;
  ctx.callbacks.onCinematicStart?.();
  ctx.disposeCollapseResources();
  ctx.setBaseShake(0);

  ctx.callbacks.onNotification('CONTACT - INCOMING FRIENDLY', 2000);
  ctx.callbacks.onObjectiveUpdate('EXTRACTION', 'Dropship detected - Stand by...');
  getAudioManager().play('comms_open');

  scheduleTimeout(ctx.state, () => ctx.callbacks.onCommsMessage(Comms.DROPSHIP_DETECTION_COMMS), 200);
  scheduleTimeout(ctx.state, () => {
    getAudioManager().play('comms_open');
    ctx.callbacks.onCommsMessage(Comms.COMMANDER_VICTORY_COMMS);
  }, 1500);

  scheduleTimeout(ctx.state, () => {
    ctx.dropship!.setEnabled(true);
    startDropshipEngineSounds(ctx.state);
    startEngineThrustEffects(ctx.state, ctx.dropship, ctx.dropshipThrustEmitters);

    const approachStartPos = new Vector3(100, 300, C.LZ_POSITION.z - 400);
    const hoverPos = new Vector3(0, 60, C.LZ_POSITION.z - 50);
    const landingPos = new Vector3(0, 6, C.LZ_POSITION.z);

    ctx.dropship!.position = approachStartPos;
    ctx.dropship!.rotation.y = Math.PI;
    ctx.callbacks.onNotification('SALVATION INBOUND', 3000);
    ctx.triggerShake(2);

    scheduleTimeout(ctx.state, () => {
      getAudioManager().play('comms_open');
      ctx.callbacks.onCommsMessage(Comms.DROPSHIP_APPROACH_COMMS);
    }, 1000);

    scheduleTimeout(ctx.state, () => {
      getAudioManager().play('comms_open');
      ctx.callbacks.onCommsMessage(Comms.MARCUS_SEES_DROPSHIP_COMMS);
    }, 3500);

    animateDropshipApproach(
      ctx.scene,
      ctx.dropship!,
      approachStartPos,
      hoverPos,
      8000,
      ctx.setBaseShake,
      () => onDropshipHovering(ctx, hoverPos, landingPos)
    );

    // FIX #20: Clear enemies immediately for cleaner cinematic
    Enemies.clearAllEnemies(ctx.enemies);
  }, 2000);
}

function onDropshipHovering(ctx: VictoryContext, hoverPos: Vector3, landingPos: Vector3): void {
  if (!ctx.dropship) return;

  ctx.state.cinematic_beat = 1;
  ctx.callbacks.onNotification('CLEARING LZ', 2000);
  Effects.emitLandingDust(C.LZ_POSITION, 2.0);
  ctx.setBaseShake(2.5);
  ctx.triggerShake(4);

  scheduleTimeout(ctx.state, () => ctx.callbacks.onCommsMessage(Comms.DROPSHIP_HOVER_COMMS), 1000);
  scheduleTimeout(ctx.state, () => {
    animateDropshipLanding(
      ctx.scene,
      ctx.dropship!,
      hoverPos,
      landingPos,
      6000,
      ctx.state,
      ctx.callbacks,
      ctx.triggerShake,
      () => onDropshipLanded(ctx)
    );
  }, 3000);
}

function onDropshipLanded(ctx: VictoryContext): void {
  ctx.state.cinematic_beat = 3;
  ctx.triggerShake(6);
  ctx.setBaseShake(0);

  particleManager.emitDustImpact(C.LZ_POSITION, 5.0);
  getAudioManager().play('explosion', { volume: 0.6 });
  Effects.emitLandingDust(C.LZ_POSITION, 6.0);

  ctx.callbacks.onNotification('DROPSHIP DOWN - BOARD NOW!', 3000);
  ctx.callbacks.onObjectiveUpdate('EXTRACTION', 'Board the dropship!');

  if (ctx.mechMesh) {
    ctx.setMechIntegrity(0);
    scheduleTimeout(ctx.state, () => ctx.callbacks.onCommsMessage(Comms.MECH_COLLAPSE_COMMS), 1500);
  }

  if (ctx.dropshipRamp) {
    scheduleTimeout(ctx.state, () => animateRampOpening(ctx.scene, ctx.dropshipRamp!), 1500);
  }

  if (ctx.dropshipRampLight) {
    scheduleTimeout(ctx.state, () => {
      if (ctx.dropshipRampLight) ctx.dropshipRampLight.intensity = 60;
    }, 2000);
  }

  scheduleTimeout(ctx.state, () => {
    getAudioManager().play('comms_open');
    ctx.callbacks.onCommsMessage(Comms.BOARD_NOW_COMMS);
  }, 2500);

  scheduleTimeout(ctx.state, () => startBoardingSequence(ctx), 6000);
}

function startBoardingSequence(ctx: VictoryContext): void {
  ctx.state.cinematic_beat = 4;

  for (const item of Comms.BOARDING_SEQUENCE_COMMS) {
    scheduleTimeout(ctx.state, () => ctx.callbacks.onCommsMessage(item.message), item.delay);
  }

  scheduleTimeout(ctx.state, () => ctx.onTransitionToEpilogue(), 7000);
}

// ============================================================================
// EPILOGUE
// ============================================================================

export function showEpilogue(ctx: VictoryContext, levelId: string): void {
  ctx.state.cinematic_beat = 5;
  ctx.callbacks.onCombatStateChange(false);
  ctx.callbacks.onCinematicEnd?.();
  stopDropshipEngineSounds(ctx.state);
  stopEngineThrustEffects(ctx.state);

  getAudioManager().playMusic('victory', 2);
  getAchievementManager().onGameComplete();
  saveSystem.completeLevel('extraction');
  saveSystem.setObjective('campaign_complete', true);

  scheduleTimeout(ctx.state, () => {
    getAudioManager().play('comms_open');
    ctx.callbacks.onCommsMessage(Comms.AIRBORNE_COMMS);
  }, 2000);

  scheduleTimeout(ctx.state, () => Effects.animateFadeToBlack(ctx.scene, 2000), 3000);

  scheduleTimeout(ctx.state, () => {
    ctx.setSurfaceVisible(false);
    if (ctx.dropship) ctx.dropship.setEnabled(false);
    if (ctx.mechMesh) ctx.mechMesh.setEnabled(false);
  }, 1500);

  ctx.callbacks.onNotification('MISSION COMPLETE', 5000);
  ctx.callbacks.onObjectiveUpdate('STELLAR DESCENT', 'Mission Complete');

  scheduleTimeout(ctx.state, () => ctx.callbacks.onCommsMessage(Comms.COMMANDER_DEBRIEF_COMMS), 4000);
  scheduleTimeout(ctx.state, () => ctx.callbacks.onCommsMessage(Comms.getAthenaDebrief(ctx.kills)), 10000);
  scheduleTimeout(ctx.state, () => ctx.callbacks.onCommsMessage(Comms.MARCUS_FINAL_COMMS), 16000);

  scheduleTimeout(ctx.state, () => {
    ctx.callbacks.onObjectiveUpdate('STELLAR DESCENT', 'CAMPAIGN COMPLETE');
    ctx.completeLevel();
  }, 20000);
}

// ============================================================================
// CLEANUP
// ============================================================================

export function disposeVictoryState(state: VictoryState): void {
  clearAllTimeouts(state);
  stopDropshipEngineSounds(state);
  stopEngineThrustEffects(state);
}
