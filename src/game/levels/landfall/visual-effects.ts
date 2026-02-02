/**
 * Landfall Visual Effects
 * Handles particle effects, atmosphere visuals, and wind streaks during descent
 *
 * Effects managed:
 * - Re-entry plasma and heat distortion
 * - Smoke trails during freefall
 * - Atmosphere streaks (speed lines)
 * - Thruster exhaust for powered descent
 * - Wind streak meshes
 * - Screen shake coordination
 */

import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';

import type { BindableAction } from '../../stores/useKeybindingsStore';
import { updateWindStreaks } from './halo-drop';
import type { DropPhase } from './types';

export interface DescentEffects {
  reentryParticles: ParticleSystem | null;
  playerSmokeTrail: ParticleSystem | null;
  atmosphereStreaks: ParticleSystem | null;
  thrusterExhaustParticles: ParticleSystem | null;
  plasmaGlow: Mesh | null;
  heatDistortion: Mesh | null;
  windStreaks: Mesh[];
}

export interface DescentState {
  altitude: number;
  velocity: number;
  fuel: number;
  lateralVelocityX: number;
  lateralVelocityZ: number;
  windIntensity: number;
}

export interface EffectUpdateContext {
  phase: DropPhase;
  effects: DescentEffects;
  state: DescentState;
  inputTracker: {
    isActionActive: (action: BindableAction) => boolean;
  };
  setBaseShake: (intensity: number) => void;
}

/**
 * Update all visual effects based on current descent state
 */
export function updateVisualEffects(
  ctx: EffectUpdateContext,
  deltaTime: number
): { newWindIntensity: number } {
  const { phase, effects, state, inputTracker, setBaseShake } = ctx;
  const altitudeFactor = Math.max(0, Math.min(1, (1000 - state.altitude) / 600));
  const atmosphereEntry = Math.max(0, Math.min(1, (700 - state.altitude) / 300));

  let newWindIntensity = state.windIntensity;

  if (phase === 'freefall_start' || phase === 'freefall_belt' || phase === 'freefall_clear') {
    // Smoke trail intensity
    if (effects.playerSmokeTrail) {
      const smokeIntensity = Math.min(1, state.velocity / 60);
      effects.playerSmokeTrail.emitRate = 30 + smokeIntensity * 40;
    }

    // Atmosphere streaks
    if (effects.atmosphereStreaks) {
      effects.atmosphereStreaks.emitRate = 30 + altitudeFactor * 80;
    }

    // Atmosphere entry effects
    if (atmosphereEntry > 0) {
      if (effects.reentryParticles && !effects.reentryParticles.isStarted()) {
        effects.reentryParticles.start();
      }
      if (effects.reentryParticles) {
        effects.reentryParticles.emitRate = atmosphereEntry * 150;
      }
      if (effects.plasmaGlow?.material) {
        (effects.plasmaGlow.material as StandardMaterial).alpha = atmosphereEntry * 0.4;
      }
      if (atmosphereEntry > 0.3) {
        setBaseShake(atmosphereEntry * 1.5);
      }
    }

    // Wind streaks
    updateWindStreaks(
      effects.windStreaks,
      deltaTime,
      altitudeFactor,
      state.windIntensity,
      state.velocity,
      state.lateralVelocityX,
      state.lateralVelocityZ,
      state.altitude
    );
    newWindIntensity = Math.max(0, state.windIntensity - deltaTime * 0.5);
  }

  if (phase === 'powered_descent' || phase === 'landing') {
    // Reduce smoke trail
    if (effects.playerSmokeTrail) {
      effects.playerSmokeTrail.emitRate = 10;
    }

    // Stop reentry effects
    if (effects.reentryParticles?.isStarted()) {
      effects.reentryParticles.stop();
    }

    // Thruster exhaust based on boosting
    if (effects.thrusterExhaustParticles) {
      const boosting = inputTracker.isActionActive('fire');
      effects.thrusterExhaustParticles.emitRate = boosting && state.fuel > 0 ? 200 : 30;
    }

    // Hide wind streaks
    effects.windStreaks.forEach((s) => (s.isVisible = false));
  }

  if (phase === 'surface') {
    stopAllDescentEffects(effects);
  }

  // Heat distortion effect during atmospheric entry
  if (
    effects.heatDistortion?.material &&
    (phase === 'freefall_belt' || phase === 'freefall_clear')
  ) {
    const heatMat = effects.heatDistortion.material as StandardMaterial;
    const heatIntensity = Math.max(0, (800 - state.altitude) / 400);
    heatMat.alpha = heatIntensity * 0.3;
    // Pulsing heat effect
    const pulse = Math.sin(performance.now() * 0.005) * 0.1;
    heatMat.emissiveColor = new Color3(1.0 + pulse, 0.4 - heatIntensity * 0.1, 0.1);
    effects.heatDistortion.scaling.setAll(1 + heatIntensity * 0.5);
  }

  return { newWindIntensity };
}

/**
 * Stop all descent-related particle effects
 */
export function stopAllDescentEffects(effects: DescentEffects): void {
  [
    effects.playerSmokeTrail,
    effects.atmosphereStreaks,
    effects.reentryParticles,
    effects.thrusterExhaustParticles,
  ].forEach((p) => p?.stop());

  [effects.plasmaGlow, effects.heatDistortion].forEach((m) => {
    if (m) m.isVisible = false;
  });

  effects.windStreaks.forEach((s) => (s.isVisible = false));
}

/**
 * Dispose all descent effect resources
 */
export function disposeDescentEffects(effects: DescentEffects): void {
  [
    effects.reentryParticles,
    effects.playerSmokeTrail,
    effects.atmosphereStreaks,
    effects.thrusterExhaustParticles,
  ].forEach((p) => p?.dispose());

  effects.windStreaks.forEach((s) => s.dispose());
}
