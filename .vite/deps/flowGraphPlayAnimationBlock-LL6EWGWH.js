import {
  AnimationGroup
} from "./chunk-YCPLAQIL.js";
import {
  FlowGraphAsyncExecutionBlock
} from "./chunk-YF6FVQ7P.js";
import "./chunk-75QGUAYL.js";
import "./chunk-JMSNOBN3.js";
import {
  RichTypeAny,
  RichTypeBoolean,
  RichTypeNumber
} from "./chunk-2RMCMAHJ.js";
import "./chunk-ITHI4A4R.js";
import "./chunk-FFYU476A.js";
import "./chunk-CBWHP7JG.js";
import "./chunk-WNGJ3WNO.js";
import "./chunk-BELK345T.js";
import "./chunk-VMWDNJJG.js";
import "./chunk-GGUL3CXV.js";
import "./chunk-2DA7GQ3K.js";
import "./chunk-4CFWIRXS.js";
import "./chunk-QU3LKDUB.js";
import "./chunk-XSRNQTYL.js";
import "./chunk-WOKXMMT7.js";
import "./chunk-YNSIAG7O.js";
import "./chunk-O36BJWZ2.js";
import "./chunk-T324X5NK.js";
import "./chunk-VMPPSYS3.js";
import "./chunk-EWHDDCCY.js";
import "./chunk-4ZWKSYMN.js";
import "./chunk-ZOIT5ZEZ.js";
import "./chunk-XAOF3L4F.js";
import "./chunk-CSVPIDNO.js";
import "./chunk-YVYIHIJT.js";
import "./chunk-2GZCEIFN.js";
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
import "./chunk-D664DUZM.js";
import "./chunk-ZKYT7Q6J.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/FlowGraph/Blocks/Execution/Animation/flowGraphPlayAnimationBlock.js
var FlowGraphPlayAnimationBlock = class extends FlowGraphAsyncExecutionBlock {
  constructor(config) {
    super(config, ["animationLoop", "animationEnd", "animationGroupLoop"]);
    this.config = config;
    this.speed = this.registerDataInput("speed", RichTypeNumber);
    this.loop = this.registerDataInput("loop", RichTypeBoolean);
    this.from = this.registerDataInput("from", RichTypeNumber, 0);
    this.to = this.registerDataInput("to", RichTypeNumber);
    this.currentFrame = this.registerDataOutput("currentFrame", RichTypeNumber);
    this.currentTime = this.registerDataOutput("currentTime", RichTypeNumber);
    this.currentAnimationGroup = this.registerDataOutput("currentAnimationGroup", RichTypeAny);
    this.animationGroup = this.registerDataInput("animationGroup", RichTypeAny, config?.animationGroup);
    this.animation = this.registerDataInput("animation", RichTypeAny);
    this.object = this.registerDataInput("object", RichTypeAny);
  }
  /**
   * @internal
   * @param context
   */
  _preparePendingTasks(context) {
    const ag = this.animationGroup.getValue(context);
    const animation = this.animation.getValue(context);
    if (!ag && !animation) {
      return this._reportError(context, "No animation or animation group provided");
    } else {
      const currentAnimationGroup = this.currentAnimationGroup.getValue(context);
      if (currentAnimationGroup && currentAnimationGroup !== ag) {
        currentAnimationGroup.dispose();
      }
      let animationGroupToUse = ag;
      if (animation && !animationGroupToUse) {
        const target = this.object.getValue(context);
        if (!target) {
          return this._reportError(context, "No target object provided");
        }
        const animationsArray = Array.isArray(animation) ? animation : [animation];
        const name = animationsArray[0].name;
        animationGroupToUse = new AnimationGroup("flowGraphAnimationGroup-" + name + "-" + target.name, context.configuration.scene);
        let isInterpolation = false;
        const interpolationAnimations = context._getGlobalContextVariable("interpolationAnimations", []);
        for (const anim of animationsArray) {
          animationGroupToUse.addTargetedAnimation(anim, target);
          if (interpolationAnimations.indexOf(anim.uniqueId) !== -1) {
            isInterpolation = true;
          }
        }
        if (isInterpolation) {
          this._checkInterpolationDuplications(context, animationsArray, target);
        }
      }
      const speed = this.speed.getValue(context) || 1;
      const from = this.from.getValue(context) ?? 0;
      const to = this.to.getValue(context) || animationGroupToUse.to;
      const loop = !isFinite(to) || this.loop.getValue(context);
      this.currentAnimationGroup.setValue(animationGroupToUse, context);
      const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
      if (currentlyRunningAnimationGroups.indexOf(animationGroupToUse.uniqueId) !== -1) {
        animationGroupToUse.stop();
      }
      try {
        animationGroupToUse.start(loop, speed, from, to);
        animationGroupToUse.onAnimationGroupEndObservable.add(() => this._onAnimationGroupEnd(context));
        animationGroupToUse.onAnimationEndObservable.add(() => this._eventsSignalOutputs["animationEnd"]._activateSignal(context));
        animationGroupToUse.onAnimationLoopObservable.add(() => this._eventsSignalOutputs["animationLoop"]._activateSignal(context));
        animationGroupToUse.onAnimationGroupLoopObservable.add(() => this._eventsSignalOutputs["animationGroupLoop"]._activateSignal(context));
        currentlyRunningAnimationGroups.push(animationGroupToUse.uniqueId);
        context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunningAnimationGroups);
      } catch (e) {
        this._reportError(context, e);
      }
    }
  }
  _reportError(context, error) {
    super._reportError(context, error);
    this.currentFrame.setValue(-1, context);
    this.currentTime.setValue(-1, context);
  }
  /**
   * @internal
   */
  _executeOnTick(_context) {
    const ag = this.currentAnimationGroup.getValue(_context);
    if (ag) {
      this.currentFrame.setValue(ag.getCurrentFrame(), _context);
      this.currentTime.setValue(ag.animatables[0]?.elapsedTime ?? 0, _context);
    }
  }
  _execute(context) {
    this._startPendingTasks(context);
  }
  _onAnimationGroupEnd(context) {
    this._removeFromCurrentlyRunning(context, this.currentAnimationGroup.getValue(context));
    this._resetAfterCanceled(context);
    this.done._activateSignal(context);
  }
  /**
   * The idea behind this function is to check every running animation group and check if the targeted animations it uses are interpolation animations.
   * If they are, we want to see that they don't collide with the current interpolation animations that are starting to play.
   * If they do, we want to stop the already-running animation group.
   * @internal
   */
  _checkInterpolationDuplications(context, animation, target) {
    const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    for (const uniqueId of currentlyRunningAnimationGroups) {
      const ag = context.assetsContext.animationGroups.find((ag2) => ag2.uniqueId === uniqueId);
      if (ag) {
        for (const anim of ag.targetedAnimations) {
          for (const animToCheck of animation) {
            if (anim.animation.targetProperty === animToCheck.targetProperty && anim.target === target) {
              this._stopAnimationGroup(context, ag);
            }
          }
        }
      }
    }
  }
  _stopAnimationGroup(context, animationGroup) {
    animationGroup.stop(true);
    animationGroup.dispose();
    this._removeFromCurrentlyRunning(context, animationGroup);
  }
  _removeFromCurrentlyRunning(context, animationGroup) {
    const currentlyRunningAnimationGroups = context._getGlobalContextVariable("currentlyRunningAnimationGroups", []);
    const idx = currentlyRunningAnimationGroups.indexOf(animationGroup.uniqueId);
    if (idx !== -1) {
      currentlyRunningAnimationGroups.splice(idx, 1);
      context._setGlobalContextVariable("currentlyRunningAnimationGroups", currentlyRunningAnimationGroups);
    }
  }
  /**
   * @internal
   * Stop any currently running animations.
   */
  _cancelPendingTasks(context) {
    const ag = this.currentAnimationGroup.getValue(context);
    if (ag) {
      this._stopAnimationGroup(context, ag);
    }
  }
  /**
   * @returns class name of the block.
   */
  getClassName() {
    return "FlowGraphPlayAnimationBlock";
  }
};
RegisterClass("FlowGraphPlayAnimationBlock", FlowGraphPlayAnimationBlock);
export {
  FlowGraphPlayAnimationBlock
};
//# sourceMappingURL=flowGraphPlayAnimationBlock-LL6EWGWH.js.map
