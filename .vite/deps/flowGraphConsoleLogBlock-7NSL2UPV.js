import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
  RichTypeAny
} from "./chunk-2RMCMAHJ.js";
import "./chunk-L6UPA4UW.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/flowGraphConsoleLogBlock.js
var FlowGraphConsoleLogBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    this.message = this.registerDataInput("message", RichTypeAny);
    this.logType = this.registerDataInput("logType", RichTypeAny, "log");
    if (config?.messageTemplate) {
      const matches = this._getTemplateMatches(config.messageTemplate);
      for (const match of matches) {
        this.registerDataInput(match, RichTypeAny);
      }
    }
  }
  /**
   * @internal
   */
  _execute(context) {
    const typeValue = this.logType.getValue(context);
    const messageValue = this._getMessageValue(context);
    if (typeValue === "warn") {
      Logger.Warn(messageValue);
    } else if (typeValue === "error") {
      Logger.Error(messageValue);
    } else {
      Logger.Log(messageValue);
    }
    this.out._activateSignal(context);
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphConsoleLogBlock";
  }
  _getMessageValue(context) {
    if (this.config?.messageTemplate) {
      let template = this.config.messageTemplate;
      const matches = this._getTemplateMatches(template);
      for (const match of matches) {
        const value = this.getDataInput(match)?.getValue(context);
        if (value !== void 0) {
          template = template.replace(new RegExp(`\\{${match}\\}`, "g"), value.toString());
        }
      }
      return template;
    } else {
      return this.message.getValue(context);
    }
  }
  _getTemplateMatches(template) {
    const regex = /\{([^}]+)\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }
};
RegisterClass("FlowGraphConsoleLogBlock", FlowGraphConsoleLogBlock);
export {
  FlowGraphConsoleLogBlock
};
//# sourceMappingURL=flowGraphConsoleLogBlock-7NSL2UPV.js.map
