// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/timingTools.js
var ImmediateQueue = [];
var TimingTools = class {
  /**
   * Execute a function after the current execution block
   * @param action defines the action to execute after the current execution block
   */
  static SetImmediate(action) {
    if (ImmediateQueue.length === 0) {
      setTimeout(() => {
        const functionsToCall = ImmediateQueue;
        ImmediateQueue = [];
        for (const func of functionsToCall) {
          func();
        }
      }, 1);
    }
    ImmediateQueue.push(action);
  }
};
function RunWithCondition(condition, onSuccess, onError) {
  try {
    if (condition()) {
      onSuccess();
      return true;
    }
  } catch (e) {
    onError?.(e);
    return true;
  }
  return false;
}
var _RetryWithInterval = (condition, onSuccess, onError, step = 16, maxTimeout = 3e4, checkConditionOnCall = true, additionalStringOnTimeout) => {
  if (checkConditionOnCall) {
    if (RunWithCondition(condition, onSuccess, onError)) {
      return null;
    }
  }
  const int = setInterval(() => {
    if (RunWithCondition(condition, onSuccess, onError)) {
      clearInterval(int);
    } else {
      maxTimeout -= step;
      if (maxTimeout < 0) {
        clearInterval(int);
        onError?.(new Error("Operation timed out after maximum retries. " + (additionalStringOnTimeout || "")), true);
      }
    }
  }, step);
  return () => clearInterval(int);
};

export {
  TimingTools,
  _RetryWithInterval
};
//# sourceMappingURL=chunk-BFIQD25N.js.map
