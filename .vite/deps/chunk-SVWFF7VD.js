import {
  Logger
} from "./chunk-57LBGEP2.js";
import {
  GetClass
} from "./chunk-LUXUKJKM.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/instantiationTools.js
var InstantiationTools = class {
  /**
   * Tries to instantiate a new object from a given class name
   * @param className defines the class name to instantiate
   * @returns the new object or null if the system was not able to do the instantiation
   */
  static Instantiate(className) {
    if (this.RegisteredExternalClasses && this.RegisteredExternalClasses[className]) {
      return this.RegisteredExternalClasses[className];
    }
    const internalClass = GetClass(className);
    if (internalClass) {
      return internalClass;
    }
    Logger.Warn(className + " not found, you may have missed an import.");
    const arr = className.split(".");
    let fn = window || this;
    for (let i = 0, len = arr.length; i < len; i++) {
      fn = fn[arr[i]];
    }
    if (typeof fn !== "function") {
      return null;
    }
    return fn;
  }
};
InstantiationTools.RegisteredExternalClasses = {};

export {
  InstantiationTools
};
//# sourceMappingURL=chunk-SVWFF7VD.js.map
