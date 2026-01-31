import {
  EffectLayer,
  ThinEffectLayer
} from "./chunk-5KW3BTBO.js";
import {
  Material
} from "./chunk-354MVM62.js";
import {
  BlurPostProcess,
  ThinBlurPostProcess
} from "./chunk-INKIDW57.js";
import {
  RenderTargetTexture
} from "./chunk-5THHQJAG.js";
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import {
  Scene
} from "./chunk-WNGJ3WNO.js";
import {
  VertexBuffer
} from "./chunk-ZOIT5ZEZ.js";
import {
  GetExponentOfTwo
} from "./chunk-N5T6XPNQ.js";
import {
  SerializationHelper
} from "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize
} from "./chunk-STIKNZXL.js";
import {
  Color4
} from "./chunk-I3IYKWNG.js";
import {
  Vector2
} from "./chunk-YLLTSBLI.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Layers/thinGlowLayer.js
var ThinGlowLayer = class _ThinGlowLayer extends ThinEffectLayer {
  /**
   * Gets the ldrMerge option.
   */
  get ldrMerge() {
    return this._options.ldrMerge;
  }
  /**
   * Sets the kernel size of the blur.
   */
  set blurKernelSize(value) {
    if (value === this._options.blurKernelSize) {
      return;
    }
    this._options.blurKernelSize = value;
    const effectiveKernel = this._getEffectiveBlurKernelSize();
    this._horizontalBlurPostprocess1.kernel = effectiveKernel;
    this._verticalBlurPostprocess1.kernel = effectiveKernel;
    this._horizontalBlurPostprocess2.kernel = effectiveKernel;
    this._verticalBlurPostprocess2.kernel = effectiveKernel;
  }
  /**
   * Gets the kernel size of the blur.
   */
  get blurKernelSize() {
    return this._options.blurKernelSize;
  }
  /**
   * Sets the glow intensity.
   */
  set intensity(value) {
    this._intensity = value;
  }
  /**
   * Gets the glow intensity.
   */
  get intensity() {
    return this._intensity;
  }
  /**
   * Instantiates a new glow Layer and references it to the scene.
   * @param name The name of the layer
   * @param scene The scene to use the layer in
   * @param options Sets of none mandatory options to use with the layer (see IGlowLayerOptions for more information)
   * @param dontCheckIfReady Specifies if the layer should disable checking whether all the post processes are ready (default: false). To save performance, this should be set to true and you should call `isReady` manually before rendering to the layer.
   */
  constructor(name, scene, options, dontCheckIfReady = false) {
    super(name, scene, false, dontCheckIfReady);
    this._intensity = 1;
    this._includedOnlyMeshes = [];
    this._excludedMeshes = [];
    this._meshesUsingTheirOwnMaterials = [];
    this._renderPassId = 0;
    this.neutralColor = new Color4(0, 0, 0, 1);
    this._options = {
      mainTextureRatio: 0.5,
      mainTextureFixedSize: 0,
      mainTextureType: 0,
      blurKernelSize: 32,
      camera: null,
      renderingGroupId: -1,
      ldrMerge: false,
      alphaBlendingMode: 1,
      excludeByDefault: false,
      ...options
    };
    this._init(this._options);
    if (dontCheckIfReady) {
      this._createTextureAndPostProcesses();
    }
  }
  /**
   * Gets the class name of the thin glow layer
   * @returns the string with the class name of the glow layer
   */
  getClassName() {
    return "GlowLayer";
  }
  async _importShadersAsync() {
    if (this._shaderLanguage === 1) {
      await Promise.all([
        import("./glowMapMerge.fragment-BESWNTK6.js"),
        import("./glowMapMerge.vertex-4XRXMK7U.js"),
        import("./glowBlurPostProcess.fragment-PHXLJF7Q.js")
      ]);
    } else {
      await Promise.all([import("./glowMapMerge.fragment-627JWCCY.js"), import("./glowMapMerge.vertex-D6YMKHCI.js"), import("./glowBlurPostProcess.fragment-UAYTWH7U.js")]);
    }
    await super._importShadersAsync();
  }
  getEffectName() {
    return _ThinGlowLayer.EffectName;
  }
  /** @internal */
  _internalShouldRender() {
    if (this._options.excludeByDefault && !this._includedOnlyMeshes.length) {
      return false;
    }
    return super._internalShouldRender();
  }
  _createMergeEffect() {
    let defines = "#define EMISSIVE \n";
    if (this._options.ldrMerge) {
      defines += "#define LDR \n";
    }
    return this._engine.createEffect("glowMapMerge", [VertexBuffer.PositionKind], ["offset"], ["textureSampler", "textureSampler2"], defines, void 0, void 0, void 0, void 0, this.shaderLanguage, this._shadersLoaded ? void 0 : async () => {
      await this._importShadersAsync();
      this._shadersLoaded = true;
    });
  }
  _createTextureAndPostProcesses() {
    const effectiveKernel = this._getEffectiveBlurKernelSize();
    this._horizontalBlurPostprocess1 = new ThinBlurPostProcess("GlowLayerHBP1", this._scene.getEngine(), new Vector2(1, 0), effectiveKernel);
    this._verticalBlurPostprocess1 = new ThinBlurPostProcess("GlowLayerVBP1", this._scene.getEngine(), new Vector2(0, 1), effectiveKernel);
    this._horizontalBlurPostprocess2 = new ThinBlurPostProcess("GlowLayerHBP2", this._scene.getEngine(), new Vector2(1, 0), effectiveKernel);
    this._verticalBlurPostprocess2 = new ThinBlurPostProcess("GlowLayerVBP2", this._scene.getEngine(), new Vector2(0, 1), effectiveKernel);
    this._postProcesses = [this._horizontalBlurPostprocess1, this._verticalBlurPostprocess1, this._horizontalBlurPostprocess2, this._verticalBlurPostprocess2];
  }
  _getEffectiveBlurKernelSize() {
    return this._options.blurKernelSize / 2;
  }
  isReady(subMesh, useInstances) {
    const material = subMesh.getMaterial();
    const mesh = subMesh.getRenderingMesh();
    if (!material || !mesh) {
      return false;
    }
    const emissiveTexture = material.emissiveTexture;
    return super._isSubMeshReady(subMesh, useInstances, emissiveTexture);
  }
  _canRenderMesh(_mesh, _material) {
    return true;
  }
  _internalCompose(effect) {
    this.bindTexturesForCompose(effect);
    effect.setFloat("offset", this._intensity);
    const engine = this._engine;
    const previousStencilBuffer = engine.getStencilBuffer();
    engine.setStencilBuffer(false);
    engine.drawElementsType(Material.TriangleFillMode, 0, 6);
    engine.setStencilBuffer(previousStencilBuffer);
  }
  _setEmissiveTextureAndColor(mesh, subMesh, material) {
    let textureLevel = 1;
    if (this.customEmissiveTextureSelector) {
      this._emissiveTextureAndColor.texture = this.customEmissiveTextureSelector(mesh, subMesh, material);
    } else {
      if (material) {
        this._emissiveTextureAndColor.texture = material.emissiveTexture;
        if (this._emissiveTextureAndColor.texture) {
          textureLevel = this._emissiveTextureAndColor.texture.level;
        }
      } else {
        this._emissiveTextureAndColor.texture = null;
      }
    }
    if (this.customEmissiveColorSelector) {
      this.customEmissiveColorSelector(mesh, subMesh, material, this._emissiveTextureAndColor.color);
    } else {
      if (material.emissiveColor) {
        const emissiveIntensity = material.emissiveIntensity ?? 1;
        textureLevel *= emissiveIntensity;
        this._emissiveTextureAndColor.color.set(material.emissiveColor.r * textureLevel, material.emissiveColor.g * textureLevel, material.emissiveColor.b * textureLevel, material.alpha);
      } else {
        this._emissiveTextureAndColor.color.set(this.neutralColor.r, this.neutralColor.g, this.neutralColor.b, this.neutralColor.a);
      }
    }
  }
  _shouldRenderMesh(mesh) {
    return this.hasMesh(mesh);
  }
  _addCustomEffectDefines(defines) {
    defines.push("#define GLOW");
  }
  /**
   * Add a mesh in the exclusion list to prevent it to impact or being impacted by the glow layer.
   * This will not have an effect if meshes are excluded by default (see setExcludedByDefault).
   * @param mesh The mesh to exclude from the glow layer
   */
  addExcludedMesh(mesh) {
    if (this._excludedMeshes.indexOf(mesh.uniqueId) === -1) {
      this._excludedMeshes.push(mesh.uniqueId);
    }
  }
  /**
   * Remove a mesh from the exclusion list to let it impact or being impacted by the glow layer.
   * This will not have an effect if meshes are excluded by default (see setExcludedByDefault).
   * @param mesh The mesh to remove
   */
  removeExcludedMesh(mesh) {
    const index = this._excludedMeshes.indexOf(mesh.uniqueId);
    if (index !== -1) {
      this._excludedMeshes.splice(index, 1);
    }
  }
  /**
   * Add a mesh in the inclusion list to impact or being impacted by the glow layer.
   * @param mesh The mesh to include in the glow layer
   */
  addIncludedOnlyMesh(mesh) {
    if (this._includedOnlyMeshes.indexOf(mesh.uniqueId) === -1) {
      this._includedOnlyMeshes.push(mesh.uniqueId);
    }
  }
  /**
   * Remove a mesh from the Inclusion list to prevent it to impact or being impacted by the glow layer.
   * @param mesh The mesh to remove
   */
  removeIncludedOnlyMesh(mesh) {
    const index = this._includedOnlyMeshes.indexOf(mesh.uniqueId);
    if (index !== -1) {
      this._includedOnlyMeshes.splice(index, 1);
    }
  }
  /**
   * Set the excluded by default option.
   * If true, all meshes will be excluded by default unless they are added to the inclusion list.
   * @param value The boolean value to set the excluded by default option to
   */
  setExcludedByDefault(value) {
    this._options.excludeByDefault = value;
  }
  hasMesh(mesh) {
    if (!super.hasMesh(mesh)) {
      return false;
    }
    if (this._includedOnlyMeshes.length) {
      return this._includedOnlyMeshes.indexOf(mesh.uniqueId) !== -1;
    }
    if (this._excludedMeshes.length) {
      return this._excludedMeshes.indexOf(mesh.uniqueId) === -1;
    }
    return true;
  }
  _useMeshMaterial(mesh) {
    if (mesh.material?._supportGlowLayer) {
      return true;
    }
    if (this._meshesUsingTheirOwnMaterials.length == 0) {
      return false;
    }
    return this._meshesUsingTheirOwnMaterials.indexOf(mesh.uniqueId) > -1;
  }
  /**
   * Add a mesh to be rendered through its own material and not with emissive only.
   * @param mesh The mesh for which we need to use its material
   */
  referenceMeshToUseItsOwnMaterial(mesh) {
    mesh.resetDrawCache(this._renderPassId);
    this._meshesUsingTheirOwnMaterials.push(mesh.uniqueId);
    mesh.onDisposeObservable.add(() => {
      this._disposeMesh(mesh);
    });
  }
  /**
   * Remove a mesh from being rendered through its own material and not with emissive only.
   * @param mesh The mesh for which we need to not use its material
   * @param renderPassId The render pass id used when rendering the mesh
   */
  unReferenceMeshFromUsingItsOwnMaterial(mesh, renderPassId) {
    let index = this._meshesUsingTheirOwnMaterials.indexOf(mesh.uniqueId);
    while (index >= 0) {
      this._meshesUsingTheirOwnMaterials.splice(index, 1);
      index = this._meshesUsingTheirOwnMaterials.indexOf(mesh.uniqueId);
    }
    mesh.resetDrawCache(renderPassId);
  }
  /** @internal */
  _disposeMesh(mesh) {
    this.removeIncludedOnlyMesh(mesh);
    this.removeExcludedMesh(mesh);
  }
};
ThinGlowLayer.EffectName = "GlowLayer";
ThinGlowLayer.DefaultBlurKernelSize = 32;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Layers/glowLayer.js
Scene.prototype.getGlowLayerByName = function(name) {
  for (let index = 0; index < this.effectLayers?.length; index++) {
    if (this.effectLayers[index].name === name && this.effectLayers[index].getEffectName() === GlowLayer.EffectName) {
      return this.effectLayers[index];
    }
  }
  return null;
};
var GlowLayer = class _GlowLayer extends EffectLayer {
  /**
   * Effect Name of the layer.
   */
  static get EffectName() {
    return ThinGlowLayer.EffectName;
  }
  /**
   * Sets the kernel size of the blur.
   */
  set blurKernelSize(value) {
    this._thinEffectLayer.blurKernelSize = value;
  }
  /**
   * Gets the kernel size of the blur.
   */
  get blurKernelSize() {
    return this._thinEffectLayer.blurKernelSize;
  }
  /**
   * Sets the glow intensity.
   */
  set intensity(value) {
    this._thinEffectLayer.intensity = value;
  }
  /**
   * Gets the glow intensity.
   */
  get intensity() {
    return this._thinEffectLayer.intensity;
  }
  /**
   * Callback used to let the user override the color selection on a per mesh basis
   */
  get customEmissiveColorSelector() {
    return this._thinEffectLayer.customEmissiveColorSelector;
  }
  set customEmissiveColorSelector(value) {
    this._thinEffectLayer.customEmissiveColorSelector = value;
  }
  /**
   * Callback used to let the user override the texture selection on a per mesh basis
   */
  get customEmissiveTextureSelector() {
    return this._thinEffectLayer.customEmissiveTextureSelector;
  }
  set customEmissiveTextureSelector(value) {
    this._thinEffectLayer.customEmissiveTextureSelector = value;
  }
  /**
   * Instantiates a new glow Layer and references it to the scene.
   * @param name The name of the layer
   * @param scene The scene to use the layer in
   * @param options Sets of none mandatory options to use with the layer (see IGlowLayerOptions for more information)
   */
  constructor(name, scene, options) {
    super(name, scene, false, new ThinGlowLayer(name, scene, options));
    this._options = {
      mainTextureRatio: _GlowLayer.DefaultTextureRatio,
      blurKernelSize: 32,
      mainTextureFixedSize: void 0,
      camera: null,
      mainTextureSamples: 1,
      renderingGroupId: -1,
      ldrMerge: false,
      alphaBlendingMode: 1,
      mainTextureType: 0,
      generateStencilBuffer: false,
      excludeByDefault: false,
      ...options
    };
    this._init(this._options);
  }
  /**
   * Get the effect name of the layer.
   * @returns The effect name
   */
  getEffectName() {
    return _GlowLayer.EffectName;
  }
  /**
   * @internal
   * Create the merge effect. This is the shader use to blit the information back
   * to the main canvas at the end of the scene rendering.
   */
  _createMergeEffect() {
    return this._thinEffectLayer._createMergeEffect();
  }
  /**
   * Creates the render target textures and post processes used in the glow layer.
   */
  _createTextureAndPostProcesses() {
    this._thinEffectLayer._renderPassId = this._mainTexture.renderPassId;
    let blurTextureWidth = this._mainTextureDesiredSize.width;
    let blurTextureHeight = this._mainTextureDesiredSize.height;
    blurTextureWidth = this._engine.needPOTTextures ? GetExponentOfTwo(blurTextureWidth, this._maxSize) : blurTextureWidth;
    blurTextureHeight = this._engine.needPOTTextures ? GetExponentOfTwo(blurTextureHeight, this._maxSize) : blurTextureHeight;
    let textureType = 0;
    if (this._engine.getCaps().textureHalfFloatRender) {
      textureType = 2;
    } else {
      textureType = 0;
    }
    this._blurTexture1 = new RenderTargetTexture("GlowLayerBlurRTT", {
      width: blurTextureWidth,
      height: blurTextureHeight
    }, this._scene, false, true, textureType);
    this._blurTexture1.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._blurTexture1.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._blurTexture1.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    this._blurTexture1.renderParticles = false;
    this._blurTexture1.ignoreCameraViewport = true;
    const blurTextureWidth2 = Math.floor(blurTextureWidth / 2);
    const blurTextureHeight2 = Math.floor(blurTextureHeight / 2);
    this._blurTexture2 = new RenderTargetTexture("GlowLayerBlurRTT2", {
      width: blurTextureWidth2,
      height: blurTextureHeight2
    }, this._scene, false, true, textureType);
    this._blurTexture2.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._blurTexture2.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._blurTexture2.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    this._blurTexture2.renderParticles = false;
    this._blurTexture2.ignoreCameraViewport = true;
    this._textures = [this._blurTexture1, this._blurTexture2];
    this._thinEffectLayer.bindTexturesForCompose = (effect) => {
      effect.setTexture("textureSampler", this._blurTexture1);
      effect.setTexture("textureSampler2", this._blurTexture2);
      effect.setFloat("offset", this.intensity);
    };
    this._thinEffectLayer._createTextureAndPostProcesses();
    const thinBlurPostProcesses1 = this._thinEffectLayer._postProcesses[0];
    this._horizontalBlurPostprocess1 = new BlurPostProcess("GlowLayerHBP1", thinBlurPostProcesses1.direction, thinBlurPostProcesses1.kernel, {
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine: this._scene.getEngine(),
      width: blurTextureWidth,
      height: blurTextureHeight,
      textureType,
      effectWrapper: thinBlurPostProcesses1
    });
    this._horizontalBlurPostprocess1.width = blurTextureWidth;
    this._horizontalBlurPostprocess1.height = blurTextureHeight;
    this._horizontalBlurPostprocess1.externalTextureSamplerBinding = true;
    this._horizontalBlurPostprocess1.onApplyObservable.add((effect) => {
      effect.setTexture("textureSampler", this._mainTexture);
    });
    const thinBlurPostProcesses2 = this._thinEffectLayer._postProcesses[1];
    this._verticalBlurPostprocess1 = new BlurPostProcess("GlowLayerVBP1", thinBlurPostProcesses2.direction, thinBlurPostProcesses2.kernel, {
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine: this._scene.getEngine(),
      width: blurTextureWidth,
      height: blurTextureHeight,
      textureType,
      effectWrapper: thinBlurPostProcesses2
    });
    const thinBlurPostProcesses3 = this._thinEffectLayer._postProcesses[2];
    this._horizontalBlurPostprocess2 = new BlurPostProcess("GlowLayerHBP2", thinBlurPostProcesses3.direction, thinBlurPostProcesses3.kernel, {
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine: this._scene.getEngine(),
      width: blurTextureWidth2,
      height: blurTextureHeight2,
      textureType,
      effectWrapper: thinBlurPostProcesses3
    });
    this._horizontalBlurPostprocess2.width = blurTextureWidth2;
    this._horizontalBlurPostprocess2.height = blurTextureHeight2;
    this._horizontalBlurPostprocess2.externalTextureSamplerBinding = true;
    this._horizontalBlurPostprocess2.onApplyObservable.add((effect) => {
      effect.setTexture("textureSampler", this._blurTexture1);
    });
    const thinBlurPostProcesses4 = this._thinEffectLayer._postProcesses[3];
    this._verticalBlurPostprocess2 = new BlurPostProcess("GlowLayerVBP2", thinBlurPostProcesses4.direction, thinBlurPostProcesses4.kernel, {
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine: this._scene.getEngine(),
      width: blurTextureWidth2,
      height: blurTextureHeight2,
      textureType,
      effectWrapper: thinBlurPostProcesses4
    });
    this._postProcesses = [this._horizontalBlurPostprocess1, this._verticalBlurPostprocess1, this._horizontalBlurPostprocess2, this._verticalBlurPostprocess2];
    this._postProcesses1 = [this._horizontalBlurPostprocess1, this._verticalBlurPostprocess1];
    this._postProcesses2 = [this._horizontalBlurPostprocess2, this._verticalBlurPostprocess2];
    this._mainTexture.samples = this._options.mainTextureSamples;
    this._mainTexture.onAfterUnbindObservable.add(() => {
      const internalTexture = this._blurTexture1.renderTarget;
      if (internalTexture) {
        this._scene.postProcessManager.directRender(this._postProcesses1, internalTexture, true);
        const internalTexture2 = this._blurTexture2.renderTarget;
        if (internalTexture2) {
          this._scene.postProcessManager.directRender(this._postProcesses2, internalTexture2, true);
        }
        this._engine.unBindFramebuffer(internalTexture2 ?? internalTexture, true);
      }
    });
    this._postProcesses.map((pp) => {
      pp.autoClear = false;
    });
    this._mainTextureCreatedSize.width = this._mainTextureDesiredSize.width;
    this._mainTextureCreatedSize.height = this._mainTextureDesiredSize.height;
  }
  /**
   * Checks for the readiness of the element composing the layer.
   * @param subMesh the mesh to check for
   * @param useInstances specify whether or not to use instances to render the mesh
   * @returns true if ready otherwise, false
   */
  isReady(subMesh, useInstances) {
    return this._thinEffectLayer.isReady(subMesh, useInstances);
  }
  /**
   * @returns whether or not the layer needs stencil enabled during the mesh rendering.
   */
  needStencil() {
    return false;
  }
  /**
   * Returns true if the mesh can be rendered, otherwise false.
   * @param mesh The mesh to render
   * @param material The material used on the mesh
   * @returns true if it can be rendered otherwise false
   */
  _canRenderMesh(mesh, material) {
    return this._thinEffectLayer._canRenderMesh(mesh, material);
  }
  /**
   * Implementation specific of rendering the generating effect on the main canvas.
   * @param effect The effect used to render through
   */
  _internalRender(effect) {
    this._thinEffectLayer._internalCompose(effect);
  }
  /**
   * Sets the required values for both the emissive texture and and the main color.
   * @param mesh
   * @param subMesh
   * @param material
   */
  _setEmissiveTextureAndColor(mesh, subMesh, material) {
    this._thinEffectLayer._setEmissiveTextureAndColor(mesh, subMesh, material);
  }
  /**
   * Returns true if the mesh should render, otherwise false.
   * @param mesh The mesh to render
   * @returns true if it should render otherwise false
   */
  _shouldRenderMesh(mesh) {
    return this._thinEffectLayer._shouldRenderMesh(mesh);
  }
  /**
   * Adds specific effects defines.
   * @param defines The defines to add specifics to.
   */
  _addCustomEffectDefines(defines) {
    this._thinEffectLayer._addCustomEffectDefines(defines);
  }
  /**
   * Add a mesh in the exclusion list to prevent it to impact or being impacted by the glow layer.
   * This will not have an effect if meshes are excluded by default (see setExcludedByDefault).
   * @param mesh The mesh to exclude from the glow layer
   */
  addExcludedMesh(mesh) {
    this._thinEffectLayer.addExcludedMesh(mesh);
  }
  /**
   * Remove a mesh from the exclusion list to let it impact or being impacted by the glow layer.
   * This will not have an effect if meshes are excluded by default (see setExcludedByDefault).
   * @param mesh The mesh to remove
   */
  removeExcludedMesh(mesh) {
    this._thinEffectLayer.removeExcludedMesh(mesh);
  }
  /**
   * Add a mesh in the inclusion list to impact or being impacted by the glow layer.
   * @param mesh The mesh to include in the glow layer
   */
  addIncludedOnlyMesh(mesh) {
    this._thinEffectLayer.addIncludedOnlyMesh(mesh);
  }
  /**
   * Remove a mesh from the Inclusion list to prevent it to impact or being impacted by the glow layer.
   * @param mesh The mesh to remove
   */
  removeIncludedOnlyMesh(mesh) {
    this._thinEffectLayer.removeIncludedOnlyMesh(mesh);
  }
  /**
   * Set the excluded by default option.
   * If true, all meshes will be excluded by default unless they are added to the inclusion list.
   * @param value The boolean value to set the excluded by default option to
   */
  setExcludedByDefault(value) {
    this._thinEffectLayer.setExcludedByDefault(value);
  }
  /**
   * Determine if a given mesh will be used in the glow layer
   * @param mesh The mesh to test
   * @returns true if the mesh will be highlighted by the current glow layer
   */
  hasMesh(mesh) {
    return this._thinEffectLayer.hasMesh(mesh);
  }
  /**
   * Defines whether the current material of the mesh should be use to render the effect.
   * @param mesh defines the current mesh to render
   * @returns true if the material of the mesh should be use to render the effect
   */
  _useMeshMaterial(mesh) {
    return this._thinEffectLayer._useMeshMaterial(mesh);
  }
  /**
   * Add a mesh to be rendered through its own material and not with emissive only.
   * @param mesh The mesh for which we need to use its material
   */
  referenceMeshToUseItsOwnMaterial(mesh) {
    this._thinEffectLayer.referenceMeshToUseItsOwnMaterial(mesh);
  }
  /**
   * Remove a mesh from being rendered through its own material and not with emissive only.
   * @param mesh The mesh for which we need to not use its material
   */
  unReferenceMeshFromUsingItsOwnMaterial(mesh) {
    this._thinEffectLayer.unReferenceMeshFromUsingItsOwnMaterial(mesh, this._mainTexture.renderPassId);
  }
  /**
   * Free any resources and references associated to a mesh.
   * Internal use
   * @param mesh The mesh to free.
   * @internal
   */
  _disposeMesh(mesh) {
    this._thinEffectLayer._disposeMesh(mesh);
  }
  /**
   * Gets the class name of the effect layer
   * @returns the string with the class name of the effect layer
   */
  getClassName() {
    return "GlowLayer";
  }
  /**
   * Serializes this glow layer
   * @returns a serialized glow layer object
   */
  serialize() {
    const serializationObject = SerializationHelper.Serialize(this);
    serializationObject.customType = "BABYLON.GlowLayer";
    let index;
    serializationObject.includedMeshes = [];
    const includedOnlyMeshes = this._thinEffectLayer._includedOnlyMeshes;
    if (includedOnlyMeshes.length) {
      for (index = 0; index < includedOnlyMeshes.length; index++) {
        const mesh = this._scene.getMeshByUniqueId(includedOnlyMeshes[index]);
        if (mesh) {
          serializationObject.includedMeshes.push(mesh.id);
        }
      }
    }
    serializationObject.excludedMeshes = [];
    const excludedMeshes = this._thinEffectLayer._excludedMeshes;
    if (excludedMeshes.length) {
      for (index = 0; index < excludedMeshes.length; index++) {
        const mesh = this._scene.getMeshByUniqueId(excludedMeshes[index]);
        if (mesh) {
          serializationObject.excludedMeshes.push(mesh.id);
        }
      }
    }
    return serializationObject;
  }
  /**
   * Creates a Glow Layer from parsed glow layer data
   * @param parsedGlowLayer defines glow layer data
   * @param scene defines the current scene
   * @param rootUrl defines the root URL containing the glow layer information
   * @returns a parsed Glow Layer
   */
  static Parse(parsedGlowLayer, scene, rootUrl) {
    const gl = SerializationHelper.Parse(() => new _GlowLayer(parsedGlowLayer.name, scene, parsedGlowLayer.options), parsedGlowLayer, scene, rootUrl);
    let index;
    for (index = 0; index < parsedGlowLayer.excludedMeshes.length; index++) {
      const mesh = scene.getMeshById(parsedGlowLayer.excludedMeshes[index]);
      if (mesh) {
        gl.addExcludedMesh(mesh);
      }
    }
    for (index = 0; index < parsedGlowLayer.includedMeshes.length; index++) {
      const mesh = scene.getMeshById(parsedGlowLayer.includedMeshes[index]);
      if (mesh) {
        gl.addIncludedOnlyMesh(mesh);
      }
    }
    return gl;
  }
};
GlowLayer.DefaultBlurKernelSize = 32;
GlowLayer.DefaultTextureRatio = 0.5;
__decorate([
  serialize()
], GlowLayer.prototype, "blurKernelSize", null);
__decorate([
  serialize()
], GlowLayer.prototype, "intensity", null);
__decorate([
  serialize("options")
], GlowLayer.prototype, "_options", void 0);
RegisterClass("BABYLON.GlowLayer", GlowLayer);

export {
  GlowLayer
};
//# sourceMappingURL=chunk-5IGP3VKG.js.map
