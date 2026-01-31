import "./chunk-CZ5A2OM2.js";
import "./chunk-PTHSG5AC.js";
import {
  DepthRenderer
} from "./chunk-BP7KTCUF.js";
import "./chunk-7EPAU2JH.js";
import "./chunk-CJ36A2NR.js";
import "./chunk-CX4UP7V7.js";
import "./chunk-4YYNOEQD.js";
import "./chunk-GWG7IDIL.js";
import "./chunk-6DOJRLCQ.js";
import "./chunk-2OS6PZWV.js";
import "./chunk-SI4YQYAP.js";
import "./chunk-K3NI3F4B.js";
import {
  AddParser
} from "./chunk-SAH7IRBP.js";
import "./chunk-X5263PRI.js";
import "./chunk-RCPM2CUA.js";
import "./chunk-CESSEMZQ.js";
import {
  BoundingInfo
} from "./chunk-ZJE4XQK6.js";
import {
  ShadowGenerator
} from "./chunk-FJVK4ECY.js";
import "./chunk-INKIDW57.js";
import {
  PostProcess
} from "./chunk-FTNKZQKS.js";
import {
  RenderTargetTexture
} from "./chunk-5THHQJAG.js";
import "./chunk-XDMWCM3S.js";
import {
  EffectWrapper
} from "./chunk-5BCZBFCD.js";
import "./chunk-KVNFFPV2.js";
import "./chunk-MS5Q3OEV.js";
import {
  Engine
} from "./chunk-ZRA7NYDC.js";
import "./chunk-Z37P4AH6.js";
import "./chunk-ZAZDILKK.js";
import "./chunk-SI3ZTALR.js";
import "./chunk-TJZRBYWF.js";
import "./chunk-CRAMLVPI.js";
import "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import "./chunk-4SFBNKXP.js";
import "./chunk-LY4CWJEX.js";
import "./chunk-7EDSNBQ5.js";
import "./chunk-W7NAK7I4.js";
import {
  SceneComponentConstants
} from "./chunk-XSRNQTYL.js";
import {
  PostProcessManager
} from "./chunk-WOKXMMT7.js";
import "./chunk-YNSIAG7O.js";
import "./chunk-O36BJWZ2.js";
import "./chunk-T324X5NK.js";
import "./chunk-VMPPSYS3.js";
import {
  FloatingOriginCurrentScene,
  GetOffsetTransformMatrices
} from "./chunk-EWHDDCCY.js";
import "./chunk-4ZWKSYMN.js";
import "./chunk-ZOIT5ZEZ.js";
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
import "./chunk-N5T6XPNQ.js";
import "./chunk-2HUMDLGD.js";
import "./chunk-QD4Q3FLX.js";
import "./chunk-BFIQD25N.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import "./chunk-D664DUZM.js";
import "./chunk-ZKYT7Q6J.js";
import "./chunk-STIKNZXL.js";
import "./chunk-I3IYKWNG.js";
import {
  _WarnImport
} from "./chunk-MMWR3MO4.js";
import {
  Matrix,
  Vector3
} from "./chunk-YLLTSBLI.js";
import {
  EngineStore
} from "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/thinMinMaxReducer.js
var DepthTextureType;
(function(DepthTextureType2) {
  DepthTextureType2[DepthTextureType2["NormalizedViewDepth"] = 0] = "NormalizedViewDepth";
  DepthTextureType2[DepthTextureType2["ViewDepth"] = 1] = "ViewDepth";
  DepthTextureType2[DepthTextureType2["ScreenDepth"] = 2] = "ScreenDepth";
})(DepthTextureType || (DepthTextureType = {}));
var ThinMinMaxReducerPostProcess = class _ThinMinMaxReducerPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./minmaxRedux.fragment-BPGWVOA4.js"));
    } else {
      list.push(import("./minmaxRedux.fragment-TSOXMURB.js"));
    }
  }
  constructor(name, engine = null, defines = "", options) {
    super({
      ...options,
      name,
      engine: engine || Engine.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: _ThinMinMaxReducerPostProcess.FragmentUrl,
      uniforms: _ThinMinMaxReducerPostProcess.Uniforms,
      defines
    });
    this.textureWidth = 0;
    this.textureHeight = 0;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this.drawWrapper.effect;
    if (this.textureWidth === 1 || this.textureHeight === 1) {
      effect.setInt2("texSize", this.textureWidth, this.textureHeight);
    } else {
      effect.setFloat2("texSize", this.textureWidth, this.textureHeight);
    }
  }
};
ThinMinMaxReducerPostProcess.FragmentUrl = "minmaxRedux";
ThinMinMaxReducerPostProcess.Uniforms = ["texSize"];
var BufferFloat = new Float32Array(4 * 1 * 1);
var BufferUint8 = new Uint8Array(4 * 1 * 1);
var MinMax = { min: 0, max: 0 };
var ThinMinMaxReducer = class {
  get depthRedux() {
    return this._depthRedux;
  }
  set depthRedux(value) {
    if (this._depthRedux === value) {
      return;
    }
    this._depthRedux = value;
    this._recreatePostProcesses();
  }
  get textureWidth() {
    return this._textureWidth;
  }
  get textureHeight() {
    return this._textureHeight;
  }
  constructor(scene, depthRedux = true) {
    this.onAfterReductionPerformed = new Observable();
    this._textureWidth = 0;
    this._textureHeight = 0;
    this._scene = scene;
    this._depthRedux = depthRedux;
    this.reductionSteps = [];
  }
  setTextureDimensions(width, height, depthTextureType = 0) {
    if (width === this._textureWidth && height === this._textureHeight && depthTextureType === this._depthTextureType) {
      return false;
    }
    this._textureWidth = width;
    this._textureHeight = height;
    this._depthTextureType = depthTextureType;
    this._recreatePostProcesses();
    return true;
  }
  readMinMax(texture) {
    const isFloat = texture.type === Engine.TEXTURETYPE_FLOAT || texture.type === Engine.TEXTURETYPE_HALF_FLOAT;
    const buffer = isFloat ? BufferFloat : BufferUint8;
    this._scene.getEngine()._readTexturePixels(texture, 1, 1, -1, 0, buffer, false);
    MinMax.min = buffer[0];
    MinMax.max = buffer[1];
    if (!isFloat) {
      MinMax.min = MinMax.min / 255;
      MinMax.max = MinMax.max / 255;
    }
    if (MinMax.min >= MinMax.max) {
      MinMax.min = 0;
      MinMax.max = 1;
    }
    this.onAfterReductionPerformed.notifyObservers(MinMax);
  }
  dispose(disposeAll = true) {
    if (disposeAll) {
      this.onAfterReductionPerformed.clear();
      this._textureWidth = 0;
      this._textureHeight = 0;
    }
    for (let i = 0; i < this.reductionSteps.length; ++i) {
      this.reductionSteps[i].dispose();
    }
    this.reductionSteps.length = 0;
  }
  _recreatePostProcesses() {
    this.dispose(false);
    const scene = this._scene;
    let w = this.textureWidth, h = this.textureHeight;
    const reductionInitial = new ThinMinMaxReducerPostProcess("Initial reduction phase", scene.getEngine(), "#define INITIAL" + (this._depthRedux ? "\n#define DEPTH_REDUX" : "") + (this._depthTextureType === 1 ? "\n#define VIEW_DEPTH" : ""));
    reductionInitial.textureWidth = w;
    reductionInitial.textureHeight = h;
    this.reductionSteps.push(reductionInitial);
    let index = 1;
    while (w > 1 || h > 1) {
      w = Math.max(Math.round(w / 2), 1);
      h = Math.max(Math.round(h / 2), 1);
      const reduction = new ThinMinMaxReducerPostProcess("Reduction phase " + index, scene.getEngine(), "#define " + (w == 1 && h == 1 ? "LAST" : w == 1 || h == 1 ? "ONEBEFORELAST" : "MAIN"));
      reduction.textureWidth = w;
      reduction.textureHeight = h;
      this.reductionSteps.push(reduction);
      index++;
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/minMaxReducer.js
var MinMaxReducer = class {
  /**
   * Observable triggered when the computation has been performed
   */
  get onAfterReductionPerformed() {
    return this._thinMinMaxReducer.onAfterReductionPerformed;
  }
  /**
   * Creates a min/max reducer
   * @param camera The camera to use for the post processes
   */
  constructor(camera) {
    this._onAfterUnbindObserver = null;
    this._forceFullscreenViewport = true;
    this._activated = false;
    this._camera = camera;
    this._postProcessManager = new PostProcessManager(camera.getScene());
    this._thinMinMaxReducer = new ThinMinMaxReducer(camera.getScene());
    this._reductionSteps = [];
    this._onContextRestoredObserver = camera.getEngine().onContextRestoredObservable.add(() => {
      this._postProcessManager._rebuild();
    });
  }
  /**
   * Gets the texture used to read the values from.
   */
  get sourceTexture() {
    return this._sourceTexture;
  }
  /**
   * Sets the source texture to read the values from.
   * One must indicate if the texture is a depth texture or not through the depthRedux parameter
   * because in such textures '1' value must not be taken into account to compute the maximum
   * as this value is used to clear the texture.
   * Note that the computation is not activated by calling this function, you must call activate() for that!
   * @param sourceTexture The texture to read the values from. The values should be in the red channel.
   * @param depthRedux Indicates if the texture is a depth texture or not
   * @param type The type of the textures created for the reduction (defaults to TEXTURETYPE_HALF_FLOAT)
   * @param forceFullscreenViewport Forces the post processes used for the reduction to be applied without taking into account viewport (defaults to true)
   */
  setSourceTexture(sourceTexture, depthRedux, type = 2, forceFullscreenViewport = true) {
    if (sourceTexture === this._sourceTexture) {
      return;
    }
    this._thinMinMaxReducer.depthRedux = depthRedux;
    this.deactivate();
    this._sourceTexture = sourceTexture;
    this._forceFullscreenViewport = forceFullscreenViewport;
    if (this._thinMinMaxReducer.setTextureDimensions(sourceTexture.getRenderWidth(), sourceTexture.getRenderHeight())) {
      this._disposePostProcesses();
      const reductionSteps = this._thinMinMaxReducer.reductionSteps;
      for (let i = 0; i < reductionSteps.length; ++i) {
        const reductionStep = reductionSteps[i];
        const postProcess = new PostProcess(reductionStep.name, ThinMinMaxReducerPostProcess.FragmentUrl, {
          effectWrapper: reductionStep,
          samplingMode: 1,
          engine: this._camera.getScene().getEngine(),
          textureType: type,
          textureFormat: 7,
          size: { width: reductionStep.textureWidth, height: reductionStep.textureHeight }
        });
        this._reductionSteps.push(postProcess);
        postProcess.autoClear = false;
        postProcess.forceFullscreenViewport = forceFullscreenViewport;
        if (i === 0) {
          postProcess.externalTextureSamplerBinding = true;
          postProcess.onApplyObservable.add((effect) => {
            effect.setTexture("textureSampler", this._sourceTexture);
          });
        }
        if (i === reductionSteps.length - 1) {
          this._reductionSteps[i - 1].onAfterRenderObservable.add(() => {
            this._thinMinMaxReducer.readMinMax(postProcess.inputTexture.texture);
          });
        }
      }
    }
  }
  /**
   * Defines the refresh rate of the computation.
   * Use 0 to compute just once, 1 to compute on every frame, 2 to compute every two frames and so on...
   */
  get refreshRate() {
    return this._sourceTexture ? this._sourceTexture.refreshRate : -1;
  }
  set refreshRate(value) {
    if (this._sourceTexture) {
      this._sourceTexture.refreshRate = value;
    }
  }
  /**
   * Gets the activation status of the reducer
   */
  get activated() {
    return this._activated;
  }
  /**
   * Activates the reduction computation.
   * When activated, the observers registered in onAfterReductionPerformed are
   * called after the computation is performed
   */
  activate() {
    if (this._onAfterUnbindObserver || !this._sourceTexture) {
      return;
    }
    this._onAfterUnbindObserver = this._sourceTexture.onAfterUnbindObservable.add(() => {
      const engine = this._camera.getScene().getEngine();
      engine._debugPushGroup?.(`min max reduction`);
      this._reductionSteps[0].activate(this._camera);
      this._postProcessManager.directRender(this._reductionSteps, this._reductionSteps[0].inputTexture, this._forceFullscreenViewport, 0, 0, true, this._reductionSteps.length - 1);
      engine.unBindFramebuffer(this._reductionSteps[this._reductionSteps.length - 1].inputTexture, false);
      engine._debugPopGroup?.();
    });
    this._activated = true;
  }
  /**
   * Deactivates the reduction computation.
   */
  deactivate() {
    if (!this._onAfterUnbindObserver || !this._sourceTexture) {
      return;
    }
    this._sourceTexture.onAfterUnbindObservable.remove(this._onAfterUnbindObserver);
    this._onAfterUnbindObserver = null;
    this._activated = false;
  }
  /**
   * Disposes the min/max reducer
   * @param disposeAll true to dispose all the resources. You should always call this function with true as the parameter (or without any parameter as it is the default one). This flag is meant to be used internally.
   */
  dispose(disposeAll = true) {
    if (!disposeAll) {
      return;
    }
    this.onAfterReductionPerformed.clear();
    this._camera.getEngine().onContextRestoredObservable.remove(this._onContextRestoredObserver);
    this._onContextRestoredObserver = void 0;
    this._disposePostProcesses();
    this._postProcessManager.dispose();
    this._postProcessManager = void 0;
    this._thinMinMaxReducer.dispose();
    this._thinMinMaxReducer = void 0;
    this._sourceTexture = null;
  }
  _disposePostProcesses() {
    for (let i = 0; i < this._reductionSteps.length; ++i) {
      this._reductionSteps[i].dispose();
    }
    this._reductionSteps.length = 0;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/depthReducer.js
var DepthReducer = class extends MinMaxReducer {
  /**
   * Gets the depth renderer used for the computation.
   * Note that the result is null if you provide your own renderer when calling setDepthRenderer.
   */
  get depthRenderer() {
    return this._depthRenderer;
  }
  /**
   * Creates a depth reducer
   * @param camera The camera used to render the depth texture
   */
  constructor(camera) {
    super(camera);
  }
  /**
   * Sets the depth renderer to use to generate the depth map
   * @param depthRenderer The depth renderer to use. If not provided, a new one will be created automatically
   * @param type The texture type of the depth map (default: TEXTURETYPE_HALF_FLOAT)
   * @param forceFullscreenViewport Forces the post processes used for the reduction to be applied without taking into account viewport (defaults to true)
   */
  setDepthRenderer(depthRenderer = null, type = 2, forceFullscreenViewport = true) {
    const scene = this._camera.getScene();
    if (this._depthRenderer) {
      delete scene._depthRenderer[this._depthRendererId];
      this._depthRenderer.dispose();
      this._depthRenderer = null;
    }
    if (depthRenderer === null) {
      if (!scene._depthRenderer) {
        scene._depthRenderer = {};
      }
      this._depthRendererId = "minmax_" + this._camera.id;
      depthRenderer = this._depthRenderer = new DepthRenderer(scene, type, this._camera, false, 1, false, `DepthRenderer ${this._depthRendererId}`);
      depthRenderer.enabled = false;
      scene._depthRenderer[this._depthRendererId] = depthRenderer;
    }
    super.setSourceTexture(depthRenderer.getDepthMap(), true, type, forceFullscreenViewport);
  }
  /**
   * @internal
   */
  setSourceTexture(sourceTexture, depthRedux, type = 2, forceFullscreenViewport = true) {
    super.setSourceTexture(sourceTexture, depthRedux, type, forceFullscreenViewport);
  }
  /**
   * Activates the reduction computation.
   * When activated, the observers registered in onAfterReductionPerformed are
   * called after the computation is performed
   */
  activate() {
    if (this._depthRenderer) {
      this._depthRenderer.enabled = true;
    }
    super.activate();
  }
  /**
   * Deactivates the reduction computation.
   */
  deactivate() {
    super.deactivate();
    if (this._depthRenderer) {
      this._depthRenderer.enabled = false;
    }
  }
  /**
   * Disposes the depth reducer
   * @param disposeAll true to dispose all the resources. You should always call this function with true as the parameter (or without any parameter as it is the default one). This flag is meant to be used internally.
   */
  dispose(disposeAll = true) {
    super.dispose(disposeAll);
    if (this._depthRenderer && disposeAll) {
      this._depthRenderer.dispose();
      this._depthRenderer = null;
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Lights/Shadows/cascadedShadowGenerator.js
var UpDir = Vector3.Up();
var ZeroVec = Vector3.Zero();
var Tmpv1 = new Vector3();
var Tmpv2 = new Vector3();
var TmpMatrix = new Matrix();
var CascadedShadowGenerator = class _CascadedShadowGenerator extends ShadowGenerator {
  _validateFilter(filter) {
    if (filter === ShadowGenerator.FILTER_NONE || filter === ShadowGenerator.FILTER_PCF || filter === ShadowGenerator.FILTER_PCSS) {
      return filter;
    }
    Logger.Error('Unsupported filter "' + filter + '"!');
    return ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets or set the number of cascades used by the CSM.
   */
  get numCascades() {
    return this._numCascades;
  }
  set numCascades(value) {
    value = Math.min(Math.max(value, _CascadedShadowGenerator.MIN_CASCADES_COUNT), _CascadedShadowGenerator.MAX_CASCADES_COUNT);
    if (value === this._numCascades) {
      return;
    }
    this._numCascades = value;
    this.recreateShadowMap();
    this._recreateSceneUBOs();
  }
  /**
   * Enables or disables the shadow casters bounding info computation.
   * If your shadow casters don't move, you can disable this feature.
   * If it is enabled, the bounding box computation is done every frame.
   */
  get freezeShadowCastersBoundingInfo() {
    return this._freezeShadowCastersBoundingInfo;
  }
  set freezeShadowCastersBoundingInfo(freeze) {
    if (this._freezeShadowCastersBoundingInfoObservable && freeze) {
      this._scene.onBeforeRenderObservable.remove(this._freezeShadowCastersBoundingInfoObservable);
      this._freezeShadowCastersBoundingInfoObservable = null;
    }
    if (!this._freezeShadowCastersBoundingInfoObservable && !freeze) {
      this._freezeShadowCastersBoundingInfoObservable = this._scene.onBeforeRenderObservable.add(() => this._computeShadowCastersBoundingInfo());
    }
    this._freezeShadowCastersBoundingInfo = freeze;
    if (freeze) {
      this._computeShadowCastersBoundingInfo();
    }
  }
  _computeShadowCastersBoundingInfo() {
    this._scbiMin.copyFromFloats(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._scbiMax.copyFromFloats(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    if (this._shadowMap && this._shadowMap.renderList) {
      const renderList = this._shadowMap.renderList;
      for (let meshIndex = 0; meshIndex < renderList.length; meshIndex++) {
        const mesh = renderList[meshIndex];
        if (!mesh) {
          continue;
        }
        const boundingInfo = mesh.getBoundingInfo(), boundingBox = boundingInfo.boundingBox;
        this._scbiMin.minimizeInPlace(boundingBox.minimumWorld);
        this._scbiMax.maximizeInPlace(boundingBox.maximumWorld);
      }
    }
    this._shadowCastersBoundingInfo.reConstruct(this._scbiMin, this._scbiMax);
  }
  /**
   * Gets or sets the shadow casters bounding info.
   * If you provide your own shadow casters bounding info, first enable freezeShadowCastersBoundingInfo
   * so that the system won't overwrite the bounds you provide
   */
  get shadowCastersBoundingInfo() {
    return this._shadowCastersBoundingInfo;
  }
  set shadowCastersBoundingInfo(boundingInfo) {
    this._shadowCastersBoundingInfo = boundingInfo;
  }
  /**
   * Sets the minimal and maximal distances to use when computing the cascade breaks.
   *
   * The values of min / max are typically the depth zmin and zmax values of your scene, for a given frame.
   * If you don't know these values, simply leave them to their defaults and don't call this function.
   * @param min minimal distance for the breaks (default to 0.)
   * @param max maximal distance for the breaks (default to 1.)
   */
  setMinMaxDistance(min, max) {
    if (this._minDistance === min && this._maxDistance === max) {
      return;
    }
    if (min > max) {
      min = 0;
      max = 1;
    }
    if (min < 0) {
      min = 0;
    }
    if (max > 1) {
      max = 1;
    }
    this._minDistance = min;
    this._maxDistance = max;
    this._breaksAreDirty = true;
  }
  /** Gets the minimal distance used in the cascade break computation */
  get minDistance() {
    return this._minDistance;
  }
  /** Gets the maximal distance used in the cascade break computation */
  get maxDistance() {
    return this._maxDistance;
  }
  /**
   * Gets the class name of that object
   * @returns "CascadedShadowGenerator"
   */
  getClassName() {
    return _CascadedShadowGenerator.CLASSNAME;
  }
  /**
   * Gets a cascade minimum extents
   * @param cascadeIndex index of the cascade
   * @returns the minimum cascade extents
   */
  getCascadeMinExtents(cascadeIndex) {
    return cascadeIndex >= 0 && cascadeIndex < this._numCascades ? this._cascadeMinExtents[cascadeIndex] : null;
  }
  /**
   * Gets a cascade maximum extents
   * @param cascadeIndex index of the cascade
   * @returns the maximum cascade extents
   */
  getCascadeMaxExtents(cascadeIndex) {
    return cascadeIndex >= 0 && cascadeIndex < this._numCascades ? this._cascadeMaxExtents[cascadeIndex] : null;
  }
  /**
   * Gets the shadow max z distance. It's the limit beyond which shadows are not displayed.
   * It defaults to camera.maxZ
   */
  get shadowMaxZ() {
    if (!this._getCamera()) {
      return 0;
    }
    return this._shadowMaxZ;
  }
  /**
   * Sets the shadow max z distance.
   */
  set shadowMaxZ(value) {
    const camera = this._getCamera();
    if (!camera) {
      this._shadowMaxZ = value;
      return;
    }
    if (this._shadowMaxZ === value || value < camera.minZ || value > camera.maxZ && camera.maxZ !== 0) {
      return;
    }
    this._shadowMaxZ = value;
    this._light._markMeshesAsLightDirty();
    this._breaksAreDirty = true;
  }
  /**
   * Gets or sets the debug flag.
   * When enabled, the cascades are materialized by different colors on the screen.
   */
  get debug() {
    return this._debug;
  }
  set debug(dbg) {
    this._debug = dbg;
    this._light._markMeshesAsLightDirty();
  }
  /**
   * Gets or sets the depth clamping value.
   *
   * When enabled, it improves the shadow quality because the near z plane of the light frustum don't need to be adjusted
   * to account for the shadow casters far away.
   *
   * Note that this property is incompatible with PCSS filtering, so it won't be used in that case.
   */
  get depthClamp() {
    return this._depthClamp;
  }
  set depthClamp(value) {
    this._depthClamp = value;
  }
  /**
   * Gets or sets the percentage of blending between two cascades (value between 0. and 1.).
   * It defaults to 0.1 (10% blending).
   */
  get cascadeBlendPercentage() {
    return this._cascadeBlendPercentage;
  }
  set cascadeBlendPercentage(value) {
    this._cascadeBlendPercentage = value;
    this._light._markMeshesAsLightDirty();
  }
  /**
   * Gets or set the lambda parameter.
   * This parameter is used to split the camera frustum and create the cascades.
   * It's a value between 0. and 1.: If 0, the split is a uniform split of the frustum, if 1 it is a logarithmic split.
   * For all values in-between, it's a linear combination of the uniform and logarithm split algorithm.
   */
  get lambda() {
    return this._lambda;
  }
  set lambda(value) {
    const lambda = Math.min(Math.max(value, 0), 1);
    if (this._lambda == lambda) {
      return;
    }
    this._lambda = lambda;
    this._breaksAreDirty = true;
  }
  /**
   * Gets the view matrix corresponding to a given cascade
   * @param cascadeNum cascade to retrieve the view matrix from
   * @returns the cascade view matrix
   */
  getCascadeViewMatrix(cascadeNum) {
    return cascadeNum >= 0 && cascadeNum < this._numCascades ? this._viewMatrices[cascadeNum] : null;
  }
  /**
   * Gets the projection matrix corresponding to a given cascade
   * @param cascadeNum cascade to retrieve the projection matrix from
   * @returns the cascade projection matrix
   */
  getCascadeProjectionMatrix(cascadeNum) {
    return cascadeNum >= 0 && cascadeNum < this._numCascades ? this._projectionMatrices[cascadeNum] : null;
  }
  /**
   * Gets the transformation matrix corresponding to a given cascade
   * @param cascadeNum cascade to retrieve the transformation matrix from
   * @returns the cascade transformation matrix
   */
  getCascadeTransformMatrix(cascadeNum) {
    return cascadeNum >= 0 && cascadeNum < this._numCascades ? this._transformMatrices[cascadeNum] : null;
  }
  /**
   * Sets the depth renderer to use when autoCalcDepthBounds is enabled.
   *
   * Note that if no depth renderer is set, a new one will be automatically created internally when necessary.
   *
   * You should call this function if you already have a depth renderer enabled in your scene, to avoid
   * doing multiple depth rendering each frame. If you provide your own depth renderer, make sure it stores linear depth!
   * @param depthRenderer The depth renderer to use when autoCalcDepthBounds is enabled. If you pass null or don't call this function at all, a depth renderer will be automatically created
   */
  setDepthRenderer(depthRenderer) {
    this._depthRenderer = depthRenderer;
    if (this._depthReducer) {
      this._depthReducer.setDepthRenderer(this._depthRenderer);
    }
  }
  /**
   * Gets or sets the autoCalcDepthBounds property.
   *
   * When enabled, a depth rendering pass is first performed (with an internally created depth renderer or with the one
   * you provide by calling setDepthRenderer). Then, a min/max reducing is applied on the depth map to compute the
   * minimal and maximal depth of the map and those values are used as inputs for the setMinMaxDistance() function.
   * It can greatly enhance the shadow quality, at the expense of more GPU works.
   * When using this option, you should increase the value of the lambda parameter, and even set it to 1 for best results.
   */
  get autoCalcDepthBounds() {
    return this._autoCalcDepthBounds;
  }
  set autoCalcDepthBounds(value) {
    const camera = this._getCamera();
    if (!camera) {
      return;
    }
    this._autoCalcDepthBounds = value;
    if (!value) {
      if (this._depthReducer) {
        this._depthReducer.deactivate();
      }
      this.setMinMaxDistance(0, 1);
      return;
    }
    if (!this._depthReducer) {
      this._depthReducer = new DepthReducer(camera);
      this._depthReducer.onAfterReductionPerformed.add((minmax) => {
        let min = minmax.min, max = minmax.max;
        if (min >= max) {
          min = 0;
          max = 1;
        }
        if (min != this._minDistance || max != this._maxDistance) {
          this.setMinMaxDistance(min, max);
        }
      });
      this._depthReducer.setDepthRenderer(this._depthRenderer);
    }
    this._depthReducer.activate();
  }
  /**
   * Defines the refresh rate of the min/max computation used when autoCalcDepthBounds is set to true
   * Use 0 to compute just once, 1 to compute on every frame, 2 to compute every two frames and so on...
   * Note that if you provided your own depth renderer through a call to setDepthRenderer, you are responsible
   * for setting the refresh rate on the renderer yourself!
   */
  get autoCalcDepthBoundsRefreshRate() {
    return this._depthReducer?.depthRenderer?.getDepthMap().refreshRate ?? -1;
  }
  set autoCalcDepthBoundsRefreshRate(value) {
    if (this._depthReducer?.depthRenderer) {
      this._depthReducer.depthRenderer.getDepthMap().refreshRate = value;
    }
  }
  /**
   * Create the cascade breaks according to the lambda, shadowMaxZ and min/max distance properties, as well as the camera near and far planes.
   * This function is automatically called when updating lambda, shadowMaxZ and min/max distances, however you should call it yourself if
   * you change the camera near/far planes!
   */
  splitFrustum() {
    this._breaksAreDirty = true;
  }
  _splitFrustum() {
    const camera = this._getCamera();
    if (!camera) {
      return;
    }
    const near = camera.minZ, far = camera.maxZ || this._shadowMaxZ, cameraRange = far - near, minDistance = this._minDistance, maxDistance = this._shadowMaxZ < far && this._shadowMaxZ >= near ? Math.min((this._shadowMaxZ - near) / (far - near), this._maxDistance) : this._maxDistance;
    const minZ = near + minDistance * cameraRange, maxZ = near + maxDistance * cameraRange;
    const range = maxZ - minZ, ratio = maxZ / minZ;
    for (let cascadeIndex = 0; cascadeIndex < this._cascades.length; ++cascadeIndex) {
      const p = (cascadeIndex + 1) / this._numCascades, log = minZ * ratio ** p, uniform = minZ + range * p;
      const d = this._lambda * (log - uniform) + uniform;
      this._cascades[cascadeIndex].prevBreakDistance = cascadeIndex === 0 ? minDistance : this._cascades[cascadeIndex - 1].breakDistance;
      this._cascades[cascadeIndex].breakDistance = (d - near) / cameraRange;
      this._viewSpaceFrustumsZ[cascadeIndex] = d;
      this._frustumLengths[cascadeIndex] = (this._cascades[cascadeIndex].breakDistance - this._cascades[cascadeIndex].prevBreakDistance) * cameraRange;
    }
    this._breaksAreDirty = false;
  }
  _computeMatrices() {
    const scene = this._scene;
    const camera = this._getCamera();
    if (!camera) {
      return;
    }
    Vector3.NormalizeToRef(this._light.getShadowDirection(0), this._lightDirection);
    if (Math.abs(Vector3.Dot(this._lightDirection, Vector3.Up())) === 1) {
      this._lightDirection.z = 1e-13;
    }
    this._cachedDirection.copyFrom(this._lightDirection);
    const useReverseDepthBuffer = scene.getEngine().useReverseDepthBuffer;
    for (let cascadeIndex = 0; cascadeIndex < this._numCascades; ++cascadeIndex) {
      this._computeFrustumInWorldSpace(cascadeIndex);
      this._computeCascadeFrustum(cascadeIndex);
      this._cascadeMaxExtents[cascadeIndex].subtractToRef(this._cascadeMinExtents[cascadeIndex], Tmpv1);
      this._frustumCenter[cascadeIndex].addToRef(this._lightDirection.scale(this._cascadeMinExtents[cascadeIndex].z), this._shadowCameraPos[cascadeIndex]);
      Matrix.LookAtLHToRef(this._shadowCameraPos[cascadeIndex], this._frustumCenter[cascadeIndex], UpDir, this._viewMatrices[cascadeIndex]);
      let viewMinZ = 0, viewMaxZ = Tmpv1.z;
      const boundingInfo = this._shadowCastersBoundingInfo;
      boundingInfo.update(this._viewMatrices[cascadeIndex]);
      const castersViewMinZ = boundingInfo.boundingBox.minimumWorld.z;
      const castersViewMaxZ = boundingInfo.boundingBox.maximumWorld.z;
      if (castersViewMinZ > viewMaxZ) {
      } else {
        if (!this._depthClamp || this.filter === ShadowGenerator.FILTER_PCSS) {
          viewMinZ = Math.min(viewMinZ, castersViewMinZ);
          if (this.filter !== ShadowGenerator.FILTER_PCSS) {
            viewMaxZ = Math.min(viewMaxZ, castersViewMaxZ);
          }
        } else {
          viewMaxZ = Math.min(viewMaxZ, castersViewMaxZ);
          viewMinZ = Math.max(viewMinZ, castersViewMinZ);
          viewMaxZ = Math.max(viewMinZ + 1, viewMaxZ);
        }
      }
      Matrix.OrthoOffCenterLHToRef(this._cascadeMinExtents[cascadeIndex].x, this._cascadeMaxExtents[cascadeIndex].x, this._cascadeMinExtents[cascadeIndex].y, this._cascadeMaxExtents[cascadeIndex].y, useReverseDepthBuffer ? viewMaxZ : viewMinZ, useReverseDepthBuffer ? viewMinZ : viewMaxZ, this._projectionMatrices[cascadeIndex], scene.getEngine().isNDCHalfZRange);
      this._cascadeMinExtents[cascadeIndex].z = viewMinZ;
      this._cascadeMaxExtents[cascadeIndex].z = viewMaxZ;
      this._viewMatrices[cascadeIndex].multiplyToRef(this._projectionMatrices[cascadeIndex], this._transformMatrices[cascadeIndex]);
      Vector3.TransformCoordinatesToRef(ZeroVec, this._transformMatrices[cascadeIndex], Tmpv1);
      Tmpv1.scaleInPlace(this._mapSize / 2);
      Tmpv2.copyFromFloats(Math.round(Tmpv1.x), Math.round(Tmpv1.y), Math.round(Tmpv1.z));
      Tmpv2.subtractInPlace(Tmpv1).scaleInPlace(2 / this._mapSize);
      Matrix.TranslationToRef(Tmpv2.x, Tmpv2.y, 0, TmpMatrix);
      this._projectionMatrices[cascadeIndex].multiplyToRef(TmpMatrix, this._projectionMatrices[cascadeIndex]);
      this._viewMatrices[cascadeIndex].multiplyToRef(this._projectionMatrices[cascadeIndex], this._transformMatrices[cascadeIndex]);
      this._transformMatrices[cascadeIndex].copyToArray(this._transformMatricesAsArray, cascadeIndex * 16);
    }
  }
  // Get the 8 points of the view frustum in world space
  _computeFrustumInWorldSpace(cascadeIndex) {
    const camera = this._getCamera();
    if (!camera) {
      return;
    }
    const prevSplitDist = this._cascades[cascadeIndex].prevBreakDistance, splitDist = this._cascades[cascadeIndex].breakDistance;
    const isNDCHalfZRange = this._scene.getEngine().isNDCHalfZRange;
    camera.getViewMatrix();
    const cameraInfiniteFarPlane = camera.maxZ === 0;
    const saveCameraMaxZ = camera.maxZ;
    if (cameraInfiniteFarPlane) {
      camera.maxZ = this._shadowMaxZ;
      camera.getProjectionMatrix(true);
    }
    const invViewProj = Matrix.Invert(camera.getTransformationMatrix());
    if (cameraInfiniteFarPlane) {
      camera.maxZ = saveCameraMaxZ;
      camera.getProjectionMatrix(true);
    }
    const cornerIndexOffset = this._scene.getEngine().useReverseDepthBuffer ? 4 : 0;
    for (let cornerIndex = 0; cornerIndex < _CascadedShadowGenerator._FrustumCornersNdcSpace.length; ++cornerIndex) {
      Tmpv1.copyFrom(_CascadedShadowGenerator._FrustumCornersNdcSpace[(cornerIndex + cornerIndexOffset) % _CascadedShadowGenerator._FrustumCornersNdcSpace.length]);
      if (isNDCHalfZRange && Tmpv1.z === -1) {
        Tmpv1.z = 0;
      }
      Vector3.TransformCoordinatesToRef(Tmpv1, invViewProj, this._frustumCornersWorldSpace[cascadeIndex][cornerIndex]);
    }
    for (let cornerIndex = 0; cornerIndex < _CascadedShadowGenerator._FrustumCornersNdcSpace.length / 2; ++cornerIndex) {
      Tmpv1.copyFrom(this._frustumCornersWorldSpace[cascadeIndex][cornerIndex + 4]).subtractInPlace(this._frustumCornersWorldSpace[cascadeIndex][cornerIndex]);
      Tmpv2.copyFrom(Tmpv1).scaleInPlace(prevSplitDist);
      Tmpv1.scaleInPlace(splitDist);
      Tmpv1.addInPlace(this._frustumCornersWorldSpace[cascadeIndex][cornerIndex]);
      this._frustumCornersWorldSpace[cascadeIndex][cornerIndex + 4].copyFrom(Tmpv1);
      this._frustumCornersWorldSpace[cascadeIndex][cornerIndex].addInPlace(Tmpv2);
    }
  }
  _computeCascadeFrustum(cascadeIndex) {
    this._cascadeMinExtents[cascadeIndex].copyFromFloats(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._cascadeMaxExtents[cascadeIndex].copyFromFloats(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    this._frustumCenter[cascadeIndex].copyFromFloats(0, 0, 0);
    const camera = this._getCamera();
    if (!camera) {
      return;
    }
    for (let cornerIndex = 0; cornerIndex < this._frustumCornersWorldSpace[cascadeIndex].length; ++cornerIndex) {
      this._frustumCenter[cascadeIndex].addInPlace(this._frustumCornersWorldSpace[cascadeIndex][cornerIndex]);
    }
    this._frustumCenter[cascadeIndex].scaleInPlace(1 / this._frustumCornersWorldSpace[cascadeIndex].length);
    if (this.stabilizeCascades) {
      let sphereRadius = 0;
      for (let cornerIndex = 0; cornerIndex < this._frustumCornersWorldSpace[cascadeIndex].length; ++cornerIndex) {
        const dist = this._frustumCornersWorldSpace[cascadeIndex][cornerIndex].subtractToRef(this._frustumCenter[cascadeIndex], Tmpv1).length();
        sphereRadius = Math.max(sphereRadius, dist);
      }
      sphereRadius = Math.ceil(sphereRadius * 16) / 16;
      this._cascadeMaxExtents[cascadeIndex].copyFromFloats(sphereRadius, sphereRadius, sphereRadius);
      this._cascadeMinExtents[cascadeIndex].copyFromFloats(-sphereRadius, -sphereRadius, -sphereRadius);
    } else {
      const lightCameraPos = this._frustumCenter[cascadeIndex];
      this._frustumCenter[cascadeIndex].addToRef(this._lightDirection, Tmpv1);
      Matrix.LookAtLHToRef(lightCameraPos, Tmpv1, UpDir, TmpMatrix);
      for (let cornerIndex = 0; cornerIndex < this._frustumCornersWorldSpace[cascadeIndex].length; ++cornerIndex) {
        Vector3.TransformCoordinatesToRef(this._frustumCornersWorldSpace[cascadeIndex][cornerIndex], TmpMatrix, Tmpv1);
        this._cascadeMinExtents[cascadeIndex].minimizeInPlace(Tmpv1);
        this._cascadeMaxExtents[cascadeIndex].maximizeInPlace(Tmpv1);
      }
    }
  }
  _recreateSceneUBOs() {
    this._disposeSceneUBOs();
    if (this._sceneUBOs) {
      for (let i = 0; i < this._numCascades; ++i) {
        this._sceneUBOs.push(this._scene.createSceneUniformBuffer(`Scene for CSM Shadow Generator (light "${this._light.name}" cascade #${i})`));
      }
    }
  }
  /**
   *  Support test.
   */
  static get IsSupported() {
    const engine = EngineStore.LastCreatedEngine;
    if (!engine) {
      return false;
    }
    return engine._features.supportCSM;
  }
  /**
   * Creates a Cascaded Shadow Generator object.
   * A ShadowGenerator is the required tool to use the shadows.
   * Each directional light casting shadows needs to use its own ShadowGenerator.
   * Documentation : https://doc.babylonjs.com/babylon101/cascadedShadows
   * @param mapSize The size of the texture what stores the shadows. Example : 1024.
   * @param light The directional light object generating the shadows.
   * @param usefulFloatFirst By default the generator will try to use half float textures but if you need precision (for self shadowing for instance), you can use this option to enforce full float texture.
   * @param camera Camera associated with this shadow generator (default: null). If null, takes the scene active camera at the time we need to access it
   * @param useRedTextureType Forces the generator to use a Red instead of a RGBA type for the shadow map texture format (default: true)
   */
  constructor(mapSize, light, usefulFloatFirst, camera, useRedTextureType = true) {
    if (!_CascadedShadowGenerator.IsSupported) {
      Logger.Error("CascadedShadowMap is not supported by the current engine.");
      return;
    }
    super(mapSize, light, usefulFloatFirst, camera, useRedTextureType);
    this.usePercentageCloserFiltering = true;
  }
  _initializeGenerator() {
    this.penumbraDarkness = this.penumbraDarkness ?? 1;
    this._numCascades = this._numCascades ?? _CascadedShadowGenerator.DEFAULT_CASCADES_COUNT;
    this.stabilizeCascades = this.stabilizeCascades ?? false;
    this._freezeShadowCastersBoundingInfoObservable = this._freezeShadowCastersBoundingInfoObservable ?? null;
    this.freezeShadowCastersBoundingInfo = this.freezeShadowCastersBoundingInfo ?? false;
    this._scbiMin = this._scbiMin ?? new Vector3(0, 0, 0);
    this._scbiMax = this._scbiMax ?? new Vector3(0, 0, 0);
    this._shadowCastersBoundingInfo = this._shadowCastersBoundingInfo ?? new BoundingInfo(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
    this._breaksAreDirty = this._breaksAreDirty ?? true;
    this._minDistance = this._minDistance ?? 0;
    this._maxDistance = this._maxDistance ?? 1;
    this._currentLayer = this._currentLayer ?? 0;
    this._shadowMaxZ = this._shadowMaxZ ?? this._getCamera()?.maxZ ?? 1e4;
    this._debug = this._debug ?? false;
    this._depthClamp = this._depthClamp ?? true;
    this._cascadeBlendPercentage = this._cascadeBlendPercentage ?? 0.1;
    this._lambda = this._lambda ?? 0.5;
    this._autoCalcDepthBounds = this._autoCalcDepthBounds ?? false;
    this._recreateSceneUBOs();
    super._initializeGenerator();
  }
  _createTargetRenderTexture() {
    const engine = this._scene.getEngine();
    this._shadowMap?.dispose();
    const size = { width: this._mapSize, height: this._mapSize, layers: this.numCascades };
    this._shadowMap = new RenderTargetTexture(this._light.name + "_CSMShadowMap", size, this._scene, false, true, this._textureType, false, void 0, false, false, void 0, this._useRedTextureType ? 6 : 5);
    this._shadowMap.createDepthStencilTexture(engine.useReverseDepthBuffer ? 516 : 513, true, void 0, void 0, void 0, `DepthStencilForCSMShadowGenerator-${this._light.name}`);
    this._shadowMap.noPrePassRenderer = true;
  }
  _initializeShadowMap() {
    super._initializeShadowMap();
    if (this._shadowMap === null) {
      return;
    }
    this._transformMatricesAsArray = new Float32Array(this._numCascades * 16);
    this._tempTransformMatricesAsArray = new Float32Array(this._numCascades * 16);
    this._viewSpaceFrustumsZ = new Array(this._numCascades);
    this._frustumLengths = new Array(this._numCascades);
    this._lightSizeUVCorrection = new Array(this._numCascades * 2);
    this._depthCorrection = new Array(this._numCascades);
    this._cascades = [];
    this._viewMatrices = [];
    this._projectionMatrices = [];
    this._transformMatrices = [];
    this._cascadeMinExtents = [];
    this._cascadeMaxExtents = [];
    this._frustumCenter = [];
    this._shadowCameraPos = [];
    this._frustumCornersWorldSpace = [];
    for (let cascadeIndex = 0; cascadeIndex < this._numCascades; ++cascadeIndex) {
      this._cascades[cascadeIndex] = {
        prevBreakDistance: 0,
        breakDistance: 0
      };
      this._viewMatrices[cascadeIndex] = Matrix.Zero();
      this._projectionMatrices[cascadeIndex] = Matrix.Zero();
      this._transformMatrices[cascadeIndex] = Matrix.Zero();
      this._cascadeMinExtents[cascadeIndex] = new Vector3();
      this._cascadeMaxExtents[cascadeIndex] = new Vector3();
      this._frustumCenter[cascadeIndex] = new Vector3();
      this._shadowCameraPos[cascadeIndex] = new Vector3();
      this._frustumCornersWorldSpace[cascadeIndex] = new Array(_CascadedShadowGenerator._FrustumCornersNdcSpace.length);
      for (let i = 0; i < _CascadedShadowGenerator._FrustumCornersNdcSpace.length; ++i) {
        this._frustumCornersWorldSpace[cascadeIndex][i] = new Vector3();
      }
    }
    const engine = this._scene.getEngine();
    this._shadowMap.onBeforeBindObservable.clear();
    this._shadowMap.onBeforeRenderObservable.clear();
    this._shadowMap.onBeforeRenderObservable.add((layer) => {
      if (this._sceneUBOs) {
        this._scene.setSceneUniformBuffer(this._sceneUBOs[layer]);
      }
      this._currentLayer = layer;
      if (this._filter === ShadowGenerator.FILTER_PCF) {
        engine.setColorWrite(false);
      }
      FloatingOriginCurrentScene.eyeAtCamera = false;
      this._scene.setTransformMatrix(this.getCascadeViewMatrix(layer), this.getCascadeProjectionMatrix(layer));
      if (this._useUBO) {
        this._scene.getSceneUniformBuffer().unbindEffect();
        this._scene.finalizeSceneUbo();
      }
    });
    this._shadowMap.onBeforeBindObservable.add(() => {
      this._currentSceneUBO = this._scene.getSceneUniformBuffer();
      if (engine._enableGPUDebugMarkers) {
        engine.restoreDefaultFramebuffer();
        engine._debugPushGroup?.(`Cascaded shadow map generation for pass id ${engine.currentRenderPassId}`);
      }
      if (this._breaksAreDirty) {
        this._splitFrustum();
      }
      this._computeMatrices();
    });
    this._splitFrustum();
  }
  _bindCustomEffectForRenderSubMeshForShadowMap(subMesh, effect) {
    effect.setMatrix("viewProjection", this.getCascadeTransformMatrix(this._currentLayer));
  }
  _isReadyCustomDefines(defines) {
    defines.push("#define SM_DEPTHCLAMP " + (this._depthClamp && this._filter !== ShadowGenerator.FILTER_PCSS ? "1" : "0"));
  }
  /**
   * Prepare all the defines in a material relying on a shadow map at the specified light index.
   * @param defines Defines of the material we want to update
   * @param lightIndex Index of the light in the enabled light list of the material
   */
  prepareDefines(defines, lightIndex) {
    super.prepareDefines(defines, lightIndex);
    const scene = this._scene;
    const light = this._light;
    if (!scene.shadowsEnabled || !light.shadowEnabled) {
      return;
    }
    defines["SHADOWCSM" + lightIndex] = true;
    defines["SHADOWCSMDEBUG" + lightIndex] = this.debug;
    defines["SHADOWCSMNUM_CASCADES" + lightIndex] = this.numCascades;
    defines["SHADOWCSM_RIGHTHANDED" + lightIndex] = scene.useRightHandedSystem;
    const camera = this._getCamera();
    if (camera && this._shadowMaxZ <= (camera.maxZ || this._shadowMaxZ)) {
      defines["SHADOWCSMUSESHADOWMAXZ" + lightIndex] = true;
    }
    if (this.cascadeBlendPercentage === 0) {
      defines["SHADOWCSMNOBLEND" + lightIndex] = true;
    }
  }
  /**
   * Binds the shadow related information inside of an effect (information like near, far, darkness...
   * defined in the generator but impacting the effect).
   * @param lightIndex Index of the light in the enabled light list of the material owning the effect
   * @param effect The effect we are binfing the information for
   */
  bindShadowLight(lightIndex, effect) {
    const light = this._light;
    const scene = this._scene;
    if (!scene.shadowsEnabled || !light.shadowEnabled) {
      return;
    }
    const camera = this._getCamera();
    if (!camera) {
      return;
    }
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      return;
    }
    const width = shadowMap.getSize().width;
    const transform = this._transformMatricesAsArray;
    const lightMatrix = scene.floatingOriginMode ? GetOffsetTransformMatrices(this._scene.floatingOriginOffset, this._viewMatrices, this._projectionMatrices, this._numCascades, this._tempTransformMatricesAsArray) : transform;
    effect.setMatrices("lightMatrix" + lightIndex, lightMatrix);
    effect.setArray("viewFrustumZ" + lightIndex, this._viewSpaceFrustumsZ);
    effect.setFloat("cascadeBlendFactor" + lightIndex, this.cascadeBlendPercentage === 0 ? 1e4 : 1 / this.cascadeBlendPercentage);
    effect.setArray("frustumLengths" + lightIndex, this._frustumLengths);
    if (this._filter === ShadowGenerator.FILTER_PCF) {
      effect.setDepthStencilTexture("shadowTexture" + lightIndex, shadowMap);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), width, 1 / width, this.frustumEdgeFalloff, lightIndex);
    } else if (this._filter === ShadowGenerator.FILTER_PCSS) {
      for (let cascadeIndex = 0; cascadeIndex < this._numCascades; ++cascadeIndex) {
        this._lightSizeUVCorrection[cascadeIndex * 2 + 0] = cascadeIndex === 0 ? 1 : (this._cascadeMaxExtents[0].x - this._cascadeMinExtents[0].x) / (this._cascadeMaxExtents[cascadeIndex].x - this._cascadeMinExtents[cascadeIndex].x);
        this._lightSizeUVCorrection[cascadeIndex * 2 + 1] = cascadeIndex === 0 ? 1 : (this._cascadeMaxExtents[0].y - this._cascadeMinExtents[0].y) / (this._cascadeMaxExtents[cascadeIndex].y - this._cascadeMinExtents[cascadeIndex].y);
        this._depthCorrection[cascadeIndex] = cascadeIndex === 0 ? 1 : (this._cascadeMaxExtents[cascadeIndex].z - this._cascadeMinExtents[cascadeIndex].z) / (this._cascadeMaxExtents[0].z - this._cascadeMinExtents[0].z);
      }
      effect.setDepthStencilTexture("shadowTexture" + lightIndex, shadowMap);
      effect.setTexture("depthTexture" + lightIndex, shadowMap);
      effect.setArray2("lightSizeUVCorrection" + lightIndex, this._lightSizeUVCorrection);
      effect.setArray("depthCorrection" + lightIndex, this._depthCorrection);
      effect.setFloat("penumbraDarkness" + lightIndex, this.penumbraDarkness);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), 1 / width, this._contactHardeningLightSizeUVRatio * width, this.frustumEdgeFalloff, lightIndex);
    } else {
      effect.setTexture("shadowTexture" + lightIndex, shadowMap);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), width, 1 / width, this.frustumEdgeFalloff, lightIndex);
    }
    light._uniformBuffer.updateFloat2("depthValues", this.getLight().getDepthMinZ(camera), this.getLight().getDepthMinZ(camera) + this.getLight().getDepthMaxZ(camera), lightIndex);
  }
  /**
   * Gets the transformation matrix of the first cascade used to project the meshes into the map from the light point of view.
   * (eq to view projection * shadow projection matrices)
   * @returns The transform matrix used to create the shadow map
   */
  getTransformMatrix() {
    return this.getCascadeTransformMatrix(0);
  }
  /**
   * Disposes the ShadowGenerator.
   * Returns nothing.
   */
  dispose() {
    super.dispose();
    if (this._freezeShadowCastersBoundingInfoObservable) {
      this._scene.onBeforeRenderObservable.remove(this._freezeShadowCastersBoundingInfoObservable);
      this._freezeShadowCastersBoundingInfoObservable = null;
    }
    if (this._depthReducer) {
      this._depthReducer.dispose();
      this._depthReducer = null;
    }
  }
  /**
   * Serializes the shadow generator setup to a json object.
   * @returns The serialized JSON object
   */
  serialize() {
    const serializationObject = super.serialize();
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      return serializationObject;
    }
    serializationObject.numCascades = this._numCascades;
    serializationObject.debug = this._debug;
    serializationObject.stabilizeCascades = this.stabilizeCascades;
    serializationObject.lambda = this._lambda;
    serializationObject.cascadeBlendPercentage = this.cascadeBlendPercentage;
    serializationObject.depthClamp = this._depthClamp;
    serializationObject.autoCalcDepthBounds = this.autoCalcDepthBounds;
    serializationObject.shadowMaxZ = this._shadowMaxZ;
    serializationObject.penumbraDarkness = this.penumbraDarkness;
    serializationObject.freezeShadowCastersBoundingInfo = this._freezeShadowCastersBoundingInfo;
    serializationObject.minDistance = this.minDistance;
    serializationObject.maxDistance = this.maxDistance;
    serializationObject.renderList = [];
    if (shadowMap.renderList) {
      for (let meshIndex = 0; meshIndex < shadowMap.renderList.length; meshIndex++) {
        const mesh = shadowMap.renderList[meshIndex];
        serializationObject.renderList.push(mesh.id);
      }
    }
    return serializationObject;
  }
  /**
   * Parses a serialized ShadowGenerator and returns a new ShadowGenerator.
   * @param parsedShadowGenerator The JSON object to parse
   * @param scene The scene to create the shadow map for
   * @returns The parsed shadow generator
   */
  static Parse(parsedShadowGenerator, scene) {
    const shadowGenerator = ShadowGenerator.Parse(parsedShadowGenerator, scene, (mapSize, light, camera) => new _CascadedShadowGenerator(mapSize, light, void 0, camera));
    if (parsedShadowGenerator.numCascades !== void 0) {
      shadowGenerator.numCascades = parsedShadowGenerator.numCascades;
    }
    if (parsedShadowGenerator.debug !== void 0) {
      shadowGenerator.debug = parsedShadowGenerator.debug;
    }
    if (parsedShadowGenerator.stabilizeCascades !== void 0) {
      shadowGenerator.stabilizeCascades = parsedShadowGenerator.stabilizeCascades;
    }
    if (parsedShadowGenerator.lambda !== void 0) {
      shadowGenerator.lambda = parsedShadowGenerator.lambda;
    }
    if (parsedShadowGenerator.cascadeBlendPercentage !== void 0) {
      shadowGenerator.cascadeBlendPercentage = parsedShadowGenerator.cascadeBlendPercentage;
    }
    if (parsedShadowGenerator.depthClamp !== void 0) {
      shadowGenerator.depthClamp = parsedShadowGenerator.depthClamp;
    }
    if (parsedShadowGenerator.autoCalcDepthBounds !== void 0) {
      shadowGenerator.autoCalcDepthBounds = parsedShadowGenerator.autoCalcDepthBounds;
    }
    if (parsedShadowGenerator.shadowMaxZ !== void 0) {
      shadowGenerator.shadowMaxZ = parsedShadowGenerator.shadowMaxZ;
    }
    if (parsedShadowGenerator.penumbraDarkness !== void 0) {
      shadowGenerator.penumbraDarkness = parsedShadowGenerator.penumbraDarkness;
    }
    if (parsedShadowGenerator.freezeShadowCastersBoundingInfo !== void 0) {
      shadowGenerator.freezeShadowCastersBoundingInfo = parsedShadowGenerator.freezeShadowCastersBoundingInfo;
    }
    if (parsedShadowGenerator.minDistance !== void 0 && parsedShadowGenerator.maxDistance !== void 0) {
      shadowGenerator.setMinMaxDistance(parsedShadowGenerator.minDistance, parsedShadowGenerator.maxDistance);
    }
    return shadowGenerator;
  }
};
CascadedShadowGenerator._FrustumCornersNdcSpace = [
  new Vector3(-1, 1, -1),
  new Vector3(1, 1, -1),
  new Vector3(1, -1, -1),
  new Vector3(-1, -1, -1),
  new Vector3(-1, 1, 1),
  new Vector3(1, 1, 1),
  new Vector3(1, -1, 1),
  new Vector3(-1, -1, 1)
];
CascadedShadowGenerator.CLASSNAME = "CascadedShadowGenerator";
CascadedShadowGenerator.DEFAULT_CASCADES_COUNT = 4;
CascadedShadowGenerator.MIN_CASCADES_COUNT = 2;
CascadedShadowGenerator.MAX_CASCADES_COUNT = 4;
CascadedShadowGenerator._SceneComponentInitialization = (_) => {
  throw _WarnImport("ShadowGeneratorSceneComponent");
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js
AddParser(SceneComponentConstants.NAME_SHADOWGENERATOR, (parsedData, scene) => {
  if (parsedData.shadowGenerators !== void 0 && parsedData.shadowGenerators !== null) {
    for (let index = 0, cache = parsedData.shadowGenerators.length; index < cache; index++) {
      const parsedShadowGenerator = parsedData.shadowGenerators[index];
      if (parsedShadowGenerator.className === CascadedShadowGenerator.CLASSNAME) {
        CascadedShadowGenerator.Parse(parsedShadowGenerator, scene);
      } else {
        ShadowGenerator.Parse(parsedShadowGenerator, scene);
      }
    }
  }
});
var ShadowGeneratorSceneComponent = class {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_SHADOWGENERATOR;
    this.scene = scene;
  }
  /**
   * Registers the component in a given scene
   */
  register() {
    this.scene._gatherRenderTargetsStage.registerStep(SceneComponentConstants.STEP_GATHERRENDERTARGETS_SHADOWGENERATOR, this, this._gatherRenderTargets);
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
  }
  /**
   * Serializes the component data to the specified json object
   * @param serializationObject The object to serialize to
   */
  serialize(serializationObject) {
    serializationObject.shadowGenerators = [];
    const lights = this.scene.lights;
    for (const light of lights) {
      if (light.doNotSerialize) {
        continue;
      }
      const shadowGenerators = light.getShadowGenerators();
      if (shadowGenerators) {
        const iterator = shadowGenerators.values();
        for (let key = iterator.next(); key.done !== true; key = iterator.next()) {
          const shadowGenerator = key.value;
          if (shadowGenerator.doNotSerialize) {
            continue;
          }
          serializationObject.shadowGenerators.push(shadowGenerator.serialize());
        }
      }
    }
  }
  /**
   * Adds all the elements from the container to the scene
   * @param container the container holding the elements
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addFromContainer(container) {
  }
  /**
   * Removes all the elements in the container from the scene
   * @param container contains the elements to remove
   * @param dispose if the removed element should be disposed (default: false)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeFromContainer(container, dispose) {
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  dispose() {
  }
  _gatherRenderTargets(renderTargets) {
    const scene = this.scene;
    if (this.scene.shadowsEnabled) {
      for (let lightIndex = 0; lightIndex < scene.lights.length; lightIndex++) {
        const light = scene.lights[lightIndex];
        const shadowGenerators = light.getShadowGenerators();
        if (light.isEnabled() && light.shadowEnabled && shadowGenerators) {
          const iterator = shadowGenerators.values();
          for (let key = iterator.next(); key.done !== true; key = iterator.next()) {
            const shadowGenerator = key.value;
            const shadowMap = shadowGenerator.getShadowMap();
            if (scene.textures.indexOf(shadowMap) !== -1) {
              renderTargets.push(shadowMap);
            }
          }
        }
      }
    }
  }
};
ShadowGenerator._SceneComponentInitialization = (scene) => {
  let component = scene._getComponent(SceneComponentConstants.NAME_SHADOWGENERATOR);
  if (!component) {
    component = new ShadowGeneratorSceneComponent(scene);
    scene._addComponent(component);
  }
};
export {
  ShadowGeneratorSceneComponent
};
//# sourceMappingURL=@babylonjs_core_Lights_Shadows_shadowGeneratorSceneComponent.js.map
