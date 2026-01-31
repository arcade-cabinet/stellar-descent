/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build flag environment variables
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_PUBLIC_PATH?: string;
  /** Unlock all campaign levels (dev/testing) */
  readonly VITE_UNLOCK_ALL_CAMPAIGNS?: string;
  /** Enable AI Player option in Settings */
  readonly VITE_ENABLE_AI_PLAYER?: string;
  /** Show debug info in HUD */
  readonly VITE_DEBUG_HUD?: string;
  /** Enable dev menu (backtick key) */
  readonly VITE_DEV_MENU?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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
