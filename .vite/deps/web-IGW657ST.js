import {
  WebPlugin
} from "./chunk-BCTQ5D4I.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@capacitor+screen-orientation@8.0.0_@capacitor+core@8.0.2/node_modules/@capacitor/screen-orientation/dist/esm/web.js
var ScreenOrientationWeb = class extends WebPlugin {
  constructor() {
    super();
    if (typeof screen !== "undefined" && typeof screen.orientation !== "undefined") {
      screen.orientation.addEventListener("change", () => {
        const type = screen.orientation.type;
        this.notifyListeners("screenOrientationChange", { type });
      });
    }
  }
  async orientation() {
    if (typeof screen === "undefined" || !screen.orientation) {
      throw this.unavailable("ScreenOrientation API not available in this browser");
    }
    return { type: screen.orientation.type };
  }
  async lock(options) {
    if (typeof screen === "undefined" || !screen.orientation || !screen.orientation.lock) {
      throw this.unavailable("ScreenOrientation API not available in this browser");
    }
    try {
      await screen.orientation.lock(options.orientation);
    } catch (_a) {
      throw this.unavailable("ScreenOrientation API not available in this browser");
    }
  }
  async unlock() {
    if (typeof screen === "undefined" || !screen.orientation || !screen.orientation.unlock) {
      throw this.unavailable("ScreenOrientation API not available in this browser");
    }
    try {
      screen.orientation.unlock();
    } catch (_a) {
      throw this.unavailable("ScreenOrientation API not available in this browser");
    }
  }
};
export {
  ScreenOrientationWeb
};
//# sourceMappingURL=web-IGW657ST.js.map
