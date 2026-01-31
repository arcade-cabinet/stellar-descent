import {
  FlowGraphBlock,
  FlowGraphInteger,
  RichTypeAny,
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Utils/flowGraphIndexOfBlock.js
var FlowGraphIndexOfBlock = class extends FlowGraphBlock {
  /**
   * Construct a FlowGraphIndexOfBlock.
   * @param config construction parameters
   */
  constructor(config) {
    super(config);
    this.config = config;
    this.object = this.registerDataInput("object", RichTypeAny);
    this.array = this.registerDataInput("array", RichTypeAny);
    this.index = this.registerDataOutput("index", RichTypeFlowGraphInteger, new FlowGraphInteger(-1));
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const object = this.object.getValue(context);
    const array = this.array.getValue(context);
    if (array) {
      this.index.setValue(new FlowGraphInteger(array.indexOf(object)), context);
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
    return "FlowGraphIndexOfBlock";
  }
};
RegisterClass("FlowGraphIndexOfBlock", FlowGraphIndexOfBlock);
export {
  FlowGraphIndexOfBlock
};
//# sourceMappingURL=flowGraphIndexOfBlock-WHR642ZS.js.map
