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
  RichTypeNumber,
  RichTypeVector3
} from "./chunk-2RMCMAHJ.js";
import {
  PointerEventTypes
} from "./chunk-VMWDNJJG.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphMeshPickEventBlock.js
var FlowGraphMeshPickEventBlock = class extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.type = "MeshPick";
    this.asset = this.registerDataInput("asset", RichTypeAny, config?.targetMesh);
    this.pickedPoint = this.registerDataOutput("pickedPoint", RichTypeVector3);
    this.pickOrigin = this.registerDataOutput("pickOrigin", RichTypeVector3);
    this.pointerId = this.registerDataOutput("pointerId", RichTypeNumber);
    this.pickedMesh = this.registerDataOutput("pickedMesh", RichTypeAny);
    this.pointerType = this.registerDataInput("pointerType", RichTypeAny, PointerEventTypes.POINTERPICK);
  }
  _getReferencedMesh(context) {
    return this.asset.getValue(context);
  }
  _executeEvent(context, pickedInfo) {
    const pointerType = this.pointerType.getValue(context);
    if (pointerType !== pickedInfo.type) {
      return true;
    }
    const mesh = this._getReferencedMesh(context);
    if (mesh && pickedInfo.pickInfo?.pickedMesh && (pickedInfo.pickInfo?.pickedMesh === mesh || _IsDescendantOf(pickedInfo.pickInfo?.pickedMesh, mesh))) {
      this.pointerId.setValue(pickedInfo.event.pointerId, context);
      this.pickOrigin.setValue(pickedInfo.pickInfo.ray?.origin, context);
      this.pickedPoint.setValue(pickedInfo.pickInfo.pickedPoint, context);
      this.pickedMesh.setValue(pickedInfo.pickInfo.pickedMesh, context);
      this._execute(context);
      return !this.config?.stopPropagation;
    } else {
      this.pointerId.resetToDefaultValue(context);
      this.pickOrigin.resetToDefaultValue(context);
      this.pickedPoint.resetToDefaultValue(context);
      this.pickedMesh.resetToDefaultValue(context);
    }
    return true;
  }
  /**
   * @internal
   */
  _preparePendingTasks(_context) {
  }
  /**
   * @internal
   */
  _cancelPendingTasks(_context) {
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphMeshPickEventBlock";
  }
};
RegisterClass("FlowGraphMeshPickEventBlock", FlowGraphMeshPickEventBlock);
export {
  FlowGraphMeshPickEventBlock
};
//# sourceMappingURL=flowGraphMeshPickEventBlock-55R2LI72.js.map
