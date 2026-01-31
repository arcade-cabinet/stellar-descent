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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphFlipFlopBlock.js
var FlowGraphFlipFlopBlock = class extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.onOn = this._registerSignalOutput("onOn");
    this.onOff = this._registerSignalOutput("onOff");
    this.value = this.registerDataOutput("value", RichTypeBoolean);
  }
  _execute(context, _callingSignal) {
    let value = context._getExecutionVariable(this, "value", typeof this.config?.startValue === "boolean" ? !this.config.startValue : false);
    value = !value;
    context._setExecutionVariable(this, "value", value);
    this.value.setValue(value, context);
    if (value) {
      this.onOn._activateSignal(context);
    } else {
      this.onOff._activateSignal(context);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphFlipFlopBlock";
  }
};
RegisterClass("FlowGraphFlipFlopBlock", FlowGraphFlipFlopBlock);
export {
  FlowGraphFlipFlopBlock
};
//# sourceMappingURL=flowGraphFlipFlopBlock-WDUK5HYK.js.map
