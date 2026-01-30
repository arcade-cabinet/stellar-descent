/**
 * MobileShaderOptimizer - Simplified shaders for mobile devices
 *
 * Provides:
 * - Simplified vertex/fragment shaders with fewer calculations
 * - Reduced texture lookups
 * - Lower precision where appropriate
 * - Disabled normal mapping on mobile
 *
 * Usage:
 *   const optimizer = getMobileShaderOptimizer();
 *   const material = optimizer.createOptimizedMaterial(scene, 'myMaterial', baseColor);
 */

import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import { getPerformanceManager } from './PerformanceManager';

// ============================================================================
// SIMPLIFIED MOBILE SHADERS
// ============================================================================

/**
 * Simple vertex shader - minimal transformations
 */
const MOBILE_VERTEX_SHADER = `
precision mediump float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 world;
uniform mat4 worldViewProjection;
uniform vec3 lightDirection;

varying vec2 vUV;
varying float vNdotL;

void main() {
    vUV = uv;

    // Simple diffuse lighting calculation in vertex shader (cheaper)
    vec3 worldNormal = normalize(mat3(world) * normal);
    vNdotL = max(dot(worldNormal, -lightDirection), 0.0);

    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

/**
 * Simple fragment shader - basic diffuse with ambient
 */
const MOBILE_FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vUV;
varying float vNdotL;

uniform vec3 diffuseColor;
uniform float ambientLevel;
uniform sampler2D diffuseTexture;
uniform bool hasTexture;

void main() {
    vec3 baseColor = diffuseColor;

    if (hasTexture) {
        baseColor *= texture2D(diffuseTexture, vUV).rgb;
    }

    // Simple lighting: ambient + diffuse
    float lighting = ambientLevel + (1.0 - ambientLevel) * vNdotL;
    vec3 finalColor = baseColor * lighting;

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Unlit vertex shader - absolute minimum for UI/effects
 */
const UNLIT_VERTEX_SHADER = `
precision lowp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 worldViewProjection;

varying vec2 vUV;

