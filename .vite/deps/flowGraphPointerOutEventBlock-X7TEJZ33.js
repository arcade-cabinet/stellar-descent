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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphPointerOutEventBlock.js
var FlowGraphPointerOutEventBlock = class extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.type = "PointerOut";
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber);
    this.targetMesh = this.registerDataInput("targetMesh", RichTypeAny, config?.targetMesh);
    this.meshOutOfPointer = this.registerDataOutput("meshOutOfPointer", RichTypeAny);
  }
  _executeEvent(context, payload) {
    const mesh = this.targetMesh.getValue(context);
    this.meshOutOfPointer.setValue(payload.mesh, context);
    this.pointerId.setValue(payload.pointerId, context);
    const skipEvent = payload.over && _IsDescendantOf(payload.mesh, mesh);
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
    return "FlowGraphPointerOutEventBlock";
  }
};
RegisterClass("FlowGraphPointerOutEventBlock", FlowGraphPointerOutEventBlock);
export {
  FlowGraphPointerOutEventBlock
};
//# sourceMappingURL=flowGraphPointerOutEventBlock-X7TEJZ33.js.map
