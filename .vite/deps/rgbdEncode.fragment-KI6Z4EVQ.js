import "./chunk-VMGDVSFA.js";
import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/rgbdEncode.fragment.js
var name = "rgbdEncodePixelShader";
var shader = `varying vec2 vUV;uniform sampler2D textureSampler;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=toRGBD(texture2D(textureSampler,vUV).rgb);}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
var rgbdEncodePixelShader = { name, shader };
export {
  rgbdEncodePixelShader
};
//# sourceMappingURL=rgbdEncode.fragment-KI6Z4EVQ.js.map