void main() {
    vUV = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

/**
 * Unlit fragment shader - just color/texture output
 */
const UNLIT_FRAGMENT_SHADER = `
precision lowp float;

varying vec2 vUV;

uniform vec3 color;
uniform float alpha;
uniform sampler2D diffuseTexture;
uniform bool hasTexture;

void main() {
    vec3 finalColor = color;

    if (hasTexture) {
        vec4 texColor = texture2D(diffuseTexture, vUV);
        finalColor *= texColor.rgb;
    }

    gl_FragColor = vec4(finalColor, alpha);
}
`;

// ============================================================================
// SHADER OPTIMIZER CLASS
// ============================================================================

class MobileShaderOptimizer {
  private static instance: MobileShaderOptimizer | null = null;
  private shadersRegistered = false;

  private constructor() {}

  static getInstance(): MobileShaderOptimizer {
    if (!MobileShaderOptimizer.instance) {
      MobileShaderOptimizer.instance = new MobileShaderOptimizer();
    }
    return MobileShaderOptimizer.instance;
  }

  /**
   * Register mobile shaders with Babylon.js shader store
   */
  registerShaders(): void {
    if (this.shadersRegistered) return;

    // Register mobile-optimized shaders
    Effect.ShadersStore['mobileVertexShader'] = MOBILE_VERTEX_SHADER;
    Effect.ShadersStore['mobileFragmentShader'] = MOBILE_FRAGMENT_SHADER;
    Effect.ShadersStore['unlitVertexShader'] = UNLIT_VERTEX_SHADER;
    Effect.ShadersStore['unlitFragmentShader'] = UNLIT_FRAGMENT_SHADER;

    this.shadersRegistered = true;
    console.log('[MobileShaderOptimizer] Shaders registered');
  }

  /**
   * Create an optimized material based on device capability
   * Returns ShaderMaterial on mobile, StandardMaterial on desktop
   */
  createOptimizedMaterial(
    scene: Scene,
    name: string,
    options: {
      diffuseColor?: Color3;
      ambientLevel?: number;
      lightDirection?: { x: number; y: number; z: number };
    } = {}
  ): StandardMaterial | ShaderMaterial {
    const perfManager = getPerformanceManager();
    const isMobile = perfManager.isMobile();
    const qualityLevel = perfManager.getQuality();

    // On desktop or high quality mobile, use standard material
    if (!isMobile || qualityLevel === 'high' || qualityLevel === 'ultra') {
      return this.createStandardMaterial(scene, name, options);
    }

    // On mobile with lower quality, use optimized shader
    return this.createMobileShaderMaterial(scene, name, options);
  }

  /**
   * Create a standard Babylon.js material (desktop/high-quality)
   */
  private createStandardMaterial(
    scene: Scene,
    name: string,
    options: {
      diffuseColor?: Color3;
      ambientLevel?: number;
    }
  ): StandardMaterial {
    const material = new StandardMaterial(name, scene);

    if (options.diffuseColor) {
      material.diffuseColor = options.diffuseColor;
    }

    // Reduce specular for better mobile performance
    const perfManager = getPerformanceManager();
    if (perfManager.isMobile()) {
      material.specularColor = new Color3(0, 0, 0);
      material.specularPower = 1;
    }

    return material;
  }

  /**
   * Create a mobile-optimized shader material
   */
  private createMobileShaderMaterial(
    scene: Scene,
    name: string,
    options: {
      diffuseColor?: Color3;
      ambientLevel?: number;
      lightDirection?: { x: number; y: number; z: number };
    }
  ): ShaderMaterial {
    this.registerShaders();

    const material = new ShaderMaterial(
      name,
      scene,
      {
        vertex: 'mobile',
        fragment: 'mobile',
      },
      {
        attributes: ['position', 'normal', 'uv'],
        uniforms: [
          'world',
          'worldViewProjection',
          'diffuseColor',
          'ambientLevel',
          'lightDirection',
          'hasTexture',
        ],
        samplers: ['diffuseTexture'],
      }
    );

    // Set defaults
    const color = options.diffuseColor ?? new Color3(0.5, 0.5, 0.5);
    const ambient = options.ambientLevel ?? 0.3;
    const lightDir = options.lightDirection ?? { x: 0.4, y: -0.6, z: -0.5 };

    material.setColor3('diffuseColor', color);
    material.setFloat('ambientLevel', ambient);
    material.setVector3('lightDirection', {
      x: lightDir.x,
      y: lightDir.y,
      z: lightDir.z,
    } as any);
    material.setInt('hasTexture', 0);

    return material;
  }

  /**
   * Create an unlit material for UI elements and effects
   */
  createUnlitMaterial(
    scene: Scene,
    name: string,
    options: {
      color?: Color3;
      alpha?: number;
    } = {}
  ): ShaderMaterial {
    this.registerShaders();

    const material = new ShaderMaterial(
      name,
      scene,
      {
        vertex: 'unlit',
        fragment: 'unlit',
      },
      {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'color', 'alpha', 'hasTexture'],
        samplers: ['diffuseTexture'],
      }
    );

    const color = options.color ?? new Color3(1, 1, 1);
    const alpha = options.alpha ?? 1.0;

    material.setColor3('color', color);
    material.setFloat('alpha', alpha);
    material.setInt('hasTexture', 0);

    // Enable alpha blending if not fully opaque
    if (alpha < 1.0) {
      material.alphaMode = 2; // ALPHA_COMBINE
    }

    return material;
  }

  /**
   * Optimize an existing StandardMaterial for mobile
   * Modifies the material in-place
   */
  optimizeStandardMaterial(material: StandardMaterial): void {
    const perfManager = getPerformanceManager();

    if (!perfManager.isMobile()) return;

    const quality = perfManager.getQuality();

    // Disable specular highlights on low/potato quality
    if (quality === 'low' || quality === 'potato') {
      material.specularColor = new Color3(0, 0, 0);
      material.specularPower = 1;
    }

    // Disable bump/normal maps on mobile
    if (material.bumpTexture) {
      material.bumpTexture = null;
    }

    // Reduce texture filtering on potato quality
    if (quality === 'potato') {
      if (material.diffuseTexture) {
        material.diffuseTexture.updateSamplingMode(1); // NEAREST
      }
    }

    // Disable fresnel effects
    material.useReflectionFresnelFromSpecular = false;

    // Freeze the material to prevent unnecessary updates
    material.freeze();
  }

  /**
   * Batch optimize all StandardMaterials in a scene
   */
  optimizeSceneMaterials(scene: Scene): void {
    const perfManager = getPerformanceManager();

    if (!perfManager.isMobile()) return;

    let optimizedCount = 0;

    for (const material of scene.materials) {
      if (material instanceof StandardMaterial) {
        this.optimizeStandardMaterial(material);
        optimizedCount++;
      }
    }

    console.log(`[MobileShaderOptimizer] Optimized ${optimizedCount} materials`);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const getMobileShaderOptimizer =
  MobileShaderOptimizer.getInstance.bind(MobileShaderOptimizer);

/**
 * Helper to check if we should use simplified shaders
 */
export function shouldUseSimplifiedShaders(): boolean {
  const perfManager = getPerformanceManager();
  const quality = perfManager.getQuality();
  return (
    perfManager.isMobile() && (quality === 'low' || quality === 'potato' || quality === 'medium')
  );
}
