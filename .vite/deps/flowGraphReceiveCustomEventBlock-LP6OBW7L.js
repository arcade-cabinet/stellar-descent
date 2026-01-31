import {
  FlowGraphCoordinator
} from "./chunk-6MA4BNT7.js";
import "./chunk-AREOUN3V.js";
import "./chunk-MJ4RQJQA.js";
import {
  FlowGraphEventBlock
} from "./chunk-6KKOPKV3.js";
import "./chunk-YF6FVQ7P.js";
import "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import "./chunk-2RMCMAHJ.js";
import "./chunk-VMWDNJJG.js";
import {
  Tools
} from "./chunk-2GZCEIFN.js";
import "./chunk-SVWFF7VD.js";
import "./chunk-ORJOFH3C.js";
import "./chunk-L6UPA4UW.js";
import "./chunk-CQNOHBC6.js";
import "./chunk-BGSVSY55.js";
import "./chunk-RG742WGM.js";
import "./chunk-AB3HOSPI.js";
import "./chunk-4KL4KK2C.js";
import "./chunk-N5T6XPNQ.js";
import "./chunk-2HUMDLGD.js";
import "./chunk-QD4Q3FLX.js";
import "./chunk-BFIQD25N.js";
import "./chunk-57LBGEP2.js";
import "./chunk-STIKNZXL.js";
import "./chunk-I3IYKWNG.js";
import "./chunk-MMWR3MO4.js";
import "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphReceiveCustomEventBlock.js
var FlowGraphReceiveCustomEventBlock = class extends FlowGraphEventBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.initPriority = 1;
    for (const key in this.config.eventData) {
      this.registerDataOutput(key, this.config.eventData[key].type);
    }
  }
  _preparePendingTasks(context) {
    const observable = context.configuration.coordinator.getCustomEventObservable(this.config.eventId);
    if (observable && observable.hasObservers() && observable.observers.length > FlowGraphCoordinator.MaxEventsPerType) {
      this._reportError(context, `FlowGraphReceiveCustomEventBlock: Too many observers for event ${this.config.eventId}. Max is ${FlowGraphCoordinator.MaxEventsPerType}.`);
      return;
    }
    const eventObserver = observable.add((eventData) => {
      const keys = Object.keys(eventData);
      for (const key of keys) {
        this.getDataOutput(key)?.setValue(eventData[key], context);
      }
      this._execute(context);
    });
    context._setExecutionVariable(this, "_eventObserver", eventObserver);
  }
  _cancelPendingTasks(context) {
    const observable = context.configuration.coordinator.getCustomEventObservable(this.config.eventId);
    if (observable) {
      const eventObserver = context._getExecutionVariable(this, "_eventObserver", null);
      observable.remove(eventObserver);
    } else {
      Tools.Warn(`FlowGraphReceiveCustomEventBlock: Missing observable for event ${this.config.eventId}`);
    }
  }
  _executeEvent(_context, _payload) {
    return true;
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphReceiveCustomEventBlock";
  }
};
RegisterClass("FlowGraphReceiveCustomEventBlock", FlowGraphReceiveCustomEventBlock);
export {
  FlowGraphReceiveCustomEventBlock
};
//# sourceMappingURL=flowGraphReceiveCustomEventBlock-LP6OBW7L.js.map
