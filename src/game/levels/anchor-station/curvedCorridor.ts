import { Animation } from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Animations/animatable';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Mesh as BabylonMesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { AssetManager } from '../../core/AssetManager';
import { getLogger } from '../../core/Logger';

const log = getLogger('CurvedCorridor');

// Constants for mesh side orientation (replacing magic number 2)
const SIDE_DOUBLE = BabylonMesh.DOUBLESIDE; // Both sides visible

// ============================================================================
// GLB Asset Paths for Curved Corridor Elements
// ============================================================================

const CORRIDOR_MODELS = {
  // Windows
  window1: '/assets/models/environment/station/window_hr_1.glb',
  window2: '/assets/models/environment/station/window_hr_2.glb',

  // Light fixtures
  lightFixture: '/assets/models/props/industrial/lamp_mx_1_a_on.glb',

  // Pipes (for ceiling) - Note: curved pipes use MeshBuilder.CreateTube
  pipe1: '/assets/models/environment/station/pipe_cx_1.glb',
  pipe2: '/assets/models/environment/station/pipe_cx_2.glb',

  // Door frame pieces
  doorFrame: '/assets/models/environment/station/doorway_hr_1.glb',

  // Rivets/bolts for wall detailing
  rivet: '/assets/models/props/containers/bolt_mx_1.glb',
} as const;

/**
 * Preload all GLB assets needed for curved corridors.
 * Must be called before createCurvedCorridor() for GLB visuals to appear.
 */
export async function preloadCurvedCorridorAssets(scene: Scene): Promise<void> {
  const loadPromises = Object.values(CORRIDOR_MODELS).map((path) =>
    AssetManager.loadAssetByPath(path, scene)
  );
  await Promise.allSettled(loadPromises);
  log.info('Curved corridor assets preloaded');
}

/**
 * Place a GLB visual model at the specified position.
 * Returns the TransformNode root of the placed model, or null if loading fails.
 */
function placeVisualModel(
  scene: Scene,
  parent: TransformNode,
  assetPath: string,
  name: string,
  position: Vector3,
  rotation: Vector3,
  scale: Vector3,
  allMeshes: (Mesh | AbstractMesh)[]
): TransformNode | null {
  const node = AssetManager.createInstanceByPath(assetPath, name, scene, true, 'environment');
  if (node) {
    node.position = position;
    node.rotation = rotation;
    node.scaling = scale;
    node.parent = parent;
    // Add child meshes to tracking array
    const children = node.getChildMeshes();
    for (const mesh of children) {
      mesh.receiveShadows = true;
      mesh.checkCollisions = false; // Windows don't need collision
      allMeshes.push(mesh);
    }
  }
  return node;
}

// ============================================================================
// Curved Corridor System for Ring Station Design
// ============================================================================
// A rotating space station generates artificial gravity through centrifugal
// force. Corridors follow the ring's curve, not straight lines.
// ============================================================================

export interface CurvedCorridorConfig {
  // Station ring parameters
  ringRadius: number; // Distance from station center to corridor center
  arcAngle: number; // Total arc angle in radians
  startAngle: number; // Starting angle on the ring (0 = positive X)

  // Corridor dimensions
  width: number; // Side-to-side width
  height: number; // Floor to ceiling height

  // Segment resolution
  segments: number; // Number of segments along the curve

  // Visual features
  hasWindows: boolean; // Windows on outer wall
  windowCount: number; // Number of windows along corridor
  hasOverheadLights: boolean;
  lightCount: number;
  hasFloorGrating: boolean;
  hasPipes: boolean;
  hasRivets: boolean;

  // Doors
  hasDoorStart: boolean;
  hasDoorEnd: boolean;
}

