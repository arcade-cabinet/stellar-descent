import {
  getNumericValue,
  isNumeric
} from "./chunk-MJ4RQJQA.js";
import {
  FlowGraphBlock,
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Data/flowGraphDataSwitchBlock.js
var FlowGraphDataSwitchBlock = class extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this._inputCases = /* @__PURE__ */ new Map();
    this.case = this.registerDataInput("case", RichTypeAny, NaN);
    this.default = this.registerDataInput("default", RichTypeAny);
    this.value = this.registerDataOutput("value", RichTypeAny);
    const array = this.config.cases || [];
    for (let caseValue of array) {
      caseValue = getNumericValue(caseValue);
      if (this.config.treatCasesAsIntegers) {
        caseValue = caseValue | 0;
        if (this._inputCases.has(caseValue)) {
          return;
        }
      }
      this._inputCases.set(caseValue, this.registerDataInput(`in_${caseValue}`, RichTypeAny));
    }
  }
  _updateOutputs(context) {
    const selectionValue = this.case.getValue(context);
    let outputValue;
    if (isNumeric(selectionValue)) {
      outputValue = this._getOutputValueForCase(getNumericValue(selectionValue), context);
    }
    if (!outputValue) {
      outputValue = this.default.getValue(context);
    }
    this.value.setValue(outputValue, context);
  }
  _getOutputValueForCase(caseValue, context) {
    return this._inputCases.get(caseValue)?.getValue(context);
  }
  getClassName() {
    return "FlowGraphDataSwitchBlock";
  }
};
RegisterClass("FlowGraphDataSwitchBlock", FlowGraphDataSwitchBlock);
export {
  FlowGraphDataSwitchBlock
};
//# sourceMappingURL=flowGraphDataSwitchBlock-XN23WRJS.js.map
