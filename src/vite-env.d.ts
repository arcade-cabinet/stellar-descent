/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.gltf' {
  const gltf: any;
  export default gltf;
}
declare module '*.glsl' {
  const glsl: any;
  export default glsl;
}

declare module 'earcut';
declare module 'recast-detour';

// PWA virtual module types
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
