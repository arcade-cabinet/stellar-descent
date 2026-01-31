import {
  getNumericValue
} from "./chunk-MJ4RQJQA.js";
import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
  FlowGraphInteger,
  RichTypeAny,
  RichTypeFlowGraphInteger,
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphForLoopBlock.js
var FlowGraphForLoopBlock = class _FlowGraphForLoopBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.startIndex = this.registerDataInput("startIndex", RichTypeAny, 0);
    this.endIndex = this.registerDataInput("endIndex", RichTypeAny);
    this.step = this.registerDataInput("step", RichTypeNumber, 1);
    this.index = this.registerDataOutput("index", RichTypeFlowGraphInteger, new FlowGraphInteger(getNumericValue(config?.initialIndex ?? 0)));
    this.executionFlow = this._registerSignalOutput("executionFlow");
    this.completed = this._registerSignalOutput("completed");
    this._unregisterSignalOutput("out");
  }
  /**
   * @internal
   */
  _execute(context) {
    const index = getNumericValue(this.startIndex.getValue(context));
    const step = this.step.getValue(context);
    let endIndex = getNumericValue(this.endIndex.getValue(context));
    for (let i = index; i < endIndex; i += step) {
      this.index.setValue(new FlowGraphInteger(i), context);
      this.executionFlow._activateSignal(context);
      endIndex = getNumericValue(this.endIndex.getValue(context));
      if (i > _FlowGraphForLoopBlock.MaxLoopIterations * step) {
        break;
      }
    }
    if (this.config?.incrementIndexWhenLoopDone) {
      this.index.setValue(new FlowGraphInteger(getNumericValue(this.index.getValue(context)) + step), context);
    }
    this.completed._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphForLoopBlock";
  }
};
FlowGraphForLoopBlock.MaxLoopIterations = 1e3;
RegisterClass("FlowGraphForLoopBlock", FlowGraphForLoopBlock);
export {
  FlowGraphForLoopBlock
};
//# sourceMappingURL=flowGraphForLoopBlock-JTW2CPYF.js.map
