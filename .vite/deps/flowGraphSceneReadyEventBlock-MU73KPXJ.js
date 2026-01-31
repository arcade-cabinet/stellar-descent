import {
  FlowGraphEventBlock
} from "./chunk-6KKOPKV3.js";
import "./chunk-YF6FVQ7P.js";
import "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import "./chunk-2RMCMAHJ.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphSceneReadyEventBlock.js
var FlowGraphSceneReadyEventBlock = class extends FlowGraphEventBlock {
  constructor() {
    super(...arguments);
    this.initPriority = -1;
    this.type = "SceneReady";
  }
  _executeEvent(context, _payload) {
    this._execute(context);
    return true;
  }
  _preparePendingTasks(context) {
  }
  _cancelPendingTasks(context) {
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSceneReadyEventBlock";
  }
};
RegisterClass("FlowGraphSceneReadyEventBlock", FlowGraphSceneReadyEventBlock);
export {
  FlowGraphSceneReadyEventBlock
};
//# sourceMappingURL=flowGraphSceneReadyEventBlock-MU73KPXJ.js.map
