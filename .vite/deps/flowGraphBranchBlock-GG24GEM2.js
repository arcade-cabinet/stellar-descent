import {
  FlowGraphExecutionBlock
} from "./chunk-JMSNOBN3.js";
import {
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphBranchBlock.js
var FlowGraphBranchBlock = class extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.condition = this.registerDataInput("condition", RichTypeBoolean);
    this.onTrue = this._registerSignalOutput("onTrue");
    this.onFalse = this._registerSignalOutput("onFalse");
  }
  _execute(context) {
    if (this.condition.getValue(context)) {
      this.onTrue._activateSignal(context);
    } else {
      this.onFalse._activateSignal(context);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphBranchBlock";
  }
};
RegisterClass("FlowGraphBranchBlock", FlowGraphBranchBlock);
export {
  FlowGraphBranchBlock
};
//# sourceMappingURL=flowGraphBranchBlock-GG24GEM2.js.map
