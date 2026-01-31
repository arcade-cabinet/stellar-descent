import {
  BlurPostProcess,
  ThinBlurPostProcess
} from "./chunk-INKIDW57.js";
import {
  PostProcess
} from "./chunk-FTNKZQKS.js";
import {
  EffectWrapper
} from "./chunk-5BCZBFCD.js";
import {
  Engine
} from "./chunk-ZRA7NYDC.js";
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import {
  Tools
} from "./chunk-2GZCEIFN.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import {
  __decorate,
  serialize
} from "./chunk-STIKNZXL.js";
import {
  Vector2
} from "./chunk-YLLTSBLI.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderEffect.js
var PostProcessRenderEffect = class {
  /**
   * Instantiates a post process render effect.
   * A post process can be used to apply a shader to a texture after it is rendered.
   * @param engine The engine the effect is tied to
   * @param name The name of the effect
   * @param getPostProcesses A function that returns a set of post processes which the effect will run in order to be run.
   * @param singleInstance False if this post process can be run on multiple cameras. (default: true)
   */
  constructor(engine, name, getPostProcesses, singleInstance = true) {
    this._name = name;
    this._singleInstance = singleInstance;
    this._getPostProcesses = getPostProcesses;
    this._cameras = {};
    this._indicesForCamera = {};
    this._postProcesses = {};
  }
  /**
   * Checks if all the post processes in the effect are supported.
   */
  get isSupported() {
    for (const index in this._postProcesses) {
      if (Object.prototype.hasOwnProperty.call(this._postProcesses, index)) {
        const pps = this._postProcesses[index];
        for (let ppIndex = 0; ppIndex < pps.length; ppIndex++) {
          if (!pps[ppIndex].isSupported) {
            return false;
          }
        }
      }
    }
    return true;
  }
  /**
   * Updates the current state of the effect
   * @internal
   */
  _update() {
  }
  /**
   * Attaches the effect on cameras
   * @param cameras The camera to attach to.
   * @internal
   */
  _attachCameras(cameras) {
    let cameraKey;
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      if (!camera) {
        continue;
      }
      const cameraName = camera.name;
      if (this._singleInstance) {
        cameraKey = 0;
      } else {
        cameraKey = cameraName;
      }
      if (!this._postProcesses[cameraKey]) {
        const postProcess = this._getPostProcesses();
        if (postProcess) {
          this._postProcesses[cameraKey] = Array.isArray(postProcess) ? postProcess : [postProcess];
        }
      }
      if (!this._indicesForCamera[cameraName]) {
        this._indicesForCamera[cameraName] = [];
      }
      const pps = this._postProcesses[cameraKey];
      for (const postProcess of pps) {
        const index = camera.attachPostProcess(postProcess);
        this._indicesForCamera[cameraName].push(index);
      }
      if (!this._cameras[cameraName]) {
        this._cameras[cameraName] = camera;
      }
    }
  }
  /**
   * Detaches the effect on cameras
   * @param cameras The camera to detach from.
   * @internal
   */
  _detachCameras(cameras) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      const cameraName = camera.name;
      const postProcesses = this._postProcesses[this._singleInstance ? 0 : cameraName];
      if (postProcesses) {
        for (const postProcess of postProcesses) {
          camera.detachPostProcess(postProcess);
        }
      }
      if (this._cameras[cameraName]) {
        this._cameras[cameraName] = null;
      }
      delete this._indicesForCamera[cameraName];
    }
  }
  /**
   * Enables the effect on given cameras
   * @param cameras The camera to enable.
   * @internal
   */
  _enable(cameras) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      const cameraName = camera.name;
      const cameraKey = this._singleInstance ? 0 : cameraName;
      for (let j = 0; j < this._indicesForCamera[cameraName].length; j++) {
        const index = this._indicesForCamera[cameraName][j];
        const postProcess = camera._postProcesses[index];
        if (postProcess === void 0 || postProcess === null) {
          cams[i].attachPostProcess(this._postProcesses[cameraKey][j], index);
        }
      }
    }
  }
  /**
   * Disables the effect on the given cameras
   * @param cameras The camera to disable.
   * @internal
   */
  _disable(cameras) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      const cameraName = camera.name;
      const pps = this._postProcesses[this._singleInstance ? 0 : cameraName];
      for (const postProcess of pps) {
        camera.detachPostProcess(postProcess);
      }
    }
  }
  /**
   * Gets a list of the post processes contained in the effect.
   * @param camera The camera to get the post processes on.
   * @returns The list of the post processes in the effect.
   */
  getPostProcesses(camera) {
    if (this._singleInstance) {
      return this._postProcesses[0];
    } else {
      if (!camera) {
        return null;
      }
      return this._postProcesses[camera.name];
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinCircleOfConfusionPostProcess.js
var ThinCircleOfConfusionPostProcess = class _ThinCircleOfConfusionPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./circleOfConfusion.fragment-ZWYILHEF.js"));
    } else {
      list.push(import("./circleOfConfusion.fragment-AGQKGL5W.js"));
    }
  }
  /**
   * Constructs a new circle of confusion post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || Engine.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: _ThinCircleOfConfusionPostProcess.FragmentUrl,
      uniforms: _ThinCircleOfConfusionPostProcess.Uniforms,
      samplers: _ThinCircleOfConfusionPostProcess.Samplers,
      defines: options?.depthNotNormalized ? _ThinCircleOfConfusionPostProcess.DefinesDepthNotNormalized : void 0
    });
    this.lensSize = 50;
    this.fStop = 1.4;
    this.focusDistance = 2e3;
    this.focalLength = 50;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const options = this.options;
    const effect = this._drawWrapper.effect;
    if (!options.depthNotNormalized) {
      effect.setFloat2("cameraMinMaxZ", this.camera.minZ, this.camera.maxZ - this.camera.minZ);
    }
    const aperture = this.lensSize / this.fStop;
    const cocPrecalculation = aperture * this.focalLength / (this.focusDistance - this.focalLength);
    effect.setFloat("focusDistance", this.focusDistance);
    effect.setFloat("cocPrecalculation", cocPrecalculation);
  }
};
ThinCircleOfConfusionPostProcess.FragmentUrl = "circleOfConfusion";
ThinCircleOfConfusionPostProcess.Uniforms = ["cameraMinMaxZ", "focusDistance", "cocPrecalculation"];
ThinCircleOfConfusionPostProcess.Samplers = ["depthSampler"];
ThinCircleOfConfusionPostProcess.DefinesDepthNotNormalized = "#define COC_DEPTH_NOT_NORMALIZED";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/circleOfConfusionPostProcess.js
var CircleOfConfusionPostProcess = class extends PostProcess {
  /**
   * Max lens size in scene units/1000 (eg. millimeter). Standard cameras are 50mm. (default: 50) The diameter of the resulting aperture can be computed by lensSize/fStop.
   */
  get lensSize() {
    return this._effectWrapper.lensSize;
  }
  set lensSize(value) {
    this._effectWrapper.lensSize = value;
  }
  /**
   * F-Stop of the effect's camera. The diameter of the resulting aperture can be computed by lensSize/fStop. (default: 1.4)
   */
  get fStop() {
    return this._effectWrapper.fStop;
  }
  set fStop(value) {
    this._effectWrapper.fStop = value;
  }
  /**
   * Distance away from the camera to focus on in scene units/1000 (eg. millimeter). (default: 2000)
   */
  get focusDistance() {
    return this._effectWrapper.focusDistance;
  }
  set focusDistance(value) {
    this._effectWrapper.focusDistance = value;
  }
  /**
   * Focal length of the effect's camera in scene units/1000 (eg. millimeter). (default: 50)
   */
  get focalLength() {
    return this._effectWrapper.focalLength;
  }
  set focalLength(value) {
    this._effectWrapper.focalLength = value;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "CircleOfConfusionPostProcess" string
   */
  getClassName() {
    return "CircleOfConfusionPostProcess";
  }
  /**
   * Creates a new instance CircleOfConfusionPostProcess
   * @param name The name of the effect.
   * @param depthTexture The depth texture of the scene to compute the circle of confusion. This must be set in order for this to function but may be set after initialization if needed.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, depthTexture, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      uniforms: ThinCircleOfConfusionPostProcess.Uniforms,
      samplers: ThinCircleOfConfusionPostProcess.Samplers,
      defines: typeof options === "object" && options.depthNotNormalized ? ThinCircleOfConfusionPostProcess.DefinesDepthNotNormalized : void 0,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinCircleOfConfusionPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinCircleOfConfusionPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this._depthTexture = null;
    this._depthTexture = depthTexture;
    this.onApplyObservable.add((effect) => {
      if (!this._depthTexture) {
        Logger.Warn("No depth texture set on CircleOfConfusionPostProcess");
        return;
      }
      effect.setTexture("depthSampler", this._depthTexture);
      this._effectWrapper.camera = this._depthTexture.activeCamera;
    });
  }
  /**
   * Depth texture to be used to compute the circle of confusion. This must be set here or in the constructor in order for the post process to function.
   */
  set depthTexture(value) {
    this._depthTexture = value;
  }
};
__decorate([
  serialize()
], CircleOfConfusionPostProcess.prototype, "lensSize", null);
__decorate([
  serialize()
], CircleOfConfusionPostProcess.prototype, "fStop", null);
__decorate([
  serialize()
], CircleOfConfusionPostProcess.prototype, "focusDistance", null);
__decorate([
  serialize()
], CircleOfConfusionPostProcess.prototype, "focalLength", null);
RegisterClass("BABYLON.CircleOfConfusionPostProcess", CircleOfConfusionPostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinDepthOfFieldBlurPostProcess.js
var ThinDepthOfFieldBlurPostProcess = class extends ThinBlurPostProcess {
  constructor(name, engine = null, direction, kernel, options) {
    super(name, engine, direction, kernel, {
      ...options,
      defines: `#define DOF 1
`
    });
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/depthOfFieldBlurPostProcess.js
var DepthOfFieldBlurPostProcess = class extends BlurPostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "DepthOfFieldBlurPostProcess" string
   */
  getClassName() {
    return "DepthOfFieldBlurPostProcess";
  }
  /**
   * Creates a new instance DepthOfFieldBlurPostProcess
   * @param name The name of the effect.
   * @param _scene The scene the effect belongs to (not used, you can pass null)
   * @param direction The direction the blur should be applied.
   * @param kernel The size of the kernel used to blur.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param circleOfConfusion The circle of confusion + depth map to be used to avoid blurring across edges
   * @param imageToBlur The image to apply the blur to (default: Current rendered frame)
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   * @param textureFormat Format of textures used when performing the post process. (default: TEXTUREFORMAT_RGBA)
   */
  constructor(name, _scene, direction, kernel, options, camera, circleOfConfusion, imageToBlur = null, samplingMode = Texture.BILINEAR_SAMPLINGMODE, engine, reusable, textureType = 0, blockCompilation = false, textureFormat = 5) {
    const localOptions = {
      size: typeof options === "number" ? options : void 0,
      camera,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      samplingMode: samplingMode = 2,
      engine,
      reusable,
      textureType,
      defines: `#define DOF 1
`,
      blockCompilation,
      textureFormat,
      ...options
    };
    super(name, direction, kernel, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinDepthOfFieldBlurPostProcess(name, engine, direction, kernel, localOptions) : void 0,
      ...localOptions
    });
    this.externalTextureSamplerBinding = !!imageToBlur;
    this.onApplyObservable.add((effect) => {
      if (imageToBlur != null) {
        effect.setTextureFromPostProcess("textureSampler", imageToBlur);
      }
      effect.setTextureFromPostProcessOutput("circleOfConfusionSampler", circleOfConfusion);
    });
  }
};
RegisterClass("BABYLON.DepthOfFieldBlurPostProcess", DepthOfFieldBlurPostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinDepthOfFieldMergePostProcess.js
var ThinDepthOfFieldMergePostProcess = class _ThinDepthOfFieldMergePostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./depthOfFieldMerge.fragment-F7RCQPLY.js"));
    } else {
      list.push(import("./depthOfFieldMerge.fragment-OS2S5ZVV.js"));
    }
  }
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || Engine.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: _ThinDepthOfFieldMergePostProcess.FragmentUrl,
      samplers: _ThinDepthOfFieldMergePostProcess.Samplers
    });
  }
};
ThinDepthOfFieldMergePostProcess.FragmentUrl = "depthOfFieldMerge";
ThinDepthOfFieldMergePostProcess.Samplers = ["circleOfConfusionSampler", "blurStep0", "blurStep1", "blurStep2"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/depthOfFieldMergePostProcess.js
var DepthOfFieldMergePostProcess = class extends PostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "DepthOfFieldMergePostProcess" string
   */
  getClassName() {
    return "DepthOfFieldMergePostProcess";
  }
  /**
   * Creates a new instance of DepthOfFieldMergePostProcess
   * @param name The name of the effect.
   * @param originalFromInput Post process which's input will be used for the merge.
   * @param circleOfConfusion Circle of confusion post process which's output will be used to blur each pixel.
   * @param _blurSteps Blur post processes from low to high which will be mixed with the original image.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, originalFromInput, circleOfConfusion, _blurSteps, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const blockCompilationFinal = typeof options === "number" ? blockCompilation : !!options.blockCompilation;
    const localOptions = {
      samplers: ThinDepthOfFieldMergePostProcess.Samplers,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      ...options,
      blockCompilation: true
    };
    super(name, ThinDepthOfFieldMergePostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinDepthOfFieldMergePostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this._blurSteps = _blurSteps;
    this.externalTextureSamplerBinding = true;
    this.onApplyObservable.add((effect) => {
      effect.setTextureFromPostProcess("textureSampler", originalFromInput);
      effect.setTextureFromPostProcessOutput("circleOfConfusionSampler", circleOfConfusion);
      for (let i = 0; i < _blurSteps.length; i++) {
        const step = _blurSteps[i];
        effect.setTextureFromPostProcessOutput("blurStep" + (_blurSteps.length - i - 1), step);
      }
    });
    if (!blockCompilationFinal) {
      this.updateEffect();
    }
  }
  /**
   * Updates the effect with the current post process compile time values and recompiles the shader.
   * @param defines Define statements that should be added at the beginning of the shader. (default: null)
   * @param uniforms Set of uniform variables that will be passed to the shader. (default: null)
   * @param samplers Set of Texture2D variables that will be passed to the shader. (default: null)
   * @param indexParameters The index parameters to be used for babylons include syntax "#include<kernelBlurVaryingDeclaration>[0..varyingCount]". (default: undefined) See usage in babylon.blurPostProcess.ts and kernelBlur.vertex.fx
   * @param onCompiled Called when the shader has been compiled.
   * @param onError Called if there is an error when compiling a shader.
   */
  updateEffect(defines = null, uniforms = null, samplers = null, indexParameters, onCompiled, onError) {
    if (!defines) {
      defines = "";
      defines += "#define BLUR_LEVEL " + (this._blurSteps.length - 1) + "\n";
    }
    super.updateEffect(defines, uniforms, samplers, indexParameters, onCompiled, onError);
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinDepthOfFieldEffect.js
var ThinDepthOfFieldEffectBlurLevel;
(function(ThinDepthOfFieldEffectBlurLevel2) {
  ThinDepthOfFieldEffectBlurLevel2[ThinDepthOfFieldEffectBlurLevel2["Low"] = 0] = "Low";
  ThinDepthOfFieldEffectBlurLevel2[ThinDepthOfFieldEffectBlurLevel2["Medium"] = 1] = "Medium";
  ThinDepthOfFieldEffectBlurLevel2[ThinDepthOfFieldEffectBlurLevel2["High"] = 2] = "High";
})(ThinDepthOfFieldEffectBlurLevel || (ThinDepthOfFieldEffectBlurLevel = {}));
var ThinDepthOfFieldEffect = class {
  /**
   * The focal the length of the camera used in the effect in scene units/1000 (eg. millimeter)
   */
  set focalLength(value) {
    this._circleOfConfusion.focalLength = value;
  }
  get focalLength() {
    return this._circleOfConfusion.focalLength;
  }
  /**
   * F-Stop of the effect's camera. The diameter of the resulting aperture can be computed by lensSize/fStop. (default: 1.4)
   */
  set fStop(value) {
    this._circleOfConfusion.fStop = value;
  }
  get fStop() {
    return this._circleOfConfusion.fStop;
  }
  /**
   * Distance away from the camera to focus on in scene units/1000 (eg. millimeter). (default: 2000)
   */
  set focusDistance(value) {
    this._circleOfConfusion.focusDistance = value;
  }
  get focusDistance() {
    return this._circleOfConfusion.focusDistance;
  }
  /**
   * Max lens size in scene units/1000 (eg. millimeter). Standard cameras are 50mm. (default: 50) The diameter of the resulting aperture can be computed by lensSize/fStop.
   */
  set lensSize(value) {
    this._circleOfConfusion.lensSize = value;
  }
  get lensSize() {
    return this._circleOfConfusion.lensSize;
  }
  /**
   * Creates a new instance of @see ThinDepthOfFieldEffect
   * @param name The name of the depth of field render effect
   * @param engine The engine which the render effect will be applied. (default: current engine)
   * @param blurLevel The quality of the effect. (default: DepthOfFieldEffectBlurLevel.Low)
   * @param depthNotNormalized If the (view) depth used in circle of confusion post-process is normalized (0.0 to 1.0 from near to far) or not (0 to camera max distance) (default: false)
   * @param blockCompilation If shaders should not be compiled when the effect is created (default: false)
   */
  constructor(name, engine, blurLevel = 0, depthNotNormalized = false, blockCompilation = false) {
    this._depthOfFieldBlurX = [];
    this._depthOfFieldBlurY = [];
    this._circleOfConfusion = new ThinCircleOfConfusionPostProcess(name, engine, { depthNotNormalized, blockCompilation });
    this.blurLevel = blurLevel;
    let blurCount = 1;
    let kernelSize = 15;
    switch (blurLevel) {
      case 2: {
        blurCount = 3;
        kernelSize = 51;
        break;
      }
      case 1: {
        blurCount = 2;
        kernelSize = 31;
        break;
      }
      default: {
        kernelSize = 15;
        blurCount = 1;
        break;
      }
    }
    const adjustedKernelSize = kernelSize / Math.pow(2, blurCount - 1);
    let ratio = 1;
    for (let i = 0; i < blurCount; i++) {
      this._depthOfFieldBlurY.push([new ThinDepthOfFieldBlurPostProcess(name, engine, new Vector2(0, 1), adjustedKernelSize, { blockCompilation }), ratio]);
      ratio = 0.75 / Math.pow(2, i);
      this._depthOfFieldBlurX.push([new ThinDepthOfFieldBlurPostProcess(name, engine, new Vector2(1, 0), adjustedKernelSize, { blockCompilation }), ratio]);
    }
    this._dofMerge = new ThinDepthOfFieldMergePostProcess(name, engine, { blockCompilation });
  }
  /**
   * Checks if the effect is ready to be used
   * @returns if the effect is ready
   */
  isReady() {
    let isReady = this._circleOfConfusion.isReady() && this._dofMerge.isReady();
    for (let i = 0; i < this._depthOfFieldBlurX.length; i++) {
      isReady = isReady && this._depthOfFieldBlurX[i][0].isReady() && this._depthOfFieldBlurY[i][0].isReady();
    }
    return isReady;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/depthOfFieldEffect.js
var DepthOfFieldEffectBlurLevel;
(function(DepthOfFieldEffectBlurLevel2) {
  DepthOfFieldEffectBlurLevel2[DepthOfFieldEffectBlurLevel2["Low"] = 0] = "Low";
  DepthOfFieldEffectBlurLevel2[DepthOfFieldEffectBlurLevel2["Medium"] = 1] = "Medium";
  DepthOfFieldEffectBlurLevel2[DepthOfFieldEffectBlurLevel2["High"] = 2] = "High";
})(DepthOfFieldEffectBlurLevel || (DepthOfFieldEffectBlurLevel = {}));
var DepthOfFieldEffect = class extends PostProcessRenderEffect {
  /**
   * The focal the length of the camera used in the effect in scene units/1000 (eg. millimeter)
   */
  set focalLength(value) {
    this._thinDepthOfFieldEffect.focalLength = value;
  }
  get focalLength() {
    return this._thinDepthOfFieldEffect.focalLength;
  }
  /**
   * F-Stop of the effect's camera. The diameter of the resulting aperture can be computed by lensSize/fStop. (default: 1.4)
   */
  set fStop(value) {
    this._thinDepthOfFieldEffect.fStop = value;
  }
  get fStop() {
    return this._thinDepthOfFieldEffect.fStop;
  }
  /**
   * Distance away from the camera to focus on in scene units/1000 (eg. millimeter). (default: 2000)
   */
  set focusDistance(value) {
    this._thinDepthOfFieldEffect.focusDistance = value;
  }
  get focusDistance() {
    return this._thinDepthOfFieldEffect.focusDistance;
  }
  /**
   * Max lens size in scene units/1000 (eg. millimeter). Standard cameras are 50mm. (default: 50) The diameter of the resulting aperture can be computed by lensSize/fStop.
   */
  set lensSize(value) {
    this._thinDepthOfFieldEffect.lensSize = value;
  }
  get lensSize() {
    return this._thinDepthOfFieldEffect.lensSize;
  }
  /**
   * Creates a new instance DepthOfFieldEffect
   * @param sceneOrEngine The scene or engine the effect belongs to.
   * @param depthTexture The depth texture of the scene to compute the circle of confusion.This must be set in order for this to function but may be set after initialization if needed.
   * @param blurLevel
   * @param pipelineTextureType The type of texture to be used when performing the post processing.
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   * @param depthNotNormalized If the depth from the depth texture is already normalized or if the normalization should be done at runtime in the shader (default: false)
   */
  constructor(sceneOrEngine, depthTexture, blurLevel = 0, pipelineTextureType = 0, blockCompilation = false, depthNotNormalized = false) {
    const engine = sceneOrEngine._renderForCamera ? sceneOrEngine.getEngine() : sceneOrEngine;
    super(engine, "depth of field", () => {
      return this._effects;
    }, true);
    this._effects = [];
    this._thinDepthOfFieldEffect = new ThinDepthOfFieldEffect("Depth of Field", engine, blurLevel, false, blockCompilation);
    const circleOfConfusionTextureFormat = engine.isWebGPU || engine.version > 1 ? 6 : 5;
    this._circleOfConfusion = new CircleOfConfusionPostProcess("circleOfConfusion", depthTexture, {
      size: 1,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      depthNotNormalized,
      effectWrapper: this._thinDepthOfFieldEffect._circleOfConfusion
    }, null);
    this._depthOfFieldBlurY = [];
    this._depthOfFieldBlurX = [];
    const blurCount = this._thinDepthOfFieldEffect._depthOfFieldBlurX.length;
    for (let i = 0; i < blurCount; i++) {
      const [thinBlurY, ratioY] = this._thinDepthOfFieldEffect._depthOfFieldBlurY[i];
      const blurY = new DepthOfFieldBlurPostProcess("vertical blur", null, thinBlurY.direction, thinBlurY.kernel, {
        size: ratioY,
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine,
        textureType: pipelineTextureType,
        blockCompilation,
        textureFormat: i == 0 ? circleOfConfusionTextureFormat : 5,
        effectWrapper: thinBlurY
      }, null, this._circleOfConfusion, i == 0 ? this._circleOfConfusion : null);
      blurY.autoClear = false;
      const [thinBlurX, ratioX] = this._thinDepthOfFieldEffect._depthOfFieldBlurX[i];
      const blurX = new DepthOfFieldBlurPostProcess("horizontal blur", null, thinBlurX.direction, thinBlurX.kernel, {
        size: ratioX,
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine,
        textureType: pipelineTextureType,
        blockCompilation,
        effectWrapper: thinBlurX
      }, null, this._circleOfConfusion, null);
      blurX.autoClear = false;
      this._depthOfFieldBlurY.push(blurY);
      this._depthOfFieldBlurX.push(blurX);
    }
    this._effects = [this._circleOfConfusion];
    for (let i = 0; i < this._depthOfFieldBlurX.length; i++) {
      this._effects.push(this._depthOfFieldBlurY[i]);
      this._effects.push(this._depthOfFieldBlurX[i]);
    }
    this._dofMerge = new DepthOfFieldMergePostProcess("dofMerge", this._circleOfConfusion, this._circleOfConfusion, this._depthOfFieldBlurX, {
      size: this._thinDepthOfFieldEffect._depthOfFieldBlurX[blurCount - 1][1],
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinDepthOfFieldEffect._dofMerge
    }, null);
    this._dofMerge.autoClear = false;
    this._effects.push(this._dofMerge);
  }
  /**
   * Get the current class name of the current effect
   * @returns "DepthOfFieldEffect"
   */
  getClassName() {
    return "DepthOfFieldEffect";
  }
  /**
   * Depth texture to be used to compute the circle of confusion. This must be set here or in the constructor in order for the post process to function.
   */
  set depthTexture(value) {
    this._circleOfConfusion.depthTexture = value;
  }
  /**
   * Disposes each of the internal effects for a given camera.
   * @param camera The camera to dispose the effect on.
   */
  disposeEffects(camera) {
    for (let effectIndex = 0; effectIndex < this._effects.length; effectIndex++) {
      this._effects[effectIndex].dispose(camera);
    }
  }
  /**
   * @internal Internal
   */
  _updateEffects() {
    for (let effectIndex = 0; effectIndex < this._effects.length; effectIndex++) {
      this._effects[effectIndex].updateEffect();
    }
  }
  /**
   * Internal
   * @returns if all the contained post processes are ready.
   * @internal
   */
  _isReady() {
    return this._thinDepthOfFieldEffect.isReady();
  }
};

export {
  PostProcessRenderEffect,
  DepthOfFieldEffectBlurLevel,
  DepthOfFieldEffect
};
//# sourceMappingURL=chunk-7TIDCCYE.js.map
