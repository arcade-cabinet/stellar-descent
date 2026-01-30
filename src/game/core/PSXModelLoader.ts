import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { LODManager } from './LODManager';

// Import GLTF loader
import '@babylonjs/loaders/glTF';

// PSX Model catalog - organized by category
export const PSX_MODELS = {
  structures: {
    floorCeiling1: '/models/psx/structures/floor_ceiling_hr_1.glb',
    floorCeiling3: '/models/psx/structures/floor_ceiling_hr_3.glb',
    floorCeilingRtx: '/models/psx/structures/floor_ceiling_rtx_1.glb',
    wallDouble: '/models/psx/structures/wall_hr_1_double.glb',
    wallHole: '/models/psx/structures/wall_hr_1_hole_1.glb',
    doorway: '/models/psx/structures/doorway_hr_1.glb',
    doorwayWide: '/models/psx/structures/doorway_hr_1_wide.glb',
    beamHorizontal: '/models/psx/structures/beam_hc_horizonatal_1.glb',
    beamVertical: '/models/psx/structures/beam_hc_vertical_1.glb',
    pipe1: '/models/psx/structures/pipe_cx_1.glb',
    pipe2: '/models/psx/structures/pipe_cx_2.glb',
  },
  doors: {
    door6: '/models/psx/doors/door_hr_6.glb',
    door12: '/models/psx/doors/door_hr_12.glb',
    door13: '/models/psx/doors/door_hr_13.glb',
  },
  lights: {
    lamp1: '/models/psx/lights/lamp_mx_1_a_on.glb',
    lamp2: '/models/psx/lights/lamp_mx_2_on.glb',
    lamp3: '/models/psx/lights/lamp_mx_3_on.glb',
  },
  props: {
    barrel1: '/models/psx/props/metal_barrel_hr_1.glb',
    barrel2: '/models/psx/props/metal_barrel_hr_2.glb',
    shelf: '/models/psx/props/shelf_mx_1.glb',
    box: '/models/psx/props/cardboard_box_1.glb',
    electrical: '/models/psx/props/electrical_equipment_1.glb',
    machinery: '/models/psx/props/machinery_mx_1.glb',
    pipes: '/models/psx/props/pipes_hr_1.glb',
  },
} as const;

// Model dimensions (in units, 1 unit = 1 meter)
export const PSX_DIMENSIONS = {
  floorTile: { width: 4, depth: 4, height: 0.4 },
  wall: { width: 4, depth: 0.4, height: 6 },
  doorway: { width: 4, depth: 0.42, height: 3 },
} as const;

export type PSXModelCategory = keyof typeof PSX_MODELS;
export type PSXModelName<T extends PSXModelCategory> = keyof (typeof PSX_MODELS)[T];

interface LoadedModel {
  root: TransformNode;
  meshes: AbstractMesh[];
}

// Cache for loaded models (for instancing)
const modelCache = new Map<string, LoadedModel>();

/**
 * Load a PSX model and return a cloned instance
 * @param applyLOD Whether to apply LOD to the model (default: true for environment, false for small props)
 */
