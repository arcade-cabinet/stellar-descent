import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/fogVertexDeclaration.js
var name = "fogVertexDeclaration";
var shader = `#ifdef FOG
varying vFogDistance: vec3f;
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/ShadersWGSL/ShadersInclude/fogVertex.js
var name2 = "fogVertex";
var shader2 = `#ifdef FOG
#ifdef SCENE_UBO
vertexOutputs.vFogDistance=(scene.view*worldPos).xyz;
#else
vertexOutputs.vFogDistance=(uniforms.view*worldPos).xyz;
#endif
#endif
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name2]) {
  ShaderStore.IncludesShadersStoreWGSL[name2] = shader2;
}
//# sourceMappingURL=chunk-F2YK6JRB.js.map
