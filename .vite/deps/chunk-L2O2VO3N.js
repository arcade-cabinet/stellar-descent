import {
  Constants
} from "./chunk-FRAXHGNO.js";
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import {
  ShadowLight
} from "./chunk-4GRRZ6NS.js";
import {
  Light
} from "./chunk-7EDSNBQ5.js";
import {
  Animation
} from "./chunk-CBWHP7JG.js";
import {
  Node
} from "./chunk-D664DUZM.js";
import {
  __decorate,
  serialize,
  serializeAsTexture
} from "./chunk-STIKNZXL.js";
import {
  Color4
} from "./chunk-I3IYKWNG.js";
import {
  Matrix,
  Quaternion,
  Vector2,
  Vector3
} from "./chunk-YLLTSBLI.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Lights/spotLight.js
Node.AddNodeConstructor("Light_Type_2", (name, scene) => {
  return () => new SpotLight(name, Vector3.Zero(), Vector3.Zero(), 0, 0, scene);
});
var SpotLight = class _SpotLight extends ShadowLight {
  /**
   * Gets or sets the IES profile texture used to create the spotlight
   * @see https://playground.babylonjs.com/#UIAXAU#1
   */
  get iesProfileTexture() {
    return this._iesProfileTexture;
  }
  set iesProfileTexture(value) {
    if (this._iesProfileTexture === value) {
      return;
    }
    this._iesProfileTexture = value;
    if (this._iesProfileTexture && _SpotLight._IsTexture(this._iesProfileTexture)) {
      this._iesProfileTexture.onLoadObservable.addOnce(() => {
        this._markMeshesAsLightDirty();
      });
    }
  }
  /**
   * Gets the cone angle of the spot light in Radians.
   */
  get angle() {
    return this._angle;
  }
  /**
   * Sets the cone angle of the spot light in Radians.
   */
  set angle(value) {
    this._angle = value;
    this._cosHalfAngle = Math.cos(value * 0.5);
    this._projectionTextureProjectionLightDirty = true;
    this.forceProjectionMatrixCompute();
    this._computeAngleValues();
  }
  /**
   * Only used in gltf falloff mode, this defines the angle where
   * the directional falloff will start before cutting at angle which could be seen
   * as outer angle.
   */
  get innerAngle() {
    return this._innerAngle;
  }
  /**
   * Only used in gltf falloff mode, this defines the angle where
   * the directional falloff will start before cutting at angle which could be seen
   * as outer angle.
   */
  set innerAngle(value) {
    this._innerAngle = value;
    this._computeAngleValues();
  }
  /**
   * Allows scaling the angle of the light for shadow generation only.
   */
  get shadowAngleScale() {
    return this._shadowAngleScale;
  }
  /**
   * Allows scaling the angle of the light for shadow generation only.
   */
  set shadowAngleScale(value) {
    this._shadowAngleScale = value;
    this.forceProjectionMatrixCompute();
  }
  /**
   * Allows reading the projection texture
   */
  get projectionTextureMatrix() {
    return this._projectionTextureMatrix;
  }
  /**
   * Gets the near clip of the Spotlight for texture projection.
   */
  get projectionTextureLightNear() {
    return this._projectionTextureLightNear;
  }
  /**
   * Sets the near clip of the Spotlight for texture projection.
   */
  set projectionTextureLightNear(value) {
    this._projectionTextureLightNear = value;
    this._projectionTextureProjectionLightDirty = true;
  }
  /**
   * Gets the far clip of the Spotlight for texture projection.
   */
  get projectionTextureLightFar() {
    return this._projectionTextureLightFar;
  }
  /**
   * Sets the far clip of the Spotlight for texture projection.
   */
  set projectionTextureLightFar(value) {
    this._projectionTextureLightFar = value;
    this._projectionTextureProjectionLightDirty = true;
  }
  /**
   * Gets the Up vector of the Spotlight for texture projection.
   */
  get projectionTextureUpDirection() {
    return this._projectionTextureUpDirection;
  }
  /**
   * Sets the Up vector of the Spotlight for texture projection.
   */
  set projectionTextureUpDirection(value) {
    this._projectionTextureUpDirection = value;
    this._projectionTextureProjectionLightDirty = true;
  }
  /**
   * Gets the projection texture of the light.
   */
  get projectionTexture() {
    return this._projectionTexture;
  }
  /**
   * Sets the projection texture of the light.
   */
  set projectionTexture(value) {
    if (this._projectionTexture === value) {
      return;
    }
    this._projectionTexture = value;
    this._projectionTextureDirty = true;
    if (this._projectionTexture && !this._projectionTexture.isReady()) {
      if (_SpotLight._IsProceduralTexture(this._projectionTexture)) {
        this._projectionTexture.getEffect().executeWhenCompiled(() => {
          this._markMeshesAsLightDirty();
        });
      } else if (_SpotLight._IsTexture(this._projectionTexture)) {
        this._projectionTexture.onLoadObservable.addOnce(() => {
          this._markMeshesAsLightDirty();
        });
      }
    }
  }
  static _IsProceduralTexture(texture) {
    return texture.onGeneratedObservable !== void 0;
  }
  static _IsTexture(texture) {
    return texture.onLoadObservable !== void 0;
  }
  /**
   * Gets or sets the light projection matrix as used by the projection texture
   */
  get projectionTextureProjectionLightMatrix() {
    return this._projectionTextureProjectionLightMatrix;
  }
  set projectionTextureProjectionLightMatrix(projection) {
    this._projectionTextureProjectionLightMatrix = projection;
    this._projectionTextureProjectionLightDirty = false;
    this._projectionTextureDirty = true;
  }
  /**
   * Creates a SpotLight object in the scene. A spot light is a simply light oriented cone.
   * It can cast shadows.
   * Documentation : https://doc.babylonjs.com/features/featuresDeepDive/lights/lights_introduction
   * @param name The light friendly name
   * @param position The position of the spot light in the scene
   * @param direction The direction of the light in the scene
   * @param angle The cone angle of the light in Radians
   * @param exponent The light decay speed with the distance from the emission spot
   * @param scene The scene the lights belongs to
   * @param dontAddToScene True to not add the light to the scene
   */
  constructor(name, position, direction, angle, exponent, scene, dontAddToScene) {
    super(name, scene, dontAddToScene);
    this._innerAngle = 0;
    this._iesProfileTexture = null;
    this._projectionTextureMatrix = Matrix.Zero();
    this._projectionTextureLightNear = 1e-6;
    this._projectionTextureLightFar = 1e3;
    this._projectionTextureUpDirection = Vector3.Up();
    this._projectionTextureViewLightDirty = true;
    this._projectionTextureProjectionLightDirty = true;
    this._projectionTextureDirty = true;
    this._projectionTextureViewTargetVector = Vector3.Zero();
    this._projectionTextureViewLightMatrix = Matrix.Zero();
    this._projectionTextureProjectionLightMatrix = Matrix.Zero();
    this._projectionTextureScalingMatrix = Matrix.FromValues(0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1);
    this.position = position;
    this.direction = direction;
    this.angle = angle;
    this.exponent = exponent;
  }
  /**
   * Returns the string "SpotLight".
   * @returns the class name
   */
  getClassName() {
    return "SpotLight";
  }
  /**
   * Returns the integer 2.
   * @returns The light Type id as a constant defines in Light.LIGHTTYPEID_x
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  getTypeID() {
    return Light.LIGHTTYPEID_SPOTLIGHT;
  }
  /**
   * Overrides the direction setter to recompute the projection texture view light Matrix.
   * @param value
   */
  _setDirection(value) {
    super._setDirection(value);
    this._projectionTextureViewLightDirty = true;
  }
  /**
   * Overrides the position setter to recompute the projection texture view light Matrix.
   * @param value
   */
  _setPosition(value) {
    super._setPosition(value);
    this._projectionTextureViewLightDirty = true;
  }
  /**
   * Sets the passed matrix "matrix" as perspective projection matrix for the shadows and the passed view matrix with the fov equal to the SpotLight angle and and aspect ratio of 1.0.
   * Returns the SpotLight.
   * @param matrix
   * @param viewMatrix
   * @param renderList
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _setDefaultShadowProjectionMatrix(matrix, viewMatrix, renderList) {
    const activeCamera = this.getScene().activeCamera;
    if (!activeCamera) {
      return;
    }
    this._shadowAngleScale = this._shadowAngleScale || 1;
    const angle = this._shadowAngleScale * this._angle;
    const minZ = this.shadowMinZ !== void 0 ? this.shadowMinZ : activeCamera.minZ;
    const maxZ = this.shadowMaxZ !== void 0 ? this.shadowMaxZ : activeCamera.maxZ;
    const useReverseDepthBuffer = this.getScene().getEngine().useReverseDepthBuffer;
    Matrix.PerspectiveFovLHToRef(angle, 1, useReverseDepthBuffer ? maxZ : minZ, useReverseDepthBuffer ? minZ : maxZ, matrix, true, this._scene.getEngine().isNDCHalfZRange, void 0, useReverseDepthBuffer);
  }
  _computeProjectionTextureViewLightMatrix() {
    this._projectionTextureViewLightDirty = false;
    this._projectionTextureDirty = true;
    this.getAbsolutePosition().addToRef(this.getShadowDirection(), this._projectionTextureViewTargetVector);
    Matrix.LookAtLHToRef(this.getAbsolutePosition(), this._projectionTextureViewTargetVector, this._projectionTextureUpDirection, this._projectionTextureViewLightMatrix);
  }
  _computeProjectionTextureProjectionLightMatrix() {
    this._projectionTextureProjectionLightDirty = false;
    this._projectionTextureDirty = true;
    const lightFar = this.projectionTextureLightFar;
    const lightNear = this.projectionTextureLightNear;
    const p = lightFar / (lightFar - lightNear);
    const q = -p * lightNear;
    const s = 1 / Math.tan(this._angle / 2);
    const a = 1;
    Matrix.FromValuesToRef(s / a, 0, 0, 0, 0, s, 0, 0, 0, 0, p, 1, 0, 0, q, 0, this._projectionTextureProjectionLightMatrix);
  }
  /**
   * Main function for light texture projection matrix computing.
   */
  _computeProjectionTextureMatrix() {
    this._projectionTextureDirty = false;
    this._projectionTextureViewLightMatrix.multiplyToRef(this._projectionTextureProjectionLightMatrix, this._projectionTextureMatrix);
    if (this._projectionTexture instanceof Texture) {
      const u = this._projectionTexture.uScale / 2;
      const v = this._projectionTexture.vScale / 2;
      Matrix.FromValuesToRef(u, 0, 0, 0, 0, v, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1, this._projectionTextureScalingMatrix);
    }
    this._projectionTextureMatrix.multiplyToRef(this._projectionTextureScalingMatrix, this._projectionTextureMatrix);
  }
  _buildUniformLayout() {
    this._uniformBuffer.addUniform("vLightData", 4);
    this._uniformBuffer.addUniform("vLightDiffuse", 4);
    this._uniformBuffer.addUniform("vLightSpecular", 4);
    this._uniformBuffer.addUniform("vLightDirection", 3);
    this._uniformBuffer.addUniform("vLightFalloff", 4);
    this._uniformBuffer.addUniform("shadowsInfo", 3);
    this._uniformBuffer.addUniform("depthValues", 2);
    this._uniformBuffer.create();
  }
  _computeAngleValues() {
    this._lightAngleScale = 1 / Math.max(1e-3, Math.cos(this._innerAngle * 0.5) - this._cosHalfAngle);
    this._lightAngleOffset = -this._cosHalfAngle * this._lightAngleScale;
  }
  /**
   * Sets the passed Effect "effect" with the Light textures.
   * @param effect The effect to update
   * @param lightIndex The index of the light in the effect to update
   * @returns The light
   */
  transferTexturesToEffect(effect, lightIndex) {
    if (this.projectionTexture && this.projectionTexture.isReady()) {
      if (this._projectionTextureViewLightDirty) {
        this._computeProjectionTextureViewLightMatrix();
      }
      if (this._projectionTextureProjectionLightDirty) {
        this._computeProjectionTextureProjectionLightMatrix();
      }
      if (this._projectionTextureDirty) {
        this._computeProjectionTextureMatrix();
      }
      effect.setMatrix("textureProjectionMatrix" + lightIndex, this._projectionTextureMatrix);
      effect.setTexture("projectionLightTexture" + lightIndex, this.projectionTexture);
    }
    if (this._iesProfileTexture && this._iesProfileTexture.isReady()) {
      effect.setTexture("iesLightTexture" + lightIndex, this._iesProfileTexture);
    }
    return this;
  }
  /**
   * Sets the passed Effect object with the SpotLight transformed position (or position if not parented) and normalized direction.
   * @param effect The effect to update
   * @param lightIndex The index of the light in the effect to update
   * @returns The spot light
   */
  transferToEffect(effect, lightIndex) {
    let normalizeDirection;
    const offset = this._scene.floatingOriginOffset;
    if (this.computeTransformedInformation()) {
      this._uniformBuffer.updateFloat4("vLightData", this.transformedPosition.x - offset.x, this.transformedPosition.y - offset.y, this.transformedPosition.z - offset.z, this.exponent, lightIndex);
      normalizeDirection = Vector3.Normalize(this.transformedDirection);
    } else {
      this._uniformBuffer.updateFloat4("vLightData", this.position.x - offset.x, this.position.y - offset.y, this.position.z - offset.z, this.exponent, lightIndex);
      normalizeDirection = Vector3.Normalize(this.direction);
    }
    this._uniformBuffer.updateFloat4("vLightDirection", normalizeDirection.x, normalizeDirection.y, normalizeDirection.z, this._cosHalfAngle, lightIndex);
    this._uniformBuffer.updateFloat4("vLightFalloff", this.range, this._inverseSquaredRange, this._lightAngleScale, this._lightAngleOffset, lightIndex);
    return this;
  }
  transferToNodeMaterialEffect(effect, lightDataUniformName) {
    let normalizeDirection;
    if (this.computeTransformedInformation()) {
      normalizeDirection = Vector3.Normalize(this.transformedDirection);
    } else {
      normalizeDirection = Vector3.Normalize(this.direction);
    }
    if (this.getScene().useRightHandedSystem) {
      effect.setFloat3(lightDataUniformName, -normalizeDirection.x, -normalizeDirection.y, -normalizeDirection.z);
    } else {
      effect.setFloat3(lightDataUniformName, normalizeDirection.x, normalizeDirection.y, normalizeDirection.z);
    }
    return this;
  }
  /**
   * Disposes the light and the associated resources.
   */
  dispose() {
    super.dispose();
    if (this._projectionTexture) {
      this._projectionTexture.dispose();
    }
    if (this._iesProfileTexture) {
      this._iesProfileTexture.dispose();
      this._iesProfileTexture = null;
    }
  }
  /**
   * Gets the minZ used for shadow according to both the scene and the light.
   * @param activeCamera The camera we are returning the min for
   * @returns the depth min z
   */
  getDepthMinZ(activeCamera) {
    const engine = this._scene.getEngine();
    const minZ = this.shadowMinZ !== void 0 ? this.shadowMinZ : activeCamera?.minZ ?? 0;
    return engine.useReverseDepthBuffer && engine.isNDCHalfZRange ? minZ : this._scene.getEngine().isNDCHalfZRange ? 0 : minZ;
  }
  /**
   * Gets the maxZ used for shadow according to both the scene and the light.
   * @param activeCamera The camera we are returning the max for
   * @returns the depth max z
   */
  getDepthMaxZ(activeCamera) {
    const engine = this._scene.getEngine();
    const maxZ = this.shadowMaxZ !== void 0 ? this.shadowMaxZ : activeCamera?.maxZ ?? 1e4;
    return engine.useReverseDepthBuffer && engine.isNDCHalfZRange ? 0 : maxZ;
  }
  /**
   * Prepares the list of defines specific to the light type.
   * @param defines the list of defines
   * @param lightIndex defines the index of the light for the effect
   */
  prepareLightSpecificDefines(defines, lightIndex) {
    defines["SPOTLIGHT" + lightIndex] = true;
    defines["PROJECTEDLIGHTTEXTURE" + lightIndex] = this.projectionTexture && this.projectionTexture.isReady() ? true : false;
    defines["IESLIGHTTEXTURE" + lightIndex] = this._iesProfileTexture && this._iesProfileTexture.isReady() ? true : false;
  }
};
__decorate([
  serialize()
], SpotLight.prototype, "angle", null);
__decorate([
  serialize()
], SpotLight.prototype, "innerAngle", null);
__decorate([
  serialize()
], SpotLight.prototype, "shadowAngleScale", null);
__decorate([
  serialize()
], SpotLight.prototype, "exponent", void 0);
__decorate([
  serialize()
], SpotLight.prototype, "projectionTextureLightNear", null);
__decorate([
  serialize()
], SpotLight.prototype, "projectionTextureLightFar", null);
__decorate([
  serialize()
], SpotLight.prototype, "projectionTextureUpDirection", null);
__decorate([
  serializeAsTexture("projectedLightTexture")
], SpotLight.prototype, "_projectionTexture", void 0);
RegisterClass("BABYLON.SpotLight", SpotLight);

