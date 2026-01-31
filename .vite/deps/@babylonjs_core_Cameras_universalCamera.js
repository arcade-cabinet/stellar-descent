import {
  CameraInputTypes,
  CameraInputsManager,
  FreeCamera,
  FreeCameraInputsManager
} from "./chunk-KKOGFWJG.js";
import {
  Camera
} from "./chunk-CESSEMZQ.js";
import "./chunk-4SFBNKXP.js";
import "./chunk-W7NAK7I4.js";
import {
  Scene
} from "./chunk-WNGJ3WNO.js";
import {
  EventConstants,
  KeyboardEventTypes
} from "./chunk-BELK345T.js";
import {
  PointerEventTypes
} from "./chunk-VMWDNJJG.js";
import "./chunk-GGUL3CXV.js";
import "./chunk-2DA7GQ3K.js";
import "./chunk-4CFWIRXS.js";
import "./chunk-QU3LKDUB.js";
import {
  SceneComponentConstants
} from "./chunk-XSRNQTYL.js";
import "./chunk-WOKXMMT7.js";
import "./chunk-YNSIAG7O.js";
import "./chunk-T324X5NK.js";
import "./chunk-VMPPSYS3.js";
import "./chunk-EWHDDCCY.js";
import {
  Plane
} from "./chunk-4ZWKSYMN.js";
import "./chunk-ZOIT5ZEZ.js";
import "./chunk-XAOF3L4F.js";
import "./chunk-CSVPIDNO.js";
import "./chunk-YVYIHIJT.js";
import {
  Tools
} from "./chunk-2GZCEIFN.js";
import "./chunk-SVWFF7VD.js";
import "./chunk-ORJOFH3C.js";
import "./chunk-L6UPA4UW.js";
import {
  AbstractEngine
} from "./chunk-CQNOHBC6.js";
import "./chunk-BGSVSY55.js";
import "./chunk-RG742WGM.js";
import {
  IsWindowObjectExist
} from "./chunk-AB3HOSPI.js";
import "./chunk-4KL4KK2C.js";
import "./chunk-N5T6XPNQ.js";
import "./chunk-2HUMDLGD.js";
import "./chunk-QD4Q3FLX.js";
import "./chunk-BFIQD25N.js";
import "./chunk-57LBGEP2.js";
import {
  Node
} from "./chunk-D664DUZM.js";
import "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize
} from "./chunk-STIKNZXL.js";
import "./chunk-I3IYKWNG.js";
import "./chunk-MMWR3MO4.js";
import {
  Matrix,
  TmpVectors,
  Vector2,
  Vector3
} from "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import {
  Epsilon
} from "./chunk-DSUROWQ4.js";
import "./chunk-LUXUKJKM.js";
import {
  Clamp
} from "./chunk-WOUDRWXV.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/touchCamera.js
Node.AddNodeConstructor("TouchCamera", (name, scene) => {
  return () => new TouchCamera(name, Vector3.Zero(), scene);
});
var TouchCamera = class extends FreeCamera {
  /**
   * Defines the touch sensibility for rotation.
   * The higher the faster.
   */
  get touchAngularSensibility() {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      return touch.touchAngularSensibility;
    }
    return 0;
  }
  set touchAngularSensibility(value) {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      touch.touchAngularSensibility = value;
    }
  }
  /**
   * Defines the touch sensibility for move.
   * The higher the faster.
   */
  get touchMoveSensibility() {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      return touch.touchMoveSensibility;
    }
    return 0;
  }
  set touchMoveSensibility(value) {
    const touch = this.inputs.attached["touch"];
    if (touch) {
      touch.touchMoveSensibility = value;
    }
  }
  /**
   * Instantiates a new touch camera.
   * This represents a FPS type of camera controlled by touch.
   * This is like a universal camera minus the Gamepad controls.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_introduction#universal-camera
   * @param name Define the name of the camera in the scene
   * @param position Define the start position of the camera in the scene
   * @param scene Define the scene the camera belongs to
   */
  constructor(name, position, scene) {
    super(name, position, scene);
    this.inputs.addTouch();
    this._setupInputs();
  }
  /**
   * Gets the current object class name.
   * @returns the class name
   */
  getClassName() {
    return "TouchCamera";
  }
  /** @internal */
  _setupInputs() {
    const touch = this.inputs.attached["touch"];
    const mouse = this.inputs.attached["mouse"];
    if (mouse) {
      mouse.touchEnabled = !touch;
    } else if (touch) {
      touch.allowMouse = !mouse;
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Gamepads/gamepad.js
var Gamepad = class _Gamepad {
  /**
   * Specifies if the gamepad has been connected
   */
  get isConnected() {
    return this._isConnected;
  }
  /**
   * Initializes the gamepad
   * @param id The id of the gamepad
   * @param index The index of the gamepad
   * @param browserGamepad The browser gamepad
   * @param leftStickX The x component of the left joystick
   * @param leftStickY The y component of the left joystick
   * @param rightStickX The x component of the right joystick
   * @param rightStickY The y component of the right joystick
   */
  constructor(id, index, browserGamepad, leftStickX = 0, leftStickY = 1, rightStickX = 2, rightStickY = 3) {
    this.id = id;
    this.index = index;
    this.browserGamepad = browserGamepad;
    this._leftStick = { x: 0, y: 0 };
    this._rightStick = { x: 0, y: 0 };
    this._isConnected = true;
    this._invertLeftStickY = false;
    this.type = _Gamepad.GAMEPAD;
    this._leftStickAxisX = leftStickX;
    this._leftStickAxisY = leftStickY;
    this._rightStickAxisX = rightStickX;
    this._rightStickAxisY = rightStickY;
    if (this.browserGamepad.axes.length >= 2) {
      this._leftStick = { x: this.browserGamepad.axes[this._leftStickAxisX], y: this.browserGamepad.axes[this._leftStickAxisY] };
    }
    if (this.browserGamepad.axes.length >= 4) {
      this._rightStick = { x: this.browserGamepad.axes[this._rightStickAxisX], y: this.browserGamepad.axes[this._rightStickAxisY] };
    }
  }
  /**
   * Callback triggered when the left joystick has changed
   * @param callback callback to trigger
   */
  onleftstickchanged(callback) {
    this._onleftstickchanged = callback;
  }
  /**
   * Callback triggered when the right joystick has changed
   * @param callback callback to trigger
   */
  onrightstickchanged(callback) {
    this._onrightstickchanged = callback;
  }
  /**
   * Gets the left joystick
   */
  get leftStick() {
    return this._leftStick;
  }
  /**
   * Sets the left joystick values
   */
  set leftStick(newValues) {
    if (this._onleftstickchanged && (this._leftStick.x !== newValues.x || this._leftStick.y !== newValues.y)) {
      this._onleftstickchanged(newValues);
    }
    this._leftStick = newValues;
  }
  /**
   * Gets the right joystick
   */
  get rightStick() {
    return this._rightStick;
  }
  /**
   * Sets the right joystick value
   */
  set rightStick(newValues) {
    if (this._onrightstickchanged && (this._rightStick.x !== newValues.x || this._rightStick.y !== newValues.y)) {
      this._onrightstickchanged(newValues);
    }
    this._rightStick = newValues;
  }
  /**
   * Updates the gamepad joystick positions
   */
  update() {
    if (this._leftStick) {
      this.leftStick = { x: this.browserGamepad.axes[this._leftStickAxisX], y: this.browserGamepad.axes[this._leftStickAxisY] };
      if (this._invertLeftStickY) {
        this.leftStick.y *= -1;
      }
    }
    if (this._rightStick) {
      this.rightStick = { x: this.browserGamepad.axes[this._rightStickAxisX], y: this.browserGamepad.axes[this._rightStickAxisY] };
    }
  }
  /**
   * Disposes the gamepad
   */
  dispose() {
  }
};
Gamepad.GAMEPAD = 0;
Gamepad.GENERIC = 1;
Gamepad.XBOX = 2;
Gamepad.POSE_ENABLED = 3;
Gamepad.DUALSHOCK = 4;
var GenericPad = class extends Gamepad {
  /**
   * Callback triggered when a button has been pressed
   * @param callback Called when a button has been pressed
   */
  onbuttondown(callback) {
    this._onbuttondown = callback;
  }
  /**
   * Callback triggered when a button has been released
   * @param callback Called when a button has been released
   */
  onbuttonup(callback) {
    this._onbuttonup = callback;
  }
  /**
   * Initializes the generic gamepad
   * @param id The id of the generic gamepad
   * @param index The index of the generic gamepad
   * @param browserGamepad The browser gamepad
   */
  constructor(id, index, browserGamepad) {
    super(id, index, browserGamepad);
    this.onButtonDownObservable = new Observable();
    this.onButtonUpObservable = new Observable();
    this.type = Gamepad.GENERIC;
    this._buttons = new Array(browserGamepad.buttons.length);
  }
  _setButtonValue(newValue, currentValue, buttonIndex) {
    if (newValue !== currentValue) {
      if (newValue === 1) {
        if (this._onbuttondown) {
          this._onbuttondown(buttonIndex);
        }
        this.onButtonDownObservable.notifyObservers(buttonIndex);
      }
      if (newValue === 0) {
        if (this._onbuttonup) {
          this._onbuttonup(buttonIndex);
        }
        this.onButtonUpObservable.notifyObservers(buttonIndex);
      }
    }
    return newValue;
  }
  /**
   * Updates the generic gamepad
   */
  update() {
    super.update();
    for (let index = 0; index < this._buttons.length; index++) {
      this._buttons[index] = this._setButtonValue(this.browserGamepad.buttons[index].value, this._buttons[index], index);
    }
  }
  /**
   * Disposes the generic gamepad
   */
  dispose() {
    super.dispose();
    this.onButtonDownObservable.clear();
    this.onButtonUpObservable.clear();
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Gamepads/xboxGamepad.js
var Xbox360Button;
(function(Xbox360Button2) {
  Xbox360Button2[Xbox360Button2["A"] = 0] = "A";
  Xbox360Button2[Xbox360Button2["B"] = 1] = "B";
  Xbox360Button2[Xbox360Button2["X"] = 2] = "X";
  Xbox360Button2[Xbox360Button2["Y"] = 3] = "Y";
  Xbox360Button2[Xbox360Button2["LB"] = 4] = "LB";
  Xbox360Button2[Xbox360Button2["RB"] = 5] = "RB";
  Xbox360Button2[Xbox360Button2["Back"] = 8] = "Back";
  Xbox360Button2[Xbox360Button2["Start"] = 9] = "Start";
  Xbox360Button2[Xbox360Button2["LeftStick"] = 10] = "LeftStick";
  Xbox360Button2[Xbox360Button2["RightStick"] = 11] = "RightStick";
})(Xbox360Button || (Xbox360Button = {}));
var Xbox360Dpad;
(function(Xbox360Dpad2) {
  Xbox360Dpad2[Xbox360Dpad2["Up"] = 12] = "Up";
  Xbox360Dpad2[Xbox360Dpad2["Down"] = 13] = "Down";
  Xbox360Dpad2[Xbox360Dpad2["Left"] = 14] = "Left";
  Xbox360Dpad2[Xbox360Dpad2["Right"] = 15] = "Right";
})(Xbox360Dpad || (Xbox360Dpad = {}));
var Xbox360Pad = class extends Gamepad {
  /**
   * Creates a new XBox360 gamepad object
   * @param id defines the id of this gamepad
   * @param index defines its index
   * @param gamepad defines the internal HTML gamepad object
   * @param xboxOne defines if it is a XBox One gamepad
   */
  constructor(id, index, gamepad, xboxOne = false) {
    super(id, index, gamepad, 0, 1, 2, 3);
    this._leftTrigger = 0;
    this._rightTrigger = 0;
    this.onButtonDownObservable = new Observable();
    this.onButtonUpObservable = new Observable();
    this.onPadDownObservable = new Observable();
    this.onPadUpObservable = new Observable();
    this._buttonA = 0;
    this._buttonB = 0;
    this._buttonX = 0;
    this._buttonY = 0;
    this._buttonBack = 0;
    this._buttonStart = 0;
    this._buttonLb = 0;
    this._buttonRb = 0;
    this._buttonLeftStick = 0;
    this._buttonRightStick = 0;
    this._dPadUp = 0;
    this._dPadDown = 0;
    this._dPadLeft = 0;
    this._dPadRight = 0;
    this._isXboxOnePad = false;
    this.type = Gamepad.XBOX;
    this._isXboxOnePad = xboxOne;
  }
  /**
   * Defines the callback to call when left trigger is pressed
   * @param callback defines the callback to use
   */
  onlefttriggerchanged(callback) {
    this._onlefttriggerchanged = callback;
  }
  /**
   * Defines the callback to call when right trigger is pressed
   * @param callback defines the callback to use
   */
  onrighttriggerchanged(callback) {
    this._onrighttriggerchanged = callback;
  }
  /**
   * Gets the left trigger value
   */
  get leftTrigger() {
    return this._leftTrigger;
  }
  /**
   * Sets the left trigger value
   */
  set leftTrigger(newValue) {
    if (this._onlefttriggerchanged && this._leftTrigger !== newValue) {
      this._onlefttriggerchanged(newValue);
    }
    this._leftTrigger = newValue;
  }
  /**
   * Gets the right trigger value
   */
  get rightTrigger() {
    return this._rightTrigger;
  }
  /**
   * Sets the right trigger value
   */
  set rightTrigger(newValue) {
    if (this._onrighttriggerchanged && this._rightTrigger !== newValue) {
      this._onrighttriggerchanged(newValue);
    }
    this._rightTrigger = newValue;
  }
  /**
   * Defines the callback to call when a button is pressed
   * @param callback defines the callback to use
   */
  onbuttondown(callback) {
    this._onbuttondown = callback;
  }
  /**
   * Defines the callback to call when a button is released
   * @param callback defines the callback to use
   */
  onbuttonup(callback) {
    this._onbuttonup = callback;
  }
  /**
   * Defines the callback to call when a pad is pressed
   * @param callback defines the callback to use
   */
  ondpaddown(callback) {
    this._ondpaddown = callback;
  }
  /**
   * Defines the callback to call when a pad is released
   * @param callback defines the callback to use
   */
  ondpadup(callback) {
    this._ondpadup = callback;
  }
  _setButtonValue(newValue, currentValue, buttonType) {
    if (newValue !== currentValue) {
      if (newValue === 1) {
        if (this._onbuttondown) {
          this._onbuttondown(buttonType);
        }
        this.onButtonDownObservable.notifyObservers(buttonType);
      }
      if (newValue === 0) {
        if (this._onbuttonup) {
          this._onbuttonup(buttonType);
        }
        this.onButtonUpObservable.notifyObservers(buttonType);
      }
    }
    return newValue;
  }
  _setDpadValue(newValue, currentValue, buttonType) {
    if (newValue !== currentValue) {
      if (newValue === 1) {
        if (this._ondpaddown) {
          this._ondpaddown(buttonType);
        }
        this.onPadDownObservable.notifyObservers(buttonType);
      }
      if (newValue === 0) {
        if (this._ondpadup) {
          this._ondpadup(buttonType);
        }
        this.onPadUpObservable.notifyObservers(buttonType);
      }
    }
    return newValue;
  }
  /**
   * Gets the value of the `A` button
   */
  get buttonA() {
    return this._buttonA;
  }
  /**
   * Sets the value of the `A` button
   */
  set buttonA(value) {
    this._buttonA = this._setButtonValue(
      value,
      this._buttonA,
      0
      /* Xbox360Button.A */
    );
  }
  /**
   * Gets the value of the `B` button
   */
  get buttonB() {
    return this._buttonB;
  }
  /**
   * Sets the value of the `B` button
   */
  set buttonB(value) {
    this._buttonB = this._setButtonValue(
      value,
      this._buttonB,
      1
      /* Xbox360Button.B */
    );
  }
  /**
   * Gets the value of the `X` button
   */
  get buttonX() {
    return this._buttonX;
  }
  /**
   * Sets the value of the `X` button
   */
  set buttonX(value) {
    this._buttonX = this._setButtonValue(
      value,
      this._buttonX,
      2
      /* Xbox360Button.X */
    );
  }
  /**
   * Gets the value of the `Y` button
   */
  get buttonY() {
    return this._buttonY;
  }
  /**
   * Sets the value of the `Y` button
   */
  set buttonY(value) {
    this._buttonY = this._setButtonValue(
      value,
      this._buttonY,
      3
      /* Xbox360Button.Y */
    );
  }
  /**
   * Gets the value of the `Start` button
   */
  get buttonStart() {
    return this._buttonStart;
  }
  /**
   * Sets the value of the `Start` button
   */
  set buttonStart(value) {
    this._buttonStart = this._setButtonValue(
      value,
      this._buttonStart,
      9
      /* Xbox360Button.Start */
    );
  }
  /**
   * Gets the value of the `Back` button
   */
  get buttonBack() {
    return this._buttonBack;
  }
  /**
   * Sets the value of the `Back` button
   */
  set buttonBack(value) {
    this._buttonBack = this._setButtonValue(
      value,
      this._buttonBack,
      8
      /* Xbox360Button.Back */
    );
  }
  /**
   * Gets the value of the `Left` button
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  get buttonLB() {
    return this._buttonLb;
  }
  /**
   * Sets the value of the `Left` button
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  set buttonLB(value) {
    this._buttonLb = this._setButtonValue(
      value,
      this._buttonLb,
      4
      /* Xbox360Button.LB */
    );
  }
  /**
   * Gets the value of the `Right` button
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  get buttonRB() {
    return this._buttonRb;
  }
  /**
   * Sets the value of the `Right` button
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  set buttonRB(value) {
    this._buttonRb = this._setButtonValue(
      value,
      this._buttonRb,
      5
      /* Xbox360Button.RB */
    );
  }
  /**
   * Gets the value of the Left joystick
   */
  get buttonLeftStick() {
    return this._buttonLeftStick;
  }
  /**
   * Sets the value of the Left joystick
   */
  set buttonLeftStick(value) {
    this._buttonLeftStick = this._setButtonValue(
      value,
      this._buttonLeftStick,
      10
      /* Xbox360Button.LeftStick */
    );
  }
  /**
   * Gets the value of the Right joystick
   */
  get buttonRightStick() {
    return this._buttonRightStick;
  }
  /**
   * Sets the value of the Right joystick
   */
  set buttonRightStick(value) {
    this._buttonRightStick = this._setButtonValue(
      value,
      this._buttonRightStick,
      11
      /* Xbox360Button.RightStick */
    );
  }
  /**
   * Gets the value of D-pad up
   */
  get dPadUp() {
    return this._dPadUp;
  }
  /**
   * Sets the value of D-pad up
   */
  set dPadUp(value) {
    this._dPadUp = this._setDpadValue(
      value,
      this._dPadUp,
      12
      /* Xbox360Dpad.Up */
    );
  }
  /**
   * Gets the value of D-pad down
   */
  get dPadDown() {
    return this._dPadDown;
  }
  /**
   * Sets the value of D-pad down
   */
  set dPadDown(value) {
    this._dPadDown = this._setDpadValue(
      value,
      this._dPadDown,
      13
      /* Xbox360Dpad.Down */
    );
  }
  /**
   * Gets the value of D-pad left
   */
  get dPadLeft() {
    return this._dPadLeft;
  }
  /**
   * Sets the value of D-pad left
   */
  set dPadLeft(value) {
    this._dPadLeft = this._setDpadValue(
      value,
      this._dPadLeft,
      14
      /* Xbox360Dpad.Left */
    );
  }
  /**
   * Gets the value of D-pad right
   */
  get dPadRight() {
    return this._dPadRight;
  }
  /**
   * Sets the value of D-pad right
   */
  set dPadRight(value) {
    this._dPadRight = this._setDpadValue(
      value,
      this._dPadRight,
      15
      /* Xbox360Dpad.Right */
    );
  }
  /**
   * Force the gamepad to synchronize with device values
   */
  update() {
    super.update();
    if (this._isXboxOnePad) {
      this.buttonA = this.browserGamepad.buttons[0].value;
      this.buttonB = this.browserGamepad.buttons[1].value;
      this.buttonX = this.browserGamepad.buttons[2].value;
      this.buttonY = this.browserGamepad.buttons[3].value;
      this.buttonLB = this.browserGamepad.buttons[4].value;
      this.buttonRB = this.browserGamepad.buttons[5].value;
      this.leftTrigger = this.browserGamepad.buttons[6].value;
      this.rightTrigger = this.browserGamepad.buttons[7].value;
      this.buttonBack = this.browserGamepad.buttons[8].value;
      this.buttonStart = this.browserGamepad.buttons[9].value;
      this.buttonLeftStick = this.browserGamepad.buttons[10].value;
      this.buttonRightStick = this.browserGamepad.buttons[11].value;
      this.dPadUp = this.browserGamepad.buttons[12].value;
      this.dPadDown = this.browserGamepad.buttons[13].value;
      this.dPadLeft = this.browserGamepad.buttons[14].value;
      this.dPadRight = this.browserGamepad.buttons[15].value;
    } else {
      this.buttonA = this.browserGamepad.buttons[0].value;
      this.buttonB = this.browserGamepad.buttons[1].value;
      this.buttonX = this.browserGamepad.buttons[2].value;
      this.buttonY = this.browserGamepad.buttons[3].value;
      this.buttonLB = this.browserGamepad.buttons[4].value;
      this.buttonRB = this.browserGamepad.buttons[5].value;
      this.leftTrigger = this.browserGamepad.buttons[6].value;
      this.rightTrigger = this.browserGamepad.buttons[7].value;
      this.buttonBack = this.browserGamepad.buttons[8].value;
      this.buttonStart = this.browserGamepad.buttons[9].value;
      this.buttonLeftStick = this.browserGamepad.buttons[10].value;
      this.buttonRightStick = this.browserGamepad.buttons[11].value;
      this.dPadUp = this.browserGamepad.buttons[12].value;
      this.dPadDown = this.browserGamepad.buttons[13].value;
      this.dPadLeft = this.browserGamepad.buttons[14].value;
      this.dPadRight = this.browserGamepad.buttons[15].value;
    }
  }
  /**
   * Disposes the gamepad
   */
  dispose() {
    super.dispose();
    this.onButtonDownObservable.clear();
    this.onButtonUpObservable.clear();
    this.onPadDownObservable.clear();
    this.onPadUpObservable.clear();
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Gamepads/dualShockGamepad.js
var DualShockButton;
(function(DualShockButton2) {
  DualShockButton2[DualShockButton2["Cross"] = 0] = "Cross";
  DualShockButton2[DualShockButton2["Circle"] = 1] = "Circle";
  DualShockButton2[DualShockButton2["Square"] = 2] = "Square";
  DualShockButton2[DualShockButton2["Triangle"] = 3] = "Triangle";
  DualShockButton2[DualShockButton2["L1"] = 4] = "L1";
  DualShockButton2[DualShockButton2["R1"] = 5] = "R1";
  DualShockButton2[DualShockButton2["Share"] = 8] = "Share";
  DualShockButton2[DualShockButton2["Options"] = 9] = "Options";
  DualShockButton2[DualShockButton2["LeftStick"] = 10] = "LeftStick";
  DualShockButton2[DualShockButton2["RightStick"] = 11] = "RightStick";
})(DualShockButton || (DualShockButton = {}));
var DualShockDpad;
(function(DualShockDpad2) {
  DualShockDpad2[DualShockDpad2["Up"] = 12] = "Up";
  DualShockDpad2[DualShockDpad2["Down"] = 13] = "Down";
  DualShockDpad2[DualShockDpad2["Left"] = 14] = "Left";
  DualShockDpad2[DualShockDpad2["Right"] = 15] = "Right";
})(DualShockDpad || (DualShockDpad = {}));
var DualShockPad = class extends Gamepad {
  /**
   * Creates a new DualShock gamepad object
   * @param id defines the id of this gamepad
   * @param index defines its index
   * @param gamepad defines the internal HTML gamepad object
   */
  constructor(id, index, gamepad) {
    super(id.replace("STANDARD GAMEPAD", "SONY PLAYSTATION DUALSHOCK"), index, gamepad, 0, 1, 2, 3);
    this._leftTrigger = 0;
    this._rightTrigger = 0;
    this.onButtonDownObservable = new Observable();
    this.onButtonUpObservable = new Observable();
    this.onPadDownObservable = new Observable();
    this.onPadUpObservable = new Observable();
    this._buttonCross = 0;
    this._buttonCircle = 0;
    this._buttonSquare = 0;
    this._buttonTriangle = 0;
    this._buttonShare = 0;
    this._buttonOptions = 0;
    this._buttonL1 = 0;
    this._buttonR1 = 0;
    this._buttonLeftStick = 0;
    this._buttonRightStick = 0;
    this._dPadUp = 0;
    this._dPadDown = 0;
    this._dPadLeft = 0;
    this._dPadRight = 0;
    this.type = Gamepad.DUALSHOCK;
  }
  /**
   * Defines the callback to call when left trigger is pressed
   * @param callback defines the callback to use
   */
  onlefttriggerchanged(callback) {
    this._onlefttriggerchanged = callback;
  }
  /**
   * Defines the callback to call when right trigger is pressed
   * @param callback defines the callback to use
   */
  onrighttriggerchanged(callback) {
    this._onrighttriggerchanged = callback;
  }
  /**
   * Gets the left trigger value
   */
  get leftTrigger() {
    return this._leftTrigger;
  }
  /**
   * Sets the left trigger value
   */
  set leftTrigger(newValue) {
    if (this._onlefttriggerchanged && this._leftTrigger !== newValue) {
      this._onlefttriggerchanged(newValue);
    }
    this._leftTrigger = newValue;
  }
  /**
   * Gets the right trigger value
   */
  get rightTrigger() {
    return this._rightTrigger;
  }
  /**
   * Sets the right trigger value
   */
  set rightTrigger(newValue) {
    if (this._onrighttriggerchanged && this._rightTrigger !== newValue) {
      this._onrighttriggerchanged(newValue);
    }
    this._rightTrigger = newValue;
  }
  /**
   * Defines the callback to call when a button is pressed
   * @param callback defines the callback to use
   */
  onbuttondown(callback) {
    this._onbuttondown = callback;
  }
  /**
   * Defines the callback to call when a button is released
   * @param callback defines the callback to use
   */
  onbuttonup(callback) {
    this._onbuttonup = callback;
  }
  /**
   * Defines the callback to call when a pad is pressed
   * @param callback defines the callback to use
   */
  ondpaddown(callback) {
    this._ondpaddown = callback;
  }
  /**
   * Defines the callback to call when a pad is released
   * @param callback defines the callback to use
   */
  ondpadup(callback) {
    this._ondpadup = callback;
  }
  _setButtonValue(newValue, currentValue, buttonType) {
    if (newValue !== currentValue) {
      if (newValue === 1) {
        if (this._onbuttondown) {
          this._onbuttondown(buttonType);
        }
        this.onButtonDownObservable.notifyObservers(buttonType);
      }
      if (newValue === 0) {
        if (this._onbuttonup) {
          this._onbuttonup(buttonType);
        }
        this.onButtonUpObservable.notifyObservers(buttonType);
      }
    }
    return newValue;
  }
  _setDpadValue(newValue, currentValue, buttonType) {
    if (newValue !== currentValue) {
      if (newValue === 1) {
        if (this._ondpaddown) {
          this._ondpaddown(buttonType);
        }
        this.onPadDownObservable.notifyObservers(buttonType);
      }
      if (newValue === 0) {
        if (this._ondpadup) {
          this._ondpadup(buttonType);
        }
        this.onPadUpObservable.notifyObservers(buttonType);
      }
    }
    return newValue;
  }
  /**
   * Gets the value of the `Cross` button
   */
  get buttonCross() {
    return this._buttonCross;
  }
  /**
   * Sets the value of the `Cross` button
   */
  set buttonCross(value) {
    this._buttonCross = this._setButtonValue(
      value,
      this._buttonCross,
      0
      /* DualShockButton.Cross */
    );
  }
  /**
   * Gets the value of the `Circle` button
   */
  get buttonCircle() {
    return this._buttonCircle;
  }
  /**
   * Sets the value of the `Circle` button
   */
  set buttonCircle(value) {
    this._buttonCircle = this._setButtonValue(
      value,
      this._buttonCircle,
      1
      /* DualShockButton.Circle */
    );
  }
  /**
   * Gets the value of the `Square` button
   */
  get buttonSquare() {
    return this._buttonSquare;
  }
  /**
   * Sets the value of the `Square` button
   */
  set buttonSquare(value) {
    this._buttonSquare = this._setButtonValue(
      value,
      this._buttonSquare,
      2
      /* DualShockButton.Square */
    );
  }
  /**
   * Gets the value of the `Triangle` button
   */
  get buttonTriangle() {
    return this._buttonTriangle;
  }
  /**
   * Sets the value of the `Triangle` button
   */
  set buttonTriangle(value) {
    this._buttonTriangle = this._setButtonValue(
      value,
      this._buttonTriangle,
      3
      /* DualShockButton.Triangle */
    );
  }
  /**
   * Gets the value of the `Options` button
   */
  get buttonOptions() {
    return this._buttonOptions;
  }
  /**
   * Sets the value of the `Options` button
   */
  set buttonOptions(value) {
    this._buttonOptions = this._setButtonValue(
      value,
      this._buttonOptions,
      9
      /* DualShockButton.Options */
    );
  }
  /**
   * Gets the value of the `Share` button
   */
  get buttonShare() {
    return this._buttonShare;
  }
  /**
   * Sets the value of the `Share` button
   */
  set buttonShare(value) {
    this._buttonShare = this._setButtonValue(
      value,
      this._buttonShare,
      8
      /* DualShockButton.Share */
    );
  }
  /**
   * Gets the value of the `L1` button
   */
  get buttonL1() {
    return this._buttonL1;
  }
  /**
   * Sets the value of the `L1` button
   */
  set buttonL1(value) {
    this._buttonL1 = this._setButtonValue(
      value,
      this._buttonL1,
      4
      /* DualShockButton.L1 */
    );
  }
  /**
   * Gets the value of the `R1` button
   */
  get buttonR1() {
    return this._buttonR1;
  }
  /**
   * Sets the value of the `R1` button
   */
  set buttonR1(value) {
    this._buttonR1 = this._setButtonValue(
      value,
      this._buttonR1,
      5
      /* DualShockButton.R1 */
    );
  }
  /**
   * Gets the value of the Left joystick
   */
  get buttonLeftStick() {
    return this._buttonLeftStick;
  }
  /**
   * Sets the value of the Left joystick
   */
  set buttonLeftStick(value) {
    this._buttonLeftStick = this._setButtonValue(
      value,
      this._buttonLeftStick,
      10
      /* DualShockButton.LeftStick */
    );
  }
  /**
   * Gets the value of the Right joystick
   */
  get buttonRightStick() {
    return this._buttonRightStick;
  }
  /**
   * Sets the value of the Right joystick
   */
  set buttonRightStick(value) {
    this._buttonRightStick = this._setButtonValue(
      value,
      this._buttonRightStick,
      11
      /* DualShockButton.RightStick */
    );
  }
  /**
   * Gets the value of D-pad up
   */
  get dPadUp() {
    return this._dPadUp;
  }
  /**
   * Sets the value of D-pad up
   */
  set dPadUp(value) {
    this._dPadUp = this._setDpadValue(
      value,
      this._dPadUp,
      12
      /* DualShockDpad.Up */
    );
  }
  /**
   * Gets the value of D-pad down
   */
  get dPadDown() {
    return this._dPadDown;
  }
  /**
   * Sets the value of D-pad down
   */
  set dPadDown(value) {
    this._dPadDown = this._setDpadValue(
      value,
      this._dPadDown,
      13
      /* DualShockDpad.Down */
    );
  }
  /**
   * Gets the value of D-pad left
   */
  get dPadLeft() {
    return this._dPadLeft;
  }
  /**
   * Sets the value of D-pad left
   */
  set dPadLeft(value) {
    this._dPadLeft = this._setDpadValue(
      value,
      this._dPadLeft,
      14
      /* DualShockDpad.Left */
    );
  }
  /**
   * Gets the value of D-pad right
   */
  get dPadRight() {
    return this._dPadRight;
  }
  /**
   * Sets the value of D-pad right
   */
  set dPadRight(value) {
    this._dPadRight = this._setDpadValue(
      value,
      this._dPadRight,
      15
      /* DualShockDpad.Right */
    );
  }
  /**
   * Force the gamepad to synchronize with device values
   */
  update() {
    super.update();
    this.buttonCross = this.browserGamepad.buttons[0].value;
    this.buttonCircle = this.browserGamepad.buttons[1].value;
    this.buttonSquare = this.browserGamepad.buttons[2].value;
    this.buttonTriangle = this.browserGamepad.buttons[3].value;
    this.buttonL1 = this.browserGamepad.buttons[4].value;
    this.buttonR1 = this.browserGamepad.buttons[5].value;
    this.leftTrigger = this.browserGamepad.buttons[6].value;
    this.rightTrigger = this.browserGamepad.buttons[7].value;
    this.buttonShare = this.browserGamepad.buttons[8].value;
    this.buttonOptions = this.browserGamepad.buttons[9].value;
    this.buttonLeftStick = this.browserGamepad.buttons[10].value;
    this.buttonRightStick = this.browserGamepad.buttons[11].value;
    this.dPadUp = this.browserGamepad.buttons[12].value;
    this.dPadDown = this.browserGamepad.buttons[13].value;
    this.dPadLeft = this.browserGamepad.buttons[14].value;
    this.dPadRight = this.browserGamepad.buttons[15].value;
  }
  /**
   * Disposes the gamepad
   */
  dispose() {
    super.dispose();
    this.onButtonDownObservable.clear();
    this.onButtonUpObservable.clear();
    this.onPadDownObservable.clear();
    this.onPadUpObservable.clear();
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Gamepads/gamepadManager.js
var GamepadManager = class {
  /**
   * Initializes the gamepad manager
   * @param _scene BabylonJS scene
   */
  constructor(_scene) {
    this._scene = _scene;
    this._babylonGamepads = [];
    this._oneGamepadConnected = false;
    this._isMonitoring = false;
    this.onGamepadDisconnectedObservable = new Observable();
    if (!IsWindowObjectExist()) {
      this._gamepadEventSupported = false;
    } else {
      this._gamepadEventSupported = "GamepadEvent" in window;
      this._gamepadSupport = navigator && navigator.getGamepads;
    }
    this.onGamepadConnectedObservable = new Observable((observer) => {
      for (const i in this._babylonGamepads) {
        const gamepad = this._babylonGamepads[i];
        if (gamepad && gamepad._isConnected) {
          this.onGamepadConnectedObservable.notifyObserver(observer, gamepad);
        }
      }
    });
    this._onGamepadConnectedEvent = (evt) => {
      const gamepad = evt.gamepad;
      if (gamepad.index in this._babylonGamepads) {
        if (this._babylonGamepads[gamepad.index].isConnected) {
          return;
        }
      }
      let newGamepad;
      if (this._babylonGamepads[gamepad.index]) {
        newGamepad = this._babylonGamepads[gamepad.index];
        newGamepad.browserGamepad = gamepad;
        newGamepad._isConnected = true;
      } else {
        newGamepad = this._addNewGamepad(gamepad);
      }
      this.onGamepadConnectedObservable.notifyObservers(newGamepad);
      this._startMonitoringGamepads();
    };
    this._onGamepadDisconnectedEvent = (evt) => {
      const gamepad = evt.gamepad;
      for (const i in this._babylonGamepads) {
        if (this._babylonGamepads[i].index === gamepad.index) {
          const disconnectedGamepad = this._babylonGamepads[i];
          disconnectedGamepad._isConnected = false;
          this.onGamepadDisconnectedObservable.notifyObservers(disconnectedGamepad);
          if (disconnectedGamepad.dispose) {
            disconnectedGamepad.dispose();
          }
          break;
        }
      }
    };
    if (this._gamepadSupport) {
      this._updateGamepadObjects();
      if (this._babylonGamepads.length) {
        this._startMonitoringGamepads();
      }
      if (this._gamepadEventSupported) {
        const hostWindow = this._scene ? this._scene.getEngine().getHostWindow() : window;
        if (hostWindow) {
          hostWindow.addEventListener("gamepadconnected", this._onGamepadConnectedEvent, false);
          hostWindow.addEventListener("gamepaddisconnected", this._onGamepadDisconnectedEvent, false);
        }
      } else {
        this._startMonitoringGamepads();
      }
    }
  }
  /**
   * The gamepads in the game pad manager
   */
  get gamepads() {
    return this._babylonGamepads;
  }
  /**
   * Get the gamepad controllers based on type
   * @param type The type of gamepad controller
   * @returns Nullable gamepad
   */
  getGamepadByType(type = Gamepad.XBOX) {
    for (const gamepad of this._babylonGamepads) {
      if (gamepad && gamepad.type === type) {
        return gamepad;
      }
    }
    return null;
  }
  /**
   * Disposes the gamepad manager
   */
  dispose() {
    if (this._gamepadEventSupported) {
      if (this._onGamepadConnectedEvent) {
        window.removeEventListener("gamepadconnected", this._onGamepadConnectedEvent);
      }
      if (this._onGamepadDisconnectedEvent) {
        window.removeEventListener("gamepaddisconnected", this._onGamepadDisconnectedEvent);
      }
      this._onGamepadConnectedEvent = null;
      this._onGamepadDisconnectedEvent = null;
    }
    for (const gamepad of this._babylonGamepads) {
      gamepad.dispose();
    }
    this.onGamepadConnectedObservable.clear();
    this.onGamepadDisconnectedObservable.clear();
    this._oneGamepadConnected = false;
    this._stopMonitoringGamepads();
    this._babylonGamepads = [];
  }
  _addNewGamepad(gamepad) {
    if (!this._oneGamepadConnected) {
      this._oneGamepadConnected = true;
    }
    let newGamepad;
    const dualShock = gamepad.id.search("054c") !== -1 && gamepad.id.search("0ce6") === -1;
    const xboxOne = gamepad.id.search("Xbox One") !== -1;
    if (xboxOne || gamepad.id.search("Xbox 360") !== -1 || gamepad.id.search("xinput") !== -1 || gamepad.id.search("045e") !== -1 && gamepad.id.search("Surface Dock") === -1) {
      newGamepad = new Xbox360Pad(gamepad.id, gamepad.index, gamepad, xboxOne);
    } else if (dualShock) {
      newGamepad = new DualShockPad(gamepad.id, gamepad.index, gamepad);
    } else {
      newGamepad = new GenericPad(gamepad.id, gamepad.index, gamepad);
    }
    this._babylonGamepads[newGamepad.index] = newGamepad;
    return newGamepad;
  }
  _startMonitoringGamepads() {
    if (!this._isMonitoring) {
      this._isMonitoring = true;
      this._checkGamepadsStatus();
    }
  }
  _stopMonitoringGamepads() {
    this._isMonitoring = false;
  }
  /** @internal */
  _checkGamepadsStatus() {
    this._updateGamepadObjects();
    for (const i in this._babylonGamepads) {
      const gamepad = this._babylonGamepads[i];
      if (!gamepad || !gamepad.isConnected) {
        continue;
      }
      try {
        gamepad.update();
      } catch {
        if (this._loggedErrors.indexOf(gamepad.index) === -1) {
          Tools.Warn(`Error updating gamepad ${gamepad.id}`);
          this._loggedErrors.push(gamepad.index);
        }
      }
    }
    if (this._isMonitoring) {
      AbstractEngine.QueueNewFrame(() => {
        this._checkGamepadsStatus();
      });
    }
  }
  // This function is called only on Chrome, which does not properly support
  // connection/disconnection events and forces you to recopy again the gamepad object
  _updateGamepadObjects() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (gamepad) {
        if (!this._babylonGamepads[gamepad.index]) {
          const newGamepad = this._addNewGamepad(gamepad);
          this.onGamepadConnectedObservable.notifyObservers(newGamepad);
        } else {
          this._babylonGamepads[i].browserGamepad = gamepad;
          if (!this._babylonGamepads[i].isConnected) {
            this._babylonGamepads[i]._isConnected = true;
            this.onGamepadConnectedObservable.notifyObservers(this._babylonGamepads[i]);
          }
        }
      }
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/freeCameraGamepadInput.js
var FreeCameraGamepadInput = class {
  constructor() {
    this.gamepadAngularSensibility = 200;
    this.gamepadMoveSensibility = 40;
    this.deadzoneDelta = 0.1;
    this._yAxisScale = 1;
    this._cameraTransform = Matrix.Identity();
    this._deltaTransform = Vector3.Zero();
    this._vector3 = Vector3.Zero();
    this._vector2 = Vector2.Zero();
  }
  /**
   * Gets or sets a boolean indicating that Yaxis (for right stick) should be inverted
   */
  get invertYAxis() {
    return this._yAxisScale !== 1;
  }
  set invertYAxis(value) {
    this._yAxisScale = value ? -1 : 1;
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   */
  attachControl() {
    const manager = this.camera.getScene().gamepadManager;
    this._onGamepadConnectedObserver = manager.onGamepadConnectedObservable.add((gamepad) => {
      if (gamepad.type !== Gamepad.POSE_ENABLED) {
        if (!this.gamepad || gamepad.type === Gamepad.XBOX) {
          this.gamepad = gamepad;
        }
      }
    });
    this._onGamepadDisconnectedObserver = manager.onGamepadDisconnectedObservable.add((gamepad) => {
      if (this.gamepad === gamepad) {
        this.gamepad = null;
      }
    });
    this.gamepad = manager.getGamepadByType(Gamepad.XBOX);
    if (!this.gamepad && manager.gamepads.length) {
      this.gamepad = manager.gamepads[0];
    }
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    this.camera.getScene().gamepadManager.onGamepadConnectedObservable.remove(this._onGamepadConnectedObserver);
    this.camera.getScene().gamepadManager.onGamepadDisconnectedObservable.remove(this._onGamepadDisconnectedObserver);
    this.gamepad = null;
  }
  /**
   * Update the current camera state depending on the inputs that have been used this frame.
   * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
   */
  checkInputs() {
    if (this.gamepad && this.gamepad.leftStick) {
      const camera = this.camera;
      const lsValues = this.gamepad.leftStick;
      if (this.gamepadMoveSensibility !== 0) {
        lsValues.x = Math.abs(lsValues.x) > this.deadzoneDelta ? lsValues.x / this.gamepadMoveSensibility : 0;
        lsValues.y = Math.abs(lsValues.y) > this.deadzoneDelta ? lsValues.y / this.gamepadMoveSensibility : 0;
      }
      let rsValues = this.gamepad.rightStick;
      if (rsValues && this.gamepadAngularSensibility !== 0) {
        rsValues.x = Math.abs(rsValues.x) > this.deadzoneDelta ? rsValues.x / this.gamepadAngularSensibility : 0;
        rsValues.y = (Math.abs(rsValues.y) > this.deadzoneDelta ? rsValues.y / this.gamepadAngularSensibility : 0) * this._yAxisScale;
      } else {
        rsValues = { x: 0, y: 0 };
      }
      if (!camera.rotationQuaternion) {
        Matrix.RotationYawPitchRollToRef(camera.rotation.y, camera.rotation.x, 0, this._cameraTransform);
      } else {
        camera.rotationQuaternion.toRotationMatrix(this._cameraTransform);
      }
      const speed = camera._computeLocalCameraSpeed() * 50;
      this._vector3.copyFromFloats(lsValues.x * speed, 0, -lsValues.y * speed);
      Vector3.TransformCoordinatesToRef(this._vector3, this._cameraTransform, this._deltaTransform);
      camera.cameraDirection.addInPlace(this._deltaTransform);
      this._vector2.copyFromFloats(rsValues.y, rsValues.x);
      camera.cameraRotation.addInPlace(this._vector2);
    }
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "FreeCameraGamepadInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "gamepad";
  }
};
__decorate([
  serialize()
], FreeCameraGamepadInput.prototype, "gamepadAngularSensibility", void 0);
__decorate([
  serialize()
], FreeCameraGamepadInput.prototype, "gamepadMoveSensibility", void 0);
CameraInputTypes["FreeCameraGamepadInput"] = FreeCameraGamepadInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/BaseCameraPointersInput.js
var BaseCameraPointersInput = class {
  constructor() {
    this._currentMousePointerIdDown = -1;
    this.buttons = [0, 1, 2];
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachControl(noPreventDefault) {
    noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
    const engine = this.camera.getEngine();
    const element = engine.getInputElement();
    let previousPinchSquaredDistance = 0;
    let previousMultiTouchPanPosition = null;
    this._pointA = null;
    this._pointB = null;
    this._altKey = false;
    this._ctrlKey = false;
    this._metaKey = false;
    this._shiftKey = false;
    this._buttonsPressed = 0;
    this._pointerInput = (p) => {
      const evt = p.event;
      const isTouch = evt.pointerType === "touch";
      if (p.type !== PointerEventTypes.POINTERMOVE && this.buttons.indexOf(evt.button) === -1) {
        return;
      }
      const srcElement = evt.target;
      this._altKey = evt.altKey;
      this._ctrlKey = evt.ctrlKey;
      this._metaKey = evt.metaKey;
      this._shiftKey = evt.shiftKey;
      this._buttonsPressed = evt.buttons;
      if (engine.isPointerLock) {
        const offsetX = evt.movementX;
        const offsetY = evt.movementY;
        this.onTouch(null, offsetX, offsetY);
        this._pointA = null;
        this._pointB = null;
      } else if (p.type !== PointerEventTypes.POINTERDOWN && p.type !== PointerEventTypes.POINTERDOUBLETAP && isTouch && this._pointA?.pointerId !== evt.pointerId && this._pointB?.pointerId !== evt.pointerId) {
        return;
      } else if (p.type === PointerEventTypes.POINTERDOWN && (this._currentMousePointerIdDown === -1 || isTouch)) {
        try {
          srcElement?.setPointerCapture(evt.pointerId);
        } catch (e) {
        }
        if (this._pointA === null) {
          this._pointA = {
            x: evt.clientX,
            y: evt.clientY,
            pointerId: evt.pointerId,
            type: evt.pointerType,
            button: evt.button
          };
        } else if (this._pointB === null) {
          this._pointB = {
            x: evt.clientX,
            y: evt.clientY,
            pointerId: evt.pointerId,
            type: evt.pointerType,
            button: evt.button
          };
        } else {
          return;
        }
        if (this._currentMousePointerIdDown === -1 && !isTouch) {
          this._currentMousePointerIdDown = evt.pointerId;
        }
        this.onButtonDown(evt);
        if (!noPreventDefault) {
          evt.preventDefault();
          if (element) {
            element.focus();
          }
        }
      } else if (p.type === PointerEventTypes.POINTERDOUBLETAP) {
        this.onDoubleTap(evt.pointerType);
      } else if (p.type === PointerEventTypes.POINTERUP && (this._currentMousePointerIdDown === evt.pointerId || isTouch)) {
        try {
          srcElement?.releasePointerCapture(evt.pointerId);
        } catch (e) {
        }
        if (!isTouch) {
          this._pointB = null;
        }
        if (engine._badOS) {
          this._pointA = this._pointB = null;
        } else {
          if (this._pointB && this._pointA && this._pointA.pointerId == evt.pointerId) {
            this._pointA = this._pointB;
            this._pointB = null;
          } else if (this._pointA && this._pointB && this._pointB.pointerId == evt.pointerId) {
            this._pointB = null;
          } else {
            this._pointA = this._pointB = null;
          }
        }
        if (previousPinchSquaredDistance !== 0 || previousMultiTouchPanPosition) {
          this.onMultiTouch(
            this._pointA,
            this._pointB,
            previousPinchSquaredDistance,
            0,
            // pinchSquaredDistance
            previousMultiTouchPanPosition,
            null
            // multiTouchPanPosition
          );
          previousPinchSquaredDistance = 0;
          previousMultiTouchPanPosition = null;
        }
        this._currentMousePointerIdDown = -1;
        this.onButtonUp(evt);
        if (!noPreventDefault) {
          evt.preventDefault();
        }
      } else if (p.type === PointerEventTypes.POINTERMOVE) {
        if (!noPreventDefault) {
          evt.preventDefault();
        }
        if (this._pointA && this._pointB === null) {
          const offsetX = evt.clientX - this._pointA.x;
          const offsetY = evt.clientY - this._pointA.y;
          this._pointA.x = evt.clientX;
          this._pointA.y = evt.clientY;
          this.onTouch(this._pointA, offsetX, offsetY);
        } else if (this._pointA && this._pointB) {
          const ed = this._pointA.pointerId === evt.pointerId ? this._pointA : this._pointB;
          ed.x = evt.clientX;
          ed.y = evt.clientY;
          const distX = this._pointA.x - this._pointB.x;
          const distY = this._pointA.y - this._pointB.y;
          const pinchSquaredDistance = distX * distX + distY * distY;
          const multiTouchPanPosition = {
            x: (this._pointA.x + this._pointB.x) / 2,
            y: (this._pointA.y + this._pointB.y) / 2,
            pointerId: evt.pointerId,
            type: p.type
          };
          this.onMultiTouch(this._pointA, this._pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition);
          previousMultiTouchPanPosition = multiTouchPanPosition;
          previousPinchSquaredDistance = pinchSquaredDistance;
        }
      }
    };
    this._observer = this.camera.getScene()._inputManager._addCameraPointerObserver(this._pointerInput, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP | PointerEventTypes.POINTERMOVE | PointerEventTypes.POINTERDOUBLETAP);
    this._onLostFocus = () => {
      this._pointA = this._pointB = null;
      previousPinchSquaredDistance = 0;
      previousMultiTouchPanPosition = null;
      this.onLostFocus();
    };
    this._contextMenuBind = (evt) => this.onContextMenu(evt);
    if (element) {
      element.addEventListener("contextmenu", this._contextMenuBind, false);
    }
    const hostWindow = this.camera.getScene().getEngine().getHostWindow();
    if (hostWindow) {
      Tools.RegisterTopRootEvents(hostWindow, [{ name: "blur", handler: this._onLostFocus }]);
    }
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    if (this._onLostFocus) {
      const hostWindow = this.camera.getScene().getEngine().getHostWindow();
      if (hostWindow) {
        Tools.UnregisterTopRootEvents(hostWindow, [{ name: "blur", handler: this._onLostFocus }]);
      }
    }
    if (this._observer) {
      this.camera.getScene()._inputManager._removeCameraPointerObserver(this._observer);
      this._observer = null;
      if (this._contextMenuBind) {
        const inputElement = this.camera.getScene().getEngine().getInputElement();
        if (inputElement) {
          inputElement.removeEventListener("contextmenu", this._contextMenuBind);
        }
      }
      this._onLostFocus = null;
    }
    this._altKey = false;
    this._ctrlKey = false;
    this._metaKey = false;
    this._shiftKey = false;
    this._buttonsPressed = 0;
    this._currentMousePointerIdDown = -1;
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "BaseCameraPointersInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "pointers";
  }
  /**
   * Called on pointer POINTERDOUBLETAP event.
   * Override this method to provide functionality on POINTERDOUBLETAP event.
   * @param type type of event
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onDoubleTap(type) {
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  /**
   * Called on pointer POINTERMOVE event if only a single touch is active.
   * Override this method to provide functionality.
   * @param point The current position of the pointer
   * @param offsetX The offsetX of the pointer when the event occurred
   * @param offsetY The offsetY of the pointer when the event occurred
   */
  onTouch(point, offsetX, offsetY) {
  }
  /**
   * Called on pointer POINTERMOVE event if multiple touches are active.
   * Override this method to provide functionality.
   * @param _pointA First point in the pair
   * @param _pointB Second point in the pair
   * @param previousPinchSquaredDistance Sqr Distance between the points the last time this event was fired (by this input)
   * @param pinchSquaredDistance Sqr Distance between the points this time
   * @param previousMultiTouchPanPosition Previous center point between the points
   * @param multiTouchPanPosition Current center point between the points
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMultiTouch(_pointA, _pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition) {
  }
  /**
   * Called on JS contextmenu event.
   * Override this method to provide functionality.
   * @param evt the event to be handled
   */
  onContextMenu(evt) {
    evt.preventDefault();
  }
  /**
   * Called each time a new POINTERDOWN event occurs. Ie, for each button
   * press.
   * Override this method to provide functionality.
   * @param _evt Defines the event to track
   */
  onButtonDown(_evt) {
  }
  /**
   * Called each time a new POINTERUP event occurs. Ie, for each button
   * release.
   * Override this method to provide functionality.
   * @param _evt Defines the event to track
   */
  onButtonUp(_evt) {
  }
  /**
   * Called when window becomes inactive.
   * Override this method to provide functionality.
   */
  onLostFocus() {
  }
};
__decorate([
  serialize()
], BaseCameraPointersInput.prototype, "buttons", void 0);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/orbitCameraPointersInput.js
var OrbitCameraPointersInput = class extends BaseCameraPointersInput {
  constructor() {
    super(...arguments);
    this.pinchZoom = true;
    this.multiTouchPanning = true;
    this.multiTouchPanAndZoom = true;
    this._isPinching = false;
    this._twoFingerActivityCount = 0;
    this._shouldStartPinchZoom = false;
  }
  _computePinchZoom(_previousPinchSquaredDistance, _pinchSquaredDistance) {
  }
  _computeMultiTouchPanning(_previousMultiTouchPanPosition, _multiTouchPanPosition) {
  }
  /**
   * Called on pointer POINTERMOVE event if multiple touches are active.
   * Override this method to provide functionality.
   * @param _pointA First point in the pair
   * @param _pointB Second point in the pair
   * @param previousPinchSquaredDistance Sqr Distance between the points the last time this event was fired (by this input)
   * @param pinchSquaredDistance Sqr Distance between the points this time
   * @param previousMultiTouchPanPosition Previous center point between the points
   * @param multiTouchPanPosition Current center point between the points
   */
  onMultiTouch(_pointA, _pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition) {
    if (previousPinchSquaredDistance === 0 && previousMultiTouchPanPosition === null) {
      return;
    }
    if (pinchSquaredDistance === 0 && multiTouchPanPosition === null) {
      return;
    }
    if (this.multiTouchPanAndZoom) {
      this._computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance);
      this._computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition);
    } else if (this.multiTouchPanning && this.pinchZoom) {
      this._twoFingerActivityCount++;
      if (this._isPinching || this._shouldStartPinchZoom) {
        this._computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance);
        this._isPinching = true;
      } else {
        this._computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition);
      }
    } else if (this.multiTouchPanning) {
      this._computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition);
    } else if (this.pinchZoom) {
      this._computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance);
    }
  }
  /**
   * Called each time a new POINTERUP event occurs. Ie, for each button
   * release.
   * @param _evt Defines the event to track
   */
  onButtonUp(_evt) {
    this._twoFingerActivityCount = 0;
    this._isPinching = false;
  }
  /**
   * Called when window becomes inactive.
   */
  onLostFocus() {
    this._twoFingerActivityCount = 0;
    this._isPinching = false;
  }
};
__decorate([
  serialize()
], OrbitCameraPointersInput.prototype, "pinchZoom", void 0);
__decorate([
  serialize()
], OrbitCameraPointersInput.prototype, "multiTouchPanning", void 0);
__decorate([
  serialize()
], OrbitCameraPointersInput.prototype, "multiTouchPanAndZoom", void 0);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput.js
var ArcRotateCameraPointersInput = class _ArcRotateCameraPointersInput extends OrbitCameraPointersInput {
  constructor() {
    super(...arguments);
    this.buttons = [0, 1, 2];
    this.angularSensibilityX = 1e3;
    this.angularSensibilityY = 1e3;
    this.pinchPrecision = 12;
    this.pinchDeltaPercentage = 0;
    this.useNaturalPinchZoom = false;
    this.panningSensibility = 1e3;
    this.pinchInwards = true;
    this._isPanClick = false;
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "ArcRotateCameraPointersInput";
  }
  /**
   * Move camera from multi touch panning positions.
   * @param previousMultiTouchPanPosition
   * @param multiTouchPanPosition
   */
  _computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition) {
    if (this.panningSensibility !== 0 && previousMultiTouchPanPosition && multiTouchPanPosition) {
      const moveDeltaX = multiTouchPanPosition.x - previousMultiTouchPanPosition.x;
      const moveDeltaY = multiTouchPanPosition.y - previousMultiTouchPanPosition.y;
      this.camera.inertialPanningX += -moveDeltaX / this.panningSensibility;
      this.camera.inertialPanningY += moveDeltaY / this.panningSensibility;
    }
  }
  /**
   * Move camera from multitouch (pinch) zoom distances.
   * @param previousPinchSquaredDistance
   * @param pinchSquaredDistance
   */
  _computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance) {
    const radius = this.camera.radius || _ArcRotateCameraPointersInput.MinimumRadiusForPinch;
    if (this.useNaturalPinchZoom) {
      this.camera.radius = radius * Math.sqrt(previousPinchSquaredDistance) / Math.sqrt(pinchSquaredDistance);
    } else if (this.pinchDeltaPercentage) {
      this.camera.inertialRadiusOffset += (pinchSquaredDistance - previousPinchSquaredDistance) * 1e-3 * radius * this.pinchDeltaPercentage;
    } else {
      this.camera.inertialRadiusOffset += (pinchSquaredDistance - previousPinchSquaredDistance) / (this.pinchPrecision * (this.pinchInwards ? 1 : -1) * (this.angularSensibilityX + this.angularSensibilityY) / 2);
    }
  }
  /**
   * Called on pointer POINTERMOVE event if only a single touch is active.
   * @param point current touch point
   * @param offsetX offset on X
   * @param offsetY offset on Y
   */
  onTouch(point, offsetX, offsetY) {
    if (this.panningSensibility !== 0 && (this._ctrlKey && this.camera._useCtrlForPanning || this._isPanClick)) {
      this.camera.inertialPanningX += -offsetX / this.panningSensibility;
      this.camera.inertialPanningY += offsetY / this.panningSensibility;
    } else {
      this.camera.inertialAlphaOffset -= offsetX / this.angularSensibilityX;
      this.camera.inertialBetaOffset -= offsetY / this.angularSensibilityY;
    }
  }
  /**
   * Called on pointer POINTERDOUBLETAP event.
   */
  onDoubleTap() {
    if (this.camera.useInputToRestoreState) {
      this.camera.restoreState();
    }
  }
  /**
   * Called on pointer POINTERMOVE event if multiple touches are active.
   * @param pointA point A
   * @param pointB point B
   * @param previousPinchSquaredDistance distance between points in previous pinch
   * @param pinchSquaredDistance distance between points in current pinch
   * @param previousMultiTouchPanPosition multi-touch position in previous step
   * @param multiTouchPanPosition multi-touch position in current step
   */
  onMultiTouch(pointA, pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition) {
    this._shouldStartPinchZoom = this._twoFingerActivityCount < 20 && Math.abs(Math.sqrt(pinchSquaredDistance) - Math.sqrt(previousPinchSquaredDistance)) > this.camera.pinchToPanMaxDistance;
    super.onMultiTouch(pointA, pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition);
  }
  /**
   * Called each time a new POINTERDOWN event occurs. Ie, for each button
   * press.
   * @param evt Defines the event to track
   */
  onButtonDown(evt) {
    this._isPanClick = evt.button === this.camera._panningMouseButton;
    super.onButtonDown(evt);
  }
  /**
   * Called each time a new POINTERUP event occurs. Ie, for each button
   * release.
   * @param _evt Defines the event to track
   */
  onButtonUp(_evt) {
    super.onButtonUp(_evt);
  }
  /**
   * Called when window becomes inactive.
   */
  onLostFocus() {
    this._isPanClick = false;
    super.onLostFocus();
  }
};
ArcRotateCameraPointersInput.MinimumRadiusForPinch = 1e-3;
__decorate([
  serialize()
], ArcRotateCameraPointersInput.prototype, "buttons", void 0);
__decorate([
  serialize()
], ArcRotateCameraPointersInput.prototype, "angularSensibilityX", void 0);
__decorate([
  serialize()
], ArcRotateCameraPointersInput.prototype, "angularSensibilityY", void 0);
__decorate([
  serialize()
], ArcRotateCameraPointersInput.prototype, "pinchPrecision", void 0);
__decorate([
  serialize()
], ArcRotateCameraPointersInput.prototype, "pinchDeltaPercentage", void 0);
__decorate([
  serialize()
], ArcRotateCameraPointersInput.prototype, "useNaturalPinchZoom", void 0);
__decorate([
  serialize()
], ArcRotateCameraPointersInput.prototype, "panningSensibility", void 0);
CameraInputTypes["ArcRotateCameraPointersInput"] = ArcRotateCameraPointersInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/arcRotateCameraKeyboardMoveInput.js
var ArcRotateCameraKeyboardMoveInput = class {
  constructor() {
    this.keysUp = [38];
    this.keysDown = [40];
    this.keysLeft = [37];
    this.keysRight = [39];
    this.keysReset = [220];
    this.panningSensibility = 50;
    this.zoomingSensibility = 25;
    this.useAltToZoom = true;
    this.angularSpeed = 0.01;
    this._keys = new Array();
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachControl(noPreventDefault) {
    noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
    if (this._onCanvasBlurObserver) {
      return;
    }
    this._scene = this.camera.getScene();
    this._engine = this._scene.getEngine();
    this._onCanvasBlurObserver = this._engine.onCanvasBlurObservable.add(() => {
      this._keys.length = 0;
    });
    this._onKeyboardObserver = this._scene.onKeyboardObservable.add((info) => {
      const evt = info.event;
      if (!evt.metaKey) {
        if (info.type === KeyboardEventTypes.KEYDOWN) {
          this._ctrlPressed = evt.ctrlKey;
          this._altPressed = evt.altKey;
          if (this.keysUp.indexOf(evt.keyCode) !== -1 || this.keysDown.indexOf(evt.keyCode) !== -1 || this.keysLeft.indexOf(evt.keyCode) !== -1 || this.keysRight.indexOf(evt.keyCode) !== -1 || this.keysReset.indexOf(evt.keyCode) !== -1) {
            const index = this._keys.indexOf(evt.keyCode);
            if (index === -1) {
              this._keys.push(evt.keyCode);
            }
            if (evt.preventDefault) {
              if (!noPreventDefault) {
                evt.preventDefault();
              }
            }
          }
        } else {
          if (this.keysUp.indexOf(evt.keyCode) !== -1 || this.keysDown.indexOf(evt.keyCode) !== -1 || this.keysLeft.indexOf(evt.keyCode) !== -1 || this.keysRight.indexOf(evt.keyCode) !== -1 || this.keysReset.indexOf(evt.keyCode) !== -1) {
            const index = this._keys.indexOf(evt.keyCode);
            if (index >= 0) {
              this._keys.splice(index, 1);
            }
            if (evt.preventDefault) {
              if (!noPreventDefault) {
                evt.preventDefault();
              }
            }
          }
        }
      }
    });
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    if (this._scene) {
      if (this._onKeyboardObserver) {
        this._scene.onKeyboardObservable.remove(this._onKeyboardObserver);
      }
      if (this._onCanvasBlurObserver) {
        this._engine.onCanvasBlurObservable.remove(this._onCanvasBlurObserver);
      }
      this._onKeyboardObserver = null;
      this._onCanvasBlurObserver = null;
    }
    this._keys.length = 0;
  }
  /**
   * Update the current camera state depending on the inputs that have been used this frame.
   * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
   */
  checkInputs() {
    if (this._onKeyboardObserver) {
      const camera = this.camera;
      for (let index = 0; index < this._keys.length; index++) {
        const keyCode = this._keys[index];
        if (this.keysLeft.indexOf(keyCode) !== -1) {
          if (this._ctrlPressed && this.camera._useCtrlForPanning) {
            camera.inertialPanningX -= 1 / this.panningSensibility;
          } else {
            camera.inertialAlphaOffset -= this.angularSpeed;
          }
        } else if (this.keysUp.indexOf(keyCode) !== -1) {
          if (this._ctrlPressed && this.camera._useCtrlForPanning) {
            camera.inertialPanningY += 1 / this.panningSensibility;
          } else if (this._altPressed && this.useAltToZoom) {
            camera.inertialRadiusOffset += 1 / this.zoomingSensibility;
          } else {
            camera.inertialBetaOffset -= this.angularSpeed;
          }
        } else if (this.keysRight.indexOf(keyCode) !== -1) {
          if (this._ctrlPressed && this.camera._useCtrlForPanning) {
            camera.inertialPanningX += 1 / this.panningSensibility;
          } else {
            camera.inertialAlphaOffset += this.angularSpeed;
          }
        } else if (this.keysDown.indexOf(keyCode) !== -1) {
          if (this._ctrlPressed && this.camera._useCtrlForPanning) {
            camera.inertialPanningY -= 1 / this.panningSensibility;
          } else if (this._altPressed && this.useAltToZoom) {
            camera.inertialRadiusOffset -= 1 / this.zoomingSensibility;
          } else {
            camera.inertialBetaOffset += this.angularSpeed;
          }
        } else if (this.keysReset.indexOf(keyCode) !== -1) {
          if (camera.useInputToRestoreState) {
            camera.restoreState();
          }
        }
      }
    }
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "ArcRotateCameraKeyboardMoveInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "keyboard";
  }
};
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "keysUp", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "keysDown", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "keysLeft", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "keysRight", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "keysReset", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "panningSensibility", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "zoomingSensibility", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "useAltToZoom", void 0);
__decorate([
  serialize()
], ArcRotateCameraKeyboardMoveInput.prototype, "angularSpeed", void 0);
CameraInputTypes["ArcRotateCameraKeyboardMoveInput"] = ArcRotateCameraKeyboardMoveInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/arcRotateCameraMouseWheelInput.js
var FfMultiplier = 40;
var ArcRotateCameraMouseWheelInput = class {
  constructor() {
    this.wheelPrecision = 3;
    this.zoomToMouseLocation = false;
    this.wheelDeltaPercentage = 0;
    this.customComputeDeltaFromMouseWheel = null;
    this._viewOffset = new Vector3(0, 0, 0);
    this._globalOffset = new Vector3(0, 0, 0);
    this._inertialPanning = Vector3.Zero();
  }
  _computeDeltaFromMouseWheelLegacyEvent(mouseWheelDelta, radius) {
    let delta = 0;
    const wheelDelta = mouseWheelDelta * 0.01 * this.wheelDeltaPercentage * radius;
    if (mouseWheelDelta > 0) {
      delta = wheelDelta / (1 + this.wheelDeltaPercentage);
    } else {
      delta = wheelDelta * (1 + this.wheelDeltaPercentage);
    }
    return delta;
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachControl(noPreventDefault) {
    noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
    this._wheel = (p) => {
      if (p.type !== PointerEventTypes.POINTERWHEEL) {
        return;
      }
      const event = p.event;
      let delta = 0;
      const platformScale = event.deltaMode === EventConstants.DOM_DELTA_LINE ? FfMultiplier : 1;
      const wheelDelta = -(event.deltaY * platformScale);
      if (this.customComputeDeltaFromMouseWheel) {
        delta = this.customComputeDeltaFromMouseWheel(wheelDelta, this, event);
      } else {
        if (this.wheelDeltaPercentage) {
          delta = this._computeDeltaFromMouseWheelLegacyEvent(wheelDelta, this.camera.radius);
          if (delta > 0) {
            let estimatedTargetRadius = this.camera.radius;
            let targetInertia = this.camera.inertialRadiusOffset + delta;
            for (let i = 0; i < 20; i++) {
              if (estimatedTargetRadius <= targetInertia) {
                break;
              }
              if (Math.abs(targetInertia * this.camera.inertia) < 1e-3) {
                break;
              }
              estimatedTargetRadius -= targetInertia;
              targetInertia *= this.camera.inertia;
            }
            estimatedTargetRadius = Clamp(estimatedTargetRadius, 0, Number.MAX_VALUE);
            delta = this._computeDeltaFromMouseWheelLegacyEvent(wheelDelta, estimatedTargetRadius);
          }
        } else {
          delta = wheelDelta / (this.wheelPrecision * 40);
        }
      }
      if (delta) {
        if (this.zoomToMouseLocation) {
          if (!this._hitPlane) {
            this._updateHitPlane();
          }
          this._zoomToMouse(delta);
        } else {
          this.camera.inertialRadiusOffset += delta;
        }
      }
      if (event.preventDefault) {
        if (!noPreventDefault) {
          event.preventDefault();
        }
      }
    };
    this._observer = this.camera.getScene()._inputManager._addCameraPointerObserver(this._wheel, PointerEventTypes.POINTERWHEEL);
    if (this.zoomToMouseLocation) {
      this._inertialPanning.setAll(0);
    }
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    if (this._observer) {
      this.camera.getScene()._inputManager._removeCameraPointerObserver(this._observer);
      this._observer = null;
      this._wheel = null;
    }
  }
  /**
   * Update the current camera state depending on the inputs that have been used this frame.
   * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
   */
  checkInputs() {
    if (!this.zoomToMouseLocation) {
      return;
    }
    const camera = this.camera;
    const motion = 0 + camera.inertialAlphaOffset + camera.inertialBetaOffset + camera.inertialRadiusOffset;
    if (motion) {
      this._updateHitPlane();
      camera.target.addInPlace(this._inertialPanning);
      this._inertialPanning.scaleInPlace(camera.inertia);
      this._zeroIfClose(this._inertialPanning);
    }
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "ArcRotateCameraMouseWheelInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "mousewheel";
  }
  _updateHitPlane() {
    const camera = this.camera;
    const direction = camera.target.subtract(camera.position);
    this._hitPlane = Plane.FromPositionAndNormal(camera.target, direction);
  }
  // Get position on the hit plane
  _getPosition() {
    const camera = this.camera;
    const scene = camera.getScene();
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera, false);
    if (camera.targetScreenOffset.x !== 0 || camera.targetScreenOffset.y !== 0) {
      this._viewOffset.set(camera.targetScreenOffset.x, camera.targetScreenOffset.y, 0);
      camera.getViewMatrix().invertToRef(camera._cameraTransformMatrix);
      this._globalOffset = Vector3.TransformNormal(this._viewOffset, camera._cameraTransformMatrix);
      ray.origin.addInPlace(this._globalOffset);
    }
    let distance = 0;
    if (this._hitPlane) {
      distance = ray.intersectsPlane(this._hitPlane) ?? 0;
    }
    return ray.origin.addInPlace(ray.direction.scaleInPlace(distance));
  }
  _zoomToMouse(delta) {
    const camera = this.camera;
    const inertiaComp = 1 - camera.inertia;
    if (camera.lowerRadiusLimit) {
      const lowerLimit = camera.lowerRadiusLimit ?? 0;
      if (camera.radius - (camera.inertialRadiusOffset + delta) / inertiaComp < lowerLimit) {
        delta = (camera.radius - lowerLimit) * inertiaComp - camera.inertialRadiusOffset;
      }
    }
    if (camera.upperRadiusLimit) {
      const upperLimit = camera.upperRadiusLimit ?? 0;
      if (camera.radius - (camera.inertialRadiusOffset + delta) / inertiaComp > upperLimit) {
        delta = (camera.radius - upperLimit) * inertiaComp - camera.inertialRadiusOffset;
      }
    }
    const zoomDistance = delta / inertiaComp;
    const ratio = zoomDistance / camera.radius;
    const vec = this._getPosition();
    const directionToZoomLocation = TmpVectors.Vector3[6];
    vec.subtractToRef(camera.target, directionToZoomLocation);
    directionToZoomLocation.scaleInPlace(ratio);
    directionToZoomLocation.scaleInPlace(inertiaComp);
    this._inertialPanning.addInPlace(directionToZoomLocation);
    camera.inertialRadiusOffset += delta;
  }
  // Sets x y or z of passed in vector to zero if less than Epsilon.
  _zeroIfClose(vec) {
    if (Math.abs(vec.x) < Epsilon) {
      vec.x = 0;
    }
    if (Math.abs(vec.y) < Epsilon) {
      vec.y = 0;
    }
    if (Math.abs(vec.z) < Epsilon) {
      vec.z = 0;
    }
  }
};
__decorate([
  serialize()
], ArcRotateCameraMouseWheelInput.prototype, "wheelPrecision", void 0);
__decorate([
  serialize()
], ArcRotateCameraMouseWheelInput.prototype, "zoomToMouseLocation", void 0);
__decorate([
  serialize()
], ArcRotateCameraMouseWheelInput.prototype, "wheelDeltaPercentage", void 0);
CameraInputTypes["ArcRotateCameraMouseWheelInput"] = ArcRotateCameraMouseWheelInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/arcRotateCameraInputsManager.js
var ArcRotateCameraInputsManager = class extends CameraInputsManager {
  /**
   * Instantiates a new ArcRotateCameraInputsManager.
   * @param camera Defines the camera the inputs belong to
   */
  constructor(camera) {
    super(camera);
  }
  /**
   * Add mouse wheel input support to the input manager.
   * @returns the current input manager
   */
  addMouseWheel() {
    this.add(new ArcRotateCameraMouseWheelInput());
    return this;
  }
  /**
   * Add pointers input support to the input manager.
   * @returns the current input manager
   */
  addPointers() {
    this.add(new ArcRotateCameraPointersInput());
    return this;
  }
  /**
   * Add keyboard input support to the input manager.
   * @returns the current input manager
   */
  addKeyboard() {
    this.add(new ArcRotateCameraKeyboardMoveInput());
    return this;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/arcRotateCameraGamepadInput.js
var ArcRotateCameraGamepadInput = class {
  constructor() {
    this.gamepadRotationSensibility = 80;
    this.gamepadMoveSensibility = 40;
    this._yAxisScale = 1;
  }
  /**
   * Gets or sets a boolean indicating that Yaxis (for right stick) should be inverted
   */
  get invertYAxis() {
    return this._yAxisScale !== 1;
  }
  set invertYAxis(value) {
    this._yAxisScale = value ? -1 : 1;
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   */
  attachControl() {
    const manager = this.camera.getScene().gamepadManager;
    this._onGamepadConnectedObserver = manager.onGamepadConnectedObservable.add((gamepad) => {
      if (gamepad.type !== Gamepad.POSE_ENABLED) {
        if (!this.gamepad || gamepad.type === Gamepad.XBOX) {
          this.gamepad = gamepad;
        }
      }
    });
    this._onGamepadDisconnectedObserver = manager.onGamepadDisconnectedObservable.add((gamepad) => {
      if (this.gamepad === gamepad) {
        this.gamepad = null;
      }
    });
    this.gamepad = manager.getGamepadByType(Gamepad.XBOX);
    if (!this.gamepad && manager.gamepads.length) {
      this.gamepad = manager.gamepads[0];
    }
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    this.camera.getScene().gamepadManager.onGamepadConnectedObservable.remove(this._onGamepadConnectedObserver);
    this.camera.getScene().gamepadManager.onGamepadDisconnectedObservable.remove(this._onGamepadDisconnectedObserver);
    this.gamepad = null;
  }
  /**
   * Update the current camera state depending on the inputs that have been used this frame.
   * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
   */
  checkInputs() {
    if (this.gamepad) {
      const camera = this.camera;
      const rsValues = this.gamepad.rightStick;
      if (rsValues) {
        if (rsValues.x != 0) {
          const normalizedRX = rsValues.x / this.gamepadRotationSensibility;
          if (normalizedRX != 0 && Math.abs(normalizedRX) > 5e-3) {
            camera.inertialAlphaOffset += normalizedRX;
          }
        }
        if (rsValues.y != 0) {
          const normalizedRY = rsValues.y / this.gamepadRotationSensibility * this._yAxisScale;
          if (normalizedRY != 0 && Math.abs(normalizedRY) > 5e-3) {
            camera.inertialBetaOffset += normalizedRY;
          }
        }
      }
      const lsValues = this.gamepad.leftStick;
      if (lsValues && lsValues.y != 0) {
        const normalizedLY = lsValues.y / this.gamepadMoveSensibility;
        if (normalizedLY != 0 && Math.abs(normalizedLY) > 5e-3) {
          this.camera.inertialRadiusOffset -= normalizedLY;
        }
      }
    }
  }
  /**
   * Gets the class name of the current intput.
   * @returns the class name
   */
  getClassName() {
    return "ArcRotateCameraGamepadInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "gamepad";
  }
};
__decorate([
  serialize()
], ArcRotateCameraGamepadInput.prototype, "gamepadRotationSensibility", void 0);
__decorate([
  serialize()
], ArcRotateCameraGamepadInput.prototype, "gamepadMoveSensibility", void 0);
CameraInputTypes["ArcRotateCameraGamepadInput"] = ArcRotateCameraGamepadInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Gamepads/gamepadSceneComponent.js
Object.defineProperty(Scene.prototype, "gamepadManager", {
  get: function() {
    if (!this._gamepadManager) {
      this._gamepadManager = new GamepadManager(this);
      let component = this._getComponent(SceneComponentConstants.NAME_GAMEPAD);
      if (!component) {
        component = new GamepadSystemSceneComponent(this);
        this._addComponent(component);
      }
    }
    return this._gamepadManager;
  },
  enumerable: true,
  configurable: true
});
FreeCameraInputsManager.prototype.addGamepad = function() {
  this.add(new FreeCameraGamepadInput());
  return this;
};
ArcRotateCameraInputsManager.prototype.addGamepad = function() {
  this.add(new ArcRotateCameraGamepadInput());
  return this;
};
var GamepadSystemSceneComponent = class {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_GAMEPAD;
    this.scene = scene;
  }
  /**
   * Registers the component in a given scene
   */
  register() {
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
  }
  /**
   * Disposes the component and the associated resources
   */
  dispose() {
    const gamepadManager = this.scene._gamepadManager;
    if (gamepadManager) {
      gamepadManager.dispose();
      this.scene._gamepadManager = null;
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/universalCamera.js
Node.AddNodeConstructor("FreeCamera", (name, scene) => {
  return () => new UniversalCamera(name, Vector3.Zero(), scene);
});
var UniversalCamera = class extends TouchCamera {
  /**
   * Defines the gamepad rotation sensibility.
   * This is the threshold from when rotation starts to be accounted for to prevent jittering.
   */
  get gamepadAngularSensibility() {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      return gamepad.gamepadAngularSensibility;
    }
    return 0;
  }
  set gamepadAngularSensibility(value) {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      gamepad.gamepadAngularSensibility = value;
    }
  }
  /**
   * Defines the gamepad move sensibility.
   * This is the threshold from when moving starts to be accounted for to prevent jittering.
   */
  get gamepadMoveSensibility() {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      return gamepad.gamepadMoveSensibility;
    }
    return 0;
  }
  set gamepadMoveSensibility(value) {
    const gamepad = this.inputs.attached["gamepad"];
    if (gamepad) {
      gamepad.gamepadMoveSensibility = value;
    }
  }
  /**
   * The Universal Camera is the one to choose for first person shooter type games, and works with all the keyboard, mouse, touch and gamepads. This replaces the earlier Free Camera,
   * which still works and will still be found in many Playgrounds.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_introduction#universal-camera
   * @param name Define the name of the camera in the scene
   * @param position Define the start position of the camera in the scene
   * @param scene Define the scene the camera belongs to
   */
  constructor(name, position, scene) {
    super(name, position, scene);
    this.inputs.addGamepad();
  }
  /**
   * Gets the current object class name.
   * @returns the class name
   */
  getClassName() {
    return "UniversalCamera";
  }
};
Camera._CreateDefaultParsedCamera = (name, scene) => {
  return new UniversalCamera(name, Vector3.Zero(), scene);
};
export {
  UniversalCamera
};
//# sourceMappingURL=@babylonjs_core_Cameras_universalCamera.js.map
