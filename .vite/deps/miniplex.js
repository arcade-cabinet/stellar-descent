import {
  __commonJS,
  __toESM
} from "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/eventery@0.0.4/node_modules/eventery/dist/eventery.cjs.dev.js
var require_eventery_cjs_dev = __commonJS({
  "node_modules/.pnpm/eventery@0.0.4/node_modules/eventery/dist/eventery.cjs.dev.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function _arrayLikeToArray3(arr, len) {
      if (len == null || len > arr.length) len = arr.length;
      for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
      return arr2;
    }
    function _arrayWithoutHoles2(arr) {
      if (Array.isArray(arr)) return _arrayLikeToArray3(arr);
    }
    function _iterableToArray2(iter) {
      if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
    }
    function _unsupportedIterableToArray3(o, minLen) {
      if (!o) return;
      if (typeof o === "string") return _arrayLikeToArray3(o, minLen);
      var n = Object.prototype.toString.call(o).slice(8, -1);
      if (n === "Object" && o.constructor) n = o.constructor.name;
      if (n === "Map" || n === "Set") return Array.from(o);
      if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray3(o, minLen);
    }
    function _nonIterableSpread2() {
      throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
    }
    function _toConsumableArray2(arr) {
      return _arrayWithoutHoles2(arr) || _iterableToArray2(arr) || _unsupportedIterableToArray3(arr) || _nonIterableSpread2();
    }
    function _createForOfIteratorHelper3(o, allowArrayLike) {
      var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
      if (!it) {
        if (Array.isArray(o) || (it = _unsupportedIterableToArray3(o)) || allowArrayLike && o && typeof o.length === "number") {
          if (it) o = it;
          var i = 0;
          var F = function() {
          };
          return {
            s: F,
            n: function() {
              if (i >= o.length) return {
                done: true
              };
              return {
                done: false,
                value: o[i++]
              };
            },
            e: function(e) {
              throw e;
            },
            f: F
          };
        }
        throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
      }
      var normalCompletion = true, didErr = false, err;
      return {
        s: function() {
          it = it.call(o);
        },
        n: function() {
          var step = it.next();
          normalCompletion = step.done;
          return step;
        },
        e: function(e) {
          didErr = true;
          err = e;
        },
        f: function() {
          try {
            if (!normalCompletion && it.return != null) it.return();
          } finally {
            if (didErr) throw err;
          }
        }
      };
    }
    function _classCallCheck3(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    function _toPrimitive3(input, hint) {
      if (typeof input !== "object" || input === null) return input;
      var prim = input[Symbol.toPrimitive];
      if (prim !== void 0) {
        var res = prim.call(input, hint || "default");
        if (typeof res !== "object") return res;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return (hint === "string" ? String : Number)(input);
    }
    function _toPropertyKey3(arg) {
      var key = _toPrimitive3(arg, "string");
      return typeof key === "symbol" ? key : String(key);
    }
    function _defineProperties3(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, _toPropertyKey3(descriptor.key), descriptor);
      }
    }
    function _createClass3(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties3(Constructor.prototype, protoProps);
      if (staticProps) _defineProperties3(Constructor, staticProps);
      Object.defineProperty(Constructor, "prototype", {
        writable: false
      });
      return Constructor;
    }
    function _defineProperty3(obj, key, value) {
      key = _toPropertyKey3(key);
      if (key in obj) {
        Object.defineProperty(obj, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    var Event2 = (function() {
      function Event3() {
        _classCallCheck3(this, Event3);
        _defineProperty3(this, "subscribers", /* @__PURE__ */ new Set());
      }
      _createClass3(Event3, [{
        key: "onSubscribe",
        get: (
          /**
           * Event that is emitted when a new subscription is added.
           */
          function get() {
            if (!this._onSubscribe) this._onSubscribe = new Event3();
            return this._onSubscribe;
          }
        )
        /**
         * Event that is emitted when a subscription is removed.
         */
      }, {
        key: "onUnsubscribe",
        get: function get() {
          if (!this._onUnsubscribe) this._onUnsubscribe = new Event3();
          return this._onUnsubscribe;
        }
        /**
         * Subscribes a callback to the event.
         *
         * @param callback The callback to subscribe to the event.
         */
      }, {
        key: "subscribe",
        value: function subscribe(callback) {
          var _this$_onSubscribe, _this = this;
          this.subscribers.add(callback);
          (_this$_onSubscribe = this._onSubscribe) === null || _this$_onSubscribe === void 0 ? void 0 : _this$_onSubscribe.emit(callback);
          return function() {
            return _this.unsubscribe(callback);
          };
        }
        /**
         * Unsubscribes a callback from the event.
         *
         * @param callback The callback to unsubscribe from the event.
         */
      }, {
        key: "unsubscribe",
        value: function unsubscribe(callback) {
          var _this$_onUnsubscribe;
          this.subscribers["delete"](callback);
          (_this$_onUnsubscribe = this._onUnsubscribe) === null || _this$_onUnsubscribe === void 0 ? void 0 : _this$_onUnsubscribe.emit(callback);
        }
        /**
         * Clears all existing subscriptions.
         */
      }, {
        key: "clear",
        value: function clear() {
          if (this._onUnsubscribe) {
            var _iterator = _createForOfIteratorHelper3(this.subscribers), _step;
            try {
              for (_iterator.s(); !(_step = _iterator.n()).done; ) {
                var _callback = _step.value;
                this._onUnsubscribe.emit(_callback);
              }
            } catch (err) {
              _iterator.e(err);
            } finally {
              _iterator.f();
            }
          }
          this.subscribers.clear();
        }
        /**
         * Emit the event. This will invoke all stored listeners, passing the
         * given payload to each of them.
         *
         * @param args Arguments to pass to the listeners.
         */
      }, {
        key: "emit",
        value: function emit() {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          this.subscribers.forEach(function(callback) {
            return callback.apply(void 0, args);
          });
        }
        /**
         * Emit the event. This will invoke all stored listeners, passing the
         * given payload to each of them. This method supports asynchronous
         * listeners and returns a promise that resolves when all listeners
         * have completed their work.
         *
         * @param args Arguments to pass to the listeners.
         * @returns A promise that resolves when all listeners have been invoked.
         */
      }, {
        key: "emitAsync",
        value: function emitAsync() {
          for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }
          return Promise.all(_toConsumableArray2(this.subscribers).map(function(listener) {
            return listener.apply(void 0, args);
          }));
        }
      }]);
      return Event3;
    })();
    exports.Event = Event2;
  }
});

