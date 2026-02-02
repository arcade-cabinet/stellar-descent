import { resolveAsset } from './paths';

/** sql.js WASM loader script */
export const SQL_WASM_JS = resolveAsset('assets/sql-wasm.js');

/** sql.js WASM binary locator -- used as the locateFile callback base */
export function locateWasmFile(filename: string): string {
  return resolveAsset(`assets/${filename}`);
}
