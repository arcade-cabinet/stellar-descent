import {
  _IsDescendantOf
} from "./chunk-MJ4RQJQA.js";
import {
  FlowGraphEventBlock
} from "./chunk-6KKOPKV3.js";
import "./chunk-YF6FVQ7P.js";
import "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
  RichTypeAny,
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphPointerOverEventBlock.js
var FlowGraphPointerOverEventBlock = class extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.type = "PointerOver";
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber);
    this.targetMesh = this.registerDataInput("targetMesh", RichTypeAny, config?.targetMesh);
    this.meshUnderPointer = this.registerDataOutput("meshUnderPointer", RichTypeAny);
  }
  _executeEvent(context, payload) {
    const mesh = this.targetMesh.getValue(context);
    this.meshUnderPointer.setValue(payload.mesh, context);
    const skipEvent = payload.out && _IsDescendantOf(payload.out, mesh);
    this.pointerId.setValue(payload.pointerId, context);
    if (!skipEvent && (payload.mesh === mesh || _IsDescendantOf(payload.mesh, mesh))) {
      this._execute(context);
      return !this.config?.stopPropagation;
    }
    return true;
  }
  _preparePendingTasks(_context) {
  }
  _cancelPendingTasks(_context) {
  }
  getClassName() {
    return "FlowGraphPointerOverEventBlock";
  }
};
RegisterClass("FlowGraphPointerOverEventBlock", FlowGraphPointerOverEventBlock);
export {
  FlowGraphPointerOverEventBlock
};
//# sourceMappingURL=flowGraphPointerOverEventBlock-O2IJ47EU.js.map
