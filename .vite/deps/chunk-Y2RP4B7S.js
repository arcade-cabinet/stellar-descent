import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/sceneUboDeclaration.js
var name = "sceneUboDeclaration";
var shader = `layout(std140,column_major) uniform;uniform Scene {mat4 viewProjection;
#ifdef MULTIVIEW
mat4 viewProjectionR;
#endif 
mat4 view;mat4 projection;vec4 vEyePosition;};
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/meshUboDeclaration.js
var name2 = "meshUboDeclaration";
var shader2 = `#ifdef WEBGL2
uniform mat4 world;uniform float visibility;
#else
layout(std140,column_major) uniform;uniform Mesh
{mat4 world;float visibility;};
#endif
#define WORLD_UBO
`;
if (!ShaderStore.IncludesShadersStore[name2]) {
  ShaderStore.IncludesShadersStore[name2] = shader2;
}
//# sourceMappingURL=chunk-Y2RP4B7S.js.map
