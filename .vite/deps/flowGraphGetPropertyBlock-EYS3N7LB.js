import {
  FlowGraphCachedOperationBlock
} from "./chunk-T3CACCWP.js";
import {
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphGetPropertyBlock.js
var FlowGraphGetPropertyBlock = class extends FlowGraphCachedOperationBlock {
  constructor(config) {
    super(RichTypeAny, config);
    this.config = config;
    this.object = this.registerDataInput("object", RichTypeAny, config.object);
    this.propertyName = this.registerDataInput("propertyName", RichTypeAny, config.propertyName);
    this.customGetFunction = this.registerDataInput("customGetFunction", RichTypeAny);
  }
  _doOperation(context) {
    const getter = this.customGetFunction.getValue(context);
    let value;
    if (getter) {
      value = getter(this.object.getValue(context), this.propertyName.getValue(context), context);
    } else {
      const target = this.object.getValue(context);
      const propertyName = this.propertyName.getValue(context);
      value = target && propertyName ? this._getPropertyValue(target, propertyName) : void 0;
    }
    return value;
  }
  _getPropertyValue(target, propertyName) {
    const path = propertyName.split(".");
    let value = target;
    for (const prop of path) {
      value = value[prop];
      if (value === void 0) {
        return;
      }
    }
    return value;
  }
  getClassName() {
    return "FlowGraphGetPropertyBlock";
  }
};
RegisterClass("FlowGraphGetPropertyBlock", FlowGraphGetPropertyBlock);
export {
  FlowGraphGetPropertyBlock
};
//# sourceMappingURL=flowGraphGetPropertyBlock-EYS3N7LB.js.map
