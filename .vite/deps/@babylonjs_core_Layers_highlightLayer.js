import {
  PassPostProcess,
  ThinPassPostProcess
} from "./chunk-BNLD67Z4.js";
import {
  EffectLayer,
  ThinEffectLayer,
  ThinGlowBlurPostProcess
} from "./chunk-5KW3BTBO.js";
import {
  Material
} from "./chunk-354MVM62.js";
import "./chunk-BH7TPLNH.js";
import "./chunk-ZJE4XQK6.js";
import {
  BlurPostProcess,
  ThinBlurPostProcess
} from "./chunk-INKIDW57.js";
import {
  PostProcess
} from "./chunk-FTNKZQKS.js";
import {
  RenderTargetTexture
} from "./chunk-5THHQJAG.js";
import "./chunk-XDMWCM3S.js";
import "./chunk-5BCZBFCD.js";
import "./chunk-KVNFFPV2.js";
import "./chunk-MS5Q3OEV.js";
import "./chunk-ZRA7NYDC.js";
import "./chunk-Z37P4AH6.js";
import "./chunk-ZAZDILKK.js";
import "./chunk-SI3ZTALR.js";
import "./chunk-TJZRBYWF.js";
import "./chunk-CRAMLVPI.js";
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import "./chunk-4SFBNKXP.js";
import "./chunk-LY4CWJEX.js";
import "./chunk-W7NAK7I4.js";
import {
  Scene
} from "./chunk-WNGJ3WNO.js";
import "./chunk-BELK345T.js";
import "./chunk-VMWDNJJG.js";
import "./chunk-GGUL3CXV.js";
import "./chunk-2DA7GQ3K.js";
import "./chunk-4CFWIRXS.js";
import "./chunk-QU3LKDUB.js";
import "./chunk-XSRNQTYL.js";
import "./chunk-WOKXMMT7.js";
import "./chunk-YNSIAG7O.js";
import "./chunk-O36BJWZ2.js";
import "./chunk-T324X5NK.js";
import "./chunk-VMPPSYS3.js";
import "./chunk-EWHDDCCY.js";
import "./chunk-4ZWKSYMN.js";
import {
  VertexBuffer
} from "./chunk-ZOIT5ZEZ.js";
import "./chunk-XAOF3L4F.js";
import "./chunk-CSVPIDNO.js";
import "./chunk-YVYIHIJT.js";
import "./chunk-2GZCEIFN.js";
import "./chunk-SVWFF7VD.js";
import "./chunk-ORJOFH3C.js";
import "./chunk-L6UPA4UW.js";
import "./chunk-CQNOHBC6.js";
import "./chunk-BGSVSY55.js";
import "./chunk-RG742WGM.js";
import "./chunk-AB3HOSPI.js";
import "./chunk-4KL4KK2C.js";
import {
  GetExponentOfTwo
} from "./chunk-N5T6XPNQ.js";
import "./chunk-2HUMDLGD.js";
import "./chunk-QD4Q3FLX.js";
import "./chunk-BFIQD25N.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import {
  SerializationHelper
} from "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize
} from "./chunk-STIKNZXL.js";
import {
  Color3,
  Color4
} from "./chunk-I3IYKWNG.js";
import "./chunk-MMWR3MO4.js";
import {
  Vector2
} from "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Layers/thinHighlightLayer.js
var ThinHighlightLayer = class _ThinHighlightLayer extends ThinEffectLayer {
  /**
   * Specifies the horizontal size of the blur.
   */
  set blurHorizontalSize(value) {
    this._horizontalBlurPostprocess.kernel = value;
    this._options.blurHorizontalSize = value;
  }
  /**
   * Specifies the vertical size of the blur.
   */
  set blurVerticalSize(value) {
    this._verticalBlurPostprocess.kernel = value;
    this._options.blurVerticalSize = value;
  }
  /**
   * Gets the horizontal size of the blur.
   */
  get blurHorizontalSize() {
    return this._horizontalBlurPostprocess.kernel;
  }
  /**
   * Gets the vertical size of the blur.
   */
  get blurVerticalSize() {
    return this._verticalBlurPostprocess.kernel;
  }
  /**
   * Instantiates a new highlight Layer and references it to the scene..
   * @param name The name of the layer
   * @param scene The scene to use the layer in
   * @param options Sets of none mandatory options to use with the layer (see IHighlightLayerOptions for more information)
   * @param dontCheckIfReady Specifies if the layer should disable checking whether all the post processes are ready (default: false). To save performance, this should be set to true and you should call `isReady` manually before rendering to the layer.
   */
  constructor(name, scene, options, dontCheckIfReady = false) {
    super(name, scene, options !== void 0 ? !!options.forceGLSL : false);
    this.innerGlow = true;
    this.outerGlow = true;
    this._instanceGlowingMeshStencilReference = _ThinHighlightLayer.GlowingMeshStencilReference++;
    this._meshes = {};
    this._excludedMeshes = {};
    this._mainObjectRendererRenderPassId = -1;
    this.neutralColor = _ThinHighlightLayer.NeutralColor;
    this._options = {
      mainTextureRatio: 0.5,
      blurTextureSizeRatio: 0.5,
      mainTextureFixedSize: 0,
      blurHorizontalSize: 1,
      blurVerticalSize: 1,
      alphaBlendingMode: 2,
      camera: null,
      renderingGroupId: -1,
      forceGLSL: false,
      mainTextureType: 0,
      isStroke: false,
      ...options
    };
    this._init(this._options);
    this._shouldRender = false;
    if (dontCheckIfReady) {
      this._createTextureAndPostProcesses();
    }
  }
  /**
   * Gets the class name of the effect layer
   * @returns the string with the class name of the effect layer
   */
  getClassName() {
    return "HighlightLayer";
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
    return _ThinHighlightLayer.EffectName;
  }
  _numInternalDraws() {
    return 2;
  }
  _createMergeEffect() {
    return this._engine.createEffect("glowMapMerge", [VertexBuffer.PositionKind], ["offset"], ["textureSampler"], this._options.isStroke ? "#define STROKE \n" : void 0, void 0, void 0, void 0, void 0, this._shaderLanguage, this._shadersLoaded ? void 0 : async () => {
      await this._importShadersAsync();
      this._shadersLoaded = true;
    });
  }
  _createTextureAndPostProcesses() {
    if (this._options.alphaBlendingMode === 2) {
      this._downSamplePostprocess = new ThinPassPostProcess("HighlightLayerPPP", this._scene.getEngine());
      this._horizontalBlurPostprocess = new ThinGlowBlurPostProcess("HighlightLayerHBP", this._scene.getEngine(), new Vector2(1, 0), this._options.blurHorizontalSize);
      this._verticalBlurPostprocess = new ThinGlowBlurPostProcess("HighlightLayerVBP", this._scene.getEngine(), new Vector2(0, 1), this._options.blurVerticalSize);
      this._postProcesses = [this._downSamplePostprocess, this._horizontalBlurPostprocess, this._verticalBlurPostprocess];
    } else {
      this._horizontalBlurPostprocess = new ThinBlurPostProcess("HighlightLayerHBP", this._scene.getEngine(), new Vector2(1, 0), this._options.blurHorizontalSize / 2);
      this._verticalBlurPostprocess = new ThinBlurPostProcess("HighlightLayerVBP", this._scene.getEngine(), new Vector2(0, 1), this._options.blurVerticalSize / 2);
      this._postProcesses = [this._horizontalBlurPostprocess, this._verticalBlurPostprocess];
    }
  }
  needStencil() {
    return true;
  }
  isReady(subMesh, useInstances) {
    const material = subMesh.getMaterial();
    const mesh = subMesh.getRenderingMesh();
    if (!material || !mesh || !this._meshes) {
      return false;
    }
    let emissiveTexture = null;
    const highlightLayerMesh = this._meshes[mesh.uniqueId];
    if (highlightLayerMesh && highlightLayerMesh.glowEmissiveOnly && material) {
      emissiveTexture = material.emissiveTexture;
    }
    return super._isSubMeshReady(subMesh, useInstances, emissiveTexture);
  }
  _canRenderMesh(_mesh, _material) {
    return true;
  }
  _internalCompose(effect, renderIndex) {
    this.bindTexturesForCompose(effect);
    const engine = this._engine;
    engine.cacheStencilState();
    engine.setStencilOperationPass(7681);
    engine.setStencilOperationFail(7680);
    engine.setStencilOperationDepthFail(7680);
    engine.setStencilMask(0);
    engine.setStencilBuffer(true);
    engine.setStencilFunctionReference(this._instanceGlowingMeshStencilReference);
    if (this.outerGlow && renderIndex === 0) {
      effect.setFloat("offset", 0);
      engine.setStencilFunction(517);
      engine.drawElementsType(Material.TriangleFillMode, 0, 6);
    }
    if (this.innerGlow && renderIndex === 1) {
      effect.setFloat("offset", 1);
      engine.setStencilFunction(514);
      engine.drawElementsType(Material.TriangleFillMode, 0, 6);
    }
    engine.restoreStencilState();
  }
  _setEmissiveTextureAndColor(mesh, _subMesh, material) {
    const highlightLayerMesh = this._meshes[mesh.uniqueId];
    if (highlightLayerMesh) {
      this._emissiveTextureAndColor.color.set(highlightLayerMesh.color.r, highlightLayerMesh.color.g, highlightLayerMesh.color.b, 1);
    } else {
      this._emissiveTextureAndColor.color.set(this.neutralColor.r, this.neutralColor.g, this.neutralColor.b, this.neutralColor.a);
    }
    if (highlightLayerMesh && highlightLayerMesh.glowEmissiveOnly && material) {
      this._emissiveTextureAndColor.texture = material.emissiveTexture;
      this._emissiveTextureAndColor.color.set(1, 1, 1, 1);
    } else {
      this._emissiveTextureAndColor.texture = null;
    }
  }
  shouldRender() {
    return this._meshes && super.shouldRender() ? true : false;
  }
  _shouldRenderMesh(mesh) {
    if (this._excludedMeshes && this._excludedMeshes[mesh.uniqueId]) {
      return false;
    }
    return super.hasMesh(mesh);
  }
  _addCustomEffectDefines(defines) {
    defines.push("#define HIGHLIGHT");
  }
  /**
   * Add a mesh in the exclusion list to prevent it to impact or being impacted by the highlight layer.
   * @param mesh The mesh to exclude from the highlight layer
   */
  addExcludedMesh(mesh) {
    if (!this._excludedMeshes) {
      return;
    }
    const meshExcluded = this._excludedMeshes[mesh.uniqueId];
    if (!meshExcluded) {
      const obj = {
        mesh,
        beforeBind: null,
        afterRender: null,
        stencilState: false
      };
      obj.beforeBind = mesh.onBeforeBindObservable.add((mesh2) => {
        if (this._mainObjectRendererRenderPassId !== -1 && this._mainObjectRendererRenderPassId !== this._engine.currentRenderPassId) {
          return;
        }
        obj.stencilState = mesh2.getEngine().getStencilBuffer();
        mesh2.getEngine().setStencilBuffer(false);
      });
      obj.afterRender = mesh.onAfterRenderObservable.add((mesh2) => {
        if (this._mainObjectRendererRenderPassId !== -1 && this._mainObjectRendererRenderPassId !== this._engine.currentRenderPassId) {
          return;
        }
        mesh2.getEngine().setStencilBuffer(obj.stencilState);
      });
      this._excludedMeshes[mesh.uniqueId] = obj;
    }
  }
  /**
   * Remove a mesh from the exclusion list to let it impact or being impacted by the highlight layer.
   * @param mesh The mesh to highlight
   */
  removeExcludedMesh(mesh) {
    if (!this._excludedMeshes) {
      return;
    }
    const meshExcluded = this._excludedMeshes[mesh.uniqueId];
    if (meshExcluded) {
      if (meshExcluded.beforeBind) {
        mesh.onBeforeBindObservable.remove(meshExcluded.beforeBind);
      }
      if (meshExcluded.afterRender) {
        mesh.onAfterRenderObservable.remove(meshExcluded.afterRender);
      }
    }
    this._excludedMeshes[mesh.uniqueId] = null;
  }
  hasMesh(mesh) {
    if (!this._meshes || !super.hasMesh(mesh)) {
      return false;
    }
    return !!this._meshes[mesh.uniqueId];
  }
  /**
   * Add a mesh in the highlight layer in order to make it glow with the chosen color.
   * @param mesh The mesh to highlight
   * @param color The color of the highlight
   * @param glowEmissiveOnly Extract the glow from the emissive texture
   */
  addMesh(mesh, color, glowEmissiveOnly = false) {
    if (!this._meshes) {
      return;
    }
    const meshHighlight = this._meshes[mesh.uniqueId];
    if (meshHighlight) {
      meshHighlight.color = color;
    } else {
      this._meshes[mesh.uniqueId] = {
        mesh,
        color,
        // Lambda required for capture due to Observable this context
        observerHighlight: mesh.onBeforeBindObservable.add((mesh2) => {
          if (this._mainObjectRendererRenderPassId !== -1 && this._mainObjectRendererRenderPassId !== this._engine.currentRenderPassId) {
            return;
          }
          if (this.isEnabled) {
            if (this._excludedMeshes && this._excludedMeshes[mesh2.uniqueId]) {
              this._defaultStencilReference(mesh2);
            } else {
              mesh2.getScene().getEngine().setStencilFunctionReference(this._instanceGlowingMeshStencilReference);
            }
          }
        }),
        observerDefault: mesh.onAfterRenderObservable.add((mesh2) => {
          if (this._mainObjectRendererRenderPassId !== -1 && this._mainObjectRendererRenderPassId !== this._engine.currentRenderPassId) {
            return;
          }
          if (this.isEnabled) {
            this._defaultStencilReference(mesh2);
          }
        }),
        glowEmissiveOnly
      };
      mesh.onDisposeObservable.add(() => {
        this._disposeMesh(mesh);
      });
    }
    this._shouldRender = true;
  }
  /**
   * Remove a mesh from the highlight layer in order to make it stop glowing.
   * @param mesh The mesh to highlight
   */
  removeMesh(mesh) {
    if (!this._meshes) {
      return;
    }
    const meshHighlight = this._meshes[mesh.uniqueId];
    if (meshHighlight) {
      if (meshHighlight.observerHighlight) {
        mesh.onBeforeBindObservable.remove(meshHighlight.observerHighlight);
      }
      if (meshHighlight.observerDefault) {
        mesh.onAfterRenderObservable.remove(meshHighlight.observerDefault);
      }
      delete this._meshes[mesh.uniqueId];
    }
    this._shouldRender = false;
    for (const meshHighlightToCheck in this._meshes) {
      if (this._meshes[meshHighlightToCheck]) {
        this._shouldRender = true;
        break;
      }
    }
  }
  /**
   * Remove all the meshes currently referenced in the highlight layer
   */
  removeAllMeshes() {
    if (!this._meshes) {
      return;
    }
    for (const uniqueId in this._meshes) {
      if (Object.prototype.hasOwnProperty.call(this._meshes, uniqueId)) {
        const mesh = this._meshes[uniqueId];
        if (mesh) {
          this.removeMesh(mesh.mesh);
        }
      }
    }
  }
  _defaultStencilReference(mesh) {
    mesh.getScene().getEngine().setStencilFunctionReference(_ThinHighlightLayer.NormalMeshStencilReference);
  }
  _disposeMesh(mesh) {
    this.removeMesh(mesh);
    this.removeExcludedMesh(mesh);
  }
  dispose() {
    if (this._meshes) {
      for (const id in this._meshes) {
        const meshHighlight = this._meshes[id];
        if (meshHighlight && meshHighlight.mesh) {
          if (meshHighlight.observerHighlight) {
            meshHighlight.mesh.onBeforeBindObservable.remove(meshHighlight.observerHighlight);
          }
          if (meshHighlight.observerDefault) {
            meshHighlight.mesh.onAfterRenderObservable.remove(meshHighlight.observerDefault);
          }
        }
      }
      this._meshes = null;
    }
    if (this._excludedMeshes) {
      for (const id in this._excludedMeshes) {
        const meshHighlight = this._excludedMeshes[id];
        if (meshHighlight) {
          if (meshHighlight.beforeBind) {
            meshHighlight.mesh.onBeforeBindObservable.remove(meshHighlight.beforeBind);
          }
          if (meshHighlight.afterRender) {
            meshHighlight.mesh.onAfterRenderObservable.remove(meshHighlight.afterRender);
          }
        }
      }
      this._excludedMeshes = null;
    }
    super.dispose();
  }
};
ThinHighlightLayer.EffectName = "HighlightLayer";
ThinHighlightLayer.NeutralColor = new Color4(0, 0, 0, 0);
ThinHighlightLayer.GlowingMeshStencilReference = 2;
ThinHighlightLayer.NormalMeshStencilReference = 1;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Layers/highlightLayer.js
Scene.prototype.getHighlightLayerByName = function(name) {
  for (let index = 0; index < this.effectLayers?.length; index++) {
    if (this.effectLayers[index].name === name && this.effectLayers[index].getEffectName() === HighlightLayer.EffectName) {
      return this.effectLayers[index];
    }
  }
  return null;
};
var GlowBlurPostProcess = class extends PostProcess {
  constructor(name, direction, kernel, options, camera = null, samplingMode = Texture.BILINEAR_SAMPLINGMODE, engine, reusable) {
    const localOptions = {
      uniforms: ThinGlowBlurPostProcess.Uniforms,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      ...options
    };
    super(name, ThinGlowBlurPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinGlowBlurPostProcess(name, engine, direction, kernel, localOptions) : void 0,
      ...localOptions
    });
    this.direction = direction;
    this.kernel = kernel;
    this.onApplyObservable.add(() => {
      this._effectWrapper.textureWidth = this.width;
      this._effectWrapper.textureHeight = this.height;
    });
  }
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./glowBlurPostProcess.fragment-PHXLJF7Q.js"));
    } else {
      list.push(import("./glowBlurPostProcess.fragment-UAYTWH7U.js"));
    }
    super._gatherImports(useWebGPU, list);
  }
};
var HighlightLayer = class _HighlightLayer extends EffectLayer {
  /**
   * The neutral color used during the preparation of the glow effect.
   * This is black by default as the blend operation is a blend operation.
   */
  static get NeutralColor() {
    return ThinHighlightLayer.NeutralColor;
  }
  static set NeutralColor(value) {
    ThinHighlightLayer.NeutralColor = value;
  }
  /**
   * Specifies whether or not the inner glow is ACTIVE in the layer.
   */
  get innerGlow() {
    return this._thinEffectLayer.innerGlow;
  }
  set innerGlow(value) {
    this._thinEffectLayer.innerGlow = value;
  }
  /**
   * Specifies whether or not the outer glow is ACTIVE in the layer.
   */
  get outerGlow() {
    return this._thinEffectLayer.outerGlow;
  }
  set outerGlow(value) {
    this._thinEffectLayer.outerGlow = value;
  }
  /**
   * Specifies the horizontal size of the blur.
   */
  set blurHorizontalSize(value) {
    this._thinEffectLayer.blurHorizontalSize = value;
  }
  /**
   * Specifies the vertical size of the blur.
   */
  set blurVerticalSize(value) {
    this._thinEffectLayer.blurVerticalSize = value;
  }
  /**
   * Gets the horizontal size of the blur.
   */
  get blurHorizontalSize() {
    return this._thinEffectLayer.blurHorizontalSize;
  }
  /**
   * Gets the vertical size of the blur.
   */
  get blurVerticalSize() {
    return this._thinEffectLayer.blurVerticalSize;
  }
  /**
   * Instantiates a new highlight Layer and references it to the scene..
   * @param name The name of the layer
   * @param scene The scene to use the layer in
   * @param options Sets of none mandatory options to use with the layer (see IHighlightLayerOptions for more information)
   */
  constructor(name, scene, options) {
    super(name, scene, options !== void 0 ? !!options.forceGLSL : false, new ThinHighlightLayer(name, scene, options));
    this.onBeforeBlurObservable = new Observable();
    this.onAfterBlurObservable = new Observable();
    if (!this._engine.isStencilEnable) {
      Logger.Warn("Rendering the Highlight Layer requires the stencil to be active on the canvas. var engine = new Engine(canvas, antialias, { stencil: true }");
    }
    this._options = {
      mainTextureRatio: 0.5,
      blurTextureSizeRatio: 0.5,
      mainTextureFixedSize: 0,
      blurHorizontalSize: 1,
      blurVerticalSize: 1,
      alphaBlendingMode: 2,
      camera: null,
      renderingGroupId: -1,
      mainTextureType: 0,
      forceGLSL: false,
      isStroke: false,
      ...options
    };
    this._init(this._options);
    this._shouldRender = false;
  }
  /**
   * Get the effect name of the layer.
   * @returns The effect name
   */
  getEffectName() {
    return _HighlightLayer.EffectName;
  }
  _numInternalDraws() {
    return 2;
  }
  /**
   * Create the merge effect. This is the shader use to blit the information back
   * to the main canvas at the end of the scene rendering.
   * @returns The effect created
   */
  _createMergeEffect() {
    return this._thinEffectLayer._createMergeEffect();
  }
  /**
   * Creates the render target textures and post processes used in the highlight layer.
   */
  _createTextureAndPostProcesses() {
    let blurTextureWidth = this._mainTextureDesiredSize.width * this._options.blurTextureSizeRatio;
    let blurTextureHeight = this._mainTextureDesiredSize.height * this._options.blurTextureSizeRatio;
    blurTextureWidth = this._engine.needPOTTextures ? GetExponentOfTwo(blurTextureWidth, this._maxSize) : blurTextureWidth;
    blurTextureHeight = this._engine.needPOTTextures ? GetExponentOfTwo(blurTextureHeight, this._maxSize) : blurTextureHeight;
    let textureType = 0;
    if (this._engine.getCaps().textureHalfFloatRender) {
      textureType = 2;
    } else {
      textureType = 0;
    }
    this._blurTexture = new RenderTargetTexture("HighlightLayerBlurRTT", {
      width: blurTextureWidth,
      height: blurTextureHeight
    }, this._scene, false, true, textureType);
    this._blurTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._blurTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._blurTexture.anisotropicFilteringLevel = 16;
    this._blurTexture.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
    this._blurTexture.renderParticles = false;
    this._blurTexture.ignoreCameraViewport = true;
    this._textures = [this._blurTexture];
    this._thinEffectLayer.bindTexturesForCompose = (effect) => {
      effect.setTexture("textureSampler", this._blurTexture);
    };
    this._thinEffectLayer._createTextureAndPostProcesses();
    if (this._options.alphaBlendingMode === 2) {
      this._downSamplePostprocess = new PassPostProcess("HighlightLayerPPP", {
        size: this._options.blurTextureSizeRatio,
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine: this._scene.getEngine(),
        effectWrapper: this._thinEffectLayer._postProcesses[0]
      });
      this._downSamplePostprocess.externalTextureSamplerBinding = true;
      this._downSamplePostprocess.onApplyObservable.add((effect) => {
        effect.setTexture("textureSampler", this._mainTexture);
      });
      this._horizontalBlurPostprocess = new GlowBlurPostProcess("HighlightLayerHBP", new Vector2(1, 0), this._options.blurHorizontalSize, {
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine: this._scene.getEngine(),
        effectWrapper: this._thinEffectLayer._postProcesses[1]
      });
      this._horizontalBlurPostprocess.onApplyObservable.add((effect) => {
        effect.setFloat2("screenSize", blurTextureWidth, blurTextureHeight);
      });
      this._verticalBlurPostprocess = new GlowBlurPostProcess("HighlightLayerVBP", new Vector2(0, 1), this._options.blurVerticalSize, {
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine: this._scene.getEngine(),
        effectWrapper: this._thinEffectLayer._postProcesses[2]
      });
      this._verticalBlurPostprocess.onApplyObservable.add((effect) => {
        effect.setFloat2("screenSize", blurTextureWidth, blurTextureHeight);
      });
      this._postProcesses = [this._downSamplePostprocess, this._horizontalBlurPostprocess, this._verticalBlurPostprocess];
    } else {
      this._horizontalBlurPostprocess = new BlurPostProcess("HighlightLayerHBP", new Vector2(1, 0), this._options.blurHorizontalSize / 2, {
        size: {
          width: blurTextureWidth,
          height: blurTextureHeight
        },
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine: this._scene.getEngine(),
        textureType,
        effectWrapper: this._thinEffectLayer._postProcesses[0]
      });
      this._horizontalBlurPostprocess.width = blurTextureWidth;
      this._horizontalBlurPostprocess.height = blurTextureHeight;
      this._horizontalBlurPostprocess.externalTextureSamplerBinding = true;
      this._horizontalBlurPostprocess.onApplyObservable.add((effect) => {
        effect.setTexture("textureSampler", this._mainTexture);
      });
      this._verticalBlurPostprocess = new BlurPostProcess("HighlightLayerVBP", new Vector2(0, 1), this._options.blurVerticalSize / 2, {
        size: {
          width: blurTextureWidth,
          height: blurTextureHeight
        },
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine: this._scene.getEngine(),
        textureType
      });
      this._postProcesses = [this._horizontalBlurPostprocess, this._verticalBlurPostprocess];
    }
    this._mainTexture.onAfterUnbindObservable.add(() => {
      this.onBeforeBlurObservable.notifyObservers(this);
      const internalTexture = this._blurTexture.renderTarget;
      if (internalTexture) {
        this._scene.postProcessManager.directRender(this._postProcesses, internalTexture, true);
        this._engine.unBindFramebuffer(internalTexture, true);
      }
      this.onAfterBlurObservable.notifyObservers(this);
    });
    this._postProcesses.map((pp) => {
      pp.autoClear = false;
    });
    this._mainTextureCreatedSize.width = this._mainTextureDesiredSize.width;
    this._mainTextureCreatedSize.height = this._mainTextureDesiredSize.height;
  }
  /**
   * @returns whether or not the layer needs stencil enabled during the mesh rendering.
   */
  needStencil() {
    return this._thinEffectLayer.needStencil();
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
   * Implementation specific of rendering the generating effect on the main canvas.
   * @param effect The effect used to render through
   * @param renderIndex
   */
  _internalRender(effect, renderIndex) {
    this._thinEffectLayer._internalCompose(effect, renderIndex);
  }
  /**
   * @returns true if the layer contains information to display, otherwise false.
   */
  shouldRender() {
    return this._thinEffectLayer.shouldRender();
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
   * Returns true if the mesh can be rendered, otherwise false.
   * @param mesh The mesh to render
   * @param material The material used on the mesh
   * @returns true if it can be rendered otherwise false
   */
  _canRenderMesh(mesh, material) {
    return this._thinEffectLayer._canRenderMesh(mesh, material);
  }
  /**
   * Adds specific effects defines.
   * @param defines The defines to add specifics to.
   */
  _addCustomEffectDefines(defines) {
    this._thinEffectLayer._addCustomEffectDefines(defines);
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
   * Add a mesh in the exclusion list to prevent it to impact or being impacted by the highlight layer.
   * @param mesh The mesh to exclude from the highlight layer
   */
  addExcludedMesh(mesh) {
    this._thinEffectLayer.addExcludedMesh(mesh);
  }
  /**
   * Remove a mesh from the exclusion list to let it impact or being impacted by the highlight layer.
   * @param mesh The mesh to highlight
   */
  removeExcludedMesh(mesh) {
    this._thinEffectLayer.removeExcludedMesh(mesh);
  }
  /**
   * Determine if a given mesh will be highlighted by the current HighlightLayer
   * @param mesh mesh to test
   * @returns true if the mesh will be highlighted by the current HighlightLayer
   */
  hasMesh(mesh) {
    return this._thinEffectLayer.hasMesh(mesh);
  }
  /**
   * Add a mesh in the highlight layer in order to make it glow with the chosen color.
   * @param mesh The mesh to highlight
   * @param color The color of the highlight
   * @param glowEmissiveOnly Extract the glow from the emissive texture
   */
  addMesh(mesh, color, glowEmissiveOnly = false) {
    this._thinEffectLayer.addMesh(mesh, color, glowEmissiveOnly);
  }
  /**
   * Remove a mesh from the highlight layer in order to make it stop glowing.
   * @param mesh The mesh to highlight
   */
  removeMesh(mesh) {
    this._thinEffectLayer.removeMesh(mesh);
  }
  /**
   * Remove all the meshes currently referenced in the highlight layer
   */
  removeAllMeshes() {
    this._thinEffectLayer.removeAllMeshes();
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
    return "HighlightLayer";
  }
  /**
   * Serializes this Highlight layer
   * @returns a serialized Highlight layer object
   */
  serialize() {
    const serializationObject = SerializationHelper.Serialize(this);
    serializationObject.customType = "BABYLON.HighlightLayer";
    serializationObject.meshes = [];
    const meshes = this._thinEffectLayer._meshes;
    if (meshes) {
      for (const m in meshes) {
        const mesh = meshes[m];
        if (mesh) {
          serializationObject.meshes.push({
            glowEmissiveOnly: mesh.glowEmissiveOnly,
            color: mesh.color.asArray(),
            meshId: mesh.mesh.id
          });
        }
      }
    }
    serializationObject.excludedMeshes = [];
    const excludedMeshes = this._thinEffectLayer._excludedMeshes;
    if (excludedMeshes) {
      for (const e in excludedMeshes) {
        const excludedMesh = excludedMeshes[e];
        if (excludedMesh) {
          serializationObject.excludedMeshes.push(excludedMesh.mesh.id);
        }
      }
    }
    return serializationObject;
  }
  /**
   * Creates a Highlight layer from parsed Highlight layer data
   * @param parsedHightlightLayer defines the Highlight layer data
   * @param scene defines the current scene
   * @param rootUrl defines the root URL containing the Highlight layer information
   * @returns a parsed Highlight layer
   */
  static Parse(parsedHightlightLayer, scene, rootUrl) {
    const hl = SerializationHelper.Parse(() => new _HighlightLayer(parsedHightlightLayer.name, scene, parsedHightlightLayer.options), parsedHightlightLayer, scene, rootUrl);
    let index;
    for (index = 0; index < parsedHightlightLayer.excludedMeshes.length; index++) {
      const mesh = scene.getMeshById(parsedHightlightLayer.excludedMeshes[index]);
      if (mesh) {
        hl.addExcludedMesh(mesh);
      }
    }
    for (index = 0; index < parsedHightlightLayer.meshes.length; index++) {
      const highlightedMesh = parsedHightlightLayer.meshes[index];
      const mesh = scene.getMeshById(highlightedMesh.meshId);
      if (mesh) {
        hl.addMesh(mesh, Color3.FromArray(highlightedMesh.color), highlightedMesh.glowEmissiveOnly);
      }
    }
    return hl;
  }
};
HighlightLayer.EffectName = "HighlightLayer";
__decorate([
  serialize()
], HighlightLayer.prototype, "innerGlow", null);
__decorate([
  serialize()
], HighlightLayer.prototype, "outerGlow", null);
__decorate([
  serialize()
], HighlightLayer.prototype, "blurHorizontalSize", null);
__decorate([
  serialize()
], HighlightLayer.prototype, "blurVerticalSize", null);
__decorate([
  serialize("options")
], HighlightLayer.prototype, "_options", void 0);
RegisterClass("BABYLON.HighlightLayer", HighlightLayer);
export {
  HighlightLayer
};
//# sourceMappingURL=@babylonjs_core_Layers_highlightLayer.js.map
