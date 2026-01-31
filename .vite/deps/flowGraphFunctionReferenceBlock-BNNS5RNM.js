import {
  FlowGraphBlock,
  RichTypeAny,
  RichTypeString
} from "./chunk-2RMCMAHJ.js";
import "./chunk-L6UPA4UW.js";
import "./chunk-I3IYKWNG.js";
import "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphFunctionReferenceBlock.js
var FlowGraphFunctionReferenceBlock = class extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.functionName = this.registerDataInput("functionName", RichTypeString);
    this.object = this.registerDataInput("object", RichTypeAny);
    this.context = this.registerDataInput("context", RichTypeAny, null);
    this.output = this.registerDataOutput("output", RichTypeAny);
  }
  _updateOutputs(context) {
    const functionName = this.functionName.getValue(context);
    const object = this.object.getValue(context);
    const contextValue = this.context.getValue(context);
    if (object && functionName) {
      const func = object[functionName];
      if (func && typeof func === "function") {
        this.output.setValue(func.bind(contextValue), context);
      }
    }
  }
  getClassName() {
    return "FlowGraphFunctionReference";
  }
};
RegisterClass("FlowGraphFunctionReference", FlowGraphFunctionReferenceBlock);
export {
  FlowGraphFunctionReferenceBlock
};
//# sourceMappingURL=flowGraphFunctionReferenceBlock-BNNS5RNM.js.map
