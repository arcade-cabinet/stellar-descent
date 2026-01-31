import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/ShadersWGSL/glowMapMerge.vertex.js
var name = "glowMapMergeVertexShader";
var shader = `attribute position: vec2f;varying vUV: vec2f;
#define CUSTOM_VERTEX_DEFINITIONS
@vertex
fn main(input : VertexInputs)->FragmentInputs {const madd: vec2f= vec2f(0.5,0.5);
#define CUSTOM_VERTEX_MAIN_BEGIN
vertexOutputs.vUV=input.position*madd+madd;vertexOutputs.position= vec4f(input.position,0.0,1.0);
#define CUSTOM_VERTEX_MAIN_END
}`;
if (!ShaderStore.ShadersStoreWGSL[name]) {
  ShaderStore.ShadersStoreWGSL[name] = shader;
}
var glowMapMergeVertexShaderWGSL = { name, shader };
export {
  glowMapMergeVertexShaderWGSL
};
//# sourceMappingURL=glowMapMerge.vertex-4XRXMK7U.js.map