// node_modules/.pnpm/@babylonjs+loaders@8.49.1_@babylonjs+core@8.49.1_babylonjs-gltf2interface@8.49.1/node_modules/@babylonjs/loaders/glTF/2.0/Extensions/gltfPathToObjectConverter.js
var OptionalPathExceptionsList = [
  {
    // get the node as object when reading an extension
    regex: new RegExp(`^/nodes/\\d+/extensions/`)
  }
];
var GLTFPathToObjectConverter = class {
  constructor(_gltf, _infoTree) {
    this._gltf = _gltf;
    this._infoTree = _infoTree;
  }
  /**
   * The pointer string is represented by a [JSON pointer](https://datatracker.ietf.org/doc/html/rfc6901).
   * See also https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/ObjectModel.adoc#core-pointers
   * <animationPointer> := /<rootNode>/<assetIndex>/<propertyPath>
   * <rootNode> := "nodes" | "materials" | "meshes" | "cameras" | "extensions"
   * <assetIndex> := <digit> | <name>
   * <propertyPath> := <extensionPath> | <standardPath>
   * <extensionPath> := "extensions"/<name>/<standardPath>
   * <standardPath> := <name> | <name>/<standardPath>
   * <name> := W+
   * <digit> := D+
   *
   * Examples:
   *  - "/nodes/0/rotation"
   * - "/nodes.length"
   *  - "/materials/2/emissiveFactor"
   *  - "/materials/2/pbrMetallicRoughness/baseColorFactor"
   *  - "/materials/2/extensions/KHR_materials_emissive_strength/emissiveStrength"
   *
   * @param path The path to convert
   * @returns The object and info associated with the path
   */
  convert(path) {
    let objectTree = this._gltf;
    let infoTree = this._infoTree;
    let target = void 0;
    if (!path.startsWith("/")) {
      throw new Error("Path must start with a /");
    }
    const parts = path.split("/");
    parts.shift();
    if (parts[parts.length - 1].includes(".length")) {
      const lastPart = parts[parts.length - 1];
      const split = lastPart.split(".");
      parts.pop();
      parts.push(...split);
    }
    let ignoreObjectTree = false;
    for (const part of parts) {
      const isLength = part === "length";
      if (isLength && !infoTree.__array__) {
        throw new Error(`Path ${path} is invalid`);
      }
      if (infoTree.__ignoreObjectTree__) {
        ignoreObjectTree = true;
      }
      if (infoTree.__array__ && !isLength) {
        infoTree = infoTree.__array__;
      } else {
        infoTree = infoTree[part];
        if (!infoTree) {
          throw new Error(`Path ${path} is invalid`);
        }
      }
      if (!ignoreObjectTree) {
        if (objectTree === void 0) {
          const exception = OptionalPathExceptionsList.find((e) => e.regex.test(path));
          if (!exception) {
            throw new Error(`Path ${path} is invalid`);
          }
        } else if (!isLength) {
          objectTree = objectTree?.[part];
        }
      }
      if (infoTree.__target__ || isLength) {
        target = objectTree;
      }
    }
    return {
      object: target,
      info: infoTree
    };
  }
};

