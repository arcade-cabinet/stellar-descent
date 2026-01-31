import {
  PostProcess
} from "./chunk-FTNKZQKS.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/textureTools.js
function ApplyPostProcess(postProcessName, internalTexture, scene, type, samplingMode, format, width, height) {
  const engine = internalTexture.getEngine();
  internalTexture.isReady = false;
  samplingMode = samplingMode ?? internalTexture.samplingMode;
  type = type ?? internalTexture.type;
  format = format ?? internalTexture.format;
  width = width ?? internalTexture.width;
  height = height ?? internalTexture.height;
  if (type === -1) {
    type = 0;
  }
  return new Promise((resolve) => {
    const postProcess = new PostProcess("postprocess", postProcessName, null, null, 1, null, samplingMode, engine, false, void 0, type, void 0, null, false, format);
    postProcess.externalTextureSamplerBinding = true;
    const encodedTexture = engine.createRenderTargetTexture({ width, height }, {
      generateDepthBuffer: false,
      generateMipMaps: false,
      generateStencilBuffer: false,
      samplingMode,
      type,
      format
    });
    postProcess.onEffectCreatedObservable.addOnce((e) => {
      e.executeWhenCompiled(() => {
        postProcess.onApply = (effect) => {
          effect._bindTexture("textureSampler", internalTexture);
          effect.setFloat2("scale", 1, 1);
        };
        scene.postProcessManager.directRender([postProcess], encodedTexture, true);
        engine.restoreDefaultFramebuffer();
        engine._releaseTexture(internalTexture);
        if (postProcess) {
          postProcess.dispose();
        }
        encodedTexture._swapAndDie(internalTexture);
        internalTexture.type = type;
        internalTexture.format = 5;
        internalTexture.isReady = true;
        resolve(internalTexture);
      });
    });
  });
}
var floatView;
var int32View;
function ToHalfFloat(value) {
  if (!floatView) {
    floatView = new Float32Array(1);
    int32View = new Int32Array(floatView.buffer);
  }
  floatView[0] = value;
  const x = int32View[0];
  let bits = x >> 16 & 32768;
  let m = x >> 12 & 2047;
  const e = x >> 23 & 255;
  if (e < 103) {
    return bits;
  }
  if (e > 142) {
    bits |= 31744;
    bits |= (e == 255 ? 0 : 1) && x & 8388607;
    return bits;
  }
  if (e < 113) {
    m |= 2048;
    bits |= (m >> 114 - e) + (m >> 113 - e & 1);
    return bits;
  }
  bits |= e - 112 << 10 | m >> 1;
  bits += m & 1;
  return bits;
}
function FromHalfFloat(value) {
  const s = (value & 32768) >> 15;
  const e = (value & 31744) >> 10;
  const f = value & 1023;
  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
  } else if (e == 31) {
    return f ? NaN : (s ? -1 : 1) * Infinity;
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
}

export {
  ApplyPostProcess,
  ToHalfFloat,
  FromHalfFloat
};
//# sourceMappingURL=chunk-7P3NNTBG.js.map
