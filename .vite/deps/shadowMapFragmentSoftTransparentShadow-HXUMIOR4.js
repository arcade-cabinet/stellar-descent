import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/shadowMapFragmentSoftTransparentShadow.js
var name = "shadowMapFragmentSoftTransparentShadow";
var shader = `#if SM_SOFTTRANSPARENTSHADOW==1
if ((bayerDither8(floor(mod(gl_FragCoord.xy,8.0))))/64.0>=softTransparentShadowSM.x*alpha) discard;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
var shadowMapFragmentSoftTransparentShadow = { name, shader };
export {
  shadowMapFragmentSoftTransparentShadow
};
//# sourceMappingURL=shadowMapFragmentSoftTransparentShadow-HXUMIOR4.js.map
