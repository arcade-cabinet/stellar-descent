import {
  DepthRenderer
} from "./chunk-BP7KTCUF.js";
import "./chunk-7EPAU2JH.js";
import "./chunk-CJ36A2NR.js";
import "./chunk-CX4UP7V7.js";
import "./chunk-4YYNOEQD.js";
import "./chunk-GWG7IDIL.js";
import "./chunk-6DOJRLCQ.js";
import "./chunk-2OS6PZWV.js";
import "./chunk-SI4YQYAP.js";
import "./chunk-K3NI3F4B.js";
import "./chunk-X5263PRI.js";
import "./chunk-RCPM2CUA.js";
import "./chunk-CESSEMZQ.js";
import "./chunk-5THHQJAG.js";
import "./chunk-XDMWCM3S.js";
import "./chunk-TJZRBYWF.js";
import "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import "./chunk-4SFBNKXP.js";
import {
  Scene
} from "./chunk-WNGJ3WNO.js";
import "./chunk-BELK345T.js";
import "./chunk-VMWDNJJG.js";
import "./chunk-GGUL3CXV.js";
import "./chunk-2DA7GQ3K.js";
import "./chunk-4CFWIRXS.js";
import "./chunk-QU3LKDUB.js";
import {
  SceneComponentConstants
} from "./chunk-XSRNQTYL.js";
import "./chunk-WOKXMMT7.js";
import "./chunk-YNSIAG7O.js";
import "./chunk-O36BJWZ2.js";
import "./chunk-T324X5NK.js";
import "./chunk-VMPPSYS3.js";
import "./chunk-EWHDDCCY.js";
import "./chunk-4ZWKSYMN.js";
import "./chunk-ZOIT5ZEZ.js";
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
import "./chunk-4KL4KK2C.js";
import "./chunk-N5T6XPNQ.js";
import "./chunk-2HUMDLGD.js";
import "./chunk-QD4Q3FLX.js";
import "./chunk-BFIQD25N.js";
import "./chunk-57LBGEP2.js";
import "./chunk-D664DUZM.js";
import "./chunk-ZKYT7Q6J.js";
import "./chunk-STIKNZXL.js";
import "./chunk-I3IYKWNG.js";
import "./chunk-MMWR3MO4.js";
import "./chunk-YLLTSBLI.js";
import "./chunk-YSTPYZG5.js";
import "./chunk-DSUROWQ4.js";
import "./chunk-LUXUKJKM.js";
import "./chunk-WOUDRWXV.js";
import "./chunk-3EU3L2QH.js";
import "./chunk-G3PMV62Z.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Rendering/depthRendererSceneComponent.js
Scene.prototype.enableDepthRenderer = function(camera, storeNonLinearDepth = false, force32bitsFloat = false, samplingMode = 3, storeCameraSpaceZ = false, existingRenderTargetTexture) {
  camera = camera || this.activeCamera;
  if (!camera) {
    throw "No camera available to enable depth renderer";
  }
  if (!this._depthRenderer) {
    this._depthRenderer = {};
  }
  if (!this._depthRenderer[camera.id]) {
    const supportFullfloat = !!this.getEngine().getCaps().textureFloatRender;
    let textureType = 0;
    if (this.getEngine().getCaps().textureHalfFloatRender && (!force32bitsFloat || !supportFullfloat)) {
      textureType = 2;
    } else if (supportFullfloat) {
      textureType = 1;
    } else {
      textureType = 0;
    }
    this._depthRenderer[camera.id] = new DepthRenderer(this, textureType, camera, storeNonLinearDepth, samplingMode, storeCameraSpaceZ, void 0, existingRenderTargetTexture);
  }
  return this._depthRenderer[camera.id];
};
Scene.prototype.disableDepthRenderer = function(camera) {
  camera = camera || this.activeCamera;
  if (!camera || !this._depthRenderer || !this._depthRenderer[camera.id]) {
    return;
  }
  this._depthRenderer[camera.id].dispose();
};
var DepthRendererSceneComponent = class {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_DEPTHRENDERER;
    this.scene = scene;
  }
  /**
   * Registers the component in a given scene
   */
  register() {
    this.scene._gatherRenderTargetsStage.registerStep(SceneComponentConstants.STEP_GATHERRENDERTARGETS_DEPTHRENDERER, this, this._gatherRenderTargets);
    this.scene._gatherActiveCameraRenderTargetsStage.registerStep(SceneComponentConstants.STEP_GATHERACTIVECAMERARENDERTARGETS_DEPTHRENDERER, this, this._gatherActiveCameraRenderTargets);
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
    for (const key in this.scene._depthRenderer) {
      this.scene._depthRenderer[key].dispose();
    }
  }
  _gatherRenderTargets(renderTargets) {
    if (this.scene._depthRenderer) {
      for (const key in this.scene._depthRenderer) {
        const depthRenderer = this.scene._depthRenderer[key];
        if (depthRenderer.enabled && !depthRenderer.useOnlyInActiveCamera) {
          renderTargets.push(depthRenderer.getDepthMap());
        }
      }
    }
  }
  _gatherActiveCameraRenderTargets(renderTargets) {
    if (this.scene._depthRenderer) {
      for (const key in this.scene._depthRenderer) {
        const depthRenderer = this.scene._depthRenderer[key];
        if (depthRenderer.enabled && depthRenderer.useOnlyInActiveCamera && this.scene.activeCamera.id === key) {
          renderTargets.push(depthRenderer.getDepthMap());
        }
      }
    }
  }
};
DepthRenderer._SceneComponentInitialization = (scene) => {
  let component = scene._getComponent(SceneComponentConstants.NAME_DEPTHRENDERER);
  if (!component) {
    component = new DepthRendererSceneComponent(scene);
    scene._addComponent(component);
  }
};
export {
  DepthRendererSceneComponent
};
//# sourceMappingURL=@babylonjs_core_Rendering_depthRendererSceneComponent.js.map
