/**
 * Cinematics Module
 *
 * Provides level intro cinematics with proper timing and callbacks.
 * Includes AI-powered asset generation and loading via Google Gemini.
 */

// AI-powered cinematic asset loader
export {
  CinematicAssetLoader,
  getCinematicLoader,
  initializeCinematicLoader,
} from './CinematicAssetLoader';
export {
  type CameraKeyframe,
  type CinematicCallbacks,
  type CinematicSequence,
  type CinematicStep,
  CinematicSystem,
  createAnchorStationIntroCinematic,
  createFinalEscapeIntroCinematic,
  createLandfallIntroCinematic,
  createTheBreachIntroCinematic,
  type DialogueLine,
} from './CinematicSystem';