export interface CurvedCorridorResult {
  root: TransformNode;
  meshes: Mesh[];
  lights: PointLight[];
  startDoor: Mesh | null;
  endDoor: Mesh | null;
  // Path data for collision/movement
  pathPoints: Vector3[];
  innerWallPoints: Vector3[];
  outerWallPoints: Vector3[];
  // Methods
  openDoor: (which: 'start' | 'end') => void;
  closeDoor: (which: 'start' | 'end') => void;
  dispose: () => void;
}

const DEFAULT_CONFIG: CurvedCorridorConfig = {
  ringRadius: 50,
  arcAngle: Math.PI / 6, // 30 degrees
  startAngle: 0,
  width: 4,
  height: 3,
  segments: 16,
  hasWindows: true,
  windowCount: 4,
  hasOverheadLights: true,
  lightCount: 3,
  hasFloorGrating: true,
  hasPipes: true,
  hasRivets: true,
  hasDoorStart: true,
  hasDoorEnd: true,
};

/**
 * Convert polar coordinates on the station ring to Cartesian
 * Station ring is in XZ plane, Y is up (floor/ceiling)
 */
function polarToCartesian(radius: number, angle: number): Vector3 {
  return new Vector3(radius * Math.cos(angle), 0, radius * Math.sin(angle));
}

/**
 * Get the tangent direction at a point on the ring (perpendicular to radius)
 */
function getTangent(angle: number): Vector3 {
  // Tangent is perpendicular to radius vector
  return new Vector3(-Math.sin(angle), 0, Math.cos(angle));
}

/**
 * Get the outward normal at a point on the ring (points away from center)
 */
function getOutwardNormal(angle: number): Vector3 {
  return new Vector3(Math.cos(angle), 0, Math.sin(angle));
}

/**
 * Create curved corridor mesh using ribbon geometry
 */
function createCurvedSurface(
  scene: Scene,
  parent: TransformNode,
  config: CurvedCorridorConfig,
  yOffset: number,
  widthOffset: number, // Positive = outer wall, negative = inner wall
  material: StandardMaterial,
  name: string
): Mesh {
  const paths: Vector3[][] = [];

  // Create two paths (bottom and top of surface)
  for (let pathIdx = 0; pathIdx <= 1; pathIdx++) {
    const path: Vector3[] = [];
    const y = yOffset + pathIdx * config.height;

    for (let i = 0; i <= config.segments; i++) {
      const t = i / config.segments;
      const angle = config.startAngle + t * config.arcAngle;
      const radius = config.ringRadius + widthOffset;

      const point = polarToCartesian(radius, angle);
      point.y = y;
      path.push(point);
    }
    paths.push(path);
  }

  const ribbon = MeshBuilder.CreateRibbon(
    name,
    {
      pathArray: paths,
      closeArray: false,
      closePath: false,
      sideOrientation: SIDE_DOUBLE,
    },
    scene
  );

  ribbon.material = material;
  ribbon.parent = parent;

  return ribbon;
}

/**
 * Create floor grating with guide stripe
 */