// node_modules/.pnpm/@babylonjs+loaders@8.49.1_@babylonjs+core@8.49.1_babylonjs-gltf2interface@8.49.1/node_modules/@babylonjs/loaders/glTF/2.0/Extensions/objectModelMapping.js
var nodesTree = {
  length: {
    type: "number",
    get: (nodes) => nodes.length,
    getTarget: (nodes) => nodes.map((node) => node._babylonTransformNode),
    getPropertyName: [() => "length"]
  },
  __array__: {
    __target__: true,
    translation: {
      type: "Vector3",
      get: (node) => node._babylonTransformNode?.position,
      set: (value, node) => node._babylonTransformNode?.position.copyFrom(value),
      getTarget: (node) => node._babylonTransformNode,
      getPropertyName: [() => "position"]
    },
    rotation: {
      type: "Quaternion",
      get: (node) => node._babylonTransformNode?.rotationQuaternion,
      set: (value, node) => node._babylonTransformNode?.rotationQuaternion?.copyFrom(value),
      getTarget: (node) => node._babylonTransformNode,
      getPropertyName: [() => "rotationQuaternion"]
    },
    scale: {
      type: "Vector3",
      get: (node) => node._babylonTransformNode?.scaling,
      set: (value, node) => node._babylonTransformNode?.scaling.copyFrom(value),
      getTarget: (node) => node._babylonTransformNode,
      getPropertyName: [() => "scaling"]
    },
    weights: {
      length: {
        type: "number",
        get: (node) => node._numMorphTargets,
        getTarget: (node) => node._babylonTransformNode,
        getPropertyName: [() => "influence"]
      },
      __array__: {
        __target__: true,
        type: "number",
        get: (node, index) => index !== void 0 ? node._primitiveBabylonMeshes?.[0].morphTargetManager?.getTarget(index).influence : void 0,
        // set: (value: number, node: INode, index?: number) => node._babylonTransformNode?.getMorphTargetManager()?.getTarget(index)?.setInfluence(value),
        getTarget: (node) => node._babylonTransformNode,
        getPropertyName: [() => "influence"]
      },
      type: "number[]",
      get: (node, index) => [0],
      // TODO: get the weights correctly
      // set: (value: number, node: INode, index?: number) => node._babylonTransformNode?.getMorphTargetManager()?.getTarget(index)?.setInfluence(value),
      getTarget: (node) => node._babylonTransformNode,
      getPropertyName: [() => "influence"]
    },
    // readonly!
    matrix: {
      type: "Matrix",
      get: (node) => Matrix.Compose(node._babylonTransformNode?.scaling, node._babylonTransformNode?.rotationQuaternion, node._babylonTransformNode?.position),
      getTarget: (node) => node._babylonTransformNode,
      isReadOnly: true
    },
    globalMatrix: {
      type: "Matrix",
      get: (node) => {
        const matrix = Matrix.Identity();
        let rootNode = node.parent;
        while (rootNode && rootNode.parent) {
          rootNode = rootNode.parent;
        }
        const forceUpdate = node._babylonTransformNode?.position._isDirty || node._babylonTransformNode?.rotationQuaternion?._isDirty || node._babylonTransformNode?.scaling._isDirty;
        if (rootNode) {
          const rootMatrix = rootNode._babylonTransformNode?.computeWorldMatrix(true).invert();
          if (rootMatrix) {
            node._babylonTransformNode?.computeWorldMatrix(forceUpdate)?.multiplyToRef(rootMatrix, matrix);
          }
        } else if (node._babylonTransformNode) {
          matrix.copyFrom(node._babylonTransformNode.computeWorldMatrix(forceUpdate));
        }
        return matrix;
      },
      getTarget: (node) => node._babylonTransformNode,
      isReadOnly: true
    },
    extensions: {
      EXT_lights_ies: {
        multiplier: {
          type: "number",
          get: (node) => {
            return node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0]?.intensity;
          },
          getTarget: (node) => node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0],
          set: (value, node) => {
            if (node._babylonTransformNode) {
              const light = node._babylonTransformNode.getChildren((child) => child instanceof SpotLight, true)[0];
              if (light) {
                light.intensity = value;
              }
            }
          }
        },
        color: {
          type: "Color3",
          get: (node) => {
            return node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0]?.diffuse;
          },
          getTarget: (node) => node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0],
          set: (value, node) => {
            if (node._babylonTransformNode) {
              const light = node._babylonTransformNode.getChildren((child) => child instanceof SpotLight, true)[0];
              if (light) {
                light.diffuse = value;
              }
            }
          }
        }
      },
      KHR_node_visibility: {
        visible: {
          type: "boolean",
          get: (node) => {
            return node._primitiveBabylonMeshes ? node._primitiveBabylonMeshes[0].isVisible : false;
          },
          getTarget: () => void 0,
          // TODO: what should this return?
          set: (value, node) => {
            if (node._primitiveBabylonMeshes) {
              node._primitiveBabylonMeshes.forEach((mesh) => mesh.isVisible = value);
            }
          }
        }
      }
    }
  }
};
var animationsTree = {
  length: {
    type: "number",
    get: (animations) => animations.length,
    getTarget: (animations) => animations.map((animation) => animation._babylonAnimationGroup),
    getPropertyName: [() => "length"]
  },
  __array__: {}
};
var meshesTree = {
  length: {
    type: "number",
    get: (meshes) => meshes.length,
    getTarget: (meshes) => meshes.map((mesh) => mesh.primitives[0]._instanceData?.babylonSourceMesh),
    getPropertyName: [() => "length"]
  },
  __array__: {}
};
var camerasTree = {
  __array__: {
    __target__: true,
    orthographic: {
      xmag: {
        componentsCount: 2,
        type: "Vector2",
        get: (camera) => new Vector2(camera._babylonCamera?.orthoLeft ?? 0, camera._babylonCamera?.orthoRight ?? 0),
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.orthoLeft = value.x;
            camera._babylonCamera.orthoRight = value.y;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "orthoLeft", () => "orthoRight"]
      },
      ymag: {
        componentsCount: 2,
        type: "Vector2",
        get: (camera) => new Vector2(camera._babylonCamera?.orthoBottom ?? 0, camera._babylonCamera?.orthoTop ?? 0),
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.orthoBottom = value.x;
            camera._babylonCamera.orthoTop = value.y;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "orthoBottom", () => "orthoTop"]
      },
      zfar: {
        type: "number",
        get: (camera) => camera._babylonCamera?.maxZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.maxZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "maxZ"]
      },
      znear: {
        type: "number",
        get: (camera) => camera._babylonCamera?.minZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.minZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "minZ"]
      }
    },
    perspective: {
      aspectRatio: {
        type: "number",
        get: (camera) => camera._babylonCamera?.getEngine().getAspectRatio(camera._babylonCamera),
        getTarget: (camera) => camera,
        getPropertyName: [() => "aspectRatio"],
        isReadOnly: true
        // might not be the case for glTF?
      },
      yfov: {
        type: "number",
        get: (camera) => camera._babylonCamera?.fov,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.fov = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "fov"]
      },
      zfar: {
        type: "number",
        get: (camera) => camera._babylonCamera?.maxZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.maxZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "maxZ"]
      },
      znear: {
        type: "number",
        get: (camera) => camera._babylonCamera?.minZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.minZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "minZ"]
      }
    }
  }
};
var materialsTree = {
  __array__: {
    __target__: true,
    emissiveFactor: {
      type: "Color3",
      get: (material, index, payload) => GetMaterial(material, index, payload).emissiveColor,
      set: (value, material, index, payload) => GetMaterial(material, index, payload).emissiveColor.copyFrom(value),
      getTarget: (material, index, payload) => GetMaterial(material, index, payload),
      getPropertyName: [() => "emissiveColor"]
    },
    emissiveTexture: {
      extensions: {
        KHR_texture_transform: GenerateTextureMap("emissiveTexture")
      }
    },
    normalTexture: {
      scale: {
        type: "number",
        get: (material, index, payload) => GetTexture(material, payload, "bumpTexture")?.level,
        set: (value, material, index, payload) => {
          const texture = GetTexture(material, payload, "bumpTexture");
          if (texture) {
            texture.level = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "level"]
      },
      extensions: {
        KHR_texture_transform: GenerateTextureMap("bumpTexture")
      }
    },
    occlusionTexture: {
      strength: {
        type: "number",
        get: (material, index, payload) => GetMaterial(material, index, payload).ambientTextureStrength,
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          if (mat) {
            mat.ambientTextureStrength = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "ambientTextureStrength"]
      },
      extensions: {
        KHR_texture_transform: GenerateTextureMap("ambientTexture")
      }
    },
    pbrMetallicRoughness: {
      baseColorFactor: {
        type: "Color4",
        get: (material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          return Color4.FromColor3(mat.albedoColor, mat.alpha);
        },
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          mat.albedoColor.set(value.r, value.g, value.b);
          mat.alpha = value.a;
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        // This is correct on the animation level, but incorrect as a single property of a type Color4
        getPropertyName: [() => "albedoColor", () => "alpha"]
      },
      baseColorTexture: {
        extensions: {
          KHR_texture_transform: GenerateTextureMap("albedoTexture")
        }
      },
      metallicFactor: {
        type: "number",
        get: (material, index, payload) => GetMaterial(material, index, payload).metallic,
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          if (mat) {
            mat.metallic = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "metallic"]
      },
      roughnessFactor: {
        type: "number",
        get: (material, index, payload) => GetMaterial(material, index, payload).roughness,
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          if (mat) {
            mat.roughness = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "roughness"]
      },
      metallicRoughnessTexture: {
        extensions: {
          KHR_texture_transform: GenerateTextureMap("metallicTexture")
        }
      }
    },
    extensions: {
      KHR_materials_anisotropy: {
        anisotropyStrength: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).anisotropy.intensity,
          set: (value, material, index, payload) => {
            GetMaterial(material, index, payload).anisotropy.intensity = value;
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "anisotropy.intensity"]
        },
        anisotropyRotation: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).anisotropy.angle,
          set: (value, material, index, payload) => {
            GetMaterial(material, index, payload).anisotropy.angle = value;
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "anisotropy.angle"]
        },
        anisotropyTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("anisotropy", "texture")
          }
        }
      },
      KHR_materials_clearcoat: {
        clearcoatFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).clearCoat.intensity,
          set: (value, material, index, payload) => {
            GetMaterial(material, index, payload).clearCoat.intensity = value;
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "clearCoat.intensity"]
        },
        clearcoatRoughnessFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).clearCoat.roughness,
          set: (value, material, index, payload) => {
            GetMaterial(material, index, payload).clearCoat.roughness = value;
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "clearCoat.roughness"]
        },
        clearcoatTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("clearCoat", "texture")
          }
        },
        clearcoatNormalTexture: {
          scale: {
            type: "number",
            get: (material, index, payload) => GetMaterial(material, index, payload).clearCoat.bumpTexture?.level,
            getTarget: GetMaterial,
            set: (value, material, index, payload) => GetMaterial(material, index, payload).clearCoat.bumpTexture.level = value
          },
          extensions: {
            KHR_texture_transform: GenerateTextureMap("clearCoat", "bumpTexture")
          }
        },
        clearcoatRoughnessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("clearCoat", "textureRoughness")
          }
        }
      },
      KHR_materials_dispersion: {
        dispersion: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.dispersion,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.dispersion = value
        }
      },
      KHR_materials_emissive_strength: {
        emissiveStrength: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).emissiveIntensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).emissiveIntensity = value
        }
      },
      KHR_materials_ior: {
        ior: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).indexOfRefraction,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).indexOfRefraction = value
        }
      },
      KHR_materials_iridescence: {
        iridescenceFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.intensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.intensity = value
        },
        iridescenceIor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.indexOfRefraction,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.indexOfRefraction = value
        },
        iridescenceTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("iridescence", "texture")
          }
        },
        iridescenceThicknessMaximum: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.maximumThickness,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.maximumThickness = value
        },
        iridescenceThicknessMinimum: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.minimumThickness,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.minimumThickness = value
        },
        iridescenceThicknessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("iridescence", "thicknessTexture")
          }
        }
      },
      KHR_materials_sheen: {
        sheenColorFactor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).sheen.color,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).sheen.color.copyFrom(value)
        },
        sheenColorTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("sheen", "texture")
          }
        },
        sheenRoughnessFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).sheen.intensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).sheen.intensity = value
        },
        sheenRoughnessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("sheen", "thicknessTexture")
          }
        }
      },
      KHR_materials_specular: {
        specularFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).metallicF0Factor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).metallicF0Factor = value,
          getPropertyName: [() => "metallicF0Factor"]
        },
        specularColorFactor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).metallicReflectanceColor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).metallicReflectanceColor.copyFrom(value),
          getPropertyName: [() => "metallicReflectanceColor"]
        },
        specularTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("metallicReflectanceTexture")
          }
        },
        specularColorTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("reflectanceTexture")
          }
        }
      },
      KHR_materials_transmission: {
        transmissionFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.refractionIntensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.refractionIntensity = value,
          getPropertyName: [() => "subSurface.refractionIntensity"]
        },
        transmissionTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "refractionIntensityTexture")
          }
        }
      },
      KHR_materials_diffuse_transmission: {
        diffuseTransmissionFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.translucencyIntensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.translucencyIntensity = value
        },
        diffuseTransmissionTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "translucencyIntensityTexture")
          }
        },
        diffuseTransmissionColorFactor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.translucencyColor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => value && GetMaterial(material, index, payload).subSurface.translucencyColor?.copyFrom(value)
        },
        diffuseTransmissionColorTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "translucencyColorTexture")
          }
        }
      },
      KHR_materials_volume: {
        attenuationColor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColor.copyFrom(value)
        },
        attenuationDistance: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColorAtDistance,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColorAtDistance = value
        },
        thicknessFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.maximumThickness,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.maximumThickness = value
        },
        thicknessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "thicknessTexture")
          }
        }
      }
    }
  }
};
var extensionsTree = {
  KHR_lights_punctual: {
    lights: {
      length: {
        type: "number",
        get: (lights) => lights.length,
        getTarget: (lights) => lights.map((light) => light._babylonLight),
        getPropertyName: [(_lights) => "length"]
      },
      __array__: {
        __target__: true,
        color: {
          type: "Color3",
          get: (light) => light._babylonLight?.diffuse,
          set: (value, light) => light._babylonLight?.diffuse.copyFrom(value),
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "diffuse"]
        },
        intensity: {
          type: "number",
          get: (light) => light._babylonLight?.intensity,
          set: (value, light) => light._babylonLight ? light._babylonLight.intensity = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "intensity"]
        },
        range: {
          type: "number",
          get: (light) => light._babylonLight?.range,
          set: (value, light) => light._babylonLight ? light._babylonLight.range = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "range"]
        },
        spot: {
          innerConeAngle: {
            type: "number",
            get: (light) => light._babylonLight?.innerAngle,
            set: (value, light) => light._babylonLight ? light._babylonLight.innerAngle = value : void 0,
            getTarget: (light) => light._babylonLight,
            getPropertyName: [(_light) => "innerConeAngle"]
          },
          outerConeAngle: {
            type: "number",
            get: (light) => light._babylonLight?.angle,
            set: (value, light) => light._babylonLight ? light._babylonLight.angle = value : void 0,
            getTarget: (light) => light._babylonLight,
            getPropertyName: [(_light) => "outerConeAngle"]
          }
        }
      }
    }
  },
  EXT_lights_area: {
    lights: {
      length: {
        type: "number",
        get: (lights) => lights.length,
        getTarget: (lights) => lights.map((light) => light._babylonLight),
        getPropertyName: [(_lights) => "length"]
      },
      __array__: {
        __target__: true,
        color: {
          type: "Color3",
          get: (light) => light._babylonLight?.diffuse,
          set: (value, light) => light._babylonLight?.diffuse.copyFrom(value),
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "diffuse"]
        },
        intensity: {
          type: "number",
          get: (light) => light._babylonLight?.intensity,
          set: (value, light) => light._babylonLight ? light._babylonLight.intensity = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "intensity"]
        },
        size: {
          type: "number",
          get: (light) => light._babylonLight?.height,
          set: (value, light) => light._babylonLight ? light._babylonLight.height = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "size"]
        },
        rect: {
          aspect: {
            type: "number",
            get: (light) => light._babylonLight?.width / light._babylonLight?.height,
            set: (value, light) => light._babylonLight ? light._babylonLight.width = value * light._babylonLight.height : void 0,
            getTarget: (light) => light._babylonLight,
            getPropertyName: [(_light) => "aspect"]
          }
        }
      }
    }
  },
  EXT_lights_ies: {
    lights: {
      length: {
        type: "number",
        get: (lights) => lights.length,
        getTarget: (lights) => lights.map((light) => light._babylonLight),
        getPropertyName: [(_lights) => "length"]
      }
    }
  },
  EXT_lights_image_based: {
    lights: {
      length: {
        type: "number",
        get: (lights) => lights.length,
        getTarget: (lights) => lights.map((light) => light._babylonTexture),
        getPropertyName: [(_lights) => "length"]
      },
      __array__: {
        __target__: true,
        intensity: {
          type: "number",
          get: (light) => light._babylonTexture?.level,
          set: (value, light) => {
            if (light._babylonTexture) {
              light._babylonTexture.level = value;
            }
          },
          getTarget: (light) => light._babylonTexture
        },
        rotation: {
          type: "Quaternion",
          get: (light) => light._babylonTexture && Quaternion.FromRotationMatrix(light._babylonTexture?.getReflectionTextureMatrix()),
          set: (value, light) => {
            if (!light._babylonTexture) {
              return;
            }
            if (!light._babylonTexture.getScene()?.useRightHandedSystem) {
              value = Quaternion.Inverse(value);
            }
            Matrix.FromQuaternionToRef(value, light._babylonTexture.getReflectionTextureMatrix());
          },
          getTarget: (light) => light._babylonTexture
        }
      }
    }
  }
};
function GetTexture(material, payload, textureType, textureInObject) {
  const babylonMaterial = GetMaterial(material, payload);
  return textureInObject ? babylonMaterial[textureType][textureInObject] : babylonMaterial[textureType];
}
function GetMaterial(material, _index, payload) {
  return material._data?.[payload?.fillMode ?? Constants.MATERIAL_TriangleFillMode]?.babylonMaterial;
}
function GenerateTextureMap(textureType, textureInObject) {
  return {
    offset: {
      componentsCount: 2,
      // assuming two independent values for u and v, and NOT a Vector2
      type: "Vector2",
      get: (material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        return new Vector2(texture?.uOffset, texture?.vOffset);
      },
      getTarget: GetMaterial,
      set: (value, material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        texture.uOffset = value.x, texture.vOffset = value.y;
      },
      getPropertyName: [
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.uOffset`,
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.vOffset`
      ]
    },
    rotation: {
      type: "number",
      get: (material, _index, payload) => GetTexture(material, payload, textureType, textureInObject)?.wAng,
      getTarget: GetMaterial,
      set: (value, material, _index, payload) => GetTexture(material, payload, textureType, textureInObject).wAng = value,
      getPropertyName: [() => `${textureType}${textureInObject ? "." + textureInObject : ""}.wAng`]
    },
    scale: {
      componentsCount: 2,
      type: "Vector2",
      get: (material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        return new Vector2(texture?.uScale, texture?.vScale);
      },
      getTarget: GetMaterial,
      set: (value, material, index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        texture.uScale = value.x, texture.vScale = value.y;
      },
      getPropertyName: [
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.uScale`,
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.vScale`
      ]
    }
  };
}
var objectModelMapping = {
  cameras: camerasTree,
  nodes: nodesTree,
  materials: materialsTree,
  extensions: extensionsTree,
  animations: animationsTree,
  meshes: meshesTree
};
function GetPathToObjectConverter(gltf) {
  return new GLTFPathToObjectConverter(gltf, objectModelMapping);
}
function GetMappingForKey(key) {
  const keyParts = key.split("/").map((part) => part.replace(/{}/g, "__array__"));
  let current = objectModelMapping;
  for (const part of keyParts) {
    if (!part) {
      continue;
    }
    current = current[part];
  }
  if (current && current.type && current.get) {
    return current;
  }
  return void 0;
}
function SetInterpolationForKey(key, interpolation) {
  const keyParts = key.split("/").map((part) => part.replace(/{}/g, "__array__"));
  let current = objectModelMapping;
  for (const part of keyParts) {
    if (!part) {
      continue;
    }
    current = current[part];
  }
  if (current && current.type && current.get) {
    current.interpolation = interpolation;
  }
}
function AddObjectAccessorToKey(key, accessor) {
  const keyParts = key.split("/").map((part) => part.replace(/{}/g, "__array__"));
  let current = objectModelMapping;
  for (const part of keyParts) {
    if (!part) {
      continue;
    }
    if (!current[part]) {
      if (part === "?") {
        current.__ignoreObjectTree__ = true;
        continue;
      }
      current[part] = {};
      if (part === "__array__") {
        current[part].__target__ = true;
      }
    }
    current = current[part];
  }
  Object.assign(current, accessor);
}

