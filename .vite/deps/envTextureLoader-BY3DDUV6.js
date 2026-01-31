import {
  GetEnvInfo,
  UploadEnvLevelsAsync,
  UploadEnvSpherical
} from "./chunk-2T5XKVKQ.js";
import "./chunk-IPTJ7WMY.js";
import "./chunk-G2R725ZT.js";
import "./chunk-R3ICC5Y5.js";
import "./chunk-7P3NNTBG.js";
import "./chunk-DTS5N2I5.js";
import "./chunk-BNLD67Z4.js";
import "./chunk-FTNKZQKS.js";
import "./chunk-5THHQJAG.js";
import "./chunk-5BCZBFCD.js";
import "./chunk-KVNFFPV2.js";
import "./chunk-MS5Q3OEV.js";
import "./chunk-ZRA7NYDC.js";
import "./chunk-Z37P4AH6.js";
import "./chunk-ZAZDILKK.js";
import "./chunk-SI3ZTALR.js";
import "./chunk-CRAMLVPI.js";
import "./chunk-CHQ2B3XR.js";
import "./chunk-I3CLM2Q3.js";
import "./chunk-4SFBNKXP.js";
import "./chunk-LY4CWJEX.js";
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

// node_modules/.pnpm/@babylonjs+core@8.49.1/node_modules/@babylonjs/core/Materials/Textures/Loaders/envTextureLoader.js
var _ENVTextureLoader = class {
  constructor() {
    this.supportCascades = false;
  }
  /**
   * Uploads the cube texture data to the WebGL texture. It has already been bound.
   * @param data contains the texture data
   * @param texture defines the BabylonJS internal texture
   * @param createPolynomials will be true if polynomials have been requested
   * @param onLoad defines the callback to trigger once the texture is ready
   * @param onError defines the callback to trigger in case of error
   */
  loadCubeData(data, texture, createPolynomials, onLoad, onError) {
    if (Array.isArray(data)) {
      return;
    }
    const info = GetEnvInfo(data);
    if (info) {
      texture.width = info.width;
      texture.height = info.width;
      try {
        UploadEnvSpherical(texture, info);
        UploadEnvLevelsAsync(texture, data, info).then(() => {
          texture.isReady = true;
          texture.onLoadedObservable.notifyObservers(texture);
          texture.onLoadedObservable.clear();
          if (onLoad) {
            onLoad();
          }
        }, (reason) => {
          onError?.("Can not upload environment levels", reason);
        });
      } catch (e) {
        onError?.("Can not upload environment file", e);
      }
    } else if (onError) {
      onError("Can not parse the environment file", null);
    }
  }
  /**
   * Uploads the 2D texture data to the WebGL texture. It has already been bound once in the callback.
   */
  loadData() {
    throw ".env not supported in 2d.";
  }
};
export {
  _ENVTextureLoader
};
//# sourceMappingURL=envTextureLoader-BY3DDUV6.js.map