function createCurvedFloor(
  scene: Scene,
  parent: TransformNode,
  config: CurvedCorridorConfig,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): void {
  // Main floor surface
  const floorPaths: Vector3[][] = [];

  // Inner edge path
  const innerPath: Vector3[] = [];
  const outerPath: Vector3[] = [];

  for (let i = 0; i <= config.segments; i++) {
    const t = i / config.segments;
    const angle = config.startAngle + t * config.arcAngle;

    const innerRadius = config.ringRadius - config.width / 2;
    const outerRadius = config.ringRadius + config.width / 2;

    const innerPoint = polarToCartesian(innerRadius, angle);
    innerPoint.y = 0;
    innerPath.push(innerPoint);

    const outerPoint = polarToCartesian(outerRadius, angle);
    outerPoint.y = 0;
    outerPath.push(outerPoint);
  }

  floorPaths.push(innerPath);
  floorPaths.push(outerPath);

  const floor = MeshBuilder.CreateRibbon(
    'curvedFloor',
    {
      pathArray: floorPaths,
      closeArray: false,
      closePath: false,
      sideOrientation: SIDE_DOUBLE,
    },
    scene
  );
  floor.material = materials.get('floor')!;
  floor.parent = parent;
  allMeshes.push(floor);

  // Guide stripe down the center
  if (config.hasFloorGrating) {
    const guidePaths: Vector3[][] = [];
    const guideInner: Vector3[] = [];
    const guideOuter: Vector3[] = [];
    const guideWidth = 0.15;

    for (let i = 0; i <= config.segments; i++) {
      const t = i / config.segments;
      const angle = config.startAngle + t * config.arcAngle;

      const guideInnerPoint = polarToCartesian(config.ringRadius - guideWidth, angle);
      guideInnerPoint.y = 0.02;
      guideInner.push(guideInnerPoint);

      const guideOuterPoint = polarToCartesian(config.ringRadius + guideWidth, angle);
      guideOuterPoint.y = 0.02;
      guideOuter.push(guideOuterPoint);
    }

    guidePaths.push(guideInner);
    guidePaths.push(guideOuter);

    const guideLine = MeshBuilder.CreateRibbon(
      'guideStripe',
      {
        pathArray: guidePaths,
        closeArray: false,
        closePath: false,
      },
      scene
    );
    guideLine.material = materials.get('guide')!;
    guideLine.parent = parent;
    allMeshes.push(guideLine);
  }
}

/**
 * Create curved walls with optional windows
 */
function createCurvedWalls(
  scene: Scene,
  parent: TransformNode,
  config: CurvedCorridorConfig,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[]
): void {
  const wallThickness = 0.3;

  // Inner wall (closer to station center) - solid
  const innerWall = createCurvedSurface(
    scene,
    parent,
    config,
    0,
    -config.width / 2 - wallThickness / 2,
    materials.get('hull')!,
    'innerWall'
  );
  allMeshes.push(innerWall);

  // Outer wall - with windows or solid
  if (config.hasWindows && config.windowCount > 0) {
    // Create wall segments between windows
    const windowArcSpacing = config.arcAngle / (config.windowCount + 1);
    const windowArcWidth = windowArcSpacing * 0.4; // Window takes 40% of spacing
    const _wallArcWidth = windowArcSpacing * 0.6; // Wall takes 60%

    for (let w = 0; w <= config.windowCount; w++) {
      // Wall segment before/between/after windows
      const segmentStartAngle =
        w === 0 ? config.startAngle : config.startAngle + w * windowArcSpacing + windowArcWidth / 2;

      const segmentEndAngle =
        w === config.windowCount
          ? config.startAngle + config.arcAngle
          : config.startAngle + (w + 1) * windowArcSpacing - windowArcWidth / 2;

      const segmentArc = segmentEndAngle - segmentStartAngle;

      if (segmentArc > 0.01) {
        const wallConfig: CurvedCorridorConfig = {
          ...config,
          startAngle: segmentStartAngle,
          arcAngle: segmentArc,
          segments: Math.max(2, Math.floor(config.segments * (segmentArc / config.arcAngle))),
        };

        const wallSegment = createCurvedSurface(
          scene,
          parent,
          wallConfig,
          0,
          config.width / 2 + wallThickness / 2,
          materials.get('hull')!,
          `outerWallSegment_${w}`
        );
        allMeshes.push(wallSegment);
      }

      // Window (if not last segment)
      if (w < config.windowCount) {
        const windowAngle = config.startAngle + (w + 1) * windowArcSpacing;
        const windowPos = polarToCartesian(config.ringRadius + config.width / 2, windowAngle);
        windowPos.y = config.height * 0.5;

        // Rotate to face outward
        const outwardAngle = windowAngle + Math.PI / 2;

        // Use GLB window model (alternating between window1 and window2 for variety)
        const windowModelPath = w % 2 === 0 ? CORRIDOR_MODELS.window1 : CORRIDOR_MODELS.window2;
        placeVisualModel(
          scene,
          parent,
          windowModelPath,
          `window_${w}`,
          new Vector3(windowPos.x, 0, windowPos.z),
          new Vector3(0, outwardAngle, 0),
          new Vector3(1, 1, 1),
          allMeshes
        );
      }
    }
  } else {
    // Solid outer wall
    const outerWall = createCurvedSurface(
      scene,
      parent,
      config,
      0,
      config.width / 2 + wallThickness / 2,
      materials.get('hull')!,
      'outerWall'
    );
    allMeshes.push(outerWall);
  }

  // Add rivets along walls using GLB bolt models
  if (config.hasRivets) {
    const rivetSpacing = config.arcAngle / 12;
    for (let i = 1; i < 12; i++) {
      const angle = config.startAngle + i * rivetSpacing;

      // Inner wall rivets (two rows)
      for (const yOffset of [0.3, config.height - 0.3]) {
        const innerRivetPos = polarToCartesian(config.ringRadius - config.width / 2 + 0.05, angle);
        innerRivetPos.y = yOffset;

        // Use GLB bolt model for rivets
        placeVisualModel(
          scene,
          parent,
          CORRIDOR_MODELS.rivet,
          `rivet_inner_${i}_${yOffset}`,
          innerRivetPos,
          new Vector3(Math.PI / 2, angle + Math.PI, 0), // Rotate to face outward from wall
          new Vector3(0.3, 0.3, 0.3), // Scale down the bolt
          allMeshes
        );
      }

      // Outer wall rivets (between windows)
      if (!config.hasWindows || i % 3 !== 0) {
        for (const yOffset of [0.3, config.height - 0.3]) {
          const outerRivetPos = polarToCartesian(
            config.ringRadius + config.width / 2 - 0.05,
            angle
          );
          outerRivetPos.y = yOffset;

          // Use GLB bolt model for rivets
          placeVisualModel(
            scene,
            parent,
            CORRIDOR_MODELS.rivet,
            `rivet_outer_${i}_${yOffset}`,
            outerRivetPos,
            new Vector3(Math.PI / 2, angle, 0), // Rotate to face inward from wall
            new Vector3(0.3, 0.3, 0.3), // Scale down the bolt
            allMeshes
          );
        }
      }
    }
  }
}

