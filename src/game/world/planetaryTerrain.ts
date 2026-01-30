import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { tokens } from '../utils/designTokens';

// Planet configuration
const PLANET_RADIUS = 50000; // Massive planet radius
const TERRAIN_RING_COUNT = 12; // Number of terrain rings around player
const RING_SEGMENT_COUNT = 24; // Segments per ring
const TERRAIN_RADIUS = 800; // Visible terrain radius around player
const CURVATURE_SCALE = 0.00002; // How much curvature to apply locally

// Shader for the distant planet surface (visible during drop)
const planetVertexShader = `
  precision highp float;
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;

  uniform mat4 world;
  uniform mat4 worldViewProjection;
  uniform vec3 playerPosition;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUV;
  varying float vDistanceFromPlayer;

  void main() {
    vec4 worldPos = world * vec4(position, 1.0);
    vPosition = worldPos.xyz;
    vNormal = normalize(mat3(world) * normal);
    vUV = uv;
    vDistanceFromPlayer = length(worldPos.xyz - playerPosition);
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

const planetFragmentShader = `
  precision highp float;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUV;
  varying float vDistanceFromPlayer;

  uniform vec3 sunDirection;
  uniform sampler2D rockTexture;

  // Simple noise for terrain variation
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    // Base terrain color - reddish brown alien rock
    vec3 baseColor = vec3(0.55, 0.4, 0.3);

    // Add texture
    vec3 texColor = texture2D(rockTexture, vUV * 50.0).rgb;

    // Add noise-based variation for different terrain regions
    float terrainNoise = fbm(vPosition.xz * 0.001);
    vec3 color1 = vec3(0.6, 0.45, 0.35); // Lighter rock
    vec3 color2 = vec3(0.4, 0.3, 0.25);  // Darker rock
    vec3 color3 = vec3(0.7, 0.5, 0.3);   // Rusty orange

    vec3 terrainColor = mix(color1, color2, terrainNoise);
    terrainColor = mix(terrainColor, color3, fbm(vPosition.xz * 0.003));

    // Combine with texture
    vec3 finalColor = mix(terrainColor, texColor * terrainColor, 0.5);

    // Lighting
    float NdotL = max(dot(vNormal, sunDirection), 0.0);
    float ambient = 0.25;
    float diffuse = NdotL * 0.75;

    finalColor *= (ambient + diffuse);

    // Distance fade to atmosphere color
    float atmosphereFade = smoothstep(500.0, 5000.0, vDistanceFromPlayer);
    vec3 atmosphereColor = vec3(0.35, 0.25, 0.2); // Dusty atmosphere
    finalColor = mix(finalColor, atmosphereColor, atmosphereFade * 0.6);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class PlanetaryTerrain {
  private scene: Scene;
  private planetSphere: Mesh | null = null;
  private localTerrain: Mesh | null = null;
  private terrainMaterial: StandardMaterial | null = null;
  private planetMaterial: ShaderMaterial | null = null;
  private rockTexture: Texture | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.registerShaders();
  }

  private registerShaders(): void {
    Effect.ShadersStore['planetSurfaceVertexShader'] = planetVertexShader;
    Effect.ShadersStore['planetSurfaceFragmentShader'] = planetFragmentShader;
  }

  createPlanet(): void {
    // Load texture first
    this.rockTexture = new Texture('https://assets.babylonjs.com/textures/rock.png', this.scene);

    // Create the massive planet sphere (visible during drop)
    this.planetSphere = MeshBuilder.CreateSphere(
      'planet',
      {
        diameter: PLANET_RADIUS * 2,
        segments: 64,
      },
      this.scene
    );

    // Position planet so surface is at y=0
    this.planetSphere.position.y = -PLANET_RADIUS;

    // Planet shader material
    this.planetMaterial = new ShaderMaterial(
      'planetMat',
      this.scene,
      {
        vertex: 'planetSurface',
        fragment: 'planetSurface',
      },
      {
        attributes: ['position', 'normal', 'uv'],
        uniforms: ['world', 'worldViewProjection', 'playerPosition', 'sunDirection'],
        samplers: ['rockTexture'],
      }
    );

    this.planetMaterial.setVector3('sunDirection', new Vector3(0.4, 0.3, -0.5).normalize());
    this.planetMaterial.setVector3('playerPosition', Vector3.Zero());
    this.planetMaterial.setTexture('rockTexture', this.rockTexture);
    this.planetMaterial.backFaceCulling = true;

    this.planetSphere.material = this.planetMaterial;

    // Create local high-detail terrain that follows player
    this.createLocalTerrain();
  }

  private createLocalTerrain(): void {
    // Create a curved ground mesh that simulates planetary curvature
    // This is what the player walks on
    const subdivisions = 128;
    const size = TERRAIN_RADIUS * 2;

    this.localTerrain = MeshBuilder.CreateGround(
      'localTerrain',
      {
        width: size,
        height: size,
        subdivisions: subdivisions,
        updatable: true,
      },
      this.scene
    );

    // Apply curvature to the mesh
    this.applyCurvature(this.localTerrain, subdivisions);

    // Material for local terrain
    this.terrainMaterial = new StandardMaterial('localTerrainMat', this.scene);
    this.terrainMaterial.diffuseColor = Color3.FromHexString('#8B6B4A');
    this.terrainMaterial.specularColor = new Color3(0.15, 0.12, 0.1);
    this.terrainMaterial.specularPower = 8;

    const groundTex = new Texture('https://assets.babylonjs.com/textures/rock.png', this.scene);
    groundTex.uScale = 80;
    groundTex.vScale = 80;
    this.terrainMaterial.diffuseTexture = groundTex;

    const bumpTex = new Texture('https://assets.babylonjs.com/textures/rockn.png', this.scene);
    bumpTex.uScale = 80;
    bumpTex.vScale = 80;
    this.terrainMaterial.bumpTexture = bumpTex;

    this.localTerrain.material = this.terrainMaterial;
    this.localTerrain.receiveShadows = true;
  }

  private applyCurvature(mesh: Mesh, subdivisions: number): void {
    const positions = mesh.getVerticesData('position');
    if (!positions) return;

    const newPositions = new Float32Array(positions.length);

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      // Calculate distance from center
      const distSq = x * x + z * z;

      // Apply spherical curvature - drop height based on distance from center
      // This simulates standing on a sphere where distant points curve away
      const curvatureDrop = distSq * CURVATURE_SCALE;

      newPositions[i] = x;
      newPositions[i + 1] = y - curvatureDrop;
      newPositions[i + 2] = z;
    }

    mesh.updateVerticesData('position', newPositions);
    mesh.createNormals(true);
  }

  // Update terrain position to follow player
  update(playerPosition: Vector3): void {
    if (this.localTerrain) {
      // Snap terrain to player XZ position (terrain moves with player)
      this.localTerrain.position.x = playerPosition.x;
      this.localTerrain.position.z = playerPosition.z;
    }

    // Update shader with player position for proper distance fading
    if (this.planetMaterial) {
      this.planetMaterial.setVector3('playerPosition', playerPosition);
    }
  }

  // Get the ground height at a position (accounting for curvature)
  getHeightAt(x: number, z: number): number {
    const distSq = x * x + z * z;
    return -distSq * CURVATURE_SCALE;
  }

  // Set visibility of planet sphere (hide when close to surface)
  setPlanetVisible(visible: boolean): void {
    if (this.planetSphere) {
      this.planetSphere.isVisible = visible;
    }
  }

  dispose(): void {
    this.planetSphere?.dispose();
    this.localTerrain?.dispose();
    this.terrainMaterial?.dispose();
    this.planetMaterial?.dispose();
    this.rockTexture?.dispose();
  }
}
