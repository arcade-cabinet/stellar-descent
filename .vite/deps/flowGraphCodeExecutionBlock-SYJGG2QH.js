import {
  FlowGraphBlock,
  RichTypeAny
} from "./chunk-2RMCMAHJ.js";
import "./chunk-L6UPA4UW.js";
import "./chunk-I3IYKWNG.js";
import "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphCodeExecutionBlock.js
var FlowGraphCodeExecutionBlock = class extends FlowGraphBlock {
  /**
   * Construct a FlowGraphCodeExecutionBlock.
   * @param config construction parameters
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.executionFunction = this.registerDataInput("function", RichTypeAny);
    this.value = this.registerDataInput("value", RichTypeAny);
    this.result = this.registerDataOutput("result", RichTypeAny);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const func = this.executionFunction.getValue(context);
    const value = this.value.getValue(context);
    if (func) {
      this.result.setValue(func(value, context), context);
    }
  }
  getClassName() {
    return "FlowGraphCodeExecutionBlock";
  }
};
export {
  FlowGraphCodeExecutionBlock
};
//# sourceMappingURL=flowGraphCodeExecutionBlock-SYJGG2QH.js.map