/**
 * Create curved ceiling with lights
 */
function createCurvedCeiling(
  scene: Scene,
  parent: TransformNode,
  config: CurvedCorridorConfig,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[],
  allLights: PointLight[]
): void {
  // Ceiling surface
  const ceilingPaths: Vector3[][] = [];
  const innerPath: Vector3[] = [];
  const outerPath: Vector3[] = [];

  for (let i = 0; i <= config.segments; i++) {
    const t = i / config.segments;
    const angle = config.startAngle + t * config.arcAngle;

    const innerRadius = config.ringRadius - config.width / 2;
    const outerRadius = config.ringRadius + config.width / 2;

    const innerPoint = polarToCartesian(innerRadius, angle);
    innerPoint.y = config.height;
    innerPath.push(innerPoint);

    const outerPoint = polarToCartesian(outerRadius, angle);
    outerPoint.y = config.height;
    outerPath.push(outerPoint);
  }

  ceilingPaths.push(innerPath);
  ceilingPaths.push(outerPath);

  const ceiling = MeshBuilder.CreateRibbon(
    'curvedCeiling',
    {
      pathArray: ceilingPaths,
      closeArray: false,
      closePath: false,
      sideOrientation: SIDE_DOUBLE,
    },
    scene
  );
  ceiling.material = materials.get('hull')!;
  ceiling.parent = parent;
  allMeshes.push(ceiling);

  // Overhead lights
  if (config.hasOverheadLights && config.lightCount > 0) {
    const lightSpacing = config.arcAngle / (config.lightCount + 1);

    for (let i = 1; i <= config.lightCount; i++) {
      const angle = config.startAngle + i * lightSpacing;
      const lightPos = polarToCartesian(config.ringRadius, angle);
      lightPos.y = config.height - 0.15;

      // Light fixture - GLB model
      placeVisualModel(
        scene,
        parent,
        CORRIDOR_MODELS.lightFixture,
        `lightFixture_${i}`,
        new Vector3(lightPos.x, config.height - 0.3, lightPos.z),
        new Vector3(0, angle, 0),
        new Vector3(0.5, 0.5, 0.5),
        allMeshes
      );

      // Point light (BabylonJS light source - not geometry)
      const light = new PointLight(`corridorLight_${i}`, lightPos.clone(), scene);
      light.diffuse = new Color3(0.9, 0.95, 1);
      light.intensity = 0.4;
      light.range = 12;
      allLights.push(light);
    }
  }

  // Pipes along ceiling
  if (config.hasPipes) {
    const pipeOffsets = [-0.8, 0.8];

    for (const offset of pipeOffsets) {
      const pipePaths: Vector3[] = [];

      for (let i = 0; i <= config.segments; i++) {
        const t = i / config.segments;
        const angle = config.startAngle + t * config.arcAngle;
        const pipePoint = polarToCartesian(config.ringRadius + offset, angle);
        pipePoint.y = config.height - 0.1;
        pipePaths.push(pipePoint);
      }

      const pipe = MeshBuilder.CreateTube(
        `ceilingPipe_${offset}`,
        {
          path: pipePaths,
          radius: 0.08,
          tessellation: 8,
          sideOrientation: SIDE_DOUBLE,
        },
        scene
      );
      pipe.material = materials.get('pipe')!;
      pipe.parent = parent;
      allMeshes.push(pipe);
    }
  }
}

