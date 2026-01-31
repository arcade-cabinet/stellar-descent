import {
  FlowGraphBlock,
  RichTypeAny,
  RichTypeBoolean
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphConditionalDataBlock.js
var FlowGraphConditionalDataBlock = class extends FlowGraphBlock {
  /**
   * Creates a new instance of the block
   * @param config optional configuration for this block
   */
  constructor(config) {
    super(config);
    this.condition = this.registerDataInput("condition", RichTypeBoolean);
    this.onTrue = this.registerDataInput("onTrue", RichTypeAny);
    this.onFalse = this.registerDataInput("onFalse", RichTypeAny);
    this.output = this.registerDataOutput("output", RichTypeAny);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const condition = this.condition.getValue(context);
    this.output.setValue(condition ? this.onTrue.getValue(context) : this.onFalse.getValue(context), context);
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphConditionalBlock";
  }
};
RegisterClass("FlowGraphConditionalBlock", FlowGraphConditionalDataBlock);
export {
  FlowGraphConditionalDataBlock
};
//# sourceMappingURL=flowGraphConditionalDataBlock-LFQDFJ7I.js.map
