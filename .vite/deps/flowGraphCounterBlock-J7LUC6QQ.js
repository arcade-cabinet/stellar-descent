import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphCounterBlock.js
var FlowGraphCallCounterBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.count = this.registerDataOutput("count", RichTypeNumber);
    this.reset = this._registerSignalInput("reset");
  }
  _execute(context, callingSignal) {
    if (callingSignal === this.reset) {
      context._setExecutionVariable(this, "count", 0);
      this.count.setValue(0, context);
      return;
    }
    const countValue = context._getExecutionVariable(this, "count", 0) + 1;
    context._setExecutionVariable(this, "count", countValue);
    this.count.setValue(countValue, context);
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphCallCounterBlock";
  }
};
RegisterClass("FlowGraphCallCounterBlock", FlowGraphCallCounterBlock);
export {
  FlowGraphCallCounterBlock
};
//# sourceMappingURL=flowGraphCounterBlock-J7LUC6QQ.js.map
