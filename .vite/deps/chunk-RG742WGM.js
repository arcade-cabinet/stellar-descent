import {
  GetDOMTextContent,
  IsWindowObjectExist
} from "./chunk-AB3HOSPI.js";
import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import {
  _RetryWithInterval
} from "./chunk-BFIQD25N.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import {
  _WarnImport
} from "./chunk-MMWR3MO4.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/WebGL/webGLPipelineContext.js
var WebGLPipelineContext = class {
  constructor() {
    this._valueCache = {};
    this.vertexCompilationError = null;
    this.fragmentCompilationError = null;
    this.programLinkError = null;
    this.programValidationError = null;
    this._isDisposed = false;
  }
  // eslint-disable-next-line no-restricted-syntax
  get isAsync() {
    return this.isParallelCompiled;
  }
  get isReady() {
    if (this.program) {
      if (this.isParallelCompiled) {
        return this.engine._isRenderingStateCompiled(this);
      }
      return true;
    }
    return false;
  }
  _handlesSpectorRebuildCallback(onCompiled) {
    if (onCompiled && this.program) {
      onCompiled(this.program);
    }
  }
  setEngine(engine) {
    this.engine = engine;
  }
  _fillEffectInformation(effect, uniformBuffersNames, uniformsNames, uniforms, samplerList, samplers, attributesNames, attributes) {
    const engine = this.engine;
    if (engine.supportsUniformBuffers) {
      for (const name in uniformBuffersNames) {
        effect.bindUniformBlock(name, uniformBuffersNames[name]);
      }
    }
    const effectAvailableUniforms = this.engine.getUniforms(this, uniformsNames);
    effectAvailableUniforms.forEach((uniform, index2) => {
      uniforms[uniformsNames[index2]] = uniform;
    });
    this._uniforms = uniforms;
    let index;
    for (index = 0; index < samplerList.length; index++) {
      const sampler = effect.getUniform(samplerList[index]);
      if (sampler == null) {
        samplerList.splice(index, 1);
        index--;
      }
    }
    samplerList.forEach((name, index2) => {
      samplers[name] = index2;
    });
    for (const attr of engine.getAttributes(this, attributesNames)) {
      attributes.push(attr);
    }
  }
  /**
   * Release all associated resources.
   **/
  dispose() {
    this._uniforms = {};
    this._isDisposed = true;
  }
  /**
   * @internal
   */
  _cacheMatrix(uniformName, matrix) {
    const cache = this._valueCache[uniformName];
    const flag = matrix.updateFlag;
    if (cache !== void 0 && cache === flag) {
      return false;
    }
    this._valueCache[uniformName] = flag;
    return true;
  }
  /**
   * @internal
   */
  _cacheFloat2(uniformName, x, y) {
    let cache = this._valueCache[uniformName];
    if (!cache || cache.length !== 2) {
      cache = [x, y];
      this._valueCache[uniformName] = cache;
      return true;
    }
    let changed = false;
    if (cache[0] !== x) {
      cache[0] = x;
      changed = true;
    }
    if (cache[1] !== y) {
      cache[1] = y;
      changed = true;
    }
    return changed;
  }
  /**
   * @internal
   */
  _cacheFloat3(uniformName, x, y, z) {
    let cache = this._valueCache[uniformName];
    if (!cache || cache.length !== 3) {
      cache = [x, y, z];
      this._valueCache[uniformName] = cache;
      return true;
    }
    let changed = false;
    if (cache[0] !== x) {
      cache[0] = x;
      changed = true;
    }
    if (cache[1] !== y) {
      cache[1] = y;
      changed = true;
    }
    if (cache[2] !== z) {
      cache[2] = z;
      changed = true;
    }
    return changed;
  }
  /**
   * @internal
   */
  _cacheFloat4(uniformName, x, y, z, w) {
    let cache = this._valueCache[uniformName];
    if (!cache || cache.length !== 4) {
      cache = [x, y, z, w];
      this._valueCache[uniformName] = cache;
      return true;
    }
    let changed = false;
    if (cache[0] !== x) {
      cache[0] = x;
      changed = true;
    }
    if (cache[1] !== y) {
      cache[1] = y;
      changed = true;
    }
    if (cache[2] !== z) {
      cache[2] = z;
      changed = true;
    }
    if (cache[3] !== w) {
      cache[3] = w;
      changed = true;
    }
    return changed;
  }
  /**
   * Sets an integer value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value Value to be set.
   */
  setInt(uniformName, value) {
    const cache = this._valueCache[uniformName];
    if (cache !== void 0 && cache === value) {
      return;
    }
    if (this.engine.setInt(this._uniforms[uniformName], value)) {
      this._valueCache[uniformName] = value;
    }
  }
  /**
   * Sets a int2 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int2.
   * @param y Second int in int2.
   */
  setInt2(uniformName, x, y) {
    if (this._cacheFloat2(uniformName, x, y)) {
      if (!this.engine.setInt2(this._uniforms[uniformName], x, y)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a int3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int3.
   * @param y Second int in int3.
   * @param z Third int in int3.
   */
  setInt3(uniformName, x, y, z) {
    if (this._cacheFloat3(uniformName, x, y, z)) {
      if (!this.engine.setInt3(this._uniforms[uniformName], x, y, z)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a int4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int4.
   * @param y Second int in int4.
   * @param z Third int in int4.
   * @param w Fourth int in int4.
   */
  setInt4(uniformName, x, y, z, w) {
    if (this._cacheFloat4(uniformName, x, y, z, w)) {
      if (!this.engine.setInt4(this._uniforms[uniformName], x, y, z, w)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets an int array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setIntArray(this._uniforms[uniformName], array);
  }
  /**
   * Sets an int array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray2(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setIntArray2(this._uniforms[uniformName], array);
  }
  /**
   * Sets an int array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray3(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setIntArray3(this._uniforms[uniformName], array);
  }
  /**
   * Sets an int array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setIntArray4(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setIntArray4(this._uniforms[uniformName], array);
  }
  /**
   * Sets an unsigned integer value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value Value to be set.
   */
  setUInt(uniformName, value) {
    const cache = this._valueCache[uniformName];
    if (cache !== void 0 && cache === value) {
      return;
    }
    if (this.engine.setUInt(this._uniforms[uniformName], value)) {
      this._valueCache[uniformName] = value;
    }
  }
  /**
   * Sets an unsigned int2 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint2.
   * @param y Second unsigned int in uint2.
   */
  setUInt2(uniformName, x, y) {
    if (this._cacheFloat2(uniformName, x, y)) {
      if (!this.engine.setUInt2(this._uniforms[uniformName], x, y)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets an unsigned int3 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint3.
   * @param y Second unsigned int in uint3.
   * @param z Third unsigned int in uint3.
   */
  setUInt3(uniformName, x, y, z) {
    if (this._cacheFloat3(uniformName, x, y, z)) {
      if (!this.engine.setUInt3(this._uniforms[uniformName], x, y, z)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets an unsigned int4 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint4.
   * @param y Second unsigned int in uint4.
   * @param z Third unsigned int in uint4.
   * @param w Fourth unsigned int in uint4.
   */
  setUInt4(uniformName, x, y, z, w) {
    if (this._cacheFloat4(uniformName, x, y, z, w)) {
      if (!this.engine.setUInt4(this._uniforms[uniformName], x, y, z, w)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets an unsigned int array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setUIntArray(this._uniforms[uniformName], array);
  }
  /**
   * Sets an unsigned int array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray2(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setUIntArray2(this._uniforms[uniformName], array);
  }
  /**
   * Sets an unsigned int array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray3(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setUIntArray3(this._uniforms[uniformName], array);
  }
  /**
   * Sets an unsigned int array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setUIntArray4(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setUIntArray4(this._uniforms[uniformName], array);
  }
  /**
   * Sets an array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setArray(this._uniforms[uniformName], array);
  }
  /**
   * Sets an array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray2(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setArray2(this._uniforms[uniformName], array);
  }
  /**
   * Sets an array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray3(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setArray3(this._uniforms[uniformName], array);
  }
  /**
   * Sets an array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   */
  setArray4(uniformName, array) {
    this._valueCache[uniformName] = null;
    this.engine.setArray4(this._uniforms[uniformName], array);
  }
  /**
   * Sets matrices on a uniform variable.
   * @param uniformName Name of the variable.
   * @param matrices matrices to be set.
   */
  setMatrices(uniformName, matrices) {
    if (!matrices) {
      return;
    }
    this._valueCache[uniformName] = null;
    this.engine.setMatrices(this._uniforms[uniformName], matrices);
  }
  /**
   * Sets matrix on a uniform variable.
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   */
  setMatrix(uniformName, matrix) {
    if (this._cacheMatrix(uniformName, matrix)) {
      if (!this.engine.setMatrices(this._uniforms[uniformName], matrix.asArray())) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a 3x3 matrix on a uniform variable. (Specified as [1,2,3,4,5,6,7,8,9] will result in [1,2,3][4,5,6][7,8,9] matrix)
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   */
  setMatrix3x3(uniformName, matrix) {
    this._valueCache[uniformName] = null;
    this.engine.setMatrix3x3(this._uniforms[uniformName], matrix);
  }
  /**
   * Sets a 2x2 matrix on a uniform variable. (Specified as [1,2,3,4] will result in [1,2][3,4] matrix)
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   */
  setMatrix2x2(uniformName, matrix) {
    this._valueCache[uniformName] = null;
    this.engine.setMatrix2x2(this._uniforms[uniformName], matrix);
  }
  /**
   * Sets a float on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value value to be set.
   */
  setFloat(uniformName, value) {
    const cache = this._valueCache[uniformName];
    if (cache !== void 0 && cache === value) {
      return;
    }
    if (this.engine.setFloat(this._uniforms[uniformName], value)) {
      this._valueCache[uniformName] = value;
    }
  }
  /**
   * Sets a Vector2 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector2 vector2 to be set.
   */
  setVector2(uniformName, vector2) {
    if (this._cacheFloat2(uniformName, vector2.x, vector2.y)) {
      if (!this.engine.setFloat2(this._uniforms[uniformName], vector2.x, vector2.y)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a float2 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float2.
   * @param y Second float in float2.
   */
  setFloat2(uniformName, x, y) {
    if (this._cacheFloat2(uniformName, x, y)) {
      if (!this.engine.setFloat2(this._uniforms[uniformName], x, y)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a Vector3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector3 Value to be set.
   */
  setVector3(uniformName, vector3) {
    if (this._cacheFloat3(uniformName, vector3.x, vector3.y, vector3.z)) {
      if (!this.engine.setFloat3(this._uniforms[uniformName], vector3.x, vector3.y, vector3.z)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a float3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float3.
   * @param y Second float in float3.
   * @param z Third float in float3.
   */
  setFloat3(uniformName, x, y, z) {
    if (this._cacheFloat3(uniformName, x, y, z)) {
      if (!this.engine.setFloat3(this._uniforms[uniformName], x, y, z)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a Vector4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector4 Value to be set.
   */
  setVector4(uniformName, vector4) {
    if (this._cacheFloat4(uniformName, vector4.x, vector4.y, vector4.z, vector4.w)) {
      if (!this.engine.setFloat4(this._uniforms[uniformName], vector4.x, vector4.y, vector4.z, vector4.w)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a Quaternion on a uniform variable.
   * @param uniformName Name of the variable.
   * @param quaternion Value to be set.
   */
  setQuaternion(uniformName, quaternion) {
    if (this._cacheFloat4(uniformName, quaternion.x, quaternion.y, quaternion.z, quaternion.w)) {
      if (!this.engine.setFloat4(this._uniforms[uniformName], quaternion.x, quaternion.y, quaternion.z, quaternion.w)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a float4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float4.
   * @param y Second float in float4.
   * @param z Third float in float4.
   * @param w Fourth float in float4.
   */
  setFloat4(uniformName, x, y, z, w) {
    if (this._cacheFloat4(uniformName, x, y, z, w)) {
      if (!this.engine.setFloat4(this._uniforms[uniformName], x, y, z, w)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a Color3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param color3 Value to be set.
   */
  setColor3(uniformName, color3) {
    if (this._cacheFloat3(uniformName, color3.r, color3.g, color3.b)) {
      if (!this.engine.setFloat3(this._uniforms[uniformName], color3.r, color3.g, color3.b)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a Color4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param color3 Value to be set.
   * @param alpha Alpha value to be set.
   */
  setColor4(uniformName, color3, alpha) {
    if (this._cacheFloat4(uniformName, color3.r, color3.g, color3.b, alpha)) {
      if (!this.engine.setFloat4(this._uniforms[uniformName], color3.r, color3.g, color3.b, alpha)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  /**
   * Sets a Color4 on a uniform variable
   * @param uniformName defines the name of the variable
   * @param color4 defines the value to be set
   */
  setDirectColor4(uniformName, color4) {
    if (this._cacheFloat4(uniformName, color4.r, color4.g, color4.b, color4.a)) {
      if (!this.engine.setFloat4(this._uniforms[uniformName], color4.r, color4.g, color4.b, color4.a)) {
        this._valueCache[uniformName] = null;
      }
    }
  }
  _getVertexShaderCode() {
    return this.vertexShader ? this.engine._getShaderSource(this.vertexShader) : null;
  }
  _getFragmentShaderCode() {
    return this.fragmentShader ? this.engine._getShaderSource(this.fragmentShader) : null;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/abstractEngine.functions.js
var EngineFunctionContext = {};
function _ConcatenateShader(source, defines, shaderVersion = "") {
  return shaderVersion + (defines ? defines + "\n" : "") + source;
}
function _LoadFile(url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError, injectedLoadFile) {
  const loadFile = injectedLoadFile || EngineFunctionContext.loadFile;
  if (loadFile) {
    const request = loadFile(url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError);
    return request;
  }
  throw _WarnImport("FileTools");
}
function _GetGlobalDefines(defines, isNDCHalfZRange, useReverseDepthBuffer, useExactSrgbConversions) {
  if (defines) {
    if (isNDCHalfZRange) {
      defines["IS_NDC_HALF_ZRANGE"] = "";
    } else {
      delete defines["IS_NDC_HALF_ZRANGE"];
    }
    if (useReverseDepthBuffer) {
      defines["USE_REVERSE_DEPTHBUFFER"] = "";
    } else {
      delete defines["USE_REVERSE_DEPTHBUFFER"];
    }
    if (useExactSrgbConversions) {
      defines["USE_EXACT_SRGB_CONVERSIONS"] = "";
    } else {
      delete defines["USE_EXACT_SRGB_CONVERSIONS"];
    }
    return;
  } else {
    let s = "";
    if (isNDCHalfZRange) {
      s += "#define IS_NDC_HALF_ZRANGE";
    }
    if (useReverseDepthBuffer) {
      if (s) {
        s += "\n";
      }
      s += "#define USE_REVERSE_DEPTHBUFFER";
    }
    if (useExactSrgbConversions) {
      if (s) {
        s += "\n";
      }
      s += "#define USE_EXACT_SRGB_CONVERSIONS";
    }
    return s;
  }
}
function allocateAndCopyTypedBuffer(type, sizeOrDstBuffer, sizeInBytes = false, copyBuffer) {
  switch (type) {
    case 3: {
      const buffer2 = new Int8Array(sizeOrDstBuffer);
      if (copyBuffer) {
        buffer2.set(new Int8Array(copyBuffer));
      }
      return buffer2;
    }
    case 0: {
      const buffer2 = new Uint8Array(sizeOrDstBuffer);
      if (copyBuffer) {
        buffer2.set(new Uint8Array(copyBuffer));
      }
      return buffer2;
    }
    case 4: {
      const buffer2 = typeof sizeOrDstBuffer !== "number" ? new Int16Array(sizeOrDstBuffer) : new Int16Array(sizeInBytes ? sizeOrDstBuffer / 2 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer2.set(new Int16Array(copyBuffer));
      }
      return buffer2;
    }
    case 5:
    case 8:
    case 9:
    case 10:
    case 2: {
      const buffer2 = typeof sizeOrDstBuffer !== "number" ? new Uint16Array(sizeOrDstBuffer) : new Uint16Array(sizeInBytes ? sizeOrDstBuffer / 2 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer2.set(new Uint16Array(copyBuffer));
      }
      return buffer2;
    }
    case 6: {
      const buffer2 = typeof sizeOrDstBuffer !== "number" ? new Int32Array(sizeOrDstBuffer) : new Int32Array(sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer2.set(new Int32Array(copyBuffer));
      }
      return buffer2;
    }
    case 7:
    case 11:
    case 12:
    case 13:
    case 14:
    case 15: {
      const buffer2 = typeof sizeOrDstBuffer !== "number" ? new Uint32Array(sizeOrDstBuffer) : new Uint32Array(sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer2.set(new Uint32Array(copyBuffer));
      }
      return buffer2;
    }
    case 1: {
      const buffer2 = typeof sizeOrDstBuffer !== "number" ? new Float32Array(sizeOrDstBuffer) : new Float32Array(sizeInBytes ? sizeOrDstBuffer / 4 : sizeOrDstBuffer);
      if (copyBuffer) {
        buffer2.set(new Float32Array(copyBuffer));
      }
      return buffer2;
    }
  }
  const buffer = new Uint8Array(sizeOrDstBuffer);
  if (copyBuffer) {
    buffer.set(new Uint8Array(copyBuffer));
  }
  return buffer;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/thinEngine.functions.js
var StateObject = /* @__PURE__ */ new WeakMap();
var SingleStateObject = {
  _webGLVersion: 2,
  cachedPipelines: {}
};
function getStateObject(context) {
  let state = StateObject.get(context);
  if (!state) {
    if (!context) {
      return SingleStateObject;
    }
    state = {
      // use feature detection. instanceof returns false. This only exists on WebGL2 context
      _webGLVersion: context.TEXTURE_BINDING_3D ? 2 : 1,
      _context: context,
      // when using the function without an engine we need to set it to enable parallel compilation
      parallelShaderCompile: context.getExtension("KHR_parallel_shader_compile") || void 0,
      cachedPipelines: {}
    };
    StateObject.set(context, state);
  }
  return state;
}
function deleteStateObject(context) {
  StateObject.delete(context);
}
function createRawShaderProgram(pipelineContext, vertexCode, fragmentCode, context, transformFeedbackVaryings, _createShaderProgramInjection) {
  const stateObject = getStateObject(context);
  if (!_createShaderProgramInjection) {
    _createShaderProgramInjection = stateObject._createShaderProgramInjection ?? _createShaderProgram;
  }
  const vertexShader = CompileRawShader(vertexCode, "vertex", context, stateObject._contextWasLost);
  const fragmentShader = CompileRawShader(fragmentCode, "fragment", context, stateObject._contextWasLost);
  return _createShaderProgramInjection(pipelineContext, vertexShader, fragmentShader, context, transformFeedbackVaryings, stateObject.validateShaderPrograms);
}
function createShaderProgram(pipelineContext, vertexCode, fragmentCode, defines, context, transformFeedbackVaryings = null, _createShaderProgramInjection) {
  const stateObject = getStateObject(context);
  if (!_createShaderProgramInjection) {
    _createShaderProgramInjection = stateObject._createShaderProgramInjection ?? _createShaderProgram;
  }
  const shaderVersion = stateObject._webGLVersion > 1 ? "#version 300 es\n#define WEBGL2 \n" : "";
  const vertexShader = CompileShader(vertexCode, "vertex", defines, shaderVersion, context, stateObject._contextWasLost);
  const fragmentShader = CompileShader(fragmentCode, "fragment", defines, shaderVersion, context, stateObject._contextWasLost);
  return _createShaderProgramInjection(pipelineContext, vertexShader, fragmentShader, context, transformFeedbackVaryings, stateObject.validateShaderPrograms);
}
function createPipelineContext(context, _shaderProcessingContext) {
  const pipelineContext = new WebGLPipelineContext();
  const stateObject = getStateObject(context);
  if (stateObject.parallelShaderCompile && !stateObject.disableParallelShaderCompile) {
    pipelineContext.isParallelCompiled = true;
  }
  pipelineContext.context = stateObject._context;
  return pipelineContext;
}
function _createShaderProgram(pipelineContext, vertexShader, fragmentShader, context, _transformFeedbackVaryings = null, validateShaderPrograms) {
  const shaderProgram = context.createProgram();
  pipelineContext.program = shaderProgram;
  if (!shaderProgram) {
    throw new Error("Unable to create program");
  }
  context.attachShader(shaderProgram, vertexShader);
  context.attachShader(shaderProgram, fragmentShader);
  context.linkProgram(shaderProgram);
  pipelineContext.context = context;
  pipelineContext.vertexShader = vertexShader;
  pipelineContext.fragmentShader = fragmentShader;
  if (!pipelineContext.isParallelCompiled) {
    _finalizePipelineContext(pipelineContext, context, validateShaderPrograms);
  }
  return shaderProgram;
}
function _isRenderingStateCompiled(pipelineContext, gl, validateShaderPrograms) {
  const webGLPipelineContext = pipelineContext;
  if (webGLPipelineContext._isDisposed) {
    return false;
  }
  const stateObject = getStateObject(gl);
  if (stateObject && stateObject.parallelShaderCompile && stateObject.parallelShaderCompile.COMPLETION_STATUS_KHR && webGLPipelineContext.program) {
    if (gl.getProgramParameter(webGLPipelineContext.program, stateObject.parallelShaderCompile.COMPLETION_STATUS_KHR)) {
      _finalizePipelineContext(webGLPipelineContext, gl, validateShaderPrograms);
      return true;
    }
  }
  return false;
}
function _finalizePipelineContext(pipelineContext, gl, validateShaderPrograms) {
  const context = pipelineContext.context;
  const vertexShader = pipelineContext.vertexShader;
  const fragmentShader = pipelineContext.fragmentShader;
  const program = pipelineContext.program;
  const linked = context.getProgramParameter(program, context.LINK_STATUS);
  if (!linked) {
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(vertexShader);
      if (log) {
        pipelineContext.vertexCompilationError = log;
        throw new Error("VERTEX SHADER " + log);
      }
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(fragmentShader);
      if (log) {
        pipelineContext.fragmentCompilationError = log;
        throw new Error("FRAGMENT SHADER " + log);
      }
    }
    const error = context.getProgramInfoLog(program);
    if (error) {
      pipelineContext.programLinkError = error;
      throw new Error(error);
    }
  }
  if (
    /*this.*/
    validateShaderPrograms
  ) {
    context.validateProgram(program);
    const validated = context.getProgramParameter(program, context.VALIDATE_STATUS);
    if (!validated) {
      const error = context.getProgramInfoLog(program);
      if (error) {
        pipelineContext.programValidationError = error;
        throw new Error(error);
      }
    }
  }
  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);
  pipelineContext.vertexShader = void 0;
  pipelineContext.fragmentShader = void 0;
  if (pipelineContext.onCompiled) {
    pipelineContext.onCompiled();
    pipelineContext.onCompiled = void 0;
  }
}
function _preparePipelineContext(pipelineContext, vertexSourceCode, fragmentSourceCode, createAsRaw, _rawVertexSourceCode, _rawFragmentSourceCode, rebuildRebind, defines, transformFeedbackVaryings, _key = "", onReady, createRawShaderProgramInjection, createShaderProgramInjection) {
  const stateObject = getStateObject(pipelineContext.context);
  if (!createRawShaderProgramInjection) {
    createRawShaderProgramInjection = stateObject.createRawShaderProgramInjection ?? createRawShaderProgram;
  }
  if (!createShaderProgramInjection) {
    createShaderProgramInjection = stateObject.createShaderProgramInjection ?? createShaderProgram;
  }
  const webGLRenderingState = pipelineContext;
  if (createAsRaw) {
    webGLRenderingState.program = createRawShaderProgramInjection(webGLRenderingState, vertexSourceCode, fragmentSourceCode, webGLRenderingState.context, transformFeedbackVaryings);
  } else {
    webGLRenderingState.program = createShaderProgramInjection(webGLRenderingState, vertexSourceCode, fragmentSourceCode, defines, webGLRenderingState.context, transformFeedbackVaryings);
  }
  webGLRenderingState.program.__SPECTOR_rebuildProgram = rebuildRebind;
  onReady();
}
function CompileShader(source, type, defines, shaderVersion, gl, _contextWasLost) {
  return CompileRawShader(_ConcatenateShader(source, defines, shaderVersion), type, gl, _contextWasLost);
}
function CompileRawShader(source, type, gl, _contextWasLost) {
  const shader = gl.createShader(type === "vertex" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
  if (!shader) {
    let error = gl.NO_ERROR;
    let tempError = gl.NO_ERROR;
    while ((tempError = gl.getError()) !== gl.NO_ERROR) {
      error = tempError;
    }
    throw new Error(`Something went wrong while creating a gl ${type} shader object. gl error=${error}, gl isContextLost=${gl.isContextLost()}, _contextWasLost=${_contextWasLost}`);
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}
function _setProgram(program, gl) {
  gl.useProgram(program);
}
function _executeWhenRenderingStateIsCompiled(pipelineContext, action) {
  const webGLPipelineContext = pipelineContext;
  if (!webGLPipelineContext.isParallelCompiled) {
    action(pipelineContext);
    return;
  }
  const oldHandler = webGLPipelineContext.onCompiled;
  webGLPipelineContext.onCompiled = () => {
    oldHandler?.();
    action(pipelineContext);
  };
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/shaderCodeNode.js
var DefaultAttributeKeywordName = "attribute";
var DefaultVaryingKeywordName = "varying";
var ShaderCodeNode = class {
  constructor() {
    this.children = [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isValid(preprocessors) {
    return true;
  }
  process(preprocessors, options, preProcessorsFromCode) {
    let result = "";
    if (this.line) {
      let value = this.line;
      const processor = options.processor;
      if (processor) {
        if (processor.lineProcessor) {
          value = processor.lineProcessor(value, options.isFragment, options.processingContext);
        }
        const attributeKeyword = options.processor?.attributeKeywordName ?? DefaultAttributeKeywordName;
        const varyingKeyword = options.isFragment && options.processor?.varyingFragmentKeywordName ? options.processor?.varyingFragmentKeywordName : !options.isFragment && options.processor?.varyingVertexKeywordName ? options.processor?.varyingVertexKeywordName : DefaultVaryingKeywordName;
        if (!options.isFragment && processor.attributeProcessor && this.line.startsWith(attributeKeyword)) {
          value = processor.attributeProcessor(this.line, preprocessors, options.processingContext);
        } else if (processor.varyingProcessor && (processor.varyingCheck?.(this.line, options.isFragment) || !processor.varyingCheck && this.line.startsWith(varyingKeyword))) {
          value = processor.varyingProcessor(this.line, options.isFragment, preprocessors, options.processingContext);
        } else if (processor.uniformProcessor && processor.uniformRegexp && processor.uniformRegexp.test(this.line)) {
          if (!options.lookForClosingBracketForUniformBuffer) {
            value = processor.uniformProcessor(this.line, options.isFragment, preprocessors, options.processingContext);
          }
        } else if (processor.uniformBufferProcessor && processor.uniformBufferRegexp && processor.uniformBufferRegexp.test(this.line)) {
          if (!options.lookForClosingBracketForUniformBuffer) {
            value = processor.uniformBufferProcessor(this.line, options.isFragment, options.processingContext);
            options.lookForClosingBracketForUniformBuffer = true;
          }
        } else if (processor.textureProcessor && processor.textureRegexp && processor.textureRegexp.test(this.line)) {
          value = processor.textureProcessor(this.line, options.isFragment, preprocessors, options.processingContext);
        } else if ((processor.uniformProcessor || processor.uniformBufferProcessor) && this.line.startsWith("uniform") && !options.lookForClosingBracketForUniformBuffer) {
          const regex = /uniform\s+(?:(?:highp)?|(?:lowp)?)\s*(\S+)\s+(\S+)\s*;/;
          if (regex.test(this.line)) {
            if (processor.uniformProcessor) {
              value = processor.uniformProcessor(this.line, options.isFragment, preprocessors, options.processingContext);
            }
          } else {
            if (processor.uniformBufferProcessor) {
              value = processor.uniformBufferProcessor(this.line, options.isFragment, options.processingContext);
              options.lookForClosingBracketForUniformBuffer = true;
            }
          }
        }
        if (options.lookForClosingBracketForUniformBuffer && this.line.indexOf("}") !== -1) {
          options.lookForClosingBracketForUniformBuffer = false;
          if (processor.endOfUniformBufferProcessor) {
            value = processor.endOfUniformBufferProcessor(this.line, options.isFragment, options.processingContext);
          }
        }
      }
      result += value + "\n";
    }
    for (const child of this.children) {
      result += child.process(preprocessors, options, preProcessorsFromCode);
    }
    if (this.additionalDefineKey) {
      preprocessors[this.additionalDefineKey] = this.additionalDefineValue || "true";
      preProcessorsFromCode[this.additionalDefineKey] = preprocessors[this.additionalDefineKey];
    }
    return result;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/shaderCodeCursor.js
var ShaderCodeCursor = class {
  constructor() {
    this._lines = [];
  }
  get currentLine() {
    return this._lines[this.lineIndex];
  }
  get canRead() {
    return this.lineIndex < this._lines.length - 1;
  }
  set lines(value) {
    this._lines.length = 0;
    for (const line of value) {
      if (!line || line === "\r") {
        continue;
      }
      if (line[0] === "#") {
        this._lines.push(line);
        continue;
      }
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        continue;
      }
      if (trimmedLine.startsWith("//")) {
        this._lines.push(line);
        continue;
      }
      const semicolonIndex = trimmedLine.indexOf(";");
      if (semicolonIndex === -1) {
        this._lines.push(trimmedLine);
      } else if (semicolonIndex === trimmedLine.length - 1) {
        if (trimmedLine.length > 1) {
          this._lines.push(trimmedLine);
        }
      } else {
        const split = line.split(";");
        for (let index = 0; index < split.length; index++) {
          let subLine = split[index];
          if (!subLine) {
            continue;
          }
          subLine = subLine.trim();
          if (!subLine) {
            continue;
          }
          this._lines.push(subLine + (index !== split.length - 1 ? ";" : ""));
        }
      }
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/shaderCodeConditionNode.js
var ShaderCodeConditionNode = class extends ShaderCodeNode {
  process(preprocessors, options, preProcessorsFromCode) {
    for (let index = 0; index < this.children.length; index++) {
      const node = this.children[index];
      if (node.isValid(preprocessors)) {
        return node.process(preprocessors, options, preProcessorsFromCode);
      }
    }
    return "";
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/shaderCodeTestNode.js
var ShaderCodeTestNode = class extends ShaderCodeNode {
  isValid(preprocessors) {
    return this.testExpression.isTrue(preprocessors);
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/Expressions/shaderDefineExpression.js
var ShaderDefineExpression = class _ShaderDefineExpression {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isTrue(preprocessors) {
    return true;
  }
  static postfixToInfix(postfix) {
    const stack = [];
    for (const c of postfix) {
      if (_ShaderDefineExpression._OperatorPriority[c] === void 0) {
        stack.push(c);
      } else {
        const v1 = stack[stack.length - 1], v2 = stack[stack.length - 2];
        stack.length -= 2;
        stack.push(`(${v2}${c}${v1})`);
      }
    }
    return stack[stack.length - 1];
  }
  /**
   * Converts an infix expression to a postfix expression.
   *
   * This method is used to transform infix expressions, which are more human-readable,
   * into postfix expressions, also known as Reverse Polish Notation (RPN), that can be
   * evaluated more efficiently by a computer. The conversion is based on the operator
   * priority defined in _OperatorPriority.
   *
   * The function employs a stack-based algorithm for the conversion and caches the result
   * to improve performance. The cache keeps track of each converted expression's access time
   * to manage the cache size and optimize memory usage. When the cache size exceeds a specified
   * limit, the least recently accessed items in the cache are deleted.
   *
   * The cache mechanism is particularly helpful for shader compilation, where the same infix
   * expressions might be encountered repeatedly, hence the caching can speed up the process.
   *
   * @param infix - The infix expression to be converted.
   * @returns The postfix expression as an array of strings.
   */
  static infixToPostfix(infix) {
    const cacheItem = _ShaderDefineExpression._InfixToPostfixCache.get(infix);
    if (cacheItem) {
      cacheItem.accessTime = Date.now();
      return cacheItem.result;
    }
    if (!infix.includes("&&") && !infix.includes("||") && !infix.includes(")") && !infix.includes("(")) {
      return [infix];
    }
    const result = [];
    let stackIdx = -1;
    const pushOperand = () => {
      operand = operand.trim();
      if (operand !== "") {
        result.push(operand);
        operand = "";
      }
    };
    const push = (s) => {
      if (stackIdx < _ShaderDefineExpression._Stack.length - 1) {
        _ShaderDefineExpression._Stack[++stackIdx] = s;
      }
    };
    const peek = () => _ShaderDefineExpression._Stack[stackIdx];
    const pop = () => stackIdx === -1 ? "!!INVALID EXPRESSION!!" : _ShaderDefineExpression._Stack[stackIdx--];
    let idx = 0, operand = "";
    while (idx < infix.length) {
      const c = infix.charAt(idx), token = idx < infix.length - 1 ? infix.substring(idx, 2 + idx) : "";
      if (c === "(") {
        operand = "";
        push(c);
      } else if (c === ")") {
        pushOperand();
        while (stackIdx !== -1 && peek() !== "(") {
          result.push(pop());
        }
        pop();
      } else if (_ShaderDefineExpression._OperatorPriority[token] > 1) {
        pushOperand();
        while (stackIdx !== -1 && _ShaderDefineExpression._OperatorPriority[peek()] >= _ShaderDefineExpression._OperatorPriority[token]) {
          result.push(pop());
        }
        push(token);
        idx++;
      } else {
        operand += c;
      }
      idx++;
    }
    pushOperand();
    while (stackIdx !== -1) {
      if (peek() === "(") {
        pop();
      } else {
        result.push(pop());
      }
    }
    if (_ShaderDefineExpression._InfixToPostfixCache.size >= _ShaderDefineExpression.InfixToPostfixCacheLimitSize) {
      _ShaderDefineExpression.ClearCache();
    }
    _ShaderDefineExpression._InfixToPostfixCache.set(infix, { result, accessTime: Date.now() });
    return result;
  }
  static ClearCache() {
    const sortedCache = Array.from(_ShaderDefineExpression._InfixToPostfixCache.entries()).sort((a, b) => a[1].accessTime - b[1].accessTime);
    for (let i = 0; i < _ShaderDefineExpression.InfixToPostfixCacheCleanupSize; i++) {
      _ShaderDefineExpression._InfixToPostfixCache.delete(sortedCache[i][0]);
    }
  }
};
ShaderDefineExpression.InfixToPostfixCacheLimitSize = 5e4;
ShaderDefineExpression.InfixToPostfixCacheCleanupSize = 25e3;
ShaderDefineExpression._InfixToPostfixCache = /* @__PURE__ */ new Map();
ShaderDefineExpression._OperatorPriority = {
  ")": 0,
  "(": 1,
  "||": 2,
  "&&": 3
};
ShaderDefineExpression._Stack = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""];

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/Expressions/Operators/shaderDefineIsDefinedOperator.js
var ShaderDefineIsDefinedOperator = class extends ShaderDefineExpression {
  constructor(define, not = false) {
    super();
    this.define = define;
    this.not = not;
  }
  isTrue(preprocessors) {
    let condition = preprocessors[this.define] !== void 0;
    if (this.not) {
      condition = !condition;
    }
    return condition;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/Expressions/Operators/shaderDefineOrOperator.js
var ShaderDefineOrOperator = class extends ShaderDefineExpression {
  isTrue(preprocessors) {
    return this.leftOperand.isTrue(preprocessors) || this.rightOperand.isTrue(preprocessors);
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/Expressions/Operators/shaderDefineAndOperator.js
var ShaderDefineAndOperator = class extends ShaderDefineExpression {
  isTrue(preprocessors) {
    return this.leftOperand.isTrue(preprocessors) && this.rightOperand.isTrue(preprocessors);
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/Expressions/Operators/shaderDefineArithmeticOperator.js
var ShaderDefineArithmeticOperator = class extends ShaderDefineExpression {
  constructor(define, operand, testValue) {
    super();
    this.define = define;
    this.operand = operand;
    this.testValue = testValue;
  }
  toString() {
    return `${this.define} ${this.operand} ${this.testValue}`;
  }
  isTrue(preprocessors) {
    let condition = false;
    const left = parseInt(preprocessors[this.define] != void 0 ? preprocessors[this.define] : this.define);
    const right = parseInt(preprocessors[this.testValue] != void 0 ? preprocessors[this.testValue] : this.testValue);
    if (isNaN(left) || isNaN(right)) {
      return false;
    }
    switch (this.operand) {
      case ">":
        condition = left > right;
        break;
      case "<":
        condition = left < right;
        break;
      case "<=":
        condition = left <= right;
        break;
      case ">=":
        condition = left >= right;
        break;
      case "==":
        condition = left === right;
        break;
      case "!=":
        condition = left !== right;
        break;
    }
    return condition;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Processors/shaderProcessor.js
var RegexSe = /defined\s*?\((.+?)\)/g;
var RegexSeRevert = /defined\s*?\[(.+?)\]/g;
var RegexShaderInclude = /#include\s?<(.+)>(\((.*)\))*(\[(.*)\])*/g;
var RegexShaderDecl = /__decl__/;
var RegexLightX = /light\{X\}.(\w*)/g;
var RegexX = /\{X\}/g;
var ReusableMatches = [];
var MoveCursorRegex = /(#ifdef)|(#else)|(#elif)|(#endif)|(#ifndef)|(#if)/;
function Initialize(options) {
  if (options.processor && options.processor.initializeShaders) {
    options.processor.initializeShaders(options.processingContext);
  }
}
function Process(sourceCode, options, callback, engine) {
  if (options.processor?.preProcessShaderCode) {
    sourceCode = options.processor.preProcessShaderCode(sourceCode, options.isFragment);
  }
  ProcessIncludes(sourceCode, options, (codeWithIncludes) => {
    if (options.processCodeAfterIncludes) {
      codeWithIncludes = options.processCodeAfterIncludes(options.isFragment ? "fragment" : "vertex", codeWithIncludes, options.defines);
    }
    const migratedCode = ProcessShaderConversion(codeWithIncludes, options, engine);
    callback(migratedCode, codeWithIncludes);
  });
}
function Finalize(vertexCode, fragmentCode, options) {
  if (!options.processor || !options.processor.finalizeShaders) {
    return { vertexCode, fragmentCode };
  }
  return options.processor.finalizeShaders(vertexCode, fragmentCode, options.processingContext);
}
function ProcessPrecision(source, options) {
  if (options.processor?.noPrecision) {
    return source;
  }
  const shouldUseHighPrecisionShader = options.shouldUseHighPrecisionShader;
  if (source.indexOf("precision highp float") === -1) {
    if (!shouldUseHighPrecisionShader) {
      source = "precision mediump float;\n" + source;
    } else {
      source = "precision highp float;\n" + source;
    }
  } else {
    if (!shouldUseHighPrecisionShader) {
      source = source.replace("precision highp float", "precision mediump float");
    }
  }
  return source;
}
function ExtractOperation(expression) {
  const regex = /defined\((.+)\)/;
  const match = regex.exec(expression);
  if (match && match.length) {
    return new ShaderDefineIsDefinedOperator(match[1].trim(), expression[0] === "!");
  }
  const operators = ["==", "!=", ">=", "<=", "<", ">"];
  let operator = "";
  let indexOperator = 0;
  for (operator of operators) {
    indexOperator = expression.indexOf(operator);
    if (indexOperator > -1) {
      break;
    }
  }
  if (indexOperator === -1) {
    return new ShaderDefineIsDefinedOperator(expression);
  }
  const define = expression.substring(0, indexOperator).trim();
  const value = expression.substring(indexOperator + operator.length).trim();
  return new ShaderDefineArithmeticOperator(define, operator, value);
}
function BuildSubExpression(expression) {
  expression = expression.replace(RegexSe, "defined[$1]");
  const postfix = ShaderDefineExpression.infixToPostfix(expression);
  const stack = [];
  for (const c of postfix) {
    if (c !== "||" && c !== "&&") {
      stack.push(c);
    } else if (stack.length >= 2) {
      let v1 = stack[stack.length - 1], v2 = stack[stack.length - 2];
      stack.length -= 2;
      const operator = c == "&&" ? new ShaderDefineAndOperator() : new ShaderDefineOrOperator();
      if (typeof v1 === "string") {
        v1 = v1.replace(RegexSeRevert, "defined($1)");
      }
      if (typeof v2 === "string") {
        v2 = v2.replace(RegexSeRevert, "defined($1)");
      }
      operator.leftOperand = typeof v2 === "string" ? ExtractOperation(v2) : v2;
      operator.rightOperand = typeof v1 === "string" ? ExtractOperation(v1) : v1;
      stack.push(operator);
    }
  }
  let result = stack[stack.length - 1];
  if (typeof result === "string") {
    result = result.replace(RegexSeRevert, "defined($1)");
  }
  return typeof result === "string" ? ExtractOperation(result) : result;
}
function BuildExpression(line, start) {
  const node = new ShaderCodeTestNode();
  const command = line.substring(0, start);
  let expression = line.substring(start);
  expression = expression.substring(0, (expression.indexOf("//") + 1 || expression.length + 1) - 1).trim();
  if (command === "#ifdef") {
    node.testExpression = new ShaderDefineIsDefinedOperator(expression);
  } else if (command === "#ifndef") {
    node.testExpression = new ShaderDefineIsDefinedOperator(expression, true);
  } else {
    node.testExpression = BuildSubExpression(expression);
  }
  return node;
}
function MoveCursorWithinIf(cursor, rootNode, ifNode, preProcessorsFromCode) {
  let line = cursor.currentLine;
  while (MoveCursor(cursor, ifNode, preProcessorsFromCode)) {
    line = cursor.currentLine;
    const first5 = line.substring(0, 5).toLowerCase();
    if (first5 === "#else") {
      const elseNode = new ShaderCodeNode();
      rootNode.children.push(elseNode);
      MoveCursor(cursor, elseNode, preProcessorsFromCode);
      return;
    } else if (first5 === "#elif") {
      const elifNode = BuildExpression(line, 5);
      rootNode.children.push(elifNode);
      ifNode = elifNode;
    }
  }
}
function MoveCursor(cursor, rootNode, preProcessorsFromCode) {
  while (cursor.canRead) {
    cursor.lineIndex++;
    const line = cursor.currentLine;
    if (line.indexOf("#") >= 0) {
      const matches = MoveCursorRegex.exec(line);
      if (matches && matches.length) {
        const keyword = matches[0];
        switch (keyword) {
          case "#ifdef": {
            const newRootNode = new ShaderCodeConditionNode();
            rootNode.children.push(newRootNode);
            const ifNode = BuildExpression(line, 6);
            newRootNode.children.push(ifNode);
            MoveCursorWithinIf(cursor, newRootNode, ifNode, preProcessorsFromCode);
            break;
          }
          case "#else":
          case "#elif":
            return true;
          case "#endif":
            return false;
          case "#ifndef": {
            const newRootNode = new ShaderCodeConditionNode();
            rootNode.children.push(newRootNode);
            const ifNode = BuildExpression(line, 7);
            newRootNode.children.push(ifNode);
            MoveCursorWithinIf(cursor, newRootNode, ifNode, preProcessorsFromCode);
            break;
          }
          case "#if": {
            const newRootNode = new ShaderCodeConditionNode();
            const ifNode = BuildExpression(line, 3);
            rootNode.children.push(newRootNode);
            newRootNode.children.push(ifNode);
            MoveCursorWithinIf(cursor, newRootNode, ifNode, preProcessorsFromCode);
            break;
          }
        }
        continue;
      }
    }
    const newNode = new ShaderCodeNode();
    newNode.line = line;
    rootNode.children.push(newNode);
    if (line[0] === "#" && line[1] === "d") {
      const split = line.replace(";", "").split(" ");
      newNode.additionalDefineKey = split[1];
      if (split.length === 3) {
        newNode.additionalDefineValue = split[2];
      }
    }
  }
  return false;
}
function EvaluatePreProcessors(sourceCode, preprocessors, options, preProcessorsFromCode) {
  const rootNode = new ShaderCodeNode();
  const cursor = new ShaderCodeCursor();
  cursor.lineIndex = -1;
  cursor.lines = sourceCode.split("\n");
  MoveCursor(cursor, rootNode, preProcessorsFromCode);
  return rootNode.process(preprocessors, options, preProcessorsFromCode);
}
function PreparePreProcessors(options, engine) {
  const defines = options.defines;
  const preprocessors = {};
  for (const define of defines) {
    const keyValue = define.replace("#define", "").replace(";", "").trim();
    const split = keyValue.split(" ");
    preprocessors[split[0]] = split.length > 1 ? split[1] : "";
  }
  if (options.processor?.shaderLanguage === 0) {
    preprocessors["GL_ES"] = "true";
  }
  preprocessors["__VERSION__"] = options.version;
  preprocessors[options.platformName] = "true";
  _GetGlobalDefines(preprocessors, engine?.isNDCHalfZRange, engine?.useReverseDepthBuffer, engine?.useExactSrgbConversions);
  return preprocessors;
}
function ProcessShaderConversion(sourceCode, options, engine) {
  let preparedSourceCode = ProcessPrecision(sourceCode, options);
  if (!options.processor) {
    return preparedSourceCode;
  }
  if (options.processor.shaderLanguage === 0 && preparedSourceCode.indexOf("#version 3") !== -1) {
    preparedSourceCode = preparedSourceCode.replace("#version 300 es", "");
    if (!options.processor.parseGLES3) {
      return preparedSourceCode;
    }
  }
  const defines = options.defines;
  const preprocessors = PreparePreProcessors(options, engine);
  if (options.processor.preProcessor) {
    preparedSourceCode = options.processor.preProcessor(preparedSourceCode, defines, preprocessors, options.isFragment, options.processingContext);
  }
  const preProcessorsFromCode = {};
  preparedSourceCode = EvaluatePreProcessors(preparedSourceCode, preprocessors, options, preProcessorsFromCode);
  if (options.processor.postProcessor) {
    preparedSourceCode = options.processor.postProcessor(preparedSourceCode, defines, options.isFragment, options.processingContext, engine ? {
      drawBuffersExtensionDisabled: engine.getCaps().drawBuffersExtension ? false : true
    } : {}, preprocessors, preProcessorsFromCode);
  }
  if (engine?._features.needShaderCodeInlining) {
    preparedSourceCode = engine.inlineShaderCode(preparedSourceCode);
  }
  return preparedSourceCode;
}
function ProcessIncludes(sourceCode, options, callback) {
  ReusableMatches.length = 0;
  let match;
  while ((match = RegexShaderInclude.exec(sourceCode)) !== null) {
    ReusableMatches.push(match);
  }
  let returnValue = String(sourceCode);
  let parts = [sourceCode];
  let keepProcessing = false;
  for (const match2 of ReusableMatches) {
    let includeFile = match2[1];
    if (includeFile.indexOf("__decl__") !== -1) {
      includeFile = includeFile.replace(RegexShaderDecl, "");
      if (options.supportsUniformBuffers) {
        includeFile = includeFile.replace("Vertex", "Ubo").replace("Fragment", "Ubo");
      }
      includeFile = includeFile + "Declaration";
    }
    if (options.includesShadersStore[includeFile]) {
      let includeContent = options.includesShadersStore[includeFile];
      if (match2[2]) {
        const splits = match2[3].split(",");
        for (let index = 0; index < splits.length; index += 2) {
          const source = new RegExp(splits[index], "g");
          const dest = splits[index + 1];
          includeContent = includeContent.replace(source, dest);
        }
      }
      if (match2[4]) {
        const indexString = match2[5];
        if (indexString.indexOf("..") !== -1) {
          const indexSplits = indexString.split("..");
          const minIndex = parseInt(indexSplits[0]);
          let maxIndex = parseInt(indexSplits[1]);
          let sourceIncludeContent = includeContent.slice(0);
          includeContent = "";
          if (isNaN(maxIndex)) {
            maxIndex = options.indexParameters[indexSplits[1]];
          }
          for (let i = minIndex; i < maxIndex; i++) {
            if (!options.supportsUniformBuffers) {
              sourceIncludeContent = sourceIncludeContent.replace(RegexLightX, (str, p1) => {
                return p1 + "{X}";
              });
            }
            includeContent += sourceIncludeContent.replace(RegexX, i.toString()) + "\n";
          }
        } else {
          if (!options.supportsUniformBuffers) {
            includeContent = includeContent.replace(RegexLightX, (str, p1) => {
              return p1 + "{X}";
            });
          }
          includeContent = includeContent.replace(RegexX, indexString);
        }
      }
      const newParts = [];
      for (const part of parts) {
        const splitPart = part.split(match2[0]);
        for (let i = 0; i < splitPart.length - 1; i++) {
          newParts.push(splitPart[i]);
          newParts.push(includeContent);
        }
        newParts.push(splitPart[splitPart.length - 1]);
      }
      parts = newParts;
      keepProcessing = keepProcessing || includeContent.indexOf("#include<") >= 0 || includeContent.indexOf("#include <") >= 0;
    } else {
      const includeShaderUrl = options.shadersRepository + "ShadersInclude/" + includeFile + ".fx";
      _FunctionContainer.loadFile(includeShaderUrl, (fileContent) => {
        options.includesShadersStore[includeFile] = fileContent;
        ProcessIncludes(parts.join(""), options, callback);
      });
      return;
    }
  }
  ReusableMatches.length = 0;
  returnValue = parts.join("");
  if (keepProcessing) {
    ProcessIncludes(returnValue.toString(), options, callback);
  } else {
    callback(returnValue);
  }
}
var _FunctionContainer = {
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
  loadFile: (url, onSuccess, onProgress, offlineProvider, useArrayBuffer, onError) => {
    throw _WarnImport("FileTools");
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/effect.functions.js
function getCachedPipeline(name, context) {
  const stateObject = getStateObject(context);
  return stateObject.cachedPipelines[name];
}
function resetCachedPipeline(pipeline) {
  const name = pipeline._name;
  const context = pipeline.context;
  if (name && context) {
    const stateObject = getStateObject(context);
    const cachedPipeline = stateObject.cachedPipelines[name];
    cachedPipeline?.dispose();
    delete stateObject.cachedPipelines[name];
  }
}
function _ProcessShaderCode(processorOptions, baseName, processFinalCode, onFinalCodeReady, shaderLanguage, engine, effectContext) {
  let vertexSource;
  let fragmentSource;
  const hostDocument = IsWindowObjectExist() ? engine?.getHostDocument() : null;
  if (typeof baseName === "string") {
    vertexSource = baseName;
  } else if (baseName.vertexSource) {
    vertexSource = "source:" + baseName.vertexSource;
  } else if (baseName.vertexElement) {
    vertexSource = hostDocument?.getElementById(baseName.vertexElement) || baseName.vertexElement;
  } else {
    vertexSource = baseName.vertex || baseName;
  }
  if (typeof baseName === "string") {
    fragmentSource = baseName;
  } else if (baseName.fragmentSource) {
    fragmentSource = "source:" + baseName.fragmentSource;
  } else if (baseName.fragmentElement) {
    fragmentSource = hostDocument?.getElementById(baseName.fragmentElement) || baseName.fragmentElement;
  } else {
    fragmentSource = baseName.fragment || baseName;
  }
  const shaderCodes = [void 0, void 0];
  const shadersLoaded = () => {
    if (shaderCodes[0] && shaderCodes[1]) {
      processorOptions.isFragment = true;
      const [migratedVertexCode, fragmentCode] = shaderCodes;
      Process(fragmentCode, processorOptions, (migratedFragmentCode, codeBeforeMigration) => {
        if (effectContext) {
          effectContext._fragmentSourceCodeBeforeMigration = codeBeforeMigration;
        }
        if (processFinalCode) {
          migratedFragmentCode = processFinalCode("fragment", migratedFragmentCode);
        }
        const finalShaders = Finalize(migratedVertexCode, migratedFragmentCode, processorOptions);
        processorOptions = null;
        const finalCode = UseFinalCode(finalShaders.vertexCode, finalShaders.fragmentCode, baseName, shaderLanguage);
        onFinalCodeReady?.(finalCode.vertexSourceCode, finalCode.fragmentSourceCode);
      }, engine);
    }
  };
  LoadShader(vertexSource, "Vertex", "", (vertexCode) => {
    Initialize(processorOptions);
    Process(vertexCode, processorOptions, (migratedVertexCode, codeBeforeMigration) => {
      if (effectContext) {
        effectContext._rawVertexSourceCode = vertexCode;
        effectContext._vertexSourceCodeBeforeMigration = codeBeforeMigration;
      }
      if (processFinalCode) {
        migratedVertexCode = processFinalCode("vertex", migratedVertexCode);
      }
      shaderCodes[0] = migratedVertexCode;
      shadersLoaded();
    }, engine);
  }, shaderLanguage);
  LoadShader(fragmentSource, "Fragment", "Pixel", (fragmentCode) => {
    if (effectContext) {
      effectContext._rawFragmentSourceCode = fragmentCode;
    }
    shaderCodes[1] = fragmentCode;
    shadersLoaded();
  }, shaderLanguage);
}
function LoadShader(shader, key, optionalKey, callback, shaderLanguage, _loadFileInjection) {
  if (typeof HTMLElement !== "undefined") {
    if (shader instanceof HTMLElement) {
      const shaderCode = GetDOMTextContent(shader);
      callback(shaderCode);
      return;
    }
  }
  if (shader.substring(0, 7) === "source:") {
    callback(shader.substring(7));
    return;
  }
  if (shader.substring(0, 7) === "base64:") {
    const shaderBinary = window.atob(shader.substring(7));
    callback(shaderBinary);
    return;
  }
  const shaderStore = ShaderStore.GetShadersStore(shaderLanguage);
  if (shaderStore[shader + key + "Shader"]) {
    callback(shaderStore[shader + key + "Shader"]);
    return;
  }
  if (optionalKey && shaderStore[shader + optionalKey + "Shader"]) {
    callback(shaderStore[shader + optionalKey + "Shader"]);
    return;
  }
  let shaderUrl;
  if (shader[0] === "." || shader[0] === "/" || shader.indexOf("http") > -1) {
    shaderUrl = shader;
  } else {
    shaderUrl = ShaderStore.GetShadersRepository(shaderLanguage) + shader;
  }
  _loadFileInjection = _loadFileInjection || _LoadFile;
  if (!_loadFileInjection) {
    throw new Error("loadFileInjection is not defined");
  }
  _loadFileInjection(shaderUrl + "." + key.toLowerCase() + ".fx", callback);
}
function UseFinalCode(migratedVertexCode, migratedFragmentCode, baseName, shaderLanguage) {
  if (baseName) {
    const vertex = baseName.vertexElement || baseName.vertex || baseName.spectorName || baseName;
    const fragment = baseName.fragmentElement || baseName.fragment || baseName.spectorName || baseName;
    return {
      vertexSourceCode: (shaderLanguage === 1 ? "//" : "") + "#define SHADER_NAME vertex:" + vertex + "\n" + migratedVertexCode,
      fragmentSourceCode: (shaderLanguage === 1 ? "//" : "") + "#define SHADER_NAME fragment:" + fragment + "\n" + migratedFragmentCode
    };
  } else {
    return {
      vertexSourceCode: migratedVertexCode,
      fragmentSourceCode: migratedFragmentCode
    };
  }
}
var createAndPreparePipelineContext = (options, createPipelineContext2, _preparePipelineContext2, _executeWhenRenderingStateIsCompiled2) => {
  try {
    const stateObject = options.context ? getStateObject(options.context) : null;
    if (stateObject) {
      stateObject.disableParallelShaderCompile = options.disableParallelCompilation;
    }
    const pipelineContext = options.existingPipelineContext || createPipelineContext2(options.shaderProcessingContext);
    pipelineContext._name = options.name;
    if (options.name && stateObject) {
      stateObject.cachedPipelines[options.name] = pipelineContext;
    }
    _preparePipelineContext2(pipelineContext, options.vertex, options.fragment, !!options.createAsRaw, "", "", options.rebuildRebind, options.defines, options.transformFeedbackVaryings, "", () => {
      _executeWhenRenderingStateIsCompiled2(pipelineContext, () => {
        options.onRenderingStateCompiled?.(pipelineContext);
      });
    });
    return pipelineContext;
  } catch (e) {
    Logger.Error("Error compiling effect");
    throw e;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/effect.js
var Effect = class _Effect {
  /**
   * Gets or sets the relative url used to load shaders if using the engine in non-minified mode
   */
  static get ShadersRepository() {
    return ShaderStore.ShadersRepository;
  }
  static set ShadersRepository(repo) {
    ShaderStore.ShadersRepository = repo;
  }
  /**
   * Gets a boolean indicating that the effect was already disposed
   */
  get isDisposed() {
    return this._isDisposed;
  }
  /**
   * Observable that will be called when effect is bound.
   */
  get onBindObservable() {
    if (!this._onBindObservable) {
      this._onBindObservable = new Observable();
    }
    return this._onBindObservable;
  }
  /**
   * Gets the shader language type used to write vertex and fragment source code.
   */
  get shaderLanguage() {
    return this._shaderLanguage;
  }
  /**
   * Instantiates an effect.
   * An effect can be used to create/manage/execute vertex and fragment shaders.
   * @param baseName Name of the effect.
   * @param attributesNamesOrOptions List of attribute names that will be passed to the shader or set of all options to create the effect.
   * @param uniformsNamesOrEngine List of uniform variable names that will be passed to the shader or the engine that will be used to render effect.
   * @param samplers List of sampler variables that will be passed to the shader.
   * @param engine Engine to be used to render the effect
   * @param defines Define statements to be added to the shader.
   * @param fallbacks Possible fallbacks for this effect to improve performance when needed.
   * @param onCompiled Callback that will be called when the shader is compiled.
   * @param onError Callback that will be called if an error occurs during shader compilation.
   * @param indexParameters Parameters to be used with Babylons include syntax to iterate over an array (eg. \{lights: 10\})
   * @param key Effect Key identifying uniquely compiled shader variants
   * @param shaderLanguage the language the shader is written in (default: GLSL)
   * @param extraInitializationsAsync additional async code to run before preparing the effect
   */
  constructor(baseName, attributesNamesOrOptions, uniformsNamesOrEngine, samplers = null, engine, defines = null, fallbacks = null, onCompiled = null, onError = null, indexParameters, key = "", shaderLanguage = 0, extraInitializationsAsync) {
    this.defines = "";
    this.onCompiled = null;
    this.onError = null;
    this.onBind = null;
    this.uniqueId = 0;
    this.onCompileObservable = new Observable();
    this.onErrorObservable = new Observable();
    this._onBindObservable = null;
    this._isDisposed = false;
    this._refCount = 1;
    this._bonesComputationForcedToCPU = false;
    this._uniformBuffersNames = {};
    this._multiTarget = false;
    this._samplers = {};
    this._isReady = false;
    this._compilationError = "";
    this._allFallbacksProcessed = false;
    this._uniforms = {};
    this._key = "";
    this._fallbacks = null;
    this._vertexSourceCodeOverride = "";
    this._fragmentSourceCodeOverride = "";
    this._transformFeedbackVaryings = null;
    this._disableParallelShaderCompilation = false;
    this._pipelineContext = null;
    this._vertexSourceCode = "";
    this._fragmentSourceCode = "";
    this._vertexSourceCodeBeforeMigration = "";
    this._fragmentSourceCodeBeforeMigration = "";
    this._rawVertexSourceCode = "";
    this._rawFragmentSourceCode = "";
    this._processCodeAfterIncludes = void 0;
    this._processFinalCode = null;
    this._onReleaseEffectsObserver = null;
    this.name = baseName;
    this._key = key;
    const pipelineName = this._key.replace(/\r/g, "").replace(/\n/g, "|");
    let cachedPipeline = void 0;
    if (attributesNamesOrOptions.attributes) {
      const options = attributesNamesOrOptions;
      this._engine = uniformsNamesOrEngine;
      this._attributesNames = options.attributes;
      this._uniformsNames = options.uniformsNames.concat(options.samplers);
      this._samplerList = options.samplers.slice();
      this.defines = options.defines;
      this.onError = options.onError;
      this.onCompiled = options.onCompiled;
      this._fallbacks = options.fallbacks;
      this._indexParameters = options.indexParameters;
      this._transformFeedbackVaryings = options.transformFeedbackVaryings || null;
      this._multiTarget = !!options.multiTarget;
      this._shaderLanguage = options.shaderLanguage ?? 0;
      this._disableParallelShaderCompilation = !!options.disableParallelShaderCompilation;
      if (options.uniformBuffersNames) {
        this._uniformBuffersNamesList = options.uniformBuffersNames.slice();
        for (let i = 0; i < options.uniformBuffersNames.length; i++) {
          this._uniformBuffersNames[options.uniformBuffersNames[i]] = i;
        }
      }
      this._processFinalCode = options.processFinalCode ?? null;
      this._processCodeAfterIncludes = options.processCodeAfterIncludes ?? void 0;
      extraInitializationsAsync = options.extraInitializationsAsync;
      cachedPipeline = options.existingPipelineContext;
    } else {
      this._engine = engine;
      this.defines = defines == null ? "" : defines;
      this._uniformsNames = uniformsNamesOrEngine.concat(samplers);
      this._samplerList = samplers ? samplers.slice() : [];
      this._attributesNames = attributesNamesOrOptions;
      this._uniformBuffersNamesList = [];
      this._shaderLanguage = shaderLanguage;
      this.onError = onError;
      this.onCompiled = onCompiled;
      this._indexParameters = indexParameters;
      this._fallbacks = fallbacks;
    }
    if (this._engine.shaderPlatformName === "WEBGL2") {
      cachedPipeline = getCachedPipeline(pipelineName, this._engine._gl) ?? cachedPipeline;
    }
    this._attributeLocationByName = {};
    this.uniqueId = _Effect._UniqueIdSeed++;
    if (!cachedPipeline) {
      this._processShaderCodeAsync(null, false, null, extraInitializationsAsync);
    } else {
      this._pipelineContext = cachedPipeline;
      this._pipelineContext.setEngine(this._engine);
      this._onRenderingStateCompiled(this._pipelineContext);
      if (this._pipelineContext.program) {
        this._pipelineContext.program.__SPECTOR_rebuildProgram = this._rebuildProgram.bind(this);
      }
    }
    this._onReleaseEffectsObserver = this._engine.onReleaseEffectsObservable.addOnce(() => {
      this._onReleaseEffectsObserver = null;
      if (this.isDisposed) {
        return;
      }
      this.dispose(true);
    });
  }
  /** @internal */
  async _processShaderCodeAsync(shaderProcessor = null, keepExistingPipelineContext = false, shaderProcessingContext = null, extraInitializationsAsync) {
    if (extraInitializationsAsync) {
      await extraInitializationsAsync();
    }
    this._processingContext = shaderProcessingContext || this._engine._getShaderProcessingContext(this._shaderLanguage, false);
    const processorOptions = {
      defines: this.defines.split("\n"),
      indexParameters: this._indexParameters,
      isFragment: false,
      shouldUseHighPrecisionShader: this._engine._shouldUseHighPrecisionShader,
      processor: shaderProcessor ?? this._engine._getShaderProcessor(this._shaderLanguage),
      supportsUniformBuffers: this._engine.supportsUniformBuffers,
      shadersRepository: ShaderStore.GetShadersRepository(this._shaderLanguage),
      includesShadersStore: ShaderStore.GetIncludesShadersStore(this._shaderLanguage),
      version: (this._engine.version * 100).toString(),
      platformName: this._engine.shaderPlatformName,
      processingContext: this._processingContext,
      isNDCHalfZRange: this._engine.isNDCHalfZRange,
      useReverseDepthBuffer: this._engine.useReverseDepthBuffer,
      processCodeAfterIncludes: this._processCodeAfterIncludes
    };
    _ProcessShaderCode(processorOptions, this.name, this._processFinalCode, (migratedVertexCode, migratedFragmentCode) => {
      this._vertexSourceCode = migratedVertexCode;
      this._fragmentSourceCode = migratedFragmentCode;
      this._prepareEffect(keepExistingPipelineContext);
    }, this._shaderLanguage, this._engine, this);
  }
  /**
   * Unique key for this effect
   */
  get key() {
    return this._key;
  }
  /**
   * If the effect has been compiled and prepared.
   * @returns if the effect is compiled and prepared.
   */
  isReady() {
    try {
      return this._isReadyInternal();
    } catch {
      return false;
    }
  }
  _isReadyInternal() {
    if (this._engine.isDisposed) {
      return true;
    }
    if (this._isReady) {
      return true;
    }
    if (this._pipelineContext) {
      return this._pipelineContext.isReady;
    }
    return false;
  }
  /**
   * The engine the effect was initialized with.
   * @returns the engine.
   */
  getEngine() {
    return this._engine;
  }
  /**
   * The pipeline context for this effect
   * @returns the associated pipeline context
   */
  getPipelineContext() {
    return this._pipelineContext;
  }
  /**
   * The set of names of attribute variables for the shader.
   * @returns An array of attribute names.
   */
  getAttributesNames() {
    return this._attributesNames;
  }
  /**
   * Returns the attribute at the given index.
   * @param index The index of the attribute.
   * @returns The location of the attribute.
   */
  getAttributeLocation(index) {
    return this._attributes[index];
  }
  /**
   * Returns the attribute based on the name of the variable.
   * @param name of the attribute to look up.
   * @returns the attribute location.
   */
  getAttributeLocationByName(name) {
    return this._attributeLocationByName[name];
  }
  /**
   * The number of attributes.
   * @returns the number of attributes.
   */
  getAttributesCount() {
    return this._attributes.length;
  }
  /**
   * Gets the index of a uniform variable.
   * @param uniformName of the uniform to look up.
   * @returns the index.
   */
  getUniformIndex(uniformName) {
    return this._uniformsNames.indexOf(uniformName);
  }
  /**
   * Returns the attribute based on the name of the variable.
   * @param uniformName of the uniform to look up.
   * @returns the location of the uniform.
   */
  getUniform(uniformName) {
    return this._uniforms[uniformName];
  }
  /**
   * Returns an array of sampler variable names
   * @returns The array of sampler variable names.
   */
  getSamplers() {
    return this._samplerList;
  }
  /**
   * Returns an array of uniform variable names
   * @returns The array of uniform variable names.
   */
  getUniformNames() {
    return this._uniformsNames;
  }
  /**
   * Returns an array of uniform buffer variable names
   * @returns The array of uniform buffer variable names.
   */
  getUniformBuffersNames() {
    return this._uniformBuffersNamesList;
  }
  /**
   * Returns the index parameters used to create the effect
   * @returns The index parameters object
   */
  getIndexParameters() {
    return this._indexParameters;
  }
  /**
   * The error from the last compilation.
   * @returns the error string.
   */
  getCompilationError() {
    return this._compilationError;
  }
  /**
   * Gets a boolean indicating that all fallbacks were used during compilation
   * @returns true if all fallbacks were used
   */
  allFallbacksProcessed() {
    return this._allFallbacksProcessed;
  }
  /**
   * Wait until compilation before fulfilling.
   * @returns a promise to wait for completion.
   */
  async whenCompiledAsync() {
    return await new Promise((resolve) => {
      this.executeWhenCompiled(resolve);
    });
  }
  /**
   * Adds a callback to the onCompiled observable and call the callback immediately if already ready.
   * @param func The callback to be used.
   */
  executeWhenCompiled(func) {
    if (this.isReady()) {
      func(this);
      return;
    }
    this.onCompileObservable.add((effect) => {
      func(effect);
    });
    if (!this._pipelineContext || this._pipelineContext.isAsync) {
      this._checkIsReady(null);
    }
  }
  _checkIsReady(previousPipelineContext) {
    _RetryWithInterval(() => {
      return this._isReadyInternal() || this._isDisposed;
    }, () => {
    }, (e) => {
      this._processCompilationErrors(e, previousPipelineContext);
    }, 16, 12e4, true, ` - Effect: ${typeof this.name === "string" ? this.name : this.key}`);
  }
  /**
   * Gets the vertex shader source code of this effect
   * This is the final source code that will be compiled, after all the processing has been done (pre-processing applied, code injection/replacement, etc)
   */
  get vertexSourceCode() {
    return this._vertexSourceCodeOverride && this._fragmentSourceCodeOverride ? this._vertexSourceCodeOverride : this._pipelineContext?._getVertexShaderCode() ?? this._vertexSourceCode;
  }
  /**
   * Gets the fragment shader source code of this effect
   * This is the final source code that will be compiled, after all the processing has been done (pre-processing applied, code injection/replacement, etc)
   */
  get fragmentSourceCode() {
    return this._vertexSourceCodeOverride && this._fragmentSourceCodeOverride ? this._fragmentSourceCodeOverride : this._pipelineContext?._getFragmentShaderCode() ?? this._fragmentSourceCode;
  }
  /**
   * Gets the vertex shader source code before migration.
   * This is the source code after the include directives have been replaced by their contents but before the code is migrated, i.e. before ShaderProcess._ProcessShaderConversion is executed.
   * This method is, among other things, responsible for parsing #if/#define directives as well as converting GLES2 syntax to GLES3 (in the case of WebGL).
   */
  get vertexSourceCodeBeforeMigration() {
    return this._vertexSourceCodeBeforeMigration;
  }
  /**
   * Gets the fragment shader source code before migration.
   * This is the source code after the include directives have been replaced by their contents but before the code is migrated, i.e. before ShaderProcess._ProcessShaderConversion is executed.
   * This method is, among other things, responsible for parsing #if/#define directives as well as converting GLES2 syntax to GLES3 (in the case of WebGL).
   */
  get fragmentSourceCodeBeforeMigration() {
    return this._fragmentSourceCodeBeforeMigration;
  }
  /**
   * Gets the vertex shader source code before it has been modified by any processing
   */
  get rawVertexSourceCode() {
    return this._rawVertexSourceCode;
  }
  /**
   * Gets the fragment shader source code before it has been modified by any processing
   */
  get rawFragmentSourceCode() {
    return this._rawFragmentSourceCode;
  }
  getPipelineGenerationOptions() {
    return {
      platformName: this._engine.shaderPlatformName,
      shaderLanguage: this._shaderLanguage,
      shaderNameOrContent: this.name,
      key: this._key,
      defines: this.defines.split("\n"),
      addGlobalDefines: false,
      extendedProcessingOptions: {
        indexParameters: this._indexParameters,
        isNDCHalfZRange: this._engine.isNDCHalfZRange,
        useReverseDepthBuffer: this._engine.useReverseDepthBuffer,
        supportsUniformBuffers: this._engine.supportsUniformBuffers
      },
      extendedCreatePipelineOptions: {
        transformFeedbackVaryings: this._transformFeedbackVaryings,
        createAsRaw: !!(this._vertexSourceCodeOverride && this._fragmentSourceCodeOverride)
      }
    };
  }
  /**
   * Recompiles the webGL program
   * @param vertexSourceCode The source code for the vertex shader.
   * @param fragmentSourceCode The source code for the fragment shader.
   * @param onCompiled Callback called when completed.
   * @param onError Callback called on error.
   * @internal
   */
  _rebuildProgram(vertexSourceCode, fragmentSourceCode, onCompiled, onError) {
    this._isReady = false;
    this._vertexSourceCodeOverride = vertexSourceCode;
    this._fragmentSourceCodeOverride = fragmentSourceCode;
    this.onError = (effect, error) => {
      if (onError) {
        onError(error);
      }
    };
    this.onCompiled = () => {
      const scenes = this.getEngine().scenes;
      if (scenes) {
        for (let i = 0; i < scenes.length; i++) {
          scenes[i].markAllMaterialsAsDirty(127);
        }
      }
      this._pipelineContext._handlesSpectorRebuildCallback?.(onCompiled);
    };
    this._fallbacks = null;
    this._prepareEffect();
  }
  _onRenderingStateCompiled(pipelineContext) {
    this._pipelineContext = pipelineContext;
    this._pipelineContext.setEngine(this._engine);
    this._attributes = [];
    this._pipelineContext._fillEffectInformation(this, this._uniformBuffersNames, this._uniformsNames, this._uniforms, this._samplerList, this._samplers, this._attributesNames, this._attributes);
    if (this._attributesNames) {
      for (let i = 0; i < this._attributesNames.length; i++) {
        const name = this._attributesNames[i];
        this._attributeLocationByName[name] = this._attributes[i];
      }
    }
    this._engine.bindSamplers(this);
    this._compilationError = "";
    this._isReady = true;
    if (this.onCompiled) {
      this.onCompiled(this);
    }
    this.onCompileObservable.notifyObservers(this);
    this.onCompileObservable.clear();
    if (this._fallbacks) {
      this._fallbacks.unBindMesh();
    }
    if (_Effect.AutomaticallyClearCodeCache) {
      this.clearCodeCache();
    }
  }
  /**
   * Prepares the effect
   * @internal
   */
  _prepareEffect(keepExistingPipelineContext = false) {
    const previousPipelineContext = this._pipelineContext;
    this._isReady = false;
    try {
      const overrides = !!(this._vertexSourceCodeOverride && this._fragmentSourceCodeOverride);
      const defines = overrides ? null : this.defines;
      const vertex = overrides ? this._vertexSourceCodeOverride : this._vertexSourceCode;
      const fragment = overrides ? this._fragmentSourceCodeOverride : this._fragmentSourceCode;
      const engine = this._engine;
      this._pipelineContext = createAndPreparePipelineContext({
        existingPipelineContext: keepExistingPipelineContext ? previousPipelineContext : null,
        vertex,
        fragment,
        context: engine.shaderPlatformName === "WEBGL2" || engine.shaderPlatformName === "WEBGL1" ? engine._gl : void 0,
        rebuildRebind: (vertexSourceCode, fragmentSourceCode, onCompiled, onError) => this._rebuildProgram(vertexSourceCode, fragmentSourceCode, onCompiled, onError),
        defines,
        transformFeedbackVaryings: this._transformFeedbackVaryings,
        name: this._key.replace(/\r/g, "").replace(/\n/g, "|"),
        createAsRaw: overrides,
        disableParallelCompilation: this._disableParallelShaderCompilation,
        shaderProcessingContext: this._processingContext,
        onRenderingStateCompiled: (pipelineContext) => {
          if (previousPipelineContext && !keepExistingPipelineContext) {
            this._engine._deletePipelineContext(previousPipelineContext);
          }
          if (pipelineContext) {
            this._onRenderingStateCompiled(pipelineContext);
          }
        }
      }, this._engine.createPipelineContext.bind(this._engine), this._engine._preparePipelineContextAsync.bind(this._engine), this._engine._executeWhenRenderingStateIsCompiled.bind(this._engine));
      if (this._pipelineContext.isAsync) {
        this._checkIsReady(previousPipelineContext);
      }
    } catch (e) {
      this._processCompilationErrors(e, previousPipelineContext);
    }
  }
  _getShaderCodeAndErrorLine(code, error, isFragment) {
    const regexp = isFragment ? /FRAGMENT SHADER ERROR: 0:(\d+?):/ : /VERTEX SHADER ERROR: 0:(\d+?):/;
    let errorLine = null;
    if (error && code) {
      const res = error.match(regexp);
      if (res && res.length === 2) {
        const lineNumber = parseInt(res[1]);
        const lines = code.split("\n", -1);
        if (lines.length >= lineNumber) {
          errorLine = `Offending line [${lineNumber}] in ${isFragment ? "fragment" : "vertex"} code: ${lines[lineNumber - 1]}`;
        }
      }
    }
    return [code, errorLine];
  }
  _processCompilationErrors(e, previousPipelineContext = null) {
    this._compilationError = e.message;
    const attributesNames = this._attributesNames;
    const fallbacks = this._fallbacks;
    Logger.Error("Unable to compile effect:");
    Logger.Error(`Uniforms: ${this._uniformsNames.join(" ")}`);
    Logger.Error(`Attributes: ${attributesNames.join(" ")}`);
    Logger.Error("Defines:\n" + this.defines);
    if (_Effect.LogShaderCodeOnCompilationError) {
      let lineErrorVertex = null, lineErrorFragment = null, code = null;
      if (this._pipelineContext?._getVertexShaderCode()) {
        [code, lineErrorVertex] = this._getShaderCodeAndErrorLine(this._pipelineContext._getVertexShaderCode(), this._compilationError, false);
        if (code) {
          Logger.Error("Vertex code:");
          Logger.Error(code);
        }
      }
      if (this._pipelineContext?._getFragmentShaderCode()) {
        [code, lineErrorFragment] = this._getShaderCodeAndErrorLine(this._pipelineContext?._getFragmentShaderCode(), this._compilationError, true);
        if (code) {
          Logger.Error("Fragment code:");
          Logger.Error(code);
        }
      }
      if (lineErrorVertex) {
        Logger.Error(lineErrorVertex);
      }
      if (lineErrorFragment) {
        Logger.Error(lineErrorFragment);
      }
    }
    Logger.Error("Error: " + this._compilationError);
    const notifyErrors = () => {
      if (this.onError) {
        this.onError(this, this._compilationError);
      }
      this.onErrorObservable.notifyObservers(this);
      this._engine.onEffectErrorObservable.notifyObservers({ effect: this, errors: this._compilationError });
    };
    if (previousPipelineContext) {
      this._pipelineContext = previousPipelineContext;
      this._isReady = true;
      notifyErrors();
    }
    if (fallbacks) {
      this._pipelineContext = null;
      if (fallbacks.hasMoreFallbacks) {
        this._allFallbacksProcessed = false;
        Logger.Error("Trying next fallback.");
        this.defines = fallbacks.reduce(this.defines, this);
        this._prepareEffect();
      } else {
        this._allFallbacksProcessed = true;
        notifyErrors();
        this.onErrorObservable.clear();
        if (this._fallbacks) {
          this._fallbacks.unBindMesh();
        }
      }
    } else {
      this._allFallbacksProcessed = true;
      if (!previousPipelineContext) {
        notifyErrors();
      }
    }
  }
  /**
   * Checks if the effect is supported. (Must be called after compilation)
   */
  get isSupported() {
    return this._compilationError === "";
  }
  /**
   * Binds a texture to the engine to be used as output of the shader.
   * @param channel Name of the output variable.
   * @param texture Texture to bind.
   * @internal
   */
  _bindTexture(channel, texture) {
    this._engine._bindTexture(this._samplers[channel], texture, channel);
  }
  /**
   * Sets a texture on the engine to be used in the shader.
   * @param channel Name of the sampler variable.
   * @param texture Texture to set.
   */
  setTexture(channel, texture) {
    this._engine.setTexture(this._samplers[channel], this._uniforms[channel], texture, channel);
  }
  /**
   * Sets an array of textures on the engine to be used in the shader.
   * @param channel Name of the variable.
   * @param textures Textures to set.
   */
  setTextureArray(channel, textures) {
    const exName = channel + "Ex";
    if (this._samplerList.indexOf(exName + "0") === -1) {
      const initialPos = this._samplerList.indexOf(channel);
      for (let index = 1; index < textures.length; index++) {
        const currentExName = exName + (index - 1).toString();
        this._samplerList.splice(initialPos + index, 0, currentExName);
      }
      let channelIndex = 0;
      for (const key of this._samplerList) {
        this._samplers[key] = channelIndex;
        channelIndex += 1;
      }
    }
    this._engine.setTextureArray(this._samplers[channel], this._uniforms[channel], textures, channel);
  }
  /**
   * Binds a buffer to a uniform.
   * @param buffer Buffer to bind.
   * @param name Name of the uniform variable to bind to.
   */
  bindUniformBuffer(buffer, name) {
    const bufferName = this._uniformBuffersNames[name];
    if (bufferName === void 0 || _Effect._BaseCache[bufferName] === buffer && this._engine._features.useUBOBindingCache) {
      return;
    }
    _Effect._BaseCache[bufferName] = buffer;
    this._engine.bindUniformBufferBase(buffer, bufferName, name);
  }
  /**
   * Binds block to a uniform.
   * @param blockName Name of the block to bind.
   * @param index Index to bind.
   */
  bindUniformBlock(blockName, index) {
    this._engine.bindUniformBlock(this._pipelineContext, blockName, index);
  }
  /**
   * Sets an integer value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value Value to be set.
   * @returns this effect.
   */
  setInt(uniformName, value) {
    this._pipelineContext.setInt(uniformName, value);
    return this;
  }
  /**
   * Sets an int2 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int2.
   * @param y Second int in int2.
   * @returns this effect.
   */
  setInt2(uniformName, x, y) {
    this._pipelineContext.setInt2(uniformName, x, y);
    return this;
  }
  /**
   * Sets an int3 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int3.
   * @param y Second int in int3.
   * @param z Third int in int3.
   * @returns this effect.
   */
  setInt3(uniformName, x, y, z) {
    this._pipelineContext.setInt3(uniformName, x, y, z);
    return this;
  }
  /**
   * Sets an int4 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First int in int4.
   * @param y Second int in int4.
   * @param z Third int in int4.
   * @param w Fourth int in int4.
   * @returns this effect.
   */
  setInt4(uniformName, x, y, z, w) {
    this._pipelineContext.setInt4(uniformName, x, y, z, w);
    return this;
  }
  /**
   * Sets an int array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setIntArray(uniformName, array) {
    this._pipelineContext.setIntArray(uniformName, array);
    return this;
  }
  /**
   * Sets an int array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setIntArray2(uniformName, array) {
    this._pipelineContext.setIntArray2(uniformName, array);
    return this;
  }
  /**
   * Sets an int array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setIntArray3(uniformName, array) {
    this._pipelineContext.setIntArray3(uniformName, array);
    return this;
  }
  /**
   * Sets an int array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setIntArray4(uniformName, array) {
    this._pipelineContext.setIntArray4(uniformName, array);
    return this;
  }
  /**
   * Sets an unsigned integer value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value Value to be set.
   * @returns this effect.
   */
  setUInt(uniformName, value) {
    this._pipelineContext.setUInt(uniformName, value);
    return this;
  }
  /**
   * Sets an unsigned int2 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint2.
   * @param y Second unsigned int in uint2.
   * @returns this effect.
   */
  setUInt2(uniformName, x, y) {
    this._pipelineContext.setUInt2(uniformName, x, y);
    return this;
  }
  /**
   * Sets an unsigned int3 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint3.
   * @param y Second unsigned int in uint3.
   * @param z Third unsigned int in uint3.
   * @returns this effect.
   */
  setUInt3(uniformName, x, y, z) {
    this._pipelineContext.setUInt3(uniformName, x, y, z);
    return this;
  }
  /**
   * Sets an unsigned int4 value on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First unsigned int in uint4.
   * @param y Second unsigned int in uint4.
   * @param z Third unsigned int in uint4.
   * @param w Fourth unsigned int in uint4.
   * @returns this effect.
   */
  setUInt4(uniformName, x, y, z, w) {
    this._pipelineContext.setUInt4(uniformName, x, y, z, w);
    return this;
  }
  /**
   * Sets an unsigned int array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setUIntArray(uniformName, array) {
    this._pipelineContext.setUIntArray(uniformName, array);
    return this;
  }
  /**
   * Sets an unsigned int array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setUIntArray2(uniformName, array) {
    this._pipelineContext.setUIntArray2(uniformName, array);
    return this;
  }
  /**
   * Sets an unsigned int array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setUIntArray3(uniformName, array) {
    this._pipelineContext.setUIntArray3(uniformName, array);
    return this;
  }
  /**
   * Sets an unsigned int array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setUIntArray4(uniformName, array) {
    this._pipelineContext.setUIntArray4(uniformName, array);
    return this;
  }
  /**
   * Sets an float array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setFloatArray(uniformName, array) {
    this._pipelineContext.setArray(uniformName, array);
    return this;
  }
  /**
   * Sets an float array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setFloatArray2(uniformName, array) {
    this._pipelineContext.setArray2(uniformName, array);
    return this;
  }
  /**
   * Sets an float array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setFloatArray3(uniformName, array) {
    this._pipelineContext.setArray3(uniformName, array);
    return this;
  }
  /**
   * Sets an float array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setFloatArray4(uniformName, array) {
    this._pipelineContext.setArray4(uniformName, array);
    return this;
  }
  /**
   * Sets an array on a uniform variable.
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setArray(uniformName, array) {
    this._pipelineContext.setArray(uniformName, array);
    return this;
  }
  /**
   * Sets an array 2 on a uniform variable. (Array is specified as single array eg. [1,2,3,4] will result in [[1,2],[3,4]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setArray2(uniformName, array) {
    this._pipelineContext.setArray2(uniformName, array);
    return this;
  }
  /**
   * Sets an array 3 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6] will result in [[1,2,3],[4,5,6]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setArray3(uniformName, array) {
    this._pipelineContext.setArray3(uniformName, array);
    return this;
  }
  /**
   * Sets an array 4 on a uniform variable. (Array is specified as single array eg. [1,2,3,4,5,6,7,8] will result in [[1,2,3,4],[5,6,7,8]] in the shader)
   * @param uniformName Name of the variable.
   * @param array array to be set.
   * @returns this effect.
   */
  setArray4(uniformName, array) {
    this._pipelineContext.setArray4(uniformName, array);
    return this;
  }
  /**
   * Sets matrices on a uniform variable.
   * @param uniformName Name of the variable.
   * @param matrices matrices to be set.
   * @returns this effect.
   */
  setMatrices(uniformName, matrices) {
    this._pipelineContext.setMatrices(uniformName, matrices);
    return this;
  }
  /**
   * Sets matrix on a uniform variable.
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   * @returns this effect.
   */
  setMatrix(uniformName, matrix) {
    this._pipelineContext.setMatrix(uniformName, matrix);
    return this;
  }
  /**
   * Sets a 3x3 matrix on a uniform variable. (Specified as [1,2,3,4,5,6,7,8,9] will result in [1,2,3][4,5,6][7,8,9] matrix)
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   * @returns this effect.
   */
  setMatrix3x3(uniformName, matrix) {
    this._pipelineContext.setMatrix3x3(uniformName, matrix);
    return this;
  }
  /**
   * Sets a 2x2 matrix on a uniform variable. (Specified as [1,2,3,4] will result in [1,2][3,4] matrix)
   * @param uniformName Name of the variable.
   * @param matrix matrix to be set.
   * @returns this effect.
   */
  setMatrix2x2(uniformName, matrix) {
    this._pipelineContext.setMatrix2x2(uniformName, matrix);
    return this;
  }
  /**
   * Sets a float on a uniform variable.
   * @param uniformName Name of the variable.
   * @param value value to be set.
   * @returns this effect.
   */
  setFloat(uniformName, value) {
    this._pipelineContext.setFloat(uniformName, value);
    return this;
  }
  /**
   * Sets a boolean on a uniform variable.
   * @param uniformName Name of the variable.
   * @param bool value to be set.
   * @returns this effect.
   */
  setBool(uniformName, bool) {
    this._pipelineContext.setInt(uniformName, bool ? 1 : 0);
    return this;
  }
  /**
   * Sets a Vector2 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector2 vector2 to be set.
   * @returns this effect.
   */
  setVector2(uniformName, vector2) {
    this._pipelineContext.setVector2(uniformName, vector2);
    return this;
  }
  /**
   * Sets a float2 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float2.
   * @param y Second float in float2.
   * @returns this effect.
   */
  setFloat2(uniformName, x, y) {
    this._pipelineContext.setFloat2(uniformName, x, y);
    return this;
  }
  /**
   * Sets a Vector3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector3 Value to be set.
   * @returns this effect.
   */
  setVector3(uniformName, vector3) {
    this._pipelineContext.setVector3(uniformName, vector3);
    return this;
  }
  /**
   * Sets a float3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float3.
   * @param y Second float in float3.
   * @param z Third float in float3.
   * @returns this effect.
   */
  setFloat3(uniformName, x, y, z) {
    this._pipelineContext.setFloat3(uniformName, x, y, z);
    return this;
  }
  /**
   * Sets a Vector4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param vector4 Value to be set.
   * @returns this effect.
   */
  setVector4(uniformName, vector4) {
    this._pipelineContext.setVector4(uniformName, vector4);
    return this;
  }
  /**
   * Sets a Quaternion on a uniform variable.
   * @param uniformName Name of the variable.
   * @param quaternion Value to be set.
   * @returns this effect.
   */
  setQuaternion(uniformName, quaternion) {
    this._pipelineContext.setQuaternion(uniformName, quaternion);
    return this;
  }
  /**
   * Sets a float4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param x First float in float4.
   * @param y Second float in float4.
   * @param z Third float in float4.
   * @param w Fourth float in float4.
   * @returns this effect.
   */
  setFloat4(uniformName, x, y, z, w) {
    this._pipelineContext.setFloat4(uniformName, x, y, z, w);
    return this;
  }
  /**
   * Sets a Color3 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param color3 Value to be set.
   * @returns this effect.
   */
  setColor3(uniformName, color3) {
    this._pipelineContext.setColor3(uniformName, color3);
    return this;
  }
  /**
   * Sets a Color4 on a uniform variable.
   * @param uniformName Name of the variable.
   * @param color3 Value to be set.
   * @param alpha Alpha value to be set.
   * @returns this effect.
   */
  setColor4(uniformName, color3, alpha) {
    this._pipelineContext.setColor4(uniformName, color3, alpha);
    return this;
  }
  /**
   * Sets a Color4 on a uniform variable
   * @param uniformName defines the name of the variable
   * @param color4 defines the value to be set
   * @returns this effect.
   */
  setDirectColor4(uniformName, color4) {
    this._pipelineContext.setDirectColor4(uniformName, color4);
    return this;
  }
  /**
   * Use this wisely: It will remove the cached code from this effect
   * It is probably ok to call it if you are not using ShadowDepthWrapper or if everything is already up and running
   * DO NOT CALL IT if you want to have support for context lost recovery
   */
  clearCodeCache() {
    this._vertexSourceCode = "";
    this._fragmentSourceCode = "";
    this._fragmentSourceCodeBeforeMigration = "";
    this._vertexSourceCodeBeforeMigration = "";
  }
  /**
   * Release all associated resources.
   * @param force specifies if the effect must be released no matter what
   **/
  dispose(force = false) {
    if (force) {
      this._refCount = 0;
    } else {
      if (_Effect.PersistentMode) {
        return;
      }
      this._refCount--;
    }
    if (this._refCount > 0 || this._isDisposed) {
      return;
    }
    if (this._onReleaseEffectsObserver) {
      this._engine.onReleaseEffectsObservable.remove(this._onReleaseEffectsObserver);
      this._onReleaseEffectsObserver = null;
    }
    if (this._pipelineContext) {
      resetCachedPipeline(this._pipelineContext);
    }
    this._engine._releaseEffect(this);
    this.clearCodeCache();
    this._isDisposed = true;
  }
  /**
   * This function will add a new shader to the shader store
   * @param name the name of the shader
   * @param pixelShader optional pixel shader content
   * @param vertexShader optional vertex shader content
   * @param shaderLanguage the language the shader is written in (default: GLSL)
   */
  static RegisterShader(name, pixelShader, vertexShader, shaderLanguage = 0) {
    if (pixelShader) {
      ShaderStore.GetShadersStore(shaderLanguage)[`${name}PixelShader`] = pixelShader;
    }
    if (vertexShader) {
      ShaderStore.GetShadersStore(shaderLanguage)[`${name}VertexShader`] = vertexShader;
    }
  }
  /**
   * Resets the cache of effects.
   */
  static ResetCache() {
    _Effect._BaseCache = {};
  }
};
Effect.LogShaderCodeOnCompilationError = true;
Effect.PersistentMode = false;
Effect.AutomaticallyClearCodeCache = false;
Effect._UniqueIdSeed = 0;
Effect._BaseCache = {};
Effect.ShadersStore = ShaderStore.ShadersStore;
Effect.IncludesShadersStore = ShaderStore.IncludesShadersStore;

export {
  EngineFunctionContext,
  _ConcatenateShader,
  _LoadFile,
  _GetGlobalDefines,
  allocateAndCopyTypedBuffer,
  ProcessIncludes,
  _FunctionContainer,
  getStateObject,
  deleteStateObject,
  createRawShaderProgram,
  createShaderProgram,
  createPipelineContext,
  _createShaderProgram,
  _isRenderingStateCompiled,
  _finalizePipelineContext,
  _preparePipelineContext,
  _setProgram,
  _executeWhenRenderingStateIsCompiled,
  resetCachedPipeline,
  Effect
};
//# sourceMappingURL=chunk-RG742WGM.js.map
