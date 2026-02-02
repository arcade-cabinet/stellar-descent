/**
 * Asset path resolution for Vite base URL support.
 * All asset references should go through resolveAsset().
 *
 * At base '/':                resolveAsset('assets/foo.glb') → '/assets/foo.glb'
 * At base '/stellar-descent/': resolveAsset('assets/foo.glb') → '/stellar-descent/assets/foo.glb'
 */
export function resolveAsset(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${normalized}`;
}
