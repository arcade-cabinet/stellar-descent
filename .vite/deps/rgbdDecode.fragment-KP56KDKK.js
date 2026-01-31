import "./chunk-VMGDVSFA.js";
import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/rgbdDecode.fragment.js
var name = "rgbdDecodePixelShader";
var shader = `varying vec2 vUV;uniform sampler2D textureSampler;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=vec4(fromRGBD(texture2D(textureSampler,vUV)),1.0);}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
var rgbdDecodePixelShader = { name, shader };
export {
  rgbdDecodePixelShader
};
//# sourceMappingURL=rgbdDecode.fragment-KP56KDKK.js.map
