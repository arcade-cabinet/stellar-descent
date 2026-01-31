import {
  FlowGraphBlock,
  RichTypeAny
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphGetVariableBlock.js
var FlowGraphGetVariableBlock = class extends FlowGraphBlock {
  /**
   * Construct a FlowGraphGetVariableBlock.
   * @param config construction parameters
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.value = this.registerDataOutput("value", RichTypeAny, config.initialValue);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const variableNameValue = this.config.variable;
    if (context.hasVariable(variableNameValue)) {
      this.value.setValue(context.getVariable(variableNameValue), context);
    }
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize to
   */
  serialize(serializationObject) {
    super.serialize(serializationObject);
    serializationObject.config.variable = this.config.variable;
  }
  getClassName() {
    return "FlowGraphGetVariableBlock";
  }
};
RegisterClass("FlowGraphGetVariableBlock", FlowGraphGetVariableBlock);
export {
  FlowGraphGetVariableBlock
};
//# sourceMappingURL=flowGraphGetVariableBlock-AAKPLTO5.js.map
