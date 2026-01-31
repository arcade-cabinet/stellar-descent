import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/logDepthFragment.js
var name = "logDepthFragment";
var shader = `#ifdef LOGARITHMICDEPTH
gl_FragDepthEXT=log2(vFragmentDepth)*logarithmicDepthConstant*0.5;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}
//# sourceMappingURL=chunk-EHVKL6K3.js.map
