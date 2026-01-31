import {
  Logger
} from "./chunk-57LBGEP2.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/error.js
var BaseError = class extends Error {
};
BaseError._setPrototypeOf = Object.setPrototypeOf || ((o, proto) => {
  o.__proto__ = proto;
  return o;
});
var ErrorCodes = {
  // Mesh errors 0-999
  /** Invalid or empty mesh vertex positions. */
  MeshInvalidPositionsError: 0,
  // Texture errors 1000-1999
  /** Unsupported texture found. */
  UnsupportedTextureError: 1e3,
  // GLTFLoader errors 2000-2999
  /** Unexpected magic number found in GLTF file header. */
  GLTFLoaderUnexpectedMagicError: 2e3,
  // SceneLoader errors 3000-3999
  /** SceneLoader generic error code. Ideally wraps the inner exception. */
  SceneLoaderError: 3e3,
  // File related errors 4000-4999
  /** Load file error */
  LoadFileError: 4e3,
  /** Request file error */
  RequestFileError: 4001,
  /** Read file error */
  ReadFileError: 4002
};
var RuntimeError = class _RuntimeError extends BaseError {
  /**
   * Creates a new RuntimeError
   * @param message defines the message of the error
   * @param errorCode the error code
   * @param innerError the error that caused the outer error
   */
  constructor(message, errorCode, innerError) {
    super(message);
    this.errorCode = errorCode;
    this.innerError = innerError;
    this.name = "RuntimeError";
    BaseError._setPrototypeOf(this, _RuntimeError.prototype);
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Buffers/bufferUtils.js
function GetFloatValue(dataView, type, byteOffset, normalized) {
  switch (type) {
    case 5120: {
      let value = dataView.getInt8(byteOffset);
      if (normalized) {
        value = Math.max(value / 127, -1);
      }
      return value;
    }
    case 5121: {
      let value = dataView.getUint8(byteOffset);
      if (normalized) {
        value = value / 255;
      }
      return value;
    }
    case 5122: {
      let value = dataView.getInt16(byteOffset, true);
      if (normalized) {
        value = Math.max(value / 32767, -1);
      }
      return value;
    }
    case 5123: {
      let value = dataView.getUint16(byteOffset, true);
      if (normalized) {
        value = value / 65535;
      }
      return value;
    }
    case 5124: {
      return dataView.getInt32(byteOffset, true);
    }
    case 5125: {
      return dataView.getUint32(byteOffset, true);
    }
    case 5126: {
      return dataView.getFloat32(byteOffset, true);
    }
    default: {
      throw new Error(`Invalid component type ${type}`);
    }
  }
}
function SetFloatValue(dataView, type, byteOffset, normalized, value) {
  switch (type) {
    case 5120: {
      if (normalized) {
        value = Math.round(value * 127);
      }
      dataView.setInt8(byteOffset, value);
      break;
    }
    case 5121: {
      if (normalized) {
        value = Math.round(value * 255);
      }
      dataView.setUint8(byteOffset, value);
      break;
    }
    case 5122: {
      if (normalized) {
        value = Math.round(value * 32767);
      }
      dataView.setInt16(byteOffset, value, true);
      break;
    }
    case 5123: {
      if (normalized) {
        value = Math.round(value * 65535);
      }
      dataView.setUint16(byteOffset, value, true);
      break;
    }
    case 5124: {
      dataView.setInt32(byteOffset, value, true);
      break;
    }
    case 5125: {
      dataView.setUint32(byteOffset, value, true);
      break;
    }
    case 5126: {
      dataView.setFloat32(byteOffset, value, true);
      break;
    }
    default: {
      throw new Error(`Invalid component type ${type}`);
    }
  }
}
function GetTypeByteLength(type) {
  switch (type) {
    case 5120:
    case 5121:
      return 1;
    case 5122:
    case 5123:
      return 2;
    case 5124:
    case 5125:
    case 5126:
      return 4;
    default:
      throw new Error(`Invalid type '${type}'`);
  }
}
function GetTypedArrayConstructor(componentType) {
  switch (componentType) {
    case 5120:
      return Int8Array;
    case 5121:
      return Uint8Array;
    case 5122:
      return Int16Array;
    case 5123:
      return Uint16Array;
    case 5124:
      return Int32Array;
    case 5125:
      return Uint32Array;
    case 5126:
      return Float32Array;
    default:
      throw new Error(`Invalid component type '${componentType}'`);
  }
}
function EnumerateFloatValues(data, byteOffset, byteStride, componentCount, componentType, count, normalized, callback) {
  const oldValues = new Array(componentCount);
  const newValues = new Array(componentCount);
  if (data instanceof Array) {
    let offset = byteOffset / 4;
    const stride = byteStride / 4;
    for (let index = 0; index < count; index += componentCount) {
      for (let componentIndex = 0; componentIndex < componentCount; componentIndex++) {
        oldValues[componentIndex] = newValues[componentIndex] = data[offset + componentIndex];
      }
      callback(newValues, index);
      for (let componentIndex = 0; componentIndex < componentCount; componentIndex++) {
        if (oldValues[componentIndex] !== newValues[componentIndex]) {
          data[offset + componentIndex] = newValues[componentIndex];
        }
      }
      offset += stride;
    }
  } else {
    const dataView = !ArrayBuffer.isView(data) ? new DataView(data) : new DataView(data.buffer, data.byteOffset, data.byteLength);
    const componentByteLength = GetTypeByteLength(componentType);
    for (let index = 0; index < count; index += componentCount) {
      for (let componentIndex = 0, componentByteOffset = byteOffset; componentIndex < componentCount; componentIndex++, componentByteOffset += componentByteLength) {
        oldValues[componentIndex] = newValues[componentIndex] = GetFloatValue(dataView, componentType, componentByteOffset, normalized);
      }
      callback(newValues, index);
      for (let componentIndex = 0, componentByteOffset = byteOffset; componentIndex < componentCount; componentIndex++, componentByteOffset += componentByteLength) {
        if (oldValues[componentIndex] !== newValues[componentIndex]) {
          SetFloatValue(dataView, componentType, componentByteOffset, normalized, newValues[componentIndex]);
        }
      }
      byteOffset += byteStride;
    }
  }
}
function GetFloatData(data, size, type, byteOffset, byteStride, normalized, totalVertices, forceCopy) {
  const tightlyPackedByteStride = size * GetTypeByteLength(type);
  const count = totalVertices * size;
  if (type !== 5126 || byteStride !== tightlyPackedByteStride) {
    const copy = new Float32Array(count);
    EnumerateFloatValues(data, byteOffset, byteStride, size, type, count, normalized, (values, index) => {
      for (let i = 0; i < size; i++) {
        copy[index + i] = values[i];
      }
    });
    return copy;
  }
  if (!(data instanceof Array || data instanceof Float32Array) || byteOffset !== 0 || data.length !== count) {
    if (data instanceof Array) {
      const offset = byteOffset / 4;
      return data.slice(offset, offset + count);
    } else if (ArrayBuffer.isView(data)) {
      const offset = data.byteOffset + byteOffset;
      if ((offset & 3) !== 0) {
        Logger.Warn("Float array must be aligned to 4-bytes border");
        forceCopy = true;
      }
      if (forceCopy) {
        return new Float32Array(data.buffer.slice(offset, offset + count * Float32Array.BYTES_PER_ELEMENT));
      } else {
        return new Float32Array(data.buffer, offset, count);
      }
    } else {
      return new Float32Array(data, byteOffset, count);
    }
  }
  if (forceCopy) {
    return data.slice();
  }
  return data;
}
function GetTypedArrayData(data, size, type, byteOffset, byteStride, totalVertices, forceCopy) {
  const typeByteLength = GetTypeByteLength(type);
  const constructor = GetTypedArrayConstructor(type);
  const count = totalVertices * size;
  if (Array.isArray(data)) {
    if ((byteOffset & 3) !== 0 || (byteStride & 3) !== 0) {
      throw new Error("byteOffset and byteStride must be a multiple of 4 for number[] data.");
    }
    const offset = byteOffset / 4;
    const stride = byteStride / 4;
    const lastIndex = offset + (totalVertices - 1) * stride + size;
    if (lastIndex > data.length) {
      throw new Error("Last accessed index is out of bounds.");
    }
    if (stride < size) {
      throw new Error("Data stride cannot be smaller than the component size.");
    }
    if (stride !== size) {
      const copy = new constructor(count);
      EnumerateFloatValues(data, byteOffset, byteStride, size, type, count, false, (values, index) => {
        for (let i = 0; i < size; i++) {
          copy[index + i] = values[i];
        }
      });
      return copy;
    }
    return new constructor(data.slice(offset, offset + count));
  }
  let buffer;
  let adjustedByteOffset = byteOffset;
  if (ArrayBuffer.isView(data)) {
    buffer = data.buffer;
    adjustedByteOffset += data.byteOffset;
  } else {
    buffer = data;
  }
  const lastByteOffset = adjustedByteOffset + (totalVertices - 1) * byteStride + size * typeByteLength;
  if (lastByteOffset > buffer.byteLength) {
    throw new Error("Last accessed byte is out of bounds.");
  }
  const tightlyPackedByteStride = size * typeByteLength;
  if (byteStride < tightlyPackedByteStride) {
    throw new Error("Byte stride cannot be smaller than the component's byte size.");
  }
  if (byteStride !== tightlyPackedByteStride) {
    const copy = new constructor(count);
    EnumerateFloatValues(buffer, adjustedByteOffset, byteStride, size, type, count, false, (values, index) => {
      for (let i = 0; i < size; i++) {
        copy[index + i] = values[i];
      }
    });
    return copy;
  }
  if (typeByteLength !== 1 && (adjustedByteOffset & typeByteLength - 1) !== 0) {
    Logger.Warn("Array must be aligned to border of element size. Data will be copied.");
    forceCopy = true;
  }
  if (forceCopy) {
    return new constructor(buffer.slice(adjustedByteOffset, adjustedByteOffset + count * typeByteLength));
  }
  return new constructor(buffer, adjustedByteOffset, count);
}
function CopyFloatData(input, size, type, byteOffset, byteStride, normalized, totalVertices, output) {
  const tightlyPackedByteStride = size * GetTypeByteLength(type);
  const count = totalVertices * size;
  if (output.length !== count) {
    throw new Error("Output length is not valid");
  }
  if (type !== 5126 || byteStride !== tightlyPackedByteStride) {
    EnumerateFloatValues(input, byteOffset, byteStride, size, type, count, normalized, (values, index) => {
      for (let i = 0; i < size; i++) {
        output[index + i] = values[i];
      }
    });
    return;
  }
  if (input instanceof Array) {
    const offset = byteOffset / 4;
    output.set(input, offset);
  } else if (ArrayBuffer.isView(input)) {
    const offset = input.byteOffset + byteOffset;
    if ((offset & 3) !== 0) {
      Logger.Warn("Float array must be aligned to 4-bytes border");
      output.set(new Float32Array(input.buffer.slice(offset, offset + count * Float32Array.BYTES_PER_ELEMENT)));
      return;
    }
    const floatData = new Float32Array(input.buffer, offset, count);
    output.set(floatData);
  } else {
    const floatData = new Float32Array(input, byteOffset, count);
    output.set(floatData);
  }
}
function GetBlobBufferSource(view) {
  const buffer = view.buffer;
  if (buffer instanceof ArrayBuffer) {
    return view;
  }
  const unsharedBuffer = new ArrayBuffer(view.byteLength);
  const copyView = new Uint8Array(unsharedBuffer);
  copyView.set(new Uint8Array(buffer, view.byteOffset, view.byteLength));
  return unsharedBuffer;
}

export {
  GetTypeByteLength,
  GetTypedArrayConstructor,
  EnumerateFloatValues,
  GetFloatData,
  GetTypedArrayData,
  CopyFloatData,
  GetBlobBufferSource,
  BaseError,
  ErrorCodes,
  RuntimeError
};
//# sourceMappingURL=chunk-QD4Q3FLX.js.map