// node_modules/.pnpm/@babylonjs+loaders@8.49.1_@babylonjs+core@8.49.1_babylonjs-gltf2interface@8.49.1/node_modules/@babylonjs/loaders/glTF/2.0/glTFLoaderAnimation.js
function getVector3(_target, source, offset, scale) {
  return Vector3.FromArray(source, offset).scaleInPlace(scale);
}
function getQuaternion(_target, source, offset, scale) {
  return Quaternion.FromArray(source, offset).scaleInPlace(scale);
}
function getWeights(target, source, offset, scale) {
  const value = new Array(target._numMorphTargets);
  for (let i = 0; i < value.length; i++) {
    value[i] = source[offset++] * scale;
  }
  return value;
}
var AnimationPropertyInfo = class {
  /** @internal */
  constructor(type, name, getValue, getStride) {
    this.type = type;
    this.name = name;
    this.getValue = getValue;
    this.getStride = getStride;
  }
  _buildAnimation(name, fps, keys) {
    const babylonAnimation = new Animation(name, this.name, fps, this.type);
    babylonAnimation.setKeys(keys, true);
    return babylonAnimation;
  }
};
var TransformNodeAnimationPropertyInfo = class extends AnimationPropertyInfo {
  /** @internal */
  buildAnimations(target, name, fps, keys) {
    const babylonAnimations = [];
    babylonAnimations.push({ babylonAnimatable: target._babylonTransformNode, babylonAnimation: this._buildAnimation(name, fps, keys) });
    return babylonAnimations;
  }
};
var WeightAnimationPropertyInfo = class extends AnimationPropertyInfo {
  buildAnimations(target, name, fps, keys) {
    const babylonAnimations = [];
    if (target._numMorphTargets) {
      for (let targetIndex = 0; targetIndex < target._numMorphTargets; targetIndex++) {
        const babylonAnimation = new Animation(`${name}_${targetIndex}`, this.name, fps, this.type);
        babylonAnimation.setKeys(keys.map((key) => ({
          frame: key.frame,
          inTangent: key.inTangent ? key.inTangent[targetIndex] : void 0,
          value: key.value[targetIndex],
          outTangent: key.outTangent ? key.outTangent[targetIndex] : void 0,
          interpolation: key.interpolation
        })), true);
        if (target._primitiveBabylonMeshes) {
          for (const babylonMesh of target._primitiveBabylonMeshes) {
            if (babylonMesh.morphTargetManager) {
              const morphTarget = babylonMesh.morphTargetManager.getTarget(targetIndex);
              const babylonAnimationClone = babylonAnimation.clone();
              morphTarget.animations.push(babylonAnimationClone);
              babylonAnimations.push({ babylonAnimatable: morphTarget, babylonAnimation: babylonAnimationClone });
            }
          }
        }
      }
    }
    return babylonAnimations;
  }
};
SetInterpolationForKey("/nodes/{}/translation", [new TransformNodeAnimationPropertyInfo(Animation.ANIMATIONTYPE_VECTOR3, "position", getVector3, () => 3)]);
SetInterpolationForKey("/nodes/{}/rotation", [new TransformNodeAnimationPropertyInfo(Animation.ANIMATIONTYPE_QUATERNION, "rotationQuaternion", getQuaternion, () => 4)]);
SetInterpolationForKey("/nodes/{}/scale", [new TransformNodeAnimationPropertyInfo(Animation.ANIMATIONTYPE_VECTOR3, "scaling", getVector3, () => 3)]);
SetInterpolationForKey("/nodes/{}/weights", [new WeightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "influence", getWeights, (target) => target._numMorphTargets)]);

export {
  SpotLight,
  GetPathToObjectConverter,
  GetMappingForKey,
  SetInterpolationForKey,
  AddObjectAccessorToKey,
  getVector3,
  getQuaternion,
  getWeights,
  AnimationPropertyInfo,
  TransformNodeAnimationPropertyInfo,
  WeightAnimationPropertyInfo
};
//# sourceMappingURL=chunk-L2O2VO3N.js.map
