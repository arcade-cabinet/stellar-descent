import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
  FlowGraphInteger,
  RichTypeFlowGraphInteger
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphDoNBlock.js
var FlowGraphDoNBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config = {}) {
    super(config);
    this.config = config;
    this.config.startIndex = config.startIndex ?? new FlowGraphInteger(0);
    this.reset = this._registerSignalInput("reset");
    this.maxExecutions = this.registerDataInput("maxExecutions", RichTypeFlowGraphInteger);
    this.executionCount = this.registerDataOutput("executionCount", RichTypeFlowGraphInteger, new FlowGraphInteger(0));
  }
  _execute(context, callingSignal) {
    if (callingSignal === this.reset) {
      this.executionCount.setValue(this.config.startIndex, context);
    } else {
      const currentCountValue = this.executionCount.getValue(context);
      if (currentCountValue.value < this.maxExecutions.getValue(context).value) {
        this.executionCount.setValue(new FlowGraphInteger(currentCountValue.value + 1), context);
        this.out._activateSignal(context);
      }
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphDoNBlock";
  }
};
RegisterClass("FlowGraphDoNBlock", FlowGraphDoNBlock);
export {
  FlowGraphDoNBlock
};
//# sourceMappingURL=flowGraphDoNBlock-KH6TXRNX.js.map
