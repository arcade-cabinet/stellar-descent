import {
  Camera
} from "./chunk-CESSEMZQ.js";
import {
  RenderTargetTexture
} from "./chunk-5THHQJAG.js";
import {
  EffectFallbacks
} from "./chunk-XDMWCM3S.js";
import {
  AddClipPlaneUniforms,
  BindBonesParameters,
  BindClipPlane,
  BindMorphTargetParameters,
  PrepareDefinesAndAttributesForMorphTargets,
  PrepareStringDefinesForClipPlanes,
  PushAttributesForInstances
} from "./chunk-TJZRBYWF.js";
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import {
  VertexBuffer
} from "./chunk-ZOIT5ZEZ.js";
import {
  Color4
} from "./chunk-I3IYKWNG.js";
import {
  _WarnImport
} from "./chunk-MMWR3MO4.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Rendering/depthRenderer.js
var DepthRenderer = class _DepthRenderer {
  /**
   * Gets the shader language used in this material.
   */
  get shaderLanguage() {
    return this._shaderLanguage;
  }
  /**
   * Sets a specific material to be used to render a mesh/a list of meshes by the depth renderer
   * @param mesh mesh or array of meshes
   * @param material material to use by the depth render when rendering the mesh(es). If undefined is passed, the specific material created by the depth renderer will be used.
   */
  setMaterialForRendering(mesh, material) {
    this._depthMap.setMaterialForRendering(mesh, material);
  }
  /**
   * Instantiates a depth renderer
   * @param scene The scene the renderer belongs to
   * @param type The texture type of the depth map (default: Engine.TEXTURETYPE_FLOAT)
   * @param camera The camera to be used to render the depth map (default: scene's active camera)
   * @param storeNonLinearDepth Defines whether the depth is stored linearly like in Babylon Shadows or directly like glFragCoord.z
   * @param samplingMode The sampling mode to be used with the render target (Linear, Nearest...) (default: TRILINEAR_SAMPLINGMODE)
   * @param storeCameraSpaceZ Defines whether the depth stored is the Z coordinate in camera space. If true, storeNonLinearDepth has no effect. (Default: false)
   * @param name Name of the render target (default: DepthRenderer)
   * @param existingRenderTargetTexture An existing render target texture to use (default: undefined). If not provided, a new render target texture will be created.
   */
  constructor(scene, type = 1, camera = null, storeNonLinearDepth = false, samplingMode = Texture.TRILINEAR_SAMPLINGMODE, storeCameraSpaceZ = false, name, existingRenderTargetTexture) {
    this._shaderLanguage = 0;
    this.enabled = true;
    this.forceDepthWriteTransparentMeshes = false;
    this.useOnlyInActiveCamera = false;
    this.reverseCulling = false;
    this._shadersLoaded = false;
    this._scene = scene;
    this._storeNonLinearDepth = storeNonLinearDepth;
    this._storeCameraSpaceZ = storeCameraSpaceZ;
    this.isPacked = type === 0;
    if (this.isPacked) {
      this.clearColor = new Color4(1, 1, 1, 1);
    } else {
      this.clearColor = new Color4(storeCameraSpaceZ ? 0 : 1, 0, 0, 1);
    }
    this._initShaderSourceAsync();
    _DepthRenderer._SceneComponentInitialization(this._scene);
    const engine = scene.getEngine();
    this._camera = camera;
    if (samplingMode !== Texture.NEAREST_SAMPLINGMODE) {
      if (type === 1 && !engine._caps.textureFloatLinearFiltering) {
        samplingMode = Texture.NEAREST_SAMPLINGMODE;
      }
      if (type === 2 && !engine._caps.textureHalfFloatLinearFiltering) {
        samplingMode = Texture.NEAREST_SAMPLINGMODE;
      }
    }
    const format = this.isPacked || !engine._features.supportExtendedTextureFormats ? 5 : 6;
    this._depthMap = existingRenderTargetTexture ?? new RenderTargetTexture(name ?? "DepthRenderer", { width: engine.getRenderWidth(), height: engine.getRenderHeight() }, this._scene, false, true, type, false, samplingMode, void 0, void 0, void 0, format);
    this._depthMap.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._depthMap.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._depthMap.refreshRate = 1;
    this._depthMap.renderParticles = false;
    this._depthMap.renderList = null;
    this._depthMap.noPrePassRenderer = true;
    this._depthMap.activeCamera = this._camera;
    this._depthMap.ignoreCameraViewport = true;
    this._depthMap.useCameraPostProcesses = false;
    this._depthMap.onClearObservable.add((engine2) => {
      engine2.clear(this.clearColor, true, true, true);
    });
    this._depthMap.onBeforeBindObservable.add(() => {
      if (engine._enableGPUDebugMarkers) {
        engine.restoreDefaultFramebuffer();
        engine._debugPushGroup?.(`Depth renderer`);
      }
    });
    this._depthMap.onAfterUnbindObservable.add(() => {
      if (engine._enableGPUDebugMarkers) {
        engine._debugPopGroup?.();
      }
    });
    this._depthMap.customIsReadyFunction = (mesh, refreshRate, preWarm) => {
      if ((preWarm || refreshRate === 0) && mesh.subMeshes) {
        for (let i = 0; i < mesh.subMeshes.length; ++i) {
          const subMesh = mesh.subMeshes[i];
          const renderingMesh = subMesh.getRenderingMesh();
          const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
          const hardwareInstancedRendering = engine.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null && batch.visibleInstances[subMesh._id] !== void 0 || renderingMesh.hasThinInstances);
          if (!this.isReady(subMesh, hardwareInstancedRendering)) {
            return false;
          }
        }
      }
      return true;
    };
    const renderSubMesh = (subMesh) => {
      const renderingMesh = subMesh.getRenderingMesh();
      const effectiveMesh = subMesh.getEffectiveMesh();
      const scene2 = this._scene;
      const engine2 = scene2.getEngine();
      const material = subMesh.getMaterial();
      effectiveMesh._internalAbstractMeshDataInfo._isActiveIntermediate = false;
      if (!material || effectiveMesh.infiniteDistance || material.disableDepthWrite || subMesh.verticesCount === 0 || subMesh._renderId === scene2.getRenderId()) {
        return;
      }
      const detNeg = effectiveMesh._getWorldMatrixDeterminant() < 0;
      let sideOrientation = material._getEffectiveOrientation(renderingMesh);
      if (detNeg) {
        sideOrientation = sideOrientation === 0 ? 1 : 0;
      }
      const reverseSideOrientation = sideOrientation === 0;
      engine2.setState(material.backFaceCulling, 0, false, reverseSideOrientation, this.reverseCulling ? !material.cullBackFaces : material.cullBackFaces);
      const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
      if (batch.mustReturn) {
        return;
      }
      const hardwareInstancedRendering = engine2.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null && batch.visibleInstances[subMesh._id] !== void 0 || renderingMesh.hasThinInstances);
      const camera2 = this._camera || scene2.activeCamera;
      if (this.isReady(subMesh, hardwareInstancedRendering) && camera2) {
        subMesh._renderId = scene2.getRenderId();
        let renderingMaterial = effectiveMesh._internalAbstractMeshDataInfo._materialForRenderPass?.[engine2.currentRenderPassId];
        if (renderingMaterial === void 0 && effectiveMesh.getClassName() === "GaussianSplattingMesh") {
          const gsMaterial = effectiveMesh.material;
          renderingMaterial = gsMaterial.makeDepthRenderingMaterial(this._scene, this._shaderLanguage);
          this.setMaterialForRendering(effectiveMesh, renderingMaterial);
          if (!renderingMaterial.isReady()) {
            return;
          }
        }
        let drawWrapper = subMesh._getDrawWrapper();
        if (!drawWrapper && renderingMaterial) {
          drawWrapper = renderingMaterial._getDrawWrapper();
        }
        const cameraIsOrtho = camera2.mode === Camera.ORTHOGRAPHIC_CAMERA;
        if (!drawWrapper) {
          return;
        }
        const effect = drawWrapper.effect;
        engine2.enableEffect(drawWrapper);
        if (!hardwareInstancedRendering) {
          renderingMesh._bind(subMesh, effect, material.fillMode);
        }
        if (!renderingMaterial) {
          effect.setMatrix("viewProjection", scene2.getTransformMatrix());
          effect.setMatrix("world", effectiveMesh.getWorldMatrix());
          if (this._storeCameraSpaceZ) {
            effect.setMatrix("view", scene2.getViewMatrix());
          }
        } else {
          renderingMaterial.bindForSubMesh(effectiveMesh.getWorldMatrix(), effectiveMesh, subMesh);
        }
        let minZ, maxZ;
        if (cameraIsOrtho) {
          minZ = !engine2.useReverseDepthBuffer && engine2.isNDCHalfZRange ? 0 : 1;
          maxZ = engine2.useReverseDepthBuffer && engine2.isNDCHalfZRange ? 0 : 1;
        } else {
          minZ = engine2.useReverseDepthBuffer && engine2.isNDCHalfZRange ? camera2.minZ : engine2.isNDCHalfZRange ? 0 : camera2.minZ;
          maxZ = engine2.useReverseDepthBuffer && engine2.isNDCHalfZRange ? 0 : camera2.maxZ;
        }
        effect.setFloat2("depthValues", minZ, minZ + maxZ);
        if (!renderingMaterial) {
          if (material.needAlphaTestingForMesh(effectiveMesh)) {
            const alphaTexture = material.getAlphaTestTexture();
            if (alphaTexture) {
              effect.setTexture("diffuseSampler", alphaTexture);
              effect.setMatrix("diffuseMatrix", alphaTexture.getTextureMatrix());
            }
          }
          BindBonesParameters(renderingMesh, effect);
          BindClipPlane(effect, material, scene2);
          BindMorphTargetParameters(renderingMesh, effect);
          if (renderingMesh.morphTargetManager && renderingMesh.morphTargetManager.isUsingTextureForTargets) {
            renderingMesh.morphTargetManager._bind(effect);
          }
          const bvaManager = subMesh.getMesh().bakedVertexAnimationManager;
          if (bvaManager && bvaManager.isEnabled) {
            bvaManager.bind(effect, hardwareInstancedRendering);
          }
          if (material.pointsCloud) {
            effect.setFloat("pointSize", material.pointSize);
          }
        }
        renderingMesh._processRendering(effectiveMesh, subMesh, effect, material.fillMode, batch, hardwareInstancedRendering, (isInstance, world) => effect.setMatrix("world", world));
      }
    };
    this._depthMap.customRenderFunction = (opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes) => {
      let index;
      if (depthOnlySubMeshes.length) {
        for (index = 0; index < depthOnlySubMeshes.length; index++) {
          renderSubMesh(depthOnlySubMeshes.data[index]);
        }
      }
      for (index = 0; index < opaqueSubMeshes.length; index++) {
        renderSubMesh(opaqueSubMeshes.data[index]);
      }
      for (index = 0; index < alphaTestSubMeshes.length; index++) {
        renderSubMesh(alphaTestSubMeshes.data[index]);
      }
      if (this.forceDepthWriteTransparentMeshes) {
        for (index = 0; index < transparentSubMeshes.length; index++) {
          renderSubMesh(transparentSubMeshes.data[index]);
        }
      } else {
        for (index = 0; index < transparentSubMeshes.length; index++) {
          transparentSubMeshes.data[index].getEffectiveMesh()._internalAbstractMeshDataInfo._isActiveIntermediate = false;
        }
      }
    };
  }
  async _initShaderSourceAsync(forceGLSL = false) {
    const engine = this._scene.getEngine();
    if (engine.isWebGPU && !forceGLSL && !_DepthRenderer.ForceGLSL) {
      this._shaderLanguage = 1;
      await Promise.all([import("./depth.vertex-A7ZH4VEC.js"), import("./depth.fragment-HI5GDT6E.js")]);
    } else {
      await Promise.all([import("./depth.vertex-6CGZQZMH.js"), import("./depth.fragment-RZTAM5SU.js")]);
    }
    this._shadersLoaded = true;
  }
  /**
   * Creates the depth rendering effect and checks if the effect is ready.
   * @param subMesh The submesh to be used to render the depth map of
   * @param useInstances If multiple world instances should be used
   * @returns if the depth renderer is ready to render the depth map
   */
  isReady(subMesh, useInstances) {
    if (!this._shadersLoaded) {
      return false;
    }
    const engine = this._scene.getEngine();
    const mesh = subMesh.getMesh();
    const scene = mesh.getScene();
    const renderingMaterial = mesh._internalAbstractMeshDataInfo._materialForRenderPass?.[engine.currentRenderPassId];
    if (renderingMaterial) {
      return renderingMaterial.isReadyForSubMesh(mesh, subMesh, useInstances);
    }
    const material = subMesh.getMaterial();
    if (!material || material.disableDepthWrite) {
      return false;
    }
    const defines = [];
    const attribs = [VertexBuffer.PositionKind];
    let uv1 = false;
    let uv2 = false;
    const color = false;
    if (material.needAlphaTestingForMesh(mesh) && material.getAlphaTestTexture()) {
      defines.push("#define ALPHATEST");
      if (mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
        attribs.push(VertexBuffer.UVKind);
        defines.push("#define UV1");
        uv1 = true;
      }
      if (mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) {
        attribs.push(VertexBuffer.UV2Kind);
        defines.push("#define UV2");
        uv2 = true;
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
      defines.push("#define NUM_BONE_INFLUENCERS " + mesh.numBoneInfluencers);
      if (mesh.numBoneInfluencers > 0) {
        fallbacks.addCPUSkinningFallback(0, mesh);
      }
      const skeleton = mesh.skeleton;
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
      false,
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
    if (material.pointsCloud) {
      defines.push("#define POINTSIZE");
    }
    if (useInstances) {
      defines.push("#define INSTANCES");
      PushAttributesForInstances(attribs);
      if (subMesh.getRenderingMesh().hasThinInstances) {
        defines.push("#define THIN_INSTANCES");
      }
    }
    const bvaManager = mesh.bakedVertexAnimationManager;
    if (bvaManager && bvaManager.isEnabled) {
      defines.push("#define BAKED_VERTEX_ANIMATION_TEXTURE");
      if (useInstances) {
        attribs.push("bakedVertexAnimationSettingsInstanced");
      }
    }
    if (this._storeNonLinearDepth) {
      defines.push("#define NONLINEARDEPTH");
    }
    if (this._storeCameraSpaceZ) {
      defines.push("#define STORE_CAMERASPACE_Z");
    }
    if (this.isPacked) {
      defines.push("#define PACKED");
    }
    PrepareStringDefinesForClipPlanes(material, scene, defines);
    const drawWrapper = subMesh._getDrawWrapper(void 0, true);
    const cachedDefines = drawWrapper.defines;
    const join = defines.join("\n");
    if (cachedDefines !== join) {
      const uniforms = [
        "world",
        "mBones",
        "boneTextureWidth",
        "pointSize",
        "viewProjection",
        "view",
        "diffuseMatrix",
        "depthValues",
        "morphTargetInfluences",
        "morphTargetCount",
        "morphTargetTextureInfo",
        "morphTargetTextureIndices",
        "bakedVertexAnimationSettings",
        "bakedVertexAnimationTextureSizeInverted",
        "bakedVertexAnimationTime",
        "bakedVertexAnimationTexture"
      ];
      const samplers = ["diffuseSampler", "morphTargets", "boneSampler", "bakedVertexAnimationTexture"];
      AddClipPlaneUniforms(uniforms);
      drawWrapper.setEffect(engine.createEffect("depth", {
        attributes: attribs,
        uniformsNames: uniforms,
        uniformBuffersNames: [],
        samplers,
        defines: join,
        fallbacks,
        onCompiled: null,
        onError: null,
        indexParameters: { maxSimultaneousMorphTargets: numMorphInfluencers },
        shaderLanguage: this._shaderLanguage
      }, engine), join);
    }
    return drawWrapper.effect.isReady();
  }
  /**
   * Gets the texture which the depth map will be written to.
   * @returns The depth map texture
   */
  getDepthMap() {
    return this._depthMap;
  }
  /**
   * Disposes of the depth renderer.
   */
  dispose() {
    const keysToDelete = [];
    for (const key in this._scene._depthRenderer) {
      const depthRenderer = this._scene._depthRenderer[key];
      if (depthRenderer === this) {
        keysToDelete.push(key);
      }
    }
    if (keysToDelete.length > 0) {
      this._depthMap.dispose();
      for (const key of keysToDelete) {
        delete this._scene._depthRenderer[key];
      }
    }
  }
};
DepthRenderer.ForceGLSL = false;
DepthRenderer._SceneComponentInitialization = (_) => {
  throw _WarnImport("DepthRendererSceneComponent");
};

export {
  DepthRenderer
};
//# sourceMappingURL=chunk-BP7KTCUF.js.map
