import {
  FlowGraphUnaryOperationBlock
} from "./chunk-X62VNOGV.js";
import "./chunk-T3CACCWP.js";
import {
  FlowGraphInteger,
  RichTypeBoolean,
  RichTypeFlowGraphInteger,
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/Transformers/flowGraphTypeToTypeBlocks.js
var FlowGraphBooleanToFloat = class extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeBoolean, RichTypeNumber, (a) => +a, "FlowGraphBooleanToFloat", config);
  }
};
RegisterClass("FlowGraphBooleanToFloat", FlowGraphBooleanToFloat);
var FlowGraphBooleanToInt = class extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeBoolean, RichTypeFlowGraphInteger, (a) => FlowGraphInteger.FromValue(+a), "FlowGraphBooleanToInt", config);
  }
};
RegisterClass("FlowGraphBooleanToInt", FlowGraphBooleanToInt);
var FlowGraphFloatToBoolean = class extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeBoolean, (a) => !!a, "FlowGraphFloatToBoolean", config);
  }
};
RegisterClass("FlowGraphFloatToBoolean", FlowGraphFloatToBoolean);
var FlowGraphIntToBoolean = class extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeBoolean, (a) => !!a.value, "FlowGraphIntToBoolean", config);
  }
};
RegisterClass("FlowGraphIntToBoolean", FlowGraphIntToBoolean);
var FlowGraphIntToFloat = class extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeNumber, (a) => a.value, "FlowGraphIntToFloat", config);
  }
};
RegisterClass("FlowGraphIntToFloat", FlowGraphIntToFloat);
var FlowGraphFloatToInt = class extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeFlowGraphInteger, (a) => {
      const roundingMode = config?.roundingMode;
      switch (roundingMode) {
        case "floor":
          return FlowGraphInteger.FromValue(Math.floor(a));
        case "ceil":
          return FlowGraphInteger.FromValue(Math.ceil(a));
        case "round":
          return FlowGraphInteger.FromValue(Math.round(a));
        default:
          return FlowGraphInteger.FromValue(a);
      }
    }, "FlowGraphFloatToInt", config);
  }
};
RegisterClass("FlowGraphFloatToInt", FlowGraphFloatToInt);
export {
  FlowGraphBooleanToFloat,
  FlowGraphBooleanToInt,
  FlowGraphFloatToBoolean,
  FlowGraphFloatToInt,
  FlowGraphIntToBoolean,
  FlowGraphIntToFloat
};
//# sourceMappingURL=flowGraphTypeToTypeBlocks-OBAZWZVN.js.map
