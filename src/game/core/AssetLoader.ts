import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

export interface LoadingProgress {
  stage: string;
  progress: number;
  detail?: string;
}

export interface AssetManifest {
  textures: { name: string; url: string }[];
  // Add more asset types as needed: models, sounds, etc.
}

// Default manifest - add actual game assets here
export const DEFAULT_MANIFEST: AssetManifest = {
  textures: [{ name: 'rock', url: 'https://assets.babylonjs.com/textures/rock.png' }],
};

export class AssetLoader {
  private scene: Scene;
  private loadedAssets: Map<string, unknown> = new Map();
  private progressCallback?: (progress: LoadingProgress) => void;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  onProgress(callback: (progress: LoadingProgress) => void): void {
    this.progressCallback = callback;
  }

  private updateProgress(stage: string, progress: number, detail?: string): void {
    this.progressCallback?.({ stage, progress, detail });
  }

  async loadAll(manifest: AssetManifest = DEFAULT_MANIFEST): Promise<void> {
    const totalAssets = manifest.textures.length;
    let loadedCount = 0;

    this.updateProgress('INITIALIZING SYSTEMS', 0);

    // Load textures
    if (manifest.textures.length > 0) {
      this.updateProgress('LOADING TEXTURES', 5);

      for (const textureInfo of manifest.textures) {
        try {
          const texture = await this.loadTexture(textureInfo.name, textureInfo.url);
          this.loadedAssets.set(`texture:${textureInfo.name}`, texture);
          loadedCount++;
          const progress = 5 + (loadedCount / totalAssets) * 60;
          this.updateProgress('LOADING TEXTURES', progress, textureInfo.name);
        } catch (error) {
          console.warn(`Failed to load texture ${textureInfo.name}:`, error);
          loadedCount++;
        }
      }
    }

    this.updateProgress('COMPILING SHADERS', 70);
    // Shaders compile on first use, but we can trigger compilation here
    await this.waitFrame();

    this.updateProgress('INITIALIZING PHYSICS', 80);
    await this.waitFrame();

    this.updateProgress('PREPARING SCENE', 90);
    await this.waitFrame();

    this.updateProgress('SYSTEMS ONLINE', 100);
  }

  private loadTexture(name: string, url: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const texture = new Texture(
        url,
        this.scene,
        false, // noMipmap
        true, // invertY
        Texture.TRILINEAR_SAMPLINGMODE,
        () => resolve(texture),
        (message, exception) => reject(exception || new Error(message || 'Failed to load texture'))
      );
    });
  }

  private waitFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  getTexture(name: string): Texture | undefined {
    return this.loadedAssets.get(`texture:${name}`) as Texture | undefined;
  }

  dispose(): void {
    for (const [key, asset] of this.loadedAssets) {
      if (key.startsWith('texture:') && asset instanceof Texture) {
        asset.dispose();
      }
    }
    this.loadedAssets.clear();
  }
}
