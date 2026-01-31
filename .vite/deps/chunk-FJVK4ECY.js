import {
  BlurPostProcess
} from "./chunk-INKIDW57.js";
import {
  PostProcess
} from "./chunk-FTNKZQKS.js";
import {
  RenderTargetTexture
} from "./chunk-5THHQJAG.js";
import {
  EffectFallbacks
} from "./chunk-XDMWCM3S.js";
import {
  AddClipPlaneUniforms,
  BindClipPlane,
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
  DrawWrapper
} from "./chunk-LY4CWJEX.js";
import {
  Light
} from "./chunk-7EDSNBQ5.js";
import {
  RenderingManager
} from "./chunk-WOKXMMT7.js";
import {
  FloatingOriginCurrentScene,
  GetFullOffsetViewProjectionToRef
} from "./chunk-EWHDDCCY.js";
import {
  VertexBuffer
} from "./chunk-ZOIT5ZEZ.js";
import {
  Color4
} from "./chunk-I3IYKWNG.js";
import {
  _WarnImport
} from "./chunk-MMWR3MO4.js";
import {
  Matrix,
  TmpVectors,
  Vector2,
  Vector3
} from "./chunk-YLLTSBLI.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Lights/Shadows/shadowGenerator.js
var ShadowGenerator = class _ShadowGenerator {
  /**
   * Gets the bias: offset applied on the depth preventing acnea (in light direction).
   */
  get bias() {
    return this._bias;
  }
  /**
   * Sets the bias: offset applied on the depth preventing acnea (in light direction).
   */
  set bias(bias) {
    this._bias = bias;
  }
  /**
   * Gets the normalBias: offset applied on the depth preventing acnea (along side the normal direction and proportional to the light/normal angle).
   */
  get normalBias() {
    return this._normalBias;
  }
  /**
   * Sets the normalBias: offset applied on the depth preventing acnea (along side the normal direction and proportional to the light/normal angle).
   */
  set normalBias(normalBias) {
    this._normalBias = normalBias;
  }
  /**
   * Gets the blur box offset: offset applied during the blur pass.
   * Only useful if useKernelBlur = false
   */
  get blurBoxOffset() {
    return this._blurBoxOffset;
  }
  /**
   * Sets the blur box offset: offset applied during the blur pass.
   * Only useful if useKernelBlur = false
   */
  set blurBoxOffset(value) {
    if (this._blurBoxOffset === value) {
      return;
    }
    this._blurBoxOffset = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets the blur scale: scale of the blurred texture compared to the main shadow map.
   * 2 means half of the size.
   */
  get blurScale() {
    return this._blurScale;
  }
  /**
   * Sets the blur scale: scale of the blurred texture compared to the main shadow map.
   * 2 means half of the size.
   */
  set blurScale(value) {
    if (this._blurScale === value) {
      return;
    }
    this._blurScale = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets the blur kernel: kernel size of the blur pass.
   * Only useful if useKernelBlur = true
   */
  get blurKernel() {
    return this._blurKernel;
  }
  /**
   * Sets the blur kernel: kernel size of the blur pass.
   * Only useful if useKernelBlur = true
   */
  set blurKernel(value) {
    if (this._blurKernel === value) {
      return;
    }
    this._blurKernel = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets whether the blur pass is a kernel blur (if true) or box blur.
   * Only useful in filtered mode (useBlurExponentialShadowMap...)
   */
  get useKernelBlur() {
    return this._useKernelBlur;
  }
  /**
   * Sets whether the blur pass is a kernel blur (if true) or box blur.
   * Only useful in filtered mode (useBlurExponentialShadowMap...)
   */
  set useKernelBlur(value) {
    if (this._useKernelBlur === value) {
      return;
    }
    this._useKernelBlur = value;
    this._disposeBlurPostProcesses();
  }
  /**
   * Gets the depth scale used in ESM mode.
   */
  get depthScale() {
    return this._depthScale !== void 0 ? this._depthScale : this._light.getDepthScale();
  }
  /**
   * Sets the depth scale used in ESM mode.
   * This can override the scale stored on the light.
   */
  set depthScale(value) {
    this._depthScale = value;
  }
  _validateFilter(filter) {
    return filter;
  }
  /**
   * Gets the current mode of the shadow generator (normal, PCF, ESM...).
   * The returned value is a number equal to one of the available mode defined in ShadowMap.FILTER_x like _FILTER_NONE
   */
  get filter() {
    return this._filter;
  }
  /**
   * Sets the current mode of the shadow generator (normal, PCF, ESM...).
   * The returned value is a number equal to one of the available mode defined in ShadowMap.FILTER_x like _FILTER_NONE
   */
  set filter(value) {
    value = this._validateFilter(value);
    if (this._light.needCube()) {
      if (value === _ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP) {
        this.useExponentialShadowMap = true;
        return;
      } else if (value === _ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP) {
        this.useCloseExponentialShadowMap = true;
        return;
      } else if (value === _ShadowGenerator.FILTER_PCF || value === _ShadowGenerator.FILTER_PCSS) {
        this.usePoissonSampling = true;
        return;
      }
    }
    if (value === _ShadowGenerator.FILTER_PCF || value === _ShadowGenerator.FILTER_PCSS) {
      if (!this._scene.getEngine()._features.supportShadowSamplers) {
        this.usePoissonSampling = true;
        return;
      }
    }
    if (this._filter === value) {
      return;
    }
    this._filter = value;
    this._disposeBlurPostProcesses();
    this._applyFilterValues();
    this._light._markMeshesAsLightDirty();
  }
  /**
   * Gets if the current filter is set to Poisson Sampling.
   */
  get usePoissonSampling() {
    return this.filter === _ShadowGenerator.FILTER_POISSONSAMPLING;
  }
  /**
   * Sets the current filter to Poisson Sampling.
   */
  set usePoissonSampling(value) {
    const filter = this._validateFilter(_ShadowGenerator.FILTER_POISSONSAMPLING);
    if (!value && this.filter !== _ShadowGenerator.FILTER_POISSONSAMPLING) {
      return;
    }
    this.filter = value ? filter : _ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to ESM.
   */
  get useExponentialShadowMap() {
    return this.filter === _ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP;
  }
  /**
   * Sets the current filter is to ESM.
   */
  set useExponentialShadowMap(value) {
    const filter = this._validateFilter(_ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP);
    if (!value && this.filter !== _ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : _ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to filtered ESM.
   */
  get useBlurExponentialShadowMap() {
    return this.filter === _ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP;
  }
  /**
   * Gets if the current filter is set to filtered  ESM.
   */
  set useBlurExponentialShadowMap(value) {
    const filter = this._validateFilter(_ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP);
    if (!value && this.filter !== _ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : _ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  get useCloseExponentialShadowMap() {
    return this.filter === _ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP;
  }
  /**
   * Sets the current filter to "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  set useCloseExponentialShadowMap(value) {
    const filter = this._validateFilter(_ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP);
    if (!value && this.filter !== _ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : _ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to filtered "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  get useBlurCloseExponentialShadowMap() {
    return this.filter === _ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP;
  }
  /**
   * Sets the current filter to filtered "close ESM" (using the inverse of the
   * exponential to prevent steep falloff artifacts).
   */
  set useBlurCloseExponentialShadowMap(value) {
    const filter = this._validateFilter(_ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP);
    if (!value && this.filter !== _ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP) {
      return;
    }
    this.filter = value ? filter : _ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets if the current filter is set to "PCF" (percentage closer filtering).
   */
  get usePercentageCloserFiltering() {
    return this.filter === _ShadowGenerator.FILTER_PCF;
  }
  /**
   * Sets the current filter to "PCF" (percentage closer filtering).
   */
  set usePercentageCloserFiltering(value) {
    const filter = this._validateFilter(_ShadowGenerator.FILTER_PCF);
    if (!value && this.filter !== _ShadowGenerator.FILTER_PCF) {
      return;
    }
    this.filter = value ? filter : _ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets the PCF or PCSS Quality.
   * Only valid if usePercentageCloserFiltering or usePercentageCloserFiltering is true.
   */
  get filteringQuality() {
    return this._filteringQuality;
  }
  /**
   * Sets the PCF or PCSS Quality.
   * Only valid if usePercentageCloserFiltering or usePercentageCloserFiltering is true.
   */
  set filteringQuality(filteringQuality) {
    if (this._filteringQuality === filteringQuality) {
      return;
    }
    this._filteringQuality = filteringQuality;
    this._disposeBlurPostProcesses();
    this._applyFilterValues();
    this._light._markMeshesAsLightDirty();
  }
  /**
   * Gets if the current filter is set to "PCSS" (contact hardening).
   */
  get useContactHardeningShadow() {
    return this.filter === _ShadowGenerator.FILTER_PCSS;
  }
  /**
   * Sets the current filter to "PCSS" (contact hardening).
   */
  set useContactHardeningShadow(value) {
    const filter = this._validateFilter(_ShadowGenerator.FILTER_PCSS);
    if (!value && this.filter !== _ShadowGenerator.FILTER_PCSS) {
      return;
    }
    this.filter = value ? filter : _ShadowGenerator.FILTER_NONE;
  }
  /**
   * Gets the Light Size (in shadow map uv unit) used in PCSS to determine the blocker search area and the penumbra size.
   * Using a ratio helps keeping shape stability independently of the map size.
   *
   * It does not account for the light projection as it was having too much
   * instability during the light setup or during light position changes.
   *
   * Only valid if useContactHardeningShadow is true.
   */
  get contactHardeningLightSizeUVRatio() {
    return this._contactHardeningLightSizeUVRatio;
  }
  /**
   * Sets the Light Size (in shadow map uv unit) used in PCSS to determine the blocker search area and the penumbra size.
   * Using a ratio helps keeping shape stability independently of the map size.
   *
   * It does not account for the light projection as it was having too much
   * instability during the light setup or during light position changes.
   *
   * Only valid if useContactHardeningShadow is true.
   */
  set contactHardeningLightSizeUVRatio(contactHardeningLightSizeUVRatio) {
    this._contactHardeningLightSizeUVRatio = contactHardeningLightSizeUVRatio;
  }
  /** Gets or sets the actual darkness of a shadow */
  get darkness() {
    return this._darkness;
  }
  set darkness(value) {
    this.setDarkness(value);
  }
  /**
   * Returns the darkness value (float). This can only decrease the actual darkness of a shadow.
   * 0 means strongest and 1 would means no shadow.
   * @returns the darkness.
   */
  getDarkness() {
    return this._darkness;
  }
  /**
   * Sets the darkness value (float). This can only decrease the actual darkness of a shadow.
   * @param darkness The darkness value 0 means strongest and 1 would means no shadow.
   * @returns the shadow generator allowing fluent coding.
   */
  setDarkness(darkness) {
    if (darkness >= 1) {
      this._darkness = 1;
    } else if (darkness <= 0) {
      this._darkness = 0;
    } else {
      this._darkness = darkness;
    }
    return this;
  }
  /** Gets or sets the ability to have transparent shadow */
  get transparencyShadow() {
    return this._transparencyShadow;
  }
  set transparencyShadow(value) {
    this.setTransparencyShadow(value);
  }
  /**
   * Sets the ability to have transparent shadow (boolean).
   * @param transparent True if transparent else False
   * @returns the shadow generator allowing fluent coding
   */
  setTransparencyShadow(transparent) {
    this._transparencyShadow = transparent;
    return this;
  }
  /**
   * Gets the main RTT containing the shadow map (usually storing depth from the light point of view).
   * @returns The render target texture if present otherwise, null
   */
  getShadowMap() {
    return this._shadowMap;
  }
  /**
   * Gets the RTT used during rendering (can be a blurred version of the shadow map or the shadow map itself).
   * @returns The render target texture if the shadow map is present otherwise, null
   */
  getShadowMapForRendering() {
    if (this._shadowMap2) {
      return this._shadowMap2;
    }
    return this._shadowMap;
  }
  /**
   * Gets the class name of that object
   * @returns "ShadowGenerator"
   */
  getClassName() {
    return _ShadowGenerator.CLASSNAME;
  }
  /**
   * Helper function to add a mesh and its descendants to the list of shadow casters.
   * @param mesh Mesh to add
   * @param includeDescendants boolean indicating if the descendants should be added. Default to true
   * @returns the Shadow Generator itself
   */
  addShadowCaster(mesh, includeDescendants = true) {
    if (!this._shadowMap) {
      return this;
    }
    if (!this._shadowMap.renderList) {
      this._shadowMap.renderList = [];
    }
    if (this._shadowMap.renderList.indexOf(mesh) === -1) {
      this._shadowMap.renderList.push(mesh);
    }
    if (includeDescendants) {
      for (const childMesh of mesh.getChildMeshes()) {
        if (this._shadowMap.renderList.indexOf(childMesh) === -1) {
          this._shadowMap.renderList.push(childMesh);
        }
      }
    }
    return this;
  }
  /**
   * Helper function to remove a mesh and its descendants from the list of shadow casters
   * @param mesh Mesh to remove
   * @param includeDescendants boolean indicating if the descendants should be removed. Default to true
   * @returns the Shadow Generator itself
   */
  removeShadowCaster(mesh, includeDescendants = true) {
    if (!this._shadowMap || !this._shadowMap.renderList) {
      return this;
    }
    const index = this._shadowMap.renderList.indexOf(mesh);
    if (index !== -1) {
      this._shadowMap.renderList.splice(index, 1);
    }
    if (includeDescendants) {
      for (const child of mesh.getChildren()) {
        this.removeShadowCaster(child);
      }
    }
    return this;
  }
  /**
   * Returns the associated light object.
   * @returns the light generating the shadow
   */
  getLight() {
    return this._light;
  }
  /**
   * Gets the shader language used in this generator.
   */
  get shaderLanguage() {
    return this._shaderLanguage;
  }
  _getCamera() {
    return this._camera ?? this._scene.activeCamera;
  }
  /**
   * Gets or sets the size of the texture what stores the shadows
   */
  get mapSize() {
    return this._mapSize;
  }
  set mapSize(size) {
    this._mapSize = size;
    this._light._markMeshesAsLightDirty();
    this.recreateShadowMap();
  }
  /**
   * Creates a ShadowGenerator object.
   * A ShadowGenerator is the required tool to use the shadows.
   * Each light casting shadows needs to use its own ShadowGenerator.
   * Documentation : https://doc.babylonjs.com/features/featuresDeepDive/lights/shadows
   * @param mapSize The size of the texture what stores the shadows. Example : 1024.
   * @param light The light object generating the shadows.
   * @param usefullFloatFirst By default the generator will try to use half float textures but if you need precision (for self shadowing for instance), you can use this option to enforce full float texture.
   * @param camera Camera associated with this shadow generator (default: null). If null, takes the scene active camera at the time we need to access it
   * @param useRedTextureType Forces the generator to use a Red instead of a RGBA type for the shadow map texture format (default: false)
   * @param forceGLSL defines a boolean indicating if the shader must be compiled in GLSL even if we are using WebGPU
   */
  constructor(mapSize, light, usefullFloatFirst, camera, useRedTextureType, forceGLSL = false) {
    this.onBeforeShadowMapRenderObservable = new Observable();
    this.onAfterShadowMapRenderObservable = new Observable();
    this.onBeforeShadowMapRenderMeshObservable = new Observable();
    this.onAfterShadowMapRenderMeshObservable = new Observable();
    this.doNotSerialize = false;
    this._bias = 5e-5;
    this._normalBias = 0;
    this._blurBoxOffset = 1;
    this._blurScale = 2;
    this._blurKernel = 1;
    this._useKernelBlur = false;
    this._filter = _ShadowGenerator.FILTER_NONE;
    this._filteringQuality = _ShadowGenerator.QUALITY_HIGH;
    this._contactHardeningLightSizeUVRatio = 0.1;
    this._darkness = 0;
    this._transparencyShadow = false;
    this.enableSoftTransparentShadow = false;
    this.useOpacityTextureForTransparentShadow = false;
    this.frustumEdgeFalloff = 0;
    this._shaderLanguage = 0;
    this.forceBackFacesOnly = false;
    this._lightDirection = Vector3.Zero();
    this._viewMatrix = Matrix.Zero();
    this._projectionMatrix = Matrix.Zero();
    this._transformMatrix = Matrix.Zero();
    this._cachedPosition = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._cachedDirection = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    this._currentFaceIndex = 0;
    this._currentFaceIndexCache = 0;
    this._defaultTextureMatrix = Matrix.Identity();
    this._shadersLoaded = false;
    this._mapSize = mapSize;
    this._light = light;
    this._scene = light.getScene();
    this._camera = camera ?? null;
    this._useRedTextureType = !!useRedTextureType;
    this._initShaderSourceAsync(forceGLSL);
    let shadowGenerators = light._shadowGenerators;
    if (!shadowGenerators) {
      shadowGenerators = light._shadowGenerators = /* @__PURE__ */ new Map();
    }
    shadowGenerators.set(this._camera, this);
    this.id = light.id;
    this._useUBO = this._scene.getEngine().supportsUniformBuffers;
    if (this._useUBO) {
      this._sceneUBOs = [];
      this._sceneUBOs.push(this._scene.createSceneUniformBuffer(`Scene for Shadow Generator (light "${this._light.name}")`));
    }
    _ShadowGenerator._SceneComponentInitialization(this._scene);
    const caps = this._scene.getEngine().getCaps();
    if (!usefullFloatFirst) {
      if (caps.textureHalfFloatRender && caps.textureHalfFloatLinearFiltering) {
        this._textureType = 2;
      } else if (caps.textureFloatRender && caps.textureFloatLinearFiltering) {
        this._textureType = 1;
      } else {
        this._textureType = 0;
      }
    } else {
      if (caps.textureFloatRender && caps.textureFloatLinearFiltering) {
        this._textureType = 1;
      } else if (caps.textureHalfFloatRender && caps.textureHalfFloatLinearFiltering) {
        this._textureType = 2;
      } else {
        this._textureType = 0;
      }
    }
    this._initializeGenerator();
    this._applyFilterValues();
  }
  _initializeGenerator() {
    this._light._markMeshesAsLightDirty();
    this._initializeShadowMap();
  }
  _createTargetRenderTexture() {
    const engine = this._scene.getEngine();
    this._shadowMap?.dispose();
    if (engine._features.supportDepthStencilTexture) {
      this._shadowMap = new RenderTargetTexture(this._light.name + "_shadowMap", this._mapSize, this._scene, false, true, this._textureType, this._light.needCube(), void 0, false, false, void 0, this._useRedTextureType ? 6 : 5);
      this._shadowMap.createDepthStencilTexture(engine.useReverseDepthBuffer ? 516 : 513, true, void 0, void 0, void 0, `DepthStencilForShadowGenerator-${this._light.name}`);
    } else {
      this._shadowMap = new RenderTargetTexture(this._light.name + "_shadowMap", this._mapSize, this._scene, false, true, this._textureType, this._light.needCube());
    }
    this._shadowMap.noPrePassRenderer = true;
  }
  _initializeShadowMap() {
    this._createTargetRenderTexture();
    if (this._shadowMap === null) {
      return;
    }
    this._shadowMap.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._shadowMap.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._shadowMap.anisotropicFilteringLevel = 1;
    this._shadowMap.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    this._shadowMap.renderParticles = false;
    this._shadowMap.ignoreCameraViewport = true;
    if (this._storedUniqueId) {
      this._shadowMap.uniqueId = this._storedUniqueId;
    }
    this._shadowMap.customRenderFunction = (opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes) => this._renderForShadowMap(opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes);
    this._shadowMap.customIsReadyFunction = (mesh, _refreshRate, preWarm) => {
      if (!preWarm || !mesh.subMeshes) {
        return true;
      }
      let isReady = true;
      for (const subMesh of mesh.subMeshes) {
        const renderingMesh = subMesh.getRenderingMesh();
        const scene = this._scene;
        const engine2 = scene.getEngine();
        const material = subMesh.getMaterial();
        if (!material || subMesh.verticesCount === 0 || this.customAllowRendering && !this.customAllowRendering(subMesh)) {
          continue;
        }
        const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
        if (batch.mustReturn) {
          continue;
        }
        const hardwareInstancedRendering = engine2.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null && batch.visibleInstances[subMesh._id] !== void 0 || renderingMesh.hasThinInstances);
        const isTransparent = material.needAlphaBlendingForMesh(renderingMesh);
        isReady = this.isReady(subMesh, hardwareInstancedRendering, isTransparent) && isReady;
      }
      return isReady;
    };
    const engine = this._scene.getEngine();
    this._shadowMap.onBeforeBindObservable.add(() => {
      this._currentSceneUBO = this._scene.getSceneUniformBuffer();
      if (engine._enableGPUDebugMarkers) {
        engine.restoreDefaultFramebuffer();
        engine._debugPushGroup?.(`Shadow map generation for pass id ${engine.currentRenderPassId}`);
      }
    });
    this._shadowMap.onBeforeRenderObservable.add((faceIndex) => {
      if (this._sceneUBOs) {
        this._scene.setSceneUniformBuffer(this._sceneUBOs[0]);
      }
      this._currentFaceIndex = faceIndex;
      if (this._filter === _ShadowGenerator.FILTER_PCF) {
        engine.setColorWrite(false);
      }
      this.getTransformMatrix();
      FloatingOriginCurrentScene.eyeAtCamera = false;
      this._scene.setTransformMatrix(this._viewMatrix, this._projectionMatrix);
      if (this._useUBO) {
        this._scene.getSceneUniformBuffer().unbindEffect();
        this._scene.finalizeSceneUbo();
      }
    });
    this._shadowMap.onAfterUnbindObservable.add(() => {
      if (this._sceneUBOs) {
        this._scene.setSceneUniformBuffer(this._currentSceneUBO);
      }
      FloatingOriginCurrentScene.eyeAtCamera = true;
      this._scene.updateTransformMatrix();
      if (this._filter === _ShadowGenerator.FILTER_PCF) {
        engine.setColorWrite(true);
      }
      if (!this.useBlurExponentialShadowMap && !this.useBlurCloseExponentialShadowMap) {
        engine._debugPopGroup?.();
        return;
      }
      const shadowMap = this.getShadowMapForRendering();
      if (shadowMap) {
        this._scene.postProcessManager.directRender(this._blurPostProcesses, shadowMap.renderTarget, true);
        engine.unBindFramebuffer(shadowMap.renderTarget, true);
      }
      if (engine._enableGPUDebugMarkers) {
        engine._debugPopGroup?.();
      }
    });
    const clearZero = new Color4(0, 0, 0, 0);
    const clearOne = new Color4(1, 1, 1, 1);
    this._shadowMap.onClearObservable.add((engine2) => {
      if (this._filter === _ShadowGenerator.FILTER_PCF) {
        engine2.clear(clearOne, false, true, false);
      } else if (this.useExponentialShadowMap || this.useBlurExponentialShadowMap) {
        engine2.clear(clearZero, true, true, false);
      } else {
        engine2.clear(clearOne, true, true, false);
      }
    });
    this._shadowMap.onResizeObservable.add((rtt) => {
      this._storedUniqueId = this._shadowMap.uniqueId;
      this._mapSize = rtt.getRenderSize();
      this._light._markMeshesAsLightDirty();
      this.recreateShadowMap();
    });
    for (let i = RenderingManager.MIN_RENDERINGGROUPS; i < RenderingManager.MAX_RENDERINGGROUPS; i++) {
      this._shadowMap.setRenderingAutoClearDepthStencil(i, false);
    }
  }
  async _initShaderSourceAsync(forceGLSL = false) {
    const engine = this._scene.getEngine();
    if (engine.isWebGPU && !forceGLSL && !_ShadowGenerator.ForceGLSL) {
      this._shaderLanguage = 1;
      await Promise.all([
        import("./shadowMap.fragment-FQJZ2WOS.js"),
        import("./shadowMap.vertex-LAXXXLSX.js"),
        import("./depthBoxBlur.fragment-SY2ENM7N.js"),
        import("./shadowMapFragmentSoftTransparentShadow-CJPQ3DF5.js")
      ]);
    } else {
      await Promise.all([
        import("./shadowMap.fragment-FWCT5CSM.js"),
        import("./shadowMap.vertex-AJLBMVGE.js"),
        import("./depthBoxBlur.fragment-C3DJHVXC.js"),
        import("./shadowMapFragmentSoftTransparentShadow-HXUMIOR4.js")
      ]);
    }
    this._shadersLoaded = true;
  }
  _initializeBlurRTTAndPostProcesses() {
    const engine = this._scene.getEngine();
    const targetSize = this._mapSize / this.blurScale;
    if (!this.useKernelBlur || this.blurScale !== 1) {
      this._shadowMap2 = new RenderTargetTexture(this._light.name + "_shadowMap2", targetSize, this._scene, false, true, this._textureType, void 0, void 0, false);
      this._shadowMap2.wrapU = Texture.CLAMP_ADDRESSMODE;
      this._shadowMap2.wrapV = Texture.CLAMP_ADDRESSMODE;
      this._shadowMap2.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    }
    if (this.useKernelBlur) {
      this._kernelBlurXPostprocess = new BlurPostProcess(this._light.name + "KernelBlurX", new Vector2(1, 0), this.blurKernel, 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._textureType);
      this._kernelBlurXPostprocess.width = targetSize;
      this._kernelBlurXPostprocess.height = targetSize;
      this._kernelBlurXPostprocess.externalTextureSamplerBinding = true;
      this._kernelBlurXPostprocess.onApplyObservable.add((effect) => {
        effect.setTexture("textureSampler", this._shadowMap);
      });
      this._kernelBlurYPostprocess = new BlurPostProcess(this._light.name + "KernelBlurY", new Vector2(0, 1), this.blurKernel, 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._textureType);
      this._kernelBlurXPostprocess.autoClear = false;
      this._kernelBlurYPostprocess.autoClear = false;
      if (this._textureType === 0) {
        this._kernelBlurXPostprocess.packedFloat = true;
        this._kernelBlurYPostprocess.packedFloat = true;
      }
      this._blurPostProcesses = [this._kernelBlurXPostprocess, this._kernelBlurYPostprocess];
    } else {
      this._boxBlurPostprocess = new PostProcess(this._light.name + "DepthBoxBlur", "depthBoxBlur", ["screenSize", "boxOffset"], [], 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, "#define OFFSET " + this._blurBoxOffset, this._textureType, void 0, void 0, void 0, void 0, this._shaderLanguage);
      this._boxBlurPostprocess.externalTextureSamplerBinding = true;
      this._boxBlurPostprocess.onApplyObservable.add((effect) => {
        effect.setFloat2("screenSize", targetSize, targetSize);
        effect.setTexture("textureSampler", this._shadowMap);
      });
      this._boxBlurPostprocess.autoClear = false;
      this._blurPostProcesses = [this._boxBlurPostprocess];
    }
  }
  _renderForShadowMap(opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes) {
    let index;
    if (depthOnlySubMeshes.length) {
      for (index = 0; index < depthOnlySubMeshes.length; index++) {
        this._renderSubMeshForShadowMap(depthOnlySubMeshes.data[index]);
      }
    }
    for (index = 0; index < opaqueSubMeshes.length; index++) {
      this._renderSubMeshForShadowMap(opaqueSubMeshes.data[index]);
    }
    for (index = 0; index < alphaTestSubMeshes.length; index++) {
      this._renderSubMeshForShadowMap(alphaTestSubMeshes.data[index]);
    }
    if (this._transparencyShadow) {
      for (index = 0; index < transparentSubMeshes.length; index++) {
        this._renderSubMeshForShadowMap(transparentSubMeshes.data[index], true);
      }
    } else {
      for (index = 0; index < transparentSubMeshes.length; index++) {
        transparentSubMeshes.data[index].getEffectiveMesh()._internalAbstractMeshDataInfo._isActiveIntermediate = false;
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _bindCustomEffectForRenderSubMeshForShadowMap(subMesh, effect, mesh) {
    effect.setMatrix("viewProjection", this.getTransformMatrix());
  }
  _renderSubMeshForShadowMap(subMesh, isTransparent = false) {
    const renderingMesh = subMesh.getRenderingMesh();
    const effectiveMesh = subMesh.getEffectiveMesh();
    const scene = this._scene;
    const engine = scene.getEngine();
    const material = subMesh.getMaterial();
    effectiveMesh._internalAbstractMeshDataInfo._isActiveIntermediate = false;
    if (!material || subMesh.verticesCount === 0 || subMesh._renderId === scene.getRenderId()) {
      return;
    }
    const useRHS = scene.useRightHandedSystem;
    const detNeg = effectiveMesh._getWorldMatrixDeterminant() < 0;
    let sideOrientation = material._getEffectiveOrientation(renderingMesh);
    if (detNeg && !useRHS || !detNeg && useRHS) {
      sideOrientation = sideOrientation === 0 ? 1 : 0;
    }
    const reverseSideOrientation = sideOrientation === 0;
    engine.setState(material.backFaceCulling, void 0, void 0, reverseSideOrientation, material.cullBackFaces);
    const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
    if (batch.mustReturn) {
      return;
    }
    const hardwareInstancedRendering = engine.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null && batch.visibleInstances[subMesh._id] !== void 0 || renderingMesh.hasThinInstances);
    if (this.customAllowRendering && !this.customAllowRendering(subMesh)) {
      return;
    }
    if (this.isReady(subMesh, hardwareInstancedRendering, isTransparent)) {
      subMesh._renderId = scene.getRenderId();
      const shadowDepthWrapper = material.shadowDepthWrapper;
      const drawWrapper = shadowDepthWrapper?.getEffect(subMesh, this, engine.currentRenderPassId) ?? subMesh._getDrawWrapper();
      const effect = DrawWrapper.GetEffect(drawWrapper);
      engine.enableEffect(drawWrapper);
      if (!hardwareInstancedRendering) {
        renderingMesh._bind(subMesh, effect, material.fillMode);
      }
      this.getTransformMatrix();
      effect.setFloat3("biasAndScaleSM", this.bias, this.normalBias, this.depthScale);
      if (this.getLight().getTypeID() === Light.LIGHTTYPEID_DIRECTIONALLIGHT) {
        effect.setVector3("lightDataSM", this._cachedDirection);
      } else {
        effect.setVector3("lightDataSM", this._cachedPosition.subtractToRef(this._scene.floatingOriginOffset, TmpVectors.Vector3[0]));
      }
      const camera = this._getCamera();
      effect.setFloat2("depthValuesSM", this.getLight().getDepthMinZ(camera), this.getLight().getDepthMinZ(camera) + this.getLight().getDepthMaxZ(camera));
      if (isTransparent && this.enableSoftTransparentShadow) {
        effect.setFloat2("softTransparentShadowSM", effectiveMesh.visibility * material.alpha, this._opacityTexture?.getAlphaFromRGB ? 1 : 0);
      }
      if (shadowDepthWrapper) {
        subMesh._setMainDrawWrapperOverride(drawWrapper);
        if (shadowDepthWrapper.standalone) {
          shadowDepthWrapper.baseMaterial.bindForSubMesh(effectiveMesh.getWorldMatrix(), renderingMesh, subMesh);
        } else {
          material.bindForSubMesh(effectiveMesh.getWorldMatrix(), renderingMesh, subMesh);
        }
        subMesh._setMainDrawWrapperOverride(null);
      } else {
        if (this._opacityTexture) {
          effect.setTexture("diffuseSampler", this._opacityTexture);
          effect.setMatrix("diffuseMatrix", this._opacityTexture.getTextureMatrix() || this._defaultTextureMatrix);
        }
        if (renderingMesh.useBones && renderingMesh.computeBonesUsingShaders && renderingMesh.skeleton) {
          const skeleton = renderingMesh.skeleton;
          if (skeleton.isUsingTextureForMatrices) {
            const boneTexture = skeleton.getTransformMatrixTexture(renderingMesh);
            if (!boneTexture) {
              return;
            }
            effect.setTexture("boneSampler", boneTexture);
            effect.setFloat("boneTextureWidth", 4 * (skeleton.bones.length + 1));
          } else {
            effect.setMatrices("mBones", skeleton.getTransformMatrices(renderingMesh));
          }
        }
        BindMorphTargetParameters(renderingMesh, effect);
        if (renderingMesh.morphTargetManager && renderingMesh.morphTargetManager.isUsingTextureForTargets) {
          renderingMesh.morphTargetManager._bind(effect);
        }
        const bvaManager = subMesh.getMesh().bakedVertexAnimationManager;
        if (bvaManager && bvaManager.isEnabled) {
          bvaManager.bind(effect, hardwareInstancedRendering);
        }
        BindClipPlane(effect, material, scene);
      }
      if (!this._useUBO && !shadowDepthWrapper) {
        this._bindCustomEffectForRenderSubMeshForShadowMap(subMesh, effect, effectiveMesh);
      }
      BindSceneUniformBuffer(effect, this._scene.getSceneUniformBuffer());
      this._scene.getSceneUniformBuffer().bindUniformBuffer();
      const world = effectiveMesh.getWorldMatrix();
      if (hardwareInstancedRendering) {
        effectiveMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
        effectiveMesh.transferToEffect(world);
      }
      if (this.forceBackFacesOnly) {
        engine.setState(true, 0, false, true, material.cullBackFaces);
      }
      this.onBeforeShadowMapRenderMeshObservable.notifyObservers(renderingMesh);
      this.onBeforeShadowMapRenderObservable.notifyObservers(effect);
      renderingMesh._processRendering(effectiveMesh, subMesh, effect, material.fillMode, batch, hardwareInstancedRendering, (isInstance, worldOverride) => {
        if (effectiveMesh !== renderingMesh && !isInstance) {
          renderingMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
          renderingMesh.transferToEffect(worldOverride);
        } else {
          effectiveMesh.getMeshUniformBuffer().bindToEffect(effect, "Mesh");
          effectiveMesh.transferToEffect(isInstance ? worldOverride : world);
        }
      });
      if (this.forceBackFacesOnly) {
        engine.setState(true, 0, false, false, material.cullBackFaces);
      }
      this.onAfterShadowMapRenderObservable.notifyObservers(effect);
      this.onAfterShadowMapRenderMeshObservable.notifyObservers(renderingMesh);
    } else {
      if (this._shadowMap) {
        this._shadowMap.resetRefreshCounter();
      }
    }
  }
  _applyFilterValues() {
    if (!this._shadowMap) {
      return;
    }
    if (this.filter === _ShadowGenerator.FILTER_NONE || this.filter === _ShadowGenerator.FILTER_PCSS) {
      this._shadowMap.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    } else {
      this._shadowMap.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
    }
  }
  /**
   * Forces all the attached effect to compile to enable rendering only once ready vs. lazily compiling effects.
   * @param onCompiled Callback triggered at the and of the effects compilation
   * @param options Sets of optional options forcing the compilation with different modes
   */
  forceCompilation(onCompiled, options) {
    const localOptions = {
      useInstances: false,
      ...options
    };
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      if (onCompiled) {
        onCompiled(this);
      }
      return;
    }
    const renderList = shadowMap.renderList;
    if (!renderList) {
      if (onCompiled) {
        onCompiled(this);
      }
      return;
    }
    const subMeshes = [];
    for (const mesh of renderList) {
      subMeshes.push(...mesh.subMeshes);
    }
    if (subMeshes.length === 0) {
      if (onCompiled) {
        onCompiled(this);
      }
      return;
    }
    let currentIndex = 0;
    const checkReady = () => {
      if (!this._scene || !this._scene.getEngine()) {
        return;
      }
      while (this.isReady(subMeshes[currentIndex], localOptions.useInstances, subMeshes[currentIndex].getMaterial()?.needAlphaBlendingForMesh(subMeshes[currentIndex].getMesh()) ?? false)) {
        currentIndex++;
        if (currentIndex >= subMeshes.length) {
          if (onCompiled) {
            onCompiled(this);
          }
          return;
        }
      }
      setTimeout(checkReady, 16);
    };
    checkReady();
  }
  /**
   * Forces all the attached effect to compile to enable rendering only once ready vs. lazily compiling effects.
   * @param options Sets of optional options forcing the compilation with different modes
   * @returns A promise that resolves when the compilation completes
   */
  async forceCompilationAsync(options) {
    return await new Promise((resolve) => {
      this.forceCompilation(() => {
        resolve();
      }, options);
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isReadyCustomDefines(defines, subMesh, useInstances) {
  }
  _prepareShadowDefines(subMesh, useInstances, defines, isTransparent) {
    defines.push("#define SM_LIGHTTYPE_" + this._light.getClassName().toUpperCase());
    defines.push("#define SM_FLOAT " + (this._textureType !== 0 ? "1" : "0"));
    defines.push("#define SM_ESM " + (this.useExponentialShadowMap || this.useBlurExponentialShadowMap ? "1" : "0"));
    defines.push("#define SM_DEPTHTEXTURE " + (this.usePercentageCloserFiltering || this.useContactHardeningShadow ? "1" : "0"));
    const mesh = subMesh.getMesh();
    defines.push("#define SM_NORMALBIAS " + (this.normalBias && mesh.isVerticesDataPresent(VertexBuffer.NormalKind) ? "1" : "0"));
    defines.push("#define SM_DIRECTIONINLIGHTDATA " + (this.getLight().getTypeID() === Light.LIGHTTYPEID_DIRECTIONALLIGHT ? "1" : "0"));
    defines.push("#define SM_USEDISTANCE " + (this._light.needCube() ? "1" : "0"));
    defines.push("#define SM_SOFTTRANSPARENTSHADOW " + (this.enableSoftTransparentShadow && isTransparent ? "1" : "0"));
    this._isReadyCustomDefines(defines, subMesh, useInstances);
    return defines;
  }
  /**
   * Determine whether the shadow generator is ready or not (mainly all effects and related post processes needs to be ready).
   * @param subMesh The submesh we want to render in the shadow map
   * @param useInstances Defines whether will draw in the map using instances
   * @param isTransparent Indicates that isReady is called for a transparent subMesh
   * @returns true if ready otherwise, false
   */
  isReady(subMesh, useInstances, isTransparent) {
    if (!this._shadersLoaded) {
      return false;
    }
    const material = subMesh.getMaterial(), shadowDepthWrapper = material?.shadowDepthWrapper;
    this._opacityTexture = null;
    if (!material) {
      return false;
    }
    const defines = [];
    this._prepareShadowDefines(subMesh, useInstances, defines, isTransparent);
    if (shadowDepthWrapper) {
      if (!shadowDepthWrapper.isReadyForSubMesh(subMesh, defines, this, useInstances, this._scene.getEngine().currentRenderPassId)) {
        return false;
      }
    } else {
      const subMeshEffect = subMesh._getDrawWrapper(void 0, true);
      let effect = subMeshEffect.effect;
      let cachedDefines = subMeshEffect.defines;
      const attribs = [VertexBuffer.PositionKind];
      const mesh = subMesh.getMesh();
      let useNormal = false;
      let uv1 = false;
      let uv2 = false;
      const color = false;
      if (this.normalBias && mesh.isVerticesDataPresent(VertexBuffer.NormalKind)) {
        attribs.push(VertexBuffer.NormalKind);
        defines.push("#define NORMAL");
        useNormal = true;
        if (mesh.nonUniformScaling) {
          defines.push("#define NONUNIFORMSCALING");
        }
      }
      const needAlphaTesting = material.needAlphaTestingForMesh(mesh);
      if (needAlphaTesting || material.needAlphaBlendingForMesh(mesh)) {
        if (this.useOpacityTextureForTransparentShadow) {
          this._opacityTexture = material.opacityTexture;
        } else {
          this._opacityTexture = material.getAlphaTestTexture();
        }
        if (this._opacityTexture) {
          if (!this._opacityTexture.isReady()) {
            return false;
          }
          const alphaCutOff = material.alphaCutOff ?? _ShadowGenerator.DEFAULT_ALPHA_CUTOFF;
          defines.push("#define ALPHATEXTURE");
          if (needAlphaTesting) {
            defines.push(`#define ALPHATESTVALUE ${alphaCutOff}${alphaCutOff % 1 === 0 ? "." : ""}`);
          }
          if (mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
            attribs.push(VertexBuffer.UVKind);
            defines.push("#define UV1");
            uv1 = true;
          }
          if (mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) {
            if (this._opacityTexture.coordinatesIndex === 1) {
              attribs.push(VertexBuffer.UV2Kind);
              defines.push("#define UV2");
              uv2 = true;
            }
          }
        }
      }
      const fallbacks = new EffectFallbacks();
      if (mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton) {
        attribs.push(VertexBuffer.MatricesIndicesKind);
        attribs.push(VertexBuffer.MatricesWeightsKind);
        if (mesh.numBoneInfluencers > 4) {
          attribs.push(VertexBuffer.MatricesIndicesExtraKind);
          attribs.push(VertexBuffer.MatricesWeightsExtraKind);
        }
        const skeleton = mesh.skeleton;
        defines.push("#define NUM_BONE_INFLUENCERS " + mesh.numBoneInfluencers);
        if (mesh.numBoneInfluencers > 0) {
          fallbacks.addCPUSkinningFallback(0, mesh);
        }
        if (skeleton.isUsingTextureForMatrices) {
          defines.push("#define BONETEXTURE");
        } else {
          defines.push("#define BonesPerMesh " + (skeleton.bones.length + 1));
        }
      } else {
        defines.push("#define NUM_BONE_INFLUENCERS 0");
      }
      const numMorphInfluencers = mesh.morphTargetManager ? PrepareDefinesAndAttributesForMorphTargets(
        mesh.morphTargetManager,
        defines,
        attribs,
        mesh,
        true,
        // usePositionMorph
        useNormal,
        // useNormalMorph
        false,
        // useTangentMorph
        uv1,
        // useUVMorph
        uv2,
        // useUV2Morph
        color
        // useColorMorph
      ) : 0;
      PrepareStringDefinesForClipPlanes(material, this._scene, defines);
      if (useInstances) {
        defines.push("#define INSTANCES");
        PushAttributesForInstances(attribs);
        if (subMesh.getRenderingMesh().hasThinInstances) {
          defines.push("#define THIN_INSTANCES");
        }
      }
      if (this.customShaderOptions) {
        if (this.customShaderOptions.defines) {
          for (const define of this.customShaderOptions.defines) {
            if (defines.indexOf(define) === -1) {
              defines.push(define);
            }
          }
        }
      }
      const bvaManager = mesh.bakedVertexAnimationManager;
      if (bvaManager && bvaManager.isEnabled) {
        defines.push("#define BAKED_VERTEX_ANIMATION_TEXTURE");
        if (useInstances) {
          attribs.push("bakedVertexAnimationSettingsInstanced");
        }
      }
      const join = defines.join("\n");
      if (cachedDefines !== join) {
        cachedDefines = join;
        let shaderName = "shadowMap";
        const uniforms = [
          "world",
          "mBones",
          "viewProjection",
          "diffuseMatrix",
          "lightDataSM",
          "depthValuesSM",
          "biasAndScaleSM",
          "morphTargetInfluences",
          "morphTargetCount",
          "boneTextureWidth",
          "softTransparentShadowSM",
          "morphTargetTextureInfo",
          "morphTargetTextureIndices",
          "bakedVertexAnimationSettings",
          "bakedVertexAnimationTextureSizeInverted",
          "bakedVertexAnimationTime",
          "bakedVertexAnimationTexture"
        ];
        const samplers = ["diffuseSampler", "boneSampler", "morphTargets", "bakedVertexAnimationTexture"];
        const uniformBuffers = ["Scene", "Mesh"];
        AddClipPlaneUniforms(uniforms);
        if (this.customShaderOptions) {
          shaderName = this.customShaderOptions.shaderName;
          if (this.customShaderOptions.attributes) {
            for (const attrib of this.customShaderOptions.attributes) {
              if (attribs.indexOf(attrib) === -1) {
                attribs.push(attrib);
              }
            }
          }
          if (this.customShaderOptions.uniforms) {
            for (const uniform of this.customShaderOptions.uniforms) {
              if (uniforms.indexOf(uniform) === -1) {
                uniforms.push(uniform);
              }
            }
          }
          if (this.customShaderOptions.samplers) {
            for (const sampler of this.customShaderOptions.samplers) {
              if (samplers.indexOf(sampler) === -1) {
                samplers.push(sampler);
              }
            }
          }
        }
        const engine = this._scene.getEngine();
        effect = engine.createEffect(shaderName, {
          attributes: attribs,
          uniformsNames: uniforms,
          uniformBuffersNames: uniformBuffers,
          samplers,
          defines: join,
          fallbacks,
          onCompiled: null,
          onError: null,
          indexParameters: { maxSimultaneousMorphTargets: numMorphInfluencers },
          shaderLanguage: this._shaderLanguage
        }, engine);
        subMeshEffect.setEffect(effect, cachedDefines);
      }
      if (!effect.isReady()) {
        return false;
      }
    }
    if (this.useBlurExponentialShadowMap || this.useBlurCloseExponentialShadowMap) {
      if (!this._blurPostProcesses || !this._blurPostProcesses.length) {
        this._initializeBlurRTTAndPostProcesses();
      }
    }
    if (this._kernelBlurXPostprocess && !this._kernelBlurXPostprocess.isReady()) {
      return false;
    }
    if (this._kernelBlurYPostprocess && !this._kernelBlurYPostprocess.isReady()) {
      return false;
    }
    if (this._boxBlurPostprocess && !this._boxBlurPostprocess.isReady()) {
      return false;
    }
    return true;
  }
  /**
   * Prepare all the defines in a material relying on a shadow map at the specified light index.
   * @param defines Defines of the material we want to update
   * @param lightIndex Index of the light in the enabled light list of the material
   */
  prepareDefines(defines, lightIndex) {
    const scene = this._scene;
    const light = this._light;
    if (!scene.shadowsEnabled || !light.shadowEnabled) {
      return;
    }
    defines["SHADOW" + lightIndex] = true;
    if (this.useContactHardeningShadow) {
      defines["SHADOWPCSS" + lightIndex] = true;
      if (this._filteringQuality === _ShadowGenerator.QUALITY_LOW) {
        defines["SHADOWLOWQUALITY" + lightIndex] = true;
      } else if (this._filteringQuality === _ShadowGenerator.QUALITY_MEDIUM) {
        defines["SHADOWMEDIUMQUALITY" + lightIndex] = true;
      }
    } else if (this.usePercentageCloserFiltering) {
      defines["SHADOWPCF" + lightIndex] = true;
      if (this._filteringQuality === _ShadowGenerator.QUALITY_LOW) {
        defines["SHADOWLOWQUALITY" + lightIndex] = true;
      } else if (this._filteringQuality === _ShadowGenerator.QUALITY_MEDIUM) {
        defines["SHADOWMEDIUMQUALITY" + lightIndex] = true;
      }
    } else if (this.usePoissonSampling) {
      defines["SHADOWPOISSON" + lightIndex] = true;
    } else if (this.useExponentialShadowMap || this.useBlurExponentialShadowMap) {
      defines["SHADOWESM" + lightIndex] = true;
    } else if (this.useCloseExponentialShadowMap || this.useBlurCloseExponentialShadowMap) {
      defines["SHADOWCLOSEESM" + lightIndex] = true;
    }
    if (light.needCube()) {
      defines["SHADOWCUBE" + lightIndex] = true;
    }
  }
  /**
   * Binds the shadow related information inside of an effect (information like near, far, darkness...
   * defined in the generator but impacting the effect).
   * @param lightIndex Index of the light in the enabled light list of the material owning the effect
   * @param effect The effect we are binding the information for
   */
  bindShadowLight(lightIndex, effect) {
    const light = this._light;
    const scene = this._scene;
    if (!scene.shadowsEnabled || !light.shadowEnabled) {
      return;
    }
    const camera = this._getCamera();
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      return;
    }
    if (!light.needCube()) {
      const offset = scene.floatingOriginOffset;
      const transform = this.getTransformMatrix();
      const lightMatrix = scene.floatingOriginMode ? GetFullOffsetViewProjectionToRef(offset, this._viewMatrix, this._projectionMatrix, TmpVectors.Matrix[0]) : transform;
      effect.setMatrix("lightMatrix" + lightIndex, lightMatrix);
    }
    const shadowMapForRendering = this.getShadowMapForRendering();
    if (this._filter === _ShadowGenerator.FILTER_PCF) {
      effect.setDepthStencilTexture("shadowTexture" + lightIndex, shadowMapForRendering);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), shadowMap.getSize().width, 1 / shadowMap.getSize().width, this.frustumEdgeFalloff, lightIndex);
    } else if (this._filter === _ShadowGenerator.FILTER_PCSS) {
      effect.setDepthStencilTexture("shadowTexture" + lightIndex, shadowMapForRendering);
      effect.setTexture("depthTexture" + lightIndex, shadowMapForRendering);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), 1 / shadowMap.getSize().width, this._contactHardeningLightSizeUVRatio * shadowMap.getSize().width, this.frustumEdgeFalloff, lightIndex);
    } else {
      effect.setTexture("shadowTexture" + lightIndex, shadowMapForRendering);
      light._uniformBuffer.updateFloat4("shadowsInfo", this.getDarkness(), this.blurScale / shadowMap.getSize().width, this.depthScale, this.frustumEdgeFalloff, lightIndex);
    }
    light._uniformBuffer.updateFloat2("depthValues", this.getLight().getDepthMinZ(camera), this.getLight().getDepthMinZ(camera) + this.getLight().getDepthMaxZ(camera), lightIndex);
  }
  /**
   * Gets the view matrix used to render the shadow map.
   */
  get viewMatrix() {
    return this._viewMatrix;
  }
  /**
   * Gets the projection matrix used to render the shadow map.
   */
  get projectionMatrix() {
    return this._projectionMatrix;
  }
  /**
   * Gets the transformation matrix used to project the meshes into the map from the light point of view.
   * (eq to shadow projection matrix * light transform matrix)
   * @returns The transform matrix used to create the shadow map
   */
  getTransformMatrix() {
    const scene = this._scene;
    if (this._currentRenderId === scene.getRenderId() && this._currentFaceIndexCache === this._currentFaceIndex) {
      return this._transformMatrix;
    }
    this._currentRenderId = scene.getRenderId();
    this._currentFaceIndexCache = this._currentFaceIndex;
    let lightPosition = this._light.position;
    if (this._light.computeTransformedInformation()) {
      lightPosition = this._light.transformedPosition;
    }
    Vector3.NormalizeToRef(this._light.getShadowDirection(this._currentFaceIndex), this._lightDirection);
    if (Math.abs(Vector3.Dot(this._lightDirection, Vector3.Up())) === 1) {
      this._lightDirection.z = 1e-13;
    }
    if (this._light.needProjectionMatrixCompute() || !this._cachedPosition || !this._cachedDirection || !lightPosition.equals(this._cachedPosition) || !this._lightDirection.equals(this._cachedDirection)) {
      this._cachedPosition.copyFrom(lightPosition);
      this._cachedDirection.copyFrom(this._lightDirection);
      Matrix.LookAtLHToRef(lightPosition, lightPosition.add(this._lightDirection), Vector3.Up(), this._viewMatrix);
      const shadowMap = this.getShadowMap();
      if (shadowMap) {
        const renderList = shadowMap.renderList;
        if (renderList) {
          this._light.setShadowProjectionMatrix(this._projectionMatrix, this._viewMatrix, renderList);
        }
      }
      this._viewMatrix.multiplyToRef(this._projectionMatrix, this._transformMatrix);
    }
    return this._transformMatrix;
  }
  /**
   * Recreates the shadow map dependencies like RTT and post processes. This can be used during the switch between
   * Cube and 2D textures for instance.
   */
  recreateShadowMap() {
    const shadowMap = this._shadowMap;
    if (!shadowMap) {
      return;
    }
    const renderList = shadowMap.renderList;
    this._disposeRTTandPostProcesses();
    this._initializeGenerator();
    this.filter = this._filter;
    this._applyFilterValues();
    if (renderList) {
      if (!this._shadowMap.renderList) {
        this._shadowMap.renderList = [];
      }
      for (const mesh of renderList) {
        this._shadowMap.renderList.push(mesh);
      }
    } else {
      this._shadowMap.renderList = null;
    }
  }
  _disposeBlurPostProcesses() {
    if (this._shadowMap2) {
      this._shadowMap2.dispose();
      this._shadowMap2 = null;
    }
    if (this._boxBlurPostprocess) {
      this._boxBlurPostprocess.dispose();
      this._boxBlurPostprocess = null;
    }
    if (this._kernelBlurXPostprocess) {
      this._kernelBlurXPostprocess.dispose();
      this._kernelBlurXPostprocess = null;
    }
    if (this._kernelBlurYPostprocess) {
      this._kernelBlurYPostprocess.dispose();
      this._kernelBlurYPostprocess = null;
    }
    this._blurPostProcesses = [];
  }
  _disposeRTTandPostProcesses() {
    if (this._shadowMap) {
      this._shadowMap.dispose();
      this._shadowMap = null;
    }
    this._disposeBlurPostProcesses();
  }
  _disposeSceneUBOs() {
    if (this._sceneUBOs) {
      for (const ubo of this._sceneUBOs) {
        ubo.dispose();
      }
      this._sceneUBOs = [];
    }
  }
  /**
   * Disposes the ShadowGenerator.
   * Returns nothing.
   */
  dispose() {
    this._disposeRTTandPostProcesses();
    this._disposeSceneUBOs();
    if (this._light) {
      if (this._light._shadowGenerators) {
        const iterator = this._light._shadowGenerators.entries();
        for (let entry = iterator.next(); entry.done !== true; entry = iterator.next()) {
          const [camera, shadowGenerator] = entry.value;
          if (shadowGenerator === this) {
            this._light._shadowGenerators.delete(camera);
          }
        }
        if (this._light._shadowGenerators.size === 0) {
          this._light._shadowGenerators = null;
        }
      }
      this._light._markMeshesAsLightDirty();
    }
    this.onBeforeShadowMapRenderMeshObservable.clear();
    this.onBeforeShadowMapRenderObservable.clear();
    this.onAfterShadowMapRenderMeshObservable.clear();
    this.onAfterShadowMapRenderObservable.clear();
  }
  /**
   * Serializes the shadow generator setup to a json object.
   * @returns The serialized JSON object
   */
  serialize() {
    const serializationObject = {};
    const shadowMap = this.getShadowMap();
    if (!shadowMap) {
      return serializationObject;
    }
    serializationObject.className = this.getClassName();
    serializationObject.lightId = this._light.id;
    serializationObject.cameraId = this._camera?.id;
    serializationObject.id = this.id;
    serializationObject.mapSize = shadowMap.getRenderSize();
    serializationObject.forceBackFacesOnly = this.forceBackFacesOnly;
    serializationObject.darkness = this.getDarkness();
    serializationObject.transparencyShadow = this._transparencyShadow;
    serializationObject.frustumEdgeFalloff = this.frustumEdgeFalloff;
    serializationObject.bias = this.bias;
    serializationObject.normalBias = this.normalBias;
    serializationObject.usePercentageCloserFiltering = this.usePercentageCloserFiltering;
    serializationObject.useContactHardeningShadow = this.useContactHardeningShadow;
    serializationObject.contactHardeningLightSizeUVRatio = this.contactHardeningLightSizeUVRatio;
    serializationObject.filteringQuality = this.filteringQuality;
    serializationObject.useExponentialShadowMap = this.useExponentialShadowMap;
    serializationObject.useBlurExponentialShadowMap = this.useBlurExponentialShadowMap;
    serializationObject.useCloseExponentialShadowMap = this.useBlurExponentialShadowMap;
    serializationObject.useBlurCloseExponentialShadowMap = this.useBlurExponentialShadowMap;
    serializationObject.usePoissonSampling = this.usePoissonSampling;
    serializationObject.depthScale = this.depthScale;
    serializationObject.blurBoxOffset = this.blurBoxOffset;
    serializationObject.blurKernel = this.blurKernel;
    serializationObject.blurScale = this.blurScale;
    serializationObject.useKernelBlur = this.useKernelBlur;
    serializationObject.renderList = [];
    if (shadowMap.renderList) {
      for (let meshIndex = 0; meshIndex < shadowMap.renderList.length; meshIndex++) {
        const mesh = shadowMap.renderList[meshIndex];
        serializationObject.renderList.push(mesh.id);
      }
    }
    return serializationObject;
  }
  /**
   * Parses a serialized ShadowGenerator and returns a new ShadowGenerator.
   * @param parsedShadowGenerator The JSON object to parse
   * @param scene The scene to create the shadow map for
   * @param constr A function that builds a shadow generator or undefined to create an instance of the default shadow generator
   * @returns The parsed shadow generator
   */
  static Parse(parsedShadowGenerator, scene, constr) {
    const light = scene.getLightById(parsedShadowGenerator.lightId);
    const camera = parsedShadowGenerator.cameraId !== void 0 ? scene.getCameraById(parsedShadowGenerator.cameraId) : null;
    const shadowGenerator = constr ? constr(parsedShadowGenerator.mapSize, light, camera) : new _ShadowGenerator(parsedShadowGenerator.mapSize, light, void 0, camera);
    const shadowMap = shadowGenerator.getShadowMap();
    if (parsedShadowGenerator.renderList.length && shadowMap) {
      const renderSet = new Set(parsedShadowGenerator.renderList);
      let renderList = shadowMap.renderList;
      if (!renderList) {
        renderList = shadowMap.renderList = [];
      }
      const meshes = scene.meshes;
      for (const mesh of meshes) {
        if (renderSet.has(mesh.id)) {
          renderList.push(mesh);
        }
      }
    }
    if (parsedShadowGenerator.id !== void 0) {
      shadowGenerator.id = parsedShadowGenerator.id;
    }
    shadowGenerator.forceBackFacesOnly = !!parsedShadowGenerator.forceBackFacesOnly;
    if (parsedShadowGenerator.darkness !== void 0) {
      shadowGenerator.setDarkness(parsedShadowGenerator.darkness);
    }
    if (parsedShadowGenerator.transparencyShadow) {
      shadowGenerator.setTransparencyShadow(true);
    }
    if (parsedShadowGenerator.frustumEdgeFalloff !== void 0) {
      shadowGenerator.frustumEdgeFalloff = parsedShadowGenerator.frustumEdgeFalloff;
    }
    if (parsedShadowGenerator.bias !== void 0) {
      shadowGenerator.bias = parsedShadowGenerator.bias;
    }
    if (parsedShadowGenerator.normalBias !== void 0) {
      shadowGenerator.normalBias = parsedShadowGenerator.normalBias;
    }
    if (parsedShadowGenerator.usePercentageCloserFiltering) {
      shadowGenerator.usePercentageCloserFiltering = true;
    } else if (parsedShadowGenerator.useContactHardeningShadow) {
      shadowGenerator.useContactHardeningShadow = true;
    } else if (parsedShadowGenerator.usePoissonSampling) {
      shadowGenerator.usePoissonSampling = true;
    } else if (parsedShadowGenerator.useExponentialShadowMap) {
      shadowGenerator.useExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useBlurExponentialShadowMap) {
      shadowGenerator.useBlurExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useCloseExponentialShadowMap) {
      shadowGenerator.useCloseExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useBlurCloseExponentialShadowMap) {
      shadowGenerator.useBlurCloseExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useVarianceShadowMap) {
      shadowGenerator.useExponentialShadowMap = true;
    } else if (parsedShadowGenerator.useBlurVarianceShadowMap) {
      shadowGenerator.useBlurExponentialShadowMap = true;
    }
    if (parsedShadowGenerator.contactHardeningLightSizeUVRatio !== void 0) {
      shadowGenerator.contactHardeningLightSizeUVRatio = parsedShadowGenerator.contactHardeningLightSizeUVRatio;
    }
    if (parsedShadowGenerator.filteringQuality !== void 0) {
      shadowGenerator.filteringQuality = parsedShadowGenerator.filteringQuality;
    }
    if (parsedShadowGenerator.depthScale) {
      shadowGenerator.depthScale = parsedShadowGenerator.depthScale;
    }
    if (parsedShadowGenerator.blurScale) {
      shadowGenerator.blurScale = parsedShadowGenerator.blurScale;
    }
    if (parsedShadowGenerator.blurBoxOffset) {
      shadowGenerator.blurBoxOffset = parsedShadowGenerator.blurBoxOffset;
    }
    if (parsedShadowGenerator.useKernelBlur) {
      shadowGenerator.useKernelBlur = parsedShadowGenerator.useKernelBlur;
    }
    if (parsedShadowGenerator.blurKernel) {
      shadowGenerator.blurKernel = parsedShadowGenerator.blurKernel;
    }
    return shadowGenerator;
  }
};
ShadowGenerator.CLASSNAME = "ShadowGenerator";
ShadowGenerator.ForceGLSL = false;
ShadowGenerator.FILTER_NONE = 0;
ShadowGenerator.FILTER_EXPONENTIALSHADOWMAP = 1;
ShadowGenerator.FILTER_POISSONSAMPLING = 2;
ShadowGenerator.FILTER_BLUREXPONENTIALSHADOWMAP = 3;
ShadowGenerator.FILTER_CLOSEEXPONENTIALSHADOWMAP = 4;
ShadowGenerator.FILTER_BLURCLOSEEXPONENTIALSHADOWMAP = 5;
ShadowGenerator.FILTER_PCF = 6;
ShadowGenerator.FILTER_PCSS = 7;
ShadowGenerator.QUALITY_HIGH = 0;
ShadowGenerator.QUALITY_MEDIUM = 1;
ShadowGenerator.QUALITY_LOW = 2;
ShadowGenerator.DEFAULT_ALPHA_CUTOFF = 0.5;
ShadowGenerator._SceneComponentInitialization = (_) => {
  throw _WarnImport("ShadowGeneratorSceneComponent");
};

export {
  ShadowGenerator
};
//# sourceMappingURL=chunk-FJVK4ECY.js.map
