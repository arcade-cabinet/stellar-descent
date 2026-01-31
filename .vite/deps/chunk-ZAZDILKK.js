import {
  ThinEngine
} from "./chunk-SI3ZTALR.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Extensions/engine.alpha.js
ThinEngine.prototype.setAlphaMode = function(mode, noDepthWriteChange = false, targetIndex = 0) {
  if (this._alphaMode[targetIndex] === mode) {
    if (!noDepthWriteChange) {
      const depthMask = mode === 0;
      if (this.depthCullingState.depthMask !== depthMask) {
        this.depthCullingState.depthMask = depthMask;
      }
    }
    return;
  }
  const alphaBlendDisabled = mode === 0;
  this._alphaState.setAlphaBlend(!alphaBlendDisabled, targetIndex);
  this._alphaState.setAlphaMode(mode, targetIndex);
  if (!noDepthWriteChange) {
    this.depthCullingState.depthMask = alphaBlendDisabled;
  }
  this._alphaMode[targetIndex] = mode;
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Extensions/engine.dynamicBuffer.js
ThinEngine.prototype.updateDynamicIndexBuffer = function(indexBuffer, indices, offset = 0) {
  this._currentBoundBuffer[this._gl.ELEMENT_ARRAY_BUFFER] = null;
  this.bindIndexBuffer(indexBuffer);
  let view;
  if (indexBuffer.is32Bits) {
    view = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
  } else {
    view = indices instanceof Uint16Array ? indices : new Uint16Array(indices);
  }
  this._gl.bufferData(this._gl.ELEMENT_ARRAY_BUFFER, view, this._gl.DYNAMIC_DRAW);
  this._resetIndexBufferBinding();
};
ThinEngine.prototype.updateDynamicVertexBuffer = function(vertexBuffer, data, byteOffset, byteLength) {
  this.bindArrayBuffer(vertexBuffer);
  if (byteOffset === void 0) {
    byteOffset = 0;
  }
  const dataLength = data.byteLength || data.length;
  if (byteLength === void 0 || byteLength >= dataLength && byteOffset === 0) {
    if (data instanceof Array) {
      this._gl.bufferSubData(this._gl.ARRAY_BUFFER, byteOffset, new Float32Array(data));
    } else {
      this._gl.bufferSubData(this._gl.ARRAY_BUFFER, byteOffset, data);
    }
  } else {
    if (data instanceof Array) {
      this._gl.bufferSubData(this._gl.ARRAY_BUFFER, byteOffset, new Float32Array(data).subarray(0, byteLength / 4));
    } else {
      if (ArrayBuffer.isView(data)) {
        data = new Uint8Array(data.buffer, data.byteOffset, byteLength);
      } else {
        data = new Uint8Array(data, 0, byteLength);
      }
      this._gl.bufferSubData(this._gl.ARRAY_BUFFER, byteOffset, data);
    }
  }
  this._resetVertexBufferBinding();
};
//# sourceMappingURL=chunk-ZAZDILKK.js.map
