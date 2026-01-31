import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/shadowMapFragmentSoftTransparentShadow.js
var name = "shadowMapFragmentSoftTransparentShadow";
var shader = `#if SM_SOFTTRANSPARENTSHADOW==1
if ((bayerDither8(floor(((fragmentInputs.position.xy)%(8.0)))))/64.0>=uniforms.softTransparentShadowSM.x*alpha) {discard;}
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
var shadowMapFragmentSoftTransparentShadowWGSL = { name, shader };
export {
  shadowMapFragmentSoftTransparentShadowWGSL
};
//# sourceMappingURL=shadowMapFragmentSoftTransparentShadow-CJPQ3DF5.js.map
