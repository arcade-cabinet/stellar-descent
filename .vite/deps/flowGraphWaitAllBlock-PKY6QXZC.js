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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphWaitAllBlock.js
var FlowGraphWaitAllBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.config = config;
    this.inFlows = [];
    this._cachedActivationState = [];
    this.reset = this._registerSignalInput("reset");
    this.completed = this._registerSignalOutput("completed");
    this.remainingInputs = this.registerDataOutput("remainingInputs", RichTypeFlowGraphInteger, new FlowGraphInteger(this.config.inputSignalCount || 0));
    for (let i = 0; i < this.config.inputSignalCount; i++) {
      this.inFlows.push(this._registerSignalInput(`in_${i}`));
    }
    this._unregisterSignalInput("in");
  }
  _getCurrentActivationState(context) {
    const activationState = this._cachedActivationState;
    activationState.length = 0;
    if (!context._hasExecutionVariable(this, "activationState")) {
      for (let i = 0; i < this.config.inputSignalCount; i++) {
        activationState.push(false);
      }
    } else {
      const contextActivationState = context._getExecutionVariable(this, "activationState", []);
      for (let i = 0; i < contextActivationState.length; i++) {
        activationState.push(contextActivationState[i]);
      }
    }
    return activationState;
  }
  _execute(context, callingSignal) {
    const activationState = this._getCurrentActivationState(context);
    if (callingSignal === this.reset) {
      for (let i = 0; i < this.config.inputSignalCount; i++) {
        activationState[i] = false;
      }
    } else {
      const index = this.inFlows.indexOf(callingSignal);
      if (index >= 0) {
        activationState[index] = true;
      }
    }
    this.remainingInputs.setValue(new FlowGraphInteger(activationState.filter((v) => !v).length), context);
    context._setExecutionVariable(this, "activationState", activationState.slice());
    if (!activationState.includes(false)) {
      this.completed._activateSignal(context);
      for (let i = 0; i < this.config.inputSignalCount; i++) {
        activationState[i] = false;
      }
    } else {
      callingSignal !== this.reset && this.out._activateSignal(context);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphWaitAllBlock";
  }
  /**
   * Serializes this block into a object
   * @param serializationObject the object to serialize to
   */
  serialize(serializationObject) {
    super.serialize(serializationObject);
    serializationObject.config.inputFlows = this.config.inputSignalCount;
  }
};
RegisterClass("FlowGraphWaitAllBlock", FlowGraphWaitAllBlock);
export {
  FlowGraphWaitAllBlock
};
//# sourceMappingURL=flowGraphWaitAllBlock-PKY6QXZC.js.map