// node_modules/.pnpm/eventery@0.0.4/node_modules/eventery/dist/eventery.cjs.js
var require_eventery_cjs = __commonJS({
  "node_modules/.pnpm/eventery@0.0.4/node_modules/eventery/dist/eventery.cjs.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_eventery_cjs_dev();
    }
  }
});

// node_modules/.pnpm/@miniplex+bucket@2.0.0/node_modules/@miniplex/bucket/dist/miniplex-bucket.esm.js
var import_eventery = __toESM(require_eventery_cjs());
function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
  return arr2;
}
function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}
function _createForOfIteratorHelper(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (!it) {
    if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
      if (it) o = it;
      var i = 0;
      var F = function() {
      };
      return {
        s: F,
        n: function() {
          if (i >= o.length) return {
            done: true
          };
          return {
            done: false,
            value: o[i++]
          };
        },
        e: function(e) {
          throw e;
        },
        f: F
      };
    }
    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  var normalCompletion = true, didErr = false, err;
  return {
    s: function() {
      it = it.call(o);
    },
    n: function() {
      var step = it.next();
      normalCompletion = step.done;
      return step;
    },
    e: function(e) {
      didErr = true;
      err = e;
    },
    f: function() {
      try {
        if (!normalCompletion && it.return != null) it.return();
      } finally {
        if (didErr) throw err;
      }
    }
  };
}
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function _toPrimitive(input, hint) {
  if (typeof input !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== void 0) {
    var res = prim.call(input, hint || "default");
    if (typeof res !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return typeof key === "symbol" ? key : String(key);
}
function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
  }
}
function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var _Symbol$iterator;
_Symbol$iterator = Symbol.iterator;
var Bucket = (function() {
  function Bucket2() {
    var _entities = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
    _classCallCheck(this, Bucket2);
    _defineProperty(this, "_version", 0);
    _defineProperty(this, "onEntityAdded", new import_eventery.Event());
    _defineProperty(this, "onEntityRemoved", new import_eventery.Event());
    _defineProperty(this, "entityPositions", /* @__PURE__ */ new Map());
    this._entities = _entities;
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
    for (var i = 0; i < _entities.length; i++) {
      this.entityPositions.set(_entities[i], i);
    }
  }
  _createClass(Bucket2, [{
    key: "version",
    get: (
      /**
       * The current version of the bucket. Increases every time an entity is
       * added or removed.
       */
      function get() {
        return this._version;
      }
    )
    /**
     * An array of all entities within the bucket. Please note that for iterating
     * over the entities in this bucket, it is recommended that you use the
     * `for (const entity of bucket)` iterator form.
     */
  }, {
    key: "entities",
    get: function get() {
      return this._entities;
    }
    /* Custom iterator that iterates over all entities in reverse order. */
  }, {
    key: _Symbol$iterator,
    value: function value() {
      var _this = this;
      var index = this._entities.length;
      var result = {
        value: void 0,
        done: false
      };
      return {
        next: function next() {
          result.value = _this._entities[--index];
          result.done = index < 0;
          return result;
        }
      };
    }
  }, {
    key: "size",
    get: (
      /**
       * Returns the total size of the bucket, i.e. the number of entities it contains.
       */
      function get() {
        return this.entities.length;
      }
    )
    /**
     * Returns the first entity in the bucket, or `undefined` if the bucket is empty.
     */
  }, {
    key: "first",
    get: function get() {
      return this.entities[0];
    }
    /**
     * Returns true if the bucket contains the given entity.
     *
     * @param entity The entity to check for.
     * @returns `true` if the specificed entity is in this bucket, `false` otherwise.
     */
  }, {
    key: "has",
    value: function has(entity) {
      return this.entityPositions.has(entity);
    }
    /**
     * Adds the given entity to the bucket. If the entity is already in the bucket, it is
     * not added again.
     *
     * @param entity The entity to add to the bucket.
     * @returns The entity passed into this function (regardless of whether it was added or not).
     */
  }, {
    key: "add",
    value: function add(entity) {
      if (entity && !this.has(entity)) {
        this.entities.push(entity);
        this.entityPositions.set(entity, this.entities.length - 1);
        this._version++;
        this.onEntityAdded.emit(entity);
      }
      return entity;
    }
    /**
     * Removes the given entity from the bucket. If the entity is not in the bucket, nothing
     * happens.
     *
     * @param entity The entity to remove from the bucket.
     * @returns The entity passed into this function (regardless of whether it was removed or not).
     */
  }, {
    key: "remove",
    value: function remove(entity) {
      if (this.has(entity)) {
        this.onEntityRemoved.emit(entity);
        var index = this.entityPositions.get(entity);
        this.entityPositions["delete"](entity);
        var other = this.entities[this.entities.length - 1];
        if (other !== entity) {
          this.entities[index] = other;
          this.entityPositions.set(other, index);
        }
        this.entities.pop();
        this._version++;
      }
      return entity;
    }
    /**
     * Removes all entities from the bucket. Will cause the `onEntityRemoved` event to be
     * fired for each entity.
     */
  }, {
    key: "clear",
    value: function clear() {
      var _iterator = _createForOfIteratorHelper(this), _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done; ) {
          var _entity = _step.value;
          this.remove(_entity);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }
  }]);
  return Bucket2;
})();

