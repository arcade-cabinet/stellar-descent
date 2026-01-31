import {
  getNumericValue
} from "./chunk-MJ4RQJQA.js";
import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphCancelDelayBlock.js
var FlowGraphCancelDelayBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.delayIndex = this.registerDataInput("delayIndex", RichTypeFlowGraphInteger);
  }
  _execute(context, _callingSignal) {
    const delayIndex = getNumericValue(this.delayIndex.getValue(context));
    if (delayIndex <= 0 || isNaN(delayIndex) || !isFinite(delayIndex)) {
      return this._reportError(context, "Invalid delay index");
    }
    const timers = context._getGlobalContextVariable("pendingDelays", []);
    const timer = timers[delayIndex];
    if (timer) {
      timer.dispose();
    }
    this.out._activateSignal(context);
  }
  getClassName() {
    return "FlowGraphCancelDelayBlock";
  }
};
RegisterClass("FlowGraphCancelDelayBlock", FlowGraphCancelDelayBlock);
export {
  FlowGraphCancelDelayBlock
};
//# sourceMappingURL=flowGraphCancelDelayBlock-T4ZJDDQQ.js.map
