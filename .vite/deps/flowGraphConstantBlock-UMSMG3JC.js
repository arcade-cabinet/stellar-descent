import {
  FlowGraphBlock,
  defaultValueSerializationFunction,
  getRichTypeFromValue
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphConstantBlock.js
var FlowGraphConstantBlock = class extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.output = this.registerDataOutput("output", getRichTypeFromValue(config.value));
  }
  _updateOutputs(context) {
    this.output.setValue(this.config.value, context);
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphConstantBlock";
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize to
   * @param valueSerializeFunction the function to use to serialize the value
   */
  serialize(serializationObject = {}, valueSerializeFunction = defaultValueSerializationFunction) {
    super.serialize(serializationObject);
    valueSerializeFunction("value", this.config.value, serializationObject.config);
  }
};
RegisterClass("FlowGraphConstantBlock", FlowGraphConstantBlock);
export {
  FlowGraphConstantBlock
};
//# sourceMappingURL=flowGraphConstantBlock-UMSMG3JC.js.map
