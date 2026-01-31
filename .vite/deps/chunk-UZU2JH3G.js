import {
  serializeAsImageProcessingConfiguration
} from "./chunk-STIKNZXL.js";
import {
  Matrix
} from "./chunk-YLLTSBLI.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/prePassConfiguration.js
var PrePassConfiguration = class {
  constructor() {
    this.previousWorldMatrices = {};
    this.previousBones = {};
  }
  /**
   * Add the required uniforms to the current list.
   * @param uniforms defines the current uniform list.
   */
  static AddUniforms(uniforms) {
    uniforms.push("previousWorld", "previousViewProjection", "mPreviousBones");
  }
  /**
   * Add the required samplers to the current list.
   * @param samplers defines the current sampler list.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static AddSamplers(samplers) {
  }
  /**
   * Binds the material data.
   * @param effect defines the effect to update
   * @param scene defines the scene the material belongs to.
   * @param mesh The mesh
   * @param world World matrix of this mesh
   * @param isFrozen Is the material frozen
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bindForSubMesh(effect, scene, mesh, world, isFrozen) {
    if (scene.prePassRenderer && scene.prePassRenderer.enabled && scene.prePassRenderer.currentRTisSceneRT) {
      if (scene.prePassRenderer.getIndex(2) !== -1 || scene.prePassRenderer.getIndex(11) !== -1) {
        if (!this.previousWorldMatrices[mesh.uniqueId]) {
          this.previousWorldMatrices[mesh.uniqueId] = world.clone();
        }
        if (!this.previousViewProjection) {
          this.previousViewProjection = scene.getTransformMatrix().clone();
          this.currentViewProjection = scene.getTransformMatrix().clone();
        }
        const engine = scene.getEngine();
        if (this.currentViewProjection.updateFlag !== scene.getTransformMatrix().updateFlag) {
          this._lastUpdateFrameId = engine.frameId;
          this.previousViewProjection.copyFrom(this.currentViewProjection);
          this.currentViewProjection.copyFrom(scene.getTransformMatrix());
        } else if (this._lastUpdateFrameId !== engine.frameId) {
          this._lastUpdateFrameId = engine.frameId;
          this.previousViewProjection.copyFrom(this.currentViewProjection);
        }
        effect.setMatrix("previousWorld", this.previousWorldMatrices[mesh.uniqueId]);
        effect.setMatrix("previousViewProjection", this.previousViewProjection);
        this.previousWorldMatrices[mesh.uniqueId] = world.clone();
      }
    }
  }
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/materialHelper.geometryrendering.js
var GeometryRenderingTextureClearType;
(function(GeometryRenderingTextureClearType2) {
  GeometryRenderingTextureClearType2[GeometryRenderingTextureClearType2["Zero"] = 0] = "Zero";
  GeometryRenderingTextureClearType2[GeometryRenderingTextureClearType2["One"] = 1] = "One";
  GeometryRenderingTextureClearType2[GeometryRenderingTextureClearType2["MaxViewZ"] = 2] = "MaxViewZ";
  GeometryRenderingTextureClearType2[GeometryRenderingTextureClearType2["NoClear"] = 3] = "NoClear";
})(GeometryRenderingTextureClearType || (GeometryRenderingTextureClearType = {}));
var MaterialHelperGeometryRendering = class _MaterialHelperGeometryRendering {
  /**
   * Creates a new geometry rendering configuration.
   * @param renderPassId Render pass id the configuration is created for.
   * @returns The created configuration.
   */
  static CreateConfiguration(renderPassId) {
    _MaterialHelperGeometryRendering._Configurations[renderPassId] = {
      defines: {},
      previousWorldMatrices: {},
      previousViewProjection: Matrix.Zero(),
      currentViewProjection: Matrix.Zero(),
      previousBones: {},
      lastUpdateFrameId: -1,
      excludedSkinnedMesh: [],
      reverseCulling: false
    };
    return _MaterialHelperGeometryRendering._Configurations[renderPassId];
  }
  /**
   * Deletes a geometry rendering configuration.
   * @param renderPassId The render pass id of the configuration to delete.
   */
  static DeleteConfiguration(renderPassId) {
    delete _MaterialHelperGeometryRendering._Configurations[renderPassId];
  }
  /**
   * Gets a geometry rendering configuration.
   * @param renderPassId The render pass id of the configuration to get.
   * @returns The configuration.
   */
  static GetConfiguration(renderPassId) {
    return _MaterialHelperGeometryRendering._Configurations[renderPassId];
  }
  /**
   * Adds uniforms and samplers for geometry rendering.
   * @param uniforms The array of uniforms to add to.
   * @param _samplers The array of samplers to add to.
   */
  static AddUniformsAndSamplers(uniforms, _samplers) {
    uniforms.push("previousWorld", "previousViewProjection", "mPreviousBones");
  }
  /**
   * Marks a list of meshes as dirty for geometry rendering.
   * @param renderPassId The render pass id the meshes are marked as dirty for.
   * @param meshes The list of meshes to mark as dirty.
   */
  static MarkAsDirty(renderPassId, meshes) {
    for (const mesh of meshes) {
      if (!mesh.subMeshes) {
        continue;
      }
      for (const subMesh of mesh.subMeshes) {
        subMesh._removeDrawWrapper(renderPassId);
      }
    }
  }
  /**
   * Prepares defines for geometry rendering.
   * @param renderPassId The render pass id the defines are prepared for.
   * @param mesh The mesh the defines are prepared for.
   * @param defines The defines to update according to the geometry rendering configuration.
   */
  static PrepareDefines(renderPassId, mesh, defines) {
    if (!defines._arePrePassDirty) {
      return;
    }
    const configuration = _MaterialHelperGeometryRendering._Configurations[renderPassId];
    if (!configuration) {
      return;
    }
    defines["PREPASS"] = true;
    let numMRT = 0;
    for (let i = 0; i < _MaterialHelperGeometryRendering.GeometryTextureDescriptions.length; i++) {
      const geometryTextureDescription = _MaterialHelperGeometryRendering.GeometryTextureDescriptions[i];
      const defineName = geometryTextureDescription.define;
      const defineIndex = geometryTextureDescription.defineIndex;
      const index = configuration.defines[defineIndex];
      if (index !== void 0) {
        defines[defineName] = true;
        defines[defineIndex] = index;
        numMRT++;
      } else {
        defines[defineName] = false;
        delete defines[defineIndex];
      }
    }
    defines["SCENE_MRT_COUNT"] = numMRT;
    defines["BONES_VELOCITY_ENABLED"] = mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton && !mesh.skeleton.isUsingTextureForMatrices && configuration.excludedSkinnedMesh.indexOf(mesh) === -1;
  }
  /**
   * Binds geometry rendering data for a mesh.
   * @param renderPassId The render pass id the geometry rendering data is bound for.
   * @param effect The effect to bind the geometry rendering data to.
   * @param mesh The mesh to bind the geometry rendering data for.
   * @param world The world matrix of the mesh.
   * @param material The material of the mesh.
   */
  static Bind(renderPassId, effect, mesh, world, material) {
    const configuration = _MaterialHelperGeometryRendering._Configurations[renderPassId];
    if (!configuration) {
      return;
    }
    const scene = mesh.getScene();
    const engine = scene.getEngine();
    if (configuration.reverseCulling) {
      engine.setStateCullFaceType(scene._mirroredCameraPosition ? material.cullBackFaces : !material.cullBackFaces);
    }
    if (configuration.defines["PREPASS_VELOCITY_INDEX"] !== void 0 || configuration.defines["PREPASS_VELOCITY_LINEAR_INDEX"] !== void 0) {
      if (!configuration.previousWorldMatrices[mesh.uniqueId]) {
        configuration.previousWorldMatrices[mesh.uniqueId] = world.clone();
      }
      if (!configuration.previousViewProjection) {
        configuration.previousViewProjection = scene.getTransformMatrix().clone();
        configuration.currentViewProjection = scene.getTransformMatrix().clone();
      }
      if (configuration.currentViewProjection.updateFlag !== scene.getTransformMatrix().updateFlag) {
        configuration.lastUpdateFrameId = engine.frameId;
        configuration.previousViewProjection.copyFrom(configuration.currentViewProjection);
        configuration.currentViewProjection.copyFrom(scene.getTransformMatrix());
      } else if (configuration.lastUpdateFrameId !== engine.frameId) {
        configuration.lastUpdateFrameId = engine.frameId;
        configuration.previousViewProjection.copyFrom(configuration.currentViewProjection);
      }
      effect.setMatrix("previousWorld", configuration.previousWorldMatrices[mesh.uniqueId]);
      effect.setMatrix("previousViewProjection", configuration.previousViewProjection);
      configuration.previousWorldMatrices[mesh.uniqueId] = world.clone();
      if (mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton) {
        const skeleton = mesh.skeleton;
        if (!skeleton.isUsingTextureForMatrices || effect.getUniformIndex("boneTextureWidth") === -1) {
          const matrices = skeleton.getTransformMatrices(mesh);
          if (matrices) {
            if (!configuration.previousBones[mesh.uniqueId]) {
              configuration.previousBones[mesh.uniqueId] = matrices.slice();
            }
            effect.setMatrices("mPreviousBones", configuration.previousBones[mesh.uniqueId]);
            configuration.previousBones[mesh.uniqueId].set(matrices);
          }
        }
      }
    }
  }
};
MaterialHelperGeometryRendering.GeometryTextureDescriptions = [
  {
    type: 0,
    name: "Irradiance",
    clearType: 0,
    define: "PREPASS_IRRADIANCE",
    defineIndex: "PREPASS_IRRADIANCE_INDEX"
  },
  {
    type: 1,
    name: "WorldPosition",
    clearType: 0,
    define: "PREPASS_POSITION",
    defineIndex: "PREPASS_POSITION_INDEX"
  },
  {
    type: 2,
    name: "Velocity",
    clearType: 0,
    define: "PREPASS_VELOCITY",
    defineIndex: "PREPASS_VELOCITY_INDEX"
  },
  {
    type: 3,
    name: "Reflectivity",
    clearType: 0,
    define: "PREPASS_REFLECTIVITY",
    defineIndex: "PREPASS_REFLECTIVITY_INDEX"
  },
  {
    type: 5,
    name: "ViewDepth",
    clearType: 2,
    define: "PREPASS_DEPTH",
    defineIndex: "PREPASS_DEPTH_INDEX"
  },
  {
    type: 6,
    name: "ViewNormal",
    clearType: 0,
    define: "PREPASS_NORMAL",
    defineIndex: "PREPASS_NORMAL_INDEX"
  },
  {
    type: 7,
    name: "AlbedoSqrt",
    clearType: 0,
    define: "PREPASS_ALBEDO_SQRT",
    defineIndex: "PREPASS_ALBEDO_SQRT_INDEX"
  },
  {
    type: 8,
    name: "WorldNormal",
    clearType: 0,
    define: "PREPASS_WORLD_NORMAL",
    defineIndex: "PREPASS_WORLD_NORMAL_INDEX"
  },
  {
    type: 9,
    name: "LocalPosition",
    clearType: 0,
    define: "PREPASS_LOCAL_POSITION",
    defineIndex: "PREPASS_LOCAL_POSITION_INDEX"
  },
  {
    type: 10,
    name: "ScreenDepth",
    clearType: 1,
    define: "PREPASS_SCREENSPACE_DEPTH",
    defineIndex: "PREPASS_SCREENSPACE_DEPTH_INDEX"
  },
  {
    type: 11,
    name: "LinearVelocity",
    clearType: 0,
    define: "PREPASS_VELOCITY_LINEAR",
    defineIndex: "PREPASS_VELOCITY_LINEAR_INDEX"
  },
  {
    type: 12,
    name: "Albedo",
    clearType: 0,
    define: "PREPASS_ALBEDO",
    defineIndex: "PREPASS_ALBEDO_INDEX"
  },
  {
    type: 13,
    name: "NormalizedViewDepth",
    clearType: 1,
    define: "PREPASS_NORMALIZED_VIEW_DEPTH",
    defineIndex: "PREPASS_NORMALIZED_VIEW_DEPTH_INDEX"
  },
  {
    type: 4,
    name: "Color",
    clearType: 3,
    define: "PREPASS_COLOR",
    defineIndex: "PREPASS_COLOR_INDEX"
  }
];
MaterialHelperGeometryRendering._Configurations = {};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/uv.defines.js
function UVDefinesMixin(base) {
  return class extends base {
    constructor() {
      super(...arguments);
      this.MAINUV1 = false;
      this.MAINUV2 = false;
      this.MAINUV3 = false;
      this.MAINUV4 = false;
      this.MAINUV5 = false;
      this.MAINUV6 = false;
      this.UV1 = false;
      this.UV2 = false;
      this.UV3 = false;
      this.UV4 = false;
      this.UV5 = false;
      this.UV6 = false;
    }
  };
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/imageProcessing.js
function ImageProcessingMixin(base) {
  return class extends base {
    /**
     * Constructor for the ImageProcessingMixin.
     * @param args - arguments to pass to the base class constructor
     */
    constructor(...args) {
      super(...args);
      serializeAsImageProcessingConfiguration.call(this, this, "_imageProcessingConfiguration");
    }
    /**
     * Gets the image processing configuration used either in this material.
     */
    get imageProcessingConfiguration() {
      return this._imageProcessingConfiguration;
    }
    /**
     * Sets the Default image processing configuration used either in the this material.
     *
     * If sets to null, the scene one is in use.
     */
    set imageProcessingConfiguration(value) {
      this._attachImageProcessingConfiguration(value);
      if (this._markAllSubMeshesAsImageProcessingDirty) {
        this._markAllSubMeshesAsImageProcessingDirty();
      }
    }
    /**
     * Attaches a new image processing configuration to the Standard Material.
     * @param configuration
     */
    _attachImageProcessingConfiguration(configuration) {
      if (configuration === this._imageProcessingConfiguration) {
        return;
      }
      if (this._imageProcessingConfiguration && this._imageProcessingObserver) {
        this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
      }
      if (!configuration && this.getScene) {
        this._imageProcessingConfiguration = this.getScene().imageProcessingConfiguration;
      } else if (configuration) {
        this._imageProcessingConfiguration = configuration;
      }
      if (this._imageProcessingConfiguration) {
        this._imageProcessingObserver = this._imageProcessingConfiguration.onUpdateParameters.add(() => {
          if (this._markAllSubMeshesAsImageProcessingDirty) {
            this._markAllSubMeshesAsImageProcessingDirty();
          }
        });
      }
    }
    /**
     * Gets whether the color curves effect is enabled.
     */
    get cameraColorCurvesEnabled() {
      return this.imageProcessingConfiguration.colorCurvesEnabled;
    }
    /**
     * Sets whether the color curves effect is enabled.
     */
    set cameraColorCurvesEnabled(value) {
      this.imageProcessingConfiguration.colorCurvesEnabled = value;
    }
    /**
     * Gets whether the color grading effect is enabled.
     */
    get cameraColorGradingEnabled() {
      return this.imageProcessingConfiguration.colorGradingEnabled;
    }
    /**
     * Gets whether the color grading effect is enabled.
     */
    set cameraColorGradingEnabled(value) {
      this.imageProcessingConfiguration.colorGradingEnabled = value;
    }
    /**
     * Gets whether tonemapping is enabled or not.
     */
    get cameraToneMappingEnabled() {
      return this._imageProcessingConfiguration.toneMappingEnabled;
    }
    /**
     * Sets whether tonemapping is enabled or not
     */
    set cameraToneMappingEnabled(value) {
      this._imageProcessingConfiguration.toneMappingEnabled = value;
    }
    /**
     * The camera exposure used on this material.
     * This property is here and not in the camera to allow controlling exposure without full screen post process.
     * This corresponds to a photographic exposure.
     */
    get cameraExposure() {
      return this._imageProcessingConfiguration.exposure;
    }
    /**
     * The camera exposure used on this material.
     * This property is here and not in the camera to allow controlling exposure without full screen post process.
     * This corresponds to a photographic exposure.
     */
    set cameraExposure(value) {
      this._imageProcessingConfiguration.exposure = value;
    }
    /**
     * Gets The camera contrast used on this material.
     */
    get cameraContrast() {
      return this._imageProcessingConfiguration.contrast;
    }
    /**
     * Sets The camera contrast used on this material.
     */
    set cameraContrast(value) {
      this._imageProcessingConfiguration.contrast = value;
    }
    /**
     * Gets the Color Grading 2D Lookup Texture.
     */
    get cameraColorGradingTexture() {
      return this._imageProcessingConfiguration.colorGradingTexture;
    }
    /**
     * Sets the Color Grading 2D Lookup Texture.
     */
    set cameraColorGradingTexture(value) {
      this._imageProcessingConfiguration.colorGradingTexture = value;
    }
    /**
     * The color grading curves provide additional color adjustmnent that is applied after any color grading transform (3D LUT).
     * They allow basic adjustment of saturation and small exposure adjustments, along with color filter tinting to provide white balance adjustment or more stylistic effects.
     * These are similar to controls found in many professional imaging or colorist software. The global controls are applied to the entire image. For advanced tuning, extra controls are provided to adjust the shadow, midtone and highlight areas of the image;
     * corresponding to low luminance, medium luminance, and high luminance areas respectively.
     */
    get cameraColorCurves() {
      return this._imageProcessingConfiguration.colorCurves;
    }
    /**
     * The color grading curves provide additional color adjustment that is applied after any color grading transform (3D LUT).
     * They allow basic adjustment of saturation and small exposure adjustments, along with color filter tinting to provide white balance adjustment or more stylistic effects.
     * These are similar to controls found in many professional imaging or colorist software. The global controls are applied to the entire image. For advanced tuning, extra controls are provided to adjust the shadow, midtone and highlight areas of the image;
     * corresponding to low luminance, medium luminance, and high luminance areas respectively.
     */
    set cameraColorCurves(value) {
      this._imageProcessingConfiguration.colorCurves = value;
    }
  };
}

export {
  PrePassConfiguration,
  MaterialHelperGeometryRendering,
  UVDefinesMixin,
  ImageProcessingMixin
};
//# sourceMappingURL=chunk-UZU2JH3G.js.map
