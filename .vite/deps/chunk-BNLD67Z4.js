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
  AbstractEngine
} from "./chunk-CQNOHBC6.js";
import {
  SerializationHelper
} from "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize
} from "./chunk-STIKNZXL.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/thinPassPostProcess.js
var ThinPassPostProcess = class _ThinPassPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([import("./pass.fragment-67L4HPBA.js")]));
    } else {
      list.push(Promise.all([import("./pass.fragment-SNDFYLVV.js")]));
    }
    super._gatherImports(useWebGPU, list);
  }
  /**
   * Constructs a new pass post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    const localOptions = {
      name,
      engine: engine || Engine.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: _ThinPassPostProcess.FragmentUrl,
      ...options
    };
    if (!localOptions.engine) {
      localOptions.engine = Engine.LastCreatedEngine;
    }
    super(localOptions);
  }
};
ThinPassPostProcess.FragmentUrl = "pass";
var ThinPassCubePostProcess = class _ThinPassCubePostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([import("./passCube.fragment-54SK4TLT.js")]));
    } else {
      list.push(Promise.all([import("./passCube.fragment-2WSQ6F7X.js")]));
    }
    super._gatherImports(useWebGPU, list);
  }
  /**
   * Creates the PassCubePostProcess
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
      fragmentShader: _ThinPassCubePostProcess.FragmentUrl,
      defines: "#define POSITIVEX"
    });
    this._face = 0;
  }
  /**
   * Gets or sets the cube face to display.
   *  * 0 is +X
   *  * 1 is -X
   *  * 2 is +Y
   *  * 3 is -Y
   *  * 4 is +Z
   *  * 5 is -Z
   */
  get face() {
    return this._face;
  }
  set face(value) {
    if (value < 0 || value > 5) {
      return;
    }
    this._face = value;
    switch (this._face) {
      case 0:
        this.updateEffect("#define POSITIVEX");
        break;
      case 1:
        this.updateEffect("#define NEGATIVEX");
        break;
      case 2:
        this.updateEffect("#define POSITIVEY");
        break;
      case 3:
        this.updateEffect("#define NEGATIVEY");
        break;
      case 4:
        this.updateEffect("#define POSITIVEZ");
        break;
      case 5:
        this.updateEffect("#define NEGATIVEZ");
        break;
    }
  }
};
ThinPassCubePostProcess.FragmentUrl = "passCube";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/passPostProcess.js
var PassPostProcess = class _PassPostProcess extends PostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "PassPostProcess" string
   */
  getClassName() {
    return "PassPostProcess";
  }
  /**
   * Creates the PassPostProcess
   * @param name The name of the effect.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType The type of texture to be used when performing the post processing.
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinPassPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinPassPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new _PassPostProcess(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, parsedPostProcess._engine, parsedPostProcess.reusable);
    }, parsedPostProcess, scene, rootUrl);
  }
};
RegisterClass("BABYLON.PassPostProcess", PassPostProcess);
var PassCubePostProcess = class _PassCubePostProcess extends PostProcess {
  /**
   * Gets or sets the cube face to display.
   *  * 0 is +X
   *  * 1 is -X
   *  * 2 is +Y
   *  * 3 is -Y
   *  * 4 is +Z
   *  * 5 is -Z
   */
  get face() {
    return this._effectWrapper.face;
  }
  set face(value) {
    this._effectWrapper.face = value;
  }
  /**
   * Gets a string identifying the name of the class
   * @returns "PassCubePostProcess" string
   */
  getClassName() {
    return "PassCubePostProcess";
  }
  /**
   * Creates the PassCubePostProcess
   * @param name The name of the effect.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType The type of texture to be used when performing the post processing.
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinPassPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinPassCubePostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new _PassCubePostProcess(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, parsedPostProcess._engine, parsedPostProcess.reusable);
    }, parsedPostProcess, scene, rootUrl);
  }
};
__decorate([
  serialize()
], PassCubePostProcess.prototype, "face", null);
AbstractEngine._RescalePostProcessFactory = (engine) => {
  return new PassPostProcess("rescale", 1, null, 2, engine, false, 0);
};

export {
  ThinPassPostProcess,
  PassPostProcess
};
//# sourceMappingURL=chunk-BNLD67Z4.js.map
