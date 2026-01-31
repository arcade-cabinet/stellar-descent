import {
  FlowGraphBlock,
  RichTypeAny,
  RichTypeNumber
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphContextBlock.js
var FlowGraphContextBlock = class extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.userVariables = this.registerDataOutput("userVariables", RichTypeAny);
    this.executionId = this.registerDataOutput("executionId", RichTypeNumber);
  }
  _updateOutputs(context) {
    this.userVariables.setValue(context.userVariables, context);
    this.executionId.setValue(context.executionId, context);
  }
  serialize(serializationObject) {
    super.serialize(serializationObject);
  }
  getClassName() {
    return "FlowGraphContextBlock";
  }
};
RegisterClass("FlowGraphContextBlock", FlowGraphContextBlock);
export {
  FlowGraphContextBlock
};
//# sourceMappingURL=flowGraphContextBlock-MDTGL23M.js.map
