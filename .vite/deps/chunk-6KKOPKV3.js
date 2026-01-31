import {
  FlowGraphAsyncExecutionBlock
} from "./chunk-YF6FVQ7P.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/flowGraphEventBlock.js
var FlowGraphEventBlock = class extends FlowGraphAsyncExecutionBlock {
  constructor() {
    super(...arguments);
    this.initPriority = 0;
    this.type = "NoTrigger";
  }
  /**
   * @internal
   */
  _execute(context) {
    context._notifyExecuteNode(this);
    this.done._activateSignal(context);
  }
};

export {
  FlowGraphEventBlock
};
//# sourceMappingURL=chunk-6KKOPKV3.js.map
