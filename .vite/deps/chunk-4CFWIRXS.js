// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/colorCurves.functions.js
function PrepareUniformsForColorCurves(uniformsList) {
  uniformsList.push("vCameraColorCurveNeutral", "vCameraColorCurvePositive", "vCameraColorCurveNegative");
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/imageProcessingConfiguration.functions.js
function PrepareUniformsForImageProcessing(uniforms, defines) {
  if (defines.EXPOSURE) {
    uniforms.push("exposureLinear");
  }
  if (defines.CONTRAST) {
    uniforms.push("contrast");
  }
  if (defines.COLORGRADING) {
    uniforms.push("colorTransformSettings");
  }
  if (defines.VIGNETTE || defines.DITHER) {
    uniforms.push("vInverseScreenSize");
  }
  if (defines.VIGNETTE) {
    uniforms.push("vignetteSettings1");
    uniforms.push("vignetteSettings2");
  }
  if (defines.COLORCURVES) {
    PrepareUniformsForColorCurves(uniforms);
  }
  if (defines.DITHER) {
    uniforms.push("ditherIntensity");
  }
}
function PrepareSamplersForImageProcessing(samplersList, defines) {
  if (defines.COLORGRADING) {
    samplersList.push("txColorTransform");
  }
}

export {
  PrepareUniformsForColorCurves,
  PrepareUniformsForImageProcessing,
  PrepareSamplersForImageProcessing
};
//# sourceMappingURL=chunk-4CFWIRXS.js.map
