import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/fogVertexDeclaration.js
var name = "fogVertexDeclaration";
var shader = `#ifdef FOG
varying vec3 vFogDistance;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/fogVertex.js
var name2 = "fogVertex";
var shader2 = `#ifdef FOG
vFogDistance=(view*worldPos).xyz;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name2]) {
  ShaderStore.IncludesShadersStore[name2] = shader2;
}
//# sourceMappingURL=chunk-2LG4UFSY.js.map
