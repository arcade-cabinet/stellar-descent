import {
  PushMaterial
} from "./chunk-B2IFSXVS.js";
import {
  AbstractMesh,
  Mesh
} from "./chunk-43BBZCW2.js";
import {
  EffectFallbacks
} from "./chunk-XDMWCM3S.js";
import {
  AddClipPlaneUniforms,
  BindBonesParameters,
  BindClipPlane,
  BindFogParameters,
  BindLogDepth,
  BindMorphTargetParameters,
  BindSceneUniformBuffer,
  PrepareDefinesAndAttributesForMorphTargets,
  PrepareStringDefinesForClipPlanes,
  PushAttributesForInstances
} from "./chunk-TJZRBYWF.js";
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import {
  TransformNode
} from "./chunk-UUDR6V7F.js";
import {
  Scene
} from "./chunk-WNGJ3WNO.js";
import {
  VertexBuffer
} from "./chunk-ZOIT5ZEZ.js";
import {
  DeepCopier,
  Tools
} from "./chunk-2GZCEIFN.js";
import {
  WebRequest
} from "./chunk-2HUMDLGD.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import {
  SerializationHelper
} from "./chunk-ZKYT7Q6J.js";
import {
  Matrix,
  Quaternion,
  TmpVectors
} from "./chunk-YLLTSBLI.js";
import {
  EngineStore
} from "./chunk-YSTPYZG5.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Meshes/instancedMesh.js
Mesh._instancedMeshFactory = (name, mesh) => {
  const instance = new InstancedMesh(name, mesh);
  if (mesh.instancedBuffers) {
    instance.instancedBuffers = {};
    for (const key in mesh.instancedBuffers) {
      instance.instancedBuffers[key] = mesh.instancedBuffers[key];
    }
  }
  return instance;
};
var InstancedMesh = class extends AbstractMesh {
  /**
   * Creates a new InstancedMesh object from the mesh source.
   * @param name defines the name of the instance
   * @param source the mesh to create the instance from
   */
  constructor(name, source) {
    super(name, source.getScene());
    this._indexInSourceMeshInstanceArray = -1;
    this._distanceToCamera = 0;
    source.addInstance(this);
    this._sourceMesh = source;
    this._unIndexed = source._unIndexed;
    this.position.copyFrom(source.position);
    this.rotation.copyFrom(source.rotation);
    this.scaling.copyFrom(source.scaling);
    if (source.rotationQuaternion) {
      this.rotationQuaternion = source.rotationQuaternion.clone();
    }
    this.animations = source.animations.slice();
    for (const range of source.getAnimationRanges()) {
      if (range != null) {
        this.createAnimationRange(range.name, range.from, range.to);
      }
    }
    this.infiniteDistance = source.infiniteDistance;
    this.setPivotMatrix(source.getPivotMatrix());
    if (!source.skeleton && !source.morphTargetManager && source.hasBoundingInfo) {
      const boundingInfo = source.getBoundingInfo();
      this.buildBoundingInfo(boundingInfo.minimum, boundingInfo.maximum);
    } else {
      this.refreshBoundingInfo(true, true);
    }
    this._syncSubMeshes();
  }
  /**
   * @returns the string "InstancedMesh".
   */
  getClassName() {
    return "InstancedMesh";
  }
  /** Gets the list of lights affecting that mesh */
  get lightSources() {
    return this._sourceMesh._lightSources;
  }
  _resyncLightSources() {
  }
  _resyncLightSource() {
  }
  _removeLightSource() {
  }
  // Methods
  /**
   * If the source mesh receives shadows
   */
  get receiveShadows() {
    return this._sourceMesh.receiveShadows;
  }
  set receiveShadows(_value) {
    if (this._sourceMesh?.receiveShadows !== _value) {
      Tools.Warn("Setting receiveShadows on an instanced mesh has no effect");
    }
  }
  /**
   * The material of the source mesh
   */
  get material() {
    return this._sourceMesh.material;
  }
  set material(_value) {
    if (this._sourceMesh?.material !== _value) {
      Tools.Warn("Setting material on an instanced mesh has no effect");
    }
  }
  /**
   * Visibility of the source mesh
   */
  get visibility() {
    return this._sourceMesh.visibility;
  }
  set visibility(_value) {
    if (this._sourceMesh?.visibility !== _value) {
      Tools.Warn("Setting visibility on an instanced mesh has no effect");
    }
  }
  /**
   * Skeleton of the source mesh
   */
  get skeleton() {
    return this._sourceMesh.skeleton;
  }
  set skeleton(_value) {
    if (this._sourceMesh?.skeleton !== _value) {
      Tools.Warn("Setting skeleton on an instanced mesh has no effect");
    }
  }
  /**
   * Rendering ground id of the source mesh
   */
  get renderingGroupId() {
    return this._sourceMesh.renderingGroupId;
  }
  set renderingGroupId(value) {
    if (!this._sourceMesh || value === this._sourceMesh.renderingGroupId) {
      return;
    }
    Logger.Warn("Note - setting renderingGroupId of an instanced mesh has no effect on the scene");
  }
  /**
   * @returns the total number of vertices (integer).
   */
  getTotalVertices() {
    return this._sourceMesh ? this._sourceMesh.getTotalVertices() : 0;
  }
  /**
   * Returns a positive integer : the total number of indices in this mesh geometry.
   * @returns the number of indices or zero if the mesh has no geometry.
   */
  getTotalIndices() {
    return this._sourceMesh.getTotalIndices();
  }
  /**
   * The source mesh of the instance
   */
  get sourceMesh() {
    return this._sourceMesh;
  }
  /**
   * Gets the mesh internal Geometry object
   */
  get geometry() {
    return this._sourceMesh._geometry;
  }
  /**
   * Creates a new InstancedMesh object from the mesh model.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/instances
   * @param name defines the name of the new instance
   * @returns a new InstancedMesh
   */
  createInstance(name) {
    return this._sourceMesh.createInstance(name);
  }
  /**
   * Is this node ready to be used/rendered
   * @param completeCheck defines if a complete check (including materials and lights) has to be done (false by default)
   * @returns {boolean} is it ready
   */
  isReady(completeCheck = false) {
    return this._sourceMesh.isReady(completeCheck, true);
  }
  /**
   * Returns an array of integers or a typed array (Int32Array, Uint32Array, Uint16Array) populated with the mesh indices.
   * @param kind kind of verticies to retrieve (eg. positions, normals, uvs, etc.)
   * @param copyWhenShared If true (default false) and and if the mesh geometry is shared among some other meshes, the returned array is a copy of the internal one.
   * @param forceCopy defines a boolean forcing the copy of the buffer no matter what the value of copyWhenShared is
   * @returns a float array or a Float32Array of the requested kind of data : positions, normals, uvs, etc.
   */
  getVerticesData(kind, copyWhenShared, forceCopy) {
    return this._sourceMesh.getVerticesData(kind, copyWhenShared, forceCopy);
  }
  copyVerticesData(kind, vertexData) {
    this._sourceMesh.copyVerticesData(kind, vertexData);
  }
  getVertexBuffer(kind, bypassInstanceData) {
    return this._sourceMesh.getVertexBuffer(kind, bypassInstanceData);
  }
  /**
   * Sets the vertex data of the mesh geometry for the requested `kind`.
   * If the mesh has no geometry, a new Geometry object is set to the mesh and then passed this vertex data.
   * The `data` are either a numeric array either a Float32Array.
   * The parameter `updatable` is passed as is to the underlying Geometry object constructor (if initially none) or updater.
   * The parameter `stride` is an optional positive integer, it is usually automatically deducted from the `kind` (3 for positions or normals, 2 for UV, etc).
   * Note that a new underlying VertexBuffer object is created each call.
   * If the `kind` is the `PositionKind`, the mesh BoundingInfo is renewed, so the bounding box and sphere, and the mesh World Matrix is recomputed.
   *
   * Possible `kind` values :
   * - VertexBuffer.PositionKind
   * - VertexBuffer.UVKind
   * - VertexBuffer.UV2Kind
   * - VertexBuffer.UV3Kind
   * - VertexBuffer.UV4Kind
   * - VertexBuffer.UV5Kind
   * - VertexBuffer.UV6Kind
   * - VertexBuffer.ColorKind
   * - VertexBuffer.MatricesIndicesKind
   * - VertexBuffer.MatricesIndicesExtraKind
   * - VertexBuffer.MatricesWeightsKind
   * - VertexBuffer.MatricesWeightsExtraKind
   *
   * Returns the Mesh.
   * @param kind defines vertex data kind
   * @param data defines the data source
   * @param updatable defines if the data must be flagged as updatable (false as default)
   * @param stride defines the vertex stride (optional)
   * @returns the current mesh
   */
  setVerticesData(kind, data, updatable, stride) {
    if (this.sourceMesh) {
      this.sourceMesh.setVerticesData(kind, data, updatable, stride);
    }
    return this.sourceMesh;
  }
  /**
   * Updates the existing vertex data of the mesh geometry for the requested `kind`.
   * If the mesh has no geometry, it is simply returned as it is.
   * The `data` are either a numeric array either a Float32Array.
   * No new underlying VertexBuffer object is created.
   * If the `kind` is the `PositionKind` and if `updateExtends` is true, the mesh BoundingInfo is renewed, so the bounding box and sphere, and the mesh World Matrix is recomputed.
   * If the parameter `makeItUnique` is true, a new global geometry is created from this positions and is set to the mesh.
   *
   * Possible `kind` values :
   * - VertexBuffer.PositionKind
   * - VertexBuffer.UVKind
   * - VertexBuffer.UV2Kind
   * - VertexBuffer.UV3Kind
   * - VertexBuffer.UV4Kind
   * - VertexBuffer.UV5Kind
   * - VertexBuffer.UV6Kind
   * - VertexBuffer.ColorKind
   * - VertexBuffer.MatricesIndicesKind
   * - VertexBuffer.MatricesIndicesExtraKind
   * - VertexBuffer.MatricesWeightsKind
   * - VertexBuffer.MatricesWeightsExtraKind
   *
   * Returns the Mesh.
   * @param kind defines vertex data kind
   * @param data defines the data source
   * @param updateExtends defines if extends info of the mesh must be updated (can be null). This is mostly useful for "position" kind
   * @param makeItUnique defines it the updated vertex buffer must be flagged as unique (false by default)
   * @returns the source mesh
   */
  updateVerticesData(kind, data, updateExtends, makeItUnique) {
    if (this.sourceMesh) {
      this.sourceMesh.updateVerticesData(kind, data, updateExtends, makeItUnique);
    }
    return this.sourceMesh;
  }
  /**
   * Sets the mesh indices.
   * Expects an array populated with integers or a typed array (Int32Array, Uint32Array, Uint16Array).
   * If the mesh has no geometry, a new Geometry object is created and set to the mesh.
   * This method creates a new index buffer each call.
   * Returns the Mesh.
   * @param indices the source data
   * @param totalVertices defines the total number of vertices referenced by indices (could be null)
   * @returns source mesh
   */
  setIndices(indices, totalVertices = null) {
    if (this.sourceMesh) {
      this.sourceMesh.setIndices(indices, totalVertices);
    }
    return this.sourceMesh;
  }
  /**
   * Boolean : True if the mesh owns the requested kind of data.
   * @param kind defines which buffer to check (positions, indices, normals, etc). Possible `kind` values :
   * - VertexBuffer.PositionKind
   * - VertexBuffer.UVKind
   * - VertexBuffer.UV2Kind
   * - VertexBuffer.UV3Kind
   * - VertexBuffer.UV4Kind
   * - VertexBuffer.UV5Kind
   * - VertexBuffer.UV6Kind
   * - VertexBuffer.ColorKind
   * - VertexBuffer.MatricesIndicesKind
   * - VertexBuffer.MatricesIndicesExtraKind
   * - VertexBuffer.MatricesWeightsKind
   * - VertexBuffer.MatricesWeightsExtraKind
   * @returns true if data kind is present
   */
  isVerticesDataPresent(kind) {
    return this._sourceMesh.isVerticesDataPresent(kind);
  }
  /**
   * @returns an array of indices (IndicesArray).
   */
  getIndices() {
    return this._sourceMesh.getIndices();
  }
  get _positions() {
    return this._sourceMesh._positions;
  }
  refreshBoundingInfo(applySkeletonOrOptions = false, applyMorph = false) {
    if (this.hasBoundingInfo && this.getBoundingInfo().isLocked) {
      return this;
    }
    let options;
    if (typeof applySkeletonOrOptions === "object") {
      options = applySkeletonOrOptions;
    } else {
      options = {
        applySkeleton: applySkeletonOrOptions,
        applyMorph
      };
    }
    const bias = this._sourceMesh.geometry ? this._sourceMesh.geometry.boundingBias : null;
    this._refreshBoundingInfo(this._sourceMesh._getData(options, null, VertexBuffer.PositionKind), bias);
    return this;
  }
  /** @internal */
  _preActivate() {
    if (this._currentLOD) {
      this._currentLOD._preActivate();
    }
    return this;
  }
  /**
   * @internal
   */
  _activate(renderId, intermediateRendering) {
    super._activate(renderId, intermediateRendering);
    if (!this._sourceMesh.subMeshes) {
      Logger.Warn("Instances should only be created for meshes with geometry.");
    }
    if (this._currentLOD) {
      const differentSign = this._currentLOD._getWorldMatrixDeterminant() >= 0 !== this._getWorldMatrixDeterminant() >= 0;
      if (differentSign) {
        this._internalAbstractMeshDataInfo._actAsRegularMesh = true;
        return true;
      }
      this._internalAbstractMeshDataInfo._actAsRegularMesh = false;
      this._currentLOD._registerInstanceForRenderId(this, renderId);
      if (intermediateRendering) {
        if (!this._currentLOD._internalAbstractMeshDataInfo._isActiveIntermediate) {
          this._currentLOD._internalAbstractMeshDataInfo._onlyForInstancesIntermediate = true;
          return true;
        }
      } else {
        if (!this._currentLOD._internalAbstractMeshDataInfo._isActive) {
          this._currentLOD._internalAbstractMeshDataInfo._onlyForInstances = true;
          return true;
        }
      }
    }
    return false;
  }
  /** @internal */
  _postActivate() {
    if (this._sourceMesh.edgesShareWithInstances && this._sourceMesh._edgesRenderer && this._sourceMesh._edgesRenderer.isEnabled && this._sourceMesh._renderingGroup) {
      this._sourceMesh._renderingGroup._edgesRenderers.pushNoDuplicate(this._sourceMesh._edgesRenderer);
      this._sourceMesh._edgesRenderer.customInstances.push(this.getWorldMatrix());
    } else if (this._edgesRenderer && this._edgesRenderer.isEnabled && this._sourceMesh._renderingGroup) {
      this._sourceMesh._renderingGroup._edgesRenderers.push(this._edgesRenderer);
    }
  }
  getWorldMatrix() {
    if (this._currentLOD && this._currentLOD !== this._sourceMesh && this._currentLOD.billboardMode !== TransformNode.BILLBOARDMODE_NONE && this._currentLOD._masterMesh !== this) {
      if (!this._billboardWorldMatrix) {
        this._billboardWorldMatrix = new Matrix();
      }
      const tempMaster = this._currentLOD._masterMesh;
      this._currentLOD._masterMesh = this;
      TmpVectors.Vector3[7].copyFrom(this._currentLOD.position);
      this._currentLOD.position.set(0, 0, 0);
      this._billboardWorldMatrix.copyFrom(this._currentLOD.computeWorldMatrix(true));
      this._currentLOD.position.copyFrom(TmpVectors.Vector3[7]);
      this._currentLOD._masterMesh = tempMaster;
      return this._billboardWorldMatrix;
    }
    return super.getWorldMatrix();
  }
  get isAnInstance() {
    return true;
  }
  /**
   * Returns the current associated LOD AbstractMesh.
   * @param camera defines the camera to use to pick the LOD level
   * @returns a Mesh or `null` if no LOD is associated with the AbstractMesh
   */
  getLOD(camera) {
    if (!camera) {
      return this;
    }
    const sourceMeshLODLevels = this.sourceMesh.getLODLevels();
    if (!sourceMeshLODLevels || sourceMeshLODLevels.length === 0) {
      this._currentLOD = this.sourceMesh;
    } else {
      const boundingInfo = this.getBoundingInfo();
      this._currentLOD = this.sourceMesh.getLOD(camera, boundingInfo.boundingSphere);
    }
    return this._currentLOD;
  }
  /**
   * @internal
   */
  _preActivateForIntermediateRendering(renderId) {
    return this.sourceMesh._preActivateForIntermediateRendering(renderId);
  }
  /** @internal */
  _syncSubMeshes() {
    this.releaseSubMeshes();
    if (this._sourceMesh.subMeshes) {
      for (let index = 0; index < this._sourceMesh.subMeshes.length; index++) {
        this._sourceMesh.subMeshes[index].clone(this, this._sourceMesh);
      }
    }
    return this;
  }
  /** @internal */
  _generatePointsArray() {
    return this._sourceMesh._generatePointsArray();
  }
  /** @internal */
  _updateBoundingInfo() {
    if (this.hasBoundingInfo) {
      this.getBoundingInfo().update(this.worldMatrixFromCache);
    } else {
      this.buildBoundingInfo(this.absolutePosition, this.absolutePosition, this.worldMatrixFromCache);
    }
    this._updateSubMeshesBoundingInfo(this.worldMatrixFromCache);
    return this;
  }
  /**
   * Creates a new InstancedMesh from the current mesh.
   *
   * Returns the clone.
   * @param name the cloned mesh name
   * @param newParent the optional Node to parent the clone to.
   * @param doNotCloneChildren if `true` the model children aren't cloned.
   * @param newSourceMesh if set this mesh will be used as the source mesh instead of ths instance's one
   * @returns the clone
   */
  clone(name, newParent = null, doNotCloneChildren, newSourceMesh) {
    const result = (newSourceMesh || this._sourceMesh).createInstance(name);
    DeepCopier.DeepCopy(this, result, [
      "name",
      "subMeshes",
      "uniqueId",
      "parent",
      "lightSources",
      "receiveShadows",
      "material",
      "visibility",
      "skeleton",
      "sourceMesh",
      "isAnInstance",
      "facetNb",
      "isFacetDataEnabled",
      "isBlocked",
      "useBones",
      "hasInstances",
      "collider",
      "edgesRenderer",
      "forward",
      "up",
      "right",
      "absolutePosition",
      "absoluteScaling",
      "absoluteRotationQuaternion",
      "isWorldMatrixFrozen",
      "nonUniformScaling",
      "behaviors",
      "worldMatrixFromCache",
      "hasThinInstances",
      "hasBoundingInfo",
      "geometry"
    ], []);
    if (newParent) {
      result.parent = newParent;
    }
    if (!doNotCloneChildren) {
      for (let index = 0; index < this.getScene().meshes.length; index++) {
        const mesh = this.getScene().meshes[index];
        if (mesh.parent === this) {
          mesh.clone(mesh.name, result);
        }
      }
    }
    result.computeWorldMatrix(true);
    this.onClonedObservable.notifyObservers(result);
    return result;
  }
  /**
   * Disposes the InstancedMesh.
   * Returns nothing.
   * @param doNotRecurse Set to true to not recurse into each children (recurse into each children by default)
   * @param disposeMaterialAndTextures Set to true to also dispose referenced materials and textures (false by default)
   */
  dispose(doNotRecurse, disposeMaterialAndTextures = false) {
    this._sourceMesh.removeInstance(this);
    super.dispose(doNotRecurse, disposeMaterialAndTextures);
  }
  /**
   * @internal
   */
  _serializeAsParent(serializationObject) {
    super._serializeAsParent(serializationObject);
    serializationObject.parentId = this._sourceMesh.uniqueId;
    serializationObject.parentInstanceIndex = this._indexInSourceMeshInstanceArray;
  }
  /**
   * Instantiate (when possible) or clone that node with its hierarchy
   * @param newParent defines the new parent to use for the instance (or clone)
   * @param options defines options to configure how copy is done
   * @param options.doNotInstantiate defines if the model must be instantiated or just cloned
   * @param options.newSourcedMesh newSourcedMesh the new source mesh for the instance (or clone)
   * @param onNewNodeCreated defines an option callback to call when a clone or an instance is created
   * @returns an instance (or a clone) of the current node with its hierarchy
   */
  instantiateHierarchy(newParent = null, options, onNewNodeCreated) {
    const clone = this.clone("Clone of " + (this.name || this.id), newParent || this.parent, true, options && options.newSourcedMesh);
    if (clone) {
      if (onNewNodeCreated) {
        onNewNodeCreated(this, clone);
      }
    }
    for (const child of this.getChildTransformNodes(true)) {
      child.instantiateHierarchy(clone, options, onNewNodeCreated);
    }
    return clone;
  }
};
Mesh.prototype.registerInstancedBuffer = function(kind, stride) {
  this._userInstancedBuffersStorage?.vertexBuffers[kind]?.dispose();
  if (!this.instancedBuffers) {
    this.instancedBuffers = {};
    for (const instance of this.instances) {
      instance.instancedBuffers = {};
    }
  }
  if (!this._userInstancedBuffersStorage) {
    this._userInstancedBuffersStorage = {
      data: {},
      vertexBuffers: {},
      strides: {},
      sizes: {},
      vertexArrayObjects: this.getEngine().getCaps().vertexArrayObject ? {} : void 0
    };
  }
  this.instancedBuffers[kind] = null;
  this._userInstancedBuffersStorage.strides[kind] = stride;
  this._userInstancedBuffersStorage.sizes[kind] = stride * 32;
  this._userInstancedBuffersStorage.data[kind] = new Float32Array(this._userInstancedBuffersStorage.sizes[kind]);
  this._userInstancedBuffersStorage.vertexBuffers[kind] = new VertexBuffer(this.getEngine(), this._userInstancedBuffersStorage.data[kind], kind, true, false, stride, true);
  for (const instance of this.instances) {
    instance.instancedBuffers[kind] = null;
  }
  this._invalidateInstanceVertexArrayObject();
  this._markSubMeshesAsAttributesDirty();
};
Mesh.prototype._processInstancedBuffers = function(visibleInstances, renderSelf) {
  const instanceCount = visibleInstances ? visibleInstances.length : 0;
  for (const kind in this.instancedBuffers) {
    let size = this._userInstancedBuffersStorage.sizes[kind];
    const stride = this._userInstancedBuffersStorage.strides[kind];
    const expectedSize = (instanceCount + 1) * stride;
    while (size < expectedSize) {
      size *= 2;
    }
    if (this._userInstancedBuffersStorage.data[kind].length != size) {
      this._userInstancedBuffersStorage.data[kind] = new Float32Array(size);
      this._userInstancedBuffersStorage.sizes[kind] = size;
      if (this._userInstancedBuffersStorage.vertexBuffers[kind]) {
        this._userInstancedBuffersStorage.vertexBuffers[kind].dispose();
        this._userInstancedBuffersStorage.vertexBuffers[kind] = null;
      }
    }
    const data = this._userInstancedBuffersStorage.data[kind];
    let offset = 0;
    if (renderSelf) {
      const value = this.instancedBuffers[kind];
      if (value.toArray) {
        value.toArray(data, offset);
      } else if (value.copyToArray) {
        value.copyToArray(data, offset);
      } else {
        data[offset] = value;
      }
      offset += stride;
    }
    for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
      const instance = visibleInstances[instanceIndex];
      const value = instance.instancedBuffers[kind];
      if (value.toArray) {
        value.toArray(data, offset);
      } else if (value.copyToArray) {
        value.copyToArray(data, offset);
      } else {
        data[offset] = value;
      }
      offset += stride;
    }
    if (!this._userInstancedBuffersStorage.vertexBuffers[kind]) {
      this._userInstancedBuffersStorage.vertexBuffers[kind] = new VertexBuffer(this.getEngine(), this._userInstancedBuffersStorage.data[kind], kind, true, false, stride, true);
      this._invalidateInstanceVertexArrayObject();
    } else {
      this._userInstancedBuffersStorage.vertexBuffers[kind].updateDirectly(data, 0);
    }
  }
};
Mesh.prototype._invalidateInstanceVertexArrayObject = function() {
  if (!this._userInstancedBuffersStorage || this._userInstancedBuffersStorage.vertexArrayObjects === void 0) {
    return;
  }
  for (const kind in this._userInstancedBuffersStorage.vertexArrayObjects) {
    this.getEngine().releaseVertexArrayObject(this._userInstancedBuffersStorage.vertexArrayObjects[kind]);
  }
  this._userInstancedBuffersStorage.vertexArrayObjects = {};
};
Mesh.prototype._disposeInstanceSpecificData = function() {
  for (const renderPassId in this._instanceDataStorage.renderPasses) {
    this._instanceDataStorage.renderPasses[renderPassId].instancesBuffer?.dispose();
  }
  this._instanceDataStorage.renderPasses = {};
  while (this.instances.length) {
    this.instances[0].dispose();
  }
  for (const kind in this.instancedBuffers) {
    if (this._userInstancedBuffersStorage.vertexBuffers[kind]) {
      this._userInstancedBuffersStorage.vertexBuffers[kind].dispose();
    }
  }
  this._invalidateInstanceVertexArrayObject();
  this.instancedBuffers = {};
};
RegisterClass("BABYLON.InstancedMesh", InstancedMesh);

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/vertexPullingHelper.functions.js
var _VertexPullingMetadataCache = /* @__PURE__ */ new WeakMap();
function PrepareVertexPullingUniforms(geometry) {
  const vertexBuffers = geometry.getVertexBuffers();
  if (!vertexBuffers) {
    return null;
  }
  let metadata = _VertexPullingMetadataCache.get(geometry);
  if (!metadata) {
    metadata = /* @__PURE__ */ new Map();
    _VertexPullingMetadataCache.set(geometry, metadata);
  } else {
    let needsUpdate = false;
    for (const vb in vertexBuffers) {
      if (!metadata.has(vb)) {
        needsUpdate = true;
        break;
      }
    }
    if (!needsUpdate) {
      return metadata;
    }
  }
  for (const vb in vertexBuffers) {
    const vertexBuffer = vertexBuffers[vb];
    if (vertexBuffer) {
      const offset = vertexBuffer.byteOffset;
      const stride = vertexBuffer.byteStride;
      const type = vertexBuffer.type;
      metadata.set(vb, {
        offset,
        stride,
        type
      });
    }
  }
  return metadata;
}
function BindVertexPullingUniforms(effect, metadata) {
  metadata.forEach((data, attribute) => {
    const uniformName = `vp_${attribute}_info`;
    effect.setFloat3(uniformName, data.offset, data.stride, data.type);
  });
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/shaderMaterial.js
var OnCreatedEffectParameters = { effect: null, subMesh: null };
var ShaderMaterial = class _ShaderMaterial extends PushMaterial {
  /**
   * Instantiate a new shader material.
   * The ShaderMaterial object has the necessary methods to pass data from your scene to the Vertex and Fragment Shaders and returns a material that can be applied to any mesh.
   * This returned material effects how the mesh will look based on the code in the shaders.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/materials/shaders/shaderMaterial
   * @param name Define the name of the material in the scene
   * @param scene Define the scene the material belongs to
   * @param shaderPath Defines  the route to the shader code.
   * @param options Define the options used to create the shader
   * @param storeEffectOnSubMeshes true to store effect on submeshes, false to store the effect directly in the material class.
   */
  constructor(name, scene, shaderPath, options = {}, storeEffectOnSubMeshes = true) {
    super(name, scene, storeEffectOnSubMeshes);
    this._textures = {};
    this._internalTextures = {};
    this._textureArrays = {};
    this._externalTextures = {};
    this._floats = {};
    this._ints = {};
    this._uints = {};
    this._floatsArrays = {};
    this._colors3 = {};
    this._colors3Arrays = {};
    this._colors4 = {};
    this._colors4Arrays = {};
    this._vectors2 = {};
    this._vectors3 = {};
    this._vectors4 = {};
    this._quaternions = {};
    this._quaternionsArrays = {};
    this._matrices = {};
    this._matrixArrays = {};
    this._matrices3x3 = {};
    this._matrices2x2 = {};
    this._vectors2Arrays = {};
    this._vectors3Arrays = {};
    this._vectors4Arrays = {};
    this._uniformBuffers = {};
    this._textureSamplers = {};
    this._storageBuffers = {};
    this._cachedWorldViewMatrix = new Matrix();
    this._cachedWorldViewProjectionMatrix = new Matrix();
    this._multiview = false;
    this._vertexPullingMetadata = null;
    this._materialHelperNeedsPreviousMatrices = false;
    this._shaderPath = shaderPath;
    this._options = {
      needAlphaBlending: false,
      needAlphaTesting: false,
      attributes: ["position", "normal", "uv"],
      uniforms: ["worldViewProjection"],
      uniformBuffers: [],
      samplers: [],
      externalTextures: [],
      samplerObjects: [],
      storageBuffers: [],
      defines: [],
      useClipPlane: false,
      ...options
    };
  }
  /**
   * Gets the shader path used to define the shader code
   * It can be modified to trigger a new compilation
   */
  get shaderPath() {
    return this._shaderPath;
  }
  /**
   * Sets the shader path used to define the shader code
   * It can be modified to trigger a new compilation
   */
  set shaderPath(shaderPath) {
    this._shaderPath = shaderPath;
  }
  /**
   * Gets the options used to compile the shader.
   * They can be modified to trigger a new compilation
   */
  get options() {
    return this._options;
  }
  /**
   * is multiview set to true?
   */
  get isMultiview() {
    return this._multiview;
  }
  /**
   * Gets the current class name of the material e.g. "ShaderMaterial"
   * Mainly use in serialization.
   * @returns the class name
   */
  getClassName() {
    return "ShaderMaterial";
  }
  /**
   * Specifies if the material will require alpha blending
   * @returns a boolean specifying if alpha blending is needed
   */
  needAlphaBlending() {
    return this.alpha < 1 || this._options.needAlphaBlending;
  }
  /**
   * Specifies if this material should be rendered in alpha test mode
   * @returns a boolean specifying if an alpha test is needed.
   */
  needAlphaTesting() {
    return this._options.needAlphaTesting;
  }
  _checkUniform(uniformName) {
    if (this._options.uniforms.indexOf(uniformName) === -1) {
      this._options.uniforms.push(uniformName);
    }
  }
  /**
   * Set a texture in the shader.
   * @param name Define the name of the uniform samplers as defined in the shader
   * @param texture Define the texture to bind to this sampler
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setTexture(name, texture) {
    if (this._options.samplers.indexOf(name) === -1) {
      this._options.samplers.push(name);
    }
    this._textures[name] = texture;
    return this;
  }
  /**
   * Set an internal texture in the shader.
   * @param name Define the name of the uniform samplers as defined in the shader
   * @param texture Define the texture to bind to this sampler
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setInternalTexture(name, texture) {
    if (this._options.samplers.indexOf(name) === -1) {
      this._options.samplers.push(name);
    }
    this._internalTextures[name] = texture;
    return this;
  }
  /**
   * Remove a texture from the material.
   * @param name Define the name of the texture to remove
   */
  removeTexture(name) {
    delete this._textures[name];
  }
  /**
   * Set a texture array in the shader.
   * @param name Define the name of the uniform sampler array as defined in the shader
   * @param textures Define the list of textures to bind to this sampler
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setTextureArray(name, textures) {
    if (this._options.samplers.indexOf(name) === -1) {
      this._options.samplers.push(name);
    }
    this._checkUniform(name);
    this._textureArrays[name] = textures;
    return this;
  }
  /**
   * Set an internal texture in the shader.
   * @param name Define the name of the uniform samplers as defined in the shader
   * @param texture Define the texture to bind to this sampler
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setExternalTexture(name, texture) {
    if (this._options.externalTextures.indexOf(name) === -1) {
      this._options.externalTextures.push(name);
    }
    this._externalTextures[name] = texture;
    return this;
  }
  /**
   * Set a float in the shader.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setFloat(name, value) {
    this._checkUniform(name);
    this._floats[name] = value;
    return this;
  }
  /**
   * Set a int in the shader.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setInt(name, value) {
    this._checkUniform(name);
    this._ints[name] = value;
    return this;
  }
  /**
   * Set a unsigned int in the shader.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setUInt(name, value) {
    this._checkUniform(name);
    this._uints[name] = value;
    return this;
  }
  /**
   * Set an array of floats in the shader.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setFloats(name, value) {
    this._checkUniform(name);
    this._floatsArrays[name] = value;
    return this;
  }
  /**
   * Set a vec3 in the shader from a Color3.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setColor3(name, value) {
    this._checkUniform(name);
    this._colors3[name] = value;
    return this;
  }
  /**
   * Set a vec3 array in the shader from a IColor3Like array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setColor3Array(name, value) {
    this._checkUniform(name);
    this._colors3Arrays[name] = value.reduce((arr, color) => {
      arr.push(color.r, color.g, color.b);
      return arr;
    }, []);
    return this;
  }
  /**
   * Set a vec4 in the shader from a Color4.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setColor4(name, value) {
    this._checkUniform(name);
    this._colors4[name] = value;
    return this;
  }
  /**
   * Set a vec4 array in the shader from a IColor4Like array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setColor4Array(name, value) {
    this._checkUniform(name);
    this._colors4Arrays[name] = value.reduce((arr, color) => {
      arr.push(color.r, color.g, color.b, color.a);
      return arr;
    }, []);
    return this;
  }
  /**
   * Set a vec2 in the shader from a Vector2.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setVector2(name, value) {
    this._checkUniform(name);
    this._vectors2[name] = value;
    return this;
  }
  /**
   * Set a vec3 in the shader from a Vector3.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setVector3(name, value) {
    this._checkUniform(name);
    this._vectors3[name] = value;
    return this;
  }
  /**
   * Set a vec4 in the shader from a Vector4.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setVector4(name, value) {
    this._checkUniform(name);
    this._vectors4[name] = value;
    return this;
  }
  /**
   * Set a vec4 in the shader from a Quaternion.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setQuaternion(name, value) {
    this._checkUniform(name);
    this._quaternions[name] = value;
    return this;
  }
  /**
   * Set a vec4 array in the shader from a Quaternion array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setQuaternionArray(name, value) {
    this._checkUniform(name);
    this._quaternionsArrays[name] = value.reduce((arr, quaternion) => {
      quaternion.toArray(arr, arr.length);
      return arr;
    }, []);
    return this;
  }
  /**
   * Set a mat4 in the shader from a Matrix.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setMatrix(name, value) {
    this._checkUniform(name);
    this._matrices[name] = value;
    return this;
  }
  /**
   * Set a float32Array in the shader from a matrix array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setMatrices(name, value) {
    this._checkUniform(name);
    const float32Array = new Float32Array(value.length * 16);
    for (let index = 0; index < value.length; index++) {
      const matrix = value[index];
      matrix.copyToArray(float32Array, index * 16);
    }
    this._matrixArrays[name] = float32Array;
    return this;
  }
  /**
   * Set a mat3 in the shader from a Float32Array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setMatrix3x3(name, value) {
    this._checkUniform(name);
    this._matrices3x3[name] = value;
    return this;
  }
  /**
   * Set a mat2 in the shader from a Float32Array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setMatrix2x2(name, value) {
    this._checkUniform(name);
    this._matrices2x2[name] = value;
    return this;
  }
  /**
   * Set a vec2 array in the shader from a number array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setArray2(name, value) {
    this._checkUniform(name);
    this._vectors2Arrays[name] = value;
    return this;
  }
  /**
   * Set a vec3 array in the shader from a number array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setArray3(name, value) {
    this._checkUniform(name);
    this._vectors3Arrays[name] = value;
    return this;
  }
  /**
   * Set a vec4 array in the shader from a number array.
   * @param name Define the name of the uniform as defined in the shader
   * @param value Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setArray4(name, value) {
    this._checkUniform(name);
    this._vectors4Arrays[name] = value;
    return this;
  }
  /**
   * Set a uniform buffer in the shader
   * @param name Define the name of the uniform as defined in the shader
   * @param buffer Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setUniformBuffer(name, buffer) {
    if (this._options.uniformBuffers.indexOf(name) === -1) {
      this._options.uniformBuffers.push(name);
    }
    this._uniformBuffers[name] = buffer;
    return this;
  }
  /**
   * Set a texture sampler in the shader
   * @param name Define the name of the uniform as defined in the shader
   * @param sampler Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setTextureSampler(name, sampler) {
    if (this._options.samplerObjects.indexOf(name) === -1) {
      this._options.samplerObjects.push(name);
    }
    this._textureSamplers[name] = sampler;
    return this;
  }
  /**
   * Set a storage buffer in the shader
   * @param name Define the name of the storage buffer as defined in the shader
   * @param buffer Define the value to give to the uniform
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setStorageBuffer(name, buffer) {
    if (this._options.storageBuffers.indexOf(name) === -1) {
      this._options.storageBuffers.push(name);
    }
    this._storageBuffers[name] = buffer;
    return this;
  }
  /**
   * Adds, removes, or replaces the specified shader define and value.
   * * setDefine("MY_DEFINE", true); // enables a boolean define
   * * setDefine("MY_DEFINE", "0.5"); // adds "#define MY_DEFINE 0.5" to the shader (or sets and replaces the value of any existing define with that name)
   * * setDefine("MY_DEFINE", false); // disables and removes the define
   * Note if the active defines do change, the shader will be recompiled and this can be expensive.
   * @param define the define name e.g., "OUTPUT_TO_SRGB" or "#define OUTPUT_TO_SRGB". If the define was passed into the constructor already, the version used should match that, and in either case, it should not include any appended value.
   * @param value either the value of the define (e.g. a numerical value) or for booleans, true if the define should be enabled or false if it should be disabled
   * @returns the material itself allowing "fluent" like uniform updates
   */
  setDefine(define, value) {
    const defineName = define.trimEnd() + " ";
    const existingDefineIdx = this.options.defines.findIndex((x) => x === define || x.startsWith(defineName));
    if (existingDefineIdx >= 0) {
      this.options.defines.splice(existingDefineIdx, 1);
    }
    if (typeof value !== "boolean" || value) {
      this.options.defines.push(defineName + value);
    }
    return this;
  }
  /**
   * Specifies that the submesh is ready to be used
   * @param mesh defines the mesh to check
   * @param subMesh defines which submesh to check
   * @param useInstances specifies that instances should be used
   * @returns a boolean indicating that the submesh is ready or not
   */
  isReadyForSubMesh(mesh, subMesh, useInstances) {
    return this.isReady(mesh, useInstances, subMesh);
  }
  /**
   * Checks if the material is ready to render the requested mesh
   * @param mesh Define the mesh to render
   * @param useInstances Define whether or not the material is used with instances
   * @param subMesh defines which submesh to render
   * @returns true if ready, otherwise false
   */
  isReady(mesh, useInstances, subMesh) {
    const storeEffectOnSubMeshes = subMesh && this._storeEffectOnSubMeshes;
    if (this.isFrozen) {
      const drawWrapper2 = storeEffectOnSubMeshes ? subMesh._drawWrapper : this._drawWrapper;
      if (drawWrapper2.effect && drawWrapper2._wasPreviouslyReady && drawWrapper2._wasPreviouslyUsingInstances === useInstances) {
        return true;
      }
    }
    const scene = this.getScene();
    const engine = scene.getEngine();
    const defines = [];
    const attribs = [];
    let fallbacks = null;
    let shaderName = this._shaderPath, uniforms = this._options.uniforms, uniformBuffers = this._options.uniformBuffers, samplers = this._options.samplers;
    if (engine.getCaps().multiview && scene.activeCamera && scene.activeCamera.outputRenderTarget && scene.activeCamera.outputRenderTarget.getViewCount() > 1) {
      this._multiview = true;
      defines.push("#define MULTIVIEW");
      if (uniforms.indexOf("viewProjection") !== -1 && uniforms.indexOf("viewProjectionR") === -1) {
        uniforms.push("viewProjectionR");
      }
    }
    for (let index = 0; index < this._options.defines.length; index++) {
      const defineToAdd = this._options.defines[index].indexOf("#define") === 0 ? this._options.defines[index] : `#define ${this._options.defines[index]}`;
      defines.push(defineToAdd);
    }
    for (let index = 0; index < this._options.attributes.length; index++) {
      attribs.push(this._options.attributes[index]);
    }
    if (mesh && mesh.isVerticesDataPresent(VertexBuffer.ColorKind)) {
      if (attribs.indexOf(VertexBuffer.ColorKind) === -1) {
        attribs.push(VertexBuffer.ColorKind);
      }
      defines.push("#define VERTEXCOLOR");
    }
    if (useInstances) {
      defines.push("#define INSTANCES");
      PushAttributesForInstances(attribs, this._materialHelperNeedsPreviousMatrices);
      if (mesh?.hasThinInstances) {
        defines.push("#define THIN_INSTANCES");
        if (mesh && mesh.isVerticesDataPresent(VertexBuffer.ColorInstanceKind)) {
          attribs.push(VertexBuffer.ColorInstanceKind);
          defines.push("#define INSTANCESCOLOR");
        }
      }
    }
    if (mesh && mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton) {
      attribs.push(VertexBuffer.MatricesIndicesKind);
      attribs.push(VertexBuffer.MatricesWeightsKind);
      if (mesh.numBoneInfluencers > 4) {
        attribs.push(VertexBuffer.MatricesIndicesExtraKind);
        attribs.push(VertexBuffer.MatricesWeightsExtraKind);
      }
      const skeleton = mesh.skeleton;
      defines.push("#define NUM_BONE_INFLUENCERS " + mesh.numBoneInfluencers);
      fallbacks = new EffectFallbacks();
      fallbacks.addCPUSkinningFallback(0, mesh);
      if (skeleton.isUsingTextureForMatrices) {
        defines.push("#define BONETEXTURE");
        if (uniforms.indexOf("boneTextureWidth") === -1) {
          uniforms.push("boneTextureWidth");
        }
        if (this._options.samplers.indexOf("boneSampler") === -1) {
          this._options.samplers.push("boneSampler");
        }
      } else {
        defines.push("#define BonesPerMesh " + (skeleton.bones.length + 1));
        if (uniforms.indexOf("mBones") === -1) {
          uniforms.push("mBones");
        }
      }
    } else {
      defines.push("#define NUM_BONE_INFLUENCERS 0");
    }
    let numInfluencers = 0;
    const manager = mesh ? mesh.morphTargetManager : null;
    if (manager) {
      const uv = defines.indexOf("#define UV1") !== -1;
      const uv2 = defines.indexOf("#define UV2") !== -1;
      const tangent = defines.indexOf("#define TANGENT") !== -1;
      const normal = defines.indexOf("#define NORMAL") !== -1;
      const color = defines.indexOf("#define VERTEXCOLOR") !== -1;
      numInfluencers = PrepareDefinesAndAttributesForMorphTargets(
        manager,
        defines,
        attribs,
        mesh,
        true,
        // usePositionMorph
        normal,
        // useNormalMorph
        tangent,
        // useTangentMorph
        uv,
        // useUVMorph
        uv2,
        // useUV2Morph
        color
        // useColorMorph
      );
      if (manager.isUsingTextureForTargets) {
        if (uniforms.indexOf("morphTargetTextureIndices") === -1) {
          uniforms.push("morphTargetTextureIndices");
        }
        if (this._options.samplers.indexOf("morphTargets") === -1) {
          this._options.samplers.push("morphTargets");
        }
      }
      if (numInfluencers > 0) {
        uniforms = uniforms.slice();
        uniforms.push("morphTargetInfluences");
        uniforms.push("morphTargetCount");
        uniforms.push("morphTargetTextureInfo");
        uniforms.push("morphTargetTextureIndices");
      }
    } else {
      defines.push("#define NUM_MORPH_INFLUENCERS 0");
    }
    if (mesh) {
      const bvaManager = mesh.bakedVertexAnimationManager;
      if (bvaManager && bvaManager.isEnabled) {
        defines.push("#define BAKED_VERTEX_ANIMATION_TEXTURE");
        if (uniforms.indexOf("bakedVertexAnimationSettings") === -1) {
          uniforms.push("bakedVertexAnimationSettings");
        }
        if (uniforms.indexOf("bakedVertexAnimationTextureSizeInverted") === -1) {
          uniforms.push("bakedVertexAnimationTextureSizeInverted");
        }
        if (uniforms.indexOf("bakedVertexAnimationTime") === -1) {
          uniforms.push("bakedVertexAnimationTime");
        }
        if (this._options.samplers.indexOf("bakedVertexAnimationTexture") === -1) {
          this._options.samplers.push("bakedVertexAnimationTexture");
        }
        if (useInstances) {
          attribs.push("bakedVertexAnimationSettingsInstanced");
        }
      }
    }
    for (const name in this._textures) {
      if (!this._textures[name].isReady()) {
        return false;
      }
    }
    for (const name in this._internalTextures) {
      if (!this._internalTextures[name].isReady) {
        return false;
      }
    }
    if (mesh && this.needAlphaTestingForMesh(mesh)) {
      defines.push("#define ALPHATEST");
    }
    if (this._options.useClipPlane !== false) {
      AddClipPlaneUniforms(uniforms);
      PrepareStringDefinesForClipPlanes(this, scene, defines);
    }
    if (scene.fogEnabled && mesh?.applyFog && scene.fogMode !== Scene.FOGMODE_NONE) {
      defines.push("#define FOG");
      if (uniforms.indexOf("view") === -1) {
        uniforms.push("view");
      }
      if (uniforms.indexOf("vFogInfos") === -1) {
        uniforms.push("vFogInfos");
      }
      if (uniforms.indexOf("vFogColor") === -1) {
        uniforms.push("vFogColor");
      }
    }
    if (this._useLogarithmicDepth) {
      defines.push("#define LOGARITHMICDEPTH");
      if (uniforms.indexOf("logarithmicDepthConstant") === -1) {
        uniforms.push("logarithmicDepthConstant");
      }
    }
    const renderingMesh = subMesh ? subMesh.getRenderingMesh() : mesh;
    if (renderingMesh && this.useVertexPulling) {
      const geometry = renderingMesh.geometry;
      if (geometry) {
        this._vertexPullingMetadata = PrepareVertexPullingUniforms(geometry);
        if (this._vertexPullingMetadata) {
          this._vertexPullingMetadata.forEach((_, attribute) => {
            uniforms.push(`vp_${attribute}_info`);
          });
        }
      }
      defines.push("#define USE_VERTEX_PULLING");
      const indexBuffer = renderingMesh.geometry?.getIndexBuffer();
      if (indexBuffer && !renderingMesh.isUnIndexed) {
        defines.push("#define VERTEX_PULLING_USE_INDEX_BUFFER");
        if (indexBuffer.is32Bits) {
          defines.push("#define VERTEX_PULLING_INDEX_BUFFER_32BITS");
        }
      }
    }
    if (this.customShaderNameResolve) {
      uniforms = uniforms.slice();
      uniformBuffers = uniformBuffers.slice();
      samplers = samplers.slice();
      shaderName = this.customShaderNameResolve(this.name, uniforms, uniformBuffers, samplers, defines, attribs);
    }
    const drawWrapper = storeEffectOnSubMeshes ? subMesh._getDrawWrapper(void 0, true) : this._drawWrapper;
    const previousEffect = drawWrapper?.effect ?? null;
    const previousDefines = drawWrapper?.defines ?? null;
    const join = defines.join("\n");
    let effect = previousEffect;
    if (previousDefines !== join) {
      effect = engine.createEffect(shaderName, {
        attributes: attribs,
        uniformsNames: uniforms,
        uniformBuffersNames: uniformBuffers,
        samplers,
        defines: join,
        fallbacks,
        onCompiled: this.onCompiled,
        onError: this.onError,
        indexParameters: { maxSimultaneousMorphTargets: numInfluencers },
        shaderLanguage: this._options.shaderLanguage,
        extraInitializationsAsync: this._options.extraInitializationsAsync
      }, engine);
      if (storeEffectOnSubMeshes) {
        subMesh.setEffect(effect, join, this._materialContext);
      } else if (drawWrapper) {
        drawWrapper.setEffect(effect, join);
      }
      if (this._onEffectCreatedObservable) {
        OnCreatedEffectParameters.effect = effect;
        OnCreatedEffectParameters.subMesh = subMesh ?? mesh?.subMeshes[0] ?? null;
        this._onEffectCreatedObservable.notifyObservers(OnCreatedEffectParameters);
      }
    }
    drawWrapper._wasPreviouslyUsingInstances = !!useInstances;
    if (!effect?.isReady()) {
      return false;
    }
    if (previousEffect !== effect) {
      scene.resetCachedMaterial();
    }
    drawWrapper._wasPreviouslyReady = true;
    return true;
  }
  /**
   * Binds the world matrix to the material
   * @param world defines the world transformation matrix
   * @param effectOverride - If provided, use this effect instead of internal effect
   */
  bindOnlyWorldMatrix(world, effectOverride) {
    const effect = effectOverride ?? this.getEffect();
    if (!effect) {
      return;
    }
    const uniforms = this._options.uniforms;
    if (uniforms.indexOf("world") !== -1) {
      effect.setMatrix("world", world);
    }
    const scene = this.getScene();
    if (uniforms.indexOf("worldView") !== -1) {
      world.multiplyToRef(scene.getViewMatrix(), this._cachedWorldViewMatrix);
      effect.setMatrix("worldView", this._cachedWorldViewMatrix);
    }
    if (uniforms.indexOf("worldViewProjection") !== -1) {
      world.multiplyToRef(scene.getTransformMatrix(), this._cachedWorldViewProjectionMatrix);
      effect.setMatrix("worldViewProjection", this._cachedWorldViewProjectionMatrix);
    }
    if (uniforms.indexOf("view") !== -1) {
      effect.setMatrix("view", scene.getViewMatrix());
    }
  }
  /**
   * Binds the submesh to this material by preparing the effect and shader to draw
   * @param world defines the world transformation matrix
   * @param mesh defines the mesh containing the submesh
   * @param subMesh defines the submesh to bind the material to
   */
  bindForSubMesh(world, mesh, subMesh) {
    this.bind(world, mesh, subMesh._drawWrapperOverride?.effect, subMesh);
  }
  /**
   * Binds the material to the mesh
   * @param world defines the world transformation matrix
   * @param mesh defines the mesh to bind the material to
   * @param effectOverride - If provided, use this effect instead of internal effect
   * @param subMesh defines the submesh to bind the material to
   */
  bind(world, mesh, effectOverride, subMesh) {
    const storeEffectOnSubMeshes = subMesh && this._storeEffectOnSubMeshes;
    const effect = effectOverride ?? (storeEffectOnSubMeshes ? subMesh.effect : this.getEffect());
    if (!effect) {
      return;
    }
    const scene = this.getScene();
    this._activeEffect = effect;
    this.bindOnlyWorldMatrix(world, effectOverride);
    const uniformBuffers = this._options.uniformBuffers;
    let useSceneUBO = false;
    if (effect && uniformBuffers && uniformBuffers.length > 0 && scene.getEngine().supportsUniformBuffers) {
      for (let i = 0; i < uniformBuffers.length; ++i) {
        const bufferName = uniformBuffers[i];
        switch (bufferName) {
          case "Mesh":
            if (mesh) {
              mesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
              mesh.transferToEffect(world);
            }
            break;
          case "Scene":
            BindSceneUniformBuffer(effect, scene.getSceneUniformBuffer());
            scene.finalizeSceneUbo();
            useSceneUBO = true;
            break;
        }
      }
    }
    const mustRebind = mesh && storeEffectOnSubMeshes ? this._mustRebind(scene, effect, subMesh, mesh.visibility) : scene.getCachedMaterial() !== this;
    if (effect && mustRebind) {
      if (!useSceneUBO && this._options.uniforms.indexOf("view") !== -1) {
        effect.setMatrix("view", scene.getViewMatrix());
      }
      if (!useSceneUBO && this._options.uniforms.indexOf("projection") !== -1) {
        effect.setMatrix("projection", scene.getProjectionMatrix());
      }
      if (!useSceneUBO && this._options.uniforms.indexOf("viewProjection") !== -1) {
        effect.setMatrix("viewProjection", scene.getTransformMatrix());
        if (this._multiview) {
          effect.setMatrix("viewProjectionR", scene._transformMatrixR);
        }
      }
      if (scene.activeCamera && this._options.uniforms.indexOf("cameraPosition") !== -1) {
        effect.setVector3("cameraPosition", scene.activeCamera.globalPosition);
      }
      BindBonesParameters(mesh, effect);
      BindClipPlane(effect, this, scene);
      if (this._vertexPullingMetadata) {
        BindVertexPullingUniforms(effect, this._vertexPullingMetadata);
      }
      if (this._useLogarithmicDepth) {
        BindLogDepth(storeEffectOnSubMeshes ? subMesh.materialDefines : effect.defines, effect, scene);
      }
      if (mesh) {
        BindFogParameters(scene, mesh, effect);
      }
      let name;
      for (name in this._textures) {
        effect.setTexture(name, this._textures[name]);
      }
      for (name in this._internalTextures) {
        effect._bindTexture(name, this._internalTextures[name]);
      }
      for (name in this._textureArrays) {
        effect.setTextureArray(name, this._textureArrays[name]);
      }
      for (name in this._ints) {
        effect.setInt(name, this._ints[name]);
      }
      for (name in this._uints) {
        effect.setUInt(name, this._uints[name]);
      }
      for (name in this._floats) {
        effect.setFloat(name, this._floats[name]);
      }
      for (name in this._floatsArrays) {
        effect.setArray(name, this._floatsArrays[name]);
      }
      for (name in this._colors3) {
        effect.setColor3(name, this._colors3[name]);
      }
      for (name in this._colors3Arrays) {
        effect.setArray3(name, this._colors3Arrays[name]);
      }
      for (name in this._colors4) {
        const color = this._colors4[name];
        effect.setFloat4(name, color.r, color.g, color.b, color.a);
      }
      for (name in this._colors4Arrays) {
        effect.setArray4(name, this._colors4Arrays[name]);
      }
      for (name in this._vectors2) {
        effect.setVector2(name, this._vectors2[name]);
      }
      for (name in this._vectors3) {
        effect.setVector3(name, this._vectors3[name]);
      }
      for (name in this._vectors4) {
        effect.setVector4(name, this._vectors4[name]);
      }
      for (name in this._quaternions) {
        effect.setQuaternion(name, this._quaternions[name]);
      }
      for (name in this._matrices) {
        effect.setMatrix(name, this._matrices[name]);
      }
      for (name in this._matrixArrays) {
        effect.setMatrices(name, this._matrixArrays[name]);
      }
      for (name in this._matrices3x3) {
        effect.setMatrix3x3(name, this._matrices3x3[name]);
      }
      for (name in this._matrices2x2) {
        effect.setMatrix2x2(name, this._matrices2x2[name]);
      }
      for (name in this._vectors2Arrays) {
        effect.setArray2(name, this._vectors2Arrays[name]);
      }
      for (name in this._vectors3Arrays) {
        effect.setArray3(name, this._vectors3Arrays[name]);
      }
      for (name in this._vectors4Arrays) {
        effect.setArray4(name, this._vectors4Arrays[name]);
      }
      for (name in this._quaternionsArrays) {
        effect.setArray4(name, this._quaternionsArrays[name]);
      }
      for (name in this._uniformBuffers) {
        const buffer = this._uniformBuffers[name].getBuffer();
        if (buffer) {
          effect.bindUniformBuffer(buffer, name);
        }
      }
      const engineWebGPU = scene.getEngine();
      const setExternalTexture = engineWebGPU.setExternalTexture;
      if (setExternalTexture) {
        for (name in this._externalTextures) {
          setExternalTexture.call(engineWebGPU, name, this._externalTextures[name]);
        }
      }
      const setTextureSampler = engineWebGPU.setTextureSampler;
      if (setTextureSampler) {
        for (name in this._textureSamplers) {
          setTextureSampler.call(engineWebGPU, name, this._textureSamplers[name]);
        }
      }
      const setStorageBuffer = engineWebGPU.setStorageBuffer;
      if (setStorageBuffer) {
        for (name in this._storageBuffers) {
          setStorageBuffer.call(engineWebGPU, name, this._storageBuffers[name]);
        }
      }
    }
    if (effect && mesh && (mustRebind || !this.isFrozen)) {
      BindMorphTargetParameters(mesh, effect);
      if (mesh.morphTargetManager && mesh.morphTargetManager.isUsingTextureForTargets) {
        mesh.morphTargetManager._bind(effect);
      }
      const bvaManager = mesh.bakedVertexAnimationManager;
      if (bvaManager && bvaManager.isEnabled) {
        const drawWrapper = storeEffectOnSubMeshes ? subMesh._drawWrapper : this._drawWrapper;
        mesh.bakedVertexAnimationManager?.bind(effect, !!drawWrapper._wasPreviouslyUsingInstances);
      }
    }
    this._afterBind(mesh, effect, subMesh);
  }
  /**
   * Gets the active textures from the material
   * @returns an array of textures
   */
  getActiveTextures() {
    const activeTextures = super.getActiveTextures();
    for (const name in this._textures) {
      activeTextures.push(this._textures[name]);
    }
    for (const name in this._textureArrays) {
      const array = this._textureArrays[name];
      for (let index = 0; index < array.length; index++) {
        activeTextures.push(array[index]);
      }
    }
    return activeTextures;
  }
  /**
   * Specifies if the material uses a texture
   * @param texture defines the texture to check against the material
   * @returns a boolean specifying if the material uses the texture
   */
  hasTexture(texture) {
    if (super.hasTexture(texture)) {
      return true;
    }
    for (const name in this._textures) {
      if (this._textures[name] === texture) {
        return true;
      }
    }
    const internalTexture = texture.getInternalTexture();
    for (const name in this._internalTextures) {
      if (this._internalTextures[name] === internalTexture) {
        return true;
      }
    }
    for (const name in this._textureArrays) {
      const array = this._textureArrays[name];
      for (let index = 0; index < array.length; index++) {
        if (array[index] === texture) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Makes a duplicate of the material, and gives it a new name
   * @param name defines the new name for the duplicated material
   * @returns the cloned material
   */
  clone(name) {
    const result = SerializationHelper.Clone(() => new _ShaderMaterial(name, this.getScene(), this._shaderPath, this._options, this._storeEffectOnSubMeshes), this);
    result.name = name;
    result.id = name;
    if (typeof result._shaderPath === "object") {
      result._shaderPath = { ...result._shaderPath };
    }
    this._options = { ...this._options };
    const keys = Object.keys(this._options);
    for (const propName of keys) {
      const propValue = this._options[propName];
      if (Array.isArray(propValue)) {
        this._options[propName] = propValue.slice(0);
      }
    }
    this.stencil.copyTo(result.stencil);
    for (const key in this._textures) {
      result.setTexture(key, this._textures[key]);
    }
    for (const key in this._internalTextures) {
      result.setInternalTexture(key, this._internalTextures[key]);
    }
    for (const key in this._textureArrays) {
      result.setTextureArray(key, this._textureArrays[key]);
    }
    for (const key in this._externalTextures) {
      result.setExternalTexture(key, this._externalTextures[key]);
    }
    for (const key in this._ints) {
      result.setInt(key, this._ints[key]);
    }
    for (const key in this._uints) {
      result.setUInt(key, this._uints[key]);
    }
    for (const key in this._floats) {
      result.setFloat(key, this._floats[key]);
    }
    for (const key in this._floatsArrays) {
      result.setFloats(key, this._floatsArrays[key]);
    }
    for (const key in this._colors3) {
      result.setColor3(key, this._colors3[key]);
    }
    for (const key in this._colors3Arrays) {
      result._colors3Arrays[key] = this._colors3Arrays[key];
    }
    for (const key in this._colors4) {
      result.setColor4(key, this._colors4[key]);
    }
    for (const key in this._colors4Arrays) {
      result._colors4Arrays[key] = this._colors4Arrays[key];
    }
    for (const key in this._vectors2) {
      result.setVector2(key, this._vectors2[key]);
    }
    for (const key in this._vectors3) {
      result.setVector3(key, this._vectors3[key]);
    }
    for (const key in this._vectors4) {
      result.setVector4(key, this._vectors4[key]);
    }
    for (const key in this._quaternions) {
      result.setQuaternion(key, this._quaternions[key]);
    }
    for (const key in this._quaternionsArrays) {
      result._quaternionsArrays[key] = this._quaternionsArrays[key];
    }
    for (const key in this._matrices) {
      result.setMatrix(key, this._matrices[key]);
    }
    for (const key in this._matrixArrays) {
      result._matrixArrays[key] = this._matrixArrays[key].slice();
    }
    for (const key in this._matrices3x3) {
      result.setMatrix3x3(key, this._matrices3x3[key]);
    }
    for (const key in this._matrices2x2) {
      result.setMatrix2x2(key, this._matrices2x2[key]);
    }
    for (const key in this._vectors2Arrays) {
      result.setArray2(key, this._vectors2Arrays[key]);
    }
    for (const key in this._vectors3Arrays) {
      result.setArray3(key, this._vectors3Arrays[key]);
    }
    for (const key in this._vectors4Arrays) {
      result.setArray4(key, this._vectors4Arrays[key]);
    }
    for (const key in this._uniformBuffers) {
      result.setUniformBuffer(key, this._uniformBuffers[key]);
    }
    for (const key in this._textureSamplers) {
      result.setTextureSampler(key, this._textureSamplers[key]);
    }
    for (const key in this._storageBuffers) {
      result.setStorageBuffer(key, this._storageBuffers[key]);
    }
    return result;
  }
  /**
   * Disposes the material
   * @param forceDisposeEffect specifies if effects should be forcefully disposed
   * @param forceDisposeTextures specifies if textures should be forcefully disposed
   * @param notBoundToMesh specifies if the material that is being disposed is known to be not bound to any mesh
   */
  dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh) {
    if (forceDisposeTextures) {
      let name;
      for (name in this._textures) {
        this._textures[name].dispose();
      }
      for (name in this._internalTextures) {
        this._internalTextures[name].dispose();
      }
      for (name in this._textureArrays) {
        const array = this._textureArrays[name];
        for (let index = 0; index < array.length; index++) {
          array[index].dispose();
        }
      }
    }
    this._textures = {};
    this._internalTextures = {};
    super.dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh);
  }
  /**
   * Serializes this material in a JSON representation
   * @returns the serialized material object
   */
  serialize() {
    const serializationObject = SerializationHelper.Serialize(this);
    serializationObject.customType = "BABYLON.ShaderMaterial";
    serializationObject.uniqueId = this.uniqueId;
    serializationObject.options = this._options;
    serializationObject.shaderPath = this._shaderPath;
    serializationObject.storeEffectOnSubMeshes = this._storeEffectOnSubMeshes;
    let name;
    serializationObject.stencil = this.stencil.serialize();
    serializationObject.textures = {};
    for (name in this._textures) {
      serializationObject.textures[name] = this._textures[name].serialize();
    }
    serializationObject.textureArrays = {};
    for (name in this._textureArrays) {
      serializationObject.textureArrays[name] = [];
      const array = this._textureArrays[name];
      for (let index = 0; index < array.length; index++) {
        serializationObject.textureArrays[name].push(array[index].serialize());
      }
    }
    serializationObject.ints = {};
    for (name in this._ints) {
      serializationObject.ints[name] = this._ints[name];
    }
    serializationObject.uints = {};
    for (name in this._uints) {
      serializationObject.uints[name] = this._uints[name];
    }
    serializationObject.floats = {};
    for (name in this._floats) {
      serializationObject.floats[name] = this._floats[name];
    }
    serializationObject.floatsArrays = {};
    for (name in this._floatsArrays) {
      serializationObject.floatsArrays[name] = this._floatsArrays[name];
    }
    serializationObject.colors3 = {};
    for (name in this._colors3) {
      const color3 = this._colors3[name];
      serializationObject.colors3[name] = [color3.r, color3.g, color3.b];
    }
    serializationObject.colors3Arrays = {};
    for (name in this._colors3Arrays) {
      serializationObject.colors3Arrays[name] = this._colors3Arrays[name];
    }
    serializationObject.colors4 = {};
    for (name in this._colors4) {
      const color4 = this._colors4[name];
      serializationObject.colors4[name] = [color4.r, color4.g, color4.b, color4.a];
    }
    serializationObject.colors4Arrays = {};
    for (name in this._colors4Arrays) {
      serializationObject.colors4Arrays[name] = this._colors4Arrays[name];
    }
    serializationObject.vectors2 = {};
    for (name in this._vectors2) {
      const v2 = this._vectors2[name];
      serializationObject.vectors2[name] = [v2.x, v2.y];
    }
    serializationObject.vectors3 = {};
    for (name in this._vectors3) {
      const v3 = this._vectors3[name];
      serializationObject.vectors3[name] = [v3.x, v3.y, v3.z];
    }
    serializationObject.vectors4 = {};
    for (name in this._vectors4) {
      const v4 = this._vectors4[name];
      serializationObject.vectors4[name] = [v4.x, v4.y, v4.z, v4.w];
    }
    serializationObject.quaternions = {};
    for (name in this._quaternions) {
      serializationObject.quaternions[name] = this._quaternions[name].asArray();
    }
    serializationObject.matrices = {};
    for (name in this._matrices) {
      serializationObject.matrices[name] = this._matrices[name].asArray();
    }
    serializationObject.matrixArray = {};
    for (name in this._matrixArrays) {
      serializationObject.matrixArray[name] = this._matrixArrays[name];
    }
    serializationObject.matrices3x3 = {};
    for (name in this._matrices3x3) {
      serializationObject.matrices3x3[name] = this._matrices3x3[name];
    }
    serializationObject.matrices2x2 = {};
    for (name in this._matrices2x2) {
      serializationObject.matrices2x2[name] = this._matrices2x2[name];
    }
    serializationObject.vectors2Arrays = {};
    for (name in this._vectors2Arrays) {
      serializationObject.vectors2Arrays[name] = this._vectors2Arrays[name];
    }
    serializationObject.vectors3Arrays = {};
    for (name in this._vectors3Arrays) {
      serializationObject.vectors3Arrays[name] = this._vectors3Arrays[name];
    }
    serializationObject.vectors4Arrays = {};
    for (name in this._vectors4Arrays) {
      serializationObject.vectors4Arrays[name] = this._vectors4Arrays[name];
    }
    serializationObject.quaternionsArrays = {};
    for (name in this._quaternionsArrays) {
      serializationObject.quaternionsArrays[name] = this._quaternionsArrays[name];
    }
    return serializationObject;
  }
  /**
   * Creates a shader material from parsed shader material data
   * @param source defines the JSON representation of the material
   * @param scene defines the hosting scene
   * @param rootUrl defines the root URL to use to load textures and relative dependencies
   * @returns a new material
   */
  static Parse(source, scene, rootUrl) {
    const material = SerializationHelper.Parse(() => new _ShaderMaterial(source.name, scene, source.shaderPath, source.options, source.storeEffectOnSubMeshes), source, scene, rootUrl);
    let name;
    if (source.stencil) {
      material.stencil.parse(source.stencil, scene, rootUrl);
    }
    for (name in source.textures) {
      material.setTexture(name, Texture.Parse(source.textures[name], scene, rootUrl));
    }
    for (name in source.textureArrays) {
      const array = source.textureArrays[name];
      const textureArray = [];
      for (let index = 0; index < array.length; index++) {
        textureArray.push(Texture.Parse(array[index], scene, rootUrl));
      }
      material.setTextureArray(name, textureArray);
    }
    for (name in source.ints) {
      material.setInt(name, source.ints[name]);
    }
    for (name in source.uints) {
      material.setUInt(name, source.uints[name]);
    }
    for (name in source.floats) {
      material.setFloat(name, source.floats[name]);
    }
    for (name in source.floatsArrays) {
      material.setFloats(name, source.floatsArrays[name]);
    }
    for (name in source.colors3) {
      const color = source.colors3[name];
      material.setColor3(name, { r: color[0], g: color[1], b: color[2] });
    }
    for (name in source.colors3Arrays) {
      const colors = source.colors3Arrays[name].reduce((arr, num, i) => {
        if (i % 3 === 0) {
          arr.push([num]);
        } else {
          arr[arr.length - 1].push(num);
        }
        return arr;
      }, []).map((color) => ({ r: color[0], g: color[1], b: color[2] }));
      material.setColor3Array(name, colors);
    }
    for (name in source.colors4) {
      const color = source.colors4[name];
      material.setColor4(name, { r: color[0], g: color[1], b: color[2], a: color[3] });
    }
    for (name in source.colors4Arrays) {
      const colors = source.colors4Arrays[name].reduce((arr, num, i) => {
        if (i % 4 === 0) {
          arr.push([num]);
        } else {
          arr[arr.length - 1].push(num);
        }
        return arr;
      }, []).map((color) => ({ r: color[0], g: color[1], b: color[2], a: color[3] }));
      material.setColor4Array(name, colors);
    }
    for (name in source.vectors2) {
      const vector = source.vectors2[name];
      material.setVector2(name, { x: vector[0], y: vector[1] });
    }
    for (name in source.vectors3) {
      const vector = source.vectors3[name];
      material.setVector3(name, { x: vector[0], y: vector[1], z: vector[2] });
    }
    for (name in source.vectors4) {
      const vector = source.vectors4[name];
      material.setVector4(name, { x: vector[0], y: vector[1], z: vector[2], w: vector[3] });
    }
    for (name in source.quaternions) {
      material.setQuaternion(name, Quaternion.FromArray(source.quaternions[name]));
    }
    for (name in source.matrices) {
      material.setMatrix(name, Matrix.FromArray(source.matrices[name]));
    }
    for (name in source.matrixArray) {
      material._matrixArrays[name] = new Float32Array(source.matrixArray[name]);
    }
    for (name in source.matrices3x3) {
      material.setMatrix3x3(name, source.matrices3x3[name]);
    }
    for (name in source.matrices2x2) {
      material.setMatrix2x2(name, source.matrices2x2[name]);
    }
    for (name in source.vectors2Arrays) {
      material.setArray2(name, source.vectors2Arrays[name]);
    }
    for (name in source.vectors3Arrays) {
      material.setArray3(name, source.vectors3Arrays[name]);
    }
    for (name in source.vectors4Arrays) {
      material.setArray4(name, source.vectors4Arrays[name]);
    }
    for (name in source.quaternionsArrays) {
      material.setArray4(name, source.quaternionsArrays[name]);
    }
    return material;
  }
  /**
   * Creates a new ShaderMaterial from a snippet saved in a remote file
   * @param name defines the name of the ShaderMaterial to create (can be null or empty to use the one from the json data)
   * @param url defines the url to load from
   * @param scene defines the hosting scene
   * @param rootUrl defines the root URL to use to load textures and relative dependencies
   * @returns a promise that will resolve to the new ShaderMaterial
   */
  static async ParseFromFileAsync(name, url, scene, rootUrl = "") {
    return await new Promise((resolve, reject) => {
      const request = new WebRequest();
      request.addEventListener("readystatechange", () => {
        if (request.readyState == 4) {
          if (request.status == 200) {
            const serializationObject = JSON.parse(request.responseText);
            const output = this.Parse(serializationObject, scene || EngineStore.LastCreatedScene, rootUrl);
            if (name) {
              output.name = name;
            }
            resolve(output);
          } else {
            reject("Unable to load the ShaderMaterial");
          }
        }
      });
      request.open("GET", url);
      request.send();
    });
  }
  /**
   * Creates a ShaderMaterial from a snippet saved by the Inspector
   * @param snippetId defines the snippet to load
   * @param scene defines the hosting scene
   * @param rootUrl defines the root URL to use to load textures and relative dependencies
   * @returns a promise that will resolve to the new ShaderMaterial
   */
  static async ParseFromSnippetAsync(snippetId, scene, rootUrl = "") {
    return await new Promise((resolve, reject) => {
      const request = new WebRequest();
      request.addEventListener("readystatechange", () => {
        if (request.readyState == 4) {
          if (request.status == 200) {
            const snippet = JSON.parse(JSON.parse(request.responseText).jsonPayload);
            const serializationObject = JSON.parse(snippet.shaderMaterial);
            const output = this.Parse(serializationObject, scene || EngineStore.LastCreatedScene, rootUrl);
            output.snippetId = snippetId;
            resolve(output);
          } else {
            reject("Unable to load the snippet " + snippetId);
          }
        }
      });
      request.open("GET", this.SnippetUrl + "/" + snippetId.replace(/#/g, "/"));
      request.send();
    });
  }
};
ShaderMaterial.SnippetUrl = `https://snippet.babylonjs.com`;
ShaderMaterial.CreateFromSnippetAsync = ShaderMaterial.ParseFromSnippetAsync;
RegisterClass("BABYLON.ShaderMaterial", ShaderMaterial);

export {
  InstancedMesh,
  ShaderMaterial
};
//# sourceMappingURL=chunk-R77K32ZW.js.map
