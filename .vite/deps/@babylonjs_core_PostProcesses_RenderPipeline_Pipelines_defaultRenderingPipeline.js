import "./chunk-KA4LK7W3.js";
import {
  DepthOfFieldEffect,
  PostProcessRenderEffect
} from "./chunk-7TIDCCYE.js";
import "./chunk-JXDFBZFX.js";
import {
  GlowLayer
} from "./chunk-5IGP3VKG.js";
import "./chunk-ZUUM5WTP.js";
import "./chunk-5KW3BTBO.js";
import "./chunk-354MVM62.js";
import "./chunk-BH7TPLNH.js";
import "./chunk-SAH7IRBP.js";
import "./chunk-CESSEMZQ.js";
import "./chunk-ZJE4XQK6.js";
import {
  BlurPostProcess,
  ThinBlurPostProcess
} from "./chunk-INKIDW57.js";
import {
  PostProcess
} from "./chunk-FTNKZQKS.js";
import "./chunk-5THHQJAG.js";
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
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import "./chunk-4SFBNKXP.js";
import "./chunk-LY4CWJEX.js";
import "./chunk-W7NAK7I4.js";
import "./chunk-WNGJ3WNO.js";
import "./chunk-BELK345T.js";
import "./chunk-VMWDNJJG.js";
import {
  ImageProcessingConfiguration
} from "./chunk-GGUL3CXV.js";
import {
  UniqueIdGenerator
} from "./chunk-2DA7GQ3K.js";
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
import "./chunk-ZOIT5ZEZ.js";
import "./chunk-XAOF3L4F.js";
import "./chunk-CSVPIDNO.js";
import "./chunk-YVYIHIJT.js";
import {
  Tools
} from "./chunk-2GZCEIFN.js";
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
import {
  SerializationHelper
} from "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize
} from "./chunk-STIKNZXL.js";
import "./chunk-I3IYKWNG.js";
import "./chunk-MMWR3MO4.js";
import {
  Vector2
} from "./chunk-YLLTSBLI.js";
import {
  EngineStore
} from "./chunk-YSTPYZG5.js";
import {
  ToGammaSpace
} from "./chunk-DSUROWQ4.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinSharpenPostProcess.js
var ThinSharpenPostProcess = class _ThinSharpenPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./sharpen.fragment-7JUD74EG.js"));
    } else {
      list.push(import("./sharpen.fragment-CRAFVBE6.js"));
    }
  }
  /**
   * Constructs a new sharpen post process
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
      fragmentShader: _ThinSharpenPostProcess.FragmentUrl,
      uniforms: _ThinSharpenPostProcess.Uniforms
    });
    this.colorAmount = 1;
    this.edgeAmount = 0.3;
    this.textureWidth = 0;
    this.textureHeight = 0;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    effect.setFloat2("screenSize", this.textureWidth, this.textureHeight);
    effect.setFloat2("sharpnessAmounts", this.edgeAmount, this.colorAmount);
  }
};
ThinSharpenPostProcess.FragmentUrl = "sharpen";
ThinSharpenPostProcess.Uniforms = ["sharpnessAmounts", "screenSize"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/sharpenPostProcess.js
var SharpenPostProcess = class _SharpenPostProcess extends PostProcess {
  /**
   * How much of the original color should be applied. Setting this to 0 will display edge detection. (default: 1)
   */
  get colorAmount() {
    return this._effectWrapper.colorAmount;
  }
  set colorAmount(value) {
    this._effectWrapper.colorAmount = value;
  }
  /**
   * How much sharpness should be applied (default: 0.3)
   */
  get edgeAmount() {
    return this._effectWrapper.edgeAmount;
  }
  set edgeAmount(value) {
    this._effectWrapper.edgeAmount = value;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "SharpenPostProcess" string
   */
  getClassName() {
    return "SharpenPostProcess";
  }
  /**
   * Creates a new instance ConvolutionPostProcess
   * @param name The name of the effect.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      uniforms: ThinSharpenPostProcess.Uniforms,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinSharpenPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinSharpenPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this.onApply = (_effect) => {
      this._effectWrapper.textureWidth = this.width;
      this._effectWrapper.textureHeight = this.height;
    };
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new _SharpenPostProcess(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.textureType, parsedPostProcess.reusable);
    }, parsedPostProcess, scene, rootUrl);
  }
};
__decorate([
  serialize()
], SharpenPostProcess.prototype, "colorAmount", null);
__decorate([
  serialize()
], SharpenPostProcess.prototype, "edgeAmount", null);
RegisterClass("BABYLON.SharpenPostProcess", SharpenPostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinImageProcessingPostProcess.js
var ThinImageProcessingPostProcess = class _ThinImageProcessingPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./imageProcessing.fragment-Q7YCZEFY.js"));
    } else {
      list.push(import("./imageProcessing.fragment-MJM7A4RW.js"));
    }
  }
  /**
   * Gets the image processing configuration used either in this material.
   */
  get imageProcessingConfiguration() {
    return this._imageProcessingConfiguration;
  }
  /**
   * Sets the Default image processing configuration used either in the this material.
   *
   * If sets to null, the scene one is in use.
   */
  set imageProcessingConfiguration(value) {
    value.applyByPostProcess = true;
    this._attachImageProcessingConfiguration(value);
  }
  /**
   * Attaches a new image processing configuration to the PBR Material.
   * @param configuration
   * @param doNotBuild
   */
  _attachImageProcessingConfiguration(configuration, doNotBuild = false) {
    if (configuration === this._imageProcessingConfiguration) {
      return;
    }
    if (this._imageProcessingConfiguration && this._imageProcessingObserver) {
      this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
    }
    if (!configuration) {
      let scene = this.options.scene;
      if (!scene) {
        const engine = this.options.engine;
        if (engine && engine.scenes) {
          const scenes = engine.scenes;
          scene = scenes[scenes.length - 1];
        } else {
          scene = EngineStore.LastCreatedScene;
        }
      }
      if (scene) {
        this._imageProcessingConfiguration = scene.imageProcessingConfiguration;
      } else {
        this._imageProcessingConfiguration = new ImageProcessingConfiguration();
      }
    } else {
      this._imageProcessingConfiguration = configuration;
    }
    if (this._imageProcessingConfiguration) {
      this._imageProcessingObserver = this._imageProcessingConfiguration.onUpdateParameters.add(() => {
        this._updateParameters();
      });
    }
    if (!doNotBuild) {
      this._updateParameters();
    }
  }
  /**
   * Gets Color curves setup used in the effect if colorCurvesEnabled is set to true .
   */
  get colorCurves() {
    return this.imageProcessingConfiguration.colorCurves;
  }
  /**
   * Sets Color curves setup used in the effect if colorCurvesEnabled is set to true .
   */
  set colorCurves(value) {
    this.imageProcessingConfiguration.colorCurves = value;
  }
  /**
   * Gets whether the color curves effect is enabled.
   */
  get colorCurvesEnabled() {
    return this.imageProcessingConfiguration.colorCurvesEnabled;
  }
  /**
   * Sets whether the color curves effect is enabled.
   */
  set colorCurvesEnabled(value) {
    this.imageProcessingConfiguration.colorCurvesEnabled = value;
  }
  /**
   * Gets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
   */
  get colorGradingTexture() {
    return this.imageProcessingConfiguration.colorGradingTexture;
  }
  /**
   * Sets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
   */
  set colorGradingTexture(value) {
    this.imageProcessingConfiguration.colorGradingTexture = value;
  }
  /**
   * Gets whether the color grading effect is enabled.
   */
  get colorGradingEnabled() {
    return this.imageProcessingConfiguration.colorGradingEnabled;
  }
  /**
   * Gets whether the color grading effect is enabled.
   */
  set colorGradingEnabled(value) {
    this.imageProcessingConfiguration.colorGradingEnabled = value;
  }
  /**
   * Gets exposure used in the effect.
   */
  get exposure() {
    return this.imageProcessingConfiguration.exposure;
  }
  /**
   * Sets exposure used in the effect.
   */
  set exposure(value) {
    this.imageProcessingConfiguration.exposure = value;
  }
  /**
   * Gets whether tonemapping is enabled or not.
   */
  get toneMappingEnabled() {
    return this._imageProcessingConfiguration.toneMappingEnabled;
  }
  /**
   * Sets whether tonemapping is enabled or not
   */
  set toneMappingEnabled(value) {
    this._imageProcessingConfiguration.toneMappingEnabled = value;
  }
  /**
   * Gets the type of tone mapping effect.
   */
  get toneMappingType() {
    return this._imageProcessingConfiguration.toneMappingType;
  }
  /**
   * Sets the type of tone mapping effect.
   */
  set toneMappingType(value) {
    this._imageProcessingConfiguration.toneMappingType = value;
  }
  /**
   * Gets contrast used in the effect.
   */
  get contrast() {
    return this.imageProcessingConfiguration.contrast;
  }
  /**
   * Sets contrast used in the effect.
   */
  set contrast(value) {
    this.imageProcessingConfiguration.contrast = value;
  }
  /**
   * Gets Vignette stretch size.
   */
  get vignetteStretch() {
    return this.imageProcessingConfiguration.vignetteStretch;
  }
  /**
   * Sets Vignette stretch size.
   */
  set vignetteStretch(value) {
    this.imageProcessingConfiguration.vignetteStretch = value;
  }
  /**
   * Gets Vignette center X Offset.
   * @deprecated use vignetteCenterX instead
   */
  get vignetteCentreX() {
    return this.imageProcessingConfiguration.vignetteCenterX;
  }
  /**
   * Sets Vignette center X Offset.
   * @deprecated use vignetteCenterX instead
   */
  set vignetteCentreX(value) {
    this.imageProcessingConfiguration.vignetteCenterX = value;
  }
  /**
   * Gets Vignette center Y Offset.
   * @deprecated use vignetteCenterY instead
   */
  get vignetteCentreY() {
    return this.imageProcessingConfiguration.vignetteCenterY;
  }
  /**
   * Sets Vignette center Y Offset.
   * @deprecated use vignetteCenterY instead
   */
  set vignetteCentreY(value) {
    this.imageProcessingConfiguration.vignetteCenterY = value;
  }
  /**
   * Vignette center Y Offset.
   */
  get vignetteCenterY() {
    return this.imageProcessingConfiguration.vignetteCenterY;
  }
  set vignetteCenterY(value) {
    this.imageProcessingConfiguration.vignetteCenterY = value;
  }
  /**
   * Vignette center X Offset.
   */
  get vignetteCenterX() {
    return this.imageProcessingConfiguration.vignetteCenterX;
  }
  set vignetteCenterX(value) {
    this.imageProcessingConfiguration.vignetteCenterX = value;
  }
  /**
   * Gets Vignette weight or intensity of the vignette effect.
   */
  get vignetteWeight() {
    return this.imageProcessingConfiguration.vignetteWeight;
  }
  /**
   * Sets Vignette weight or intensity of the vignette effect.
   */
  set vignetteWeight(value) {
    this.imageProcessingConfiguration.vignetteWeight = value;
  }
  /**
   * Gets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
   * if vignetteEnabled is set to true.
   */
  get vignetteColor() {
    return this.imageProcessingConfiguration.vignetteColor;
  }
  /**
   * Sets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
   * if vignetteEnabled is set to true.
   */
  set vignetteColor(value) {
    this.imageProcessingConfiguration.vignetteColor = value;
  }
  /**
   * Gets Camera field of view used by the Vignette effect.
   */
  get vignetteCameraFov() {
    return this.imageProcessingConfiguration.vignetteCameraFov;
  }
  /**
   * Sets Camera field of view used by the Vignette effect.
   */
  set vignetteCameraFov(value) {
    this.imageProcessingConfiguration.vignetteCameraFov = value;
  }
  /**
   * Gets the vignette blend mode allowing different kind of effect.
   */
  get vignetteBlendMode() {
    return this.imageProcessingConfiguration.vignetteBlendMode;
  }
  /**
   * Sets the vignette blend mode allowing different kind of effect.
   */
  set vignetteBlendMode(value) {
    this.imageProcessingConfiguration.vignetteBlendMode = value;
  }
  /**
   * Gets whether the vignette effect is enabled.
   */
  get vignetteEnabled() {
    return this.imageProcessingConfiguration.vignetteEnabled;
  }
  /**
   * Sets whether the vignette effect is enabled.
   */
  set vignetteEnabled(value) {
    this.imageProcessingConfiguration.vignetteEnabled = value;
  }
  /**
   * Gets intensity of the dithering effect.
   */
  get ditheringIntensity() {
    return this.imageProcessingConfiguration.ditheringIntensity;
  }
  /**
   * Sets intensity of the dithering effect.
   */
  set ditheringIntensity(value) {
    this.imageProcessingConfiguration.ditheringIntensity = value;
  }
  /**
   * Gets whether the dithering effect is enabled.
   */
  get ditheringEnabled() {
    return this.imageProcessingConfiguration.ditheringEnabled;
  }
  /**
   * Sets whether the dithering effect is enabled.
   */
  set ditheringEnabled(value) {
    this.imageProcessingConfiguration.ditheringEnabled = value;
  }
  /**
   * Gets whether the input of the processing is in Gamma or Linear Space.
   */
  get fromLinearSpace() {
    return this._fromLinearSpace;
  }
  /**
   * Sets whether the input of the processing is in Gamma or Linear Space.
   */
  set fromLinearSpace(value) {
    if (this._fromLinearSpace === value) {
      return;
    }
    this._fromLinearSpace = value;
    this._updateParameters();
  }
  /**
   * * Gets the width of the output texture used to store the result of the post process.
   */
  get outputTextureWidth() {
    return this.imageProcessingConfiguration.outputTextureWidth;
  }
  /**
   * * Sets the width of the output texture used to store the result of the post process.
   */
  set outputTextureWidth(value) {
    this.imageProcessingConfiguration.outputTextureWidth = value;
  }
  /**
   * * Gets the height of the output texture used to store the result of the post process.
   */
  get outputTextureHeight() {
    return this.imageProcessingConfiguration.outputTextureHeight;
  }
  /**
   * * Sets the height of the output texture used to store the result of the post process.
   */
  set outputTextureHeight(value) {
    this.imageProcessingConfiguration.outputTextureHeight = value;
  }
  /**
   * Constructs a new image processing post process
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
      fragmentShader: _ThinImageProcessingPostProcess.FragmentUrl
    });
    this._fromLinearSpace = true;
    this._defines = {
      IMAGEPROCESSING: false,
      VIGNETTE: false,
      VIGNETTEBLENDMODEMULTIPLY: false,
      VIGNETTEBLENDMODEOPAQUE: false,
      TONEMAPPING: 0,
      CONTRAST: false,
      COLORCURVES: false,
      COLORGRADING: false,
      COLORGRADING3D: false,
      FROMLINEARSPACE: false,
      SAMPLER3DGREENDEPTH: false,
      SAMPLER3DBGRMAP: false,
      DITHER: false,
      IMAGEPROCESSINGPOSTPROCESS: false,
      EXPOSURE: false,
      SKIPFINALCOLORCLAMP: false
    };
    const imageProcessingConfiguration = options?.imageProcessingConfiguration;
    if (imageProcessingConfiguration) {
      imageProcessingConfiguration.applyByPostProcess = true;
      this._attachImageProcessingConfiguration(imageProcessingConfiguration, true);
      this._updateParameters();
    } else {
      this._attachImageProcessingConfiguration(null, true);
      this.imageProcessingConfiguration.applyByPostProcess = true;
    }
  }
  /**
   * @internal
   */
  _updateParameters() {
    this._defines.FROMLINEARSPACE = this._fromLinearSpace;
    this.imageProcessingConfiguration.prepareDefines(this._defines, true);
    let defines = "";
    for (const prop in this._defines) {
      const value = this._defines[prop];
      const type = typeof value;
      switch (type) {
        case "number":
        case "string":
          defines += `#define ${prop} ${value};
`;
          break;
        default:
          if (value) {
            defines += `#define ${prop};
`;
          }
          break;
      }
    }
    const samplers = ["textureSampler"];
    const uniforms = ["scale"];
    if (ImageProcessingConfiguration) {
      ImageProcessingConfiguration.PrepareSamplers(samplers, this._defines);
      ImageProcessingConfiguration.PrepareUniforms(uniforms, this._defines);
    }
    this.updateEffect(defines, uniforms, samplers);
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this.imageProcessingConfiguration.bind(this.effect, this.overrideAspectRatio);
  }
  dispose() {
    super.dispose();
    if (this._imageProcessingConfiguration && this._imageProcessingObserver) {
      this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
    }
    if (this._imageProcessingConfiguration) {
      this.imageProcessingConfiguration.applyByPostProcess = false;
    }
  }
};
ThinImageProcessingPostProcess.FragmentUrl = "imageProcessing";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/imageProcessingPostProcess.js
var ImageProcessingPostProcess = class extends PostProcess {
  get _imageProcessingConfiguration() {
    return this._effectWrapper.imageProcessingConfiguration;
  }
  /**
   * Gets the image processing configuration used either in this material.
   */
  get imageProcessingConfiguration() {
    return this._effectWrapper.imageProcessingConfiguration;
  }
  /**
   * Sets the Default image processing configuration used either in the this material.
   *
   * If sets to null, the scene one is in use.
   */
  set imageProcessingConfiguration(value) {
    this._effectWrapper.imageProcessingConfiguration = value;
  }
  /**
   * If the post process is supported.
   */
  get isSupported() {
    const effect = this.getEffect();
    return !effect || effect.isSupported;
  }
  /**
   * Gets Color curves setup used in the effect if colorCurvesEnabled is set to true .
   */
  get colorCurves() {
    return this.imageProcessingConfiguration.colorCurves;
  }
  /**
   * Sets Color curves setup used in the effect if colorCurvesEnabled is set to true .
   */
  set colorCurves(value) {
    this.imageProcessingConfiguration.colorCurves = value;
  }
  /**
   * Gets whether the color curves effect is enabled.
   */
  get colorCurvesEnabled() {
    return this.imageProcessingConfiguration.colorCurvesEnabled;
  }
  /**
   * Sets whether the color curves effect is enabled.
   */
  set colorCurvesEnabled(value) {
    this.imageProcessingConfiguration.colorCurvesEnabled = value;
  }
  /**
   * Gets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
   */
  get colorGradingTexture() {
    return this.imageProcessingConfiguration.colorGradingTexture;
  }
  /**
   * Sets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
   */
  set colorGradingTexture(value) {
    this.imageProcessingConfiguration.colorGradingTexture = value;
  }
  /**
   * Gets whether the color grading effect is enabled.
   */
  get colorGradingEnabled() {
    return this.imageProcessingConfiguration.colorGradingEnabled;
  }
  /**
   * Gets whether the color grading effect is enabled.
   */
  set colorGradingEnabled(value) {
    this.imageProcessingConfiguration.colorGradingEnabled = value;
  }
  /**
   * Gets exposure used in the effect.
   */
  get exposure() {
    return this.imageProcessingConfiguration.exposure;
  }
  /**
   * Sets exposure used in the effect.
   */
  set exposure(value) {
    this.imageProcessingConfiguration.exposure = value;
  }
  /**
   * Gets whether tonemapping is enabled or not.
   */
  get toneMappingEnabled() {
    return this._imageProcessingConfiguration.toneMappingEnabled;
  }
  /**
   * Sets whether tonemapping is enabled or not
   */
  set toneMappingEnabled(value) {
    this._imageProcessingConfiguration.toneMappingEnabled = value;
  }
  /**
   * Gets the type of tone mapping effect.
   */
  get toneMappingType() {
    return this._imageProcessingConfiguration.toneMappingType;
  }
  /**
   * Sets the type of tone mapping effect.
   */
  set toneMappingType(value) {
    this._imageProcessingConfiguration.toneMappingType = value;
  }
  /**
   * Gets contrast used in the effect.
   */
  get contrast() {
    return this.imageProcessingConfiguration.contrast;
  }
  /**
   * Sets contrast used in the effect.
   */
  set contrast(value) {
    this.imageProcessingConfiguration.contrast = value;
  }
  /**
   * Gets Vignette stretch size.
   */
  get vignetteStretch() {
    return this.imageProcessingConfiguration.vignetteStretch;
  }
  /**
   * Sets Vignette stretch size.
   */
  set vignetteStretch(value) {
    this.imageProcessingConfiguration.vignetteStretch = value;
  }
  /**
   * Gets Vignette center X Offset.
   * @deprecated use vignetteCenterX instead
   */
  get vignetteCentreX() {
    return this.imageProcessingConfiguration.vignetteCenterX;
  }
  /**
   * Sets Vignette center X Offset.
   * @deprecated use vignetteCenterX instead
   */
  set vignetteCentreX(value) {
    this.imageProcessingConfiguration.vignetteCenterX = value;
  }
  /**
   * Gets Vignette center Y Offset.
   * @deprecated use vignetteCenterY instead
   */
  get vignetteCentreY() {
    return this.imageProcessingConfiguration.vignetteCenterY;
  }
  /**
   * Sets Vignette center Y Offset.
   * @deprecated use vignetteCenterY instead
   */
  set vignetteCentreY(value) {
    this.imageProcessingConfiguration.vignetteCenterY = value;
  }
  /**
   * Vignette center Y Offset.
   */
  get vignetteCenterY() {
    return this.imageProcessingConfiguration.vignetteCenterY;
  }
  set vignetteCenterY(value) {
    this.imageProcessingConfiguration.vignetteCenterY = value;
  }
  /**
   * Vignette center X Offset.
   */
  get vignetteCenterX() {
    return this.imageProcessingConfiguration.vignetteCenterX;
  }
  set vignetteCenterX(value) {
    this.imageProcessingConfiguration.vignetteCenterX = value;
  }
  /**
   * Gets Vignette weight or intensity of the vignette effect.
   */
  get vignetteWeight() {
    return this.imageProcessingConfiguration.vignetteWeight;
  }
  /**
   * Sets Vignette weight or intensity of the vignette effect.
   */
  set vignetteWeight(value) {
    this.imageProcessingConfiguration.vignetteWeight = value;
  }
  /**
   * Gets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
   * if vignetteEnabled is set to true.
   */
  get vignetteColor() {
    return this.imageProcessingConfiguration.vignetteColor;
  }
  /**
   * Sets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
   * if vignetteEnabled is set to true.
   */
  set vignetteColor(value) {
    this.imageProcessingConfiguration.vignetteColor = value;
  }
  /**
   * Gets Camera field of view used by the Vignette effect.
   */
  get vignetteCameraFov() {
    return this.imageProcessingConfiguration.vignetteCameraFov;
  }
  /**
   * Sets Camera field of view used by the Vignette effect.
   */
  set vignetteCameraFov(value) {
    this.imageProcessingConfiguration.vignetteCameraFov = value;
  }
  /**
   * Gets the vignette blend mode allowing different kind of effect.
   */
  get vignetteBlendMode() {
    return this.imageProcessingConfiguration.vignetteBlendMode;
  }
  /**
   * Sets the vignette blend mode allowing different kind of effect.
   */
  set vignetteBlendMode(value) {
    this.imageProcessingConfiguration.vignetteBlendMode = value;
  }
  /**
   * Gets whether the vignette effect is enabled.
   */
  get vignetteEnabled() {
    return this.imageProcessingConfiguration.vignetteEnabled;
  }
  /**
   * Sets whether the vignette effect is enabled.
   */
  set vignetteEnabled(value) {
    this.imageProcessingConfiguration.vignetteEnabled = value;
  }
  /**
   * Gets intensity of the dithering effect.
   */
  get ditheringIntensity() {
    return this.imageProcessingConfiguration.ditheringIntensity;
  }
  /**
   * Sets intensity of the dithering effect.
   */
  set ditheringIntensity(value) {
    this.imageProcessingConfiguration.ditheringIntensity = value;
  }
  /**
   * Gets whether the dithering effect is enabled.
   */
  get ditheringEnabled() {
    return this.imageProcessingConfiguration.ditheringEnabled;
  }
  /**
   * Sets whether the dithering effect is enabled.
   */
  set ditheringEnabled(value) {
    this.imageProcessingConfiguration.ditheringEnabled = value;
  }
  /**
   * Gets whether the input of the processing is in Gamma or Linear Space.
   */
  get fromLinearSpace() {
    return this._effectWrapper.fromLinearSpace;
  }
  /**
   * Sets whether the input of the processing is in Gamma or Linear Space.
   */
  set fromLinearSpace(value) {
    this._effectWrapper.fromLinearSpace = value;
  }
  constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, imageProcessingConfiguration) {
    const localOptions = {
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      imageProcessingConfiguration,
      scene: camera?.getScene(),
      ...options,
      blockCompilation: true
    };
    super(name, ThinImageProcessingPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinImageProcessingPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this.onApply = () => {
      this._effectWrapper.overrideAspectRatio = this.aspectRatio;
    };
  }
  /**
   *  "ImageProcessingPostProcess"
   * @returns "ImageProcessingPostProcess"
   */
  getClassName() {
    return "ImageProcessingPostProcess";
  }
  /**
   * @internal
   */
  _updateParameters() {
    this._effectWrapper._updateParameters();
  }
  dispose(camera) {
    super.dispose(camera);
    if (this._imageProcessingConfiguration) {
      this.imageProcessingConfiguration.applyByPostProcess = false;
    }
  }
};
__decorate([
  serialize()
], ImageProcessingPostProcess.prototype, "fromLinearSpace", null);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinChromaticAberrationPostProcess.js
var ThinChromaticAberrationPostProcess = class _ThinChromaticAberrationPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./chromaticAberration.fragment-2FVHKDBN.js"));
    } else {
      list.push(import("./chromaticAberration.fragment-VQU7KJ5H.js"));
    }
  }
  /**
   * Constructs a new chromatic aberration post process
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
      fragmentShader: _ThinChromaticAberrationPostProcess.FragmentUrl,
      uniforms: _ThinChromaticAberrationPostProcess.Uniforms
    });
    this.aberrationAmount = 30;
    this.radialIntensity = 0;
    this.direction = new Vector2(0.707, 0.707);
    this.centerPosition = new Vector2(0.5, 0.5);
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    effect.setFloat("chromatic_aberration", this.aberrationAmount);
    effect.setFloat("screen_width", this.screenWidth);
    effect.setFloat("screen_height", this.screenHeight);
    effect.setFloat("radialIntensity", this.radialIntensity);
    effect.setFloat2("direction", this.direction.x, this.direction.y);
    effect.setFloat2("centerPosition", this.centerPosition.x, this.centerPosition.y);
  }
};
ThinChromaticAberrationPostProcess.FragmentUrl = "chromaticAberration";
ThinChromaticAberrationPostProcess.Uniforms = ["chromatic_aberration", "screen_width", "screen_height", "direction", "radialIntensity", "centerPosition"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/chromaticAberrationPostProcess.js
var ChromaticAberrationPostProcess = class _ChromaticAberrationPostProcess extends PostProcess {
  /**
   * The amount of separation of rgb channels (default: 30)
   */
  get aberrationAmount() {
    return this._effectWrapper.aberrationAmount;
  }
  set aberrationAmount(value) {
    this._effectWrapper.aberrationAmount = value;
  }
  /**
   * The amount the effect will increase for pixels closer to the edge of the screen. (default: 0)
   */
  get radialIntensity() {
    return this._effectWrapper.radialIntensity;
  }
  set radialIntensity(value) {
    this._effectWrapper.radialIntensity = value;
  }
  /**
   * The normalized direction in which the rgb channels should be separated. If set to 0,0 radial direction will be used. (default: Vector2(0.707,0.707))
   */
  get direction() {
    return this._effectWrapper.direction;
  }
  set direction(value) {
    this._effectWrapper.direction = value;
  }
  /**
   * The center position where the radialIntensity should be around. [0.5,0.5 is center of screen, 1,1 is top right corner] (default: Vector2(0.5 ,0.5))
   */
  get centerPosition() {
    return this._effectWrapper.centerPosition;
  }
  set centerPosition(value) {
    this._effectWrapper.centerPosition = value;
  }
  /** The width of the screen to apply the effect on */
  get screenWidth() {
    return this._effectWrapper.screenWidth;
  }
  set screenWidth(value) {
    this._effectWrapper.screenWidth = value;
  }
  /** The height of the screen to apply the effect on */
  get screenHeight() {
    return this._effectWrapper.screenHeight;
  }
  set screenHeight(value) {
    this._effectWrapper.screenHeight = value;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "ChromaticAberrationPostProcess" string
   */
  getClassName() {
    return "ChromaticAberrationPostProcess";
  }
  /**
   * Creates a new instance ChromaticAberrationPostProcess
   * @param name The name of the effect.
   * @param screenWidth The width of the screen to apply the effect on.
   * @param screenHeight The height of the screen to apply the effect on.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, screenWidth, screenHeight, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      uniforms: ThinChromaticAberrationPostProcess.Uniforms,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinChromaticAberrationPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinChromaticAberrationPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new _ChromaticAberrationPostProcess(parsedPostProcess.name, parsedPostProcess.screenWidth, parsedPostProcess.screenHeight, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable, parsedPostProcess.textureType, false);
    }, parsedPostProcess, scene, rootUrl);
  }
};
__decorate([
  serialize()
], ChromaticAberrationPostProcess.prototype, "aberrationAmount", null);
__decorate([
  serialize()
], ChromaticAberrationPostProcess.prototype, "radialIntensity", null);
__decorate([
  serialize()
], ChromaticAberrationPostProcess.prototype, "direction", null);
__decorate([
  serialize()
], ChromaticAberrationPostProcess.prototype, "centerPosition", null);
__decorate([
  serialize()
], ChromaticAberrationPostProcess.prototype, "screenWidth", null);
__decorate([
  serialize()
], ChromaticAberrationPostProcess.prototype, "screenHeight", null);
RegisterClass("BABYLON.ChromaticAberrationPostProcess", ChromaticAberrationPostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinGrainPostProcess.js
var ThinGrainPostProcess = class _ThinGrainPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./grain.fragment-RVAPO2OS.js"));
    } else {
      list.push(import("./grain.fragment-5ENSXF3E.js"));
    }
  }
  /**
   * Constructs a new grain post process
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
      fragmentShader: _ThinGrainPostProcess.FragmentUrl,
      uniforms: _ThinGrainPostProcess.Uniforms
    });
    this.intensity = 30;
    this.animated = false;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat("intensity", this.intensity);
    this._drawWrapper.effect.setFloat("animatedSeed", this.animated ? Math.random() + 1 : 1);
  }
};
ThinGrainPostProcess.FragmentUrl = "grain";
ThinGrainPostProcess.Uniforms = ["intensity", "animatedSeed"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/grainPostProcess.js
var GrainPostProcess = class _GrainPostProcess extends PostProcess {
  /**
   * The intensity of the grain added (default: 30)
   */
  get intensity() {
    return this._effectWrapper.intensity;
  }
  set intensity(value) {
    this._effectWrapper.intensity = value;
  }
  /**
   * If the grain should be randomized on every frame
   */
  get animated() {
    return this._effectWrapper.animated;
  }
  set animated(value) {
    this._effectWrapper.animated = value;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "GrainPostProcess" string
   */
  getClassName() {
    return "GrainPostProcess";
  }
  /**
   * Creates a new instance of @see GrainPostProcess
   * @param name The name of the effect.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      uniforms: ThinGrainPostProcess.Uniforms,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinGrainPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinGrainPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new _GrainPostProcess(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable);
    }, parsedPostProcess, scene, rootUrl);
  }
};
__decorate([
  serialize()
], GrainPostProcess.prototype, "intensity", null);
__decorate([
  serialize()
], GrainPostProcess.prototype, "animated", null);
RegisterClass("BABYLON.GrainPostProcess", GrainPostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinFXAAPostProcess.js
var ThinFXAAPostProcess = class _ThinFXAAPostProcess extends EffectWrapper {
  static _GetDefines(engine) {
    if (!engine) {
      return null;
    }
    const driverInfo = engine.extractDriverInfo();
    if (driverInfo.toLowerCase().indexOf("mali") > -1) {
      return "#define MALI 1\n";
    }
    return null;
  }
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([import("./fxaa.fragment-XYG5NNDO.js"), import("./fxaa.vertex-GSZMKPNK.js")]));
    } else {
      list.push(Promise.all([import("./fxaa.fragment-SAHKC66T.js"), import("./fxaa.vertex-YJABCJ5A.js")]));
    }
  }
  /**
   * Constructs a new FXAA post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    const localOptions = {
      ...options,
      name,
      engine: engine || Engine.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      vertexShader: _ThinFXAAPostProcess.VertexUrl,
      fragmentShader: _ThinFXAAPostProcess.FragmentUrl,
      uniforms: _ThinFXAAPostProcess.Uniforms
    };
    super({
      ...localOptions,
      defines: _ThinFXAAPostProcess._GetDefines(localOptions.engine)
    });
    this.texelSize = new Vector2(0, 0);
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat2("texelSize", this.texelSize.x, this.texelSize.y);
  }
};
ThinFXAAPostProcess.VertexUrl = "fxaa";
ThinFXAAPostProcess.FragmentUrl = "fxaa";
ThinFXAAPostProcess.Uniforms = ["texelSize"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/fxaaPostProcess.js
var FxaaPostProcess = class _FxaaPostProcess extends PostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "FxaaPostProcess" string
   */
  getClassName() {
    return "FxaaPostProcess";
  }
  constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0) {
    const localOptions = {
      uniforms: ThinFXAAPostProcess.Uniforms,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode: samplingMode || Texture.BILINEAR_SAMPLINGMODE,
      engine,
      reusable,
      textureType,
      ...options
    };
    super(name, ThinFXAAPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinFXAAPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this.onApplyObservable.add((_effect) => {
      this._effectWrapper.texelSize = this.texelSize;
    });
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new _FxaaPostProcess(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable);
    }, parsedPostProcess, scene, rootUrl);
  }
};
RegisterClass("BABYLON.FxaaPostProcess", FxaaPostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipeline.js
var PostProcessRenderPipeline = class {
  /**
   * Gets pipeline name
   */
  get name() {
    return this._name;
  }
  /** Gets the list of attached cameras */
  get cameras() {
    return this._cameras;
  }
  /**
   * Gets the active engine
   */
  get engine() {
    return this._engine;
  }
  /**
   * Initializes a PostProcessRenderPipeline
   * @param _engine engine to add the pipeline to
   * @param name name of the pipeline
   */
  constructor(_engine, name) {
    this._engine = _engine;
    this.uniqueId = UniqueIdGenerator.UniqueId;
    this._name = name;
    this._renderEffects = {};
    this._renderEffectsForIsolatedPass = new Array();
    this._cameras = [];
  }
  /**
   * Gets the class name
   * @returns "PostProcessRenderPipeline"
   */
  getClassName() {
    return "PostProcessRenderPipeline";
  }
  /**
   * If all the render effects in the pipeline are supported
   */
  get isSupported() {
    for (const renderEffectName in this._renderEffects) {
      if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
        if (!this._renderEffects[renderEffectName].isSupported) {
          return false;
        }
      }
    }
    return true;
  }
  /**
   * Adds an effect to the pipeline
   * @param renderEffect the effect to add
   */
  addEffect(renderEffect) {
    this._renderEffects[renderEffect._name] = renderEffect;
  }
  // private
  /** @internal */
  _rebuild() {
  }
  /**
   * @internal
   */
  _enableEffect(renderEffectName, cameras) {
    const renderEffects = this._renderEffects[renderEffectName];
    if (!renderEffects) {
      return;
    }
    renderEffects._enable(Tools.MakeArray(cameras || this._cameras));
  }
  /**
   * @internal
   */
  _disableEffect(renderEffectName, cameras) {
    const renderEffects = this._renderEffects[renderEffectName];
    if (!renderEffects) {
      return;
    }
    renderEffects._disable(Tools.MakeArray(cameras || this._cameras));
  }
  /**
   * @internal
   */
  _attachCameras(cameras, unique) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    const indicesToDelete = [];
    let i;
    for (i = 0; i < cams.length; i++) {
      const camera = cams[i];
      if (!camera) {
        continue;
      }
      if (this._cameras.indexOf(camera) === -1) {
        this._cameras.push(camera);
      } else if (unique) {
        indicesToDelete.push(i);
      }
    }
    for (i = 0; i < indicesToDelete.length; i++) {
      cams.splice(indicesToDelete[i], 1);
    }
    for (const renderEffectName in this._renderEffects) {
      if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
        this._renderEffects[renderEffectName]._attachCameras(cams);
      }
    }
  }
  /**
   * @internal
   */
  _detachCameras(cameras) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (const renderEffectName in this._renderEffects) {
      if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
        this._renderEffects[renderEffectName]._detachCameras(cams);
      }
    }
    for (let i = 0; i < cams.length; i++) {
      this._cameras.splice(this._cameras.indexOf(cams[i]), 1);
    }
  }
  /** @internal */
  _update() {
    for (const renderEffectName in this._renderEffects) {
      if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
        this._renderEffects[renderEffectName]._update();
      }
    }
    for (let i = 0; i < this._cameras.length; i++) {
      if (!this._cameras[i]) {
        continue;
      }
      const cameraName = this._cameras[i].name;
      if (this._renderEffectsForIsolatedPass[cameraName]) {
        this._renderEffectsForIsolatedPass[cameraName]._update();
      }
    }
  }
  /** @internal */
  _reset() {
    this._renderEffects = {};
    this._renderEffectsForIsolatedPass = new Array();
  }
  _enableMSAAOnFirstPostProcess(sampleCount) {
    if (!this._engine._features.supportMSAA) {
      return false;
    }
    const effectKeys = Object.keys(this._renderEffects);
    if (effectKeys.length > 0) {
      const postProcesses = this._renderEffects[effectKeys[0]].getPostProcesses();
      if (postProcesses) {
        postProcesses[0].samples = sampleCount;
      }
    }
    return true;
  }
  /**
   * Ensures that all post processes in the pipeline are the correct size according to the
   * the viewport's required size
   */
  _adaptPostProcessesToViewPort() {
    const effectKeys = Object.keys(this._renderEffects);
    for (const effectKey of effectKeys) {
      const postProcesses = this._renderEffects[effectKey].getPostProcesses();
      if (postProcesses) {
        for (const postProcess of postProcesses) {
          postProcess.adaptScaleToCurrentViewport = true;
        }
      }
    }
  }
  /**
   * Sets the required values to the prepass renderer.
   * @param prePassRenderer defines the prepass renderer to setup.
   * @returns true if the pre pass is needed.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setPrePassRenderer(prePassRenderer) {
    return false;
  }
  /**
   * Disposes of the pipeline
   */
  dispose() {
  }
};
__decorate([
  serialize()
], PostProcessRenderPipeline.prototype, "_name", void 0);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinExtractHighlightsPostProcess.js
var ThinExtractHighlightsPostProcess = class _ThinExtractHighlightsPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./extractHighlights.fragment-KABWQLDE.js"));
    } else {
      list.push(import("./extractHighlights.fragment-IECK6EUB.js"));
    }
  }
  /**
   * Constructs a new extract highlights post process
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
      fragmentShader: _ThinExtractHighlightsPostProcess.FragmentUrl,
      uniforms: _ThinExtractHighlightsPostProcess.Uniforms
    });
    this.threshold = 0.9;
    this._exposure = 1;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    effect.setFloat("threshold", Math.pow(this.threshold, ToGammaSpace));
    effect.setFloat("exposure", this._exposure);
  }
};
ThinExtractHighlightsPostProcess.FragmentUrl = "extractHighlights";
ThinExtractHighlightsPostProcess.Uniforms = ["threshold", "exposure"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/extractHighlightsPostProcess.js
var ExtractHighlightsPostProcess = class extends PostProcess {
  /**
   * The luminance threshold, pixels below this value will be set to black.
   */
  get threshold() {
    return this._effectWrapper.threshold;
  }
  set threshold(value) {
    this._effectWrapper.threshold = value;
  }
  /** @internal */
  get _exposure() {
    return this._effectWrapper._exposure;
  }
  /** @internal */
  set _exposure(value) {
    this._effectWrapper._exposure = value;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "ExtractHighlightsPostProcess" string
   */
  getClassName() {
    return "ExtractHighlightsPostProcess";
  }
  constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      uniforms: ThinExtractHighlightsPostProcess.Uniforms,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinExtractHighlightsPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinExtractHighlightsPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this._inputPostProcess = null;
    this.onApplyObservable.add((effect) => {
      this.externalTextureSamplerBinding = !!this._inputPostProcess;
      if (this._inputPostProcess) {
        effect.setTextureFromPostProcess("textureSampler", this._inputPostProcess);
      }
    });
  }
};
__decorate([
  serialize()
], ExtractHighlightsPostProcess.prototype, "threshold", null);
RegisterClass("BABYLON.ExtractHighlightsPostProcess", ExtractHighlightsPostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinBloomMergePostProcess.js
var ThinBloomMergePostProcess = class _ThinBloomMergePostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(import("./bloomMerge.fragment-GD5J2JE3.js"));
    } else {
      list.push(import("./bloomMerge.fragment-ZYODJKOQ.js"));
    }
  }
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || Engine.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: _ThinBloomMergePostProcess.FragmentUrl,
      uniforms: _ThinBloomMergePostProcess.Uniforms,
      samplers: _ThinBloomMergePostProcess.Samplers
    });
    this.weight = 1;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat("bloomWeight", this.weight);
  }
};
ThinBloomMergePostProcess.FragmentUrl = "bloomMerge";
ThinBloomMergePostProcess.Uniforms = ["bloomWeight"];
ThinBloomMergePostProcess.Samplers = ["bloomBlur"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/bloomMergePostProcess.js
var BloomMergePostProcess = class extends PostProcess {
  /** Weight of the bloom to be added to the original input. */
  get weight() {
    return this._effectWrapper.weight;
  }
  set weight(value) {
    this._effectWrapper.weight = value;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "BloomMergePostProcess" string
   */
  getClassName() {
    return "BloomMergePostProcess";
  }
  /**
   * Creates a new instance of @see BloomMergePostProcess
   * @param name The name of the effect.
   * @param originalFromInput Post process which's input will be used for the merge.
   * @param blurred Blurred highlights post process which's output will be used.
   * @param weight Weight of the bloom to be added to the original input.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, originalFromInput, blurred, weight, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const blockCompilationFinal = typeof options === "number" ? blockCompilation : !!options.blockCompilation;
    const localOptions = {
      uniforms: ThinBloomMergePostProcess.Uniforms,
      samplers: ThinBloomMergePostProcess.Samplers,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      ...options,
      blockCompilation: true
    };
    super(name, ThinBloomMergePostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinBloomMergePostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this.weight = weight;
    this.externalTextureSamplerBinding = true;
    this.onApplyObservable.add((effect) => {
      effect.setTextureFromPostProcess("textureSampler", originalFromInput);
      effect.setTextureFromPostProcessOutput("bloomBlur", blurred);
    });
    if (!blockCompilationFinal) {
      this.updateEffect();
    }
  }
};
__decorate([
  serialize()
], BloomMergePostProcess.prototype, "weight", null);
RegisterClass("BABYLON.BloomMergePostProcess", BloomMergePostProcess);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinBloomEffect.js
var ThinBloomEffect = class {
  /**
   * The luminance threshold to find bright areas of the image to bloom.
   */
  get threshold() {
    return this._downscale.threshold;
  }
  set threshold(value) {
    this._downscale.threshold = value;
  }
  /**
   * The strength of the bloom.
   */
  get weight() {
    return this._merge.weight;
  }
  set weight(value) {
    this._merge.weight = value;
  }
  /**
   * Specifies the size of the bloom blur kernel, relative to the final output size
   */
  get kernel() {
    return this._blurX.kernel / this.scale;
  }
  set kernel(value) {
    this._blurX.kernel = value * this.scale;
    this._blurY.kernel = value * this.scale;
  }
  /**
   * Creates a new instance of @see ThinBloomEffect
   * @param name The name of the bloom render effect
   * @param engine The engine which the render effect will be applied. (default: current engine)
   * @param scale The ratio of the blur texture to the input texture that should be used to compute the bloom.
   * @param blockCompilation If shaders should not be compiled when the effect is created (default: false)
   */
  constructor(name, engine, scale, blockCompilation = false) {
    this.scale = scale;
    this._downscale = new ThinExtractHighlightsPostProcess(name + "_downscale", engine, { blockCompilation });
    this._blurX = new ThinBlurPostProcess(name + "_blurX", engine, new Vector2(1, 0), 10, { blockCompilation });
    this._blurY = new ThinBlurPostProcess(name + "_blurY", engine, new Vector2(0, 1), 10, { blockCompilation });
    this._merge = new ThinBloomMergePostProcess(name + "_merge", engine, { blockCompilation });
  }
  /**
   * Checks if the effect is ready to be used
   * @returns if the effect is ready
   */
  isReady() {
    return this._downscale.isReady() && this._blurX.isReady() && this._blurY.isReady() && this._merge.isReady();
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/bloomEffect.js
var BloomEffect = class extends PostProcessRenderEffect {
  /**
   * The luminance threshold to find bright areas of the image to bloom.
   */
  get threshold() {
    return this._thinBloomEffect.threshold;
  }
  set threshold(value) {
    this._thinBloomEffect.threshold = value;
  }
  /**
   * The strength of the bloom.
   */
  get weight() {
    return this._thinBloomEffect.weight;
  }
  set weight(value) {
    this._thinBloomEffect.weight = value;
  }
  /**
   * Specifies the size of the bloom blur kernel, relative to the final output size
   */
  get kernel() {
    return this._thinBloomEffect.kernel;
  }
  set kernel(value) {
    this._thinBloomEffect.kernel = value;
  }
  get bloomScale() {
    return this._thinBloomEffect.scale;
  }
  /**
   * Creates a new instance of @see BloomEffect
   * @param sceneOrEngine The scene or engine the effect belongs to.
   * @param bloomScale The ratio of the blur texture to the input texture that should be used to compute the bloom.
   * @param bloomWeight The strength of bloom.
   * @param bloomKernel The size of the kernel to be used when applying the blur.
   * @param pipelineTextureType The type of texture to be used when performing the post processing.
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(sceneOrEngine, bloomScale, bloomWeight, bloomKernel, pipelineTextureType = 0, blockCompilation = false) {
    const engine = sceneOrEngine._renderForCamera ? sceneOrEngine.getEngine() : sceneOrEngine;
    super(engine, "bloom", () => {
      return this._effects;
    }, true);
    this._effects = [];
    this._thinBloomEffect = new ThinBloomEffect("bloom", engine, bloomScale, blockCompilation);
    this._downscale = new ExtractHighlightsPostProcess("highlights", {
      size: 1,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._downscale
    });
    this._blurX = new BlurPostProcess("horizontal blur", this._thinBloomEffect._blurX.direction, this._thinBloomEffect._blurX.kernel, {
      size: bloomScale,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._blurX
    });
    this._blurX.alwaysForcePOT = true;
    this._blurX.autoClear = false;
    this._blurY = new BlurPostProcess("vertical blur", this._thinBloomEffect._blurY.direction, this._thinBloomEffect._blurY.kernel, {
      size: bloomScale,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._blurY
    });
    this._blurY.alwaysForcePOT = true;
    this._blurY.autoClear = false;
    this.kernel = bloomKernel;
    this._effects = [this._downscale, this._blurX, this._blurY];
    this._merge = new BloomMergePostProcess("bloomMerge", this._downscale, this._blurY, bloomWeight, {
      size: bloomScale,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._merge
    });
    this._merge.autoClear = false;
    this._effects.push(this._merge);
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
    return this._thinBloomEffect.isReady();
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.js
var DefaultRenderingPipeline = class _DefaultRenderingPipeline extends PostProcessRenderPipeline {
  /**
   * Enable or disable automatic building of the pipeline when effects are enabled and disabled.
   * If false, you will have to manually call prepare() to update the pipeline.
   */
  get automaticBuild() {
    return this._buildAllowed;
  }
  set automaticBuild(value) {
    this._buildAllowed = value;
  }
  /**
   * Gets active scene
   */
  get scene() {
    return this._scene;
  }
  /**
   * Enable or disable the sharpen process from the pipeline
   */
  set sharpenEnabled(enabled) {
    if (this._sharpenEnabled === enabled) {
      return;
    }
    this._sharpenEnabled = enabled;
    this._buildPipeline();
  }
  get sharpenEnabled() {
    return this._sharpenEnabled;
  }
  /**
   * Specifies the size of the bloom blur kernel, relative to the final output size
   */
  get bloomKernel() {
    return this._bloomKernel;
  }
  set bloomKernel(value) {
    this._bloomKernel = value;
    this.bloom.kernel = value / this._hardwareScaleLevel;
  }
  /**
   * The strength of the bloom.
   */
  set bloomWeight(value) {
    if (this._bloomWeight === value) {
      return;
    }
    this.bloom.weight = value;
    this._bloomWeight = value;
  }
  get bloomWeight() {
    return this._bloomWeight;
  }
  /**
   * The luminance threshold to find bright areas of the image to bloom.
   */
  set bloomThreshold(value) {
    if (this._bloomThreshold === value) {
      return;
    }
    this.bloom.threshold = value;
    this._bloomThreshold = value;
  }
  get bloomThreshold() {
    return this._bloomThreshold;
  }
  /**
   * The scale of the bloom, lower value will provide better performance.
   */
  set bloomScale(value) {
    if (this._bloomScale === value) {
      return;
    }
    this._bloomScale = value;
    this._rebuildBloom();
    this._buildPipeline();
  }
  get bloomScale() {
    return this._bloomScale;
  }
  /**
   * Enable or disable the bloom from the pipeline
   */
  set bloomEnabled(enabled) {
    if (this._bloomEnabled === enabled) {
      return;
    }
    this._bloomEnabled = enabled;
    this._buildPipeline();
  }
  get bloomEnabled() {
    return this._bloomEnabled;
  }
  _rebuildBloom() {
    const oldBloom = this.bloom;
    this.bloom = new BloomEffect(this._scene, this.bloomScale, this._bloomWeight, this.bloomKernel / this._hardwareScaleLevel, this._defaultPipelineTextureType, false);
    this.bloom.threshold = oldBloom.threshold;
    for (let i = 0; i < this._cameras.length; i++) {
      oldBloom.disposeEffects(this._cameras[i]);
    }
  }
  /**
   * If the depth of field is enabled.
   */
  get depthOfFieldEnabled() {
    return this._depthOfFieldEnabled;
  }
  set depthOfFieldEnabled(enabled) {
    if (this._depthOfFieldEnabled === enabled) {
      return;
    }
    this._depthOfFieldEnabled = enabled;
    this._buildPipeline();
  }
  /**
   * Blur level of the depth of field effect. (Higher blur will effect performance)
   */
  get depthOfFieldBlurLevel() {
    return this._depthOfFieldBlurLevel;
  }
  set depthOfFieldBlurLevel(value) {
    if (this._depthOfFieldBlurLevel === value) {
      return;
    }
    this._depthOfFieldBlurLevel = value;
    const oldDof = this.depthOfField;
    this.depthOfField = new DepthOfFieldEffect(this._scene, null, this._depthOfFieldBlurLevel, this._defaultPipelineTextureType, false);
    this.depthOfField.focalLength = oldDof.focalLength;
    this.depthOfField.focusDistance = oldDof.focusDistance;
    this.depthOfField.fStop = oldDof.fStop;
    this.depthOfField.lensSize = oldDof.lensSize;
    for (let i = 0; i < this._cameras.length; i++) {
      oldDof.disposeEffects(this._cameras[i]);
    }
    this._buildPipeline();
  }
  /**
   * If the anti aliasing is enabled.
   */
  set fxaaEnabled(enabled) {
    if (this._fxaaEnabled === enabled) {
      return;
    }
    this._fxaaEnabled = enabled;
    this._buildPipeline();
  }
  get fxaaEnabled() {
    return this._fxaaEnabled;
  }
  /**
   * MSAA sample count, setting this to 4 will provide 4x anti aliasing. (default: 1)
   */
  set samples(sampleCount) {
    if (this._samples === sampleCount) {
      return;
    }
    this._samples = sampleCount;
    this._buildPipeline();
  }
  get samples() {
    return this._samples;
  }
  /**
   * If image processing is enabled.
   */
  set imageProcessingEnabled(enabled) {
    if (this._imageProcessingEnabled === enabled) {
      return;
    }
    this._scene.imageProcessingConfiguration.isEnabled = enabled;
  }
  get imageProcessingEnabled() {
    return this._imageProcessingEnabled;
  }
  /**
   * If glow layer is enabled. (Adds a glow effect to emmissive materials)
   */
  set glowLayerEnabled(enabled) {
    if (enabled && !this._glowLayer) {
      this._glowLayer = new GlowLayer("", this._scene);
    } else if (!enabled && this._glowLayer) {
      this._glowLayer.dispose();
      this._glowLayer = null;
    }
  }
  get glowLayerEnabled() {
    return this._glowLayer != null;
  }
  /**
   * Gets the glow layer (or null if not defined)
   */
  get glowLayer() {
    return this._glowLayer;
  }
  /**
   * Enable or disable the chromaticAberration process from the pipeline
   */
  set chromaticAberrationEnabled(enabled) {
    if (this._chromaticAberrationEnabled === enabled) {
      return;
    }
    this._chromaticAberrationEnabled = enabled;
    this._buildPipeline();
  }
  get chromaticAberrationEnabled() {
    return this._chromaticAberrationEnabled;
  }
  /**
   * Enable or disable the grain process from the pipeline
   */
  set grainEnabled(enabled) {
    if (this._grainEnabled === enabled) {
      return;
    }
    this._grainEnabled = enabled;
    this._buildPipeline();
  }
  get grainEnabled() {
    return this._grainEnabled;
  }
  /**
   * Instantiates a DefaultRenderingPipeline.
   * @param name The rendering pipeline name (default: "")
   * @param hdr If high dynamic range textures should be used (default: true)
   * @param scene The scene linked to this pipeline (default: the last created scene)
   * @param cameras The array of cameras that the rendering pipeline will be attached to (default: scene.cameras)
   * @param automaticBuild If false, you will have to manually call prepare() to update the pipeline (default: true)
   */
  constructor(name = "", hdr = true, scene = EngineStore.LastCreatedScene, cameras, automaticBuild = true) {
    super(scene.getEngine(), name);
    this._camerasToBeAttached = [];
    this.SharpenPostProcessId = "SharpenPostProcessEffect";
    this.ImageProcessingPostProcessId = "ImageProcessingPostProcessEffect";
    this.FxaaPostProcessId = "FxaaPostProcessEffect";
    this.ChromaticAberrationPostProcessId = "ChromaticAberrationPostProcessEffect";
    this.GrainPostProcessId = "GrainPostProcessEffect";
    this._glowLayer = null;
    this.animations = [];
    this._imageProcessingConfigurationObserver = null;
    this._sharpenEnabled = false;
    this._bloomEnabled = false;
    this._depthOfFieldEnabled = false;
    this._depthOfFieldBlurLevel = 0;
    this._fxaaEnabled = false;
    this._imageProcessingEnabled = true;
    this._bloomScale = 0.5;
    this._chromaticAberrationEnabled = false;
    this._grainEnabled = false;
    this._buildAllowed = true;
    this.onBuildObservable = new Observable();
    this._resizeObserver = null;
    this._hardwareScaleLevel = 1;
    this._bloomKernel = 64;
    this._bloomWeight = 0.15;
    this._bloomThreshold = 0.9;
    this._samples = 1;
    this._hasCleared = false;
    this._prevPostProcess = null;
    this._prevPrevPostProcess = null;
    this._depthOfFieldSceneObserver = null;
    this._activeCameraChangedObserver = null;
    this._activeCamerasChangedObserver = null;
    this._cameras = cameras || scene.cameras;
    this._cameras = this._cameras.slice();
    this._camerasToBeAttached = this._cameras.slice();
    this._buildAllowed = automaticBuild;
    this._scene = scene;
    const caps = this._scene.getEngine().getCaps();
    this._hdr = hdr && (caps.textureHalfFloatRender || caps.textureFloatRender);
    if (this._hdr) {
      if (caps.textureHalfFloatRender) {
        this._defaultPipelineTextureType = 2;
      } else if (caps.textureFloatRender) {
        this._defaultPipelineTextureType = 1;
      }
    } else {
      this._defaultPipelineTextureType = 0;
    }
    scene.postProcessRenderPipelineManager.addPipeline(this);
    const engine = this._scene.getEngine();
    this.sharpen = new SharpenPostProcess("sharpen", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, true);
    this._sharpenEffect = new PostProcessRenderEffect(engine, this.SharpenPostProcessId, () => {
      return this.sharpen;
    }, true);
    this.depthOfField = new DepthOfFieldEffect(this._scene, null, this._depthOfFieldBlurLevel, this._defaultPipelineTextureType, true);
    this._hardwareScaleLevel = engine.getHardwareScalingLevel();
    this._resizeObserver = engine.onResizeObservable.add(() => {
      this._hardwareScaleLevel = engine.getHardwareScalingLevel();
      this.bloomKernel = this._bloomKernel;
    });
    this.bloom = new BloomEffect(this._scene, this._bloomScale, this._bloomWeight, this.bloomKernel / this._hardwareScaleLevel, this._defaultPipelineTextureType, true);
    this.chromaticAberration = new ChromaticAberrationPostProcess("ChromaticAberration", engine.getRenderWidth(), engine.getRenderHeight(), 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, true);
    this._chromaticAberrationEffect = new PostProcessRenderEffect(engine, this.ChromaticAberrationPostProcessId, () => {
      return this.chromaticAberration;
    }, true);
    this.grain = new GrainPostProcess("Grain", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, true);
    this._grainEffect = new PostProcessRenderEffect(engine, this.GrainPostProcessId, () => {
      return this.grain;
    }, true);
    let avoidReentrancyAtConstructionTime = true;
    this._imageProcessingConfigurationObserver = this._scene.imageProcessingConfiguration.onUpdateParameters.add(() => {
      this.bloom._downscale._exposure = this._scene.imageProcessingConfiguration.exposure;
      if (this.imageProcessingEnabled !== this._scene.imageProcessingConfiguration.isEnabled) {
        this._imageProcessingEnabled = this._scene.imageProcessingConfiguration.isEnabled;
        if (avoidReentrancyAtConstructionTime) {
          Tools.SetImmediate(() => {
            this._buildPipeline();
          });
        } else {
          this._buildPipeline();
        }
      }
    });
    this._buildPipeline();
    avoidReentrancyAtConstructionTime = false;
  }
  /**
   * Get the class name
   * @returns "DefaultRenderingPipeline"
   */
  getClassName() {
    return "DefaultRenderingPipeline";
  }
  /**
   * Force the compilation of the entire pipeline.
   */
  prepare() {
    const previousState = this._buildAllowed;
    this._buildAllowed = true;
    this._buildPipeline();
    this._buildAllowed = previousState;
  }
  _setAutoClearAndTextureSharing(postProcess, skipTextureSharing = false) {
    if (this._hasCleared) {
      postProcess.autoClear = false;
    } else {
      postProcess.autoClear = true;
      this._scene.autoClear = false;
      this._hasCleared = true;
    }
    if (!skipTextureSharing) {
      if (this._prevPrevPostProcess) {
        postProcess.shareOutputWith(this._prevPrevPostProcess);
      } else {
        postProcess.useOwnOutput();
      }
      if (this._prevPostProcess) {
        this._prevPrevPostProcess = this._prevPostProcess;
      }
      this._prevPostProcess = postProcess;
    }
  }
  _buildPipeline() {
    if (!this._buildAllowed) {
      return;
    }
    this._scene.autoClear = true;
    const engine = this._scene.getEngine();
    this._disposePostProcesses();
    if (this._cameras !== null) {
      this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._cameras);
      this._cameras = this._camerasToBeAttached.slice();
    }
    this._reset();
    this._prevPostProcess = null;
    this._prevPrevPostProcess = null;
    this._hasCleared = false;
    if (this.depthOfFieldEnabled) {
      if (this._cameras.length > 1) {
        for (const camera of this._cameras) {
          const depthRenderer = this._scene.enableDepthRenderer(camera);
          depthRenderer.useOnlyInActiveCamera = true;
        }
        this._depthOfFieldSceneObserver = this._scene.onAfterRenderTargetsRenderObservable.add((scene) => {
          if (this._cameras.indexOf(scene.activeCamera) > -1) {
            this.depthOfField.depthTexture = scene.enableDepthRenderer(scene.activeCamera).getDepthMap();
          }
        });
      } else {
        this._scene.onAfterRenderTargetsRenderObservable.remove(this._depthOfFieldSceneObserver);
        const depthRenderer = this._scene.enableDepthRenderer(this._cameras[0]);
        this.depthOfField.depthTexture = depthRenderer.getDepthMap();
      }
      if (!this.depthOfField._isReady()) {
        this.depthOfField._updateEffects();
      }
      this.addEffect(this.depthOfField);
      this._setAutoClearAndTextureSharing(this.depthOfField._effects[0], true);
    } else {
      this._scene.onAfterRenderTargetsRenderObservable.remove(this._depthOfFieldSceneObserver);
    }
    if (this.bloomEnabled) {
      if (!this.bloom._isReady()) {
        this.bloom._updateEffects();
      }
      this.addEffect(this.bloom);
      this._setAutoClearAndTextureSharing(this.bloom._effects[0], true);
    }
    if (this._imageProcessingEnabled) {
      this.imageProcessing = new ImageProcessingPostProcess("imageProcessing", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, this.scene.imageProcessingConfiguration);
      if (this._hdr) {
        this.addEffect(new PostProcessRenderEffect(engine, this.ImageProcessingPostProcessId, () => {
          return this.imageProcessing;
        }, true));
        this._setAutoClearAndTextureSharing(this.imageProcessing);
      } else {
        this._scene.imageProcessingConfiguration.applyByPostProcess = false;
      }
      if (!this._cameras || this._cameras.length === 0) {
        this._scene.imageProcessingConfiguration.applyByPostProcess = false;
      }
      if (!this.imageProcessing.getEffect()) {
        this.imageProcessing._updateParameters();
      }
    }
    if (this.sharpenEnabled) {
      if (!this.sharpen.isReady()) {
        this.sharpen.updateEffect();
      }
      this.addEffect(this._sharpenEffect);
      this._setAutoClearAndTextureSharing(this.sharpen);
    }
    if (this.grainEnabled) {
      if (!this.grain.isReady()) {
        this.grain.updateEffect();
      }
      this.addEffect(this._grainEffect);
      this._setAutoClearAndTextureSharing(this.grain);
    }
    if (this.chromaticAberrationEnabled) {
      if (!this.chromaticAberration.isReady()) {
        this.chromaticAberration.updateEffect();
      }
      this.addEffect(this._chromaticAberrationEffect);
      this._setAutoClearAndTextureSharing(this.chromaticAberration);
    }
    if (this.fxaaEnabled) {
      this.fxaa = new FxaaPostProcess("fxaa", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType);
      this.addEffect(new PostProcessRenderEffect(engine, this.FxaaPostProcessId, () => {
        return this.fxaa;
      }, true));
      this._setAutoClearAndTextureSharing(this.fxaa, true);
    }
    if (this._cameras !== null) {
      this._scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(this._name, this._cameras);
    }
    if (this._scene.activeCameras && this._scene.activeCameras.length > 1 || this._scene.activeCamera && this._cameras.indexOf(this._scene.activeCamera) === -1) {
      this._scene.autoClear = true;
    }
    if (!this._activeCameraChangedObserver) {
      this._activeCameraChangedObserver = this._scene.onActiveCameraChanged.add(() => {
        if (this._scene.activeCamera && this._cameras.indexOf(this._scene.activeCamera) === -1) {
          this._scene.autoClear = true;
        }
      });
    }
    if (!this._activeCamerasChangedObserver) {
      this._activeCamerasChangedObserver = this._scene.onActiveCamerasChanged.add(() => {
        if (this._scene.activeCameras && this._scene.activeCameras.length > 1) {
          this._scene.autoClear = true;
        }
      });
    }
    this._adaptPostProcessesToViewPort();
    if (!this._enableMSAAOnFirstPostProcess(this.samples) && this.samples > 1) {
      Logger.Warn("MSAA failed to enable, MSAA is only supported in browsers that support webGL >= 2.0");
    }
    this.onBuildObservable.notifyObservers(this);
  }
  _disposePostProcesses(disposeNonRecreated = false) {
    for (let i = 0; i < this._cameras.length; i++) {
      const camera = this._cameras[i];
      if (this.imageProcessing) {
        this.imageProcessing.dispose(camera);
      }
      if (this.fxaa) {
        this.fxaa.dispose(camera);
      }
      if (disposeNonRecreated) {
        if (this.sharpen) {
          this.sharpen.dispose(camera);
        }
        if (this.depthOfField) {
          this._scene.onAfterRenderTargetsRenderObservable.remove(this._depthOfFieldSceneObserver);
          this.depthOfField.disposeEffects(camera);
        }
        if (this.bloom) {
          this.bloom.disposeEffects(camera);
        }
        if (this.chromaticAberration) {
          this.chromaticAberration.dispose(camera);
        }
        if (this.grain) {
          this.grain.dispose(camera);
        }
        if (this._glowLayer) {
          this._glowLayer.dispose();
        }
      }
    }
    this.imageProcessing = null;
    this.fxaa = null;
    if (disposeNonRecreated) {
      this.sharpen = null;
      this._sharpenEffect = null;
      this.depthOfField = null;
      this.bloom = null;
      this.chromaticAberration = null;
      this._chromaticAberrationEffect = null;
      this.grain = null;
      this._grainEffect = null;
      this._glowLayer = null;
    }
  }
  /**
   * Adds a camera to the pipeline
   * @param camera the camera to be added
   */
  addCamera(camera) {
    this._camerasToBeAttached.push(camera);
    this._buildPipeline();
  }
  /**
   * Removes a camera from the pipeline
   * @param camera the camera to remove
   */
  removeCamera(camera) {
    const index = this._camerasToBeAttached.indexOf(camera);
    this._camerasToBeAttached.splice(index, 1);
    this._buildPipeline();
  }
  /**
   * Dispose of the pipeline and stop all post processes
   */
  dispose() {
    this._buildAllowed = false;
    this.onBuildObservable.clear();
    this._disposePostProcesses(true);
    this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._cameras);
    this._scene._postProcessRenderPipelineManager.removePipeline(this.name);
    this._scene.autoClear = true;
    if (this._resizeObserver) {
      this._scene.getEngine().onResizeObservable.remove(this._resizeObserver);
      this._resizeObserver = null;
    }
    this._scene.onActiveCameraChanged.remove(this._activeCameraChangedObserver);
    this._scene.onActiveCamerasChanged.remove(this._activeCamerasChangedObserver);
    this._scene.imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingConfigurationObserver);
    super.dispose();
  }
  /**
   * Serialize the rendering pipeline (Used when exporting)
   * @returns the serialized object
   */
  serialize() {
    const serializationObject = SerializationHelper.Serialize(this);
    serializationObject.customType = "DefaultRenderingPipeline";
    return serializationObject;
  }
  /**
   * Parse the serialized pipeline
   * @param source Source pipeline.
   * @param scene The scene to load the pipeline to.
   * @param rootUrl The URL of the serialized pipeline.
   * @returns An instantiated pipeline from the serialized object.
   */
  static Parse(source, scene, rootUrl) {
    return SerializationHelper.Parse(() => new _DefaultRenderingPipeline(source._name, source._name._hdr, scene), source, scene, rootUrl);
  }
};
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "sharpenEnabled", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "bloomKernel", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "_bloomWeight", void 0);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "_bloomThreshold", void 0);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "_hdr", void 0);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "bloomWeight", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "bloomThreshold", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "bloomScale", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "bloomEnabled", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "depthOfFieldEnabled", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "depthOfFieldBlurLevel", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "fxaaEnabled", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "samples", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "imageProcessingEnabled", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "glowLayerEnabled", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "chromaticAberrationEnabled", null);
__decorate([
  serialize()
], DefaultRenderingPipeline.prototype, "grainEnabled", null);
RegisterClass("BABYLON.DefaultRenderingPipeline", DefaultRenderingPipeline);
export {
  DefaultRenderingPipeline
};
//# sourceMappingURL=@babylonjs_core_PostProcesses_RenderPipeline_Pipelines_defaultRenderingPipeline.js.map
