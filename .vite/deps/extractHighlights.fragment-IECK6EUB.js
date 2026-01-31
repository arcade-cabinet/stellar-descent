import "./chunk-VMGDVSFA.js";
import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/extractHighlights.fragment.js
var name = "extractHighlightsPixelShader";
var shader = `#include<helperFunctions>
varying vec2 vUV;uniform sampler2D textureSampler;uniform float threshold;uniform float exposure;
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=texture2D(textureSampler,vUV);float luma=dot(LuminanceEncodeApprox,gl_FragColor.rgb*exposure);gl_FragColor.rgb=step(threshold,luma)*gl_FragColor.rgb;}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
var extractHighlightsPixelShader = { name, shader };
export {
  extractHighlightsPixelShader
};
//# sourceMappingURL=extractHighlights.fragment-IECK6EUB.js.map
