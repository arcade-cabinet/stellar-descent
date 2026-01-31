import {
  PrecisionDate
} from "./chunk-BGSVSY55.js";
import {
  Effect,
  EngineFunctionContext,
  _LoadFile
} from "./chunk-RG742WGM.js";
import {
  IsDocumentAvailable,
  IsNavigatorAvailable,
  IsWindowObjectExist
} from "./chunk-AB3HOSPI.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import {
  _WarnImport
} from "./chunk-MMWR3MO4.js";
import {
  EngineStore,
  PerformanceConfigurator
} from "./chunk-YSTPYZG5.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/States/alphaCullingState.js
var AlphaState = class {
  /**
   * Initializes the state.
   * @param _supportBlendParametersPerTarget - Whether blend parameters per target is supported
   */
  constructor(_supportBlendParametersPerTarget) {
    this._supportBlendParametersPerTarget = _supportBlendParametersPerTarget;
    this._blendFunctionParameters = new Array(4 * 8);
    this._blendEquationParameters = new Array(2 * 8);
    this._blendConstants = new Array(4);
    this._isBlendConstantsDirty = false;
    this._alphaBlend = Array(8).fill(false);
    this._numTargetEnabled = 0;
    this._isAlphaBlendDirty = false;
    this._isBlendFunctionParametersDirty = false;
    this._isBlendEquationParametersDirty = false;
    this.reset();
  }
  get isDirty() {
    return this._isAlphaBlendDirty || this._isBlendFunctionParametersDirty || this._isBlendEquationParametersDirty;
  }
  get alphaBlend() {
    return this._numTargetEnabled > 0;
  }
  set alphaBlend(value) {
    this.setAlphaBlend(value);
  }
  setAlphaBlend(value, targetIndex = 0) {
    if (this._alphaBlend[targetIndex] === value) {
      return;
    }
    if (value) {
      this._numTargetEnabled++;
    } else {
      this._numTargetEnabled--;
    }
    this._alphaBlend[targetIndex] = value;
    this._isAlphaBlendDirty = true;
  }
  setAlphaBlendConstants(r, g, b, a) {
    if (this._blendConstants[0] === r && this._blendConstants[1] === g && this._blendConstants[2] === b && this._blendConstants[3] === a) {
      return;
    }
    this._blendConstants[0] = r;
    this._blendConstants[1] = g;
    this._blendConstants[2] = b;
    this._blendConstants[3] = a;
    this._isBlendConstantsDirty = true;
  }
  setAlphaBlendFunctionParameters(srcRGBFactor, dstRGBFactor, srcAlphaFactor, dstAlphaFactor, targetIndex = 0) {
    const offset = targetIndex * 4;
    if (this._blendFunctionParameters[offset + 0] === srcRGBFactor && this._blendFunctionParameters[offset + 1] === dstRGBFactor && this._blendFunctionParameters[offset + 2] === srcAlphaFactor && this._blendFunctionParameters[offset + 3] === dstAlphaFactor) {
      return;
    }
    this._blendFunctionParameters[offset + 0] = srcRGBFactor;
    this._blendFunctionParameters[offset + 1] = dstRGBFactor;
    this._blendFunctionParameters[offset + 2] = srcAlphaFactor;
    this._blendFunctionParameters[offset + 3] = dstAlphaFactor;
    this._isBlendFunctionParametersDirty = true;
  }
  setAlphaEquationParameters(rgbEquation, alphaEquation, targetIndex = 0) {
    const offset = targetIndex * 2;
    if (this._blendEquationParameters[offset + 0] === rgbEquation && this._blendEquationParameters[offset + 1] === alphaEquation) {
      return;
    }
    this._blendEquationParameters[offset + 0] = rgbEquation;
    this._blendEquationParameters[offset + 1] = alphaEquation;
    this._isBlendEquationParametersDirty = true;
  }
  reset() {
    this._alphaBlend.fill(false);
    this._numTargetEnabled = 0;
    this._blendFunctionParameters.fill(null);
    this._blendEquationParameters.fill(null);
    this._blendConstants[0] = null;
    this._blendConstants[1] = null;
    this._blendConstants[2] = null;
    this._blendConstants[3] = null;
    this._isAlphaBlendDirty = true;
    this._isBlendFunctionParametersDirty = false;
    this._isBlendEquationParametersDirty = false;
    this._isBlendConstantsDirty = false;
  }
  apply(gl, numTargets = 1) {
    if (!this.isDirty) {
      return;
    }
    if (this._isBlendConstantsDirty) {
      gl.blendColor(this._blendConstants[0], this._blendConstants[1], this._blendConstants[2], this._blendConstants[3]);
      this._isBlendConstantsDirty = false;
    }
    if (numTargets === 1 || !this._supportBlendParametersPerTarget) {
      if (this._isAlphaBlendDirty) {
        if (this._alphaBlend[0]) {
          gl.enable(gl.BLEND);
        } else {
          gl.disable(gl.BLEND);
        }
        this._isAlphaBlendDirty = false;
      }
      if (this._isBlendFunctionParametersDirty) {
        gl.blendFuncSeparate(this._blendFunctionParameters[0], this._blendFunctionParameters[1], this._blendFunctionParameters[2], this._blendFunctionParameters[3]);
        this._isBlendFunctionParametersDirty = false;
      }
      if (this._isBlendEquationParametersDirty) {
        gl.blendEquationSeparate(this._blendEquationParameters[0], this._blendEquationParameters[1]);
        this._isBlendEquationParametersDirty = false;
      }
      return;
    }
    const gl2 = gl;
    if (this._isAlphaBlendDirty) {
      for (let i = 0; i < numTargets; i++) {
        const index = i < this._numTargetEnabled ? i : 0;
        if (this._alphaBlend[index]) {
          gl2.enableIndexed(gl.BLEND, i);
        } else {
          gl2.disableIndexed(gl.BLEND, i);
        }
      }
      this._isAlphaBlendDirty = false;
    }
    if (this._isBlendFunctionParametersDirty) {
      for (let i = 0; i < numTargets; i++) {
        const offset = i < this._numTargetEnabled ? i * 4 : 0;
        gl2.blendFuncSeparateIndexed(i, this._blendFunctionParameters[offset + 0], this._blendFunctionParameters[offset + 1], this._blendFunctionParameters[offset + 2], this._blendFunctionParameters[offset + 3]);
      }
      this._isBlendFunctionParametersDirty = false;
    }
    if (this._isBlendEquationParametersDirty) {
      for (let i = 0; i < numTargets; i++) {
        const offset = i < this._numTargetEnabled ? i * 2 : 0;
        gl2.blendEquationSeparateIndexed(i, this._blendEquationParameters[offset + 0], this._blendEquationParameters[offset + 1]);
      }
      this._isBlendEquationParametersDirty = false;
    }
  }
  setAlphaMode(mode, targetIndex) {
    let equation = 32774;
    switch (mode) {
      case 0:
        break;
      case 7:
        this.setAlphaBlendFunctionParameters(1, 771, 1, 1, targetIndex);
        break;
      case 8:
        this.setAlphaBlendFunctionParameters(1, 771, 1, 771, targetIndex);
        break;
      case 2:
        this.setAlphaBlendFunctionParameters(770, 771, 1, 1, targetIndex);
        break;
      case 6:
        this.setAlphaBlendFunctionParameters(1, 1, 0, 1, targetIndex);
        break;
      case 1:
        this.setAlphaBlendFunctionParameters(770, 1, 0, 1, targetIndex);
        break;
      case 3:
        this.setAlphaBlendFunctionParameters(0, 769, 1, 1, targetIndex);
        break;
      case 4:
        this.setAlphaBlendFunctionParameters(774, 0, 1, 1, targetIndex);
        break;
      case 5:
        this.setAlphaBlendFunctionParameters(770, 769, 1, 1, targetIndex);
        break;
      case 9:
        this.setAlphaBlendFunctionParameters(32769, 32770, 32771, 32772, targetIndex);
        break;
      case 10:
        this.setAlphaBlendFunctionParameters(1, 769, 1, 771, targetIndex);
        break;
      case 11:
        this.setAlphaBlendFunctionParameters(1, 1, 1, 1, targetIndex);
        break;
      case 12:
        this.setAlphaBlendFunctionParameters(772, 1, 0, 0, targetIndex);
        break;
      case 13:
        this.setAlphaBlendFunctionParameters(775, 769, 773, 771, targetIndex);
        break;
      case 14:
        this.setAlphaBlendFunctionParameters(1, 771, 1, 771, targetIndex);
        break;
      case 15:
        this.setAlphaBlendFunctionParameters(1, 1, 1, 0, targetIndex);
        break;
      case 16:
        this.setAlphaBlendFunctionParameters(775, 769, 0, 1, targetIndex);
        break;
      case 17:
        this.setAlphaBlendFunctionParameters(770, 771, 1, 771, targetIndex);
        break;
      case 18:
        this.setAlphaBlendFunctionParameters(1, 1, 1, 1, targetIndex);
        equation = 32775;
        break;
      case 19:
        this.setAlphaBlendFunctionParameters(1, 1, 1, 1, targetIndex);
        equation = 32776;
        break;
      case 20:
        this.setAlphaBlendFunctionParameters(1, 35065, 0, 1, targetIndex);
        break;
    }
    this.setAlphaEquationParameters(equation, equation, targetIndex);
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/Textures/textureSampler.js
var TextureSampler = class {
  /**
   * | Value | Type               | Description |
   * | ----- | ------------------ | ----------- |
   * | 0     | CLAMP_ADDRESSMODE  |             |
   * | 1     | WRAP_ADDRESSMODE   |             |
   * | 2     | MIRROR_ADDRESSMODE |             |
   */
  get wrapU() {
    return this._cachedWrapU;
  }
  set wrapU(value) {
    this._cachedWrapU = value;
  }
  /**
   * | Value | Type               | Description |
   * | ----- | ------------------ | ----------- |
   * | 0     | CLAMP_ADDRESSMODE  |             |
   * | 1     | WRAP_ADDRESSMODE   |             |
   * | 2     | MIRROR_ADDRESSMODE |             |
   */
  get wrapV() {
    return this._cachedWrapV;
  }
  set wrapV(value) {
    this._cachedWrapV = value;
  }
  /**
   * | Value | Type               | Description |
   * | ----- | ------------------ | ----------- |
   * | 0     | CLAMP_ADDRESSMODE  |             |
   * | 1     | WRAP_ADDRESSMODE   |             |
   * | 2     | MIRROR_ADDRESSMODE |             |
   */
  get wrapR() {
    return this._cachedWrapR;
  }
  set wrapR(value) {
    this._cachedWrapR = value;
  }
  /**
   * With compliant hardware and browser (supporting anisotropic filtering)
   * this defines the level of anisotropic filtering in the texture.
   * The higher the better but the slower.
   */
  get anisotropicFilteringLevel() {
    return this._cachedAnisotropicFilteringLevel;
  }
  set anisotropicFilteringLevel(value) {
    this._cachedAnisotropicFilteringLevel = value;
  }
  /**
   * Gets or sets the comparison function (513, 514, etc). Set 0 to not use a comparison function
   */
  get comparisonFunction() {
    return this._comparisonFunction;
  }
  set comparisonFunction(value) {
    this._comparisonFunction = value;
  }
  /**
   * Indicates to use the mip maps (if available on the texture).
   * Thanks to this flag, you can instruct the sampler to not sample the mipmaps even if they exist (and if the sampling mode is set to a value that normally samples the mipmaps!)
   */
  get useMipMaps() {
    return this._useMipMaps;
  }
  set useMipMaps(value) {
    this._useMipMaps = value;
  }
  /**
   * Creates a Sampler instance
   */
  constructor() {
    this.samplingMode = -1;
    this._useMipMaps = true;
    this._cachedWrapU = null;
    this._cachedWrapV = null;
    this._cachedWrapR = null;
    this._cachedAnisotropicFilteringLevel = null;
    this._comparisonFunction = 0;
  }
  /**
   * Sets all the parameters of the sampler
   * @param wrapU u address mode (default: TEXTURE_WRAP_ADDRESSMODE)
   * @param wrapV v address mode (default: TEXTURE_WRAP_ADDRESSMODE)
   * @param wrapR r address mode (default: TEXTURE_WRAP_ADDRESSMODE)
   * @param anisotropicFilteringLevel anisotropic level (default: 1)
   * @param samplingMode sampling mode (default: 2)
   * @param comparisonFunction comparison function (default: 0 - no comparison function)
   * @returns the current sampler instance
   */
  setParameters(wrapU = 1, wrapV = 1, wrapR = 1, anisotropicFilteringLevel = 1, samplingMode = 2, comparisonFunction = 0) {
    this._cachedWrapU = wrapU;
    this._cachedWrapV = wrapV;
    this._cachedWrapR = wrapR;
    this._cachedAnisotropicFilteringLevel = anisotropicFilteringLevel;
    this.samplingMode = samplingMode;
    this._comparisonFunction = comparisonFunction;
    return this;
  }
  /**
   * Compares this sampler with another one
   * @param other sampler to compare with
   * @returns true if the samplers have the same parametres, else false
   */
  compareSampler(other) {
    return this._cachedWrapU === other._cachedWrapU && this._cachedWrapV === other._cachedWrapV && this._cachedWrapR === other._cachedWrapR && this._cachedAnisotropicFilteringLevel === other._cachedAnisotropicFilteringLevel && this.samplingMode === other.samplingMode && this._comparisonFunction === other._comparisonFunction && this._useMipMaps === other._useMipMaps;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/Textures/internalTexture.js
var InternalTextureSource;
(function(InternalTextureSource2) {
  InternalTextureSource2[InternalTextureSource2["Unknown"] = 0] = "Unknown";
  InternalTextureSource2[InternalTextureSource2["Url"] = 1] = "Url";
  InternalTextureSource2[InternalTextureSource2["Temp"] = 2] = "Temp";
  InternalTextureSource2[InternalTextureSource2["Raw"] = 3] = "Raw";
  InternalTextureSource2[InternalTextureSource2["Dynamic"] = 4] = "Dynamic";
  InternalTextureSource2[InternalTextureSource2["RenderTarget"] = 5] = "RenderTarget";
  InternalTextureSource2[InternalTextureSource2["MultiRenderTarget"] = 6] = "MultiRenderTarget";
  InternalTextureSource2[InternalTextureSource2["Cube"] = 7] = "Cube";
  InternalTextureSource2[InternalTextureSource2["CubeRaw"] = 8] = "CubeRaw";
  InternalTextureSource2[InternalTextureSource2["CubePrefiltered"] = 9] = "CubePrefiltered";
  InternalTextureSource2[InternalTextureSource2["Raw3D"] = 10] = "Raw3D";
  InternalTextureSource2[InternalTextureSource2["Raw2DArray"] = 11] = "Raw2DArray";
  InternalTextureSource2[InternalTextureSource2["DepthStencil"] = 12] = "DepthStencil";
  InternalTextureSource2[InternalTextureSource2["CubeRawRGBD"] = 13] = "CubeRawRGBD";
  InternalTextureSource2[InternalTextureSource2["Depth"] = 14] = "Depth";
})(InternalTextureSource || (InternalTextureSource = {}));
var InternalTexture = class _InternalTexture extends TextureSampler {
  /**
   * Indicates to use the mip maps (if available on the texture).
   * Thanks to this flag, you can instruct the sampler to not sample the mipmaps even if they exist (and if the sampling mode is set to a value that normally samples the mipmaps!)
   * If useMipMaps is null, the value of generateMipMaps is returned by the getter (for backward compatibility)
   */
  get useMipMaps() {
    return this._useMipMaps === null ? this.generateMipMaps : this._useMipMaps;
  }
  set useMipMaps(value) {
    this._useMipMaps = value;
  }
  /** Gets the unique id of the internal texture */
  get uniqueId() {
    return this._uniqueId;
  }
  /** @internal */
  _setUniqueId(id) {
    this._uniqueId = id;
  }
  /**
   * Gets the Engine the texture belongs to.
   * @returns The babylon engine
   */
  getEngine() {
    return this._engine;
  }
  /**
   * Gets the data source type of the texture
   */
  get source() {
    return this._source;
  }
  /**
   * Creates a new InternalTexture
   * @param engine defines the engine to use
   * @param source defines the type of data that will be used
   * @param delayAllocation if the texture allocation should be delayed (default: false)
   */
  constructor(engine, source, delayAllocation = false) {
    super();
    this.isReady = false;
    this.isCube = false;
    this.is3D = false;
    this.is2DArray = false;
    this.isMultiview = false;
    this.url = "";
    this.generateMipMaps = false;
    this._useMipMaps = null;
    this.mipLevelCount = 1;
    this.samples = 0;
    this.type = -1;
    this.format = -1;
    this.onLoadedObservable = new Observable();
    this.onErrorObservable = new Observable();
    this.onRebuildCallback = null;
    this.width = 0;
    this.height = 0;
    this.depth = 0;
    this.baseWidth = 0;
    this.baseHeight = 0;
    this.baseDepth = 0;
    this.invertY = false;
    this._invertVScale = false;
    this._associatedChannel = -1;
    this._source = 0;
    this._buffer = null;
    this._bufferView = null;
    this._bufferViewArray = null;
    this._bufferViewArrayArray = null;
    this._size = 0;
    this._extension = "";
    this._files = null;
    this._workingCanvas = null;
    this._workingContext = null;
    this._cachedCoordinatesMode = null;
    this._isDisabled = false;
    this._compression = null;
    this._sphericalPolynomial = null;
    this._sphericalPolynomialPromise = null;
    this._sphericalPolynomialComputed = false;
    this._lodGenerationScale = 0;
    this._lodGenerationOffset = 0;
    this._useSRGBBuffer = false;
    this._creationFlags = 0;
    this._lodTextureHigh = null;
    this._lodTextureMid = null;
    this._lodTextureLow = null;
    this._isRGBD = false;
    this._linearSpecularLOD = false;
    this._irradianceTexture = null;
    this._hardwareTexture = null;
    this._maxLodLevel = null;
    this._references = 1;
    this._gammaSpace = null;
    this._premulAlpha = false;
    this._dynamicTextureSource = null;
    this._autoMSAAManagement = false;
    this._engine = engine;
    this._source = source;
    this._uniqueId = _InternalTexture._Counter++;
    if (!delayAllocation) {
      this._hardwareTexture = engine._createHardwareTexture();
    }
  }
  /**
   * Increments the number of references (ie. the number of Texture that point to it)
   */
  incrementReferences() {
    this._references++;
  }
  /**
   * Change the size of the texture (not the size of the content)
   * @param width defines the new width
   * @param height defines the new height
   * @param depth defines the new depth (1 by default)
   */
  updateSize(width, height, depth = 1) {
    this._engine.updateTextureDimensions(this, width, height, depth);
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.baseWidth = width;
    this.baseHeight = height;
    this.baseDepth = depth;
    this._size = width * height * depth;
  }
  /** @internal */
  _rebuild() {
    this.isReady = false;
    this._cachedCoordinatesMode = null;
    this._cachedWrapU = null;
    this._cachedWrapV = null;
    this._cachedWrapR = null;
    this._cachedAnisotropicFilteringLevel = null;
    if (this.onRebuildCallback) {
      const data = this.onRebuildCallback(this);
      const swapAndSetIsReady = (proxyInternalTexture) => {
        proxyInternalTexture._swapAndDie(this, false);
        this.isReady = data.isReady;
      };
      if (data.isAsync) {
        data.proxy.then(swapAndSetIsReady);
      } else {
        swapAndSetIsReady(data.proxy);
      }
      return;
    }
    let proxy;
    switch (this.source) {
      case 2:
        break;
      case 1:
        proxy = this._engine.createTexture(
          this._originalUrl ?? this.url,
          !this.generateMipMaps,
          this.invertY,
          null,
          this.samplingMode,
          // Do not use Proxy here as it could be fully synchronous
          // and proxy would be undefined.
          (temp) => {
            temp._swapAndDie(this, false);
            this.isReady = true;
          },
          null,
          this._buffer,
          void 0,
          this.format,
          this._extension,
          void 0,
          void 0,
          void 0,
          this._useSRGBBuffer
        );
        return;
      case 3:
        proxy = this._engine.createRawTexture(this._bufferView, this.baseWidth, this.baseHeight, this.format, this.generateMipMaps, this.invertY, this.samplingMode, this._compression, this.type, this._creationFlags, this._useSRGBBuffer, this.mipLevelCount);
        proxy._swapAndDie(this, false);
        if (this._bufferViewArray) {
          for (let mipLevel = 0; mipLevel < this._bufferViewArray.length; mipLevel++) {
            const mipData = this._bufferViewArray[mipLevel];
            if (mipData) {
              this._engine.updateRawTexture(this, mipData, this.format, this.invertY, this._compression, this.type, this._useSRGBBuffer, mipLevel);
            }
          }
        }
        this.isReady = true;
        break;
      case 10:
        proxy = this._engine.createRawTexture3D(this._bufferView, this.baseWidth, this.baseHeight, this.baseDepth, this.format, this.generateMipMaps, this.invertY, this.samplingMode, this._compression, this.type);
        proxy._swapAndDie(this, false);
        this.isReady = true;
        break;
      case 11:
        proxy = this._engine.createRawTexture2DArray(this._bufferView, this.baseWidth, this.baseHeight, this.baseDepth, this.format, this.generateMipMaps, this.invertY, this.samplingMode, this._compression, this.type, this._creationFlags, this.mipLevelCount);
        proxy._swapAndDie(this, false);
        if (this._bufferViewArray) {
          for (let mipLevel = 0; mipLevel < this._bufferViewArray.length; mipLevel++) {
            const mipData = this._bufferViewArray[mipLevel];
            if (mipData) {
              this._engine.updateRawTexture2DArray(this, mipData, this.format, this.invertY, this._compression, this.type, mipLevel);
            }
          }
        }
        this.isReady = true;
        break;
      case 4:
        proxy = this._engine.createDynamicTexture(this.baseWidth, this.baseHeight, this.generateMipMaps, this.samplingMode);
        proxy._swapAndDie(this, false);
        if (this._dynamicTextureSource) {
          this._engine.updateDynamicTexture(this, this._dynamicTextureSource, this.invertY, this._premulAlpha, this.format, true);
        }
        break;
      case 7:
        proxy = this._engine.createCubeTexture(this.url, null, this._files, !this.generateMipMaps, () => {
          proxy._swapAndDie(this, false);
          this.isReady = true;
        }, null, this.format, this._extension, false, 0, 0, null, void 0, this._useSRGBBuffer, ArrayBuffer.isView(this._buffer) ? this._buffer : null);
        return;
      case 8:
        proxy = this._engine.createRawCubeTexture(this._bufferViewArray, this.width, this._originalFormat ?? this.format, this.type, this.generateMipMaps, this.invertY, this.samplingMode, this._compression);
        proxy._swapAndDie(this, false);
        this.isReady = true;
        break;
      case 13:
        return;
      case 9:
        proxy = this._engine.createPrefilteredCubeTexture(this.url, null, this._lodGenerationScale, this._lodGenerationOffset, (proxy2) => {
          if (proxy2) {
            proxy2._swapAndDie(this, false);
          }
          this.isReady = true;
        }, null, this.format, this._extension);
        proxy._sphericalPolynomial = this._sphericalPolynomial;
        return;
      case 12:
      case 14: {
        break;
      }
    }
  }
  /**
   * @internal
   */
  _swapAndDie(target, swapAll = true) {
    this._hardwareTexture?.setUsage(target._source, this.generateMipMaps, this.is2DArray, this.isCube, this.is3D, this.width, this.height, this.depth);
    target._hardwareTexture = this._hardwareTexture;
    if (swapAll) {
      target._isRGBD = this._isRGBD;
    }
    if (this._lodTextureHigh) {
      if (target._lodTextureHigh) {
        target._lodTextureHigh.dispose();
      }
      target._lodTextureHigh = this._lodTextureHigh;
    }
    if (this._lodTextureMid) {
      if (target._lodTextureMid) {
        target._lodTextureMid.dispose();
      }
      target._lodTextureMid = this._lodTextureMid;
    }
    if (this._lodTextureLow) {
      if (target._lodTextureLow) {
        target._lodTextureLow.dispose();
      }
      target._lodTextureLow = this._lodTextureLow;
    }
    if (this._irradianceTexture) {
      if (target._irradianceTexture) {
        target._irradianceTexture.dispose();
      }
      target._irradianceTexture = this._irradianceTexture;
    }
    const cache = this._engine.getLoadedTexturesCache();
    let index = cache.indexOf(this);
    if (index !== -1) {
      cache.splice(index, 1);
    }
    index = cache.indexOf(target);
    if (index === -1) {
      cache.push(target);
    }
  }
  /**
   * Dispose the current allocated resources
   */
  dispose() {
    this._references--;
    if (this._references === 0) {
      this.onLoadedObservable.clear();
      this.onErrorObservable.clear();
      this._engine._releaseTexture(this);
      this._hardwareTexture = null;
      this._dynamicTextureSource = null;
    }
  }
};
InternalTexture._Counter = 0;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/States/depthCullingState.js
var DepthCullingState = class {
  /**
   * Initializes the state.
   * @param reset
   */
  constructor(reset = true) {
    this._isDepthTestDirty = false;
    this._isDepthMaskDirty = false;
    this._isDepthFuncDirty = false;
    this._isCullFaceDirty = false;
    this._isCullDirty = false;
    this._isZOffsetDirty = false;
    this._isFrontFaceDirty = false;
    if (reset) {
      this.reset();
    }
  }
  get isDirty() {
    return this._isDepthFuncDirty || this._isDepthTestDirty || this._isDepthMaskDirty || this._isCullFaceDirty || this._isCullDirty || this._isZOffsetDirty || this._isFrontFaceDirty;
  }
  get zOffset() {
    return this._zOffset;
  }
  set zOffset(value) {
    if (this._zOffset === value) {
      return;
    }
    this._zOffset = value;
    this._isZOffsetDirty = true;
  }
  get zOffsetUnits() {
    return this._zOffsetUnits;
  }
  set zOffsetUnits(value) {
    if (this._zOffsetUnits === value) {
      return;
    }
    this._zOffsetUnits = value;
    this._isZOffsetDirty = true;
  }
  get cullFace() {
    return this._cullFace;
  }
  set cullFace(value) {
    if (this._cullFace === value) {
      return;
    }
    this._cullFace = value;
    this._isCullFaceDirty = true;
  }
  get cull() {
    return this._cull;
  }
  set cull(value) {
    if (this._cull === value) {
      return;
    }
    this._cull = value;
    this._isCullDirty = true;
  }
  get depthFunc() {
    return this._depthFunc;
  }
  set depthFunc(value) {
    if (this._depthFunc === value) {
      return;
    }
    this._depthFunc = value;
    this._isDepthFuncDirty = true;
  }
  get depthMask() {
    return this._depthMask;
  }
  set depthMask(value) {
    if (this._depthMask === value) {
      return;
    }
    this._depthMask = value;
    this._isDepthMaskDirty = true;
  }
  get depthTest() {
    return this._depthTest;
  }
  set depthTest(value) {
    if (this._depthTest === value) {
      return;
    }
    this._depthTest = value;
    this._isDepthTestDirty = true;
  }
  get frontFace() {
    return this._frontFace;
  }
  set frontFace(value) {
    if (this._frontFace === value) {
      return;
    }
    this._frontFace = value;
    this._isFrontFaceDirty = true;
  }
  reset() {
    this._depthMask = true;
    this._depthTest = true;
    this._depthFunc = null;
    this._cullFace = null;
    this._cull = null;
    this._zOffset = 0;
    this._zOffsetUnits = 0;
    this._frontFace = null;
    this._isDepthTestDirty = true;
    this._isDepthMaskDirty = true;
    this._isDepthFuncDirty = false;
    this._isCullFaceDirty = false;
    this._isCullDirty = false;
    this._isZOffsetDirty = true;
    this._isFrontFaceDirty = false;
  }
  apply(gl) {
    if (!this.isDirty) {
      return;
    }
    if (this._isCullDirty) {
      if (this.cull) {
        gl.enable(gl.CULL_FACE);
      } else {
        gl.disable(gl.CULL_FACE);
      }
      this._isCullDirty = false;
    }
    if (this._isCullFaceDirty) {
      gl.cullFace(this.cullFace);
      this._isCullFaceDirty = false;
    }
    if (this._isDepthMaskDirty) {
      gl.depthMask(this.depthMask);
      this._isDepthMaskDirty = false;
    }
    if (this._isDepthTestDirty) {
      if (this.depthTest) {
        gl.enable(gl.DEPTH_TEST);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }
      this._isDepthTestDirty = false;
    }
    if (this._isDepthFuncDirty) {
      gl.depthFunc(this.depthFunc);
      this._isDepthFuncDirty = false;
    }
    if (this._isZOffsetDirty) {
      if (this.zOffset || this.zOffsetUnits) {
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(this.zOffset, this.zOffsetUnits);
      } else {
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
      this._isZOffsetDirty = false;
    }
    if (this._isFrontFaceDirty) {
      gl.frontFace(this.frontFace);
      this._isFrontFaceDirty = false;
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/States/stencilStateComposer.js
var StencilStateComposer = class {
  get isDirty() {
    return this._isStencilTestDirty || this._isStencilMaskDirty || this._isStencilFuncDirty || this._isStencilOpDirty;
  }
  get func() {
    return this._func;
  }
  set func(value) {
    if (this._func === value) {
      return;
    }
    this._func = value;
    this._isStencilFuncDirty = true;
  }
  get backFunc() {
    return this._func;
  }
  set backFunc(value) {
    if (this._backFunc === value) {
      return;
    }
    this._backFunc = value;
    this._isStencilFuncDirty = true;
  }
  get funcRef() {
    return this._funcRef;
  }
  set funcRef(value) {
    if (this._funcRef === value) {
      return;
    }
    this._funcRef = value;
    this._isStencilFuncDirty = true;
  }
  get funcMask() {
    return this._funcMask;
  }
  set funcMask(value) {
    if (this._funcMask === value) {
      return;
    }
    this._funcMask = value;
    this._isStencilFuncDirty = true;
  }
  get opStencilFail() {
    return this._opStencilFail;
  }
  set opStencilFail(value) {
    if (this._opStencilFail === value) {
      return;
    }
    this._opStencilFail = value;
    this._isStencilOpDirty = true;
  }
  get opDepthFail() {
    return this._opDepthFail;
  }
  set opDepthFail(value) {
    if (this._opDepthFail === value) {
      return;
    }
    this._opDepthFail = value;
    this._isStencilOpDirty = true;
  }
  get opStencilDepthPass() {
    return this._opStencilDepthPass;
  }
  set opStencilDepthPass(value) {
    if (this._opStencilDepthPass === value) {
      return;
    }
    this._opStencilDepthPass = value;
    this._isStencilOpDirty = true;
  }
  get backOpStencilFail() {
    return this._backOpStencilFail;
  }
  set backOpStencilFail(value) {
    if (this._backOpStencilFail === value) {
      return;
    }
    this._backOpStencilFail = value;
    this._isStencilOpDirty = true;
  }
  get backOpDepthFail() {
    return this._backOpDepthFail;
  }
  set backOpDepthFail(value) {
    if (this._backOpDepthFail === value) {
      return;
    }
    this._backOpDepthFail = value;
    this._isStencilOpDirty = true;
  }
  get backOpStencilDepthPass() {
    return this._backOpStencilDepthPass;
  }
  set backOpStencilDepthPass(value) {
    if (this._backOpStencilDepthPass === value) {
      return;
    }
    this._backOpStencilDepthPass = value;
    this._isStencilOpDirty = true;
  }
  get mask() {
    return this._mask;
  }
  set mask(value) {
    if (this._mask === value) {
      return;
    }
    this._mask = value;
    this._isStencilMaskDirty = true;
  }
  get enabled() {
    return this._enabled;
  }
  set enabled(value) {
    if (this._enabled === value) {
      return;
    }
    this._enabled = value;
    this._isStencilTestDirty = true;
  }
  constructor(reset = true) {
    this._isStencilTestDirty = false;
    this._isStencilMaskDirty = false;
    this._isStencilFuncDirty = false;
    this._isStencilOpDirty = false;
    this.useStencilGlobalOnly = false;
    if (reset) {
      this.reset();
    }
  }
  reset() {
    this.stencilMaterial = void 0;
    this.stencilGlobal?.reset();
    this._isStencilTestDirty = true;
    this._isStencilMaskDirty = true;
    this._isStencilFuncDirty = true;
    this._isStencilOpDirty = true;
  }
  apply(gl) {
    if (!gl) {
      return;
    }
    const stencilMaterialEnabled = !this.useStencilGlobalOnly && !!this.stencilMaterial?.enabled;
    this.enabled = stencilMaterialEnabled ? this.stencilMaterial.enabled : this.stencilGlobal.enabled;
    this.func = stencilMaterialEnabled ? this.stencilMaterial.func : this.stencilGlobal.func;
    this.backFunc = stencilMaterialEnabled ? this.stencilMaterial.backFunc : this.stencilGlobal.backFunc;
    this.funcRef = stencilMaterialEnabled ? this.stencilMaterial.funcRef : this.stencilGlobal.funcRef;
    this.funcMask = stencilMaterialEnabled ? this.stencilMaterial.funcMask : this.stencilGlobal.funcMask;
    this.opStencilFail = stencilMaterialEnabled ? this.stencilMaterial.opStencilFail : this.stencilGlobal.opStencilFail;
    this.opDepthFail = stencilMaterialEnabled ? this.stencilMaterial.opDepthFail : this.stencilGlobal.opDepthFail;
    this.opStencilDepthPass = stencilMaterialEnabled ? this.stencilMaterial.opStencilDepthPass : this.stencilGlobal.opStencilDepthPass;
    this.backOpStencilFail = stencilMaterialEnabled ? this.stencilMaterial.backOpStencilFail : this.stencilGlobal.backOpStencilFail;
    this.backOpDepthFail = stencilMaterialEnabled ? this.stencilMaterial.backOpDepthFail : this.stencilGlobal.backOpDepthFail;
    this.backOpStencilDepthPass = stencilMaterialEnabled ? this.stencilMaterial.backOpStencilDepthPass : this.stencilGlobal.backOpStencilDepthPass;
    this.mask = stencilMaterialEnabled ? this.stencilMaterial.mask : this.stencilGlobal.mask;
    if (!this.isDirty) {
      return;
    }
    if (this._isStencilTestDirty) {
      if (this.enabled) {
        gl.enable(gl.STENCIL_TEST);
      } else {
        gl.disable(gl.STENCIL_TEST);
      }
      this._isStencilTestDirty = false;
    }
    if (this._isStencilMaskDirty) {
      gl.stencilMask(this.mask);
      this._isStencilMaskDirty = false;
    }
    if (this._isStencilFuncDirty) {
      gl.stencilFuncSeparate(gl.FRONT, this.func, this.funcRef, this.funcMask);
      gl.stencilFuncSeparate(gl.BACK, this.backFunc, this.funcRef, this.funcMask);
      this._isStencilFuncDirty = false;
    }
    if (this._isStencilOpDirty) {
      gl.stencilOpSeparate(gl.FRONT, this.opStencilFail, this.opDepthFail, this.opStencilDepthPass);
      gl.stencilOpSeparate(gl.BACK, this.backOpStencilFail, this.backOpDepthFail, this.backOpStencilDepthPass);
      this._isStencilOpDirty = false;
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/States/stencilState.js
var StencilState = class _StencilState {
  constructor() {
    this.reset();
  }
  reset() {
    this.enabled = false;
    this.mask = 255;
    this.funcRef = 1;
    this.funcMask = 255;
    this.func = _StencilState.ALWAYS;
    this.opStencilFail = _StencilState.KEEP;
    this.opDepthFail = _StencilState.KEEP;
    this.opStencilDepthPass = _StencilState.REPLACE;
    this.backFunc = _StencilState.ALWAYS;
    this.backOpStencilFail = _StencilState.KEEP;
    this.backOpDepthFail = _StencilState.KEEP;
    this.backOpStencilDepthPass = _StencilState.REPLACE;
  }
  get stencilFunc() {
    return this.func;
  }
  set stencilFunc(value) {
    this.func = value;
  }
  get stencilBackFunc() {
    return this.backFunc;
  }
  set stencilBackFunc(value) {
    this.backFunc = value;
  }
  get stencilFuncRef() {
    return this.funcRef;
  }
  set stencilFuncRef(value) {
    this.funcRef = value;
  }
  get stencilFuncMask() {
    return this.funcMask;
  }
  set stencilFuncMask(value) {
    this.funcMask = value;
  }
  get stencilOpStencilFail() {
    return this.opStencilFail;
  }
  set stencilOpStencilFail(value) {
    this.opStencilFail = value;
  }
  get stencilOpDepthFail() {
    return this.opDepthFail;
  }
  set stencilOpDepthFail(value) {
    this.opDepthFail = value;
  }
  get stencilOpStencilDepthPass() {
    return this.opStencilDepthPass;
  }
  set stencilOpStencilDepthPass(value) {
    this.opStencilDepthPass = value;
  }
  get stencilBackOpStencilFail() {
    return this.backOpStencilFail;
  }
  set stencilBackOpStencilFail(value) {
    this.backOpStencilFail = value;
  }
  get stencilBackOpDepthFail() {
    return this.backOpDepthFail;
  }
  set stencilBackOpDepthFail(value) {
    this.backOpDepthFail = value;
  }
  get stencilBackOpStencilDepthPass() {
    return this.backOpStencilDepthPass;
  }
  set stencilBackOpStencilDepthPass(value) {
    this.backOpStencilDepthPass = value;
  }
  get stencilMask() {
    return this.mask;
  }
  set stencilMask(value) {
    this.mask = value;
  }
  get stencilTest() {
    return this.enabled;
  }
  set stencilTest(value) {
    this.enabled = value;
  }
};
StencilState.ALWAYS = 519;
StencilState.KEEP = 7680;
StencilState.REPLACE = 7681;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/abstractEngine.js
function QueueNewFrame(func, requester) {
  if (!IsWindowObjectExist()) {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(func);
    }
  } else {
    const { requestAnimationFrame: requestAnimationFrame2 } = requester || window;
    if (typeof requestAnimationFrame2 === "function") {
      return requestAnimationFrame2(func);
    }
  }
  return setTimeout(func, 16);
}
var AbstractEngine = class _AbstractEngine {
  /**
   * Gets the current frame id
   */
  get frameId() {
    return this._frameId;
  }
  /**
   * Gets a boolean indicating if the engine runs in WebGPU or not.
   */
  get isWebGPU() {
    return this._isWebGPU;
  }
  /**
   * @internal
   */
  _getShaderProcessor(_shaderLanguage) {
    return this._shaderProcessor;
  }
  /**
   * @internal
   */
  _resetAlphaMode() {
    this._alphaMode.fill(-1);
    this._alphaEquation.fill(-1);
  }
  /**
   * Gets the shader platform name used by the effects.
   */
  get shaderPlatformName() {
    return this._shaderPlatformName;
  }
  _clearEmptyResources() {
    this._emptyTexture = null;
    this._emptyCubeTexture = null;
    this._emptyTexture3D = null;
    this._emptyTexture2DArray = null;
  }
  /**
   * Gets or sets a boolean indicating if depth buffer should be reverse, going from far to near.
   * This can provide greater z depth for distant objects.
   */
  get useReverseDepthBuffer() {
    return this._useReverseDepthBuffer;
  }
  set useReverseDepthBuffer(useReverse) {
    if (useReverse === this._useReverseDepthBuffer) {
      return;
    }
    this._useReverseDepthBuffer = useReverse;
    if (useReverse) {
      this._depthCullingState.depthFunc = 518;
    } else {
      this._depthCullingState.depthFunc = 515;
    }
  }
  /**
   * Enable or disable color writing
   * @param enable defines the state to set
   */
  setColorWrite(enable) {
    if (enable !== this._colorWrite) {
      this._colorWriteChanged = true;
      this._colorWrite = enable;
    }
  }
  /**
   * Gets a boolean indicating if color writing is enabled
   * @returns the current color writing state
   */
  getColorWrite() {
    return this._colorWrite;
  }
  /**
   * Gets the depth culling state manager
   */
  get depthCullingState() {
    return this._depthCullingState;
  }
  /**
   * Gets the alpha state manager
   */
  get alphaState() {
    return this._alphaState;
  }
  /**
   * Gets the stencil state manager
   */
  get stencilState() {
    return this._stencilState;
  }
  /**
   * Gets the stencil state composer
   */
  get stencilStateComposer() {
    return this._stencilStateComposer;
  }
  /** @internal */
  _getGlobalDefines(defines) {
    if (defines) {
      if (this.isNDCHalfZRange) {
        defines["IS_NDC_HALF_ZRANGE"] = "";
      } else {
        delete defines["IS_NDC_HALF_ZRANGE"];
      }
      if (this.useReverseDepthBuffer) {
        defines["USE_REVERSE_DEPTHBUFFER"] = "";
      } else {
        delete defines["USE_REVERSE_DEPTHBUFFER"];
      }
      if (this.useExactSrgbConversions) {
        defines["USE_EXACT_SRGB_CONVERSIONS"] = "";
      } else {
        delete defines["USE_EXACT_SRGB_CONVERSIONS"];
      }
      return;
    } else {
      let s = "";
      if (this.isNDCHalfZRange) {
        s += "#define IS_NDC_HALF_ZRANGE";
      }
      if (this.useReverseDepthBuffer) {
        if (s) {
          s += "\n";
        }
        s += "#define USE_REVERSE_DEPTHBUFFER";
      }
      if (this.useExactSrgbConversions) {
        if (s) {
          s += "\n";
        }
        s += "#define USE_EXACT_SRGB_CONVERSIONS";
      }
      return s;
    }
  }
  _rebuildInternalTextures() {
    const currentState = this._internalTexturesCache.slice();
    for (const internalTexture of currentState) {
      internalTexture._rebuild();
    }
  }
  _rebuildRenderTargetWrappers() {
    const currentState = this._renderTargetWrapperCache.slice();
    for (const renderTargetWrapper of currentState) {
      renderTargetWrapper._rebuild();
    }
  }
  _rebuildEffects() {
    for (const key in this._compiledEffects) {
      const effect = this._compiledEffects[key];
      effect._pipelineContext = null;
      effect._prepareEffect();
    }
    Effect.ResetCache();
  }
  _rebuildGraphicsResources() {
    this.wipeCaches(true);
    this._rebuildEffects();
    this._rebuildComputeEffects?.();
    this._rebuildBuffers();
    this._rebuildInternalTextures();
    this._rebuildTextures();
    this._rebuildRenderTargetWrappers();
    this.wipeCaches(true);
  }
  _flagContextRestored() {
    Logger.Warn(this.name + " context successfully restored.");
    this.onContextRestoredObservable.notifyObservers(this);
    this._contextWasLost = false;
  }
  _restoreEngineAfterContextLost(initEngine) {
    setTimeout(() => {
      this._clearEmptyResources();
      const depthTest = this._depthCullingState.depthTest;
      const depthFunc = this._depthCullingState.depthFunc;
      const depthMask = this._depthCullingState.depthMask;
      const stencilTest = this._stencilState.stencilTest;
      initEngine();
      this._rebuildGraphicsResources();
      this._depthCullingState.depthTest = depthTest;
      this._depthCullingState.depthFunc = depthFunc;
      this._depthCullingState.depthMask = depthMask;
      this._stencilState.stencilTest = stencilTest;
      this._flagContextRestored();
    }, 0);
  }
  /** Gets a boolean indicating if the engine was disposed */
  get isDisposed() {
    return this._isDisposed;
  }
  /**
   * Enables or disables the snapshot rendering mode
   * Note that the WebGL engine does not support snapshot rendering so setting the value won't have any effect for this engine
   */
  get snapshotRendering() {
    return false;
  }
  set snapshotRendering(activate) {
  }
  /**
   * Gets or sets the snapshot rendering mode
   */
  get snapshotRenderingMode() {
    return 0;
  }
  set snapshotRenderingMode(mode) {
  }
  /**
   * Returns the string "AbstractEngine"
   * @returns "AbstractEngine"
   */
  getClassName() {
    return "AbstractEngine";
  }
  /**
   * Gets the default empty texture
   */
  get emptyTexture() {
    if (!this._emptyTexture) {
      this._emptyTexture = this.createRawTexture(new Uint8Array(4), 1, 1, 5, false, false, 1);
    }
    return this._emptyTexture;
  }
  /**
   * Gets the default empty 3D texture
   */
  get emptyTexture3D() {
    if (!this._emptyTexture3D) {
      this._emptyTexture3D = this.createRawTexture3D(new Uint8Array(4), 1, 1, 1, 5, false, false, 1);
    }
    return this._emptyTexture3D;
  }
  /**
   * Gets the default empty 2D array texture
   */
  get emptyTexture2DArray() {
    if (!this._emptyTexture2DArray) {
      this._emptyTexture2DArray = this.createRawTexture2DArray(new Uint8Array(4), 1, 1, 1, 5, false, false, 1);
    }
    return this._emptyTexture2DArray;
  }
  /**
   * Gets the default empty cube texture
   */
  get emptyCubeTexture() {
    if (!this._emptyCubeTexture) {
      const faceData = new Uint8Array(4);
      const cubeData = [faceData, faceData, faceData, faceData, faceData, faceData];
      this._emptyCubeTexture = this.createRawCubeTexture(cubeData, 1, 5, 0, false, false, 1);
    }
    return this._emptyCubeTexture;
  }
  /**
   * Gets the list of current active render loop functions
   * @returns a read only array with the current render loop functions
   */
  get activeRenderLoops() {
    return this._activeRenderLoops;
  }
  /**
   * stop executing a render loop function and remove it from the execution array
   * @param renderFunction defines the function to be removed. If not provided all functions will be removed.
   */
  stopRenderLoop(renderFunction) {
    if (!renderFunction) {
      this._activeRenderLoops.length = 0;
      this._cancelFrame();
      return;
    }
    const index = this._activeRenderLoops.indexOf(renderFunction);
    if (index >= 0) {
      this._activeRenderLoops.splice(index, 1);
      if (this._activeRenderLoops.length == 0) {
        this._cancelFrame();
      }
    }
  }
  _cancelFrame() {
    if (this._frameHandler !== 0) {
      const handlerToCancel = this._frameHandler;
      this._frameHandler = 0;
      if (!IsWindowObjectExist()) {
        if (typeof cancelAnimationFrame === "function") {
          return cancelAnimationFrame(handlerToCancel);
        }
      } else {
        const { cancelAnimationFrame: cancelAnimationFrame2 } = this.getHostWindow() || window;
        if (typeof cancelAnimationFrame2 === "function") {
          return cancelAnimationFrame2(handlerToCancel);
        }
      }
      return clearTimeout(handlerToCancel);
    }
  }
  /**
   * Begin a new frame
   */
  beginFrame() {
    this.onBeginFrameObservable.notifyObservers(this);
  }
  /**
   * End the current frame
   */
  endFrame() {
    this._frameId++;
    this.onEndFrameObservable.notifyObservers(this);
  }
  /** Gets or sets max frame per second allowed. Will return undefined if not capped */
  get maxFPS() {
    return this._maxFPS;
  }
  set maxFPS(value) {
    this._maxFPS = value;
    if (value === void 0) {
      return;
    }
    if (value <= 0) {
      this._minFrameTime = Number.MAX_VALUE;
      return;
    }
    this._minFrameTime = 1e3 / value;
  }
  _isOverFrameTime(timestamp) {
    if (!timestamp || this._maxFPS === void 0) {
      return false;
    }
    const elapsedTime = timestamp - this._lastFrameTime;
    this._lastFrameTime = timestamp;
    this._renderAccumulator += elapsedTime;
    if (this._renderAccumulator < this._minFrameTime) {
      return true;
    }
    this._renderAccumulator -= this._minFrameTime;
    if (this._renderAccumulator > this._minFrameTime) {
      this._renderAccumulator = this._minFrameTime;
    }
    return false;
  }
  _processFrame(timestamp) {
    this._frameHandler = 0;
    if (!this._contextWasLost && !this._isOverFrameTime(timestamp)) {
      let shouldRender = true;
      if (this.isDisposed || !this.renderEvenInBackground && this._windowIsBackground) {
        shouldRender = false;
      }
      if (shouldRender) {
        this.beginFrame();
        if (!this.skipFrameRender && !this._renderViews()) {
          this._renderFrame();
        }
        this.endFrame();
      }
    }
  }
  /** @internal */
  _renderLoop(timestamp) {
    this._processFrame(timestamp);
    if (this._activeRenderLoops.length > 0 && this._frameHandler === 0) {
      this._frameHandler = this._queueNewFrame(this._boundRenderFunction, this.getHostWindow());
    }
  }
  /** @internal */
  _renderFrame() {
    for (let index = 0; index < this._activeRenderLoops.length; index++) {
      const renderFunction = this._activeRenderLoops[index];
      renderFunction();
    }
  }
  /** @internal */
  _renderViews() {
    return false;
  }
  /**
   * Can be used to override the current requestAnimationFrame requester.
   * @internal
   */
  _queueNewFrame(bindedRenderFunction, requester) {
    return QueueNewFrame(bindedRenderFunction, requester);
  }
  /**
   * Register and execute a render loop. The engine can have more than one render function
   * @param renderFunction defines the function to continuously execute
   */
  runRenderLoop(renderFunction) {
    if (this._activeRenderLoops.indexOf(renderFunction) !== -1) {
      return;
    }
    this._activeRenderLoops.push(renderFunction);
    if (this._activeRenderLoops.length === 1 && this._frameHandler === 0) {
      this._frameHandler = this._queueNewFrame(this._boundRenderFunction, this.getHostWindow());
    }
  }
  /**
   * Gets a boolean indicating if depth testing is enabled
   * @returns the current state
   */
  getDepthBuffer() {
    return this._depthCullingState.depthTest;
  }
  /**
   * Enable or disable depth buffering
   * @param enable defines the state to set
   */
  setDepthBuffer(enable) {
    this._depthCullingState.depthTest = enable;
  }
  /**
   * Set the z offset Factor to apply to current rendering
   * @param value defines the offset to apply
   */
  setZOffset(value) {
    this._depthCullingState.zOffset = this.useReverseDepthBuffer ? -value : value;
  }
  /**
   * Gets the current value of the zOffset Factor
   * @returns the current zOffset Factor state
   */
  getZOffset() {
    const zOffset = this._depthCullingState.zOffset;
    return this.useReverseDepthBuffer ? -zOffset : zOffset;
  }
  /**
   * Set the z offset Units to apply to current rendering
   * @param value defines the offset to apply
   */
  setZOffsetUnits(value) {
    this._depthCullingState.zOffsetUnits = this.useReverseDepthBuffer ? -value : value;
  }
  /**
   * Gets the current value of the zOffset Units
   * @returns the current zOffset Units state
   */
  getZOffsetUnits() {
    const zOffsetUnits = this._depthCullingState.zOffsetUnits;
    return this.useReverseDepthBuffer ? -zOffsetUnits : zOffsetUnits;
  }
  /**
   * Gets host window
   * @returns the host window object
   */
  getHostWindow() {
    if (!IsWindowObjectExist()) {
      return null;
    }
    if (this._renderingCanvas && this._renderingCanvas.ownerDocument && this._renderingCanvas.ownerDocument.defaultView) {
      return this._renderingCanvas.ownerDocument.defaultView;
    }
    return window;
  }
  /**
   * (WebGPU only) True (default) to be in compatibility mode, meaning rendering all existing scenes without artifacts (same rendering than WebGL).
   * Setting the property to false will improve performances but may not work in some scenes if some precautions are not taken.
   * See https://doc.babylonjs.com/setup/support/webGPU/webGPUOptimization/webGPUNonCompatibilityMode for more details
   */
  get compatibilityMode() {
    return this._compatibilityMode;
  }
  set compatibilityMode(mode) {
    this._compatibilityMode = true;
  }
  _rebuildTextures() {
    for (const scene of this.scenes) {
      scene._rebuildTextures();
    }
    for (const scene of this._virtualScenes) {
      scene._rebuildTextures();
    }
  }
  /**
   * @internal
   */
  _releaseRenderTargetWrapper(rtWrapper) {
    const index = this._renderTargetWrapperCache.indexOf(rtWrapper);
    if (index !== -1) {
      this._renderTargetWrapperCache.splice(index, 1);
    }
  }
  /**
   * Gets the current viewport
   */
  get currentViewport() {
    return this._cachedViewport;
  }
  /**
   * Set the WebGL's viewport
   * @param viewport defines the viewport element to be used
   * @param requiredWidth defines the width required for rendering. If not provided the rendering canvas' width is used
   * @param requiredHeight defines the height required for rendering. If not provided the rendering canvas' height is used
   */
  setViewport(viewport, requiredWidth, requiredHeight) {
    const width = requiredWidth || this.getRenderWidth();
    const height = requiredHeight || this.getRenderHeight();
    const x = viewport.x || 0;
    const y = viewport.y || 0;
    this._cachedViewport = viewport;
    this._viewport(x * width, y * height, width * viewport.width, height * viewport.height);
  }
  /**
   * Create an image to use with canvas
   * @returns IImage interface
   */
  createCanvasImage() {
    return document.createElement("img");
  }
  /**
   * Create a 2D path to use with canvas
   * @returns IPath2D interface
   * @param d SVG path string
   */
  createCanvasPath2D(d) {
    return new Path2D(d);
  }
  /**
   * Returns a string describing the current engine
   */
  get description() {
    let description = this.name + this.version;
    if (this._caps.parallelShaderCompile) {
      description += " - Parallel shader compilation";
    }
    return description;
  }
  _createTextureBase(url, noMipmap, invertY, scene, samplingMode = 3, onLoad = null, onError = null, prepareTexture, prepareTextureProcess, buffer = null, fallback = null, format = null, forcedExtension = null, mimeType, loaderOptions, useSRGBBuffer) {
    url = url || "";
    const fromData = url.substring(0, 5) === "data:";
    const fromBlob = url.substring(0, 5) === "blob:";
    const isBase64 = fromData && url.indexOf(";base64,") !== -1;
    const texture = fallback ? fallback : new InternalTexture(
      this,
      1
      /* InternalTextureSource.Url */
    );
    if (texture !== fallback) {
      texture.label = url.substring(0, 60);
    }
    const originalUrl = url;
    if (this._transformTextureUrl && !isBase64 && !fallback && !buffer) {
      url = this._transformTextureUrl(url);
    }
    if (originalUrl !== url) {
      texture._originalUrl = originalUrl;
    }
    const lastDot = url.lastIndexOf(".");
    let extension = forcedExtension ? forcedExtension : lastDot > -1 ? url.substring(lastDot).toLowerCase() : "";
    const queryStringIndex = extension.indexOf("?");
    if (queryStringIndex > -1) {
      extension = extension.split("?")[0];
    }
    const loaderPromise = _AbstractEngine.GetCompatibleTextureLoader(extension, mimeType);
    if (scene) {
      scene.addPendingData(texture);
    }
    texture.url = url;
    texture.generateMipMaps = !noMipmap;
    texture.samplingMode = samplingMode;
    texture.invertY = invertY;
    texture._useSRGBBuffer = this._getUseSRGBBuffer(!!useSRGBBuffer, noMipmap);
    if (!this._doNotHandleContextLost) {
      texture._buffer = buffer;
    }
    let onLoadObserver = null;
    if (onLoad && !fallback) {
      onLoadObserver = texture.onLoadedObservable.add(onLoad);
    }
    if (!fallback) {
      this._internalTexturesCache.push(texture);
    }
    const onInternalError = (message, exception) => {
      if (scene) {
        scene.removePendingData(texture);
      }
      if (url === originalUrl) {
        if (onLoadObserver) {
          texture.onLoadedObservable.remove(onLoadObserver);
        }
        if (EngineStore.UseFallbackTexture && url !== EngineStore.FallbackTexture) {
          this._createTextureBase(EngineStore.FallbackTexture, noMipmap, texture.invertY, scene, samplingMode, null, onError, prepareTexture, prepareTextureProcess, buffer, texture);
        }
        message = (message || "Unknown error") + (EngineStore.UseFallbackTexture ? " - Fallback texture was used" : "");
        texture.onErrorObservable.notifyObservers({ message, exception });
        if (onError) {
          onError(message, exception);
        }
      } else {
        Logger.Warn(`Failed to load ${url}, falling back to ${originalUrl}`);
        this._createTextureBase(originalUrl, noMipmap, texture.invertY, scene, samplingMode, onLoad, onError, prepareTexture, prepareTextureProcess, buffer, texture, format, forcedExtension, mimeType, loaderOptions, useSRGBBuffer);
      }
    };
    if (loaderPromise) {
      const callbackAsync = async (data) => {
        const loader = await loaderPromise;
        loader.loadData(data, texture, (width, height, loadMipmap, isCompressed, done, loadFailed) => {
          if (loadFailed) {
            onInternalError("TextureLoader failed to load data");
          } else {
            prepareTexture(texture, extension, scene, { width, height }, texture.invertY, !loadMipmap, isCompressed, () => {
              done();
              return false;
            }, samplingMode);
          }
        }, loaderOptions);
      };
      if (!buffer) {
        this._loadFile(url, (data) => {
          callbackAsync(new Uint8Array(data));
        }, void 0, scene ? scene.offlineProvider : void 0, true, (request, exception) => {
          onInternalError("Unable to load " + (request ? request.responseURL : url, exception));
        });
      } else {
        if (buffer instanceof ArrayBuffer) {
          callbackAsync(new Uint8Array(buffer));
        } else if (ArrayBuffer.isView(buffer)) {
          callbackAsync(buffer);
        } else {
          if (onError) {
            onError("Unable to load: only ArrayBuffer or ArrayBufferView is supported", null);
          }
        }
      }
    } else {
      const onload = (img) => {
        if (fromBlob && !this._doNotHandleContextLost) {
          texture._buffer = img;
        }
        prepareTexture(texture, extension, scene, img, texture.invertY, noMipmap, false, prepareTextureProcess, samplingMode);
      };
      if (!fromData || isBase64) {
        if (buffer && (typeof buffer.decoding === "string" || buffer.close)) {
          onload(buffer);
        } else {
          _AbstractEngine._FileToolsLoadImage(url || "", onload, onInternalError, scene ? scene.offlineProvider : null, mimeType, texture.invertY && this._features.needsInvertingBitmap ? { imageOrientation: "flipY" } : void 0, this);
        }
      } else if (typeof buffer === "string" || buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer) || buffer instanceof Blob) {
        _AbstractEngine._FileToolsLoadImage(buffer, onload, onInternalError, scene ? scene.offlineProvider : null, mimeType, texture.invertY && this._features.needsInvertingBitmap ? { imageOrientation: "flipY" } : void 0, this);
      } else if (buffer) {
        onload(buffer);
      }
    }
    return texture;
  }
  _rebuildBuffers() {
    for (const uniformBuffer of this._uniformBuffers) {
      uniformBuffer._rebuildAfterContextLost();
    }
  }
  /** @internal */
  get _shouldUseHighPrecisionShader() {
    return !!(this._caps.highPrecisionShaderSupported && this._highPrecisionShadersAllowed);
  }
  /**
   * Gets host document
   * @returns the host document object
   */
  getHostDocument() {
    if (this._renderingCanvas && this._renderingCanvas.ownerDocument) {
      return this._renderingCanvas.ownerDocument;
    }
    return IsDocumentAvailable() ? document : null;
  }
  /**
   * Gets the list of loaded textures
   * @returns an array containing all loaded textures
   */
  getLoadedTexturesCache() {
    return this._internalTexturesCache;
  }
  /**
   * Clears the list of texture accessible through engine.
   * This can help preventing texture load conflict due to name collision.
   */
  clearInternalTexturesCache() {
    this._internalTexturesCache.length = 0;
  }
  /**
   * Gets the object containing all engine capabilities
   * @returns the EngineCapabilities object
   */
  getCaps() {
    return this._caps;
  }
  /**
   * Reset the texture cache to empty state
   */
  resetTextureCache() {
    for (const key in this._boundTexturesCache) {
      if (!Object.prototype.hasOwnProperty.call(this._boundTexturesCache, key)) {
        continue;
      }
      this._boundTexturesCache[key] = null;
    }
    this._currentTextureChannel = -1;
  }
  /**
   * Gets or sets the name of the engine
   */
  get name() {
    return this._name;
  }
  set name(value) {
    this._name = value;
  }
  /**
   * Returns the current npm package of the sdk
   */
  // Not mixed with Version for tooling purpose.
  static get NpmPackage() {
    return "babylonjs@8.49.1";
  }
  /**
   * Returns the current version of the framework
   */
  static get Version() {
    return "8.49.1";
  }
  /**
   * Gets the HTML canvas attached with the current webGL context
   * @returns a HTML canvas
   */
  getRenderingCanvas() {
    return this._renderingCanvas;
  }
  /**
   * Gets the audio context specified in engine initialization options
   * @deprecated please use AudioEngineV2 instead
   * @returns an Audio Context
   */
  getAudioContext() {
    return this._audioContext;
  }
  /**
   * Gets the audio destination specified in engine initialization options
   * @deprecated please use AudioEngineV2 instead
   * @returns an audio destination node
   */
  getAudioDestination() {
    return this._audioDestination;
  }
  /**
   * Defines the hardware scaling level.
   * By default the hardware scaling level is computed from the window device ratio.
   * if level = 1 then the engine will render at the exact resolution of the canvas. If level = 0.5 then the engine will render at twice the size of the canvas.
   * @param level defines the level to use
   */
  setHardwareScalingLevel(level) {
    this._hardwareScalingLevel = level;
    this.resize();
  }
  /**
   * Gets the current hardware scaling level.
   * By default the hardware scaling level is computed from the window device ratio.
   * if level = 1 then the engine will render at the exact resolution of the canvas. If level = 0.5 then the engine will render at twice the size of the canvas.
   * @returns a number indicating the current hardware scaling level
   */
  getHardwareScalingLevel() {
    return this._hardwareScalingLevel;
  }
  /**
   * Gets or sets a boolean indicating if resources should be retained to be able to handle context lost events
   * @see https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene#handling-webgl-context-lost
   */
  get doNotHandleContextLost() {
    return this._doNotHandleContextLost;
  }
  set doNotHandleContextLost(value) {
    this._doNotHandleContextLost = value;
  }
  /**
   * Returns true if the stencil buffer has been enabled through the creation option of the context.
   */
  get isStencilEnable() {
    return this._isStencilEnable;
  }
  /**
   * Gets the options used for engine creation
   * NOTE that modifying the object after engine creation will have no effect
   * @returns EngineOptions object
   */
  getCreationOptions() {
    return this._creationOptions;
  }
  /**
   * Creates a new engine
   * @param antialias defines whether anti-aliasing should be enabled. If undefined, it means that the underlying engine is free to enable it or not
   * @param options defines further options to be sent to the creation context
   * @param adaptToDeviceRatio defines whether to adapt to the device's viewport characteristics (default: false)
   */
  constructor(antialias, options, adaptToDeviceRatio) {
    this._colorWrite = true;
    this._colorWriteChanged = true;
    this._depthCullingState = new DepthCullingState();
    this._stencilStateComposer = new StencilStateComposer();
    this._stencilState = new StencilState();
    this._alphaState = new AlphaState(false);
    this._alphaMode = Array(8).fill(-1);
    this._alphaEquation = Array(8).fill(-1);
    this._activeRequests = [];
    this._badOS = false;
    this._badDesktopOS = false;
    this._compatibilityMode = true;
    this._internalTexturesCache = new Array();
    this._currentRenderTarget = null;
    this._boundTexturesCache = {};
    this._activeChannel = 0;
    this._currentTextureChannel = -1;
    this._viewportCached = { x: 0, y: 0, z: 0, w: 0 };
    this._isWebGPU = false;
    this._enableGPUDebugMarkers = false;
    this.onCanvasBlurObservable = new Observable();
    this.onCanvasFocusObservable = new Observable();
    this.onNewSceneAddedObservable = new Observable();
    this.onResizeObservable = new Observable();
    this.onCanvasPointerOutObservable = new Observable();
    this.onEffectErrorObservable = new Observable();
    this.disablePerformanceMonitorInBackground = false;
    this.disableVertexArrayObjects = false;
    this._frameId = 0;
    this.hostInformation = {
      isMobile: false
    };
    this.isFullscreen = false;
    this.enableOfflineSupport = false;
    this.disableManifestCheck = false;
    this.disableContextMenu = true;
    this.currentRenderPassId = 0;
    this.isPointerLock = false;
    this.postProcesses = [];
    this.canvasTabIndex = 1;
    this._contextWasLost = false;
    this._useReverseDepthBuffer = false;
    this.isNDCHalfZRange = false;
    this.hasOriginBottomLeft = true;
    this._renderTargetWrapperCache = new Array();
    this._compiledEffects = {};
    this._isDisposed = false;
    this.scenes = [];
    this._virtualScenes = new Array();
    this.onBeforeTextureInitObservable = new Observable();
    this.renderEvenInBackground = true;
    this.preventCacheWipeBetweenFrames = false;
    this._frameHandler = 0;
    this._activeRenderLoops = new Array();
    this._windowIsBackground = false;
    this._boundRenderFunction = (timestamp) => this._renderLoop(timestamp);
    this._lastFrameTime = 0;
    this._renderAccumulator = 0;
    this.skipFrameRender = false;
    this.onBeforeShaderCompilationObservable = new Observable();
    this.onAfterShaderCompilationObservable = new Observable();
    this.onBeginFrameObservable = new Observable();
    this.onEndFrameObservable = new Observable();
    this._transformTextureUrl = null;
    this._uniformBuffers = new Array();
    this._storageBuffers = new Array();
    this._highPrecisionShadersAllowed = true;
    this.onContextLostObservable = new Observable();
    this.onContextRestoredObservable = new Observable();
    this._name = "";
    this.premultipliedAlpha = true;
    this.adaptToDeviceRatio = false;
    this._lastDevicePixelRatio = 1;
    this._doNotHandleContextLost = false;
    this.cullBackFaces = null;
    this._renderPassNames = ["main"];
    this._fps = 60;
    this._deltaTime = 0;
    this._deterministicLockstep = false;
    this._lockstepMaxSteps = 4;
    this._timeStep = 1 / 60;
    this.onDisposeObservable = new Observable();
    this.onReleaseEffectsObservable = new Observable();
    EngineStore.Instances.push(this);
    this.startTime = PrecisionDate.Now;
    this._stencilStateComposer.stencilGlobal = this._stencilState;
    PerformanceConfigurator.SetMatrixPrecision(!!options.useLargeWorldRendering || !!options.useHighPrecisionMatrix);
    if (IsNavigatorAvailable() && navigator.userAgent) {
      this._badOS = /iPad/i.test(navigator.userAgent) || /iPhone/i.test(navigator.userAgent);
      this._badDesktopOS = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }
    this.adaptToDeviceRatio = adaptToDeviceRatio ?? false;
    options.antialias = antialias ?? options.antialias;
    options.deterministicLockstep = options.deterministicLockstep ?? false;
    options.lockstepMaxSteps = options.lockstepMaxSteps ?? 4;
    options.timeStep = options.timeStep ?? 1 / 60;
    options.stencil = options.stencil ?? true;
    this._audioContext = options.audioEngineOptions?.audioContext ?? null;
    this._audioDestination = options.audioEngineOptions?.audioDestination ?? null;
    this.premultipliedAlpha = options.premultipliedAlpha ?? true;
    this._doNotHandleContextLost = !!options.doNotHandleContextLost;
    this._isStencilEnable = options.stencil ? true : false;
    this.useExactSrgbConversions = options.useExactSrgbConversions ?? false;
    const devicePixelRatio = IsWindowObjectExist() ? window.devicePixelRatio || 1 : 1;
    const limitDeviceRatio = options.limitDeviceRatio || devicePixelRatio;
    adaptToDeviceRatio = adaptToDeviceRatio || options.adaptToDeviceRatio || false;
    this._hardwareScalingLevel = adaptToDeviceRatio ? 1 / Math.min(limitDeviceRatio, devicePixelRatio) : 1;
    this._lastDevicePixelRatio = devicePixelRatio;
    this._creationOptions = options;
  }
  /**
   * Resize the view according to the canvas' size
   * @param forceSetSize true to force setting the sizes of the underlying canvas
   */
  resize(forceSetSize = false) {
    let width;
    let height;
    if (this.adaptToDeviceRatio) {
      const devicePixelRatio = IsWindowObjectExist() ? window.devicePixelRatio || 1 : 1;
      const changeRatio = this._lastDevicePixelRatio / devicePixelRatio;
      this._lastDevicePixelRatio = devicePixelRatio;
      this._hardwareScalingLevel *= changeRatio;
    }
    if (IsWindowObjectExist() && IsDocumentAvailable()) {
      if (this._renderingCanvas) {
        const boundingRect = this._renderingCanvas.getBoundingClientRect?.();
        width = this._renderingCanvas.clientWidth || boundingRect?.width || this._renderingCanvas.width * this._hardwareScalingLevel || 100;
        height = this._renderingCanvas.clientHeight || boundingRect?.height || this._renderingCanvas.height * this._hardwareScalingLevel || 100;
      } else {
        width = window.innerWidth;
        height = window.innerHeight;
      }
    } else {
      width = this._renderingCanvas ? this._renderingCanvas.width : 100;
      height = this._renderingCanvas ? this._renderingCanvas.height : 100;
    }
    this.setSize(width / this._hardwareScalingLevel, height / this._hardwareScalingLevel, forceSetSize);
  }
  /**
   * Force a specific size of the canvas
   * @param width defines the new canvas' width
   * @param height defines the new canvas' height
   * @param forceSetSize true to force setting the sizes of the underlying canvas
   * @returns true if the size was changed
   */
  setSize(width, height, forceSetSize = false) {
    if (!this._renderingCanvas) {
      return false;
    }
    width = width | 0;
    height = height | 0;
    if (!forceSetSize && this._renderingCanvas.width === width && this._renderingCanvas.height === height) {
      return false;
    }
    this._renderingCanvas.width = width;
    this._renderingCanvas.height = height;
    if (this.scenes) {
      for (let index = 0; index < this.scenes.length; index++) {
        const scene = this.scenes[index];
        for (let camIndex = 0; camIndex < scene.cameras.length; camIndex++) {
          const cam = scene.cameras[camIndex];
          cam._currentRenderId = 0;
        }
      }
      if (this.onResizeObservable.hasObservers()) {
        this.onResizeObservable.notifyObservers(this);
      }
    }
    return true;
  }
  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Creates a raw texture
   * @param data defines the data to store in the texture
   * @param width defines the width of the texture
   * @param height defines the height of the texture
   * @param format defines the format of the data
   * @param generateMipMaps defines if the engine should generate the mip levels
   * @param invertY defines if data must be stored with Y axis inverted
   * @param samplingMode defines the required sampling mode (Texture.NEAREST_SAMPLINGMODE by default)
   * @param compression defines the compression used (null by default)
   * @param type defines the type fo the data (Engine.TEXTURETYPE_UNSIGNED_BYTE by default)
   * @param creationFlags specific flags to use when creating the texture (1 for storage textures, for eg)
   * @param useSRGBBuffer defines if the texture must be loaded in a sRGB GPU buffer (if supported by the GPU).
   * @param mipLevelCount defines the number of mip levels to allocate for the texture
   * @returns the raw texture inside an InternalTexture
   */
  createRawTexture(data, width, height, format, generateMipMaps, invertY, samplingMode, compression, type, creationFlags, useSRGBBuffer, mipLevelCount) {
    throw _WarnImport("engine.rawTexture");
  }
  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Creates a new raw cube texture
   * @param data defines the array of data to use to create each face
   * @param size defines the size of the textures
   * @param format defines the format of the data
   * @param type defines the type of the data (like Engine.TEXTURETYPE_UNSIGNED_BYTE)
   * @param generateMipMaps  defines if the engine should generate the mip levels
   * @param invertY defines if data must be stored with Y axis inverted
   * @param samplingMode defines the required sampling mode (like Texture.NEAREST_SAMPLINGMODE)
   * @param compression defines the compression used (null by default)
   * @returns the cube texture as an InternalTexture
   */
  createRawCubeTexture(data, size, format, type, generateMipMaps, invertY, samplingMode, compression) {
    throw _WarnImport("engine.rawTexture");
  }
  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Creates a new raw 3D texture
   * @param data defines the data used to create the texture
   * @param width defines the width of the texture
   * @param height defines the height of the texture
   * @param depth defines the depth of the texture
   * @param format defines the format of the texture
   * @param generateMipMaps defines if the engine must generate mip levels
   * @param invertY defines if data must be stored with Y axis inverted
   * @param samplingMode defines the required sampling mode (like Texture.NEAREST_SAMPLINGMODE)
   * @param compression defines the compressed used (can be null)
   * @param textureType defines the compressed used (can be null)
   * @param creationFlags specific flags to use when creating the texture (1 for storage textures, for eg)
   * @returns a new raw 3D texture (stored in an InternalTexture)
   */
  createRawTexture3D(data, width, height, depth, format, generateMipMaps, invertY, samplingMode, compression, textureType, creationFlags) {
    throw _WarnImport("engine.rawTexture");
  }
  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Creates a new raw 2D array texture
   * @param data defines the data used to create the texture
   * @param width defines the width of the texture
   * @param height defines the height of the texture
   * @param depth defines the number of layers of the texture
   * @param format defines the format of the texture
   * @param generateMipMaps defines if the engine must generate mip levels
   * @param invertY defines if data must be stored with Y axis inverted
   * @param samplingMode defines the required sampling mode (like Texture.NEAREST_SAMPLINGMODE)
   * @param compression defines the compressed used (can be null)
   * @param textureType defines the compressed used (can be null)
   * @param creationFlags specific flags to use when creating the texture (1 for storage textures, for eg)
   * @param mipLevelCount defines the number of mip levels to allocate for the texture
   * @returns a new raw 2D array texture (stored in an InternalTexture)
   */
  createRawTexture2DArray(data, width, height, depth, format, generateMipMaps, invertY, samplingMode, compression, textureType, creationFlags, mipLevelCount) {
    throw _WarnImport("engine.rawTexture");
  }
  /**
   * Shared initialization across engines types.
   * @param canvas The canvas associated with this instance of the engine.
   */
  _sharedInit(canvas) {
    this._renderingCanvas = canvas;
  }
  _setupMobileChecks() {
    if (!(navigator && navigator.userAgent)) {
      return;
    }
    this._checkForMobile = () => {
      const currentUa = navigator.userAgent;
      this.hostInformation.isMobile = currentUa.indexOf("Mobile") !== -1 || // Needed for iOS 13+ detection on iPad (inspired by solution from https://stackoverflow.com/questions/9038625/detect-if-device-is-ios)
      currentUa.indexOf("Mac") !== -1 && IsDocumentAvailable() && "ontouchend" in document;
    };
    this._checkForMobile();
    if (IsWindowObjectExist()) {
      window.addEventListener("resize", this._checkForMobile);
    }
  }
  /**
   * creates and returns a new video element
   * @param constraints video constraints
   * @returns video element
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createVideoElement(constraints) {
    return document.createElement("video");
  }
  /**
   * @internal
   */
  _reportDrawCall(numDrawCalls = 1) {
    this._drawCalls?.addCount(numDrawCalls, false);
  }
  /**
   * Gets the current framerate
   * @returns a number representing the framerate
   */
  getFps() {
    return this._fps;
  }
  /**
   * Gets the time spent between current and previous frame
   * @returns a number representing the delta time in ms
   */
  getDeltaTime() {
    return this._deltaTime;
  }
  /**
   * Gets a boolean indicating that the engine is running in deterministic lock step mode
   * @see https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations#deterministic-lockstep
   * @returns true if engine is in deterministic lock step mode
   */
  isDeterministicLockStep() {
    return this._deterministicLockstep;
  }
  /**
   * Gets the max steps when engine is running in deterministic lock step
   * @see https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations#deterministic-lockstep
   * @returns the max steps
   */
  getLockstepMaxSteps() {
    return this._lockstepMaxSteps;
  }
  /**
   * Returns the time in ms between steps when using deterministic lock step.
   * @returns time step in (ms)
   */
  getTimeStep() {
    return this._timeStep * 1e3;
  }
  /**
   * Engine abstraction for loading and creating an image bitmap from a given source string.
   * @param imageSource source to load the image from.
   * @param options An object that sets options for the image's extraction.
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  _createImageBitmapFromSource(imageSource, options) {
    throw new Error("createImageBitmapFromSource is not implemented");
  }
  /**
   * Engine abstraction for createImageBitmap
   * @param image source for image
   * @param options An object that sets options for the image's extraction.
   * @returns ImageBitmap
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  createImageBitmap(image, options) {
    return createImageBitmap(image, options);
  }
  /**
   * Resize an image and returns the image data as an uint8array
   * @param image image to resize
   * @param bufferWidth destination buffer width
   * @param bufferHeight destination buffer height
   */
  resizeImageBitmap(image, bufferWidth, bufferHeight) {
    throw new Error("resizeImageBitmap is not implemented");
  }
  /**
   * Get Font size information
   * @param font font name
   */
  getFontOffset(font) {
    throw new Error("getFontOffset is not implemented");
  }
  static _CreateCanvas(width, height) {
    if (typeof document === "undefined") {
      return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  /**
   * Create a canvas. This method is overridden by other engines
   * @param width width
   * @param height height
   * @returns ICanvas interface
   */
  createCanvas(width, height) {
    return _AbstractEngine._CreateCanvas(width, height);
  }
  /**
   * Loads an image as an HTMLImageElement.
   * @param input url string, ArrayBuffer, or Blob to load
   * @param onLoad callback called when the image successfully loads
   * @param onError callback called when the image fails to load
   * @param offlineProvider offline provider for caching
   * @param mimeType optional mime type
   * @param imageBitmapOptions optional the options to use when creating an ImageBitmap
   * @param engine the engine instance to use
   * @returns the HTMLImageElement of the loaded image
   * @internal
   */
  static _FileToolsLoadImage(input, onLoad, onError, offlineProvider, mimeType, imageBitmapOptions, engine) {
    throw _WarnImport("FileTools");
  }
  /**
   * @internal
   */
  _loadFile(url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError) {
    const request = _LoadFile(url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError);
    this._activeRequests.push(request);
    request.onCompleteObservable.add(() => {
      const index = this._activeRequests.indexOf(request);
      if (index !== -1) {
        this._activeRequests.splice(index, 1);
      }
    });
    return request;
  }
  /**
   * Loads a file from a url
   * @param url url to load
   * @param onSuccess callback called when the file successfully loads
   * @param onProgress callback called while file is loading (if the server supports this mode)
   * @param offlineProvider defines the offline provider for caching
   * @param useArrayBuffer defines a boolean indicating that date must be returned as ArrayBuffer
   * @param onError callback called when the file fails to load
   * @returns a file request object
   * @internal
   */
  static _FileToolsLoadFile(url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError) {
    if (EngineFunctionContext.loadFile) {
      return EngineFunctionContext.loadFile(url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError);
    }
    throw _WarnImport("FileTools");
  }
  /**
   * Dispose and release all associated resources
   */
  dispose() {
    this.releaseEffects();
    this._isDisposed = true;
    this.stopRenderLoop();
    if (this._emptyTexture) {
      this._releaseTexture(this._emptyTexture);
      this._emptyTexture = null;
    }
    if (this._emptyCubeTexture) {
      this._releaseTexture(this._emptyCubeTexture);
      this._emptyCubeTexture = null;
    }
    this._renderingCanvas = null;
    if (this.onBeforeTextureInitObservable) {
      this.onBeforeTextureInitObservable.clear();
    }
    while (this.postProcesses.length) {
      this.postProcesses[0].dispose();
    }
    while (this.scenes.length) {
      this.scenes[0].dispose();
    }
    while (this._virtualScenes.length) {
      this._virtualScenes[0].dispose();
    }
    this.releaseComputeEffects?.();
    Effect.ResetCache();
    for (const request of this._activeRequests) {
      request.abort();
    }
    this._boundRenderFunction = null;
    this.onDisposeObservable.notifyObservers(this);
    this.onDisposeObservable.clear();
    this.onResizeObservable.clear();
    this.onCanvasBlurObservable.clear();
    this.onCanvasFocusObservable.clear();
    this.onCanvasPointerOutObservable.clear();
    this.onNewSceneAddedObservable.clear();
    this.onEffectErrorObservable.clear();
    if (IsWindowObjectExist()) {
      window.removeEventListener("resize", this._checkForMobile);
    }
    const index = EngineStore.Instances.indexOf(this);
    if (index >= 0) {
      EngineStore.Instances.splice(index, 1);
    }
    if (!EngineStore.Instances.length) {
      EngineStore.OnEnginesDisposedObservable.notifyObservers(this);
      EngineStore.OnEnginesDisposedObservable.clear();
    }
    this.onBeginFrameObservable.clear();
    this.onEndFrameObservable.clear();
  }
  /**
   * Method called to create the default loading screen.
   * This can be overridden in your own app.
   * @param canvas The rendering canvas element
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static DefaultLoadingScreenFactory(canvas) {
    throw _WarnImport("LoadingScreen");
  }
  /**
   * Will flag all materials in all scenes in all engines as dirty to trigger new shader compilation
   * @param flag defines which part of the materials must be marked as dirty
   * @param predicate defines a predicate used to filter which materials should be affected
   */
  static MarkAllMaterialsAsDirty(flag, predicate) {
    for (let engineIndex = 0; engineIndex < EngineStore.Instances.length; engineIndex++) {
      const engine = EngineStore.Instances[engineIndex];
      for (let sceneIndex = 0; sceneIndex < engine.scenes.length; sceneIndex++) {
        engine.scenes[sceneIndex].markAllMaterialsAsDirty(flag, predicate);
      }
    }
  }
  /**
   * @internal
   * Function used to get the correct texture loader for a specific extension.
   * @param extension defines the file extension of the file being loaded
   * @param mimeType defines the optional mime type of the file being loaded
   * @returns the IInternalTextureLoader or null if it wasn't found
   */
  static GetCompatibleTextureLoader(_extension, _mimeType) {
    return null;
  }
};
AbstractEngine._RenderPassIdCounter = 0;
AbstractEngine._RescalePostProcessFactory = null;
AbstractEngine.CollisionsEpsilon = 1e-3;
AbstractEngine.QueueNewFrame = QueueNewFrame;

export {
  AlphaState,
  InternalTexture,
  AbstractEngine
};
//# sourceMappingURL=chunk-CQNOHBC6.js.map
