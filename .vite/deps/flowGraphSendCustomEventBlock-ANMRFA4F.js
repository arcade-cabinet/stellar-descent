import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Event/flowGraphSendCustomEventBlock.js
var FlowGraphSendCustomEventBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.config = config;
    for (const key in this.config.eventData) {
      this.registerDataInput(key, this.config.eventData[key].type, this.config.eventData[key].value);
    }
  }
  _execute(context) {
    const eventId = this.config.eventId;
    const eventData = {};
    for (const port of this.dataInputs) {
      eventData[port.name] = port.getValue(context);
    }
    context.configuration.coordinator.notifyCustomEvent(eventId, eventData);
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphReceiveCustomEventBlock";
  }
};
RegisterClass("FlowGraphReceiveCustomEventBlock", FlowGraphSendCustomEventBlock);
export {
  FlowGraphSendCustomEventBlock
};
//# sourceMappingURL=flowGraphSendCustomEventBlock-ANMRFA4F.js.map
