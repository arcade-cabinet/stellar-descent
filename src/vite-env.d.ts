/// <reference types="vite/client" />

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
