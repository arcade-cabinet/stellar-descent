import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
  RichTypeBoolean
} from "./chunk-2RMCMAHJ.js";
import "./chunk-L6UPA4UW.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphWhileLoopBlock.js
var FlowGraphWhileLoopBlock = class _FlowGraphWhileLoopBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.config = config;
    this.condition = this.registerDataInput("condition", RichTypeBoolean);
    this.executionFlow = this._registerSignalOutput("executionFlow");
    this.completed = this._registerSignalOutput("completed");
    this._unregisterSignalOutput("out");
  }
  _execute(context, _callingSignal) {
    let conditionValue = this.condition.getValue(context);
    if (this.config?.doWhile && !conditionValue) {
      this.executionFlow._activateSignal(context);
    }
    let i = 0;
    while (conditionValue) {
      this.executionFlow._activateSignal(context);
      ++i;
      if (i >= _FlowGraphWhileLoopBlock.MaxLoopCount) {
        Logger.Warn("FlowGraphWhileLoopBlock: Max loop count reached. Breaking.");
        break;
      }
      conditionValue = this.condition.getValue(context);
    }
    this.completed._activateSignal(context);
  }
  getClassName() {
    return "FlowGraphWhileLoopBlock";
  }
};
FlowGraphWhileLoopBlock.MaxLoopCount = 1e3;
RegisterClass("FlowGraphWhileLoopBlock", FlowGraphWhileLoopBlock);
export {
  FlowGraphWhileLoopBlock
};
//# sourceMappingURL=flowGraphWhileLoopBlock-4YXVOCKV.js.map
