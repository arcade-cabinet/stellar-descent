import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/pass.fragment.js
var name = "passPixelShader";
var shader = `varying vec2 vUV;uniform sampler2D textureSampler;
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) 
{gl_FragColor=texture2D(textureSampler,vUV);}`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}
var passPixelShader = { name, shader };
export {
  passPixelShader
};
//# sourceMappingURL=pass.fragment-SNDFYLVV.js.map
