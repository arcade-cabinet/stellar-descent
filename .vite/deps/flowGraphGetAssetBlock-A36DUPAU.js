import {
  GetFlowGraphAssetWithType
} from "./chunk-AREOUN3V.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphGetAssetBlock.js
var FlowGraphGetAssetBlock = class extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.type = this.registerDataInput("type", RichTypeAny, config.type);
    this.value = this.registerDataOutput("value", RichTypeAny);
    this.index = this.registerDataInput("index", RichTypeAny, new FlowGraphInteger(getNumericValue(config.index ?? -1)));
  }
  _updateOutputs(context) {
    const type = this.type.getValue(context);
    const index = this.index.getValue(context);
    const asset = GetFlowGraphAssetWithType(context.assetsContext, type, getNumericValue(index), this.config.useIndexAsUniqueId);
    this.value.setValue(asset, context);
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphGetAssetBlock";
  }
};
RegisterClass("FlowGraphGetAssetBlock", FlowGraphGetAssetBlock);
export {
  FlowGraphGetAssetBlock
};
//# sourceMappingURL=flowGraphGetAssetBlock-A36DUPAU.js.map
