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
  SerializationHelper
} from "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize,
  serializeAsVector2
} from "./chunk-STIKNZXL.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinBlurPostProcess.js
var ThinBlurPostProcess = class _ThinBlurPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([import("./kernelBlur.fragment-BJHLY7KR.js"), import("./kernelBlur.vertex-KOIB5S6Y.js")]));
    } else {
      list.push(Promise.all([import("./kernelBlur.fragment-CZFYTG4Y.js"), import("./kernelBlur.vertex-AHE7VUZO.js")]));
    }
  }
  /**
   * Constructs a new blur post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param direction Direction in which to apply the blur
   * @param kernel Kernel size of the blur
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, direction, kernel, options) {
    const blockCompilationFinal = !!options?.blockCompilation;
    super({
      ...options,
      name,
      engine: engine || Engine.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: _ThinBlurPostProcess.FragmentUrl,
      uniforms: _ThinBlurPostProcess.Uniforms,
      samplers: _ThinBlurPostProcess.Samplers,
      vertexUrl: _ThinBlurPostProcess.VertexUrl,
      blockCompilation: true
    });
    this._packedFloat = false;
    this._staticDefines = "";
    this.textureWidth = 0;
    this.textureHeight = 0;
    this._staticDefines = options ? Array.isArray(options.defines) ? options.defines.join("\n") : options.defines || "" : "";
    this.options.blockCompilation = blockCompilationFinal;
    if (direction !== void 0) {
      this.direction = direction;
    }
    if (kernel !== void 0) {
      this.kernel = kernel;
    }
  }
  /**
   * Sets the length in pixels of the blur sample region
   */
  set kernel(v) {
    if (this._idealKernel === v) {
      return;
    }
    v = Math.max(v, 1);
    this._idealKernel = v;
    this._kernel = this._nearestBestKernel(v);
    if (!this.options.blockCompilation) {
      this._updateParameters();
    }
  }
  /**
   * Gets the length in pixels of the blur sample region
   */
  get kernel() {
    return this._idealKernel;
  }
  /**
   * Sets whether or not the blur needs to unpack/repack floats
   */
  set packedFloat(v) {
    if (this._packedFloat === v) {
      return;
    }
    this._packedFloat = v;
    if (!this.options.blockCompilation) {
      this._updateParameters();
    }
  }
  /**
   * Gets whether or not the blur is unpacking/repacking floats
   */
  get packedFloat() {
    return this._packedFloat;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat2("delta", 1 / this.textureWidth * this.direction.x, 1 / this.textureHeight * this.direction.y);
  }
  /** @internal */
  _updateParameters(onCompiled, onError) {
    const n = this._kernel;
    const centerIndex = (n - 1) / 2;
    let offsets = [];
    let weights = [];
    let totalWeight = 0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const w = this._gaussianWeight(u * 2 - 1);
      offsets[i] = i - centerIndex;
      weights[i] = w;
      totalWeight += w;
    }
    for (let i = 0; i < weights.length; i++) {
      weights[i] /= totalWeight;
    }
    const linearSamplingWeights = [];
    const linearSamplingOffsets = [];
    const linearSamplingMap = [];
    for (let i = 0; i <= centerIndex; i += 2) {
      const j = Math.min(i + 1, Math.floor(centerIndex));
      const singleCenterSample = i === j;
      if (singleCenterSample) {
        linearSamplingMap.push({ o: offsets[i], w: weights[i] });
      } else {
        const sharedCell = j === centerIndex;
        const weightLinear = weights[i] + weights[j] * (sharedCell ? 0.5 : 1);
        const offsetLinear = offsets[i] + 1 / (1 + weights[i] / weights[j]);
        if (offsetLinear === 0) {
          linearSamplingMap.push({ o: offsets[i], w: weights[i] });
          linearSamplingMap.push({ o: offsets[i + 1], w: weights[i + 1] });
        } else {
          linearSamplingMap.push({ o: offsetLinear, w: weightLinear });
          linearSamplingMap.push({ o: -offsetLinear, w: weightLinear });
        }
      }
    }
    for (let i = 0; i < linearSamplingMap.length; i++) {
      linearSamplingOffsets[i] = linearSamplingMap[i].o;
      linearSamplingWeights[i] = linearSamplingMap[i].w;
    }
    offsets = linearSamplingOffsets;
    weights = linearSamplingWeights;
    const maxVaryingRows = this.options.engine.getCaps().maxVaryingVectors - (this.options.shaderLanguage === 1 ? 1 : 0);
    const freeVaryingVec2 = Math.max(maxVaryingRows, 0) - 1;
    let varyingCount = Math.min(offsets.length, freeVaryingVec2);
    let defines = "";
    defines += this._staticDefines;
    if (this._staticDefines.indexOf("DOF") != -1) {
      defines += `#define CENTER_WEIGHT ${this._glslFloat(weights[varyingCount - 1])}
`;
      varyingCount--;
    }
    for (let i = 0; i < varyingCount; i++) {
      defines += `#define KERNEL_OFFSET${i} ${this._glslFloat(offsets[i])}
`;
      defines += `#define KERNEL_WEIGHT${i} ${this._glslFloat(weights[i])}
`;
    }
    let depCount = 0;
    for (let i = freeVaryingVec2; i < offsets.length; i++) {
      defines += `#define KERNEL_DEP_OFFSET${depCount} ${this._glslFloat(offsets[i])}
`;
      defines += `#define KERNEL_DEP_WEIGHT${depCount} ${this._glslFloat(weights[i])}
`;
      depCount++;
    }
    if (this.packedFloat) {
      defines += `#define PACKEDFLOAT 1`;
    }
    this.options.blockCompilation = false;
    this.updateEffect(defines, null, null, {
      varyingCount,
      depCount
    }, onCompiled, onError);
  }
  /**
   * Best kernels are odd numbers that when divided by 2, their integer part is even, so 5, 9 or 13.
   * Other odd kernels optimize correctly but require proportionally more samples, even kernels are
   * possible but will produce minor visual artifacts. Since each new kernel requires a new shader we
   * want to minimize kernel changes, having gaps between physical kernels is helpful in that regard.
   * The gaps between physical kernels are compensated for in the weighting of the samples
   * @param idealKernel Ideal blur kernel.
   * @returns Nearest best kernel.
   */
  _nearestBestKernel(idealKernel) {
    const v = Math.round(idealKernel);
    for (const k of [v, v - 1, v + 1, v - 2, v + 2]) {
      if (k % 2 !== 0 && Math.floor(k / 2) % 2 === 0 && k > 0) {
        return Math.max(k, 3);
      }
    }
    return Math.max(v, 3);
  }
  /**
   * Calculates the value of a Gaussian distribution with sigma 3 at a given point.
   * @param x The point on the Gaussian distribution to sample.
   * @returns the value of the Gaussian function at x.
   */
  _gaussianWeight(x) {
    const sigma = 1 / 3;
    const denominator = Math.sqrt(2 * Math.PI) * sigma;
    const exponent = -(x * x / (2 * sigma * sigma));
    const weight = 1 / denominator * Math.exp(exponent);
    return weight;
  }
  /**
   * Generates a string that can be used as a floating point number in GLSL.
   * @param x Value to print.
   * @param decimalFigures Number of decimal places to print the number to (excluding trailing 0s).
   * @returns GLSL float string.
   */
  _glslFloat(x, decimalFigures = 8) {
    return x.toFixed(decimalFigures).replace(/0+$/, "");
  }
};
ThinBlurPostProcess.VertexUrl = "kernelBlur";
ThinBlurPostProcess.FragmentUrl = "kernelBlur";
ThinBlurPostProcess.Uniforms = ["delta", "direction"];
ThinBlurPostProcess.Samplers = ["circleOfConfusionSampler"];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/blurPostProcess.js
var BlurPostProcess = class _BlurPostProcess extends PostProcess {
  /** The direction in which to blur the image. */
  get direction() {
    return this._effectWrapper.direction;
  }
  set direction(value) {
    this._effectWrapper.direction = value;
  }
  /**
   * Sets the length in pixels of the blur sample region
   */
  set kernel(v) {
    this._effectWrapper.kernel = v;
  }
  /**
   * Gets the length in pixels of the blur sample region
   */
  get kernel() {
    return this._effectWrapper.kernel;
  }
  /**
   * Sets whether or not the blur needs to unpack/repack floats
   */
  set packedFloat(v) {
    this._effectWrapper.packedFloat = v;
  }
  /**
   * Gets whether or not the blur is unpacking/repacking floats
   */
  get packedFloat() {
    return this._effectWrapper.packedFloat;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "BlurPostProcess" string
   */
  getClassName() {
    return "BlurPostProcess";
  }
  /**
   * Creates a new instance BlurPostProcess
   * @param name The name of the effect.
   * @param direction The direction in which to blur the image.
   * @param kernel The size of the kernel to be used when computing the blur. eg. Size of 3 will blur the center pixel by 2 pixels surrounding it.
   * @param options The required width/height ratio to downsize to before computing the render pass. (Use 1.0 for full size)
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param defines
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   * @param textureFormat Format of textures used when performing the post process. (default: TEXTUREFORMAT_RGBA)
   */
  constructor(name, direction, kernel, options, camera = null, samplingMode = Texture.BILINEAR_SAMPLINGMODE, engine, reusable, textureType = 0, defines = "", blockCompilation = false, textureFormat = 5) {
    const blockCompilationFinal = typeof options === "number" ? blockCompilation : !!options.blockCompilation;
    const localOptions = {
      uniforms: ThinBlurPostProcess.Uniforms,
      samplers: ThinBlurPostProcess.Samplers,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      vertexUrl: ThinBlurPostProcess.VertexUrl,
      indexParameters: { varyingCount: 0, depCount: 0 },
      textureFormat,
      defines,
      ...options,
      blockCompilation: true
    };
    super(name, ThinBlurPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinBlurPostProcess(name, engine, void 0, void 0, localOptions) : void 0,
      ...localOptions
    });
    this._effectWrapper.options.blockCompilation = blockCompilationFinal;
    this.direction = direction;
    this.onApplyObservable.add(() => {
      this._effectWrapper.textureWidth = this._outputTexture ? this._outputTexture.width : this.width;
      this._effectWrapper.textureHeight = this._outputTexture ? this._outputTexture.height : this.height;
    });
    this.kernel = kernel;
  }
  updateEffect(_defines = null, _uniforms = null, _samplers = null, _indexParameters, onCompiled, onError) {
    this._effectWrapper._updateParameters(onCompiled, onError);
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new _BlurPostProcess(parsedPostProcess.name, parsedPostProcess.direction, parsedPostProcess.kernel, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable, parsedPostProcess.textureType, void 0, false);
    }, parsedPostProcess, scene, rootUrl);
  }
};
__decorate([
  serializeAsVector2()
], BlurPostProcess.prototype, "direction", null);
__decorate([
  serialize()
], BlurPostProcess.prototype, "kernel", null);
__decorate([
  serialize()
], BlurPostProcess.prototype, "packedFloat", null);
RegisterClass("BABYLON.BlurPostProcess", BlurPostProcess);

export {
  ThinBlurPostProcess,
  BlurPostProcess
};
//# sourceMappingURL=chunk-INKIDW57.js.map
