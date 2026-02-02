import { resolveAsset } from './paths';

/** Skybox cubemap base paths (add _px, _nx, _py, _ny, _pz, _nz suffixes) */
export const SKYBOX_PATHS = {
  space: resolveAsset('assets/textures/skybox/space/space'),
  desert: resolveAsset('assets/textures/skybox/desert/desert'),
  ice: resolveAsset('assets/textures/skybox/ice/ice'),
  hive: resolveAsset('assets/textures/skybox/hive/hive'),
  dusk: resolveAsset('assets/textures/skybox/dusk/dusk'),
  night: resolveAsset('assets/textures/skybox/night/night'),
} as const;

/** HDRI environment textures (EXR format for PBR lighting) */
export const HDRI_PATHS = {
  space: resolveAsset('assets/textures/hdri/space.exr'),
  desert: resolveAsset('assets/textures/hdri/desert.exr'),
  ice: resolveAsset('assets/textures/hdri/ice.exr'),
  hive: resolveAsset('assets/textures/hdri/hive.exr'),
  dusk: resolveAsset('assets/textures/hdri/dusk.exr'),
  night: resolveAsset('assets/textures/hdri/night.exr'),
  underground: resolveAsset('assets/textures/hdri/underground.exr'),
  indoor: resolveAsset('assets/textures/hdri/indoor.exr'),
} as const;
