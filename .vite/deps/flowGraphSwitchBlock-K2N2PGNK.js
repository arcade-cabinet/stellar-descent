import {
  getNumericValue,
  isNumeric
} from "./chunk-MJ4RQJQA.js";
import {
  FlowGraphExecutionBlock
} from "./chunk-JMSNOBN3.js";
import {
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/ControlFlow/flowGraphSwitchBlock.js
var FlowGraphSwitchBlock = class extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.default = this._registerSignalOutput("default");
    this._caseToOutputFlow = /* @__PURE__ */ new Map();
    this.case = this.registerDataInput("case", RichTypeAny);
    const array = this.config.cases || [];
    for (const caseValue of array) {
      this._caseToOutputFlow.set(caseValue, this._registerSignalOutput(`out_${caseValue}`));
    }
  }
  _execute(context, _callingSignal) {
    const selectionValue = this.case.getValue(context);
    let outputFlow;
    if (isNumeric(selectionValue)) {
      outputFlow = this._getOutputFlowForCase(getNumericValue(selectionValue));
    } else {
      outputFlow = this._getOutputFlowForCase(selectionValue);
    }
    if (outputFlow) {
      outputFlow._activateSignal(context);
    } else {
      this.default._activateSignal(context);
    }
  }
  /**
   * Adds a new case to the switch block.
   * @param newCase the new case to add.
   */
  addCase(newCase) {
    if (this.config.cases.includes(newCase)) {
      return;
    }
    this.config.cases.push(newCase);
    this._caseToOutputFlow.set(newCase, this._registerSignalOutput(`out_${newCase}`));
  }
  /**
   * Removes a case from the switch block.
   * @param caseToRemove the case to remove.
   */
  removeCase(caseToRemove) {
    if (!this.config.cases.includes(caseToRemove)) {
      return;
    }
    const index = this.config.cases.indexOf(caseToRemove);
    this.config.cases.splice(index, 1);
    this._caseToOutputFlow.delete(caseToRemove);
  }
  /**
   * @internal
   */
  _getOutputFlowForCase(caseValue) {
    return this._caseToOutputFlow.get(caseValue);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphSwitchBlock";
  }
  /**
   * Serialize the block to a JSON representation.
   * @param serializationObject the object to serialize to.
   */
  serialize(serializationObject) {
    super.serialize(serializationObject);
    serializationObject.cases = this.config.cases;
  }
};
RegisterClass("FlowGraphSwitchBlock", FlowGraphSwitchBlock);
export {
  FlowGraphSwitchBlock
};
//# sourceMappingURL=flowGraphSwitchBlock-K2N2PGNK.js.map
