import {
  IsWindowObjectExist
} from "./chunk-AB3HOSPI.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/precisionDate.js
var PrecisionDate = class {
  /**
   * Gets either window.performance.now() if supported or Date.now() else
   */
  static get Now() {
    if (IsWindowObjectExist() && window.performance && window.performance.now) {
      return window.performance.now();
    }
    return Date.now();
  }
};

export {
  PrecisionDate
};
//# sourceMappingURL=chunk-BGSVSY55.js.map
