// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Misc/uniqueIdGenerator.js
var UniqueIdGenerator = class {
  /**
   * Gets an unique (relatively to the current scene) Id
   */
  static get UniqueId() {
    const result = this._UniqueIdCounter;
    this._UniqueIdCounter++;
    return result;
  }
};
UniqueIdGenerator._UniqueIdCounter = 1;

export {
  UniqueIdGenerator
};
//# sourceMappingURL=chunk-2DA7GQ3K.js.map
