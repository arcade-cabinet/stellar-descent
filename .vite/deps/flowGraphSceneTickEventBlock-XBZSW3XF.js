import {
  FlowGraphEventBlock
} from "./chunk-6KKOPKV3.js";
import "./chunk-YF6FVQ7P.js";
import "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphSceneTickEventBlock.js
var FlowGraphSceneTickEventBlock = class extends FlowGraphEventBlock {
  constructor() {
    super();
    this.type = "SceneBeforeRender";
    this.timeSinceStart = this.registerDataOutput("timeSinceStart", RichTypeNumber);
    this.deltaTime = this.registerDataOutput("deltaTime", RichTypeNumber);
  }
  /**
   * @internal
   */
  _preparePendingTasks(_context) {
  }
  /**
   * @internal
   */
  _executeEvent(context, payload) {
    this.timeSinceStart.setValue(payload.timeSinceStart, context);
    this.deltaTime.setValue(payload.deltaTime, context);
    this._execute(context);
    return true;
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
    return "FlowGraphSceneTickEventBlock";
  }
};
RegisterClass("FlowGraphSceneTickEventBlock", FlowGraphSceneTickEventBlock);
export {
  FlowGraphSceneTickEventBlock
};
//# sourceMappingURL=flowGraphSceneTickEventBlock-XBZSW3XF.js.map
