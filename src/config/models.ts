import { resolveAsset } from './paths';

/** Enemy GLB models (Chitin species) */
export const ENEMY_MODELS = {
  spider: resolveAsset('assets/models/enemies/chitin/spider.glb'),
  scout: resolveAsset('assets/models/enemies/chitin/scout.glb'),
  soldier: resolveAsset('assets/models/enemies/chitin/soldier.glb'),
  flyingalien: resolveAsset('assets/models/enemies/chitin/flyingalien.glb'),
  tentakel: resolveAsset('assets/models/enemies/chitin/tentakel.glb'),
  alienmonster: resolveAsset('assets/models/enemies/chitin/alienmonster.glb'),
  alienmale: resolveAsset('assets/models/enemies/chitin/alienmale.glb'),
  alienfemale: resolveAsset('assets/models/enemies/chitin/alienfemale.glb'),
  alien_scifi: resolveAsset('assets/models/enemies/chitin/alien_scifi.glb'),
} as const;

/** NPC Marine models */
export const NPC_MODELS = {
  marine_soldier: resolveAsset('assets/models/npcs/marine/marine_soldier.glb'),
  marine_sergeant: resolveAsset('assets/models/npcs/marine/marine_sergeant.glb'),
  marine_crusader: resolveAsset('assets/models/npcs/marine/marine_crusader.glb'),
  marine_elite: resolveAsset('assets/models/npcs/marine/marine_elite.glb'),
} as const;

/** Vehicle models */
export const VEHICLE_MODELS = {
  wraith: resolveAsset('assets/models/vehicles/chitin/wraith.glb'),
  phantom: resolveAsset('assets/models/vehicles/phantom.glb'),
  marcus_mech: resolveAsset('assets/models/vehicles/marcus_mech.glb'),
} as const;

/** Spaceship models (decorative / environment) */
export const SPACESHIP_MODELS = {
  challenger: resolveAsset('assets/models/spaceships/Challenger.glb'),
  omen: resolveAsset('assets/models/spaceships/Omen.glb'),
  bob: resolveAsset('assets/models/spaceships/Bob.glb'),
  insurgent: resolveAsset('assets/models/spaceships/Insurgent.glb'),
  striker: resolveAsset('assets/models/spaceships/Striker.glb'),
  dispatcher: resolveAsset('assets/models/spaceships/Dispatcher.glb'),
} as const;

/** Player model */
export const PLAYER_MODEL = resolveAsset('assets/models/npcs/marine/marine_soldier.glb');

/** Mech model */
export const MECH_MODEL = resolveAsset('assets/models/vehicles/marcus_mech.glb');