// node_modules/.pnpm/@hmans+id@0.0.1/node_modules/@hmans/id/dist/hmans-id.esm.js
var entityToId = /* @__PURE__ */ new WeakMap();
var nextId = 0;
var id = function id2(object) {
  var id3 = entityToId.get(object);
  if (id3 !== void 0) return id3;
  entityToId.set(object, nextId);
  return nextId++;
};

// node_modules/.pnpm/@hmans+queue@0.0.1/node_modules/@hmans/queue/dist/hmans-queue.esm.js
function createQueue() {
  var queue2 = new Array();
  function add(fn) {
    queue2.push(fn);
  }
  function clear() {
    queue2.length = 0;
  }
  function flush() {
    queue2.forEach(function(fn) {
      return fn();
    });
    clear();
  }
  add.clear = clear;
  add.flush = flush;
  return add;
}

// node_modules/.pnpm/miniplex@2.0.0/node_modules/miniplex/dist/miniplex.esm.js
function _arrayLikeToArray2(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
  return arr2;
}
function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) return _arrayLikeToArray2(arr);
}
function _iterableToArray(iter) {
  if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _unsupportedIterableToArray2(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray2(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray2(o, minLen);
}
function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray2(arr) || _nonIterableSpread();
}
function _getPrototypeOf(o) {
  _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function _getPrototypeOf2(o2) {
    return o2.__proto__ || Object.getPrototypeOf(o2);
  };
  return _getPrototypeOf(o);
}
function _superPropBase(object, property) {
  while (!Object.prototype.hasOwnProperty.call(object, property)) {
    object = _getPrototypeOf(object);
    if (object === null) break;
  }
  return object;
}
function _get() {
  if (typeof Reflect !== "undefined" && Reflect.get) {
    _get = Reflect.get.bind();
  } else {
    _get = function _get2(target, property, receiver) {
      var base = _superPropBase(target, property);
      if (!base) return;
      var desc = Object.getOwnPropertyDescriptor(base, property);
      if (desc.get) {
        return desc.get.call(arguments.length < 3 ? target : receiver);
      }
      return desc.value;
    };
  }
  return _get.apply(this, arguments);
}
function _createForOfIteratorHelper2(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (!it) {
    if (Array.isArray(o) || (it = _unsupportedIterableToArray2(o)) || allowArrayLike && o && typeof o.length === "number") {
      if (it) o = it;
      var i = 0;
      var F = function() {
      };
      return {
        s: F,
        n: function() {
          if (i >= o.length) return {
            done: true
          };
          return {
            done: false,
            value: o[i++]
          };
        },
        e: function(e) {
          throw e;
        },
        f: F
      };
    }
    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  var normalCompletion = true, didErr = false, err;
  return {
    s: function() {
      it = it.call(o);
    },
    n: function() {
      var step = it.next();
      normalCompletion = step.done;
      return step;
    },
    e: function(e) {
      didErr = true;
      err = e;
    },
    f: function() {
      try {
        if (!normalCompletion && it.return != null) it.return();
      } finally {
        if (didErr) throw err;
      }
    }
  };
}
function _toPrimitive2(input, hint) {
  if (typeof input !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== void 0) {
    var res = prim.call(input, hint || "default");
    if (typeof res !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function _toPropertyKey2(arg) {
  var key = _toPrimitive2(arg, "string");
  return typeof key === "symbol" ? key : String(key);
}
function _defineProperty2(obj, key, value) {
  key = _toPropertyKey2(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function(sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), true).forEach(function(key) {
      _defineProperty2(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function(key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }
  return target;
}
function _classCallCheck2(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function _defineProperties2(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, _toPropertyKey2(descriptor.key), descriptor);
  }
}
function _createClass2(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties2(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties2(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}
function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return self;
}
function _setPrototypeOf(o, p) {
  _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function _setPrototypeOf2(o2, p2) {
    o2.__proto__ = p2;
    return o2;
  };
  return _setPrototypeOf(o, p);
}
function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  Object.defineProperty(subClass, "prototype", {
    writable: false
  });
  if (superClass) _setPrototypeOf(subClass, superClass);
}
function _isNativeReflectConstruct() {
  if (typeof Reflect === "undefined" || !Reflect.construct) return false;
  if (Reflect.construct.sham) return false;
  if (typeof Proxy === "function") return true;
  try {
    Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
    }));
    return true;
  } catch (e) {
    return false;
  }
}
function _possibleConstructorReturn(self, call) {
  if (call && (typeof call === "object" || typeof call === "function")) {
    return call;
  } else if (call !== void 0) {
    throw new TypeError("Derived constructors may only return object or undefined");
  }
  return _assertThisInitialized(self);
}
function _createSuper(Derived) {
  var hasNativeReflectConstruct = _isNativeReflectConstruct();
  return function _createSuperInternal() {
    var Super = _getPrototypeOf(Derived), result;
    if (hasNativeReflectConstruct) {
      var NewTarget = _getPrototypeOf(this).constructor;
      result = Reflect.construct(Super, arguments, NewTarget);
    } else {
      result = Super.apply(this, arguments);
    }
    return _possibleConstructorReturn(this, result);
  };
}
var _Symbol$iterator2;
var World = (function(_ref) {
  _inherits(World2, _ref);
  var _super = _createSuper(World2);
  function World2() {
    var _this;
    var entities = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
    _classCallCheck2(this, World2);
    _this = _super.call(this, entities);
    _defineProperty2(_assertThisInitialized(_this), "queries", /* @__PURE__ */ new Set());
    _defineProperty2(_assertThisInitialized(_this), "entityToId", /* @__PURE__ */ new Map());
    _defineProperty2(_assertThisInitialized(_this), "idToEntity", /* @__PURE__ */ new Map());
    _defineProperty2(_assertThisInitialized(_this), "nextId", 0);
    _this.onEntityAdded.subscribe(function(entity) {
      _this.reindex(entity);
    });
    _this.onEntityRemoved.subscribe(function(entity) {
      _this.queries.forEach(function(query) {
        return query.remove(entity);
      });
      if (_this.entityToId.has(entity)) {
        var _id = _this.entityToId.get(entity);
        _this.idToEntity["delete"](_id);
        _this.entityToId["delete"](entity);
      }
    });
    return _this;
  }
  _createClass2(World2, [{
    key: "update",
    value: (function(_update) {
      function update(_x, _x2, _x3) {
        return _update.apply(this, arguments);
      }
      update.toString = function() {
        return _update.toString();
      };
      return update;
    })(
      function(entity, update, value) {
        if (typeof update === "function") {
          var partial = update(entity);
          partial && Object.assign(entity, partial);
        } else if (typeof update === "string") {
          entity[update] = value;
        } else if (update) {
          Object.assign(entity, update);
        }
        this.reindex(entity);
        return entity;
      }
      /**
       * Adds a component to an entity. If the entity already has the component, the
       * existing component will not be overwritten.
       *
       * After the component was added, the entity will be reindexed, causing it to be
       * added to or removed from any queries depending on their criteria.
       *
       * @param entity The entity to modify.
       * @param component The name of the component to add.
       * @param value The value of the component to add.
       */
    )
  }, {
    key: "addComponent",
    value: function addComponent(entity, component, value) {
      if (entity[component] !== void 0) return;
      entity[component] = value;
      this.reindex(entity);
    }
    /**
     * Removes a component from an entity. If the entity does not have the component,
     * this function does nothing.
     *
     * After the component was removed, the entity will be reindexed, causing it to be
     * added to or removed from any queries depending on their criteria.
     *
     * @param entity The entity to modify.
     * @param component The name of the component to remove.
     */
  }, {
    key: "removeComponent",
    value: function removeComponent(entity, component) {
      if (entity[component] === void 0) return;
      if (this.has(entity)) {
        var future = _objectSpread2({}, entity);
        delete future[component];
        this.reindex(entity, future);
      }
      delete entity[component];
    }
  }, {
    key: "query",
    value: (
      /**
       * Creates (or reuses) a query that matches the given configuration.
       *
       * @param config The query configuration.
       * @returns A query that matches the given configuration.
       */
      function query(config) {
        var normalizedConfig = normalizeQueryConfiguration(config);
        var key = configKey(normalizedConfig);
        var _iterator = _createForOfIteratorHelper2(this.queries), _step;
        try {
          for (_iterator.s(); !(_step = _iterator.n()).done; ) {
            var _query = _step.value;
            if (_query.key === key) {
              return _query;
            }
          }
        } catch (err) {
          _iterator.e(err);
        } finally {
          _iterator.f();
        }
        var query2 = new Query(this, normalizedConfig);
        this.queries.add(query2);
        return query2;
      }
    )
    /**
     * Creates (or reuses) a query that holds entities that have all of the specified
     * components.
     *
     * @param components One or more component names to query for.
     * @returns A query that holds entities that have all of the given components.
     */
  }, {
    key: "with",
    value: function _with() {
      for (var _len = arguments.length, components = new Array(_len), _key = 0; _key < _len; _key++) {
        components[_key] = arguments[_key];
      }
      return this.query({
        "with": components,
        without: [],
        predicates: []
      });
    }
    /**
     * Creates (or reuses) a query that holds entities that do not have any of the
     * specified components.
     *
     * @param components One or more component names to query for.
     * @returns A query that holds entities that do not have any of the given components.
     */
  }, {
    key: "without",
    value: function without() {
      for (var _len2 = arguments.length, components = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        components[_key2] = arguments[_key2];
      }
      return this.query({
        "with": [],
        without: components,
        predicates: []
      });
    }
    /**
     * Creates (or reuses) a query that holds entities that match the given predicate.
     * Please note that as soon as you are building queries that use predicates, you
     * will need to explicitly reindex entities when their properties change.
     *
     * @param predicate The predicate that entities must match.
     * @returns A query that holds entities that match the given predicate.
     */
  }, {
    key: "where",
    value: function where(predicate) {
      return this.query({
        "with": [],
        without: [],
        predicates: [predicate]
      });
    }
    /**
     * Reindexes the specified entity. This will iteratere over all registered queries
     * and ask them to reevaluate the entity.
     *
     * If the `future` parameter is specified,
     * it will be used in the evaluation instead of the entity itself. This is useful
     * if you are about to perform a destructive change on the entity (like removing
     * a component), but want emitted events to still have access to the unmodified entity
     * before the change.
     *
     * @param entity The entity to reindex.
     * @param future The entity that the entity will become in the future.
     */
  }, {
    key: "reindex",
    value: function reindex(entity) {
      var future = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : entity;
      if (!this.has(entity)) return;
      var _iterator2 = _createForOfIteratorHelper2(this.queries), _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done; ) {
          var query = _step2.value;
          query.evaluate(entity, future);
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    }
  }, {
    key: "id",
    value: (
      /**
       * Generate and return a numerical identifier for the given entity. The ID can later
       * be used to retrieve the entity again through the `entity(id)` method.
       *
       * @param entity The entity to get the ID for.
       * @returns An ID for the entity, or undefined if the entity is not in the world.
       */
      function id3(entity) {
        if (!this.has(entity)) return void 0;
        if (!this.entityToId.has(entity)) {
          var _id2 = this.nextId++;
          this.entityToId.set(entity, _id2);
          this.idToEntity.set(_id2, entity);
        }
        return this.entityToId.get(entity);
      }
    )
    /**
     * Given an entity ID that was previously generated through the `id(entity)` function,
     * returns the entity matching that ID, or undefined if no such entity exists.
     *
     * @param id The ID of the entity to retrieve.
     * @returns The entity with the given ID, or undefined if no such entity exists.
     */
  }, {
    key: "entity",
    value: function entity(id3) {
      return this.idToEntity.get(id3);
    }
  }]);
  return World2;
})(Bucket);
_Symbol$iterator2 = Symbol.iterator;
var Query = (function(_Bucket) {
  _inherits(Query2, _Bucket);
  var _super2 = _createSuper(Query2);
  function Query2(world, config) {
    var _this2;
    _classCallCheck2(this, Query2);
    _this2 = _super2.call(this);
    _defineProperty2(_assertThisInitialized(_this2), "_isConnected", false);
    _this2.world = world;
    _this2.config = config;
    _this2.key = configKey(config);
    _this2.onEntityAdded.onSubscribe.subscribe(function() {
      return _this2.connect();
    });
    _this2.onEntityRemoved.onSubscribe.subscribe(function() {
      return _this2.connect();
    });
    return _this2;
  }
  _createClass2(Query2, [{
    key: "isConnected",
    get: (
      /**
       * True if this query is connected to the world, and will automatically
       * re-evaluate when entities are added or removed.
       */
      function get() {
        return this._isConnected;
      }
    )
    /**
     * A unique, string-based key for this query, based on its configuration.
     */
  }, {
    key: "entities",
    get: function get() {
      if (!this._isConnected) this.connect();
      return _get(_getPrototypeOf(Query2.prototype), "entities", this);
    }
  }, {
    key: _Symbol$iterator2,
    value: function value() {
      if (!this._isConnected) this.connect();
      return _get(_getPrototypeOf(Query2.prototype), Symbol.iterator, this).call(this);
    }
    /**
     * Connects this query to the world. While connected, it will automatically
     * re-evaluate when entities are added or removed, and store those that match
     * its query configuration.
     *
     * @returns The query object.
     */
  }, {
    key: "connect",
    value: function connect() {
      if (!this._isConnected) {
        this._isConnected = true;
        var _iterator3 = _createForOfIteratorHelper2(this.world), _step3;
        try {
          for (_iterator3.s(); !(_step3 = _iterator3.n()).done; ) {
            var _entity = _step3.value;
            this.evaluate(_entity);
          }
        } catch (err) {
          _iterator3.e(err);
        } finally {
          _iterator3.f();
        }
      }
      return this;
    }
    /**
     * Disconnects this query from the world. This essentially stops the query from
     * automatically receiving entities.
     */
  }, {
    key: "disconnect",
    value: function disconnect() {
      this._isConnected = false;
      return this;
    }
    /**
     * Returns a new query that extends this query and also matches entities that
     * have all of the components specified.
     *
     * @param components The components that entities must have.
     * @returns A new query representing the extended query configuration.
     */
  }, {
    key: "with",
    value: function _with() {
      for (var _len3 = arguments.length, components = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        components[_key3] = arguments[_key3];
      }
      return this.world.query(_objectSpread2(_objectSpread2({}, this.config), {}, {
        "with": [].concat(_toConsumableArray(this.config["with"]), components)
      }));
    }
    /**
     * Returns a new query that extends this query and also matches entities that
     * have none of the components specified.
     *
     * @param components The components that entities must not have.
     * @returns A new query representing the extended query configuration.
     */
  }, {
    key: "without",
    value: function without() {
      for (var _len4 = arguments.length, components = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        components[_key4] = arguments[_key4];
      }
      return this.world.query(_objectSpread2(_objectSpread2({}, this.config), {}, {
        without: [].concat(_toConsumableArray(this.config.without), components)
      }));
    }
    /**
     * Returns a new query that extends this query and also matches entities that
     * match the given predicate.
     *
     * @param predicate The predicate that entities must match.
     * @returns A new query representing the extended query configuration.
     */
  }, {
    key: "where",
    value: function where(predicate) {
      return this.world.query(_objectSpread2(_objectSpread2({}, this.config), {}, {
        predicates: [].concat(_toConsumableArray(this.config.predicates), [predicate])
      }));
    }
    /**
     * Checks the given entity against this query's configuration, and returns
     * true if the entity matches the query, false otherwise.
     *
     * @param entity The entity to check.
     * @returns True if the entity matches this query, false otherwise.
     */
  }, {
    key: "want",
    value: function want(entity) {
      return this.config["with"].every(function(component) {
        return entity[component] !== void 0;
      }) && this.config.without.every(function(component) {
        return entity[component] === void 0;
      }) && this.config.predicates.every(function(predicate) {
        return predicate(entity);
      });
    }
    /**
     * Evaluate the given entity against this query's configuration, and add or
     * remove it from the query if necessary.
     *
     * If `future` is specified, the entity will be evaluated against that entity
     * instead. This is useful for checking if an entity will match the query
     * after some potentially destructive change has been made to it, before
     * actually applying that change to the entity itself.
     *
     * @param entity The entity to evaluate.
     * @param future The entity to evaluate against. If not specified, the entity will be evaluated against itself.
     */
  }, {
    key: "evaluate",
    value: function evaluate(entity) {
      var future = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : entity;
      if (!this.isConnected) return;
      var wanted = this.want(future);
      var has = this.has(entity);
      if (wanted && !has) {
        this.add(entity);
      } else if (!wanted && has) {
        this.remove(entity);
      }
    }
  }]);
  return Query2;
})(Bucket);
var normalizeComponents = function normalizeComponents2(components) {
  return _toConsumableArray(new Set(components.sort().filter(function(c) {
    return !!c && c !== "";
  })));
};
function normalizePredicates(predicates) {
  return _toConsumableArray(new Set(predicates));
}
function normalizeQueryConfiguration(config) {
  return {
    "with": normalizeComponents(config["with"]),
    without: normalizeComponents(config.without),
    predicates: normalizePredicates(config.predicates)
  };
}
function configKey(config) {
  return "".concat(config["with"].join(","), ":").concat(config.without.join(","), ":").concat(config.predicates.map(function(p) {
    return id(p);
  }).join(","));
}
var queue = createQueue();
export {
  Bucket,
  Query,
  World,
  queue
};
//# sourceMappingURL=miniplex.js.map
