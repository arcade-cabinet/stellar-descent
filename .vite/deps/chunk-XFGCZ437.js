import {
  BaseParticleSystem,
  BoxParticleEmitter,
  ColorGradient,
  CreateConeEmitter,
  CreateCylinderEmitter,
  CreateDirectedConeEmitter,
  CreateDirectedCylinderEmitter,
  CreateDirectedSphereEmitter,
  CreateHemisphericEmitter,
  CreatePointEmitter,
  CreateSphereEmitter,
  CustomParticleEmitter,
  FactorGradient,
  GradientHelper,
  ParticleSystem
} from "./chunk-5I6NLTBN.js";
import {
  RawTexture
} from "./chunk-MLQDLMPH.js";
import {
  Engine
} from "./chunk-ZRA7NYDC.js";
import {
  AddClipPlaneUniforms,
  BindClipPlane,
  BindFogParameters,
  BindLogDepth,
  PrepareStringDefinesForClipPlanes
} from "./chunk-TJZRBYWF.js";
import {
  DrawWrapper
} from "./chunk-LY4CWJEX.js";
import {
  Scene
} from "./chunk-WNGJ3WNO.js";
import {
  ImageProcessingConfiguration
} from "./chunk-GGUL3CXV.js";
import {
  Buffer,
  VertexBuffer
} from "./chunk-ZOIT5ZEZ.js";
import {
  AbstractEngine
} from "./chunk-CQNOHBC6.js";
import {
  ShaderStore
} from "./chunk-4KL4KK2C.js";
import {
  Color4,
  TmpColors
} from "./chunk-I3IYKWNG.js";
import {
  Matrix,
  TmpVectors,
  Vector3
} from "./chunk-YLLTSBLI.js";
import {
  EngineStore
} from "./chunk-YSTPYZG5.js";
import {
  GetClass
} from "./chunk-LUXUKJKM.js";
import {
  Lerp
} from "./chunk-WOUDRWXV.js";
import {
  Observable
} from "./chunk-3EU3L2QH.js";

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Engines/Extensions/engine.transformFeedback.js
Engine.prototype.createTransformFeedback = function() {
  const transformFeedback = this._gl.createTransformFeedback();
  if (!transformFeedback) {
    throw new Error("Unable to create Transform Feedback");
  }
  return transformFeedback;
};
Engine.prototype.deleteTransformFeedback = function(value) {
  this._gl.deleteTransformFeedback(value);
};
Engine.prototype.bindTransformFeedback = function(value) {
  this._gl.bindTransformFeedback(this._gl.TRANSFORM_FEEDBACK, value);
};
Engine.prototype.beginTransformFeedback = function(usePoints = true) {
  this._gl.beginTransformFeedback(usePoints ? this._gl.POINTS : this._gl.TRIANGLES);
};
Engine.prototype.endTransformFeedback = function() {
  this._gl.endTransformFeedback();
};
Engine.prototype.setTranformFeedbackVaryings = function(program, value) {
  this._gl.transformFeedbackVaryings(program, value, this._gl.INTERLEAVED_ATTRIBS);
};
Engine.prototype.bindTransformFeedbackBuffer = function(value) {
  this._gl.bindBufferBase(this._gl.TRANSFORM_FEEDBACK_BUFFER, 0, value ? value.underlyingResource : null);
};
Engine.prototype.readTransformFeedbackBuffer = function(target) {
  this._gl.getBufferSubData(this._gl.TRANSFORM_FEEDBACK_BUFFER, 0, target);
};

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/clipPlaneFragmentDeclaration2.js
var name = "clipPlaneFragmentDeclaration2";
var shader = `#ifdef CLIPPLANE
in float fClipDistance;
#endif
#ifdef CLIPPLANE2
in float fClipDistance2;
#endif
#ifdef CLIPPLANE3
in float fClipDistance3;
#endif
#ifdef CLIPPLANE4
in float fClipDistance4;
#endif
#ifdef CLIPPLANE5
in float fClipDistance5;
#endif
#ifdef CLIPPLANE6
in float fClipDistance6;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name]) {
  ShaderStore.IncludesShadersStore[name] = shader;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/gpuRenderParticles.fragment.js
var name2 = "gpuRenderParticlesPixelShader";
var shader2 = `precision highp float;
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
uniform sampler2D diffuseSampler;varying vec2 vUV;varying vec4 vColor;
#include<clipPlaneFragmentDeclaration2> 
#include<imageProcessingDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#include<fogFragmentDeclaration>
void main() {
#include<clipPlaneFragment> 
vec4 textureColor=texture2D(diffuseSampler,vUV);gl_FragColor=textureColor*vColor;
#ifdef BLENDMULTIPLYMODE
float alpha=vColor.a*textureColor.a;gl_FragColor.rgb=gl_FragColor.rgb*alpha+vec3(1.0)*(1.0-alpha);
#endif 
#include<logDepthFragment>
#include<fogFragment>(color,gl_FragColor)
#ifdef IMAGEPROCESSINGPOSTPROCESS
gl_FragColor.rgb=toLinearSpace(gl_FragColor.rgb);
#else
#ifdef IMAGEPROCESSING
gl_FragColor.rgb=toLinearSpace(gl_FragColor.rgb);gl_FragColor=applyImageProcessing(gl_FragColor);
#endif
#endif
}
`;
if (!ShaderStore.ShadersStore[name2]) {
  ShaderStore.ShadersStore[name2] = shader2;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/ShadersInclude/clipPlaneVertexDeclaration2.js
var name3 = "clipPlaneVertexDeclaration2";
var shader3 = `#ifdef CLIPPLANE
uniform vec4 vClipPlane;out float fClipDistance;
#endif
#ifdef CLIPPLANE2
uniform vec4 vClipPlane2;out float fClipDistance2;
#endif
#ifdef CLIPPLANE3
uniform vec4 vClipPlane3;out float fClipDistance3;
#endif
#ifdef CLIPPLANE4
uniform vec4 vClipPlane4;out float fClipDistance4;
#endif
#ifdef CLIPPLANE5
uniform vec4 vClipPlane5;out float fClipDistance5;
#endif
#ifdef CLIPPLANE6
uniform vec4 vClipPlane6;out float fClipDistance6;
#endif
`;
if (!ShaderStore.IncludesShadersStore[name3]) {
  ShaderStore.IncludesShadersStore[name3] = shader3;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Shaders/gpuRenderParticles.vertex.js
var name4 = "gpuRenderParticlesVertexShader";
var shader4 = `precision highp float;uniform mat4 view;uniform mat4 projection;uniform vec2 translationPivot;uniform vec3 worldOffset;
#ifdef LOCAL
uniform mat4 emitterWM;
#endif
attribute vec3 position;attribute float age;attribute float life;attribute vec3 size;
#ifndef BILLBOARD
attribute vec3 initialDirection;
#endif
#ifdef BILLBOARDSTRETCHED
attribute vec3 direction;
#endif
attribute float angle;
#ifdef ANIMATESHEET
attribute float cellIndex;
#endif
attribute vec2 offset;attribute vec2 uv;varying vec2 vUV;varying vec4 vColor;varying vec3 vPositionW;
#if defined(BILLBOARD) && !defined(BILLBOARDY) && !defined(BILLBOARDSTRETCHED)
uniform mat4 invView;
#endif
#include<clipPlaneVertexDeclaration2>
#include<fogVertexDeclaration>
#include<logDepthDeclaration>
#ifdef COLORGRADIENTS
uniform sampler2D colorGradientSampler;
#else
uniform vec4 colorDead;attribute vec4 color;
#endif
#ifdef ANIMATESHEET
uniform vec3 sheetInfos;
#endif
#ifdef BILLBOARD
uniform vec3 eyePosition;
#endif
vec3 rotate(vec3 yaxis,vec3 rotatedCorner) {vec3 xaxis=normalize(cross(vec3(0.,1.0,0.),yaxis));vec3 zaxis=normalize(cross(yaxis,xaxis));vec3 row0=vec3(xaxis.x,xaxis.y,xaxis.z);vec3 row1=vec3(yaxis.x,yaxis.y,yaxis.z);vec3 row2=vec3(zaxis.x,zaxis.y,zaxis.z);mat3 rotMatrix= mat3(row0,row1,row2);vec3 alignedCorner=rotMatrix*rotatedCorner;
#ifdef LOCAL
return ((emitterWM*vec4(position,1.0)).xyz+worldOffset)+alignedCorner;
#else
return (position+worldOffset)+alignedCorner;
#endif
}
#ifdef BILLBOARDSTRETCHED
vec3 rotateAlign(vec3 toCamera,vec3 rotatedCorner) {vec3 normalizedToCamera=normalize(toCamera);vec3 normalizedCrossDirToCamera=normalize(cross(normalize(direction),normalizedToCamera));vec3 crossProduct=normalize(cross(normalizedToCamera,normalizedCrossDirToCamera));vec3 row0=vec3(normalizedCrossDirToCamera.x,normalizedCrossDirToCamera.y,normalizedCrossDirToCamera.z);vec3 row1=vec3(crossProduct.x,crossProduct.y,crossProduct.z);vec3 row2=vec3(normalizedToCamera.x,normalizedToCamera.y,normalizedToCamera.z);mat3 rotMatrix= mat3(row0,row1,row2);vec3 alignedCorner=rotMatrix*rotatedCorner;
#ifdef LOCAL
return ((emitterWM*vec4(position,1.0)).xyz+worldOffset)+alignedCorner;
#else
return (position+worldOffset)+alignedCorner;
#endif
}
#endif
void main() {
#ifdef ANIMATESHEET
float rowOffset=floor(cellIndex/sheetInfos.z);float columnOffset=cellIndex-rowOffset*sheetInfos.z;vec2 uvScale=sheetInfos.xy;vec2 uvOffset=vec2(uv.x ,1.0-uv.y);vUV=(uvOffset+vec2(columnOffset,rowOffset))*uvScale;
#else
vUV=uv;
#endif
float ratio=min(1.0,age/life);
#ifdef COLORGRADIENTS
vColor=texture2D(colorGradientSampler,vec2(ratio,0));
#else
vColor=color*vec4(1.0-ratio)+colorDead*vec4(ratio);
#endif
vec2 cornerPos=(offset-translationPivot)*size.yz*size.x;
#ifdef BILLBOARD
vec4 rotatedCorner;rotatedCorner.w=0.;
#ifdef BILLBOARDY
rotatedCorner.x=cornerPos.x*cos(angle)-cornerPos.y*sin(angle);rotatedCorner.z=cornerPos.x*sin(angle)+cornerPos.y*cos(angle);rotatedCorner.y=0.;rotatedCorner.xz+=translationPivot;vec3 yaxis=(position+worldOffset)-eyePosition;yaxis.y=0.;vPositionW=rotate(normalize(yaxis),rotatedCorner.xyz);vec4 viewPosition=(view*vec4(vPositionW,1.0));
#elif defined(BILLBOARDSTRETCHED)
rotatedCorner.x=cornerPos.x*cos(angle)-cornerPos.y*sin(angle);rotatedCorner.y=cornerPos.x*sin(angle)+cornerPos.y*cos(angle);rotatedCorner.z=0.;rotatedCorner.xy+=translationPivot;vec3 toCamera=(position+worldOffset)-eyePosition;vPositionW=rotateAlign(toCamera,rotatedCorner.xyz);vec4 viewPosition=(view*vec4(vPositionW,1.0));
#else
rotatedCorner.x=cornerPos.x*cos(angle)-cornerPos.y*sin(angle);rotatedCorner.y=cornerPos.x*sin(angle)+cornerPos.y*cos(angle);rotatedCorner.z=0.;rotatedCorner.xy+=translationPivot;
#ifdef LOCAL
vec4 viewPosition=view*vec4(((emitterWM*vec4(position,1.0)).xyz+worldOffset),1.0)+rotatedCorner;
#else
vec4 viewPosition=view*vec4((position+worldOffset),1.0)+rotatedCorner;
#endif
vPositionW=(invView*viewPosition).xyz;
#endif
#else
vec3 rotatedCorner;rotatedCorner.x=cornerPos.x*cos(angle)-cornerPos.y*sin(angle);rotatedCorner.y=0.;rotatedCorner.z=cornerPos.x*sin(angle)+cornerPos.y*cos(angle);rotatedCorner.xz+=translationPivot;vec3 yaxis=normalize(initialDirection);vPositionW=rotate(yaxis,rotatedCorner);vec4 viewPosition=view*vec4(vPositionW,1.0);
#endif
gl_Position=projection*viewPosition;
#if defined(CLIPPLANE) || defined(CLIPPLANE2) || defined(CLIPPLANE3) || defined(CLIPPLANE4) || defined(CLIPPLANE5) || defined(CLIPPLANE6) || defined(FOG)
vec4 worldPos=vec4(vPositionW,1.0);
#endif
#include<clipPlaneVertex>
#include<fogVertex>
#include<logDepthVertex>
}`;
if (!ShaderStore.ShadersStore[name4]) {
  ShaderStore.ShadersStore[name4] = shader4;
}

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Particles/gpuParticleSystem.js
var GPUParticleSystem = class _GPUParticleSystem extends BaseParticleSystem {
  /**
   * Gets a boolean indicating if the GPU particles can be rendered on current browser
   */
  static get IsSupported() {
    if (!EngineStore.LastCreatedEngine) {
      return false;
    }
    const caps = EngineStore.LastCreatedEngine.getCaps();
    return caps.supportTransformFeedbacks || caps.supportComputeShaders;
  }
  _createIndexBuffer() {
    this._linesIndexBufferUseInstancing = this._engine.createIndexBuffer(new Uint32Array([0, 1, 1, 3, 3, 2, 2, 0, 0, 3]), void 0, "GPUParticleSystemLinesIndexBuffer");
  }
  /**
   * Gets the maximum number of particles active at the same time.
   * @returns The max number of active particles.
   */
  getCapacity() {
    return this._capacity;
  }
  /**
   * Gets or set the number of active particles
   * The value cannot be greater than "capacity" (if it is, it will be limited to "capacity").
   */
  get maxActiveParticleCount() {
    return this._maxActiveParticleCount;
  }
  set maxActiveParticleCount(value) {
    this._maxActiveParticleCount = Math.min(value, this._capacity);
  }
  /**
   * Gets or set the number of active particles
   * @deprecated Please use maxActiveParticleCount instead.
   */
  get activeParticleCount() {
    return this.maxActiveParticleCount;
  }
  set activeParticleCount(value) {
    this.maxActiveParticleCount = value;
  }
  /**
   * Creates a Point Emitter for the particle system (emits directly from the emitter position)
   * @param direction1 Particles are emitted between the direction1 and direction2 from within the box
   * @param direction2 Particles are emitted between the direction1 and direction2 from within the box
   * @returns the emitter
   */
  createPointEmitter(direction1, direction2) {
    const particleEmitter = CreatePointEmitter(direction1, direction2);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  /**
   * Creates a Hemisphere Emitter for the particle system (emits along the hemisphere radius)
   * @param radius The radius of the hemisphere to emit from
   * @param radiusRange The range of the hemisphere to emit from [0-1] 0 Surface Only, 1 Entire Radius
   * @returns the emitter
   */
  createHemisphericEmitter(radius = 1, radiusRange = 1) {
    const particleEmitter = CreateHemisphericEmitter(radius, radiusRange);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  /**
   * Creates a Sphere Emitter for the particle system (emits along the sphere radius)
   * @param radius The radius of the sphere to emit from
   * @param radiusRange The range of the sphere to emit from [0-1] 0 Surface Only, 1 Entire Radius
   * @returns the emitter
   */
  createSphereEmitter(radius = 1, radiusRange = 1) {
    const particleEmitter = CreateSphereEmitter(radius, radiusRange);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  /**
   * Creates a Directed Sphere Emitter for the particle system (emits between direction1 and direction2)
   * @param radius The radius of the sphere to emit from
   * @param direction1 Particles are emitted between the direction1 and direction2 from within the sphere
   * @param direction2 Particles are emitted between the direction1 and direction2 from within the sphere
   * @returns the emitter
   */
  createDirectedSphereEmitter(radius = 1, direction1 = new Vector3(0, 1, 0), direction2 = new Vector3(0, 1, 0)) {
    const particleEmitter = CreateDirectedSphereEmitter(radius, direction1, direction2);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  /**
   * Creates a Cylinder Emitter for the particle system (emits from the cylinder to the particle position)
   * @param radius The radius of the emission cylinder
   * @param height The height of the emission cylinder
   * @param radiusRange The range of emission [0-1] 0 Surface only, 1 Entire Radius
   * @param directionRandomizer How much to randomize the particle direction [0-1]
   * @returns the emitter
   */
  createCylinderEmitter(radius = 1, height = 1, radiusRange = 1, directionRandomizer = 0) {
    const particleEmitter = CreateCylinderEmitter(radius, height, radiusRange, directionRandomizer);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  /**
   * Creates a Directed Cylinder Emitter for the particle system (emits between direction1 and direction2)
   * @param radius The radius of the cylinder to emit from
   * @param height The height of the emission cylinder
   * @param radiusRange the range of the emission cylinder [0-1] 0 Surface only, 1 Entire Radius (1 by default)
   * @param direction1 Particles are emitted between the direction1 and direction2 from within the cylinder
   * @param direction2 Particles are emitted between the direction1 and direction2 from within the cylinder
   * @returns the emitter
   */
  createDirectedCylinderEmitter(radius = 1, height = 1, radiusRange = 1, direction1 = new Vector3(0, 1, 0), direction2 = new Vector3(0, 1, 0)) {
    const particleEmitter = CreateDirectedCylinderEmitter(radius, height, radiusRange, direction1, direction2);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  /**
   * Creates a Cone Emitter for the particle system (emits from the cone to the particle position)
   * @param radius The radius of the cone to emit from
   * @param angle The base angle of the cone
   * @returns the emitter
   */
  createConeEmitter(radius = 1, angle = Math.PI / 4) {
    const particleEmitter = CreateConeEmitter(radius, angle);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  createDirectedConeEmitter(radius = 1, angle = Math.PI / 4, direction1 = new Vector3(0, 1, 0), direction2 = new Vector3(0, 1, 0)) {
    const particleEmitter = CreateDirectedConeEmitter(radius, angle, direction1, direction2);
    this.particleEmitterType = particleEmitter;
    return particleEmitter;
  }
  /**
   * Creates a Box Emitter for the particle system. (emits between direction1 and direction2 from withing the box defined by minEmitBox and maxEmitBox)
   * @param direction1 Particles are emitted between the direction1 and direction2 from within the box
   * @param direction2 Particles are emitted between the direction1 and direction2 from within the box
   * @param minEmitBox Particles are emitted from the box between minEmitBox and maxEmitBox
   * @param maxEmitBox  Particles are emitted from the box between minEmitBox and maxEmitBox
   * @returns the emitter
   */
  createBoxEmitter(direction1, direction2, minEmitBox, maxEmitBox) {
    const particleEmitter = new BoxParticleEmitter();
    this.particleEmitterType = particleEmitter;
    this.direction1 = direction1;
    this.direction2 = direction2;
    this.minEmitBox = minEmitBox;
    this.maxEmitBox = maxEmitBox;
    return particleEmitter;
  }
  /** Gets or sets the current flow map */
  get flowMap() {
    return this._flowMap;
  }
  set flowMap(value) {
    if (this._flowMap === value) {
      return;
    }
    this._flowMap = value;
  }
  /**
   * Is this system ready to be used/rendered
   * @returns true if the system is ready
   */
  isReady() {
    if (!this.emitter || this._imageProcessingConfiguration && !this._imageProcessingConfiguration.isReady() || this._flowMap && !this._flowMap.isReady() || !this.particleTexture || !this.particleTexture.isReady() || this._rebuildingAfterContextLost) {
      return false;
    }
    if (this.blendMode !== ParticleSystem.BLENDMODE_MULTIPLYADD) {
      if (!this._getWrapper(this.blendMode).effect.isReady()) {
        return false;
      }
    } else {
      if (!this._getWrapper(ParticleSystem.BLENDMODE_MULTIPLY).effect.isReady()) {
        return false;
      }
      if (!this._getWrapper(ParticleSystem.BLENDMODE_ADD).effect.isReady()) {
        return false;
      }
    }
    if (!this._platform.isUpdateBufferCreated()) {
      this._recreateUpdateEffect();
      return false;
    }
    return this._platform.isUpdateBufferReady();
  }
  /**
   * Gets if the system has been started. (Note: this will still be true after stop is called)
   * @returns True if it has been started, otherwise false.
   */
  isStarted() {
    return this._started;
  }
  /**
   * Gets if the system has been stopped. (Note: rendering is still happening but the system is frozen)
   * @returns True if it has been stopped, otherwise false.
   */
  isStopped() {
    return this._stopped;
  }
  /**
   * Gets a boolean indicating that the system is stopping
   * @returns true if the system is currently stopping
   */
  isStopping() {
    return false;
  }
  /**
   * Gets the number of particles active at the same time.
   * @returns The number of active particles.
   */
  getActiveCount() {
    return this._currentActiveCount;
  }
  /**
   * Starts the particle system and begins to emit
   * @param delay defines the delay in milliseconds before starting the system (this.startDelay by default)
   */
  start(delay = this.startDelay) {
    if (!this.targetStopDuration && this._hasTargetStopDurationDependantGradient()) {
      throw "Particle system started with a targetStopDuration dependant gradient (eg. startSizeGradients) but no targetStopDuration set";
    }
    if (delay) {
      setTimeout(() => {
        this.start(0);
      }, delay);
      return;
    }
    this._started = true;
    this._stopped = false;
    this._actualFrame = 0;
    this._preWarmDone = false;
    if (this.beginAnimationOnStart && this.animations && this.animations.length > 0 && this._scene) {
      this._scene.beginAnimation(this, this.beginAnimationFrom, this.beginAnimationTo, this.beginAnimationLoop);
    }
  }
  /**
   * Stops the particle system.
   */
  stop() {
    if (this._stopped) {
      return;
    }
    this.onStoppedObservable.notifyObservers(this);
    this._stopped = true;
  }
  /**
   * Remove all active particles
   */
  reset() {
    this._releaseBuffers();
    this._platform.releaseVertexBuffers();
    this._currentActiveCount = 0;
    this._targetIndex = 0;
  }
  /**
   * Returns the string "GPUParticleSystem"
   * @returns a string containing the class name
   */
  getClassName() {
    return "GPUParticleSystem";
  }
  /**
   * Gets the custom effect used to render the particles
   * @param blendMode Blend mode for which the effect should be retrieved
   * @returns The effect
   */
  getCustomEffect(blendMode = 0) {
    return this._customWrappers[blendMode]?.effect ?? this._customWrappers[0].effect;
  }
  _getCustomDrawWrapper(blendMode = 0) {
    return this._customWrappers[blendMode] ?? this._customWrappers[0];
  }
  /**
   * Sets the custom effect used to render the particles
   * @param effect The effect to set
   * @param blendMode Blend mode for which the effect should be set
   */
  setCustomEffect(effect, blendMode = 0) {
    this._customWrappers[blendMode] = new DrawWrapper(this._engine);
    this._customWrappers[blendMode].effect = effect;
  }
  /**
   * Observable that will be called just before the particles are drawn
   */
  get onBeforeDrawParticlesObservable() {
    if (!this._onBeforeDrawParticlesObservable) {
      this._onBeforeDrawParticlesObservable = new Observable();
    }
    return this._onBeforeDrawParticlesObservable;
  }
  /**
   * Gets the name of the particle vertex shader
   */
  get vertexShaderName() {
    return "gpuRenderParticles";
  }
  /**
   * Gets the vertex buffers used by the particle system
   * Should be called after render() has been called for the current frame so that the buffers returned are the ones that have been updated
   * in the current frame (there's a ping-pong between two sets of buffers - for a given frame, one set is used as the source and the other as the destination)
   */
  get vertexBuffers() {
    return this._renderVertexBuffers[this._targetIndex ^ 1];
  }
  /**
   * Gets the index buffer used by the particle system (null for GPU particle systems)
   */
  get indexBuffer() {
    return null;
  }
  _removeGradientAndTexture(gradient, gradients, texture) {
    super._removeGradientAndTexture(gradient, gradients, texture);
    this._releaseBuffers();
    return this;
  }
  /**
   * Adds a new color gradient
   * @param gradient defines the gradient to use (between 0 and 1)
   * @param color1 defines the color to affect to the specified gradient
   * @returns the current particle system
   */
  addColorGradient(gradient, color1) {
    if (!this._colorGradients) {
      this._colorGradients = [];
    }
    const colorGradient = new ColorGradient(gradient, color1);
    this._colorGradients.push(colorGradient);
    this._refreshColorGradient(true);
    this._releaseBuffers();
    return this;
  }
  _refreshColorGradient(reorder = false) {
    if (this._colorGradients) {
      if (reorder) {
        this._colorGradients.sort((a, b) => {
          if (a.gradient < b.gradient) {
            return -1;
          } else if (a.gradient > b.gradient) {
            return 1;
          }
          return 0;
        });
      }
      if (this._colorGradientsTexture) {
        this._colorGradientsTexture.dispose();
        this._colorGradientsTexture = null;
      }
    }
  }
  /** Force the system to rebuild all gradients that need to be resync */
  forceRefreshGradients() {
    this._refreshColorGradient();
    this._refreshFactorGradient(this._sizeGradients, "_sizeGradientsTexture");
    this._refreshFactorGradient(this._angularSpeedGradients, "_angularSpeedGradientsTexture");
    this._refreshFactorGradient(this._velocityGradients, "_velocityGradientsTexture");
    this._refreshFactorGradient(this._limitVelocityGradients, "_limitVelocityGradientsTexture");
    this._refreshFactorGradient(this._dragGradients, "_dragGradientsTexture");
    this.reset();
  }
  /**
   * Remove a specific color gradient
   * @param gradient defines the gradient to remove
   * @returns the current particle system
   */
  removeColorGradient(gradient) {
    this._removeGradientAndTexture(gradient, this._colorGradients, this._colorGradientsTexture);
    this._colorGradientsTexture = null;
    return this;
  }
  /**
   * Resets the draw wrappers cache
   */
  resetDrawCache() {
    for (const blendMode in this._drawWrappers) {
      const drawWrapper = this._drawWrappers[blendMode];
      drawWrapper.drawContext?.reset();
    }
  }
  _addFactorGradient(factorGradients, gradient, factor) {
    const valueGradient = new FactorGradient(gradient, factor);
    factorGradients.push(valueGradient);
    this._releaseBuffers();
  }
  /**
   * Adds a new size gradient
   * @param gradient defines the gradient to use (between 0 and 1)
   * @param factor defines the size factor to affect to the specified gradient
   * @returns the current particle system
   */
  addSizeGradient(gradient, factor) {
    if (!this._sizeGradients) {
      this._sizeGradients = [];
    }
    this._addFactorGradient(this._sizeGradients, gradient, factor);
    this._refreshFactorGradient(this._sizeGradients, "_sizeGradientsTexture", true);
    this._releaseBuffers();
    return this;
  }
  /**
   * Remove a specific size gradient
   * @param gradient defines the gradient to remove
   * @returns the current particle system
   */
  removeSizeGradient(gradient) {
    this._removeGradientAndTexture(gradient, this._sizeGradients, this._sizeGradientsTexture);
    this._sizeGradientsTexture = null;
    return this;
  }
  _refreshFactorGradient(factorGradients, textureName, reorder = false) {
    if (!factorGradients) {
      return;
    }
    if (reorder) {
      factorGradients.sort((a, b) => {
        if (a.gradient < b.gradient) {
          return -1;
        } else if (a.gradient > b.gradient) {
          return 1;
        }
        return 0;
      });
    }
    const that = this;
    if (that[textureName]) {
      that[textureName].dispose();
      that[textureName] = null;
    }
  }
  /**
   * Adds a new angular speed gradient
   * @param gradient defines the gradient to use (between 0 and 1)
   * @param factor defines the angular speed to affect to the specified gradient
   * @returns the current particle system
   */
  addAngularSpeedGradient(gradient, factor) {
    if (!this._angularSpeedGradients) {
      this._angularSpeedGradients = [];
    }
    this._addFactorGradient(this._angularSpeedGradients, gradient, factor);
    this._refreshFactorGradient(this._angularSpeedGradients, "_angularSpeedGradientsTexture", true);
    this._releaseBuffers();
    return this;
  }
  /**
   * Remove a specific angular speed gradient
   * @param gradient defines the gradient to remove
   * @returns the current particle system
   */
  removeAngularSpeedGradient(gradient) {
    this._removeGradientAndTexture(gradient, this._angularSpeedGradients, this._angularSpeedGradientsTexture);
    this._angularSpeedGradientsTexture = null;
    return this;
  }
  /**
   * Adds a new velocity gradient
   * @param gradient defines the gradient to use (between 0 and 1)
   * @param factor defines the velocity to affect to the specified gradient
   * @returns the current particle system
   */
  addVelocityGradient(gradient, factor) {
    if (!this._velocityGradients) {
      this._velocityGradients = [];
    }
    this._addFactorGradient(this._velocityGradients, gradient, factor);
    this._refreshFactorGradient(this._velocityGradients, "_velocityGradientsTexture", true);
    this._releaseBuffers();
    return this;
  }
  /**
   * Remove a specific velocity gradient
   * @param gradient defines the gradient to remove
   * @returns the current particle system
   */
  removeVelocityGradient(gradient) {
    this._removeGradientAndTexture(gradient, this._velocityGradients, this._velocityGradientsTexture);
    this._velocityGradientsTexture = null;
    return this;
  }
  /**
   * Adds a new limit velocity gradient
   * @param gradient defines the gradient to use (between 0 and 1)
   * @param factor defines the limit velocity value to affect to the specified gradient
   * @returns the current particle system
   */
  addLimitVelocityGradient(gradient, factor) {
    if (!this._limitVelocityGradients) {
      this._limitVelocityGradients = [];
    }
    this._addFactorGradient(this._limitVelocityGradients, gradient, factor);
    this._refreshFactorGradient(this._limitVelocityGradients, "_limitVelocityGradientsTexture", true);
    this._releaseBuffers();
    return this;
  }
  /**
   * Remove a specific limit velocity gradient
   * @param gradient defines the gradient to remove
   * @returns the current particle system
   */
  removeLimitVelocityGradient(gradient) {
    this._removeGradientAndTexture(gradient, this._limitVelocityGradients, this._limitVelocityGradientsTexture);
    this._limitVelocityGradientsTexture = null;
    return this;
  }
  /**
   * Adds a new drag gradient
   * @param gradient defines the gradient to use (between 0 and 1)
   * @param factor defines the drag value to affect to the specified gradient
   * @returns the current particle system
   */
  addDragGradient(gradient, factor) {
    if (!this._dragGradients) {
      this._dragGradients = [];
    }
    this._addFactorGradient(this._dragGradients, gradient, factor);
    this._refreshFactorGradient(this._dragGradients, "_dragGradientsTexture", true);
    this._releaseBuffers();
    return this;
  }
  /**
   * Remove a specific drag gradient
   * @param gradient defines the gradient to remove
   * @returns the current particle system
   */
  removeDragGradient(gradient) {
    this._removeGradientAndTexture(gradient, this._dragGradients, this._dragGradientsTexture);
    this._dragGradientsTexture = null;
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  addEmitRateGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  removeEmitRateGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  addStartSizeGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  removeStartSizeGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  addColorRemapGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  removeColorRemapGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  addAlphaRemapGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  removeAlphaRemapGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  addRampGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  removeRampGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the list of ramp gradients
   */
  getRampGradients() {
    return null;
  }
  /**
   * Not supported by GPUParticleSystem
   * Gets or sets a boolean indicating that ramp gradients must be used
   * @see https://doc.babylonjs.com/features/featuresDeepDive/particles/particle_system/particle_system_intro#ramp-gradients
   */
  get useRampGradients() {
    return false;
  }
  set useRampGradients(value) {
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  addLifeTimeGradient() {
    return this;
  }
  /**
   * Not supported by GPUParticleSystem
   * @returns the current particle system
   */
  removeLifeTimeGradient() {
    return this;
  }
  /**
   * Instantiates a GPU particle system.
   * Particles are often small sprites used to simulate hard-to-reproduce phenomena like fire, smoke, water, or abstract visual effects like magic glitter and faery dust.
   * @param name The name of the particle system
   * @param options The options used to create the system
   * @param sceneOrEngine The scene the particle system belongs to or the engine to use if no scene
   * @param customEffect a custom effect used to change the way particles are rendered by default
   * @param isAnimationSheetEnabled Must be true if using a spritesheet to animate the particles texture
   */
  constructor(name5, options, sceneOrEngine, customEffect = null, isAnimationSheetEnabled = false) {
    super(name5);
    this.layerMask = 268435455;
    this._accumulatedCount = 0;
    this._renderVertexBuffers = [];
    this._targetIndex = 0;
    this._currentRenderId = -1;
    this._currentRenderingCameraUniqueId = -1;
    this._started = false;
    this._stopped = false;
    this._timeDelta = 0;
    this.updateInAnimate = false;
    this._actualFrame = 0;
    this._rawTextureWidth = 256;
    this._rebuildingAfterContextLost = false;
    this.doNotSerialize = false;
    this.onDisposeObservable = new Observable();
    this.onStoppedObservable = new Observable();
    this.onStartedObservable = new Observable();
    this.forceDepthWrite = false;
    this._preWarmDone = false;
    this.isLocal = false;
    this.isGPU = true;
    this.metadata = null;
    this._flowMap = null;
    this.flowMapStrength = 1;
    this._onBeforeDrawParticlesObservable = null;
    if (!sceneOrEngine || sceneOrEngine.getClassName() === "Scene") {
      this._scene = sceneOrEngine || EngineStore.LastCreatedScene;
      this._engine = this._scene.getEngine();
      this.uniqueId = this._scene.getUniqueId();
      this._scene.particleSystems.push(this);
    } else {
      this._engine = sceneOrEngine;
      this.defaultProjectionMatrix = Matrix.PerspectiveFovLH(0.8, 1, 0.1, 100, this._engine.isNDCHalfZRange);
    }
    if (this._engine.getCaps().supportComputeShaders) {
      if (!GetClass("BABYLON.ComputeShaderParticleSystem")) {
        throw new Error("The ComputeShaderParticleSystem class is not available! Make sure you have imported it.");
      }
      this._platform = new (GetClass("BABYLON.ComputeShaderParticleSystem"))(this, this._engine);
    } else {
      if (!GetClass("BABYLON.WebGL2ParticleSystem")) {
        throw new Error("The WebGL2ParticleSystem class is not available! Make sure you have imported it.");
      }
      this._platform = new (GetClass("BABYLON.WebGL2ParticleSystem"))(this, this._engine);
    }
    this._customWrappers = { 0: new DrawWrapper(this._engine) };
    this._customWrappers[0].effect = customEffect;
    this._drawWrappers = { 0: new DrawWrapper(this._engine) };
    if (this._drawWrappers[0].drawContext) {
      this._drawWrappers[0].drawContext.useInstancing = true;
    }
    this._createIndexBuffer();
    this._attachImageProcessingConfiguration(null);
    options = options ?? {};
    if (!options.randomTextureSize) {
      delete options.randomTextureSize;
    }
    const fullOptions = {
      capacity: 5e4,
      randomTextureSize: this._engine.getCaps().maxTextureSize,
      ...options
    };
    const optionsAsNumber = options;
    if (isFinite(optionsAsNumber)) {
      fullOptions.capacity = optionsAsNumber;
    }
    this._capacity = fullOptions.capacity;
    this._maxActiveParticleCount = fullOptions.capacity;
    this._currentActiveCount = 0;
    this._isAnimationSheetEnabled = isAnimationSheetEnabled;
    this.particleEmitterType = new BoxParticleEmitter();
    const maxTextureSize = Math.min(this._engine.getCaps().maxTextureSize, fullOptions.randomTextureSize);
    let d = [];
    for (let i = 0; i < maxTextureSize; ++i) {
      d.push(Math.random());
      d.push(Math.random());
      d.push(Math.random());
      d.push(Math.random());
    }
    this._randomTexture = new RawTexture(new Float32Array(d), maxTextureSize, 1, 5, sceneOrEngine, false, false, 1, 1);
    this._randomTexture.name = "GPUParticleSystem_random1";
    this._randomTexture.wrapU = 1;
    this._randomTexture.wrapV = 1;
    d = [];
    for (let i = 0; i < maxTextureSize; ++i) {
      d.push(Math.random());
      d.push(Math.random());
      d.push(Math.random());
      d.push(Math.random());
    }
    this._randomTexture2 = new RawTexture(new Float32Array(d), maxTextureSize, 1, 5, sceneOrEngine, false, false, 1, 1);
    this._randomTexture2.name = "GPUParticleSystem_random2";
    this._randomTexture2.wrapU = 1;
    this._randomTexture2.wrapV = 1;
    this._randomTextureSize = maxTextureSize;
  }
  _reset() {
    this._releaseBuffers();
  }
  _createVertexBuffers(updateBuffer, renderBuffer, spriteSource) {
    const renderVertexBuffers = {};
    renderVertexBuffers["position"] = renderBuffer.createVertexBuffer("position", 0, 3, this._attributesStrideSize, true);
    let offset = 3;
    renderVertexBuffers["age"] = renderBuffer.createVertexBuffer("age", offset, 1, this._attributesStrideSize, true);
    offset += 1;
    renderVertexBuffers["size"] = renderBuffer.createVertexBuffer("size", offset, 3, this._attributesStrideSize, true);
    offset += 3;
    renderVertexBuffers["life"] = renderBuffer.createVertexBuffer("life", offset, 1, this._attributesStrideSize, true);
    offset += 1;
    offset += 4;
    if (this.billboardMode === ParticleSystem.BILLBOARDMODE_STRETCHED) {
      renderVertexBuffers["direction"] = renderBuffer.createVertexBuffer("direction", offset, 3, this._attributesStrideSize, true);
    }
    offset += 3;
    if (this._platform.alignDataInBuffer) {
      offset += 1;
    }
    if (this.particleEmitterType instanceof CustomParticleEmitter) {
      offset += 3;
      if (this._platform.alignDataInBuffer) {
        offset += 1;
      }
    }
    if (!this._colorGradientsTexture) {
      renderVertexBuffers["color"] = renderBuffer.createVertexBuffer("color", offset, 4, this._attributesStrideSize, true);
      offset += 4;
    }
    if (!this._isBillboardBased) {
      renderVertexBuffers["initialDirection"] = renderBuffer.createVertexBuffer("initialDirection", offset, 3, this._attributesStrideSize, true);
      offset += 3;
      if (this._platform.alignDataInBuffer) {
        offset += 1;
      }
    }
    if (this.noiseTexture) {
      renderVertexBuffers["noiseCoordinates1"] = renderBuffer.createVertexBuffer("noiseCoordinates1", offset, 3, this._attributesStrideSize, true);
      offset += 3;
      if (this._platform.alignDataInBuffer) {
        offset += 1;
      }
      renderVertexBuffers["noiseCoordinates2"] = renderBuffer.createVertexBuffer("noiseCoordinates2", offset, 3, this._attributesStrideSize, true);
      offset += 3;
      if (this._platform.alignDataInBuffer) {
        offset += 1;
      }
    }
    renderVertexBuffers["angle"] = renderBuffer.createVertexBuffer("angle", offset, 1, this._attributesStrideSize, true);
    if (this._angularSpeedGradientsTexture) {
      offset++;
    } else {
      offset += 2;
    }
    if (this._isAnimationSheetEnabled) {
      renderVertexBuffers["cellIndex"] = renderBuffer.createVertexBuffer("cellIndex", offset, 1, this._attributesStrideSize, true);
      offset += 1;
      if (this.spriteRandomStartCell) {
        renderVertexBuffers["cellStartOffset"] = renderBuffer.createVertexBuffer("cellStartOffset", offset, 1, this._attributesStrideSize, true);
        offset += 1;
      }
    }
    renderVertexBuffers["offset"] = spriteSource.createVertexBuffer("offset", 0, 2);
    renderVertexBuffers["uv"] = spriteSource.createVertexBuffer("uv", 2, 2);
    this._renderVertexBuffers.push(renderVertexBuffers);
    this._platform.createVertexBuffers(updateBuffer, renderVertexBuffers);
    this.resetDrawCache();
  }
  _initialize(force = false) {
    if (this._buffer0 && !force) {
      return;
    }
    const engine = this._engine;
    const data = [];
    this._attributesStrideSize = 21;
    this._targetIndex = 0;
    if (this._platform.alignDataInBuffer) {
      this._attributesStrideSize += 1;
    }
    if (this.particleEmitterType instanceof CustomParticleEmitter) {
      this._attributesStrideSize += 3;
      if (this._platform.alignDataInBuffer) {
        this._attributesStrideSize += 1;
      }
    }
    if (!this.isBillboardBased) {
      this._attributesStrideSize += 3;
      if (this._platform.alignDataInBuffer) {
        this._attributesStrideSize += 1;
      }
    }
    if (this._colorGradientsTexture) {
      this._attributesStrideSize -= 4;
    }
    if (this._angularSpeedGradientsTexture) {
      this._attributesStrideSize -= 1;
    }
    if (this._isAnimationSheetEnabled) {
      this._attributesStrideSize += 1;
      if (this.spriteRandomStartCell) {
        this._attributesStrideSize += 1;
      }
    }
    if (this.noiseTexture) {
      this._attributesStrideSize += 6;
      if (this._platform.alignDataInBuffer) {
        this._attributesStrideSize += 2;
      }
    }
    if (this._platform.alignDataInBuffer) {
      this._attributesStrideSize += 3 - (this._attributesStrideSize + 3 & 3);
    }
    const usingCustomEmitter = this.particleEmitterType instanceof CustomParticleEmitter;
    const tmpVector = TmpVectors.Vector3[0];
    let offset = 0;
    for (let particleIndex = 0; particleIndex < this._capacity; particleIndex++) {
      data.push(0);
      data.push(0);
      data.push(0);
      data.push(0);
      data.push(0);
      data.push(0);
      data.push(0);
      data.push(0);
      data.push(Math.random());
      data.push(Math.random());
      data.push(Math.random());
      data.push(Math.random());
      if (usingCustomEmitter) {
        this.particleEmitterType.particleDestinationGenerator(particleIndex, null, tmpVector);
        data.push(tmpVector.x);
        data.push(tmpVector.y);
        data.push(tmpVector.z);
      } else {
        data.push(0);
        data.push(0);
        data.push(0);
      }
      if (this._platform.alignDataInBuffer) {
        data.push(0);
      }
      offset += 16;
      if (usingCustomEmitter) {
        this.particleEmitterType.particlePositionGenerator(particleIndex, null, tmpVector);
        data.push(tmpVector.x);
        data.push(tmpVector.y);
        data.push(tmpVector.z);
        if (this._platform.alignDataInBuffer) {
          data.push(0);
        }
        offset += 4;
      }
      if (!this._colorGradientsTexture) {
        data.push(0);
        data.push(0);
        data.push(0);
        data.push(0);
        offset += 4;
      }
      if (!this.isBillboardBased) {
        data.push(0);
        data.push(0);
        data.push(0);
        if (this._platform.alignDataInBuffer) {
          data.push(0);
        }
        offset += 4;
      }
      if (this.noiseTexture) {
        data.push(Math.random());
        data.push(Math.random());
        data.push(Math.random());
        if (this._platform.alignDataInBuffer) {
          data.push(0);
        }
        data.push(Math.random());
        data.push(Math.random());
        data.push(Math.random());
        if (this._platform.alignDataInBuffer) {
          data.push(0);
        }
        offset += 8;
      }
      data.push(0);
      offset += 1;
      if (!this._angularSpeedGradientsTexture) {
        data.push(0);
        offset += 1;
      }
      if (this._isAnimationSheetEnabled) {
        data.push(0);
        offset += 1;
        if (this.spriteRandomStartCell) {
          data.push(0);
          offset += 1;
        }
      }
      if (this._platform.alignDataInBuffer) {
        let numDummies = 3 - (offset + 3 & 3);
        offset += numDummies;
        while (numDummies-- > 0) {
          data.push(0);
        }
      }
    }
    const spriteData = new Float32Array([0.5, 0.5, 1, 1, -0.5, 0.5, 0, 1, 0.5, -0.5, 1, 0, -0.5, -0.5, 0, 0]);
    const bufferData1 = this._platform.createParticleBuffer(data);
    const bufferData2 = this._platform.createParticleBuffer(data);
    this._buffer0 = new Buffer(engine, bufferData1, false, this._attributesStrideSize);
    this._buffer1 = new Buffer(engine, bufferData2, false, this._attributesStrideSize);
    this._spriteBuffer = new Buffer(engine, spriteData, false, 4);
    this._renderVertexBuffers = [];
    this._createVertexBuffers(this._buffer0, this._buffer1, this._spriteBuffer);
    this._createVertexBuffers(this._buffer1, this._buffer0, this._spriteBuffer);
    this._sourceBuffer = this._buffer0;
    this._targetBuffer = this._buffer1;
  }
  /** @internal */
  _recreateUpdateEffect() {
    this._createColorGradientTexture();
    this._createSizeGradientTexture();
    this._createAngularSpeedGradientTexture();
    this._createVelocityGradientTexture();
    this._createLimitVelocityGradientTexture();
    this._createDragGradientTexture();
    let defines = this.particleEmitterType ? this.particleEmitterType.getEffectDefines() : "";
    if (this._isBillboardBased) {
      defines += "\n#define BILLBOARD";
    }
    if (this._colorGradientsTexture) {
      defines += "\n#define COLORGRADIENTS";
    }
    if (this._sizeGradientsTexture) {
      defines += "\n#define SIZEGRADIENTS";
    }
    if (this._angularSpeedGradientsTexture) {
      defines += "\n#define ANGULARSPEEDGRADIENTS";
    }
    if (this._velocityGradientsTexture) {
      defines += "\n#define VELOCITYGRADIENTS";
    }
    if (this._limitVelocityGradientsTexture) {
      defines += "\n#define LIMITVELOCITYGRADIENTS";
    }
    if (this._dragGradientsTexture) {
      defines += "\n#define DRAGGRADIENTS";
    }
    if (this._flowMap) {
      defines += "\n#define FLOWMAP";
    }
    if (this.isAnimationSheetEnabled) {
      defines += "\n#define ANIMATESHEET";
      if (this.spriteRandomStartCell) {
        defines += "\n#define ANIMATESHEETRANDOMSTART";
      }
    }
    if (this.noiseTexture) {
      defines += "\n#define NOISE";
    }
    if (this.isLocal) {
      defines += "\n#define LOCAL";
    }
    if (this._platform.isUpdateBufferCreated() && this._cachedUpdateDefines === defines) {
      return this._platform.isUpdateBufferReady();
    }
    this._cachedUpdateDefines = defines;
    this._updateBuffer = this._platform.createUpdateBuffer(defines);
    return this._platform.isUpdateBufferReady();
  }
  /**
   * @internal
   */
  _getWrapper(blendMode) {
    const customWrapper = this._getCustomDrawWrapper(blendMode);
    if (customWrapper?.effect) {
      return customWrapper;
    }
    const defines = [];
    this.fillDefines(defines, blendMode);
    let drawWrapper = this._drawWrappers[blendMode];
    if (!drawWrapper) {
      drawWrapper = new DrawWrapper(this._engine);
      if (drawWrapper.drawContext) {
        drawWrapper.drawContext.useInstancing = true;
      }
      this._drawWrappers[blendMode] = drawWrapper;
    }
    const join = defines.join("\n");
    if (drawWrapper.defines !== join) {
      const attributes = [];
      const uniforms = [];
      const samplers = [];
      this.fillUniformsAttributesAndSamplerNames(uniforms, attributes, samplers);
      drawWrapper.setEffect(this._engine.createEffect("gpuRenderParticles", attributes, uniforms, samplers, join), join);
    }
    return drawWrapper;
  }
  /**
   * @internal
   */
  static _GetAttributeNamesOrOptions(hasColorGradients = false, isAnimationSheetEnabled = false, isBillboardBased = false, isBillboardStretched = false) {
    const attributeNamesOrOptions = [VertexBuffer.PositionKind, "age", "life", "size", "angle"];
    if (!hasColorGradients) {
      attributeNamesOrOptions.push(VertexBuffer.ColorKind);
    }
    if (isAnimationSheetEnabled) {
      attributeNamesOrOptions.push("cellIndex");
    }
    if (!isBillboardBased) {
      attributeNamesOrOptions.push("initialDirection");
    }
    if (isBillboardStretched) {
      attributeNamesOrOptions.push("direction");
    }
    attributeNamesOrOptions.push("offset", VertexBuffer.UVKind);
    return attributeNamesOrOptions;
  }
  /**
   * @internal
   */
  static _GetEffectCreationOptions(isAnimationSheetEnabled = false, useLogarithmicDepth = false, applyFog = false) {
    const effectCreationOption = ["emitterWM", "worldOffset", "view", "projection", "colorDead", "invView", "translationPivot", "eyePosition"];
    AddClipPlaneUniforms(effectCreationOption);
    if (isAnimationSheetEnabled) {
      effectCreationOption.push("sheetInfos");
    }
    if (useLogarithmicDepth) {
      effectCreationOption.push("logarithmicDepthConstant");
    }
    if (applyFog) {
      effectCreationOption.push("vFogInfos");
      effectCreationOption.push("vFogColor");
    }
    return effectCreationOption;
  }
  /**
   * Fill the defines array according to the current settings of the particle system
   * @param defines Array to be updated
   * @param blendMode blend mode to take into account when updating the array
   * @param fillImageProcessing fills the image processing defines
   */
  fillDefines(defines, blendMode = 0, fillImageProcessing = true) {
    if (this._scene) {
      PrepareStringDefinesForClipPlanes(this, this._scene, defines);
      if (this.applyFog && this._scene.fogEnabled && this._scene.fogMode !== Scene.FOGMODE_NONE) {
        defines.push("#define FOG");
      }
    }
    if (blendMode === ParticleSystem.BLENDMODE_MULTIPLY) {
      defines.push("#define BLENDMULTIPLYMODE");
    }
    if (this.isLocal) {
      defines.push("#define LOCAL");
    }
    if (this.useLogarithmicDepth) {
      defines.push("#define LOGARITHMICDEPTH");
    }
    if (this._isBillboardBased) {
      defines.push("#define BILLBOARD");
      switch (this.billboardMode) {
        case ParticleSystem.BILLBOARDMODE_Y:
          defines.push("#define BILLBOARDY");
          break;
        case ParticleSystem.BILLBOARDMODE_STRETCHED:
          defines.push("#define BILLBOARDSTRETCHED");
          break;
        case ParticleSystem.BILLBOARDMODE_ALL:
          defines.push("#define BILLBOARDMODE_ALL");
          break;
        default:
          break;
      }
    }
    if (this._colorGradientsTexture) {
      defines.push("#define COLORGRADIENTS");
    }
    if (this.isAnimationSheetEnabled) {
      defines.push("#define ANIMATESHEET");
    }
    if (fillImageProcessing && this._imageProcessingConfiguration) {
      this._imageProcessingConfiguration.prepareDefines(this._imageProcessingConfigurationDefines);
      defines.push("" + this._imageProcessingConfigurationDefines.toString());
    }
  }
  /**
   * Fill the uniforms, attributes and samplers arrays according to the current settings of the particle system
   * @param uniforms Uniforms array to fill
   * @param attributes Attributes array to fill
   * @param samplers Samplers array to fill
   */
  fillUniformsAttributesAndSamplerNames(uniforms, attributes, samplers) {
    attributes.push(..._GPUParticleSystem._GetAttributeNamesOrOptions(!!this._colorGradientsTexture, this._isAnimationSheetEnabled, this._isBillboardBased, this._isBillboardBased && this.billboardMode === ParticleSystem.BILLBOARDMODE_STRETCHED));
    uniforms.push(..._GPUParticleSystem._GetEffectCreationOptions(this._isAnimationSheetEnabled, this.useLogarithmicDepth, this.applyFog));
    samplers.push("diffuseSampler", "colorGradientSampler");
    if (this._imageProcessingConfiguration) {
      ImageProcessingConfiguration.PrepareUniforms(uniforms, this._imageProcessingConfigurationDefines);
      ImageProcessingConfiguration.PrepareSamplers(samplers, this._imageProcessingConfigurationDefines);
    }
  }
  /**
   * Animates the particle system for the current frame by emitting new particles and or animating the living ones.
   * @param preWarm defines if we are in the pre-warmimg phase
   */
  animate(preWarm = false) {
    this._timeDelta = this.updateSpeed * (preWarm ? this.preWarmStepOffset : this._scene?.getAnimationRatio() || 1);
    this._actualFrame += this._timeDelta;
    if (!this._stopped) {
      if (this.targetStopDuration && this._actualFrame >= this.targetStopDuration) {
        this.stop();
      }
    }
    if (this.updateInAnimate) {
      this._update();
    }
  }
  _createFactorGradientTexture(factorGradients, textureName) {
    const texture = this[textureName];
    if (!factorGradients || !factorGradients.length || texture) {
      return;
    }
    const data = new Float32Array(this._rawTextureWidth);
    for (let x = 0; x < this._rawTextureWidth; x++) {
      const ratio = x / this._rawTextureWidth;
      GradientHelper.GetCurrentGradient(ratio, factorGradients, (currentGradient, nextGradient, scale) => {
        data[x] = Lerp(currentGradient.factor1, nextGradient.factor1, scale);
      });
    }
    this[textureName] = RawTexture.CreateRTexture(data, this._rawTextureWidth, 1, this._scene || this._engine, false, false, 1);
    this[textureName].name = textureName.substring(1);
  }
  _createSizeGradientTexture() {
    this._createFactorGradientTexture(this._sizeGradients, "_sizeGradientsTexture");
  }
  _createAngularSpeedGradientTexture() {
    this._createFactorGradientTexture(this._angularSpeedGradients, "_angularSpeedGradientsTexture");
  }
  _createVelocityGradientTexture() {
    this._createFactorGradientTexture(this._velocityGradients, "_velocityGradientsTexture");
  }
  _createLimitVelocityGradientTexture() {
    this._createFactorGradientTexture(this._limitVelocityGradients, "_limitVelocityGradientsTexture");
  }
  _createDragGradientTexture() {
    this._createFactorGradientTexture(this._dragGradients, "_dragGradientsTexture");
  }
  _createColorGradientTexture() {
    if (!this._colorGradients || !this._colorGradients.length || this._colorGradientsTexture) {
      return;
    }
    const data = new Uint8Array(this._rawTextureWidth * 4);
    const tmpColor = TmpColors.Color4[0];
    for (let x = 0; x < this._rawTextureWidth; x++) {
      const ratio = x / this._rawTextureWidth;
      GradientHelper.GetCurrentGradient(ratio, this._colorGradients, (currentGradient, nextGradient, scale) => {
        Color4.LerpToRef(currentGradient.color1, nextGradient.color1, scale, tmpColor);
        data[x * 4] = tmpColor.r * 255;
        data[x * 4 + 1] = tmpColor.g * 255;
        data[x * 4 + 2] = tmpColor.b * 255;
        data[x * 4 + 3] = tmpColor.a * 255;
      });
    }
    this._colorGradientsTexture = RawTexture.CreateRGBATexture(data, this._rawTextureWidth, 1, this._scene, false, false, 1);
    this._colorGradientsTexture.name = "colorGradients";
  }
  _render(blendMode, emitterWM) {
    const drawWrapper = this._getWrapper(blendMode);
    const effect = drawWrapper.effect;
    this._engine.enableEffect(drawWrapper);
    const viewMatrix = this._scene?.getViewMatrix() || Matrix.IdentityReadOnly;
    effect.setMatrix("view", viewMatrix);
    effect.setMatrix("projection", this.defaultProjectionMatrix ?? this._scene.getProjectionMatrix());
    effect.setTexture("diffuseSampler", this.particleTexture);
    effect.setVector2("translationPivot", this.translationPivot);
    const worldOffset = this.worldOffset.subtractToRef(this._scene?.floatingOriginOffset || Vector3.ZeroReadOnly, TmpVectors.Vector3[0]);
    effect.setVector3("worldOffset", worldOffset);
    if (this.isLocal) {
      effect.setMatrix("emitterWM", emitterWM);
    }
    if (this._colorGradientsTexture) {
      effect.setTexture("colorGradientSampler", this._colorGradientsTexture);
    } else {
      effect.setDirectColor4("colorDead", this.colorDead);
    }
    if (this._isAnimationSheetEnabled && this.particleTexture) {
      const baseSize = this.particleTexture.getBaseSize();
      effect.setFloat3("sheetInfos", this.spriteCellWidth / baseSize.width, this.spriteCellHeight / baseSize.height, baseSize.width / this.spriteCellWidth);
    }
    if (this._isBillboardBased && this._scene) {
      const camera = this._scene.activeCamera;
      effect.setVector3("eyePosition", camera.globalPosition);
    }
    const defines = effect.defines;
    if (this._scene) {
      BindClipPlane(effect, this, this._scene);
      if (this.applyFog) {
        BindFogParameters(this._scene, void 0, effect);
      }
    }
    if (defines.indexOf("#define BILLBOARDMODE_ALL") >= 0) {
      const invView = viewMatrix.clone();
      invView.invert();
      effect.setMatrix("invView", invView);
    }
    if (this.useLogarithmicDepth && this._scene) {
      BindLogDepth(defines, effect, this._scene);
    }
    if (this._imageProcessingConfiguration && !this._imageProcessingConfiguration.applyByPostProcess) {
      this._imageProcessingConfiguration.bind(effect);
    }
    this._setEngineBasedOnBlendMode(blendMode);
    this._platform.bindDrawBuffers(this._targetIndex, effect, this._scene?.forceWireframe ? this._linesIndexBufferUseInstancing : null);
    if (this._onBeforeDrawParticlesObservable) {
      this._onBeforeDrawParticlesObservable.notifyObservers(effect);
    }
    if (this._scene?.forceWireframe) {
      this._engine.drawElementsType(6, 0, 10, this._currentActiveCount);
    } else {
      this._engine.drawArraysType(7, 0, 4, this._currentActiveCount);
    }
    this._engine.setAlphaMode(0);
    if (this._scene?.forceWireframe) {
      this._engine.unbindInstanceAttributes();
    }
    return this._currentActiveCount;
  }
  /** @internal */
  _update(emitterWM) {
    if (!this.emitter || !this._targetBuffer) {
      return;
    }
    if (!this._recreateUpdateEffect() || this._rebuildingAfterContextLost) {
      return;
    }
    if (!emitterWM) {
      if (this.emitter.position) {
        const emitterMesh = this.emitter;
        emitterWM = emitterMesh.getWorldMatrix();
      } else {
        const emitterPosition = this.emitter;
        emitterWM = TmpVectors.Matrix[0];
        Matrix.TranslationToRef(emitterPosition.x, emitterPosition.y, emitterPosition.z, emitterWM);
      }
    }
    const engine = this._engine;
    const depthWriteState = engine.getDepthWrite();
    engine.setDepthWrite(false);
    this._platform.preUpdateParticleBuffer();
    this._updateBuffer.setFloat("currentCount", this._currentActiveCount);
    this._updateBuffer.setFloat("timeDelta", this._timeDelta);
    this._updateBuffer.setFloat("stopFactor", this._stopped ? 0 : 1);
    this._updateBuffer.setInt("randomTextureSize", this._randomTextureSize);
    this._updateBuffer.setFloat2("lifeTime", this.minLifeTime, this.maxLifeTime);
    this._updateBuffer.setFloat2("emitPower", this.minEmitPower, this.maxEmitPower);
    if (!this._colorGradientsTexture) {
      this._updateBuffer.setDirectColor4("color1", this.color1);
      this._updateBuffer.setDirectColor4("color2", this.color2);
    }
    this._updateBuffer.setFloat2("sizeRange", this.minSize, this.maxSize);
    this._updateBuffer.setFloat4("scaleRange", this.minScaleX, this.maxScaleX, this.minScaleY, this.maxScaleY);
    this._updateBuffer.setFloat4("angleRange", this.minAngularSpeed, this.maxAngularSpeed, this.minInitialRotation, this.maxInitialRotation);
    this._updateBuffer.setVector3("gravity", this.gravity);
    if (this._limitVelocityGradientsTexture) {
      this._updateBuffer.setFloat("limitVelocityDamping", this.limitVelocityDamping);
    }
    if (this.particleEmitterType) {
      this.particleEmitterType.applyToShader(this._updateBuffer);
    }
    if (this._isAnimationSheetEnabled) {
      this._updateBuffer.setFloat4("cellInfos", this.startSpriteCellID, this.endSpriteCellID, this.spriteCellChangeSpeed, this.spriteCellLoop ? 1 : 0);
    }
    if (this.noiseTexture) {
      this._updateBuffer.setVector3("noiseStrength", this.noiseStrength);
    }
    if (this._flowMap) {
      const scene = this.getScene();
      this._updateBuffer.setFloat("flowMapStrength", this.flowMapStrength);
      this._updateBuffer.setMatrix("flowMapProjection", scene.getTransformMatrix());
    }
    if (!this.isLocal) {
      this._updateBuffer.setMatrix("emitterWM", emitterWM);
    }
    this._platform.updateParticleBuffer(this._targetIndex, this._targetBuffer, this._currentActiveCount);
    this._targetIndex++;
    if (this._targetIndex === 2) {
      this._targetIndex = 0;
    }
    const tmpBuffer = this._sourceBuffer;
    this._sourceBuffer = this._targetBuffer;
    this._targetBuffer = tmpBuffer;
    engine.setDepthWrite(depthWriteState);
  }
  /**
   * Renders the particle system in its current state
   * @param preWarm defines if the system should only update the particles but not render them
   * @param forceUpdateOnly if true, force to only update the particles and never display them (meaning, even if preWarm=false, when forceUpdateOnly=true the particles won't be displayed)
   * @returns the current number of particles
   */
  render(preWarm = false, forceUpdateOnly = false) {
    if (!this._started) {
      return 0;
    }
    if (!this.isReady()) {
      return 0;
    }
    if (!preWarm && this._scene) {
      if (!this._preWarmDone && this.preWarmCycles) {
        for (let index = 0; index < this.preWarmCycles; index++) {
          this.animate(true);
          this.render(true, true);
        }
        this._preWarmDone = true;
      }
      if (this._currentRenderId === this._scene.getRenderId() && (!this._scene.activeCamera || this._scene.activeCamera && this._currentRenderingCameraUniqueId === this._scene.activeCamera.uniqueId)) {
        return 0;
      }
      this._currentRenderId = this._scene.getRenderId();
      if (this._scene.activeCamera) {
        this._currentRenderingCameraUniqueId = this._scene.activeCamera.uniqueId;
      }
    }
    this._initialize();
    if (this.manualEmitCount > -1) {
      this._accumulatedCount += this.manualEmitCount;
      this.manualEmitCount = 0;
    } else {
      this._accumulatedCount += this.emitRate * this._timeDelta;
    }
    if (this._accumulatedCount >= 1) {
      const intPart = this._accumulatedCount | 0;
      this._accumulatedCount -= intPart;
      this._currentActiveCount += intPart;
    }
    this._currentActiveCount = Math.min(this._maxActiveParticleCount, this._currentActiveCount);
    if (!this._currentActiveCount) {
      return 0;
    }
    let emitterWM;
    if (this.emitter.position) {
      const emitterMesh = this.emitter;
      emitterWM = emitterMesh.getWorldMatrix();
    } else {
      const emitterPosition = this.emitter;
      emitterWM = TmpVectors.Matrix[0];
      Matrix.TranslationToRef(emitterPosition.x, emitterPosition.y, emitterPosition.z, emitterWM);
    }
    const engine = this._engine;
    if (!this.updateInAnimate) {
      this._update(emitterWM);
    }
    let outparticles = 0;
    if (!preWarm && !forceUpdateOnly) {
      engine.setState(false);
      if (this.forceDepthWrite) {
        engine.setDepthWrite(true);
      }
      if (this.blendMode === ParticleSystem.BLENDMODE_MULTIPLYADD) {
        outparticles = this._render(ParticleSystem.BLENDMODE_MULTIPLY, emitterWM) + this._render(ParticleSystem.BLENDMODE_ADD, emitterWM);
      } else {
        outparticles = this._render(this.blendMode, emitterWM);
      }
      this._engine.setAlphaMode(0);
    }
    return outparticles;
  }
  /**
   * Rebuilds the particle system
   */
  rebuild() {
    const checkUpdateEffect = () => {
      if (!this._recreateUpdateEffect() || !this._platform.isUpdateBufferReady()) {
        setTimeout(checkUpdateEffect, 10);
      } else {
        this._initialize(true);
        this._rebuildingAfterContextLost = false;
      }
    };
    this._createIndexBuffer();
    this._cachedUpdateDefines = "";
    this._platform.contextLost();
    this._rebuildingAfterContextLost = true;
    checkUpdateEffect();
  }
  _releaseBuffers() {
    if (this._buffer0) {
      this._buffer0.dispose();
      this._buffer0 = null;
    }
    if (this._buffer1) {
      this._buffer1.dispose();
      this._buffer1 = null;
    }
    if (this._spriteBuffer) {
      this._spriteBuffer.dispose();
      this._spriteBuffer = null;
    }
    this._platform.releaseBuffers();
  }
  /**
   * Disposes the particle system and free the associated resources
   * @param disposeTexture defines if the particule texture must be disposed as well (true by default)
   */
  dispose(disposeTexture = true) {
    for (const blendMode in this._drawWrappers) {
      const drawWrapper = this._drawWrappers[blendMode];
      drawWrapper.dispose();
    }
    this._drawWrappers = {};
    if (this._scene) {
      const index = this._scene.particleSystems.indexOf(this);
      if (index > -1) {
        this._scene.particleSystems.splice(index, 1);
      }
    }
    this._releaseBuffers();
    this._platform.releaseVertexBuffers();
    for (let i = 0; i < this._renderVertexBuffers.length; ++i) {
      const rvb = this._renderVertexBuffers[i];
      for (const key in rvb) {
        rvb[key].dispose();
      }
    }
    this._renderVertexBuffers = [];
    if (this._colorGradientsTexture) {
      this._colorGradientsTexture.dispose();
      this._colorGradientsTexture = null;
    }
    if (this._sizeGradientsTexture) {
      this._sizeGradientsTexture.dispose();
      this._sizeGradientsTexture = null;
    }
    if (this._angularSpeedGradientsTexture) {
      this._angularSpeedGradientsTexture.dispose();
      this._angularSpeedGradientsTexture = null;
    }
    if (this._velocityGradientsTexture) {
      this._velocityGradientsTexture.dispose();
      this._velocityGradientsTexture = null;
    }
    if (this._limitVelocityGradientsTexture) {
      this._limitVelocityGradientsTexture.dispose();
      this._limitVelocityGradientsTexture = null;
    }
    if (this._dragGradientsTexture) {
      this._dragGradientsTexture.dispose();
      this._dragGradientsTexture = null;
    }
    if (this._randomTexture) {
      this._randomTexture.dispose();
      this._randomTexture = null;
    }
    if (this._randomTexture2) {
      this._randomTexture2.dispose();
      this._randomTexture2 = null;
    }
    if (disposeTexture && this.particleTexture) {
      this.particleTexture.dispose();
      this.particleTexture = null;
    }
    if (disposeTexture && this.noiseTexture) {
      this.noiseTexture.dispose();
      this.noiseTexture = null;
    }
    this.onStoppedObservable.clear();
    this.onDisposeObservable.notifyObservers(this);
    this.onDisposeObservable.clear();
  }
  /**
   * Clones the particle system.
   * @param name The name of the cloned object
   * @param newEmitter The new emitter to use
   * @param cloneTexture Also clone the textures if true
   * @returns the cloned particle system
   */
  clone(name5, newEmitter, cloneTexture = false) {
    const custom = { ...this._customWrappers };
    let program = null;
    const engine = this._engine;
    if (engine.createEffectForParticles) {
      if (this.customShader != null) {
        program = this.customShader;
        const defines = program.shaderOptions.defines.length > 0 ? program.shaderOptions.defines.join("\n") : "";
        custom[0] = engine.createEffectForParticles(program.shaderPath.fragmentElement, program.shaderOptions.uniforms, program.shaderOptions.samplers, defines, void 0, void 0, void 0, this);
      }
    }
    const serialization = this.serialize(cloneTexture);
    const result = _GPUParticleSystem.Parse(serialization, this._scene || this._engine, this._rootUrl);
    result.name = name5;
    result.customShader = program;
    result._customWrappers = custom;
    if (newEmitter === void 0) {
      newEmitter = this.emitter;
    }
    if (this.noiseTexture) {
      result.noiseTexture = this.noiseTexture.clone();
    }
    result.emitter = newEmitter;
    return result;
  }
  /**
   * Serializes the particle system to a JSON object
   * @param serializeTexture defines if the texture must be serialized as well
   * @returns the JSON object
   */
  serialize(serializeTexture = false) {
    const serializationObject = {};
    ParticleSystem._Serialize(serializationObject, this, serializeTexture);
    serializationObject.activeParticleCount = this.activeParticleCount;
    serializationObject.randomTextureSize = this._randomTextureSize;
    serializationObject.customShader = this.customShader;
    serializationObject.preventAutoStart = this.preventAutoStart;
    serializationObject.worldOffset = this.worldOffset.asArray();
    if (this.metadata) {
      serializationObject.metadata = this.metadata;
    }
    return serializationObject;
  }
  /**
   * Parses a JSON object to create a GPU particle system.
   * @param parsedParticleSystem The JSON object to parse
   * @param sceneOrEngine The scene or the engine to create the particle system in
   * @param rootUrl The root url to use to load external dependencies like texture
   * @param doNotStart Ignore the preventAutoStart attribute and does not start
   * @param capacity defines the system capacity (if null or undefined the sotred capacity will be used)
   * @returns the parsed GPU particle system
   */
  static Parse(parsedParticleSystem, sceneOrEngine, rootUrl, doNotStart = false, capacity) {
    const name5 = parsedParticleSystem.name;
    let engine;
    let scene;
    if (sceneOrEngine instanceof AbstractEngine) {
      engine = sceneOrEngine;
    } else {
      scene = sceneOrEngine;
      engine = scene.getEngine();
    }
    const particleSystem = new _GPUParticleSystem(name5, { capacity: capacity || parsedParticleSystem.capacity, randomTextureSize: parsedParticleSystem.randomTextureSize }, sceneOrEngine, null, parsedParticleSystem.isAnimationSheetEnabled);
    particleSystem._rootUrl = rootUrl;
    if (parsedParticleSystem.customShader && engine.createEffectForParticles) {
      const program = parsedParticleSystem.customShader;
      const defines = program.shaderOptions.defines.length > 0 ? program.shaderOptions.defines.join("\n") : "";
      const custom = engine.createEffectForParticles(program.shaderPath.fragmentElement, program.shaderOptions.uniforms, program.shaderOptions.samplers, defines, void 0, void 0, void 0, particleSystem);
      particleSystem.setCustomEffect(custom, 0);
      particleSystem.customShader = program;
    }
    if (parsedParticleSystem.id) {
      particleSystem.id = parsedParticleSystem.id;
    }
    if (parsedParticleSystem.activeParticleCount) {
      particleSystem.activeParticleCount = parsedParticleSystem.activeParticleCount;
    }
    ParticleSystem._Parse(parsedParticleSystem, particleSystem, sceneOrEngine, rootUrl);
    if (parsedParticleSystem.worldOffset) {
      particleSystem.worldOffset = Vector3.FromArray(parsedParticleSystem.worldOffset);
    }
    if (parsedParticleSystem.preventAutoStart) {
      particleSystem.preventAutoStart = parsedParticleSystem.preventAutoStart;
    }
    if (parsedParticleSystem.metadata) {
      particleSystem.metadata = parsedParticleSystem.metadata;
    }
    if (!doNotStart && !particleSystem.preventAutoStart) {
      particleSystem.start();
    }
    return particleSystem;
  }
};

export {
  GPUParticleSystem
};
//# sourceMappingURL=chunk-XFGCZ437.js.map
