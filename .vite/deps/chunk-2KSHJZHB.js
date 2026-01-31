import {
  FlowGraphBlock,
  RichTypeAny
} from "./chunk-2RMCMAHJ.js";

// node_modules/.pnpm/@babylonjs+loaders@8.49.1_@babylonjs+core@8.49.1_babylonjs-gltf2interface@8.49.1/node_modules/@babylonjs/loaders/glTF/2.0/Extensions/KHR_interactivity/flowGraphGLTFDataProvider.js
var FlowGraphGLTFDataProvider = class extends FlowGraphBlock {
  constructor(config) {
    super();
    const glTF = config.glTF;
    const animationGroups = glTF.animations?.map((a) => a._babylonAnimationGroup) || [];
    this.animationGroups = this.registerDataOutput("animationGroups", RichTypeAny, animationGroups);
    const nodes = glTF.nodes?.map((n) => n._babylonTransformNode) || [];
    this.nodes = this.registerDataOutput("nodes", RichTypeAny, nodes);
  }
  getClassName() {
    return "FlowGraphGLTFDataProvider";
  }
};

export {
  FlowGraphGLTFDataProvider
};
//# sourceMappingURL=chunk-2KSHJZHB.js.map
