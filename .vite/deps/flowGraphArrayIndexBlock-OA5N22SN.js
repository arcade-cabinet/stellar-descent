import {
  getNumericValue
} from "./chunk-MJ4RQJQA.js";
import {
  FlowGraphBlock,
  FlowGraphInteger,
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphArrayIndexBlock.js
var FlowGraphArrayIndexBlock = class extends FlowGraphBlock {
  /**
   * Construct a FlowGraphArrayIndexBlock.
   * @param config construction parameters
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.array = this.registerDataInput("array", RichTypeAny);
    this.index = this.registerDataInput("index", RichTypeAny, new FlowGraphInteger(-1));
    this.value = this.registerDataOutput("value", RichTypeAny);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const array = this.array.getValue(context);
    const index = getNumericValue(this.index.getValue(context));
    if (array && index >= 0 && index < array.length) {
      this.value.setValue(array[index], context);
    } else {
      this.value.setValue(null, context);
    }
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize to
   */
  serialize(serializationObject) {
    super.serialize(serializationObject);
  }
  getClassName() {
    return "FlowGraphArrayIndexBlock";
  }
};
RegisterClass("FlowGraphArrayIndexBlock", FlowGraphArrayIndexBlock);
export {
  FlowGraphArrayIndexBlock
};
//# sourceMappingURL=flowGraphArrayIndexBlock-OA5N22SN.js.map