export async function loadPSXModel(
  scene: Scene,
  category: PSXModelCategory,
  modelName: string,
  options?: {
    position?: Vector3;
    rotation?: Vector3;
    scale?: number | Vector3;
    parent?: TransformNode;
    applyLOD?: boolean;
    lodCategory?: string;
  }
): Promise<LoadedModel> {
  const path = (PSX_MODELS[category] as Record<string, string>)[modelName];
  if (!path) {
    throw new Error(`Model not found: ${category}/${modelName}`);
  }

  // Check cache
  let cached = modelCache.get(path);

  if (!cached) {
    // Load the model
    const result = await SceneLoader.ImportMeshAsync('', path, '', scene);

    // Create a root transform for the model
    const root = new TransformNode(`psx_${category}_${modelName}_master`, scene);

    // Parent all loaded meshes to the root
    for (const mesh of result.meshes) {
      if (!mesh.parent) {
        mesh.parent = root;
      }
    }

    // Hide the master copy
    root.setEnabled(false);

    cached = { root, meshes: result.meshes };
    modelCache.set(path, cached);
  }

  // Clone the model
  const instanceRoot = new TransformNode(`psx_${category}_${modelName}_${Date.now()}`, scene);

  // Clone meshes
  const clonedMeshes: AbstractMesh[] = [];
  for (const mesh of cached.meshes) {
    if (mesh.getTotalVertices() > 0) {
      const clone = mesh.clone(`${mesh.name}_clone`, instanceRoot);
      if (clone) {
        clone.setEnabled(true);
        clonedMeshes.push(clone);
      }
    }
  }

  // Apply LOD if requested (default for structures, lights)
  const shouldApplyLOD = options?.applyLOD ?? (category === 'structures' || category === 'lights');
  if (shouldApplyLOD && clonedMeshes.length > 0) {
    const lodCategory = options?.lodCategory ?? (category === 'props' ? 'prop' : 'environment');
    for (const mesh of clonedMeshes) {
      if (mesh instanceof Mesh) {
        LODManager.applyNativeLOD(mesh, lodCategory);
      }
    }
  }

  // Apply transforms
  if (options?.position) {
    instanceRoot.position = options.position;
  }
  if (options?.rotation) {
    instanceRoot.rotation = options.rotation;
  }
  if (options?.scale) {
    if (typeof options.scale === 'number') {
      instanceRoot.scaling = new Vector3(options.scale, options.scale, options.scale);
    } else {
      instanceRoot.scaling = options.scale;
    }
  }
  if (options?.parent) {
    instanceRoot.parent = options.parent;
  }

  return { root: instanceRoot, meshes: clonedMeshes };
}

/**
 * Preload multiple models for faster instantiation
 */
export async function preloadPSXModels(
  scene: Scene,
  models: Array<{ category: PSXModelCategory; name: string }>
): Promise<void> {
  const promises = models.map(({ category, name }) => loadPSXModel(scene, category, name));
  await Promise.all(promises);
}

/**
 * Clear the model cache
 */
export function clearPSXModelCache(): void {
  for (const cached of modelCache.values()) {
    cached.root.dispose();
  }
  modelCache.clear();
}

/**
 * Build a corridor section using PSX modular pieces
 */
export async function buildPSXCorridor(
  scene: Scene,
  parent: TransformNode,
  options: {
    length: number; // in tiles (each tile is 4 units)
    width: number; // in tiles
    includeFloor?: boolean;
    includeCeiling?: boolean;
    includeWalls?: boolean;
  }
): Promise<TransformNode> {
  const corridor = new TransformNode('psx_corridor', scene);
  corridor.parent = parent;

  const {
    length,
    width,
    includeFloor = true,
    includeCeiling = true,
    includeWalls = true,
  } = options;
  const tileSize = PSX_DIMENSIONS.floorTile.width;

  // Floor tiles
  if (includeFloor) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        await loadPSXModel(scene, 'structures', 'floorCeiling1', {
          position: new Vector3((x - width / 2 + 0.5) * tileSize, 0, -z * tileSize),
          parent: corridor,
        });
      }
    }
  }

  // Ceiling tiles
  if (includeCeiling) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        await loadPSXModel(scene, 'structures', 'floorCeiling1', {
          position: new Vector3(
            (x - width / 2 + 0.5) * tileSize,
            PSX_DIMENSIONS.wall.height,
            -z * tileSize
          ),
          rotation: new Vector3(Math.PI, 0, 0), // Flip for ceiling
          parent: corridor,
        });
      }
    }
  }

  // Walls
  if (includeWalls) {
    for (let z = 0; z < length; z++) {
      // Left wall
      await loadPSXModel(scene, 'structures', 'wallDouble', {
        position: new Vector3(
          (-width * tileSize) / 2,
          PSX_DIMENSIONS.wall.height / 2,
          -z * tileSize
        ),
        rotation: new Vector3(0, Math.PI / 2, 0),
        parent: corridor,
      });

      // Right wall
      await loadPSXModel(scene, 'structures', 'wallDouble', {
        position: new Vector3(
          (width * tileSize) / 2,
          PSX_DIMENSIONS.wall.height / 2,
          -z * tileSize
        ),
        rotation: new Vector3(0, -Math.PI / 2, 0),
        parent: corridor,
      });
    }
  }

  return corridor;
}
