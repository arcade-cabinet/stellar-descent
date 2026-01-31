import {
  CreatePlane
} from "./chunk-46HGLBZT.js";
import {
  StandardMaterial
} from "./chunk-JG4SILVU.js";
import "./chunk-MVYIWNUI.js";
import "./chunk-UZU2JH3G.js";
import "./chunk-B2IFSXVS.js";
import "./chunk-OY4I5RUG.js";
import {
  AbstractMesh
} from "./chunk-43BBZCW2.js";
import "./chunk-GTCUHM7Z.js";
import {
  Material
} from "./chunk-354MVM62.js";
import "./chunk-NPDPINWR.js";
import "./chunk-BH7TPLNH.js";
import "./chunk-4YYNOEQD.js";
import "./chunk-GWG7IDIL.js";
import "./chunk-6DOJRLCQ.js";
import "./chunk-2OS6PZWV.js";
import "./chunk-SI4YQYAP.js";
import "./chunk-K3NI3F4B.js";
import "./chunk-RCPM2CUA.js";
import "./chunk-CESSEMZQ.js";
import "./chunk-ZJE4XQK6.js";
import {
  PostProcess
} from "./chunk-FTNKZQKS.js";
import {
  RenderTargetTexture
} from "./chunk-5THHQJAG.js";
import {
  EffectFallbacks
} from "./chunk-XDMWCM3S.js";
import "./chunk-5BCZBFCD.js";
import "./chunk-KVNFFPV2.js";
import "./chunk-MS5Q3OEV.js";
import {
  BindBonesParameters,
  BindMorphTargetParameters,
  PrepareDefinesAndAttributesForMorphTargets,
  PushAttributesForInstances
} from "./chunk-TJZRBYWF.js";
import "./chunk-CRAMLVPI.js";
import {
  Texture
} from "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import {
  Viewport
} from "./chunk-4SFBNKXP.js";
import "./chunk-LY4CWJEX.js";
import "./chunk-UUDR6V7F.js";
import "./chunk-W7NAK7I4.js";
import "./chunk-WNGJ3WNO.js";
import "./chunk-BELK345T.js";
import "./chunk-VMWDNJJG.js";
import "./chunk-GGUL3CXV.js";
import "./chunk-2DA7GQ3K.js";
import "./chunk-4CFWIRXS.js";
import "./chunk-QU3LKDUB.js";
import "./chunk-XSRNQTYL.js";
import "./chunk-WOKXMMT7.js";
import "./chunk-YNSIAG7O.js";
import "./chunk-O36BJWZ2.js";
import "./chunk-T324X5NK.js";
import "./chunk-VMPPSYS3.js";
import "./chunk-EWHDDCCY.js";
import "./chunk-4ZWKSYMN.js";
import {
  VertexBuffer
} from "./chunk-ZOIT5ZEZ.js";
import "./chunk-XAOF3L4F.js";
import "./chunk-CSVPIDNO.js";
import "./chunk-YVYIHIJT.js";
import "./chunk-2GZCEIFN.js";
import "./chunk-SVWFF7VD.js";
import "./chunk-ORJOFH3C.js";
import "./chunk-L6UPA4UW.js";
import "./chunk-CQNOHBC6.js";
import "./chunk-BGSVSY55.js";
import "./chunk-RG742WGM.js";
import "./chunk-AB3HOSPI.js";
import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import "./chunk-N5T6XPNQ.js";
import "./chunk-2HUMDLGD.js";
import "./chunk-QD4Q3FLX.js";
import "./chunk-BFIQD25N.js";
import {
  Logger
} from "./chunk-57LBGEP2.js";
import "./chunk-D664DUZM.js";
import "./chunk-ZKYT7Q6J.js";
import {
  __decorate,
  serialize,
  serializeAsMeshReference,
  serializeAsVector3
} from "./chunk-STIKNZXL.js";
import {
  Color3,
  Color4
} from "./chunk-I3IYKWNG.js";
import "./chunk-MMWR3MO4.js";
import {
  Matrix,
  Vector2,
  Vector3
} from "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import {
  RegisterClass
} from "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/volumetricLightScattering.fragment.js
var name = "volumetricLightScatteringPixelShader";
var shader = `uniform sampler2D textureSampler;uniform sampler2D lightScatteringSampler;uniform float decay;uniform float exposure;uniform float weight;uniform float density;uniform vec2 meshPositionOnScreen;varying vec2 vUV;
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
vec2 tc=vUV;vec2 deltaTexCoord=(tc-meshPositionOnScreen.xy);deltaTexCoord*=1.0/float(NUM_SAMPLES)*density;float illuminationDecay=1.0;vec4 color=texture2D(lightScatteringSampler,tc)*0.4;for(int i=0; i<NUM_SAMPLES; i++) {tc-=deltaTexCoord;vec4 dataSample=texture2D(lightScatteringSampler,tc)*0.4;dataSample*=illuminationDecay*weight;color+=dataSample;illuminationDecay*=decay;}
vec4 realColor=texture2D(textureSampler,vUV);gl_FragColor=((vec4((vec3(color.r,color.g,color.b)*exposure),realColor.a))+(realColor*(1.5-0.4)));
#define CUSTOM_FRAGMENT_MAIN_END
}
`;
if (!ShaderStore.ShadersStore[name]) {
  ShaderStore.ShadersStore[name] = shader;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/volumetricLightScatteringPass.vertex.js
var name2 = "volumetricLightScatteringPassVertexShader";
var shader2 = `attribute vec3 position;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
#include<instancesDeclaration>
uniform mat4 viewProjection;uniform vec2 depthValues;
#if defined(ALPHATEST) || defined(NEED_UV)
varying vec2 vUV;uniform mat4 diffuseMatrix;
#ifdef UV1
attribute vec2 uv;
#endif
#ifdef UV2
attribute vec2 uv2;
#endif
#endif
#define CUSTOM_VERTEX_DEFINITIONS
void main(void)
{vec3 positionUpdated=position;
#if (defined(ALPHATEST) || defined(NEED_UV)) && defined(UV1)
vec2 uvUpdated=uv;
#endif
#if (defined(ALPHATEST) || defined(NEED_UV)) && defined(UV2)
vec2 uv2Updated=uv2;
#endif
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
gl_Position=viewProjection*finalWorld*vec4(positionUpdated,1.0);
#if defined(ALPHATEST) || defined(BASIC_RENDER)
#ifdef UV1
vUV=vec2(diffuseMatrix*vec4(uvUpdated,1.0,0.0));
#endif
#ifdef UV2
vUV=vec2(diffuseMatrix*vec4(uv2Updated,1.0,0.0));
#endif
#endif
}
`;
if (!ShaderStore.ShadersStore[name2]) {
  ShaderStore.ShadersStore[name2] = shader2;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/volumetricLightScatteringPass.fragment.js
var name3 = "volumetricLightScatteringPassPixelShader";
var shader3 = `#if defined(ALPHATEST) || defined(NEED_UV)
varying vec2 vUV;
#endif
#if defined(ALPHATEST)
uniform sampler2D diffuseSampler;
#endif
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void)
{
#if defined(ALPHATEST)
vec4 diffuseColor=texture2D(diffuseSampler,vUV);if (diffuseColor.a<0.4)
discard;
#endif
gl_FragColor=vec4(0.0,0.0,0.0,1.0);}
`;
if (!ShaderStore.ShadersStore[name3]) {
  ShaderStore.ShadersStore[name3] = shader3;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess.js
var VolumetricLightScatteringPostProcess = class _VolumetricLightScatteringPostProcess extends PostProcess {
  /**
   * @internal
   * VolumetricLightScatteringPostProcess.useDiffuseColor is no longer used, use the mesh material directly instead
   */
  get useDiffuseColor() {
    Logger.Warn("VolumetricLightScatteringPostProcess.useDiffuseColor is no longer used, use the mesh material directly instead");
    return false;
  }
  set useDiffuseColor(useDiffuseColor) {
    Logger.Warn("VolumetricLightScatteringPostProcess.useDiffuseColor is no longer used, use the mesh material directly instead");
  }
  /**
   * @constructor
   * @param name The post-process name
   * @param ratio The size of the post-process and/or internal pass (0.5 means that your postprocess will have a width = canvas.width 0.5 and a height = canvas.height 0.5)
   * @param camera The camera that the post-process will be attached to
   * @param mesh The mesh used to create the light scattering
   * @param samples The post-process quality, default 100
   * @param samplingMode The post-process filtering mode
   * @param engine The babylon engine
   * @param reusable If the post-process is reusable
   * @param scene The constructor needs a scene reference to initialize internal components. If "camera" is null a "scene" must be provided
   */
  constructor(name4, ratio, camera, mesh, samples = 100, samplingMode = Texture.BILINEAR_SAMPLINGMODE, engine, reusable, scene) {
    super(name4, "volumetricLightScattering", ["decay", "exposure", "weight", "meshPositionOnScreen", "density"], ["lightScatteringSampler"], ratio.postProcessRatio || ratio, camera, samplingMode, engine, reusable, "#define NUM_SAMPLES " + samples);
    this._screenCoordinates = Vector2.Zero();
    this.customMeshPosition = Vector3.Zero();
    this.useCustomMeshPosition = false;
    this.invert = true;
    this.excludedMeshes = [];
    this.includedMeshes = [];
    this.exposure = 0.3;
    this.decay = 0.96815;
    this.weight = 0.58767;
    this.density = 0.926;
    scene = camera?.getScene() ?? scene ?? this._scene;
    engine = scene.getEngine();
    this._viewPort = new Viewport(0, 0, 1, 1).toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    this.mesh = mesh ?? _VolumetricLightScatteringPostProcess.CreateDefaultMesh("VolumetricLightScatteringMesh", scene);
    this._createPass(scene, ratio.passRatio || ratio);
    this.onActivate = (camera2) => {
      if (!this.isSupported) {
        this.dispose(camera2);
      }
      this.onActivate = null;
    };
    this.onApplyObservable.add((effect) => {
      this._updateMeshScreenCoordinates(scene);
      effect.setTexture("lightScatteringSampler", this._volumetricLightScatteringRTT);
      effect.setFloat("exposure", this.exposure);
      effect.setFloat("decay", this.decay);
      effect.setFloat("weight", this.weight);
      effect.setFloat("density", this.density);
      effect.setVector2("meshPositionOnScreen", this._screenCoordinates);
    });
  }
  /**
   * Returns the string "VolumetricLightScatteringPostProcess"
   * @returns "VolumetricLightScatteringPostProcess"
   */
  getClassName() {
    return "VolumetricLightScatteringPostProcess";
  }
  _isReady(subMesh, useInstances) {
    const mesh = subMesh.getMesh();
    if (mesh === this.mesh && mesh.material) {
      return mesh.material.isReady(mesh);
    }
    const renderingMaterial = mesh._internalAbstractMeshDataInfo._materialForRenderPass?.[this._scene.getEngine().currentRenderPassId];
    if (renderingMaterial) {
      return renderingMaterial.isReadyForSubMesh(mesh, subMesh, useInstances);
    }
    const defines = [];
    const attribs = [VertexBuffer.PositionKind];
    const material = subMesh.getMaterial();
    let uv1 = false;
    let uv2 = false;
    const color = false;
    if (material) {
      const needAlphaTesting = material.needAlphaTestingForMesh(mesh);
      if (needAlphaTesting) {
        defines.push("#define ALPHATEST");
      }
      if (mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
        attribs.push(VertexBuffer.UVKind);
        defines.push("#define UV1");
        uv1 = needAlphaTesting;
      }
      if (mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) {
        attribs.push(VertexBuffer.UV2Kind);
        defines.push("#define UV2");
        uv2 = needAlphaTesting;
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
    const drawWrapper = subMesh._getDrawWrapper(void 0, true);
    const cachedDefines = drawWrapper.defines;
    const join = defines.join("\n");
    if (cachedDefines !== join) {
      const uniforms = [
        "world",
        "mBones",
        "boneTextureWidth",
        "viewProjection",
        "diffuseMatrix",
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
      drawWrapper.setEffect(mesh.getScene().getEngine().createEffect("volumetricLightScatteringPass", {
        attributes: attribs,
        uniformsNames: uniforms,
        uniformBuffersNames: [],
        samplers,
        defines: join,
        fallbacks,
        onCompiled: null,
        onError: null,
        indexParameters: { maxSimultaneousMorphTargets: numMorphInfluencers }
      }, mesh.getScene().getEngine()), join);
    }
    return drawWrapper.effect.isReady();
  }
  /**
   * Sets the new light position for light scattering effect
   * @param position The new custom light position
   */
  setCustomMeshPosition(position) {
    this.customMeshPosition = position;
  }
  /**
   * Returns the light position for light scattering effect
   * @returns Vector3 The custom light position
   */
  getCustomMeshPosition() {
    return this.customMeshPosition;
  }
  /**
   * Disposes the internal assets and detaches the post-process from the camera
   * @param camera The camera from which to detach the post-process
   */
  dispose(camera) {
    const rttIndex = camera.getScene().customRenderTargets.indexOf(this._volumetricLightScatteringRTT);
    if (rttIndex !== -1) {
      camera.getScene().customRenderTargets.splice(rttIndex, 1);
    }
    this._volumetricLightScatteringRTT.dispose();
    super.dispose(camera);
  }
  /**
   * Returns the render target texture used by the post-process
   * @returns the render target texture used by the post-process
   */
  getPass() {
    return this._volumetricLightScatteringRTT;
  }
  // Private methods
  _meshExcluded(mesh) {
    if (this.includedMeshes.length > 0 && this.includedMeshes.indexOf(mesh) === -1 || this.excludedMeshes.length > 0 && this.excludedMeshes.indexOf(mesh) !== -1) {
      return true;
    }
    return false;
  }
  _createPass(scene, ratio) {
    const engine = scene.getEngine();
    this._volumetricLightScatteringRTT = new RenderTargetTexture("volumetricLightScatteringMap", { width: engine.getRenderWidth() * ratio, height: engine.getRenderHeight() * ratio }, scene, false, true, 0);
    this._volumetricLightScatteringRTT.wrapU = Texture.CLAMP_ADDRESSMODE;
    this._volumetricLightScatteringRTT.wrapV = Texture.CLAMP_ADDRESSMODE;
    this._volumetricLightScatteringRTT.renderList = null;
    this._volumetricLightScatteringRTT.renderParticles = false;
    this._volumetricLightScatteringRTT.ignoreCameraViewport = true;
    const camera = this.getCamera();
    if (camera) {
      camera.customRenderTargets.push(this._volumetricLightScatteringRTT);
    } else {
      scene.customRenderTargets.push(this._volumetricLightScatteringRTT);
    }
    const renderSubMesh = (subMesh) => {
      const renderingMesh = subMesh.getRenderingMesh();
      const effectiveMesh = subMesh.getEffectiveMesh();
      if (this._meshExcluded(renderingMesh)) {
        return;
      }
      effectiveMesh._internalAbstractMeshDataInfo._isActiveIntermediate = false;
      const material = subMesh.getMaterial();
      if (!material) {
        return;
      }
      const scene2 = renderingMesh.getScene();
      const engine2 = scene2.getEngine();
      engine2.setState(material.backFaceCulling, void 0, void 0, void 0, material.cullBackFaces);
      const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
      if (batch.mustReturn) {
        return;
      }
      const hardwareInstancedRendering = engine2.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null || renderingMesh.hasThinInstances);
      if (this._isReady(subMesh, hardwareInstancedRendering)) {
        const renderingMaterial = effectiveMesh._internalAbstractMeshDataInfo._materialForRenderPass?.[engine2.currentRenderPassId];
        let drawWrapper = subMesh._getDrawWrapper();
        if (renderingMesh === this.mesh && !drawWrapper) {
          drawWrapper = material._getDrawWrapper();
        }
        if (!drawWrapper) {
          return;
        }
        const effect = drawWrapper.effect;
        engine2.enableEffect(drawWrapper);
        if (!hardwareInstancedRendering) {
          renderingMesh._bind(subMesh, effect, material.fillMode);
        }
        if (renderingMesh === this.mesh) {
          material.bind(effectiveMesh.getWorldMatrix(), renderingMesh);
        } else if (renderingMaterial) {
          renderingMaterial.bindForSubMesh(effectiveMesh.getWorldMatrix(), effectiveMesh, subMesh);
        } else {
          effect.setMatrix("viewProjection", scene2.getTransformMatrix());
          if (material.needAlphaTestingForMesh(effectiveMesh)) {
            const alphaTexture = material.getAlphaTestTexture();
            if (alphaTexture) {
              effect.setTexture("diffuseSampler", alphaTexture);
              effect.setMatrix("diffuseMatrix", alphaTexture.getTextureMatrix());
            }
          }
          BindBonesParameters(renderingMesh, effect);
          BindMorphTargetParameters(renderingMesh, effect);
          if (renderingMesh.morphTargetManager && renderingMesh.morphTargetManager.isUsingTextureForTargets) {
            renderingMesh.morphTargetManager._bind(effect);
          }
          const bvaManager = subMesh.getMesh().bakedVertexAnimationManager;
          if (bvaManager && bvaManager.isEnabled) {
            bvaManager.bind(effect, hardwareInstancedRendering);
          }
        }
        if (hardwareInstancedRendering && renderingMesh.hasThinInstances) {
          effect.setMatrix("world", effectiveMesh.getWorldMatrix());
        }
        renderingMesh._processRendering(effectiveMesh, subMesh, effect, Material.TriangleFillMode, batch, hardwareInstancedRendering, (isInstance, world) => {
          if (!isInstance) {
            effect.setMatrix("world", world);
          }
        });
      }
    };
    let savedSceneClearColor;
    const sceneClearColor = new Color4(0, 0, 0, 1);
    this._volumetricLightScatteringRTT.onBeforeRenderObservable.add(() => {
      savedSceneClearColor = scene.clearColor;
      scene.clearColor = sceneClearColor;
    });
    this._volumetricLightScatteringRTT.onAfterRenderObservable.add(() => {
      scene.clearColor = savedSceneClearColor;
    });
    this._volumetricLightScatteringRTT.customIsReadyFunction = (mesh, refreshRate, preWarm) => {
      if ((preWarm || refreshRate === 0) && mesh.subMeshes) {
        for (let i = 0; i < mesh.subMeshes.length; ++i) {
          const subMesh = mesh.subMeshes[i];
          const material = subMesh.getMaterial();
          const renderingMesh = subMesh.getRenderingMesh();
          if (!material) {
            continue;
          }
          const batch = renderingMesh._getInstancesRenderList(subMesh._id, !!subMesh.getReplacementMesh());
          const hardwareInstancedRendering = engine.getCaps().instancedArrays && (batch.visibleInstances[subMesh._id] !== null || renderingMesh.hasThinInstances);
          if (!this._isReady(subMesh, hardwareInstancedRendering)) {
            return false;
          }
        }
      }
      return true;
    };
    this._volumetricLightScatteringRTT.customRenderFunction = (opaqueSubMeshes, alphaTestSubMeshes, transparentSubMeshes, depthOnlySubMeshes) => {
      const engine2 = scene.getEngine();
      let index;
      if (depthOnlySubMeshes.length) {
        engine2.setColorWrite(false);
        for (index = 0; index < depthOnlySubMeshes.length; index++) {
          renderSubMesh(depthOnlySubMeshes.data[index]);
        }
        engine2.setColorWrite(true);
      }
      for (index = 0; index < opaqueSubMeshes.length; index++) {
        renderSubMesh(opaqueSubMeshes.data[index]);
      }
      for (index = 0; index < alphaTestSubMeshes.length; index++) {
        renderSubMesh(alphaTestSubMeshes.data[index]);
      }
      if (transparentSubMeshes.length) {
        for (index = 0; index < transparentSubMeshes.length; index++) {
          const submesh = transparentSubMeshes.data[index];
          const boundingInfo = submesh.getBoundingInfo();
          if (boundingInfo && scene.activeCamera) {
            submesh._alphaIndex = submesh.getMesh().alphaIndex;
            submesh._distanceToCamera = boundingInfo.boundingSphere.centerWorld.subtract(scene.activeCamera.position).length();
          }
        }
        const sortedArray = transparentSubMeshes.data.slice(0, transparentSubMeshes.length);
        sortedArray.sort((a, b) => {
          if (a._alphaIndex > b._alphaIndex) {
            return 1;
          }
          if (a._alphaIndex < b._alphaIndex) {
            return -1;
          }
          if (a._distanceToCamera < b._distanceToCamera) {
            return 1;
          }
          if (a._distanceToCamera > b._distanceToCamera) {
            return -1;
          }
          return 0;
        });
        engine2.setAlphaMode(2);
        for (index = 0; index < sortedArray.length; index++) {
          renderSubMesh(sortedArray[index]);
        }
        engine2.setAlphaMode(0);
      }
    };
  }
  _updateMeshScreenCoordinates(scene) {
    const transform = scene.getTransformMatrix();
    let meshPosition;
    if (this.useCustomMeshPosition) {
      meshPosition = this.customMeshPosition;
    } else if (this.attachedNode) {
      meshPosition = this.attachedNode.position;
    } else {
      meshPosition = this.mesh.parent ? this.mesh.getAbsolutePosition() : this.mesh.position;
    }
    const pos = Vector3.Project(meshPosition, Matrix.Identity(), transform, this._viewPort);
    this._screenCoordinates.x = pos.x / this._viewPort.width;
    this._screenCoordinates.y = pos.y / this._viewPort.height;
    if (this.invert) {
      this._screenCoordinates.y = 1 - this._screenCoordinates.y;
    }
  }
  // Static methods
  /**
   * Creates a default mesh for the Volumeric Light Scattering post-process
   * @param name The mesh name
   * @param scene The scene where to create the mesh
   * @returns the default mesh
   */
  static CreateDefaultMesh(name4, scene) {
    const mesh = CreatePlane(name4, { size: 1 }, scene);
    mesh.billboardMode = AbstractMesh.BILLBOARDMODE_ALL;
    const material = new StandardMaterial(name4 + "Material", scene);
    material.emissiveColor = new Color3(1, 1, 1);
    mesh.material = material;
    return mesh;
  }
};
__decorate([
  serializeAsVector3()
], VolumetricLightScatteringPostProcess.prototype, "customMeshPosition", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "useCustomMeshPosition", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "invert", void 0);
__decorate([
  serializeAsMeshReference()
], VolumetricLightScatteringPostProcess.prototype, "mesh", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "excludedMeshes", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "includedMeshes", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "exposure", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "decay", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "weight", void 0);
__decorate([
  serialize()
], VolumetricLightScatteringPostProcess.prototype, "density", void 0);
RegisterClass("BABYLON.VolumetricLightScatteringPostProcess", VolumetricLightScatteringPostProcess);
export {
  VolumetricLightScatteringPostProcess
};
//# sourceMappingURL=@babylonjs_core_PostProcesses_volumetricLightScatteringPostProcess.js.map
