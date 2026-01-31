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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphDebounceBlock.js
var FlowGraphDebounceBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.count = this.registerDataInput("count", RichTypeNumber);
    this.reset = this._registerSignalInput("reset");
    this.currentCount = this.registerDataOutput("currentCount", RichTypeNumber);
  }
  _execute(context, callingSignal) {
    if (callingSignal === this.reset) {
      context._setExecutionVariable(this, "debounceCount", 0);
      return;
    }
    const count = this.count.getValue(context);
    const currentCount = context._getExecutionVariable(this, "debounceCount", 0);
    const newCount = currentCount + 1;
    this.currentCount.setValue(newCount, context);
    context._setExecutionVariable(this, "debounceCount", newCount);
    if (newCount >= count) {
      this.out._activateSignal(context);
      context._setExecutionVariable(this, "debounceCount", 0);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphDebounceBlock";
  }
};
RegisterClass("FlowGraphDebounceBlock", FlowGraphDebounceBlock);
export {
  FlowGraphDebounceBlock
};
//# sourceMappingURL=flowGraphDebounceBlock-4CT2QP26.js.map
