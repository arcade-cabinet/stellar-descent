/**
 * Cinematics Module
 *
 * Provides level intro cinematics with proper timing and callbacks.
 * Includes AI-powered asset generation and loading via Google Gemini.
 */

export {
  CinematicSystem,
  type CameraKeyframe,
  type CinematicCallbacks,
  type CinematicSequence,
  type CinematicStep,
  type DialogueLine,
  createAnchorStationIntroCinematic,
  createLandfallIntroCinematic,
  createTheBreachIntroCinematic,
  createFinalEscapeIntroCinematic,
} from './CinematicSystem';

// AI-powered cinematic asset loader
export {
  CinematicAssetLoader,
  getCinematicLoader,
  initializeCinematicLoader,
} from './CinematicAssetLoader';
