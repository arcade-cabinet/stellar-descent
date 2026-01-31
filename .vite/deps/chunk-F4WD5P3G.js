import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/mainUVVaryingDeclaration.js
var name = "mainUVVaryingDeclaration";
var shader = `#ifdef MAINUV{X}
varying vec2 vMainUV{X};
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
//# sourceMappingURL=chunk-F4WD5P3G.js.map
