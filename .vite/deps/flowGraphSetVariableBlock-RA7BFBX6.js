import {
  FlowGraphExecutionBlockWithOutSignal
} from "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/flowGraphSetVariableBlock.js
var FlowGraphSetVariableBlock = class extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config) {
    super(config);
    if (!config.variable && !config.variables) {
      throw new Error("FlowGraphSetVariableBlock: variable/variables is not defined");
    }
    if (config.variables && config.variable) {
      throw new Error("FlowGraphSetVariableBlock: variable and variables are both defined");
    }
    if (config.variables) {
      for (const variable of config.variables) {
        this.registerDataInput(variable, RichTypeAny);
      }
    } else {
      this.registerDataInput("value", RichTypeAny);
    }
  }
  _execute(context, _callingSignal) {
    if (this.config?.variables) {
      for (const variable of this.config.variables) {
        this._saveVariable(context, variable);
      }
    } else {
      this._saveVariable(context, this.config?.variable, "value");
    }
    this.out._activateSignal(context);
  }
  _saveVariable(context, variableName, inputName) {
    const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    for (const animationUniqueId of currentlyRunningAnimationGroups) {
      const animationGroup = context.assetsContext.animationGroups.find((animationGroup2) => animationGroup2.uniqueId == animationUniqueId);
      if (animationGroup) {
        for (const targetAnimation of animationGroup.targetedAnimations) {
          if (targetAnimation.target === context) {
            if (targetAnimation.animation.targetProperty === variableName) {
              animationGroup.stop();
              const index = currentlyRunningAnimationGroups.indexOf(animationUniqueId);
              if (index > -1) {
                currentlyRunningAnimationGroups.splice(index, 1);
              }
              context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunningAnimationGroups);
              break;
            }
          }
        }
      }
    }
    const value = this.getDataInput(inputName || variableName)?.getValue(context);
    context.setVariable(variableName, value);
  }
  getClassName() {
    return "FlowGraphSetVariableBlock";
  }
  serialize(serializationObject) {
    super.serialize(serializationObject);
    serializationObject.config.variable = this.config?.variable;
  }
};
RegisterClass("FlowGraphSetVariableBlock", FlowGraphSetVariableBlock);
export {
  FlowGraphSetVariableBlock
};
//# sourceMappingURL=flowGraphSetVariableBlock-RA7BFBX6.js.map