/**
 * Create automatic sliding doors at corridor endpoints
 */
function createCorridorDoor(
  scene: Scene,
  parent: TransformNode,
  config: CurvedCorridorConfig,
  materials: Map<string, StandardMaterial>,
  allMeshes: Mesh[],
  angle: number,
  name: string
): Mesh {
  const doorPos = polarToCartesian(config.ringRadius, angle);
  doorPos.y = config.height / 2 - 0.15;

  // Door frame
  const frameWidth = config.width;
  const frameHeight = config.height;

  // Calculate door orientation (perpendicular to corridor path)
  const tangent = getTangent(angle);
  const doorRotationY = Math.atan2(tangent.x, tangent.z);

  // Door panels (split in half for sliding)
  const doorLeft = MeshBuilder.CreateBox(
    `${name}_left`,
    { width: frameWidth / 2 - 0.1, height: frameHeight - 0.3, depth: 0.1 },
    scene
  );
  doorLeft.position = doorPos.clone();
  doorLeft.position.y = (frameHeight - 0.3) / 2;
  // Offset to left side
  const leftOffset = getOutwardNormal(angle).scale(-frameWidth / 4);
  doorLeft.position.addInPlace(leftOffset);
  doorLeft.rotation.y = doorRotationY;
  doorLeft.material = materials.get('hull')!;
  doorLeft.parent = parent;
  allMeshes.push(doorLeft);

  const doorRight = MeshBuilder.CreateBox(
    `${name}_right`,
    { width: frameWidth / 2 - 0.1, height: frameHeight - 0.3, depth: 0.1 },
    scene
  );
  doorRight.position = doorPos.clone();
  doorRight.position.y = (frameHeight - 0.3) / 2;
  const rightOffset = getOutwardNormal(angle).scale(frameWidth / 4);
  doorRight.position.addInPlace(rightOffset);
  doorRight.rotation.y = doorRotationY;
  doorRight.material = materials.get('hull')!;
  doorRight.parent = parent;
  allMeshes.push(doorRight);

  // Door frame - GLB model placed above the door
  placeVisualModel(
    scene,
    parent,
    CORRIDOR_MODELS.doorFrame,
    `${name}_frame`,
    new Vector3(doorPos.x, 0, doorPos.z),
    new Vector3(0, doorRotationY, 0),
    new Vector3(1, 1, 1),
    allMeshes
  );

  // Status light (VFX - animated emissive color)
  const statusLight = MeshBuilder.CreateSphere(`${name}_status`, { diameter: 0.12 }, scene);
  statusLight.position = doorPos.clone();
  statusLight.position.y = frameHeight + 0.2;
  statusLight.material = materials.get('active')!;
  statusLight.parent = parent;
  allMeshes.push(statusLight);

  // Store door panels in userData for animation
  (doorLeft as any).doorPair = doorRight;
  (doorLeft as any).statusLight = statusLight;
  (doorLeft as any).slideDirection = getOutwardNormal(angle);

  return doorLeft;
}

