import {
  Camera
} from "./chunk-CESSEMZQ.js";
import {
  Axis
} from "./chunk-W7NAK7I4.js";
import {
  EventConstants,
  KeyboardEventTypes
} from "./chunk-BELK345T.js";
import {
  PointerEventTypes
} from "./chunk-VMWDNJJG.js";
import {
  Tools
} from "./chunk-2GZCEIFN.js";
import {
  AbstractEngine
} from "./chunk-CQNOHBC6.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import {
  Node
} from "./chunk-D664DUZM.js";
import {
  SerializationHelper
} from "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize,
  serializeAsMeshReference,
  serializeAsVector3
} from "./chunk-STIKNZXL.js";
import {
  Matrix,
  Quaternion,
  TmpVectors,
  Vector2,
  Vector3
} from "./chunk-YLLTSBLI.js";
import {
  Epsilon
} from "./chunk-DSUROWQ4.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/targetCamera.js
Node.AddNodeConstructor("TargetCamera", (name, scene) => {
  return () => new TargetCamera(name, Vector3.Zero(), scene);
});
var TmpMatrix = Matrix.Zero();
var TmpQuaternion = Quaternion.Identity();
var TargetCamera = class _TargetCamera extends Camera {
  /**
   * Instantiates a target camera that takes a mesh or position as a target and continues to look at it while it moves.
   * This is the base of the follow, arc rotate cameras and Free camera
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras
   * @param name Defines the name of the camera in the scene
   * @param position Defines the start position of the camera in the scene
   * @param scene Defines the scene the camera belongs to
   * @param setActiveOnSceneIfNoneActive Defines whether the camera should be marked as active if not other active cameras have been defined
   */
  constructor(name, position, scene, setActiveOnSceneIfNoneActive = true) {
    super(name, position, scene, setActiveOnSceneIfNoneActive);
    this.cameraDirection = new Vector3(0, 0, 0);
    this.cameraRotation = new Vector2(0, 0);
    this.updateUpVectorFromRotation = false;
    this.speed = 2;
    this.noRotationConstraint = false;
    this.invertRotation = false;
    this.inverseRotationSpeed = 0.2;
    this._panningEpsilon = Epsilon;
    this._rotationEpsilon = Epsilon;
    this.lockedTarget = null;
    this._currentTarget = Vector3.Zero();
    this._initialFocalDistance = 1;
    this._viewMatrix = Matrix.Zero();
    this._cameraTransformMatrix = Matrix.Zero();
    this._cameraRotationMatrix = Matrix.Zero();
    this._transformedReferencePoint = Vector3.Zero();
    this._deferredPositionUpdate = new Vector3();
    this._deferredRotationQuaternionUpdate = new Quaternion();
    this._deferredRotationUpdate = new Vector3();
    this._deferredUpdated = false;
    this._deferOnly = false;
    this._cachedRotationZ = 0;
    this._cachedQuaternionRotationZ = 0;
    this._referencePoint = Vector3.Forward(this.getScene().useRightHandedSystem);
    this.rotation = new Vector3(0, this.getScene().useRightHandedSystem ? Math.PI : 0, 0);
  }
  /**
   * Gets the position in front of the camera at a given distance.
   * @param distance The distance from the camera we want the position to be
   * @returns the position
   */
  getFrontPosition(distance) {
    this.getWorldMatrix();
    const worldForward = TmpVectors.Vector3[0];
    const localForward = TmpVectors.Vector3[1];
    localForward.set(0, 0, this._scene.useRightHandedSystem ? -1 : 1);
    this.getDirectionToRef(localForward, worldForward);
    worldForward.scaleInPlace(distance);
    return this.globalPosition.add(worldForward);
  }
  /** @internal */
  _getLockedTargetPosition() {
    if (!this.lockedTarget) {
      return null;
    }
    if (this.lockedTarget.absolutePosition) {
      const lockedTarget = this.lockedTarget;
      const m = lockedTarget.computeWorldMatrix();
      m.getTranslationToRef(lockedTarget.absolutePosition);
    }
    return this.lockedTarget.absolutePosition || this.lockedTarget;
  }
  /**
   * Store current camera state of the camera (fov, position, rotation, etc..)
   * @returns the camera
   */
  storeState() {
    this._storedPosition = this.position.clone();
    this._storedRotation = this.rotation.clone();
    if (this.rotationQuaternion) {
      this._storedRotationQuaternion = this.rotationQuaternion.clone();
    }
    return super.storeState();
  }
  /**
   * Restored camera state. You must call storeState() first
   * @returns whether it was successful or not
   * @internal
   */
  _restoreStateValues() {
    if (!super._restoreStateValues()) {
      return false;
    }
    this.position = this._storedPosition.clone();
    this.rotation = this._storedRotation.clone();
    if (this.rotationQuaternion && this._storedRotationQuaternion) {
      this.rotationQuaternion = this._storedRotationQuaternion.clone();
    }
    this.cameraDirection.copyFromFloats(0, 0, 0);
    this.cameraRotation.copyFromFloats(0, 0);
    return true;
  }
  /** @internal */
  _initCache() {
    super._initCache();
    this._cache.lockedTarget = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._cache.rotation = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._cache.rotationQuaternion = new Quaternion(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
  }
  /**
   * @internal
   */
  _updateCache(ignoreParentClass) {
    if (!ignoreParentClass) {
      super._updateCache();
    }
    const lockedTargetPosition = this._getLockedTargetPosition();
    if (!lockedTargetPosition) {
      this._cache.lockedTarget = null;
    } else {
      if (!this._cache.lockedTarget) {
        this._cache.lockedTarget = lockedTargetPosition.clone();
      } else {
        this._cache.lockedTarget.copyFrom(lockedTargetPosition);
      }
    }
    this._cache.rotation.copyFrom(this.rotation);
    if (this.rotationQuaternion) {
      this._cache.rotationQuaternion.copyFrom(this.rotationQuaternion);
    }
  }
  // Synchronized
  /** @internal */
  _isSynchronizedViewMatrix() {
    if (!super._isSynchronizedViewMatrix()) {
      return false;
    }
    const lockedTargetPosition = this._getLockedTargetPosition();
    return (this._cache.lockedTarget ? this._cache.lockedTarget.equals(lockedTargetPosition) : !lockedTargetPosition) && (this.rotationQuaternion ? this.rotationQuaternion.equals(this._cache.rotationQuaternion) : this._cache.rotation.equals(this.rotation));
  }
  // Methods
  /** @internal */
  _computeLocalCameraSpeed() {
    const engine = this.getEngine();
    return this.speed * Math.sqrt(engine.getDeltaTime() / (engine.getFps() * 100));
  }
  // Target
  /**
   * Defines the target the camera should look at.
   * @param target Defines the new target as a Vector
   */
  setTarget(target) {
    this.upVector.normalize();
    this._initialFocalDistance = target.subtract(this.position).length();
    if (this.position.z === target.z) {
      this.position.z += Epsilon;
    }
    this._referencePoint.normalize().scaleInPlace(this._initialFocalDistance);
    if (this.getScene().useRightHandedSystem) {
      Matrix.LookAtRHToRef(this.position, target, Vector3.UpReadOnly, TmpMatrix);
    } else {
      Matrix.LookAtLHToRef(this.position, target, Vector3.UpReadOnly, TmpMatrix);
    }
    TmpMatrix.invert();
    const rotationQuaternion = this.rotationQuaternion || TmpQuaternion;
    Quaternion.FromRotationMatrixToRef(TmpMatrix, rotationQuaternion);
    rotationQuaternion.toEulerAnglesToRef(this.rotation);
    this.rotation.z = 0;
  }
  /**
   * Defines the target point of the camera.
   * The camera looks towards it form the radius distance.
   */
  get target() {
    return this.getTarget();
  }
  set target(value) {
    this.setTarget(value);
  }
  /**
   * Return the current target position of the camera. This value is expressed in local space.
   * @returns the target position
   */
  getTarget() {
    return this._currentTarget;
  }
  /** @internal */
  _decideIfNeedsToMove() {
    return Math.abs(this.cameraDirection.x) > 0 || Math.abs(this.cameraDirection.y) > 0 || Math.abs(this.cameraDirection.z) > 0;
  }
  /** @internal */
  _updatePosition() {
    if (this.parent) {
      this.parent.getWorldMatrix().invertToRef(TmpVectors.Matrix[0]);
      Vector3.TransformNormalToRef(this.cameraDirection, TmpVectors.Matrix[0], TmpVectors.Vector3[0]);
      this._deferredPositionUpdate.addInPlace(TmpVectors.Vector3[0]);
      if (!this._deferOnly) {
        this.position.copyFrom(this._deferredPositionUpdate);
      } else {
        this._deferredUpdated = true;
      }
      return;
    }
    this._deferredPositionUpdate.addInPlace(this.cameraDirection);
    if (!this._deferOnly) {
      this.position.copyFrom(this._deferredPositionUpdate);
    } else {
      this._deferredUpdated = true;
    }
  }
  /** @internal */
  _checkInputs() {
    const directionMultiplier = this.invertRotation ? -this.inverseRotationSpeed : 1;
    const needToMove = this._decideIfNeedsToMove();
    const needToRotate = this.cameraRotation.x || this.cameraRotation.y;
    this._deferredUpdated = false;
    this._deferredRotationUpdate.copyFrom(this.rotation);
    this._deferredPositionUpdate.copyFrom(this.position);
    if (this.rotationQuaternion) {
      this._deferredRotationQuaternionUpdate.copyFrom(this.rotationQuaternion);
    }
    if (needToMove) {
      this._updatePosition();
    }
    if (needToRotate) {
      if (this.rotationQuaternion) {
        this.rotationQuaternion.toEulerAnglesToRef(this._deferredRotationUpdate);
      }
      this._deferredRotationUpdate.x += this.cameraRotation.x * directionMultiplier;
      this._deferredRotationUpdate.y += this.cameraRotation.y * directionMultiplier;
      if (!this.noRotationConstraint) {
        const limit = 1.570796;
        if (this._deferredRotationUpdate.x > limit) {
          this._deferredRotationUpdate.x = limit;
        }
        if (this._deferredRotationUpdate.x < -limit) {
          this._deferredRotationUpdate.x = -limit;
        }
      }
      if (!this._deferOnly) {
        this.rotation.copyFrom(this._deferredRotationUpdate);
      } else {
        this._deferredUpdated = true;
      }
      if (this.rotationQuaternion) {
        const len = this._deferredRotationUpdate.lengthSquared();
        if (len) {
          Quaternion.RotationYawPitchRollToRef(this._deferredRotationUpdate.y, this._deferredRotationUpdate.x, this._deferredRotationUpdate.z, this._deferredRotationQuaternionUpdate);
          if (!this._deferOnly) {
            this.rotationQuaternion.copyFrom(this._deferredRotationQuaternionUpdate);
          } else {
            this._deferredUpdated = true;
          }
        }
      }
    }
    const inertialPanningLimit = this.speed * this._panningEpsilon;
    const inertialRotationLimit = this.speed * this._rotationEpsilon;
    if (needToMove) {
      if (Math.abs(this.cameraDirection.x) < inertialPanningLimit) {
        this.cameraDirection.x = 0;
      }
      if (Math.abs(this.cameraDirection.y) < inertialPanningLimit) {
        this.cameraDirection.y = 0;
      }
      if (Math.abs(this.cameraDirection.z) < inertialPanningLimit) {
        this.cameraDirection.z = 0;
      }
      this.cameraDirection.scaleInPlace(this.inertia);
    }
    if (needToRotate) {
      if (Math.abs(this.cameraRotation.x) < inertialRotationLimit) {
        this.cameraRotation.x = 0;
      }
      if (Math.abs(this.cameraRotation.y) < inertialRotationLimit) {
        this.cameraRotation.y = 0;
      }
      this.cameraRotation.scaleInPlace(this.inertia);
    }
    super._checkInputs();
  }
  _updateCameraRotationMatrix() {
    if (this.rotationQuaternion) {
      this.rotationQuaternion.toRotationMatrix(this._cameraRotationMatrix);
    } else {
      Matrix.RotationYawPitchRollToRef(this.rotation.y, this.rotation.x, this.rotation.z, this._cameraRotationMatrix);
    }
  }
  /**
   * Update the up vector to apply the rotation of the camera (So if you changed the camera rotation.z this will let you update the up vector as well)
   * @returns the current camera
   */
  _rotateUpVectorWithCameraRotationMatrix() {
    Vector3.TransformNormalToRef(Vector3.UpReadOnly, this._cameraRotationMatrix, this.upVector);
    return this;
  }
  /** @internal */
  _getViewMatrix() {
    if (this.lockedTarget) {
      this.setTarget(this._getLockedTargetPosition());
    }
    this._updateCameraRotationMatrix();
    if (this.rotationQuaternion && this._cachedQuaternionRotationZ != this.rotationQuaternion.z) {
      this._rotateUpVectorWithCameraRotationMatrix();
      this._cachedQuaternionRotationZ = this.rotationQuaternion.z;
    } else if (this._cachedRotationZ !== this.rotation.z) {
      this._rotateUpVectorWithCameraRotationMatrix();
      this._cachedRotationZ = this.rotation.z;
    }
    Vector3.TransformCoordinatesToRef(this._referencePoint, this._cameraRotationMatrix, this._transformedReferencePoint);
    this.position.addToRef(this._transformedReferencePoint, this._currentTarget);
    if (this.updateUpVectorFromRotation) {
      if (this.rotationQuaternion) {
        Axis.Y.rotateByQuaternionToRef(this.rotationQuaternion, this.upVector);
      } else {
        Quaternion.FromEulerVectorToRef(this.rotation, TmpQuaternion);
        Axis.Y.rotateByQuaternionToRef(TmpQuaternion, this.upVector);
      }
    }
    this._computeViewMatrix(this.position, this._currentTarget, this.upVector);
    return this._viewMatrix;
  }
  _computeViewMatrix(position, target, up) {
    if (this.getScene().useRightHandedSystem) {
      Matrix.LookAtRHToRef(position, target, up, this._viewMatrix);
    } else {
      Matrix.LookAtLHToRef(position, target, up, this._viewMatrix);
    }
    if (this.parent) {
      const parentWorldMatrix = this.parent.getWorldMatrix();
      this._viewMatrix.invert();
      this._viewMatrix.multiplyToRef(parentWorldMatrix, this._viewMatrix);
      this._viewMatrix.invert();
      this._markSyncedWithParent();
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createRigCamera(name, cameraIndex) {
    if (this.cameraRigMode !== Camera.RIG_MODE_NONE) {
      const rigCamera = new _TargetCamera(name, this.position.clone(), this.getScene());
      rigCamera.isRigCamera = true;
      rigCamera.rigParent = this;
      if (this.cameraRigMode === Camera.RIG_MODE_VR) {
        if (!this.rotationQuaternion) {
          this.rotationQuaternion = new Quaternion();
        }
        rigCamera._cameraRigParams = {};
        rigCamera.rotationQuaternion = new Quaternion();
      }
      rigCamera.mode = this.mode;
      rigCamera.orthoLeft = this.orthoLeft;
      rigCamera.orthoRight = this.orthoRight;
      rigCamera.orthoTop = this.orthoTop;
      rigCamera.orthoBottom = this.orthoBottom;
      return rigCamera;
    }
    return null;
  }
  /**
   * @internal
   */
  _updateRigCameras() {
    const camLeft = this._rigCameras[0];
    const camRight = this._rigCameras[1];
    this.computeWorldMatrix();
    switch (this.cameraRigMode) {
      case Camera.RIG_MODE_STEREOSCOPIC_ANAGLYPH:
      case Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_PARALLEL:
      case Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_CROSSEYED:
      case Camera.RIG_MODE_STEREOSCOPIC_OVERUNDER:
      case Camera.RIG_MODE_STEREOSCOPIC_INTERLACED: {
        const leftSign = this.cameraRigMode === Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_CROSSEYED ? 1 : -1;
        const rightSign = this.cameraRigMode === Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_CROSSEYED ? -1 : 1;
        this._getRigCamPositionAndTarget(this._cameraRigParams.stereoHalfAngle * leftSign, camLeft);
        this._getRigCamPositionAndTarget(this._cameraRigParams.stereoHalfAngle * rightSign, camRight);
        break;
      }
      case Camera.RIG_MODE_VR:
        if (camLeft.rotationQuaternion && camRight.rotationQuaternion && this.rotationQuaternion) {
          camLeft.rotationQuaternion.copyFrom(this.rotationQuaternion);
          camRight.rotationQuaternion.copyFrom(this.rotationQuaternion);
        } else {
          camLeft.rotation.copyFrom(this.rotation);
          camRight.rotation.copyFrom(this.rotation);
        }
        camLeft.position.copyFrom(this.position);
        camRight.position.copyFrom(this.position);
        break;
    }
    super._updateRigCameras();
  }
  _getRigCamPositionAndTarget(halfSpace, rigCamera) {
    const target = this.getTarget();
    target.subtractToRef(this.position, _TargetCamera._TargetFocalPoint);
    _TargetCamera._TargetFocalPoint.normalize().scaleInPlace(this._initialFocalDistance);
    const newFocalTarget = _TargetCamera._TargetFocalPoint.addInPlace(this.position);
    Matrix.TranslationToRef(-newFocalTarget.x, -newFocalTarget.y, -newFocalTarget.z, _TargetCamera._TargetTransformMatrix);
    _TargetCamera._TargetTransformMatrix.multiplyToRef(Matrix.RotationAxis(rigCamera.upVector, halfSpace), _TargetCamera._RigCamTransformMatrix);
    Matrix.TranslationToRef(newFocalTarget.x, newFocalTarget.y, newFocalTarget.z, _TargetCamera._TargetTransformMatrix);
    _TargetCamera._RigCamTransformMatrix.multiplyToRef(_TargetCamera._TargetTransformMatrix, _TargetCamera._RigCamTransformMatrix);
    Vector3.TransformCoordinatesToRef(this.position, _TargetCamera._RigCamTransformMatrix, rigCamera.position);
    rigCamera.setTarget(newFocalTarget);
  }
  /**
   * Gets the current object class name.
   * @returns the class name
   */
  getClassName() {
    return "TargetCamera";
  }
};
TargetCamera._RigCamTransformMatrix = new Matrix();
TargetCamera._TargetTransformMatrix = new Matrix();
TargetCamera._TargetFocalPoint = new Vector3();
__decorate([
  serialize()
], TargetCamera.prototype, "updateUpVectorFromRotation", void 0);
__decorate([
  serializeAsVector3()
], TargetCamera.prototype, "rotation", void 0);
__decorate([
  serialize()
], TargetCamera.prototype, "speed", void 0);
__decorate([
  serializeAsMeshReference("lockedTargetId")
], TargetCamera.prototype, "lockedTarget", void 0);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/cameraInputsManager.js
var CameraInputTypes = {};
var CameraInputsManager = class {
  /**
   * Instantiate a new Camera Input Manager.
   * @param camera Defines the camera the input manager belongs to
   */
  constructor(camera) {
    this.attachedToElement = false;
    this.attached = {};
    this.camera = camera;
    this.checkInputs = () => {
    };
  }
  /**
   * Add an input method to a camera
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/customizingCameraInputs
   * @param input Camera input method
   */
  add(input) {
    const type = input.getSimpleName();
    if (this.attached[type]) {
      Logger.Warn("camera input of type " + type + " already exists on camera");
      return;
    }
    this.attached[type] = input;
    input.camera = this.camera;
    if (input.checkInputs) {
      this.checkInputs = this._addCheckInputs(input.checkInputs.bind(input));
    }
    if (this.attachedToElement) {
      input.attachControl(this.noPreventDefault);
    }
  }
  /**
   * Remove a specific input method from a camera
   * example: camera.inputs.remove(camera.inputs.attached.mouse);
   * @param inputToRemove camera input method
   */
  remove(inputToRemove) {
    for (const cam in this.attached) {
      const input = this.attached[cam];
      if (input === inputToRemove) {
        input.detachControl();
        input.camera = null;
        delete this.attached[cam];
        this.rebuildInputCheck();
        return;
      }
    }
  }
  /**
   * Remove a specific input type from a camera
   * example: camera.inputs.remove("ArcRotateCameraGamepadInput");
   * @param inputType the type of the input to remove
   */
  removeByType(inputType) {
    for (const cam in this.attached) {
      const input = this.attached[cam];
      if (input.getClassName() === inputType) {
        input.detachControl();
        input.camera = null;
        delete this.attached[cam];
        this.rebuildInputCheck();
      }
    }
  }
  _addCheckInputs(fn) {
    const current = this.checkInputs;
    return () => {
      current();
      fn();
    };
  }
  /**
   * Attach the input controls to the currently attached dom element to listen the events from.
   * @param input Defines the input to attach
   */
  attachInput(input) {
    if (this.attachedToElement) {
      input.attachControl(this.noPreventDefault);
    }
  }
  /**
   * Attach the current manager inputs controls to a specific dom element to listen the events from.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachElement(noPreventDefault = false) {
    if (this.attachedToElement) {
      return;
    }
    noPreventDefault = Camera.ForceAttachControlToAlwaysPreventDefault ? false : noPreventDefault;
    this.attachedToElement = true;
    this.noPreventDefault = noPreventDefault;
    for (const cam in this.attached) {
      this.attached[cam].attachControl(noPreventDefault);
    }
  }
  /**
   * Detach the current manager inputs controls from a specific dom element.
   * @param disconnect Defines whether the input should be removed from the current list of attached inputs
   */
  detachElement(disconnect = false) {
    for (const cam in this.attached) {
      this.attached[cam].detachControl();
      if (disconnect) {
        this.attached[cam].camera = null;
      }
    }
    this.attachedToElement = false;
  }
  /**
   * Rebuild the dynamic inputCheck function from the current list of
   * defined inputs in the manager.
   */
  rebuildInputCheck() {
    this.checkInputs = () => {
    };
    for (const cam in this.attached) {
      const input = this.attached[cam];
      if (input.checkInputs) {
        this.checkInputs = this._addCheckInputs(input.checkInputs.bind(input));
      }
    }
  }
  /**
   * Remove all attached input methods from a camera
   */
  clear() {
    if (this.attachedToElement) {
      this.detachElement(true);
    }
    this.attached = {};
    this.attachedToElement = false;
    this.checkInputs = () => {
    };
  }
  /**
   * Serialize the current input manager attached to a camera.
   * This ensures than once parsed,
   * the input associated to the camera will be identical to the current ones
   * @param serializedCamera Defines the camera serialization JSON the input serialization should write to
   */
  serialize(serializedCamera) {
    const inputs = {};
    for (const cam in this.attached) {
      const input = this.attached[cam];
      const res = SerializationHelper.Serialize(input);
      inputs[input.getClassName()] = res;
    }
    serializedCamera.inputsmgr = inputs;
  }
  /**
   * Parses an input manager serialized JSON to restore the previous list of inputs
   * and states associated to a camera.
   * @param parsedCamera Defines the JSON to parse
   */
  parse(parsedCamera) {
    const parsedInputs = parsedCamera.inputsmgr;
    if (parsedInputs) {
      this.clear();
      for (const n in parsedInputs) {
        const construct = CameraInputTypes[n];
        if (construct) {
          const parsedinput = parsedInputs[n];
          const input = SerializationHelper.Parse(() => {
            return new construct();
          }, parsedinput, null);
          this.add(input);
        }
      }
    } else {
      for (const n in this.attached) {
        const construct = CameraInputTypes[this.attached[n].getClassName()];
        if (construct) {
          const input = SerializationHelper.Parse(() => {
            return new construct();
          }, parsedCamera, null);
          this.remove(this.attached[n]);
          this.add(input);
        }
      }
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/freeCameraKeyboardMoveInput.js
var FreeCameraKeyboardMoveInput = class {
  constructor() {
    this.keysUp = [38];
    this.keysUpward = [33];
    this.keysDown = [40];
    this.keysDownward = [34];
    this.keysLeft = [37];
    this.keysRight = [39];
    this.rotationSpeed = 0.5;
    this.keysRotateLeft = [];
    this.keysRotateRight = [];
    this.keysRotateUp = [];
    this.keysRotateDown = [];
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
          if (this.keysUp.indexOf(evt.keyCode) !== -1 || this.keysDown.indexOf(evt.keyCode) !== -1 || this.keysLeft.indexOf(evt.keyCode) !== -1 || this.keysRight.indexOf(evt.keyCode) !== -1 || this.keysUpward.indexOf(evt.keyCode) !== -1 || this.keysDownward.indexOf(evt.keyCode) !== -1 || this.keysRotateLeft.indexOf(evt.keyCode) !== -1 || this.keysRotateRight.indexOf(evt.keyCode) !== -1 || this.keysRotateUp.indexOf(evt.keyCode) !== -1 || this.keysRotateDown.indexOf(evt.keyCode) !== -1) {
            const index = this._keys.indexOf(evt.keyCode);
            if (index === -1) {
              this._keys.push(evt.keyCode);
            }
            if (!noPreventDefault) {
              evt.preventDefault();
            }
          }
        } else {
          if (this.keysUp.indexOf(evt.keyCode) !== -1 || this.keysDown.indexOf(evt.keyCode) !== -1 || this.keysLeft.indexOf(evt.keyCode) !== -1 || this.keysRight.indexOf(evt.keyCode) !== -1 || this.keysUpward.indexOf(evt.keyCode) !== -1 || this.keysDownward.indexOf(evt.keyCode) !== -1 || this.keysRotateLeft.indexOf(evt.keyCode) !== -1 || this.keysRotateRight.indexOf(evt.keyCode) !== -1 || this.keysRotateUp.indexOf(evt.keyCode) !== -1 || this.keysRotateDown.indexOf(evt.keyCode) !== -1) {
            const index = this._keys.indexOf(evt.keyCode);
            if (index >= 0) {
              this._keys.splice(index, 1);
            }
            if (!noPreventDefault) {
              evt.preventDefault();
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
        const speed = camera._computeLocalCameraSpeed();
        if (this.keysLeft.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(-speed, 0, 0);
        } else if (this.keysUp.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, 0, speed);
        } else if (this.keysRight.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(speed, 0, 0);
        } else if (this.keysDown.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, 0, -speed);
        } else if (this.keysUpward.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, speed, 0);
        } else if (this.keysDownward.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, -speed, 0);
        } else if (this.keysRotateLeft.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, 0, 0);
          camera.cameraRotation.y -= this._getLocalRotation();
        } else if (this.keysRotateRight.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, 0, 0);
          camera.cameraRotation.y += this._getLocalRotation();
        } else if (this.keysRotateUp.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, 0, 0);
          camera.cameraRotation.x -= this._getLocalRotation();
        } else if (this.keysRotateDown.indexOf(keyCode) !== -1) {
          camera._localDirection.copyFromFloats(0, 0, 0);
          camera.cameraRotation.x += this._getLocalRotation();
        }
        if (camera.getScene().useRightHandedSystem) {
          camera._localDirection.z *= -1;
        }
        camera.getViewMatrix().invertToRef(camera._cameraTransformMatrix);
        Vector3.TransformNormalToRef(camera._localDirection, camera._cameraTransformMatrix, camera._transformedDirection);
        camera.cameraDirection.addInPlace(camera._transformedDirection);
      }
    }
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "FreeCameraKeyboardMoveInput";
  }
  /** @internal */
  _onLostFocus() {
    this._keys.length = 0;
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "keyboard";
  }
  _getLocalRotation() {
    const handednessMultiplier = this.camera._calculateHandednessMultiplier();
    const rotation = this.rotationSpeed * this._engine.getDeltaTime() / 1e3 * handednessMultiplier;
    return rotation;
  }
};
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysUp", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysUpward", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysDown", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysDownward", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysLeft", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysRight", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "rotationSpeed", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysRotateLeft", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysRotateRight", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysRotateUp", void 0);
__decorate([
  serialize()
], FreeCameraKeyboardMoveInput.prototype, "keysRotateDown", void 0);
CameraInputTypes["FreeCameraKeyboardMoveInput"] = FreeCameraKeyboardMoveInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/freeCameraMouseInput.js
var FreeCameraMouseInput = class {
  /**
   * Manage the mouse inputs to control the movement of a free camera.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/customizingCameraInputs
   * @param touchEnabled Defines if touch is enabled or not
   */
  constructor(touchEnabled = true) {
    this.touchEnabled = touchEnabled;
    this.buttons = [0, 1, 2];
    this.angularSensibility = 2e3;
    this._previousPosition = null;
    this.onPointerMovedObservable = new Observable();
    this._allowCameraRotation = true;
    this._currentActiveButton = -1;
    this._activePointerId = -1;
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachControl(noPreventDefault) {
    noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
    const engine = this.camera.getEngine();
    const element = engine.getInputElement();
    if (!this._pointerInput) {
      this._pointerInput = (p) => {
        const evt = p.event;
        const isTouch = evt.pointerType === "touch";
        if (!this.touchEnabled && isTouch) {
          return;
        }
        if (p.type !== PointerEventTypes.POINTERMOVE && this.buttons.indexOf(evt.button) === -1) {
          return;
        }
        const srcElement = evt.target;
        if (p.type === PointerEventTypes.POINTERDOWN) {
          if (isTouch && this._activePointerId !== -1 || !isTouch && this._currentActiveButton !== -1) {
            return;
          }
          this._activePointerId = evt.pointerId;
          try {
            srcElement?.setPointerCapture(evt.pointerId);
          } catch (e) {
          }
          if (this._currentActiveButton === -1) {
            this._currentActiveButton = evt.button;
          }
          this._previousPosition = {
            x: evt.clientX,
            y: evt.clientY
          };
          if (!noPreventDefault) {
            evt.preventDefault();
            if (element) {
              element.focus();
            }
          }
          if (engine.isPointerLock && this._onMouseMove) {
            this._onMouseMove(p.event);
          }
        } else if (p.type === PointerEventTypes.POINTERUP) {
          if (isTouch && this._activePointerId !== evt.pointerId || !isTouch && this._currentActiveButton !== evt.button) {
            return;
          }
          try {
            srcElement?.releasePointerCapture(evt.pointerId);
          } catch (e) {
          }
          this._currentActiveButton = -1;
          this._previousPosition = null;
          if (!noPreventDefault) {
            evt.preventDefault();
          }
          this._activePointerId = -1;
        } else if (p.type === PointerEventTypes.POINTERMOVE && (this._activePointerId === evt.pointerId || !isTouch)) {
          if (engine.isPointerLock && this._onMouseMove) {
            this._onMouseMove(p.event);
          } else if (this._previousPosition) {
            const handednessMultiplier = this.camera._calculateHandednessMultiplier();
            const offsetX = (evt.clientX - this._previousPosition.x) * handednessMultiplier;
            const offsetY = (evt.clientY - this._previousPosition.y) * handednessMultiplier;
            if (this._allowCameraRotation) {
              this.camera.cameraRotation.y += offsetX / this.angularSensibility;
              this.camera.cameraRotation.x += offsetY / this.angularSensibility;
            }
            this.onPointerMovedObservable.notifyObservers({ offsetX, offsetY });
            this._previousPosition = {
              x: evt.clientX,
              y: evt.clientY
            };
            if (!noPreventDefault) {
              evt.preventDefault();
            }
          }
        }
      };
    }
    this._onMouseMove = (evt) => {
      if (!engine.isPointerLock) {
        return;
      }
      const handednessMultiplier = this.camera._calculateHandednessMultiplier();
      this.camera.cameraRotation.y += evt.movementX * handednessMultiplier / this.angularSensibility;
      this.camera.cameraRotation.x += evt.movementY * handednessMultiplier / this.angularSensibility;
      this._previousPosition = null;
      if (!noPreventDefault) {
        evt.preventDefault();
      }
    };
    this._observer = this.camera.getScene()._inputManager._addCameraPointerObserver(this._pointerInput, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP | PointerEventTypes.POINTERMOVE);
    if (element) {
      this._contextMenuBind = (evt) => this.onContextMenu(evt);
      element.addEventListener("contextmenu", this._contextMenuBind, false);
    }
  }
  /**
   * Called on JS contextmenu event.
   * Override this method to provide functionality.
   * @param evt the context menu event
   */
  onContextMenu(evt) {
    evt.preventDefault();
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    if (this._observer) {
      this.camera.getScene()._inputManager._removeCameraPointerObserver(this._observer);
      if (this._contextMenuBind) {
        const engine = this.camera.getEngine();
        const element = engine.getInputElement();
        if (element) {
          element.removeEventListener("contextmenu", this._contextMenuBind);
        }
      }
      if (this.onPointerMovedObservable) {
        this.onPointerMovedObservable.clear();
      }
      this._observer = null;
      this._onMouseMove = null;
      this._previousPosition = null;
    }
    this._activePointerId = -1;
    this._currentActiveButton = -1;
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "FreeCameraMouseInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "mouse";
  }
};
__decorate([
  serialize()
], FreeCameraMouseInput.prototype, "buttons", void 0);
__decorate([
  serialize()
], FreeCameraMouseInput.prototype, "angularSensibility", void 0);
CameraInputTypes["FreeCameraMouseInput"] = FreeCameraMouseInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/BaseCameraMouseWheelInput.js
var BaseCameraMouseWheelInput = class {
  constructor() {
    this.wheelPrecisionX = 3;
    this.wheelPrecisionY = 3;
    this.wheelPrecisionZ = 3;
    this.onChangedObservable = new Observable();
    this._wheelDeltaX = 0;
    this._wheelDeltaY = 0;
    this._wheelDeltaZ = 0;
    this._ffMultiplier = 12;
    this._normalize = 120;
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param noPreventDefault Defines whether event caught by the controls
   *   should call preventdefault().
   *   (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachControl(noPreventDefault) {
    noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
    this._wheel = (pointer) => {
      if (pointer.type !== PointerEventTypes.POINTERWHEEL) {
        return;
      }
      const event = pointer.event;
      const platformScale = event.deltaMode === EventConstants.DOM_DELTA_LINE ? this._ffMultiplier : 1;
      this._wheelDeltaX += this.wheelPrecisionX * platformScale * event.deltaX / this._normalize;
      this._wheelDeltaY -= this.wheelPrecisionY * platformScale * event.deltaY / this._normalize;
      this._wheelDeltaZ += this.wheelPrecisionZ * platformScale * event.deltaZ / this._normalize;
      if (event.preventDefault) {
        if (!noPreventDefault) {
          event.preventDefault();
        }
      }
    };
    this._observer = this.camera.getScene()._inputManager._addCameraPointerObserver(this._wheel, PointerEventTypes.POINTERWHEEL);
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
    if (this.onChangedObservable) {
      this.onChangedObservable.clear();
    }
  }
  /**
   * Called for each rendered frame.
   */
  checkInputs() {
    this.onChangedObservable.notifyObservers({
      wheelDeltaX: this._wheelDeltaX,
      wheelDeltaY: this._wheelDeltaY,
      wheelDeltaZ: this._wheelDeltaZ
    });
    this._wheelDeltaX = 0;
    this._wheelDeltaY = 0;
    this._wheelDeltaZ = 0;
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "BaseCameraMouseWheelInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "mousewheel";
  }
};
__decorate([
  serialize()
], BaseCameraMouseWheelInput.prototype, "wheelPrecisionX", void 0);
__decorate([
  serialize()
], BaseCameraMouseWheelInput.prototype, "wheelPrecisionY", void 0);
__decorate([
  serialize()
], BaseCameraMouseWheelInput.prototype, "wheelPrecisionZ", void 0);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/freeCameraMouseWheelInput.js
var _CameraProperty;
(function(_CameraProperty2) {
  _CameraProperty2[_CameraProperty2["MoveRelative"] = 0] = "MoveRelative";
  _CameraProperty2[_CameraProperty2["RotateRelative"] = 1] = "RotateRelative";
  _CameraProperty2[_CameraProperty2["MoveScene"] = 2] = "MoveScene";
})(_CameraProperty || (_CameraProperty = {}));
var FreeCameraMouseWheelInput = class extends BaseCameraMouseWheelInput {
  constructor() {
    super(...arguments);
    this._moveRelative = Vector3.Zero();
    this._rotateRelative = Vector3.Zero();
    this._moveScene = Vector3.Zero();
    this._wheelXAction = _CameraProperty.MoveRelative;
    this._wheelXActionCoordinate = 0;
    this._wheelYAction = _CameraProperty.MoveRelative;
    this._wheelYActionCoordinate = 2;
    this._wheelZAction = null;
    this._wheelZActionCoordinate = null;
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "FreeCameraMouseWheelInput";
  }
  /**
   * Set which movement axis (relative to camera's orientation) the mouse
   * wheel's X axis controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelXMoveRelative(axis) {
    if (axis === null && this._wheelXAction !== _CameraProperty.MoveRelative) {
      return;
    }
    this._wheelXAction = _CameraProperty.MoveRelative;
    this._wheelXActionCoordinate = axis;
  }
  /**
   * Get the configured movement axis (relative to camera's orientation) the
   * mouse wheel's X axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelXMoveRelative() {
    if (this._wheelXAction !== _CameraProperty.MoveRelative) {
      return null;
    }
    return this._wheelXActionCoordinate;
  }
  /**
   * Set which movement axis (relative to camera's orientation) the mouse
   * wheel's Y axis controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelYMoveRelative(axis) {
    if (axis === null && this._wheelYAction !== _CameraProperty.MoveRelative) {
      return;
    }
    this._wheelYAction = _CameraProperty.MoveRelative;
    this._wheelYActionCoordinate = axis;
  }
  /**
   * Get the configured movement axis (relative to camera's orientation) the
   * mouse wheel's Y axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelYMoveRelative() {
    if (this._wheelYAction !== _CameraProperty.MoveRelative) {
      return null;
    }
    return this._wheelYActionCoordinate;
  }
  /**
   * Set which movement axis (relative to camera's orientation) the mouse
   * wheel's Z axis controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelZMoveRelative(axis) {
    if (axis === null && this._wheelZAction !== _CameraProperty.MoveRelative) {
      return;
    }
    this._wheelZAction = _CameraProperty.MoveRelative;
    this._wheelZActionCoordinate = axis;
  }
  /**
   * Get the configured movement axis (relative to camera's orientation) the
   * mouse wheel's Z axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelZMoveRelative() {
    if (this._wheelZAction !== _CameraProperty.MoveRelative) {
      return null;
    }
    return this._wheelZActionCoordinate;
  }
  /**
   * Set which rotation axis (relative to camera's orientation) the mouse
   * wheel's X axis controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelXRotateRelative(axis) {
    if (axis === null && this._wheelXAction !== _CameraProperty.RotateRelative) {
      return;
    }
    this._wheelXAction = _CameraProperty.RotateRelative;
    this._wheelXActionCoordinate = axis;
  }
  /**
   * Get the configured rotation axis (relative to camera's orientation) the
   * mouse wheel's X axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelXRotateRelative() {
    if (this._wheelXAction !== _CameraProperty.RotateRelative) {
      return null;
    }
    return this._wheelXActionCoordinate;
  }
  /**
   * Set which rotation axis (relative to camera's orientation) the mouse
   * wheel's Y axis controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelYRotateRelative(axis) {
    if (axis === null && this._wheelYAction !== _CameraProperty.RotateRelative) {
      return;
    }
    this._wheelYAction = _CameraProperty.RotateRelative;
    this._wheelYActionCoordinate = axis;
  }
  /**
   * Get the configured rotation axis (relative to camera's orientation) the
   * mouse wheel's Y axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelYRotateRelative() {
    if (this._wheelYAction !== _CameraProperty.RotateRelative) {
      return null;
    }
    return this._wheelYActionCoordinate;
  }
  /**
   * Set which rotation axis (relative to camera's orientation) the mouse
   * wheel's Z axis controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelZRotateRelative(axis) {
    if (axis === null && this._wheelZAction !== _CameraProperty.RotateRelative) {
      return;
    }
    this._wheelZAction = _CameraProperty.RotateRelative;
    this._wheelZActionCoordinate = axis;
  }
  /**
   * Get the configured rotation axis (relative to camera's orientation) the
   * mouse wheel's Z axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelZRotateRelative() {
    if (this._wheelZAction !== _CameraProperty.RotateRelative) {
      return null;
    }
    return this._wheelZActionCoordinate;
  }
  /**
   * Set which movement axis (relative to the scene) the mouse wheel's X axis
   * controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelXMoveScene(axis) {
    if (axis === null && this._wheelXAction !== _CameraProperty.MoveScene) {
      return;
    }
    this._wheelXAction = _CameraProperty.MoveScene;
    this._wheelXActionCoordinate = axis;
  }
  /**
   * Get the configured movement axis (relative to the scene) the mouse wheel's
   * X axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelXMoveScene() {
    if (this._wheelXAction !== _CameraProperty.MoveScene) {
      return null;
    }
    return this._wheelXActionCoordinate;
  }
  /**
   * Set which movement axis (relative to the scene) the mouse wheel's Y axis
   * controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelYMoveScene(axis) {
    if (axis === null && this._wheelYAction !== _CameraProperty.MoveScene) {
      return;
    }
    this._wheelYAction = _CameraProperty.MoveScene;
    this._wheelYActionCoordinate = axis;
  }
  /**
   * Get the configured movement axis (relative to the scene) the mouse wheel's
   * Y axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelYMoveScene() {
    if (this._wheelYAction !== _CameraProperty.MoveScene) {
      return null;
    }
    return this._wheelYActionCoordinate;
  }
  /**
   * Set which movement axis (relative to the scene) the mouse wheel's Z axis
   * controls.
   * @param axis The axis to be moved. Set null to clear.
   */
  set wheelZMoveScene(axis) {
    if (axis === null && this._wheelZAction !== _CameraProperty.MoveScene) {
      return;
    }
    this._wheelZAction = _CameraProperty.MoveScene;
    this._wheelZActionCoordinate = axis;
  }
  /**
   * Get the configured movement axis (relative to the scene) the mouse wheel's
   * Z axis controls.
   * @returns The configured axis or null if none.
   */
  get wheelZMoveScene() {
    if (this._wheelZAction !== _CameraProperty.MoveScene) {
      return null;
    }
    return this._wheelZActionCoordinate;
  }
  /**
   * Called for each rendered frame.
   */
  checkInputs() {
    if (this._wheelDeltaX === 0 && this._wheelDeltaY === 0 && this._wheelDeltaZ == 0) {
      return;
    }
    this._moveRelative.setAll(0);
    this._rotateRelative.setAll(0);
    this._moveScene.setAll(0);
    this._updateCamera();
    if (this.camera.getScene().useRightHandedSystem) {
      this._moveRelative.z *= -1;
    }
    const cameraTransformMatrix = Matrix.Zero();
    this.camera.getViewMatrix().invertToRef(cameraTransformMatrix);
    const transformedDirection = Vector3.Zero();
    Vector3.TransformNormalToRef(this._moveRelative, cameraTransformMatrix, transformedDirection);
    this.camera.cameraRotation.x += this._rotateRelative.x / 200;
    this.camera.cameraRotation.y += this._rotateRelative.y / 200;
    this.camera.cameraDirection.addInPlace(transformedDirection);
    this.camera.cameraDirection.addInPlace(this._moveScene);
    super.checkInputs();
  }
  /**
   * Update the camera according to any configured properties for the 3
   * mouse-wheel axis.
   */
  _updateCamera() {
    this._updateCameraProperty(this._wheelDeltaX, this._wheelXAction, this._wheelXActionCoordinate);
    this._updateCameraProperty(this._wheelDeltaY, this._wheelYAction, this._wheelYActionCoordinate);
    this._updateCameraProperty(this._wheelDeltaZ, this._wheelZAction, this._wheelZActionCoordinate);
  }
  /**
   * Update one property of the camera.
   * @param value
   * @param cameraProperty
   * @param coordinate
   */
  _updateCameraProperty(value, cameraProperty, coordinate) {
    if (value === 0) {
      return;
    }
    if (cameraProperty === null || coordinate === null) {
      return;
    }
    let action = null;
    switch (cameraProperty) {
      case _CameraProperty.MoveRelative:
        action = this._moveRelative;
        break;
      case _CameraProperty.RotateRelative:
        action = this._rotateRelative;
        break;
      case _CameraProperty.MoveScene:
        action = this._moveScene;
        break;
    }
    switch (coordinate) {
      case 0:
        action.set(value, 0, 0);
        break;
      case 1:
        action.set(0, value, 0);
        break;
      case 2:
        action.set(0, 0, value);
        break;
    }
  }
};
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelXMoveRelative", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelYMoveRelative", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelZMoveRelative", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelXRotateRelative", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelYRotateRelative", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelZRotateRelative", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelXMoveScene", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelYMoveScene", null);
__decorate([
  serialize()
], FreeCameraMouseWheelInput.prototype, "wheelZMoveScene", null);
CameraInputTypes["FreeCameraMouseWheelInput"] = FreeCameraMouseWheelInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/Inputs/freeCameraTouchInput.js
var FreeCameraTouchInput = class {
  /**
   * Manage the touch inputs to control the movement of a free camera.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/customizingCameraInputs
   * @param allowMouse Defines if mouse events can be treated as touch events
   */
  constructor(allowMouse = false) {
    this.allowMouse = allowMouse;
    this.touchAngularSensibility = 2e5;
    this.touchMoveSensibility = 250;
    this.singleFingerRotate = false;
    this._offsetX = null;
    this._offsetY = null;
    this._pointerPressed = new Array();
    this._isSafari = Tools.IsSafari();
  }
  /**
   * Attach the input controls to a specific dom element to get the input from.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachControl(noPreventDefault) {
    noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
    let previousPosition = null;
    if (this._pointerInput === void 0) {
      this._onLostFocus = () => {
        this._offsetX = null;
        this._offsetY = null;
      };
      this._pointerInput = (p) => {
        const evt = p.event;
        const isMouseEvent = evt.pointerType === "mouse" || this._isSafari && typeof evt.pointerType === "undefined";
        if (!this.allowMouse && isMouseEvent) {
          return;
        }
        if (p.type === PointerEventTypes.POINTERDOWN) {
          if (!noPreventDefault) {
            evt.preventDefault();
          }
          this._pointerPressed.push(evt.pointerId);
          if (this._pointerPressed.length !== 1) {
            return;
          }
          previousPosition = {
            x: evt.clientX,
            y: evt.clientY
          };
        } else if (p.type === PointerEventTypes.POINTERUP) {
          if (!noPreventDefault) {
            evt.preventDefault();
          }
          const index = this._pointerPressed.indexOf(evt.pointerId);
          if (index === -1) {
            return;
          }
          this._pointerPressed.splice(index, 1);
          if (index != 0) {
            return;
          }
          previousPosition = null;
          this._offsetX = null;
          this._offsetY = null;
        } else if (p.type === PointerEventTypes.POINTERMOVE) {
          if (!noPreventDefault) {
            evt.preventDefault();
          }
          if (!previousPosition) {
            return;
          }
          const index = this._pointerPressed.indexOf(evt.pointerId);
          if (index != 0) {
            return;
          }
          this._offsetX = evt.clientX - previousPosition.x;
          this._offsetY = -(evt.clientY - previousPosition.y);
        }
      };
    }
    this._observer = this.camera.getScene()._inputManager._addCameraPointerObserver(this._pointerInput, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP | PointerEventTypes.POINTERMOVE);
    if (this._onLostFocus) {
      const engine = this.camera.getEngine();
      const element = engine.getInputElement();
      if (element) {
        element.addEventListener("blur", this._onLostFocus);
      }
    }
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    if (this._pointerInput) {
      if (this._observer) {
        this.camera.getScene()._inputManager._removeCameraPointerObserver(this._observer);
        this._observer = null;
      }
      if (this._onLostFocus) {
        const engine = this.camera.getEngine();
        const element = engine.getInputElement();
        if (element) {
          element.removeEventListener("blur", this._onLostFocus);
        }
        this._onLostFocus = null;
      }
      this._pointerPressed.length = 0;
      this._offsetX = null;
      this._offsetY = null;
    }
  }
  /**
   * Update the current camera state depending on the inputs that have been used this frame.
   * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
   */
  checkInputs() {
    if (this._offsetX === null || this._offsetY === null) {
      return;
    }
    if (this._offsetX === 0 && this._offsetY === 0) {
      return;
    }
    const camera = this.camera;
    const handednessMultiplier = camera._calculateHandednessMultiplier();
    camera.cameraRotation.y = this._offsetX * handednessMultiplier / this.touchAngularSensibility;
    const rotateCamera = this.singleFingerRotate && this._pointerPressed.length === 1 || !this.singleFingerRotate && this._pointerPressed.length > 1;
    if (rotateCamera) {
      camera.cameraRotation.x = -(this._offsetY * handednessMultiplier) / this.touchAngularSensibility;
    } else {
      const speed = camera._computeLocalCameraSpeed();
      const direction = new Vector3(0, 0, this.touchMoveSensibility !== 0 ? speed * this._offsetY / this.touchMoveSensibility : 0);
      Matrix.RotationYawPitchRollToRef(camera.rotation.y, camera.rotation.x, 0, camera._cameraRotationMatrix);
      camera.cameraDirection.addInPlace(Vector3.TransformCoordinates(direction, camera._cameraRotationMatrix));
    }
  }
  /**
   * Gets the class name of the current input.
   * @returns the class name
   */
  getClassName() {
    return "FreeCameraTouchInput";
  }
  /**
   * Get the friendly name associated with the input class.
   * @returns the input friendly name
   */
  getSimpleName() {
    return "touch";
  }
};
__decorate([
  serialize()
], FreeCameraTouchInput.prototype, "touchAngularSensibility", void 0);
__decorate([
  serialize()
], FreeCameraTouchInput.prototype, "touchMoveSensibility", void 0);
CameraInputTypes["FreeCameraTouchInput"] = FreeCameraTouchInput;

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/freeCameraInputsManager.js
var FreeCameraInputsManager = class extends CameraInputsManager {
  /**
   * Instantiates a new FreeCameraInputsManager.
   * @param camera Defines the camera the inputs belong to
   */
  constructor(camera) {
    super(camera);
    this._mouseInput = null;
    this._mouseWheelInput = null;
  }
  /**
   * Add keyboard input support to the input manager.
   * @returns the current input manager
   */
  addKeyboard() {
    this.add(new FreeCameraKeyboardMoveInput());
    return this;
  }
  /**
   * Add mouse input support to the input manager.
   * @param touchEnabled if the FreeCameraMouseInput should support touch (default: true)
   * @returns the current input manager
   */
  addMouse(touchEnabled = true) {
    if (!this._mouseInput) {
      this._mouseInput = new FreeCameraMouseInput(touchEnabled);
      this.add(this._mouseInput);
    }
    return this;
  }
  /**
   * Removes the mouse input support from the manager
   * @returns the current input manager
   */
  removeMouse() {
    if (this._mouseInput) {
      this.remove(this._mouseInput);
    }
    return this;
  }
  /**
   * Add mouse wheel input support to the input manager.
   * @returns the current input manager
   */
  addMouseWheel() {
    if (!this._mouseWheelInput) {
      this._mouseWheelInput = new FreeCameraMouseWheelInput();
      this.add(this._mouseWheelInput);
    }
    return this;
  }
  /**
   * Removes the mouse wheel input support from the manager
   * @returns the current input manager
   */
  removeMouseWheel() {
    if (this._mouseWheelInput) {
      this.remove(this._mouseWheelInput);
    }
    return this;
  }
  /**
   * Add touch input support to the input manager.
   * @returns the current input manager
   */
  addTouch() {
    this.add(new FreeCameraTouchInput());
    return this;
  }
  /**
   * Remove all attached input methods from a camera
   */
  clear() {
    super.clear();
    this._mouseInput = null;
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Cameras/freeCamera.js
var FreeCamera = class extends TargetCamera {
  /**
   * Gets the input sensibility for a mouse input. (default is 2000.0)
   * Higher values reduce sensitivity.
   */
  get angularSensibility() {
    const mouse = this.inputs.attached["mouse"];
    if (mouse) {
      return mouse.angularSensibility;
    }
    return 0;
  }
  /**
   * Sets the input sensibility for a mouse input. (default is 2000.0)
   * Higher values reduce sensitivity.
   */
  set angularSensibility(value) {
    const mouse = this.inputs.attached["mouse"];
    if (mouse) {
      mouse.angularSensibility = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the forward move of the camera.
   */
  get keysUp() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysUp;
    }
    return [];
  }
  set keysUp(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysUp = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the upward move of the camera.
   */
  get keysUpward() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysUpward;
    }
    return [];
  }
  set keysUpward(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysUpward = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the backward move of the camera.
   */
  get keysDown() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysDown;
    }
    return [];
  }
  set keysDown(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysDown = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the downward move of the camera.
   */
  get keysDownward() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysDownward;
    }
    return [];
  }
  set keysDownward(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysDownward = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the left strafe move of the camera.
   */
  get keysLeft() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysLeft;
    }
    return [];
  }
  set keysLeft(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysLeft = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the right strafe move of the camera.
   */
  get keysRight() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysRight;
    }
    return [];
  }
  set keysRight(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysRight = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the left rotation move of the camera.
   */
  get keysRotateLeft() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysRotateLeft;
    }
    return [];
  }
  set keysRotateLeft(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysRotateLeft = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the right rotation move of the camera.
   */
  get keysRotateRight() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysRotateRight;
    }
    return [];
  }
  set keysRotateRight(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysRotateRight = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the up rotation move of the camera.
   */
  get keysRotateUp() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysRotateUp;
    }
    return [];
  }
  set keysRotateUp(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysRotateUp = value;
    }
  }
  /**
   * Gets or Set the list of keyboard keys used to control the down rotation move of the camera.
   */
  get keysRotateDown() {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      return keyboard.keysRotateDown;
    }
    return [];
  }
  set keysRotateDown(value) {
    const keyboard = this.inputs.attached["keyboard"];
    if (keyboard) {
      keyboard.keysRotateDown = value;
    }
  }
  /**
   * Instantiates a Free Camera.
   * This represents a free type of camera. It can be useful in First Person Shooter game for instance.
   * Please consider using the new UniversalCamera instead as it adds more functionality like touch to this camera.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_introduction#universal-camera
   * @param name Define the name of the camera in the scene
   * @param position Define the start position of the camera in the scene
   * @param scene Define the scene the camera belongs to
   * @param setActiveOnSceneIfNoneActive Defines whether the camera should be marked as active if not other active cameras have been defined
   */
  constructor(name, position, scene, setActiveOnSceneIfNoneActive = true) {
    super(name, position, scene, setActiveOnSceneIfNoneActive);
    this.ellipsoid = new Vector3(0.5, 1, 0.5);
    this.ellipsoidOffset = new Vector3(0, 0, 0);
    this.checkCollisions = false;
    this.applyGravity = false;
    this._needMoveForGravity = false;
    this._oldPosition = Vector3.Zero();
    this._diffPosition = Vector3.Zero();
    this._newPosition = Vector3.Zero();
    this._collisionMask = -1;
    this._onCollisionPositionChange = (collisionId, newPosition, collidedMesh = null) => {
      this._newPosition.copyFrom(newPosition);
      this._newPosition.subtractToRef(this._oldPosition, this._diffPosition);
      if (this._diffPosition.length() > AbstractEngine.CollisionsEpsilon) {
        this.position.addToRef(this._diffPosition, this._deferredPositionUpdate);
        if (!this._deferOnly) {
          this.position.copyFrom(this._deferredPositionUpdate);
        } else {
          this._deferredUpdated = true;
        }
        if (this.onCollide && collidedMesh) {
          this.onCollide(collidedMesh);
        }
      }
    };
    this.inputs = new FreeCameraInputsManager(this);
    this.inputs.addKeyboard().addMouse();
  }
  /**
   * Attached controls to the current camera.
   * @param ignored defines an ignored parameter kept for backward compatibility.
   * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
   */
  attachControl(ignored, noPreventDefault) {
    noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
    this.inputs.attachElement(noPreventDefault);
  }
  /**
   * Detach the current controls from the specified dom element.
   */
  detachControl() {
    this.inputs.detachElement();
    this.cameraDirection = new Vector3(0, 0, 0);
    this.cameraRotation = new Vector2(0, 0);
  }
  /**
   * Define a collision mask to limit the list of object the camera can collide with
   */
  get collisionMask() {
    return this._collisionMask;
  }
  set collisionMask(mask) {
    this._collisionMask = !isNaN(mask) ? mask : -1;
  }
  /**
   * @internal
   */
  _collideWithWorld(displacement) {
    let globalPosition;
    if (this.parent) {
      globalPosition = Vector3.TransformCoordinates(this.position, this.parent.getWorldMatrix());
    } else {
      globalPosition = this.position;
    }
    globalPosition.subtractFromFloatsToRef(0, this.ellipsoid.y, 0, this._oldPosition);
    this._oldPosition.addInPlace(this.ellipsoidOffset);
    const coordinator = this.getScene().collisionCoordinator;
    if (!this._collider) {
      this._collider = coordinator.createCollider();
    }
    this._collider._radius = this.ellipsoid;
    this._collider.collisionMask = this._collisionMask;
    let actualDisplacement = displacement;
    if (this.applyGravity) {
      actualDisplacement = displacement.add(this.getScene().gravity);
    }
    coordinator.getNewPosition(this._oldPosition, actualDisplacement, this._collider, 3, null, this._onCollisionPositionChange, this.uniqueId);
  }
  /** @internal */
  _checkInputs() {
    if (!this._localDirection) {
      this._localDirection = Vector3.Zero();
      this._transformedDirection = Vector3.Zero();
    }
    this.inputs.checkInputs();
    super._checkInputs();
  }
  /**
   * Enable movement without a user input. This allows gravity to always be applied.
   */
  set needMoveForGravity(value) {
    this._needMoveForGravity = value;
  }
  /**
   * When true, gravity is applied whether there is user input or not.
   */
  get needMoveForGravity() {
    return this._needMoveForGravity;
  }
  /** @internal */
  _decideIfNeedsToMove() {
    return this._needMoveForGravity || Math.abs(this.cameraDirection.x) > 0 || Math.abs(this.cameraDirection.y) > 0 || Math.abs(this.cameraDirection.z) > 0;
  }
  /** @internal */
  _updatePosition() {
    if (this.checkCollisions && this.getScene().collisionsEnabled) {
      this._collideWithWorld(this.cameraDirection);
    } else {
      super._updatePosition();
    }
  }
  /**
   * Destroy the camera and release the current resources hold by it.
   */
  dispose() {
    this.inputs.clear();
    super.dispose();
  }
  /**
   * Gets the current object class name.
   * @returns the class name
   */
  getClassName() {
    return "FreeCamera";
  }
};
__decorate([
  serializeAsVector3()
], FreeCamera.prototype, "ellipsoid", void 0);
__decorate([
  serializeAsVector3()
], FreeCamera.prototype, "ellipsoidOffset", void 0);
__decorate([
  serialize()
], FreeCamera.prototype, "checkCollisions", void 0);
__decorate([
  serialize()
], FreeCamera.prototype, "applyGravity", void 0);
RegisterClass("BABYLON.FreeCamera", FreeCamera);

export {
  CameraInputTypes,
  CameraInputsManager,
  FreeCameraInputsManager,
  FreeCamera
};
//# sourceMappingURL=chunk-KKOGFWJG.js.map
