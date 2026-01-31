import {
  GPUParticleSystem
} from "./chunk-XFGCZ437.js";
import "./chunk-EHVKL6K3.js";
import "./chunk-XMUFZTPM.js";
import "./chunk-PPY6UZDA.js";
import "./chunk-VQHC3BEQ.js";
import "./chunk-2LG4UFSY.js";
import "./chunk-D5U4XRYD.js";
import "./chunk-VMGDVSFA.js";
import {
  ParticleSystem
} from "./chunk-5I6NLTBN.js";
import "./chunk-MLQDLMPH.js";
import "./chunk-OY4I5RUG.js";
import {
  Mesh
} from "./chunk-43BBZCW2.js";
import "./chunk-GTCUHM7Z.js";
import "./chunk-354MVM62.js";
import "./chunk-NPDPINWR.js";
import "./chunk-BH7TPLNH.js";
import {
  AddIndividualParser,
  AddParser,
  GetIndividualParser
} from "./chunk-SAH7IRBP.js";
import "./chunk-X5263PRI.js";
import "./chunk-RCPM2CUA.js";
import "./chunk-CESSEMZQ.js";
import "./chunk-ZJE4XQK6.js";
import "./chunk-ZRA7NYDC.js";
import "./chunk-Z37P4AH6.js";
import "./chunk-ZAZDILKK.js";
import "./chunk-SI3ZTALR.js";
import "./chunk-TJZRBYWF.js";
import "./chunk-CRAMLVPI.js";
import "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import "./chunk-4SFBNKXP.js";
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
import {
  AbstractEngine
} from "./chunk-CQNOHBC6.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Particles/particleSystemComponent.js
AddParser(SceneComponentConstants.NAME_PARTICLESYSTEM, (parsedData, scene, container, rootUrl) => {
  const individualParser = GetIndividualParser(SceneComponentConstants.NAME_PARTICLESYSTEM);
  if (!individualParser) {
    return;
  }
  if (parsedData.particleSystems !== void 0 && parsedData.particleSystems !== null) {
    for (let index = 0, cache = parsedData.particleSystems.length; index < cache; index++) {
      const parsedParticleSystem = parsedData.particleSystems[index];
      container.particleSystems.push(individualParser(parsedParticleSystem, scene, rootUrl));
    }
  }
});
AddIndividualParser(SceneComponentConstants.NAME_PARTICLESYSTEM, (parsedParticleSystem, scene, rootUrl) => {
  if (parsedParticleSystem.activeParticleCount) {
    const ps = GPUParticleSystem.Parse(parsedParticleSystem, scene, rootUrl);
    return ps;
  } else {
    const ps = ParticleSystem.Parse(parsedParticleSystem, scene, rootUrl);
    return ps;
  }
});
AbstractEngine.prototype.createEffectForParticles = function(fragmentName, uniformsNames = [], samplers = [], defines = "", fallbacks, onCompiled, onError, particleSystem, shaderLanguage = 0, vertexName) {
  let attributesNamesOrOptions = [];
  let effectCreationOption = [];
  const allSamplers = [];
  if (particleSystem) {
    particleSystem.fillUniformsAttributesAndSamplerNames(effectCreationOption, attributesNamesOrOptions, allSamplers);
  } else {
    attributesNamesOrOptions = ParticleSystem._GetAttributeNamesOrOptions();
    effectCreationOption = ParticleSystem._GetEffectCreationOptions();
  }
  if (defines.indexOf(" BILLBOARD") === -1) {
    defines += "\n#define BILLBOARD\n";
  }
  if (particleSystem?.isAnimationSheetEnabled) {
    if (defines.indexOf(" ANIMATESHEET") === -1) {
      defines += "\n#define ANIMATESHEET\n";
    }
  }
  if (samplers.indexOf("diffuseSampler") === -1) {
    samplers.push("diffuseSampler");
  }
  return this.createEffect({
    vertex: vertexName ?? particleSystem?.vertexShaderName ?? "particles",
    fragmentElement: fragmentName
  }, attributesNamesOrOptions, effectCreationOption.concat(uniformsNames), allSamplers.concat(samplers), defines, fallbacks, onCompiled, onError, void 0, shaderLanguage, async () => {
    if (shaderLanguage === 0) {
      await import("./particles.vertex-5SRSSCYI.js");
    } else {
      await import("./particles.vertex-IPAZLKAF.js");
    }
  });
};
Mesh.prototype.getEmittedParticleSystems = function() {
  const results = [];
  for (let index = 0; index < this.getScene().particleSystems.length; index++) {
    const particleSystem = this.getScene().particleSystems[index];
    if (particleSystem.emitter === this) {
      results.push(particleSystem);
    }
  }
  return results;
};
Mesh.prototype.getHierarchyEmittedParticleSystems = function() {
  const results = [];
  const descendants = this.getDescendants();
  descendants.push(this);
  for (let index = 0; index < this.getScene().particleSystems.length; index++) {
    const particleSystem = this.getScene().particleSystems[index];
    const emitter = particleSystem.emitter;
    if (emitter.position && descendants.indexOf(emitter) !== -1) {
      results.push(particleSystem);
    }
  }
  return results;
};
//# sourceMappingURL=@babylonjs_core_Particles_particleSystemComponent.js.map