/**
 * Build the collision/movement path data
 */
function buildPathData(config: CurvedCorridorConfig): {
  pathPoints: Vector3[];
  innerWallPoints: Vector3[];
  outerWallPoints: Vector3[];
} {
  const pathPoints: Vector3[] = [];
  const innerWallPoints: Vector3[] = [];
  const outerWallPoints: Vector3[] = [];

  for (let i = 0; i <= config.segments; i++) {
    const t = i / config.segments;
    const angle = config.startAngle + t * config.arcAngle;

    // Center path
    const centerPoint = polarToCartesian(config.ringRadius, angle);
    centerPoint.y = 0;
    pathPoints.push(centerPoint);

    // Wall boundaries
    const innerPoint = polarToCartesian(config.ringRadius - config.width / 2 + 0.3, angle);
    innerPoint.y = 0;
    innerWallPoints.push(innerPoint);

    const outerPoint = polarToCartesian(config.ringRadius + config.width / 2 - 0.3, angle);
    outerPoint.y = 0;
    outerWallPoints.push(outerPoint);
  }

  return { pathPoints, innerWallPoints, outerWallPoints };
}

/**
 * Main function to create a curved corridor
 */
export function createCurvedCorridor(
  scene: Scene,
  materials: Map<string, StandardMaterial>,
  config: Partial<CurvedCorridorConfig> = {}
): CurvedCorridorResult {
  const fullConfig: CurvedCorridorConfig = { ...DEFAULT_CONFIG, ...config };

  const root = new TransformNode('curvedCorridor', scene);
  const meshes: Mesh[] = [];
  const lights: PointLight[] = [];

  // Build geometry
  createCurvedFloor(scene, root, fullConfig, materials, meshes);
  createCurvedWalls(scene, root, fullConfig, materials, meshes);
  createCurvedCeiling(scene, root, fullConfig, materials, meshes, lights);

  // Doors
  let startDoor: Mesh | null = null;
  let endDoor: Mesh | null = null;

  if (fullConfig.hasDoorStart) {
    startDoor = createCorridorDoor(
      scene,
      root,
      fullConfig,
      materials,
      meshes,
      fullConfig.startAngle,
      'startDoor'
    );
  }

  if (fullConfig.hasDoorEnd) {
    endDoor = createCorridorDoor(
      scene,
      root,
      fullConfig,
      materials,
      meshes,
      fullConfig.startAngle + fullConfig.arcAngle,
      'endDoor'
    );
  }

  // Path data for collision
  const pathData = buildPathData(fullConfig);

  // Door animation functions
  const animateDoor = (door: Mesh, open: boolean) => {
    const doorRight = (door as any).doorPair as Mesh;
    const slideDir = (door as any).slideDirection as Vector3;
    const statusLight = (door as any).statusLight as Mesh;
    const slideDistance = fullConfig.width / 2;

    // Left door slides inward (negative direction)
    const leftAnim = new Animation(
      'doorSlideLeft',
      'position',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const leftStart = door.position.clone();
    const leftEnd = leftStart.add(slideDir.scale(open ? -slideDistance : 0));

    leftAnim.setKeys([
      { frame: 0, value: open ? leftStart : leftEnd },
      { frame: 20, value: open ? leftEnd : leftStart },
    ]);

    door.animations = [leftAnim];
    scene.beginAnimation(door, 0, 20, false);

    // Right door slides outward (positive direction)
    const rightAnim = new Animation(
      'doorSlideRight',
      'position',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    const rightStart = doorRight.position.clone();
    const rightEnd = rightStart.add(slideDir.scale(open ? slideDistance : 0));

    rightAnim.setKeys([
      { frame: 0, value: open ? rightStart : rightEnd },
      { frame: 20, value: open ? rightEnd : rightStart },
    ]);

    doorRight.animations = [rightAnim];
    scene.beginAnimation(doorRight, 0, 20, false);

    // Update status light color
    const lightMat = statusLight.material as StandardMaterial;
    if (open) {
      lightMat.emissiveColor = new Color3(0, 1, 0.3);
    } else {
      lightMat.emissiveColor = new Color3(1, 0.3, 0);
    }
  };

  const openDoor = (which: 'start' | 'end') => {
    const door = which === 'start' ? startDoor : endDoor;
    if (door) animateDoor(door, true);
  };

  const closeDoor = (which: 'start' | 'end') => {
    const door = which === 'start' ? startDoor : endDoor;
    if (door) animateDoor(door, false);
  };

  const dispose = () => {
    for (const mesh of meshes) {
      mesh.dispose();
    }
    for (const light of lights) {
      light.dispose();
    }
    root.dispose();
  };

  return {
    root,
    meshes,
    lights,
    startDoor,
    endDoor,
    ...pathData,
    openDoor,
    closeDoor,
    dispose,
  };
}

/**
 * Helper: Get Cartesian position from corridor path parameter
 * @param config Corridor configuration
 * @param t Parameter along corridor (0 = start, 1 = end)
 */
export function getPositionOnCorridor(config: CurvedCorridorConfig, t: number): Vector3 {
  const angle = config.startAngle + t * config.arcAngle;
  const pos = polarToCartesian(config.ringRadius, angle);
  pos.y = 1.7; // Standing height
  return pos;
}

/**
 * Helper: Check if a position is within corridor bounds
 */
export function isInCorridor(
  config: CurvedCorridorConfig,
  position: Vector3,
  tolerance: number = 0.5
): boolean {
  // Convert position to polar
  const radius = Math.sqrt(position.x * position.x + position.z * position.z);
  const angle = Math.atan2(position.z, position.x);

  // Normalize angle to corridor range
  let normalizedAngle = angle;
  while (normalizedAngle < config.startAngle) normalizedAngle += Math.PI * 2;
  while (normalizedAngle > config.startAngle + Math.PI * 2) normalizedAngle -= Math.PI * 2;

  // Check if within arc
  const inArc =
    normalizedAngle >= config.startAngle - tolerance &&
    normalizedAngle <= config.startAngle + config.arcAngle + tolerance;

  // Check if within radial bounds
  const innerBound = config.ringRadius - config.width / 2 - tolerance;
  const outerBound = config.ringRadius + config.width / 2 + tolerance;
  const inRadius = radius >= innerBound && radius <= outerBound;

  return inArc && inRadius;
}

/**
 * Helper: Clamp position to corridor bounds
 */
export function clampToCorridor(config: CurvedCorridorConfig, position: Vector3): Vector3 {
  // Convert to polar
  let radius = Math.sqrt(position.x * position.x + position.z * position.z);
  let angle = Math.atan2(position.z, position.x);

  // Clamp radius
  const innerBound = config.ringRadius - config.width / 2 + 0.3;
  const outerBound = config.ringRadius + config.width / 2 - 0.3;
  radius = Math.max(innerBound, Math.min(outerBound, radius));

  // Clamp angle
  angle = Math.max(config.startAngle, Math.min(config.startAngle + config.arcAngle, angle));

  // Convert back to Cartesian
  return new Vector3(radius * Math.cos(angle), position.y, radius * Math.sin(angle));
}
