import {
  DDSTools
} from "./chunk-YJSKIGHW.js";
import "./chunk-HYRQXF2H.js";
import "./chunk-R3ICC5Y5.js";
import "./chunk-7P3NNTBG.js";
import "./chunk-BNLD67Z4.js";
import "./chunk-FTNKZQKS.js";
import "./chunk-5THHQJAG.js";
import "./chunk-5BCZBFCD.js";
import "./chunk-KVNFFPV2.js";
import "./chunk-MS5Q3OEV.js";
import {
  SphericalPolynomial
} from "./chunk-ZRA7NYDC.js";
import "./chunk-Z37P4AH6.js";
import "./chunk-ZAZDILKK.js";
import "./chunk-SI3ZTALR.js";
import "./chunk-CRAMLVPI.js";
import "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import "./chunk-4SFBNKXP.js";
import "./chunk-LY4CWJEX.js";
import "./chunk-W7NAK7I4.js";
import "./chunk-WOKXMMT7.js";
import "./chunk-YNSIAG7O.js";
import "./chunk-O36BJWZ2.js";
import "./chunk-T324X5NK.js";
import "./chunk-VMPPSYS3.js";
import "./chunk-4ZWKSYMN.js";
import "./chunk-ZOIT5ZEZ.js";
import "./chunk-XAOF3L4F.js";
import "./chunk-YVYIHIJT.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/Textures/Loaders/ddsTextureLoader.js
var _DDSTextureLoader = class {
  constructor() {
    this.supportCascades = true;
  }
  /**
   * Uploads the cube texture data to the WebGL texture. It has already been bound.
   * @param imgs contains the cube maps
   * @param texture defines the BabylonJS internal texture
   * @param createPolynomials will be true if polynomials have been requested
   * @param onLoad defines the callback to trigger once the texture is ready
   */
  loadCubeData(imgs, texture, createPolynomials, onLoad) {
    const engine = texture.getEngine();
    let info;
    let loadMipmap = false;
    let maxLevel = 1e3;
    if (Array.isArray(imgs)) {
      for (let index = 0; index < imgs.length; index++) {
        const data = imgs[index];
        info = DDSTools.GetDDSInfo(data);
        texture.width = info.width;
        texture.height = info.height;
        loadMipmap = (info.isRGB || info.isLuminance || info.mipmapCount > 1) && texture.generateMipMaps;
        engine._unpackFlipY(info.isCompressed);
        DDSTools.UploadDDSLevels(engine, texture, data, info, loadMipmap, 6, -1, index);
        if (!info.isFourCC && info.mipmapCount === 1) {
          engine.generateMipMapsForCubemap(texture);
        } else {
          maxLevel = info.mipmapCount - 1;
        }
      }
    } else {
      const data = imgs;
      info = DDSTools.GetDDSInfo(data);
      texture.width = info.width;
      texture.height = info.height;
      if (createPolynomials) {
        info.sphericalPolynomial = new SphericalPolynomial();
      }
      loadMipmap = (info.isRGB || info.isLuminance || info.mipmapCount > 1) && texture.generateMipMaps;
      engine._unpackFlipY(info.isCompressed);
      DDSTools.UploadDDSLevels(engine, texture, data, info, loadMipmap, 6);
      if (!info.isFourCC && info.mipmapCount === 1) {
        engine.generateMipMapsForCubemap(texture, false);
      } else {
        maxLevel = info.mipmapCount - 1;
      }
    }
    engine._setCubeMapTextureParams(texture, loadMipmap, maxLevel);
    texture.isReady = true;
    texture.onLoadedObservable.notifyObservers(texture);
    texture.onLoadedObservable.clear();
    if (onLoad) {
      onLoad({ isDDS: true, width: texture.width, info, data: imgs, texture });
    }
  }
  /**
   * Uploads the 2D texture data to the WebGL texture. It has already been bound once in the callback.
   * @param data contains the texture data
   * @param texture defines the BabylonJS internal texture
   * @param callback defines the method to call once ready to upload
   */
  loadData(data, texture, callback) {
    const info = DDSTools.GetDDSInfo(data);
    const loadMipmap = (info.isRGB || info.isLuminance || info.mipmapCount > 1) && texture.generateMipMaps && Math.max(info.width, info.height) >> info.mipmapCount - 1 === 1;
    callback(info.width, info.height, loadMipmap, info.isFourCC, () => {
      DDSTools.UploadDDSLevels(texture.getEngine(), texture, data, info, loadMipmap, 1);
    });
  }
};
export {
  _DDSTextureLoader
};
//# sourceMappingURL=ddsTextureLoader-LZOS4MU2.js.map
