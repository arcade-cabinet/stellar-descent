import {
  FlowGraphExecutionBlock
} from "./chunk-JMSNOBN3.js";
import "./chunk-2RMCMAHJ.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphSequenceBlock.js
var FlowGraphSequenceBlock = class extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.executionSignals = [];
    this.setNumberOfOutputSignals(this.config.outputSignalCount);
  }
  _execute(context) {
    for (let i = 0; i < this.executionSignals.length; i++) {
      this.executionSignals[i]._activateSignal(context);
    }
  }
  /**
   * Sets the block's output flows. Would usually be passed from the constructor but can be changed afterwards.
   * @param outputSignalCount the number of output flows
   */
  setNumberOfOutputSignals(outputSignalCount = 1) {
    while (this.executionSignals.length > outputSignalCount) {
      const flow = this.executionSignals.pop();
      if (flow) {
        flow.disconnectFromAll();
        this._unregisterSignalOutput(flow.name);
      }
    }
    while (this.executionSignals.length < outputSignalCount) {
      this.executionSignals.push(this._registerSignalOutput(`out_${this.executionSignals.length}`));
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSequenceBlock";
  }
};
RegisterClass("FlowGraphSequenceBlock", FlowGraphSequenceBlock);
export {
  FlowGraphSequenceBlock
};
//# sourceMappingURL=flowGraphSequenceBlock-ONWAYUEE.js.map
